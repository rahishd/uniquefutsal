/**
 * TypeScript types for booking domain
 * Centralized type definitions
 */

export interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  basePrice: number;
  addOns?: string[];
  addOnsPrice: number;
  promoCode?: string;
  discountAmount: number;
  subtotal: number;
  totalPrice: number;
  paymentMethod: "full" | "advance" | "venue";
  amountPaidNow: number;
  remainingAmount: number;
  paymentStatus: "pending" | "completed" | "partially_paid";
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loyaltyEnabled?: boolean;
}

export interface CreateBookingData {
  date: string;
  startTime: string;
  duration: number;
  addOns?: string[];
  promoCode?: string;
  discountAmount?: number;
  paymentMethod: "full" | "advance" | "venue";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  loyaltyEnabled?: boolean;
  useFreeMatch?: boolean;
}

export interface UpdateBookingData {
  status?: "pending" | "confirmed" | "cancelled" | "completed";
  paymentStatus?: "pending" | "completed" | "partially_paid";
  notes?: string;
  loyaltyEnabled?: boolean;
}

export interface BookingFilters {
  date?: string;
  status?: string;
  userId?: string;
}

export type BookingStatus = Booking["status"];
export type PaymentStatus = Booking["paymentStatus"];
export type PaymentMethod = Booking["paymentMethod"];
