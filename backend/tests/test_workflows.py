"""AI workflow routes. Claude and the scraper are always faked (see conftest.fake_ai)."""

from datetime import datetime, timedelta, timezone

import pytest

import config
import database
import main
from routers.workflows import _generate_preview
from services import jobs, results
from services.claude import (
    DEFAULT_MAX_TOKENS,
    MARKET_ANALYSIS_INSTRUCTIONS,
    PRESS_KIT_INSTRUCTIONS,
    PRESS_RELEASE_INSTRUCTIONS,
    PRICING_INSTRUCTIONS,
    REPURPOSE_INSTRUCTIONS,
    SEO_ANALYSIS_INSTRUCTIONS,
    WORKFLOW_PROMPTS,
    AIError,
    AIRefused,
    AITimeout,
    AIUnavailable,
)

# ─── Baseline ───


async def test_launch_workflow_lands_result_in_queue(client, register, auth, create_product, fake_ai, run_jobs):
    token, _ = await register()
    product = await create_product(token, name="Launch Ops")
    fake_ai.response = {"trends": [{"name": "AI mastering"}, {"name": "No-code DSP"}]}

    resp = await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "trend", "instructions": "Focus on Europe",
    })
    assert resp.status_code == 200, resp.text
    launched = resp.json()
    assert launched["status"] == "running"
    await run_jobs()

    item = (await client.get(f"/api/queue/{launched['task_id']}", headers=auth(token))).json()
    assert item["status"] == "pending"
    assert item["content"] == fake_ai.response
    assert item["preview"] == "Found 2 trends in the market"
    assert item["input_params"] == "Focus on Europe"
    assert "Focus on Europe" in fake_ai.calls[0].user_message
    assert "Launch Ops" in fake_ai.calls[0].system


async def test_launch_unknown_workflow_is_rejected(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    resp = await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "mind_reading",
    })
    assert resp.status_code == 400
    assert fake_ai.calls == []


async def test_failed_workflow_marks_queue_item_failed(client, register, auth, create_product, fake_ai, run_jobs):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = RuntimeError("model overloaded")
    launched = (await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "blog",
    })).json()
    await run_jobs()
    item = (await client.get(f"/api/queue/{launched['task_id']}", headers=auth(token))).json()
    assert item["status"] == "failed"
    assert item["content"] == {"error": "model overloaded"}


async def test_failed_workflow_records_the_readable_ai_error(client, register, auth, create_product, fake_ai, run_jobs, monkeypatch):
    token, _ = await register()
    product = await create_product(token)
    monkeypatch.setattr(jobs, "RETRY_DELAYS", [timedelta(0)])  # provider errors are retried first (see test_jobs.py)
    fake_ai.response = AIError("The AI provider returned an error (HTTP 529). Try again in a few minutes.")
    launched = (await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "blog",
    })).json()
    await run_jobs()
    item = (await client.get(f"/api/queue/{launched['task_id']}", headers=auth(token))).json()
    assert item["status"] == "failed"
    assert item["content"] == {"error": "The AI provider returned an error (HTTP 529). Try again in a few minutes."}
    assert item["preview"] == "Failed: The AI provider returned an error (HTTP 529). Try again in a few minutes."


# ─── F-10: which model, tools and output room each operation gets ───


@pytest.mark.parametrize("workflow_id", sorted(WORKFLOW_PROMPTS))
async def test_workflows_search_the_web_only_when_their_prompt_needs_it(
    client, register, auth, create_product, fake_ai, run_jobs, workflow_id,
):
    token, _ = await register()
    product = await create_product(token)
    resp = await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": workflow_id,
    })
    assert resp.status_code == 200, resp.text
    await run_jobs()
    [call] = fake_ai.calls
    assert call.web_search is WORKFLOW_PROMPTS[workflow_id]["web_search"]
    assert call.model is None, "background workflows use the default model"
    assert call.result_type is WORKFLOW_PROMPTS[workflow_id]["result"]
    # D13: fixed instructions, then the project's brand context, then this run's details
    assert call.prompt.instructions == WORKFLOW_PROMPTS[workflow_id]["instructions"]
    assert call.prompt.context.startswith("# Brand Context")
    assert call.prompt.details.startswith("# Today's Date: ")


