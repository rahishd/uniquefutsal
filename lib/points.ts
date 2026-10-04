// Loyalty points: rules, expiry, sample history and the customer's balance.
//
// DEMO DATA kept in this browser. The real server owns the ledger: it adds points when a game is
// completed and paid, goods are bought, a membership is paid or a challenge is won, expires them,
// and deducts them when a free game is claimed. Never trust the browser to award or spend points.
//
// Rules (registered account holder only; guests earn nothing):
// - A regular game earns price / 100 points (Rs. 1,250 = 12.5). 10 games = 1 free game of that shift,
//   so a free game costs price / 10 (Morning Rs. 1,250 = 125, Day 1,150 = 115, Evening 1,350 = 135).
// - Extra goods: every Rs. 100 = 1 point.
// - Membership purchase or renewal: 3 months = 30 points, 6 months = 70 points.
// - Challenge game: only the winning captain earns, 5 points.
// - Expiry: game and challenge points last 3 months from the game, goods points 1 year, membership
//   points never expire. Claiming spends the points that expire soonest first.

import { useSyncExternalStore } from "react";
import { dateKey, parseKey, priceFor, type Period } from "@/lib/booking";

export const RS_PER_POINT = 100;
export const GAMES_PER_FREE = 10; // 10 games of a shift = 1 free game of that shift
export const POINTS_CAPTAIN_WIN = 5;
export const GAME_POINTS_MONTHS = 3;
export const GOODS_POINTS_MONTHS = 12;
export const EXPIRY_WARN_DAYS = 30; // warn when points expire within this many days
export const MEMBERSHIP_POINTS: Record<string, number> = { quarterly: 30, half: 70 }; // monthly earns none

// Points are kept to one decimal (a Rs. 1,250 game = 12.5).
const r1 = (n: number) => Math.round(n * 10) / 10;
export function fmtPts(n: number) {
  return Number.isInteger(r1(n)) ? String(r1(n)) : r1(n).toFixed(1);
}

export function pointsForGame(priceRs: number) {
  return Math.floor(Math.max(0, priceRs) / 10) / 10; // price / 100, cut to 1 decimal
}

// What a free game of that price costs: 10 games' worth.
export function freeGameCost(priceRs: number) {
  return r1(Math.max(0, priceRs) / 10);
}

export function pointsForGoods(amountRs: number) {
  return Math.floor(Math.max(0, amountRs) / RS_PER_POINT);
}

export const SHIFTS: { period: Period; hour: number; label: string; hours: string }[] = [
  { period: "Morning", hour: 6, label: "Morning", hours: "6 AM – 10 AM" },
  { period: "Day", hour: 10, label: "Day", hours: "10 AM – 5 PM" },
  { period: "Evening", hour: 17, label: "Evening", hours: "5 PM – 10 PM" },
];

export function shiftInfo(period: Period) {
  const s = SHIFTS.find((x) => x.period === period) ?? SHIFTS[0];
  const price = priceFor(s.hour);
  return { ...s, price, perGame: pointsForGame(price), cost: freeGameCost(price) };
}

export type PointsKind = "game" | "captain-win" | "goods" | "membership" | "free-game";

export interface PointsEntry {
  id: string;
  kind: PointsKind;
  title: string;
  detail: string;
  date: string;
  dateKey: string; // YYYY-MM-DD, used for sorting and expiry
  points: number; // positive = earned, negative = spent on a free game
  expiresKey?: string | null; // last valid day; null = never expires; unset for spending
}

export interface Voucher {
  id: string;
  period: Period; // valid for a regular game in this shift
  cost: number;
}

interface PointsState {
  ledger: PointsEntry[]; // newest first
  vouchers: Voucher[]; // free games claimed but not yet used to book
}

export function addMonths(key: string, months: number) {
  const d = parseKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return dateKey(target);
}

function expiryFor(kind: PointsKind, onKey: string): string | null | undefined {
  if (kind === "game" || kind === "captain-win") return addMonths(onKey, GAME_POINTS_MONTHS);
  if (kind === "goods") return addMonths(onKey, GOODS_POINTS_MONTHS);
  if (kind === "membership") return null;
  return undefined;
}

