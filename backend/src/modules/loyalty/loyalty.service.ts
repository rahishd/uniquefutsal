import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import SettingsService from "../settings/settings.service";
import notificationService from "../notification/notification.service";
import { todayKey } from "../../utils/dates";
import {
  EXPIRY_WARN_DAYS, LedgerRow, LoyaltyKind, MEMBERSHIP_POINTS, PERIODS, PERIOD_HOUR, POINTS_CAPTAIN_WIN,
  Period, expiryFor, freeGameCost, periodOfHour, pointsForGame, pointsForGoods, r1, summarize,
} from "../../utils/loyaltyPoints";
import { addDaysKey } from "../../utils/dates";
import logger from "../../config/logger";

// Prisma Decimal -> number
const num = (d: Prisma.Decimal | number) => Number(d);

type Tx = Prisma.TransactionClient;

export class LoyaltyService {
  // The price of one hour in a shift, from the admin's hourly pricing (Settings), so real prices flow through.
  async shiftPrice(period: Period): Promise<number> {
    const pricing = await SettingsService.getHourlyPricing();
    const hour = PERIOD_HOUR[period];
    const slot = pricing.find((s) => parseInt(s.id.replace("ts-", ""), 10) === hour);
    return slot?.price ?? (await SettingsService.getHourlyRate());
  }

  async shifts() {
    const out = [];
    for (const period of PERIODS) {
      const price = await this.shiftPrice(period);
      out.push({ period, price, perGame: pointsForGame(price), cost: freeGameCost(price) });
    }
    return out;
  }

