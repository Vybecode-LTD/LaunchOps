"""Settings data left behind by the old startup script.

- Registration used to be switched off on a settings row; the switch now lives in app_config.
- The script inserted an empty settings row owned by no one at every app start. Those rows are
  deleted. A row owned by no one that holds anything (an old global brand, say) is kept.

Revision ID: 0002
Revises: 0001
Created: 2026-09-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO app_config (key, value)
        SELECT 'registration_enabled', 'false'::jsonb
        WHERE EXISTS (SELECT 1 FROM settings WHERE registration_enabled = false)
        ON CONFLICT (key) DO NOTHING
    """)
    op.execute("""
        DELETE FROM settings
        WHERE user_id IS NULL
          AND COALESCE(platforms, '{}'::jsonb) = '{}'::jsonb
          AND COALESCE(brand, '{}'::jsonb) = '{}'::jsonb
          AND COALESCE(prefs, '{}'::jsonb) = '{}'::jsonb
          AND registration_enabled IS NOT FALSE
    """)


def downgrade() -> None:
    # Nothing to put back: the deleted rows were empty, and the registration switch stays where the app reads it.
    pass
