"""
Maintenance-mode flags, stored in `system_configs` / `tenant_config_overrides`.

Runtime-toggleable (unlike .env, which needs a restart). Read on every request via
a short in-process cache, so the hot path never queries the DB more than once per
`_CACHE_TTL_S`.

Semantics: a tenant is under maintenance when the GLOBAL flag is on **OR** that
tenant has its own override on. This is OR, not the usual override-replaces-global
precedence of tenant_config_overrides — global maintenance means everyone, always.
"""

import logging
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.billing import SystemConfig, TenantConfigOverride

logger = logging.getLogger(__name__)

_KEY_ENABLED = "maintenance.enabled"
_KEY_MESSAGE = "maintenance.message"
_KEY_WINDOW_START = "maintenance.window_start"
_KEY_WINDOW_END = "maintenance.window_end"
_CACHE_TTL_S = 10.0

# Module-level cache. Refreshed at most once per _CACHE_TTL_S; invalidated to 0 on write.
# `enabled` is the manual/instant switch; `window_start/end` drive the scheduled window,
# whose active state is computed against the live clock in is_maintenance() (no cron).
_cache: dict = {
    "ts": 0.0,
    "enabled": False,
    "message": "",
    "window_start": None,
    "window_end": None,
    "tenants": set(),
}


def _parse_dt(value) -> datetime | None:
    """Cached window bound → aware datetime, or None for unset/unparseable ("")."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        dt = datetime.fromisoformat(value.strip('"'))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


async def _refresh_cache(db: AsyncSession) -> None:
    """One query for the global config, one for the set of tenant overrides."""
    cfg = {
        k: v
        for k, v in (
            await db.execute(
                select(SystemConfig.key_name, SystemConfig.value).where(
                    SystemConfig.key_name.like("maintenance.%")
                )
            )
        ).all()
    }
    rows = (
        await db.execute(
            select(TenantConfigOverride.tenant_id, TenantConfigOverride.value).where(
                TenantConfigOverride.key_name == _KEY_ENABLED
            )
        )
    ).all()
    _cache["enabled"] = bool(cfg.get(_KEY_ENABLED))
    msg = cfg.get(_KEY_MESSAGE)
    _cache["message"] = msg.strip('"') if isinstance(msg, str) else (str(msg) if msg else "")
    _cache["window_start"] = _parse_dt(cfg.get(_KEY_WINDOW_START))
    _cache["window_end"] = _parse_dt(cfg.get(_KEY_WINDOW_END))
    _cache["tenants"] = {str(tid) for tid, val in rows if val}
    _cache["ts"] = time.monotonic()


def _window_active(now: datetime | None = None) -> bool:
    ws, we = _cache["window_start"], _cache["window_end"]
    if not (ws and we):
        return False
    now = now or datetime.now(UTC)
    return ws <= now < we


def _global_active() -> bool:
    """Manual switch OR inside the scheduled window (evaluated against the live clock)."""
    return bool(_cache["enabled"]) or _window_active()


async def is_maintenance(tenant_id: str | None) -> tuple[bool, str]:
    """
    (active, message) for the given tenant. Fail-OPEN: if the flag store can't be
    read (DB down/timeout), return not-in-maintenance so an outage never bricks the
    whole API on a config read.
    """
    try:
        if time.monotonic() - _cache["ts"] > _CACHE_TTL_S:
            async with async_session() as db:
                await _refresh_cache(db)
    except Exception as exc:  # noqa: BLE001 — fail-open is the whole point
        logger.warning("maintenance flag read failed (fail-open): %s", exc)
        return False, ""

    active = _global_active() or (bool(tenant_id) and str(tenant_id) in _cache["tenants"])
    return active, _cache["message"]


# ── Admin read/write ──────────────────────────────────────────────────────────


def _iso(dt: datetime | None) -> str | None:
    return dt.astimezone(UTC).isoformat() if dt else None


def window_bounds_iso() -> tuple[str | None, str | None]:
    """Current cached window (UTC ISO) — for the public status/banner. Read-only,
    no refresh; callers hit this right after is_maintenance() already refreshed."""
    return _iso(_cache["window_start"]), _iso(_cache["window_end"])


async def get_status(db: AsyncSession) -> dict:
    await _refresh_cache(db)
    return {
        "enabled": _cache["enabled"],
        "active": _global_active(),
        "message": _cache["message"],
        "window_start": _iso(_cache["window_start"]),
        "window_end": _iso(_cache["window_end"]),
        "tenants": sorted(_cache["tenants"]),
    }


async def _ensure_enabled_key(db: AsyncSession) -> None:
    """tenant_config_overrides.key_name FKs system_configs.key_name, so the global
    row must exist before any per-tenant override can be inserted."""
    await db.execute(
        pg_insert(SystemConfig)
        .values(
            key_name=_KEY_ENABLED,
            value=False,
            value_type="bool",
            category="maintenance",
            description="Global maintenance mode — blocks all non-admin API access.",
        )
        .on_conflict_do_nothing(index_elements=[SystemConfig.key_name])
    )


async def _upsert(db: AsyncSession, key: str, value, value_type: str) -> None:
    await db.execute(
        pg_insert(SystemConfig)
        .values(key_name=key, value=value, value_type=value_type, category="maintenance")
        .on_conflict_do_update(index_elements=[SystemConfig.key_name], set_={"value": value})
    )


async def set_global(db: AsyncSession, enabled: bool, message: str | None = None) -> None:
    await _ensure_enabled_key(db)
    await _upsert(db, _KEY_ENABLED, enabled, "bool")
    if message is not None:
        await _upsert(db, _KEY_MESSAGE, message, "string")
    await db.commit()
    _cache["ts"] = 0.0


async def set_schedule(
    db: AsyncSession,
    window_start: datetime | None,
    window_end: datetime | None,
    message: str | None = None,
) -> None:
    """Set (or clear, with None) the scheduled window. Stored as UTC ISO; "" = unset."""
    await _ensure_enabled_key(db)
    await _upsert(db, _KEY_WINDOW_START, _iso(window_start) or "", "string")
    await _upsert(db, _KEY_WINDOW_END, _iso(window_end) or "", "string")
    if message is not None:
        await _upsert(db, _KEY_MESSAGE, message, "string")
    await db.commit()
    _cache["ts"] = 0.0


async def end_now(db: AsyncSession) -> None:
    """Reopen immediately: clear the manual switch and the scheduled window.
    Covers both 'finished early' and 'cancel an upcoming window'."""
    await _ensure_enabled_key(db)
    await _upsert(db, _KEY_ENABLED, False, "bool")
    await _upsert(db, _KEY_WINDOW_START, "", "string")
    await _upsert(db, _KEY_WINDOW_END, "", "string")
    await db.commit()
    _cache["ts"] = 0.0


async def set_tenant(db: AsyncSession, tenant_id: str, enabled: bool) -> None:
    await _ensure_enabled_key(db)
    await db.execute(
        pg_insert(TenantConfigOverride)
        .values(tenant_id=tenant_id, key_name=_KEY_ENABLED, value=enabled)
        .on_conflict_do_update(
            index_elements=[TenantConfigOverride.tenant_id, TenantConfigOverride.key_name],
            set_={"value": enabled},
        )
    )
    await db.commit()
    _cache["ts"] = 0.0
