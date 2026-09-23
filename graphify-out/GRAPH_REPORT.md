# Graph Report - OCR  (2026-09-23)

## Corpus Check
- 305 files · ~245,660 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1783 nodes · 5029 edges · 112 communities (100 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `15859d9e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAuth
- CreditOrdersPage.tsx
- main.tsx
- LLMLogsPage.tsx
- useAPInvoice.ts
- APLineItemsTable.tsx
- NotificationBell.tsx
- TutorialModal.tsx
- Overview.tsx
- ManualScan.tsx
- AppHeader.tsx
- ccJv.ts
- emailAutomation.ts
- PendingOrderBanner.test.tsx
- useFileUpload.ts
- useMapping.ts
- OrderWorkspace.tsx
- useT
- OrderHistory.tsx
- apiFetch
- showToast
- compilerOptions
- 5. Components
- QuotaModulesPage.tsx
- useAPExtraction.ts
- ProformaDocument.tsx
- devDependencies
- AccountMappingTable.tsx
- ocr.ts
- APAmountSummary.tsx
- useOcrWizard
- MainMappingTable.tsx
- dependencies
- APInvoice.tsx
- ReviewQueue.tsx
- adminFetch
- FeatureFlows.tsx
- Pricing.tsx
- StepWizard.tsx
- useNotifications.ts
- api.ts
- PeriodPicker.tsx
- TKey
- date.ts
- Tooltip.tsx
- banks.ts
- TenantsPage.tsx
- OrderActions.tsx
- QueueRow.tsx
- useOcrExtraction
- scripts
- OrderDrawer.tsx
- useAPSubmission.ts
- AdminLogin.tsx
- compilerOptions
- DocumentPreview.tsx
- LanguageContext.tsx
- adminClient.ts
- CLAUDE.md
- Contributing
- Mapping.tsx
- DataTable.tsx
- useAPExtraction.test.ts
- useMappingData.ts
- client.ts
- Carmen AI — OCR & Import System
- InputTaxReconciliation.tsx
- PDFPageSelector
- APReviewStep.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- CreditsPage.tsx
- ReviewDocument.tsx
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- DataTable.test.tsx
- ExtractionsPage.tsx
- vercel.json
- Architecture
- AdminUsersPage.tsx
- PlanCard.tsx
- Carmen AI — OCR & Import System
- AuthContext.tsx
- vite.config.ts
- fmt
- useOcrWizard.ts
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- @testing-library/jest-dom
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- APAccountMappingStep.tsx
- useOcrExtraction.ts
- useUserConsent.ts
- ArCustomerProfiles.tsx
- MaintenancePage.tsx
- EmailSettings.tsx
- useNotifications.test.ts
- @types/react-dom
- eslint-plugin-react-hooks

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `adminFetch` - 53 edges
3. `apiFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 33 edges
7. `TKey` - 30 edges
8. `unwrapDetail()` - 28 edges
9. `useAPInvoice()` - 27 edges
10. `round2()` - 27 edges

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

### Community 0 - "useAuth"
Cohesion: 0.12
Nodes (19): ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+11 more)

### Community 1 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (17): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+9 more)

### Community 2 - "main.tsx"
Cohesion: 0.11
Nodes (13): ErrorBoundary, Props, State, PageSkeleton(), APInvoice, container, getRoute(), ManualScan (+5 more)

### Community 3 - "LLMLogsPage.tsx"
Cohesion: 0.17
Nodes (31): Column, daysAgo(), endOfDay(), today(), ymd(), useTableData(), useTableQuery, fetchJobs() (+23 more)

### Community 4 - "useAPInvoice.ts"
Cohesion: 0.20
Nodes (20): InputTaxPanel(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+12 more)

### Community 5 - "APLineItemsTable.tsx"
Cohesion: 0.16
Nodes (17): Props, Ctrl, APTableFooter(), Props, APTableHeader(), Props, FixedTaxSettings, Props (+9 more)

### Community 6 - "NotificationBell.tsx"
Cohesion: 0.13
Nodes (20): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), failedRow (+12 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify() (+19 more)

### Community 8 - "Overview.tsx"
Cohesion: 0.12
Nodes (22): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+14 more)

### Community 9 - "ManualScan.tsx"
Cohesion: 0.13
Nodes (14): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps (+6 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.12
Nodes (15): AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), Home (+7 more)

### Community 11 - "ccJv.ts"
Cohesion: 0.18
Nodes (12): CONFIG, leg(), rows(), TWO_LINES, buildJvRows(), COLUMN_FOR_KEY, consolidated(), Detail (+4 more)

### Community 12 - "emailAutomation.ts"
Cohesion: 0.20
Nodes (20): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+12 more)

### Community 13 - "PendingOrderBanner.test.tsx"
Cohesion: 0.18
Nodes (7): PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, ActiveSubscription, CreditOrder, OPEN_ORDER_STATUSES

### Community 14 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 15 - "useMapping.ts"
Cohesion: 0.14
Nodes (25): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), getAccountingConfig, seedOcrBranch() (+17 more)

