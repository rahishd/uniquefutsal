import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { AuditService } from "../audit";
import { isTestGateway } from "../../services/paymentGateway";
import paymentService from "./payment.service";

const router = Router();

// Polled by the QR screen. Owner (signed in) or the guest who made the order (?phone=).
router.get(
  "/:orderCode/status",
  optionalAuthMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const staff = req.user?.role === "admin" || req.user?.role === "superadmin";
    const result = await paymentService.status(req.params.orderCode, {
      userId: req.user?.id,
      phone: typeof req.query.phone === "string" ? req.query.phone : undefined,
      staff,
    });
    res.json(ApiResponseUtil.success(200, "Payment status", result));
  }),
);

// Staff: record a payment that was received outside the gateway (for example cash taken for an online order).
router.post(
  "/:orderCode/mark-paid",
  ...adminOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await paymentService.markPaid(req.params.orderCode, { source: "staff", by: req.user!.id });
    await AuditService.log({ action: "PAYMENT_MARKED_PAID", entity: "PaymentOrder", entityId: req.params.orderCode, changes: "Marked paid by staff", userId: req.user!.id });
    res.json(ApiResponseUtil.success(200, "Payment recorded", { alreadyPaid: result.alreadyPaid }));
  }),
);

// LOCAL/TEST ONLY: pretends the gateway told us the payment arrived. Not available in production.
router.post(
  "/:orderCode/test-pay",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!isTestGateway()) throw new AppError(404, "Not found");
    const result = await paymentService.markPaid(req.params.orderCode, { source: "test" });
    res.json(ApiResponseUtil.success(200, "Test payment recorded", { alreadyPaid: result.alreadyPaid }));
  }),
);

// Gateway callbacks. They must verify the gateway's signature before calling markPaid.
// Not available until the Fonepay merchant keys are configured.
for (const gw of ["fonepay"]) {
  router.post(
    `/webhooks/${gw}`,
    asyncHandler(async () => {
      throw new AppError(501, `${gw} callbacks are not configured yet`);
    }),
  );
}

export default router;
