"""G6 — a scoped admin is an admin who may only see one BU.

`AdminPrincipal.tenant_scope` is `""` for a global admin and a tenant UUID for a scoped
one. Three different idioms enforce it and they fail differently:

  (a) resolve-then-filter — silently narrows the query (`_resolve_tenant`)
  (b) post-fetch assert   — 403 or 404 after the row is already in hand (`_assert_scope`)
  (c) python-side filter  — the service returns every tenant and the router trims the list

`_assert_scope` alone guards seven endpoints and one of them had a test. This file walks
every scoped surface with an admin pinned to BU-A and asks for BU-B.
"""

import uuid

import pytest
from sqlalchemy import text

from .conftest import admin_client, run

ADMIN = "/api/v1/admin"


@pytest.fixture(scope="module")
def order_b(real_engine, tenants):
    """One credit order owned by BU-B, for the scoped-to-A admin to fail to reach."""
    oid = uuid.uuid4()

    async def _seed():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into credit_orders (id, tenant_id, pack_code, credits,"
                    " amount_thb, status, billing_period, created_at, updated_at)"
                    " values (:id, :t, 'pack_small', 100, 1000, 'in_progress', 'monthly',"
                    " now(), now())"
                ),
                {"id": oid, "t": tenants.b},
            )

    run(_seed())
    yield str(oid)

    async def _clean():
        async with real_engine.begin() as conn:
            await conn.execute(text("delete from credit_orders where id = :i"), {"i": oid})

    run(_clean())


def _scoped(tenants):
    return admin_client(tenant_scope=str(tenants.a))


def _global():
    return admin_client(tenant_scope="")


# ── Credits: the `_assert_scope` family ──────────────────────────────────────


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/tenants/{b}/credits"),
        ("get", "/tenants/{b}/credits/ledger"),
        ("post", "/tenants/{b}/credits/topup"),
        ("post", "/tenants/{b}/credits/adjust"),
    ],
)
def test_a_scoped_admin_cannot_reach_another_bus_credits(tenants, method, path):
    url = ADMIN + path.format(b=tenants.b)
    # Both writers need a well-formed body: a 422 would prove the schema rejected it,
    # not that the scope check held.
    body = {"pack_code": "pack_small", "delta": 5, "note": "iso"}
    with _scoped(tenants) as c:
        r = getattr(c, method)(url, **({"json": body} if method == "post" else {}))
    assert r.status_code in (403, 404), f"{method} {path} -> {r.status_code} {r.text}"


def test_a_scoped_admin_can_reach_its_own_bus_credits(tenants):
    with _scoped(tenants) as c:
        r = c.get(f"{ADMIN}/tenants/{tenants.a}/credits")
    assert r.status_code == 200, r.text


@pytest.mark.parametrize(
    "path",
    ["/credit-orders/{o}/slip-url", "/credit-orders/{o}/documents"],
)
def test_a_scoped_admin_cannot_read_another_bus_order(tenants, order_b, path):
    with _scoped(tenants) as c:
        r = c.get(ADMIN + path.format(o=order_b))
    assert r.status_code in (403, 404), f"{path} -> {r.status_code} {r.text}"


@pytest.mark.parametrize("verb", ["approve", "reject", "hold", "cancel"])
def test_a_scoped_admin_cannot_decide_another_bus_order(tenants, order_b, verb, real_engine):
    with _scoped(tenants) as c:
        r = c.post(f"{ADMIN}/credit-orders/{order_b}/{verb}", json={"reason": "iso"})
    assert r.status_code in (403, 404), f"{verb} -> {r.status_code} {r.text}"

    async def _status():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text("select status from credit_orders where id = :i"), {"i": order_b}
            )

    assert run(_status()) == "in_progress", f"{verb} changed another BU's order anyway"


def test_the_order_list_is_narrowed_to_the_scope(tenants, order_b):
    with _scoped(tenants) as c:
        ids = {o["id"] for o in c.get(f"{ADMIN}/credit-orders").json()["data"]}
    assert order_b not in ids

    with _global() as c:
        all_ids = {o["id"] for o in c.get(f"{ADMIN}/credit-orders?limit=200").json()["data"]}
    assert order_b in all_ids, "a global admin could not see the order either"


# ── Tenants / modules ────────────────────────────────────────────────────────


def test_a_scoped_admin_cannot_open_another_bus_tenant_page(tenants):
    with _scoped(tenants) as c:
        r = c.get(f"{ADMIN}/tenants/{tenants.b}")
    assert r.status_code in (403, 404), r.text


def test_the_tenant_list_is_narrowed_to_the_scope(tenants):
    with _scoped(tenants) as c:
        body = c.get(f"{ADMIN}/tenants?limit=200").json()
    ids = {t["id"] for t in (body.get("data") or body)}
    assert str(tenants.a) in ids
    assert str(tenants.b) not in ids


