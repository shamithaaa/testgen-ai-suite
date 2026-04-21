# Real-Time AI IDE — Production-Grade Build Plan
### Streaming Code Generation Workspace with Live File Mutation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Phase-by-Phase Build Plan](#5-phase-by-phase-build-plan)
6. [Backend Deep Dive](#6-backend-deep-dive)
7. [Frontend Deep Dive](#7-frontend-deep-dive)
8. [Streaming Engine](#8-streaming-engine)
9. [Code Injection Engine](#9-code-injection-engine)
10. [LLM Prompt Strategy](#10-llm-prompt-strategy)
11. [State Management](#11-state-management)
12. [Template System](#12-template-system)
13. [Security & Production Hardening](#13-security--production-hardening)
14. [Deployment Strategy](#14-deployment-strategy)
15. [Known Blockers & How to Avoid Them](#15-known-blockers--how-to-avoid-them)

---

## 1. System Overview

You are building a **real-time AI-powered IDE** — a browser-based workspace where a user types an idea ("create a biology dashboard") and watches the AI generate, create, and mutate files live, token by token, like Cursor or v0.dev.

### Core User Flow

```
User types idea
    ↓
Workspace is created from a base template (file tree appears instantly)
    ↓
WebSocket connection opens to backend
    ↓
Planner Agent decides: what files to create, what to modify
    ↓
Generator streams code token-by-token per file
    ↓
Frontend updates file tree + Monaco editor in real time
    ↓
Injection Engine patches existing files (e.g. App.js routes)
    ↓
Preview auto-refreshes (iframe or Vercel deploy)
    ↓
User sees working app
```

---

## 2. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                         │
│                                                                │
│  ┌──────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │  File Tree   │   │  Monaco Editor  │   │  Preview Panel │  │
│  │  (Zustand)   │   │  (live tokens)  │   │  (iframe/port) │  │
│  └──────┬───────┘   └────────┬────────┘   └───────┬────────┘  │
│         │                   │                     │           │
│         └──────────┬────────┘                     │           │
│                    │  WebSocket Events             │           │
└────────────────────┼──────────────────────────────┼───────────┘
                     │                              │
        ┌────────────▼──────────────┐               │
        │     FastAPI Backend       │               │
        │                           │               │
        │  ┌─────────────────────┐  │               │
        │  │   Planner Agent     │  │               │
        │  │  (decides files)    │  │               │
        │  └────────┬────────────┘  │               │
        │           │               │               │
        │  ┌────────▼────────────┐  │               │
        │  │  Generator Engine   │  │               │
        │  │  (LLM stream/file)  │  │               │
        │  └────────┬────────────┘  │               │
        │           │               │               │
        │  ┌────────▼────────────┐  │               │
        │  │  Injection Engine   │  │               │
        │  │  (patch App.js)     │  │               │
        │  └────────┬────────────┘  │               │
        │           │               │               │
        │  ┌────────▼────────────┐  │               │
        │  │  Workspace Manager  │◄─┼───────────────┘
        │  │  (file system / S3) │  │  (preview server)
        │  └─────────────────────┘  │
        └───────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend Framework | React 18 + Vite | Fast HMR, widely supported |
| Editor | Monaco Editor | Same engine as VS Code |
| State | Zustand | Lightweight, no boilerplate |
| Routing | React Router v6 | Clean page-based navigation |
| WebSocket client | Native WebSocket API | No extra deps needed |
| Backend | FastAPI (Python 3.11+) | Async-native, WebSocket support |
| LLM | Anthropic Claude via API | Structured streaming |
| File System | Local (dev) → S3/EFS (prod) | Persistent workspaces |
| Preview | Sandpack OR iframe + dev server | Live React preview |
| Styling | Tailwind CSS | Utility-first, fast |
| DB | PostgreSQL + SQLAlchemy | Workspace metadata |
| Queue | Redis + Celery | Long-running generation jobs |
| Deployment | Docker + Fly.io or Railway | Low-ops, WebSocket-friendly |

---

## 4. Repository Structure

```
repo/
├── backend/
│   ├── main.py                    # FastAPI app entry
│   ├── routers/
│   │   ├── workspace.py           # CRUD: create, list, delete workspaces
│   │   └── generate.py            # WebSocket generation endpoint
│   ├── engines/
│   │   ├── planner.py             # Decides which files to create
│   │   ├── generator.py           # Streams LLM output per file
│   │   └── injector.py            # Patches existing files safely
│   ├── templates/
│   │   └── react-base/            # Base React template (Vite)
│   │       ├── src/
│   │       │   ├── App.jsx
│   │       │   ├── main.jsx
│   │       │   └── pages/
│   │       ├── package.json
│   │       └── vite.config.js
│   ├── models/
│   │   └── workspace.py           # SQLAlchemy models
│   ├── utils/
│   │   ├── fs.py                  # File system helpers
│   │   └── llm.py                 # Claude API wrapper
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx           # Landing / workspace list
│   │   │   ├── IdeaInput.jsx      # "What do you want to build?"
│   │   │   └── Workspace.jsx      # Main IDE view
│   │   ├── components/
│   │   │   ├── FileTree.jsx       # Animated file explorer
│   │   │   ├── CodeEditor.jsx     # Monaco wrapper
│   │   │   ├── Preview.jsx        # Sandpack / iframe
│   │   │   └── StatusBar.jsx      # Generation status
│   │   ├── store/
│   │   │   └── workspaceStore.js  # Zustand store
│   │   ├── hooks/
│   │   │   └── useGenerationWS.js # WebSocket hook
│   │   └── App.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 5. Phase-by-Phase Build Plan

---

### Phase 1 — Foundation (Days 1–3)

**Goal:** Workspace creation + file tree renders immediately.

#### Step 1.1 — Backend: Template Engine

```python
# backend/engines/template.py

import shutil, uuid, os

TEMPLATES_DIR = "templates"
WORKSPACES_DIR = "workspaces"

def create_workspace(template: str = "react-base") -> str:
    workspace_id = str(uuid.uuid4())
    src = os.path.join(TEMPLATES_DIR, template)
    dst = os.path.join(WORKSPACES_DIR, workspace_id)
    shutil.copytree(src, dst)
    return workspace_id
```

#### Step 1.2 — Backend: Workspace Router

```python
# backend/routers/workspace.py

from fastapi import APIRouter
from engines.template import create_workspace
from utils.fs import list_files

router = APIRouter()

@router.post("/workspace/create")
async def create():
    workspace_id = create_workspace()
    files = list_files(workspace_id)
    return {"workspace_id": workspace_id, "files": files}

@router.get("/workspace/{workspace_id}/files")
async def get_files(workspace_id: str):
    return list_files(workspace_id)
```

#### Step 1.3 — Frontend: File Tree Component

```jsx
// frontend/src/components/FileTree.jsx
import { useWorkspaceStore } from '../store/workspaceStore'
import { motion, AnimatePresence } from 'framer-motion'

export default function FileTree() {
  const files = useWorkspaceStore(s => s.files)

  return (
    <div className="file-tree">
      <AnimatePresence>
        {Object.keys(files).map(path => (
          <motion.div
            key={path}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="file-item"
          >
            {path}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

**Deliverable:** POST `/workspace/create` → file tree renders in browser in < 200ms.

---

### Phase 2 — Streaming Engine (Days 4–6)

**Goal:** WebSocket streams tokens live to Monaco editor.

#### Step 2.1 — WebSocket Event Schema

All backend → frontend messages are typed JSON events. Never send plain text.

```typescript
// Event Types (use these exactly)

type WSEvent =
  | { type: "FILE_CREATE";  path: string }
  | { type: "STREAM_TOKEN"; path: string; token: string }
  | { type: "FILE_UPDATE";  path: string; content: string }
  | { type: "FILE_DONE";    path: string }
  | { type: "GENERATION_DONE" }
  | { type: "ERROR";        message: string }
```

#### Step 2.2 — Backend: WebSocket Endpoint

```python
# backend/routers/generate.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from engines.planner import plan_files
from engines.generator import stream_file
from engines.injector import inject_routes
from utils.fs import save_file, read_file

router = APIRouter()

@router.websocket("/ws/generate/{workspace_id}")
async def generate(ws: WebSocket, workspace_id: str):
    await ws.accept()

    try:
        idea = await ws.receive_text()

        # Step 1: Plan
        plan = await plan_files(idea)

        # Step 2: Generate each file
        for file_spec in plan["files"]:
            path = file_spec["path"]

            await ws.send_json({"type": "FILE_CREATE", "path": path})

            content = ""
            async for token in stream_file(file_spec):
                content += token
                await ws.send_json({
                    "type": "STREAM_TOKEN",
                    "path": path,
                    "token": token
                })

            save_file(workspace_id, path, content)
            await ws.send_json({"type": "FILE_DONE", "path": path})

        # Step 3: Patch App.jsx
        original = read_file(workspace_id, "src/App.jsx")
        updated = inject_routes(original, plan["routes"])
        save_file(workspace_id, "src/App.jsx", updated)

        await ws.send_json({
            "type": "FILE_UPDATE",
            "path": "src/App.jsx",
            "content": updated
        })

        await ws.send_json({"type": "GENERATION_DONE"})

    except WebSocketDisconnect:
        pass  # Client disconnected — clean up if needed
    except Exception as e:
        await ws.send_json({"type": "ERROR", "message": str(e)})
```

#### Step 2.3 — Frontend: WebSocket Hook

```javascript
// frontend/src/hooks/useGenerationWS.js

import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'

export function useGenerationWS(workspaceId) {
  const ws = useRef(null)
  const { addFile, appendToken, updateFile, setStatus } = useWorkspaceStore()

  const startGeneration = (idea) => {
    const url = `ws://${window.location.host}/ws/generate/${workspaceId}`
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      ws.current.send(idea)
      setStatus('generating')
    }

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'FILE_CREATE':
          addFile(data.path, '')
          break
        case 'STREAM_TOKEN':
          appendToken(data.path, data.token)
          break
        case 'FILE_UPDATE':
          updateFile(data.path, data.content)
          break
        case 'GENERATION_DONE':
          setStatus('done')
          ws.current.close()
          break
        case 'ERROR':
          setStatus('error')
          console.error(data.message)
          break
      }
    }

    ws.current.onerror = () => setStatus('error')
  }

  // Cleanup on unmount
  useEffect(() => () => ws.current?.close(), [])

  return { startGeneration }
}
```

**Deliverable:** Code streams token-by-token into Monaco. File tree updates live.

---

### Phase 3 — Planner Agent (Days 7–9)

**Goal:** LLM intelligently decides what files to create and what to modify.

#### Step 3.1 — Planner Prompt

```python
# backend/engines/planner.py

import json
from utils.llm import claude_complete

PLANNER_PROMPT = """
You are a React project planner. Given a user idea, output a JSON plan.

Template already contains:
- src/App.jsx (with route injection markers)
- src/main.jsx
- src/pages/ (empty)
- src/components/ (empty)

User idea: {idea}

Return ONLY valid JSON with this exact shape:
{{
  "files": [
    {{
      "path": "src/pages/BiologyDashboard.jsx",
      "description": "Biology dashboard with charts",
      "imports": ["recharts", "useState"]
    }}
  ],
  "routes": [
    {{
      "path": "/biology",
      "component": "BiologyDashboard",
      "importPath": "./pages/BiologyDashboard"
    }}
  ]
}}
"""

async def plan_files(idea: str) -> dict:
    raw = await claude_complete(PLANNER_PROMPT.format(idea=idea))
    return json.loads(raw)
```

#### Step 3.2 — LLM Wrapper with Streaming

```python
# backend/utils/llm.py

import anthropic
from typing import AsyncGenerator

client = anthropic.AsyncAnthropic()

async def claude_stream(prompt: str) -> AsyncGenerator[str, None]:
    async with client.messages.stream(
        model="claude-opus-4-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    ) as stream:
        async for text in stream.text_stream:
            yield text

async def claude_complete(prompt: str) -> str:
    result = ""
    async for token in claude_stream(prompt):
        result += token
    return result
```

---

### Phase 4 — Code Injection Engine (Days 10–12)

**Goal:** Safely patch App.jsx routes without rewriting the whole file.

#### Step 4.1 — Template Markers (Simple, Production-Safe)

Add these comments to your base `App.jsx` template. They are the injection targets.

```jsx
// src/App.jsx (base template)

import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// AUTO_IMPORTS_START
// AUTO_IMPORTS_END

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        {/* AUTO_ROUTES_START */}
        {/* AUTO_ROUTES_END */}
      </Routes>
    </BrowserRouter>
  )
}
```

#### Step 4.2 — Injection Engine

```python
# backend/engines/injector.py

import re

def inject_routes(app_jsx: str, routes: list[dict]) -> str:
    """
    Safely inject imports and route entries between marker comments.
    Never overwrites anything outside the markers.
    """

    # Build import block
    import_lines = "\n".join(
        f"import {r['component']} from '{r['importPath']}'"
        for r in routes
    )

    # Build route block
    route_lines = "\n        ".join(
        f'<Route path="{r["path"]}" element={{<{r["component"]} />}} />'
        for r in routes
    )

    # Inject imports
    app_jsx = re.sub(
        r'// AUTO_IMPORTS_START.*?// AUTO_IMPORTS_END',
        f'// AUTO_IMPORTS_START\n{import_lines}\n// AUTO_IMPORTS_END',
        app_jsx,
        flags=re.DOTALL
    )

    # Inject routes
    app_jsx = re.sub(
        r'\{/\* AUTO_ROUTES_START \*/\}.*?\{/\* AUTO_ROUTES_END \*/\}',
        f'{{/* AUTO_ROUTES_START */}}\n        {route_lines}\n        {{/* AUTO_ROUTES_END */}}',
        app_jsx,
        flags=re.DOTALL
    )

    return app_jsx
```

**Why this is safe:** Only content between markers is replaced. No AST needed at this stage.

---

### Phase 5 — Preview Panel (Days 13–15)

**Goal:** User sees a live running preview of their generated app.

#### Option A — Sandpack (Recommended for MVP)

Sandpack runs React entirely in the browser. No backend server needed.

```jsx
// frontend/src/components/Preview.jsx

import { Sandpack } from '@codesandbox/sandpack-react'
import { useWorkspaceStore } from '../store/workspaceStore'

export default function Preview() {
  const files = useWorkspaceStore(s => s.files)

  // Convert store format to Sandpack format
  const sandpackFiles = Object.fromEntries(
    Object.entries(files).map(([path, content]) => [
      `/${path}`,
      { code: content }
    ])
  )

  return (
    <Sandpack
      template="react"
      files={sandpackFiles}
      options={{ showPreview: true, showNavigator: true }}
    />
  )
}
```

#### Option B — Dev Server in Container (Full Fidelity)

For full npm support, run each workspace in a container with a dev server exposed on a random port, and embed it in an iframe.

---

## 6. Backend Deep Dive

### FastAPI App Entry

```python
# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import workspace, generate

app = FastAPI(title="AI IDE Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(workspace.router)
app.include_router(generate.router)
```

### File System Utility

```python
# backend/utils/fs.py

import os, json

WORKSPACES_DIR = "workspaces"

def save_file(workspace_id: str, path: str, content: str):
    full_path = os.path.join(WORKSPACES_DIR, workspace_id, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w") as f:
        f.write(content)

def read_file(workspace_id: str, path: str) -> str:
    full_path = os.path.join(WORKSPACES_DIR, workspace_id, path)
    with open(full_path) as f:
        return f.read()

def list_files(workspace_id: str) -> dict:
    root = os.path.join(WORKSPACES_DIR, workspace_id)
    result = {}
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            full = os.path.join(dirpath, fname)
            rel = os.path.relpath(full, root)
            with open(full) as f:
                result[rel] = f.read()
    return result
```

---

## 7. Frontend Deep Dive

### Zustand Store

```javascript
// frontend/src/store/workspaceStore.js

import { create } from 'zustand'

export const useWorkspaceStore = create((set) => ({
  workspaceId: null,
  files: {},           // { "src/App.jsx": "...", ... }
  activeFile: null,
  status: 'idle',      // idle | generating | done | error

  setWorkspace: (id) => set({ workspaceId: id }),

  addFile: (path, content = '') =>
    set(s => ({ files: { ...s.files, [path]: content }, activeFile: path })),

  appendToken: (path, token) =>
    set(s => ({
      files: {
        ...s.files,
        [path]: (s.files[path] || '') + token
      }
    })),

  updateFile: (path, content) =>
    set(s => ({ files: { ...s.files, [path]: content } })),

  setActiveFile: (path) => set({ activeFile: path }),

  setStatus: (status) => set({ status }),
}))
```

### Monaco Editor Wrapper

```jsx
// frontend/src/components/CodeEditor.jsx

import Editor from '@monaco-editor/react'
import { useWorkspaceStore } from '../store/workspaceStore'

export default function CodeEditor() {
  const activeFile = useWorkspaceStore(s => s.activeFile)
  const files = useWorkspaceStore(s => s.files)
  const updateFile = useWorkspaceStore(s => s.updateFile)

  const language = activeFile?.endsWith('.jsx') ? 'javascript'
    : activeFile?.endsWith('.css') ? 'css'
    : 'javascript'

  return (
    <Editor
      height="100%"
      language={language}
      value={files[activeFile] || ''}
      onChange={(val) => updateFile(activeFile, val)}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
      }}
    />
  )
}
```

---

## 8. Streaming Engine

### Generator Prompt Per File

```python
# backend/engines/generator.py

from utils.llm import claude_stream
from typing import AsyncGenerator

FILE_PROMPT = """
You are generating a React component file.

Project context:
- React 18 + Vite
- Tailwind CSS for styling
- React Router v6 already installed
- Available packages: recharts, lucide-react

File to generate: {path}
Description: {description}
Required imports: {imports}

Rules:
- Output ONLY the file content. No explanation, no markdown, no backticks.
- Use functional components with hooks.
- Include a default export.
- Use Tailwind classes for all styling.
- Make it visually complete and functional.
"""

async def stream_file(file_spec: dict) -> AsyncGenerator[str, None]:
    prompt = FILE_PROMPT.format(
        path=file_spec["path"],
        description=file_spec["description"],
        imports=", ".join(file_spec.get("imports", []))
    )
    async for token in claude_stream(prompt):
        yield token
```

---

## 9. Code Injection Engine

### Upgrade Path: Marker → AST

| Stage | Method | Complexity | Safety |
|-------|--------|------------|--------|
| MVP | Regex + Markers | Low | High (contained) |
| V2 | `recast` JS AST | Medium | Very High |
| V3 | Babel Transform | High | Highest |

### Marker Strategy (Production MVP)

The marker approach is safe because:
- Only content between `// AUTO_*_START` and `// AUTO_*_END` is touched
- Template structure is never broken
- Works deterministically with no edge cases

Always include markers in the base template. Never remove them after injection — re-injection must be idempotent.

---

## 10. LLM Prompt Strategy

### Two-Call Pattern (Critical for Quality)

**Call 1 — Plan (JSON, fast, non-streamed):**
Get structured metadata about what to build.

**Call 2 — Generate (streamed, per file):**
Generate actual code for each file with full context.

### System Prompt for Generator

```
You are an expert React developer generating production-quality code.
- Always output raw code only. No markdown. No explanation.
- Files must be self-contained and immediately runnable.
- Use only packages already declared in package.json.
- Follow the existing project conventions strictly.
```

### Avoiding LLM Hallucinations

- Always pass the full `package.json` dependencies list in the prompt
- Always specify the exact import path style (`./pages/X` not `../pages/X`)
- Cap token output per file to 1500 tokens to prevent runaway generation
- Validate generated JSX by attempting a parse before saving to disk

---

## 11. State Management

### State Shape

```typescript
interface WorkspaceState {
  workspaceId: string | null
  files: Record<string, string>     // path → full content
  activeFile: string | null
  status: 'idle' | 'generating' | 'done' | 'error'
  generationLog: string[]           // human-readable status messages
}
```

### Key Rules

- `appendToken` must be fast — it fires on every token (~50ms intervals)
- Monaco does NOT re-render on every token. Set value through a ref, not state directly for performance
- Use `immer` middleware if state updates cause slowness on large files

### Performance Optimization for Token Streaming

```javascript
// Batch token updates every 50ms instead of on every token
// This prevents React re-render storms

let buffer = ''
let flushTimer = null

ws.current.onmessage = (event) => {
  const data = JSON.parse(event.data)

  if (data.type === 'STREAM_TOKEN') {
    buffer += data.token
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        appendToken(data.path, buffer)
        buffer = ''
        flushTimer = null
      }, 50) // Flush every 50ms
    }
  }
}
```

---

## 12. Template System

### Base Template Structure

```
templates/react-base/
├── package.json           # All deps pre-declared
├── vite.config.js
├── index.html
├── tailwind.config.js
└── src/
    ├── main.jsx
    ├── App.jsx            # Contains injection markers
    ├── index.css          # Tailwind directives
    ├── pages/             # Empty — LLM fills this
    └── components/        # Empty — LLM fills this
```

### `package.json` (pre-declare all likely deps)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "vite": "^5.0.0"
  }
}
```

Pre-declaring deps prevents LLM from importing packages that don't exist in the project.

---

## 13. Security & Production Hardening

### WebSocket Security

```python
# Always validate workspace ownership before accepting WS connection
@router.websocket("/ws/generate/{workspace_id}")
async def generate(ws: WebSocket, workspace_id: str, token: str = Query(...)):
    user = verify_token(token)
    if not owns_workspace(user, workspace_id):
        await ws.close(code=4003)
        return
    await ws.accept()
    # ...
```

### File System Isolation

```python
# Path traversal prevention — CRITICAL
import os

def safe_path(workspace_id: str, relative_path: str) -> str:
    base = os.path.realpath(os.path.join(WORKSPACES_DIR, workspace_id))
    full = os.path.realpath(os.path.join(base, relative_path))
    if not full.startswith(base):
        raise ValueError("Path traversal detected")
    return full
```

### Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/workspace/create")
@limiter.limit("10/minute")
async def create(request: Request):
    ...
```

### LLM Output Sanitization

- Never execute LLM-generated code on the server
- Validate generated JSX is parseable before writing to disk
- Use `esprima` or `acorn` to parse and reject files with syntax errors

---

## 14. Deployment Strategy

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./workspaces:/app/workspaces
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_WS_URL=ws://localhost:8000
```

### Production: Fly.io (WebSocket-Native)

Fly.io natively supports WebSocket connections. Recommended over Heroku or AWS Lambda (which require sticky sessions or API Gateway workarounds).

```toml
# fly.toml
app = "ai-ide-backend"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8000
  force_https = true

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1
```

### Frontend: Vercel

```bash
cd frontend
vercel --prod
```

Set env var: `VITE_WS_URL=wss://ai-ide-backend.fly.dev`

---

## 15. Known Blockers & How to Avoid Them

| Blocker | Root Cause | Fix |
|---------|------------|-----|
| WebSocket drops on load balancers | LBs close idle connections | Send a ping every 25s from client |
| Monaco re-renders freeze browser | State update on every token | Batch tokens every 50ms (see §11) |
| LLM imports non-existent packages | No package context in prompt | Always include `package.json` deps in generator prompt |
| Path traversal in workspace FS | Unvalidated user path input | Use `safe_path()` with `realpath` check |
| App.jsx overwritten on re-generate | Injector not idempotent | Re-read current App.jsx before each inject, only add missing routes |
| CORS blocks WebSocket in prod | Missing WS in CORS config | FastAPI CORS middleware does not apply to WS — handle at nginx/proxy level |
| Large file generation cuts off | LLM max token limit | Split large components into sub-components in the planner step |
| Preview out of sync | Sandpack doesn't auto-update | Pass `files` prop reactively; Sandpack re-renders on prop change |

---

## Quick Start Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Test WebSocket manually
wscat -c "ws://localhost:8000/ws/generate/test-workspace-id"
# Then type: create a biology dashboard with charts
```

---

*Plan version 1.0 — Production Grade, No Blockers*