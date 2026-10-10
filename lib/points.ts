// Loyalty points: the rules as shown to customers (page text, Help page, booking hints).
// The server owns the real ledger, expiry and spending (see lib/loyalty.ts); these numbers only explain the rules
// and must match src/utils/loyaltyPoints.ts in the backend.

export const RS_PER_POINT = 100; // Rs. 100 of game price = 1 point
export const FREE_GAME_DIVISOR = 10; // a free game costs (shift price ÷ 10) points: Rs. 1,250 = 125 points
export const GZ_POINTS_PER_HOUR = 5; // every Gamezone hour played earns 5 points
export const POINTS_CAPTAIN_WIN = 5; // only the winning captain of a challenge game
export const GAME_POINTS_MONTHS = 3; // game points last 3 months
export const GOODS_POINTS_MONTHS = 12; // extra-goods points last 1 year
export const MEMBERSHIP_POINTS: Record<string, number> = { quarterly: 30, half: 70 }; // never expire

export const SHIFT_HOURS: Record<string, string> = { Morning: "6 AM – 10 AM", Day: "10 AM – 5 PM", Evening: "5 PM – 10 PM" };

// Points are kept to one decimal (a Rs. 1,250 game = 12.5).
export function fmtPts(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
