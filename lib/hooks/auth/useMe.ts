import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/api/auth";
import { authKeys, authQueryOptions } from "./queries";

export function useMe(params?: { enabled?: boolean }) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: getMe,
    enabled: Boolean(params?.enabled ?? true),
    ...authQueryOptions,
  });
}

