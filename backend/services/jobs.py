"""Durable background jobs in PostgreSQL (docs/PHASE1_DESIGN.md D9).

- enqueue() adds a job in the caller's transaction and wakes the workers (NOTIFY).
- A Worker claims ready jobs (FOR UPDATE SKIP LOCKED) up to its concurrency, and holds each under a
  lease its heartbeat renews. A worker that stops without finishing lets the lease run out, and any
  worker then claims the job again.
- Failures a retry can fix are retried after RETRY_DELAYS, up to MAX_ATTEMPTS; others are reported at once.
- Cancelling a queued job ends it at once; a running job stops at its next heartbeat.
- A job that runs longer than JOB_TIMEOUT_MINUTES is stopped.

Each kind of job registers what to run and how to report the outcome where people see it (register()).
"""

import asyncio
import logging
import os
import socket
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import timedelta

import asyncpg

from config import get_settings
from database import DATABASE_UNAVAILABLE_ERRORS, _ssl_arg, get_pool

logger = logging.getLogger(__name__)

LEASE = timedelta(seconds=60)
HEARTBEAT_SECONDS = 20.0
POLL_SECONDS = 5.0
MAX_ATTEMPTS = 3
# The wait before each retry; the last one repeats if there are more attempts than delays
RETRY_DELAYS = [timedelta(seconds=30), timedelta(minutes=2)]
CHANNEL = "launchops_jobs"


@dataclass(frozen=True)
class JobKind:
    run: Callable[[dict], Awaitable[None]]
    #: The job gave up: record the reason where people will see it
    failed: Callable[[dict, str], Awaitable[None]]
    #: The job will try again after the delay
    retrying: Callable[[dict, str, timedelta], Awaitable[None]]
    #: Someone cancelled the job
    cancelled: Callable[[dict, str], Awaitable[None]]
    #: Whether a retry might succeed where this error failed
    should_retry: Callable[[BaseException], bool]


KINDS: dict[str, JobKind] = {}


def register(kind: str, job_kind: JobKind) -> None:
    KINDS[kind] = job_kind


def describe_delay(delay: timedelta) -> str:
    seconds = int(delay.total_seconds())
    if seconds < 60:
        return f"{seconds} second{'s' if seconds != 1 else ''}"
    minutes = round(seconds / 60)
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


async def enqueue(conn, *, kind: str, payload: dict, org_id: str, user_id: str, queue_id: str) -> str:
    """Add a job (inside the caller's transaction, so it exists only if the rest is saved) and wake the workers."""
    job_id = await conn.fetchval(
        "INSERT INTO jobs (org_id, user_id, queue_id, kind, payload, max_attempts) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        uuid.UUID(org_id), uuid.UUID(user_id), uuid.UUID(queue_id), kind, payload, MAX_ATTEMPTS,
    )
    await conn.execute("SELECT pg_notify($1, $2)", CHANNEL, f"ready:{job_id}")
    return str(job_id)


async def claim(worker_id: str) -> dict | None:
    """The next ready job, now running under this worker's lease, or None."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_by = $1,
               locked_until = NOW() + $2::interval, started_at = COALESCE(started_at, NOW())
        WHERE id = (
            SELECT id FROM jobs
            WHERE (status = 'queued' AND run_after <= NOW()) OR (status = 'running' AND locked_until < NOW())
            ORDER BY run_after, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING *
        """,
        worker_id, LEASE,
    )
    return dict(row) if row else None


@dataclass
class _Attempt:
    cancel_requested: bool = False
    lease_lost: bool = False
    task: asyncio.Task | None = field(default=None, repr=False)


