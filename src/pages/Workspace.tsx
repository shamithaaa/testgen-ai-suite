import { useState } from "react";
import { Github, Loader2, GitBranch, ChevronDown, ChevronRight, Columns2, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceProvider, useWorkspaceContext } from "@/context/WorkspaceContext";
import { FileExplorer } from "@/components/workspace/FileExplorer";
import { EditorArea } from "@/components/workspace/EditorArea";
import { CopilotPanel } from "@/components/workspace/CopilotPanel";
import { CommitPanel } from "@/components/workspace/CommitPanel";
import { StatusBar } from "@/components/workspace/StatusBar";
import { useConnectWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";

function ConnectForm() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [pat, setPat] = useState("");
  const [showPat, setShowPat] = useState(false);
  const { setWorkspace } = useWorkspaceContext();
  const connectMutation = useConnectWorkspace();

  const handleConnect = async () => {
    if (!repoUrl.trim()) return;
    // Normalize URL
    let url = repoUrl.trim();
    if (!url.startsWith("http")) url = `https://github.com/${url}`;

    try {
      const result = await connectMutation.mutateAsync({ github_url: url, branch, pat: pat || undefined });
      setWorkspace(result);
      toast.success("Repository connected");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to connect repository");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Github className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Connect Repository</h2>
          <p className="text-sm text-muted-foreground">
            Enter a GitHub repository to start coding with AI assistance
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Repository URL or owner/repo</Label>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="owner/repo  or  https://github.com/owner/repo"
              onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Branch</Label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="pl-9"
                placeholder="main"
              />
            </div>
          </div>

          <Collapsible open={showPat} onOpenChange={setShowPat}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showPat ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Personal Access Token (for private repos)
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Token is used server-side only and never exposed to the browser.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <Button
          onClick={handleConnect}
          className="w-full"
          disabled={connectMutation.isPending || !repoUrl.trim()}
        >
          {connectMutation.isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cloning repository…</>
            : <><Github className="h-4 w-4 mr-2" />Connect & Clone</>
          }
        </Button>

        <p className="text-[11px] text-center text-muted-foreground">
          Repository is shallow-cloned (depth 1) into a temporary workspace.
          Changes are committed and pushed to GitHub on your behalf.
        </p>
      </div>
    </div>
  );
}

function WorkspaceLayout() {
  const { workspace } = useWorkspaceContext();
  const [showCommit, setShowCommit] = useState(false);

  if (!workspace) return <ConnectForm />;

  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar */}
      <div className="h-9 border-b border-border/50 bg-muted/20 flex items-center px-3 gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {workspace.repo_url.split("/").slice(-2).join("/")}
        </span>
        <span className="text-muted-foreground/40 text-xs">·</span>
        <span className="text-xs text-muted-foreground">{workspace.branch}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={showCommit ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setShowCommit((v) => !v)}
          >
            <PanelRight className="h-3 w-3 mr-1" />
            Commit
          </Button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* File explorer */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30} className="border-r border-border/50">
            <FileExplorer />
          </ResizablePanel>

          <ResizableHandle />

          {/* Editor area */}
          <ResizablePanel defaultSize={showCommit ? 45 : 57}>
            <EditorArea />
          </ResizablePanel>

          <ResizableHandle />

          {/* Copilot panel */}
          <ResizablePanel defaultSize={showCommit ? 25 : 25} minSize={20} maxSize={40}>
            <CopilotPanel />
          </ResizablePanel>

          {/* Commit panel (slide-in) */}
          {showCommit && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={14} minSize={12} maxSize={22} className="border-l border-border/50">
                <div className="h-full flex flex-col">
                  <div className="px-3 py-2 border-b border-border/50 flex-shrink-0">
                    <p className="text-xs font-medium">Commit & Push</p>
                  </div>
                  <ScrollArea className="flex-1">
                    <CommitPanel />
                  </ScrollArea>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}

export default function Workspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}
