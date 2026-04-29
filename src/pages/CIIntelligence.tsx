import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Activity, Search, CheckCircle, XCircle, AlertTriangle, Clock,
  TrendingUp, Zap, Loader2, RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "@/lib/api";

const CONCLUSION_CONFIG: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
  success: { color: "text-green-400", icon: CheckCircle, bg: "bg-green-500/10" },
  failure: { color: "text-red-400", icon: XCircle, bg: "bg-red-500/10" },
  cancelled: { color: "text-yellow-400", icon: AlertTriangle, bg: "bg-yellow-500/10" },
  in_progress: { color: "text-blue-400", icon: Clock, bg: "bg-blue-500/10" },
};

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6b7280"];

const DEFAULT_REPO_URL = "https://github.com/balaji-joulestowatts/simple-tasks";

function RepoInput({ onSearch }: { onSearch: (owner: string, repo: string) => void }) {
  const [input, setInput] = useState(DEFAULT_REPO_URL);
  const handle = () => {
    const parts = input.trim().replace("https://github.com/", "").split("/");
    if (parts.length >= 2) onSearch(parts[0], parts[1]);
  };
  return (
    <div className="floating-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-primary" />
        <span className="font-display font-medium text-sm">Connect GitHub Repository</span>
      </div>
      <div className="flex gap-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={DEFAULT_REPO_URL}
          className="flex-1 bg-muted/30 border-border/50"
          onKeyDown={(e) => e.key === "Enter" && handle()}
        />
        <Button onClick={handle} disabled={!input.trim()} className="bg-primary text-primary-foreground">
          <Search className="h-4 w-4 mr-2" />
          Load
        </Button>
      </div>
    </div>
  );
}

export default function CIIntelligence() {
  const [repoCoords, setRepoCoords] = useState<{ owner: string; repo: string } | null>({
    owner: "balaji-joulestowatts",
    repo: "simple-tasks",
  });
  const [explainRunId, setExplainRunId] = useState<number | null>(null);

  const healthQuery = useQuery({
    queryKey: ["ci-health", repoCoords?.owner, repoCoords?.repo],
    queryFn: () => api.getCIHealth(repoCoords!.owner, repoCoords!.repo),
    enabled: !!repoCoords,
  });

  const flakyQuery = useQuery({
    queryKey: ["ci-flaky", repoCoords?.owner, repoCoords?.repo],
    queryFn: () => api.getFlakyTests(repoCoords!.owner, repoCoords!.repo),
    enabled: !!repoCoords,
  });

  const explainMutation = useMutation({
    mutationFn: ({ runId }: { runId: number }) =>
      api.explainCIFailure(repoCoords!.owner, repoCoords!.repo, runId),
  });

  const data = healthQuery.data as any;
  const flaky = flakyQuery.data as any;
  const summary = data?.summary || {};
  const trend = data?.trend || [];
  const byWorkflow = data?.by_workflow || [];
  const runs = data?.runs || [];
  const dora = data?.dora || {};

  const pieData = [
    { name: "Success", value: summary.success_count || 0 },
    { name: "Failure", value: summary.failure_count || 0 },
    { name: "Cancelled", value: summary.cancelled_count || 0 },
  ].filter((d) => d.value > 0);

  const isLoading = healthQuery.isLoading || flakyQuery.isLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold mb-1">CI/CD Intelligence</h1>
          <p className="text-muted-foreground text-sm">Build health trends, flaky test detection, and AI failure explanations.</p>
        </div>

        <RepoInput onSearch={(owner, repo) => setRepoCoords({ owner, repo })} />

        {isLoading && (
          <div className="mt-8 flex items-center justify-center gap-3 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analysing CI/CD pipeline…</span>
          </div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Success Rate", value: `${summary.success_rate || 0}%`, icon: CheckCircle, color: "text-green-400" },
                { label: "Failure Rate", value: `${summary.failure_rate || 0}%`, icon: XCircle, color: "text-red-400" },
                { label: "Deploys/Week", value: dora.deployment_frequency_per_week || 0, icon: Zap, color: "text-primary" },
                { label: "Total Runs", value: summary.total_runs || 0, icon: Activity, color: "text-blue-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="floating-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Build trend chart */}
            {trend.length > 0 && (
              <div className="floating-card p-6">
                <p className="text-sm font-medium mb-4">Build Trend (Last 14 Days)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/30)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }}
                    />
                    <Area type="monotone" dataKey="success" stroke="#22c55e" fill="#22c55e20" name="Success" />
                    <Area type="monotone" dataKey="failure" stroke="#ef4444" fill="#ef444420" name="Failure" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Workflow breakdown */}
              <div className="floating-card p-6">
                <p className="text-sm font-medium mb-4">Workflows</p>
                <div className="space-y-3">
                  {byWorkflow.map((wf: any) => (
                    <div key={wf.name} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs truncate">{wf.name}</span>
                          <span className="text-xs text-muted-foreground">{wf.failure_rate}% fail</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${100 - wf.failure_rate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pie chart */}
              {pieData.length > 0 && (
                <div className="floating-card p-6">
                  <p className="text-sm font-medium mb-4">Run Outcomes</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Flaky test detection */}
            {flaky?.flaky_workflows?.length > 0 && (
              <div className="floating-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <p className="text-sm font-medium">Potentially Flaky Workflows ({flaky.total})</p>
                </div>
                <div className="space-y-3">
                  {flaky.flaky_workflows.map((fw: any) => (
                    <div key={fw.workflow} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fw.workflow}</p>
                        <p className="text-xs text-muted-foreground">
                          {fw.failures} failures / {fw.total_runs} runs · Flakiness: {fw.flakiness_score}%
                        </p>
                      </div>
                      <Badge className={`text-xs ${fw.verdict === "likely_flaky" ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"} border`}>
                        {fw.verdict === "likely_flaky" ? "Likely Flaky" : "Possibly Flaky"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent runs */}
            {runs.length > 0 && (
              <div className="floating-card p-6">
                <p className="text-sm font-medium mb-4">Recent Workflow Runs</p>
                <div className="space-y-2">
                  {runs.slice(0, 10).map((run: any) => {
                    const cfg = CONCLUSION_CONFIG[run.conclusion || run.status] || CONCLUSION_CONFIG.cancelled;
                    const Icon = cfg.icon;
                    const explanation = explainMutation.data as any;
                    const isExplaining = explainMutation.isPending && explainRunId === run.id;
                    const showExplain = run.conclusion === "failure";
                    return (
                      <div key={run.id} className="border border-border/30 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-7 w-7 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{run.name} #{run.run_number}</p>
                            <p className="text-xs text-muted-foreground">{run.head_branch} · {run.head_sha}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                              {run.conclusion || run.status}
                            </Badge>
                            {showExplain && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7"
                                disabled={isExplaining}
                                onClick={() => { setExplainRunId(run.id); explainMutation.mutate({ runId: run.id }); }}
                              >
                                {isExplaining ? <Loader2 className="h-3 w-3 animate-spin" /> : "Explain"}
                              </Button>
                            )}
                          </div>
                        </div>
                        {explainRunId === run.id && explanation && !isExplaining && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30 text-xs space-y-2">
                            <p className="text-foreground/90">{explanation.explanation}</p>
                            {explanation.fix && <p className="text-primary">Fix: {explanation.fix}</p>}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{explanation.category}</Badge>
                              {explanation.is_flaky_candidate && <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30">Flaky candidate</Badge>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
