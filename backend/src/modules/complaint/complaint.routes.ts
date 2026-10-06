import { Router, Response } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { AuditService } from "../audit";
import complaintService, { COMPLAINT_CATEGORIES, MESSAGE_MAX, MESSAGE_MIN, PER_DAY } from "./complaint.service";
import { MAX_PHOTOS } from "../../utils/complaintMedia";

const ok = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json(ApiResponseUtil.success(status, message, data));

/* ---------- /api/complaints ---------- */
export const complaintRouter = Router();

// What the form needs (public, so the page can render before sign-in)
complaintRouter.get("/categories", (_req, res: Response) => {
  ok(res, "Complaint categories", { categories: COMPLAINT_CATEGORIES, messageMin: MESSAGE_MIN, messageMax: MESSAGE_MAX, maxPhotos: MAX_PHOTOS, perDay: PER_DAY });
});

// Staff views, declared before anything with an :id
complaintRouter.get("/admin", ...adminOnly, asyncHandler(async (req, res: Response) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  ok(res, "Complaints", await complaintService.adminList(typeof req.query.status === "string" ? req.query.status : undefined, page, limit));
}));

complaintRouter.patch(
  "/admin/:id",
  ...adminOnly,
  [body("status").optional().isString(), body("reply").optional().isString()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const r = await complaintService.adminUpdate(req.user!.id, req.params.id, { status: req.body.status, reply: req.body.reply });
    await AuditService.log({ action: "COMPLAINT_UPDATED", entity: "Complaint", entityId: req.params.id, changes: `${req.body.status ?? ""}${req.body.reply ? " + reply" : ""}`.trim(), userId: req.user!.id });
    ok(res, "Complaint updated", r);
  }),
);

// A signed-in customer
complaintRouter.get("/me", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  ok(res, "My complaints", await complaintService.mine(req.user!.id));
}));

complaintRouter.post(
  "/",
  authMiddleware,
  [body("category").isString(), body("message").isString(), body("bookingCode").optional({ values: "falsy" }).isString(), body("photos").optional({ values: "null" }).isArray()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    ok(res, "Complaint received", await complaintService.create(req.user!.id, req.body), 201);
  }),
);
