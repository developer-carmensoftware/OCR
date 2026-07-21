"""
LLM Client — shared AsyncOpenAI client + call helpers.

All LLM calls (vision and text) must go through this module.
Never construct AsyncOpenAI elsewhere.
"""

import asyncio
import json
import logging
import random
import time
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from openai import APIConnectionError, APITimeoutError, AsyncOpenAI, RateLimitError

from app.config import settings
from app.exceptions import LLMCapacityError, LLMServiceError

logger = logging.getLogger(__name__)

_RETRYABLE = (APITimeoutError, APIConnectionError, RateLimitError)
_MAX_ATTEMPTS = 3

# Hard timeout per LLM call. Vision extractions typically finish in 2-10s;
# 120s leaves headroom for multi-page documents while preventing indefinite worker stall.
_LLM_TIMEOUT_SECONDS = 120.0

_Kind = Literal["vision", "text"]


def _provider_prefs(kind: _Kind) -> dict[str, Any]:
    """Build OpenRouter `provider` routing preferences enforcing the privacy policy.

    Sent as `extra_body={"provider": ...}` on every request so no-collect/no-train
    routing is guaranteed per-request — independent of the OpenRouter account
    dashboard toggles (which can be changed silently). See config.py llm_* settings
    and UserConsentModal.tsx (the consent promise this enforces).
    """
    prefs: dict[str, Any] = {"data_collection": settings.llm_data_collection}
    if settings.llm_require_zdr:
        prefs["zdr"] = True
    allow = (
        settings.llm_vision_provider_allowlist_list
        if kind == "vision"
        else settings.llm_text_provider_allowlist_list
    )
    if allow:
        prefs["only"] = allow
    return prefs


def _policy_str(prefs: dict[str, Any]) -> str:
    """Compact evidence string for the privacy directive sent (stored per call).

    e.g. "deny", "deny+zdr", "deny;only=fireworks,deepinfra,digitalocean".
    """
    s = str(prefs.get("data_collection", "?"))
    if prefs.get("zdr"):
        s += "+zdr"
    only = prefs.get("only")
    if only:
        s += ";only=" + ",".join(only)
    return s[:120]


async def _guard_provider(provider: str | None, module_id: str | None) -> None:
    """Alert if OpenRouter routed to a provider outside the expected set.

    Belt-and-suspenders over the `only`/`data_collection` enforcement — catches config
    drift or an OpenRouter routing change that sends data somewhere unexpected. Fires an
    anomaly alert (deduped) + ERROR log only on violation (rare → no hot-path DB cost
    normally). NEVER raises: a broken guard must not break extraction.
    """
    try:
        expected = settings.llm_expected_providers_list
        if not provider or not expected:
            return
        p = provider.lower()
        if any(e.lower() in p for e in expected):
            return
        logger.error(
            "LLM routed to UNEXPECTED provider %r (expected one of %s) — data-routing "
            "policy may be breached",
            provider,
            expected,
        )
        from app.context import current_tenant_id
        from app.models.enums import AlertSeverity
        from app.services import anomaly_service

        await anomaly_service.open_alert_if_absent(
            tenant_id=current_tenant_id.get() or "system",
            module_id=module_id,
            metric="llm_provider_out_of_policy",
            severity=AlertSeverity.WARN,
            description=f"LLM routed to unexpected provider: {provider}",
        )
    except Exception as exc:
        logger.error("_guard_provider failed: %s", exc)


# ── Multi-key capacity pool ───────────────────────────────────────────────────
# Each OpenRouter key gets its OWN cached client + separate vision/text semaphores.
# OpenRouter rate-limits per key, so spreading in-flight calls across N keys yields
# ~N× headroom. Vision (OCR) and text (suggestion) have independent slot pools so a
# burst of suggestions never starves OCR extractions (head-of-line blocking).
#
# In-memory, per-process — like middleware/rate_limit.py. Under `--workers N` the real
# cap per key is N × the configured per-key concurrency. See config.py sizing note.


@dataclass
class _KeyState:
    label: str
    client: AsyncOpenAI
    vision_sem: asyncio.Semaphore
    text_sem: asyncio.Semaphore
    vision_limit: int
    text_limit: int
    vision_inflight: int = 0
    text_inflight: int = 0

    def sem(self, kind: _Kind) -> asyncio.Semaphore:
        return self.vision_sem if kind == "vision" else self.text_sem

    def inflight(self, kind: _Kind) -> int:
        return self.vision_inflight if kind == "vision" else self.text_inflight

    def limit(self, kind: _Kind) -> int:
        return self.vision_limit if kind == "vision" else self.text_limit

    def incr(self, kind: _Kind) -> None:
        if kind == "vision":
            self.vision_inflight += 1
        else:
            self.text_inflight += 1

    def decr(self, kind: _Kind) -> None:
        if kind == "vision":
            self.vision_inflight -= 1
        else:
            self.text_inflight -= 1


