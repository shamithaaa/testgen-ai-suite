"""
Azure OpenAI client wrapper.
All prompts live here so every other service just calls helpers.
"""
import asyncio
import json
import re
import time
import uuid
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


def _call_openai_sync(prompt: str, json_mode: bool = True) -> str:
    """Synchronous Azure OpenAI chat completion with up to 3 retries on 429."""
    delays = [5, 15, 30]
    kwargs: dict = {
        "model": _DEPLOYMENT,
        "messages": [{"role": "user", "content": prompt}],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    for attempt, delay in enumerate(delays, 1):
        try:
            response = _client.chat.completions.create(**kwargs)
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


async def _call_openai(prompt: str, json_mode: bool = True) -> str:
    """Async wrapper — runs the sync call in a thread so the event loop isn't blocked."""
    return await asyncio.to_thread(_call_openai_sync, prompt, json_mode)

# --------------------------------------------------------------------------


def _clean_json(raw: str) -> str:
    """Strip markdown code fences the model sometimes adds."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


async def generate_test_cases(requirement: str, instructions: str = None) -> dict[str, list[dict[str, str]]]:
    """
    Returns a dict with keys: functional, edge, api, failure, regression.
    Each value is a list of test-case objects.
    """
    prompt = f"""
You are a senior QA engineer. Given the software requirement below, generate comprehensive test cases.
{f"USER INSTRUCTIONS: {instructions}" if instructions else ""}

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


async def analyze_codebase(codebase_content: str, target_url: str) -> dict[str, Any]:
    """
    Analyse an extracted codebase and return structured UI information:
    summary, tech_stack, pages (with key elements), and user flows.
    """
    prompt = f"""You are a senior QA engineer performing UI analysis on a web application codebase.

TARGET URL: {target_url}

CODEBASE (extracted source files):
{codebase_content[:70000]}

Carefully read the code and identify:
1. All distinct pages / views / routes in this application
2. The key interactive UI elements on each page (buttons, inputs, links, modals, forms)
3. The main user flows (sequences of actions a user would follow)
4. The technology stack being used

Return ONLY valid JSON (no markdown, no explanation) with exactly this shape:
{{
  "summary": "One-paragraph description of what this application does",
  "tech_stack": "e.g. React + TypeScript + Tailwind + React Router",
  "pages": [
    {{
      "name": "Human-readable page name",
      "path": "/route-path",
      "description": "What the user can do on this page",
      "key_elements": ["Login button", "Email input", "Password input", "Remember me checkbox"]
    }}
  ],
  "user_flows": [
    {{
      "name": "Flow name (e.g. User Registration)",
      "steps": ["Navigate to /register", "Fill name field", "Fill email field", "Submit form", "See confirmation"]
    }}
  ]
}}

Rules:
- Identify 3–8 pages. If the app has fewer pages, identify all of them.
- Identify 2–5 meaningful user flows.
- key_elements must name the actual UI text/labels visible in the code (e.g. "Sign In button" not "button").
- path must be the actual route path as defined in the router.
"""
    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    return json.loads(text)


async def generate_playwright_tests(
    analysis: dict[str, Any],
    target_url: str,
    test_email: str | None = None,
    test_password: str | None = None,
    test_preferences: str | None = None,
    num_tests: int = 1,
) -> list[dict[str, Any]]:
    """
    Given a structured codebase analysis, generate Playwright test cases with
    specific, executable steps (navigate, click, fill, assert_text, screenshot).
    Real credentials (test_email / test_password) are injected so that login tests
    use actual values instead of placeholders.
    """
    # Build credentials hint for the prompt
    cred_section = ""
    if test_email and test_password:
        cred_section = f"""
REAL TEST CREDENTIALS (use these exact values in fill steps for login forms):
  Email:    {test_email}
  Password: {test_password}

IMPORTANT: Replace any placeholder email/password values with the credentials above.
Do NOT use "testuser@example.com" or "Password123!" — use the real credentials provided.
"""
    elif test_email:
        cred_section = f"""
REAL TEST CREDENTIALS:
  Email:    {test_email}
  Password: (not provided — skip tests that require a password)
"""
    else:
        cred_section = """
TEST CREDENTIALS: Not provided.
Use placeholder values but add a comment in the description that real credentials are needed.
"""

    prompt = f"""You are a senior Playwright test automation engineer with deep expertise in React, Radix UI, and modern component libraries.

TARGET URL: {target_url}
{cred_section}
APPLICATION ANALYSIS:
{json.dumps(analysis, indent=2)}

Generate comprehensive Playwright test cases that cover the pages and user flows above.

{f"USER TEST PREFERENCES:\\n{test_preferences}\\n\\nPrioritize generating tests that match the preferences above." if test_preferences else ""}

Return ONLY valid JSON (no markdown) with exactly this shape:
{{
  "tests": [
    {{
      "name": "Descriptive test name",
      "description": "What this test verifies",
      "page_name": "Name of the page being tested",
      "severity": "Critical|High|Medium|Low",
      "steps": [
        {{
          "action": "navigate",
          "selector": null,
          "value": "/route-path",
          "description": "Navigate to the page"
        }},
        {{
          "action": "screenshot",
          "selector": null,
          "value": null,
          "description": "Capture page load state"
        }},
        {{
          "action": "fill",
          "selector": "input[type=\\"email\\"]",
          "value": "{test_email or 'user@example.com'}",
          "description": "Enter email address"
        }},
        {{
          "action": "fill",
          "selector": "input[type=\\"password\\"]",
          "value": "{test_password or 'yourpassword'}",
          "description": "Enter password"
        }},
        {{
          "action": "click",
          "selector": "button:has-text(\\"Sign In\\")",
          "value": null,
          "description": "Click the Sign In button"
        }},
        {{
          "action": "wait",
          "selector": null,
          "value": "4",
          "description": "Wait for redirect to complete"
        }},
        {{
          "action": "assert_text",
          "selector": null,
          "value": "Text expected to be visible after action",
          "description": "Verify the expected result"
        }},
        {{
          "action": "screenshot",
          "selector": null,
          "value": null,
          "description": "Capture final state"
        }}
      ]
    }}
  ]
}}

STRICT RULES — follow every rule or tests will fail:

GENERAL:
- Generate EXACTLY {num_tests} test case(s). No more, no fewer.
- ALWAYS start each test with a "navigate" step.
- Include at least 2 "screenshot" steps per test (beginning and end).
- For login fill steps, use EXACTLY the credentials provided above (not placeholders).
- After clicking a submit/login button, add a "wait" step of "4" seconds before asserting.

SELECTOR RULES (critical):
- For button clicks: ALWAYS use button:has-text("Label") — NEVER use text=Label.
- For link clicks: use a:has-text("Label") or [role="link"]:has-text("Label").
- For standard inputs: input[type="email"], input[type="password"].
- For dialog/modal inputs: use selector '[role="dialog"] input' (NOT input[type="text"] since type may be absent).
- For inputs with placeholder: ALWAYS quote: input[placeholder="Search tasks..."] NOT input[placeholder=Search tasks...].
- CSS attribute values with spaces or special chars MUST use double quotes.
- For role-based elements: [role="dialog"], [role="checkbox"], button[type="submit"].

RADIX UI / CUSTOM COMPONENTS (CRITICAL — read carefully):
- Checkboxes in Radix UI are NOT native inputs. Use [role="checkbox"] or [data-state="unchecked"] NOT input[type="checkbox"].
- Radix UI <Select> triggers render with role="combobox", NOT as plain <button> elements.
  To click a Radix Select trigger:
    • Inside a dialog: use '[role="dialog"] [role="combobox"]'   ← NOT '[role="dialog"] button:has-text("Priority")'
    • On the page: use '[role="combobox"]' or '[role="combobox"]:has-text("placeholder text")'
  After clicking the combobox trigger, click the option: [role="option"]:has-text("Value")
- NEVER write 'button:has-text("Priority")' or 'button:has-text("Sort")' for Radix Select triggers — they will ALWAYS timeout.
- For plain filter chips (All/Active/Completed toggle buttons that are real buttons): button:has-text("Completed") is fine.

LIST ITEMS (CRITICAL):
- Do NOT assume task/todo/item list entries are <li> elements. Modern React apps often use <div> or <article>.
- For hover_and_click containers, use: '[class*="item"]', '[class*="task"]', '[class*="card"]', 'article', '[role="listitem"]'
- Do NOT use bare 'li:has-text("...")' for task list items — use '[class*="item"]:has-text("...")', 'article:has-text("...")', or '[role="listitem"]:has-text("...")'

HIDDEN ELEMENTS (hover-to-reveal):
- If a button only appears on hover (e.g. Delete, Edit on list items), use "hover_and_click" action:
  selector = a broad container selector to hover (e.g. "[class*='item']:has-text('Task Name')", "article:has-text('Task Name')")
  value = the button selector to click after hovering (e.g. "button:has-text(\\"Edit\\")")
- Alternative: use "hover" action first, then "click" action for the revealed button.

SUPPORTED ACTIONS:
navigate, click, fill, assert_text, screenshot, wait, hover, hover_and_click, press, check, uncheck, select_option, drag_and_drop, dblclick, type_into, scroll, clear

- "hover_and_click": selector=element to hover over, value=element to click after hover reveals it
- "press": value=key name e.g. "Enter", "Tab", "Escape"
- "check"/"uncheck": for native checkboxes only
- "select_option": for native <select> only; for custom selects use click+click pattern
- "drag_and_drop": selector=source, value=target
- "wait": value=seconds as string e.g. "4"
- "scroll": selector=element to scroll into view
- "clear": selector=input to clear

SEVERITY: Critical=auth/core, High=main feature, Medium=secondary, Low=cosmetic.
"""
    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    parsed = json.loads(text)
    tests: list[dict[str, Any]] = parsed.get("tests", [])
    return tests


async def analyze_commit_and_generate_tests(
    commit_sha: str,
    commit_message: str,
    diff_text: str,
    file_contents: str,
    changed_files: list[str],
    target_url: str,
    test_email: str | None = None,
    test_password: str | None = None,
    num_tests: int = 1,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Given the diff of a specific commit, first understand what user-facing
    functionality changed, then generate targeted Playwright tests for those changes.
    Returns (analysis_data, tests_list).
    """
    cred_section = ""
    if test_email and test_password:
        cred_section = f"""
REAL TEST CREDENTIALS (use these EXACT values in login fill steps):
  Email:    {test_email}
  Password: {test_password}
"""
    elif test_email:
        cred_section = f"""
REAL TEST CREDENTIALS:
  Email:    {test_email}
  Password: (not provided — skip tests that require a password)
"""
    else:
        cred_section = "TEST CREDENTIALS: Not provided. Use placeholder values."

    prompt = f"""You are a senior QA engineer and Playwright automation engineer.

A developer just committed: "{commit_message}" (SHA: {commit_sha[:8]})
CHANGED FILES: {', '.join(changed_files[:20])}

TARGET APP URL: {target_url}
{cred_section}

GIT DIFF (what changed):
{diff_text[:25000]}

CURRENT FILE CONTENTS (after the commit):
{file_contents[:25000]}

Your task has TWO parts:

PART 1 — UNDERSTAND THE CHANGE
Analyze what user-facing functionality changed in this commit. Focus on:
- Which pages/views are affected
- What new features or bug fixes were introduced
- What user interactions are affected

PART 2 — GENERATE TARGETED PLAYWRIGHT TESTS
Generate EXACTLY {num_tests} targeted Playwright test case(s) that specifically verify the changed functionality.
These are REGRESSION tests — confirm the commit's changes work correctly.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "analysis": {{
    "summary": "One paragraph: what this commit changes from a user's perspective",
    "tech_stack": "Technology stack of the app",
    "pages": [
      {{
        "name": "Page name",
        "path": "/route",
        "description": "What changed on this page",
        "key_elements": ["Element 1", "Element 2"]
      }}
    ],
    "user_flows": [
      {{
        "name": "Affected user flow name",
        "steps": ["Step 1", "Step 2", "Step 3"]
      }}
    ]
  }},
  "tests": [
    {{
      "name": "Descriptive test name targeting the changed functionality",
      "description": "What specific change this test validates",
      "page_name": "Page being tested",
      "severity": "Critical|High|Medium|Low",
      "steps": [
        {{"action": "navigate", "selector": null, "value": "/", "description": "Open the app"}},
        {{"action": "screenshot", "selector": null, "value": null, "description": "Capture initial state"}},
        {{"action": "fill", "selector": "input[type=\\"email\\"]", "value": "{test_email or 'user@example.com'}", "description": "Enter email"}},
        {{"action": "fill", "selector": "input[type=\\"password\\"]", "value": "{test_password or 'password'}", "description": "Enter password"}},
        {{"action": "click", "selector": "button:has-text(\\"Sign In\\")", "value": null, "description": "Sign in"}},
        {{"action": "wait", "selector": null, "value": "4", "description": "Wait for redirect"}},
        {{"action": "assert_text", "selector": null, "value": "Expected text after action", "description": "Verify the change works"}},
        {{"action": "screenshot", "selector": null, "value": null, "description": "Capture final state"}}
      ]
    }}
  ]
}}

