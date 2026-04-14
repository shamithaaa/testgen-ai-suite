# SDLC Pipeline — Build Plan

## The Flow (5 stages, one page: /pipeline)

```
Workspace  →  Commit  →  Code Review  →  Test Gen  →  Report (GO/NO-GO)
   [1]           [2]          [3]            [4]            [5]
```

Each stage outputs data that becomes input to the next.
The commit SHA from stage 2 auto-wires into stages 3 and 4.
Stage 5 pulls from all prior stages into one verdict.

---

## What Already Exists (reuse, don't rebuild)

| Stage | What exists | Where |
|-------|-------------|-------|
| 1 Workspace | Full code editor + Copilot chat | src/pages/Workspace.tsx |
| 2 Commit | CommitPanel (branch, file staging, push) | src/components/workspace/CommitPanel.tsx |
| 3 Code Review | AI review of GitHub PRs | src/pages/CodeReview.tsx + backend/app/routes/github.py |
| 4 Test Gen | Playwright test generator (per-commit scope) | src/components/workspace/TestGenerator.tsx |
| 5 Report | Release gate score + go/no-go | src/pages/ReleaseGate.tsx + backend/app/routes/release_gate.py |

Problem: all disconnected. No shared state. No flow between them.

---

## What Gets Built

### BACKEND — 2 new endpoints

#### 1. POST /api/github/commits/{sha}/review
File: backend/app/routes/github.py (add to existing router)

Why: Current review only works on PRs. After committing from workspace there is
no PR yet — only a SHA.

Flow:
  github_service.get_commit_diff(owner, repo, sha)
    → GET /repos/{owner}/{repo}/commits/{sha}
    → extract changed files + patches (same shape as PR files)
  → pass to existing review_pull_request() AI function (no changes needed)
  → return: { summary, findings[], recommendation, security_flags[] }

New helper: backend/app/services/github_service.py
  get_commit_diff(owner, repo, sha) → list[dict]

---

#### 2. POST /api/pipeline/report
File: backend/app/routes/pipeline.py (new file)

Why: Stage 5 needs one endpoint that aggregates ALL signals into a single go/no-go.

Input body:
  owner, repo, commit_sha, code_review{findings, recommendation},
  test_suite{total, critical, high}, jira_project (optional)

Flow:
  1. Pull CI pass rate via github_service (reuse)
  2. Pull open critical bugs via jira_service (optional)
  3. score = CI(30) + review(25) + tests(20) + bugs(15) + defect_risk(10)
  4. Call generate_pipeline_report() AI → narrative
  5. Save to MongoDB `pipeline_runs`
  6. Return: { verdict, score, signals{}, narrative, warnings[], pipeline_run_id }

New AI fn: backend/app/services/ai_service.py
  generate_pipeline_report(version, signals, review_findings, test_counts) → dict

Register: backend/main.py

---

### FRONTEND — 1 page + context + 7 components

#### PipelineContext   src/context/PipelineContext.tsx
Shared state across all 5 stages. Persisted to sessionStorage.

State:
  Stage 1 output → repoUrl, owner, repo, branch, workspaceId
  Stage 2 output → commitSha, commitMessage, commitGithubUrl
  Stage 3 output → reviewResult, reviewStatus
  Stage 4 output → testSuite[], testGenStatus
  Stage 5 output → reportResult, reportStatus
  activeStage: 1|2|3|4|5

---

#### Pipeline Page   src/pages/Pipeline.tsx   route: /pipeline

  <PipelineProvider>
    <PipelineProgressBar />
    {activeStage === 1 && <StageWorkspace />}
    {activeStage === 2 && <StageCommit />}
    {activeStage === 3 && <StageCodeReview />}
    {activeStage === 4 && <StageTestGen />}
    {activeStage === 5 && <StageReport />}
  </PipelineProvider>

---

#### PipelineProgressBar   src/components/pipeline/PipelineProgressBar.tsx

  [✓ Workspace] → [✓ Commit abc1234] → [◎ Code Review] → [○ Test Gen] → [○ Report]

  ✓ green checkmark = completed, clickable (go back)
  ◎ filled = active stage
  ○ empty = locked until previous stage done
  Each done stage shows a short badge (SHA / finding count / test count / score)

---

#### StageWorkspace   src/components/pipeline/StageWorkspace.tsx
Renders existing <WorkspaceLayout> in full.
Adds: pipeline banner + "Continue to Commit →" button.
On connect: writes repoUrl, owner, repo, workspaceId → PipelineContext.

