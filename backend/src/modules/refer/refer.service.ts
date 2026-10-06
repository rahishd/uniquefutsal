import { randomInt } from "crypto";
import { Prisma, Referral } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { addDaysKey, todayKey } from "../../utils/dates";
import notificationService from "../notification/notification.service";
import BookingService from "../booking/booking.service";
import { assertWindow } from "../booking/booking.checkout";

// Refer & Earn: a customer books a game on behalf of ANOTHER team. They file the booking here with the friend's number and
// team name. Staff check it in the admin portal and approve it; then BOTH get loyalty points (amounts set by staff).
// The points are written by the admin portal on approval, never by the app, so nobody can give themselves points.
export const SETTINGS_KEY = "referEarn";
export const PER_DAY = 5; // referrals one customer can file in 24 hours
export const LOOKBACK_DAYS = 30; // a game played up to 30 days ago can still be referred

export interface ReferRules { enabled: boolean; referrerPoints: number; friendPoints: number }
export const DEFAULT_RULES: ReferRules = { enabled: true, referrerPoints: 10, friendPoints: 10 };

export async function getRules(): Promise<ReferRules> {
  const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
  if (row) {
    try {
      const j = JSON.parse(row.value) as Partial<ReferRules>;
      return {
        enabled: j.enabled !== false,
        referrerPoints: Number.isFinite(j.referrerPoints) ? Number(j.referrerPoints) : DEFAULT_RULES.referrerPoints,
        friendPoints: Number.isFinite(j.friendPoints) ? Number(j.friendPoints) : DEFAULT_RULES.friendPoints,
      };
    } catch { /* default below */ }
  }
  return DEFAULT_RULES;
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "RF-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const view = (r: Referral, role: "referrer" | "friend", names: Map<string, string | null>) => ({
  id: r.id, code: r.code, role, status: r.status, teamName: r.teamName, bookingCode: r.bookingCode, gameDate: r.gameDate, gameTime: r.gameTime,
  referrerName: names.get(r.referrerId) ?? null, friendName: names.get(r.friendId) ?? null,
  // the points shown are the ones this customer would get
  points: Number(role === "referrer" ? r.referrerPoints : r.friendPoints), staffNote: r.status === "rejected" ? r.staffNote : null,
  createdAt: r.createdAt, decidedAt: r.decidedAt,
});

export class ReferService {
  async rules() {
    const r = await getRules();
    return { ...r, perDay: PER_DAY };
  }

  async me(userId: string) {
    const rules = await this.rules();
    const rows = await prisma.referral.findMany({ where: { OR: [{ referrerId: userId }, { friendId: userId }] }, orderBy: { createdAt: "desc" }, take: 100 });
    const people = await prisma.user.findMany({ where: { phoneNumber: { in: [...new Set(rows.flatMap((r) => [r.referrerId, r.friendId]))] } }, select: { phoneNumber: true, name: true } });
    const names = new Map(people.map((p) => [p.phoneNumber, p.name]));
    const taken = new Set((await prisma.referral.findMany({ where: { referrerId: userId }, select: { bookingId: true } })).map((r) => r.bookingId));
    const since = addDaysKey(todayKey(), -LOOKBACK_DAYS);
    const bookings = await prisma.booking.findMany({
      where: { userId, date: { gte: since }, status: { notIn: ["cancelled", "expired", "rejected"] }, source: "regular", code: { not: null } },
      orderBy: [{ date: "desc" }, { startTime: "desc" }], take: 60,
      select: { id: true, code: true, date: true, startTime: true, endTime: true, status: true },
    });
    return {
      rules,
      referrals: rows.map((r) => view(r, r.referrerId === userId ? "referrer" : "friend", names)),
      eligibleBookings: bookings.filter((b) => !taken.has(b.id)).map((b) => ({ code: b.code, date: b.date, startTime: b.startTime, endTime: b.endTime })),
    };
  }

