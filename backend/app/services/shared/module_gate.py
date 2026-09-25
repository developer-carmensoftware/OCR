"""
Module access gate for tenant request contexts.

What used to live here — the `quotas`/`quota_usage` counter engine and its
check/consume/increment trio — went away with the free-trial quota
(migration 20260813000100). Documents are charged by
`credit_service.consume_document()`: subscription allowance first, then the
credit balance. There is no third pool and no counter to enforce.

  assert_module_enabled() — raise ModuleDisabled if an admin turned a module off
"""

import logging

from sqlalchemy import select

from app.database import async_session

logger = logging.getLogger(__name__)


def _ctx() -> str:
    from app.context import current_tenant_id

    return current_tenant_id.get() or ""


async def assert_module_enabled(module_id: str) -> None:
    """Gate: raise ModuleDisabled if an admin turned this module off for the tenant.

    Opt-out semantics — a module is blocked ONLY when tenant_modules has an explicit
    row with enabled=False. No row (the common case: most tenants have never had one
    written) means allowed, so turning enforcement on never locks out existing tenants.

    Fail-open on infra errors, exactly like consume_document: a transient DB hiccup must
    not block a scan. Only an explicit disabled row raises.
    """
    from app.exceptions import ModuleDisabled
    from app.models.catalog import TenantModule

    tenant_id = _ctx()
    if not tenant_id:
        return
    try:
        async with async_session() as db:
            enabled = (
                await db.execute(
                    select(TenantModule.enabled).where(
                        TenantModule.tenant_id == tenant_id,
                        TenantModule.module_id == module_id,
                    )
                )
            ).scalar_one_or_none()
    except Exception as exc:
        logger.error("assert_module_enabled failed (allowing): %s", exc)
        return
    if enabled is False:
        raise ModuleDisabled(module_id)
