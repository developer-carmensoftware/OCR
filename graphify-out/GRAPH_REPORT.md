# Graph Report - .  (2026-05-05)

## Corpus Check
- Large corpus: 280 files · ~10,462,295 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 603 nodes · 918 edges · 71 communities (56 shown, 15 thin omitted)
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 218 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Database Models & Schemas|Database Models & Schemas]]
- [[_COMMUNITY_DB Session & Engine Management|DB Session & Engine Management]]
- [[_COMMUNITY_Custom Exceptions & Errors|Custom Exceptions & Errors]]
- [[_COMMUNITY_Carmen ERP & GL Suggestion|Carmen ERP & GL Suggestion]]
- [[_COMMUNITY_Carmen API Frontend Client|Carmen API Frontend Client]]
- [[_COMMUNITY_OCR Extraction Tools & Mapping|OCR Extraction Tools & Mapping]]
- [[_COMMUNITY_Project Docs & Architecture|Project Docs & Architecture]]
- [[_COMMUNITY_Auth & JWT Session|Auth & JWT Session]]
- [[_COMMUNITY_AP Invoice Frontend Steps|AP Invoice Frontend Steps]]
- [[_COMMUNITY_Admin Usage & Retention|Admin Usage & Retention]]
- [[_COMMUNITY_OCR Submit & Correction|OCR Submit & Correction]]
- [[_COMMUNITY_AP Field Mapping UI|AP Field Mapping UI]]
- [[_COMMUNITY_File Service & Image Processing|File Service & Image Processing]]
- [[_COMMUNITY_AP Invoice Post-Processing|AP Invoice Post-Processing]]
- [[_COMMUNITY_Performance Middleware|Performance Middleware]]
- [[_COMMUNITY_Tool Registry HTTP Interface|Tool Registry HTTP Interface]]
- [[_COMMUNITY_Multi-Tenant Migration|Multi-Tenant Migration]]
- [[_COMMUNITY_App Configuration|App Configuration]]
- [[_COMMUNITY_AP Account Mapping UI|AP Account Mapping UI]]
- [[_COMMUNITY_Correction Feedback|Correction Feedback]]
- [[_COMMUNITY_Security & Logic Tests|Security & Logic Tests]]
- [[_COMMUNITY_Dark Mode Toggle|Dark Mode Toggle]]
- [[_COMMUNITY_Bank Detection Logic|Bank Detection Logic]]
- [[_COMMUNITY_IIS Deployment & Hash Routing|IIS Deployment & Hash Routing]]
- [[_COMMUNITY_Backend Server Entry|Backend Server Entry]]
- [[_COMMUNITY_Request Context Variables|Request Context Variables]]
- [[_COMMUNITY_AP Invoice LLM Prompt|AP Invoice LLM Prompt]]
- [[_COMMUNITY_BBL Bank Prompt|BBL Bank Prompt]]
- [[_COMMUNITY_Generic Bank Prompt|Generic Bank Prompt]]
- [[_COMMUNITY_KBank Prompt|KBank Prompt]]
- [[_COMMUNITY_SCB Bank Prompt|SCB Bank Prompt]]
- [[_COMMUNITY_Shared Prompt Fragments|Shared Prompt Fragments]]
- [[_COMMUNITY_Tools Layer Init|Tools Layer Init]]
- [[_COMMUNITY_File Validator|File Validator]]
- [[_COMMUNITY_Filename Helper|Filename Helper]]

## God Nodes (most connected - your core abstractions)
1. `TaskStatus` - 24 edges
2. `BankType` - 24 edges
3. `apiFetch()` - 22 edges
4. `CarmenAPIError` - 16 edges
5. `async_session()` - 15 edges
6. `Base` - 14 edges
7. `_client()` - 14 edges
8. `_base_url()` - 13 edges
9. `AuditAction` - 11 edges
10. `OCRTask` - 10 edges

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

## Communities (71 total, 15 thin omitted)

