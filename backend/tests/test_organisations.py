"""Organisations, memberships and roles (docs/PHASE1_DESIGN.md D1–D6).

Olivia owns "Olivia's organisation". Amy (approver), Ed (editor) and Vic (viewer) are members of it,
and each also owns an organisation of their own from registering. Oscar belongs to none of Olivia's.
"""

import uuid
from types import SimpleNamespace

import pytest

import database
from services import jobs
from services.access import ROLE_NAMES, ROLES

MEMBERS = [("approver", "amy@example.com", "Amy"), ("editor", "ed@example.com", "Ed"), ("viewer", "vic@example.com", "Vic")]


@pytest.fixture
async def team(client, register, auth, smtp_config):
    owner_token, owner = await register("olivia@example.com", name="Olivia")
    org_id = (await client.get("/api/auth/me", headers=auth(owner_token))).json()["organisations"][0]["id"]
    users = {"owner": owner}
    tokens = {"owner": owner_token}
    for role, email, name in MEMBERS:
        tokens[role], users[role] = await register(email, name=name)
        await database.insert("memberships", {"org_id": org_id, "user_id": users[role]["id"], "role": role})
    headers = {role: {**auth(token), "X-Org-Id": org_id} for role, token in tokens.items()}

    async def resources():
        """A fresh project in Olivia's organisation, with one of everything attached to it."""
        async def post(path, body):
            resp = await client.post(path, headers=headers["owner"], json=body)
            assert resp.status_code == 201, resp.text
            return resp.json()

        product = await post("/api/products", {"name": "Olivia Venture"})
        await client.patch(f"/api/products/{product['id']}", headers=headers["owner"], json={"email_settings": smtp_config})
        running = await database.insert("queue", {
            "product_id": product["id"], "org_id": org_id, "user_id": owner["id"], "workflow_id": "blog", "status": "running",
        })
        pool = await database.get_pool()
        async with pool.acquire() as conn:
            await jobs.enqueue(conn, kind="workflow", org_id=org_id, user_id=owner["id"], queue_id=str(running["id"]),
                               payload={"product_id": product["id"], "workflow_id": "blog", "instructions": ""})
        return SimpleNamespace(
            product=product,
            running=running,
            item=await database.insert("queue", {
                "product_id": product["id"], "org_id": org_id, "user_id": owner["id"], "workflow_id": "partnerships",
                "status": "pending", "content": {"partnerships": [{"name": "Acme", "email": "partners@acme.example"}]},
            }),
            email=await database.insert("email_queue", {
                "product_id": product["id"], "org_id": org_id, "user_id": owner["id"], "recipient_name": "Jane",
                "recipient_email": "jane@example.com", "subject": "Hello", "body": "Hi Jane", "status": "pending",
            }),
            event=await post("/api/calendar", {"date": "2026-10-01", "product_id": product["id"], "platform": "linkedin", "title": "Post"}),
            template=await post("/api/templates", {"name": "Pitch", "type": "email", "tags": ["outreach"], "content": "Hi"}),
            capture=await post("/api/captures", {"text": "Podcast idea", "product_id": product["id"]}),
            brand=await post("/api/brands", {"name": "Olivia Brand"}),
        )

    return SimpleNamespace(org_id=org_id, users=users, tokens=tokens, headers=headers, resources=resources, auth=auth)


