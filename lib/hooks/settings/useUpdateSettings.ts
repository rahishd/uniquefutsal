/**
 * Hook: Update settings
 * Automatically invalidates settings cache on success
 * @returns Mutation hook for updating settings
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSettings, SettingsData } from "@/lib/api/settings";
import { settingsKeys } from "./queries";

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<SettingsData>) => updateSettings(updates),
    onSuccess: (data) => {
      // Invalidate all settings-related queries
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      
      // Optionally: Set query data immediately for optimistic update
      queryClient.setQueryData(settingsKeys.detail(), data);
    },
    onError: (error) => {
      console.error("Failed to update settings:", error);
    },
  });
}
