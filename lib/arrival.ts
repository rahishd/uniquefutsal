// "I'm coming" check-in: shown full-screen when a booked game is about to start.
// The customer slides to confirm and the server records it so staff can see who is on the way
// (POST /bookings/:id/arrival and POST /gamezone/bookings/:code/arrival). The server only accepts it from
// 1 hour before the start until 30 minutes after, and only from the booking's owner.

import { useMemo } from "react";
import { api } from "@/lib/api";
import { myBookingsStore, startsAtMs } from "@/lib/booking";
import { myGzStore } from "@/lib/gamezone";

export const ARRIVAL_LEAD_MS = 60 * 60 * 1000; // prompt appears 1 hour before kick-off
export const ARRIVAL_GRACE_MS = 30 * 60 * 1000; // and stays available for 30 min after it starts
export const SNOOZE_MS = 10 * 60 * 1000;

const KEY = "uf-arrival-v1"; // only "remind me later" and "already confirmed" are remembered here, per browser

export interface ArrivalEntry {
  coming?: boolean;
  at?: number; // when the customer confirmed
  snoozeUntil?: number;
}

type ArrivalState = Record<string, ArrivalEntry>;

export function loadArrival(): ArrivalState {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ArrivalState;
  } catch {
    return {};
  }
}

function patch(id: string, entry: ArrivalEntry) {
  const all = loadArrival();
  all[id] = { ...all[id], ...entry };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked: the prompt may show again on reload
  }
}

export function snoozeArrival(id: string) {
  patch(id, { snoozeUntil: Date.now() + SNOOZE_MS });
}

export interface ArrivalTarget {
  id: string; // booking id or Gamezone code
  code?: string; // short code to show
  kind: "court" | "gamezone";
  startsAt: number; // epoch ms
  label?: string; // shown on the check-in screen
}

// The customer's active bookings the check-in can apply to.
export function useArrivalTargets(): ArrivalTarget[] {
  const courts = myBookingsStore.use().data;
  const gz = myGzStore.use().data;
  return useMemo(() => {
    const out: ArrivalTarget[] = [];
    for (const b of courts ?? []) {
      if (b.status === "cancelled" || b.status === "completed") continue;
      out.push({ id: b.id, code: b.code, kind: "court", startsAt: startsAtMs(b) });
    }
    for (const g of gz ?? []) {
      if (g.status !== "confirmed") continue;
      const d = new Date(`${g.date}T00:00:00`);
      d.setHours(g.startHour, 0, 0, 0);
      out.push({ id: g.code, kind: "gamezone", startsAt: d.getTime(), label: "PS5 Gamezone" });
    }
    return out;
  }, [courts, gz]);
}

export async function confirmComing(t: ArrivalTarget): Promise<void> {
  const path = t.kind === "court" ? `/bookings/${encodeURIComponent(t.id)}/arrival` : `/gamezone/bookings/${encodeURIComponent(t.id)}/arrival`;
  await api(path, { method: "POST" });
  patch(t.id, { coming: true, at: Date.now() });
}