### Community 0 - "Database Models & Schemas"
Cohesion: 0.09
Nodes (55): Base, Base, BaseModel, DeclarativeBase, Enum, BankType, DocumentType, TaskStatus (+47 more)

### Community 1 - "DB Session & Engine Management"
Cohesion: 0.06
Nodes (43): async_session(), _db_root_url(), get_all_tenants(), get_db(), _get_engine(), _get_session_factory(), init_db(), _m021_remove_tenant_columns() (+35 more)

### Community 2 - "Custom Exceptions & Errors"
Cohesion: 0.06
Nodes (38): CarmenServiceError, DuplicateDocumentError, ExtractionError, LLMParseError, LLMServiceError, Typed application exceptions.  Raise these instead of generic RuntimeError so, LLM API call failed (network, auth, rate-limit). → 503, LLM returned content that could not be parsed as JSON. → 422 (+30 more)

### Community 3 - "Carmen ERP & GL Suggestion"
Cohesion: 0.1
Nodes (39): Exception, AI-suggest dept/acc for AP invoice expense items using category + description., suggest_gl(), proxy_account_codes(), proxy_create_input_tax(), proxy_create_invoice(), proxy_departments(), proxy_gl_prefix() (+31 more)

### Community 4 - "Carmen API Frontend Client"
Cohesion: 0.08
Nodes (27): fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen(), apiFetch(), diffCorrections() (+19 more)

### Community 5 - "OCR Extraction Tools & Mapping"
Cohesion: 0.07
Nodes (27): build_ap_expense_prompt(), build_fixed_fields_prompt(), build_payment_types_prompt(), Prompt builders for GL account mapping suggestions., Standard ToolResult — unified response format for all tools.  Every tool retur, Standardized output from any tool invocation., ToolResult, Tool: extract_card  Wraps the stateless OCR pipeline:   preprocess image → Vi (+19 more)

### Community 6 - "Project Docs & Architecture"
Cohesion: 0.12
Nodes (33): Backend Python Requirements, CHANGELOG — Unreleased 2026-05-02, CLAUDE.md Project Guide, AP Invoice 5-Step Wizard, Credit Card OCR 5-Step Wizard, Data Retention & Archival Policy, Duplicate Document Number Check (submitted_at IS NOT NULL), Per-Tenant Engine Registry (_ENGINES) (+25 more)

### Community 7 - "Auth & JWT Session"
Cohesion: 0.09
Nodes (26): get_current_session(), FastAPI dependency — resolves the current authenticated session from JWT + DB., Validates the OCR JWT, looks up the session record, and returns a SessionInfo, create_session_jwt(), decode_session_jwt(), decrypt_carmen_token(), encrypt_carmen_token(), extract_user_id_from_token() (+18 more)

### Community 8 - "AP Invoice Frontend Steps"
Cohesion: 0.11
Nodes (17): APSuccessStep(), VendorSearch(), exchangeSSOToken(), revokeSession(), clearToken(), getStoredToken(), storeToken(), AuthScreen() (+9 more)

### Community 9 - "Admin Usage & Retention"
Cohesion: 0.09
Nodes (20): Admin Router — usage summary queries + manual trigger endpoints.  All endpoint, Manually trigger archive + cleanup for the current tenant., Manually rebuild daily summary for the current tenant., Manually sync LLM pricing from OpenRouter API., trigger_pricing_sync(), trigger_retention(), trigger_summary_rebuild(), archive_and_cleanup() (+12 more)

### Community 10 - "OCR Submit & Correction"
Cohesion: 0.1
Nodes (14): extract_card(), OCR API Routes — thin HTTP layer.  Business logic lives in:   app/tools/extra, Save user-confirmed data to DB. Delegates all logic to submit_tool., Stateless extraction: read files, call LLM, return JSON data.     Does NOT save, submit_receipt_stateless(), SubmitDetailItem, SubmitHeader, SubmitPayload (+6 more)

### Community 11 - "AP Field Mapping UI"
Cohesion: 0.15
Nodes (13): APReviewStep(), HEADER_FIELDS(), fmt(), getAvailableFields(), isNumFld(), parseNum(), round2(), addDays() (+5 more)

