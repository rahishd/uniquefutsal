import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renewSubscription } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useRenewSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) => renewSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}
