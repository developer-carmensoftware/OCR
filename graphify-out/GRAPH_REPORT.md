# Graph Report - OCR  (2026-11-03)

## Corpus Check
- 422 files · ~310,382 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2248 nodes · 6264 edges · 146 communities (101 shown, 45 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2be6d7c9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api.ts
- APLineItemsTable.tsx
- dict/index.ts
- ManualScan.tsx
- appKey
- Dialog.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- draft.ts
- useMapping.ts
- orders.ts
- useReviewDocument.ts
- useSettlementMapping.ts
- useT
- unwrapDetail
- Overview.tsx
- payment-mapping/types.ts
- ocr.ts
- ApiKeysPage.tsx
- bankTransforms.ts
- compilerOptions
- 5. Components
- useAPExtraction.ts
- AdminLogin.tsx
- carmen.ts
- devDependencies
- apiFetch
- PeriodPicker.tsx
- adminFetch
- admin/api/credits.ts
- DocumentPreview.tsx
- dependencies
- DetailTable.tsx
- showToast
- ErrorsPage.tsx
- EmailAutomationPage.tsx
- FeatureFlows.tsx
- formatThb
- NotificationBell.tsx
- useOcrWizard
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- EmailSettings.tsx
- DataTable.tsx
- QueueRow.tsx
- useMappingData.ts
- ReviewQueue.tsx
- adminAuth.ts
- scripts
- config.ts
- APTableRow.tsx
- LanguageProvider
- compilerOptions
- OrderWorkspace.tsx
- PmsReviewDocument.tsx
- OrderStatusBadge.tsx
- CLAUDE.md
- Contributing
- FieldMapping
- Skeleton.tsx
- ErrorBoundary
- useOcrWizard.ts
- Home.tsx
- Carmen AI — OCR & Import System
- APInvoice.tsx
- APAmountSummary.tsx
- i18n/nav.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- MaintenancePage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderActions.tsx
- usePmsReview.ts
- vercel.json
- Architecture
- overview.ts
- OrderHistory.tsx
- Mapping.test.tsx
- useOcrExtraction
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- getCarmenUrl
- main.tsx
- securityHeaders.test.ts
- i18n/index.ts
- APGroupModal.tsx
- i18n/common.ts
- usePdfPasswordPrompt
- CheckoutFlow.tsx
- checkout.ts
- vite-env.d.ts
- llmLogs.ts
- mockPaths.test.ts
- client.ts
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
- @testing-library/react
- qr.ts
- review.ts
- TenantsPage.tsx
- TenantSelector.test.tsx
- slip.ts
- tutorial.ts
- ExtractionsPage.tsx
- adminUsers.ts
- @eslint/js
- @types/react-dom
- i18n/usage.ts
- ApiKeysPage.test.tsx
- APAccountMappingStep.tsx
- vite
- postcss
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- dict/usage.ts
- @types/react
- jsdom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 258 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 65 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 37 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `round2()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (146 total, 45 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.08
Nodes (26): JvHeaderCard(), Props, Props, TopLevelConfigSection(), DESCRIPTION_TAGS, joinDescription(), splitDescription(), CustomSearchSelect() (+18 more)

### Community 1 - "APLineItemsTable.tsx"
Cohesion: 0.32
Nodes (8): Props, APTableFooter(), Props, APTableHeader(), Props, Props, TaxTypeValue, APColumnKey

### Community 2 - "dict/index.ts"
Cohesion: 0.04
Nodes (32): en, th, en, th, en, th, en, th (+24 more)

### Community 3 - "ManualScan.tsx"
Cohesion: 0.08
Nodes (41): AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, configBanks, BANK_LOGOS, BankDetectionBanner(), Props, DetailRow (+33 more)

### Community 4 - "appKey"
Cohesion: 0.12
Nodes (22): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, DetailRow (+14 more)

### Community 5 - "Dialog.tsx"
Cohesion: 0.29
Nodes (5): Dialog(), DialogProps, focusablesIn(), Options, useDialogFocus()

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (30): AmountSummary(), APStep, DEFAULT_MAPPINGS, EMPTY_HEADER, getAvailableFields(), NUMERIC_FIELDS, useAPInvoice(), adjustField() (+22 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (30): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+22 more)

### Community 9 - "draft.ts"
Cohesion: 0.24
Nodes (10): useAPDraft(), mountRestored(), TAX_PROFILES, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.16
Nodes (20): saveARSettings(), suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, COMPANY_FIELDS, rulesPrint(), getAccountingConfig (+12 more)

### Community 11 - "orders.ts"
Cohesion: 0.11
Nodes (31): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+23 more)

### Community 12 - "useReviewDocument.ts"
Cohesion: 0.15
Nodes (19): approveDocument(), getPending(), ItxOverrides, rejectDocument(), BlockReason, BU_WIDE, JvEditor(), JvState (+11 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.14
Nodes (20): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+12 more)

### Community 14 - "useT"
Cohesion: 0.09
Nodes (28): BatchAction, BatchActionBar(), Props, DateRangePicker(), DateRangePickerProps, NavItem, NavSection, APLineItemsTable() (+20 more)

### Community 15 - "unwrapDetail"
Cohesion: 0.11
Nodes (29): unwrapDetail(), EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits() (+21 more)

### Community 16 - "Overview.tsx"
Cohesion: 0.10
Nodes (26): fetchAlerts(), TenantSearch(), LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+18 more)

### Community 17 - "payment-mapping/types.ts"
Cohesion: 0.11
Nodes (38): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, MappingRow(), Props, BulkApplyBar() (+30 more)

### Community 18 - "ocr.ts"
Cohesion: 0.18
Nodes (12): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), createApiClient(), fetchTimeout(), ExtractedRow (+4 more)

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.16
Nodes (20): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow, FeedStatus, pmsEventsUrl() (+12 more)

### Community 20 - "bankTransforms.ts"
Cohesion: 0.17
Nodes (17): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField, codeToDisplayName() (+9 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (21): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES (+13 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "carmen.ts"
Cohesion: 0.12
Nodes (16): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+8 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, globals (+15 more)

### Community 27 - "apiFetch"
Cohesion: 0.13
Nodes (28): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+20 more)

### Community 28 - "PeriodPicker.tsx"
Cohesion: 0.16
Nodes (32): Column, daysAgo(), endOfDay(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, PeriodPicker() (+24 more)

### Community 29 - "adminFetch"
Cohesion: 0.14
Nodes (29): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, fetchEmailDocuments(), fetchJobs(), fetchSessions(), resolveAlert() (+21 more)

### Community 30 - "admin/api/credits.ts"
Cohesion: 0.31
Nodes (9): adjustCredits(), CreditBalance, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel(), CreditsPage() (+1 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 34 - "showToast"
Cohesion: 0.11
Nodes (32): Props, Ctrl, APSuccessStep(), Props, Props, APInvoiceHeader, ApDraft, Args (+24 more)

### Community 35 - "ErrorsPage.tsx"
Cohesion: 0.25
Nodes (9): periodHours(), ErrorRow, ErrorsPage(), GroupBy, getColsCost(), getColsPerf(), Metric, RankRow (+1 more)

### Community 36 - "EmailAutomationPage.tsx"
Cohesion: 0.14
Nodes (19): KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps, getTabs() (+11 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "formatThb"
Cohesion: 0.25
Nodes (13): BillingFigure(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), formatThb() (+5 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (43): ActivityPage, WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList (+35 more)

### Community 40 - "useOcrWizard"
Cohesion: 0.21
Nodes (18): applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange() (+10 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "date.ts"
Cohesion: 0.27
Nodes (7): DATE_KEYS, HeaderCard(), Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (53): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+45 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+12 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.12
Nodes (20): inputTaxPreview, markInputTaxKeyed(), recordInputTax(), refusal(), formatWhen(), fullWhen(), Message(), monthLabel() (+12 more)

### Community 47 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.10
Nodes (26): ARPreview, ActivityFilter, ALL_SCOPES, ApproveResult, LateInputTaxBody, listActivity(), QUEUE_CHIPS, ReviewDocument (+18 more)

### Community 49 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "config.ts"
Cohesion: 0.09
Nodes (27): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig (+19 more)

### Community 52 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 53 - "LanguageProvider"
Cohesion: 0.22
Nodes (7): ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), readLang(), MAX_FILE_SIZE_MB

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "OrderWorkspace.tsx"
Cohesion: 0.08
Nodes (33): CreditLedgerEntry, AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), OrderDrawer(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB (+25 more)

### Community 56 - "PmsReviewDocument.tsx"
Cohesion: 0.11
Nodes (23): RowAction(), dmy(), PmsReviewDocument(), Props, weekday(), Props, ReviewDocument(), CustomModal() (+15 more)

### Community 57 - "OrderStatusBadge.tsx"
Cohesion: 0.28
Nodes (6): MAP, OrderStatusBadge(), OrderStatus, Badge(), BadgeVariant, Props

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "FieldMapping"
Cohesion: 0.29
Nodes (11): AddError, MappingItem, Undo, FeeInvoiceSource, MappingSetsInput, labels, ActiveScan, Suggestion (+3 more)

### Community 61 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 62 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 63 - "useOcrWizard.ts"
Cohesion: 0.39
Nodes (5): inputTaxOwed(), OcrDraftState, CcDraft, draftWorthOffering(), owed

### Community 64 - "Home.tsx"
Cohesion: 0.13
Nodes (14): NAV_SECTIONS, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, TagConfig (+6 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "APInvoice.tsx"
Cohesion: 0.20
Nodes (11): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), AP_STEPS, APFieldKey, FieldOption (+3 more)

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.17
Nodes (11): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Card(), Props (+3 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "MaintenancePage.tsx"
Cohesion: 0.32
Nodes (11): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenants(), TenantRow, fmtICT() (+3 more)

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

### Community 77 - "usePmsReview.ts"
Cohesion: 0.18
Nodes (14): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+6 more)

### Community 78 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (18): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+10 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.13
Nodes (22): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+14 more)

### Community 88 - "getCarmenUrl"
Cohesion: 0.14
Nodes (16): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+8 more)

### Community 89 - "main.tsx"
Cohesion: 0.12
Nodes (19): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, AdminRouter, container (+11 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.04
Nodes (31): en, th, en, th, en, th, en, th (+23 more)

### Community 92 - "APGroupModal.tsx"
Cohesion: 0.29
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 94 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 95 - "CheckoutFlow.tsx"
Cohesion: 0.18
Nodes (12): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, planChangeLoss(), planChangeWarning(), ANNUAL_GROWTH, MONTHLY_GROWTH (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.05
Nodes (63): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+55 more)

### Community 121 - "TenantsPage.tsx"
Cohesion: 0.43
Nodes (5): funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

### Community 125 - "ExtractionsPage.tsx"
Cohesion: 0.29
Nodes (10): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+2 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

## Knowledge Gaps
- **670 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+665 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `api.ts`, `APLineItemsTable.tsx`, `ManualScan.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useMapping.ts`, `orders.ts`, `APAccountMappingStep.tsx`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `unwrapDetail`, `Overview.tsx`, `payment-mapping/types.ts`, `ApiKeysPage.tsx`, `bankTransforms.ts`, `useAPExtraction.ts`, `AdminLogin.tsx`, `apiFetch`, `PeriodPicker.tsx`, `admin/api/credits.ts`, `DocumentPreview.tsx`, `DetailTable.tsx`, `showToast`, `ErrorsPage.tsx`, `EmailAutomationPage.tsx`, `FeatureFlows.tsx`, `formatThb`, `NotificationBell.tsx`, `useOcrWizard`, `date.ts`, `DataTable.tsx`, `QueueRow.tsx`, `ReviewQueue.tsx`, `LanguageProvider`, `OrderWorkspace.tsx`, `PmsReviewDocument.tsx`, `OrderStatusBadge.tsx`, `Home.tsx`, `APInvoice.tsx`, `APAmountSummary.tsx`, `MaintenancePage.tsx`, `OrderActions.tsx`, `usePmsReview.ts`, `OrderHistory.tsx`, `Pricing.tsx`, `getCarmenUrl`, `main.tsx`, `APGroupModal.tsx`, `CheckoutFlow.tsx`, `client.ts`, `TenantsPage.tsx`, `ExtractionsPage.tsx`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `showToast`, `parseNum`, `NotificationBell.tsx`, `client.ts`, `useMapping.ts`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `QueueRow.tsx`, `usePmsReview.ts`, `ReviewQueue.tsx`, `useMappingData.ts`, `OrderHistory.tsx`, `config.ts`, `ocr.ts`, `Pricing.tsx`, `useAPExtraction.ts`, `carmen.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `API` connect `adminFetch` to `useMapping.ts`, `orders.ts`, `useSettlementMapping.ts`, `unwrapDetail`, `ocr.ts`, `ApiKeysPage.tsx`, `useAPExtraction.ts`, `AdminLogin.tsx`, `carmen.ts`, `apiFetch`, `admin/api/credits.ts`, `showToast`, `NotificationBell.tsx`, `EmailSettings.tsx`, `ReviewQueue.tsx`, `adminAuth.ts`, `config.ts`, `MaintenancePage.tsx`, `usePmsReview.ts`, `client.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _670 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07557354925775979 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._
- **Should `ManualScan.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07676767676767676 - nodes in this community are weakly interconnected._