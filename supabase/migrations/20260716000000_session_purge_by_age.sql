-- session-purge: delete sessions by age, not by is_active.
--
-- The original predicate (`is_active = false and last_used_at < cutoff`) never
-- fires for the common case. `is_active` only flips to false on an explicit
-- logout or a Carmen 401 (carmen_service.py) — a user who just closes the tab
-- leaves the row `is_active = true` forever, so the purge never touches it and
-- the Fernet-encrypted Carmen token sits in the DB indefinitely. Observed on
-- dev: 41 live rows, oldest 16 days, zero inactive.
--
-- The session JWT already expires at `session_ttl_hours` (0.5h) — see
-- create_session_jwt in app/auth/session.py — so any row older than that is
-- unusable regardless of its is_active flag. Purge on age and the token stops
-- outliving the session it belongs to. The 1h window is 2x the JWT TTL: wide
-- enough to never race a live session, tight enough to keep tokens short-lived.
--
-- Function name kept as-is: cron.schedule('session-purge', ...) calls it by name.

create or replace function fn_purge_inactive_sessions()
returns int
language plpgsql
as $$
declare
    v_cutoff      timestamptz := now() - interval '1 hour';
    v_batch       int;
    v_total       int := 0;
    v_run_id      bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('session-purge', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    loop
        delete from ocr_sessions
        where id in (
            select id from ocr_sessions
            where created_at < v_cutoff
            limit 5000
        );
        get diagnostics v_batch = row_count;
        v_total := v_total + v_batch;
        exit when v_batch < 5000;
    end loop;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_total, updated_at = now()
     where id = v_run_id;

    return v_total;

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
