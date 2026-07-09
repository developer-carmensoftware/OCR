"""
RETIRED — this file and the custom _MIGRATIONS runner have been replaced by
Supabase CLI migrations in supabase/migrations/.

Schema is now managed by:
  supabase/migrations/20260615000000_v1_baseline.sql       — all plain tables
  supabase/migrations/20260615000001_partition_log_tables.sql
  supabase/migrations/20260615000002_seed_control_plane.sql
  supabase/migrations/20260615000003_seed_billing_config.sql
  supabase/migrations/20260615000004_cron_jobs.sql
  supabase/migrations/20260615000005_rls_deny_all.sql
  supabase/migrations/20260615000006_pgvector_corrections.sql

Apply to remote: supabase db push --db-url <DIRECT_URL>
"""

# Kept as an empty list so any stale import of _MIGRATIONS doesn't crash at startup.
_MIGRATIONS: list = []