STRICT RULES for tests (all apply from the standard test generation):
- ALWAYS start each test with "navigate".
- Include at least 2 "screenshot" steps per test.
- For login steps, use EXACT credentials provided.
- After clicking login/submit, add "wait" step of "4" seconds.
- For Radix UI Select triggers: use [role="combobox"], NOT button:has-text("...").
- For Radix UI Checkboxes: use [role="checkbox"], NOT input[type="checkbox"].
- For hover-reveal buttons (opacity-0): use "hover_and_click" action.
  selector = container to hover, value = button selector to click.
- CSS attribute values with spaces MUST use double-quotes.
- severity: Critical=auth/core, High=main feature, Medium=secondary, Low=cosmetic.
SUPPORTED ACTIONS: navigate, click, fill, assert_text, screenshot, wait, hover, hover_and_click, press, check, uncheck, select_option, drag_and_drop, dblclick, type_into, scroll, clear
"""
    raw = await _call_openai(prompt)
    text = _clean_json(raw)
    parsed: dict[str, Any] = json.loads(text)

    analysis_data: dict[str, Any] = parsed.get("analysis", {})
    tests: list[dict[str, Any]] = parsed.get("tests", [])
    return analysis_data, tests


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


# ─── NEW: SDLC Intelligence prompts ────────────────────────────────────────


async def review_pull_request(pr_title: str, pr_body: str, files: list[dict]) -> dict[str, Any]:
    """
    AI code review for a GitHub pull request.
    Returns structured findings and a PR summary.
    """
    diff_text = "\n\n".join(
        f"=== {f['filename']} (+{f['additions']} -{f['deletions']}) ===\n{f.get('patch', '')[:3000]}"
        for f in files[:15]
    )
    prompt = f"""You are a senior software engineer performing a thorough code review.

