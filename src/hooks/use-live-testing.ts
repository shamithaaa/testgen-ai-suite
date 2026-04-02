import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, RepoAnalysisResult, LiveRunStatus, AnalysisJob, PlaywrightTestCase, CommitInfo } from "@/lib/api";

// ── Fetch commits for commit-picker ──────────────────────────────────────────

export function useFetchCommits() {
  return useMutation({
    mutationFn: (githubUrl: string) => api.getRepoCommits(githubUrl),
  });
}

// ── Run history ───────────────────────────────────────────────────────────────

export function useRunHistory() {
  return useQuery({
    queryKey: ["runHistory"],
    queryFn: () => api.listRunHistory(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// ── Start analysis job ────────────────────────────────────────────────────────

export function useStartAnalyzeRepo() {
  return useMutation({
    mutationFn: ({
      githubUrl,
      targetUrl,
      testEmail,
      testPassword,
      testPreferences,
      mode,
      commitSha,
      commitMessage,
    }: {
      githubUrl: string;
      targetUrl: string;
      testEmail?: string;
      testPassword?: string;
      testPreferences?: string;
      mode?: "full" | "commit";
      commitSha?: string;
      commitMessage?: string;
    }) =>
      api.startAnalyzeRepo(
        githubUrl, targetUrl, testEmail, testPassword, testPreferences,
        mode, commitSha, commitMessage,
      ),
  });
}

// ── Poll analysis job (logs + result) ─────────────────────────────────────────

export function useAnalysisJob(jobId: string | null) {
  return useQuery({
    queryKey: ["analysisJob", jobId],
    queryFn: () => api.getAnalysisJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === "completed" || s === "failed") return false;
      return 1500;
    },
    staleTime: 0,
  });
}

// ── Execute Playwright tests ──────────────────────────────────────────────────

export function useExecuteRepoTests() {
  return useMutation({
    mutationFn: (analysisId: string) => api.executeRepoTests(analysisId),
  });
}

// ── Poll live run status ──────────────────────────────────────────────────────

export function useLiveRunStatus(runId: string | null) {
  return useQuery({
    queryKey: ["liveRun", runId],
    queryFn: () => api.getLiveRunStatus(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === "completed" || s === "failed") return false;
      return 1000;
    },
    staleTime: 0,
  });
}

// ── Composite hook ────────────────────────────────────────────────────────────

export type LiveTestingPhase = "idle" | "analyzing" | "ready" | "executing" | "done";

export function useLiveTesting() {
  const [phase, setPhase] = useState<LiveTestingPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RepoAnalysisResult | null>(null);
  const [editedTests, setEditedTests] = useState<PlaywrightTestCase[] | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startAnalyze = useStartAnalyzeRepo();
  const executeTests = useExecuteRepoTests();
  const jobQuery = useAnalysisJob(jobId);
  const runStatus = useLiveRunStatus(runId);

  // Watch job completion
  const prevJobStatus = useRef<string | null>(null);
  const jobData = jobQuery.data as AnalysisJob | undefined;
  if (jobData && jobData.status !== prevJobStatus.current) {
    prevJobStatus.current = jobData.status;
    if (jobData.status === "completed" && jobData.result && phase === "analyzing") {
      setAnalysis(jobData.result);
      setEditedTests(jobData.result.tests);
      setPhase("ready");
    } else if (jobData.status === "failed" && phase === "analyzing") {
      setErrorMsg(jobData.error ?? "Analysis failed");
      setPhase("idle");
    }
  }

  // Watch run completion
  const prevRunStatus = useRef<string | null>(null);
  if (runStatus.data && runStatus.data.status !== prevRunStatus.current) {
    prevRunStatus.current = runStatus.data.status;
    if (
      (runStatus.data.status === "completed" || runStatus.data.status === "failed") &&
      phase === "executing"
    ) {
      setPhase("done");
    }
  }

  const handleAnalyze = useCallback(
    async (
      githubUrl: string,
      targetUrl: string,
      testEmail?: string,
      testPassword?: string,
      testPreferences?: string,
      mode?: "full" | "commit",
      commitSha?: string,
      commitMessage?: string,
    ) => {
      setPhase("analyzing");
      setErrorMsg(null);
      setAnalysis(null);
      setEditedTests(null);
      setRunId(null);
      setJobId(null);
      prevJobStatus.current = null;
      try {
        const res = await startAnalyze.mutateAsync({
          githubUrl, targetUrl, testEmail, testPassword, testPreferences,
          mode, commitSha, commitMessage,
        });
        setJobId(res.job_id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to start analysis";
        setErrorMsg(msg);
        setPhase("idle");
      }
    },
    [startAnalyze]
  );

  const handleExecute = useCallback(async () => {
    if (!analysis) return;
    setPhase("executing");
    setErrorMsg(null);
    prevRunStatus.current = null;
    try {
      const res = await executeTests.mutateAsync(analysis.analysis_id);
      setRunId(res.run_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed to start";
      setErrorMsg(msg);
      setPhase("ready");
    }
  }, [analysis, executeTests]);

  const reset = useCallback(() => {
    setPhase("idle");
    setAnalysis(null);
    setEditedTests(null);
    setJobId(null);
    setRunId(null);
    setErrorMsg(null);
    prevJobStatus.current = null;
    prevRunStatus.current = null;
  }, []);

  const saveTest = useCallback(async (testId: string, updates: Partial<PlaywrightTestCase>) => {
    const updated = await api.updatePlaywrightTest(testId, updates);
    setEditedTests((prev) => prev ? prev.map((t) => t.id === testId ? { ...t, ...updated } : t) : prev);
  }, []);

  return {
    phase,
    jobData,
    analysis,
    editedTests,
    saveTest,
    runId,
    runStatus: runStatus.data as LiveRunStatus | undefined,
    errorMsg,
    handleAnalyze,
    handleExecute,
    reset,
    isStarting: startAnalyze.isPending,
    isExecuting: executeTests.isPending,
  };
}
