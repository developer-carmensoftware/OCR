"""Email Automation — end-to-end pipeline test against the real mailbox and dev DB.

    python scripts/email_ingest_e2e.py            # 17 free cases, no credit/LLM/Carmen
    python scripts/email_ingest_e2e.py --paid     # + 3 cases that extract and post

Fixtures are **APPENDed** into the IMAP folder rather than sent over SMTP: `Delivered-To`
is the header the router reads, and appending is the only way to write it. The two real
bank PDFs already in the mailbox are pulled out and reused, so the paid cases run on
documents a bank actually issued rather than something we drew.

Every free case is chosen to stop before `consume_document`, so the free run must leave
`llm_usage_logs`, `ocr_tasks` and `credit_ledger` untouched — the script asserts that at
the end rather than trusting the outcome strings.

Settings state is mutated directly through SQL (owner_emails, a throwaway rule, a second
BU's tax IDs) and restored in a `finally`. That is deliberate for `tax_id_mismatch`, whose
setup — one tax ID claimed by two BUs — is a state `save_settings` refuses to write and
`foreign_tax_id` exists to catch anyway.
"""

from __future__ import annotations

import argparse
import asyncio
import email
import email.header
import email.utils
import imaplib
import json
import os
import sys
import time
from dataclasses import dataclass, field
from email.message import EmailMessage
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))

TENANT = "af0786cd-487d-4625-95fd-f2e75718447d"  # dev.carmen4.com / carmen
OTHER_TENANT = "8111f7a9-d03c-4a11-b9a6-0a4f9a1d2b7d"  # …/carmencloud — entitled, unconfigured
UNPAID_TENANT = "d1424ae3-da7b-4b7d-a51c-d217b64ed113"  # …/dev — no package
TAG = "41645ee4"
UNPAID_TAG = "e2eunpaid"
OWNER = "accounting@hotelgroup.com"
BARE = os.environ["EMAIL_INGEST_ADDRESS"]
USER, _, DOMAIN = BARE.partition("@")
INGEST = f"{USER}+{TAG}@{DOMAIN}"
FOLDER = os.environ["IMAP_FOLDER"]
DSN = os.environ["DATABASE_URL"].replace(":5432/", ":6543/")

RUN = str(int(time.time()))  # every fixture id is unique to this run, so reruns never dedupe

# Not a PDF, despite the name — `validate_magic_bytes` is what should notice.
NOT_A_PDF = b"GIF89a" + b"\0" * 400


# ── fixtures ──────────────────────────────────────────────────────────────────


@dataclass
class Case:
    id: str
    why: str
    #: None = no ledger row should exist for this fixture at all.
    expect: str | None
    #: Asserted alongside the reason code, because the two can disagree in the way that
    #: matters: `failed` means a credit was charged and refunded, `skipped` means the
    #: gate held and nothing was spent. Checking only the reason code hid exactly that
    #: (a disguised PDF reaching `consume_document`) until the spend guard caught it.
    status: str = "skipped"
    sender: str = "no-reply@bbl.co.th"
    to: str = INGEST
    subject: str = "statement"
    delivered_to: str | None = INGEST
    received_for: str | None = None
    attachments: list[tuple[str, bytes]] = field(default_factory=list)
    #: How many ledger rows to expect, when it is not one-per-fixture.
    rows: int = 1

    @property
    def message_id(self) -> str:
        return f"<e2e-{self.id}-{RUN}@test.local>"

    def build(self) -> bytes:
        msg = EmailMessage()
        msg["Message-ID"] = self.message_id
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["From"] = self.sender
        msg["To"] = self.to
        msg["Subject"] = self.subject
        if self.delivered_to:
            msg["Delivered-To"] = self.delivered_to
        if self.received_for:
            # The shape Gmail leaves when it omits Delivered-To — sender and recipient on
            # the same account. Measured 2026-08-06; `_recipients` falls back to this.
            # One line: EmailMessage refuses embedded CRLF, and `_recipients` collapses
            # whitespace before matching anyway, so folding would change nothing.
            msg["Received"] = (
                f"by 2002:a05:6638:6689 with SMTP id x; for <{self.received_for}>;"
                f" {email.utils.formatdate(localtime=True)}"
            )
        msg.set_content("e2e fixture")
        for name, blob in self.attachments:
            msg.add_attachment(blob, maintype="application", subtype="pdf", filename=name)
        return msg.as_bytes()


