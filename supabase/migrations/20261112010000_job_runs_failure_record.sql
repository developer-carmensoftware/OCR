-- A cron function that fails leaves no trace on #/admin/jobs.
--
-- Each of these functions inserts a `running` row into job_runs, does its work, and in
-- `exception when others` updates that row to `failed` and re-raises. But the whole function is one
-- statement, so the re-raise rolls everything back, including the `running` row and the UPDATE. The
-- only record of a failure was cron.job_run_details, which nobody reads. None of the six has failed in
-- production yet, which is why nobody noticed.
--
-- Fix, handler only (every other line of each body is copied from its latest definition): the handler
-- now inserts a fresh `failed` row with the error text, raises a WARNING for the Postgres log, and
-- RETURNS -1 instead of re-raising. The statement then commits, so the row survives.
--
-- Cost, stated: pg_cron now records these runs as `succeeded`, because the function returned. The
-- failure shows on #/admin/jobs (job_runs), which is the page support reads, with -1 as the return value
-- in cron.job_run_details. If you would rather keep the cron failure too, the alternative is dblink
-- or an external recorder; neither is installed here.
--
-- Not in the list: fn_cancel_expired_orders (dropped by 20260701071021, replaced by
-- fn_hold_expired_orders), and fn_purge_email_documents / fn_scrub_old_filenames /
-- fn_purge_cron_history, which never insert into job_runs.
--
-- Tested by supabase/tests/database/job_runs_failure.test.sql, which makes each function fail.

