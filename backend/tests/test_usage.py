"""AI usage ledger, costs and budgets per organisation (docs/PHASE1_DESIGN.md D12)."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

import config
import database
from services import pricing
from services.claude import UsageContext


@pytest.fixture
async def owner(client, register, auth, create_product):
    token, user = await register("olivia@example.com", name="Olivia")
    headers = auth(token)
    org_id = (await client.get("/api/auth/me", headers=headers)).json()["organisations"][0]["id"]
    product = await create_product(token, name="Launch Ops")
    return type("Owner", (), {"token": token, "user": user, "headers": headers, "org_id": org_id, "product": product})


async def _usage_row(org_id, user_id, product_id, operation, model, cost, *, month=None, input_tokens=1000, output_tokens=500, searches=0):
    created_at = month or datetime.now(UTC)
    await database.insert("ai_usage", {
        "org_id": org_id, "user_id": user_id, "product_id": product_id, "operation": operation, "model": model,
        "input_tokens": input_tokens, "output_tokens": output_tokens, "web_search_requests": searches,
        "cost_usd": Decimal(str(cost)), "created_at": created_at,
    })


# ─── Prices ───


@pytest.mark.parametrize(("model", "expected"), [
    # 1,000 input, 2,000 output, 3,000 cache writes, 10,000 cache reads
    ("claude-sonnet-5", Decimal("0.0020") + Decimal("0.0200") + Decimal("0.0075") + Decimal("0.0020")),
    ("claude-opus-5", Decimal("0.0050") + Decimal("0.0500") + Decimal("0.01875") + Decimal("0.0050")),
    ("claude-haiku-4-5-20251001", Decimal("0.0010") + Decimal("0.0100") + Decimal("0.00375") + Decimal("0.0010")),
    ("claude-fable-5-1", Decimal("0.0100") + Decimal("0.1000") + Decimal("0.0375") + Decimal("0.0025")),
])
def test_costs_follow_the_published_prices(model, expected):
    usage = pricing.TokenUsage(input_tokens=1000, output_tokens=2000, cache_creation_input_tokens=3000, cache_read_input_tokens=10000)
    assert pricing.cost_usd(model, usage) == expected


def test_a_model_without_a_known_price_costs_nothing_and_says_so():
    usage = pricing.TokenUsage(input_tokens=1000, output_tokens=1000)
    assert pricing.cost_usd("claude-future-9", usage) is None
    assert pricing.cost_usd("claude-future-9", usage, web_search_requests=3) is None


def test_web_searches_cost_ten_dollars_per_thousand_on_top_of_tokens():
    usage = pricing.TokenUsage(input_tokens=1000)
    assert pricing.cost_usd("claude-sonnet-5", usage, web_search_requests=3) == Decimal("0.0020") + Decimal("0.03")


# ─── The ledger ───


async def test_operations_record_who_used_what_for_which_project(client, owner, fake_ai, run_jobs):
    fake_ai.response = {"trends": []}

    await client.post("/api/workflows/launch", headers=owner.headers, json={"product_id": owner.product["id"], "workflow_id": "trend"})
    await run_jobs()
    await client.post("/api/pricing/analyze", headers=owner.headers, json={"product_id": owner.product["id"]})

    assert [call.usage for call in fake_ai.calls] == [
        UsageContext(org_id=owner.org_id, user_id=owner.user["id"], product_id=owner.product["id"], operation="trend"),
        UsageContext(org_id=owner.org_id, user_id=owner.user["id"], product_id=owner.product["id"], operation="pricing"),
    ]


# ─── Budgets ───


async def test_owners_set_a_monthly_budget(client, owner, register, auth):
    member_token, member = await register("ed@example.com")
    await database.insert("memberships", {"org_id": owner.org_id, "user_id": member["id"], "role": "approver"})

    denied = await client.put("/api/organisation/budget", headers={**auth(member_token), "X-Org-Id": owner.org_id},
                              json={"monthly_ai_budget_usd": 10})
    saved = await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 50})
    negative = await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": -1})
    cleared = await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": None})

    assert denied.status_code == 403
    assert (saved.status_code, saved.json()) == (200, {"monthly_ai_budget_usd": 50.0})
    assert negative.status_code == 422
    assert cleared.json() == {"monthly_ai_budget_usd": None}


async def test_operations_stop_when_the_months_budget_is_used(client, owner, fake_ai, run_jobs):
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 1})
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 0.99)
    within = await client.post("/api/workflows/launch", headers=owner.headers, json={"product_id": owner.product["id"], "workflow_id": "trend"})
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 0.02)

    launch = await client.post("/api/workflows/launch", headers=owner.headers, json={"product_id": owner.product["id"], "workflow_id": "trend"})
    report = await client.post("/api/pricing/analyze", headers=owner.headers, json={"product_id": owner.product["id"]})

    assert within.status_code == 200
    month = datetime.now(UTC).strftime("%B")
    message = f"Olivia's organisation has used its AI budget for {month} ($1.00). An owner can raise it in Settings → Usage."
    assert (launch.status_code, launch.json()) == (429, {"detail": message})
    assert (report.status_code, report.json()) == (429, {"detail": message})


async def test_last_months_spending_doesnt_count_against_this_months_budget(client, owner, fake_ai):
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 1})
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 5, month=datetime(2020, 1, 15, tzinfo=UTC))

    resp = await client.post("/api/workflows/launch", headers=owner.headers, json={"product_id": owner.product["id"], "workflow_id": "trend"})

    assert resp.status_code == 200


# ─── The usage summary ───


async def test_owners_see_the_months_usage_by_operation_project_member_and_model(client, owner, register, auth, create_product):
    member_token, member = await register("ed@example.com", name="Ed")
    await database.insert("memberships", {"org_id": owner.org_id, "user_id": member["id"], "role": "editor"})
    other = await create_product(owner.token, name="Second Venture")
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 25})
    rows = [
        (owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 0.10, 2),
        (owner.user["id"], owner.product["id"], "market_analysis", "claude-opus-5", 1.50, 12),
        (member["id"], other["id"], "trend", "claude-sonnet-5", 0.20, 3),
    ]
    for user_id, product_id, operation, model, cost, searches in rows:
        await _usage_row(owner.org_id, user_id, product_id, operation, model, cost, searches=searches)
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 9, month=datetime(2020, 1, 15, tzinfo=UTC))

    denied = await client.get("/api/organisation/usage", headers={**auth(member_token), "X-Org-Id": owner.org_id})
    usage = (await client.get("/api/organisation/usage", headers=owner.headers)).json()

    assert denied.status_code == 403
    assert usage["month"] == datetime.now(UTC).strftime("%Y-%m")
    assert usage["budget_usd"] == 25.0
    assert usage["total"] == {
        "cost_usd": 1.8, "calls": 3, "input_tokens": 3000, "output_tokens": 1500,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0, "web_search_requests": 17, "unpriced_calls": 0,
    }
    assert [(r["key"], r["cost_usd"], r["calls"]) for r in usage["by_operation"]] == [("market_analysis", 1.5, 1), ("trend", 0.3, 2)]
    assert [(r["label"], r["cost_usd"]) for r in usage["by_project"]] == [("Launch Ops", 1.6), ("Second Venture", 0.2)]
    assert [(r["label"], r["cost_usd"]) for r in usage["by_member"]] == [("olivia@example.com", 1.6), ("ed@example.com", 0.2)]
    assert [(r["key"], r["cost_usd"]) for r in usage["by_model"]] == [("claude-opus-5", 1.5), ("claude-sonnet-5", 0.3)]


async def test_usage_for_an_earlier_month(client, owner):
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 9, month=datetime(2020, 1, 15, tzinfo=UTC))

    january = (await client.get("/api/organisation/usage?month=2020-01", headers=owner.headers)).json()
    invalid = await client.get("/api/organisation/usage?month=January", headers=owner.headers)

    assert (january["month"], january["total"]["cost_usd"], january["total"]["calls"]) == ("2020-01", 9.0, 1)
    assert (invalid.status_code, invalid.json()) == (422, {"detail": "Give the month as YYYY-MM, for example 2026-09."})


async def test_calls_to_models_without_a_price_are_counted_separately(client, owner):
    await database.insert("ai_usage", {
        "org_id": owner.org_id, "user_id": owner.user["id"], "product_id": owner.product["id"], "operation": "trend",
        "model": "claude-future-9", "input_tokens": 10, "output_tokens": 10, "cost_usd": None,
    })

    usage = (await client.get("/api/organisation/usage", headers=owner.headers)).json()

    assert (usage["total"]["calls"], usage["total"]["unpriced_calls"], usage["total"]["cost_usd"]) == (1, 1, 0.0)


async def test_an_organisation_without_its_own_budget_is_capped_by_the_platform_default(client, owner, fake_ai, run_jobs, monkeypatch):
    """Registration creates an organisation with no budget of its own, and every deployment bills AI to one
    API key. Without a platform default, anyone who signs up could spend on that key without limit, so the
    default applies until an owner deliberately sets their own."""
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(2))
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 2.5)

    launch = await client.post("/api/workflows/launch", headers=owner.headers,
                               json={"product_id": owner.product["id"], "workflow_id": "trend"})

    month = datetime.now(UTC).strftime("%B")
    message = f"Olivia's organisation has used the default AI budget for {month} ($2.00). An owner can set a higher budget in Settings → Usage."
    assert (launch.status_code, launch.json()) == (429, {"detail": message})


async def test_an_organisations_own_budget_wins_over_the_platform_default(client, owner, fake_ai, run_jobs, monkeypatch):
    """The default is a floor for organisations that never set one, not a ceiling on those that did."""
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(2))
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 50})
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 2.5)

    launch = await client.post("/api/workflows/launch", headers=owner.headers,
                               json={"product_id": owner.product["id"], "workflow_id": "trend"})

    assert launch.status_code == 200


async def test_a_zero_platform_default_leaves_an_organisation_uncapped(client, owner, fake_ai, run_jobs, monkeypatch):
    """A deployment that wants no default cap sets the value to 0, the same way MAX_EMAILS_PER_DAY switches
    sending off. That is the deliberate opt-out; it is never what an unconfigured deployment gets."""
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(0))
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 500)

    launch = await client.post("/api/workflows/launch", headers=owner.headers,
                               json={"product_id": owner.product["id"], "workflow_id": "trend"})

    assert launch.status_code == 200


async def test_clearing_a_budget_falls_back_to_the_platform_default(client, owner, fake_ai, run_jobs, monkeypatch):
    """Clearing a budget means "no budget of our own", not "unlimited" — otherwise clearing it would be a
    one-click way to uncap an organisation on a shared API key."""
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(2))
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 50})
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": None})
    await _usage_row(owner.org_id, owner.user["id"], owner.product["id"], "trend", "claude-sonnet-5", 2.5)

    launch = await client.post("/api/workflows/launch", headers=owner.headers,
                               json={"product_id": owner.product["id"], "workflow_id": "trend"})

    assert launch.status_code == 429


def test_a_negative_platform_default_is_refused_at_startup():
    """Only exactly 0 opts out of the default cap. `ensure_within_budget` treats anything at or below
    zero as "no cap", so without a floor a mistyped negative value would start the app normally and
    quietly remove the safeguard the setting exists to provide. It must fail loudly instead."""
    with pytest.raises(ValidationError, match="default_monthly_ai_budget_usd"):
        config.Settings(default_monthly_ai_budget_usd=Decimal(-1))


def test_zero_and_positive_platform_defaults_are_accepted():
    assert config.Settings(default_monthly_ai_budget_usd=Decimal(0)).default_monthly_ai_budget_usd == 0
    assert config.Settings(default_monthly_ai_budget_usd=Decimal(40)).default_monthly_ai_budget_usd == 40


async def test_the_usage_summary_reports_the_default_budget_an_organisation_is_actually_under(client, owner, monkeypatch):
    """The summary used to return only the organisation's stored budget. Under the platform default
    that is NULL, so Settings -> Usage told owners operations would never stop for cost while they
    were in fact capped at the default — they would learn the truth from a 429."""
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(25))

    usage = (await client.get("/api/organisation/usage", headers=owner.headers)).json()

    assert usage["budget_usd"] is None  # still what the organisation set itself, for the edit form
    assert usage["default_budget_usd"] == 25.0
    assert usage["effective_budget_usd"] == 25.0
    assert usage["budget_source"] == "default"


async def test_the_usage_summary_reports_an_organisations_own_budget_as_its_own(client, owner, monkeypatch):
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(25))
    await client.put("/api/organisation/budget", headers=owner.headers, json={"monthly_ai_budget_usd": 60})

    usage = (await client.get("/api/organisation/usage", headers=owner.headers)).json()

    assert usage["budget_usd"] == 60.0
    assert usage["effective_budget_usd"] == 60.0
    assert usage["budget_source"] == "organisation"


async def test_the_usage_summary_reports_no_budget_only_when_there_really_is_none(client, owner, monkeypatch):
    monkeypatch.setattr(config.get_settings(), "default_monthly_ai_budget_usd", Decimal(0))

    usage = (await client.get("/api/organisation/usage", headers=owner.headers)).json()

    assert usage["default_budget_usd"] is None
    assert usage["effective_budget_usd"] is None
    assert usage["budget_source"] == "none"
