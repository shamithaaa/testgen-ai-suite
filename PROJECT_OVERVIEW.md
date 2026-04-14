# TestGen AI Suite — Project Overview (Deep FE+BE Walkthrough)

This repository is a **single product** with two runtimes:

- **Frontend (Vite + React + TypeScript)** at repo root (code in `src/`)
- **Backend (FastAPI + MongoDB + Playwright + Azure OpenAI)** in `backend/` (API under `/api/*`)

The app combines:

1) **Test Generation Workflow** (Requirements → Test Suite → Execution → Risk Ranking)
2) **Tools** (Synthetic Data, Live Test Runner)
3) **SDLC Intelligence** (Requirements Intel, Code Review, CI/CD Intelligence, Defect Prediction, Release Gate, Monitoring, Sprint Intelligence)

---

## 1) Repo layout (what lives where)

### Frontend
- `src/App.tsx` — route map + layout composition
- `src/components/DashboardLayout.tsx` + `src/components/AppSidebar.tsx` — shell + navigation
- `src/pages/*` — each module/page (UI state machines)
- `src/hooks/*` — TanStack React Query hooks for API calls
- `src/lib/api.ts` — **single source of truth** for frontend → backend endpoints (Axios)
- `src/lib/mockData.ts` — fallback datasets used when backend is unavailable

### Backend
- `backend/main.py` — FastAPI app, CORS, router registration under `/api`
- `backend/app/routes/*` — HTTP API endpoints (routers)
- `backend/app/services/*` — business logic + integrations (AI, GitHub, Jira, Slack, Datadog, Playwright)
- `backend/app/models/*` — Pydantic request/response schemas
- `backend/app/database.py` — MongoDB (Motor) connection + `get_db()`
- `backend/app/config.py` — settings via environment (see notes in “Security & Ops”)

---

## 2) How the two sides connect (core runtime contract)

### Base URL and dev proxy
- Frontend uses Axios with `baseURL = import.meta.env.VITE_API_URL || "/api"` (`src/lib/api.ts`).
- Vite proxy routes `/api/*` → `http://localhost:8000` (`vite.config.ts`).
- Vite dev server port is configured to **8080** (not Vite’s usual 5173).

### Data fetching style
- Most pages use **TanStack React Query** for:
  - `useQuery` for reads (lists/stats)
  - `useMutation` for writes (generate/analyze/run)
  - cache invalidation after writes

### Failure handling
- Several pages intentionally **fall back to mock data** if the backend is unreachable (especially dashboard and prioritization/test suite views). This keeps the UI demoable without the backend.

---

## 3) High-level architecture & data flow

### Big picture

```mermaid
flowchart LR
  UI[React UI (Vite)] -->|Axios /api| API[FastAPI backend]
  API -->|Motor| DB[(MongoDB)]
  API -->|OpenAI SDK| LLM[Azure OpenAI]
  API --> GH[GitHub REST API]
  API --> JIRA[Jira REST API]
  API --> SLACK[Slack Webhook]
  API --> DD[Datadog Events]
  API --> PW[Playwright Runtime]
  PW -->|screenshots/results| API
  API --> UI
```

### Key MongoDB collections (conceptual)
Exact names come from route/service usage; the core ones are:

- `requirements` — requirement submissions + analysis
- `test_cases` — generated test cases (linked to requirement)
- `synthetic_datasets` — AI-generated datasets for test execution
- `test_execution_runs` / `test_execution_results` — execution history + per-test results
- `prioritized_tests` — cached risk ranking output
- `repo_analyses` — codebase analysis summaries for Live Test Runner
- `playwright_tests` — generated Playwright test cases
- `playwright_runs` — historical run summaries for Live Test Runner
- `incidents` — Monitoring/Incident Intelligence records

---

## 4) Module-by-module walkthrough (deep FE + BE)

This section is organized by what the user sees (routes/pages), and for each module includes:

