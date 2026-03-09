# How TestGen AI Works
### A plain-English guide for non-technical readers

---

## The Big Picture

Imagine you're building a new feature for a software product — say, a truck fleet monitoring system. Before that feature goes live, a team of engineers needs to **test** it: try different situations, check that it behaves correctly, and look for things that could go wrong.

Writing those tests by hand is slow, repetitive, and easy to get wrong. **TestGen AI automates all of that.** You describe your feature in plain English, and the platform generates, runs, and ranks every test automatically using artificial intelligence.

---

## The 4-Step Journey

```
 You describe → AI writes tests → System runs tests → AI ranks what to fix first
 the feature     (Step 1–2)        (Step 3)             (Step 4)
```

---

### Step 1 — You Describe the Requirement

You open the **Requirements** page and type (or paste) a description of your software feature. It can be as simple as:

> *"Trucks send engine health data to the fleet platform every 30 seconds, including temperature, speed, fuel level, and GPS location."*

You click **Generate Test Cases**.

**What happens behind the scenes:**

1. Your text is sent from the browser to a Python **server** (called a FastAPI backend) running on your computer.
2. The server sends your text to **Google's Gemini AI** (the same family of AI as Google's Bard / Gemini chat).
3. Gemini reads your requirement and — acting like a senior QA engineer — writes a full set of test cases covering every angle it can think of.
4. The server saves those test cases into a **MongoDB database** (a cloud database, like a very structured filing cabinet).

---

### Step 2 — You Review the Generated Tests

The **Generated Tests** page shows you everything Gemini wrote, sorted into five categories:

| Category | What it checks |
|---|---|
| **Functional** | Normal, everyday use — does the feature work as expected? |
| **Edge Cases** | Unusual or extreme inputs — what if the data is missing or out of range? |
| **API** | HTTP-level checks — does the system accept and reject requests correctly? |
| **Failure Scenarios** | What happens when something goes wrong — network drops, server unresponsive? |
| **Regression** | Makes sure old features still work after new changes are made |

Each test has a **severity label**: Critical, High, Medium, or Low — telling you how serious a failure would be.

You don't write any of this. The AI wrote all of it from your one paragraph.

---

### Step 3 — You Choose Your Data and Run the Tests

Before running, you pick how the tests should be **fed data**:

#### Option A — Upload a File
You upload a CSV or Excel spreadsheet you already have (for example, real truck data from your own systems). The platform reads the column names and rows and uses them as the test's input data. This is best when you have real-world data you want to test against.

#### Option B — Specify Column Names
You type in the column names your data should have — for example: `vehicle_id, speed, fuel_level, engine_temp`. The AI then **generates realistic rows** for those columns automatically. No spreadsheet needed.

#### Option C — Let AI Decide (Recommended for beginners)
You don't do anything. The AI reads your original requirement, figures out what kind of data makes sense, and handles everything. Great for a quick first run.

**You click "Confirm & Run Tests".**

**What happens behind the scenes:**

1. The server takes all the test cases it stored in the database earlier.
2. For each test case, it **simulates running it** — this means it applies a realistic pass/fail outcome based on the test's ID and severity. Some tests are deliberately marked as "flaky" (IDs like TC-003, TC-011) to simulate real-world instability.
3. Every single result — pass or fail, how long it took, what error appeared — is saved back to the database.
4. A summary is returned: how many passed, how many failed, total duration, success rate.
5. If you used the "columns" option, Gemini generated synthetic data rows first, which the system tags onto the run for traceability.

You see: a live pass/fail timeline, a pie chart, success rate, and detailed per-test results.

> **Note on "simulated" testing:** The current version simulates the actual test execution (it uses probability-based pass/fail). In a production system, you would swap this out for real test runners that actually call your software's endpoints.

---

### Step 4 — AI Ranks What Needs Fixing First

The **Prioritization** page uses AI to answer the most important question: *"Of all the failing tests, which one should I fix first?"*

**What happens:**

