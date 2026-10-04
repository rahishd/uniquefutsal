// Gamezone: PS5 console bookings.
//
// DEMO IMPLEMENTATION: consoles, opening hours, availability and booking creation are mocked here.
// In production the server must own all of it (availability, price, payment status), like court
// bookings in lib/booking.ts.
//
// Pricing (per hour, per person): Solo Rs. 300, 2 players Rs. 200 each, 4 players Rs. 150 each.
// More hours multiply the same rate: total = rate x players x hours.

import { MAX_ADVANCE_DAYS, dateKey } from "@/lib/booking";
import type { PayMethod } from "@/lib/payment";

export const CONSOLES = [
  { id: "ps1", name: "PS5 Station 1" },
  { id: "ps2", name: "PS5 Station 2" },
]; // ASSUMPTION: two consoles. Set the real number here.

export const GAMES = ["GTA 5", "Forza Horizon", "Red Dead Redemption", "FIFA 26"] as const; // demo list
export type GameTitle = (typeof GAMES)[number];

export const OPEN_HOUR = 10; // ASSUMPTION: first session starts at 10 AM
export const CLOSE_HOUR = 22; // sessions must end by 10 PM
export const MAX_HOURS = 4;

export const PLANS = [
  { players: 1, label: "Solo", each: 300 },
  { players: 2, label: "2 Players", each: 200 },
  { players: 4, label: "4 Players", each: 150 },
] as const;

export type Players = (typeof PLANS)[number]["players"];

export function planOf(players: number) {
  return PLANS.find((p) => p.players === players) ?? PLANS[0];
}

export function priceFor(players: number, hours: number) {
  return planOf(players).each * players * hours;
}

function isTaken(key: string, hour: number, consoleId: string) {
  let h = 11;
  for (const ch of `gz|${key}|${hour}|${consoleId}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // mix the bits so neighbouring inputs (PS5 Station 1 vs 2) get unrelated results
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  h >>>= 0;
  return h % 100 < 35;
}

// Start times where THIS console is free for every hour of the session. Each console has its own
// bookings, so the list changes when the customer picks another console. Past times are left out.
export function getGzSlots(key: string, now: Date, hours: number, consoleId: string): number[] {
  const isToday = key === dateKey(now);
  const out: number[] = [];
  for (let hour = OPEN_HOUR; hour + hours <= CLOSE_HOUR; hour++) {
    if (isToday && hour <= now.getHours()) continue;
    let free = true;
    for (let h = hour; h < hour + hours; h++) if (isTaken(key, h, consoleId)) free = false;
    if (free) out.push(hour);
  }
  return out;
}

export interface GzRequest {
  guest?: boolean; // nobody signed in: must pay in full online
  dateKey: string;
  hour: number;
  hours: number;
  players: number;
  game: string;
  consoleId: string;
  method: PayMethod;
  name: string;
  phone: string;
}

export interface GzConfirmation {
  id: string;
  request: GzRequest;
  total: number;
  paymentStatus: "pending_payment" | "pay_at_venue" | "paid";
  createdAt: number;
}

// DEMO: pretends to create a booking. The real API re-checks availability in a transaction and
// recomputes the price itself.
export async function createGzBooking(req: GzRequest): Promise<GzConfirmation> {
  if (req.guest && req.method === "venue") throw new Error("Guests must pay in full online.");
  const limit = new Date();
  limit.setDate(limit.getDate() + MAX_ADVANCE_DAYS);
  if (req.dateKey > dateKey(limit)) throw new Error(`Bookings open only ${MAX_ADVANCE_DAYS} days in advance.`);
  if (!(GAMES as readonly string[]).includes(req.game)) throw new Error("Choose a game.");
  if (!PLANS.some((p) => p.players === req.players) || req.hours < 1 || req.hours > MAX_HOURS) throw new Error("Invalid session.");
  await new Promise((r) => setTimeout(r, 900));
  const digits = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return {
    id: `UF-GZ-${req.dateKey.replaceAll("-", "")}-${digits}`,
    request: req,
    total: priceFor(req.players, req.hours),
    paymentStatus: req.method === "venue" ? "pay_at_venue" : "pending_payment",
    createdAt: Date.now(),
  };
}
