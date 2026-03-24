"""Authentication routes — register, login, profile."""

from fastapi import APIRouter, HTTPException, Request
from models import RegisterRequest, LoginRequest
from database import insert, select
from services.auth import hash_password, verify_password, create_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(data: RegisterRequest) -> dict:
    """Create a new user account."""
    if not data.email or not data.password:
        raise HTTPException(400, "Email and password are required")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    # Check if email already exists
    existing = await select("users", {"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(409, "An account with this email already exists")

    # Create user
    user = await insert("users", {
        "email": data.email.lower().strip(),
        "password_hash": hash_password(data.password),
        "name": data.name.strip(),
    })

    token = create_token(str(user["id"]), user["email"])
    return {
        "token": token,
        "user": {"id": str(user["id"]), "email": user["email"], "name": user["name"]},
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

    token = create_token(str(user["id"]), user["email"])
    return {
        "token": token,
        "user": {"id": str(user["id"]), "email": user["email"], "name": user.get("name", "")},
    }


@router.get("/me")
async def get_profile(request: Request) -> dict:
    """Get the current user's profile. Requires valid JWT."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user
