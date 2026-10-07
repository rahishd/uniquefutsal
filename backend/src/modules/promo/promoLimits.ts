import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { PromoCode } from "../settings/settings.dto";

// How many times a promo code may be used. Staff set `maxUses` (everyone together) and `maxPerCustomer` in the admin portal.
// A use is a booking or membership that carries the code and was not cancelled, so cancelling gives the use back.
async function uses(code: string, userId?: string | null): Promise<number> {
  const who = userId ? { userId } : {};
  const [bookings, memberships] = await Promise.all([
    prisma.booking.count({ where: { promoCode: { equals: code, mode: "insensitive" }, status: { notIn: ["cancelled", "expired"] }, ...who } }),
    prisma.membershipSubscription.count({ where: { promoCode: { equals: code, mode: "insensitive" }, status: { not: "cancelled" }, ...who } }),
  ]);
  return bookings + memberships;
}

export async function promoUsedUp(promo: PromoCode): Promise<boolean> {
  return !!promo.maxUses && (await uses(promo.code)) >= promo.maxUses;
}

// Throws a clear message when the code has no uses left, for everyone or for this customer
export async function assertPromoLimits(promo: PromoCode, userId?: string | null): Promise<void> {
  if (promo.maxUses && (await uses(promo.code)) >= promo.maxUses) throw new AppError(400, "This promo code has been fully used.");
  if (promo.maxPerCustomer && userId && (await uses(promo.code, userId)) >= promo.maxPerCustomer) {
    throw new AppError(400, promo.maxPerCustomer === 1 ? "You have already used this promo code." : `You can use this promo code ${promo.maxPerCustomer} times, and you have used them all.`);
  }
}
