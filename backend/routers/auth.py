"""Authentication routes — register, login, profile, admin."""

import hashlib
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import asyncpg
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from config import get_settings
from database import (
    _row_to_dict,
    get_config,
    get_pool,
    select,
    select_one,
    set_config,
    update,
)
from models import LoginRequest, NewPassword, PasswordResetRequest, RegisterRequest
from services import access, audit, mailer, ratelimit
from services.auth import create_token, hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt ignores everything after the first 72 bytes


def _check_new_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            400, f"Password must be at most {MAX_PASSWORD_BYTES} bytes (about 72 letters, fewer with accents or emoji)",
        )


# ─── Sessions (docs/PHASE1_DESIGN.md D7) ───

REFRESH_COOKIE = "launchops_refresh"
COOKIE_PATH = "/api/auth"
# Two tabs can refresh with the same token at nearly the same moment; after this, reuse means a copied token
REUSE_GRACE = timedelta(seconds=30)
SESSION_ENDED = "Your session has ended. Sign in again."


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _issue_refresh_token(conn, request: Request, response: Response, user_id: uuid.UUID, family_id: uuid.UUID) -> None:
    token = secrets.token_urlsafe(48)
    days = get_settings().refresh_token_days
    await conn.execute(
        "INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent) VALUES ($1, $2, $3, $4, $5)",
        user_id, family_id, _hash(token), datetime.now(UTC) + timedelta(days=days), request.headers.get("user-agent", "")[:300],
    )
    response.set_cookie(
        REFRESH_COOKIE, token, max_age=days * 24 * 3600, path=COOKIE_PATH,
        httponly=True, samesite="strict", secure=request.url.scheme == "https",
    )


async def start_session(request: Request, response: Response, user: dict) -> str:
    """A new sign-in: sets a refresh cookie (a new token family) and returns an access token."""
    pool = await get_pool()
    await _issue_refresh_token(pool, request, response, uuid.UUID(str(user["id"])), uuid.uuid4())
    return create_token(str(user["id"]), user["email"])


def _session_ended(request: Request, detail: str = SESSION_ENDED) -> JSONResponse:
    response = JSONResponse({"detail": detail}, status_code=401)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, httponly=True, samesite="strict", secure=request.url.scheme == "https")
    return response


async def _revoke_sessions(conn, user_id: uuid.UUID) -> None:
    await conn.execute("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", user_id)


def _organisation_name(name: str, email: str) -> str:
    return f"{name.strip() or email.split('@')[0]}'s organisation"


async def _create_account(email: str, password: str, name: str, role: str) -> dict:
    """A new user, the organisation they own, and its settings, created together (409 if the email is taken)."""
    pool = await get_pool()
    try:
        async with pool.acquire() as conn, conn.transaction():
            user = await conn.fetchrow(
                "INSERT INTO users (email, password_hash, name, role, enabled) VALUES ($1, $2, $3, $4, true) RETURNING *",
                email, hash_password(password), name, role,
            )
            org_id = await conn.fetchval(
                "INSERT INTO organisations (name) VALUES ($1) RETURNING id", _organisation_name(name, email),
            )
            await conn.execute("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')", org_id, user["id"])
            await conn.execute(
                "INSERT INTO settings (org_id, user_id, platforms, brand, prefs) VALUES ($1, $2, '{}', '{}', '{}')",
                org_id, user["id"],
            )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "An account with this email already exists") from None
    return _row_to_dict(user)


async def _public_user(user: dict) -> dict:
    return {
        "id": str(user["id"]), "email": user["email"],
        "name": user.get("name", ""), "role": user.get("role", "user"),
        "organisations": [m.as_dict() for m in await access.memberships_of(str(user["id"]))],
    }


@lru_cache
def _unknown_account_hash() -> str:
    """A throwaway hash, so signing in to an unknown email costs the same password check as a real one."""
    return hash_password("no account has this password")


