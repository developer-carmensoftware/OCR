-- Bank Registry & Prompt Templates.
-- banks.code is a VARCHAR FK (no hardcoded enum); adding a bank = INSERT row.
-- prompt_templates: roadmap Prompt CMS (prompts are currently code-based files).

do $$ begin
    create type prompttype   as enum ('ocr', 'mapping', 'correction');
exception when duplicate_object then null; end $$;

do $$ begin
    create type promptstatus as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;


create table if not exists banks (
    code              varchar(20)  primary key,
    name              varchar(100) not null,
    display_name_th   varchar(100),
    is_active         boolean      not null default true,
    detection_pattern varchar(500),
    sort_order        integer               default 0,
    icon_url          varchar(500),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz           default now(),
    deleted_at        timestamptz,
    deleted_by        varchar(100),
    created_by        varchar(100),
    updated_by        varchar(100)
);

create index if not exists ix_banks_created_at on banks (created_at);
create index if not exists ix_banks_deleted_at on banks (deleted_at);


create table if not exists prompt_templates (
    id           uuid         primary key default gen_random_uuid(),
    bank_code    varchar(20)  references banks (code),
    prompt_type  prompttype   not null,
    version      integer      not null,
    status       promptstatus not null default 'draft',
    content      text         not null,
    notes        text,
    published_at timestamptz,
    published_by uuid         references admin_users (id),
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz           default now(),
    deleted_at   timestamptz,
    deleted_by   varchar(100),
    created_by   varchar(100),
    updated_by   varchar(100)
);

create index if not exists ix_prompt_templates_bank_code   on prompt_templates (bank_code);
create index if not exists ix_prompt_templates_status      on prompt_templates (status);
create index if not exists ix_prompt_templates_created_at  on prompt_templates (created_at);
create index if not exists ix_prompt_templates_deleted_at  on prompt_templates (deleted_at);

create unique index if not exists uq_prompt_bank_type_version_active
    on prompt_templates (bank_code, prompt_type, version)
    where deleted_at is null;