def free_cases(bbl_pdf: bytes, locked_pdf: bytes) -> tuple[list[Case], list[Case], Case]:
    """(cases with no owner gate, cases with the gate on, the one appended twice)."""
    open_gate = [
        Case("P1", "no attachment at all", None, subject="just a note"),
        Case("P2", "mail to the bare untagged address", None, delivered_to=BARE,
             attachments=[("BBLETAXACQ_x.pdf", NOT_A_PDF)]),
        Case("P3", "a tag nobody owns", None, delivered_to=f"{USER}+ffffffff@{DOMAIN}",
             attachments=[("BBLETAXACQ_x.pdf", NOT_A_PDF)]),
        Case("P4", "Gmail forwarding code, tagged", None,
             sender="forwarding-noreply@google.com",
             subject="(#987654321) Gmail Forwarding Confirmation"),
        Case("P5", "Gmail forwarding code, no usable tag", None,
             sender="forwarding-noreply@google.com", delivered_to=BARE,
             subject="(#111111111) Gmail Forwarding Confirmation"),
        # The false positive `gmail_confirm_code` checks the sender for: a bank is free to
        # put (#…) in a subject line, and filing that as a code would lose a real document.
        Case("P6", "bank mail whose subject carries (#…)", "no_rule_match",
             subject="Your statement (#123456789)",
             attachments=[("nothing-matches-this.pdf", NOT_A_PDF)]),
        Case("P10", "filename no pattern claims", "no_rule_match",
             attachments=[("signature-logo.pdf", NOT_A_PDF)]),
        Case("P11", "tag of a BU with no package", None, delivered_to=f"{USER}+{UNPAID_TAG}@{DOMAIN}",
             attachments=[("BBLETAXACQ_x.pdf", NOT_A_PDF)]),
        Case("P13", "encrypted PDF, no password configured", "wrong_pdf_password",
             attachments=[("BBLETAXACQ_locked.pdf", locked_pdf)]),
        Case("P14", "a .pdf that is not a PDF", "unreadable_document",
             attachments=[("BBLETAXACQ_fake.pdf", NOT_A_PDF)]),
        Case("P15", "12 attachments — the cap is 10", "unreadable_document", rows=10,
             attachments=[(f"BBLETAXACQ_{i:02d}.pdf", NOT_A_PDF) for i in range(1, 13)]),
        Case("P16", "larger than MAX_FILE_SIZE_MB", None,
             attachments=[("BBLETAXACQ_huge.pdf", NOT_A_PDF + b"\0" * 6_000_000)]),
        Case("P17", "no Delivered-To, only Received … for", "no_rule_match",
             delivered_to=None, received_for=INGEST,
             attachments=[("signature-logo.pdf", NOT_A_PDF)]),
    ]
    # Same Message-ID twice: two IMAP messages, one ledger row. `_claim` is the dedupe.
    dup = Case("P12", "same message twice — dedupe", "no_rule_match",
               attachments=[("signature-logo.pdf", NOT_A_PDF)])
    open_gate.append(dup)

    gated = [
        Case("P7", "no registered address anywhere", "sender_not_allowed",
             sender="stranger@elsewhere.com",
             attachments=[("BBLETAXACQ_real.pdf", bbl_pdf)]),
        Case("P8", "owner in From — the manual-forward shape", "no_rule_match", sender=OWNER,
             attachments=[("signature-logo.pdf", NOT_A_PDF)]),
        Case("P9", "owner in To — the auto-forward shape", "no_rule_match", to=OWNER,
             attachments=[("signature-logo.pdf", NOT_A_PDF)]),
    ]
    return open_gate, gated, dup


