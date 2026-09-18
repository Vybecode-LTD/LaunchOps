"""The organisation itself: its name, members and roles, invitations and activity log.

`/api/organisation` acts on the request's organisation (services/access.py). `/api/invitations/{token}`
serves invitation links: anyone holding one can see it and create an account through it (both public),
and a signed-in user with the invited address can accept it.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import asyncpg
from fastapi import APIRouter, HTTPException, Query, Request, Response

from database import get_pool
from models import (
    BudgetUpdate,
    InvitationCreate,
    InvitationRegistration,
    MemberRoleUpdate,
    OrganisationUpdate,
)
from routers.auth import _check_new_password, _public_user, start_session
from services import access, audit, mailer, ratelimit, usage
from services.access import ROLE_NAMES
from services.auth import hash_password
from services.email import EMAIL_ADDRESS

router = APIRouter(prefix="/api/organisation", tags=["organisation"])
invitations_router = APIRouter(prefix="/api/invitations", tags=["invitations"])

INVITATION_LIFETIME = timedelta(days=7)
LAST_OWNER = "An organisation needs at least one owner. Make someone else an owner first."
INVALID_INVITATION = "This invitation has expired, was withdrawn or has been used. Ask for a new one."
ROLE_ORDER = "CASE m.role WHEN 'owner' THEN 0 WHEN 'approver' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END"
PENDING = "i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()"


def _with_article(word: str) -> str:
    return f"{'an' if word[:1] in 'AEIOU' else 'a'} {word}"


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _uuid_or_404(value: str, message: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(404, message) from None


# ─── The organisation ───


@router.get("")
async def get_organisation(request: Request) -> dict:
    """The request's organisation and the signed-in user's role in it."""
    return (await access.membership(request)).as_dict()


@router.patch("")
async def rename_organisation(data: OrganisationUpdate, request: Request) -> dict:
    """Rename the organisation (Owner)."""
    current = await access.membership(request, "owner")
    name = data.name.strip()
    if not name:
        raise HTTPException(422, "The organisation needs a name.")
    pool = await get_pool()
    await pool.execute(
        "UPDATE organisations SET name = $1, updated_at = NOW() WHERE id = $2", name, uuid.UUID(current.org_id),
    )
    if name != current.org_name:
        await audit.record(
            current.org_id, request.state.user, "organisation.renamed",
            f"Renamed the organisation from {audit.quoted(current.org_name)} to {audit.quoted(name)}",
        )
    return {"id": current.org_id, "name": name, "role": current.role}


# ─── Members ───


@router.get("/members")
async def list_members(request: Request) -> list[dict]:
    """Everyone in the organisation, owners first."""
    current = await access.membership(request)
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT m.user_id, u.name, u.email, m.role, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id "
        f"WHERE m.org_id = $1 ORDER BY {ROLE_ORDER}, m.created_at",
        uuid.UUID(current.org_id),
    )
    return [
        {"user_id": str(r["user_id"]), "name": r["name"], "email": r["email"], "role": r["role"],
         "joined_at": r["created_at"].isoformat()}
        for r in rows
    ]


async def _lock_member(conn: asyncpg.Connection, org_id: str, user_id: uuid.UUID) -> tuple[asyncpg.Record, int]:
    """The member's row and the organisation's owner count, with the owners locked so two changes can't both
    remove the last owner."""
    owners = await conn.fetch(
        "SELECT user_id FROM memberships WHERE org_id = $1 AND role = 'owner' FOR UPDATE", uuid.UUID(org_id),
    )
    member = await conn.fetchrow(
        "SELECT m.role, u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 AND m.user_id = $2 "
        "FOR UPDATE OF m",
        uuid.UUID(org_id), user_id,
    )
    if not member:
        raise HTTPException(404, "Member not found")
    return member, len(owners)


@router.patch("/members/{user_id}")
async def change_member_role(user_id: str, data: MemberRoleUpdate, request: Request) -> dict:
    """Change a member's role (Owner). The last owner can't step down."""
    current = await access.membership(request, "owner")
    member_id = _uuid_or_404(user_id, "Member not found")
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        member, owners = await _lock_member(conn, current.org_id, member_id)
        if member["role"] == data.role:
            return {"user_id": user_id, "role": data.role}
        if member["role"] == "owner" and owners == 1:
            raise HTTPException(409, LAST_OWNER)
        await conn.execute(
            "UPDATE memberships SET role = $1 WHERE org_id = $2 AND user_id = $3", data.role, uuid.UUID(current.org_id), member_id,
        )
    await audit.record(
        current.org_id, request.state.user, "member.role_changed",
        f"Changed {member['email']} from {ROLE_NAMES[member['role']]} to {ROLE_NAMES[data.role]}",
        target_type="user", target_id=user_id,
    )
    return {"user_id": user_id, "role": data.role}


@router.delete("/members/{user_id}")
async def remove_member(user_id: str, request: Request) -> dict:
    """Remove a member (Owner), or leave the organisation yourself. The last owner can't go."""
    current = await access.membership(request)
    leaving = user_id == current.user_id
    if not leaving:
        access.ensure(current, "owner")
    member_id = _uuid_or_404(user_id, "Member not found")
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        member, owners = await _lock_member(conn, current.org_id, member_id)
        if member["role"] == "owner" and owners == 1:
            raise HTTPException(409, LAST_OWNER)
        await conn.execute("DELETE FROM memberships WHERE org_id = $1 AND user_id = $2", uuid.UUID(current.org_id), member_id)
    if leaving:
        await audit.record(current.org_id, request.state.user, "member.left", "Left the organisation",
                           target_type="user", target_id=user_id)
    else:
        await audit.record(current.org_id, request.state.user, "member.removed",
                           f"Removed {member['email']} from the organisation", target_type="user", target_id=user_id)
    return {"deleted": True}


