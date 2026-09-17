"""Approval queue and email queue routes."""

import uuid
from datetime import UTC, datetime, timedelta

import fastapi

import config

# ─── Baseline: approval queue ───


async def test_list_queue_with_filters(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    one = await create_product(token, name="One")
    two = await create_product(token, name="Two")
    pending = await make_queue_item(user, one, "blog")
    approved = await make_queue_item(user, one, "social_posts", status="approved")
    other = await make_queue_item(user, two, "trend")

    async def ids(query=""):
        resp = await client.get(f"/api/queue{query}", headers=auth(token))
        assert resp.status_code == 200, resp.text
        return {item["id"] for item in resp.json()}

    assert await ids() == {pending["id"], approved["id"], other["id"]}
    assert await ids(f"?product_id={one['id']}") == {pending["id"], approved["id"]}
    assert await ids("?status=pending") == {pending["id"], other["id"]}
    assert await ids(f"?product_id={one['id']}&status=approved") == {approved["id"]}


async def test_get_queue_item(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "blog", content={"title": "Hello"})
    resp = await client.get(f"/api/queue/{item['id']}", headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["content"] == {"title": "Hello"}
    assert (await client.get(f"/api/queue/{uuid.uuid4()}", headers=auth(token))).status_code == 404


async def test_review_queue_item(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "blog")
    path = f"/api/queue/{item['id']}"

    resp = await client.patch(path, headers=auth(token), json={"status": "approved", "notes": "Looks good"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"
    assert resp.json()["notes"] == "Looks good"

    resp = await client.patch(path, headers=auth(token), json={"status": "rejected"})
    assert resp.json()["status"] == "rejected"
    assert (await client.get(path, headers=auth(token))).json()["status"] == "rejected"
    assert (await client.patch(path, headers=auth(token), json={"status": "bogus"})).status_code == 422


async def test_delete_queue_item(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product)
    path = f"/api/queue/{item['id']}"
    resp = await client.delete(path, headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"deleted": True}
    assert (await client.get(path, headers=auth(token))).status_code == 404
    assert (await client.delete(path, headers=auth(token))).status_code == 404


async def test_approving_non_email_workflow_creates_no_drafts(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "blog", content={"full_content": "Write to press@acme.example"})
    await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    assert (await client.get("/api/email-queue", headers=auth(token))).json() == []


async def test_rejecting_email_workflow_creates_no_drafts(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "partnerships", content={
        "partnerships": [{"name": "Acme Audio", "type": "integration", "email": "partners@acme.example"}],
    })
    await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "rejected"})
    assert (await client.get("/api/email-queue", headers=auth(token))).json() == []


async def test_drafts_exist_by_the_time_the_approval_is_answered(
    client, register, auth, create_product, make_queue_item, monkeypatch,
):
    # Work left to run after the response is lost if the process stops at that moment, so approving
    # mustn't leave drafts to it. Here nothing left for after the response ever runs.
    monkeypatch.setattr(fastapi.BackgroundTasks, "add_task", lambda self, *args, **kwargs: None)
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "partnerships", content={
        "partnerships": [{"name": "Acme Audio", "email": "partners@acme.example"}],
    })

    resp = await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})

    assert resp.status_code == 200, resp.text
    drafts = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert [draft["recipient_email"] for draft in drafts] == ["partners@acme.example"]


async def test_approving_partnerships_extracts_contact_drafts(
    client, register, auth, create_product, make_queue_item,
):
    token, user = await register()
    product = await create_product(token, name="Launch Ops")
    item = await make_queue_item(user, product, "partnerships", content={
        "partnerships": [{
            "name": "Acme Audio", "type": "integration",
            "email": "partners@acme.example", "rationale": "Shared audience",
        }],
    })
    resp = await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    assert resp.status_code == 200, resp.text

    drafts = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert len(drafts) == 1
    draft = drafts[0]
    assert draft["recipient_email"] == "partners@acme.example"
    assert draft["recipient_name"] == "Acme Audio"
    assert draft["subject"] == "Regarding Launch Ops"
    assert "partnership" in draft["body"]
    assert draft["status"] == "pending"
    assert draft["source_queue_id"] == item["id"]
    assert draft["product_id"] == product["id"]


async def test_approving_a_saved_press_targets_result_still_creates_drafts(
    client, register, auth, create_product, make_queue_item,
):
    # F-14: the workflow is retired, but its stored results remain reviewable
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "press_targets", content={
        "targets": [{"name": "Synth Weekly", "email": "tips@synth.example"}],
    })
    await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    drafts = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert [(d["recipient_email"], d["recipient_name"]) for d in drafts] == [("tips@synth.example", "Synth Weekly")]


def test_retired_press_targets_workflow_cannot_run():
    from services.claude import WORKFLOW_PROMPTS

    assert "press_targets" not in WORKFLOW_PROMPTS


