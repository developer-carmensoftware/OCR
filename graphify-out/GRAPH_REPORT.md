# Graph Report - OCR  (2026-10-09)

## Corpus Check
- 427 files · ~311,870 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2284 nodes · 6409 edges · 168 communities (110 shown, 58 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d971d5bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APGroupModal.tsx
- APReviewStep.tsx
- dict/index.ts
- DataTable.tsx
- JvEditor.tsx
- useOcrExtraction.ts
- parseNum
- TutorialModal.tsx
- screens.tsx
- APLineItem
- AccountingReview.tsx
- orders.ts
- useAuth
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- api/email.ts
- TopLevelConfigSection.tsx
- appKey
- endpoints.ts
- PmsPage.tsx
- useMappingData.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- useCheckout.ts
- useT
- showToast
- OrderTable.tsx
- DocumentPreview.tsx
- dependencies
- ManualScan.tsx
- ReviewDocument.tsx
- shared/api/credits.ts
- OrderWorkspace.tsx
- FeatureFlows.tsx
- ProformaDocument.tsx
- NotificationBell.tsx
- SessionsPage.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- EmailAutomationPage.tsx
- useEmailSettings.ts
- PeriodPicker.tsx
- QueueRow.tsx
- useAPSubmission.ts
- ReviewQueue.tsx
- AdminRouter.tsx
- scripts
- apiFetch
- TenantSelector.test.tsx
- useOcrSubmission.test.ts
- compilerOptions
- ApiKeysPage.test.tsx
- CheckoutFlow.tsx
- MaintenancePage.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- EmailSettings.test.tsx
- UsagePage.tsx
- api.ts
- TKey
- Carmen AI — OCR & Import System
- Skeleton.tsx
- DetailTable.tsx
- TenantsPage.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- emailReview.ts
- useUserConsent.ts
- vercel.json
- Architecture
- config.ts
- OrderHistory.tsx
- Mapping.test.tsx
- PmsReviewDocument.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- LanguageProvider
- i18n/index.ts
- AppHeader.tsx
- MainMappingTable.tsx
- chrome.ts
- usePdfPasswordPrompt
- banks.ts
- vitest
- vite-env.d.ts
- i18n/credits.ts
- mockPaths.test.ts
- client.ts
- api/tenants.ts
- i18n/common.ts
- EmailSettings.tsx
- adminAuth.ts
- proforma.ts
- AppHeader.test.tsx
- jobs.ts
- overview.ts
- performance.ts
- sessions.ts
- dict/maintenance.ts
- main.tsx
- tenantRanking.ts
- recordInputTax
- cc.ts
- dict/apiKeys.ts
- useMapping.ts
- ar.ts
- warn.ts
- adminFetch
- checkout.ts
- dict/common.ts
- contact.ts
- flows.ts
- PmsPage.test.tsx
- home.ts
- @types/react-dom
- NumericInput.tsx
- quota.ts
- dict/modal.ts
- notif.ts
- HeaderCard.tsx
- pack.ts
- APAccountMappingStep.tsx
- vite
- useAPExtraction.ts
- plan.ts
- dict/ap.ts
- @testing-library/react
- pms.ts
- @testing-library/jest-dom
- pricing.ts
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- qr.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- slip.ts
- i18n/nav.ts
- tutorial.ts
- dict/usage.ts
- whatsnew.ts
- eslint
- @types/react
- jsdom
- orev.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 267 edges
2. `apiFetch` - 72 edges
3. `adminFetch` - 68 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 38 edges
7. `TKey` - 38 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `API` - 32 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/components/BatchActionBar.tsx → frontend/src/i18n/dict/index.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (168 total, 58 thin omitted)

### Community 0 - "APGroupModal.tsx"
Cohesion: 0.32
Nodes (8): APGroupModal(), profileLabel(), Props, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (24): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+16 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.22
Nodes (8): DICT, en, th, translate(), en, th, FILES, NAMESPACE_FILES

### Community 3 - "DataTable.tsx"
Cohesion: 0.10
Nodes (24): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+16 more)