- **Frontend flow**: route, page state machine, hooks, and UI decisions
- **Backend flow**: endpoints, services, data persistence, integrations

### 4.0 App Shell & Entry Pages

#### Landing (Marketing/Entry)

**Route:** `/` → `src/pages/Landing.tsx`

**Frontend flow**
- Provides the product intro and a direct path into the workflow.
- Primary CTA navigates to `/requirements` (“Get Started — Submit Requirement”).
- Secondary CTA navigates to `/dashboard`.
- Includes a theme toggle via `useTheme()` and uses shared design tokens/styles.

**Backend flow**
- None; this page is static navigation + theme state.

#### App Shell (Layout + Navigation)

**Layout wrapper:** `src/components/DashboardLayout.tsx`

**Frontend flow**
- Routes under the shell are defined in `src/App.tsx` inside `<Route element={<DashboardLayout />}>`.
- Sidebar navigation is in `src/components/AppSidebar.tsx`.
- Cross-cutting providers:
  - React Query (`QueryClientProvider`)
  - Theme (`ThemeProvider`)
  - Toast systems (`Toaster`, `Sonner`)

**Backend flow**
- None directly; the shell simply hosts module routes that call backend APIs.

#### Not Found

**Route:** `*` → `src/pages/NotFound.tsx`

**Frontend flow**
- Catch-all route for unmatched paths.

**Backend flow**
- None.

### 4.1 Dashboard (Overview)

**Route:** `/dashboard` → `src/pages/Dashboard.tsx`

**Frontend flow**
- Fetches stats via `useDashboardStats()` (`src/hooks/use-dashboard.ts`).
- If backend fails, it derives KPIs from `src/lib/mockData.ts`.
- UX highlights:
  - “Guided Workflow — Four Steps to Full Coverage” cards linking to `/requirements`, `/generated-tests`, `/test-execution`, `/prioritization`.
  - Charts (Recharts) built from backend `weekly_trend` or static mock trend.

**Backend flow**
- Endpoint: `GET /api/dashboard/stats` (`backend/app/routes/dashboard.py`).
- Service aggregates totals, category counts, latest run summary, weekly trend.
- Data sources: test cases + execution results + synthetic datasets (plus any domain-specific “active assets” metric).

**Notes / edge cases**
- Dashboard uses a metric `active_vehicles` in UI copy; in backend this is a general “active monitored assets” idea and may not map 1:1 to current datasets.

---

### 4.2 Test Generation Workflow (Step 1 → 4)

This is the core “happy path” workflow.

#### Step 1 — Requirements

**Route:** `/requirements` → `src/pages/Requirements.tsx`

**Frontend flow**
- User pastes a requirement and clicks analyze.
- Uses a React Query mutation (hook: `useAnalyzeRequirement()` in `src/hooks/use-requirements.ts`) → `api.analyzeRequirement()`.
- On success:
  - Stores `result.id` in `localStorage` as `lastRequirementId`.
  - Navigates user to `/generated-tests`.

**Backend flow**
- Endpoint: `POST /api/requirements` (`backend/app/routes/requirements.py`).
- Service (`backend/app/services/requirement_service.py`):
  - Inserts requirement into `requirements` collection.
  - Calls AI to generate test cases (via `backend/app/services/ai_service.py`).
  - Persists generated tests into `test_cases` (linked to `requirement_id`).

**Data contract highlights**
- The “requirement ID” becomes the join key for all subsequent steps.

---

#### Step 2 — Generated Tests (Review + Edit)

**Route:** `/generated-tests` → `src/pages/GeneratedTests.tsx`

**Frontend flow**
- Pulls `requirementId` from `localStorage.lastRequirementId`.
- Calls `useGroupedTestCases(requirementId)` → `GET /test-cases/grouped`.
- Renders test cases grouped into categories (functional/edge/api/failure/regression).
- Allows editing:
  - opens dialog, user edits fields, then `useUpdateTestCase()` → `PUT /test-cases/{tc_id}`.
