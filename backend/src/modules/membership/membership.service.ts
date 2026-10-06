import { PrismaClient } from "@prisma/client";
import { assertPromoAllowed } from "../promo/promoRules";
import { CreateMembershipPlanDTO, UpdateMembershipPlanDTO, CreateSubscriptionDTO, TimeSlotAvailability } from "./membership.dto";
import { AppError } from "../../middlewares/error.middleware";
import SettingsService from "../settings/settings.service";
import { PromoCode as PromoCodeDTO } from "../settings/settings.dto";
import { uploadFileToR2 } from "../../utils/r2storage";
import fs from "fs";
import path from "path";
import logger from "../../config/logger";
import loyaltyService from "../loyalty/loyalty.service";
import smsService from "../../services/sms.service";
import bookingService from "../booking/booking.service";
import notificationService from "../notification/notification.service";

const prisma = new PrismaClient();

// Define available time slots (can be moved to settings later)
const TIME_SLOTS = [
  "05:00-06:00",
  "06:00-07:00",
  "07:00-08:00",
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
  "19:00-20:00",
  "20:00-21:00",
  "21:00-22:00",
];

const SLOT_CAPACITY = 1; // Each slot is exclusive - only 1 user per time slot
const MEMBERSHIP_PAYMENT_LOG_PREFIX = "MEMBERSHIP_PAYMENT_LOG:";
const MEMBERSHIP_SUB_LINK_PREFIX = "MEMBERSHIP_SUB:";

type MembershipPaymentLogEntry = {
  at: string;
  cashAmount: number;
  onlineAmount: number;
  totalAmount: number;
};

class MembershipService {
  private getMembershipSubLinkTag(subscriptionId: string): string {
    return `${MEMBERSHIP_SUB_LINK_PREFIX}${subscriptionId}`;
  }

