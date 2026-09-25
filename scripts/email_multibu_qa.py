r"""Email Automation — multi-BU QA across one shared mailbox label. Real mail, real LLM,
real dev Carmen for two BUs, dry-run for four scratch ones. Everything is read back from
the database, never from a summary a phase prints — the property under test is "one BU's
document can never land in another's ledger, task, LLM log, mapping or JV", and the only
way to disprove that honestly is to look at the rows.

    python scripts/email_multibu_qa.py preflight
    python scripts/email_multibu_qa.py setup
    python scripts/email_multibu_qa.py send --wave 1
    python scripts/email_multibu_qa.py poll
    python scripts/email_multibu_qa.py verify
    python scripts/email_multibu_qa.py probes
    python scripts/email_multibu_qa.py report
    python scripts/email_multibu_qa.py teardown

Re-test of the 2026-09-24 fixes (F-1, F-3, F-6, DEF-1/DEF-2), with a fresh state file:

    preflight -> fixcheck-setup -> send --wave fixcheck -> poll -> fixcheck -> teardown

Every phase is a separate process (state persists to a JSON file between phases — see
`--state`). Two real BUs (`dev.carmen4.com/carmen`, `/carmencloud`) already exist and
already have other people's rows in their queues; every fixture this script creates or
sends carries the run's tag in its filename/subject (`[QA-<run>]`) so teardown can find
and remove only its own rows, and so a human glancing at either queue mid-run knows which
rows are real.

Safety:
  - refuses to run if DATABASE_URL points at the production project
  - the mailbox poll is `run_ingest()` itself, called in-process — no HTTP hop, no
    separate worker, so a crash mid-phase leaves the mailbox in the same "unread until a
    verdict exists" state production relies on
  - Carmen calls are dispatched through a thin wrapper: a scratch BU's `.invalid` host
    returns canned data and is recorded; `carmen`/`carmencloud`'s real host is called for
    real and is *also* recorded — every call's (tenant, uri, token fingerprint) is logged
    so a cross-BU credential leak shows up as a table, not a hope
  - `foreign_tax_id` is never patched — the tax-ID gate runs unmodified in every case
"""

from __future__ import annotations

import argparse
import asyncio
import email.utils
import hashlib
import imaplib
import json
import os
import smtplib
import sys
import time
import uuid
from contextlib import ExitStack
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any
from unittest.mock import patch

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))

PROD_PROJECT_REF = "lhlncsjqxttcdegkqvid"

DOCS_DIR = Path(
    os.environ.get(
        "QA_DOCS_DIR",
        r"C:\Users\User\AppData\Local\Temp\claude\c--Users-User-Desktop-OCR"
        r"\43cf8c04-1b47-4a4c-9350-f501c94209d7\scratchpad\qa_docs",
    )
)
STATE_FILE = Path(
    os.environ.get(
        "QA_STATE_FILE",
        r"C:\Users\User\AppData\Local\Temp\claude\c--Users-User-Desktop-OCR"
        r"\43cf8c04-1b47-4a4c-9350-f501c94209d7\scratchpad\qa_state.json",
    )
)

# RUN must be identical across every phase's own process (send tags a message, verify and
# teardown must find it later) — so it is fixed the moment a state file first exists, not
# recomputed from the clock on every invocation. Only a fresh run (no state file yet, or
# an explicit QA_RUN override) gets a new one.
if os.environ.get("QA_RUN"):
    RUN = os.environ["QA_RUN"].strip()
elif STATE_FILE.exists():
    RUN = json.loads(STATE_FILE.read_text()).get("run") or datetime.now(UTC).strftime(
        "%m%d%H%M%S"
    )
else:
    RUN = datetime.now(UTC).strftime("%m%d%H%M%S")
TAG_MARK = f"QA-{RUN}"  # in every fabricated Subject/filename — the cleanup key

BARE = os.environ.get("EMAIL_INGEST_ADDRESS", "")  # aragent@carmensoftware.com
USER, _, DOMAIN = BARE.partition("@")
DSN = os.environ.get("DATABASE_URL", "").replace(":5432/", ":6543/")
IMAP_FOLDER = os.environ.get("IMAP_FOLDER", "AR Agent")  # the REAL production label

HOST_PREFIX = "qa-"
HOST_SUFFIX = ".invalid"  # dispatcher recognises this and never calls real Carmen

# ── the real documents and who owns them (read off the images by hand — see the plan) ──
# Kimberly Co., Ltd. — already `carmen`'s own registered tax_id.
KIMBERLY_TIN = "0105555181506"
# Real merchants none of the pre-existing BUs have registered.
S3_TIN = "0835553001610"  # น.ปุระฉกาการ จก (KBANK.pdf)
S4_TIN = "0105556117534"  # Royal Phuket Residence Co., Ltd. (KTC.pdf, PAYPAL.pdf)
S5_TIN = "0835559008641"  # Sea Sun and Smile Co., Ltd. (GHL.pdf, SIAMPAY.pdf)
UNOWNED_TIN = "0105535161895"  # Baan Samui Resort Co., Ltd. (BAY.pdf) — nobody's


# ── db ───────────────────────────────────────────────────────────────────────


async def sql(query: str, *args):
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        if query.lstrip().lower().startswith("select"):
            return await conn.fetch(query, *args)
        return await conn.execute(query, *args)
    finally:
        await conn.close()


def guard() -> None:
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


# ── state ────────────────────────────────────────────────────────────────────


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"run": RUN, "bus": {}, "messages": [], "polls": [], "dispatcher": []}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))


# ── phase: preflight (read-only) ────────────────────────────────────────────


async def phase_preflight(_args) -> None:
    guard()
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    out: dict[str, Any] = {}
    try:
        row = await conn.fetchrow(
            "select version from supabase_migrations.schema_migrations"
            " where version = '20260924000000'"
        )
        out["migration_ok"] = row is not None
        # DEF-1's claim column — applied to dev by hand, so not in schema_migrations.
        out["posting_claim_column"] = bool(
            await conn.fetchval(
                "select 1 from information_schema.columns where table_name='email_documents'"
                " and column_name='posting_started_at'"
            )
        )
        cron = await conn.fetch(
            "select jobname, active from cron.job where jobname like 'email%' order by 1"
        )
        out["cron"] = {r["jobname"]: r["active"] for r in cron}
        for host, bu, key in [
            ("dev.carmen4.com", "carmen", "carmen"),
            ("dev.carmen4.com", "carmencloud", "carmencloud"),
        ]:
            t = await conn.fetchrow(
                "select id::text as id from tenants where host=$1 and bu_code=$2",
                host,
                bu,
            )
            if t is None:
                print(f"[abort] tenant {host}/{bu} not found")
                sys.exit(2)
            settings_row = await conn.fetchrow(
                "select ingest_tag, enabled, auto_post, tax_ids, rules, owner_emails,"
                " carmen_uri, carmen_token_fp, carmen_token_verified_at,"
                " (carmen_token_enc is not null) as has_token"
                " from email_ingest_settings where tenant_id=$1::uuid",
                t["id"],
            )
            out[key] = {"tenant_id": t["id"], "settings": dict(settings_row)}
        print(json.dumps(out, indent=2, default=str))
        if not out["migration_ok"]:
            print(
                "\n[BLOCKER] migration 20260924000000 not applied to dev — needs `supabase db push` before continuing"
            )
        state = load_state()
        state["preflight"] = out
        state["bus"]["carmen"] = {
            "role": "R1",
            "tenant_id": out["carmen"]["tenant_id"],
            "host": "dev.carmen4.com",
            "bu": "carmen",
            "tag": out["carmen"]["settings"]["ingest_tag"],
            "real": True,
        }
        state["bus"]["carmencloud"] = {
            "role": "R2",
            "tenant_id": out["carmencloud"]["tenant_id"],
            "host": "dev.carmen4.com",
            "bu": "carmencloud",
            "tag": out["carmencloud"]["settings"]["ingest_tag"],
            "real": True,
        }
        state["snapshot"] = {
            "carmen": dict(out["carmen"]["settings"]),
            "carmencloud": dict(out["carmencloud"]["settings"]),
        }
        save_state(state)
    finally:
        await conn.close()


# ── phase: setup ─────────────────────────────────────────────────────────────


SCRATCH_SPECS = [
    {
        "code": "S3",
        "role": "S3",
        "enabled": True,
        "auto_post": True,
        "tax_ids": [S3_TIN],
        "rules": [
            {
                "bank_code": "KBANK",
                "bank_sender_email": None,
                "filename_patterns": ["KBANK"],
                "is_active": True,
                "pdf_password_enc": None,
            },
            {
                "bank_code": "BAY",
                "bank_sender_email": None,
                "filename_patterns": ["BAY"],
                "is_active": False,
                "pdf_password_enc": None,
            },
            {
                "bank_code": "SIAMPAY",
                "bank_sender_email": None,
                "filename_patterns": ["SIAMPAY"],
                "is_active": True,
                "pdf_password_enc": None,
            },
        ],
    },
    {
        "code": "S4",
        "role": "S4",
        "enabled": True,
        "auto_post": False,
        "tax_ids": [S4_TIN],
        "rules": [
            {
                "bank_code": "GHL",
                "bank_sender_email": None,
                "filename_patterns": ["GHL"],
                "is_active": True,
                "pdf_password_enc": None,
            },
            {
                "bank_code": "PAYPAL",
                "bank_sender_email": None,
                "filename_patterns": ["PAYPAL"],
                "is_active": True,
                "pdf_password_enc": None,
            },
            {
                "bank_code": "KTC",
                "bank_sender_email": None,
                "filename_patterns": ["KTC"],
                "is_active": True,
                "pdf_password_enc": None,
            },
        ],
    },
    {
        "code": "S5",
        "role": "S5",
        "enabled": True,
        "auto_post": False,
        "tax_ids": [S5_TIN],
        "owner_emails": ["accounting@s5-example.local"],
        "rules": [
            {
                "bank_code": None,
                "bank_sender_email": None,
                "filename_patterns": [".pdf"],
                "is_active": True,
                "pdf_password_enc": None,
            },
        ],
    },
    {
        "code": "S6",
        "role": "S6",
        "enabled": True,
        "auto_post": False,
        "tax_ids": [],
        "rules": [
            {
                "bank_code": None,
                "bank_sender_email": None,
                "filename_patterns": [".pdf"],
                "is_active": True,
                "pdf_password_enc": None,
            },
        ],
    },
]


async def phase_setup(_args) -> None:
    guard()
    state = load_state()
    if "carmen" not in state["bus"]:
        print("[abort] run `preflight` first")
        sys.exit(2)

    await _create_scratch(state, SCRATCH_SPECS)
    save_state(state)

    # carmen (R1): temporary subscription so it is entitled for the run. Remembered by
    # its own id so teardown deletes exactly this row and nothing that predates it.
    carmen_id = state["bus"]["carmen"]["tenant_id"]
    existing = await sql(
        "select id::text as id from tenant_subscriptions where tenant_id=$1::uuid"
        " and status='active'",
        carmen_id,
    )
    if existing:
        print(
            f"  carmen already has an active subscription ({existing[0]['id']}) — leaving it"
        )
        state["carmen_temp_subscription_id"] = None
    else:
        pack = await sql(
            "select code from credit_packs where kind='subscription' and is_active"
            " order by sort_order limit 1"
        )
        sub_id = str(uuid.uuid4())
        await sql(
            "insert into tenant_subscriptions (id, tenant_id, plan_code, doc_allowance,"
            " docs_used, period_start, period_end, billing_period, cycle_start, status)"
            " values ($1::uuid, $2::uuid, $3, 10, 0, now() - interval '1 hour',"
            " now() + interval '7 days', 'monthly', now() - interval '1 hour', 'active')",
            sub_id,
            carmen_id,
            pack[0]["code"],
        )
        state["carmen_temp_subscription_id"] = sub_id
        print(
            f"  granted carmen a temporary subscription {sub_id} (revert in teardown)"
        )
    save_state(state)

    # carmencloud (R2): auto_post -> true, everything else resent unchanged from the
    # snapshot so nothing this script does not own gets reset.
    await _toggle_carmencloud_auto_post(state, True)
    state["carmencloud_auto_post_toggled"] = True
    save_state(state)

    # pause both cron jobs — the pooled app role has no UPDATE on cron.job directly
    # (InsufficientPrivilegeError), but cron.alter_job() is SECURITY DEFINER and granted.
    await sql(
        "select cron.alter_job(jobid, active:=false) from cron.job"
        " where jobname in ('email-ingest','email-confirm')"
    )
    print("  paused cron: email-ingest, email-confirm")

    save_state(state)
    print(f"\nsetup complete. state file: {STATE_FILE}")


async def _create_scratch(state: dict, scratch: list[dict]) -> None:
    """Insert scratch BUs (tenant, subscription, credits, email settings) into `state`."""
    from app.auth.session import encrypt_carmen_token
    from app.config import settings as app_settings

    for spec in scratch:
        tenant_id = str(uuid.uuid4())
        host = f"{HOST_PREFIX}{RUN}-{spec['code'].lower()}{HOST_SUFFIX}"
        tag = f"qa{spec['code'].lower()}{uuid.uuid4().hex[:6]}"
        await sql(
            "insert into tenants (id, host, bu_code, name, plan, is_active)"
            " values ($1::uuid, $2, $3, $4, 'free', true)",
            tenant_id,
            host,
            spec["code"],
            f"qa/{spec['code']}/{RUN}",
        )
        # Allowance generous — this run's job is correctness, not exhausting a pool by
        # accident. E-06 (out of credits) gets its own tiny top-up later, deliberately.
        pack = await sql(
            "select code from credit_packs where kind='subscription' and is_active"
            " order by sort_order limit 1"
        )
        await sql(
            "insert into tenant_subscriptions (id, tenant_id, plan_code, doc_allowance,"
            " docs_used, period_start, period_end, billing_period, cycle_start, status)"
            " values ($1::uuid, $2::uuid, $3, 30, 0, now() - interval '1 hour',"
            " now() + interval '30 days', 'monthly', now() - interval '1 hour', 'active')",
            str(uuid.uuid4()),
            tenant_id,
            pack[0]["code"],
        )
        await sql(
            "insert into tenant_credits (tenant_id, balance) values ($1::uuid, 0)"
            " on conflict (tenant_id) do update set balance=0",
            tenant_id,
        )
        await sql(
            "insert into email_ingest_settings (tenant_id, ingest_tag, enabled, enabled_at,"
            " auto_post, owner_emails, tax_ids, rules, carmen_token_enc, carmen_uri,"
            " carmen_token_fp)"
            " values ($1::uuid, $2, $3, now(), $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10)",
            tenant_id,
            tag,
            spec["enabled"],
            spec["auto_post"],
            json.dumps(spec.get("owner_emails", [])),
            json.dumps(spec["tax_ids"]),
            json.dumps(spec["rules"]),
            encrypt_carmen_token(
                f"qa-{RUN}-{spec['code']}|{uuid.uuid4()}",
                app_settings.session_encryption_key,
            ),
            f"https://{host}",
            f"qa{spec['code'].lower():0>6}"[:16],
        )
        state["bus"][spec["code"]] = {
            "role": spec["role"],
            "tenant_id": tenant_id,
            "host": host,
            "bu": spec["code"],
            "tag": tag,
            "real": False,
            "auto_post": spec["auto_post"],
            "tax_ids": spec["tax_ids"],
        }
        print(f"  created {spec['code']}  tenant={tenant_id}  tag={tag}  host={host}")


