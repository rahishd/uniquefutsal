import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AuditService } from "../audit";
import loyaltyService from "./loyalty.service";
import { Period } from "../../utils/loyaltyPoints";

const router = Router();

// My points: balance, expiry, per-type buckets, shift costs, unused vouchers, history rows
router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(ApiResponseUtil.success(200, "Loyalty retrieved", await loyaltyService.overview(req.user!.id)));
  }),
);

// Spend points on a free game for one shift
router.post(
  "/claim",
  authMiddleware,
  [body("period").isIn(["Morning", "Day", "Evening"]).withMessage("Choose Morning, Day or Evening")],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const voucher = await loyaltyService.claim(req.user!.id, req.body.period as Period);
    res.status(201).json(ApiResponseUtil.success(201, "Free game claimed", voucher));
  }),
);

// Staff: record a goods sale (earns the customer 1 point per Rs. 100)
router.post(
  "/goods-sale",
  ...adminOnly,
  [
    body("phone").matches(/^9\d{9}$/).withMessage("Enter a 10-digit mobile number starting with 9"),
    body("amount").isInt({ min: 1 }).withMessage("Amount must be a positive whole number").toInt(),
    body("items").optional().isString().trim(),
  ],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await loyaltyService.recordGoodsSale({ phone: req.body.phone, amount: req.body.amount, items: req.body.items, soldBy: req.user!.id });
    await AuditService.log({ action: "GOODS_SALE", entity: "GoodsSale", entityId: result.saleId, changes: `Rs. ${req.body.amount} for ${req.body.phone}, ${result.points} points`, userId: req.user!.id });
    res.status(201).json(ApiResponseUtil.success(201, "Goods sale recorded", result));
  }),
);

export default router;
