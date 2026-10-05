export interface CreateExpenseDTO {
  itemName: string;
  category: string;
  quantity?: string;
  price: number;
  date: string;
  notes?: string;
}

export interface UpdateExpenseDTO {
  itemName?: string;
  category?: string;
  quantity?: string;
  price?: number;
  date?: string;
  notes?: string;
}

export interface ExpenseResponse {
  id: string;
  itemName: string;
  category: string;
  quantity: string | null;
  price: number;
  date: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
