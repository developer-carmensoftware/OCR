# Graph Report - OCR  (2026-09-09)

## Corpus Check
- 308 files · ~246,382 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1804 nodes · 5114 edges · 102 communities (90 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8e9f1f6c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- TutorialModal.tsx
- ccJv.ts
- NotificationBell.tsx
- CreditOrdersPage.tsx
- BankDisplayName
- PeriodPicker.tsx
- FeatureFlows.tsx
- useAPInvoice.ts
- main.tsx
- AccountingReview.tsx
- screens.tsx
- date.ts
- showToast
- emailReview.ts
- DataTable.tsx
- compilerOptions
- 5. Components
- APInvoice.tsx
- ARReconcileSettings.tsx
- devDependencies
- ReviewDocument.tsx
- useOcrSubmission.test.ts
- apInvoice.ts
- emailAutomation.ts
- useOcrWizard.ts
- Pricing.tsx
- JvEditor.tsx
- adminClient.ts
- EmailAutomationPage.tsx
- DetailTable.tsx
- bankTransforms.ts
- MaintenancePage.tsx
- OrderHistory.tsx
- Home.tsx
- ExtractionsPage.tsx
- useFileUpload.ts
- useAPExtraction.ts
- dependencies
- adminFetch
- api.ts
- AdminLogin.tsx
- auth.ts
- CheckoutFlow.tsx
- formatThb
- OrderWorkspace.tsx
- apiFetch
- deptAccounts.ts
- usePdfPasswordPrompt
- routes.tsx
- useMappingData.ts
- banks.ts
- useCheckout.ts
- ErrorBoundary
- CompanyInfoSection.tsx
- AuthContext.tsx
- NumericInput.tsx
- postcss
- credits.ts
- scripts
- appKey
- DocumentPreview.tsx
- useT
- compilerOptions
- LanguageContext.tsx
- APLineItem
- Overview.tsx
- CLAUDE.md
- Contributing
- InputTaxReconciliation.tsx
- useMapping.ts
- CreditsPage.tsx
- eslint-plugin-react-hooks
- PDFPageSelector
- Product
- eslint
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
- CustomModal.tsx
- jsdom
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- LLMLogsPage.tsx
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `apiFetch` - 59 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 33 edges
7. `TKey` - 29 edges
8. `showToast()` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts
- `AuthScreen()` --calls--> `getCarmenUrl()`  [EXTRACTED]
  frontend/src/components/common/ProtectedRoute.tsx → frontend/src/lib/url.ts

## Import Cycles
- None detected.

## Communities (102 total, 12 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (10): ACTIVITY_FILTERS, carmenSettingsUrl(), COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty() (+2 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.12
Nodes (18): BANK_SOURCE_MAP, codeToSource(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows() (+10 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.05
Nodes (44): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, docLabel(), NotificationBell(), notifText(), releaseCopy() (+36 more)

### Community 4 - "CreditOrdersPage.tsx"
Cohesion: 0.11
Nodes (26): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, OrderKpiCards(), useOrderActions(), withName() (+18 more)

### Community 5 - "BankDisplayName"
Cohesion: 0.31
Nodes (5): Props, TopLevelConfigSection(), BANK_CODE_MAP, NormalizedConfig, BankDisplayName

### Community 6 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (30): daysAgo(), endOfDay(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+22 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.15
Nodes (9): AP_TIMELINE, CC_SUPPORT, CC_TIMELINE, FeatureFlows(), FEATURES, FLOW_PANELS, GL_SAMPLES, GL_TIMELINE (+1 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.17
Nodes (24): APGroupModal(), profileLabel(), AccountingReview(), Amount(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair (+16 more)

### Community 9 - "main.tsx"
Cohesion: 0.16
Nodes (10): PageSkeleton(), APInvoice, container, getRoute(), Mapping, OrderHistory, Pricing, ReviewQueue (+2 more)

### Community 10 - "AccountingReview.tsx"
Cohesion: 0.10
Nodes (18): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+10 more)

### Community 11 - "screens.tsx"
Cohesion: 0.13
Nodes (16): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+8 more)

### Community 12 - "date.ts"
Cohesion: 0.33
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 13 - "showToast"
Cohesion: 0.11
Nodes (21): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+13 more)

### Community 14 - "emailReview.ts"
Cohesion: 0.21
Nodes (13): ReviewQueueController, useReviewQueue(), ActivityFilter, ActivityPage, ApproveResult, getReviewStatus(), listActivity(), markChipSeen() (+5 more)

### Community 15 - "DataTable.tsx"
Cohesion: 0.13
Nodes (21): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+13 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "APInvoice.tsx"
Cohesion: 0.11
Nodes (17): APSuccessStep(), VendorSearch(), AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., Coords, getCoords(), Props (+9 more)

### Community 19 - "ARReconcileSettings.tsx"
Cohesion: 0.11
Nodes (26): ARJvPreview(), money(), Props, ARMappingTable(), Props, ARReconcileHook, dedupe(), firstToken() (+18 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "ReviewDocument.tsx"
Cohesion: 0.07
Nodes (38): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+30 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (20): JvState, Props, OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+12 more)

### Community 23 - "apInvoice.ts"
Cohesion: 0.10
Nodes (32): AmountSummary(), Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APLineItemsTable() (+24 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+18 more)

### Community 25 - "useOcrWizard.ts"
Cohesion: 0.20
Nodes (16): OcrDraftState, CcDraft, getPdfInfoWithRetry(), useOcrWizard(), handleFileChange(), promptForPassword(), runEncryptedExtraction(), useModal() (+8 more)

### Community 26 - "Pricing.tsx"
Cohesion: 0.12
Nodes (23): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+15 more)

### Community 27 - "JvEditor.tsx"
Cohesion: 0.15
Nodes (14): CustomSearchSelect(), Props, SelectOption, TopChoice, BlockReason, BU_WIDE, JvEditor(), Overrides (+6 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.12
Nodes (23): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), CreditBalance (+15 more)

### Community 29 - "EmailAutomationPage.tsx"
Cohesion: 0.07
Nodes (36): KPICard(), KPICardProps, Button(), ButtonProps, Variant, VARIANT_CLASS, Card(), CardProps (+28 more)

### Community 30 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 31 - "bankTransforms.ts"
Cohesion: 0.32
Nodes (9): BANK_INFO, BankInfo, useBankConfig(), codeToDisplayName(), descriptionForBank(), getBankInfo(), getGLSourceCode(), isApiShape() (+1 more)

### Community 32 - "MaintenancePage.tsx"
Cohesion: 0.31
Nodes (10): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, fmtICT(), MaintenancePage() (+2 more)

### Community 33 - "OrderHistory.tsx"
Cohesion: 0.30
Nodes (9): catalogName(), useOrderHistory(), getUsage(), getStoredToken(), getPaymentInfo(), ActivePlanBanner(), OrderHistory(), parseFocusId() (+1 more)

### Community 34 - "Home.tsx"
Cohesion: 0.11
Nodes (24): AdminProtectedRoute(), DarkModeToggle(), LanguageToggle(), useAdminAuth(), isDarkNow(), useDarkMode(), AdminRouter, Home (+16 more)

### Community 35 - "ExtractionsPage.tsx"
Cohesion: 0.22
Nodes (13): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fmtDateTime(), causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+5 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (9): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl(), sanitizedPdfUrl() (+1 more)

### Community 37 - "useAPExtraction.ts"
Cohesion: 0.08
Nodes (29): Props, Props, DEFAULT_MAPPINGS, EMPTY_HEADER, APExtractionProps, EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS (+21 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminFetch"
Cohesion: 0.20
Nodes (21): adminFetch, createAdminUser(), fetchAdminUsers(), fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), fetchExtractionFailures(), fetchQuotaOverview() (+13 more)

### Community 40 - "api.ts"
Cohesion: 0.12
Nodes (16): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest (+8 more)

### Community 41 - "AdminLogin.tsx"
Cohesion: 0.33
Nodes (7): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 42 - "auth.ts"
Cohesion: 0.07
Nodes (40): ConsentGate(), Props, countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate() (+32 more)

### Community 43 - "CheckoutFlow.tsx"
Cohesion: 0.15
Nodes (13): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+5 more)

