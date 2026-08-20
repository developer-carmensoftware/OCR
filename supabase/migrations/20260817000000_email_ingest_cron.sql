-- Email Automation — the two schedules the feature has been missing since it was built.
--
-- Until now nothing called either endpoint: `cron.job` held no `email-*` row, so a
-- forwarded document sat unread until someone ran a poll by hand, and Gmail's forwarding
-- handshake — which only completes when we follow the link Google mails us — never
-- completed at all. A customer finished the setup in Gmail and the screen stayed on
-- "Awaiting verification" forever.
--
-- Two jobs, not one, because the work is not comparable:
--
--   email-confirm  every minute   search by sender, follow one link. No attachment is
--                                 parsed, no document charged, no model called, and the
--                                 mailbox is opened only while some BU is mid-setup
--                                 (`tags_awaiting_confirmation`). The customer is looking
--                                 at Gmail while this runs, so latency IS the feature.
--
--   email-ingest   every 10 min   attachments are processed serially, so one full
--                                 `imap_batch_size` batch costs roughly
--                                 batch × (one vision call + two Carmen posts) ≈ 3-5 min.
--                                 Five would routinely overlap on a small instance;
--                                 ten gives ~2,880 messages/day of headroom, well above
--                                 the ~300 that ~100 BUs of daily-commission mail produce.
--
-- Neither job writes a `job_runs` row when it finds nothing (see `_record_run`) —
-- job_runs has no retention and #/admin/jobs shows the newest 100 rows with no job-name
-- filter, so idle ticks at this cadence would bury every other job's history.
--
-- `value #>> '{}'`, never `trim(both '"' from value)` — that exact substitution silently
-- disabled every HTTP cron job on this project for months. See
-- 20260715010000_fix_cron_sql_bugs.sql.

-- ── Schedule (UTC) ──────────────────────────────────────────────────────────────
select cron.unschedule('email-confirm') from cron.job where jobname = 'email-confirm';

select cron.schedule('email-confirm', '* * * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/confirmations',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);

select cron.unschedule('email-ingest') from cron.job where jobname = 'email-ingest';

select cron.schedule('email-ingest', '*/10 * * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/run',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);

-- If cron.job_run_details stays empty after this is applied, pg_cron's launcher did not
-- reload — re-issue one cron.schedule from the SQL Editor. Recurring trap on this project.
