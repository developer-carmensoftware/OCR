# Database Design — Carmen AI Hub

**Database:** PostgreSQL 17.6 via Supabase (region: ap-southeast-1, project: ycykjisvvrrbgeiirqre)
**Driver:** `asyncpg` (via SQLAlchemy 2.x async) — Supavisor session-mode pooler port 5432, `statement_cache_size=0`
**ORM:** SQLAlchemy 2.x async (`backend/app/models/`)
**Migrations:** Supabase CLI — `supabase/migrations/*.sql` (8 files). Apply with `supabase db push`.
**Schema reset:** `DROP SCHEMA public CASCADE` in Supabase SQL Editor, then `supabase db push`

---

## 1. Two-Plane Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE  — Admin Dashboard manages                           │
│                                                                     │
│  tenants  (composite (host, bu_code); 1 row per Carmen host+BU pair)│
│  admin_users · roles · permissions · role_permissions               │
│  admin_user_roles                                                   │
│  api_keys · api_key_usage                                           │
│  modules · tenant_modules                                           │
│  banks · prompt_templates                                           │
│  system_configs · tenant_config_overrides · feature_flags           │
│  quotas · quota_usage                                               │
│  model_pricing                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  (read via in-memory cache)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DATA PLANE  — OCR / AP processes write here                        │
│                                                                     │
│  ocr_sessions · ocr_tasks                                           │
│  credit_cards (header only — line items not persisted)              │
│  ap_invoices                                                        │
│  correction_feedback                                               │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OBSERVABILITY  — Append-only, partitioned monthly (pg_partman)     │
│                                                                     │
│  llm_usage_logs · audit_logs (24-month retention)                   │
│  performance_logs · outbound_call_logs (12-month retention each)    │
│  daily_usage_summary · daily_model_cost · monthly_usage_summary     │
│  anomaly_alerts · job_runs                                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Data Plane writes real-time from OCR/AP requests
- Control Plane writes only via Admin Dashboard actions
- Data Plane reads Control Plane through in-memory cache (not per-request DB)
- Background analytics, session purge, and pricing sync run as **pg_cron jobs** inside Postgres (not Python asyncio loops)

---

## 2. Column Mixins

All models inherit from these mixins — SQLAlchemy copies columns per table (no shared state).

```python
class TimestampMixin:
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True, index=True)  # NULL = active
    deleted_by = Column(String(100), nullable=True)           # user_id who deleted

class WriterMixin:
    created_by = Column(String(100), nullable=True, index=True)
    updated_by = Column(String(100), nullable=True)

class TenantFKMixin:
    tenant_id = Column(PGUUID(as_uuid=True), FK → tenants.id, NOT NULL, index=True)
    # tenants.id is itself keyed by composite (host, bu_code) — no separate BU FK.
```

### Mixin composition per table type

| Table type | Mixins |
|---|---|
| Business data (credit_cards, ap_invoices, …) | `TenantFKMixin + TimestampMixin + SoftDeleteMixin + WriterMixin` |
| Auth / session | `TenantFKMixin + TimestampMixin + SoftDeleteMixin` |
| Observability log (llm_usage, audit, perf, outbound) | Composite PK `(id BIGINT GENERATED ALWAYS, created_at)` — no `TimestampMixin`, no FK (partitioned, high-volume append-only) |
| Control plane entities (banks, tenants, …) | `TimestampMixin + SoftDeleteMixin + WriterMixin` |
| Config / reference (model_pricing, system_configs) | `TimestampMixin + WriterMixin` |
| Junction / counters (quota_usage, api_key_usage) | `TimestampMixin` only |

### Soft Delete Policy

**Business tables never hard-delete.** Query pattern:
```sql
WHERE deleted_at IS NULL   -- always filter
```

Soft-deletable tables with a unique constraint use **partial unique indexes** (`WHERE deleted_at IS NULL`) instead of plain `UniqueConstraint` to allow re-creation after soft-deletion.

Log tables (`llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs`) are append-only — deleted via **retention policy** only, never soft-deleted.

