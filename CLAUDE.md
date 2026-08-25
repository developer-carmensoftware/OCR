# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For coding principles and standards, please refer to [skill.md](skill.md).

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

**Bruno API collections live outside this repo**, at `C:\Users\User\Desktop\` and
`C:\Users\User\Documents\bruno\` (e.g. `Desktop\Email Automation` for the Carmen Settings
API, `Documents\bruno\Carmen-AI` for the rest of Carmen's endpoints) — deliberately not
under `docs/` or anywhere git-tracked, since these collections carry live tokens
(`.env`, gitignored within each collection, but the point is to keep secrets off the
repo's disk entirely, not just off the commit). When asked to add or update a Bruno
collection, put or find it there, not inside the project directory.

---

## Changelog

Every meaningful change is logged in [`changelog/`](changelog/), **one file per day** (`changelog/YYYY-MM-DD.md`). This is the source of truth for status reports — write there instead of relying on `git log`.

- After making a meaningful change, add or update that day's file (create `changelog/<today>.md` if absent).
- **Prefix every entry with its time** as `` `HH:MM` `` (24h, ICT +0700). A grouped block of related work may carry one timestamp on its heading.
- Group by area (Backend / Frontend / DB / Infra) when useful; one terse bullet per change, link the commit hash once it exists.
- Put **uncommitted / in-progress** work in its own section so it's clear what hasn't shipped.
- See [changelog/README.md](changelog/README.md) for the full convention.
- **User-visible changes also need a release note** in [`frontend/src/content/releaseNotes.ts`](frontend/src/content/releaseNotes.ts) (2-4 bullets, EN + TH, keyed by date) — that file is what users read in the notification bell. Internal work gets a changelog entry only.
- **CI enforces this**: the `changelog-check` job fails any PR that touches no `changelog/` file (escape hatch: `skip-changelog` label). Add/update today's entry **in the same commit/branch as the change, before opening the PR** — don't wait for CI to fail first.

---

## Versioning

**SemVer, stored once in the repo-root [`VERSION`](VERSION) file.** Everything derives from it:
`backend/app/config.py` (`_read_version()` → `app_version` → `/api/version`, `/docs`),
`frontend/vite.config.ts` (+ `vitest.config.js`) bake it in as `__APP_VERSION__` (shown on Home),
and `deploy.yml` tags the GitHub Release `v$(cat VERSION)`. `APP_VERSION` in the env still
overrides the backend value, but it is an override, not the source.

| Bump | When |
|---|---|
| **PATCH** | bug fix, prompt tweak, perf, copy fix — nothing new to learn |
| **MINOR** | new user-visible capability: a module, a bank, an admin page, a wizard step |
| **MAJOR** | breaks someone outside this repo — Carmen posting contract, `/api/v1` shape, forced re-onboard/re-consent |

Refactors, CI, and dependency bumps bump **nothing** — same rule `releaseNotes.ts` uses. A deploy
with no version bump hits the existing tag and simply skips the release; that is the intended path,
not a failure.

Releasing = edit `VERSION` **and** add the matching `version:` to the newest `releaseNotes.ts`
entry, in the same commit. `releaseNotes.test.ts` fails if they disagree. Dates keep their own
jobs: `changelog/YYYY-MM-DD.md` filenames and the release-note identity/seen-key — a date is never
a version.

---

## Architecture

### Credit Card OCR (5-step wizard)

```text
useOcrWizard hook
  → POST /api/v1/credit-card/extract
      routers/ocr.py           consume_document() → vision LLM → ExtractedCreditCardData
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
      routers/ap_invoice.py    consume_document() → vision LLM
      ap_invoice_postprocess   tax-type detection, footer discount distribution, per-line totals
      llm_usage_logger.log_llm_usage()  silent-failure token logging → llm_usage_logs
  → Step 2: column→field mapping  persisted to localStorage per vendor name
  → POST /api/v1/ap-invoice/suggest
      ap_invoice_service       pre-filters expense accounts → LLM → deptCode/accountCode
  → POST /api/v1/carmen/invoice  submit to Carmen ERP
