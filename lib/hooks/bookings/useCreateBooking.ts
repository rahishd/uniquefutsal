/**
 * Hook: Create a new booking
 * Automatically invalidates bookings cache on success
 * @returns Mutation hook for creating bookings
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBooking, CreateBookingData } from "@/lib/api/bookings";
import { bookingKeys } from "./queries";

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookingData) => createBooking(data),
    onSuccess: (data) => {
      // Invalidate all booking-related queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      
      // Optionally: Add optimistic update or set query data
      // queryClient.setQueryData(bookingKeys.detail(data.id), data);
    },
    onError: (error) => {
      console.error("Failed to create booking:", error);
    },
  });
}