### Community 4 - "JvEditor.tsx"
Cohesion: 0.11
Nodes (28): AccountMappingTable(), GLAccount, Props, BlockReason, BU_WIDE, JvEditor(), Overrides, rowId() (+20 more)

### Community 5 - "useOcrExtraction.ts"
Cohesion: 0.10
Nodes (24): JvState, DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps, extractFromFile (+16 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (25): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+17 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.08
Nodes (32): billed(), DEMO_BUYER, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma(), noop() (+24 more)

### Community 9 - "APLineItem"
Cohesion: 0.14
Nodes (20): ApDraft, Args, useAPDraft(), APDraftState, APExtractionProps, mountRestored(), TAX_PROFILES, APSubmissionProps (+12 more)

### Community 10 - "AccountingReview.tsx"
Cohesion: 0.08
Nodes (39): ItxOverrides, AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, configBanks, DetailRow, Props, InputTaxReconciliation() (+31 more)

### Community 11 - "orders.ts"
Cohesion: 0.11
Nodes (32): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+24 more)

### Community 12 - "useAuth"
Cohesion: 0.13
Nodes (17): ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+9 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.14
Nodes (19): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getSamplePaymentTypes(), POST_TYPES, PostType (+11 more)

### Community 15 - "api/email.ts"
Cohesion: 0.15
Nodes (18): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailHealth() (+10 more)

### Community 16 - "TopLevelConfigSection.tsx"
Cohesion: 0.13
Nodes (14): JvHeaderCard(), Props, TopLevelConfigSection(), useGlMasters(), DESCRIPTION_TAGS, joinDescription(), splitDescription(), CustomSearchSelect() (+6 more)

### Community 17 - "appKey"
Cohesion: 0.20
Nodes (16): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+8 more)

### Community 18 - "endpoints.ts"
Cohesion: 0.24
Nodes (11): createApiKey(), ActivityPage, API, Notification, NotificationList, Page, Props, Props (+3 more)

### Community 19 - "PmsPage.tsx"
Cohesion: 0.15
Nodes (21): ApiKeysPage(), cell(), createPmsKey(), failure(), fetchPmsKeys(), revokePmsKey(), failure(), getPmsSettings() (+13 more)

### Community 20 - "useMappingData.ts"
Cohesion: 0.22
Nodes (17): Props, Props, STATUS_LABEL, Props, MappingSet, MappingSets, GlMasters, prefetchGlMasters() (+9 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "FieldMapping"
Cohesion: 0.22
Nodes (16): Props, AddError, MappingItem, MappingStatus, SetStats, Undo, buildMappingSets(), FeeInvoiceSource (+8 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "useCheckout.ts"
Cohesion: 0.22
Nodes (12): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), usePricingCatalog() (+4 more)

### Community 28 - "useT"
Cohesion: 0.09
Nodes (31): DateRangePicker(), DateRangePickerProps, ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER (+23 more)

### Community 29 - "showToast"
Cohesion: 0.09
Nodes (30): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), useOcrExtraction(), applyExtractedData(), processFile(), reExtract() (+22 more)

