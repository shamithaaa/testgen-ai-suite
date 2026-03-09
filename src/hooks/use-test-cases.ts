import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useGroupedTestCases(requirementId?: string) {
  return useQuery({
    queryKey: ["test-cases", "grouped", requirementId],
    queryFn: () => api.getGroupedTestCases(requirementId),
  });
}

export function useTestCases(requirementId?: string, category?: string) {
  return useQuery({
    queryKey: ["test-cases", requirementId, category],
    queryFn: () => api.getTestCases(requirementId, category),
  });
}
