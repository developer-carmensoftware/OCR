# Graph Report - OCR  (2026-09-14)

## Corpus Check
- 301 files · ~242,030 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1766 nodes · 4993 edges · 114 communities (102 shown, 12 thin omitted)
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
- useNotifications.ts
- Pricing.tsx
- bankTransforms.ts
- date.ts
- FeatureFlows.tsx
- useAPInvoice.ts
- AppHeader.tsx
- APInvoice.tsx
- screens.tsx
- PeriodPicker.tsx
- useOcrExtraction.test.ts
- emailReview.ts
- DataTable.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ReviewDocument.tsx
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- APReviewStep.tsx
- emailAutomation.ts
- useOcrWizard.ts
- formatThb
- useMappingData.ts
- EmailAutomationPage.tsx
- QuotaModulesPage.tsx
- reviewReasons.ts
- getCarmenUrl
- APLineItem
- ManualScan.tsx
- NotificationBell.test.tsx
- NotificationBell.tsx
- useAPExtraction.ts
- useAPSubmission.ts
- dependencies
- adminClient.ts
- api.ts
- main.tsx
- useNotifications.test.ts
- PaymentTypeModal.tsx
- PendingOrderBanner.tsx
- OrderWorkspace.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- ocr.ts
- CreditOrdersPage.tsx
- eslint-plugin-react-hooks
- OrderTable.tsx
- CheckoutFlow.tsx
- client.ts
- CreditsPage.tsx
- useAuth
- APAmountSummary.tsx
- AdminUsersPage.tsx
- apiFetch
- scripts
- storage.ts
- useT
- @testing-library/dom
- banks.ts
- DetailTable.tsx
- compilerOptions
- dict.ts
- useMapping.ts
- normalizeYearToCE
- Overview.tsx
- CLAUDE.md
- Contributing
- useOcrWizard
- ProtectedRoute.tsx
- auth.ts
- ExtractionsPage.tsx
- APAccountMappingStep.tsx
- MaintenanceGate.tsx
- ArCustomerProfiles.tsx
- PDFPageSelector
- TenantsPage.tsx
- Product
- eslint
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- AdminAuthContext.tsx
- vercel.json
- Architecture
- EmailSettings.tsx
- vite.config.ts
- releaseNotes.ts
- LanguageProvider
- jsdom
- usePdfPasswordPrompt
- notifications.ts
- @testing-library/jest-dom
- getPdfInfo
- postcss
- @testing-library/react
- vitest
- vite-env.d.ts
- typescript
- @typescript-eslint/eslint-plugin

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `apiFetch` - 54 edges
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
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/constants/apInvoice.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts

## Import Cycles
- None detected.

