"""Approval queue routes with email action extraction — multi-tenant."""

import asyncio
import logging
import math
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response

from config import get_settings
from database import delete, get_pool, insert, select, select_one, update
from models import EmailDraftUpdate, QueueUpdate
from services import access, audit, events, field_crypto, jobs
from services.email import extract_contacts_from_content, send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/queue", tags=["queue"])

# Workflows that may contain actionable email contacts. press_targets can no longer be run, but
# results it saved before it was retired can still be approved into drafts.
EMAIL_WORKFLOWS = {"cold_outreach", "partnerships", "press_targets", "announcement"}


def _uid(request: Request) -> str:
    return request.state.user["id"]


async def _project_name(row: dict) -> str:
    product = await select_one("products", row["product_id"]) if row.get("product_id") else None
    return product.get("name", "") if product else "a deleted project"


@router.get("")
async def list_queue(
    request: Request,
    product_id: str | None = None,
    status: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[dict]:
    """List the organisation's results."""
    current = await access.membership(request)
    filters = {"org_id": current.org_id}
    if product_id:
        filters["product_id"] = product_id
    if status:
        filters["status"] = status
    return await select("queue", filters=filters, limit=limit)


@router.get("/summary")
async def queue_summary(request: Request, product_id: str) -> list[dict]:
    """How many of a project's results each operation has in each status — all of them, however many.

    The Operations playbook reads what's finished from this. A page of `GET /api/queue` holds the newest
    500 at most, so an operation whose only approved result was older would look unfinished; and this is
    a few counts where that list is every result's content. Declared before `/{item_id}`, which would
    otherwise take "summary" for an id.
    """
    current = await access.membership(request)
    product = await access.load(current, "products", product_id, "Product not found")
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT workflow_id, status, COUNT(*) AS count FROM queue"
        " WHERE org_id = $1 AND product_id = $2 GROUP BY workflow_id, status ORDER BY workflow_id, status",
        uuid.UUID(current.org_id), uuid.UUID(product["id"]),
    )
    return [
        {"product_id": product["id"], "workflow_id": row["workflow_id"], "status": row["status"], "count": row["count"]}
        for row in rows
    ]


@router.get("/{item_id}")
async def get_queue_item(item_id: str, request: Request) -> dict:
    """Get one of the organisation's results."""
    current = await access.membership(request)
    return await access.load(current, "queue", item_id, "Queue item not found")


@router.patch("/{item_id}")
async def update_queue_item(item_id: str, data: QueueUpdate, request: Request) -> dict:
    """Approve or reject a result (Approver). Approving an outreach result creates its Outbox drafts before
    answering, so a restart straight after an approval can't lose them."""
    current = await access.membership(request)
    item = await access.load(current, "queue", item_id, "Queue item not found")
    access.ensure(current, "approver")

    result = await update("queue", item_id, {
        "status": data.status.value,
        "notes": data.notes,
    })
    if data.status.value != item.get("status"):
        await events.publish(current.org_id, "queue", item_id, data.status.value)
        verb = {"approved": "Approved", "rejected": "Rejected"}.get(data.status.value, "Moved back to review")
        action = {"approved": "result.approved", "rejected": "result.rejected"}.get(data.status.value, "result.reopened")
        await audit.record(
            current.org_id, request.state.user, action,
            f"{verb} {audit.quoted(item.get('preview'))} for {await _project_name(item)}",
            target_type="result", target_id=item_id,
        )

    # On approval, extract contacts and queue emails
    if data.status.value == "approved" and item.get("workflow_id") in EMAIL_WORKFLOWS:
        await _extract_and_queue_emails(
            item_id=item_id,
            product_id=item.get("product_id", ""),
            org_id=current.org_id,
            user_id=_uid(request),
            content=item.get("content", {}),
            workflow_id=item.get("workflow_id", ""),
        )

    return result