async def execute(job: dict, worker_id: str, attempt: _Attempt | None = None) -> None:
    """Run one claimed job to an outcome: succeeded, retried, failed or cancelled."""
    attempt = attempt or _Attempt()
    kind = KINDS[job["kind"]]
    if job["cancel_requested"]:
        await _finish_cancelled(job, kind)
        return
    if job["attempts"] > job["max_attempts"]:
        # The last attempt's worker stopped responding
        await _finish_failed(job, kind, worker_id, "The operation stopped responding and was stopped. Try again.")
        return

    timeout_minutes = get_settings().job_timeout_minutes
    work = asyncio.create_task(_run(kind, job, timeout_minutes * 60))
    attempt.task = work
    heartbeat = asyncio.create_task(_heartbeat(job, worker_id, work, attempt))
    try:
        await work
    except asyncio.CancelledError:
        if attempt.cancel_requested:
            await _finish_cancelled(job, kind)
            return
        if attempt.lease_lost:
            return  # another worker has the job now
        # This worker is stopping: hand the job back without counting the unfinished attempt
        await _release(job, worker_id)
        raise
    except TimeoutError:
        await _finish_failed(
            job, kind, worker_id,
            f"The operation took longer than {timeout_minutes:g} minutes and was stopped. Try again, or narrow the instructions.",
        )
    except Exception as error:
        message = str(error) or "The operation failed. Try again."
        if kind.should_retry(error) and job["attempts"] < job["max_attempts"]:
            delay = RETRY_DELAYS[min(job["attempts"] - 1, len(RETRY_DELAYS) - 1)]
            logger.warning("Job %s failed (attempt %d), retrying in %s: %s", job["id"], job["attempts"], delay, message)
            await _update(job, worker_id,
                          "status = 'queued', run_after = NOW() + $3::interval, last_error = $4", delay, message)
            await kind.retrying(job, message, delay)
        else:
            if not isinstance(error, _EXPECTED):
                logger.error("Job %s failed", job["id"], exc_info=error)
            await _finish_failed(job, kind, worker_id, message)
    else:
        await _update(job, worker_id, "status = 'succeeded', finished_at = NOW(), last_error = ''")
    finally:
        heartbeat.cancel()


async def _run(kind: JobKind, job: dict, timeout_seconds: float) -> None:
    async with asyncio.timeout(timeout_seconds):
        await kind.run(job)


async def _heartbeat(job: dict, worker_id: str, work: asyncio.Task, attempt: _Attempt) -> None:
    """Renew the lease while the job runs; stop the work if it was cancelled or another worker took over."""
    pool = await get_pool()
    while not work.done():
        await asyncio.sleep(HEARTBEAT_SECONDS)
        try:
            cancel_requested = await pool.fetchval(
                "UPDATE jobs SET locked_until = NOW() + $1::interval WHERE id = $2 AND locked_by = $3 AND status = 'running' "
                "RETURNING cancel_requested",
                LEASE, job["id"], worker_id,
            )
        except DATABASE_UNAVAILABLE_ERRORS:
            continue
        if cancel_requested is None:
            attempt.lease_lost = True
            work.cancel()
            return
        if cancel_requested:
            attempt.cancel_requested = True
            work.cancel()
            return


async def _update(job: dict, worker_id: str, assignments: str, *values) -> None:
    """Change a job this worker still holds, and release its lease."""
    pool = await get_pool()
    await pool.execute(
        f"UPDATE jobs SET {assignments}, locked_by = NULL, locked_until = NULL WHERE id = $1 AND locked_by = $2",
        job["id"], worker_id, *values,
    )


async def _release(job: dict, worker_id: str) -> None:
    try:
        await _update(job, worker_id, "status = 'queued', attempts = GREATEST(attempts - 1, 0), run_after = NOW()")
    except DATABASE_UNAVAILABLE_ERRORS:
        pass  # the lease runs out instead


async def _finish_failed(job: dict, kind: JobKind, worker_id: str, message: str) -> None:
    await _update(job, worker_id, "status = 'failed', finished_at = NOW(), last_error = $3", message)
    await kind.failed(job, message)


async def _finish_cancelled(job: dict, kind: JobKind) -> None:
    pool = await get_pool()
    message = await pool.fetchval(
        "UPDATE jobs SET status = 'cancelled', finished_at = NOW(), locked_by = NULL, locked_until = NULL "
        "WHERE id = $1 RETURNING cancel_message",
        job["id"],
    )
    await kind.cancelled(job, message or "Cancelled.")


