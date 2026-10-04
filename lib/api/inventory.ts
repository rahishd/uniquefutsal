const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  inventory: number;
  unit: string;
  lowStockThreshold: number;
  costPrice: number;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

interface ProductWriteInput {
  [key: string]: unknown;
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const inventoryApi = {
  // Categories
  async getCategories() {
    const res = await fetch(`${API_BASE_URL}/categories`);
    if (!res.ok) throw new Error("Failed to fetch categories");
    const json = await res.json();
    return json.data as Category[];
  },

  async createCategory(name: string) {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create category");
    const json = await res.json();
    return json.data as Category;
  },

  // Products
  async getProducts(categoryId?: string) {
    const url = new URL(`${API_BASE_URL}/products`);
    if (categoryId) url.searchParams.append("categoryId", categoryId);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Failed to fetch products");
    const json = await res.json();
    return json.data as Product[];
  },

  async createProduct(data: ProductWriteInput) {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create product");
    const json = await res.json();
    return json.data as Product;
  },

  async updateProduct(id: string, data: ProductWriteInput) {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update product");
    const json = await res.json();
    return json.data as Product;
  },

  async adjustStock(id: string, amount: number, price?: number, reason?: string, cashAmount?: number, onlineAmount?: number) {
    const res = await fetch(`${API_BASE_URL}/products/${id}/stock`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ amount, price, reason, cashAmount, onlineAmount }),
    });
    if (!res.ok) throw new Error("Failed to adjust stock");
    const json = await res.json();
    return json.data as Product;
  },

  async deleteProduct(id: string) {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) throw new Error("Failed to delete product");
    return true;
  },

  async getInventoryLogs() {
    const res = await fetch(`${API_BASE_URL}/products/logs`, {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) throw new Error("Failed to fetch logs");
    const json = await res.json();
    return json.data;
  },
};
