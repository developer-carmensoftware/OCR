import logging
import time
from collections import defaultdict

from fastapi import Request

from app.exceptions import RequestRateLimitExceeded
from app.utils.client_ip import get_client_ip

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """Per-IP sliding-window rate limiter.

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

    def check(self, request: Request) -> None:
        """Raise HTTP 429 if the caller has exceeded the rate limit."""
        ip = get_client_ip(request) or "unknown"
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
