import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitPullRequest, Search, Shield, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Code2, ExternalLink, Loader2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

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

function RepoInput({ onSearch }: { onSearch: (owner: string, repo: string) => void }) {
  const [input, setInput] = useState("balaji-joulestowatts/simple-tasks");

  const handleSearch = () => {
    const parts = input.trim().replace("https://github.com/", "").split("/");
    if (parts.length >= 2) {
      onSearch(parts[0], parts[1]);
    }
  };

  return (
    <div className="floating-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="h-4 w-4 text-primary" />
        <span className="font-display font-medium text-sm">Connect GitHub Repository</span>
      </div>
      <div className="flex gap-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo  or  https://github.com/owner/repo"
          className="flex-1 bg-muted/30 border-border/50"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={!input.trim()} className="bg-primary text-primary-foreground">
          <Search className="h-4 w-4 mr-2" />
          Load PRs
        </Button>
      </div>
    </div>
  );
}

function PRCard({ pr, owner, repo }: { pr: any; owner: string; repo: string }) {
  const [expanded, setExpanded] = useState(false);
  const reviewMutation = useMutation({
    mutationFn: () => api.reviewPR(owner, repo, pr.number),
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
            {(pr.additions > 0 || pr.deletions > 0) && (
              <>
                <span className="text-green-400">+{pr.additions}</span>
                <span className="text-red-400">-{pr.deletions}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {review && (() => {
            const recKey = review.review?.summary?.review_recommendation ?? "COMMENT";
            const recCfg = RECOMMENDATION_CONFIG[recKey] ?? RECOMMENDATION_CONFIG["COMMENT"];
            return (
              <div className="text-right">
                <Badge className={`text-xs border ${recCfg.color}`}>{recCfg.label}</Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[160px]">{recCfg.description}</p>
              </div>
            );
          })()}
          {!review && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { reviewMutation.mutate(); setExpanded(true); }}
              disabled={reviewMutation.isPending}
              className="text-xs"
            >
              {reviewMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Reviewing...</>
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  <span>Coverage: {review.review?.summary?.test_coverage_estimate}</span>
                  {(() => {
                    const recKey = review.review?.summary?.review_recommendation ?? "COMMENT";
                    const recCfg = RECOMMENDATION_CONFIG[recKey] ?? RECOMMENDATION_CONFIG["COMMENT"];
                    return (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-xs ${recCfg.color}`}>{recCfg.label}</Badge>
                        <span className="text-[10px] text-muted-foreground italic">{recCfg.description}</span>
                      </div>
                    );
                  })()}
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
                        <div key={i} className={`p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                          <div className="flex items-start gap-2">
                            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.textColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.textColor}`}>{cfg.label}</span>
                                {f.file && (
                                  <code className="text-[10px] bg-muted/50 px-1 rounded text-foreground/70">{f.file}{f.line ? `:${f.line}` : ""}</code>
                                )}
                                {f.category && (
                                  <span className={`text-[10px] font-medium ${CATEGORY_COLORS[f.category] || "text-muted-foreground"}`}>{f.category}</span>
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

export default function CodeReview() {
  const [repoCoords, setRepoCoords] = useState<{ owner: string; repo: string } | null>({
    owner: "balaji-joulestowatts",
    repo: "simple-tasks",
  });

  const prsQuery = useQuery({
    queryKey: ["github-prs", repoCoords?.owner, repoCoords?.repo],
    queryFn: () => api.getRepoPRs(repoCoords!.owner, repoCoords!.repo),
    enabled: !!repoCoords,
  });

  const prs = prsQuery.data || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold mb-1">AI Code Review</h1>
          <p className="text-muted-foreground text-sm">
            Connect a GitHub repository, fetch open PRs, and run AI-powered inline code review.
          </p>
        </div>

        <RepoInput onSearch={(owner, repo) => setRepoCoords({ owner, repo })} />

        {repoCoords && (
          <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5" />
            <span>
              Viewing <strong className="text-foreground">{repoCoords.owner}/{repoCoords.repo}</strong>
            </span>
          </div>
        )}

        {prsQuery.isLoading && (
          <div className="mt-6 flex items-center justify-center gap-3 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Fetching pull requests…</span>
          </div>
        )}

        {prsQuery.isError && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            Failed to fetch PRs. Check the repo name and ensure the GitHub token has access.
          </div>
        )}

        {prs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{prs.length} Open Pull Requests</p>
              <span className="text-xs text-muted-foreground">Click "AI Review" on any PR to analyse the diff</span>
            </div>
            {prs.map((pr: any) => (
              <PRCard key={pr.number} pr={pr} owner={repoCoords!.owner} repo={repoCoords!.repo} />
            ))}
          </motion.div>
        )}

        {!prsQuery.isLoading && prs.length === 0 && repoCoords && !prsQuery.isError && (
          <div className="mt-6 text-center py-12 text-muted-foreground text-sm">
            No open pull requests found for {repoCoords.owner}/{repoCoords.repo}.
          </div>
        )}
      </motion.div>
    </div>
  );
}
