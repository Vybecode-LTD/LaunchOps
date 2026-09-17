"""Invitations to an organisation, and the activity (audit) log (docs/PHASE1_DESIGN.md D2, D8, D14).

- `invitations`: an email address and a role; the link's token is stored only as a SHA-256 hash.
  An invitation is pending until it's accepted, withdrawn or past `expires_at`.
- `audit_log`: governed actions, newest last by `id`. `actor_email` keeps who acted after their
  account is deleted. Platform-level actions (accounts, the registration switch) have no organisation.

Revision ID: 0004
Revises: 0003
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE invitations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            role TEXT NOT NULL CONSTRAINT invitations_role_check CHECK (role IN ('owner', 'approver', 'editor', 'viewer')),
            token_hash TEXT NOT NULL CONSTRAINT invitations_token_hash_key UNIQUE,
            invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            accepted_at TIMESTAMPTZ,
            accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
            revoked_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX idx_invitations_org ON invitations(org_id)")
    op.execute("""
        CREATE TABLE audit_log (
            id BIGSERIAL PRIMARY KEY,
            org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
            actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
            actor_email TEXT NOT NULL DEFAULT '',
            action TEXT NOT NULL,
            target_type TEXT NOT NULL DEFAULT '',
            target_id TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            details JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_audit_log_org ON audit_log(org_id, id DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE audit_log")
    op.execute("DROP TABLE invitations")