def test_research_workflows_search_the_web():
    searching = {workflow for workflow, prompt in WORKFLOW_PROMPTS.items() if prompt["web_search"]}
    assert searching == {
        "competitor", "trend", "partnerships", "blog", "reddit", "directories", "launch_platforms", "podcasts",
    }


def test_every_workflow_has_a_structured_result():
    for prompt in WORKFLOW_PROMPTS.values():
        assert issubclass(prompt["result"], results.Result)
        assert "{brand_context}" not in prompt["instructions"]


REPORT_ROUTING = [
    # (path, extra request fields, searches the web, uses the report model, instructions, result)
    ("/api/presskit/generate", {"url": "https://launchops.example"}, False, False, PRESS_KIT_INSTRUCTIONS, results.PressKitResult),
    ("/api/press-release/generate", {"url": "https://launchops.example"}, True, False, PRESS_RELEASE_INSTRUCTIONS, results.PressReleaseResult),
    ("/api/seo/analyze", {"url": "https://launchops.example"}, False, False, SEO_ANALYSIS_INSTRUCTIONS, results.SeoResult),
    ("/api/repurpose", {"content": "A launch post", "platforms": ["twitter"]}, False, False, REPURPOSE_INSTRUCTIONS, results.RepurposeResult),
    ("/api/pricing/analyze", {}, True, True, PRICING_INSTRUCTIONS, results.PricingResult),
    ("/api/market-analysis", {}, True, True, MARKET_ANALYSIS_INSTRUCTIONS, results.MarketAnalysisResult),
]


@pytest.mark.parametrize(("path", "extra", "web_search", "report_model", "instructions", "result_type"), REPORT_ROUTING)
async def test_reports_ask_for_their_structured_result_with_the_right_model_and_tools(
    client, register, auth, create_product, fake_ai, path, extra, web_search, report_model, instructions, result_type,
):
    token, _ = await register()
    product = await create_product(token, name="Launch Ops")
    resp = await client.post(path, headers=auth(token), json={"product_id": product["id"], **extra})
    assert resp.status_code == 200, resp.text
    [call] = fake_ai.calls
    assert call.web_search is web_search
    assert call.model == (config.get_settings().claude_report_model if report_model else None)
    assert call.result_type is result_type
    # D13: the cached parts hold nothing that changes from run to run
    assert call.prompt.instructions == instructions
    assert call.prompt.context.startswith("# Brand Context")
    assert "Product: Launch Ops" in call.prompt.context
    assert "Today's Date" not in call.prompt.context
    assert call.prompt.details.split("\n\n")[-1].startswith("# Today's Date: ")


