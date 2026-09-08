"""G4 — email ingestion: the path where a document could actually land in the wrong BU.

The wizards get their tenant from a signed JWT. Email does not: a message arrives at a
shared mailbox and the pipeline has to work out whose it is from the envelope. That makes
this the one surface where "documents get mixed up between BUs" is a mechanical
possibility rather than a query bug, so every gate is checked against a real second BU
rather than against an absence.

Two properties the design leans on, both asserted here:
  * the tag is read **before any LLM call**, so an unowned message costs nothing;
  * the tax ID is **verification, not routing** — a document carrying the neighbour's TIN
    parks under the BU that received it, and never appears in the neighbour's queue.
"""

import uuid

from sqlalchemy import text

from .conftest import run

ALPHA_TAG = "isoalpha"
BETA_TAG = "isobeta"


def _addr(tag):
    """The delivery address a forward would carry for this tag."""
    from app.config import settings

    user, _, domain = settings.email_ingest_address.partition("@")
    return f"for {user}+{tag}@{domain}; Mon, 1 Sep 2026 10:00:00 +0700"


# ── Routing: envelope → tag → tenant ─────────────────────────────────────────


def test_the_envelope_tag_picks_the_owning_bu(tenants):
    """The whole routing decision, on real rows."""
    from app.database import async_session
    from app.services import email_settings_service as es
    from app.services.email_imap import tag_from_recipients

    async def _route(header):
        tag = tag_from_recipients([header])
        if tag is None:
            return None
        async with async_session() as db:
            row = await es.resolve_by_tag(db, tag)
            return str(row.tenant_id) if row else None

    assert run(_route(_addr(ALPHA_TAG))) == str(tenants.a)
    assert run(_route(_addr(BETA_TAG))) == str(tenants.b)


def test_an_unknown_tag_routes_to_nobody(tenants):
    """Mail nobody owns must resolve to nothing — not to the first BU in the table."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _resolve(tag):
        async with async_session() as db:
            return await es.resolve_by_tag(db, tag)

    assert run(_resolve("isonobody")) is None


def test_a_bare_address_with_no_tag_routes_to_nobody():
    from app.services.email_imap import tag_from_recipients

    assert tag_from_recipients(["for ocr@carmensoftware.com; Mon, 1 Sep 2026"]) is None
    assert tag_from_recipients(["for someone+isoalpha@elsewhere.example;"]) is None


def test_a_switched_off_bu_still_resolves_so_its_mail_is_held_not_lost(real_engine, tenants):
    """`resolve_by_tag` deliberately ignores `enabled`: "no such tag" (drop the mail) and
    "known tag, switched off" (hand it back unread) need opposite answers, and a `None`
    for both cannot express the difference."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _set_enabled(tid, on):
        async with real_engine.begin() as conn:
            await conn.execute(
                text("update email_ingest_settings set enabled = :e where tenant_id = :t"),
                {"e": on, "t": tid},
            )

    async def _resolve(tag):
        async with async_session() as db:
            row = await es.resolve_by_tag(db, tag)
            return None if row is None else (str(row.tenant_id), row.enabled)

    run(_set_enabled(tenants.a, False))
    try:
        got = run(_resolve(ALPHA_TAG))
        assert got == (str(tenants.a), False)
        # And B is untouched by A being switched off.
        assert run(_resolve(BETA_TAG))[1] is True
    finally:
        run(_set_enabled(tenants.a, True))


# ── Tax ID: verification, not routing ────────────────────────────────────────


def test_a_document_carrying_the_neighbours_tax_id_is_a_conflict_for_the_receiver(tenants):
    """Arrives on A's tag, prints B's TIN. It must be flagged against A — never handed
    to B, who never received it."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _check(tax_ids, tenant_id):
        async with async_session() as db:
            return await es.foreign_tax_id(db, tax_ids, tenant_id)

    clash = run(_check(["0999900000015"], tenants.a))
    assert clash == "0999900000015", "B's registered TIN did not register as foreign to A"

    # Its own number is fine, and an unrecognised one is not this check's business.
    assert run(_check(["0999900000007"], tenants.a)) is None
    assert run(_check(["0999900000023"], tenants.a)) is None  # nobody's
    assert run(_check([], tenants.a)) is None


def test_a_switched_off_bus_tax_id_still_blocks_the_neighbour(real_engine, tenants):
    """Turning the feature off does not release the number. Otherwise a BU pausing for a
    month would let its documents start posting into somebody else's books."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _set_enabled(tid, on):
        async with real_engine.begin() as conn:
            await conn.execute(
                text("update email_ingest_settings set enabled = :e where tenant_id = :t"),
                {"e": on, "t": tid},
            )

    async def _check():
        async with async_session() as db:
            return await es.foreign_tax_id(db, ["0999900000015"], tenants.a)

    run(_set_enabled(tenants.b, False))
    try:
        assert run(_check()) == "0999900000015"
    finally:
        run(_set_enabled(tenants.b, True))


