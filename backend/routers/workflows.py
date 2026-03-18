"""Workflow execution routes — the AI engine.

Handles launching AI workflows, press kit generation, SEO analysis,
content repurposing, and pricing analysis. All results flow into the
approval queue.
"""

import json
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models import (
    WorkflowRequest, WorkflowResponse, PressKitRequest, SEORequest,
    RepurposeRequest, PricingRequest, QueueItem, new_id, TaskStatus,
    QueueStatus,
)
from database import insert, select_one, update
from services.claude import (
    call_claude, build_brand_context, WORKFLOW_PROMPTS,
    PRESS_KIT_PROMPT, SEO_ANALYSIS_PROMPT, REPURPOSE_PROMPT,
    PRICING_PROMPT,
)
from services.scraper import scrape_url

router = APIRouter(prefix="/api", tags=["workflows"])


async def _get_product_and_settings(product_id: str) -> tuple[dict, dict]:
    """Fetch product and global settings, raise 404 if product missing."""
    product = await select_one("products", product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    settings_row = await select_one("settings", 1, id_col="id") or {}
    return product, settings_row


def _parse_json_response(text: str) -> dict:
    """Parse Claude's JSON response, handling markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw_response": text}


async def _run_workflow(product_id: str, workflow_id: str,
                        instructions: str, queue_id: str):
    """Execute a workflow in the background and store results."""
    try:
        product = await select_one("products", product_id)
        if not product:
            await update("queue", queue_id, {
                "status": "failed",
                "content": {"error": "Product not found"},
            })
            return

        settings_row = await select_one("settings", 1, id_col="id") or {}
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
) -> WorkflowResponse:
    """Launch an AI workflow. Runs in background, results go to queue."""
    product = await select_one("products", data.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    if data.workflow_id not in WORKFLOW_PROMPTS:
        raise HTTPException(400, f"Unknown workflow: {data.workflow_id}")

    # Create queue entry in "running" state
    queue_id = new_id()
    await insert("queue", {
        "id": queue_id,
        "product_id": data.product_id,
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
    )

    return WorkflowResponse(
        task_id=queue_id,
        status=TaskStatus.RUNNING,
        message=f"Workflow '{data.workflow_id}' launched for {product['name']}",
    )


# ─── Press Kit Generation ───


@router.post("/presskit/generate")
async def generate_press_kit(data: PressKitRequest) -> dict:
    """Scrape URL and generate a press kit via Claude."""
    product, settings = await _get_product_and_settings(data.product_id)
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


# ─── SEO Analysis ───


@router.post("/seo/analyze")
async def analyze_seo(data: SEORequest) -> dict:
    """Scrape URL metadata and generate optimized SEO tags."""
    product, settings = await _get_product_and_settings(data.product_id)
    brand_ctx = build_brand_context(
        product, settings.get("brand"), settings.get("prefs")
    )

    scraped = await scrape_url(data.url)
    if scraped.get("status") != "ok":
        raise HTTPException(400, f"Could not scrape URL: {scraped.get('error')}")

    current_meta = json.dumps(scraped["metadata"], indent=2)

    system = SEO_ANALYSIS_PROMPT.replace(
        "{brand_context}", brand_ctx
    ).replace("{current_metadata}", current_meta)

    response = await call_claude(system, "Analyze and generate optimized metadata.")
    result = _parse_json_response(response)

    # Store on product
    await update("products", data.product_id, {"seo_result": result})
    return result


# ─── Content Repurposer ───


@router.post("/repurpose")
async def repurpose_content(data: RepurposeRequest) -> dict:
    """Repurpose content for multiple platforms."""
    product, settings = await _get_product_and_settings(data.product_id)
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
async def analyze_pricing(data: PricingRequest) -> dict:
    """Generate pricing strategy recommendations."""
    product, settings = await _get_product_and_settings(data.product_id)
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
