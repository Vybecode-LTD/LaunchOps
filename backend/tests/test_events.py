"""Live updates (docs/PHASE1_DESIGN.md D10): an organisation's changes, streamed to its members."""

import asyncio
from types import SimpleNamespace

import pytest

import routers.events
from services import events


async def _next(queue: asyncio.Queue, timeout: float = 5) -> dict:
    return await asyncio.wait_for(queue.get(), timeout=timeout)


async def _drain_events(queue: asyncio.Queue, settle: float = 0.3) -> list[dict]:
    """Every event that arrives within `settle` seconds of the last one."""
    received = []
    while True:
        try:
            received.append(await asyncio.wait_for(queue.get(), timeout=settle))
        except TimeoutError:
            return received


@pytest.fixture
async def subscription(client):
    """await subscription(org_id) → a queue of that organisation's events; unsubscribed after the test."""
    held = []

    async def subscribe(org_id: str) -> asyncio.Queue:
        queue = await events.hub.subscribe(org_id)
        held.append((org_id, queue))
        return queue

    yield subscribe
    for org_id, queue in held:
        await events.hub.unsubscribe(org_id, queue)


async def _org_of(client, auth, token) -> str:
    return (await client.get("/api/auth/me", headers=auth(token))).json()["organisations"][0]["id"]


async def test_members_receive_only_their_organisations_events(client, register, auth, subscription):
    alpha = await _org_of(client, auth, (await register("alpha@example.com"))[0])
    beta = await _org_of(client, auth, (await register("beta@example.com"))[0])
    queue = await subscription(alpha)

    await events.publish(beta, "queue", "item-b", "pending")
    await events.publish(alpha, "queue", "item-a", "pending")

    assert await _next(queue) == {"org_id": alpha, "type": "queue", "id": "item-a", "status": "pending"}
    assert await _drain_events(queue) == []


async def test_the_listening_connection_closes_with_the_last_subscriber(client, register, auth):
    org = await _org_of(client, auth, (await register())[0])
    first = await events.hub.subscribe(org)
    second = await events.hub.subscribe(org)

    await events.hub.unsubscribe(org, first)
    assert events.hub.listening
    await events.hub.unsubscribe(org, second)
    assert not events.hub.listening


async def test_operations_publish_their_progress(client, register, auth, create_product, fake_ai, run_jobs, subscription, smtp_config, fake_smtp):
    token, _ = await register("ana@example.com")
    org = await _org_of(client, auth, token)
    product = await create_product(token)
    await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"email_settings": smtp_config})
    queue = await subscription(org)
    fake_ai.response = {"partnerships": [{"name": "Acme", "email": "partners@acme.example"}]}

    launched = (await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "partnerships",
    })).json()
    item_id = launched["task_id"]
    await run_jobs()
    await client.patch(f"/api/queue/{item_id}", headers=auth(token), json={"status": "approved"})
    [draft] = (await client.get("/api/email-queue", headers=auth(token))).json()
    await client.post(f"/api/email-queue/{draft['id']}/send", headers=auth(token))

    received = [(e["type"], e["id"], e["status"]) for e in await _drain_events(queue)]
    assert received == [
        ("queue", item_id, "running"),
        ("queue", item_id, "pending"),
        ("queue", item_id, "approved"),
        ("email", item_id, "drafts"),
        ("email", draft["id"], "sent"),
    ]


async def test_failures_retries_and_deletions_are_published_too(client, register, auth, create_product, fake_ai, run_jobs, subscription):
    token, _ = await register()
    org = await _org_of(client, auth, token)
    product = await create_product(token)
    queue = await subscription(org)
    fake_ai.response = RuntimeError("model overloaded")

    item_id = (await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "blog",
    })).json()["task_id"]
    await run_jobs()
    await client.delete(f"/api/queue/{item_id}", headers=auth(token))

    assert [(e["type"], e["status"]) for e in await _drain_events(queue)] == [
        ("queue", "running"), ("queue", "failed"), ("queue", "deleted"),
    ]


def _request(disconnect_after: int):
    """A stand-in for the streaming request: it reports a disconnect after that many checks."""
    checks = SimpleNamespace(count=0)

    async def is_disconnected() -> bool:
        checks.count += 1
        return checks.count > disconnect_after

    return SimpleNamespace(is_disconnected=is_disconnected)


async def test_the_stream_sends_events_and_keeps_the_connection_alive(client, register, auth, monkeypatch):
    monkeypatch.setattr(routers.events, "KEEPALIVE_SECONDS", 0.5)
    org = await _org_of(client, auth, (await register())[0])
    stream = routers.events.event_stream(_request(disconnect_after=3), org)

    chunks = [await anext(stream)]  # subscribes, then tells the browser how soon to reconnect
    await events.publish(org, "email", "email-1", "sent")
    chunks.append(await anext(stream))
    chunks.append(await anext(stream))  # nothing new within the keep-alive interval
    remaining = [chunk async for chunk in stream]

    assert chunks[0] == "retry: 5000\n\n"
    assert chunks[1] == 'event: email\ndata: {"id": "email-1", "status": "sent"}\n\n'
    assert chunks[2] == ": keep-alive\n\n"
    assert remaining in ([], [": keep-alive\n\n"])
    assert not events.hub.listening, "the stream unsubscribed when the browser left"


async def test_the_stream_needs_a_signed_in_member(client, register, auth):
    unauthenticated = await client.get("/api/events")
    token, _ = await register()
    stranger = await client.get("/api/events", headers={**auth(token), "X-Org-Id": "00000000-0000-4000-8000-000000000000"})

    assert unauthenticated.status_code == 401
    assert (stranger.status_code, stranger.json()) == (404, {"detail": "Organisation not found"})


async def test_the_events_endpoint_streams_server_sent_events(client, register, auth, monkeypatch):
    token, _ = await register()
    request = SimpleNamespace(state=SimpleNamespace(user=(await client.get("/api/auth/me", headers=auth(token))).json()), headers={})
    request.is_disconnected = _request(disconnect_after=0).is_disconnected

    response = await routers.events.stream_events(request)

    assert response.media_type == "text/event-stream"
    assert response.headers["cache-control"] == "no-cache"
    body = [chunk async for chunk in response.body_iterator]
    assert body == ["retry: 5000\n\n"]
