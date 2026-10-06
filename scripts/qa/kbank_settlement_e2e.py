r"""KBANK settlement report & reconciliation toggle — end to end, dry-run Carmen.

Plan: docs/email-automation/qa/2026-10-05-kbank-settlement-e2e-plan.md (groups B, C, D).

    python scripts/qa/kbank_settlement_e2e.py preflight
    python scripts/qa/kbank_settlement_e2e.py setup        # snapshot, clean slate, run-only TIN
    python scripts/qa/kbank_settlement_e2e.py routing      # B: free — nothing may be charged
    python scripts/qa/kbank_settlement_e2e.py settlement   # C: 1 credit each, no LLM
    KBANK_PDF_PASSWORD=… python scripts/qa/kbank_settlement_e2e.py fee   # D: 1 credit + 1 vision call
    python scripts/qa/kbank_settlement_e2e.py teardown     # restore the snapshot, drop run rows
    python scripts/qa/kbank_settlement_e2e.py serve-dry    # the app on :8011, Carmen writes faked

Real mailbox (fixtures are APPENDed with `Delivered-To: AIAGENT+<tag>`), real
`run_ingest()`, real parser and LLM, real dev DB — and **no Carmen write**: `post_gljv` and
`post_input_tax` are patched to record their payload and answer `QA-DRY-<n>`, so every
"posted" below is what *would* have gone to Carmen, checked line by line. Carmen reads
(chart of accounts, tax profiles) stay real.

The samples are the real KBANK delivery for merchant 451005282039001 on 21/07/2026, from
`~/Downloads/451005282039001_Card_20260721/` (override with KBANK_SAMPLES). Every case
re-sends the same document number, so between paid cases the run's own rows are moved out
of the duplicate guards' way (`_clear_doc`), scoped to `carmen` alone.

Dev only; refuses the production project. `setup` snapshots what it changes into
`backend/scratch/kbank_e2e_state.json` and `teardown` puts it back.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import email.utils
import imaplib
import io
import json
import os
import sys
import time
import zipfile
from contextlib import contextmanager
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from unittest.mock import patch

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DSN = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
DSN = DSN.replace(":5432/", ":6543/")  # transaction pooler — the EMAXCONNSESSION note
if "lhlncsjqxttcdegkqvid" in DSN:
    sys.exit("[abort] DATABASE_URL points at PRODUCTION")

TENANT = "af0786cd-487d-4625-95fd-f2e75718447d"  # dev.carmen4.com / carmen
TAG = "41645ee4"
_USER, _, _DOMAIN = os.environ["EMAIL_INGEST_ADDRESS"].partition("@")
INGEST = f"{_USER}+{TAG}@{_DOMAIN}"
FOLDER = os.environ["IMAP_FOLDER"]
QUOTED = f'"{FOLDER}"' if " " in FOLDER and not FOLDER.startswith('"') else FOLDER

SAMPLES = Path(
    os.environ.get(
        "KBANK_SAMPLES", Path.home() / "Downloads" / "451005282039001_Card_20260721"
    )
)
FEE = "E-TAX_INVOICE_CARD_451005282039001_210726E00035291_20260721.PDF"
SUM = "KB1P554V2_SUM_451005282039001_20260721.pdf"
CSV = "TAX_SUMMARY_BY_TAX_ID_CSV_0835553001610_20260721.csv"
DOC_NO = "210726E00035291"
MERCHANT = "451005282039001"
SAMPLE_TIN = "0835553001610"
STATE = ROOT / "backend" / "scratch" / "kbank_e2e_state.json"


# ── state ─────────────────────────────────────────────────────────────────────


def load_state() -> dict:
    if not STATE.exists():
        sys.exit("no state file — run `setup` first")
    return json.loads(STATE.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2, default=str), encoding="utf-8")


async def sql(query: str, *args):
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        if query.lstrip().lower().startswith(("select", "with")):
            return [dict(r) for r in await conn.fetch(query, *args)]
        return await conn.execute(query, *args)
    finally:
        await conn.close()


async def settings_row() -> dict:
    (row,) = await sql(
        "select rules, tax_ids, owner_emails, auto_post from email_ingest_settings"
        " where tenant_id = $1::uuid",
        TENANT,
    )
    return {k: (json.loads(v) if isinstance(v, str) else v) for k, v in row.items()}


async def write_settings(**cols) -> None:
    for col, value in cols.items():
        cast = "::jsonb" if col in ("rules", "tax_ids", "owner_emails") else ""
        await sql(
            f"update email_ingest_settings set {col} = $1{cast}, updated_at = now()"
            " where tenant_id = $2::uuid",
            json.dumps(value) if cast else value,
            TENANT,
        )


# ── rules ─────────────────────────────────────────────────────────────────────


def _password_enc() -> str | None:
    pw = os.environ.get("KBANK_PDF_PASSWORD")
    if not pw:
        return None
    from app.auth.session import encrypt_carmen_token
    from app.config import settings

    return encrypt_carmen_token(pw, settings.session_encryption_key)


def kbank_rule(
    *, on: bool, merchant: str | None = MERCHANT, active: bool = True
) -> dict:
    return {
        "bank_code": "KBANK",
        "bank_sender_email": None,
        "filename_patterns": [],
        "is_active": active,
        "doc_type": "ar_reconcile" if on else "fee_invoice",
        "merchant_id": merchant,
        "pdf_password_enc": _password_enc(),
    }


OTHER_PDF = {
    "bank_code": None,
    "bank_sender_email": None,
    "filename_patterns": [".pdf"],
    "is_active": True,
    "doc_type": "fee_invoice",
}


async def use_rules(state: dict, *extra: dict) -> None:
    """The BU's own non-KBANK rules as snapshotted, plus this case's KBANK/Other rules."""
    kept = [
        r
        for r in state["snapshot"]["rules"]
        if (r.get("bank_code") or "") not in ("KBANK", "")
    ]
    await write_settings(rules=[*kept, *extra])


# ── fixtures ──────────────────────────────────────────────────────────────────


def sample(name: str) -> bytes:
    return (SAMPLES / name).read_bytes()


def csv_with(**changes: str) -> bytes:
    """The real CSV with this merchant's row changed, by column header."""
    text = sample(CSV).decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    head = rows[0]
    for row in rows[1:]:
        if MERCHANT in row[0]:
            for column, value in changes.items():
                row[head.index(column)] = value
    out = io.StringIO()
    csv.writer(out, quoting=csv.QUOTE_ALL, lineterminator="\r\n").writerows(rows)
    return ("﻿" + out.getvalue()).encode("utf-8")


