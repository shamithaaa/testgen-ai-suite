from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect_db, close_db
from app.routes import (
    requirements, test_cases, test_execution, synthetic_data,
    prioritization, dashboard, repo_analysis,
    github, jira, ci_intelligence, defect_prediction, release_gate,
    monitoring, incidents, sprint,
    workspace, copilot, git_ops, coverage, test_gen,
    pipeline, impact, commit, deployments, prd,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="TestGen AI Suite API",
    description="AI-powered SDLC & Data Quality platform backend.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS – allow the Vite dev server, production build, and all *.vercel.app deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api prefix
API_PREFIX = "/api"

# Existing routes
app.include_router(requirements.router, prefix=API_PREFIX)
app.include_router(test_cases.router, prefix=API_PREFIX)
app.include_router(test_execution.router, prefix=API_PREFIX)
app.include_router(synthetic_data.router, prefix=API_PREFIX)
app.include_router(prioritization.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(repo_analysis.router, prefix=API_PREFIX)

# New SDLC Intelligence routes
app.include_router(github.router, prefix=API_PREFIX)
app.include_router(jira.router, prefix=API_PREFIX)
app.include_router(ci_intelligence.router, prefix=API_PREFIX)
app.include_router(defect_prediction.router, prefix=API_PREFIX)
app.include_router(release_gate.router, prefix=API_PREFIX)
app.include_router(monitoring.router, prefix=API_PREFIX)
app.include_router(incidents.router, prefix=API_PREFIX)
app.include_router(sprint.router, prefix=API_PREFIX)

# AI Workspace routes
app.include_router(workspace.router, prefix=API_PREFIX)
app.include_router(copilot.router, prefix=API_PREFIX)
app.include_router(git_ops.router, prefix=API_PREFIX)
app.include_router(commit.router, prefix=API_PREFIX)
app.include_router(coverage.router, prefix=API_PREFIX)
app.include_router(test_gen.router, prefix=API_PREFIX)
app.include_router(pipeline.router, prefix=API_PREFIX)
app.include_router(deployments.router, prefix=API_PREFIX)

# Code Impact + Test Intelligence routes (Flow 1 & 2)
app.include_router(impact.router, prefix=API_PREFIX)

# PRD Generator
app.include_router(prd.router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "TestGen AI Suite API", "version": "2.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
