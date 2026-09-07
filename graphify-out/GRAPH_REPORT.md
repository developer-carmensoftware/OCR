# Graph Report - OCR  (2026-09-07)

## Corpus Check
- 297 files · ~235,910 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1751 nodes · 4929 edges · 110 communities (95 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b9a48ff9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- emailReview.ts
- dict.ts
- ccJv.ts
- NotificationBell.tsx
- OrderActions.tsx
- storage.ts
- DataTable.tsx
- LanguageContext.tsx
- useAPInvoice.ts
- DetailTable.tsx
- useAPExtraction.ts
- formatThb
- OrderHistory.tsx
- useOcrExtraction
- banks.ts
- fmt
- compilerOptions
- 5. Components
- AdminLogin.tsx
- TenantSelector.test.tsx
- devDependencies
- QueueRow.tsx
- getCarmenUrl
- APReviewStep.tsx
- emailAutomation.ts
- screens.tsx
- CheckoutFlow.tsx
- CreditOrdersPage.tsx
- adminClient.ts
- EmailAutomationPage.tsx
- ReviewQueue.tsx
- useT
- TenantsPage.tsx
- Pricing.tsx
- ExtractionsPage.tsx
- client.ts
- useAPExtraction
- useAPSubmission.ts
- dependencies
- main.tsx
- api.ts
- ProtectedRoute.tsx
- AccountingReview.tsx
- OrderWorkspace.tsx
- useOcrWizard.ts
- AuthContext.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- ocr.ts
- routes.tsx
- ReviewDocument.test.tsx
- useMappingData.ts
- apiFetch
- OrderTable.tsx
- ProformaDocument.tsx
- Pager.tsx
- Skeleton.tsx
- useOcrSubmission.test.ts
- PeriodPicker.tsx
- scripts
- JvEditor.tsx
- DocumentPreview.tsx
- OrderDrawer.tsx
- APLineItem
- ReviewDocument.tsx
- compilerOptions
- TKey
- APInvoice.tsx
- eslint
- MetricChartImpl.tsx
- CLAUDE.md
- Contributing
- APAccountMappingStep.tsx
- MaintenanceGate.tsx
- useUserConsent.ts
- useMapping.ts
- AdminAuthContext.tsx
- UserConsentModal.tsx
- InputTaxReconciliation.tsx
- PDFPageSelector
- ReviewQueue.test.tsx
- Product
- OrderTable.test.tsx
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- typescript
- vercel.json
- Architecture
- vite.config.ts
- eslint-plugin-react-hooks
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- AccountMappingTable.tsx

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `apiFetch` - 55 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 31 edges
7. `showToast()` - 31 edges
8. `TKey` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `Vendor`  [EXTRACTED]
  frontend/src/components/ap-invoice/APVendorSearch.tsx → frontend/src/hooks/ap-invoice/useAPVendor.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/AccountMappingTable.tsx → frontend/src/types/ap.ts

## Import Cycles
- None detected.

## Communities (110 total, 15 thin omitted)

### Community 0 - "emailReview.ts"
Cohesion: 0.21
Nodes (15): Props, ReviewQueueController, useReviewQueue(), ActivityFilter, ActivityPage, ApproveResult, getReviewStatus(), listActivity() (+7 more)

### Community 1 - "dict.ts"
Cohesion: 0.05
Nodes (48): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+40 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.13
Nodes (17): BANK_SOURCE_MAP, CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+9 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.08
Nodes (37): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+29 more)

### Community 4 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 5 - "storage.ts"
Cohesion: 0.12
Nodes (28): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+20 more)

### Community 6 - "DataTable.tsx"
Cohesion: 0.17
Nodes (14): Column, DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), SKELETON_WIDTHS, adjustCredits(), CreditLedgerEntry (+6 more)

### Community 7 - "LanguageContext.tsx"
Cohesion: 0.16
Nodes (19): MetricChart(), granularityFor(), label(), Tenant, TenantSelector(), TenantSelectorProps, Ctx, FALLBACK_CTX (+11 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.16
Nodes (22): TaxPctCell(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+14 more)

### Community 9 - "DetailTable.tsx"
Cohesion: 0.13
Nodes (17): NumericInput(), NumericInputProps, BANK_LOGOS, Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props (+9 more)

### Community 10 - "useAPExtraction.ts"
Cohesion: 0.15
Nodes (17): COLS, Props, REQUIRED_FIELDS, APFieldKey, APStep, DEFAULT_MAPPINGS, EMPTY_HEADER, FieldOption (+9 more)

### Community 11 - "formatThb"
Cohesion: 0.17
Nodes (17): PackList(), Props, EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS, ENTERPRISE (+9 more)

### Community 12 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (16): MAP, OrderStatusBadge(), OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState (+8 more)

### Community 13 - "useOcrExtraction"
Cohesion: 0.16
Nodes (15): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), handleSubmitFinal(), handleCancel(), reExtract() (+7 more)

