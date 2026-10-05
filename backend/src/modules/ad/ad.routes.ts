import { Router } from "express";
import adController from "./ad.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// Public route to get active ads for client
router.get("/active", adController.getActiveAds);

// Admin routes
router.get("/", ...adminOnly, adController.getAllAds);
router.get("/:id", ...adminOnly, adController.getAdById);
router.post("/", ...adminOnly, adController.createAd);
router.patch("/:id", ...adminOnly, adController.updateAd);
router.delete("/:id", ...adminOnly, adController.deleteAd);

export default router;
