import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPlan, CreatePlanData } from "@/lib/api/membership";
import { membershipKeys } from "./queries";

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlanData) => createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    },
  });
}

