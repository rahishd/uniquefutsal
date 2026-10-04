import { useMutation, useQueryClient } from "@tanstack/react-query";
import { subscribe } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

interface SubscribeInput {
  planId: string;
  timeSlot?: string;
  startDate?: string;
  chosenDuration?: string;
  chosenCategory?: string;
  totalPrice?: number;
  chosenDays?: string[];
  promoCode?: string;
}

export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubscribeInput) =>
      subscribe(
        input.planId,
        input.timeSlot,
        input.startDate,
        input.chosenDuration,
        input.chosenCategory,
        input.totalPrice,
        input.chosenDays,
        input.promoCode,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

