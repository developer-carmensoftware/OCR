# Graph Report - OCR  (2026-09-29)

## Corpus Check
- 392 files · ~274,931 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2074 nodes · 5713 edges · 158 communities (101 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aeb65b0f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- adminFetch
- ManualScan.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- AppHeader.test.tsx
- orders.ts
- OrderDrawer.tsx
- Mapping.tsx
- eslint-plugin-react-hooks
- apiFetch
- ccJv.ts
- showToast
- OrderWorkspace.tsx
- ExtractionsPage.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- banks.ts
- useMapping.ts
- Pricing.tsx
- devDependencies
- storage.ts
- CreditsPage.tsx
- useOcrSubmission.test.ts
- useOcrWizard
- OrderActions.tsx
- dependencies
- FieldMapping
- APInvoice.tsx
- TopLevelConfigSection.tsx
- useUserConsent.ts
- FeatureFlows.tsx
- useAPExtraction.test.ts
- NotificationBell.tsx
- useAPExtraction.ts
- AuthContext.tsx
- ReviewDocument.test.tsx
- date.ts
- QueueRow.tsx
- QuotaModulesPage.tsx
- useT
- main.tsx
- ocr.ts
- APLineItem
- scripts
- OrderHistory.tsx
- AccountingReview.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- shared/api/auth.ts
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- AdminRouter.tsx
- AdminLogin.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- CheckoutFlow.tsx
- PaymentTypeModal.test.tsx
- client.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminUsers.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- useOcrExtraction.test.ts
- AdminAuthContext.tsx
- vercel.json
- Architecture
- i18n/index.ts
- EmailSettings.test.tsx
- llmLogs.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- useReviewDocument.ts
- AppHeader.tsx
- ErrorBoundary
- jsdom
- @testing-library/react
- eslint
- checkout.ts
- DocumentPreview.tsx
- LanguageProvider
- vitest
- vite-env.d.ts
- login.ts
- mockPaths.test.ts
- OrderTable.tsx
- SlipViewer.tsx
- i18n/common.ts
- useEmailSettings.ts
- anomalies.ts
- chrome.ts
- UsagePage.tsx
- TKey
- EmailSettings.tsx
- errors.ts
- TenantSelector.test.tsx
- quotas.ts
- extractions.ts
- APUploadStep.tsx
- i18n/credits.ts
- ar.ts
- useAuth
- i18n/maintenance.ts
- DataTable.tsx
- getCarmenUrl
- home.ts
- dict/modal.ts
- pricing.ts
- whatsnew.ts
- @types/react
- cc.ts
- OrderTable.test.tsx
- @types/react-dom
- i18n/nav.ts
- dict/common.ts
- dict/maintenance.ts
- dict/usage.ts
- notif.ts
- i18n/usage.ts
- i18n/tenants.ts
- vite
- flows.ts
- proforma.ts
- plan.ts
- quota.ts
- warn.ts
- @testing-library/jest-dom
- slip.ts
- 01-csv-sidecar-ingestion.md
- userUsage.ts
- dict/nav.ts
- order.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md

## God Nodes (most connected - your core abstractions)
1. `useT()` - 243 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 58 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 37 edges
7. `unwrapDetail()` - 34 edges
8. `appKey()` - 33 edges
9. `APLineItem` - 30 edges
10. `showToast()` - 29 edges

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

## Communities (158 total, 57 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.25
Nodes (10): useAPDraft(), mountRestored(), TAX_PROFILES, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.09
Nodes (30): AmountSummary(), Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APLineItemsTable() (+22 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.08
Nodes (19): AdminKey, en, th, en, th, DICT, en, th (+11 more)

### Community 3 - "adminFetch"
Cohesion: 0.24
Nodes (21): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, AdminUserRow (+13 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.06
Nodes (34): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+26 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.11
Nodes (23): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+15 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (29): getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER, header() (+21 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.10
Nodes (26): PendingOrderBanner(), EnterpriseCard(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP (+18 more)

### Community 9 - "api.ts"
Cohesion: 0.14
Nodes (14): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExtractedAPInvoiceData (+6 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (20): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+12 more)

### Community 12 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock()

### Community 13 - "Mapping.tsx"
Cohesion: 0.12
Nodes (23): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+15 more)

### Community 15 - "apiFetch"
Cohesion: 0.12
Nodes (28): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+20 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.12
Nodes (21): CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY, consolidated() (+13 more)

### Community 17 - "showToast"
Cohesion: 0.33
Nodes (7): Args, APExtractionProps, APVendorProps, useAPVendor(), showToast(), ToastType, ModalState

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.15
Nodes (18): CreditLedgerEntry, fetchCreditBalance(), fetchAdminOrderDocuments(), getOrderSlipUrl(), listCreditOrders(), CompanyPanel(), ContactBuyer(), num() (+10 more)

### Community 19 - "ExtractionsPage.tsx"
Cohesion: 0.13
Nodes (19): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, Tab, Tabs() (+11 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "banks.ts"
Cohesion: 0.12
Nodes (23): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, BankConfigHook, persistScanForMapping(), codeToDisplayName(), codeToSource() (+15 more)

### Community 24 - "useMapping.ts"
Cohesion: 0.12
Nodes (29): AccountMappingTable(), GLAccount, saveARSettings(), suggestPaymentTypes(), BlockReason, BU_WIDE, JvEditor(), rowId() (+21 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.12
Nodes (25): PackList(), Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, priceLines(), PurchaseStep (+17 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "storage.ts"
Cohesion: 0.14
Nodes (23): bankCodeFromHash(), getAccountingConfig, seedOcrBranch(), useBankConfig(), PaymentTypesHook, usePaymentTypes(), AccountingConfigHook, MAIN_KEYS (+15 more)

### Community 28 - "CreditsPage.tsx"
Cohesion: 0.20
Nodes (17): buildQs(), QueryParams, adjustCredits(), CreditBalance, fetchCreditLedger(), fetchCreditPacks(), topupCredits(), ModuleUsageRow (+9 more)

### Community 29 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (18): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), CarmenJvPayload, defaultConfig, defaultRows (+10 more)

### Community 30 - "useOcrWizard"
Cohesion: 0.14
Nodes (20): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+12 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "FieldMapping"
Cohesion: 0.20
Nodes (22): Props, MappingRowVariant, Props, Props, SettlementModalSection, ActiveScan, MainMappings, MasterAccount (+14 more)

### Community 34 - "APInvoice.tsx"
Cohesion: 0.14
Nodes (17): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APTableRow(), AP_STEPS, APFieldKey (+9 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.11
Nodes (13): JvHeaderCard(), Props, BANK_OPTIONS, Props, TEMPLATE_TAGS, TopLevelConfigSection(), useGlMasters(), CustomSearchSelect() (+5 more)

### Community 36 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+34 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (25): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args (+17 more)

### Community 41 - "AuthContext.tsx"
Cohesion: 0.18
Nodes (14): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+6 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 43 - "date.ts"
Cohesion: 0.33
Nodes (10): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.13
Nodes (22): fetchAlerts(), fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), fetchUsageTotals(), KPICard(), KPICardProps (+14 more)

### Community 46 - "useT"
Cohesion: 0.11
Nodes (26): resolveAlert(), fetchTenantDetail(), fetchTenants(), fetchUserUsage(), label(), Tenant, TenantSelector(), TenantSelectorProps (+18 more)

### Community 47 - "main.tsx"
Cohesion: 0.18
Nodes (10): AdminRouter, container, EmailSettings, getRoute(), Mapping, OrderHistory, OrderReviewShell, Pricing (+2 more)

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): ApiError, ExtractedRow, PDF_PASSWORD_REQUIRED, PdfInfoResult, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload (+6 more)

### Community 49 - "APLineItem"
Cohesion: 0.13
Nodes (19): Props, APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow (+11 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (30): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, BillingFigure(), catalogName(), isSubscriptionCode() (+22 more)

### Community 52 - "AccountingReview.tsx"
Cohesion: 0.16
Nodes (18): DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, JvState, Props, DetailRow, EXTRACTION_STAGES (+10 more)

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.11
Nodes (37): fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fetchTenantRanking(), Column, daysAgo(), endOfDay(), granularityFor() (+29 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.10
Nodes (25): SLIP, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+17 more)

### Community 57 - "shared/api/auth.ts"
Cohesion: 0.19
Nodes (14): OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken(), getPaymentInfo(), T (+6 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 62 - "AdminRouter.tsx"
Cohesion: 0.33
Nodes (8): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, AdminProtectedRoute(), useAdminAuth()

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.36
Nodes (7): APGroupModal(), profileLabel(), useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "CheckoutFlow.tsx"
Cohesion: 0.09
Nodes (23): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload() (+15 more)

### Community 67 - "PaymentTypeModal.test.tsx"
Cohesion: 0.25
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 68 - "client.ts"
Cohesion: 0.19
Nodes (14): API_BASE, ApiClientOptions, createApiClient(), getCarmenRawToken(), resolveUrl(), countdown(), EMPTY, fmtHM() (+6 more)

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

### Community 76 - "useOcrExtraction.test.ts"
Cohesion: 0.29
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult

### Community 77 - "AdminAuthContext.tsx"
Cohesion: 0.33
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.08
Nodes (14): en, th, adminDict, en, th, en, th, en (+6 more)

### Community 81 - "EmailSettings.test.tsx"
Cohesion: 0.28
Nodes (6): EmailRule, seedDraft(), mount(), mountWith(), rules, save

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "useReviewDocument.ts"
Cohesion: 0.14
Nodes (23): approveDocument(), getPending(), rejectDocument(), Overrides, OcrExtractionHook, useReviewDocument(), approve(), reject() (+15 more)

### Community 88 - "AppHeader.tsx"
Cohesion: 0.33
Nodes (6): NAV_SECTIONS, Props, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode()

### Community 89 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 94 - "DocumentPreview.tsx"
Cohesion: 0.29
Nodes (7): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb

### Community 95 - "LanguageProvider"
Cohesion: 0.33
Nodes (5): MAP, OrderStatusBadge(), LanguageProvider(), readLang(), OrderStatus

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (11): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+3 more)

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.16
Nodes (24): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRulePayload, EmailSettings, getBankCodes() (+16 more)

### Community 111 - "UsagePage.tsx"
Cohesion: 0.14
Nodes (16): fetchUsageSummary(), LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps (+8 more)

### Community 112 - "TKey"
Cohesion: 0.15
Nodes (14): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+6 more)

### Community 113 - "EmailSettings.tsx"
Cohesion: 0.16
Nodes (11): EmailDocType, RuleDraft, BLOCKER_TEXT, copy(), EmailSettings(), Button(), ButtonProps, Variant (+3 more)

### Community 118 - "APUploadStep.tsx"
Cohesion: 0.50
Nodes (3): APUploadStep(), INSTRUCTIONS, Props

### Community 121 - "useAuth"
Cohesion: 0.15
Nodes (16): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig (+8 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.12
Nodes (22): fetchSessions(), revokeSession(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS (+14 more)

### Community 124 - "getCarmenUrl"
Cohesion: 0.14
Nodes (16): Props, VendorSearch(), RowAction(), Coords, getCoords(), Props, Tooltip(), TooltipPosition (+8 more)

### Community 141 - "flows.ts"
Cohesion: 0.27
Nodes (4): en, th, en, th

## Knowledge Gaps
- **627 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+622 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APReviewStep.tsx`, `adminFetch`, `ManualScan.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `orders.ts`, `OrderDrawer.tsx`, `Mapping.tsx`, `apiFetch`, `showToast`, `OrderWorkspace.tsx`, `ExtractionsPage.tsx`, `EmailAutomationPage.tsx`, `banks.ts`, `useMapping.ts`, `Pricing.tsx`, `CreditsPage.tsx`, `useOcrWizard`, `OrderActions.tsx`, `FieldMapping`, `APInvoice.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `APLineItem`, `OrderHistory.tsx`, `AccountingReview.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `shared/api/auth.ts`, `AdminRouter.tsx`, `AdminLogin.tsx`, `APGroupModal.tsx`, `CheckoutFlow.tsx`, `PaymentTypeModal.test.tsx`, `client.ts`, `useReviewDocument.ts`, `AppHeader.tsx`, `DocumentPreview.tsx`, `LanguageProvider`, `OrderTable.tsx`, `SlipViewer.tsx`, `UsagePage.tsx`, `TKey`, `APUploadStep.tsx`, `DataTable.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.266) - this node is a cross-community bridge._
- **Why does `ManualScan()` connect `useOcrWizard` to `storage.ts`, `ManualScan.tsx`, `useT`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useOcrWizard.ts`, `ManualScan.tsx`, `useAPExtraction.ts`, `ocr.ts`, `showToast`, `useOcrSubmission.test.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _627 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09358974358974359 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._
- **Should `ManualScan.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0611764705882353 - nodes in this community are weakly interconnected._