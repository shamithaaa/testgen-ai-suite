"""
Test execution service: simulates running test cases and stores results.
"""
import random
import uuid
from datetime import datetime
from typing import Any

from app.database import get_db
from app.models.test_execution import RunSummary, TestResultOut
from app.services.test_case_service import get_test_cases


# tc_ids that are "known flaky" – simulate occasional failures for realism
_FLAKY_IDS = {"TC-003", "TC-011", "TC-022", "TC-041"}


def _simulate_result(tc_id: str, name: str, severity: str) -> dict[str, Any]:
    """Simulate a pass/fail for a single test case."""
    if tc_id in _FLAKY_IDS:
        status = random.choices(["PASS", "FAIL"], weights=[40, 60])[0]
    else:
        status = random.choices(["PASS", "FAIL"], weights=[85, 15])[0]

    duration = round(random.uniform(0.3, 9.0), 2)
    error = None
    if status == "FAIL":
        error = random.choice([
            "AssertionError: expected response within timeout",
            "ConnectionRefusedError: platform unreachable",
            "ValidationError: payload field missing",
            "TimeoutError: no ACK received",
        ])
    return {
        "tc_id": tc_id,
        "name": name,
        "status": status,
        "duration": duration,
        "error_message": error,
    }


async def run_tests(requirement_id: str | None = None) -> RunSummary:
    db = get_db()
    run_id = str(uuid.uuid4())
    started_at = datetime.utcnow()

    tests = await get_test_cases(requirement_id=requirement_id)
    if not tests:
        # Fall back to all stored test cases
        tests = await get_test_cases()

    results = []
    for tc in tests:
        res = _simulate_result(tc.tc_id, tc.name, tc.severity)
        res["run_id"] = run_id
        res["timestamp"] = datetime.utcnow()
        results.append(res)

    if results:
        await db.test_results.insert_many(results)

    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    skipped = sum(1 for r in results if r["status"] == "SKIP")
    total_dur = round(sum(r["duration"] for r in results), 2)

    return RunSummary(
        run_id=run_id,
        total=len(results),
        passed=passed,
        failed=failed,
        skipped=skipped,
        success_rate=round(passed / len(results) * 100, 1) if results else 0.0,
        total_duration=total_dur,
        started_at=started_at,
    )


async def get_results(run_id: str | None = None, limit: int = 100) -> list[TestResultOut]:
    db = get_db()
    query: dict[str, Any] = {}
    if run_id:
        query["run_id"] = run_id

    cursor = db.test_results.find(query).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [
        TestResultOut(
            id=str(d["_id"]),
            tc_id=d["tc_id"],
            name=d["name"],
            status=d["status"],
            duration=d["duration"],
            error_message=d.get("error_message"),
            run_id=d["run_id"],
            timestamp=d["timestamp"],
        )
        for d in docs
    ]


async def get_run_summary(run_id: str) -> RunSummary | None:
    db = get_db()
    cursor = db.test_results.find({"run_id": run_id})
    docs = await cursor.to_list(length=1000)
    if not docs:
        return None

    passed = sum(1 for d in docs if d["status"] == "PASS")
    failed = sum(1 for d in docs if d["status"] == "FAIL")
    skipped = sum(1 for d in docs if d["status"] == "SKIP")
    total_dur = round(sum(d["duration"] for d in docs), 2)

    return RunSummary(
        run_id=run_id,
        total=len(docs),
        passed=passed,
        failed=failed,
        skipped=skipped,
        success_rate=round(passed / len(docs) * 100, 1),
        total_duration=total_dur,
        started_at=docs[-1]["timestamp"],
    )
