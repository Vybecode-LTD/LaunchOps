"""Organisation settings, members, invitations and the activity log (docs/PHASE1_DESIGN.md D2, D8, D14)."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

import database


@pytest.fixture
async def org(client, register, auth):
    """Olivia's organisation, with Ed as an editor."""
    owner_token, owner = await register("olivia@example.com", name="Olivia")
    org_id = (await client.get("/api/auth/me", headers=auth(owner_token))).json()["organisations"][0]["id"]
    editor_token, editor = await register("ed@example.com", name="Ed")
    await database.insert("memberships", {"org_id": org_id, "user_id": editor["id"], "role": "editor"})
    return SimpleNamespace(
        id=org_id,
        owner=owner,
        editor=editor,
        owner_headers={**auth(owner_token), "X-Org-Id": org_id},
        editor_headers={**auth(editor_token), "X-Org-Id": org_id},
    )


async def _invite(client, org, email="nina@example.com", role="approver"):
    resp = await client.post("/api/organisation/invitations", headers=org.owner_headers, json={"email": email, "role": role})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _token(invitation: dict) -> str:
    return invitation["link"].rsplit("/", 1)[-1]


# ─── The organisation ───


async def test_members_see_the_organisation_and_owners_rename_it(client, org):
    seen = (await client.get("/api/organisation", headers=org.editor_headers)).json()
    assert seen == {"id": org.id, "name": "Olivia's organisation", "role": "editor"}

    denied = await client.patch("/api/organisation", headers=org.editor_headers, json={"name": "Hijacked"})
    renamed = await client.patch("/api/organisation", headers=org.owner_headers, json={"name": "  Northwind Ventures "})

    assert denied.status_code == 403
    assert (renamed.status_code, renamed.json()["name"]) == (200, "Northwind Ventures")
    empty = await client.patch("/api/organisation", headers=org.owner_headers, json={"name": "   "})
    assert (empty.status_code, empty.json()) == (422, {"detail": "The organisation needs a name."})


async def test_members_list_shows_everyone_and_their_roles(client, org):
    members = (await client.get("/api/organisation/members", headers=org.editor_headers)).json()

    assert [(m["name"], m["email"], m["role"]) for m in members] == [
        ("Olivia", "olivia@example.com", "owner"),
        ("Ed", "ed@example.com", "editor"),
    ]
    assert all(m["user_id"] and m["joined_at"] for m in members)


# ─── Roles and removal ───


async def test_owners_change_roles(client, org):
    path = f"/api/organisation/members/{org.editor['id']}"

    denied = await client.patch(path, headers=org.editor_headers, json={"role": "owner"})
    promoted = await client.patch(path, headers=org.owner_headers, json={"role": "approver"})
    invalid = await client.patch(path, headers=org.owner_headers, json={"role": "superuser"})

    assert denied.status_code == 403
    assert (promoted.status_code, promoted.json()["role"]) == (200, "approver")
    assert invalid.status_code == 422


async def test_an_organisation_always_keeps_an_owner(client, org):
    path = f"/api/organisation/members/{org.owner['id']}"
    message = "An organisation needs at least one owner. Make someone else an owner first."

    demoted = await client.patch(path, headers=org.owner_headers, json={"role": "editor"})
    left = await client.delete(path, headers=org.owner_headers)

    assert (demoted.status_code, demoted.json()) == (409, {"detail": message})
    assert (left.status_code, left.json()) == (409, {"detail": message})
    # With a second owner, the first may step down
    await client.patch(f"/api/organisation/members/{org.editor['id']}", headers=org.owner_headers, json={"role": "owner"})
    assert (await client.patch(path, headers=org.owner_headers, json={"role": "editor"})).status_code == 200


async def test_owners_remove_members_and_members_can_leave(client, org, register, auth):
    viewer_token, viewer = await register("vic@example.com", name="Vic")
    await database.insert("memberships", {"org_id": org.id, "user_id": viewer["id"], "role": "viewer"})

    removed_by_editor = await client.delete(f"/api/organisation/members/{viewer['id']}", headers=org.editor_headers)
    left = await client.delete(f"/api/organisation/members/{viewer['id']}", headers={**auth(viewer_token), "X-Org-Id": org.id})
    removed = await client.delete(f"/api/organisation/members/{org.editor['id']}", headers=org.owner_headers)

    assert removed_by_editor.status_code == 403
    assert left.status_code == 200
    assert removed.status_code == 200
    members = (await client.get("/api/organisation/members", headers=org.owner_headers)).json()
    assert [m["email"] for m in members] == ["olivia@example.com"]
    gone = await client.get("/api/products", headers=org.editor_headers)
    assert (gone.status_code, gone.json()) == (404, {"detail": "Organisation not found"})