async def _toggle_carmencloud_auto_post(state: dict, value: bool) -> None:
    from app.database import async_session
    from app.models.identity import Tenant
    from app.models.schemas.email_automation import RuleIn, SettingsIn
    from app.services.email_automation import ingest_settings as es

    snap = state["snapshot"]["carmencloud"]
    rules = [
        RuleIn(
            bank_code=r.get("bank_code"),
            bank_sender_email=r.get("bank_sender_email"),
            filename_patterns=r.get("filename_patterns") or [],
            pdf_password=None,  # omit -> keep whatever is stored
            is_active=r.get("is_active", True),
        )
        for r in (
            json.loads(snap["rules"])
            if isinstance(snap["rules"], str)
            else snap["rules"]
        )
    ]
    payload = SettingsIn(
        uri="https://dev.carmen4.com",
        bu="carmencloud",
        enabled=bool(snap["enabled"]),
        owner_emails=[],
        tax_ids=json.loads(snap["tax_ids"])
        if isinstance(snap["tax_ids"], str)
        else snap["tax_ids"],
        rules=rules,
        auto_post=value,
    )
    async with async_session() as db:
        tenant = await db.get(
            Tenant, uuid.UUID(state["bus"]["carmencloud"]["tenant_id"])
        )
        await es.save_settings(db, tenant, payload)
        await db.commit()
    print(f"  carmencloud auto_post -> {value}")


# ── documents & messages ─────────────────────────────────────────────────────


@dataclass
class MsgSpec:
    id: str  # short case id, e.g. "R-01a"
    bu_code: str  # which BU's tag this is addressed to
    filename: str  # attachment filename as the pipeline sees it
    source_pdf: str  # file under DOCS_DIR
    subject: str
    expect_status: str  # email_documents.status this attachment should end at
    expect_reason: str | None = None  # reason_code, or None if not applicable
    # Extra Delivered-To lines, added AFTER the genuine one (i.e. positioned as an
    # attacker's own headers would be: buried beneath the real relay's, never above it —
    # a sender cannot make their own header look like it was stamped by an earlier hop).
    forged_delivered_to: list[str] | None = None
    to_addr: str | None = (
        None  # override the envelope/routing address (bare, unknown tag, …)
    )
    to_header: str | None = (
        None  # override only the visible To: header, routing unaffected
    )
    from_addr: str = "no-reply@bank.example.com"
    encrypted_as: str | None = (
        None  # use this file instead (password-protected variant)
    )
    note: str = ""
    plan_ids: list[str] = field(default_factory=list)  # which plan test IDs this covers
    # Appended already read, as if a person had opened it in Gmail before the poll ran --
    # the exact F-1 trigger. Under the old UNSEEN queue such mail was never looked at.
    seen: bool = False


def _addr(tag: str) -> str:
    return f"{USER}+{tag}@{DOMAIN}"


def _bytes(name: str) -> bytes:
    return (DOCS_DIR / name).read_bytes()


def build_wave1(state: dict) -> list[MsgSpec]:
    b = state["bus"]
    specs: list[MsgSpec] = []

    # R-01/T-xx/D-01: the real happy path for carmen (R1) — its own document, its own rule.
    specs.append(
        MsgSpec(
            "R1-own",
            "carmen",
            f"BBLETAXACQ_{TAG_MARK}.pdf",
            "BBL.pdf",
            f"[{TAG_MARK}] R1 own document",
            "pending_review",
            None,
            plan_ids=["R-01", "Q-03"],
            note="carmen's own TIN (Kimberly); auto_post off -> parks for review, approved later",
        )
    )
    # D-01: redeliver the exact same Message-ID later (built in wave1b, needs same id)

    # R-01/T-01: Kimberly's own document routed to S5, which does not own that TIN.
    specs.append(
        MsgSpec(
            "cross-kimberly-s5",
            "S5",
            f"kimberly_{TAG_MARK}.pdf",
            "SCB.pdf",
            f"[{TAG_MARK}] foreign TIN to S5",
            "pending_review",
            "tax_id_mismatch",
            plan_ids=["T-01", "R-01"],
            note="TIN belongs to carmen; must park under S5, never touch carmen's queue",
        )
    )

    # S3's own document (its registered TIN) — bank rule active (KBANK).
    specs.append(
        MsgSpec(
            "s3-own-kbank",
            "S3",
            f"KBANK_{TAG_MARK}.pdf",
            "KBANK.pdf",
            f"[{TAG_MARK}] S3 own KBANK",
            "posted",
            None,
            plan_ids=["R-01", "E-07", "B-*"],
            note="S3 auto_post on, owns this TIN, KBANK rule active -> should auto-post (dry-run Carmen)",
        )
    )

    # B-01: BAY rule inactive at S3, no catch-all -> no_rule_match, free.
    specs.append(
        MsgSpec(
            "s3-bay-inactive",
            "S3",
            f"BAY_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] S3 inactive BAY rule",
            "skipped",
            "no_rule_match",
            plan_ids=["B-01"],
        )
    )

    # S4's own documents (KTC + PAYPAL, same company/TIN) — first parks (guessed mapping),
    # second should auto-post once GL learned... S4's auto_post is OFF by design (its role
    # is the enable/disable toggle), so both simply park for review.
    specs.append(
        MsgSpec(
            "s4-own-ktc",
            "S4",
            f"KTC_{TAG_MARK}.pdf",
            "KTC.pdf",
            f"[{TAG_MARK}] S4 own KTC",
            "pending_review",
            None,
            plan_ids=["R-01", "B-04"],
        )
    )
    specs.append(
        MsgSpec(
            "s4-own-paypal",
            "S4",
            f"PAYPAL_{TAG_MARK}.pdf",
            "PAYPAL.pdf",
            f"[{TAG_MARK}] S4 own PayPal, same company as KTC",
            "pending_review",
            None,
            plan_ids=["R-01", "D-03-setup"],
        )
    )

    # S5's own documents (GHL + SIAMPAY, same company/TIN).
    specs.append(
        MsgSpec(
            "s5-own-ghl",
            "S5",
            f"GHL_{TAG_MARK}.pdf",
            "GHL.pdf",
            f"[{TAG_MARK}] S5 own GHL",
            "pending_review",
            None,
            plan_ids=["R-01"],
        )
    )
    specs.append(
        MsgSpec(
            "s5-owner-blocked",
            "S5",
            f"SIAMPAY_{TAG_MARK}.pdf",
            "SIAMPAY.pdf",
            f"[{TAG_MARK}] S5 sender not in owner_emails",
            "skipped",
            "sender_not_allowed",
            plan_ids=["S-12", "B-04"],
            from_addr="rando@personal-gmail.example.com",
            note="S5 has owner_emails set; this sender is not in it",
        )
    )

    # carmencloud (R2): auto_post on, sent a document it does NOT own -> must still park,
    # proving auto_post never bypasses the tax-ID gate. Uses S4's own TIN (KTC), so it
    # never touches S4's queue either.
    specs.append(
        MsgSpec(
            "r2-foreign-ktc",
            "carmencloud",
            f"KTC_r2_{TAG_MARK}.pdf",
            "KTC.pdf",
            f"[{TAG_MARK}] R2 auto_post on, foreign TIN",
            "pending_review",
            "tax_id_mismatch",
            plan_ids=["E-07", "T-02"],
        )
    )

    # Unowned-TIN document (BAY / Baan Samui Resort) to S6 — S6 is not entitled yet
    # (package granted later), so this should hold, not fail.
    specs.append(
        MsgSpec(
            "s6-held",
            "S6",
            f"BAY_s6_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] S6 not yet entitled",
            "retry_later",
            None,
            plan_ids=["E-05"],
        )
    )

    # R-05: bare, untagged address.
    specs.append(
        MsgSpec(
            "bare-address",
            "S3",
            f"bare_{TAG_MARK}.pdf",
            "KBANK.pdf",
            f"[{TAG_MARK}] bare address, no tag",
            "unrouted",
            None,
            to_addr=BARE,
            plan_ids=["R-05"],
        )
    )

    # R-06: unknown tag x5 (built separately, see build_unknown_tag_burst)

    # R-08: real doc + a non-document attachment in spirit — handled via multi-attachment
    # helper below (kept as one MsgSpec per attachment; the "free" one uses a filename
    # that matches no rule, exercising the same code path as an image with no rule).
    specs.append(
        MsgSpec(
            "r1-unmatched-attachment",
            "carmen",
            f"logo_{TAG_MARK}.pdf",
            "BBL.pdf",
            f"[{TAG_MARK}] unmatched filename at carmen",
            "skipped",
            "no_rule_match",
            plan_ids=["R-08"],
            note="same bytes as BBL, but filename matches neither of carmen's rules",
        )
    )

    # S-01: forged Delivered-To beneath a genuine one for a different tag — must route to
    # the genuine (topmost/first-matched) tag only.
    specs.append(
        MsgSpec(
            "s1-forged-header",
            "S3",
            f"forged_{TAG_MARK}.pdf",
            "KBANK.pdf",
            f"[{TAG_MARK}] forged second Delivered-To",
            "posted",
            None,
            plan_ids=["S-01"],
            forged_delivered_to=[_addr(b["S4"]["tag"])],
            note="genuine Delivered-To is S3's; a forged S4 header follows it — must stay S3's",
        )
    )

    # S-02: To:/Cc: carries a different BU's tag; only Delivered-To should route.
    specs.append(
        MsgSpec(
            "s2-to-header-ignored",
            "S4",
            f"tohdr_{TAG_MARK}.pdf",
            "GHL.pdf",
            f"[{TAG_MARK}] To/Cc carries a different tag",
            "pending_review",
            None,
            plan_ids=["S-02"],
            note="To: is S3's tag; Delivered-To (the real routing header) is S4's",
        )
    )

    # S-03: Received-for fallback with a domain-suffix trick must NOT route.
    specs.append(
        MsgSpec(
            "s3-domain-suffix-attack",
            "S3",
            f"suffix_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] domain-suffix tag forgery",
            "unrouted",
            None,
            plan_ids=["S-03"],
            to_addr=f"{_addr(state['bus']['S4']['tag'])}.evil.test",
            note="tag regex must not match past the real domain",
        )
    )

    return specs


def build_unknown_tag_burst() -> list[MsgSpec]:
    return [
        MsgSpec(
            f"unknown-{i}",
            "?",
            f"unknown_{i}_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] unknown tag burst {i}",
            "unrouted",
            None,
            to_addr=_addr(f"nosuchtag{i}{uuid.uuid4().hex[:4]}"),
            plan_ids=["R-06"],
        )
        for i in range(5)
    ]


def build_dedupe_wave(
    state: dict, first_message_id: str
) -> tuple[list[MsgSpec], list[str]]:
    """D-01 (exact redelivery) — needs the ORIGINAL Message-ID, passed in."""
    return (
        [
            MsgSpec(
                "d01-redelivery",
                "carmen",
                f"BBLETAXACQ_{TAG_MARK}.pdf",
                "BBL.pdf",
                f"[{TAG_MARK}] redelivery of R1's own document",
                "skipped",
                None,
                plan_ids=["D-01"],
                note="same Message-ID as R1-own -> must be a free no-op",
            )
        ],
        [first_message_id],  # force this exact Message-ID
    )


def build_password_wave(state: dict) -> list[MsgSpec]:
    return [
        MsgSpec(
            "s3-right-password",
            "S3",
            f"KBANKLOCK_{TAG_MARK}.pdf",
            "KBANK_locked.pdf",
            f"[{TAG_MARK}] S3's own password unlocks its own file",
            "posted",
            None,
            plan_ids=["B-07"],
            note="S3's rule password is added in setup_passwords()",
        ),
        MsgSpec(
            "s4-wrong-password",
            "S4",
            f"KBANKLOCK_s4_{TAG_MARK}.pdf",
            "KBANK_locked.pdf",
            f"[{TAG_MARK}] S4 must never try S3's password",
            "skipped",
            "wrong_pdf_password",
            plan_ids=["B-07"],
        ),
    ]


def build_wave3a_s4_disabled(state: dict) -> list[MsgSpec]:
    """E-01: mail sent while S4 is disabled must hold (retry_later, unread, no charge) —
    and, critically, must not affect any OTHER BU's mail in the same poll."""
    return [
        MsgSpec(
            "s4-while-disabled-1",
            "S4",
            f"KTC_off1_{TAG_MARK}.pdf",
            "KTC.pdf",
            f"[{TAG_MARK}] S4 disabled #1",
            "retry_later",
            None,
            plan_ids=["E-01"],
        ),
        MsgSpec(
            "s4-while-disabled-2",
            "S4",
            f"GHL_off2_{TAG_MARK}.pdf",
            "GHL.pdf",
            f"[{TAG_MARK}] S4 disabled #2",
            "retry_later",
            None,
            plan_ids=["E-01"],
        ),
        # Same poll, different BU — must process normally while S4 is held.
        MsgSpec(
            "s3-unaffected-by-s4-off",
            "S3",
            f"KBANK_unaffected_{TAG_MARK}.pdf",
            "KBANK.pdf",
            f"[{TAG_MARK}] S3 must be unaffected by S4 being disabled",
            "posted",
            None,
            plan_ids=["E-01"],
        ),
    ]


