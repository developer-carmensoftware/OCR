"""Email Automation — many documents, many BUs, one mailbox. Dry run, real LLM.

    python scripts/email_multibu_loadtest.py --mode batch --bus 5 --dry-check
    python scripts/email_multibu_loadtest.py --mode batch --bus 5 > report.md
    python scripts/email_multibu_loadtest.py --mode concurrent --levels 1,2,4,8
    python scripts/email_multibu_loadtest.py --mode cleanup

Two questions nothing else in this repo answers.

**Does a mixed batch stay attributed to the right BU?** `_process_attachment` sets
`current_tenant_id` and `current_carmen_uri` as ContextVars, per attachment, inside one
serial loop. If either leaked, a credit would be charged to one company and a JV posted
into another's books — the single failure mode unattended posting cannot recover from.
So every assertion here is read back out of the database and compared against the tag on
the envelope, never against the strings `run_ingest` returns.

**Does one poll finish before the next tick?** Attachments are processed serially and
`_poll_lock` skips an overlapping poll, so "many BUs at once" is one queue in production.
The cron fires every 10 minutes; this measures how many documents fit in that.

Nothing is posted to Carmen. Five functions of `carmen_service` are patched **at the name
`email_ingest_service` imported them under**, so no HTTP request leaves this process for
Carmen — while the LLM, `consume_document`/`refund_document`, the ledger and every DB
write run for real, because that is what is being measured.

`foreign_tax_id` is patched to None for the matrix on purpose: real bank documents print a
real customer's TIN, which is very likely registered to the dev BU already, and every
document would park as `tax_id_mismatch` before the happy path ever ran. The gate gets its
own unpatched case at the end instead.

Prerequisites (the script refuses to start without them):
  - real bank documents in backend/example_field/  (gitignored — customer documents never
    enter the repo)
  - a Gmail label `LoadTest` on the ingest mailbox; nothing is appended to `AR Agent`
  - uvicorn stopped — this opens the app's own pool and Supavisor caps the project at 15
  - DATABASE_URL pointing at dev, which is asserted rather than trusted
"""

from __future__ import annotations

import argparse
import asyncio
import email.utils
import imaplib
import json
import os
import secrets
import statistics
import sys
import time
import uuid
from contextlib import ExitStack
from dataclasses import dataclass, field
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from unittest.mock import patch

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))

# The one project this script must never touch. Everything it does — inserting tenants,
# charging credits, deleting rows by pattern — is safe on dev and unforgivable on prod.
PROD_PROJECT_REF = "lhlncsjqxttcdegkqvid"

# Never `AR Agent`. A poll of the live folder would eat pilot customers' mail, and the
# deployed cron would race this script for the same messages.
FOLDER = "LoadTest"

DOCS_DIR = ROOT / "backend" / "example_field"
DOC_SUFFIXES = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic")

# Scratch tenants share the host pattern `backend/scripts/load_test_v2.py --mode cleanup`
# already knows, so its sweep keeps working as a second net.
HOST_PREFIX = "loadtest-"
HOST_SUFFIX = ".local"

RUN = str(int(time.time()))  # every message id is unique to this run, so reruns never dedupe

BARE = os.environ.get("EMAIL_INGEST_ADDRESS", "")
USER, _, DOMAIN = BARE.partition("@")
DSN = os.environ.get("DATABASE_URL", "").replace(":5432/", ":6543/")

# Carmen master data, frozen. `_suggest_missing_mappings` reads these to fill the payment
# types a new BU has never mapped; the LLM call it makes afterwards is real and is counted.
ACCOUNTS = {
    "Data": [
        {"AccCode": "5100", "Description": "Credit card commission", "Type": "expense"},
        {"AccCode": "1150", "Description": "Input tax (VAT)", "Type": "asset"},
        {"AccCode": "1010", "Description": "Bank account", "Type": "asset"},
        {"AccCode": "1130", "Description": "Accounts receivable - card", "Type": "asset"},
        {"AccCode": "1131", "Description": "Accounts receivable - Visa", "Type": "asset"},
        {"AccCode": "1132", "Description": "Accounts receivable - MasterCard", "Type": "asset"},
        {"AccCode": "1133", "Description": "Accounts receivable - JCB", "Type": "asset"},
        {"AccCode": "1134", "Description": "Accounts receivable - Amex", "Type": "asset"},
        {"AccCode": "1135", "Description": "Accounts receivable - UnionPay", "Type": "asset"},
        {"AccCode": "1136", "Description": "Accounts receivable - QR / e-wallet", "Type": "asset"},
    ]
}
DEPARTMENTS = {"Data": [{"DeptCode": "GEN", "Description": "General", "DefaultAccount": None}]}
TAX_PROFILES = {"Data": [{"Code": "VAT7", "Description": "VAT 7%", "TaxRate": 7, "Active": True}]}

# Registered to one scratch BU in the tax-ID gate so another BU's document trips on it.
CONFLICT_TIN = "0994000165676"

# The three fixed fields every BU maps on day one. Payment types are deliberately left
# unmapped so the AI-fill path runs — which is also what makes "first document of a BU
# costs two LLM calls, the rest cost one" measurable.
SEED_MAPPINGS = {
    "commission": {"dept": "GEN", "acc": "5100"},
    "tax": {"dept": "GEN", "acc": "1150"},
    "net": {"dept": "GEN", "acc": "1010"},
}


# ── guards ────────────────────────────────────────────────────────────────────