# ─── Invitations (Owner) ───


@router.get("/invitations")
async def list_invitations(request: Request) -> list[dict]:
    """Invitations waiting to be accepted."""
    current = await access.membership(request, "owner")
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT i.id, i.email, i.role, u.name AS invited_by, i.created_at, i.expires_at FROM invitations i "
        f"LEFT JOIN users u ON u.id = i.invited_by WHERE i.org_id = $1 AND {PENDING} ORDER BY i.created_at DESC",
        uuid.UUID(current.org_id),
    )
    return [_invitation(row) for row in rows]


def _invitation(row: asyncpg.Record, link: str | None = None) -> dict:
    invitation = {
        "id": str(row["id"]), "email": row["email"], "role": row["role"], "invited_by": row["invited_by"] or "",
        "created_at": row["created_at"].isoformat(), "expires_at": row["expires_at"].isoformat(),
    }
    if link:
        invitation["link"] = link
    return invitation


@router.post("/invitations", status_code=201)
async def create_invitation(data: InvitationCreate, request: Request) -> dict:
    """Invite someone by email. The link is returned once; inviting the same address again replaces it."""
    current = await access.membership(request, "owner")
    email = data.email.strip().lower()
    if not EMAIL_ADDRESS.fullmatch(email):
        raise HTTPException(422, "Enter a valid email address.")
    org_id = uuid.UUID(current.org_id)
    token = secrets.token_urlsafe(32)
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        if await conn.fetchval(
            "SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 AND u.email = $2", org_id, email,
        ):
            raise HTTPException(409, f"{email} is already a member of this organisation.")
        await conn.execute(
            f"UPDATE invitations i SET revoked_at = NOW() WHERE i.org_id = $1 AND i.email = $2 AND {PENDING}", org_id, email,
        )
        row = await conn.fetchrow(
            "INSERT INTO invitations (org_id, email, role, token_hash, invited_by, expires_at) "
            "VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, created_at, expires_at",
            org_id, email, data.role, _token_hash(token), uuid.UUID(current.user_id), datetime.now(UTC) + INVITATION_LIFETIME,
        )
    await audit.record(
        current.org_id, request.state.user, "invitation.created", f"Invited {email} as {ROLE_NAMES[data.role]}",
        target_type="invitation", target_id=str(row["id"]),
    )
    inviter = request.state.user.get("name") or request.state.user["email"]
    link = f"/invite/{token}"
    emailed = await mailer.send(
        email,
        f"{inviter} invited you to {current.org_name} on LaunchOps",
        f"{inviter} invited you to join {current.org_name} on LaunchOps as {_with_article(ROLE_NAMES[data.role])}.\n\n"
        f"Accept the invitation here. The link works once, until {row['expires_at']:%d %B %Y}:\n{mailer.link(link)}\n\n"
        "If you weren't expecting this, you can ignore this email.",
    )
    return {**_invitation({**dict(row), "invited_by": request.state.user.get("name", "")}, link=link), "emailed": emailed}


