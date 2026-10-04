import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSubscription, MembershipSubscription } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MembershipSubscription> }) => 
      updateSubscription(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}
