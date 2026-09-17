"""Edge cases of the job queue (services/jobs.py) and live updates (services/events.py)."""

import asyncio
import json
import logging
from datetime import timedelta

import pytest

import database
from services import events, jobs


@pytest.fixture
async def queued(client, register, auth, create_product):
    """await queued() → (queue item id, headers): an operation waiting for a worker."""
    token, _ = await register("ana@example.com")
    headers = auth(token)
    product = await create_product(token)

    async def _queued():
        resp = await client.post("/api/workflows/launch", headers=headers, json={"product_id": product["id"], "workflow_id": "trend"})
        assert resp.status_code == 200, resp.text
        return resp.json()["task_id"], headers

    return _queued


async def _job(queue_id):
    pool = await database.get_pool()
    return dict(await pool.fetchrow("SELECT * FROM jobs WHERE queue_id = $1", queue_id))


async def _item(client, headers, queue_id):
    return (await client.get(f"/api/queue/{queue_id}", headers=headers)).json()


@pytest.mark.parametrize(("delay", "words"), [
    (timedelta(seconds=1), "1 second"),
    (timedelta(seconds=45), "45 seconds"),
    (timedelta(minutes=1), "1 minute"),
    (timedelta(seconds=150), "2 minutes"),
])
def test_retry_delays_read_naturally(delay, words):
    assert jobs.describe_delay(delay) == words


async def test_a_job_cancelled_while_its_worker_was_gone_ends_when_claimed(client, queued, fake_ai, run_jobs):
    queue_id, headers = await queued()
    await jobs.claim("gone-worker")
    assert (await client.post(f"/api/queue/{queue_id}/cancel", headers=headers)).status_code == 202
    pool = await database.get_pool()
    await pool.execute("UPDATE jobs SET locked_until = NOW() - interval '1 second'")

    assert await run_jobs() == 1

    assert fake_ai.calls == []
    assert (await _job(queue_id))["status"] == "cancelled"
    assert (await _item(client, headers, queue_id))["content"] == {"error": "Cancelled by ana@example.com."}


async def test_a_job_whose_last_attempt_stopped_responding_fails(client, queued, fake_ai, run_jobs):
    queue_id, headers = await queued()
    pool = await database.get_pool()
    await pool.execute(
        "UPDATE jobs SET status = 'running', attempts = max_attempts, locked_by = 'gone', locked_until = NOW() - interval '1 second'",
    )

    assert await run_jobs() == 1

    assert fake_ai.calls == []
    job = await _job(queue_id)
    assert (job["status"], job["last_error"]) == ("failed", "The operation stopped responding and was stopped. Try again.")
    assert (await _item(client, headers, queue_id))["status"] == "failed"


async def test_a_worker_that_lost_its_lease_leaves_the_job_to_the_new_holder(client, queued, fake_ai, monkeypatch):
    monkeypatch.setattr(jobs, "HEARTBEAT_SECONDS", 0.02)
    fake_ai.delay = 30
    queue_id, _ = await queued()
    job = await jobs.claim("slow-worker")
    running = asyncio.create_task(jobs.execute(job, "slow-worker"))
    for _ in range(200):
        if fake_ai.calls:
            break
        await asyncio.sleep(0.01)
    pool = await database.get_pool()
    await pool.execute("UPDATE jobs SET locked_by = 'new-holder'")

    await asyncio.wait_for(running, timeout=5)

    stored = await _job(queue_id)
    assert (stored["status"], stored["locked_by"]) == ("running", "new-holder"), "untouched by the worker that lost it"


async def test_the_heartbeat_rides_out_a_database_blip(client, queued, fake_ai, run_jobs, monkeypatch):
    monkeypatch.setattr(jobs, "HEARTBEAT_SECONDS", 0.01)
    fake_ai.delay = 0.2
    fake_ai.response = {"trends": []}
    queue_id, headers = await queued()
    real_get_pool = database.get_pool
    blips = {"left": 3}

    async def flaky_pool():
        pool = await real_get_pool()

        class Flaky:
            def __getattr__(self, name):
                return getattr(pool, name)

            async def fetchval(self, *args):
                if blips["left"]:
                    blips["left"] -= 1
                    raise ConnectionResetError("connection reset")
                return await pool.fetchval(*args)

        return Flaky()

    monkeypatch.setattr(jobs, "get_pool", lambda: flaky_pool() if blips["left"] else real_get_pool())

    assert await run_jobs() == 1
    assert (await _item(client, headers, queue_id))["status"] == "pending"


