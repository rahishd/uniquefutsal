// Loyalty points rules and sample history.
//
// DEMO DATA. The real server owns the ledger: it adds points when a game is completed or goods are
// bought, and deducts them when a free game is used. Never trust the browser to award points.

export const POINTS_PER_FREE_GAME = 100; // 100 points = 1 free game
export const POINTS_PER_GAME = 10; // every completed game
export const POINTS_CAPTAIN_WIN = 5; // the winning captain of a challenge game earns 5 instead of 10
export const GOODS_STEP_RS = 100; // every full Rs. 100 of extra goods...
export const POINTS_PER_GOODS_STEP = 5; // ...earns 5 points

export type PointsKind = "game" | "captain-win" | "goods" | "free-game";

export interface PointsEntry {
  id: string;
  kind: PointsKind;
  title: string;
  detail: string;
  date: string;
  dateKey: string; // YYYY-MM-DD, used for sorting
  points: number; // positive = earned, negative = used for a free game
}

export function pointsForGoods(amountRs: number) {
  return Math.floor(Math.max(0, amountRs) / GOODS_STEP_RS) * POINTS_PER_GOODS_STEP;
}

// Sample history, newest first. Replace with `GET /api/loyalty/ledger`.
export const sampleLedger: PointsEntry[] = [
  { id: "p6", kind: "captain-win", title: "Challenge game won", detail: "Winning captain bonus", date: "3 Oct", dateKey: "2026-10-03", points: POINTS_CAPTAIN_WIN },
  { id: "p5", kind: "goods", title: "Extra goods", detail: "Rs. 350 spent (3 x Rs. 100)", date: "3 Oct", dateKey: "2026-10-03", points: pointsForGoods(350) },
  { id: "p4", kind: "game", title: "Game played", detail: "Sat, 26 Sep · Court 1", date: "26 Sep", dateKey: "2026-09-26", points: POINTS_PER_GAME },
  { id: "p3", kind: "free-game", title: "Free game used", detail: "Booking UF-20260924-00071", date: "24 Sep", dateKey: "2026-09-24", points: -POINTS_PER_FREE_GAME },
  { id: "p2", kind: "game", title: "Game played", detail: "Sat, 19 Sep · Court 2", date: "19 Sep", dateKey: "2026-09-19", points: POINTS_PER_GAME },
  { id: "p1", kind: "game", title: "Earlier games", detail: "21 games before 19 Sep", date: "Before Sep", dateKey: "2026-09-01", points: 21 * POINTS_PER_GAME },
];

export interface PointsSummary {
  earned: number; // all points ever earned
  claimed: number; // points already turned into free games
  freeGamesClaimed: number;
  remaining: number; // points still in the account
  freeGamesReady: number; // free games the remaining points can pay for
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
    freeGamesReady: Math.floor(remaining / POINTS_PER_FREE_GAME),
    toNext: POINTS_PER_FREE_GAME - inProgress,
    progressPct: inProgress,
  };
}
