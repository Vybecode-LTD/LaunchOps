"""Routes for templates, calendar, captures, and settings."""

from fastapi import APIRouter, HTTPException
from models import (
    TemplateCreate, Template, CalendarEventCreate, CalendarEvent,
    CaptureCreate, Capture, GlobalSettings, new_id,
)
from database import insert, select, select_one, update, delete
from datetime import datetime

# ═══════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════

templates_router = APIRouter(prefix="/api/templates", tags=["templates"])


@templates_router.get("")
async def list_templates(tags: str | None = None) -> list[dict]:
    """List templates, optionally filtered by tag."""
    all_templates = await select("templates")
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        return [
            t for t in all_templates
            if any(tag in (t.get("tags") or []) for tag in tag_list)
        ]
    return all_templates


@templates_router.get("/for-workflow/{workflow_id}")
async def templates_for_workflow(workflow_id: str) -> list[dict]:
    """Get templates relevant to a specific workflow based on tag matching."""
    workflow_tags = {
        "cold_outreach": ["outreach", "email"],
        "partnerships": ["outreach", "email"],
        "social_posts": ["social", "content"],
        "ad_copy": ["social", "content", "ads"],
        "blog": ["content", "blog"],
        "announcement": ["content", "social", "email"],
        "reddit": ["social", "community"],
        "competitor": ["research"],
        "trend": ["research"],
        "directories": ["outreach"],
        "launch_platforms": ["outreach", "community"],
        "podcasts": ["outreach"],
    }
    relevant_tags = workflow_tags.get(workflow_id, [])
    if not relevant_tags:
        return []

    all_templates = await select("templates")
    return [
        t for t in all_templates
        if any(tag in (t.get("tags") or []) for tag in relevant_tags)
    ]


@templates_router.post("", status_code=201)
async def create_template(data: TemplateCreate) -> dict:
    """Save a new template."""
    template = Template(
        id=new_id(),
        name=data.name,
        type=data.type,
        tags=data.tags,
        content=data.content,
        source_product=data.source_product,
    )
    return await insert("templates", template.model_dump(mode="json"))


@templates_router.delete("/{template_id}")
async def delete_template(template_id: str) -> dict:
    """Delete a template."""
    await delete("templates", template_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# CALENDAR
# ═══════════════════════════════════════

calendar_router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@calendar_router.get("")
async def list_events(
    product_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """List calendar events with optional filters."""
    filters = {}
    if product_id:
        filters["product_id"] = product_id
    events = await select("calendar_events", filters=filters if filters else None,
                          order="date", descending=False)

    # Apply date range filter in Python
    if date_from:
        events = [e for e in events if str(e.get("date", "")) >= date_from]
    if date_to:
        events = [e for e in events if str(e.get("date", "")) <= date_to]
    return events


@calendar_router.post("", status_code=201)
async def create_event(data: CalendarEventCreate) -> dict:
    """Create a calendar event."""
    product = await select_one("products", data.product_id)
    event = CalendarEvent(
        id=new_id(),
        date=data.date,
        product_id=data.product_id,
        product_name=product.get("name", "") if product else "",
        platform=data.platform,
        title=data.title,
        color=product.get("color", "#00f0ff") if product else "#00f0ff",
    )
    return await insert("calendar_events", event.model_dump(mode="json"))


@calendar_router.delete("/{event_id}")
async def delete_event(event_id: str) -> dict:
    """Delete a calendar event."""
    await delete("calendar_events", event_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# QUICK CAPTURES
# ═══════════════════════════════════════

captures_router = APIRouter(prefix="/api/captures", tags=["captures"])


@captures_router.get("")
async def list_captures(product_id: str | None = None) -> list[dict]:
    """List captures, optionally filtered by product."""
    filters = {"product_id": product_id} if product_id else None
    return await select("captures", filters=filters)


@captures_router.post("", status_code=201)
async def create_capture(data: CaptureCreate) -> dict:
    """Create a quick capture."""
    capture = Capture(
        id=new_id(),
        text=data.text,
        product_id=data.product_id,
    )
    return await insert("captures", capture.model_dump(mode="json"))


@captures_router.delete("/{capture_id}")
async def delete_capture(capture_id: str) -> dict:
    """Delete a capture."""
    await delete("captures", capture_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# GLOBAL SETTINGS
# ═══════════════════════════════════════

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("")
async def get_settings() -> dict:
    """Get global settings."""
    row = await select_one("settings", 1, id_col="id")
    if not row:
        return GlobalSettings().model_dump()
    return {
        "platforms": row.get("platforms", {}),
        "brand": row.get("brand", {}),
        "prefs": row.get("prefs", {}),
    }


@settings_router.put("")
async def update_settings(data: GlobalSettings) -> dict:
    """Update global settings."""
    return await update("settings", 1, {
        "platforms": data.platforms,
        "brand": data.brand.model_dump(),
        "prefs": data.prefs.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
    }, id_col="id")