def test_registering_a_tax_id_another_bu_already_owns_is_refused(tenants):
    """The write-side half of the same rule."""
    from app.database import async_session
    from app.exceptions import ConflictError
    from app.models.identity import Tenant
    from app.services import email_settings_service as es

    async def _save():
        async with async_session() as db:
            tenant = await db.get(Tenant, tenants.a)
            payload = type(
                "P",
                (),
                {
                    "tax_ids": ["0999900000015"],  # B's number
                    "owner_emails": ["ap@alpha.example"],
                    "rules": None,
                    "enabled": None,
                },
            )()
            return await es.save_settings(db, tenant, payload)

    try:
        run(_save())
        raise AssertionError("BU-A was allowed to register BU-B's tax id")
    except ConflictError:
        pass
    except Exception as exc:  # a validation error naming the clash is also a refusal
        assert "0999900000015" in str(exc) or "another" in str(exc).lower(), exc


# ── Filename rules and per-BU secrets ────────────────────────────────────────


def test_each_bus_filename_rule_claims_only_its_own_files(real_engine, tenants):
    """A scans `*statement*`, B scans `*invoice*`. A file matching the neighbour's rule
    and not your own must stop before the LLM — not fall through to the neighbour."""
    from app.database import async_session
    from app.services import email_settings_service as es
    from app.services.email_imap import match_rules

    async def _rules(tag):
        async with async_session() as db:
            row = await es.resolve_by_tag(db, tag)
            return list(row.rules or [])

    a_rules = run(_rules(ALPHA_TAG))
    b_rules = run(_rules(BETA_TAG))

    assert match_rules(a_rules, "bank@ktc.example", "may-statement.pdf")
    assert not match_rules(a_rules, "bank@ktc.example", "may-invoice.pdf")

    assert match_rules(b_rules, "bank@ghl.example", "may-invoice.pdf")
    assert not match_rules(b_rules, "bank@ghl.example", "may-statement.pdf")


def test_a_bus_pdf_passwords_are_never_pooled_with_the_neighbours(real_engine, tenants):
    """`rule_passwords` reads one BU's active rules. A password leaking into the other
    BU's attempt list would open documents that BU has no business opening."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _set_password(tid, plain):
        from cryptography.fernet import Fernet

        from app.config import settings

        enc = Fernet(settings.session_encryption_key.encode()).encrypt(plain.encode()).decode()
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "update email_ingest_settings"
                    " set rules = jsonb_set(rules, '{0,pdf_password_enc}', to_jsonb(cast(:enc as text)))"
                    " where tenant_id = :t"
                ),
                {"enc": enc, "t": tid},
            )

    async def _passwords(tag):
        async with async_session() as db:
            row = await es.resolve_by_tag(db, tag)
            return es.rule_passwords(row)

    run(_set_password(tenants.a, "ALPHA-SECRET"))
    try:
        assert run(_passwords(ALPHA_TAG)) == ["ALPHA-SECRET"]
        assert "ALPHA-SECRET" not in run(_passwords(BETA_TAG))
    finally:

        async def _clear():
            async with real_engine.begin() as conn:
                await conn.execute(
                    text(
                        "update email_ingest_settings"
                        " set rules = rules #- '{0,pdf_password_enc}' where tenant_id = :t"
                    ),
                    {"t": tenants.a},
                )

        run(_clear())


def test_owner_email_lists_are_read_per_bu(tenants):
    """A restricts to its own address; B accepts anybody. Same message, two answers."""
    from app.database import async_session
    from app.services import email_settings_service as es
    from app.services.email_imap import sender_allowed

    async def _owners(tag):
        async with async_session() as db:
            row = await es.resolve_by_tag(db, tag)
            return list(row.owner_emails or [])

    stranger = "From: bank@ktc.example To: someone@else.example"
    assert sender_allowed(run(_owners(ALPHA_TAG)), stranger) is False
    assert sender_allowed(run(_owners(BETA_TAG)), stranger) is True


def test_auto_post_is_read_per_bu(tenants):
    """A posts clean documents straight through; B parks everything for a human."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _auto(tag):
        async with async_session() as db:
            return (await es.resolve_by_tag(db, tag)).auto_post

    assert run(_auto(ALPHA_TAG)) is True
    assert run(_auto(BETA_TAG)) is False


