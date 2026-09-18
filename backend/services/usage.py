"""The AI usage ledger: record every Claude call, enforce monthly budgets, summarise a month (D12)."""

import logging
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import asyncpg
from fastapi import HTTPException

from config import get_settings
from database import DATABASE_UNAVAILABLE_ERRORS, get_pool
from services import pricing

logger = logging.getLogger(__name__)


def _uuid(value) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


async def record(context, model: str, usage, stop_reason: str | None, request_id: str | None) -> None:
    """Add a ledger row for one API response. Never raises: a missed row mustn't lose the answer."""
    server_tools = getattr(usage, "server_tool_use", None)
    web_searches = (getattr(server_tools, "web_search_requests", 0) or 0) if server_tools else 0
    tokens = pricing.TokenUsage(
        input_tokens=usage.input_tokens or 0,
        output_tokens=usage.output_tokens or 0,
        cache_creation_input_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
        cache_read_input_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
    )
    try:
        pool = await get_pool()
        await pool.execute(
            "INSERT INTO ai_usage (org_id, user_id, product_id, operation, model, input_tokens, output_tokens, "
            "cache_creation_input_tokens, cache_read_input_tokens, web_search_requests, cost_usd, stop_reason, request_id) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
            _uuid(context.org_id), _uuid(context.user_id), _uuid(context.product_id), context.operation, model,
            tokens.input_tokens, tokens.output_tokens, tokens.cache_creation_input_tokens, tokens.cache_read_input_tokens,
            web_searches, pricing.cost_usd(model, tokens, web_searches), stop_reason or "", request_id or "",
        )
    except (*DATABASE_UNAVAILABLE_ERRORS, asyncpg.PostgresError):
        logger.warning("Couldn't record AI usage for %s", context.operation, exc_info=True)


def _month_start(day: date) -> datetime:
    return datetime(day.year, day.month, 1, tzinfo=UTC)


def _next_month(start: datetime) -> datetime:
    return datetime(start.year + (start.month == 12), start.month % 12 + 1, 1, tzinfo=UTC)


def effective_budget(own: Decimal | None) -> tuple[Decimal | None, str]:
    """The monthly budget that actually applies to an organisation, and where it comes from.

    Returns `(amount, source)`: the organisation's own budget when it has set one
    (`"organisation"`), otherwise the platform default (`"default"`), or no cap at all when the
    default is switched off with 0 (`"none"`). Enforcement and the usage summary both call this,
    so the budget an owner is shown is always the one that stops their operations.
    """
    if own is not None:
        return own, "organisation"
    default = get_settings().default_monthly_ai_budget_usd
    return (default, "default") if default > 0 else (None, "none")


async def ensure_budget_allowed(org_id: str, amount: Decimal | None, *, is_admin: bool) -> None:
    """403 when an owner who isn't a platform admin sets a budget they may not.

    Registration makes every new account the owner of its own organisation, and an organisation's own
    budget wins over the default, so without a ceiling anyone could sign up and lift the cap on the
    deployment's single API key with one request (BUG-031). An owner may set any budget up to the
    platform default, clear it, or lower the budget they have — lowering only ever reduces what the key
    can spend, even when the new amount is still above the default (BUG-032). Only a platform admin may
    go higher, and only where they are an owner: the route is owner-only, and by the owner's decision
    (B-15) an admin does not reach into organisations they don't belong to. So no message here promises
    an administrator will raise anything. With the default switched off (0) there is no ceiling.
    """
    if amount is None or is_admin:
        return
    ceiling = get_settings().default_monthly_ai_budget_usd
    if ceiling <= 0 or amount <= ceiling:
        return
    # Above the default: allowed only as a decrease from a budget already above it.
    pool = await get_pool()
    current = await pool.fetchval("SELECT monthly_ai_budget_usd FROM organisations WHERE id = $1", uuid.UUID(org_id))
    if current is not None and current > ceiling:
        if amount <= current:
            return
        raise HTTPException(403, f"This organisation's budget can be lowered, but not raised above its current ${current:,.2f}.")
    raise HTTPException(403, f"The most an organisation can set is ${ceiling:,.2f} a month.")


