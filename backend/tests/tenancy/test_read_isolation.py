"""G2 — can BU-B read, or act on, a row BU-A owns?

Every row here is real, written to the real table. The request is a real HTTP round trip
through the real router into the real WHERE clause. The only thing faked is which BU the
caller is, which is exactly the thing under test.

The bar is **404, not 403**: for an id somebody could enumerate, "that row is not yours"
and "there is no such row" must be indistinguishable, or the response confirms existence.
"""

import uuid

import pytest
from sqlalchemy import text

from .conftest import AUTH, real_client, run, session_for

CC = "/api/v1/credit-card"
EMAIL = "/api/v1/email"
CREDITS = "/api/v1/credits"
CONFIG = "/api/v1/config"


# ── Fixtures: one of everything, owned by A; one of everything, owned by B ────


class Rows:
    def __init__(self, d):
        self.__dict__.update(d)


@pytest.fixture(scope="module")
def rows(real_engine, tenants):
    """Seed a matched pair of rows for each tenant so every assertion has both sides:
    B must be refused A's row *and* still be served its own."""
    made = {}

    async def _seed():
        async with real_engine.begin() as conn:
            for label, tid in (("a", tenants.a), ("b", tenants.b)):
                task_id = uuid.uuid4()
                card_id = uuid.uuid4()
                doc_id = uuid.uuid4()
                order_id = uuid.uuid4()
                notif_id = uuid.uuid4()

                await conn.execute(
                    text(
                        "insert into ocr_tasks (id, tenant_id, module_id, original_filename,"
                        " status, charged_docs, created_at, updated_at)"
                        " values (:id, :t, 'credit_card_ocr', :fn, 'completed', 1, now(), now())"
                    ),
                    {"id": task_id, "t": tid, "fn": f"{label}-statement.pdf"},
                )
                await conn.execute(
                    text(
                        "insert into credit_cards (id, tenant_id, task_id, bank_code, doc_no,"
                        " company_name, submitted_at, created_at, updated_at)"
                        " values (:id, :t, :task, 'KTC', :doc, :co, now(), now(), now())"
                    ),
                    {
                        "id": card_id,
                        "t": tid,
                        "task": task_id,
                        "doc": f"DOC-{label.upper()}-001",
                        "co": f"Company {label.upper()}",
                    },
                )
                await conn.execute(
                    text(
                        "insert into email_documents (id, tenant_id, message_id, attachment,"
                        " status, bank_code, doc_no, review_payload, created_at, updated_at)"
                        " values (:id, :t, :msg, :att, 'pending_review', 'KTC', :doc,"
                        " cast(:payload as jsonb), now(), now())"
                    ),
                    {
                        "id": doc_id,
                        "t": tid,
                        "msg": f"<{label}-msg@iso.test>",
                        "att": f"{label}.pdf",
                        "doc": f"EDOC-{label.upper()}-001",
                        "payload": (
                            f'{{"extracted": {{"doc_no": "EDOC-{label.upper()}-001",'
                            f' "details": [{{"transaction": "SECRET-{label.upper()}",'
                            f' "pay_amt": "1000.00"}}]}}}}'
                        ),
                    },
                )
                await conn.execute(
                    text(
                        "insert into credit_orders (id, tenant_id, pack_code, credits,"
                        " amount_thb, status, billing_period, created_at, updated_at)"
                        " values (:id, :t, 'pack_small', 100, 1000, 'in_progress', 'monthly',"
                        " now(), now())"
                    ),
                    {"id": order_id, "t": tid},
                )
                await conn.execute(
                    text(
                        "insert into user_notifications (id, tenant_id, type, payload,"
                        " created_at) values (:id, :t, 'order_approved',"
                        " cast(:p as jsonb), now())"
                    ),
                    {"id": notif_id, "t": tid, "p": f'{{"note": "{label}"}}'},
                )
                await conn.execute(
                    text(
                        "insert into consent_logs (tenant_id, carmen_user_id, consent_version,"
                        " created_at) values (:t, :u, 'v2', now())"
                    ),
                    {"t": tid, "u": f"user-{label}"},
                )
                # The mapping row itself carries no name — the distinguishing value
                # has to live in its child entry, which is also the join a leak would
                # have to cross.
                map_id = await conn.scalar(
                    text(
                        "insert into ap_vendor_column_mappings (tenant_id, vendor_tax_id,"
                        " created_at, updated_at) values (:t, :vat, now(), now())"
                        " returning id"
                    ),
                    {"t": tid, "vat": "0999900000009"},
                )
                await conn.execute(
                    text(
                        "insert into ap_vendor_field_mapping_entries (mapping_id,"
                        " column_name, field_name, created_at, updated_at)"
                        " values (:m, :col, 'amount', now(), now())"
                    ),
                    {"m": map_id, "col": f"COL_{label.upper()}"},
                )
                made[label] = {
                    "task": str(task_id),
                    "card": str(card_id),
                    "doc": str(doc_id),
                    "order": str(order_id),
                    "notif": str(notif_id),
                }

    run(_seed())
    return Rows(made)