def build_wave3b_s4_reenabled(state: dict) -> list[MsgSpec]:
    """E-02: after S4 is re-enabled, the mail that arrived *while it was off* must become
    `skipped/ingest_paused` (never silently posted), while genuinely new mail processes."""
    return [
        MsgSpec(
            # Same two Message-IDs as the disabled-wave sends would be ideal, but a fresh
            # send is simpler and the property under test (arrived_at < enabled_at) holds
            # regardless of Message-ID — what matters is IMAP INTERNALDATE, which a resend
            # right now would place AFTER the new enabled_at. So this reuses the *exact*
            # messages already sitting unread in the mailbox from wave 3a instead of
            # resending — see phase note in the runner.
            "s4-new-after-reenable",
            "S4",
            f"PAYPAL_after_{TAG_MARK}.pdf",
            "PAYPAL.pdf",
            f"[{TAG_MARK}] S4 new mail after re-enable",
            "pending_review",
            None,
            plan_ids=["E-02"],
        ),
    ]


def build_wave_s5_fix(state: dict) -> list[MsgSpec]:
    """S5 has `owner_emails` set (deliberately, for S-12/B-04). Every OTHER S5 case in
    wave 1 used the default sender, which is not in that list, so they were blocked by
    `sender_not_allowed` before ever reaching the checks they were meant to exercise —
    found from this run's actual logs, not predicted in advance. Resent here with an
    allowed sender."""
    allowed = "accounting@s5-example.local"
    return [
        MsgSpec(
            "cross-kimberly-s5-r3",
            "S5",
            f"kimberly_r3_{TAG_MARK}.pdf",
            "SCB.pdf",
            f"[{TAG_MARK}] foreign TIN to S5 (allowed sender)",
            "pending_review",
            "tax_id_mismatch",
            plan_ids=["T-01", "R-01"],
            from_addr=allowed,
        ),
        MsgSpec(
            "s5-own-ghl-r3",
            "S5",
            f"GHL_r3_{TAG_MARK}.pdf",
            "GHL.pdf",
            f"[{TAG_MARK}] S5 own GHL (allowed sender)",
            "pending_review",
            None,
            plan_ids=["R-01"],
            from_addr=allowed,
        ),
    ]


def build_wave3c_s6_reentitled(state: dict) -> list[MsgSpec]:
    return [
        MsgSpec(
            "s6-reentitled",
            "S6",
            f"BAY_reentitled_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] S6 re-entitled -> processes",
            "pending_review",
            None,
            plan_ids=["E-05"],
        ),
    ]


def build_wave_missing7(state: dict) -> list[MsgSpec]:
    """Resend of the 7 wave-1 fixtures that vanished: marked \\Seen with no ledger row and
    no entry in the poll's own outcome summary (15 processed of 22 sent). No overlapping
    poll ran (`job_runs` shows exactly one `email-ingest` execution in that window) and no
    parse-failure warning was logged, so this was not attempted-and-crashed. Isolated here,
    in a smaller batch, to see whether it reproduces.

    Root cause, established after the run (report F-1): not the poller. Something outside it
    marked the mail read, and `SEARCH UNSEEN` was the queue, so read mail dropped out of every
    poll. Fixed on `fix/email-imap-done-flag`: the queue is now the `$OcrDone` keyword, which
    only this system writes, so reading the mailbox no longer loses anything."""
    return [
        MsgSpec(
            "R1-own-r2",
            "carmen",
            f"BBLETAXACQ_r2_{TAG_MARK}.pdf",
            "BBL.pdf",
            f"[{TAG_MARK}] R1 own document (resend)",
            "pending_review",
            None,
            plan_ids=["R-01", "Q-03"],
        ),
        MsgSpec(
            "cross-kimberly-s5-r2",
            "S5",
            f"kimberly_r2_{TAG_MARK}.pdf",
            "SCB.pdf",
            f"[{TAG_MARK}] foreign TIN to S5 (resend)",
            "pending_review",
            "tax_id_mismatch",
            plan_ids=["T-01", "R-01"],
        ),
        MsgSpec(
            "s3-own-kbank-r2",
            "S3",
            f"KBANK_r2_{TAG_MARK}.pdf",
            "KBANK.pdf",
            f"[{TAG_MARK}] S3 own KBANK (resend)",
            "posted",
            None,
            plan_ids=["R-01", "E-07", "B-*"],
        ),
        MsgSpec(
            "s3-bay-inactive-r2",
            "S3",
            f"BAY_r2_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] S3 inactive BAY rule (resend)",
            "skipped",
            "no_rule_match",
            plan_ids=["B-01"],
        ),
        MsgSpec(
            "s4-own-ktc-r2",
            "S4",
            f"KTC_r2b_{TAG_MARK}.pdf",
            "KTC.pdf",
            f"[{TAG_MARK}] S4 own KTC (resend)",
            "pending_review",
            None,
            plan_ids=["R-01", "B-04"],
        ),
        MsgSpec(
            "s4-own-paypal-r2",
            "S4",
            f"PAYPAL_r2_{TAG_MARK}.pdf",
            "PAYPAL.pdf",
            f"[{TAG_MARK}] S4 own PayPal (resend)",
            "pending_review",
            None,
            plan_ids=["R-01", "D-03-setup"],
        ),
        MsgSpec(
            "s5-own-ghl-r2",
            "S5",
            f"GHL_r2_{TAG_MARK}.pdf",
            "GHL.pdf",
            f"[{TAG_MARK}] S5 own GHL (resend)",
            "pending_review",
            None,
            plan_ids=["R-01"],
        ),
    ]


def build_wave2fix(state: dict) -> list[MsgSpec]:
    """Corrected replacements for two wave-1 fixtures found broken while wave 1's poll was
    already in flight (documented in the report, originals left unedited rather than
    silently patched):

    - s1-forged-header (original): `build_message`'s old header order put the FORGED
      Delivered-To first and the genuine one second — the reverse of anything a real
      sender can produce (a forged header can only occupy a position *below* every real
      relay hop's, never above). The result it produced tests "does the first
      Delivered-To win", not "can a forged header hijack routing". Fixed here with the
      realistic order (genuine first, forged appended after).
    - s2-to-header-ignored (original): never actually diverged `To:` from `Delivered-To:`
      (no `to_header` field existed yet), so it exercised nothing beyond an ordinary S4
      message. Fixed here with a real `to_header` override.
    """
    b = state["bus"]
    return [
        MsgSpec(
            # Filename must match one of S3's ACTIVE rule patterns (KBANK/SIAMPAY) or this
            # never gets past no_rule_match regardless of which tag wins routing — the
            # original wave-1 s1/s2 cases had exactly this bug (forged_/tohdr_ matched
            # nothing at S3 or S4), which is why their real outcome was `no_rule_match` and
            # said nothing about S-01/S-02.
            "s1-forged-header-v2",
            "S3",
            f"KBANK_forgedv2_{TAG_MARK}.pdf",
            "KBANK.pdf",
            f"[{TAG_MARK}] forged Delivered-To, realistic position (after the genuine one)",
            "posted",
            None,
            plan_ids=["S-01"],
            forged_delivered_to=[_addr(b["S4"]["tag"])],
            note="genuine S3 header first/topmost (as a real one would be); forged S4 after",
        ),
        MsgSpec(
            "s2-to-header-ignored-v2",
            "S4",
            f"GHL_tohdrv2_{TAG_MARK}.pdf",
            "GHL.pdf",
            f"[{TAG_MARK}] To: really does carry a different tag than Delivered-To:",
            "pending_review",
            None,
            plan_ids=["S-02"],
            to_header=_addr(b["S3"]["tag"]),
            note="To: shows S3's address; Delivered-To (routing_addr, default) is S4's own",
        ),
        MsgSpec(
            # Original (wave 1c) used filename `KBANKLOCK_s4_...` which matches none of
            # S4's rules (GHL/PAYPAL/KTC) -> no_rule_match before the password was ever
            # tried, so it never actually exercised B-07. Fixed to match S4's KTC rule.
            "s4-wrong-password-v2",
            "S4",
            f"KTC_locked_v2_{TAG_MARK}.pdf",
            "KBANK_locked.pdf",
            f"[{TAG_MARK}] S4 must never try S3's password (v2, filename now matches a rule)",
            "skipped",
            "wrong_pdf_password",
            plan_ids=["B-07"],
        ),
        MsgSpec(
            # S6's subscription was (by a setup bug) active from the start, so the original
            # s6-held case never actually tested a hold — it was entitled the whole time.
            # Its subscription has since been expired directly in the DB; this proves the
            # hold for real. E-05's other half (re-entitle -> processes) is proven in wave3.
            "s6-now-expired",
            "S6",
            f"BAY_expired_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] S6 subscription expired -> must hold",
            "retry_later",
            None,
            plan_ids=["E-05"],
        ),
    ]


def build_wave_fixcheck(state: dict) -> list[MsgSpec]:
    """2026-09-25 re-test of the fixes for F-1, F-3 and F-6, live (DEF-1/DEF-2 are driven
    by the `fixcheck` phase against `fx-f1-read`'s row). Needs only S4 and carmencloud."""
    s4 = state["bus"]["S4"]["tag"]
    return [
        MsgSpec(
            "fx-f1-read",
            "S4",
            f"KTC_fx_{TAG_MARK}.pdf",
            "KTC.pdf",
            f"[{TAG_MARK}] F-1 opened by a person before the poll",
            "pending_review",
            None,
            plan_ids=["F-1", "DEF-1", "DEF-2"],
            seen=True,
            note="appended already \\Seen; the $OcrDone queue must still process it",
        ),
        MsgSpec(
            "fx-f3-suffix",
            "S4",
            f"suffix_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] F-3 domain-suffix tag forgery",
            "unrouted",
            None,
            plan_ids=["F-3"],
            to_addr=f"{_addr(s4)}.evil.test",
        ),
        MsgSpec(
            "fx-f3-prefix",
            "S4",
            f"prefix_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] F-3 local-part prefix tag forgery",
            "unrouted",
            None,
            plan_ids=["F-3"],
            to_addr=f"x{_addr(s4)}",
        ),
        MsgSpec(
            "fx-f6-foreign",
            "carmencloud",
            f"KTC_fx6_{TAG_MARK}.pdf",
            "KTC.pdf",
            f"[{TAG_MARK}] F-6 foreign TIN to a BU with a dead token",
            "pending_review",
            "tax_id_mismatch",
            plan_ids=["F-6"],
        ),
    ]


def build_wave_r2_e06(_state: dict) -> list[MsgSpec]:
    """E-06: mail to a BU with nothing left to spend is held, not charged, not lost."""
    return [
        MsgSpec(
            "r2-e06",
            "S6",
            f"BAY_e06_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] E-06 out of credits",
            "retry_later",
            None,
            plan_ids=["E-06"],
        )
    ]


def build_wave_r2_q09(_state: dict) -> list[MsgSpec]:
    """Q-09: mail to a BU with 50 documents awaiting review is held, not charged."""
    return [
        MsgSpec(
            "r2-q09",
            "S6",
            f"BAY_q09_{TAG_MARK}.pdf",
            "BAY.pdf",
            f"[{TAG_MARK}] Q-09 backlog cap",
            "retry_later",
            None,
            plan_ids=["Q-09"],
        )
    ]


def build_wave_r2_jv(_state: dict) -> list[MsgSpec]:
    """A real KBank commission receipt for carmencloud, approved later into real Carmen.
    `KBANK_user.pdf` is the user's own document (041125E00023869), not a shared fixture."""
    return [
        MsgSpec(
            "r2-jv",
            "carmencloud",
            f"KBank_commissions_{TAG_MARK}.pdf",
            "KBANK_user.pdf",
            f"[{TAG_MARK}] real JV into Carmen",
            "pending_review",
            None,
            plan_ids=["R-JV"],
        )
    ]


# ── sending ──────────────────────────────────────────────────────────────────


def build_message(spec: MsgSpec, state: dict, message_id: str | None = None) -> bytes:
    tag = None if spec.bu_code == "?" else state["bus"].get(spec.bu_code, {}).get("tag")
    routing_addr = spec.to_addr or (_addr(tag) if tag else BARE)
    visible_to = spec.to_header or routing_addr

    msg = EmailMessage()
    msg["Message-ID"] = (
        message_id or f"<qa-{RUN}-{spec.id}-{uuid.uuid4().hex[:8]}@qa.local>"
    )
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["From"] = spec.from_addr
    msg["To"] = (
        visible_to  # never read for routing — tag_from_recipients never looks at To:
    )
    msg["Subject"] = spec.subject
    # The genuine Delivered-To is added FIRST/topmost, matching how a real message actually
    # accumulates headers: each relay hop PREPENDS its own, so the final (most trusted) hop's
    # header reads first top-to-bottom. A forged header an attacker put in the message they
    # submitted is necessarily added LATER in this construction — it can only occupy a
    # position *below* every real hop's header, never above it, because a sender cannot make
    # their own content look like it was stamped by a hop that has not happened yet.
    msg["Delivered-To"] = routing_addr
    for forged in spec.forged_delivered_to or []:
        msg["Delivered-To"] = forged
    msg.set_content(f"QA fixture {TAG_MARK} — {spec.note or spec.id}")

    blob = _bytes(spec.encrypted_as or spec.source_pdf)
    msg.add_attachment(
        blob, maintype="application", subtype="pdf", filename=spec.filename
    )
    return msg.as_bytes()


