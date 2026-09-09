"""Put one BU back to before it ever had email automation, so the whole pipeline can be
re-tested from the purchase screen.

    python scripts/reset_tenant_email.py --host dev.carmen4.com --bu carmencloud
    python scripts/reset_tenant_email.py --host dev.carmen4.com --bu carmencloud --apply
    python scripts/reset_tenant_email.py --host dev.carmen4.com --bu carmencloud --apply --keep-tag

This is the wider sibling of `reset_email_test.py`: that one replays a single mail, this
one clears the BU's whole email-automation state. What it removes, and why each one:

    email_documents        the dedupe ledger — every mail looks new again
    email_queue_seen       the review queue's attention dot, so a new queue lights it
    email_ingest_settings  tag, rules, owner addresses, Carmen token, Gmail handshake
    tenant_subscriptions   the active window, so buying a package is part of the test
    credit_cards           soft-deleted for the doc_nos the mails posted (duplicate guard)
    IMAP \\Seen             cleared for those messages, since the poll only reads UNSEEN

`--clear-mapping` additionally drops the BU's GL mapping, which is the fourth thing that
remembers: once a payment type is mapped, `_suggest_missing_mappings` never runs, so the
AI-suggestion path cannot be tested against a BU that has been used before.

`--clear-manual` soft-deletes the BU's **wizard** scans as well. The module's Posted tab is
two sources merged, and clearing the ledger empties only the email half — a BU that has also
been used by hand still shows every JV it ever posted, which reads as a failed reset.

**Deleting the settings row releases the ingest tag, and the next enable allocates a new
one** — the customer's Gmail forwarding address changes and the confirmation handshake has
to be redone. Pass `--keep-tag` to keep the tag and merely disable the row instead.

`--keep-settings` (with `--keep-sub`) is the **handing-it-to-a-tester** reset rather than the
back-to-zero one: it clears only what remembers a document — the ledger, the queue dot, the
posted `credit_cards`, `\\Seen` — and leaves automation switched on with its tag, Carmen token
and Gmail handshake, so the tester forwards mail and it flows without any setup first.

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
import sys

import asyncpg

# Same DSN (transaction pooler — see the EMAXCONNSESSION note there) and the same mailbox
# helper; this script is the only other caller.
from reset_email_test import DSN, _unread


def _settings_plan(keep_settings: bool, keep_tag: bool) -> tuple[str, str | None]:
    """(verb for the plan line, SQL for the transaction) — deliberately one source.

    The plan printed before `--apply` is the only thing the operator reads before agreeing
    to it, so a verb picked independently of the statement could promise "keep" while the
    transaction deleted the row. Three cases, one branch.
    """
    if keep_settings:
        # Nothing at all: `enabled_at` stays as it is, so replayed mail is not filtered by
        # the arrival check in `_run_message` — which is exactly what --keep-tag has to null
        # out, because re-enabling would stamp it to now.
        return "keep", None
    if keep_tag:
        # Everything a re-test must re-do, minus the tag itself: the Carmen token and the
        # Gmail handshake are re-established by enabling again.
        #
        # `enabled_at` included, or this branch quietly undoes its own --unread: re-enabling
        # stamps it to now (email_settings_service.save_settings), and every replayed mail is
        # then older than it and lands `ingest_paused`. Null is what a BU that never had
        # automation looks like — which is what the delete branch below produces for free.
        return "disable", (
            "update email_ingest_settings set enabled = false, enabled_at = null,"
            " carmen_token_enc = null,"
            " carmen_token_fp = null, carmen_token_verified_at = null,"
            " gmail_confirm_code = null, gmail_confirm_at = null,"
            " gmail_confirmed_at = null, updated_at = now() where tenant_id = $1"
        )
    return "delete", "delete from email_ingest_settings where tenant_id = $1"


def _self_check() -> None:
    """python scripts/reset_tenant_email.py --self-check — the branch above, nothing else."""
    assert _settings_plan(True, False) == ("keep", None)
    assert _settings_plan(True, True) == ("keep", None), "--keep-settings wins over --keep-tag"
    verb, sql = _settings_plan(False, True)
    assert (verb, sql.startswith("update ")) == ("disable", True)
    assert "enabled_at = null" in sql, "re-enabling would else pause every replayed mail"
    verb, sql = _settings_plan(False, False)
    assert (verb, sql.startswith("delete ")) == ("delete", True)
    print("self-check ok")


async def main() -> int:
    # Before the parser: --host/--bu are required, and the self-check needs neither.
    if "--self-check" in sys.argv:
        _self_check()
        return 0
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
    ap.add_argument(
        "--keep-settings",
        action="store_true",
        help="leave email_ingest_settings entirely alone — automation stays enabled, with its"
        " tag, Carmen token and Gmail handshake, so a tester can forward mail immediately",
    )
    ap.add_argument("--keep-sub", action="store_true", help="leave tenant_subscriptions alone")
    ap.add_argument(
        "--clear-mapping",
        action="store_true",
        help="also drop the BU's GL mapping, so the AI has to suggest one again",
    )
    ap.add_argument(
        "--clear-manual",
        action="store_true",
        help="also soft-delete the BU's wizard scans, so the module's Posted tab is empty",
    )
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
        # The module's Posted tab is two sources merged (`credit_card_activity._manual_stmt`):
        # this BU's `email_documents`, plus every submitted `credit_cards` row with no email
        # row behind it — a wizard scan. Clearing the ledger empties the first half only,
        # which reads as "the reset did not work" on a BU that has also been used by hand.
        manual = await conn.fetchrow(
            "select count(*) as live, count(*) filter (where submitted_at is not null) as posted"
            " from credit_cards where tenant_id = $1 and deleted_at is null",
            tid,
        )
        mappings = (
            await conn.fetch(
                "select e.field_type, e.dept_code, e.acc_code from bu_accounting_mapping_entries e"
                " join bu_accounting_configs c on c.id = e.config_id where c.tenant_id = $1"
                " order by e.field_type",
                tid,
            )
            if args.clear_mapping
            else []
        )

        print(f"{'RESETTING' if args.apply else 'WOULD RESET'} {tenant['name']}  ({tid})")
        for d in docs:
            note = d["jv_no"] and f" JV {d['jv_no']}" or ""
            print(f"  {d['status']:<8} {d['reason_code'] or '-':<16} {d['attachment'][:48]}{note}")
        settings_verb, settings_sql = _settings_plan(args.keep_settings, args.keep_tag)
        if settings:
            print(
                f"  settings   {settings_verb}  tag={settings['ingest_tag']}"
                f" enabled={settings['enabled']}"
            )
        if sub and not args.keep_sub:
            print(
                f"  subscription  delete  {sub['plan_code']} {sub['docs_used']}/"
                f"{sub['doc_allowance']} until {sub['period_end']:%Y-%m-%d}"
            )
        for m in mappings:
            print(f"  mapping    delete  {m['field_type']:<20} {m['dept_code']}/{m['acc_code']}")
        if args.clear_manual:
            print(
                f"  wizard scans  soft-delete {manual['live']} live row(s),"
                f" {manual['posted']} of them posted"
            )
        print(f"  credit_cards  soft-delete {doc_nos or '-'}")
        print(f"  mailbox       {'skipped' if args.no_unread else f'{len(message_ids)} to unread'}")

        if not args.apply:
            print("\ndry run — nothing changed. Re-run with --apply")
            return 0

        async with conn.transaction():
            res = await conn.execute("delete from email_documents where tenant_id = $1", tid)
            print(f"  email_documents   {res}")
            # The queue's attention dot is a high-water mark over the rows just deleted;
            # left behind, a genuinely new queue opens already acknowledged.
            res = await conn.execute("delete from email_queue_seen where tenant_id = $1", tid)
            print(f"  email_queue_seen  {res}")
            if settings_sql:
                print(f"  settings          {await conn.execute(settings_sql, tid)}")
            else:
                print("  settings          left alone")
            if not args.keep_sub:
                res = await conn.execute(
                    "delete from tenant_subscriptions where tenant_id = $1", tid
                )
                print(f"  subscriptions     {res}")
            if args.clear_mapping:
                # Hard delete, not the usual soft one: `get_accounting_config` returns an
                # empty response for a missing row, which is the "never opened the mapping
                # page" state the AI-suggestion path is written for. A soft-deleted config
                # with live entries would be a shape the app never produces.
                res = await conn.execute(
                    "delete from bu_accounting_mapping_entries where config_id in"
                    " (select id from bu_accounting_configs where tenant_id = $1)",
                    tid,
                )
                print(f"  mapping entries   {res}")
                res = await conn.execute(
                    "delete from bu_accounting_configs where tenant_id = $1", tid
                )
                print(f"  accounting config {res}")
            if args.clear_manual:
                # Every live row, not only the submitted ones: an unsubmitted row is invisible
                # on the Posted tab but is still a row of a BU we are putting back to zero.
                # Supersedes the doc_no-scoped update below, which then matches nothing.
                res = await conn.execute(
                    "update credit_cards set deleted_at = now(), deleted_by = 'reset_tenant_email',"
                    " updated_at = now() where tenant_id = $1 and deleted_at is null",
                    tid,
                )
                print(f"  wizard scans      {res}")
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
