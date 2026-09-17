"""Run the LaunchOps job worker on its own: python -m worker

For deployments that run operations in a separate service, for example a second Railway service built
from the same image and started with this command. Set WORKER_ENABLED=false on the web service then, so
only this process runs jobs (running both is safe, just unnecessary).
"""

import asyncio
import contextlib
import logging
import signal

import routers.workflows  # noqa: F401  (registers the workflow job kind)
from config import check_startup_settings, get_settings
from database import close_pool, get_pool
from services import field_crypto, jobs

logger = logging.getLogger("worker")


async def main(stop: asyncio.Event | None = None) -> None:
    """Run jobs until `stop` is set, or the process is interrupted or terminated."""
    settings = get_settings()
    check_startup_settings(settings)
    field_crypto.check_key()
    await get_pool()
    stop = stop or asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        # Windows has no signal handlers in asyncio; Ctrl+C still interrupts asyncio.run()
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, stop.set)
    worker = jobs.Worker(concurrency=settings.worker_concurrency)
    await worker.start()
    try:
        await stop.wait()
    finally:
        logger.info("Stopping: unfinished jobs go back to the queue")
        await worker.stop()
        await close_pool()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(main())
