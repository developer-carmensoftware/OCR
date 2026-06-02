# Graph Report - OCR  (2026-06-02)

## Corpus Check
- 126 files · ~57,441 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 926 nodes · 1475 edges · 113 communities (92 shown, 21 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 279 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d0289cc4`
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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 45 edges
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
- `handleSubmit()` --calls--> `apiFetch()`  [INFERRED]
  components/common/BugReportButton.tsx → lib/api/client.ts
- `README — Bank Receipt OCR & Import System` --references--> `Bangkok Bank (BBL) Receipt / Tax Invoice Sample`  [INFERRED]
  README.md → backend/example_field/BBLbank.png
- `README — Bank Receipt OCR & Import System` --references--> `Kasikornbank (KBANK) Receipt / Tax Invoice Sample`  [INFERRED]
  README.md → backend/example_field/Kbank.png
- `README — Bank Receipt OCR & Import System` --references--> `SCB (Siam Commercial Bank) Receipt / Tax Invoice Sample`  [INFERRED]
  README.md → backend/example_field/SCBBank.png
- `Bangkok Bank (BBL) Receipt / Tax Invoice Sample` --conceptually_related_to--> `Credit Card OCR 5-Step Wizard`  [INFERRED]
  backend/example_field/BBLbank.png → CLAUDE.md

## Hyperedges (group relationships)
- **Bank Receipt OCR Core Flow (Upload → LLM Extract → Review → Submit)** — concept_credit_card_ocr_wizard, rationale_stateless_extraction, rationale_single_llm_call, rationale_bank_prompt_registry, concept_duplicate_doc_check [EXTRACTED 0.95]
- **Multi-Tenant Request Routing Mechanism** — rationale_multitenant_separate_schema, concept_tenant_context_var, concept_engine_registry [EXTRACTED 0.95]
- **LLM Quality Improvement Loop (Correction Feedback → Hints → Prompt Injection)** — rationale_correction_learning, rationale_bank_prompt_registry, concept_credit_card_ocr_wizard [INFERRED 0.85]

## Communities (113 total, 21 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (47): useAPExtraction(), useAPInvoice(), addDays(), buildInvoicePayload(), useAPSubmission(), reconcileRows(), useAPValidation(), useAPVendor() (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (72): Base, Base, BaseModel, DeclarativeBase, Enum, BankType, DocumentType, TaskStatus (+64 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (36): AdminLayout(), AdminLogin(), AdminProtectedRoute(), handleResolve(), load(), handleAdjust(), handleTopup(), refresh() (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (40): async_session(), Context-aware session — backward-compatible with all existing     `async with a, BaseHTTPMiddleware, PerformanceMiddleware, _persist(), Decode user_id from JWT without DB lookup — lightweight, never raises., Derive tenant from Origin header.     Strictly validates the subdomain to preve, _tenant_from_request() (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (39): CarmenServiceError, DuplicateDocumentError, ExtractionError, LLMParseError, LLMServiceError, Typed application exceptions.  Raise these instead of generic RuntimeError so, LLM API call failed (network, auth, rate-limit). → 503, LLM returned content that could not be parsed as JSON. → 422 (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (39): Exception, AI-suggest dept/acc for AP invoice expense items using category + description., suggest_gl(), proxy_account_codes(), proxy_create_input_tax(), proxy_create_invoice(), proxy_departments(), proxy_gl_prefix() (+31 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (22): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (13): APReviewStep(), HEADER_FIELDS(), APSuccessStep(), VendorSearch(), AuthScreen(), fmt(), isNumFld(), parseNum() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (30): _db_root_url(), get_all_tenants(), get_db(), _get_engine(), _get_session_factory(), init_db(), _m021_remove_tenant_columns(), migrate_all_tenants() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (26): build_fixed_fields_prompt(), build_payment_types_prompt(), Prompt builders for GL account mapping suggestions., Standard ToolResult — unified response format for all tools.  Every tool retur, Standardized output from any tool invocation., ToolResult, Tool: extract_card  Wraps the stateless OCR pipeline:   preprocess image → Vi, Extract structured data from an image/PDF using Vision LLM.      Args: (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (14): diffCorrections(), logCorrections(), mapFieldName(), useFileUpload(), useOcrExtraction(), useOcrSubmission(), useOcrWizard(), useModal() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (33): Backend Python Requirements, CHANGELOG — Unreleased 2026-05-02, CLAUDE.md Project Guide, AP Invoice 5-Step Wizard, Credit Card OCR 5-Step Wizard, Data Retention & Archival Policy, Duplicate Document Number Check (submitted_at IS NOT NULL), Per-Tenant Engine Registry (_ENGINES) (+25 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (12): getAccountingConfig(), handleSelect(), AccountingReview(), buildRows(), fmt(), handleAddInputTax(), parseJvhDate(), useAccountingConfig() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (26): get_current_session(), FastAPI dependency — resolves the current authenticated session from JWT + DB., Validates the OCR JWT, looks up the session record, and returns a SessionInfo, create_session_jwt(), decode_session_jwt(), decrypt_carmen_token(), encrypt_carmen_token(), extract_user_id_from_token() (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (15): saveAccountingConfig(), detectBankFromCompanyName(), detectBankFromExtracted(), useMapping(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape() (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (13): FileService, Centralized service for file validation and handling.     Implements security c, validate_and_read(), export_tasks_to_csv(), extract_stateless(), OCR Service — stateless extraction + task listing/export helpers., Stateless OCR extraction:     resize → OpenRouter vision LLM → return structure, Export submitted credit card documents to CSV — one row per transaction label. (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.3
Nodes (13): _build_deposit_row(), _compute_line_totals(), _detect_tax_type(), _distribute_footer_discount(), _num(), postprocess(), _r2(), Post-process raw AP-invoice extraction from LLM into the final shape expected b (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.32
Nodes (7): get_tool_schema(), invoke_tool(), list_tools(), Tools Router — HTTP interface to the tool registry.  Endpoints:   GET  /api/v, List all registered tools with their descriptions and input schemas., Return description and input schema for a single tool., Invoke a registered tool by name.      Request body: JSON object whose keys ma

### Community 19 - "Community 19"
Cohesion: 0.43
Nodes (7): copy_global_table(), copy_tenant_table(), get_distinct_tenants(), mark_migrations_applied(), One-time migration: ocr_db (shared schema) → carmen_ai_{tenant} (separate schema, run(), table_exists()

### Community 20 - "Community 20"
Cohesion: 0.29
Nodes (5): Config, Application configuration — loads settings from .env file., Application settings loaded from environment variables / .env file., Settings, BaseSettings

### Community 21 - "Community 21"
Cohesion: 0.47
Nodes (5): fileToBase64(), handleClose(), handleFileChange(), handleSubmit(), reset()

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (3): Hash-Based Routing for IIS Static Deployment, IIS Deployment Guide (Windows Server), Frontend Entry HTML (CARMEN CLOUD AI AUTOMATION)

## Knowledge Gaps
- **143 isolated node(s):** `Start the backend server with UTF-8 mode enabled (fixes Windows charmap errors).`, `Config`, `Application configuration — loads settings from .env file.`, `Application settings loaded from environment variables / .env file.`, `Request-scoped context variables.  Set by `auth/dependencies.py` for each auth` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 0` to `Community 6`, `Community 10`, `Community 12`, `Community 14`, `Community 21`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `async_session()` connect `Community 3` to `Community 1`, `Community 4`, `Community 5`, `Community 8`, `Community 13`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `createApiClient()` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `apiFetch()` (e.g. with `handleSubmit()` and `fetchAccountCodes()`) actually correct?**
  _`apiFetch()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `TaskStatus` (e.g. with `OCRTask` and `CreditCard`) actually correct?**
  _`TaskStatus` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `BankType` (e.g. with `OCRTask` and `CreditCard`) actually correct?**
  _`BankType` has 21 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Start the backend server with UTF-8 mode enabled (fixes Windows charmap errors).`, `Config`, `Application configuration — loads settings from .env file.` to the rest of the system?**
  _143 weakly-connected nodes found - possible documentation gaps or missing edges._