async def test_removing_someone_who_isnt_a_member_is_not_found(client, org, register):
    _, stranger = await register("stranger@example.com")
    resp = await client.delete(f"/api/organisation/members/{stranger['id']}", headers=org.owner_headers)
    assert (resp.status_code, resp.json()) == (404, {"detail": "Member not found"})


# ─── Invitations ───


async def test_owners_invite_by_email_and_see_pending_invitations(client, org):
    denied = await client.post("/api/organisation/invitations", headers=org.editor_headers, json={
        "email": "nina@example.com", "role": "viewer",
    })
    invitation = await _invite(client, org, email=" Nina@Example.com ", role="approver")

    assert denied.status_code == 403
    assert (invitation["email"], invitation["role"]) == ("nina@example.com", "approver")
    assert invitation["link"].startswith("/invite/") and len(_token(invitation)) >= 40
    pending = (await client.get("/api/organisation/invitations", headers=org.owner_headers)).json()
    assert [(i["email"], i["role"], i["invited_by"]) for i in pending] == [("nina@example.com", "approver", "Olivia")]
    assert "link" not in pending[0] and "token_hash" not in pending[0], "a link is shown once, when it's created"


async def test_inviting_again_replaces_the_earlier_invitation(client, org):
    first = await _invite(client, org, role="viewer")
    second = await _invite(client, org, role="editor")

    pending = (await client.get("/api/organisation/invitations", headers=org.owner_headers)).json()
    assert [(i["id"], i["role"]) for i in pending] == [(second["id"], "editor")]
    assert (await client.get(f"/api/invitations/{_token(first)}")).status_code == 404


async def test_members_cant_be_invited_again(client, org):
    resp = await client.post("/api/organisation/invitations", headers=org.owner_headers, json={
        "email": "ed@example.com", "role": "viewer",
    })
    assert (resp.status_code, resp.json()) == (409, {"detail": "ed@example.com is already a member of this organisation."})


async def test_an_invitation_link_describes_the_invitation_without_signing_in(client, org):
    invitation = await _invite(client, org)

    resp = await client.get(f"/api/invitations/{_token(invitation)}")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["organisation"], body["email"], body["role"], body["invited_by"], body["account_exists"]) == (
        "Olivia's organisation", "nina@example.com", "approver", "Olivia", False,
    )


async def test_accepting_an_invitation_adds_the_signed_in_user(client, org, register, auth):
    invitation = await _invite(client, org)
    nina_token, _ = await register("nina@example.com", name="Nina")

    accepted = await client.post(f"/api/invitations/{_token(invitation)}/accept", headers=auth(nina_token))

    assert accepted.status_code == 200, accepted.text
    assert accepted.json() == {"id": org.id, "name": "Olivia's organisation", "role": "approver"}
    roles = {o["name"]: o["role"] for o in (await client.get("/api/auth/me", headers=auth(nina_token))).json()["organisations"]}
    assert roles == {"Nina's organisation": "owner", "Olivia's organisation": "approver"}
    assert (await client.get(f"/api/invitations/{_token(invitation)}")).status_code == 404, "used up"


async def test_an_invitation_is_only_for_the_address_it_was_sent_to(client, org, register, auth):
    invitation = await _invite(client, org)
    other_token, _ = await register("mallory@example.com")

    resp = await client.post(f"/api/invitations/{_token(invitation)}/accept", headers=auth(other_token))

    assert (resp.status_code, resp.json()) == (403, {
        "detail": "This invitation is for nina@example.com. Sign in with that email address to accept it.",
    })


async def test_invited_people_create_their_account_even_when_registration_is_closed(client, org):
    await client.put("/api/auth/admin/registration", headers=org.owner_headers, json={"registration_enabled": False})
    invitation = await _invite(client, org)

    created = await client.post(f"/api/invitations/{_token(invitation)}/register", json={"name": "Nina", "password": "password123"})

    assert created.status_code == 200, created.text
    body = created.json()
    assert body["token"]
    assert body["user"]["email"] == "nina@example.com"
    assert body["user"]["organisations"] == [{"id": org.id, "name": "Olivia's organisation", "role": "approver"}]
    login = await client.post("/api/auth/login", json={"email": "nina@example.com", "password": "password123"})
    assert login.status_code == 200
    again = await client.post(f"/api/invitations/{_token(invitation)}/register", json={"name": "Nina", "password": "password123"})
    assert again.status_code == 404


