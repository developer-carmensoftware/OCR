"""CA-119 — reviewing a parked PMS day (services/pms/review.py).

The DB sessions, the credential and Carmen are patched; what is pinned is what the review
shows, what Approve saves and posts, and every refusal leaving the day parked.
"""

from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.exceptions import CarmenServiceError, ConflictError, NotFoundError, ValidationError
from app.services.pms import day as pms_day
from app.services.pms import posting, review
from app.services.shared.carmen import CarmenAPIError
from tests.unit.test_pms_day import FILE_DATA, RULES

ROWS = pms_day.rows_of(FILE_DATA)
SAVED = {k: v for k, v in RULES.items() if k != "Revenue|729"}
GUESS = {"Revenue|729": {"dept": "304", "acc": "4240011", "confidence": "medium", "why": "rebate"}}
PAYLOAD = {
    "interface": "Comanche",
    "doc_type": "Daily",
    "doc_date": "2024-09-05",
    "rows": ROWS,
    "guessed": GUESS,
    "flags": ["mapping_guessed"],
}
ACCOUNTS = [{"code": c, "name": c, "type": "income"} for c in ("4240011", "4240001", "4010001")]
DEPTS = [
    {"code": "304", "name": "Other", "allowed_accounts": ["4240011", "4240001"]},
    {"code": "101", "name": "Rooms", "allowed_accounts": []},
]


class _Approve:
    def __init__(
        self,
        *,
        payload=PAYLOAD,
        settings=SimpleNamespace(jv_prefix="JV"),
        target=("tok", "https://dev.carmen4.com"),
        post="JV2409-0066",
        saved=SAVED,
    ):
        self.tenant, self.pk = uuid4(), uuid4()
        self.db = MagicMock(
            execute=AsyncMock(), commit=AsyncMock(), get=AsyncMock(return_value=settings)
        )

        @asynccontextmanager
        async def session():
            yield self.db

        self.patches = {
            "session": patch.object(review, "async_session", session),
            "claim": patch.object(
                review,
                "_claim",
                AsyncMock(return_value=SimpleNamespace(id=self.pk, review_payload=payload)),
            ),
            "release": patch.object(review, "_release", AsyncMock()),
            "target": patch.object(review, "_target", AsyncMock(return_value=target)),
            "saved": patch.object(review.mapping, "saved", AsyncMock(return_value=saved)),
            "save": patch.object(review.mapping, "save", AsyncMock()),
            "masters": patch.object(
                review.mapping, "masters", AsyncMock(return_value=(ACCOUNTS, DEPTS))
            ),
            "post": patch.object(
                review.posting,
                "post_day",
                AsyncMock(side_effect=post)
                if isinstance(post, Exception)
                else AsyncMock(return_value=post),
            ),
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


KEEP_AI = {"Revenue|729": {"dept": "304", "acc": "4240011"}}


@pytest.mark.asyncio
async def test_approve_saves_the_new_code_and_posts_a_balanced_jv():
    run = _Approve()
    assert await run(KEEP_AI) == {"jv_no": "JV2409-0066"}
    tenant, interface, chosen = run.m["save"].await_args.args[1:]
    assert interface == "Comanche"
    assert chosen == {"Revenue|729": {"dept": "304", "acc": "4240011", "source": "ai"}}
    body = run.m["post"].await_args.args[0]
    assert body["Prefix"] == "JV"
    accs = [d["AccCode"] for d in body["Detail"]]
    assert "4240011" in accs
    assert sum(d["CrAmount"] for d in body["Detail"]) == sum(d["DrAmount"] for d in body["Detail"])
    run.m["recheck"].assert_awaited_once()
    run.m["release"].assert_not_awaited()


@pytest.mark.asyncio
async def test_a_changed_pick_is_saved_as_the_users():
    run = _Approve()
    await run({"Revenue|729": {"dept": "304", "acc": "4240001"}})
    assert run.m["save"].await_args.args[3]["Revenue|729"]["source"] == "user"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kwargs, picks, words",
    [
        ({}, {}, "Pick an account for every new code"),
        ({"settings": None}, KEEP_AI, "JV prefix"),
        ({"settings": SimpleNamespace(jv_prefix=None)}, KEEP_AI, "JV prefix"),
        ({"target": ("", "")}, KEEP_AI, "No Carmen access"),
        ({}, {"Revenue|729": {"dept": "304", "acc": "4010001"}}, "does not allow"),
        ({}, {"Revenue|729": {"dept": "999", "acc": "4240011"}}, "not a department"),
        ({}, {"Revenue|729": {"dept": "304", "acc": "9999999"}}, "not an account"),
    ],
    ids=["no-pick", "no-settings", "no-prefix", "no-credential", "pair", "dept", "acc"],
)
async def test_refusals_leave_the_day_parked(kwargs, picks, words):
    run = _Approve(**kwargs)
    with pytest.raises(ValidationError, match=words):
        await run(picks)
    run.m["post"].assert_not_awaited()
    run.m["release"].assert_awaited_once()


