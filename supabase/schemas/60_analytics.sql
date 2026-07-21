-- Analytics: pre-aggregated summaries, anomaly alerts, job tracking.
-- These are plain tables (NOT partitioned) — small footprint, kept indefinitely.
-- Log tables (llm_usage_logs etc.) are partitioned; see migrations/20260615000001_*.sql

do $$ begin
    create type alertseverity as enum ('info', 'warn', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
    create type jobstatus as enum ('running', 'success', 'failed');
exception when duplicate_object then null; end $$;


create table if not exists daily_usage_summary (
    id                     serial         primary key,
    tenant_id              varchar(36)    not null,  -- VARCHAR(36) matches log table convention
    module_id              varchar(50),
    summary_date           date           not null,
    total_documents        integer        not null default 0,
    total_submissions      integer        not null default 0,
    total_llm_calls        integer        not null default 0,
    total_tokens           bigint         not null default 0,
    total_cost_usd         numeric(12, 4) not null default 0,
    avg_llm_latency_ms     float          not null default 0,
    total_api_calls        integer        not null default 0,
    avg_api_latency_ms     float          not null default 0,
    p95_api_latency_ms     float          not null default 0,
    total_errors           integer        not null default 0,
    total_corrections      integer        not null default 0,
    total_outbound_calls   integer        not null default 0,
    created_at             timestamptz    not null default now(),
    updated_at             timestamptz             default now(),
    constraint uq_summary_scope_module_date unique (tenant_id, module_id, summary_date)
);

create index if not exists ix_daily_usage_summary_tenant_id    on daily_usage_summary (tenant_id);
create index if not exists ix_daily_usage_summary_module_id    on daily_usage_summary (module_id);
create index if not exists ix_daily_usage_summary_date         on daily_usage_summary (summary_date);
create index if not exists ix_daily_usage_summary_created_at   on daily_usage_summary (created_at);


create table if not exists daily_model_cost (
    id           serial         primary key,
    summary_date date           not null,
    tenant_id    varchar(36)    not null,
    module_id    varchar(50),
    model_name   varchar(100)   not null,
    call_count   integer        not null default 0,
    input_tokens bigint         not null default 0,
    output_tokens bigint        not null default 0,
    cost_usd     numeric(12, 6) not null default 0,
    created_at   timestamptz    not null default now(),
    updated_at   timestamptz             default now(),
    constraint uq_daily_model_cost unique (summary_date, tenant_id, module_id, model_name)
);

create index if not exists ix_daily_model_cost_summary_date  on daily_model_cost (summary_date);
create index if not exists ix_daily_model_cost_tenant_id     on daily_model_cost (tenant_id);
create index if not exists ix_daily_model_cost_module_id     on daily_model_cost (module_id);
create index if not exists ix_daily_model_cost_created_at    on daily_model_cost (created_at);


create table if not exists monthly_usage_summary (
    id                   serial         primary key,
    tenant_id            varchar(36)    not null,
    module_id            varchar(50),
    summary_date         date           not null,  -- always YYYY-MM-01
    total_documents      integer        not null default 0,
    total_submissions    integer        not null default 0,
    total_llm_calls      integer        not null default 0,
    total_tokens         bigint         not null default 0,
    total_cost_usd       numeric(12, 4) not null default 0,
    avg_llm_latency_ms   float          not null default 0,
    total_api_calls      integer        not null default 0,
    avg_api_latency_ms   float          not null default 0,
    p95_api_latency_ms   float          not null default 0,
    total_errors         integer        not null default 0,
    total_corrections    integer        not null default 0,
    total_outbound_calls integer        not null default 0,
    created_at           timestamptz    not null default now(),
    updated_at           timestamptz             default now(),
    constraint uq_monthly_summary_scope unique (tenant_id, module_id, summary_date)
);

create index if not exists ix_monthly_usage_summary_tenant_id   on monthly_usage_summary (tenant_id);
create index if not exists ix_monthly_usage_summary_module_id   on monthly_usage_summary (module_id);
create index if not exists ix_monthly_usage_summary_date        on monthly_usage_summary (summary_date);
create index if not exists ix_monthly_usage_summary_created_at  on monthly_usage_summary (created_at);


-- Roadmap: anomaly detection dashboard. Not yet populated by runtime code.
create table if not exists anomaly_alerts (
    id          bigserial      primary key,
    tenant_id   varchar(36)    not null,
    module_id   varchar(50),
    metric      varchar(50)    not null,
    severity    alertseverity  not null default 'warn',
    threshold   numeric(14, 4),
    actual      numeric(14, 4),
    description text,
    resolved_at timestamptz,
    created_at  timestamptz    not null default now(),
    updated_at  timestamptz             default now()
);

create index if not exists ix_anomaly_alerts_tenant_id   on anomaly_alerts (tenant_id);
create index if not exists ix_anomaly_alerts_module_id   on anomaly_alerts (module_id);
create index if not exists ix_anomaly_alerts_metric      on anomaly_alerts (metric);
create index if not exists ix_anomaly_alerts_created_at  on anomaly_alerts (created_at);


-- Background job execution tracking (used by pg_cron jobs to record outcomes).
create table if not exists job_runs (
    id            bigserial   primary key,
    job_name      varchar(50) not null,
    tenant_id     varchar(36),  -- NULL for cluster-wide jobs (pricing-sync)
    status        jobstatus   not null default 'running',
    started_at    timestamptz not null,
    completed_at  timestamptz,
    rows_affected integer,
    error_message text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz          default now()
);

create index if not exists ix_job_runs_job_name    on job_runs (job_name);
create index if not exists ix_job_runs_tenant_id   on job_runs (tenant_id);
create index if not exists ix_job_runs_started_at  on job_runs (started_at);
create index if not exists ix_job_runs_created_at  on job_runs (created_at);
