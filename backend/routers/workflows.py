"""Workflow execution routes — the AI engine.

Handles launching AI workflows, press kit generation, SEO analysis,
content repurposing, and pricing analysis. All results flow into the
approval queue.
"""

import json
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

from config import get_settings
from database import DATABASE_UNAVAILABLE_ERRORS, get_pool, select, select_one, update
from models import (
    MarketAnalysisRequest,
    PressKitRequest,
    PressReleaseRequest,
    PricingRequest,
    QueueStatus,
    RepurposeRequest,
    SEORequest,
    TaskStatus,
    WorkflowRequest,
    WorkflowResponse,
    new_id,
)
from services import access, events, jobs, ratelimit, results, usage
from services.claude import (
    MARKET_ANALYSIS_INSTRUCTIONS,
    PRESS_KIT_INSTRUCTIONS,
    PRESS_RELEASE_INSTRUCTIONS,
    PRICING_INSTRUCTIONS,
    REPURPOSE_INSTRUCTIONS,
    SEO_ANALYSIS_INSTRUCTIONS,
    WORKFLOW_PROMPTS,
    AIError,
    Prompt,
    UsageContext,
    build_brand_context,
    generate_result,
    run_details,
    section,
)
from services.scraper import scrape_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["workflows"])

# Market analysis asks for six sections with tables; give it room beyond the default.
MARKET_ANALYSIS_MAX_TOKENS = 32_000
INTERRUPTED_ERROR = "The server restarted while this operation was running. Run it again."


def _uid(request: Request) -> str:
    return request.state.user["id"]


def _charge_ai_operation(user_id: str) -> None:
    """Count one AI operation against the account's hourly allowance (429 when it's used up)."""
    ratelimit.enforce(
        ratelimit.AI_OPERATIONS_PER_ACCOUNT,
        user_id,
        "You've run {limit} AI operations in the last hour. Try again in {minutes} minutes.",
    )


async def _owned_brand(product: dict) -> dict | None:
    """The project's assigned company profile — only if it belongs to the project's organisation.

    Any other brand (e.g. one left behind by a project transfer) is ignored, so prompts fall
    back to the organisation's brand settings and the project's company_details.
    """
    brand_id = product.get("brand_id")
    if not brand_id:
        return None
    brand = await select_one("brands", str(brand_id))
    org_id = product.get("org_id")
    if brand and org_id and str(brand.get("org_id")) == str(org_id):
        return brand
    return None


async def _organisation_settings(org_id: str | None) -> dict:
    rows = await select("settings", filters={"org_id": org_id}, order="updated_at", limit=1) if org_id else []
    return rows[0] if rows else {}


async def _generate(prompt: Prompt, user_message: str, result_type: type[results.Result], **kwargs) -> dict:
    """generate_result for request/response endpoints: an AI failure becomes an HTTP error with its readable reason.

    Background workflows call generate_result directly and record the reason on the queue item instead.
    """
    try:
        return await generate_result(prompt, user_message, result_type, **kwargs)
    except AIError as e:
        raise HTTPException(e.status_code, str(e)) from None


async def _get_product_and_settings(product_id: str, request: Request) -> tuple[dict, dict]:
    """One of the organisation's projects (404 otherwise) and the organisation's settings, for an Editor,
    once the organisation's AI budget allows another operation."""
    current = await access.membership(request)
    product = await access.load(current, "products", product_id, "Product not found")
    access.ensure(current, "editor")
    await usage.ensure_within_budget(current.org_id, current.org_name)
    settings_row = await _organisation_settings(current.org_id)
    # Fetch assigned brand (if any)
    brand_row = await _owned_brand(product)
    if brand_row:
        settings_row["_brand_override"] = brand_row
    return product, settings_row


def _usage(request: Request, product: dict, operation: str) -> UsageContext:
    return UsageContext(org_id=str(product["org_id"]), user_id=_uid(request), product_id=str(product["id"]), operation=operation)


