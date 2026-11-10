"""JV queue filters — the data half of `jv_filters_ui.mjs`.

    python scripts/qa/jv_filters_e2e.py setup      # three tenants, ~170 rows, sessions → fixture.json
    python scripts/qa/jv_filters_e2e.py teardown   # delete everything `setup` wrote

**Local Supabase only** (127.0.0.1:54322), same rule as the PMS E2Es: the shared dev DB is swept
by QA's backend, and these rows are not theirs. The script refuses any other DSN.

Tenant A (`qa-jvf-a`) holds one row for every kind of transaction the queue can show, spread over
every bank, source and age, so that *every* filter combination has something to find and
something to leave out. Tenant B mirrors A's banks and document numbers (all posted, nothing to
review) to prove A's session never sees them. Tenant C has no rows at all.

**The oracle is this table.** Every row is written to `fixture.json` with what the screen should
make of it — source, bank, which chip it lives under, when it happened, the words a search may
match — worked out here from the documented rules (activity.py's header), *not* by reading the
server's SQL. The browser and API tests derive every expectation from those rows, so a wrong row
in some combination fails against an independent answer rather than against a hand-copied one.

Timestamps are anchored to the BU's midnight (ICT, the same +07 the Today filter uses), so the
edges the date filters care about — 7 days back, 30 days back, ±1 minute — hold on any day.
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
HOST = "qa-jvf.local"
# c has no rows at all (the "no scans yet" screen). b is all posted, so it has nothing to review.
BUS = {"a": "qa-jvf-a", "b": "qa-jvf-b", "c": "qa-jvf-c"}
MARK = "qa-jvf-session"
OUT = ROOT / ".playwright-mcp" / "jv-filters"
ICT = timezone(timedelta(hours=7))

NOW = datetime.now(UTC)
DAY_START = datetime.now(ICT).replace(hour=0, minute=0, second=0, microsecond=0)

BANKS = ["BBL", "KBANK", "SCB", "BAY", "KTC", "GHL", "PAYPAL", "SIAMPAY", None]


def at_today(minutes_ago: int) -> datetime:
    """Earlier today: `minutes_ago` back, but never before the BU's midnight (a run in the first
    minutes after 00:00 ICT would otherwise put a 'today' row on yesterday)."""
    return max(DAY_START + timedelta(minutes=2), NOW - timedelta(minutes=minutes_ago))


# The ages a row can have. Each is a point that some date filter treats differently:
#   today(×2)       in all of Today / 7d / 30d
#   yesterday       the minute before midnight: out of Today, in 7d
#   6d in/out       the 7-day edge (range=7d is `since = midnight − 6 days`)
#   29d in/out      the 30-day edge (`since = midnight − 29 days`)
#   31d, 60d, 85d   in none of them
#
# **Nothing older than 85 days, on purpose.** The retention jobs are real and run on the local
# database too: `email-documents-purge` (03:50 UTC) deletes skipped rows and scrubs the rest at 90
# days, and `scrub-old-filenames` (04:20 UTC) blanks `ocr_tasks` filenames at 12 months. A 400-day
# fixture row was scrubbed in the middle of a run, which changed what a search could find and what
# the oracle expected. The oldest age stays inside every retention window.
AGES: list[tuple[str, datetime]] = [
    ("today-10m", at_today(10)),
    ("today-3h", at_today(180)),
    ("yesterday", DAY_START - timedelta(minutes=1)),
    ("d6-in", DAY_START - timedelta(days=6) + timedelta(minutes=1)),
    ("d6-out", DAY_START - timedelta(days=6) - timedelta(minutes=1)),
    ("d29-in", DAY_START - timedelta(days=29) + timedelta(minutes=1)),
    ("d29-out", DAY_START - timedelta(days=29) - timedelta(minutes=1)),
    ("d31", DAY_START - timedelta(days=31)),
    ("d60", DAY_START - timedelta(days=60)),
    ("d85", DAY_START - timedelta(days=85)),
]

# (status, reason_code, chip) — every outcome the email pipeline writes. The chip is the reader's
# question, per activity.py: `review` = parked for a decision (charged refusals park too, #22),
# `success` = reached Carmen, `noise` = quiet (only under All / Today), `hidden` = in no view at
# all, everything else that did not become a JV = `unposted`.
EMAIL_CASES: list[tuple[str, str | None, str]] = [
    ("pending_review", None, "review"),
    ("pending_review", "tax_id_mismatch", "review"),
    ("pending_review", "duplicate_document", "review"),
    ("pending_review", "mapping_incomplete", "review"),
    ("posted", None, "success"),
    ("failed", "carmen_rejected", "unposted"),
    ("failed", "carmen_unauthorized", "unposted"),
    ("skipped", "sender_not_allowed", "unposted"),
    ("skipped", "wrong_pdf_password", "unposted"),
    ("skipped", "unreadable_document", "noise"),
    ("received", None, "unposted"),  # a row stuck mid-pipeline: it certainly did not post
    ("skipped", "no_rule_match", "hidden"),
]

# Names a search has to survive: LIKE wildcards, a backslash, quotes, Thai, case, length.
CORPUS = [
    "qa-jvf-50%_off.pdf",
    "qa-jvf-50xoff.pdf",
    "qa-jvf-back\\slash.pdf",
    "qa-jvf-o'brien.pdf",
    'qa-jvf-"quoted".pdf',
    "qa-jvf-ใบแจ้งหนี้-กรกฎาคม.pdf",
    "QA-JVF-UPPER.PDF",
    "qa-jvf-" + "x" * 80 + ".pdf",
]

PMS_NAMES = ["Comanche", "HotelTime", "Cloudbeds"]
# (status, chip) — `received` is a day being read right now; it is in no view.
PMS_STATUSES = [
    ("pending_review", "review"),
    ("posted", "success"),
    ("rejected", "unposted"),
    ("failed", "unposted"),
    ("received", "hidden"),
]


def _dmy(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def build_rows() -> list[dict]:
    """Tenant A's rows. Deterministic: the same table on every run."""
    rows: list[dict] = []
    n = 0

    # Email: every case × every bank (incl. none). The age steps by one per row, so against a fixed
    # bank it walks all ten ages across the cases, and against a fixed case across the banks —
    # every (case, age) and (bank, age) pair turns up somewhere, and each age holds ~11 rows.
    for ci, (status, reason, chip) in enumerate(EMAIL_CASES):
        for bi, bank in enumerate(BANKS):
            age_name, at = AGES[n % len(AGES)]
            n += 1
            tag = f"e{ci:02d}{bank or 'NONE'}"
            attachment = f"qa-jvf-{tag}.pdf"
            doc_no = None if chip in ("noise", "hidden") else f"QA-{tag}"
            rows.append(
                dict(
                    src="email",
                    attachment=attachment,
                    status=status,
                    reason=reason,
                    bank=bank if chip not in ("noise", "hidden") else None,
                    doc_no=doc_no,
                    jv_no=f"JV-{tag}" if status == "posted" else None,
                    chip=chip,
                    at=at,
                    age=age_name,
                    dismissed=False,
                )
            )

    # Dismissed (put away): still a normal Not-posted row.
    for k, bank in enumerate(["KBANK", "SCB"]):
        age_name, at = AGES[k]
        rows.append(
            dict(
                src="email",
                attachment=f"qa-jvf-dismissed-{bank}.pdf",
                status="failed",
                reason="carmen_rejected",
                bank=bank,
                doc_no=f"QA-DISM-{bank}",
                jv_no=None,
                chip="unposted",
                at=at,
                age=age_name,
                dismissed=True,
            )
        )

    # The search corpus, all posted, over different banks and ages.
    for k, name in enumerate(CORPUS):
        age_name, at = AGES[k % len(AGES)]
        bank = BANKS[k % 8]
        rows.append(
            dict(
                src="email",
                attachment=name,
                status="posted",
                reason=None,
                bank=bank,
                doc_no=f"QA-CORPUS-{k}",
                jv_no=f"JV-CORPUS-{k}",
                chip="success",
                at=at,
                age=age_name,
                dismissed=False,
            )
        )
    # One doc number on three banks — a collision a bank filter has to separate.
    for bank in ["KBANK", "SCB", "BBL"]:
        age_name, at = AGES[2]
        rows.append(
            dict(
                src="email",
                attachment=f"qa-jvf-dup-{bank}.pdf",
                status="posted",
                reason=None,
                bank=bank,
                doc_no="QA-DUP-001",
                jv_no=f"JV-DUP-{bank}",
                chip="success",
                at=at,
                age=age_name,
                dismissed=False,
            )
        )

    # Manual scans: posted / never posted × every bank, plus two with no doc number.
    for bi, bank in enumerate(BANKS[:8]):
        for posted in (True, False):
            age_name, at = AGES[(bi * 2 + (0 if posted else 1)) % len(AGES)]
            tag = f"m{bank}{'P' if posted else 'U'}"
            rows.append(
                dict(
                    src="manual",
                    attachment=f"qa-jvf-{tag}.pdf",
                    status="posted" if posted else "scanned",
                    reason=None,
                    bank=bank,
                    doc_no=f"QA-{tag}",
                    jv_no=f"JV-{tag}" if posted else None,
                    chip="success" if posted else "unposted",
                    at=at,
                    age=age_name,
                    dismissed=False,
                )
            )
    for posted in (True, False):
        age_name, at = AGES[0 if posted else 4]
        tag = f"mNODOC{'P' if posted else 'U'}"
        rows.append(
            dict(
                src="manual",
                attachment=f"qa-jvf-{tag}.pdf",
                status="posted" if posted else "scanned",
                reason=None,
                bank="SCB",
                doc_no=None,
                jv_no=f"JV-{tag}" if posted else None,
                chip="success" if posted else "unposted",
                at=at,
                age=age_name,
                dismissed=False,
            )
        )

    # PMS days: every status × three interfaces. One distinct date each, because the Document
    # cell shows the date and the tests identify a row by what it shows.
    k = 0
    for ni, name in enumerate(PMS_NAMES):
        for si, (status, chip) in enumerate(PMS_STATUSES):
            age_name, at = AGES[(ni * 2 + si) % len(AGES)]
            day = (DAY_START - timedelta(days=40 + k)).date().isoformat()
            k += 1
            rows.append(
                dict(
                    src="pms",
                    attachment=f"{name} · Daily",
                    status=status,
                    reason=None,
                    bank=None,
                    doc_no=_dmy(day),
                    jv_no=f"JV-PMS-{name}-{si}" if status == "posted" else None,
                    chip=chip,
                    at=at,
                    age=age_name,
                    dismissed=False,
                    pms_name=name,
                    pms_day=day,
                )
            )

    # Every row gets its own microsecond. Many rows share an age (that is the point of AGES), and
    # the list is ordered by time: two rows on the same instant would come back in whatever order
    # the database likes, and no test could say what page 2 should hold.
    for i, r in enumerate(rows):
        r["at"] = r["at"] + timedelta(microseconds=i + 1)
    return rows


