"""Sliding-window rate limits kept in memory.

The counters live in this process. LaunchOps runs as a single process; if it is ever scaled out
to several processes or instances, move the counters to a shared store (Redis or Postgres), or
each process will allow the full limit on its own.
"""

from __future__ import annotations

import math
import time
from collections import deque
from collections.abc import Callable

from fastapi import HTTPException, Request

from config import get_settings

_limits: list[SlidingWindowLimit] = []


class SlidingWindowLimit:
    """At most `limit` hits per key within any `window_seconds`."""

    def __init__(self, limit: int | Callable[[], int], window_seconds: int):
        self._limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._checks = 0
        _limits.append(self)

    @property
    def limit(self) -> int:
        return self._limit() if callable(self._limit) else self._limit

    def hit(self, key: str) -> int | None:
        """Count a hit for `key`. Over the limit, the hit isn't counted and the seconds to wait are returned."""
        if not get_settings().rate_limit_enabled:
            return None
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - self.window_seconds:
            hits.popleft()
        if len(hits) >= self.limit:
            return max(1, math.ceil(hits[0] + self.window_seconds - now))
        hits.append(now)
        self._checks += 1
        if self._checks % 1000 == 0:
            self._forget_idle_keys(now)
        return None

    def _forget_idle_keys(self, now: float) -> None:
        idle = [key for key, hits in self._hits.items() if not hits or hits[-1] <= now - self.window_seconds]
        for key in idle:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()


def reset_all() -> None:
    """Empty every limit's counters (tests)."""
    for limit in _limits:
        limit.reset()


def enforce(limit: SlidingWindowLimit, key: str, message: str) -> None:
    """Raise 429 with Retry-After when `key` is over `limit`.

    `message` may use {minutes} (rounded up) and {limit}.
    """
    retry_after = limit.hit(key)
    if retry_after is not None:
        minutes = max(1, math.ceil(retry_after / 60))
        raise HTTPException(
            429,
            message.format(minutes=minutes, limit=limit.limit),
            headers={"Retry-After": str(retry_after)},
        )


def client_address(request: Request) -> str:
    """The caller's IP address (uvicorn's --proxy-headers makes this the real client behind Railway's proxy)."""
    return request.client.host if request.client else "unknown"


# ─── The limits ───

SIGN_IN_PER_ACCOUNT = SlidingWindowLimit(10, 15 * 60)
SIGN_IN_PER_ADDRESS = SlidingWindowLimit(30, 15 * 60)
NEW_ACCOUNTS_PER_ADDRESS = SlidingWindowLimit(10, 60 * 60)
AI_OPERATIONS_PER_ACCOUNT = SlidingWindowLimit(lambda: get_settings().ai_operations_per_hour, 60 * 60)
# Password reset emails: per email address, and per network address
PASSWORD_RESETS_PER_ACCOUNT = SlidingWindowLimit(5, 3600)
PASSWORD_RESETS_PER_ADDRESS = SlidingWindowLimit(20, 3600)
