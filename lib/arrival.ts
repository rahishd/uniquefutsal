// "I'm coming" check-in: shown full-screen when a booked game is about to start.
// The customer slides to confirm and the venue (admin side, not built yet) gets an alert.

export const ARRIVAL_LEAD_MS = 60 * 60 * 1000; // prompt appears 1 hour before kick-off
export const ARRIVAL_GRACE_MS = 30 * 60 * 1000; // and stays available for 30 min after it starts
export const SNOOZE_MS = 10 * 60 * 1000;

const KEY = "uf-arrival-v1";

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

// DEMO: pretends to alert the venue. The real call must be a server endpoint
// (for example POST /api/bookings/:id/arrival) that checks the booking belongs to the signed-in
// customer and then notifies admin by push, SMS or dashboard. Nothing is sent anywhere yet.
export async function confirmComing(bookingId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700));
  patch(bookingId, { coming: true, at: Date.now() });
}
