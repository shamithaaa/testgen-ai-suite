"""
Azure OpenAI client wrapper.
All prompts live here so every other service just calls helpers.
"""
import asyncio
import json
import re
import time
from typing import Any

from openai import AzureOpenAI, RateLimitError, APIStatusError

from app.config import settings

_client = AzureOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_key=settings.AZURE_OPENAI_KEY,
    api_version=settings.AZURE_OPENAI_API_VERSION,
)
_DEPLOYMENT = settings.AZURE_OPENAI_DEPLOYMENT

# --- rate-limit handling ---------------------------------------------------

class AIQuotaError(Exception):
    """Raised when Azure OpenAI returns 429 after all retries are exhausted."""


def _is_quota_error(exc: Exception) -> bool:
    return isinstance(exc, RateLimitError) or "429" in str(exc) or "quota" in str(exc).lower()


def _call_openai_sync(prompt: str) -> str:
    """Synchronous Azure OpenAI chat completion with up to 3 retries on 429."""
    delays = [5, 15, 30]
    for attempt, delay in enumerate(delays, 1):
        try:
            response = _client.chat.completions.create(
                model=_DEPLOYMENT,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            if _is_quota_error(exc):
                if attempt < len(delays):
                    time.sleep(delay)
                    continue
                raise AIQuotaError(
                    "Azure OpenAI quota exceeded or rate limited. "
                    "Please wait a moment and try again. "
                    f"Details: {exc}"
                ) from exc
            raise  # non-429 errors bubble up immediately


async def _call_openai(prompt: str) -> str:
    """Async wrapper — runs the sync call in a thread so the event loop isn't blocked."""
    return await asyncio.to_thread(_call_openai_sync, prompt)

# --------------------------------------------------------------------------


def _clean_json(raw: str) -> str:
    """Strip markdown code fences the model sometimes adds."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


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
    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    data: dict[str, Any] = json.loads(text)
    return data


async def generate_requirement_based_data(
    requirement_text: str,
    count: int,
) -> dict[str, Any]:
    """
    Given a software requirement, ask the model to:
      1. Decide the most relevant test-data schema (field names, types, descriptions).
      2. Generate `count` realistic rows for that schema.

    Returns:
    {
      "schema": [{"name": str, "type": str, "description": str}, ...],
      "rows":   [{field: value, ...}, ...]
    }
    """
    prompt = f"""You are a test-data engineer.

A software team is testing the following requirement:

REQUIREMENT:
{requirement_text}

Your job has two parts:

PART 1 — SCHEMA DESIGN
Decide what data fields are needed to properly test this requirement.
Do NOT use generic or vehicle-specific fields unless the requirement is about vehicles.
Infer meaningful, domain-specific fields directly from the requirement text.
Give 5-10 fields. Each field must have:
  - name: snake_case column identifier
  - type: one of "string", "integer", "float", "boolean", "datetime"
  - description: one sentence describing what realistic values look like

PART 2 — DATA GENERATION
Generate {count} realistic, varied test data rows using exactly the schema you designed above.
Each row must cover different realistic scenarios implied by the requirement
(normal cases, boundary cases, edge cases, failure-prone values).

Return ONLY valid JSON (no markdown, no explanation) in this exact shape:
{{
  "schema": [
    {{"name": "...", "type": "...", "description": "..."}}
  ],
  "rows": [
    {{"field_name": value, ...}},
    ...
  ]
}}

Rules:
- Every row must have every field from the schema.
- Vary values across the {count} rows — do not repeat the same values.
- Values must be realistic and directly relevant to the requirement.
- Boolean fields use true/false (JSON), not strings.
- datetime fields use ISO 8601 format strings.
- Numbers must be JSON numbers, not strings.
"""
    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    result: dict[str, Any] = json.loads(text)
    return result


async def generate_column_based_data(
    columns: list[str],
    count: int = 20,
    requirement: str | None = None,
) -> list[dict[str, Any]]:
    """
    Given a list of column names (and optional requirement context),
    ask the model to generate `count` realistic data rows for those columns.
    Returns a list of dicts keyed by the column names.
    """
    req_hint = f'\nRequirement context: "{requirement}"' if requirement else ""
    prompt = f"""You are a test data generator.{req_hint}

Generate {count} realistic test data rows for a dataset with these columns:
{columns}

Return ONLY a valid JSON object with a single key "rows" containing a JSON array.
Each element must be an object with exactly these keys: {columns}
Infer sensible data types and realistic value ranges from the column names.
Vary the values realistically across rows."""

    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    parsed = json.loads(text)
    # Accept either a bare array or {"rows": [...]}
    rows: list[dict[str, Any]] = parsed if isinstance(parsed, list) else parsed.get("rows", parsed)
    return rows


async def prioritize_tests(test_results_summary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Given a summary of recent test results, ask the model to rank them by risk.
    Returns list ordered by priority desc.
    """
    prompt = f"""
You are a QA risk analyst. Based on the test execution history below, rank each test case
by execution priority (0-100, higher = run first).

TEST HISTORY (JSON):
{json.dumps(test_results_summary, indent=2)}

Return ONLY a valid JSON object with a single key "results" containing an array ordered by priority descending.
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
    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    parsed = json.loads(text)
    ranked: list[dict[str, Any]] = parsed if isinstance(parsed, list) else parsed.get("results", list(parsed.values())[0])
    return ranked