### Community 44 - "formatThb"
Cohesion: 0.26
Nodes (13): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), formatThb(), _hundreds() (+5 more)

### Community 45 - "OrderWorkspace.tsx"
Cohesion: 0.06
Nodes (44): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Props (+36 more)

### Community 46 - "apiFetch"
Cohesion: 0.09
Nodes (31): _fetchExtract(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+23 more)

### Community 47 - "deptAccounts.ts"
Cohesion: 0.15
Nodes (17): AccountMappingTable(), GLAccount, AISuggestBar(), Props, Badge(), BadgeVariant, Props, MappingRow() (+9 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "routes.tsx"
Cohesion: 0.18
Nodes (12): Column, fetchErrorBreakdown(), fetchTenantRanking(), ErrorRow, ErrorsPage(), GroupBy, NAV_SECTIONS, getColsCost() (+4 more)

### Community 50 - "useMappingData.ts"
Cohesion: 0.32
Nodes (12): useAPSubmission(), GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+4 more)

### Community 51 - "banks.ts"
Cohesion: 0.18
Nodes (15): Props, BANK_LOGOS, Props, DetailRow, Props, Props, BANK_KEYWORDS, BANK_THAI_NAMES (+7 more)

### Community 52 - "useCheckout.ts"
Cohesion: 0.26
Nodes (13): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+5 more)

