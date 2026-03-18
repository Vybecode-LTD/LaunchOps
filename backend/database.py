"""Supabase database client for VybeCod.ing Launch Ops."""

from supabase import create_client, Client
from config import get_settings

_client: Client | None = None


def get_db() -> Client:
    """Get or create Supabase client singleton."""
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment"
            )
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


# ─── Table helpers ───
# Each function wraps common Supabase operations for cleaner router code.


def insert(table: str, data: dict) -> dict:
    """Insert a row and return it."""
    result = get_db().table(table).insert(data).execute()
    return result.data[0] if result.data else {}


def select(table: str, filters: dict | None = None, order: str = "created_at",
           descending: bool = True, limit: int = 100) -> list[dict]:
    """Select rows with optional filters."""
    query = get_db().table(table).select("*")
    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)
    query = query.order(order, desc=descending).limit(limit)
    result = query.execute()
    return result.data or []


def select_one(table: str, id_value: str, id_col: str = "id") -> dict | None:
    """Select a single row by ID."""
    result = get_db().table(table).select("*").eq(id_col, id_value).execute()
    return result.data[0] if result.data else None


def update(table: str, id_value: str, data: dict,
           id_col: str = "id") -> dict:
    """Update a row by ID."""
    result = (
        get_db().table(table).update(data).eq(id_col, id_value).execute()
    )
    return result.data[0] if result.data else {}


def delete(table: str, id_value: str, id_col: str = "id") -> bool:
    """Delete a row by ID."""
    get_db().table(table).delete().eq(id_col, id_value).execute()
    return True


# ─── Schema setup SQL (run once in Supabase SQL editor) ───

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_queue_product ON queue(product_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_captures_product ON captures(product_id);
"""
