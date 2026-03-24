"""PostgreSQL database client for VybeCod.ing Launch Ops.

Uses asyncpg for async PostgreSQL access. Drop-in replacement for the
previous Supabase client — same 5 helper functions, same signatures.
"""

import json
import ssl
import uuid
from datetime import date, datetime
import asyncpg
from config import get_settings

_pool: asyncpg.Pool | None = None


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


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL must be set in environment")
        # Railway private networking uses WireGuard — no SSL needed.
        # For public URLs (local dev), use SSL with no cert verification.
        dsn = settings.database_url
        is_internal = ".railway.internal" in dsn
        if is_internal:
            ssl_arg = False
        else:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ssl_arg = ctx

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


# ─── JSON encoder helper ───

def _prep_value(value):
    """Prepare a value for asyncpg: coerce UUIDs/datetimes.

    Note: dicts/lists pass through as-is because the JSON codec
    (set up in _init_connection) handles JSONB encoding.
    """
    if isinstance(value, str):
        # Convert UUID strings
        if len(value) == 36:
            try:
                return uuid.UUID(value)
            except ValueError:
                pass
        # Convert ISO datetime strings
        if "T" in value and len(value) > 18:
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                pass
    return value


def _row_to_dict(row: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a JSON-safe dict."""
    d = {}
    for k, v in dict(row).items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
        elif isinstance(v, date):
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
    # Filter out None values and encode JSONB
    cols = []
    vals = []
    placeholders = []
    for i, (k, v) in enumerate(data.items(), 1):
        cols.append(f'"{k}"')
        vals.append(_prep_value(v))
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
    """Select a single row by ID."""
    pool = await get_pool()
    query = f'SELECT * FROM {table} WHERE "{id_col}" = $1'
    row = await pool.fetchrow(query, id_value)
    return _row_to_dict(row) if row else None


async def update(table: str, id_value, data: dict, id_col: str = "id") -> dict:
    """Update a row by ID."""
    pool = await get_pool()
    sets = []
    vals = []
    for i, (k, v) in enumerate(data.items(), 1):
        sets.append(f'"{k}" = ${i}')
        vals.append(_prep_value(v))
    vals.append(id_value)

    query = f'UPDATE {table} SET {", ".join(sets)} WHERE "{id_col}" = ${len(vals)} RETURNING *'
    row = await pool.fetchrow(query, *vals)
    return _row_to_dict(row) if row else {}


async def delete(table: str, id_value, id_col: str = "id") -> bool:
    """Delete a row by ID."""
    pool = await get_pool()
    await pool.execute(f'DELETE FROM {table} WHERE "{id_col}" = $1', id_value)
    return True


# ─── Schema setup SQL (run automatically on startup) ───

SETUP_SQL = """
-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tagline TEXT DEFAULT '',
    url TEXT DEFAULT '',
    color TEXT DEFAULT '#00f0ff',
    status TEXT DEFAULT 'pre_launch',
    description TEXT DEFAULT '',
    keywords JSONB DEFAULT '[]',
    press_kit JSONB,
    checklist JSONB DEFAULT '{}',
    seo_result JSONB,
    email_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue (approval items)
CREATE TABLE IF NOT EXISTS queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    content JSONB DEFAULT '{}',
    preview TEXT DEFAULT '',
    input_params TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    tags JSONB DEFAULT '[]',
    content TEXT NOT NULL,
    source_product TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT DEFAULT '',
    platform TEXT DEFAULT '',
    title TEXT NOT NULL,
    color TEXT DEFAULT '#00f0ff'
);

-- Quick captures
CREATE TABLE IF NOT EXISTS captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global settings (single row)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    platforms JSONB DEFAULT '{}',
    brand JSONB DEFAULT '{}',
    prefs JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations (safe to re-run)
ALTER TABLE products ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_queue_product ON queue(product_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_captures_product ON captures(product_id);
"""


async def run_setup():
    """Run the schema setup SQL. Safe to call multiple times."""
    pool = await get_pool()
    await pool.execute(SETUP_SQL)