```

### Email ingestion (no wizard — nobody reviews before it posts)

Built, merged, live-tested end to end. **Full docs: [`docs/email-automation/`](docs/email-automation/)**
(requirements → architecture → API → data model → operations → decision log). Read those
before changing anything here; the block below is only the shape.

```text
pg_cron → POST /api/v1/email/ingest  (internal job token)
  services/email_ingest_service.py
      AIAGENT+<tag>@…   tag from the envelope → tenant     ← routing, costs nothing
      email_documents   claim the row (dedupe: message × attachment)
      email_ingest_settings  filename must match one of this BU's rules; this BU's PDF passwords
      consume_document() → same extract → GL-map → POST JV path as the Credit Card wizard
      tax ID vs this BU's register  ← verification, not routing; parks only on positive conflict
```

Two properties that make it unlike the wizards: the tag is read **before any LLM call**, so
an unowned message costs nothing; and there is no human between extraction and posting, so a
`warnings` field that merely draws an amber banner in a wizard has no reader here. Neither
cron job (`email-ingest`, `email-token-health`) is scheduled in production yet — see
[`05-operations.md`](docs/email-automation/05-operations.md#scheduling).

### Admin dashboard (`#/admin/*`) — check here before writing SQL

18 pages already exist. **Read this table before hand-querying the DB** — on 2026-07-16
a full day went into ad-hoc SQL to answer questions that four of these pages already
answered, purely because nobody knew they were there.

| Question | Page | Reads |
|---|---|---|
| What needs me right now? | `#/admin` Overview | LLM calls/cost MTD, error rate, open alerts |
| | `#/admin/anomalies` | `anomaly_alerts` (+ resolve) |
| Is the pilot working? | `#/admin/tenants` | per-BU engagement: scanned vs **posted to Carmen**, active weeks, days idle, + adoption funnel |
| | `#/admin/usage` | date×module×tenant docs/calls/tokens/cost |
| | `#/admin/user-usage` | same, broken down by **individual Carmen user** rather than BU |
| | `#/admin/tenant-ranking` | rank by cost/error rate/latency/volume |
| | `#/admin/quota-modules` | **who is about to run out of documents**, per-module usage, module on/off |
| Why isn't it working? | `#/admin/extractions` | **why an extraction failed** — `ocr_tasks.error_message`, grouped by cause |
| | `#/admin/errors` | error *counts* — `ocr_tasks` by module, `performance_logs` 5xx by tenant/endpoint |
| | `#/admin/performance` | request latency |
| Who pays / what does it cost? | `#/admin/credits`, `#/admin/credit-orders`, `#/admin/llm-logs` | balances & ledger, order queue, per-call cost |
| Is the machine running? | `#/admin/sessions`, `#/admin/jobs` | live sessions (+revoke), **`job_runs` cron health** |
| | `#/admin/email` | email-ingestion runs + cron health |
| | `#/admin/maintenance` | maintenance-mode flag + window (what `MaintenanceGate` reads) |
| Who can touch it? | `#/admin/admin-users` | RBAC |

Gotchas worth knowing before trusting a number:

- **`/error-breakdown` switches data source by `group_by`** — `module` reads `ocr_tasks`
  (real extraction failures); `tenant`/`endpoint` read `performance_logs` 5xx. "Which BU
  has failing extractions" is **not** answerable there; use Extractions.
- **Extractions covers post-charge failures only.** A PDF rejected by `ensure_pdf_openable`
  (password-protected, corrupt) 400s before `create_task` runs, so it never gets an
  `ocr_tasks` row. Zero on that page ≠ zero in reality.
- **`tenants.last_used_at` is `max(llm_usage_logs.created_at)`** — blind to attempts that
  never reached the model. The Tenants page renders task-derived `last_use` instead.
- **`GET /admin/tenants` needs `include_engagement=true`** for the engagement fields. It is
  off by default because `TenantSelector` calls the same endpoint on five other pages.
