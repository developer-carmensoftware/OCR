# Graph Report - OCR  (2026-10-19)

## Corpus Check
- 419 files · ~308,090 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2229 nodes · 6214 edges · 171 communities (109 shown, 62 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `46b48d1f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APGroupModal.tsx
- APInvoice.tsx
- dict/index.ts
- ccJv.ts
- payment-mapping/types.ts
- PmsReviewDocument.tsx
- parseNum
- CustomModal.tsx
- screens.tsx
- useOcrWizard.ts
- AccountingReview.tsx
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- AccountMappingTable.tsx
- appKey
- useAPSubmission.ts
- RevokeKeyDialog.tsx
- useAPExtraction.ts
- compilerOptions
- 5. Components
- EmailSettings.tsx
- adminAuth.ts
- mappingSets.ts
- devDependencies
- shared/api/credits.ts
- OrderActions.tsx
- useOcrExtraction
- OrderTable.tsx
- DocumentPreview.tsx
- dependencies
- ManualScan.tsx
- FieldMapping
- PendingOrderBanner.tsx
- CreditsPage.tsx
- FeatureFlows.tsx
- formatThb
- NotificationDetailModal.tsx
- NotificationBell.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- useEmailSettings.ts
- DataTable.tsx
- QueueRow.tsx
- apiFetch
- ReviewQueue.tsx
- LanguageProvider
- scripts
- useReviewDocument.ts
- OrderWorkspace.tsx
- useOcrSubmission.ts
- compilerOptions
- emailReview.ts
- CheckoutFlow.tsx
- OrderDrawer.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- ArCustomerProfiles.tsx
- MetricChartImpl.tsx
- api.ts
- useT
- Carmen AI — OCR & Import System
- Skeleton.tsx
- APAmountSummary.tsx
- usePdfPasswordPrompt
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ApiKeysPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- UserConsentModal.tsx
- useNotifications.test.ts
- vercel.json
- Architecture
- useAPExtraction.test.ts
- OrderHistory.tsx
- Mapping.test.tsx
- ReviewDocument.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- main.tsx
- TenantSelector.tsx
- i18n/index.ts
- SlipViewer.tsx
- chrome.ts
- ocr.ts
- adminUsers.ts
- vitest
- vite-env.d.ts
- i18n/credits.ts
- mockPaths.test.ts
- client.ts
- useOcrWizard
- i18n/common.ts
- anomalies.ts
- TKey
- proforma.ts
- errors.ts
- extractions.ts
- llmLogs.ts
- login.ts
- LanguageContext.tsx
- dict/maintenance.ts
- ErrorBoundary
- eslint
- adminFetch
- cc.ts
- dict/apiKeys.ts
- useMapping.ts
- ar.ts
- warn.ts
- TenantsPage.tsx
- checkout.ts
- dict/common.ts
- EmailSettings.test.tsx
- i18n/maintenance.ts
- i18n/quotas.ts
- home.ts
- @types/react-dom
- i18n/tenants.ts
- quota.ts
- dict/modal.ts
- notif.ts
- normalizeYearToCE
- ApiKeysPage.test.tsx
- APAccountMappingStep.tsx
- vite
- useFileUpload.ts
- plan.ts
- dict/ap.ts
- @testing-library/react
- pms.ts
- @testing-library/jest-dom
- pricing.ts
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- i18n/usage.ts
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
- userUsage.ts
- @types/react
- review.ts
- AppHeader.test.tsx
- sessions.ts
- jsdom
- orev.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 258 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 64 edges
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

## Communities (171 total, 62 thin omitted)

### Community 0 - "APGroupModal.tsx"
Cohesion: 0.38
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 1 - "APInvoice.tsx"
Cohesion: 0.08
Nodes (39): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+31 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "ccJv.ts"
Cohesion: 0.12
Nodes (22): JvHeaderCard(), TopLevelConfigSection(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows() (+14 more)

### Community 4 - "payment-mapping/types.ts"
Cohesion: 0.17
Nodes (21): BulkApplyBar(), MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog(), Props (+13 more)

### Community 5 - "PmsReviewDocument.tsx"
Cohesion: 0.10
Nodes (26): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+18 more)

### Community 6 - "parseNum"
Cohesion: 0.14
Nodes (30): AmountSummary(), getAvailableFields(), useAPGrouping(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure() (+22 more)

### Community 7 - "CustomModal.tsx"
Cohesion: 0.07
Nodes (32): ModalType, Props, baseProps, TYPE_CONFIG, Spot(), SpotContext, SpotProvider, boldify() (+24 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (33): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+25 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.25
Nodes (10): useAPDraft(), mountRestored(), TAX_PROFILES, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 10 - "AccountingReview.tsx"
Cohesion: 0.09
Nodes (32): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, buildMappingSets() (+24 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.17
Nodes (18): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+10 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "AccountMappingTable.tsx"
Cohesion: 0.14
Nodes (11): GLAccount, Props, AISuggestBar(), Props, CustomSearchSelect(), handleScroll(), panelStyle(), Props (+3 more)

### Community 17 - "appKey"
Cohesion: 0.11
Nodes (28): bankCodeFromHash(), getAccountingConfig, seedOcrBranch(), useBankConfig(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings() (+20 more)

### Community 18 - "useAPSubmission.ts"
Cohesion: 0.13
Nodes (23): Props, Props, Props, APInvoiceHeader, ApDraft, Args, APDraftState, APExtractionProps (+15 more)

### Community 19 - "RevokeKeyDialog.tsx"
Cohesion: 0.16
Nodes (14): RevokeKeyDialog(), Props, StatusLine(), UrlText(), FeedStatus, usedRecently(), Button(), ButtonProps (+6 more)

### Community 20 - "useAPExtraction.ts"
Cohesion: 0.23
Nodes (11): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args, imagesToPdf() (+3 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "EmailSettings.tsx"
Cohesion: 0.12
Nodes (17): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+9 more)

### Community 24 - "adminAuth.ts"
Cohesion: 0.12
Nodes (26): adminLogin(), AdminLoginError, LoginResponse, AdminLayout(), getActiveHash(), AdminLogin(), classify(), LoginError (+18 more)

### Community 25 - "mappingSets.ts"
Cohesion: 0.26
Nodes (9): AddError, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels, ActiveScan, PaymentTypesHook (+1 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (26): RowState, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+18 more)

### Community 28 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 29 - "useOcrExtraction"
Cohesion: 0.14
Nodes (9): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), reExtract() (+1 more)

### Community 30 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (12): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+4 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.14
Nodes (17): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS, HeaderCard(), Props (+9 more)

### Community 34 - "FieldMapping"
Cohesion: 0.24
Nodes (17): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, Props, Props, Props, MainMappings, MasterAccount (+9 more)

### Community 35 - "PendingOrderBanner.tsx"
Cohesion: 0.16
Nodes (17): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), SLIP, catalogName(), isSubscriptionCode() (+9 more)

### Community 36 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "formatThb"
Cohesion: 0.24
Nodes (14): num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords() (+6 more)

### Community 39 - "NotificationDetailModal.tsx"
Cohesion: 0.14
Nodes (19): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, Props, REASON_KEY (+11 more)

### Community 40 - "NotificationBell.tsx"
Cohesion: 0.18
Nodes (12): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), TFn (+4 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.16
Nodes (15): ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps, getTabs(), monthStartStr(), QuotaModulesPage() (+7 more)

### Community 44 - "useEmailSettings.ts"
Cohesion: 0.15
Nodes (27): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRulePayload, EmailSettings (+19 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.12
Nodes (38): Column, DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir (+30 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.18
Nodes (15): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+7 more)

### Community 47 - "apiFetch"
Cohesion: 0.14
Nodes (26): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+18 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.12
Nodes (16): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), pmsIdFromHash(), QueueEmpty() (+8 more)

### Community 49 - "LanguageProvider"
Cohesion: 0.14
Nodes (11): MAP, OrderStatusBadge(), LanguageProvider(), readLang(), OrderStatus, failedRow, items, markRead (+3 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "useReviewDocument.ts"
Cohesion: 0.12
Nodes (22): approveDocument(), ItxOverrides, Props, BANK_LOGOS, BankDetectionBanner(), Props, DetailRow, Props (+14 more)

### Community 52 - "OrderWorkspace.tsx"
Cohesion: 0.24
Nodes (9): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), OrderWorkspace(), WsAction, wsInitial, wsReducer(), STAGE_KEY (+1 more)

### Community 53 - "useOcrSubmission.ts"
Cohesion: 0.11
Nodes (18): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig (+10 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "emailReview.ts"
Cohesion: 0.18
Nodes (16): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, getPending(), listActivity(), markChipSeen() (+8 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.12
Nodes (16): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload() (+8 more)

### Community 57 - "OrderDrawer.tsx"
Cohesion: 0.24
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, many(), order(), WsState, PaymentInfo

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 62 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 63 - "api.ts"
Cohesion: 0.12
Nodes (16): APVendorMapping, APVendorMappingResponse, ConfigPatch, SaveAccountingConfigResult, AccountingConfigRequest, AccountingConfigResponse, ApiError, APInvoiceItem (+8 more)

### Community 64 - "useT"
Cohesion: 0.15
Nodes (21): OrderReviewShell(), NAV_SECTIONS, APSuccessStep(), VendorSearch(), RowAction(), ACTIVE_TAG, containerVariants, Home() (+13 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 68 - "usePdfPasswordPrompt"
Cohesion: 0.48
Nodes (6): setup(), usePdfPasswordPrompt(), open(), prompt(), render(), submit()

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "ApiKeysPage.tsx"
Cohesion: 0.12
Nodes (21): ExtractionFailureRow, TenantSearch(), EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps, pmsEventsUrl() (+13 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "UserConsentModal.tsx"
Cohesion: 0.40
Nodes (5): COPY, Lang, Props, useIsMobile(), UserConsentModal()

### Community 77 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 80 - "useAPExtraction.test.ts"
Cohesion: 0.17
Nodes (11): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+3 more)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.33
Nodes (7): useOrderHistory(), ActivePlanBanner(), OrderHistory(), parseFocusId(), Pricing(), getStoredToken(), getPaymentInfo()

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "ReviewDocument.tsx"
Cohesion: 0.21
Nodes (14): OcrExtractionHook, useReviewDocument(), Props, ReviewDocument(), ExtractionWarningBanner(), Props, ExtractionWarning, FIX (+6 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.16
Nodes (15): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PackPresentation (+7 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.13
Nodes (23): revokeSession(), clearToken(), storeToken(), getConsentStatus(), postConsent(), ConsentGate(), Props, AuthContext (+15 more)

### Community 89 - "main.tsx"
Cohesion: 0.12
Nodes (19): container, EmailSettings, getRoute(), Home, Mapping, OrderHistory, OrderReviewShell, Pricing (+11 more)

### Community 90 - "TenantSelector.tsx"
Cohesion: 0.25
Nodes (5): label(), Tenant, TenantSelectorProps, fetchTenants, TENANTS

### Community 91 - "i18n/index.ts"
Cohesion: 0.09
Nodes (13): en, th, adminDict, AdminKey, en, th, en, th (+5 more)

### Community 94 - "ocr.ts"
Cohesion: 0.17
Nodes (12): _fetchExtract(), fetchTimeout(), ApiError, ExtractedRow, extractFromFile(), PDF_PASSWORD_REQUIRED, PdfInfoResult, toExtractedRows() (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.15
Nodes (19): exchangeSSOToken(), getUsage(), UsageData, API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient() (+11 more)

### Community 106 - "useOcrWizard"
Cohesion: 0.20
Nodes (18): processFile(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange() (+10 more)

### Community 109 - "TKey"
Cohesion: 0.14
Nodes (13): BatchAction, BatchActionBar(), Props, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection() (+5 more)

### Community 115 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (34): fetchUsageSummary(), DateRangePicker(), DateRangePickerProps, MetricChart(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS (+26 more)

### Community 117 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 119 - "adminFetch"
Cohesion: 0.13
Nodes (37): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, unwrapDetail(), fetchAlerts(), fetchJobs(), fetchSessions() (+29 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.17
Nodes (19): saveARSettings(), rejectDocument(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings (+11 more)

### Community 125 - "TenantsPage.tsx"
Cohesion: 0.19
Nodes (17): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenantDetail(), fetchTenants(), TenantRow (+9 more)

### Community 128 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 137 - "normalizeYearToCE"
Cohesion: 0.31
Nodes (9): buildInvoicePayload(), handleAddInputTax(), DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO() (+1 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): AccountMappingTable(), APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow (+1 more)

### Community 141 - "useFileUpload.ts"
Cohesion: 0.18
Nodes (9): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl() (+1 more)

## Knowledge Gaps
- **666 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+661 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **62 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APGroupModal.tsx`, `APInvoice.tsx`, `ccJv.ts`, `payment-mapping/types.ts`, `PmsReviewDocument.tsx`, `parseNum`, `CustomModal.tsx`, `screens.tsx`, `AccountingReview.tsx`, `orders.ts`, `APAccountMappingStep.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `AccountMappingTable.tsx`, `useAPSubmission.ts`, `RevokeKeyDialog.tsx`, `useAPExtraction.ts`, `adminAuth.ts`, `shared/api/credits.ts`, `OrderActions.tsx`, `OrderTable.tsx`, `DocumentPreview.tsx`, `ManualScan.tsx`, `FieldMapping`, `PendingOrderBanner.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `formatThb`, `NotificationDetailModal.tsx`, `NotificationBell.tsx`, `QuotaModulesPage.tsx`, `DataTable.tsx`, `QueueRow.tsx`, `ReviewQueue.tsx`, `LanguageProvider`, `useReviewDocument.ts`, `OrderWorkspace.tsx`, `CheckoutFlow.tsx`, `OrderDrawer.tsx`, `ArCustomerProfiles.tsx`, `MetricChartImpl.tsx`, `APAmountSummary.tsx`, `ApiKeysPage.tsx`, `UserConsentModal.tsx`, `OrderHistory.tsx`, `ReviewDocument.tsx`, `Pricing.tsx`, `main.tsx`, `TenantSelector.tsx`, `SlipViewer.tsx`, `client.ts`, `useOcrWizard`, `TKey`, `LanguageContext.tsx`, `adminFetch`, `useMapping.ts`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `PmsReviewDocument.tsx`, `parseNum`, `useSettlementMapping.ts`, `useFileUpload.ts`, `appKey`, `useAPSubmission.ts`, `useAPExtraction.ts`, `shared/api/credits.ts`, `FieldMapping`, `PendingOrderBanner.tsx`, `NotificationDetailModal.tsx`, `QueueRow.tsx`, `useReviewDocument.ts`, `useOcrSubmission.ts`, `emailReview.ts`, `api.ts`, `useAPExtraction.test.ts`, `OrderHistory.tsx`, `AuthContext.tsx`, `ocr.ts`, `client.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `showToast()` connect `useMapping.ts` to `FieldMapping`, `PmsReviewDocument.tsx`, `parseNum`, `useOcrWizard.ts`, `useOcrWizard`, `useFileUpload.ts`, `apiFetch`, `appKey`, `useAPSubmission.ts`, `useReviewDocument.ts`, `useOcrSubmission.ts`, `EmailSettings.tsx`, `AuthContext.tsx`, `useOcrExtraction`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _666 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07764876632801161 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11693548387096774 - nodes in this community are weakly interconnected._