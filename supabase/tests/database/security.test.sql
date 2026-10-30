-- The two layers that keep the Data API's roles out of our tables
-- (20261030000000_rls_every_table_no_anon_grants.sql). Run by `supabase test db` in CI's
-- migrations job, after `supabase db reset`: a new table created without RLS, or a grant
-- to anon/authenticated, fails the PR instead of waiting for the next audit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is_empty(
    $$ select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and not c.relispartition
          and not (c.relrowsecurity and c.relforcerowsecurity) $$,
    'every public table (partitions aside) has row level security enabled and forced'
);

select is_empty(
    $$ select grantee || ': ' || privilege_type || ' on ' || table_name
         from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee in ('anon', 'authenticated') $$,
    'anon and authenticated hold no privilege on any public table'
);

select * from finish();
rollback;
