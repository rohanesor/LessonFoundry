"""Simple per-user in-memory rate limiting for expensive operations.

This is a guard rail, not a distributed quota service. For multi-process
production deployments, replace with Redis-backed rate limiting.
"""

import os
import time
from functools import wraps
from fastapi import HTTPException
from app.security import identity


_ENABLED = os.getenv("RATE_LIMIT", "") in ("1", "true", "yes") or os.getenv(
    "APP_ENV", ""
) in ("staging", "production")


class _TokenBucket:
    def __init__(self, capacity: int, refill_per_second: float):
        self.capacity = capacity
        self.refill = refill_per_second
        self.tokens = float(capacity)
        self.last = time.monotonic()

    def allow(self) -> bool:
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + self.refill * (now - self.last))
        self.last = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


_buckets: dict[str, _TokenBucket] = {}


def _key(name: str) -> str:
    handle = identity.get(None)
    user = handle.user_id if handle else "anonymous"
    return f"{user}:{name}"


def rate_limit(name: str, capacity: int = 5, refill_per_second: float = 1 / 60):
    """Decorator for FastAPI route handlers. No-op unless RATE_LIMIT=1 or APP_ENV is staging/production."""

    def decorator(fn):
        if not _ENABLED:
            return fn

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = _key(name)
            bucket = _buckets.setdefault(
                key, _TokenBucket(capacity, refill_per_second)
            )
            if not bucket.allow():
                raise HTTPException(
                    429,
                    f"Too many {name} requests. Slow down to avoid accidental overload.",
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator
