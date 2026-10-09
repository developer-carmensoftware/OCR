-- CA-119: process the PMS days Carmen's hook announces (decision-log #42).
--
-- 20261007000000_pms_events.sql stored the hook and left processing to add the state it
-- needs. A day is read back from Carmen's Data Bank, its codes are mapped to this BU's GL,
-- and it either posts or parks in the same review queue as the email documents. So a
-- `pms_events` row grows the same ledger columns `email_documents` has, and two small
-- per-BU tables hold what the review saves: the code → account mapping and the posting
-- settings.

-- ── The day's state ──────────────────────────────────────────────────────────
alter table pms_events
    -- received → pending_review → posted | rejected; failed once the retries ran out.
    -- A repeat hook puts an unposted day back to `received` so it is read again.
    add column if not exists status             varchar(20) not null default 'received',
    -- Set only while the day waits for a person (the rows, the AI's picks, the flags);
    -- cleared on every terminal transition, like email_documents.review_payload. The
    -- Data Bank keeps the day itself.
    add column if not exists review_payload     jsonb,
    add column if not exists jv_no              varchar(50),
    add column if not exists reason_code        varchar(50),
    add column if not exists error_message      text,
    add column if not exists attempts           integer not null default 0,
    add column if not exists processed_at       timestamptz,
    -- The approve/reject claim, as email_documents.posting_started_at: it expires, so a
    -- process that died mid-post cannot strand the day.
    add column if not exists posting_started_at timestamptz,
    add column if not exists reviewed_by        varchar(36),
    add column if not exists reviewed_by_name   varchar(100),
    add column if not exists reviewed_at        timestamptz;

create index if not exists ix_pms_events_tenant_status on pms_events (tenant_id, status);

comment on table pms_events is
    'One PMS Data Bank day per (tenant, event_id): the hook, then its processing state '
    '(status, review_payload while pending, jv_no once posted). See docs/PMS_INTEGRATION.md.';

-- ── What a PMS code posts to, per BU ─────────────────────────────────────────
-- Keyed on the code, never its description: descriptions drift (CA-119 comment 11861).
-- `code_key` is `<TransactionType>|<Code>`, `Ledger|<Code>` for the two ledgers, and the
-- two rules `VAT|*` / `SVC|*` that every revenue line's tax and service rows follow.
create table if not exists pms_code_mappings (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references tenants (id),
    interface_name varchar(40) not null,
    code_key       varchar(120) not null,
    dept_code      varchar(20) not null,
    acc_code       varchar(20) not null,
    -- 'ai' when a reviewer approved the AI's pick unchanged, 'user' when they changed it.
    source         varchar(10) not null default 'user',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz default now(),
    deleted_at     timestamptz,
    deleted_by     varchar(100),
    created_by     varchar(100),
    updated_by     varchar(100)
);

create unique index if not exists uq_pms_code_mappings_key
    on pms_code_mappings (tenant_id, interface_name, code_key)
    where deleted_at is null;
create index if not exists ix_pms_code_mappings_tenant_id on pms_code_mappings (tenant_id);
create index if not exists ix_pms_code_mappings_created_at on pms_code_mappings (created_at);
create index if not exists ix_pms_code_mappings_deleted_at on pms_code_mappings (deleted_at);
create index if not exists ix_pms_code_mappings_created_by on pms_code_mappings (created_by);

-- ── How this BU's PMS days post ──────────────────────────────────────────────
-- Set on #/pms. No prefix means nothing posts: approving says so instead of posting a JV
-- into whatever book Carmen picks for a blank one.
create table if not exists pms_settings (
    tenant_id  uuid primary key references tenants (id),
    jv_prefix  varchar(20),
    -- Off: every day waits for a person. On: a clean day posts by itself; one with an
    -- AI-mapped code or a balance off still waits (decision-log #24, applied to PMS).
    auto_post  boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz default now(),
    created_by varchar(100),
    updated_by varchar(100)
);

alter table pms_code_mappings enable row level security;
alter table pms_code_mappings force row level security;
alter table pms_settings enable row level security;
alter table pms_settings force row level security;

-- ── The module ───────────────────────────────────────────────────────────────
-- No charge (the BU pays for the PMS interface separately); the row exists because
-- llm_usage_logs.module_id is a foreign key, and the AI's code suggestions are logged.
insert into modules (id, display_name, description, is_active, sort_order, created_at)
values ('pms_interface',
        'PMS Interface',
        'PMS Data Bank day → GL mapping → JV, via Carmen''s hook',
        true, 4, now())
on conflict (id) do nothing;

-- ── The retry sweep ──────────────────────────────────────────────────────────
-- The webhook starts processing at once; this picks up what a restart or a Carmen outage
-- left behind. Same template as 20260715010000_fix_cron_sql_bugs.sql (`#>> '{}'`).
select cron.unschedule(jobname) from cron.job where jobname = 'pms-process';
select cron.schedule(
    'pms-process',
    '*/10 * * * *',
    $$
    select net.http_post(
        url     := (
            select value #>> '{}'
              from system_configs
             where key_name = 'app.base_url'
             limit 1
        ) || '/api/v1/pms/process/run',
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
