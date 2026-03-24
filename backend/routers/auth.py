"""Authentication routes — register, login, profile, admin."""

from fastapi import APIRouter, HTTPException, Request
from models import RegisterRequest, LoginRequest
from database import insert, select, select_one, update, delete
from services.auth import hash_password, verify_password, create_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(data: RegisterRequest) -> dict:
    """Create a new user account."""
    if not data.email or not data.password:
        raise HTTPException(400, "Email and password are required")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    # Check if registration is enabled
    settings_row = await select_one("settings", 1, id_col="id")
    if settings_row and not settings_row.get("registration_enabled", True):
        raise HTTPException(403, "Registration is currently disabled")

    # Check if email already exists
    existing = await select("users", {"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    # First user gets admin role
    all_users = await select("users")
    role = "admin" if not all_users else "user"

    # Create user
    user = await insert("users", {
        "email": data.email.lower().strip(),
        "password_hash": hash_password(data.password),
        "name": data.name.strip(),
        "role": role,
        "enabled": True,
    })

    token = create_token(str(user["id"]), user["email"])
    return {
        "token": token,
        "user": {
            "id": str(user["id"]), "email": user["email"],
            "name": user["name"], "role": user["role"],
        },
    }


@router.post("/login")
async def login(data: LoginRequest) -> dict:
    """Authenticate and return a JWT token."""
    users = await select("users", {"email": data.email.lower().strip()})
    if not users:
        raise HTTPException(401, "Invalid email or password")

    user = users[0]
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    if not user.get("enabled", True):
        raise HTTPException(403, "Account is disabled. Contact an administrator.")

    token = create_token(str(user["id"]), user["email"])
    return {
        "token": token,
        "user": {
            "id": str(user["id"]), "email": user["email"],
            "name": user.get("name", ""), "role": user.get("role", "user"),
        },
    }


@router.get("/me")
async def get_profile(request: Request) -> dict:
    """Get the current user's profile. Requires valid JWT."""
    import logging
    import uuid as _uuid
    logger = logging.getLogger(__name__)

    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")

    token = auth_header[7:]
    try:
        payload = decode_token(token)
    except Exception as e:
        logger.error(f"/me: token decode failed: {e}")
        raise HTTPException(401, "Invalid or expired token")

    user_id_str = payload.get("sub", "")
    logger.info(f"/me: decoded token for user_id={user_id_str}")

    try:
        user_id = _uuid.UUID(user_id_str)
    except (ValueError, AttributeError) as e:
        logger.error(f"/me: UUID conversion failed: {e}")
        raise HTTPException(401, "Invalid token payload")

    user = await select_one("users", user_id)
    if not user:
        # Fallback: try string-based lookup
        logger.warning(f"/me: select_one with UUID returned None, trying string lookup")
        users_by_email = await select("users", {"email": payload.get("email", "")})
        user = users_by_email[0] if users_by_email else None

    if not user:
        logger.error(f"/me: user not found for id={user_id_str}")
        raise HTTPException(401, "User not found")

    logger.info(f"/me: found user email={user.get('email')} role={user.get('role')} keys={list(user.keys())}")
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "created_at": str(user.get("created_at", "")),
    }


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
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await select("users", {"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    user = await insert("users", {
        "email": data.email.lower().strip(),
        "password_hash": hash_password(data.password),
        "name": data.name.strip(),
        "role": "user",
        "enabled": True,
    })
    return {
        "id": str(user["id"]), "email": user["email"],
        "name": user["name"], "role": user["role"], "enabled": True,
    }


@router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, request: Request) -> dict:
    """Update user enabled/role status. Admin only."""
    await _require_admin(request)
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
    return {
        "id": str(result["id"]), "email": result["email"],
        "name": result.get("name", ""), "role": result.get("role", "user"),
        "enabled": result.get("enabled", True),
    }


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, request: Request) -> dict:
    """Delete a user account. Admin only."""
    await _require_admin(request)
    current = getattr(request.state, "user", {})
    if current.get("id") == user_id:
        raise HTTPException(400, "Cannot delete your own account")
    await delete("users", user_id)
    return {"status": "deleted"}


@router.get("/admin/registration")
async def get_registration_status(request: Request) -> dict:
    """Get registration enabled status. Admin only."""
    await _require_admin(request)
    settings_row = await select_one("settings", 1, id_col="id")
    return {"registration_enabled": settings_row.get("registration_enabled", True) if settings_row else True}


@router.put("/admin/registration")
async def set_registration_status(request: Request) -> dict:
    """Toggle registration on/off. Admin only."""
    await _require_admin(request)
    body = await request.json()
    enabled = bool(body.get("registration_enabled", True))
    await update("settings", 1, {"registration_enabled": enabled}, id_col="id")
    return {"registration_enabled": enabled}
