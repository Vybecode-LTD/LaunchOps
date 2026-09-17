"""Database migrations (Alembic, backend/migrations).

The migrations must build the schema the old startup script built (tests/legacy_setup_schema.sql),
and a database that script created must upgrade cleanly to that same schema. Each test works on its
own scratch databases on the test server.
"""

import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import asyncpg
import pytest
from alembic import command

import config
import database

LEGACY_SETUP_SQL = (Path(__file__).parent / "legacy_setup_schema.sql").read_text(encoding="utf-8")
APP_TABLES = {
    "app_config", "brands", "calendar_events", "captures", "email_queue", "products", "queue", "settings",
    "templates", "users",
}


def _dsn_for(name: str) -> str:
    url = urlparse(config.get_settings().database_url)
    return urlunparse(url._replace(path=f"/{name}"))


@pytest.fixture
async def scratch_database():
    """await scratch_database(suffix) → the DSN of a new, empty database, dropped after the test."""
    admin = await asyncpg.connect(config.get_settings().database_url)
    created = []

    async def create(suffix: str) -> str:
        name = f"launchops_test_migrations_{suffix}"
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.execute(f'CREATE DATABASE "{name}"')
        created.append(name)
        return _dsn_for(name)

    try:
        yield create
    finally:
        for name in created:
            await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()


async def _execute(dsn: str, sql: str, *args):
    conn = await asyncpg.connect(dsn)
    try:
        return await conn.fetch(sql, *args)
    finally:
        await conn.close()


async def _run_legacy_setup(dsn: str) -> None:
    """What every app start did before migrations."""
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(LEGACY_SETUP_SQL)
    finally:
        await conn.close()


async def _schema(dsn: str) -> dict:
    """Columns, constraints and indexes of the app's tables."""
    conn = await asyncpg.connect(dsn)
    try:
        columns = await conn.fetch("""
            SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name <> 'alembic_version'
            ORDER BY table_name, column_name
        """)
        constraints = await conn.fetch("""
            SELECT conrelid::regclass::text AS table_name, conname, contype, pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'alembic_version'
            ORDER BY 1, 2
        """)
        indexes = await conn.fetch("""
            SELECT tablename, indexname, indexdef FROM pg_indexes
            WHERE schemaname = 'public' AND tablename <> 'alembic_version'
            ORDER BY 1, 2
        """)
    finally:
        await conn.close()
    return {
        "columns": [tuple(row) for row in columns],
        "constraints": [tuple(row) for row in constraints],
        "indexes": [tuple(row) for row in indexes],
    }


async def test_migrations_build_the_schema_the_old_startup_script_built(scratch_database):
    fresh = await scratch_database("fresh")
    legacy = await scratch_database("legacy")

    # 0001 and 0002 reproduce the old script; later revisions change the schema on purpose
    await _upgrade(fresh, "0002")
    await _run_legacy_setup(legacy)

    migrated = await _schema(fresh)
    assert {column[0] for column in migrated["columns"]} == APP_TABLES
    assert migrated == await _schema(legacy)


async def test_a_database_the_old_startup_script_created_upgrades_cleanly(scratch_database):
    fresh = await scratch_database("fresh")
    legacy = await scratch_database("legacy")
    await database.run_migrations(fresh)

    # Three app starts with the old script: each one added an empty settings row owned by no one
    for _ in range(3):
        await _run_legacy_setup(legacy)
    [owner] = await _execute(legacy, "INSERT INTO users (email, password_hash) VALUES ('owner@example.com', 'hash') RETURNING id")
    await _execute(legacy, """INSERT INTO settings (user_id, brand) VALUES ($1, '{"name": "Acme"}')""", owner["id"])
    # The original global row: filled in before settings were per user, and where registration was switched off
    await _execute(legacy, """
        UPDATE settings SET brand = '{"name": "Legacy"}', registration_enabled = false
        WHERE ctid = (SELECT ctid FROM settings WHERE user_id IS NULL LIMIT 1)
    """)
    assert len(await _execute(legacy, "SELECT 1 FROM settings WHERE user_id IS NULL")) == 3

    await database.run_migrations(legacy)

    assert await _schema(legacy) == await _schema(fresh)
    rows = await _execute(legacy, "SELECT user_id, brand FROM settings ORDER BY user_id NULLS FIRST")
    # The empty rows are gone; rows with content are kept
    assert [(row["user_id"], json.loads(row["brand"])) for row in rows] == [(None, {"name": "Legacy"}), (owner["id"], {"name": "Acme"})]
    # Registration stays switched off where the app now reads the switch
    [flag] = await _execute(legacy, "SELECT value FROM app_config WHERE key = 'registration_enabled'")
    assert json.loads(flag["value"]) is False
    [version] = await _execute(legacy, "SELECT version_num FROM alembic_version")
    assert version["version_num"] == await _head_revision()