- If backend is unreachable, displays `mockTestCases`.

**Backend flow**
- Endpoints (`backend/app/routes/test_cases.py`):
  - `GET /api/test-cases/grouped?requirement_id=...`
  - `PUT /api/test-cases/{tc_id}`
- Service (`backend/app/services/test_case_service.py`):
  - Query by `requirement_id` and group by `category`.
  - Update individual test case document.

**Why the edit step matters technically**
- It is an explicit human-in-the-loop correction loop *before execution*.

---

#### Step 3 — Test Execution (Run + Poll results)

**Route:** `/test-execution` → `src/pages/TestExecution.tsx`

**Frontend flow (UI state machine)**
The page behaves like a pipeline with phases:

1) **Select data source**
   - `file`: upload a spreadsheet/file
   - `columns`: provide column list
   - `auto`: generate a preview dataset automatically

2) **Preview (auto mode)**
   - Calls `api.previewSyntheticData()` → `POST /synthetic-data/preview`.
   - Shows an editable table (user can tweak rows before running).

3) **Run execution**
   - Calls `api.runTestExecution()` → `POST /test-execution/run` (multipart form: requirement + options + optional file + columns + data rows).

4) **Polling for results**
   - Polls `api.getExecutionResults(run_id)` → `GET /test-execution/results` roughly every ~800ms.
   - Stops when all tests are returned.

5) **Results summary**
   - Displays pass/fail, failure messages, and durations.

**Backend flow**
- Routes (`backend/app/routes/test_execution.py`):
  - `POST /api/test-execution/run` (multipart; parses inputs)
  - `GET /api/test-execution/results?run_id=...`
  - `GET /api/test-execution/runs/{run_id}` (run details)
- Service (`backend/app/services/execution_service.py`):
  - Creates a run record, simulates or computes per-test outcomes.
  - Writes results progressively to Mongo so polling returns incremental state.

**Key technical detail**
- The “poll until complete” model is used instead of server-sent events/websockets.

---

#### Step 4 — Risk-Based Prioritization

**Route:** `/prioritization` → `src/pages/Prioritization.tsx`

**Frontend flow**
- Reads prioritized list via `usePrioritizedTests()` (`src/hooks/use-prioritization.ts`).
- Provides “Refresh Priority Ranking” button via `useRefreshPrioritization()`.
- Groups into High/Medium/Low based on `priority` score thresholds.
- Separately highlights “Known Failures”.
- Falls back to `mockPrioritizedTests` when backend fails.

**Backend flow**
- Endpoint: `GET /api/prioritization` (`backend/app/routes/prioritization.py`).
  - may accept `refresh=true` to force recompute.
- Service (`backend/app/services/prioritization_service.py`):
  - Builds a ranked list using AI + historical execution signals.
  - Caches ranking in `prioritized_tests` unless refresh requested.

---

### 4.3 Synthetic Data (Tool)

**Route:** `/synthetic-data` → `src/pages/SyntheticData.tsx`

**Frontend flow**
- Lets user pick a requirement (from `useRequirements()` which calls `GET /requirements`).
- Generates data with `useGenerateSyntheticData()` → `POST /synthetic-data/generate`.
- Displays schema chips + dataset table.
- Fetches prior datasets via `useSyntheticDatasets()` → `GET /synthetic-data`.

**Backend flow**
- Routes (`backend/app/routes/synthetic_data.py`):
  - `POST /api/synthetic-data/preview` (fast sample)
  - `POST /api/synthetic-data/generate` (persisted)
  - `GET /api/synthetic-data` (history)
- Service (`backend/app/services/synthetic_data_service.py`):
  - Uses requirement text + AI prompts to produce schema + records.
  - Stores into `synthetic_datasets`.

---

### 4.4 Live Test Runner (Tool: Repo → AI → Playwright)

**Route:** `/live-testing` → `src/pages/LiveTestRunner.tsx`

