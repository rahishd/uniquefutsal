import { Router } from "express";
import { notificationController } from "./notification.controller";
import adminOnly from "../../middlewares/admin.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

// Only admins should be able to send custom SMS
router.post("/send-sms", ...adminOnly, notificationController.sendSms);

// Customer notice centre (the signed-in customer's own notices only)
router.get("/", authMiddleware, notificationController.list);
router.post("/read", authMiddleware, notificationController.markAllRead);
router.post("/:id/read", authMiddleware, notificationController.markRead);
router.delete("/", authMiddleware, notificationController.clearAll);

export default router;
