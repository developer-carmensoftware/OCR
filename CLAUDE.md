# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For coding principles and standards, please refer to [skill.md](file:///c:/Users/User/Desktop/OCR/skill.md).

Full database design documentation: [docs/Database_Design.md](docs/Database_Design.md)

---

## How to Run

```bash
# Backend
cd backend && venv\Scripts\activate
uvicorn app.main:app --reload --port 8010

# Frontend — http://localhost:3010 (proxies /api/* → :8010)
cd frontend && npm run dev

# Schema changes — apply to remote Supabase project
supabase db push
```

---

## Changelog

Every meaningful change is logged in [`changelog/`](changelog/), **one file per day** (`changelog/YYYY-MM-DD.md`). This is the source of truth for status reports — write there instead of relying on `git log`.

- After making a meaningful change, add or update that day's file (create `changelog/<today>.md` if absent).
- **Prefix every entry with its time** as `` `HH:MM` `` (24h, ICT +0700). A grouped block of related work may carry one timestamp on its heading.
- Group by area (Backend / Frontend / DB / Infra) when useful; one terse bullet per change, link the commit hash once it exists.
- Put **uncommitted / in-progress** work in its own section so it's clear what hasn't shipped.
- See [changelog/README.md](changelog/README.md) for the full convention.
- **CI enforces this**: the `changelog-check` job fails any PR that touches no `changelog/` file (escape hatch: `skip-changelog` label). Add/update today's entry **in the same commit/branch as the change, before opening the PR** — don't wait for CI to fail first.

---

## Architecture

### Credit Card OCR (5-step wizard)

```text
useOcrWizard hook
  → POST /api/v1/credit-card/extract
      routers/ocr.py           check_quota("credit_card_ocr") → vision LLM → ExtractedCreditCardData
      llm/prompts/__init__.py  _REGISTRY dict maps bank_code → prompt file (code-based, pending CMS)
  → POST /api/v1/credit-card/mapping/suggest
      services/gl_suggestion_service.py  LLM suggests GL dept/acc for fixed fields + payment types
  → POST /api/v1/carmen/gljv  submit to Carmen ERP
      routers/carmen.py        post-submit bookkeeping marks CreditCard.submitted_at
                               Duplicate check: (tenant_id, bank_code, doc_no, submitted_at IS NOT NULL)
```

### AP Invoice (5-step wizard)

```text
useAPInvoice hook
  → POST /api/v1/ap-invoice/extract
      routers/ap_invoice.py    check_quota("ap_invoice") → vision LLM
      ap_invoice_postprocess   tax-type detection, footer discount distribution, per-line totals
      llm_usage_logger.log_llm_usage()  silent-failure token logging → llm_usage_logs
  → Step 2: column→field mapping  persisted to localStorage per vendor name
  → POST /api/v1/ap-invoice/suggest
      ap_invoice_service       pre-filters expense accounts → LLM → deptCode/accountCode
  → POST /api/v1/carmen/invoice  submit to Carmen ERP
```

---

## Key Design Decisions

