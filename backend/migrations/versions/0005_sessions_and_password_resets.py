"""Refresh tokens, password reset links, and when each password last changed (docs/PHASE1_DESIGN.md D7, D8).

- `refresh_tokens`: stored as SHA-256 hashes. Tokens from one sign-in share a `family_id`; using a
  rotated token again (after a short grace) revokes the whole family.
- `password_resets`: one-time links, also stored hashed.
- `users.password_changed_at`: access tokens issued before it are refused.

Revision ID: 0005
Revises: 0004
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE refresh_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            family_id UUID NOT NULL,
            token_hash TEXT NOT NULL CONSTRAINT refresh_tokens_token_hash_key UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ,
            user_agent TEXT NOT NULL DEFAULT ''
        )
    """)
    op.execute("CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)")
    op.execute("CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id)")
    op.execute("""
        CREATE TABLE password_resets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL CONSTRAINT password_resets_token_hash_key UNIQUE,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX idx_password_resets_user ON password_resets(user_id)")
    op.execute("ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN password_changed_at")
    op.execute("DROP TABLE password_resets")
    op.execute("DROP TABLE refresh_tokens")
