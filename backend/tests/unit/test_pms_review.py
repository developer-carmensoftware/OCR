"""CA-119 / decision-log #43 — reviewing a parked PMS day (services/pms/review.py).

The DB sessions, the credential and Carmen are patched; what is pinned is what the review
shows, what Approve writes into Carmen's mapping table (whole — Carmen's PUT replaces it)
before asking Carmen's engine to post, and every refusal leaving the day parked.
"""

from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.exceptions import CarmenServiceError, ConflictError, NotFoundError, ValidationError
from app.services.pms import carmen_config as cfg
from app.services.pms import review
from app.services.pms.process import PostRefused
from app.services.shared.carmen import CarmenAPIError
from tests.unit.test_pms_carmen_config import COMANCHE_INI, DAY, TABLE

SPEC = cfg.spec_of(cfg.parse_ini(COMANCHE_INI))
ROWS = cfg.rows_of(DAY, SPEC)
KEY = {r["values"]["Description"]: r["key"] for r in ROWS}
MAPPED = cfg.table_of(TABLE, SPEC.columns)
GUESS = {
    KEY["Room Charge - VAT"]: {"dept": "GEN", "acc": "2012003", "confidence": "high", "why": "tax"}
}
PAYLOAD = {
    "interface": "Comanche",
    "doc_type": "Daily",
    "doc_date": "2025-10-20",
    "setting_code": "Comanche.PMS",
    "post_type": "REVENUE",
    "counter": {"dept": "GEN", "acc": "1021001", "name": "A/R - Guest Ledger"},
    "key_columns": SPEC.columns,
    "rows": ROWS,
    "mapped": {k: v for k, v in MAPPED.items() if k in {r["key"] for r in ROWS}},
    "guessed": GUESS,
    "flags": ["mapping_missing", "mapping_guessed"],
    "databank_id": 148,
}
ACCOUNTS = [
    {"code": c, "name": c, "type": "balancesheet"}
    for c in ("2012003", "1010001", "1021001", "4010001")
]
DEPTS = [
    {"code": "GEN", "name": "General", "allowed_accounts": []},
    {"code": "103", "name": "Rooms", "allowed_accounts": ["4010001"]},
]
PICKS = {
    KEY["Room Charge - VAT"]: {"dept": "GEN", "acc": "2012003"},
    KEY["Cash - Advance Payment"]: {"dept": "GEN", "acc": "1010001"},
    KEY["Guest Ledger"]: {"dept": "GEN", "acc": "1021001"},
}
POSTED = "posted"


class _Approve:
    def __init__(
        self,
        *,
        payload=PAYLOAD,
        target=("tok", "https://dev.carmen4.com"),
        table=TABLE,
        put=None,
        post=POSTED,
    ):
        self.tenant, self.pk = uuid4(), uuid4()
        self.db = MagicMock(execute=AsyncMock(), commit=AsyncMock())

        @asynccontextmanager
        async def session():
            yield self.db

        def mock(value):
            return (
                AsyncMock(side_effect=value)
                if isinstance(value, Exception)
                else AsyncMock(return_value=value)
            )

        self.patches = {
            "session": patch.object(review, "async_session", session),
            "claim": patch.object(
                review,
                "_claim",
                AsyncMock(return_value=SimpleNamespace(id=self.pk, review_payload=payload)),
            ),
            "release": patch.object(review, "_release", AsyncMock()),
            "target": patch.object(review, "_target", AsyncMock(return_value=target)),
            "read": patch.object(review.carmen, "get_pms_mapping", mock(table)),
            "put": patch.object(review.carmen, "put_pms_mapping", mock(put or {"Code": 0})),
            "masters": patch.object(
                review.mapping, "masters", AsyncMock(return_value=(ACCOUNTS, DEPTS))
            ),
            "post": patch.object(review, "post_day", mock(post)),
            "recheck": patch.object(review, "recheck", AsyncMock(return_value=1)),
        }

    async def __call__(self, picks):
        self.m = {name: p.start() for name, p in self.patches.items()}
        try:
            return await review.approve(
                self.tenant, self.pk, picks, reviewer="u-1", reviewer_name="Nok"
            )
        finally:
            for p in self.patches.values():
                p.stop()


