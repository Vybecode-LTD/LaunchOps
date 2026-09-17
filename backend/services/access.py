"""Organisation membership and roles: whose data a request can reach, and what it may change.

See docs/PHASE1_DESIGN.md (D2–D4). A request works in one organisation: the one named by the
X-Org-Id header, or else the signed-in user's first (owner memberships first). Roles form a ladder,
each including the ones below it: viewer → editor → approver → owner.

A resource in an organisation the user doesn't belong to answers 404, so its existence isn't
revealed; a role that's too low answers 403.
"""

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, Request

from database import get_pool, select_one

ROLES = ("viewer", "editor", "approver", "owner")
ROLE_NAMES = {"viewer": "Viewer", "editor": "Editor", "approver": "Approver", "owner": "Owner"}
_RANK = {role: rank for rank, role in enumerate(ROLES)}
ORG_HEADER = "x-org-id"


def role_includes(role: str, minimum: str) -> bool:
    """Whether `role` can do everything `minimum` can."""
    return _RANK[role] >= _RANK[minimum]


@dataclass(frozen=True)
class Membership:
    org_id: str
    org_name: str
    user_id: str
    role: str

    def has(self, minimum: str) -> bool:
        return role_includes(self.role, minimum)

    def as_dict(self) -> dict:
        return {"id": self.org_id, "name": self.org_name, "role": self.role}


async def memberships_of(user_id: str) -> list[Membership]:
    """Every organisation the user belongs to: owner memberships first, then by when they joined."""
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT m.org_id, o.name, m.user_id, m.role
        FROM memberships m JOIN organisations o ON o.id = m.org_id
        WHERE m.user_id = $1
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'approver' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END,
                 m.created_at, o.name
        """,
        user_id,
    )
    return [Membership(str(row["org_id"]), row["name"], str(row["user_id"]), row["role"]) for row in rows]


async def membership(request: Request, minimum: str = "viewer") -> Membership:
    """The signed-in user's membership in the request's organisation, with at least the `minimum` role."""
    current = getattr(request.state, "membership", None)
    if current is None:
        current = await _resolve(request)
        request.state.membership = current
    ensure(current, minimum)
    return current


def ensure(current: Membership, minimum: str) -> None:
    """403 unless the membership's role is at least `minimum`."""
    if not current.has(minimum):
        raise HTTPException(
            403,
            f"You need the {ROLE_NAMES[minimum]} role in {current.org_name} to do this. Ask an owner of the organisation.",
        )


async def _resolve(request: Request) -> Membership:
    user_id = request.state.user["id"]
    memberships = await memberships_of(user_id)
    requested = request.headers.get(ORG_HEADER, "").strip()
    if requested:
        try:
            requested = str(uuid.UUID(requested))
        except ValueError:
            raise HTTPException(404, "Organisation not found") from None
        for candidate in memberships:
            if candidate.org_id == requested:
                return candidate
        raise HTTPException(404, "Organisation not found")
    if not memberships:
        raise HTTPException(403, "You aren't a member of any organisation. Ask an owner to invite you.")
    return memberships[0]


async def load(current: Membership, table: str, row_id: str, not_found: str) -> dict:
    """A row of `table` in the membership's organisation, or 404 with `not_found`."""
    row = await select_one(table, row_id)
    if not row or str(row.get("org_id") or "") != current.org_id:
        raise HTTPException(404, not_found)
    return row


def in_org(row: dict | None, current: Membership) -> bool:
    return bool(row) and str(row.get("org_id") or "") == current.org_id
