import { useQuery } from "@tanstack/react-query";
import { getAllSubscriptions } from "@/lib/api/membership";
import { membershipKeys, membershipQueryOptions } from "./queries";

export function useAllSubscriptions(params?: { enabled?: boolean }) {
  return useQuery({
    queryKey: membershipKeys.subscriptions(),
    queryFn: getAllSubscriptions,
    enabled: Boolean(params?.enabled ?? true),
    ...membershipQueryOptions,
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
  });
}

