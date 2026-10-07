// The tournament shown on Home and the Tournaments page, from the server (GET /tournaments/current).
// The server returns nothing when no tournament is being hosted (the Home section then hides).
// Team contact details are never part of this public view.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export type MatchStatus = "finished" | "live" | "upcoming";

export interface TieMatch {
  id: string;
  status: MatchStatus;
  home: string | null; // null = to be decided
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
  note: string | null; // e.g. penalties
  startsAt: string | null;
  venue: string | null;
  goals?: TieGoal[]; // in minute order, entered by the venue
}

export interface TieGoal {
  side: "home" | "away";
  minute: number | null;
  scorer: string | null;
}

export interface TieRound {
  id: string;
  name: string;
  matches: TieMatch[];
}

export interface Tournament {
  id: string;
  name: string;
  status: "live" | "upcoming" | "completed";
  startDate: string;
  endDate: string;
  teams: number;
  prizePool: number;
  prizes?: { first?: string; second?: string; third?: string };
  format?: string;
  rounds: TieRound[];
}

export const tournamentStore = createRemoteStore<Tournament | null>(() => api<Tournament | null>("/tournaments/current", { auth: "none" }), { pollMs: 30000 });

export const matchTime = (m: TieMatch) => (m.startsAt ? new Date(m.startsAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

// Matches the signed-in customer follows for live updates (kick-off, goals, full time). Guests follow nothing.
export const followStore = createRemoteStore<string[]>(() => api<string[]>("/tournaments/following"), { signedOut: [], pollMs: 60_000 });

export async function setFollowing(matchId: string, on: boolean): Promise<void> {
  await api(`/tournaments/matches/${matchId}/follow`, { method: on ? "PUT" : "DELETE" });
  followStore.patch((ids) => (on ? [...new Set([...ids, matchId])] : ids.filter((x) => x !== matchId)));
}
