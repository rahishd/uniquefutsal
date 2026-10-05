// Quick Rebook: detect a customer's usual weekday + hour from their past bookings (pure function).

import { weekdayOfKey } from "./dates";

export interface PastBooking {
  date: string; // YYYY-MM-DD
  hour: number; // start hour, 0-23
}

export interface UsualSlot {
  weekday: number; // 0 = Sunday
  hour: number;
  count: number; // times played at this weekday + hour
  total: number; // bookings considered
}

export const MIN_REPEATS = 2; // two games in the same weekday + hour make a habit
export const RECENT_LIMIT = 12; // only the latest bookings reflect current habits

export function detectUsualSlot(history: PastBooking[]): UsualSlot | null {
  const recent = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_LIMIT);
  const tally = new Map<string, { weekday: number; hour: number; count: number; latest: string }>();
  for (const b of recent) {
    const weekday = weekdayOfKey(b.date);
    const k = `${weekday}|${b.hour}`;
    const cur = tally.get(k);
    if (cur) cur.count++;
    else tally.set(k, { weekday, hour: b.hour, count: 1, latest: b.date });
  }
  // the most frequent wins; ties go to the one played most recently
  const best = [...tally.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))[0];
  if (!best || best.count < MIN_REPEATS) return null;
  return { weekday: best.weekday, hour: best.hour, count: best.count, total: recent.length };
}
