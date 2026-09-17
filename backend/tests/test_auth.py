"""Auth, admin and auth-middleware routes."""

import asyncio
import uuid
from datetime import date

from alembic import command

import config
import database
import main
import routers.auth

# ─── Baseline: register / login / me ───


async def test_register_returns_token_and_normalized_user(client):
    resp = await client.post("/api/auth/register", json={
        "email": " Alice@Example.com ", "password": "secret123", "name": " Alice ",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token"]
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["name"] == "Alice"
    assert body["user"]["id"]


async def test_first_registered_user_is_admin(register):
    _, first = await register()
    _, second = await register()
    assert first["role"] == "admin"
    assert second["role"] == "user"


async def test_with_an_admin_email_only_that_address_can_create_the_first_account(client, register, monkeypatch):
    # A new deployment is public before anyone has signed up; the first account becomes the platform admin
    monkeypatch.setattr(config.get_settings(), "admin_email", "Owner@LaunchOps.example")

    taken = await client.post("/api/auth/register", json={"email": "someone@example.com", "password": "secret123", "name": "Someone"})

    assert taken.status_code == 403, taken.text
    assert taken.json() == {
        "detail": "LaunchOps isn't set up yet. The first account, which administers it, has to use the administrator's email address.",
    }
    assert await database.select("users") == []
    _, owner = await register(" owner@launchops.example ")
    assert (owner["email"], owner["role"]) == ("owner@launchops.example", "admin")
    # Once the administrator exists, registration works as before
    _, member = await register("someone@example.com")
    assert member["role"] == "user"


async def test_register_rejects_invalid_input(client, register):
    await register("taken@example.com")
    cases = [
        ({"email": "", "password": "secret123"}, 400),
        ({"email": "new@example.com", "password": ""}, 400),
        ({"email": "new@example.com", "password": "12345"}, 400),
        ({"email": "TAKEN@example.com", "password": "secret123"}, 409),
    ]
    for payload, status in cases:
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == status, (payload, resp.text)


async def test_login_and_profile(client, register, auth):
    await register("bob@example.com", password="hunter22", name="Bob")

    wrong = await client.post("/api/auth/login", json={"email": "bob@example.com", "password": "not-it"})
    assert wrong.status_code == 401
    unknown = await client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "hunter22"})
    assert unknown.status_code == 401

    resp = await client.post("/api/auth/login", json={"email": "BOB@example.com", "password": "hunter22"})
    assert resp.status_code == 200, resp.text
    me = await client.get("/api/auth/me", headers=auth(resp.json()["token"]))
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "bob@example.com"
    assert me.json()["name"] == "Bob"
    assert me.json()["role"] == "admin"


async def test_me_requires_a_valid_token(client, auth):
    assert (await client.get("/api/auth/me")).status_code == 401
    assert (await client.get("/api/auth/me", headers=auth("not-a-jwt"))).status_code == 401


async def test_api_routes_require_a_valid_token(client, register, auth):
    assert (await client.get("/api/products")).status_code == 401
    assert (await client.get("/api/products", headers=auth("not-a-jwt"))).status_code == 401
    token, _ = await register()
    assert (await client.get("/api/products", headers=auth(token))).status_code == 200