@pytest.mark.asyncio
async def test_an_unbalanced_day_never_posts():
    rows = [dict(r) for r in ROWS]
    rows[0]["amount"] = "1120.00"
    run = _Approve(payload={**PAYLOAD, "rows": rows})
    with pytest.raises(ValidationError, match="doesn't balance"):
        await run(KEEP_AI)
    run.m["save"].assert_not_awaited()
    run.m["post"].assert_not_awaited()


@pytest.mark.asyncio
async def test_carmen_saying_no_is_a_400_and_carmen_unreachable_a_503():
    run = _Approve(post=posting.PostRefused("Period is closed"))
    with pytest.raises(ValidationError, match="Period is closed"):
        await run(KEEP_AI)
    run.m["release"].assert_awaited_once()

    run = _Approve(post=CarmenAPIError(504, "Carmen Server request timed out."))
    with pytest.raises(CarmenServiceError, match="whether the JV posted"):
        await run(KEEP_AI)


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
async def test_get_day_lists_only_the_new_codes():
    row = SimpleNamespace(id=uuid4(), review_payload=PAYLOAD, reason_code=None, error_message=None)
    db = MagicMock(scalar=AsyncMock(return_value=row))
    with patch.object(review.mapping, "saved", AsyncMock(return_value=SAVED)):
        day = await review.get_day(db, uuid4(), row.id)
    assert [c["code"] for c in day["new_codes"]] == ["729"]
    assert day["new_codes"][0] | {} == {
        "key": "Revenue|729",
        "code": "729",
        "description": "Rebate - Misc. (VAT)",
        "type": "Revenue",
        "amount": "-50.00",
        "dept": "304",
        "acc": "4240011",
        "confidence": "medium",
        "why": "rebate",
    }
    assert day["terms"] == [
        {"type": "Revenue", "amount": "1127.00"},
        {"type": "Payment", "amount": "-500.00"},
        {"type": "Guest Ledger", "amount": "-627.00"},
    ]
    assert day["off"] == "0.00"
    assert day["codes"] == 4
    assert set(day["accounts"]) == set(SAVED)


@pytest.mark.asyncio
async def test_get_day_of_a_day_not_waiting_is_none():
    db = MagicMock(scalar=AsyncMock(return_value=None))
    assert await review.get_day(db, uuid4(), uuid4()) is None


@pytest.mark.asyncio
async def test_recheck_clears_the_ai_flag_once_the_code_is_saved():
    other = SimpleNamespace(review_payload=dict(PAYLOAD))
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

    with (
        patch.object(review, "async_session", session),
        patch.object(review.mapping, "saved", AsyncMock(return_value=RULES)),
    ):
        assert await review.recheck(uuid4(), "Comanche") == 1
    assert other.review_payload["flags"] == []
    assert unrelated.review_payload["flags"] == ["mapping_guessed"]


@pytest.mark.asyncio
async def test_settings_round_trip():
    stored = {}

    async def get(model, tenant_id):
        if model is review.PmsSettings:
            return stored.get("row")
        return SimpleNamespace(carmen_token_enc="enc")

    db = MagicMock(get=AsyncMock(side_effect=get), flush=AsyncMock())
    db.add = lambda row: stored.update(row=row)
    out = await review.save_settings(db, uuid4(), jv_prefix=" JV ", auto_post=True)
    assert out == {"jv_prefix": "JV", "auto_post": True, "has_credential": True}
