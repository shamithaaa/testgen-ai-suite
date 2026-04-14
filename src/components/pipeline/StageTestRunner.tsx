import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineContext } from "@/context/PipelineContext";
import LiveTestRunner from "@/pages/LiveTestRunner";

export function StageTestRunner() {
  const { liveTestSummary, setLiveTestSummary, completeStage, goToStage } = usePipelineContext();

  const handleRunComplete = (summary: { passed: number; failed: number; total: number; pass_rate: number }) => {
    setLiveTestSummary(summary);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20 flex-shrink-0">
        <p className="text-xs text-primary/80">
          Stage 3 — Execute Playwright tests against your running app and capture results.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => goToStage(2)}>← Back</Button>
          {liveTestSummary && (
            <Button size="sm" className="h-7 text-xs" onClick={() => completeStage(3)}>
              Continue to Report <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <LiveTestRunner onRunComplete={handleRunComplete} />
      </div>
    </div>
  );
}
