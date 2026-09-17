"""Baseline: the schema the startup script (database.SETUP_SQL) built before migrations existed.

The statements replay that script in its order, including its history (the settings table began
with a primary key that per-user settings dropped), so a new database gets exactly the schema
existing databases have. Every statement is idempotent: on a database the old script created,
this revision only adds what that database lacks. The script's data statements are in 0002.

Revision ID: 0001
Revises:
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATEMENTS = [
    # Products
    """CREATE TABLE IF NOT EXISTS products (
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
        company_details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Queue (approval items)
    """CREATE TABLE IF NOT EXISTS queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        workflow_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        content JSONB DEFAULT '{}',
        preview TEXT DEFAULT '',
        input_params TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Templates
    """CREATE TABLE IF NOT EXISTS templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        tags JSONB DEFAULT '[]',
        content TEXT NOT NULL,
        source_product TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Calendar events
    """CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        product_name TEXT DEFAULT '',
        platform TEXT DEFAULT '',
        title TEXT NOT NULL,
        color TEXT DEFAULT '#00f0ff'
    )""",
    # Quick captures
    """CREATE TABLE IF NOT EXISTS captures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        text TEXT NOT NULL,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Settings: created as a single global row, later made per user (below)
    """CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        platforms JSONB DEFAULT '{}',
        brand JSONB DEFAULT '{}',
        prefs JSONB DEFAULT '{}',
        registration_enabled BOOLEAN DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Users
    """CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Columns added to products over time
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS press_release JSONB",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS company_details JSONB DEFAULT '{}'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_result JSONB",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS market_analysis JSONB",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'product'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS launch_date DATE",
    # Multi-tenant: every content table belongs to a user
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE queue ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE captures ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    # Per-user settings: one row per user replaces the global row
    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey",
    """DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_user_unique') THEN
        ALTER TABLE settings ADD CONSTRAINT settings_user_unique UNIQUE (user_id);
      END IF;
    END $$""",
    # Email queue (Outbox)
    """CREATE TABLE IF NOT EXISTS email_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        source_queue_id UUID REFERENCES queue(id) ON DELETE SET NULL,
        recipient_name TEXT DEFAULT '',
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error TEXT DEFAULT '',
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_email_queue_product ON email_queue(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true",
    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN DEFAULT true",
    "ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
    # Company profiles
    """CREATE TABLE IF NOT EXISTS brands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT '',
        tagline TEXT DEFAULT '',
        tone TEXT DEFAULT 'professional',
        keywords JSONB DEFAULT '[]',
        avoid JSONB DEFAULT '[]',
        elevator TEXT DEFAULT '',
        company_name TEXT DEFAULT '',
        industry TEXT DEFAULT '',
        location TEXT DEFAULT '',
        founded TEXT DEFAULT '',
        founder_name TEXT DEFAULT '',
        founder_title TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        company_size TEXT DEFAULT '',
        boilerplate TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_brands_user ON brands(user_id)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL",
    # Global app configuration (key → JSON value), e.g. registration_enabled
    """CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    # Indexes
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    "CREATE INDEX IF NOT EXISTS idx_queue_product ON queue(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date)",
    "CREATE INDEX IF NOT EXISTS idx_captures_product ON captures(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_queue_user ON queue(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_captures_user ON captures(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id)",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    # Back to an empty database: every table and all of its data is dropped.
    op.execute(
        "DROP TABLE IF EXISTS email_queue, queue, calendar_events, captures, templates, settings, "
        "products, brands, users, app_config"
    )
