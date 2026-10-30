-- The ingest mailbox keeps mail for the hold window and no longer (decision-log #50).
--
-- `imap.mark_done` only ever flagged mail, so every bank statement and attachment that
-- reached the mailbox stayed there for good. POST /api/v1/carmen/email-ingest/purge moves
-- whatever arrived before the hold window's floor (`IMAP_HOLD_DAYS`, 14) to the Trash —
-- exactly the mail no poll can search any more, processed or not. Gmail empties the Trash
-- after 30 days. Run it with `?dry_run=true` by hand first in a new environment: it answers
-- the count and moves nothing.
--
-- 04:00 UTC (11:00 ICT) — clear of email-documents-purge (03:50) and every other job; the
-- poll can run alongside it, since the two never select the same message.

select cron.unschedule('email-mailbox-purge') from cron.job where jobname = 'email-mailbox-purge';

select cron.schedule('email-mailbox-purge', '0 4 * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/purge',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);

-- If cron.job_run_details stays empty after this is applied, pg_cron's launcher did not
-- reload — re-issue one cron.schedule from the SQL Editor. Recurring trap on this project.
