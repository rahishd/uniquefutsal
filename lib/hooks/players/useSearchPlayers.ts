import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import { playerKeys, playerQueryOptions } from "./queries";

export function useSearchPlayers(params: { query: string; enabled?: boolean }) {
  const normalizedQuery = params.query.trim();

  return useQuery({
    queryKey: playerKeys.search(normalizedQuery),
    queryFn: () => usersApi.searchPlayers(normalizedQuery),
    enabled: Boolean(params.enabled ?? true) && normalizedQuery.length > 0,
    ...playerQueryOptions,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