@pytest.fixture(scope="module")
def sess_a(tenants):
    return session_for(tenants.a, bu="bu-alpha", user="user-alpha")


@pytest.fixture(scope="module")
def sess_b(tenants):
    return session_for(tenants.b, bu="bu-beta", user="user-beta")


# ── OCR task ─────────────────────────────────────────────────────────────────


def test_a_reads_its_own_task(rows, sess_a):
    with real_client(sess_a) as c:
        r = c.get(f"{CC}/tasks/{rows.a['task']}", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["original_filename"] == "a-statement.pdf"


def test_b_cannot_read_as_task(rows, sess_b):
    with real_client(sess_b) as c:
        r = c.get(f"{CC}/tasks/{rows.a['task']}", headers=AUTH)
    assert r.status_code == 404, r.text


def test_the_task_list_shows_only_the_callers_own(rows, sess_a, sess_b):
    with real_client(sess_a) as c:
        a_names = [
            t["original_filename"] for t in c.get(f"{CC}/tasks", headers=AUTH).json()["tasks"]
        ]
    with real_client(sess_b) as c:
        b_names = [
            t["original_filename"] for t in c.get(f"{CC}/tasks", headers=AUTH).json()["tasks"]
        ]

    assert "a-statement.pdf" in a_names
    assert "b-statement.pdf" not in a_names
    assert "b-statement.pdf" in b_names
    assert "a-statement.pdf" not in b_names


# ── Email review queue — the only endpoint that returns line items ───────────


def test_a_opens_its_own_parked_document(rows, sess_a):
    with real_client(sess_a) as c:
        r = c.get(f"{EMAIL}/documents/{rows.a['doc']}", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["extracted"]["details"][0]["transaction"] == "SECRET-A"


def test_b_cannot_open_as_parked_document(rows, sess_b):
    """The line-item payload is the most sensitive thing the API returns."""
    with real_client(sess_b) as c:
        r = c.get(f"{EMAIL}/documents/{rows.a['doc']}", headers=AUTH)
    assert r.status_code == 404, r.text
    assert "SECRET-A" not in r.text


def test_the_review_queue_lists_only_the_callers_own(rows, sess_a, sess_b):
    with real_client(sess_a) as c:
        a_docs = c.get(f"{EMAIL}/documents", headers=AUTH).json()["data"]
    with real_client(sess_b) as c:
        b_docs = c.get(f"{EMAIL}/documents", headers=AUTH).json()["data"]

    a_ids = {d["id"] for d in a_docs}
    b_ids = {d["id"] for d in b_docs}
    assert rows.a["doc"] in a_ids and rows.a["doc"] not in b_ids
    assert rows.b["doc"] in b_ids and rows.b["doc"] not in a_ids


def test_b_cannot_approve_as_document(rows, sess_b):
    """Approve posts a JV to Carmen. Reaching another BU's row here would post their
    document under this BU's credential.

    The body has to be well-formed: a 422 would prove only that the schema rejected it,
    not that the ownership check held.
    """
    body = {"extracted": {"doc_no": "EDOC-A-001", "details": []}, "rows": []}
    with real_client(sess_b) as c:
        r = c.post(f"{EMAIL}/documents/{rows.a['doc']}/approve", headers=AUTH, json=body)
    assert r.status_code == 404, r.text


def test_b_cannot_reject_as_document(rows, sess_b):
    with real_client(sess_b) as c:
        r = c.post(
            f"{EMAIL}/documents/{rows.a['doc']}/reject", headers=AUTH, json={"reason": "nope"}
        )
    assert r.status_code == 404, r.text


def test_as_document_is_still_pending_after_bs_attempts(rows, real_engine):
    """The refusals above must not have half-applied."""

    async def _status():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text("select status from email_documents where id = :i"), {"i": rows.a["doc"]}
            )

    assert run(_status()) == "pending_review"


# ── Credit orders ────────────────────────────────────────────────────────────


def test_a_reads_its_own_order(rows, sess_a):
    with real_client(sess_a) as c:
        assert c.get(f"{CREDITS}/orders/{rows.a['order']}", headers=AUTH).status_code == 200


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "", None),
        ("get", "/documents", None),
        ("post", "/cancel", {}),
    ],
)
def test_b_cannot_touch_as_order(rows, sess_b, method, path, body):
    with real_client(sess_b) as c:
        r = getattr(c, method)(
            f"{CREDITS}/orders/{rows.a['order']}{path}",
            headers=AUTH,
            **({"json": body} if body is not None else {}),
        )
    assert r.status_code == 404, f"{method} {path} -> {r.status_code} {r.text}"