# What each role may do in its organisation: (minimum role, request for fresh resources r, success status)
ACTIONS = {
    "read a project": ("viewer", lambda r: ("GET", f"/api/products/{r.product['id']}", None), 200),
    "create a project": ("editor", lambda r: ("POST", "/api/products", {"name": "Second venture"}), 201),
    "edit a project": ("editor", lambda r: ("PATCH", f"/api/products/{r.product['id']}", {"tagline": "New"}), 200),
    "tick the launch plan": ("editor", lambda r: ("PATCH", f"/api/products/{r.product['id']}/checklist", {"pre_0": True}), 200),
    "delete a project": ("owner", lambda r: ("DELETE", f"/api/products/{r.product['id']}", None), 200),
    "read a result": ("viewer", lambda r: ("GET", f"/api/queue/{r.item['id']}", None), 200),
    "approve a result": ("approver", lambda r: ("PATCH", f"/api/queue/{r.item['id']}", {"status": "approved"}), 200),
    "delete a result": ("approver", lambda r: ("DELETE", f"/api/queue/{r.item['id']}", None), 200),
    "read the Outbox": ("viewer", lambda r: ("GET", "/api/email-queue", None), 200),
    "edit a draft": ("editor", lambda r: ("PATCH", f"/api/email-queue/{r.email['id']}", {"subject": "Edited"}), 200),
    "send an email": ("approver", lambda r: ("POST", f"/api/email-queue/{r.email['id']}/send", None), 200),
    "delete a draft": ("approver", lambda r: ("DELETE", f"/api/email-queue/{r.email['id']}", None), 200),
    "run an operation": ("editor", lambda r: ("POST", "/api/workflows/launch", {"product_id": r.product["id"], "workflow_id": "blog"}), 200),
    "cancel an operation": ("editor", lambda r: ("POST", f"/api/queue/{r.running['id']}/cancel", None), 200),
    "generate a report": ("editor", lambda r: ("POST", "/api/pricing/analyze", {"product_id": r.product["id"]}), 200),
    "read the calendar": ("viewer", lambda r: ("GET", "/api/calendar", None), 200),
    "add a calendar entry": ("editor", lambda r: ("POST", "/api/calendar", {
        "date": "2026-10-02", "product_id": r.product["id"], "platform": "x", "title": "Teaser",
    }), 201),
    "reschedule a calendar entry": ("editor", lambda r: ("PATCH", f"/api/calendar/{r.event['id']}", {"date": "2026-10-05"}), 200),
    "delete a calendar entry": ("editor", lambda r: ("DELETE", f"/api/calendar/{r.event['id']}", None), 200),
    "read the library": ("viewer", lambda r: ("GET", "/api/templates", None), 200),
    "save a template": ("editor", lambda r: ("POST", "/api/templates", {"name": "New", "type": "email", "tags": [], "content": "Body"}), 201),
    "delete a template": ("editor", lambda r: ("DELETE", f"/api/templates/{r.template['id']}", None), 200),
    "capture an idea": ("editor", lambda r: ("POST", "/api/captures", {"text": "Idea", "product_id": r.product["id"]}), 201),
    "delete an idea": ("editor", lambda r: ("DELETE", f"/api/captures/{r.capture['id']}", None), 200),
    "read company profiles": ("viewer", lambda r: ("GET", "/api/brands", None), 200),
    "add a company profile": ("editor", lambda r: ("POST", "/api/brands", {"name": "Acme"}), 201),
    "edit a company profile": ("editor", lambda r: ("PATCH", f"/api/brands/{r.brand['id']}", {"tagline": "Sharper"}), 200),
    "delete a company profile": ("editor", lambda r: ("DELETE", f"/api/brands/{r.brand['id']}", None), 200),
    "read settings": ("viewer", lambda r: ("GET", "/api/settings", None), 200),
    "change the brand voice": ("editor", lambda r: ("PUT", "/api/settings", {"platforms": {}, "brand": {"tone": "warm"}, "prefs": {}}), 200),
    "list the members": ("viewer", lambda r: ("GET", "/api/organisation/members", None), 200),
    "list the invitations": ("owner", lambda r: ("GET", "/api/organisation/invitations", None), 200),
    "read the activity log": ("owner", lambda r: ("GET", "/api/organisation/activity", None), 200),
    "see AI usage and cost": ("owner", lambda r: ("GET", "/api/organisation/usage", None), 200),
    "set the AI budget": ("owner", lambda r: ("PUT", "/api/organisation/budget", {"monthly_ai_budget_usd": 50}), 200),
    "rename the organisation": ("owner", lambda r: ("PATCH", "/api/organisation", {"name": "Olivia's ventures"}), 200),
}


