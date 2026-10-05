import { Router } from "express";
import productController from "./product.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

router.get("/", productController.getAllProducts);
router.get("/logs", ...adminOnly, productController.getInventoryLogs);
router.get("/:id", productController.getProductById);
router.post("/", ...adminOnly, productController.createProduct);
router.patch("/:id", ...adminOnly, productController.updateProduct);
router.patch("/:id/stock", ...adminOnly, productController.adjustStock);
router.delete("/:id", ...adminOnly, productController.deleteProduct);

export default router;
