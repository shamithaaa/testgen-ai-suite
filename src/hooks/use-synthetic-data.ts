import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSyntheticData(limit = 50) {
  return useQuery({
    queryKey: ["synthetic-data", limit],
    queryFn: () => api.getSyntheticData(limit),
  });
}

export function useGenerateSyntheticData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ count, scenario }: { count: number; scenario?: string }) =>
      api.generateSyntheticData(count, scenario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthetic-data"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
