# TestSphere (TestGen AI Suite)

## 1) Summary (non-technical)

TestSphere is a guided QA workspace that helps teams go from “what we want to build” to “what we should test” and “what we should fix first”.

At a high level it helps you:

- Turn a plain-English requirement into a complete test suite.
- Run those tests using realistic data (either your own file or AI-generated data).
- See results clearly (pass/fail, timing, trends).
- Prioritize what to address first using risk ranking.
- Optionally generate and run real browser-based tests against a live app (Live Test Runner).

The left sidebar (navbar) is the main navigation. It’s designed as a step-by-step workflow so non-technical users can follow it without needing to understand the implementation.

More walkthroughs (plain-English):

- Welcome & Dashboard: [README_WELCOME_AND_DASHBOARD.md](README_WELCOME_AND_DASHBOARD.md)
- Live Test Runner: [README_LIVE_TEST_RUNNER.md](README_LIVE_TEST_RUNNER.md)
- Workflow & Synthetic Data: [README_WORKFLOW_AND_SYNTHETIC_DATA.md](README_WORKFLOW_AND_SYNTHETIC_DATA.md)

---

## 2) Dashboard (start here)

**What it is**
- The “mission control” page that summarizes quality status at a glance.
- It shows key numbers like total tests, pass rate, failures, and trends.
- It includes a guided workflow panel that tells you what to do next.

**Why we use it**
- It answers: “Are we healthy right now?”
- It reduces time spent searching for the next action.
- It helps first-time users understand the platform flow quickly.

**How to use it**
- If you are new: click the guided workflow cards to start Step 1.
- If you already run tests regularly: use it to confirm whether quality is improving or degrading.

---

## 3) Live Test Runner (real app, real browser tests)

**What it is**
- A screen that can automatically create end-to-end (E2E) tests for a real application and run them in a browser.
- You provide:
  - a GitHub repository link (so the system can understand how the app is built), and
  - a running URL (so it can actually test the app you’re seeing).
- It then:
  - figures out key screens and user journeys,
  - generates a set of browser test cases,
  - runs them and shows results including step-by-step screenshots.

**Why we use it**
- The workflow pages (Requirements → Test Suite → Execution → Ranking) are great for requirement coverage.
- Live Test Runner is great for “does the app actually work end-to-end in the browser?”
- Together, they connect intent (requirements) with reality (UI behavior).

**When to use it**
- When you want confidence in real user flows (login, create/update flows, navigation, forms).
- When you want quick E2E coverage on a new app or a specific change.

---

## 4) Navbar walkthrough (in order)

This section follows the sidebar order so you can navigate page-by-page.

### Dashboard
The overview page described above.

### Step 1 — Requirements
Write (or paste) a feature requirement in plain language.

**Why it exists**
- It gives the system the same input a product team already has.
- It reduces the effort of turning requirements into test coverage.

### Step 2 — Test Suite
Review the generated tests grouped by common QA categories (functional, edge cases, integration checks, failure scenarios, regression).

**Why it exists**
- AI gives speed and breadth; humans provide accuracy and context.
- Editing here makes the suite reflect your actual product language.

### Step 3 — Test Execution
Run the suite and watch results arrive.

You can choose a data approach:
- Use an existing dataset file you already trust.
- Specify the columns you want and let AI create realistic rows.
- Let the system choose the data context automatically for a fast first run.

**Why it exists**
- Tests without data aren’t realistic.
- Different teams have different readiness (some have files, some don’t).

### Step 4 — Risk Ranking
See which issues/tests deserve attention first.

**Why it exists**
- Teams usually can’t fix everything at once.
- Ranking helps focus on the most severe and most likely-to-fail areas.

### Synthetic Data
Generate realistic “safe” test datasets when you don’t have production data (or you shouldn’t use it).

**Why it exists**
- Data is often the blocker for testing.
- Synthetic data accelerates early-stage testing and demos.

### Live Test Runner
The real-browser testing capability described above.

---

## Appendix (optional): developer quick start

If you’re running the app locally for development, these are the minimal steps.

Start backend:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```

Start frontend:

```bash
cd ..
npm install
npm run dev
```


