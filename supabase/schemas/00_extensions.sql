-- Extensions required by the OCR platform.
-- These are idempotent. Enable them via Supabase Dashboard > Database > Extensions
-- or they will be applied here during db reset / db push.
--
-- NOTE: pg_cron, pg_net, pg_partman, vector are all available on this project
-- (verified 2026-06-15 on PG 17.6, project ycykjisvvrrbgeiirqre, ap-southeast-1).

-- pg_cron and pg_net create their own fixed schemas (cron / net); no schema override.
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- pg_partman accepts a schema parameter; 'partman' is the recommended home.
create extension if not exists pg_partman with schema partman;
-- pgvector: Supabase convention is the 'extensions' schema.
create extension if not exists vector     with schema extensions;
