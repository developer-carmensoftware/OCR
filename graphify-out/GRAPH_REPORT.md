# Graph Report - OCR  (2026-09-07)

## Corpus Check
- 297 files · ~238,949 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1753 nodes · 4945 edges · 110 communities (96 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `07cef253`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- CustomModal.tsx
- ccJv.ts
- useNotifications.ts
- OrderActions.tsx
- useMapping.ts
- Pager.tsx
- useT
- useAPInvoice.ts
- DetailTable.tsx
- useAPExtraction.ts
- screens.tsx
- date.ts
- useOcrWizard
- banks.ts
- config.ts
- compilerOptions
- 5. Components
- main.tsx
- NotificationBell.tsx
- devDependencies
- QueueRow.tsx
- getCarmenUrl
- APReviewStep.tsx
- emailAutomation.ts
- useAPSubmission.test.ts
- CheckoutFlow.tsx
- useOcrExtraction
- adminClient.ts
- QuotaModulesPage.tsx
- constants/index.ts
- ManualScan.tsx
- TenantsPage.tsx
- OrderHistory.tsx
- ExtractionsPage.tsx
- Tooltip.tsx
- useFileUpload.ts
- apiFetch
- dependencies
- Button.tsx
- api.ts
- EmailAutomationPage.tsx
- useUserConsent.ts
- PendingOrderBanner.tsx
- useOcrWizard.ts
- Pricing.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- ocr.ts
- PeriodPicker.tsx
- ReviewDocument.test.tsx
- reviewReasons.ts
- credits.ts
- OrderTable.tsx
- formatThb
- AuthContext.tsx
- Skeleton.tsx
- useOcrSubmission.test.ts
- LanguageContext.tsx
- scripts
- useOcrExtraction.ts
- DocumentPreview.tsx
- AdminCreditOrder
- APLineItem
- ReviewDocument.tsx
- compilerOptions
- TKey
- dict.ts
- useNotifications.test.ts
- MetricChartImpl.tsx
- CLAUDE.md
- Contributing
- APAccountMappingStep.tsx
- imagesToPdf.ts
- ProtectedRoute.tsx
- Mapping.tsx
- TenantSelector.test.tsx
- client.ts
- BankDetectionBanner
- PDFPageSelector
- @types/react-dom
- Product
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
- NotificationBell.test.tsx
- eslint-plugin-react-hooks
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `apiFetch` - 55 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 31 edges
7. `showToast()` - 31 edges
8. `TKey` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/AccountMappingTable.tsx → frontend/src/types/ap.ts
- `Props` --references--> `BankCode`  [EXTRACTED]
  frontend/src/components/credit-card/BankDetectionBanner.tsx → frontend/src/types/api.ts
- `Props` --references--> `ExtractionWarning`  [EXTRACTED]
  frontend/src/components/credit-card/ExtractionWarningBanner.tsx → frontend/src/lib/reviewReasons.ts

## Import Cycles
- None detected.

## Communities (110 total, 14 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.10
Nodes (26): Props, QueueSettings(), ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult (+18 more)

### Community 1 - "CustomModal.tsx"
Cohesion: 0.07
Nodes (35): OrderDrawer(), ModalType, Props, baseProps, TYPE_CONFIG, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES (+27 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.13
Nodes (18): OCR_BANK_MAP, CONFIG, leg(), rows(), TWO_LINES, applyJvAmount(), buildGljvPayload(), buildJvRows() (+10 more)

### Community 3 - "useNotifications.ts"
Cohesion: 0.26
Nodes (11): releaseRow(), useNotifications(), listNotifications(), markNotificationsRead(), Notification, markReleaseSeen(), readReleaseSeen(), RELEASE_SEEN_EVENT (+3 more)

### Community 4 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 5 - "useMapping.ts"
Cohesion: 0.21
Nodes (16): persistScanForMapping(), getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingSuggestions() (+8 more)

### Community 6 - "Pager.tsx"
Cohesion: 0.16
Nodes (10): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Props, SIZE_OPTIONS, readRowsPerPage(), ROWS_PER_PAGE (+2 more)

### Community 7 - "useT"
Cohesion: 0.08
Nodes (26): ContactBuyer(), slipIsPdf(), SlipViewer(), SummaryRow(), AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE (+18 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.15
Nodes (27): AmountSummary(), AccountingReview(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields(), useAPInvoice() (+19 more)

### Community 9 - "DetailTable.tsx"
Cohesion: 0.23
Nodes (8): NumericInput(), NumericInputProps, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), sanitizeNumericInput()

### Community 10 - "useAPExtraction.ts"
Cohesion: 0.08
Nodes (33): Diffs, Props, SummaryRowProps, Sums, Targets, APFieldMappingStep(), COLS, Props (+25 more)

### Community 11 - "screens.tsx"
Cohesion: 0.12
Nodes (23): PackList(), Props, EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS, DEMO_BUYER (+15 more)

### Community 12 - "date.ts"
Cohesion: 0.33
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 13 - "useOcrWizard"
Cohesion: 0.28
Nodes (14): processFile(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), useOcrWizard(), handleCancel(), reExtract(), resetAll() (+6 more)

### Community 14 - "banks.ts"
Cohesion: 0.14
Nodes (19): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP, BankEntry, BankInfo (+11 more)

### Community 15 - "config.ts"
Cohesion: 0.18
Nodes (13): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), APVendorMapping, APVendorMappingResponse (+5 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "main.tsx"
Cohesion: 0.05
Nodes (43): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle() (+35 more)

### Community 19 - "NotificationBell.tsx"
Cohesion: 0.20
Nodes (12): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, LATEST_RELEASE, RELEASE_NOTES (+4 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, @eslint/js, devDependencies, autoprefixer, eslint, @eslint/js, globals (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.29
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 22 - "getCarmenUrl"
Cohesion: 0.18
Nodes (13): NotificationDetailModal(), Props, REASON_KEY, AuthScreen(), COPY, Lang, Props, useIsMobile() (+5 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.13
Nodes (24): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+16 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.23
Nodes (19): EmailSettingsController, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call(), deleteToken() (+11 more)

### Community 25 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 26 - "CheckoutFlow.tsx"
Cohesion: 0.22
Nodes (9): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+1 more)

### Community 27 - "useOcrExtraction"
Cohesion: 0.14
Nodes (10): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), reExtract() (+2 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.06
Nodes (72): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, CompanyPanel(), OrderWorkspace(), WsAction (+64 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.11
Nodes (26): Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+18 more)

### Community 30 - "constants/index.ts"
Cohesion: 0.26
Nodes (9): BANK_LOGOS, Props, BANK_THAI_NAMES, BANKS, DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn, EMPTY_DETAIL_ROW (+1 more)

### Community 31 - "ManualScan.tsx"
Cohesion: 0.16
Nodes (10): ExtractionSkeleton(), FormActions(), Props, DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props (+2 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier() (+2 more)

### Community 33 - "OrderHistory.tsx"
Cohesion: 0.19
Nodes (9): AppHeader(), Pager(), MAP, OrderStatusBadge(), catalogName(), OrderStatus, ActivePlanBanner(), OrderRow() (+1 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.16
Nodes (17): DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime() (+9 more)

### Community 35 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 36 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 37 - "apiFetch"
Cohesion: 0.21
Nodes (20): GLAccount, useAPSubmission(), prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+12 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 40 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 41 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 42 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 43 - "PendingOrderBanner.tsx"
Cohesion: 0.22
Nodes (9): PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, ACCEPTED, Props, SlipUpload() (+1 more)

### Community 44 - "useOcrWizard.ts"
Cohesion: 0.35
Nodes (9): OcrDraftState, CcDraft, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+1 more)

### Community 45 - "Pricing.tsx"
Cohesion: 0.16
Nodes (18): T, base, Usage, UsageIndicator(), useOrderHistory(), ActiveSubscription, getUsage(), UsageData (+10 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.13
Nodes (17): isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+9 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.13
Nodes (29): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption (+21 more)

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+6 more)

### Community 49 - "PeriodPicker.tsx"
Cohesion: 0.09
Nodes (55): ServerTable, daysAgo(), endOfDay(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period (+47 more)

### Community 50 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): patchAccountingConfig(), approveDocument(), getPending(), rejectDocument(), toExtractedRows(), ReviewDocument(), approve(), reject() (+6 more)

### Community 51 - "reviewReasons.ts"
Cohesion: 0.28
Nodes (7): ExtractionWarningBanner(), Props, FIX, REASON_KEY, SETTINGS, warningText(), WITH_DETAIL

### Community 52 - "credits.ts"
Cohesion: 0.11
Nodes (31): Props, OrderRow(), CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist() (+23 more)

### Community 53 - "OrderTable.tsx"
Cohesion: 0.16
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 54 - "formatThb"
Cohesion: 0.19
Nodes (16): OrderKpiCards(), num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, BillingFigure() (+8 more)

### Community 55 - "AuthContext.tsx"
Cohesion: 0.27
Nodes (11): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), clearAllDrafts(), getJwtExpMs() (+3 more)

### Community 56 - "Skeleton.tsx"
Cohesion: 0.32
Nodes (6): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (17): OcrSubmissionHook, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail (+9 more)

### Community 58 - "LanguageContext.tsx"
Cohesion: 0.09
Nodes (26): Column, DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), SKELETON_WIDTHS, SortDir, MetricChart() (+18 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "useOcrExtraction.ts"
Cohesion: 0.28
Nodes (7): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionHook, OcrExtractionProps, OcrSubmissionProps, ModalConfig

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "AdminCreditOrder"
Cohesion: 0.29
Nodes (6): Props, Props, many(), order(), WsState, AdminCreditOrder

### Community 63 - "APLineItem"
Cohesion: 0.35
Nodes (8): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected(), APLineItem

### Community 64 - "ReviewDocument.tsx"
Cohesion: 0.15
Nodes (22): SkeletonRow(), SwapLabel(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, Props, BlockReason (+14 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "TKey"
Cohesion: 0.16
Nodes (13): BatchAction, BatchActionBar(), Props, TKey, Home, NavItem, NavSection, ACTIVE_TAG (+5 more)

### Community 67 - "dict.ts"
Cohesion: 0.20
Nodes (9): APUploadStep(), INSTRUCTIONS, Props, DICT, en, Lang, th, translate() (+1 more)

### Community 68 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 69 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

### Community 73 - "imagesToPdf.ts"
Cohesion: 0.60
Nodes (4): imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg()

### Community 74 - "ProtectedRoute.tsx"
Cohesion: 0.16
Nodes (15): ConsentGate(), Props, AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired() (+7 more)

### Community 75 - "Mapping.tsx"
Cohesion: 0.24
Nodes (8): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BankConfigHook, CompanyData, Mapping, Mapping()

### Community 77 - "client.ts"
Cohesion: 0.18
Nodes (15): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+7 more)

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
Cohesion: 0.17
Nodes (11): APVendorProps, useAPVendor(), EmailRule, showToast(), ToastType, EmailSettings, BLOCKER_TEXT, copy() (+3 more)

### Community 96 - "NotificationBell.test.tsx"
Cohesion: 0.18
Nodes (8): failedRow, items, markRead, orderRow, postedRow, releaseRow, LanguageProvider(), readLang()

## Knowledge Gaps
- **493 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+488 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `CustomModal.tsx`, `useNotifications.ts`, `OrderActions.tsx`, `Pager.tsx`, `useAPInvoice.ts`, `DetailTable.tsx`, `useAPExtraction.ts`, `screens.tsx`, `useOcrWizard`, `main.tsx`, `NotificationBell.tsx`, `QueueRow.tsx`, `getCarmenUrl`, `APReviewStep.tsx`, `CheckoutFlow.tsx`, `adminClient.ts`, `QuotaModulesPage.tsx`, `constants/index.ts`, `ManualScan.tsx`, `TenantsPage.tsx`, `OrderHistory.tsx`, `ExtractionsPage.tsx`, `EmailAutomationPage.tsx`, `PendingOrderBanner.tsx`, `Pricing.tsx`, `useAPExtraction.test.ts`, `MainMappingTable.tsx`, `PeriodPicker.tsx`, `ReviewDocument.test.tsx`, `reviewReasons.ts`, `credits.ts`, `OrderTable.tsx`, `formatThb`, `LanguageContext.tsx`, `DocumentPreview.tsx`, `APLineItem`, `ReviewDocument.tsx`, `TKey`, `dict.ts`, `MetricChartImpl.tsx`, `APAccountMappingStep.tsx`, `Mapping.tsx`, `client.ts`, `BankDetectionBanner`, `showToast`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `ReviewQueue.tsx`, `useNotifications.ts`, `useMapping.ts`, `useAPInvoice.ts`, `useAPExtraction.ts`, `config.ts`, `useAPSubmission.test.ts`, `useOcrExtraction`, `useFileUpload.ts`, `api.ts`, `useUserConsent.ts`, `Pricing.tsx`, `useAPExtraction.test.ts`, `ocr.ts`, `ReviewDocument.test.tsx`, `credits.ts`, `useOcrSubmission.test.ts`, `ReviewDocument.tsx`, `client.ts`, `showToast`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useFileUpload.ts`, `useOcrWizard.ts`, `useAPExtraction.test.ts`, `config.ts`, `ocr.ts`, `useOcrExtraction`, `showToast`, `ManualScan.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _493 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09759759759759759 - nodes in this community are weakly interconnected._
- **Should `CustomModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06988120195667366 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._