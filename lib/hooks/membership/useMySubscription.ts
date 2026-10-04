import { useQuery } from "@tanstack/react-query";
import { getMySubscription } from "@/lib/api/membership";
import { membershipKeys, membershipQueryOptions } from "./queries";

export function useMySubscription(params?: { enabled?: boolean }) {
  return useQuery({
    queryKey: membershipKeys.mySubscription(),
    queryFn: getMySubscription,
    enabled: Boolean(params?.enabled ?? true),
    ...membershipQueryOptions,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