- **English is the default UI language** — All UI text, labels, buttons, copy, and user-facing error messages default to **English**. Write new surfaces in English first. Thai is reserved for user-supplied content that is inherently Thai (vendor names, GL labels, extracted invoice text) and for explicit per-locale translation; never default a new label/component to Thai. This applies to the internal OCR wizards and mapping UI.
  - **Bilingual (EN/TH) surfaces: the customer-facing purchase flow and the admin dashboard.** `#/pricing` + `#/pricing/orders` (catalog → checkout → QR → slip → order history) and `#/admin/*` (nav, KPIs, tables, forms, toasts) run through a lightweight i18n helper: `frontend/src/i18n/dict.ts` (EN source-of-truth + TH, typed by key) and `frontend/src/i18n/LanguageContext.tsx` (`useT()` → `{ lang, setLang, t }`, persisted to `localStorage['lang']`, **defaults to Thai**). Add a string by adding its key to both `en` and `th` in `dict.ts` (TS errors if TH is missing), then `t('key', { vars })` at the call site. The `EN | ไทย` toggle is `components/common/LanguageToggle.tsx` (rendered in the purchase flow and in `AdminLayout.tsx`'s sidebar). Admin uses the `admin.*` key namespace (one section per page, e.g. `admin.overview.*`, `admin.quotas.*`, plus `admin.common.*` for strings shared across pages via `TenantSelector`/`MetricChartImpl`); the purchase flow uses `pricing.*`/`checkout.*`/`orev.*`/etc. Tier brand names (Free/Starter/Growth/…) and the Carmen eyebrow stay as-is. The **printed proforma body is English-only** (titles, terms, amount-in-words); the catalog/checkout UI around it follows the bilingual toggle. Admin technical nouns (Quota, Session, LLM, MTD) may stay in English within Thai sentences where that reads naturally to a technical audience — don't force purist translation of internal admin jargon.
- **Stateless extraction** — `/extract` returns JSON immediately; DB writes only at `/submit` after user confirms.
- **No file storage** — uploaded images are read into memory, sent to LLM, then discarded. Nothing is written to disk. No `uploads/` or `exports/` directory. **One exception:** payment slips are persisted to the internal OneApp FileService (`services/storage_service.py` — `POST /Upload` → `fileId`, `GET /Files/{fileId}` → presigned URL, `X-Api-Key` auth). Postgres stores only the `fileId` in `credit_orders.slip_object_key`.
- **Single LLM call** — Vision LLM extracts structured JSON from image in one call; no separate OCR engine.
- **Tenant resolution at login** — `routers/auth.py` upserts a single `tenants` row keyed by the (host, bu) pair from Carmen JWT claims on every `/exchange` call. `tenant_id` is embedded in the JWT so subsequent requests read identity without a DB lookup. There is no separate `business_units` table — each (host, bu) pair is its own tenant.
- **FK-based tenancy** — Data-plane tables carry a single `tenant_id` NOT NULL FK (native `PGUUID(as_uuid=True)`). Observability log tables use `VARCHAR(36)` + index (no FK — high-volume append-only tables).
- **Bank code not enum** — `credit_cards.bank_code` FK → `banks.code` VARCHAR. No hardcoded `BankType` enum in the DB; adding a bank is an INSERT (pending Admin Dashboard for zero-redeploy).
- **Credit card line items are NOT persisted** — like AP invoices, credit-card transactions follow the extract-display-only pattern (Carmen ERP is source of truth). Only `credit_cards` header data is stored; line items live transiently in the API response (`CreditCardTransactionSchema`).
- **Soft delete everywhere** — Business tables never hard-delete. Always filter `WHERE deleted_at IS NULL`.
- **Quota engine** — `check_quota(module_id)` at start of every extract endpoint. Quotas stored in `quotas` + `quota_usage` tables; replaces legacy flat `bu_usage`.
- **module_id on every LLM call** — `log_llm_usage(module_id="credit_card_ocr")` instead of old `usage_type` string. Enables per-module cost breakdown in `daily_usage_summary`.
- **Shared LLM client** — `llm/client.py` is the sole `AsyncOpenAI` factory. Never construct it elsewhere.
- **AP invoice post-processing is non-trivial** — `ap_invoice_postprocess.py` must run after LLM.
- **AP review reconciliation (pin-based)** — In the Step-3 Account Summary, "From Table" (Σ line items) is reconciled against "From Document" (the immutable extracted footer totals). Every row keeps `lineTotal = lineSubTotal + taxAmt`, so the summary has only two free quantities (Σsub, Σtax) and `grand ≡ Σsub + Σtax`. Each per-field **Adjust** writes ONLY its own amount field on the plug row(s) and lets the total follow via `syncLineTotals` (`lib/apTax.ts`) — never re-deriving a sibling from the rate (that caused the old "whack-a-mole"). The header "From Document" values are the trusted anchor and are **never** re-synced from line sums (`hooks/ap-invoice/useAPInvoice.ts`).
- **Document self-inconsistency = misread digit** — When the printed footer itself doesn't add up (`sub + tax ≠ grand`, beyond a 1-satang tolerance), the LLM misread a figure; reconciling line items can never clear it. `repairDocFigure()` (`hooks/ap-invoice/useAPValidation.ts`) identifies the outlier using the line-item sums as tiebreaker and recomputes it from `grand = sub + tax`. **Hybrid apply**: high-confidence repairs (unambiguous outlier + gap ≤ `AUTO_FIX_MAX_GAP` = 1 baht) are auto-applied once on entering Step 3 (`step===3` effect, guarded by a ref so it never overrides later manual edits); ambiguous or large-gap cases surface a manual "Fix document figures" banner and suppress the per-field Adjust buttons (which would otherwise drag the corroborated table value onto the misread doc value).
- **Carmen proxy** — backend proxies all Carmen ERP requests (`routers/carmen.py` + `services/carmen_service.py`) to avoid CORS.
- **Migrations are Supabase CLI** — schema is owned by `supabase/migrations/*.sql`. Apply with `supabase db push`. Never edit or reorder applied migration files.
- **localStorage** — credit card: `accountingConfig`, `accountMappingAmount`. AP invoice: field mappings keyed by vendor name.
- **Service layer contract** — services never raise `HTTPException`; they raise typed exceptions from `app/exceptions.py`. The global handler in `factory.py` maps these to HTTP status codes.
- **App factory** — `app/factory.py` builds the FastAPI instance (middleware + exception handlers + routers). `app/lifecycle.py` owns lifespan (startup/shutdown + background tasks). `app/sentry.py` owns Sentry init. `app/main.py` is the thin entrypoint.
- **Quota enforcement** — `consume_quota()` in `services/quota_service.py` is the atomic check-and-increment used at every extract endpoint. `check_quota()` is read-only (pre-check only). Never call both.
- **Hook directory convention** — Feature hooks live in subdirectories: `hooks/ap-invoice/`, `hooks/credit-card/`, `hooks/mapping/`. Cross-cutting hooks (`useModal`, `useDarkMode`, `useCarmenSSO`) stay at top level. Each subdir has an `index.ts` barrel. All localStorage access goes through the tenant-aware `lib/storage.ts` (`appKey()`).
- **Pydantic schemas** — All request/response schemas in `app/models/schemas/` package. Never define `class X(BaseModel)` inside a router file.

---

## Adding a New Bank (current flow — code-based)

1. Create `backend/app/llm/prompts/<bank>.py` — export `LAYOUT`
2. Register in `backend/app/llm/prompts/__init__.py` → `_REGISTRY`
3. `INSERT INTO banks (code, name, ...) VALUES ('KTB', 'Krungthai Bank', ...)`
4. Add to `BANKS` in `frontend/src/constants/banks.ts`
5. Add detection in `detectBankFromCompanyName()` if needed

> **Future (Admin Dashboard):** Steps 1–2 replaced by Prompt CMS; steps 3–5 replaced by UI. Zero redeploy.

---

## Adding a New Module

1. `INSERT INTO modules (id, display_name) VALUES ('my_module', 'My Module')`
2. Create ORM models with `TenantFKMixin + TimestampMixin + SoftDeleteMixin + WriterMixin`
3. Create a new migration: `supabase migration new <name>` then add DDL
4. In the new router: `check_quota("my_module")` before LLM call
5. Pass `module_id="my_module"` to `log_llm_usage()`

---

## Auth Flow

```text
Carmen user → POST /api/v1/auth/exchange
  body: { token, bu, uri }
  1. Validate token against Carmen API
  2. UPSERT tenants by composite (host, bu_code) → tenant_id
  3. Create OcrSession (FK to tenants.id)
  4. Return JWT with tid/cuid/bu claims (bu is display-only)

Subsequent requests:
  Authorization: Bearer <jwt>
  → PerformanceMiddleware decodes JWT → sets context vars (no DB)
  → get_current_session() validates session alive → sets context vars
  → Services read current_tenant_id.get()
```

---

## Environment Variables (`backend/.env`)

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SUGGESTION_MODEL=google/gemini-2.0-flash-lite
OPENROUTER_AP_INVOICE_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?sslmode=require
MAX_FILE_SIZE_MB=20
APP_PORT=8010
# Secrets — NEVER put these in system_configs DB table
OCR_JWT_SECRET=<strong-random-secret>
SESSION_ENCRYPTION_KEY=<fernet-key>
INTERNAL_JOB_TOKEN=<hex-64-chars>   # must match vault.secrets where name='internal_job_token'
                                     # generate: python -c "import secrets; print(secrets.token_hex(32))"
FILE_SERVICE_URL=https://host/Api/v1/External/FileService  # OneApp FileService (slip upload)
FILE_SERVICE_API_KEY=fsc_...        # X-Api-Key client access key
```

---

## Database

**DB:** PostgreSQL (Supabase) — connected via Supavisor pooler (`...pooler.supabase.com`), database `postgres`. Supabase is used purely as a managed Postgres host: no Data API/Auth/Storage/Realtime client. Tenant isolation is application-layer (`tenant_id` FK), and the app connects with a privileged role — so the Supabase **Data API (PostgREST) must stay disabled** (or all `public` tables RLS-locked) to avoid bypassing the FastAPI layer. Pool is sized small (5+5=10) because session-mode pooling maps 1:1 to server connections, capped by Supavisor's 15-connection-per-project limit — this exact value is the fix for a documented `EMAXCONNSESSION` incident (`docs/LOAD_TEST_REPORT_V2.md` §6.1), not a value to casually increase. A `PoolEvents.checkout` listener sets `statement_timeout=30s` on every checkout (`app/database.py`) — verified empirically that Supavisor drops `server_settings` startup parameters and resets session GUCs between checkouts even on a reused physical connection, so `SET` must be re-applied per checkout, not per connect.

**Layer summary:**

| Layer | Tables |
|---|---|
| Identity | `tenants` (composite host+bu), `plans` |
| Admin RBAC | `admin_users`, `roles`, `permissions`, `role_permissions`, `admin_user_roles` |
| API Keys | `api_keys`, `api_key_usage` |
| Modules | `modules`, `tenant_modules` |
| Bank CMS | `banks`, `prompt_templates` |
| Config | `system_configs`, `tenant_config_overrides`, `feature_flags`, `bu_accounting_configs`, `bu_accounting_mapping_entries`, `ap_vendor_column_mappings`, `ap_vendor_field_mapping_entries` |
| Quotas | `quotas`, `quota_usage` |
| Billing | `credit_packs`, `tenant_credits`, `credit_ledger`, `credit_orders`, `billing_documents`, `tenant_subscriptions`, `ar_customer_profiles`, `document_sequences` |
| Reference | `model_pricing` |
| Business data | `ocr_sessions`, `ocr_tasks`, `credit_cards`, `ap_invoices`, `correction_feedback`, `bug_reports` |
| Observability | `llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs` |
| Analytics | `daily_usage_summary`, `daily_model_cost`, `monthly_usage_summary`, `anomaly_alerts`, `job_runs` |
| Migration tracker | `_supabase_migrations` (Supabase CLI tracking) |

**Date columns:** `credit_cards.doc_date`, `ap_invoices.doc_date` are `DATE` type. LLM string output is normalized via `app/utils/date_parsing.py` (handles DD/MM/YYYY, ISO, dashes, Thai Buddhist years) before insert. API output uses DD/MM/YYYY string for backward compatibility.

**Supported banks (pre-seeded):** `BBL` | `KBANK` | `SCB` | `BAY` | `KTC` | `GHL` | `PAYPAL` | `SIAMPAY` — BAY is a bank-statement layout; KTC/GHL/PAYPAL/SIAMPAY are processor *fee invoices*: one details row **per printed fee line** (`commis_amt`=that line's fee before VAT); the footer's printed VAT is spread proportionally across the lines (`tax_amt`, `pay_amt`=fee+VAT share, `total`=0). The prompt's final TOTAL summary row is consumed by `credit_card_service._normalize_fee_invoice` and never emitted as a detail row. If the footer can't be read, a lone line figure is treated as the fee before VAT at an assumed 7% rate and `ExtractedCreditCardData.warnings` carries a user-facing caveat (shown as an amber banner in the wizard).

**Supported files:** JPG, PNG, WebP, BMP, TIFF, HEIC/HEIF, PDF — max 20 MB (read into memory only, never persisted to disk; HEIC → JPEG via pillow-heif in `utils/image_processing.py`)

**`llm_usage_logs.module_id` values:** `credit_card_ocr` | `ap_invoice`

---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
