# Graph Report - OCR  (2026-10-28)

## Corpus Check
- 421 files · ~308,185 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2236 nodes · 6236 edges · 164 communities (104 shown, 60 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32ed51dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PaymentMappingDialog.tsx
- ap-invoice/constants.ts
- dict/index.ts
- ccJv.ts
- appKey
- showToast
- parseNum
- TutorialModal.tsx
- screens.tsx
- useOcrWizard.ts
- config.ts
- orders.ts
- getCarmenUrl
- useReviewDocument.ts
- ManualScan.tsx
- EmailAutomationPage.tsx
- emailAutomation.ts
- useOcrExtraction.ts
- Mapping.tsx
- ApiKeysPage.tsx
- AccountingReview.tsx
- compilerOptions
- 5. Components
- useAPExtraction.ts
- AdminLogin.tsx
- OrderTable.tsx
- devDependencies
- shared/api/credits.ts
- PeriodPicker.tsx
- formatThb
- CreditsPage.tsx
- DocumentPreview.tsx
- dependencies
- DetailTable.tsx
- useMapping.ts
- useEmailSettings.ts
- QuotaModulesPage.tsx
- useT
- OrderHistory.tsx
- NotificationBell.tsx
- useOcrWizard
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- EmailSettings.tsx
- DataTable.tsx
- QueueRow.tsx
- apiFetch
- ReviewQueue.tsx
- adminAuth.ts
- scripts
- api.ts
- MaintenanceGate.tsx
- emailReview.ts
- compilerOptions
- OrderWorkspace.tsx
- CustomModal.tsx
- LanguageProvider
- CLAUDE.md
- Contributing
- i18n/common.ts
- i18n/credits.ts
- contact.ts
- i18n/email.ts
- TKey
- Carmen AI — OCR & Import System
- APInvoice.tsx
- APAmountSummary.tsx
- UsageIndicator.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminFetch
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderActions.tsx
- client.ts
- vercel.json
- Architecture
- EmailSettings.test.tsx
- LanguageContext.tsx
- Mapping.test.tsx
- ReviewDocument.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- main.tsx
- pack.ts
- i18n/index.ts
- qr.ts
- sessions.ts
- ocr.ts
- CheckoutFlow.tsx
- checkout.ts
- vite-env.d.ts
- postcss
- mockPaths.test.ts
- getStoredToken
- OrderDrawer.tsx
- typescript
- dict/maintenance.ts
- orev.ts
- pms.ts
- ArCustomerProfiles.tsx
- proforma.ts
- quota.ts
- login.ts
- slip.ts
- warn.ts
- @testing-library/react
- eslint
- ErrorBoundary
- setup.ts
- dict/apiKeys.ts
- TenantSelector.test.tsx
- ar.ts
- Tooltip.tsx
- TenantsPage.tsx
- adminUsers.ts
- dict/common.ts
- anomalies.ts
- chrome.ts
- i18n/quotas.ts
- home.ts
- @types/react-dom
- extractions.ts
- jobs.ts
- tenantRanking.ts
- i18n/usage.ts
- userUsage.ts
- ApiKeysPage.test.tsx
- APLineItem
- vite
- useAPExtraction.test.ts
- plan.ts
- dict/ap.ts
- dict/modal.ts
- tutorial.ts
- @testing-library/jest-dom
- @eslint/js
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- dict/usage.ts
- whatsnew.ts
- @types/react
- notif.ts
- AppHeader.tsx
- jsdom

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
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (164 total, 60 thin omitted)

### Community 0 - "PaymentMappingDialog.tsx"
Cohesion: 0.09
Nodes (36): AccountMappingTable(), GLAccount, Props, MappingRow(), Props, BulkApplyBar(), Props, MappingTable() (+28 more)

### Community 1 - "ap-invoice/constants.ts"
Cohesion: 0.09
Nodes (35): COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS() (+27 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "ccJv.ts"
Cohesion: 0.09
Nodes (29): AccountingReview(), JvHeaderCard(), Props, Props, TopLevelConfigSection(), useGlMasters(), descriptionForBank(), CONFIG (+21 more)

### Community 4 - "appKey"
Cohesion: 0.19
Nodes (16): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+8 more)

### Community 5 - "showToast"
Cohesion: 0.12
Nodes (21): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+13 more)

### Community 6 - "parseNum"
Cohesion: 0.17
Nodes (26): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+18 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.08
Nodes (28): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+20 more)

### Community 8 - "screens.tsx"
Cohesion: 0.10
Nodes (27): EnterpriseCard(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+19 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.20
Nodes (13): useAPDraft(), mountRestored(), TAX_PROFILES, inputTaxOwed(), draftWorthOffering(), owed, clearDraft(), DraftKind (+5 more)

### Community 10 - "config.ts"
Cohesion: 0.13
Nodes (17): saveARSettings(), rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast, withMasters() (+9 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (20): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+12 more)

### Community 12 - "getCarmenUrl"
Cohesion: 0.14
Nodes (16): APSuccessStep(), VendorSearch(), RowAction(), NotificationDetailModal(), REASON_KEY, AuthScreen(), AuthScreenProps, AuthState (+8 more)

### Community 13 - "useReviewDocument.ts"
Cohesion: 0.11
Nodes (28): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+20 more)

