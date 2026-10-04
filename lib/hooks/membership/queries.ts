export const membershipKeys = {
  all: ["membership"] as const,
  plans: (params: { includeInactive: boolean }) =>
    [...membershipKeys.all, "plans", params] as const,
  timeSlots: (startDate?: string) =>
    [...membershipKeys.all, "timeSlots", startDate || ""] as const,
  mySubscription: () => [...membershipKeys.all, "mySubscription"] as const,
  mySubscriptionHistory: () => [...membershipKeys.all, "mySubscriptionHistory"] as const,
  subscriptions: () => [...membershipKeys.all, "subscriptions"] as const,
};

export const membershipQueryOptions = {
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: false,
};