@router.post("/register")
async def register(data: RegisterRequest, request: Request, response: Response) -> dict:
    """Create a new user account."""
    ratelimit.enforce(
        ratelimit.NEW_ACCOUNTS_PER_ADDRESS,
        ratelimit.client_address(request),
        "Too many new accounts from this network. Try again in {minutes} minutes.",
    )
    if not data.email or not data.password:
        raise HTTPException(400, "Email and password are required")
    _check_new_password(data.password)

    # Check if registration is enabled (global app_config setting; unset means enabled)
    if not await get_config("registration_enabled", True):
        raise HTTPException(403, "Registration is currently disabled")

    # Check if email already exists
    existing = await select("users", {"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    # The first account is the platform admin. With ADMIN_EMAIL set, only that address can create it, so a new
    # deployment can't be claimed by whoever reaches it first.
    email = data.email.lower().strip()
    all_users = await select("users", limit=1)
    admin_email = get_settings().admin_email.lower().strip()
    if not all_users and admin_email and email != admin_email:
        raise HTTPException(
            403, "LaunchOps isn't set up yet. The first account, which administers it, has to use the administrator's email address.",
        )
    role = "admin" if not all_users else "user"

    user = await _create_account(email, data.password, data.name.strip(), role)
    token = await start_session(request, response, user)
    return {"token": token, "user": await _public_user(user)}


@router.post("/login")
async def login(data: LoginRequest, request: Request, response: Response) -> dict:
    """Authenticate and return a JWT token."""
    email = data.email.lower().strip()
    message = "Too many sign-in attempts. Try again in {minutes} minutes."
    ratelimit.enforce(ratelimit.SIGN_IN_PER_ADDRESS, ratelimit.client_address(request), message)
    ratelimit.enforce(ratelimit.SIGN_IN_PER_ACCOUNT, email, message)

    users = await select("users", {"email": email})
    if not users:
        verify_password(data.password, _unknown_account_hash())
        raise HTTPException(401, "Invalid email or password")

    user = users[0]
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    if not user.get("enabled", True):
        raise HTTPException(403, "Account is disabled. Contact an administrator.")

    token = await start_session(request, response, user)
    return {"token": token, "user": await _public_user(user)}


@router.post("/refresh")
async def refresh_session(request: Request, response: Response):
    """Exchange the refresh cookie for a new one and a new access token (public: the cookie is the credential)."""
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        return _session_ended(request)
    now = datetime.now(UTC)
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            "SELECT r.id, r.user_id, r.family_id, r.expires_at, r.used_at, r.revoked_at, u.email, u.name, u.role, u.enabled, "
            # The database compares its own NOW() with the used_at it wrote itself: this app runs on
            # another machine, and a few seconds of clock skew must not decide whether a replay is caught.
            "r.used_at < NOW() - $2::interval AS reused "
            "FROM refresh_tokens r JOIN users u ON u.id = r.user_id WHERE r.token_hash = $1 FOR UPDATE OF r",
            _hash(token),
            REUSE_GRACE,
        )
        if not row or row["revoked_at"] or row["expires_at"] <= now or not row["enabled"]:
            return _session_ended(request)
        if row["reused"]:
            # A rotated token came back: someone else has a copy. End every session from that sign-in.
            await conn.execute(
                "UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL", row["family_id"],
            )
            logger.warning("A reused refresh token ended the sessions of user %s", row["user_id"])
            revoked = True
        else:
            revoked = False
            if not row["used_at"]:
                await conn.execute("UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1", row["id"])
            await _issue_refresh_token(conn, request, response, row["user_id"], row["family_id"])
    if revoked:
        return _session_ended(request)
    user = {"id": str(row["user_id"]), "email": row["email"], "name": row["name"], "role": row["role"]}
    return {"token": create_token(user["id"], user["email"]), "user": await _public_user(user)}


@router.post("/logout")
async def logout(request: Request) -> JSONResponse:
    """End this browser's session: its refresh token family is revoked and the cookie removed (public)."""
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        pool = await get_pool()
        await pool.execute(
            "UPDATE refresh_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL AND family_id = "
            "(SELECT family_id FROM refresh_tokens WHERE token_hash = $1)",
            _hash(token),
        )
    response = JSONResponse({"status": "signed_out"})
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, httponly=True, samesite="strict", secure=request.url.scheme == "https")
    return response


