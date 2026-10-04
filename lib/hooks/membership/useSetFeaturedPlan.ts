import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setFeaturedPlan } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useSetFeaturedPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => setFeaturedPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