### Community 14 - "banks.ts"
Cohesion: 0.12
Nodes (21): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_KEYWORDS (+13 more)

### Community 15 - "fmt"
Cohesion: 0.25
Nodes (8): AmountSummary(), Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, Amount(), fmt()

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "AdminLogin.tsx"
Cohesion: 0.17
Nodes (16): AdminProtectedRoute(), useAdminAuth(), adminLogin(), AdminLoginError, AdminLayout(), getActiveHash(), AdminLogin(), classify() (+8 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.26
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+5 more)

### Community 22 - "getCarmenUrl"
Cohesion: 0.16
Nodes (13): Props, VendorSearch(), Badge(), BadgeVariant, Props, AuthScreen(), Coords, getCoords() (+5 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (20): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+12 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.15
Nodes (25): EmailSettingsController, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call(), deleteToken() (+17 more)

### Community 25 - "screens.tsx"
Cohesion: 0.13
Nodes (16): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+8 more)

### Community 26 - "CheckoutFlow.tsx"
Cohesion: 0.24
Nodes (10): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload() (+2 more)

### Community 27 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (16): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+8 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.08
Nodes (53): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, Button(), ButtonProps, Variant (+45 more)

### Community 29 - "EmailAutomationPage.tsx"
Cohesion: 0.08
Nodes (32): Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+24 more)

### Community 30 - "ReviewQueue.tsx"
Cohesion: 0.16
Nodes (11): QueueSettings(), ACTIVITY_FILTERS, setAutoPost(), ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL (+3 more)