# ─── Password reset (docs/PHASE1_DESIGN.md D8) ───

RESET_LINK_LIFETIME = timedelta(hours=1)
ADMIN_RESET_LINK_LIFETIME = timedelta(hours=24)
INVALID_RESET_LINK = "This reset link has expired or has already been used. Ask for a new one."


async def _create_reset_link(user_id: uuid.UUID, created_by: uuid.UUID | None, lifetime: timedelta) -> tuple[str, datetime]:
    """A new one-time link for the user; any earlier unused link stops working."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + lifetime
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute("DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL", user_id)
        await conn.execute(
            "INSERT INTO password_resets (user_id, token_hash, created_by, expires_at) VALUES ($1, $2, $3, $4)",
            user_id, _hash(token), created_by, expires_at,
        )
    return f"/reset-password/{token}", expires_at


async def _valid_reset(conn, token: str, *, lock: bool = False) -> asyncpg.Record:
    row = await conn.fetchrow(
        "SELECT p.id, p.user_id, u.email, u.name, u.role FROM password_resets p JOIN users u ON u.id = p.user_id "
        f"WHERE p.token_hash = $1 AND p.used_at IS NULL AND p.expires_at > NOW() AND u.enabled{' FOR UPDATE OF p' if lock else ''}",
        _hash(token),
    )
    if not row:
        raise HTTPException(404, INVALID_RESET_LINK)
    return row


@router.post("/password-reset", status_code=202)
async def request_password_reset(data: PasswordResetRequest, request: Request, background_tasks: BackgroundTasks) -> dict:
    """Email a reset link if the address has an account (public). The answer is the same either way."""
    email = data.email.strip().lower()
    ratelimit.enforce(
        ratelimit.PASSWORD_RESETS_PER_ADDRESS, ratelimit.client_address(request),
        "Too many reset requests from this network. Try again in {minutes} minutes.",
    )
    ratelimit.enforce(
        ratelimit.PASSWORD_RESETS_PER_ACCOUNT, email,
        "Too many reset requests for this email address. Try again in {minutes} minutes.",
    )
    if not mailer.configured():
        logger.warning(
            "A password reset was requested, but no mail server is configured to send the link "
            "(set APP_URL and MAIL_*). Administrators can create reset links in Team & access."
        )
        return {"status": "requested"}
    users = await select("users", {"email": email}, limit=1)
    if users and users[0].get("enabled", True):
        path, _ = await _create_reset_link(uuid.UUID(str(users[0]["id"])), None, RESET_LINK_LIFETIME)
        body = (
            f"Someone asked to reset the password for the LaunchOps account {email}.\n\n"
            f"Choose a new password here. The link expires in 1 hour and works once:\n{mailer.link(path)}\n\n"
            "If you didn't ask for this, ignore this email. Your password stays the same."
        )
        # Sending takes seconds; in the background, the answer takes as long for unknown addresses as for known ones
        background_tasks.add_task(mailer.send, email, "Reset your LaunchOps password", body)
    return {"status": "requested"}


@router.get("/password-reset/{token}")
async def describe_password_reset(token: str) -> dict:
    """The account a reset link is for (public: the link is the credential)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await _valid_reset(conn, token)
    return {"email": row["email"]}


@router.post("/password-reset/{token}")
async def complete_password_reset(token: str, data: NewPassword, request: Request, response: Response) -> dict:
    """Set a new password from a reset link, sign out everywhere else, and sign in here (public)."""
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        row = await _valid_reset(conn, token, lock=True)
        _check_new_password(data.password)
        # The app's clock, not the database's: access tokens are stamped with the app's clock too
        await conn.execute(
            "UPDATE users SET password_hash = $1, password_changed_at = $2, updated_at = NOW() WHERE id = $3",
            hash_password(data.password), datetime.now(UTC), row["user_id"],
        )
        await conn.execute("UPDATE password_resets SET used_at = NOW() WHERE id = $1", row["id"])
        await _revoke_sessions(conn, row["user_id"])
    user = {"id": str(row["user_id"]), "email": row["email"], "name": row["name"], "role": row["role"]}
    await audit.record(None, user, "account.password_reset", f"Reset the password of {user['email']} with a reset link",
                       target_type="user", target_id=user["id"])
    token_for_this_device = await start_session(request, response, user)
    return {"token": token_for_this_device, "user": await _public_user(user)}


