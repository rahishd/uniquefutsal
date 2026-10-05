import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import logger from "../../config/logger";
import notificationService from "../notification/notification.service";
import loyaltyService from "../loyalty/loyalty.service";
import { getGateway, OnlineMethod } from "../../services/paymentGateway";

export const QR_HOLD_MS = 10 * 60 * 1000; // an unpaid QR (and the slot behind it) is held for 10 minutes

export type PaymentPurpose = "game" | "gamezone" | "purchase" | "renew";

const PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  game: "Regular game",
  gamezone: "Gamezone PS5",
  purchase: "Membership purchase",
  renew: "Membership renew",
};

// The note the customer's payment carries, so the payment can be matched to its order.
export const remarksFor = (purpose: PaymentPurpose, orderCode: string) => `${PURPOSE_LABEL[purpose]} - ${orderCode}`;

export interface OrderInput {
  orderCode: string;
  purpose: PaymentPurpose;
  userId?: string | null;
  guestPhone?: string | null;
  method: OnlineMethod;
  amount: number;
}

export class PaymentService {
  // Creates the order and the QR for the exact amount. The browser never builds a payable QR.
  async createOrder(input: OrderInput) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) throw new AppError(400, "Invalid payment amount");
    const remarks = remarksFor(input.purpose, input.orderCode);
    const qr = await getGateway().createQr({ orderCode: input.orderCode, method: input.method, amount: input.amount, remarks });
    const order = await prisma.paymentOrder.create({
      data: {
        orderCode: input.orderCode,
        purpose: input.purpose,
        userId: input.userId ?? null,
        guestPhone: input.guestPhone ?? null,
        method: input.method,
        amount: input.amount,
        remarks,
        qrPayload: qr.qrPayload,
        gatewayRef: qr.gatewayRef ?? null,
        expiresAt: new Date(Date.now() + QR_HOLD_MS),
      },
    });
    return this.publicView(order);
  }

  publicView(o: { orderCode: string; method: string; amount: number; remarks: string; qrPayload: string | null; expiresAt: Date; status: string; paidAt: Date | null }) {
    return { orderCode: o.orderCode, method: o.method, amount: o.amount, remarks: o.remarks, qrPayload: o.qrPayload, expiresAt: o.expiresAt, status: o.status, paidAt: o.paidAt };
  }

  // Who may look at an order: its owner (signed in) or the guest who made it (matching phone).
  private canSee(o: { userId: string | null; guestPhone: string | null }, who: { userId?: string; phone?: string; staff?: boolean }) {
    if (who.staff) return true;
    if (o.userId) return who.userId === o.userId;
    return Boolean(o.guestPhone && who.phone && who.phone === o.guestPhone);
  }

  // Polled by the QR screen every few seconds. The status only ever changes through markPaid / expiry on the server.
  async status(orderCode: string, who: { userId?: string; phone?: string; staff?: boolean }) {
    let order = await prisma.paymentOrder.findUnique({ where: { orderCode } });
    if (!order || !this.canSee(order, who)) throw new AppError(404, "Order not found");
    if (order.status === "pending" && order.expiresAt.getTime() < Date.now()) {
      await this.expireOrder(order.orderCode);
      order = (await prisma.paymentOrder.findUnique({ where: { orderCode } }))!;
    }
    return { status: order.status, paidAt: order.paidAt, expiresAt: order.expiresAt };
  }

  // Called ONLY from a verified gateway callback, a staff action, or the test endpoint. Safe to call twice.
  async markPaid(orderCode: string, p: { source: "gateway" | "staff" | "test"; by?: string; amount?: number; gatewayRef?: string }) {
    const order = await prisma.paymentOrder.findUnique({ where: { orderCode } });
    if (!order) throw new AppError(404, "Order not found");
    if (order.status === "paid") return { alreadyPaid: true, order };
    if (order.status === "refunded" || order.status === "failed") throw new AppError(409, `Order is ${order.status}`);
    if (p.amount !== undefined && p.amount !== order.amount) {
      await prisma.paymentEvent.create({ data: { orderCode, source: "system", payload: JSON.stringify({ problem: "AMOUNT_MISMATCH", expected: order.amount, got: p.amount }) } });
      throw new AppError(409, "Paid amount does not match the order");
    }

    // pending -> paid exactly once (a second callback loses the race and does nothing)
    const upd = await prisma.paymentOrder.updateMany({
      where: { orderCode, status: { in: ["pending", "expired"] } },
      data: { status: "paid", paidAt: new Date(), paidBy: p.by ?? p.source, gatewayRef: p.gatewayRef ?? order.gatewayRef },
    });
    await prisma.paymentEvent.create({ data: { orderCode, source: p.source === "test" ? "system" : p.source, payload: JSON.stringify({ event: "PAID", by: p.by, amount: order.amount }) } });
    if (upd.count === 0) return { alreadyPaid: true, order };

    const confirmed = await this.onPaid({ ...order, status: "paid" });
    return { alreadyPaid: false, confirmed, order: await prisma.paymentOrder.findUnique({ where: { orderCode } }) };
  }

  // Confirms whatever the money was for.
  private async onPaid(order: { orderCode: string; purpose: string; userId: string | null; amount: number; status?: string }): Promise<boolean> {
    if (order.purpose === "game") {
      const b = await prisma.booking.findUnique({ where: { id: order.orderCode } });
      if (!b) return false;
      if (b.status === "cancelled") {
        // Paid after the slot was released: staff must refund. Never silently take the money.
        await prisma.paymentEvent.create({ data: { orderCode: order.orderCode, source: "system", payload: JSON.stringify({ problem: "PAID_AFTER_CANCEL", action: "REFUND_NEEDED" }) } });
        logger.error(`Payment ${order.orderCode} arrived after the booking was cancelled: refund needed`);
        return false;
      }
      await prisma.booking.update({
        where: { id: b.id },
        data: {
          paymentStatus: "completed",
          status: "confirmed",
          amountPaidNow: b.totalPrice,
          remainingAmount: 0,
          onlineAmount: b.totalPrice,
          holdExpiresAt: null,
        },
      });
      if (b.userId) {
        await notificationService.notify({ userId: b.userId, type: "payment", title: "Payment received", message: `Rs. ${order.amount} received for booking ${b.code || b.id}.`, href: "/profile", dedupeKey: `pay-${order.orderCode}` });
        await notificationService.notify({ userId: b.userId, type: "booking", title: "Booking confirmed", message: `${b.date} · ${b.startTime} – ${b.endTime}.`, href: "/profile", dedupeKey: `booked-${b.id}` });
      }
      return true;
    }
    if (order.purpose === "gamezone") {
      const g = await prisma.gzBooking.findUnique({ where: { code: order.orderCode } });
      if (!g || g.status === "cancelled" || g.status === "expired") {
        await prisma.paymentEvent.create({ data: { orderCode: order.orderCode, source: "system", payload: JSON.stringify({ problem: "PAID_AFTER_RELEASE", action: "REFUND_NEEDED" }) } });
        return false;
      }
      await prisma.gzBooking.update({ where: { id: g.id }, data: { paymentStatus: "paid", status: "confirmed", holdExpiresAt: null } });
      if (g.userId) {
        await notificationService.notify({ userId: g.userId, type: "payment", title: "Payment received", message: `Rs. ${order.amount} received for ${g.code}.`, href: "/gamezone", dedupeKey: `pay-${order.orderCode}` });
      }
      return true;
    }
    // Membership purchase / renewal: hooked up once the owner decides the membership model (see docs).
    logger.warn(`markPaid for ${order.purpose} ${order.orderCode}: membership activation is not wired yet`);
    return false;
  }

  // Cancelling is free. An online payment already received is marked "refunded" and logged as REFUND_DUE so staff pay it
  // back in full (no gateway refund API yet); an unpaid order is simply closed. Returns the amount to refund (0 if none).
  async refundOnCancel(orderCode: string): Promise<number> {
    const order = await prisma.paymentOrder.findUnique({ where: { orderCode } });
    if (!order) return 0;
    if (order.status === "pending") {
      await prisma.paymentOrder.updateMany({ where: { orderCode, status: "pending" }, data: { status: "failed" } });
      return 0;
    }
    if (order.status !== "paid") return 0;
    const r = await prisma.paymentOrder.updateMany({ where: { orderCode, status: "paid" }, data: { status: "refunded" } });
    if (r.count === 0) return 0;
    await prisma.paymentEvent.create({ data: { orderCode, source: "system", payload: JSON.stringify({ event: "REFUND_DUE", reason: "CANCELLED_BY_CUSTOMER", amount: order.amount, method: order.method }) } });
    return order.amount;
  }

  // Unpaid orders past their QR hold: expire them and release the slot.
  async expireOrder(orderCode: string) {
    const r = await prisma.paymentOrder.updateMany({ where: { orderCode, status: "pending", expiresAt: { lt: new Date() } }, data: { status: "expired" } });
    if (r.count === 0) return;
    const order = await prisma.paymentOrder.findUnique({ where: { orderCode } });
    if (!order) return;
    if (order.purpose === "game") {
      const b = await prisma.booking.findUnique({ where: { id: orderCode } });
      if (b && b.status === "pending" && b.paymentStatus === "pending") {
        await prisma.booking.update({ where: { id: b.id }, data: { status: "cancelled", cancelledAt: new Date(), notes: b.notes ? `${b.notes} | EXPIRED_UNPAID` : "EXPIRED_UNPAID" } });
        await prisma.bookingSlot.deleteMany({ where: { bookingId: b.id } });
        await loyaltyService.releaseVoucherForBooking(b.id);
      }
    } else if (order.purpose === "gamezone") {
      const g = await prisma.gzBooking.updateMany({ where: { code: orderCode, status: "confirmed", paymentStatus: "pending" }, data: { status: "expired" } });
      if (g.count > 0) await prisma.gzSlot.deleteMany({ where: { bookingCode: orderCode } });
    }
  }

  // Job (every minute): expire everything that ran out of time.
  async expireDue(): Promise<number> {
    const due = await prisma.paymentOrder.findMany({ where: { status: "pending", expiresAt: { lt: new Date() } }, select: { orderCode: true } });
    for (const d of due) await this.expireOrder(d.orderCode);
    return due.length;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
