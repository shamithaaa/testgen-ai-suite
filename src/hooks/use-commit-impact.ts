import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCommitImpactTree(workspaceId: string | null, maxDepth = 4) {
  return useQuery({
    queryKey: ["commit-impact-tree", workspaceId, maxDepth],
    queryFn: () => api.getCommitImpactTree(workspaceId!, maxDepth),
    enabled: !!workspaceId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 8000,
  });
}