def key_of(r: dict) -> str:
    """What the Document cell shows, as one string: the doc number (or `—`), a space, the file.
    The pair, because one document number is deliberately on three banks (QA-DUP-001)."""
    return f"{r['doc_no'] or '—'} {r['attachment']}"


def fields_of(r: dict) -> list[str]:
    """The words a search may match, as one list of independent fields (email / manual match a
    field at a time) — or a single haystack for a PMS day, which is matched as one string."""
    if r["src"] == "pms":
        return [f"pms {r['pms_name']} daily {r['pms_day']} {_dmy(r['pms_day'])}"]
    return [r["attachment"], r["doc_no"] or "", r["bank"] or ""]


def _guard() -> None:
    if "127.0.0.1:54322" not in DSN:
        raise SystemExit("local Supabase only")


async def teardown(conn: asyncpg.Connection) -> int:
    ids = [r["id"] for r in await conn.fetch("select id from tenants where host = $1", HOST)]
    for t in ("email_documents", "pms_events", "credit_cards", "ocr_tasks", "ocr_sessions"):
        await conn.execute(f"delete from {t} where tenant_id = any($1::uuid[])", ids)
    await conn.execute("delete from tenants where id = any($1::uuid[])", ids)
    return len(ids)


async def _insert_email(conn, tenant, r: dict, message: str) -> None:
    await conn.execute(
        "insert into email_documents (id, tenant_id, message_id, attachment, status, bank_code,"
        " doc_no, jv_no, reason_code, created_at, updated_at, dismissed_at)"
        " values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)",
        tenant,
        message,
        r["attachment"],
        r["status"],
        r["bank"],
        r["doc_no"],
        r["jv_no"],
        r["reason"],
        r["at"],
        r["at"] if r["dismissed"] else None,
    )