CREATE OR REPLACE FUNCTION public.fn_build_daily_model_cost(target_date date DEFAULT (((now() AT TIME ZONE 'UTC'::text))::date - 1))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
    v_day_start  timestamptz := (target_date || 'T00:00:00Z')::timestamptz;
    v_day_end    timestamptz := v_day_start + interval '1 day';
    v_rows       int;
    v_run_id     bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('daily-model-cost', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    insert into daily_model_cost (
        summary_date, tenant_id, module_id, model_name,
        call_count, input_tokens, output_tokens, cost_usd,
        created_at, updated_at
    )
    select
        target_date,
        tenant_id,
        module_id,
        model                               as model_name,
        count(*)                            as call_count,
        coalesce(sum(prompt_tokens),     0) as input_tokens,
        coalesce(sum(completion_tokens), 0) as output_tokens,
        coalesce(sum(cost_usd),          0) as cost_usd,
        now(),
        now()
    from llm_usage_logs
    where created_at >= v_day_start and created_at < v_day_end
      and tenant_id is not null
    group by tenant_id, module_id, model
    on conflict on constraint uq_daily_model_cost do update set
        call_count    = excluded.call_count,
        input_tokens  = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        cost_usd      = excluded.cost_usd,
        updated_at    = now();

    get diagnostics v_rows = row_count;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_rows, updated_at = now()
     where id = v_run_id;

    return v_rows;

exception when others then
    -- The work above rolled back, and so did the 'running' row inserted with it; re-raising
    -- would roll this back too. So write a fresh 'failed' row and return -1.
    insert into job_runs (job_name, status, started_at, completed_at, error_message, created_at, updated_at)
    values ('daily-model-cost', 'failed'::jobstatus, now(), now(), sqlerrm, now(), now());
    raise warning 'daily-model-cost failed: %', sqlerrm;
    return -1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_build_daily_summary(target_date date DEFAULT (((now() AT TIME ZONE 'UTC'::text))::date - 1))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
    v_day_start  timestamptz := (target_date || 'T00:00:00Z')::timestamptz;
    v_day_end    timestamptz := v_day_start + interval '1 day';
    v_rows       int;
    v_run_id     bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('daily-summary', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    insert into daily_usage_summary (
        tenant_id, module_id, summary_date,
        total_documents, total_submissions, total_llm_calls,
        total_tokens, total_cost_usd, avg_llm_latency_ms,
        total_api_calls, avg_api_latency_ms, p95_api_latency_ms,
        total_errors, total_corrections, total_outbound_calls,
        created_at, updated_at
    )
    with
    -- Documents uploaded per tenant × module
    docs as (
        select tenant_id::varchar(36) as tenant_id, module_id,
               count(*) as cnt
        from ocr_tasks
        where created_at >= v_day_start and created_at < v_day_end
          and deleted_at is null
        group by 1, 2
    ),
    -- Submissions: credit card + AP invoice (separate queries, then unioned)
    subs as (
        select t.tenant_id::varchar(36) as tenant_id,
               'credit_card_ocr' as module_id, count(*) as cnt
        from credit_cards c
        join ocr_tasks t on t.id = c.task_id
        where c.submitted_at >= v_day_start and c.submitted_at < v_day_end
          and c.deleted_at is null
        group by 1
        union all
        select t.tenant_id::varchar(36) as tenant_id,
               'ap_invoice' as module_id, count(*) as cnt
        from ap_invoices a
        join ocr_tasks t on t.id = a.task_id
        where a.submitted_at >= v_day_start and a.submitted_at < v_day_end
          and a.deleted_at is null
        group by 1
    ),
    -- LLM usage (tenant_id already VARCHAR(36) in log tables)
    llm as (
        select tenant_id, module_id,
               count(*)                       as total_llm_calls,
               coalesce(sum(total_tokens), 0) as total_tokens,
               coalesce(sum(cost_usd),     0) as total_cost_usd,
               coalesce(avg(duration_ms),  0) as avg_llm_latency_ms
        from llm_usage_logs
        where created_at >= v_day_start and created_at < v_day_end
        group by 1, 2
    ),
    -- API performance — tenant-level only (same metrics shared across modules)
    perf as (
        select tenant_id,
               count(*)                                                         as total_api_calls,
               coalesce(avg(duration_ms), 0)                                    as avg_api_latency_ms,
               coalesce(sum(case when status_code >= 500 then 1 else 0 end), 0) as total_errors
        from performance_logs
        where created_at >= v_day_start and created_at < v_day_end
        group by 1
    ),
    -- P95 latency — tenant-level using PERCENT_RANK window function
    p95 as (
        select tenant_id, min(duration_ms) as p95_ms
        from (
            select tenant_id, duration_ms,
                   percent_rank() over (partition by tenant_id order by duration_ms) as pct_rank
            from performance_logs
            where created_at >= v_day_start and created_at < v_day_end
        ) ranked
        where pct_rank >= 0.95
        group by 1
    ),
    -- Corrections (UUID → VARCHAR(36) cast)
    corr as (
        select tenant_id::varchar(36) as tenant_id, count(*) as cnt
        from correction_feedback
        where created_at >= v_day_start and created_at < v_day_end
          and deleted_at is null
        group by 1
    ),
    -- Outbound calls (VARCHAR(36) already)
    outb as (
        select tenant_id, count(*) as cnt
        from outbound_call_logs
        where created_at >= v_day_start and created_at < v_day_end
        group by 1
    ),
    -- Union of all active (tenant, module) pairs — deduplicates automatically
    all_keys as (
        select tenant_id, module_id from docs
        union
        select tenant_id, module_id from llm
    )
    select
        k.tenant_id,
        k.module_id,
        target_date,
        coalesce(d.cnt, 0),
        coalesce(s.cnt, 0),
        coalesce(l.total_llm_calls, 0),
        coalesce(l.total_tokens, 0)::bigint,
        coalesce(l.total_cost_usd, 0),
        coalesce(l.avg_llm_latency_ms, 0),
        coalesce(p.total_api_calls, 0),
        coalesce(p.avg_api_latency_ms, 0),
        coalesce(x.p95_ms, 0),
        coalesce(p.total_errors, 0),
        coalesce(c.cnt, 0),
        coalesce(o.cnt, 0),
        now(),
        now()
    from all_keys k
    left join docs d on d.tenant_id = k.tenant_id and d.module_id = k.module_id
    left join subs s on s.tenant_id = k.tenant_id and s.module_id = k.module_id
    left join llm  l on l.tenant_id = k.tenant_id and l.module_id = k.module_id
    left join perf p on p.tenant_id = k.tenant_id
    left join p95  x on x.tenant_id = k.tenant_id
    left join corr c on c.tenant_id = k.tenant_id
    left join outb o on o.tenant_id = k.tenant_id
    where k.tenant_id is not null
    on conflict on constraint uq_summary_scope_module_date do update set
        total_documents      = excluded.total_documents,
        total_submissions    = excluded.total_submissions,
        total_llm_calls      = excluded.total_llm_calls,
        total_tokens         = excluded.total_tokens,
        total_cost_usd       = excluded.total_cost_usd,
        avg_llm_latency_ms   = excluded.avg_llm_latency_ms,
        total_api_calls      = excluded.total_api_calls,
        avg_api_latency_ms   = excluded.avg_api_latency_ms,
        p95_api_latency_ms   = excluded.p95_api_latency_ms,
        total_errors         = excluded.total_errors,
        total_corrections    = excluded.total_corrections,
        total_outbound_calls = excluded.total_outbound_calls,
        updated_at           = now();

    get diagnostics v_rows = row_count;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_rows, updated_at = now()
     where id = v_run_id;

    return v_rows;

exception when others then
    -- The work above rolled back, and so did the 'running' row inserted with it; re-raising
    -- would roll this back too. So write a fresh 'failed' row and return -1.
    insert into job_runs (job_name, status, started_at, completed_at, error_message, created_at, updated_at)
    values ('daily-summary', 'failed'::jobstatus, now(), now(), sqlerrm, now(), now());
    raise warning 'daily-summary failed: %', sqlerrm;
    return -1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_build_monthly_summary(target_date date DEFAULT (((now() AT TIME ZONE 'UTC'::text))::date - 1))
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
    v_month_start      date := date_trunc('month', target_date)::date;
    v_next_month_start date := (date_trunc('month', target_date) + interval '1 month')::date;
    v_rows             int;
    v_run_id           bigint;
begin
    insert into job_runs (job_name, status, started_at, created_at, updated_at)
    values ('monthly-summary', 'running'::jobstatus, now(), now(), now())
    returning id into v_run_id;

    insert into monthly_usage_summary (
        tenant_id, module_id, summary_date,
        total_documents, total_submissions, total_llm_calls,
        total_tokens, total_cost_usd, avg_llm_latency_ms,
        total_api_calls, avg_api_latency_ms, p95_api_latency_ms,
        total_errors, total_corrections, total_outbound_calls,
        created_at, updated_at
    )
    select
        tenant_id,
        module_id,
        v_month_start,
        coalesce(sum(total_documents),      0),
        coalesce(sum(total_submissions),    0),
        coalesce(sum(total_llm_calls),      0),
        coalesce(sum(total_tokens),         0)::bigint,
        coalesce(sum(total_cost_usd),       0),
        coalesce(avg(avg_llm_latency_ms),   0),
        coalesce(sum(total_api_calls),      0),
        coalesce(avg(avg_api_latency_ms),   0),
        coalesce(max(p95_api_latency_ms),   0),
        coalesce(sum(total_errors),         0),
        coalesce(sum(total_corrections),    0),
        coalesce(sum(total_outbound_calls), 0),
        now(),
        now()
    from daily_usage_summary
    where summary_date >= v_month_start and summary_date < v_next_month_start
    group by tenant_id, module_id
    on conflict on constraint uq_monthly_summary_scope do update set
        total_documents      = excluded.total_documents,
        total_submissions    = excluded.total_submissions,
        total_llm_calls      = excluded.total_llm_calls,
        total_tokens         = excluded.total_tokens,
        total_cost_usd       = excluded.total_cost_usd,
        avg_llm_latency_ms   = excluded.avg_llm_latency_ms,
        total_api_calls      = excluded.total_api_calls,
        avg_api_latency_ms   = excluded.avg_api_latency_ms,
        p95_api_latency_ms   = excluded.p95_api_latency_ms,
        total_errors         = excluded.total_errors,
        total_corrections    = excluded.total_corrections,
        total_outbound_calls = excluded.total_outbound_calls,
        updated_at           = now();

    get diagnostics v_rows = row_count;

    update job_runs
       set status = 'success'::jobstatus, completed_at = now(),
           rows_affected = v_rows, updated_at = now()
     where id = v_run_id;

    return v_rows;

exception when others then
    -- The work above rolled back, and so did the 'running' row inserted with it; re-raising
    -- would roll this back too. So write a fresh 'failed' row and return -1.
    insert into job_runs (job_name, status, started_at, completed_at, error_message, created_at, updated_at)
    values ('monthly-summary', 'failed'::jobstatus, now(), now(), sqlerrm, now(), now());
    raise warning 'monthly-summary failed: %', sqlerrm;
    return -1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_hold_expired_orders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
    -- The work above rolled back, and so did the 'running' row inserted with it; re-raising
    -- would roll this back too. So write a fresh 'failed' row and return -1.
    insert into job_runs (job_name, status, started_at, completed_at, error_message, created_at, updated_at)
    values ('hold-expired-orders', 'failed'::jobstatus, now(), now(), sqlerrm, now(), now());
    raise warning 'hold-expired-orders failed: %', sqlerrm;
    return -1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_lapse_expired_subscriptions()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$

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
    -- The work above rolled back, and so did the 'running' row inserted with it; re-raising
    -- would roll this back too. So write a fresh 'failed' row and return -1.
    insert into job_runs (job_name, status, started_at, completed_at, error_message, created_at, updated_at)
    values ('lapse-subscriptions', 'failed'::jobstatus, now(), now(), sqlerrm, now(), now());
    raise warning 'lapse-subscriptions failed: %', sqlerrm;
    return -1;
end;

$function$;

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
    -- The work above rolled back, and so did the 'running' row inserted with it; re-raising
    -- would roll this back too. So write a fresh 'failed' row and return -1.
    insert into job_runs (job_name, status, started_at, completed_at, error_message, created_at, updated_at)
    values ('session-purge', 'failed'::jobstatus, now(), now(), sqlerrm, now(), now());
    raise warning 'session-purge failed: %', sqlerrm;
    return -1;
end;
$$;