@pytest.mark.asyncio
async def test_approve_writes_the_whole_table_then_has_carmen_post_the_day():
    run = _Approve()
    assert await run(PICKS) == {"jv_no": None, "already_posted": False}
    code, post_type, rows, token = run.m["put"].await_args.args
    assert (code, post_type, token) == ("Comanche.PMS", "REVENUE", "tok")
    # Every row Carmen had goes back (the PUT replaces the table), the blank one filled in.
    assert rows == [
        {"Code": "100", "Description": "Room Charge", "DeptCode": "103", "AccCode": "4010001"},
        {"Code": "900", "Description": "Cash", "DeptCode": "GEN", "AccCode": "1010001"},
        {
            "Code": "Guest Ledger",
            "Description": "Guest Ledger",
            "DeptCode": "GEN",
            "AccCode": "1021001",
        },
        {
            "Code": "100",
            "Description": "Room Charge - VAT",
            "DeptCode": "GEN",
            "AccCode": "2012003",
        },
        {
            "Code": "900",
            "Description": "Cash - Advance Payment",
            "DeptCode": "GEN",
            "AccCode": "1010001",
        },
    ]
    assert run.m["post"].await_args.args == (PAYLOAD, "2025-10-20", 148, "tok")
    run.m["recheck"].assert_awaited_once()
    run.m["release"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_day_carmen_had_already_posted_is_done():
    run = _Approve(post="already_posted")
    assert await run(PICKS) == {"jv_no": None, "already_posted": True}


@pytest.mark.asyncio
async def test_a_row_carmen_has_meanwhile_mapped_keeps_carmens_account():
    vat = {
        "Code": "100",
        "Description": "Room Charge - VAT",
        "DeptCode": "GEN",
        "AccCode": "2012009",
        "AccDesc": "x",
    }
    run = _Approve(table=[*TABLE, vat])
    picks = {k: v for k, v in PICKS.items() if k != KEY["Room Charge - VAT"]}
    await run(picks)
    rows = run.m["put"].await_args.args[2]
    assert {
        "Code": "100",
        "Description": "Room Charge - VAT",
        "DeptCode": "GEN",
        "AccCode": "2012009",
    } in rows


@pytest.mark.asyncio
async def test_a_fully_mapped_day_posts_without_writing_the_table():
    full = [*TABLE[:2], {**TABLE[2], "AccCode": "1021001"}]
    full += [
        {
            "Code": "100",
            "Description": "Room Charge - VAT",
            "DeptCode": "GEN",
            "AccCode": "2012003",
        },
        {
            "Code": "900",
            "Description": "Cash - Advance Payment",
            "DeptCode": "GEN",
            "AccCode": "1010001",
        },
    ]
    run = _Approve(table=full)
    await run({})
    run.m["put"].assert_not_awaited()
    run.m["post"].assert_awaited_once()
    run.m["recheck"].assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kwargs, picks, words",
    [
        ({}, {}, "Pick an account for every new row"),
        ({"target": ("", "")}, PICKS, "No Carmen access"),
        ({}, {**PICKS, KEY["Guest Ledger"]: {"dept": "103", "acc": "1021001"}}, "does not allow"),
        ({}, {**PICKS, KEY["Guest Ledger"]: {"dept": "999", "acc": "1021001"}}, "not a department"),
        ({}, {**PICKS, KEY["Guest Ledger"]: {"dept": "GEN", "acc": "9999999"}}, "not an account"),
    ],
    ids=["no-pick", "no-credential", "pair", "dept", "acc"],
)
async def test_refusals_leave_the_day_parked_and_carmen_untouched(kwargs, picks, words):
    run = _Approve(**kwargs)
    with pytest.raises(ValidationError, match=words):
        await run(picks)
    run.m["put"].assert_not_awaited()
    run.m["post"].assert_not_awaited()
    run.m["release"].assert_awaited_once()


