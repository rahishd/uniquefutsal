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
