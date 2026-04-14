# AI-Powered Developer Workspace — Production-Grade Implementation Plan

> **Scope:** Full-stack plan covering Frontend (React + Vite + TypeScript), Backend (FastAPI + MongoDB), AI integration (Anthropic / GitHub Copilot), Git workflow, test generation, and deployment.

---

## Table of Contents

1. [Product Vision & Feature Set](#1-product-vision--feature-set)
2. [High-Level Architecture](#2-high-level-architecture)
3. [End-to-End User Flow](#3-end-to-end-user-flow)
4. [Module Breakdown](#4-module-breakdown)
   - 4.1 File Explorer & Repo Context
   - 4.2 Code Editor (Monaco)
   - 4.3 AI Copilot Chat Panel
   - 4.4 Diff Viewer & Change Review
   - 4.5 Commit & Push to GitHub
   - 4.6 Code Comment Generator
   - 4.7 Reusable Snippet Library
   - 4.8 Test Case Generator (Coverage-Aware)
   - 4.9 Coverage Gap Analyzer
5. [Frontend — Detailed Design](#5-frontend--detailed-design)
6. [Backend — Detailed Design](#6-backend--detailed-design)
7. [AI & Copilot Integration Strategy](#7-ai--copilot-integration-strategy)
8. [Database Schema (MongoDB)](#8-database-schema-mongodb)
9. [API Contract (All Endpoints)](#9-api-contract-all-endpoints)
10. [All Packages & Tools](#10-all-packages--tools)
11. [Environment Variables & Config](#11-environment-variables--config)
12. [Security Considerations](#12-security-considerations)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Development Sequence & Milestones](#14-development-sequence--milestones)

---

## 1. Product Vision & Feature Set

### What it is
A single-tab AI-powered developer workspace that combines a full code editor, an AI pair programmer, an automated test generator, and a Git commit/push pipeline — all within the existing TestGen AI suite.

### Core Features (in user-facing priority order)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Code Editor** | Monaco-based editor with syntax highlighting, multi-tab, file tree |
| 2 | **AI Code Generation** | Natural language → code diff via Anthropic Claude API |
| 3 | **Diff Viewer** | Side-by-side or inline diff before accepting changes |
| 4 | **Accept & Commit** | One-click commit with message auto-generation + push to GitHub |
| 5 | **Code Comments** | Auto-generate inline comments for selected functions/files |
| 6 | **Snippet Library** | AI-detected reusable patterns saved as insertable snippets |
| 7 | **Test Case Generation** | Coverage-aware test generation for uncovered code paths |
| 8 | **Coverage Gap Analysis** | Visual overlay of coverage % per file/function |
| 9 | **Copilot Integration** | GitHub Copilot suggestions piped into the same editor experience |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React + Vite)                    │
│                                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  File    │  │  Monaco      │  │  AI Copilot Chat Panel    │   │
│  │  Explorer│  │  Editor      │  │  (Anthropic Claude API)   │   │
│  │  (Tree)  │  │  + Diff View │  │                           │   │
│  └──────────┘  └──────────────┘  └──────────────────────────┘   │
│        │              │                       │                   │
│        └──────────────┴───────────────────────┘                  │
│                       Axios /api/*                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend (port 8000)                    │
│                                                                   │
│  /api/copilot/*    /api/git/*    /api/coverage/*    /api/tests/* │
│                                                                   │
│  ┌──────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │
│  │ AI Service   │  │  GitHub  │  │  Coverage  │  │  Test    │  │
│  │ (Anthropic)  │  │  Service │  │  Service   │  │  Gen Svc │  │
│  └──────────────┘  └──────────┘  └────────────┘  └──────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                      MongoDB (Motor)                      │    │
│  │  workspaces · files · snippets · commits · test_suites   │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
      GitHub API      Anthropic API    Coverage.py /
      (REST v3)       (Claude claude-sonnet-4-20250514)   pytest-cov
```

---

## 3. End-to-End User Flow

```
User opens /workspace
        │
        ▼
[1] Connect Repository
    ├── Enter GitHub owner/repo + PAT
    ├── Backend clones repo (shallow) → extracts file tree
    └── File tree rendered in sidebar

        │
        ▼
[2] Open a File
    ├── Click file in tree → GET /api/copilot/file-content
    ├── Monaco editor loads file with syntax highlighting
    └── Coverage overlay loaded (if coverage data exists)

        │
        ▼
[3] Chat with AI Copilot
    ├── User types: "Add pagination to get_prioritized_tests"
    ├── POST /api/copilot/suggest  {file_path, content, instruction}
    ├── Claude returns structured diff + explanation
    └── Diff rendered in Monaco (original ↔ modified)

        │
        ▼
[4] Review Diff
    ├── Side-by-side diff view in Monaco DiffEditor
    ├── User can manually edit the suggested code
    ├── "Reject" → revert to original
    └── "Accept" → file updated in editor state

        │
        ▼
[5] Add Comments (optional)
    ├── Click "Add Comments" button
    ├── POST /api/copilot/add-comments  {file_path, content}
    ├── Returns annotated version
    └── Shown as a new diff for review

        │
        ▼
[6] Save Snippet (optional)
    ├── AI detects reusable pattern in suggestion
    ├── POST /api/copilot/snippets  {name, code, language, tags}
    └── Saved to snippet library (MongoDB)

        │
        ▼
[7] Generate Tests
    ├── Click "Generate Tests" (or triggered after accept)
    ├── POST /api/coverage/analyze  {file_path, content}
    │   └── Returns coverage gaps (uncovered functions/branches)
    ├── POST /api/tests/generate  {file_path, content, gaps}
    ├── Claude generates pytest / jest test cases for each gap
    └── Tests shown in new editor tab (e.g., test_prioritization_service.py)

        │
        ▼
[8] Review & Edit Tests
    ├── Tests open in Monaco editor tab
    ├── User edits if needed
    └── "Run Tests" → POST /api/tests/run (subprocess pytest)

        │
        ▼
[9] Commit & Push
    ├── Click "Commit & Push"
    ├── POST /api/git/commit  {repo, branch, files[], message}
    │   ├── AI auto-generates commit message from diff summary
    │   ├── Backend: git add → git commit → git push via GitPython
    │   └── Returns commit SHA + GitHub URL
    └── Toast notification with link to GitHub commit
```

---

## 4. Module Breakdown

### 4.1 File Explorer & Repo Context

**Purpose:** Show the cloned repo's file tree and allow file navigation.

**Frontend**
- Component: `src/components/workspace/FileExplorer.tsx`
- State: TanStack Query — `useFileTree(repoId)`
- Renders: Collapsible tree with file-type icons and coverage % badges
- Events: `onFileSelect(path)` → loads file into editor tab

**Backend**
- Endpoint: `POST /api/workspace/connect` → clones repo, returns tree
- Endpoint: `GET /api/workspace/{workspace_id}/tree` → file tree JSON
- Service: `backend/app/services/workspace_service.py`
  - Uses `GitPython` to shallow-clone (`--depth 1`) into `/tmp/workspaces/{id}/`
  - Walks directory, filters by extension (`.py`, `.ts`, `.tsx`, `.js`)
  - Returns nested JSON tree

**Packages**
- Backend: `gitpython`, `pathlib` (stdlib)
- Frontend: `lucide-react` (file icons)

---

### 4.2 Code Editor (Monaco)

**Purpose:** Full-featured code editor embedded in the browser.

**Frontend**
- Component: `src/components/workspace/CodeEditor.tsx`
- Library: `@monaco-editor/react` (wraps Monaco Editor)
- Features:
  - Syntax highlighting (Python, TypeScript, JS auto-detected)
  - Multi-tab support — `EditorTabBar.tsx`
  - Read-only diff mode via `MonacoDiffEditor`
  - Coverage gutter decorations (red/green line highlights)
  - Minimap, IntelliSense (language workers)
- State: Local React state for open tabs + dirty flag

**Key implementation detail**
Monaco runs in a Web Worker. Import it via dynamic import to avoid SSR issues:
```typescript
import Editor from '@monaco-editor/react';
// DiffEditor for showing changes:
import { DiffEditor } from '@monaco-editor/react';
```

**Packages**
- `@monaco-editor/react` ^4.6.0
- `monaco-editor` ^0.45.0 (peer dep)

---

### 4.3 AI Copilot Chat Panel

**Purpose:** Natural language interface to request code changes, explanations, and generation.

**Frontend**
- Component: `src/components/workspace/CopilotChat.tsx`
- Hook: `src/hooks/use-copilot.ts`
  - `useSuggestCode(mutation)` → POST /api/copilot/suggest
  - `useAddComments(mutation)` → POST /api/copilot/add-comments
  - `useExplainCode(mutation)` → POST /api/copilot/explain
- UI: Chat thread with user/AI bubbles, typing indicator, action buttons
- Context sent with every request:
  - Current file path
  - Full file content (or selection if >500 lines)
  - Repo name + language
  - Last 5 chat messages (conversation memory)

**Backend**
- Endpoint: `POST /api/copilot/suggest`
- Service: `backend/app/services/copilot_service.py`
- Calls `ai_service.generate_code_suggestion(context)` which uses Claude claude-sonnet-4-20250514
- Returns structured response:
```json
{
  "original": "...original file content...",
  "modified": "...modified file content...",
  "diff_summary": "Added retry logic, pagination param",
  "explanation": "...",
  "commit_message": "feat: add pagination and retry to get_prioritized_tests",
  "snippets": [...],
  "confidence": 0.92
}
```

**Copilot Integration (GitHub Copilot)**
- GitHub Copilot exposes an API via the Copilot API (Business/Enterprise tier)
- Integration approach:
  - Register an OAuth App on GitHub with `copilot` scope
  - Use `POST https://api.githubcopilot.com/chat/completions` (OpenAI-compatible)
  - Backend proxies requests: `POST /api/copilot/gh-suggest` → GitHub Copilot API
  - Falls back to Anthropic if Copilot unavailable
- Config toggle: `COPILOT_PROVIDER=anthropic|github` in `.env`

---

### 4.4 Diff Viewer & Change Review

**Purpose:** Show exactly what the AI changed before the user accepts it.

**Frontend**
- Component: `src/components/workspace/DiffViewer.tsx`
- Uses `MonacoDiffEditor` with `original` and `modified` props
- Toolbar: Accept ✓ | Reject ✗ | Edit manually
- State machine: `idle` → `reviewing_diff` → `accepted` | `rejected`
- On Accept: replaces editor content, marks tab as dirty (unsaved)
- On Reject: restores original content

**Change tracking**
- Each suggestion stored in component state with timestamp
- `diffHistory[]` array allows undo/redo of AI suggestions

---

### 4.5 Commit & Push to GitHub

**Purpose:** Stage, commit, and push accepted changes directly from the workspace.

**Frontend**
- Component: `src/components/workspace/CommitPanel.tsx`
- Hook: `useGitCommit(mutation)` → POST /api/git/commit
- UI:
  - Auto-populated commit message (from AI)
  - Editable before commit
  - Branch selector (current or new branch)
  - File checklist (which files to stage)
  - Status: staging → committing → pushing → done ✓
  - On success: link to GitHub commit URL

**Backend**
- Endpoint: `POST /api/git/commit`
- Service: `backend/app/services/git_service.py`
- Flow:
  1. Write modified file content to `/tmp/workspaces/{id}/{file_path}`
  2. `repo.index.add([file_path])` via GitPython
  3. `repo.index.commit(message, author=Actor(name, email))`
  4. `origin.push(refspec=branch)` using PAT in remote URL
  5. Return `{ sha, url, branch, timestamp }`
- Endpoint: `POST /api/git/branch` — create new branch before commit
- Endpoint: `GET /api/git/status` — unstaged/staged/committed files
- Endpoint: `GET /api/git/log` — recent commits for the repo

**Packages**
- Backend: `gitpython` ^3.1.40

---

### 4.6 Code Comment Generator

**Purpose:** Automatically add docstrings and inline comments to functions.

**Frontend**
- Button in chat quick-actions: "Add Comments"
- Opens diff view showing original vs commented version
- User reviews and accepts like any other AI suggestion

**Backend**
- Endpoint: `POST /api/copilot/add-comments`
- Request: `{ file_path, content, language, style: "google" | "numpy" | "jsdoc" }`
- Prompt strategy:
  - For Python: generates Google-style docstrings + inline comments
  - For TypeScript/JS: generates JSDoc blocks
  - Preserves existing comments, only adds where missing
- Returns same `{ original, modified, diff_summary }` shape as `/suggest`

---

### 4.7 Reusable Snippet Library

**Purpose:** Save AI-generated patterns as reusable snippets insertable anywhere.

**Frontend**
- Component: `src/components/workspace/SnippetLibrary.tsx`
- Shown as a panel tab alongside the chat
- Features: search by name/tag, filter by language, insert into current cursor position
- Hook: `useSnippets()` → GET /api/copilot/snippets

**Backend**
- Endpoint: `POST /api/copilot/snippets` — save snippet
- Endpoint: `GET /api/copilot/snippets?lang=python&tag=retry` — list/filter
- Endpoint: `DELETE /api/copilot/snippets/{id}` — remove
- MongoDB collection: `snippets`
- Auto-detection: when AI suggestion contains a clearly reusable pattern (decorator, utility function), it proactively suggests saving as snippet

---

### 4.8 Test Case Generator (Coverage-Aware)

**Purpose:** Generate pytest / jest test cases targeting uncovered code paths.

**Frontend**
- Component: `src/components/workspace/TestGenerator.tsx`
- Triggered by: "Generate Tests" button or automatically post-accept
- Shows: coverage gap list with checkboxes → user selects which gaps to test
- Generated tests open in new editor tab (e.g., `test_prioritization_service.py`)
- "Run Tests" button sends test file to backend for execution

**Backend**
- Endpoint: `POST /api/tests/generate`
- Request:
```json
{
  "file_path": "backend/app/services/prioritization_service.py",
  "content": "...full file content...",
  "gaps": ["cache_hit_path", "quota_retry", "limit_zero_edge"],
  "framework": "pytest",
  "existing_tests": "...content of test_prioritization_service.py if exists..."
}
```
- Service: `backend/app/services/test_gen_service.py`
  - Constructs a prompt with function signatures, docstrings, and gap descriptions
  - Claude generates `@pytest.mark` decorated test functions
  - Returns complete test file content
- Endpoint: `POST /api/tests/run`
  - Writes test file to temp location
  - Runs `pytest --tb=short --json-report` via subprocess
  - Returns pass/fail/error per test

**Packages**
- Backend: `pytest`, `pytest-asyncio`, `pytest-json-report`, `coverage`, `pytest-cov`

---

### 4.9 Coverage Gap Analyzer

**Purpose:** Identify which functions/branches have no test coverage.

**Frontend**
- Coverage overlaid as gutter decorations in Monaco:
  - Green line = covered
  - Red line = not covered
  - Yellow line = partially covered (branch not fully tested)
- Coverage summary badge per file in the file tree
- `useCoverageAnalysis(filePath)` hook

**Backend**
- Endpoint: `POST /api/coverage/analyze`
- Approach (static, no execution needed):
  - Parse file with Python's `ast` module
  - Extract all function/class/branch nodes
  - Cross-reference with existing test files in repo (`test_*.py`)
  - Check which functions are imported/called in test files
  - Return coverage map: `{ function_name, line_start, line_end, covered: bool }`
- For runtime coverage (optional, more accurate):
  - Run `pytest --cov=. --cov-report=json` on the repo
  - Parse `coverage.json` output
- Endpoint: `GET /api/coverage/{workspace_id}/summary` — per-file coverage %

**Packages**
- Backend: `ast` (stdlib), `coverage` ^7.4, `pytest-cov` ^4.1

---

## 5. Frontend — Detailed Design

### New Route
```
/workspace  →  src/pages/Workspace.tsx
```

### Page Layout (CSS Grid)
```
┌──────────────────────────────────────────────────────────┐
│  AppSidebar (existing)                                    │
├────────────┬─────────────────────────┬───────────────────┤
│            │   EditorTabBar           │                   │
│  File      ├─────────────────────────┤  Copilot Chat     │
│  Explorer  │                         │  Panel            │
│  220px     │   Monaco Editor         │  360px            │
│            │   (or DiffEditor)       │                   │
│            │                         │                   │
│            ├─────────────────────────┤                   │
│            │   DiffToolbar           │                   │
├────────────┴─────────────────────────┴───────────────────┤
│  StatusBar: branch · coverage · AI status · commit state  │
└──────────────────────────────────────────────────────────┘
```

### Component Tree
```
src/pages/Workspace.tsx
├── WorkspaceProvider (React Context — workspace state)
│
├── src/components/workspace/FileExplorer.tsx
│   └── FileTreeNode.tsx (recursive)
│
├── src/components/workspace/EditorArea.tsx
│   ├── EditorTabBar.tsx
│   ├── CodeEditor.tsx          (@monaco-editor/react)
│   ├── DiffViewer.tsx          (MonacoDiffEditor)
│   └── CoverageGutter.tsx      (Monaco decorations)
│
├── src/components/workspace/CopilotPanel.tsx
│   ├── CopilotChat.tsx
│   ├── SnippetLibrary.tsx
│   └── TestGenerator.tsx
│
├── src/components/workspace/CommitPanel.tsx
│   └── BranchSelector.tsx
│
└── src/components/workspace/StatusBar.tsx
```

### New Hooks (`src/hooks/`)
```
use-workspace.ts          — connect repo, file tree, workspace state
use-copilot.ts            — suggest, add-comments, explain mutations
use-git.ts                — commit, push, status, log, branch
use-coverage.ts           — analyze, summary, gap list
use-test-gen.ts           — generate tests, run tests
use-snippets.ts           — CRUD for snippet library
```

### State Management
- `WorkspaceContext` holds: `{ repoId, openTabs[], activeTab, dirtyFiles{}, diffState{} }`
- TanStack Query for all server state (file content, coverage, git log)
- Local state (useState) for editor content and diff review

---

## 6. Backend — Detailed Design

### New Router Files
```
backend/app/routes/
├── workspace.py      — repo connect, file tree, file content
├── copilot.py        — suggest, comments, explain, snippets
├── git_ops.py        — commit, push, branch, status, log
├── coverage.py       — analyze, summary
└── test_gen.py       — generate tests, run tests
```

### New Service Files
```
backend/app/services/
├── workspace_service.py    — git clone, file tree walking
├── copilot_service.py      — orchestrates AI + diff generation
├── git_service.py          — GitPython operations
├── coverage_service.py     — AST parsing + coverage.py integration
└── test_gen_service.py     — test case generation + pytest runner
```

### Prompt Engineering (copilot_service.py)

**System prompt for code generation:**
```
You are an expert software engineer working on the TestGen AI codebase.
You are given a file and an instruction. You MUST return a JSON object with:
- "modified": the complete modified file content (never partial)
- "diff_summary": 1-2 sentence plain English summary of changes
- "commit_message": conventional commit format message
- "snippets": array of { name, code, language, tags } for any reusable patterns detected
- "confidence": float 0-1

Rules:
- Preserve all imports and existing logic unless explicitly told to change them
- Never remove comments unless replacing them with better ones
- Match the existing code style exactly
- Return ONLY valid JSON, no markdown fences
```

**System prompt for test generation:**
```
You are a senior QA engineer. Generate pytest test cases for the following gaps.
For each gap return a complete, runnable test function.
Use pytest fixtures, mock where needed (unittest.mock).
Return a JSON array of { function_name, code, description, gap_covered }.
```

### Diff Generation (server-side)
```python
import difflib

def generate_diff(original: str, modified: str) -> dict:
    diff = list(difflib.unified_diff(
        original.splitlines(keepends=True),
        modified.splitlines(keepends=True),
        lineterm=""
    ))
    return {
        "unified_diff": "".join(diff),
        "added_lines": sum(1 for l in diff if l.startswith("+")),
        "removed_lines": sum(1 for l in diff if l.startswith("-"))
    }
```

---

## 7. AI & Copilot Integration Strategy

### Option A — Anthropic Claude (Primary, already integrated)
- Model: `claude-sonnet-4-20250514`
- Used for: code generation, comments, test gen, explanations
- Already wired through `ai_service.py` — extend with new functions
- Cost: ~$3/M input tokens, $15/M output tokens

### Option B — GitHub Copilot API (Optional, Enterprise)
- Endpoint: `https://api.githubcopilot.com/chat/completions`
- Auth: Bearer token from GitHub OAuth (`copilot` scope)
- Payload: OpenAI-compatible (`model: "gpt-4o"`, `messages: [...]`)
- Use case: inline completions while typing (feels more native)

### Hybrid Strategy (Recommended for Production)
```
Inline completions (as-you-type)   →  GitHub Copilot API
Chat / bulk generation             →  Anthropic Claude
Test generation                    →  Anthropic Claude (better reasoning)
Commit message generation          →  Anthropic Claude
Code explanation                   →  Anthropic Claude
```

### Copilot Toggle in Frontend
```typescript
// src/lib/api.ts
const COPILOT_PROVIDER = import.meta.env.VITE_COPILOT_PROVIDER || "anthropic";

export const suggestCode = (payload) =>
  COPILOT_PROVIDER === "github"
    ? api.post("/copilot/gh-suggest", payload)
    : api.post("/copilot/suggest", payload);
```

---

## 8. Database Schema (MongoDB)

### Collection: `workspaces`
```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "repo_url": "github.com/owner/repo",
  "clone_path": "/tmp/workspaces/abc123",
  "branch": "main",
  "last_synced": "ISODate",
  "file_tree": [...],
  "created_at": "ISODate"
}
```

### Collection: `copilot_sessions`
```json
{
  "_id": "ObjectId",
  "workspace_id": "string",
  "file_path": "backend/app/services/prioritization_service.py",
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "diff": {...}, "timestamp": "..." }
  ],
  "created_at": "ISODate"
}
```

### Collection: `snippets`
```json
{
  "_id": "ObjectId",
  "workspace_id": "string",
  "name": "retry_on_quota",
  "language": "python",
  "code": "...",
  "tags": ["retry", "ai", "async"],
  "usage_count": 3,
  "created_at": "ISODate"
}
```

### Collection: `commits`
```json
{
  "_id": "ObjectId",
  "workspace_id": "string",
  "sha": "abc123def456",
  "message": "feat: add pagination to get_prioritized_tests",
  "files_changed": ["backend/app/services/prioritization_service.py"],
  "branch": "feat/pagination",
  "github_url": "https://github.com/...",
  "ai_generated": true,
  "timestamp": "ISODate"
}
```

### Collection: `test_suites`
```json
{
  "_id": "ObjectId",
  "workspace_id": "string",
  "source_file": "backend/app/services/prioritization_service.py",
  "test_file": "tests/test_prioritization_service.py",
  "gaps_covered": ["cache_hit_path", "quota_retry"],
  "run_results": {
    "passed": 4, "failed": 1, "errors": 0,
    "tests": [{ "name": "test_cache_hit", "status": "passed", "duration_ms": 12 }]
  },
  "generated_at": "ISODate"
}
```

---

## 9. API Contract (All Endpoints)

### Workspace
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspace/connect` | Clone repo, return workspace_id + file tree |
| GET | `/api/workspace/{id}/tree` | Get current file tree |
| GET | `/api/workspace/{id}/file` | Get file content (`?path=...`) |
| PUT | `/api/workspace/{id}/file` | Save file content (local only, not committed) |
| DELETE | `/api/workspace/{id}` | Clean up cloned repo |

### Copilot
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/copilot/suggest` | AI code suggestion → diff |
| POST | `/api/copilot/add-comments` | Auto-comment a file → diff |
| POST | `/api/copilot/explain` | Explain selected code in plain English |
| POST | `/api/copilot/gh-suggest` | Proxy to GitHub Copilot API |
| GET | `/api/copilot/snippets` | List snippets (filter: lang, tag) |
| POST | `/api/copilot/snippets` | Save a snippet |
| DELETE | `/api/copilot/snippets/{id}` | Delete a snippet |

### Git Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/git/status` | Git status (staged/unstaged/untracked) |
| GET | `/api/git/log` | Recent commits |
| POST | `/api/git/branch` | Create and checkout new branch |
| POST | `/api/git/commit` | Stage + commit + push files |
| GET | `/api/git/diff` | Raw diff for a file vs HEAD |

### Coverage
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/coverage/analyze` | AST-based gap analysis for a file |
| GET | `/api/coverage/{workspace_id}/summary` | Per-file coverage % |
| POST | `/api/coverage/run` | Run pytest --cov and return coverage.json |

### Test Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tests/generate` | Generate test cases for coverage gaps |
| POST | `/api/tests/run` | Run a test file, return results |
| GET | `/api/tests/{workspace_id}` | List saved test suites |

---

## 10. All Packages & Tools

### Frontend Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@monaco-editor/react` | ^4.6.0 | Code editor + diff viewer |
| `monaco-editor` | ^0.45.0 | Monaco peer dependency |
| `@tanstack/react-query` | ^5.x | Already used — extend for new hooks |
| `axios` | Already used | HTTP client |
| `lucide-react` | Already used | File/status icons |
| `react-router-dom` | Already used | New `/workspace` route |
| `shadcn/ui` | Already used | UI components |
| `sonner` | Already used | Toast notifications for commit success |
| `recharts` | Already used | Coverage trend chart (optional) |

### Backend Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `gitpython` | ^3.1.40 | Git clone, commit, push operations |
| `anthropic` | ^0.25.0 | Claude API (already used via ai_service) |
| `httpx` | ^0.27 | GitHub Copilot API proxy calls |
| `pytest` | ^8.1 | Test execution |
| `pytest-asyncio` | ^0.23 | Async test support |
| `pytest-cov` | ^4.1 | Coverage measurement |
| `pytest-json-report` | ^1.5 | Machine-readable test results |
| `coverage` | ^7.4 | Coverage.py (used by pytest-cov) |
| `difflib` | stdlib | Diff generation |
| `ast` | stdlib | Python AST parsing for gap analysis |
| `motor` | Already used | MongoDB async driver |
| `fastapi` | Already used | API framework |
| `pydantic` | Already used | Request/response schemas |
| `uvicorn` | Already used | ASGI server |

### Infrastructure / DevOps

| Tool | Purpose |
|------|---------|
| Docker | Containerize backend (includes playwright, git, pytest) |
| MongoDB Atlas | Production database |
| GitHub Actions | CI/CD — run tests on commit |
| Vercel | Frontend deployment |
| Railway / Render | Backend deployment |
| Redis (optional) | Cache AI responses for identical prompts |

---

## 11. Environment Variables & Config

### Backend `.env`
```env
# Existing
AZURE_OPENAI_KEY=...
MONGODB_URL=mongodb://localhost:27017
GITHUB_TOKEN=...

# New for Workspace
ANTHROPIC_API_KEY=sk-ant-...
COPILOT_PROVIDER=anthropic          # or "github"
GITHUB_COPILOT_TOKEN=...            # only if COPILOT_PROVIDER=github
WORKSPACE_TEMP_DIR=/tmp/workspaces  # where repos are cloned
MAX_FILE_SIZE_KB=500                # skip files larger than this
MAX_REPO_SIZE_MB=100                # refuse repos larger than this
COMMIT_AUTHOR_NAME=TestGen AI
COMMIT_AUTHOR_EMAIL=ai@testgen.dev
```

### Frontend `.env`
```env
VITE_API_URL=/api
VITE_COPILOT_PROVIDER=anthropic
```

### `backend/app/config.py` additions
```python
class Settings(BaseSettings):
    anthropic_api_key: str
    copilot_provider: str = "anthropic"
    github_copilot_token: Optional[str] = None
    workspace_temp_dir: str = "/tmp/workspaces"
    max_file_size_kb: int = 500
    commit_author_name: str = "TestGen AI"
    commit_author_email: str = "ai@testgen.dev"
```

---

## 12. Security Considerations

| Risk | Mitigation |
|------|-----------|
| Arbitrary code execution via test runner | Run `pytest` in subprocess with timeout (30s), no network access, temp directory only |
| Git push with user's PAT | PAT stored server-side in workspace session only, never returned to browser, deleted on workspace close |
| Repo cloning malicious repos | Validate GitHub URL format, enforce `MAX_REPO_SIZE_MB`, `--depth 1` shallow clone only |
| AI-generated code injection | Diff shown to user before applying — human-in-the-loop mandatory |
| Temp directory cleanup | Background task deletes `/tmp/workspaces/{id}` after 2 hours of inactivity |
| Large file DoS | Skip files > `MAX_FILE_SIZE_KB`, truncate content sent to AI to 8000 tokens |
| CORS | Existing CORS config covers new routes automatically |

---

## 13. Deployment Architecture

```
GitHub Repo
    │
    ├── Push to main
    │
    ▼
GitHub Actions (CI)
    ├── pytest backend tests
    ├── npm run build (frontend)
    └── docker build

    ▼ (on success)
    ├── Frontend → Vercel (automatic)
    └── Backend → Railway / Render
                  └── Docker container
                      ├── FastAPI (uvicorn)
                      ├── Playwright browsers
                      ├── Git (installed in image)
                      └── Python + pytest

    External Services:
    ├── MongoDB Atlas (database)
    ├── Anthropic API (AI)
    ├── GitHub API (repo ops)
    └── GitHub Copilot API (optional)
```

### Dockerfile additions for workspace feature
```dockerfile
# Add to existing Dockerfile
RUN apt-get install -y git
RUN pip install gitpython pytest pytest-asyncio pytest-cov pytest-json-report coverage
```

---

## 14. Development Sequence & Milestones

### Phase 1 — Foundation (Week 1–2)
- [ ] `workspace_service.py` — clone + file tree
- [ ] `POST /api/workspace/connect` + `GET /api/workspace/{id}/file`
- [ ] `FileExplorer.tsx` + `WorkspaceProvider`
- [ ] Monaco editor basic integration (`CodeEditor.tsx`)
- [ ] `/workspace` route wired into app

### Phase 2 — AI Code Generation (Week 2–3)
- [ ] `copilot_service.py` — prompt engineering + diff generation
- [ ] `POST /api/copilot/suggest`
- [ ] `CopilotChat.tsx` — chat UI
- [ ] `DiffViewer.tsx` — Monaco DiffEditor
- [ ] Accept/reject flow

### Phase 3 — Commit Pipeline (Week 3)
- [ ] `git_service.py` — GitPython operations
- [ ] `POST /api/git/commit`
- [ ] `CommitPanel.tsx` — commit message + push UI
- [ ] Success toast with GitHub link

### Phase 4 — Comments & Snippets (Week 4)
- [ ] `POST /api/copilot/add-comments`
- [ ] Snippet detection in AI response
- [ ] `SnippetLibrary.tsx` + CRUD endpoints

### Phase 5 — Test Generation (Week 4–5)
- [ ] `coverage_service.py` — AST gap analysis
- [ ] `test_gen_service.py` — Claude test generation
- [ ] `POST /api/tests/generate` + `POST /api/tests/run`
- [ ] Coverage gutter decorations in Monaco
- [ ] `TestGenerator.tsx`

### Phase 6 — GitHub Copilot Integration (Week 5–6)
- [ ] GitHub OAuth setup
- [ ] `POST /api/copilot/gh-suggest` proxy
- [ ] Frontend provider toggle (`VITE_COPILOT_PROVIDER`)
- [ ] Inline completion mode (as-you-type suggestions)

### Phase 7 — Polish & Production Hardening (Week 6–7)
- [ ] Rate limiting on AI endpoints
- [ ] Workspace TTL cleanup job
- [ ] Error boundaries in React
- [ ] Loading skeletons for editor
- [ ] E2E tests (Playwright) for commit flow
- [ ] Docker image update + deploy

---

## Quick Reference — Key File Locations

```
NEW FRONTEND FILES
src/pages/Workspace.tsx
src/components/workspace/
  ├── FileExplorer.tsx
  ├── CodeEditor.tsx
  ├── DiffViewer.tsx
  ├── CopilotChat.tsx
  ├── CommitPanel.tsx
  ├── SnippetLibrary.tsx
  ├── TestGenerator.tsx
  └── StatusBar.tsx
src/hooks/
  ├── use-workspace.ts
  ├── use-copilot.ts
  ├── use-git.ts
  ├── use-coverage.ts
  ├── use-test-gen.ts
  └── use-snippets.ts

NEW BACKEND FILES
backend/app/routes/
  ├── workspace.py
  ├── copilot.py
  ├── git_ops.py
  ├── coverage.py
  └── test_gen.py
backend/app/services/
  ├── workspace_service.py
  ├── copilot_service.py
  ├── git_service.py
  ├── coverage_service.py
  └── test_gen_service.py

MODIFIED FILES
backend/main.py              — register 5 new routers
backend/app/config.py        — add new env vars
backend/requirements.txt     — add gitpython, pytest packages
src/App.tsx                  — add /workspace route
src/components/AppSidebar.tsx — add Workspace nav item
src/lib/api.ts               — add new API functions
```

---

*Document version: 1.0 · TestGen AI Suite · AI Developer Workspace Module*