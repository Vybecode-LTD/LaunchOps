"""Sessions: short-lived access tokens and rotating refresh tokens (docs/PHASE1_DESIGN.md D7)."""

from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

import database
import main
import routers.auth

REFRESH_COOKIE = "launchops_refresh"
SESSION_ENDED = {"detail": "Your session has ended. Sign in again."}


def _device(refresh_token: str | None = None) -> httpx.AsyncClient:
    """Another browser: its own cookie jar, optionally holding a refresh token."""
    device = httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test")
    if refresh_token:
        device.cookies.set(REFRESH_COOKIE, refresh_token, path="/api/auth")
    return device


async def test_signing_in_sets_a_refresh_cookie_scripts_cant_read(client, register):
    await register("ana@example.com")

    resp = await client.post("/api/auth/login", json={"email": "ana@example.com", "password": "password123"})

    cookie = resp.headers["set-cookie"].lower()
    assert cookie.startswith(f"{REFRESH_COOKIE}=")
    for attribute in ("httponly", "path=/api/auth", "samesite=strict", f"max-age={30 * 24 * 3600}"):
        assert attribute in cookie
    assert "secure" not in cookie, "Secure is set for https requests only (tests use http)"


async def test_the_refresh_cookie_is_secure_over_https(register):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="https://launchops.test") as secure:
        resp = await secure.post("/api/auth/register", json={"email": "sec@example.com", "password": "password123"})
    assert "secure" in resp.headers["set-cookie"].lower()


async def test_access_tokens_last_fifteen_minutes(client, register):
    token, _ = await register()
    claims = jwt.decode(token, options={"verify_signature": False})
    assert abs(claims["exp"] - claims["iat"] - 15 * 60) < 1  # exp is whole seconds; iat keeps microseconds


async def test_an_expired_access_token_is_refused(client, register, auth, monkeypatch):
    monkeypatch.setattr(routers.auth.get_settings(), "access_token_minutes", -1)
    token, _ = await register()
    resp = await client.get("/api/auth/me", headers=auth(token))
    assert (resp.status_code, resp.json()) == (401, {"detail": "Invalid or expired token"})


async def test_refreshing_rotates_the_cookie_and_issues_a_new_access_token(client, register, auth):
    await register("ana@example.com")
    first = client.cookies.get(REFRESH_COOKIE)

    resp = await client.post("/api/auth/refresh")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == "ana@example.com"
    assert [o["role"] for o in body["user"]["organisations"]] == ["owner"]
    assert client.cookies.get(REFRESH_COOKIE) not in (None, first)
    assert (await client.get("/api/auth/me", headers=auth(body["token"]))).status_code == 200


async def test_refreshing_without_a_cookie_ends_the_session(client):
    resp = await client.post("/api/auth/refresh")
    assert (resp.status_code, resp.json()) == (401, SESSION_ENDED)


async def test_two_tabs_refreshing_at_once_both_stay_signed_in(client, register):
    await register("ana@example.com")
    shared = client.cookies.get(REFRESH_COOKIE)

    async with _device(shared) as other_tab:
        first = await client.post("/api/auth/refresh")
        second = await other_tab.post("/api/auth/refresh")  # the same token, a moment later

    assert (first.status_code, second.status_code) == (200, 200)
    assert (await client.post("/api/auth/refresh")).status_code == 200


async def test_reusing_an_old_refresh_token_ends_every_session_from_that_sign_in(client, register, monkeypatch):
    await register("ana@example.com")
    stolen = client.cookies.get(REFRESH_COOKIE)
    assert (await client.post("/api/auth/refresh")).status_code == 200
    monkeypatch.setattr(routers.auth, "REUSE_GRACE", timedelta(0))

    async with _device(stolen) as attacker:
        replayed = await attacker.post("/api/auth/refresh")

    assert (replayed.status_code, replayed.json()) == (401, SESSION_ENDED)
    assert (await client.post("/api/auth/refresh")).json() == SESSION_ENDED, "the real user's newer token is revoked too"


async def test_sessions_from_other_sign_ins_survive_a_revoked_one(client, register, monkeypatch):
    await register("ana@example.com")
    async with _device() as laptop:
        await laptop.post("/api/auth/login", json={"email": "ana@example.com", "password": "password123"})
        stolen = client.cookies.get(REFRESH_COOKIE)
        await client.post("/api/auth/refresh")
        monkeypatch.setattr(routers.auth, "REUSE_GRACE", timedelta(0))
        async with _device(stolen) as attacker:
            await attacker.post("/api/auth/refresh")

        assert (await laptop.post("/api/auth/refresh")).status_code == 200


async def test_an_expired_refresh_token_ends_the_session(client, register):
    await register("ana@example.com")
    pool = await database.get_pool()
    await pool.execute("UPDATE refresh_tokens SET expires_at = $1", datetime.now(UTC) - timedelta(seconds=1))

    resp = await client.post("/api/auth/refresh")

    assert (resp.status_code, resp.json()) == (401, SESSION_ENDED)
    assert "max-age=0" in resp.headers["set-cookie"].lower()


async def test_a_disabled_account_cant_refresh(client, register, auth):
    admin_token, _ = await register("admin@example.com")
    async with _device() as member:
        registered = await member.post("/api/auth/register", json={"email": "sam@example.com", "password": "password123"})
        await client.patch(f"/api/auth/admin/users/{registered.json()['user']['id']}", headers=auth(admin_token), json={"enabled": False})

        resp = await member.post("/api/auth/refresh")

    assert (resp.status_code, resp.json()) == (401, SESSION_ENDED)


async def test_signing_out_revokes_the_refresh_token(client, register):
    await register("ana@example.com")
    token = client.cookies.get(REFRESH_COOKIE)

    signed_out = await client.post("/api/auth/logout")

    assert (signed_out.status_code, signed_out.json()) == (200, {"status": "signed_out"})
    assert "max-age=0" in signed_out.headers["set-cookie"].lower()
    async with _device(token) as copy:
        assert (await copy.post("/api/auth/refresh")).json() == SESSION_ENDED


@pytest.mark.parametrize("path", ["/api/auth/refresh", "/api/auth/logout"])
async def test_session_routes_need_no_access_token(client, path):
    resp = await client.post(path)
    assert resp.status_code != 401 or resp.json() == SESSION_ENDED
