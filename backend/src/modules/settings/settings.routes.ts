import { Router } from "express";
import { settingsController } from "./settings.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// Public route - Get settings (no auth required for client side)
router.get("/", settingsController.getSettings);

// Admin routes (require authentication - can add role check middleware here)
router.patch("/", ...adminOnly, settingsController.updateSettings);
router.post("/initialize", ...adminOnly, settingsController.initializeSettings);

export default router;
