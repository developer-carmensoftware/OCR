# Graph Report - OCR  (2026-09-16)

## Corpus Check
- 316 files · ~263,021 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1857 nodes · 5291 edges · 109 communities (96 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c17c60bc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- OrderActions.tsx
- TutorialModal.tsx
- AccountingReview.tsx
- ReviewQueue.tsx
- useOcrExtraction.test.ts
- Mapping.tsx
- PeriodPicker.tsx
- useT
- useAPInvoice.ts
- main.tsx
- APInvoice.tsx
- screens.tsx
- CreditOrdersPage.tsx
- QuotaModulesPage.tsx
- emailReview.ts
- adminClient.ts
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ReviewDocument.tsx
- devDependencies
- QueueRow.tsx
- config.ts
- apInvoice.ts
- useEmailSettings.ts
- ExtractionsPage.tsx
- ArCustomerProfiles.tsx
- useARReconcile.ts
- usage.ts
- ErrorsPage.tsx
- client.ts
- PlanCard.tsx
- AdminLogin.tsx
- CustomModal.tsx
- NotificationBell.tsx
- MaintenancePage.tsx
- useAPExtraction.ts
- useAPSubmission.ts
- dependencies
- adminFetch
- api.ts
- formatThb
- MaintenanceGate.tsx
- ARReconcileSettings.tsx
- PendingOrderBanner.tsx
- DataTable.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- useOcrExtraction.ts
- DocumentPreview.tsx
- PerformancePage.tsx
- routes.tsx
- Pricing.tsx
- jsdom
- CreditsPage.tsx
- AuthContext.tsx
- ErrorBoundary
- useMapping.ts
- credits.ts
- scripts
- storage.ts
- MetricChartImpl.tsx
- LLMLogsPage.tsx
- APAccountMappingStep.tsx
- DetailTable.tsx
- compilerOptions
- LanguageContext.tsx
- useMappingData.ts
- InputTaxReconciliation.tsx
- OrderWorkspace.tsx
- CLAUDE.md
- Contributing
- useOcrWizard.ts
- eslint-plugin-react-hooks
- useUserConsent.ts
- PaymentTypeModal.test.tsx
- Tooltip.tsx
- ManualScan.tsx
- ProtectedRoute.tsx
- PDFPageSelector
- TenantsPage.tsx
- Product
- @types/react-dom
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- getCarmenUrl
- vercel.json
- Architecture
- vite
- vite.config.ts
- @vitejs/plugin-react
- @testing-library/jest-dom
- @testing-library/react
- vitest
- vite-env.d.ts
- Carmen AI — OCR & Import System
- eslint
- @types/react

## God Nodes (most connected - your core abstractions)
1. `useT()` - 235 edges
2. `apiFetch` - 59 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 41 edges
6. `appKey()` - 33 edges
7. `TKey` - 30 edges
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
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/AccountMappingTable.tsx → frontend/src/types/ap.ts

## Import Cycles
- None detected.

## Communities (109 total, 13 thin omitted)

### Community 0 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify() (+19 more)

### Community 2 - "AccountingReview.tsx"
Cohesion: 0.07
Nodes (42): Props, SkeletonRow(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, BlockReason, BU_WIDE, JvEditor() (+34 more)

### Community 3 - "ReviewQueue.tsx"
Cohesion: 0.15
Nodes (8): ACTIVITY_FILTERS, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, QueueEmpty(), ReviewQueue(), ZERO

### Community 4 - "useOcrExtraction.test.ts"
Cohesion: 0.33
Nodes (5): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData()

### Community 5 - "Mapping.tsx"
Cohesion: 0.22
Nodes (5): CompanyInfoSection(), Props, TopLevelConfigSection(), BANK_CODE_MAP, Mapping()

### Community 6 - "PeriodPicker.tsx"
Cohesion: 0.17
Nodes (23): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, PeriodPicker(), PRESET_DAYS, PresetId (+15 more)

### Community 7 - "useT"
Cohesion: 0.10
Nodes (20): slipIsPdf(), SlipViewer(), GLAccount, Props, AISuggestBar(), Props, AP_TIMELINE, ApInvoiceDetail() (+12 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.12
Nodes (35): AmountSummary(), APGroupModal(), profileLabel(), Props, ARReviewPane(), labelOf(), AccountingReview(), InputTaxPanel() (+27 more)

### Community 9 - "main.tsx"
Cohesion: 0.09
Nodes (26): AdminProtectedRoute(), DarkModeToggle(), LanguageToggle(), PageSkeleton(), useAdminAuth(), isDarkNow(), useDarkMode(), ARReconcileSettings (+18 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (21): APFieldMappingStep(), APReviewStep(), HEADER_FIELDS(), APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, ExtractionSkeleton() (+13 more)

### Community 11 - "screens.tsx"
Cohesion: 0.14
Nodes (15): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+7 more)

### Community 12 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (17): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+9 more)

### Community 13 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (17): KPICard(), KPICardProps, Switch(), SwitchProps, Tab, Tabs(), TabsProps, fetchQuotaOverview() (+9 more)

### Community 14 - "emailReview.ts"
Cohesion: 0.27
Nodes (13): Props, ReviewQueueController, useReviewQueue(), ARPreview, ActivityFilter, ApproveResult, getReviewStatus(), listActivity() (+5 more)

### Community 15 - "adminClient.ts"
Cohesion: 0.11
Nodes (25): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, AdminUserRow, clearAdminToken() (+17 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (12): AR_CONTROL, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, detail(), EXTRACTED (+4 more)

### Community 19 - "ReviewDocument.tsx"
Cohesion: 0.12
Nodes (24): SwapLabel(), ExtractionWarningBanner(), Props, Props, OcrExtractionHook, patchAccountingConfig(), approveDocument(), getPending() (+16 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.23
Nodes (14): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+6 more)

### Community 22 - "config.ts"
Cohesion: 0.11
Nodes (17): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+9 more)

### Community 23 - "apInvoice.ts"
Cohesion: 0.06
Nodes (47): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, COLS, Props (+39 more)

### Community 24 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (41): Button(), ButtonProps, Variant, VARIANT_CLASS, Draft, EmailSettingsController, EMPTY_DRAFT, EMPTY_RULE (+33 more)

### Community 25 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime(), causeLabel(), classify(), ERROR_RULES (+6 more)

### Community 26 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 27 - "useARReconcile.ts"
Cohesion: 0.13
Nodes (19): Props, ARReconcileHook, bankFromHash(), dedupe(), fingerprint(), firstToken(), useARReconcile(), ARBankOption (+11 more)

### Community 28 - "usage.ts"
Cohesion: 0.38
Nodes (5): base, Usage, UsageData, computeUsageStats(), UsageStats

### Community 29 - "ErrorsPage.tsx"
Cohesion: 0.22
Nodes (12): Column, periodHours(), fetchErrorBreakdown(), fetchTenantRanking(), ErrorRow, ErrorsPage(), GroupBy, getColsCost() (+4 more)

### Community 30 - "client.ts"
Cohesion: 0.29
Nodes (9): CarmenSSOState, useCarmenSSO(), exchangeSSOToken(), revokeSession(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient() (+1 more)

### Community 31 - "PlanCard.tsx"
Cohesion: 0.14
Nodes (16): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+8 more)

### Community 32 - "AdminLogin.tsx"
Cohesion: 0.29
Nodes (8): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss(), AdminLogin

### Community 33 - "CustomModal.tsx"
Cohesion: 0.20
Nodes (8): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, ACCEPTED, Props, MAX_FILE_SIZE_MB

### Community 34 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (41): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+33 more)

### Community 35 - "MaintenancePage.tsx"
Cohesion: 0.31
Nodes (10): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, fmtICT(), MaintenancePage() (+2 more)

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.14
Nodes (24): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, handleFileChange(), setPreview() (+16 more)

### Community 37 - "useAPSubmission.ts"
Cohesion: 0.09
Nodes (32): Props, Props, VendorSearch(), APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine (+24 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminFetch"
Cohesion: 0.13
Nodes (31): EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, adminFetch, createAdminUser(), EmailBusinessUnitRow, EmailDocumentRow (+23 more)

### Community 40 - "api.ts"
Cohesion: 0.12
Nodes (16): useMappingSuggestions(), suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest (+8 more)

### Community 41 - "formatThb"
Cohesion: 0.24
Nodes (14): num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords() (+6 more)

### Community 42 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 43 - "ARReconcileSettings.tsx"
Cohesion: 0.18
Nodes (11): Card(), CardProps, ARJvPreview(), money(), ARMappingTable(), CustomSearchSelect(), Props, SelectOption (+3 more)

### Community 44 - "PendingOrderBanner.tsx"
Cohesion: 0.16
Nodes (21): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, OrderRow(), RowAction, rowInitial, rowReducer() (+13 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.10
Nodes (21): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+13 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.27
Nodes (18): AccountMappingTable(), MappingRow(), MappingRowVariant, Props, MainMappingTable(), Props, Props, ActiveScan (+10 more)

### Community 48 - "useOcrExtraction.ts"
Cohesion: 0.29
Nodes (8): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, ModalConfig

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 50 - "PerformancePage.tsx"
Cohesion: 0.17
Nodes (22): daysAgo(), endOfDay(), useTableData(), fetchJobs(), fetchPerformanceLogs(), fetchSessions(), fetchUserUsage(), resolveAlert() (+14 more)

### Community 51 - "routes.tsx"
Cohesion: 0.27
Nodes (8): AdminRouter, AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, NavItem, NavSection, Overview

### Community 52 - "Pricing.tsx"
Cohesion: 0.13
Nodes (17): PendingOrderBanner(), SLIP, SALES_CONTACT, useOrderHistory(), ActiveSubscription, getUsage(), getStoredToken(), getPaymentInfo() (+9 more)

### Community 54 - "CreditsPage.tsx"
Cohesion: 0.16
Nodes (15): CompanyPanel(), label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, adjustCredits() (+7 more)

### Community 55 - "AuthContext.tsx"
Cohesion: 0.19
Nodes (13): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), clearToken(), storeToken() (+5 more)

### Community 56 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 57 - "useMapping.ts"
Cohesion: 0.18
Nodes (16): PLACEHOLDER_MAP, Props, RequiredField, BANK_SOURCE_MAP, BankInfo, BankConfigHook, COMPANY_REQUIRED_FIELDS, codeToDisplayName() (+8 more)

### Community 58 - "credits.ts"
Cohesion: 0.13
Nodes (25): Props, RowState, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist() (+17 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "storage.ts"
Cohesion: 0.16
Nodes (21): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), persistScanForMapping(), getAccountingConfig (+13 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 62 - "LLMLogsPage.tsx"
Cohesion: 0.60
Nodes (4): fetchLLMLogs(), getCols(), LLMLogsPage(), LogRow

### Community 63 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 64 - "DetailTable.tsx"
Cohesion: 0.13
Nodes (17): BANK_LOGOS, Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS (+9 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (24): BatchAction, BatchActionBar(), Props, INSTRUCTIONS, Props, UploadSection(), MAP, OrderStatusBadge() (+16 more)

### Community 67 - "useMappingData.ts"
Cohesion: 0.23
Nodes (13): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchDepartments(), fetchGLPrefixes(), AccountLike (+5 more)

### Community 68 - "InputTaxReconciliation.tsx"
Cohesion: 0.14
Nodes (20): DateInput(), DateInputProps, InputTaxReconciliation(), handleAddInputTax(), Props, JvHeaderCard(), Props, useGlMasters() (+12 more)

### Community 69 - "OrderWorkspace.tsx"
Cohesion: 0.08
Nodes (31): OrderDrawer(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable() (+23 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard.ts"
Cohesion: 0.06
Nodes (42): useFileUpload(), OcrDraftState, useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission() (+34 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+2 more)

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 77 - "ManualScan.tsx"
Cohesion: 0.14
Nodes (9): AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., FormActions(), Props, T, UsageIndicator(), BankDetectionBanner() (+1 more)

### Community 78 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.31
Nodes (8): fetchTenantDetail(), fetchTenants(), TenantDetail, funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

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

### Community 89 - "getCarmenUrl"
Cohesion: 0.26
Nodes (9): COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri(), carmenSettingsUrl(), getCarmenUrl() (+1 more)

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

## Knowledge Gaps
- **515 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+510 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `OrderActions.tsx`, `TutorialModal.tsx`, `AccountingReview.tsx`, `ReviewQueue.tsx`, `Mapping.tsx`, `PeriodPicker.tsx`, `useAPInvoice.ts`, `main.tsx`, `APInvoice.tsx`, `screens.tsx`, `CreditOrdersPage.tsx`, `QuotaModulesPage.tsx`, `ReviewDocument.tsx`, `QueueRow.tsx`, `apInvoice.ts`, `ExtractionsPage.tsx`, `ArCustomerProfiles.tsx`, `useARReconcile.ts`, `ErrorsPage.tsx`, `PlanCard.tsx`, `AdminLogin.tsx`, `CustomModal.tsx`, `NotificationBell.tsx`, `MaintenancePage.tsx`, `useAPExtraction.ts`, `useAPSubmission.ts`, `adminFetch`, `formatThb`, `MaintenanceGate.tsx`, `ARReconcileSettings.tsx`, `PendingOrderBanner.tsx`, `DataTable.tsx`, `MainMappingTable.tsx`, `DocumentPreview.tsx`, `PerformancePage.tsx`, `Pricing.tsx`, `CreditsPage.tsx`, `credits.ts`, `MetricChartImpl.tsx`, `LLMLogsPage.tsx`, `APAccountMappingStep.tsx`, `DetailTable.tsx`, `LanguageContext.tsx`, `InputTaxReconciliation.tsx`, `OrderWorkspace.tsx`, `useOcrWizard.ts`, `ManualScan.tsx`, `TenantsPage.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `useAPExtraction.ts` to `AccountingReview.tsx`, `useAPInvoice.ts`, `emailReview.ts`, `ReviewDocument.tsx`, `config.ts`, `useARReconcile.ts`, `client.ts`, `PlanCard.tsx`, `NotificationBell.tsx`, `useAPSubmission.ts`, `api.ts`, `PendingOrderBanner.tsx`, `useAPExtraction.test.ts`, `Pricing.tsx`, `credits.ts`, `storage.ts`, `useMappingData.ts`, `InputTaxReconciliation.tsx`, `useUserConsent.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `showToast()` connect `useAPSubmission.ts` to `AccountingReview.tsx`, `ReviewQueue.tsx`, `useAPExtraction.ts`, `useOcrExtraction.test.ts`, `useAPInvoice.ts`, `useOcrWizard.ts`, `useOcrExtraction.ts`, `ReviewDocument.tsx`, `config.ts`, `AuthContext.tsx`, `useEmailSettings.ts`, `getCarmenUrl`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _515 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1039136302294197 - nodes in this community are weakly interconnected._
- **Should `AccountingReview.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._
- **Should `useT` be split into smaller, more focused modules?**
  _Cohesion score 0.10344827586206896 - nodes in this community are weakly interconnected._