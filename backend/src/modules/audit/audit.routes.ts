import { Router } from "express";
import auditController from "./audit.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// Retrieve audit logs filters (Admin only)
router.get("/filters", ...adminOnly, auditController.getFilters);

// Retrieve audit logs (Admin only)
router.get("/", ...adminOnly, auditController.getLogs);

export default router;
