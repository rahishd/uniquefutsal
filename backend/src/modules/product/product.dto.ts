export interface CreateProductDTO {
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  inventory?: number;
  unit?: string;
  lowStockThreshold?: number;
  costPrice?: number;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  price?: number;
  categoryId?: string;
  inventory?: number;
  unit?: string;
  lowStockThreshold?: number;
  costPrice?: number;
}

export interface AdjustStockDTO {
  amount: number;
  cashAmount?: number;
  onlineAmount?: number;
}

export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  inventory: number;
  unit: string;
  lowStockThreshold: number;
  costPrice: number | null;
  category?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
