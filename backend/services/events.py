"""Live updates (docs/PHASE1_DESIGN.md D10): changes to an organisation's results and Outbox, for its members.

publish() sends a NOTIFY on CHANNEL, so an event from any process (the web process, or a worker running
on its own) reaches every web process. Each web process holds one LISTEN connection while anyone is
subscribed, and hands each event to the subscribers of that organisation. Events carry what changed,
not the data: browsers refetch what they show.
"""

import asyncio
import json
import logging
from collections import defaultdict

import asyncpg

from config import get_settings
from database import DATABASE_UNAVAILABLE_ERRORS, _ssl_arg, get_pool

logger = logging.getLogger(__name__)

CHANNEL = "launchops_events"
SUBSCRIBER_BACKLOG = 100


async def publish(org_id, kind: str, item_id, status: str) -> None:
    """Tell the organisation's members that something changed: kind is "queue" or "email". Never raises."""
    if not org_id:
        return
    payload = json.dumps({"org_id": str(org_id), "type": kind, "id": str(item_id), "status": status})
    try:
        pool = await get_pool()
        await pool.execute("SELECT pg_notify($1, $2)", CHANNEL, payload)
    except (*DATABASE_UNAVAILABLE_ERRORS, asyncpg.PostgresError):
        logger.warning("Couldn't publish a live update (%s %s)", kind, status, exc_info=True)


class Hub:
    """The subscribers of this process, by organisation, fed from one LISTEN connection."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._connection: asyncpg.Connection | None = None
        self._lock = asyncio.Lock()

    @property
    def listening(self) -> bool:
        return self._connection is not None and not self._connection.is_closed()

    async def subscribe(self, org_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=SUBSCRIBER_BACKLOG)
        async with self._lock:
            if not self.listening:
                url = get_settings().database_url
                self._connection = await asyncpg.connect(url, ssl=_ssl_arg(url))
                await self._connection.add_listener(CHANNEL, self._deliver)
            self._subscribers[str(org_id)].add(queue)
        return queue

    async def unsubscribe(self, org_id: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(str(org_id))
            if subscribers is not None:
                subscribers.discard(queue)
                if not subscribers:
                    del self._subscribers[str(org_id)]
            if not self._subscribers and self._connection is not None:
                connection, self._connection = self._connection, None
                if not connection.is_closed():
                    await connection.close()

    def _deliver(self, connection, pid, channel, payload: str) -> None:
        try:
            event = json.loads(payload)
        except ValueError:
            return
        for queue in list(self._subscribers.get(event.get("org_id", ""), ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass  # a subscriber that stopped reading misses events; its page refetches when it reconnects


hub = Hub()