  async ledger(userId: string, db: Tx | typeof prisma = prisma): Promise<LedgerRow[]> {
    const rows = await db.loyaltyEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as LoyaltyKind,
      points: num(r.points),
      earnedOn: r.earnedOn,
      expiresOn: r.expiresOn,
      detail: r.detail,
    }));
  }

  async overview(userId: string, today = todayKey()) {
    const [ledger, shifts, vouchers] = await Promise.all([
      this.ledger(userId),
      this.shifts(),
      prisma.freeGameVoucher.findMany({ where: { userId, status: "unused" }, orderBy: { claimedAt: "asc" } }),
    ]);
    const summary = summarize(ledger, today);
    const cheapest = Math.min(...shifts.map((s) => s.cost));
    return {
      ...summary,
      cheapestCost: cheapest,
      toNext: r1(Math.max(0, cheapest - summary.remaining)),
      shifts: shifts.map((s) => ({ ...s, canClaim: summary.remaining >= s.cost })),
      vouchers: vouchers.map((v) => ({ id: v.id, period: v.period, cost: num(v.cost), claimedAt: v.claimedAt })),
    };
  }

  // Adds points once per (kind, source). Calling it again for the same source changes nothing.
  async award(p: { userId: string; kind: LoyaltyKind; points: number; sourceType: string; sourceId: string; detail: string; earnedOn?: string }): Promise<boolean> {
    if (p.points <= 0) return false;
    const earnedOn = p.earnedOn ?? todayKey();
    try {
      await prisma.loyaltyEntry.create({
        data: {
          userId: p.userId,
          kind: p.kind,
          points: new Prisma.Decimal(p.points.toFixed(1)),
          earnedOn,
          expiresOn: expiryFor(p.kind, earnedOn) ?? null,
          sourceType: p.sourceType,
          sourceId: p.sourceId,
          detail: p.detail,
        },
      });
      await notificationService.notify({
        userId: p.userId,
        type: "points",
        title: "Points earned",
        message: `+${p.points} loyalty points: ${p.detail}`,
        href: "/points",
        dedupeKey: `points-${p.kind}-${p.sourceType}-${p.sourceId}`,
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; // already awarded
      throw e;
    }
  }

  // A completed, paid regular game earns price/100 points. A free-game booking earns none.
  async awardForCompletedBooking(b: { id: string; userId: string | null; totalPrice: number; paymentStatus: string; notes: string | null; voucherId?: string | null; date: string; startTime: string; source?: string }) {
    if (!b.userId) return false; // guests earn nothing
    if (b.paymentStatus !== "completed") return false;
    if (b.notes?.includes("FREE_MATCH") || b.voucherId) return false;
    if (b.notes?.includes("MEMBERSHIP_")) return false; // membership ledger rows are not games
    if (b.source === "challenge") return false; // challenge games earn only the winning captain's bonus
    const pts = pointsForGame(b.totalPrice);
    if (pts <= 0) return false;
    return this.award({
      userId: b.userId,
      kind: "game",
      points: pts,
      sourceType: "booking",
      sourceId: b.id,
      detail: `Game on ${b.date} at ${b.startTime} (Rs. ${b.totalPrice})`,
      earnedOn: b.date,
    });
  }

  async awardForMembership(userId: string, subscriptionId: string, billing: string, renewing: boolean) {
    const pts = MEMBERSHIP_POINTS[billing];
    if (!pts) return false;
    return this.award({
      userId,
      kind: "membership",
      points: pts,
      sourceType: "membership",
      sourceId: subscriptionId,
      detail: `${renewing ? "Membership renewed" : "Membership purchased"} (${billing === "half" ? "6" : "3"}-month plan bonus)`,
    });
  }

  async awardCaptainWin(userId: string, challengeId: string) {
    return this.award({
      userId,
      kind: "captain_win",
      points: POINTS_CAPTAIN_WIN,
      sourceType: "challenge",
      sourceId: challengeId,
      detail: "Challenge game won (winning captain bonus)",
    });
  }

  // Staff record a goods sale; points follow Rs. 100 = 1 point.
  async recordGoodsSale(p: { phone: string; amount: number; items?: string; soldBy: string }) {
    if (!Number.isInteger(p.amount) || p.amount <= 0) throw new AppError(400, "Amount must be a positive whole number");
    const user = await prisma.user.findUnique({ where: { phoneNumber: p.phone }, select: { phoneNumber: true } });
    const sale = await prisma.goodsSale.create({
      data: { userId: user?.phoneNumber ?? null, phone: p.phone, amount: p.amount, items: p.items ?? null, soldBy: p.soldBy },
    });
    const pts = pointsForGoods(p.amount);
    const awarded = user && pts > 0
      ? await this.award({ userId: user.phoneNumber, kind: "goods", points: pts, sourceType: "goods", sourceId: sale.id, detail: `Extra goods (Rs. ${p.amount})` })
      : false;
    return { saleId: sale.id, points: user ? pts : 0, registered: Boolean(user), awarded };
  }

  // Spend points on a voucher for one shift. Locked per customer so two taps cannot spend the same points twice.
  async claim(userId: string, period: Period) {
    if (!PERIODS.includes(period)) throw new AppError(400, "Choose Morning, Day or Evening");
    const price = await this.shiftPrice(period);
    const cost = freeGameCost(price);
    const today = todayKey();

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"loyalty:" + userId}))`;
      const summary = summarize(await this.ledger(userId, tx), today);
      if (summary.remaining < cost) {
        throw new AppError(409, `Not enough points. This free game costs ${cost} points and you have ${summary.remaining}.`);
      }
      const voucher = await tx.freeGameVoucher.create({ data: { userId, period, cost: new Prisma.Decimal(cost.toFixed(1)) } });
      await tx.loyaltyEntry.create({
        data: {
          userId,
          kind: "free_game",
          points: new Prisma.Decimal((-cost).toFixed(1)),
          earnedOn: today,
          expiresOn: null,
          sourceType: "voucher",
          sourceId: voucher.id,
          detail: `Free ${period} game claimed`,
        },
      });
      return { id: voucher.id, period, cost };
    });
  }

  // Marks a voucher as used for a booking. Only the owner's unused voucher for that shift can be used, once.
  async useVoucher(tx: Tx, voucherId: string, userId: string, bookingId: string, period: Period): Promise<void> {
    const r = await tx.freeGameVoucher.updateMany({
      where: { id: voucherId, userId, status: "unused", period },
      data: { status: "used", bookingId, usedAt: new Date() },
    });
    if (r.count !== 1) throw new AppError(409, "This free game voucher is not available for that time slot");
  }

  // A cancelled free-game booking gives the voucher back.
  async releaseVoucherForBooking(bookingId: string) {
    await prisma.freeGameVoucher.updateMany({
      where: { bookingId, status: "used" },
      data: { status: "unused", bookingId: null, usedAt: null },
    });
  }

  // Daily job: tell customers whose points expire within 30 days (once per customer per expiry date).
  async warnExpiringPoints(today = todayKey()) {
    const limit = addDaysKey(today, EXPIRY_WARN_DAYS);
    const candidates = await prisma.loyaltyEntry.findMany({
      where: { expiresOn: { gte: today, lte: limit }, points: { gt: 0 } },
      select: { userId: true },
      distinct: ["userId"],
    });
    let sent = 0;
    for (const c of candidates) {
      const s = summarize(await this.ledger(c.userId), today);
      if (!s.expiringSoon) continue;
      await notificationService.notify({
        userId: c.userId,
        type: "points",
        title: "Points expiring soon",
        message: `${s.expiringSoon.points} points expire on ${s.expiringSoon.date}. Claim a free game before then.`,
        href: "/points",
        dedupeKey: `points-expiring-${c.userId}-${s.expiringSoon.date}`,
      });
      sent++;
    }
    logger.info(`Loyalty expiry warnings processed: ${sent}`);
    return sent;
  }

  periodFor(startTime: string): Period {
    return periodOfHour(parseInt(startTime.split(":")[0], 10));
  }
}

export const loyaltyService = new LoyaltyService();
export default loyaltyService;
