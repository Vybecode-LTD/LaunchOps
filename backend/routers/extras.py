"""Routes for templates, calendar, captures, and settings — multi-tenant."""

from fastapi import APIRouter, HTTPException, Request
from models import (
    TemplateCreate, Template, CalendarEventCreate, CalendarEvent,
    CaptureCreate, Capture, GlobalSettings, new_id,
)
from database import insert, select, select_one, update, delete
from datetime import datetime


def _uid(request: Request) -> str:
    return request.state.user["id"]


# ═══════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════

templates_router = APIRouter(prefix="/api/templates", tags=["templates"])


@templates_router.get("")
async def list_templates(request: Request, tags: str | None = None) -> list[dict]:
    """List templates for the current user."""
    all_templates = await select("templates", filters={"user_id": _uid(request)})
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        return [
            t for t in all_templates
            if any(tag in (t.get("tags") or []) for tag in tag_list)
        ]
    return all_templates


@templates_router.get("/for-workflow/{workflow_id}")
async def templates_for_workflow(workflow_id: str, request: Request) -> list[dict]:
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

    all_templates = await select("templates", filters={"user_id": _uid(request)})
    return [
        t for t in all_templates
        if any(tag in (t.get("tags") or []) for tag in relevant_tags)
    ]


@templates_router.post("", status_code=201)
async def create_template(data: TemplateCreate, request: Request) -> dict:
    """Save a new template for the current user."""
    template = Template(
        id=new_id(),
        name=data.name,
        type=data.type,
        tags=data.tags,
        content=data.content,
        source_product=data.source_product,
    )
    row = template.model_dump(mode="json")
    row["user_id"] = _uid(request)
    return await insert("templates", row)


@templates_router.delete("/{template_id}")
async def delete_template(template_id: str, request: Request) -> dict:
    """Delete a template (owned by current user)."""
    tmpl = await select_one("templates", template_id)
    if not tmpl or tmpl.get("user_id") != _uid(request):
        raise HTTPException(404, "Template not found")
    await delete("templates", template_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# CALENDAR
# ═══════════════════════════════════════

calendar_router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@calendar_router.get("")
async def list_events(
    request: Request,
    product_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """List calendar events for the current user."""
    filters = {"user_id": _uid(request)}
    if product_id:
        filters["product_id"] = product_id
    events = await select("calendar_events", filters=filters,
                          order="date", descending=False)

    if date_from:
        events = [e for e in events if str(e.get("date", "")) >= date_from]
    if date_to:
        events = [e for e in events if str(e.get("date", "")) <= date_to]
    return events


@calendar_router.post("", status_code=201)
async def create_event(data: CalendarEventCreate, request: Request) -> dict:
    """Create a calendar event for the current user."""
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
    row = event.model_dump(mode="json")
    row["user_id"] = _uid(request)
    return await insert("calendar_events", row)


@calendar_router.delete("/{event_id}")
async def delete_event(event_id: str, request: Request) -> dict:
    """Delete a calendar event (owned by current user)."""
    evt = await select_one("calendar_events", event_id)
    if not evt or evt.get("user_id") != _uid(request):
        raise HTTPException(404, "Event not found")
    await delete("calendar_events", event_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# QUICK CAPTURES
# ═══════════════════════════════════════

captures_router = APIRouter(prefix="/api/captures", tags=["captures"])


@captures_router.get("")
async def list_captures(request: Request, product_id: str | None = None) -> list[dict]:
    """List captures for the current user."""
    filters = {"user_id": _uid(request)}
    if product_id:
        filters["product_id"] = product_id
    return await select("captures", filters=filters)


@captures_router.post("", status_code=201)
async def create_capture(data: CaptureCreate, request: Request) -> dict:
    """Create a quick capture for the current user."""
    capture = Capture(
        id=new_id(),
        text=data.text,
        product_id=data.product_id,
    )
    row = capture.model_dump(mode="json")
    row["user_id"] = _uid(request)
    return await insert("captures", row)


@captures_router.delete("/{capture_id}")
async def delete_capture(capture_id: str, request: Request) -> dict:
    """Delete a capture (owned by current user)."""
    cap = await select_one("captures", capture_id)
    if not cap or cap.get("user_id") != _uid(request):
        raise HTTPException(404, "Capture not found")
    await delete("captures", capture_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# PER-USER SETTINGS
# ═══════════════════════════════════════

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("")
async def get_settings(request: Request) -> dict:
    """Get settings for the current user."""
    uid = _uid(request)
    rows = await select("settings", filters={"user_id": uid}, order="updated_at", limit=1)
    if not rows:
        return GlobalSettings().model_dump()
    row = rows[0]
    return {
        "platforms": row.get("platforms", {}),
        "brand": row.get("brand", {}),
        "prefs": row.get("prefs", {}),
    }


@settings_router.put("")
async def update_settings(data: GlobalSettings, request: Request) -> dict:
    """Update settings for the current user (creates if not exists)."""
    uid = _uid(request)
    rows = await select("settings", filters={"user_id": uid}, order="updated_at", limit=1)

    payload = {
        "platforms": data.platforms,
        "brand": data.brand.model_dump(),
        "prefs": data.prefs.model_dump(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    if rows:
        return await update("settings", rows[0]["id"], payload, id_col="id")
    else:
        payload["user_id"] = uid
        return await insert("settings", payload)
