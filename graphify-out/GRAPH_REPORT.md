# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 373 files · ~254,900 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1975 nodes · 5419 edges · 152 communities (96 shown, 56 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62b1df25`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- showToast
- APReviewStep.tsx
- dict/index.ts
- unwrapDetail
- ManualScan.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- useT
- api.ts
- AppHeader.tsx
- orders.ts
- CustomModal.tsx
- Pricing.tsx
- eslint-plugin-react-hooks
- carmen.ts
- ccJv.ts
- useAPSubmission.ts
- OrderWorkspace.tsx
- ExtractionsPage.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- AccountingReview.tsx
- MainMappingTable.tsx
- AuthContext.tsx
- devDependencies
- useMapping.ts
- Overview.tsx
- useOcrSubmission.test.ts
- useOcrExtraction.ts
- OrderActions.tsx
- dependencies
- ap-invoice/constants.ts
- APAmountSummary.tsx
- TopLevelConfigSection.tsx
- apiFetch
- FeatureFlows.tsx
- useAPExtraction.test.ts
- NotificationBell.tsx
- useAPExtraction.ts
- adminFetch
- APTableRow.tsx
- date.ts
- JvEditor.tsx
- QuotaModulesPage.tsx
- TenantsPage.tsx
- main.tsx
- ocr.ts
- APAccountMappingStep.tsx
- scripts
- OrderHistory.tsx
- getCarmenUrl
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- shared/api/auth.ts
- CLAUDE.md
- Contributing
- eslint
- DocumentPreview.tsx
- AdminRouter.tsx
- AdminLogin.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageContext.tsx
- UserUsagePage.tsx
- client.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- i18n/index.ts
- APInvoice.tsx
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- Skeleton.tsx
- adminAuth.ts
- vercel.json
- Architecture
- jobs.ts
- setup.ts
- llmLogs.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APVendorSearch.tsx
- TKey
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- checkout.ts
- CreditsPage.tsx
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- login.ts
- mockPaths.test.ts
- OrderTable.tsx
- LLMLogsPage.tsx
- i18n/common.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- MetricChartImpl.tsx
- i18n/credits.ts
- overview.ts
- errors.ts
- orev.ts
- quotas.ts
- extractions.ts
- contact.ts
- flows.ts
- tenantRanking.ts
- useAuth
- i18n/maintenance.ts
- DataTable.tsx
- performance.ts
- sessions.ts
- review.ts
- dict/ap.ts
- whatsnew.ts
- i18n/email.ts
- cc.ts
- dict/modal.ts
- typescript
- i18n/nav.ts
- dict/common.ts
- dict/maintenance.ts
- dict/usage.ts
- notif.ts
- i18n/usage.ts
- i18n/tenants.ts
- pricing.ts
- qr.ts
- home.ts
- plan.ts
- quota.ts
- warn.ts
- @testing-library/jest-dom
- slip.ts
- tutorial.ts
- userUsage.ts
- dict/nav.ts
- order.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 34 edges
7. `appKey()` - 33 edges
8. `TKey` - 32 edges
9. `APLineItem` - 30 edges
10. `showToast()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `AdminCreditOrder`  [EXTRACTED]
  frontend/src/features/admin/components/OrderTable.tsx → frontend/src/features/admin/api/orders.ts
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/components/BatchActionBar.tsx → frontend/src/i18n/dict/index.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts

## Import Cycles
- None detected.

## Communities (152 total, 56 thin omitted)

### Community 0 - "showToast"
Cohesion: 0.13
Nodes (23): useAPDraft(), mountRestored(), TAX_PROFILES, useFileUpload(), OcrDraftState, OcrSubmissionHook, useOcrSubmission(), CcDraft (+15 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (21): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+13 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.16
Nodes (10): DICT, en, th, translate(), en, th, en, th (+2 more)

### Community 3 - "unwrapDetail"
Cohesion: 0.27
Nodes (14): unwrapDetail(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword(), RoleOption (+6 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (20): BankDetectionBanner(), AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS, HeaderCard() (+12 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.05
Nodes (48): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+40 more)

### Community 6 - "parseNum"
Cohesion: 0.16
Nodes (29): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+21 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "useT"
Cohesion: 0.08
Nodes (44): OrderKpiCards(), PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, billed() (+36 more)

### Community 9 - "api.ts"
Cohesion: 0.14
Nodes (14): SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse, ExtractedAPInvoiceData (+6 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (9): OrderReviewShell(), registerDict(), OrderReviewShell, Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow() (+1 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (27): AdminCreditOrder, AdminOrderStatus, approveOrder(), fetchAdminOrderDocuments(), fetchAdminPaymentInfo(), fetchKpi(), getOrderSlipUrl(), holdBatch() (+19 more)

### Community 12 - "CustomModal.tsx"
Cohesion: 0.17
Nodes (11): OrderDrawer(), Props, PaymentInfo, CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG (+3 more)

### Community 13 - "Pricing.tsx"
Cohesion: 0.20
Nodes (15): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PACK_META, SALES_CONTACT, CheckoutSession (+7 more)

### Community 15 - "carmen.ts"
Cohesion: 0.12
Nodes (15): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+7 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.13
Nodes (17): CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY, consolidated() (+9 more)

### Community 17 - "useAPSubmission.ts"
Cohesion: 0.21
Nodes (12): APExtractionProps, APSubmissionProps, GLAccount, useAPSubmission(), APVendorProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS (+4 more)

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.11
Nodes (22): CompanyPanel(), ContactBuyer(), num(), VerifyFacts(), WsAction, wsInitial, WsState, slipIsPdf() (+14 more)

### Community 19 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (13): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+5 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "AccountingReview.tsx"
Cohesion: 0.12
Nodes (23): AccountingReview(), DEFAULT_EMPTY_OBJECT, BANK_LOGOS, Props, Props, Props, codeToDisplayName(), codeToSource() (+15 more)

### Community 24 - "MainMappingTable.tsx"
Cohesion: 0.11
Nodes (40): AccountMappingTable(), GLAccount, Props, suggestMapping(), suggestPaymentTypes(), MainMappingTable(), Props, PaymentTypeModal() (+32 more)

### Community 25 - "AuthContext.tsx"
Cohesion: 0.19
Nodes (12): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+4 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "useMapping.ts"
Cohesion: 0.10
Nodes (32): getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), usePaymentTypes(), AccountingConfigHook (+24 more)

### Community 28 - "Overview.tsx"
Cohesion: 0.29
Nodes (12): buildQs(), QueryParams, fetchAlerts(), fetchJobs(), fetchSessions(), fetchErrorBreakdown(), fetchPerformanceLogs(), fetchUsageSummary() (+4 more)

### Community 29 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (17): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), CarmenJvPayload, defaultConfig, defaultRows (+9 more)

### Community 30 - "useOcrExtraction.ts"
Cohesion: 0.09
Nodes (28): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, persistScanForMapping(), extractFromFile, MOCK_EXTRACTED, MOCK_FILE (+20 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "ap-invoice/constants.ts"
Cohesion: 0.19
Nodes (13): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), AP_STEPS, APFieldKey, APStep (+5 more)

### Community 34 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.13
Nodes (14): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BANK_OPTIONS, Props, TopLevelConfigSection(), BankConfigHook (+6 more)

### Community 36 - "apiFetch"
Cohesion: 0.36
Nodes (9): apiFetch, getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user (+1 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.06
Nodes (44): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+36 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (22): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args (+14 more)

### Community 41 - "adminFetch"
Cohesion: 0.38
Nodes (11): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenants(), fmtICT(), MaintenancePage() (+3 more)

### Community 42 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 43 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 44 - "JvEditor.tsx"
Cohesion: 0.13
Nodes (24): approveDocument(), getPending(), ItxOverrides, rejectDocument(), Props, DetailRow, Props, BlockReason (+16 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (23): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), Card(), CardProps (+15 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.18
Nodes (13): TenantSubscriptionSummary, fetchTenantDetail(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, KPICard(), KPICardProps (+5 more)

### Community 47 - "main.tsx"
Cohesion: 0.14
Nodes (9): container, getRoute(), OrderHistory, Pricing, Router(), ErrorBoundary, Props, State (+1 more)

### Community 48 - "ocr.ts"
Cohesion: 0.15
Nodes (15): ApiError, ExtractedRow, getPdfInfo(), PDF_PASSWORD_REQUIRED, PdfInfoResult, COPY, Options, PdfPasswordAttempt (+7 more)

### Community 49 - "APAccountMappingStep.tsx"
Cohesion: 0.16
Nodes (11): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+3 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.17
Nodes (19): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), catalogName(), isSubscriptionCode(), planChangeLoss() (+11 more)

### Community 52 - "getCarmenUrl"
Cohesion: 0.39
Nodes (5): getCarmenUri(), setActiveTenant(), setCarmenUri(), carmenSettingsUrl(), getCarmenUrl()

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (25): fetchTenantRanking(), Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+17 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (28): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+20 more)

### Community 57 - "shared/api/auth.ts"
Cohesion: 0.28
Nodes (8): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "AdminRouter.tsx"
Cohesion: 0.24
Nodes (11): AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, Overview (+3 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.30
Nodes (8): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 64 - "APLineItem"
Cohesion: 0.25
Nodes (11): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), APValidationProps, apGroupKey(), buildGroupedRow() (+3 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (15): MAP, OrderStatusBadge(), SLIP, LITE, ACCEPTED, Props, SlipUpload(), SLIP (+7 more)

### Community 67 - "UserUsagePage.tsx"
Cohesion: 0.60
Nodes (4): fetchUserUsage(), getCols(), UserRow, UserUsagePage()

### Community 68 - "client.ts"
Cohesion: 0.20
Nodes (14): API_BASE, ApiClientOptions, createApiClient(), fetchTimeout(), resolveUrl(), countdown(), EMPTY, fmtHM() (+6 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "i18n/index.ts"
Cohesion: 0.40
Nodes (3): en, th, AdminKey

### Community 73 - "APInvoice.tsx"
Cohesion: 0.10
Nodes (13): APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, APInvoice(), APInvoice, PDFPageSelector(), Props (+5 more)

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 77 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APVendorSearch.tsx"
Cohesion: 0.19
Nodes (11): Props, VendorSearch(), Vendor, Badge(), BadgeVariant, Props, Coords, getCoords() (+3 more)

### Community 88 - "TKey"
Cohesion: 0.17
Nodes (13): NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES (+5 more)

### Community 94 - "CreditsPage.tsx"
Cohesion: 0.17
Nodes (15): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), label() (+7 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.13
Nodes (17): BatchAction, BatchActionBar(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf() (+9 more)

### Community 106 - "LLMLogsPage.tsx"
Cohesion: 0.21
Nodes (22): resolveAlert(), revokeSession(), fetchLLMLogs(), daysAgo(), endOfDay(), today(), ymd(), useTableData() (+14 more)

### Community 108 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+18 more)

### Community 111 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 121 - "useAuth"
Cohesion: 0.11
Nodes (21): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig (+13 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.11
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+12 more)

## Knowledge Gaps
- **602 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+597 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APReviewStep.tsx`, `unwrapDetail`, `ManualScan.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `AppHeader.tsx`, `orders.ts`, `CustomModal.tsx`, `Pricing.tsx`, `useAPSubmission.ts`, `OrderWorkspace.tsx`, `ExtractionsPage.tsx`, `EmailAutomationPage.tsx`, `AccountingReview.tsx`, `MainMappingTable.tsx`, `useMapping.ts`, `Overview.tsx`, `useOcrExtraction.ts`, `OrderActions.tsx`, `ap-invoice/constants.ts`, `APAmountSummary.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `adminFetch`, `JvEditor.tsx`, `QuotaModulesPage.tsx`, `TenantsPage.tsx`, `APAccountMappingStep.tsx`, `OrderHistory.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `shared/api/auth.ts`, `DocumentPreview.tsx`, `AdminRouter.tsx`, `AdminLogin.tsx`, `APLineItem`, `LanguageContext.tsx`, `UserUsagePage.tsx`, `client.ts`, `APInvoice.tsx`, `APVendorSearch.tsx`, `TKey`, `CreditsPage.tsx`, `OrderTable.tsx`, `LLMLogsPage.tsx`, `MetricChartImpl.tsx`, `useAuth`, `DataTable.tsx`?**
  _High betweenness centrality (0.255) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `client.ts`, `ReviewQueue.tsx`, `parseNum`, `useAPExtraction.test.ts`, `useAPExtraction.ts`, `api.ts`, `NotificationBell.tsx`, `JvEditor.tsx`, `Pricing.tsx`, `carmen.ts`, `ocr.ts`, `useAPSubmission.ts`, `OrderHistory.tsx`, `MainMappingTable.tsx`, `shared/api/credits.ts`, `useMapping.ts`, `useOcrSubmission.test.ts`, `useOcrExtraction.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `getCarmenUrl()` connect `getCarmenUrl` to `showToast`, `ReviewQueue.tsx`, `NotificationBell.tsx`, `APInvoice.tsx`, `AppHeader.tsx`, `Pricing.tsx`, `APAccountMappingStep.tsx`, `APVendorSearch.tsx`, `useAuth`, `useOcrSubmission.test.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _602 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `showToast` be split into smaller, more focused modules?**
  _Cohesion score 0.13015873015873017 - nodes in this community are weakly interconnected._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._
- **Should `ManualScan.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1010752688172043 - nodes in this community are weakly interconnected._