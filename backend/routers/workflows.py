"""Workflow execution routes — the AI engine.

Handles launching AI workflows, press kit generation, SEO analysis,
content repurposing, and pricing analysis. All results flow into the
approval queue.
"""

import json
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from models import (
    WorkflowRequest, WorkflowResponse, PressKitRequest, PressReleaseRequest,
    SEORequest, RepurposeRequest, PricingRequest, QueueItem, new_id,
    TaskStatus, QueueStatus,
)
from database import insert, select, select_one, update
from services.claude import (
    call_claude, build_brand_context, WORKFLOW_PROMPTS,
    PRESS_KIT_PROMPT, PRESS_RELEASE_PROMPT, SEO_ANALYSIS_PROMPT,
    REPURPOSE_PROMPT, PRICING_PROMPT,
)
from services.scraper import scrape_url

router = APIRouter(prefix="/api", tags=["workflows"])


def _uid(request: Request) -> str:
    return request.state.user["id"]


async def _get_product_and_settings(product_id: str, user_id: str) -> tuple[dict, dict]:
    """Fetch product and per-user settings, raise 404/403 if invalid."""
    product = await select_one("products", product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    if product.get("user_id") and product["user_id"] != user_id:
        raise HTTPException(403, "Not authorized")
    # Auto-assign orphaned products to current user
    if not product.get("user_id"):
        from database import update as db_update
        await db_update("products", product_id, {"user_id": user_id})
        product["user_id"] = user_id
    # Fetch per-user settings
    rows = await select("settings", filters={"user_id": user_id}, order="updated_at", limit=1)
    settings_row = rows[0] if rows else {}
    return product, settings_row


def _parse_json_response(text: str) -> dict:
    """Parse Claude's JSON response, handling markdown fences and truncation."""
    import re
    cleaned = text.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r'```(?:json)?\s*\n?(.*?)```', cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    elif cleaned.startswith("```"):
        # Opening fence but no closing fence (truncated response)
        cleaned = cleaned.split("\n", 1)[-1].strip()
        # Remove trailing ``` if present
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    # First try: parse as-is
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Second try: response may be truncated JSON — try to repair
    # Find the outermost { and attempt to close it
    brace_start = cleaned.find("{")
    if brace_start >= 0:
        json_str = cleaned[brace_start:]
        # Try progressively closing open structures
        for suffix in ['"}]}', '"]]}', '"}', '"]', ']}', '}']:
            try:
                return json.loads(json_str + suffix)
            except json.JSONDecodeError:
                continue

    return {"raw_response": text}


async def _run_workflow(product_id: str, workflow_id: str,
                        instructions: str, queue_id: str, user_id: str = ""):
    """Execute a workflow in the background and store results."""
    try:
        product = await select_one("products", product_id)
        if not product:
            await update("queue", queue_id, {
                "status": "failed",
                "content": {"error": "Product not found"},
            })
            return

        # Fetch per-user settings
        rows = await select("settings", filters={"user_id": user_id}, order="updated_at", limit=1) if user_id else []
        settings_row = rows[0] if rows else {}
        brand_ctx = build_brand_context(
            product,
            brand=settings_row.get("brand"),
            prefs=settings_row.get("prefs"),
        )

        prompt_config = WORKFLOW_PROMPTS.get(workflow_id)
        if not prompt_config:
            await update("queue", queue_id, {
                "status": "failed",
                "content": {"error": f"Unknown workflow: {workflow_id}"},
            })
            return

        system = prompt_config["system"].replace("{brand_context}", brand_ctx)
        tools = prompt_config.get("tools", [])

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

        response = await call_claude(system, user_msg, tools=tools or None)
        result = _parse_json_response(response)

        # Generate preview from result
        preview = _generate_preview(workflow_id, result)

        await update("queue", queue_id, {
            "status": QueueStatus.PENDING.value,
            "content": result,
            "preview": preview,
        })

    except Exception as e:
        await update("queue", queue_id, {
            "status": "failed",
            "content": {"error": str(e)},
            "preview": f"Failed: {str(e)[:100]}",
        })


def _generate_preview(workflow_id: str, result: dict) -> str:
    """Generate a short preview string from workflow results."""
    if "raw_response" in result:
        return result["raw_response"][:150] + "..."

    preview_map = {
        "competitor": lambda r: f"Analysis of {r.get('competitor_name', 'competitor')} — threat level {r.get('threat_level', '?')}/10",
        "trend": lambda r: f"Found {len(r.get('trends', []))} trends in the market",
        "press_targets": lambda r: f"Discovered {len(r.get('targets', []))} media targets",
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
    except Exception:
        return "Results ready for review"


# ─── Launch Workflow ───


@router.post("/workflows/launch")
async def launch_workflow(
    data: WorkflowRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> WorkflowResponse:
    """Launch an AI workflow. Runs in background, results go to queue."""
    uid = _uid(request)
    product = await select_one("products", data.product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    if product.get("user_id") and product["user_id"] != uid:
        raise HTTPException(403, "Not authorized")
    if not product.get("user_id"):
        await update("products", data.product_id, {"user_id": uid})

    if data.workflow_id not in WORKFLOW_PROMPTS:
        raise HTTPException(400, f"Unknown workflow: {data.workflow_id}")

    # Create queue entry in "running" state
    queue_id = new_id()
    await insert("queue", {
        "id": queue_id,
        "product_id": data.product_id,
        "user_id": uid,
        "workflow_id": data.workflow_id,
        "status": "running",
        "preview": f"Running {data.workflow_id}...",
        "input_params": data.instructions,
    })

    # Run in background
    background_tasks.add_task(
        _run_workflow,
        data.product_id,
        data.workflow_id,
        data.instructions,
        queue_id,
        uid,
    )

    return WorkflowResponse(
        task_id=queue_id,
        status=TaskStatus.RUNNING,
        message=f"Workflow '{data.workflow_id}' launched for {product['name']}",
    )


# ─── Press Kit Generation ───


@router.post("/presskit/generate")
async def generate_press_kit(data: PressKitRequest, request: Request) -> dict:
    """Scrape URL and generate a press kit via Claude."""
    product, settings = await _get_product_and_settings(data.product_id, _uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs")
    )

    # Scrape the URL
    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        raise HTTPException(400, f"Could not scrape URL: {scraped.get('error')}")

    scraped_content = (
        f"Page title: {scraped['metadata'].get('title', '')}\n"
        f"Description: {scraped['metadata'].get('description', '')}\n"
        f"Headings: {', '.join(scraped.get('headings', []))}\n"
        f"Body text: {scraped.get('body_text', '')[:3000]}"
    )

    system = PRESS_KIT_PROMPT.replace(
        "{brand_context}", brand_ctx
    ).replace("{scraped_content}", scraped_content)

    response = await call_claude(system, "Generate the press kit now.")
    result = _parse_json_response(response)

    # Store on product
    await update("products", data.product_id, {"press_kit": result})
    return result


# ─── Press Release Generation ───


@router.post("/press-release/generate")
async def generate_press_release(data: PressReleaseRequest, request: Request) -> dict:
    """Scrape URL and generate a press release via Claude."""
    product, settings = await _get_product_and_settings(data.product_id, _uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs")
    )

    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        raise HTTPException(400, f"Could not scrape URL: {scraped.get('error')}")

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

    system = PRESS_RELEASE_PROMPT.replace(
        "{brand_context}", brand_ctx
    ).replace("{scraped_content}", scraped_content).replace(
        "{contact_info}", contact_info
    )

    response = await call_claude(system, "Write the press release now.", max_tokens=4096)
    result = _parse_json_response(response)

    # Store on product
    await update("products", data.product_id, {"press_release": result})
    return result


# ─── SEO Analysis ───


@router.post("/seo/analyze")
async def analyze_seo(data: SEORequest, request: Request) -> dict:
    """Scrape URL metadata and generate optimized SEO tags."""
    import logging
    logger = logging.getLogger(__name__)

    product, settings = await _get_product_and_settings(data.product_id, _uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs")
    )

    logger.info(f"SEO: scraping {data.url}")
    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        logger.error(f"SEO: scrape failed: {scraped.get('error')}")
        raise HTTPException(400, f"Could not scrape URL: {scraped.get('error')}")

    logger.info(f"SEO: scrape OK, title={scraped['metadata'].get('title', '(none)')}")
    current_meta = json.dumps(scraped["metadata"], indent=2)

    system = SEO_ANALYSIS_PROMPT.replace(
        "{brand_context}", brand_ctx
    ).replace("{current_metadata}", current_meta)

    logger.info("SEO: calling Claude...")
    response = await call_claude(system, "Analyze and generate optimized metadata.")
    logger.info(f"SEO: Claude responded, length={len(response)}")
    result = _parse_json_response(response)

    if "raw_response" in result:
        logger.warning(f"SEO: JSON parse failed, raw response: {response[:500]}")

    # Store on product
    await update("products", data.product_id, {"seo_result": result})
    return result


# ─── Content Repurposer ───


@router.post("/repurpose")
async def repurpose_content(data: RepurposeRequest, request: Request) -> dict:
    """Repurpose content for multiple platforms."""
    product, settings = await _get_product_and_settings(data.product_id, _uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs")
    )

    system = REPURPOSE_PROMPT.replace(
        "{brand_context}", brand_ctx
    ).replace(
        "{original_content}", data.content
    ).replace(
        "{platforms}", ", ".join(data.platforms)
    )

    response = await call_claude(system, "Repurpose this content now.")
    return _parse_json_response(response)


# ─── Pricing Advisor ───


@router.post("/pricing/analyze")
async def analyze_pricing(data: PricingRequest, request: Request) -> dict:
    """Generate pricing strategy recommendations."""
    product, settings = await _get_product_and_settings(data.product_id, _uid(request))
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs")
    )

    system = PRICING_PROMPT.replace(
        "{brand_context}", brand_ctx
    ).replace("{notes}", data.notes)

    response = await call_claude(
        system,
        "Analyze the market and suggest pricing.",
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
    )
    return _parse_json_response(response)