async def fail_interrupted_workflows() -> int:
    """At startup, mark as failed the operations left running with no job to finish them. Returns how many.

    Operations run from durable jobs (services/jobs.py) and carry on after a restart. Only results
    started before jobs existed, when operations ran inside the web process, can be left behind.
    """
    pool = await get_pool()
    rows = await pool.fetch(
        "UPDATE queue q SET status = 'failed', content = $1::jsonb, preview = $2 WHERE q.status = 'running' "
        "AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.queue_id = q.id AND j.status IN ('queued', 'running')) RETURNING q.id",
        {"error": INTERRUPTED_ERROR},
        f"Failed: {INTERRUPTED_ERROR}",
    )
    return len(rows)


async def _mark_failed(queue_id: str, reason: str) -> None:
    await update("queue", queue_id, {
        "status": "failed",
        "content": {"error": reason},
        "preview": f"Failed: {reason[:100]}",
    })


class WorkflowCannotRun(Exception):
    """The operation can't run at all (its project is gone, or the workflow no longer exists)."""


async def execute_workflow(job: dict) -> None:
    """Run a workflow job and store the result for review. Raises when there's no result; the job decides
    whether to retry (services/jobs.py)."""
    payload = job["payload"]
    queue_id = str(job["queue_id"])
    workflow_id = payload["workflow_id"]
    instructions = payload.get("instructions", "")
    product = await select_one("products", payload["product_id"])
    if not product:
        raise WorkflowCannotRun("Product not found")
    settings_row = await _organisation_settings(product.get("org_id"))
    # Fetch assigned brand (if any)
    brand_override = await _owned_brand(product)
    brand_ctx = build_brand_context(
        product,
        brand=settings_row.get("brand"),
        prefs=settings_row.get("prefs"),
        brand_override=brand_override,
    )

    prompt_config = WORKFLOW_PROMPTS.get(workflow_id)
    if not prompt_config:
        raise WorkflowCannotRun(f"Unknown workflow: {workflow_id}")

    prompt = Prompt(instructions=prompt_config["instructions"], context=brand_ctx, details=run_details())

    user_msg = f"Execute this workflow for {product.get('name', 'the product')}."

    # For social_posts, inject enabled platforms from settings
    if workflow_id == "social_posts":
        platforms_cfg = settings_row.get("platforms", {})
        enabled = [pid for pid, cfg in platforms_cfg.items() if cfg.get("connected")]
        if enabled:
            user_msg += f"\n\nGenerate posts ONLY for these enabled platforms: {', '.join(enabled)}. Do not generate for other platforms."
        else:
            user_msg += "\n\nGenerate posts for Twitter, LinkedIn, and Instagram (no platforms configured yet)."

    if instructions:
        user_msg += f"\n\nAdditional instructions: {instructions}"

    result = await generate_result(
        prompt, user_msg, prompt_config["result"], web_search=prompt_config["web_search"],
        usage=UsageContext(org_id=str(job["org_id"]), user_id=str(job["user_id"] or ""), product_id=str(product["id"]), operation=workflow_id),
    )

    # Generate preview from result
    preview = _generate_preview(workflow_id, result)

    await update("queue", queue_id, {
        "status": QueueStatus.PENDING.value,
        "content": result,
        "preview": preview,
    })
    await events.publish(job["org_id"], "queue", queue_id, QueueStatus.PENDING.value)


def _retry_might_help(error: BaseException) -> bool:
    """Provider errors, timeouts and database outages pass; refusals, rejected requests, cut-off answers,
    configuration and missing projects don't (AIError.retryable)."""
    if isinstance(error, AIError):
        return error.retryable
    return isinstance(error, DATABASE_UNAVAILABLE_ERRORS)


async def _workflow_failed(job: dict, message: str) -> None:
    await _mark_failed(str(job["queue_id"]), message)
    await events.publish(job["org_id"], "queue", job["queue_id"], "failed")


async def _workflow_retrying(job: dict, message: str, delay: timedelta) -> None:
    await update("queue", str(job["queue_id"]), {"preview": f"Trying again in {jobs.describe_delay(delay)}: {message}"[:300]})
    await events.publish(job["org_id"], "queue", job["queue_id"], "running")


jobs.register("workflow", jobs.JobKind(
    run=execute_workflow,
    failed=_workflow_failed,
    retrying=_workflow_retrying,
    cancelled=_workflow_failed,
    should_retry=_retry_might_help,
))
jobs.expect(AIError, WorkflowCannotRun)