### Community 30 - "OrderTable.tsx"
Cohesion: 0.11
Nodes (22): AdminCreditOrder, BatchAction, BatchActionBar(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction (+14 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.15
Nodes (11): BANK_LOGOS, BankDetectionBanner(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions() (+3 more)

### Community 34 - "ReviewDocument.tsx"
Cohesion: 0.27
Nodes (8): RowAction(), Props, ReviewDocument(), ExtractionWarningBanner(), Props, FIX, fixLinkProps(), warningText()

### Community 35 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (21): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, OPEN_STATUSES (+13 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (21): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), fetchAdminOrderDocuments() (+13 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (39): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), docLabel(), isCollapsed(), isOrphanBlockedCount() (+31 more)

### Community 40 - "SessionsPage.tsx"
Cohesion: 0.20
Nodes (17): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), endOfDay(), useTableData(), Alert (+9 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "EmailAutomationPage.tsx"
Cohesion: 0.13
Nodes (22): Column, KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps (+14 more)

### Community 44 - "useEmailSettings.ts"
Cohesion: 0.15
Nodes (27): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRulePayload, EmailSettings (+19 more)

### Community 45 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (25): daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+17 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.26
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+5 more)

### Community 47 - "useAPSubmission.ts"
Cohesion: 0.11
Nodes (25): Props, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+17 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (12): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), pmsIdFromHash(), QueueEmpty() (+4 more)

### Community 49 - "AdminRouter.tsx"
Cohesion: 0.35
Nodes (8): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminProtectedRoute(), useAdminAuth()

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "apiFetch"
Cohesion: 0.18
Nodes (19): _fetchExtract(), getARSettings(), approveDocument(), getPending(), rejectDocument(), suggestMapping(), useReviewDocument(), approve() (+11 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (15): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+7 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "ApiKeysPage.test.tsx"
Cohesion: 0.22
Nodes (6): createApiKey, fetchApiKeys, fetchTenants, revokeApiKey, ROW, writeText

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.16
Nodes (16): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, LITE, isSubscriptionCode(), PACK_META, PLAN_META (+8 more)

### Community 57 - "MaintenancePage.tsx"
Cohesion: 0.40
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 62 - "UsagePage.tsx"
Cohesion: 0.14
Nodes (16): fetchUsageSummary(), LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps (+8 more)

### Community 63 - "api.ts"
Cohesion: 0.13
Nodes (15): SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 64 - "TKey"
Cohesion: 0.17
Nodes (13): NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES (+5 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 67 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 68 - "TenantsPage.tsx"
Cohesion: 0.19
Nodes (12): fetchTenantDetail(), fetchTenants(), TenantSearch(), label(), Tenant, TenantSelector(), TenantSelectorProps, funnel() (+4 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "ExtractionsPage.tsx"
Cohesion: 0.26
Nodes (11): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+3 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "emailReview.ts"
Cohesion: 0.20
Nodes (12): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+4 more)

### Community 77 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 80 - "config.ts"
Cohesion: 0.12
Nodes (16): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+8 more)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.16
Nodes (17): catalogName(), useOrderHistory(), ActivePlanBanner(), OrderHistory(), OrderRow(), parseFocusId(), Pricing(), getUsage() (+9 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.24
Nodes (7): Mapping(), bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "PmsReviewDocument.tsx"
Cohesion: 0.07
Nodes (41): approvePmsDay(), failure(), getPmsDay(), PmsDay, PmsNewCode, PmsRow, rejectPmsDay(), Pick (+33 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.15
Nodes (22): Props, PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, DEMO_PACKS (+14 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.19
Nodes (13): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+5 more)

### Community 89 - "LanguageProvider"
Cohesion: 0.18
Nodes (8): OrderStatusBadge(), ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), readLang(), MAX_FILE_SIZE_MB

### Community 90 - "i18n/index.ts"
Cohesion: 0.05
Nodes (25): en, th, en, th, en, th, en, th (+17 more)

### Community 91 - "AppHeader.tsx"
Cohesion: 0.16
Nodes (9): adminDict, OrderReviewShell(), registerDict(), OrderReviewShell, Props, DarkModeToggle(), LanguageToggle(), isDarkNow() (+1 more)

### Community 92 - "MainMappingTable.tsx"
Cohesion: 0.70
Nodes (4): Props, MainMappings, MainMappingKey, SuggestionSource

### Community 94 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 95 - "banks.ts"
Cohesion: 0.13
Nodes (25): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField (+17 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.27
Nodes (11): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), CarmenSSOState (+3 more)

### Community 106 - "api/tenants.ts"
Cohesion: 0.13
Nodes (17): QueryParams, ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, TenantSubscriptionSummary, toggleTenantModule(), TenantDetail (+9 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.11
Nodes (18): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+10 more)

### Community 109 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 117 - "main.tsx"
Cohesion: 0.11
Nodes (13): AdminRouter, APInvoice, container, getRoute(), Mapping, OrderHistory, PmsPage, Pricing (+5 more)

### Community 119 - "recordInputTax"
Cohesion: 1.00
Nodes (3): recordInputTax(), RecordInputTax(), confirm()

### Community 122 - "useMapping.ts"
Cohesion: 0.18
Nodes (15): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+7 more)

### Community 125 - "adminFetch"
Cohesion: 0.22
Nodes (23): fetchApiKeys(), revokeApiKey(), buildQs(), unwrapDetail(), fetchEmailDocuments(), fetchQuotaOverview(), fetchErrorBreakdown(), fetchExtractionFailures() (+15 more)

### Community 130 - "PmsPage.test.tsx"
Cohesion: 0.18
Nodes (7): createPmsKey, fetchPmsKeys, getPmsSettings, putPmsCredential, putPmsSettings, revokePmsKey, SETTINGS

### Community 133 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 137 - "HeaderCard.tsx"
Cohesion: 0.25
Nodes (7): DATE_KEYS, HeaderCard(), Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.08
Nodes (22): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+14 more)

### Community 141 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (26): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props, APTableRow(), AP_STEPS (+18 more)

## Knowledge Gaps
- **680 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+675 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APGroupModal.tsx`, `APReviewStep.tsx`, `DataTable.tsx`, `JvEditor.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `APLineItem`, `AccountingReview.tsx`, `orders.ts`, `APAccountMappingStep.tsx`, `useAPExtraction.ts`, `HeaderCard.tsx`, `api/email.ts`, `TopLevelConfigSection.tsx`, `useSettlementMapping.ts`, `useAuth`, `PmsPage.tsx`, `useMappingData.ts`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `FieldMapping`, `showToast`, `OrderTable.tsx`, `DocumentPreview.tsx`, `ManualScan.tsx`, `ReviewDocument.tsx`, `shared/api/credits.ts`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `ProformaDocument.tsx`, `NotificationBell.tsx`, `SessionsPage.tsx`, `EmailAutomationPage.tsx`, `PeriodPicker.tsx`, `QueueRow.tsx`, `useAPSubmission.ts`, `ReviewQueue.tsx`, `AdminRouter.tsx`, `apiFetch`, `CheckoutFlow.tsx`, `MaintenancePage.tsx`, `UsagePage.tsx`, `TKey`, `DetailTable.tsx`, `TenantsPage.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `Mapping.test.tsx`, `PmsReviewDocument.tsx`, `Pricing.tsx`, `LanguageProvider`, `AppHeader.tsx`, `MainMappingTable.tsx`, `banks.ts`, `api/tenants.ts`, `recordInputTax`, `useMapping.ts`, `adminFetch`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrExtraction.ts`, `parseNum`, `APLineItem`, `EmailSettings.tsx`, `useAPSubmission.ts`, `PmsReviewDocument.tsx`, `apiFetch`, `useOcrSubmission.test.ts`, `AuthContext.tsx`, `FieldMapping`, `useMapping.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `APLineItem`, `AccountingReview.tsx`, `useSettlementMapping.ts`, `useAPExtraction.ts`, `appKey`, `endpoints.ts`, `PmsPage.tsx`, `useMappingData.ts`, `useCheckout.ts`, `showToast`, `shared/api/credits.ts`, `NotificationBell.tsx`, `useAPSubmission.ts`, `useOcrSubmission.test.ts`, `api.ts`, `emailReview.ts`, `useUserConsent.ts`, `config.ts`, `OrderHistory.tsx`, `PmsReviewDocument.tsx`, `client.ts`, `recordInputTax`, `useMapping.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _680 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11931818181818182 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `JvEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10873440285204991 - nodes in this community are weakly interconnected._