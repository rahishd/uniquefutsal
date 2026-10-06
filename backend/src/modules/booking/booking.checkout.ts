import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import BookingService from "./booking.service";
import paymentService, { QR_HOLD_MS } from "../payment/payment.service";
import loyaltyService from "../loyalty/loyalty.service";
import notificationService from "../notification/notification.service";
import { addDaysKey, todayKey } from "../../utils/dates";
import { pointsForGame, periodOfHour } from "../../utils/loyaltyPoints";

// Customer app rules, enforced here (the app shows them, but the browser can never be trusted):
export const MAX_ADVANCE_DAYS = 10; // bookings open today .. today + 10
const PHONE = /^9\d{9}$/;

type Method = "esewa" | "fonepay" | "venue";

function assertWindow(date: string) {
  const today = todayKey();
  if (date < today) throw new AppError(400, "Cannot book a slot in the past");
  if (date > addDaysKey(today, MAX_ADVANCE_DAYS)) throw new AppError(400, `Bookings open only ${MAX_ADVANCE_DAYS} days in advance.`);
}

export const checkoutController = {
  // Price + promo preview (no side effects)
  quote: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date, startTime, duration = 1, promoCode, voucherId } = req.body;
    assertWindow(date);
    const q = await BookingService.quote(date, startTime, duration, promoCode, req.user?.role === "user" ? req.user.id : undefined);

    let usesVoucher = false;
    if (voucherId) {
      if (!req.user) throw new AppError(401, "Sign in to use a free game voucher");
      const v = await prisma.freeGameVoucher.findFirst({ where: { id: voucherId, userId: req.user.id, status: "unused" } });
      usesVoucher = Boolean(v && v.period === periodOfHour(parseInt(startTime.split(":")[0], 10)) && duration === 1);
    }
    const total = usesVoucher ? 0 : q.total;
    res.json(
      ApiResponseUtil.success(200, "Quote", {
        basePrice: q.basePrice,
        discount: usesVoucher ? q.basePrice : q.discount,
        total,
        promo: q.promo,
        usesVoucher,
        // points a registered customer will earn after the game (free games earn none)
        earnPoints: req.user && !usesVoucher ? pointsForGame(total) : 0,
      }),
    );
  }),

  // Create a booking the way the customer app does: guest rules, 10-day window, held slot, QR for online payments.
  checkout: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date, startTime, duration = 1, method, promoCode, voucherId, guest } = req.body as {
      date: string; startTime: string; duration?: number; method: Method; promoCode?: string; voucherId?: string; guest?: { name?: string; phone?: string };
    };
    assertWindow(date);
    const registered = Boolean(req.user && req.user.role === "user");
    const staff = Boolean(req.user && !registered);
    if (staff) throw new AppError(403, "Staff create bookings from the admin panel");

    let customerName: string | undefined;
    let customerPhone: string | undefined;
    if (registered) {
      if (guest) throw new AppError(400, "Signed-in customers do not send guest details");
    } else {
      // Guest rules: details are required and the full amount is paid online.
      const name = (guest?.name ?? "").trim();
      const phone = (guest?.phone ?? "").trim();
      if (name.length < 2) throw new AppError(400, "Enter your full name");
      if (!PHONE.test(phone)) throw new AppError(400, "Enter a 10-digit mobile number starting with 9");
      if (method === "venue") throw new AppError(403, "Guests must pay in full online (eSewa or Fonepay).");
      if (voucherId) throw new AppError(403, "Sign in to use a free game voucher");
      customerName = name;
      customerPhone = phone;
    }

    const userId = registered ? req.user!.id : undefined;
    const booking = await BookingService.createBooking(
      {
        date,
        startTime,
        duration,
        promoCode,
        paymentMethod: method === "venue" ? "venue" : "full",
        customerName,
        customerPhone,
      },
      userId,
    );

    // Online bookings stay pending (and hold the slot) until the payment is confirmed by the server.
    const holdUntil = new Date(Date.now() + QR_HOLD_MS);
    let payment = null;
    try {
      if (voucherId) {
        // A free-game voucher covers the booking in full (regular games, 1 hour, matching shift only).
        if (duration !== 1) throw new AppError(400, "A free game voucher covers a 1-hour booking");
        const period = periodOfHour(parseInt(startTime.split(":")[0], 10));
        await prisma.$transaction(async (tx) => {
          await loyaltyService.useVoucher(tx, voucherId, userId!, booking.id, period);
          await tx.booking.update({
            where: { id: booking.id },
            data: { totalPrice: 0, discountAmount: booking.subtotal, remainingAmount: 0, amountPaidNow: 0, paymentStatus: "completed", status: "confirmed", voucherId, notes: "FREE_GAME_VOUCHER", paymentMethod: "venue" },
          });
        });
        booking.totalPrice = 0;
        booking.paymentStatus = "completed";
        booking.status = "confirmed";
      } else if (method === "venue") {
        // pay at the venue: stays pending until staff confirm / collect
        await prisma.booking.update({ where: { id: booking.id }, data: { status: "pending", paymentStatus: "pending" } });
      } else if (booking.totalPrice > 0) {
        await prisma.booking.update({ where: { id: booking.id }, data: { status: "pending", paymentStatus: "pending", holdExpiresAt: holdUntil, paymentOrderCode: booking.id } });
        payment = await paymentService.createOrder({ orderCode: booking.id, purpose: "game", userId, guestPhone: customerPhone, method: method as "esewa" | "fonepay", amount: booking.totalPrice });
        booking.status = "pending";
      } else {
        // a promo took the price to zero: nothing to pay
        await prisma.booking.update({ where: { id: booking.id }, data: { status: "confirmed", paymentStatus: "completed", remainingAmount: 0 } });
        booking.status = "confirmed";
        booking.paymentStatus = "completed";
      }
    } catch (err) {
      // roll the booking back to a cancelled record and free the slot
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled", cancelledAt: new Date(), notes: "CHECKOUT_FAILED" } });
      await BookingService.freeSlots(booking.id);
      throw err;
    }

    if (userId) {
      await notificationService.notify({
        userId,
        type: "booking",
        title: method === "venue" || voucherId ? "Booking reserved" : "Booking created",
        message: `${date} · ${startTime} – ${booking.endTime}. Code ${(booking as { code?: string | null }).code || booking.id}.`,
        href: "/profile",
        dedupeKey: `booking-created-${booking.id}`,
      });
    }

    res.status(201).json(ApiResponseUtil.success(201, "Booking created", { booking, payment }));
  }),
};

export default checkoutController;
