import { Router, Response, Request } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { AuditService } from "../audit";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";

// The customer view of a tournament: scores and the tie-sheet. Registrations (team phone numbers and emails)
// and the venue's costs are never part of this public view.
export async function publicTournament(t: { id: string; name: string; prizePool: number; minTeams: number; maxTeams: number; startDate: string; endDate: string; isActive: boolean; status: string; description: string | null }) {
  const rounds = await prisma.tournamentRound.findMany({ where: { tournamentId: t.id }, orderBy: { position: "asc" }, include: { matches: { orderBy: { startsAt: "asc" } } } });
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
      matches: r.matches.map((m) => ({ id: m.id, status: m.status, home: m.home, away: m.away, homeScore: m.homeScore, awayScore: m.awayScore, note: m.note, startsAt: m.startsAt, venue: m.venue })),
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
    body("rounds.*.matches.*.status").optional().isIn(["upcoming", "live", "finished"]),
    body("rounds.*.matches.*.homeScore").optional({ nullable: true }).isInt({ min: 0, max: 99 }).toInt(),
    body("rounds.*.matches.*.awayScore").optional({ nullable: true }).isInt({ min: 0, max: 99 }).toInt(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const t = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!t) throw new AppError(404, "Tournament not found");
    await prisma.$transaction(async (tx) => {
      await tx.tournamentRound.deleteMany({ where: { tournamentId: t.id } }); // matches cascade
      let position = 0;
      for (const r of req.body.rounds as { name: string; matches: any[] }[]) {
        await tx.tournamentRound.create({
          data: {
            tournamentId: t.id, name: r.name, position: position++,
            matches: {
              create: r.matches.map((m) => ({
                home: m.home ?? null, away: m.away ?? null, status: m.status ?? "upcoming", homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
                note: m.note ?? null, startsAt: m.startsAt ? new Date(m.startsAt) : null, venue: m.venue ?? null,
              })),
            },
          },
        });
      }
    });
    await AuditService.log({ action: "TIESHEET_UPDATE", entity: "Tournament", entityId: t.id, changes: `${req.body.rounds.length} rounds`, userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Tie-sheet saved"));
  }),
);

export default router;
