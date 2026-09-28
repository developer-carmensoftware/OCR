# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 307 files · ~249,889 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1795 nodes · 5061 edges · 109 communities (95 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d0eff82d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- adminClient.ts
- APInvoice.tsx
- main.tsx
- apiFetch
- ManualScan.tsx
- PeriodPicker.tsx
- APLineItem
- TutorialModal.tsx
- useT
- api.ts
- AppHeader.tsx
- DataTable.tsx
- parseNum
- credits.ts
- useMapping.ts
- useOcrSubmission.test.ts
- date.ts
- Pricing.tsx
- PendingOrderBanner.tsx
- MainMappingTable.tsx
- JvEditor.tsx
- compilerOptions
- 5. Components
- banks.ts
- QuotaModulesPage.tsx
- CheckoutFlow.tsx
- devDependencies
- ReviewDocument.tsx
- ExtractionsPage.tsx
- APAmountSummary.tsx
- useOcrExtraction
- OrderTable.tsx
- dependencies
- EmailAutomationPage.tsx
- ReviewQueue.tsx
- TopLevelConfigSection.tsx
- CreditsPage.tsx
- FeatureFlows.tsx
- AuthContext.tsx
- NotificationBell.tsx
- useAPExtraction.ts
- CustomModal.tsx
- OrderWorkspace.tsx
- useFileUpload.ts
- getCarmenUrl
- useAuth
- TenantsPage.tsx
- OrderActions.tsx
- useOcrWizard.ts
- client.ts
- scripts
- APGroupModal.tsx
- Mapping.tsx
- ocr.ts
- compilerOptions
- LanguageContext.tsx
- OrderHistory.tsx
- UsageIndicator.tsx
- CLAUDE.md
- Contributing
- eslint
- MetricChartImpl.tsx
- AdminRouter.tsx
- AdminLogin.tsx
- useAPExtraction.test.ts
- Carmen AI — OCR & Import System
- useUserConsent.ts
- Home.tsx
- AdminAuthContext.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- MaintenanceGate.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderDrawer.tsx
- ErrorBoundary
- vercel.json
- Architecture
- draft.ts
- useOcrWizard
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Tooltip.tsx
- dict.ts
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- @testing-library/jest-dom
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- usePdfPasswordPrompt
- mockPaths.test.ts
- SlipViewer.tsx
- AppHeader.test.tsx
- emailAutomation.ts
- eslint-plugin-react-hooks

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `adminFetch` - 53 edges
3. `apiFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 33 edges
7. `TKey` - 30 edges
8. `useAPInvoice()` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `APLineItem` - 28 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (109 total, 14 thin omitted)

### Community 0 - "adminClient.ts"
Cohesion: 0.07
Nodes (63): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, Button(), ButtonProps, Variant (+55 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.07
Nodes (42): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+34 more)

### Community 2 - "main.tsx"
Cohesion: 0.24
Nodes (7): AdminRouter, container, getRoute(), OrderHistory, Pricing, Router(), PageSkeleton()

### Community 3 - "apiFetch"
Cohesion: 0.09
Nodes (38): mountRestored(), TAX_PROFILES, useAPInvoice(), GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes (+30 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.06
Nodes (34): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+26 more)

### Community 5 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (37): daysAgo(), endOfDay(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, PRESET_DAYS, PresetId (+29 more)

### Community 6 - "APLineItem"
Cohesion: 0.08
Nodes (30): GLAccount, Props, APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps (+22 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (23): PURCHASE_TUTORIAL, PurchaseStep, FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify(), Props (+15 more)

### Community 8 - "useT"
Cohesion: 0.13
Nodes (20): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+12 more)

### Community 9 - "api.ts"
Cohesion: 0.09
Nodes (29): SuggestPaymentTypesResponse, SuggestResponse, PaymentTypesHook, AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+21 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.29
Nodes (7): OrderReviewShell(), OrderReviewShell, Props, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode()

### Community 11 - "DataTable.tsx"
Cohesion: 0.10
Nodes (21): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+13 more)

### Community 12 - "parseNum"
Cohesion: 0.19
Nodes (22): AmountSummary(), ItxOverrides, AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, InputTaxPanel(), Props (+14 more)

### Community 13 - "credits.ts"
Cohesion: 0.14
Nodes (24): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+16 more)

### Community 14 - "useMapping.ts"
Cohesion: 0.16
Nodes (20): getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), usePaymentTypes(), DetailRow (+12 more)

### Community 15 - "useOcrSubmission.test.ts"
Cohesion: 0.11
Nodes (23): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), JvState, Props, OcrSubmissionHook (+15 more)

### Community 16 - "date.ts"
Cohesion: 0.13
Nodes (21): CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY, consolidated() (+13 more)

### Community 17 - "Pricing.tsx"
Cohesion: 0.13
Nodes (21): Props, PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS (+13 more)

### Community 18 - "PendingOrderBanner.tsx"
Cohesion: 0.15
Nodes (21): OrderKpiCards(), VerifyFacts(), RowAction, rowInitial, rowReducer(), RowState, BillingFigure(), BillingDocument (+13 more)

### Community 19 - "MainMappingTable.tsx"
Cohesion: 0.20
Nodes (21): Props, Props, GlMasters, prefetchGlMasters(), ActiveScan, MainMappings, MappingDataHook, MasterAccount (+13 more)

### Community 20 - "JvEditor.tsx"
Cohesion: 0.15
Nodes (21): AccountMappingTable(), suggestMapping(), suggestPaymentTypes(), BlockReason, BU_WIDE, JvEditor(), Overrides, rowId() (+13 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "banks.ts"
Cohesion: 0.17
Nodes (18): BankConfigHook, codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape(), NormalizedConfig (+10 more)

### Community 24 - "QuotaModulesPage.tsx"
Cohesion: 0.13
Nodes (18): Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+10 more)

### Community 25 - "CheckoutFlow.tsx"
Cohesion: 0.15
Nodes (19): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, OrderRow(), catalogName(), isSubscriptionCode(), PACK_META (+11 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "ReviewDocument.tsx"
Cohesion: 0.15
Nodes (20): approveDocument(), getPending(), rejectDocument(), OcrExtractionHook, applyJvAmount(), Props, ReviewDocument(), approve() (+12 more)

### Community 28 - "ExtractionsPage.tsx"
Cohesion: 0.16
Nodes (17): DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, causeLabel(), classify(), ERROR_RULES (+9 more)

### Community 29 - "APAmountSummary.tsx"
Cohesion: 0.13
Nodes (15): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Props, VendorSearch() (+7 more)

### Community 30 - "useOcrExtraction"
Cohesion: 0.16
Nodes (14): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), handleCancel(), reExtract(), resetAll() (+6 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.14
Nodes (16): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+8 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): cronTone(), EmailAutomationPage(), pollMessage(), REASON_CODES, reasonKey(), relativeAge(), STATUSES, statusTone() (+9 more)

### Community 34 - "ReviewQueue.tsx"
Cohesion: 0.06
Nodes (42): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+34 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.15
Nodes (11): JvHeaderCard(), Props, BANK_OPTIONS, Props, TopLevelConfigSection(), useGlMasters(), CustomSearchSelect(), Props (+3 more)

### Community 36 - "CreditsPage.tsx"
Cohesion: 0.16
Nodes (14): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, CreditsPage(), getCols() (+6 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "AuthContext.tsx"
Cohesion: 0.22
Nodes (12): clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), APP_STORAGE_BASES, clearAppStorage() (+4 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (41): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+33 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.21
Nodes (14): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES (+6 more)

### Community 41 - "CustomModal.tsx"
Cohesion: 0.15
Nodes (10): ACCEPTED, Props, SlipUpload(), SLIP, CustomModal(), ModalType, Props, baseProps (+2 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.19
Nodes (13): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), WsAction, wsInitial, wsReducer(), fetchAdminOrderDocuments() (+5 more)

### Community 43 - "useFileUpload.ts"
Cohesion: 0.19
Nodes (7): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 44 - "getCarmenUrl"
Cohesion: 0.16
Nodes (14): RowAction(), AppHeader(), AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+6 more)

### Community 45 - "useAuth"
Cohesion: 0.17
Nodes (11): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), A (+3 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.21
Nodes (11): KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage(), fetchTenantDetail() (+3 more)

### Community 47 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 48 - "useOcrWizard.ts"
Cohesion: 0.20
Nodes (9): OcrDraftState, CcDraft, ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload (+1 more)

### Community 49 - "client.ts"
Cohesion: 0.25
Nodes (11): exchangeSSOToken(), getUsage(), revokeSession(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), fetchTimeout() (+3 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "APGroupModal.tsx"
Cohesion: 0.33
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 52 - "Mapping.tsx"
Cohesion: 0.23
Nodes (8): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, CompanyData, Mapping(), Mapping, SwapLabel()

### Community 53 - "ocr.ts"
Cohesion: 0.21
Nodes (9): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractedRow, extractFromFile(), ExtractResult (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (29): Column, MetricChart(), granularityFor(), periodHours(), PeriodPicker(), ErrorRow, ErrorsPage(), GroupBy (+21 more)

### Community 56 - "OrderHistory.tsx"
Cohesion: 0.13
Nodes (12): MAP, OrderStatusBadge(), PendingOrderBanner(), SLIP, useOrderHistory(), OrderHistory(), parseFocusId(), Pricing() (+4 more)

### Community 57 - "UsageIndicator.tsx"
Cohesion: 0.26
Nodes (8): UsageData, getStoredToken(), T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 62 - "AdminRouter.tsx"
Cohesion: 0.35
Nodes (8): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminProtectedRoute(), useAdminAuth()

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.29
Nodes (8): AdminLogin(), classify(), LoginError, LoginErrorKind, mmss(), AdminLogin, adminLogin(), AdminLoginError

### Community 64 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 67 - "Home.tsx"
Cohesion: 0.24
Nodes (8): ACTIVE_TAG, containerVariants, Home(), itemVariants, MODULES, Home, seen, useEntrance()

### Community 68 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "OrderDrawer.tsx"
Cohesion: 0.36
Nodes (5): OrderDrawer(), Props, __resetScrollLock(), Locker(), useScrollLock()

### Community 77 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "draft.ts"
Cohesion: 0.46
Nodes (6): clearAllDrafts(), clearDraft(), DraftKind, Envelope, keyFor(), loadDraft()

### Community 82 - "useOcrWizard"
Cohesion: 0.43
Nodes (6): getPdfInfoWithRetry(), useOcrWizard(), handleFileChange(), promptForPassword(), runEncryptedExtraction(), getPdfInfo()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 88 - "dict.ts"
Cohesion: 0.12
Nodes (17): BatchAction, BatchActionBar(), Props, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection() (+9 more)

### Community 103 - "usePdfPasswordPrompt"
Cohesion: 0.60
Nodes (5): usePdfPasswordPrompt(), open(), prompt(), render(), submit()

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 108 - "emailAutomation.ts"
Cohesion: 0.15
Nodes (24): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+16 more)

## Knowledge Gaps
- **507 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+502 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `adminClient.ts`, `APInvoice.tsx`, `apiFetch`, `ManualScan.tsx`, `PeriodPicker.tsx`, `APLineItem`, `TutorialModal.tsx`, `AppHeader.tsx`, `DataTable.tsx`, `parseNum`, `credits.ts`, `Pricing.tsx`, `PendingOrderBanner.tsx`, `MainMappingTable.tsx`, `JvEditor.tsx`, `QuotaModulesPage.tsx`, `CheckoutFlow.tsx`, `ReviewDocument.tsx`, `ExtractionsPage.tsx`, `APAmountSummary.tsx`, `useOcrExtraction`, `OrderTable.tsx`, `EmailAutomationPage.tsx`, `ReviewQueue.tsx`, `TopLevelConfigSection.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `CustomModal.tsx`, `OrderWorkspace.tsx`, `getCarmenUrl`, `useAuth`, `TenantsPage.tsx`, `OrderActions.tsx`, `APGroupModal.tsx`, `Mapping.tsx`, `LanguageContext.tsx`, `OrderHistory.tsx`, `UsageIndicator.tsx`, `MetricChartImpl.tsx`, `AdminRouter.tsx`, `AdminLogin.tsx`, `Home.tsx`, `MaintenanceGate.tsx`, `OrderDrawer.tsx`, `dict.ts`, `SlipViewer.tsx`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `apiFetch`, `ManualScan.tsx`, `usePdfPasswordPrompt`, `useFileUpload.ts`, `useOcrSubmission.test.ts`, `useOcrWizard.ts`, `draft.ts`, `useOcrExtraction`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `api.ts`, `parseNum`, `credits.ts`, `useMapping.ts`, `useOcrSubmission.test.ts`, `Pricing.tsx`, `MainMappingTable.tsx`, `JvEditor.tsx`, `CheckoutFlow.tsx`, `ReviewDocument.tsx`, `ReviewQueue.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `client.ts`, `ocr.ts`, `OrderHistory.tsx`, `useAPExtraction.test.ts`, `useUserConsent.ts`, `useOcrWizard`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _507 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `adminClient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06881287726358148 - nodes in this community are weakly interconnected._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `apiFetch` be split into smaller, more focused modules?**
  _Cohesion score 0.08897959183673469 - nodes in this community are weakly interconnected._