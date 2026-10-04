// Loyalty points: rules, sample history and the customer's balance.
//
// DEMO DATA kept in this browser. The real server owns the ledger: it adds points when a game is
// completed, goods are bought, a membership is paid or a challenge is won, and deducts them when a
// free game is claimed. Never trust the browser to award or spend points.

import { useSyncExternalStore } from "react";

export const POINTS_PER_FREE_GAME = 100; // 100 points = 1 free game
export const POINTS_PER_GAME = 10; // every completed regular game
export const POINTS_CAPTAIN_WIN = 5; // challenge games: ONLY the winning captain earns, and only 5
export const GOODS_STEP_RS = 100; // every full Rs. 100 of extra goods...
export const POINTS_PER_GOODS_STEP = 5; // ...earns 5 points
export const MEMBERSHIP_3M_POINTS = 30; // buying or renewing the 3-month membership

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

export function pointsForGoods(amountRs: number) {
  return Math.floor(Math.max(0, amountRs) / GOODS_STEP_RS) * POINTS_PER_GOODS_STEP;
}

interface PointsState {
  ledger: PointsEntry[]; // newest first
  vouchers: number; // free games claimed but not yet used to book
}

// Sample history. Replace with `GET /api/loyalty`.
const SEED: PointsState = {
  vouchers: 0,
  ledger: [
    { id: "p6", kind: "captain-win", title: "Challenge game won", detail: "Winning captain bonus", date: "3 Oct", dateKey: "2026-10-03", points: POINTS_CAPTAIN_WIN },
    { id: "p5", kind: "goods", title: "Extra goods", detail: "Rs. 350 spent (3 x Rs. 100)", date: "3 Oct", dateKey: "2026-10-03", points: pointsForGoods(350) },
    { id: "p4", kind: "game", title: "Game played", detail: "Sat, 26 Sep · Court 1", date: "26 Sep", dateKey: "2026-09-26", points: POINTS_PER_GAME },
    { id: "p3", kind: "free-game", title: "Free game claimed", detail: "Used for booking UF-20260924-00071", date: "24 Sep", dateKey: "2026-09-24", points: -POINTS_PER_FREE_GAME },
    { id: "p2", kind: "game", title: "Game played", detail: "Sat, 19 Sep · Court 2", date: "19 Sep", dateKey: "2026-09-19", points: POINTS_PER_GAME },
    { id: "p1", kind: "game", title: "Earlier games", detail: "21 games before 19 Sep", date: "Before Sep", dateKey: "2026-09-01", points: 21 * POINTS_PER_GAME },
  ],
};

export interface PointsSummary {
  earned: number; // all points ever earned
  claimed: number; // points already turned into free games
  freeGamesClaimed: number;
  remaining: number; // points still in the account
  canClaim: number; // free games the remaining points can still pay for
  toNext: number; // points still needed for the next free game
  progressPct: number; // progress towards the next free game, 0-100
}

export function summarize(ledger: PointsEntry[]): PointsSummary {
  const earned = ledger.filter((e) => e.points > 0).reduce((n, e) => n + e.points, 0);
  const claimed = -ledger.filter((e) => e.points < 0).reduce((n, e) => n + e.points, 0);
  const remaining = Math.max(0, earned - claimed);
  const inProgress = remaining % POINTS_PER_FREE_GAME;
  return {
    earned,
    claimed,
    freeGamesClaimed: Math.round(claimed / POINTS_PER_FREE_GAME),
    remaining,
    canClaim: Math.floor(remaining / POINTS_PER_FREE_GAME),
    toNext: POINTS_PER_FREE_GAME - inProgress,
    progressPct: inProgress,
  };
}

/* ---------- store (browser storage for now) ---------- */

const KEY = "uf-points-v1";
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

// Spend 100 points on a free-game voucher. The voucher books a REGULAR game; it cannot host a challenge.
export function claimFreeGame(): { ok: boolean } {
  const s = load();
  if (summarize(s.ledger).remaining < POINTS_PER_FREE_GAME) return { ok: false };
  commit({
    vouchers: s.vouchers + 1,
    ledger: [{ id: `claim-${Date.now()}`, kind: "free-game", title: "Free game claimed", detail: "Ready to use when you book", points: -POINTS_PER_FREE_GAME, ...today() }, ...s.ledger],
  });
  return { ok: true };
}

// Called when a booking is made with a voucher.
export function spendVoucher(bookingId: string) {
  const s = load();
  if (s.vouchers < 1) return false;
  const at = s.ledger.findIndex((x) => x.kind === "free-game" && x.detail.startsWith("Ready"));
  commit({
    ...s,
    vouchers: s.vouchers - 1,
    ledger: s.ledger.map((e, i) => (i === at ? { ...e, detail: `Used for booking ${bookingId}` } : e)),
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

export function useVouchers(): number {
  return useSyncExternalStore(subscribe, () => load().vouchers, () => 0);
}
