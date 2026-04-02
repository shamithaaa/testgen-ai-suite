from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect_db, close_db
from app.routes import requirements, test_cases, test_execution, synthetic_data, prioritization, dashboard, repo_analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="TestGen AI Suite API",
    description="AI-powered test generation, execution, and prioritization backend.",
    version="1.0.0",
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
app.include_router(requirements.router, prefix=API_PREFIX)
app.include_router(test_cases.router, prefix=API_PREFIX)
app.include_router(test_execution.router, prefix=API_PREFIX)
app.include_router(synthetic_data.router, prefix=API_PREFIX)
app.include_router(prioritization.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(repo_analysis.router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "TestGen AI Suite API"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
