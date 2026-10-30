"""Key rotation end to end, against the real tables (decision-log #50, docs/KEY_ROTATION.md).

Every kind of token the app keeps — a JSON payload, encrypted text columns, the session and
BU credentials, PDF passwords inside the rules — is written under an OLD key. Then, as the
runbook does: NEW becomes the key with OLD still listed (the app reads everything), the
rotation re-encrypts, and OLD is dropped (the app still reads everything, under NEW alone).

Scoped to one seeded tenant (`tenant_ids`): this suite also runs against the shared dev
database. Needs migration 20261029010000 (contact columns as text).
"""

import json
import uuid

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import select, text

from app.auth.session import decrypt_carmen_token
from app.config import settings
from app.database import async_session
from app.models.billing import BillingDocument
from app.models.email_automation import EmailDocument, EmailIngestSettings
from app.models.identity import Tenant
from app.services.shared.payload_encryption import rotate_tokens

from .conftest import run

OLD, NEW = Fernet.generate_key().decode(), Fernet.generate_key().decode()
PAYLOAD = {
    "extracted": {"doc_no": "ROT-1", "details": [{"transaction": "VISA"}]},
    "doc_type": "fee_invoice",
}
OWNERS = ["accounting@example.co.th"]


def _old(value: str) -> str:
    return Fernet(OLD.encode()).encrypt(value.encode()).decode()


def _seed(real_engine, tenant_id):
    ids = {k: uuid.uuid4() for k in ("doc", "order", "bill", "session")}

    async def _go():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into email_documents (id, tenant_id, message_id, attachment, status,"
                    " review_payload, error_message, created_at, updated_at) values (:id, :t, :m,"
                    " 'r.pdf', 'pending_review', cast(:p as jsonb), :e, now(), now())"
                ),
                {
                    "id": ids["doc"],
                    "t": tenant_id,
                    "m": f"<{ids['doc']}@rot.test>",
                    "p": json.dumps({"enc": _old(json.dumps(PAYLOAD)), "doc_type": "fee_invoice"}),
                    "e": _old("this mail carries ap@exampel.co.th"),
                },
            )
            await conn.execute(
                text(
                    "insert into credit_orders (id, tenant_id, pack_code, credits, amount_thb, status,"
                    " billing_period, created_at, updated_at) values (:id, :t, 'pack_small', 500,"
                    " 1200, 'void', 'monthly', now(), now())"
                ),
                {"id": ids["order"], "t": tenant_id},
            )
            await conn.execute(
                text(
                    "insert into billing_documents (id, tenant_id, order_id, doc_type, number,"
                    " issue_date, buyer_tel, pack_code, credits, subtotal, vat_rate, vat_amount,"
                    " total, currency, created_at, updated_at) values (:id, :t, :o, 'proforma', :n,"
                    " now(), :tel, 'pack_small', 500, 1200, 7, 84, 1284, 'THB', now(), now())"
                ),
                {
                    "id": ids["bill"],
                    "t": tenant_id,
                    "o": ids["order"],
                    "n": f"ROT-{ids['bill'].hex[:8]}",
                    "tel": _old("0812345678"),
                },
            )
            await conn.execute(
                text("update tenants set contact_email = :e where id = :t"),
                {"e": _old("ops@example.co.th"), "t": tenant_id},
            )
            await conn.execute(
                text(
                    "insert into ocr_sessions (id, tenant_id, carmen_token_encrypted, is_active,"
                    " created_at, updated_at) values (:id, :t, :tok, true, now(), now())"
                ),
                {"id": ids["session"], "t": tenant_id, "tok": _old("carmen-session-token")},
            )
            await conn.execute(
                text(
                    "insert into email_ingest_settings (tenant_id, enabled, tax_ids, rules,"
                    " owner_emails, carmen_token_enc) values (:t, false, '[]', cast(:r as jsonb),"
                    " cast(:o as jsonb), :c) on conflict (tenant_id) do update set"
                    " rules = excluded.rules, owner_emails = excluded.owner_emails,"
                    " carmen_token_enc = excluded.carmen_token_enc"
                ),
                {
                    "t": tenant_id,
                    "r": json.dumps([{"bank_code": "KTC", "pdf_password_enc": _old("1234")}]),
                    "o": json.dumps({"enc": _old(json.dumps(OWNERS))}),
                    "c": _old("bu-credential"),
                },
            )

    run(_go())
    return ids