### Creator identity (WriterMixin.created_by)

| Table location | Value stored in `created_by` |
|---|---|
| Control plane (banks, prompts, configs) | `admin_user_id` UUID |
| Data plane (credit_cards, ap_invoices) | `carmen_user_id` UUID from Carmen ERP |

The ORM `carmen_user_id` column (explicit on each data-plane model) stores the Carmen ERP user who performed the action. `created_by` stores the writer identity (same person, different column for clarity).

---

## 3. Multi-tenancy

```
Tenant (host = 'ostin.carmenwork.com', bu_code = 'OSTIN-HQ')   ← 1 row per (host, bu) pair
  └── carmen_user_id (UUID from Carmen)                          ← end-user (external, no FK)
```

A tenant is a **composite of (host, bu_code)**. The same Carmen instance with two
different BUs produces two distinct `tenants.id` UUIDs, so quotas, configs, and
data are isolated per-BU automatically — every data-plane row carries only a
single `tenant_id` FK, no separate `business_unit_id`.

**Tenant resolution at login** (`routers/auth.py`):
1. Parse `carmen_uri` → extract `host`; read `bu` from request body.
2. `UPSERT INTO tenants (host, bu_code, name)` → get `tenant_id`.
3. Embed `tid` in JWT → subsequent requests read from JWT (no DB lookup).
   `bu` is also carried in the JWT for display only — not used for filtering.

**No raw `host`/`bu` strings anywhere in Data Plane** — every data-plane row foreign-keys to `tenants.id`.

---

## 4. Primary Key Conventions

| PK type | Used on |
|---|---|
| `PGUUID(as_uuid=True)` | Business entities: `ocr_tasks`, `credit_cards`, `ap_invoices`, `tenants`, `admin_users`, `api_keys`, `ocr_sessions`, etc. Default `uuid.uuid4` (not str) |
| `(BigInteger GENERATED ALWAYS, created_at)` composite PK | Partitioned log tables: `llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs` — partition key must be in every unique index |
| `BigInteger` autoincrement | Analytics + alert tables: `anomaly_alerts`, `job_runs` |
| `Integer` autoincrement | Smaller tables: `correction_feedback`, `daily_usage_summary`, `daily_model_cost`, `monthly_usage_summary` |
| Natural string key | Reference: `banks.code` (`BBL`), `modules.id` (`credit_card_ocr`), `roles.id`, `permissions.id` |
| Composite | Junctions: `role_permissions(role_id, permission_id)`, `tenant_modules(tenant_id, module_id)`, `quota_usage(quota_id, period_key)` |

**Important:** Always pass `uuid.uuid4()` (not `str(uuid.uuid4())`) when creating ORM objects with UUID PKs. SQLAlchemy uses the PK as a sentinel in `INSERT ... RETURNING` — a `str` won't match the `uuid.UUID` returned by asyncpg, causing a `InvalidRequestError`.

---

## 5. Data Plane Tables

### `ocr_tasks`

Parent job record for every uploaded file.

| Key columns | Notes |
|---|---|
| `module_id` FK → modules | `credit_card_ocr` or `ap_invoice` |
| `original_filename` | |
| `status` | pending / processing / completed / failed |
| `carmen_user_id` | Carmen user who uploaded |
| `completed_at` | |

Relationships: `→ credit_cards` (1:1), `→ ap_invoices` (1:1)

---

### `credit_cards`

Extracted header data from a credit card bank statement.

| Key columns | Notes |
|---|---|
| `task_id` FK → ocr_tasks | |
| `bank_code` FK → banks | Replaces old hardcoded `BankType` enum |
| `company_name`, `bank_company_name` | |
| `doc_date` | `DATE` — parsed from LLM string via `utils.date_parsing.parse_doc_date` (handles DD/MM/YYYY, ISO, Buddhist years) |
| `doc_no`, `branch_no` | |
| `submitted_at` | NULL = draft; NOT NULL = submitted to Carmen ERP |
| `carmen_user_id` | |

