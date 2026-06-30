-- Admin RBAC: admin_users, roles, permissions, role_permissions, admin_user_roles

create table if not exists admin_users (
    id                     uuid         primary key default gen_random_uuid(),
    email                  varchar(255) not null,
    password_hash          varchar(255) not null,
    full_name              varchar(255),
    is_active              boolean      not null default true,
    mfa_secret             varchar(64),
    last_login_at          timestamptz,
    last_login_ip          varchar(45),
    failed_login_attempts  integer      not null default 0,
    locked_until           timestamptz,
    created_at             timestamptz  not null default now(),
    updated_at             timestamptz           default now(),
    deleted_at             timestamptz,
    deleted_by             varchar(100),
    created_by             varchar(100),
    updated_by             varchar(100)
);

create index if not exists ix_admin_users_created_at on admin_users (created_at);
create index if not exists ix_admin_users_deleted_at on admin_users (deleted_at);

create unique index if not exists uq_admin_user_email_active
    on admin_users (email)
    where deleted_at is null;


create table if not exists roles (
    id          varchar(50)  primary key,
    name        varchar(100) not null,
    description text,
    is_system   boolean      not null default false,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now(),
    deleted_at  timestamptz,
    deleted_by  varchar(100)
);

create index if not exists ix_roles_created_at on roles (created_at);
create index if not exists ix_roles_deleted_at on roles (deleted_at);


create table if not exists permissions (
    id          varchar(100) primary key,  -- '{resource}:{action}'
    name        varchar(255) not null,
    resource    varchar(50)  not null,
    action      varchar(50)  not null,
    description text,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now()
);

create index if not exists ix_permissions_resource   on permissions (resource);
create index if not exists ix_permissions_created_at on permissions (created_at);


create table if not exists role_permissions (
    role_id       varchar(50)  not null references roles (id),
    permission_id varchar(100) not null references permissions (id),
    primary key (role_id, permission_id)
);

-- FK-side index so DELETE FROM roles is fast.
create index if not exists ix_role_permissions_permission_id on role_permissions (permission_id);


create table if not exists admin_user_roles (
    user_id    uuid         not null references admin_users (id),
    role_id    varchar(50)  not null references roles (id),
    -- '' = global; uuid = scoped to one tenant (no FK — '' is not a valid UUID)
    tenant_id  varchar(36)  not null default '',
    granted_by varchar(36),
    expires_at timestamptz,
    created_at timestamptz  not null default now(),
    updated_at timestamptz           default now(),
    primary key (user_id, role_id, tenant_id)
);

create index if not exists ix_admin_user_roles_created_at on admin_user_roles (created_at);
-- FK-side index so queries by role_id are fast.
create index if not exists ix_admin_user_roles_role_id on admin_user_roles (role_id);
