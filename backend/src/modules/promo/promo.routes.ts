import { Router, Response, Request } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import validateRequest from "../../middlewares/validate.middleware";
import { AuthRequest, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import SettingsService from "../settings/settings.service";
import BookingService from "../booking/booking.service";
import { daysBetweenKeys, todayKey } from "../../utils/dates";
import { PromoCode } from "../settings/settings.dto";

const router = Router();

function discountLabel(p: PromoCode) {
  return p.type === "percent" ? `${p.value}% OFF` : `Rs. ${p.value} OFF`;
}

function termsOf(p: PromoCode): string {
  const parts: string[] = [];
  if (p.validDays?.length) parts.push(`Valid on ${p.validDays.join(", ")}.`);
  if (p.startTime && p.endTime) parts.push(`Valid for slots between ${p.startTime} and ${p.endTime}.`);
  if (p.appliedTo === "membership") parts.push("For memberships only.");
  if (p.appliedTo === "booking") parts.push("For court bookings only.");
  return parts.join(" ") || "One code per booking.";
}

// The Promos page: active, upcoming and expired offers (the status is worked out from today's date).
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const today = todayKey();
    const promos = await SettingsService.getPromoCodes();
    const items = promos
      .filter((p) => p.isActive !== false)
      .map((p) => {
        const until = p.expiryDate ? p.expiryDate.slice(0, 10) : null;
        const status = until && until < today ? "expired" : "active";
        return {
          code: p.code,
          title: p.title || p.label || p.code,
          description: p.description || p.label || "",
          discount: discountLabel(p),
          kind: p.appliedTo === "both" ? "booking" : p.appliedTo,
          appliesTo: p.appliedTo,
          until,
          daysLeft: until ? daysBetweenKeys(today, until) : null,
          terms: termsOf(p),
          status,
        };
      });
    res.json(ApiResponseUtil.success(200, "Promos retrieved", items));
  }),
);

// Check a code for a booking slot (no side effects)
router.post(
  "/validate",
  [
    body("code").isString().trim().notEmpty().withMessage("Enter a promo code."),
    body("date").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Date must be in YYYY-MM-DD format"),
    body("startTime").matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage("Start time must be in HH:mm format"),
  ],
  optionalAuthMiddleware,
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = await BookingService.quote(req.body.date, req.body.startTime, 1, req.body.code, req.user?.role === "user" ? req.user.id : undefined);
    res.json(ApiResponseUtil.success(200, "Promo checked", { basePrice: q.basePrice, discount: q.discount, total: q.total, promo: q.promo }));
  }),
);

export default router;
