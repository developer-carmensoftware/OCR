-- Add missing deleted_by column (from SoftDeleteMixin) to ar_customer_profiles.
alter table ar_customer_profiles
    add column if not exists deleted_by varchar(100);