@pytest.mark.parametrize("action", sorted(ACTIONS))
async def test_roles_decide_what_members_can_do(client, team, fake_ai, fake_smtp, action):
    minimum, request_for, success = ACTIONS[action]
    r = await team.resources()
    for role in ROLES:
        method, path, body = request_for(r)
        resp = await client.request(method, path, headers=team.headers[role], json=body)
        if ROLES.index(role) < ROLES.index(minimum):
            assert resp.status_code == 403, (role, resp.text)
            assert resp.json() == {"detail": (
                f"You need the {ROLE_NAMES[minimum]} role in Olivia's organisation to do this. Ask an owner of the organisation."
            )}
        else:
            assert resp.status_code == success, (role, resp.text)
            r = await team.resources()  # the action may have used up what it acted on


# Actions on the caller's own organisation as a whole: nothing in them names another organisation's things.
# (A calendar entry naming another organisation's project is covered separately below.)
ORGANISATION_WIDE = {
    "create a project", "read the Outbox", "read the calendar", "add a calendar entry", "read the library",
    "save a template", "read company profiles", "add a company profile", "read settings", "change the brand voice",
    "list the members", "list the invitations", "read the activity log", "see AI usage and cost", "set the AI budget",
    "rename the organisation",
}


@pytest.mark.parametrize("action", sorted(set(ACTIONS) - ORGANISATION_WIDE))
async def test_another_organisations_things_are_not_found(client, team, register, auth, fake_ai, fake_smtp, action):
    _, request_for, _ = ACTIONS[action]
    method, path, body = request_for(await team.resources())
    oscar_token, _ = await register("oscar@example.com", name="Oscar")

    resp = await client.request(method, path, headers=auth(oscar_token), json=body)

    assert resp.status_code == 404, resp.text
    assert fake_ai.calls == [] and fake_smtp.calls == []


async def test_a_calendar_entry_for_another_organisations_project_does_not_reveal_it(client, team, register, auth):
    r = await team.resources()
    oscar_token, _ = await register("oscar@example.com", name="Oscar")

    resp = await client.post("/api/calendar", headers=auth(oscar_token), json={
        "date": "2026-10-02", "product_id": r.product["id"], "platform": "x", "title": "Sneaky",
    })

    assert resp.status_code == 201, resp.text
    assert (resp.json()["product_name"], resp.json()["color"]) == ("", "#00f0ff")


@pytest.mark.parametrize("org_header", ["olivia", "not-a-uuid", str(uuid.uuid4())])
async def test_an_organisation_the_user_isnt_in_is_not_found(client, team, register, auth, org_header):
    oscar_token, _ = await register("oscar@example.com", name="Oscar")
    header = team.org_id if org_header == "olivia" else org_header

    resp = await client.get("/api/products", headers={**auth(oscar_token), "X-Org-Id": header})

    assert (resp.status_code, resp.json()) == (404, {"detail": "Organisation not found"})


async def test_without_an_organisation_header_requests_use_the_users_own_organisation(client, team):
    await team.resources()
    ed_without_header = team.auth(team.tokens["editor"])

    assert (await client.get("/api/products", headers=ed_without_header)).json() == []
    assert [p["name"] for p in (await client.get("/api/products", headers=team.headers["editor"])).json()] == ["Olivia Venture"]


async def test_me_lists_organisations_and_roles_owned_ones_first(client, team):
    me = (await client.get("/api/auth/me", headers=team.headers["editor"])).json()

    [own, olivias] = me["organisations"]
    assert (own["name"], own["role"]) == ("Ed's organisation", "owner")
    assert olivias == {"id": team.org_id, "name": "Olivia's organisation", "role": "editor"}


