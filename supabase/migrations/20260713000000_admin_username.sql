-- Admin login switches from email to username. admin_users.email was already a
-- plain unique varchar with no email-specific validation or mail-sending — purely
-- a login handle — so this is a rename, not a schema redesign. Existing values
-- (e.g. 'admin@carmen.com') carry over as-is and simply become that admin's
-- username; no data migration needed.

alter table admin_users rename column email to username;
alter index uq_admin_user_email_active rename to uq_admin_user_username_active;