  private parseMembershipPaymentHistory(notes?: string | null): MembershipPaymentLogEntry[] {
    if (!notes) return [];

    return notes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith(MEMBERSHIP_PAYMENT_LOG_PREFIX) || line.startsWith("BOOKING_PAYMENT_LOG:"))
      .map((line) => {
        if (line.startsWith(MEMBERSHIP_PAYMENT_LOG_PREFIX)) {
          return line.replace(MEMBERSHIP_PAYMENT_LOG_PREFIX, "").trim();
        } else {
          return line.replace("BOOKING_PAYMENT_LOG:", "").trim();
        }
      })
      .map((payload) => {
        try {
          const parsed = JSON.parse(payload);
          return {
            at: String(parsed.at || ""),
            cashAmount: Number(parsed.cashAmount || 0),
            onlineAmount: Number(parsed.onlineAmount || 0),
            totalAmount: Number(parsed.totalAmount || 0),
          } as MembershipPaymentLogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is MembershipPaymentLogEntry => {
        return Boolean(entry && Number.isFinite(entry.totalAmount) && entry.totalAmount > 0);
      })
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  private appendMembershipPaymentHistory(
    existingNotes: string | null | undefined,
    entry: MembershipPaymentLogEntry,
  ): string {
    const base = (existingNotes || "").trim();
    const payload = `${MEMBERSHIP_PAYMENT_LOG_PREFIX} ${JSON.stringify(entry)}`;
    return base ? `${base}\n${payload}` : payload;
  }

  private buildPaidHistoryExpression(history: MembershipPaymentLogEntry[], paidTotal: number): string {
    if (history.length === 0) {
      return paidTotal > 0 ? `${paidTotal}` : "0";
    }

    const historySum = history.reduce((sum, h) => sum + h.totalAmount, 0);
    const legacyAmount = Math.max(0, paidTotal - historySum);

    const parts: string[] = [];
    if (legacyAmount > 0) {
      parts.push(`${legacyAmount}`);
    }

    parts.push(...history.map((h) => `${h.totalAmount}`));

    return `${parts.join(" + ")} = ${paidTotal}`;
  }

  private async findMembershipLedgerBooking(subscription: {
    id: string;
    userId: string;
    timeSlot: string | null;
    plan: { name: string };
    paymentVerifiedAt: Date | null;
    createdAt: Date;
  }) {
    const linkTag = this.getMembershipSubLinkTag(subscription.id);
    const slotStart = subscription.timeSlot?.split("-")[0] || null;
    const ledgerDate = (subscription.paymentVerifiedAt || subscription.createdAt)
      .toISOString()
      .split("T")[0];

    const linkedMatch = await prisma.booking.findFirst({
      where: {
        notes: { contains: linkTag },
      },
      orderBy: { createdAt: "desc" },
    });

    if (linkedMatch) return linkedMatch;

    const exactMatch = await prisma.booking.findFirst({
      where: {
        userId: subscription.userId,
        notes: { contains: "MEMBERSHIP_PAYMENT" },
        date: ledgerDate,
        ...(slotStart ? { startTime: slotStart } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (exactMatch) return exactMatch;

    // Fallback for older records where only membership marker/plan text is available.
    return prisma.booking.findFirst({
      where: {
        userId: subscription.userId,
        AND: [
          { notes: { contains: "MEMBERSHIP_PAYMENT" } },
          ...(subscription.plan?.name ? [{ notes: { contains: subscription.plan.name } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private mapToResponse(plan: any) {
    return {
      ...plan,
      perks: plan.perks ? JSON.parse(plan.perks) : [],
      pricingMatrix: plan.pricingMatrix ? JSON.parse(plan.pricingMatrix) : null,
    };
  }

  private mapSubscriptionResponse(sub: any) {
    return {
      ...sub,
      plan: sub.plan ? this.mapToResponse(sub.plan) : null,
    };
  }

  private hhmmToMinutes(time: string): number {
    const [hh, mm] = time.split(":").map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    return hh * 60 + mm;
  }

  private getWeekdayFromYMD(ymd: string): string {
    // ymd is "YYYY-MM-DD" with no timezone. Use UTC for deterministic day-of-week.
    const [y, m, d] = ymd.split("-").map((n) => Number(n));
    if (!y || !m || !d) return "";
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
  }

  private getWeekdayFromDate(date: Date): string {
    const ymd = date.toISOString().split("T")[0];
    return this.getWeekdayFromYMD(ymd);
  }

  private isTimeWithinPromoWindow(slotStartTime: string, promoStart?: string, promoEnd?: string): boolean {
    if (!promoStart || !promoEnd) return true; // no restriction
    const slotMin = this.hhmmToMinutes(slotStartTime);
    const startMin = this.hhmmToMinutes(promoStart);
    const endMin = this.hhmmToMinutes(promoEnd);
    if (!Number.isFinite(slotMin) || !Number.isFinite(startMin) || !Number.isFinite(endMin)) return false;

    // Inclusive both sides.
    return slotMin >= startMin && slotMin <= endMin;
  }

  private isPromoExpired(promo: PromoCodeDTO): boolean {
    if (!promo.expiryDate) return false;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expiry = new Date(promo.expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);
    return expiry < today;
  }

  private assertPromoValidForMembership(
    promo: PromoCodeDTO,
    startDate: Date,
    chosenDays: string[] | undefined,
    timeSlot: string | undefined
  ): void {
    if (promo.isActive === false) {
      throw new AppError(400, "Invalid promo code.");
    }

    if (promo.appliedTo !== "membership" && promo.appliedTo !== "both") {
      throw new AppError(400, "This promo code is for booking only.");
    }

    if (this.isPromoExpired(promo)) {
      throw new AppError(400, "This promo code has expired.");
    }

    if (promo.validDays && promo.validDays.length > 0) {
      const weekday = this.getWeekdayFromDate(startDate);
      const candidateDays = chosenDays && chosenDays.length > 0 ? chosenDays : weekday ? [weekday] : [];
      const hasMatch = candidateDays.some((d) => promo.validDays?.includes(d));
      if (!hasMatch) {
        throw new AppError(400, "This promo code is not valid for the selected day.");
      }
    }

    if (promo.startTime && promo.endTime) {
      if (!timeSlot) {
        throw new AppError(400, "Please select a time slot before applying this promo.");
      }
      const slotStart = timeSlot.split("-")[0]?.trim();
      if (!slotStart || !this.isTimeWithinPromoWindow(slotStart, promo.startTime, promo.endTime)) {
        throw new AppError(400, "This promo code is not valid for the selected time slot.");
      }
    }
  }

  // Plans
  async getAllPlans(includeInactive = false) {
    const plans = await prisma.membershipPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { price: "asc" },
    });

    return plans.map(plan => this.mapToResponse(plan));
  }

  async getPlanById(id: string) {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
    });

    if (!plan) return null;
    return this.mapToResponse(plan);
  }

  async createPlan(data: CreateMembershipPlanDTO) {
    const perksStr = JSON.stringify(data.perks);
    const plan = await prisma.membershipPlan.create({
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price,
        perks: perksStr,
        featured: data.featured || false,
        isActive: true,
        pricingMatrix: data.pricingMatrix || null,
        price3DaysMorning: data.price3DaysMorning || null,
        price3DaysDay: data.price3DaysDay || null,
        price3DaysEvening: data.price3DaysEvening || null,
        price1MonthMorning: data.price1MonthMorning || null,
        price1MonthDay: data.price1MonthDay || null,
        price1MonthEvening: data.price1MonthEvening || null,
        price3MonthsMorning: data.price3MonthsMorning || null,
        price3MonthsDay: data.price3MonthsDay || null,
        price3MonthsEvening: data.price3MonthsEvening || null,

        discount3DaysMorning: data.discount3DaysMorning || 0,
        discount3DaysDay: data.discount3DaysDay || 0,
        discount3DaysEvening: data.discount3DaysEvening || 0,
        discount1MonthMorning: data.discount1MonthMorning || 0,
        discount1MonthDay: data.discount1MonthDay || 0,
        discount1MonthEvening: data.discount1MonthEvening || 0,
        discount3MonthsMorning: data.discount3MonthsMorning || 0,
        discount3MonthsDay: data.discount3MonthsDay || 0,
        discount3MonthsEvening: data.discount3MonthsEvening || 0,
      },
    });
    return this.mapToResponse(plan);
  }

  async updatePlan(id: string, data: UpdateMembershipPlanDTO) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.perks !== undefined) updateData.perks = JSON.stringify(data.perks);
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.pricingMatrix !== undefined) updateData.pricingMatrix = data.pricingMatrix;

    if (data.price3DaysMorning !== undefined) updateData.price3DaysMorning = data.price3DaysMorning;
    if (data.price3DaysDay !== undefined) updateData.price3DaysDay = data.price3DaysDay;
    if (data.price3DaysEvening !== undefined) updateData.price3DaysEvening = data.price3DaysEvening;
    if (data.price1MonthMorning !== undefined) updateData.price1MonthMorning = data.price1MonthMorning;
    if (data.price1MonthDay !== undefined) updateData.price1MonthDay = data.price1MonthDay;
    if (data.price1MonthEvening !== undefined) updateData.price1MonthEvening = data.price1MonthEvening;
    if (data.price3MonthsMorning !== undefined) updateData.price3MonthsMorning = data.price3MonthsMorning;
    if (data.price3MonthsDay !== undefined) updateData.price3MonthsDay = data.price3MonthsDay;
    if (data.price3MonthsEvening !== undefined) updateData.price3MonthsEvening = data.price3MonthsEvening;

    if (data.discount3DaysMorning !== undefined) updateData.discount3DaysMorning = data.discount3DaysMorning;
    if (data.discount3DaysDay !== undefined) updateData.discount3DaysDay = data.discount3DaysDay;
    if (data.discount3DaysEvening !== undefined) updateData.discount3DaysEvening = data.discount3DaysEvening;
    if (data.discount1MonthMorning !== undefined) updateData.discount1MonthMorning = data.discount1MonthMorning;
    if (data.discount1MonthDay !== undefined) updateData.discount1MonthDay = data.discount1MonthDay;
    if (data.discount1MonthEvening !== undefined) updateData.discount1MonthEvening = data.discount1MonthEvening;
    if (data.discount3MonthsMorning !== undefined) updateData.discount3MonthsMorning = data.discount3MonthsMorning;
    if (data.discount3MonthsDay !== undefined) updateData.discount3MonthsDay = data.discount3MonthsDay;
    if (data.discount3MonthsEvening !== undefined) updateData.discount3MonthsEvening = data.discount3MonthsEvening;

    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: updateData,
    });
    return this.mapToResponse(plan);
  }

  async deletePlan(id: string) {
    return await prisma.membershipPlan.delete({
      where: { id },
    });
  }

  async setFeaturedPlan(id: string) {
    // First, unset all featured plans
    await prisma.membershipPlan.updateMany({
      data: { featured: false },
    });

    // Then set the specified plan as featured
    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: { featured: true },
    });

    return this.mapToResponse(plan);
  }

  // Subscriptions
  async getActiveSubscription(userId: string) {
    const now = new Date();

    const subscription = await prisma.membershipSubscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "pending"] },
        endDate: { gte: now },
      },
      include: { plan: true },
      orderBy: { endDate: "desc" },
    });

    if (!subscription) return null;
    return this.mapSubscriptionResponse(subscription);
  }

  async isPlanAvailableForUser(planId: string, userId: string): Promise<boolean> {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return false;
    }

    const existingActive = await this.getActiveSubscription(userId);
    return !existingActive;
  }

  async getUserSubscriptions(userId: string) {
    const subscriptions = await prisma.membershipSubscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map(sub => this.mapSubscriptionResponse(sub));
  }

  async manualCreateSubscription(data: any) {
    let user = await prisma.user.findUnique({
      where: { phoneNumber: data.phoneNumber },
    });

    if (!user) {
      // Create user if doesn't exist
      user = await prisma.user.create({
        data: {
          phoneNumber: data.phoneNumber,
          name: data.name || "Walk-in Member",
          email: data.email || `${data.phoneNumber}@manual.com`,
          password: "MANUAL_CREATED_USER", // Placeholder password
          role: "user",
        },
      });
    }

    return this.createSubscription(user.phoneNumber, { ...data, isManual: true });
  }

  async createSubscription(userId: string, data: CreateSubscriptionDTO) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { phoneNumber: userId },
    });

    if (!user) {
      throw new Error("User profile not found. Please ensure you are logged in as a player, not an admin.");
    }

    // Check if user already has an active subscription
    const existingActive = await this.getActiveSubscription(userId);
    if (existingActive) {
      throw new Error("User already has an active subscription");
    }

    // Check if plan exists
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: data.planId },
    });

    if (!plan || !plan.isActive) {
      throw new Error("Plan not found or inactive");
    }

    // Global peak hour restriction for any membership plan (4PM - 8PM)
    if (data.timeSlot) {
      const excludedSlots = ["16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"];
      if (excludedSlots.includes(data.timeSlot)) {
        throw new Error("Selected time slot (4 PM - 8 PM) is reserved for general bookings and unavailable for membership plans.");
      }
    }

    // Calculate start and end dates
    let startDate: Date;
    if (data.startDate) {
      const [y, m, d] = data.startDate.split("-").map(Number);
      startDate = new Date(Date.UTC(y, m - 1, d));

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (startDate < today) {
        throw new Error("Start date cannot be in the past");
      }
    } else {
      startDate = new Date();
      startDate.setUTCHours(0, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    if (data.chosenDuration === "3_months") {
      endDate.setUTCDate(endDate.getUTCDate() + 90);
    } else {
      endDate.setUTCDate(endDate.getUTCDate() + 30);
    }

    // Validate promo code server-side (never trust frontend-calculated discount).
    let validatedPromoCode: string | null = null;
    if (data.promoCode) {
      const normalizedCode = data.promoCode.trim().toUpperCase();
      const promoCodes = await SettingsService.getPromoCodes();
      const promo = promoCodes.find(
        (p) => p.code.trim().toUpperCase() === normalizedCode,
      );

      if (!promo) {
        throw new AppError(400, "Invalid promo code. Please check and try again.");
      }

      await assertPromoAllowed(userId, normalizedCode);
      this.assertPromoValidForMembership(promo, startDate, data.chosenDays, data.timeSlot);
      validatedPromoCode = promo.code;
    }

    // Validate time slot if provided
    if (data.timeSlot) {
      if (!TIME_SLOTS.includes(data.timeSlot)) {
        throw new Error("Invalid time slot");
      }

      const isAvailable = await this.isTimeSlotAvailableForDateRange(
        data.timeSlot,
        startDate,
        endDate,
        data.chosenDays
      );
      if (!isAvailable) {
        throw new Error("Time slot is already booked for this period");
      }
    }

    const subscription = await prisma.membershipSubscription.create({
      data: {
        planId: data.planId,
        userId,
        startDate,
        endDate,
        status: "pending", // Needs admin verification
        timeSlot: data.timeSlot || null,
        paymentStatus: "pending",
        chosenDuration: data.chosenDuration,
        chosenCategory: data.chosenCategory,
        chosenDays: data.chosenDays || [],
        excludeDays: data.excludeDays || [],
        totalPrice: data.totalPrice,
        promoCode: validatedPromoCode,
        discountAmount: data.totalPrice !== undefined ? 0 : 0, // Placeholder if calculated by frontend
      } as any,
      include: {
        plan: true,
        user: true,
      }
    });

    // Notify Admin
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    if (adminPhone && !data.isManual) {
      const adminMessage = `New Membership! ${user.name} (${user.phoneNumber}) subscribed to ${subscription.plan.name}. Total: Rs.${subscription.totalPrice}. Pending verification.`;
      smsService.send({
        phoneNumber: adminPhone,
        message: adminMessage,
      }).catch(err => logger.error("Failed to send membership notification to admin", err));
    }

    return this.mapSubscriptionResponse(subscription);
  }

  async cancelSubscription(subscriptionId: string, userId: string) {
    const subscription = await prisma.membershipSubscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const updated = await prisma.membershipSubscription.update({
      where: { id: subscriptionId },
      data: { status: "cancelled" },
      include: { plan: true },
    });

    return this.mapSubscriptionResponse(updated);
  }

  async getAllSubscriptions() {
    const subscriptions = await prisma.membershipSubscription.findMany({
      include: { plan: true, user: true },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map(sub => this.mapSubscriptionResponse(sub));
  }

  // Time Slot Management

  // Check if a time slot is available for a specific date range
  async isTimeSlotAvailableForDateRange(
    timeSlot: string,
    startDate: Date,
    endDate: Date,
    chosenDays?: string[]
  ): Promise<boolean> {
    const overlappingSubscription = await prisma.membershipSubscription.findFirst({
      where: {
        timeSlot,
        status: { in: ["active", "pending"] },
        AND: [
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } },
        ],
      },
    });

    if (overlappingSubscription) return false;

    // Check for overlapping normal bookings
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];
    const startTime = timeSlot.split("-")[0];

    const overlappingBookings = await prisma.booking.findMany({
      where: {
        date: { gte: startStr, lte: endStr },
        startTime: startTime,
        status: { notIn: ["cancelled", "cancelled_due_to_tournament", "skipped_due_to_tournament"] },
      },
    });

    if (overlappingBookings.length > 0) {
      // If chosenDays is provided, check if any booking falls on those days
      if (chosenDays && chosenDays.length > 0) {
        const hasConflict = overlappingBookings.some((b) => {
          const weekday = this.getWeekdayFromYMD(b.date);
          return chosenDays.includes(weekday);
        });
        if (hasConflict) return false;
      } else {
        // If no chosenDays, any booking in range is a conflict
        return false;
      }
    }

    return true;
  }

  // Get available time slots for a specific start date
  async getAvailableTimeSlots(startDate?: string): Promise<TimeSlotAvailability[]> {
    let requestedStartDate: Date;
    let requestedEndDate: Date;

    if (startDate) {
      // Create date from YYYY-MM-DD string as UTC to avoid local timezone shifts
      const [y, m, d] = startDate.split("-").map(Number);
      requestedStartDate = new Date(Date.UTC(y, m - 1, d));
    } else {
      requestedStartDate = new Date();
      requestedStartDate.setUTCHours(0, 0, 0, 0);
    }

    requestedEndDate = new Date(requestedStartDate);
    requestedEndDate.setUTCDate(requestedEndDate.getUTCDate() + 30);

    const overlappingSubscriptions = await prisma.membershipSubscription.findMany({
      where: {
        status: { in: ["active", "pending"] },
        timeSlot: { not: null },
        AND: [
          { startDate: { lt: requestedEndDate } },
          { endDate: { gt: requestedStartDate } },
        ],
      },
      select: { timeSlot: true },
    });

    // Check for any normal bookings in the range
    const startStr = requestedStartDate.toISOString().split("T")[0];
    const endStr = requestedEndDate.toISOString().split("T")[0];
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        date: { gte: startStr, lte: endStr },
        status: { notIn: ["cancelled", "cancelled_due_to_tournament", "skipped_due_to_tournament"] },
      },
      select: { startTime: true },
    });

    const subBookedSlots = new Set(overlappingSubscriptions.map(sub => sub.timeSlot));
    const bookingStartTimes = new Set(overlappingBookings.map(b => b.startTime));

    return TIME_SLOTS.map(slot => {
      const startHour = slot.split("-")[0];
      const isSubBooked = subBookedSlots.has(slot);
      const isNormalBooked = bookingStartTimes.has(startHour);
      const isReserved = isSubBooked || isNormalBooked;

      return {
        slot,
        capacity: SLOT_CAPACITY,
        reserved: isReserved ? 1 : 0,
        available: !isReserved,
      };
    });
  }

  async getTimeSlotAvailability(timeSlot: string, startDate?: string): Promise<TimeSlotAvailability> {
    const allSlots = await this.getAvailableTimeSlots(startDate);
    const slotInfo = allSlots.find(s => s.slot === timeSlot);

    if (!slotInfo) {
      throw new Error("Invalid time slot");
    }

    return slotInfo;
  }

  // Payment Verification (Admin only)
  async verifyPayment(subscriptionId: string, adminUserId: string, sendSms: boolean = true) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, user: true },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.paymentStatus === "verified") {
      throw new Error("Payment already verified");
    }

    // Update subscription: mark payment as verified and activate
    const updatedSubscription = await prisma.membershipSubscription.update({
      where: { id: subscriptionId },
      data: {
        paymentStatus: "verified",
        paymentVerifiedBy: adminUserId,
        paymentVerifiedAt: new Date(),
        status: "active",
      },
      include: { plan: true, user: true },
    });

    // Create a record in the booking ledger for this membership payment
    // This allows admins to "settle" the payment (Cash/Online) from the Ledger page
    await prisma.booking.create({
      data: {
        userId: updatedSubscription.userId,
        customerName: updatedSubscription.user.name,
        customerPhone: updatedSubscription.user.phoneNumber,
        customerEmail: updatedSubscription.user.email,
        date: new Date().toISOString().split("T")[0],
        startTime: updatedSubscription.timeSlot?.split("-")[0] || "00:00",
        endTime: updatedSubscription.timeSlot?.split("-")[1] || "01:00",
        duration: 1,
        basePrice: updatedSubscription.totalPrice || 0,
        subtotal: updatedSubscription.totalPrice || 0,
        totalPrice: updatedSubscription.totalPrice || 0,
        remainingAmount: updatedSubscription.totalPrice || 0,
        paymentMethod: "venue",
        paymentStatus: "pending",
        status: "confirmed",
        notes: `MEMBERSHIP_PAYMENT: ${updatedSubscription.plan.name}\n${this.getMembershipSubLinkTag(updatedSubscription.id)}`,
        waterBottles: 0,
      } as any
    });

    // Loyalty: a 3-month plan bonus is awarded when the payment is verified (never twice for the same subscription)
    await loyaltyService
      .awardForMembership(updatedSubscription.userId, updatedSubscription.id, updatedSubscription.chosenDuration === "3_months" ? "quarterly" : "monthly", false)
      .catch((err) => logger.error("Failed to award membership points", err));

    await notificationService.notify({
      userId: updatedSubscription.userId, type: "membership", title: "Membership active",
      message: `Your ${updatedSubscription.plan.name} membership is active until ${updatedSubscription.endDate.toLocaleDateString("en-GB")}.`,
      href: "/member", dedupeKey: `member-active-${updatedSubscription.id}`,
    });

    // Send SMS notification to the player
    const userName = updatedSubscription.user.name || "Member";
    const endDateStr = updatedSubscription.endDate.toLocaleDateString("en-GB");
    const planName = updatedSubscription.plan.name;
    const activationMessage = `Dear ${userName}, Your ${planName} membership has been successfully activated. Your subscription is valid until ${endDateStr}. Thank you for choosing Unique Futsal. Play safe and enjoy your game! Thank you for being part of Unique Futsal.`;

    if (sendSms) {
      smsService.send({
        phoneNumber: updatedSubscription.user.phoneNumber || updatedSubscription.userId,
        message: activationMessage,
      }).catch(err => logger.error("Failed to send membership activation SMS", err));
    }

    return this.mapSubscriptionResponse(updatedSubscription);
  }

  async settlePayment(
    subscriptionId: string,
    data: {
      method: "cash" | "online" | "partial";
      cashAmount: number;
      onlineAmount: number;
      waterBottles?: number;
      addOns?: string;
      addOnsPrice?: number;
    },
  ) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, user: true },
    });

    if (!subscription) {
      throw new AppError(404, "Subscription not found");
    }

    const ledgerBooking = await this.findMembershipLedgerBooking(subscription as any);
    if (!ledgerBooking) {
      throw new AppError(404, "Membership payment record not found in booking ledger");
    }

    const cashAmount = Number(data.cashAmount || 0);
    const onlineAmount = Number(data.onlineAmount || 0);
    const waterBottles = Number(data.waterBottles || 0);
    const addOnsPrice = Number(data.addOnsPrice || 0);

    if (cashAmount < 0 || onlineAmount < 0 || waterBottles < 0 || addOnsPrice < 0) {
      throw new AppError(400, "Amounts cannot be negative");
    }

    // Keep settlement math aligned with booking admin payment modal behavior.
    // First 2 bottles are complimentary — never charge negative water amounts.
    const currentTotal =
      (subscription.totalPrice || 0) + Math.max(0, waterBottles - 2) * 25 + addOnsPrice;
    const currentPayment = cashAmount + onlineAmount;
    const totalPaid =
      (ledgerBooking.amountPaidNow || 0) + currentPayment;
    const isFullPayment = totalPaid >= currentTotal;

    await bookingService.updateBooking(ledgerBooking.id, {
      paymentStatus: isFullPayment ? "completed" : "partially_paid",
      amountPaidNow: totalPaid,
      cashAmount: (ledgerBooking.cashAmount || 0) + cashAmount,
      onlineAmount: (ledgerBooking.onlineAmount || 0) + onlineAmount,
      status: isFullPayment ? "completed" : ledgerBooking.status,
      waterBottles,
      addOns: data.addOns || "",
      addOnsPrice,
      totalPrice: currentTotal,
      remainingAmount: Math.max(0, currentTotal - totalPaid),
    } as any);

    return this.mapSubscriptionResponse(subscription);
  }

  async getSettlementSummary(subscriptionId: string) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, user: true },
    });

    if (!subscription) {
      throw new AppError(404, "Subscription not found");
    }

    const ledgerBooking = await this.findMembershipLedgerBooking(subscription as any);
    if (!ledgerBooking) {
      throw new AppError(404, "Membership payment record not found in booking ledger");
    }

    const paymentHistory = this.parseMembershipPaymentHistory(ledgerBooking.notes);
    const paidTotal = ledgerBooking.amountPaidNow || 0;

    return {
      bookingId: ledgerBooking.id,
      basePrice: subscription.totalPrice || subscription.plan?.price || 0,
      totalPrice: ledgerBooking.totalPrice || 0,
      amountPaidNow: paidTotal,
      cashAmount: ledgerBooking.cashAmount || 0,
      onlineAmount: ledgerBooking.onlineAmount || 0,
      remainingAmount: ledgerBooking.remainingAmount || 0,
      paymentStatus: ledgerBooking.paymentStatus || "pending",
      waterBottles: ledgerBooking.waterBottles || 0,
      addOns: ledgerBooking.addOns || "",
      addOnsPrice: ledgerBooking.addOnsPrice || 0,
      paymentHistory,
      paidHistoryExpression: this.buildPaidHistoryExpression(paymentHistory, paidTotal),
    };
  }

  async getPendingSubscriptions() {
    const subscriptions = await prisma.membershipSubscription.findMany({
      where: {
        paymentStatus: "pending",
        status: "pending",
      },
      include: { plan: true, user: true },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map(sub => this.mapSubscriptionResponse(sub));
  }

  // Admin: Delete subscription
  async deleteSubscription(subscriptionId: string) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await prisma.membershipSubscription.delete({
      where: { id: subscriptionId },
    });

    return true;
  }

  // Admin: Update subscription details
  async updateSubscription(subscriptionId: string, data: any) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const updated = await prisma.membershipSubscription.update({
      where: { id: subscriptionId },
      data: {
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
        paymentStatus: data.paymentStatus,
        timeSlot: data.timeSlot,
        totalPrice: data.totalPrice ? parseFloat(data.totalPrice) : undefined,
        chosenCategory: data.chosenCategory,
        chosenDuration: data.chosenDuration,
        chosenDays: data.chosenDays,
        excludeDays: data.excludeDays,
      } as any,
      include: { plan: true, user: true },
    });

    return this.mapSubscriptionResponse(updated);
  }

  // Admin: Renew subscription
  async renewSubscription(subscriptionId: string) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Determine extension duration (default 1 month if not specified)
    const durationDays = subscription.chosenDuration === "3_months" ? 90 : 30;

    const currentEndDate = new Date(subscription.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    const updated = await prisma.membershipSubscription.update({
      where: { id: subscriptionId },
      data: {
        endDate: newEndDate,
        status: "active",
        paymentStatus: "verified",
      },
      include: { plan: true, user: true },
    });

    // Each renewal of a 3-month plan earns the bonus once (the source id includes the new end date)
    await loyaltyService
      .awardForMembership(updated.userId, `${updated.id}:${newEndDate.toISOString().slice(0, 10)}`, subscription.chosenDuration === "3_months" ? "quarterly" : "monthly", true)
      .catch((err) => logger.error("Failed to award membership renewal points", err));

    return this.mapSubscriptionResponse(updated);
  }

  // Cron task: Send expiry reminders 15 days before
  async sendExpiryReminders() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15);
    const dateStr = targetDate.toISOString().split('T')[0];

    const expiringSubscriptions = await prisma.membershipSubscription.findMany({
      where: {
        status: "active",
        endDate: {
          gte: new Date(dateStr + "T00:00:00.000Z"),
          lte: new Date(dateStr + "T23:59:59.999Z"),
        },
      },
      include: { user: true, plan: true },
    });

    logger.info(`Checking for membership expiry reminders for ${dateStr}. Found ${expiringSubscriptions.length}.`);

    for (const sub of expiringSubscriptions) {
      if (sub.user?.phoneNumber) {
        const userName = sub.user.name || "Member";
        const endDateStr = sub.endDate.toLocaleDateString("en-GB");
        const message = `Dear ${userName}, Your membership plan will expire on ${endDateStr}. Renew within 15 days to continue enjoying member benefits and hassle-free bookings. Thank you for being part of Unique Futsal.`;

        smsService.send({
          phoneNumber: sub.user.phoneNumber,
          message: message,
        }).catch(err => logger.error(`Failed to send expiry reminder to ${sub.user.phoneNumber}`, err));
      }
    }
  }

  async uploadInvoice(id: string, pdfBase64: string) {
    const subscription = await prisma.membershipSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new AppError(404, "Subscription not found");
    }

    // Extract the base64 data (strip data URL prefix if present)
    const base64Data = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;

    const buffer = Buffer.from(base64Data, "base64");
    const relativePath = `invoices/MEM-${id.slice(-6).toUpperCase()}_${Date.now()}.pdf`;

    // Fallback to local storage if R2 is not configured
    const isR2Configured =
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME;

    if (isR2Configured) {
      try {
        const invoiceUrl = await uploadFileToR2(buffer, relativePath, "application/pdf");
        return { invoiceUrl };
      } catch (err) {
        logger.error("R2 Upload failed, falling back to local:", err);
      }
    }

    // Local Storage Fallback
    const absolutePath = path.join(process.cwd(), "uploads", relativePath);
    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(absolutePath, buffer);

    // Determine base URL
    const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
    const invoiceUrl = `${baseUrl}/uploads/${relativePath}`;

    return { invoiceUrl };
  }
}

export default new MembershipService();
