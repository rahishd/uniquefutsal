/**
 * Hook: Fetch occupancy (bookings + memberships) for a specific date
 * Cached by date and can auto-refetch on an interval.
 */

import { useQuery } from "@tanstack/react-query";
import { getOccupancy } from "@/lib/api/bookings";
import { bookingKeys } from "./queries";

export function useOccupancy(params: {
  date: string;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
}) {
  return useQuery({
    queryKey: bookingKeys.occupancy(params.date),
    queryFn: () => getOccupancy(params.date),
    enabled: Boolean(params.enabled ?? true) && Boolean(params.date),
    staleTime: 5 * 1000,
    gcTime: 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchInterval: params.refetchIntervalMs ?? false,
  });
}

