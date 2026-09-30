# Graph Report - OCR  (2026-09-30)

## Corpus Check
- 396 files · ~280,731 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2107 nodes · 5823 edges · 161 communities (101 shown, 60 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2689d731`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- showToast
- APReviewStep.tsx
- dict/index.ts
- adminFetch
- ManualScan.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- FieldMapping
- orders.ts
- client.ts
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- useAPSubmission.ts
- AccountingReview.tsx
- MainMappingTable.tsx
- OrderWorkspace.tsx
- APInvoice.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- useMappingData.ts
- Pricing.tsx
- devDependencies
- useMapping.ts
- CreditsPage.tsx
- useOcrWizard
- ProformaDocument.tsx
- OrderActions.tsx
- dependencies
- PaymentMappingDialog.tsx
- ExtractionsPage.tsx
- TopLevelConfigSection.tsx
- TKey
- FeatureFlows.tsx
- BankDetectionBanner.tsx
- NotificationBell.tsx
- useAPExtraction.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- InputTaxReconciliation.tsx
- QueueRow.tsx
- QuotaModulesPage.tsx
- TenantsPage.tsx
- AdminLogin.tsx
- ocr.ts
- DarkModeToggle.tsx
- scripts
- OrderHistory.tsx
- useOcrExtraction.ts
- useOcrSubmission.test.ts
- compilerOptions
- routes.tsx
- shared/api/credits.ts
- AppHeader.test.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- useT
- emailReview.ts
- DetailTable.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- CheckoutFlow.tsx
- ArCustomerProfiles.tsx
- main.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminUsers.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- CustomModal.tsx
- i18n/credits.ts
- vercel.json
- Architecture
- i18n/index.ts
- AdminAuthContext.tsx
- i18n/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- ReviewDocument.tsx
- performance.ts
- Skeleton.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- DocumentPreview.tsx
- Tooltip.tsx
- vitest
- vite-env.d.ts
- SlipViewer.tsx
- mockPaths.test.ts
- i18n/quotas.ts
- AdminCreditOrder
- i18n/common.ts
- useEmailSettings.ts
- anomalies.ts
- LanguageProvider
- LanguageContext.tsx
- OrderTable.tsx
- tenantRanking.ts
- errors.ts
- TenantSelector.test.tsx
- extractions.ts
- i18n/usage.ts
- i18n/maintenance.ts
- ErrorBoundary
- ar.ts
- AuthContext.tsx
- CompanyInfoSection.tsx
- DataTable.tsx
- getCarmenUrl
- i18n/email.ts
- dict/ap.ts
- cc.ts
- whatsnew.ts
- @types/react
- flows.ts
- home.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- dict/usage.ts
- notif.ts
- dict/modal.ts
- dict/maintenance.ts
- vite
- qr.ts
- proforma.ts
- review.ts
- @testing-library/react
- warn.ts
- @testing-library/jest-dom
- slip.ts
- 01-csv-sidecar-ingestion.md
- tutorial.ts
- dict/nav.ts
- order.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- i18n/tenants.ts
- plan.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 245 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 58 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 34 edges
8. `appKey()` - 33 edges
9. `FieldMapping` - 31 edges
10. `APLineItem` - 30 edges

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

## Communities (161 total, 60 thin omitted)

### Community 0 - "showToast"
Cohesion: 0.15
Nodes (18): Args, useAPDraft(), mountRestored(), TAX_PROFILES, APVendorProps, useAPVendor(), rejectDocument(), reject() (+10 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (24): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+16 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.13
Nodes (12): en, th, DICT, en, th, translate(), en, th (+4 more)

### Community 3 - "adminFetch"
Cohesion: 0.23
Nodes (22): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), getOrderSlipUrl(), AdminUserRow (+14 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.18
Nodes (9): DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions() (+1 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.16
Nodes (27): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+19 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (33): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+25 more)

### Community 9 - "api.ts"
Cohesion: 0.12
Nodes (20): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, useMappingSuggestions(), accountName(), AccountingConfigRequest (+12 more)

### Community 10 - "FieldMapping"
Cohesion: 0.28
Nodes (12): AddError, MappingItem, SetStats, Undo, FeeInvoiceSource, MappingSetsInput, labels, ActiveScan (+4 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "client.ts"
Cohesion: 0.15
Nodes (17): exchangeSSOToken(), UsageData, API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), fetchTimeout(), getStoredToken() (+9 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.12
Nodes (25): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+17 more)

### Community 15 - "useAPSubmission.ts"
Cohesion: 0.09
Nodes (32): Props, Props, Props, Props, VendorSearch(), APInvoiceHeader, ApDraft, APDraftState (+24 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.06
Nodes (59): getPending(), ItxOverrides, AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, Props, DetailRow, Props (+51 more)

### Community 17 - "MainMappingTable.tsx"
Cohesion: 0.14
Nodes (20): AccountMappingTable(), GLAccount, MainMappingTable(), Props, BulkApplyBar(), MainMappings, MainMappingKey, SuggestionSource (+12 more)

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.20
Nodes (11): CreditLedgerEntry, fetchAdminOrderDocuments(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 19 - "APInvoice.tsx"
Cohesion: 0.07
Nodes (30): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+22 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 24 - "useMappingData.ts"
Cohesion: 0.27
Nodes (12): JvHeaderCard(), Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData() (+4 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.18
Nodes (15): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, priceLines(), ENTERPRISE, PackPresentation (+7 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "useMapping.ts"
Cohesion: 0.12
Nodes (28): saveARSettings(), bankCodeFromHash(), getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, loaded() (+20 more)

### Community 28 - "CreditsPage.tsx"
Cohesion: 0.19
Nodes (18): buildQs(), QueryParams, adjustCredits(), CreditBalance, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits() (+10 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 30 - "ProformaDocument.tsx"
Cohesion: 0.25
Nodes (11): PaymentInfo, expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "PaymentMappingDialog.tsx"
Cohesion: 0.23
Nodes (15): MappingRow(), Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, Props (+7 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+6 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.16
Nodes (10): BANK_OPTIONS, Props, TEMPLATE_TAGS, TopLevelConfigSection(), BankConfigHook, CustomSearchSelect(), Props, SelectOption (+2 more)

### Community 36 - "TKey"
Cohesion: 0.16
Nodes (13): BatchAction, Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants (+5 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "BankDetectionBanner.tsx"
Cohesion: 0.25
Nodes (5): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+34 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.09
Nodes (35): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping, getPdfInfo, getUsage (+27 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.14
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 43 - "InputTaxReconciliation.tsx"
Cohesion: 0.21
Nodes (13): InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), DateInput(), DateInputProps (+5 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.35
Nodes (10): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+2 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (25): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), fetchUsageTotals(), EmptyState(), EmptyStateProps, Tab (+17 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.24
Nodes (9): fetchTenantDetail(), TenantRow, KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

### Community 47 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 48 - "ocr.ts"
Cohesion: 0.10
Nodes (22): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ApiError, ExtractedRow, extractFromFile() (+14 more)

### Community 49 - "DarkModeToggle.tsx"
Cohesion: 0.70
Nodes (3): DarkModeToggle(), isDarkNow(), useDarkMode()

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.13
Nodes (23): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+15 more)

### Community 52 - "useOcrExtraction.ts"
Cohesion: 0.14
Nodes (15): useFileUpload(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionProps, persistScanForMapping(), OcrSubmissionHook (+7 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (19): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), CarmenJvPayload, defaultConfig, defaultRows (+11 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "routes.tsx"
Cohesion: 0.17
Nodes (12): fetchTenantRanking(), Column, AdminLayout(), getActiveHash(), NAV_SECTIONS, Overview, getColsCost(), getColsPerf() (+4 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (28): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+20 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "useT"
Cohesion: 0.12
Nodes (44): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage() (+36 more)

### Community 62 - "emailReview.ts"
Cohesion: 0.20
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 63 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.29
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (11): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP (+3 more)

### Community 67 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 68 - "main.tsx"
Cohesion: 0.14
Nodes (17): AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, registerDict(), AdminRouter, container, EmailSettings (+9 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "CustomModal.tsx"
Cohesion: 0.19
Nodes (8): OrderDrawer(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.07
Nodes (16): en, th, adminDict, AdminKey, en, th, en, th (+8 more)

### Community 81 - "AdminAuthContext.tsx"
Cohesion: 0.33
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "ReviewDocument.tsx"
Cohesion: 0.20
Nodes (13): RowAction(), OcrExtractionHook, Props, ReviewDocument(), ExtractionWarningBanner(), Props, ExtractionWarning, FIX (+5 more)

### Community 89 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 94 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 95 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 106 - "AdminCreditOrder"
Cohesion: 0.29
Nodes (6): AdminCreditOrder, Props, Props, many(), order(), WsState

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (40): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+32 more)

### Community 110 - "LanguageProvider"
Cohesion: 0.22
Nodes (6): MAP, OrderStatusBadge(), LITE, LanguageProvider(), readLang(), OrderStatus

### Community 111 - "LanguageContext.tsx"
Cohesion: 0.09
Nodes (28): fetchTenants(), fetchErrorBreakdown(), fetchUsageSummary(), LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS (+20 more)

### Community 112 - "OrderTable.tsx"
Cohesion: 0.19
Nodes (13): BatchActionBar(), BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable() (+5 more)

### Community 119 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 121 - "AuthContext.tsx"
Cohesion: 0.09
Nodes (33): revokeSession(), clearToken(), storeToken(), getConsentStatus(), postConsent(), ConsentGate(), Props, AuthScreen() (+25 more)

### Community 122 - "CompanyInfoSection.tsx"
Cohesion: 0.47
Nodes (5): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, CompanyData

### Community 123 - "DataTable.tsx"
Cohesion: 0.10
Nodes (18): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+10 more)

### Community 124 - "getCarmenUrl"
Cohesion: 0.23
Nodes (10): AppHeader(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri() (+2 more)

## Knowledge Gaps
- **636 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+631 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `showToast`, `APReviewStep.tsx`, `adminFetch`, `ManualScan.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `orders.ts`, `client.ts`, `useSettlementMapping.ts`, `useAPSubmission.ts`, `AccountingReview.tsx`, `MainMappingTable.tsx`, `OrderWorkspace.tsx`, `APInvoice.tsx`, `EmailAutomationPage.tsx`, `MaintenanceGate.tsx`, `useMappingData.ts`, `Pricing.tsx`, `useMapping.ts`, `CreditsPage.tsx`, `useOcrWizard`, `ProformaDocument.tsx`, `OrderActions.tsx`, `PaymentMappingDialog.tsx`, `ExtractionsPage.tsx`, `TopLevelConfigSection.tsx`, `TKey`, `FeatureFlows.tsx`, `BankDetectionBanner.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `InputTaxReconciliation.tsx`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `TenantsPage.tsx`, `AdminLogin.tsx`, `DarkModeToggle.tsx`, `OrderHistory.tsx`, `routes.tsx`, `shared/api/credits.ts`, `DetailTable.tsx`, `APGroupModal.tsx`, `CheckoutFlow.tsx`, `ArCustomerProfiles.tsx`, `main.tsx`, `CustomModal.tsx`, `ReviewDocument.tsx`, `APAmountSummary.tsx`, `DocumentPreview.tsx`, `SlipViewer.tsx`, `LanguageProvider`, `LanguageContext.tsx`, `OrderTable.tsx`, `CompanyInfoSection.tsx`, `DataTable.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Why does `useOcrExtraction()` connect `useOcrWizard` to `ocr.ts`, `useOcrExtraction.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `useAPExtraction.ts` to `showToast`, `CheckoutFlow.tsx`, `parseNum`, `NotificationBell.tsx`, `api.ts`, `InputTaxReconciliation.tsx`, `client.ts`, `useSettlementMapping.ts`, `useAPSubmission.ts`, `AccountingReview.tsx`, `ocr.ts`, `OrderHistory.tsx`, `useOcrSubmission.test.ts`, `useMappingData.ts`, `AuthContext.tsx`, `shared/api/credits.ts`, `useMapping.ts`, `emailReview.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _636 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._