"""PostgreSQL database client for VybeCod.ing Launch Ops.

Uses asyncpg for async PostgreSQL access. Drop-in replacement for the
previous Supabase client — same 5 helper functions, same signatures.
The schema is managed by Alembic migrations (backend/migrations), which run_migrations() applies.
"""

import asyncio
import json
import ssl
import uuid
from datetime import date, datetime
from pathlib import Path

import asyncpg

from config import get_settings

_pool: asyncpg.Pool | None = None
ALEMBIC_INI = Path(__file__).parent / "alembic.ini"

# Errors that mean the database can't be reached right now (as opposed to a bad query).
DATABASE_UNAVAILABLE_ERRORS = (
    OSError,
    TimeoutError,
    asyncpg.exceptions.PostgresConnectionError,
    asyncpg.exceptions.CannotConnectNowError,
    asyncpg.exceptions.TooManyConnectionsError,
    asyncpg.exceptions.InterfaceError,
)
DATABASE_UNAVAILABLE_MESSAGE = "LaunchOps can't reach its database right now. Try again in a moment."


async def _init_connection(conn):
    """Set up JSON codec on each connection so JSONB comes back as dicts."""
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads,
        schema="pg_catalog", format="text",
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads,
        schema="pg_catalog", format="text",
    )


def _ssl_arg(dsn: str):
    """Pick asyncpg's ssl argument for a DSN."""
    # An explicit sslmode (e.g. local/CI Postgres with sslmode=disable) wins:
    # ssl=None lets asyncpg honor the DSN.
    if "sslmode=" in dsn:
        return None
    # Railway private networking uses WireGuard — no SSL needed.
    if ".railway.internal" in dsn:
        return False
    # For public URLs, use SSL with no cert verification.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL must be set in environment")
        dsn = settings.database_url
        ssl_arg = _ssl_arg(dsn)

        _pool = await asyncpg.create_pool(
            dsn, min_size=2, max_size=10,
            init=_init_connection,
            ssl=ssl_arg,
        )
    return _pool


async def close_pool():
    """Close the connection pool (call on shutdown)."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# ─── Migrations ───


def alembic_config(database_url: str | None = None):
    """Alembic configuration for this app; database_url defaults to DATABASE_URL."""
    from alembic.config import Config

    config = Config(str(ALEMBIC_INI))
    config.attributes["database_url"] = database_url or get_settings().database_url
    config.attributes["configure_logger"] = False
    return config


async def run_migrations(database_url: str | None = None) -> None:
    """Apply every migration the database doesn't have yet (the same as: python -m alembic upgrade head)."""
    from alembic import command

    # Alembic runs its own event loop, so it gets a thread of its own
    await asyncio.to_thread(command.upgrade, alembic_config(database_url), "head")


# ─── Value preparation ───

TIMESTAMP_TYPES = {"timestamp with time zone", "timestamp without time zone"}
# Column name → data type, per table, read from the catalog once per process (the schema only changes
# through migrations, which run before the app serves requests).
_column_types: dict[str, dict[str, str]] = {}


async def _types_of(pool: asyncpg.Pool, table: str) -> dict[str, str]:
    if table not in _column_types:
        rows = await pool.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = $1",
            table,
        )
        _column_types[table] = {row["column_name"]: row["data_type"] for row in rows}
    return _column_types[table]


def _prep_value(value, data_type: str | None):
    """Prepare a value for its column. asyncpg needs date and datetime objects for date and timestamp
    columns, so ISO strings bound for those are parsed; everything else passes through unchanged
    (UUID strings are fine for UUID columns, and the JSON codec set up in _init_connection encodes
    dicts and lists)."""
    if isinstance(value, str):
        try:
            if data_type in TIMESTAMP_TYPES:
                return datetime.fromisoformat(value)
            if data_type == "date":
                return date.fromisoformat(value)
        except ValueError:
            pass  # not ISO: asyncpg reports the bad value
    return value


def _row_to_dict(row: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a JSON-safe dict."""
    d = {}
    for k, v in dict(row).items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
        elif isinstance(v, (datetime, date)):
            d[k] = v.isoformat()
        else:
            d[k] = v
    return d


# ─── Table helpers ───
# Each function wraps common PostgreSQL operations for cleaner router code.
# Signatures match the previous Supabase helpers so routers need no changes.


async def insert(table: str, data: dict) -> dict:
    """Insert a row and return it."""
    pool = await get_pool()
    types = await _types_of(pool, table)
    cols = []
    vals = []
    placeholders = []
    for i, (k, v) in enumerate(data.items(), 1):
        cols.append(f'"{k}"')
        vals.append(_prep_value(v, types.get(k)))
        placeholders.append(f"${i}")

    query = f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({", ".join(placeholders)}) RETURNING *'
    row = await pool.fetchrow(query, *vals)
    return _row_to_dict(row) if row else {}


async def select(table: str, filters: dict | None = None, order: str = "created_at",
                 descending: bool = True, limit: int = 100) -> list[dict]:
    """Select rows with optional filters."""
    pool = await get_pool()
    conditions = []
    vals = []
    if filters:
        for i, (k, v) in enumerate(filters.items(), 1):
            conditions.append(f'"{k}" = ${i}')
            vals.append(v)

    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    direction = "DESC" if descending else "ASC"
    query = f'SELECT * FROM {table}{where} ORDER BY "{order}" {direction} LIMIT {limit}'
    rows = await pool.fetch(query, *vals)
    return [_row_to_dict(r) for r in rows]


async def select_one(table: str, id_value, id_col: str = "id") -> dict | None:
    """Select a single row by ID (None when no row matches)."""
    pool = await get_pool()
    query = f'SELECT * FROM {table} WHERE "{id_col}" = $1'
    try:
        row = await pool.fetchrow(query, id_value)
    except asyncpg.DataError:
        # The value isn't valid for the column's type (e.g. a malformed UUID in a URL),
        # so no row can match — "not found" rather than a 500
        return None
    return _row_to_dict(row) if row else None


async def update(table: str, id_value, data: dict, id_col: str = "id") -> dict:
    """Update a row by ID."""
    pool = await get_pool()
    types = await _types_of(pool, table)
    sets = []
    vals = []
    for i, (k, v) in enumerate(data.items(), 1):
        sets.append(f'"{k}" = ${i}')
        vals.append(_prep_value(v, types.get(k)))
    vals.append(id_value)

    query = f'UPDATE {table} SET {", ".join(sets)} WHERE "{id_col}" = ${len(vals)} RETURNING *'
    row = await pool.fetchrow(query, *vals)
    return _row_to_dict(row) if row else {}


async def delete(table: str, id_value, id_col: str = "id") -> bool:
    """Delete a row by ID."""
    pool = await get_pool()
    await pool.execute(f'DELETE FROM {table} WHERE "{id_col}" = $1', id_value)
    return True


async def get_config(key: str, default=None):
    """Read a global app_config value (decoded JSON), or default when unset."""
    row = await select_one("app_config", key, id_col="key")
    return row["value"] if row else default


async def set_config(key: str, value) -> None:
    """Create or replace a global app_config value."""
    pool = await get_pool()
    await pool.execute(
        "INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2, NOW()) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        key, value,
    )
