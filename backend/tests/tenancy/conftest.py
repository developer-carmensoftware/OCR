"""Cross-tenant isolation suite — the only tests in this repo that use a real database.

Every other test in `backend/tests/` runs against `make_mock_db()`, which returns whatever
row the test seeded regardless of the WHERE clause. That can prove a statement *mentions*
`tenant_id`; it cannot prove BU-B is unable to read BU-A's row, because the mock, not the
database, decides what comes back. This package exists to answer that second question.

Three tenants are seeded on hosts of their own, so nothing here can collide with the real
dev BUs on `dev.carmen4.com`:

    BU-A  isolation-test.local  / bu-alpha   ingest on,  auto_post ON,   subscription
    BU-B  isolation-test.local  / bu-beta    ingest on,  auto_post OFF,  credit balance
    BU-C  isolation-test2.local / bu-alpha   ingest off                  (same bu_code as A)

BU-C carries the *same* `bu_code` as BU-A on a different host. `(host, bu_code)` is the
tenant key, so those must be two distinct rows — a property no dev BU exercises today
(all eight sit on one host) and therefore one no test has ever checked.

Teardown deletes exactly the rows these tenants own, children first. Nothing else on the
dev database is touched for mutation; the two real BUs holding live Carmen tokens are only
ever read.

Run with:  pytest tests/tenancy -q
"""

import asyncio
import os
import sys
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ── Safety rail ───────────────────────────────────────────────────────────────
# The suite writes real rows. Point it at production and it would seed tenants there.
PROD_PROJECT_REF = "lhlncsjqxttcdegkqvid"

TEST_HOST = "isolation-test.local"
TEST_HOST_2 = "isolation-test2.local"

AUTH = {"Authorization": "Bearer iso"}

# Opt-in. CI runs `pytest tests/` with a dummy `DATABASE_URL` that nothing listens on
# ("tests mock all external calls" — .github/workflows/ci.yml), so this package has to
# stay out of that run by default rather than fail it. `tests/tenancy/_run.py` sets the
# flag; so does anyone who means it.
ENV_FLAG = "TENANCY_DB_TESTS"


def pytest_collection_modifyitems(config, items):
    if os.getenv(ENV_FLAG) == "1":
        return
    here = str(Path(__file__).parent)
    skip = pytest.mark.skip(
        reason=f"real-database tenancy suite — run with {ENV_FLAG}=1 (see tests/tenancy/_run.py)"
    )
    for item in items:
        if str(item.fspath).startswith(here):
            item.add_marker(skip)


def _test_db_url() -> str:
    """The dev database, forced onto the transaction pooler.

    Port 6543 rather than the 5432 session pooler on purpose: session mode maps one pooled
    connection to one Postgres backend against a 15-connection project cap, so a test run
    while `uvicorn` is up hits `EMAXCONNSESSION`. Transaction mode does not, at the cost of
    prepared statements — hence `statement_cache_size=0`.
    """
    from app.config import settings

    url = settings.database_url
    if PROD_PROJECT_REF in url:
        pytest.exit(f"tenancy suite refuses to run against production ({PROD_PROJECT_REF})", 1)
    return url.replace(":5432/", ":6543/")


def run(coro):
    """Drive one coroutine on a throwaway loop.

    The suite's DB work is sync-fixture shaped (seed, inspect, purge) while the app under
    test runs on TestClient's own loop in another thread. With NullPool there is no pooled
    connection to strand, so a fresh loop per call keeps the two apart safely.
    """
    return asyncio.run(coro)


