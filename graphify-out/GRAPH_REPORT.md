# Graph Report - OCR  (2026-09-09)

## Corpus Check
- 299 files · ~240,790 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1759 nodes · 4967 edges · 114 communities (102 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1629b550`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- TutorialModal.tsx
- ccJv.ts
- NotificationBell.tsx
- CreditOrdersPage.tsx
- bankTransforms.ts
- date.ts
- FeatureFlows.tsx
- useAPInvoice.ts
- main.tsx
- APAccountMappingStep.tsx
- screens.tsx
- normalizeYearToCE
- showToast
- apiFetch
- DataTable.tsx
- compilerOptions
- 5. Components
- getCarmenUrl
- Overview.tsx
- devDependencies
- QueueRow.tsx
- APVendorSearch.tsx
- APReviewStep.tsx
- emailAutomation.ts
- APAmountSummary.tsx
- Pricing.tsx
- client.ts
- adminClient.ts
- QuotaModulesPage.tsx
- ManualScan.tsx
- config.ts
- MaintenancePage.tsx
- OrderHistory.tsx
- AppHeader.tsx
- ExtractionsPage.tsx
- useAPExtraction.ts
- useAPSubmission.ts
- dependencies
- AdminUsersPage.tsx
- api.ts
- EmailAutomationPage.tsx
- useUserConsent.ts
- CheckoutFlow.tsx
- ProformaDocument.tsx
- OrderTable.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- ocr.ts
- PeriodPicker.tsx
- useMappingData.ts
- ReviewDocument.tsx
- credits.ts
- OrderActions.tsx
- adminFetch
- AuthContext.tsx
- Skeleton.tsx
- useNotifications.ts
- PendingOrderBanner.tsx
- scripts
- useMapping.ts
- useT
- OrderWorkspace.tsx
- ReviewDocument.test.tsx
- reviewReasons.ts
- compilerOptions
- dict.ts
- APInvoice.tsx
- ArCustomerProfiles.tsx
- UsagePage.tsx
- CLAUDE.md
- Contributing
- InputTaxReconciliation.tsx
- NotificationBell.test.tsx
- ProtectedRoute.tsx
- useOcrExtraction.ts
- CreditsPage.tsx
- MaintenanceGate.tsx
- eslint-plugin-react-hooks
- PDFPageSelector
- EmailSettings.tsx
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
- WhatsNew.tsx
- vite.config.ts
- CustomModal.tsx
- releaseNotes.ts
- jsdom
- useOrderHistory.ts
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- TenantsPage.tsx
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- useNotifications.test.ts
- @types/react-dom

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
- `Props` --references--> `AdminCreditOrder`  [EXTRACTED]
  frontend/src/components/admin/OrderTable.tsx → frontend/src/lib/api/adminClient.ts
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/constants/apInvoice.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (114 total, 12 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (9): ACTIVITY_FILTERS, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty(), ReviewQueue() (+1 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (30): PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify() (+22 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.13
Nodes (20): AccountingReview(), OCR_BANK_MAP, codeToSource(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES (+12 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.24
Nodes (11): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), Props (+3 more)

### Community 4 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (17): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+9 more)

### Community 5 - "bankTransforms.ts"
Cohesion: 0.11
Nodes (19): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BankInfo (+11 more)

### Community 6 - "date.ts"
Cohesion: 0.22
Nodes (24): Column, daysAgo(), endOfDay(), today(), ymd(), useTableData(), useTableQuery, fmtDateTime() (+16 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.14
Nodes (31): AmountSummary(), APGroupModal(), profileLabel(), Props, InputTaxPanel(), Amount(), getAvailableFields(), useAPInvoice() (+23 more)

### Community 9 - "main.tsx"
Cohesion: 0.11
Nodes (12): ErrorBoundary, Props, State, PageSkeleton(), container, getRoute(), Home, ManualScan (+4 more)

### Community 10 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 11 - "screens.tsx"
Cohesion: 0.15
Nodes (14): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+6 more)

### Community 12 - "normalizeYearToCE"
Cohesion: 0.43
Nodes (6): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDDMMYYYYToDate()

### Community 13 - "showToast"
Cohesion: 0.05
Nodes (56): OcrDraftState, extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData() (+48 more)

### Community 14 - "apiFetch"
Cohesion: 0.22
Nodes (17): ReviewQueueController, useReviewQueue(), apiFetch, patchAccountingConfig(), ActivityFilter, approveDocument(), ApproveResult, getPending() (+9 more)

### Community 15 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "getCarmenUrl"
Cohesion: 0.24
Nodes (10): COPY, Lang, Props, useIsMobile(), UserConsentModal(), RowAction(), fixLinkProps(), getCarmenUri() (+2 more)

### Community 19 - "Overview.tsx"
Cohesion: 0.19
Nodes (12): KPICard(), KPICardProps, Card(), CardProps, PageHeader(), PageHeaderProps, fetchAlerts(), fetchUsageSummary() (+4 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+4 more)

### Community 22 - "APVendorSearch.tsx"
Cohesion: 0.28
Nodes (7): Props, VendorSearch(), Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (24): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+16 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.20
Nodes (20): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+12 more)

### Community 25 - "APAmountSummary.tsx"
Cohesion: 0.20
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+1 more)

### Community 26 - "Pricing.tsx"
Cohesion: 0.15
Nodes (21): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, BillingFigure(), ENTERPRISE (+13 more)

### Community 27 - "client.ts"
Cohesion: 0.27
Nodes (9): CarmenSSOState, useCarmenSSO(), exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), fetchTimeout() (+1 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.12
Nodes (24): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), CreditBalance (+16 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (17): EmptyState(), EmptyStateProps, Switch(), SwitchProps, Tab, Tabs(), TabsProps, fetchQuotaOverview() (+9 more)

### Community 30 - "ManualScan.tsx"
Cohesion: 0.09
Nodes (22): ExtractionSkeleton(), NumericInput(), NumericInputProps, BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable() (+14 more)

### Community 31 - "config.ts"
Cohesion: 0.21
Nodes (12): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), APVendorMapping, APVendorMappingResponse (+4 more)

### Community 32 - "MaintenancePage.tsx"
Cohesion: 0.29
Nodes (11): endMaintenanceNow(), fetchMaintenance(), fetchTenants(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, fmtICT() (+3 more)

### Community 33 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (16): T, UsageIndicator(), MAP, OrderStatusBadge(), catalogName(), ActiveSubscription, getUsage(), getStoredToken() (+8 more)

### Community 34 - "AppHeader.tsx"
Cohesion: 0.08
Nodes (31): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), useAdminAuth(), isDarkNow(), useDarkMode() (+23 more)

### Community 35 - "ExtractionsPage.tsx"
Cohesion: 0.29
Nodes (10): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+2 more)

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (22): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload() (+14 more)

### Community 37 - "useAPSubmission.ts"
Cohesion: 0.09
Nodes (30): Props, Props, APInvoiceHeader, APDraftState, ApDraft, APSubmissionProps, GLAccount, apiFetch (+22 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "AdminUsersPage.tsx"
Cohesion: 0.23
Nodes (14): Button(), ButtonProps, Variant, VARIANT_CLASS, AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles() (+6 more)

### Community 40 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 41 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 42 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+2 more)

### Community 43 - "CheckoutFlow.tsx"
Cohesion: 0.22
Nodes (11): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS (+3 more)

### Community 44 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 45 - "OrderTable.tsx"
Cohesion: 0.12
Nodes (17): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+9 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.14
Nodes (13): base, Usage, apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE (+5 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.14
Nodes (21): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption (+13 more)

### Community 48 - "ocr.ts"
Cohesion: 0.15
Nodes (15): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+7 more)

### Community 49 - "PeriodPicker.tsx"
Cohesion: 0.18
Nodes (19): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS (+11 more)

### Community 50 - "useMappingData.ts"
Cohesion: 0.18
Nodes (18): JvHeaderCard(), Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterAccount, MasterDepartment (+10 more)

### Community 51 - "ReviewDocument.tsx"
Cohesion: 0.12
Nodes (30): SwapLabel(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, Props, BlockReason, BU_WIDE (+22 more)

### Community 52 - "credits.ts"
Cohesion: 0.15
Nodes (22): OrderRow(), CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+14 more)

### Community 53 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 54 - "adminFetch"
Cohesion: 0.20
Nodes (15): adjustCredits(), adminFetch, buildQs(), fetchErrorBreakdown(), fetchExtractionFailures(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs() (+7 more)

### Community 55 - "AuthContext.tsx"
Cohesion: 0.17
Nodes (16): AppHeader(), AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), useAuth() (+8 more)

### Community 56 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 57 - "useNotifications.ts"
Cohesion: 0.30
Nodes (8): releaseRow(), useNotifications(), ActivityPage, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page

### Community 58 - "PendingOrderBanner.tsx"
Cohesion: 0.22
Nodes (9): PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, ACCEPTED, Props, SlipUpload() (+1 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.20
Nodes (18): BANK_SOURCE_MAP, detectBankFromCompanyName(), persistScanForMapping(), getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig (+10 more)

### Community 61 - "useT"
Cohesion: 0.11
Nodes (20): DateRangePicker(), DateRangePickerProps, slipIsPdf(), SlipViewer(), DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview() (+12 more)

### Community 62 - "OrderWorkspace.tsx"
Cohesion: 0.15
Nodes (19): OrderDrawer(), Props, CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction (+11 more)

### Community 63 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 64 - "reviewReasons.ts"
Cohesion: 0.25
Nodes (9): ExtractionWarningBanner(), Props, OcrExtractionHook, ExtractionWarning, FIX, REASON_KEY, SETTINGS, warningText() (+1 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "dict.ts"
Cohesion: 0.12
Nodes (17): BatchAction, BatchActionBar(), Props, INSTRUCTIONS, Props, UploadSection(), DICT, en (+9 more)

### Community 67 - "APInvoice.tsx"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props (+10 more)

### Community 68 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 69 - "UsagePage.tsx"
Cohesion: 0.14
Nodes (15): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+7 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "InputTaxReconciliation.tsx"
Cohesion: 0.31
Nodes (8): InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen(), resolveTaxProfileForRate()

### Community 73 - "NotificationBell.test.tsx"
Cohesion: 0.20
Nodes (8): failedRow, items, markRead, orderRow, postedRow, releaseRow, LanguageProvider(), readLang()

### Community 74 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 75 - "useOcrExtraction.ts"
Cohesion: 0.29
Nodes (7): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, MappingSuggestionsHook, MappingSuggestionsProps, ModalConfig

### Community 76 - "CreditsPage.tsx"
Cohesion: 0.21
Nodes (9): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, CreditsPage(), getCols() (+1 more)

### Community 77 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, EmailSettings, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE

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

### Community 94 - "WhatsNew.tsx"
Cohesion: 0.42
Nodes (6): markReleaseSeen(), readReleaseSeen(), RELEASE_SEEN_EVENT, WHATS_NEW_RETURN_KEY, WhatsNew, WhatsNew()

### Community 96 - "CustomModal.tsx"
Cohesion: 0.29
Nodes (5): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG

### Community 97 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 99 - "useOrderHistory.ts"
Cohesion: 0.38
Nodes (6): OPEN_STATUSES, OrderHistoryState, useOrderHistory(), CreditOrder, listOrders(), OPEN_ORDER_STATUSES

### Community 103 - "TenantsPage.tsx"
Cohesion: 0.43
Nodes (5): funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

### Community 112 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

## Knowledge Gaps
- **495 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+490 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `TutorialModal.tsx`, `ccJv.ts`, `NotificationBell.tsx`, `CreditOrdersPage.tsx`, `bankTransforms.ts`, `date.ts`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `APAccountMappingStep.tsx`, `screens.tsx`, `showToast`, `DataTable.tsx`, `getCarmenUrl`, `Overview.tsx`, `QueueRow.tsx`, `APVendorSearch.tsx`, `APReviewStep.tsx`, `APAmountSummary.tsx`, `Pricing.tsx`, `QuotaModulesPage.tsx`, `ManualScan.tsx`, `MaintenancePage.tsx`, `OrderHistory.tsx`, `AppHeader.tsx`, `ExtractionsPage.tsx`, `useAPExtraction.ts`, `useAPSubmission.ts`, `AdminUsersPage.tsx`, `EmailAutomationPage.tsx`, `CheckoutFlow.tsx`, `ProformaDocument.tsx`, `OrderTable.tsx`, `MainMappingTable.tsx`, `PeriodPicker.tsx`, `useMappingData.ts`, `ReviewDocument.tsx`, `credits.ts`, `OrderActions.tsx`, `AuthContext.tsx`, `PendingOrderBanner.tsx`, `OrderWorkspace.tsx`, `reviewReasons.ts`, `dict.ts`, `APInvoice.tsx`, `ArCustomerProfiles.tsx`, `UsagePage.tsx`, `InputTaxReconciliation.tsx`, `CreditsPage.tsx`, `MaintenanceGate.tsx`, `WhatsNew.tsx`, `CustomModal.tsx`, `useOrderHistory.ts`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.247) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `OrderHistory.tsx`, `useOrderHistory.ts`, `useAPExtraction.ts`, `useAPSubmission.ts`, `useAPInvoice.ts`, `InputTaxReconciliation.tsx`, `useUserConsent.ts`, `api.ts`, `showToast`, `useAPExtraction.test.ts`, `ocr.ts`, `useMappingData.ts`, `ReviewDocument.tsx`, `credits.ts`, `useNotifications.ts`, `client.ts`, `useMapping.ts`, `config.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `showToast` to `ocr.ts`, `useAPExtraction.ts`, `ManualScan.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _495 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12666666666666668 - nodes in this community are weakly interconnected._