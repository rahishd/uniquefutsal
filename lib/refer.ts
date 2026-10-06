// Refer & Earn (Popular > Refer & Earn). A customer books a game on behalf of ANOTHER team and files it here with that team's
// captain. The venue checks it in the admin portal; when approved, BOTH get loyalty points (amounts set by the venue).
// The server writes the points, never the app.

import { api } from "@/lib/api";

export interface ReferRules {
  enabled: boolean;
  referrerPoints: number;
  friendPoints: number;
  perDay: number;
}

export type ReferStatus = "pending" | "approved" | "rejected";

export interface Referral {
  id: string;
  code: string;
  role: "referrer" | "friend";
  status: ReferStatus;
  teamName: string;
  bookingCode: string | null;
  gameDate: string;
  gameTime: string;
  referrerName: string | null;
  friendName: string | null;
  points: number; // what THIS customer gets
  staffNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface EligibleBooking {
  code: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface ReferMe {
  rules: ReferRules;
  referrals: Referral[];
  eligibleBookings: EligibleBooking[];
}

export const STATUS_TEXT: Record<ReferStatus, { label: string; tone: string }> = {
  pending: { label: "Waiting for the venue", tone: "bg-amber-400/25 text-amber-700" },
  approved: { label: "Points added", tone: "bg-emerald-400/25 text-emerald-700" },
  rejected: { label: "Not approved", tone: "bg-slate-300/50 text-slate-600" },
};

export const loadRules = () => api<ReferRules>("/refer/rules", { auth: "none" });
export const loadMe = () => api<ReferMe>("/refer/me");
export const sendReferral = (body: { bookingCode: string; friendPhone: string; teamName: string }) => api<Referral>("/refer", { method: "POST", body });
export const bookAndRefer = (body: { date: string; startTime: string; friendPhone: string; friendName: string }) => api<Referral>("/refer/book", { method: "POST", body });
export const withdrawReferral = (id: string) => api<{ id: string }>(`/refer/${id}`, { method: "DELETE" });

export function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