def zip_of(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, blob in files.items():
            z.writestr(name, blob)
    return buf.getvalue()


def zip_full(
    csv_blob: bytes | None = None, *, fee: bool = True, settlement: bool = True
) -> bytes:
    files = {}
    if fee:
        files[FEE] = sample(FEE)
    if settlement:
        files[SUM] = sample(SUM)
    if csv_blob is not False:
        files[CSV] = csv_blob or sample(CSV)
    return zip_of(files)


def message_id(state: dict, case: str) -> str:
    return f"<kbank-e2e-{state['run']}-{case}@test.local>"


def build_mail(
    state: dict, case: str, attachments: list[tuple[str, bytes, str]]
) -> bytes:
    msg = EmailMessage()
    msg["Message-ID"] = message_id(state, case)
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["From"] = "kmerchant@kasikornbank.com"
    msg["To"] = INGEST
    msg["Delivered-To"] = INGEST
    msg["Subject"] = f"[QA-{state['run']}] KBANK settlement {case}"
    msg.set_content("kbank e2e fixture")
    for name, blob, subtype in attachments:
        msg.add_attachment(blob, maintype="application", subtype=subtype, filename=name)
    return msg.as_bytes()


def as_zip(blob: bytes) -> list[tuple[str, bytes, str]]:
    return [(f"{MERCHANT}_Card_20260721.zip", blob, "zip")]


def as_pdf(name: str, blob: bytes) -> list[tuple[str, bytes, str]]:
    return [(name, blob, "pdf")]


# ── mailbox ───────────────────────────────────────────────────────────────────


def connect() -> imaplib.IMAP4_SSL:
    box = imaplib.IMAP4_SSL(
        os.environ["IMAP_HOST"], int(os.environ.get("IMAP_PORT", 993))
    )
    box.login(os.environ["IMAP_USER"], os.environ["IMAP_PASSWORD"])
    box.select(QUOTED)
    return box


def foreign_pending(prefix: str) -> list[str]:
    """Mail the poll would process that this run did not put there — someone else's."""
    box = connect()
    try:
        out = []
        for uid in (
            box.search(None, "NOT", "KEYWORD", "$OcrDone")[1][0] or b""
        ).split():
            fetched = box.fetch(uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT)])")[
                1
            ]
            if not fetched or not isinstance(fetched[0], tuple):
                continue
            head = email.message_from_bytes(fetched[0][1])
            mid = head.get("Message-ID") or ""
            # `email_ingest_e2e.py`'s P16 fixtures are oversized on purpose: the poll skips
            # them every time without a ledger row or a charge, so they never get the flag.
            if not mid.startswith((prefix, "<e2e-P16-")):
                out.append(f"{mid} {head.get('Subject')}")
        return out
    finally:
        box.logout()


