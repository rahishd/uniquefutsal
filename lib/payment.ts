// Shared payment helpers for bookings and membership.
//
// DEMO IMPLEMENTATION. A real eSewa or Fonepay QR can only be created by YOUR server with your
// merchant account (it returns a one-off QR for an exact amount and reference). The browser must
// never build a payable QR or decide that a payment succeeded; the server confirms payments from
// the gateway callback (FRD sections 10, 33, 35).

export type PayMethod = "esewa" | "fonepay" | "venue";
export type OnlineMethod = Exclude<PayMethod, "venue">;

export const PAY_METHODS: { id: PayMethod; label: string; note: string }[] = [
  { id: "esewa", label: "eSewa", note: "Pay with QR" },
  { id: "fonepay", label: "Fonepay", note: "Pay with QR" },
  { id: "venue", label: "Pay at venue", note: "Cash or QR on arrival" },
];

export const METHOD_LABEL: Record<PayMethod, string> = { esewa: "eSewa", fonepay: "Fonepay", venue: "Pay at venue" };

export const isOnline = (m: PayMethod): m is OnlineMethod => m !== "venue";

// How long a QR (and the slot or order behind it) stays valid.
export const QR_HOLD_MS = 10 * 60 * 1000;

export type PaymentPurpose = "game" | "renew" | "purchase";

const PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  game: "Regular game",
  renew: "Membership renew",
  purchase: "Membership purchase",
};

// The remark the customer's payment carries, so the payment can be matched to the right order.
export function remarksFor(purpose: PaymentPurpose, reference: string) {
  return `${PURPOSE_LABEL[purpose]} - ${reference}`;
}

// DEMO payload. The real one is the QR string returned by the gateway through your server.
export function demoQrPayload(p: { method: OnlineMethod; amount: number; remarks: string }) {
  return `UF-DEMO|${p.method}|NPR ${p.amount}|${p.remarks}`;
}

/* ---------- automatic payment detection ---------- */

export type PaymentStatus = "pending" | "paid";

// How often the open QR screen asks the server whether the order has been paid.
export const PAYMENT_POLL_MS = 3000;

// Demo mode: there is no gateway yet, so a demo button stands in for it. Turn off in production.
export const DEMO_PAYMENTS = true;
const demoKey = (orderId: string) => `uf-demo-paid-${orderId}`;

// DEMO: reads a local flag that the demo button sets.
// PRODUCTION: replace the body with `GET /api/payments/:orderId/status`. The server sets "paid" only
// after eSewa/Fonepay confirm the payment (gateway callback, or the gateway's status-check API).
// The browser must never decide that a payment succeeded.
export async function fetchPaymentStatus(orderId: string): Promise<PaymentStatus> {
  try {
    return localStorage.getItem(demoKey(orderId)) === "1" ? "paid" : "pending";
  } catch {
    return "pending";
  }
}

// DEMO ONLY: pretends the gateway told the server the payment arrived.
export function demoSimulatePayment(orderId: string) {
  try {
    localStorage.setItem(demoKey(orderId), "1");
  } catch {
    // storage blocked
  }
}
