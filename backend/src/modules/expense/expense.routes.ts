import { Router } from "express";
import expenseController from "./expense.controller";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

router.get("/", ...adminOnly, expenseController.getAllExpenses);
router.get("/categories", ...adminOnly, expenseController.getCategories);
router.get("/summary", ...adminOnly, expenseController.getSummary);
router.get("/:id", ...adminOnly, expenseController.getExpenseById);
router.post("/", ...adminOnly, expenseController.createExpense);
router.patch("/:id", ...adminOnly, expenseController.updateExpense);
router.delete("/:id", ...adminOnly, expenseController.deleteExpense);

export default router;
