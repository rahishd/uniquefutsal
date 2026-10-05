// Court booking: date helpers and the calls to the backend (see uniquefutsal-backend/docs/API.md).
//
// Availability, prices, promo discounts, the guest rule, the 10-day window and payment status are all decided by
// the server. The app asks, shows what the server says, and shows its error messages.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import type { PayMethod, PaymentOrder } from "@/lib/payment";

// Customers can book from today up to this many days ahead (today + 10 = 11 dates). The server enforces it too.
export const MAX_ADVANCE_DAYS = 10;

export type Period = "Morning" | "Day" | "Evening";

export function dateKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatHour(h: number) {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${h < 12 ? "AM" : "PM"}`;
}

export function formatRs(n: number) {
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

export function periodOf(hour: number): Period {
  return hour < 10 ? "Morning" : hour < 17 ? "Day" : "Evening";
}

/* ---------- free slots ---------- */

export interface Slot {
  hour: number;
  startTime: string; // "18:00"
  endTime: string;
  price: number; // decided by the server
  period: Period;
}

export async function fetchSlots(date: string): Promise<Slot[]> {
  const r = await api<{ slots: Omit<Slot, "period">[] }>("/bookings/slots", { query: { date }, auth: "none" });
  return r.slots.map((s) => ({ ...s, period: periodOf(s.hour) }));
}

/* ---------- price and promo check ---------- */

export interface Quote {
  basePrice: number;
  discount: number;
  total: number;
  promo: { ok: boolean; code?: string; label?: string; message?: string } | null;
  usesVoucher: boolean;
  earnPoints: number; // points a signed-in customer will earn after the game
}

export function fetchQuote(p: { date: string; startTime: string; promoCode?: string; voucherId?: string }): Promise<Quote> {
  return api<Quote>("/bookings/quote", { method: "POST", body: p });
}

/* ---------- create a booking ---------- */

// A booking as the server returns it.
export interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  customerName?: string;
  customerPhone?: string;
  basePrice: number;
  discountAmount: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string; // pending | completed | partially_paid
  status: string; // pending | confirmed | completed | cancelled
  promoCode?: string;
  createdAt?: string;
}

export interface CheckoutResult {
  booking: Booking;
  payment: PaymentOrder | null; // present for eSewa / Fonepay: show the QR
}

export function checkoutBooking(p: {
  date: string;
  startTime: string;
  method: PayMethod;
  promoCode?: string;
  voucherId?: string;
  guest?: { name: string; phone: string };
}): Promise<CheckoutResult> {
  return api<CheckoutResult>("/bookings/checkout", { method: "POST", body: p });
}

/* ---------- my bookings ---------- */

export const myBookingsStore = createRemoteStore<Booking[]>(async () => {
  // the server returns a page when asked with limit; ask for plenty so history, next game and PDFs are complete
  const r = await api<Booking[] | { items: Booking[] }>("/bookings/me", { query: { limit: 200 } });
  return Array.isArray(r) ? r : r.items;
}, { signedOut: [] });

export async function cancelBooking(id: string) {
  await api(`/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  await myBookingsStore.refresh();
}

export const isUpcoming = (b: Booking, nowMs: number) => {
  if (b.status === "cancelled" || b.status === "completed") return false;
  return startsAtMs(b) + 60 * 60 * 1000 > nowMs; // still going on or ahead
};

// Epoch ms the booking starts (the venue is in Nepal; the phone's own time zone is used, which matches for customers there).
export function startsAtMs(b: { date: string; startTime: string }) {
  const d = parseKey(b.date);
  d.setHours(parseInt(b.startTime.split(":")[0], 10), 0, 0, 0);
  return d.getTime();
}

/* ---------- Quick Rebook ---------- */

export interface Rebook {
  usual: { weekday: number; hour: number; count: number; total: number };
  target: { date?: string; hour?: number; available: boolean; price?: number };
}

export const rebookStore = createRemoteStore<Rebook | null>(() => api<Rebook | null>("/bookings/me/rebook"), { signedOut: null });
