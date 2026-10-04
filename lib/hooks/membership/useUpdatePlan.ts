import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePlan, UpdatePlanData } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { id: string; data: UpdatePlanData }) =>
      updatePlan(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