- Adding a page = 4 edits: `lazy()` in `main.tsx`, an `else if` in `AdminRouter`, a `NavItem`
  in `AdminLayout.getNavSections`, and `admin.nav.item.*` in **both** `en` and `th` of
  `i18n/dict.ts` (TS fails the build if TH is missing). For the table itself, follow the
  pattern below rather than inventing per-page state.

**The admin table pattern** (`hooks/admin/useTableQuery.ts` + `components/admin/DataTable.tsx`):

- `useTableQuery` owns filters, sort, and page, and keeps them **in the URL** (after the
  route hash, `replaceState`, defaults omitted) so a view survives navigation and can be
  pasted to a colleague. `.server(total)` hands straight to `<DataTable server={…} />`.
- `DataTable` has a **server mode** (`server` prop set — API sorts, filters, and pages) and a
  **client mode** (rows already in hand). Four endpoints are deliberately client-side:
  `/usage-summary`, `/quotas/overview`, `/tenant-ranking`, `/error-breakdown` return small
  *complete* sets, so browser sorting is truthful there. Extractions stays unpaged (it groups
  failures by cause; grouping one page reports wrong counts) and Credit Orders loads the
  endpoint's cap in one go (its search must reach past the visible page). Don't "fix" these
  into server mode — each shows a real `total` so a bitten cap is visible.
- **Page size is measured, not configured** — `hooks/useFitRows.ts` fits rows to the
  viewport; `pageSize` survives only as an override for tables that aren't viewport-bound.
- ⚠️ **In server mode the measured size feeds the fetch, so the measurement must never
  shrink in response to its own rows.** 15 rows leave room that measures as 17, 17 leave
  room that measures as 15, and the tab fetches forever. `DataTable` keeps a monotonic
  high-water mark per viewport size (a real resize clears it); `DataTable.fetchloop.test.tsx`
  is the regression test, and reverting the guard makes it hang. This shipped as a bug on
  2026-08-24 — read that changelog entry before touching the measurement.

The SQL behind the adoption views lives in [`backend/db/queries.sql`](backend/db/queries.sql)
items 11–14 — useful for cross-checking a page against the raw numbers.

**Before claiming anything is slow, read [`docs/SQL_PERFORMANCE_AUDIT.md`](docs/SQL_PERFORMANCE_AUDIT.md).**
Measured 2026-08-19: the whole database executes **18.5 minutes of SQL per 68 days** (0.019%
duty cycle), the largest business table holds 342 rows, and no application query appears in
the top 20 CPU consumers. Endpoint p50 *has* tripled since June, but SQL is ≤3% of that wall
time and the instance still answers a request in 1 ms — so latency work belongs in the app
layer, not in query tuning (§3.1e lists the leads, strongest being **3.2 pooler
authentications per HTTP request**). `queries.sql` items **15–24** are the measurement pack;
re-run them and diff rather than re-deriving. Run them **only from the Supabase SQL Editor** —
an ad-hoc script while `uvicorn` is up hits the 15-connection Supavisor cap.

---

## Key Design Decisions