### Community 31 - "useT"
Cohesion: 0.16
Nodes (13): FormActions(), Props, BankDetectionBanner(), ExtractionWarningBanner(), Props, DATE_KEYS, HeaderCard(), Props (+5 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier() (+2 more)

### Community 33 - "Pricing.tsx"
Cohesion: 0.22
Nodes (15): CheckoutPhase, clearPersistedCheckout(), loadPersistedCheckout(), readPersisted(), useOrderHistory(), usePricingCatalog(), getUsage(), getStoredToken() (+7 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime(), causeLabel(), classify(), ERROR_RULES (+6 more)

### Community 35 - "client.ts"
Cohesion: 0.17
Nodes (14): base, Usage, CarmenSSOState, useCarmenSSO(), exchangeSSOToken(), UsageData, API_BASE, ApiClientOptions (+6 more)

### Community 36 - "useAPExtraction"
Cohesion: 0.13
Nodes (14): _fetchExtract(), isNumFld(), useAPExtraction(), FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getAPVendorMapping() (+6 more)

### Community 37 - "useAPSubmission.ts"
Cohesion: 0.10
Nodes (27): Props, Props, APInvoiceHeader, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload (+19 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "main.tsx"
Cohesion: 0.12
Nodes (11): ErrorBoundary, Props, State, PageSkeleton(), AdminRouter, container, getRoute(), ManualScan (+3 more)

### Community 40 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest (+7 more)

### Community 41 - "ProtectedRoute.tsx"
Cohesion: 0.25
Nodes (8): AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig, EXPIRED_FLAG_KEY

### Community 42 - "AccountingReview.tsx"
Cohesion: 0.15
Nodes (11): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, SkeletonRow(), SwapLabel(), AccountingReview() (+3 more)

### Community 43 - "OrderWorkspace.tsx"
Cohesion: 0.15
Nodes (17): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial, wsReducer() (+9 more)

### Community 44 - "useOcrWizard.ts"
Cohesion: 0.21
Nodes (16): OcrDraftState, useOcrSubmission(), CcDraft, getPdfInfoWithRetry(), useOcrWizard(), handleFileChange(), promptForPassword(), runEncryptedExtraction() (+8 more)

### Community 45 - "AuthContext.tsx"
Cohesion: 0.27
Nodes (11): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), clearAllDrafts(), getJwtExpMs() (+3 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.23
Nodes (16): CustomSearchSelect(), Props, SelectOption, TopChoice, Props, Props, ActiveScan, MainMappings (+8 more)

### Community 48 - "ocr.ts"
Cohesion: 0.09
Nodes (24): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), COPY, Options, PdfPasswordAttempt (+16 more)

### Community 49 - "routes.tsx"
Cohesion: 0.11
Nodes (40): ServerTable, SortDir, daysAgo(), endOfDay(), today(), useTableData(), BASE_DEFAULTS, Extra (+32 more)

### Community 50 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 51 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 52 - "apiFetch"
Cohesion: 0.16
Nodes (21): EMPTY_BUYER, persist(), useCheckout, OPEN_STATUSES, OrderHistoryState, apiFetch, BuyerInfo, cancelOrder() (+13 more)

### Community 53 - "OrderTable.tsx"
Cohesion: 0.18
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 54 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 55 - "Pager.tsx"
Cohesion: 0.17
Nodes (8): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Pager(), Props, SIZE_OPTIONS, ROWS_PER_PAGE

### Community 56 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.11
Nodes (23): JvState, OcrExtractionProps, OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+15 more)

### Community 58 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (21): lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS, PresetId (+13 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "JvEditor.tsx"
Cohesion: 0.15
Nodes (17): Props, DetailRow, Props, Props, BlockReason, JvEditor(), Overrides, Props (+9 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock(), AdminCreditOrder

### Community 63 - "APLineItem"
Cohesion: 0.24
Nodes (11): APGroupModal(), profileLabel(), Props, Props, APDraftState, ApDraft, apGroupKey(), buildGroupedRow() (+3 more)

### Community 64 - "ReviewDocument.tsx"
Cohesion: 0.19
Nodes (11): patchAccountingConfig(), approveDocument(), getPending(), rejectDocument(), FIX, REASON_KEY, SETTINGS, WITH_DETAIL (+3 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "TKey"
Cohesion: 0.11
Nodes (20): BatchAction, BatchActionBar(), Props, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), TKey (+12 more)

### Community 67 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (18): APFieldMappingStep(), APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here. (+10 more)

### Community 69 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 73 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "useMapping.ts"
Cohesion: 0.38
Nodes (7): COMPANY_REQUIRED_FIELDS, useMapping(), useMappingSuggestions(), PaymentTypesHook, usePaymentTypes(), saveAccountingConfig(), mergeSuggestion()

### Community 76 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 77 - "UserConsentModal.tsx"
Cohesion: 0.28
Nodes (7): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal()

### Community 78 - "InputTaxReconciliation.tsx"
Cohesion: 0.19
Nodes (16): DateInput(), DateInputProps, InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), BANK_INFO, OCR_BANK_MAP, fetchTaxProfiles() (+8 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 81 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 83 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 84 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 85 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 86 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 87 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 88 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 114 - "AccountMappingTable.tsx"
Cohesion: 0.18
Nodes (13): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, MainMappingTable(), PaymentTypeModal(), AccountLike (+5 more)

## Knowledge Gaps
- **492 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+487 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `dict.ts`, `NotificationBell.tsx`, `OrderActions.tsx`, `DataTable.tsx`, `LanguageContext.tsx`, `useAPInvoice.ts`, `DetailTable.tsx`, `useAPExtraction.ts`, `formatThb`, `OrderHistory.tsx`, `useOcrExtraction`, `fmt`, `AdminLogin.tsx`, `QueueRow.tsx`, `getCarmenUrl`, `APReviewStep.tsx`, `screens.tsx`, `CheckoutFlow.tsx`, `CreditOrdersPage.tsx`, `adminClient.ts`, `EmailAutomationPage.tsx`, `ReviewQueue.tsx`, `TenantsPage.tsx`, `Pricing.tsx`, `ExtractionsPage.tsx`, `useAPExtraction`, `useAPSubmission.ts`, `AccountingReview.tsx`, `OrderWorkspace.tsx`, `MainMappingTable.tsx`, `ocr.ts`, `routes.tsx`, `apiFetch`, `OrderTable.tsx`, `ProformaDocument.tsx`, `Pager.tsx`, `PeriodPicker.tsx`, `JvEditor.tsx`, `DocumentPreview.tsx`, `OrderDrawer.tsx`, `APLineItem`, `ReviewDocument.tsx`, `TKey`, `APInvoice.tsx`, `MetricChartImpl.tsx`, `APAccountMappingStep.tsx`, `MaintenanceGate.tsx`, `UserConsentModal.tsx`, `InputTaxReconciliation.tsx`, `AccountMappingTable.tsx`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `emailReview.ts`, `NotificationBell.tsx`, `storage.ts`, `useAPInvoice.ts`, `useAPExtraction.ts`, `OrderHistory.tsx`, `ReviewQueue.tsx`, `Pricing.tsx`, `client.ts`, `useAPExtraction`, `useAPSubmission.ts`, `api.ts`, `useOcrWizard.ts`, `useAPExtraction.test.ts`, `ocr.ts`, `useMappingData.ts`, `useOcrSubmission.test.ts`, `JvEditor.tsx`, `ReviewDocument.tsx`, `useUserConsent.ts`, `useMapping.ts`, `InputTaxReconciliation.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard.ts` to `useAPExtraction`, `useAPInvoice.ts`, `useOcrExtraction`, `ocr.ts`, `useT`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _492 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.051560379918588875 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1341991341991342 - nodes in this community are weakly interconnected._
- **Should `NotificationBell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07591836734693877 - nodes in this community are weakly interconnected._