"""Product routes."""

import uuid
from datetime import date, datetime, timedelta, timezone

from cryptography.fernet import Fernet

import config
import database
import routers.products as products_router
from services import field_crypto


async def _brand(client, headers, name="Acme") -> dict:
    resp = await client.post("/api/brands", headers=headers, json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─── Baseline ───


async def test_create_and_get_product(client, register, auth):
    token, user = await register()
    payload = {
        "name": "Launch Ops", "tagline": "Ship it", "url": "https://example.com",
        "color": "#ff6b35", "description": "Ops for launches", "keywords": ["launch", "ops"],
    }
    resp = await client.post("/api/products", headers=auth(token), json=payload)
    assert resp.status_code == 201, resp.text
    product = resp.json()
    for key, value in payload.items():
        assert product[key] == value, key
    assert product["status"] == "pre_launch"
    assert product["user_id"] == user["id"]
    assert product["checklist"] == {}

    fetched = await client.get(f"/api/products/{product['id']}", headers=auth(token))
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["name"] == "Launch Ops"


async def test_list_products(client, register, auth, create_product):
    token, _ = await register()
    first = await create_product(token, name="First")
    second = await create_product(token, name="Second")
    resp = await client.get("/api/products", headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert {p["id"] for p in resp.json()} == {first["id"], second["id"]}


async def test_update_product(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token, name="Launch Ops")
    path = f"/api/products/{product['id']}"
    resp = await client.patch(path, headers=auth(token), json={
        "tagline": "New tagline",
        "status": "launched",
        "keywords": ["dsp"],
        "company_details": {"company_name": "Acme"},
        "email_settings": {"smtp_host": "smtp.example.com", "smtp_port": 2525},
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Launch Ops"
    assert body["tagline"] == "New tagline"
    assert body["status"] == "launched"
    assert body["keywords"] == ["dsp"]
    assert body["company_details"] == {"company_name": "Acme"}
    assert body["email_settings"]["smtp_host"] == "smtp.example.com"
    assert (await client.get(path, headers=auth(token))).json()["tagline"] == "New tagline"

    assert (await client.patch(path, headers=auth(token), json={"status": "bogus"})).status_code == 422


async def test_update_checklist(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token)
    checklist = {"pre_0": True, "launch_3": False, "_custom_pre": ["Record demo video"]}
    resp = await client.patch(f"/api/products/{product['id']}/checklist", headers=auth(token), json=checklist)
    assert resp.status_code == 200, resp.text
    assert resp.json()["checklist"] == checklist
    fetched = await client.get(f"/api/products/{product['id']}", headers=auth(token))
    assert fetched.json()["checklist"] == checklist


async def test_delete_product(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token)
    path = f"/api/products/{product['id']}"
    resp = await client.delete(path, headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"deleted": True}
    assert (await client.get(path, headers=auth(token))).status_code == 404
    assert (await client.delete(path, headers=auth(token))).status_code == 404


async def test_unknown_product_returns_404(client, register, auth):
    token, _ = await register()
    headers = auth(token)
    path = f"/api/products/{uuid.uuid4()}"
    assert (await client.get(path, headers=headers)).status_code == 404
    assert (await client.patch(path, headers=headers, json={"tagline": "x"})).status_code == 404
    assert (await client.patch(f"{path}/checklist", headers=headers, json={})).status_code == 404
    assert (await client.delete(path, headers=headers)).status_code == 404


async def test_malformed_product_id_returns_404(client, register, auth):
    token, _ = await register()
    headers = auth(token)
    for bad_id in ["not-a-uuid", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"]:
        path = f"/api/products/{bad_id}"
        assert (await client.get(path, headers=headers)).status_code == 404, path
        assert (await client.patch(path, headers=headers, json={"tagline": "x"})).status_code == 404, path
        assert (await client.patch(f"{path}/checklist", headers=headers, json={})).status_code == 404, path
        assert (await client.delete(path, headers=headers)).status_code == 404, path


# ─── B1: project_type, launch_date, brand_id ───


async def test_create_product_with_type_launch_date_and_brand(client, register, auth):
    token, _ = await register()
    brand = await _brand(client, auth(token))
    resp = await client.post("/api/products", headers=auth(token), json={
        "name": "Consulting", "project_type": "service", "launch_date": "2026-10-01", "brand_id": brand["id"],
    })
    assert resp.status_code == 201, resp.text
    product = resp.json()
    assert (product["project_type"], product["launch_date"], product["brand_id"]) == (
        "service", "2026-10-01", brand["id"],
    )
    fetched = (await client.get(f"/api/products/{product['id']}", headers=auth(token))).json()
    assert (fetched["project_type"], fetched["launch_date"], fetched["brand_id"]) == (
        "service", "2026-10-01", brand["id"],
    )
    pool = await database.get_pool()
    stored = await pool.fetchval("SELECT launch_date FROM products WHERE id = $1", uuid.UUID(product["id"]))
    assert stored == date(2026, 10, 1)


async def test_create_product_defaults(register, create_product):
    token, _ = await register()
    product = await create_product(token)
    assert (product["project_type"], product["launch_date"], product["brand_id"]) == ("product", None, None)


async def test_create_product_rejects_unknown_project_type(client, register, auth):
    token, _ = await register()
    resp = await client.post("/api/products", headers=auth(token), json={"name": "X", "project_type": "gadget"})
    assert resp.status_code == 422


async def test_update_product_type_and_launch_date(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token)
    path = f"/api/products/{product['id']}"
    resp = await client.patch(path, headers=auth(token), json={"project_type": "persona", "launch_date": "2026-12-24"})
    assert resp.status_code == 200, resp.text
    assert (resp.json()["project_type"], resp.json()["launch_date"]) == ("persona", "2026-12-24")
    fetched = (await client.get(path, headers=auth(token))).json()
    assert (fetched["project_type"], fetched["launch_date"]) == ("persona", "2026-12-24")
    assert (await client.patch(path, headers=auth(token), json={"project_type": "gadget"})).status_code == 422


async def test_patch_assigns_brand(client, register, auth, create_product):
    token, _ = await register()
    brand = await _brand(client, auth(token))
    product = await create_product(token)
    resp = await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"brand_id": brand["id"]})
    assert resp.status_code == 200, resp.text
    assert resp.json()["brand_id"] == brand["id"]


async def test_patch_null_unassigns_brand_and_clears_launch_date(client, register, auth):
    token, _ = await register()
    brand = await _brand(client, auth(token))
    created = (await client.post("/api/products", headers=auth(token), json={
        "name": "P", "launch_date": "2026-10-01", "brand_id": brand["id"],
    })).json()
    assert (created["brand_id"], created["launch_date"]) == (brand["id"], "2026-10-01")

    resp = await client.patch(f"/api/products/{created['id']}", headers=auth(token), json={
        "brand_id": None, "launch_date": None,
    })
    assert resp.status_code == 200, resp.text
    assert (resp.json()["brand_id"], resp.json()["launch_date"]) == (None, None)


async def test_patch_ignores_null_for_other_fields(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token, tagline="Keep me", keywords=["keep"])
    resp = await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={
        "tagline": None, "keywords": None, "status": None, "project_type": None, "email_settings": None,
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["tagline"], body["keywords"], body["status"], body["project_type"]) == (
        "Keep me", ["keep"], "pre_launch", "product",
    )


async def test_patch_rejects_empty_or_null_name(client, register, auth, create_product):
    token, _ = await register()
    product = await create_product(token, name="Launch Ops")
    path = f"/api/products/{product['id']}"
    for name in ["", "   ", None]:
        resp = await client.patch(path, headers=auth(token), json={"name": name})
        assert resp.status_code == 422, (name, resp.text)
    assert (await client.get(path, headers=auth(token))).json()["name"] == "Launch Ops"


async def test_brand_must_belong_to_current_user(client, register, auth, create_product):
    alice_token, _ = await register()
    bob_token, _ = await register()
    bobs_brand = await _brand(client, auth(bob_token), "Bob Brand")

    for brand_id in [bobs_brand["id"], str(uuid.uuid4()), "not-a-uuid", ""]:
        resp = await client.post("/api/products", headers=auth(alice_token), json={"name": "P", "brand_id": brand_id})
        assert resp.status_code == 400, (brand_id, resp.text)
        assert resp.json() == {"detail": "Brand not found"}

    product = await create_product(alice_token)
    path = f"/api/products/{product['id']}"
    resp = await client.patch(path, headers=auth(alice_token), json={"brand_id": bobs_brand["id"]})
    assert resp.status_code == 400, resp.text
    assert resp.json() == {"detail": "Brand not found"}
    assert (await client.get(path, headers=auth(alice_token))).json()["brand_id"] is None
    assert len((await client.get("/api/products", headers=auth(alice_token))).json()) == 1


async def test_deleting_a_brand_unassigns_it(client, register, auth):
    token, _ = await register()
    brand = await _brand(client, auth(token))
    product = (await client.post("/api/products", headers=auth(token), json={
        "name": "P", "brand_id": brand["id"],
    })).json()
    assert product["brand_id"] == brand["id"]
    await client.delete(f"/api/brands/{brand['id']}", headers=auth(token))
    assert (await client.get(f"/api/products/{product['id']}", headers=auth(token))).json()["brand_id"] is None


# ─── B2: the SMTP password is write-only ───


async def test_product_responses_never_include_smtp_password(client, register, auth, create_product, smtp_config):
    token, _ = await register()
    product = await create_product(token)
    assert product["email_settings"] == {"smtp_password_set": False}
    path = f"/api/products/{product['id']}"

    patched = await client.patch(path, headers=auth(token), json={"email_settings": smtp_config})
    assert patched.status_code == 200, patched.text
    responses = [
        patched.json(),
        (await client.get(path, headers=auth(token))).json(),
        (await client.get("/api/products", headers=auth(token))).json()[0],
        (await client.patch(f"{path}/checklist", headers=auth(token), json={"pre_0": True})).json(),
    ]
    for body in responses:
        assert "smtp_password" not in body["email_settings"]
        assert body["email_settings"]["smtp_password_set"] is True
        assert body["email_settings"]["smtp_host"] == "smtp.example.com"
    assert "s3cret-pass" not in (await client.get("/api/products", headers=auth(token))).text


async def test_patch_without_password_keeps_stored_password(client, register, auth, create_product, smtp_config):
    token, _ = await register()
    product = await create_product(token)
    path = f"/api/products/{product['id']}"
    await client.patch(path, headers=auth(token), json={"email_settings": smtp_config})

    # What the UI sends back: no password, plus the response-only flag
    without_password = {k: v for k, v in smtp_config.items() if k != "smtp_password"}
    resp = await client.patch(path, headers=auth(token), json={
        "email_settings": {**without_password, "smtp_host": "smtp2.example.com", "smtp_password_set": True},
    })
    assert resp.status_code == 200, resp.text
    stored = (await database.select_one("products", product["id"]))["email_settings"]
    assert (stored["smtp_host"], field_crypto.decrypt(stored["smtp_password"])) == ("smtp2.example.com", "s3cret-pass")
    assert "smtp_password_set" not in stored

    resp = await client.patch(path, headers=auth(token), json={"email_settings": {**smtp_config, "smtp_password": ""}})
    assert resp.status_code == 200, resp.text
    stored = (await database.select_one("products", product["id"]))["email_settings"]
    assert field_crypto.decrypt(stored["smtp_password"]) == "s3cret-pass"


async def test_patch_with_new_password_replaces_it(client, register, auth, create_product, smtp_config):
    token, _ = await register()
    product = await create_product(token)
    path = f"/api/products/{product['id']}"
    await client.patch(path, headers=auth(token), json={"email_settings": smtp_config})
    await client.patch(path, headers=auth(token), json={"email_settings": {**smtp_config, "smtp_password": "n3w-pass"}})
    stored = (await database.select_one("products", product["id"]))["email_settings"]
    assert field_crypto.decrypt(stored["smtp_password"]) == "n3w-pass"


async def test_sending_uses_stored_password_after_ui_round_trip(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    path = f"/api/products/{product['id']}"
    await client.patch(path, headers=auth(token), json={"email_settings": smtp_config})
    shown = (await client.get(path, headers=auth(token))).json()["email_settings"]
    # The UI never holds the password, so it saves the form without one
    await client.patch(path, headers=auth(token), json={
        "email_settings": {k: v for k, v in shown.items() if k != "smtp_password"},
    })
    email = await make_email(user, product)

    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert fake_smtp.calls[0].smtp_settings.get("smtp_password") == "s3cret-pass"


# ─── F-2: SMTP passwords are encrypted at rest ───


async def test_smtp_passwords_are_stored_encrypted(client, register, auth, create_product, smtp_config):
    token, _ = await register()
    product = await create_product(token)
    await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"email_settings": smtp_config})

    pool = await database.get_pool()
    raw = await pool.fetchval("SELECT email_settings::text FROM products WHERE id = $1", uuid.UUID(product["id"]))
    assert "s3cret-pass" not in raw
    stored = (await database.select_one("products", product["id"]))["email_settings"]["smtp_password"]
    assert stored.startswith("enc:v1:")
    assert field_crypto.decrypt(stored) == "s3cret-pass"


async def test_passwords_saved_before_encryption_keep_working_and_get_encrypted(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    # A row written by an older version, with the password in plain text
    await database.update("products", product["id"], {"email_settings": smtp_config})
    email = await make_email(user, product)

    sent = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert sent.status_code == 200, sent.text
    assert fake_smtp.calls[0].smtp_settings["smtp_password"] == "s3cret-pass"

    assert await products_router.encrypt_stored_smtp_passwords() == 1
    stored = (await database.select_one("products", product["id"]))["email_settings"]["smtp_password"]
    assert stored.startswith("enc:v1:")
    assert await products_router.encrypt_stored_smtp_passwords() == 0

    second = await make_email(user, product)
    resent = await client.post(f"/api/email-queue/{second['id']}/send", headers=auth(token))
    assert resent.status_code == 200, resent.text
    assert fake_smtp.calls[1].smtp_settings["smtp_password"] == "s3cret-pass"


async def test_an_unreadable_password_explains_how_to_fix_it(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    await database.update("products", product["id"], {
        "email_settings": {**smtp_config, "smtp_password": "enc:v1:written-with-a-key-that-is-gone"},
    })
    email = await make_email(user, product)

    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"] == (
        "The saved email server password for this project can't be read, because the encryption key changed. "
        "Enter the password again in the project's email settings."
    )
    assert fake_smtp.calls == []
    assert (await database.select_one("email_queue", email["id"]))["status"] == "pending"


def test_rotated_keys_still_read_older_passwords(monkeypatch):
    settings = config.get_settings()
    old_key, new_key = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "field_encryption_key", old_key)
    written_with_old_key = field_crypto.encrypt("s3cret-pass")

    monkeypatch.setattr(settings, "field_encryption_key", f"{new_key},{old_key}")
    assert field_crypto.decrypt(written_with_old_key) == "s3cret-pass"
    written_with_new_key = field_crypto.encrypt("s3cret-pass")
    monkeypatch.setattr(settings, "field_encryption_key", new_key)
    assert field_crypto.decrypt(written_with_new_key) == "s3cret-pass"


# ─── B19: saved timestamps are UTC wherever the server runs ───


async def test_saved_timestamps_are_the_current_utc_time(client, register, auth, create_product):
    """asyncpg reads a naive datetime as the server's local time, so a naive utcnow() is stored
    hours off on any non-UTC host. This only fails on such a host (e.g. a developer machine)."""
    token, _ = await register()
    headers = auth(token)
    product = await create_product(token)
    now = datetime.now(timezone.utc)

    def is_now(value: str) -> bool:
        return abs(datetime.fromisoformat(value) - now) < timedelta(minutes=2)

    edited = await client.patch(f"/api/products/{product['id']}", headers=headers, json={"tagline": "New"})
    assert is_now(edited.json()["updated_at"]), edited.json()["updated_at"]
    ticked = await client.patch(f"/api/products/{product['id']}/checklist", headers=headers, json={"Pre-Launch_0": True})
    assert is_now(ticked.json()["updated_at"]), ticked.json()["updated_at"]
    template = await client.post("/api/templates", headers=headers, json={"name": "T", "type": "email", "tags": [], "content": "x"})
    assert is_now(template.json()["created_at"]), template.json()["created_at"]
    settings = await client.put("/api/settings", headers=headers, json={"platforms": {}, "brand": {}, "prefs": {}})
    assert settings.status_code == 200, settings.text
    assert is_now(settings.json()["updated_at"]), settings.json()["updated_at"]
