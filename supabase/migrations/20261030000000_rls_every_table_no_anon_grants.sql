-- Row level security on every public table, and no privileges for the Data API's roles.
--
-- 20260615000005_rls_deny_all.sql enabled + forced RLS (no policies = deny) on every table
-- that existed then. Tables added since were never given it: measured on dev 2026-10-30,
-- 14 regular tables had none — email_documents, email_ingest_settings, consent_logs,
-- secure_configs, user_notifications, tenant_subscriptions, ar_customer_profiles and others.
-- What still held them shut was that `anon`/`authenticated` had no grants there, and no
-- migration ever revoked those: a fresh database (`supabase db reset`, all migrations up to
-- this one) hands them 1078 table privileges by default privilege, and leaves 9 tables
-- without RLS. Both layers are made explicit here; after it, both counts are 0.
--
-- Nothing changes for the app: it connects as `postgres`, which has BYPASSRLS (see the
-- 20260615 migration). Only a Data API (PostgREST) request — `anon` / `authenticated` —
-- is affected, and the Data API is meant to stay disabled (CLAUDE.md, Database).
--
-- Partitions (performance_logs_p…, llm_usage_logs_default, …) are left as they are:
-- pg_partman creates one a month and would not carry the setting, their parents have RLS,
-- and the revoke below covers direct access to them.
--
-- supabase/tests/database/security.test.sql fails CI if either layer regresses.

do $$
declare
    t record;
begin
    for t in
        select c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind in ('r', 'p')
           and not c.relispartition
           and not (c.relrowsecurity and c.relforcerowsecurity)
    loop
        execute format('alter table public.%I enable row level security', t.relname);
        execute format('alter table public.%I force row level security', t.relname);
    end loop;
end $$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- …and for what later migrations create (they run as `postgres`).
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
