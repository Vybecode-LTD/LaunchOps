"""Approval queue routes."""

from fastapi import APIRouter, HTTPException
from models import QueueUpdate
from database import select, select_one, update, delete

router = APIRouter(prefix="/api/queue", tags=["queue"])


@router.get("")
async def list_queue(
    product_id: str | None = None,
    status: str | None = None,
) -> list[dict]:
    """List queue items, optionally filtered."""
    filters = {}
    if product_id:
        filters["product_id"] = product_id
    if status:
        filters["status"] = status
    return await select("queue", filters=filters if filters else None)


@router.get("/{item_id}")
async def get_queue_item(item_id: str) -> dict:
    """Get a single queue item with full content."""
    item = await select_one("queue", item_id)
    if not item:
        raise HTTPException(404, "Queue item not found")
    return item


@router.patch("/{item_id}")
async def update_queue_item(item_id: str, data: QueueUpdate) -> dict:
    """Approve, reject, or update a queue item."""
    item = await select_one("queue", item_id)
    if not item:
        raise HTTPException(404, "Queue item not found")
    return await update("queue", item_id, {
        "status": data.status.value,
        "notes": data.notes,
    })


@router.delete("/{item_id}")
async def delete_queue_item(item_id: str) -> dict:
    """Delete a queue item."""
    await delete("queue", item_id)
    return {"deleted": True}
