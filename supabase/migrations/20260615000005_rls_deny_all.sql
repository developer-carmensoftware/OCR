-- RLS deny-all: defense-in-depth against accidental Supabase Data API re-enablement.
--
-- Strategy: ENABLE + FORCE row level security on every public table with ZERO policies.
--   - The app's `postgres` role has BYPASSRLS privilege → zero impact on FastAPI data path.
--   - Any Data API (PostgREST) connection using the `anon` or `authenticated` role gets
--     denied on every table with no policy, even if the Data API is later re-enabled.
--   - "No policy = implicit deny" is the Postgres default when RLS is enabled.
--
-- FORCE ROW LEVEL SECURITY applies RLS even to the table owner (when acting without
-- BYPASSRLS). The `postgres` Supabase role has BYPASSRLS, so app traffic is unaffected.
--
-- This migration is additive and safe to apply on a live database.

-- ── Identity & plans ─────────────────────────────────────────────────────────
alter table plans                       enable row level security;
alter table plans                       force row level security;
alter table tenants                     enable row level security;
alter table tenants                     force row level security;

-- ── Admin RBAC ───────────────────────────────────────────────────────────────
alter table admin_users                 enable row level security;
alter table admin_users                 force row level security;
alter table roles                       enable row level security;
alter table roles                       force row level security;
alter table permissions                 enable row level security;
alter table permissions                 force row level security;
alter table role_permissions            enable row level security;
alter table role_permissions            force row level security;
alter table admin_user_roles            enable row level security;
alter table admin_user_roles            force row level security;

-- ── API keys ─────────────────────────────────────────────────────────────────
alter table api_keys                    enable row level security;
alter table api_keys                    force row level security;
alter table api_key_usage               enable row level security;
alter table api_key_usage               force row level security;

-- ── Modules ──────────────────────────────────────────────────────────────────
alter table modules                     enable row level security;
alter table modules                     force row level security;
alter table tenant_modules              enable row level security;
alter table tenant_modules              force row level security;

-- ── Bank CMS ─────────────────────────────────────────────────────────────────
alter table banks                       enable row level security;
alter table banks                       force row level security;
alter table prompt_templates            enable row level security;
alter table prompt_templates            force row level security;

-- ── Config ───────────────────────────────────────────────────────────────────
alter table system_configs              enable row level security;
alter table system_configs              force row level security;
alter table tenant_config_overrides     enable row level security;
alter table tenant_config_overrides     force row level security;
alter table feature_flags               enable row level security;
alter table feature_flags               force row level security;
alter table bu_accounting_configs       enable row level security;
alter table bu_accounting_configs       force row level security;
alter table bu_accounting_mapping_entries enable row level security;
alter table bu_accounting_mapping_entries force row level security;
alter table ap_vendor_column_mappings   enable row level security;
alter table ap_vendor_column_mappings   force row level security;
alter table ap_vendor_field_mapping_entries enable row level security;
alter table ap_vendor_field_mapping_entries force row level security;

-- ── Quotas ───────────────────────────────────────────────────────────────────
alter table quotas                      enable row level security;
alter table quotas                      force row level security;
alter table quota_usage                 enable row level security;
alter table quota_usage                 force row level security;

-- ── Reference ────────────────────────────────────────────────────────────────
alter table model_pricing               enable row level security;
alter table model_pricing               force row level security;

-- ── Business data ────────────────────────────────────────────────────────────
alter table ocr_sessions                enable row level security;
alter table ocr_sessions                force row level security;
alter table ocr_tasks                   enable row level security;
alter table ocr_tasks                   force row level security;
alter table credit_cards                enable row level security;
alter table credit_cards                force row level security;
alter table ap_invoices                 enable row level security;
alter table ap_invoices                 force row level security;
alter table correction_feedback         enable row level security;
alter table correction_feedback         force row level security;
alter table bug_reports                 enable row level security;
alter table bug_reports                 force row level security;

-- ── Billing ──────────────────────────────────────────────────────────────────
alter table credit_packs                enable row level security;
alter table credit_packs                force row level security;
alter table tenant_credits              enable row level security;
alter table tenant_credits              force row level security;
alter table credit_ledger               enable row level security;
alter table credit_ledger               force row level security;
alter table credit_orders               enable row level security;
alter table credit_orders               force row level security;
alter table billing_documents           enable row level security;
alter table billing_documents           force row level security;
alter table document_sequences          enable row level security;
alter table document_sequences          force row level security;

-- ── Analytics ────────────────────────────────────────────────────────────────
alter table daily_usage_summary         enable row level security;
alter table daily_usage_summary         force row level security;
alter table daily_model_cost            enable row level security;
alter table daily_model_cost            force row level security;
alter table monthly_usage_summary       enable row level security;
alter table monthly_usage_summary       force row level security;
alter table anomaly_alerts              enable row level security;
alter table anomaly_alerts              force row level security;
alter table job_runs                    enable row level security;
alter table job_runs                    force row level security;

-- ── Log tables (partitioned) ─────────────────────────────────────────────────
-- RLS on partitioned tables applies to the parent; child partitions inherit it.
alter table llm_usage_logs              enable row level security;
alter table llm_usage_logs              force row level security;
alter table audit_logs                  enable row level security;
alter table audit_logs                  force row level security;
alter table performance_logs            enable row level security;
alter table performance_logs            force row level security;
alter table outbound_call_logs          enable row level security;
alter table outbound_call_logs          force row level security;