async def ensure_within_budget(org_id: str, org_name: str) -> None:
    """429 when this month's cost has reached the organisation's budget, or the platform default.

    An organisation created by registration has no budget of its own, and every deployment bills AI to
    one API key, so without a default anyone who signs up could spend on that key without limit. The
    organisation's own budget always wins; the default only covers those that never set one.
    """
    pool = await get_pool()
    own = await pool.fetchval("SELECT monthly_ai_budget_usd FROM organisations WHERE id = $1", uuid.UUID(org_id))
    budget, source = effective_budget(own)
    if budget is None:
        return
    its_own = source == "organisation"
    start = _month_start(datetime.now(UTC).date())
    spent = await pool.fetchval(
        "SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage WHERE org_id = $1 AND created_at >= $2 AND created_at < $3",
        uuid.UUID(org_id), start, _next_month(start),
    )
    if spent >= budget:
        which = "its AI budget" if its_own else "the default AI budget"
        # An owner can raise their own budget only while it is still under the default. Beyond that, and
        # for the default itself, nobody in a self-registered organisation can: an admin doesn't reach
        # into organisations they don't belong to (B-15). So say only what is true for everyone.
        ceiling = get_settings().default_monthly_ai_budget_usd
        owner_can_raise = its_own and not (ceiling > 0 and budget >= ceiling)
        remedy = "An owner can raise it in Settings → Usage." if owner_can_raise else "Operations can start again next month."
        raise HTTPException(429, f"{org_name} has used {which} for {start:%B} (${budget:,.2f}). {remedy}")


async def set_budget(org_id: str, amount: Decimal | None) -> None:
    pool = await get_pool()
    await pool.execute("UPDATE organisations SET monthly_ai_budget_usd = $1, updated_at = NOW() WHERE id = $2", amount, uuid.UUID(org_id))


def parse_month(value: str | None) -> datetime:
    """The first moment of a YYYY-MM month (this month when not given); ValueError otherwise."""
    if not value:
        return _month_start(datetime.now(UTC).date())
    return datetime.strptime(value, "%Y-%m").replace(tzinfo=UTC)


TOTALS = (
    "COALESCE(SUM(u.cost_usd), 0) AS cost_usd, COUNT(*) AS calls, "
    "COALESCE(SUM(u.input_tokens), 0) AS input_tokens, COALESCE(SUM(u.output_tokens), 0) AS output_tokens, "
    "COALESCE(SUM(u.cache_creation_input_tokens), 0) AS cache_creation_input_tokens, "
    "COALESCE(SUM(u.cache_read_input_tokens), 0) AS cache_read_input_tokens, "
    "COALESCE(SUM(u.web_search_requests), 0) AS web_search_requests, "
    "COUNT(*) FILTER (WHERE u.cost_usd IS NULL) AS unpriced_calls"
)


def _totals(row) -> dict:
    return {
        "cost_usd": float(row["cost_usd"]),
        "calls": row["calls"],
        "input_tokens": row["input_tokens"],
        "output_tokens": row["output_tokens"],
        "cache_creation_input_tokens": row["cache_creation_input_tokens"],
        "cache_read_input_tokens": row["cache_read_input_tokens"],
        "web_search_requests": row["web_search_requests"],
        "unpriced_calls": row["unpriced_calls"],
    }


async def summary(org_id: str, month: datetime) -> dict:
    """A month's usage: totals, and breakdowns by operation, project, member and model (most expensive first)."""
    pool = await get_pool()
    args = (uuid.UUID(org_id), month, _next_month(month))
    where = "u.org_id = $1 AND u.created_at >= $2 AND u.created_at < $3"
    total = await pool.fetchrow(f"SELECT {TOTALS} FROM ai_usage u WHERE {where}", *args)
    own = await pool.fetchval("SELECT monthly_ai_budget_usd FROM organisations WHERE id = $1", args[0])
    effective, source = effective_budget(own)
    default = get_settings().default_monthly_ai_budget_usd

    async def breakdown(key_sql: str, label_sql: str, joins: str = "") -> list[dict]:
        rows = await pool.fetch(
            f"SELECT {key_sql} AS key, {label_sql} AS label, {TOTALS} FROM ai_usage u {joins} WHERE {where} "
            f"GROUP BY 1, 2 ORDER BY cost_usd DESC, calls DESC, label",
            *args,
        )
        return [{"key": str(r["key"]) if r["key"] is not None else "", "label": r["label"], **_totals(r)} for r in rows]

    return {
        "month": f"{month:%Y-%m}",
        # What the organisation set itself, which the budget form edits.
        "budget_usd": float(own) if own is not None else None,
        # The platform default, when one is switched on.
        "default_budget_usd": float(default) if default > 0 else None,
        # What actually stops operations, and whose it is: show this, not budget_usd.
        "effective_budget_usd": float(effective) if effective is not None else None,
        "budget_source": source,
        "total": _totals(total),
        "by_operation": await breakdown("u.operation", "u.operation"),
        "by_project": await breakdown("u.product_id", "COALESCE(p.name, 'A deleted project')", "LEFT JOIN products p ON p.id = u.product_id"),
        "by_member": await breakdown("u.user_id", "COALESCE(us.email, 'A deleted account')", "LEFT JOIN users us ON us.id = u.user_id"),
        "by_model": await breakdown("u.model", "u.model"),
    }