### Community 53 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 54 - "CompanyInfoSection.tsx"
Cohesion: 0.38
Nodes (6): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BankConfigHook, CompanyData

### Community 55 - "AuthContext.tsx"
Cohesion: 0.16
Nodes (16): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), clearToken() (+8 more)

### Community 56 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 58 - "credits.ts"
Cohesion: 0.15
Nodes (19): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, OPEN_STATUSES, OrderHistoryState (+11 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "appKey"
Cohesion: 0.12
Nodes (21): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), DetailRow, EXTRACTION_STAGES (+13 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 64 - "useT"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), FormActions(), Props, UsageIndicator(), BankDetectionBanner(), ExtractionWarningBanner(), DATE_KEYS, HeaderCard() (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (24): BatchAction, BatchActionBar(), Props, APUploadStep(), INSTRUCTIONS, Props, MAP, OrderStatusBadge() (+16 more)

### Community 67 - "APLineItem"
Cohesion: 0.18
Nodes (14): Props, COLS, Props, REQUIRED_FIELDS, Props, Props, Props, APFieldKey (+6 more)

### Community 69 - "Overview.tsx"
Cohesion: 0.12
Nodes (22): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+14 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "InputTaxReconciliation.tsx"
Cohesion: 0.24
Nodes (10): InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), OCR_BANK_MAP, fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax() (+2 more)

### Community 75 - "useMapping.ts"
Cohesion: 0.25
Nodes (19): Props, Props, Props, ActiveScan, COMPANY_REQUIRED_FIELDS, MainMappings, useMapping(), MasterAccount (+11 more)

### Community 76 - "CreditsPage.tsx"
Cohesion: 0.16
Nodes (14): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, adjustCredits(), CreditLedgerEntry (+6 more)

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

### Community 96 - "CustomModal.tsx"
Cohesion: 0.22
Nodes (7): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, NotificationDetailModal(), REASON_KEY

### Community 103 - "LLMLogsPage.tsx"
Cohesion: 0.20
Nodes (13): useTableData(), fetchLLMLogs(), fetchTenantDetail(), fetchTenants(), TenantDetail, getCols(), LLMLogsPage(), LogRow (+5 more)

## Knowledge Gaps
- **502 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+497 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `TutorialModal.tsx`, `NotificationBell.tsx`, `CreditOrdersPage.tsx`, `PeriodPicker.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `main.tsx`, `AccountingReview.tsx`, `screens.tsx`, `showToast`, `DataTable.tsx`, `APInvoice.tsx`, `ReviewDocument.tsx`, `apInvoice.ts`, `Pricing.tsx`, `JvEditor.tsx`, `EmailAutomationPage.tsx`, `DetailTable.tsx`, `MaintenancePage.tsx`, `OrderHistory.tsx`, `Home.tsx`, `ExtractionsPage.tsx`, `useAPExtraction.ts`, `adminFetch`, `AdminLogin.tsx`, `auth.ts`, `CheckoutFlow.tsx`, `formatThb`, `OrderWorkspace.tsx`, `apiFetch`, `deptAccounts.ts`, `routes.tsx`, `banks.ts`, `credits.ts`, `DocumentPreview.tsx`, `LanguageContext.tsx`, `APLineItem`, `Overview.tsx`, `InputTaxReconciliation.tsx`, `CreditsPage.tsx`, `CustomModal.tsx`, `LLMLogsPage.tsx`?**
  _High betweenness centrality (0.236) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `OrderHistory.tsx`, `Pricing.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `InputTaxReconciliation.tsx`, `api.ts`, `auth.ts`, `useMapping.ts`, `emailReview.ts`, `useMappingData.ts`, `ARReconcileSettings.tsx`, `useCheckout.ts`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `credits.ts`, `JvEditor.tsx`, `appKey`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `ReviewQueue.tsx`, `useFileUpload.ts`, `useAPExtraction.ts`, `useAPInvoice.ts`, `apiFetch`, `useMappingData.ts`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `AuthContext.tsx`, `emailAutomation.ts`, `useOcrWizard.ts`, `appKey`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _502 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12318840579710146 - nodes in this community are weakly interconnected._