async def test_registering_through_an_invitation_needs_a_valid_password_and_a_new_address(client, org, register):
    short = await client.post(f"/api/invitations/{_token(await _invite(client, org))}/register", json={"name": "Nina", "password": "short"})
    await register("taken@example.com")
    taken = await client.post(
        f"/api/invitations/{_token(await _invite(client, org, email='taken@example.com'))}/register",
        json={"name": "Taken", "password": "password123"},
    )

    assert (short.status_code, short.json()) == (400, {"detail": "Password must be at least 8 characters"})
    assert (taken.status_code, taken.json()) == (409, {
        "detail": "An account with this email already exists. Sign in to accept the invitation.",
    })


async def test_expired_and_withdrawn_invitations_dont_work(client, org, register, auth):
    expired = await _invite(client, org, email="late@example.com")
    pool = await database.get_pool()
    await pool.execute(
        "UPDATE invitations SET expires_at = $1 WHERE email = 'late@example.com'", datetime.now(UTC) - timedelta(minutes=1),
    )
    withdrawn = await _invite(client, org, email="nina@example.com")
    revoke = await client.delete(f"/api/organisation/invitations/{withdrawn['id']}", headers=org.owner_headers)
    nina_token, _ = await register("nina@example.com")

    assert revoke.status_code == 200
    for invitation in (expired, withdrawn):
        described = await client.get(f"/api/invitations/{_token(invitation)}")
        assert (described.status_code, described.json()) == (404, {
            "detail": "This invitation has expired, was withdrawn or has been used. Ask for a new one.",
        })
    assert (await client.post(f"/api/invitations/{_token(withdrawn)}/accept", headers=auth(nina_token))).status_code == 404
    assert (await client.get("/api/organisation/invitations", headers=org.owner_headers)).json() == []


# ─── Activity log ───


async def test_the_activity_log_records_governed_actions(client, org, register, auth, fake_smtp, smtp_config):
    product = (await client.post("/api/products", headers=org.owner_headers, json={"name": "Launch Ops"})).json()
    await client.patch(f"/api/products/{product['id']}", headers=org.owner_headers, json={"email_settings": smtp_config})
    item = await database.insert("queue", {
        "product_id": product["id"], "org_id": org.id, "user_id": org.owner["id"], "workflow_id": "partnerships",
        "status": "pending", "preview": "Identified 1 partnership", "content": {"partnerships": [{"name": "Acme", "email": "hi@acme.example"}]},
    })
    await client.patch(f"/api/queue/{item['id']}", headers=org.owner_headers, json={"status": "approved"})
    [draft] = (await client.get("/api/email-queue", headers=org.owner_headers)).json()
    await client.post(f"/api/email-queue/{draft['id']}/send", headers=org.owner_headers)
    await client.patch(f"/api/organisation/members/{org.editor['id']}", headers=org.owner_headers, json={"role": "approver"})
    invitation = await _invite(client, org, email="nina@example.com", role="viewer")
    await client.put("/api/settings", headers=org.editor_headers, json={"platforms": {}, "brand": {"tone": "warm"}, "prefs": {}})
    await client.delete(f"/api/products/{product['id']}", headers=org.owner_headers)

    denied = await client.get("/api/organisation/activity", headers=org.editor_headers)
    activity = (await client.get("/api/organisation/activity", headers=org.owner_headers)).json()

    assert denied.status_code == 403
    assert [(a["actor"], a["action"], a["summary"]) for a in activity] == [
        ("olivia@example.com", "project.deleted", "Deleted the project Launch Ops"),
        ("ed@example.com", "settings.updated", "Changed the brand voice, channels or output preferences"),
        ("olivia@example.com", "invitation.created", "Invited nina@example.com as Viewer"),
        ("olivia@example.com", "member.role_changed", "Changed ed@example.com from Editor to Approver"),
        ("olivia@example.com", "email.sent", "Sent “Regarding Launch Ops” to hi@acme.example"),
        ("olivia@example.com", "result.approved", "Approved “Identified 1 partnership” for Launch Ops"),
        ("olivia@example.com", "project.created", "Created the project Launch Ops"),
    ]
    assert invitation["id"] == activity[2]["target_id"]
    assert all(a["created_at"] for a in activity)


async def test_the_activity_log_pages_backwards(client, org):
    for n in range(5):
        await client.post("/api/products", headers=org.owner_headers, json={"name": f"Venture {n}"})

    first = (await client.get("/api/organisation/activity?limit=2", headers=org.owner_headers)).json()
    rest = (await client.get(f"/api/organisation/activity?limit=10&before={first[-1]['id']}", headers=org.owner_headers)).json()

    assert [a["summary"] for a in first] == ["Created the project Venture 4", "Created the project Venture 3"]
    assert [a["summary"] for a in rest] == [f"Created the project Venture {n}" for n in (2, 1, 0)]
