"""Tenant isolation: a user can never read or change another organisation's data.

Each user here owns only their own organisation (see test_organisations.py for shared ones).
"""

from datetime import date
from types import SimpleNamespace

import pytest


@pytest.fixture
async def world(client, register, auth, create_product, make_queue_item, make_email, make_event):
    """Alice owns one of everything; Bob is an unrelated second user."""
    alice_token, alice = await register("alice@example.com")
    bob_token, _ = await register("bob@example.com")
    alice_headers = auth(alice_token)
    product = await create_product(alice_token, name="Alice Product")

    async def post(path, body):
        resp = await client.post(path, headers=alice_headers, json=body)
        assert resp.status_code == 201, resp.text
        return resp.json()

    return SimpleNamespace(
        alice=alice_headers,
        bob=auth(bob_token),
        product=product,
        template=await post("/api/templates", {"name": "Alice template", "type": "email",
                                                "tags": ["outreach"], "content": "Hi"}),
        capture=await post("/api/captures", {"text": "Alice idea", "product_id": product["id"]}),
        brand=await post("/api/brands", {"name": "Alice Brand"}),
        item=await make_queue_item(alice, product, "blog"),
        email=await make_email(alice, product),
        event=await make_event(alice, product, date(2026, 10, 1)),
    )


async def test_products_are_isolated(client, world):
    path = f"/api/products/{world.product['id']}"
    assert (await client.get("/api/products", headers=world.bob)).json() == []
    assert (await client.get(path, headers=world.bob)).status_code == 404
    assert (await client.patch(path, headers=world.bob, json={"name": "Hijacked"})).status_code == 404
    assert (await client.patch(f"{path}/checklist", headers=world.bob, json={"pre_0": True})).status_code == 404
    assert (await client.delete(path, headers=world.bob)).status_code == 404
    unchanged = (await client.get(path, headers=world.alice)).json()
    assert (unchanged["name"], unchanged["checklist"]) == ("Alice Product", {})


async def test_queue_items_are_isolated(client, world):
    path = f"/api/queue/{world.item['id']}"
    assert (await client.get("/api/queue", headers=world.bob)).json() == []
    assert (await client.get(f"/api/queue?product_id={world.product['id']}", headers=world.bob)).json() == []
    assert (await client.get(f"/api/queue/summary?product_id={world.product['id']}", headers=world.bob)).status_code == 404
    assert (await client.get(path, headers=world.bob)).status_code == 404
    assert (await client.patch(path, headers=world.bob, json={"status": "approved"})).status_code == 404
    assert (await client.delete(path, headers=world.bob)).status_code == 404
    assert (await client.get(path, headers=world.alice)).json()["status"] == "pending"


async def test_templates_are_isolated(client, world):
    assert (await client.get("/api/templates", headers=world.bob)).json() == []
    assert (await client.get("/api/templates/for-workflow/cold_outreach", headers=world.bob)).json() == []
    assert (await client.delete(f"/api/templates/{world.template['id']}", headers=world.bob)).status_code == 404
    assert len((await client.get("/api/templates", headers=world.alice)).json()) == 1


async def test_captures_are_isolated(client, world):
    assert (await client.get("/api/captures", headers=world.bob)).json() == []
    assert (await client.delete(f"/api/captures/{world.capture['id']}", headers=world.bob)).status_code == 404
    assert len((await client.get("/api/captures", headers=world.alice)).json()) == 1


async def test_calendar_events_are_isolated(client, world):
    assert (await client.get("/api/calendar", headers=world.bob)).json() == []
    assert (await client.delete(f"/api/calendar/{world.event['id']}", headers=world.bob)).status_code == 404
    assert len((await client.get("/api/calendar", headers=world.alice)).json()) == 1


async def test_calendar_event_for_foreign_product_does_not_leak_it(client, world):
    resp = await client.post("/api/calendar", headers=world.bob, json={
        "date": "2026-10-02", "product_id": world.product["id"], "platform": "twitter", "title": "Sneaky",
    })
    assert resp.status_code == 201, resp.text
    assert (resp.json()["product_name"], resp.json()["color"]) == ("", "#00f0ff")
    assert [e["title"] for e in (await client.get("/api/calendar", headers=world.alice)).json()] == ["Post"]


async def test_brands_are_isolated(client, world):
    path = f"/api/brands/{world.brand['id']}"
    assert (await client.get("/api/brands", headers=world.bob)).json() == []
    assert (await client.patch(path, headers=world.bob, json={"name": "Hijacked"})).status_code == 404
    assert (await client.delete(path, headers=world.bob)).status_code == 404
    assert [b["name"] for b in (await client.get("/api/brands", headers=world.alice)).json()] == ["Alice Brand"]


async def test_email_queue_is_isolated(client, world, fake_smtp):
    path = f"/api/email-queue/{world.email['id']}"
    assert (await client.get("/api/email-queue", headers=world.bob)).json() == []
    assert (await client.post(f"{path}/send", headers=world.bob)).status_code == 404
    assert (await client.delete(path, headers=world.bob)).status_code == 404
    assert [e["status"] for e in (await client.get("/api/email-queue", headers=world.alice)).json()] == ["pending"]
    assert fake_smtp.calls == []


async def test_ai_endpoints_do_not_find_other_organisations_products(client, world, fake_ai):
    product_id = world.product["id"]
    requests = [
        ("/api/workflows/launch", {"product_id": product_id, "workflow_id": "blog"}),
        ("/api/presskit/generate", {"product_id": product_id, "url": "https://example.com"}),
        ("/api/press-release/generate", {"product_id": product_id, "url": "https://example.com"}),
        ("/api/seo/analyze", {"product_id": product_id, "url": "https://example.com"}),
        ("/api/repurpose", {"product_id": product_id, "content": "Post"}),
        ("/api/pricing/analyze", {"product_id": product_id}),
        ("/api/market-analysis", {"product_id": product_id}),
    ]
    for path, body in requests:
        resp = await client.post(path, headers=world.bob, json=body)
        assert (resp.status_code, resp.json()) == (404, {"detail": "Product not found"}), path
    assert fake_ai.calls == []
    assert fake_ai.scraped_urls == []
