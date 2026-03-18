"""Product CRUD routes."""

from fastapi import APIRouter, HTTPException
from models import Product, ProductCreate, ProductUpdate, new_id
from database import insert, select, select_one, update, delete
from datetime import datetime

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("")
async def list_products() -> list[dict]:
    """List all products."""
    return select("products")


@router.get("/{product_id}")
async def get_product(product_id: str) -> dict:
    """Get a single product."""
    product = select_one("products", product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.post("", status_code=201)
async def create_product(data: ProductCreate) -> dict:
    """Create a new product."""
    product = Product(
        id=new_id(),
        name=data.name,
        tagline=data.tagline,
        url=data.url,
        color=data.color,
        description=data.description,
        keywords=data.keywords,
    )
    return insert("products", product.model_dump(mode="json"))


@router.patch("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate) -> dict:
    """Update a product."""
    product = select_one("products", product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    updates = data.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.utcnow().isoformat()
    return update("products", product_id, updates)


@router.delete("/{product_id}")
async def delete_product(product_id: str) -> dict:
    """Delete a product and all related data."""
    delete("products", product_id)
    return {"deleted": True}


@router.patch("/{product_id}/checklist")
async def update_checklist(product_id: str, checklist: dict) -> dict:
    """Update a product's launch checklist state."""
    return update("products", product_id, {
        "checklist": checklist,
        "updated_at": datetime.utcnow().isoformat(),
    })
