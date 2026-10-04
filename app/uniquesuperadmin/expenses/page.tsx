"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ReceiptText,
  Plus,
  Search,
  Filter,
  Trash2,
  TrendingUp,
  ShoppingBasket,
  Fuel,
  User,
  MoreHorizontal,
  Calendar,
  X,
  Tag,
  RefreshCw,
} from "lucide-react";
import { 
  subDays, 
  isSameDay, 
  startOfMonth, 
  isAfter, 
  parseISO,
  isWithinInterval,
  format
} from "date-fns";
import { toast } from "sonner";
import { expensesApi, Expense, CategorySummary } from "@/lib/api/expenses";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const DEFAULT_CATEGORIES = ["Groceries", "Petroleum", "Personal", "Others"];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Groceries: <ShoppingBasket size={18} />,
  Petroleum: <Fuel size={18} />,
  Personal: <User size={18} />,
  Others: <MoreHorizontal size={18} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "bg-emerald-50 text-emerald-600 border-emerald-100",
  Petroleum: "bg-amber-50 text-amber-600 border-amber-100",
  Personal: "bg-indigo-50 text-indigo-600 border-indigo-100",
  Others: "bg-slate-50 text-slate-600 border-slate-100",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Filter states
  const [timeFilter, setTimeFilter] = useState("Lifetime");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    itemName: "",
    category: "Groceries",
    newCategory: "",
    quantity: "",
    price: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [expensesData, categoriesData, summaryData] = await Promise.all([
        expensesApi.getExpenses(),
        expensesApi.getCategories(),
        expensesApi.getSummary(),
      ]);
      setExpenses(expensesData);
      setSummary(summaryData);

      // Merge DB categories with defaults so defaults always show
      const merged = Array.from(
        new Set([...DEFAULT_CATEGORIES, ...categoriesData]),
      );
      setCategories(merged);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error("Failed to load expense data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      itemName: "",
      category: "Groceries",
      newCategory: "",
      quantity: "",
      price: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setShowNewCategoryInput(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalCategory = showNewCategoryInput
      ? formData.newCategory.trim()
      : formData.category;

    if (!finalCategory) {
      toast.error("Please select or enter a category");
      return;
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsSubmitting(true);

    const promise = expensesApi.createExpense({
      itemName: formData.itemName,
      category: finalCategory,
      quantity: formData.quantity || undefined,
      price: priceNum,
      date: formData.date,
      notes: formData.notes || undefined,
    });

    toast.promise(promise, {
      loading: "Saving expense...",
      success: (newExpense) => {
        setExpenses((prev) => [newExpense, ...prev]);
        // Update categories list if new
        if (!categories.includes(finalCategory)) {
          setCategories((prev) => [...prev, finalCategory]);
        }
        // Update summary optimistically
        setSummary((prev) => {
          const exists = prev.find((s) => s.category === finalCategory);
          if (exists) {
            return prev.map((s) =>
              s.category === finalCategory
                ? { ...s, total: s.total + priceNum }
                : s,
            );
          }
          return [...prev, { category: finalCategory, total: priceNum }];
        });
        setIsModalOpen(false);
        resetForm();
        setIsSubmitting(false);
        return "Expense added successfully!";
      },
      error: (err) => {
        setIsSubmitting(false);
        return err?.message || "Failed to save expense";
      },
    });
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;

    const expense = expenses.find((e) => e.id === expenseToDelete);
    if (!expense) return;

    const promise = expensesApi.deleteExpense(expenseToDelete);
    toast.promise(promise, {
      loading: "Deleting record...",
      success: () => {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete));
        // Update summary optimistically
        setSummary((prev) =>
          prev
            .map((s) =>
              s.category === expense.category
                ? { ...s, total: s.total - expense.price }
                : s,
            )
            .filter((s) => s.total > 0),
        );
        setExpenseToDelete(null);
        return "Expense record deleted";
      },
      error: "Failed to delete expense",
    });
  };

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  // ── Derived values ──────────────────────────────────────────────
  const filteredExpenses = expenses.filter((e) => {
    // 1. Search term
    const matchesSearch = e.itemName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    // 2. Category
    const matchesCategory =
      filterCategory === "All" || e.category === filterCategory;

    if (!(matchesSearch && matchesCategory)) return false;

    // 3. Time Filter
    const today = new Date();
    const yesterday = subDays(today, 1);
    const monthStart = startOfMonth(today);
    const itemDate = parseISO(e.date);

    switch (timeFilter) {
      case "Today":
        return isSameDay(itemDate, today);
      case "Yesterday":
        return isSameDay(itemDate, yesterday);
      case "This Month":
        return isAfter(itemDate, subDays(monthStart, 1));
      case "Custom":
        if (!customStart || !customEnd) return true;
        return isWithinInterval(itemDate, {
          start: parseISO(customStart),
          end: parseISO(customEnd),
        });
      case "Lifetime":
      default:
        return true;
    }
  });

  // Calculate summary based on filtered items
  const totalExpense = filteredExpenses.reduce((acc, e) => acc + e.price, 0);

  const categoryTotals: Record<string, number> = {};
  filteredExpenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.price;
  });

  // Sort all known categories by their spend (descending), default ones always visible
  const sortedCategories = [...categories].sort(
    (a, b) => (categoryTotals[b] || 0) - (categoryTotals[a] || 0),
  );

  const displayCategories = sortedCategories.slice(0, 3);
  const othersTotal = sortedCategories
    .slice(3)
    .reduce((sum, cat) => sum + (categoryTotals[cat] || 0), 0);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Expense <span className="text-[#FA6400]">Record Book</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Track and manage your business and personal expenses in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="w-12 h-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-[#0c0b5d] hover:border-[#0c0b5d] transition-all cursor-pointer disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            Add New Expense
          </button>
        </div>
      </div>

      {/* Time Filters */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-[22px] border border-slate-100 w-fit">
          {["Today", "Yesterday", "This Month", "Lifetime", "Custom"].map((f) => {
            const active = timeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-6 py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  active
                    ? "bg-[#0c0b5d] text-white shadow-lg shadow-blue-900/20"
                    : "text-slate-400 hover:text-[#0c0b5d] hover:bg-white"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {timeFilter === "Custom" && (
          <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Expenses
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#0c0b5d]">
              Rs. {totalExpense.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#FA6400]">
              <TrendingUp size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Across all categories
            </span>
          </div>
        </div>

        {/* Top 3 category cards */}
        {displayCategories.map((cat, idx) => (
          <div
            key={cat}
            className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
              {cat}
            </span>
            <span
              className={`text-2xl font-black ${
                idx === 0
                  ? "text-emerald-600"
                  : idx === 1
                    ? "text-amber-600"
                    : "text-indigo-600"
              }`}
            >
              Rs. {(categoryTotals[cat] || 0).toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  CATEGORY_COLORS[cat] || "bg-slate-50 text-slate-600"
                }`}
              >
                {CATEGORY_ICONS[cat] || <Tag size={16} />}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase truncate">
                {cat === "Groceries"
                  ? "Food & Supplies"
                  : cat === "Petroleum"
                    ? "Fuel & Gas"
                    : cat === "Personal"
                      ? "Misc Personal"
                      : "Category Total"}
              </span>
            </div>
          </div>
        ))}

        {/* Others overflow card */}
        {sortedCategories.length > 3 && (
          <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Other Categories
            </span>
            <span className="text-2xl font-black text-slate-600">
              Rs. {othersTotal.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 border border-slate-100">
                <MoreHorizontal size={16} />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Remaining spend
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
        {/* Filters Header */}
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-200">
              <Filter className="text-slate-400" size={18} />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer border-none focus:ring-0"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Showing {filteredExpenses.length} entries
          </div>
        </div>

        {/* Expenses Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Item Details
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Category
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Quantity
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date
                </th>
                <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Price (Rs.)
                </th>
                <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#FA6400] border-t-transparent rounded-full animate-spin" />
                      <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                        Loading Expenses...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <ReceiptText size={48} />
                      <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                        No records found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#0c0b5d] uppercase tracking-tight">
                          {expense.itemName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Ref: #{expense.id.slice(0, 8)}
                        </span>
                        {expense.notes && (
                          <span className="text-[10px] text-slate-400 italic mt-0.5">
                            {expense.notes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                          CATEGORY_COLORS[expense.category] ||
                          "bg-slate-50 text-slate-600 border-slate-100"
                        }`}
                      >
                        {CATEGORY_ICONS[expense.category] || <Tag size={12} />}
                        {expense.category}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-600">
                      {expense.quantity || "—"}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar size={14} />
                        <span className="text-[11px] font-bold">
                          {new Date(expense.date).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-sm font-black text-[#0c0b5d]">
                        Rs. {expense.price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <button
                        onClick={() => handleDeleteClick(expense.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0c0b5d]/20 backdrop-blur-sm"
            onClick={() => {
              setIsModalOpen(false);
              resetForm();
            }}
          />

          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 max-h-full overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  New Expense <span className="text-[#FA6400]">Entry</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Add details to your record book
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleAddExpense}
              className="p-8 flex flex-col gap-6"
            >
              {/* Item Name */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Item Name
                </label>
                <div className="relative">
                  <ReceiptText
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Printer Paper, Petrol, Milk"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.itemName}
                    onChange={(e) =>
                      setFormData({ ...formData, itemName: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Category + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      required
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d] appearance-none cursor-pointer"
                      value={showNewCategoryInput ? "NEW" : formData.category}
                      onChange={(e) => {
                        if (e.target.value === "NEW") {
                          setShowNewCategoryInput(true);
                        } else {
                          setShowNewCategoryInput(false);
                          setFormData({
                            ...formData,
                            category: e.target.value,
                          });
                        }
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="NEW" className="text-[#FA6400] font-black">
                        + Add New Category
                      </option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Tag size={16} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Date
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* New category input */}
              {showNewCategoryInput && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#FA6400]">
                    New Category Name
                  </label>
                  <input
                    required
                    autoFocus
                    type="text"
                    placeholder="Type new category name..."
                    className="w-full px-4 py-4 bg-orange-50/30 border border-orange-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FA6400]/10 transition-all text-[#0c0b5d]"
                    value={formData.newCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, newCategory: e.target.value })
                    }
                  />
                </div>
              )}

              {/* Quantity + Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Quantity
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5 Liters, 2 Boxes"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Price (Rs.)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">
                      Rs.
                    </span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Notes{" "}
                  <span className="text-slate-400 font-medium normal-case">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Any additional info..."
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 flex items-center justify-center gap-2 bg-[#FA6400] text-white py-5 rounded-[20px] font-black uppercase tracking-widest text-xs shadow-xl shadow-[#FA6400]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:scale-100"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {isSubmitting ? "Saving..." : "Save Expense Entry"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Expense Record"
        description="Are you sure you want to delete this expense record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
        onConfirm={handleDeleteExpense}
      />
    </div>
  );
}