def _competitor_preview(result: dict) -> str:
    """Competitor preview: how many were analyzed and the highest numeric threat level."""
    competitors = result.get("competitors")
    if not isinstance(competitors, list):
        competitors = []
    levels = []
    for competitor in competitors:
        level = competitor.get("threat_level") if isinstance(competitor, dict) else None
        if isinstance(level, bool):
            continue
        # Numbers or numeric strings ("7"); anything else has no threat level
        try:
            value = float(level)
        except (TypeError, ValueError):
            continue
        if math.isfinite(value):
            levels.append(value)
    preview = f"Analyzed {len(competitors)} competitors"
    if levels:
        preview += f" · highest threat {max(levels):g}/10"
    return preview


def _stamp_report(result, source_url: str | None = None):
    """Mark a report with its generation time (UTC, ISO 8601) and, for URL-based
    reports, the URL that was analysed — before it is stored and returned."""
    if isinstance(result, dict):
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        if source_url is not None:
            result["source_url"] = source_url
    return result


def _generate_preview(workflow_id: str, result: dict) -> str:
    """Generate a short preview string from workflow results."""
    preview_map = {
        "competitor": _competitor_preview,
        "trend": lambda r: f"Found {len(r.get('trends', []))} trends in the market",
        "cold_outreach": lambda r: f"Drafted {len(r.get('emails', []))} outreach emails",
        "partnerships": lambda r: f"Identified {len(r.get('partnerships', []))} partnership opportunities",
        "social_posts": lambda r: f"Generated {len(r.get('posts', []))} social posts",
        "ad_copy": lambda r: f"Created {len(r.get('ad_sets', []))} ad copy variations",
        "blog": lambda r: f"Blog draft: \"{r.get('title', 'Untitled')}\" ({r.get('word_count', '?')} words)",
        "announcement": lambda r: "Launch announcement — email, blog, and social versions",
        "reddit": lambda r: f"Found {len(r.get('communities', []))} relevant subreddits",
        "directories": lambda r: f"Found {len(r.get('directories', []))} listing directories",
        "launch_platforms": lambda r: f"Identified {len(r.get('platforms', []))} launch platforms",
        "podcasts": lambda r: f"Found {len(r.get('podcasts', []))} podcast opportunities",
    }

    fn = preview_map.get(workflow_id, lambda r: json.dumps(r)[:150])
    try:
        return fn(result)
    except (TypeError, AttributeError, KeyError, ValueError):
        # AI output that doesn't match the expected shape
        return "Results ready for review"


# ─── Launch Workflow ───


@router.post("/workflows/launch")
async def launch_workflow(data: WorkflowRequest, request: Request) -> WorkflowResponse:
    """Launch an AI workflow as a background job; its result lands in Review."""
    uid = _uid(request)
    current = await access.membership(request)
    product = await access.load(current, "products", data.product_id, "Product not found")
    access.ensure(current, "editor")
    await usage.ensure_within_budget(current.org_id, current.org_name)

    if data.workflow_id not in WORKFLOW_PROMPTS:
        raise HTTPException(400, f"Unknown workflow: {data.workflow_id}")

    running = await select("queue", {"user_id": uid, "status": "running"}, limit=1000)
    cap = get_settings().max_concurrent_tasks
    if len(running) >= cap:
        raise HTTPException(429, f"You already have {cap} operations running. Start another when one finishes.")
    _charge_ai_operation(uid)

    # The result (running until the job finishes) and its job are saved together
    queue_id = new_id()
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            "INSERT INTO queue (id, product_id, org_id, user_id, workflow_id, status, preview, input_params) "
            "VALUES ($1, $2, $3, $4, $5, 'running', $6, $7)",
            uuid.UUID(queue_id), uuid.UUID(data.product_id), uuid.UUID(current.org_id), uuid.UUID(uid),
            data.workflow_id, f"Running {data.workflow_id}...", data.instructions,
        )
        await jobs.enqueue(
            conn, kind="workflow", org_id=current.org_id, user_id=uid, queue_id=queue_id,
            payload={"product_id": data.product_id, "workflow_id": data.workflow_id, "instructions": data.instructions},
        )
    await events.publish(current.org_id, "queue", queue_id, "running")

    return WorkflowResponse(
        task_id=queue_id,
        status=TaskStatus.RUNNING,
        message=f"Workflow '{data.workflow_id}' launched for {product['name']}",
    )


