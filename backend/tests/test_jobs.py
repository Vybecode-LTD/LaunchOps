"""Durable background jobs (docs/PHASE1_DESIGN.md D9): operations run from a job queue in PostgreSQL.

`run_jobs` runs every ready job the way the worker does. Claude is faked (`fake_ai`).
"""

import asyncio
from datetime import timedelta

import pytest

import config
import database
import main
from services import jobs
from services.claude import AIError, AIIncomplete, AIRefused, AIRejected, AIUnavailable

PROVIDER_ERROR = "The AI provider returned an error (HTTP 529). Try again in a few minutes."


@pytest.fixture
async def launch(client, register, auth, create_product):
    """await launch(workflow="trend") → the queue item id of a new operation on Ana's project."""
    token, user = await register("ana@example.com")
    headers = auth(token)
    product = await create_product(token, name="Launch Ops")

    async def _launch(workflow: str = "trend", instructions: str = "") -> str:
        resp = await client.post("/api/workflows/launch", headers=headers, json={
            "product_id": product["id"], "workflow_id": workflow, "instructions": instructions,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()["task_id"]

    _launch.headers = headers
    _launch.user = user
    return _launch


async def _job(queue_id: str) -> dict:
    pool = await database.get_pool()
    row = await pool.fetchrow("SELECT * FROM jobs WHERE queue_id = $1", queue_id)
    assert row, "no job for this operation"
    return dict(row)


async def _item(client, headers, queue_id: str) -> dict:
    return (await client.get(f"/api/queue/{queue_id}", headers=headers)).json()


async def test_launching_queues_a_job_that_the_worker_runs(client, launch, fake_ai, run_jobs):
    fake_ai.response = {"trends": [{"name": "AI mastering"}]}

    queue_id = await launch(instructions="Focus on Europe")

    assert (await _item(client, launch.headers, queue_id))["status"] == "running"
    job = await _job(queue_id)
    assert (job["status"], job["attempts"], job["kind"]) == ("queued", 0, "workflow")
    assert fake_ai.calls == [], "nothing runs inside the request"

    assert await run_jobs() == 1

    item = await _item(client, launch.headers, queue_id)
    assert (item["status"], item["preview"]) == ("pending", "Found 1 trends in the market")
    assert "Focus on Europe" in fake_ai.calls[0].user_message
    job = await _job(queue_id)
    assert (job["status"], job["attempts"], job["locked_by"]) == ("succeeded", 1, None)
    assert job["finished_at"] is not None


async def test_a_job_whose_worker_stopped_is_run_again_when_its_lease_runs_out(client, launch, fake_ai, run_jobs):
    fake_ai.response = {"trends": []}
    queue_id = await launch()

    claimed = await jobs.claim("a-worker-that-crashes")
    assert (claimed["attempts"], claimed["locked_by"]) == (1, "a-worker-that-crashes")
    assert await run_jobs() == 0, "the lease still holds"

    pool = await database.get_pool()
    await pool.execute("UPDATE jobs SET locked_until = NOW() - interval '1 second' WHERE queue_id = $1", queue_id)
    assert await run_jobs() == 1

    job = await _job(queue_id)
    assert (job["status"], job["attempts"]) == ("succeeded", 2)
    assert (await _item(client, launch.headers, queue_id))["status"] == "pending"


async def test_temporary_ai_failures_are_retried_and_then_reported(client, launch, fake_ai, run_jobs, monkeypatch):
    monkeypatch.setattr(jobs, "RETRY_DELAYS", [timedelta(0)])
    fake_ai.response = AIError(PROVIDER_ERROR)
    queue_id = await launch()

    await run_jobs()

    assert len(fake_ai.calls) == jobs.MAX_ATTEMPTS
    job = await _job(queue_id)
    assert (job["status"], job["attempts"], job["last_error"]) == ("failed", jobs.MAX_ATTEMPTS, PROVIDER_ERROR)
    item = await _item(client, launch.headers, queue_id)
    assert (item["status"], item["content"], item["preview"]) == ("failed", {"error": PROVIDER_ERROR}, f"Failed: {PROVIDER_ERROR}")


async def test_a_retry_waits_and_shows_why_then_delivers_the_result(client, launch, fake_ai, run_jobs):
    fake_ai.responses = [AIError(PROVIDER_ERROR), {"trends": [{"name": "Plugins"}]}]
    queue_id = await launch()

    assert await run_jobs() == 1
    waiting = await _item(client, launch.headers, queue_id)
    assert waiting["status"] == "running"
    assert waiting["preview"] == f"Trying again in 30 seconds: {PROVIDER_ERROR}"
    assert await run_jobs() == 0, "not before the delay"

    pool = await database.get_pool()
    await pool.execute("UPDATE jobs SET run_after = NOW() WHERE queue_id = $1", queue_id)
    assert await run_jobs() == 1
    assert (await _item(client, launch.headers, queue_id))["preview"] == "Found 1 trends in the market"


@pytest.mark.parametrize("error", [
    AIRefused("The AI declined this request. Change the instructions or the project details and try again."),
    AIUnavailable("The AI service isn't available: ANTHROPIC_API_KEY not configured"),
    AIRejected("The AI provider rejected the request (HTTP 400): tools.1.input_schema: unsupported keyword"),
    AIIncomplete("The AI's answer was too long and was cut off. Try again with narrower instructions."),
])
async def test_failures_that_wont_change_on_a_retry_are_reported_at_once(client, launch, fake_ai, run_jobs, error):
    fake_ai.response = error
    queue_id = await launch()

    await run_jobs()

    assert len(fake_ai.calls) == 1
    assert ((await _job(queue_id))["status"], (await _item(client, launch.headers, queue_id))["content"]) == ("failed", {"error": str(error)})


async def test_cancelling_an_operation_that_hasnt_started(client, launch, fake_ai, run_jobs):
    queue_id = await launch()

    resp = await client.post(f"/api/queue/{queue_id}/cancel", headers=launch.headers)

    assert (resp.status_code, resp.json()) == (200, {"status": "cancelled"})
    assert await run_jobs() == 0
    assert fake_ai.calls == []
    assert (await _job(queue_id))["status"] == "cancelled"
    item = await _item(client, launch.headers, queue_id)
    assert (item["status"], item["content"]) == ("failed", {"error": "Cancelled by ana@example.com."})
    again = await client.post(f"/api/queue/{queue_id}/cancel", headers=launch.headers)
    assert (again.status_code, again.json()) == (409, {"detail": "This operation has already finished."})


async def test_cancelling_a_running_operation_stops_it(client, launch, fake_ai, monkeypatch):
    monkeypatch.setattr(jobs, "HEARTBEAT_SECONDS", 0.02)
    fake_ai.delay = 30
    queue_id = await launch()
    worker = asyncio.create_task(jobs.drain("worker-1"))
    for _ in range(200):
        if fake_ai.calls:
            break
        await asyncio.sleep(0.01)

    resp = await client.post(f"/api/queue/{queue_id}/cancel", headers=launch.headers)
    await asyncio.wait_for(worker, timeout=5)

    assert (resp.status_code, resp.json()) == (202, {"status": "cancelling"})
    assert (await _job(queue_id))["status"] == "cancelled"
    item = await _item(client, launch.headers, queue_id)
    assert (item["status"], item["content"]) == ("failed", {"error": "Cancelled by ana@example.com."})


async def test_an_operation_that_runs_too_long_is_stopped(client, launch, fake_ai, run_jobs, monkeypatch):
    monkeypatch.setattr(config.get_settings(), "job_timeout_minutes", 0.001)
    fake_ai.delay = 30
    queue_id = await launch()

    await run_jobs()

    job = await _job(queue_id)
    assert (job["status"], job["attempts"]) == ("failed", 1)
    assert job["last_error"].startswith("The operation took longer than 0.001 minutes and was stopped.")


async def test_only_the_organisations_editors_can_cancel(client, launch, register, auth):
    queue_id = await launch()
    outsider_token, _ = await register("oscar@example.com")

    outsider = await client.post(f"/api/queue/{queue_id}/cancel", headers=auth(outsider_token))
    unknown = await client.post("/api/queue/00000000-0000-4000-8000-000000000000/cancel", headers=launch.headers)

    assert (outsider.status_code, unknown.status_code) == (404, 404)
    assert (await _job(queue_id))["status"] == "queued"


async def test_a_restart_leaves_queued_operations_for_the_worker(client, launch, make_queue_item, create_product, fake_ai, run_jobs):
    fake_ai.response = {"trends": []}
    queue_id = await launch()
    products = (await client.get("/api/products", headers=launch.headers)).json()
    legacy = await make_queue_item(launch.user, products[0], workflow_id="blog", status="running")

    async with main.lifespan(main.app):
        pass

    assert (await _item(client, launch.headers, queue_id))["status"] == "running"
    assert (await _item(client, launch.headers, legacy["id"]))["status"] == "failed", "no job can finish it"
    assert await run_jobs() == 1
    assert (await _item(client, launch.headers, queue_id))["status"] == "pending"


async def test_the_worker_runs_operations_in_the_background(client, launch, fake_ai, monkeypatch):
    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.05)
    fake_ai.response = {"trends": [{"name": "Live"}]}
    worker = jobs.Worker(concurrency=2)
    await worker.start()
    try:
        queue_id = await launch()
        for _ in range(300):
            if (await _item(client, launch.headers, queue_id))["status"] == "pending":
                break
            await asyncio.sleep(0.02)
    finally:
        await worker.stop()

    assert (await _item(client, launch.headers, queue_id))["preview"] == "Found 1 trends in the market"


async def test_stopping_the_worker_hands_unfinished_jobs_back(client, launch, fake_ai, run_jobs, monkeypatch):
    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.05)
    fake_ai.delay = 30
    queue_id = await launch()
    worker = jobs.Worker(concurrency=1)
    await worker.start()
    for _ in range(300):
        if fake_ai.calls:
            break
        await asyncio.sleep(0.01)

    await worker.stop()

    job = await _job(queue_id)
    assert (job["status"], job["attempts"], job["locked_by"]) == ("queued", 0, None), "the unfinished attempt doesn't count"
    fake_ai.delay = 0
    fake_ai.response = {"trends": []}
    assert await run_jobs() == 1


async def test_the_standalone_worker_runs_jobs_until_told_to_stop(client, launch, fake_ai, monkeypatch):
    import worker

    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.05)
    fake_ai.response = {"trends": [{"name": "Standalone"}]}
    queue_id = await launch()
    stop = asyncio.Event()
    running = asyncio.create_task(worker.main(stop))
    for _ in range(300):
        if (await _item(client, launch.headers, queue_id))["status"] == "pending":
            break
        await asyncio.sleep(0.02)

    stop.set()
    await asyncio.wait_for(running, timeout=5)

    assert (await _item(client, launch.headers, queue_id))["preview"] == "Found 1 trends in the market"
