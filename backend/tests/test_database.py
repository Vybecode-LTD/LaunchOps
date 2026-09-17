"""database.py — connection SSL selection (B13), lookups, value preparation and startup."""

import ssl
import uuid
from datetime import UTC, date, datetime

import database
import main

LOCAL_DSN = "postgresql://postgres@localhost:5432/launchops?sslmode=disable"


# ─── B13: honor sslmode in the DSN ───


def test_sslmode_in_dsn_is_left_to_asyncpg():
    assert database._ssl_arg(LOCAL_DSN) is None
    assert database._ssl_arg("postgresql://app:pw@db.example.com:5432/app?sslmode=require") is None


def test_railway_internal_dsn_disables_ssl():
    assert database._ssl_arg("postgresql://app:pw@postgres.railway.internal:5432/railway") is False


def test_public_dsn_uses_tls_without_certificate_checks():
    ctx = database._ssl_arg("postgresql://app:pw@proxy.rlwy.net:41234/railway")
    assert isinstance(ctx, ssl.SSLContext)
    assert ctx.check_hostname is False
    assert ctx.verify_mode == ssl.CERT_NONE


async def test_get_pool_passes_ssl_none_when_dsn_has_sslmode(monkeypatch):
    captured = {}

    async def fake_create_pool(dsn, **kwargs):
        captured.update(kwargs, dsn=dsn)
        return object()

    monkeypatch.setattr(database.asyncpg, "create_pool", fake_create_pool)
    monkeypatch.setattr(database, "_pool", None)
    await database.get_pool()
    assert "sslmode=disable" in captured["dsn"]
    assert captured["ssl"] is None


async def test_get_pool_connects_to_postgres_without_ssl():
    """The test database runs without SSL, like a CI service container."""
    try:
        pool = await database.get_pool()
        assert await pool.fetchval("SELECT 1") == 1
    finally:
        await database.close_pool()


# ─── Lookups ───


async def test_select_one_returns_none_for_ids_that_cannot_exist(client):
    for bad_id in ["not-a-uuid", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz", ""]:
        assert await database.select_one("products", bad_id) is None, bad_id
    assert await database.select_one("products", str(uuid.uuid4())) is None


# ─── Startup: restarts don't add settings rows ───


async def test_restarts_do_not_add_settings_rows(client):
    # The old startup script inserted an empty settings row owned by no one at every start
    pool = await database.get_pool()
    before = await pool.fetchval("SELECT count(*) FROM settings")
    for _ in range(2):
        async with main.lifespan(main.app):
            pass
    pool = await database.get_pool()
    assert await pool.fetchval("SELECT count(*) FROM settings") == before


# ─── insert() and update() convert values by column type ───


async def test_uuid_shaped_text_is_stored_as_text(client, register):
    # A UUID-shaped string used to become a UUID object, which a TEXT column rejects
    _, user = await register()
    product_id = str(uuid.uuid4())
    template = await database.insert("templates", {
        "name": "From product", "type": "email", "content": product_id, "source_product": product_id, "user_id": user["id"],
    })
    assert (template["content"], template["source_product"]) == (product_id, product_id)


async def test_iso_datetime_text_is_stored_as_text(client, register):
    # An ISO datetime string used to become a datetime, which a TEXT column rejects
    _, user = await register()
    template = await database.insert("templates", {
        "name": "Timestamp", "type": "note", "content": "2026-09-16T10:00:00+00:00", "user_id": user["id"],
    })
    assert template["content"] == "2026-09-16T10:00:00+00:00"


async def test_iso_strings_become_dates_and_datetimes_for_those_columns(client, register):
    _, user = await register()
    product = await database.insert("products", {"name": "Dated", "user_id": user["id"], "launch_date": "2026-10-01"})
    assert product["launch_date"] == "2026-10-01"
    updated = await database.update("products", product["id"], {"updated_at": "2026-09-16T10:00:00+00:00"})
    assert datetime.fromisoformat(updated["updated_at"]) == datetime(2026, 9, 16, 10, tzinfo=UTC)
    event = await database.insert("calendar_events", {"date": date(2026, 10, 2), "title": "Launch", "user_id": user["id"]})
    assert event["date"] == "2026-10-02"