// Sample history, newest first. Replace with `GET /api/loyalty`.
const SEED: PointsState = {
  vouchers: [],
  ledger: [
    { id: "p8", kind: "captain-win", title: "Challenge game won", detail: "Winning captain bonus", date: "3 Oct", dateKey: "2026-10-03", points: POINTS_CAPTAIN_WIN, expiresKey: "2027-01-03" },
    { id: "p7", kind: "goods", title: "Extra goods", detail: "Rs. 350 spent", date: "3 Oct", dateKey: "2026-10-03", points: pointsForGoods(350), expiresKey: "2027-10-03" },
    { id: "p6", kind: "game", title: "Game played", detail: "Sat, 26 Sep · Evening · Rs. 1,500", date: "26 Sep", dateKey: "2026-09-26", points: pointsForGame(1500), expiresKey: "2026-12-26" },
    { id: "p5", kind: "free-game", title: "Free game claimed", detail: "Morning game · used for booking UF-20260924-00071", date: "24 Sep", dateKey: "2026-09-24", points: -freeGameCost(1000) },
    { id: "p4", kind: "game", title: "Game played", detail: "Sat, 19 Sep · Day · Rs. 1,200", date: "19 Sep", dateKey: "2026-09-19", points: pointsForGame(1200), expiresKey: "2026-12-19" },
    { id: "p3", kind: "goods", title: "Extra goods", detail: "Rs. 1,200 spent", date: "15 Aug", dateKey: "2026-08-15", points: pointsForGoods(1200), expiresKey: "2027-08-15" },
    { id: "p2", kind: "game", title: "Earlier games", detail: "17 games in June and July", date: "20 Jul", dateKey: "2026-07-20", points: 200, expiresKey: "2026-10-20" },
    { id: "p1", kind: "membership", title: "Membership purchased", detail: "3-month plan bonus", date: "2 Apr", dateKey: "2026-04-02", points: 30, expiresKey: null },
  ],
};

/* ---------- balance, with expiry ---------- */

interface Lot {
  entry: PointsEntry;
  left: number;
  expires: string | null;
}

// Replays the history oldest first: each claim spends the points that expire soonest (never-expiring
// membership points last), and only points still valid on the claim day can be spent.
function buildLots(ledger: PointsEntry[]): Lot[] {
  const chron = ledger
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.dateKey.localeCompare(b.e.dateKey) || b.i - a.i)
    .map((x) => x.e);
  const lots: Lot[] = [];
  for (const e of chron) {
    if (e.points > 0) {
      lots.push({ entry: e, left: e.points, expires: e.expiresKey ?? null });
      continue;
    }
    let need = -e.points;
    const usable = lots
      .filter((l) => l.left > 0 && (l.expires === null || l.expires >= e.dateKey))
      .sort((a, b) => (a.expires ?? "9999").localeCompare(b.expires ?? "9999"));
    for (const l of usable) {
      const take = Math.min(l.left, need);
      l.left = r1(l.left - take);
      need = r1(need - take);
      if (need <= 0) break;
    }
  }
  return lots;
}

export interface PointsSummary {
  earned: number; // all points ever earned
  claimed: number; // points already turned into free games
  freeGamesClaimed: number;
  expired: number; // points lost because they were not used in time
  remaining: number; // valid points available now
  cheapestCost: number; // cheapest free game (points)
  toNext: number; // points still needed for the cheapest free game, 0 when one is available
  progressPct: number; // progress towards the cheapest free game, 0-100
  expiringSoon: { points: number; key: string } | null; // earliest expiry inside the warning window
  byType: { games: Bucket; goods: Bucket; membership: Bucket };
  lotById: Record<string, { left: number; expired: boolean; expiresKey: string | null }>;
}

export interface Bucket {
  points: number; // valid points of this type
  nextExpiry: string | null; // earliest expiry of the valid points
}

export function summarize(ledger: PointsEntry[], today: string): PointsSummary {
  const lots = buildLots(ledger);
  const earned = ledger.filter((e) => e.points > 0).reduce((n, e) => n + e.points, 0);
  const spent = ledger.filter((e) => e.points < 0);
  const claimed = -spent.reduce((n, e) => n + e.points, 0);
  const valid = lots.filter((l) => l.left > 0 && (l.expires === null || l.expires >= today));
  const expired = lots.filter((l) => l.left > 0 && l.expires !== null && l.expires < today).reduce((n, l) => n + l.left, 0);
  const remaining = r1(valid.reduce((n, l) => n + l.left, 0));
  const cheapestCost = Math.min(...SHIFTS.map((s) => shiftInfo(s.period).cost));

  const bucket = (pred: (l: Lot) => boolean): Bucket => {
    const ls = valid.filter(pred);
    const dated = ls.filter((l) => l.expires !== null).map((l) => l.expires as string).sort();
    return { points: r1(ls.reduce((n, l) => n + l.left, 0)), nextExpiry: dated[0] ?? null };
  };

  const warnLimit = dateKey(new Date(parseKey(today).getTime() + EXPIRY_WARN_DAYS * 86400000));
  const soonest = valid.filter((l) => l.expires !== null && (l.expires as string) <= warnLimit).map((l) => l.expires as string).sort()[0];
  const expiringSoon = soonest
    ? { key: soonest, points: r1(valid.filter((l) => l.expires === soonest).reduce((n, l) => n + l.left, 0)) }
    : null;

  const lotById: PointsSummary["lotById"] = {};
  for (const l of lots) {
    lotById[l.entry.id] = { left: l.left, expired: l.left > 0 && l.expires !== null && l.expires < today, expiresKey: l.expires };
  }

  return {
    earned: r1(earned),
    claimed: r1(claimed),
    freeGamesClaimed: spent.length,
    expired: r1(expired),
    remaining,
    cheapestCost,
    toNext: r1(Math.max(0, cheapestCost - remaining)),
    progressPct: Math.min(100, Math.round((remaining / cheapestCost) * 100)),
    expiringSoon,
    byType: {
      games: bucket((l) => l.entry.kind === "game" || l.entry.kind === "captain-win"),
      goods: bucket((l) => l.entry.kind === "goods"),
      membership: bucket((l) => l.entry.kind === "membership"),
    },
    lotById,
  };
}