def guard() -> None:
    """Refuse to run anywhere this script would do damage."""
    problems = []
    if not DSN:
        problems.append("DATABASE_URL is not set")
    if PROD_PROJECT_REF in DSN:
        problems.append(f"DATABASE_URL points at PRODUCTION ({PROD_PROJECT_REF})")
    if not BARE or not DOMAIN:
        problems.append("EMAIL_INGEST_ADDRESS is not set")
    for var in ("IMAP_HOST", "IMAP_USER", "IMAP_PASSWORD"):
        if not os.environ.get(var):
            problems.append(f"{var} is not set")
    if problems:
        for p in problems:
            print(f"[abort] {p}")
        sys.exit(2)


# ── database ──────────────────────────────────────────────────────────────────


async def sql(query: str, *args):
    """One connection per statement, port 6543, no prepared statements.

    Same shape as `scripts/email_ingest_e2e.py`: Supavisor caps the project at 15 session
    connections and the app's own pool (5+5) is already open inside this process, so a
    long-lived second pool here is how you produce EMAXCONNSESSION instead of a report.
    """
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        if query.lstrip().lower().startswith("select"):
            return await conn.fetch(query, *args)
        return await conn.execute(query, *args)
    finally:
        await conn.close()


# ── documents ─────────────────────────────────────────────────────────────────


def load_documents(
    limit: int | None = None, directory: str | None = None
) -> list[tuple[str, bytes]]:
    """The real bank documents to run through the pipeline, by filename.

    K documents × N BUs is the number of happy paths this run gets: the duplicate guard is
    keyed (tenant, bank_code, doc_no), so the same file lands cleanly in every BU but a
    second time in one BU is a `duplicate_document` — correct, and tested on purpose below.
    """
    root = Path(directory) if directory else DOCS_DIR
    if not root.is_dir():
        print(f"[abort] {root} does not exist — put real bank documents there first")
        sys.exit(2)
    files = sorted(p for p in root.iterdir() if p.suffix.lower() in DOC_SUFFIXES)
    if not files:
        print(f"[abort] no documents in {root} (looked for {', '.join(DOC_SUFFIXES)})")
        sys.exit(2)
    return [(p.name, p.read_bytes()) for p in files[: limit or len(files)]]


# ── scratch BUs ───────────────────────────────────────────────────────────────


@dataclass
class BU:
    index: int
    tenant_id: str
    code: str
    tag: str
    host: str
    uri: str

    @property
    def address(self) -> str:
        return f"{USER}+{self.tag}@{DOMAIN}"

    @property
    def rules(self) -> list[dict]:
        # Catch-all: which bank issued the document is resolved from the document itself,
        # which is the manual-forward path and the one that exercises detect_bank_code.
        return [
            {
                "bank_code": None,
                "bank_sender_email": None,
                "filename_patterns": [s for s in DOC_SUFFIXES],
                "is_active": True,
                "pdf_password_enc": None,
            }
        ]


async def create_bu(index: int, allowance: int) -> BU:
    """One entitled, enabled, credential-carrying BU with nothing else of its own."""
    from app.auth.session import encrypt_carmen_token
    from app.config import settings

    tenant_id = str(uuid.uuid4())
    host = f"{HOST_PREFIX}{tenant_id[:8]}{HOST_SUFFIX}"
    bu = BU(
        index=index,
        tenant_id=tenant_id,
        code=f"LT{index}",
        tag=f"lt{secrets.token_hex(3)}",
        host=host,
        uri=f"https://loadtest-{index}.invalid",
    )

    await sql(
        "insert into tenants (id, host, bu_code, name, plan, is_active)"
        " values ($1::uuid, $2, $3, $4, 'free', true)",
        tenant_id,
        host,
        bu.code,
        f"loadtest/{bu.code}",
    )

    # `is_entitled` is an active in-window subscription, nothing else — without this every
    # message parks as `retry_later` before a single document is opened.
    pack = await sql(
        "select code from credit_packs where kind = 'subscription' and is_active"
        " order by sort_order limit 1"
    )
    if not pack:
        pack = await sql("select code from credit_packs order by sort_order limit 1")
    if not pack:
        print("[abort] no rows in credit_packs — cannot create a subscription")
        sys.exit(2)

    await sql(
        "insert into tenant_subscriptions (id, tenant_id, plan_code, doc_allowance, docs_used,"
        " period_start, period_end, billing_period, cycle_start, status)"
        " values ($1::uuid, $2::uuid, $3, $4, 0, now() - interval '1 hour',"
        " now() + interval '30 days', 'monthly', now() - interval '1 hour', 'active')",
        str(uuid.uuid4()),
        tenant_id,
        pack[0]["code"],
        allowance,
    )
    # Balance zero on purpose: the subscription allowance is sized to the exact number of
    # documents this BU should be charged for, so a double charge runs out and raises 402
    # where it can be seen, instead of quietly draining a second pool.
    await sql(
        "insert into tenant_credits (tenant_id, balance) values ($1::uuid, 0)"
        " on conflict (tenant_id) do update set balance = 0",
        tenant_id,
    )

    await sql(
        "insert into email_ingest_settings (tenant_id, ingest_tag, enabled, owner_emails,"
        " tax_ids, rules, carmen_token_enc, carmen_uri, carmen_token_fp)"
        " values ($1::uuid, $2, true, '[]'::jsonb, '[]'::jsonb, $3::jsonb, $4, $5, $6)",
        tenant_id,
        bu.tag,
        json.dumps(bu.rules),
        encrypt_carmen_token(f"loadtest-{index}|{uuid.uuid4()}", settings.session_encryption_key),
        bu.uri,
        f"lt{index:06d}",
    )
    return bu


