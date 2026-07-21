-- Extend fn_hold_expired_orders() to:
--   1. emit on_hold notification for each newly-parked order
--   2. emit missing_slip notification once per order (7+ days in_progress, no slip)
--   3. purge user_notifications older than 30 days
-- Never touch cron.schedule — job is already scheduled '7 * * * *' (migration 20260701071021).

create or replace function fn_hold_expired_orders()
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

    -- 1. Park expired orders and capture which ones changed.
    with parked as (
        update credit_orders
           set status = 'on_hold', updated_at = now()
         where status = 'in_progress'
           and expires_at is not null and expires_at < now()
           and deleted_at is null
        returning id, tenant_id
    )
    insert into user_notifications (tenant_id, order_id, type, payload, created_at)
    select tenant_id, id, 'on_hold', '{}', now()
    from parked;

    get diagnostics v_rows = row_count;

    -- 2. One-time missing_slip nudge: in_progress, no slip, older than 7 days.
    insert into user_notifications (tenant_id, order_id, type, payload, created_at)
    select o.tenant_id, o.id, 'missing_slip', '{}', now()
    from credit_orders o
    where o.status = 'in_progress'
      and o.slip_object_key is null
      and o.created_at < now() - interval '7 days'
      and o.deleted_at is null
      and not exists (
          select 1 from user_notifications n
           where n.order_id = o.id
             and n.type = 'missing_slip'
      );

    -- 3. 30-day purge.
    delete from user_notifications
     where created_at < now() - interval '30 days';

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
