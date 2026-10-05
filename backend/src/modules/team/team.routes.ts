import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AuditService } from "../audit";
import teamService from "./team.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

/* ---------- /api/teams ---------- */
export const teamRouter = Router();
teamRouter.use(authMiddleware);

// Staff views (declared first so "admin" is never read as a team id)
teamRouter.get("/admin/settlements", ...adminOnly, asyncHandler(async (req, res: Response) => {
  ok(res, "Settlements", await teamService.settlements(typeof req.query.date === "string" ? req.query.date : undefined));
}));

teamRouter.post("/admin/challenges/:id/venue-paid", ...adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await teamService.venuePaid(req.user!.id, req.params.id);
  await AuditService.log({ action: "CHALLENGE_VENUE_PAID", entity: "Challenge", entityId: req.params.id, changes: "Court payment collected at the venue", userId: req.user!.id });
  ok(res, "Payment recorded", r);
}));

teamRouter.post(
  "/admin/results/:id/resolve",
  ...adminOnly,
  [body("action").isIn(["approve", "void"]), body("scoreSubmitter").optional().isInt({ min: 0, max: 50 }).toInt(), body("scoreOther").optional().isInt({ min: 0, max: 50 }).toInt(), body("note").optional().isString().trim()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { action, scoreSubmitter, scoreOther, note } = req.body;
    const scores = scoreSubmitter !== undefined && scoreOther !== undefined ? { scoreSubmitter, scoreOther } : undefined;
    const r = await teamService.resolveDispute(req.user!.id, req.params.id, action, scores, note);
    await AuditService.log({ action: "RESULT_DISPUTE_RESOLVED", entity: "ChallengeResult", entityId: req.params.id, changes: `${action}${scores ? ` ${scores.scoreSubmitter}-${scores.scoreOther}` : ""}${note ? `: ${note}` : ""}`, userId: req.user!.id });
    ok(res, "Dispute resolved", r);
  }),
);

// Create a team (Captain mode)
teamRouter.post("/", [body("name").isString().trim().isLength({ min: 2, max: 30 }).withMessage("Team name must be 2 to 30 characters")], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  const t = await teamService.createTeam(req.user!.id, req.body.name);
  ok(res, "Team created", { id: t.id, name: t.name }, 201);
}));

teamRouter.get("/me", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "My team", await teamService.myTeamView(req.user!.id))));

teamRouter.post("/me/members", [body("phone").isString().notEmpty()], validateRequest, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Player added", await teamService.addMember(req.user!.id, req.body.phone), 201);
}));

teamRouter.delete("/me/members/:userId", asyncHandler(async (req: AuthRequest, res: Response) => {
  await teamService.removeMember(req.user!.id, req.params.userId);
  ok(res, "Player removed");
}));

// Leaderboard and another team's stats: captains only
teamRouter.get("/ranking", asyncHandler(async (req: AuthRequest, res: Response) => {
  await teamService.captainTeam(req.user!.id);
  ok(res, "Ranking", await teamService.ranking());
}));

teamRouter.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  await teamService.captainTeam(req.user!.id);
  ok(res, "Team", await teamService.teamDetail(req.params.id));
}));

/* ---------- /api/challenges ---------- */
export const challengeRouter = Router();
challengeRouter.use(authMiddleware);

challengeRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Challenges", await teamService.myChallenges(req.user!.id))));

challengeRouter.post(
  "/",
  [
    body("teamId").isString().notEmpty(),
    body("type").isIn(["match", "competition"]),
    body("date").matches(/^\d{4}-\d{2}-\d{2}$/),
    body("hour").isInt({ min: 0, max: 23 }).toInt(),
    body("loserPct").isInt().withMessage("Choose who pays").toInt(),
    body("message").optional({ nullable: true }).isString(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const c = await teamService.createChallenge(req.user!.id, req.body);
    ok(res, "Challenge sent", { id: c.id, courtPrice: c.courtPrice, status: c.status }, 201);
  }),
);

challengeRouter.get("/pending", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Pending actions", await teamService.pending(req.user!.id))));
challengeRouter.get("/prompts/did-you-win", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Games to report", await teamService.didYouWin(req.user!.id))));
challengeRouter.post("/:id/prompt-shown", asyncHandler(async (req: AuthRequest, res: Response) => {
  await teamService.markPromptShown(req.user!.id, req.params.id);
  ok(res, "Recorded");
}));

challengeRouter.post("/:id/accept", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Challenge accepted", await teamService.answer(req.user!.id, req.params.id, true))));
challengeRouter.post("/:id/decline", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Challenge declined", await teamService.answer(req.user!.id, req.params.id, false))));
challengeRouter.post("/:id/cancel", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Challenge cancelled", await teamService.cancel(req.user!.id, req.params.id))));

// The winning captain uploads only the overall final score
challengeRouter.post(
  "/:id/result",
  [body("myScore").isInt({ min: 0, max: 50 }).withMessage("Enter whole-number scores.").toInt(), body("theirScore").isInt({ min: 0, max: 50 }).withMessage("Enter whole-number scores.").toInt()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Result uploaded", await teamService.submitResult(req.user!.id, req.params.id, req.body.myScore, req.body.theirScore), 201)),
);

/* ---------- /api/results ---------- */
export const resultRouter = Router();
resultRouter.use(authMiddleware);
resultRouter.post("/:id/approve", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Result approved", await teamService.approve(req.user!.id, req.params.id))));
resultRouter.post("/:id/dispute", asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Result disputed", await teamService.dispute(req.user!.id, req.params.id))));
