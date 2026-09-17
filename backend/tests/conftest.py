"""Shared fixtures for the LaunchOps backend test suite.

Tests run in-process against the real FastAPI app (httpx + ASGITransport) and a
real PostgreSQL database. The schema is set up once per run; every test starts
from emptied tables and gets its own connection pool, bound to that test's event
loop. Claude, the URL scraper and SMTP are always faked — tests never touch the network.
"""

import asyncio
import copy
import functools
import itertools
import os
import sys
import threading
from types import SimpleNamespace
from urllib.parse import urlparse

import bcrypt
import httpx
import pytest

DEFAULT_TEST_DSN = "postgresql://postgres@127.0.0.1:56432/launchops_test?sslmode=disable"

# Configure the app BEFORE importing it: config.get_settings() is lru_cached
# and main.py builds the app at import time. TEST_DATABASE_URL overrides the
# local default (e.g. a CI service container).
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DSN)
os.environ["JWT_SECRET"] = "test-secret-for-the-suite-only-0123456789abcdef"  # gitleaks:allow (tests only)
# Tests register many accounts quickly; tests/test_security.py switches limits on where it checks them.
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["FIELD_ENCRYPTION_KEY"] = "GrnEYDBMXQiNa-PvQ7aU2hm2nnsuakVIbDANXOL6kWE="  # gitleaks:allow (tests only)
os.environ["ANTHROPIC_API_KEY"] = ""
# Tests run jobs themselves (the run_jobs fixture), so no worker runs alongside them
os.environ["WORKER_ENABLED"] = "false"

# Every test empties all tables — refuse to run against a non-test database.
if "test" not in urlparse(os.environ["DATABASE_URL"]).path:
    pytest.exit("DATABASE_URL must name a *test* database: tests empty every table")

import config

config.get_settings.cache_clear()

import database
import main
import routers.queue
import routers.workflows
import services.claude
import services.email
import services.mailer
import services.scraper

# Every table the app writes to, emptied before each test (children before parents).
APP_TABLES = (
    "jobs", "ai_usage", "email_queue", "queue", "calendar_events", "captures", "templates", "settings",
    "products", "brands", "audit_log", "invitations", "memberships", "organisations",
    "refresh_tokens", "password_resets", "users", "app_config",
)

# What services.scraper.scrape_url returns for a reachable page.
SCRAPED_PAGE = {
    "status": "ok",
    "status_code": 200,
    "metadata": {"title": "Launch Ops", "description": "Launch faster", "og_title": "", "canonical": ""},
    "body_text": "Launch Ops helps creators ship software.",
    "headings": ["Ship faster"],
    "json_ld": [],
    "content_length": 1024,
}

_real_gensalt = bcrypt.gensalt
_user_numbers = itertools.count(1)


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def pytest_asyncio_loop_factories(config, item):
    """Event loops for async tests and fixtures.

    On Windows, asyncio's default Proactor loop can add about half a second to every
    asyncpg round trip (measured 2026-09-16: 515 ms per SELECT 1, against 0.6 ms on the
    selector loop), which stretches a one-minute suite past an hour. Production runs on
    Linux, where the default loop is already a selector loop.
    """
    if sys.platform == "win32":
        return {"selector": asyncio.SelectorEventLoop}
    return {"default": asyncio.new_event_loop}


@pytest.fixture(autouse=True)
def _fast_password_hashing(monkeypatch):
    """bcrypt's default 12 rounds dominate runtime; 4 rounds is still real bcrypt."""
    monkeypatch.setattr(bcrypt, "gensalt", functools.partial(_real_gensalt, rounds=4))


def _new_event_loop() -> asyncio.AbstractEventLoop:
    return asyncio.SelectorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()


@pytest.fixture(scope="session", autouse=True)
def _database_schema():
    """Set the schema up once per run.

    ASGITransport doesn't run the app lifespan, so the setup it would do happens here.
    Repeating it (and TRUNCATE) for every test cost about 1.5 s a test on slow disks.
    """
    with asyncio.Runner(loop_factory=_new_event_loop) as runner:
        runner.run(database.run_migrations())


@pytest.fixture
async def client():
    """API client on emptied tables.

    DELETE rather than TRUNCATE: TRUNCATE creates new table files, which is slow on some
    Windows disks. The pool is closed at teardown so the next test (on a new event loop)
    builds its own.
    """
    try:
        pool = await database.get_pool()
        # Only tables that exist — a table from a not-yet-applied migration can't be emptied
        rows = await pool.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
            list(APP_TABLES),
        )
        present = {r["tablename"] for r in rows}
        statements = [f"DELETE FROM {table}" for table in APP_TABLES if table in present]
        if statements:
            await pool.execute("; ".join(statements))
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as api:
            yield api
    finally:
        await database.close_pool()


@pytest.fixture
def auth():
    """auth(token) → Authorization headers."""
    return _bearer


@pytest.fixture
def register(client):
    """await register(email=None, password=..., name=...) → (token, user dict)."""
    async def _register(email: str | None = None, password: str = "password123", name: str = "Test User"):
        resp = await client.post("/api/auth/register", json={
            "email": email or f"user{next(_user_numbers)}@example.com",
            "password": password,
            "name": name,
        })
        assert resp.status_code == 200, resp.text
        body = resp.json()
        return body["token"], body["user"]
    return _register


@pytest.fixture
def create_product(client):
    """await create_product(token, **fields) → product dict (via the API)."""
    async def _create(token: str, **fields):
        resp = await client.post("/api/products", headers=_bearer(token), json={"name": "Launch Ops", **fields})
        assert resp.status_code == 201, resp.text
        return resp.json()
    return _create


