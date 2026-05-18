"""
Feature flag service — reads feature_flags table with a short TTL cache.

Usage:
    from app.services.feature_flag_service import is_enabled

    if await is_enabled("new_ap_layout"):
        ...
    if await is_enabled("beta_export", tenant_id=current_tenant_id.get()):
        ...

Flag resolution order:
  1. If tenant_id is in enabled_tenants list → enabled (per-tenant override)
  2. If rollout_pct > 0 and enabled_global → enabled for that % of tenants
     (deterministic: hash(flag_key + tenant_id) % 100 < rollout_pct)
  3. enabled_global flag value

Cache TTL: 60 seconds — flag changes propagate within one minute.
"""

import hashlib
import logging
import time
from typing import cast

from sqlalchemy import select

from app.database import async_session
from app.models.orm import FeatureFlag

logger = logging.getLogger(__name__)

_TTL = 60.0  # seconds

# {flag_key: (expires_at, FeatureFlag snapshot)}
_cache: dict[str, tuple[float, FeatureFlag | None]] = {}


async def _get_flag(flag_key: str) -> FeatureFlag | None:
    now = time.monotonic()
    cached = _cache.get(flag_key)
    if cached and now < cached[0]:
        return cached[1]

    try:
        async with async_session() as db:
            row = await db.scalar(select(FeatureFlag).where(FeatureFlag.flag_key == flag_key))
    except Exception as exc:
        logger.warning("feature_flag_service: DB error reading '%s': %s", flag_key, exc)
        # Return stale cache on DB error rather than crashing
        return cached[1] if cached else None

    _cache[flag_key] = (now + _TTL, row)
    return row


def _rollout_bucket(flag_key: str, tenant_id: str) -> int:
    """Deterministic 0-99 bucket for gradual rollout — stable per (flag, tenant) pair."""
    digest = hashlib.md5(f"{flag_key}:{tenant_id}".encode(), usedforsecurity=False).hexdigest()
    return int(digest[:4], 16) % 100


async def is_enabled(flag_key: str, tenant_id: str | None = None) -> bool:
    """
    Return True if the feature flag is active for the given tenant.
    Falls back to False if the flag does not exist.
    """
    flag = await _get_flag(flag_key)
    if flag is None:
        return False

    # Per-tenant override list takes highest priority
    if tenant_id and flag.enabled_tenants:
        if tenant_id in flag.enabled_tenants:
            return True

    if not flag.enabled_global:
        return False

    # Gradual rollout — cast resolves SQLAlchemy Column[int] to plain int for type checkers
    if flag.rollout_pct and flag.rollout_pct < 100 and tenant_id:
        return _rollout_bucket(flag_key, tenant_id) < cast(int, flag.rollout_pct)

    return True


def invalidate(flag_key: str | None = None) -> None:
    """Manually evict cache — useful after an admin writes a flag change."""
    if flag_key:
        _cache.pop(flag_key, None)
    else:
        _cache.clear()