**Duplicate check:** `WHERE tenant_id=X AND bank_code=Z AND doc_no=N AND submitted_at IS NOT NULL AND deleted_at IS NULL`

**1:1 with `ocr_tasks`** enforced by partial unique index `uq_credit_cards_task (task_id) WHERE deleted_at IS NULL`.

**Line items are NOT persisted** — like AP invoices, credit-card transactions follow the
extract-display-only pattern (Carmen ERP is source of truth). They are returned transiently
in the API response (`CreditCardTransactionSchema`) and never written to the DB.

---

### `ap_invoices`

Metadata of an AP Invoice OCR job. **Line items are NOT stored** — Carmen ERP is source of truth.

| Key columns | Notes |
|---|---|
| `task_id` FK → ocr_tasks | |
| `vendor_name`, `doc_no` | |
| `doc_date` | `DATE` — parsed via `utils.date_parsing.parse_doc_date` |
| `submitted_at` | NULL = draft |
| `carmen_user_id` | |

**1:1 with `ocr_tasks`** enforced by partial unique index `uq_ap_invoices_task (task_id) WHERE deleted_at IS NULL`.

---

### `correction_feedback`

User corrections of LLM-extracted fields → drives `correction_service.py` which computes error rates and injects prompt hints.

| Key columns | Notes |
|---|---|
| `bank_code` FK → banks | |
| `doc_no`, `field_name` | |
| `original_value`, `corrected_value` | |
| `value_embedding` | `extensions.vector(1536)` — HNSW cosine index for nearest-neighbour prompt hints (NULL until embedded) |
| `carmen_user_id` | who corrected |

Partial unique index (active only): `(tenant_id, bank_code, doc_no, field_name) WHERE deleted_at IS NULL` — `bank_code` is in scope because `doc_no` is not unique across banks. The upsert in `correction_service.py` matches this index via index inference (not `ON CONSTRAINT`, which cannot target a partial unique index).
HNSW index: `(value_embedding extensions.vector_cosine_ops) WHERE value_embedding IS NOT NULL`

**Error rate formula** (`correction_service.py`):
`error_rate = corrections(field, 90d) / submitted_receipts(bank, 90d)`
Inject hint into prompt if `error_rate > 10%`

---

### `ocr_sessions`

Active Carmen ERP user session.

| Key columns | Notes |
|---|---|
| `carmen_token_encrypted` | Fernet-encrypted; decrypted per request |
| `carmen_user_id` | |
| `carmen_uri` | Full origin URI of the Carmen instance |
| `is_active` | False = revoked (set on Carmen 401 response) |
| `last_used_at` | Updated each request |

**Session lifecycle:** JWT exp OR Carmen 401 → `is_active = False`
**Cleanup:** inactive sessions older than 30 days → purged hourly by pg_cron SQL function `fn_purge_inactive_sessions()`

---

## 6. Observability Tables

**Partitioned monthly** by `pg_partman` (`PARTITION BY RANGE (created_at)`). `tenant_id` is `VARCHAR(36)` + index — no FK (high-volume append-only). PK is composite `(id BIGINT GENERATED ALWAYS, created_at)` — partition key must be in every unique index. Integrity enforced at application layer.

**Retention (automatic):** pg_partman drops aged partitions nightly via pg_cron:
- `llm_usage_logs`, `performance_logs`, `outbound_call_logs`: 12 months
- `audit_logs`: 24 months (compliance)

Business analytics are preserved indefinitely in `daily_model_cost` and `monthly_usage_summary`.

### `llm_usage_logs`

One row per LLM API call. PK is `BIGINT` to prevent auto-increment overflow.

| Key columns | Notes |
|---|---|
| `module_id` | `credit_card_ocr` / `ap_invoice` (replaces old `usage_type` string) |
| `model` | OpenRouter model ID |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | |
| `cost_usd` | Calculated from `model_pricing` at insert time |
| `duration_ms` | |
| `carmen_session_id`, `carmen_user_id` | |

