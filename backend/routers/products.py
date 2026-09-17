"""Project (product) routes. Projects belong to an organisation; see services/access.py for roles."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request

from database import delete, get_pool, insert, select, select_one, update
from models import Product, ProductCreate, ProductUpdate, new_id
from services import access, audit, field_crypto

router = APIRouter(prefix="/api/products", tags=["products"])

# PATCH fields where an explicit null means "clear it" (unassign brand / no launch date)
NULLABLE_FIELDS = {"brand_id", "launch_date"}


def _uid(request: Request) -> str:
    return request.state.user["id"]


async def _brand_in_org(brand_id: str, current: access.Membership) -> str:
    """Return brand_id (normalized) if it names a company profile in the organisation, else 400.

    Stops a project from pulling another tenant's brand into its AI context.
    """
    try:
        brand_id = str(uuid.UUID(brand_id))
    except ValueError:
        raise HTTPException(400, "Brand not found") from None
    if not access.in_org(await select_one("brands", brand_id), current):
        raise HTTPException(400, "Brand not found")
    return brand_id


def _public_product(product: dict) -> dict:
    """Product as returned to clients: the SMTP password is write-only."""
    email_settings = dict(product.get("email_settings") or {})
    email_settings["smtp_password_set"] = bool(email_settings.pop("smtp_password", ""))
    return {**product, "email_settings": email_settings}


def _merge_email_settings(incoming: dict, stored: dict | None) -> dict:
    """Apply an email_settings PATCH without losing the stored SMTP password.

    Clients never receive the password, so a missing or empty smtp_password
    keeps the stored one. A new password is stored encrypted (finding F-2).
    smtp_password_set is response-only, never stored.
    """
    merged = {k: v for k, v in incoming.items() if k != "smtp_password_set"}
    if merged.get("smtp_password"):
        merged["smtp_password"] = field_crypto.encrypt(merged["smtp_password"])
    else:
        merged.pop("smtp_password", None)
        stored_password = (stored or {}).get("smtp_password")
        if stored_password:
            merged["smtp_password"] = stored_password
    return merged


async def encrypt_stored_smtp_passwords() -> int:
    """Encrypt SMTP passwords saved in plain text by earlier versions. Returns how many were encrypted."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, email_settings FROM products "
        "WHERE coalesce(email_settings->>'smtp_password', '') <> '' "
        "AND NOT starts_with(email_settings->>'smtp_password', $1)",
        field_crypto.PREFIX,
    )
    for row in rows:
        settings = dict(row["email_settings"])
        settings["smtp_password"] = field_crypto.encrypt(settings["smtp_password"])
        await pool.execute("UPDATE products SET email_settings = $1 WHERE id = $2", settings, row["id"])
    return len(rows)


@router.get("")
async def list_products(request: Request) -> list[dict]:
    """List the organisation's projects."""
    current = await access.membership(request)
    products = await select("products", filters={"org_id": current.org_id})
    return [_public_product(p) for p in products]


@router.get("/{product_id}")
async def get_product(product_id: str, request: Request) -> dict:
    """Get one of the organisation's projects."""
    current = await access.membership(request)
    product = await access.load(current, "products", product_id, "Product not found")
    return _public_product(product)


@router.post("", status_code=201)
async def create_product(data: ProductCreate, request: Request) -> dict:
    """Create a project in the organisation (Editor)."""
    current = await access.membership(request, "editor")
    brand_id = None
    if data.brand_id is not None:
        brand_id = await _brand_in_org(data.brand_id, current)
    product = Product(
        id=new_id(),
        name=data.name,
        tagline=data.tagline,
        url=data.url,
        color=data.color,
        description=data.description,
        keywords=data.keywords,
    )
    row = product.model_dump(mode="json")
    row["org_id"] = current.org_id
    row["user_id"] = _uid(request)
    row["project_type"] = data.project_type
    # A date object, not its JSON string — asyncpg's DATE codec needs datetime.date
    row["launch_date"] = data.launch_date
    row["brand_id"] = brand_id
    created = await insert("products", row)
    await audit.record(current.org_id, request.state.user, "project.created", f"Created the project {created['name']}",
                       target_type="project", target_id=created["id"])
    return _public_product(created)


@router.patch("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, request: Request) -> dict:
    """Update one of the organisation's projects (Editor)."""
    current = await access.membership(request)
    product = await access.load(current, "products", product_id, "Product not found")
    access.ensure(current, "editor")
    # Only fields the client sent; null is dropped unless it means "clear"
    updates = {
        k: v for k, v in data.model_dump(exclude_unset=True).items()
        if v is not None or k in NULLABLE_FIELDS
    }
    if updates.get("brand_id") is not None:
        updates["brand_id"] = await _brand_in_org(updates["brand_id"], current)
    if "email_settings" in updates:
        updates["email_settings"] = _merge_email_settings(updates["email_settings"], product.get("email_settings"))
    updates["updated_at"] = datetime.now(UTC).isoformat()
    return _public_product(await update("products", product_id, updates))


@router.delete("/{product_id}")
async def delete_product(product_id: str, request: Request) -> dict:
    """Delete one of the organisation's projects and everything attached to it (Owner)."""
    current = await access.membership(request)
    product = await access.load(current, "products", product_id, "Product not found")
    access.ensure(current, "owner")
    await delete("products", product_id)
    await audit.record(current.org_id, request.state.user, "project.deleted", f"Deleted the project {product['name']}",
                       target_type="project", target_id=product_id)
    return {"deleted": True}


@router.patch("/{product_id}/checklist")
async def update_checklist(product_id: str, checklist: dict, request: Request) -> dict:
    """Update a project's launch checklist state (Editor)."""
    current = await access.membership(request)
    await access.load(current, "products", product_id, "Product not found")
    access.ensure(current, "editor")
    return _public_product(await update("products", product_id, {
        "checklist": checklist,
        "updated_at": datetime.now(UTC).isoformat(),
    }))