### Community 12 - "File Service & Image Processing"
Cohesion: 0.11
Nodes (13): FileService, Centralized service for file validation and handling.     Implements security c, validate_and_read(), export_tasks_to_csv(), extract_stateless(), OCR Service — stateless extraction + task listing/export helpers., Stateless OCR extraction:     resize → OpenRouter vision LLM → return structure, Export submitted credit card documents to CSV — one row per transaction label. (+5 more)

### Community 13 - "AP Invoice Post-Processing"
Cohesion: 0.3
Nodes (13): _build_deposit_row(), _compute_line_totals(), _detect_tax_type(), _distribute_footer_discount(), _num(), postprocess(), _r2(), Post-process raw AP-invoice extraction from LLM into the final shape expected b (+5 more)

### Community 14 - "Performance Middleware"
Cohesion: 0.31
Nodes (7): BaseHTTPMiddleware, PerformanceMiddleware, _persist(), Decode user_id from JWT without DB lookup — lightweight, never raises., Derive tenant from Origin header.     Strictly validates the subdomain to preve, _tenant_from_request(), _user_id_from_request()

### Community 15 - "Tool Registry HTTP Interface"
Cohesion: 0.32
Nodes (7): get_tool_schema(), invoke_tool(), list_tools(), Tools Router — HTTP interface to the tool registry.  Endpoints:   GET  /api/v, List all registered tools with their descriptions and input schemas., Return description and input schema for a single tool., Invoke a registered tool by name.      Request body: JSON object whose keys ma

### Community 16 - "Multi-Tenant Migration"
Cohesion: 0.43
Nodes (7): copy_global_table(), copy_tenant_table(), get_distinct_tenants(), mark_migrations_applied(), One-time migration: ocr_db (shared schema) → carmen_ai_{tenant} (separate schema, run(), table_exists()

### Community 17 - "App Configuration"
Cohesion: 0.29
Nodes (5): Config, Application configuration — loads settings from .env file., Application settings loaded from environment variables / .env file., Settings, BaseSettings

### Community 19 - "Correction Feedback"
Cohesion: 0.5
Nodes (3): log_correction(), Feedback router — log user corrections for learning., Log a user correction (called at submit time).      Uses MySQL INSERT ... ON D

### Community 24 - "IIS Deployment & Hash Routing"
Cohesion: 0.67
Nodes (3): Hash-Based Routing for IIS Static Deployment, IIS Deployment Guide (Windows Server), Frontend Entry HTML (CARMEN CLOUD AI AUTOMATION)

## Knowledge Gaps
- **143 isolated node(s):** `Start the backend server with UTF-8 mode enabled (fixes Windows charmap errors).`, `Config`, `Application configuration — loads settings from .env file.`, `Application settings loaded from environment variables / .env file.`, `Request-scoped context variables.  Set by `auth/dependencies.py` for each auth` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `async_session()` connect `DB Session & Engine Management` to `Database Models & Schemas`, `Custom Exceptions & Errors`, `Carmen ERP & GL Suggestion`, `Auth & JWT Session`, `Admin Usage & Retention`, `Performance Middleware`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `extract_from_image()` connect `Custom Exceptions & Errors` to `Database Models & Schemas`, `File Service & Image Processing`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `call_vision_llm()` connect `Custom Exceptions & Errors` to `DB Session & Engine Management`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `TaskStatus` (e.g. with `OCRTask` and `CreditCard`) actually correct?**
  _`TaskStatus` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `BankType` (e.g. with `OCRTask` and `CreditCard`) actually correct?**
  _`BankType` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `apiFetch()` (e.g. with `fetchAccountCodes()` and `fetchDepartments()`) actually correct?**
  _`apiFetch()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `CarmenAPIError` (e.g. with `SuggestGLItem` and `SuggestGLRequest`) actually correct?**
  _`CarmenAPIError` has 3 INFERRED edges - model-reasoned connections that need verification._