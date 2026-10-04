const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface Expense {
  id: string;
  itemName: string;
  category: string;
  quantity: string | null;
  price: number;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySummary {
  category: string;
  total: number;
}

export const expensesApi = {
  // Common helper for expenses to reduce boilerplate and handle errors
  async _fetch(url: string, options?: RequestInit) {
    const fullOptions = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    };
    const res = await fetch(url, fullOptions);
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Too many requests. Please wait a moment.");
      }
      throw new Error(`Request failed with status ${res.status}`);
    }
    const json = await res.json();
    return json;
  },

  // Get all expenses, optionally filtered by category
  async getExpenses(category?: string): Promise<Expense[]> {
    const url = new URL(`${API_BASE_URL}/expenses`);
    if (category && category !== "All") {
      url.searchParams.append("category", category);
    }
    const json = await this._fetch(url.toString());
    return json.data as Expense[];
  },

  // Get unique categories from existing expenses
  async getCategories(): Promise<string[]> {
    const json = await this._fetch(`${API_BASE_URL}/expenses/categories`);
    return json.data as string[];
  },

  // Get per-category totals
  async getSummary(): Promise<CategorySummary[]> {
    const json = await this._fetch(`${API_BASE_URL}/expenses/summary`);
    return json.data as CategorySummary[];
  },

  // Create a new expense
  async createExpense(data: {
    itemName: string;
    category: string;
    quantity?: string;
    price: number;
    date: string;
    notes?: string;
  }): Promise<Expense> {
    const json = await this._fetch(`${API_BASE_URL}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return json.data as Expense;
  },

  // Delete an expense
  async deleteExpense(id: string): Promise<void> {
    await this._fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: "DELETE",
    });
  },
};