async def test_health_is_public(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ─── Baseline: admin ───


async def test_admin_routes_require_admin_role(client, register, auth):
    await register()  # first user is the admin
    token, user = await register()
    requests = [
        ("GET", "/api/auth/admin/users", None),
        ("POST", "/api/auth/admin/users", {"email": "x@example.com", "password": "secret123"}),
        ("PATCH", f"/api/auth/admin/users/{user['id']}", {"role": "admin"}),
        ("DELETE", f"/api/auth/admin/users/{user['id']}", None),
        ("GET", "/api/auth/admin/projects", None),
        ("POST", "/api/auth/admin/transfer-project", {"product_id": "x", "target_user_id": "y"}),
        ("GET", "/api/auth/admin/registration", None),
        ("PUT", "/api/auth/admin/registration", {"registration_enabled": False}),
    ]
    for method, path, body in requests:
        resp = await client.request(method, path, json=body, headers=auth(token))
        assert resp.status_code == 403, (method, path, resp.text)


async def test_admin_lists_users(client, register, auth):
    admin_token, _ = await register("admin@example.com")
    await register("member@example.com")
    resp = await client.get("/api/auth/admin/users", headers=auth(admin_token))
    assert resp.status_code == 200, resp.text
    users = {u["email"]: u for u in resp.json()}
    assert set(users) == {"admin@example.com", "member@example.com"}
    assert users["admin@example.com"]["role"] == "admin"
    assert users["member@example.com"]["role"] == "user"
    assert all(u["enabled"] is True for u in users.values())


async def test_admin_creates_user_who_can_log_in(client, register, auth):
    admin_token, _ = await register()
    headers = auth(admin_token)
    resp = await client.post("/api/auth/admin/users", headers=headers, json={
        "email": "New@Example.com", "password": "secret123", "name": "New Person",
    })
    assert resp.status_code == 200, resp.text
    created = resp.json()
    assert (created["email"], created["name"], created["role"], created["enabled"]) == (
        "new@example.com", "New Person", "user", True,
    )
    login = await client.post("/api/auth/login", json={"email": "new@example.com", "password": "secret123"})
    assert login.status_code == 200

    duplicate = await client.post("/api/auth/admin/users", headers=headers, json={
        "email": "new@example.com", "password": "secret123",
    })
    assert duplicate.status_code == 409
    short = await client.post("/api/auth/admin/users", headers=headers, json={
        "email": "other@example.com", "password": "123",
    })
    assert short.status_code == 400


async def test_admin_updates_role_and_enabled(client, register, auth):
    admin_token, _ = await register()
    _, member = await register("member@example.com", password="secret123")
    headers = auth(admin_token)
    path = f"/api/auth/admin/users/{member['id']}"

    resp = await client.patch(path, headers=headers, json={"role": "admin"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "admin"

    resp = await client.patch(path, headers=headers, json={"enabled": False})
    assert resp.status_code == 200, resp.text
    assert resp.json()["enabled"] is False
    login = await client.post("/api/auth/login", json={"email": "member@example.com", "password": "secret123"})
    assert login.status_code == 403

    assert (await client.patch(path, headers=headers, json={"role": "owner"})).status_code == 400
    assert (await client.patch(path, headers=headers, json={})).status_code == 400


async def test_admin_update_unknown_user_returns_404(client, register, auth):
    admin_token, admin = await register()
    for user_id in [str(uuid.uuid4()), "not-a-uuid"]:
        resp = await client.patch(f"/api/auth/admin/users/{user_id}", headers=auth(admin_token), json={
            "enabled": False,
        })
        assert resp.status_code == 404, (user_id, resp.text)
        assert resp.json() == {"detail": "User not found"}
    users = (await client.get("/api/auth/admin/users", headers=auth(admin_token))).json()
    assert [(u["id"], u["enabled"]) for u in users] == [(admin["id"], True)]


async def test_admin_deletes_users_but_not_self(client, register, auth):
    admin_token, admin = await register()
    member_token, member = await register()
    headers = auth(admin_token)

    assert (await client.delete(f"/api/auth/admin/users/{admin['id']}", headers=headers)).status_code == 400

    resp = await client.delete(f"/api/auth/admin/users/{member['id']}", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "deleted"}
    remaining = (await client.get("/api/auth/admin/users", headers=headers)).json()
    assert [u["id"] for u in remaining] == [admin["id"]]
    assert (await client.get("/api/products", headers=auth(member_token))).status_code == 401


async def test_admin_lists_projects_across_users(client, register, auth, create_product):
    admin_token, _ = await register("admin@example.com")
    member_token, _ = await register("member@example.com")
    mine = await create_product(admin_token, name="Admin Project")
    theirs = await create_product(member_token, name="Member Project")

    resp = await client.get("/api/auth/admin/projects", headers=auth(admin_token))
    assert resp.status_code == 200, resp.text
    projects = {p["id"]: p for p in resp.json()}
    assert projects[mine["id"]]["user_email"] == "admin@example.com"
    assert projects[theirs["id"]]["user_email"] == "member@example.com"
    assert projects[theirs["id"]]["name"] == "Member Project"


async def test_admin_transfers_project_with_its_rows(
    client, register, auth, create_product, make_queue_item, make_email, make_event,
):
    admin_token, _ = await register()
    alice_token, alice = await register()
    bob_token, bob = await register()
    product = await create_product(alice_token)
    item = await make_queue_item(alice, product)
    email = await make_email(alice, product)
    event = await make_event(alice, product, date(2026, 10, 1))
    capture = (await client.post("/api/captures", headers=auth(alice_token), json={
        "text": "Idea", "product_id": product["id"],
    })).json()

    resp = await client.post("/api/auth/admin/transfer-project", headers=auth(admin_token), json={
        "product_id": product["id"], "target_user_id": bob["id"],
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "transferred"

    assert (await client.get(f"/api/products/{product['id']}", headers=auth(alice_token))).status_code == 404
    assert (await client.get(f"/api/products/{product['id']}", headers=auth(bob_token))).status_code == 200
    for path, row in [("/api/queue", item), ("/api/email-queue", email),
                      ("/api/calendar", event), ("/api/captures", capture)]:
        bob_ids = [r["id"] for r in (await client.get(path, headers=auth(bob_token))).json()]
        alice_ids = [r["id"] for r in (await client.get(path, headers=auth(alice_token))).json()]
        assert row["id"] in bob_ids, path
        assert row["id"] not in alice_ids, path


async def test_admin_transfer_validates_input(client, register, auth, create_product):
    admin_token, admin = await register()
    product = await create_product(admin_token)
    headers = auth(admin_token)
    url = "/api/auth/admin/transfer-project"
    assert (await client.post(url, headers=headers, json={})).status_code == 400
    no_product = await client.post(url, headers=headers, json={
        "product_id": str(uuid.uuid4()), "target_user_id": admin["id"],
    })
    assert no_product.status_code == 404
    no_user = await client.post(url, headers=headers, json={
        "product_id": product["id"], "target_user_id": str(uuid.uuid4()),
    })
    assert no_user.status_code == 404


ALICE_BRAND = {
    "name": "Alice Private Brand",
    "company_name": "Alice Holdings",
    "founder_name": "Alice Founder",
    "phone": "555-0100",
    "email": "press@alice.example",
    "boilerplate": "Alice boilerplate, confidential",
}


async def test_transferred_project_stops_using_previous_owners_brand(
    client, register, auth, create_product, fake_ai, run_jobs,
):
    admin_token, _ = await register()
    alice_token, _ = await register()
    bob_token, bob = await register()
    brand = (await client.post("/api/brands", headers=auth(alice_token), json=ALICE_BRAND)).json()
    product = await create_product(alice_token)
    assigned = await client.patch(f"/api/products/{product['id']}", headers=auth(alice_token), json={
        "brand_id": brand["id"], "company_details": {"company_name": "Launch Ops Studio"},
    })
    assert assigned.status_code == 200, assigned.text

    async def system_prompts(token):
        """Prompts from both brand-loading paths: a report and a background workflow."""
        fake_ai.calls.clear()
        report = await client.post("/api/presskit/generate", headers=auth(token), json={
            "product_id": product["id"], "url": "https://example.com",
        })
        assert report.status_code == 200, report.text
        launched = await client.post("/api/workflows/launch", headers=auth(token), json={
            "product_id": product["id"], "workflow_id": "blog",
        })
        assert launched.status_code == 200, launched.text
        await run_jobs()
        assert len(fake_ai.calls) == 2
        return [call.system for call in fake_ai.calls]

    # Positive control: the owner's own brand is used on both paths
    for system in await system_prompts(alice_token):
        assert "Brand: Alice Private Brand" in system

    transfer = await client.post("/api/auth/admin/transfer-project", headers=auth(admin_token), json={
        "product_id": product["id"], "target_user_id": bob["id"],
    })
    assert transfer.status_code == 200, transfer.text

    for system in await system_prompts(bob_token):
        for value in ALICE_BRAND.values():
            assert value not in system
        # Without a usable brand, the product's own company details apply
        assert "Company Name: Launch Ops Studio" in system


async def test_admin_toggles_registration(client, register, auth):
    admin_token, _ = await register()
    headers = auth(admin_token)
    url = "/api/auth/admin/registration"
    assert (await client.get(url, headers=headers)).json() == {"registration_enabled": True}

    resp = await client.put(url, headers=headers, json={"registration_enabled": False})
    assert resp.json() == {"registration_enabled": False}
    assert (await client.get(url, headers=headers)).json() == {"registration_enabled": False}
    blocked = await client.post("/api/auth/register", json={"email": "late@example.com", "password": "secret123"})
    assert blocked.status_code == 403

    await client.put(url, headers=headers, json={"registration_enabled": True})
    allowed = await client.post("/api/auth/register", json={"email": "late@example.com", "password": "secret123"})
    assert allowed.status_code == 200


# ─── B8: the registration toggle is a global app_config setting ───


async def _registration_enabled(client, headers):
    resp = await client.get("/api/auth/admin/registration", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["registration_enabled"]


async def _register_status(client, email="late@example.com") -> int:
    resp = await client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    return resp.status_code


async def test_registration_toggle_survives_restart(client, register, auth):
    admin_token, _ = await register()
    headers = auth(admin_token)
    await client.put("/api/auth/admin/registration", headers=headers, json={"registration_enabled": False})

    async with main.lifespan(main.app):  # a restart
        pass

    assert await _register_status(client) == 403
    assert await _registration_enabled(client, headers) is False
    pool = await database.get_pool()
    assert await pool.fetchval("SELECT value FROM app_config WHERE key = 'registration_enabled'") is False


async def test_registration_toggle_does_not_live_on_user_settings_rows(client, register, auth):
    first_token, first = await register()
    first_headers = auth(first_token)
    # A second admin, created by the first (admin-created users have no settings row)
    second = (await client.post("/api/auth/admin/users", headers=first_headers, json={
        "email": "second@example.com", "password": "secret123",
    })).json()
    await client.patch(f"/api/auth/admin/users/{second['id']}", headers=first_headers, json={"role": "admin"})
    login = await client.post("/api/auth/login", json={"email": "second@example.com", "password": "secret123"})
    second_headers = auth(login.json()["token"])

    await client.put("/api/auth/admin/registration", headers=second_headers, json={"registration_enabled": False})
    # Removing the first admin removes the only settings row
    await client.delete(f"/api/auth/admin/users/{first['id']}", headers=second_headers)

    assert await _register_status(client) == 403
    assert await _registration_enabled(client, second_headers) is False


async def test_missing_registration_setting_means_enabled(client, register, auth):
    admin_token, _ = await register()
    pool = await database.get_pool()
    assert await pool.fetchval("SELECT count(*) FROM app_config") == 0
    assert await _registration_enabled(client, auth(admin_token)) is True
    assert await _register_status(client) == 200


async def test_legacy_disabled_registration_is_carried_over(client, register, auth):
    admin_token, _ = await register()
    pool = await database.get_pool()
    # Before app_config existed, the toggle lived on the settings rows
    await pool.execute("UPDATE settings SET registration_enabled = false")

    # Migration 0002 carries the switch over: apply it again to this database
    try:
        await asyncio.to_thread(command.downgrade, database.alembic_config(), "0001")
    finally:
        await database.run_migrations()

    assert await pool.fetchval("SELECT value FROM app_config WHERE key = 'registration_enabled'") is False
    assert await _register_status(client) == 403
    assert await _registration_enabled(client, auth(admin_token)) is False


# ─── B9: disabled users lose access immediately ───


async def test_disabled_user_token_is_rejected_immediately(client, register, auth):
    admin_token, _ = await register()
    member_token, member = await register()
    assert (await client.get("/api/products", headers=auth(member_token))).status_code == 200

    path = f"/api/auth/admin/users/{member['id']}"
    await client.patch(path, headers=auth(admin_token), json={"enabled": False})
    for route in ["/api/products", "/api/auth/me"]:
        resp = await client.get(route, headers=auth(member_token))
        assert resp.status_code == 401, (route, resp.text)
        assert resp.json() == {"detail": "Account is disabled"}

    await client.patch(path, headers=auth(admin_token), json={"enabled": True})
    assert (await client.get("/api/products", headers=auth(member_token))).status_code == 200


# ─── B16: a token belongs to one account, never to whoever later has its email ───


async def test_token_of_deleted_account_does_not_sign_in_a_new_account_with_the_same_email(client, register, auth):
    admin_token, _ = await register()
    old_token, old_user = await register(email="shared@example.com")
    deleted = await client.delete(f"/api/auth/admin/users/{old_user['id']}", headers=auth(admin_token))
    assert deleted.status_code == 200, deleted.text
    _, new_user = await register(email="shared@example.com")
    assert new_user["id"] != old_user["id"]

    for route in ["/api/auth/me", "/api/products"]:
        resp = await client.get(route, headers=auth(old_token))
        assert resp.status_code == 401, (route, resp.text)


# ─── B17: a database outage during sign-in is not an invalid token ───


async def test_database_errors_while_authenticating_are_not_reported_as_bad_tokens(client, register, auth, monkeypatch):
    """The app signs people out on a 401, so an outage must not look like one."""
    token, _ = await register()

    async def unavailable(*args, **kwargs):
        raise OSError("connection refused")

    monkeypatch.setattr(main, "select_one", unavailable)
    monkeypatch.setattr(routers.auth, "select_one", unavailable)
    for route in ["/api/products", "/api/auth/me"]:
        resp = await client.get(route, headers=auth(token))
        assert resp.status_code == 503, (route, resp.text)
        assert resp.json() == {"detail": "LaunchOps can't reach its database right now. Try again in a moment."}