### Community 16 - "OrderWorkspace.tsx"
Cohesion: 0.08
Nodes (30): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+22 more)

### Community 17 - "useT"
Cohesion: 0.11
Nodes (27): num(), VerifyFacts(), FormActions(), Props, PackList(), PlanCard(), DEMO_BUYER, DEMO_ORDER (+19 more)

### Community 18 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (21): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, ACCEPTED, Props, SlipUpload() (+13 more)

### Community 19 - "apiFetch"
Cohesion: 0.14
Nodes (26): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, CheckoutPhase, CheckoutSession, EMPTY_BUYER (+18 more)

### Community 20 - "showToast"
Cohesion: 0.10
Nodes (25): OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate() (+17 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "QuotaModulesPage.tsx"
Cohesion: 0.11
Nodes (21): KPICard(), KPICardProps, Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps (+13 more)

### Community 24 - "useAPExtraction.ts"
Cohesion: 0.13
Nodes (23): Props, Props, APGroupModal(), profileLabel(), Props, APSuccessStep(), Props, APInvoiceHeader (+15 more)

### Community 25 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, @eslint/js, devDependencies, autoprefixer, eslint, @eslint/js, globals (+15 more)

### Community 27 - "AccountMappingTable.tsx"
Cohesion: 0.20
Nodes (13): AccountMappingTable(), GLAccount, AISuggestBar(), Props, MainMappingTable(), PaymentTypeModal(), AccountLike, allowedAccountsForDept() (+5 more)

### Community 28 - "ocr.ts"
Cohesion: 0.16
Nodes (14): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+6 more)