**Retention:** No automatic deletion. Export via script when approaching storage limits.

### `audit_logs`

Immutable event log. Append-only.

| Key columns | Notes |
|---|---|
| `admin_user_id` | Set when admin performed the action |
| `carmen_user_id` | Set when Carmen end-user performed the action |
| `action` | `EXTRACT`, `SUBMIT`, `CONFIG_UPDATE`, `BANK_CREATE`, etc. |
| `resource` | `credit_card`, `ap_invoice`, `banks`, `prompts`, etc. |
| `resource_id` | Document reference or entity ID |
| `target_type`, `target_id` | For admin config changes |
| `before_value`, `after_value` | JSON diff for control-plane changes |

**Rule:** Either `admin_user_id` or `carmen_user_id` is set — never both, never neither.

### `performance_logs`

One row per HTTP request via `PerformanceMiddleware`.

### `outbound_call_logs`

Every outbound HTTP call (OpenRouter, Carmen ERP).

| `service` values | `openrouter`, `carmen` |
|---|---|

---

## 7. Analytics Tables

Built nightly by **pg_cron SQL functions** (`fn_build_daily_summary`, `fn_build_daily_model_cost`, `fn_build_monthly_summary`) scheduled at 01:17–01:32 UTC. The Python `summary_service.py` remains for on-demand admin backfill via `POST /api/v1/admin/maintenance/summary/*`. All analytics kept indefinitely.

### `daily_usage_summary`

Pre-aggregated nightly. Unique per `(tenant_id, module_id, summary_date)`.

Aggregates: documents, submissions, LLM calls/tokens/cost, API calls, errors, corrections, outbound calls, latency (avg + p95).

Used by `anomaly_service.py` as baseline for spike detection (7-day rolling average).

### `daily_model_cost`

Per-model cost breakdown. Unique per `(summary_date, tenant_id, module_id, model_name)`.

Answers: "What did `google/gemini-2.5-flash-lite` cost us per tenant today?"

Populated from `llm_usage_logs` grouped by model. Preserved indefinitely for long-term cost analytics.

### `monthly_usage_summary`

Monthly rollup of `daily_usage_summary`. Unique per `(tenant_id, module_id, summary_date)` where `summary_date = first day of month`.

Built nightly (idempotent re-aggregation of the current month). Answers long-term trend questions without scanning daily rows.

### `anomaly_alerts`

| `metric` values | `severity` |
|---|---|
| `cost_spike` (LLM cost > 3× 7d avg) | `warn` |
| `error_spike` (API error rate > 3× 7d avg) | `warn` |
| `quota_warning` (≥ 80% monthly quota) | `warn` |
| `quota_exhausted` (≥ 100% monthly quota) | `critical` |

`resolved_at = NULL` = open alert. One open alert per `(tenant_id, metric)` to prevent duplicates.

### `job_runs`

One row per background scheduler job execution. Detects drift: `status = running` with no `completed_at` = app crashed mid-job.

| `job_name` values |
|---|
| `session-purge`, `daily-summary`, `daily-model-cost`, `monthly-summary`, `pricing-sync`, `partman-maintain` |

---

## 8. Control Plane Tables

### Identity

#### `tenants`
One row per (Carmen ERP host, business unit) pair. Auto-registered on first login via `_upsert_tenant()`.

| Key columns | Notes |
|---|---|
| `host` | `ostin.carmenwork.com` — Carmen instance hostname |
| `bu_code` | `OSTIN-HQ` — Carmen JWT `bu` claim |
| `name` | Display name (admin editable; defaults to `{host}/{bu_code}`) |
| `plan` | free / pro / enterprise |
| `is_active` | |

Partial unique index: `(host, bu_code) WHERE deleted_at IS NULL`.

---

### Admin RBAC

#### `admin_users`
Hub staff — separate from Carmen ERP users.

**Security:** `password_hash` (bcrypt/argon2), `mfa_secret` (TOTP), `locked_until` (brute-force lockout).
**First admin:** Created via `bootstrap CLI` — never seeded in migrations.

