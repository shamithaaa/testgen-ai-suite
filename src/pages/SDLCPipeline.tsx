import { PipelineProvider, usePipelineContext } from "@/context/PipelineContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { PipelineStageBar } from "@/components/pipeline/PipelineStageBar";
import { StageWorkspace } from "@/components/pipeline/StageWorkspace";
import { StageCodeReview } from "@/components/pipeline/StageCodeReview";
import { StageTestRunner } from "@/components/pipeline/StageTestRunner";
import { StageReport } from "@/components/pipeline/StageReport";

function PipelineContent() {
  const { activeStage } = usePipelineContext();
  return (
    <div className="flex flex-col h-full">
      <PipelineStageBar />
      <div className="flex-1 min-h-0">
        {activeStage === 1 && <StageWorkspace />}
        {activeStage === 2 && <StageCodeReview />}
        {activeStage === 3 && <StageTestRunner />}
        {activeStage === 4 && <StageReport />}
      </div>
    </div>
  );
}

export default function SDLCPipeline() {
  return (
    <PipelineProvider>
      {/* WorkspaceProvider lives here so workspace connection persists across all stage navigation */}
      <WorkspaceProvider>
        <PipelineContent />
      </WorkspaceProvider>
    </PipelineProvider>
  );
}
