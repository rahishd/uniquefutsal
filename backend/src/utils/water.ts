// Complimentary mineral water. Every game includes 2 bottles, EXCEPT a game that already gets a discount:
// a VIP discount never includes water, and a promo code includes it only when staff switched "includes water" on for that code.
// Staff can also switch it off for one booking in the admin portal. One rule, used by the quote and by the booking itself.
export const COMPLIMENTARY_WATER = 2;

export type WaterExcluded = "vip" | "promo" | null;
export interface WaterInfo {
  bottles: number;
  excluded: WaterExcluded; // why there is no water (shown to the customer), null when it is included
}

export function waterFor(applied: { vip: boolean; promo: { includesWater?: boolean } | null }): WaterInfo {
  if (applied.vip) return { bottles: 0, excluded: "vip" };
  if (applied.promo && !applied.promo.includesWater) return { bottles: 0, excluded: "promo" };
  return { bottles: COMPLIMENTARY_WATER, excluded: null };
}