### Community 14 - "ManualScan.tsx"
Cohesion: 0.14
Nodes (10): BankDetectionBanner(), DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan (+2 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "emailAutomation.ts"
Cohesion: 0.24
Nodes (14): ApiFieldError, call(), deleteToken(), getBankCodes(), getSettings(), getToken(), json(), putToken() (+6 more)

### Community 17 - "useOcrExtraction.ts"
Cohesion: 0.08
Nodes (30): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), JvState, DetailRow, EXTRACTION_STAGES, HeaderData (+22 more)

### Community 18 - "Mapping.tsx"
Cohesion: 0.32
Nodes (4): MainMappingTable(), buildMappingSets(), Mapping(), SwapLabel()

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.16
Nodes (20): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow, FeedStatus, pmsEventsUrl() (+12 more)

### Community 20 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (33): ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, DetailRow, InputTaxPanel(), Props, InputTaxReconciliation(), Props (+25 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useAPExtraction.ts"
Cohesion: 0.08
Nodes (29): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args, APSubmissionProps (+21 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.31
Nodes (7): AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss(), AdminLogin

### Community 25 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint-plugin-react-hooks, globals, prettier, @testing-library/dom (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (26): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+18 more)

### Community 28 - "PeriodPicker.tsx"
Cohesion: 0.08
Nodes (42): fetchUsageSummary(), DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS (+34 more)

### Community 29 - "formatThb"
Cohesion: 0.24
Nodes (13): num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), formatThb() (+5 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "DetailTable.tsx"
Cohesion: 0.18
Nodes (14): BANK_LOGOS, Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), BANK_THAI_NAMES (+6 more)

### Community 34 - "useMapping.ts"
Cohesion: 0.19
Nodes (20): PostType, Props, AddError, MappingItem, SetStats, Undo, FeeInvoiceSource, MappingSetsInput (+12 more)

### Community 35 - "useEmailSettings.ts"
Cohesion: 0.21
Nodes (13): BankCode, EmailApiError, EmailDocType, EmailRulePayload, EmailSettings, TokenStatus, Draft, EmailSettingsController (+5 more)

### Community 36 - "QuotaModulesPage.tsx"
Cohesion: 0.11
Nodes (20): ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab (+12 more)

### Community 37 - "useT"
Cohesion: 0.16
Nodes (14): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+6 more)

### Community 38 - "OrderHistory.tsx"
Cohesion: 0.13
Nodes (20): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+12 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (41): ActivityPage, WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList (+33 more)

### Community 40 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "date.ts"
Cohesion: 0.27
Nodes (11): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, handleAddInputTax(), DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE() (+3 more)

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.13
Nodes (15): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+7 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.06
Nodes (60): resolveAlert(), revokeSession(), ExtractionFailureRow, TenantSearch(), Column, DataTable(), DataTableProps, ExpandedRowWrapperProps (+52 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.21
Nodes (16): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+8 more)

### Community 47 - "apiFetch"
Cohesion: 0.13
Nodes (30): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+22 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.19
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), pmsIdFromHash(), QueueEmpty() (+3 more)

### Community 49 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "api.ts"
Cohesion: 0.11
Nodes (22): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, BlockReason, JvEditor(), Props, rowId() (+14 more)

