// Payment helpers shared by court bookings and Gamezone.
//
// The server creates the order and the QR (for the exact amount, with the remarks that link the payment to
// the order) and is the only one that can mark an order paid: from the gateway, from staff at the venue, or
// (only while the backend runs its local test gateway) from the test button below. The browser just shows the
// QR and asks the server for the status every few seconds.

import { api } from "@/lib/api";

export type PayMethod = "fonepay" | "venue";
export type OnlineMethod = Exclude<PayMethod, "venue">;

export const PAY_METHODS: { id: PayMethod; label: string; note: string }[] = [
  { id: "fonepay", label: "Fonepay", note: "Pay with QR" },
  { id: "venue", label: "Pay at venue", note: "Cash or QR on arrival" },
];

// "esewa" is only for old records made before it was removed
export const METHOD_LABEL: Record<string, string> = { fonepay: "Fonepay", venue: "Pay at venue", esewa: "eSewa (old)" };

export const isOnline = (m: PayMethod): m is OnlineMethod => m !== "venue";

// How often the open QR screen asks the server whether the order has been paid.
export const PAYMENT_POLL_MS = 3000;

// What the server returns when it creates a QR order.
export interface PaymentOrder {
  orderCode: string;
  method: OnlineMethod;
  amount: number;
  remarks: string;
  qrPayload: string;
  expiresAt: string; // ISO time the QR (and the held slot) runs out
}

export type PaymentStatus = "pending" | "paid" | "expired";

// A guest has no account, so the server matches the order to the phone number they gave.
export async function fetchPaymentStatus(orderCode: string, guestPhone?: string): Promise<PaymentStatus> {
  try {
    const r = await api<{ status: string }>(`/payments/${encodeURIComponent(orderCode)}/status`, { query: { phone: guestPhone } });
    return r.status === "paid" ? "paid" : r.status === "expired" ? "expired" : "pending";
  } catch {
    return "pending"; // a network blip: keep waiting, the next check tries again
  }
}

// Only works while the backend uses its TEST gateway (never in production): pretends the gateway reported the payment.
export async function testPay(orderCode: string) {
  await api(`/payments/${encodeURIComponent(orderCode)}/test-pay`, { method: "POST" });
}

export const isTestQr = (payload: string) => payload.startsWith("UF-TEST|");