# ── mailbox ───────────────────────────────────────────────────────────────────


def connect() -> imaplib.IMAP4_SSL:
    box = imaplib.IMAP4_SSL(os.environ["IMAP_HOST"], int(os.environ["IMAP_PORT"]))
    box.login(os.environ["IMAP_USER"], os.environ["IMAP_PASSWORD"])
    box.select(FOLDER)
    return box


def real_pdfs(box: imaplib.IMAP4_SSL) -> dict[str, bytes]:
    """The bank PDFs already sitting in the mailbox, by attachment filename.

    PEEK, so the messages keep whatever seen/unseen state they have — a plain FETCH here
    would silently consume mail a later poll is meant to see.
    """
    out: dict[str, bytes] = {}
    for uid in (box.search(None, "ALL")[1][0] or b"").split():
        raw = box.fetch(uid, "(BODY.PEEK[])")[1][0][1]
        for part in email.message_from_bytes(raw).walk():
            name = part.get_filename()
            payload = part.get_payload(decode=True) if name else None
            if payload and payload[:4] == b"%PDF":
                out[str(email.header.make_header(email.header.decode_header(name)))] = payload
    return out


def pick(pdfs: dict[str, bytes], *, bbl: bool) -> bytes | None:
    """The biggest PDF on the right side of the BBL/other split.

    By size, not by first match: earlier runs of this script leave their own tiny
    `BBLETAXACQ_*.pdf` and `signature-logo.pdf` fixtures in the folder, and picking one of
    those for a paid case would test nothing.
    """
    hits = [v for k, v in pdfs.items() if k.startswith("BBLETAXACQ") is bbl]
    return max(hits, key=len) if hits else None


def append(box: imaplib.IMAP4_SSL, cases: list[Case], extra: list[Case] = ()) -> None:
    for case in [*cases, *extra]:
        box.append(FOLDER, "", imaplib.Time2Internaldate(time.time()), case.build())
        print(f"  + {case.id:4} {case.why}")


def unseen_ids(box: imaplib.IMAP4_SSL) -> set[str]:
    out = set()
    for uid in (box.search(None, "UNSEEN")[1][0] or b"").split():
        raw = box.fetch(uid, "(BODY.PEEK[HEADER])")[1][0][1]
        out.add(email.message_from_bytes(raw).get("Message-ID") or "")
    return out


# ── database ──────────────────────────────────────────────────────────────────


async def sql(query: str, *args):
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        if query.lstrip().lower().startswith("select"):
            return await conn.fetch(query, *args)
        return await conn.execute(query, *args)
    finally:
        await conn.close()


async def set_owner_emails(value: list[str]) -> None:
    await sql(
        "update email_ingest_settings set owner_emails = $1::jsonb where tenant_id = $2::uuid",
        json.dumps(value),
        TENANT,
    )


async def rows_for(prefix: str) -> list[dict]:
    return [
        dict(r)
        for r in await sql(
            "select message_id, attachment, status, reason_code, task_id, jv_no, error_message"
            " from email_documents where message_id like $1 order by created_at",
            f"<e2e-{prefix}-{RUN}@%",
        )
    ]


async def spend_since(started) -> dict:
    got = await sql(
        "select (select count(*) from llm_usage_logs where created_at > $1) as llm,"
        " (select count(*) from ocr_tasks where created_at > $1) as tasks,"
        " (select count(*) from credit_ledger where created_at > $1) as ledger",
        started,
    )
    return dict(got[0])


# ── assertions ────────────────────────────────────────────────────────────────


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, case_id: str, why: str, expected, got) -> None:
        ok = expected == got
        if not ok:
            self.failures.append(f"{case_id}: expected {expected!r}, got {got!r}")
        print(f"  {'OK  ' if ok else 'FAIL'} {case_id:4} {why:<44} {got!r}")

    def done(self, label: str) -> bool:
        print(f"\n{label}: {'PASS' if not self.failures else 'FAIL'}")
        for line in self.failures:
            print(f"    {line}")
        return not self.failures