PR TITLE: {pr_title}
PR DESCRIPTION: {pr_body[:1000]}

DIFF:
{diff_text[:20000]}

Analyse every file in the diff and return structured findings.

Return ONLY valid JSON (no markdown) with exactly this shape:
{{
  "summary": {{
    "overall_risk": "low|medium|high|critical",
    "what_changed": "1–2 sentence description",
    "test_coverage_estimate": "string (e.g. 'No tests included', 'Unit tests added for 3 functions')",
    "review_recommendation": "APPROVE|REQUEST_CHANGES|NEEDS_DISCUSSION"
  }},
  "findings": [
    {{
      "file": "relative/file/path.ts",
      "line": 42,
      "severity": "critical|high|medium|low",
      "category": "security|bug|performance|style|test-coverage|maintainability",
      "message": "Clear description of the issue",
      "suggestion": "Concrete fix or improvement"
    }}
  ],
  "security_flags": ["string"],
  "positive_observations": ["string"]
}}

Focus on: SQL injection, XSS, null dereferences, missing error handling, hardcoded secrets,
N+1 queries, missing input validation, unhandled promises, race conditions.
Return JSON only."""
    raw = await _call_openai(prompt)
    return json.loads(_clean_json(raw))


async def explain_ci_failure(step: str, error_message: str, stack_trace: str, repo_language: str) -> dict[str, Any]:
    """Explain a CI/CD build failure in plain English."""
    prompt = f"""You are a DevOps engineer. A CI build failed.

