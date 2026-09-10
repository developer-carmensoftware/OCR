# Graph Report - OCR  (2026-09-10)

## Corpus Check
- 310 files · ~249,021 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1829 nodes · 5180 edges · 113 communities (100 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7fb69050`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useT
- TutorialModal.tsx
- ReviewDocument.tsx
- NotificationBell.tsx
- CreditOrdersPage.tsx
- banks.ts
- CreditsPage.tsx
- FeatureFlows.tsx
- useAPInvoice.ts
- main.tsx
- APLineItem
- screens.tsx
- date.ts
- useOcrExtraction
- emailReview.ts
- DataTable.tsx
- compilerOptions
- 5. Components
- useAPExtraction.ts
- ARReconcileSettings.tsx
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- apInvoice.ts
- useEmailSettings.ts
- useOcrWizard.ts
- formatThb
- CustomSearchSelect.tsx
- AdminAuthContext.tsx
- QuotaModulesPage.tsx
- EmailAutomationPage.tsx
- bankTransforms.ts
- TenantsPage.tsx
- OrderDrawer.tsx
- AppHeader.tsx
- ExtractionsPage.tsx
- useFileUpload.ts
- apiFetch
- dependencies
- adminClient.ts
- api.ts
- AdminLogin.tsx
- client.ts
- APInvoice.tsx
- OrderHistory.tsx
- OrderWorkspace.tsx
- useAPExtraction.test.ts
- deptAccounts.ts
- usePdfPasswordPrompt
- PeriodPicker.tsx
- useMappingData.ts
- OrderTable.tsx
- Pricing.tsx
- ErrorBoundary
- Mapping.tsx
- AuthContext.tsx
- APAmountSummary.tsx
- useMapping.ts
- credits.ts
- scripts
- useAccountingConfig.ts
- DocumentPreview.tsx
- ocr.ts
- OrderActions.tsx
- ManualScan.tsx
- compilerOptions
- LanguageContext.tsx
- APGroupModal.tsx
- useUserConsent.ts
- UsagePage.tsx
- CLAUDE.md
- Contributing
- useOcrWizard
- MaintenanceGate.tsx
- ArCustomerProfiles.tsx
- MainMappingTable.tsx
- TenantSelector.test.tsx
- auth.ts
- useOcrExtraction.ts
- PDFPageSelector
- Badge.tsx
- Product
- eslint
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- PaymentTypeModal.test.tsx
- vercel.json
- Architecture
- CreditPack
- vite.config.ts
- CustomModal.tsx
- SlipUpload.tsx
- jsdom
- @types/react
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @types/react-dom
- vite
- vitest
- vite-env.d.ts
- @vitejs/plugin-react

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `apiFetch` - 59 edges
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

## Communities (113 total, 13 thin omitted)

### Community 0 - "useT"
Cohesion: 0.13
Nodes (20): slipIsPdf(), SlipViewer(), AppHeader(), T, UsageIndicator(), useAuth(), useOrderHistory(), useT() (+12 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify() (+19 more)

### Community 2 - "ReviewDocument.tsx"
Cohesion: 0.06
Nodes (52): SkeletonRow(), SwapLabel(), AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, ExtractionWarningBanner(), Props (+44 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.08
Nodes (37): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+29 more)

### Community 4 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (17): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+9 more)

### Community 5 - "banks.ts"
Cohesion: 0.17
Nodes (14): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_KEYWORDS, BankEntry, BankInfo, BANKS, detectBankFromCompanyName() (+6 more)

### Community 6 - "CreditsPage.tsx"
Cohesion: 0.17
Nodes (31): Column, daysAgo(), endOfDay(), today(), ymd(), label(), Tenant, TenantSelector() (+23 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.14
Nodes (30): AmountSummary(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields(), OCR_BANK_MAP, useAPInvoice() (+22 more)

### Community 9 - "main.tsx"
Cohesion: 0.18
Nodes (10): PageSkeleton(), AdminRouter, container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory (+2 more)

### Community 10 - "APLineItem"
Cohesion: 0.15
Nodes (17): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+9 more)

### Community 11 - "screens.tsx"
Cohesion: 0.15
Nodes (14): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+6 more)

### Community 12 - "date.ts"
Cohesion: 0.40
Nodes (7): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 13 - "useOcrExtraction"
Cohesion: 0.24
Nodes (6): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), showModal()

### Community 14 - "emailReview.ts"
Cohesion: 0.08
Nodes (26): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, getReviewStatus() (+18 more)

### Community 15 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "useAPExtraction.ts"
Cohesion: 0.20
Nodes (15): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), getAPVendorMapping(), getFilePreview() (+7 more)

### Community 19 - "ARReconcileSettings.tsx"
Cohesion: 0.11
Nodes (24): ARJvPreview(), money(), Props, dedupe(), firstToken(), useARReconcile(), ARBlocker, ARMappingItem (+16 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, eslint-plugin-react-hooks, devDependencies, autoprefixer, @eslint/js, eslint-plugin-react-hooks, globals (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.09
Nodes (32): Props, VendorSearch(), Coords, getCoords(), Props, Tooltip(), TooltipPosition, COPY (+24 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (18): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+10 more)

### Community 23 - "apInvoice.ts"
Cohesion: 0.09
Nodes (34): COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS() (+26 more)

### Community 24 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (42): Button(), ButtonProps, Variant, VARIANT_CLASS, Switch(), SwitchProps, Draft, EmailSettingsController (+34 more)

### Community 25 - "useOcrWizard.ts"
Cohesion: 0.32
Nodes (10): OcrDraftState, CcDraft, clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 26 - "formatThb"
Cohesion: 0.19
Nodes (14): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, BillingFigure(), ENTERPRISE (+6 more)

### Community 27 - "CustomSearchSelect.tsx"
Cohesion: 0.24
Nodes (7): CustomSearchSelect(), Props, SelectOption, TopChoice, JvHeaderCard(), Props, useGlMasters()

### Community 28 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.12
Nodes (22): KPICard(), KPICardProps, Card(), CardProps, PageHeader(), PageHeaderProps, Tab, Tabs() (+14 more)

### Community 30 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (14): EmptyState(), EmptyStateProps, EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, cronTone(), EmailAutomationPage() (+6 more)

### Community 31 - "bankTransforms.ts"
Cohesion: 0.22
Nodes (10): BANK_INFO, BANK_SOURCE_MAP, getAccountingConfig, seedOcrBranch(), useBankConfig(), codeToDisplayName(), getBankInfo(), getGLSourceCode() (+2 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.16
Nodes (18): endMaintenanceNow(), fetchMaintenance(), fetchTenantDetail(), fetchTenants(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantDetail (+10 more)

### Community 33 - "OrderDrawer.tsx"
Cohesion: 0.18
Nodes (10): OrderDrawer(), Props, Props, many(), order(), WsState, __resetScrollLock(), Locker() (+2 more)

### Community 34 - "AppHeader.tsx"
Cohesion: 0.13
Nodes (17): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), useAdminAuth(), isDarkNow(), useDarkMode() (+9 more)

### Community 35 - "ExtractionsPage.tsx"
Cohesion: 0.22
Nodes (12): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup (+4 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.19
Nodes (7): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 37 - "apiFetch"
Cohesion: 0.13
Nodes (23): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+15 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.10
Nodes (47): adjustCredits(), adminFetch, AdminUserRow, buildQs(), createAdminUser(), CreditBalance, EmailCronJob, EmailJobRun (+39 more)

### Community 40 - "api.ts"
Cohesion: 0.14
Nodes (14): APVendorMapping, APVendorMappingResponse, ConfigPatch, AccountingConfigRequest, AccountingConfigResponse, ApiError, APInvoiceItem, CodeOption (+6 more)

### Community 41 - "AdminLogin.tsx"
Cohesion: 0.33
Nodes (7): adminLogin(), AdminLoginError, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 42 - "client.ts"
Cohesion: 0.14
Nodes (15): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+7 more)

### Community 43 - "APInvoice.tsx"
Cohesion: 0.10
Nodes (19): APFieldMappingStep(), APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, ExtractionSkeleton(), Props, Skeleton() (+11 more)

### Community 44 - "OrderHistory.tsx"
Cohesion: 0.13
Nodes (25): num(), VerifyFacts(), OrderRow(), RowAction, rowInitial, rowReducer(), RowState, expiryDate() (+17 more)

### Community 45 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (16): CompanyPanel(), ContactBuyer(), OrderWorkspace(), WsAction, wsInitial, wsReducer(), CreditLedgerEntry, fetchAdminOrderDocuments() (+8 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "deptAccounts.ts"
Cohesion: 0.21
Nodes (13): AccountMappingTable(), GLAccount, Props, MappingRow(), MappingRowVariant, MainMappingTable(), AccountLike, allowedAccountsForDept() (+5 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "PeriodPicker.tsx"
Cohesion: 0.18
Nodes (19): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS (+11 more)

### Community 50 - "useMappingData.ts"
Cohesion: 0.33
Nodes (11): Props, GlMasters, prefetchGlMasters(), MappingDataHook, MasterAccount, MasterDepartment, MasterGLPrefix, useMappingData() (+3 more)

### Community 51 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 52 - "Pricing.tsx"
Cohesion: 0.21
Nodes (14): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PendingOrderBanner(), CheckoutSession, BillingPeriod (+6 more)

### Community 53 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 54 - "Mapping.tsx"
Cohesion: 0.31
Nodes (6): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, CompanyData, Mapping()

### Community 55 - "AuthContext.tsx"
Cohesion: 0.19
Nodes (13): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), clearToken() (+5 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 57 - "useMapping.ts"
Cohesion: 0.31
Nodes (10): COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingSuggestions(), usePaymentTypes(), saveAccountingConfig(), APP_STORAGE_BASES, appKey() (+2 more)

### Community 58 - "credits.ts"
Cohesion: 0.15
Nodes (21): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+13 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "useAccountingConfig.ts"
Cohesion: 0.29
Nodes (9): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), getAccountingConfig(), AccountingConfig (+1 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "ocr.ts"
Cohesion: 0.18
Nodes (12): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), createApiClient(), fetchTimeout(), ExtractedRow (+4 more)

### Community 63 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 64 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (22): FormActions(), Props, BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount() (+14 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.08
Nodes (30): BatchAction, BatchActionBar(), Props, MAP, OrderStatusBadge(), DICT, en, Lang (+22 more)

### Community 67 - "APGroupModal.tsx"
Cohesion: 0.38
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 68 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+2 more)

### Community 69 - "UsagePage.tsx"
Cohesion: 0.14
Nodes (15): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+7 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard"
Cohesion: 0.25
Nodes (13): getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword(), reExtract(), resetAll(), runEncryptedExtraction() (+5 more)

### Community 73 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+2 more)

### Community 74 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 75 - "MainMappingTable.tsx"
Cohesion: 0.19
Nodes (17): AISuggestBar(), Props, Props, Props, ActiveScan, MainMappings, MainMappingKey, MappingSuggestionsHook (+9 more)

### Community 77 - "auth.ts"
Cohesion: 0.29
Nodes (7): base, Usage, ActiveSubscription, UsageData, computeUsageStats(), UsageStats, ExchangeResponse

### Community 78 - "useOcrExtraction.ts"
Cohesion: 0.29
Nodes (7): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, OcrSubmissionHook, OcrSubmissionProps, ModalConfig

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "Badge.tsx"
Cohesion: 0.31
Nodes (6): ARMappingTable(), Props, Badge(), BadgeVariant, Props, ARReconcileHook

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

### Community 89 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 94 - "CreditPack"
Cohesion: 0.47
Nodes (5): Props, CatalogState, usePricingCatalog(), CreditPack, getCreditPacks()

### Community 96 - "CustomModal.tsx"
Cohesion: 0.29
Nodes (5): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG

### Community 97 - "SlipUpload.tsx"
Cohesion: 0.40
Nodes (4): ACCEPTED, Props, SlipUpload(), MAX_FILE_SIZE_MB

## Knowledge Gaps
- **510 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+505 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `TutorialModal.tsx`, `ReviewDocument.tsx`, `NotificationBell.tsx`, `CreditOrdersPage.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `APLineItem`, `screens.tsx`, `DataTable.tsx`, `useAPExtraction.ts`, `QueueRow.tsx`, `apInvoice.ts`, `formatThb`, `CustomSearchSelect.tsx`, `QuotaModulesPage.tsx`, `EmailAutomationPage.tsx`, `TenantsPage.tsx`, `OrderDrawer.tsx`, `AppHeader.tsx`, `ExtractionsPage.tsx`, `adminClient.ts`, `AdminLogin.tsx`, `APInvoice.tsx`, `OrderHistory.tsx`, `OrderWorkspace.tsx`, `deptAccounts.ts`, `PeriodPicker.tsx`, `OrderTable.tsx`, `Pricing.tsx`, `Mapping.tsx`, `APAmountSummary.tsx`, `credits.ts`, `DocumentPreview.tsx`, `OrderActions.tsx`, `ManualScan.tsx`, `LanguageContext.tsx`, `APGroupModal.tsx`, `UsagePage.tsx`, `useOcrWizard`, `MaintenanceGate.tsx`, `ArCustomerProfiles.tsx`, `MainMappingTable.tsx`, `CustomModal.tsx`, `SlipUpload.tsx`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `ReviewDocument.tsx`, `NotificationBell.tsx`, `useAPInvoice.ts`, `emailReview.ts`, `useAPExtraction.ts`, `ARReconcileSettings.tsx`, `useOcrSubmission.test.ts`, `api.ts`, `client.ts`, `OrderHistory.tsx`, `useAPExtraction.test.ts`, `useMappingData.ts`, `Pricing.tsx`, `useMapping.ts`, `credits.ts`, `useAccountingConfig.ts`, `ocr.ts`, `useUserConsent.ts`, `MainMappingTable.tsx`, `CreditPack`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `TKey` connect `LanguageContext.tsx` to `ManualScan.tsx`, `useT`, `NotificationBell.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `APLineItem`, `APInvoice.tsx`, `OrderWorkspace.tsx`, `OrderTable.tsx`, `Pricing.tsx`, `QueueRow.tsx`, `apInvoice.ts`, `QuotaModulesPage.tsx`, `EmailAutomationPage.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _510 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useT` be split into smaller, more focused modules?**
  _Cohesion score 0.13105413105413105 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1039136302294197 - nodes in this community are weakly interconnected._
- **Should `ReviewDocument.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06292966684294024 - nodes in this community are weakly interconnected._