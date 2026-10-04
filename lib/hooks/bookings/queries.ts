/**
 * React Query configuration for bookings
 * Centralized query keys and default options
 */

import { BookingFilters } from "@/lib/api/bookings";

// Query keys factory for type-safe cache management
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters?: BookingFilters) => [...bookingKeys.lists(), filters] as const,
  paginated: (params: { filters?: BookingFilters; page: number; limit: number }) =>
    [...bookingKeys.lists(), "paginated", params] as const,
  detail: (id: string) => [...bookingKeys.all, "detail", id] as const,
  occupancy: (date: string) => [...bookingKeys.all, "occupancy", date] as const,
  availableSlots: (date: string, duration: number) =>
    [...bookingKeys.all, "slots", date, duration] as const,
};

// Default query options
export const bookingQueryOptions = {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 5 * 60 * 1000, // 5 minutes in cache
  retry: 2,
  refetchOnWindowFocus: true,
};

export const slotsQueryOptions = {
  staleTime: 10 * 1000, // 10 seconds - slots change frequently
  gcTime: 60 * 1000, // 1 minute in cache
  retry: 2,
  refetchOnWindowFocus: true,
};