async def test_approving_cold_outreach_uses_drafted_subject_and_body(
    client, register, auth, create_product, make_queue_item,
):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "cold_outreach", content={
        "emails": [{
            "subject": "Quick question about your show", "body": "Hi Sam, loved episode 12.",
            "target_type": "podcast", "email": "sam@podcast.example",
        }],
    })
    await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    drafts = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert [(d["recipient_email"], d["subject"], d["body"]) for d in drafts] == [
        ("sam@podcast.example", "Quick question about your show", "Hi Sam, loved episode 12."),
    ]


# ─── Baseline: email queue ───


async def test_list_email_queue_with_filters(client, register, auth, create_product, make_email):
    token, user = await register()
    one = await create_product(token, name="One")
    two = await create_product(token, name="Two")
    first = await make_email(user, one)
    sent = await make_email(user, one, status="sent")
    other = await make_email(user, two)

    async def ids(query=""):
        resp = await client.get(f"/api/email-queue{query}", headers=auth(token))
        assert resp.status_code == 200, resp.text
        return {e["id"] for e in resp.json()}

    assert await ids() == {first["id"], sent["id"], other["id"]}
    assert await ids(f"?product_id={one['id']}") == {first["id"], sent["id"]}
    assert await ids("?status=pending") == {first["id"], other["id"]}


async def test_send_email_requires_smtp_settings(client, register, auth, create_product, make_email, fake_smtp):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product)
    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert resp.status_code == 400
    assert "SMTP not configured" in resp.json()["detail"]
    assert fake_smtp.calls == []


async def test_send_email_already_sent_is_rejected(client, register, auth, create_product, make_email, fake_smtp):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product, status="sent")
    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json() == {"detail": "Email already sent"}
    assert fake_smtp.calls == []


async def test_send_email_success_marks_sent(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"email_settings": smtp_config})
    email = await make_email(user, product, recipient_name="Jane Doe", recipient_email="jane@example.com",
                             subject="Launch news", body="Body text")

    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "sent"}
    [call] = fake_smtp.calls
    assert (call.to_email, call.to_name, call.subject, call.body) == (
        "jane@example.com", "Jane Doe", "Launch news", "Body text",
    )
    assert call.smtp_settings["smtp_host"] == "smtp.example.com"
    [row] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert row["status"] == "sent"
    assert row["sent_at"]


async def test_send_email_failure_marks_failed(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"email_settings": smtp_config})
    email = await make_email(user, product)
    fake_smtp.result = {"success": False, "error": "535 Authentication failed"}

    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    # The email server refused it: a bad gateway, not a LaunchOps fault
    assert resp.status_code == 502
    assert resp.json() == {"detail": "Send failed: 535 Authentication failed"}
    [row] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert row["status"] == "failed"
    assert row["error"] == "535 Authentication failed"


async def test_delete_email(client, register, auth, create_product, make_email):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product)
    resp = await client.delete(f"/api/email-queue/{email['id']}", headers=auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"deleted": True}
    assert (await client.get("/api/email-queue", headers=auth(token))).json() == []
    assert (await client.delete(f"/api/email-queue/{email['id']}", headers=auth(token))).status_code == 404


# ─── B3: approving a queue item never sends email ───

OUTREACH = {"emails": [
    {"subject": "Hello Sam", "body": "Hi Sam", "target_type": "podcast", "email": "sam@podcast.example"},
    {"subject": "Hello Kim", "body": "Hi Kim", "target_type": "press", "email": "kim@press.example"},
]}


async def _configure_smtp(client, headers, product, smtp_config):
    resp = await client.patch(f"/api/products/{product['id']}", headers=headers, json={"email_settings": smtp_config})
    assert resp.status_code == 200, resp.text


