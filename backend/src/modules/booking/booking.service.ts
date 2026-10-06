import { prisma } from "../../config/db";
import { uniqueBookingCode, fallbackBookingCode } from "../../utils/bookingCode";
import { AppError } from "../../middlewares/error.middleware";
import {
  CreateBookingDTO,
  UpdateBookingDTO,
  BookingResponse,
} from "./booking.dto";
import logger from "../../config/logger";
import { todayKey, currentHour, currentTime as nowTime } from "../../utils/dates";
import loyaltyService from "../loyalty/loyalty.service";
import paymentService from "../payment/payment.service";
import notificationService from "../notification/notification.service";
import productService from "../product/product.service";
import SettingsService from "../settings/settings.service";
import smsService from "../../services/sms.service";
import { PromoCode as PromoCodeDTO } from "../settings/settings.dto";
import { uploadFileToR2 } from "../../utils/r2storage";
import { calculateLoyaltyProgress } from "../../utils/loyalty";
import { claimVip, vipDiscount, vipForBooking, vipLabel } from "../promo/vipCodes";
import fs from "fs";
import path from "path";

const BOOKING_PAYMENT_LOG_PREFIX = "BOOKING_PAYMENT_LOG:";

export class BookingService {
  private getDisplayCustomer(booking: {
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    user?: { name: string | null; email: string } | null;
  }): { customerName?: string; customerEmail?: string } {
    const fallbackName = booking.user?.name || booking.user?.email || booking.customerPhone || undefined;
    return {
      customerName: (booking.customerName && booking.customerName.trim() !== "") ? booking.customerName : fallbackName,
      customerEmail: booking.customerEmail || booking.user?.email || undefined,
    };
  }

  private formatDateForSms(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    // (Day, Date, Year) format
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  private formatDayDateForSms(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    // (Day, Date) format
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC"
    });
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

  private isTimeWithinPromoWindow(
    slotStartTime: string,
    promoStart?: string,
    promoEnd?: string,
  ): boolean {
    if (!promoStart || !promoEnd) return true; // no restriction
    const slotMin = this.hhmmToMinutes(slotStartTime);
    const startMin = this.hhmmToMinutes(promoStart);
    const endMin = this.hhmmToMinutes(promoEnd);
    if (
      !Number.isFinite(slotMin) ||
      !Number.isFinite(startMin) ||
      !Number.isFinite(endMin)
    )
      return false;

    // Inclusive both sides (e.g. 17:00 should match promo "17:00" as "between").
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

  private calculatePromoDiscount(
    promo: PromoCodeDTO,
    subtotal: number,
  ): number {
    return promo.type === "percent"
      ? Math.round((subtotal * promo.value) / 100)
      : Math.min(promo.value, subtotal);
  }

  private assertPromoValidForBooking(
    promo: PromoCodeDTO,
    date: string,
    startTime: string,
  ): void {
    if (promo.isActive === false) {
      throw new AppError(400, "Invalid promo code.");
    }

    if (promo.appliedTo !== "booking" && promo.appliedTo !== "both") {
      throw new AppError(400, "This promo code is for membership only.");
    }

    if (this.isPromoExpired(promo)) {
      throw new AppError(400, "This promo code has expired.");
    }

    if (promo.validDays && promo.validDays.length > 0) {
      const weekday = this.getWeekdayFromYMD(date);
      if (!weekday || !promo.validDays.includes(weekday)) {
        throw new AppError(
          400,
          "This promo code is not valid for the selected day.",
        );
      }
    }

    if (promo.startTime && promo.endTime) {
      if (
        !this.isTimeWithinPromoWindow(startTime, promo.startTime, promo.endTime)
      ) {
        throw new AppError(
          400,
          "This promo code is not valid for the selected time slot.",
        );
      }
    }
  }

  // Get membership-blocked time slots for a specific date
  // Returns a Set of start times (e.g., "06:00", "07:00") that are reserved by active memberships
  private async getMembershipBlockedSlots(date: string): Promise<Set<string>> {
    // date is "YYYY-MM-DD"
    // Create UTC midnight and end-of-day for the requested date to ensure day-inclusive comparison
    const checkDateStart = new Date(`${date}T00:00:00.000Z`);
    const checkDateEnd = new Date(`${date}T23:59:59.999Z`);

    // Get the weekday name (e.g., "Monday") to match against membership chosenDays
    const weekday = checkDateStart.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });

    // Get all active/pending memberships with time slots that cover this date range
    const membershipSubs = await prisma.membershipSubscription.findMany({
      where: {
        status: { in: ["active", "pending"] },
        timeSlot: { not: null },
        // The membership period must overlap with the requested date
        startDate: { lte: checkDateEnd },
        endDate: { gte: checkDateStart },
      },
      select: {
        timeSlot: true,
        chosenDays: true,
        excludeDays: true,
        userId: true,
      },
    } as any) as any[];

    const blockedSlots = new Set<string>();

    for (const sub of membershipSubs) {
      if (!sub.timeSlot) continue;

      // Skip blocking if this day is explicitly excluded for this membership
      if (sub.excludeDays && sub.excludeDays.includes(weekday)) {
        continue;
      }

      // Logic for day-specific memberships (e.g., "3 days a week" plans)
      // If chosenDays is provided, the membership only blocks those specific days.
      // If chosenDays is empty, it's assumed to be a full-time daily membership.
      const hasRestrictedDays = sub.chosenDays && sub.chosenDays.length > 0;

      if (hasRestrictedDays) {
        if (!sub.chosenDays.includes(weekday)) {
          // This specific day isn't covered by the membership schedule
          continue;
        }
      }

      // Extract start hour (e.g., "06:00" from "06:00-07:00")
      const startHour = sub.timeSlot.split("-")[0];

      // Check if this specific slot for this user on this day is skipped due to tournament
      const isSkipped = await prisma.booking.findFirst({
        where: {
          userId: sub.userId,
          date: date,
          startTime: startHour,
          status: "skipped_due_to_tournament"
        }
      });

      if (isSkipped) continue;

      blockedSlots.add(startHour);
    }

