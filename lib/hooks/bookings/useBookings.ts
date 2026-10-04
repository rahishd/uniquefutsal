/**
 * Hook: Fetch all bookings with optional filters
 * @param filters - Optional filters for date, status, userId
 * @returns Query result with bookings data
 */

import { useQuery } from "@tanstack/react-query";
import { getBookings, BookingFilters } from "@/lib/api/bookings";
import { bookingKeys, bookingQueryOptions } from "./queries";

export function useBookings(
  filters?: BookingFilters,
  options?: { enabled?: boolean; refetchIntervalMs?: number | false },
) {
  return useQuery({
    queryKey: bookingKeys.list(filters),
    queryFn: () => getBookings(filters),
    enabled: options?.enabled ?? true,
    ...bookingQueryOptions,
    refetchInterval: options?.refetchIntervalMs ?? 15000, // Poll every 15 seconds for admin dashboards
  });
}
