"""
Integration tests for /api/v1/config/* endpoints.
Sync test functions using starlette TestClient as a context manager.
"""

from datetime import UTC
from unittest.mock import MagicMock

from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/config"
AUTH = {"Authorization": "Bearer dummy"}


def _scalar(row):
    r = MagicMock()
    r.scalar_one_or_none.return_value = row
    return r


def _scalars(rows):
    s = MagicMock()
    s.all.return_value = rows
    r = MagicMock()
    r.scalars.return_value = s
    return r


def _config_row(
    id=1,
    file_prefix="PRE",
    file_source="SRC",
    bank_code="KBANK",
    description="Monthly",
    branch=None,
):
    row = MagicMock()
    row.id = id
    row.bank_code = bank_code
    row.file_prefix = file_prefix
    row.file_source = file_source
    row.description = description
    row.branch = branch
    return row


def _accounting_payload(**kwargs):
    base = {
        "bank_code": "KBANK",
        "file_prefix": "PRE",
        "file_source": "SRC",
        "description": "Monthly JV",
        "mappings": {"commission": {"dept": "ACC", "acc": "5100"}},
        "custom_types": [],
    }
    base.update(kwargs)
    return base


# ── I3: GET /accounting ───────────────────────────────────────────────────────


def test_I3_1_no_config_returns_empty_mappings():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/accounting", headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["mappings"] == {}
        assert body["custom_types"] == []


def test_get_accounting_with_config_returns_file_prefix():
    mock_db = make_mock_db()
    # config row, this bank's entries, then the version read
    mock_db.execute.side_effect = [_scalar(_config_row()), _scalars([]), _scalar(None)]
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/accounting", headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["file_prefix"] == "PRE"
        # 2026-09-30: the BU-wide description is retired — the row still holds "Monthly",
        # but nothing may read it back, so no screen can show it as a fallback again.
        assert "description" not in resp.json()


def test_put_accounting_ignores_a_stale_bu_wide_description():
    """A tab loaded before 2026-09-30 still sends `description`; it must not land in the
    retired column (or anywhere) — only `bank_descriptions` carries wording now."""
    row = _config_row(description="Monthly")
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = row
    with make_test_client(mock_db) as client:
        resp = client.put(
            f"{BASE}/accounting", json=_accounting_payload(description="Changed"), headers=AUTH
        )
        assert resp.status_code == 200
    assert row.description == "Monthly"


# ── Concurrent edits ─────────────────────────────────────────────────────────


def _stamped_row(updated_at, descriptions=None):
    row = _config_row()
    row.updated_at = updated_at
    row.bank_descriptions = descriptions if descriptions is not None else {}
    return row


def _put(mock_db, **kw):
    with make_test_client(mock_db) as client:
        return client.put(f"{BASE}/accounting", json=_accounting_payload(**kw), headers=AUTH)


def test_put_refuses_a_save_made_over_a_newer_one():
    """The page loads a bank's rules, someone corrects one from the review queue, and the
    page's PUT (a full replace of that bank) would silently undo the correction."""
    from datetime import datetime

    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = _stamped_row(
        datetime(2026, 10, 1, 9, 0, 5, tzinfo=UTC)
    )
    mock_db.execute.return_value.scalar.return_value = None  # no newer entry
    resp = _put(mock_db, base_version="2026-10-01T09:00:00+00:00")
    assert resp.status_code == 409
    mock_db.commit.assert_not_called()


def test_put_goes_through_when_nothing_changed_since_it_was_loaded():
    from datetime import datetime

    stamp = datetime(2026, 10, 1, 9, 0, 0, tzinfo=UTC)
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = _stamped_row(stamp)
    mock_db.execute.return_value.scalar.return_value = stamp
    resp = _put(mock_db, base_version=stamp.isoformat())
    assert resp.status_code == 200
    assert "version" in resp.json()


def test_put_without_a_version_is_accepted_as_before():
    """A tab loaded before this check existed sends none."""
    from datetime import datetime

    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = _stamped_row(
        datetime(2026, 10, 1, tzinfo=UTC)
    )
    assert _put(mock_db).status_code == 200


def test_put_merges_descriptions_by_bank_instead_of_replacing_them_all():
    """The page edits one bank's wording; sending it must not erase another bank's, which
    a reviewer may have just corrected from the queue."""
    row = _stamped_row(None, {"KBANK": "old", "SCB": "scb wording"})
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = row
    assert _put(mock_db, bank_descriptions={"KBANK": "new"}).status_code == 200
    assert row.bank_descriptions == {"KBANK": "new", "SCB": "scb wording"}


def test_an_empty_description_clears_only_that_bank():
    row = _stamped_row(None, {"KBANK": "old", "SCB": "scb wording"})
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = row
    assert _put(mock_db, bank_descriptions={"KBANK": ""}).status_code == 200
    assert row.bank_descriptions == {"SCB": "scb wording"}


# ── Branch No ─────────────────────────────────────────────────────────────────


def test_put_accounting_refuses_a_branch_that_is_not_five_digits():
    """The input-tax record posts `branch` as stored, and `0000` (typed that way on one BU)
    is not a Revenue Department branch number. The mapping page checks first; this is the
    boundary that decides."""
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.put(
            f"{BASE}/accounting", json=_accounting_payload(branch="0000"), headers=AUTH
        )
    assert resp.status_code == 422
    mock_db.commit.assert_not_called()


def test_put_accounting_accepts_a_five_digit_branch_or_none():
    for branch in ("00000", "00012", None):
        mock_db = make_mock_db()
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        with make_test_client(mock_db) as client:
            resp = client.put(
                f"{BASE}/accounting", json=_accounting_payload(branch=branch), headers=AUTH
            )
        assert resp.status_code == 200, branch


# ── I3: PUT /accounting ───────────────────────────────────────────────────────


def test_I3_2_put_new_config_returns_ok():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.put(f"{BASE}/accounting", json=_accounting_payload(), headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


def test_I3_2_put_new_config_calls_add():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/accounting", json=_accounting_payload(), headers=AUTH)
    assert mock_db.add.call_count >= 1


def test_I3_3_put_existing_config_issues_delete():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = _config_row(id=10)
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/accounting", json=_accounting_payload(), headers=AUTH)
    assert mock_db.execute.call_count >= 2


def test_I3_3_put_commits():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/accounting", json=_accounting_payload(), headers=AUTH)
    mock_db.commit.assert_called_once()


def test_I3_4_custom_types_entries_inserted():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    payload = _accounting_payload(
        custom_types=["visa", "mastercard"],
        mappings={"visa": {"dept": "A", "acc": "B"}, "mastercard": {"dept": "C", "acc": "D"}},
    )
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/accounting", json=payload, headers=AUTH)
    assert mock_db.add.call_count >= 2


# ── I4: GET /ap-mapping/{vendor_tax_id} ──────────────────────────────────────


def test_I4_1_no_mapping_returns_null():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/ap-mapping/0105560097015", headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["vendor_tax_id"] == "0105560097015"
        assert body["mapping"] is None


def test_ap_mapping_returns_parsed_json():
    mock_db = make_mock_db()
    row = MagicMock()
    row.id = 42
    entry = MagicMock()
    entry.column_name = "col_A"
    entry.field_name = "description"
    mock_db.execute.side_effect = [_scalar(row), _scalars([entry])]
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/ap-mapping/TAX123", headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["mapping"]["col_A"] == "description"


def test_I4_3_vendor_tax_id_url_encoded():
    # %2F (slash) splits the path → 404; use %40 (at-sign) which is safe
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/ap-mapping/TAX%40001", headers=AUTH)
        assert resp.status_code == 200


# ── I4: PUT /ap-mapping/{vendor_tax_id} ──────────────────────────────────────


def test_I4_2_put_new_mapping_returns_ok():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.put(f"{BASE}/ap-mapping/TAX-001", json={"col_A": "description"}, headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


def test_put_new_mapping_calls_add():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/ap-mapping/TAX-001", json={"col_A": "description"}, headers=AUTH)
    # 2 adds: the parent APVendorColumnMapping row + 1 entry for col_A → description
    assert mock_db.add.call_count == 2


def test_put_existing_mapping_replaces_entries():
    mock_db = make_mock_db()
    existing = MagicMock()
    existing.id = 7
    mock_db.execute.return_value.scalar_one_or_none.return_value = existing
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/ap-mapping/TAX-001", json={"new_col": "updated"}, headers=AUTH)
    # 1 row added for the {new_col: updated} pair; old rows wiped via delete()
    assert mock_db.add.call_count >= 1
    mock_db.commit.assert_called_once()


def test_put_mapping_commits():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    with make_test_client(mock_db) as client:
        client.put(f"{BASE}/ap-mapping/TAX-001", json={}, headers=AUTH)
    mock_db.commit.assert_called_once()


# ── Analytics endpoint ────────────────────────────────────────────────────────


def test_analytics_no_filter_returns_error_message():
    mock_db = make_mock_db()
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/analytics/account-usage", headers=AUTH)
        assert resp.status_code == 200
        assert "error" in resp.json()


def test_analytics_with_acc_code_returns_results():
    mock_db = make_mock_db()
    mock_db.execute.return_value.all.return_value = []
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/analytics/account-usage?acc_code=5100", headers=AUTH)
        assert resp.status_code == 200
        assert "results" in resp.json()


# ── PATCH /accounting — the review screen's partial write ────────────────────


def _patch_body(dept="OPS", acc="511300"):
    return {"mappings": {"tax": {"dept": dept, "acc": acc}}}


def _depts(*, dept="OPS", allowed=None):
    """Carmen's department list. `DefaultAccount` is a *stringified* JSON array — the
    shape `parse_default_account` exists to survive."""
    import json

    entry = {"DeptCode": dept}
    if allowed is not None:
        entry["DefaultAccount"] = json.dumps([{"AccCode": a, "Description": ""} for a in allowed])
    return {"Data": [entry]}


def test_a_correction_is_saved_without_touching_the_rest_of_the_config(monkeypatch):
    from app.routers import config as router

    async def depts(_token):
        return _depts(allowed=["511300", "511200"])

    saved = {}

    async def patch_config(_db, tenant_id, **kw):
        saved.update({"tenant": tenant_id, **kw})

    monkeypatch.setattr(router, "get_departments", depts)
    monkeypatch.setattr(router.svc, "patch_config", patch_config)

    with make_test_client(make_mock_db()) as client:
        res = client.patch(f"{BASE}/accounting", json=_patch_body(), headers=AUTH)

    assert res.status_code == 200
    # Only the named key travels — nothing reconstructs a whole config from the browser,
    # which is what would wipe file_prefix / description / the other mappings.
    assert saved["mappings"] == {"tax": {"dept": "OPS", "acc": "511300"}}


def test_an_account_the_department_forbids_is_refused_server_side(monkeypatch):
    """The dropdown filters to the allowed set, but a filtered dropdown is a convenience.
    This endpoint decides what posts, so it re-checks."""
    from app.routers import config as router

    async def depts(_token):
        return _depts(allowed=["511200"])  # 511300 not in the dept's list

    called = False

    async def patch_config(*_a, **_k):
        nonlocal called
        called = True

    monkeypatch.setattr(router, "get_departments", depts)
    monkeypatch.setattr(router.svc, "patch_config", patch_config)

    with make_test_client(make_mock_db()) as client:
        res = client.patch(f"{BASE}/accounting", json=_patch_body(), headers=AUTH)

    assert res.status_code == 400
    assert "511300" in res.json()["detail"]
    assert not called


def test_a_department_that_restricts_nothing_allows_everything(monkeypatch):
    """An absent DefaultAccount is 'no restriction', not 'nothing permitted' — reading it
    the other way would refuse every mapping for most departments."""
    from app.routers import config as router

    async def depts(_token):
        return _depts(allowed=None)

    ok = False

    async def patch_config(*_a, **_k):
        nonlocal ok
        ok = True

    monkeypatch.setattr(router, "get_departments", depts)
    monkeypatch.setattr(router.svc, "patch_config", patch_config)

    with make_test_client(make_mock_db()) as client:
        res = client.patch(f"{BASE}/accounting", json=_patch_body(), headers=AUTH)

    assert res.status_code == 200
    assert ok


def test_carmen_being_unreachable_does_not_block_a_correction(monkeypatch):
    """The JV is about to be posted through Carmen anyway, which is where a genuinely bad
    pair gets caught. Refusing here would strand the reviewer on our outage."""
    from app.routers import config as router
    from app.services.shared.carmen import CarmenAPIError

    async def depts(_token):
        raise CarmenAPIError(503, "upstream down")

    ok = False

    async def patch_config(*_a, **_k):
        nonlocal ok
        ok = True

    monkeypatch.setattr(router, "get_departments", depts)
    monkeypatch.setattr(router.svc, "patch_config", patch_config)

    with make_test_client(make_mock_db()) as client:
        res = client.patch(f"{BASE}/accounting", json=_patch_body(), headers=AUTH)

    assert res.status_code == 200
    assert ok
