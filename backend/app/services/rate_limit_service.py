import logging
import time
from collections import defaultdict

from fastapi import Request

from app.exceptions import RequestRateLimitExceeded
from app.utils.client_ip import get_client_ip

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """Sliding-window rate limiter, keyed on the client IP by default.

    Pass a fixed `key` to `check()` to make one limiter a *global* ceiling instead:
    per-IP limits are the wrong axis for distributed traffic, so a path whose cost
    lands on someone else (an outbound call, a third-party API) usually wants both.

    NOTE: per-process only — does not coordinate across replicas.
    Replace with Redis ZADD/ZCOUNT when deploying more than one app instance.
    """

    def __init__(
        self,
        max_calls: int,
        window_seconds: float,
        prune_interval: float = 300.0,
    ) -> None:
        self._calls: dict[str, list[float]] = defaultdict(list)
        self._max = max_calls
        self._window = window_seconds
        self._prune_interval = prune_interval
        self._last_prune = 0.0

    def check(self, request: Request, key: str | None = None) -> None:
        """Raise HTTP 429 if the caller has exceeded the rate limit."""
        ip = key or get_client_ip(request) or "unknown"
        now = time.monotonic()

        if now - self._last_prune > self._prune_interval:
            stale = [
                k for k, v in self._calls.items() if not any(now - t < self._window for t in v)
            ]
            for k in stale:
                del self._calls[k]
            self._last_prune = now

        recent = [t for t in self._calls[ip] if now - t < self._window]
        if len(recent) >= self._max:
            self._calls[ip] = recent
            logger.info(
                "rate_limit triggered: ip=%s window=%ss limit=%d", ip, self._window, self._max
            )
            raise RequestRateLimitExceeded(
                "Too many login attempts. Please try again later.",
                retry_after=int(self._window),
            )
        recent.append(now)
        self._calls[ip] = recent
