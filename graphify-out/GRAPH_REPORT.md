# Graph Report - OCR  (2026-09-16)

## Corpus Check
- 316 files · ~257,577 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1858 nodes · 5268 edges · 118 communities (102 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c432b446`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- TutorialModal.tsx
- ccJv.ts
- WhatsNew.tsx
- showToast
- useOcrExtraction.ts
- LanguageContext.tsx
- FeatureFlows.tsx
- useAPInvoice.ts
- AdminRouter.tsx
- APInvoice.tsx
- useT
- APGroupModal.tsx
- EmailSettings.tsx
- emailReview.ts
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ReviewDocument.tsx
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- APLineItemsTable.tsx
- useEmailSettings.ts
- useOcrWizard.ts
- DataTable.tsx
- useARReconcile.ts
- OrderHistory.tsx
- QuotaModulesPage.tsx
- APReviewStep.tsx
- Pricing.tsx
- useAPExtraction.ts
- InputTaxReconciliation.tsx
- NotificationBell.test.tsx
- NotificationBell.tsx
- useAPExtraction
- useAPSubmission.test.ts
- dependencies
- adminClient.ts
- api.ts
- formatThb
- useNotifications.test.ts
- deptAccounts.ts
- PendingOrderBanner.tsx
- OrderWorkspace.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- ocr.ts
- DocumentPreview.tsx
- ExtractionsPage.tsx
- TKey
- LanguageProvider
- main.tsx
- TenantSelector.test.tsx
- AuthContext.tsx
- APAmountSummary.tsx
- banks.ts
- credits.ts
- scripts
- useMapping.ts
- MetricChartImpl.tsx
- Skeleton.tsx
- APAccountMappingStep.tsx
- ManualScan.tsx
- compilerOptions
- dict.ts
- apiFetch
- date.ts
- OrderTable.tsx
- CLAUDE.md
- Contributing
- useOcrWizard
- client.ts
- useUserConsent.ts
- PaymentTypeModal.test.tsx
- Tooltip.tsx
- AppHeader.tsx
- useAuth
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
- AdminAuthContext.tsx
- @vitejs/plugin-react
- jsdom
- AdminLogin.tsx
- useNotifications.ts
- @testing-library/jest-dom
- ErrorBoundary
- NotificationDetailModal.tsx
- @testing-library/react
- vitest
- vite-env.d.ts
- ReviewQueue.test.tsx
- Carmen AI — OCR & Import System
- eslint
- AppHeader.test.tsx
- @types/react
- eslint-plugin-react-hooks

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
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
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/constants/apInvoice.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/APGroupModal.tsx → frontend/src/types/ap.ts
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts

## Import Cycles
- None detected.

## Communities (118 total, 16 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.20
Nodes (9): carmenSettingsUrl(), ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty() (+1 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.12
Nodes (18): OCR_BANK_MAP, descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows() (+10 more)

### Community 3 - "WhatsNew.tsx"
Cohesion: 0.50
Nodes (5): markReleaseSeen(), readReleaseSeen(), WHATS_NEW_RETURN_KEY, WhatsNew, WhatsNew()

### Community 4 - "showToast"
Cohesion: 0.12
Nodes (15): _fetchExtract(), extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData() (+7 more)

### Community 5 - "useOcrExtraction.ts"
Cohesion: 0.16
Nodes (12): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps (+4 more)

### Community 6 - "LanguageContext.tsx"
Cohesion: 0.08
Nodes (63): ServerTable, SortDir, daysAgo(), endOfDay(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS (+55 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.18
Nodes (24): AmountSummary(), AccountingReview(), InputTaxPanel(), Amount(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair (+16 more)

### Community 9 - "AdminRouter.tsx"
Cohesion: 0.24
Nodes (11): AdminProtectedRoute(), useAdminAuth(), AdminRouter, AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute() (+3 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.18
Nodes (13): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), AP_STEPS, APFieldKey, APStep (+5 more)

### Community 11 - "useT"
Cohesion: 0.09
Nodes (27): ContactBuyer(), FormActions(), Props, DEFAULT_STEPS, Props, Step, StepWizard(), PackList() (+19 more)

### Community 12 - "APGroupModal.tsx"
Cohesion: 0.33
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 13 - "EmailSettings.tsx"
Cohesion: 0.13
Nodes (13): Button(), ButtonProps, Variant, VARIANT_CLASS, seedDraft(), EmailRule, BLOCKER_TEXT, copy() (+5 more)

### Community 14 - "emailReview.ts"
Cohesion: 0.26
Nodes (13): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getReviewStatus(), listActivity() (+5 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

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
Cohesion: 0.08
Nodes (34): ARReviewPane(), labelOf(), Props, SwapLabel(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props (+26 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.31
Nodes (11): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+3 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (17): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+9 more)

### Community 23 - "APLineItemsTable.tsx"
Cohesion: 0.15
Nodes (17): Props, APTableFooter(), Props, APTableHeader(), Props, APTableRow(), FixedTaxSettings, Props (+9 more)

### Community 24 - "useEmailSettings.ts"
Cohesion: 0.15
Nodes (27): Draft, EmailSettingsController, EMPTY_DRAFT, EMPTY_RULE, RuleDraft, splitList(), loaded(), SETTINGS (+19 more)

### Community 25 - "useOcrWizard.ts"
Cohesion: 0.35
Nodes (9): OcrDraftState, CcDraft, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+1 more)

### Community 26 - "DataTable.tsx"
Cohesion: 0.14
Nodes (16): Column, DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), SKELETON_WIDTHS, fetchErrorBreakdown(), fetchTenantRanking() (+8 more)

### Community 27 - "useARReconcile.ts"
Cohesion: 0.09
Nodes (31): Switch(), SwitchProps, ARJvPreview(), money(), Props, ARMappingTable(), Props, Badge() (+23 more)

### Community 28 - "OrderHistory.tsx"
Cohesion: 0.16
Nodes (14): AppHeader(), Pager(), T, base, Usage, UsageIndicator(), getUsage(), UsageData (+6 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (29): MetricChart(), Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, buildQs() (+21 more)

### Community 30 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (14): APLineItemsTable(), APReviewStep(), Ctrl, HEADER_FIELDS(), Props, Props, VendorSearch(), ExtractionWarningBanner() (+6 more)

### Community 31 - "Pricing.tsx"
Cohesion: 0.15
Nodes (22): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, Props, EnterpriseCard(), PlanCard() (+14 more)

### Community 32 - "useAPExtraction.ts"
Cohesion: 0.18
Nodes (17): Props, Props, APInvoiceHeader, DEFAULT_MAPPINGS, APDraftState, APExtractionProps, EXTRACTION_STAGES, NUMERIC_FIELDS (+9 more)

### Community 33 - "InputTaxReconciliation.tsx"
Cohesion: 0.18
Nodes (11): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles() (+3 more)

### Community 34 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 35 - "NotificationBell.tsx"
Cohesion: 0.21
Nodes (11): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, LATEST_RELEASE, RELEASE_NOTES (+3 more)

### Community 36 - "useAPExtraction"
Cohesion: 0.15
Nodes (12): isNumFld(), useAPExtraction(), FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize() (+4 more)

### Community 37 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.08
Nodes (60): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, useOrderActions(), withName(), adminFetch (+52 more)

### Community 40 - "api.ts"
Cohesion: 0.13
Nodes (15): API, SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 41 - "formatThb"
Cohesion: 0.19
Nodes (16): OrderKpiCards(), num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate() (+8 more)

### Community 42 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 43 - "deptAccounts.ts"
Cohesion: 0.14
Nodes (16): AccountMappingTable(), GLAccount, Props, CustomSearchSelect(), Props, SelectOption, TopChoice, MappingRow() (+8 more)

### Community 44 - "PendingOrderBanner.tsx"
Cohesion: 0.21
Nodes (15): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), ENTERPRISE, isSubscriptionCode() (+7 more)

### Community 45 - "OrderWorkspace.tsx"
Cohesion: 0.17
Nodes (14): CompanyPanel(), OrderWorkspace(), WsAction, wsInitial, wsReducer(), slipIsPdf(), SlipViewer(), CreditLedgerEntry (+6 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.19
Nodes (23): AISuggestBar(), Props, MappingRowVariant, Props, Props, Props, GlMasters, ActiveScan (+15 more)

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+6 more)

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 50 - "ExtractionsPage.tsx"
Cohesion: 0.16
Nodes (17): DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime() (+9 more)

### Community 51 - "TKey"
Cohesion: 0.14
Nodes (15): BatchAction, BatchActionBar(), Props, TKey, seen, useEntrance(), NavItem, NavSection (+7 more)

### Community 52 - "LanguageProvider"
Cohesion: 0.12
Nodes (10): MAP, OrderStatusBadge(), SLIP, ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider() (+2 more)

### Community 53 - "main.tsx"
Cohesion: 0.18
Nodes (10): PageSkeleton(), container, EmailSettings, getRoute(), Home, ManualScan, Mapping, OrderHistory (+2 more)

### Community 55 - "AuthContext.tsx"
Cohesion: 0.15
Nodes (17): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), clearToken() (+9 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.17
Nodes (11): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Card(), Props (+3 more)

### Community 57 - "banks.ts"
Cohesion: 0.14
Nodes (19): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO, BANK_KEYWORDS, BankEntry, BankInfo, BANKS (+11 more)

### Community 58 - "credits.ts"
Cohesion: 0.12
Nodes (28): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+20 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.12
Nodes (26): BANK_SOURCE_MAP, AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, persistScanForMapping(), getAccountingConfig (+18 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 62 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 63 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 64 - "ManualScan.tsx"
Cohesion: 0.13
Nodes (18): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "dict.ts"
Cohesion: 0.14
Nodes (12): APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props, UploadSection(), DICT, en (+4 more)

### Community 67 - "apiFetch"
Cohesion: 0.27
Nodes (15): GLAccount, useAPSubmission(), prefetchGlMasters(), useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), submitAPInvoiceToCarmen() (+7 more)

### Community 68 - "date.ts"
Cohesion: 0.33
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 69 - "OrderTable.tsx"
Cohesion: 0.06
Nodes (35): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Props (+27 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard"
Cohesion: 0.20
Nodes (18): showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword() (+10 more)

### Community 73 - "client.ts"
Cohesion: 0.21
Nodes (13): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+5 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 77 - "AppHeader.tsx"
Cohesion: 0.33
Nodes (6): Props, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell

### Community 78 - "useAuth"
Cohesion: 0.11
Nodes (21): ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+13 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier() (+2 more)

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
Cohesion: 0.32
Nodes (7): RowAction(), FIX, fixLinkProps(), REASON_KEY, SETTINGS, WITH_DETAIL, getCarmenUrl()

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 96 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 99 - "AdminLogin.tsx"
Cohesion: 0.33
Nodes (7): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 100 - "useNotifications.ts"
Cohesion: 0.27
Nodes (9): releaseRow(), useNotifications(), ActivityPage, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+1 more)

### Community 102 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 103 - "NotificationDetailModal.tsx"
Cohesion: 0.50
Nodes (4): NotificationDetailModal(), Props, REASON_KEY, BellItem

## Knowledge Gaps
- **516 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+511 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `TutorialModal.tsx`, `WhatsNew.tsx`, `useOcrExtraction.ts`, `LanguageContext.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `AdminRouter.tsx`, `APInvoice.tsx`, `APGroupModal.tsx`, `EmailAutomationPage.tsx`, `ReviewDocument.tsx`, `QueueRow.tsx`, `APLineItemsTable.tsx`, `DataTable.tsx`, `OrderHistory.tsx`, `QuotaModulesPage.tsx`, `APReviewStep.tsx`, `Pricing.tsx`, `useAPExtraction.ts`, `InputTaxReconciliation.tsx`, `NotificationBell.tsx`, `useAPExtraction`, `adminClient.ts`, `formatThb`, `deptAccounts.ts`, `PendingOrderBanner.tsx`, `OrderWorkspace.tsx`, `MainMappingTable.tsx`, `DocumentPreview.tsx`, `ExtractionsPage.tsx`, `TKey`, `LanguageProvider`, `APAmountSummary.tsx`, `credits.ts`, `MetricChartImpl.tsx`, `APAccountMappingStep.tsx`, `ManualScan.tsx`, `dict.ts`, `OrderTable.tsx`, `useOcrWizard`, `client.ts`, `AppHeader.tsx`, `useAuth`, `TenantsPage.tsx`, `getCarmenUrl`, `AdminLogin.tsx`, `NotificationDetailModal.tsx`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `showToast`, `useAPInvoice.ts`, `emailReview.ts`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `useARReconcile.ts`, `APReviewStep.tsx`, `Pricing.tsx`, `useAPExtraction.ts`, `InputTaxReconciliation.tsx`, `useAPExtraction`, `useAPSubmission.test.ts`, `api.ts`, `PendingOrderBanner.tsx`, `useAPExtraction.test.ts`, `MainMappingTable.tsx`, `ocr.ts`, `credits.ts`, `useMapping.ts`, `useOcrWizard`, `client.ts`, `useUserConsent.ts`, `useNotifications.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `ReviewQueue.tsx`, `apiFetch`, `useAPExtraction`, `useAPSubmission.test.ts`, `useOcrExtraction.ts`, `useAPInvoice.ts`, `useOcrWizard`, `EmailSettings.tsx`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `AuthContext.tsx`, `useOcrWizard.ts`, `APReviewStep.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _516 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12318840579710146 - nodes in this community are weakly interconnected._
- **Should `showToast` be split into smaller, more focused modules?**
  _Cohesion score 0.11857707509881422 - nodes in this community are weakly interconnected._