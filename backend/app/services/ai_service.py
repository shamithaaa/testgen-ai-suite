"""
Gemini AI client wrapper.
All prompts live here so every other service just calls helpers.
"""
import json
import re
from typing import Any

from google import genai
from google.genai import types

from app.config import settings

_client = genai.Client(api_key=settings.GEMINI_API_KEY)
_MODEL = "gemini-2.5-flash"


def _clean_json(raw: str) -> str:
    """Strip markdown code fences Gemini sometimes adds."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _make_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        temperature=0.4,
        response_mime_type="application/json",
    )


async def generate_test_cases(requirement: str) -> dict[str, list[dict[str, str]]]:
    """
    Returns a dict with keys: functional, edge, api, failure, regression.
    Each value is a list of test-case objects.
    """
    prompt = f"""
You are a senior QA engineer. Given the software requirement below, generate comprehensive test cases.

REQUIREMENT:
{requirement}

Return ONLY valid JSON (no markdown) with this exact shape:
{{
  "functional": [
    {{"tc_id": "TC-001", "name": "...", "description": "...", "severity": "Critical|High|Medium|Low", "expected": "..."}}
  ],
  "edge": [ ... ],
  "api":  [ ... ],
  "failure": [ ... ],
  "regression": [ ... ]
}}

Rules:
- functional: 4-6 tests, core happy-path scenarios
- edge: 3-4 tests, boundary / unusual inputs
- api: 3-4 tests, HTTP-level validations
- failure: 2-3 tests, error and degraded-mode scenarios
- regression: 2-3 tests, backward-compat / migration
- severity must be exactly one of: Critical, High, Medium, Low
- tc_id must be unique across all categories, starting TC-001
"""
    response = _client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=_make_config(),
    )
    text = _clean_json(response.text)
    data: dict[str, Any] = json.loads(text)
    return data


async def generate_synthetic_telemetry(count: int, scenario: str | None) -> list[dict[str, Any]]:
    """
    Ask Gemini to produce `count` realistic vehicle telemetry records.
    """
    scenario_hint = scenario or "mixed urban and highway driving"
    prompt = f"""
You are a vehicle telemetry simulator. Generate {count} realistic truck telemetry records
for the following driving scenario: "{scenario_hint}".

Return ONLY a valid JSON array with no markdown. Each record must have exactly these fields:
{{
  "vehicle_id": "TRK-XXXX",
  "lat": <float>,
  "lng": <float>,
  "engine_temp": <float, Fahrenheit, 150-260>,
  "rpm": <int, 600-4000>,
  "fuel_level": <float, 5-100>,
  "oil_pressure": <float, 20-80>,
  "speed": <float, 0-80>,
  "trip_id": "TRIP-XXXX",
  "status": "Active" | "Idle" | "Maintenance"
}}
Vary the values realistically. Use California-area coordinates (lat 33-38, lng -120 to -115).
"""
    response = _client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=_make_config(),
    )
    text = _clean_json(response.text)
    records: list[dict[str, Any]] = json.loads(text)
    return records


async def prioritize_tests(test_results_summary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Given a summary of recent test results, ask Gemini to rank them by risk.
    Returns list ordered by priority desc.
    """
    prompt = f"""
You are a QA risk analyst. Based on the test execution history below, rank each test case
by execution priority (0-100, higher = run first).

TEST HISTORY (JSON):
{json.dumps(test_results_summary, indent=2)}

Return ONLY a valid JSON array (no markdown) ordered by priority descending.
Each entry must have:
{{
  "tc_id": "...",
  "name": "...",
  "priority": <int 0-100>,
  "status": "failed" | "warning" | "stable",
  "known_failure": <bool>,
  "failure_count": <int>,
  "severity": "Critical|High|Medium|Low"
}}
Base priority on: failure frequency, severity, recent failures, and potential impact.
"""
    response = _client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=_make_config(),
    )
    text = _clean_json(response.text)
    ranked: list[dict[str, Any]] = json.loads(text)
    return ranked
