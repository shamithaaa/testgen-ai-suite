import { useCallback, useEffect } from "react";
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineContext } from "@/context/PipelineContext";
import { useWorkspaceContext } from "@/context/WorkspaceContext";
import { WorkspaceLayout } from "@/pages/Workspace";

function WorkspaceWithCapture() {
  const pipeline = usePipelineContext();
  const { workspace } = useWorkspaceContext();

  // Sync workspace info into pipeline context the first time we connect
  useEffect(() => {
    if (workspace && !pipeline.workspaceId) {
      const parts = workspace.repo_url.replace("https://github.com/", "").split("/");
      pipeline.setWorkspaceInfo({
        repoUrl: workspace.repo_url,
        owner: parts[0] ?? "",
        repo: parts[1] ?? "",
        branch: workspace.branch,
        workspaceId: workspace.workspace_id,
      });
    }
  }, [workspace, pipeline.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCommitSuccess = useCallback((sha: string, url: string) => {
    pipeline.setCommit(sha, "", url);
  }, [pipeline]);

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-primary/80 min-w-0">
          <span>Stage 1 — Edit code and commit. Next stage is optional.</span>
          {pipeline.commitSha && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <CheckCircle2 className="h-3 w-3 text-green-400" />
              <code className="font-mono bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded text-[10px]">
                {pipeline.commitSha.slice(0, 7)}
              </code>
              {pipeline.commitUrl && (
                <a
                  href={pipeline.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => pipeline.goToStage(2)}
          >
            Next <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <WorkspaceLayout
          onCommitSuccess={handleCommitSuccess}
          initialRepoUrl={pipeline.repoUrl || undefined}
          initialBranch={pipeline.branch || undefined}
        />
      </div>
    </div>
  );
}

export function StageWorkspace() {
  // WorkspaceProvider is hoisted to SDLCPipeline — no wrapper here
  return <WorkspaceWithCapture />;
}
