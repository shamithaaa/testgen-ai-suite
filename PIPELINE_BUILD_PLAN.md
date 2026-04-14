# SDLC Pipeline — Final Build Plan

## The Flow  (route: /pipeline)

Stage 1: Workspace       edit code + AI copilot
Stage 2: Commit          stage files, push, capture SHA
Stage 3: Code Review     AI review of that commit diff
Stage 4: Test Case Gen   generate Playwright tests scoped to that commit
Stage 5: Live Test Run   execute tests against running app, get pass/fail
Stage 6: Report          GO / CONDITIONAL / NO-GO

Data flows forward automatically:
  SHA from Stage 2 → pre-fills Stages 3 and 4
  Test results from Stage 5 → feeds into Stage 6 score
  Review verdict from Stage 3 → feeds into Stage 6 score

---

## What Exists (reuse as-is, zero rebuild)

| Stage | Existing piece | File |
|-------|----------------|------|
| 1 Workspace | WorkspaceLayout + WorkspaceProvider | src/pages/Workspace.tsx |
| 2 Commit | CommitPanel component | src/components/workspace/CommitPanel.tsx |
| 3 Code Review | review_pull_request() AI fn + /github/pr/{n}/review | backend/app/routes/github.py |
| 4 Test Case Gen | TestGenerator component (commits scope) | src/components/workspace/TestGenerator.tsx |
| 5 Live Test Run | useLiveTesting hook + all phase components | src/pages/LiveTestRunner.tsx |
| 6 Report | ReleaseGate scoring + analyze_release_readiness() | backend/app/routes/release_gate.py |

---

## New Backend (2 endpoints, 1 AI function)

### A.  POST /api/github/commits/{sha}/review
File: backend/app/routes/github.py  (add to existing router, ~15 lines)

Why: Stage 3 reviews a raw commit SHA. Existing review endpoint needs a PR number.

New helper in github_service.py:
  get_commit_diff(owner, repo, sha)
    GET /repos/{owner}/{repo}/commits/{sha}
    returns same shape as get_pr_files() → files[]
  Reuses existing review_pull_request() AI fn unchanged.

Response shape: same as PR review
  { summary, findings[], recommendation, security_flags[], positives[] }

---

### B.  POST /api/pipeline/report
File: backend/app/routes/pipeline.py  (new file, ~80 lines)

Accepts:
  owner, repo, version
  commit_sha          (optional)
  jira_project        (optional)
  live_test_passed    int
  live_test_failed    int
  live_test_total     int
  review_recommendation  "GO"|"NO-GO"|"CONDITIONAL"  (optional)
  review_critical_count  int  (optional)

Score formula (out of 100):
  CI pass rate (GitHub Actions):  25 pts
  Live test pass rate:            35 pts  ← weighted higher (actual run data)
  Code review verdict:            20 pts  (GO=20, CONDITIONAL=10, NO-GO=0)
  Open critical bugs (Jira):      10 pts
  Security findings:              10 pts

Calls existing analyze_release_readiness() AI function (no changes needed).
Saves result to MongoDB pipeline_runs collection.
Returns: { verdict, score, signals{}, pipeline_run_id }

Register in backend/main.py.

---

## New Frontend (1 page + context + 6 stage components)

### PipelineContext   src/context/PipelineContext.tsx
sessionStorage-backed. Survives page refresh.

Fields:
  // Stage 1-2 output
  repoUrl, owner, repo, branch, workspaceId

  // Stage 2 output
  commitSha, commitMessage, commitUrl

  // Stage 3 output
  reviewResult  { findings[], recommendation, security_flags[] } | null
  reviewStatus  "idle"|"loading"|"done"|"error"

  // Stage 4 output
  testSuite  WorkspacePlaywrightTest[]

  // Stage 5 output
  liveTestSummary  { passed, failed, total, pass_rate } | null

  // Stage 6 output
  reportResult  { verdict, score, signals{} } | null

  // Navigation
  activeStage  1|2|3|4|5|6
  completedStages  number[]

---

### Pipeline Page   src/pages/SDLCPipeline.tsx   route: /pipeline

  <PipelineProvider>
    <PipelineStageBar />
    <div className="flex-1 min-h-0 overflow-auto">
      {activeStage === 1 && <StageWorkspace />}
      {activeStage === 2 && <StageCommit />}
      {activeStage === 3 && <StageCodeReview />}
      {activeStage === 4 && <StageTestGen />}
      {activeStage === 5 && <StageTestRunner />}
      {activeStage === 6 && <StageReport />}
    </div>
  </PipelineProvider>

---

### PipelineStageBar   src/components/pipeline/PipelineStageBar.tsx

Visual:
  [✓ Workspace] → [✓ Commit abc123] → [◎ Review] → [○ Test Gen] → [○ Run] → [○ Report]

  ✓ green = completed (clickable to go back)
  ◎ filled = active
  ○ grey = locked
  Completed stages show a short badge: SHA / "3 findings" / "12 tests" / "87/100"

---

### StageWorkspace   src/components/pipeline/StageWorkspace.tsx

Renders existing <WorkspaceLayout> unchanged inside PipelineContext.WorkspaceProvider.
Adds banner: "Step 1 of 6 — Connect repo and start editing"
"Continue to Commit →" button activates once workspace.workspaceId is set.
Writes repoUrl, owner, repo, branch, workspaceId → PipelineContext on connect.