async def verify(report: Report, cases: list[Case]) -> None:
    for case in cases:
        found = await rows_for(case.id)
        if case.expect is None:
            got = "no ledger row" if not found else f"{len(found)} row(s): " + "/".join(
                str(r["reason_code"]) for r in found
            )
            report.check(case.id, case.why, "no ledger row", got)
            continue
        seen = {f"{r['status']}/{r['reason_code']}" for r in found}
        want = f"{case.status}/{case.expect}"
        if case.rows != 1:
            report.check(case.id, case.why, f"{case.rows}× {want}",
                         f"{len(found)}× {'+'.join(sorted(seen)) or '—'}")
        else:
            report.check(case.id, case.why, want, seen.pop() if found else "NO ROW")


# ── phases ────────────────────────────────────────────────────────────────────


async def run_poll(label: str) -> dict:
    from app.services.email_ingest_service import run_ingest

    print(f"\n  polling ({label})…")
    summary = await run_ingest(limit=60)
    print(f"  summary: {summary}")
    return summary


async def free_run(box, report: Report, pdfs: dict[str, bytes]) -> None:
    bbl = pick(pdfs, bbl=True)
    locked = make_locked_pdf()
    open_gate, gated, dup = free_cases(bbl, locked)

    print("\n── Phase A · owner_emails = [] ──────────────────────────────────")
    await set_owner_emails([])
    append(box, open_gate, extra=[dup])  # dup appended twice on purpose
    await run_poll("A")
    await verify(report, open_gate)

    # P12's second copy must not produce a second row.
    found = await rows_for("P12")
    report.check("P12b", "the duplicate produced no second row", 1, len(found))

    # P16 must still be sitting there unread — SMALLER filters at the server, so the poll
    # never fetched it and never marked it seen.
    still = unseen_ids(box)
    p16 = next(c for c in open_gate if c.id == "P16")
    report.check("P16b", "oversized mail left unfetched (still UNSEEN)", True,
                 p16.message_id in still)

    # P4 stored the code it read out of the subject.
    code = (await sql(
        "select gmail_confirm_code from email_ingest_settings where tenant_id = $1::uuid",
        TENANT))[0]["gmail_confirm_code"]
    report.check("P4b", "confirmation code parked on the settings", "987654321", code)

    print("\n── Phase B · owner_emails = [%s] ──" % OWNER)
    await set_owner_emails([OWNER])
    append(box, gated)
    await run_poll("B")
    await verify(report, gated)


def make_locked_pdf() -> bytes:
    """A real, openable-with-a-password PDF, so P13 exercises the password branch rather
    than the magic-byte branch it would hit with a fake file."""
    import fitz

    doc = fitz.open()
    doc.new_page()
    out = doc.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret")
    doc.close()
    return out