async def test_registering_creates_an_organisation_the_new_user_owns(client):
    named = (await client.post("/api/auth/register", json={
        "email": "nina@example.com", "password": "password123", "name": "Nina",
    })).json()
    unnamed = (await client.post("/api/auth/register", json={
        "email": "quinn@example.com", "password": "password123", "name": "",
    })).json()

    assert [(o["name"], o["role"]) for o in named["user"]["organisations"]] == [("Nina's organisation", "owner")]
    assert [(o["name"], o["role"]) for o in unnamed["user"]["organisations"]] == [("quinn's organisation", "owner")]
    login = (await client.post("/api/auth/login", json={"email": "nina@example.com", "password": "password123"})).json()
    assert login["user"]["organisations"] == named["user"]["organisations"]


async def test_members_share_the_organisations_settings_in_operations(client, team, fake_ai, run_jobs):
    r = await team.resources()
    await client.put("/api/settings", headers=team.headers["owner"], json={
        "platforms": {}, "brand": {"name": "Olivia Ventures", "tone": "precise"}, "prefs": {},
    })

    launched = await client.post("/api/workflows/launch", headers=team.headers["editor"], json={
        "product_id": r.product["id"], "workflow_id": "blog",
    })

    assert launched.status_code == 200, launched.text
    await run_jobs()
    assert "Brand: Olivia Ventures" in fake_ai.calls[0].system
    item = (await client.get(f"/api/queue/{launched.json()['task_id']}", headers=team.headers["viewer"])).json()
    assert (item["org_id"], item["status"]) == (team.org_id, "pending")
    assert (await client.get("/api/settings", headers=team.headers["viewer"])).json()["brand"]["name"] == "Olivia Ventures"


async def test_approved_drafts_belong_to_the_organisation_and_sends_record_the_sender(client, team, fake_smtp):
    r = await team.resources()

    await client.patch(f"/api/queue/{r.item['id']}", headers=team.headers["approver"], json={"status": "approved"})
    drafts = (await client.get("/api/email-queue", headers=team.headers["viewer"])).json()
    new_draft = next(d for d in drafts if d["source_queue_id"] == r.item["id"])
    sent = await client.post(f"/api/email-queue/{new_draft['id']}/send", headers=team.headers["approver"])

    assert sent.status_code == 200, sent.text
    stored = await database.select_one("email_queue", new_draft["id"])
    assert (stored["org_id"], stored["status"], stored["sent_by"]) == (team.org_id, "sent", team.users["approver"]["id"])


async def test_deleting_an_account_keeps_what_it_created_in_a_shared_organisation(client, team):
    ed = team.users["editor"]
    created = (await client.post("/api/products", headers=team.headers["editor"], json={"name": "Ed's venture"})).json()
    ed_org = next(o for o in (await client.get("/api/auth/me", headers=team.auth(team.tokens["editor"]))).json()["organisations"]
                  if o["role"] == "owner")

    # Olivia registered first, so she is also the platform admin
    deleted = await client.delete(f"/api/auth/admin/users/{ed['id']}", headers=team.headers["owner"])

    assert deleted.status_code == 200, deleted.text
    kept = await client.get(f"/api/products/{created['id']}", headers=team.headers["owner"])
    assert (kept.status_code, kept.json()["user_id"]) == (200, None)
    assert await database.select_one("organisations", ed_org["id"]) is None, "his own organisation went with him"


async def test_transferring_a_project_moves_it_into_the_target_users_organisation(client, team, register, auth):
    r = await team.resources()
    oscar_token, oscar = await register("oscar@example.com", name="Oscar")

    resp = await client.post("/api/auth/admin/transfer-project", headers=team.headers["owner"], json={
        "product_id": r.product["id"], "target_user_id": oscar["id"],
    })

    assert resp.status_code == 200, resp.text
    assert [p["name"] for p in (await client.get("/api/products", headers=auth(oscar_token))).json()] == ["Olivia Venture"]
    assert (await client.get(f"/api/products/{r.product['id']}", headers=team.headers["owner"])).status_code == 404
    moved = (await client.get(f"/api/queue/{r.item['id']}", headers=auth(oscar_token))).json()
    assert moved["user_id"] == oscar["id"]
