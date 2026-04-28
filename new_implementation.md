# TestGen AI — Production Implementation Plan

> **Goal:** Give a GitHub repo URL → auto-generate categorised Playwright test cases → store them → on re-submission detect what changed → append only new tests → show a clear diff UI of what was added.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack Decision](#2-tech-stack-decision)
3. [Data Model Design](#3-data-model-design)
4. [How Test Categories Are Decided](#4-how-test-categories-are-decided)
5. [Backend Architecture](#5-backend-architecture)
6. [AI Prompt Strategy](#6-ai-prompt-strategy)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Step-by-Step Implementation](#8-step-by-step-implementation)
9. [API Contract](#9-api-contract)
10. [Folder Structure](#10-folder-structure)
11. [Edge Cases & Production Guards](#11-edge-cases--production-guards)
12. [What "No Blockers" Means Here](#12-what-no-blockers-means-here)

---

## 1. System Overview

```
User submits GitHub URL
        │
        ▼
Backend clones / fetches repo
        │
        ▼
Code Analyser → extract routes, components, functions, models
        │
        ▼
AI Service → generate test cases with smart categorisation
        │
        ▼
MongoDB stores tests under a repo fingerprint
        │
        ▼
  ┌─────┴─────┐
  │           │
First time   Re-submit / changed files
  │           │
Store all   Diff existing tests vs new analysis
            Append only genuinely new ones
            Tag them with session_id + timestamp
        │
        ▼
Frontend shows:
  - Tabs: by detected category (auto, not hardcoded)
  - Badge: "12 new tests added this run"
  - History panel: past runs with counts
```

---

## 2. Tech Stack Decision

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) | Async, fast, clean Pydantic integration |
| AI | Anthropic Claude (claude-sonnet-4) | Best instruction-following for structured JSON |
| DB | MongoDB Atlas | Flexible schema for evolving test structures |
| Repo fetch | GitPython + PyGithub | Clone or API-fetch without full clone |
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Fast, composable, good for dynamic lists |
| State | Zustand | Lightweight, no Redux overhead |
| Queue (prod) | Redis + Celery | Repo scan is slow, must be async |

---

## 3. Data Model Design

### 3.1 Repo Document (MongoDB)

```python
# models/repo.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
import uuid

class TestCategory(str, Enum):
    # These are DETECTED by AI, not hardcoded buckets
    # AI reads the code and assigns the most fitting label
    AUTH = "auth"
    API = "api"
    UI_FORM = "ui_form"
    UI_NAVIGATION = "ui_navigation"
    UI_COMPONENT = "ui_component"
    CRUD = "crud"
    INTEGRATION = "integration"
    EDGE_CASE = "edge_case"
    PERFORMANCE = "performance"
    ACCESSIBILITY = "accessibility"

class TestStep(BaseModel):
    action: str          # "click", "fill", "expect", "navigate"
    target: str          # selector or URL
    value: Optional[str] = None
    assertion: Optional[str] = None

class PlaywrightTest(BaseModel):
    test_id: str = Field(default_factory=lambda: f"TC-{uuid.uuid4().hex[:6].upper()}")
    name: str
    description: str
    category: TestCategory
    
    # For UI tests — which page/route this test belongs to
    # AI extracts this from the route path or component name
    page_path: Optional[str] = None      # e.g. "/dashboard", "/auth/login"
    component_name: Optional[str] = None # e.g. "LoginForm", "UserTable"
    
    # For API tests
    endpoint: Optional[str] = None       # e.g. "POST /api/users"
    
    severity: str  # "critical", "high", "medium", "low"
    steps: List[TestStep] = []
    playwright_code: str  # Actual runnable Playwright test code
    
    # Tracking
    added_in_session: str     # session_id of the run that created this
    source_file: Optional[str] = None  # which file triggered this test
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True    # soft delete instead of removing

class ScanSession(BaseModel):
    session_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    github_url: str
    scan_type: str       # "full" or "incremental"
    changed_files: List[str] = []
    tests_added: int = 0
    tests_total_after: int = 0
    triggered_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"  # "pending", "running", "done", "failed"
    error: Optional[str] = None

class RepoBaseline(BaseModel):
    # One document per repo in MongoDB
    repo_id: str          # SHA256 of normalised github_url
    github_url: str
    default_branch: str = "main"
    last_commit_sha: str = ""
    tests: List[PlaywrightTest] = []
    sessions: List[ScanSession] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### 3.2 MongoDB Indexes

```javascript
// Run once on startup / migration
db.repo_baselines.createIndex({ "repo_id": 1 }, { unique: true })
db.repo_baselines.createIndex({ "github_url": 1 })
db.repo_baselines.createIndex({ "tests.test_id": 1 })
db.repo_baselines.createIndex({ "tests.added_in_session": 1 })
db.repo_baselines.createIndex({ "sessions.session_id": 1 })
```

---

## 4. How Test Categories Are Decided

**This is not hardcoded.** The AI analyses the actual code and assigns the most accurate category. Here is the logic the AI uses:

| What the AI sees | Category assigned |
|---|---|
| `LoginForm`, `useAuth`, `/auth/*` routes | `auth` |
| `fetch('/api/...')`, route handlers, controllers | `api` |
| `<form>`, `handleSubmit`, input validation | `ui_form` |
| `<Link>`, `router.push`, nav components | `ui_navigation` |
| Standalone UI components (buttons, modals, tables) | `ui_component` |
| `create`, `read`, `update`, `delete` operations | `crud` |
| Multiple services talking to each other | `integration` |
| Null checks, empty states, 404 handling | `edge_case` |
| `loading`, `skeleton`, debounce | `performance` |
| `aria-*`, role attributes, keyboard nav | `accessibility` |

The AI is instructed: _"Read the code and assign the most precise category from the enum. Do not default to 'ui' for everything. A login form is 'auth'. A data grid is 'ui_component'. A checkout flow touching payments API is 'integration'."_

---

## 5. Backend Architecture

### 5.1 Services Breakdown

```
services/
  repo_service.py       — clone, read files, extract structure
  ai_service.py         — all AI calls
  diff_service.py       — detect what actually changed vs baseline
  test_store.py         — all MongoDB read/write logic
  session_service.py    — track scan runs
```

### 5.2 repo_service.py — What We Extract

```python
# services/repo_service.py
import subprocess, os, hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict

SUPPORTED_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py', '.vue', '.svelte'}
SKIP_DIRS = {'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage'}

@dataclass
class ExtractedFile:
    path: str
    content: str
    language: str
    size_tokens: int  # rough estimate: len(content) // 4

@dataclass
class RepoSnapshot:
    github_url: str
    commit_sha: str
    files: List[ExtractedFile]
    routes: List[str]          # detected URL paths
    components: List[str]      # detected component names
    api_endpoints: List[str]   # detected API routes

def get_repo_id(github_url: str) -> str:
    normalised = github_url.lower().rstrip('/').replace('.git', '')
    return hashlib.sha256(normalised.encode()).hexdigest()[:16]

async def fetch_repo(github_url: str, token: str = None) -> RepoSnapshot:
    """
    Clone repo to temp dir, extract meaningful files.
    Cap at 200 files. Skip binary, skip large files > 50KB.
    """
    ...

def chunk_files_for_ai(files: List[ExtractedFile], max_tokens: int = 80000) -> List[List[ExtractedFile]]:
    """
    Split files into chunks that fit within AI context window.
    Prioritise: route files > component files > utility files > config files
    """
    ...
```

### 5.3 diff_service.py — The Core Intelligence

```python
# services/diff_service.py
"""
When the same repo is submitted again, we need to know:
1. Which files changed since last scan
2. Which existing tests cover those files
3. What new tests the AI should generate (only for changed areas)

Strategy:
- Compare current commit SHA with stored last_commit_sha
- If same SHA: skip (no changes, return 0 new tests)
- If different: use git diff to get changed files
- If no git access: compare file content hashes stored in session
"""

from typing import List, Tuple
from models.repo import PlaywrightTest, RepoBaseline

def get_changed_files(old_sha: str, new_sha: str, repo_path: str) -> List[str]:
    """Returns list of file paths that changed between two commits."""
    result = subprocess.run(
        ['git', 'diff', '--name-only', old_sha, new_sha],
        cwd=repo_path, capture_output=True, text=True
    )
    return [f.strip() for f in result.stdout.splitlines() if f.strip()]

def find_related_tests(
    changed_files: List[str], 
    existing_tests: List[PlaywrightTest]
) -> List[PlaywrightTest]:
    """
    For each changed file, find tests that reference it via source_file.
    These are the tests the AI should know about to avoid duplication.
    """
    related = []
    changed_set = set(changed_files)
    for test in existing_tests:
        if test.source_file and test.source_file in changed_set:
            related.append(test)
    return related

def deduplicate_tests(
    new_candidates: List[PlaywrightTest],
    existing_tests: List[PlaywrightTest]
) -> List[PlaywrightTest]:
    """
    Final dedup pass after AI returns new tests.
    Compare by: name similarity > 0.85 using SequenceMatcher
    Also compare endpoint + page_path combination.
    """
    from difflib import SequenceMatcher
    truly_new = []
    existing_names = [t.name.lower() for t in existing_tests]
    
    for candidate in new_candidates:
        cname = candidate.name.lower()
        is_duplicate = False
        for ename in existing_names:
            ratio = SequenceMatcher(None, cname, ename).ratio()
            if ratio > 0.85:
                is_duplicate = True
                break
        if not is_duplicate:
            truly_new.append(candidate)
    return truly_new
```

### 5.4 ai_service.py — Two Modes

```python
# services/ai_service.py
import anthropic, json
from typing import List
from models.repo import PlaywrightTest, TestCategory

client = anthropic.Anthropic()

SYSTEM_PROMPT = """
You are a senior QA engineer who writes production-grade Playwright test cases.

RULES:
1. Analyse the actual code provided. Do not generate generic tests.
2. Assign category from this exact list: auth, api, ui_form, ui_navigation, 
   ui_component, crud, integration, edge_case, performance, accessibility
3. For every test, set page_path to the actual route (e.g. /dashboard/users)
   or component_name to the actual component (e.g. UserEditModal)
4. For API tests, set endpoint to the method + path (e.g. POST /api/orders)
5. severity: critical = auth/payment flows, high = core CRUD, medium = UI flows, low = edge cases
6. playwright_code must be valid, runnable Playwright TypeScript code
7. Return ONLY valid JSON. No markdown. No explanation.
"""

FULL_SCAN_PROMPT = """
Analyse this codebase and generate comprehensive Playwright test cases.

CODEBASE:
{code_chunks}

Generate between 30-60 test cases covering all significant functionality.
Ensure good distribution across categories based on what the code actually does.

Return JSON with this exact structure:
{{
  "tests": [
    {{
      "name": "string",
      "description": "string", 
      "category": "one of the enum values",
      "page_path": "string or null",
      "component_name": "string or null",
      "endpoint": "string or null",
      "severity": "critical|high|medium|low",
      "source_file": "relative file path this test is based on",
      "steps": [
        {{"action": "navigate|click|fill|expect|wait", "target": "string", "value": "string or null", "assertion": "string or null"}}
      ],
      "playwright_code": "full playwright test code as string"
    }}
  ]
}}
"""

INCREMENTAL_PROMPT = """
Analyse ONLY the changed files below and generate new Playwright test cases.

CHANGED FILES:
{changed_code}

EXISTING TESTS ALREADY IN DATABASE (do NOT duplicate these):
{existing_tests_summary}

TASK:
- Generate test cases ONLY for the new/changed logic in the files above
- Do NOT regenerate anything already covered by the existing tests list
- If a change is minor (typo fix, style change), return empty tests array
- Focus on: new functions, new routes, new components, changed business logic

Return same JSON structure as a full scan. Return {{"tests": []}} if nothing genuinely new.
"""

async def generate_full_scan_tests(code_chunks: List[str]) -> List[dict]:
    combined = "\n\n---FILE BOUNDARY---\n\n".join(code_chunks)
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user", 
            "content": FULL_SCAN_PROMPT.format(code_chunks=combined)
        }]
    )
    
    raw = response.content[0].text
    parsed = json.loads(raw)
    return parsed.get("tests", [])

async def generate_incremental_tests(
    changed_code: str,
    existing_tests: List[PlaywrightTest]
) -> List[dict]:
    # Summarise existing tests to save tokens
    # Send name + category + page_path only, not full playwright code
    summary = [
        {
            "name": t.name, 
            "category": t.category, 
            "page_path": t.page_path,
            "endpoint": t.endpoint
        } 
        for t in existing_tests
    ]
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": INCREMENTAL_PROMPT.format(
                changed_code=changed_code,
                existing_tests_summary=json.dumps(summary, indent=2)
            )
        }]
    )
    
    raw = response.content[0].text
    parsed = json.loads(raw)
    return parsed.get("tests", [])
```

---

## 6. AI Prompt Strategy

### Key principles that prevent bad output:

**1. No generic tests** — We pass actual file content, not just filenames. AI reads real code.

**2. Token budget management:**
- Full scan: send files in priority order (routes first), cap at 80K tokens
- Incremental: send only changed files + test name summaries (not full test code)

**3. Structured output with validation:**
```python
# After AI returns, validate every test
def validate_ai_test(raw: dict) -> Optional[PlaywrightTest]:
    try:
        # Must have name
        if not raw.get("name"):
            return None
        # Category must be valid enum value
        if raw.get("category") not in [c.value for c in TestCategory]:
            raw["category"] = "ui_component"  # safe fallback, not crash
        # Must have at least 1 step
        if not raw.get("steps"):
            return None
        return PlaywrightTest(**raw)
    except Exception:
        return None  # skip malformed, don't crash the whole run
```

**4. Retry on parse failure:**
```python
for attempt in range(3):
    try:
        result = json.loads(response_text)
        break
    except json.JSONDecodeError:
        if attempt == 2:
            raise
        # Ask AI to fix its own output
        response_text = fix_json_response(response_text)
```

---

## 7. Frontend Architecture

### 7.1 Pages

```
/                           — Landing, submit repo URL form
/repo/[repo_id]             — Main dashboard for a repo
/repo/[repo_id]/session/[session_id]  — Specific scan session results
```

### 7.2 Main Dashboard Component Tree

```
RepoPage
  ├── RepoHeader (url, last scan time, total test count)
  ├── SessionSelector (dropdown: "Run #4 — 3 new tests" etc)
  │
  ├── [if viewing a non-first session]
  │   └── NewTestsBanner ("✦ 6 new tests added in this run")
  │       └── NewTestsList (highlighted cards with NEW badge)
  │
  ├── TestCategoryTabs (auto-generated from what categories exist)
  │   ├── Tab: "Auth (8)"
  │   ├── Tab: "API (12)"
  │   ├── Tab: "UI Form (6)"
  │   └── Tab: "CRUD (9)"  ...etc
  │
  └── TestGrid
      ├── GroupHeader (page_path or component_name)
      │   └── TestCard (expandable)
      │       ├── Badge: category
      │       ├── Badge: severity  
      │       ├── Badge: NEW (if added_in_session == current session)
      │       ├── Description
      │       ├── Steps list
      │       └── [Expand] Playwright code viewer
```

### 7.3 TestCard Component

```tsx
// components/TestCard.tsx
interface TestCardProps {
  test: PlaywrightTest
  isNew: boolean  // true if added in the currently viewed session
}

export function TestCard({ test, isNew }: TestCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      isNew 
        ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm shadow-emerald-200" 
        : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          {isNew && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full 
                           bg-emerald-500 text-white tracking-wide">
              NEW
            </span>
          )}
          <CategoryBadge category={test.category} />
          <SeverityBadge severity={test.severity} />
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>
      </div>
      
      <h3 className="font-medium mt-3 text-sm">{test.name}</h3>
      <p className="text-xs text-muted-foreground mt-1">{test.description}</p>
      
      {(test.page_path || test.endpoint) && (
        <code className="text-xs bg-muted px-2 py-0.5 rounded mt-2 inline-block">
          {test.page_path || test.endpoint}
        </code>
      )}
      
      {expanded && (
        <div className="mt-4 space-y-3">
          <StepsList steps={test.steps} />
          <PlaywrightCodeViewer code={test.playwright_code} />
        </div>
      )}
    </div>
  )
}
```

### 7.4 New Tests Banner

```tsx
// components/NewTestsBanner.tsx
// Shown at top of page when viewing a session that added tests

export function NewTestsBanner({ session, newTests }: Props) {
  if (!session || session.tests_added === 0) return null
  
  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 
                    dark:bg-emerald-950/30 p-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center 
                        justify-center text-white text-sm font-bold">
          +{session.tests_added}
        </div>
        <div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            {session.tests_added} new test{session.tests_added !== 1 ? 's' : ''} added
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            {session.scan_type === 'full' ? 'Full scan' : `Changes in ${session.changed_files.length} file(s)`}
            {' '}· {formatRelativeTime(session.triggered_at)}
          </p>
        </div>
      </div>
      
      {/* Quick breakdown by category */}
      <div className="flex flex-wrap gap-2 mt-3">
        {getCategoryBreakdown(newTests).map(({ category, count }) => (
          <span key={category} className="text-xs px-2 py-1 rounded-full 
                                          bg-emerald-100 text-emerald-800">
            {category}: +{count}
          </span>
        ))}
      </div>
    </div>
  )
}
```

---

## 8. Step-by-Step Implementation

### Step 1 — Project Scaffolding (Day 1)

```bash
# Backend
mkdir testgen-api && cd testgen-api
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn motor anthropic gitpython pydantic python-dotenv celery redis

# Frontend  
npx create-next-app@latest testgen-ui --typescript --tailwind --app
cd testgen-ui
npx shadcn-ui@latest init
npm install zustand @radix-ui/react-tabs react-syntax-highlighter lucide-react

# MongoDB
# Use Atlas free tier or: docker run -d -p 27017:27017 mongo:7
```

### Step 2 — Data Layer (Day 1–2)

- Write `models/repo.py` (from Section 3 above — copy exactly)
- Write `db/mongo.py` — connection + CRUD helpers
- Write `db/migrations.py` — create indexes on startup
- Test: insert a dummy RepoBaseline, query it back

```python
# db/mongo.py
from motor.motor_asyncio import AsyncIOMotorClient
from models.repo import RepoBaseline
import os

client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
db = client.testgen

async def get_repo(repo_id: str) -> RepoBaseline | None:
    doc = await db.repo_baselines.find_one({"repo_id": repo_id})
    return RepoBaseline(**doc) if doc else None

async def upsert_repo(baseline: RepoBaseline):
    await db.repo_baselines.update_one(
        {"repo_id": baseline.repo_id},
        {"$set": baseline.model_dump()},
        upsert=True
    )

async def append_tests_and_session(repo_id: str, new_tests: list, session: dict):
    await db.repo_baselines.update_one(
        {"repo_id": repo_id},
        {
            "$push": {
                "tests": {"$each": [t.model_dump() for t in new_tests]},
                "sessions": session
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
```

### Step 3 — Repo Fetcher (Day 2)

- Clone repo to `/tmp/repos/{repo_id}/`
- Read all source files matching `SUPPORTED_EXTENSIONS`
- Skip `SKIP_DIRS`
- Cap individual files at 50KB
- Return `RepoSnapshot`
- Store latest commit SHA

### Step 4 — AI Service (Day 3)

- Implement `generate_full_scan_tests()` from Section 5.4
- Implement `generate_incremental_tests()` from Section 5.4
- Implement `validate_ai_test()` — never let bad AI output crash the run
- Write a local test: pass a 3-file sample, assert you get back valid JSON

### Step 5 — Diff Detection (Day 3–4)

- Implement `get_changed_files()` using `git diff`
- Fallback: if no git history, hash each file content and compare with stored hashes
- Implement `deduplicate_tests()` — the final safety net
- Write unit tests: same test submitted twice should return 0 new tests

### Step 6 — API Routes (Day 4)

```python
# routes/repos.py
from fastapi import APIRouter, BackgroundTasks, HTTPException
router = APIRouter(prefix="/api/repos")

@router.post("/scan")
async def scan_repo(payload: ScanRequest, bg: BackgroundTasks):
    """
    Single endpoint handles both first scan and re-scans.
    Backend detects which it is automatically.
    """
    repo_id = get_repo_id(payload.github_url)
    existing = await get_repo(repo_id)
    
    session = ScanSession(
        github_url=payload.github_url,
        scan_type="full" if not existing else "incremental"
    )
    
    # Async: return session_id immediately, process in background
    bg.add_task(run_scan, repo_id, payload.github_url, session, existing)
    
    return {"session_id": session.session_id, "repo_id": repo_id, "status": "queued"}

@router.get("/status/{session_id}")
async def get_session_status(session_id: str):
    """Frontend polls this every 3s until status == done"""
    ...

@router.get("/{repo_id}")
async def get_repo_tests(repo_id: str, session_id: str = None):
    """
    Returns all tests + session list.
    If session_id given, also returns which tests are new for that session.
    """
    ...
```

### Step 7 — Frontend: Repo Submission Page (Day 5)

- Text input for GitHub URL
- Submit → POST `/api/repos/scan` → get `session_id`
- Poll `/api/repos/status/{session_id}` every 3s
- Show progress: "Cloning... Analysing... Generating tests... Done"
- On done → redirect to `/repo/{repo_id}?session={session_id}`

### Step 8 — Frontend: Tests Dashboard (Day 5–6)

- Fetch all tests for repo
- Auto-generate tabs from unique categories in the data (not hardcoded)
- Group within each tab by `page_path` or `component_name`
- Mark tests where `added_in_session === session_id` as NEW
- Render `NewTestsBanner` if session has new tests
- Implement `TestCard` with collapsible Playwright code

### Step 9 — Polish & Edge Cases (Day 7)

- Loading skeletons during scan
- Error states (private repo, invalid URL, AI timeout)
- Session history sidebar ("Run #1 · 45 tests · 3 days ago")
- Copy test code button
- Filter by severity
- Search across test names

---

## 9. API Contract

### POST /api/repos/scan

**Request:**
```json
{
  "github_url": "https://github.com/user/repo",
  "github_token": "optional, for private repos"
}
```

**Response (immediate):**
```json
{
  "session_id": "a3f9c2d1",
  "repo_id": "7b4e9a12",
  "scan_type": "full",
  "status": "queued"
}
```

### GET /api/repos/status/{session_id}

**Response:**
```json
{
  "session_id": "a3f9c2d1",
  "status": "running",
  "progress": "Generating test cases... (42/~60)",
  "tests_added": 0
}
```

**When done:**
```json
{
  "status": "done",
  "tests_added": 47,
  "tests_total": 47,
  "scan_type": "full",
  "repo_id": "7b4e9a12"
}
```

### GET /api/repos/{repo_id}?session_id={session_id}

**Response:**
```json
{
  "repo_id": "7b4e9a12",
  "github_url": "https://github.com/user/repo",
  "total_tests": 53,
  "sessions": [
    {
      "session_id": "a3f9c2d1",
      "scan_type": "full",
      "tests_added": 47,
      "triggered_at": "2026-04-23T10:00:00Z"
    },
    {
      "session_id": "b9e4f100",
      "scan_type": "incremental",
      "tests_added": 6,
      "changed_files": ["src/components/CheckoutForm.tsx"],
      "triggered_at": "2026-04-23T14:30:00Z"
    }
  ],
  "tests": [
    {
      "test_id": "TC-A3F2B1",
      "name": "User can complete checkout with valid card",
      "category": "integration",
      "page_path": "/checkout",
      "severity": "critical",
      "added_in_session": "b9e4f100",
      "is_active": true,
      "steps": [...],
      "playwright_code": "..."
    }
  ],
  "new_test_ids": ["TC-A3F2B1", "TC-9B2C4D"]
}
```

---

## 10. Folder Structure

```
testgen-api/
  ├── main.py
  ├── .env
  ├── models/
  │   └── repo.py
  ├── db/
  │   ├── mongo.py
  │   └── migrations.py
  ├── services/
  │   ├── repo_service.py
  │   ├── ai_service.py
  │   ├── diff_service.py
  │   ├── test_store.py
  │   └── session_service.py
  ├── routes/
  │   └── repos.py
  └── workers/
      └── scan_worker.py     (Celery task for async scan)

testgen-ui/
  ├── app/
  │   ├── page.tsx            (landing / submit form)
  │   └── repo/
  │       └── [repo_id]/
  │           ├── page.tsx    (dashboard)
  │           └── session/
  │               └── [session_id]/page.tsx
  ├── components/
  │   ├── TestCard.tsx
  │   ├── TestCategoryTabs.tsx
  │   ├── NewTestsBanner.tsx
  │   ├── ScanProgress.tsx
  │   ├── SessionHistory.tsx
  │   └── PlaywrightCodeViewer.tsx
  ├── lib/
  │   ├── api.ts
  │   └── store.ts            (Zustand)
  └── types/
      └── repo.ts
```

---

## 11. Edge Cases & Production Guards

| Scenario | Handling |
|---|---|
| Same repo submitted twice within 30 seconds | Debounce: return existing session, don't create duplicate |
| Repo has 1000+ files | Priority queue: routes > components > utils. Hard cap at 200 files. |
| AI returns malformed JSON | Retry 3x with "please return only valid JSON" correction prompt |
| AI hallucinated test names identical to existing | `deduplicate_tests()` catches this as final pass |
| Private repo, no token | Return 422 with clear message: "Provide github_token for private repos" |
| AI times out (>30s) | Partial save: save whatever tests completed before timeout, mark session as partial |
| Commit SHA unchanged on re-submit | Short-circuit: return `{tests_added: 0, message: "No changes since last scan"}` |
| Very large files (>50KB) | Truncate to first 50KB with a note in the prompt: "file truncated" |
| Test deduplication false positive | Keep similarity threshold at 0.85. Lower = too aggressive. Higher = misses real dupes. |

---

## 12. What "No Blockers" Means Here

Every piece of this plan uses available, stable technology:

- **Claude claude-sonnet-4** via official Anthropic Python SDK — available now
- **MongoDB Atlas free tier** — no credit card for first 512MB
- **GitPython** — no GitHub token needed for public repos
- **FastAPI + motor** — pure async, no thread issues
- **Next.js 14** — stable, no experimental features needed
- **All AI prompts return structured JSON** — validated before storage, never crashes on bad output

The only optional dependency is Redis/Celery for the background worker. For an MVP, you can run the scan synchronously with a longer HTTP timeout (120s). Swap to async queue when needed without changing any other code.

---

*Last updated: April 2026*
*Plan version: 1.0 — Production ready, no known blockers*