    return blockedSlots;
  }

  public async updateUserLoyalty(phoneNumber: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        bookings: {
          where: {
            status: "completed",
            loyaltyEnabled: true,
            NOT: [
              { notes: { contains: "MEMBERSHIP_PAYMENT" } },
              { paymentMethod: "membership" },
            ],
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!user) return;

    const completedBookings = user.bookings;
    
    const { loyaltyCount, isEligible } = calculateLoyaltyProgress(
      completedBookings,
      user.freeMatchesAvailable || 0
    );

    await prisma.user.update({
      where: { phoneNumber },
      data: {
        loyaltyProgress: loyaltyCount,
        loyaltyEligible: isEligible,
      },
    });
  }

  public async autoCompletePastBookings(): Promise<void> {
    const now = new Date();
    const today = todayKey(now); // Nepal date, whatever time zone the server runs in
    const currentTime = nowTime(now);

    const whereClause = {
      status: { in: ["pending", "confirmed"] },
      loyaltyEnabled: true,
      OR: [
        { date: { lt: today } },
        {
          AND: [{ date: today }, { endTime: { lte: currentTime } }],
        },
      ],
    };

    // Find users affected to update their loyalty
    const affectedBookings = await prisma.booking.findMany({
      where: {
        ...whereClause,
        userId: { not: null },
      },
      select: { id: true, userId: true },
    });

    // Mark as completed
    await prisma.booking.updateMany({
      where: whereClause,
      data: { status: "completed" },
    });

    // New loyalty points: a completed AND paid regular game earns price/100 points (once per booking).
    await this.awardLoyaltyFor(affectedBookings.map((b) => b.id));

    // Update loyalty stats for affected users
    const uniqueUserIds = [...new Set(affectedBookings.map((b) => b.userId!))];
    for (const uid of uniqueUserIds) {
      await this.updateUserLoyalty(uid);
    }
  }

  // One row per booked hour; the unique (date, hour) index is the final guard against double booking.
  public async reserveSlots(bookingId: string, date: string, startTime: string, duration: number): Promise<void> {
    const startHour = parseInt(startTime.split(":")[0], 10);
    const rows = Array.from({ length: duration }, (_, i) => ({ date, hour: startHour + i, bookingId }));
    await prisma.bookingSlot.createMany({ data: rows });
  }

  public async freeSlots(bookingId: string): Promise<void> {
    await prisma.bookingSlot.deleteMany({ where: { bookingId } });
  }

  // Price of a booking and the effect of a promo code, with no side effects. Used by the quote and promo-check
  // endpoints; the same rules run again when the booking is created, so the browser's numbers are never trusted.
  public async quote(date: string, startTime: string, duration: number, promoCode?: string, userId?: string) {
    const hourlyPricing = await SettingsService.getHourlyPricing();
    const defaultHourlyRate = await SettingsService.getHourlyRate();
    const startHour = parseInt(startTime.split(":")[0], 10);
    let basePrice = 0;
    for (let i = 0; i < duration; i++) {
      const slot = hourlyPricing.find((p) => parseInt(p.id.replace("ts-", ""), 10) === startHour + i);
      basePrice += slot?.price || defaultHourlyRate;
    }
    let discount = 0;
    let promo: { ok: boolean; code?: string; label?: string; message?: string } | null = null;
    if (promoCode && promoCode.trim()) {
      const code = promoCode.trim().toUpperCase();
      const promos = await SettingsService.getPromoCodes();
      const found = promos.find((p) => p.code.trim().toUpperCase() === code);
      if (!found) {
        promo = { ok: false, message: "This promo code is invalid." };
      } else {
        try {
          this.assertPromoValidForBooking(found, date, startTime);
          discount = this.calculatePromoDiscount(found, basePrice);
          promo = { ok: true, code: found.code, label: found.label };
        } catch (e) {
          promo = { ok: false, message: e instanceof AppError ? e.message : "This promo code cannot be used." };
        }
      }
    }

    // VIP code: typed now, or claimed before. The bigger discount wins; the promo feedback names what was applied.
    let vipApplied: { code: string; label: string } | null = null;
    const { vip, entered } = await vipForBooking(userId, promoCode);
    if (vip) {
      const vd = vipDiscount(vip, basePrice);
      if (entered || vd > discount) {
        discount = vd;
        vipApplied = { code: vip.code, label: vipLabel(vip) };
        if (entered || promo?.ok) promo = { ok: true, code: vip.code, label: vipLabel(vip) };
      }
      if (entered) await claimVip(vip);
    }
    return { basePrice, discount, total: Math.max(0, basePrice - discount), promo, vip: vipApplied };
  }

  // Awards new-style loyalty points for bookings that are now both completed and fully paid. Idempotent.
  public async awardLoyaltyFor(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      const rows = await prisma.booking.findMany({
        where: { id: { in: ids }, userId: { not: null }, status: "completed", paymentStatus: "completed" },
      });
      for (const b of rows) {
        await loyaltyService.awardForCompletedBooking(b as any);
      }
    } catch (err) {
      logger.error("Failed to award loyalty points", err);
    }
  }

  public async sendReminders(): Promise<void> {
    const now = new Date();
    const reminderTargetHour = currentHour(now) + 1;
    if (reminderTargetHour >= 24) return;

    const today = todayKey(now); // Nepal date, whatever time zone the server runs in
    const targetTime = `${String(reminderTargetHour).padStart(2, "0")}:00`;

    // Get current weekday for memberships (e.g., "Monday")
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentWeekday = weekdays[now.getDay()];

    logger.info(`Checking for match reminders for ${today} (Day: ${currentWeekday}) @ ${targetTime}`);

    // 1. Regular Bookings
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        date: today,
        startTime: targetTime,
        status: "confirmed",
      },
    });

    // 2. Active Memberships
    const activeMemberships = await prisma.membershipSubscription.findMany({
      where: {
        status: "active",
        endDate: { gte: now },
        chosenDays: { has: currentWeekday },
        timeSlot: { startsWith: targetTime },
      },
      include: { user: true },
    });

    // Notify Bookings
    for (const booking of upcomingBookings) {
      if (booking.customerPhone) {
        const message = `Reminder: Your game starts in 1 hour (@${booking.startTime}). See you at Unique Futsal! ⚽`;
        smsService.send({
          phoneNumber: booking.customerPhone,
          message: message,
        }).catch(err => logger.error(`Failed to send reminder to ${booking.customerPhone}`, err));
      }
    }

    // Notify Memberships
    for (const sub of activeMemberships) {
      if (sub.user?.phoneNumber) {
        const startTime = sub.timeSlot?.split("-")[0] || targetTime;
        const message = `Reminder: Your membership game starts in 1 hour (@${startTime}). See you at Unique Futsal! ⚽`;
        smsService.send({
          phoneNumber: sub.user.phoneNumber,
          message: message,
        }).catch(err => logger.error(`Failed to send membership reminder to ${sub.user.phoneNumber}`, err));
      }
    }
  }

  // Calculate end time based on start time and duration
  // Fixed: userId null handling for guest bookings
  private calculateEndTime(startTime: string, duration: number): string {
    const [hours] = startTime.split(":").map(Number);
    const endHour = hours + duration;
    if (endHour >= 24) return "00:00";
    return `${endHour.toString().padStart(2, "0")}:00`;
  }

  // Check if a time slot is available
  async isSlotAvailable(
    date: string,
    startTime: string,
    duration: number,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const endTime = this.calculateEndTime(startTime, duration);

    // Check if any hour in the requested duration is blocked by membership
    // OR if it's outside operating hours
    const membershipBlocked = await this.getMembershipBlockedSlots(date);
    const allSlots = await SettingsService.getTimeSlots();
    const startHour = parseInt(startTime.split(":")[0]);
    
    for (let i = 0; i < duration; i++) {
      const checkHour = startHour + i;
      const checkTime = `${checkHour.toString().padStart(2, "0")}:00`;
      
      // Ensure the slot exists in operating hours
      if (!allSlots.includes(checkTime)) {
        return false;
      }

      if (membershipBlocked.has(checkTime)) {
        return false; // Slot blocked by membership
      }
    }

    // Get all bookings for the date that are not cancelled
    const existingBookings = await prisma.booking.findMany({
      where: {
        date,
        status: {
          not: "cancelled",
        },
        ...(excludeBookingId && { id: { not: excludeBookingId } }),
      },
    });

    // Check for overlaps with existing bookings
    for (const booking of existingBookings) {
      let existingStart = booking.startTime;
      let existingEnd = booking.endTime;
      let checkEndTime = endTime;

      // Handle midnight wrapping for string comparisons
      if (existingEnd === "00:00") existingEnd = "24:00";
      if (checkEndTime === "00:00") checkEndTime = "24:00";

      // Check if there's any overlap
      if (
        (startTime >= existingStart && startTime < existingEnd) ||
        (checkEndTime > existingStart && checkEndTime <= existingEnd) ||
        (startTime <= existingStart && checkEndTime >= existingEnd)
      ) {
        return false;
      }
    }

    // Check for overlaps with tournaments
    const tournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    for (const tournament of tournaments) {
      if (!tournament.description) {
        // Fallback: if no description/schedule, block the entire day
        return false;
      }

      try {
        const parsed = JSON.parse(tournament.description);
        const agreement = parsed?.agreement || {};
        const dailySchedules = agreement.dailySchedules || [];

        const daySchedule = dailySchedules.find((s: any) => s.date === date);

        if (daySchedule) {
          if (daySchedule.isOff) {
            // No matches today for this tournament, so slots are free (unless blocked by another tournament)
            continue;
          }

          const tStart = daySchedule.startTime;
          let tEnd = daySchedule.endTime;
          if (tEnd === "00:00") tEnd = "24:00";

          let checkEndTime = endTime;
          if (checkEndTime === "00:00") checkEndTime = "24:00";

          // Overlap check
          if (
            (startTime >= tStart && startTime < tEnd) ||
            (checkEndTime > tStart && checkEndTime <= tEnd) ||
            (startTime <= tStart && checkEndTime >= tEnd)
          ) {
            return false;
          }
        } else {
          // If no specific schedule for this day but tournament is active, 
          // we could either block the whole day or assume no matches.
          // The user said "admin has authority to choose time whenever they want",
          // so if they didn't choose a time, maybe it's free?
          // However, existing behavior was blocking the whole day.
          // Let's assume if there's no schedule for this day in a multi-day tournament, it's free.
          continue; 
        }
      } catch (e) {
        // If JSON parse fails, block the day as safety fallback
        return false;
      }
    }

    return true;
  }

  // Create a new booking
  async createBooking(
    dto: CreateBookingDTO,
    userId?: string,
  ): Promise<BookingResponse> {
    // Validate that booking is not for a past time slot
    const now = new Date();
    const today = todayKey(now); // Nepal date, whatever time zone the server runs in
    const currentTime = nowTime(now);

    if (dto.date < today) {
      throw new AppError(400, "Cannot book a slot in the past");
    }

    if (dto.date === today && dto.startTime <= currentTime) {
      throw new AppError(400, "Cannot book a slot that has already passed");
    }

    // Validate slot availability
    const isAvailable = await this.isSlotAvailable(
      dto.date,
      dto.startTime,
      dto.duration,
    );
    if (!isAvailable) {
      throw new AppError(400, "This time slot is not available");
    }

    // Get dynamic pricing from settings
    const hourlyPricing = await SettingsService.getHourlyPricing();
    const addOnsPricingMap = await SettingsService.getAddOnsPricingMap();
    const advanceDeposit = await SettingsService.getAdvanceDeposit();
    const defaultHourlyRate = await SettingsService.getHourlyRate();

    // Enforce "phone number is unique to one person name" for guest/client bookings.
    // For manual (admin) bookings, we allow this as staff might be correcting names or dealing with shared phones.
    if (dto.customerPhone && !dto.isManual) {
      const phone = dto.customerPhone.trim();
      const incomingName = (dto.customerName || "").trim();

      const [userByPhone, bookingWithSamePhone] = await Promise.all([
        prisma.user.findUnique({
          where: { phoneNumber: phone },
          select: { name: true, phoneNumber: true },
        }),
        prisma.booking.findFirst({
          where: {
            customerPhone: phone,
            customerName: { not: null },
          },
          select: { customerName: true, customerPhone: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const normalize = (s: string) => s.trim().toLowerCase();

      if (incomingName) {
        if (
          userByPhone?.name &&
          normalize(userByPhone.name) !== normalize(incomingName)
        ) {
          throw new AppError(
            409,
            `Phone number already registered with another name (${userByPhone.name}).`,
          );
        }

        if (
          bookingWithSamePhone?.customerName &&
          normalize(bookingWithSamePhone.customerName) !==
            normalize(incomingName)
        ) {
          throw new AppError(
            409,
            `Phone number already used with another name (${bookingWithSamePhone.customerName}).`,
          );
        }
      }
    }

    // Calculate base price using hourly pricing schedule
    const startHour = parseInt(dto.startTime.split(":")[0], 10);
    let basePrice = 0;
    for (let i = 0; i < dto.duration; i++) {
      const hour = startHour + i;
      const pricingSlot = hourlyPricing.find(
        (slot) => parseInt(slot.id.replace("ts-", ""), 10) === hour,
      );
      basePrice += pricingSlot?.price || defaultHourlyRate;
    }

    const addOnsPrice = dto.addOnsPrice || 0;
    const subtotal = basePrice + addOnsPrice;
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;

    // Validate and compute promo discount server-side (never trust frontend discountAmount).
    const { vip, entered: vipTyped } = await vipForBooking(userId, dto.promoCode);
    if (dto.promoCode && !vipTyped) {
      const normalizedCode = dto.promoCode.trim().toUpperCase();
      const promoCodes = await SettingsService.getPromoCodes();
      const promo = promoCodes.find(
        (p) => p.code.trim().toUpperCase() === normalizedCode,
      );

      if (!promo) {
        throw new AppError(
          400,
          "Invalid promo code. Please check and try again.",
        );
      }

      this.assertPromoValidForBooking(promo, dto.date, dto.startTime);
      discountAmount = this.calculatePromoDiscount(promo, subtotal);
      appliedPromoCode = promo.code;
    }

    // The VIP code staff gave this customer applies to every booking once claimed; the bigger discount wins.
    if (vip) {
      const vd = vipDiscount(vip, subtotal);
      if (vipTyped || vd > discountAmount) {
        discountAmount = vd;
        appliedPromoCode = vip.code;
      }
      if (appliedPromoCode === vip.code) await claimVip(vip);
    }

    let totalPrice = subtotal - discountAmount;

    // Apply manual price override if provided (admin only typically)
    if (dto.overridePrice !== undefined && dto.overridePrice !== null) {
      totalPrice = dto.overridePrice;
    }

    // For venue payment, nothing is paid now - all payment at venue
    // Booking starts as pending until admin confirms
    let amountPaidNow = 0;
    let paymentStatus = "pending";

    // Payment is only recorded as received by staff (or, later, by the verified gateway callback).
    // A customer choosing "full"/"advance" just says how they intend to pay; it stays pending until verified.
    if (dto.paymentMethod === "full" && dto.isManual) {
      amountPaidNow = totalPrice;
      paymentStatus = "completed";
    } else if (dto.paymentMethod === "advance" && dto.isManual) {
      amountPaidNow = Math.min(advanceDeposit, totalPrice);
      paymentStatus =
        amountPaidNow >= totalPrice ? "completed" : "partially_paid";
    }
    // For "venue" payment method, amountPaidNow = 0, paymentStatus = "pending"

    let remainingAmount = totalPrice - amountPaidNow;
    const endTime = this.calculateEndTime(dto.startTime, dto.duration);

    // Verify user exists if userId is provided
    let verifiedUserId: string | null = null;
    let userInfo: {
      name: string | null;
      email: string | null;
      phoneNumber: string;
      freeMatchesAvailable: number;
    } | null = null;

    if (userId || (dto.isManual && dto.customerPhone)) {
      const phoneToLookup = userId || dto.customerPhone;
      if (phoneToLookup) {
        const user = await prisma.user.findUnique({
          where: { phoneNumber: phoneToLookup },
        });
        if (user) {
          verifiedUserId = user.phoneNumber;
          userInfo = {
            name: user.name,
            email: user.email || null,
            phoneNumber: user.phoneNumber,
            freeMatchesAvailable: user.freeMatchesAvailable,
          };
        }
      }
    }

    let finalNotes = dto.notes;

    if (dto.useFreeMatch) {
      if (!userInfo) {
        throw new AppError(400, "User not found to redeem free match");
      }
      if (userInfo.freeMatchesAvailable <= 0) {
        throw new AppError(400, "You do not have any free matches available");
      }
      if (dto.duration !== 1) {
        throw new AppError(400, "Free match can only be applied to a 1-hour slot");
      }

      // Decrement the free match (only if one is still available: two requests cannot both spend it)
      const spent = await prisma.user.updateMany({
        where: { phoneNumber: userInfo.phoneNumber, freeMatchesAvailable: { gt: 0 } },
        data: { freeMatchesAvailable: { decrement: 1 } },
      });
      if (spent.count !== 1) {
        throw new AppError(400, "You do not have any free matches available");
      }

      // Apply free match pricing
      totalPrice = 0;
      amountPaidNow = 0;
      remainingAmount = 0;
      paymentStatus = "completed";
      
      finalNotes = finalNotes ? `${finalNotes} | FREE_MATCH` : "FREE_MATCH";
    }

    const useGuestWorkaround = false;
    const bookingStatus = dto.paymentMethod === "venue" ? "pending" : "confirmed";

    // Create booking
    const bookingCode = await uniqueBookingCode();
    const booking = await prisma.booking.create({
      data: {
        code: bookingCode,
        ...(verifiedUserId && !useGuestWorkaround
          ? { user: { connect: { phoneNumber: verifiedUserId } } }
          : {}),
        date: dto.date,
        startTime: dto.startTime,
        endTime,
        duration: dto.duration,
        customerName: dto.customerName || userInfo?.name || null,
        customerEmail: dto.customerEmail || userInfo?.email || null,
        customerPhone: dto.customerPhone || userInfo?.phoneNumber || null,
        basePrice,
        addOns: dto.addOns || null,
        addOnsPrice,
        promoCode: appliedPromoCode,
        discountAmount,
        subtotal,
        totalPrice,
        paymentMethod: dto.paymentMethod,
        loyaltyEnabled: dto.loyaltyEnabled ?? true,
        amountPaidNow,
        remainingAmount,
        paymentStatus,
        status: bookingStatus,
        notes: finalNotes,
        waterBottles: 2,
      } as any,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Final guard: if two requests passed the availability check together, only one can take the hour.
    try {
      await this.reserveSlots(booking.id, dto.date, dto.startTime, dto.duration);
    } catch (err) {
      await prisma.booking.delete({ where: { id: booking.id } });
      if (dto.useFreeMatch && userInfo) {
        await prisma.user.update({ where: { phoneNumber: userInfo.phoneNumber }, data: { freeMatchesAvailable: { increment: 1 } } });
      }
      throw new AppError(409, "This time slot was just taken. Please choose another time.");
    }

    logger.info(
      `New booking created: ${booking.id} for ${dto.date} at ${dto.startTime}`,
    );

    // Send SMS Notification to Admin (Only if not a manual admin booking)
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    if (adminPhone && !dto.isManual) {
      const adminMessage = `New Booking! ${booking.customerName || "Guest"} (${booking.customerPhone || "No Phone"}) booked for ${booking.date} @ ${booking.startTime} for ${booking.duration}hr. Total: Rs.${booking.totalPrice}.`;
      smsService.send({
        phoneNumber: adminPhone,
        message: adminMessage,
      }).catch(err => logger.error("Failed to send admin booking notification", err));
    }

    return this.toBookingResponse(booking);
  }

  // Get all bookings (with optional filters)
  private toBookingResponse(booking: any) {
    const displayCustomer = this.getDisplayCustomer(booking);

    return {
      id: booking.id,
      code: booking.code || fallbackBookingCode(booking.id),
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      duration: booking.duration,
      customerName: displayCustomer.customerName,
      customerEmail: displayCustomer.customerEmail,
      customerPhone: booking.customerPhone || undefined,
      basePrice: booking.basePrice,
      addOns: booking.addOns || undefined,
      addOnsPrice: booking.addOnsPrice,
      promoCode: booking.promoCode || undefined,
      discountAmount: booking.discountAmount,
      subtotal: booking.subtotal,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      amountPaidNow: booking.amountPaidNow,
      cashAmount: booking.cashAmount || 0,
      onlineAmount: booking.onlineAmount || 0,
      remainingAmount: booking.remainingAmount,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      notes: booking.notes || undefined,
      waterBottles: booking.waterBottles,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      loyaltyEnabled: booking.loyaltyEnabled ?? true,
    };
  }

  async getBookings(filters?: {
    date?: string;
    status?: string;
    userId?: string;
    page?: number;
    limit?: number;
    search?: string;
    paymentStatus?: string;
    customerView?: boolean; // the customer app: hide the membership payment ledger rows
  }) {
    await this.autoCompletePastBookings();

    const dateFilter = filters?.date;
    let dateCondition = {};
    if (dateFilter) {
      if (dateFilter.includes(",")) {
        dateCondition = { date: { in: dateFilter.split(",").map(d => d.trim()) } };
      } else {
        dateCondition = { date: dateFilter.trim() };
      }
    }

    const where: any = {
      status: { not: "cancelled" },
      ...dateCondition,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.paymentStatus === "paid" && { paymentStatus: "completed" }),
      ...(filters?.paymentStatus === "due" && { paymentStatus: { not: "completed" } }),
      // (a plain NOT would also hide rows whose notes are empty, because NULL never matches)
      ...(filters?.customerView && { AND: [{ OR: [{ notes: null }, { NOT: { notes: { contains: "MEMBERSHIP_" } } }] }] }),
    };

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { phoneNumber: { contains: q, mode: "insensitive" } } },
      ];
    }

    const include = {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    };

    const orderBy = {
      createdAt: "desc" as const,
    };

    const shouldPaginate =
      Number.isFinite(filters?.page) || Number.isFinite(filters?.limit);

    if (!shouldPaginate) {
      const bookings = await prisma.booking.findMany({
        where,
        include,
        orderBy,
      });

      return bookings.map((b) => this.toBookingResponse(b));
    }

    const safeLimit = Math.max(1, Math.min(200, filters?.limit ?? 10));
    const safePage = Math.max(1, filters?.page ?? 1);
    const skip = (safePage - 1) * safeLimit;

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include,
        orderBy,
        skip,
        take: safeLimit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items: bookings.map((b) => this.toBookingResponse(b)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  // Get a single booking by ID
  async getBookingById(id: string): Promise<BookingResponse> {
    await this.autoCompletePastBookings();

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      throw new AppError(404, "Booking not found");
    }

    return this.toBookingResponse(booking);
  }

  // Update a booking
  async updateBooking(
    id: string,
    dto: UpdateBookingDTO,
  ): Promise<BookingResponse> {
    logger.info(`>>> UPDATE REQUEST RECEIVED for ${id} | PaymentStatus: ${dto.paymentStatus} | Water: ${dto.waterBottles}`);
    
    // When marking payment as completed, we need to get the current booking first
    // to update the payment amounts correctly
    const existingBooking = await prisma.booking.findUnique({
      where: { id },
      select: {
        status: true,
        totalPrice: true,
        amountPaidNow: true,
        cashAmount: true,
        onlineAmount: true,
        remainingAmount: true,
        paymentStatus: true,
        waterBottles: true,
        notes: true,
        customerPhone: true,
        date: true,
        startTime: true,
        userId: true,
        basePrice: true,
        discountAmount: true,
        addOnsPrice: true,
      },
    });

    if (!existingBooking) {
      throw new AppError(404, "Booking not found");
    }

    // Once a booking is cancelled, no one should be able to confirm/re-activate it.
    // This guarantees "player cancel wins" even if admin tries to accept later.
    if (dto.status === "cancelled") {
      // Keep the booking as a cancelled record (history, audits); customer records are never deleted by a cancel.
      await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          notes: existingBooking.notes ? `${existingBooking.notes} | CANCELLED_BY_STAFF` : "CANCELLED_BY_STAFF",
        },
      });
      await this.freeSlots(id);
      await loyaltyService.releaseVoucherForBooking(id);
      
      const shouldSendCancelSms = dto.sendSms !== false; // Respect admin SMS choice
      if (existingBooking.customerPhone && shouldSendCancelSms) {
        const formattedDate = this.formatDayDateForSms(existingBooking.date);
        const name = (existingBooking as any).customerName || "Customer";
        const message = `Dear ${name}, Your booking scheduled for ${existingBooking.startTime} on ${formattedDate} has been cancelled successfully. If this was unintentional, please contact us or rebook your slot anytime. Thank you for choosing Unique Futsal.`;
        smsService.send({
          phoneNumber: existingBooking.customerPhone,
          message: message,
        }).catch(err => logger.error("Failed to send admin cancellation SMS", err));
      }

      return { id, status: "cancelled" } as any;
    }

    if (existingBooking.status === "cancelled") {
      throw new AppError(400, "Cancelled bookings cannot be updated.");
    }

    // Calculate new total price based on possible updates to water bottles and add-ons
    const finalBasePrice = existingBooking.basePrice;
    const finalDiscountAmount = existingBooking.discountAmount;
    const finalAddOnsPrice = dto.addOnsPrice !== undefined ? dto.addOnsPrice : (existingBooking.addOnsPrice || 0);
    const finalWaterBottles = dto.waterBottles !== undefined ? dto.waterBottles : (existingBooking.waterBottles || 0);
    const waterCost = Math.max(0, finalWaterBottles - 2) * 25;

    // Check if there was an override in the existing booking
    const standardCalculatedPrice = existingBooking.basePrice + (existingBooking.addOnsPrice || 0) + Math.max(0, (existingBooking.waterBottles || 0) - 2) * 25 - existingBooking.discountAmount;
    const hasOverride = existingBooking.totalPrice !== standardCalculatedPrice;

    let newTotalPrice = finalBasePrice + finalAddOnsPrice + waterCost - finalDiscountAmount;
    if (dto.totalPrice !== undefined && dto.totalPrice !== null) {
      newTotalPrice = dto.totalPrice;
    } else if (hasOverride) {
      // If we have an override, compute changes relative to that override price instead of standard pricing
      const waterDelta = waterCost - Math.max(0, (existingBooking.waterBottles || 0) - 2) * 25;
      const addOnsDelta = finalAddOnsPrice - (existingBooking.addOnsPrice || 0);
      newTotalPrice = existingBooking.totalPrice + waterDelta + addOnsDelta;
    }

    const cashDelta = dto.cashAmount !== undefined
      ? Math.max(0, dto.cashAmount - (existingBooking.cashAmount || 0))
      : 0;
    const onlineDelta = dto.onlineAmount !== undefined
      ? Math.max(0, dto.onlineAmount - (existingBooking.onlineAmount || 0))
      : 0;
    const paymentInstallment = cashDelta + onlineDelta;

    const newCashAmount = dto.cashAmount !== undefined ? dto.cashAmount : (existingBooking.cashAmount || 0);
    const newOnlineAmount = dto.onlineAmount !== undefined ? dto.onlineAmount : (existingBooking.onlineAmount || 0);

    const newAmountPaidNow = dto.paymentStatus === "completed"
      ? newTotalPrice
      : (newCashAmount + newOnlineAmount);

    const newRemainingAmount = dto.paymentStatus === "completed"
      ? 0
      : Math.max(0, newTotalPrice - newAmountPaidNow);

    // Auto-confirm booking when payment is marked as completed
    const autoConfirmStatus =
      dto.paymentStatus === "completed" ? "confirmed" : undefined;

    const baseNotes = dto.notes !== undefined ? dto.notes : (existingBooking.notes || "");
    const isMembership = baseNotes.includes("MEMBERSHIP_PAYMENT") || baseNotes.includes("MEMBERSHIP_SUB");
    const activeLogPrefix = isMembership ? "MEMBERSHIP_PAYMENT_LOG:" : BOOKING_PAYMENT_LOG_PREFIX;
    
    // We adjust current booking's log line to only show the portion of the payment that belongs to it.
    // If there is excess, the excess is logged under the other bookings.
    const currentBookingNeeds = Math.max(0, newTotalPrice - existingBooking.amountPaidNow);
    const currentBookingPaidThisTime = Math.min(paymentInstallment, currentBookingNeeds);
    
    const existingCash = existingBooking.cashAmount || 0;
    const existingOnline = existingBooking.onlineAmount || 0;
    const existingTotalPaid = existingCash + existingOnline;
    const defaultCashRatio = existingTotalPaid > 0 ? (existingCash / existingTotalPaid) : 1;
    const cashRatio = paymentInstallment > 0 ? (cashDelta / paymentInstallment) : defaultCashRatio;
    
    const currentBookingCashPaid = currentBookingPaidThisTime * cashRatio;
    const currentBookingOnlinePaid = currentBookingPaidThisTime * (1 - cashRatio);

    const paymentLogLine = currentBookingPaidThisTime > 0
      ? `${activeLogPrefix} ${JSON.stringify({
          at: new Date().toISOString(),
          cashAmount: currentBookingCashPaid,
          onlineAmount: currentBookingOnlinePaid,
          totalAmount: currentBookingPaidThisTime,
        })}`
      : null;

    const resolvedNotes = paymentLogLine
      ? `${(baseNotes || "").trim()}${(baseNotes || "").trim() ? "\n" : ""}${paymentLogLine}`
      : baseNotes;

    // Run database updates inside a Prisma transaction to ensure atomicity
    const { booking } = await prisma.$transaction(async (tx) => {
      // 1. Update current booking
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          ...(dto.status
            ? { status: dto.status }
            : autoConfirmStatus
              ? { status: autoConfirmStatus }
              : {}),
          ...(dto.paymentStatus && { paymentStatus: dto.paymentStatus }),
          notes: resolvedNotes,
          cashAmount: dto.paymentStatus === "completed" ? newTotalPrice * cashRatio : newCashAmount,
          onlineAmount: dto.paymentStatus === "completed" ? newTotalPrice * (1 - cashRatio) : newOnlineAmount,
          ...(dto.waterBottles !== undefined && { waterBottles: dto.waterBottles }),
          ...(dto.addOns !== undefined && { addOns: dto.addOns }),
          ...(dto.loyaltyEnabled !== undefined && { loyaltyEnabled: dto.loyaltyEnabled }),
          addOnsPrice: finalAddOnsPrice,
          totalPrice: newTotalPrice,
          amountPaidNow: newAmountPaidNow,
          remainingAmount: newRemainingAmount,
        } as any,
      });

      // 2. Distribute excess payment to older bookings if applicable
      let excess = paymentInstallment - currentBookingNeeds;

      if (excess > 0 && dto.settlePreviousDues) {
        const phone = existingBooking.customerPhone;
        const userId = existingBooking.userId;

        if (phone || userId) {
          const otherBookings = await tx.booking.findMany({
            where: {
              id: { not: id },
              OR: [
                ...(phone ? [{ customerPhone: phone }] : []),
                ...(userId ? [{ userId: userId }] : [])
              ],
              paymentStatus: { not: "completed" },
              status: { not: "cancelled" }
            },
            orderBy: { date: "asc" } // Oldest first
          });

          for (const other of otherBookings) {
            const needed = Math.max(0, other.totalPrice - other.amountPaidNow);
            if (needed <= 0) continue;

            const toPay = Math.min(excess, needed);
            excess -= toPay;

            const otherCashPaid = toPay * cashRatio;
            const otherOnlinePaid = toPay * (1 - cashRatio);

            const newOtherCash = (other.cashAmount || 0) + otherCashPaid;
            const newOtherOnline = (other.onlineAmount || 0) + otherOnlinePaid;
            const newOtherPaid = other.amountPaidNow + toPay;
            const newOtherRemaining = Math.max(0, other.totalPrice - newOtherPaid);
            const isFullyPaid = newOtherRemaining <= 0;

            const otherLogPrefix = (other.notes || "").includes("MEMBERSHIP_PAYMENT") || (other.notes || "").includes("MEMBERSHIP_SUB")
              ? "MEMBERSHIP_PAYMENT_LOG:"
              : BOOKING_PAYMENT_LOG_PREFIX;

            const otherPaymentLogLine = `${otherLogPrefix} ${JSON.stringify({
              at: new Date().toISOString(),
              cashAmount: otherCashPaid,
              onlineAmount: otherOnlinePaid,
              totalAmount: toPay,
              notes: `Paid via excess from Booking #${id}`
            })}`;

            const resolvedOtherNotes = `${(other.notes || "").trim()}${(other.notes || "").trim() ? "\n" : ""}${otherPaymentLogLine}`;

            await tx.booking.update({
              where: { id: other.id },
              data: {
                cashAmount: newOtherCash,
                onlineAmount: newOtherOnline,
                amountPaidNow: newOtherPaid,
                remainingAmount: newOtherRemaining,
                paymentStatus: isFullyPaid ? "completed" : "partially_paid",
                status: isFullyPaid ? "completed" : other.status as any,
                notes: resolvedOtherNotes
              }
            });

            if (excess <= 0) break;
          }
        }
      }

      return { booking: updatedBooking };
    });

    // Handle Inventory Deduction for Water Bottles when payment is completed
    const currentWater = dto.waterBottles !== undefined ? dto.waterBottles : ((booking as any).waterBottles || 0);
    logger.info(`[DEBUG] updateBooking called. dto.paymentStatus: ${dto.paymentStatus}, currentWater: ${currentWater}`);
    
    if (dto.paymentStatus === "completed" && currentWater > 0) {
      logger.info(`[INVENTORY] Starting deduction for booking ${booking.id}. Bottles: ${currentWater}`);
      try {
        const products = await productService.getAllProducts();
        logger.info(`[INVENTORY] Found ${products.length} products in inventory.`);
        
        // Find water product - be very flexible with the name
        const waterProduct = products.find(p => {
          const name = p.name.toLowerCase();
          return name === "water" || name.includes("mineral water") || name.includes("water bottle");
        });
        
        if (waterProduct) {
          // Idempotency: deduct only the delta vs what was already logged for
          // this booking. Re-saving a completed booking must not deduct again.
          const priorLogs: any[] = await (prisma as any).inventoryLog.findMany({
            where: { productId: waterProduct.id, reason: { contains: `Booking Sale #${booking.id}` } },
            select: { change: true },
          });
          const alreadyDeducted = priorLogs.reduce((s, l) => s + Math.abs(l.change), 0);
          const delta = currentWater - alreadyDeducted;
          if (delta > 0) {
            logger.info(`[INVENTORY] Target found: "${waterProduct.name}" (ID: ${waterProduct.id}). Current Stock: ${waterProduct.inventory}. Deducting delta ${delta} (total ${currentWater}, already ${alreadyDeducted})`);
            await productService.adjustStock(waterProduct.id, -delta, `Booking Sale #${booking.id}`);
            logger.info(`[INVENTORY] Successfully updated stock for ${waterProduct.name}`);
          } else {
            logger.info(`[INVENTORY] Skipping deduction for booking ${booking.id}: already deducted ${alreadyDeducted} of ${currentWater}`);
          }
        } else {
          const productNames = products.map(p => `"${p.name}"`).join(", ");
          logger.warn(`[INVENTORY] Could not find a water product. Available names: ${productNames}`);
        }
      } catch (err) {
        logger.error(`[INVENTORY] Error adjusting stock for booking ${booking.id}:`, err);
      }
    }

    // After handling inventory, trigger loyalty update if enabled and payment completed
    if (booking.paymentStatus === "completed" && (booking as any).loyaltyEnabled && booking.userId) {
      try {
        await this.updateUserLoyalty(booking.userId);
        logger.info(`[LOYALTY] Updated loyalty for user ${booking.userId} after booking ${booking.id}`);
      } catch (err) {
        logger.error(`[LOYALTY] Failed to update loyalty for user ${booking.userId}:`, err);
      }
    }

    logger.info(
      `Booking updated: ${booking.id}${autoConfirmStatus ? " (auto-confirmed on payment)" : ""}`,
    );

    // Notify player if booking is newly confirmed
    const wasConfirmed = existingBooking.status === "confirmed";
    const isNowConfirmed = (booking as any).status === "confirmed";
    const shouldSendSms = dto.sendSms !== false; // Default to true for backward compatibility, but we will pass false from admin if they choose No
    if (!wasConfirmed && isNowConfirmed && existingBooking.customerPhone && shouldSendSms) {
      const formattedDate = this.formatDateForSms(existingBooking.date);
      const name = (booking as any).customerName || "Customer";
      const message = `Dear ${name}, Your booking has been confirmed for ${existingBooking.startTime} on ${formattedDate}. Please arrive 10 minutes before your scheduled game time. Play safe and have fun! - Unique Futsal`;
      smsService.send({
        phoneNumber: existingBooking.customerPhone,
        message: message,
      }).catch(err => logger.error("Failed to send player confirmation SMS", err));
    }

    await this.awardLoyaltyFor([booking.id]);

    // Update user loyalty progress if applicable
    const loyaltyTargetPhone = booking.userId || existingBooking.userId;
    if (loyaltyTargetPhone) {
      await this.updateUserLoyalty(loyaltyTargetPhone).catch(err => 
        logger.error(`Failed to update loyalty for user ${loyaltyTargetPhone}`, err)
      );
    }

    return this.toBookingResponse(booking);
  }

  // Delete a booking entirely (Admins)
  async deleteBooking(id: string, sendSms: boolean = true): Promise<void> {
    const existing = await prisma.booking.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, "Booking not found");
    }

    await prisma.booking.delete({
      where: { id },
    });
    await this.freeSlots(id);

    if (existing.userId) {
      await this.updateUserLoyalty(existing.userId).catch(err => 
        logger.error(`Failed to update loyalty after deletion for user ${existing.userId}`, err)
      );
    }

    if (existing.customerPhone && sendSms) {
      const formattedDate = this.formatDayDateForSms(existing.date);
      const name = (existing as any).customerName || "Customer";
      const message = `Dear ${name}, Your booking scheduled for ${existing.startTime} on ${formattedDate} has been cancelled successfully. If this was unintentional, please contact us or rebook your slot anytime. Thank you for choosing Unique Futsal.`;
      smsService.send({
        phoneNumber: existing.customerPhone,
        message: message,
      }).catch(err => logger.error("Failed to send deletion SMS", err));
    }
  }

  // Cancel a booking
  async cancelBooking(id: string, userId: string): Promise<BookingResponse & { refundDue: number }> {
    const now = new Date();
    const today = todayKey(now); // Nepal date, whatever time zone the server runs in
    const currentTime = nowTime(now);

    const existing = await prisma.booking.findUnique({
      where: { id },
      select: { status: true, date: true, startTime: true, userId: true, customerPhone: true, customerName: true, notes: true },
    });

    if (!existing) {
      throw new AppError(404, "Booking not found");
    }

    // Only the owner can cancel.
    if (!existing.userId || existing.userId !== userId) {
      throw new AppError(403, "You cannot cancel this booking");
    }

    // Only upcoming-ish bookings can be cancelled.
    if (existing.status === "completed" || existing.status === "cancelled") {
      throw new AppError(400, "This booking cannot be cancelled");
    }

    // Prevent cancelling past bookings (optional safety).
    if (existing.date < today) {
      throw new AppError(400, "Cannot cancel past bookings");
    }
    if (existing.date === today && existing.startTime <= currentTime) {
      throw new AppError(
        400,
        "Cannot cancel bookings that have already started",
      );
    }

    // Keep the booking as a cancelled record (history, audits, refunds); never delete customer records.
    const cancelled = await prisma.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        notes: existing.notes ? `${existing.notes} | CANCELLED_BY_CUSTOMER` : "CANCELLED_BY_CUSTOMER",
      },
    });
    await this.freeSlots(id);
    await loyaltyService.releaseVoucherForBooking(id);
    const refund = await paymentService.refundOnCancel(id);
    await notificationService.notify({
      userId, type: "booking", title: "Booking cancelled",
      message: refund > 0 ? `${existing.date} · ${existing.startTime} cancelled for free. Rs. ${refund} will be returned to you by the venue.` : `${existing.date} · ${existing.startTime} cancelled for free.`,
      href: "/profile", dedupeKey: `cancel-${id}`,
    });
    // A cancelled free match gives the free match back.
    if (existing.notes?.includes("FREE_MATCH") && existing.userId) {
      await prisma.user.update({
        where: { phoneNumber: existing.userId },
        data: { freeMatchesAvailable: { increment: 1 } },
      });
    }

    // Notify Admin
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    if (adminPhone) {
      const adminMessage = `Match Cancelled! ${existing.customerName || "A player"} (${existing.customerPhone || "No Phone"}) cancelled their booking for ${existing.date} @ ${existing.startTime}.`;
      smsService.send({
        phoneNumber: adminPhone,
        message: adminMessage,
      }).catch(err => logger.error("Failed to send admin cancellation alert", err));
    }

    // Notify Player
    if (existing.customerPhone) {
      const formattedDate = this.formatDayDateForSms(existing.date);
      const name = existing.customerName || "Customer";
      const message = `Dear ${name}, Your booking scheduled for ${existing.startTime} on ${formattedDate} has been cancelled successfully. If this was unintentional, please contact us or rebook your slot anytime. Thank you for choosing Unique Futsal.`;
      smsService.send({
        phoneNumber: existing.customerPhone,
        message: message,
      }).catch(err => logger.error("Failed to send player cancellation confirmation", err));
    }

    return { ...this.toBookingResponse(cancelled), refundDue: refund };
  }

  // Get available time slots for a date (optimized - single DB query)
  async getAvailableSlots(date: string, duration: number = 1) {
    // Get dynamic time slots from settings
    const allSlots = await SettingsService.getTimeSlots();

    // Fetch all bookings for the date in ONE query (instead of N queries)
    const existingBookings = await prisma.booking.findMany({
      where: {
        date,
        status: { not: "cancelled" },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Get membership-blocked slots for this date
    const membershipBlocked = await this.getMembershipBlockedSlots(date);

    // Get tournament-blocked slots for this date
    const tournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    // Check if the requested date is today (for filtering past slots)
    const now = new Date();
    const today = todayKey(now); // Nepal date, whatever time zone the server runs in
    const isToday = date === today;
    const currentTime = nowTime(now);

    // Check each slot against the cached bookings (in-memory)
    const availableSlots = allSlots.filter((slot) => {
      // If today, filter out slots that have already passed
      if (isToday && slot <= currentTime) {
        return false;
      }

      // Check if slot is blocked by membership
      // For multi-hour duration, check if ANY hour in the range is blocked
      // AND check if the hour even exists in our operating hours (allSlots)
      const startHour = parseInt(slot.split(":")[0]);
      for (let i = 0; i < duration; i++) {
        const checkHour = startHour + i;
        const checkTime = `${checkHour.toString().padStart(2, "0")}:00`;
        
        // Ensure the slot exists in operating hours
        if (!allSlots.includes(checkTime)) {
          return false;
        }

        if (membershipBlocked.has(checkTime)) {
          return false; // Slot blocked by membership
        }
      }

      const endTime = this.calculateEndTime(slot, duration);
      let checkEndTime = endTime === "00:00" ? "24:00" : endTime;

      // Check for overlap with tournaments
      for (const t of tournaments) {
        if (!t.description) return false;
        try {
          const parsed = JSON.parse(t.description);
          const dailySchedules = parsed.agreement?.dailySchedules || [];
          const daySchedule = dailySchedules.find((s: any) => s.date === date);

          if (daySchedule) {
            if (daySchedule.isOff) continue;
            const tStart = daySchedule.startTime;
            let tEnd = daySchedule.endTime;
            if (tEnd === "00:00") tEnd = "24:00";

            if (
              (slot >= tStart && slot < tEnd) ||
              (checkEndTime > tStart && checkEndTime <= tEnd) ||
              (slot <= tStart && checkEndTime >= tEnd)
            ) {
              return false;
            }
          }
        } catch (e) {
          return false;
        }
      }

      for (const booking of existingBookings) {
        let existingStart = booking.startTime;
        let existingEnd =
          booking.endTime === "00:00" ? "24:00" : booking.endTime;

        // Check for overlap
        if (
          (slot >= existingStart && slot < existingEnd) ||
          (checkEndTime > existingStart && checkEndTime <= existingEnd) ||
          (slot <= existingStart && checkEndTime >= existingEnd)
        ) {
          return false;
        }
      }
      return true;
    });

    return availableSlots;
  }

  // Get full occupancy (bookings + memberships) for a date - used by Admin View
  async getOccupancy(date: string) {
    // 1. Get all regular bookings
    const bookings = await this.getBookings({ date });

    // 2. Get membership-reserved slots for this date
    const checkDateStart = new Date(`${date}T00:00:00.000Z`);
    const checkDateEnd = new Date(`${date}T23:59:59.999Z`);

    const weekday = checkDateStart.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });

    const memberships = await prisma.membershipSubscription.findMany({
      where: {
        status: { in: ["active", "pending"] },
        timeSlot: { not: null },
        startDate: { lte: checkDateEnd },
        endDate: { gte: checkDateStart },
      },
      include: {
        user: {
          select: {
            name: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    // 3. Convert memberships to a common "reservation" format
    const membershipReservations = memberships
      .filter((sub) => {
        // Skip reservation if this day is explicitly excluded for this membership
        if ((sub as any).excludeDays && (sub as any).excludeDays.includes(weekday)) {
          return false;
        }

        // Apply chosenDays filtering
        const hasRestrictedDays = sub.chosenDays && sub.chosenDays.length > 0;
        if (hasRestrictedDays) {
          return sub.chosenDays.includes(weekday);
        }
        return true;
      })
      .map((sub) => {
        const [startTime, endTime] = sub.timeSlot!.split("-");
        return {
          id: `mem-${sub.id}`,
          date,
          startTime,
          endTime,
          duration: 1, // Usually 1h
          customerName: `${sub.user.name || sub.user.phoneNumber} (Member)`,
          customerPhone: sub.user.phoneNumber,
          status: sub.status === "active" ? "confirmed" : "pending",
          paymentStatus: sub.paymentStatus,
          type: "membership",
          loyaltyEnabled: (sub as any).loyaltyEnabled !== undefined ? (sub as any).loyaltyEnabled : true,
        };
      });

    // 4. Get tournaments for this date
    const tournaments = await prisma.tournament.findMany({
      where: {
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    const tournamentReservations = tournaments
      .map(t => {
        try {
          const parsed = JSON.parse(t.description || "{}");
          const dailySchedules = parsed.agreement?.dailySchedules || [];
          const daySchedule = dailySchedules.find((s: any) => s.date === date);
          
          if (!daySchedule || daySchedule.isOff) return null;

          const startTime = daySchedule.startTime;
          const endTime = daySchedule.endTime;

          // Calculate duration in hours
          const startH = parseInt(startTime.split(':')[0]);
          const startM = parseInt(startTime.split(':')[1]) || 0;
          const endH = parseInt(endTime.split(':')[0]) || 24; // Handle 00:00 as 24:00
          const endM = parseInt(endTime.split(':')[1]) || 0;
          
          const duration = (endH + endM/60) - (startH + startM/60);

          return {
            id: `tourney-${t.id}`,
            date,
            startTime,
            endTime,
            duration: Math.max(1, duration), 
            customerName: `${t.name} (Tournament)`,
            customerPhone: "Tournament",
            status: "confirmed",
            paymentStatus: "completed",
            type: "tournament",
          };
        } catch (e) {
          return null;
        }
      })
      .filter(t => t !== null);

    return {
      bookings,
      memberships: membershipReservations,
      tournaments: tournamentReservations,
    };
  }

  async uploadInvoice(id: string, pdfBase64: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new AppError(404, "Booking not found");
    }

    // Extract the base64 data (strip data URL prefix if present)
    const base64Data = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;
    
    const buffer = Buffer.from(base64Data, "base64");
    const relativePath = `invoices/BK-${id.slice(-6).toUpperCase()}_${Date.now()}.pdf`;

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
    await fs.promises.writeFile(absolutePath, buffer);
    
    // Determine base URL (default to localhost if not specified)
    const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
    const invoiceUrl = `${baseUrl}/uploads/${relativePath}`;

    return { invoiceUrl };
  }
}

export const bookingService = new BookingService();
export default bookingService;
