"""Durable jobs: operations run from a queue in PostgreSQL (docs/PHASE1_DESIGN.md D9).

A worker claims a job with FOR UPDATE SKIP LOCKED and holds it under a lease (`locked_until`) that its
heartbeat renews. When a worker stops without finishing, the lease runs out and another worker claims
the job again. `queue_id` is the result the job fills in; deleting the result deletes the job.

Revision ID: 0006
Revises: 0005
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            queue_id UUID REFERENCES queue(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'queued'
                CONSTRAINT jobs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            locked_by TEXT,
            locked_until TIMESTAMPTZ,
            cancel_requested BOOLEAN NOT NULL DEFAULT false,
            cancel_message TEXT NOT NULL DEFAULT '',
            last_error TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX idx_jobs_ready ON jobs (run_after) WHERE status IN ('queued', 'running')")
    op.execute("CREATE INDEX idx_jobs_queue ON jobs (queue_id)")


def downgrade() -> None:
    op.execute("DROP TABLE jobs")
