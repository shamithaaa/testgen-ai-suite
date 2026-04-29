# Vercel Deployment System — Complete Plan

## Overview

This document covers the full architecture, implementation flow, required API keys, and blockers-free plan for triggering Vercel deployments from a frontend via a secure backend proxy.

---

## Architecture Overview

```
[React Frontend]
      |
      | POST /api/deploy
      v
[Flask / Node.js Backend]   <-- Stores VERCEL_TOKEN securely
      |
      | POST https://api.vercel.com/v13/deployments
      v
[Vercel API]
      |
      | Deployment Status (polling / webhook)
      v
[Backend → Frontend (via WebSocket or polling)]
```

---

## Phase 1 — Environment Setup

### Required API Keys & Tokens

| Key/Token | Where to Get | Used For |
|---|---|---|
| `VERCEL_TOKEN` | vercel.com → Settings → Tokens | Authenticate all Vercel API calls |
| `VERCEL_TEAM_ID` | vercel.com → Team Settings → General | Required if deploying under a team account |
| `VERCEL_PROJECT_ID` | vercel.com → Project → Settings → General | Target project for deployment |
| `GITHUB_TOKEN` *(optional)* | github.com → Settings → Developer settings → PAT | If deploying from a private GitHub repo |
| `REDIS_URL` *(optional)* | Upstash / Redis Cloud | Async job queue for deployment tasks |
| `MONGODB_URI` *(optional)* | MongoDB Atlas | Storing deployment logs and history |

### Where to Store These Keys

- **Never in frontend code** — not in `.env.local` if the file is exposed, not in JS bundles
- **Backend only** — in a `.env` file loaded server-side, or in a secrets manager (e.g., AWS Secrets Manager, Doppler)
- **CI/CD** — inject via environment variables in your pipeline (GitHub Actions Secrets, Vercel Environment Variables for the backend project itself)

---

## Phase 2 — Backend Implementation

### Step 1: Install Dependencies

```bash
# Node.js
npm install express node-fetch dotenv cors

# Python / Flask
pip install flask requests python-dotenv flask-cors
```

### Step 2: Create the Deployment Endpoint

**Node.js (Express)**

```javascript
// server/routes/deploy.js
import fetch from "node-fetch";

export default async function deployHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: process.env.VERCEL_PROJECT_NAME,
        gitSource: {
          type: "github",
          repoId: process.env.GITHUB_REPO_ID,
          ref: req.body.branch || "main",
        },
        target: req.body.target || "production",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Deploy failed" });
    }

    return res.json({
      deploymentId: data.id,
      url: data.url,
      status: data.readyState,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

**Python (Flask)**

```python
# app/routes/deploy.py
import os, requests
from flask import Blueprint, request, jsonify

deploy_bp = Blueprint("deploy", __name__)

@deploy_bp.route("/api/deploy", methods=["POST"])
def trigger_deploy():
    body = request.get_json()
    branch = body.get("branch", "main")
    target = body.get("target", "production")

    headers = {
        "Authorization": f"Bearer {os.environ['VERCEL_TOKEN']}",
        "Content-Type": "application/json",
    }

    payload = {
        "name": os.environ["VERCEL_PROJECT_NAME"],
        "gitSource": {
            "type": "github",
            "repoId": os.environ["GITHUB_REPO_ID"],
            "ref": branch,
        },
        "target": target,
    }

    resp = requests.post("https://api.vercel.com/v13/deployments", json=payload, headers=headers)

    if not resp.ok:
        return jsonify({"error": resp.json().get("error", {}).get("message", "Deploy failed")}), resp.status_code

    data = resp.json()
    return jsonify({
        "deploymentId": data["id"],
        "url": data["url"],
        "status": data["readyState"],
    })
