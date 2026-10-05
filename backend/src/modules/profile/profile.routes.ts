import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";

const router = Router();
router.use(authMiddleware); // everything here is about the signed-in customer only

const POSITIONS = ["GK", "DEF", "MID", "FWD"];
const LANGUAGES = ["en", "ne"];

async function prefsFor(userId: string) {
  return prisma.userPrefs.upsert({ where: { userId }, update: {}, create: { userId } });
}

// "UF-C-" + the last five digits of the mobile number. For display only; the phone number is the real identity.
const customerCode = (phone: string) => `UF-C-${phone.slice(-5)}`;

router.get(
  "/profile",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({ where: { phoneNumber: req.user!.id } });
    if (!user) throw new AppError(404, "User not found");
    const p = await prefsFor(user.phoneNumber);
    res.json(
      ApiResponseUtil.success(200, "Profile", {
        customerCode: customerCode(user.phoneNumber),
        name: user.name ?? "",
        phone: user.phoneNumber,
        email: user.email,
        avatar: user.avatar,
        location: p.location,
        position: p.position,
        registeredAt: user.createdAt,
        status: user.isActive ? "Active" : "Suspended",
        mode: p.mode,
      }),
    );
  }),
);

router.patch(
  "/profile",
  [
    body("name").optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage("Name must be at least 2 characters"),
    body("email").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("Enter a valid email").normalizeEmail(),
    body("location").optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
    body("position").optional({ nullable: true, checkFalsy: true }).isIn(POSITIONS).withMessage("Position must be GK, DEF, MID or FWD"),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const { name, email, location, position } = req.body;
    if (email) {
      const taken = await prisma.user.findFirst({ where: { email, NOT: { phoneNumber: id } }, select: { phoneNumber: true } });
      if (taken) throw new AppError(409, "This email is already used by another account");
    }
    // The mobile number is the account's identity and is never changed here.
    await prisma.user.update({
      where: { phoneNumber: id },
      data: { ...(name !== undefined && { name }), ...(email !== undefined && { email: email || null }) },
    });
    await prisma.userPrefs.upsert({
      where: { userId: id },
      update: { ...(location !== undefined && { location: location || null }), ...(position !== undefined && { position: position || null }) },
      create: { userId: id, location: location || null, position: position || null },
    });
    res.json(ApiResponseUtil.success(200, "Profile updated"));
  }),
);

router.get(
  "/preferences",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const p = await prefsFor(req.user!.id);
    res.json(ApiResponseUtil.success(200, "Preferences", { smsReminders: p.smsReminders, promoNotifications: p.promoNotifications, popupReminder: p.popupReminder, language: p.language }));
  }),
);

router.put(
  "/preferences",
  [
    body("smsReminders").optional().isBoolean().toBoolean(),
    body("promoNotifications").optional().isBoolean().toBoolean(),
    body("popupReminder").optional().isBoolean().toBoolean(),
    body("language").optional().isIn(LANGUAGES).withMessage("Language must be en or ne"),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { smsReminders, promoNotifications, popupReminder, language } = req.body;
    const data = {
      ...(smsReminders !== undefined && { smsReminders }),
      ...(promoNotifications !== undefined && { promoNotifications }),
      ...(popupReminder !== undefined && { popupReminder }),
      ...(language !== undefined && { language }),
    };
    const p = await prisma.userPrefs.upsert({ where: { userId: req.user!.id }, update: data, create: { userId: req.user!.id, ...data } });
    res.json(ApiResponseUtil.success(200, "Preferences saved", { smsReminders: p.smsReminders, promoNotifications: p.promoNotifications, popupReminder: p.popupReminder, language: p.language }));
  }),
);

// Player / Captain switch
router.put(
  "/mode",
  [body("mode").isIn(["player", "captain"]).withMessage("Mode must be player or captain")],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const p = await prisma.userPrefs.upsert({ where: { userId: req.user!.id }, update: { mode: req.body.mode }, create: { userId: req.user!.id, mode: req.body.mode } });
    res.json(ApiResponseUtil.success(200, "Mode saved", { mode: p.mode }));
  }),
);

// Web Push subscription of this device (closed-app reminders need these; sending them is a later step)
router.post(
  "/push-subscriptions",
  [body("endpoint").isURL({ require_tld: false }), body("keys.p256dh").isString().notEmpty(), body("keys.auth").isString().notEmpty()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { endpoint, keys } = req.body;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user!.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.user!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: (req.headers["user-agent"] as string | undefined) ?? null },
    });
    res.status(201).json(ApiResponseUtil.success(201, "Subscribed"));
  }),
);

router.delete(
  "/push-subscriptions",
  [body("endpoint").isString().notEmpty()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint, userId: req.user!.id } });
    res.json(ApiResponseUtil.success(200, "Unsubscribed"));
  }),
);

// Gameplay: games played (completed bookings) with goals and assists where staff recorded them. Older games have no
// numbers (they were never recorded), so they show as null and are not counted in the totals.
router.get(
  "/gameplay",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const stats = await prisma.playerGameStat.findMany({ where: { userId: id } });
    const byBooking = new Map(stats.map((s) => [s.bookingId, s]));
    const bookings = await prisma.booking.findMany({
      where: { status: { not: "cancelled" }, OR: [{ userId: id, status: "completed" }, { id: { in: stats.map((s) => s.bookingId) } }] },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 500,
    });
    const games = bookings.map((b) => {
      const s = byBooking.get(b.id);
      return { id: b.id, code: b.code || "UF-" + b.id.slice(-6).toUpperCase(), date: b.date, time: `${b.startTime} - ${b.endTime}`, goals: s ? s.goals : null, assists: s ? s.assists : null };
    });
    res.json(ApiResponseUtil.success(200, "Gameplay", {
      totals: { games: games.length, goals: stats.reduce((n, s) => n + s.goals, 0), assists: stats.reduce((n, s) => n + s.assists, 0), withStats: stats.length },
      games,
    }));
  }),
);

// Payment history: paid bookings and Gamezone sessions, newest first. Pay-at-venue bookings appear once paid.
router.get(
  "/payments",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.user!.id;
    const [bookings, gz] = await Promise.all([
      prisma.booking.findMany({ where: { userId: id, paymentStatus: "completed", totalPrice: { gt: 0 } }, orderBy: { date: "desc" }, take: 200 }),
      prisma.gzBooking.findMany({ where: { userId: id, paymentStatus: "paid" }, orderBy: { date: "desc" }, take: 200 }),
    ]);
    const items = [
      ...bookings.map((b) => ({ id: b.id, code: b.code || "UF-" + b.id.slice(-6).toUpperCase(), kind: "game", date: b.date, time: `${b.startTime} - ${b.endTime}`, amount: b.totalPrice, method: b.paymentMethod, status: "Paid" })),
      ...gz.map((g) => ({ id: g.code, code: g.code, kind: "gamezone", date: g.date, time: `${String(g.startHour).padStart(2, "0")}:00 - ${String(g.startHour + g.hours).padStart(2, "0")}:00`, amount: g.total, method: g.paymentMethod, status: "Paid" })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    res.json(ApiResponseUtil.success(200, "Payments", items));
  }),
);

export default router;
