/**
 * Hook: Fetch active promo codes
 * Filters out expired promo codes
 * @returns Query result with active promo codes
 */

import { useQuery } from "@tanstack/react-query";
import { getSettings, PromoCode } from "@/lib/api/settings";
import { settingsKeys, settingsQueryOptions } from "./queries";

// Check if promo is expired
const isPromoExpired = (promo: PromoCode): boolean => {
  if (!promo.expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(promo.expiryDate);
  return expiry < today;
};

export function usePromoCodes() {
  return useQuery({
    queryKey: settingsKeys.promoCodes(),
    queryFn: async () => {
      const data = await getSettings();
      return data.settings.promoCodes || [];
    },
    ...settingsQueryOptions,
    select: (promoCodes) => ({
      all: promoCodes,
      active: promoCodes.filter((p) => !isPromoExpired(p)),
      expired: promoCodes.filter((p) => isPromoExpired(p)),
    }),
  });
}