```

### Step 3: Status Polling Endpoint

```javascript
// GET /api/deploy/:id/status
export async function statusHandler(req, res) {
  const { id } = req.params;

  const response = await fetch(`https://api.vercel.com/v13/deployments/${id}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });

  const data = await response.json();

  return res.json({
    status: data.readyState,   // QUEUED | BUILDING | ERROR | READY | CANCELED
    url: data.url,
    createdAt: data.createdAt,
  });
}
```

---

## Phase 3 — Frontend Implementation

### Deploy Button (React)

```jsx
// components/DeployButton.jsx
import { useState } from "react";

export default function DeployButton({ branch = "main" }) {
  const [status, setStatus] = useState("idle");
  const [deployUrl, setDeployUrl] = useState(null);
  const [error, setError] = useState(null);

  async function handleDeploy() {
    setStatus("triggering");
    setError(null);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus("building");
      pollStatus(data.deploymentId);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  async function pollStatus(deploymentId) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/deploy/${deploymentId}/status`);
      const data = await res.json();

      if (data.status === "READY") {
        setStatus("ready");
        setDeployUrl(`https://${data.url}`);
        clearInterval(interval);
      } else if (data.status === "ERROR") {
        setStatus("error");
        setError("Deployment failed on Vercel.");
        clearInterval(interval);
      }
    }, 5000); // Poll every 5 seconds
  }

  return (
    <div>
      <button onClick={handleDeploy} disabled={status === "building" || status === "triggering"}>
        {status === "idle" && "Deploy"}
        {status === "triggering" && "Triggering..."}
        {status === "building" && "Building..."}
        {status === "ready" && "Deployed ✓"}
        {status === "error" && "Retry Deploy"}
      </button>

      {deployUrl && <a href={deployUrl} target="_blank">View Deployment →</a>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

---

## Phase 4 — Deployment Logging (Optional but Recommended)

### MongoDB Schema

```javascript
// models/Deployment.js
const DeploymentSchema = {
  deploymentId: String,       // Vercel deployment ID
  projectName: String,
  branch: String,
  triggeredBy: String,        // User or system that triggered
  status: String,             // QUEUED | BUILDING | READY | ERROR
  url: String,
  createdAt: Date,
  completedAt: Date,
  logs: [String],
};
```

### Logging in Backend

```javascript
// After triggering deploy, save to DB
await Deployment.create({
  deploymentId: data.id,
  projectName: process.env.VERCEL_PROJECT_NAME,
  branch: req.body.branch,
  triggeredBy: req.user?.id || "anonymous",
  status: "BUILDING",
  createdAt: new Date(),
});
```

---

## Phase 5 — Advanced: Async Queue (Redis)

For high-traffic apps or multiple concurrent deployments:

```javascript
// queue/deployQueue.js
import Queue from "bull";

const deployQueue = new Queue("deployments", process.env.REDIS_URL);

deployQueue.process(async (job) => {
  const { branch, projectId } = job.data;
  // Call Vercel API here
});

// In your route:
export async function handler(req, res) {
  const job = await deployQueue.add({ branch: req.body.branch });
  res.json({ jobId: job.id, message: "Deployment queued" });
}
```

---

## Blockers & Solutions

| Blocker | Root Cause | Solution |
|---|---|---|
| `401 Unauthorized` from Vercel API | Invalid or missing `VERCEL_TOKEN` | Regenerate token at vercel.com → Settings → Tokens |
| `403 Forbidden` | Token doesn't have deploy scope | Create token with full access or deploy scope |
| Deployment triggers but no code update | Wrong `repoId` or `ref` | Verify GitHub repo ID via GitHub API; check branch name |
| CORS errors on frontend | Backend not allowing frontend origin | Add `cors({ origin: "http://localhost:3000" })` to Express |
| Status always returns `BUILDING` | Polling interval too short | Increase poll interval to 5–10 seconds |
| Webhook not firing | Missing webhook secret validation | Verify `x-vercel-signature` header in webhook handler |
| Redis queue not processing | Worker not running | Start the queue worker as a separate process |
| Rate limit hit on Vercel API | Too many status polls | Use Vercel webhooks instead of polling |

---

## Complete .env Template

```env
# === VERCEL ===
VERCEL_TOKEN=your_vercel_personal_access_token
VERCEL_TEAM_ID=team_xxxxxxxxxxxxxxxxxxxx        # Only if using a team
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxxxxxxxxx
VERCEL_PROJECT_NAME=my-project-name

# === GITHUB (if deploying from private repo) ===
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO_ID=123456789                        # Numeric repo ID from GitHub API

# === DATABASE (optional) ===
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/deployments
REDIS_URL=redis://localhost:6379

# === APP ===
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

---

## How to Get Each Key

### VERCEL_TOKEN
1. Go to vercel.com → Log in
2. Click your avatar (top right) → Settings
3. Navigate to Tokens
4. Click Create → give it a name → set scope to Full Account
5. Copy the token immediately (shown only once)

### VERCEL_TEAM_ID
1. Go to your Vercel team dashboard
2. Settings → General
3. Copy the Team ID (starts with `team_`)

### VERCEL_PROJECT_ID
1. Open your project on Vercel
2. Settings → General
3. Copy the Project ID (starts with `prj_`)

### GITHUB_REPO_ID
```bash
curl https://api.github.com/repos/{owner}/{repo} | jq .id
```

---

## Summary Flow (End to End)

```
1. User clicks "Deploy" on React frontend
2. Frontend sends POST /api/deploy { branch: "main" }
3. Backend validates request, reads VERCEL_TOKEN from env
4. Backend sends POST to https://api.vercel.com/v13/deployments
5. Vercel responds with { id, url, readyState: "BUILDING" }
6. Backend returns { deploymentId, url, status } to frontend
7. Frontend starts polling GET /api/deploy/:id/status every 5s
8. Backend forwards status from Vercel API to frontend
9. When readyState === "READY", frontend shows live URL
10. All events logged to MongoDB (optional)
```

---

*Document generated for production-grade Vercel deployment integration.*