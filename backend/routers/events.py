"""GET /api/events: Server-Sent Events for the request's organisation (docs/PHASE1_DESIGN.md D10).

The browser reads the stream with fetch, so the bearer token and X-Org-Id travel as headers. Each event
names what changed ("queue" or "email"), its id and its new status; a comment line keeps idle
connections open through proxies.
"""

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from services import access
from services.events import hub

router = APIRouter(prefix="/api", tags=["events"])

KEEPALIVE_SECONDS = 15.0
RECONNECT_MILLISECONDS = 5000


async def event_stream(request: Request, org_id: str):
    queue = await hub.subscribe(org_id)
    try:
        yield f"retry: {RECONNECT_MILLISECONDS}\n\n"
        while not await request.is_disconnected():
            try:
                event = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
            except TimeoutError:
                yield ": keep-alive\n\n"
                continue
            data = json.dumps({"id": event["id"], "status": event["status"]})
            yield f"event: {event['type']}\ndata: {data}\n\n"
    finally:
        await hub.unsubscribe(org_id, queue)


@router.get("/events")
async def stream_events(request: Request) -> StreamingResponse:
    """Live changes to the organisation's results and Outbox, until the browser disconnects."""
    current = await access.membership(request)
    return StreamingResponse(
        event_stream(request, current.org_id),
        media_type="text/event-stream",
        # Proxies mustn't buffer or cache the stream
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
