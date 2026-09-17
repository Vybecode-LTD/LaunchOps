"""Alembic environment: applies LaunchOps migrations to DATABASE_URL, or to the URL a caller passes in.

Migrations are hand-written SQL. The app has no SQLAlchemy models, so autogenerate has nothing to
compare against and is switched off (target_metadata is None).
"""

import asyncio
import sys
from logging.config import fileConfig

import asyncpg
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from config import get_settings
from database import _ssl_arg

config = context.config
# The CLI configures logging from alembic.ini; the app keeps its own logging configuration.
if config.config_file_name and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

target_metadata = None
# One process migrates at a time. Another one starting meanwhile waits, then finds nothing left to do.
MIGRATION_LOCK = "SELECT pg_advisory_xact_lock(hashtext('launchops_migrations'))"


def run_migrations_offline() -> None:
    """python -m alembic upgrade head --sql: print the SQL instead of running it."""
    context.configure(dialect_name="postgresql", target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _migrate(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    # Every pending migration runs in this one transaction: all of them apply, or none do.
    with context.begin_transaction():
        connection.exec_driver_sql(MIGRATION_LOCK)
        context.run_migrations()


async def run_migrations_online() -> None:
    database_url = config.attributes.get("database_url") or get_settings().database_url
    if not database_url:
        raise RuntimeError("DATABASE_URL must be set in environment")
    # The app's own asyncpg connection settings (sslmode handling, Railway private network) apply here too.
    engine = create_async_engine(
        "postgresql+asyncpg://",
        async_creator=lambda: asyncpg.connect(database_url, ssl=_ssl_arg(database_url)),
        poolclass=pool.NullPool,
    )
    try:
        async with engine.connect() as connection:
            await connection.run_sync(_migrate)
    finally:
        await engine.dispose()


def _new_event_loop() -> asyncio.AbstractEventLoop:
    # asyncpg round trips are much slower on Windows' default Proactor loop
    return asyncio.SelectorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()


if context.is_offline_mode():
    run_migrations_offline()
else:
    with asyncio.Runner(loop_factory=_new_event_loop) as runner:
        runner.run(run_migrations_online())