def purge_own_pending(prefix: str) -> int:
    """Delete this run's own fixtures the poll never reached a verdict on, so a re-run of a
    group does not have them processed under the next case's rules."""
    box = connect()
    try:
        gone = 0
        for uid in (
            box.search(None, "NOT", "KEYWORD", "$OcrDone")[1][0] or b""
        ).split():
            fetched = box.fetch(uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")[1]
            if not fetched or not isinstance(fetched[0], tuple):
                continue
            mid = email.message_from_bytes(fetched[0][1]).get("Message-ID") or ""
            if mid.startswith(prefix):
                box.store(uid, "+FLAGS", r"\Deleted")
                gone += 1
        box.expunge()
        return gone
    finally:
        box.logout()


def append(raw: bytes) -> None:
    box = connect()
    try:
        box.append(QUOTED, "", imaplib.Time2Internaldate(time.time()), raw)
    finally:
        box.logout()


# ── dry-run Carmen ────────────────────────────────────────────────────────────

POSTED: list[dict] = []


@contextmanager
def dry_carmen():
    """Carmen's two writes, recorded and answered; nothing reaches the ERP."""
    from app.services.shared import carmen

    async def gljv(payload, token):
        POSTED.append({"kind": "gljv", "payload": payload})
        # One line per write, so `serve-dry`'s log is the evidence of what a browser approved.
        print(
            "DRY-POST gljv " + json.dumps(payload, ensure_ascii=False, default=str),
            flush=True,
        )
        return {"Code": 0, "InternalMessage": f"QA-DRY-{len(POSTED)}"}

    async def input_tax(payload, token):
        POSTED.append({"kind": "input_tax", "payload": payload})
        print(
            "DRY-POST input_tax "
            + json.dumps(payload, ensure_ascii=False, default=str),
            flush=True,
        )
        return {"Code": 0, "InternalMessage": f"QA-DRYTAX-{len(POSTED)}"}

    with (
        patch.object(carmen, "post_gljv", gljv),
        patch.object(carmen, "post_input_tax", input_tax),
    ):
        yield


async def poll(state: dict) -> None:
    from app.services.email_automation.ingest import run_ingest

    others = foreign_pending(f"<kbank-e2e-{state['run']}-")
    if others:
        sys.exit(
            "[abort] mail this run did not send is waiting in the folder:\n  "
            + "\n  ".join(others)
        )
    # carmen has no active package on dev today (every subscription row is `superseded`),
    # which holds all its mail as `retry_later`. Entitlement is not under test here, so it
    # is answered yes in this process only; the charge still comes off the real balance.
    from app.services.email_automation import ingest_settings as es

    async def entitled(_db, _tenant):
        return True

    with dry_carmen(), patch.object(es, "is_entitled", entitled):
        summary = await run_ingest(limit=20)
    print(f"    poll: {summary}")


# ── reading results back ──────────────────────────────────────────────────────


async def rows_of(state: dict, case: str) -> list[dict]:
    return await sql(
        "select id, attachment, status, reason_code, error_message, jv_no, task_id,"
        " review_payload from email_documents where message_id = $1 order by created_at",
        message_id(state, case),
    )


def flags(row: dict) -> list[str]:
    p = row["review_payload"]
    p = json.loads(p) if isinstance(p, str) else (p or {})
    return list(p.get("flags") or [])


def payload_of(row: dict) -> dict:
    p = row["review_payload"]
    return json.loads(p) if isinstance(p, str) else (p or {})


async def spend(since: datetime) -> dict:
    (got,) = await sql(
        "select (select count(*) from llm_usage_logs where tenant_id = $1 and created_at > $2) as llm,"
        " (select coalesce(sum(charged_docs), 0) from ocr_tasks where tenant_id = $1::uuid"
        "  and created_at > $2) as charged",
        TENANT,
        since,
    )
    return got


class Report:
    def __init__(self, state: dict, group: str) -> None:
        self.state, self.group, self.lines = state, group, []

    def check(self, case: str, what: str, expected, got) -> bool:
        ok = expected == got
        self.lines.append(
            {"case": case, "what": what, "ok": ok, "expected": expected, "got": got}
        )
        print(f"  {'OK  ' if ok else 'FAIL'} {case:4} {what:<52} {got!r}")
        return ok

    def done(self) -> None:
        fails = [x for x in self.lines if not x["ok"]]
        print(
            f"\n{self.group}: {'PASS' if not fails else f'{len(fails)} FAIL'} ({len(self.lines)} checks)"
        )
        self.state.setdefault("results", {})[self.group] = self.lines
        save_state(self.state)


# ── between paid cases ────────────────────────────────────────────────────────


async def clear_doc(state: dict) -> None:
    """Take the run's rows out of the duplicate guards' way, `carmen` only: a pending copy
    (`_already_pending`) and a posted one (`credit_cards.submitted_at`). Evidence is kept
    on the rows; teardown removes them."""
    await sql(
        "update email_documents set status = 'rejected', reason_code = 'rejected_by_reviewer'"
        " where tenant_id = $1::uuid and message_id like $2 and status = 'pending_review'",
        TENANT,
        f"<kbank-e2e-{state['run']}-%",
    )
    await sql(
        "update credit_cards set deleted_at = now(), deleted_by = 'kbank_e2e', updated_at = now()"
        " where tenant_id = $1::uuid and doc_no = $2 and deleted_at is null",
        TENANT,
        DOC_NO,
    )


# ── the screen, server-side ───────────────────────────────────────────────────


async def screen_rows(row: dict) -> list[dict]:
    """The rows the review screen would send. A settlement report's are the browser twin of
    `jv_for_document` (contracts/cc-jv.contract.json pins the two), fixed legs keyed the way
    the browser keys them; a fee invoice's are `build_jv_rows` against the stored rules plus
    what the AI suggested — what the screen's pickers start from."""
    from app.database import async_session
    from app.models.schemas.ocr import ExtractedDetailRow
    from app.services.credit_card import ar_reconcile as ar_svc
    from app.services.credit_card.accounting_config import get_accounting_config
    from app.services.credit_card.jv import build_jv_rows

    payload = payload_of(row)
    extracted = payload["extracted"]
    async with async_session() as db:
        if payload.get("doc_type") == "ar_reconcile":
            built = await ar_svc.jv_for_document(db, TENANT, "KBANK", extracted)
            keys = iter(["commission", "tax", "net"])
            return [{**r.model_dump(), "key": r.key or next(keys)} for r in built.rows]
        config = await get_accounting_config(db, TENANT, "KBANK")
    mappings = {**(config.mappings or {}), **(payload.get("suggested") or {})}
    details = [ExtractedDetailRow(**d) for d in extracted.get("details") or []]
    return build_jv_rows(details, mappings)


async def approve(row: dict, *, rows=None, extracted=None, post_input_tax=True):
    from app.models.schemas import ExtractedCreditCardData
    from app.services.email_automation import review

    POSTED.clear()
    extracted = extracted or payload_of(row)["extracted"]
    with dry_carmen():
        return await review.approve_document(
            row["id"],
            tenant_id=TENANT,
            reviewer="kbank-e2e",
            reviewer_name="KBANK e2e",
            extracted=ExtractedCreditCardData.model_validate(extracted),
            rows=rows if rows is not None else await screen_rows(row),
            post_input_tax_record=post_input_tax,
        )


def posted(kind: str) -> list[dict]:
    return [p["payload"] for p in POSTED if p["kind"] == kind]


def lines(gljv: dict) -> list[tuple]:
    return [
        (
            d["AccCode"],
            d["Description"],
            round(d["DrAmount"], 2),
            round(d["CrAmount"], 2),
        )
        for d in gljv["Detail"]
    ]


async def save_rule(key: str, acc: str, source: str | None = None) -> None:
    """What the review screen's approve writes first — `patch_config`, bank-scoped."""
    from app.database import async_session
    from app.services.credit_card.accounting_config import patch_config

    mapping = {"dept": "GEN", "acc": acc, **({"source": source} if source else {})}
    async with async_session() as db:
        await patch_config(db, TENANT, mappings={key: mapping}, bank_code="KBANK")


async def kbank_mapping(key: str) -> dict | None:
    from app.database import async_session
    from app.services.credit_card.accounting_config import get_accounting_config

    async with async_session() as db:
        return (await get_accounting_config(db, TENANT, "KBANK")).mappings.get(key)


async def set_post_type(value: str) -> None:
    from app.database import async_session
    from app.models.schemas import ARSettingsIn
    from app.services.credit_card import ar_reconcile as ar_svc

    async with async_session() as db:
        await ar_svc.save_settings(
            db, TENANT, ARSettingsIn(bank_code="KBANK", post_type=value)
        )


# ── phases ────────────────────────────────────────────────────────────────────


async def phase_preflight(_args) -> None:
    print(f"DB: {DSN.split('@')[-1].split('/')[0]}")
    for name in (FEE, SUM, CSV):
        print(f"  sample {'ok ' if (SAMPLES / name).exists() else 'MISSING'} {name}")
    s = await settings_row()
    print(f"  carmen auto_post={s['auto_post']} tax_ids={s['tax_ids']}")
    for r in s["rules"]:
        print(
            f"    rule {r.get('bank_code')} {r.get('doc_type')} active={r.get('is_active', True)}"
            f" merchant={r.get('merchant_id')} pw={'yes' if r.get('pdf_password_enc') else 'no'}"
        )
    owners = await sql(
        "select t.bu_code from email_ingest_settings s join tenants t on t.id = s.tenant_id"
        " where s.tax_ids::text like $1",
        f"%{SAMPLE_TIN}%",
    )
    print(f"  TIN {SAMPLE_TIN} owners: {[o['bu_code'] for o in owners] or 'none'}")
    docs = await sql(
        "select attachment, status, reason_code from email_documents"
        " where tenant_id = $1::uuid and doc_no = $2",
        TENANT,
        DOC_NO,
    )
    print(
        f"  carmen rows for {DOC_NO}: {[(d['attachment'][:30], d['status']) for d in docs]}"
    )
    print(f"  other mail pending in the folder: {len(foreign_pending('<kbank-e2e-'))}")
    print(
        f"  KBANK_PDF_PASSWORD {'set' if os.environ.get('KBANK_PDF_PASSWORD') else 'NOT set (fee phase needs it)'}"
    )


async def phase_setup(_args) -> None:
    if STATE.exists():
        sys.exit(f"state file exists — run teardown first ({STATE})")
    snapshot = await settings_row()
    state = {
        "run": str(int(time.time())),
        "started": datetime.now(UTC).isoformat(),
        "snapshot": snapshot,
    }
    # The clean slate the user approved: carmen's rows for this document only.
    deleted = await sql(
        "delete from email_documents where tenant_id = $1::uuid and doc_no = $2",
        TENANT,
        DOC_NO,
    )
    undup = await sql(
        "update credit_cards set deleted_at = now(), deleted_by = 'kbank_e2e', updated_at = now()"
        " where tenant_id = $1::uuid and doc_no = $2 and deleted_at is null",
        TENANT,
        DOC_NO,
    )
    print(f"  cleared: email_documents {deleted}, credit_cards {undup}")
    tax_ids = sorted({*snapshot["tax_ids"], SAMPLE_TIN})
    await write_settings(tax_ids=tax_ids, auto_post=False)
    print(f"  tax_ids for the run: {tax_ids} · auto_post off")
    save_state(state)
    print(f"  run {state['run']} — state in {STATE}")


async def _case(
    state, report, case, rules, attachments, expect: dict[str, str]
) -> list[dict]:
    """Send one mail under `rules`, poll, and check each attachment's `status/reason`."""
    await use_rules(state, *rules)
    append(build_mail(state, case, attachments))
    await poll(state)
    rows = await rows_of(state, case)
    got = {r["attachment"]: f"{r['status']}/{r['reason_code'] or '-'}" for r in rows}
    for name, want in expect.items():
        report.check(case, f"{name[:40]}", want, got.get(name, "NO ROW"))
    return rows


async def phase_routing(_args) -> None:
    state = load_state()
    print(
        f"  purged own stale fixtures: {purge_own_pending(f'<kbank-e2e-{state['run']}-')}"
    )
    report = Report(state, "routing")
    started = datetime.now(UTC)
    on, off = kbank_rule(on=True), kbank_rule(on=False)
    skip = "skipped/no_rule_match"

    print("\nB1 toggle on: the commission tax invoice is not read")
    await _case(
        state, report, "B1", [on], as_zip(zip_full(settlement=False)), {FEE: skip}
    )
    print("\nB2 toggle on: another merchant's settlement report is not read")
    other = SUM.replace(MERCHANT, "999999999999999")
    await _case(state, report, "B2", [on], as_pdf(other, sample(SUM)), {other: skip})
    print("\nB3 toggle off: the settlement report is not read")
    await _case(state, report, "B3", [off], as_zip(zip_full(fee=False)), {SUM: skip})
    print("\nB4 toggle on + an 'Other' .pdf rule: it cannot claim the tax invoice")
    await _case(
        state,
        report,
        "B4",
        [on, OTHER_PDF],
        as_zip(zip_full(settlement=False)),
        {FEE: skip},
    )
    print("\nB5 KBANK rule (on) switched off + 'Other' .pdf: neither file read")
    # The report is the switched-off rule's own file, so it shows as paused; the tax invoice
    # is not a file that rule reads when on, so nothing names it — and "Other" still cannot.
    await _case(
        state,
        report,
        "B5",
        [kbank_rule(on=True, active=False), OTHER_PDF],
        as_zip(zip_full()),
        {FEE: skip, SUM: "skipped/ingest_paused"},
    )
    print(
        "\nB6 no KBANK rule, 'Other' .pdf: a settlement report is never a fee invoice"
    )
    await _case(state, report, "B6", [OTHER_PDF], as_pdf(SUM, sample(SUM)), {SUM: skip})
    print(
        "\nB7 toggle on: an employee-renamed settlement report is not read (decision #37)"
    )
    await _case(
        state,
        report,
        "B7",
        [on],
        as_pdf("settlement_july.pdf", sample(SUM)),
        {"settlement_july.pdf": skip},
    )

    got = await spend(started)
    report.check(
        "B*", "LLM calls / documents charged during B", {"llm": 0, "charged": 0}, got
    )
    report.done()


async def phase_settlement(_args) -> None:
    state = load_state()
    print(
        f"  purged own stale fixtures: {purge_own_pending(f'<kbank-e2e-{state['run']}-')}"
    )
    report = Report(state, "settlement")
    on = kbank_rule(on=True)
    pending = "pending_review/-"

    # C1 — the clean report: read for free of the LLM, one credit, parks for review.
    print("\nC1 clean settlement report + CSV")
    t0 = datetime.now(UTC)
    rows = await _case(
        state,
        report,
        "C1",
        [on],
        as_zip(zip_full()),
        {FEE: "skipped/no_rule_match", SUM: pending},
    )
    report.check(
        "C1",
        "spend: LLM calls / documents charged",
        {"llm": 0, "charged": 1},
        await spend(t0),
    )
    (doc,) = [r for r in rows if r["attachment"] == SUM]
    report.check("C1", "flags", [], flags(doc))
    report.check(
        "C1",
        "extraction warnings",
        [],
        payload_of(doc)["extracted"].get("warnings") or [],
    )
    screen = await screen_rows(doc)
    dr = round(sum(r["debit"] for r in screen), 2)
    cr = round(sum(r["credit"] for r in screen), 2)
    report.check(
        "C1",
        "screen: legs / Σdebit / Σcredit",
        (10, 25091.0, 25091.0),
        (len(screen), dr, cr),
    )
    res = await approve(doc, rows=screen)
    report.check(
        "C1", "approve → dry-run JV no.", True, res["jv_no"].startswith("QA-DRY")
    )
    (jv,) = posted("gljv")
    report.check(
        "C1",
        "JV lines = screen (acc, desc, dr, cr)",
        [
            (r["acc"], r["desc"], round(r["debit"], 2), round(r["credit"], 2))
            for r in screen
        ],
        lines(jv),
    )
    (tax,) = posted("input_tax") or [None]
    report.check("C1", "input-tax record filed", True, tax is not None)
    await clear_doc(state)

    # C2 — the reviewer's edits reach the post: a comment and a re-mapped account.
    print("\nC2 edits: a leg's comment and its account")
    before = await kbank_mapping("VS INTER PREM")
    rows = await _case(state, report, "C2", [on], as_zip(zip_full()), {SUM: pending})
    (doc,) = [r for r in rows if r["attachment"] == SUM]
    await save_rule(
        "VS INTER PREM", "1021009", "settlement_detail"
    )  # what approve writes first
    screen = await screen_rows(doc)
    for r in screen:
        if r["key"] == "tax":
            r["desc"] = "Input Tax 21/07 (QA)"
    await approve(doc, rows=screen)
    (jv,) = posted("gljv")
    report.check(
        "C2",
        "re-mapped leg posts the new account",
        "1021009",
        next(d["AccCode"] for d in jv["Detail"] if d["Description"] == "VS INTER PREM"),
    )
    report.check(
        "C2",
        "edited comment posts",
        True,
        any(d["Description"] == "Input Tax 21/07 (QA)" for d in jv["Detail"]),
    )
    report.check(
        "C2",
        "rule keeps its layout tag",
        "settlement_detail",
        (await kbank_mapping("VS INTER PREM") or {}).get("source"),
    )
    await save_rule("VS INTER PREM", before["acc"])
    await clear_doc(state)

    # C3 — a colleague's save between building the screen and pressing Approve.
    print("\nC3 the JV changed under the reviewer → refused")
    rows = await _case(state, report, "C3", [on], as_zip(zip_full()), {SUM: pending})
    (doc,) = [r for r in rows if r["attachment"] == SUM]
    stale = await screen_rows(doc)
    await save_rule("VS INTER PREM", "1021009")
    try:
        await approve(doc, rows=stale)
        outcome = "posted"
    except Exception as exc:  # noqa: BLE001 — the refusal is what is under test
        outcome = "changed since" in str(exc) and "refused" or f"other: {exc}"
    report.check(
        "C3",
        "stale screen → refused, nothing posted",
        ("refused", 0),
        (outcome, len(POSTED)),
    )
    await save_rule("VS INTER PREM", before["acc"])
    await clear_doc(state)

    # C4 — Credit breakdown switched to Summary.
    print("\nC4 Summary grouping")
    await set_post_type("Summary")
    rows = await _case(state, report, "C4", [on], as_zip(zip_full()), {SUM: pending})
    (doc,) = [r for r in rows if r["attachment"] == SUM]
    await approve(doc)
    (jv,) = posted("gljv")
    report.check(
        "C4",
        "credit legs",
        ["VS", "MC", "JCB"],
        [d["Description"] for d in jv["Detail"] if d["CrAmount"]],
    )
    await set_post_type("Detail")
    await clear_doc(state)

    # C5/C6 — the CSV absent, then disagreeing.
    print("\nC5 no CSV → tin_unverified")
    rows = await _case(
        state,
        report,
        "C5",
        [on],
        as_zip(zip_full(csv_blob=False, fee=False)),
        {SUM: pending},
    )
    report.check("C5", "flag", True, "tin_unverified" in flags(rows[0]))
    await clear_doc(state)
    print("\nC6 CSV fee disagrees → warning")
    bad = csv_with(**{"TOTAL FEE/COMMISSION AMOUNT": "       590.00"})
    rows = await _case(
        state, report, "C6", [on], as_zip(zip_full(bad, fee=False)), {SUM: pending}
    )
    report.check(
        "C6",
        "warning",
        ["csvFeeMismatch"],
        [w["code"] for w in payload_of(rows[0])["extracted"].get("warnings") or []],
    )
    await clear_doc(state)

    # C7 — an unmapped key: refused until it is mapped, then posts.
    print("\nC7 unmapped payment type")
    jcb = await kbank_mapping("JCB PREM")
    await sql(
        "update bu_accounting_mapping_entries set deleted_at = now() where field_type = 'JCB PREM'"
        " and bank_code = 'KBANK' and deleted_at is null and config_id = (select id from"
        " bu_accounting_configs where tenant_id = $1::uuid and deleted_at is null)",
        TENANT,
    )
    rows = await _case(
        state, report, "C7", [on], as_zip(zip_full(fee=False)), {SUM: pending}
    )
    report.check(
        "C7", "flag mapping_missing", True, "mapping_missing" in flags(rows[0])
    )
    try:
        await approve(rows[0])
        outcome = "posted"
    except Exception as exc:  # noqa: BLE001
        outcome = "Map these payment types" in str(exc) and "refused" or f"other: {exc}"
    report.check("C7", "approve while unmapped", "refused", outcome)
    await save_rule("JCB PREM", jcb["acc"], "settlement_detail")
    await approve(rows[0])
    report.check("C7", "posts once mapped", 1, len(posted("gljv")))
    await clear_doc(state)

    # C8/C9 — an amount edited on both sides; the input-tax record declined.
    print("\nC8 amounts edited → posted as edited")
    rows = await _case(
        state, report, "C8", [on], as_zip(zip_full(fee=False)), {SUM: pending}
    )
    ext = payload_of(rows[0])["extracted"]
    ext["details"][0]["pay_amt"] = (
        f"{float(ext['details'][0]['pay_amt'].replace(',', '')) + 0.19:.2f}"
    )
    ext["total_row"]["total"] = (
        f"{float(ext['total_row']['total'].replace(',', '')) + 0.19:.2f}"
    )
    doc = {**rows[0], "review_payload": {**payload_of(rows[0]), "extracted": ext}}
    await approve(doc, extracted=ext)
    (jv,) = posted("gljv")
    report.check(
        "C8",
        "Σ posted = 25,091.19 both sides",
        (25091.19, 25091.19),
        (
            round(sum(d["DrAmount"] for d in jv["Detail"]), 2),
            round(sum(d["CrAmount"] for d in jv["Detail"]), 2),
        ),
    )
    await clear_doc(state)
    print("\nC9 input-tax record declined")
    rows = await _case(
        state, report, "C9", [on], as_zip(zip_full(fee=False)), {SUM: pending}
    )
    await approve(rows[0], post_input_tax=False)
    report.check(
        "C9",
        "JV posted, no input-tax record",
        (1, 0),
        (len(posted("gljv")), len(posted("input_tax"))),
    )
    await clear_doc(state)

    # C10/C11 — auto-post a clean report, then the same report again.
    print("\nC10 auto_post on → posts without review")
    await write_settings(auto_post=True)
    POSTED.clear()
    await _case(
        state, report, "C10", [on], as_zip(zip_full(fee=False)), {SUM: "posted/-"}
    )
    report.check(
        "C10",
        "dry-run JV + input tax",
        (1, 1),
        (len(posted("gljv")), len(posted("input_tax"))),
    )
    print("\nC11 the posted report arrives again → duplicate, not a second JV")
    POSTED.clear()
    await _case(
        state,
        report,
        "C11",
        [on],
        as_zip(zip_full(fee=False)),
        {SUM: "pending_review/duplicate_document"},
    )
    report.check("C11", "nothing posted", 0, len(POSTED))
    await write_settings(auto_post=False)
    await clear_doc(state)
    report.done()


async def phase_fee(_args) -> None:
    if not os.environ.get("KBANK_PDF_PASSWORD"):
        sys.exit("KBANK_PDF_PASSWORD is required — the E-TAX file is encrypted")
    state = load_state()
    print(
        f"  purged own stale fixtures: {purge_own_pending(f'<kbank-e2e-{state['run']}-')}"
    )
    report = Report(state, "fee")
    off = kbank_rule(on=False)
    pending = "pending_review/-"

    print("\nD1 toggle off: the commission tax invoice, with its CSV")
    t0 = datetime.now(UTC)
    rows = await _case(
        state,
        report,
        "D1",
        [off],
        as_zip(zip_full()),
        {SUM: "skipped/no_rule_match", FEE: pending},
    )
    got = await spend(t0)
    report.check(
        "D1",
        "spend: documents charged / an LLM call made",
        (1, True),
        (got["charged"], got["llm"] >= 1),
    )
    (doc,) = [r for r in rows if r["attachment"] == FEE]
    warn = [w["code"] for w in payload_of(doc)["extracted"].get("warnings") or []]
    report.check("D1", "no CSV warning", [], [w for w in warn if w.startswith("csv")])
    print(f"  info D1   flags={flags(doc)} warnings={warn}")
    try:
        await approve(doc)
        report.check(
            "D1",
            "approve → dry-run JV + input tax",
            (1, 1),
            (len(posted("gljv")), len(posted("input_tax"))),
        )
    except Exception as exc:  # noqa: BLE001 — recorded, not hidden
        report.check("D1", "approve", "posted", f"refused: {exc}")
    await clear_doc(state)

    print("\nD2 CSV VAT disagrees → warning")
    bad = csv_with(**{"VAT 7%": "      45.00"})
    rows = await _case(
        state,
        report,
        "D2",
        [off],
        as_zip(zip_full(bad, settlement=False)),
        {FEE: pending},
    )
    warn = [w["code"] for w in payload_of(rows[0])["extracted"].get("warnings") or []]
    report.check(
        "D2",
        "csvVatMismatch, no net warning",
        (True, False),
        ("csvVatMismatch" in warn, "csvNetMismatch" in warn),
    )
    await clear_doc(state)

    print("\nD3 no CSV → reads as before, no tin_unverified")
    rows = await _case(
        state,
        report,
        "D3",
        [off],
        as_zip(zip_full(csv_blob=False, settlement=False)),
        {FEE: pending},
    )
    report.check("D3", "no tin_unverified", False, "tin_unverified" in flags(rows[0]))
    await clear_doc(state)

    print("\nD4 the rule's password removed → wrong_pdf_password, free")
    t0 = datetime.now(UTC)
    await _case(
        state,
        report,
        "D4",
        [{**off, "pdf_password_enc": None}],
        as_zip(zip_full(settlement=False)),
        {FEE: "skipped/wrong_pdf_password"},
    )
    report.check("D4", "nothing charged", 0, (await spend(t0))["charged"])
    report.done()


async def phase_park(_args) -> None:
    """One clean settlement report left waiting in carmen's queue, for the review screen
    (`serve-dry` + a browser). One credit, no LLM."""
    state = load_state()
    print(
        f"  purged own stale fixtures: {purge_own_pending(f'<kbank-e2e-{state['run']}-')}"
    )
    await clear_doc(state)
    await use_rules(state, kbank_rule(on=True))
    case = f"UI{int(time.time()) % 10000}"
    append(build_mail(state, case, as_zip(zip_full(fee=False))))
    await poll(state)
    for r in await rows_of(state, case):
        print(f"  {r['attachment']}: {r['status']} — review id {r['id']}")


async def phase_teardown(_args) -> None:
    state = load_state()
    snap = state["snapshot"]
    await write_settings(
        rules=snap["rules"],
        tax_ids=snap["tax_ids"],
        owner_emails=snap["owner_emails"],
        auto_post=snap["auto_post"],
    )
    await set_post_type("Detail")
    gone = await sql(
        "delete from email_documents where message_id like $1",
        f"<kbank-e2e-{state['run']}-%",
    )
    await sql(
        "update credit_cards set deleted_at = now(), deleted_by = 'kbank_e2e', updated_at = now()"
        " where tenant_id = $1::uuid and doc_no = $2 and deleted_at is null",
        TENANT,
        DOC_NO,
    )
    print(f"  settings restored · run rows removed: {gone}")
    report = ROOT / "backend" / "scratch" / f"kbank_e2e_{state['run']}_results.json"
    report.write_text(
        json.dumps(state.get("results", {}), indent=2, default=str), encoding="utf-8"
    )
    STATE.unlink()
    print(f"  results kept in {report}")


def phase_serve_dry(args) -> None:
    """The app on :8011 with Carmen's writes faked — for driving the review screen in a
    browser (Playwright routes /api there) without posting anything to Carmen."""
    import uvicorn

    from app.main import app

    with dry_carmen():
        uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "phase",
        choices=[
            "preflight",
            "setup",
            "routing",
            "settlement",
            "fee",
            "park",
            "teardown",
            "serve-dry",
        ],
    )
    ap.add_argument("--port", type=int, default=8011)
    args = ap.parse_args()
    if args.phase == "serve-dry":
        phase_serve_dry(args)
        return
    asyncio.run(globals()[f"phase_{args.phase.replace('-', '_')}"](args))


if __name__ == "__main__":
    main()
