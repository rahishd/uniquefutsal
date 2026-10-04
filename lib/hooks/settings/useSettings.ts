/**
 * Hook: Fetch all settings including promo codes, pricing, etc.
 * @returns Query result with settings data
 */

import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api/settings";
import { settingsKeys, settingsQueryOptions } from "./queries";

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: getSettings,
    ...settingsQueryOptions,
  });
}
