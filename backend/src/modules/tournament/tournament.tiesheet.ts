import { Router, Response, Request } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import authMiddleware, { AuthRequest } from "../../middlewares/auth.middleware";
import { notifyFollowers, type MatchState } from "./matchFollow";
import { AppError } from "../../middlewares/error.middleware";
import { AuditService } from "../audit";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";

// The customer view of a tournament: scores and the tie-sheet. Registrations (team phone numbers and emails)
// and the venue's costs are never part of this public view.
export async function publicTournament(t: { id: string; name: string; prizePool: number; minTeams: number; maxTeams: number; startDate: string; endDate: string; isActive: boolean; status: string; description: string | null }) {
  const rounds = await prisma.tournamentRound.findMany({ where: { tournamentId: t.id }, orderBy: { position: "asc" }, include: { matches: { orderBy: { startsAt: "asc" }, include: { goals: { orderBy: [{ minute: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] } } } } });
  const today = todayKey();
  const status = t.status === "completed" ? "completed" : t.startDate > today ? "upcoming" : "live";
  let prizes: { first?: string; second?: string; third?: string } | undefined;
  let format: string | undefined;
  try {
    const d = JSON.parse(t.description || "{}") as { prizes?: typeof prizes; format?: string };
    prizes = d.prizes;
    format = d.format;
  } catch {
    // description is free text for older tournaments
  }
  return {
    id: t.id, name: t.name, status, startDate: t.startDate, endDate: t.endDate, teams: t.maxTeams, prizePool: t.prizePool, prizes, format,
    rounds: rounds.map((r) => ({
      id: r.id, name: r.name,
      matches: r.matches.map((m) => ({ id: m.id, status: m.status, home: m.home, away: m.away, homeScore: m.homeScore, awayScore: m.awayScore, note: m.note, startsAt: m.startsAt, venue: m.venue,
        goals: m.goals.map((g) => ({ side: g.side, minute: g.minute, scorer: g.scorer })),
      })),
    })),
  };
}

const router = Router();

// The tournament Home shows: the live one, else the next upcoming one, else nothing.
router.get(
  "/current",
  asyncHandler(async (_req: Request, res: Response) => {
    const list = await prisma.tournament.findMany({ where: { isActive: true, status: { not: "completed" } }, orderBy: { startDate: "asc" } });
    const today = todayKey();
    const live = list.find((t) => t.startDate <= today && t.endDate >= today) ?? list.find((t) => t.startDate > today) ?? null;
    res.json(ApiResponseUtil.success(200, "Current tournament", live ? await publicTournament(live) : null));
  }),
);

// Staff: replace the tie-sheet (rounds and matches) in one go, for example after each result
router.put(
  "/:id/tiesheet",
  ...adminOnly,
  [
    body("rounds").isArray({ max: 20 }),
    body("rounds.*.name").isString().trim().notEmpty(),
    body("rounds.*.matches").isArray({ max: 64 }),
    body("rounds.*.matches.*.id").optional({ nullable: true }).isString(),
    body("rounds.*.matches.*.status").optional().isIn(["upcoming", "live", "finished"]),
    body("rounds.*.matches.*.homeScore").optional({ nullable: true }).isInt({ min: 0, max: 99 }).toInt(),
    body("rounds.*.matches.*.awayScore").optional({ nullable: true }).isInt({ min: 0, max: 99 }).toInt(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const t = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!t) throw new AppError(404, "Tournament not found");
    // Saved in place so customers who follow a match keep following it when staff update a score. A match keeps its row when staff send
    // back its id; when a round carries no ids at all, matches are paired by their order in that round. Followers are told about kick-offs,
    // goals and full time.
    const changes: { before: MatchState | null; after: MatchState }[] = [];
    await prisma.$transaction(async (tx) => {
      const old = await tx.tournamentRound.findMany({ where: { tournamentId: t.id }, orderBy: { position: "asc" }, include: { matches: { orderBy: { id: "asc" } } } });
      const owned = new Map(old.flatMap((r) => r.matches).map((x) => [x.id, x]));
      const used = new Set<string>();
      const rounds = req.body.rounds as { name: string; matches: any[] }[];
      for (let ri = 0; ri < rounds.length; ri++) {
        const r = rounds[ri];
        const existing = old[ri];
        const round = existing
          ? await tx.tournamentRound.update({ where: { id: existing.id }, data: { name: r.name, position: ri } })
          : await tx.tournamentRound.create({ data: { tournamentId: t.id, name: r.name, position: ri } });
        for (let mi = 0; mi < r.matches.length; mi++) {
          const m = r.matches[mi];
          const data = {
            home: m.home ?? null, away: m.away ?? null, status: m.status ?? "upcoming", homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
            note: m.note ?? null, startsAt: m.startsAt ? new Date(m.startsAt) : null, venue: m.venue ?? null,
          };
          const byId = r.matches.some((x) => x.id) ? (m.id && owned.has(m.id) && !used.has(m.id) ? owned.get(m.id) : undefined) : existing?.matches[mi];
          const prev = byId && !used.has(byId.id) ? byId : undefined;
          if (prev) used.add(prev.id);
          const saved = prev
            ? await tx.tournamentMatch.update({ where: { id: prev.id }, data: { ...data, roundId: round.id } })
            : await tx.tournamentMatch.create({ data: { ...data, roundId: round.id } });
          changes.push({ before: prev ?? null, after: saved });
        }
      }
      // matches no longer in the sheet are removed (their follows go with them)
      const gone = [...owned.keys()].filter((id) => !used.has(id));
      if (gone.length) await tx.tournamentMatch.deleteMany({ where: { id: { in: gone } } });
      const goneRounds = old.slice(rounds.length);
      if (goneRounds.length) await tx.tournamentRound.deleteMany({ where: { id: { in: goneRounds.map((x) => x.id) } } }); // matches and follows cascade
    });
    for (const c of changes) await notifyFollowers(c.before, c.after);
    await AuditService.log({ action: "TIESHEET_UPDATE", entity: "Tournament", entityId: t.id, changes: `${req.body.rounds.length} rounds`, userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Tie-sheet saved"));
  }),
);

// ---- following a match (signed-in customers) ----
const MAX_FOLLOWS = 20;

// The matches I follow (finished ones drop out: nothing more will happen there)
router.get(
  "/following",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await prisma.matchFollow.findMany({ where: { userId: req.user!.id, match: { status: { not: "finished" } } }, select: { matchId: true } });
    res.set("Cache-Control", "no-store");
    res.json(ApiResponseUtil.success(200, "Following", rows.map((r) => r.matchId)));
  }),
);

router.put(
  "/matches/:id/follow",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const m = await prisma.tournamentMatch.findUnique({ where: { id: req.params.id } });
    if (!m) throw new AppError(404, "Match not found");
    if (m.status === "finished") throw new AppError(409, "This match has finished");
    const already = await prisma.matchFollow.findUnique({ where: { userId_matchId: { userId, matchId: m.id } } });
    if (!already) {
      if ((await prisma.matchFollow.count({ where: { userId, match: { status: { not: "finished" } } } })) >= MAX_FOLLOWS) throw new AppError(409, `You can follow up to ${MAX_FOLLOWS} matches`);
      await prisma.matchFollow.create({ data: { userId, matchId: m.id } });
    }
    res.json(ApiResponseUtil.success(200, "You will get live updates for this match"));
  }),
);

router.delete(
  "/matches/:id/follow",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.matchFollow.deleteMany({ where: { userId: req.user!.id, matchId: req.params.id } });
    res.json(ApiResponseUtil.success(200, "Live updates are off for this match"));
  }),
);

export default router;
