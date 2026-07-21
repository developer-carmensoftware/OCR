-- pg_cron scheduled jobs, pg_net HTTP callbacks, and SQL aggregate functions.
--
-- Class A jobs (pure SQL, no HTTP): daily-summary, daily-model-cost, monthly-summary,
--   session-purge, partman-maintain  →  run SQL functions directly from cron.
-- Class B jobs (need HTTP to app):   pricing-sync  →  pg_net call to /api/v1/admin/pricing/sync.
--
-- NOTE ON VAULT TOKEN:
--   After applying this migration, update the Vault secret with the real token:
--     select vault.update_secret(id, 'your-real-strong-token')
--     from vault.secrets where name = 'internal_job_token';
--   Generate token: python -c "import secrets; print(secrets.token_hex(32))"
--   Set the same value as INTERNAL_JOB_TOKEN in backend/.env
--
-- NOTE ON APP URL:
--   Set the real URL in system_configs:
--     update system_configs set value = '"https://your-app.onrender.com"'
--     where key_name = 'app.base_url';

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ── Vault: internal job token ─────────────────────────────────────────────────
-- Placeholder — MUST be replaced with a real token before pricing-sync fires.
-- The pg_net call presents this token as Bearer in Authorization header.
-- The backend verifies it via HMAC constant-time compare (settings.internal_job_token).
select vault.create_secret(
    'REPLACE_ME_BEFORE_ENABLING_PRICING_SYNC',
    'internal_job_token',
    'Bearer token presented by pg_net cron jobs when calling FastAPI maintenance endpoints'
);


-- ── System config: app base URL (read by pricing-sync cron job) ───────────────
insert into system_configs (key_name, value, value_type, category, description,
                             is_secret, requires_restart, created_at, updated_at)
values ('app.base_url', '""', 'string', 'system',
        'Public HTTPS URL of the FastAPI app — used by pg_net cron jobs (e.g. https://your-app.onrender.com)',
        false, false, now(), now())
on conflict (key_name) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- CLASS A: Pure SQL aggregate functions (no HTTP)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── fn_build_daily_summary ────────────────────────────────────────────────────
-- Ports summary_service.build_daily_summary() — one pass over all tenants × modules.
-- Called by pg_cron at 01:17 UTC daily; also still callable from Python admin backfill.
-- Type note: business tables (ocr_tasks, credit_cards, etc.) use UUID tenant_id;
-- log tables (llm_usage_logs, etc.) use VARCHAR(36). We cast UUID→VARCHAR(36).

create or replace function fn_build_daily_summary(
    target_date date default ((now() at time zone 'UTC')::date - 1)
)
returns int
language plpgsql
as $$
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
    if v_run_id is not null then
        update job_runs
           set status = 'failed'::jobstatus, completed_at = now(),
               error_message = sqlerrm, updated_at = now()
         where id = v_run_id;
    end if;
    raise;
end;
$$;


-- ── fn_build_daily_model_cost ─────────────────────────────────────────────────
-- Ports summary_service.build_daily_model_cost() — aggregate llm_usage_logs by
-- (tenant, module, model) → UPSERT daily_model_cost. Runs at 01:22 UTC daily.

create or replace function fn_build_daily_model_cost(
    target_date date default ((now() at time zone 'UTC')::date - 1)
)
returns int
language plpgsql
as $$
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
    if v_run_id is not null then
        update job_runs
           set status = 'failed'::jobstatus, completed_at = now(),
               error_message = sqlerrm, updated_at = now()
         where id = v_run_id;
    end if;
    raise;
end;
$$;


-- ── fn_build_monthly_summary ──────────────────────────────────────────────────
-- Ports summary_service.build_monthly_summary() — rolls up daily_usage_summary
-- for the calendar month of target_date. Runs at 01:32 UTC on the 1st of each month.
-- Re-aggregates the FULL month (idempotent — handles late-arriving daily rows).

create or replace function fn_build_monthly_summary(
    target_date date default ((now() at time zone 'UTC')::date - 1)
)
returns int
language plpgsql
as $$
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
    if v_run_id is not null then
        update job_runs
           set status = 'failed'::jobstatus, completed_at = now(),
               error_message = sqlerrm, updated_at = now()
         where id = v_run_id;
    end if;
    raise;
end;
$$;


-- ── fn_purge_inactive_sessions ────────────────────────────────────────────────
-- Ports retention_service.purge_inactive_sessions() — hard-deletes sessions
-- inactive for 30+ days. Runs hourly. Batched to avoid long locks.

create or replace function fn_purge_inactive_sessions()
returns int
language plpgsql
as $$
declare
    v_cutoff      timestamptz := now() - interval '30 days';
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
            where is_active = false and last_used_at < v_cutoff
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


-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron: schedule jobs
-- pg_cron uses cron expression in UTC; max ~8 concurrent jobs; each ≤10 min.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove any pre-existing schedules so re-applying this migration is idempotent.
select cron.unschedule(jobname) from cron.job where jobname in (
    'daily-summary', 'daily-model-cost', 'monthly-summary',
    'session-purge', 'partman-maintain', 'pricing-sync'
);

-- CLASS A: pure SQL
select cron.schedule('daily-summary',    '17 1 * * *',  $$select fn_build_daily_summary()$$);
select cron.schedule('daily-model-cost', '22 1 * * *',  $$select fn_build_daily_model_cost()$$);
select cron.schedule('monthly-summary',  '32 1 1 * *',  $$select fn_build_monthly_summary()$$);
select cron.schedule('session-purge',    '0 * * * *',   $$select fn_purge_inactive_sessions()$$);
select cron.schedule('partman-maintain', '23 2 * * *',  $$select partman.run_maintenance_proc()$$);

-- CLASS B: HTTP call to FastAPI via pg_net (needs the app URL + Vault token)
-- The cron expression runs every 8 hours to keep model_pricing up to date.
-- pg_net is async: net.http_post() returns a request_id immediately.
-- Check net._http_response for the outcome after the call completes.
select cron.schedule(
    'pricing-sync',
    '0 */8 * * *',
    $$
    select net.http_post(
        url     := (
            select trim(both '"' from value)
              from system_configs
             where key_name = 'app.base_url'
             limit 1
        ) || '/api/v1/admin/pricing/sync',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                  from vault.decrypted_secrets
                 where name = 'internal_job_token'
                 limit 1
            )
        ),
        body    := '{}'::jsonb
    );
    $$
);