This module is the most “end-to-end” technically: it pulls a repo, uses AI to generate Playwright tests, then executes them and streams screenshots.

**Frontend flow (phases via `useLiveTesting()`)**
Hook: `src/hooks/use-live-testing.ts` manages:
- `phase`: `idle` → `analyzing` → `ready` → `executing` → `done`
- `jobId` polling and `runId` polling

1) **Idle / Input**
   - Inputs: GitHub repo URL + target app URL (running server), optional credentials/preferences.
   - Testing scope:
     - “Entire App” (full analysis)
     - “Specific Commit” (diff-based analysis)
       - loads commits via `POST /repo/commits`.

2) **Start analysis**
   - `POST /api/repo/analyze` returns `job_id` (HTTP 202).

3) **Analyzing**
   - Polls `GET /api/repo/jobs/{job_id}` every ~1.5s.
   - Displays step progress (cloning/extracting/analyzing/generating) + live logs.

4) **Ready**
   - Shows analysis summary, detected pages + flows, and generated test suite.
   - Allows editing Playwright tests inline and saving:
     - `PUT /api/repo/tests/{test_id}` updates stored test doc.

5) **Execute**
   - `POST /api/repo/analyses/{analysis_id}/execute` returns `run_id` (HTTP 202).

6) **Executing / Done**
   - Polls `GET /api/repo/execution/{run_id}` every ~1s.
   - Renders:
     - live browser screenshot viewport (base64 images)
     - per-test step results + screenshot gallery
   - Can download PDF reports (client-side) using `src/lib/pdf-report.ts`.

7) **History (idle only)**
   - `GET /api/repo/runs` for run summaries.
   - `GET /api/repo/runs/{run_id}` for detail (persisted copy omits screenshots).

**Backend flow**
- Router: `backend/app/routes/repo_analysis.py` (prefix `/repo`).

Core backend mechanics:

- **Pre-flight URL check**: backend performs a GET to target URL before executing (and warns early if unreachable).
- **Async background jobs**:
  - `POST /repo/analyze` returns immediately.
  - A background task runs:
    - shallow clone
    - file extraction (size-limited)
    - AI analysis of pages/flows
    - AI generation of Playwright tests
  - Status, current step, and logs are stored in an in-memory job store (and result is persisted to Mongo).

- **Persistence**:
  - `repo_analyses` stores analysis summary + metadata
  - `playwright_tests` stores generated tests
  - `playwright_runs` stores slimmed run history

- **Playwright execution**:
  - background task executes tests and maintains an in-memory run object for fast polling.
  - screenshots are returned live (base64 strings) via `/repo/execution/{run_id}`.

**Important operational constraint**
- Playwright runs *inside the backend process*, so the target URL must be reachable from the backend machine (localhost ports matter).

---

## 5) SDLC Intelligence modules (FE + BE)

### 5.1 Requirements Intelligence (BDD AC generation)

**Route:** `/requirements-intelligence` → `src/pages/RequirementsIntelligence.tsx`

**Frontend flow**
- Two modes:
  1) **Single Story** (manual): user enters summary/description/priority → mutation → AI output.
  2) **Jira Sprint**: user enters `projectKey` → pulls sprint stories → AI analyzes each.
- Can push generated AC back into Jira issue with “Push to Jira”.

**Backend flow**
- Router: `backend/app/routes/jira.py` (prefix `/jira`).
- Key endpoints used by the UI:
  - `POST /api/jira/analyze-manual` (manual story)
  - `POST /api/jira/analyze-sprint` (sprint batch)
  - `POST /api/jira/stories/{key}/update-ac` (push acceptance criteria)
- AI: acceptance criteria + ambiguity flags + risk score via `backend/app/services/ai_service.py`.

---

### 5.2 Code Review (GitHub PR AI review)

**Route:** `/code-review` → `src/pages/CodeReview.tsx`

