import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  GitPullRequest, Shield, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Loader2, Info, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePipelineContext } from "@/context/PipelineContext";
import { api } from "@/lib/api";

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  critical: { color: "text-red-400 bg-red-500/10 border-red-500/30", icon: XCircle, label: "Critical" },
  high:     { color: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: AlertTriangle, label: "High" },
  medium:   { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", icon: Info, label: "Medium" },
  low:      { color: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: Info, label: "Low" },
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "text-red-400",
  bug: "text-orange-400",
  performance: "text-yellow-400",
  style: "text-blue-400",
  "test-coverage": "text-purple-400",
  maintainability: "text-green-400",
};

function PRCard({
  pr,
  owner,
  repo,
  onReviewDone,
}: {
  pr: any;
  owner: string;
  repo: string;
  onReviewDone: (result: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const reviewMutation = useMutation({
    mutationFn: () => api.reviewPR(owner, repo, pr.number),
    onSuccess: (data) => {
      onReviewDone(data);
      setExpanded(true);
    },
  });

  const review = reviewMutation.data as any;

  return (
    <div className="floating-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <GitPullRequest className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">{pr.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">#{pr.number}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>@{pr.author}</span>
            <span>{pr.base} ← {pr.head}</span>
            {pr.changed_files > 0 && <span>{pr.changed_files} files</span>}
            <span className="text-green-400">+{pr.additions}</span>
            <span className="text-red-400">-{pr.deletions}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {review && (
            <Badge className={`text-xs border ${
              review.review?.summary?.overall_risk === "critical" ? "border-red-500/30 text-red-400" :
              review.review?.summary?.overall_risk === "high" ? "border-orange-500/30 text-orange-400" :
              "border-green-500/30 text-green-400"
            }`}>
              {review.review?.summary?.review_recommendation?.toUpperCase() ||
               review.review?.summary?.overall_risk?.toUpperCase() ||
               "REVIEWED"}
            </Badge>
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
                <p className="text-sm font-medium mb-1">{review.review?.summary?.what_changed}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span>Coverage: {review.review?.summary?.test_coverage_estimate}</span>
                  <Badge variant="outline" className={`text-xs ${
                    review.review?.summary?.review_recommendation === "APPROVE" ? "text-green-400 border-green-500/30" :
                    review.review?.summary?.review_recommendation === "REQUEST_CHANGES" ? "text-red-400 border-red-500/30" :
                    "text-yellow-400 border-yellow-500/30"
                  }`}>
                    {review.review?.summary?.review_recommendation}
                  </Badge>
                </div>
              </div>

              {/* Findings */}
              {review.review?.findings?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {review.review.findings.length} Findings
                  </p>
                  <div className="space-y-2">
                    {review.review.findings.map((f: any, i: number) => {
                      const cfg = SEVERITY_CONFIG[f.severity?.toLowerCase()] || SEVERITY_CONFIG.low;
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className={`p-3 rounded-lg border text-xs ${cfg.color}`}>
                          <div className="flex items-start gap-2">
                            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {f.file && <code className="text-[10px] bg-black/20 px-1 rounded">{f.file}{f.line ? `:${f.line}` : ""}</code>}
                                {f.category && <span className={`text-[10px] font-medium ${CATEGORY_COLORS[f.category] || ""}`}>{f.category}</span>}
                              </div>
                              <p className="text-foreground/90">{f.message}</p>
                              {f.suggestion && (
                                <p className="mt-1 text-muted-foreground italic">{f.suggestion}</p>
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
              {review.review?.security_flags?.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-medium text-red-400">Security Flags</span>
                  </div>
                  <ul className="space-y-1">
                    {review.review.security_flags.map((f: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Positive observations */}
              {review.review?.positive_observations?.length > 0 && (
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-xs font-medium text-green-400">Positive Observations</span>
                  </div>
                  <ul className="space-y-1">
                    {review.review.positive_observations.map((o: string, i: number) => (
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
    owner, repo,
    reviewResult, setReviewResult, setReviewStatus,
    completeStage, goToStage,
  } = usePipelineContext();

  const prsQuery = useQuery({
    queryKey: ["pipeline-prs", owner, repo],
    queryFn: () => api.getRepoPRs(owner, repo),
    enabled: !!(owner && repo),
  });

  const prs = (prsQuery.data as any[]) || [];

  const handleReviewDone = (data: any) => {
    setReviewResult({
      sha: String(data.pr_number ?? ""),
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
          <GitPullRequest className="h-3.5 w-3.5" />
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
          {!(owner && repo) && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">No repository connected. Go back to Stage 1 and connect a workspace first.</p>
            </div>
          )}

          {/* Loading PRs */}
          {prsQuery.isLoading && (
            <div className="flex items-center justify-center gap-3 py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Fetching pull requests for {owner}/{repo}…</span>
            </div>
          )}

          {/* Error */}
          {prsQuery.isError && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              Failed to fetch PRs. Check the GitHub token has access to {owner}/{repo}.
            </div>
          )}

          {/* PR list */}
          {prs.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{prs.length} Open Pull Request{prs.length !== 1 ? "s" : ""}</p>
                <span className="text-xs text-muted-foreground">Click "AI Review" on any PR to analyse the diff</span>
              </div>
              {prs.map((pr: any) => (
                <PRCard
                  key={pr.number}
                  pr={pr}
                  owner={owner}
                  repo={repo}
                  onReviewDone={handleReviewDone}
                />
              ))}
            </motion.div>
          )}

          {/* No PRs */}
          {!prsQuery.isLoading && !prsQuery.isError && prs.length === 0 && owner && repo && (
            <div className="text-center py-16 text-muted-foreground text-sm space-y-3">
              <p>No open pull requests found for <strong className="text-foreground">{owner}/{repo}</strong>.</p>
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
