// Membership data layer.
//
// DEMO IMPLEMENTATION: plans, prices, the customer's current membership and the purchase call
// are mocked. In production the plans/benefits/prices come from the backend, and activation
// happens only after the server verifies the payment (FRD sections 25-27, 33-35).

import { dateKey, formatRs, parseKey } from "@/lib/booking";

export type Billing = "monthly" | "yearly";

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number; // Rs. per month
  yearly: number; // Rs. per year
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
    yearly: 15000,
    monthlyAllowance: 4,
    benefits: ["Member pricing on bookings", "Loyalty points on every game", "Member-only offers"],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "For the serious squad",
    monthly: 3000,
    yearly: 30000,
    monthlyAllowance: 8,
    popular: true,
    benefits: ["Member pricing on bookings", "Priority booking window", "Double loyalty points", "Exclusive offers and early tournament sign-up"],
  },
];

export const BILLING_LABEL: Record<Billing, string> = { monthly: "Monthly", yearly: "Yearly" };

export function priceOf(plan: Plan, billing: Billing) {
  return billing === "monthly" ? plan.monthly : plan.yearly;
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

export const EXPIRING_SOON_DAYS = 14;

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

// Sample: the signed-in customer's current membership (replace with the API).
export const sampleCurrent: Membership = {
  id: "MEM-10291",
  planId: "premium",
  billing: "yearly",
  startKey: "2026-10-01",
  endKey: "2027-09-30",
  paid: 30000,
  usedThisMonth: 3,
};

export interface PurchaseRequest {
  planId: string;
  billing: Billing;
  method: "esewa" | "khalti" | "fonepay";
  name: string;
  phone: string;
}

export interface PurchaseResult {
  membership: Membership;
  total: number;
}

// DEMO: pretends to start a purchase. The real API creates the order, takes the payment through
// the gateway and activates the membership only after the gateway callback is verified server-side.
// Until then the membership is "Pending" and must never be treated as active.
export async function purchaseMembership(req: PurchaseRequest, current: Membership | null, today: string): Promise<PurchaseResult> {
  await new Promise((r) => setTimeout(r, 900));
  const plan = PLANS.find((p) => p.id === req.planId);
  if (!plan) throw new Error("This membership is no longer available.");
  const total = priceOf(plan, req.billing);
  // Renewing the same plan continues from the current end date; anything else starts today.
  const renewing = current && current.planId === plan.id && daysLeft(current.endKey, today) >= 0;
  const start = renewing ? new Date(parseKey(current!.endKey).getTime() + 86400000) : parseKey(today);
  const end = new Date(addMonths(start, req.billing === "monthly" ? 1 : 12).getTime() - 86400000);
  const digits = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return {
    total,
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
