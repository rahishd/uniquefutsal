// Membership data layer.
//
// DEMO IMPLEMENTATION: plans, prices, the customer's current membership and the purchase call
// are mocked. In production the plans/benefits/prices come from the backend, and activation
// happens only after the server verifies the payment (FRD sections 25-27, 33-35).

import { dateKey, formatRs, parseKey } from "@/lib/booking";
import type { PayMethod } from "@/lib/payment";

export type Billing = "monthly" | "quarterly" | "half";

export const BILLING_MONTHS: Record<Billing, number> = { monthly: 1, quarterly: 3, half: 6 };
export const BILLINGS: Billing[] = ["monthly", "quarterly", "half"];

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number; // Rs. for 1 month
  quarterly: number; // Rs. for 3 months
  half: number; // Rs. for 6 months
  benefits: string[];
  popular?: boolean;
  monthlyAllowance: number; // member-priced games per month
}

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "For regular players",
    monthly: 1500,
    quarterly: 4200,
    half: 8000,
    monthlyAllowance: 4,
    benefits: ["Member pricing on bookings", "Loyalty points on every game", "Member-only offers"],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "For the serious squad",
    monthly: 3000,
    quarterly: 8400,
    half: 16000,
    monthlyAllowance: 8,
    popular: true,
    benefits: ["Member pricing on bookings", "Priority booking window", "Double loyalty points", "Exclusive offers and early tournament sign-up"],
  },
];

export const BILLING_LABEL: Record<Billing, string> = { monthly: "Monthly", quarterly: "3 Months", half: "6 Months" };

export function priceOf(plan: Plan, billing: Billing) {
  return plan[billing];
}

// How much a longer plan saves compared with paying month by month.
export function savings(plan: Plan, billing: Billing) {
  return Math.max(0, plan.monthly * BILLING_MONTHS[billing] - plan[billing]);
}

export function addMonths(d: Date, months: number) {
  const r = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  // keep end-of-month dates valid (e.g. 31 Jan + 1 month -> 28/29 Feb)
  if (r.getDate() !== d.getDate()) r.setDate(0);
  return r;
}

export function fmtDate(key: string) {
  return parseKey(key).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export type MemberStatus = "Active" | "Expiring soon" | "Expired" | "Suspended" | "Pending";

export interface Membership {
  id: string;
  planId: string;
  billing: Billing;
  startKey: string; // YYYY-MM-DD
  endKey: string;
  paid: number;
  suspended?: boolean;
  pendingVerification?: boolean;
  usedThisMonth: number;
}

// Customers on 3 and 6 month plans get a renewal pop-up this many days before their plan ends.
export const EXPIRY_NOTICE_DAYS = 15;
export const EXPIRING_SOON_DAYS = EXPIRY_NOTICE_DAYS;

export function daysLeft(endKey: string, today: string) {
  const ms = parseKey(endKey).getTime() - parseKey(today).getTime();
  return Math.round(ms / 86400000);
}

export function statusOf(m: Membership, today: string): MemberStatus {
  if (m.pendingVerification) return "Pending";
  if (m.suspended) return "Suspended";
  const left = daysLeft(m.endKey, today);
  if (left < 0) return "Expired";
  if (left <= EXPIRING_SOON_DAYS) return "Expiring soon";
  return "Active";
}

export function needsExpiryNotice(m: Membership, today: string) {
  if (m.billing === "monthly" || m.pendingVerification || m.suspended) return false;
  const left = daysLeft(m.endKey, today);
  return left >= 0 && left <= EXPIRY_NOTICE_DAYS;
}

// Sample: the signed-in customer's current membership (replace with the API).
export const sampleCurrent: Membership = {
  id: "MEM-10291",
  planId: "premium",
  billing: "half",
  startKey: "2026-10-01",
  endKey: "2027-03-31",
  paid: 16000,
  usedThisMonth: 3,
};

export interface PurchaseRequest {
  guest?: boolean; // true when nobody is signed in; guests must pay in full online
  planId: string;
  billing: Billing;
  method: PayMethod;
  promoCode?: string;
  name: string;
  phone: string;
}

export interface PurchaseResult {
  membership: Membership;
  base: number;
  discount: number;
  total: number;
  renewing: boolean; // same plan continued, versus a new or switched plan
  createdAt: number; // epoch ms; the QR hold counts from here (the server owns this in production)
}

export type MemberPromoResult =
  | { ok: true; code: string; discount: number; label: string }
  | { ok: false; message: string };

// DEMO membership promo codes. In production the server validates these.
const MEMBER_PROMOS: Record<string, { type: "percent" | "flat"; value: number; until: string; renewOnly?: boolean }> = {
  MEMBER10: { type: "percent", value: 10, until: "2026-12-31" },
  RENEW200: { type: "flat", value: 200, until: "2026-12-31", renewOnly: true },
};

export function validateMemberPromo(rawCode: string, ctx: { renewing: boolean; base: number; today: string }): MemberPromoResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, message: "Enter a promo code." };
  const p = MEMBER_PROMOS[code];
  if (!p) return { ok: false, message: "This promo code is invalid." };
  if (ctx.today > p.until) return { ok: false, message: "This promotional code has expired." };
  if (p.renewOnly && !ctx.renewing) return { ok: false, message: "This code is only valid when renewing your current plan." };
  const discount = p.type === "percent" ? Math.round((ctx.base * p.value) / 100) : Math.min(p.value, ctx.base);
  return { ok: true, code, discount, label: p.type === "percent" ? `${p.value}% off` : `${formatRs(p.value)} off` };
}

export function isRenewal(current: Membership | null, planId: string, today: string) {
  return Boolean(current && current.planId === planId && daysLeft(current.endKey, today) >= 0);
}

// DEMO: pretends to create the order. The real API creates the order, returns the gateway QR, and
// activates the membership only after the gateway callback is verified server-side. Until then the
// membership is "Pending" and must never be treated as active. Pay-at-venue stays pending until
// staff mark it paid.
export async function purchaseMembership(req: PurchaseRequest, current: Membership | null, today: string): Promise<PurchaseResult> {
  // The server must enforce this too: guests pay the full amount online, never at the venue.
  if (req.guest && req.method === "venue") throw new Error("Guests must pay in full online.");
  await new Promise((r) => setTimeout(r, 900));
  const plan = PLANS.find((p) => p.id === req.planId);
  if (!plan) throw new Error("This membership is no longer available.");
  const base = priceOf(plan, req.billing);
  const renewing = isRenewal(current, plan.id, today);
  // Re-validate the promo here: the browser's discount is never trusted.
  let discount = 0;
  if (req.promoCode) {
    const promo = validateMemberPromo(req.promoCode, { renewing, base, today });
    if (promo.ok) discount = promo.discount;
  }
  const total = Math.max(0, base - discount);
  // Renewing the same plan continues from the current end date; anything else starts today.
  const start = renewing ? new Date(parseKey(current!.endKey).getTime() + 86400000) : parseKey(today);
  const end = new Date(addMonths(start, BILLING_MONTHS[req.billing]).getTime() - 86400000);
  const digits = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return {
    base,
    discount,
    total,
    renewing,
    createdAt: Date.now(),
    membership: {
      id: `MEM-${digits}`,
      planId: plan.id,
      billing: req.billing,
      startKey: dateKey(start),
      endKey: dateKey(end),
      paid: total,
      pendingVerification: true,
      usedThisMonth: 0,
    },
  };
}

export { formatRs };
