-- session-purge: scrub the credential at 1h, keep the row as login history, delete at 90d.
--
-- 20260716000000 made this job delete every session older than 1 hour. That was the right
-- fix for the stated problem — the Fernet-encrypted Carmen token must not outlive the 0.5h
-- session JWT — but deleting the whole row was collateral damage:
--
--   * ocr_sessions is the ONLY table that stores `username` next to `carmen_user_id`.
--     ocr_tasks and llm_usage_logs carry the opaque carmen_user_id alone, so once the
--     session row is gone there is no way to render any per-user report as anything but
--     a bare UUID. The #/admin/user-usage page depends on this mapping.
--   * #/admin/sessions could only ever show the last hour of logins, which is why every
--     tenant looked like it had no user activity at all.
--
-- An UPDATE that blanks the token satisfies the security requirement at the identical
-- moment the DELETE did. Verified safe: app/auth/dependencies.py rejects on `not
-- row.is_active` BEFORE it reads or decrypts carmen_token_encrypted, so a scrubbed row
-- can never authenticate — it is inert data, not a credential.
--
-- carmen_token_encrypted is NOT NULL (schemas/50_business.sql), hence '' rather than null.
--
-- DO NOT "restore" the 1-hour delete. If tokens ever need to die sooner, shorten stage 1;
-- the retention of the scrubbed row is a separate concern from the life of the secret.
--
-- Function name kept as-is: cron.schedule('session-purge', ...) calls it by name.

create or replace function fn_purge_inactive_sessions()
returns int
language plpgsql
as $$
declare
    v_scrub_cutoff  timestamptz := now() - interval '1 hour';   -- 2x the 0.5h JWT TTL
    v_delete_cutoff timestamptz := now() - interval '90 days';
    v_batch         int;
    v_scrubbed      int := 0;
    v_deleted       int := 0;
    v_run_id        bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('session-purge', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    -- Stage 1: kill the credential, keep the history.
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

-- Stage 1 scans by created_at and re-checks the scrubbed predicate; without this the
-- hourly job re-reads every retained row for 90 days.
create index if not exists ix_ocr_sessions_scrub_pending
    on ocr_sessions (created_at)
    where is_active or carmen_token_encrypted <> '';
