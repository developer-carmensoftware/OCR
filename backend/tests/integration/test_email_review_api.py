"""Integration tests for the review queue a BU sees at #/CreditCardOCR.

  GET /api/v1/email/documents        — what is waiting for a human
  GET /api/v1/email/documents/{id}   — one document, with the payload the screen edits
  GET /api/v1/email/status           — which of the page's four states to render

The one that matters most is isolation. `GET /documents/{id}` is the only endpoint in the
application that hands back extracted line items, so "the row exists but belongs to
another BU" must be indistinguishable from "no such row" — and the filter has to live in
the WHERE clause, not in an `if` after the fetch.
"""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth.session import SessionInfo
from app.routers import email_review
from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/email"
AUTH = {"Authorization": "Bearer dummy"}
TENANT = str(uuid.uuid4())

# FAKE_SESSION's tenant_id is deliberately not a UUID (see the integration conftest), and
# this router parses it, so these tests bring their own.
SESSION = SessionInfo(
    session_id="sess-review",
    carmen_token="tok",
    carmen_user_id="u-review",
    username="reviewer",
    tenant_id=TENANT,
    carmen_uri="https://test.carmenwork.com",
    bu="BU01",
)


def _doc(**overrides):
    payload = {
        "extracted": {
            "doc_no": "INV-001",
            "doc_date": "15/01/2026",
            "details": [
                {
                    "transaction": "Visa",
                    "pay_amt": "1,000.00",
                    "commis_amt": "30.00",
                    "tax_amt": "2.10",
                    "total": "967.90",
                },
                {
                    "transaction": "JCB",
                    "pay_amt": "500.50",
                    "commis_amt": "15.00",
                    "tax_amt": "1.05",
                    "total": "484.45",
                },
            ],
        },
        "flags": ["mapping_guessed"],
    }
    defaults = dict(
        id=uuid.uuid4(),
        created_at=datetime.now(UTC),
        attachment="statement_july.pdf",
        status="pending_review",
        bank_code="KTC",
        doc_no="INV-001",
        jv_no=None,
        reason_code=None,
        error_message=None,
        reviewed_by_name=None,
        reviewed_at=None,
        review_payload=payload,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _paginated(rows, total=None):
    """Stub `paginate`, which is the only DB contact the list endpoint has."""

    async def _fake(db, stmt, limit, offset):
        return list(rows), total if total is not None else len(rows)

    return _fake


# ── GET /documents ───────────────────────────────────────────────────────────


def test_the_queue_reports_the_gross_total_not_the_net(monkeypatch):
    """Σ pay_amt is what lands on the credit side of the JV, so it is the number a
    reviewer is agreeing to. Summing `total` instead would show the net and quietly
    understate every row."""
    monkeypatch.setattr(email_review, "paginate", _paginated([_doc()]))
    with make_test_client(make_mock_db(), session=SESSION) as client:
        body = client.get(f"{BASE}/documents", headers=AUTH).json()

    assert body["total"] == 1
    row = body["data"][0]
    assert row["total"] == 1500.50
    assert row["line_count"] == 2
    assert row["flags"] == ["mapping_guessed"]
    assert row["doc_date"] == "15/01/2026"


def test_a_row_whose_payload_vanished_still_renders(monkeypatch):
    """Someone else's approve clears `review_payload` on the way to `posted`. A queue
    that 500s on the losing side of that race is worse than one showing a bare row."""
    monkeypatch.setattr(email_review, "paginate", _paginated([_doc(review_payload=None)]))
    with make_test_client(make_mock_db(), session=SESSION) as client:
        resp = client.get(f"{BASE}/documents", headers=AUTH)

    assert resp.status_code == 200
    row = resp.json()["data"][0]
    assert row["total"] == 0.0
    assert row["line_count"] == 0
    assert row["flags"] == []


def test_the_queue_asks_only_for_this_tenants_pending_rows(monkeypatch):
    """The filter must be in the statement. Asserted on the compiled SQL because a
    tenant filter applied after the fetch is the bug this endpoint cannot afford."""
    seen = {}

    async def _capture(db, stmt, limit, offset):
        seen["sql"] = str(stmt)
        seen["params"] = stmt.compile().params
        return [], 0

    monkeypatch.setattr(email_review, "paginate", _capture)
    with make_test_client(make_mock_db(), session=SESSION) as client:
        client.get(f"{BASE}/documents", headers=AUTH)

    assert "tenant_id" in seen["sql"] and "status" in seen["sql"]
    assert uuid.UUID(TENANT) in seen["params"].values()
    # The status filter is an IN over the tab's statuses now, so it binds as a list.
    assert ["pending_review"] in seen["params"].values()


# ── GET /documents/{id} ──────────────────────────────────────────────────────


def test_opening_a_document_returns_the_payload_the_screen_edits():
    db = make_mock_db()
    db.scalar.return_value = _doc()
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}/documents/{uuid.uuid4()}", headers=AUTH).json()

    # The raw /extract shape, which is what applyExtractedData consumes.
    assert body["extracted"]["doc_no"] == "INV-001"
    assert len(body["extracted"]["details"]) == 2


def test_another_bus_document_is_a_404_not_a_403():
    """A 403 confirms the row exists. For the one endpoint that returns line items, the
    answer to "is this document yours" must not leak whether it is anyone's."""
    db = make_mock_db()
    db.scalar.return_value = None  # the WHERE clause matched nothing
    with make_test_client(db, session=SESSION) as client:
        resp = client.get(f"{BASE}/documents/{uuid.uuid4()}", headers=AUTH)

    assert resp.status_code == 404


def test_a_document_that_is_no_longer_pending_is_a_404():
    """Same query, same answer: once approved or rejected there is no payload left to
    hand back, so the review screen must be told to go away rather than shown a blank."""
    db = make_mock_db()
    db.scalar.return_value = None
    with make_test_client(db, session=SESSION) as client:
        assert client.get(f"{BASE}/documents/{uuid.uuid4()}", headers=AUTH).status_code == 404


# ── GET /status ──────────────────────────────────────────────────────────────


def test_status_reuses_the_settings_services_blockers(monkeypatch):
    """Re-deriving "is this BU set up" here would let the queue screen and the settings
    screen disagree about it."""
    db = make_mock_db()
    db.get.return_value = MagicMock(id=uuid.UUID(TENANT))
    # One grouped count over the raw ledger statuses; the endpoint folds them into tabs.
    grouped = MagicMock()
    grouped.all.return_value = [
        SimpleNamespace(status="pending_review", n=3),
        SimpleNamespace(status="posted", n=7),
        SimpleNamespace(status="failed", n=1),
        SimpleNamespace(status="rejected", n=2),
        SimpleNamespace(status="skipped", n=101),
    ]
    db.execute.return_value = grouped

    async def _settings(db_, tenant):
        return None

    async def _body(db_, tenant, row):
        return {
            "enabled": True,
            "auto_post": False,
            "entitled": True,
            "ingest_address": "AIAGENT+a1b2c3d4@carmensoftware.com",
            "status": {"ready": False, "blockers": ["no_rule"]},
        }

    monkeypatch.setattr(email_review.es, "get_settings", _settings)
    monkeypatch.setattr(email_review.es, "build_settings_response", _body)
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}/status", headers=AUTH).json()

    assert body == {
        "enabled": True,
        "auto_post": False,
        "entitled": True,
        "ingest_address": "AIAGENT+a1b2c3d4@carmensoftware.com",
        "blockers": ["no_rule"],
        # `problem` is the union of failed + rejected: they differ in who decided, which
        # the row shows, but not in what is now owed.
        "counts": {"review": 3, "posted": 7, "problem": 3, "skipped": 101},
    }


# ── Tabs ─────────────────────────────────────────────────────────────────────


def test_each_tab_asks_for_its_own_statuses(monkeypatch):
    """`problem` and `skipped` are unions, so the filter has to be an IN, not an equals.

    Grouped by what the answer means to the person looking rather than by which code path
    wrote it: `failed` and `rejected` differ in who said no, which the row shows, but not
    in what is now owed.
    """
    seen: dict[str, object] = {}

    async def _capture(db, stmt, limit, offset):
        seen["params"] = stmt.compile().params
        return [], 0

    monkeypatch.setattr(email_review, "paginate", _capture)
    for tab, expected in [
        ("review", ["pending_review"]),
        ("posted", ["posted"]),
        ("problem", ["failed", "rejected"]),
        ("skipped", ["skipped", "received"]),
    ]:
        with make_test_client(make_mock_db(), session=SESSION) as client:
            client.get(f"{BASE}/documents?tab={tab}", headers=AUTH)
        assert expected in seen["params"].values(), tab


def test_an_unknown_tab_lands_on_the_useful_one(monkeypatch):
    """The tab is a UI detail carried in a query string. A stale bookmark or a renamed
    tab should show the work, not a 422 — nothing here is a correctness boundary."""
    seen: dict[str, object] = {}

    async def _capture(db, stmt, limit, offset):
        seen["params"] = stmt.compile().params
        return [], 0

    monkeypatch.setattr(email_review, "paginate", _capture)
    with make_test_client(make_mock_db(), session=SESSION) as client:
        resp = client.get(f"{BASE}/documents?tab=nonsense", headers=AUTH)
    assert resp.status_code == 200
    assert ["pending_review"] in seen["params"].values()


def test_a_resolved_row_reports_its_ledger_columns_not_a_zero_amount(monkeypatch):
    """`_finish` clears review_payload on every terminal transition, so a posted document
    has no amount, no date and no line count. Reporting `total: 0.00` would not be a
    missing value, it would be a wrong one — the row shows the JV number instead."""
    posted = _doc(
        status="posted",
        review_payload=None,
        jv_no="JV-9001",
        reviewed_by_name="somchai",
    )
    monkeypatch.setattr(email_review, "paginate", _paginated([posted]))
    with make_test_client(make_mock_db(), session=SESSION) as client:
        row = client.get(f"{BASE}/documents?tab=posted", headers=AUTH).json()["data"][0]

    assert row["status"] == "posted"
    assert row["jv_no"] == "JV-9001"
    assert row["reviewed_by_name"] == "somchai"
    assert row["total"] == 0.0 and row["doc_date"] is None and row["flags"] == []


# ── The auto-post switch ─────────────────────────────────────────────────────


def test_this_router_cannot_write_the_switch():
    """It is readable here (`GET /status`) and writable in exactly one place —
    `PUT /api/v1/carmen/settings`, Carmen's own settings screen.

    Two writers for one boolean is what the route this replaces cost us: `SettingsIn` is
    a full replace that defaulted the field to False, so every unrelated settings save
    turned review back on for a BU that had deliberately switched it off. Deleting the
    second writer is half the fix; merge-on-omit in `save_settings` is the other half.
    """
    paths = {r.path for r in email_review.router.routes}
    assert f"{BASE}/settings/auto-post" not in paths
