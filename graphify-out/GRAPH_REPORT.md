# Graph Report - OCR  (2026-09-03)

## Corpus Check
- 296 files · ~229,236 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1748 nodes · 4921 edges · 112 communities (100 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `143247bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- apiFetch
- TutorialModal.tsx
- ReviewDocument.tsx
- LanguageContext.tsx
- screens.tsx
- storage.ts
- DataTable.tsx
- PeriodPicker.tsx
- useAPInvoice.ts
- ManualScan.tsx
- NotificationBell.tsx
- MainMappingTable.tsx
- PendingOrderBanner.tsx
- showToast
- bankTransforms.ts
- adminClient.ts
- compilerOptions
- 5. Components
- AdminLogin.tsx
- OrderWorkspace.tsx
- devDependencies
- AccountMappingTable.tsx
- APInvoice.tsx
- APLineItemsTable.tsx
- emailAutomation.ts
- useAPSubmission.ts
- useCheckout.ts
- useNotifications.ts
- CreditOrdersPage.tsx
- QuotaModulesPage.tsx
- Pricing.tsx
- main.tsx
- api.ts
- APAmountSummary.tsx
- APReviewStep.tsx
- auth.ts
- useFileUpload.ts
- ccJv.ts
- dependencies
- useT
- EmailAutomationPage.tsx
- ProtectedRoute.tsx
- FeatureFlows.tsx
- OrderTable.tsx
- credits.ts
- client.ts
- useAPExtraction.ts
- useMapping.ts
- usePdfPasswordPrompt
- CreditsPage.tsx
- ExtractionsPage.tsx
- Overview.tsx
- AdminUsersPage.tsx
- AppHeader.tsx
- CheckoutFlow.tsx
- useAPExtraction.test.ts
- OrderActions.tsx
- useOcrSubmission.test.ts
- adminFetch
- scripts
- MetricChartImpl.tsx
- UserUsagePage.tsx
- InputTaxReconciliation.tsx
- useAPSubmission.test.ts
- ocr.ts
- compilerOptions
- getCarmenUrl
- DocumentPreview.tsx
- useOcrWizard.ts
- MaintenancePage.tsx
- CLAUDE.md
- Contributing
- APAccountMappingStep.tsx
- MaintenanceGate.tsx
- useUserConsent.ts
- toast.ts
- ArCustomerProfiles.tsx
- APGroupModal.tsx
- date.ts
- PDFPageSelector
- Skeleton.tsx
- Product
- CustomModal.tsx
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- useNotifications.test.ts
- vercel.json
- Architecture
- LLMLogsPage.tsx
- vite.config.ts
- eslint
- eslint-plugin-react-hooks
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `apiFetch` - 55 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 41 edges
6. `appKey()` - 31 edges
7. `showToast()` - 31 edges
8. `TKey` - 28 edges
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

## Communities (112 total, 12 thin omitted)

### Community 0 - "apiFetch"
Cohesion: 0.05
Nodes (53): FIX, formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow() (+45 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ReviewDocument.tsx"
Cohesion: 0.11
Nodes (30): SkeletonRow(), SwapLabel(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, Props, BlockReason (+22 more)

### Community 3 - "LanguageContext.tsx"
Cohesion: 0.09
Nodes (28): BatchAction, Props, slipIsPdf(), SlipViewer(), INSTRUCTIONS, Props, UploadSection(), DICT (+20 more)

### Community 4 - "screens.tsx"
Cohesion: 0.10
Nodes (28): PackList(), Props, EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS, DEMO_BUYER (+20 more)

### Community 5 - "storage.ts"
Cohesion: 0.13
Nodes (27): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+19 more)

### Community 6 - "DataTable.tsx"
Cohesion: 0.10
Nodes (20): DataTableProps, ExpandedRowWrapperProps, ServerTable, SKELETON_WIDTHS, SortDir, Pager(), Props, SIZE_OPTIONS (+12 more)

### Community 7 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (26): Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+18 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.19
Nodes (22): AmountSummary(), AccountingReview(), Amount(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows() (+14 more)

### Community 9 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (18): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+10 more)

### Community 10 - "NotificationBell.tsx"
Cohesion: 0.11
Nodes (21): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+13 more)

### Community 11 - "MainMappingTable.tsx"
Cohesion: 0.16
Nodes (20): AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption, TopChoice, Props, Props (+12 more)

### Community 12 - "PendingOrderBanner.tsx"
Cohesion: 0.15
Nodes (22): OrderRow(), RowAction, rowInitial, rowReducer(), expiryDate(), num(), ProformaDocument(), TITLE (+14 more)

### Community 13 - "showToast"
Cohesion: 0.16
Nodes (18): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), useOcrWizard() (+10 more)

### Community 14 - "bankTransforms.ts"
Cohesion: 0.12
Nodes (17): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_SOURCE_MAP (+9 more)

### Community 15 - "adminClient.ts"
Cohesion: 0.12
Nodes (23): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), CreditBalance (+15 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "AdminLogin.tsx"
Cohesion: 0.15
Nodes (18): AdminProtectedRoute(), useAdminAuth(), adminLogin(), AdminLoginError, AdminRouter, AdminLayout(), getActiveHash(), AdminLogin() (+10 more)

### Community 19 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (20): Props, Props, many(), order(), CompanyPanel(), ContactBuyer(), num(), OrderWorkspace() (+12 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "AccountMappingTable.tsx"
Cohesion: 0.18
Nodes (18): AccountMappingTable(), GLAccount, MainMappingTable(), PaymentTypeModal(), prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData() (+10 more)

### Community 22 - "APInvoice.tsx"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APUploadStep(), INSTRUCTIONS, Props (+10 more)

### Community 23 - "APLineItemsTable.tsx"
Cohesion: 0.15
Nodes (16): APLineItemsTable(), Props, APTableFooter(), Props, APTableHeader(), Props, FixedTaxSettings, Props (+8 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.23
Nodes (19): EmailSettingsController, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call(), deleteToken() (+11 more)

### Community 25 - "useAPSubmission.ts"
Cohesion: 0.18
Nodes (19): Props, Props, Props, Props, APInvoiceHeader, APDraftState, ApDraft, APSubmissionProps (+11 more)

### Community 26 - "useCheckout.ts"
Cohesion: 0.17
Nodes (19): Props, RowState, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist() (+11 more)

### Community 27 - "useNotifications.ts"
Cohesion: 0.18
Nodes (15): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy, releaseRow(), useNotifications(), listNotifications() (+7 more)

### Community 28 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (17): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+9 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (17): EmptyState(), EmptyStateProps, Switch(), SwitchProps, Tab, Tabs(), TabsProps, fetchQuotaOverview() (+9 more)

### Community 30 - "Pricing.tsx"
Cohesion: 0.18
Nodes (16): AppHeader(), PendingOrderBanner(), SALES_CONTACT, useOrderHistory(), ActiveSubscription, getUsage(), getStoredToken(), getPaymentInfo() (+8 more)

### Community 31 - "main.tsx"
Cohesion: 0.11
Nodes (12): ErrorBoundary, Props, State, PageSkeleton(), container, getRoute(), Home, ManualScan (+4 more)

### Community 32 - "api.ts"
Cohesion: 0.11
Nodes (18): APVendorMapping, APVendorMappingResponse, ConfigPatch, SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, AccountingConfigResponse, ApiError (+10 more)

### Community 33 - "APAmountSummary.tsx"
Cohesion: 0.13
Nodes (14): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+6 more)

### Community 34 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (15): APReviewStep(), Ctrl, HEADER_FIELDS(), Props, Props, VendorSearch(), Coords, getCoords() (+7 more)

### Community 35 - "auth.ts"
Cohesion: 0.16
Nodes (13): T, base, Usage, UsageIndicator(), UsageData, API, Correction, FIELD_NAME_MAP (+5 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 37 - "ccJv.ts"
Cohesion: 0.15
Nodes (16): codeToSource(), CONFIG, leg(), rows(), TWO_LINES, applyJvAmount(), buildGljvPayload(), buildJvRows() (+8 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "useT"
Cohesion: 0.19
Nodes (14): FormActions(), Props, useTableData(), useT(), fetchTenantDetail(), TenantDetail, AnomaliesPage(), SessionRow (+6 more)

### Community 40 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 41 - "ProtectedRoute.tsx"
Cohesion: 0.16
Nodes (15): ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+7 more)

### Community 42 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 43 - "OrderTable.tsx"
Cohesion: 0.15
Nodes (15): BatchActionBar(), BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable() (+7 more)

### Community 44 - "credits.ts"
Cohesion: 0.16
Nodes (13): MAP, OrderStatusBadge(), OPEN_STATUSES, OrderHistoryState, BuyerInfo, CompanyProfile, CreateOrderResponse, CreditOrder (+5 more)

### Community 45 - "client.ts"
Cohesion: 0.20
Nodes (14): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, clearToken() (+6 more)

### Community 46 - "useAPExtraction.ts"
Cohesion: 0.20
Nodes (14): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), createApiClient(), fetchTimeout() (+6 more)

### Community 47 - "useMapping.ts"
Cohesion: 0.28
Nodes (10): COMPANY_REQUIRED_FIELDS, useMapping(), useMappingSuggestions(), usePaymentTypes(), ModalConfig, saveAccountingConfig(), suggestMapping(), suggestPaymentTypes() (+2 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "CreditsPage.tsx"
Cohesion: 0.24
Nodes (13): DataTable(), getCell(), daysAgo(), endOfDay(), CreditsPage(), getCols(), getPacks(), getCols() (+5 more)

### Community 50 - "ExtractionsPage.tsx"
Cohesion: 0.22
Nodes (13): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fmtDateTime(), causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+5 more)

### Community 51 - "Overview.tsx"
Cohesion: 0.19
Nodes (12): KPICard(), KPICardProps, Card(), CardProps, PageHeader(), PageHeaderProps, fetchAlerts(), fetchUsageSummary() (+4 more)

### Community 52 - "AdminUsersPage.tsx"
Cohesion: 0.23
Nodes (14): Button(), ButtonProps, Variant, VARIANT_CLASS, AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles() (+6 more)

### Community 53 - "AppHeader.tsx"
Cohesion: 0.19
Nodes (8): Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell, OrderReviewShell()

### Community 54 - "CheckoutFlow.tsx"
Cohesion: 0.15
Nodes (13): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+5 more)

### Community 55 - "useAPExtraction.test.ts"
Cohesion: 0.14
Nodes (14): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+6 more)

### Community 56 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.15
Nodes (12): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+4 more)

### Community 58 - "adminFetch"
Cohesion: 0.22
Nodes (14): adjustCredits(), adminFetch, buildQs(), fetchErrorBreakdown(), fetchExtractionFailures(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs() (+6 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 61 - "UserUsagePage.tsx"
Cohesion: 0.19
Nodes (9): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, getCols(), UserRow (+1 more)

### Community 62 - "InputTaxReconciliation.tsx"
Cohesion: 0.31
Nodes (8): InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles(), _parseCarmenHttpError(), submitInputTax(), submitToCarmen(), resolveTaxProfileForRate()

### Community 63 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 64 - "ocr.ts"
Cohesion: 0.21
Nodes (10): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractedRow, extractFromFile(), ExtractResult (+2 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "getCarmenUrl"
Cohesion: 0.27
Nodes (8): APSuccessStep(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri(), getCarmenUrl()

### Community 67 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 68 - "useOcrWizard.ts"
Cohesion: 0.35
Nodes (9): OcrDraftState, CcDraft, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+1 more)

### Community 69 - "MaintenancePage.tsx"
Cohesion: 0.29
Nodes (11): endMaintenanceNow(), fetchMaintenance(), fetchTenants(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, fmtICT() (+3 more)

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
Cohesion: 0.29
Nodes (10): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+2 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "toast.ts"
Cohesion: 0.20
Nodes (7): EmailRule, ToastType, EmailSettings, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE

### Community 76 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 77 - "APGroupModal.tsx"
Cohesion: 0.44
Nodes (6): APGroupModal(), profileLabel(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 78 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 81 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 82 - "CustomModal.tsx"
Cohesion: 0.29
Nodes (5): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG

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

### Community 89 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 94 - "LLMLogsPage.tsx"
Cohesion: 0.67
Nodes (3): getCols(), LLMLogsPage(), LogRow

## Knowledge Gaps
- **493 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+488 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `apiFetch`, `TutorialModal.tsx`, `ReviewDocument.tsx`, `LanguageContext.tsx`, `screens.tsx`, `DataTable.tsx`, `PeriodPicker.tsx`, `useAPInvoice.ts`, `ManualScan.tsx`, `NotificationBell.tsx`, `MainMappingTable.tsx`, `PendingOrderBanner.tsx`, `showToast`, `AdminLogin.tsx`, `OrderWorkspace.tsx`, `AccountMappingTable.tsx`, `APInvoice.tsx`, `APLineItemsTable.tsx`, `useNotifications.ts`, `CreditOrdersPage.tsx`, `QuotaModulesPage.tsx`, `Pricing.tsx`, `APAmountSummary.tsx`, `APReviewStep.tsx`, `auth.ts`, `EmailAutomationPage.tsx`, `FeatureFlows.tsx`, `OrderTable.tsx`, `credits.ts`, `useAPExtraction.ts`, `useMapping.ts`, `CreditsPage.tsx`, `ExtractionsPage.tsx`, `Overview.tsx`, `AdminUsersPage.tsx`, `AppHeader.tsx`, `CheckoutFlow.tsx`, `OrderActions.tsx`, `MetricChartImpl.tsx`, `UserUsagePage.tsx`, `InputTaxReconciliation.tsx`, `getCarmenUrl`, `DocumentPreview.tsx`, `MaintenancePage.tsx`, `APAccountMappingStep.tsx`, `MaintenanceGate.tsx`, `ArCustomerProfiles.tsx`, `APGroupModal.tsx`, `CustomModal.tsx`, `LLMLogsPage.tsx`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `showToast` to `useOcrWizard.ts`, `useFileUpload.ts`, `ManualScan.tsx`, `usePdfPasswordPrompt`, `useAPExtraction.test.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `storage.ts`, `useAPInvoice.ts`, `NotificationBell.tsx`, `PendingOrderBanner.tsx`, `AccountMappingTable.tsx`, `useAPSubmission.ts`, `useCheckout.ts`, `useNotifications.ts`, `Pricing.tsx`, `api.ts`, `APReviewStep.tsx`, `auth.ts`, `useFileUpload.ts`, `credits.ts`, `client.ts`, `useAPExtraction.ts`, `useMapping.ts`, `useAPExtraction.test.ts`, `InputTaxReconciliation.tsx`, `useAPSubmission.test.ts`, `ocr.ts`, `useUserConsent.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _493 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `apiFetch` be split into smaller, more focused modules?**
  _Cohesion score 0.05217391304347826 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ReviewDocument.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11201079622132254 - nodes in this community are weakly interconnected._