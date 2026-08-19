-- session-purge: scrub at the JWT's lifetime, not at 1h — and run it nightly, not hourly.
--
-- 20260721120000 scrubbed every session with `created_at < now() - 1 hour` and flipped
-- `is_active = false`. That cutoff was chosen when SESSION_TTL_HOURS was the 0.5h code
-- default ("2x the JWT TTL"). Production runs 8h (render.yaml), so the job became the
-- binding clock: an actively-working user was logged out 60–120 minutes after login, at
-- the top of an hour, everyone at once — `auth/dependencies.get_current_session` 401s on
-- `not is_active`, and the frontend turns any 401 into a kick back to Carmen SSO. The
-- 5-minute expiry warning reads the JWT `exp`, so it would have fired at minute 475 and
-- nobody ever saw it.
--
-- The scrub exists to stop the Fernet-encrypted Carmen token outliving the session it
-- belongs to. `created_at + SESSION_TTL_HOURS` is exactly when the fixed-exp JWT dies —
-- the tightest cutoff that can never touch a session still in use. Not last_used_at:
-- the JWT has no refresh, so an idle-based cutoff would only keep dead-JWT rows longer.
--
-- KEEP IN SYNC: this interval must equal SESSION_TTL_HOURS (render.yaml). Deliberately
-- not read from system_configs — the app reads the env var, so a DB lookup would add a
-- second source of truth rather than remove one.
--
-- Stage 2 (the 90-day row delete) is unchanged and never needed hourly.

create or replace function fn_purge_inactive_sessions()
returns int
language plpgsql
as $$
declare
    v_scrub_cutoff  timestamptz := now() - interval '8 hours';   -- == SESSION_TTL_HOURS
    v_delete_cutoff timestamptz := now() - interval '90 days';
    v_batch         int;
    v_scrubbed      int := 0;
    v_deleted       int := 0;
    v_run_id        bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('session-purge', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    -- Stage 1: kill the credential, keep the history. is_active=false stays part of the
    -- scrub: _resolve_session_token decrypts the token before it could notice a blanked
    -- one, so a scrubbed-but-active row would 500 instead of 401.
    loop
        update ocr_sessions
           set carmen_token_encrypted = '',
               carmen_uri             = null,
               is_active              = false,
               updated_at             = now()
         where id in (
             select id from ocr_sessions
             where created_at < v_scrub_cutoff
               and (is_active or carmen_token_encrypted <> '')
             limit 5000
         );
        get diagnostics v_batch = row_count;
        v_scrubbed := v_scrubbed + v_batch;
        exit when v_batch < 5000;
    end loop;

    -- Stage 2: the row itself expires eventually.
    loop
        delete from ocr_sessions
        where id in (
            select id from ocr_sessions
            where created_at < v_delete_cutoff
            limit 5000
        );
        get diagnostics v_batch = row_count;
        v_deleted := v_deleted + v_batch;
        exit when v_batch < 5000;
    end loop;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_scrubbed + v_deleted, updated_at = now()
     where id = v_run_id;

    return v_scrubbed + v_deleted;

exception when others then
    if v_run_id is not null then
        update job_runs
           set status = 'failed'::jobstatus, completed_at = now(),
               error_message = sqlerrm, updated_at = now()
         where id = v_run_id;
    end if;
    raise;
end;
$$;

-- pg_cron runs in UTC on Supabase. '0 2 * * *' would land at 09:00 ICT — peak hours.
-- 19:00 UTC = 02:00 ICT the next day.
select cron.unschedule('session-purge') from cron.job where jobname = 'session-purge';
select cron.schedule('session-purge', '0 19 * * *', $$select fn_purge_inactive_sessions()$$);

-- If job_run_details stays empty after the first 19:00 UTC, pg_cron's launcher never
-- reloaded — re-issue one cron.schedule from the SQL Editor. Recurring trap on this project.
