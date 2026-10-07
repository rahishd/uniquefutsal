import { prisma } from "../../config/db";
import notificationService from "../notification/notification.service";

export type MatchState = { id: string; home: string | null; away: string | null; status: string; homeScore: number | null; awayScore: number | null; note: string | null };

const teams = (m: MatchState) => `${m.home ?? "TBD"} v ${m.away ?? "TBD"}`;
const score = (m: MatchState) => `${m.home ?? "TBD"} ${m.homeScore ?? 0}-${m.awayScore ?? 0} ${m.away ?? "TBD"}`;

// What a follower should be told about a change to one match. Nothing when nothing they care about changed.
export function describeChange(before: MatchState | null, after: MatchState): { title: string; message: string; key: string } | null {
  const was = before?.status ?? "upcoming";
  const key = `mf-${after.id}-${after.status}-${after.homeScore ?? "x"}-${after.awayScore ?? "x"}`;
  if (after.status === "finished" && was !== "finished") {
    return { title: "Full time", message: `${score(after)}${after.note ? ` (${after.note})` : ""}`, key };
  }
  if (after.status === "live" && was !== "live") {
    return { title: "Kick-off: it is live", message: `${teams(after)} has started${after.homeScore !== null ? `. ${score(after)}` : ""}`, key };
  }
  if (after.status === "live" && (before?.homeScore !== after.homeScore || before?.awayScore !== after.awayScore)) {
    return { title: "Goal!", message: score(after), key };
  }
  return null;
}

// Tells everyone following a match. Never throws: a failed notice must not break saving the tie-sheet.
export async function notifyFollowers(before: MatchState | null, after: MatchState): Promise<number> {
  try {
    const change = describeChange(before, after);
    if (!change) return 0;
    const follows = await prisma.matchFollow.findMany({ where: { matchId: after.id }, select: { userId: true } });
    await Promise.all(follows.map((f) => notificationService.notify({ userId: f.userId, type: "tournament", title: change.title, message: change.message, href: "/tournaments", dedupeKey: `${change.key}-${f.userId}` })));
    return follows.length;
  } catch {
    return 0;
  }
}