def imap_connect() -> imaplib.IMAP4_SSL:
    box = imaplib.IMAP4_SSL(
        os.environ["IMAP_HOST"], int(os.environ.get("IMAP_PORT", 993))
    )
    box.login(os.environ["IMAP_USER"], os.environ["IMAP_PASSWORD"])
    ok, _ = box.select(f'"{IMAP_FOLDER}"')
    if ok != "OK":
        print(f"[abort] could not open IMAP folder {IMAP_FOLDER!r}")
        sys.exit(2)
    return box


def imap_append(box: imaplib.IMAP4_SSL, raw: bytes, *, seen: bool = False) -> None:
    flags = "(\\Seen)" if seen else ""
    box.append(f'"{IMAP_FOLDER}"', flags, imaplib.Time2Internaldate(time.time()), raw)


def smtp_send(raw: bytes, to_addr: str) -> None:
    user = os.environ["QA_SMTP_USER"]
    pw = os.environ["QA_SMTP_APP_PASSWORD"]
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
        s.login(user, pw)
        s.sendmail(user, [to_addr], raw)


WAVES = {
    "1": lambda state: build_wave1(state) + build_unknown_tag_burst(),
    "1b": None,  # built dynamically (needs message id from wave 1's R1-own)
    "1c": build_password_wave,
    "2fix": build_wave2fix,
    "missing7": build_wave_missing7,
    "3a": build_wave3a_s4_disabled,
    "3b": build_wave3b_s4_reenabled,
    "3c": build_wave3c_s6_reentitled,
    "s5fix": build_wave_s5_fix,
    "fixcheck": build_wave_fixcheck,
    "r2-e06": build_wave_r2_e06,
    "r2-q09": build_wave_r2_q09,
    "r2-jv": build_wave_r2_jv,
}


async def phase_send(args) -> None:
    guard()
    state = load_state()
    box = None if args.smtp_only else imap_connect()
    try:
        if args.wave == "1b":
            r1_msg = next(m for m in state["messages"] if m["id"] == "R1-own")
            specs, forced_ids = build_dedupe_wave(state, r1_msg["message_id"])
        else:
            builder = WAVES[args.wave]
            specs = builder(state)
            forced_ids = [None] * len(specs)

        for spec, forced_id in zip(specs, forced_ids, strict=True):
            message_id = (
                forced_id or f"<qa-{RUN}-{spec.id}-{uuid.uuid4().hex[:8]}@qa.local>"
            )
            raw = build_message(spec, state, message_id)
            if args.smtp_only:
                to_addr = spec.to_addr or _addr(state["bus"][spec.bu_code]["tag"])
                smtp_send(raw, to_addr)
                print(f"  SMTP sent  {spec.id:<28} -> {to_addr}")
            else:
                imap_append(box, raw, seen=spec.seen)
                print(
                    f"  APPEND     {spec.id:<28} -> {spec.bu_code}"
                    + ("  (already \\Seen)" if spec.seen else "")
                )
            state["messages"].append(
                {
                    **asdict(spec),
                    "message_id": message_id,
                    "wave": args.wave,
                }
            )
        save_state(state)
        print(f"\nwave {args.wave}: {len(specs)} message(s) queued in {IMAP_FOLDER!r}")
    finally:
        if box is not None:
            box.logout()


async def phase_set_passwords(_args) -> None:
    """S3's KBANK rule gets a real password so build_password_wave has something to
    prove; done as its own phase since it is a settings edit, not a send."""
    state = load_state()
    tenant_id = state["bus"]["S3"]["tenant_id"]
    rows = await sql(
        "select rules from email_ingest_settings where tenant_id=$1::uuid", tenant_id
    )
    rules = (
        json.loads(rows[0]["rules"])
        if isinstance(rows[0]["rules"], str)
        else rows[0]["rules"]
    )
    # A rule's pdf_password_enc is produced with the same Fernet helper as the Carmen
    # token (`_merge_rule`, email_settings_service.py:586) — no separate PDF-password path.
    from app.auth.session import encrypt_carmen_token
    from app.config import settings as app_settings

    for rule in rules:
        if rule.get("bank_code") == "KBANK":
            rule["pdf_password_enc"] = encrypt_carmen_token(
                "P-S3-secret", app_settings.session_encryption_key
            )
    await sql(
        "update email_ingest_settings set rules=$1::jsonb where tenant_id=$2::uuid",
        json.dumps(rules),
        tenant_id,
    )
    print("  S3 KBANK rule password set to P-S3-secret")


async def phase_toggle(args) -> None:
    """Settings edits that are not a send: E-01/E-02 (S4 email-automation on/off) and
    E-05's other half (S6 re-entitled after the expired-subscription hold was proven)."""
    state = load_state()
    if args.action == "s4-disable":
        await sql(
            "update email_ingest_settings set enabled=false where tenant_id=$1::uuid",
            state["bus"]["S4"]["tenant_id"],
        )
        print("  S4 disabled")
    elif args.action == "s4-enable":
        # Re-enable stamps enabled_at fresh — anything that arrived while off is meant to
        # become `ingest_paused`, never silently replayed as if it were new (§ the
        # `enabled_at` comment in email_ingest_service.py`_process_message`).
        await sql(
            "update email_ingest_settings set enabled=true, enabled_at=now()"
            " where tenant_id=$1::uuid",
            state["bus"]["S4"]["tenant_id"],
        )
        print("  S4 re-enabled (enabled_at reset to now)")
    elif args.action == "s6-reentitle":
        await sql(
            "update tenant_subscriptions set period_end = now() + interval '7 days'"
            " where tenant_id=$1::uuid",
            state["bus"]["S6"]["tenant_id"],
        )
        print("  S6 subscription extended — should process new mail again")
    elif args.action == "s6-exhaust":
        # E-06: still entitled (an active package), but nothing left in it or in credits.
        s6 = state["bus"]["S6"]["tenant_id"]
        await sql(
            "update tenant_subscriptions set docs_used = doc_allowance"
            " where tenant_id=$1::uuid and status='active'",
            s6,
        )
        await sql("update tenant_credits set balance=0 where tenant_id=$1::uuid", s6)
        print("  S6 allowance used up, credit balance 0")
    elif args.action == "s6-restore":
        await sql(
            "update tenant_subscriptions set docs_used = 0"
            " where tenant_id=$1::uuid and status='active'",
            state["bus"]["S6"]["tenant_id"],
        )
        print("  S6 allowance restored")
    elif args.action == "s6-backlog-fill":
        # Q-09: synthetic rows (run-tagged, wiped with S6) up to the cap.
        from app.services.email_automation.ingest import REVIEW_BACKLOG_CAP

        s6 = state["bus"]["S6"]["tenant_id"]
        have = (
            await sql(
                "select count(*) as n from email_documents"
                " where tenant_id=$1::uuid and status='pending_review'",
                s6,
            )
        )[0]["n"]
        need = max(REVIEW_BACKLOG_CAP - have, 0)
        await sql(
            "insert into email_documents (id, tenant_id, message_id, attachment, status)"
            " select gen_random_uuid(), $1::uuid, '<qa-' || $2 || '-backlog-' || g"
            " || '@qa.local>', 'backlog_' || g || '_' || $3 || '.pdf', 'pending_review'"
            " from generate_series(1, $4::int) g",
            s6,
            RUN,
            TAG_MARK,
            need,
        )
        print(f"  S6 backlog: {have} real + {need} synthetic = {have + need} pending")
    elif args.action == "s6-backlog-drain":
        await sql(
            "delete from email_documents where id = (select id from email_documents"
            " where tenant_id=$1::uuid and attachment like 'backlog\\_%' limit 1)",
            state["bus"]["S6"]["tenant_id"],
        )
        print("  S6 backlog: one synthetic row removed (now below the cap)")
    else:
        raise SystemExit(f"unknown toggle action {args.action!r}")


# ── carmen dispatcher (records every call; scratch BUs are dry-run, real BUs are real) ──


@dataclass
class DispatchRecord:
    kind: str
    tenant_id: str | None
    carmen_uri: str | None
    token_fp: str
    doc_no: str | None = None


def dispatch_patches(records: list[DispatchRecord], dry_delay: float = 0.0) -> list:
    from app.context import current_carmen_uri, current_tenant_id
    from app.services.email_automation import ingest

    def _fp(token: str) -> str:
        return hashlib.sha256((token or "").encode()).hexdigest()[:8]

    real_post_gljv = ingest.carmen.post_gljv
    real_post_tax = ingest.carmen.post_input_tax
    real_accounts = ingest.get_account_codes
    real_depts = ingest.get_departments
    real_tax_profiles = ingest.get_tax_profiles

    def _is_dry(uri: str | None) -> bool:
        return bool(uri) and uri.endswith(HOST_SUFFIX)

    async def _gljv(payload, token):
        uri = current_carmen_uri.get()
        records.append(
            DispatchRecord(
                "post_gljv",
                current_tenant_id.get(),
                uri,
                _fp(token),
                payload.get("InvhInvNo") if isinstance(payload, dict) else None,
            )
        )
        if _is_dry(uri):
            # A real Carmen post takes seconds; the delay keeps a racing second approve
            # in flight while the first one is still "posting" (DEF-1).
            await asyncio.sleep(dry_delay)
            return {"Code": 0, "InternalMessage": f"QA-DRY-{len(records)}"}
        return await real_post_gljv(payload, token)

    async def _tax(payload, token):
        uri = current_carmen_uri.get()
        records.append(
            DispatchRecord("post_input_tax", current_tenant_id.get(), uri, _fp(token))
        )
        if _is_dry(uri):
            return {"Code": 0, "InternalMessage": f"QA-DRYTAX-{len(records)}"}
        return await real_post_tax(payload, token)

    async def _accounts(token):
        uri = current_carmen_uri.get()
        if _is_dry(uri):
            return {
                "Data": [
                    {"AccCode": "5100", "Description": "Commission", "Type": "expense"},
                    {"AccCode": "1150", "Description": "Input tax", "Type": "asset"},
                    {"AccCode": "1010", "Description": "Bank", "Type": "asset"},
                    {"AccCode": "1131", "Description": "AR - Visa", "Type": "asset"},
                    {
                        "AccCode": "1132",
                        "Description": "AR - MasterCard",
                        "Type": "asset",
                    },
                ]
            }
        return await real_accounts(token)

    async def _departments(token):
        uri = current_carmen_uri.get()
        if _is_dry(uri):
            return {
                "Data": [
                    {
                        "DeptCode": "GEN",
                        "Description": "General",
                        "DefaultAccount": None,
                    }
                ]
            }
        return await real_depts(token)

    async def _profiles(token):
        uri = current_carmen_uri.get()
        if _is_dry(uri):
            return {
                "Data": [
                    {
                        "Code": "VAT7",
                        "Description": "VAT 7%",
                        "TaxRate": 7,
                        "Active": True,
                    }
                ]
            }
        return await real_tax_profiles(token)

    return [
        patch.object(ingest.carmen, "post_gljv", _gljv),
        patch.object(ingest.carmen, "post_input_tax", _tax),
        patch.object(ingest, "get_account_codes", _accounts),
        patch.object(ingest, "get_departments", _departments),
        patch.object(ingest, "get_tax_profiles", _profiles),
    ]


# ── phase: poll ──────────────────────────────────────────────────────────────


async def phase_poll(args) -> None:
    guard()
    state = load_state()
    from app.config import settings as app_settings
    from app.services.email_automation import ingest

    records: list[DispatchRecord] = []
    total_summary: dict[str, int] = {}
    with ExitStack() as stack:
        for p in dispatch_patches(records):
            stack.enter_context(p)
        stack.enter_context(patch.object(app_settings, "app_debug", False))
        for i in range(args.rounds):
            t0 = time.perf_counter()
            summary = await ingest.run_ingest(limit=args.limit)
            wall = time.perf_counter() - t0
            print(f"  poll {i + 1}/{args.rounds}: {summary}  ({wall:.1f}s)")
            for k, v in summary.items():
                if isinstance(v, int):
                    total_summary[k] = total_summary.get(k, 0) + v
            state["polls"].append(
                {"summary": summary, "wall_s": wall, "at": time.time()}
            )
            if summary.get("status") == "disabled":
                print("[abort] IMAP not configured")
                sys.exit(2)
            if summary.get("messages", 0) == 0 and i > 0:
                break

    state["dispatcher"].extend(asdict(r) for r in records)
    save_state(state)
    print(f"\ntotal: {total_summary}")
    print(f"dispatcher calls recorded this run: {len(records)}")


# ── phase: verify ────────────────────────────────────────────────────────────


