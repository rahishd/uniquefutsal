/**
 * Hook: Update an existing booking
 * Automatically invalidates bookings cache on success
 * @returns Mutation hook for updating bookings
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBooking } from "@/lib/api/bookings";
import { bookingKeys } from "./queries";

interface UpdateBookingParams {
  id: string;
  updates: {
    status?: "pending" | "confirmed" | "cancelled" | "completed";
    paymentStatus?: "pending" | "completed" | "partially_paid";
    notes?: string;
    cashAmount?: number;
    onlineAmount?: number;
    waterBottles?: number;
    addOns?: string;
    addOnsPrice?: number;
    totalPrice?: number;
    sendSms?: boolean;
    settlePreviousDues?: boolean;
    loyaltyEnabled?: boolean;
  };
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: UpdateBookingParams) =>
      updateBooking(id, updates),
    onSuccess: (data, variables) => {
      // Invalidate all booking-related queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      
      // Update specific booking in cache
      queryClient.setQueryData(bookingKeys.detail(variables.id), data);
    },
    onError: (error) => {
      console.error("Failed to update booking:", error);
    },
  });
}
