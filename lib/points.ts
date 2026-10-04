// Loyalty points: rules, sample history and the customer's balance.
//
// DEMO DATA kept in this browser. The real server owns the ledger: it adds points when a game is
// completed and paid, goods are bought, a membership is paid or a challenge is won, and deducts them
// when a free game is claimed. Never trust the browser to award or spend points.

import { useSyncExternalStore } from "react";
import { priceFor, type Period } from "@/lib/booking";

// Points are whole numbers: Rs. 100 of game price = 1 point, shown as "place value" (1.2 -> 12).
export const RS_PER_POINT = 100;
export const GAMES_PER_FREE = 10; // 10 games of a shift earn 1 free game of that shift
export const POINTS_CAPTAIN_WIN = 5; // challenge games: ONLY the winning captain earns, and only 5
export const MEMBERSHIP_3M_POINTS = 30; // buying or renewing the 3-month membership

// Points one regular game earns: Rs. 1,250 -> 12 (never rounded up).
export function pointsForGame(priceRs: number) {
  return Math.floor(Math.max(0, priceRs) / RS_PER_POINT);
}

// Points a free game of that price costs: 10 games' worth.
export function freeGameCost(priceRs: number) {
  return pointsForGame(priceRs) * GAMES_PER_FREE;
}

export function pointsForGoods(amountRs: number) {
  return pointsForGame(amountRs); // goods use the same rate as games
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
  dateKey: string; // YYYY-MM-DD, used for sorting
  points: number; // positive = earned, negative = spent on a free game
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

// Sample history. Replace with `GET /api/loyalty`.
const SEED: PointsState = {
  vouchers: [],
  ledger: [
    { id: "p6", kind: "captain-win", title: "Challenge game won", detail: "Winning captain bonus", date: "3 Oct", dateKey: "2026-10-03", points: POINTS_CAPTAIN_WIN },
    { id: "p5", kind: "goods", title: "Extra goods", detail: "Rs. 350 spent (3 x Rs. 100)", date: "3 Oct", dateKey: "2026-10-03", points: pointsForGoods(350) },
    { id: "p4", kind: "game", title: "Game played", detail: "Sat, 26 Sep · Evening · Rs. 1,500", date: "26 Sep", dateKey: "2026-09-26", points: pointsForGame(1500) },
    { id: "p3", kind: "free-game", title: "Free game claimed", detail: "Morning game · used for booking UF-20260924-00071", date: "24 Sep", dateKey: "2026-09-24", points: -freeGameCost(1000) },
    { id: "p2", kind: "game", title: "Game played", detail: "Sat, 19 Sep · Day · Rs. 1,200", date: "19 Sep", dateKey: "2026-09-19", points: pointsForGame(1200) },
    { id: "p1", kind: "game", title: "Earlier games", detail: "Games before 19 Sep", date: "Before Sep", dateKey: "2026-09-01", points: 200 },
  ],
};

export interface PointsSummary {
  earned: number; // all points ever earned
  claimed: number; // points already turned into free games
  freeGamesClaimed: number;
  remaining: number; // points still in the account
  cheapestCost: number; // cheapest free game (points)
  toNext: number; // points still needed for the cheapest free game, 0 when one is available
  progressPct: number; // progress towards the cheapest free game, 0-100
}

export function summarize(ledger: PointsEntry[]): PointsSummary {
  const earned = ledger.filter((e) => e.points > 0).reduce((n, e) => n + e.points, 0);
  const spent = ledger.filter((e) => e.points < 0);
  const claimed = -spent.reduce((n, e) => n + e.points, 0);
  const remaining = Math.max(0, earned - claimed);
  const cheapestCost = Math.min(...SHIFTS.map((s) => shiftInfo(s.period).cost));
  return {
    earned,
    claimed,
    freeGamesClaimed: spent.length,
    remaining,
    cheapestCost,
    toNext: Math.max(0, cheapestCost - remaining),
    progressPct: Math.min(100, Math.round((remaining / cheapestCost) * 100)),
  };
}

/* ---------- store (browser storage for now) ---------- */

const KEY = "uf-points-v3";
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
    dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

// Adds points once per `id` (safe to call again for the same game, order or membership).
export function addPoints(e: Omit<PointsEntry, "date" | "dateKey">) {
  const s = load();
  if (s.ledger.some((x) => x.id === e.id)) return;
  commit({ ...s, ledger: [{ ...e, ...today() }, ...s.ledger] });
}

// A regular game earns points from what it cost (Rs. 100 = 1 point). Awarded by the server once the
// game is completed and paid; a free-game booking earns none. Nothing calls this in the demo yet.
export function awardGame(bookingId: string, priceRs: number, detail: string) {
  addPoints({ id: `game-${bookingId}`, kind: "game", title: "Game played", detail, points: pointsForGame(priceRs) });
}

// A challenge game earns points ONLY for the winning captain (5). The loser and a draw earn nothing.
export function awardCaptainWin(challengeId: string) {
  addPoints({ id: `captain-win-${challengeId}`, kind: "captain-win", title: "Challenge game won", detail: "Winning captain bonus", points: POINTS_CAPTAIN_WIN });
}

// Only the 3-month plan earns points, for a first purchase and for every renewal.
export function awardMembership(orderId: string, billing: string, renewing: boolean) {
  if (billing !== "quarterly") return;
  addPoints({
    id: `membership-${orderId}`,
    kind: "membership",
    title: renewing ? "Membership renewed" : "Membership purchased",
    detail: "3-month plan bonus",
    points: MEMBERSHIP_3M_POINTS,
  });
}

// Spend points on a free-game voucher for one shift. It books a REGULAR game; it cannot host a challenge.
export function claimFreeGame(period: Period): { ok: boolean } {
  const s = load();
  const info = shiftInfo(period);
  if (summarize(s.ledger).remaining < info.cost) return { ok: false };
  const id = `${Date.now()}`;
  commit({
    vouchers: [...s.vouchers, { id, period, cost: info.cost }],
    ledger: [{ id: `claim-${id}`, kind: "free-game", title: "Free game claimed", detail: `${info.label} game · ready to use when you book`, points: -info.cost, ...today() }, ...s.ledger],
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
  return { ...s, summary: summarize(s.ledger) };
}

const NO_VOUCHERS: Voucher[] = [];
export function useVouchers(): Voucher[] {
  return useSyncExternalStore(subscribe, () => load().vouchers, () => NO_VOUCHERS);
}
