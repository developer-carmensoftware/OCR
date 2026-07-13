-- Server-side consent record (PDPA ม.19 — proof of who consented, when, which version).
-- Append-only legal evidence: NO soft-delete, NO retention purge. Org-level consent
-- (one meaningful row per tenant+version), keyed to match the frontend's tenant-scoped
-- consent gate (useUserConsent.ts). Multiple rows per (tenant, version) are allowed —
-- history is evidence, not a bug — so this is a plain index, not a unique constraint.
create table consent_logs (
    id              bigint generated always as identity primary key,
    tenant_id       uuid not null references tenants(id),
    carmen_user_id  varchar(36),
    consent_version varchar(20) not null,
    ip_address      varchar(45),
    user_agent      varchar(400),
    created_at      timestamptz not null default now()
);

create index ix_consent_logs_tenant_version
    on consent_logs (tenant_id, consent_version);