async def test_0003_gives_every_user_an_organisation_and_moves_their_data_into_it(scratch_database):
    dsn = await scratch_database("organisations")
    await _upgrade(dsn, "0002")
    [alex] = await _execute(dsn, "INSERT INTO users (email, password_hash, name) VALUES ('alex@example.com', 'hash', 'Alex') RETURNING id")
    await _execute(dsn, "INSERT INTO users (email, password_hash, name) VALUES ('sam.lee@example.com', 'hash', '') RETURNING id")
    [kim] = await _execute(dsn, "INSERT INTO users (email, password_hash, name) VALUES ('kim@example.com', 'hash', 'Kim') RETURNING id")
    await _execute(dsn, """INSERT INTO settings (user_id, brand) VALUES ($1, '{"company_name": "Northwind Labs"}')""", kim["id"])
    [product] = await _execute(dsn, "INSERT INTO products (name, user_id) VALUES ('Alex App', $1) RETURNING id", alex["id"])
    await _execute(dsn, "INSERT INTO queue (product_id, user_id, workflow_id) VALUES ($1, $2, 'blog')", product["id"], alex["id"])
    await _execute(dsn, "INSERT INTO email_queue (product_id, user_id, recipient_email, subject, body) VALUES ($1, $2, 'a@b.example', 's', 'b')",
                   product["id"], alex["id"])
    await _execute(dsn, "INSERT INTO products (name) VALUES ('Nobody''s app')")

    await _upgrade(dsn, "0003")

    organisations = await _execute(dsn, """
        SELECT u.email, o.name, m.role FROM memberships m
        JOIN organisations o ON o.id = m.org_id JOIN users u ON u.id = m.user_id ORDER BY u.email
    """)
    assert [tuple(row) for row in organisations] == [
        ("alex@example.com", "Alex's organisation", "owner"),
        ("kim@example.com", "Northwind Labs", "owner"),
        ("sam.lee@example.com", "sam.lee's organisation", "owner"),
    ]
    rows = await _execute(dsn, """
        SELECT 'products' AS t, p.org_id = m.org_id AS moved FROM products p JOIN memberships m ON m.user_id = p.user_id
        UNION ALL SELECT 'queue', q.org_id = m.org_id FROM queue q JOIN memberships m ON m.user_id = q.user_id
        UNION ALL SELECT 'email_queue', e.org_id = m.org_id FROM email_queue e JOIN memberships m ON m.user_id = e.user_id
        UNION ALL SELECT 'settings', s.org_id = m.org_id FROM settings s JOIN memberships m ON m.user_id = s.user_id
    """)
    assert sorted((row["t"], row["moved"]) for row in rows) == [
        ("email_queue", True), ("products", True), ("queue", True), ("settings", True),
    ]
    [orphan] = await _execute(dsn, "SELECT org_id FROM products WHERE user_id IS NULL")
    assert orphan["org_id"] is None

    # Deleting an account no longer deletes what it created
    await _execute(dsn, "DELETE FROM memberships WHERE user_id = $1", alex["id"])
    await _execute(dsn, "DELETE FROM users WHERE id = $1", alex["id"])
    assert [row["user_id"] for row in await _execute(dsn, "SELECT user_id FROM products WHERE name = 'Alex App'")] == [None]


async def test_0003_downgrades_to_the_previous_schema(scratch_database):
    upgraded = await scratch_database("upgraded")
    previous = await scratch_database("previous")
    await _upgrade(previous, "0002")
    await _upgrade(upgraded, "0003")

    await asyncio.to_thread(command.downgrade, database.alembic_config(upgraded), "0002")

    assert await _schema(upgraded) == await _schema(previous)


async def test_running_the_migrations_again_changes_nothing(scratch_database):
    dsn = await scratch_database("again")
    await database.run_migrations(dsn)
    before = await _schema(dsn)

    await database.run_migrations(dsn)

    assert await _schema(dsn) == before


async def test_migrations_downgrade_to_an_empty_database(scratch_database):
    dsn = await scratch_database("downgrade")
    await database.run_migrations(dsn)

    await asyncio.to_thread(command.downgrade, database.alembic_config(dsn), "base")

    tables = await _execute(dsn, "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    assert {row["tablename"] for row in tables} == {"alembic_version"}


async def test_the_test_database_is_at_the_newest_revision():
    [version] = await _execute(config.get_settings().database_url, "SELECT version_num FROM alembic_version")
    assert version["version_num"] == await _head_revision()


async def _upgrade(dsn: str, revision: str) -> None:
    await asyncio.to_thread(command.upgrade, database.alembic_config(dsn), revision)


async def _head_revision() -> str:
    from alembic.script import ScriptDirectory

    return ScriptDirectory.from_config(database.alembic_config()).get_current_head()
