import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BookingFilters,
  getBookingsPaginated,
  PaginatedResponse,
  Booking,
} from "@/lib/api/bookings";
import { bookingKeys, bookingQueryOptions } from "./queries";

export function useBookingsPaginated(params: {
  filters?: BookingFilters;
  page: number;
  limit: number;
  refetchIntervalMs?: number;
}) {
  return useQuery<PaginatedResponse<Booking>>({
    queryKey: bookingKeys.paginated({
      filters: params.filters,
      page: params.page,
      limit: params.limit,
    }),
    queryFn: () =>
      getBookingsPaginated({
        filters: params.filters,
        page: params.page,
        limit: params.limit,
      }),
    ...bookingQueryOptions,
    placeholderData: keepPreviousData,
    refetchInterval: params.refetchIntervalMs ?? false,
  });
}

