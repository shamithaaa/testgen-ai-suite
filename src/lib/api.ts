import axios from "axios";

// In production, VITE_API_URL points to the deployed backend (e.g. https://your-backend.vercel.app/api)
// In development, requests go to /api which Vite proxies to localhost:8000
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ─── Types ────────────────────────────────────────────────────────────────

export interface Requirement {
  id: string;
  text: string;
  created_at: string;
  status: string;
}

export interface AnalyzeRequirementResult {
  id: string;
  text: string;
  status: string;
  test_case_categories: Record<string, number>;
  total_tests: number;
}

export interface TestCase {
  id: string;
  requirement_id: string;
  tc_id: string;
  name: string;
  description: string;
  severity: string;
  expected: string;
  category: string;
  created_at: string;
}

export interface GroupedTestCases {
  functional: TestCase[];
  edge: TestCase[];
  api: TestCase[];
  failure: TestCase[];
  regression: TestCase[];
}

export interface TestResult {
  id: string;
  tc_id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  duration: number;
  error_message: string | null;
  run_id: string;
  timestamp: string;
}

export interface RunStarted {
  /** The run is in progress — poll GET /results?run_id to watch results arrive */
  run_id: string;
  total: number;
  data_source?: "auto" | "file" | "columns";
  data_columns?: string[];
  data_row_count?: number | null;
}

export interface RunSummary {
  run_id: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  success_rate: number;
  total_duration: number;
  started_at: string;
  // data source info (returned by the updated /run endpoint)
  data_source?: "auto" | "file" | "columns";
  data_columns?: string[];
  data_row_count?: number | null;
}

export interface SchemaField {
  name: string;
  type: "string" | "integer" | "float" | "boolean" | "datetime";
  description: string;
}

export interface PreviewDataset {
  schema_fields: SchemaField[];
  rows: Record<string, unknown>[];
}

export interface SyntheticDataset {
  id: string;
  requirement_id: string;
  requirement_text: string;
  count: number;
  schema_fields: SchemaField[];
  rows: Record<string, unknown>[];
  generated_at: string;
}

export interface PrioritizedTest {
  id: string;
  tc_id: string;
  name: string;
  failure_count: number;
  severity: string;
  priority: number;
  status: "failed" | "warning" | "stable";
  known_failure: boolean;
}

export interface DashboardStats {
  total_tests: number;
  test_case_counts: Record<string, number>;
  latest_run: {
    run_id: string | null;
    passed: number;
    failed: number;
    total: number;
    success_rate: number;
    avg_duration: number;
    total_duration: number;
  };
  high_priority: number;
  known_failures: number;
  active_vehicles: number;
  weekly_trend: { day: string; passed: number; failed: number; total: number }[];
}

// ── Repo Analysis & Live Testing Types ────────────────────────────────────────

export interface PageInfo {
  name: string;
  path: string;
  description: string;
  key_elements: string[];
}

export interface UserFlow {
  name: string;
  steps: string[];
}

export interface TestStep {
  action: "navigate" | "click" | "fill" | "assert_text" | "screenshot" | "wait" | "hover" | "hover_and_click" | "press" | "check" | "uncheck" | "select_option" | "drag_and_drop" | "dblclick" | "type_into" | "scroll" | "clear";
  selector: string | null;
  value: string | null;
  description: string;
}

export interface PlaywrightTestCase {
  id: string;
  analysis_id: string;
  name: string;
  description: string;
  page_name: string;
  severity: string;
  steps: TestStep[];
}

export interface CommitInfo {
  sha: string;
  short_sha: string;
  message: string;
  author: string;
  relative_date: string;
  date: string;
}

export interface RepoAnalysisResult {
  analysis_id: string;
  summary: string;
  tech_stack: string;
  pages: PageInfo[];
  user_flows: UserFlow[];
  tests: PlaywrightTestCase[];
  // commit mode extras
  mode?: "full" | "commit";
  commit_sha?: string;
  commit_message?: string;
  changed_files?: string[];
}

export interface RunSummaryItem {
  run_id: string;
  analysis_id: string;
  status: "running" | "completed" | "failed";
  total: number;
  passed: number;
  failed: number;
  started_at: string | null;
  completed_at: string | null;
  results?: { test_name: string; status: string; duration_ms: number | null }[];
}

export interface StepResult {
  step_description: string;
  screenshot: string | null; // base64 PNG
  status: "pass" | "fail";
  error: string | null;
}

export interface LiveTestResult {
  test_id: string;
  test_name: string;
  status: "pending" | "running" | "passed" | "failed";
  steps_completed: number;
  total_steps: number;
  step_results: StepResult[];
  error: string | null;
  duration_ms: number | null;
}

