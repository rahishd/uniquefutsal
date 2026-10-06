import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";

// Staff can switch a promo code (or all of them, code "*") off for one customer. The choice is remembered: it applies to
// every later booking and membership request until staff switch it back on. Guests have no account, so no rules.
export const PROMO_BLOCKED_MESSAGE = "This promo code is not available for your account. Please contact the venue.";

export async function blockedPromoCodes(userId?: string | null): Promise<{ all: boolean; codes: Set<string> }> {
  if (!userId) return { all: false, codes: new Set() };
  const rows = await prisma.customerPromoRule.findMany({ where: { userId }, select: { code: true } });
  return { all: rows.some((r) => r.code === "*"), codes: new Set(rows.map((r) => r.code)) };
}

export async function isPromoBlocked(userId: string | null | undefined, code: string): Promise<boolean> {
  if (!userId) return false;
  const b = await blockedPromoCodes(userId);
  return b.all || b.codes.has(code.trim().toUpperCase());
}

export async function assertPromoAllowed(userId: string | null | undefined, code: string): Promise<void> {
  if (await isPromoBlocked(userId, code)) throw new AppError(400, PROMO_BLOCKED_MESSAGE);
}
