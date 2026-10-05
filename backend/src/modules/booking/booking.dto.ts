// Booking Module - Domain Transfer Object (DTO)

export interface CreateBookingDTO {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  duration: number; // in hours
  loyaltyEnabled?: boolean;
  addOns?: string; // custom add-on item name
  promoCode?: string;
  discountAmount?: number;
  paymentMethod: "full" | "advance" | "venue";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  addOnsPrice?: number;
  overridePrice?: number;
  isManual?: boolean;
  useFreeMatch?: boolean;
}

export interface UpdateBookingDTO {
  status?: "pending" | "confirmed" | "cancelled" | "completed";
  paymentStatus?: "pending" | "completed" | "partially_paid";
  notes?: string;
  cashAmount?: number;
  onlineAmount?: number;
  waterBottles?: number;
  loyaltyEnabled?: boolean;
  addOns?: string;
  addOnsPrice?: number;
  totalPrice?: number;
  amountPaidNow?: number;
  remainingAmount?: number;
  sendSms?: boolean;
  settlePreviousDues?: boolean;
}

export interface BookingResponse {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  basePrice: number;
  addOns?: string;
  addOnsPrice: number;
  waterBottles: number;
  promoCode?: string;
  discountAmount: number;
  subtotal: number;
  totalPrice: number;
  paymentMethod: string;
  amountPaidNow: number;
  cashAmount: number;
  onlineAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
  notes?: string;
  loyaltyEnabled?: boolean;
  updatedAt: Date;
}

export interface BookingFilters {
  date?: string;
  status?: string;
  userId?: string;
}
