"""
Repo analysis routes.

POST /repo/analyze                       — start async analysis job (returns job_id immediately)
GET  /repo/jobs/{job_id}                 — poll analysis job status + step logs
GET  /repo/analyses/{id}                 — fetch a saved analysis
GET  /repo/analyses/{id}/tests           — list generated tests for an analysis
POST /repo/analyses/{id}/execute         — run tests live with Playwright
GET  /repo/execution/{run_id}            — poll live execution results (with screenshots)
"""
import asyncio
import httpx
import logging

from fastapi import APIRouter, BackgroundTasks, Body, HTTPException

from app.database import get_db
from app.models.repo_analysis import RepoAnalysisRequest
from app.services import playwright_service, repo_service
from app.services.analysis_runner import create_job, get_job, run_analysis, run_commit_analysis

log = logging.getLogger("repo_analysis")


async def _check_url_reachable(url: str) -> str | None:
    """
    Try a GET request to url. Returns None if reachable, or an error string if not.
    Times out after 8 seconds so we don't stall the request.
    """
    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
            resp = await client.get(url, timeout=8.0)
        log.info("Pre-flight check %s → HTTP %d", url, resp.status_code)
        return None  # reachable (even 4xx counts — the server is up)
    except httpx.ConnectError:
        return f"Connection refused — nothing is running at {url}"
    except httpx.TimeoutException:
        return f"Connection timed out after 8 s — {url} did not respond"
    except Exception as exc:
        return f"Could not reach {url}: {exc}"

router = APIRouter(prefix="/repo", tags=["Repo Analysis"])


# ── Start analysis job (returns immediately) ──────────────────────────────────

# ── Fetch recent commits (for commit-picker UI) ───────────────────────────────

@router.post("/commits")
async def fetch_commits(body: dict = Body(...)):
    """
    Clone the repo (depth=12) and return the last 10 commits.
    Used by the frontend commit-picker before starting an analysis.
    """
    github_url = body.get("github_url", "").strip()
    if not github_url:
        raise HTTPException(status_code=400, detail="github_url is required")
    try:
        commits = await asyncio.to_thread(repo_service.get_repo_commits, github_url, 10)
        return {"commits": commits}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Start analysis job (returns immediately) ──────────────────────────────────

@router.post("/analyze", status_code=202)
async def start_analyze(body: RepoAnalysisRequest, background_tasks: BackgroundTasks):
    """
    Returns a job_id immediately.
    mode="full"   → full codebase analysis (default).
    mode="commit" → diff-based analysis for a specific commit (commit_sha required).
    Poll GET /repo/jobs/{job_id} for progress + result.
    """
    reach_err = await _check_url_reachable(body.target_url)
    if reach_err:
        log.warning(
            "Target URL pre-flight warning: %s — %s (continuing anyway)",
            body.target_url, reach_err,
        )

    job_id = create_job(
        body.github_url,
        body.target_url,
        body.test_email,
        body.test_password,
        body.test_preferences,
        num_tests=body.num_tests,
        mode=body.mode,
        commit_sha=body.commit_sha,
        commit_message=body.commit_message,
    )

    if body.mode == "commit":
        if not body.commit_sha:
            raise HTTPException(status_code=400, detail="commit_sha is required for mode='commit'")
        background_tasks.add_task(run_commit_analysis, job_id)
    else:
        background_tasks.add_task(run_analysis, job_id)

    return {"job_id": job_id, "status": "pending", "mode": body.mode}


# ── Poll job status + logs ────────────────────────────────────────────────────

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """
    Returns the current job status, step, log lines, and (when completed) the full result.

    status: pending | running | completed | failed
    step:   pending | cloning | extracting | analyzing | generating | completed | failed
    logs:   list of human-readable progress lines
    result: populated only when status == 'completed'
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ── Fetch a saved analysis ────────────────────────────────────────────────────

@router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str):
    db = get_db()
    doc = await db.repo_analyses.find_one({"_id": analysis_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    doc["id"] = doc.pop("_id")
    return doc


# ── List tests for an analysis ────────────────────────────────────────────────

@router.get("/analyses/{analysis_id}/tests")
async def get_tests(analysis_id: str):
    db = get_db()
    cursor = db.playwright_tests.find({"analysis_id": analysis_id})
    docs = await cursor.to_list(length=100)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


# ── Execute tests live ────────────────────────────────────────────────────────

@router.post("/analyses/{analysis_id}/execute", status_code=202)
async def execute_tests(analysis_id: str, background_tasks: BackgroundTasks):
    """
    Starts a Playwright execution run in the background.
    Returns run_id — poll GET /repo/execution/{run_id} for live results.
    """
    db = get_db()

    analysis = await db.repo_analyses.find_one({"_id": analysis_id})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # ── Pre-flight: verify the target URL is actually reachable ───────────────
    target_url: str = analysis["target_url"]
    reach_err = await _check_url_reachable(target_url)
    if reach_err:
        log.error("Pre-flight failed for %s: %s", target_url, reach_err)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Target URL is not reachable: {reach_err}. "
                f"Make sure your app is running at {target_url} and is accessible "
                f"from this server before running tests."
            ),
        )

    cursor = db.playwright_tests.find({"analysis_id": analysis_id})
    tests = await cursor.to_list(length=100)

    if not tests:
        raise HTTPException(
            status_code=400,
            detail="No tests found for this analysis. Run /analyze first."
        )

    import uuid
    run_id = str(uuid.uuid4())
    background_tasks.add_task(
        playwright_service.execute_playwright_tests,
        tests,
        analysis["target_url"],
        run_id,
        analysis_id,
    )

    return {"run_id": run_id, "total": len(tests), "status": "started"}


# ── Update a playwright test case ─────────────────────────────────────────────

@router.put("/tests/{test_id}")
async def update_test(test_id: str, body: dict = Body(...)):
    db = get_db()
    doc = await db.playwright_tests.find_one({"_id": test_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Test not found")
    await db.playwright_tests.update_one({"_id": test_id}, {"$set": body})
    updated = await db.playwright_tests.find_one({"_id": test_id})
    updated["id"] = updated.pop("_id")
    return updated


# ── Poll execution results ────────────────────────────────────────────────────

@router.get("/execution/{run_id}")
async def get_execution_status(run_id: str):
    """
    Returns live execution status and per-step screenshots.
    Poll at ~1 s intervals while status == 'running'.
    Falls back to MongoDB for runs from previous sessions.
    """
    run = playwright_service.get_run(run_id)
    if not run:
        # Try to load from persisted history
        db = get_db()
        run = await db.playwright_runs.find_one({"_id": run_id})
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        run.pop("_id", None)
    return run


# ── Run history ───────────────────────────────────────────────────────────────

@router.get("/runs")
async def list_runs():
    """Return the 20 most recent test runs (summary rows, no screenshots)."""
    runs = await playwright_service.list_runs_from_db(limit=20)
    return {"runs": runs}


@router.get("/runs/{run_id}")
async def get_run_detail(run_id: str):
    """Full run detail including step results (no screenshots in persisted copy)."""
    db = get_db()
    run = await db.playwright_runs.find_one({"_id": run_id})
    if not run:
        # Fall back to in-memory (current session)
        run = playwright_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.pop("_id", None)
    return run