Repository language: {repo_language}
Failed step: {step}
Error message: {error_message[:2000]}
Stack trace (first 10 lines):
{stack_trace[:3000]}

Return ONLY valid JSON:
{{
  "explanation": "2–3 sentence plain-English explanation of what went wrong",
  "fix": "One concrete actionable fix",
  "category": "test|build|dependency|environment|flaky|lint|timeout",
  "confidence": 0.85,
  "is_flaky_candidate": false
}}"""
    raw = await _call_openai(prompt)
    return json.loads(_clean_json(raw))


async def generate_defect_risk_narrative(top_risk_files: list[dict]) -> str:
    """Write a risk summary narrative for the top high-risk files."""
    prompt = f"""You are a software engineering lead reviewing code quality metrics.
These are the top highest-risk files in the repository based on change frequency,
bug-fix association, code churn, and author diversity:

{json.dumps(top_risk_files, indent=2)[:8000]}

Write a 3-paragraph risk summary for an engineering manager:
1. Which files need immediate attention and why
2. Pattern analysis — are these in the same module? Same author?
3. Recommended actions (add tests, refactor, code review gate)

Keep it concise and actionable. Plain text, no markdown headers."""
    raw = await _call_openai(prompt)
    return raw.strip()


async def analyze_release_readiness(
    version: str,
    test_pass_rate: float,
    open_critical_bugs: list[dict],
    unresolved_security_findings: int,
    high_risk_files: list[str],
    score: int,
) -> dict[str, Any]:
    """Compute a go/no-go verdict for a release."""
    bug_titles = [f"{b['key']}: {b['summary']}" for b in open_critical_bugs[:5]]
    prompt = f"""You are a release manager. Evaluate this release:

Version: {version}
Test pass rate: {test_pass_rate:.1f}%
Open critical/high bugs: {len(open_critical_bugs)} ({', '.join(bug_titles) or 'none'})
Unresolved security findings: {unresolved_security_findings}
High-risk files changed: {', '.join(high_risk_files[:8]) or 'none'}
Release readiness score: {score}/100

Return ONLY valid JSON:
{{
  "verdict": "GO|NO-GO|CONDITIONAL",
  "confidence": 0.85,
  "primary_blocker": "string or null",
  "recommendation": "2–3 sentence recommendation",
  "conditions": ["string (only if CONDITIONAL)"]
}}"""
    raw = await _call_openai(prompt)
    return json.loads(_clean_json(raw))


async def investigate_incident(
    anomaly: dict,
    column_comparison: list[dict],
    recent_commits: list[str],
    related_alerts: list[dict],
) -> dict[str, Any]:
    """AI root cause analysis for a data quality incident."""
    prompt = f"""You are an incident response engineer. A data quality anomaly has been detected.

Anomaly: {json.dumps(anomaly)}
Affected columns (current vs baseline): {json.dumps(column_comparison[:10])}
Recent commits: {json.dumps(recent_commits[:5])}
Related alerts: {json.dumps(related_alerts[:5])}

Provide a root cause analysis. Return ONLY valid JSON:
{{
  "root_cause": "One sentence most likely root cause",
  "evidence": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "immediate_action": "Single most important remediation step",
  "prevention_action": "How to prevent recurrence",
  "confidence": 0.80
}}"""
    raw = await _call_openai(prompt)
    return json.loads(_clean_json(raw))


async def generate_sprint_summary(sprint_report: dict) -> str:
    """AI-generated sprint quality summary for an engineering manager."""
    prompt = f"""You are an engineering manager. Summarise this sprint's quality performance:

{json.dumps(sprint_report, indent=2)[:6000]}

Write an executive summary (3 paragraphs):
1. What went well (quality wins, story delivery, test coverage)
2. What needs attention (risks that materialised, production incidents, ambiguous stories)
3. Recommendations for next sprint

Keep it factual, reference specific story IDs and numbers where present.
Plain text, no markdown headers, no bullet points — just 3 clean paragraphs."""
    raw = await _call_openai(prompt, json_mode=False)
    return raw.strip()


async def generate_acceptance_criteria(story: dict, existing_stories: list[dict]) -> dict[str, Any]:
    """Generate BDD acceptance criteria for a Jira user story."""
    context = "\n".join(f"- {s['key']}: {s['summary']}" for s in existing_stories[:10])
    prompt = f"""You are a senior QA engineer and business analyst.

USER STORY:
Key: {story.get('key', 'N/A')}
Summary: {story.get('summary', '')}
Description: {story.get('description', '')[:1500]}
Priority: {story.get('priority', 'Medium')}

EXISTING STORIES (for duplicate detection):
{context}

Generate structured acceptance criteria. Return ONLY valid JSON:
{{
  "acceptance_criteria": [
    {{
      "scenario": "Scenario name",
      "given": "Given context",
      "when": "When action",
      "then": "Then expected outcome"
    }}
  ],
  "ambiguity_flags": [
    {{
      "term": "ambiguous term",
      "question": "specific clarification question"
    }}
  ],
  "risk_score": 65,
  "risk_reasoning": "why this score",
  "duplicate_of": "PROJ-123 or null",
  "test_hints": ["key thing to test 1", "key thing to test 2"]
}}

