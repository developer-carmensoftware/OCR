-- Billing maintenance cron jobs (pure SQL, no HTTP — Class A, like cron_jobs.sql).
--   fn_cancel_expired_orders()        — hourly: cancel unpaid proformas past expires_at.
--   fn_lapse_expired_subscriptions()  — daily:  flip ended subscriptions to 'lapsed'.
-- Each writes a job_runs row, matching the existing aggregate jobs.

-- ── fn_cancel_expired_orders ──────────────────────────────────────────────────
-- Auto-cancel only 'pending' orders (status='pending' implies no slip uploaded —
-- a slip moves the order to 'awaiting_review', which is left for an admin).
-- Setting deleted_at mirrors the manual cancel_order() and frees the partial
-- unique open-order index so the tenant can place a new order.
create or replace function fn_cancel_expired_orders()
returns int
language plpgsql
as $$
declare
    v_rows   int;
    v_run_id bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('cancel-expired-orders', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    update credit_orders
       set status = 'cancelled', deleted_at = now(), updated_at = now()
     where status = 'pending'
       and expires_at is not null and expires_at < now()
       and deleted_at is null;

    get diagnostics v_rows = row_count;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_rows, updated_at = now()
     where id = v_run_id;

    return v_rows;

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


-- ── fn_lapse_expired_subscriptions ────────────────────────────────────────────
-- UI/admin correctness only — enforcement is the lazy `period_end > now()` check
-- in consume_document(). This just flips display status after the window ends.
create or replace function fn_lapse_expired_subscriptions()
returns int
language plpgsql
as $$
declare
    v_rows   int;
    v_run_id bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('lapse-subscriptions', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    update tenant_subscriptions
       set status = 'lapsed', updated_at = now()
     where status = 'active' and period_end <= now();

    get diagnostics v_rows = row_count;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_rows, updated_at = now()
     where id = v_run_id;

    return v_rows;

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


-- ── Schedule (UTC) — idempotent unschedule first ──────────────────────────────
select cron.unschedule(jobname) from cron.job where jobname in (
    'cancel-expired-orders', 'lapse-subscriptions'
);

select cron.schedule('cancel-expired-orders', '7 * * * *',  $$select fn_cancel_expired_orders()$$);
select cron.schedule('lapse-subscriptions',   '12 0 * * *', $$select fn_lapse_expired_subscriptions()$$);
