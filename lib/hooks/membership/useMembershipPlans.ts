import { useQuery } from "@tanstack/react-query";
import { getPlans } from "@/lib/api/membership";
import { membershipKeys, membershipQueryOptions } from "./queries";

export function useMembershipPlans(params?: { includeInactive?: boolean; enabled?: boolean }) {
  const includeInactive = Boolean(params?.includeInactive ?? false);

  return useQuery({
    queryKey: membershipKeys.plans({ includeInactive }),
    queryFn: () => getPlans(includeInactive),
    enabled: Boolean(params?.enabled ?? true),
    ...membershipQueryOptions,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

