"""Templates, captures, calendar, settings and brands routes."""

import uuid
from datetime import date

import database

SETTINGS = {
    "platforms": {},
    "brand": {
        "name": "Acme", "tagline": "Sound, shipped", "tone": "bold",
        "keywords": ["audio"], "avoid": ["cheap"], "elevator": "Acme builds audio tools.",
    },
    "prefs": {"depth": "quick", "length": "short", "emoji": False, "hashtags": "none", "sources": False},
}


async def _user_without_settings_row(client, register, auth) -> str:
    """A user whose organisation has no settings row yet: migration 0003 creates such organisations for
    accounts that never saved settings (new accounts get a row straight away)."""
    token, _ = await register()
    org_id = (await client.get("/api/auth/me", headers=auth(token))).json()["organisations"][0]["id"]
    pool = await database.get_pool()
    await pool.execute("DELETE FROM settings WHERE org_id = $1", uuid.UUID(org_id))
    return token


# ─── Baseline: templates ───


async def test_template_crud_and_tag_matching(client, register, auth):
    token, _ = await register()
    headers = auth(token)
    resp = await client.post("/api/templates", headers=headers, json={
        "name": "Cold email", "type": "email", "tags": ["outreach", "email"],
        "content": "Hi {name}", "source_product": "Launch Ops",
    })
    assert resp.status_code == 201, resp.text
    cold_email = resp.json()
    assert cold_email["tags"] == ["outreach", "email"]
    await client.post("/api/templates", headers=headers, json={
        "name": "Teaser", "type": "social", "tags": ["social"], "content": "Soon.",
    })

    async def names(path):
        listed = await client.get(path, headers=headers)
        assert listed.status_code == 200, listed.text
        return sorted(t["name"] for t in listed.json())

    assert await names("/api/templates") == ["Cold email", "Teaser"]
    assert await names("/api/templates?tags=social") == ["Teaser"]
    assert await names("/api/templates?tags=outreach,social") == ["Cold email", "Teaser"]
    assert await names("/api/templates/for-workflow/cold_outreach") == ["Cold email"]
    assert await names("/api/templates/for-workflow/social_posts") == ["Teaser"]
    assert await names("/api/templates/for-workflow/unknown") == []

    deleted = await client.delete(f"/api/templates/{cold_email['id']}", headers=headers)
    assert deleted.json() == {"deleted": True}
    assert await names("/api/templates") == ["Teaser"]
    assert (await client.delete(f"/api/templates/{cold_email['id']}", headers=headers)).status_code == 404