async def test_approval_creates_drafts_but_never_sends(
    client, register, auth, create_product, make_queue_item, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    await _configure_smtp(client, auth(token), product, smtp_config)
    item = await make_queue_item(user, product, "cold_outreach", content=OUTREACH)

    resp = await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    assert resp.status_code == 200, resp.text

    assert fake_smtp.calls == []
    drafts = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert sorted(d["recipient_email"] for d in drafts) == ["kim@press.example", "sam@podcast.example"]
    assert {d["status"] for d in drafts} == {"pending"}
    assert {d["source_queue_id"] for d in drafts} == {item["id"]}


async def test_reapproval_does_not_duplicate_drafts(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    item = await make_queue_item(user, product, "cold_outreach", content=OUTREACH)
    for status in ["approved", "rejected", "approved"]:
        resp = await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": status})
        assert resp.status_code == 200, resp.text
    assert len((await client.get("/api/email-queue", headers=auth(token))).json()) == 2


async def test_announcement_draft_body_is_the_email_version(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token, name="Launch Ops")
    email_version = "Launch Ops is live.\n\nToday we launched the ops desk for creative software teams."
    item = await make_queue_item(user, product, "announcement", content={
        "email_version": email_version,
        "blog_version": "A long blog post",
        "press_release_version": "Media contact: Jane Doe, jane@studio.example",
    })
    await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    [draft] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert draft["recipient_email"] == "jane@studio.example"
    assert draft["body"] == email_version


async def test_announcement_without_email_version_string_keeps_fallback_body(
    client, register, auth, create_product, make_queue_item,
):
    token, user = await register()
    product = await create_product(token, name="Launch Ops")
    item = await make_queue_item(user, product, "announcement", content={
        "email_version": {"subject": "Not a string"},
        "press_release_version": "Media contact: Jane Doe, jane@studio.example",
    })
    await client.patch(f"/api/queue/{item['id']}", headers=auth(token), json={"status": "approved"})
    [draft] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert draft["body"].startswith("Hi Jane Doe,")
    assert "exciting news about Launch Ops" in draft["body"]


async def test_send_runs_smtp_off_the_event_loop_thread(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config,
):
    token, user = await register()
    product = await create_product(token)
    await _configure_smtp(client, auth(token), product, smtp_config)
    email = await make_email(user, product)
    resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
    assert resp.status_code == 200, resp.text
    [call] = fake_smtp.calls
    assert call.thread != fake_smtp.main_thread


# ─── B4: editable email drafts ───


async def test_edit_email_draft(client, register, auth, create_product, make_email):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product, recipient_name="Jane Doe", recipient_email="jane@example.com",
                             subject="Hello", body="Hi Jane")
    path = f"/api/email-queue/{email['id']}"

    resp = await client.patch(path, headers=auth(token), json={"subject": "Launch news", "body": "Hi Jane, big news."})
    assert resp.status_code == 200, resp.text
    edited = resp.json()
    assert (edited["subject"], edited["body"]) == ("Launch news", "Hi Jane, big news.")
    assert (edited["recipient_name"], edited["recipient_email"], edited["status"]) == (
        "Jane Doe", "jane@example.com", "pending",
    )

    resp = await client.patch(path, headers=auth(token), json={
        "recipient_name": "Janet Roe", "recipient_email": "janet@example.org", "subject": None,
    })
    assert resp.status_code == 200, resp.text
    [row] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert (row["recipient_name"], row["recipient_email"], row["subject"], row["body"]) == (
        "Janet Roe", "janet@example.org", "Launch news", "Hi Jane, big news.",
    )


async def test_edit_email_draft_rejects_invalid_recipient(client, register, auth, create_product, make_email):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product)
    path = f"/api/email-queue/{email['id']}"
    for bad in ["", "janet", "janet@", "@example.org", "janet@@example.org", "a@b@example.org", "janet@example"]:
        resp = await client.patch(path, headers=auth(token), json={"recipient_email": bad})
        assert resp.status_code == 422, (bad, resp.text)
    [row] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert row["recipient_email"] == "jane@example.com"


async def test_edit_sent_email_is_a_conflict(client, register, auth, create_product, make_email):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product, status="sent")
    resp = await client.patch(f"/api/email-queue/{email['id']}", headers=auth(token), json={"subject": "Too late"})
    assert resp.status_code == 409, resp.text
    assert resp.json() == {"detail": "Email already sent"}
    [row] = (await client.get("/api/email-queue", headers=auth(token))).json()
    assert row["subject"] == "Hello"


async def test_edit_failed_email_resets_it_to_pending(client, register, auth, create_product, make_email):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product, status="failed", error="535 Authentication failed")
    resp = await client.patch(f"/api/email-queue/{email['id']}", headers=auth(token), json={"body": "Fixed body"})
    assert resp.status_code == 200, resp.text
    assert (resp.json()["status"], resp.json()["error"], resp.json()["body"]) == ("pending", "", "Fixed body")


async def test_empty_email_edit_changes_nothing(client, register, auth, create_product, make_email):
    token, user = await register()
    product = await create_product(token)
    email = await make_email(user, product, status="failed", error="535 Authentication failed")
    for body in [{}, {"subject": None, "body": None}]:
        resp = await client.patch(f"/api/email-queue/{email['id']}", headers=auth(token), json=body)
        assert resp.status_code == 200, resp.text
        assert (resp.json()["status"], resp.json()["error"], resp.json()["subject"]) == (
            "failed", "535 Authentication failed", "Hello",
        )


