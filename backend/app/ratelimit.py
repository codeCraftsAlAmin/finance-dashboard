"""A small in-memory limiter for repeated failures (wrong password, wrong master password).

It is per process, which is enough for a single-instance deployment. If you ever run several
workers, move this to a shared store such as Redis.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status


class FailureLimiter:
    def __init__(self, max_failures: int, window_seconds: int) -> None:
        self.max_failures = max_failures
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        events = self._failures[key]
        while events and now - events[0] > self.window:
            events.popleft()
        return events

    def check(self, key: str) -> None:
        """Raise 429 if `key` has already failed too many times recently."""
        now = time.monotonic()
        with self._lock:
            events = self._prune(key, now)
            if len(events) >= self.max_failures:
                retry_after = max(1, int(self.window - (now - events[0])))
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many failed attempts. Try again in a few minutes.",
                    headers={"Retry-After": str(retry_after)},
                )

    def fail(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._failures.clear()
            else:
                self._failures.pop(key, None)


login_limiter = FailureLimiter(max_failures=8, window_seconds=300)
vault_limiter = FailureLimiter(max_failures=5, window_seconds=300)
