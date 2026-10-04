/**
 * React Query configuration for settings
 * Centralized query keys and default options
 */

// Query keys factory for type-safe cache management
export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => [...settingsKeys.all, "detail"] as const,
  promoCodes: () => [...settingsKeys.all, "promoCodes"] as const,
  timeSlots: () => [...settingsKeys.all, "timeSlots"] as const,
  hourlyPricing: () => [...settingsKeys.all, "hourlyPricing"] as const,
  addOns: () => [...settingsKeys.all, "addOns"] as const,
};

// Default query options
export const settingsQueryOptions = {
  staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change frequently
  gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  retry: 2,
  refetchOnWindowFocus: false, // Settings rarely change
};
