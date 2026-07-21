-- Partition the 4 high-volume append-only log tables by month (RANGE on created_at).
-- Uses pg_partman for automated partition creation + retention drop.
--
-- Key constraint: in a PARTITIONED table, the partition key must be part of EVERY unique
-- index / primary key. So PKs become (id, created_at). The app never looks up a log row
-- by bare id (logs are insert-only and queried by range) — safe change.
--
-- Retention policy:
--   llm_usage_logs, performance_logs, outbound_call_logs: 12 months (raw data
--     preserved in daily_model_cost / daily_usage_summary indefinitely).
--   audit_logs: 24 months (compliance requirement).
--
-- pg_partman runs its maintenance proc (partition pre-creation + retention drop)
-- nightly via a pg_cron job installed in 20260615000004_cron_jobs.sql.
--
-- IMPORTANT: These tables are NOT in supabase/schemas/ because declarative schema
-- cannot express PARTITION BY. They live exclusively in this migration.

-- pg_partman requires its target schema to exist before CREATE EXTENSION.
create schema if not exists partman;
create extension if not exists pg_partman with schema partman;


-- ── llm_usage_logs ────────────────────────────────────────────────────────────
-- One row per LLM API call. High-write (every extract). Aggregate → daily_model_cost.

create table llm_usage_logs (
    id                bigint      generated always as identity,
    created_at        timestamptz not null default now(),  -- partition key
    tenant_id         varchar(36) not null,
    task_id           varchar(36),
    module_id         varchar(50),
    carmen_session_id varchar(36),
    carmen_user_id    varchar(36),
    model             varchar(100) not null,
    prompt_tokens     integer      not null default 0,
    completion_tokens integer      not null default 0,
    total_tokens      integer      not null default 0,
    duration_ms       float,
    cost_usd          numeric(10, 6),
    updated_at        timestamptz           default now(),
    primary key (id, created_at)
) partition by range (created_at);

-- Composite indexes on the parent propagate to all partitions automatically.
-- Drop the now-redundant standalone tenant_id index (covered by the composite below).
create index ix_llm_usage_logs_tenant_created        on llm_usage_logs (tenant_id, created_at);
create index ix_llm_usage_logs_tenant_module_created on llm_usage_logs (tenant_id, module_id, created_at);
create index ix_llm_usage_logs_task_id               on llm_usage_logs (task_id);
create index ix_llm_usage_logs_module_id             on llm_usage_logs (module_id);
create index ix_llm_usage_logs_carmen_session        on llm_usage_logs (carmen_session_id);
create index ix_llm_usage_logs_carmen_user           on llm_usage_logs (carmen_user_id);

select partman.create_parent(
    p_parent_table   := 'public.llm_usage_logs',
    p_control        := 'created_at',
    p_interval       := '1 month',
    p_premake        := 2          -- pre-create 2 future partitions
);
update partman.part_config
   set retention             = '12 months',
       retention_keep_table  = false,    -- DROP, not just detach
       infinite_time_partitions = true   -- allow past partitions beyond premake
 where parent_table = 'public.llm_usage_logs';


-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Compliance event log. Every user action + admin action. 24-month retention.

create table audit_logs (
    id             bigint      generated always as identity,
    created_at     timestamptz not null default now(),  -- partition key
    tenant_id      varchar(36),
    admin_user_id  varchar(36),
    carmen_user_id varchar(36),
    username       varchar(100),
    session_id     varchar(36),
    ip_address     varchar(45),
    action         varchar(50) not null,
    resource       varchar(50),
    resource_id    varchar(255),
    target_type    varchar(50),
    target_id      varchar(100),
    before_value   jsonb,
    after_value    jsonb,
    updated_at     timestamptz          default now(),
    primary key (id, created_at)
) partition by range (created_at);

create index ix_audit_logs_tenant_created  on audit_logs (tenant_id, created_at);
create index ix_audit_logs_admin_user      on audit_logs (admin_user_id);
create index ix_audit_logs_carmen_user     on audit_logs (carmen_user_id);
create index ix_audit_logs_session_id      on audit_logs (session_id);
create index ix_audit_logs_action          on audit_logs (action);
create index ix_audit_logs_resource        on audit_logs (resource);
create index ix_audit_logs_resource_id     on audit_logs (resource_id);
create index ix_audit_logs_target_type     on audit_logs (target_type);

select partman.create_parent(
    p_parent_table   := 'public.audit_logs',
    p_control        := 'created_at',
    p_interval       := '1 month',
    p_premake        := 2
);
update partman.part_config
   set retention             = '24 months',
       retention_keep_table  = false,
       infinite_time_partitions = true
 where parent_table = 'public.audit_logs';


-- ── performance_logs ──────────────────────────────────────────────────────────
-- HTTP request latency (one row per request). High-write. 12-month retention.

create table performance_logs (
    id             bigint       generated always as identity,
    created_at     timestamptz  not null default now(),  -- partition key
    tenant_id      varchar(36),
    endpoint       varchar(200) not null,
    method         varchar(10),
    duration_ms    float        not null,
    status_code    integer,
    carmen_user_id varchar(36),
    resource_id    varchar(255),
    updated_at     timestamptz           default now(),
    primary key (id, created_at)
) partition by range (created_at);

create index ix_performance_logs_tenant_created  on performance_logs (tenant_id, created_at);
create index ix_performance_logs_endpoint        on performance_logs (endpoint);
create index ix_performance_logs_carmen_user     on performance_logs (carmen_user_id);

select partman.create_parent(
    p_parent_table   := 'public.performance_logs',
    p_control        := 'created_at',
    p_interval       := '1 month',
    p_premake        := 2
);
update partman.part_config
   set retention             = '12 months',
       retention_keep_table  = false,
       infinite_time_partitions = true
 where parent_table = 'public.performance_logs';


-- ── outbound_call_logs ────────────────────────────────────────────────────────
-- Every HTTP call to external services (Carmen ERP, OpenRouter). 12-month retention.

create table outbound_call_logs (
    id                  bigint      generated always as identity,
    created_at          timestamptz not null default now(),  -- partition key
    tenant_id           varchar(36),
    service             varchar(50) not null,  -- 'openrouter' | 'carmen'
    url                 varchar(500) not null,
    method              varchar(10),
    status_code         integer,
    duration_ms         float,
    request_size_bytes  integer,
    session_id          varchar(36),
    carmen_user_id      varchar(36),
    updated_at          timestamptz          default now(),
    primary key (id, created_at)
) partition by range (created_at);

create index ix_outbound_call_logs_tenant_created on outbound_call_logs (tenant_id, created_at);
create index ix_outbound_call_logs_service        on outbound_call_logs (service);
create index ix_outbound_call_logs_session_id     on outbound_call_logs (session_id);

select partman.create_parent(
    p_parent_table   := 'public.outbound_call_logs',
    p_control        := 'created_at',
    p_interval       := '1 month',
    p_premake        := 2
);
update partman.part_config
   set retention             = '12 months',
       retention_keep_table  = false,
       infinite_time_partitions = true
 where parent_table = 'public.outbound_call_logs';