async def cancel(queue_id: str, message: str) -> str | None:
    """Cancel the active job for a result: "cancelled" (it hadn't started), "cancelling" (it stops at its
    next heartbeat) or None (nothing active)."""
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        job = await conn.fetchrow(
            "SELECT * FROM jobs WHERE queue_id = $1 AND status IN ('queued', 'running') FOR UPDATE", uuid.UUID(queue_id),
        )
        if not job:
            return None
        if job["status"] == "queued":
            await conn.execute(
                "UPDATE jobs SET status = 'cancelled', finished_at = NOW(), cancel_requested = true, cancel_message = $1 WHERE id = $2",
                message, job["id"],
            )
        else:
            await conn.execute("UPDATE jobs SET cancel_requested = true, cancel_message = $1 WHERE id = $2", message, job["id"])
            await conn.execute("SELECT pg_notify($1, $2)", CHANNEL, f"cancel:{job['id']}")
    if job["status"] == "queued":
        await KINDS[job["kind"]].cancelled(dict(job), message)
        return "cancelled"
    return "cancelling"


async def drain(worker_id: str = "drain") -> int:
    """Run ready jobs one after another until none are left (tests, and one-off runs). Returns how many ran."""
    ran = 0
    while job := await claim(worker_id):
        await execute(job, worker_id)
        ran += 1
    return ran


class Worker:
    """Claims and runs jobs in this process, up to `concurrency` at a time, until stopped."""

    def __init__(self, concurrency: int = 3, worker_id: str | None = None):
        self.concurrency = concurrency
        self.worker_id = worker_id or f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"
        self._running: dict[str, tuple[asyncio.Task, _Attempt]] = {}
        self._wake = asyncio.Event()
        self._loop: asyncio.Task | None = None
        self._listener: asyncpg.Connection | None = None

    async def start(self) -> None:
        await self._listen()
        self._loop = asyncio.create_task(self._run())
        logger.info("Job worker %s started (up to %d at a time)", self.worker_id, self.concurrency)

    async def stop(self) -> None:
        """Stop claiming, and hand jobs still running back to the queue."""
        if self._loop:
            self._loop.cancel()
            await asyncio.gather(self._loop, return_exceptions=True)
        tasks = [task for task, _ in self._running.values()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if self._listener:
            await self._listener.close()
            self._listener = None

    async def _listen(self) -> None:
        """Wake up at once when a job is added or cancelled (polling still covers a lost connection)."""
        url = get_settings().database_url
        try:
            self._listener = await asyncpg.connect(url, ssl=_ssl_arg(url))
            await self._listener.add_listener(CHANNEL, self._notified)
        except (*DATABASE_UNAVAILABLE_ERRORS, asyncpg.PostgresError):
            logger.warning("The job worker couldn't listen for new jobs; it will check every %s seconds", POLL_SECONDS)
            self._listener = None

    def _notified(self, connection, pid, channel, payload: str) -> None:
        if payload.startswith("cancel:"):
            running = self._running.get(payload.removeprefix("cancel:"))
            if running:
                _task, attempt = running
                attempt.cancel_requested = True
                if attempt.task:
                    attempt.task.cancel()
            return
        self._wake.set()

    async def _run(self) -> None:
        while True:
            # Cleared before looking, so a job added while this worker looks still wakes it
            self._wake.clear()
            try:
                while len(self._running) < self.concurrency and (job := await claim(self.worker_id)):
                    attempt = _Attempt()
                    task = asyncio.create_task(execute(job, self.worker_id, attempt))
                    job_id = str(job["id"])
                    self._running[job_id] = (task, attempt)
                    task.add_done_callback(lambda _, job_id=job_id: self._finished(job_id))
            except DATABASE_UNAVAILABLE_ERRORS:
                logger.warning("The job worker can't reach the database; trying again shortly")
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=POLL_SECONDS)
            except TimeoutError:
                pass

    def _finished(self, job_id: str) -> None:
        self._running.pop(job_id, None)
        self._wake.set()  # room for another job


# Errors that are an expected outcome of an operation, logged without a traceback. Filled in by
# job kinds at import (see routers/workflows.py); a plain tuple so isinstance() accepts it.
_EXPECTED: tuple[type[BaseException], ...] = ()


def expect(*errors: type[BaseException]) -> None:
    global _EXPECTED
    _EXPECTED = (*_EXPECTED, *errors)
