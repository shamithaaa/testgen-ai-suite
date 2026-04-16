import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileCode,
  FlaskConical,
  Play,
  Loader2,
  Globe,
  AlertTriangle,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePipelineContext } from "@/context/PipelineContext";
import LiveTestRunner from "@/pages/LiveTestRunner";
import { cn } from "@/lib/utils";
import type { WorkspacePlaywrightTest } from "@/lib/api";
import { useLiveTesting } from "@/hooks/use-live-testing";
import { motion, AnimatePresence } from "framer-motion";
import type { LiveTestResult } from "@/lib/api";
import { downloadLiveTestReport } from "@/lib/pdf-report";

// ── Severity badge colours ─────────────────────────────────────────────────────

const severityClass: Record<string, string> = {
  Critical: "bg-red-500/15 text-red-400 border-red-500/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

// ── Committed Test Cases Preview ───────────────────────────────────────────────

interface FileGroup {
  filePath: string;
  tests: WorkspacePlaywrightTest[];
}

function CommittedTestsPreview({ tests }: { tests: WorkspacePlaywrightTest[] }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const groups: FileGroup[] = tests.reduce<FileGroup[]>((acc, t) => {
    const key = t.page_name || "Unknown";
    const existing = acc.find((g) => g.filePath === key);
    if (existing) {
      existing.tests.push(t);
    } else {
      acc.push({ filePath: key, tests: [t] });
    }
    return acc;
  }, []);

  const toggleFile = (fp: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  };

  return (
    <div className="border-b border-border/40 bg-muted/5">
      <button
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
        )}
        <FlaskConical className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />
        <span className="text-xs font-semibold text-foreground/80">Committed Test Cases</span>
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono ml-1">
          {tests.length} test{tests.length !== 1 ? "s" : ""} across {groups.length} file{groups.length !== 1 ? "s" : ""}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/50">
          {expanded ? "collapse" : "expand"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {groups.map((group) => {
            const isOpen = expandedFiles.has(group.filePath);
            return (
              <div key={group.filePath} className="border border-border/30 rounded-lg overflow-hidden bg-background/50">
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/20 transition-colors"
                  onClick={() => toggleFile(group.filePath)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                  )}
                  <FileCode className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  <span className="font-mono text-xs font-semibold text-foreground/80 flex-1 text-left">
                    {group.filePath}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 bg-muted/40 px-1.5 py-0.5 rounded flex-shrink-0">
                    {group.tests.length} test{group.tests.length !== 1 ? "s" : ""}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border/20 px-3 py-2 space-y-1.5">
                    {group.tests.map((test) => (
                      <div
                        key={test.id}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/20 transition-colors"
                      >
                        <FlaskConical className="h-3 w-3 text-primary/50 flex-shrink-0" />
                        <span className="flex-1 text-xs text-foreground/80 truncate">{test.name}</span>
                        <span
                          className={cn(
                            "text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0",
                            severityClass[test.severity] ?? "bg-muted/30 text-muted-foreground border-border/30",
                          )}
                        >
                          {test.severity}
                        </span>
                        <span className="text-[9px] text-muted-foreground/40 flex-shrink-0">
                          {test.steps.length} steps
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Mini live test card (for direct execution results) ─────────────────────────

function MiniTestCard({ result }: { result: LiveTestResult }) {
  const [open, setOpen] = useState(false);
  const icon = {
    running: <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />,
    passed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    failed: <XCircle className="h-4 w-4 text-red-400" />,
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  }[result.status];

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="flex-1 text-sm font-medium truncate">{result.test_name}</span>
        {result.duration_ms && (
          <span className="text-[11px] text-muted-foreground mr-1">
            {(result.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {result.steps_completed}/{result.total_steps} steps
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {result.error && (
                <div className="flex items-start gap-2 rounded bg-red-500/10 border border-red-500/20 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-400">{result.error}</p>
                </div>
              )}
              {result.step_results.map((sr, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-xs rounded p-1.5 ${
                    sr.status === "fail" ? "bg-red-500/10 border border-red-500/20" : "bg-muted/30"
                  }`}
                >
                  {sr.status === "pass" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <span className="text-muted-foreground flex-1">{sr.step_description}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Committed Tests Direct Runner ──────────────────────────────────────────────

function CommittedTestsRunner({
  tests,
  defaultTargetUrl,
  onRunComplete,
}: {
  tests: WorkspacePlaywrightTest[];
  defaultTargetUrl: string;
  onRunComplete: (summary: { passed: number; failed: number; total: number; pass_rate: number }) => void;
}) {
  const [targetUrl, setTargetUrl] = useState(defaultTargetUrl || "https://simple-tasks-zeta.vercel.app/");
  const [testEmail, setTestEmail] = useState("balaji0707srp@gmail.com");
  const [testPassword, setTestPassword] = useState("1234567890");
  const {
    phase,
    runStatus,
    errorMsg,
    handleExecuteDirect,
    handleExecute,
    analysis,
    editedTests,
    reset,
    isExecutingDirect,
  } = useLiveTesting();

  const isLocalhost = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");
  const canRun = targetUrl.trim().startsWith("http") && !isExecutingDirect && phase === "idle";

  // Report completion once after run reaches done state.
  useEffect(() => {
    if (phase !== "done" || !runStatus) return;
    const t = runStatus.total ?? 0;
    const p = runStatus.passed ?? 0;
    const f = runStatus.failed ?? 0;
    const key = `${runStatus.run_id}-committed-reported`;
    if (t > 0 && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      onRunComplete({ passed: p, failed: f, total: t, pass_rate: t > 0 ? Math.round((p / t) * 100) : 0 });
    }
  }, [phase, runStatus, onRunComplete]);

  if (phase === "idle") {
    return (
      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Run Committed Tests</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {tests.length} test{tests.length !== 1 ? "s" : ""} are ready to run against your deployed app. No re-generation needed.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Target App URL
            </label>
            <Input
              placeholder="https://your-app.vercel.app"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="h-9"
            />
            {isLocalhost && targetUrl.trim().length > 10 && (
              <div className="flex items-start gap-1.5 rounded bg-yellow-500/10 border border-yellow-500/20 px-2 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-300 leading-snug">
                  Playwright runs inside the backend. Your app must be accessible on this machine.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3">
            <p className="text-xs font-medium text-foreground/90">Test Credentials (if login is required)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="email"
                placeholder="qa-user@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="h-9"
              />
              <Input
                type="password"
                placeholder="Password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="h-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Credentials are applied to matching email/username/password fill steps before execution.
            </p>
          </div>

          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 rounded bg-red-500/10 border border-red-500/20 p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          <Button
            className="mt-4 w-full"
            disabled={!canRun}
            onClick={() => handleExecuteDirect(tests, targetUrl.trim(), testEmail || undefined, testPassword || undefined)}
          >
            {isExecutingDirect ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting…</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Run Tests Live</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // executing / done phases
  if (!runStatus) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Waiting for execution to start…</p>
      </div>
    );
  }

  const { results, total, passed, failed, status } = runStatus;
  const completed = results.filter((r) => r.status === "passed" || r.status === "failed").length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const runningTest = results.find((r) => r.status === "running");
  const latestScreenshot = runningTest?.step_results.slice().reverse().find((s) => s.screenshot)?.screenshot ?? null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
      {/* Live browser preview */}
      <div className="rounded-xl border border-border/50 bg-black overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-border/30">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 mx-2 bg-zinc-800 rounded px-2 py-0.5 text-[11px] text-muted-foreground font-mono truncate">
            {runningTest ? `Running: ${runningTest.test_name}` : "Playwright Browser"}
          </div>
          {status === "running" && (
            <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
              <Loader2 className="h-3 w-3 animate-spin" /><span>Live</span>
            </div>
          )}
          {status === "completed" && <span className="text-[11px] text-green-400">Done</span>}
        </div>
        <div className="relative aspect-video bg-zinc-950 flex items-center justify-center min-h-[200px]">
          {latestScreenshot ? (
            <motion.img
              key={latestScreenshot.slice(-20)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              src={`data:image/png;base64,${latestScreenshot}`}
              alt="Live browser view"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Waiting for first screenshot…</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            )}
            <span className="text-sm font-medium">
              {status === "running" ? `Running test ${completed + 1} of ${total}…` : "Completed"}
            </span>
          </div>
          {phase === "done" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadLiveTestReport(runStatus)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Report
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
              </Button>
            </div>
          )}
        </div>
        <Progress value={progress} className="h-1.5 mb-3" />
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xl font-bold">{total}</p><p className="text-[11px] text-muted-foreground">Total</p></div>
          <div><p className="text-xl font-bold text-green-400">{passed}</p><p className="text-[11px] text-muted-foreground">Passed</p></div>
          <div><p className="text-xl font-bold text-red-400">{failed}</p><p className="text-[11px] text-muted-foreground">Failed</p></div>
        </div>
        {phase === "done" && total > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Success rate</span>
            <span className={`font-bold ${successRate >= 80 ? "text-green-400" : successRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {successRate}%
            </span>
          </div>
        )}
      </div>

      {/* Per-test results */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Results</h2>
        {results.map((r) => <MiniTestCard key={r.test_id} result={r} />)}
        {results.length === 0 && status === "running" && (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />Starting first test…
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── StageTestRunner ────────────────────────────────────────────────────────────

export function StageTestRunner() {
  const { liveTestSummary, setLiveTestSummary, testSuite, repoUrl, deployedUrl, completeStage, goToStage } = usePipelineContext();

  // When committed tests exist, default to "committed" mode to skip re-generation
  const hasCommittedTests = testSuite.length > 0;
  const [mode, setMode] = useState<"committed" | "new">(hasCommittedTests ? "committed" : "new");

  const handleRunComplete = (summary: { passed: number; failed: number; total: number; pass_rate: number }) => {
    setLiveTestSummary(summary);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/20 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-primary/80 min-w-0">
          <span>Stage 4 — Execute Playwright tests against your deployed app and capture results.</span>
          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:underline flex items-center gap-1 flex-shrink-0"
            >
              <FlaskConical className="h-3 w-3" />
              {deployedUrl.replace("https://", "")}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => goToStage(3)}>← Back</Button>
          {liveTestSummary && (
            <Button size="sm" className="h-7 text-xs" onClick={() => completeStage(4)}>
              Continue to Report <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Mode tabs — only shown when committed tests exist */}
      {hasCommittedTests && (
        <div className="flex items-center gap-1 px-4 py-2 bg-muted/10 border-b border-border/30 flex-shrink-0">
          <div className="flex rounded-lg border border-border/50 bg-background/50 p-0.5 gap-0.5">
            <button
              onClick={() => setMode("committed")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === "committed"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Zap className="h-3 w-3" />
              Use Committed Tests
            </button>
            <button
              onClick={() => setMode("new")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                mode === "new"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Play className="h-3 w-3" />
              New Analysis
            </button>
          </div>
          {mode === "committed" && (
            <span className="text-[11px] text-green-400 flex items-center gap-1 ml-2">
              <CheckCircle2 className="h-3 w-3" />
              {testSuite.length} test{testSuite.length !== 1 ? "s" : ""} ready — no regeneration needed
            </span>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {mode === "committed" && hasCommittedTests ? (
          <>
            <CommittedTestsPreview tests={testSuite} />
            <CommittedTestsRunner
              tests={testSuite}
              defaultTargetUrl={deployedUrl || ""}
              onRunComplete={handleRunComplete}
            />
          </>
        ) : (
          <LiveTestRunner
            onRunComplete={handleRunComplete}
            initialGithubUrl={repoUrl || undefined}
            initialAppUrl={deployedUrl || undefined}
          />
        )}
      </div>
    </div>
  );
}
