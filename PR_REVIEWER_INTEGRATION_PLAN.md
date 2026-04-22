# PR Reviewer Integration Plan (Application-Only, No GitHub Actions)

## Goal
Integrate deep AI PR review directly inside the existing TestGen backend and frontend flow, without using GitHub Actions.

---

## 1) Current State (What You Already Have)

### Backend
- FastAPI app with modular routes is already in place.
- GitHub proxy routes already exist:
  - `GET /api/github/prs`
  - `GET /api/github/pr/{pr_number}/files`
  - `POST /api/github/pr/{pr_number}/review`
- AI review function already exists (`review_pull_request`) and returns structured findings.
- GitHub service already fetches PR metadata and diffs.

### Frontend
- Code Review page already exists and calls backend APIs.
- Current UX can list PRs and trigger AI review.

### Conclusion
You are already application-integrated. The task is an upgrade/refactor, not a rebuild.

---

## 2) Target State

### Functional Target
- User gives repository + PR (and later base/head branch support).
- Backend performs multi-pass deep review (summary -> triage -> hunk review -> final output).
- Frontend shows structured review results in the same app.

### Non-Functional Target
- No GitHub Actions dependency.
- Keep existing UI flow stable during migration.
- Support larger PRs with controlled token/cost limits.

---

## 3) Scope for This Phase (Immediate)

### In Scope
- Upgrade backend review logic to richer ai-pr-reviewer-style pipeline.
- Keep existing endpoint contract so frontend keeps working.
- Improve response quality and consistency.

### Out of Scope (Next Phase)
- Full async job queue orchestration.
- Branch compare endpoint (`base/head`) if not needed immediately.
- Posting comments back to GitHub PR.

---

## 4) Architecture Decision

### Decision
Use current backend route + service stack and replace internals of review engine only.

### Why
- Lowest risk.
- Fastest delivery.
- Zero frontend breakage for existing screens.

---

## 5) Implementation Plan (Phased)

## Phase 0 - Baseline and Safety (0.5 day)
1. Snapshot current review response schema and frontend assumptions.
2. Add temporary feature flag for new review engine (`PR_REVIEW_V2=true`).
3. Keep old path as fallback.

**Deliverable**
- Safe rollback path.

## Phase 1 - Prompt and Pipeline Refactor (1 to 2 days)
1. Extract prompt templates into a dedicated module.
2. Implement multi-pass pipeline:
   - Pass A: per-file short summary
   - Pass B: triage (`NEEDS_REVIEW` vs `APPROVED`)
   - Pass C: deep hunk-level review for selected files
   - Pass D: final summary + release-note style output
3. Keep token budgeting and file limits.

**Deliverable**
- New internal review engine producing richer structured output.

## Phase 2 - Structured Output Normalization (1 day)
1. Normalize all findings to strict schema:
   - `file`, `start_line`, `end_line`, `severity`, `category`, `message`, `suggestion`
2. Map model free-text into stable enums for frontend rendering.
3. Preserve old response keys if frontend depends on them.

**Deliverable**
- Stable output contract, no frontend parsing issues.

## Phase 3 - Route Integration Without Contract Break (0.5 day)
1. Keep endpoint same: `POST /api/github/pr/{pr_number}/review`.
2. Internally switch to new engine when flag is on.
3. Add metadata in response:
   - files reviewed
n   - files skipped
   - token/cost estimate

**Deliverable**
- Frontend works unchanged, improved review depth.

## Phase 4 - Frontend Readability Upgrade (0.5 to 1 day)
1. Show grouped findings by file.
2. Display recommendation and risk prominently.
3. Render line ranges (`start_line`-`end_line`) instead of single line where available.

**Deliverable**
- Better reviewer UX without changing core page behavior.

## Phase 5 - Validation and Hardening (1 day)
1. Test with 3 PR sizes: small, medium, large.
2. Add retry and timeout behavior verification.
3. Add limits:
   - max files
   - max patch tokens/file
   - max total review time

**Deliverable**
- Production-safe behavior for current usage.

---

## 6) Exact Files to Modify (Now)

### Backend (Primary)
- `backend/app/services/ai_service.py`
  - Extract/replace `review_pull_request` internals.
- `backend/app/routes/github.py`
  - Keep endpoint, wire to v2 engine and fallback path.
- `backend/app/services/github_service.py`
  - Add helpers if needed for additional diff context.

### Frontend (Minimal)
- `src/pages/CodeReview.tsx`
  - Optional rendering improvements for line ranges and grouped findings.
- `src/lib/api.ts`
  - No breaking change required for current phase.

---

## 7) Suggested Response Schema (V2)

```json
{
  "summary": {
    "overall_risk": "low|medium|high|critical",
    "what_changed": "string",
    "test_coverage_estimate": "string",
    "review_recommendation": "APPROVE|REQUEST_CHANGES|NEEDS_DISCUSSION"
  },
  "findings": [
    {
      "file": "src/path/file.ts",
      "start_line": 42,
      "end_line": 46,
      "severity": "critical|high|medium|low",
      "category": "security|bug|performance|style|test-coverage|maintainability",
      "message": "string",
      "suggestion": "string"
    }
  ],
  "security_flags": ["string"],
  "positive_observations": ["string"],
  "meta": {
    "files_reviewed": 0,
    "files_skipped": 0,
    "duration_ms": 0,
    "engine_version": "v2"
  }
}
```

---

## 8) Acceptance Criteria

1. Existing code review page continues to work without route contract break.
2. At least 80% of findings include file + line range.
3. Small PR review completes within acceptable latency budget.
4. Large PR review gracefully skips oversized files with explanation.
5. No dependency on GitHub Actions events or Action context.

---

## 9) Risks and Mitigations

### Risk: Long latency on big PRs
- Mitigation: file and token caps, triage before deep review.

### Risk: LLM output shape drift
- Mitigation: strict JSON prompt + normalization layer.

### Risk: Frontend rendering mismatch
- Mitigation: backward-compatible keys during transition.

### Risk: Secret exposure
- Mitigation: environment-only secrets, no logging of tokens.

---

## 10) Delivery Timeline (Practical)

- Day 1: Phase 0 + Phase 1
- Day 2: Phase 2 + Phase 3
- Day 3: Phase 4 + Phase 5

Total: ~3 working days for a stable first integration upgrade.

---

## 11) Next Step (Immediate)

Implement Phase 1 in `backend/app/services/ai_service.py` while preserving the current endpoint contract, then validate from existing Code Review page.
