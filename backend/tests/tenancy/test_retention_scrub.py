"""`fn_scrub_old_filenames()` (migration 20261030000200) against the real tables.

Filenames and error text older than 12 months are blanked in ocr_tasks, ap_invoices and
the ledger's charge rows; the rows themselves — and every number in them — stay. Needs the
migration: run against a database that has it (the local Supabase stack until it ships).

The function is not tenant-scoped, exactly as the daily cron runs it. Here it can only
touch rows older than 12 months, and the shared dev database holds none older than
2026-06 — so on dev it changes nothing but this test's own seed.
"""

import uuid

from sqlalchemy import text

from .conftest import run

OLD, RECENT = "now() - interval '13 months'", "now() - interval '1 month'"


def _seed(real_engine, tenant_id):
    ids = {
        k: uuid.uuid4()
        for k in (
            "old_task",
            "new_task",
            "old_ap",
            "new_ap",
            "old_charge",
            "old_topup",
            "new_charge",
        )
    }

    async def _go():
        async with real_engine.begin() as conn:
            for key, when, status, error in (
                ("old_task", OLD, "failed", "LLM said no about invoice_somchai.pdf"),
                ("new_task", RECENT, "failed", "LLM said no about invoice_recent.pdf"),
            ):
                await conn.execute(
                    text(
                        "insert into ocr_tasks (id, tenant_id, module_id, original_filename, status,"
                        f" error_message, charged_docs, created_at, updated_at) values (:id, :t,"
                        f" 'ap_invoice', :f, :s, :e, 3, {when}, {when})"
                    ),
                    {
                        "id": ids[key],
                        "t": tenant_id,
                        "f": f"{key}_somchai.pdf",
                        "s": status,
                        "e": error,
                    },
                )
            for key, task, when in (("old_ap", "old_task", OLD), ("new_ap", "new_task", RECENT)):
                await conn.execute(
                    text(
                        "insert into ap_invoices (id, task_id, tenant_id, original_filename, created_at,"
                        f" updated_at) values (:id, :task, :t, :f, {when}, {when})"
                    ),
                    {"id": ids[key], "task": ids[task], "t": tenant_id, "f": f"{key}_somchai.pdf"},
                )
            for key, reason, ref, when in (
                ("old_charge", "consumption", "old_charge_somchai.pdf", OLD),
                ("old_topup", "topup", "order-123", OLD),
                ("new_charge", "consumption", "new_charge_somchai.pdf", RECENT),
            ):
                await conn.execute(
                    text(
                        "insert into credit_ledger (id, tenant_id, delta, balance_after, reason, ref,"
                        f" created_at, updated_at) values (:id, :t, -3, 97, :r, :ref, {when}, {when})"
                    ),
                    {"id": ids[key], "t": tenant_id, "r": reason, "ref": ref},
                )

    run(_go())
    return ids


def _one(real_engine, sql, row_id):
    async def _go():
        async with real_engine.connect() as conn:
            return (await conn.execute(text(sql), {"id": row_id})).one()

    return run(_go())


def test_old_filenames_and_errors_are_scrubbed_and_every_number_stays(real_engine, tenants):
    ids = _seed(real_engine, tenants.a)

    async def _scrub():
        async with real_engine.begin() as conn:
            await conn.execute(text("select fn_scrub_old_filenames()"))

    run(_scrub())

    task = "select original_filename, error_message, charged_docs from ocr_tasks where id = :id"
    assert _one(real_engine, task, ids["old_task"]) == ("scrubbed", None, 3)
    assert _one(real_engine, task, ids["new_task"]) == (
        "new_task_somchai.pdf",
        "LLM said no about invoice_recent.pdf",
        3,
    )

    ap = "select original_filename from ap_invoices where id = :id"
    assert _one(real_engine, ap, ids["old_ap"]) == (None,)
    assert _one(real_engine, ap, ids["new_ap"]) == ("new_ap_somchai.pdf",)

    ledger = "select ref, delta, balance_after from credit_ledger where id = :id"
    assert _one(real_engine, ledger, ids["old_charge"]) == (None, -3, 97)
    assert _one(real_engine, ledger, ids["old_topup"]) == ("order-123", -3, 97)  # an order id stays
    assert _one(real_engine, ledger, ids["new_charge"]) == ("new_charge_somchai.pdf", -3, 97)

    run(_scrub())  # idempotent: a second run changes nothing
    assert _one(real_engine, task, ids["old_task"]) == ("scrubbed", None, 3)


def test_both_retention_jobs_are_scheduled(real_engine):
    async def _jobs():
        async with real_engine.connect() as conn:
            rows = await conn.execute(
                text(
                    "select jobname, schedule from cron.job"
                    " where jobname in ('email-mailbox-purge', 'scrub-old-filenames')"
                )
            )
            return dict(rows.all())

    assert run(_jobs()) == {"email-mailbox-purge": "0 4 * * *", "scrub-old-filenames": "20 4 * * *"}