#### `roles`
Pre-seeded: `super_admin`, `admin`, `viewer` (all `is_system = True`)

#### `permissions`
Format: `{resource}:{action}` — e.g., `banks:write`, `prompts:publish`

Resources: `tenants`, `banks`, `prompts`, `api_keys`, `admin_users`, `roles`, `configs`, `flags`, `quotas`, `modules`, `alerts`, `audit`

Actions: `read`, `write`, `delete`, `publish`, `revoke`, `acknowledge`

#### `admin_user_roles`
Optional tenant scope: `tenant_id = ''` (empty) = global; `tenant_id = uuid` = scoped to one tenant.

**No FK on `tenant_id`** — `''` is a sentinel that has no matching `tenants` row, so a FK would be unenforceable. App layer validates the UUID case before insert.

---

### API Keys

#### `api_keys`
External system authentication.

| Key columns | Notes |
|---|---|
| `key_prefix` | First 12 chars, shown in admin list (`ck_live_a1b2`) |
| `key_hash` | bcrypt hash — plaintext shown ONCE at creation |
| `tenant_id` FK | NULL = global key |
| `scopes` | JSON array: `['ocr:read', 'invoice:write']` |
| `rate_limit_rpm` | Per-key rate limit |
| `revoked_at` | No soft-delete — revocation is auditable |

---

### Bank CMS

#### `banks`
Replaces old hardcoded `BankType` enum. Adding a bank = INSERT row + create prompt via dashboard.

| Key columns | Notes |
|---|---|
| `code` PK | `BBL`, `KBANK`, `SCB` (pre-seeded) |
| `detection_pattern` | Regex for `detectBankFromCompanyName()` |
| `is_active` | Hidden from dropdown when false |

#### `prompt_templates`
Versioned prompts for OCR / mapping / correction.

Lifecycle: `draft → published → archived`
Only ONE `published` version per `(bank_code, prompt_type)` at a time.
`bank_code = NULL` = generic/combined prompt.

**Publish workflow:**
1. Admin edits content → save as `draft`
2. Test on sample images
3. Publish → `status = published` + invalidate prompt cache
4. If broken → rollback to previous published version

---

### Configuration

#### `system_configs`
DB-driven settings (replaces most `.env` vars).

| Key columns | Notes |
|---|---|
| `key_name` PK | `llm.ocr_model`, `correction.error_rate_threshold` |
| `value` JSON | Supports string / int / float / bool / object |
| `category` | `llm`, `limits`, `features`, `pricing` |
| `is_secret` | Mask in UI |
| `requires_restart` | Warn admin |

**Secrets that MUST stay in `.env` (never in DB):**
- `OCR_JWT_SECRET`
- `SESSION_ENCRYPTION_KEY`
- `DATABASE_URL`

#### `tenant_config_overrides`
Per-tenant override: lookup order = `tenant_override → system_config → default`

#### `feature_flags`
Boolean toggles with gradual rollout.

| `flag_key` examples | Purpose |
|---|---|
| `ap_invoice_v2` | Beta feature for subset tenants |
| `auto_gl_mapping` | Kill switch if issues arise |
| `enable_anomaly_alerts` | Toggle alert system |

---

### Quota Engine

#### `quotas`
Multiple rules per tenant (e.g., monthly calls + monthly cost).

| Key columns | Notes |
|---|---|
| `module` | NULL = all modules combined |
| `period` | daily / monthly / yearly |
| `metric` | calls / tokens / cost_usd / documents |
| `limit_value` | |
| `soft_warn_pct` | 0.80 = warn at 80% |
| `is_hard` | true = block; false = warn only |

Unique: `(tenant_id, module, period, metric)`

#### `quota_usage`
Real-time counter, incremented by `usage_service.increment_quota()`.

`period_key`: `2026-05` (monthly), `2026-05-14` (daily)

---

## 9. Migration System

