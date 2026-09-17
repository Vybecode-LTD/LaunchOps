"""App factory: SPA static serving and its catch-all route."""

import logging

import httpx
import pytest

import config
import database
import main


@pytest.fixture
def spa_build(tmp_path, monkeypatch):
    """A minimal frontend build, so create_app() mounts the SPA catch-all."""
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<!doctype html><title>LaunchOps SPA</title>", encoding="utf-8")
    (static / "robots.txt").write_text("User-agent: *", encoding="utf-8")
    monkeypatch.setattr(main, "STATIC_DIR", static)
    return static


def _client_for(app) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


# ─── Baseline ───


async def test_spa_serves_static_files_and_client_routes(spa_build):
    async with _client_for(main.create_app()) as spa:
        assert "LaunchOps SPA" in (await spa.get("/")).text
        assert "LaunchOps SPA" in (await spa.get("/projects/123/queue")).text
        assert (await spa.get("/robots.txt")).text == "User-agent: *"
        assert (await spa.get("/health")).json() == {"status": "ok"}


# ─── B10: unknown /api routes are 404s, never the SPA ───


async def test_unknown_api_route_returns_404_json(register, auth, spa_build):
    token, _ = await register()
    async with _client_for(main.create_app()) as spa:
        resp = await spa.get("/api/does-not-exist", headers=auth(token))
    assert resp.status_code == 404, resp.text
    assert resp.json() == {"detail": "Not found"}


# ─── B18: the SPA fallback never serves files outside the frontend build ───


@pytest.mark.parametrize("path", ["/..%2Fsecret.txt", "/%2e%2e%2fsecret.txt", "/..%5Csecret.txt", "/assets/..%2F..%2Fsecret.txt"])
async def test_spa_fallback_does_not_serve_files_outside_the_build(spa_build, path):
    (spa_build.parent / "secret.txt").write_text("JWT_SECRET=do-not-leak", encoding="utf-8")
    async with _client_for(main.create_app()) as spa:
        resp = await spa.get(path)
    assert "do-not-leak" not in resp.text, (path, resp.status_code)


# ─── F-7: secrets never reach the logs ───


async def test_startup_runs_the_migrations(monkeypatch):
    calls = []

    async def record_migrations(database_url=None):
        calls.append(database_url)

    monkeypatch.setattr(main, "run_migrations", record_migrations)
    async with main.lifespan(main.app):
        pass
    assert calls == [None]


async def test_a_failed_migration_stops_the_app_from_starting(monkeypatch):
    async def failing_migrations(database_url=None):
        raise RuntimeError("migration 0003 failed")

    monkeypatch.setattr(main, "run_migrations", failing_migrations)
    with pytest.raises(RuntimeError, match="migration 0003 failed"):
        async with main.lifespan(main.app):
            pass
    await database.close_pool()


async def test_the_app_starts_without_a_reachable_database(monkeypatch, caplog):
    async def unreachable():
        raise ConnectionRefusedError("connection refused")

    async def unexpected_migrations(database_url=None):
        raise AssertionError("migrations need a database")

    monkeypatch.setattr(main, "get_pool", unreachable)
    monkeypatch.setattr(main, "run_migrations", unexpected_migrations)
    async with main.lifespan(main.app):
        pass
    assert "database isn't reachable" in caplog.text


async def test_startup_does_not_log_the_jwt_secret(caplog):
    caplog.set_level(logging.DEBUG)
    async with main.lifespan(main.app):
        pass
    secret = config.get_settings().jwt_secret
    assert "JWT_SECRET" not in caplog.text
    assert secret not in caplog.text