@router.get("/me")
async def get_profile(request: Request) -> dict:
    """The signed-in user's profile and organisations. The auth middleware has already checked the token and the account."""
    return {**request.state.user, **await _public_user(request.state.user)}


# ─── Admin routes (protected by middleware, require admin role) ───


async def _require_admin(request: Request):
    """Check that the current user is an admin."""
    user = getattr(request.state, "user", None)
    if not user or user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")


@router.get("/admin/users")
async def list_users(request: Request) -> list:
    """List all users. Admin only."""
    await _require_admin(request)
    users = await select("users", order="created_at")
    return [{
        "id": str(u["id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "user"),
        "enabled": u.get("enabled", True),
        "created_at": str(u.get("created_at", "")),
    } for u in users]


@router.post("/admin/users")
async def admin_create_user(data: RegisterRequest, request: Request) -> dict:
    """Create a user account (admin). Bypasses registration toggle."""
    await _require_admin(request)

    if not data.email or not data.password:
        raise HTTPException(400, "Email and password are required")
    _check_new_password(data.password)

    existing = await select("users", {"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    user = await _create_account(data.email.lower().strip(), data.password, data.name.strip(), "user")
    await audit.record(None, request.state.user, "admin.user_created", f"Created the account {user['email']}",
                       target_type="user", target_id=str(user["id"]))
    return {
        "id": str(user["id"]), "email": user["email"],
        "name": user["name"], "role": user["role"], "enabled": True,
    }


@router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, request: Request) -> dict:
    """Update user enabled/role status. Admin only."""
    await _require_admin(request)
    # Unknown (or malformed) ids are a 404, not a KeyError on an empty update result
    if not await select_one("users", user_id):
        raise HTTPException(404, "User not found")
    body = await request.json()

    allowed = {}
    if "enabled" in body:
        allowed["enabled"] = bool(body["enabled"])
    if "role" in body:
        if body["role"] not in ("admin", "user"):
            raise HTTPException(400, "Role must be 'admin' or 'user'")
        allowed["role"] = body["role"]

    if not allowed:
        raise HTTPException(400, "Nothing to update")

    result = await update("users", user_id, allowed)
    if allowed.get("enabled") is False:
        pool = await get_pool()
        await _revoke_sessions(pool, uuid.UUID(user_id))
    await audit.record(None, request.state.user, "admin.user_updated",
                       f"Changed the account {result['email']}: " + ", ".join(f"{k} = {v}" for k, v in allowed.items()),
                       target_type="user", target_id=user_id)
    return {
        "id": str(result["id"]), "email": result["email"],
        "name": result.get("name", ""), "role": result.get("role", "user"),
        "enabled": result.get("enabled", True),
    }


@router.post("/admin/users/{user_id}/reset-link", status_code=201)
async def admin_create_reset_link(user_id: str, request: Request) -> dict:
    """A one-time link that lets the person choose a new password (Admin only). Share it with them directly."""
    await _require_admin(request)
    target = await select_one("users", user_id)
    if not target:
        raise HTTPException(404, "User not found")
    path, expires_at = await _create_reset_link(uuid.UUID(user_id), uuid.UUID(request.state.user["id"]), ADMIN_RESET_LINK_LIFETIME)
    await audit.record(None, request.state.user, "admin.reset_link_created", f"Created a password reset link for {target['email']}",
                       target_type="user", target_id=user_id)
    return {"link": path, "expires_at": expires_at.isoformat()}


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, request: Request) -> dict:
    """Delete a user account. Admin only.

    Organisations the user was the only member of go with the account. In organisations shared with
    others, what the user created stays (with no creator).
    """
    await _require_admin(request)
    current = getattr(request.state, "user", {})
    if current.get("id") == user_id:
        raise HTTPException(400, "Cannot delete your own account")
    doomed = await select_one("users", user_id)
    if not doomed:
        raise HTTPException(404, "User not found")
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            """
            DELETE FROM organisations o
            WHERE o.id IN (SELECT org_id FROM memberships WHERE user_id = $1)
              AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = o.id AND m.user_id <> $1)
            """,
            uuid.UUID(user_id),
        )
        await conn.execute("DELETE FROM users WHERE id = $1", uuid.UUID(user_id))
    await audit.record(None, request.state.user, "admin.user_deleted", f"Deleted the account {doomed['email']}",
                       target_type="user", target_id=user_id)
    return {"status": "deleted"}


@router.get("/admin/projects")
async def admin_list_projects(request: Request) -> list:
    """List all projects across all users. Admin only."""
    await _require_admin(request)
    products = await select("products", order="updated_at")
    users = await select("users", order="updated_at")
    user_map = {u["id"]: u.get("email", "") for u in users}
    return [{
        "id": str(p["id"]), "name": p.get("name", ""),
        "user_id": p.get("user_id", ""),
        "user_email": user_map.get(p.get("user_id", ""), "unassigned"),
        "status": p.get("status", ""),
        "url": p.get("url", ""),
    } for p in products]


@router.post("/admin/transfer-project")
async def admin_transfer_project(request: Request) -> dict:
    """Move a project, with its results, drafts, ideas and calendar entries, into another user's own organisation. Admin only."""
    await _require_admin(request)
    body = await request.json()
    product_id = body.get("product_id")
    target_user_id = body.get("target_user_id")
    if not product_id or not target_user_id:
        raise HTTPException(400, "product_id and target_user_id required")

    product = await select_one("products", product_id)
    if not product:
        raise HTTPException(404, "Project not found")

    target_user = await select_one("users", target_user_id)
    if not target_user:
        raise HTTPException(404, "Target user not found")
    target_org = next((m for m in await access.memberships_of(target_user_id) if m.role == "owner"), None)
    if not target_org:
        raise HTTPException(400, "The target user doesn't own an organisation to move the project into")

    pool = await get_pool()
    tid, pid, oid = uuid.UUID(target_user_id), uuid.UUID(product_id), uuid.UUID(target_org.org_id)
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute("UPDATE products SET user_id = $1, org_id = $2 WHERE id = $3", tid, oid, pid)
        for table in ("queue", "captures", "calendar_events", "email_queue"):
            await conn.execute(f"UPDATE {table} SET user_id = $1, org_id = $2 WHERE product_id = $3", tid, oid, pid)
    name = product.get("name", "")
    if product.get("org_id"):
        await audit.record(product["org_id"], request.state.user, "project.transferred",
                           f"Moved the project {name} to {target_user['email']}'s organisation",
                           target_type="project", target_id=product_id)
    await audit.record(target_org.org_id, request.state.user, "project.transferred",
                       f"Received the project {name} from another organisation", target_type="project", target_id=product_id)

    return {
        "status": "transferred",
        "product": product.get("name"),
        "from_user": product.get("user_id"),
        "to_user": target_user_id,
    }


@router.get("/admin/registration")
async def get_registration_status(request: Request) -> dict:
    """Get registration enabled status. Admin only."""
    await _require_admin(request)
    return {"registration_enabled": bool(await get_config("registration_enabled", True))}


@router.put("/admin/registration")
async def set_registration_status(request: Request) -> dict:
    """Toggle registration on/off. Admin only."""
    await _require_admin(request)
    body = await request.json()
    enabled = bool(body.get("registration_enabled", True))
    await set_config("registration_enabled", enabled)
    await audit.record(None, request.state.user, "admin.registration_changed",
                       "Opened registration" if enabled else "Closed registration")
    return {"registration_enabled": enabled}