_POOL: list[_KeyState] = []  # lazily populated by _get_pool() on first use


def _build_client(api_key: str) -> AsyncOpenAI:
    # Explicit per-call timeout — the OpenAI SDK default is 600s, which means a
    # hung OpenRouter request would tie up an ASGI task + DB connection for 10 minutes.
    return AsyncOpenAI(
        api_key=api_key,
        base_url=settings.openrouter_base_url,
        timeout=httpx.Timeout(_LLM_TIMEOUT_SECONDS, connect=10.0),
        max_retries=0,  # we handle retries via _with_retry + cross-key failover
    )


def _get_pool() -> list[_KeyState]:
    """Lazily build the per-key pool from settings on first use."""
    global _POOL
    if _POOL:
        return _POOL
    v_limit = max(1, settings.llm_vision_concurrency_per_key)
    t_limit = max(1, settings.llm_text_concurrency_per_key)
    keys = settings.openrouter_api_keys_list
    pool: list[_KeyState] = []
    for i, key in enumerate(keys, start=1):
        pool.append(
            _KeyState(
                label=f"key{i}",
                client=_build_client(key),
                vision_sem=asyncio.Semaphore(v_limit),
                text_sem=asyncio.Semaphore(t_limit),
                vision_limit=v_limit,
                text_limit=t_limit,
            )
        )
    _POOL = pool
    logger.info(
        "LLM key pool initialized: %d key(s), per-key vision=%d text=%d",
        len(pool),
        v_limit,
        t_limit,
    )
    return _POOL


async def _acquire(kind: _Kind, exclude: frozenset[str] = frozenset()) -> _KeyState:
    """Reserve one in-flight slot on the least-loaded key, releasing the caller's
    obligation to call _release() afterwards.

    Fast path: if any (non-excluded) key has a free slot, take the least-loaded one
    immediately. Slow path: all candidate keys are saturated — wait on the least-loaded
    one for up to llm_max_queue_wait_seconds, then raise LLMCapacityError (→ 429).
    A 0 wait means "wait indefinitely" (legacy queue-and-wait, never 429 from the pool).
    """
    pool = [ks for ks in _get_pool() if ks.label not in exclude]
    if not pool:
        raise LLMCapacityError()

    # Fast path — a free slot exists. No await between the check and acquire(), so the
    # event loop can't hand the slot to another coroutine in between; acquire() returns
    # without suspending when the semaphore has capacity.
    for ks in sorted(pool, key=lambda k: k.inflight(kind)):
        if ks.inflight(kind) < ks.limit(kind):
            await ks.sem(kind).acquire()
            ks.incr(kind)
            return ks

    # Slow path — everything is full. Wait on the least-loaded key, bounded.
    ks = min(pool, key=lambda k: k.inflight(kind))
    max_wait = settings.llm_max_queue_wait_seconds
    try:
        if max_wait and max_wait > 0:
            await asyncio.wait_for(ks.sem(kind).acquire(), timeout=max_wait)
        else:
            await ks.sem(kind).acquire()
    except TimeoutError as exc:
        raise LLMCapacityError() from exc
    ks.incr(kind)
    return ks


def _release(ks: _KeyState, kind: _Kind) -> None:
    ks.decr(kind)
    ks.sem(kind).release()


_NETWORK_RETRYABLE = (APITimeoutError, APIConnectionError)


async def _call_with_pool(kind: _Kind, build_call, label: str):
    """Run an LLM call through the key pool with cross-key failover + backoff rounds.

    `build_call(client)` returns the awaitable for the chat completion.

    Strategy per round: sweep every key once (least-loaded first). A RateLimitError on
    one key triggers an IMMEDIATE failover to the next key — no same-key backoff, since
    another key likely has headroom. Transient NETWORK errors are retried on the same
    key by _with_retry. Only when ALL keys are throttled in a sweep do we back off and
    sweep again (up to _MAX_ATTEMPTS rounds) — this mirrors the old single-key backoff.

    Returns (response, key_label). Raises the last RateLimitError when every key stays
    throttled across all rounds, or LLMCapacityError when no slot can be reserved in time.
    """
    n = len(_get_pool())
    last_rate_exc: RateLimitError | None = None
    for round_idx in range(_MAX_ATTEMPTS):
        tried: set[str] = set()
        while len(tried) < n:
            ks = await _acquire(kind, exclude=frozenset(tried))
            try:
                response = await _with_retry(lambda cl=ks.client: build_call(cl), label=label)
                return response, ks.label
            except RateLimitError as exc:
                last_rate_exc = exc
                tried.add(ks.label)
                logger.warning("LLM key %s rate-limited; failing over to next key", ks.label)
            finally:
                _release(ks, kind)
        # Every key was throttled this sweep. Back off (3s, 6s) then sweep again, unless
        # this was the final round — re-raise the original RateLimitError so the caller's
        # `except (*_RETRYABLE, ...)` maps it to 503.
        if round_idx == _MAX_ATTEMPTS - 1:
            assert last_rate_exc is not None
            logger.error("All %d LLM key(s) rate-limited after %d rounds", n, _MAX_ATTEMPTS)
            raise last_rate_exc
        base = 3 * (2**round_idx)  # 3s, 6s
        wait = base + random.uniform(0, base * 0.5)
        logger.warning(
            "All %d LLM key(s) rate-limited; backing off %.1fs (round %d/%d)",
            n,
            wait,
            round_idx + 1,
            _MAX_ATTEMPTS,
        )
        await asyncio.sleep(wait)
    # Unreachable (loop either returns or raises), but keeps type-checkers happy.
    assert last_rate_exc is not None
    raise last_rate_exc


