# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 373 files · ~254,034 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1967 nodes · 5368 edges · 147 communities (96 shown, 51 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8c925722`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ExtractionsPage.tsx
- APInvoice.tsx
- dict/index.ts
- carmen.ts
- DetailTable.tsx
- useT
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- AppHeader.tsx
- orders.ts
- CustomModal.tsx
- shared/api/credits.ts
- useMapping.ts
- useOcrSubmission.test.ts
- AccountingReview.tsx
- Pricing.tsx
- ProformaDocument.tsx
- MainMappingTable.tsx
- deptAccounts.ts
- compilerOptions
- 5. Components
- banks.ts
- useAPSubmission.ts
- OrderHistory.tsx
- devDependencies
- useOcrExtraction.ts
- adminFetch
- useMappingData.ts
- useOcrWizard
- OrderActions.tsx
- dependencies
- ReviewQueue.tsx
- emailReview.ts
- TopLevelConfigSection.tsx
- TenantSelector.test.tsx
- FeatureFlows.tsx
- AdminRouter.tsx
- NotificationBell.tsx
- useAPExtraction.ts
- routes.tsx
- OrderWorkspace.tsx
- ReviewDocument.tsx
- date.ts
- ManualScan.tsx
- TenantsPage.tsx
- ErrorBoundary
- usePdfPasswordPrompt
- AuthContext.tsx
- scripts
- DocumentPreview.tsx
- APAccountMappingStep.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- LanguageProvider
- UsageIndicator.tsx
- CLAUDE.md
- Contributing
- eslint
- LanguageContext.tsx
- main.tsx
- AdminLogin.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- OrderTable.test.tsx
- cc.ts
- BankDetectionBanner.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- apiFetch
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- Skeleton.tsx
- Mapping.tsx
- vercel.json
- Architecture
- useOcrWizard.ts
- i18n/index.ts
- dict/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Tooltip.tsx
- TKey
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- order.ts
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- QueueRow.tsx
- mockPaths.test.ts
- OrderTable.tsx
- DataTable.tsx
- adminUsers.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- eslint-plugin-react-hooks
- i18n/common.ts
- i18n/credits.ts
- extractions.ts
- orev.ts
- quotas.ts
- OrderDrawer.tsx
- contact.ts
- flows.ts
- pack.ts
- ReviewDocument.test.tsx
- pricing.ts
- notif.ts
- APAmountSummary.tsx
- qr.ts
- review.ts
- errors.ts
- whatsnew.ts
- slip.ts
- llmLogs.ts
- login.ts
- i18n/maintenance.ts
- i18n/nav.ts
- tutorial.ts
- sessions.ts
- dict/usage.ts
- i18n/tenants.ts
- i18n/usage.ts
- userUsage.ts
- dict/ap.ts
- checkout.ts
- home.ts
- plan.ts
- proforma.ts
- warn.ts
- @testing-library/jest-dom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `adminFetch` - 63 edges
3. `apiFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 34 edges
7. `appKey()` - 33 edges
8. `TKey` - 32 edges
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

## Communities (147 total, 51 thin omitted)

### Community 0 - "ExtractionsPage.tsx"
Cohesion: 0.11
Nodes (25): ExtractionFailureRow, Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Tab (+17 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (36): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+28 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, DICT, en, th, translate(), en, th (+6 more)

### Community 3 - "carmen.ts"
Cohesion: 0.12
Nodes (15): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+7 more)

### Community 4 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 5 - "useT"
Cohesion: 0.20
Nodes (30): Column, DataTable(), daysAgo(), endOfDay(), today(), ymd(), label(), Tenant (+22 more)

### Community 6 - "parseNum"
Cohesion: 0.17
Nodes (29): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+21 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, PurchaseTutorial, Spot() (+19 more)

### Community 8 - "screens.tsx"
Cohesion: 0.12
Nodes (18): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+10 more)

### Community 9 - "api.ts"
Cohesion: 0.10
Nodes (23): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, PaymentTypesHook, AccountingConfigHook, MAIN_KEYS, readFromLocalStorage() (+15 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.25
Nodes (5): Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), isDarkNow(), useDarkMode()

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "CustomModal.tsx"
Cohesion: 0.15
Nodes (10): ACCEPTED, Props, SlipUpload(), SLIP, CustomModal(), ModalType, Props, baseProps (+2 more)

### Community 13 - "shared/api/credits.ts"
Cohesion: 0.13
Nodes (24): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+16 more)

### Community 14 - "useMapping.ts"
Cohesion: 0.25
Nodes (10): getAccountingConfig, seedOcrBranch(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingSuggestions(), usePaymentTypes(), saveAccountingConfig() (+2 more)

### Community 15 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (18): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), CarmenJvPayload, defaultConfig, defaultRows (+10 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.08
Nodes (39): ItxOverrides, AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, Props, BlockReason (+31 more)

### Community 17 - "Pricing.tsx"
Cohesion: 0.10
Nodes (33): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PackList(), Props, EnterpriseCard() (+25 more)

### Community 18 - "ProformaDocument.tsx"
Cohesion: 0.25
Nodes (11): PaymentInfo, expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 19 - "MainMappingTable.tsx"
Cohesion: 0.33
Nodes (12): Props, Props, ActiveScan, MainMappings, MasterAccount, MasterDepartment, MainMappingKey, MappingSuggestionsProps (+4 more)

### Community 20 - "deptAccounts.ts"
Cohesion: 0.21
Nodes (14): AccountMappingTable(), GLAccount, suggestPaymentTypes(), JvEditor(), MainMappingTable(), PaymentTypeModal(), AccountLike, accountName() (+6 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "banks.ts"
Cohesion: 0.15
Nodes (22): BankConfigHook, useBankConfig(), persistScanForMapping(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape() (+14 more)

### Community 24 - "useAPSubmission.ts"
Cohesion: 0.15
Nodes (21): Props, Props, Props, Props, Props, VendorSearch(), APInvoiceHeader, ApDraft (+13 more)

### Community 25 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (18): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+10 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "useOcrExtraction.ts"
Cohesion: 0.12
Nodes (20): rejectDocument(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps, extractFromFile (+12 more)

### Community 28 - "adminFetch"
Cohesion: 0.05
Nodes (90): buildQs(), QueryParams, unwrapDetail(), adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger() (+82 more)

### Community 29 - "useMappingData.ts"
Cohesion: 0.33
Nodes (11): JvHeaderCard(), GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes() (+3 more)

### Community 30 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 34 - "emailReview.ts"
Cohesion: 0.24
Nodes (12): ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getPending(), listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+4 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.18
Nodes (8): BANK_OPTIONS, Props, TopLevelConfigSection(), CustomSearchSelect(), Props, SelectOption, TopChoice, BANK_CODE_MAP

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "AdminRouter.tsx"
Cohesion: 0.22
Nodes (12): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, registerDict() (+4 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (43): ActivityPage, WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList (+35 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (21): Args, APExtractionProps, EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES (+13 more)

### Community 41 - "routes.tsx"
Cohesion: 0.27
Nodes (11): fetchAlerts(), fetchUsageSummary(), granularityFor(), fmtCost(), fmtNum(), Overview(), Overview, getCols() (+3 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (11): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 43 - "ReviewDocument.tsx"
Cohesion: 0.22
Nodes (11): RowAction(), Props, ReviewDocument(), ExtractionWarningBanner(), Props, FIX, fixLinkProps(), REASON_KEY (+3 more)

### Community 44 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 45 - "ManualScan.tsx"
Cohesion: 0.18
Nodes (9): DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions() (+1 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.27
Nodes (8): fetchTenants(), KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

### Community 47 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 49 - "AuthContext.tsx"
Cohesion: 0.06
Nodes (49): exchangeSSOToken(), revokeSession(), CARMEN_RAW_TOKEN_KEY, clearToken(), storeToken(), getConsentStatus(), postConsent(), ConsentGate() (+41 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 52 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (20): DateRangePicker(), DateRangePickerProps, lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+12 more)

### Community 56 - "LanguageProvider"
Cohesion: 0.33
Nodes (5): MAP, OrderStatusBadge(), LanguageProvider(), readLang(), OrderStatus

### Community 57 - "UsageIndicator.tsx"
Cohesion: 0.19
Nodes (13): OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken(), getPaymentInfo(), T (+5 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "LanguageContext.tsx"
Cohesion: 0.13
Nodes (16): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+8 more)

### Community 62 - "main.tsx"
Cohesion: 0.20
Nodes (9): AdminRouter, APInvoice, container, getRoute(), Mapping, OrderHistory, Pricing, Router() (+1 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.32
Nodes (8): APGroupModal(), profileLabel(), Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 68 - "BankDetectionBanner.tsx"
Cohesion: 0.25
Nodes (5): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "apiFetch"
Cohesion: 0.09
Nodes (28): _fetchExtract(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+20 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 77 - "Mapping.tsx"
Cohesion: 0.31
Nodes (6): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, CompanyData, Mapping()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "useOcrWizard.ts"
Cohesion: 0.21
Nodes (12): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage() (+4 more)

### Community 81 - "i18n/index.ts"
Cohesion: 0.09
Nodes (12): en, th, adminDict, AdminKey, en, th, en, th (+4 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 88 - "TKey"
Cohesion: 0.15
Nodes (14): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+6 more)

### Community 103 - "QueueRow.tsx"
Cohesion: 0.29
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 106 - "DataTable.tsx"
Cohesion: 0.08
Nodes (23): DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS, Extra (+15 more)

### Community 108 - "emailAutomation.ts"
Cohesion: 0.09
Nodes (36): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+28 more)

### Community 117 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock()

### Community 121 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 124 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

## Knowledge Gaps
- **598 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+593 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ExtractionsPage.tsx`, `APInvoice.tsx`, `DetailTable.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `AppHeader.tsx`, `orders.ts`, `CustomModal.tsx`, `shared/api/credits.ts`, `AccountingReview.tsx`, `Pricing.tsx`, `ProformaDocument.tsx`, `MainMappingTable.tsx`, `deptAccounts.ts`, `useAPSubmission.ts`, `OrderHistory.tsx`, `adminFetch`, `useMappingData.ts`, `useOcrWizard`, `OrderActions.tsx`, `ReviewQueue.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `AdminRouter.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `routes.tsx`, `OrderWorkspace.tsx`, `ReviewDocument.tsx`, `ManualScan.tsx`, `TenantsPage.tsx`, `AuthContext.tsx`, `DocumentPreview.tsx`, `APAccountMappingStep.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `LanguageProvider`, `UsageIndicator.tsx`, `LanguageContext.tsx`, `AdminLogin.tsx`, `APGroupModal.tsx`, `BankDetectionBanner.tsx`, `Mapping.tsx`, `useOcrWizard.ts`, `TKey`, `QueueRow.tsx`, `OrderTable.tsx`, `DataTable.tsx`, `emailAutomation.ts`, `OrderDrawer.tsx`, `APAmountSummary.tsx`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useAPExtraction.ts`, `ManualScan.tsx`, `useOcrSubmission.test.ts`, `usePdfPasswordPrompt`, `useOcrWizard.ts`, `useOcrExtraction.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `API` connect `adminFetch` to `emailReview.ts`, `carmen.ts`, `NotificationBell.tsx`, `useAPExtraction.ts`, `api.ts`, `apiFetch`, `orders.ts`, `emailAutomation.ts`, `shared/api/credits.ts`, `useOcrSubmission.test.ts`, `AuthContext.tsx`, `useAPSubmission.ts`, `OrderHistory.tsx`, `AdminLogin.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _598 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ExtractionsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10685483870967742 - nodes in this community are weakly interconnected._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08865248226950355 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._