/* ---------- store (browser storage for now) ---------- */

const KEY = "uf-points-v4";
let cache: PointsState | null = null;
const listeners = new Set<() => void>();

function load(): PointsState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as PointsState) : SEED;
  } catch {
    cache = SEED;
  }
  return cache;
}

function commit(next: PointsState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the change lasts for this visit only
  }
  listeners.forEach((l) => l());
}

function today() {
  const d = new Date();
  return {
    dateKey: dateKey(d),
    date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

// Adds points once per `id` (safe to call again for the same game, order or membership).
// The expiry date is set from the kind of points.
export function addPoints(e: Omit<PointsEntry, "date" | "dateKey" | "expiresKey">) {
  const s = load();
  if (s.ledger.some((x) => x.id === e.id)) return;
  const t = today();
  commit({ ...s, ledger: [{ ...e, ...t, expiresKey: expiryFor(e.kind, t.dateKey) }, ...s.ledger] });
}

// A regular game earns price / 100 points (Rs. 1,250 = 12.5). Awarded by the server once the game is
// completed and paid; a free-game booking earns none. Nothing calls this in the demo yet.
export function awardGame(bookingId: string, priceRs: number, detail: string) {
  addPoints({ id: `game-${bookingId}`, kind: "game", title: "Game played", detail, points: pointsForGame(priceRs) });
}

// A challenge game earns points ONLY for the winning captain (5). The loser and a draw earn nothing.
export function awardCaptainWin(challengeId: string) {
  addPoints({ id: `captain-win-${challengeId}`, kind: "captain-win", title: "Challenge game won", detail: "Winning captain bonus", points: POINTS_CAPTAIN_WIN });
}

// 3-month plan = 30 points, 6-month plan = 70, for a first purchase and for every renewal. They never expire.
export function awardMembership(orderId: string, billing: string, renewing: boolean) {
  const pts = MEMBERSHIP_POINTS[billing];
  if (!pts) return;
  addPoints({
    id: `membership-${orderId}`,
    kind: "membership",
    title: renewing ? "Membership renewed" : "Membership purchased",
    detail: `${billing === "half" ? "6" : "3"}-month plan bonus`,
    points: pts,
  });
}

// Spend points on a free-game voucher for one shift. It books a REGULAR game; it cannot host a challenge.
export function claimFreeGame(period: Period): { ok: boolean } {
  const s = load();
  const info = shiftInfo(period);
  const t = today();
  if (summarize(s.ledger, t.dateKey).remaining < info.cost) return { ok: false };
  const id = `${Date.now()}`;
  commit({
    vouchers: [...s.vouchers, { id, period, cost: info.cost }],
    ledger: [{ id: `claim-${id}`, kind: "free-game", title: "Free game claimed", detail: `${info.label} game · ready to use when you book`, points: -info.cost, ...t }, ...s.ledger],
  });
  return { ok: true };
}

// Called when a booking is made with a voucher for that shift.
export function spendVoucher(period: Period, bookingId: string) {
  const s = load();
  const v = s.vouchers.find((x) => x.period === period);
  if (!v) return false;
  commit({
    vouchers: s.vouchers.filter((x) => x !== v),
    ledger: s.ledger.map((e) => (e.id === `claim-${v.id}` ? { ...e, detail: `${v.period} game · used for booking ${bookingId}` } : e)),
  });
  return true;
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePoints(): PointsState & { summary: PointsSummary } {
  const s = useSyncExternalStore(subscribe, load, () => SEED);
  return { ...s, summary: summarize(s.ledger, dateKey(new Date())) };
}

const NO_VOUCHERS: Voucher[] = [];
export function useVouchers(): Voucher[] {
  return useSyncExternalStore(subscribe, () => load().vouchers, () => NO_VOUCHERS);
}
