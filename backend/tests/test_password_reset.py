"""Password reset: by email, or with a link an administrator creates (docs/PHASE1_DESIGN.md D7, D8)."""

import logging
import re
from datetime import UTC, datetime, timedelta

import httpx

import database
import main
from services import ratelimit

REFRESH_COOKIE = "launchops_refresh"
INVALID_LINK = {"detail": "This reset link has expired or has already been used. Ask for a new one."}


def _token_in(body: str) -> str:
    match = re.search(r"/reset-password/([A-Za-z0-9_-]+)", body)
    assert match, body
    return match.group(1)


async def test_asking_for_a_reset_answers_the_same_whether_or_not_the_account_exists(client, register, mailer):
    await register("ana@example.com")

    known = await client.post("/api/auth/password-reset", json={"email": " ANA@example.com "})
    unknown = await client.post("/api/auth/password-reset", json={"email": "nobody@example.com"})

    assert (known.status_code, known.json()) == (202, {"status": "requested"})
    assert (unknown.status_code, unknown.json()) == (202, {"status": "requested"})
    [message] = mailer.sent
    assert (message.to, message.subject) == ("ana@example.com", "Reset your LaunchOps password")
    assert "https://launchops.example/reset-password/" in message.body
    assert "expires in 1 hour" in message.body


async def test_without_a_mail_server_nothing_is_sent_and_no_link_is_logged(client, register, caplog):
    caplog.set_level(logging.INFO)
    await register("ana@example.com")

    resp = await client.post("/api/auth/password-reset", json={"email": "ana@example.com"})

    assert resp.status_code == 202
    assert "no mail server is configured" in caplog.text
    pool = await database.get_pool()
    assert await pool.fetchval("SELECT count(*) FROM password_resets") == 0, "nothing to send it with, so no link is created"
    assert "reset-password/" not in caplog.text


async def test_reset_requests_are_rate_limited(client, register, mailer, monkeypatch):
    monkeypatch.setattr(ratelimit.get_settings(), "rate_limit_enabled", True)
    ratelimit.reset_all()
    for _ in range(ratelimit.PASSWORD_RESETS_PER_ACCOUNT.limit):
        assert (await client.post("/api/auth/password-reset", json={"email": "ana@example.com"})).status_code == 202

    resp = await client.post("/api/auth/password-reset", json={"email": "ana@example.com"})

    assert resp.status_code == 429
    assert resp.json()["detail"].startswith("Too many reset requests for this email address. Try again in")
    ratelimit.reset_all()


async def test_a_reset_link_sets_a_new_password_and_ends_every_session(client, register, mailer, auth):
    old_access, _ = await register("ana@example.com", password="old-password")
    old_refresh = client.cookies.get(REFRESH_COOKIE)
    await client.post("/api/auth/password-reset", json={"email": "ana@example.com"})
    token = _token_in(mailer.sent[0].body)

    described = await client.get(f"/api/auth/password-reset/{token}")
    short = await client.post(f"/api/auth/password-reset/{token}", json={"password": "short"})
    done = await client.post(f"/api/auth/password-reset/{token}", json={"password": "new-password-1"})

    assert (described.status_code, described.json()) == (200, {"email": "ana@example.com"})
    assert (short.status_code, short.json()) == (400, {"detail": "Password must be at least 8 characters"})
    assert done.status_code == 200, done.text
    assert done.json()["user"]["email"] == "ana@example.com"
    assert (await client.get("/api/auth/me", headers=auth(done.json()["token"]))).status_code == 200, "signed in on this device"
    old_login = await client.post("/api/auth/login", json={"email": "ana@example.com", "password": "old-password"})
    assert old_login.status_code == 401
    assert (await client.post("/api/auth/login", json={"email": "ana@example.com", "password": "new-password-1"})).status_code == 200
    # Everything signed in before the reset is signed out
    assert (await client.get("/api/auth/me", headers=auth(old_access))).status_code == 401
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as other_device:
        other_device.cookies.set(REFRESH_COOKIE, old_refresh, path="/api/auth")
        assert (await other_device.post("/api/auth/refresh")).status_code == 401
    # The link works once
    assert (await client.get(f"/api/auth/password-reset/{token}")).json() == INVALID_LINK


async def test_an_expired_or_unknown_reset_link_does_nothing(client, register, mailer):
    await register("ana@example.com", password="old-password")
    await client.post("/api/auth/password-reset", json={"email": "ana@example.com"})
    token = _token_in(mailer.sent[0].body)
    pool = await database.get_pool()
    await pool.execute("UPDATE password_resets SET expires_at = $1", datetime.now(UTC) - timedelta(seconds=1))

    for link in (token, "not-a-real-token"):
        assert (await client.get(f"/api/auth/password-reset/{link}")).json() == INVALID_LINK
        resp = await client.post(f"/api/auth/password-reset/{link}", json={"password": "new-password-1"})
        assert (resp.status_code, resp.json()) == (404, INVALID_LINK)
    assert (await client.post("/api/auth/login", json={"email": "ana@example.com", "password": "old-password"})).status_code == 200


async def test_administrators_create_one_time_reset_links(client, register, auth):
    admin_token, _ = await register("admin@example.com")
    member_token, member = await register("sam@example.com")
    path = f"/api/auth/admin/users/{member['id']}/reset-link"

    denied = await client.post(path, headers=auth(member_token))
    first = await client.post(path, headers=auth(admin_token))
    second = await client.post(path, headers=auth(admin_token))

    assert denied.status_code == 403
    assert first.status_code == 201, first.text
    assert first.json()["link"].startswith("/reset-password/")
    expires = datetime.fromisoformat(first.json()["expires_at"])
    assert timedelta(hours=23) < expires - datetime.now(UTC) <= timedelta(hours=24)
    first_token = _token_in(first.json()["link"])
    assert (await client.get(f"/api/auth/password-reset/{first_token}")).json() == INVALID_LINK, "a new link replaces the old one"
    second_token = _token_in(second.json()["link"])
    assert (await client.get(f"/api/auth/password-reset/{second_token}")).json() == {"email": "sam@example.com"}
    unknown = await client.post("/api/auth/admin/users/00000000-0000-4000-8000-000000000000/reset-link", headers=auth(admin_token))
    assert (unknown.status_code, unknown.json()) == (404, {"detail": "User not found"})


async def test_invitations_are_emailed_when_a_mail_server_is_configured(client, register, auth, mailer):
    owner_token, _ = await register("olivia@example.com", name="Olivia")

    resp = await client.post("/api/organisation/invitations", headers=auth(owner_token), json={
        "email": "nina@example.com", "role": "editor",
    })

    assert resp.status_code == 201, resp.text
    assert resp.json()["emailed"] is True
    [message] = mailer.sent
    assert (message.to, message.subject) == ("nina@example.com", "Olivia invited you to Olivia's organisation on LaunchOps")
    assert f"https://launchops.example{resp.json()['link']}" in message.body
    assert "as an Editor" in message.body


async def test_invitations_arent_emailed_without_a_mail_server(client, register, auth):
    owner_token, _ = await register("olivia@example.com", name="Olivia")
    resp = await client.post("/api/organisation/invitations", headers=auth(owner_token), json={
        "email": "nina@example.com", "role": "editor",
    })
    assert resp.json()["emailed"] is False