  async create(userId: string, input: { bookingCode?: unknown; friendPhone?: unknown; teamName?: unknown }) {
    const rules = await getRules();
    if (!rules.enabled) throw new AppError(403, "Refer & Earn is paused right now.");
    const friendPhone = typeof input.friendPhone === "string" ? input.friendPhone.trim() : "";
    if (!/^9\d{9}$/.test(friendPhone)) throw new AppError(400, "Enter the other team captain's 10-digit mobile number, starting with 9.");
    if (friendPhone === userId) throw new AppError(400, "You cannot refer yourself. Enter the other team's captain.");
    const teamName = typeof input.teamName === "string" ? input.teamName.trim().replace(/\s+/g, " ") : "";
    if (teamName.length < 2 || teamName.length > 40) throw new AppError(400, "Enter the other team's name (2 to 40 characters).");
    const bookingCode = typeof input.bookingCode === "string" ? input.bookingCode.trim().toUpperCase().slice(0, 20) : "";
    if (!bookingCode) throw new AppError(400, "Choose the booking you made for the other team.");

    const booking = await prisma.booking.findFirst({ where: { code: bookingCode, userId } });
    if (!booking) throw new AppError(404, "That booking is not on your account.");
    if (["cancelled", "expired", "rejected"].includes(booking.status)) throw new AppError(409, "That booking was cancelled, so it cannot be referred.");
    if (booking.date < addDaysKey(todayKey(), -LOOKBACK_DAYS)) throw new AppError(409, `Only games from the last ${LOOKBACK_DAYS} days can be referred.`);
    const friend = await prisma.user.findUnique({ where: { phoneNumber: friendPhone }, select: { phoneNumber: true, name: true } });
    if (!friend) throw new AppError(404, "That number is not registered yet. Ask them to sign up in the app first, so they can receive points.");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.referral.count({ where: { referrerId: userId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can send up to ${PER_DAY} referrals a day. Please try again tomorrow.`);
    }

    let code = makeCode();
    for (let i = 0; i < 5 && (await prisma.referral.findUnique({ where: { code }, select: { id: true } })); i++) code = makeCode();
    let row: Referral;
    try {
      row = await prisma.referral.create({
        data: {
          code, referrerId: userId, friendId: friend.phoneNumber, teamName, bookingId: booking.id, bookingCode, gameDate: booking.date, gameTime: booking.startTime,
          referrerPoints: new Prisma.Decimal(rules.referrerPoints.toFixed(1)), friendPoints: new Prisma.Decimal(rules.friendPoints.toFixed(1)),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError(409, "This booking was already sent as a referral.");
      throw e;
    }
    const me = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true } });
    await notificationService.notify({
      userId: friend.phoneNumber, type: "referral", title: "A game was booked for your team",
      message: `${me?.name ?? "A player"} booked a game for ${teamName}. Once the venue confirms it you both earn loyalty points.`, href: "/refer", dedupeKey: `referral-new-${row.id}`,
    });
    const names = new Map<string, string | null>([[friend.phoneNumber, friend.name], [userId, me?.name ?? null]]);
    return view(row, "referrer", names);
  }

  // One step for the customer: reserve the slot for the other team (on the customer's own account, paid at the venue) and
  // file the referral for it. If filing fails, the reservation is cancelled again so no slot is left blocked.
  async bookAndRefer(userId: string, input: { date?: unknown; startTime?: unknown; friendPhone?: unknown; friendName?: unknown }) {
    const date = typeof input.date === "string" ? input.date : "";
    const startTime = typeof input.startTime === "string" ? input.startTime : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:00$/.test(startTime)) throw new AppError(400, "Choose a date and a time.");
    assertWindow(date);
    const rules = await getRules();
    if (!rules.enabled) throw new AppError(403, "Refer & Earn is paused right now.");
    const booking = await BookingService.createBooking({ date, startTime, duration: 1, paymentMethod: "venue" }, userId);
    try {
      const code = (booking as { code?: string }).code;
      return await this.create(userId, { bookingCode: code, friendPhone: input.friendPhone, teamName: input.friendName });
    } catch (e) {
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled", cancelledAt: new Date(), notes: "REFERRAL_FAILED" } });
      await BookingService.freeSlots(booking.id);
      throw e;
    }
  }

  async cancel(userId: string, id: string) {
    const r = await prisma.referral.findUnique({ where: { id } });
    if (!r || r.referrerId !== userId) throw new AppError(404, "Referral not found");
    if (r.status !== "pending") throw new AppError(409, "Only a referral that is waiting for the venue can be withdrawn.");
    await prisma.referral.delete({ where: { id } });
    return { id };
  }
}

export default new ReferService();
