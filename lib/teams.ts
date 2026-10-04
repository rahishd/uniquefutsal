// Captain mode, teams, challenges, match results and the 5-star team rating.
//
// DEMO IMPLEMENTATION. Teams, players and the "other captain" are sample data kept in the browser
// (localStorage). In production everything here is server-side: team membership, who may challenge,
// challenge delivery to the opposing captain, result submission/approval, and the rating. The server
// must also enforce: only a captain challenges, max 12 members, only the winner (or either side
// after a draw) submits a result, and only the OTHER captain can approve it.

import { useSyncExternalStore } from "react";
import { MAX_ADVANCE_DAYS, dateKey } from "@/lib/booking";
import { addNotice } from "@/lib/notifications";

export const MAX_TEAM_SIZE = 12; // captain included
export const MIN_GAMES_FOR_RATING = 3;

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type FormResult = "W" | "D" | "L";

export interface PlayerStats {
  games: number;
  goals: number;
  assists: number;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  position: Position;
  stats: PlayerStats; // only goals confirmed by the opposing captain are ever counted here
}

export interface TeamStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  form: FormResult[]; // oldest first
}

export interface Team {
  id: string;
  name: string;
  captainId: string;
  area: string;
  members: Member[];
  stats: TeamStats;
}

/* ---------- 5-star rating ---------- */

// Stars (1.0 to 5.0) from approved results only. Teams with fewer than MIN_GAMES_FOR_RATING games
// are unrated. The score blends win rate, goal difference per game and recent form, and is pulled
// toward the middle for small samples so a lucky 3-game streak cannot reach 5 stars.
export function teamRating(s: TeamStats): number | null {
  if (s.played < MIN_GAMES_FOR_RATING) return null;
  const winRate = (s.wins + 0.5 * s.draws) / s.played; // 0..1
  const gd = Math.max(-3, Math.min(3, (s.gf - s.ga) / s.played));
  const gdScore = (gd + 3) / 6; // 0..1
  const recent = s.form.slice(-5);
  const formScore = recent.length ? recent.reduce((a, r) => a + (r === "W" ? 1 : r === "D" ? 0.5 : 0), 0) / recent.length : 0.5;
  const raw = 0.55 * winRate + 0.25 * gdScore + 0.2 * formScore;
  const SHRINK = 5; // virtual average games
  const stable = (raw * s.played + 0.5 * SHRINK) / (s.played + SHRINK);
  // Map 0.2..0.8 onto 1..5 stars: a strong, long record reaches 5; an average team sits near 3.
  const stars = 1 + 4 * Math.max(0, Math.min(1, (stable - 0.2) / 0.6));
  return Math.round(stars * 10) / 10;
}

export interface RankedTeam {
  team: Team;
  rating: number | null;
  rank: number | null; // null when unrated
}

export function rankTeams(teams: Team[]): RankedTeam[] {
  const rated = teams
    .map((t) => ({ team: t, rating: teamRating(t.stats) }))
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        b.team.stats.played - a.team.stats.played ||
        b.team.stats.gf - b.team.stats.ga - (a.team.stats.gf - a.team.stats.ga),
    );
  let n = 0;
  return rated.map((r) => ({ ...r, rank: r.rating === null ? null : ++n }));
}

/* ---------- sample data ---------- */


function build(
  id: string,
  name: string,
  area: string,
  record: [number, number, number],
  gf: number,
  ga: number,
  form: FormResult[],
  players: [string, Position][],
  phoneBase: number,
): Team {
  const [wins, draws, losses] = record;
  const played = wins + draws + losses;
  // Goals and assists follow the position: forwards score most, midfielders create, keepers rarely do either.
  const goalW = players.map(([, pos], i) => ({ FWD: 1, MID: 0.55, DEF: 0.18, GK: 0.02 })[pos] * (1 - i * 0.04));
  const assistW = players.map(([, pos], i) => ({ MID: 1, FWD: 0.7, DEF: 0.3, GK: 0.06 })[pos] * (1 - i * 0.04));
  const gsum = goalW.reduce((a, b) => a + b, 0);
  const asum = assistW.reduce((a, b) => a + b, 0);
  return {
    id,
    name,
    area,
    captainId: `${id}-m1`,
    stats: { played, wins, draws, losses, gf, ga, form },
    members: players.map(([pname, position], i) => ({
      id: `${id}-m${i + 1}`,
      name: pname,
      phone: String(phoneBase + i),
      position,
      stats: {
        games: Math.max(0, played - (i % 3)),
        goals: Math.round((gf * goalW[i]) / gsum),
        assists: Math.round((gf * 0.65 * assistW[i]) / asum),
      },
    })),
  };
}

