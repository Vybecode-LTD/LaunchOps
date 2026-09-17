"""VybeCod.ing Launch Ops — FastAPI Application.

A semi-autonomous marketing operations platform powered by AI.
Manages multi-product launches with AI-driven workflows, press kit
generation, SEO optimization, content repurposing, and more.
"""

import asyncio
import logging
import re
import uuid as _uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import check_startup_settings, get_settings
from database import (
    DATABASE_UNAVAILABLE_ERRORS,
    DATABASE_UNAVAILABLE_MESSAGE,
    close_pool,
    get_pool,
    run_migrations,
    select_one,
)
from routers.products import encrypt_stored_smtp_passwords
from routers.workflows import fail_interrupted_workflows
from services import field_crypto, jobs
from services.auth import decode_token

logger = logging.getLogger(__name__)

# Import routers
from routers.auth import router as auth_router
from routers.events import router as events_router
from routers.extras import (
    brands_router,
    calendar_router,
    captures_router,
    settings_router,
    templates_router,
)
from routers.organisations import invitations_router
from routers.organisations import router as organisations_router
from routers.products import router as products_router
from routers.queue import email_router
from routers.queue import router as queue_router
from routers.workflows import router as workflows_router

# Frontend dist directory (built by Dockerfile)
STATIC_DIR = Path(__file__).parent / "static"


# Content Security Policy for everything the app serves. Inline styles are allowed because React
# style attributes and Radix need them; scripts only ever come from this origin.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)
PUBLIC_INVITATION = re.compile(r"/api/invitations/[^/]+")
PUBLIC_INVITATION_REGISTRATION = re.compile(r"/api/invitations/[^/]+/register")
PUBLIC_PASSWORD_RESET = re.compile(r"/api/auth/password-reset/[^/]+")
# Swagger UI and ReDoc load their scripts from a CDN, so debug-mode docs pages are left without a CSP.
DOCS_PATHS = ("/docs", "/redoc")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: check settings, migrate the database, encrypt legacy secrets, fail interrupted operations.
    Shutdown: close the DB pool."""
    check_startup_settings(get_settings())
    field_crypto.check_key()
    try:
        await asyncio.wait_for(get_pool(), timeout=30)
    except (*DATABASE_UNAVAILABLE_ERRORS, RuntimeError):
        logger.exception(
            "The database isn't reachable, so migrations didn't run. The app will start anyway; "
            "restart it once the database is available."
        )
    else:
        # Errors propagate: a failed migration stops the app from starting rather than serving a
        # half-migrated schema. Pending migrations run in one transaction, so none of them applied.
        await run_migrations()
        logger.info("Database migrations are up to date")
        try:
            encrypted = await encrypt_stored_smtp_passwords()
            if encrypted:
                logger.info("Encrypted %d SMTP passwords stored before encryption at rest", encrypted)
            interrupted = await fail_interrupted_workflows()
            if interrupted:
                logger.warning("Marked %d operations interrupted by the restart as failed", interrupted)
        except DATABASE_UNAVAILABLE_ERRORS:
            logger.exception("Lost the database connection during startup maintenance; the app will start anyway")
    settings = get_settings()
    worker = jobs.Worker(concurrency=settings.worker_concurrency) if settings.worker_enabled else None
    if worker:
        await worker.start()
    yield
    if worker:
        await worker.stop()
    await close_pool()


def create_app() -> FastAPI:
    """Application factory."""
    cfg = get_settings()

    # The API description and its docs pages are for development only.
    app = FastAPI(
        title=cfg.app_name,
        version=cfg.app_version,
        docs_url="/docs" if cfg.debug else None,
        redoc_url="/redoc" if cfg.debug else None,
        openapi_url="/openapi.json" if cfg.debug else None,
        lifespan=lifespan,
    )

    # Middleware added later wraps middleware added earlier. From the outside in:
    # CORS (answers browser preflights) → security headers → auth.

    # Auth middleware: every /api/* route except sign-in and registration needs a valid token.
    public_api_paths = {"/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/auth/password-reset"}

    def is_public(request: Request) -> bool:
        path = request.url.path
        if not path.startswith("/api/") or path in public_api_paths:
            return True
        # An invitation link is its own credential: anyone holding one can read it or register through it
        return bool(
            (request.method == "GET" and PUBLIC_INVITATION.fullmatch(path))
            or (request.method == "POST" and PUBLIC_INVITATION_REGISTRATION.fullmatch(path))
            or PUBLIC_PASSWORD_RESET.fullmatch(path)
        )

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if is_public(request):
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        try:
            payload = decode_token(auth_header[7:])
            user_id = _uuid.UUID(str(payload["sub"]))
        except (jwt.PyJWTError, KeyError, ValueError):
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        # The app signs people out on a 401, so an unreachable database must not look like one.
        try:
            user = await select_one("users", user_id)
        except DATABASE_UNAVAILABLE_ERRORS:
            logger.exception("Database unavailable while authenticating a request")
            return JSONResponse(status_code=503, content={"detail": DATABASE_UNAVAILABLE_MESSAGE})
        if not user:
            return JSONResponse(status_code=401, content={"detail": "User not found"})
        # Disabling an account revokes access at once, not when the token expires
        if not user.get("enabled", True):
            return JSONResponse(status_code=401, content={"detail": "Account is disabled"})
        # So does changing the password: tokens from before the change stop working
        changed = user.get("password_changed_at")
        if changed and float(payload.get("iat", 0)) < datetime.fromisoformat(changed).timestamp():
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
        request.state.user = {
            "id": str(user["id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "user"),
            "created_at": str(user.get("created_at", "")),
        }
        return await call_next(request)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        if not request.url.path.startswith(DOCS_PATHS):
            response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "local-network=(), bluetooth=(), usb=(), serial=(), hid=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Cross-origin calls only from configured origins. Sign-in uses a bearer header, not cookies,
    # so credentials are never allowed.
    origins = [origin.strip() for origin in cfg.cors_origins.split(",") if origin.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "X-Org-Id"],
        )

    # Register API routers
    app.include_router(auth_router)
    app.include_router(products_router)
    app.include_router(workflows_router)
    app.include_router(queue_router)
    app.include_router(email_router)
    app.include_router(templates_router)
    app.include_router(calendar_router)
    app.include_router(captures_router)
    app.include_router(settings_router)
    app.include_router(brands_router)
    app.include_router(organisations_router)
    app.include_router(invitations_router)
    app.include_router(events_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Serve frontend static files if the build exists
    if STATIC_DIR.exists():
        # Mount static assets (JS, CSS, images)
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

        # Catch-all: serve index.html for any non-API route (SPA routing)
        static_root = STATIC_DIR.resolve()

        @app.get("/{path:path}")
        async def serve_spa(request: Request, path: str):
            # Don't intercept API routes or docs — an unmatched one is a real 404
            if path.startswith("api/") or path in ("docs", "redoc", "openapi.json"):
                return JSONResponse(status_code=404, content={"detail": "Not found"})
            # Serve a file from the build only if it is really inside the build ("../" is refused)
            file_path = (static_root / path).resolve()
            if file_path.is_relative_to(static_root) and file_path.is_file():
                return FileResponse(file_path)
            # Otherwise serve index.html (SPA client-side routing)
            return FileResponse(static_root / "index.html")
    else:
        @app.get("/")
        async def root():
            return {
                "app": cfg.app_name,
                "version": cfg.app_version,
                "status": "running",
                "docs": "/docs" if cfg.debug else None,
                "note": "Frontend not built yet. Run the Dockerfile to build.",
            }

    return app


app = create_app()