async def seed_gl(bu: BU) -> None:
    """The accounting config a BU has after finishing the wizard once."""
    from app.database import async_session
    from app.models.schemas.common import FieldMapping
    from app.models.schemas.config import AccountingConfigRequest
    from app.services.accounting_config_service import save_accounting_config

    async with async_session() as db:
        await save_accounting_config(
            db,
            bu.tenant_id,
            AccountingConfigRequest(
                file_prefix="LT",
                file_source="LOADTEST",
                description="Load test",
                branch="00000",
                mappings={k: FieldMapping(**v) for k, v in SEED_MAPPINGS.items()},
            ),
        )
        await db.commit()


# ── mailbox ───────────────────────────────────────────────────────────────────


def connect() -> imaplib.IMAP4_SSL:
    """A mailbox connection pinned to the test folder, created on first use.

    Creating it here rather than asking someone to add a Gmail label by hand: it is one
    idempotent IMAP command, and a run that aborts because a label is missing is a run
    that tells you nothing.
    """
    box = imaplib.IMAP4_SSL(os.environ["IMAP_HOST"], int(os.environ.get("IMAP_PORT", 993)))
    box.login(os.environ["IMAP_USER"], os.environ["IMAP_PASSWORD"])
    if box.select(f'"{FOLDER}"')[0] != "OK":
        box.create(f'"{FOLDER}"')
        print(f"  (created IMAP folder {FOLDER!r})")
        if box.select(f'"{FOLDER}"')[0] != "OK":
            print(f"[abort] could not open or create IMAP folder {FOLDER!r}")
            sys.exit(2)
    return box


def message_id_for(bu: BU, seq: int) -> str:
    return f"<lt-{RUN}-{bu.code}-{seq}@loadtest.local>"


def build_message(bu: BU, filename: str, blob: bytes, seq: int) -> bytes:
    """A forwarded bank mail addressed to this BU's tagged address.

    `Delivered-To` is what `_recipients` reads — the reason fixtures are APPENDed rather
    than sent over SMTP, since nothing else can write that header.
    """
    msg = EmailMessage()
    msg["Message-ID"] = message_id_for(bu, seq)
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["From"] = "no-reply@bank.example.com"
    msg["To"] = bu.address
    msg["Delivered-To"] = bu.address
    msg["Subject"] = f"loadtest {bu.code} #{seq}"
    msg.set_content("load test fixture")
    msg.add_attachment(blob, maintype="application", subtype="octet-stream", filename=filename)
    return msg.as_bytes()


def append_all(box: imaplib.IMAP4_SSL, messages: list[bytes]) -> None:
    for raw in messages:
        box.append(f'"{FOLDER}"', "", imaplib.Time2Internaldate(time.time()), raw)


def purge_folder(box: imaplib.IMAP4_SSL) -> int:
    """Empty the test folder.

    Everything in it was put there by this script — the folder is created here and nothing
    else writes to it, which is the whole reason for not appending into `AR Agent`. That
    also avoids matching on Message-ID: Gmail's IMAP `HEADER` search does not reliably do
    substring matches, and a purge that silently deletes nothing is worse than none.

    Re-selects first: the poll ran on its own connection, so this one's view of the folder
    predates every flag it set.
    """
    box.select(f'"{FOLDER}"')
    deleted = 0
    for uid in (box.search(None, "ALL")[1][0] or b"").split():
        box.store(uid, "+FLAGS", "\\Deleted")
        deleted += 1
    if deleted:
        box.expunge()
    return deleted


# ── dry run ───────────────────────────────────────────────────────────────────


@dataclass
class DryRun:
    """Everything the pipeline tried to send to Carmen, kept instead of sent."""

    jvs: list[dict] = field(default_factory=list)
    taxes: list[dict] = field(default_factory=list)
    timings: list[dict] = field(default_factory=list)


def dry_run_patches(rec: DryRun, *, fake_extract: bool) -> list:
    """Patch the five Carmen calls, the tax-ID cross-check, and the mailbox folder.

    Everything is patched on `email_ingest_service` itself, which is where the names were
    imported to — patching `carmen_service` would leave this module's own references bound
    to the originals.
    """
    from app.context import current_carmen_uri, current_tenant_id
    from app.services import email_ingest_service as ingest

    async def _post_gljv(payload, token):
        rec.jvs.append(
            {
                "tenant": current_tenant_id.get(),
                # The two values a leak would corrupt: who we think we are, and whose
                # Carmen we are about to write into.
                "uri": current_carmen_uri.get(),
                "token": token,
                "doc": payload.get("InvhInvNo") if isinstance(payload, dict) else None,
                "payload": payload,
            }
        )
        return {"Code": 0, "InternalMessage": f"DRY-{len(rec.jvs)}"}

    async def _post_input_tax(payload, token):
        rec.taxes.append({"tenant": current_tenant_id.get(), "token": token, "payload": payload})
        return {"Code": 0, "InternalMessage": f"DRYTAX-{len(rec.taxes)}"}

    async def _accounts(token):
        return ACCOUNTS

    async def _departments(token):
        return DEPARTMENTS

    async def _tax_profiles(token):
        return TAX_PROFILES

    async def _no_conflict(db, tax_ids, tenant_id):
        return None

    patches = [
        patch.object(ingest, "post_gljv", _post_gljv),
        patch.object(ingest, "post_input_tax", _post_input_tax),
        patch.object(ingest, "get_account_codes", _accounts),
        patch.object(ingest, "get_departments", _departments),
        patch.object(ingest, "get_tax_profiles", _tax_profiles),
        patch.object(ingest.es, "foreign_tax_id", _no_conflict),
        patch.object(ingest.settings, "imap_folder", FOLDER),
    ]
    if fake_extract:
        # Both LLM calls, not just the vision one: a document whose payment types the BU
        # has never mapped goes on to the suggestion model, and `--dry-check` promises to
        # cost nothing. `fill_missing_mappings` still writes what this returns, so the
        # "second document of the same type is deterministic" path is still exercised.
        patches.append(patch.object(ingest.ocr_service, "extract_stateless", _canned_extract))
        patches.append(patch.object(ingest, "_suggest_missing_mappings", _canned_suggest))
    return patches