async def phase_verify(_args) -> None:
    state = load_state()
    tag_by_tenant = {b["tenant_id"]: code for code, b in state["bus"].items()}

    rows = await sql(
        "select d.message_id, d.attachment, d.status, d.reason_code, d.jv_no,"
        " d.error_message, d.tenant_id::text as doc_tenant, d.task_id::text as task_id,"
        " d.review_payload is not null as has_payload,"
        " t.tenant_id::text as task_tenant, t.charged_docs,"
        " c.tenant_id::text as card_tenant, c.bank_code, c.doc_no,"
        " (c.submitted_at is not null) as submitted"
        " from email_documents d"
        " left join ocr_tasks t on t.id = d.task_id"
        " left join credit_cards c on c.task_id = d.task_id"
        " where d.attachment like $1 order by d.created_at",
        f"%{TAG_MARK}%",
    )
    by_msgid: dict[str, list[dict]] = {}
    for r in rows:
        by_msgid.setdefault(r["message_id"], []).append(dict(r))

    print(
        f"## Verify — {len(state['messages'])} sent, {len(rows)} ledger row(s) found\n"
    )
    fails = []
    cross_bu = []
    for m in state["messages"]:
        got = by_msgid.get(m["message_id"], [])
        expect_bu = m["bu_code"]
        expect_status = m["expect_status"]
        expect_reason = m.get("expect_reason")

        if expect_status in ("unrouted", "retry_later"):
            # Both are designed to leave no email_documents row (retry_later releases its
            # claim so the message can be retried later) — so "no row" is correct here,
            # not a failure. IMPORTANT: this table alone cannot tell "correctly still held,
            # will retry" apart from "silently lost", since both look identical (no row)
            # from here. That distinction needs a separate IMAP check: held mail lacks
            # `$OcrDone` (`\Seen` before fix/email-imap-done-flag — see report F-1).
            ok = len(got) == 0
            note = "no ledger row (correct)" if ok else f"UNEXPECTED ROW: {got}"
            _line(m["id"], ok, note)
            if not ok:
                fails.append(m["id"])
            continue

        if not got:
            _line(
                m["id"],
                False,
                f"expected {expect_status}/{expect_reason} — NO ROW FOUND",
            )
            fails.append(m["id"])
            continue

        row = got[0]
        owner_code = tag_by_tenant.get(row["doc_tenant"], "?UNKNOWN?")
        status_ok = row["status"] == expect_status
        reason_ok = (expect_reason is None) or (row["reason_code"] == expect_reason)
        bu_ok = owner_code == expect_bu
        ok = status_ok and reason_ok and bu_ok
        note = (
            f"tenant={owner_code} status={row['status']}/{row['reason_code']} "
            f"expected {expect_bu}:{expect_status}/{expect_reason}"
        )
        _line(m["id"], ok, note)
        if not ok:
            fails.append(m["id"])
        if not bu_ok:
            cross_bu.append((m["id"], expect_bu, owner_code))
        # cross-checks that must hold regardless of the specific case
        if row["task_tenant"] and row["task_tenant"] != row["doc_tenant"]:
            cross_bu.append((m["id"], "doc_tenant", "task_tenant mismatch"))
        if row["card_tenant"] and row["card_tenant"] != row["doc_tenant"]:
            cross_bu.append((m["id"], "doc_tenant", "card_tenant mismatch"))

    # Ground truth for "did this call use the right BU's credential", not a value
    # reconstructed here: carmen/carmencloud share one host (host,bu is the tenant key), so
    # a URI-only comparison cannot tell their two dispatch streams apart — the token
    # fingerprint is what actually distinguishes them, and it is read straight from the row
    # each tenant owns rather than assumed.
    fp_rows = await sql(
        "select tenant_id::text as tid, carmen_uri, carmen_token_fp"
        " from email_ingest_settings where tenant_id = any($1::uuid[])",
        [state["bus"][c]["tenant_id"] for c in state["bus"]],
    )
    truth = {r["tid"]: (r["carmen_uri"], r["carmen_token_fp"]) for r in fp_rows}

    dispatch_fail = []
    for d in state["dispatcher"]:
        owner_code = tag_by_tenant.get(d["tenant_id"], "?UNKNOWN?")
        want = truth.get(d["tenant_id"])
        if want is None:
            dispatch_fail.append({**d, "problem": "tenant_id not in this run's BU set"})
            continue
        want_uri, want_fp = want
        if d["carmen_uri"] != want_uri:
            dispatch_fail.append({**d, "problem": f"uri should be {want_uri}"})
        elif want_fp and d["token_fp"] != want_fp[:16]:
            dispatch_fail.append(
                {**d, "problem": f"token_fp should start with {want_fp[:16]}"}
            )

    print("\n## Cross-BU leak scan\n")
    print(f"ledger/task/card cross-tenant mismatches: {len(cross_bu)}")
    for c in cross_bu:
        print(f"  LEAK: {c}")
    print(
        f"Carmen dispatcher calls posted to the wrong BU's host: {len(dispatch_fail)}"
    )
    for d in dispatch_fail:
        print(f"  LEAK: {d}")

    print(
        f"\n## Result: {len(fails)} mismatch(es), {len(cross_bu)} cross-BU leak(s), "
        f"{len(dispatch_fail)} dispatch leak(s)"
    )
    state["verify"] = {
        "fails": fails,
        "cross_bu": cross_bu,
        "dispatch_fail": [asdict(DispatchRecord(**d)) for d in dispatch_fail],
    }
    save_state(state)


def _line(case_id: str, ok: bool, note: str) -> None:
    print(f"  {'PASS' if ok else 'FAIL':<4} {case_id:<28} {note}")


# ── phase: teardown ──────────────────────────────────────────────────────────


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


async def phase_teardown(_args) -> None:
    state = load_state()

    # 1. revert carmencloud.auto_post — raw SQL, NOT _toggle_carmencloud_auto_post/
    # save_settings. Found live during this run: `_merge_rule` rebuilds every rule from
    # only the fields `RuleIn` knows about, so a round-trip through `save_settings` silently
    # drops any other key a rule carries — it deleted carmencloud's real KBANK rule's
    # `doc_type: "ar_reconcile"` marker the first time (setup's toggle-on call), which had
    # to be restored by hand. That is a real finding (see the report), but teardown's own
    # job is to touch nothing beyond the one column it changed, so it never goes through
    # that path again. Only if setup toggled it: `fixcheck-setup` never does.
    if state.get("carmencloud_auto_post_toggled"):
        await sql(
            "update email_ingest_settings set auto_post=$1 where tenant_id=$2::uuid",
            bool(state["snapshot"]["carmencloud"]["auto_post"]),
            state["bus"]["carmencloud"]["tenant_id"],
        )
        print("  carmencloud auto_post reverted (raw column update, rules untouched)")

    # 1b. fixcheck's placeholder on carmencloud's verified_at, back to what it was.
    fx = state.get("fixcheck", {})
    if "verified_at_before" in fx:
        before = fx["verified_at_before"]
        await sql(
            "update email_ingest_settings set carmen_token_verified_at=$1"
            " where tenant_id=$2::uuid",
            datetime.fromisoformat(before) if before else None,
            state["bus"]["carmencloud"]["tenant_id"],
        )
        print(f"  carmencloud verified_at restored to {before}")

    # 2. delete carmen's temporary subscription
    sub_id = state.get("carmen_temp_subscription_id")
    if sub_id:
        await sql("delete from tenant_subscriptions where id=$1::uuid", sub_id)
        print(f"  removed carmen's temporary subscription {sub_id}")

    # 3. delete QA-tagged rows for the two real BUs only (scratch BUs are wiped whole below)
    for code in ("carmen", "carmencloud"):
        tid = state["bus"][code]["tenant_id"]
        rows = await sql(
            "select id::text as id, task_id::text as task_id, status, jv_no"
            " from email_documents where tenant_id=$1::uuid and attachment like $2",
            tid,
            f"%{TAG_MARK}%",
        )
        # A document that really posted is kept whole — ledger row, card, task, charge.
        # Its JV is in Carmen's books now; deleting our side would erase the duplicate
        # guard's memory of it and let the same document post a second time.
        real_posted = [
            r
            for r in rows
            if r["status"] == "posted" and not (r["jv_no"] or "").startswith("QA-DRY")
        ]
        for r in real_posted:
            print(
                f"  {code}: KEPT {r['id']} — really posted to Carmen as JV {r['jv_no']}"
            )
        rows = [r for r in rows if r not in real_posted]
        task_ids = [r["task_id"] for r in rows if r["task_id"]]
        ids = [r["id"] for r in rows]
        # email_documents.task_id FKs to ocr_tasks.id — must go first, or deleting
        # ocr_tasks while a QA email_documents row still references it is a
        # ForeignKeyViolationError (hit live: teardown crashed here, leaving cron paused).
        if ids:
            await sql(
                "delete from email_documents where id = any($1::uuid[])",
                [uuid.UUID(i) for i in ids],
            )
        if task_ids:
            # Give back what the run charged this real BU, or its allowance is left short.
            # Subscription only: a charge that fell through to the credit balance (no
            # active subscription) is not refunded here.
            charged = (
                await sql(
                    "select coalesce(sum(charged_docs), 0) as n from ocr_tasks"
                    " where id = any($1::uuid[])",
                    [uuid.UUID(t) for t in task_ids],
                )
            )[0]["n"]
            if charged:
                await sql(
                    "update tenant_subscriptions set docs_used = greatest(docs_used - $2, 0)"
                    " where tenant_id=$1::uuid and status='active'",
                    tid,
                    charged,
                )
                print(f"  {code}: gave back {charged} document(s) to its subscription")
            await sql(
                "delete from credit_cards where task_id = any($1::uuid[])",
                [uuid.UUID(t) for t in task_ids],
            )
            await sql(
                "delete from llm_usage_logs where task_id = any($1::text[])", task_ids
            )
            await sql(
                "delete from ocr_tasks where id = any($1::uuid[])",
                [uuid.UUID(t) for t in task_ids],
            )
        print(f"  {code}: removed {len(ids)} QA-tagged ledger row(s)")

    # 4. scratch tenants — delete everything
    scratch_ids = [
        b["tenant_id"] for code, b in state["bus"].items() if not b.get("real")
    ]
    if scratch_ids:
        await sql(
            "delete from llm_usage_logs where tenant_id = any($1::text[])",
            [str(t) for t in scratch_ids],
        )
        for stmt in _CLEANUP:
            try:
                await sql(stmt, scratch_ids)
            except Exception as exc:  # noqa: BLE001
                print(f"  (skipped: {exc})")
        print(f"  removed {len(scratch_ids)} scratch tenant(s)")

    # 5. purge QA-tagged mail from the real mailbox. SUBJECT, not HEADER Message-ID — Gmail's
    # IMAP HEADER search does not reliably do substring matches (documented already in
    # email_multibu_loadtest.py; confirmed again live here: the Message-ID search found 0
    # of the 39 real QA messages actually sitting in the mailbox on the first teardown
    # attempt). SUBJECT search has been reliable throughout this run.
    box = imap_connect()
    try:
        deleted = 0
        for uid in (box.search(None, "SUBJECT", f'"{TAG_MARK}"')[1][0] or b"").split():
            box.store(uid, "+FLAGS", "\\Deleted")
            deleted += 1
        if deleted:
            box.expunge()
        print(f"  mailbox: {deleted} fixture(s) expunged from {IMAP_FOLDER!r}")
    finally:
        box.logout()

    # 6. resume cron — exactly what was paused (fixcheck records it; setup pauses two)
    jobs = fx.get("cron_paused", ["email-ingest", "email-confirm"])
    await sql(
        "select cron.alter_job(jobid, active:=true) from cron.job"
        " where jobname = any($1::text[])",
        jobs,
    )
    print(f"  resumed cron: {', '.join(jobs)}")

    print("\nteardown complete.")


# ── HTTP identity helper (no live uvicorn needed — same trick tests/tenancy uses) ──


from contextlib import asynccontextmanager as _asynccontextmanager  # noqa: E402


@_asynccontextmanager
async def real_client(
    tenant_id: str, *, bu: str, user: str, carmen_token: str = "", carmen_uri: str = ""
):
    """The real app + real dev DB, with only the session identity faked — same trick
    `tests/tenancy/conftest.py:real_client` uses, but `httpx.AsyncClient` over
    `ASGITransport` instead of Starlette's sync `TestClient`.

    `TestClient` runs its OWN event loop via a blocking portal and fires the app's
    lifespan on every `with` — fine from pytest's sync test functions, broken when called
    repeatedly from code that is itself already running inside an asyncio loop (this
    script's own `asyncio.run(main())`): the first client's lifespan *shutdown* tears down
    the shared DB engine (`app/database.py`'s lazy module-level singleton, alive since
    this process's very first `async_session()` call — nothing here needed the app's
    lifespan for that), and the second `real_client()` call then dies on a closed engine/
    event loop. `ASGITransport` sends no lifespan events at all by default, which is
    exactly right here: the engine is already up from ordinary imports.
    """
    from unittest.mock import AsyncMock, patch

    import httpx

    from app.auth.dependencies import get_current_session
    from app.auth.session import SessionInfo
    from app.main import app

    session = SessionInfo(
        session_id=str(uuid.uuid4()),
        carmen_token=carmen_token,
        carmen_user_id=user,
        username=user,
        tenant_id=str(tenant_id),
        carmen_uri=carmen_uri,
        bu=bu,
    )

    async def _session():
        from app.context import (
            current_carmen_token,
            current_carmen_uri,
            current_carmen_user_id,
            current_ocr_session_id,
            current_tenant_id,
            current_username,
        )

        current_tenant_id.set(session.tenant_id)
        current_carmen_user_id.set(session.carmen_user_id)
        current_username.set(session.username)
        current_ocr_session_id.set(session.session_id)
        current_carmen_token.set(session.carmen_token)
        current_carmen_uri.set(session.carmen_uri)
        return session

    with (
        patch(
            "app.services.shared.pricing_cache.fetch_openrouter_pricing",
            new_callable=AsyncMock,
        ),
        patch("app.lifecycle._perf_flush_loop", new_callable=AsyncMock),
        patch("app.lifecycle.asyncio.sleep", new_callable=AsyncMock),
    ):
        app.dependency_overrides[get_current_session] = _session
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://qa.local"
            ) as client:
                yield client
        finally:
            app.dependency_overrides.clear()


AUTH = {"Authorization": "Bearer qa"}


# ── phase: review (Q-01/Q-02, and R1's one real UI-equivalent approve) ────────


