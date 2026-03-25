"""Product CRUD routes — multi-tenant (user_id isolation)."""

from fastapi import APIRouter, HTTPException, Request
from models import Product, ProductCreate, ProductUpdate, new_id
from database import insert, select, select_one, update, delete
from datetime import datetime

router = APIRouter(prefix="/api/products", tags=["products"])


def _uid(request: Request) -> str:
    return request.state.user["id"]


@router.get("")
async def list_products(request: Request) -> list[dict]:
    """List all products for the current user."""
    return await select("products", filters={"user_id": _uid(request)})


@router.get("/{product_id}")
async def get_product(product_id: str, request: Request) -> dict:
    """Get a single product (owned by current user)."""
    product = await select_one("products", product_id)
    if not product or product.get("user_id") != _uid(request):
        raise HTTPException(404, "Product not found")
    return product


@router.post("", status_code=201)
async def create_product(data: ProductCreate, request: Request) -> dict:
    """Create a new product for the current user."""
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
    row["user_id"] = _uid(request)
    return await insert("products", row)


@router.patch("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, request: Request) -> dict:
    """Update a product (owned by current user)."""
    product = await select_one("products", product_id)
    if not product or product.get("user_id") != _uid(request):
        raise HTTPException(404, "Product not found")
    updates = data.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.utcnow().isoformat()
    return await update("products", product_id, updates)


@router.delete("/{product_id}")
async def delete_product(product_id: str, request: Request) -> dict:
    """Delete a product (owned by current user)."""
    product = await select_one("products", product_id)
    if not product or product.get("user_id") != _uid(request):
        raise HTTPException(404, "Product not found")
    await delete("products", product_id)
    return {"deleted": True}


@router.patch("/{product_id}/checklist")
async def update_checklist(product_id: str, checklist: dict, request: Request) -> dict:
    """Update a product's launch checklist state."""
    product = await select_one("products", product_id)
    if not product or product.get("user_id") != _uid(request):
        raise HTTPException(404, "Product not found")
    return await update("products", product_id, {
        "checklist": checklist,
        "updated_at": datetime.utcnow().isoformat(),
    })