async def _canned_suggest(missing, bank_code, carmen_token):
    return {key: {"dept": "GEN", "acc": "1131"} for key in missing}


async def _canned_extract(*, file_bytes, original_filename, bank_code, task_id, pdf_password=None):
    """`--dry-check`: prove the harness before paying for a single vision call.

    The doc_no is derived from the filename, so the same document keeps one identity across
    BUs (no duplicate) while two different documents never collide inside one BU.
    """
    from app.models.schemas import ExtractedCreditCardData
    from app.models.schemas.ocr import ExtractedDetailRow

    await asyncio.sleep(0.05)  # a call that takes no time at all hides ordering bugs
    return ExtractedCreditCardData(
        doc_no=f"LT-{abs(hash(original_filename)) % 100000:05d}",
        doc_date="15/01/2026",
        bank_company_name="Krungthai Card",
        bank_name="KTC",
        company_name="Load Test Hotel",
        doc_name="Fee invoice",
        raw_text="",
        # A TIN, so the tax-ID gate has something to conflict with under --dry-check.
        # Bangkok Bank's own registered number, which no scratch BU may claim as its own.
        tax_ids=[CONFLICT_TIN],
        is_duplicate=False,
        details=[
            # A processor fee-invoice row: commis_amt is the fee, tax_amt the VAT on
            # it, pay_amt the two together, total 0. Coherent at exactly 7% so
            # `build_input_tax_payload` resolves a profile and the second Carmen
            # document is exercised too, not skipped as "no active tax profile".
            ExtractedDetailRow(
                transaction="Visa",
                pay_amt="1070.00",
                commis_amt="1000.00",
                tax_amt="70.00",
                total="0",
            )
        ],
    )


def timing_patch(rec: DryRun):
    """Wrap `_process_attachment` to time each document without changing what it does."""
    from app.services import email_ingest_service as ingest

    original = ingest._process_attachment

    async def timed(**kwargs):
        t0 = time.perf_counter()
        try:
            outcome = await original(**kwargs)
        except Exception as exc:
            outcome = f"raised:{type(exc).__name__}"
            raise
        finally:
            rec.timings.append(
                {
                    "tenant": kwargs["tenant_id"],
                    "attachment": kwargs["filename"],
                    "seconds": time.perf_counter() - t0,
                    "outcome": outcome,
                }
            )
        return outcome

    return patch.object(ingest, "_process_attachment", timed)


# ── reading the result back ───────────────────────────────────────────────────


async def ledger_rows() -> list[dict]:
    """One row per (message, attachment) this run produced, with what it spawned."""
    return [
        dict(r)
        for r in await sql(
            "select d.message_id, d.attachment, d.status, d.reason_code, d.jv_no,"
            " d.error_message, d.tenant_id::text as doc_tenant, d.task_id::text as task_id,"
            " t.tenant_id::text as task_tenant, t.charged_docs,"
            " c.tenant_id::text as card_tenant, c.bank_code, c.doc_no,"
            " (c.submitted_at is not null) as submitted"
            " from email_documents d"
            " left join ocr_tasks t on t.id = d.task_id"
            " left join credit_cards c on c.task_id = d.task_id"
            " where d.message_id like $1 order by d.created_at",
            f"<lt-{RUN}-%",
        )
    ]


async def llm_rows(since: datetime, tenant_ids: list[str]) -> list[dict]:
    return [
        dict(r)
        for r in await sql(
            "select tenant_id, task_id, call_type, model, prompt_tokens, completion_tokens,"
            " total_tokens, cost_usd, duration_ms from llm_usage_logs"
            " where created_at >= $1 and tenant_id = any($2::text[])",
            since,
            tenant_ids,
        )
    ]


async def subscription_usage(tenant_ids: list[str]) -> dict[str, dict]:
    return {
        str(r["tenant_id"]): dict(r)
        for r in await sql(
            "select tenant_id::text as tenant_id, doc_allowance, docs_used"
            " from tenant_subscriptions where tenant_id = any($1::uuid[])",
            tenant_ids,
        )
    }


class Report:
    """Prints as it goes so a run that dies halfway still says what it proved."""

    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, name: str, expected, got) -> bool:
        ok = expected == got
        if not ok:
            self.failures.append(f"{name}: expected {expected!r}, got {got!r}")
        print(f"  {'PASS' if ok else 'FAIL'}  {name:<52} {got!r}")
        return ok

    def done(self, label: str) -> bool:
        print(f"\n**{label}: {'PASS' if not self.failures else 'FAIL'}**\n")
        for line in self.failures:
            print(f"    {line}")
        return not self.failures


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, int(round((p / 100) * (len(ordered) - 1)))))
    return ordered[k]


