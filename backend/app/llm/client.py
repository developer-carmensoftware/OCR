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
from typing import Any

import httpx
from openai import APIConnectionError, APITimeoutError, AsyncOpenAI, RateLimitError

from app.config import settings

logger = logging.getLogger(__name__)

_RETRYABLE = (APITimeoutError, APIConnectionError, RateLimitError)
_MAX_ATTEMPTS = 3

# Hard timeout per LLM call. Vision extractions typically finish in 2-10s;
# 60s leaves headroom for slow models while preventing indefinite worker stall.
_LLM_TIMEOUT_SECONDS = 60.0

# Global cap on in-flight LLM calls per process. Without this, a burst of
# requests floods OpenRouter (triggering 429s + retry storms) and balloons
# memory (each call holds base64-encoded image bytes for its lifetime).
_LLM_CONCURRENCY_LIMIT = 16
_LLM_SEM = asyncio.Semaphore(_LLM_CONCURRENCY_LIMIT)


async def _with_retry(coro_factory, label: str):
    """Call coro_factory() up to _MAX_ATTEMPTS times with exponential backoff + jitter."""
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return await coro_factory()
        except _RETRYABLE as exc:
            if attempt == _MAX_ATTEMPTS:
                raise RuntimeError(
                    f"LLM call '{label}' failed after {_MAX_ATTEMPTS} attempts: {exc}"
                ) from exc
            # Longer base + jitter on RateLimitError to avoid synchronized retry storms
            # when many concurrent callers hit OpenRouter's per-minute quota at once.
            if isinstance(exc, RateLimitError):
                base = 3 * (2 ** (attempt - 1))  # 3s, 6s
            else:
                base = 2 ** (attempt - 1)  # 1s, 2s
            wait = base + random.uniform(0, base * 0.5)
            logger.warning(
                "LLM transient error (attempt %d/%d), retrying in %.1fs: %s",
                attempt,
                _MAX_ATTEMPTS,
                wait,
                exc,
            )
            await asyncio.sleep(wait)


_OPENROUTER_OUTBOUND_URL = f"{settings.openrouter_base_url}/chat/completions"


def get_client() -> AsyncOpenAI:
    # Explicit per-call timeout — the OpenAI SDK default is 600s, which means a
    # hung OpenRouter request would tie up an ASGI task + DB connection for 10 minutes.
    return AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        timeout=httpx.Timeout(_LLM_TIMEOUT_SECONDS, connect=10.0),
        max_retries=0,  # we handle retries via _with_retry
    )


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
    # Legacy alias — callers that still pass usage_type will be ignored
    usage_type: str | None = None,
) -> str:
    """
    Send a multimodal (vision) request to OpenRouter.
    Returns the raw text content from the LLM response.
    Quota check is the caller's responsibility (done in routers via check_quota()).
    """
    from app.context import current_request_id
    from app.services.outbound_log_service import log_outbound
    from app.services.usage_service import log_llm_usage

    client = get_client()
    start = time.perf_counter()
    status_code = 200
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
        async with _LLM_SEM:
            response = await _with_retry(
                lambda: client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=0.0,
                    max_tokens=8192,
                    extra_headers=extra_headers,
                ),
                label="vision",
            )
    except Exception as exc:
        status_code = 500
        raise RuntimeError(f"LLM API call failed: {exc}") from exc
    finally:
        await log_outbound(
            service="openrouter",
            url=_OPENROUTER_OUTBOUND_URL,
            method="POST",
            status_code=status_code,
            duration_ms=(time.perf_counter() - start) * 1000,
            request_size_bytes=image_size_bytes,
        )

    if response.usage:
        await log_llm_usage(
            model=model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            module_id=module_id or usage_type,
            duration_ms=(time.perf_counter() - start) * 1000,
            count_quota=count_quota,
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
    # Legacy alias
    usage_type: str | None = None,
) -> dict | None:
    """
    Call the text/suggestion LLM with a single user prompt.
    Strips markdown code fences, parses JSON.
    Returns None on any failure (never raises to callers).
    """
    from app.context import current_request_id
    from app.services.outbound_log_service import log_outbound
    from app.services.usage_service import log_llm_usage

    client = get_client()
    target_model = model or settings.openrouter_suggestion_model

    start = time.perf_counter()
    status_code = 200
    rid = current_request_id.get("")
    extra_headers = {"X-Request-ID": rid} if rid else {}

    if settings.app_debug:
        logger.debug(
            "[LLM text] model=%s prompt_chars=%d preview=%.120s", target_model, len(prompt), prompt
        )

    try:
        async with _LLM_SEM:
            response = await _with_retry(
                lambda: client.chat.completions.create(
                    model=target_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                    max_tokens=2048,
                    extra_headers=extra_headers,
                ),
                label="text",
            )
    except Exception as exc:
        status_code = 500
        logger.exception("Text LLM call failed: %s", exc)
        return None
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        await log_outbound(
            service="openrouter",
            url=_OPENROUTER_OUTBOUND_URL,
            method="POST",
            status_code=status_code,
            duration_ms=duration_ms,
            request_size_bytes=len(prompt.encode()),
        )

    if response.usage:
        await log_llm_usage(
            model=target_model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            module_id=module_id or usage_type,
            duration_ms=duration_ms,
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
