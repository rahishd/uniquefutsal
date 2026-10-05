// Membership for customers who are already registered (same phone number and password): no extra sign-up.
// The customer picks a plan, a fixed hour and a start date; the SERVER works out the price and creates a request.
// The customer pays at the venue and the staff activate it (the developer's existing membership flow).

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

// Customers on 3 and 6 month plans get a renewal reminder this many days before their plan ends.
export const EXPIRY_NOTICE_DAYS = 15;

export type Duration = "1_month" | "3_months";
export const DURATION_LABEL: Record<Duration, string> = { "1_month": "1 month", "3_months": "3 months" };
export type TimeOfDay = "morning" | "day" | "evening";

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  featured: boolean;
  perks: string[];
  prices: Record<Duration, Record<TimeOfDay, number | null>>; // null = not offered
}

export interface MySubscription {
  id: string;
  plan: string;
  status: string; // pending | active | cancelled | expired
  paymentStatus: string;
  timeSlot: string | null;
  duration: string | null;
  startDate: string;
  endDate: string;
  total: number | null;
}

export interface MyMembership {
  current: MySubscription | null;
  history: MySubscription[];
}

export const plansStore = createRemoteStore<MembershipPlan[]>(() => api<MembershipPlan[]>("/membership/offers", { auth: "none" }));
export const myMembershipStore = createRemoteStore<MyMembership | null>(() => api<MyMembership>("/membership/mine"), { signedOut: null });

export interface SlotInfo {
  slot: string; // "07:00-08:00"
  available: boolean;
}
export const fetchSlots = (startDate: string) => api<SlotInfo[]>("/membership/timeslots", { query: { startDate }, auth: "none" });

// The same time-of-day rule the server uses to price a slot (4 PM to 8 PM is never offered for memberships).
export const PEAK_SLOTS = ["16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"];
export const timeOfDay = (slot: string): TimeOfDay => {
  const h = parseInt(slot.split(":")[0], 10);
  return h < 12 ? "morning" : h < 20 ? "day" : "evening";
};

export async function requestMembership(p: { planId: string; timeSlot: string; duration: Duration; startDate: string }) {
  const r = await api<{ id: string; total: number }>("/membership/request", { method: "POST", body: p });
  await myMembershipStore.refresh();
  return r;
}