@router.delete("/invitations/{invitation_id}")
async def withdraw_invitation(invitation_id: str, request: Request) -> dict:
    current = await access.membership(request, "owner")
    pool = await get_pool()
    email = await pool.fetchval(
        f"UPDATE invitations i SET revoked_at = NOW() WHERE i.id = $1 AND i.org_id = $2 AND {PENDING} RETURNING i.email",
        _uuid_or_404(invitation_id, "Invitation not found"), uuid.UUID(current.org_id),
    )
    if not email:
        raise HTTPException(404, "Invitation not found")
    await audit.record(current.org_id, request.state.user, "invitation.revoked", f"Withdrew the invitation for {email}",
                       target_type="invitation", target_id=invitation_id)
    return {"deleted": True}


# ─── Invitation links ───


async def _pending_invitation(conn, token: str, *, lock: bool = False) -> asyncpg.Record:
    row = await conn.fetchrow(
        f"SELECT i.id, i.org_id, i.email, i.role, i.expires_at, o.name AS organisation, u.name AS invited_by "
        f"FROM invitations i JOIN organisations o ON o.id = i.org_id LEFT JOIN users u ON u.id = i.invited_by "
        f"WHERE i.token_hash = $1 AND {PENDING}{' FOR UPDATE OF i' if lock else ''}",
        _token_hash(token),
    )
    if not row:
        raise HTTPException(404, INVALID_INVITATION)
    return row


@invitations_router.get("/{token}")
async def describe_invitation(token: str) -> dict:
    """What an invitation link offers (public: the link is the credential)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await _pending_invitation(conn, token)
        account_exists = bool(await conn.fetchval("SELECT 1 FROM users WHERE email = $1", row["email"]))
    return {
        "organisation": row["organisation"], "email": row["email"], "role": row["role"],
        "invited_by": row["invited_by"] or "", "expires_at": row["expires_at"].isoformat(), "account_exists": account_exists,
    }


async def _join(conn, invitation: asyncpg.Record, user_id: uuid.UUID) -> str:
    """Add the user to the invitation's organisation (keeping a higher role they already have) and use the invitation up."""
    existing = await conn.fetchval(
        "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", invitation["org_id"], user_id,
    )
    role = invitation["role"]
    if existing is None:
        await conn.execute(
            "INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)", invitation["org_id"], user_id, role,
        )
    elif access.role_includes(existing, role):
        role = existing
    else:
        await conn.execute(
            "UPDATE memberships SET role = $1 WHERE org_id = $2 AND user_id = $3", role, invitation["org_id"], user_id,
        )
    await conn.execute(
        "UPDATE invitations SET accepted_at = NOW(), accepted_by = $1 WHERE id = $2", user_id, invitation["id"],
    )
    return role


