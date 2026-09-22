# Graph Report - OCR  (2026-09-22)

## Corpus Check
- 321 files · ~262,006 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1866 nodes · 5291 edges · 121 communities (100 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e2f870d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- CustomModal.tsx
- ReviewDocument.tsx
- ReviewQueue.tsx
- NotificationBell.tsx
- Mapping.tsx
- PeriodPicker.tsx
- FeatureFlows.tsx
- DetailTable.tsx
- main.tsx
- APInvoice.tsx
- useT
- adminClient.ts
- ExtractionsPage.tsx
- emailReview.ts
- AdminAuthContext.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- TKey
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- APReviewStep.tsx
- showToast
- isAccountAllowed
- config.ts
- useSettlementMapping.ts
- auth.ts
- APAmountSummary.tsx
- APGroupModal.tsx
- Pricing.tsx
- AdminLogin.tsx
- AccountingReview.tsx
- useNotifications.ts
- draft.ts
- useAPExtraction.ts
- useAPSubmission.ts
- dependencies
- EmailAutomationPage.tsx
- api.ts
- formatThb
- MaintenanceGate.tsx
- JvEditor.tsx
- CheckoutFlow.tsx
- DataTable.tsx
- useAPExtraction.test.ts
- FieldMapping
- useOcrExtraction.ts
- DocumentPreview.tsx
- routes.tsx
- AdminRouter.tsx
- OrderHistory.tsx
- NotificationBell.test.tsx
- OrderWorkspace.tsx
- client.ts
- ErrorBoundary
- banks.ts
- credits.ts
- scripts
- useMapping.ts
- MetricChartImpl.tsx
- useAPInvoice.ts
- useOcrExtraction.test.ts
- ManualScan.tsx
- compilerOptions
- LanguageContext.tsx
- useMappingData.ts
- ccJv.ts
- OrderTable.tsx
- CLAUDE.md
- Contributing
- useOcrWizard
- eslint-plugin-react-hooks
- apiFetch
- PaymentTypeModal.test.tsx
- Tooltip.tsx
- AppHeader.tsx
- CompanyInfoSection.tsx
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
- useNotifications.test.ts
- @vitejs/plugin-react
- mapping.ts
- OrderStatusBadge.tsx
- jsdom
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- @testing-library/react
- vitest
- vite-env.d.ts
- 03-combined-jv-three-debit-legs.md
- Carmen AI — OCR & Import System
- eslint
- 04-tin-second-factor.md
- @types/react
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md

## God Nodes (most connected - your core abstractions)
1. `useT()` - 241 edges
2. `apiFetch` - 59 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 41 edges
6. `TKey` - 34 edges
7. `appKey()` - 33 edges
8. `showToast()` - 29 edges
9. `FieldMapping` - 29 edges
10. `unwrapDetail()` - 28 edges

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

## Communities (121 total, 21 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.17
Nodes (14): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+6 more)

### Community 1 - "CustomModal.tsx"
Cohesion: 0.07
Nodes (36): OrderDrawer(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS (+28 more)

### Community 2 - "ReviewDocument.tsx"
Cohesion: 0.15
Nodes (20): ExtractionWarningBanner(), Props, OcrExtractionHook, patchAccountingConfig(), approveDocument(), getPending(), rejectDocument(), toExtractedRows() (+12 more)

### Community 3 - "ReviewQueue.tsx"
Cohesion: 0.18
Nodes (10): ACTIVITY_FILTERS, carmenSettingsUrl(), ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp() (+2 more)

### Community 4 - "NotificationBell.tsx"
Cohesion: 0.17
Nodes (15): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), Props (+7 more)

### Community 5 - "Mapping.tsx"
Cohesion: 0.17
Nodes (11): ARJvPreview(), money(), Props, AISuggestBar(), Props, Badge(), BadgeVariant, Props (+3 more)