async def paid_run(box, report: Report, pdfs: dict[str, bytes]) -> None:
    """P18–P20. Each one extracts; only P18 posts."""
    bbl, other = pick(pdfs, bbl=True), pick(pdfs, bbl=False)
    await set_owner_emails([])

    print("\n── Phase C · paid ───────────────────────────────────────────────")
    if other is None:
        print("  !! no second real PDF in the mailbox — P18 skipped")
    else:
        # A catch-all rule so the second document is admitted; its bank is then detected
        # from the document itself, which is the manual-forward path.
        await add_catchall_rule()
        p18 = Case("P18", "a real unposted document — the happy path", "posted",
                   attachments=[("commission-statement.pdf", other)])
        append(box, [p18])
        await run_poll("C1")
        row = (await rows_for("P18") or [{}])[0]
        report.check("P18", p18.why, "posted", row.get("status", "NO ROW"))
        print(f"       jv_no={row.get('jv_no')!r} note={row.get('error_message')!r}")
        await drop_catchall_rule()

    # `failed`, not `skipped`: both of these are decided *after* the extraction, so a
    # credit was charged and then refunded. That is the documented behaviour, and the
    # status is how you tell it apart from a gate that held for free.
    p19 = Case("P19", "a document already posted — duplicate", "duplicate_document",
               status="failed", attachments=[("BBLETAXACQ_again.pdf", bbl)])
    append(box, [p19])
    await run_poll("C2")
    await verify(report, [p19])

    # One tax ID, two BUs — a state the API refuses to write, built here on purpose.
    tin = (await sql("select tax_ids from email_ingest_settings where tenant_id = $1::uuid",
                     TENANT))[0]["tax_ids"]
    await sql(
        "insert into email_ingest_settings (tenant_id, enabled, tax_ids, rules, owner_emails)"
        " values ($1::uuid, false, $2::jsonb, '[]'::jsonb, '[]'::jsonb)"
        " on conflict (tenant_id) do update set tax_ids = excluded.tax_ids",
        OTHER_TENANT,
        tin,
    )
    p20 = Case("P20", "document's tax ID belongs to another BU", "tax_id_mismatch",
               status="failed", attachments=[("BBLETAXACQ_conflict.pdf", bbl)])
    append(box, [p20])
    await run_poll("C3")
    await verify(report, [p20])


async def add_catchall_rule() -> None:
    await sql(
        "update email_ingest_settings set rules = rules || $1::jsonb where tenant_id = $2::uuid",
        json.dumps([{"bank_code": None, "filename_patterns": [".pdf"], "is_active": True,
                     "bank_sender_email": None, "pdf_password_enc": None}]),
        TENANT,
    )


async def drop_catchall_rule() -> None:
    await sql(
        "update email_ingest_settings set rules = ("
        "  select coalesce(jsonb_agg(r), '[]'::jsonb) from jsonb_array_elements(rules) r"
        "  where r->>'bank_code' is not null"
        ") where tenant_id = $1::uuid",
        TENANT,
    )


# ── setup / teardown ──────────────────────────────────────────────────────────


async def make_unpaid_bu() -> None:
    await sql(
        "insert into email_ingest_settings (tenant_id, enabled, ingest_tag, tax_ids, rules,"
        " owner_emails) values ($1::uuid, true, $2, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)"
        " on conflict (tenant_id) do update set ingest_tag = excluded.ingest_tag",
        UNPAID_TENANT,
        UNPAID_TAG,
    )


async def teardown() -> None:
    await set_owner_emails([])
    await drop_catchall_rule()
    await sql("delete from email_ingest_settings where tenant_id = any($1::uuid[])",
              [UNPAID_TENANT, OTHER_TENANT])
    await sql(
        "update email_ingest_settings set gmail_confirm_code = null, gmail_confirm_at = null"
        " where tenant_id = $1::uuid and gmail_confirm_code = '987654321'",
        TENANT,
    )
    print("\ncleanup: owner_emails=[] · catch-all rule dropped · scratch BUs removed")


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--paid", action="store_true",
                    help="also run P18-P20: extracts, spends a credit, posts one real JV")
    args = ap.parse_args()

    started = (await sql("select now() as t"))[0]["t"]
    report = Report()
    box = connect()
    try:
        pdfs = real_pdfs(box)
        print(f"real documents in {FOLDER}: {list(pdfs)}")
        await make_unpaid_bu()
        await free_run(box, report, pdfs)

        spend = await spend_since(started)
        report.check("$0", "the free run charged nothing", {"llm": 0, "tasks": 0, "ledger": 0},
                     spend)

        if args.paid:
            await paid_run(box, report, pdfs)
            print(f"\n  spend for the whole run: {await spend_since(started)}")
    finally:
        try:
            await teardown()
        finally:
            box.logout()

    return 0 if report.done("email-ingest e2e") else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