**Frontend flow**
- User inputs `owner/repo` (or full GitHub URL).
- Loads PRs via query `GET /github/prs`.
- For each PR, clicking “AI Review” triggers mutation `POST /github/pr/{pr}/review`.
- UI renders:
  - summary: what changed, coverage estimate, recommendation
  - findings: file/line/category/severity + suggestion
  - security flags + positive observations

**Backend flow**
- Router: `backend/app/routes/github.py` (prefix `/github`).
- Backend proxies GitHub API (token stays server-side).
- AI constructs structured findings from PR diff context.

---

### 5.3 CI/CD Intelligence

**Route:** `/ci-intelligence` → `src/pages/CIIntelligence.tsx`

**Frontend flow**
- User inputs `owner/repo`.
- Queries:
  - `GET /ci/health` → summary cards + trends + workflow breakdown + recent runs
  - `GET /ci/flaky-tests` → list flaky workflows
- On a failed run, “Explain” triggers `POST /ci/runs/{id}/explain` and renders explanation/fix.

**Backend flow**
- Router: `backend/app/routes/ci_intelligence.py` (prefix `/ci`).
- Uses GitHub Actions workflow run history + heuristics.
- AI explanation endpoint calls `ai_service.explain_ci_failure`.

---

### 5.4 Defect Prediction

**Route:** `/defect-prediction` → `src/pages/DefectPrediction.tsx`

**Frontend flow**
- User inputs `owner/repo`.
- Calls `GET /defect-prediction/risk-scores`.
- Visualizes:
  - Treemap heatmap (size = churn, color = risk score)
  - Table of files with risk score, change counts, bug-fix ratio, authors.

**Backend flow**
- Router: `backend/app/routes/defect_prediction.py` (prefix `/defect-prediction`).
- Backend computes risk using commit history heuristics (churn, frequency, bug-fix signals).
- AI may add a “risk narrative” paragraph.

---

### 5.5 Release Gate

**Route:** `/release-gate` → `src/pages/ReleaseGate.tsx`

**Frontend flow**
- Form: GitHub owner/repo + version/tag + optional Jira project.
- Mutation: `POST /release-gate/evaluate`.
- UI shows:
  - verdict: GO / CONDITIONAL / NO-GO
  - score gauge
  - signal breakdown (CI pass rate, open critical bugs, security findings)
  - warnings if some sources unavailable

**Backend flow**
- Router: `backend/app/routes/release_gate.py`.
- Aggregates:
  - GitHub workflow pass rate
  - Jira open critical/high bugs (optional)
  - security findings placeholder (currently a simple scalar)
- Computes score and calls AI for narrative verdict.
- If NO-GO, attempts Slack notification.

---

### 5.6 Monitoring (Anomaly detection + AI predictive alert)

**Route:** `/monitoring` → `src/pages/Monitoring.tsx`

**Frontend flow**
Two tabs:

1) **Demo Mode**
   - user sets baseline sliders
   - `POST /monitoring/simulate-time-series` → returns series + injected anomalies

2) **My Data**
   - user pastes CSV: `date, completeness, uniqueness, validity, consistency`
   - client parses and then calls `POST /monitoring/analyze`

Shared results UI:
- Chart time series
- Anomaly list; “Create Incident” calls `POST /incidents`
- “Run AI Analysis” triggers `POST /monitoring/analyze` again to add predictive alert

**Backend flow**
- Router: `backend/app/routes/monitoring.py`.
- Implements rolling Z-score anomaly detection + drop threshold.
- If anomalies found:
  - calls AI predictive alert (`generate_predictive_alert`)
  - posts critical anomaly to Slack (best-effort)
  - tags analysis in Datadog (best-effort)

---

### 5.7 Incidents (Incident Intelligence)

**Page exists:** `src/pages/Incidents.tsx`

**Important:** The route is currently **commented out** in `src/App.tsx` and in the sidebar, so it’s not reachable through navigation unless re-enabled.

