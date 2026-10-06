import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import referService from "./refer.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

/* ---------- /api/refer ---------- */
export const referRouter = Router();

// Public so the page can explain the offer before sign-in
referRouter.get("/rules", asyncHandler(async (_req, res: Response) => ok(res, "Refer & Earn rules", await referService.rules())));

referRouter.get("/me", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "My referrals", await referService.me(req.user!.id))));

referRouter.post("/", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Referral sent", await referService.create(req.user!.id, req.body ?? {}), 201)));

referRouter.delete("/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "Referral withdrawn", await referService.cancel(req.user!.id, req.params.id))));
