"""Routes for templates, calendar, captures, settings and brands. Everything belongs to an organisation."""

from datetime import UTC, datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from database import delete, insert, select, select_one, update
from models import (
    BrandCreate,
    BrandUpdate,
    CalendarEvent,
    CalendarEventCreate,
    CalendarEventUpdate,
    Capture,
    CaptureCreate,
    GlobalSettings,
    Template,
    TemplateCreate,
    new_id,
)
from services import access, audit


def _uid(request: Request) -> str:
    return request.state.user["id"]


# ═══════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════

templates_router = APIRouter(prefix="/api/templates", tags=["templates"])


@templates_router.get("")
async def list_templates(request: Request, tags: str | None = None) -> list[dict]:
    """List the organisation's templates."""
    current = await access.membership(request)
    all_templates = await select("templates", filters={"org_id": current.org_id})
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
    current = await access.membership(request)
    relevant_tags = workflow_tags.get(workflow_id, [])
    if not relevant_tags:
        return []

    all_templates = await select("templates", filters={"org_id": current.org_id})
    return [
        t for t in all_templates
        if any(tag in (t.get("tags") or []) for tag in relevant_tags)
    ]


@templates_router.post("", status_code=201)
async def create_template(data: TemplateCreate, request: Request) -> dict:
    """Save a template to the organisation's library (Editor)."""
    current = await access.membership(request, "editor")
    template = Template(
        id=new_id(),
        name=data.name,
        type=data.type,
        tags=data.tags,
        content=data.content,
        source_product=data.source_product,
    )
    row = template.model_dump(mode="json")
    row["org_id"] = current.org_id
    row["user_id"] = _uid(request)
    return await insert("templates", row)


@templates_router.delete("/{template_id}")
async def delete_template(template_id: str, request: Request) -> dict:
    """Delete a template (Editor)."""
    current = await access.membership(request)
    await access.load(current, "templates", template_id, "Template not found")
    access.ensure(current, "editor")
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
    """List the organisation's calendar events."""
    current = await access.membership(request)
    filters = {"org_id": current.org_id}
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
    """Create a calendar event (Editor)."""
    current = await access.membership(request, "editor")
    product = await select_one("products", data.product_id)
    # Another organisation's project lends the event nothing: no name, no colour
    if not access.in_org(product, current):
        product = None
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
    row["org_id"] = current.org_id
    row["user_id"] = _uid(request)
    # mode="json" turns the date into a string; asyncpg's DATE codec needs a datetime.date
    row["date"] = data.date
    return await insert("calendar_events", row)


@calendar_router.patch("/{event_id}")
async def update_event(event_id: str, data: CalendarEventUpdate, request: Request) -> dict:
    """Reschedule or edit a calendar event (Editor)."""
    current = await access.membership(request)
    evt = await access.load(current, "calendar_events", event_id, "Event not found")
    access.ensure(current, "editor")
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "product_id" in updates:
        product = await select_one("products", updates["product_id"])
        if not access.in_org(product, current):
            raise HTTPException(400, "Project not found")
        updates["product_name"] = product.get("name", "")
        updates["color"] = product.get("color", "#00f0ff")
    if not updates:
        return evt
    return await update("calendar_events", event_id, updates)


