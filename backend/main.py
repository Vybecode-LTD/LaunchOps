"""VybeCod.ing Launch Ops — FastAPI Application.

A semi-autonomous marketing operations platform powered by Claude AI.
Manages multi-product launches with AI-driven workflows, press kit
generation, SEO optimization, content repurposing, and more.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings

# Import routers
from routers.products import router as products_router
from routers.workflows import router as workflows_router
from routers.queue import router as queue_router
from routers.extras import (
    templates_router,
    calendar_router,
    captures_router,
    settings_router,
)


def create_app() -> FastAPI:
    """Application factory."""
    cfg = get_settings()

    app = FastAPI(
        title=cfg.app_name,
        version=cfg.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
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

    # Register routers
    app.include_router(products_router)
    app.include_router(workflows_router)
    app.include_router(queue_router)
    app.include_router(templates_router)
    app.include_router(calendar_router)
    app.include_router(captures_router)
    app.include_router(settings_router)

    @app.get("/")
    async def root():
        return {
            "app": cfg.app_name,
            "version": cfg.app_version,
            "status": "running",
            "docs": "/docs",
        }

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
