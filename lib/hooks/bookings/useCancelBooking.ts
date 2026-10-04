/**
 * Hook: Cancel a booking
 * Automatically invalidates bookings cache on success
 * @returns Mutation hook for cancelling bookings
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelBooking } from "@/lib/api/bookings";
import { bookingKeys } from "./queries";

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: (data) => {
      // Invalidate all booking-related queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      
      // Update specific booking in cache
      queryClient.setQueryData(bookingKeys.detail(data.id), data);
    },
    onError: (error) => {
      console.error("Failed to cancel booking:", error);
    },
  });
}