---

#### StageCommit   src/components/pipeline/StageCommit.tsx
Full-width version of existing <CommitPanel> (not buried in a sidebar).
On successful commit:
  - Writes commitSha, commitMessage, commitGithubUrl → PipelineContext
  - Shows success card + "Continue to Code Review →" CTA
Change to CommitPanel.tsx: add optional onCommitSuccess(sha, url) prop.

---

#### StageCodeReview   src/components/pipeline/StageCodeReview.tsx
Two tabs:
  "This Commit" — auto-calls POST /api/github/commits/{sha}/review
  "Other PRs"   — reuses existing PR list + review UI
On review done: writes reviewResult → PipelineContext.
"Continue to Test Generation →" CTA.

---

#### StageTestGen   src/components/pipeline/StageTestGen.tsx
Renders existing <TestGenerator>.
Pre-selects scope="commits", pre-fills SHA from PipelineContext.
Toggle: "This commit" / "Entire app".
On tests generated: writes testSuite[] → PipelineContext.
"Continue to Report →" CTA.
Change to TestGenerator.tsx: add initialScope + initialCommitSha props.

---

#### StageReport   src/components/pipeline/StageReport.tsx
Calls POST /api/pipeline/report with all PipelineContext data.
Renders:
  1. Verdict banner: GO (green) / CONDITIONAL (amber) / NO_GO (red)
  2. Score gauge (reuse ScoreGauge from ReleaseGate.tsx)
  3. Signal breakdown table: CI rate | review findings | test counts | bugs | defect risk
  4. AI narrative paragraph
  5. Actions: re-run any stage | export PDF | start new pipeline

---

### API CLIENT   src/lib/api.ts  (3 additions)
  reviewCommit(owner, repo, sha)        → POST /api/github/commits/{sha}/review
  evaluatePipeline(body)                → POST /api/pipeline/report
  listPipelineRuns()                    → GET  /api/pipeline/runs

### HOOKS   src/hooks/use-pipeline.ts
  useReviewCommit()      → useMutation
  useEvaluatePipeline()  → useMutation
  usePipelineRuns()      → useQuery

---

## Sidebar + Routing

src/App.tsx → add route /pipeline

src/components/AppSidebar.tsx → new top section "Pipeline":
  [ ⬡ SDLC Pipeline ]   /pipeline   "Workspace → Commit → Review → Tests → Report"

---

## Files Changed

### New (10 files)
  src/context/PipelineContext.tsx
  src/pages/Pipeline.tsx
  src/components/pipeline/PipelineProgressBar.tsx
  src/components/pipeline/StageWorkspace.tsx
  src/components/pipeline/StageCommit.tsx
  src/components/pipeline/StageCodeReview.tsx
  src/components/pipeline/StageTestGen.tsx
  src/components/pipeline/StageReport.tsx
  src/hooks/use-pipeline.ts
  backend/app/routes/pipeline.py

### Modified (9 files)
  backend/app/routes/github.py               ← add commit review endpoint
  backend/app/services/github_service.py     ← add get_commit_diff()
  backend/app/services/ai_service.py         ← add generate_pipeline_report()
  backend/main.py                            ← register pipeline router
  src/lib/api.ts                             ← 3 new methods + types
  src/App.tsx                                ← add /pipeline route
  src/components/AppSidebar.tsx              ← add Pipeline nav entry
  src/components/workspace/CommitPanel.tsx   ← add onCommitSuccess prop
  src/components/workspace/TestGenerator.tsx ← add initialScope + initialCommitSha props

---

## Build Order

  Phase 1 — Backend (no blockers)
    1. github_service.py  →  get_commit_diff()
    2. github.py          →  POST /commits/{sha}/review
    3. ai_service.py      →  generate_pipeline_report()
    4. pipeline.py        →  POST /report  +  GET /runs
    5. main.py            →  register pipeline router

  Phase 2 — Frontend types & hooks (after Phase 1)
    6. api.ts             →  new methods + types
    7. use-pipeline.ts    →  hooks

  Phase 3 — Shell (after Phase 2)
    8. PipelineContext.tsx
    9. Pipeline.tsx  +  PipelineProgressBar.tsx
   10. App.tsx route  +  AppSidebar entry

  Phase 4 — Stage components (after Phase 3)
   11. StageWorkspace.tsx   (patch CommitPanel prop)
   12. StageCommit.tsx
   13. StageCodeReview.tsx
   14. StageTestGen.tsx     (patch TestGenerator prop)
   15. StageReport.tsx
