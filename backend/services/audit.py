"""The activity log: who did what to an organisation's data, and when (docs/PHASE1_DESIGN.md D14).

Summaries are written for the people reading the log. Text that came from AI output or from users
(result previews, subjects) is quoted.
"""

import uuid

from database import get_pool


async def record(
    org_id: str | None,
    actor: dict | None,
    action: str,
    summary: str,
    *,
    target_type: str = "",
    target_id: str = "",
    details: dict | None = None,
) -> None:
    """Add an entry. `actor` is the signed-in user (request.state.user); `org_id` is None for platform actions."""
    pool = await get_pool()
    await pool.execute(
        "INSERT INTO audit_log (org_id, actor_id, actor_email, action, target_type, target_id, summary, details) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        uuid.UUID(org_id) if org_id else None,
        uuid.UUID(actor["id"]) if actor else None,
        (actor or {}).get("email", ""),
        action,
        target_type,
        str(target_id or ""),
        summary,
        details or {},
    )


async def entries(org_id: str, limit: int, before: int | None) -> list[dict]:
    """The organisation's log, newest first; `before` continues from an entry id."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, actor_email, action, target_type, target_id, summary, details, created_at FROM audit_log "
        "WHERE org_id = $1 AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT $3",
        uuid.UUID(org_id), before, limit,
    )
    return [
        {
            "id": row["id"],
            "actor": row["actor_email"],
            "action": row["action"],
            "target_type": row["target_type"],
            "target_id": row["target_id"],
            "summary": row["summary"],
            "details": row["details"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]


def quoted(text: str | None, limit: int = 80) -> str:
    """AI or user text inside a summary: quoted, on one line and shortened."""
    text = " ".join((text or "").split())
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return f"“{text}”"