export const SAMPLE_TEAMS: Team[] = [
  build("alpha", "Team Alpha", "Tilottama", [8, 2, 2], 52, 28, ["W", "W", "D", "W", "W"], [["Bikash Thapa", "FWD"], ["Sandesh Rana", "MID"], ["Anil Gurung", "FWD"], ["Prabin KC", "DEF"], ["Suman Oli", "MID"], ["Rohan Adhikari", "GK"]], 9801000001),
  build("storm", "Storm FC", "Butwal", [7, 3, 4], 44, 35, ["W", "L", "W", "W", "D"], [["Kiran Shrestha", "FWD"], ["Ashish Pun", "MID"], ["Nabin Bhandari", "DEF"], ["Dipesh Karki", "FWD"], ["Rajan Poudel", "GK"]], 9802000001),
  build("red", "Red Devils", "Bhairahawa", [6, 1, 3], 38, 25, ["W", "W", "L", "W", "W"], [["Sagar Basnet", "FWD"], ["Umesh Chaudhary", "MID"], ["Bishal Tharu", "DEF"], ["Pawan Sharma", "FWD"], ["Hari Khadka", "GK"], ["Roshan Bista", "MID"], ["Manoj Dahal", "DEF"]], 9803000001),
  build("blue", "Blue Eagles", "Tilottama", [4, 2, 3], 30, 27, ["L", "W", "D", "L", "W"], [["Santosh Giri", "MID"], ["Dhiraj Yadav", "FWD"], ["Binod Magar", "DEF"], ["Kamal Joshi", "GK"], ["Ritesh Gupta", "FWD"]], 9804000001),
  build("iron", "Iron Wolves", "Butwal", [3, 2, 6], 27, 40, ["L", "L", "W", "L", "D"], [["Nirajan Acharya", "DEF"], ["Saroj Ale", "MID"], ["Tek Bahadur", "FWD"], ["Laxman Khatri", "GK"], ["Deepak Rawal", "MID"]], 9805000001),
  build("neon", "Neon Kings", "Siddharthanagar", [1, 0, 1], 6, 5, ["W", "L"], [["Yubraj Nepali", "FWD"], ["Amit Mishra", "MID"], ["Sujan Lamsal", "DEF"], ["Prem Tamang", "GK"], ["Ganesh Rai", "MID"]], 9806000001),
];

// Registered players with no team yet. The captain can add them by mobile number.
export const FREE_AGENTS: Member[] = [
  { id: "fa1", name: "Aayush Ghimire", phone: "9811000001", position: "MID", stats: { games: 6, goals: 3, assists: 4 } },
  { id: "fa2", name: "Bibek Sapkota", phone: "9811000002", position: "FWD", stats: { games: 9, goals: 11, assists: 2 } },
  { id: "fa3", name: "Chirag Neupane", phone: "9811000003", position: "DEF", stats: { games: 4, goals: 0, assists: 1 } },
  { id: "fa4", name: "Dinesh Subedi", phone: "9811000004", position: "GK", stats: { games: 7, goals: 0, assists: 0 } },
  { id: "fa5", name: "Elish Maharjan", phone: "9811000005", position: "MID", stats: { games: 5, goals: 2, assists: 5 } },
  { id: "fa6", name: "Fanindra Baral", phone: "9811000006", position: "FWD", stats: { games: 3, goals: 4, assists: 0 } },
  { id: "fa7", name: "Gaurav Thakuri", phone: "9811000007", position: "DEF", stats: { games: 8, goals: 1, assists: 1 } },
  { id: "fa8", name: "Hemant Pathak", phone: "9811000008", position: "MID", stats: { games: 2, goals: 1, assists: 1 } },
  { id: "fa9", name: "Ishan Regmi", phone: "9811000009", position: "FWD", stats: { games: 6, goals: 5, assists: 3 } },
  { id: "fa10", name: "Jeevan Koirala", phone: "9811000010", position: "DEF", stats: { games: 5, goals: 0, assists: 2 } },
  { id: "fa11", name: "Kushal Bhusal", phone: "9811000011", position: "MID", stats: { games: 4, goals: 2, assists: 3 } },
];

