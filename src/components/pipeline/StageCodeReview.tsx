import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  GitCommit, Shield, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Loader2, Info, ArrowRight, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePipelineContext } from "@/context/PipelineContext";
import { api } from "@/lib/api";
import type { CommitInfo, PipelineReview } from "@/lib/api";

const SEVERITY_CONFIG: Record<string, { textColor: string; bg: string; border: string; icon: React.ElementType; label: string }> = {
  critical: { textColor: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    icon: XCircle,       label: "Critical" },
  high:     { textColor: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: AlertTriangle, label: "High" },
  medium:   { textColor: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: Info,          label: "Medium" },
  low:      { textColor: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   icon: Info,          label: "Low" },
};

const RECOMMENDATION_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  "APPROVE":          { label: "Approved",           description: "No blocking issues. Code is ready to merge.",              color: "text-green-400 border-green-500/30" },
  "REQUEST_CHANGES":  { label: "Changes Requested",  description: "Issues found that must be resolved before merging.",       color: "text-red-400 border-red-500/30" },
  "COMMENT":          { label: "Commented",           description: "Suggestions provided — not blocking, but worth reviewing.", color: "text-yellow-400 border-yellow-500/30" },
  "CONDITIONAL":      { label: "Conditional",         description: "Can merge after addressing the listed conditions.",         color: "text-yellow-400 border-yellow-500/30" },
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "text-red-400",
  bug: "text-orange-400",
  performance: "text-yellow-400",
  style: "text-blue-400",
  "test-coverage": "text-purple-400",
  maintainability: "text-green-400",
};

