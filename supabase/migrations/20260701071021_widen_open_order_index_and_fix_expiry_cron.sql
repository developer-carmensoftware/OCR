-- Follow-up to 20260701070739 (which re-added the 'on_hold' enum value).

-- 1. A held order is still "open" (blocks a second order, still resumable by
-- the tenant), so widen the partial unique index to include it — mirrors
-- 20260622030100_order_on_hold_open_index.sql from on_hold's first pass.
drop index if exists uq_credit_orders_one_open_per_tenant;
create unique index uq_credit_orders_one_open_per_tenant
    on credit_orders (tenant_id)
    where status in ('in_progress', 'on_hold') and deleted_at is null;

-- 2. fn_cancel_expired_orders() (20260619000001_billing_cron.sql) has been
-- broken since the 4-status collapse (20260623000200_credit_order_status_v2.sql):
-- it still reads/writes the old 'pending'/'cancelled' enum labels, which no
-- longer exist on creditorderstatus, so every hourly pg_cron run has been
-- raising "invalid input value for enum" and recording a failed job_runs row.
--
-- Fix it and repurpose it for the on_hold workflow in the same step: instead
-- of cancelling an expired order outright, park it on_hold so the quota admin
-- can contact the buyer before approving or voiding. Renamed (function + cron
-- job) since "cancel" no longer describes what it does.
drop function if exists fn_cancel_expired_orders();

create function fn_hold_expired_orders()
returns int
language plpgsql
as $$
declare
    v_rows   int;
    v_run_id bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('hold-expired-orders', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    update credit_orders
       set status = 'on_hold', updated_at = now()
     where status = 'in_progress'
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

select cron.unschedule(jobname) from cron.job where jobname in ('cancel-expired-orders');
select cron.schedule('hold-expired-orders', '7 * * * *', $$select fn_hold_expired_orders()$$);
