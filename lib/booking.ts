// Booking data layer.
//
// DEMO IMPLEMENTATION: availability, prices, promo validation and booking creation
// are mocked locally. In production all of these MUST be server-side (FRD sections 33-35):
// the browser must never decide price, discount, availability or payment status.
// Replace the functions below with API calls; the UI only depends on these signatures.

import type { PayMethod } from "@/lib/payment";

export const COURTS = [
  { id: "c1", name: "Court 1" },
  { id: "c2", name: "Court 2" },
];

export const OPEN_HOUR = 6;
export const CLOSE_HOUR = 22; // last slot starts at 21:00
// Customers can book from today up to this many days ahead (today + 10 = 11 dates).
export const MAX_ADVANCE_DAYS = 10;

export type Period = "Morning" | "Day" | "Evening";
export type SlotStatus = "available" | "almost" | "booked" | "past";

export interface Slot {
  hour: number;
  period: Period;
  status: SlotStatus;
  freeCourts: string[];
  price: number;
}

export type PaymentMethod = PayMethod; // eSewa, Fonepay or Pay at venue (see lib/payment.ts)

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

function periodOf(hour: number): Period {
  return hour < 10 ? "Morning" : hour < 17 ? "Day" : "Evening";
}

export function priceFor(hour: number) {
  return hour < 10 ? 1000 : hour < 17 ? 1200 : 1500;
}

// Stable pseudo-random "is this court taken" so the demo doesn't flicker.
function isTaken(key: string, hour: number, courtId: string) {
  let h = 7;
  for (const ch of `${key}|${hour}|${courtId}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100 < 38;
}

export function getSlots(key: string, now: Date): Slot[] {
  const isToday = key === dateKey(now);
  const slots: Slot[] = [];
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    const freeCourts = COURTS.filter((c) => !isTaken(key, hour, c.id)).map((c) => c.id);
    const past = isToday && hour <= now.getHours();
    const status: SlotStatus = past
      ? "past"
      : freeCourts.length === 0
        ? "booked"
        : freeCourts.length < COURTS.length
          ? "almost"
          : "available";
    slots.push({ hour, period: periodOf(hour), status, freeCourts, price: priceFor(hour) });
  }
  return slots;
}

export type PromoResult =
  | { ok: true; code: string; discount: number; label: string }
  | { ok: false; message: string };

const PROMOS: Record<string, { type: "percent" | "flat"; value: number; until: string; rule?: (k: string, h: number) => string | null }> = {
  DASHAIN83: { type: "percent", value: 15, until: "2026-10-16" },
  WEEKEND10: {
    type: "percent",
    value: 10,
    until: "2026-10-31",
    rule: (k) => ([0, 6].includes(parseKey(k).getDay()) ? null : "This code is only valid for Saturday and Sunday bookings."),
  },
  EARLY200: {
    type: "flat",
    value: 200,
    until: "2026-11-30",
    rule: (_k, h) => (h < 8 ? null : "This code is only valid for slots before 8 AM."),
  },
};

export function validatePromo(rawCode: string, ctx: { dateKey: string; hour: number; base: number; today: string }): PromoResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, message: "Enter a promo code." };
  const p = PROMOS[code];
  if (!p) return { ok: false, message: "This promo code is invalid." };
  if (ctx.today > p.until || ctx.dateKey > p.until) return { ok: false, message: "This promotional code has expired." };
  const ruleError = p.rule?.(ctx.dateKey, ctx.hour);
  if (ruleError) return { ok: false, message: ruleError };
  const discount = p.type === "percent" ? Math.round((ctx.base * p.value) / 100) : Math.min(p.value, ctx.base);
  return { ok: true, code, discount, label: p.type === "percent" ? `${p.value}% off` : `${formatRs(p.value)} off` };
}

export interface BookingRequest {
  dateKey: string;
  hour: number;
  courtId: string;
  promoCode?: string;
  method: PaymentMethod;
  name: string;
  phone: string;
}

export interface BookingConfirmation {
  id: string;
  request: BookingRequest;
  base: number;
  discount: number;
  total: number;
  // Online payments are confirmed by the gateway callback on the server, never by the browser.
  paymentStatus: "pending_payment" | "pay_at_venue";
  createdAt: number; // epoch ms; the QR hold counts from here (the server owns this in production)
}

// DEMO: pretends to create a booking. The real API must re-check availability inside a
// database transaction (prevent double booking) and recompute price and promo itself.
export async function createBooking(req: BookingRequest, quote: { base: number; discount: number; total: number }): Promise<BookingConfirmation> {
  const limit = new Date();
  limit.setDate(limit.getDate() + MAX_ADVANCE_DAYS);
  if (req.dateKey > dateKey(limit)) throw new Error(`Bookings open only ${MAX_ADVANCE_DAYS} days in advance.`);
  await new Promise((r) => setTimeout(r, 900));
  const digits = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return {
    id: `UF-${req.dateKey.replaceAll("-", "")}-${digits}`,
    request: req,
    ...quote,
    paymentStatus: req.method === "venue" ? "pay_at_venue" : "pending_payment",
    createdAt: Date.now(),
  };
}
