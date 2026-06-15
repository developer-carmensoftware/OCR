-- Integrity hardening — correctness-bug fixes + CHECK constraints + cost precision.
--
-- Additive, idempotent, safe to re-apply. Postgres has no ADD CONSTRAINT IF NOT EXISTS,
-- so CHECK/UNIQUE constraints are guarded with a pg_constraint existence test.
-- Partial unique indexes use CREATE UNIQUE INDEX IF NOT EXISTS.
--
-- See plan: docs review — two correctness bugs (correction upsert target,
-- unenforced 1:1 task_id) plus invariant CHECK constraints the app already assumes.


-- ── Bug 1: correction_feedback unique scope ───────────────────────────────────
-- The upsert targets this index via index-inference. It MUST include bank_code:
-- doc_no is not unique across banks, so two banks sharing a doc_no would collide.
-- Drop the old (tenant_id, doc_no, field_name) index and recreate with bank_code.

drop index if exists uq_correction_scope_active;
create unique index if not exists uq_correction_scope_active
    on correction_feedback (tenant_id, bank_code, doc_no, field_name)
    where deleted_at is null;


-- ── Bug 2: enforce 1:1 ocr_tasks → credit_cards / ap_invoices ──────────────────
-- Partial unique (not a plain UNIQUE) so a soft-deleted row can be superseded.

create unique index if not exists uq_credit_cards_task
    on credit_cards (task_id) where deleted_at is null;
create unique index if not exists uq_ap_invoices_task
    on ap_invoices (task_id) where deleted_at is null;


-- ── Integrity: CHECK constraints encoding existing app invariants ──────────────

do $$
begin
    -- quotas
    if not exists (select 1 from pg_constraint where conname = 'ck_quotas_soft_warn_pct') then
        alter table quotas add constraint ck_quotas_soft_warn_pct
            check (soft_warn_pct >= 0 and soft_warn_pct <= 1);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'ck_quotas_limit_nonneg') then
        alter table quotas add constraint ck_quotas_limit_nonneg
            check (limit_value >= 0);
    end if;

    -- feature_flags
    if not exists (select 1 from pg_constraint where conname = 'ck_feature_flags_rollout_pct') then
        alter table feature_flags add constraint ck_feature_flags_rollout_pct
            check (rollout_pct >= 0 and rollout_pct <= 100);
    end if;

    -- credit_packs
    if not exists (select 1 from pg_constraint where conname = 'ck_credit_packs_nonneg') then
        alter table credit_packs add constraint ck_credit_packs_nonneg
            check (credits >= 0 and price_thb >= 0);
    end if;

    -- tenant_credits
    if not exists (select 1 from pg_constraint where conname = 'ck_tenant_credits_nonneg') then
        alter table tenant_credits add constraint ck_tenant_credits_nonneg
            check (balance >= 0 and credits_purchased >= 0 and credits_consumed >= 0);
    end if;

    -- credit_ledger: a ledger entry must move the balance
    if not exists (select 1 from pg_constraint where conname = 'ck_credit_ledger_delta_nonzero') then
        alter table credit_ledger add constraint ck_credit_ledger_delta_nonzero
            check (delta <> 0);
    end if;

    -- credit_orders
    if not exists (select 1 from pg_constraint where conname = 'ck_credit_orders_nonneg') then
        alter table credit_orders add constraint ck_credit_orders_nonneg
            check (credits >= 0 and amount_thb >= 0);
    end if;

    -- billing_documents
    if not exists (select 1 from pg_constraint where conname = 'ck_billing_documents_nonneg') then
        alter table billing_documents add constraint ck_billing_documents_nonneg
            check (subtotal >= 0 and vat_amount >= 0 and total >= 0 and vat_rate >= 0);
    end if;
end $$;


-- ── Cost precision: unify cost_usd scale at 6 decimals ─────────────────────────
-- The summary tables stored only 4 decimals, losing sub-cent precision when
-- aggregating many small per-call costs (llm_usage_logs / daily_model_cost are
-- already 6 decimals). Widen to numeric(14,6).

alter table daily_usage_summary   alter column total_cost_usd type numeric(14, 6);
alter table monthly_usage_summary alter column total_cost_usd type numeric(14, 6);
