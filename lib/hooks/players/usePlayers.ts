import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import { playerKeys, playerQueryOptions } from "./queries";

export function usePlayers(params: { page: number; limit: number; search?: string }) {
  return useQuery({
    queryKey: playerKeys.list(params),
    queryFn: () => usersApi.getAllPlayers(params.page, params.limit, params.search),
    ...playerQueryOptions,
    placeholderData: (previous) => previous,
  });
}