1. The server reads all stored test results from the database — how many times each test has failed, how recently, and how severe it is.
2. This history is sent to Gemini, which acts as a **QA risk analyst**.
3. Gemini assigns each test a **priority score from 0 to 100** — the higher the number, the more urgently it needs attention.
4. Tests are grouped into High / Medium / Low priority, and any "known failures" (tests that fail consistently) are highlighted separately.

You can click **Refresh AI Ranking** at any time to re-run this analysis with the latest data.

---

## The Supporting Pages

### Dashboard
The homepage of the platform. Shows live KPIs (key numbers at a glance): total tests, pass rate, failures, known issues, high-priority alerts. It auto-refreshes every 30 seconds. Also includes a **"How It Works"** guide for first-time users.

### Synthetic Data
A standalone tool for generating fake-but-realistic vehicle telemetry data (engine temperature, RPM, GPS, fuel level, etc.). You can describe a driving scenario — *"highway driving in heavy traffic"* — and Gemini generates a table of records matching that scenario. Useful for populating your database with test data without needing real vehicles.

---

## How the Code Is Organised

```
testgen-ai-suite/
│
├── src/                        ← The website (React, runs in your browser)
│   ├── pages/                  ← Each screen: Landing, Dashboard, Requirements, etc.
│   ├── hooks/                  ← Logic for talking to the backend (fetching data)
│   ├── lib/
│   │   ├── api.ts              ← All the requests sent to the backend, in one place
│   │   └── mockData.ts         ← Fallback sample data shown if backend is offline
│   └── components/             ← Reusable UI pieces (sidebar, buttons, cards)
│
└── backend/                    ← The server (Python FastAPI, runs separately)
    └── app/
        ├── routes/             ← The "doors" the browser knocks on (API endpoints)
        │   ├── requirements.py       → POST /api/requirements
        │   ├── test_cases.py         → GET  /api/test-cases
        │   ├── test_execution.py     → POST /api/test-execution/run
        │   ├── synthetic_data.py     → POST /api/synthetic-data/generate
        │   ├── prioritization.py     → GET  /api/prioritization
        │   └── dashboard.py          → GET  /api/dashboard/stats
        │
        ├── services/           ← The business logic — what actually happens
        │   ├── ai_service.py         → All Gemini AI prompts live here
        │   ├── requirement_service.py
        │   ├── test_case_service.py
        │   ├── execution_service.py
        │   ├── synthetic_data_service.py
        │   ├── prioritization_service.py
        │   └── dashboard_service.py
        │
        ├── models/             ← Definitions of what data looks like
        └── database.py         ← Connection to MongoDB Atlas (the cloud database)
```

---

## The Data Flow in One Diagram

```
 Browser (React)
      │
      │  "Analyse this requirement"
      ▼
 FastAPI Server (Python)
      │
      ├──► Google Gemini AI  ──► "Here are 18 test cases"
      │
      ├──► MongoDB Atlas     ──► Saves the test cases
      │
      └──► Returns to browser: test cases, results, scores
```

---

## Technology Glossary

| Word | Plain-English meaning |
|---|---|
| **React** | The code that draws the website in your browser |
| **FastAPI** | A Python framework — the server that handles browser requests |
| **MongoDB Atlas** | A cloud database — stores all requirements, tests, and results |
| **Gemini AI** | Google's AI model — reads requirements, generates tests, ranks them |
| **API** | A "bridge" between the browser and the server — they talk through it |
| **Synthetic data** | Fake-but-realistic data generated by AI for testing purposes |
| **Pass/Fail simulation** | The current system approximates real test outcomes using probability |
| **Priority score** | A number (0–100) Gemini assigns to say how urgently a test needs attention |

---

## What Runs Where

| Thing | Where it runs | How to start it |
|---|---|---|
| Website (frontend) | Your browser | `npm run dev` in the project root |
| Backend server | Your computer, port 8000 | `uv run uvicorn main:app --reload --port 8000` inside the `backend/` folder |
| Database | MongoDB Atlas cloud | Always on — no action needed |
| AI (Gemini) | Google's cloud | Always on — uses API key in `.env` |
