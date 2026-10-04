import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSubscription } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) => deleteSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