---

### StageCommit   src/components/pipeline/StageCommit.tsx

Full-width layout showing <CommitPanel> prominently (not buried in sidebar).
CommitPanel gets one new optional prop:
  onCommitSuccess?: (sha: string, url: string) => void
On commit: writes commitSha, commitMessage, commitUrl → PipelineContext.
Shows success card + "Continue to Code Review →" CTA with SHA and GitHub link.

---

### StageCodeReview   src/components/pipeline/StageCodeReview.tsx

Auto-populated from PipelineContext.commitSha and owner/repo.
"Run AI Review" button → POST /api/github/commits/{sha}/review.
Renders findings, recommendation banner, security flags.
"Skip" link for repos without GitHub token configured.
Writes reviewResult → PipelineContext.
"Continue to Test Generation →" CTA.

---

### StageTestGen   src/components/pipeline/StageTestGen.tsx

Renders <TestGenerator> with:
  initialScope = "commits"
  initialCommitSha = PipelineContext.commitSha

TestGenerator gets two new optional props:
  initialScope?: "single_file"|"entire_app"|"commits"|"virtual_files"
  initialCommitSha?: string

On tests generated: writes testSuite[] → PipelineContext.
"Continue to Live Test Runner →" CTA (active once tests.length > 0).

---

### StageTestRunner   src/components/pipeline/StageTestRunner.tsx

Renders the full LiveTestRunner page content (all phase components reused).
Pre-populates githubUrl from PipelineContext.repoUrl.
LiveTestRunner gets one new optional prop:
  onRunComplete?: (summary: { passed, failed, total, pass_rate }) => void

On run complete (phase === "done"):
  Writes liveTestSummary → PipelineContext.
  Shows "Continue to Report →" CTA.

---

### StageReport   src/components/pipeline/StageReport.tsx

Calls POST /api/pipeline/report with all PipelineContext data.
Renders:
  1. Verdict banner: GO (green) / CONDITIONAL (amber) / NO-GO (red)
  2. Score gauge (copied from ReleaseGate.tsx — ScoreGauge function)
  3. Signal table:
       CI Pass Rate        from GitHub Actions
       Live Test Pass Rate from Stage 5 results
       Code Review         from Stage 3 verdict
       Open Critical Bugs  from Jira (if configured)
       Security Findings   from code review flags
  4. AI narrative
  5. Actions: re-run any stage | export PDF (reuse pdf-report.ts) | New pipeline

---

### Hooks   src/hooks/use-pipeline.ts
  useReviewCommit()      useMutation → POST /api/github/commits/{sha}/review
  useEvaluatePipeline()  useMutation → POST /api/pipeline/report

### API additions   src/lib/api.ts
  reviewCommit(owner, repo, sha)
  evaluatePipeline(body: PipelineReportRequest)

---

## Sidebar + Route

src/App.tsx
  Add: <Route path="/pipeline" element={<SDLCPipeline />} />

src/components/AppSidebar.tsx
  New group "Pipeline" at top (above Test Generation section):
  [ ⬡ SDLC Pipeline ]  /pipeline  "Workspace → Commit → Review → Tests → Report"

---

## All Files

New (12 files):
  src/context/PipelineContext.tsx
  src/pages/SDLCPipeline.tsx
  src/components/pipeline/PipelineStageBar.tsx
  src/components/pipeline/StageWorkspace.tsx
  src/components/pipeline/StageCommit.tsx
  src/components/pipeline/StageCodeReview.tsx
  src/components/pipeline/StageTestGen.tsx
  src/components/pipeline/StageTestRunner.tsx
  src/components/pipeline/StageReport.tsx
  src/hooks/use-pipeline.ts
  backend/app/routes/pipeline.py
  src/components/pipeline/   (directory)

Modified (9 files — minimal changes):
  backend/app/routes/github.py           +15 lines: commit review endpoint
  backend/app/services/github_service.py +10 lines: get_commit_diff()
  backend/main.py                        +2 lines: import + register pipeline router
  src/lib/api.ts                         +20 lines: 2 new methods + types
  src/App.tsx                            +2 lines: route
  src/components/AppSidebar.tsx          +6 lines: nav entry
  src/components/workspace/CommitPanel.tsx     +3 lines: optional prop
  src/components/workspace/TestGenerator.tsx   +4 lines: optional props
  src/pages/LiveTestRunner.tsx                 +5 lines: optional prop

---

## Build Order

  Phase 1 — Backend (independent)
    1. github_service.py  get_commit_diff()
    2. github.py          POST /commits/{sha}/review
    3. pipeline.py        POST /pipeline/report
    4. main.py            register router

  Phase 2 — Frontend plumbing (after Phase 1)
    5. api.ts             new methods
    6. use-pipeline.ts    hooks

  Phase 3 — Shell
    7. PipelineContext.tsx
    8. SDLCPipeline.tsx
    9. PipelineStageBar.tsx
   10. App.tsx + AppSidebar.tsx

  Phase 4 — Stage components + minimal patches
   11. CommitPanel.tsx patch
   12. TestGenerator.tsx patch
   13. LiveTestRunner.tsx patch
   14. StageWorkspace.tsx
   15. StageCommit.tsx
   16. StageCodeReview.tsx
   17. StageTestGen.tsx
   18. StageTestRunner.tsx
   19. StageReport.tsx