/* ---------- challenges and results ---------- */

export type ChallengeType = "match" | "competition";
export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";

// Who pays for the court. The LOSING team pays the larger share: 70/30 or 60/40 (loser/winner),
// or all of it (100/0). Challenge games are paid at the venue only; there is no online payment.
export type LoserShare = 100 | 70 | 60;
export const LOSER_SHARES: LoserShare[] = [70, 60, 100];

export interface Challenge {
  id: string;
  direction: "in" | "out"; // in = another captain challenged us
  teamId: string; // the other team
  type: ChallengeType;
  date: string; // YYYY-MM-DD
  hour: number;
  loserPct: LoserShare;
  message?: string;
  status: ChallengeStatus;
}

export interface Settlement {
  basis: "loser-pays" | "draw-split";
  myAmount: number;
  theirAmount: number;
  loserPct: number; // the loser's share; 50 for a draw
}

// What each team pays at the venue once the result is known. A draw has no loser, so it is split
// equally. Rounded to whole rupees; the other team takes the remainder so the total is exact.
export function settlement(courtPrice: number, loserPct: LoserShare, myScore: number, theirScore: number): Settlement {
  if (myScore === theirScore) {
    const mine = Math.round(courtPrice / 2);
    return { basis: "draw-split", myAmount: mine, theirAmount: courtPrice - mine, loserPct: 50 };
  }
  const loserPays = Math.round((courtPrice * loserPct) / 100);
  const iLost = myScore < theirScore;
  return { basis: "loser-pays", myAmount: iLost ? loserPays : courtPrice - loserPays, theirAmount: iLost ? courtPrice - loserPays : loserPays, loserPct };
}

// Short names for the options, used on cards and results.
export function shareLabel(pct: number) {
  return pct === 100 ? "Loser pays in full" : `Loser pays ${pct}%`;
}

// Amounts shown before a result exists: what the loser and the winner would each pay.
export function splitPreview(courtPrice: number, loserPct: LoserShare) {
  const loser = Math.round((courtPrice * loserPct) / 100);
  return { loser, winner: courtPrice - loser };
}

export type ResultStatus = "awaiting_approval" | "approved" | "disputed";

export interface Result {
  id: string;
  challengeId: string;
  teamId: string; // the other team
  submittedBy: "me" | "them";
  myScore: number;
  theirScore: number;
  // goals/assists of the SUBMITTING side's players, by member id
  scorers: Record<string, { goals: number; assists: number }>;
  status: ResultStatus;
}

interface Overlay {
  stats: TeamStats;
  scorers: Record<string, { goals: number; assists: number; games: number }>;
}

interface State {
  mode: "player" | "captain";
  team: Team | null; // my team, once I have created one
  challenges: Challenge[];
  results: Result[];
  overlay: Record<string, Overlay>; // changes to sample teams from approved results
}

const KEY = "uf-teams-v1";
const EMPTY: State = { mode: "player", team: null, challenges: [], results: [], overlay: {} };

let cache: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? ({ ...EMPTY, ...(JSON.parse(raw) as State) }) : EMPTY;
    // Challenges saved before the cost split existed get the 70/30 default.
    cache = { ...parsed, challenges: parsed.challenges.map((c) => ({ ...c, loserPct: c.loserPct ?? 70 })) };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function commit(next: State) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: state lives in memory for this session
  }
  listeners.forEach((l) => l());
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

// undefined until the page has loaded on the client
export function useTeams(): State | undefined {
  return useSyncExternalStore<State | undefined>(subscribe, load, () => undefined);
}

/* ---------- reading (sample teams merged with approved results) ---------- */

export function getOtherTeam(state: State, id: string): Team | undefined {
  const base = SAMPLE_TEAMS.find((t) => t.id === id);
  if (!base) return undefined;
  const o = state.overlay[id];
  if (!o) return base;
  return {
    ...base,
    stats: o.stats,
    members: base.members.map((m) => {
      const s = o.scorers[m.id];
      return s ? { ...m, stats: { games: m.stats.games + s.games, goals: m.stats.goals + s.goals, assists: m.stats.assists + s.assists } } : m;
    }),
  };
}