Generate 3–5 Given/When/Then scenarios. Flag terms that are undefined or ambiguous."""
    raw = await _call_openai(prompt)
    return json.loads(_clean_json(raw))


async def generate_predictive_alert(time_series: list[dict], anomalies: list[dict]) -> dict[str, Any]:
    """Generate a predictive alert message from quality time series data."""
    prompt = f"""You are a data observability engineer.

30-day quality score time series (last 10 points):
{json.dumps(time_series[-10:], indent=2)}

Detected anomalies:
{json.dumps(anomalies, indent=2)[:3000]}

Predict which dimension is at risk in the next 48 hours and write a Slack-ready alert.

Return ONLY valid JSON:
{{
  "at_risk_dimension": "completeness|uniqueness|validity|consistency|overall",
  "predicted_breach_in_hours": 36,
  "severity": "critical|warning|info",
  "alert_message": "Slack-ready alert message (2–3 sentences)",
  "recommended_action": "Specific investigation step"
}}"""
    raw = await _call_openai(prompt)
    return json.loads(_clean_json(raw))


async def generate_playwright_tests_from_source(
    file_path: str,
    content: str,
    target_url: str | None = None,
) -> list[dict[str, Any]]:
    """
    Given a React/TypeScript source file from the workspace, generate PlaywrightTestCase
    objects with structured steps. No running app required — steps use relative paths.
    """
    url_line = (
        f"TARGET BASE URL: {target_url} (use as prefix for navigate steps)"
        if target_url
        else "TARGET BASE URL: not provided — use relative paths like '/', '/login', '/dashboard'"
    )
    truncated = content[:10000]

    prompt = f"""You are a senior Playwright E2E test automation engineer specializing in React, TypeScript, and Radix UI.

Given a React/TypeScript source file from a web application, generate comprehensive Playwright test cases.

FILE PATH: {file_path}
{url_line}

SOURCE FILE:
{truncated}

Analyze the component/page to identify:
- The page name and primary feature
- All interactive elements: buttons, forms, inputs, links, dialogs
- Key user flows (happy path, validation, error states)
- Navigation patterns

Return ONLY raw JSON — no markdown fences, no extra text:
{{
  "tests": [
    {{
      "name": "Concise descriptive test name",
      "description": "One-sentence description of what is verified",
      "page_name": "Name of the page or feature (e.g. Login, Dashboard)",
      "severity": "Critical|High|Medium|Low",
      "steps": [
        {{
          "action": "navigate",
          "selector": null,
          "value": "/",
          "description": "Navigate to the page"
        }},
        {{
          "action": "screenshot",
          "selector": null,
          "value": null,
          "description": "Capture initial page state"
        }},
        {{
          "action": "click",
          "selector": "button:has-text(\\"Submit\\")",
          "value": null,
          "description": "Click the Submit button"
        }},
        {{
          "action": "assert_text",
          "selector": null,
          "value": "Expected text on page",
          "description": "Verify expected text is visible"
        }},
        {{
          "action": "screenshot",
          "selector": null,
          "value": null,
          "description": "Capture final state"
        }}
      ]
    }}
  ]
}}

SELECTOR RULES:
- Buttons: button:has-text("Label")
- Links: a:has-text("Label")
- Email input: input[type="email"]
- Password input: input[type="password"]
- Text input with placeholder: input[placeholder="Search..."]
- Radix Select trigger: [role="combobox"]
- Radix Select option: [role="option"]:has-text("Value")
- Radix Checkbox: [role="checkbox"]
- Dialog: [role="dialog"]

VALID ACTIONS: navigate, click, fill, assert_text, screenshot, wait, hover, hover_and_click, press, check, uncheck, select_option, dblclick, type_into, scroll, clear

SEVERITY: Critical=auth/core flows, High=main features, Medium=secondary features, Low=cosmetic

Rules:
- Always start each test with a "navigate" step
- Always include at least one "screenshot" step
- Generate 4-7 test cases covering different scenarios
- Each test should be independently executable
- "wait" value is seconds as a string e.g. "2"
- "hover_and_click": selector=element to hover, value=element to click after hover"""

    raw = await _call_openai(prompt, json_mode=True)
    data = json.loads(_clean_json(raw))
    tests: list[dict[str, Any]] = data.get("tests", [])

    for test in tests:
        test.setdefault("id", str(uuid.uuid4()))
        test.setdefault("analysis_id", "workspace")

    return tests

