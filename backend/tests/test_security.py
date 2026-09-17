"""Hardening (finding F-7): startup guard, API docs, CORS, security headers, rate limits, passwords."""

import httpx
import pytest

import config
import main
import routers.auth
from services import ratelimit


def _client_for(app, base_url: str = "http://test") -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=base_url)


@pytest.fixture
def settings(monkeypatch):
    """settings(**values) changes the cached settings for one test. create_app() reads them when called."""
    current = config.get_settings()

    def change(**values):
        for key, value in values.items():
            monkeypatch.setattr(current, key, value)
        return current

    return change


@pytest.fixture
def rate_limits(settings):
    """Rate limiting is off for the rest of the suite; these tests switch it on with empty counters."""
    settings(rate_limit_enabled=True)
    ratelimit.reset_all()
    yield
    ratelimit.reset_all()


# ─── Startup guard ───


@pytest.mark.parametrize("secret", ["", "change-me-in-production", "31-characters-is-not-enough-xx"])
async def test_startup_refuses_a_weak_jwt_secret_outside_debug_mode(settings, secret):
    settings(debug=False, jwt_secret=secret)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        async with main.lifespan(main.app):
            pass


@pytest.mark.parametrize("key", ["", "not-a-fernet-key"])
async def test_startup_refuses_a_missing_or_invalid_encryption_key_outside_debug_mode(settings, key):
    settings(debug=False, field_encryption_key=key)
    with pytest.raises(RuntimeError, match="FIELD_ENCRYPTION_KEY"):
        async with main.lifespan(main.app):
            pass


async def test_debug_mode_starts_with_a_development_secret(settings):
    settings(debug=True, jwt_secret="dev", field_encryption_key="")
    async with main.lifespan(main.app):
        pass


# ─── API docs ───


async def test_api_docs_are_only_served_in_debug_mode(settings):
    settings(debug=False)
    async with _client_for(main.create_app()) as api:
        for path in ["/docs", "/redoc", "/openapi.json"]:
            assert (await api.get(path)).status_code == 404, path

    settings(debug=True)
    async with _client_for(main.create_app()) as api:
        assert (await api.get("/openapi.json")).status_code == 200
        assert (await api.get("/docs")).status_code == 200


# ─── CORS ───