def token_table(rows: list[dict]) -> str:
    """Tokens and cost, split by call_type — extract is the vision call every document
    makes, suggest is the GL fill a BU only pays for until its mappings are learned."""
    out = [
        "| call_type | calls | prompt | completion | total | cost USD | p50 ms | p95 ms |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for kind in sorted({str(r["call_type"]) for r in rows}):
        group = [r for r in rows if str(r["call_type"]) == kind]
        durations = [float(r["duration_ms"] or 0) for r in group]
        out.append(
            f"| {kind} | {len(group)} "
            f"| {sum(r['prompt_tokens'] or 0 for r in group):,} "
            f"| {sum(r['completion_tokens'] or 0 for r in group):,} "
            f"| {sum(r['total_tokens'] or 0 for r in group):,} "
            f"| {sum(float(r['cost_usd'] or 0) for r in group):.6f} "
            f"| {pct(durations, 50):,.0f} | {pct(durations, 95):,.0f} |"
        )
    return "\n".join(out)


# ── Lane A: one mixed batch through the real poll ─────────────────────────────


async def mode_batch(args) -> bool:
    from app.services import email_ingest_service as ingest

    documents = load_documents(args.docs, args.docs_dir)
    per_bu = len(documents)
    print(f"# Multi-BU batch — {args.bus} BUs × {per_bu} documents\n")
    print(f"run={RUN}  folder={FOLDER}  documents={[n for n, _ in documents]}")
    print(f"llm={'CANNED (--dry-check)' if args.dry_check else 'REAL'}  carmen=DRY RUN\n")

    started = (await sql("select now() as t"))[0]["t"]
    rec = DryRun()
    box = connect()
    bus: list[BU] = []
    report = Report()
    try:
        for i in range(1, args.bus + 1):
            # Allowance is exactly what this BU should be charged, so anything that
            # charges twice runs out and raises 402 where it can be seen. `--gates` adds
            # headroom for its own two documents — without it the duplicate case runs out
            # of allowance first, `_release` drops the claim, and the gate reports nothing
            # instead of the duplicate it exists to prove.
            bu = await create_bu(i, allowance=per_bu + (2 if args.gates else 0))
            await seed_gl(bu)
            bus.append(bu)
            print(f"  BU {bu.code}  tenant={bu.tenant_id}  tag={bu.tag}")

        # Interleaved, not grouped: BU1, BU2, …, BU1, BU2, … so consecutive documents in
        # the batch belong to different tenants. Grouping them would hide exactly the
        # ContextVar leak this run exists to rule out.
        messages, expected = [], {}
        for seq, (name, blob) in enumerate(documents, start=1):
            for bu in bus:
                messages.append(build_message(bu, name, blob, seq))
                expected[message_id_for(bu, seq)] = bu
        append_all(box, messages)
        print(f"\nappended {len(messages)} message(s)\n")

        with ExitStack() as stack:
            for p in dry_run_patches(rec, fake_extract=args.dry_check):
                stack.enter_context(p)
            stack.enter_context(timing_patch(rec))
            t0 = time.perf_counter()
            summary = await ingest.run_ingest(limit=len(messages) + 5)
            wall = time.perf_counter() - t0

        print(f"poll summary: {summary}")
        print(f"wall clock: {wall:,.1f}s for {len(messages)} attachment(s)\n")

        rows = await ledger_rows()
        tenant_ids = [b.tenant_id for b in bus]
        llm = await llm_rows(started, tenant_ids)
        usage = await subscription_usage(tenant_ids)

        print("## Attribution\n")
        report.check("every message produced a ledger row", len(messages), len(rows))
        misrouted = [
            r
            for r in rows
            if (owner := expected.get(r["message_id"])) and r["doc_tenant"] != owner.tenant_id
        ]
        report.check("ledger rows on the wrong tenant", 0, len(misrouted))
        report.check(
            "ocr_tasks on the wrong tenant",
            0,
            sum(1 for r in rows if r["task_tenant"] and r["task_tenant"] != r["doc_tenant"]),
        )
        report.check(
            "credit_cards on the wrong tenant",
            0,
            sum(1 for r in rows if r["card_tenant"] and r["card_tenant"] != r["doc_tenant"]),
        )
        by_task = {r["task_id"]: r["doc_tenant"] for r in rows if r["task_id"]}
        report.check(
            "llm_usage_logs on the wrong tenant",
            0,
            sum(
                1
                for r in llm
                if r["task_id"] and by_task.get(r["task_id"], r["tenant_id"]) != r["tenant_id"]
            ),
        )
        # A JV built with one BU's rows and another's host is the leak that costs money.
        uris = {b.uri for b in bus}
        report.check("JV posts", len(messages), len(rec.jvs))
        report.check(
            "JV posted to a host no BU owns", 0, sum(1 for j in rec.jvs if j["uri"] not in uris)
        )
        mismatched = [
            j
            for j in rec.jvs
            if j["uri"] != next((b.uri for b in bus if b.tenant_id == j["tenant"]), None)
        ]
        report.check("JV posted with another BU's host", 0, len(mismatched))

        print("\n## Outcomes\n")
        print(
            "| BU | " + " | ".join(f"{s}" for s in ("posted", "failed", "skipped")) + " | reasons |"
        )
        print("|---|---|---|---|---|")
        for bu in bus:
            mine = [r for r in rows if r["doc_tenant"] == bu.tenant_id]
            reasons = sorted({str(r["reason_code"]) for r in mine if r["reason_code"]})
            counts = [
                sum(1 for r in mine if r["status"] == s) for s in ("posted", "failed", "skipped")
            ]
            print(
                f"| {bu.code} | {counts[0]} | {counts[1]} | {counts[2]} | {', '.join(reasons) or '—'} |"
            )
        report.check(
            "documents posted", len(messages), sum(1 for r in rows if r["status"] == "posted")
        )
        report.check(
            "posted documents stamped submitted_at",
            sum(1 for r in rows if r["status"] == "posted"),
            sum(1 for r in rows if r["status"] == "posted" and r["submitted"]),
        )

        print("\n## Money\n")
        print("| BU | charged_docs | docs_used | allowance |")
        print("|---|---|---|---|")
        exact = True
        for bu in bus:
            mine = [r for r in rows if r["doc_tenant"] == bu.tenant_id]
            charged = sum(int(r["charged_docs"] or 0) for r in mine)
            used = usage.get(bu.tenant_id, {})
            print(
                f"| {bu.code} | {charged} | {used.get('docs_used')} | {used.get('doc_allowance')} |"
            )
            exact = exact and charged == per_bu and used.get("docs_used") == per_bu
        report.check("every BU charged exactly once per document", True, exact)

        print("\n## Tokens and cost\n")
        print(token_table(llm))
        total_cost = sum(float(r["cost_usd"] or 0) for r in llm)
        docs = max(1, sum(1 for r in rows if r["status"] == "posted"))
        print(
            f"\ntotal {sum(r['total_tokens'] or 0 for r in llm):,} tokens · "
            f"${total_cost:.6f} · ${total_cost / docs:.6f} and "
            f"{sum(r['total_tokens'] or 0 for r in llm) / docs:,.0f} tokens per posted document"
        )

        print("\n## Throughput\n")
        seconds = [t["seconds"] for t in rec.timings]
        if seconds:
            print(
                f"- per document: p50 {pct(seconds, 50):,.1f}s · p95 {pct(seconds, 95):,.1f}s "
                f"· max {max(seconds):,.1f}s · mean {statistics.mean(seconds):,.1f}s"
            )
            print(f"- one poll of {len(messages)} attachment(s): {wall:,.1f}s")
            print(
                f"- **documents that fit in the 10-minute cron tick: "
                f"{int(600 / max(0.001, statistics.mean(seconds)))}**"
            )
        report.check("poll finished inside the 10-minute cron tick", True, wall < 600)

        if args.gates:
            await gate_cases(report, bus, documents, box, rec, args)

    finally:
        print("\n## Cleanup\n")
        try:
            print(f"- mailbox: {purge_folder(box)} fixture(s) expunged from {FOLDER}")
        finally:
            box.logout()
        await cleanup_tenants([b.tenant_id for b in bus])

    return report.done("multi-BU batch")


async def gate_cases(report: Report, bus, documents, box, rec: DryRun, args) -> None:
    """The two gates the matrix deliberately bypasses, each with the patch removed."""
    from app.services import email_ingest_service as ingest

    name, blob = documents[0]
    a, b = bus[0], bus[1 if len(bus) > 1 else 0]

    print("\n## Gates\n")

    # 1. The same document again, into the BU that already posted it.
    again = build_message(a, name, blob, 900)
    append_all(box, [again])
    with ExitStack() as stack:
        for p in dry_run_patches(rec, fake_extract=args.dry_check):
            stack.enter_context(p)
        await ingest.run_ingest(limit=5)
    row = next((r for r in await ledger_rows() if r["message_id"] == message_id_for(a, 900)), {})
    report.check(
        "the same document twice in one BU is a duplicate",
        "failed/duplicate_document",
        f"{row.get('status')}/{row.get('reason_code')}",
    )

    # 2. A document whose TIN belongs to another BU — `foreign_tax_id` unpatched, and the
    #    conflicting registration written directly, because the API refuses to store it.
    extracted_tin = await sql(
        "select tax_ids from email_ingest_settings where tenant_id = $1::uuid", b.tenant_id
    )
    if extracted_tin:
        await sql(
            "update email_ingest_settings set tax_ids = $1::jsonb where tenant_id = $2::uuid",
            json.dumps([CONFLICT_TIN]),
            b.tenant_id,
        )
    conflict = build_message(a, name, blob, 901)
    append_all(box, [conflict])
    with ExitStack() as stack:
        # Everything except foreign_tax_id, which is the gate under test here.
        for p in dry_run_patches(rec, fake_extract=args.dry_check):
            if getattr(p, "attribute", "") != "foreign_tax_id":
                stack.enter_context(p)
        await ingest.run_ingest(limit=5)
    row = next((r for r in await ledger_rows() if r["message_id"] == message_id_for(a, 901)), {})
    seen = f"{row.get('status')}/{row.get('reason_code')}"
    if args.dry_check:
        # The canned extraction prints CONFLICT_TIN, so the outcome is decidable.
        report.check(
            "a document whose TIN belongs to another BU is parked", "failed/tax_id_mismatch", seen
        )
    else:
        # With a real document we do not know which TIN it prints, so this is reported
        # rather than asserted — a pass would be luck and a fail would be noise.
        print(f"  tax-ID gate: {seen} (conclusive only if the document prints {CONFLICT_TIN})")


# ── Lane B: what happens if documents are processed at the same time ──────────


async def fire_level(
    bus: list[BU], documents: list[tuple[str, bytes]], level: int, offset: int = 0
) -> tuple[list[float], dict[str, int], float]:
    """`level` documents through `_process_attachment` at once. (latencies, errors, wall).

    Documents and BUs are dealt round-robin, so at every level above 1 the concurrent set
    spans several tenants — which is the point: a ContextVar that leaked would show up as
    a row filed under the wrong one, and the caller checks exactly that afterwards.
    """
    from app.services import email_ingest_service as ingest

    latencies: list[float] = []
    errors: dict[str, int] = {}

    async def one(slot: int) -> None:
        # BU cycles fastest so any two documents in flight belong to different tenants;
        # the document only advances once every BU has had this one. That keeps
        # (tenant, doc_no) pairs unique for as long as `level <= bus × documents` —
        # past that the extras land as `duplicate_document`, which still costs a real
        # vision call and is still a valid latency sample, just not a full post.
        n = offset + slot
        bu = bus[n % len(bus)]
        name, blob = documents[(n // len(bus)) % len(documents)]
        t0 = time.perf_counter()
        try:
            await ingest._process_attachment(
                tenant_id=bu.tenant_id,
                message_id=f"<lt-{RUN}-c{level}-{slot}@loadtest.local>",
                sender="no-reply@bank.example.com",
                people="no-reply@bank.example.com",
                filename=name,
                blob=blob,
                owner_emails=[],
                rules=bu.rules,
                passwords=[],
                carmen_token="loadtest",
                carmen_uri=bu.uri,
            )
        except Exception as exc:  # noqa: BLE001 — the shape of the failure IS the result
            key = type(exc).__name__
            errors[key] = errors.get(key, 0) + 1
        latencies.append(time.perf_counter() - t0)

    t0 = time.perf_counter()
    await asyncio.gather(*[one(i) for i in range(level)])
    return latencies, errors, time.perf_counter() - t0


async def mode_concurrent(args) -> bool:
    """`_process_attachment` in parallel, IMAP skipped entirely.

    Production is serial, so this measures a shape we do not ship — deliberately. It
    answers what the ceiling would be if the poll were parallelised, which of LLM pool or
    DB pool (5+5) hits first, and whether the ContextVars survive it. `asyncio.gather`
    gives each task its own copy of the context, so in theory they do; this is the proof.
    """
    documents = load_documents(args.docs, args.docs_dir)
    levels = [int(x) for x in args.levels.split(",") if x.strip()]
    print(f"# Concurrency probe — levels {levels}\n")
    print(f"run={RUN}  documents={[n for n, _ in documents]}  carmen=DRY RUN")
    print(f"llm={'CANNED (--dry-check)' if args.dry_check else 'REAL'}\n")

    started = (await sql("select now() as t"))[0]["t"]
    rec = DryRun()
    bus: list[BU] = []
    report = Report()
    try:
        budget = sum(levels) + len(levels)
        for i in range(1, args.bus + 1):
            bu = await create_bu(i, allowance=budget)
            await seed_gl(bu)
            bus.append(bu)

        # Levels continue where the previous one stopped, so a document is not re-run
        # against a BU that already posted it until the whole matrix is used up.
        fired = 0
        print("| C | n | ok | err | p50 | p95 | max | docs/min | errors |")
        print("|---|---|---|---|---|---|---|---|---|")
        for level in levels:
            with ExitStack() as stack:
                for p in dry_run_patches(rec, fake_extract=args.dry_check):
                    stack.enter_context(p)
                latencies, errors, wall = await fire_level(bus, documents, level, fired)
            fired += level

            kinds = ", ".join(f"{k}={v}" for k, v in errors.items()) or "—"
            print(
                f"| {level} | {len(latencies)} | {len(latencies) - sum(errors.values())} "
                f"| {sum(errors.values())} | {pct(latencies, 50):.1f}s | {pct(latencies, 95):.1f}s "
                f"| {max(latencies):.1f}s | {level / max(wall, 0.001) * 60:.1f} | {kinds} |"
            )

        rows = [
            dict(r)
            for r in await sql(
                "select d.tenant_id::text as doc_tenant, d.message_id,"
                " t.tenant_id::text as task_tenant, c.tenant_id::text as card_tenant"
                " from email_documents d"
                " left join ocr_tasks t on t.id = d.task_id"
                " left join credit_cards c on c.task_id = d.task_id"
                " where d.message_id like $1",
                f"<lt-{RUN}-c%",
            )
        ]
        print("\n## Attribution under concurrency\n")
        report.check(
            "ocr_tasks on the wrong tenant",
            0,
            sum(1 for r in rows if r["task_tenant"] and r["task_tenant"] != r["doc_tenant"]),
        )
        report.check(
            "credit_cards on the wrong tenant",
            0,
            sum(1 for r in rows if r["card_tenant"] and r["card_tenant"] != r["doc_tenant"]),
        )
        uris = {b.uri for b in bus}
        report.check(
            "JV posted to a host no BU owns", 0, sum(1 for j in rec.jvs if j["uri"] not in uris)
        )
        report.check(
            "JV posted with another BU's host",
            0,
            sum(
                1
                for j in rec.jvs
                if j["uri"] != next((b.uri for b in bus if b.tenant_id == j["tenant"]), None)
            ),
        )

        llm = await llm_rows(started, [b.tenant_id for b in bus])
        print("\n## Tokens and cost\n")
        print(token_table(llm))
    finally:
        print("\n## Cleanup\n")
        await cleanup_tenants([b.tenant_id for b in bus])

    return report.done("concurrency probe")


# ── overlap ───────────────────────────────────────────────────────────────────


async def mode_overlap(args) -> bool:
    """Two polls at once must not both process the batch.

    The real shapes: a second Render replica, or an operator pressing Poll on
    `#/admin/email` while the cron is mid-run.
    """
    from app.services import email_ingest_service as ingest

    documents = load_documents(args.docs, args.docs_dir)
    report = Report()
    box = connect()
    bus: list[BU] = []
    try:
        bu = await create_bu(1, allowance=len(documents))
        await seed_gl(bu)
        bus.append(bu)
        append_all(
            box,
            [build_message(bu, n, b, i) for i, (n, b) in enumerate(documents, start=1)],
        )
        print(f"# Overlap — two polls, {len(documents)} document(s)\n")

        rec = DryRun()
        with ExitStack() as stack:
            for p in dry_run_patches(rec, fake_extract=args.dry_check):
                stack.enter_context(p)
            first = asyncio.create_task(ingest.run_ingest(limit=len(documents) + 5))
            await asyncio.sleep(0.5)  # let the first one take the lock
            second = await ingest.run_ingest(limit=len(documents) + 5)
            summary = await first

        report.check("the second poll declined", {"status": "busy"}, second)
        rows = await ledger_rows()
        report.check("one ledger row per document", len(documents), len(rows))
        report.check(
            "nothing charged twice",
            len(documents),
            sum(int(r["charged_docs"] or 0) for r in rows),
        )
        print(f"\nfirst poll: {summary}")
    finally:
        print("\n## Cleanup\n")
        try:
            print(f"- mailbox: {purge_folder(box)} fixture(s) expunged from {FOLDER}")
        finally:
            box.logout()
        await cleanup_tenants([b.tenant_id for b in bus])
    return report.done("overlap")


# ── cleanup ───────────────────────────────────────────────────────────────────

# FK order, children first. `llm_usage_logs` and `performance_logs` carry tenant_id as a
# plain VARCHAR with no FK, so they are matched on the text value instead.
_CLEANUP = [
    "delete from email_documents where tenant_id = any($1::uuid[])",
    "delete from credit_cards where tenant_id = any($1::uuid[])",
    "delete from ocr_tasks where tenant_id = any($1::uuid[])",
    "delete from bu_accounting_mapping_entries where config_id in"
    " (select id from bu_accounting_configs where tenant_id = any($1::uuid[]))",
    "delete from bu_accounting_configs where tenant_id = any($1::uuid[])",
    "delete from email_ingest_settings where tenant_id = any($1::uuid[])",
    "delete from credit_ledger where tenant_id = any($1::uuid[])",
    "delete from tenant_credits where tenant_id = any($1::uuid[])",
    "delete from tenant_subscriptions where tenant_id = any($1::uuid[])",
    "delete from tenant_modules where tenant_id = any($1::uuid[])",
    "delete from user_notifications where tenant_id = any($1::uuid[])",
    "delete from ocr_sessions where tenant_id = any($1::uuid[])",
    "delete from tenants where id = any($1::uuid[])",
]


async def cleanup_tenants(tenant_ids: list[str]) -> None:
    if not tenant_ids:
        return
    await sql(
        "delete from llm_usage_logs where tenant_id = any($1::text[])",
        [str(t) for t in tenant_ids],
    )
    for stmt in _CLEANUP:
        try:
            await sql(stmt, tenant_ids)
        except Exception as exc:  # noqa: BLE001 — a table that does not exist is not a failure
            print(f"  (skipped: {exc})")
    print(f"- database: {len(tenant_ids)} scratch tenant(s) removed")


async def mode_cleanup(args) -> bool:
    """Sweep every scratch tenant a previous run left behind, whatever its RUN stamp."""
    rows = await sql(
        "select id::text as id from tenants where host like $1", f"{HOST_PREFIX}%{HOST_SUFFIX}"
    )
    ids = [r["id"] for r in rows]
    if not ids:
        print("cleanup: no loadtest tenants found")
        return True
    await cleanup_tenants(ids)
    box = connect()
    try:
        deleted = 0
        for uid in (
            box.search(None, "HEADER", "Message-ID", "@loadtest.local")[1][0] or b""
        ).split():
            box.store(uid, "+FLAGS", "\\Deleted")
            deleted += 1
        if deleted:
            box.expunge()
        print(f"- mailbox: {deleted} fixture(s) expunged from {FOLDER}")
    finally:
        box.logout()
    return True


# ── entry ─────────────────────────────────────────────────────────────────────


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--mode", choices=["batch", "concurrent", "overlap", "cleanup"], default="batch"
    )
    ap.add_argument("--bus", type=int, default=5, help="how many scratch BUs")
    ap.add_argument(
        "--docs", type=int, default=None, help="cap on documents read from example_field"
    )
    ap.add_argument(
        "--docs-dir",
        default=None,
        help="read documents from here instead of backend/example_field (smoke tests)",
    )
    ap.add_argument("--levels", default="1,2,4,8", help="concurrency levels for --mode concurrent")
    ap.add_argument(
        "--dry-check",
        action="store_true",
        help="canned extraction instead of a real LLM call — proves the harness for free",
    )
    ap.add_argument("--gates", action="store_true", help="also run the duplicate / tax-ID gates")
    args = ap.parse_args()

    guard()
    runner = {
        "batch": mode_batch,
        "concurrent": mode_concurrent,
        "overlap": mode_overlap,
        "cleanup": mode_cleanup,
    }[args.mode]
    return 0 if await runner(args) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