async def _insert_manual(conn, tenant, r: dict) -> None:
    task = await conn.fetchval(
        "insert into ocr_tasks (id, tenant_id, module_id, original_filename, status, created_at)"
        " values (gen_random_uuid(),$1,'credit_card_ocr',$2,'completed',$3) returning id",
        tenant,
        r["attachment"],
        r["at"],
    )
    posted = r["status"] == "posted"
    await conn.execute(
        "insert into credit_cards (id, tenant_id, task_id, bank_code, doc_no, submitted_at, jv_no,"
        " created_at) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7)",
        tenant,
        task,
        r["bank"],
        r["doc_no"],
        r["at"] if posted else None,
        r["jv_no"],
        r["at"],
    )


async def _insert_pms(conn, tenant, r: dict) -> None:
    payload = {
        "InterfaceType": "PMS",
        "InterfaceName": r["pms_name"],
        "DocType": "Daily",
        "DocDate": r["pms_day"],
    }
    await conn.execute(
        "insert into pms_events (id, tenant_id, event_id, type, payload, status, jv_no, created_at,"
        " updated_at) values (gen_random_uuid(),$1,$2,'PMS',$3::jsonb,$4,$5,$6,$6)",
        tenant,
        f"PMS/{r['pms_name']}/Daily/{r['pms_day']}",
        json.dumps(payload),
        r["status"],
        r["jv_no"],
        r["at"],
    )