# ── Engine ────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def real_engine():
    """Install a real engine into `app.database`'s module globals.

    `_get_engine()` is lazy, so assigning the globals before any test touches the DB
    redirects BOTH consumption styles at once: routers using `Depends(get_db)` *and* the
    ~10 services that call `async_session()` directly and would otherwise bypass a
    `dependency_overrides` swap entirely.

    **NullPool, deliberately.** asyncpg connections are bound to the event loop that
    created them, and `TestClient` runs the ASGI app on its own loop in another thread — a
    pooled connection opened while seeding would be handed to a different loop on the
    first request and blow up. NullPool opens per checkout and closes on return, which
    also keeps the suite well under Supavisor's 15-connection cap while `uvicorn` runs.
    """
    import app.database as db_mod

    url = _test_db_url()
    engine = create_async_engine(
        url + ("&" if "?" in url else "?") + "prepared_statement_cache_size=0",
        poolclass=NullPool,
        connect_args={"statement_cache_size": 0},
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    prev_engine, prev_factory = db_mod._ENGINE, db_mod._SESSION_FACTORY
    db_mod._ENGINE, db_mod._SESSION_FACTORY = engine, factory
    db_mod._DB_INITIALIZED = True

    yield engine

    run(engine.dispose())
    db_mod._ENGINE, db_mod._SESSION_FACTORY = prev_engine, prev_factory


# ── Cleanup ───────────────────────────────────────────────────────────────────

# Children first. `email_documents` FKs `ocr_tasks`; `credit_cards`/`ap_invoices` do too.
_CLEANUP_ORDER = [
    "email_documents",
    "credit_cards",
    "ap_invoices",
    "ocr_tasks",
    "email_queue_seen",
    "email_ingest_settings",
    "correction_feedback",
    "bug_reports",
    "consent_logs",
    "user_notifications",
    "credit_ledger",
    "billing_documents",
    "credit_orders",
    "tenant_subscriptions",
    "tenant_credits",
    "tenant_modules",
    "tenant_config_overrides",
    "ap_vendor_column_mappings",
    "bu_accounting_configs",
    "ocr_sessions",
]

# These hang off a parent config row, not off tenant_id.
_CLEANUP_BY_PARENT = [
    ("bu_accounting_mapping_entries", "config_id", "bu_accounting_configs"),
    ("ap_vendor_field_mapping_entries", "mapping_id", "ap_vendor_column_mappings"),
]


async def _purge(conn, ids):
    for table, fk, parent in _CLEANUP_BY_PARENT:
        await conn.execute(
            text(
                f"delete from {table} where {fk} in "
                f"(select id from {parent} where tenant_id = any(:ids))"
            ),
            {"ids": ids},
        )
    for table in _CLEANUP_ORDER:
        await conn.execute(text(f"delete from {table} where tenant_id = any(:ids)"), {"ids": ids})
    await conn.execute(text("delete from tenants where id = any(:ids)"), {"ids": ids})


# ── Seed ──────────────────────────────────────────────────────────────────────


class Tenants:
    """The three seeded tenants, plus the facts a test asserts against."""

    def __init__(self, a, b, c):
        self.a, self.b, self.c = a, b, c

    def all(self):
        return [self.a, self.b, self.c]


@pytest.fixture(scope="session")
def tenants(real_engine):
    """Seed BU-A / BU-B / BU-C and hand back their ids. Purged on the way out."""
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    ids = [a, b, c]
    now = datetime.now(UTC)

    async def _seed():
        async with real_engine.begin() as conn:
            # A crashed earlier run may have left rows behind under the same hosts.
            stale = (
                (
                    await conn.execute(
                        text("select id from tenants where host = any(:hosts)"),
                        {"hosts": [TEST_HOST, TEST_HOST_2]},
                    )
                )
                .scalars()
                .all()
            )
            if stale:
                await _purge(conn, list(stale))

            await conn.execute(
                text(
                    "insert into tenants (id, host, bu_code, name, plan, is_active,"
                    " created_at, updated_at)"
                    " values (:id, :host, :bu, :name, 'free', true, now(), now())"
                ),
                [
                    {"id": a, "host": TEST_HOST, "bu": "bu-alpha", "name": "Isolation A"},
                    {"id": b, "host": TEST_HOST, "bu": "bu-beta", "name": "Isolation B"},
                    # Same bu_code as A, different host — must be its own tenant.
                    {"id": c, "host": TEST_HOST_2, "bu": "bu-alpha", "name": "Isolation C"},
                ],
            )

            # modules: AP invoice explicitly OFF for A, ON for B, no row for C
            # (no row = enabled; `assert_module_enabled` is opt-out)
            await conn.execute(
                text(
                    "insert into tenant_modules (tenant_id, module_id, enabled, created_at,"
                    " updated_at) values (:t, :m, :e, now(), now())"
                ),
                [
                    {"t": a, "m": "ap_invoice", "e": False},
                    {"t": a, "m": "credit_card_ocr", "e": True},
                    {"t": b, "m": "ap_invoice", "e": True},
                    {"t": b, "m": "credit_card_ocr", "e": True},
                ],
            )

            # funding: A on a subscription, B on balance only, C on nothing
            await conn.execute(
                text(
                    "insert into tenant_credits (tenant_id, balance, credits_purchased,"
                    " credits_consumed, created_at, updated_at)"
                    " values (:t, :bal, 0, 0, now(), now())"
                ),
                [{"t": a, "bal": 0}, {"t": b, "bal": 25}, {"t": c, "bal": 0}],
            )
            await conn.execute(
                text(
                    "insert into tenant_subscriptions (id, tenant_id, plan_code, doc_allowance,"
                    " docs_used, period_start, period_end, billing_period, status, created_at,"
                    " updated_at) values (gen_random_uuid(), :t, 'sub_starter', 200, 0, :ps,"
                    " :pe, 'monthly', 'active', now(), now())"
                ),
                [{"t": a, "ps": now - timedelta(days=1), "pe": now + timedelta(days=29)}],
            )

            # email ingest: distinct tag, filename rule and TIN per BU
            await conn.execute(
                text(
                    "insert into email_ingest_settings (tenant_id, ingest_tag, enabled,"
                    " enabled_at, auto_post, owner_emails, tax_ids, rules, carmen_uri,"
                    " created_at, updated_at) values (:t, :tag, :en, :en_at, :ap,"
                    " cast(:owners as jsonb), cast(:tins as jsonb), cast(:rules as jsonb),"
                    " :uri, now(), now())"
                ),
                [
                    {
                        "t": a,
                        "tag": "isoalpha",
                        "en": True,
                        "en_at": now - timedelta(days=7),
                        "ap": True,
                        "owners": '["ap@alpha.example"]',
                        "tins": '["0999900000007"]',
                        "rules": (
                            '[{"bank_code": "KTC", "is_active": true,'
                            ' "filename_patterns": ["statement"]}]'
                        ),
                        "uri": f"https://{TEST_HOST}",
                    },
                    {
                        "t": b,
                        "tag": "isobeta",
                        "en": True,
                        "en_at": now - timedelta(days=7),
                        "ap": False,
                        "owners": "[]",
                        "tins": '["0999900000015"]',
                        "rules": (
                            '[{"bank_code": "GHL", "is_active": true,'
                            ' "filename_patterns": ["invoice"]}]'
                        ),
                        "uri": f"https://{TEST_HOST}",
                    },
                ],
            )

            # accounting config: only A has one; B must not see it
            await conn.execute(
                text(
                    "insert into bu_accounting_configs (tenant_id, bank_code, file_prefix,"
                    " file_source, description, branch, created_at, updated_at)"
                    " values (:t, 'KTC', 'ALPHA', 'ALPHASRC', 'Alpha only', '00000',"
                    " now(), now())"
                ),
                [{"t": a}],
            )

            # one session row each, so username_map has something to resolve
            await conn.execute(
                text(
                    "insert into ocr_sessions (id, tenant_id, carmen_user_id, username,"
                    " carmen_token_encrypted, carmen_uri, is_active, created_at, updated_at)"
                    " values (gen_random_uuid(), :t, :cuid, :name, 'x', :uri, true, now(),"
                    " now())"
                ),
                [
                    {
                        "t": a,
                        "cuid": "user-alpha",
                        "name": "Alpha User",
                        "uri": f"https://{TEST_HOST}",
                    },
                    {
                        "t": b,
                        "cuid": "user-beta",
                        "name": "Beta User",
                        "uri": f"https://{TEST_HOST}",
                    },
                ],
            )

    run(_seed())
    yield Tenants(a, b, c)

    async def _teardown():
        async with real_engine.begin() as conn:
            await _purge(conn, ids)

    run(_teardown())


@contextmanager
def session_scope(engine):
    """A short-lived session for a test to seed or inspect rows with."""
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield factory


# ── Identities / clients ──────────────────────────────────────────────────────


def session_for(tenant_id, *, bu="bu-alpha", user="user-alpha", token="tok", uri=None):
    from app.auth.session import SessionInfo

    return SessionInfo(
        session_id=str(uuid.uuid4()),
        carmen_token=token,
        carmen_user_id=user,
        username=user,
        tenant_id=str(tenant_id),
        carmen_uri=uri or f"https://{TEST_HOST}",
        bu=bu,
    )


_ip = iter(range(1, 60000))


@pytest.fixture(autouse=True)
def _isolate_rate_limiter():
    """Same trick as the integration suite: a fresh client IP per test, so the
    process-wide sliding window cannot 429 an unrelated test."""

    def _unique(_request):
        n = next(_ip)
        return f"10.9.{n // 250 % 250}.{n % 250}"

    with patch("app.middleware.rate_limit.get_client_ip", side_effect=_unique):
        yield


@pytest.fixture(autouse=True)
def _maintenance_inactive():
    """A live maintenance flag on the dev DB would 503 every request here."""
    import time

    from app.services import maintenance_service as maint

    maint._cache.update(
        {
            "ts": time.monotonic() + 1_000_000,
            "enabled": False,
            "message": "",
            "window_start": None,
            "window_end": None,
            "tenants": set(),
        }
    )
    yield


@contextmanager
def real_client(session):
    """A TestClient wired to the REAL database, with only the session identity faked.

    `get_db` is deliberately NOT overridden — the whole point is that the WHERE clause
    meets real rows. Only the lifespan's network calls are stubbed.
    """
    from starlette.testclient import TestClient

    from app.auth.dependencies import get_current_session
    from app.main import app

    async def _session():
        from app.context import (
            current_carmen_token,
            current_carmen_uri,
            current_carmen_user_id,
            current_ocr_session_id,
            current_tenant_id,
            current_username,
        )

        current_tenant_id.set(session.tenant_id)
        current_carmen_user_id.set(session.carmen_user_id)
        current_username.set(session.username)
        current_ocr_session_id.set(session.session_id)
        current_carmen_token.set(session.carmen_token)
        current_carmen_uri.set(session.carmen_uri)
        return session

    with (
        patch("app.services.usage_service.fetch_openrouter_pricing", new_callable=AsyncMock),
        patch("app.lifecycle._perf_flush_loop", new_callable=AsyncMock),
        patch("app.lifecycle.asyncio.sleep", new_callable=AsyncMock),
        TestClient(app, raise_server_exceptions=True) as client,
    ):
        app.dependency_overrides[get_current_session] = _session
        try:
            yield client
        finally:
            app.dependency_overrides.clear()


@contextmanager
def admin_client(*, perms=None, tenant_scope=""):
    """TestClient authenticated as an admin, real DB, `tenant_scope` under test."""
    from starlette.testclient import TestClient

    from app.auth.admin_session import AdminPrincipal
    from app.main import app
    from app.routers.admin.deps import get_current_admin

    principal = AdminPrincipal(
        admin_id="admin-iso",
        username="iso@test.local",
        perms=perms
        or {
            "tenants:read",
            "tenants:write",
            "quotas:read",
            "quotas:write",
            "orders:read",
            "orders:write",
            "configs:read",
            "configs:write",
            "logs:read",
        },
        tenant_scope=tenant_scope,
    )

    async def _admin():
        return principal

    with (
        patch("app.services.usage_service.fetch_openrouter_pricing", new_callable=AsyncMock),
        patch("app.lifecycle._perf_flush_loop", new_callable=AsyncMock),
        patch("app.lifecycle.asyncio.sleep", new_callable=AsyncMock),
        TestClient(app, raise_server_exceptions=True) as client,
    ):
        app.dependency_overrides[get_current_admin] = _admin
        try:
            yield client
        finally:
            app.dependency_overrides.clear()
