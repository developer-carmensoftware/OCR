"""InMemoryRateLimiter: sliding window, per-key isolation, pruning, IP resolution.

This limiter guards admin login (brute-force) and outbound-cost paths, so the
window arithmetic is a security boundary, not a nicety. Time is injected via a
fake monotonic clock — no sleeps, no flakes.
"""

from types import SimpleNamespace

import pytest

from app.exceptions import RequestRateLimitExceeded
from app.services import rate_limit_service as rls


class FakeClock:
    """Stand-in for the `time` module, exposing only what the service calls."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def monotonic(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock(monkeypatch):
    c = FakeClock()
    monkeypatch.setattr(rls, "time", c)
    return c


def _request(ip: str | None = "10.0.0.1", forwarded: str | None = None):
    """Minimal Request stand-in — get_client_ip only touches .headers and .client."""
    headers = {"X-Forwarded-For": forwarded} if forwarded else {}
    return SimpleNamespace(
        headers=headers,
        client=SimpleNamespace(host=ip) if ip else None,
    )


# ── The window itself ─────────────────────────────────────────────────────────


def test_calls_under_the_limit_pass(clock):
    limiter = rls.InMemoryRateLimiter(max_calls=3, window_seconds=60)
    for _ in range(3):
        limiter.check(_request())  # no raise


def test_the_call_that_exceeds_the_limit_raises(clock):
    limiter = rls.InMemoryRateLimiter(max_calls=3, window_seconds=60)
    for _ in range(3):
        limiter.check(_request())

    with pytest.raises(RequestRateLimitExceeded) as exc:
        limiter.check(_request())

    # retry_after must be the window, so the 429 tells the caller something true.
    assert exc.value.retry_after == 60


def test_window_expiry_lets_calls_through_again(clock):
    limiter = rls.InMemoryRateLimiter(max_calls=2, window_seconds=60)
    limiter.check(_request())
    limiter.check(_request())
    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request())

    clock.advance(61)
    limiter.check(_request())  # window rolled off — no raise


def test_partial_expiry_frees_exactly_one_slot(clock):
    """The window slides continuously; it is not a fixed bucket that resets."""
    limiter = rls.InMemoryRateLimiter(max_calls=2, window_seconds=60)
    limiter.check(_request())  # t=1000
    clock.advance(30)
    limiter.check(_request())  # t=1030
    clock.advance(31)  # t=1061 — the t=1000 call has aged out, the t=1030 one has not

    limiter.check(_request())  # one slot free
    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request())


def test_blocked_calls_do_not_extend_the_window(clock):
    """A rejected call must not count as a hit, or a client hammering the endpoint
    would keep pushing its own unlock time back indefinitely."""
    limiter = rls.InMemoryRateLimiter(max_calls=1, window_seconds=60)
    limiter.check(_request())  # t=1000, the one allowed call

    for _ in range(5):
        clock.advance(5)
        with pytest.raises(RequestRateLimitExceeded):
            limiter.check(_request())

    # t=1025 now. The original call still ages out at t=1060, not later.
    clock.advance(36)  # t=1061
    limiter.check(_request())  # no raise


# ── Keying ────────────────────────────────────────────────────────────────────


def test_separate_ips_get_separate_budgets(clock):
    limiter = rls.InMemoryRateLimiter(max_calls=1, window_seconds=60)
    limiter.check(_request("10.0.0.1"))
    limiter.check(_request("10.0.0.2"))  # different IP, own budget

    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request("10.0.0.1"))


def test_fixed_key_makes_one_global_ceiling(clock):
    """Passing `key` ignores the IP entirely — the documented global-ceiling mode."""
    limiter = rls.InMemoryRateLimiter(max_calls=2, window_seconds=60)
    limiter.check(_request("10.0.0.1"), key="carmen-ar")
    limiter.check(_request("10.0.0.2"), key="carmen-ar")

    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request("10.0.0.3"), key="carmen-ar")


def test_missing_client_falls_back_to_one_shared_bucket(clock):
    """No client (ASGI scope without one) must not crash, and must not hand every
    such caller an unlimited private bucket."""
    limiter = rls.InMemoryRateLimiter(max_calls=1, window_seconds=60)
    limiter.check(_request(None))
    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request(None))


def test_forwarded_header_is_ignored_when_proxy_is_untrusted(clock, monkeypatch):
    """The spoofing guard: with trust_proxy off, a forged X-Forwarded-For must not
    win the caller a fresh budget."""
    from app.config import settings

    monkeypatch.setattr(settings, "trust_proxy", False)
    limiter = rls.InMemoryRateLimiter(max_calls=1, window_seconds=60)

    limiter.check(_request("10.0.0.1"))
    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request("10.0.0.1", forwarded="1.2.3.4"))


# ── Pruning ───────────────────────────────────────────────────────────────────


def test_pruning_drops_stale_keys_but_keeps_live_ones(clock):
    limiter = rls.InMemoryRateLimiter(max_calls=5, window_seconds=60, prune_interval=300)
    limiter.check(_request("10.0.0.1"))  # t=1000, goes stale
    clock.advance(400)
    limiter.check(_request("10.0.0.2"))  # t=1400, live — and triggers the prune

    assert "10.0.0.1" not in limiter._calls
    assert "10.0.0.2" in limiter._calls


def test_pruning_does_not_reset_a_live_budget(clock):
    """Regression guard: a prune sweep must not clear entries still inside their
    window, which would silently hand an over-limit caller a fresh allowance."""
    limiter = rls.InMemoryRateLimiter(max_calls=2, window_seconds=600, prune_interval=300)
    limiter.check(_request("10.0.0.1"))
    limiter.check(_request("10.0.0.1"))

    clock.advance(301)  # past prune_interval, still inside the 600s window
    with pytest.raises(RequestRateLimitExceeded):
        limiter.check(_request("10.0.0.1"))
