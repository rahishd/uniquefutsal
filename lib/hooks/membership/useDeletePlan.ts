import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePlan } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

