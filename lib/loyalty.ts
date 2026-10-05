// My loyalty points, from the server (GET /loyalty/me). The server decides what was earned, what expired and
// what a free game costs; the app only shows it and asks to claim.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export type Period = "Morning" | "Day" | "Evening";

export interface LoyaltyRow {
  id: string;
  kind: "game" | "captain_win" | "goods" | "membership" | "free_game";
  points: number;
  earnedOn: string;
  expiresOn: string | null;
  detail: string;
  status: "valid" | "used" | "expired" | "never" | "spent";
}

export interface Bucket {
  points: number;
  nextExpiry: string | null;
}

export interface Voucher {
  id: string;
  period: Period;
  cost: number;
  claimedAt: string;
}

export interface Loyalty {
  earned: number;
  claimed: number;
  expired: number;
  remaining: number;
  expiringSoon: { points: number; date: string } | null;
  byType: { games: Bucket; goods: Bucket; membership: Bucket };
  rows: LoyaltyRow[];
  cheapestCost: number;
  toNext: number;
  shifts: { period: Period; price: number; perGame: number; cost: number; canClaim: boolean }[];
  vouchers: Voucher[];
}

export const loyaltyStore = createRemoteStore<Loyalty | null>(() => api<Loyalty>("/loyalty/me"), { signedOut: null });

export async function claimFreeGame(period: Period) {
  await api("/loyalty/claim", { method: "POST", body: { period } });
  await loyaltyStore.refresh();
}

export const progressPct = (l: Loyalty) => Math.min(100, Math.round((l.remaining / Math.max(1, l.cheapestCost)) * 100));