async def _with_retry(coro_factory, label: str):
    """Retry coro_factory() on transient NETWORK errors only (timeout/connection).

    RateLimitError is intentionally NOT retried here — the key pool handles throttling
    via cross-key failover + backoff rounds (see _call_with_pool). This keeps a single
    rate-limited key from stalling a request that another key could serve immediately.
    """
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return await coro_factory()
        except _NETWORK_RETRYABLE as exc:
            if attempt == _MAX_ATTEMPTS:
                # Re-raise the ORIGINAL exception type (not a wrapped RuntimeError) so
                # call_vision_llm's `except (*_RETRYABLE, httpx.HTTPError)` handler can
                # match it and return 503 (provider down → retryable) instead of 500.
                logger.error(
                    "LLM call '%s' failed after %d attempts: %s", label, _MAX_ATTEMPTS, exc
                )
                raise
            base = 2 ** (attempt - 1)  # 1s, 2s
            wait = base + random.uniform(0, base * 0.5)
            logger.warning(
                "LLM transient network error (attempt %d/%d), retrying in %.1fs: %s",
                attempt,
                _MAX_ATTEMPTS,
                wait,
                exc,
            )
            await asyncio.sleep(wait)


_OPENROUTER_OUTBOUND_URL = f"{settings.openrouter_base_url}/chat/completions"


def get_client() -> AsyncOpenAI:
    """Backward-compatible accessor — returns the first pooled key's cached client.

    Internal call paths use the per-key clients via the capacity pool; this remains for
    external callers importing from app.llm. It no longer constructs a fresh client per call.
    """
    return _get_pool()[0].client


def _strip_code_fences(text: str) -> str:
    """Remove ```json / ``` wrappers that some models add around JSON output."""
    if not text.startswith("```"):
        return text
    lines = text.split("\n")
    if len(lines) <= 1:
        return text
    last = lines[-1].strip()
    inner = lines[1:-1] if last == "```" else lines[1:]
    return "\n".join(inner).strip()


