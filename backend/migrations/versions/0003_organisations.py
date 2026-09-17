"""Organisations and memberships (docs/PHASE1_DESIGN.md D1–D6).

- `organisations`, and `memberships` with a role: owner, approver, editor or viewer.
- Every content table gets `org_id`. Each existing user becomes the owner of their own organisation,
  named after their white-label company name when they set one, and their rows move into it.
  Rows that belong to no user keep no organisation, so they stay invisible.
- `user_id` on content now records who created a row: deleting an account no longer deletes what it
  created in an organisation others share (the account's own organisation is deleted with it by the app).
- Settings belong to the organisation (one row each, no longer one per user; `user_id` records who saved
  them last). `email_queue.sent_by` records who sent an email.

Revision ID: 0003
Revises: 0002
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ORG_TABLES = ["products", "queue", "email_queue", "calendar_events", "captures", "templates", "brands", "settings"]


def upgrade() -> None:
    op.execute("""
        CREATE TABLE organisations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE memberships (
            org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'approver', 'editor', 'viewer')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (org_id, user_id)
        )
    """)
    op.execute("CREATE INDEX idx_memberships_user ON memberships(user_id)")

    for table in ORG_TABLES:
        op.execute(f"ALTER TABLE {table} ADD COLUMN org_id UUID REFERENCES organisations(id) ON DELETE CASCADE")
        op.execute(f"CREATE INDEX idx_{table}_org ON {table}(org_id)")
        op.execute(f"""
            ALTER TABLE {table}
            DROP CONSTRAINT {table}_user_id_fkey,
            ADD CONSTRAINT {table}_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        """)
    op.execute("ALTER TABLE email_queue ADD COLUMN sent_by UUID REFERENCES users(id) ON DELETE SET NULL")

    # One organisation per existing user
    op.execute("""
        CREATE TEMPORARY TABLE personal_organisations ON COMMIT DROP AS
        SELECT
            u.id AS user_id,
            gen_random_uuid() AS org_id,
            COALESCE(u.created_at, NOW()) AS created_at,
            COALESCE(
                NULLIF(btrim(s.brand->>'company_name'), ''),
                NULLIF(btrim(u.name), '') || '''s organisation',
                split_part(u.email, '@', 1) || '''s organisation'
            ) AS name
        FROM users u
        LEFT JOIN settings s ON s.user_id = u.id
    """)
    op.execute("""
        INSERT INTO organisations (id, name, created_at, updated_at)
        SELECT org_id, name, created_at, created_at FROM personal_organisations
    """)
    op.execute("""
        INSERT INTO memberships (org_id, user_id, role, created_at)
        SELECT org_id, user_id, 'owner', created_at FROM personal_organisations
    """)
    for table in ORG_TABLES:
        op.execute(f"UPDATE {table} t SET org_id = p.org_id FROM personal_organisations p WHERE t.user_id = p.user_id")

    op.execute("ALTER TABLE settings ADD CONSTRAINT settings_org_unique UNIQUE (org_id)")
    op.execute("ALTER TABLE settings DROP CONSTRAINT settings_user_unique")


def downgrade() -> None:
    # One settings row per user again: a user who saved several organisations' settings keeps the latest
    op.execute("""
        UPDATE settings SET user_id = NULL
        WHERE ctid IN (
            SELECT ctid FROM (
                SELECT ctid, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST) AS n
                FROM settings WHERE user_id IS NOT NULL
            ) ranked WHERE n > 1
        )
    """)
    op.execute("ALTER TABLE settings ADD CONSTRAINT settings_user_unique UNIQUE (user_id)")
    op.execute("ALTER TABLE settings DROP CONSTRAINT settings_org_unique")
    op.execute("ALTER TABLE email_queue DROP COLUMN sent_by")
    for table in ORG_TABLES:
        op.execute(f"""
            ALTER TABLE {table}
            DROP CONSTRAINT {table}_user_id_fkey,
            ADD CONSTRAINT {table}_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        """)
        op.execute(f"ALTER TABLE {table} DROP COLUMN org_id")
    op.execute("DROP TABLE memberships")
    op.execute("DROP TABLE organisations")