export function allTeams(state: State): Team[] {
  const others = SAMPLE_TEAMS.map((t) => getOtherTeam(state, t.id)!);
  return state.team ? [state.team, ...others] : others;
}

export function findPlayerByPhone(state: State, phone: string): { member: Member; teamName?: string } | null {
  for (const t of allTeams(state)) {
    const m = t.members.find((x) => x.phone === phone);
    if (m) return { member: m, teamName: t.name };
  }
  const free = FREE_AGENTS.find((f) => f.phone === phone);
  return free ? { member: free } : null;
}

export function pendingActions(state: State): number {
  const needResponse = state.challenges.filter((c) => c.direction === "in" && c.status === "pending").length;
  const needApproval = state.results.filter((r) => r.submittedBy === "them" && r.status === "awaiting_approval").length;
  return needResponse + needApproval;
}

/* ---------- actions ---------- */

export function setMode(mode: "player" | "captain") {
  commit({ ...load(), mode });
}

function addDays(base: Date, days: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return dateKey(d);
}

// Creating a team switches the captain profile on. A few sample opponent actions are added so
// the whole flow can be tried: an incoming challenge, a played game awaiting your score upload,
// and a result the other captain reported that you must approve.
export function createTeam(name: string, captain: { id: string; name: string; phone: string }) {
  const s = load();
  const clean = name.trim();
  if (s.team || clean.length < 2) return;
  const now = new Date();
  const team: Team = {
    id: "me",
    name: clean,
    captainId: captain.id,
    area: "Tilottama",
    members: [{ id: captain.id, name: captain.name, phone: captain.phone, position: "MID", stats: { games: 0, goals: 0, assists: 0 } }],
    stats: { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [] },
  };
  const challenges: Challenge[] = [
    { id: "ch-alpha", direction: "in", teamId: "alpha", type: "competition", date: addDays(now, 3), hour: 19, loserPct: 70, message: "Friendly before the league? Let's play!", status: "pending" },
    { id: "ch-red", direction: "out", teamId: "red", type: "match", date: addDays(now, -1), hour: 18, loserPct: 60, status: "accepted" },
    { id: "ch-storm", direction: "in", teamId: "storm", type: "match", date: addDays(now, -2), hour: 20, loserPct: 70, status: "accepted" },
  ];
  const storm = SAMPLE_TEAMS.find((t) => t.id === "storm")!;
  const results: Result[] = [
    {
      id: "res-storm",
      challengeId: "ch-storm",
      teamId: "storm",
      submittedBy: "them",
      myScore: 4,
      theirScore: 6,
      scorers: {
        [storm.members[0].id]: { goals: 3, assists: 1 },
        [storm.members[3].id]: { goals: 2, assists: 2 },
        [storm.members[1].id]: { goals: 1, assists: 2 },
      },
      status: "awaiting_approval",
    },
  ];
  commit({ ...s, team, mode: "captain", challenges, results });
  addNotice({ id: "ch-alpha-notice", type: "challenge", title: "New challenge", body: "Team Alpha challenged your team to a competition match. Loser pays 70%, paid at the venue.", href: "/opponent" });
  addNotice({ id: "res-storm-notice", type: "match", title: "Result awaiting your approval", body: "Storm FC reported a 6–4 win over your team. Approve or dispute it.", href: "/opponent" });
}

export function renameTeam(name: string) {
  const s = load();
  const clean = name.trim();
  if (!s.team || clean.length < 2) return;
  commit({ ...s, team: { ...s.team, name: clean } });
}

export type AddResult = { ok: true; member: Member } | { ok: false; error: string };

