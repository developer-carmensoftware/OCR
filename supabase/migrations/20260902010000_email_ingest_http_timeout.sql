-- Email ingest — give the poll longer than pg_net's default five seconds to answer.
--
-- `net.http_post`'s `timeout_milliseconds` defaults to 5000. A poll of a full
-- `imap_batch_size` runs one vision call and two Carmen posts per attachment — minutes,
-- not seconds — so EVERY ingest tick was landing in `net._http_response` as
-- "Timeout of 5000 ms reached" and the summary the endpoint returns was discarded.
--
-- The poll itself still ran to completion server-side (its `job_runs` row proves it), so
-- this was never lost mail on its own. What it cost was the answer: nothing on
-- #/admin/email or in `net._http_response` could say what a poll did, and a real failure
-- read exactly like the timeout every healthy tick already produced.
--
-- 540 s, not "as long as it takes": the schedule is every 10 minutes and `run_ingest`
-- skips a tick that finds the previous poll still running, so a request outliving its own
-- interval has nothing left to report to. `email-confirm` keeps the default — it searches
-- by sender, parses no attachment, and answers in well under a second.
--
-- `value #>> '{}'`, never `trim(both '"' from value)` — see 20260715010000.

select cron.unschedule('email-ingest') from cron.job where jobname = 'email-ingest';

select cron.schedule('email-ingest', '*/10 * * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/run',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 540000);
$$);

-- If cron.job_run_details stays empty after this is applied, pg_cron's launcher did not
-- reload — re-issue one cron.schedule from the SQL Editor. Recurring trap on this project.
