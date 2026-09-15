# Graph Report - OCR  (2026-09-15)

## Corpus Check
- 314 files · ~256,719 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1855 nodes · 5273 edges · 109 communities (95 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22435e43`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- TutorialModal.tsx
- ccJv.ts
- useNotifications.ts
- PendingOrderBanner.test.tsx
- banks.ts
- DataTable.tsx
- FeatureFlows.tsx
- parseNum
- AdminRouter.tsx
- APInvoice.tsx
- screens.tsx
- PeriodPicker.tsx
- useOcrExtraction.ts
- emailReview.ts
- Pager.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ReviewDocument.tsx
- devDependencies
- QueueRow.tsx
- config.ts
- APReviewStep.tsx
- useEmailSettings.ts
- useAPInvoice.ts
- Pricing.tsx
- arReconcile.ts
- EmailAutomationPage.tsx
- QuotaModulesPage.tsx
- getCarmenUrl
- useAPValidation.ts
- APLineItem
- AccountingReview.tsx
- LanguageProvider
- NotificationBell.tsx
- useAPExtraction.ts
- apiFetch
- dependencies
- adminClient.ts
- api.ts
- main.tsx
- useNotifications.test.ts
- ARReviewPane.tsx
- OrderHistory.tsx
- OrderWorkspace.tsx
- useAPExtraction.test.ts
- FieldMapping
- usePdfPasswordPrompt
- DocumentPreview.tsx
- eslint-plugin-react-hooks
- TKey
- SlipUpload.tsx
- AppHeader.tsx
- TenantSelector.test.tsx
- AuthContext.tsx
- APAmountSummary.tsx
- CustomModal.tsx
- credits.ts
- scripts
- storage.ts
- OrderTable.tsx
- @testing-library/dom
- AdminLogin.tsx
- ManualScan.tsx
- compilerOptions
- dict.ts
- useMapping.ts
- date.ts
- useT
- CLAUDE.md
- Contributing
- showToast
- client.ts
- ErrorBoundary
- PaymentTypeModal.test.tsx
- APAccountMappingStep.tsx
- AppHeader.test.tsx
- @types/react
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
- AdminAuthContext.tsx
- vercel.json
- Architecture
- vite
- vite.config.ts
- releaseNotes.ts
- @vitejs/plugin-react
- jsdom
- notifications.ts
- @testing-library/jest-dom
- @testing-library/react
- vitest
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `apiFetch` - 60 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 42 edges
6. `appKey()` - 33 edges
7. `TKey` - 29 edges
8. `showToast()` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `FieldMapping` - 28 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/components/admin/BatchActionBar.tsx → frontend/src/i18n/dict.ts
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

## Communities (109 total, 14 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (10): carmenSettingsUrl(), ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty() (+2 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (30): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify() (+22 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.12
Nodes (18): codeToSource(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows() (+10 more)

### Community 3 - "useNotifications.ts"
Cohesion: 0.29
Nodes (10): releaseRow(), useNotifications(), listNotifications(), markNotificationsRead(), markReleaseSeen(), readReleaseSeen(), RELEASE_SEEN_EVENT, WHATS_NEW_RETURN_KEY (+2 more)

### Community 4 - "PendingOrderBanner.test.tsx"
Cohesion: 0.20
Nodes (7): SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), CreditOrder, listOrders(), OPEN_ORDER_STATUSES

### Community 5 - "banks.ts"
Cohesion: 0.12
Nodes (26): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO (+18 more)

### Community 6 - "DataTable.tsx"
Cohesion: 0.07
Nodes (58): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, endOfDay() (+50 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "parseNum"
Cohesion: 0.25
Nodes (14): AmountSummary(), AccountingReview(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), fetchTaxProfiles(), APTaxType (+6 more)

### Community 9 - "AdminRouter.tsx"
Cohesion: 0.27
Nodes (10): AdminProtectedRoute(), useAdminAuth(), AdminRouter, AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES (+2 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props (+10 more)

### Community 11 - "screens.tsx"
Cohesion: 0.10
Nodes (20): DEFAULT_STEPS, Props, Step, StepWizard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO (+12 more)

### Community 12 - "PeriodPicker.tsx"
Cohesion: 0.13
Nodes (29): MetricChart(), daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+21 more)

### Community 13 - "useOcrExtraction.ts"
Cohesion: 0.12
Nodes (18): Props, DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps, extractFromFile (+10 more)

### Community 14 - "emailReview.ts"
Cohesion: 0.26
Nodes (13): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getReviewStatus(), listActivity() (+5 more)

### Community 15 - "Pager.tsx"
Cohesion: 0.20
Nodes (6): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Props, SIZE_OPTIONS

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
Cohesion: 0.13
Nodes (23): BlockReason, BU_WIDE, JvEditor(), JvState, Overrides, Props, rowId(), JvHeaderCard() (+15 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, @eslint/js, devDependencies, autoprefixer, eslint, @eslint/js, globals (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.29
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 22 - "config.ts"
Cohesion: 0.10
Nodes (22): APVendorProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail (+14 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (19): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+11 more)

### Community 24 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (42): Button(), ButtonProps, Variant, VARIANT_CLASS, Switch(), SwitchProps, Draft, EmailSettingsController (+34 more)

### Community 25 - "useAPInvoice.ts"
Cohesion: 0.27
Nodes (13): useAPInvoice(), reconcileRows(), repairDocFigure(), useAPVendor(), saveAPVendorMapping(), clearAllDrafts(), clearDraft(), DraftKind (+5 more)

### Community 26 - "Pricing.tsx"
Cohesion: 0.12
Nodes (23): AppHeader(), PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS (+15 more)

### Community 27 - "arReconcile.ts"
Cohesion: 0.09
Nodes (32): ARJvPreview(), money(), Props, ARMappingTable(), Props, Props, Badge(), BadgeVariant (+24 more)

### Community 28 - "EmailAutomationPage.tsx"
Cohesion: 0.13
Nodes (16): EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps, EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth (+8 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.13
Nodes (23): KPICard(), KPICardProps, Card(), CardProps, PageHeader(), PageHeaderProps, buildQs(), fetchAlerts() (+15 more)

### Community 30 - "getCarmenUrl"
Cohesion: 0.25
Nodes (9): ExtractionWarningBanner(), RowAction(), FIX, fixLinkProps(), REASON_KEY, SETTINGS, warningText(), WITH_DETAIL (+1 more)

### Community 31 - "useAPValidation.ts"
Cohesion: 0.21
Nodes (11): Props, APInvoiceHeader, getAvailableFields(), adjustField(), APValidationProps, DocRepair, EMPTY_HEADER, header() (+3 more)

### Community 32 - "APLineItem"
Cohesion: 0.26
Nodes (11): Props, APGroupModal(), profileLabel(), Props, APDraftState, ApDraft, apGroupKey(), buildGroupedRow() (+3 more)

### Community 33 - "AccountingReview.tsx"
Cohesion: 0.15
Nodes (15): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps, SwapLabel() (+7 more)

### Community 34 - "LanguageProvider"
Cohesion: 0.20
Nodes (8): failedRow, items, markRead, orderRow, postedRow, releaseRow, LanguageProvider(), readLang()

### Community 35 - "NotificationBell.tsx"
Cohesion: 0.24
Nodes (10): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), STAGE_KEY (+2 more)

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.09
Nodes (26): base, Usage, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction() (+18 more)

### Community 37 - "apiFetch"
Cohesion: 0.12
Nodes (33): APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+25 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.07
Nodes (70): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, OrderKpiCards(), useOrderActions(), withName() (+62 more)

### Community 40 - "api.ts"
Cohesion: 0.14
Nodes (13): AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse, ExtractedAPInvoiceData, ExtractedCreditCardData (+5 more)

### Community 41 - "main.tsx"
Cohesion: 0.20
Nodes (9): PageSkeleton(), container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory, Pricing (+1 more)

### Community 42 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 43 - "ARReviewPane.tsx"
Cohesion: 0.13
Nodes (18): AccountMappingTable(), GLAccount, ARReviewPane(), Pickers(), labelOf(), CustomSearchSelect(), Props, SelectOption (+10 more)

### Community 44 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (29): MAP, OrderStatusBadge(), OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), expiryDate() (+21 more)

### Community 45 - "OrderWorkspace.tsx"
Cohesion: 0.17
Nodes (18): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial, wsReducer() (+10 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.14
Nodes (14): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+6 more)

### Community 47 - "FieldMapping"
Cohesion: 0.23
Nodes (19): AISuggestBar(), Props, MappingRowVariant, Props, Props, Props, ActiveScan, MainMappings (+11 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 51 - "TKey"
Cohesion: 0.20
Nodes (11): TKey, Home, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants (+3 more)

### Community 52 - "SlipUpload.tsx"
Cohesion: 0.29
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 53 - "AppHeader.tsx"
Cohesion: 0.33
Nodes (6): Props, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell

### Community 55 - "AuthContext.tsx"
Cohesion: 0.10
Nodes (26): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), AuthContext (+18 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 57 - "CustomModal.tsx"
Cohesion: 0.22
Nodes (7): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, REASON_KEY, OCR_BANK_MAP

### Community 58 - "credits.ts"
Cohesion: 0.12
Nodes (29): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, RowState, CheckoutPhase, CheckoutSession (+21 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "storage.ts"
Cohesion: 0.12
Nodes (23): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), persistScanForMapping(), OcrSubmissionHook (+15 more)

### Community 61 - "OrderTable.tsx"
Cohesion: 0.06
Nodes (37): BatchAction, BatchActionBar(), Props, ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions() (+29 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.29
Nodes (8): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss(), AdminLogin

### Community 64 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (18): ExtractionSkeleton(), BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "dict.ts"
Cohesion: 0.20
Nodes (9): INSTRUCTIONS, Props, UploadSection(), DICT, en, Lang, th, translate() (+1 more)

### Community 67 - "useMapping.ts"
Cohesion: 0.27
Nodes (9): COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingData(), useMappingSuggestions(), ModalConfig, saveAccountingConfig(), mergeSuggestion() (+1 more)

### Community 68 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 69 - "useT"
Cohesion: 0.11
Nodes (20): DateRangePicker(), DateRangePickerProps, LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps (+12 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "showToast"
Cohesion: 0.15
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), useOcrWizard() (+11 more)

### Community 73 - "client.ts"
Cohesion: 0.09
Nodes (34): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+26 more)

### Community 74 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "APAccountMappingStep.tsx"
Cohesion: 0.11
Nodes (17): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+9 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.25
Nodes (9): Column, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

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
Cohesion: 0.43
Nodes (6): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), AdminUser, getAdminToken(), storeAdminToken()

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 96 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 100 - "notifications.ts"
Cohesion: 0.32
Nodes (6): Props, ActivityPage, BellItem, Notification, NotificationList, Page

## Knowledge Gaps
- **516 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+511 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `TutorialModal.tsx`, `useNotifications.ts`, `PendingOrderBanner.test.tsx`, `DataTable.tsx`, `FeatureFlows.tsx`, `parseNum`, `AdminRouter.tsx`, `APInvoice.tsx`, `screens.tsx`, `PeriodPicker.tsx`, `Pager.tsx`, `ReviewDocument.tsx`, `QueueRow.tsx`, `config.ts`, `APReviewStep.tsx`, `useAPInvoice.ts`, `Pricing.tsx`, `EmailAutomationPage.tsx`, `QuotaModulesPage.tsx`, `getCarmenUrl`, `useAPValidation.ts`, `APLineItem`, `AccountingReview.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `adminClient.ts`, `ARReviewPane.tsx`, `OrderHistory.tsx`, `OrderWorkspace.tsx`, `FieldMapping`, `DocumentPreview.tsx`, `TKey`, `SlipUpload.tsx`, `AppHeader.tsx`, `AuthContext.tsx`, `APAmountSummary.tsx`, `CustomModal.tsx`, `credits.ts`, `OrderTable.tsx`, `AdminLogin.tsx`, `ManualScan.tsx`, `dict.ts`, `useMapping.ts`, `showToast`, `client.ts`, `APAccountMappingStep.tsx`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useNotifications.ts`, `PendingOrderBanner.test.tsx`, `parseNum`, `useOcrExtraction.ts`, `emailReview.ts`, `ReviewDocument.tsx`, `config.ts`, `useAPInvoice.ts`, `arReconcile.ts`, `useAPExtraction.ts`, `ARReviewPane.tsx`, `OrderHistory.tsx`, `useAPExtraction.test.ts`, `FieldMapping`, `AuthContext.tsx`, `credits.ts`, `storage.ts`, `useMapping.ts`, `showToast`, `client.ts`, `notifications.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `appKey()` connect `storage.ts` to `ManualScan.tsx`, `useMapping.ts`, `useAPExtraction.ts`, `banks.ts`, `showToast`, `useOcrExtraction.ts`, `useAPExtraction.test.ts`, `AuthContext.tsx`, `useAPInvoice.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _516 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08792270531400966 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._