**Frontend flow**
- Lists incidents via `GET /incidents`.
- Create incident (modal) → `POST /incidents` which triggers AI RCA.
- Resolve incident → `PUT /incidents/{id}/resolve`.
- Generate postmortem → `POST /incidents/{id}/postmortem`.

**Backend flow**
- Router: `backend/app/routes/incidents.py`.
- Creates incident ID like `INC-XXXXXXXX`.
- Calls AI RCA (`investigate_incident`) and stores:
  - root cause, evidence, immediate + prevention actions, confidence, timeline
- Slack notification is attempted on creation (best-effort).
- Uses MongoDB collection: `incidents`.

---

### 5.8 Sprint Intelligence

**Route:** `/sprint-intelligence` → `src/pages/SprintIntelligence.tsx`

**Frontend flow**
- Form: GitHub owner/repo + optional Jira project key + optional sprint label.
- Mutation: `POST /sprint/report`.
- UI renders:
  - KPI cards (CI pass rate, deploys/week, stories delivered, ambiguity count)
  - DORA radar chart
  - story priority breakdown (if Jira included)
  - AI sprint narrative

**Backend flow**
- Router: `backend/app/routes/sprint.py`.
- Pulls:
  - Jira sprint stories (optional)
  - GitHub Actions run history (required)
- Computes simplified DORA-style metrics.
- Calls AI summary (`generate_sprint_summary`).

---

## 6) Cross-cutting backend services & integrations

### 6.1 AI service (central brain)
`backend/app/services/ai_service.py` centralizes LLM prompts and helpers for:

- requirement → test case generation
- synthetic dataset generation
- risk-based prioritization
- PR review findings
- CI failure explanation
- acceptance criteria generation
- release readiness verdict
- incident RCA + predictive monitoring alert
- sprint summary narrative

Quota/availability is handled with a dedicated exception type (`AIQuotaError`) which becomes HTTP 429 in some routes.

### 6.2 Integrations
- **GitHub**: backend proxy calls so token is never exposed to the browser.
- **Jira**: story fetch + issue update for acceptance criteria.
- **Slack**: webhook notifications for high-impact events (release blocks, critical anomalies, incident creation).
- **Datadog**: tags / event posting for monitoring analyses.
- **Playwright**: executed by backend; live screenshots streamed via polling.

---

## 7) Running locally (recommended sequence)

### 7.1 Backend
From repo root:

1) Install backend deps (pick one approach):
   - If using `uv`: `cd backend && uv pip install -r requirements.txt`
   - Or with venv + pip: `python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt`

2) Playwright browsers (required for Live Test Runner):
   - `python -m playwright install`

3) MongoDB (needed for most persistence; required for incidents):
   - `docker run -d --name mongodb -p 27017:27017 mongo:7`

4) Start API:
   - `cd backend && python -m uvicorn main:app --reload --port 8000`

### 7.2 Frontend
1) Install deps:
   - `npm install`

2) Start dev server:
   - `npm run dev`

3) Open:
   - `http://localhost:8080`

Because of the Vite proxy, the frontend can call `/api/*` without setting `VITE_API_URL`.

---

## 8) Security & operational notes (important)

- **Do not commit real tokens**: ensure GitHub/Jira/Slack/Datadog keys are provided via environment variables.
- **Backend settings** are read from `backend/app/config.py` via `pydantic-settings` and `.env` files.
- CORS is configured to allow explicit origins plus `https://*.vercel.app` deployments.
- Live Test Runner executes untrusted web interactions via Playwright; run it in a controlled environment.

---

## 9) Known gaps / tech-debt (things to be aware of)

- The Incidents page exists but is not currently routed in `src/App.tsx` and not shown in the sidebar.
- The UI includes a Live Test Runner hint about Vite’s default port (5173), but this repo’s Vite config uses port 8080.
- Several modules are intentionally demo-friendly with mock fallbacks; production mode should define stricter error handling/empty states.
- `src/pages/Index.tsx` is an unused scaffold/fallback page (not routed from `src/App.tsx`).