@pytest.mark.asyncio
async def test_carmens_table_unreadable_means_nothing_is_written():
    run = _Approve(table=CarmenAPIError(405, "HTTP 405: method"))
    with pytest.raises(CarmenServiceError, match="Couldn't read Carmen's Comanche mapping"):
        await run(PICKS)
    run.m["put"].assert_not_awaited()
    run.m["post"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_failed_write_never_posts():
    run = _Approve(put=CarmenAPIError(500, "HTTP 500: boom"))
    with pytest.raises(CarmenServiceError, match="didn't save the accounts"):
        await run(PICKS)
    run.m["post"].assert_not_awaited()
    run.m["release"].assert_awaited_once()


@pytest.mark.asyncio
async def test_carmen_saying_no_is_a_400_and_carmen_unreachable_a_503():
    run = _Approve(post=PostRefused("Period is closed"))
    with pytest.raises(ValidationError, match="Period is closed"):
        await run(PICKS)
    run.m["release"].assert_awaited_once()
    run = _Approve(post=CarmenAPIError(504, "Carmen Server request timed out."))
    with pytest.raises(CarmenServiceError, match="Approving again is safe"):
        await run(PICKS)


@pytest.mark.asyncio
async def test_claim_conflicts():
    db = MagicMock(
        execute=AsyncMock(return_value=MagicMock(first=MagicMock(return_value=None))),
        scalar=AsyncMock(return_value="pending_review"),
    )
    with pytest.raises(ConflictError, match="Another reviewer"):
        await review._claim(db, uuid4(), uuid4())
    db.scalar = AsyncMock(return_value="posted")
    with pytest.raises(ConflictError, match="already handled"):
        await review._claim(db, uuid4(), uuid4())
    db.scalar = AsyncMock(return_value=None)
    with pytest.raises(NotFoundError):
        await review._claim(db, uuid4(), uuid4())


@pytest.mark.asyncio
async def test_get_day_lists_the_rows_carmen_cannot_place_and_what_the_others_map_to():
    row = SimpleNamespace(id=uuid4(), review_payload=PAYLOAD, reason_code=None, error_message=None)
    db = MagicMock(scalar=AsyncMock(return_value=row))
    day = await review.get_day(db, uuid4(), row.id)
    assert [c["label"] for c in day["new_codes"]] == [
        "100 · Room Charge - VAT",
        "900 · Cash - Advance Payment",
        "Guest Ledger · Guest Ledger",
    ]
    vat = day["new_codes"][0]
    assert (vat["amount"], vat["dept"], vat["acc"], vat["confidence"]) == (
        "11525.06",
        "GEN",
        "2012003",
        "high",
    )
    assert day["mapped_count"] == 1
    assert day["rows"][0] == {**ROWS[0], "dept": "103", "acc": "4010001", "name": "Room Revenue"}
    assert (day["setting_code"], day["post_type"]) == ("Comanche.PMS", "REVENUE")
    assert day["counter"]["acc"] == "1021001"


@pytest.mark.asyncio
async def test_get_day_of_a_day_not_waiting_is_none():
    db = MagicMock(scalar=AsyncMock(return_value=None))
    assert await review.get_day(db, uuid4(), uuid4()) is None


@pytest.mark.asyncio
async def test_recheck_clears_the_flags_once_carmens_table_has_the_rows():
    other = SimpleNamespace(review_payload={**PAYLOAD, "guessed": {}, "flags": ["mapping_missing"]})
    unrelated = SimpleNamespace(review_payload={**PAYLOAD, "interface": "Opera"})
    db = MagicMock(
        execute=AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(
                    return_value=MagicMock(all=MagicMock(return_value=[other, unrelated]))
                )
            )
        ),
        commit=AsyncMock(),
    )

    @asynccontextmanager
    async def session():
        yield db

    table = {**MAPPED, **{k: {**v, "name": ""} for k, v in PICKS.items()}}
    with patch.object(review, "async_session", session):
        assert await review.recheck(uuid4(), "Comanche", table) == 1
    assert other.review_payload["flags"] == []
    assert len(other.review_payload["mapped"]) == 4
    assert unrelated.review_payload["flags"] == ["mapping_missing", "mapping_guessed"]


@pytest.mark.asyncio
async def test_settings_round_trip_is_per_pms():
    stored = {}

    async def get(model, ident):
        if model is review.PmsSettings:
            return stored.get(ident)
        return SimpleNamespace(carmen_token_enc="enc")

    tenant_id = uuid4()
    db = MagicMock(get=AsyncMock(side_effect=get), flush=AsyncMock())
    db.add = lambda row: stored.update({(row.tenant_id, row.interface_name): row})
    key = SimpleNamespace(key_prefix="cpk_abcdefgh", created_at=None, last_used_at=None)
    with patch.object(review.api_keys, "live_key", AsyncMock(side_effect=[key, None])):
        await review.save_settings(db, tenant_id, "comanche", auto_post=True, actor="user:u-1")
        assert await review.get_settings(db, tenant_id, "comanche") == {
            "pms": "comanche",
            "auto_post": True,
            "key": {"prefix": "cpk_abcdefgh", "created_at": None, "last_used_at": None},
            "has_credential": True,
        }
        # Another PMS of the same BU keeps its own switch, and has no key yet.
        other = await review.get_settings(db, tenant_id, "opera")
    assert (other["auto_post"], other["key"]) == (False, None)
