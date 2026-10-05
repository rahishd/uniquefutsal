// Gamezone (PS5): consoles, games, rates, free times and bookings all come from the server
// (see uniquefutsal-backend/docs/API.md). Price is rate x players x hours; the server sets the final price.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import type { PayMethod, PaymentOrder } from "@/lib/payment";

export interface Catalog {
  consoles: { id: string; name: string }[];
  games: { id: string; title: string }[];
  plans: { players: number; label: string; ratePerPersonHour: number }[];
  maxHours: number;
  openHour: number;
  closeHour: number;
}

export const catalogStore = createRemoteStore<Catalog>(() => api<Catalog>("/gamezone/catalog", { auth: "none" }));

// Only for showing a price before booking; the server calculates the real one.
export const estimate = (rate: number, players: number, hours: number) => rate * players * hours;

// Start hours where THIS console is free for every hour of the session (each console has its own bookings).
export async function fetchGzSlots(date: string, hours: number, consoleId: string): Promise<number[]> {
  const r = await api<{ hours: number[] }>("/gamezone/slots", { query: { date, hours, consoleId }, auth: "none" });
  return r.hours;
}

export interface GzBooking {
  code: string;
  console: string;
  consoleId: string;
  game: string;
  date: string;
  startHour: number;
  hours: number;
  players: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string; // pending | pay_at_venue | paid
  status: string; // confirmed | cancelled | expired
}

export interface GzCheckout {
  booking: GzBooking;
  payment: PaymentOrder | null;
}

export function bookGamezone(p: {
  date: string;
  hour: number;
  hours: number;
  players: number;
  consoleId: string;
  game: string;
  method: PayMethod;
  guest?: { name: string; phone: string };
}): Promise<GzCheckout> {
  return api<GzCheckout>("/gamezone/bookings", { method: "POST", body: p });
}

export const myGzStore = createRemoteStore<GzBooking[]>(() => api<GzBooking[]>("/gamezone/bookings/me"), { signedOut: [] });

export async function cancelGz(code: string) {
  await api(`/gamezone/bookings/${encodeURIComponent(code)}/cancel`, { method: "POST" });
  await myGzStore.refresh();
}
