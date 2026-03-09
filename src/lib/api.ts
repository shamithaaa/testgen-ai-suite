import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
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

export interface RunSummary {
  run_id: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  success_rate: number;
  total_duration: number;
  started_at: string;
}

export interface VehicleTelemetry {
  id: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  engine_temp: number;
  rpm: number;
  fuel_level: number;
  oil_pressure: number;
  speed: number;
  trip_id: string;
  status: "Active" | "Idle" | "Maintenance";
  timestamp: string;
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
  runTests: (requirementId?: string) =>
    apiClient
      .post<RunSummary>("/test-execution/run", null, {
        params: requirementId ? { requirement_id: requirementId } : {},
      })
      .then((r) => r.data),

  getResults: (runId?: string, limit = 100) =>
    apiClient
      .get<TestResult[]>("/test-execution/results", {
        params: { ...(runId && { run_id: runId }), limit },
      })
      .then((r) => r.data),

  getRunSummary: (runId: string) =>
    apiClient.get<RunSummary>(`/test-execution/runs/${runId}`).then((r) => r.data),

  // Synthetic Data
  generateSyntheticData: (count = 20, scenario?: string) =>
    apiClient
      .post<{ count: number; records: VehicleTelemetry[] }>("/synthetic-data/generate", { count, scenario })
      .then((r) => r.data),

  getSyntheticData: (limit = 50) =>
    apiClient.get<VehicleTelemetry[]>("/synthetic-data", { params: { limit } }).then((r) => r.data),

  // Prioritization
  getPrioritizedTests: (refresh = false) =>
    apiClient
      .get<PrioritizedTest[]>("/prioritization", { params: { refresh } })
      .then((r) => r.data),

  // Dashboard
  getDashboardStats: () =>
    apiClient.get<DashboardStats>("/dashboard/stats").then((r) => r.data),
};
