from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.services import execution_service

router = APIRouter(prefix="/test-execution", tags=["Test Execution"])


@router.post("/run", status_code=201)
async def run_tests(requirement_id: Optional[str] = Query(default=None)):
    """
    Simulate running all (or requirement-scoped) test cases.
    Returns a run summary with pass/fail counts.
    """
    try:
        summary = await execution_service.run_tests(requirement_id=requirement_id)
        return summary
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/results")
async def get_results(
    run_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    return await execution_service.get_results(run_id=run_id, limit=limit)


@router.get("/runs/{run_id}")
async def get_run_summary(run_id: str):
    summary = await execution_service.get_run_summary(run_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return summary