@pytest.fixture
def make_queue_item(client):
    """Insert a queue row directly — in the app only workflows create them."""
    async def _make(user: dict, product: dict, workflow_id: str = "blog",
                    content: dict | None = None, status: str = "pending"):
        return await database.insert("queue", {
            "product_id": product["id"],
            "org_id": product["org_id"],
            "user_id": user["id"],
            "workflow_id": workflow_id,
            "status": status,
            "content": content if content is not None else {},
            "preview": f"{workflow_id} result",
        })
    return _make


@pytest.fixture
def make_email(client):
    """Insert an email_queue row directly; keyword args override the defaults."""
    async def _make(user: dict, product: dict, **fields):
        row = {
            "product_id": product["id"],
            "org_id": product["org_id"],
            "user_id": user["id"],
            "recipient_name": "Jane Doe",
            "recipient_email": "jane@example.com",
            "subject": "Hello",
            "body": "Hi Jane",
            "status": "pending",
        }
        row.update(fields)
        return await database.insert("email_queue", row)
    return _make


@pytest.fixture
def make_event(client):
    """Insert a calendar event directly (day is a datetime.date)."""
    async def _make(user: dict, product: dict, day, title: str = "Post", platform: str = "twitter"):
        return await database.insert("calendar_events", {
            "date": day,
            "product_id": product["id"],
            "org_id": product["org_id"],
            "user_id": user["id"],
            "product_name": product["name"],
            "platform": platform,
            "title": title,
            "color": product["color"],
        })
    return _make


@pytest.fixture
def smtp_config():
    """A complete per-product SMTP configuration (as the UI would save it)."""
    return {
        "smtp_host": "smtp.example.com",
        "smtp_port": 587,
        "smtp_user": "mailer",
        "smtp_password": "s3cret-pass",
        "from_name": "Launch Ops",
        "from_email": "ops@example.com",
        "reply_to": "",
        "use_tls": True,
    }


@pytest.fixture
def fake_smtp(monkeypatch):
    """Record routers.queue.send_email calls instead of talking to an SMTP server.

    Set .result to control the outcome; each call records the thread it ran on.
    """
    smtp = SimpleNamespace(calls=[], result={"success": True, "error": ""}, main_thread=threading.get_ident())

    def fake_send_email(smtp_settings, to_email, to_name, subject, body, from_name="", from_email=""):
        smtp.calls.append(SimpleNamespace(
            smtp_settings=dict(smtp_settings), to_email=to_email, to_name=to_name,
            subject=subject, body=body, thread=threading.get_ident(),
        ))
        return smtp.result

    monkeypatch.setattr(routers.queue, "send_email", fake_send_email)
    return smtp


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Nothing in a test reaches the Anthropic API, a website or a mail server.

    fake_ai, fake_smtp and the scraper tests' fake network replace these entry points for the
    tests that use them; anything else that gets this far fails loudly instead of going out.
    """
    def refuse(*args, **kwargs):
        raise AssertionError("A test tried to use the network. Use the fake_ai, fake_smtp or scraper network fixtures.")

    monkeypatch.setattr(services.claude, "_client", refuse)
    monkeypatch.setattr(services.scraper, "_resolve", refuse)
    monkeypatch.setattr(services.email.smtplib, "SMTP", refuse)
    monkeypatch.setattr(services.email.smtplib, "SMTP_SSL", refuse)


@pytest.fixture
def run_jobs(client):
    """await run_jobs() → run every ready job the way the worker does, until none are left. Returns how many ran."""
    from services import jobs

    return lambda: jobs.drain("test-worker")


@pytest.fixture
def mailer(monkeypatch):
    """A configured platform mail server that records what LaunchOps would email (.sent: to, subject, body)."""
    sent = []
    settings = config.get_settings()
    for name, value in {
        "app_url": "https://launchops.example", "mail_smtp_host": "smtp.launchops.example", "mail_smtp_user": "mailer",
        "mail_smtp_password": "mail-secret", "mail_from_email": "no-reply@launchops.example",
    }.items():
        monkeypatch.setattr(settings, name, value)

    async def deliver(to_email, subject, body):
        sent.append(SimpleNamespace(to=to_email, subject=subject, body=body))
        return True

    monkeypatch.setattr(services.mailer, "_deliver", deliver)
    return SimpleNamespace(sent=sent)


@pytest.fixture
def fake_ai(monkeypatch):
    """Fake Claude (services.claude.generate_result) and the URL scraper used by routers.workflows.

    Set .response to the result dict to return, or an exception to raise; .responses to answer
    calls in turn (then .response); .delay to take that many seconds; .scrape_result to override
    the scraped page. Each call records its prompt, the prompt's whole text (.system) and arguments.
    """
    ai = SimpleNamespace(response={}, responses=[], delay=0, calls=[], scrape_result=None, scraped_urls=[])

    async def fake_generate_result(prompt, user_message, result_type, *, web_search=False, max_tokens=None, model=None, usage=None):
        ai.calls.append(SimpleNamespace(
            prompt=prompt, system=prompt.text(), user_message=user_message, result_type=result_type,
            web_search=web_search, max_tokens=max_tokens, model=model, usage=usage,
        ))
        if ai.delay:
            await asyncio.sleep(ai.delay)
        response = ai.responses.pop(0) if ai.responses else ai.response
        if isinstance(response, Exception):
            raise response
        return copy.deepcopy(response)

    async def fake_scrape_url(url):
        ai.scraped_urls.append(url)
        return ai.scrape_result or {**SCRAPED_PAGE, "url": url}

    monkeypatch.setattr(routers.workflows, "generate_result", fake_generate_result)
    monkeypatch.setattr(routers.workflows, "scrape_url", fake_scrape_url)
    return ai