def test_a_scoped_admin_cannot_toggle_another_bus_module(tenants, real_engine):
    with _scoped(tenants) as c:
        r = c.put(f"{ADMIN}/tenants/{tenants.b}/modules/credit_card_ocr", json={"enabled": False})
    assert r.status_code in (403, 404), r.text

    async def _enabled():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text(
                    "select enabled from tenant_modules"
                    " where tenant_id = :t and module_id = 'credit_card_ocr'"
                ),
                {"t": tenants.b},
            )

    assert run(_enabled()) is True, "a scoped admin disabled another BU's module"


# ── Sessions ─────────────────────────────────────────────────────────────────


def test_the_session_list_is_narrowed_to_the_scope(tenants):
    with _scoped(tenants) as c:
        body = c.get(f"{ADMIN}/sessions?limit=200").json()
    rows = body.get("data") or []
    others = {r.get("tenant_id") for r in rows} - {str(tenants.a), None}
    assert str(tenants.b) not in others


def test_a_scoped_admin_cannot_revoke_another_bus_session(tenants, real_engine):
    async def _one():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text("select id from ocr_sessions where tenant_id = :t limit 1"),
                {"t": tenants.b},
            )

    sid = run(_one())
    assert sid is not None, "seed did not create a session for BU-B"

    with _scoped(tenants) as c:
        r = c.delete(f"{ADMIN}/sessions/{sid}")
    assert r.status_code in (403, 404), r.text

    async def _active():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text("select is_active from ocr_sessions where id = :i"), {"i": sid}
            )

    assert run(_active()) is True, "a scoped admin revoked another BU's session"


# ── Maintenance ──────────────────────────────────────────────────────────────


def test_a_scoped_admin_cannot_put_another_bu_into_maintenance(tenants, real_engine):
    """`PUT /admin/maintenance/tenant/{id}` takes a client-supplied tenant id. If it does
    not consult `tenant_scope`, an admin scoped to one BU can take another BU offline."""
    with _scoped(tenants) as c:
        r = c.put(f"{ADMIN}/maintenance/tenant/{tenants.b}", json={"enabled": True})

    async def _overridden():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text(
                    "select value from tenant_config_overrides"
                    " where tenant_id = :t and key_name = 'maintenance.enabled'"
                ),
                {"t": tenants.b},
            )

    landed = run(_overridden())

    # Clean up regardless of the verdict, so a failure here does not leave BU-B down.
    async def _clean():
        async with real_engine.begin() as conn:
            await conn.execute(
                text("delete from tenant_config_overrides where tenant_id = :t"),
                {"t": tenants.b},
            )

    run(_clean())

    assert r.status_code in (403, 404), (
        f"a scoped admin was allowed to switch maintenance for another BU "
        f"({r.status_code}); override written: {landed!r}"
    )


# ── Email ingestion ──────────────────────────────────────────────────────────


def test_the_email_document_list_is_narrowed_to_the_scope(tenants, real_engine):
    doc = uuid.uuid4()

    async def _seed():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into email_documents (id, tenant_id, message_id, attachment,"
                    " status, doc_no, created_at, updated_at) values (:i, :t,"
                    " '<scope@iso.test>', 'b.pdf', 'pending_review', 'SCOPE-B', now(), now())"
                ),
                {"i": doc, "t": tenants.b},
            )

    async def _clean():
        async with real_engine.begin() as conn:
            await conn.execute(text("delete from email_documents where id = :i"), {"i": doc})

    run(_seed())
    try:
        with _scoped(tenants) as c:
            body = c.get(f"{ADMIN}/email-ingest/documents?limit=200").text
        assert "SCOPE-B" not in body, "a scoped admin saw another BU's email document"
    finally:
        run(_clean())


def test_the_business_unit_list_does_not_hand_out_every_bus_ingest_tag(tenants):
    """That row carries the routing tag. Anyone holding a BU's tag can post documents
    into that BU by emailing them, so a scoped admin seeing every tag is a real key
    disclosure, not a listing cosmetic."""
    with _scoped(tenants) as c:
        r = c.get(f"{ADMIN}/email-ingest/business-units")
    if r.status_code in (403, 404):
        return
    assert "isobeta" not in r.text, (
        "a scoped admin was handed another BU's ingest tag, which is the credential "
        "for posting documents into that BU"
    )


# ── AR customer profiles ─────────────────────────────────────────────────────


def test_ar_profiles_are_not_handed_to_a_scoped_admin_wholesale(tenants):
    """These carry buyer names and tax IDs for every paying customer."""
    with _scoped(tenants) as c:
        r = c.get(f"{ADMIN}/ar-customer-profiles")
    assert r.status_code in (403, 404) or r.json() == [], (
        f"a scoped admin received {len(r.json())} AR customer profiles across all BUs"
    )


# ── The global admin still works ─────────────────────────────────────────────


def test_a_global_admin_reaches_both_bus(tenants):
    with _global() as c:
        assert c.get(f"{ADMIN}/tenants/{tenants.a}").status_code == 200
        assert c.get(f"{ADMIN}/tenants/{tenants.b}").status_code == 200
