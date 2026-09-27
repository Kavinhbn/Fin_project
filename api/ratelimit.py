"""Small in-process sliding-window rate limiter (per user). Cloud Run max-instances caps abuse
across instances; replace with a shared store only if the app is scaled out."""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class RateLimiter:
    def __init__(self, limit_per_min: int, clock=time.monotonic) -> None:
        self.limit = limit_per_min
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        """Raise 429 when `key` exceeded the limit in the last 60 seconds."""
        now = self._clock()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] >= 60:
                q.popleft()
            if len(q) >= self.limit:
                retry = max(1, int(60 - (now - q[0])))
                raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry)})
            q.append(now)
