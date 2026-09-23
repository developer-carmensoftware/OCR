-- Retention for the email ledger, and the column that measures who really sent the mail.
--
-- ── Retention ──────────────────────────────────────────────────────────────────
-- email_documents had none: one row per (message, attachment) for ever, carrying the
-- arriving addresses (sender_not_allowed writes them into error_message), filenames that
-- can name people, and the reviewer's name. PDPA's storage-limitation principle wants an
-- end date on that, and so does the table's growth.
--
-- Deliberately NOT a soft delete, and an explicit exception to "business tables never
-- hard-delete": this is a processing ledger, not business data. Carmen is the system of
-- record for the JV; what we keep past 90 days is only enough to count and audit.
--
--   skipped          deleted at 90 days  — never charged, no JV, nothing to audit
--   everything else  scrubbed at 90 days, deleted at 2 years
--   pending_review   never touched       — charged and waiting on a human (capped at 50/BU)
--
-- Dedupe is unaffected: every window is far longer than IMAP_HOLD_DAYS (14), so a message
-- whose row is gone can no longer appear in any SEARCH and cannot be ingested twice.
--
-- `attachment` is scrubbed to 'scrubbed:<id>', not '': uq_email_documents_message is
-- (tenant_id, message_id, attachment), so two blanked rows of one message would collide.
--
-- Keyed on updated_at so a row approved late is not scrubbed the day after its decision.
-- No trigger maintains updated_at (the ORM's onupdate does), so this UPDATE does not move
-- it and the 2-year clock is not restarted by the scrub. coalesce() because the column is
-- nullable.
--
-- job_runs rides along at 90 days: #/admin/jobs reads recent health only, and a row is
-- written per poll that found mail.
create or replace function fn_purge_email_documents() returns void as $$
    delete from email_documents
     where status = 'skipped'
       and coalesce(updated_at, created_at) < now() - interval '90 days';

    update email_documents
       set review_payload   = null,
           reviewed_by      = null,
           reviewed_by_name = null,
           error_message    = null,
           attachment       = 'scrubbed:' || id::text
     where status <> 'pending_review'
       and coalesce(updated_at, created_at) < now() - interval '90 days'
       and attachment not like 'scrubbed:%';

    delete from email_documents
     where status <> 'pending_review'
       and coalesce(updated_at, created_at) < now() - interval '2 years';

    delete from job_runs
     where started_at < now() - interval '90 days';
$$ language sql;

select cron.unschedule(jobname) from cron.job where jobname = 'email-documents-purge';

-- 03:50 UTC — clear of cron-history-purge at 03:40.
select cron.schedule('email-documents-purge', '50 3 * * *',
    $$select fn_purge_email_documents()$$);


-- ── Sender authentication, measured ────────────────────────────────────────────
-- sender_allowed() reads From/To/Cc, which whoever composed the mail wrote. Before any
-- rule refuses mail on DMARC, we record what our own receiving MX concluded, for long
-- enough to see whether real auto-forwards pass. Nothing reads this for a decision yet.
alter table email_documents
    add column if not exists auth_verdict varchar(100);

comment on column email_documents.auth_verdict is
    'dmarc/dkim/spf verdicts from the topmost Authentication-Results header written by our '
    'own MX (mx.google.com), e.g. "dmarc=pass dkim=pass spf=softfail". NULL = no trusted '
    'header. Measurement only — no gate reads it.';