async def test_a_worker_stops_a_cancelled_job_as_soon_as_it_hears(client, queued, fake_ai, monkeypatch):
    monkeypatch.setattr(jobs, "HEARTBEAT_SECONDS", 60)  # far off: the notification does it
    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.05)
    fake_ai.delay = 30
    queue_id, headers = await queued()
    worker = jobs.Worker(concurrency=1)
    await worker.start()
    try:
        for _ in range(300):
            if fake_ai.calls:
                break
            await asyncio.sleep(0.01)
        assert (await client.post(f"/api/queue/{queue_id}/cancel", headers=headers)).status_code == 202
        for _ in range(300):
            if (await _job(queue_id))["status"] == "cancelled":
                break
            await asyncio.sleep(0.01)
    finally:
        await worker.stop()

    assert (await _job(queue_id))["status"] == "cancelled"


async def test_a_worker_that_cant_listen_still_polls(client, queued, fake_ai, monkeypatch, caplog):
    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.05)
    fake_ai.response = {"trends": []}

    async def refuse(*args, **kwargs):
        raise ConnectionRefusedError("no listening today")

    monkeypatch.setattr(jobs.asyncpg, "connect", refuse)
    queue_id, headers = await queued()
    worker = jobs.Worker(concurrency=1)
    await worker.start()
    try:
        for _ in range(300):
            if (await _item(client, headers, queue_id))["status"] == "pending":
                break
            await asyncio.sleep(0.02)
    finally:
        await worker.stop()

    assert "couldn't listen for new jobs" in caplog.text
    assert (await _item(client, headers, queue_id))["status"] == "pending"


async def test_a_worker_keeps_going_through_a_database_outage(client, queued, fake_ai, monkeypatch, caplog):
    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.02)
    fake_ai.response = {"trends": []}
    real_claim = jobs.claim
    outage = {"left": 2}

    async def claim_during_outage(worker_id):
        if outage["left"]:
            outage["left"] -= 1
            raise ConnectionRefusedError("database restarting")
        return await real_claim(worker_id)

    monkeypatch.setattr(jobs, "claim", claim_during_outage)
    queue_id, headers = await queued()
    worker = jobs.Worker(concurrency=1)
    await worker.start()
    try:
        for _ in range(300):
            if (await _item(client, headers, queue_id))["status"] == "pending":
                break
            await asyncio.sleep(0.02)
    finally:
        await worker.stop()

    assert "can't reach the database" in caplog.text
    assert (await _item(client, headers, queue_id))["status"] == "pending"


async def test_releasing_a_job_during_an_outage_leaves_it_to_its_lease(client, queued, monkeypatch):
    queue_id, _ = await queued()
    job = await jobs.claim("stopping-worker")

    async def unreachable(*args, **kwargs):
        raise ConnectionRefusedError("database gone")

    monkeypatch.setattr(jobs, "_update", unreachable)
    await jobs._release(job, "stopping-worker")  # doesn't raise

    assert (await _job(queue_id))["locked_by"] == "stopping-worker"


# ─── Live updates ───


async def test_publishing_without_an_organisation_does_nothing(client, monkeypatch):
    async def unexpected():
        raise AssertionError("nothing to publish")

    monkeypatch.setattr(events, "get_pool", unexpected)
    await events.publish(None, "queue", "item", "pending")


async def test_a_publish_that_cant_reach_the_database_is_logged_not_raised(client, monkeypatch, caplog):
    caplog.set_level(logging.WARNING)

    async def unreachable():
        raise ConnectionRefusedError("database gone")

    monkeypatch.setattr(events, "get_pool", unreachable)
    await events.publish("00000000-0000-4000-8000-000000000000", "queue", "item", "pending")

    assert "Couldn't publish a live update (queue pending)" in caplog.text


def test_a_subscriber_that_stops_reading_misses_events_instead_of_blocking_others(monkeypatch):
    hub = events.Hub()
    slow: asyncio.Queue = asyncio.Queue(maxsize=1)
    quick: asyncio.Queue = asyncio.Queue(maxsize=10)
    hub._subscribers["org-1"] = {slow, quick}

    for n in range(3):
        hub._deliver(None, 0, events.CHANNEL, json.dumps({"org_id": "org-1", "type": "queue", "id": str(n), "status": "pending"}))
    hub._deliver(None, 0, events.CHANNEL, "not json")

    assert slow.qsize() == 1
    assert quick.qsize() == 3
