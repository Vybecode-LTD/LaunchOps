"""AI usage ledger and monthly budgets (docs/PHASE1_DESIGN.md D12).

- `ai_usage`: one row per Claude API call, with its tokens, web searches and estimated cost
  (NULL when the model's price isn't known).
- `organisations.monthly_ai_budget_usd`: optional; operations stop once the month's cost reaches it.

Revision ID: 0007
Revises: 0006
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE ai_usage (
            id BIGSERIAL PRIMARY KEY,
            org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            product_id UUID REFERENCES products(id) ON DELETE SET NULL,
            operation TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
            cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
            web_search_requests INTEGER NOT NULL DEFAULT 0,
            cost_usd NUMERIC(12, 6),
            stop_reason TEXT NOT NULL DEFAULT '',
            request_id TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_ai_usage_org_created ON ai_usage (org_id, created_at)")
    op.execute("ALTER TABLE organisations ADD COLUMN monthly_ai_budget_usd NUMERIC(12, 2)")


def downgrade() -> None:
    op.execute("ALTER TABLE organisations DROP COLUMN monthly_ai_budget_usd")
    op.execute("DROP TABLE ai_usage")
