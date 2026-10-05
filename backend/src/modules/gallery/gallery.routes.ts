import { Router } from "express";
import galleryController from "./gallery.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// Public route to get gallery items for client
router.get("/active", galleryController.getAllItems);

// Admin routes
router.get("/", ...adminOnly, galleryController.getAllItems);
router.get("/:id", ...adminOnly, galleryController.getItemById);
router.post("/", ...adminOnly, galleryController.createItem);
router.patch("/:id", ...adminOnly, galleryController.updateItem);
router.delete("/:id", ...adminOnly, galleryController.deleteItem);

export default router;