## Communities (114 total, 12 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.18
Nodes (9): ACTIVITY_FILTERS, ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty() (+1 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.13
Nodes (18): OCR_BANK_MAP, codeToSource(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows() (+10 more)

### Community 3 - "useNotifications.ts"
Cohesion: 0.29
Nodes (10): releaseRow(), useNotifications(), listNotifications(), markNotificationsRead(), markReleaseSeen(), readReleaseSeen(), RELEASE_SEEN_EVENT, WHATS_NEW_RETURN_KEY (+2 more)

### Community 4 - "Pricing.tsx"
Cohesion: 0.14
Nodes (17): AppHeader(), MAP, OrderStatusBadge(), PendingOrderBanner(), SALES_CONTACT, useOrderHistory(), getStoredToken(), getPaymentInfo() (+9 more)

### Community 5 - "bankTransforms.ts"
Cohesion: 0.13
Nodes (19): PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_SOURCE_MAP, BankInfo (+11 more)

### Community 6 - "date.ts"
Cohesion: 0.22
Nodes (24): Column, daysAgo(), endOfDay(), today(), ymd(), useTableData(), useTableQuery, fmtDateTime() (+16 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.16
Nodes (26): AmountSummary(), InputTaxPanel(), Amount(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows() (+18 more)

### Community 9 - "AppHeader.tsx"
Cohesion: 0.09
Nodes (25): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), useAdminAuth(), isDarkNow(), useDarkMode() (+17 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APUploadStep(), INSTRUCTIONS, Props (+10 more)

### Community 11 - "screens.tsx"
Cohesion: 0.13
Nodes (16): EnterpriseCard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP (+8 more)

### Community 12 - "PeriodPicker.tsx"
Cohesion: 0.13
Nodes (25): DateRangePicker(), DateRangePickerProps, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+17 more)

### Community 13 - "useOcrExtraction.test.ts"
Cohesion: 0.33
Nodes (5): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData()

### Community 14 - "emailReview.ts"
Cohesion: 0.29
Nodes (12): Props, ReviewQueueController, useReviewQueue(), ActivityFilter, ApproveResult, getReviewStatus(), listActivity(), markChipSeen() (+4 more)

### Community 15 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 19 - "ReviewDocument.tsx"
Cohesion: 0.12
Nodes (25): Props, DetailRow, Props, Props, BlockReason, BU_WIDE, JvEditor(), JvState (+17 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.31
Nodes (11): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+3 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (18): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+10 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (22): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+14 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.20
Nodes (20): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+12 more)

### Community 25 - "useOcrWizard.ts"
Cohesion: 0.32
Nodes (10): OcrDraftState, CcDraft, clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 26 - "formatThb"
Cohesion: 0.14
Nodes (19): PackList(), Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, BillingFigure(), ENTERPRISE (+11 more)

### Community 27 - "useMappingData.ts"
Cohesion: 0.30
Nodes (12): JvHeaderCard(), Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData() (+4 more)

### Community 28 - "EmailAutomationPage.tsx"
Cohesion: 0.15
Nodes (19): PageHeader(), PageHeaderProps, EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.12
Nodes (19): Card(), CardProps, EmptyState(), EmptyStateProps, Switch(), SwitchProps, Tab, Tabs() (+11 more)

### Community 30 - "reviewReasons.ts"
Cohesion: 0.23
Nodes (10): ExtractionWarningBanner(), Props, OcrExtractionHook, ExtractResult, ExtractionWarning, FIX, REASON_KEY, SETTINGS (+2 more)

### Community 31 - "getCarmenUrl"
Cohesion: 0.20
Nodes (12): APSuccessStep(), VendorSearch(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), RowAction() (+4 more)

### Community 32 - "APLineItem"
Cohesion: 0.20
Nodes (15): Props, Props, APGroupModal(), profileLabel(), Props, Props, APInvoiceHeader, APDraftState (+7 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (20): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, ExtractionSkeleton(), Props, Skeleton() (+12 more)

### Community 34 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 35 - "NotificationBell.tsx"
Cohesion: 0.24
Nodes (11): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), Props (+3 more)

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (24): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload() (+16 more)

### Community 37 - "useAPSubmission.ts"
Cohesion: 0.10
Nodes (28): APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+20 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.09
Nodes (45): adjustCredits(), adminFetch, buildQs(), CreditBalance, EmailCronJob, EmailJobRun, endMaintenanceNow(), fetchCreditLedger() (+37 more)

### Community 40 - "api.ts"
Cohesion: 0.10
Nodes (21): APVendorMapping, APVendorMappingResponse, ConfigPatch, suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest (+13 more)

### Community 41 - "main.tsx"
Cohesion: 0.11
Nodes (12): ErrorBoundary, Props, State, PageSkeleton(), container, getRoute(), Home, ManualScan (+4 more)

### Community 42 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 43 - "PaymentTypeModal.tsx"
Cohesion: 0.15
Nodes (16): AccountMappingTable(), GLAccount, AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption, TopChoice (+8 more)

### Community 44 - "PendingOrderBanner.tsx"
Cohesion: 0.15
Nodes (23): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, expiryDate(), num(), ProformaDocument() (+15 more)

### Community 45 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (19): Props, Props, many(), order(), CompanyPanel(), ContactBuyer(), num(), OrderWorkspace() (+11 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.29
Nodes (15): Props, Props, AccountingConfigHook, ActiveScan, MainMappings, MasterAccount, MasterDepartment, MainMappingKey (+7 more)

### Community 48 - "ocr.ts"
Cohesion: 0.17
Nodes (11): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), ApiError, ExtractedRow, extractFromFile() (+3 more)

### Community 49 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (16): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+8 more)

### Community 51 - "OrderTable.tsx"
Cohesion: 0.16
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 52 - "CheckoutFlow.tsx"
Cohesion: 0.15
Nodes (14): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS (+6 more)

### Community 53 - "client.ts"
Cohesion: 0.21
Nodes (13): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, clearToken() (+5 more)

### Community 54 - "CreditsPage.tsx"
Cohesion: 0.21
Nodes (9): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, CreditsPage(), getCols() (+1 more)

### Community 55 - "useAuth"
Cohesion: 0.18
Nodes (14): ConsentGate(), Props, AuthUser, A, B, Probe(), useAuth(), cacheConsent() (+6 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.13
Nodes (15): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Props, Badge() (+7 more)

### Community 57 - "AdminUsersPage.tsx"
Cohesion: 0.23
Nodes (14): Button(), ButtonProps, Variant, VARIANT_CLASS, AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles() (+6 more)

### Community 58 - "apiFetch"
Cohesion: 0.15
Nodes (24): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+16 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "storage.ts"
Cohesion: 0.15
Nodes (16): MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, DetailRow, EXTRACTION_STAGES, HeaderData, persistScanForMapping() (+8 more)

### Community 61 - "useT"
Cohesion: 0.08
Nodes (30): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, slipIsPdf() (+22 more)

### Community 63 - "banks.ts"
Cohesion: 0.18
Nodes (12): BANK_LOGOS, BankDetectionBanner(), Props, BANK_INFO, BANK_KEYWORDS, BANK_THAI_NAMES, BankEntry, BANKS (+4 more)

### Community 64 - "DetailTable.tsx"
Cohesion: 0.17
Nodes (13): NumericInput(), NumericInputProps, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS (+5 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "dict.ts"
Cohesion: 0.10
Nodes (22): BatchAction, BatchActionBar(), Props, INSTRUCTIONS, Props, UploadSection(), DICT, en (+14 more)

### Community 67 - "useMapping.ts"
Cohesion: 0.25
Nodes (10): CompanyInfoSection(), OcrExtractionProps, COMPANY_REQUIRED_FIELDS, useMapping(), useMappingSuggestions(), usePaymentTypes(), ModalConfig, saveAccountingConfig() (+2 more)

### Community 68 - "normalizeYearToCE"
Cohesion: 0.21
Nodes (10): DateInput(), DateInputProps, DATE_KEYS, HeaderCard(), Props, handleAddInputTax(), formatDateToDDMMYYYY(), normalizeDateStringToCE() (+2 more)

### Community 69 - "Overview.tsx"
Cohesion: 0.14
Nodes (16): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+8 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard"
Cohesion: 0.17
Nodes (15): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrWizard(), handleCancel(), reExtract() (+7 more)

### Community 73 - "ProtectedRoute.tsx"
Cohesion: 0.19
Nodes (12): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+4 more)

### Community 74 - "auth.ts"
Cohesion: 0.28
Nodes (8): T, base, Usage, UsageIndicator(), getUsage(), UsageData, computeUsageStats(), UsageStats

### Community 75 - "ExtractionsPage.tsx"
Cohesion: 0.29
Nodes (10): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+2 more)

### Community 76 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 77 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+2 more)

### Community 78 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.29
Nodes (7): KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

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

### Community 89 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 94 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, EmailSettings, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE

### Community 96 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 97 - "LanguageProvider"
Cohesion: 0.29
Nodes (3): LanguageProvider(), readLang(), ZERO

### Community 99 - "usePdfPasswordPrompt"
Cohesion: 0.60
Nodes (5): usePdfPasswordPrompt(), open(), prompt(), render(), submit()

### Community 100 - "notifications.ts"
Cohesion: 0.47
Nodes (4): ActivityPage, Notification, NotificationList, Page

### Community 102 - "getPdfInfo"
Cohesion: 0.50
Nodes (5): getPdfInfoWithRetry(), handleFileChange(), promptForPassword(), runEncryptedExtraction(), getPdfInfo()

## Knowledge Gaps
- **498 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+493 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `TutorialModal.tsx`, `useNotifications.ts`, `Pricing.tsx`, `date.ts`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `AppHeader.tsx`, `APInvoice.tsx`, `screens.tsx`, `PeriodPicker.tsx`, `DataTable.tsx`, `ReviewDocument.tsx`, `QueueRow.tsx`, `APReviewStep.tsx`, `formatThb`, `useMappingData.ts`, `EmailAutomationPage.tsx`, `QuotaModulesPage.tsx`, `reviewReasons.ts`, `getCarmenUrl`, `APLineItem`, `ManualScan.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `useAPSubmission.ts`, `adminClient.ts`, `PaymentTypeModal.tsx`, `PendingOrderBanner.tsx`, `OrderWorkspace.tsx`, `CreditOrdersPage.tsx`, `OrderTable.tsx`, `CheckoutFlow.tsx`, `CreditsPage.tsx`, `APAmountSummary.tsx`, `AdminUsersPage.tsx`, `apiFetch`, `banks.ts`, `DetailTable.tsx`, `dict.ts`, `useMapping.ts`, `normalizeYearToCE`, `Overview.tsx`, `useOcrWizard`, `auth.ts`, `ExtractionsPage.tsx`, `APAccountMappingStep.tsx`, `MaintenanceGate.tsx`, `ArCustomerProfiles.tsx`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `ManualScan.tsx`, `usePdfPasswordPrompt`, `useAPExtraction.ts`, `getPdfInfo`, `useAPInvoice.ts`, `useOcrSubmission.test.ts`, `useOcrWizard.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useNotifications.ts`, `Pricing.tsx`, `bankTransforms.ts`, `useAPInvoice.ts`, `emailReview.ts`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `formatThb`, `useMappingData.ts`, `useAPExtraction.ts`, `useAPSubmission.ts`, `api.ts`, `PendingOrderBanner.tsx`, `useAPExtraction.test.ts`, `ocr.ts`, `client.ts`, `useAuth`, `useMapping.ts`, `notifications.ts`, `getPdfInfo`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _498 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._
- **Should `Pricing.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._