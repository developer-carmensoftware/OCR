"""Put a test mail back the way the pipeline found it, so a poll will process it again.

    python scripts/reset_email_test.py                     # last hour, dry run
    python scripts/reset_email_test.py --apply
    python scripts/reset_email_test.py --doc-no 210726E00035291 --apply
    python scripts/reset_email_test.py --minutes 180 --apply --unread

Re-forwarding a document is not enough to re-test it: three separate guards remember it,
and each one is doing its job in production.

    email_documents   (tenant, message_id, attachment)   the mail was already handled
    credit_cards      doc_no + submitted_at              the document was already posted
    IMAP \\Seen                                           the poll only reads UNSEEN

So a reset is all three, and skipping one produces a confusing half-result: clear only the
ledger and the document is refused as a duplicate; clear only `credit_cards` and the poll
never looks at the mail at all.

Dry run by default — it prints what it would touch and changes nothing until `--apply`.

**Dev only.** `credit_cards` is soft-deleted (the duplicate check filters `deleted_at is
null`) but `email_documents` rows are deleted outright, and the JV this document already
posted stays in Carmen — nothing here reaches the ERP.
"""

from __future__ import annotations

import argparse
import asyncio
import imaplib
import os
import sys
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")

DSN = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
DSN = DSN.replace(":5432/", ":6543/")  # transaction pooler — see the EMAXCONNSESSION note


async def _targets(conn, args) -> list[dict]:
    """The email_documents rows this run is about, newest first."""
    if args.message_id:
        where, params = "message_id = $1", [args.message_id]
    elif args.doc_no:
        where, params = "doc_no = $1", [args.doc_no]
    else:
        where, params = f"created_at > now() - interval '{int(args.minutes)} minutes'", []
    rows = await conn.fetch(
        f"select id, tenant_id, message_id, attachment, status, reason_code, doc_no, task_id,"
        f" jv_no, created_at from email_documents where {where} order by created_at desc",
        *params,
    )
    return [dict(r) for r in rows]


async def _charged(conn, rows: list[dict]) -> int:
    """Documents to give back to the subscription.

    Only the rows that posted: anything that reached `failed` was already refunded by the
    pipeline itself, and a `skipped` row never cost anything.
    """
    task_ids = [r["task_id"] for r in rows if r["status"] == "posted" and r["task_id"]]
    if not task_ids:
        return 0
    return await conn.fetchval(
        "select coalesce(sum(charged_docs), 0) from ocr_tasks where id = any($1::uuid[])",
        task_ids,
    )


def _unread(message_ids: list[str]) -> None:
    """Clear \\Seen so the next poll fetches these messages again."""
    box = imaplib.IMAP4_SSL(os.environ["IMAP_HOST"], int(os.environ.get("IMAP_PORT", 993)))
    try:
        box.login(os.environ["IMAP_USER"], os.environ["IMAP_PASSWORD"])
        box.select(f'"{os.environ["IMAP_FOLDER"].strip(chr(34))}"')
        for message_id in message_ids:
            _, data = box.search(None, "HEADER", "Message-ID", f'"{message_id}"')
            uids = (data[0] or b"").split()
            for uid in uids:
                box.store(uid, "-FLAGS", "\\Seen")
            print(f"  unread  {message_id} ({len(uids)} message(s))")
    finally:
        try:
            box.logout()
        except OSError:
            pass


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--minutes", type=int, default=60, help="how far back to look (default 60)")
    ap.add_argument("--message-id", help="reset one mail by its RFC-822 Message-ID")
    ap.add_argument("--doc-no", help="reset by the extracted document number")
    ap.add_argument("--apply", action="store_true", help="actually change things")
    ap.add_argument("--unread", action="store_true", help="also clear \\Seen in the mailbox")
    args = ap.parse_args()

    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        rows = await _targets(conn, args)
        if not rows:
            print("nothing to reset")
            return 0

        doc_nos = sorted({r["doc_no"] for r in rows if r["doc_no"]})
        message_ids = sorted({r["message_id"] for r in rows})
        give_back = await _charged(conn, rows)

        print(f"{'RESETTING' if args.apply else 'WOULD RESET'} {len(rows)} ledger row(s):")
        for r in rows:
            note = r["jv_no"] and f" JV {r['jv_no']}" or ""
            print(f"  {r['status']:<8} {r['reason_code'] or '-':<20} {r['attachment'][:52]}{note}")
        print(f"  documents to give back: {give_back}")
        if not args.apply:
            print("\ndry run — nothing changed. Re-run with --apply")
            return 0

        async with conn.transaction():
            deleted = await conn.execute(
                "delete from email_documents where id = any($1::uuid[])", [r["id"] for r in rows]
            )
            print(f"  email_documents  {deleted}")
            if doc_nos:
                # Soft delete: the duplicate check filters `deleted_at is null`, and this
                # is a business table — see CLAUDE.md.
                undup = await conn.execute(
                    "update credit_cards set deleted_at = now(), deleted_by = 'reset_email_test',"
                    " updated_at = now() where doc_no = any($1::text[]) and deleted_at is null",
                    doc_nos,
                )
                print(f"  credit_cards     {undup}  ({', '.join(doc_nos)})")
            if give_back:
                for tenant_id in {r["tenant_id"] for r in rows}:
                    await conn.execute(
                        "update tenant_subscriptions set docs_used = greatest(docs_used - $2, 0),"
                        " updated_at = now() where tenant_id = $1 and status = 'active'",
                        tenant_id,
                        give_back,
                    )
                print(f"  docs_used        -{give_back}")

        if args.unread:
            _unread(message_ids)
        else:
            print("\n  \\Seen left alone — mark the mail unread in Gmail, or pass --unread")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