export function addMember(rawPhone: string): AddResult {
  const s = load();
  const phone = rawPhone.replace(/\D/g, "");
  if (!s.team) return { ok: false, error: "Create your team first." };
  if (s.team.members.length >= MAX_TEAM_SIZE) return { ok: false, error: `Your team is full (${MAX_TEAM_SIZE} members).` };
  if (!/^9\d{9}$/.test(phone)) return { ok: false, error: "Enter a 10-digit mobile number starting with 9." };
  if (s.team.members.some((m) => m.phone === phone)) return { ok: false, error: "This player is already in your team." };
  const found = findPlayerByPhone(s, phone);
  if (!found) return { ok: false, error: "No registered player has this number. Ask them to sign up first." };
  if (found.teamName) return { ok: false, error: `${found.member.name} is already in ${found.teamName}.` };
  const member = { ...found.member };
  commit({ ...s, team: { ...s.team, members: [...s.team.members, member] } });
  return { ok: true, member };
}

export function removeMember(id: string) {
  const s = load();
  if (!s.team || id === s.team.captainId) return; // the captain cannot be removed
  commit({ ...s, team: { ...s.team, members: s.team.members.filter((m) => m.id !== id) } });
}

export interface ChallengeInput {
  teamId: string;
  type: ChallengeType;
  date: string;
  hour: number;
  loserPct: LoserShare;
  message?: string;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export function sendChallenge(input: ChallengeInput): ActionResult {
  const s = load();
  if (s.mode !== "captain" || !s.team) return { ok: false, error: "Only a captain can challenge another team." };
  if (input.teamId === s.team.id) return { ok: false, error: "You cannot challenge your own team." };
  if (s.team.members.length < 5) return { ok: false, error: "Add at least 5 players to your team before challenging." };
  if (s.challenges.some((c) => c.teamId === input.teamId && c.status === "pending" && c.direction === "out")) {
    return { ok: false, error: "You already have a pending challenge to this team." };
  }
  const last = addDays(new Date(), MAX_ADVANCE_DAYS);
  if (!LOSER_SHARES.includes(input.loserPct)) return { ok: false, error: "Choose who pays: the losing team pays 70%, 60% or all of it." };
  if (input.date < dateKey(new Date()) || input.date > last) return { ok: false, error: `Pick a date within the next ${MAX_ADVANCE_DAYS} days.` };
  const c: Challenge = { id: `ch-${Date.now()}`, direction: "out", status: "pending", ...input, message: input.message?.trim().slice(0, 140) || undefined };
  commit({ ...s, challenges: [c, ...s.challenges] });
  return { ok: true };
}

function setChallengeStatus(id: string, status: ChallengeStatus) {
  const s = load();
  commit({ ...s, challenges: s.challenges.map((c) => (c.id === id ? { ...c, status } : c)) });
}

// I answer a challenge another captain sent me.
export function answerChallenge(id: string, accept: boolean) {
  setChallengeStatus(id, accept ? "accepted" : "declined");
}

export function cancelChallenge(id: string) {
  setChallengeStatus(id, "cancelled");
}

// DEMO ONLY: stands in for the other captain answering my challenge on their own phone.
export function demoOpponentAnswers(id: string, accept: boolean) {
  const s = load();
  const c = s.challenges.find((x) => x.id === id);
  if (!c) return;
  setChallengeStatus(id, accept ? "accepted" : "declined");
  const team = getOtherTeam(s, c.teamId);
  addNotice({
    id: `answer-${id}`,
    type: "challenge",
    title: accept ? "Challenge accepted" : "Challenge declined",
    body: `${team?.name ?? "The other team"} ${accept ? "accepted" : "declined"} your challenge.`,
    href: "/opponent",
  });
}

export interface ResultInput {
  challengeId: string;
  myScore: number;
  theirScore: number;
  scorers: Record<string, { goals: number; assists: number }>;
}

export function submitResult(input: ResultInput): ActionResult {
  const s = load();
  const c = s.challenges.find((x) => x.id === input.challengeId);
  if (!s.team || !c || c.status !== "accepted") return { ok: false, error: "This game can't be reported." };
  if (s.results.some((r) => r.challengeId === c.id && r.status !== "disputed")) return { ok: false, error: "A result has already been uploaded for this game." };
  const { myScore, theirScore } = input;
  if (!Number.isInteger(myScore) || !Number.isInteger(theirScore) || myScore < 0 || theirScore < 0 || myScore > 50 || theirScore > 50) {
    return { ok: false, error: "Enter whole-number scores." };
  }
  if (myScore < theirScore) return { ok: false, error: "Only the winning captain uploads the score. Ask the other captain to upload it." };
  const goals = Object.values(input.scorers).reduce((a, x) => a + x.goals, 0);
  if (goals !== myScore) return { ok: false, error: `Player goals add up to ${goals}, but your team scored ${myScore}. They must match.` };
  const r: Result = { id: `res-${Date.now()}`, challengeId: c.id, teamId: c.teamId, submittedBy: "me", myScore, theirScore, scorers: input.scorers, status: "awaiting_approval" };
  commit({ ...s, results: [r, ...s.results.filter((x) => x.challengeId !== c.id)] });
  return { ok: true };
}

// Applies an APPROVED result: team records, rating inputs and player stats become public.
function apply(s: State, r: Result): State {
  if (!s.team) return s;
  const mine = s.team.stats;
  const outcome: FormResult = r.myScore > r.theirScore ? "W" : r.myScore < r.theirScore ? "L" : "D";
  const myStats: TeamStats = {
    played: mine.played + 1,
    wins: mine.wins + (outcome === "W" ? 1 : 0),
    draws: mine.draws + (outcome === "D" ? 1 : 0),
    losses: mine.losses + (outcome === "L" ? 1 : 0),
    gf: mine.gf + r.myScore,
    ga: mine.ga + r.theirScore,
    form: [...mine.form, outcome].slice(-10),
  };
  let members = s.team.members;
  const overlay = { ...s.overlay };
  const theirOutcome: FormResult = outcome === "W" ? "L" : outcome === "L" ? "W" : "D";
  const base = overlay[r.teamId]?.stats ?? SAMPLE_TEAMS.find((t) => t.id === r.teamId)?.stats;
  if (base) {
    const prevScorers = overlay[r.teamId]?.scorers ?? {};
    const scorers = { ...prevScorers };
    if (r.submittedBy === "them") {
      for (const [id, v] of Object.entries(r.scorers)) {
        const p = scorers[id] ?? { goals: 0, assists: 0, games: 0 };
        scorers[id] = { goals: p.goals + v.goals, assists: p.assists + v.assists, games: p.games + 1 };
      }
    }
    overlay[r.teamId] = {
      scorers,
      stats: {
        played: base.played + 1,
        wins: base.wins + (theirOutcome === "W" ? 1 : 0),
        draws: base.draws + (theirOutcome === "D" ? 1 : 0),
        losses: base.losses + (theirOutcome === "L" ? 1 : 0),
        gf: base.gf + r.theirScore,
        ga: base.ga + r.myScore,
        form: [...base.form, theirOutcome].slice(-10),
      },
    };
  }
  if (r.submittedBy === "me") {
    members = members.map((m) => {
      const v = r.scorers[m.id];
      return { ...m, stats: { games: m.stats.games + 1, goals: m.stats.goals + (v?.goals ?? 0), assists: m.stats.assists + (v?.assists ?? 0) } };
    });
  }
  return { ...s, team: { ...s.team, stats: myStats, members }, overlay };
}

function setResultStatus(id: string, status: ResultStatus) {
  const s = load();
  const r = s.results.find((x) => x.id === id);
  if (!r || r.status !== "awaiting_approval") return;
  const updated = { ...s, results: s.results.map((x) => (x.id === id ? { ...x, status } : x)) };
  commit(status === "approved" ? apply(updated, r) : updated);
}

// I (the losing captain) approve a result the other captain uploaded.
export function approveResult(id: string) {
  setResultStatus(id, "approved");
  addNotice({ id: `approved-${id}`, type: "match", title: "Result approved", body: "The result is confirmed and team stats are updated.", href: "/opponent" });
}

// I dispute it. An admin would review disputed results (admin panel not built yet).
export function disputeResult(id: string) {
  setResultStatus(id, "disputed");
  addNotice({ id: `disputed-${id}`, type: "match", title: "Result disputed", body: "You disputed this result. It will be reviewed and no stats were changed.", href: "/opponent" });
}

// DEMO ONLY: stands in for the other captain approving the result I uploaded.
export function demoOpponentApproves(id: string) {
  setResultStatus(id, "approved");
  addNotice({ id: `approved-${id}`, type: "match", title: "Your result was approved", body: "The other captain confirmed it. Your team and player stats are updated.", href: "/opponent" });
}

export function resetDemo() {
  commit({ ...EMPTY });
}