### Community 52 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 53 - "emailReview.ts"
Cohesion: 0.20
Nodes (10): ActivityFilter, ALL_SCOPES, ApproveResult, listActivity(), QUEUE_CHIPS, ReviewDocument, ReviewFlag, Props (+2 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "OrderWorkspace.tsx"
Cohesion: 0.20
Nodes (10): fetchAdminOrderDocuments(), getOrderSlipUrl(), listCreditOrders(), ContactBuyer(), OrderWorkspace(), WsAction, wsInitial, wsReducer() (+2 more)

### Community 56 - "CustomModal.tsx"
Cohesion: 0.15
Nodes (9): ACCEPTED, Props, SLIP, CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG (+1 more)

### Community 57 - "LanguageProvider"
Cohesion: 0.20
Nodes (5): configBanks, QUIET, ZERO, LanguageProvider(), readLang()

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 64 - "TKey"
Cohesion: 0.11
Nodes (21): BatchAction, BatchActionBar(), Props, NavItem, NavSection, CompanyInfoSection(), PLACEHOLDER_KEYS, Props (+13 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "APInvoice.tsx"
Cohesion: 0.11
Nodes (16): APFieldMappingStep(), APUploadStep(), INSTRUCTIONS, Props, APInvoice(), ExtractionSkeleton(), Props, Skeleton() (+8 more)

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 68 - "UsageIndicator.tsx"
Cohesion: 0.17
Nodes (11): AppHeader(), ConsentGate(), Props, T, UsageIndicator(), COPY, Lang, Props (+3 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "adminFetch"
Cohesion: 0.14
Nodes (35): fetchApiKeys(), revokeApiKey(), adminLogin(), LoginResponse, buildQs(), QueryParams, unwrapDetail(), fetchAlerts() (+27 more)

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

### Community 77 - "client.ts"
Cohesion: 0.27
Nodes (11): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), CarmenSSOState (+3 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 80 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 81 - "LanguageContext.tsx"
Cohesion: 0.24
Nodes (8): MAP, OrderStatusBadge(), Lang, Ctx, FALLBACK_CTX, LanguageCtx, Vars, OrderStatus

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "ReviewDocument.tsx"
Cohesion: 0.19
Nodes (12): OcrExtractionHook, Props, ReviewDocument(), ExtractionWarningBanner(), Props, ExtractionWarning, FIX, fixLinkProps() (+4 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.15
Nodes (20): PackList(), Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, PurchaseStep, STEPS (+12 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.13
Nodes (22): revokeSession(), clearToken(), storeToken(), getConsentStatus(), postConsent(), AuthContext, AuthContextValue, AuthProvider() (+14 more)

### Community 89 - "main.tsx"
Cohesion: 0.20
Nodes (9): AdminRouter, APInvoice, container, getRoute(), Mapping, OrderHistory, Pricing, Router() (+1 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.08
Nodes (19): en, th, adminDict, AdminKey, en, th, en, th (+11 more)

### Community 94 - "ocr.ts"
Cohesion: 0.10
Nodes (23): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), fetchTimeout(), ApiError, ExtractedRow (+15 more)

### Community 95 - "CheckoutFlow.tsx"
Cohesion: 0.25
Nodes (10): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, SlipUpload(), PACK_META, CheckoutSession (+2 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "getStoredToken"
Cohesion: 0.47
Nodes (6): OrderHistory(), parseFocusId(), Pricing(), getUsage(), getStoredToken(), getPaymentInfo()

### Community 106 - "OrderDrawer.tsx"
Cohesion: 0.24
Nodes (7): AdminCreditOrder, OrderDrawer(), Props, Props, many(), order(), WsState

### Community 111 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 119 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 124 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 125 - "TenantsPage.tsx"
Cohesion: 0.19
Nodes (17): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenantDetail(), fetchTenants(), TenantRow (+9 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APLineItem"
Cohesion: 0.10
Nodes (27): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+19 more)

### Community 141 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 169 - "AppHeader.tsx"
Cohesion: 0.16
Nodes (12): AdminLayout(), getActiveHash(), OrderReviewShell(), OrderReviewShell, AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle() (+4 more)

## Knowledge Gaps
- **667 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+662 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `PaymentMappingDialog.tsx`, `ap-invoice/constants.ts`, `ccJv.ts`, `showToast`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `config.ts`, `orders.ts`, `APLineItem`, `getCarmenUrl`, `ManualScan.tsx`, `EmailAutomationPage.tsx`, `useReviewDocument.ts`, `Mapping.tsx`, `ApiKeysPage.tsx`, `AccountingReview.tsx`, `useAPExtraction.ts`, `AdminLogin.tsx`, `OrderTable.tsx`, `shared/api/credits.ts`, `PeriodPicker.tsx`, `formatThb`, `CreditsPage.tsx`, `DocumentPreview.tsx`, `DetailTable.tsx`, `useMapping.ts`, `QuotaModulesPage.tsx`, `OrderHistory.tsx`, `NotificationBell.tsx`, `useOcrWizard`, `AppHeader.tsx`, `DataTable.tsx`, `QueueRow.tsx`, `ReviewQueue.tsx`, `api.ts`, `MaintenanceGate.tsx`, `OrderWorkspace.tsx`, `CustomModal.tsx`, `TKey`, `APInvoice.tsx`, `APAmountSummary.tsx`, `UsageIndicator.tsx`, `adminFetch`, `OrderActions.tsx`, `LanguageContext.tsx`, `ReviewDocument.tsx`, `Pricing.tsx`, `CheckoutFlow.tsx`, `getStoredToken`, `OrderDrawer.tsx`, `ArCustomerProfiles.tsx`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `appKey`, `showToast`, `parseNum`, `useOcrWizard.ts`, `config.ts`, `APLineItem`, `useReviewDocument.ts`, `useAPExtraction.test.ts`, `useOcrExtraction.ts`, `AccountingReview.tsx`, `useAPExtraction.ts`, `shared/api/credits.ts`, `OrderHistory.tsx`, `NotificationBell.tsx`, `QueueRow.tsx`, `api.ts`, `emailReview.ts`, `client.ts`, `AuthContext.tsx`, `ocr.ts`, `getStoredToken`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useMapping.ts`, `parseNum`, `useOcrWizard`, `useOcrWizard.ts`, `config.ts`, `APLineItem`, `EmailSettings.tsx`, `useReviewDocument.ts`, `apiFetch`, `useOcrExtraction.ts`, `api.ts`, `useAPExtraction.ts`, `AuthContext.tsx`, `ocr.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _667 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PaymentMappingDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08673469387755102 - nodes in this community are weakly interconnected._
- **Should `ap-invoice/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08792270531400966 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._