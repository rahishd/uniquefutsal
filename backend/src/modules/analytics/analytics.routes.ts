import { Router } from "express";
import analyticsController from "./analytics.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// Public route to record client page visit
router.post("/page-visit", analyticsController.recordPageVisit);

// Admin routes
router.get("/page-visits", ...adminOnly, analyticsController.getPageVisits);
router.post("/daily-report/upload", ...adminOnly, analyticsController.uploadDailyReport);

export default router;
