# Graph Report - OCR  (2026-11-19)

## Corpus Check
- 423 files · ~317,136 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2277 nodes · 6329 edges · 154 communities (93 shown, 61 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b01cea8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MainMappingTable.tsx
- ap-invoice/constants.ts
- dict/index.ts
- DetailTable.tsx
- api.ts
- useEmailSettings.ts
- parseNum
- PmsReviewDocument.tsx
- emailReview.ts
- banks.ts
- useMapping.ts
- adminFetch
- useReviewDocument.ts
- useSettlementMapping.ts
- LanguageContext.tsx
- EmailAutomationPage.tsx
- routes.tsx
- payment-mapping/types.ts
- useOcrWizard.ts
- ApiKeysPage.tsx
- useAPExtraction.ts
- compilerOptions
- 5. Components
- useFileUpload.ts
- QueueFilters.tsx
- useOcrWizard
- devDependencies
- shared/api/credits.ts
- PeriodPicker.tsx
- EmailSettings.test.tsx
- CreditsPage.tsx
- useT
- dependencies
- TKey
- apiFetch
- shared/api/auth.ts
- unwrapDetail
- FeatureFlows.tsx
- OrderWorkspace.tsx
- NotificationBell.tsx
- useAPInvoice.test.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- EmailSettings.tsx
- DataTable.tsx
- QueueRow.tsx
- deptAccounts.ts
- ReviewQueue.tsx
- client.ts
- scripts
- appKey
- ocr.ts
- QueueRow.test.tsx
- compilerOptions
- Button.tsx
- useEmailSettings.test.ts
- globals
- CLAUDE.md
- Contributing
- FieldMapping
- Skeleton.tsx
- MetricChartImpl.tsx
- MaintenanceGate.tsx
- AppHeader.test.tsx
- Carmen AI — OCR & Import System
- prettier
- @types/node
- vitest
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- TenantsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderActions.tsx
- vercel.json
- Architecture
- OrderHistory.tsx
- Mapping.test.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- screens.tsx
- AccountingReview.tsx
- main.tsx
- securityHeaders.test.ts
- i18n/index.ts
- APGroupModal.tsx
- checkout.ts
- vite-env.d.ts
- llmLogs.ts
- mockPaths.test.ts
- storage.ts
- cc.ts
- typescript
- i18n/tenants.ts
- orev.ts
- dict/ap.ts
- dict/apiKeys.ts
- dict/modal.ts
- quota.ts
- pack.ts
- plan.ts
- warn.ts
- @testing-library/dom
- qr.ts
- review.ts
- slip.ts
- ExtractionsPage.tsx
- adminUsers.ts
- @eslint/js
- ReviewQueue.test.tsx
- setup.ts
- @types/react-dom
- anomalies.ts
- i18n/usage.ts
- APAccountMappingStep.tsx
- chrome.ts
- i18n/credits.ts
- errors.ts
- extractions.ts
- @testing-library/jest-dom
- jobs.ts
- 01-csv-sidecar-ingestion.md
- login.ts
- i18n/maintenance.ts
- performance.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- tenantRanking.ts
- ar.ts
- contact.ts
- dict/usage.ts
- flows.ts
- dict/maintenance.ts
- dict/nav.ts
- notif.ts
- pricing.ts
- proforma.ts
- jsdom
- whatsnew.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 262 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 65 edges
4. `parseNum()` - 47 edges
5. `TKey` - 40 edges
6. `fmt()` - 40 edges
7. `unwrapDetail()` - 37 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `round2()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `AdminCreditOrder`  [EXTRACTED]
  frontend/src/features/admin/components/OrderTable.tsx → frontend/src/features/admin/api/orders.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `NavItem` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `NavSection` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts

## Import Cycles
- None detected.

## Communities (154 total, 61 thin omitted)

### Community 0 - "MainMappingTable.tsx"
Cohesion: 0.16
Nodes (11): Props, MainMappings, MainMappingKey, SuggestionSource, CustomSearchSelect(), handleScroll(), panelStyle(), Props (+3 more)

### Community 1 - "ap-invoice/constants.ts"
Cohesion: 0.05
Nodes (54): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, COLS, Props (+46 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.10
Nodes (15): en, th, en, th, DICT, en, th, en (+7 more)

### Community 3 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 4 - "api.ts"
Cohesion: 0.09
Nodes (16): APVendorMapping, APVendorMappingResponse, ConfigPatch, SaveAccountingConfigResult, AccountingConfigRequest, AccountingConfigResponse, ApiError, APInvoiceItem (+8 more)

### Community 5 - "useEmailSettings.ts"
Cohesion: 0.22
Nodes (19): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRulePayload, EmailSettings, getBankCodes() (+11 more)

### Community 6 - "parseNum"
Cohesion: 0.14
Nodes (33): AmountSummary(), getAvailableFields(), useAPDraft(), useAPGrouping(), useAPInvoice(), adjustField(), DocRepair, reconcileRows() (+25 more)

### Community 7 - "PmsReviewDocument.tsx"
Cohesion: 0.05
Nodes (46): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+38 more)

### Community 8 - "emailReview.ts"
Cohesion: 0.17
Nodes (18): ARPreview, ActivityFilter, ALL_SCOPES, ApproveResult, LateInputTaxBody, listActivity(), markInputTaxKeyed(), NO_NARROW (+10 more)

### Community 9 - "banks.ts"
Cohesion: 0.10
Nodes (31): BANK_LOGOS, Props, Props, Props, Props, bankCodeFromHash(), BankConfigHook, useBankConfig() (+23 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.10
Nodes (29): ARMappingItem, ARPreviewRow, ARSettings, ARSettingsResponse, POST_TYPES, PostType, saveARSettings(), SOURCE_BY_POST_TYPE (+21 more)

### Community 11 - "adminFetch"
Cohesion: 0.11
Nodes (35): AdminCreditOrder, AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminOrderDocuments(), fetchAdminPaymentInfo(), fetchKpi(), getOrderSlipUrl() (+27 more)

### Community 12 - "useReviewDocument.ts"
Cohesion: 0.12
Nodes (25): approveDocument(), getPending(), ItxOverrides, Props, DetailRow, Props, BlockReason, BU_WIDE (+17 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.19
Nodes (15): getARSettings(), getSamplePaymentTypes(), previewARJv(), suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, useMappingSuggestions(), blankRows() (+7 more)

### Community 14 - "LanguageContext.tsx"
Cohesion: 0.11
Nodes (18): MAP, OrderStatusBadge(), ACCEPTED, Props, SlipUpload(), SLIP, Lang, translate() (+10 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "routes.tsx"
Cohesion: 0.17
Nodes (18): buildQs(), QueryParams, fetchAlerts(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), fmtCost(), fmtNum() (+10 more)

### Community 17 - "payment-mapping/types.ts"
Cohesion: 0.16
Nodes (23): AccountMappingTable(), GLAccount, Props, MainMappingTable(), MappingRow(), BulkApplyBar(), MappingTable(), Props (+15 more)

### Community 18 - "useOcrWizard.ts"
Cohesion: 0.13
Nodes (17): inputTaxOwed(), OcrDraftState, CcDraft, draftWorthOffering(), owed, ApiError, PDF_PASSWORD_REQUIRED, COPY (+9 more)

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.14
Nodes (21): fetchApiKeys(), revokeApiKey(), Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow (+13 more)

### Community 20 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (22): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping, getPdfInfo, getUsage (+14 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 24 - "QueueFilters.tsx"
Cohesion: 0.18
Nodes (12): cleanText(), QueueRange, QueueSource, Attr, AttrId, ATTRS, FilterBar(), isLogStatus() (+4 more)

### Community 25 - "useOcrWizard"
Cohesion: 0.14
Nodes (20): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+12 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, postcss (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.10
Nodes (41): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PLAN_META, CheckoutPhase, CheckoutSession (+33 more)

### Community 28 - "PeriodPicker.tsx"
Cohesion: 0.09
Nodes (55): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchErrorBreakdown(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage() (+47 more)

### Community 29 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.24
Nodes (11): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), fetchTenants (+3 more)

### Community 31 - "useT"
Cohesion: 0.06
Nodes (40): APFieldMappingStep(), APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, APInvoice(), ContactDialog(), BankDetectionBanner() (+32 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "TKey"
Cohesion: 0.16
Nodes (14): BatchAction, BatchActionBar(), Props, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module (+6 more)

### Community 34 - "apiFetch"
Cohesion: 0.09
Nodes (38): Props, Props, APInvoiceHeader, ApDraft, Args, APDraftState, APExtractionProps, APSubmissionProps (+30 more)

### Community 35 - "shared/api/auth.ts"
Cohesion: 0.28
Nodes (8): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 36 - "unwrapDetail"
Cohesion: 0.12
Nodes (30): unwrapDetail(), fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), AdminUserRow (+22 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "OrderWorkspace.tsx"
Cohesion: 0.07
Nodes (45): OrderDrawer(), Props, OrderKpiCards(), BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf() (+37 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): ActivityPage, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page, docLabel() (+34 more)

### Community 40 - "useAPInvoice.test.ts"
Cohesion: 0.50
Nodes (3): mountRestored(), TAX_PROFILES, saveDraft()

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "date.ts"
Cohesion: 0.29
Nodes (9): DATE_KEYS, Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO() (+1 more)

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.13
Nodes (18): EmailDocType, RECONCILE_BANK, Draft, EMPTY_RULE, RuleDraft, splitList(), toPayloadRules(), copyAddress() (+10 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.11
Nodes (19): DataTableProps, ExpandedRowWrapperProps, ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS, Extra, readHashParams() (+11 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 47 - "deptAccounts.ts"
Cohesion: 0.18
Nodes (20): Props, Props, Props, MappingStatus, GlMasters, prefetchGlMasters(), MappingDataHook, MasterAccount (+12 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.16
Nodes (17): narrowCount(), reconcileNarrow(), useReviewQueue(), COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash() (+9 more)

### Community 49 - "client.ts"
Cohesion: 0.27
Nodes (11): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), CarmenSSOState (+3 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "appKey"
Cohesion: 0.07
Nodes (40): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), getAccountingConfig, seedOcrBranch(), MAIN_KEYS, readFromLocalStorage() (+32 more)

### Community 52 - "ocr.ts"
Cohesion: 0.20
Nodes (11): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractedRow, extractFromFile(), ExtractResult (+3 more)

### Community 53 - "QueueRow.test.tsx"
Cohesion: 0.20
Nodes (5): inputTaxPreview, monthLabel(), RecordInputTax(), open(), doc()

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "Button.tsx"
Cohesion: 0.29
Nodes (6): Button(), ButtonProps, Variant, VARIANT_CLASS, CopyButton(), CopyButtonProps

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "FieldMapping"
Cohesion: 0.17
Nodes (17): ARPreviewRequest, SuggestResponse, AddError, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels (+9 more)

### Community 61 - "Skeleton.tsx"
Cohesion: 0.32
Nodes (6): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 62 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 63 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "TenantsPage.tsx"
Cohesion: 0.13
Nodes (23): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants() (+15 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 78 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.13
Nodes (18): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), SLIP, catalogName(), isSubscriptionCode() (+10 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "screens.tsx"
Cohesion: 0.07
Nodes (44): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, billed() (+36 more)

### Community 88 - "AccountingReview.tsx"
Cohesion: 0.13
Nodes (24): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, JvHeaderCard(), TopLevelConfigSection(), useGlMasters(), descriptionForBank(), buildGljvPayload() (+16 more)

### Community 89 - "main.tsx"
Cohesion: 0.06
Nodes (42): adminLogin(), AdminLoginError, LoginResponse, AdminLayout(), getActiveHash(), AdminLogin(), classify(), LoginError (+34 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.08
Nodes (16): en, th, en, th, adminDict, AdminKey, en, th (+8 more)

### Community 92 - "APGroupModal.tsx"
Cohesion: 0.38
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "storage.ts"
Cohesion: 0.06
Nodes (51): RowAction(), revokeSession(), clearToken(), storeToken(), getConsentStatus(), postConsent(), ConsentGate(), Props (+43 more)

### Community 125 - "ExtractionsPage.tsx"
Cohesion: 0.16
Nodes (16): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, causeLabel() (+8 more)

### Community 128 - "ReviewQueue.test.tsx"
Cohesion: 0.27
Nodes (6): ATTR_OF(), menuOptions(), optionNamed(), pickScope(), QUIET, ZERO

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

## Knowledge Gaps
- **678 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+673 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `MainMappingTable.tsx`, `ap-invoice/constants.ts`, `DetailTable.tsx`, `parseNum`, `PmsReviewDocument.tsx`, `banks.ts`, `useMapping.ts`, `adminFetch`, `APAccountMappingStep.tsx`, `useReviewDocument.ts`, `LanguageContext.tsx`, `EmailAutomationPage.tsx`, `routes.tsx`, `payment-mapping/types.ts`, `useSettlementMapping.ts`, `ApiKeysPage.tsx`, `useAPExtraction.ts`, `QueueFilters.tsx`, `useOcrWizard`, `shared/api/credits.ts`, `PeriodPicker.tsx`, `CreditsPage.tsx`, `TKey`, `apiFetch`, `shared/api/auth.ts`, `unwrapDetail`, `FeatureFlows.tsx`, `OrderWorkspace.tsx`, `NotificationBell.tsx`, `date.ts`, `DataTable.tsx`, `QueueRow.tsx`, `deptAccounts.ts`, `ReviewQueue.tsx`, `QueueRow.test.tsx`, `Button.tsx`, `MetricChartImpl.tsx`, `MaintenanceGate.tsx`, `TenantsPage.tsx`, `OrderActions.tsx`, `OrderHistory.tsx`, `screens.tsx`, `AccountingReview.tsx`, `main.tsx`, `i18n/index.ts`, `APGroupModal.tsx`, `storage.ts`, `ExtractionsPage.tsx`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `api.ts`, `parseNum`, `PmsReviewDocument.tsx`, `emailReview.ts`, `storage.ts`, `useMapping.ts`, `NotificationBell.tsx`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `deptAccounts.ts`, `client.ts`, `OrderHistory.tsx`, `appKey`, `useAPExtraction.ts`, `QueueRow.test.tsx`, `ocr.ts`, `useFileUpload.ts`, `shared/api/credits.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `showToast()` connect `apiFetch` to `parseNum`, `PmsReviewDocument.tsx`, `storage.ts`, `useMapping.ts`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `EmailSettings.tsx`, `useOcrWizard.ts`, `appKey`, `ocr.ts`, `useFileUpload.ts`, `useOcrWizard`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _678 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ap-invoice/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05242566510172144 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._