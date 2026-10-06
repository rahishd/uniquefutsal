import { Router, Response } from "express";
import { body, query } from "express-validator";
import gamezoneController from "./gamezone.controller";
import gamezoneCustomerService from "./gamezone.customer.service";
import adminOnly from "../../middlewares/admin.middleware";
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AppError } from "../../middlewares/error.middleware";
import { AuditService } from "../audit";
import { prisma } from "../../config/db";
import { startsAtMs } from "../../utils/dates";

const router = Router();

/* ---------------- customer app ---------------- */

// Consoles, games, plans and rules
router.get(
  "/catalog",
  asyncHandler(async (_req, res: Response) => {
    res.json(ApiResponseUtil.success(200, "Gamezone catalog", await gamezoneCustomerService.catalog()));
  }),
);

// Free start hours for ONE console (each console has its own bookings)
router.get(
  "/slots",
  [
    query("date").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Date must be in YYYY-MM-DD format"),
    query("hours").isInt({ min: 1, max: 4 }).withMessage("Hours must be 1 to 4").toInt(),
    query("consoleId").isString().notEmpty().withMessage("Choose a console"),
  ],
  validateRequest,
  asyncHandler(async (req, res: Response) => {
    await gamezoneCustomerService.ensureDefaults();
    const hours = await gamezoneCustomerService.slots(String(req.query.date), Number(req.query.hours), String(req.query.consoleId));
    res.json(ApiResponseUtil.success(200, "Free start times", { hours }));
  }),
);

// Book a PS5 session (guests pay online in full, registered customers may pay at the venue)
router.post(
  "/bookings",
  optionalAuthMiddleware,
  [
    body("date").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Date must be in YYYY-MM-DD format"),
    body("hour").isInt({ min: 0, max: 23 }).toInt(),
    body("hours").isInt({ min: 1, max: 4 }).withMessage("Hours must be 1 to 4").toInt(),
    body("players").isInt({ min: 1, max: 4 }).toInt(),
    body("consoleId").isString().notEmpty(),
    body("game").isString().notEmpty().withMessage("Choose a game"),
    body("method").isIn(["fonepay", "venue"]).withMessage("Choose Fonepay or Pay at venue"),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const staff = Boolean(req.user && req.user.role !== "user");
    if (staff) throw new AppError(403, "Staff create bookings from the admin panel");
    const b = req.body;
    const result = await gamezoneCustomerService.checkout(
      { date: b.date, hour: b.hour, hours: b.hours, players: b.players, consoleId: b.consoleId, gameTitle: b.game, method: b.method, guest: b.guest },
      req.user?.id,
    );
    res.status(201).json(ApiResponseUtil.success(201, "Gamezone booked", result));
  }),
);

router.get(
  "/bookings/me",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(ApiResponseUtil.success(200, "Gamezone bookings", await gamezoneCustomerService.mine(req.user!.id)));
  }),
);

router.post(
  "/bookings/:code/cancel",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(ApiResponseUtil.success(200, "Booking cancelled", await gamezoneCustomerService.cancel(req.params.code, req.user!.id)));
  }),
);

// "I'm coming" for a Gamezone session (same window as court bookings: 1 hour before to 30 minutes after the start)
router.post(
  "/bookings/:code/arrival",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const b = await prisma.gzBooking.findUnique({ where: { code: req.params.code } });
    if (!b || b.userId !== req.user!.id) throw new AppError(404, "Booking not found");
    if (b.status !== "confirmed") throw new AppError(409, "This booking is not active");
    const start = startsAtMs(b.date, b.startHour);
    const now = Date.now();
    if (now < start - 3600000) throw new AppError(409, "Check-in opens 1 hour before your session");
    if (now > start + 1800000) throw new AppError(409, "Check-in has closed for this session");
    const row = await prisma.arrivalCheckin.upsert({ where: { refId: b.code }, update: {}, create: { refId: b.code, userId: req.user!.id } });
    res.json(ApiResponseUtil.success(200, "The venue knows you are coming", { confirmedAt: row.confirmedAt }));
  }),
);

