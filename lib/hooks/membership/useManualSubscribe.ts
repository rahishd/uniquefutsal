import { useMutation, useQueryClient } from "@tanstack/react-query";
import { manualSubscribe } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useManualSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => manualSubscribe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}