### Community 29 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 30 - "useOcrWizard"
Cohesion: 0.24
Nodes (16): processFile(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword(), reExtract() (+8 more)

### Community 31 - "MainMappingTable.tsx"
Cohesion: 0.22
Nodes (17): CustomSearchSelect(), Props, SelectOption, TopChoice, Props, Props, ActiveScan, MainMappings (+9 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "APInvoice.tsx"
Cohesion: 0.16
Nodes (14): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), AP_STEPS, APFieldKey, APStep (+6 more)

### Community 34 - "ReviewQueue.tsx"
Cohesion: 0.07
Nodes (29): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity() (+21 more)

### Community 35 - "adminFetch"
Cohesion: 0.19
Nodes (18): adminFetch, EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth() (+10 more)

### Community 36 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 37 - "Pricing.tsx"
Cohesion: 0.15
Nodes (20): T, base, Usage, UsageIndicator(), clearPersistedCheckout(), loadPersistedCheckout(), useOrderHistory(), usePricingCatalog() (+12 more)

### Community 38 - "StepWizard.tsx"
Cohesion: 0.40
Nodes (4): DEFAULT_STEPS, Props, Step, StepWizard()

### Community 39 - "useNotifications.ts"
Cohesion: 0.16
Nodes (17): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy, releaseRow(), useNotifications(), listNotifications() (+9 more)

### Community 40 - "api.ts"
Cohesion: 0.12
Nodes (17): useMappingSuggestions(), suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption (+9 more)

### Community 41 - "PeriodPicker.tsx"
Cohesion: 0.16
Nodes (21): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS (+13 more)

### Community 42 - "TKey"
Cohesion: 0.16
Nodes (17): AdminProtectedRoute(), BatchAction, BatchActionBar(), Props, useAdminAuth(), TKey, AdminRouter, AdminLayout() (+9 more)

### Community 43 - "date.ts"
Cohesion: 0.19
Nodes (14): DateInput(), DateInputProps, DATE_KEYS, HeaderCard(), Props, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS (+6 more)

### Community 44 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 45 - "banks.ts"
Cohesion: 0.16
Nodes (17): AccountingReview(), BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP, BankInfo, GROUP_DEBIT_BY_TRANSACTION, OCR_BANK_MAP, codeToDisplayName() (+9 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.14
Nodes (15): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, fetchTenantDetail(), fetchTenants() (+7 more)

### Community 47 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 48 - "QueueRow.tsx"
Cohesion: 0.12
Nodes (25): COPY, Lang, Props, useIsMobile(), UserConsentModal(), formatWhen(), fullWhen(), Message() (+17 more)

### Community 49 - "useOcrExtraction"
Cohesion: 0.14
Nodes (10): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), reExtract() (+2 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "OrderDrawer.tsx"
Cohesion: 0.36
Nodes (5): OrderDrawer(), Props, __resetScrollLock(), Locker(), useScrollLock()

### Community 52 - "useAPSubmission.ts"
Cohesion: 0.10
Nodes (23): Props, VendorSearch(), APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload (+15 more)

### Community 53 - "AdminLogin.tsx"
Cohesion: 0.29
Nodes (8): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss(), AdminLogin

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 56 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (21): APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props, UploadSection(), MAP, OrderStatusBadge() (+13 more)

### Community 57 - "adminClient.ts"
Cohesion: 0.12
Nodes (23): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), CreditBalance (+15 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "Mapping.tsx"
Cohesion: 0.15
Nodes (12): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BankConfigHook (+4 more)

### Community 61 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 62 - "useAPExtraction.test.ts"
Cohesion: 0.19
Nodes (12): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+4 more)

### Community 63 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 64 - "client.ts"
Cohesion: 0.18
Nodes (15): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+7 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "InputTaxReconciliation.tsx"
Cohesion: 0.18
Nodes (10): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles() (+2 more)

### Community 67 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 68 - "APReviewStep.tsx"
Cohesion: 0.21
Nodes (11): APLineItemsTable(), APReviewStep(), HEADER_FIELDS(), Props, Card(), Props, ExtractionWarningBanner(), Props (+3 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "CreditsPage.tsx"
Cohesion: 0.42
Nodes (8): CompanyPanel(), adjustCredits(), fetchCreditBalance(), fetchCreditLedger(), topupCredits(), CreditsPage(), getCols(), getPacks()

### Community 73 - "ReviewDocument.tsx"
Cohesion: 0.11
Nodes (31): SwapLabel(), Props, DetailRow, Props, Props, Amount(), BlockReason, BU_WIDE (+23 more)

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 77 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (13): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+5 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "AdminUsersPage.tsx"
Cohesion: 0.18
Nodes (16): Button(), ButtonProps, Variant, VARIANT_CLASS, Switch(), SwitchProps, AdminUserRow, createAdminUser() (+8 more)

### Community 82 - "PlanCard.tsx"
Cohesion: 0.19
Nodes (10): Props, EnterpriseCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PackPresentation, PLAN_META (+2 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "AuthContext.tsx"
Cohesion: 0.26
Nodes (11): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), clearAllDrafts(), getJwtExpMs() (+3 more)

### Community 87 - "fmt"
Cohesion: 0.23
Nodes (12): AmountSummary(), AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS (+4 more)

### Community 88 - "useOcrWizard.ts"
Cohesion: 0.35
Nodes (9): OcrDraftState, CcDraft, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+1 more)

### Community 103 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 104 - "useOcrExtraction.ts"
Cohesion: 0.29
Nodes (9): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, persistScanForMapping() (+1 more)

### Community 105 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 106 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 107 - "MaintenancePage.tsx"
Cohesion: 0.36
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, EmailSettings, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE

### Community 109 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

## Knowledge Gaps
- **503 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+498 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `CreditOrdersPage.tsx`, `LLMLogsPage.tsx`, `useAPInvoice.ts`, `APLineItemsTable.tsx`, `NotificationBell.tsx`, `TutorialModal.tsx`, `Overview.tsx`, `ManualScan.tsx`, `AppHeader.tsx`, `PendingOrderBanner.test.tsx`, `OrderWorkspace.tsx`, `OrderHistory.tsx`, `apiFetch`, `QuotaModulesPage.tsx`, `useAPExtraction.ts`, `ProformaDocument.tsx`, `AccountMappingTable.tsx`, `APAmountSummary.tsx`, `useOcrWizard`, `MainMappingTable.tsx`, `APInvoice.tsx`, `ReviewQueue.tsx`, `adminFetch`, `FeatureFlows.tsx`, `Pricing.tsx`, `useNotifications.ts`, `PeriodPicker.tsx`, `TKey`, `date.ts`, `banks.ts`, `TenantsPage.tsx`, `OrderActions.tsx`, `QueueRow.tsx`, `OrderDrawer.tsx`, `useAPSubmission.ts`, `AdminLogin.tsx`, `DocumentPreview.tsx`, `LanguageContext.tsx`, `Mapping.tsx`, `DataTable.tsx`, `useAPExtraction.test.ts`, `client.ts`, `InputTaxReconciliation.tsx`, `APReviewStep.tsx`, `CreditsPage.tsx`, `ReviewDocument.tsx`, `ExtractionsPage.tsx`, `AdminUsersPage.tsx`, `PlanCard.tsx`, `fmt`, `APAccountMappingStep.tsx`, `ArCustomerProfiles.tsx`, `MaintenancePage.tsx`?**
  _High betweenness centrality (0.237) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useAPInvoice.ts`, `useOcrExtraction.ts`, `ReviewDocument.tsx`, `EmailSettings.tsx`, `useFileUpload.ts`, `useOcrExtraction`, `useAPSubmission.ts`, `AuthContext.tsx`, `useOcrWizard.ts`, `useOcrWizard`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useAPInvoice.ts`, `useFileUpload.ts`, `useMapping.ts`, `OrderHistory.tsx`, `showToast`, `useAPExtraction.ts`, `ocr.ts`, `ReviewQueue.tsx`, `Pricing.tsx`, `useNotifications.ts`, `api.ts`, `useOcrExtraction`, `useAPSubmission.ts`, `useAPExtraction.test.ts`, `useMappingData.ts`, `client.ts`, `InputTaxReconciliation.tsx`, `ReviewDocument.tsx`, `useUserConsent.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _503 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._
- **Should `main.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10822510822510822 - nodes in this community are weakly interconnected._
- **Should `NotificationBell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._