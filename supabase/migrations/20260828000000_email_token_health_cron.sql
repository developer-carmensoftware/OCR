-- Email Automation — schedule the credential check that has existed, unscheduled, since
-- the feature was built (`20260817000000_email_ingest_cron.sql` scheduled the other two).
--
-- On 2026-08-28 one BU's Carmen posting token died between two polls. Nothing noticed:
-- three documents were extracted, charged, and refused by Carmen at the HTTP layer, and
-- the first report of the outage was a customer asking why their JVs were "rejected".
-- `sweep_token_health` re-proves every stored credential with one authenticated GET and
-- clears `verified_at` on the ones that fail — it just needed a caller.
--
-- 02:15 UTC = 09:15 ICT: before the working day, after the overnight commission mail has
-- been ingested, so a token that died during the night is flagged before anyone tries to
-- use it. Cheap and bounded — one GET per BU with the feature enabled, no model call, no
-- document charged.
--
-- `value #>> '{}'`, never `trim(both '"' from value)` — that exact substitution silently
-- disabled every HTTP cron job on this project for months. See
-- 20260715010000_fix_cron_sql_bugs.sql.

select cron.unschedule('email-token-health') from cron.job where jobname = 'email-token-health';

select cron.schedule('email-token-health', '15 2 * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/health',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);

-- If cron.job_run_details stays empty after this is applied, pg_cron's launcher did not
-- reload — re-issue the cron.schedule above from the SQL Editor. Recurring trap on this project.