async def _extract_and_queue_emails(item_id: str, product_id: str, org_id: str, user_id: str,
                                     content: dict, workflow_id: str):
    """Extract contacts from approved content into the email queue as drafts.

    Never sends: drafts wait in the email queue until a person sends them.
    Runs once per queue item, so approve → reject → approve adds no duplicates.
    """
    try:
        if await select("email_queue", {"source_queue_id": item_id}, limit=1):
            logger.info(f"Email drafts already exist for queue item {item_id}")
            return

        contacts = extract_contacts_from_content(content)
        if not contacts:
            logger.info(f"No contacts extracted from queue item {item_id}")
            return

        product = await select_one("products", product_id)
        if not product:
            return

        product_name = product.get("name", "")

        for contact in contacts:
            subject = f"Regarding {product_name}"
            body = f"Hi {contact['name'] or 'there'},\n\n"

            if workflow_id == "cold_outreach":
                emails = content.get("emails", [])
                matching = [e for e in emails if isinstance(e, dict) and contact["email"] in str(e)]
                if matching:
                    subject = matching[0].get("subject", subject)
                    body = matching[0].get("body", body)
            elif workflow_id == "partnerships":
                body += f"I'd love to explore a potential partnership opportunity between our teams.\n\nContext: {contact.get('context', '')}\n\nBest regards"
            elif workflow_id == "announcement":
                email_version = content.get("email_version")
                if isinstance(email_version, str) and email_version.strip():
                    body = email_version
                else:
                    body += f"I wanted to share some exciting news about {product_name}.\n\n"

            await insert("email_queue", {
                "product_id": product_id,
                "org_id": org_id,
                "user_id": user_id,
                "source_queue_id": item_id,
                "recipient_name": contact["name"],
                "recipient_email": contact["email"],
                "subject": subject,
                "body": body,
                "status": "pending",
            })

        logger.info(f"Queued {len(contacts)} emails from queue item {item_id}")
        await events.publish(org_id, "email", item_id, "drafts")

    except Exception:
        logger.exception("Email extraction failed for queue item %s", item_id)


@router.post("/{item_id}/cancel")
async def cancel_operation(item_id: str, request: Request, response: Response) -> dict:
    """Cancel an operation that's waiting or running (Editor). A running one stops within seconds (202)."""
    current = await access.membership(request)
    item = await access.load(current, "queue", item_id, "Queue item not found")
    access.ensure(current, "editor")
    outcome = await jobs.cancel(item_id, f"Cancelled by {request.state.user['email']}.")
    if outcome is None:
        raise HTTPException(409, "This operation has already finished.")
    await audit.record(current.org_id, request.state.user, "operation.cancelled",
                       f"Cancelled {item.get('workflow_id', 'an operation')} for {await _project_name(item)}",
                       target_type="result", target_id=item_id)
    if outcome == "cancelling":
        response.status_code = 202
    return {"status": outcome}


@router.delete("/{item_id}")
async def delete_queue_item(item_id: str, request: Request) -> dict:
    """Delete a result (Approver)."""
    current = await access.membership(request)
    item = await access.load(current, "queue", item_id, "Queue item not found")
    access.ensure(current, "approver")
    await delete("queue", item_id)
    await events.publish(current.org_id, "queue", item_id, "deleted")
    await audit.record(current.org_id, request.state.user, "result.deleted",
                       f"Deleted {audit.quoted(item.get('preview'))} for {await _project_name(item)}",
                       target_type="result", target_id=item_id)
    return {"deleted": True}


# ─── Email Queue Routes ───

email_router = APIRouter(prefix="/api/email-queue", tags=["email"])


@email_router.get("")
async def list_email_queue(request: Request, product_id: str | None = None, status: str | None = None) -> list[dict]:
    """List the organisation's Outbox."""
    current = await access.membership(request)
    filters = {"org_id": current.org_id}
    if product_id:
        filters["product_id"] = product_id
    if status:
        filters["status"] = status
    return await select("email_queue", filters=filters)


# One send at a time per account, so two simultaneous sends can't both take the last slot of the day.
_send_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
SEND_WINDOW = timedelta(hours=24)


async def _email_quota(user_id: str) -> dict:
    """Sends in the last 24 hours against the account's daily limit, and when a slot frees up."""
    limit = get_settings().max_emails_per_day
    pool = await get_pool()
    sent_times = [
        row["sent_at"]
        for row in await pool.fetch(
            "SELECT sent_at FROM email_queue WHERE COALESCE(sent_by, user_id) = $1 AND status = 'sent' "
            "AND sent_at > now() - $2::interval ORDER BY sent_at",
            user_id, SEND_WINDOW,
        )
    ]
    remaining = max(0, limit - len(sent_times))
    next_available_at = None
    if remaining == 0 and sent_times and len(sent_times) >= limit > 0:
        # The window slides: a slot frees up when the send that brings the count under the limit ages out.
        next_available_at = (sent_times[len(sent_times) - limit] + SEND_WINDOW).isoformat()
    return {"limit": limit, "sent": len(sent_times), "remaining": remaining, "next_available_at": next_available_at}


def _wait_description(seconds: float) -> str:
    if seconds >= 3600:
        hours = math.ceil(seconds / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''}"
    minutes = max(1, math.ceil(seconds / 60))
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


@email_router.get("/quota")
async def email_quota(request: Request) -> dict:
    """How many emails this account can still send in the current 24-hour window."""
    await access.membership(request)
    return await _email_quota(_uid(request))