function CommitCard({
  commit,
  owner,
  repo,
  onReviewDone,
}: {
  commit: CommitInfo;
  owner: string;
  repo: string;
  onReviewDone: (result: { sha: string; review: PipelineReview; files_reviewed: number }) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const reviewMutation = useMutation({
    mutationFn: () => api.reviewCommit(owner, repo, commit.sha),
    onSuccess: (data) => {
      onReviewDone(data);
      setExpanded(true);
    },
  });

  const review = reviewMutation.data?.review as PipelineReview | undefined;

  const rawSummary = review?.summary;
  // AI sometimes returns summary as an object {overall_risk, what_changed, ...}
  const summaryObj = rawSummary && typeof rawSummary === "object" ? rawSummary as Record<string, string> : null;
  const summaryText = summaryObj ? summaryObj.what_changed ?? JSON.stringify(rawSummary) : (typeof rawSummary === "string" ? rawSummary : "");
  // recommendation can be top-level OR inside summary object
  const recKey = (review?.recommendation ?? summaryObj?.review_recommendation ?? "COMMENT") as string;
  const recCfg = RECOMMENDATION_CONFIG[recKey.toUpperCase()] ?? RECOMMENDATION_CONFIG["COMMENT"];

  return (
    <div className="floating-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <GitCommit className="h-4 w-4 text-primary shrink-0" />
            <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded font-mono shrink-0">
              {commit.short_sha}
            </code>
            <span className="font-medium text-sm truncate">{commit.message}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>@{commit.author}</span>
            <span>{commit.relative_date}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {review && (
            <div className="text-right">
              <Badge className={`text-xs border ${recCfg.color}`}>{recCfg.label}</Badge>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[160px]">{recCfg.description}</p>
            </div>
          )}
          {!review && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              className="text-xs"
            >
              {reviewMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Reviewing…</>
              ) : "AI Review"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && review && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
              {/* Summary */}
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                {summaryObj ? (
                  <div className="space-y-1.5">
                    {summaryObj.overall_risk && (
                      <p className="text-xs"><span className="font-medium text-muted-foreground">Risk:</span> <span className="capitalize">{summaryObj.overall_risk}</span></p>
                    )}
                    {summaryObj.what_changed && (
                      <p className="text-sm font-medium">{summaryObj.what_changed}</p>
                    )}
                    {summaryObj.test_coverage_estimate && (
                      <p className="text-xs text-muted-foreground">{summaryObj.test_coverage_estimate}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium mb-1">{summaryText}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  {review.coverage_estimate != null && (
                    <span>Coverage: ~{review.coverage_estimate}%</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-xs ${recCfg.color}`}>{recCfg.label}</Badge>
                    <span className="text-[10px] text-muted-foreground italic">{recCfg.description}</span>
                  </div>
                </div>
              </div>

              {/* Findings */}
              {review.findings?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {review.findings.length} Finding{review.findings.length !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-2">
                    {review.findings.map((f, i) => {
                      const cfg = SEVERITY_CONFIG[f.severity?.toLowerCase()] || SEVERITY_CONFIG.low;
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className={`p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                          <div className="flex items-start gap-2">
                            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.textColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.textColor}`}>{cfg.label}</span>
                                {f.file && (
                                  <code className="text-[10px] bg-muted/50 px-1 rounded text-foreground/70">
                                    {f.file}{f.line ? `:${f.line}` : ""}
                                  </code>
                                )}
                                {f.category && (
                                  <span className={`text-[10px] font-medium ${CATEGORY_COLORS[f.category] || "text-muted-foreground"}`}>
                                    {f.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-foreground/90">{f.message}</p>
                              {f.suggestion && (
                                <p className="mt-1 text-[11px] text-muted-foreground italic">{f.suggestion}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Security flags */}
              {review.security_flags?.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-medium text-red-400">Security Flags</span>
                  </div>
                  <ul className="space-y-1">
                    {review.security_flags.map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Positive observations */}
              {((review.positives ?? (review as any).positive_observations) as string[] | undefined)?.length > 0 && (
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-xs font-medium text-green-400">Positive Observations</span>
                  </div>
                  <ul className="space-y-1">
                    {((review.positives ?? (review as any).positive_observations) as string[]).map((o, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StageCodeReview() {
  const {
    owner, repo, repoUrl,
    reviewResult, setReviewResult, setReviewStatus,
    completeStage, goToStage,
  } = usePipelineContext();

  const githubUrl = repoUrl || (owner && repo ? `https://github.com/${owner}/${repo}` : "");

  const commitsQuery = useQuery({
    queryKey: ["pipeline-commits", githubUrl],
    queryFn: () => api.getRepoCommits(githubUrl),
    enabled: !!githubUrl,
  });

  const commits: CommitInfo[] = (commitsQuery.data?.commits as CommitInfo[]) ?? [];

  const handleReviewDone = (data: { sha: string; review: PipelineReview; files_reviewed: number }) => {
    setReviewResult({
      sha: data.sha,
      review: data.review,
      files_reviewed: data.files_reviewed ?? 0,
    });
    setReviewStatus("done");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-primary/80">
          <GitCommit className="h-3.5 w-3.5" />
          <span>Stage 2 — AI Code Review</span>
          {owner && repo && (
            <code className="font-mono bg-primary/15 px-1.5 py-0.5 rounded text-primary">{owner}/{repo}</code>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => goToStage(1)}>← Back</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => completeStage(2)}>
            Next <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
          {reviewResult && (
            <Button size="sm" className="h-7 text-xs" onClick={() => completeStage(2)}>
              Next <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          {/* No repo connected */}
          {!githubUrl && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">No repository connected. Go back to Stage 1 and connect a workspace first.</p>
            </div>
          )}

          {/* Loading commits */}
          {commitsQuery.isLoading && (
            <div className="flex items-center justify-center gap-3 py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Fetching commits for {owner}/{repo}…</span>
            </div>
          )}

          {/* Error */}
          {commitsQuery.isError && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-center justify-between">
              <span>Failed to fetch commits. Check the GitHub token has access to {owner}/{repo}.</span>
              <Button variant="ghost" size="sm" onClick={() => commitsQuery.refetch()}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          )}

          {/* Commit list */}
          {commits.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{commits.length} Commit{commits.length !== 1 ? "s" : ""}</p>
                <span className="text-xs text-muted-foreground">Click "AI Review" on any commit to analyse the diff</span>
              </div>
              {commits.map((commit) => (
                <CommitCard
                  key={commit.sha}
                  commit={commit}
                  owner={owner}
                  repo={repo}
                  onReviewDone={handleReviewDone}
                />
              ))}
            </motion.div>
          )}

          {/* No commits */}
          {!commitsQuery.isLoading && !commitsQuery.isError && commits.length === 0 && githubUrl && (
            <div className="text-center py-16 text-muted-foreground text-sm space-y-3">
              <p>No commits found for <strong className="text-foreground">{owner}/{repo}</strong>.</p>
              <Button variant="outline" size="sm" onClick={() => completeStage(2)}>
                Next <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* Review done — continue prompt */}
          {reviewResult && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Review complete · {reviewResult.files_reviewed} files analysed</span>
              </div>
              <Button size="sm" onClick={() => completeStage(2)}>
                Next <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
