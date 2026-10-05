import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";
import membershipService from "./membership.service";
import notificationService from "../notification/notification.service";

// Customer membership screen. Members are the customers who are already registered (same phone + password): no extra
// sign-up. A request creates a PENDING subscription at the server-computed price; the venue collects the payment and
// verifies it (existing staff flow), which activates it.

export type Duration = "1_month" | "3_months";
export type Bucket = "morning" | "day" | "evening";
const DURATIONS: Duration[] = ["1_month", "3_months"];

// ASSUMPTION to confirm with the owner: the price columns are per time of day. 4 PM - 8 PM is never offered for
// memberships, so: before 12:00 = morning, 12:00 to 16:00 = day, 20:00 and later = evening.
export const bucketFor = (slot: string): Bucket => {
  const h = parseInt(slot.split("-")[0].split(":")[0], 10);
  return h < 12 ? "morning" : h < 20 ? "day" : "evening";
};

type PlanRow = Record<string, unknown>;
// Price of a plan for a duration and time of day, after the plan's own discount (a rupee amount). null = not priced.
export function planPrice(plan: PlanRow, duration: Duration, bucket: Bucket): number | null {
  const d = duration === "1_month" ? "1Month" : "3Months";
  const b = bucket[0].toUpperCase() + bucket.slice(1);
  const price = plan[`price${d}${b}`];
  if (typeof price !== "number" || price <= 0) return null;
  const off = plan[`discount${d}${b}`];
  return Math.max(0, price - (typeof off === "number" ? off : 0));
}

const router = Router();

// Plans with their prices, for the page (public).
router.get(
  "/offers",
  asyncHandler(async (_req, res: Response) => {
    const plans = await prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
    res.json(
      ApiResponseUtil.success(
        200,
        "Membership plans",
        plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          featured: p.featured,
          perks: (() => {
            try {
              return JSON.parse(p.perks) as string[];
            } catch {
              return [];
            }
          })(),
          prices: Object.fromEntries(DURATIONS.map((d) => [d, { morning: planPrice(p, d, "morning"), day: planPrice(p, d, "day"), evening: planPrice(p, d, "evening") }])),
        })),
      ),
    );
  }),
);

// The signed-in customer's membership: current (active or waiting for the venue) and past ones.
router.get(
  "/mine",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const all = await prisma.membershipSubscription.findMany({ where: { userId: req.user!.id }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 50 });
    const now = new Date();
    const view = (s: (typeof all)[number]) => ({
      id: s.id, plan: s.plan.name, status: s.status, paymentStatus: s.paymentStatus, timeSlot: s.timeSlot,
      duration: s.chosenDuration, startDate: s.startDate, endDate: s.endDate, total: s.totalPrice,
    });
    const current = all.find((s) => (s.status === "active" || s.status === "pending") && s.endDate >= now) ?? null;
    res.json(ApiResponseUtil.success(200, "My membership", { current: current && view(current), history: all.filter((s) => s !== current).map(view) }));
  }),
);

router.post(
  "/request",
  authMiddleware,
  [
    body("planId").isString().notEmpty(),
    body("timeSlot").matches(/^\d{2}:00-\d{2}:00$/).withMessage("Choose a time slot"),
    body("duration").isIn(DURATIONS).withMessage("Choose 1 month or 3 months"),
    body("startDate").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Choose a start date"),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { planId, timeSlot, duration, startDate } = req.body as { planId: string; timeSlot: string; duration: Duration; startDate: string };
    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new AppError(404, "That plan is not available");
    // The price is ours, never the browser's.
    const total = planPrice(plan as unknown as PlanRow, duration, bucketFor(timeSlot));
    if (total === null) throw new AppError(400, "This plan is not offered for that time of day. Please choose another time.");
    let sub;
    try {
      sub = await membershipService.createSubscription(req.user!.id, { planId, timeSlot, startDate, chosenDuration: duration, totalPrice: total, chosenDays: [], isManual: true } as never);
    } catch (e) {
      // the existing service throws plain Errors for rule problems: show them as a clear 400
      if (e instanceof AppError) throw e;
      throw new AppError(400, e instanceof Error ? e.message : "Could not create the request");
    }
    await notificationService.notify({
      userId: req.user!.id, type: "membership", title: "Membership request received",
      message: `${plan.name} for Rs. ${total}. Pay at the venue and the staff will activate it.`, href: "/member", dedupeKey: `member-req-${(sub as { id: string }).id}`,
    });
    res.status(201).json(ApiResponseUtil.success(201, "Membership requested", { id: (sub as { id: string }).id, total }));
  }),
);

export default router;
