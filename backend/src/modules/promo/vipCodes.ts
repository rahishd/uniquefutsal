import { VipCode } from "@prisma/client";
import { prisma } from "../../config/db";

// VIP code: staff give one customer a special code (for example ADMINVIP) worth a percent or a rupee amount off.
// The customer types it once at booking; from then on it is applied to every booking they make, with nothing to type,
// until staff pause or remove it. If the customer also types a normal promo code, the bigger discount wins.
export const vipLabel = (v: Pick<VipCode, "type" | "value">) => (v.type === "percent" ? `VIP ${v.value}% off` : `VIP Rs. ${v.value} off`);

export const vipDiscount = (v: Pick<VipCode, "type" | "value">, amount: number) =>
  v.type === "percent" ? Math.round((amount * v.value) / 100) : Math.min(v.value, amount);

// The VIP code of this customer when it should apply to a booking: it is active AND the customer typed it now or before.
export async function vipForBooking(userId: string | null | undefined, entered?: string | null): Promise<{ vip: VipCode | null; entered: boolean }> {
  if (!userId) return { vip: null, entered: false };
  const vip = await prisma.vipCode.findFirst({ where: { userId, active: true } });
  if (!vip) return { vip: null, entered: false };
  const typed = !!entered && entered.trim().toUpperCase() === vip.code;
  if (!typed && !vip.claimedAt) return { vip: null, entered: false }; // not claimed yet
  return { vip, entered: typed };
}

export async function claimVip(vip: VipCode): Promise<void> {
  if (!vip.claimedAt) await prisma.vipCode.updateMany({ where: { id: vip.id, claimedAt: null }, data: { claimedAt: new Date() } });
}