async def test_market_analysis_gets_room_for_a_long_report(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    resp = await client.post("/api/market-analysis", headers=auth(token), json={"product_id": product["id"]})
    assert resp.status_code == 200, resp.text
    assert fake_ai.calls[0].max_tokens > DEFAULT_MAX_TOKENS


# ─── F-9: operations interrupted by a restart ───


async def test_startup_fails_operations_that_a_restart_interrupted(
    client, register, auth, create_product, make_queue_item, fake_ai,
):
    token, user = await register()
    product = await create_product(token)
    interrupted = await make_queue_item(user, product, workflow_id="trend", status="running")
    finished = await make_queue_item(user, product, workflow_id="blog", status="pending", content={"title": "Done"})

    async with main.lifespan(main.app):
        pass

    item = (await client.get(f"/api/queue/{interrupted['id']}", headers=auth(token))).json()
    assert item["status"] == "failed"
    assert item["content"] == {"error": "The server restarted while this operation was running. Run it again."}
    assert item["preview"] == "Failed: The server restarted while this operation was running. Run it again."
    untouched = await database.select_one("queue", str(finished["id"]))
    assert (untouched["status"], untouched["content"]) == ("pending", {"title": "Done"})


async def test_press_kit_is_generated_and_stored(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = {"boilerplate": "Launch Ops is an ops desk.", "key_features": ["Approval queue"]}
    resp = await client.post("/api/presskit/generate", headers=auth(token), json={
        "product_id": product["id"], "url": "https://launchops.example",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["boilerplate"] == "Launch Ops is an ops desk."
    assert fake_ai.scraped_urls == ["https://launchops.example"]
    stored = (await client.get(f"/api/products/{product['id']}", headers=auth(token))).json()["press_kit"]
    assert stored["key_features"] == ["Approval queue"]


async def test_press_kit_reports_unreachable_url(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.scrape_result = {"status": "error", "error": "HTTP 404", "url": "https://gone.example"}
    resp = await client.post("/api/presskit/generate", headers=auth(token), json={
        "product_id": product["id"], "url": "https://gone.example",
    })
    assert resp.status_code == 400
    assert resp.json() == {"detail": "Could not analyze URL: HTTP 404"}
    assert fake_ai.calls == []


async def test_repurpose_returns_platform_versions(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = {"platforms": [{"platform": "twitter", "content": "Short version"}]}
    resp = await client.post("/api/repurpose", headers=auth(token), json={
        "product_id": product["id"], "content": "A long launch post", "platforms": ["twitter"],
    })
    assert resp.status_code == 200, resp.text
    assert resp.json() == fake_ai.response
    assert "A long launch post" in fake_ai.calls[0].system


# ─── B11: competitor preview ───


def test_competitor_preview_counts_competitors_and_highest_threat():
    result = {"competitors": [
        {"name": "Alpha", "threat_level": 4},
        {"name": "Beta", "threat_level": "7"},
        {"name": "Gamma", "threat_level": 6.5},
        {"name": "Delta", "threat_level": "unknown"},
    ]}
    assert _generate_preview("competitor", result) == "Analyzed 4 competitors · highest threat 7/10"
    fractional = {"competitors": [{"threat_level": "8.5"}, {"threat_level": 3}]}
    assert _generate_preview("competitor", fractional) == "Analyzed 2 competitors · highest threat 8.5/10"


def test_competitor_preview_omits_threat_without_numeric_levels():
    result = {"competitors": [
        {"name": "Alpha"}, {"name": "Beta", "threat_level": "high"}, {"name": "Gamma", "threat_level": True},
    ]}
    assert _generate_preview("competitor", result) == "Analyzed 3 competitors"


def test_competitor_preview_without_competitors():
    assert _generate_preview("competitor", {}) == "Analyzed 0 competitors"


async def test_competitor_workflow_preview_in_queue(client, register, auth, create_product, fake_ai, run_jobs):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = {"competitors": [{"name": "Alpha", "threat_level": 5}, {"name": "Beta", "threat_level": 8}]}
    launched = (await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "competitor",
    })).json()
    await run_jobs()
    item = (await client.get(f"/api/queue/{launched['task_id']}", headers=auth(token))).json()
    assert item["preview"] == "Analyzed 2 competitors · highest threat 8/10"


# ─── B12: reports carry generated_at, plus source_url when a URL was analysed ───

ANALYSED_URL = "https://launchops.example/product"

REPORT_ENDPOINTS = [
    # (path, extra request fields, product column holding the report, expected source_url)
    ("/api/presskit/generate", {"url": ANALYSED_URL}, "press_kit", ANALYSED_URL),
    ("/api/press-release/generate", {"url": ANALYSED_URL}, "press_release", ANALYSED_URL),
    ("/api/seo/analyze", {"url": ANALYSED_URL}, "seo_result", ANALYSED_URL),
    ("/api/pricing/analyze", {"notes": "Indie budget"}, "pricing_result", None),
    ("/api/market-analysis", {"custom_pricing": ""}, "market_analysis", None),
]


@pytest.mark.parametrize(("path", "extra", "stored_as", "source_url"), REPORT_ENDPOINTS)
async def test_reports_carry_generated_at_and_source_url(
    client, register, auth, create_product, fake_ai, path, extra, stored_as, source_url,
):
    token, _ = await register()
    product = await create_product(token)
    # Server-set values win over anything the model puts in its JSON
    fake_ai.response = {"summary": "ok", "generated_at": "1999-01-01T00:00:00"}
    if source_url:
        fake_ai.response["source_url"] = "https://model-guess.example"
    started = datetime.now(timezone.utc)

    resp = await client.post(path, headers=auth(token), json={"product_id": product["id"], **extra})
    assert resp.status_code == 200, resp.text
    report = resp.json()
    generated_at = datetime.fromisoformat(report["generated_at"])
    assert generated_at.tzinfo is not None
    assert started <= generated_at <= datetime.now(timezone.utc)
    assert report["summary"] == "ok"
    assert report.get("source_url") == source_url

    stored = (await client.get(f"/api/products/{product['id']}", headers=auth(token))).json()[stored_as]
    assert (stored["generated_at"], stored.get("source_url")) == (report["generated_at"], source_url)


# ─── AI failures on synchronous endpoints return a readable error ───

SYNC_AI_ENDPOINTS = [
    ("/api/presskit/generate", {"url": "https://launchops.example"}),
    ("/api/press-release/generate", {"url": "https://launchops.example"}),
    ("/api/seo/analyze", {"url": "https://launchops.example"}),
    ("/api/pricing/analyze", {}),
    ("/api/market-analysis", {}),
    ("/api/repurpose", {"content": "A launch post", "platforms": ["twitter"]}),
]


@pytest.mark.parametrize("path,extra", SYNC_AI_ENDPOINTS)
async def test_ai_configuration_error_is_a_503_with_the_reason(client, register, auth, create_product, fake_ai, path, extra):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = AIUnavailable("The AI service isn't available: ANTHROPIC_API_KEY not configured")
    resp = await client.post(path, headers=auth(token), json={"product_id": product["id"], **extra})
    assert resp.status_code == 503
    assert resp.json() == {"detail": "The AI service isn't available: ANTHROPIC_API_KEY not configured"}


@pytest.mark.parametrize("path,extra", SYNC_AI_ENDPOINTS)
async def test_ai_provider_error_is_a_502(client, register, auth, create_product, fake_ai, path, extra):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = AIError("The AI provider returned an error (HTTP 529). Try again in a few minutes.")
    resp = await client.post(path, headers=auth(token), json={"product_id": product["id"], **extra})
    assert resp.status_code == 502
    assert resp.json() == {"detail": "The AI provider returned an error (HTTP 529). Try again in a few minutes."}


@pytest.mark.parametrize("path,extra", SYNC_AI_ENDPOINTS)
async def test_ai_timeout_is_a_504(client, register, auth, create_product, fake_ai, path, extra):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = AITimeout("The AI request timed out. Operations with web research can take several minutes; try again.")
    resp = await client.post(path, headers=auth(token), json={"product_id": product["id"], **extra})
    assert resp.status_code == 504
    assert resp.json() == {"detail": "The AI request timed out. Operations with web research can take several minutes; try again."}


@pytest.mark.parametrize("path,extra", SYNC_AI_ENDPOINTS)
async def test_ai_refusal_is_a_422(client, register, auth, create_product, fake_ai, path, extra):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = AIRefused("The AI declined this request. Change the instructions or the project details and try again.")
    resp = await client.post(path, headers=auth(token), json={"product_id": product["id"], **extra})
    assert resp.status_code == 422
    assert resp.json() == {"detail": "The AI declined this request. Change the instructions or the project details and try again."}


async def test_failed_report_leaves_the_saved_report_untouched(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = {"tiers": [{"name": "Pro", "price": "$10"}]}
    assert (await client.post("/api/pricing/analyze", headers=auth(token), json={"product_id": product["id"]})).status_code == 200
    fake_ai.response = AIUnavailable("The AI service isn't available: ANTHROPIC_API_KEY not configured")
    assert (await client.post("/api/pricing/analyze", headers=auth(token), json={"product_id": product["id"]})).status_code == 503
    stored = (await client.get(f"/api/products/{product['id']}", headers=auth(token))).json()["pricing_result"]
    assert stored["tiers"] == [{"name": "Pro", "price": "$10"}]


# ─── Previews of AI answers ───


def test_previews_of_unexpected_answers():
    assert _generate_preview("trend", {"trends": None}) == "Results ready for review"
    assert _generate_preview("some_new_workflow", {"a": 1}) == '{"a": 1}'


# ─── Background workflows that can't run ───


async def _queue_workflow_job(user: dict, org_id: str, product_id: str, workflow_id: str) -> dict:
    """A running result and its job, as a launch creates them, for a project or workflow that then disappears."""
    item = await database.insert("queue", {"workflow_id": workflow_id, "status": "running", "user_id": user["id"], "org_id": org_id})
    pool = await database.get_pool()
    async with pool.acquire() as conn:
        await jobs.enqueue(conn, kind="workflow", org_id=org_id, user_id=user["id"], queue_id=item["id"],
                           payload={"product_id": product_id, "workflow_id": workflow_id, "instructions": ""})
    return item


async def test_a_workflow_for_a_deleted_project_fails(client, register, auth, create_product, fake_ai, run_jobs):
    token, user = await register()
    product = await create_product(token)
    assert (await client.delete(f"/api/products/{product['id']}", headers=auth(token))).status_code == 200
    item = await _queue_workflow_job(user, product["org_id"], product["id"], "trend")

    await run_jobs()

    stored = await database.select_one("queue", item["id"])
    assert (stored["status"], stored["content"]) == ("failed", {"error": "Product not found"})
    assert fake_ai.calls == []


async def test_an_unknown_workflow_fails(client, register, create_product, fake_ai, run_jobs):
    token, user = await register()
    product = await create_product(token)
    item = await _queue_workflow_job(user, product["org_id"], product["id"], "retired_workflow")

    await run_jobs()

    stored = await database.select_one("queue", item["id"])
    assert (stored["status"], stored["content"]) == ("failed", {"error": "Unknown workflow: retired_workflow"})
    assert fake_ai.calls == []


async def test_social_posts_are_generated_for_the_connected_platforms(client, register, auth, create_product, fake_ai, run_jobs):
    token, _ = await register()
    product = await create_product(token)
    await client.put("/api/settings", headers=auth(token), json={
        "platforms": {"linkedin": {"connected": True}, "tiktok": {"connected": False}}, "brand": {}, "prefs": {},
    })

    resp = await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "social_posts",
    })
    await run_jobs()

    assert resp.status_code == 200, resp.text
    assert "Generate posts ONLY for these enabled platforms: linkedin." in fake_ai.calls[0].user_message


# ─── Launching and reports on projects that aren't yours ───


async def test_launching_on_a_missing_or_foreign_project(client, register, auth, create_product, fake_ai):
    owner_token, _ = await register()
    other_token, _ = await register()
    product = await create_product(owner_token)

    missing = await client.post("/api/workflows/launch", headers=auth(owner_token), json={
        "product_id": "00000000-0000-4000-8000-000000000000", "workflow_id": "trend",
    })
    foreign = await client.post("/api/workflows/launch", headers=auth(other_token), json={
        "product_id": product["id"], "workflow_id": "trend",
    })

    assert (missing.status_code, missing.json()) == (404, {"detail": "Product not found"})
    # Another organisation's project isn't revealed to exist (docs/PHASE1_DESIGN.md D4)
    assert (foreign.status_code, foreign.json()) == (404, {"detail": "Product not found"})
    assert fake_ai.calls == []


async def test_reports_on_a_missing_or_foreign_project(client, register, auth, create_product, fake_ai):
    owner_token, _ = await register()
    other_token, _ = await register()
    product = await create_product(owner_token)

    missing = await client.post("/api/pricing/analyze", headers=auth(owner_token), json={
        "product_id": "00000000-0000-4000-8000-000000000000",
    })
    foreign = await client.post("/api/pricing/analyze", headers=auth(other_token), json={"product_id": product["id"]})

    assert (missing.status_code, missing.json()) == (404, {"detail": "Product not found"})
    assert (foreign.status_code, foreign.json()) == (404, {"detail": "Product not found"})
    assert fake_ai.calls == []


# ─── What the reports tell the AI ───


async def test_press_release_includes_every_contact_and_note(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.response = {"headline": "Launch Ops ships"}

    resp = await client.post("/api/press-release/generate", headers=auth(token), json={
        "product_id": product["id"], "url": "https://launchops.example",
        "media_contact_name": "Mia Media", "media_contact_email": "press@launchops.example", "media_contact_phone": "+1 555 0100",
        "technical_contact_name": "Tom Tech", "technical_contact_email": "tech@launchops.example",
        "sales_contact_name": "Sam Sales", "sales_contact_email": "sales@launchops.example",
        "additional_notes": "Embargo until Tuesday",
    })

    assert resp.status_code == 200, resp.text
    system = fake_ai.calls[0].system
    for line in [
        "Media Contact: Mia Media", "  Email: press@launchops.example", "  Phone: +1 555 0100",
        "Technical Contact: Tom Tech", "  Email: tech@launchops.example",
        "Sales Contact: Sam Sales", "  Email: sales@launchops.example",
        "Additional Notes: Embargo until Tuesday",
    ]:
        assert line in system
    assert "No contact information provided" not in system


async def test_press_release_without_contacts_says_so(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)

    resp = await client.post("/api/press-release/generate", headers=auth(token), json={
        "product_id": product["id"], "url": "https://launchops.example",
    })

    assert resp.status_code == 200, resp.text
    assert "No contact information provided — use placeholder names." in fake_ai.calls[0].system


async def test_press_release_reports_an_unreachable_url(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.scrape_result = {"status": "error", "error": "HTTP 500", "url": "https://down.example"}

    resp = await client.post("/api/press-release/generate", headers=auth(token), json={
        "product_id": product["id"], "url": "https://down.example",
    })

    assert (resp.status_code, resp.json()) == (400, {"detail": "Could not analyze URL: HTTP 500"})
    assert fake_ai.calls == []


async def test_seo_reports_an_unreachable_url(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)
    fake_ai.scrape_result = {"status": "error", "error": "HTTP 404", "url": "https://gone.example"}

    resp = await client.post("/api/seo/analyze", headers=auth(token), json={
        "product_id": product["id"], "url": "https://gone.example",
    })

    assert (resp.status_code, resp.json()) == (400, {"detail": "Could not analyze URL: HTTP 404"})


async def test_the_scraped_page_and_notes_go_in_the_details_not_the_cached_parts(client, register, auth, create_product, fake_ai):
    token, _ = await register()
    product = await create_product(token)

    await client.post("/api/seo/analyze", headers=auth(token), json={"product_id": product["id"], "url": "https://launchops.example"})
    await client.post("/api/pricing/analyze", headers=auth(token), json={"product_id": product["id"], "notes": "Indie budget"})

    seo, pricing = fake_ai.calls
    assert seo.prompt.details.startswith('# Current Page Metadata\n{\n  "title": "Launch Ops"')
    assert "Launch faster" not in seo.prompt.instructions + seo.prompt.context
    assert pricing.prompt.details.startswith("# Additional Notes\nIndie budget\n\n# Today's Date: ")


@pytest.mark.parametrize(("stored_pricing", "custom_pricing", "expected"), [
    (None, "Pro at $29/month", "User-provided pricing:\nPro at $29/month"),
    (
        {"tiers": [{"name": "Pro", "price": "$29", "features": ["Queue", "Outbox", "Calendar", "Reports"]}, {}]},
        "",
        "Pricing from pricing module:\n- Pro: $29 (Queue, Outbox, Calendar)\n- Tier: N/A ()",
    ),
    ({"tiers": []}, "", "No pricing data available — estimate based on market research."),
    (None, "", "No pricing data available — estimate based on market research and competitor analysis."),
])
async def test_market_analysis_is_given_the_pricing_to_build_on(
    client, register, auth, create_product, fake_ai, stored_pricing, custom_pricing, expected,
):
    token, _ = await register()
    product = await create_product(token)
    if stored_pricing is not None:
        await database.update("products", product["id"], {"pricing_result": stored_pricing})

    resp = await client.post("/api/market-analysis", headers=auth(token), json={
        "product_id": product["id"], "custom_pricing": custom_pricing,
    })

    assert resp.status_code == 200, resp.text
    assert f"# Pricing Context (from pricing module or user-provided)\n{expected}\n" in fake_ai.calls[0].system