def test_the_order_list_shows_only_the_callers_own(rows, sess_a, sess_b):
    with real_client(sess_a) as c:
        a_ids = {o["id"] for o in c.get(f"{CREDITS}/orders", headers=AUTH).json()["data"]}
    with real_client(sess_b) as c:
        b_ids = {o["id"] for o in c.get(f"{CREDITS}/orders", headers=AUTH).json()["data"]}
    assert rows.a["order"] in a_ids and rows.a["order"] not in b_ids
    assert rows.b["order"] in b_ids and rows.b["order"] not in a_ids


def test_as_order_is_untouched_after_bs_cancel_attempt(rows, real_engine):
    async def _status():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text("select status from credit_orders where id = :i"), {"i": rows.a["order"]}
            )

    assert run(_status()) == "in_progress"


# ── Notifications ────────────────────────────────────────────────────────────


def test_the_bell_shows_only_the_callers_own(rows, sess_a, sess_b):
    with real_client(sess_a) as c:
        a_ids = {n["id"] for n in c.get("/api/v1/notifications", headers=AUTH).json()["data"]}
    with real_client(sess_b) as c:
        b_ids = {n["id"] for n in c.get("/api/v1/notifications", headers=AUTH).json()["data"]}
    assert rows.a["notif"] in a_ids and rows.a["notif"] not in b_ids
    assert rows.b["notif"] in b_ids and rows.b["notif"] not in a_ids


def test_b_marking_as_notification_read_does_nothing(rows, sess_b, real_engine):
    with real_client(sess_b) as c:
        r = c.post("/api/v1/notifications/mark-read", headers=AUTH, json={"ids": [rows.a["notif"]]})
    assert r.status_code in (200, 204), r.text

    async def _read_at():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text("select read_at from user_notifications where id = :i"),
                {"i": rows.a["notif"]},
            )

    assert run(_read_at()) is None, "BU-B marked BU-A's notification as read"


