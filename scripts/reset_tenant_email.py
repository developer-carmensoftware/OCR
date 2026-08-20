"""Put one BU back to before it ever had email automation, so the whole pipeline can be
re-tested from the purchase screen.

    python scripts/reset_tenant_email.py --host dev.carmen4.com --bu carmencloud
    python scripts/reset_tenant_email.py --host dev.carmen4.com --bu carmencloud --apply
    python scripts/reset_tenant_email.py --host dev.carmen4.com --bu carmencloud --apply --keep-tag

This is the wider sibling of `reset_email_test.py`: that one replays a single mail, this
one clears the BU's whole email-automation state. What it removes, and why each one:

    email_documents        the dedupe ledger — every mail looks new again
    email_ingest_settings  tag, rules, owner addresses, Carmen token, Gmail handshake
    tenant_subscriptions   the active window, so buying a package is part of the test
    credit_cards           soft-deleted for the doc_nos the mails posted (duplicate guard)
    IMAP \\Seen             cleared for those messages, since the poll only reads UNSEEN

**Deleting the settings row releases the ingest tag, and the next enable allocates a new
one** — the customer's Gmail forwarding address changes and the confirmation handshake has
to be redone. Pass `--keep-tag` to keep the tag and merely disable the row instead.

Left alone: `credit_orders`, `billing_documents`, `credit_ledger`, `tenant_credits`.
Order history is an audit trail with issued document numbers, and none of it blocks a
re-test. Note the tenant is left with no subscription and whatever top-up balance it had —
if that balance is 0, the next scan is a 402 until a package is bought and approved, which
is the intended starting line.

Dry run by default: it prints exactly what it would touch and changes nothing until
`--apply`. **Dev only** — the JVs already posted stay in Carmen, nothing here reaches the ERP.
"""

from __future__ import annotations

import argparse
import asyncio

import asyncpg

# Same DSN (transaction pooler — see the EMAXCONNSESSION note there) and the same mailbox
# helper; this script is the only other caller.
from reset_email_test import DSN, _unread


async def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--host", required=True, help="tenant host or URI, e.g. https://dev.carmen4.com"
    )
    ap.add_argument("--bu", required=True, help="BU code, e.g. carmencloud")
    ap.add_argument("--apply", action="store_true", help="actually change things")
    ap.add_argument(
        "--keep-tag",
        action="store_true",
        help="disable the settings row instead of deleting it, so the ingest tag survives",
    )
    ap.add_argument("--keep-sub", action="store_true", help="leave tenant_subscriptions alone")
    ap.add_argument("--no-unread", action="store_true", help="leave \\Seen alone in the mailbox")
    args = ap.parse_args()
    # `tenants.host` is the bare host; a Carmen URI is what everyone has to hand.
    host = args.host.split("://")[-1].strip("/")

    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        tenant = await conn.fetchrow(
            "select id, name from tenants where host = $1 and bu_code = $2 and deleted_at is null",
            host,
            args.bu,
        )
        if not tenant:
            print(f"no tenant for {host} / {args.bu}")
            return 1
        tid = tenant["id"]

        docs = await conn.fetch(
            "select message_id, attachment, status, reason_code, doc_no, jv_no"
            " from email_documents where tenant_id = $1 order by created_at desc",
            tid,
        )
        settings = await conn.fetchrow(
            "select ingest_tag, enabled from email_ingest_settings where tenant_id = $1", tid
        )
        sub = await conn.fetchrow(
            "select plan_code, doc_allowance, docs_used, period_end from tenant_subscriptions"
            " where tenant_id = $1 and status = 'active'",
            tid,
        )
        message_ids = sorted({d["message_id"] for d in docs})
        doc_nos = sorted({d["doc_no"] for d in docs if d["doc_no"]})

        print(f"{'RESETTING' if args.apply else 'WOULD RESET'} {tenant['name']}  ({tid})")
        for d in docs:
            note = d["jv_no"] and f" JV {d['jv_no']}" or ""
            print(f"  {d['status']:<8} {d['reason_code'] or '-':<16} {d['attachment'][:48]}{note}")
        if settings:
            verb = "disable" if args.keep_tag else "delete"
            print(f"  settings   {verb}  tag={settings['ingest_tag']} enabled={settings['enabled']}")
        if sub and not args.keep_sub:
            print(
                f"  subscription  delete  {sub['plan_code']} {sub['docs_used']}/"
                f"{sub['doc_allowance']} until {sub['period_end']:%Y-%m-%d}"
            )
        print(f"  credit_cards  soft-delete {doc_nos or '-'}")
        print(f"  mailbox       {'skipped' if args.no_unread else f'{len(message_ids)} to unread'}")

        if not args.apply:
            print("\ndry run — nothing changed. Re-run with --apply")
            return 0

        async with conn.transaction():
            res = await conn.execute("delete from email_documents where tenant_id = $1", tid)
            print(f"  email_documents   {res}")
            if args.keep_tag:
                # Everything a re-test must re-do, minus the tag itself: the Carmen token
                # and the Gmail handshake are re-established by enabling again.
                settings_sql = (
                    "update email_ingest_settings set enabled = false, carmen_token_enc = null,"
                    " carmen_token_fp = null, carmen_token_verified_at = null,"
                    " gmail_confirm_code = null, gmail_confirm_at = null,"
                    " gmail_confirmed_at = null, updated_at = now() where tenant_id = $1"
                )
            else:
                settings_sql = "delete from email_ingest_settings where tenant_id = $1"
            print(f"  settings          {await conn.execute(settings_sql, tid)}")
            if not args.keep_sub:
                res = await conn.execute(
                    "delete from tenant_subscriptions where tenant_id = $1", tid
                )
                print(f"  subscriptions     {res}")
            if doc_nos:
                # Soft delete: the duplicate check filters `deleted_at is null`, and this is
                # a business table — see CLAUDE.md.
                res = await conn.execute(
                    "update credit_cards set deleted_at = now(), deleted_by = 'reset_tenant_email',"
                    " updated_at = now() where tenant_id = $1 and doc_no = any($2::text[])"
                    " and deleted_at is null",
                    tid,
                    doc_nos,
                )
                print(f"  credit_cards      {res}  ({', '.join(doc_nos)})")

        if message_ids and not args.no_unread:
            _unread(message_ids)
        elif message_ids:
            print("\n  \\Seen left alone — mark the mail unread in Gmail, or drop --no-unread")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
