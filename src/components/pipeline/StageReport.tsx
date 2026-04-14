import { useState } from "react";
import {
  CheckCircle, XCircle, AlertTriangle, Loader2, RotateCcw,
  TrendingUp, Bug, Shield, Play, GitPullRequest,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { usePipelineContext } from "@/context/PipelineContext";
import { useEvaluatePipeline } from "@/hooks/use-pipeline";

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width={180} height={180}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={[{ value: score, fill: color }]}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted)/30)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-6">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

const VERDICT_CFG: Record<string, { color: string; icon: React.ElementType; bg: string; border: string; label: string }> = {
  "GO":          { color: "text-green-400",  icon: CheckCircle,   bg: "bg-green-500/10",  border: "border-green-500/30",  label: "GO" },
  "NO-GO":       { color: "text-red-400",    icon: XCircle,       bg: "bg-red-500/10",    border: "border-red-500/30",    label: "NO-GO" },
  "CONDITIONAL": { color: "text-yellow-400", icon: AlertTriangle, bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "CONDITIONAL" },
};

export function StageReport() {
  const {
    owner, repo, commitSha,
    reviewResult, liveTestSummary,
    reportResult, setReportResult,
    goToStage, resetPipeline,
  } = usePipelineContext();

  const evaluateMutation = useEvaluatePipeline();

  const handleGenerate = async () => {
    const criticalCount = reviewResult?.review?.findings?.filter((f: any) => f.severity?.toLowerCase() === "critical").length ?? 0;
    const result = await evaluateMutation.mutateAsync({
      owner,
      repo,
      version: commitSha ? commitSha.slice(0, 7) : "HEAD",
      commit_sha: commitSha ?? undefined,
      live_test_passed: liveTestSummary?.passed ?? 0,
      live_test_failed: liveTestSummary?.failed ?? 0,
      live_test_total: liveTestSummary?.total ?? 0,
      review_recommendation: reviewResult?.review?.recommendation ?? "CONDITIONAL",
      review_critical_count: criticalCount,
    });
    setReportResult(result);
  };

  const r = reportResult;
  const verdict = r?.verdict?.verdict?.toUpperCase().replace("-", "-") ?? "";
  const vcfg = VERDICT_CFG[verdict] ?? VERDICT_CFG.CONDITIONAL;
  const VIcon = vcfg.icon;
  const signals = r?.signals;

  const signalRows = r ? [
    { icon: TrendingUp,    label: "CI Pass Rate",        value: `${signals?.ci_pass_rate ?? 0}%`,            status: (signals?.ci_pass_rate ?? 0) >= 80 ? "ok" : "warn" },
    { icon: Play,          label: "Live Test Pass Rate", value: signals?.live_test_total ? `${signals?.live_test_pass_rate ?? 0}%  (${signals?.live_test_passed}/${signals?.live_test_total})` : "No data", status: (signals?.live_test_pass_rate ?? 0) >= 80 || !signals?.live_test_total ? "ok" : "warn" },
    { icon: GitPullRequest, label: "Code Review",        value: signals?.review_recommendation ?? "—",        status: signals?.review_recommendation === "GO" ? "ok" : signals?.review_recommendation === "NO-GO" ? "fail" : "warn" },
    { icon: Bug,           label: "Open Critical Bugs",  value: String(signals?.open_critical_bugs?.length ?? 0), status: (signals?.open_critical_bugs?.length ?? 0) === 0 ? "ok" : "fail" },
    { icon: Shield,        label: "Security Findings",   value: String(signals?.review_critical_findings ?? 0),  status: (signals?.review_critical_findings ?? 0) === 0 ? "ok" : "warn" },
  ] : [];

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20 flex-shrink-0">
        <p className="text-xs text-primary/80">Stage 4 — Pipeline Report: GO / CONDITIONAL / NO-GO</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => goToStage(3)}>← Back</Button>
          {reportResult && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetPipeline}>
              <RotateCcw className="h-3 w-3 mr-1" /> New Pipeline
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 max-w-3xl mx-auto space-y-5">
          {/* Trigger */}
          {!reportResult && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Generate Release Report</h3>
                <p className="text-sm text-muted-foreground">
                  Aggregates CI signals, code review verdict, and live test results into a single go/no-go decision.
                </p>
              </div>
              {/* Summary of what we have */}
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { label: "Code Review", value: reviewResult ? reviewResult.review?.recommendation ?? "done" : "skipped" },
                  { label: "Live Test Run", value: liveTestSummary ? `${liveTestSummary.pass_rate}% pass rate` : "skipped" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {evaluateMutation.isError && (
                <p className="text-sm text-red-400">Report failed. Check GitHub access and API keys.</p>
              )}
              <Button size="lg" className="w-full max-w-xs" onClick={handleGenerate} disabled={evaluateMutation.isPending}>
                {evaluateMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating report…</>
                  : "Generate Report"}
              </Button>
            </div>
          )}

          {/* Results */}
          {r && (
            <div className="space-y-5">
              {/* Verdict + Score */}
              <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-muted-foreground">Pipeline Report · {owner}/{repo} · {r.commit_sha?.slice(0, 7) ?? "HEAD"}</p>
                    <div className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border ${vcfg.bg} ${vcfg.border}`}>
                      <VIcon className={`h-6 w-6 ${vcfg.color}`} />
                      <span className={`text-2xl font-bold ${vcfg.color}`}>{vcfg.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.verdict?.recommendation}</p>
                    {r.verdict?.primary_blocker && (
                      <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                        <p className="text-xs font-medium text-red-400 mb-1">Primary Blocker</p>
                        <p className="text-sm">{r.verdict.primary_blocker}</p>
                      </div>
                    )}
                    {r.verdict?.conditions?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-yellow-400 mb-1.5">Conditions to resolve:</p>
                        {r.verdict.conditions.map((c: string, i: number) => <p key={i} className="text-xs text-muted-foreground">• {c}</p>)}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <ScoreGauge score={r.score} />
                  </div>
                </div>
              </div>

              {/* Signal breakdown */}
              <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                <p className="text-sm font-medium mb-4">Signal Breakdown</p>
                <div className="space-y-2">
                  {signalRows.map(({ icon: Icon, label, value, status }) => (
                    <div key={label} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm flex-1">{label}</span>
                      <span className={`text-sm font-medium ${status === "ok" ? "text-green-400" : status === "fail" ? "text-red-400" : "text-yellow-400"}`}>{value}</span>
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${status === "ok" ? "bg-green-400" : status === "fail" ? "bg-red-400" : "bg-yellow-400"}`} />
                    </div>
                  ))}
                </div>
              </div>

              {r.errors?.length > 0 && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <p className="text-xs font-medium text-yellow-400 mb-1">Warnings (partial data)</p>
                  {r.errors.map((e: string, i: number) => <p key={i} className="text-xs text-muted-foreground">• {e}</p>)}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => goToStage(2)}>Re-run Review</Button>
                <Button variant="outline" className="flex-1" onClick={() => goToStage(4)}>Re-run Tests</Button>
                <Button variant="outline" className="flex-1" onClick={resetPipeline}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Pipeline
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