### Community 6 - "PeriodPicker.tsx"
Cohesion: 0.11
Nodes (34): MetricChart(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+26 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "DetailTable.tsx"
Cohesion: 0.14
Nodes (14): ARReviewPane(), labelOf(), Props, Props, AMOUNT_FIELDS, DetailRow, DetailTable(), formatAmount() (+6 more)

### Community 9 - "main.tsx"
Cohesion: 0.20
Nodes (9): PageSkeleton(), container, EmailSettings, getRoute(), Home, Mapping, OrderHistory, Pricing (+1 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.08
Nodes (33): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+25 more)

### Community 11 - "useT"
Cohesion: 0.11
Nodes (23): ContactBuyer(), slipIsPdf(), SlipViewer(), PackList(), EnterpriseCard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS (+15 more)

### Community 12 - "adminClient.ts"
Cohesion: 0.08
Nodes (60): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, useOrderActions(), withName(), adminFetch (+52 more)

### Community 13 - "ExtractionsPage.tsx"
Cohesion: 0.08
Nodes (34): DateRangePicker(), DateRangePickerProps, Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps (+26 more)

### Community 14 - "emailReview.ts"
Cohesion: 0.21
Nodes (12): ReviewQueueController, useReviewQueue(), ActivityFilter, ApproveResult, getReviewStatus(), listActivity(), markChipSeen(), ReviewDocument (+4 more)

### Community 15 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 19 - "TKey"
Cohesion: 0.16
Nodes (13): BatchAction, BatchActionBar(), Props, TKey, NavItem, NavSection, ACTIVE_TAG, containerVariants (+5 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.25
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+5 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.15
Nodes (12): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+4 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (24): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+16 more)

### Community 24 - "showToast"
Cohesion: 0.08
Nodes (42): Button(), ButtonProps, Variant, VARIANT_CLASS, Draft, EmailSettingsController, EMPTY_DRAFT, EMPTY_RULE (+34 more)

### Community 25 - "isAccountAllowed"
Cohesion: 0.23
Nodes (12): AccountMappingTable(), GLAccount, Props, MappingRow(), MainMappingTable(), AccountLike, allowedAccountsForDept(), DeptLike (+4 more)

### Community 26 - "config.ts"
Cohesion: 0.22
Nodes (11): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), APVendorMapping, APVendorMappingResponse (+3 more)

### Community 27 - "useSettlementMapping.ts"
Cohesion: 0.18
Nodes (16): blankRows(), dedupe(), fingerprint(), firstToken(), SOURCE_BY_POST_TYPE, useSettlementMapping(), ARMappingItem, ARPreviewRequest (+8 more)

### Community 28 - "auth.ts"
Cohesion: 0.28
Nodes (8): T, base, Usage, UsageIndicator(), getUsage(), UsageData, computeUsageStats(), UsageStats

### Community 29 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 30 - "APGroupModal.tsx"
Cohesion: 0.33
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 31 - "Pricing.tsx"
Cohesion: 0.16
Nodes (18): Props, Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PACK_META (+10 more)

### Community 32 - "AdminLogin.tsx"
Cohesion: 0.33
Nodes (7): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 33 - "AccountingReview.tsx"
Cohesion: 0.21
Nodes (9): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps (+1 more)

### Community 34 - "useNotifications.ts"
Cohesion: 0.18
Nodes (15): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy, releaseRow(), useNotifications(), listNotifications() (+7 more)

### Community 35 - "draft.ts"
Cohesion: 0.44
Nodes (7): clearAllDrafts(), clearDraft(), DraftKind, Envelope, keyFor(), loadDraft(), saveDraft()

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (23): DEFAULT_MAPPINGS, EMPTY_HEADER, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction() (+15 more)

### Community 37 - "useAPSubmission.ts"
Cohesion: 0.11
Nodes (25): APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+17 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 40 - "api.ts"
Cohesion: 0.12
Nodes (16): Props, TopLevelConfigSection(), BANK_CODE_MAP, NormalizedConfig, AccountingConfigRequest, ApiError, APInvoiceItem, BankDisplayName (+8 more)

### Community 41 - "formatThb"
Cohesion: 0.22
Nodes (14): OrderKpiCards(), num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords() (+6 more)

### Community 42 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 43 - "JvEditor.tsx"
Cohesion: 0.13
Nodes (15): CustomSearchSelect(), Props, SelectOption, TopChoice, BlockReason, BU_WIDE, JvEditor(), JvState (+7 more)

### Community 44 - "CheckoutFlow.tsx"
Cohesion: 0.14
Nodes (14): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP (+6 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.14
Nodes (12): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), SKELETON_WIDTHS, Pager(), Props, SIZE_OPTIONS (+4 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "FieldMapping"
Cohesion: 0.31
Nodes (16): MappingRowVariant, Props, Props, Props, ActiveScan, MainMappings, MasterAccount, MasterDepartment (+8 more)

### Community 48 - "useOcrExtraction.ts"
Cohesion: 0.22
Nodes (11): DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionProps, OcrSubmissionHook, OcrSubmissionProps, CcDraft (+3 more)

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 50 - "routes.tsx"
Cohesion: 0.12
Nodes (38): Column, ServerTable, SortDir, daysAgo(), endOfDay(), today(), ymd(), useTableData() (+30 more)

### Community 51 - "AdminRouter.tsx"
Cohesion: 0.27
Nodes (10): AdminProtectedRoute(), useAdminAuth(), AdminRouter, AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute() (+2 more)

### Community 52 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (18): AppHeader(), OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP (+10 more)

### Community 53 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 54 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (19): CompanyPanel(), OrderWorkspace(), WsAction, wsInitial, wsReducer(), adjustCredits(), CreditLedgerEntry, fetchAdminOrderDocuments() (+11 more)

### Community 55 - "client.ts"
Cohesion: 0.09
Nodes (33): ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+25 more)

### Community 56 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 57 - "banks.ts"
Cohesion: 0.25
Nodes (13): BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP, BankInfo, detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), codeToDisplayName() (+5 more)

