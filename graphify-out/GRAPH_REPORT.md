# Graph Report - OCR  (2026-09-08)

## Corpus Check
- 299 files · ~240,092 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1759 nodes · 4956 edges · 109 communities (95 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `502bc79f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- emailReview.ts
- TutorialModal.tsx
- ccJv.ts
- NotificationBell.tsx
- useT
- useMapping.ts
- DataTable.tsx
- FeatureFlows.tsx
- useAPInvoice.ts
- LanguageContext.tsx
- APAccountMappingStep.tsx
- screens.tsx
- date.ts
- useOcrWizard
- banks.ts
- ReviewQueue.tsx
- compilerOptions
- 5. Components
- AppHeader.tsx
- client.ts
- devDependencies
- QueueRow.tsx
- getCarmenUrl
- APReviewStep.tsx
- emailAutomation.ts
- APAmountSummary.tsx
- formatThb
- ocr.ts
- adminClient.ts
- QuotaModulesPage.tsx
- DetailTable.tsx
- main.tsx
- TenantsPage.tsx
- OrderHistory.tsx
- routes.tsx
- ExtractionsPage.tsx
- useFileUpload.ts
- apiFetch
- dependencies
- Button.tsx
- api.ts
- EmailAutomationPage.tsx
- useUserConsent.ts
- SlipUpload.tsx
- ProformaDocument.tsx
- useAPExtraction.ts
- useAPExtraction.test.ts
- MainMappingTable.tsx
- usePdfPasswordPrompt
- PeriodPicker.tsx
- ReviewDocument.test.tsx
- AccountingReview.tsx
- Pricing.tsx
- OrderTable.tsx
- OrderWorkspace.tsx
- AuthContext.tsx
- Skeleton.tsx
- useOcrSubmission.test.ts
- credits.ts
- scripts
- appKey
- DocumentPreview.tsx
- JvEditor.tsx
- APGroupModal.tsx
- ReviewDocument.tsx
- compilerOptions
- TKey
- apInvoice.ts
- ErrorBoundary
- MetricChartImpl.tsx
- CLAUDE.md
- Contributing
- APInvoice.tsx
- useOcrWizard.ts
- ProtectedRoute.tsx
- useNotifications.test.ts
- TenantSelector.test.tsx
- MaintenanceGate.tsx
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
- showToast
- vite.config.ts
- ReviewQueue.test.tsx
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts

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
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/APGroupModal.tsx → frontend/src/types/ap.ts

## Import Cycles
- None detected.

## Communities (109 total, 14 thin omitted)

### Community 0 - "emailReview.ts"
Cohesion: 0.19
Nodes (16): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, getReviewStatus() (+8 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.16
Nodes (14): CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY, consolidated() (+6 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.12
Nodes (26): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), Props (+18 more)

### Community 4 - "useT"
Cohesion: 0.11
Nodes (18): BatchActionBar(), Props, slipIsPdf(), SlipViewer(), FormActions(), Props, BankDetectionBanner(), ExtractionWarningBanner() (+10 more)

### Community 5 - "useMapping.ts"
Cohesion: 0.17
Nodes (14): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingSuggestions() (+6 more)

### Community 6 - "DataTable.tsx"
Cohesion: 0.07
Nodes (46): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, endOfDay() (+38 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.16
Nodes (26): AmountSummary(), TaxPctCell(), AccountingReview(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), BANK_INFO (+18 more)

### Community 9 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (20): failedRow, items, markRead, orderRow, postedRow, releaseRow, MAP, OrderStatusBadge() (+12 more)

### Community 10 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

### Community 11 - "screens.tsx"
Cohesion: 0.12
Nodes (17): DEFAULT_STEPS, Props, Step, StepWizard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO (+9 more)

### Community 12 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 13 - "useOcrWizard"
Cohesion: 0.23
Nodes (15): getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword(), reExtract(), resetAll(), runEncryptedExtraction() (+7 more)

### Community 14 - "banks.ts"
Cohesion: 0.11
Nodes (20): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_KEYWORDS, BANK_SOURCE_MAP, BankEntry, BankInfo, BANKS (+12 more)

### Community 15 - "ReviewQueue.tsx"
Cohesion: 0.15
Nodes (11): T, UsageIndicator(), useAuth(), ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL (+3 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (9): AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), AdminLayout() (+1 more)

### Community 19 - "client.ts"
Cohesion: 0.16
Nodes (15): base, Usage, CarmenSSOState, useCarmenSSO(), exchangeSSOToken(), UsageData, API_BASE, ApiClientOptions (+7 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+4 more)

### Community 22 - "getCarmenUrl"
Cohesion: 0.13
Nodes (17): Props, VendorSearch(), Badge(), BadgeVariant, Props, Coords, getCoords(), Props (+9 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (24): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+16 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+18 more)

### Community 25 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 26 - "formatThb"
Cohesion: 0.17
Nodes (17): PackList(), Props, EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS, BillingFigure() (+9 more)

### Community 27 - "ocr.ts"
Cohesion: 0.21
Nodes (9): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractedRow, extractFromFile(), ExtractResult (+1 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.06
Nodes (71): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, OrderKpiCards(), AdminAuthContext, AdminAuthContextValue (+63 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (28): Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+20 more)

### Community 30 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 31 - "main.tsx"
Cohesion: 0.17
Nodes (12): AdminProtectedRoute(), PageSkeleton(), useAdminAuth(), container, getRoute(), Mapping, OrderHistory, OrderReviewShell (+4 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.23
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), fetchTenants(), TenantDetail, funnel(), median(), quotaTier() (+2 more)

### Community 33 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (20): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), ActiveSubscription (+12 more)

### Community 34 - "routes.tsx"
Cohesion: 0.14
Nodes (16): adminLogin(), AdminLoginError, AdminRouter, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+8 more)

### Community 35 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime(), causeLabel(), classify(), ERROR_RULES (+6 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.19
Nodes (7): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 37 - "apiFetch"
Cohesion: 0.11
Nodes (30): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+22 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 40 - "api.ts"
Cohesion: 0.11
Nodes (19): APVendorMapping, APVendorMappingResponse, ConfigPatch, suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, AccountingConfigResponse (+11 more)

### Community 41 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 42 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+2 more)

### Community 43 - "SlipUpload.tsx"
Cohesion: 0.40
Nodes (4): ACCEPTED, Props, SlipUpload(), MAX_FILE_SIZE_MB

### Community 44 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 45 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (25): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), APSubmissionProps, GLAccount (+17 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.15
Nodes (25): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption (+17 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (33): Column, daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+25 more)

### Community 50 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 51 - "AccountingReview.tsx"
Cohesion: 0.12
Nodes (22): DEFAULT_EMPTY_OBJECT, Props, BANK_LOGOS, Props, DetailRow, Props, Props, Props (+14 more)

### Community 52 - "Pricing.tsx"
Cohesion: 0.13
Nodes (27): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PLAN_META, CheckoutPhase, CheckoutSession (+19 more)

### Community 53 - "OrderTable.tsx"
Cohesion: 0.08
Nodes (29): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Props (+21 more)

### Community 54 - "OrderWorkspace.tsx"
Cohesion: 0.14
Nodes (21): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial, wsReducer() (+13 more)

### Community 55 - "AuthContext.tsx"
Cohesion: 0.18
Nodes (15): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), clearToken() (+7 more)

### Community 56 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (16): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+8 more)

### Community 58 - "credits.ts"
Cohesion: 0.23
Nodes (10): OPEN_STATUSES, OrderHistoryState, useOrderHistory(), BuyerInfo, CompanyProfile, CreditOrder, listOrders(), OPEN_ORDER_STATUSES (+2 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "appKey"
Cohesion: 0.17
Nodes (21): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+13 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "JvEditor.tsx"
Cohesion: 0.23
Nodes (10): BlockReason, BU_WIDE, JvEditor(), JvState, Overrides, rowId(), JvHeaderCard(), Props (+2 more)

### Community 63 - "APGroupModal.tsx"
Cohesion: 0.60
Nodes (5): APGroupModal(), profileLabel(), Props, apGroupKey(), effectiveTaxProfile()

### Community 64 - "ReviewDocument.tsx"
Cohesion: 0.18
Nodes (16): patchAccountingConfig(), approveDocument(), getPending(), rejectDocument(), toExtractedRows(), applyJvAmount(), FIX, REASON_KEY (+8 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "TKey"
Cohesion: 0.22
Nodes (10): BatchAction, TKey, Home, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module (+2 more)

### Community 67 - "apInvoice.ts"
Cohesion: 0.12
Nodes (25): Props, COLS, Props, REQUIRED_FIELDS, Props, AP_STEPS, APFieldKey, APInvoiceHeader (+17 more)

### Community 68 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 69 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "APInvoice.tsx"
Cohesion: 0.12
Nodes (13): APFieldMappingStep(), APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, CustomModal(), ModalType, Props (+5 more)

### Community 73 - "useOcrWizard.ts"
Cohesion: 0.44
Nodes (7): clearAllDrafts(), clearDraft(), DraftKind, Envelope, keyFor(), loadDraft(), saveDraft()

### Community 74 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 75 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 77 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

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

### Community 94 - "showToast"
Cohesion: 0.21
Nodes (7): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), handleSubmitFinal(), showToast()

## Knowledge Gaps
- **497 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+492 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `TutorialModal.tsx`, `NotificationBell.tsx`, `useMapping.ts`, `DataTable.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `LanguageContext.tsx`, `APAccountMappingStep.tsx`, `screens.tsx`, `useOcrWizard`, `ReviewQueue.tsx`, `AppHeader.tsx`, `QueueRow.tsx`, `getCarmenUrl`, `APReviewStep.tsx`, `APAmountSummary.tsx`, `formatThb`, `adminClient.ts`, `QuotaModulesPage.tsx`, `DetailTable.tsx`, `main.tsx`, `TenantsPage.tsx`, `OrderHistory.tsx`, `routes.tsx`, `ExtractionsPage.tsx`, `EmailAutomationPage.tsx`, `SlipUpload.tsx`, `ProformaDocument.tsx`, `useAPExtraction.ts`, `MainMappingTable.tsx`, `PeriodPicker.tsx`, `AccountingReview.tsx`, `Pricing.tsx`, `OrderTable.tsx`, `OrderWorkspace.tsx`, `credits.ts`, `DocumentPreview.tsx`, `JvEditor.tsx`, `APGroupModal.tsx`, `ReviewDocument.tsx`, `TKey`, `apInvoice.ts`, `MetricChartImpl.tsx`, `APInvoice.tsx`, `MaintenanceGate.tsx`?**
  _High betweenness centrality (0.243) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useFileUpload.ts`, `useT`, `useAPInvoice.ts`, `useOcrWizard.ts`, `usePdfPasswordPrompt`, `AccountingReview.tsx`, `showToast`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `appKey()` connect `appKey` to `useT`, `useMapping.ts`, `useAPInvoice.ts`, `useOcrWizard.ts`, `useAPExtraction.ts`, `useAPExtraction.test.ts`, `useOcrWizard`, `AccountingReview.tsx`, `AuthContext.tsx`, `showToast`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _497 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `NotificationBell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12063492063492064 - nodes in this community are weakly interconnected._
- **Should `useT` be split into smaller, more focused modules?**
  _Cohesion score 0.10837438423645321 - nodes in this community are weakly interconnected._