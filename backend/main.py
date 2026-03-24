"""VybeCod.ing Launch Ops — FastAPI Application.

A semi-autonomous marketing operations platform powered by Claude AI.
Manages multi-product launches with AI-driven workflows, press kit
generation, SEO optimization, content repurposing, and more.
"""

import os
import asyncio
import logging
import uuid as _uuid
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from config import get_settings
from database import run_setup, close_pool, select_one
from services.auth import decode_token

logger = logging.getLogger(__name__)

# Import routers
from routers.products import router as products_router
from routers.workflows import router as workflows_router
from routers.queue import router as queue_router
from routers.auth import router as auth_router
from routers.extras import (
    templates_router,
    calendar_router,
    captures_router,
    settings_router,
)

# Frontend dist directory (built by Dockerfile)
STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables. Shutdown: close DB pool."""
    try:
        await asyncio.wait_for(run_setup(), timeout=30)
        logger.info("Database setup complete")
    except Exception as e:
        logger.error(f"Database setup failed: {e} — app will start anyway")
    yield
    await close_pool()


def create_app() -> FastAPI:
    """Application factory."""
    cfg = get_settings()

    app = FastAPI(
        title=cfg.app_name,
        version=cfg.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — allow the React frontend
    origins = [o.strip() for o in cfg.cors_origins.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Auth middleware — protect /api/* except /api/auth/*
    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        path = request.url.path
        # Skip auth for: login/register, health, docs, static files
        PUBLIC_PATHS = ("/api/auth/register", "/api/auth/login", "/api/auth/me")
        if (
            path in PUBLIC_PATHS
            or path == "/health"
            or path in ("/docs", "/redoc", "/openapi.json")
            or not path.startswith("/api/")
        ):
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        token = auth_header[7:]
        try:
            payload = decode_token(token)
            # Attach user info to request state
            user_id = _uuid.UUID(payload["sub"]) if isinstance(payload["sub"], str) else payload["sub"]
            users = await select_one("users", user_id)
            if not users:
                return JSONResponse(status_code=401, content={"detail": "User not found"})
            request.state.user = {
                "id": str(users["id"]),
                "email": users["email"],
                "name": users.get("name", ""),
                "role": users.get("role", "user"),
                "created_at": str(users.get("created_at", "")),
            }
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        return await call_next(request)

    # Register API routers
    app.include_router(auth_router)
    app.include_router(products_router)
    app.include_router(workflows_router)
    app.include_router(queue_router)
    app.include_router(templates_router)
    app.include_router(calendar_router)
    app.include_router(captures_router)
    app.include_router(settings_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Serve frontend static files if the build exists
    if STATIC_DIR.exists():
        # Mount static assets (JS, CSS, images)
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

        # Catch-all: serve index.html for any non-API route (SPA routing)
        @app.get("/{path:path}")
        async def serve_spa(request: Request, path: str):
            # Don't intercept API routes or docs
            if path.startswith("api/") or path in ("docs", "redoc", "openapi.json"):
                return
            # Try to serve the exact file first
            file_path = STATIC_DIR / path
            if file_path.is_file():
                return FileResponse(file_path)
            # Otherwise serve index.html (SPA client-side routing)
            return FileResponse(STATIC_DIR / "index.html")
    else:
        @app.get("/")
        async def root():
            return {
                "app": cfg.app_name,
                "version": cfg.app_version,
                "status": "running",
                "docs": "/docs",
                "note": "Frontend not built yet. Run the Dockerfile to build.",
            }

    return app


app = create_app()
