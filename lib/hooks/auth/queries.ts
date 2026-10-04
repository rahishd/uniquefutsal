export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export const authQueryOptions = {
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: 1,
  refetchOnWindowFocus: false,
};

