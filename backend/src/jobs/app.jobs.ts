import { prisma } from "../config/db";
import { fallbackBookingCode } from "../utils/bookingCode";
import logger from "../config/logger";
import notificationService from "../modules/notification/notification.service";
import paymentService from "../modules/payment/payment.service";
import loyaltyService from "../modules/loyalty/loyalty.service";
import { addDaysKey, startsAtMs, todayKey } from "../utils/dates";

// Jobs for the customer app. Each one is safe to run twice: notices carry a dedupe key and every state change is guarded.

const HOUR = 3600000;

// 1-hour reminder in the customer's bell for confirmed court bookings and Gamezone sessions.
export async function sendAppReminders(now = Date.now()): Promise<number> {
  const today = todayKey(new Date(now));
  const tomorrow = addDaysKey(today, 1);
  let sent = 0;

  const bookings = await prisma.booking.findMany({ where: { date: { in: [today, tomorrow] }, status: "confirmed", userId: { not: null }, AND: [{ OR: [{ notes: null }, { NOT: { notes: { contains: "MEMBERSHIP_" } } }] }] } });
  for (const b of bookings) {
    const start = startsAtMs(b.date, parseInt(b.startTime.split(":")[0], 10));
    if (start - now > HOUR + 10 * 60000 || start <= now) continue;
    await notificationService.notify({
      userId: b.userId!, type: "reminder", title: "Your game starts in about an hour",
      message: `${b.date} · ${b.startTime} – ${b.endTime}. Booking ${b.code || fallbackBookingCode(b.id)}.`, href: "/profile", dedupeKey: `remind-${b.id}`,
    });
    sent++;
  }

  const sessions = await prisma.gzBooking.findMany({ where: { date: { in: [today, tomorrow] }, status: "confirmed", userId: { not: null } } });
  for (const g of sessions) {
    const start = startsAtMs(g.date, g.startHour);
    if (start - now > HOUR + 10 * 60000 || start <= now) continue;
    await notificationService.notify({
      userId: g.userId!, type: "reminder", title: "Your PS5 session starts in about an hour",
      message: `${g.date} · ${String(g.startHour).padStart(2, "0")}:00 for ${g.hours} hr. ${g.code}.`, href: "/gamezone", dedupeKey: `remind-${g.code}`,
    });
    sent++;
  }
  return sent;
}

// Challenges nobody answered before the game time are closed.
export async function expireChallenges(now = Date.now()): Promise<number> {
  const open = await prisma.challenge.findMany({ where: { status: "pending", date: { lte: todayKey(new Date(now)) } } });
  let n = 0;
  for (const c of open) {
    if (startsAtMs(c.date, c.startHour) <= now) {
      await prisma.challenge.update({ where: { id: c.id }, data: { status: "expired" } });
      n++;
    }
  }
  return n;
}

export async function runAppJobs(which: "minute" | "tenMinutes" | "daily") {
  try {
    if (which === "minute") {
      const n = await paymentService.expireDue();
      if (n) logger.info(`Expired ${n} unpaid payment holds`);
    } else if (which === "tenMinutes") {
      await sendAppReminders();
      await expireChallenges();
    } else {
      await loyaltyService.warnExpiringPoints();
    }
  } catch (err) {
    logger.error(`App job "${which}" failed`, err);
  }
}