### Community 58 - "credits.ts"
Cohesion: 0.12
Nodes (30): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+22 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.19
Nodes (17): persistScanForMapping(), getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingSuggestions() (+9 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.20
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 62 - "useAPInvoice.ts"
Cohesion: 0.15
Nodes (29): AmountSummary(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields(), OCR_BANK_MAP, useAPInvoice() (+21 more)

### Community 63 - "useOcrExtraction.test.ts"
Cohesion: 0.29
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult

### Community 64 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (18): FormActions(), Props, BANK_LOGOS, BankDetectionBanner(), Props, DATE_KEYS, HeaderCard(), Props (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.13
Nodes (17): APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props, UploadSection(), DICT, en (+9 more)

### Community 67 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 68 - "ccJv.ts"
Cohesion: 0.13
Nodes (18): AccountingReview(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows() (+10 more)

### Community 69 - "OrderTable.tsx"
Cohesion: 0.07
Nodes (34): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Props (+26 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard"
Cohesion: 0.13
Nodes (22): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+14 more)

### Community 74 - "apiFetch"
Cohesion: 0.18
Nodes (16): AuthUser, APVendorProps, useAPVendor(), cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+8 more)

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 77 - "AppHeader.tsx"
Cohesion: 0.19
Nodes (8): Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell, OrderReviewShell()

### Community 78 - "CompanyInfoSection.tsx"
Cohesion: 0.38
Nodes (6): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, BankConfigHook, CompanyData

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.12
Nodes (17): KPICard(), KPICardProps, label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS (+9 more)

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
Cohesion: 0.18
Nodes (12): Props, VendorSearch(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), RowAction() (+4 more)

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 96 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 98 - "mapping.ts"
Cohesion: 0.33
Nodes (5): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, SuggestPaymentTypesRequest, SuggestRequest

### Community 99 - "OrderStatusBadge.tsx"
Cohesion: 0.50
Nodes (3): MAP, OrderStatusBadge(), OrderStatus

## Knowledge Gaps
- **525 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+520 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `CustomModal.tsx`, `ReviewDocument.tsx`, `ReviewQueue.tsx`, `NotificationBell.tsx`, `Mapping.tsx`, `PeriodPicker.tsx`, `FeatureFlows.tsx`, `DetailTable.tsx`, `APInvoice.tsx`, `adminClient.ts`, `ExtractionsPage.tsx`, `TKey`, `QueueRow.tsx`, `APReviewStep.tsx`, `isAccountAllowed`, `useSettlementMapping.ts`, `auth.ts`, `APAmountSummary.tsx`, `APGroupModal.tsx`, `Pricing.tsx`, `AdminLogin.tsx`, `AccountingReview.tsx`, `useNotifications.ts`, `useAPExtraction.ts`, `EmailAutomationPage.tsx`, `api.ts`, `formatThb`, `MaintenanceGate.tsx`, `JvEditor.tsx`, `CheckoutFlow.tsx`, `DataTable.tsx`, `FieldMapping`, `DocumentPreview.tsx`, `routes.tsx`, `AdminRouter.tsx`, `OrderHistory.tsx`, `OrderWorkspace.tsx`, `credits.ts`, `useMapping.ts`, `MetricChartImpl.tsx`, `useAPInvoice.ts`, `ManualScan.tsx`, `LanguageContext.tsx`, `ccJv.ts`, `OrderTable.tsx`, `useOcrWizard`, `apiFetch`, `PaymentTypeModal.test.tsx`, `AppHeader.tsx`, `CompanyInfoSection.tsx`, `TenantsPage.tsx`, `getCarmenUrl`, `OrderStatusBadge.tsx`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useOcrWizard.ts`, `ReviewDocument.tsx`, `NotificationBell.tsx`, `emailReview.ts`, `config.ts`, `useSettlementMapping.ts`, `useNotifications.ts`, `useAPExtraction.ts`, `useAPSubmission.ts`, `JvEditor.tsx`, `CheckoutFlow.tsx`, `useAPExtraction.test.ts`, `OrderHistory.tsx`, `client.ts`, `credits.ts`, `useMapping.ts`, `useAPInvoice.ts`, `useMappingData.ts`, `useOcrWizard`, `mapping.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `appKey()` connect `useMapping.ts` to `getCarmenUrl`, `ManualScan.tsx`, `draft.ts`, `useAPExtraction.ts`, `useOcrWizard`, `useAPExtraction.test.ts`, `useOcrExtraction.ts`, `client.ts`, `banks.ts`, `config.ts`, `useAPInvoice.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _525 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CustomModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06936026936026936 - nodes in this community are weakly interconnected._
- **Should `PeriodPicker.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11153846153846154 - nodes in this community are weakly interconnected._
- **Should `FeatureFlows.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13725490196078433 - nodes in this community are weakly interconnected._