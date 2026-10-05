import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import productService from "./product.service";
import { AuditService } from "../audit";

export class ProductController {
  async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.query.categoryId as string;
      const products = await productService.getAllProducts(categoryId);
      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getProductById(req.params.id);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const product = await productService.createProduct(req.body);
      
      await AuditService.log({
        action: "CREATE_PRODUCT",
        entity: "Product",
        entityId: product.id,
        changes: `Created product "${product.name}" with price ${product.price} and initial stock ${product.inventory}`,
        userId: req.user?.id,
      });

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      
      await AuditService.log({
        action: "UPDATE_PRODUCT",
        entity: "Product",
        entityId: product.id,
        changes: `Updated product "${product.name}" details`,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async adjustStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount, reason, price, cashAmount, onlineAmount } = req.body;
      const product = await productService.adjustStock(req.params.id, amount, reason, price, cashAmount, onlineAmount);
      
      await AuditService.log({
        action: "ADJUST_STOCK",
        entity: "Product",
        entityId: product.id,
        changes: `Adjusted stock of "${product.name}" by ${amount > 0 ? "+" : ""}${amount} (Reason: ${reason || "none"})`,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const product = await productService.getProductById(req.params.id);
      const productName = product ? product.name : req.params.id;

      await productService.deleteProduct(req.params.id);
      
      await AuditService.log({
        action: "DELETE_PRODUCT",
        entity: "Product",
        entityId: req.params.id,
        changes: `Deleted product "${productName}"`,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async getInventoryLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await productService.getInventoryLogs();
      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProductController();
