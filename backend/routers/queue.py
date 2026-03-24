"""Approval queue routes with email action extraction."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models import QueueUpdate
from database import select, select_one, update, delete, insert
from services.email import extract_contacts_from_content, send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/queue", tags=["queue"])

# Workflows that may contain actionable email contacts
EMAIL_WORKFLOWS = {"cold_outreach", "partnerships", "press_targets", "announcement"}


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
async def update_queue_item(
    item_id: str, data: QueueUpdate, background_tasks: BackgroundTasks,
) -> dict:
    """Approve, reject, or update a queue item.

    On approval, extracts contacts and creates email queue entries.
    """
    item = await select_one("queue", item_id)
    if not item:
        raise HTTPException(404, "Queue item not found")

    result = await update("queue", item_id, {
        "status": data.status.value,
        "notes": data.notes,
    })

    # On approval, extract contacts and queue emails
    if data.status.value == "approved" and item.get("workflow_id") in EMAIL_WORKFLOWS:
        background_tasks.add_task(
            _extract_and_queue_emails,
            item_id=item_id,
            product_id=item.get("product_id", ""),
            content=item.get("content", {}),
            workflow_id=item.get("workflow_id", ""),
        )

    return result


async def _extract_and_queue_emails(item_id: str, product_id: str,
                                     content: dict, workflow_id: str):
    """Extract contacts from approved content and add to email queue."""
    try:
        contacts = extract_contacts_from_content(content)
        if not contacts:
            logger.info(f"No contacts extracted from queue item {item_id}")
            return

        # Get product for SMTP settings
        product = await select_one("products", product_id)
        if not product:
            return

        smtp_settings = product.get("email_settings", {})
        product_name = product.get("name", "")

        for contact in contacts:
            # Generate a subject and body based on workflow type
            subject = f"Regarding {product_name}"
            body = f"Hi {contact['name'] or 'there'},\n\n"

            if workflow_id == "cold_outreach":
                # Look for the email content in the workflow results
                emails = content.get("emails", [])
                matching = [e for e in emails if isinstance(e, dict) and contact["email"] in str(e)]
                if matching:
                    subject = matching[0].get("subject", subject)
                    body = matching[0].get("body", body)
            elif workflow_id == "partnerships":
                body += f"I'd love to explore a potential partnership opportunity between our teams.\n\nContext: {contact.get('context', '')}\n\nBest regards"
            elif workflow_id == "announcement":
                body += f"I wanted to share some exciting news about {product_name}.\n\n"

            await insert("email_queue", {
                "product_id": product_id,
                "source_queue_id": item_id,
                "recipient_name": contact["name"],
                "recipient_email": contact["email"],
                "subject": subject,
                "body": body,
                "status": "pending",
            })

        logger.info(f"Queued {len(contacts)} emails from queue item {item_id}")

        # Auto-send if SMTP is configured
        if smtp_settings.get("smtp_host"):
            pending = await select("email_queue", {"source_queue_id": item_id, "status": "pending"})
            for email_item in pending:
                result = send_email(
                    smtp_settings,
                    to_email=email_item["recipient_email"],
                    to_name=email_item.get("recipient_name", ""),
                    subject=email_item["subject"],
                    body=email_item["body"],
                )
                if result["success"]:
                    await update("email_queue", email_item["id"], {
                        "status": "sent",
                        "sent_at": datetime.now(timezone.utc).isoformat(),
                    })
                else:
                    await update("email_queue", email_item["id"], {
                        "status": "failed",
                        "error": result["error"],
                    })
            logger.info(f"Auto-sent emails for queue item {item_id}")
        else:
            logger.info(f"SMTP not configured for product {product_id} — emails queued but not sent")

    except Exception as e:
        logger.error(f"Email extraction failed for queue item {item_id}: {e}")


@router.delete("/{item_id}")
async def delete_queue_item(item_id: str) -> dict:
    """Delete a queue item."""
    await delete("queue", item_id)
    return {"deleted": True}


# ─── Email Queue Routes ───

email_router = APIRouter(prefix="/api/email-queue", tags=["email"])


@email_router.get("")
async def list_email_queue(product_id: str | None = None, status: str | None = None) -> list[dict]:
    """List email queue items."""
    filters = {}
    if product_id:
        filters["product_id"] = product_id
    if status:
        filters["status"] = status
    return await select("email_queue", filters=filters if filters else None)


@email_router.post("/{email_id}/send")
async def send_queued_email(email_id: str) -> dict:
    """Manually send a pending email."""
    email_item = await select_one("email_queue", email_id)
    if not email_item:
        raise HTTPException(404, "Email not found")
    if email_item["status"] == "sent":
        raise HTTPException(400, "Email already sent")

    product = await select_one("products", email_item["product_id"])
    if not product:
        raise HTTPException(404, "Product not found")

    smtp_settings = product.get("email_settings", {})
    if not smtp_settings.get("smtp_host"):
        raise HTTPException(400, "SMTP not configured for this product. Go to Edit → Email Server.")

    result = send_email(
        smtp_settings,
        to_email=email_item["recipient_email"],
        to_name=email_item.get("recipient_name", ""),
        subject=email_item["subject"],
        body=email_item["body"],
    )

    if result["success"]:
        await update("email_queue", email_id, {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "sent"}
    else:
        await update("email_queue", email_id, {
            "status": "failed",
            "error": result["error"],
        })
        raise HTTPException(500, f"Send failed: {result['error']}")


@email_router.delete("/{email_id}")
async def delete_email(email_id: str) -> dict:
    """Delete an email from the queue."""
    await delete("email_queue", email_id)
    return {"deleted": True}
