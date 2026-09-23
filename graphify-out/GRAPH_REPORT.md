# Graph Report - OCR  (2026-09-23)

## Corpus Check
- 305 files · ~246,644 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1785 nodes · 5043 edges · 103 communities (89 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `15859d9e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- client.ts
- adminClient.ts
- main.tsx
- PeriodPicker.tsx
- useAPInvoice.ts
- APReviewStep.tsx
- NotificationBell.tsx
- TutorialModal.tsx
- Overview.tsx
- ManualScan.tsx
- AppHeader.tsx
- AccountingReview.tsx
- emailAutomation.ts
- credits.ts
- useAPExtraction.ts
- useMapping.ts
- OrderWorkspace.tsx
- useT
- OrderHistory.tsx
- Pricing.tsx
- useOcrSubmission.test.ts
- compilerOptions
- 5. Components
- ExtractionsPage.tsx
- DetailTable.tsx
- ProformaDocument.tsx
- devDependencies
- Mapping.tsx
- useOcrWizard.ts
- APAmountSummary.tsx
- useOcrWizard
- MainMappingTable.tsx
- dependencies
- APInvoice.tsx
- emailReview.ts
- EmailAutomationPage.tsx
- FeatureFlows.tsx
- OrderTable.tsx
- CheckoutFlow.tsx
- OrderStatusBadge.tsx
- api.ts
- ReviewQueue.tsx
- TKey
- date.ts
- getCarmenUrl
- useCamera.ts
- TenantsPage.tsx
- OrderActions.tsx
- QueueRow.tsx
- useOcrExtraction.ts
- scripts
- OrderDrawer.tsx
- useAPSubmission.ts
- AdminLogin.tsx
- compilerOptions
- DocumentPreview.tsx
- LanguageContext.tsx
- AdminAuthContext.tsx
- CLAUDE.md
- Contributing
- ErrorBoundary
- DataTable.tsx
- useAPExtraction.test.ts
- apiFetch
- ReviewDocument.test.tsx
- Carmen AI — OCR & Import System
- AccountMappingTable.tsx
- PDFPageSelector
- useOcrExtraction.test.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- CreditsPage.tsx
- ReviewDocument.tsx
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- DataTable.test.tsx
- PurchaseTutorial.tsx
- vercel.json
- Architecture
- Button.tsx
- OrderTable.test.tsx
- Carmen AI — OCR & Import System
- AppHeader.test.tsx
- vite.config.ts
- eslint
- eslint-plugin-react-hooks
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- @testing-library/jest-dom
- typescript
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
7. `TKey` - 30 edges
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

## Communities (103 total, 14 thin omitted)

### Community 0 - "client.ts"
Cohesion: 0.05
Nodes (59): AppHeader(), ConsentGate(), Props, countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute() (+51 more)

### Community 1 - "adminClient.ts"
Cohesion: 0.07
Nodes (63): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, useOrderActions(), withName(), adminFetch (+55 more)

### Community 2 - "main.tsx"
Cohesion: 0.18
Nodes (13): AdminProtectedRoute(), PageSkeleton(), useAdminAuth(), AdminRouter, container, getRoute(), ManualScan, OrderHistory (+5 more)

### Community 3 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (36): Column, daysAgo(), endOfDay(), matchPreset(), Period, PeriodPicker(), PRESET_DAYS, PresetId (+28 more)

### Community 4 - "useAPInvoice.ts"
Cohesion: 0.14
Nodes (31): AmountSummary(), APGroupModal(), profileLabel(), Props, InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount() (+23 more)

### Community 5 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (23): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+15 more)

### Community 6 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (41): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), failedRow (+33 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.24
Nodes (11): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+3 more)

### Community 8 - "Overview.tsx"
Cohesion: 0.07
Nodes (43): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+35 more)

### Community 9 - "ManualScan.tsx"
Cohesion: 0.11
Nodes (21): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, Props, BANK_LOGOS, BankDetectionBanner() (+13 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.25
Nodes (9): Props, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell, AdminLayout(), getActiveHash() (+1 more)

### Community 11 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (26): AccountingReview(), DEFAULT_EMPTY_OBJECT, OCR_BANK_MAP, codeToDisplayName(), codeToSource(), descriptionForBank(), getBankInfo(), getGLSourceCode() (+18 more)

### Community 12 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+18 more)

### Community 13 - "credits.ts"
Cohesion: 0.15
Nodes (11): PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, BuyerInfo, CompanyProfile, CreditOrder, listOrders() (+3 more)

### Community 14 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (22): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload() (+14 more)

### Community 15 - "useMapping.ts"
Cohesion: 0.15
Nodes (23): BANK_SOURCE_MAP, AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), getAccountingConfig (+15 more)

### Community 16 - "OrderWorkspace.tsx"
Cohesion: 0.15
Nodes (15): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial, wsReducer() (+7 more)

### Community 17 - "useT"
Cohesion: 0.11
Nodes (26): OrderKpiCards(), FormActions(), Props, PackList(), Props, PlanCard(), DEMO_BUYER, DEMO_ORDER (+18 more)

### Community 18 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (24): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, LITE, catalogName(), isSubscriptionCode() (+16 more)

### Community 19 - "Pricing.tsx"
Cohesion: 0.12
Nodes (30): Props, EnterpriseCard(), PlanCardProps, TIER_ICONS, ENTERPRISE, PackPresentation, CheckoutPhase, CheckoutSession (+22 more)

### Community 20 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (19): OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "ExtractionsPage.tsx"
Cohesion: 0.08
Nodes (34): DateRangePicker(), DateRangePickerProps, Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps (+26 more)

### Community 24 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 25 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "Mapping.tsx"
Cohesion: 0.12
Nodes (19): AccountMappingTable(), SwapLabel(), CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, MainMappingTable(), PaymentTypeModal() (+11 more)

### Community 28 - "useOcrWizard.ts"
Cohesion: 0.14
Nodes (17): OcrDraftState, CcDraft, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+9 more)

### Community 29 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 30 - "useOcrWizard"
Cohesion: 0.15
Nodes (24): useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword(), reExtract() (+16 more)

### Community 31 - "MainMappingTable.tsx"
Cohesion: 0.19
Nodes (21): AISuggestBar(), Props, Props, Props, ActiveScan, MainMappings, MasterAccount, MasterDepartment (+13 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (31): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+23 more)

### Community 34 - "emailReview.ts"
Cohesion: 0.19
Nodes (16): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, getReviewStatus() (+8 more)

### Community 35 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 36 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 37 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (11): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+3 more)

### Community 38 - "CheckoutFlow.tsx"
Cohesion: 0.13
Nodes (14): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+6 more)

### Community 39 - "OrderStatusBadge.tsx"
Cohesion: 0.28
Nodes (6): Badge(), BadgeVariant, Props, MAP, OrderStatusBadge(), OrderStatus

### Community 40 - "api.ts"
Cohesion: 0.08
Nodes (22): Props, TopLevelConfigSection(), BANK_CODE_MAP, APVendorMapping, APVendorMappingResponse, ConfigPatch, patchAccountingConfig(), saveAPVendorMapping() (+14 more)

### Community 41 - "ReviewQueue.tsx"
Cohesion: 0.15
Nodes (10): carmenSettingsUrl(), COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NotSetUp(), QueueEmpty() (+2 more)

### Community 42 - "TKey"
Cohesion: 0.13
Nodes (17): BatchAction, BatchActionBar(), Props, TKey, Home, ADMIN_ROUTES, NAV_SECTIONS, NavItem (+9 more)

### Community 43 - "date.ts"
Cohesion: 0.22
Nodes (12): DateInput(), DateInputProps, DATE_KEYS, HeaderCard(), Props, addDays(), buildInvoicePayload(), formatDateToDDMMYYYY() (+4 more)

### Community 44 - "getCarmenUrl"
Cohesion: 0.14
Nodes (15): Props, VendorSearch(), Coords, getCoords(), Props, Tooltip(), TooltipPosition, COPY (+7 more)

### Community 45 - "useCamera.ts"
Cohesion: 0.24
Nodes (10): FOCUS_STEPS, CANVAS_WIDTH, clampAxis(), computeView(), IDENTITY, Rect, spotTarget(), overview() (+2 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.24
Nodes (9): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

### Community 47 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 48 - "QueueRow.tsx"
Cohesion: 0.18
Nodes (18): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+10 more)

### Community 49 - "useOcrExtraction.ts"
Cohesion: 0.15
Nodes (14): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, persistScanForMapping() (+6 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock(), AdminCreditOrder

### Community 52 - "useAPSubmission.ts"
Cohesion: 0.11
Nodes (22): APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+14 more)

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
Cohesion: 0.13
Nodes (17): APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props, UploadSection(), DICT, en (+9 more)

### Community 57 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 61 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 62 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 63 - "apiFetch"
Cohesion: 0.31
Nodes (15): useAPSubmission(), GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+7 more)

### Community 64 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "AccountMappingTable.tsx"
Cohesion: 0.19
Nodes (10): GLAccount, Props, ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps (+2 more)

### Community 67 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 68 - "useOcrExtraction.test.ts"
Cohesion: 0.18
Nodes (11): ExtractionWarningBanner(), Props, OcrExtractionHook, extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData() (+3 more)

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
Cohesion: 0.39
Nodes (8): adjustCredits(), CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), topupCredits(), CreditsPage(), getCols(), getPacks()

### Community 73 - "ReviewDocument.tsx"
Cohesion: 0.11
Nodes (24): CustomSearchSelect(), Props, SelectOption, TopChoice, BlockReason, BU_WIDE, JvEditor(), JvState (+16 more)

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 77 - "PurchaseTutorial.tsx"
Cohesion: 0.29
Nodes (6): PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

## Knowledge Gaps
- **502 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+497 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `client.ts`, `adminClient.ts`, `PeriodPicker.tsx`, `useAPInvoice.ts`, `APReviewStep.tsx`, `NotificationBell.tsx`, `TutorialModal.tsx`, `Overview.tsx`, `ManualScan.tsx`, `AppHeader.tsx`, `AccountingReview.tsx`, `credits.ts`, `useAPExtraction.ts`, `OrderWorkspace.tsx`, `OrderHistory.tsx`, `Pricing.tsx`, `ExtractionsPage.tsx`, `DetailTable.tsx`, `ProformaDocument.tsx`, `Mapping.tsx`, `APAmountSummary.tsx`, `useOcrWizard`, `MainMappingTable.tsx`, `APInvoice.tsx`, `EmailAutomationPage.tsx`, `FeatureFlows.tsx`, `OrderTable.tsx`, `CheckoutFlow.tsx`, `OrderStatusBadge.tsx`, `ReviewQueue.tsx`, `TKey`, `date.ts`, `getCarmenUrl`, `TenantsPage.tsx`, `OrderActions.tsx`, `QueueRow.tsx`, `OrderDrawer.tsx`, `useAPSubmission.ts`, `AdminLogin.tsx`, `DocumentPreview.tsx`, `LanguageContext.tsx`, `DataTable.tsx`, `AccountMappingTable.tsx`, `useOcrExtraction.test.ts`, `CreditsPage.tsx`, `ReviewDocument.tsx`, `PurchaseTutorial.tsx`?**
  _High betweenness centrality (0.236) - this node is a cross-community bridge._
- **Why does `showToast()` connect `useAPSubmission.ts` to `client.ts`, `useAPInvoice.ts`, `useOcrExtraction.test.ts`, `ReviewDocument.tsx`, `ReviewQueue.tsx`, `emailAutomation.ts`, `useAPExtraction.ts`, `useOcrExtraction.ts`, `useOcrSubmission.test.ts`, `useOcrWizard.ts`, `useOcrWizard`, `apiFetch`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `appKey()` connect `useMapping.ts` to `client.ts`, `useAPInvoice.ts`, `ManualScan.tsx`, `getCarmenUrl`, `useAPExtraction.ts`, `useOcrExtraction.ts`, `useOcrSubmission.test.ts`, `useOcrWizard`, `useAPExtraction.test.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _502 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05473684210526316 - nodes in this community are weakly interconnected._
- **Should `adminClient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07329192546583851 - nodes in this community are weakly interconnected._
- **Should `PeriodPicker.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14799154334038056 - nodes in this community are weakly interconnected._