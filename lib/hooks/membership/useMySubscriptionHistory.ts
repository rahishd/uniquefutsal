import { useQuery } from "@tanstack/react-query";
import { getMySubscriptionHistory } from "@/lib/api/membership";
import { membershipKeys, membershipQueryOptions } from "./queries";

export function useMySubscriptionHistory(params?: { enabled?: boolean }) {
  return useQuery({
    queryKey: membershipKeys.mySubscriptionHistory(),
    queryFn: getMySubscriptionHistory,
    enabled: Boolean(params?.enabled ?? true),
    ...membershipQueryOptions,
  });
}
