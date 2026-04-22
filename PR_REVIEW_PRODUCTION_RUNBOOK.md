# PR Review V2 Production Runbook

## Objective
Run deep PR review inside the application backend/frontend with zero route breakage and a safe rollback path.

## Implemented Changes

### Backend
- Added PR review v2 feature flags and limits in `backend/app/config.py`:
  - `PR_REVIEW_V2_ENABLED`
  - `PR_REVIEW_MAX_FILES`
  - `PR_REVIEW_MAX_PATCH_CHARS`
  - `PR_REVIEW_MAX_HUNKS_PER_FILE`
- Reworked PR review service in `backend/app/services/ai_service.py`:
  - v2 pipeline: file triage + hunk-aware deep review
  - line-range normalization (`start_line`, `end_line`)
  - recommendation normalization
  - strict fallback to legacy path on any v2 failure
- Kept route contract stable in `backend/app/routes/github.py`:
  - Existing endpoint unchanged: `POST /api/github/pr/{pr_number}/review`
  - Added metadata: `engine_version`, `review_v2_enabled`

### Frontend
- Updated `src/pages/CodeReview.tsx`:
  - supports both v1 and v2 payloads
  - groups findings by file
  - renders IDE-like ranges (`line X` / `lines X-Y`)
  - displays risk/recommendation using normalized summary
  - keeps existing user flow and API calls unchanged

## Compatibility Contract
- Existing frontend endpoint usage remains unchanged.
- Existing backend route remains unchanged.
- Legacy review path still exists and is automatically used if v2 fails.

## Environment Configuration
Set in backend env file:

```env
PR_REVIEW_V2_ENABLED=true
PR_REVIEW_MAX_FILES=15
PR_REVIEW_MAX_PATCH_CHARS=3000
PR_REVIEW_MAX_HUNKS_PER_FILE=8
```

## Rollout Strategy
1. Deploy with `PR_REVIEW_V2_ENABLED=false` first.
2. Smoke test `/api/github/pr/{pr_number}/review` in staging.
3. Enable v2 in staging and compare outputs for sample PRs.
4. Enable v2 in production.
5. Monitor latency, failure rate, and payload quality.

## Rollback Strategy
- Immediate rollback: set `PR_REVIEW_V2_ENABLED=false`.
- No code revert needed.
- Route and frontend continue working via legacy logic.

## Quality Gates
1. Route compatibility: existing frontend still receives `review` and `files_reviewed`.
2. Line mapping: findings include `start_line` and `end_line` for at least 80% of findings.
3. Stability: v2 errors automatically fallback to legacy response.
4. Performance: review completes under configured max limits.

## Validation Checklist
- [ ] Fetch PR list from UI.
- [ ] Trigger AI review from existing PR card.
- [ ] Confirm findings grouped by file.
- [ ] Confirm line ranges are shown.
- [ ] Confirm security flags and positives render.
- [ ] Confirm engine badge shows `v2` when enabled.
- [ ] Disable v2 and verify UI still works via legacy output.

## Next Enhancements (Optional)
- Add async job mode for very large PRs.
- Add branch compare endpoint (`base/head`) in addition to PR number.
- Add persistent review history with replay in UI.
- Add token/cost telemetry in admin dashboard.
