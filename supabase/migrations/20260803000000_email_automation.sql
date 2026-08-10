-- Email Automation v2 — bank commission mail → auto-posted JV.
-- Two tables only: what a BU configured, and what arrived.
--
-- Why email_documents exists at all: ocr_tasks / credit_cards are both created
-- AFTER a document credit is charged, so a mail that fails earlier (wrong PDF
-- password, no attachment, unknown tag) leaves no trace anywhere — and the next
-- poll would pick it up again forever. This table is the "we have seen this
-- message" ledger, keyed on the RFC-822 Message-ID.

create table if not exists email_ingest_settings (
    tenant_id        uuid primary key references tenants(id),
    ingest_tag       varchar(32) not null unique,   -- ocr+<tag>@… — identifies the BU at the front door
    enabled          boolean     not null default false,
    tax_ids          jsonb       not null default '[]'::jsonb,
    rules            jsonb       not null default '[]'::jsonb,  -- pdf_password inside is Fernet-encrypted
    carmen_token_enc text,                          -- Fernet; null = fall back to CARMEN_DEV_TOKEN (dev)
    created_by       varchar(100),
    updated_by       varchar(100),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

comment on column email_ingest_settings.carmen_token_enc is
    'Per-BU Carmen posting credential, supplied by Carmen through PUT /api/v1/carmen/settings. '
    'Never returned by any endpoint. Null falls back to the dev token in env.';

create table if not exists email_documents (
    id            uuid        primary key,
    tenant_id     uuid        not null references tenants(id),
    message_id    varchar(500) not null,
    attachment    varchar(255) not null default '',
    status        varchar(20)  not null default 'received',  -- received|posted|failed|skipped
    task_id       uuid        references ocr_tasks(id),
    bank_code     varchar(20),
    doc_no        varchar(100),
    jv_no         varchar(50),
    reason_code   varchar(50),   -- contract §3.4: tax_id_mismatch, duplicate_document, …
    error_message text,
    attempts      integer     not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- The dedupe guard. One row per (BU, message, attachment) — a mail forwarded twice
-- collides here before any LLM call is paid for.
create unique index if not exists uq_email_documents_message
    on email_documents (tenant_id, message_id, attachment);

create index if not exists ix_email_documents_tenant_created
    on email_documents (tenant_id, created_at desc);