async def phase_review(_args) -> None:
    guard()
    state = load_state()
    b = state["bus"]
    findings: list[str] = []

    print("## Q-01 — each BU sees only its own queue\n")
    for code, bu in b.items():
        async with real_client(bu["tenant_id"], bu=bu["bu"], user=f"qa-{code}") as c:
            docs = (
                await c.get("/api/v1/email/documents?limit=100", headers=AUTH)
            ).json()
            status = (await c.get("/api/v1/email/status", headers=AUTH)).json()
        foreign = [
            d
            for d in docs.get("data", [])
            if TAG_MARK not in d.get("attachment", "")
            and code not in ("carmen", "carmencloud")
        ]
        print(
            f"  {code:<12} documents={docs.get('total')} counts={status.get('counts')}"
        )
        if foreign:
            findings.append(
                f"Q-01 LEAK: {code} sees a row it should not own: {foreign}"
            )

    print("\n## Q-02 — cross-BU document access must be 404\n")
    # Pick one real document id per scratch BU from the DB (whatever wave 1 produced).
    rows = await sql(
        "select tenant_id::text as tid, id::text as id from email_documents"
        " where attachment like $1 and tenant_id = any($2::uuid[]) limit 20",
        f"%{TAG_MARK}%",
        [b[c]["tenant_id"] for c in ("S3", "S4", "S5")],
    )
    by_tenant: dict[str, str] = {}
    for r in rows:
        by_tenant.setdefault(r["tid"], r["id"])
    pairs = [("S3", "S4"), ("S4", "S5"), ("S5", "S3")]
    for owner, other in pairs:
        owner_tid = b[owner]["tenant_id"]
        doc_id = by_tenant.get(owner_tid)
        if not doc_id:
            print(f"  (skip {owner}->{other}: no document found for {owner})")
            continue
        async with real_client(
            b[other]["tenant_id"], bu=b[other]["bu"], user=f"qa-{other}"
        ) as c:
            r_get = await c.get(f"/api/v1/email/documents/{doc_id}", headers=AUTH)
            r_reject = await c.post(
                f"/api/v1/email/documents/{doc_id}/reject",
                headers=AUTH,
                json={"reason": "qa probe"},
            )
        ok = r_get.status_code == 404 and r_reject.status_code == 404
        print(
            f"  {other} accessing {owner}'s doc: GET={r_get.status_code} REJECT={r_reject.status_code}"
            f" {'OK' if ok else 'FAIL'}"
        )
        if not ok:
            findings.append(
                f"Q-02 LEAK: {other} got non-404 on {owner}'s document {doc_id}"
            )
        if "SECRET" in r_get.text or b[owner]["tag"] in r_get.text:
            findings.append(
                f"Q-02 LEAK: {other}'s 404 body still contains {owner}'s data"
            )

    print(
        "\n## Q-03 — one real approve through the real HTTP app (edits a GL account)\n"
    )
    from app.database import async_session
    from app.services.credit_card.accounting_config import get_accounting_config
    from app.services.credit_card.jv import build_jv_rows

    # R1 (carmen) was the intended BU for this — but every real fixture document under its
    # own tax ID (BBL/SCB/SCB2, all "Kimberly Co., Ltd.") already exists in carmen's real,
    # pre-run history (`select status, count(*) from email_documents where tenant_id=...`
    # showed 9 posted / 9 pending_review / 12 rejected before this run touched anything —
    # these are clearly well-worn shared dev fixtures, not fresh documents), so both
    # `R1-own` and its resend correctly landed on `duplicate_document` rather than a clean
    # `pending_review` row to approve. carmencloud's own stored Carmen credential is
    # separately expired (`SecurityToken has Expired`, confirmed live during this run), so
    # it cannot complete a real post either. Falls back to the first clean (non-tax-flagged)
    # pending_review row from ANY BU in this run, real or scratch, and says which.
    r1 = b["carmen"]
    doc = await sql(
        "select id::text as id, tenant_id::text as tid, bank_code, review_payload"
        " from email_documents"
        " where tenant_id=$1::uuid and status='pending_review' and attachment like $2"
        " order by created_at limit 1",
        r1["tenant_id"],
        f"%{TAG_MARK}%",
    )
    used_bu = "carmen"
    if not doc:
        candidates = await sql(
            "select id::text as id, tenant_id::text as tid, bank_code, review_payload"
            " from email_documents"
            " where tenant_id = any($1::uuid[]) and status='pending_review'"
            " and reason_code is null and attachment like $2 order by created_at limit 1",
            [b[c]["tenant_id"] for c in b],
            f"%{TAG_MARK}%",
        )
        tid_to_code = {v["tenant_id"]: k for k, v in b.items()}
        doc = candidates
        if doc:
            used_bu = tid_to_code.get(doc[0]["tid"], "?")
            print(
                f"  (R1/carmen has no clean pending document this run — real fixtures all "
                f"collide with its own pre-existing history, and carmencloud's stored "
                f"Carmen token is expired. Falling back to {used_bu}'s own document; its "
                f"Carmen call is dispatcher-recorded, not sent, since {used_bu} is a "
                f"scratch BU.)"
            )
    if not doc:
        print("  (no clean pending document found anywhere in this run to approve)")
    else:
        r1 = b[used_bu]
        doc_id = doc[0]["id"]
        payload = (
            json.loads(doc[0]["review_payload"])
            if isinstance(doc[0]["review_payload"], str)
            else doc[0]["review_payload"]
        )
        extracted = payload["extracted"]
        bank_code = doc[0]["bank_code"]
        async with async_session() as db:
            from app.models.schemas.ocr import ExtractedDetailRow

            config = await get_accounting_config(db, r1["tenant_id"], bank_code)
        details = [ExtractedDetailRow(**d) for d in extracted.get("details", [])]
        rows = build_jv_rows(details, config.mappings or {})
        if not rows:
            print(
                f"  (no postable rows for {doc_id} — extraction may have found no amounts)"
            )
        else:
            print(
                f"  approving {doc_id} under {used_bu} — {len(rows)} JV row(s), "
                f"first leg: {rows[0]}"
            )
            # The approve HTTP call reaches `ingest.approve_document` -> `post_gljv` on the
            # same shared module `dispatch_patches` already knows how to patch — needed
            # here too, or a scratch BU's `.invalid` host gets a real DNS failure instead
            # of a dry-run (found live: this is exactly what happened before this fix).
            approve_records: list[DispatchRecord] = []
            with ExitStack() as stack:
                for p in dispatch_patches(approve_records):
                    stack.enter_context(p)
                async with real_client(
                    r1["tenant_id"],
                    bu=r1["bu"],
                    user=f"qa-{used_bu}-reviewer",
                ) as c:
                    resp = await c.post(
                        f"/api/v1/email/documents/{doc_id}/approve",
                        headers=AUTH,
                        json={
                            "extracted": extracted,
                            "rows": rows,
                            "post_input_tax": False,
                        },
                    )
            state["dispatcher"].extend(asdict(r) for r in approve_records)
            print(f"  approve -> {resp.status_code} {resp.text[:300]}")
            if resp.status_code == 200:
                state.setdefault("real_jvs", []).append(
                    {
                        "bu": used_bu,
                        "real_carmen": bool(r1.get("real")),
                        "doc_id": doc_id,
                        "jv_no": resp.json().get("jv_no"),
                    }
                )
                save_state(state)
            else:
                findings.append(
                    f"{used_bu} approve failed: {resp.status_code} {resp.text[:300]}"
                )

    print(f"\n## Review phase result: {len(findings)} finding(s)")
    for f in findings:
        print(f"  {f}")
    state["review_findings"] = findings
    save_state(state)


# ── phases: fixcheck-setup / fixcheck (2026-09-25 live re-test of the fixes) ──

# `email-token-health` too: it can clear carmencloud's verified_at by itself, which would
# make F-6's "the token was still flagged" check pass for the wrong reason.
FIXCHECK_CRON = ["email-ingest", "email-confirm", "email-token-health"]


async def phase_fixcheck_setup(_args) -> None:
    """Only what the re-test needs: S4 (dry-run Carmen), a placeholder on carmencloud's
    verified_at that only a real 401 can clear, and the three pollers paused."""
    guard()
    state = load_state()
    if "carmencloud" not in state["bus"]:
        print("[abort] run `preflight` first")
        sys.exit(2)
    if "S4" not in state["bus"]:
        await _create_scratch(state, [s for s in SCRATCH_SPECS if s["code"] == "S4"])
        save_state(state)

    cc = state["bus"]["carmencloud"]["tenant_id"]
    fx = state.setdefault("fixcheck", {})
    if "verified_at_before" not in fx:  # first run only, so a re-run keeps the original
        rows = await sql(
            "select carmen_token_verified_at from email_ingest_settings"
            " where tenant_id=$1::uuid",
            cc,
        )
        fx["verified_at_before"] = rows[0]["carmen_token_verified_at"]
        save_state(state)

    await sql(
        "update email_ingest_settings set carmen_token_verified_at = now()"
        " where tenant_id=$1::uuid",
        cc,
    )
    print(
        f"  carmencloud verified_at: {fx['verified_at_before']} -> now() (placeholder)"
    )
    await _pause_cron(state)
    print(f"\nfixcheck setup complete. state file: {STATE_FILE}")


async def _pause_cron(state: dict) -> None:
    """Pause the pollers, remembering which were active so teardown resumes exactly those.
    Recorded on the first call only, so a re-run cannot mistake its own pause for "off"."""
    fx = state.setdefault("fixcheck", {})
    if "cron_paused" not in fx:
        rows = await sql(
            "select jobname from cron.job where active and jobname = any($1::text[])",
            FIXCHECK_CRON,
        )
        fx["cron_paused"] = [r["jobname"] for r in rows]
        save_state(state)
    await sql(
        "select cron.alter_job(jobid, active:=false) from cron.job"
        " where jobname = any($1::text[])",
        fx["cron_paused"],
    )
    print(f"  paused cron: {', '.join(fx['cron_paused']) or '(none were active)'}")


async def _imap_flags_by_message_id() -> dict[str, str]:
    """This run's fixtures -> their FLAGS, read back from the mailbox by UID."""
    flags: dict[str, str] = {}
    box = imap_connect()
    try:
        uids = (
            box.uid("SEARCH", None, "SUBJECT", f'"{TAG_MARK}"')[1][0] or b""
        ).split()
        for uid in uids:
            _, hdr = box.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")
            _, meta = box.uid("FETCH", uid, "(FLAGS)")
            mid = email.message_from_bytes(hdr[0][1])["Message-ID"]
            flags[(mid or "").strip()] = meta[0].decode()
    finally:
        box.logout()
    return flags


async def phase_fixcheck(_args) -> None:
    """Every verdict read back from rows and mailbox flags after the poll."""
    guard()
    state = load_state()
    b = state["bus"]
    from app.services.email_automation.imap import DONE_FLAG

    msgs = {m["id"]: m for m in state["messages"] if m.get("wave") == "fixcheck"}
    results: dict[str, dict] = {}

    def record(case: str, ok: bool | None, note: str) -> None:
        label = {True: "PASS", False: "FAIL", None: "INCONCLUSIVE"}[ok]
        print(f"  {label:<12} {case:<6} {note}")
        results[case] = {"result": label, "note": note}

    rows = await sql(
        "select id::text as id, tenant_id::text as tid, message_id, status, reason_code,"
        " error_message, task_id::text as task_id from email_documents"
        " where message_id = any($1::text[])",
        [m["message_id"] for m in msgs.values()],
    )
    by_id: dict[str, list[dict]] = {k: [] for k in msgs}
    mid_to_case = {m["message_id"]: k for k, m in msgs.items()}
    for r in rows:
        by_id[mid_to_case[r["message_id"]]].append(dict(r))
    flags = await _imap_flags_by_message_id()

    def done(case: str) -> bool:
        return DONE_FLAG in flags.get(msgs[case]["message_id"], "")

    print("## F-1 — mail a person already opened is still processed\n")
    f1 = by_id["fx-f1-read"]
    record(
        "F-1",
        bool(f1) and f1[0]["tid"] == b["S4"]["tenant_id"] and done("fx-f1-read"),
        f"row={f1[0]['status'] + '/' + str(f1[0]['reason_code']) if f1 else 'NONE'}"
        f" imap={flags.get(msgs['fx-f1-read']['message_id'], 'NOT FOUND')}",
    )

    print("\n## F-3 — lookalike addresses do not route\n")
    unrouted = sum(p["summary"].get("unrouted", 0) for p in state["polls"])
    attacks = ["fx-f3-suffix", "fx-f3-prefix"]
    record(
        "F-3",
        all(not by_id[c] and done(c) for c in attacks) and unrouted >= len(attacks),
        f"rows={[len(by_id[c]) for c in attacks]} done={[done(c) for c in attacks]}"
        f" unrouted_in_polls={unrouted}",
    )

    print("\n## F-6 — a foreign TIN keeps its verdict on a BU with a dead token\n")
    f6 = by_id["fx-f6-foreign"]
    verified = (
        await sql(
            "select carmen_token_verified_at from email_ingest_settings"
            " where tenant_id=$1::uuid",
            b["carmencloud"]["tenant_id"],
        )
    )[0]["carmen_token_verified_at"]
    reason_ok = (
        bool(f6)
        and f6[0]["reason_code"] == "tax_id_mismatch"
        and S4_TIN in (f6[0]["error_message"] or "")
    )
    note = (
        f"row={f6[0]['status'] + '/' + str(f6[0]['reason_code']) if f6 else 'NONE'}"
        f" verified_at={verified}"
    )
    # verified_at back to NULL is the proof the suggester really met Carmen's 401: nothing
    # else clears the placeholder while email-token-health is paused. Right verdict with
    # the placeholder still set means the dead-token path never ran — not a pass.
    if not reason_ok:
        f6_ok = False
    elif verified is None:
        f6_ok = True
    else:
        f6_ok = None
    record("F-6", f6_ok, note)

    print("\n## DEF-1 / DEF-2 — two approves at once through the real router\n")
    doc = await sql(
        "select id::text as id, bank_code, review_payload, task_id::text as task_id"
        " from email_documents where message_id=$1 and status='pending_review'",
        msgs["fx-f1-read"]["message_id"],
    )
    if not doc:
        record("DEF-1", None, "no pending fx-f1-read row to approve")
        record("DEF-2", None, "no pending fx-f1-read row to approve")
    else:
        from app.database import async_session
        from app.models.schemas.ocr import ExtractedDetailRow
        from app.services.credit_card.accounting_config import get_accounting_config
        from app.services.credit_card.jv import build_jv_rows

        doc_id, s4 = doc[0]["id"], b["S4"]
        payload = doc[0]["review_payload"]
        payload = json.loads(payload) if isinstance(payload, str) else payload
        extracted = payload["extracted"]
        async with async_session() as db:
            config = await get_accounting_config(
                db, s4["tenant_id"], doc[0]["bank_code"]
            )
        details = [ExtractedDetailRow(**d) for d in extracted.get("details", [])]
        # What the review screen would show: the BU's rules plus the AI's suggestions.
        jv_rows = build_jv_rows(
            details, {**(config.mappings or {}), **(payload.get("suggested") or {})}
        )
        # DEF-2 probe: the browser-supplied id points at carmencloud's card. Only the
        # ledger row's own task may be stamped.
        foreign_card = None
        if f6 and f6[0]["task_id"]:
            cards = await sql(
                "select id::text as id from credit_cards where task_id=$1::uuid",
                f6[0]["task_id"],
            )
            foreign_card = cards[0]["id"] if cards else None
        body = {
            "extracted": {**extracted, "id": foreign_card or extracted.get("id")},
            "rows": jv_rows,
            "post_input_tax": False,
        }
        url = f"/api/v1/email/documents/{doc_id}/approve"
        records: list[DispatchRecord] = []
        with ExitStack() as stack:
            for p in dispatch_patches(records, dry_delay=2.0):
                stack.enter_context(p)
            async with real_client(
                s4["tenant_id"], bu="S4", user="qa-S4-reviewer"
            ) as c:
                r1, r2 = await asyncio.gather(
                    c.post(url, headers=AUTH, json=body),
                    c.post(url, headers=AUTH, json=body),
                )
        state["dispatcher"].extend(asdict(r) for r in records)
        posts = [r for r in records if r.kind == "post_gljv"]
        after = (
            await sql(
                "select status, posting_started_at from email_documents where id=$1::uuid",
                doc_id,
            )
        )[0]
        codes = sorted([r1.status_code, r2.status_code])
        loser = r1 if r1.status_code != 200 else r2
        record(
            "DEF-1",
            codes == [200, 409]
            and len(posts) == 1
            and after["status"] == "posted"
            and after["posting_started_at"] is None,
            f"http={codes} post_gljv_calls={len(posts)} row={after['status']}"
            f" claim={after['posting_started_at']} 409={loser.text[:120]}",
        )

        own = await sql(
            "select submitted_at from credit_cards where task_id=$1::uuid",
            doc[0]["task_id"],
        )
        other = (
            await sql(
                "select submitted_at from credit_cards where id=$1::uuid", foreign_card
            )
            if foreign_card
            else []
        )
        own_stamped = bool(own) and own[0]["submitted_at"] is not None
        record(
            "DEF-2",
            (own_stamped and other[0]["submitted_at"] is None) if other else None,
            f"own_card_stamped={bool(own) and own[0]['submitted_at'] is not None}"
            f" carmencloud_card_stamped={other[0]['submitted_at'] is not None if other else 'n/a'}",
        )

    state.setdefault("fixcheck", {})["results"] = results
    save_state(state)
    failed = [k for k, v in results.items() if v["result"] != "PASS"]
    print(
        f"\n## fixcheck: {len(results) - len(failed)}/{len(results)} PASS"
        + (f" — not passing: {failed}" if failed else "")
    )