export interface AnalysisJob {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  step: "pending" | "cloning" | "extracting" | "analyzing" | "generating" | "completed" | "failed";
  logs: string[];
  github_url: string;
  target_url: string;
  mode?: "full" | "commit";
  result: RepoAnalysisResult | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface LiveRunStatus {
  run_id: string;
  analysis_id: string;
  status: "running" | "completed" | "failed";
  results: LiveTestResult[];
  total: number;
  passed: number;
  failed: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

// ─── API Functions ─────────────────────────────────────────────────────────

export const api = {
  // Requirements
  analyzeRequirement: (text: string, instructions?: string) =>
    apiClient.post<AnalyzeRequirementResult>("/requirements", { text, instructions }).then((r) => r.data),

  listRequirements: () =>
    apiClient.get<Requirement[]>("/requirements").then((r) => r.data),

  // Test Cases
  getGroupedTestCases: (requirementId?: string) =>
    apiClient
      .get<GroupedTestCases>("/test-cases/grouped", {
        params: requirementId ? { requirement_id: requirementId } : {},
      })
      .then((r) => r.data),

  getTestCases: (requirementId?: string, category?: string) =>
    apiClient
      .get<TestCase[]>("/test-cases", {
        params: { ...(requirementId && { requirement_id: requirementId }), ...(category && { category }) },
      })
      .then((r) => r.data),

  updateTestCase: (tc_id: string, payload: Partial<TestCase>) =>
    apiClient.put<TestCase>(`/test-cases/${tc_id}`, payload).then((r) => r.data),

  // Test Execution
  runTests: (payload: {
    dataSource: "auto" | "file" | "columns";
    requirementId?: string;
    columns?: string;
    file?: File;
    previewRows?: Record<string, unknown>[];
  }) => {
    const fd = new FormData();
    fd.append("data_source", payload.dataSource);
    if (payload.requirementId) fd.append("requirement_id", payload.requirementId);
    if (payload.columns) fd.append("columns", payload.columns);
    if (payload.file) fd.append("file", payload.file);
    if (payload.previewRows) fd.append("preview_rows", JSON.stringify(payload.previewRows));
    return apiClient
      .post<RunStarted>("/test-execution/run", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  getResults: (runId?: string, limit = 100) =>
    apiClient
      .get<TestResult[]>("/test-execution/results", {
        params: { ...(runId && { run_id: runId }), limit },
      })
      .then((r) => r.data),

  getRunSummary: (runId: string) =>
    apiClient.get<RunSummary>(`/test-execution/runs/${runId}`).then((r) => r.data),

  // Synthetic Data
  previewSyntheticData: (requirement_id: string, count = 20) =>
    apiClient
      .post<PreviewDataset>("/synthetic-data/preview", { requirement_id, count })
      .then((r) => r.data),

  generateSyntheticData: (requirement_id: string, count = 20) =>
    apiClient
      .post<SyntheticDataset>("/synthetic-data/generate", { requirement_id, count })
      .then((r) => r.data),

  getSyntheticDatasets: (limit = 10) =>
    apiClient.get<SyntheticDataset[]>("/synthetic-data", { params: { limit } }).then((r) => r.data),

  // Prioritization
  getPrioritizedTests: (refresh = false) =>
    apiClient
      .get<PrioritizedTest[]>("/prioritization", { params: { refresh } })
      .then((r) => r.data),

  // Dashboard
  getDashboardStats: () =>
    apiClient.get<DashboardStats>("/dashboard/stats").then((r) => r.data),

  // ── Repo Analysis & Live Testing ──────────────────────────────────────────
  startAnalyzeRepo: (
    github_url: string,
    target_url: string,
    test_email?: string,
    test_password?: string,
    test_preferences?: string,
    mode?: "full" | "commit",
    commit_sha?: string,
    commit_message?: string,
  ) =>
    apiClient
      .post<{ job_id: string; status: string; mode: string }>("/repo/analyze", {
        github_url,
        target_url,
        ...(test_email && { test_email }),
        ...(test_password && { test_password }),
        ...(test_preferences && { test_preferences }),
        mode: mode ?? "full",
        ...(commit_sha && { commit_sha }),
        ...(commit_message && { commit_message }),
      })
      .then((r) => r.data),

  getRepoCommits: (github_url: string) =>
    apiClient
      .post<{ commits: CommitInfo[] }>("/repo/commits", { github_url })
      .then((r) => r.data),

  getAnalysisJob: (jobId: string) =>
    apiClient.get<AnalysisJob>(`/repo/jobs/${jobId}`).then((r) => r.data),

  getRepoTests: (analysisId: string) =>
    apiClient.get<PlaywrightTestCase[]>(`/repo/analyses/${analysisId}/tests`).then((r) => r.data),

  executeRepoTests: (analysisId: string) =>
    apiClient
      .post<{ run_id: string; total: number; status: string }>(`/repo/analyses/${analysisId}/execute`)
      .then((r) => r.data),

  getLiveRunStatus: (runId: string) =>
    apiClient.get<LiveRunStatus>(`/repo/execution/${runId}`).then((r) => r.data),

  listRunHistory: () =>
    apiClient.get<{ runs: RunSummaryItem[] }>("/repo/runs").then((r) => r.data),

  getRunDetail: (runId: string) =>
    apiClient.get<LiveRunStatus>(`/repo/runs/${runId}`).then((r) => r.data),

  updatePlaywrightTest: (test_id: string, data: Partial<PlaywrightTestCase>) =>
    apiClient.put<PlaywrightTestCase>(`/repo/tests/${test_id}`, data).then((r) => r.data),

  // ── GitHub ────────────────────────────────────────────────────────────────
  getRepoPRs: (owner: string, repo: string) =>
    apiClient.get("/github/prs", { params: { owner, repo } }).then((r) => r.data as any[]),

  getPRFiles: (owner: string, repo: string, prNumber: number) =>
    apiClient.get(`/github/pr/${prNumber}/files`, { params: { owner, repo } }).then((r) => r.data as any[]),

  reviewPR: (owner: string, repo: string, prNumber: number) =>
    apiClient.post(`/github/pr/${prNumber}/review`, null, { params: { owner, repo } }).then((r) => r.data),

  getWorkflowRuns: (owner: string, repo: string) =>
    apiClient.get("/github/workflow-runs", { params: { owner, repo } }).then((r) => r.data as any[]),

  explainRunFailure: (owner: string, repo: string, runId: number) =>
    apiClient.post(`/github/workflow-runs/${runId}/explain`, null, { params: { owner, repo } }).then((r) => r.data),

  // ── Jira ──────────────────────────────────────────────────────────────────
  getJiraProjects: () =>
    apiClient.get("/jira/projects").then((r) => r.data as any[]),

  getJiraStories: (project: string) =>
    apiClient.get("/jira/stories", { params: { project } }).then((r) => r.data as any[]),

  analyzeSprintAC: (project: string) =>
    apiClient.post("/jira/analyze-sprint", { project }).then((r) => r.data),

  analyzeManualStory: (summary: string, description: string, priority: string) =>
    apiClient.post("/jira/analyze-manual", { summary, description, priority }).then((r) => r.data),

  generateStoryAC: (issueKey: string, project: string) =>
    apiClient.post(`/jira/stories/${issueKey}/generate-ac`, { project }).then((r) => r.data),

  pushACToJira: (issueKey: string, text: string) =>
    apiClient.post(`/jira/stories/${issueKey}/update-ac`, { acceptance_criteria_text: text }).then((r) => r.data),

  getJiraBugs: (project: string, version?: string) =>
    apiClient.get("/jira/bugs", { params: { project, ...(version && { version }) } }).then((r) => r.data as any[]),

  // ── CI Intelligence ───────────────────────────────────────────────────────
  getCIHealth: (owner: string, repo: string) =>
    apiClient.get("/ci/health", { params: { owner, repo } }).then((r) => r.data),

  getFlakyTests: (owner: string, repo: string) =>
    apiClient.get("/ci/flaky-tests", { params: { owner, repo } }).then((r) => r.data),

  explainCIFailure: (owner: string, repo: string, runId: number) =>
    apiClient.post(`/ci/runs/${runId}/explain`, null, { params: { owner, repo } }).then((r) => r.data),

  // ── Defect Prediction ─────────────────────────────────────────────────────
  getDefectRiskScores: (owner: string, repo: string, sinceDays: number = 90) =>
    apiClient.get("/defect-prediction/risk-scores", { params: { owner, repo, since_days: sinceDays } }).then((r) => r.data),

  // ── Release Gate ──────────────────────────────────────────────────────────
  evaluateRelease: (params: { version: string; owner: string; repo: string; jira_project?: string }) =>
    apiClient.post("/release-gate/evaluate", params).then((r) => r.data),

  // ── Monitoring ────────────────────────────────────────────────────────────
  simulateTimeSeries: (baseline: Record<string, number>, days?: number) =>
    apiClient.post("/monitoring/simulate-time-series", { baseline, days }).then((r) => r.data),

  analyzeTimeSeries: (series: any[]) =>
    apiClient.post("/monitoring/analyze", { series }).then((r) => r.data),

  // ── Incidents ─────────────────────────────────────────────────────────────
  createIncident: (data: { anomaly: any; column_comparison?: any[]; recent_commits?: string[]; related_alerts?: any[]; title?: string }) =>
    apiClient.post("/incidents", data).then((r) => r.data),

  listIncidents: () =>
    apiClient.get("/incidents").then((r) => r.data as any[]),

  getIncident: (id: string) =>
    apiClient.get(`/incidents/${id}`).then((r) => r.data),

  resolveIncident: (id: string, note?: string) =>
    apiClient.put(`/incidents/${id}/resolve`, { note }).then((r) => r.data),

  generatePostmortem: (id: string) =>
    apiClient.post(`/incidents/${id}/postmortem`).then((r) => r.data),

  // ── Sprint Intelligence ───────────────────────────────────────────────────
  generateSprintReport: (params: { owner: string; repo: string; jira_project?: string; sprint_name?: string }) =>
    apiClient.post("/sprint/report", params).then((r) => r.data),

  getDORAMetrics: (owner: string, repo: string) =>
    apiClient.get("/sprint/dora", { params: { owner, repo } }).then((r) => r.data),
};