async def test_edit_email_that_is_missing_or_not_owned(client, register, auth, create_product, make_email):
    alice_token, alice = await register()
    bob_token, _ = await register()
    product = await create_product(alice_token)
    email = await make_email(alice, product)

    missing = await client.patch(f"/api/email-queue/{uuid.uuid4()}", headers=auth(alice_token), json={"subject": "x"})
    assert missing.status_code == 404, missing.text
    foreign = await client.patch(f"/api/email-queue/{email['id']}", headers=auth(bob_token), json={"subject": "Mine"})
    assert foreign.status_code == 404, foreign.text
    [row] = (await client.get("/api/email-queue", headers=auth(alice_token))).json()
    assert row["subject"] == "Hello"


# ─── B15: queue list limit ───


async def test_queue_list_limit(client, register, auth, create_product, make_queue_item):
    token, user = await register()
    product = await create_product(token)
    for _ in range(3):
        await make_queue_item(user, product)
    assert len((await client.get("/api/queue?limit=2", headers=auth(token))).json()) == 2
    assert len((await client.get("/api/queue", headers=auth(token))).json()) == 3
    for limit in (0, 501):
        resp = await client.get(f"/api/queue?limit={limit}", headers=auth(token))
        assert resp.status_code == 422, (limit, resp.text)
    assert (await client.get("/api/queue?limit=500", headers=auth(token))).status_code == 200


# ─── F-3: a daily sending limit per account ───


async def test_sending_stops_at_the_daily_limit(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config, monkeypatch,
):
    monkeypatch.setattr(config.get_settings(), "max_emails_per_day", 2)
    token, user = await register()
    product = await create_product(token)
    await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"email_settings": smtp_config})
    emails = [await make_email(user, product, recipient_email=f"r{n}@example.com") for n in range(3)]

    for email in emails[:2]:
        resp = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))
        assert resp.status_code == 200, resp.text
    blocked = await client.post(f"/api/email-queue/{emails[2]['id']}/send", headers=auth(token))

    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["detail"] == (
        "You've sent 2 emails in the last 24 hours, which is the daily limit. Try again in 24 hours."
    )
    assert 23 * 3600 < int(blocked.headers["retry-after"]) <= 24 * 3600
    assert len(fake_smtp.calls) == 2
    assert (await client.get("/api/email-queue", headers=auth(token))).json()[0]["status"] in {"pending", "sent"}
    row = next(e for e in (await client.get("/api/email-queue", headers=auth(token))).json() if e["id"] == emails[2]["id"])
    assert row["status"] == "pending"


async def test_a_daily_limit_of_zero_says_sending_is_switched_off(
    client, register, auth, create_product, make_email, fake_smtp, smtp_config, monkeypatch,
):
    monkeypatch.setattr(config.get_settings(), "max_emails_per_day", 0)
    token, user = await register()
    product = await create_product(token)
    await client.patch(f"/api/products/{product['id']}", headers=auth(token), json={"email_settings": smtp_config})
    email = await make_email(user, product)

    blocked = await client.post(f"/api/email-queue/{email['id']}/send", headers=auth(token))

    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["detail"] == (
        "Sending email is switched off on this server: its daily limit is 0. Ask the administrator to raise MAX_EMAILS_PER_DAY."
    )
    # Waiting won't help, so there's no time to retry after
    assert "retry-after" not in blocked.headers
    assert fake_smtp.calls == []
    quota = (await client.get("/api/email-queue/quota", headers=auth(token))).json()
    assert quota == {"limit": 0, "sent": 0, "remaining": 0, "next_available_at": None}


async def test_quota_counts_this_accounts_sends_in_the_last_24_hours(
    client, register, auth, create_product, make_email, monkeypatch,
):
    monkeypatch.setattr(config.get_settings(), "max_emails_per_day", 3)
    token, user = await register()
    other_token, other_user = await register()
    product = await create_product(token)
    other_product = await create_product(other_token)
    now = datetime.now(UTC)

    await make_email(user, product, status="sent", sent_at=(now - timedelta(hours=25)).isoformat())  # too old
    oldest_counted = now - timedelta(hours=20)
    await make_email(user, product, status="sent", sent_at=oldest_counted.isoformat())
    await make_email(user, product, status="failed")  # not sent
    await make_email(other_user, other_product, status="sent", sent_at=now.isoformat())  # someone else

    quota = (await client.get("/api/email-queue/quota", headers=auth(token))).json()
    assert quota == {"limit": 3, "sent": 1, "remaining": 2, "next_available_at": None}

    await make_email(user, product, status="sent", sent_at=(now - timedelta(hours=2)).isoformat())
    await make_email(user, product, status="sent", sent_at=(now - timedelta(hours=1)).isoformat())
    full = (await client.get("/api/email-queue/quota", headers=auth(token))).json()
    assert (full["sent"], full["remaining"]) == (3, 0)
    # A slot frees up 24 hours after the oldest send in the window
    freed = datetime.fromisoformat(full["next_available_at"])
    assert abs(freed - (oldest_counted + timedelta(hours=24))) < timedelta(seconds=1)