# ─── Press Kit Generation ───


@router.post("/presskit/generate")
async def generate_press_kit(data: PressKitRequest, request: Request) -> dict:
    """Scrape URL and generate a press kit via Claude."""
    product, settings = await _get_product_and_settings(data.product_id, request)
    _charge_ai_operation(_uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs"), brand_override=settings.get("_brand_override")
    )

    # Scrape the URL
    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        raise HTTPException(400, f"Could not analyze URL: {scraped.get('error')}")

    scraped_content = (
        f"Page title: {scraped['metadata'].get('title', '')}\n"
        f"Description: {scraped['metadata'].get('description', '')}\n"
        f"Headings: {', '.join(scraped.get('headings', []))}\n"
        f"Body text: {scraped.get('body_text', '')[:3000]}"
    )

    prompt = Prompt(PRESS_KIT_INSTRUCTIONS, brand_ctx, run_details(section("Scraped Content", scraped_content)))

    result = await _generate(prompt, "Generate the press kit now.", results.PressKitResult, usage=_usage(request, product, "press_kit"))
    result = _stamp_report(result, data.url)

    # Store on product
    await update("products", data.product_id, {"press_kit": result})
    return result


# ─── Press Release Generation ───


@router.post("/press-release/generate")
async def generate_press_release(data: PressReleaseRequest, request: Request) -> dict:
    """Scrape URL and generate a press release via Claude."""
    product, settings = await _get_product_and_settings(data.product_id, request)
    _charge_ai_operation(_uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs"), brand_override=settings.get("_brand_override")
    )

    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        raise HTTPException(400, f"Could not analyze URL: {scraped.get('error')}")

    scraped_content = (
        f"Page title: {scraped['metadata'].get('title', '')}\n"
        f"Description: {scraped['metadata'].get('description', '')}\n"
        f"Headings: {', '.join(scraped.get('headings', []))}\n"
        f"Body text: {scraped.get('body_text', '')[:3000]}"
    )

    contact_lines = []
    if data.media_contact_name:
        contact_lines.append(f"Media Contact: {data.media_contact_name}")
        if data.media_contact_email:
            contact_lines.append(f"  Email: {data.media_contact_email}")
        if data.media_contact_phone:
            contact_lines.append(f"  Phone: {data.media_contact_phone}")
    if data.technical_contact_name:
        contact_lines.append(f"Technical Contact: {data.technical_contact_name}")
        if data.technical_contact_email:
            contact_lines.append(f"  Email: {data.technical_contact_email}")
    if data.sales_contact_name:
        contact_lines.append(f"Sales Contact: {data.sales_contact_name}")
        if data.sales_contact_email:
            contact_lines.append(f"  Email: {data.sales_contact_email}")
    contact_info = "\n".join(contact_lines) if contact_lines else "No contact information provided — use placeholder names."

    if data.additional_notes:
        contact_info += f"\n\nAdditional Notes: {data.additional_notes}"

    prompt = Prompt(
        PRESS_RELEASE_INSTRUCTIONS, brand_ctx,
        run_details(section("Scraped Website Content", scraped_content), section("Contact Information", contact_info)),
    )

    result = await _generate(
        prompt, "Write the press release now. Use web search to find specific, real distribution channels with contact details.",
        results.PressReleaseResult,
        web_search=True,
        usage=_usage(request, product, "press_release"),
    )
    result = _stamp_report(result, data.url)

    # Store on product
    await update("products", data.product_id, {"press_release": result})
    return result


# ─── SEO Analysis ───


