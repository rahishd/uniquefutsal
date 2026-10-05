// Captain mode: teams, challenges and results, all on the server (see uniquefutsal-backend/docs/API.md).
//
// The server enforces every rule: only a captain (Captain mode, team of at least 5) can challenge, a team has at most
// 12 players, only the WINNING captain uploads the overall score, the other captain approves it, only approved
// results change records and ratings, and the 5-star rating and the loser-pays split are calculated there.
// This file only fetches, sends actions and turns server errors into messages.

import { api, errorText } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export const MAX_TEAM_SIZE = 12; // captain included (the server enforces it)
export const MIN_GAMES_FOR_RATING = 3; // a team is "Unrated" before this many approved games
export const LOSER_SHARES = [70, 60, 100] as const;
export type LoserShare = (typeof LOSER_SHARES)[number];
export type ChallengeType = "match" | "competition";
export type FormResult = "W" | "D" | "L";

/* ---------- shapes the server returns ---------- */

export interface Record3 {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface RankedTeam {
  id: string;
  name: string;
  area: string;
  players: number;
  record: Record3;
  rating: number | null;
  rank: number | null;
}

export interface TeamDetail {
  id: string;
  name: string;
  area: string;
  players: number;
  rating: number | null;
  rank: number | null;
  record: Record3;
  goalsFor: number;
  goalsAgainst: number;
  form: FormResult[];
}

export interface Member {
  userId: string;
  name: string;
  phone: string;
  position: string;
  isCaptain: boolean;
}

export interface MyTeam extends TeamDetail {
  isCaptain: boolean;
  captainId: string;
  maxPlayers: number;
  members: Member[];
}

export interface GameResult {
  id: string;
  status: "awaiting_approval" | "approved" | "disputed";
  submittedBy: "me" | "them";
  myScore: number;
  theirScore: number;
  myAmount: number; // what my team pays at the venue
  theirAmount: number;
  basis: "loser-pays" | "draw-split";
}

export interface Challenge {
  id: string;
  direction: "in" | "out"; // in = another captain challenged us
  team: { id: string; name: string }; // the other team
  type: ChallengeType;
  date: string;
  hour: number;
  courtPrice: number;
  loserPct: LoserShare;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  bookingId: string | null;
  venuePaidAt: string | null;
  result: GameResult | null;
}

export interface Pending {
  challengesToAnswer: number;
  resultsToApprove: number;
  total: number;
}

export interface TeamsState {
  mode: "player" | "captain";
  team: MyTeam | null;
  challenges: Challenge[];
  pending: Pending;
  prompts: { challengeId: string; date: string; hour: number }[]; // "Did you win?" not yet shown
}

const NO_PENDING: Pending = { challengesToAnswer: 0, resultsToApprove: 0, total: 0 };

export const teamsStore = createRemoteStore<TeamsState | null>(
  async () => {
    const { mode } = await api<{ mode: "player" | "captain" }>("/me/profile");
    if (mode !== "captain") return { mode, team: null, challenges: [], pending: NO_PENDING, prompts: [] };
    const team = await api<MyTeam | null>("/teams/me");
    if (!team) return { mode, team: null, challenges: [], pending: NO_PENDING, prompts: [] };
    const [challenges, pending, prompts] = await Promise.all([
      api<Challenge[]>("/challenges"),
      api<Pending>("/challenges/pending"),
      api<TeamsState["prompts"]>("/challenges/prompts/did-you-win"),
    ]);
    return { mode, team, challenges, pending, prompts };
  },
  { pollMs: 30000, signedOut: null },
);

// undefined while loading; null for a guest
export function useTeams(): TeamsState | null | undefined {
  const s = teamsStore.use();
  return s.status === "idle" || s.status === "loading" ? undefined : (s.data ?? null);
}

export const pendingActions = (s: TeamsState) => s.pending.total;

/* ---------- other teams ---------- */

export const rankingStore = createRemoteStore<RankedTeam[]>(() => api<RankedTeam[]>("/teams/ranking"), { pollMs: 60000 });

export const fetchTeam = (id: string) => api<TeamDetail>(`/teams/${encodeURIComponent(id)}`);

/* ---------- actions: each returns { ok } or { ok: false, error } so the screens can show the message ---------- */

export type ActionResult = { ok: true } | { ok: false; error: string };

async function act(fn: () => Promise<unknown>, reload = true): Promise<ActionResult> {
  try {
    await fn();
    if (reload) await Promise.all([teamsStore.refresh(), rankingStore.refresh()]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
}

export const setMode = (mode: "player" | "captain") => act(() => api("/me/mode", { method: "PUT", body: { mode } }));
export const createTeam = (name: string) => act(() => api("/teams", { method: "POST", body: { name } }));
export const addMember = (phone: string) => act(() => api("/teams/me/members", { method: "POST", body: { phone } }));
export const removeMember = (userId: string) => act(() => api(`/teams/me/members/${encodeURIComponent(userId)}`, { method: "DELETE" }));

export const sendChallenge = (c: { teamId: string; type: ChallengeType; date: string; hour: number; loserPct: LoserShare; message?: string }) =>
  act(() => api("/challenges", { method: "POST", body: c }));
export const answerChallenge = (id: string, accept: boolean) => act(() => api(`/challenges/${encodeURIComponent(id)}/${accept ? "accept" : "decline"}`, { method: "POST" }));
export const cancelChallenge = (id: string) => act(() => api(`/challenges/${encodeURIComponent(id)}/cancel`, { method: "POST" }));

export const submitResult = (r: { challengeId: string; myScore: number; theirScore: number }) =>
  act(() => api(`/challenges/${encodeURIComponent(r.challengeId)}/result`, { method: "POST", body: { myScore: r.myScore, theirScore: r.theirScore } }));
export const approveResult = (resultId: string) => act(() => api(`/results/${encodeURIComponent(resultId)}/approve`, { method: "POST" }));
export const disputeResult = (resultId: string) => act(() => api(`/results/${encodeURIComponent(resultId)}/dispute`, { method: "POST" }));

export const markPromptShown = (challengeId: string) => act(() => api(`/challenges/${encodeURIComponent(challengeId)}/prompt-shown`, { method: "POST" }));

/* ---------- display helpers (the server calculates the real amounts) ---------- */

export function shareLabel(loserPct: LoserShare | number) {
  return loserPct === 100 ? "Loser pays in full" : `Loser pays ${loserPct}%`;
}

export function splitPreview(courtPrice: number, loserPct: number) {
  const loser = Math.round((courtPrice * loserPct) / 100);
  return { loser, winner: courtPrice - loser };
}
