# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 375 files · ~255,234 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1977 nodes · 5431 edges · 152 communities (102 shown, 50 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7891b0bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APInvoice.tsx
- dict/index.ts
- adminFetch
- ManualScan.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- AppHeader.test.tsx
- orders.ts
- CreditOrdersPage.tsx
- CheckoutFlow.tsx
- eslint-plugin-react-hooks
- useAPSubmission.test.ts
- useReviewDocument.ts
- endpoints.ts
- OrderWorkspace.tsx
- ExtractionsPage.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- banks.ts
- JvEditor.tsx
- Pricing.tsx
- devDependencies
- useMapping.ts
- Overview.tsx
- useOcrSubmission.test.ts
- showToast
- OrderActions.tsx
- dependencies
- MainMappingTable.tsx
- NumericInput.tsx
- Mapping.tsx
- useAuth
- FeatureFlows.tsx
- useAPExtraction.ts
- WhatsNew.tsx
- useFileUpload.ts
- MaintenancePage.tsx
- constants/index.ts
- useAPSubmission.ts
- useMappingData.ts
- QuotaModulesPage.tsx
- TenantsPage.tsx
- main.tsx
- usePdfPasswordPrompt
- APAccountMappingStep.tsx
- scripts
- OrderHistory.tsx
- storage.ts
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- client.ts
- CLAUDE.md
- Contributing
- eslint
- NotificationDetailModal.tsx
- AdminRouter.tsx
- AdminLogin.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageProvider
- NotificationBell.tsx
- MaintenanceGate.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminUsers.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- toast.ts
- adminAuth.ts
- vercel.json
- Architecture
- i18n/index.ts
- setup.ts
- llmLogs.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APReviewStep.tsx
- Home.tsx
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
- routes.tsx
- i18n/common.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- useT
- TKey
- EmailSettings.tsx
- errors.ts
- orev.ts
- quotas.ts
- extractions.ts
- contact.ts
- NotificationBell.test.tsx
- releaseNotes.ts
- ProtectedRoute.tsx
- i18n/maintenance.ts
- DataTable.tsx
- Tooltip.tsx
- UserConsentModal.tsx
- review.ts
- dict/ap.ts
- whatsnew.ts
- Button.tsx
- cc.ts
- OrderTable.test.tsx
- typescript
- i18n/nav.ts
- dict/common.ts
- dict/maintenance.ts
- dict/usage.ts
- notif.ts
- i18n/usage.ts
- i18n/tenants.ts
- pack.ts
- qr.ts
- proforma.ts
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
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Args` --references--> `useAPExtraction()`  [EXTRACTED]
  frontend/src/features/ap-invoice/hooks/useAPGrouping.ts → frontend/src/features/ap-invoice/hooks/useAPExtraction.ts
- `SupportedLayouts()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/billing/components/FeatureFlows.tsx → frontend/src/i18n/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (152 total, 50 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.21
Nodes (14): Args, useAPDraft(), APExtractionProps, useAPVendor(), OcrDraftState, CcDraft, clearDraft(), DraftKind (+6 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (33): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, Ctrl, APTableFooter() (+25 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "adminFetch"
Cohesion: 0.40
Nodes (13): unwrapDetail(), postArBatch(), updateArProfile(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles() (+5 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.08
Nodes (29): ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, AMOUNT_FIELDS, DetailRow, DetailTable(), formatAmount(), Props (+21 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.05
Nodes (52): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+44 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (30): getAvailableFields(), mountRestored(), TAX_PROFILES, useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure() (+22 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (25): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+17 more)

### Community 8 - "screens.tsx"
Cohesion: 0.08
Nodes (34): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+26 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 11 - "orders.ts"
Cohesion: 0.23
Nodes (14): approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, listCreditOrders(), PostArResponse (+6 more)

### Community 12 - "CreditOrdersPage.tsx"
Cohesion: 0.22
Nodes (11): AdminCreditOrder, AdminOrderStatus, KpiSummary, OrderDrawer(), Props, OrderKpiCards(), Props, MainTab (+3 more)

### Community 13 - "CheckoutFlow.tsx"
Cohesion: 0.18
Nodes (13): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, LITE, isSubscriptionCode(), PACK_META, PLAN_META (+5 more)

### Community 15 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 16 - "useReviewDocument.ts"
Cohesion: 0.10
Nodes (25): approveDocument(), getPending(), useReviewDocument(), approve(), descriptionForBank(), CONFIG, leg(), rows() (+17 more)

### Community 17 - "endpoints.ts"
Cohesion: 0.27
Nodes (7): APVendorProps, Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), API

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (11): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 19 - "ExtractionsPage.tsx"
Cohesion: 0.28
Nodes (11): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+3 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "banks.ts"
Cohesion: 0.18
Nodes (18): BankConfigHook, codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape(), NormalizedConfig (+10 more)

### Community 24 - "JvEditor.tsx"
Cohesion: 0.13
Nodes (21): AccountMappingTable(), GLAccount, suggestPaymentTypes(), BlockReason, BU_WIDE, JvEditor(), Overrides, rowId() (+13 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.16
Nodes (19): Props, PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, ENTERPRISE (+11 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "useMapping.ts"
Cohesion: 0.14
Nodes (24): getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), useMappingSuggestions(), usePaymentTypes() (+16 more)

### Community 28 - "Overview.tsx"
Cohesion: 0.21
Nodes (16): buildQs(), QueryParams, fetchAlerts(), fetchErrorBreakdown(), fetchExtractionFailures(), fetchPerformanceLogs(), fetchUsageSummary(), fetchUsageTotals() (+8 more)

### Community 29 - "useOcrSubmission.test.ts"
Cohesion: 0.17
Nodes (11): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+3 more)

### Community 30 - "showToast"
Cohesion: 0.14
Nodes (22): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+14 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "MainMappingTable.tsx"
Cohesion: 0.27
Nodes (16): Props, Props, GlMasters, ActiveScan, MainMappings, MasterAccount, MasterDepartment, MainMappingKey (+8 more)

### Community 34 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 35 - "Mapping.tsx"
Cohesion: 0.13
Nodes (14): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BANK_OPTIONS, Props, TopLevelConfigSection(), CompanyData (+6 more)

### Community 36 - "useAuth"
Cohesion: 0.17
Nodes (15): getConsentStatus(), postConsent(), AppHeader(), ConsentGate(), Props, AuthUser, A, B (+7 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (30): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping (+22 more)

### Community 39 - "WhatsNew.tsx"
Cohesion: 0.21
Nodes (11): WhatsNew(), WhatsNew, listNotifications, markNotificationsRead, page(), SERVER_ROW, setup(), markReleaseSeen() (+3 more)

### Community 40 - "useFileUpload.ts"
Cohesion: 0.18
Nodes (8): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 41 - "MaintenancePage.tsx"
Cohesion: 0.40
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 42 - "constants/index.ts"
Cohesion: 0.19
Nodes (10): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS, DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 43 - "useAPSubmission.ts"
Cohesion: 0.16
Nodes (18): GLAccount, useAPSubmission(), addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), _parseCarmenHttpError() (+10 more)

### Community 44 - "useMappingData.ts"
Cohesion: 0.32
Nodes (11): JvHeaderCard(), Props, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes() (+3 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (23): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), Card(), CardProps (+15 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.11
Nodes (20): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, KPICard() (+12 more)

### Community 47 - "main.tsx"
Cohesion: 0.11
Nodes (13): APInvoice, container, getRoute(), Home, ManualScan, OrderHistory, OrderReviewShell, Pricing (+5 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 49 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (25): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, BillingFigure(), catalogName(), ActivePlanBanner() (+17 more)

### Community 52 - "storage.ts"
Cohesion: 0.14
Nodes (19): JvState, Props, DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionHook, OcrExtractionProps, OcrSubmissionHook (+11 more)

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.33
Nodes (8): ArCustomerProfile, listArProfiles(), syncArProfiles(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.16
Nodes (21): fetchTenantRanking(), Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+13 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (28): WsState, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+20 more)

### Community 57 - "client.ts"
Cohesion: 0.13
Nodes (24): exchangeSSOToken(), getUsage(), revokeSession(), UsageData, API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, clearToken() (+16 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "NotificationDetailModal.tsx"
Cohesion: 0.28
Nodes (9): BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationDetailModal(), Props, REASON_KEY, releaseRow() (+1 more)

### Community 62 - "AdminRouter.tsx"
Cohesion: 0.27
Nodes (10): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, AdminRouter (+2 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 64 - "APLineItem"
Cohesion: 0.18
Nodes (15): Props, APGroupModal(), profileLabel(), Props, APSuccessStep(), Props, ApDraft, APDraftState (+7 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.10
Nodes (12): MAP, OrderStatusBadge(), PendingOrderBanner(), SLIP, ACCEPTED, Props, SlipUpload(), SLIP (+4 more)

### Community 67 - "NotificationBell.tsx"
Cohesion: 0.28
Nodes (11): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), TFn (+3 more)

### Community 68 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "toast.ts"
Cohesion: 0.22
Nodes (7): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult, ToastType

### Community 77 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.08
Nodes (16): en, th, en, th, adminDict, AdminKey, en, th (+8 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APReviewStep.tsx"
Cohesion: 0.11
Nodes (24): Props, AmountSummary(), Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets (+16 more)

### Community 88 - "Home.tsx"
Cohesion: 0.16
Nodes (13): ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, Props, DarkModeToggle() (+5 more)

### Community 94 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 106 - "routes.tsx"
Cohesion: 0.16
Nodes (27): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchLLMLogs(), daysAgo(), endOfDay(), today() (+19 more)

### Community 108 - "emailAutomation.ts"
Cohesion: 0.20
Nodes (20): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRulePayload, EmailSettings, getBankCodes() (+12 more)

### Community 111 - "useT"
Cohesion: 0.08
Nodes (32): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+24 more)

### Community 112 - "TKey"
Cohesion: 0.25
Nodes (8): BatchAction, BatchActionBar(), Props, NavItem, NavSection, APValidationProps, TagConfig, TKey

### Community 113 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE, EmailSettings

### Community 119 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 120 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 121 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (10): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+2 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.10
Nodes (21): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+13 more)

### Community 124 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 125 - "UserConsentModal.tsx"
Cohesion: 0.40
Nodes (5): COPY, Lang, Props, useIsMobile(), UserConsentModal()

### Community 129 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

## Knowledge Gaps
- **600 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+595 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APInvoice.tsx`, `adminFetch`, `ManualScan.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `orders.ts`, `CreditOrdersPage.tsx`, `CheckoutFlow.tsx`, `useReviewDocument.ts`, `endpoints.ts`, `OrderWorkspace.tsx`, `ExtractionsPage.tsx`, `EmailAutomationPage.tsx`, `JvEditor.tsx`, `Pricing.tsx`, `Overview.tsx`, `showToast`, `OrderActions.tsx`, `Mapping.tsx`, `useAuth`, `FeatureFlows.tsx`, `useAPExtraction.ts`, `WhatsNew.tsx`, `MaintenancePage.tsx`, `constants/index.ts`, `useMappingData.ts`, `QuotaModulesPage.tsx`, `TenantsPage.tsx`, `APAccountMappingStep.tsx`, `OrderHistory.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `client.ts`, `NotificationDetailModal.tsx`, `AdminRouter.tsx`, `AdminLogin.tsx`, `APLineItem`, `LanguageProvider`, `NotificationBell.tsx`, `MaintenanceGate.tsx`, `i18n/index.ts`, `APReviewStep.tsx`, `Home.tsx`, `CreditsPage.tsx`, `OrderTable.tsx`, `routes.tsx`, `TKey`, `DataTable.tsx`, `UserConsentModal.tsx`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `useAPExtraction.ts` to `useOcrWizard.ts`, `useAuth`, `ReviewQueue.tsx`, `parseNum`, `api.ts`, `useAPSubmission.ts`, `useMappingData.ts`, `useAPSubmission.test.ts`, `useReviewDocument.ts`, `endpoints.ts`, `OrderHistory.tsx`, `JvEditor.tsx`, `client.ts`, `shared/api/credits.ts`, `useMapping.ts`, `NotificationDetailModal.tsx`, `Pricing.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `API` connect `endpoints.ts` to `adminFetch`, `ReviewQueue.tsx`, `api.ts`, `orders.ts`, `EmailAutomationPage.tsx`, `useMapping.ts`, `Overview.tsx`, `useAuth`, `useAPExtraction.ts`, `MaintenancePage.tsx`, `useAPSubmission.ts`, `QuotaModulesPage.tsx`, `TenantsPage.tsx`, `shared/api/credits.ts`, `client.ts`, `NotificationDetailModal.tsx`, `AdminLogin.tsx`, `adminAuth.ts`, `CreditsPage.tsx`, `routes.tsx`, `emailAutomation.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _600 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08686868686868687 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `ManualScan.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._