def _app_reads(tenant_id, ids):
    """Everything as the app reads it — through the column types and the session helper."""

    async def _go():
        async with async_session() as db:
            doc = await db.get(EmailDocument, ids["doc"])
            bill = await db.get(BillingDocument, ids["bill"])
            tenant = await db.get(Tenant, tenant_id)
            cfg = await db.get(EmailIngestSettings, tenant_id)
            session_tok = await db.scalar(
                text("select carmen_token_encrypted from ocr_sessions where id = :id"),
                {"id": ids["session"]},
            )
            return {
                "payload": doc.review_payload,
                "error": doc.error_message,
                "tel": bill.buyer_tel,
                "contact": tenant.contact_email,
                "owners": cfg.owner_emails,
                "credential": decrypt_carmen_token(cfg.carmen_token_enc),
                "pdf": decrypt_carmen_token(cfg.rules[0]["pdf_password_enc"]),
                "session": decrypt_carmen_token(session_tok),
            }

    return run(_go())


EXPECTED = {
    "payload": PAYLOAD,
    "error": "this mail carries ap@exampel.co.th",
    "tel": "0812345678",
    "contact": "ops@example.co.th",
    "owners": OWNERS,
    "credential": "bu-credential",
    "pdf": "1234",
    "session": "carmen-session-token",
}


def _rotate(tenant_id, *, dry_run=False):
    async def _go():
        async with async_session() as db:
            return await rotate_tokens(db, dry_run=dry_run, tenant_ids=[tenant_id])

    return run(_go())


@pytest.fixture
def seeded(real_engine, tenants):
    """The seed, and afterwards its removal: once this test ends, NEW is a key nobody holds,
    and a later test reading these rows under the suite's own key would get None."""
    ids = _seed(real_engine, tenants.c)
    yield ids

    async def _forget():
        async with real_engine.begin() as conn:
            await conn.execute(text("delete from email_documents where id = :i"), {"i": ids["doc"]})
            await conn.execute(
                text("delete from billing_documents where id = :i"), {"i": ids["bill"]}
            )
            await conn.execute(text("delete from credit_orders where id = :i"), {"i": ids["order"]})
            await conn.execute(
                text("delete from ocr_sessions where id = :i"), {"i": ids["session"]}
            )
            await conn.execute(
                text("delete from email_ingest_settings where tenant_id = :t"), {"t": tenants.c}
            )
            await conn.execute(
                text("update tenants set contact_email = null where id = :t"), {"t": tenants.c}
            )

    run(_forget())


def test_a_rotation_moves_every_token_to_the_new_key_and_loses_nothing(
    seeded, tenants, monkeypatch
):
    ids = seeded

    # Mid-rotation: NEW encrypts, OLD still decrypts — the app reads everything.
    monkeypatch.setattr(settings, "session_encryption_key", NEW)
    monkeypatch.setattr(settings, "session_encryption_keys_old", OLD)
    assert _app_reads(tenants.c, ids) == EXPECTED

    counted = _rotate(tenants.c, dry_run=True)
    for col in (
        "email_documents.review_payload",
        "email_documents.error_message",
        "billing_documents.buyer_tel",
        "tenants.contact_email",
        "email_ingest_settings.owner_emails",
        "email_ingest_settings.carmen_token_enc",
        "email_ingest_settings.rules",
        "ocr_sessions.carmen_token_encrypted",
    ):
        assert counted[col]["stale"] >= 1, col
    assert _rotate(tenants.c) == counted
    assert all(c["stale"] == 0 for c in _rotate(tenants.c, dry_run=True).values())  # done

    # OLD dropped: everything still reads, under NEW alone.
    monkeypatch.setattr(settings, "session_encryption_keys_old", "")
    assert _app_reads(tenants.c, ids) == EXPECTED

    async def _raw_tel():
        async with async_session() as db:
            return await db.scalar(
                select(text("buyer_tel"))
                .select_from(text("billing_documents"))
                .where(text("id = :id")),
                {"id": ids["bill"]},
            )

    assert Fernet(NEW.encode()).decrypt(run(_raw_tel()).encode()) == b"0812345678"


def test_a_token_no_key_opens_is_counted_and_left_alone(real_engine, tenants, monkeypatch):
    stranger = Fernet(Fernet.generate_key()).encrypt(b"lost").decode()

    async def _seed_one():
        async with real_engine.begin() as conn:
            await conn.execute(
                text("update tenants set contact_email = :e where id = :t"),
                {"e": stranger, "t": tenants.b},
            )

    run(_seed_one())
    monkeypatch.setattr(settings, "session_encryption_key", NEW)
    monkeypatch.setattr(settings, "session_encryption_keys_old", OLD)
    report = _rotate(tenants.b)
    assert report["tenants.contact_email"] == {"stale": 0, "unreadable": 1}

    async def _raw():
        async with real_engine.connect() as conn:
            return await conn.scalar(
                text("select contact_email from tenants where id = :t"), {"t": tenants.b}
            )

    assert run(_raw()) == stranger

    async def _forget():
        async with real_engine.begin() as conn:
            await conn.execute(
                text("update tenants set contact_email = null where id = :t"), {"t": tenants.b}
            )

    run(_forget())