- **English is the default UI language** — All UI text, labels, buttons, copy, and user-facing error messages default to **English**. Write new surfaces in English first. Thai is reserved for user-supplied content that is inherently Thai (vendor names, GL labels, extracted invoice text) and for explicit per-locale translation; never default a new label/component to Thai. This applies to the internal OCR wizards and mapping UI.
  - **Bilingual (EN/TH) surfaces: the customer-facing purchase flow and the admin dashboard.** `#/pricing` + `#/pricing/orders` (catalog → checkout → QR → slip → order history) and `#/admin/*` (nav, KPIs, tables, forms, toasts) run through a lightweight i18n helper: `frontend/src/i18n/dict.ts` (EN source-of-truth + TH, typed by key) and `frontend/src/i18n/LanguageContext.tsx` (`useT()` → `{ lang, setLang, t }`, persisted to `localStorage['lang']`, **defaults to Thai**). Add a string by adding its key to both `en` and `th` in `dict.ts` (TS errors if TH is missing), then `t('key', { vars })` at the call site. The `EN | ไทย` toggle is `components/common/LanguageToggle.tsx` (rendered in the purchase flow and in `AdminLayout.tsx`'s sidebar). Admin uses the `admin.*` key namespace (one section per page, e.g. `admin.overview.*`, `admin.quotas.*`, plus `admin.common.*` for strings shared across pages via `TenantSelector`/`MetricChartImpl`); the purchase flow uses `pricing.*`/`checkout.*`/`orev.*`/etc. Tier brand names (Free/Starter/Growth/…) and the Carmen eyebrow stay as-is. The **printed proforma body is English-only** (titles, terms, amount-in-words); the catalog/checkout UI around it follows the bilingual toggle. Admin technical nouns (Quota, Session, LLM, MTD) may stay in English within Thai sentences where that reads naturally to a technical audience — don't force purist translation of internal admin jargon.
- **Stateless extraction** — `/extract` returns the extracted JSON immediately rather than staging a server-side draft. It does write bookkeeping rows (`ocr_tasks`, plus the `credit_cards`/`ap_invoices` header via `finalize_extraction`); what waits for `/submit` is the Carmen posting and the `submitted_at` stamp. Line items are never persisted.
- **No file storage** — uploaded images are read into memory, sent to LLM, then discarded. Nothing is written to disk. No `uploads/` or `exports/` directory. **One exception:** payment slips are persisted to the internal OneApp FileService (`services/storage_service.py` — `POST /Upload` → `fileId`, `GET /Files/{fileId}` → presigned URL, `X-Api-Key` auth). Postgres stores only the `fileId` in `credit_orders.slip_object_key`.
- **Single LLM call** — Vision LLM extracts structured JSON from image in one call; no separate OCR engine.
- **Tenant resolution at login** — `routers/auth.py` upserts a single `tenants` row keyed by the (host, bu) pair from Carmen JWT claims on every `/exchange` call. `tenant_id` is embedded in the JWT so subsequent requests read identity without a DB lookup. There is no separate `business_units` table — each (host, bu) pair is its own tenant.
- **FK-based tenancy** — Data-plane tables carry a single `tenant_id` NOT NULL FK (native `PGUUID(as_uuid=True)`). Observability log tables use `VARCHAR(36)` + index (no FK — high-volume append-only tables).
- **Bank code not enum** — `credit_cards.bank_code` FK → `banks.code` VARCHAR. No hardcoded `BankType` enum in the DB; adding a bank is an INSERT (pending Admin Dashboard for zero-redeploy).
- **Credit card line items are NOT persisted** — like AP invoices, credit-card transactions follow the extract-display-only pattern (Carmen ERP is source of truth). Only `credit_cards` header data is stored; line items live transiently in the API response (`CreditCardTransactionSchema`).
- **Soft delete everywhere** — Business tables never hard-delete. Always filter `WHERE deleted_at IS NULL`.
- **Two document pools, not three** — a scan is charged by `consume_document()` (`services/credit_service.py`): the active subscription's monthly allowance first (use-it-or-lose-it), then `tenant_credits.balance` (never expires). The free trial is not a third pool — a new tenant is granted 30 credits (`signup_grant` ledger reason) in the same transaction that creates their tenant row, which is what makes it a one-time grant. The old `quotas`/`quota_usage` counter engine was retired by migration `20260813000100` and the tables were dropped by `20260825000000`. What survived that retirement is only `assert_module_enabled()`, which now lives in `services/module_gate.py` (renamed from `quota_service.py` 2026-08-18 — the old name described an engine that no longer exists).
- **module_id on every LLM call** — `log_llm_usage(module_id="credit_card_ocr")` instead of old `usage_type` string. Enables per-module cost breakdown in `daily_usage_summary`.
- **Shared LLM client** — `llm/client.py` is the sole `AsyncOpenAI` factory. Never construct it elsewhere.
- **LLM privacy is enforced per-request, not via dashboard** — `_provider_prefs()` in `llm/client.py` attaches `extra_body={"provider": {"data_collection": "deny", ...}}` to EVERY OpenRouter call (vision + text). This is the technical enforcement of the consent-modal no-training promise (`UserConsentModal.tsx`); it does not rely on the OpenRouter account dashboard toggles (which can drift silently). `LLM_TEXT_PROVIDER_ALLOWLIST` additionally pins the non-Google suggestion model to US-jurisdiction providers. Prod logs CRITICAL if `LLM_DATA_COLLECTION != "deny"`. The dashboard's Google-ZDR toggle (disable AI Studio, keep Vertex) is a manual second layer — see `docs/SECURITY_PDPA_CHECKLIST.md`.
- **Consent is recorded server-side** — `consent_logs` (append-only, no soft-delete, no retention purge — legal evidence, PDPA ม.19) is the source of truth for AI-processing consent; `POST/GET /api/v1/consent`. Org-level (keyed on `tenant_id`). `useUserConsent.ts` treats localStorage only as a fast-path cache; `CONSENT_VERSION` bumps re-prompt every tenant so a real server record exists.
- **AP invoice post-processing is non-trivial** — `ap_invoice_postprocess.py` must run after LLM.
- **AP review reconciliation (pin-based)** — In the Step-3 Account Summary, "From Table" (Σ line items) is reconciled against "From Document" (the immutable extracted footer totals). Every row keeps `lineTotal = lineSubTotal + taxAmt`, so the summary has only two free quantities (Σsub, Σtax) and `grand ≡ Σsub + Σtax`. Each per-field **Adjust** writes ONLY its own amount field on the plug row(s) and lets the total follow via `syncLineTotals` (`lib/apTax.ts`) — never re-deriving a sibling from the rate (that caused the old "whack-a-mole"). The header "From Document" values are the trusted anchor and are **never** re-synced from line sums (`hooks/ap-invoice/useAPInvoice.ts`).
- **Document self-inconsistency = misread digit** — When the printed footer itself doesn't add up (`sub + tax ≠ grand`, beyond a 1-satang tolerance), the LLM misread a figure; reconciling line items can never clear it. `repairDocFigure()` (`hooks/ap-invoice/useAPValidation.ts`) identifies the outlier using the line-item sums as tiebreaker and recomputes it from `grand = sub + tax`. **Hybrid apply**: high-confidence repairs (unambiguous outlier + gap ≤ `AUTO_FIX_MAX_GAP` = 1 baht) are auto-applied once on entering Step 3 (`step===3` effect, guarded by a ref so it never overrides later manual edits); ambiguous or large-gap cases surface a manual "Fix document figures" banner and suppress the per-field Adjust buttons (which would otherwise drag the corroborated table value onto the misread doc value).
- **Carmen proxy** — backend proxies all Carmen ERP requests (`routers/carmen.py` + `services/carmen_service.py`) to avoid CORS.
- **Migrations are Supabase CLI** — schema is owned by `supabase/migrations/*.sql`. Apply with `supabase db push`. Never edit or reorder applied migration files.
- **localStorage** — credit card: `accountingConfig`, `accountMappingAmount`. AP invoice: field mappings keyed by vendor name.
- **Service layer contract** — services never raise `HTTPException`; they raise typed exceptions from `app/exceptions.py`. The global handler in `factory.py` maps these to HTTP status codes.
- **App factory** — `app/factory.py` builds the FastAPI instance (middleware + exception handlers + routers). `app/lifecycle.py` owns lifespan (startup/shutdown + background tasks). `app/sentry.py` owns Sentry init. `app/main.py` is the thin entrypoint.
- **Charge before the LLM, refund only when the LLM never ran** — `consume_document()` runs at every extract endpoint AFTER `ensure_pdf_openable` and `assert_module_enabled` (so a locked PDF or a disabled module never costs a document) and returns what it charged; pass that to `refund_document()` for the files that failed. Both fail open on infra errors — only a real out-of-credits raises `InsufficientCredits` (402). **The refund test is "did the vision call happen", not "did the document post".** In the wizards every refund site is an extraction that threw, so the user got nothing back. Email ingest states the same rule explicitly: `_run_document()` has a single **refund boundary** (`email_ingest_service.py`) wrapping `create_task` + `extract_stateless` + `finalize_extraction`, and it is the only place in that pipeline that refunds — once extraction returns, the document is charged whatever happens next (`duplicate_document`, `tax_id_mismatch`, `mapping_incomplete`, any `carmen_rejected`). That is why `_Skip` carries no refund flag. Ingest deliberately matches the wizard here, which has always charged for a duplicate because `finalize_extraction` only sets an `is_duplicate` flag rather than raising.
- **What one document costs differs per module** — credit card charges **per file** (`increment=len(file_data)`), AP invoice charges **per page sent to the LLM** (`billable_pages()` in `utils/pages.py`, capped at `MAX_PAGES_PER_CALL`=5): a 3-page selection costs 3, and 3 images merged client-side into one PDF cost 3. `ensure_pdf_openable()` returns the page count for exactly this. The whole N is charged to one pool — a tenant with 3 subscription docs left scanning 5 pages pays 5 credits and strands the 3. **`ocr_tasks.charged_docs` records what each task cost** — nothing else can (a subscription-funded scan writes no ledger row; `credit_ledger.ref` is the filename, since the charge precedes `create_task`). Count documents with `SUM(charged_docs)`, never `COUNT(ocr_tasks)`.
- **Hook directory convention** — Feature hooks live in subdirectories, one per feature: `hooks/admin/`, `hooks/ap-invoice/`, `hooks/credit-card/`, `hooks/credits/`, `hooks/email-settings/`, `hooks/mapping/`, `hooks/notifications/`. Cross-cutting hooks (`useModal`, `useDarkMode`, `useCarmenSSO`, `useFitRows`) stay at top level. Each subdir has an `index.ts` barrel. All localStorage access goes through the tenant-aware `lib/storage.ts` (`appKey()`).
- **Pydantic schemas** — All request/response schemas in `app/models/schemas/` package. Never define `class X(BaseModel)` inside a router file.
- **Every list endpoint answers the same envelope** — `Page[T]` = `{total, limit, offset, data}` (`models/schemas/common.py`), built by `paginate()` (`utils/pagination.py`), mirrored on the frontend by `lib/api/page.ts`. `total` is counted off the **unlimited** statement with `ORDER BY` stripped, so a truncated window can always say *"showing 200 of 340"* instead of ending silently — `len(data)` as a total is the bug class this exists to kill. A query selecting several entities uses `count_rows()` + its own `.all()` instead, because `paginate()`'s `.scalars()` would flatten each row to the first entity.

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
4. In the new router: `assert_module_enabled("my_module")` then `consume_document()` before the LLM call
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

**[`backend/.env.example`](backend/.env.example) is the complete list (48 vars) and the source
of truth.** Below is only the annotated subset whose *values* carry a decision worth explaining —
if a var isn't here, read `.env.example`, don't assume it doesn't exist.

**These hard-fail prod boot if unset or left at a dev default** (see `app/config.py` validators):
`ADMIN_JWT_SECRET`, `OCR_JWT_SECRET`, `SESSION_ENCRYPTION_KEY`, `ALLOWED_ORIGINS` (no wildcard),
`ALLOWED_CARMEN_HOSTS`. `TRUST_PROXY` + `TRUSTED_PROXY_HOPS` must match the actual proxy depth or
client-IP logging and rate limiting read a spoofable header.

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SUGGESTION_MODEL=google/gemini-2.0-flash-lite
OPENROUTER_AP_INVOICE_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
LLM_DATA_COLLECTION=deny            # per-request no-train/no-collect enforcement (see Key Design Decisions)
LLM_REQUIRE_ZDR=false               # strict Zero-Data-Retention routing (off until every model verified ZDR-capable)
LLM_TEXT_PROVIDER_ALLOWLIST=fireworks,deepinfra,digitalocean  # pin non-Google text model to US providers
LLM_VISION_PROVIDER_ALLOWLIST=      # vision is Google-only already
LLM_EXPECTED_PROVIDERS=Google,DeepInfra,Fireworks,DigitalOcean  # alert if routed elsewhere (llm_provider_out_of_policy)
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?sslmode=require
MAX_FILE_SIZE_MB=5
# Secrets — NEVER put these in system_configs DB table
OCR_JWT_SECRET=<strong-random-secret>
SESSION_ENCRYPTION_KEY=<fernet-key>
INTERNAL_JOB_TOKEN=<hex-64-chars>   # must match vault.secrets where name='internal_job_token'
                                     # generate: python -c "import secrets; print(secrets.token_hex(32))"
FILE_SERVICE_URL=https://host/Api/v1/External/FileService  # OneApp FileService (slip upload)
FILE_SERVICE_API_KEY=fsc_...        # X-Api-Key client access key
# Email ingestion — full var table in docs/email-automation/05-operations.md.
# IMAP_HOST empty = ingestion disabled, which is the correct default everywhere it
# isn't deliberately switched on. Set the rest only alongside it.
IMAP_HOST=                          # empty = disabled
IMAP_PORT=993
IMAP_USER=
IMAP_PASSWORD=
IMAP_FOLDER=INBOX
EMAIL_INGEST_ADDRESS=ocr@carmensoftware.com   # dev default; per-BU routing uses <user>+<tag>@…
                                     # prod is AIAGENT@carmensoftware.com, not this mailbox
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
| Billing | `credit_packs`, `tenant_credits`, `credit_ledger`, `credit_orders`, `billing_documents`, `tenant_subscriptions`, `ar_customer_profiles`, `document_sequences` |
| Reference | `model_pricing` |
| Business data | `ocr_sessions`, `ocr_tasks`, `credit_cards`, `ap_invoices`, `correction_feedback`, `bug_reports`, `consent_logs`, `user_notifications` |
| Email ingestion | `email_ingest_settings` (per-BU tag, rules, PDF passwords, posting credential), `email_documents` (one row per message×attachment — dedupe key **and** audit trail) — see [`docs/email-automation/04-data-model.md`](docs/email-automation/04-data-model.md) |
| Observability | `llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs` |
| Analytics | `daily_usage_summary`, `daily_model_cost`, `monthly_usage_summary`, `anomaly_alerts`, `job_runs` |
| Migration tracker | `_supabase_migrations` (Supabase CLI tracking) |

**Date columns:** `credit_cards.doc_date`, `ap_invoices.doc_date` are `DATE` type. LLM string output is normalized via `app/utils/date_parsing.py` (handles DD/MM/YYYY, ISO, dashes, Thai Buddhist years) before insert. API output uses DD/MM/YYYY string for backward compatibility.

**Supported banks (pre-seeded):** `BBL` | `KBANK` | `SCB` | `BAY` | `KTC` | `GHL` | `PAYPAL` | `SIAMPAY` — BAY is a bank-statement layout; KTC/GHL/PAYPAL/SIAMPAY are processor *fee invoices*: one details row **per printed fee line** (`commis_amt`=that line's fee before VAT); the footer's printed VAT is spread proportionally across the lines (`tax_amt`, `pay_amt`=fee+VAT share, `total`=0). The prompt's final TOTAL summary row is consumed by `credit_card_service._normalize_fee_invoice` and never emitted as a detail row. If the footer can't be read, a lone line figure is treated as the fee before VAT at an assumed 7% rate and `ExtractedCreditCardData.warnings` carries a user-facing caveat (shown as an amber banner in the wizard).

**Supported files:** JPG, PNG, WebP, BMP, TIFF, HEIC/HEIF, PDF — max 5 MB (read into memory only, never persisted to disk; HEIC → JPEG via pillow-heif in `utils/image_processing.py`)

**`llm_usage_logs.module_id` values:** `credit_card_ocr` | `ap_invoice`

---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