async def call_vision_llm(
    system_prompt: str,
    user_content: list[Any],
    model: str,
    task_id: str | None = None,
    module_id: str | None = None,
    image_size_bytes: int = 0,
    count_quota: bool = False,
) -> str:
    """
    Send a multimodal (vision) request to OpenRouter.
    Returns the raw text content from the LLM response.
    Quota check is the caller's responsibility (done in routers via check_quota()).
    """
    from app.context import current_request_id
    from app.services.outbound_log_service import log_outbound
    from app.services.usage_service import log_llm_usage

    start = time.perf_counter()
    status_code = 200
    key_label = "?"
    provider = None
    rid = current_request_id.get("")
    extra_headers = {"X-Request-ID": rid} if rid else {}
    if settings.app_debug:
        user_summary = [
            (c if isinstance(c, str) else f"[{c.get('type', '?')}]")
            for c in (user_content if isinstance(user_content, list) else [user_content])
        ]
        logger.debug(
            "[LLM vision] model=%s prompt_chars=%d user_parts=%s",
            model,
            len(system_prompt),
            user_summary,
        )

    try:
        response, key_label = await _call_with_pool(
            "vision",
            lambda client: client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.0,
                max_tokens=8192,
                extra_headers=extra_headers,
                extra_body={"provider": _provider_prefs("vision")},
            ),
            label="vision",
        )
        provider = getattr(response, "provider", None)
        await _guard_provider(provider, module_id)
    except LLMCapacityError:
        # Pool saturated past the max queue wait → 429 (Retry-After). Propagate as-is so
        # the global handler maps it; do NOT wrap into 503/500.
        status_code = 429
        raise
    except (*_RETRYABLE, httpx.HTTPError) as exc:
        # Upstream LLM provider unavailable/slow after retries → 503 so the client
        # knows to retry, rather than a generic 500 that looks like our bug.
        status_code = 503
        raise LLMServiceError(f"LLM provider unavailable: {exc}") from exc
    except Exception as exc:
        status_code = 500
        raise RuntimeError(f"LLM API call failed: {exc}") from exc
    finally:
        await log_outbound(
            service="openrouter",
            url=f"{_OPENROUTER_OUTBOUND_URL}#{key_label}",
            method="POST",
            status_code=status_code,
            duration_ms=(time.perf_counter() - start) * 1000,
            request_size_bytes=image_size_bytes,
            provider=provider,
            data_policy=_policy_str(_provider_prefs("vision")),
        )

    if response.usage:
        await log_llm_usage(
            model=model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            module_id=module_id,
            duration_ms=(time.perf_counter() - start) * 1000,
            count_quota=count_quota,
            call_type="extract",
        )

    content = (
        response.choices[0].message.content
        if response.choices and response.choices[0].message
        else None
    )
    if not content or not isinstance(content, str):
        raise RuntimeError(
            "LLM returned empty content — model may have hit token limit or safety filter"
        )

    if settings.app_debug:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.debug(
            "[LLM vision] done model=%s duration=%.0fms tokens=%s response_chars=%d preview=%.120s",
            model,
            duration_ms,
            f"{response.usage.total_tokens}" if response.usage else "?",
            len(content),
            content.strip(),
        )

    return content.strip()


async def call_text_llm(
    prompt: str,
    model: str | None = None,
    task_id: str | None = None,
    module_id: str | None = None,
    max_tokens: int = 2048,
) -> dict | None:
    """
    Call the text/suggestion LLM with a single user prompt.
    Strips markdown code fences, parses JSON.
    Returns None on any failure (never raises to callers).
    """
    from app.context import current_request_id
    from app.services.outbound_log_service import log_outbound
    from app.services.usage_service import log_llm_usage

    target_model = model or settings.openrouter_suggestion_model

    start = time.perf_counter()
    status_code = 200
    key_label = "?"
    provider = None
    rid = current_request_id.get("")
    extra_headers = {"X-Request-ID": rid} if rid else {}

    if settings.app_debug:
        logger.debug(
            "[LLM text] model=%s prompt_chars=%d preview=%.120s", target_model, len(prompt), prompt
        )

    try:
        response, key_label = await _call_with_pool(
            "text",
            lambda client: client.chat.completions.create(
                model=target_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=max_tokens,
                extra_headers=extra_headers,
                extra_body={"provider": _provider_prefs("text")},
            ),
            label="text",
        )
        provider = getattr(response, "provider", None)
        await _guard_provider(provider, module_id)
    except LLMCapacityError as exc:
        # Suggestion is best-effort — under pool saturation, degrade to "no suggestion"
        # rather than surfacing a 429. The caller already handles None.
        status_code = 429
        logger.warning("Text LLM skipped — pool at capacity: %s", exc)
        return None
    except Exception as exc:
        status_code = 500
        logger.exception("Text LLM call failed: %s", exc)
        return None
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        await log_outbound(
            service="openrouter",
            url=f"{_OPENROUTER_OUTBOUND_URL}#{key_label}",
            method="POST",
            status_code=status_code,
            duration_ms=duration_ms,
            request_size_bytes=len(prompt.encode()),
            provider=provider,
            data_policy=_policy_str(_provider_prefs("text")),
        )

    if response.usage:
        await log_llm_usage(
            model=target_model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            module_id=module_id,
            duration_ms=duration_ms,
            # Every caller of the text path is a GL-mapping suggestion today
            # (gl_suggestion_service, ap_invoice_service.suggest_for_items). If a
            # non-suggestion text call ever lands here, give it its own call_type
            # rather than letting it inherit this one.
            call_type="suggest",
        )

    content = (
        response.choices[0].message.content
        if response.choices and response.choices[0].message
        else None
    )
    if not content or not isinstance(content, str):
        return None

    raw = _strip_code_fences(content.strip())
    try:
        parsed = json.loads(raw)
        if settings.app_debug:
            logger.debug(
                "[LLM text] done model=%s duration=%.0fms tokens=%s parsed_keys=%s",
                target_model,
                duration_ms,
                f"{response.usage.total_tokens}" if response.usage else "?",
                list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__,
            )
        return parsed if isinstance(parsed, dict) else None
    except (json.JSONDecodeError, ValueError):
        logger.error("Failed to parse LLM JSON: %s", raw[:200])
        return None
