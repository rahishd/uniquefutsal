/**
 * Hook: Fetch available time slots for a specific date and duration
 * @param date - Date in YYYY-MM-DD format
 * @param duration - Number of hours
 * @param enabled - Whether to enable the query
 * @returns Query result with available slots
 */

import { useQuery } from "@tanstack/react-query";
import { getAvailableSlots } from "@/lib/api/bookings";
import { bookingKeys, slotsQueryOptions } from "./queries";

export function useAvailableSlots(
  date: string,
  duration: number = 1,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: bookingKeys.availableSlots(date, duration),
    queryFn: () => getAvailableSlots(date, duration),
    enabled: enabled && !!date,
    ...slotsQueryOptions,
  });
}