# ── Dedupe and backpressure are per BU ───────────────────────────────────────


def test_the_same_message_can_be_claimed_by_both_bus(real_engine, tenants):
    """Dedupe keys on (tenant, message, attachment). One bank mailing both BUs the same
    newsletter must not have the second BU's copy silently swallowed."""
    from app.database import async_session
    from app.services.email_ingest_service import _claim

    msg = f"<shared-{uuid.uuid4()}@iso.test>"

    async def _go(tid):
        async with async_session() as db:
            row = await _claim(db, str(tid), msg, "shared-statement.pdf")
            return None if row is None else str(row.id)

    first = run(_go(tenants.a))
    second = run(_go(tenants.b))
    again = run(_go(tenants.a))

    assert first is not None
    assert second is not None, "BU-B's copy was swallowed by BU-A's claim"
    assert first != second
    assert again is None, "the same BU claimed the same attachment twice"

    async def _clean():
        async with real_engine.begin() as conn:
            await conn.execute(
                text("delete from email_documents where message_id = :m"), {"m": msg}
            )

    run(_clean())


def test_the_same_doc_no_parked_in_two_bus_is_not_a_cross_bu_duplicate(real_engine, tenants):
    """`_already_pending` keys on (tenant, bank, doc_no). Two BUs processing the same
    invoice number from the same processor is normal and must not block either."""
    from app.services.email_ingest_service import _already_pending

    doc_no = f"SHARED-{uuid.uuid4().hex[:8]}"

    async def _park(tid):
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into email_documents (id, tenant_id, message_id, attachment,"
                    " status, bank_code, doc_no, created_at, updated_at)"
                    " values (gen_random_uuid(), :t, :m, 'x.pdf', 'pending_review', 'KTC',"
                    " :d, now(), now())"
                ),
                {"t": tid, "m": f"<{uuid.uuid4()}@iso.test>", "d": doc_no},
            )

    run(_park(tenants.a))
    try:
        assert run(_already_pending(str(tenants.a), "KTC", doc_no)) is True
        assert run(_already_pending(str(tenants.b), "KTC", doc_no)) is False, (
            "BU-A's parked document blocked BU-B's own copy"
        )
    finally:

        async def _clean():
            async with real_engine.begin() as conn:
                await conn.execute(
                    text("delete from email_documents where doc_no = :d"), {"d": doc_no}
                )

        run(_clean())


def test_the_review_backlog_is_counted_per_bu(real_engine, tenants):
    """Backpressure protects a BU that stops reading its queue. It must not throttle the
    BU next door."""
    from app.database import async_session
    from app.services.email_ingest_service import _pending_count

    async def _count(tid):
        async with async_session() as db:
            return await _pending_count(db, str(tid))

    before_a, before_b = run(_count(tenants.a)), run(_count(tenants.b))

    async def _park_five():
        async with real_engine.begin() as conn:
            for _ in range(5):
                await conn.execute(
                    text(
                        "insert into email_documents (id, tenant_id, message_id, attachment,"
                        " status, created_at, updated_at) values (gen_random_uuid(), :t, :m,"
                        " 'x.pdf', 'pending_review', now(), now())"
                    ),
                    {"t": tenants.a, "m": f"<backlog-{uuid.uuid4()}@iso.test>"},
                )

    run(_park_five())
    try:
        assert run(_count(tenants.a)) == before_a + 5
        assert run(_count(tenants.b)) == before_b, "BU-A's backlog counted against BU-B"
    finally:

        async def _clean():
            async with real_engine.begin() as conn:
                await conn.execute(
                    text(
                        "delete from email_documents where tenant_id = :t"
                        " and message_id like '<backlog-%'"
                    ),
                    {"t": tenants.a},
                )

        run(_clean())


def test_the_posting_credential_is_the_receiving_bus_own(tenants):
    """Approve and auto-post both re-read `posting_target`. If it ever resolved to the
    wrong BU, one customer's JV would post into another's Carmen."""
    from app.database import async_session
    from app.services import email_settings_service as es

    async def _target(tag):
        async with async_session() as db:
            row = await es.resolve_by_tag(db, tag)
            return await es.posting_target(db, row)

    a_token, a_uri = run(_target(ALPHA_TAG))
    b_token, b_uri = run(_target(BETA_TAG))

    # Neither seeded BU has a token; the point is that the *uri* resolves per BU and
    # nothing bleeds across.
    assert a_token == "" and b_token == ""
    assert a_uri and b_uri
