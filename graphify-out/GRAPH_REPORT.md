# Graph Report - OCR  (2026-09-04)

## Corpus Check
- 297 files · ~234,706 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1751 nodes · 4940 edges · 107 communities (93 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `95dcd52a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- apiFetch
- TutorialModal.tsx
- JvEditor.tsx
- EmailAutomationPage.tsx
- screens.tsx
- storage.ts
- DataTable.tsx
- LanguageContext.tsx
- parseNum
- DetailTable.tsx
- useAPExtraction.ts
- OrderActions.tsx
- OrderHistory.tsx
- useOcrWizard
- useMapping.ts
- APReviewStep.tsx
- compilerOptions
- 5. Components
- main.tsx
- OrderWorkspace.tsx
- devDependencies
- AccountMappingTable.tsx
- APInvoice.tsx
- APLineItemsTable.tsx
- emailAutomation.ts
- Pricing.tsx
- credits.ts
- useNotifications.ts
- adminClient.ts
- ExtractionsPage.tsx
- CheckoutFlow.tsx
- dict.ts
- TenantsPage.tsx
- getCarmenUrl
- AdminCreditOrder
- client.ts
- useFileUpload.ts
- ccJv.ts
- dependencies
- APVendorSearch.tsx
- NotificationBell.tsx
- ProtectedRoute.tsx
- useT
- OrderTable.tsx
- useAPInvoice.ts
- AuthContext.tsx
- getStoredToken
- MainMappingTable.tsx
- ocr.ts
- PeriodPicker.tsx
- NotificationBell.test.tsx
- BankCode
- Button.tsx
- useAPVendor.ts
- OrderDrawer.tsx
- WhatsNew.tsx
- MetricChartImpl.tsx
- api.ts
- releaseNotes.ts
- scripts
- useNotifications.test.ts
- TenantSelector.test.tsx
- SlipViewer.tsx
- useAPSubmission.ts
- useOcrExtraction.test.ts
- compilerOptions
- DocumentPreview.tsx
- eslint
- @types/react-dom
- CLAUDE.md
- Contributing
- APAccountMappingStep.tsx
- MaintenanceGate.tsx
- useUserConsent.ts
- EmailSettings.tsx
- APLineItem
- date.ts
- PDFPageSelector
- ManualScan.tsx
- Product
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- vercel.json
- Architecture
- vite.config.ts
- eslint-plugin-react-hooks
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- Mapping.tsx

## God Nodes (most connected - your core abstractions)
1. `useT()` - 229 edges
2. `apiFetch` - 56 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 41 edges
6. `showToast()` - 33 edges
7. `appKey()` - 31 edges
8. `TKey` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts
- `Props` --references--> `Vendor`  [EXTRACTED]
  frontend/src/components/ap-invoice/APVendorSearch.tsx → frontend/src/hooks/ap-invoice/useAPVendor.ts

## Import Cycles
- None detected.

## Communities (107 total, 14 thin omitted)

### Community 0 - "apiFetch"
Cohesion: 0.05
Nodes (61): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+53 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 2 - "JvEditor.tsx"
Cohesion: 0.11
Nodes (20): CustomSearchSelect(), Props, SelectOption, TopChoice, NumericInput(), NumericInputProps, BlockReason, JvEditor() (+12 more)

### Community 3 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 4 - "screens.tsx"
Cohesion: 0.14
Nodes (15): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+7 more)

### Community 5 - "storage.ts"
Cohesion: 0.18
Nodes (14): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionHook, OcrExtractionProps, persistScanForMapping(), getAccountingConfig, seedOcrBranch() (+6 more)

### Community 6 - "DataTable.tsx"
Cohesion: 0.11
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 7 - "LanguageContext.tsx"
Cohesion: 0.09
Nodes (35): MetricChart(), granularityFor(), lastDays(), MAX_DAILY_RANGE_DAYS, periodHours(), rangeDays(), label(), Tenant (+27 more)

### Community 8 - "parseNum"
Cohesion: 0.19
Nodes (20): AmountSummary(), InputTaxPanel(), Amount(), getAvailableFields(), adjustField(), DocRepair, reconcileRows(), repairDocFigure() (+12 more)

### Community 9 - "DetailTable.tsx"
Cohesion: 0.15
Nodes (15): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS, HeaderCard(), Props (+7 more)

### Community 10 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (26): DEFAULT_MAPPINGS, EMPTY_HEADER, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch (+18 more)

### Community 11 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 12 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (24): OrderKpiCards(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, expiryDate(), num() (+16 more)

### Community 13 - "useOcrWizard"
Cohesion: 0.13
Nodes (22): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+14 more)

### Community 14 - "useMapping.ts"
Cohesion: 0.12
Nodes (26): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP, BankEntry, BankInfo (+18 more)

### Community 15 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (13): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, APLineItemsTable(), APReviewStep(), HEADER_FIELDS() (+5 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "main.tsx"
Cohesion: 0.05
Nodes (46): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle() (+38 more)

### Community 19 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (16): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial, wsReducer() (+8 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "AccountMappingTable.tsx"
Cohesion: 0.23
Nodes (12): AccountMappingTable(), GLAccount, Props, MainMappingTable(), PaymentTypeModal(), AccountLike, allowedAccountsForDept(), DeptLike (+4 more)

### Community 22 - "APInvoice.tsx"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APUploadStep(), INSTRUCTIONS, Props (+10 more)

### Community 23 - "APLineItemsTable.tsx"
Cohesion: 0.16
Nodes (17): Props, Ctrl, APTableFooter(), Props, APTableHeader(), Props, FixedTaxSettings, Props (+9 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.23
Nodes (19): EmailSettingsController, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call(), deleteToken() (+11 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.12
Nodes (23): AppHeader(), PackList(), Props, EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS (+15 more)

### Community 26 - "credits.ts"
Cohesion: 0.15
Nodes (22): OrderRow(), CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+14 more)

### Community 27 - "useNotifications.ts"
Cohesion: 0.27
Nodes (9): releaseRow(), useNotifications(), ActivityPage, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+1 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.07
Nodes (66): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, useOrderActions(), withName(), adminFetch (+58 more)

### Community 29 - "ExtractionsPage.tsx"
Cohesion: 0.08
Nodes (34): DateRangePicker(), DateRangePickerProps, Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps (+26 more)

### Community 30 - "CheckoutFlow.tsx"
Cohesion: 0.16
Nodes (14): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS (+6 more)

### Community 31 - "dict.ts"
Cohesion: 0.10
Nodes (21): BatchAction, BatchActionBar(), Props, INSTRUCTIONS, Props, UploadSection(), DICT, en (+13 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier() (+2 more)

### Community 33 - "getCarmenUrl"
Cohesion: 0.26
Nodes (9): APSuccessStep(), AuthScreen(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri() (+1 more)

### Community 34 - "AdminCreditOrder"
Cohesion: 0.29
Nodes (6): Props, Props, many(), order(), WsState, AdminCreditOrder

### Community 35 - "client.ts"
Cohesion: 0.16
Nodes (15): T, base, Usage, UsageIndicator(), CarmenSSOState, ActiveSubscription, exchangeSSOToken(), getUsage() (+7 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 37 - "ccJv.ts"
Cohesion: 0.13
Nodes (17): OCR_BANK_MAP, CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+9 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "APVendorSearch.tsx"
Cohesion: 0.19
Nodes (10): Props, VendorSearch(), Badge(), BadgeVariant, Props, Coords, getCoords(), Props (+2 more)

### Community 40 - "NotificationBell.tsx"
Cohesion: 0.26
Nodes (10): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), Props (+2 more)

### Community 41 - "ProtectedRoute.tsx"
Cohesion: 0.25
Nodes (10): AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig, EXPIRED_FLAG_KEY (+2 more)

### Community 42 - "useT"
Cohesion: 0.10
Nodes (23): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+15 more)

### Community 43 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (12): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+4 more)

### Community 44 - "useAPInvoice.ts"
Cohesion: 0.29
Nodes (12): useAPInvoice(), useAPVendor(), OcrDraftState, CcDraft, saveAPVendorMapping(), clearDraft(), DraftKind, draftPromptMessage() (+4 more)

### Community 45 - "AuthContext.tsx"
Cohesion: 0.29
Nodes (10): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), clearAllDrafts(), getJwtExpMs() (+2 more)

### Community 46 - "getStoredToken"
Cohesion: 0.23
Nodes (11): OPEN_STATUSES, OrderHistoryState, useOrderHistory(), getStoredToken(), CreditOrder, getPaymentInfo(), listOrders(), OPEN_ORDER_STATUSES (+3 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.21
Nodes (20): AISuggestBar(), Props, Props, Props, AccountingConfigHook, GlMasters, ActiveScan, MainMappings (+12 more)

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+6 more)

### Community 49 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (37): Column, daysAgo(), endOfDay(), matchPreset(), Period, PeriodPicker(), PRESET_DAYS, PresetId (+29 more)

### Community 50 - "NotificationBell.test.tsx"
Cohesion: 0.18
Nodes (8): failedRow, items, markRead, orderRow, postedRow, releaseRow, LanguageProvider(), readLang()

### Community 51 - "BankCode"
Cohesion: 0.24
Nodes (8): Props, BANK_LOGOS, BankDetectionBanner(), Props, DetailRow, Props, Props, BankCode

### Community 52 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 53 - "useAPVendor.ts"
Cohesion: 0.31
Nodes (6): APVendorProps, API, Correction, FIELD_NAME_MAP, logCorrections(), mapFieldName()

### Community 54 - "OrderDrawer.tsx"
Cohesion: 0.43
Nodes (4): OrderDrawer(), __resetScrollLock(), Locker(), useScrollLock()

### Community 55 - "WhatsNew.tsx"
Cohesion: 0.50
Nodes (5): markReleaseSeen(), readReleaseSeen(), WHATS_NEW_RETURN_KEY, WhatsNew, WhatsNew()

### Community 56 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 57 - "api.ts"
Cohesion: 0.06
Nodes (36): MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+28 more)

### Community 58 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 63 - "useAPSubmission.ts"
Cohesion: 0.13
Nodes (26): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+18 more)

### Community 64 - "useOcrExtraction.test.ts"
Cohesion: 0.29
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 67 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "APAccountMappingStep.tsx"
Cohesion: 0.13
Nodes (16): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+8 more)

### Community 73 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+2 more)

### Community 75 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, EmailSettings, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE

### Community 77 - "APLineItem"
Cohesion: 0.35
Nodes (8): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected(), APLineItem

### Community 78 - "date.ts"
Cohesion: 0.33
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (23): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, ExtractionSkeleton(), Props, FormActions() (+15 more)

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

### Community 114 - "Mapping.tsx"
Cohesion: 0.21
Nodes (8): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, useMapping(), PaymentTypesHook, usePaymentTypes(), Mapping()

## Knowledge Gaps
- **492 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+487 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `apiFetch`, `TutorialModal.tsx`, `JvEditor.tsx`, `EmailAutomationPage.tsx`, `screens.tsx`, `DataTable.tsx`, `LanguageContext.tsx`, `parseNum`, `DetailTable.tsx`, `useAPExtraction.ts`, `OrderActions.tsx`, `OrderHistory.tsx`, `useOcrWizard`, `APReviewStep.tsx`, `main.tsx`, `OrderWorkspace.tsx`, `AccountMappingTable.tsx`, `APInvoice.tsx`, `APLineItemsTable.tsx`, `Pricing.tsx`, `credits.ts`, `adminClient.ts`, `ExtractionsPage.tsx`, `CheckoutFlow.tsx`, `dict.ts`, `TenantsPage.tsx`, `getCarmenUrl`, `client.ts`, `APVendorSearch.tsx`, `NotificationBell.tsx`, `OrderTable.tsx`, `useAPInvoice.ts`, `getStoredToken`, `MainMappingTable.tsx`, `PeriodPicker.tsx`, `BankCode`, `useAPVendor.ts`, `OrderDrawer.tsx`, `WhatsNew.tsx`, `MetricChartImpl.tsx`, `SlipViewer.tsx`, `DocumentPreview.tsx`, `APAccountMappingStep.tsx`, `MaintenanceGate.tsx`, `APLineItem`, `ManualScan.tsx`, `Mapping.tsx`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `client.ts`, `useFileUpload.ts`, `useAPExtraction.ts`, `useUserConsent.ts`, `useAPInvoice.ts`, `useOcrWizard`, `useMapping.ts`, `getStoredToken`, `ManualScan.tsx`, `MainMappingTable.tsx`, `ocr.ts`, `useAPVendor.ts`, `api.ts`, `credits.ts`, `useNotifications.ts`, `useAPSubmission.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `apiFetch`, `useFileUpload.ts`, `useAPInvoice.ts`, `ManualScan.tsx`, `ocr.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _492 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `apiFetch` be split into smaller, more focused modules?**
  _Cohesion score 0.05185185185185185 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
- **Should `JvEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10574712643678161 - nodes in this community are weakly interconnected._