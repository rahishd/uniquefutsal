import { Router } from "express";
import categoryController from "./category.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", ...adminOnly, categoryController.createCategory);
router.patch("/:id", ...adminOnly, categoryController.updateCategory);
router.delete("/:id", ...adminOnly, categoryController.deleteCategory);

export default router;
