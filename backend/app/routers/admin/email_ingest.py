"""Admin endpoints for Email Automation — the read side of a write-only feature.

`email_documents` records every mail the pipeline reached a verdict on, and until now
nothing read a row of it: the only query anywhere was a per-BU `COUNT` on the customer's
own settings screen. Answering "what happened to the document this BU forwarded" meant
opening a SQL client, and the two admin pages that look adjacent both miss it —
`#/admin/extractions` reads `ocr_tasks`, so it only sees documents that got past
`consume_document` (every `no_rule_match` and `sender_not_allowed` is invisible there),
and `#/admin/jobs` reads `job_runs`, which carries no tenant for these jobs.

The poll triggers live here rather than being called on `/api/v1/carmen/email-ingest/*`
(which would already accept an admin JWT) for two reasons: `middleware/maintenance.py`
allowlists the `/api/v1/admin` prefix only, so the carmen route 503s exactly when an
operator most needs it, and one prefix keeps the page's client uniform.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.config import settings
from app.database import get_db
from app.models.business import OCRTask
from app.models.email_automation import EmailDocument, EmailIngestSettings
from app.models.identity import Tenant
from app.models.observability import JobRun
from app.services import email_ingest_service as ingest
from app.services import email_settings_service as es
from app.services.tenant_lookup import tenant_name_map

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

# How long the browser waits for a poll before the endpoint answers "still running".
# `adminFetch` aborts at 30s while a full batch runs minutes, so the wait is bounded
# here instead of letting the request die in the client with the work still in flight.
POLL_WAIT_SECONDS = 25

# The window `email-confirm` itself uses — see `CONFIRM_WINDOW_HOURS` in the service.
AWAITING_WINDOW_HOURS = 24


@router.get("/email-ingest/documents")
async def list_email_documents(
    tenant_id: str | None = Query(None),
    status: str | None = Query(None, description="received|posted|failed|skipped"),
    reason_code: str | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """One row per (message, attachment) the pipeline reached a verdict on.

    `counts` is returned beside the rows because the first question about a BU's mail is
    almost never about one document — it is "how many of these failed, and all for the
    same reason?". It is computed over the same filters minus `status`, so selecting a
    status narrows the table without making the tallies lie about what else is there.
    """
    scope = tenant_id if admin.is_global else admin.tenant_scope

    def _filters(stmt, *, with_status: bool = True):
        if scope:
            stmt = stmt.where(EmailDocument.tenant_id == scope)
        if status and with_status:
            stmt = stmt.where(EmailDocument.status == status)
        if reason_code:
            stmt = stmt.where(EmailDocument.reason_code == reason_code)
        if from_date:
            stmt = stmt.where(EmailDocument.created_at >= from_date)
        if to_date:
            stmt = stmt.where(EmailDocument.created_at <= to_date)
        return stmt

    total = (
        await db.execute(_filters(select(func.count()).select_from(EmailDocument)))
    ).scalar_one()

    counts = {
        row.status: row.n
        for row in (
            await db.execute(
                _filters(
                    select(EmailDocument.status, func.count().label("n")), with_status=False
                ).group_by(EmailDocument.status)
            )
        ).all()
    }

    # Left join: a row that never reached `consume_document` has no task, and those are
    # precisely the rows this page exists to show.
    q = (
        _filters(select(EmailDocument, OCRTask.charged_docs, OCRTask.original_filename))
        .join(OCRTask, OCRTask.id == EmailDocument.task_id, isouter=True)
        .order_by(EmailDocument.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    names = await tenant_name_map(db, [r[0].tenant_id for r in rows])

    return {
        "total": total,
        "counts": counts,
        "data": [
            {
                "id": str(doc.id),
                "tenant_id": str(doc.tenant_id),
                "tenant_name": names.get(str(doc.tenant_id)),
                "message_id": doc.message_id,
                "attachment": doc.attachment,
                "status": doc.status,
                "reason_code": doc.reason_code,
                "bank_code": doc.bank_code,
                "doc_no": doc.doc_no,
                "jv_no": doc.jv_no,
                "error_message": doc.error_message,
                "task_id": str(doc.task_id) if doc.task_id else None,
                "charged_docs": charged,
                "original_filename": original,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc, charged, original in rows
        ],
    }


async def _cron_health(db: AsyncSession) -> dict | None:
    """Last run of each `email-*` pg_cron job, straight from pg_cron's own bookkeeping.

    Deliberately not `job_runs`: `_record_run` writes nothing for a poll that found no
    mail, so on that table a healthy quiet mailbox and a dead scheduler look identical.
    `cron.job_run_details` records every firing, which is the only source that separates
    the two. Returns None where pg_cron is absent (a plain Postgres, a test database) so
    the page can say "not scheduled" instead of erroring.
    """
    try:
        rows = (
            (
                await db.execute(
                    text(
                        "select j.jobname, j.schedule, j.active,"
                        " max(d.start_time) as last_run,"
                        " (array_agg(d.status order by d.start_time desc))[1] as last_status"
                        " from cron.job j left join cron.job_run_details d on d.jobid = j.jobid"
                        " where j.jobname like 'email%'"
                        " group by j.jobname, j.schedule, j.active"
                    )
                )
            )
            .mappings()
            .all()
        )
    except Exception as exc:  # noqa: BLE001 — absence of pg_cron is an answer, not a fault
        logger.info("[admin] pg_cron not readable: %s", exc)
        return None
    return {
        r["jobname"]: {
            "schedule": r["schedule"],
            "active": r["active"],
            "last_run": r["last_run"].isoformat() if r["last_run"] else None,
            "last_status": r["last_status"],
        }
        for r in rows
    }


@router.get("/email-ingest/health")
async def email_ingest_health(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Is the machine running? Mailbox, both schedules, and who is mid-setup."""
    jobs = {}
    for job_name in ("email-ingest", "email-confirm"):
        row = (
            await db.execute(
                select(JobRun)
                .where(JobRun.job_name == job_name)
                .order_by(JobRun.started_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        jobs[job_name] = (
            {
                "status": row.status.value if row.status else None,
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "rows_affected": row.rows_affected,
                "error_message": row.error_message,
            }
            if row
            else None
        )

    since = datetime.now(UTC) - timedelta(days=1)
    documents_24h = {
        row.status: row.n
        for row in (
            await db.execute(
                select(EmailDocument.status, func.count().label("n"))
                .where(EmailDocument.created_at >= since)
                .group_by(EmailDocument.status)
            )
        ).all()
    }

    return {
        # `job_runs` says what the last poll that found mail did; pg_cron says whether
        # the scheduler fired at all. The page needs both to tell quiet from dead.
        "cron": await _cron_health(db),
        "last_runs": jobs,
        "documents_24h": documents_24h,
        "awaiting_confirmation": len(
            await es.tags_awaiting_confirmation(db, AWAITING_WINDOW_HOURS)
        ),
        "mailbox": {
            "configured": bool(settings.imap_host),
            "folder": settings.imap_folder if settings.imap_host else None,
            "address": settings.email_ingest_address if settings.imap_host else None,
            "batch_size": settings.imap_batch_size,
        },
    }


@router.get("/email-ingest/business-units")
async def list_email_business_units(
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("configs", "write")),
):
    """Every BU that has configured email ingest, and how far each one got.

    Gated on `configs:write`, not on a read permission, because the row carries the
    ingest tag — and the tag IS the authority to write documents into that BU's ledger
    and spend its credits. `viewer` holds every `*:read`, so a read gate would hand that
    out. Same reasoning `PUT /carmen/settings` already applies to `ingest_address`.
    """
    rows = (
        await db.execute(
            select(EmailIngestSettings, Tenant)
            .join(Tenant, Tenant.id == EmailIngestSettings.tenant_id)
            .order_by(Tenant.bu_code)
        )
    ).all()

    # One grouped query rather than `document_counts` per tenant: that helper takes a
    # single settings row and would be N round trips here.
    totals = {
        str(r.tenant_id): (r.n, r.last)
        for r in (
            await db.execute(
                select(
                    EmailDocument.tenant_id,
                    func.count().label("n"),
                    func.max(EmailDocument.created_at).label("last"),
                ).group_by(EmailDocument.tenant_id)
            )
        ).all()
    }

    out = []
    for row, tenant in rows:
        body = es.to_response(row, tenant.host, tenant.bu_code)
        count, last = totals.get(str(row.tenant_id), (0, None))
        out.append(
            {
                "tenant_id": str(row.tenant_id),
                "tenant_name": f"{tenant.name} ({tenant.bu_code})",
                "host": tenant.host,
                "bu_code": tenant.bu_code,
                "enabled": bool(row.enabled),
                "ingest_tag": row.ingest_tag,
                "ingest_address": body["ingest_address"],
                "rules": len(body["rules"]),
                "active_rules": sum(1 for r in body["rules"] if r["is_active"]),
                "tax_ids": len(body["tax_ids"]),
                "owner_emails": len(body["owner_emails"]),
                "blockers": body["status"]["blockers"],
                "gmail_confirmed_at": body["gmail_confirmed_at"],
                "token": es.token_status(row),
                "documents_total": count,
                "last_received_at": last.isoformat() if last else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        )
    return {"total": len(out), "data": out}


@router.post("/email-ingest/poll")
async def poll_now(
    limit: int | None = Query(None, ge=1, le=100),
    _admin: AdminPrincipal = Depends(require_permission("configs", "write")),
):
    """Run one mailbox poll now instead of waiting up to ten minutes for the cron.

    Bounded wait, unbounded work: `asyncio.shield` keeps the poll running when the wait
    expires, because cancelling mid-document would abandon a charged credit and a
    half-posted JV. A slow batch therefore answers "running" and finishes in the
    background; the operator refreshes rather than being told it failed.
    """
    if not settings.imap_host:
        return {"status": "disabled", "reason": "IMAP not configured"}
    task = asyncio.create_task(ingest.run_ingest(limit))
    try:
        return await asyncio.wait_for(asyncio.shield(task), POLL_WAIT_SECONDS)
    except TimeoutError:
        logger.info("[admin] Poll still running after %ss — returning early", POLL_WAIT_SECONDS)
        return {"status": "running"}


@router.post("/email-ingest/confirmations")
async def sweep_confirmations_now(
    _admin: AdminPrincipal = Depends(require_permission("configs", "write")),
):
    """Follow any Gmail forwarding-confirmation link waiting in the mailbox.

    Costs nothing: it reads only mail from Google, opens no attachment and calls no
    model, which is why it is a separate button from the document poll.
    """
    return await ingest.sweep_confirmations()
