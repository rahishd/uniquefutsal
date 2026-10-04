// Quick Rebook: detect a customer's usual weekday + hour from their past bookings
// and find the next date that slot is open. Pure functions, no network.

import { MAX_ADVANCE_DAYS, dateKey, getSlots, parseKey, priceFor } from "@/lib/booking";

export interface PastBooking {
  dateKey: string; // YYYY-MM-DD
  hour: number; // start hour, 0-23
}

export interface UsualSlot {
  weekday: number; // 0 = Sunday
  hour: number;
  count: number; // times played at this weekday + hour
  total: number; // bookings considered
}

const MIN_REPEATS = 2; // need at least two games in the same weekday + hour to call it a habit
const RECENT_LIMIT = 12; // only the latest bookings reflect current habits

export function detectUsualSlot(history: PastBooking[]): UsualSlot | null {
  const recent = [...history].sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, RECENT_LIMIT);
  const tally = new Map<string, { weekday: number; hour: number; count: number; latest: string }>();
  for (const b of recent) {
    const weekday = parseKey(b.dateKey).getDay();
    const k = `${weekday}|${b.hour}`;
    const cur = tally.get(k);
    if (cur) cur.count++;
    else tally.set(k, { weekday, hour: b.hour, count: 1, latest: b.dateKey });
  }
  // Most frequent wins; ties go to the one played most recently.
  const best = [...tally.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))[0];
  if (!best || best.count < MIN_REPEATS) return null;
  return { weekday: best.weekday, hour: best.hour, count: best.count, total: recent.length };
}

export interface RebookTarget {
  dateKey: string;
  available: boolean; // false if every upcoming occurrence in the window is taken
  price: number;
}

// First upcoming occurrence of the usual weekday inside the booking window,
// preferring one whose slot is actually open.
export function findRebookTarget(usual: UsualSlot, now: Date): RebookTarget {
  const candidates: string[] = [];
  for (let i = 0; i <= MAX_ADVANCE_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === usual.weekday) candidates.push(dateKey(d));
  }
  const price = priceFor(usual.hour);
  for (const key of candidates) {
    const slot = getSlots(key, now).find((s) => s.hour === usual.hour);
    if (slot && slot.status !== "booked" && slot.status !== "past") {
      return { dateKey: key, available: true, price: slot.price };
    }
  }
  return { dateKey: candidates[0] ?? dateKey(now), available: false, price };
}
