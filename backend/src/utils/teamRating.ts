// Team rules for Captain mode (pure functions): the 5-star rating, ranking and the loser-pays settlement.

export const MAX_TEAM_SIZE = 12; // captain included
export const MIN_TEAM_TO_CHALLENGE = 5;
export const MIN_GAMES_FOR_RATING = 3;
export const LOSER_SHARES = [70, 60, 100] as const;
export type LoserShare = (typeof LOSER_SHARES)[number];
export type FormResult = "W" | "D" | "L";

export interface TeamStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  form: FormResult[]; // oldest first
}

export const emptyStats = (): TeamStats => ({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [] });

// 1.0 to 5.0 stars from APPROVED results only. Score = 55% win rate (draw = half), 25% goal difference per game
// (capped at +-3), 20% form over the last 5, pulled toward the middle for small samples so one lucky streak
// cannot reach 5 stars. Teams with under 3 games are unrated.
export function teamRating(s: TeamStats): number | null {
  if (s.played < MIN_GAMES_FOR_RATING) return null;
  const winRate = (s.wins + 0.5 * s.draws) / s.played;
  const gd = Math.max(-3, Math.min(3, (s.gf - s.ga) / s.played));
  const gdScore = (gd + 3) / 6;
  const recent = s.form.slice(-5);
  const formScore = recent.length ? recent.reduce((a, r) => a + (r === "W" ? 1 : r === "D" ? 0.5 : 0), 0) / recent.length : 0.5;
  const raw = 0.55 * winRate + 0.25 * gdScore + 0.2 * formScore;
  const SHRINK = 5; // virtual average games
  const stable = (raw * s.played + 0.5 * SHRINK) / (s.played + SHRINK);
  const stars = 1 + 4 * Math.max(0, Math.min(1, (stable - 0.2) / 0.6));
  return Math.round(stars * 10) / 10;
}

export interface Rankable {
  id: string;
  stats: TeamStats;
}

// Sorts by rating, then games played, then goal difference. Unrated teams get no rank.
export function rankTeams<T extends Rankable>(teams: T[]): (T & { rating: number | null; rank: number | null })[] {
  const rated = teams
    .map((t) => ({ ...t, rating: teamRating(t.stats) }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.stats.played - a.stats.played || b.stats.gf - b.stats.ga - (a.stats.gf - a.stats.ga));
  let n = 0;
  return rated.map((r) => ({ ...r, rank: r.rating === null ? null : ++n }));
}

export interface Settlement {
  basis: "loser-pays" | "draw-split";
  amountA: number; // what team A (the first score) pays at the venue
  amountB: number;
  loserPct: number; // the loser's share; 50 for a draw
}

// What each team pays at the venue once the result is known. A draw has no loser, so it is split 50/50 (assumption).
// Whole rupees, and the other team takes the remainder so the total is exactly the court price.
export function settlement(courtPrice: number, loserPct: LoserShare, scoreA: number, scoreB: number): Settlement {
  if (scoreA === scoreB) {
    const a = Math.round(courtPrice / 2);
    return { basis: "draw-split", amountA: a, amountB: courtPrice - a, loserPct: 50 };
  }
  const loserPays = Math.round((courtPrice * loserPct) / 100);
  const aLost = scoreA < scoreB;
  return aLost
    ? { basis: "loser-pays", amountA: loserPays, amountB: courtPrice - loserPays, loserPct }
    : { basis: "loser-pays", amountA: courtPrice - loserPays, amountB: loserPays, loserPct };
}

export function addGame(s: TeamStats, goalsFor: number, goalsAgainst: number): TeamStats {
  const r: FormResult = goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";
  return {
    played: s.played + 1,
    wins: s.wins + (r === "W" ? 1 : 0),
    draws: s.draws + (r === "D" ? 1 : 0),
    losses: s.losses + (r === "L" ? 1 : 0),
    gf: s.gf + goalsFor,
    ga: s.ga + goalsAgainst,
    form: [...s.form, r].slice(-10),
  };
}
