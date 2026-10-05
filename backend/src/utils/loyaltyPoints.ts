// Loyalty points rules for the new customer app (pure functions, no database).
//
// - A regular game earns price / 100 points, kept to one decimal (Rs. 1,250 = 12.5).
// - 10 games = 1 free game of that shift, so a free game costs price / 10.
// - Extra goods: every full Rs. 100 = 1 point.
// - Membership purchase or renewal: 3 months = 30 points, 6 months = 70, monthly = 0.
// - Challenge game: only the winning captain earns 5 points.
// - Expiry: game and challenge points 3 months after the game, goods points 1 year,
//   membership points never. A claim spends the points that expire soonest first.

import { addDaysKey, addMonthsKey } from "./dates";

export const RS_PER_POINT = 100;
export const GAMES_PER_FREE = 10;
export const POINTS_CAPTAIN_WIN = 5;
export const GAME_POINTS_MONTHS = 3;
export const GOODS_POINTS_MONTHS = 12;
export const EXPIRY_WARN_DAYS = 30;
export const MEMBERSHIP_POINTS: Record<string, number> = { quarterly: 30, half: 70 };

export type Period = "Morning" | "Day" | "Evening";
export const PERIODS: Period[] = ["Morning", "Day", "Evening"];
// A start hour representing each shift, used to look up the shift's price.
export const PERIOD_HOUR: Record<Period, number> = { Morning: 6, Day: 10, Evening: 17 };

export function periodOfHour(hour: number): Period {
  return hour < 10 ? "Morning" : hour < 17 ? "Day" : "Evening";
}

export type LoyaltyKind = "game" | "captain_win" | "goods" | "membership" | "free_game";

export const r1 = (n: number) => Math.round(n * 10) / 10;

export function pointsForGame(priceRs: number): number {
  return Math.floor(Math.max(0, priceRs) / 10) / 10; // price / 100, cut to one decimal
}

export function freeGameCost(priceRs: number): number {
  return r1(Math.max(0, priceRs) / 10); // 10 games' worth
}

export function pointsForGoods(amountRs: number): number {
  return Math.floor(Math.max(0, amountRs) / RS_PER_POINT);
}

export function expiryFor(kind: LoyaltyKind, earnedOn: string): string | null | undefined {
  if (kind === "game" || kind === "captain_win") return addMonthsKey(earnedOn, GAME_POINTS_MONTHS);
  if (kind === "goods") return addMonthsKey(earnedOn, GOODS_POINTS_MONTHS);
  if (kind === "membership") return null;
  return undefined; // spending has no expiry
}

export interface LedgerRow {
  id: string;
  kind: LoyaltyKind;
  points: number;
  earnedOn: string;
  expiresOn: string | null;
  detail: string;
}

interface Lot {
  row: LedgerRow;
  left: number;
}

// Replays the history oldest first so each claim spends the points that expire soonest (never-expiring last)
// and only points still valid on the claim day.
function buildLots(ledger: LedgerRow[]): Lot[] {
  const chron = ledger
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.earnedOn.localeCompare(b.e.earnedOn) || a.i - b.i)
    .map((x) => x.e);
  const lots: Lot[] = [];
  for (const e of chron) {
    if (e.points > 0) {
      lots.push({ row: e, left: e.points });
      continue;
    }
    let need = -e.points;
    const usable = lots
      .filter((l) => l.left > 0 && (l.row.expiresOn === null || l.row.expiresOn >= e.earnedOn))
      .sort((a, b) => (a.row.expiresOn ?? "9999").localeCompare(b.row.expiresOn ?? "9999"));
    for (const l of usable) {
      const take = Math.min(l.left, need);
      l.left = r1(l.left - take);
      need = r1(need - take);
      if (need <= 0) break;
    }
  }
  return lots;
}

export interface Bucket {
  points: number;
  nextExpiry: string | null;
}

export interface LoyaltySummary {
  earned: number;
  claimed: number;
  expired: number;
  remaining: number;
  expiringSoon: { points: number; date: string } | null;
  byType: { games: Bucket; goods: Bucket; membership: Bucket };
  rows: { id: string; kind: LoyaltyKind; points: number; earnedOn: string; expiresOn: string | null; detail: string; status: "valid" | "used" | "expired" | "never" | "spent" }[];
}

export function summarize(ledger: LedgerRow[], today: string): LoyaltySummary {
  const lots = buildLots(ledger);
  const earned = ledger.filter((e) => e.points > 0).reduce((n, e) => n + e.points, 0);
  const claimed = -ledger.filter((e) => e.points < 0).reduce((n, e) => n + e.points, 0);
  const isValid = (l: Lot) => l.left > 0 && (l.row.expiresOn === null || l.row.expiresOn >= today);
  const valid = lots.filter(isValid);
  const expired = lots.filter((l) => l.left > 0 && l.row.expiresOn !== null && l.row.expiresOn < today).reduce((n, l) => n + l.left, 0);

  const bucket = (pred: (l: Lot) => boolean): Bucket => {
    const ls = valid.filter(pred);
    const dated = ls.filter((l) => l.row.expiresOn !== null).map((l) => l.row.expiresOn as string).sort();
    return { points: r1(ls.reduce((n, l) => n + l.left, 0)), nextExpiry: dated[0] ?? null };
  };

  const warnLimit = addDaysKey(today, EXPIRY_WARN_DAYS);
  const soonest = valid.filter((l) => l.row.expiresOn !== null && (l.row.expiresOn as string) <= warnLimit).map((l) => l.row.expiresOn as string).sort()[0];
  const expiringSoon = soonest
    ? { date: soonest, points: r1(valid.filter((l) => l.row.expiresOn === soonest).reduce((n, l) => n + l.left, 0)) }
    : null;

  const lotById = new Map(lots.map((l) => [l.row.id, l]));
  const rows = [...ledger]
    .sort((a, b) => b.earnedOn.localeCompare(a.earnedOn))
    .map((e) => {
      let status: LoyaltySummary["rows"][number]["status"] = "spent";
      if (e.points > 0) {
        const l = lotById.get(e.id)!;
        status = l.left <= 0 ? "used" : l.row.expiresOn !== null && l.row.expiresOn < today ? "expired" : l.row.expiresOn === null ? "never" : "valid";
      }
      return { id: e.id, kind: e.kind, points: e.points, earnedOn: e.earnedOn, expiresOn: e.expiresOn, detail: e.detail, status };
    });

  return {
    earned: r1(earned),
    claimed: r1(claimed),
    expired: r1(expired),
    remaining: r1(valid.reduce((n, l) => n + l.left, 0)),
    expiringSoon,
    byType: {
      games: bucket((l) => l.row.kind === "game" || l.row.kind === "captain_win"),
      goods: bucket((l) => l.row.kind === "goods"),
      membership: bucket((l) => l.row.kind === "membership"),
    },
    rows,
  };
}
