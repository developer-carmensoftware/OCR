-- Control plane seed data — ported from _m200_pg_seed_control_plane.
-- All INSERTs use ON CONFLICT DO NOTHING: idempotent, never overwrites manual edits.
-- No admin_user is seeded; use `python -m app.bootstrap_admin` for the first super_admin.

-- ── Plans ─────────────────────────────────────────────────────────────────────
insert into plans (code, display_name, monthly_call_limit, is_active, created_at)
values
    ('free',       'Free',       100,   true, now()),
    ('pro',        'Pro',        2000,  true, now()),
    ('enterprise', 'Enterprise', 50000, true, now())
on conflict (code) do nothing;


-- ── Roles ─────────────────────────────────────────────────────────────────────
insert into roles (id, name, description, is_system, created_at)
values
    ('super_admin', 'Super Admin', 'Full access including IAM. Cannot be deleted.',            true, now()),
    ('admin',       'Admin',       'Day-to-day operations. No role/permission management.',    true, now()),
    ('viewer',      'Viewer',      'Read-only access to dashboards and config.',               true, now())
on conflict (id) do nothing;


-- ── Permissions ───────────────────────────────────────────────────────────────
insert into permissions (id, name, resource, action, created_at) values
    ('tenants:read',      'Read Tenants',        'tenants',     'read',        now()),
    ('tenants:write',     'Write Tenants',       'tenants',     'write',       now()),
    ('tenants:delete',    'Delete Tenants',      'tenants',     'delete',      now()),
    ('banks:read',        'Read Banks',          'banks',       'read',        now()),
    ('banks:write',       'Write Banks',         'banks',       'write',       now()),
    ('banks:delete',      'Delete Banks',        'banks',       'delete',      now()),
    ('prompts:read',      'Read Prompts',        'prompts',     'read',        now()),
    ('prompts:write',     'Write Prompts',       'prompts',     'write',       now()),
    ('prompts:publish',   'Publish Prompts',     'prompts',     'publish',     now()),
    ('prompts:delete',    'Delete Prompts',      'prompts',     'delete',      now()),
    ('api_keys:read',     'Read API Keys',       'api_keys',    'read',        now()),
    ('api_keys:write',    'Write API Keys',      'api_keys',    'write',       now()),
    ('api_keys:revoke',   'Revoke API Keys',     'api_keys',    'revoke',      now()),
    ('admin_users:read',  'Read Admin Users',    'admin_users', 'read',        now()),
    ('admin_users:write', 'Write Admin Users',   'admin_users', 'write',       now()),
    ('admin_users:delete','Delete Admin Users',  'admin_users', 'delete',      now()),
    ('roles:read',        'Read Roles',          'roles',       'read',        now()),
    ('roles:write',       'Write Roles',         'roles',       'write',       now()),
    ('roles:delete',      'Delete Roles',        'roles',       'delete',      now()),
    ('configs:read',      'Read Configs',        'configs',     'read',        now()),
    ('configs:write',     'Write Configs',       'configs',     'write',       now()),
    ('flags:read',        'Read Flags',          'flags',       'read',        now()),
    ('flags:write',       'Write Flags',         'flags',       'write',       now()),
    ('quotas:read',       'Read Quotas',         'quotas',      'read',        now()),
    ('quotas:write',      'Write Quotas',        'quotas',      'write',       now()),
    ('modules:read',      'Read Modules',        'modules',     'read',        now()),
    ('modules:write',     'Write Modules',       'modules',     'write',       now()),
    ('alerts:read',       'Read Alerts',         'alerts',      'read',        now()),
    ('alerts:acknowledge','Acknowledge Alerts',  'alerts',      'acknowledge', now()),
    ('audit:read',        'Read Audit Log',      'audit',       'read',        now())
on conflict (id) do nothing;


-- ── Role → Permission assignments ─────────────────────────────────────────────
-- super_admin: everything
insert into role_permissions (role_id, permission_id)
select 'super_admin', id from permissions
on conflict do nothing;

-- admin: everything except IAM (roles + admin_users management)
insert into role_permissions (role_id, permission_id)
select 'admin', id from permissions
where resource not in ('roles', 'admin_users')
on conflict do nothing;

-- viewer: read-only
insert into role_permissions (role_id, permission_id)
select 'viewer', id from permissions
where action = 'read'
on conflict do nothing;


-- ── Modules ───────────────────────────────────────────────────────────────────
insert into modules (id, display_name, description, is_active, sort_order, created_at)
values
    ('credit_card_ocr', 'Credit Card OCR', 'Bank receipt OCR + GL mapping wizard', true, 1, now()),
    ('ap_invoice',      'AP Invoice',      'Vendor invoice OCR + line-item review', true, 2, now())
on conflict (id) do nothing;


-- ── Banks ─────────────────────────────────────────────────────────────────────
insert into banks (code, name, display_name_th, is_active, sort_order, created_at)
values
    ('BBL',   'Bangkok Bank',          'ธนาคารกรุงเทพ',    true, 1, now()),
    ('KBANK', 'Kasikorn Bank',         'ธนาคารกสิกรไทย',  true, 2, now()),
    ('SCB',   'Siam Commercial Bank',  'ธนาคารไทยพาณิชย์', true, 3, now())
on conflict (code) do nothing;
