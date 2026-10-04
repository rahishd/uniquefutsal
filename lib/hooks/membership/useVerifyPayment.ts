import { useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyPayment } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subscriptionId, sendSms }: { subscriptionId: string, sendSms?: boolean }) => 
      verifyPayment(subscriptionId, sendSms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