async def test_template_source_product_can_be_a_product_id(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token)
    resp = await client.post("/api/templates", headers=auth(token), json={
        "name": "From product", "type": "email", "tags": [], "content": "Body", "source_product": product["id"],
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["source_product"] == product["id"]


# ─── Baseline: captures ───


async def test_capture_crud(client, register, auth, create_product):
    token, _ = await register()
    headers = auth(token)
    product = await create_product(token)
    other = await create_product(token, name="Other")

    resp = await client.post("/api/captures", headers=headers, json={"text": "Podcast idea", "product_id": product["id"]})
    assert resp.status_code == 201, resp.text
    capture = resp.json()
    assert (capture["text"], capture["product_id"]) == ("Podcast idea", product["id"])

    assert [c["id"] for c in (await client.get("/api/captures", headers=headers)).json()] == [capture["id"]]
    assert (await client.get(f"/api/captures?product_id={other['id']}", headers=headers)).json() == []
    assert (await client.delete(f"/api/captures/{capture['id']}", headers=headers)).json() == {"deleted": True}
    assert (await client.get("/api/captures", headers=headers)).json() == []
    assert (await client.delete(f"/api/captures/{capture['id']}", headers=headers)).status_code == 404


# ─── Baseline: calendar ───


async def test_create_calendar_event(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token, name="Launch Ops", color="#a855f7")
    resp = await client.post("/api/calendar", headers=auth(token), json={
        "date": "2026-10-01", "product_id": product["id"], "platform": "twitter", "title": "Teaser thread",
    })
    assert resp.status_code == 201, resp.text
    event = resp.json()
    assert event["date"] == "2026-10-01"
    assert event["product_name"] == "Launch Ops"
    assert event["color"] == "#a855f7"
    assert event["title"] == "Teaser thread"
    listed = (await client.get("/api/calendar", headers=auth(token))).json()
    assert [e["id"] for e in listed] == [event["id"]]


async def test_list_filter_and_delete_calendar_events(client, register, auth, create_product, make_event):
    token, user = await register()
    headers = auth(token)
    one = await create_product(token, name="One")
    two = await create_product(token, name="Two")
    await make_event(user, one, date(2026, 10, 20), title="Late")
    early = await make_event(user, one, date(2026, 10, 1), title="Early")
    await make_event(user, two, date(2026, 10, 10), title="Other")

    async def titles(query=""):
        resp = await client.get(f"/api/calendar{query}", headers=headers)
        assert resp.status_code == 200, resp.text
        return [e["title"] for e in resp.json()]

    assert await titles() == ["Early", "Other", "Late"]
    assert await titles(f"?product_id={one['id']}") == ["Early", "Late"]
    assert await titles("?date_from=2026-10-05&date_to=2026-10-15") == ["Other"]

    assert (await client.delete(f"/api/calendar/{early['id']}", headers=headers)).json() == {"deleted": True}
    assert await titles() == ["Other", "Late"]
    assert (await client.delete(f"/api/calendar/{early['id']}", headers=headers)).status_code == 404


# ─── Calendar: reschedule and edit (PATCH) ───


async def test_reschedule_calendar_event(client, register, auth, create_product, make_event):
    token, user = await register()
    headers = auth(token)
    product = await create_product(token, name="One")
    event = await make_event(user, product, date(2026, 10, 1), title="Teaser")

    resp = await client.patch(f"/api/calendar/{event['id']}", headers=headers, json={"date": "2026-10-08"})
    assert resp.status_code == 200, resp.text
    moved = resp.json()
    assert (moved["id"], moved["date"], moved["title"]) == (event["id"], "2026-10-08", "Teaser")
    listed = (await client.get("/api/calendar", headers=headers)).json()
    assert [(e["id"], e["date"]) for e in listed] == [(event["id"], "2026-10-08")]

    # An empty patch changes nothing
    resp = await client.patch(f"/api/calendar/{event['id']}", headers=headers, json={})
    assert resp.status_code == 200, resp.text
    assert resp.json()["date"] == "2026-10-08"


async def test_edit_calendar_event_fields_and_project(client, register, auth, create_product, make_event):
    token, user = await register()
    headers = auth(token)
    one = await create_product(token, name="One", color="#111111")
    two = await create_product(token, name="Two", color="#222222")
    event = await make_event(user, one, date(2026, 10, 1), title="Teaser", platform="twitter")

    resp = await client.patch(f"/api/calendar/{event['id']}", headers=headers, json={
        "title": "Launch thread", "platform": "linkedin", "product_id": two["id"],
    })
    assert resp.status_code == 200, resp.text
    edited = resp.json()
    assert (edited["title"], edited["platform"], edited["date"]) == ("Launch thread", "linkedin", "2026-10-01")
    assert (edited["product_id"], edited["product_name"], edited["color"]) == (two["id"], "Two", "#222222")


async def test_calendar_event_update_rejects_blank_title_and_foreign_project(
    client, register, auth, create_product, make_event,
):
    token, user = await register()
    headers = auth(token)
    product = await create_product(token, name="Mine")
    event = await make_event(user, product, date(2026, 10, 1))
    other_token, _ = await register()
    foreign = await create_product(other_token, name="Theirs")

    assert (await client.patch(f"/api/calendar/{event['id']}", headers=headers, json={"title": "  "})).status_code == 422
    resp = await client.patch(f"/api/calendar/{event['id']}", headers=headers, json={"product_id": foreign["id"]})
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"] == "Project not found"
    unchanged = (await client.get("/api/calendar", headers=headers)).json()[0]
    assert (unchanged["title"], unchanged["product_id"]) == ("Post", product["id"])


async def test_calendar_event_update_is_owner_only(client, register, auth, create_product, make_event):
    token, user = await register()
    product = await create_product(token)
    event = await make_event(user, product, date(2026, 10, 1))
    other_token, _ = await register()

    for event_id, headers in [
        (event["id"], auth(other_token)),
        (str(uuid.uuid4()), auth(token)),
        ("not-a-uuid", auth(token)),
    ]:
        resp = await client.patch(f"/api/calendar/{event_id}", headers=headers, json={"date": "2026-10-02"})
        assert resp.status_code == 404, (event_id, resp.text)
    assert (await client.get("/api/calendar", headers=auth(token))).json()[0]["date"] == "2026-10-01"


# ─── Baseline: settings ───


async def test_settings_defaults_for_user_without_row(client, register, auth):
    token = await _user_without_settings_row(client, register, auth)
    resp = await client.get("/api/settings", headers=auth(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["brand"]["name"] == "VybeCod.ing"
    assert body["prefs"]["depth"] == "thorough"
    assert body["platforms"] == {}


async def test_settings_round_trip(client, register, auth):
    token, _ = await register()
    resp = await client.put("/api/settings", headers=auth(token), json=SETTINGS)
    assert resp.status_code == 200, resp.text
    saved = (await client.get("/api/settings", headers=auth(token))).json()
    assert saved["platforms"] == {}
    for key, value in SETTINGS["brand"].items():
        assert saved["brand"][key] == value, key
    assert saved["prefs"] == SETTINGS["prefs"]


async def test_settings_first_save_creates_row(client, register, auth):
    token = await _user_without_settings_row(client, register, auth)
    resp = await client.put("/api/settings", headers=auth(token), json=SETTINGS)
    assert resp.status_code == 200, resp.text
    assert (await client.get("/api/settings", headers=auth(token))).json()["brand"]["name"] == "Acme"


# Exactly what the frontend sends: Record<string, {connected: bool, handle: str, mode: "auto" | "manual"}>
PLATFORMS = {
    "twitter": {"connected": True, "handle": "@acme", "mode": "auto"},
    "linkedin": {"connected": True, "handle": "acme-audio", "mode": "manual"},
    "reddit": {"connected": False, "handle": "", "mode": "manual"},
}


async def test_settings_save_with_platform_connections(client, register, auth, create_product, fake_ai, run_jobs):
    token, _ = await register()
    resp = await client.put("/api/settings", headers=auth(token), json={**SETTINGS, "platforms": PLATFORMS})
    assert resp.status_code == 200, resp.text
    assert resp.json()["platforms"] == PLATFORMS
    assert (await client.get("/api/settings", headers=auth(token))).json()["platforms"] == PLATFORMS

    # Stored as plain JSON the workflows can read: only connected platforms get posts
    product = await create_product(token)
    await client.post("/api/workflows/launch", headers=auth(token), json={
        "product_id": product["id"], "workflow_id": "social_posts",
    })
    await run_jobs()
    enabled = fake_ai.calls[0].user_message.split("enabled platforms: ", 1)[1].split(".", 1)[0]
    assert sorted(enabled.split(", ")) == ["linkedin", "twitter"]


async def test_first_settings_save_with_platform_connections(client, register, auth):
    token = await _user_without_settings_row(client, register, auth)
    resp = await client.put("/api/settings", headers=auth(token), json={**SETTINGS, "platforms": PLATFORMS})
    assert resp.status_code == 200, resp.text
    assert (await client.get("/api/settings", headers=auth(token))).json()["platforms"] == PLATFORMS


# ─── Baseline: brands ───


async def test_brand_crud(client, register, auth):
    token, user = await register()
    headers = auth(token)
    resp = await client.post("/api/brands", headers=headers, json={
        "name": "Acme", "tagline": "Sound, shipped", "tone": "bold", "keywords": ["audio"], "avoid": ["cheap"],
        "company_name": "Acme Ltd", "founder_name": "Jo Park", "logo_url": "https://cdn.example/acme.png",
    })
    assert resp.status_code == 201, resp.text
    brand = resp.json()
    assert (brand["name"], brand["keywords"], brand["company_name"]) == ("Acme", ["audio"], "Acme Ltd")
    assert brand["user_id"] == user["id"]
    assert brand["industry"] == ""
    assert [b["id"] for b in (await client.get("/api/brands", headers=headers)).json()] == [brand["id"]]

    path = f"/api/brands/{brand['id']}"
    resp = await client.patch(path, headers=headers, json={"tagline": "New tagline", "keywords": ["dsp", "audio"]})
    assert resp.status_code == 200, resp.text
    assert (resp.json()["name"], resp.json()["tagline"], resp.json()["keywords"]) == (
        "Acme", "New tagline", ["dsp", "audio"],
    )

    assert (await client.delete(path, headers=headers)).json() == {"deleted": True}
    assert (await client.get("/api/brands", headers=headers)).json() == []
    assert (await client.patch(path, headers=headers, json={"tagline": "x"})).status_code == 404
    assert (await client.delete(path, headers=headers)).status_code == 404


# ─── B5: saving settings only touches the caller's row ───


async def test_saving_settings_only_touches_callers_row(client, register, auth):
    alice_token, _ = await register()
    bob_token, _ = await register()
    for token, brand_name in [(alice_token, "Alpha"), (bob_token, "Beta"), (alice_token, "Alpha v2")]:
        payload = {**SETTINGS, "brand": {**SETTINGS["brand"], "name": brand_name}}
        resp = await client.put("/api/settings", headers=auth(token), json=payload)
        assert resp.status_code == 200, resp.text
    assert (await client.get("/api/settings", headers=auth(bob_token))).json()["brand"]["name"] == "Beta"
    assert (await client.get("/api/settings", headers=auth(alice_token))).json()["brand"]["name"] == "Alpha v2"


# ─── B6: white-label fields persist ───


async def test_white_label_fields_persist(client, register, auth):
    token, _ = await register()
    brand = {**SETTINGS["brand"], "company_name": "Acme Corporation", "logo_url": "https://cdn.example/acme.svg"}
    resp = await client.put("/api/settings", headers=auth(token), json={**SETTINGS, "brand": brand})
    assert resp.status_code == 200, resp.text
    saved = (await client.get("/api/settings", headers=auth(token))).json()["brand"]
    assert (saved["company_name"], saved["logo_url"]) == ("Acme Corporation", "https://cdn.example/acme.svg")


async def test_white_label_fields_default_to_empty(client, register, auth):
    token = await _user_without_settings_row(client, register, auth)
    brand = (await client.get("/api/settings", headers=auth(token))).json()["brand"]
    assert (brand["company_name"], brand["logo_url"]) == ("", "")


# ─── B7: brands accept only known fields ───


async def test_create_brand_ignores_unknown_fields(client, register, auth):
    token, user = await register()
    _, other = await register()
    spoofed_id = str(uuid.uuid4())
    resp = await client.post("/api/brands", headers=auth(token), json={
        "name": "Acme",
        "founders": [{"name": "Jo Park", "title": "CEO"}],
        "id": spoofed_id,
        "user_id": other["id"],
    })
    assert resp.status_code == 201, resp.text
    brand = resp.json()
    assert brand["user_id"] == user["id"]
    assert brand["id"] != spoofed_id
    assert "founders" not in brand


async def test_update_brand_ignores_unknown_fields(client, register, auth):
    token, _ = await register()
    brand = (await client.post("/api/brands", headers=auth(token), json={"name": "Acme"})).json()
    resp = await client.patch(f"/api/brands/{brand['id']}", headers=auth(token), json={
        "tagline": "Sound, shipped", "founders": [{"name": "Jo Park"}],
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["tagline"] == "Sound, shipped"


async def test_update_brand_cannot_move_it_to_another_user(client, register, auth):
    alice_token, alice = await register()
    bob_token, bob = await register()
    brand = (await client.post("/api/brands", headers=auth(alice_token), json={"name": "Acme"})).json()
    resp = await client.patch(f"/api/brands/{brand['id']}", headers=auth(alice_token), json={
        "user_id": bob["id"], "id": str(uuid.uuid4()),
    })
    assert resp.status_code == 200, resp.text
    assert (resp.json()["id"], resp.json()["user_id"]) == (brand["id"], alice["id"])
    assert (await client.get("/api/brands", headers=auth(bob_token))).json() == []


async def test_brand_name_is_required_and_not_blank(client, register, auth):
    token, _ = await register()
    for body in [{}, {"name": ""}, {"name": "   "}, {"name": None}]:
        resp = await client.post("/api/brands", headers=auth(token), json=body)
        assert resp.status_code == 422, (body, resp.text)
    assert (await client.get("/api/brands", headers=auth(token))).json() == []

    brand = (await client.post("/api/brands", headers=auth(token), json={"name": "Acme"})).json()
    for body in [{"name": ""}, {"name": "  "}, {"name": None}]:
        resp = await client.patch(f"/api/brands/{brand['id']}", headers=auth(token), json=body)
        assert resp.status_code == 422, (body, resp.text)
    assert (await client.get("/api/brands", headers=auth(token))).json()[0]["name"] == "Acme"


async def test_brand_patch_null_fields_are_left_unchanged(client, register, auth):
    token, _ = await register()
    brand = (await client.post("/api/brands", headers=auth(token), json={
        "name": "Acme", "tagline": "Keep me", "keywords": ["audio"],
    })).json()
    resp = await client.patch(f"/api/brands/{brand['id']}", headers=auth(token), json={"tagline": None, "keywords": None})
    assert resp.status_code == 200, resp.text
    assert (resp.json()["tagline"], resp.json()["keywords"]) == ("Keep me", ["audio"])


async def test_brand_list_fields_must_be_string_lists(client, register, auth):
    token, _ = await register()
    resp = await client.post("/api/brands", headers=auth(token), json={"name": "Acme", "keywords": "audio, dsp"})
    assert resp.status_code == 422, resp.text
