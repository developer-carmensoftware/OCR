# Graph Report - OCR  (2026-05-29)

## Corpus Check
- 123 files · ~54,479 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 908 nodes · 1440 edges · 119 communities (98 shown, 21 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 273 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f65a0d18`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 44 edges
2. `TaskStatus` - 24 edges
3. `BankType` - 24 edges
4. `adminFetch()` - 19 edges
5. `getCarmenUrl()` - 17 edges
6. `showToast()` - 16 edges
7. `CarmenAPIError` - 16 edges
8. `async_session()` - 15 edges
9. `Base` - 14 edges
10. `_client()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `README — Bank Receipt OCR & Import System` --references--> `Bangkok Bank (BBL) Receipt / Tax Invoice Sample`  [INFERRED]
  README.md → backend/example_field/BBLbank.png
- `README — Bank Receipt OCR & Import System` --references--> `Kasikornbank (KBANK) Receipt / Tax Invoice Sample`  [INFERRED]
  README.md → backend/example_field/Kbank.png
- `README — Bank Receipt OCR & Import System` --references--> `SCB (Siam Commercial Bank) Receipt / Tax Invoice Sample`  [INFERRED]
  README.md → backend/example_field/SCBBank.png
- `Bangkok Bank (BBL) Receipt / Tax Invoice Sample` --conceptually_related_to--> `Credit Card OCR 5-Step Wizard`  [INFERRED]
  backend/example_field/BBLbank.png → CLAUDE.md
- `Bangkok Bank (BBL) Receipt / Tax Invoice Sample` --conceptually_related_to--> `Bank Prompt Registry Pattern`  [INFERRED]
  backend/example_field/BBLbank.png → CLAUDE.md

## Hyperedges (group relationships)
- **Bank Receipt OCR Core Flow (Upload → LLM Extract → Review → Submit)** — concept_credit_card_ocr_wizard, rationale_stateless_extraction, rationale_single_llm_call, rationale_bank_prompt_registry, concept_duplicate_doc_check [EXTRACTED 0.95]
- **Multi-Tenant Request Routing Mechanism** — rationale_multitenant_separate_schema, concept_tenant_context_var, concept_engine_registry [EXTRACTED 0.95]
- **LLM Quality Improvement Loop (Correction Feedback → Hints → Prompt Injection)** — rationale_correction_learning, rationale_bank_prompt_registry, concept_credit_card_ocr_wizard [INFERRED 0.85]

## Communities (119 total, 21 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (72): Base, Base, BaseModel, DeclarativeBase, Enum, BankType, DocumentType, TaskStatus (+64 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (37): addDays(), buildInvoicePayload(), addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (29): AdminLayout(), AdminLogin(), AdminProtectedRoute(), handleResolve(), load(), handleRevoke(), load(), adminFetch() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (38): CarmenServiceError, DuplicateDocumentError, ExtractionError, LLMParseError, LLMServiceError, Typed application exceptions.  Raise these instead of generic RuntimeError so, LLM API call failed (network, auth, rate-limit). → 503, LLM returned content that could not be parsed as JSON. → 422 (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (15): diffCorrections(), logCorrections(), mapFieldName(), useFileUpload(), useOcrExtraction(), useOcrSubmission(), useOcrWizard(), useModal() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (39): Exception, AI-suggest dept/acc for AP invoice expense items using category + description., suggest_gl(), proxy_account_codes(), proxy_create_input_tax(), proxy_create_invoice(), proxy_departments(), proxy_gl_prefix() (+31 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (20): useAPExtraction(), useAPInvoice(), useAPSubmission(), useAPValidation(), useAPVendor(), useAPExtraction(), useAPSubmission(), useAPValidation() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (13): APReviewStep(), HEADER_FIELDS(), APSuccessStep(), VendorSearch(), AuthScreen(), fmt(), isNumFld(), parseNum() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (18): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (27): build_ap_expense_prompt(), build_fixed_fields_prompt(), build_payment_types_prompt(), Prompt builders for GL account mapping suggestions., Standard ToolResult — unified response format for all tools.  Every tool retur, Standardized output from any tool invocation., ToolResult, Tool: extract_card  Wraps the stateless OCR pipeline:   preprocess image → Vi (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (33): Backend Python Requirements, CHANGELOG — Unreleased 2026-05-02, CLAUDE.md Project Guide, AP Invoice 5-Step Wizard, Credit Card OCR 5-Step Wizard, Data Retention & Archival Policy, Duplicate Document Number Check (submitted_at IS NOT NULL), Per-Tenant Engine Registry (_ENGINES) (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (26): get_current_session(), FastAPI dependency — resolves the current authenticated session from JWT + DB., Validates the OCR JWT, looks up the session record, and returns a SessionInfo, create_session_jwt(), decode_session_jwt(), decrypt_carmen_token(), encrypt_carmen_token(), extract_user_id_from_token() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (12): getAccountingConfig(), handleSelect(), AccountingReview(), buildRows(), fmt(), handleAddInputTax(), parseJvhDate(), useAccountingConfig() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (20): _db_root_url(), get_all_tenants(), get_db(), _get_engine(), _get_session_factory(), init_db(), _m021_remove_tenant_columns(), migrate_all_tenants() (+12 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (13): FileService, Centralized service for file validation and handling.     Implements security c, validate_and_read(), export_tasks_to_csv(), extract_stateless(), OCR Service — stateless extraction + task listing/export helpers., Stateless OCR extraction:     resize → OpenRouter vision LLM → return structure, Export submitted credit card documents to CSV — one row per transaction label. (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.3
Nodes (13): _build_deposit_row(), _compute_line_totals(), _detect_tax_type(), _distribute_footer_discount(), _num(), postprocess(), _r2(), Post-process raw AP-invoice extraction from LLM into the final shape expected b (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (10): lifespan(), _pricing_sync_loop(), Sync OpenRouter model pricing into every tenant DB every 8 hours., Initialize database on startup, start background scheduler., Returns app version and registered prompt versions for audit/traceability., Run an async coroutine factory once per provisioned tenant, setting current_tena, Lightweight background scheduler — runs inside the FastAPI event loop.      Sc, _run_for_all_tenants() (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.27
Nodes (7): detectBankFromCompanyName(), detectBankFromExtracted(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape()

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (9): async_session(), Context-aware session — backward-compatible with all existing     `async with a, _estimate_cost(), fetch_openrouter_pricing(), _get_pricing(), log_llm_usage(), Get pricing from cache or DB., Calculate cost in USD. (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.24
Nodes (9): Manually trigger archive + cleanup for the current tenant., trigger_retention(), archive_and_cleanup(), _process_table(), purge_inactive_sessions(), Retention Service — archive old log rows to CSV, then delete from DB.  Runs ni, Delete ocr_sessions rows that have been inactive (is_active=0)     for more tha, For each table in RETENTION_POLICY:       1. SELECT rows older than retention p (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (5): Admin Router — usage summary queries + manual trigger endpoints.  All endpoint, Manually rebuild daily summary for the current tenant., Manually sync LLM pricing from OpenRouter API., trigger_pricing_sync(), trigger_summary_rebuild()

### Community 22 - "Community 22"
Cohesion: 0.31
Nodes (7): BaseHTTPMiddleware, PerformanceMiddleware, _persist(), Decode user_id from JWT without DB lookup — lightweight, never raises., Derive tenant from Origin header.     Strictly validates the subdomain to preve, _tenant_from_request(), _user_id_from_request()

### Community 23 - "Community 23"
Cohesion: 0.32
Nodes (7): get_tool_schema(), invoke_tool(), list_tools(), Tools Router — HTTP interface to the tool registry.  Endpoints:   GET  /api/v, List all registered tools with their descriptions and input schemas., Return description and input schema for a single tool., Invoke a registered tool by name.      Request body: JSON object whose keys ma

### Community 24 - "Community 24"
Cohesion: 0.43
Nodes (7): copy_global_table(), copy_tenant_table(), get_distinct_tenants(), mark_migrations_applied(), One-time migration: ocr_db (shared schema) → carmen_ai_{tenant} (separate schema, run(), table_exists()

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (5): Config, Application configuration — loads settings from .env file., Application settings loaded from environment variables / .env file., Settings, BaseSettings

### Community 26 - "Community 26"
Cohesion: 0.38
Nodes (6): _aggregate(), backfill_summaries(), build_daily_summary(), Summary Service — build daily usage aggregates for the current tenant.  Runs n, Rebuild summaries for a date range (inclusive). Returns count of days processed., Aggregate one day's data into daily_usage_summary for the current tenant.     T

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (4): ensure_partitions(), _quarter_boundaries(), Partition Manager — auto-create quarterly partitions for hot log tables.  Runs, Check each partitioned table and create missing quarterly partitions.     Opera

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): Hash-Based Routing for IIS Static Deployment, IIS Deployment Guide (Windows Server), Frontend Entry HTML (CARMEN CLOUD AI AUTOMATION)

## Knowledge Gaps
- **143 isolated node(s):** `Start the backend server with UTF-8 mode enabled (fixes Windows charmap errors).`, `Config`, `Application configuration — loads settings from .env file.`, `Application settings loaded from environment variables / .env file.`, `Request-scoped context variables.  Set by `auth/dependencies.py` for each auth` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 1` to `Community 8`, `Community 4`, `Community 12`, `Community 6`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `async_session()` connect `Community 18` to `Community 0`, `Community 3`, `Community 5`, `Community 11`, `Community 13`, `Community 19`, `Community 22`, `Community 26`, `Community 29`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `createApiClient()` connect `Community 8` to `Community 2`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `apiFetch()` (e.g. with `handleSubmit()` and `fetchAccountCodes()`) actually correct?**
  _`apiFetch()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `TaskStatus` (e.g. with `OCRTask` and `CreditCard`) actually correct?**
  _`TaskStatus` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `BankType` (e.g. with `OCRTask` and `CreditCard`) actually correct?**
  _`BankType` has 21 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Start the backend server with UTF-8 mode enabled (fixes Windows charmap errors).`, `Config`, `Application configuration — loads settings from .env file.` to the rest of the system?**
  _143 weakly-connected nodes found - possible documentation gaps or missing edges._