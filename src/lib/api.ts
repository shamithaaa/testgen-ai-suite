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

// ─── API Functions ─────────────────────────────────────────────────────────

export const api = {
  // Requirements
  analyzeRequirement: (text: string) =>
    apiClient.post<AnalyzeRequirementResult>("/requirements", { text }).then((r) => r.data),

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
};