# ── phases: round 2 (real Carmen JV, E-06, Q-09, S-07) ─────────────────────────
#
# Nothing here decrypts, reads or replays a stored credential. The real JV goes through the
# app's own approve path, which uses the BU's credential the way it always does; the
# harness only observes where the post went (tenant + host, from the dispatcher).


async def phase_round2_setup(_args) -> None:
    guard()
    state = load_state()
    if "carmencloud" not in state["bus"]:
        print("[abort] run `preflight` first")
        sys.exit(2)
    if "S6" not in state["bus"]:
        await _create_scratch(state, [s for s in SCRATCH_SPECS if s["code"] == "S6"])
        save_state(state)
    src = Path.home() / "Downloads" / "KBankBank commissions.pdf"
    dst = DOCS_DIR / "KBANK_user.pdf"
    if not dst.exists():
        dst.write_bytes(src.read_bytes())
    print(f"  fixture {dst.name}: {dst.stat().st_size} bytes")
    await _pause_cron(state)
    print(f"\nround 2 setup complete. state file: {STATE_FILE}")


async def phase_r2_token(_args) -> None:
    """Has carmencloud's credential been replaced since preflight? Metadata only: the
    stored fingerprint column and when Carmen last accepted it."""
    guard()
    state = load_state()
    row = (
        await sql(
            "select carmen_token_fp, carmen_token_verified_at from email_ingest_settings"
            " where tenant_id=$1::uuid",
            state["bus"]["carmencloud"]["tenant_id"],
        )
    )[0]
    before = state["snapshot"]["carmencloud"].get("carmen_token_fp")
    changed = row["carmen_token_fp"] != before
    verified = row["carmen_token_verified_at"]
    state.setdefault("round2", {})["carmencloud_token"] = {
        "replaced": changed,
        "verified_at": verified,
    }
    save_state(state)
    print(
        f"  carmencloud credential replaced since preflight: {changed};"
        f" last verified by Carmen: {verified}"
    )


def _r2_record(state: dict, case: str, ok: bool | None, note: str) -> None:
    label = {True: "PASS", False: "FAIL", None: "INCONCLUSIVE"}[ok]
    print(f"  {label:<12} {case:<14} {note}")
    state.setdefault("round2", {}).setdefault("results", {})[case] = {
        "result": label,
        "note": note,
    }


async def phase_r2check(args) -> None:
    """E-06 / Q-09, read back after each poll: held = no row, no charge, not done."""
    guard()
    state = load_state()
    from app.services.email_automation.imap import DONE_FLAG

    s6 = state["bus"]["S6"]["tenant_id"]
    case = {"e06": "r2-e06", "q09": "r2-q09"}[args.stage.split("-")[0]]
    msg = next(m for m in state["messages"] if m["id"] == case)
    rows = await sql(
        "select status, reason_code from email_documents where message_id=$1",
        msg["message_id"],
    )
    tasks = (
        await sql(
            "select count(*) as n from ocr_tasks where tenant_id=$1::uuid",
            s6,
        )
    )[0]["n"]
    used = (
        await sql(
            "select docs_used from tenant_subscriptions"
            " where tenant_id=$1::uuid and status='active'",
            s6,
        )
    )[0]["docs_used"]
    done = DONE_FLAG in (await _imap_flags_by_message_id()).get(msg["message_id"], "")
    held_in_poll = state["polls"][-1]["summary"].get("retry_later", 0)
    note = (
        f"rows={[r['status'] for r in rows]} s6_tasks={tasks} s6_docs_used={used}"
        f" done={done} last_poll_retry_later={held_in_poll}"
    )
    # E-06 runs first (so tasks 0 -> 1); Q-09 finds E-06's one task already there.
    tasks_before = 0 if case == "r2-e06" else 1
    if args.stage.endswith("held"):
        ok = (
            not rows
            and tasks == tasks_before
            and not done
            and held_in_poll >= 1
            and (case == "r2-q09" or used == 30)
        )
    else:
        ok = bool(rows) and done and tasks == tasks_before + 1
    _r2_record(state, args.stage, ok, note)
    save_state(state)


async def phase_approve_real(args) -> None:
    """R-JV: the review screen's approve, through the real router, into real Carmen."""
    guard()
    state = load_state()
    cc = state["bus"]["carmencloud"]
    msg = next(m for m in state["messages"] if m["id"] == "r2-jv")
    doc = await sql(
        "select id::text as id, bank_code, review_payload, task_id::text as task_id,"
        " status, reason_code, doc_no from email_documents where message_id=$1",
        msg["message_id"],
    )
    if not doc or doc[0]["status"] != "pending_review":
        _r2_record(state, "R-JV", None, f"nothing to approve: {[dict(d) for d in doc]}")
        save_state(state)
        return

    from app.database import async_session
    from app.models.schemas.ocr import ExtractedDetailRow
    from app.services.credit_card.accounting_config import get_accounting_config
    from app.services.credit_card.jv import build_jv_rows

    d = doc[0]
    payload = d["review_payload"]
    payload = json.loads(payload) if isinstance(payload, str) else payload
    extracted = payload["extracted"]
    async with async_session() as db:
        config = await get_accounting_config(db, cc["tenant_id"], d["bank_code"])
    details = [ExtractedDetailRow(**x) for x in extracted.get("details", [])]
    # What the reviewer picks in the dialog for anything still unmapped:
    # --map "<payment type>=<dept>:<acc>", applied last, like a hand edit on screen.
    picked = {}
    for item in args.map or []:
        field, _, target = item.partition("=")
        dept, _, acc = target.partition(":")
        picked[field] = {"dept": dept, "acc": acc}
    jv_rows = build_jv_rows(
        details,
        {**(config.mappings or {}), **(payload.get("suggested") or {}), **picked},
    )
    blank = [r for r in jv_rows if not r.get("acc")]
    if blank:
        _r2_record(
            state, "R-JV", None, f"not posted: JV line(s) with no account {blank}"
        )
        save_state(state)
        return
    print(
        f"  approving {d['id']} ({d['bank_code']} {d['doc_no']}, parked reason"
        f" {d['reason_code']}, flags {payload.get('flags')}) — {len(jv_rows)} JV row(s)"
    )
    records: list[DispatchRecord] = []
    with ExitStack() as stack:
        for p in dispatch_patches(records):
            stack.enter_context(p)
        async with real_client(
            cc["tenant_id"], bu="carmencloud", user="qa-carmencloud-reviewer"
        ) as c:
            resp = await c.post(
                f"/api/v1/email/documents/{d['id']}/approve",
                headers=AUTH,
                json={"extracted": extracted, "rows": jv_rows, "post_input_tax": True},
            )
    state["dispatcher"].extend(asdict(r) for r in records)
    after = (
        await sql(
            "select status, jv_no, error_message, posting_started_at"
            " from email_documents where id=$1::uuid",
            d["id"],
        )
    )[0]
    card = await sql(
        "select submitted_at from credit_cards where task_id=$1::uuid", d["task_id"]
    )
    posts = [r for r in records if r.kind == "post_gljv"]
    taxes = [r for r in records if r.kind == "post_input_tax"]
    jv = after["jv_no"] or ""
    ok = (
        resp.status_code == 200
        and after["status"] == "posted"
        and bool(jv)
        and not jv.startswith("QA-DRY")
        and bool(card)
        and card[0]["submitted_at"] is not None
        and len(posts) == 1
        and posts[0].carmen_uri == "https://dev.carmen4.com"
        and posts[0].tenant_id == cc["tenant_id"]
    )
    note = (
        f"http={resp.status_code} jv_no={jv or '-'} row={after['status']}"
        f" card_submitted={bool(card) and card[0]['submitted_at'] is not None}"
        f" posts={len(posts)} posted_as_tenant="
        f"{'carmencloud' if posts and posts[0].tenant_id == cc['tenant_id'] else '?'}"
        f" input_tax_calls={len(taxes)} tax_note={after['error_message']!r}"
        f" extracted_doc_no={d['doc_no']} body={resp.text[:200]}"
    )
    _r2_record(state, "R-JV", ok, note)
    state["round2"]["real_jv"] = {"doc_id": d["id"], "jv_no": jv, "doc_no": d["doc_no"]}
    save_state(state)


async def phase_s07(_args) -> None:
    """Settings-API auth boundaries through the real app, with no real credential: the
    cases a caller holding nothing valid can reach. The ones that need a real BU token or
    a minted admin JWT are left for a run the user explicitly authorises."""
    guard()
    state = load_state()
    import httpx

    from app.main import app

    host = "https://dev.carmen4.com"
    cases: list[tuple[str, str, int | None, str]] = []  # (id, expect, got, detail)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://qa.local"
    ) as c:

        async def get(bu: str, auth: str | None, uri: str = host) -> httpx.Response:
            headers = {"Authorization": auth} if auth is not None else {}
            return await c.get(
                "/api/v1/carmen/settings",
                params={"uri": uri, "bu": bu},
                headers=headers,
            )

        # Shaped like a Carmen token, issued by nobody.
        fake = f"qa{uuid.uuid4().hex}|{uuid.uuid4()}"
        r = await get("carmen", None)
        cases.append(("no-auth", "401", r.status_code, r.text[:80]))
        r = await get("carmen", "not-a-carmen-token")
        cases.append(("malformed", "401", r.status_code, r.text[:80]))
        r = await get("carmen", fake)
        cases.append(("fake-token", "401", r.status_code, r.text[:80]))
        r = await get("carmen", fake)
        cases.append(("fake-token-cached", "401", r.status_code, r.text[:80]))
        r = await get("nope", fake, uri="https://qa-unknown.invalid")
        cases.append(("unknown-bu", "400", r.status_code, r.text[:80]))
        first_429 = None
        for i in range(1, 26):
            r = await get("nope", fake, uri="https://qa-unknown.invalid")
            if r.status_code == 429:
                first_429 = i
                break
        cases.append(
            ("rate-limit", "429", 429 if first_429 else None, f"at call {first_429}")
        )

    print("## S-07 — settings API auth boundaries (real app, no real credential)\n")
    failing = []
    for cid, expect, got, detail in cases:
        ok = str(got) in expect.split("/")
        print(
            f"  {'ok ' if ok else 'BAD'} {cid:<18} expect {expect:<4} got {got}  {detail}"
        )
        if not ok:
            failing.append(cid)
    state.setdefault("round2", {})["s07_cases"] = cases
    _r2_record(
        state,
        "S-07",
        not failing,
        f"{len(cases) - len(failing)}/{len(cases)} as expected"
        + (f"; not: {failing}" if failing else ""),
    )
    save_state(state)


