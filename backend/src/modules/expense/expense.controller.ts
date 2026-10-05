import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import expenseService from "./expense.service";
import { AuditService } from "../audit";

export class ExpenseController {
  async getAllExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      const expenses = await expenseService.getAllExpenses(category);
      res.status(200).json({ success: true, data: expenses });
    } catch (error) {
      next(error);
    }
  }

  async getExpenseById(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.getExpenseById(req.params.id);
      res.status(200).json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }

  async createExpense(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.createExpense(req.body);
      
      await AuditService.log({
        action: "CREATE_EXPENSE",
        entity: "Expense",
        entityId: expense.id,
        changes: `Recorded expense "${expense.itemName}" of Rs. ${expense.price} under category "${expense.category}"`,
        userId: req.user?.id,
      });

      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }

  async updateExpense(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.updateExpense(req.params.id, req.body);
      
      await AuditService.log({
        action: "UPDATE_EXPENSE",
        entity: "Expense",
        entityId: expense.id,
        changes: `Updated expense "${expense.itemName}" details`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }

  async deleteExpense(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.getExpenseById(req.params.id);
      const itemName = expense ? expense.itemName : req.params.id;

      await expenseService.deleteExpense(req.params.id);
      
      await AuditService.log({
        action: "DELETE_EXPENSE",
        entity: "Expense",
        entityId: req.params.id,
        changes: `Deleted expense "${itemName}"`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, message: "Expense deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await expenseService.getCategories();
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await expenseService.getSummary();
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}

export default new ExpenseController();
