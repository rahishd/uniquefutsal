import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { CreateExpenseDTO, UpdateExpenseDTO, ExpenseResponse } from "./expense.dto";
import logger from "../../config/logger";

export class ExpenseService {
  async getAllExpenses(category?: string): Promise<ExpenseResponse[]> {
    try {
      const where = category ? { category } : {};
      return await prisma.expense.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error fetching expenses:", error);
      throw new AppError(500, "Failed to fetch expenses");
    }
  }

  async getExpenseById(id: string): Promise<ExpenseResponse> {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new AppError(404, "Expense not found");
    }
    return expense;
  }

  async createExpense(dto: CreateExpenseDTO): Promise<ExpenseResponse> {
    try {
      return await prisma.expense.create({
        data: {
          itemName: dto.itemName,
          category: dto.category,
          quantity: dto.quantity ?? null,
          price: dto.price,
          date: dto.date,
          notes: dto.notes ?? null,
        },
      });
    } catch (error) {
      logger.error("Error creating expense:", error);
      throw new AppError(500, "Failed to create expense");
    }
  }

  async updateExpense(id: string, dto: UpdateExpenseDTO): Promise<ExpenseResponse> {
    try {
      await this.getExpenseById(id);
      return await prisma.expense.update({
        where: { id },
        data: { ...dto },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error updating expense:", error);
      throw new AppError(500, "Failed to update expense");
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      await this.getExpenseById(id);
      await prisma.expense.delete({ where: { id } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error deleting expense:", error);
      throw new AppError(500, "Failed to delete expense");
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const result = await prisma.expense.findMany({
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      });
      return result.map((r) => r.category);
    } catch (error) {
      logger.error("Error fetching expense categories:", error);
      throw new AppError(500, "Failed to fetch expense categories");
    }
  }

  async getSummary(): Promise<{ category: string; total: number }[]> {
    try {
      const expenses = await prisma.expense.findMany({
        select: { category: true, price: true },
      });

      const map: Record<string, number> = {};
      for (const e of expenses) {
        map[e.category] = (map[e.category] || 0) + e.price;
      }

      return Object.entries(map).map(([category, total]) => ({ category, total }));
    } catch (error) {
      logger.error("Error fetching expense summary:", error);
      throw new AppError(500, "Failed to fetch expense summary");
    }
  }
}

export default new ExpenseService();
