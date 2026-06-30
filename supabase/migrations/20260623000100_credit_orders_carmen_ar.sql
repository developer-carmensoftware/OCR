-- Add Carmen AR posting tracking columns to credit_orders.
alter table credit_orders add column if not exists carmen_ar_posted_at timestamptz;
alter table credit_orders add column if not exists carmen_ar_ref varchar(255);
