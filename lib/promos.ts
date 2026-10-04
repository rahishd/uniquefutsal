// Promo codes shown to customers (Home "Live promo codes" and the /promos page).
//
// DEMO DATA. The server owns promo codes: it decides who can use which code, when, and the
// discount. The codes here must match what the booking and membership screens accept; the real
// server validates every code again when a booking or membership is created.

import { useSyncExternalStore } from "react";
import { dateKey, parseKey } from "@/lib/booking";

export type PromoKind = "booking" | "membership";
export type PromoStatus = "active" | "upcoming" | "expired";

export interface Promo {
  id: string;
  kind: PromoKind;
  title: string;
  code: string;
  discount: string; // short badge text
  description: string;
  terms: string;
  from: string; // YYYY-MM-DD, first day the code works
  until: string; // YYYY-MM-DD, last day the code works
}

export const promos: Promo[] = [
  { id: "p1", kind: "booking", title: "Dashain Special", code: "DASHAIN83", discount: "15% OFF", description: "Any game, any shift", terms: "One use per booking. Cannot be combined with another code.", from: "2026-10-01", until: "2026-10-16" },
  { id: "p2", kind: "booking", title: "Weekend Warriors", code: "WEEKEND10", discount: "10% OFF", description: "Saturday and Sunday games", terms: "Valid only for games played on a Saturday or Sunday.", from: "2026-10-01", until: "2026-10-31" },
  { id: "p3", kind: "booking", title: "Morning Kickoff", code: "EARLY200", discount: "Rs. 200 OFF", description: "Slots before 8 AM", terms: "Valid only for slots that start before 8 AM.", from: "2026-10-01", until: "2026-11-30" },
  { id: "p4", kind: "membership", title: "Member Welcome", code: "MEMBER10", discount: "10% OFF", description: "Any new membership plan", terms: "Applied at the membership payment step.", from: "2026-10-01", until: "2026-12-31" },
  { id: "p5", kind: "membership", title: "Renew & Save", code: "RENEW200", discount: "Rs. 200 OFF", description: "Membership renewals only", terms: "Only for customers renewing an existing membership.", from: "2026-10-01", until: "2026-12-31" },
  { id: "p6", kind: "booking", title: "Tihar Lights", code: "TIHAR20", discount: "20% OFF", description: "Evening games during Tihar", terms: "Valid only for evening slots (5 PM onwards).", from: "2026-11-05", until: "2026-11-15" },
  { id: "p7", kind: "booking", title: "Monsoon Match", code: "MONSOON15", discount: "15% OFF", description: "Weekday day games", terms: "Offer has ended.", from: "2026-07-01", until: "2026-09-15" },
];

export function statusOf(p: Promo, today: string): PromoStatus {
  return today < p.from ? "upcoming" : today > p.until ? "expired" : "active";
}

export function daysBetween(fromKey: string, toKey: string) {
  return Math.round((parseKey(toKey).getTime() - parseKey(fromKey).getTime()) / 86400000);
}

export function fmtDay(key: string) {
  return parseKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// "" until the page is running in the browser (avoids showing the wrong tab on first paint).
export function useToday(): string {
  return useSyncExternalStore(
    () => () => {},
    () => dateKey(new Date()),
    () => "",
  );
}