@email_router.post("/{email_id}/send")
async def send_queued_email(email_id: str, request: Request) -> dict:
    """Send one draft now (Approver). The daily limit counts the sender's sends."""
    current = await access.membership(request)
    email_item = await access.load(current, "email_queue", email_id, "Email not found")
    access.ensure(current, "approver")
    if email_item["status"] == "sent":
        raise HTTPException(400, "Email already sent")

    product = await select_one("products", email_item["product_id"])
    if not product:
        raise HTTPException(404, "Product not found")

    smtp_settings = dict(product.get("email_settings") or {})
    if not smtp_settings.get("smtp_host"):
        raise HTTPException(400, "SMTP not configured for this product. Go to Edit → Email Server.")
    try:
        smtp_settings["smtp_password"] = field_crypto.decrypt(smtp_settings.get("smtp_password", ""))
    except field_crypto.UnreadableValue:
        raise HTTPException(
            409,
            "The saved email server password for this project can't be read, because the encryption key changed. "
            "Enter the password again in the project's email settings.",
        ) from None

    uid = _uid(request)
    async with _send_locks[uid]:
        quota = await _email_quota(uid)
        if quota["limit"] == 0:
            raise HTTPException(
                429,
                "Sending email is switched off on this server: its daily limit is 0. Ask the administrator to raise MAX_EMAILS_PER_DAY.",
            )
        if quota["remaining"] == 0:
            retry_after = SEND_WINDOW.total_seconds()
            if quota["next_available_at"]:
                retry_after = (datetime.fromisoformat(quota["next_available_at"]) - datetime.now(timezone.utc)).total_seconds()
            retry_after = max(1, math.ceil(retry_after))
            raise HTTPException(
                429,
                f"You've sent {quota['limit']} emails in the last 24 hours, which is the daily limit. "
                f"Try again in {_wait_description(retry_after)}.",
                headers={"Retry-After": str(retry_after)},
            )

        # smtplib blocks — run it in a worker thread so the event loop keeps serving
        result = await asyncio.to_thread(
            send_email,
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
                "sent_by": uid,
            })
            await events.publish(current.org_id, "email", email_id, "sent")
            await audit.record(current.org_id, request.state.user, "email.sent",
                               f"Sent {audit.quoted(email_item['subject'])} to {email_item['recipient_email']}",
                               target_type="email", target_id=email_id)
            return {"status": "sent"}

    await update("email_queue", email_id, {
        "status": "failed",
        "error": result["error"],
    })
    await events.publish(current.org_id, "email", email_id, "failed")
    await audit.record(current.org_id, request.state.user, "email.send_failed",
                       f"Couldn't send {audit.quoted(email_item['subject'])} to {email_item['recipient_email']}",
                       target_type="email", target_id=email_id, details={"error": result["error"]})
    # The email server refused or couldn't be reached: a bad gateway, not a LaunchOps fault
    raise HTTPException(502, f"Send failed: {result['error']}")


def _looks_like_email(value: str) -> bool:
    """Loose address check: exactly one "@", text on both sides, a dot in the domain."""
    local, _, domain = value.partition("@")
    return value.count("@") == 1 and bool(local) and "." in domain


@email_router.patch("/{email_id}")
async def update_email_draft(email_id: str, data: EmailDraftUpdate, request: Request) -> dict:
    """Edit an unsent draft: recipient, subject, body (Editor)."""
    current = await access.membership(request)
    email_item = await access.load(current, "email_queue", email_id, "Email not found")
    access.ensure(current, "editor")
    if email_item["status"] == "sent":
        raise HTTPException(409, "Email already sent")

    # Only fields the client sent; null means "leave unchanged"
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "recipient_email" in updates:
        updates["recipient_email"] = updates["recipient_email"].strip()
        if not _looks_like_email(updates["recipient_email"]):
            raise HTTPException(422, "recipient_email must be a valid email address")
    if not updates:
        return email_item
    if email_item["status"] == "failed":
        # An edited draft is ready to try again
        updates["status"] = "pending"
        updates["error"] = ""
    return await update("email_queue", email_id, updates)


@email_router.delete("/{email_id}")
async def delete_email(email_id: str, request: Request) -> dict:
    """Delete a draft or a sent email from the Outbox (Approver)."""
    current = await access.membership(request)
    email_item = await access.load(current, "email_queue", email_id, "Email not found")
    access.ensure(current, "approver")
    await delete("email_queue", email_id)
    await events.publish(current.org_id, "email", email_id, "deleted")
    await audit.record(current.org_id, request.state.user, "email.deleted",
                       f"Deleted the email {audit.quoted(email_item['subject'])} to {email_item['recipient_email']}",
                       target_type="email", target_id=email_id)
    return {"deleted": True}