async def phase_s07_creds(_args) -> None:
    """S-07 with real credentials — run only with the owner's explicit authorisation
    (given 2026-09-25, dev only). carmen's stored posting credential is decrypted in
    memory, never printed or saved; any session the login probe creates is deleted before
    this function returns.

    Cross-BU on one host is expected to SUCCEED: `docs/CARMEN_INTEGRATION.md` makes the host
    the ownership boundary ("one host is always one corporate group, a valid token for host X
    may manage any BU under X"). These cases pin that, so a change to it is visible."""
    guard()
    state = load_state()
    import httpx
    from jose import jwt as jose_jwt

    from app.auth.admin_session import create_admin_jwt
    from app.auth.session import decrypt_carmen_token
    from app.config import settings as app_settings
    from app.main import app
    from app.services.admin.auth import get_admin_jwt_secret

    b = state["bus"]
    host = "https://dev.carmen4.com"
    enc = (
        await sql(
            "select carmen_token_enc from email_ingest_settings where tenant_id=$1::uuid",
            b["carmen"]["tenant_id"],
        )
    )[0]["carmen_token_enc"]
    token = decrypt_carmen_token(enc, app_settings.session_encryption_key)
    cases: list[tuple[str, str, int | None, str]] = []

    def admin(perms: list[str], scope: str = "") -> str:
        return "Bearer " + create_admin_jwt(
            "qa-admin",
            "qa-admin",
            [],
            perms,
            get_admin_jwt_secret(),
            tenant_scope=scope,
        )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://qa.local"
    ) as c:

        async def get(bu: str, auth: str) -> httpx.Response:
            return await c.get(
                "/api/v1/carmen/settings",
                params={"uri": host, "bu": bu},
                headers={"Authorization": auth},
            )

        async def login(bu: str) -> tuple[int, str | None]:
            """-> (status, tenant the issued session names). The session is deleted."""
            r = await c.post(
                "/api/v1/auth/exchange", json={"token": token, "bu": bu, "uri": host}
            )
            if r.status_code != 200:
                return r.status_code, None
            claims = jose_jwt.get_unverified_claims(r.json()["access_token"])
            await sql("delete from ocr_sessions where id=$1::uuid", claims["sid"])
            return 200, claims.get("tid")

        r = await get("carmen", token)
        leaked = token in r.text or "carmen_token_enc" in r.text
        cases.append(("own-bu", "200", r.status_code, f"token_in_body={leaked}"))
        r = await get("carmencloud", token)
        cases.append(
            (
                "cross-bu-settings",
                "200",
                r.status_code,
                f"body_is_carmencloud={b['carmencloud']['tag'] in r.text}",
            )
        )
        status, tid = await login("carmen")
        cases.append(
            (
                "own-bu-login",
                "200",
                status,
                f"tid_is_carmen={tid == b['carmen']['tenant_id']}",
            )
        )
        status, tid = await login("carmencloud")
        cases.append(
            (
                "cross-bu-login",
                "200",
                status,
                f"session_for_carmencloud={tid == b['carmencloud']['tenant_id']}",
            )
        )
        r = await get("carmen", admin(["configs:read"]))
        cases.append(("admin-no-write", "403", r.status_code, r.text[:70]))
        scoped = admin(["configs:write"], b["carmen"]["tenant_id"])
        r = await get("carmencloud", scoped)
        cases.append(("admin-scoped-other", "403", r.status_code, r.text[:70]))
        r = await get("carmen", scoped)
        cases.append(("admin-scoped-own", "200", r.status_code, ""))
        r = await get("carmencloud", admin(["configs:write"]))
        cases.append(("admin-global", "200", r.status_code, ""))

    print("## S-07 with real credentials (dev, authorised)\n")
    failing = []
    for cid, expect, got, detail in cases:
        ok = str(got) in expect.split("/") and "token_in_body=True" not in detail
        print(
            f"  {'ok ' if ok else 'BAD'} {cid:<20} expect {expect:<8} got {got}  {detail}"
        )
        if not ok:
            failing.append(cid)
    state.setdefault("round2", {})["s07_creds_cases"] = cases
    _r2_record(
        state,
        "S-07-creds",
        not failing,
        f"{len(cases) - len(failing)}/{len(cases)} as expected"
        + (f"; not: {failing}" if failing else ""),
    )
    save_state(state)


# ── phase: probes (O-02 overlap poll — DEF-1/DEF-2 live in tests/tenancy) ─────


async def phase_probes(_args) -> None:
    guard()
    from app.config import settings as app_settings
    from app.services.email_automation import ingest

    print(
        "## O-02 — two concurrent run_ingest() calls must not both process the batch\n"
    )
    records: list[DispatchRecord] = []
    with ExitStack() as stack:
        for p in dispatch_patches(records):
            stack.enter_context(p)
        stack.enter_context(patch.object(app_settings, "app_debug", False))
        first = asyncio.create_task(ingest.run_ingest(limit=25))
        await asyncio.sleep(0.3)
        second = await ingest.run_ingest(limit=25)
        summary = await first
    print(f"  first poll:  {summary}")
    print(f"  second poll: {second}")
    ok = second.get("status") == "busy"
    print(
        f"  {'PASS' if ok else 'FAIL'}  second poll declined while the first was running"
    )


# ── phase: report ──────────────────────────────────────────────────────────────


SECRET_NEEDLES_ENV = (
    "IMAP_PASSWORD",
    "QA_SMTP_APP_PASSWORD",
    "SESSION_ENCRYPTION_KEY",
    "INTERNAL_JOB_TOKEN",
    "OCR_JWT_SECRET",
    "ADMIN_JWT_SECRET",
)


async def phase_report(_args) -> None:
    state = load_state()
    out_path = ROOT / "docs" / "email-automation" / "qa" / f"{RUN}-multi-bu-report.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # S-05/S-06 — the only place secrets could have leaked into is this script's own
    # persisted state; grep it for every real secret value this process ever held.
    raw_state = STATE_FILE.read_text()
    secret_hits = []
    for name in SECRET_NEEDLES_ENV:
        val = os.environ.get(name, "")
        if val and val in raw_state:
            secret_hits.append(name)
    if "P-S3-secret" in raw_state:
        secret_hits.append("PDF rule password (plaintext)")

    fails = state.get("verify", {}).get("fails", [])
    cross_bu = state.get("verify", {}).get("cross_bu", [])
    dispatch_fail = state.get("verify", {}).get("dispatch_fail", [])
    review_findings = state.get("review_findings", [])

    lines = [
        f"# Email Automation — multi-BU QA report (run {RUN})",
        "",
        f"Generated {datetime.now(UTC).isoformat()}. State file: `{STATE_FILE}`.",
        "",
        "## BUs under test",
        "",
        "| Code | Role | Tenant | Real Carmen? | Tag |",
        "|---|---|---|---|---|",
    ]
    for code, bu in state["bus"].items():
        lines.append(
            f"| {code} | {bu['role']} | `{bu['tenant_id']}` | "
            f"{'yes' if bu.get('real') else 'no (dry-run dispatcher)'} | `{bu['tag']}` |"
        )

    lines += [
        "",
        "## Result",
        "",
        f"- **{len(fails)}** case mismatch(es) against expectation",
        f"- **{len(cross_bu)}** cross-BU ledger/task/card leak(s) — BLOCKER if nonzero",
        f"- **{len(dispatch_fail)}** Carmen dispatch-to-wrong-host leak(s) — BLOCKER if nonzero",
        f"- **{len(review_findings)}** finding(s) from the review-queue isolation checks",
        f"- **{len(secret_hits)}** secret(s) found in persisted state — BLOCKER if nonzero: {secret_hits or 'none'}",
        "",
        "**Overall: "
        + (
            "FAIL — see blockers above"
            if (cross_bu or dispatch_fail or secret_hits)
            else ("PASS with findings" if fails or review_findings else "PASS")
        )
        + "**",
        "",
        "## Known defects (found reading the code before this run; reproduced separately)",
        "",
        "- **DEF-1 (High)** — two concurrent approvals of one document can both post a JV "
        "to Carmen. Reproduced at `backend/tests/tenancy/test_email_approve_integrity.py"
        "::test_two_concurrent_approvals_post_exactly_once` (`xfail(strict=True)`).",
        "- **DEF-2 (Medium)** — approving a document with a client-supplied `extracted.id` "
        "can stamp `submitted_at` on another BU's `credit_cards` row, with no tenant check. "
        "Reproduced at `...::test_approve_cannot_stamp_another_tenants_card` (`xfail(strict=True)`).",
        "- Run: `TENANCY_DB_TESTS=1 pytest backend/tests/tenancy/test_email_approve_integrity.py -v`",
        "",
        "## Per-case results (mapped from the plan's IDs)",
        "",
        "| case | plan IDs | BU | expected | note |",
        "|---|---|---|---|---|",
    ]
    fail_set = set(fails)
    for m in state["messages"]:
        mark = "FAIL" if m["id"] in fail_set else "PASS"
        plan_ids = ", ".join(m.get("plan_ids", []))
        lines.append(
            f"| {mark} {m['id']} | {plan_ids} | {m['bu_code']} | "
            f"{m['expect_status']}/{m.get('expect_reason') or '—'} | {m.get('note', '')} |"
        )

    if cross_bu:
        lines += ["", "## Cross-BU leaks (BLOCKER)", ""]
        for c in cross_bu:
            lines.append(f"- `{c}`")
    if dispatch_fail:
        lines += ["", "## Carmen dispatch leaks (BLOCKER)", ""]
        for d in dispatch_fail:
            lines.append(f"- `{d}`")
    if review_findings:
        lines += ["", "## Review-queue findings", ""]
        for f in review_findings:
            lines.append(f"- {f}")
    if state.get("real_jvs"):
        lines += ["", "## Real JVs posted to dev Carmen (clean these up manually)", ""]
        for j in state["real_jvs"]:
            lines.append(f"- {j}")

    lines += [
        "",
        "## Notes / scope adjustments made during the run",
        "",
        '- `carmencloud` (R2) could not be given a genuine "owns this TIN, auto_post posts '
        'with zero clicks" case without editing its live tax-ID registration (it is already '
        "handed to other testers) — that proof runs on scratch BU S3 instead (dry-run Carmen "
        "call, same code path, its own token/uri). R2's role covers: real toggle write, real "
        'approve/JV, and "auto_post never bypasses the tax-ID gate" on a foreign TIN.',
        "- `carmen` (R1) had no active subscription at the start of this run (its own history "
        "shows it had one before); a temporary one was granted for the run and removed in "
        "teardown.",
        '- Q-03 ("approve through the real UI") was done via a real HTTP call through the '
        "actual FastAPI app (`TestClient` against the real dev DB — the same technique "
        "`tests/tenancy` uses), not a browser. Ask if a Playwright pass is wanted too.",
        "",
        "## Findings that are not about routing/isolation, found while running this",
        "",
        "- **(Medium) Settings writes silently drop unknown fields on a rule.** "
        "`_merge_rule` (`email_settings_service.py`) rebuilds every rule from only the keys "
        "`RuleIn` knows (`bank_code`, `bank_sender_email`, `filename_patterns`, `is_active`, "
        "`pdf_password_enc`). `carmencloud`'s real KBANK rule carried an extra "
        '`"doc_type": "ar_reconcile"` key that this run\'s `PUT /settings`-equivalent call '
        "(toggling `auto_post`) silently deleted — caught and restored by hand mid-run "
        "(not by the harness). Any future settings write on any BU with a rule carrying a "
        "field outside the documented schema will silently lose it the same way — worth "
        "checking whether `doc_type` is load-bearing anywhere before the next such write.",
        "- **(Severity TBD, unresolved) A same-process, single burst of 22 messages produced "
        "only 15 outcomes on the first poll; the other 7 were marked `\\Seen` with no ledger "
        "row and no line in the poll's own summary — silent loss, not a crash (`job_runs` "
        "shows one `success` run, no exception was logged, no overlapping poll ran). "
        "Reproduced on a resend: see whether the smaller follow-up batch (this run's "
        "`missing7`/`2fix` waves, 11 messages) also lost anything — if it did not, this may "
        "be specific to bursts near ~20+ messages with several multi-MB attachments in one "
        "poll, which is exactly the shape a busy production tick can take.",
        "",
    ]

    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"report written: {out_path}")
    if cross_bu or dispatch_fail or secret_hits:
        print("\n*** BLOCKER(S) FOUND — see report ***")


# ── entry ─────────────────────────────────────────────────────────────────────


async def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--state", default=None, help="override the state file path")
    sub = ap.add_subparsers(dest="phase", required=True)

    sub.add_parser("preflight")
    sub.add_parser("setup")
    sub.add_parser("set-passwords")

    p_toggle = sub.add_parser("toggle")
    p_toggle.add_argument(
        "--action",
        required=True,
        choices=[
            "s4-disable",
            "s4-enable",
            "s6-reentitle",
            "s6-exhaust",
            "s6-restore",
            "s6-backlog-fill",
            "s6-backlog-drain",
        ],
    )

    p_send = sub.add_parser("send")
    p_send.add_argument("--wave", required=True, choices=list(WAVES) + ["1b"])
    p_send.add_argument(
        "--smtp-only", action="store_true", help="send over SMTP instead of IMAP APPEND"
    )

    p_poll = sub.add_parser("poll")
    p_poll.add_argument("--limit", type=int, default=25)
    p_poll.add_argument("--rounds", type=int, default=3)

    sub.add_parser("verify")
    sub.add_parser("review")
    sub.add_parser("probes")
    sub.add_parser("report")
    sub.add_parser("teardown")
    sub.add_parser("fixcheck-setup")
    sub.add_parser("fixcheck")
    sub.add_parser("round2-setup")
    sub.add_parser("r2-token")
    p_r2 = sub.add_parser("r2check")
    p_r2.add_argument(
        "--stage",
        required=True,
        choices=["e06-held", "e06-released", "q09-held", "q09-released"],
    )
    p_ar = sub.add_parser("approve-real")
    p_ar.add_argument(
        "--map",
        action="append",
        help='reviewer\'s pick for an unmapped line: "<payment type>=<dept>:<acc>"',
    )
    sub.add_parser("s07")
    sub.add_parser("s07-creds")

    args = ap.parse_args()
    if args.state:
        global STATE_FILE
        STATE_FILE = Path(args.state)

    handlers = {
        "preflight": phase_preflight,
        "setup": phase_setup,
        "set-passwords": phase_set_passwords,
        "toggle": phase_toggle,
        "send": phase_send,
        "poll": phase_poll,
        "verify": phase_verify,
        "review": phase_review,
        "probes": phase_probes,
        "report": phase_report,
        "teardown": phase_teardown,
        "fixcheck-setup": phase_fixcheck_setup,
        "fixcheck": phase_fixcheck,
        "round2-setup": phase_round2_setup,
        "r2-token": phase_r2_token,
        "r2check": phase_r2check,
        "approve-real": phase_approve_real,
        "s07": phase_s07,
        "s07-creds": phase_s07_creds,
    }
    await handlers[args.phase](args)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
