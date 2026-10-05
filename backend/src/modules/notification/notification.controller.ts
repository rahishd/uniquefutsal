import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import NotificationService, { NOTICE_TYPES } from "./notification.service";
import { AppError } from "../../middlewares/error.middleware";

export const notificationController = {
  sendSms: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      throw new AppError(400, "Phone number and message are required");
    }

    await NotificationService.sendCustomSms(phoneNumber, message);

    res.json(ApiResponseUtil.success(200, "SMS sent successfully"));
  }),

  // The signed-in customer's notice centre
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const result = await NotificationService.list(req.user!.id, Number.isFinite(limit) ? limit : 50);
    res.json(ApiResponseUtil.success(200, "Notifications retrieved", result));
  }),

  markRead: asyncHandler(async (req: AuthRequest, res: Response) => {
    const count = await NotificationService.markRead(req.user!.id, req.params.id);
    if (count === 0) throw new AppError(404, "Notification not found");
    res.json(ApiResponseUtil.success(200, "Marked as read"));
  }),

  markAllRead: asyncHandler(async (req: AuthRequest, res: Response) => {
    const types = Array.isArray(req.body?.types) ? (req.body.types as string[]).filter((t) => (NOTICE_TYPES as readonly string[]).includes(t)) : undefined;
    const count = await NotificationService.markAllRead(req.user!.id, types);
    res.json(ApiResponseUtil.success(200, "Marked as read", { count }));
  }),

  clearAll: asyncHandler(async (req: AuthRequest, res: Response) => {
    const count = await NotificationService.clearAll(req.user!.id);
    res.json(ApiResponseUtil.success(200, "Notifications cleared", { count }));
  }),
};