# ── Accounting config & vendor mappings ──────────────────────────────────────


def test_bs_accounting_config_is_empty_while_as_is_not(sess_a, sess_b):
    with real_client(sess_a) as c:
        a_cfg = c.get(f"{CONFIG}/accounting", headers=AUTH).json()
    with real_client(sess_b) as c:
        b_cfg = c.get(f"{CONFIG}/accounting", headers=AUTH).json()

    assert a_cfg.get("filePrefix") == "ALPHA" or a_cfg.get("file_prefix") == "ALPHA", a_cfg
    assert (b_cfg.get("filePrefix") or b_cfg.get("file_prefix")) in (None, "")


def test_the_same_vendor_tax_id_resolves_per_bu(rows, sess_a, sess_b):
    """Both BUs mapped the SAME vendor tax id — the case where a missing tenant filter
    silently serves one BU the other's column mapping."""
    with real_client(sess_a) as c:
        a = c.get(f"{CONFIG}/ap-mapping/0999900000009", headers=AUTH).json()
    with real_client(sess_b) as c:
        b = c.get(f"{CONFIG}/ap-mapping/0999900000009", headers=AUTH).json()

    assert a["mapping"] == {"COL_A": "amount"}, a
    assert b["mapping"] == {"COL_B": "amount"}, b


# ── Consent ──────────────────────────────────────────────────────────────────


def test_consent_status_is_per_tenant(rows, tenants, sess_a):
    """A has a v2 consent row; C has none. Same version, opposite answers."""
    with real_client(sess_a) as c:
        a = c.get("/api/v1/consent/status?version=v2", headers=AUTH).json()
    with real_client(session_for(tenants.c, bu="bu-alpha", user="user-c")) as c:
        cc = c.get("/api/v1/consent/status?version=v2", headers=AUTH).json()

    assert a.get("consented") is True, a
    assert cc.get("consented") is False, cc


# ── Activity feed (the module landing page) ──────────────────────────────────


def test_the_activity_feed_never_carries_another_bus_document(rows, sess_b):
    with real_client(sess_b) as c:
        r = c.get(f"{CC}/activity?limit=100", headers=AUTH)
    assert r.status_code == 200, r.text
    body = r.text
    assert "DOC-A-001" not in body
    assert "EDOC-A-001" not in body
    assert "Company A" not in body


def test_the_activity_feed_shows_the_callers_own(rows, sess_a):
    with real_client(sess_a) as c:
        r = c.get(f"{CC}/activity?limit=100", headers=AUTH)
    assert r.status_code == 200, r.text
    assert "DOC-A-001" in r.text or "EDOC-A-001" in r.text


# ── Empty tenant control ─────────────────────────────────────────────────────


def test_a_tenant_that_owns_nothing_sees_nothing(rows, tenants):
    """BU-C has no business rows at all. Every list must be empty for it — the control
    that proves the assertions above are not passing by accident."""
    sess_c = session_for(tenants.c, bu="bu-alpha", user="user-c")
    with real_client(sess_c) as c:
        assert c.get(f"{CC}/tasks", headers=AUTH).json()["total"] == 0
        assert c.get(f"{EMAIL}/documents", headers=AUTH).json()["total"] == 0
        assert c.get(f"{CREDITS}/orders", headers=AUTH).json()["total"] == 0
        assert c.get("/api/v1/notifications", headers=AUTH).json()["total"] == 0


def test_a_random_uuid_is_a_404_everywhere(sess_a):
    """The shape of "not found" must match the shape of "not yours"."""
    ghost = str(uuid.uuid4())
    with real_client(sess_a) as c:
        assert c.get(f"{CC}/tasks/{ghost}", headers=AUTH).status_code == 404
        assert c.get(f"{EMAIL}/documents/{ghost}", headers=AUTH).status_code == 404
        assert c.get(f"{CREDITS}/orders/{ghost}", headers=AUTH).status_code == 404