async def test_cross_origin_calls_are_only_allowed_from_configured_origins(settings):
    preflight = {
        "Origin": "https://app.partner.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    }
    settings(cors_origins="")
    async with _client_for(main.create_app()) as api:
        resp = await api.options("/api/products", headers=preflight)
        assert "access-control-allow-origin" not in resp.headers

    settings(cors_origins="https://app.partner.example, http://localhost:5173")
    async with _client_for(main.create_app()) as api:
        allowed = await api.options("/api/products", headers=preflight)
        assert allowed.status_code == 200, allowed.text
        assert allowed.headers["access-control-allow-origin"] == "https://app.partner.example"
        # Sign-in uses a bearer header, never cookies, so browsers must not send credentials.
        assert "access-control-allow-credentials" not in allowed.headers
        other = await api.options("/api/products", headers={**preflight, "Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in other.headers


# ─── Security headers ───


async def test_responses_carry_security_headers(client):
    resp = await client.get("/health")
    policy = dict(
        part.strip().split(" ", 1) for part in resp.headers["content-security-policy"].split(";") if part.strip()
    )
    assert policy["default-src"] == "'self'"
    assert policy["script-src"] == "'self'"
    assert policy["object-src"] == "'none'"
    assert policy["frame-ancestors"] == "'none'"
    assert policy["base-uri"] == "'self'"
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert resp.headers["cross-origin-opener-policy"] == "same-origin"
    assert "strict-transport-security" not in resp.headers


async def test_https_responses_tell_browsers_to_stay_on_https():
    async with _client_for(main.app, base_url="https://test") as api:
        resp = await api.get("/health")
    assert resp.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"


# ─── Rate limits ───


async def test_sign_in_attempts_are_limited_per_account(client, register, rate_limits):
    await register("dana@example.com", password="correct-horse-1")
    for _ in range(10):
        wrong = await client.post("/api/auth/login", json={"email": "dana@example.com", "password": "wrong-password"})
        assert wrong.status_code == 401
    blocked = await client.post("/api/auth/login", json={"email": "DANA@example.com", "password": "correct-horse-1"})
    assert blocked.status_code == 429, blocked.text
    assert 0 < int(blocked.headers["retry-after"]) <= 15 * 60
    assert blocked.json()["detail"].startswith("Too many sign-in attempts")


async def test_sign_in_attempts_are_limited_per_address(client, rate_limits):
    for n in range(30):
        resp = await client.post("/api/auth/login", json={"email": f"guess{n}@example.com", "password": "whatever-1"})
        assert resp.status_code == 401
    blocked = await client.post("/api/auth/login", json={"email": "another@example.com", "password": "whatever-1"})
    assert blocked.status_code == 429, blocked.text


async def test_account_creation_is_limited_per_address(client, rate_limits):
    for n in range(10):
        resp = await client.post("/api/auth/register", json={"email": f"new{n}@example.com", "password": "long-enough-1"})
        assert resp.status_code == 200, resp.text
    blocked = await client.post("/api/auth/register", json={"email": "one-more@example.com", "password": "long-enough-1"})
    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["detail"].startswith("Too many new accounts")


async def test_ai_operations_are_limited_per_account(client, register, auth, create_product, fake_ai, settings, rate_limits):
    settings(ai_operations_per_hour=2)
    token, _ = await register()
    other_token, _ = await register()
    product = await create_product(token)
    headers = auth(token)
    fake_ai.response = {"tiers": [{"name": "Pro", "price": "$29"}]}

    for _ in range(2):
        ok = await client.post("/api/pricing/analyze", headers=headers, json={"product_id": product["id"]})
        assert ok.status_code == 200, ok.text
    blocked = await client.post(
        "/api/workflows/launch", headers=headers, json={"product_id": product["id"], "workflow_id": "blog"},
    )
    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["detail"].startswith("You've run 2 AI operations in the last hour")
    assert len(fake_ai.calls) == 2

    # Another account has its own allowance
    other_product = await create_product(other_token)
    resp = await client.post("/api/pricing/analyze", headers=auth(other_token), json={"product_id": other_product["id"]})
    assert resp.status_code == 200, resp.text


async def test_running_operations_are_capped_per_account(client, register, auth, create_product, make_queue_item, settings):
    settings(max_concurrent_tasks=2)
    token, user = await register()
    product = await create_product(token)
    for _ in range(2):
        await make_queue_item(user, product, status="running")
    resp = await client.post(
        "/api/workflows/launch", headers=auth(token), json={"product_id": product["id"], "workflow_id": "blog"},
    )
    assert resp.status_code == 429, resp.text
    assert resp.json()["detail"] == "You already have 2 operations running. Start another when one finishes."


# ─── Passwords ───


@pytest.mark.parametrize(
    ("password", "status"),
    [("seven77", 400), ("x" * 73, 400), ("eight888", 200), ("ü" * 36, 200), ("ü" * 37, 400)],
)
async def test_new_passwords_must_be_8_to_72_bytes(client, register, auth, password, status):
    resp = await client.post("/api/auth/register", json={"email": "len@example.com", "password": password})
    assert resp.status_code == status, resp.text
    if status == 400:
        assert resp.json()["detail"] in {
            "Password must be at least 8 characters",
            "Password must be at most 72 bytes (about 72 letters, fewer with accents or emoji)",
        }


async def test_admin_created_accounts_follow_the_same_password_rules(client, register, auth):
    admin_token, _ = await register()
    resp = await client.post(
        "/api/auth/admin/users", headers=auth(admin_token), json={"email": "short@example.com", "password": "seven77"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Password must be at least 8 characters"


async def test_unknown_accounts_get_the_same_password_check(client, monkeypatch):
    """So response time doesn't reveal which emails have accounts."""
    checked = []
    real_verify = routers.auth.verify_password

    def counting_verify(password, password_hash):
        checked.append(password_hash)
        return real_verify(password, password_hash)

    monkeypatch.setattr(routers.auth, "verify_password", counting_verify)
    resp = await client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever-123"})
    assert resp.status_code == 401
    assert len(checked) == 1
