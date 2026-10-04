export const playerKeys = {
  all: ["players"] as const,
  lists: () => [...playerKeys.all, "list"] as const,
  list: (params: { page: number; limit: number; search?: string }) =>
    [...playerKeys.lists(), params] as const,
  detail: (phoneNumber: string) =>
    [...playerKeys.all, "detail", phoneNumber] as const,
  bookings: (phoneNumber: string) =>
    [...playerKeys.all, "bookings", phoneNumber] as const,
  search: (query: string) => [...playerKeys.all, "search", query] as const,
};

export const playerQueryOptions = {
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: true,
};

