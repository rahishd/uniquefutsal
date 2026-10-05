import { Router } from "express";
import adminController from "./admin.controller";

const router = Router();

// Admin login
router.post("/login", adminController.login);

// Verify admin token
router.get("/verify", adminController.verifyToken);

// Logout (optional server-side cleanup)
router.post("/logout", adminController.logout);

export default router;