async def setup(conn: asyncpg.Connection) -> dict:
    from app.auth.session import create_session_jwt, encrypt_carmen_token
    from app.config import settings

    await teardown(conn)
    out: dict = {
        "host": HOST,
        "dayStart": DAY_START.astimezone(UTC).isoformat(timespec="microseconds"),
        "now": NOW.astimezone(UTC).isoformat(timespec="microseconds"),
        "tenants": {},
    }
    for key, bu in BUS.items():
        tid = await conn.fetchval(
            "insert into tenants (host, bu_code, name) values ($1, $2, $3) returning id",
            HOST,
            bu,
            bu,
        )
        sid = uuid.uuid4()
        await conn.execute(
            "insert into ocr_sessions (id, tenant_id, carmen_user_id, username,"
            " carmen_token_encrypted, carmen_uri, is_active) values ($1,$2,$3,$4,$5,$6,true)",
            sid,
            tid,
            MARK,
            "qa-jvf",
            encrypt_carmen_token("not-a-real-carmen-token", settings.session_encryption_key),
            f"https://{HOST}",
        )
        jwt = create_session_jwt(
            session_id=str(sid),
            tenant_id=str(tid),
            carmen_user_id=MARK,
            username="qa-jvf",
            secret=settings.ocr_jwt_secret,
            ttl_hours=8,
            carmen_uri=f"https://{HOST}",
            bu=bu,
        )
        out["tenants"][key] = {
            "id": str(tid),
            "bu": bu,
            "jwt": jwt,
            "user": {
                "username": "qa-jvf",
                "bu": bu,
                "uri": f"https://{HOST}",
                "tenant_id": str(tid),
            },
        }

    a = uuid.UUID(out["tenants"]["a"]["id"])
    b = uuid.UUID(out["tenants"]["b"]["id"])

    rows = build_rows()
    for i, r in enumerate(rows):
        if r["src"] == "email":
            await _insert_email(conn, a, r, f"<{i}-{r['attachment']}@qa-jvf>")
        elif r["src"] == "manual":
            await _insert_manual(conn, a, r)
        else:
            await _insert_pms(conn, a, r)

    # Tenant B: the same banks and document numbers, all posted, all today. Anything of B's that
    # shows up for A — or the reverse — is a leak, and the names make it obvious which.
    b_rows = []
    for bi, bank in enumerate(BANKS):
        r = dict(
            src="email",
            attachment=f"qa-jvf-tenantB-{bank or 'NONE'}.pdf",
            status="posted",
            reason=None,
            bank=bank,
            doc_no="QA-DUP-001" if bi < 3 else f"QA-B-{bank or 'NONE'}",
            jv_no=f"JV-B-{bi}",
            chip="success",
            at=at_today(5 + bi),
            age="today",
            dismissed=False,
        )
        b_rows.append(r)
        await _insert_email(conn, b, r, f"<b{bi}@qa-jvf>")

    def public(r: dict) -> dict:
        return {
            "src": r["src"],
            "key": key_of(r),
            "bank": r["bank"],
            "chip": r["chip"],
            "status": r["status"],
            "reason": r["reason"],
            # UTC, fixed width: these strings sort the same way the instants do.
            "at": r["at"].astimezone(UTC).isoformat(timespec="microseconds"),
            "age": r["age"],
            "fields": fields_of(r),
            "attachment": r["attachment"],
            "docNo": r["doc_no"],
            "dismissed": r["dismissed"],
        }

    out["rows"] = [public(r) for r in rows]
    out["rowsB"] = [public(r) for r in b_rows]
    # Keys must be unique per tenant: the tests identify a row by what the Document cell shows.
    keys = [r["key"] for r in out["rows"]]
    dupes = {k for k in keys if keys.count(k) > 1}
    assert not dupes, f"duplicate row keys in the fixture: {sorted(dupes)}"

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "fixture.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


async def main() -> int:
    _guard()
    if len(sys.argv) != 2 or sys.argv[1] not in ("setup", "teardown"):
        print(__doc__)
        return 2
    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        if sys.argv[1] == "teardown":
            print(f"deleted {await teardown(conn)} tenant(s) and their rows")
        else:
            res = await setup(conn)
            vis = [r for r in res["rows"] if r["chip"] != "hidden"]
            print(
                f"setup ok: {len(res['rows'])} rows for A ({len(vis)} visible), "
                f"{len(res['rowsB'])} for B, tenants {[t['id'] for t in res['tenants'].values()]}"
            )
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
