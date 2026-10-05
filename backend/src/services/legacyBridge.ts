import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import loyaltyService from "../modules/loyalty/loyalty.service";
import { todayKey } from "../utils/dates";
import { PERIODS, Period, pointsForGame, freeGameCost } from "../utils/loyaltyPoints";

// Bridges the developer's existing data to the new customer app. Both functions are DRY-RUN by default (they only
// report what they would do), can be run again safely, and never change or delete existing customer records.

export interface BridgeReport {
  dryRun: boolean;
  [k: string]: unknown;
}

// Existing active bookings get their hour rows in BookingSlot, so the "one booking per hour" guard also protects
// bookings made before the new app existed. Two old bookings that overlap are reported, never changed.
export async function backfillBookingSlots(opts: { apply: boolean; fromDate?: string }): Promise<BridgeReport> {
  const from = opts.fromDate ?? todayKey();
  const bookings = await prisma.booking.findMany({
    where: { status: { not: "cancelled" }, date: { gte: from } },
    select: { id: true, date: true, startTime: true, duration: true },
    orderBy: { createdAt: "asc" },
  });
  const have = new Set((await prisma.bookingSlot.findMany({ where: { date: { gte: from } }, select: { date: true, hour: true } })).map((s) => `${s.date}|${s.hour}`));
  const existingIds = new Set((await prisma.bookingSlot.findMany({ select: { bookingId: true } })).map((s) => s.bookingId));

  const rows: { date: string; hour: number; bookingId: string }[] = [];
  const conflicts: { bookingId: string; date: string; hour: number }[] = [];
  for (const b of bookings) {
    if (existingIds.has(b.id)) continue;
    const start = parseInt(b.startTime.split(":")[0], 10);
    for (let i = 0; i < b.duration; i++) {
      const key = `${b.date}|${start + i}`;
      if (have.has(key)) {
        conflicts.push({ bookingId: b.id, date: b.date, hour: start + i });
        continue;
      }
      have.add(key);
      rows.push({ date: b.date, hour: start + i, bookingId: b.id });
    }
  }
  if (opts.apply && rows.length) await prisma.bookingSlot.createMany({ data: rows, skipDuplicates: true });
  return { dryRun: !opts.apply, bookingsChecked: bookings.length, slotRowsToCreate: rows.length, created: opts.apply ? rows.length : 0, overlaps: conflicts };
}

// Opening balance from the old loyalty fields. The old fields are left exactly as they are.
//  - freeMatchesAvailable (each = one free hour)  -> that many free-game vouchers for the chosen shift
//  - loyaltyProgress (hours played in the current 10-hour cycle) -> opening points worth that many games
// The owner decides the shift for old free matches (--voucher-period), because the new vouchers are per shift.
export async function importLegacyLoyalty(opts: { apply: boolean; voucherPeriod?: Period; referencePeriod?: Period }): Promise<BridgeReport> {
  if (opts.voucherPeriod && !PERIODS.includes(opts.voucherPeriod)) throw new Error("voucherPeriod must be Morning, Day or Evening");
  const refPeriod = opts.referencePeriod ?? "Day";
  const price = await loyaltyService.shiftPrice(refPeriod);
  const perHour = pointsForGame(price); // one old "hour point" is worth one game of the reference shift
  const today = todayKey();

  const users = await prisma.user.findMany({
    where: { OR: [{ freeMatchesAvailable: { gt: 0 } }, { loyaltyProgress: { gt: 0 } }], role: "user" },
    select: { phoneNumber: true, freeMatchesAvailable: true, loyaltyProgress: true },
  });

  let vouchers = 0;
  let points = 0;
  let skippedVouchers = 0;
  const preview: { phone: string; vouchers: number; points: number }[] = [];

  for (const u of users) {
    const pts = Math.min(u.loyaltyProgress, 10) * perHour;
    const v = u.freeMatchesAvailable;
    preview.push({ phone: u.phoneNumber, vouchers: opts.voucherPeriod ? v : 0, points: pts });
    if (!opts.voucherPeriod && v > 0) skippedVouchers += v;
    if (opts.voucherPeriod) vouchers += v;
    points += pts;
    if (!opts.apply) continue;

    if (pts > 0) {
      await loyaltyService.award({ userId: u.phoneNumber, kind: "game", points: pts, sourceType: "legacy-progress", sourceId: u.phoneNumber, detail: `Carried over from the old loyalty (${u.loyaltyProgress} hours)`, earnedOn: today });
    }
    if (opts.voucherPeriod && v > 0) {
      // idempotent: a marker records that this customer's old free matches were already carried over
      const markerKey = `legacy-free-matches:${u.phoneNumber}`;
      const marker = await prisma.settings.findUnique({ where: { key: markerKey } });
      if (!marker) {
        await prisma.freeGameVoucher.createMany({ data: Array.from({ length: v }, () => ({ userId: u.phoneNumber, period: opts.voucherPeriod!, cost: new Prisma.Decimal(freeGameCost(price).toFixed(1)) })) });
        await prisma.settings.create({ data: { key: markerKey, value: JSON.stringify({ vouchers: v, period: opts.voucherPeriod, at: new Date().toISOString() }) } });
      }
    }
  }
  return {
    dryRun: !opts.apply, customers: users.length, referencePeriod: refPeriod, referencePrice: price, pointsPerOldHour: perHour,
    openingPoints: points, vouchersToCreate: vouchers, freeMatchesNotConverted: skippedVouchers,
    note: opts.voucherPeriod ? undefined : "No --voucher-period given: old free matches were NOT converted. Pass Morning, Day or Evening to convert them.",
    preview: preview.slice(0, 20),
  };
}