@calendar_router.delete("/{event_id}")
async def delete_event(event_id: str, request: Request) -> dict:
    """Delete a calendar event (Editor)."""
    current = await access.membership(request)
    await access.load(current, "calendar_events", event_id, "Event not found")
    access.ensure(current, "editor")
    await delete("calendar_events", event_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# QUICK CAPTURES
# ═══════════════════════════════════════

captures_router = APIRouter(prefix="/api/captures", tags=["captures"])


@captures_router.get("")
async def list_captures(request: Request, product_id: str | None = None) -> list[dict]:
    """List the organisation's captured ideas."""
    current = await access.membership(request)
    filters = {"org_id": current.org_id}
    if product_id:
        filters["product_id"] = product_id
    return await select("captures", filters=filters)


@captures_router.post("", status_code=201)
async def create_capture(data: CaptureCreate, request: Request) -> dict:
    """Capture an idea (Editor), optionally for one of the organisation's projects."""
    current = await access.membership(request, "editor")
    if data.product_id and not access.in_org(await select_one("products", data.product_id), current):
        raise HTTPException(404, "Product not found")
    capture = Capture(
        id=new_id(),
        text=data.text,
        product_id=data.product_id,
    )
    row = capture.model_dump(mode="json")
    row["org_id"] = current.org_id
    row["user_id"] = _uid(request)
    return await insert("captures", row)


@captures_router.delete("/{capture_id}")
async def delete_capture(capture_id: str, request: Request) -> dict:
    """Delete a captured idea (Editor)."""
    current = await access.membership(request)
    await access.load(current, "captures", capture_id, "Capture not found")
    access.ensure(current, "editor")
    await delete("captures", capture_id)
    return {"deleted": True}


# ═══════════════════════════════════════
# ORGANISATION SETTINGS
# ═══════════════════════════════════════

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("")
async def get_settings(request: Request) -> dict:
    """The organisation's channels, brand voice and output preferences."""
    current = await access.membership(request)
    rows = await select("settings", filters={"org_id": current.org_id}, order="updated_at", limit=1)
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
    """Save the organisation's settings (Editor); creates them the first time."""
    current = await access.membership(request, "editor")
    rows = await select("settings", filters={"org_id": current.org_id}, order="updated_at", limit=1)

    payload = {
        # Plain dicts — the JSONB codec can't serialize PlatformConfig models
        "platforms": {k: v.model_dump(mode="json") for k, v in data.platforms.items()},
        "brand": data.brand.model_dump(),
        "prefs": data.prefs.model_dump(),
        "updated_at": datetime.now(UTC).isoformat(),
    }

    payload["user_id"] = _uid(request)  # who saved them last
    if rows:
        # By org_id: every settings row shares id = 1, so updating by id would hit every organisation
        saved = await update("settings", current.org_id, payload, id_col="org_id")
    else:
        payload["org_id"] = current.org_id
        saved = await insert("settings", payload)
    await audit.record(current.org_id, request.state.user, "settings.updated",
                       "Changed the brand voice, channels or output preferences", target_type="settings")
    return saved


# ═══════════════════════════════════════
# BRANDS
# ═══════════════════════════════════════

brands_router = APIRouter(prefix="/api/brands", tags=["brands"])


@brands_router.get("")
async def list_brands(request: Request) -> list[dict]:
    """List the organisation's company profiles."""
    current = await access.membership(request)
    return await select("brands", filters={"org_id": current.org_id}, order="created_at")


@brands_router.post("", status_code=201)
async def create_brand(data: BrandCreate, request: Request) -> dict:
    """Create a company profile (Editor)."""
    current = await access.membership(request, "editor")
    # Omitted/null fields fall back to the column defaults
    row = data.model_dump(exclude_none=True)
    row["org_id"] = current.org_id
    row["user_id"] = _uid(request)
    row["created_at"] = datetime.now(timezone.utc).isoformat()
    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    return await insert("brands", row)


@brands_router.patch("/{brand_id}")
async def update_brand(brand_id: str, data: BrandUpdate, request: Request) -> dict:
    """Update a company profile (Editor)."""
    current = await access.membership(request)
    await access.load(current, "brands", brand_id, "Brand not found")
    access.ensure(current, "editor")
    # Only fields the client sent; null means "leave unchanged"
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    return await update("brands", brand_id, updates)


@brands_router.delete("/{brand_id}")
async def delete_brand(brand_id: str, request: Request) -> dict:
    """Delete a company profile (Editor)."""
    current = await access.membership(request)
    await access.load(current, "brands", brand_id, "Brand not found")
    access.ensure(current, "editor")
    await delete("brands", brand_id)
    return {"deleted": True}
