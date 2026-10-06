import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import academyService from "./academy.service";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

/* ---------- /api/academy ---------- */
export const academyRouter = Router();

// Public, so the page can show the classes and the terms before the guardian signs in
academyRouter.get("/info", asyncHandler(async (_req, res: Response) => ok(res, "Children's Academy", await academyService.info())));

academyRouter.get("/mine", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => ok(res, "My enrolments", await academyService.mine(req.user!.id))));

academyRouter.post("/enroll", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Class confirmed", await academyService.enroll(req.user!.id, req.body ?? {}), 201);
}));

academyRouter.post("/enrollments/:id/cancel", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "Enrolment cancelled", await academyService.cancel(req.user!.id, req.params.id));
}));