Schema is owned by **Supabase CLI** migrations in `supabase/migrations/*.sql`, applied with
`supabase db push`. The old Python `_MIGRATIONS` runner (`backend/app/migrations.py`) was
deleted in the Supabase-native cutover. Migration files are timestamp-prefixed and applied
in lexical order; never edit or reorder an already-applied file.

Current files (greenfield — squashed into one authoritative baseline):

```text
20260615000000_v1_baseline.sql          -- all plain tables (identity → analytics)
20260615000001_partition_log_tables.sql -- 4 log tables, pg_partman monthly partitioning
20260615000002_seed_control_plane.sql   -- roles, permissions, modules, banks, plans
20260615000003_seed_billing_config.sql  -- credit packs + billing system_configs
20260615000004_cron_jobs.sql            -- pg_cron jobs + pg_net + SQL aggregate fns
20260615000005_rls_deny_all.sql         -- RLS deny-all defense-in-depth
20260615000006_pgvector_corrections.sql -- value_embedding column + HNSW index
20260615000007_integrity_hardening.sql  -- CHECK constraints, 1:1 task_id, correction scope
```

**Adding a new migration:**
1. `supabase migration new <description>` → creates a new timestamp-prefixed file
2. Write idempotent DDL (`IF NOT EXISTS`; for constraints use the `DO $$ … pg_constraint $$` guard)
3. `supabase db push` to apply
4. **Never** modify or reorder an already-applied file

---

## 10. Retention

Service: `backend/app/services/retention_service.py`
Triggered by scheduler every 24h.

| Table | Action |
|---|---|
| `ocr_sessions` (inactive > 30 days) | Batch DELETE, 5,000 rows/pass |
| Log tables (`llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs`) | No automatic deletion — export via script when storage grows |

**Business analytics** (`daily_model_cost`, `monthly_usage_summary`) are kept indefinitely; raw log deletion does not affect cost/usage visibility.

---

## 11. Scheduler Background Jobs

All jobs recorded in `job_runs` table. Scheduler runs inside FastAPI event loop (asyncio task).

| Job | Schedule | Notes |
|---|---|---|
| `session-purge` | 24h | Deletes inactive ocr_sessions > 30d |
| `summary` | 24h | Aggregates ALL tenants → daily_usage_summary |
| `daily_model_cost` | 24h | Per-model breakdown → daily_model_cost |
| `monthly_summary` | 24h | Rollup → monthly_usage_summary |
| `anomaly-detection` | 24h | Runs after summary |
| `pricing-sync` | 8h | OpenRouter API → llm_model_pricing (separate loop) |

---

## 12. Adding a New Module

```
1. INSERT INTO modules (id, display_name, ...) VALUES ('my_module', ...)
2. Create ORM models inheriting TenantFKMixin + TimestampMixin + SoftDeleteMixin
3. Add migrations (`supabase migration new <name>` → DDL → `supabase db push`)
4. Add module_id to OCRTask creation in the new router
5. Add check_quota("my_module") at start of extract endpoint
6. Add quota tracking in log_llm_usage calls
7. Extend summary_service.py aggregation if needed
```

## 13. Adding a New Bank (Admin Dashboard, zero redeploy)

```
1. INSERT INTO banks via Admin Dashboard UI
2. Create PromptTemplate via Prompt Editor (draft → test → publish)
3. Cache invalidated automatically on publish
4. Bank appears in frontend dropdown (fetched from /api/v1/banks)
```

---

## 14. What's Planned (Not Yet Built)

| Feature | Depends on |
|---|---|
| Admin auth flow (email/password + MFA) | `admin_users` table ✅ |
| `require_permission()` dependency | `roles/permissions` tables ✅ |
| Prompt CMS service (`prompt_service.py`) | `prompt_templates` table ✅ |
| Feature flag service | `feature_flags` table ✅ |
| Config service with hot-reload | `system_configs` table ✅ |
| API key auth middleware | `api_keys` table ✅ |
| Bootstrap CLI for first super_admin | `admin_users` table ✅ |
