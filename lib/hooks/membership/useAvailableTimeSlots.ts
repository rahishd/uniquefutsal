import { useQuery } from "@tanstack/react-query";
import { getAvailableTimeSlots } from "@/lib/api/membership";
import { membershipKeys, membershipQueryOptions } from "./queries";

export function useAvailableTimeSlots(params: { startDate?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: membershipKeys.timeSlots(params.startDate),
    queryFn: () => getAvailableTimeSlots(params.startDate),
    enabled: Boolean(params.enabled ?? true),
    ...membershipQueryOptions,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

