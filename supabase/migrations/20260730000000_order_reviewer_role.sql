-- Split the credit-order review console off `quotas:*` onto its own `orders:*`
-- permission, so a reviewer account can approve slips without also being able to
-- edit quotas, adjust credit balances, or read any other admin page.
-- NOTE: perms are baked into the admin JWT at login — existing admins must re-login
-- before they can reach the order endpoints on their new `orders:*` permission.

insert into permissions (id, name, resource, action, created_at) values
    ('orders:read',  'Read Credit Orders',   'orders', 'read',  now()),
    ('orders:write', 'Review Credit Orders', 'orders', 'write', now())
on conflict (id) do nothing;

insert into roles (id, name, description, is_system, created_at) values
    ('order_reviewer', 'Order Reviewer',
     'Credit-order review console only. No admin dashboard access.', true, now())
on conflict (id) do nothing;

-- Existing roles keep what they had: quotas:* holders get orders:* too.
insert into role_permissions (role_id, permission_id) values
    ('order_reviewer', 'orders:read'),
    ('order_reviewer', 'orders:write'),
    ('super_admin',    'orders:read'),
    ('super_admin',    'orders:write'),
    ('admin',          'orders:read'),
    ('admin',          'orders:write'),
    ('viewer',         'orders:read')
on conflict do nothing;