@invitations_router.post("/{token}/accept")
async def accept_invitation(token: str, request: Request) -> dict:
    """Join the organisation as the signed-in user, whose email must be the invited address."""
    user = request.state.user
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        invitation = await _pending_invitation(conn, token, lock=True)
        if user["email"].lower() != invitation["email"]:
            raise HTTPException(
                403, f"This invitation is for {invitation['email']}. Sign in with that email address to accept it.",
            )
        role = await _join(conn, invitation, uuid.UUID(user["id"]))
    await audit.record(
        str(invitation["org_id"]), user, "member.joined", f"Accepted the invitation and joined as {ROLE_NAMES[role]}",
        target_type="user", target_id=user["id"],
    )
    return {"id": str(invitation["org_id"]), "name": invitation["organisation"], "role": role}


@invitations_router.post("/{token}/register")
async def register_through_invitation(token: str, data: InvitationRegistration, request: Request, response: Response) -> dict:
    """Create an account for the invited address and join the organisation (public; works while registration is closed)."""
    ratelimit.enforce(
        ratelimit.NEW_ACCOUNTS_PER_ADDRESS,
        ratelimit.client_address(request),
        "Too many new accounts from this network. Try again in {minutes} minutes.",
    )
    _check_new_password(data.password)
    pool = await get_pool()
    try:
        async with pool.acquire() as conn, conn.transaction():
            invitation = await _pending_invitation(conn, token, lock=True)
            if await conn.fetchval("SELECT 1 FROM users WHERE email = $1", invitation["email"]):
                raise HTTPException(409, "An account with this email already exists. Sign in to accept the invitation.")
            user = await conn.fetchrow(
                "INSERT INTO users (email, password_hash, name, role, enabled) VALUES ($1, $2, $3, 'user', true) RETURNING *",
                invitation["email"], hash_password(data.password), data.name.strip(),
            )
            role = await _join(conn, invitation, user["id"])
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "An account with this email already exists. Sign in to accept the invitation.") from None
    public_user = {"id": str(user["id"]), "email": user["email"], "name": user["name"], "role": user["role"]}
    await audit.record(
        str(invitation["org_id"]), public_user, "member.joined",
        f"Created an account from the invitation and joined as {ROLE_NAMES[role]}", target_type="user", target_id=public_user["id"],
    )
    return {"token": await start_session(request, response, public_user), "user": await _public_user(public_user)}


# ─── Usage and budget (Owner) ───


@router.get("/usage")
async def usage_summary(request: Request, month: str | None = None) -> dict:
    """A month's AI usage and estimated cost (YYYY-MM; this month by default), with the budget."""
    current = await access.membership(request, "owner")
    try:
        start = usage.parse_month(month)
    except ValueError:
        raise HTTPException(422, "Give the month as YYYY-MM, for example 2026-09.") from None
    return await usage.summary(current.org_id, start)


@router.put("/budget")
async def set_budget(data: BudgetUpdate, request: Request) -> dict:
    """Set or clear the monthly AI budget in US dollars (Owner). Operations stop once a month's cost reaches it.

    Owners may set up to the platform default, clear their budget or lower it; only a platform admin may
    go higher: see `usage.ensure_budget_allowed`, which `usage.set_budget` applies under a row lock.
    """
    current = await access.membership(request, "owner")
    await usage.set_budget(current.org_id, data.monthly_ai_budget_usd, is_admin=request.state.user.get("role") == "admin")
    amount = data.monthly_ai_budget_usd
    await audit.record(
        current.org_id, request.state.user, "organisation.budget_changed",
        f"Set the monthly AI budget to ${amount:,.2f}" if amount is not None else "Removed the monthly AI budget",
    )
    return {"monthly_ai_budget_usd": float(amount) if amount is not None else None}


# ─── Activity log (Owner) ───


@router.get("/activity")
async def activity(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before: int | None = None,
) -> list[dict]:
    """The organisation's activity log, newest first. Pass the last entry's id as `before` for older entries."""
    current = await access.membership(request, "owner")
    return await audit.entries(current.org_id, limit, before)
