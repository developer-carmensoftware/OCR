-- CA-93: Carmen pushes PMS data to us (POST /api/v1/pms/events).
--
-- The first endpoint Carmen calls *into* — authenticated by a per-tenant key from the
-- long-dormant api_keys table (scope 'pms:events'), which is also what says which BU the
-- event belongs to. The body never names a BU, so one key cannot write into another.
--
-- An inbox, nothing more: this phase stores what arrived and answers 202. Processing
-- (mapping, LLM, posting) is the next ticket, and it adds whatever state columns it needs
-- rather than this table guessing at them now.
--
-- `payload` is the envelope's `data`, kept as sent. The contract (docs/PMS_INTEGRATION.md)
-- asks Carmen for aggregates only, no guest PII; processing will null it once done, the
-- same narrowing email_documents.review_payload makes.

create table if not exists pms_events (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references tenants(id),
    -- Carmen's id for the event, unique within the BU. Retries resend it; the unique
    -- index below turns a retry into a no-op instead of a second row.
    event_id    varchar(100) not null,
    type        varchar(50) not null,
    payload     jsonb not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz default now()
);

create unique index if not exists uq_pms_events_event on pms_events (tenant_id, event_id);
create index if not exists ix_pms_events_created_at on pms_events (created_at);

-- Same backstop as 20260615000005_rls_deny_all.sql: no policies, the app role bypasses RLS.
alter table pms_events enable row level security;
alter table pms_events force row level security;

comment on table pms_events is
    'PMS data Carmen pushed via POST /api/v1/pms/events, one row per (tenant, event_id). '
    'Inbox only until the processing ticket lands. See docs/PMS_INTEGRATION.md.';
