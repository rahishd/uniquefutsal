import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import { playerKeys, playerQueryOptions } from "./queries";

export function usePlayerBookings(phoneNumber?: string) {
  return useQuery({
    queryKey: playerKeys.bookings(phoneNumber || ""),
    queryFn: () => usersApi.getPlayerBookings(phoneNumber || ""),
    ...playerQueryOptions,
    enabled: Boolean(phoneNumber),
  });
}