/* ---------------- staff ---------------- */

router.get(
  "/admin/bookings",
  ...adminOnly,
  asyncHandler(async (req, res: Response) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const rows = await prisma.gzBooking.findMany({ where: date ? { date } : {}, orderBy: [{ date: "desc" }, { startHour: "asc" }], take: 500 });
    res.json(ApiResponseUtil.success(200, "Gamezone bookings", rows));
  }),
);

router.post(
  "/admin/bookings/:code/mark-paid",
  ...adminOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const r = await gamezoneCustomerService.markPaid(req.params.code);
    await AuditService.log({ action: "GZ_MARK_PAID", entity: "GzBooking", entityId: req.params.code, changes: "Marked paid at the venue", userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Payment recorded", r));
  }),
);

// Games, consoles and per-person rates are staff-managed data
router.post(
  "/admin/games",
  ...adminOnly,
  [body("title").isString().trim().isLength({ min: 2, max: 60 })],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const g = await prisma.gzGame.upsert({ where: { title: req.body.title }, update: { active: true }, create: { title: req.body.title } });
    await AuditService.log({ action: "GZ_GAME_ADD", entity: "GzGame", entityId: g.id, changes: g.title, userId: req.user!.id });
    res.status(201).json(ApiResponseUtil.success(201, "Game added", g));
  }),
);

router.patch(
  "/admin/games/:id",
  ...adminOnly,
  [body("active").isBoolean().toBoolean()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const g = await prisma.gzGame.update({ where: { id: req.params.id }, data: { active: req.body.active } });
    await AuditService.log({ action: "GZ_GAME_UPDATE", entity: "GzGame", entityId: g.id, changes: `active=${g.active}`, userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Game updated", g));
  }),
);

router.post(
  "/admin/consoles",
  ...adminOnly,
  [body("name").isString().trim().isLength({ min: 2, max: 60 })],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const c = await prisma.gzConsole.upsert({ where: { name: req.body.name }, update: { active: true }, create: { name: req.body.name } });
    await AuditService.log({ action: "GZ_CONSOLE_ADD", entity: "GzConsole", entityId: c.id, changes: c.name, userId: req.user!.id });
    res.status(201).json(ApiResponseUtil.success(201, "Console added", c));
  }),
);

router.patch(
  "/admin/consoles/:id",
  ...adminOnly,
  [body("active").isBoolean().toBoolean()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const c = await prisma.gzConsole.update({ where: { id: req.params.id }, data: { active: req.body.active } });
    await AuditService.log({ action: "GZ_CONSOLE_UPDATE", entity: "GzConsole", entityId: c.id, changes: `active=${c.active}`, userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Console updated", c));
  }),
);

router.put(
  "/admin/plans/:players",
  ...adminOnly,
  [body("ratePerPersonHour").isInt({ min: 1 }).toInt(), body("label").optional().isString().trim()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const players = parseInt(req.params.players, 10);
    if (![1, 2, 4].includes(players)) throw new AppError(400, "Plans are for 1, 2 or 4 players");
    const label = req.body.label || (players === 1 ? "Solo" : `${players} Players`);
    const p = await prisma.gzPlan.upsert({ where: { players }, update: { ratePerPersonHour: req.body.ratePerPersonHour, label }, create: { players, label, ratePerPersonHour: req.body.ratePerPersonHour } });
    await AuditService.log({ action: "GZ_PLAN_UPDATE", entity: "GzPlan", entityId: String(players), changes: `rate=${p.ratePerPersonHour}`, userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Plan updated", p));
  }),
);

/* ---------------- legacy cash ledger (staff) ---------------- */

router.get("/", ...adminOnly, gamezoneController.getAllRecords);
router.post("/", ...adminOnly, gamezoneController.createRecord);
router.delete("/:id", ...adminOnly, gamezoneController.deleteRecord);
router.post("/:id/invoice", ...adminOnly, gamezoneController.uploadInvoice);

export default router;