@router.post("/seo/analyze")
async def analyze_seo(data: SEORequest, request: Request) -> dict:
    """Scrape URL metadata and generate optimized SEO tags."""
    product, settings = await _get_product_and_settings(data.product_id, request)
    _charge_ai_operation(_uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs"), brand_override=settings.get("_brand_override")
    )

    logger.info(f"SEO: scraping {data.url}")
    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        logger.error(f"SEO: scrape failed: {scraped.get('error')}")
        raise HTTPException(400, f"Could not analyze URL: {scraped.get('error')}")

    logger.info(f"SEO: scrape OK, title={scraped['metadata'].get('title', '(none)')}")
    current_meta = json.dumps(scraped["metadata"], indent=2)

    prompt = Prompt(SEO_ANALYSIS_INSTRUCTIONS, brand_ctx, run_details(section("Current Page Metadata", current_meta)))

    result = await _generate(prompt, "Analyze and generate optimized metadata.", results.SeoResult, usage=_usage(request, product, "seo"))

    # Store on product
    result = _stamp_report(result, data.url)
    await update("products", data.product_id, {"seo_result": result})
    return result


# ─── Content Repurposer ───


@router.post("/repurpose")
async def repurpose_content(data: RepurposeRequest, request: Request) -> dict:
    """Repurpose content for multiple platforms."""
    product, settings = await _get_product_and_settings(data.product_id, request)
    _charge_ai_operation(_uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs"), brand_override=settings.get("_brand_override")
    )

    prompt = Prompt(
        REPURPOSE_INSTRUCTIONS, brand_ctx,
        run_details(section("Original Content", data.content), section("Target Platforms", ", ".join(data.platforms))),
    )

    return await _generate(prompt, "Repurpose this content now.", results.RepurposeResult, usage=_usage(request, product, "repurpose"))


# ─── Pricing Advisor ───


@router.post("/pricing/analyze")
async def analyze_pricing(data: PricingRequest, request: Request) -> dict:
    """Generate pricing strategy recommendations."""
    product, settings = await _get_product_and_settings(data.product_id, request)
    _charge_ai_operation(_uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs"), brand_override=settings.get("_brand_override")
    )

    prompt = Prompt(PRICING_INSTRUCTIONS, brand_ctx, run_details(section("Additional Notes", data.notes)))

    result = await _generate(
        prompt,
        "Analyze the market and suggest pricing.",
        results.PricingResult,
        web_search=True,
        model=get_settings().claude_report_model,
        usage=_usage(request, product, "pricing"),
    )
    result = _stamp_report(result)

    # Store on product for persistence
    await update("products", data.product_id, {"pricing_result": result})
    return result


# ─── Market Analysis ───


@router.post("/market-analysis")
async def market_analysis(data: MarketAnalysisRequest, request: Request) -> dict:
    """Generate comprehensive market analysis report."""
    product, settings = await _get_product_and_settings(data.product_id, request)
    _charge_ai_operation(_uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs"), brand_override=settings.get("_brand_override")
    )

    # Build pricing context from stored pricing result or user override
    if data.custom_pricing:
        pricing_context = f"User-provided pricing:\n{data.custom_pricing}"
    elif product.get("pricing_result"):
        pr = product["pricing_result"]
        tiers = pr.get("tiers", [])
        pricing_lines = []
        for t in tiers:
            pricing_lines.append(f"- {t.get('name', 'Tier')}: {t.get('price', 'N/A')} ({', '.join(t.get('features', [])[:3])})")
        pricing_context = "Pricing from pricing module:\n" + "\n".join(pricing_lines) if pricing_lines else "No pricing data available — estimate based on market research."
    else:
        pricing_context = "No pricing data available — estimate based on market research and competitor analysis."

    prompt = Prompt(
        MARKET_ANALYSIS_INSTRUCTIONS, brand_ctx,
        run_details(section("Pricing Context (from pricing module or user-provided)", pricing_context)),
    )

    result = await _generate(
        prompt,
        "Produce the full market analysis report now. Use web search to find real data on competitors, market size, and pricing.",
        results.MarketAnalysisResult,
        web_search=True,
        max_tokens=MARKET_ANALYSIS_MAX_TOKENS,
        model=get_settings().claude_report_model,
        usage=_usage(request, product, "market_analysis"),
    )
    result = _stamp_report(result)

    # Store on product for persistence
    await update("products", data.product_id, {"market_analysis": result})
    return result
