# SDLC Intelligence Platform — Project Overview

The SDLC Intelligence Platform is a production-grade, AI-powered ecosystem designed to automate and augment every phase of the Software Development Life Cycle. From global test baseline generation to impact-aware code reviews, the platform ensures that every commit is validated, secure, and ready for production.

---

## 1) Strategic Dashboard & Key Analytics
The **Executive Dashboard** serves as the central mission control, providing deep visibility into the overall health and quality of the SDLC pipeline.

- **KPI Insights**: Real-time tracking of test execution metrics, including pass/fail rates, average pass velocity, and historical trends.
- **Quality Distribution**: Granular breakdowns of test results by severity (Critical, High, Medium, Low) and feature category.
- **Discovery Engine**: Surfacing key anomalies and quality "discoveries" detected during automated scans.

## 2) Repository-Based Test Baselines
The platform establishes a **Global Quality Anchor** by scanning entire applications to build a comprehensive E2E baseline.

- **Autonomous Generation**: By providing a repository URL, the AI explores the codebase and generates an end-to-end test suite covering all critical user flows.
- **MongoDB Persistence**: All generated baselines are stored centrally in MongoDB, allowing for persistent, multi-session test history.
- **Feature-Centric Categorization**: Tests are automatically sorted by application features, enabling targeted regressions and modular suite management.

## 3) The Intelligent Development Pipeline
The developer workflow is enhanced with AI-driven impact analysis and code generation tools.

- **AI-Assisted Engineering**: Integrated tools for repository cloning and code modification. The platform provides a high-fidelity **Side-by-Side Diff** view to review and accept code changes.
- **Impact-Aware Graphing**: The **Impact Tree Visualization** reveals the complex relationships between files. Selecting a file (e.g., a Dashboard component) highlights all interlinked dependencies (3 to 6+ files) that may be affected by a change.
- **Contextual Test Suggestion**: The system analyzes proposed changes and suggests specific test cases per file based on the depth of the dependency tree.

## 4) Hybrid Live Test Runner
The platform features a proprietary **Live Test Runner** that blends modern AI intelligence with established repository baselines.

- **Integrated Execution**: Execute newly generated test cases in real-time using a headless Playwright runtime.
- **Baseline Integration Toggle**: A "Global Baseline" toggle allows developers to merge historical production tests with current session intelligence, ensuring zero regression leakage.
- **Visual Validation**: Watch tests execute step-by-step in a live browser view, capturing screenshots and logs for every interaction.
- **PR Readiness Scoring**: After execution, the platform generates a **Confidence Report**. A 90%+ score indicates a safe commit eligible for PR promotion, while lower scores flag potential risks.

## 5) AI Test Converter & Uploader
Bridge the gap between verbal requirements and runnable code with the **Intelligence Uploader**.

- **Natural Language Parsing**: Convert simple verbal descriptions or handwritten text into structured use cases.
- **Code Synthesis**: Automatically generate runnable Playwright code from parsed use cases.
- **Portable Intelligence**: Generated test units can be downloaded and re-uploaded into the Live Runner for ad-hoc validation of specific fixes.

## 6) Governance: AI Code Reviewer
Ensure every Pull Request meets the highest standards of security and best practices.

- **Automated PR Auditing**: Deep insights into code changes, including branch logic, security vulnerabilities, and key leakage (API keys, secrets).
- **Proactive Bug Detection**: Identifies subtle issues like missing imports, unused variables, and JSX inconsistencies before they reach production.
- **Custom Rule Engine**: Upload your own Markdown-based **Custom Rule Documents** to enforce organization-specific patterns and architectural constraints during the review process.

---

## Technical Architecture

### Core Stack
- **Frontend**: Vite + React + TypeScript + Framer Motion (Luxury UI/UX)
- **Backend**: FastAPI (Python) + MongoDB (Persistence)
- **Execution**: Playwright (Live Browser Runner)
- **Intelligence**: Azure OpenAI (GPT-5 Integration)

### Data Flow & Persistence
The platform uses **MongoDB** as its primary source of truth for:
- Repository Baselines (`playwright_tests` / `repo_baselines`)
- Historical Run Results (`playwright_runs`)
- Strategic Analytics (`incidents` / `dashboard_stats`)

---

## Local Setup & Deployment

### 1. Backend Orchestration
```bash
# Install dependencies
cd backend && pip install -r requirements.txt

# Install Playwright browsers
python -m playwright install

# Start MongoDB (Docker)
docker run -d --name mongodb -p 27017:27017 mongo:7

# Start FastAPI server
python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend Launch
```bash
# Install dependencies
npm install

# Start Vite dev server (Proxy configured to port 8000)
npm run dev # Accessible at http://localhost:8080
```
