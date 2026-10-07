# Graph Report - OCR  (2026-10-07)

## Corpus Check
- 404 files · ~298,171 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2164 nodes · 6022 edges · 156 communities (95 shown, 61 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ffa9b099`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- parseNum
- APReviewStep.tsx
- dict/index.ts
- PeriodPicker.tsx
- MainMappingTable.tsx
- getCarmenUrl
- useAPInvoice.ts
- TutorialModal.tsx
- useT
- useAPExtraction.test.ts
- useMappingData.ts
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- ccJv.ts
- appKey
- unwrapDetail
- TKey
- payment-mapping/types.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- shared/api/credits.ts
- useReviewDocument.ts
- useOcrWizard.ts
- adminFetch
- DocumentPreview.tsx
- dependencies
- useAPExtraction.ts
- APInvoice.tsx
- date.ts
- SlipViewer.tsx
- FeatureFlows.tsx
- apiFetch
- useNotifications.ts
- usePdfPasswordPrompt
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- adminAuth.ts
- ErrorsPage.tsx
- QueueRow.tsx
- useAuth
- ReviewQueue.tsx
- DataTable.tsx
- scripts
- routes.tsx
- i18n/apiKeys.ts
- config.ts
- compilerOptions
- TenantSelector.test.tsx
- CheckoutFlow.tsx
- OrderTable.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- Mapping.test.tsx
- shared/api/auth.ts
- api.ts
- NotificationBell.tsx
- Carmen AI — OCR & Import System
- i18n/common.ts
- DetailTable.tsx
- errors.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- emailReview.ts
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- OrderWorkspace.tsx
- extractions.ts
- i18n/maintenance.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- storage.ts
- chrome.ts
- performance.ts
- AppHeader.tsx
- i18n/tenants.ts
- checkout.ts
- banks.ts
- vitest
- vite-env.d.ts
- i18n/email.ts
- mockPaths.test.ts
- client.ts
- TenantsPage.tsx
- jobs.ts
- EmailSettings.tsx
- i18n/usage.ts
- LanguageContext.tsx
- useNotifications.test.ts
- main.tsx
- adminUsers.ts
- anomalies.ts
- cc.ts
- slip.ts
- useMapping.ts
- tutorial.ts
- warn.ts
- dict/common.ts
- llmLogs.ts
- @types/react
- notif.ts
- login.ts
- @types/react-dom
- qr.ts
- quota.ts
- review.ts
- i18n/quotas.ts
- tenantRanking.ts
- ManualScan.tsx
- vite
- dict/ap.ts
- @testing-library/react
- ar.ts
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- orev.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- pack.ts
- proforma.ts
- dict/usage.ts
- whatsnew.ts
- eslint
- home.ts
- dict/modal.ts
- pricing.ts
- jsdom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 248 edges
2. `adminFetch` - 68 edges
3. `apiFetch` - 60 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 38 edges
7. `TKey` - 38 edges
8. `appKey()` - 36 edges
9. `showToast()` - 34 edges
10. `round2()` - 31 edges

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

## Communities (156 total, 61 thin omitted)

### Community 0 - "parseNum"
Cohesion: 0.17
Nodes (23): AmountSummary(), APGroupModal(), profileLabel(), Props, adjustField(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+15 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.05
Nodes (44): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APLineItemsTable(), Props (+36 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "PeriodPicker.tsx"
Cohesion: 0.10
Nodes (52): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), Column (+44 more)

### Community 4 - "MainMappingTable.tsx"
Cohesion: 0.11
Nodes (23): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, BulkApplyBar(), MainMappings, MainMappingKey (+15 more)

### Community 5 - "getCarmenUrl"
Cohesion: 0.19
Nodes (12): APSuccessStep(), RowAction(), AuthScreen(), ExtractionWarningBanner(), Props, FIX, fixLinkProps(), REASON_KEY (+4 more)

### Community 6 - "useAPInvoice.ts"
Cohesion: 0.17
Nodes (17): useAPGrouping(), useAPInvoice(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER, header(), masterReconcile() (+9 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (29): OrderDrawer(), DEMO_PLANS, CATALOG, FOCUS_STEPS, PURCHASE_FIGURES, PURCHASE_TUTORIAL, Spot(), SpotContext (+21 more)

### Community 8 - "useT"
Cohesion: 0.11
Nodes (26): PackList(), PendingOrderBanner(), EnterpriseCard(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_SLIP (+18 more)

### Community 9 - "useAPExtraction.test.ts"
Cohesion: 0.18
Nodes (10): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+2 more)

### Community 10 - "useMappingData.ts"
Cohesion: 0.39
Nodes (10): GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+2 more)

### Community 11 - "orders.ts"
Cohesion: 0.11
Nodes (33): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminOrderDocuments(), fetchAdminPaymentInfo(), fetchKpi(), getOrderSlipUrl(), holdBatch() (+25 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.25
Nodes (8): AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig, EXPIRED_FLAG_KEY

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.14
Nodes (21): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+13 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.11
Nodes (20): JvHeaderCard(), Props, TopLevelConfigSection(), CONFIG, leg(), rows(), TWO_LINES, buildJvRows() (+12 more)

### Community 17 - "appKey"
Cohesion: 0.15
Nodes (17): DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, persistScanForMapping(), extractFromFile, MOCK_EXTRACTED (+9 more)

### Community 18 - "unwrapDetail"
Cohesion: 0.19
Nodes (20): ApiKeyRow, createApiKey(), fetchApiKeys(), IssuedApiKey, revokeApiKey(), unwrapDetail(), AdminUserRow, createAdminUser() (+12 more)

### Community 19 - "TKey"
Cohesion: 0.12
Nodes (17): BatchAction, BatchActionBar(), Props, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection() (+9 more)

### Community 20 - "payment-mapping/types.ts"
Cohesion: 0.21
Nodes (21): MappingRow(), Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf() (+13 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (24): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+16 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.22
Nodes (13): OrderHistory(), parseFocusId(), getStoredToken(), resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT() (+5 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "FieldMapping"
Cohesion: 0.28
Nodes (11): AddError, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels, ActiveScan, Suggestion (+3 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.10
Nodes (29): SLIP, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+21 more)

### Community 28 - "useReviewDocument.ts"
Cohesion: 0.10
Nodes (28): approveDocument(), getPending(), ItxOverrides, rejectDocument(), Props, Props, DetailRow, Props (+20 more)

### Community 29 - "useOcrWizard.ts"
Cohesion: 0.10
Nodes (30): useAPDraft(), mountRestored(), TAX_PROFILES, useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal() (+22 more)

### Community 30 - "adminFetch"
Cohesion: 0.24
Nodes (19): buildQs(), QueryParams, fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchErrorBreakdown() (+11 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.29
Nodes (7): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (21): Args, APExtractionProps, EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args, imagesToPdf() (+13 more)

### Community 34 - "APInvoice.tsx"
Cohesion: 0.08
Nodes (37): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+29 more)

### Community 35 - "date.ts"
Cohesion: 0.23
Nodes (11): DATE_KEYS, HeaderCard(), Props, jvhDate(), DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE() (+3 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "apiFetch"
Cohesion: 0.10
Nodes (33): _fetchExtract(), GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+25 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.18
Nodes (15): WhatsNew(), listNotifications(), markNotificationsRead(), Notification, LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote (+7 more)

### Community 40 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.17
Nodes (16): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps (+8 more)

### Community 44 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 45 - "ErrorsPage.tsx"
Cohesion: 0.11
Nodes (20): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+12 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.21
Nodes (13): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+5 more)

### Community 47 - "useAuth"
Cohesion: 0.17
Nodes (11): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), A (+3 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 49 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+12 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "routes.tsx"
Cohesion: 0.26
Nodes (11): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, Overview (+3 more)

### Community 53 - "config.ts"
Cohesion: 0.07
Nodes (36): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS (+28 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.11
Nodes (18): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP (+10 more)

### Community 57 - "OrderTable.tsx"
Cohesion: 0.08
Nodes (32): AdminCreditOrder, ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS (+24 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 62 - "shared/api/auth.ts"
Cohesion: 0.25
Nodes (9): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats (+1 more)

### Community 63 - "api.ts"
Cohesion: 0.12
Nodes (20): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, JvEditor(), rowId(), MappingSuggestionsHook, useMappingSuggestions() (+12 more)

### Community 64 - "NotificationBell.tsx"
Cohesion: 0.20
Nodes (15): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+7 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 67 - "DetailTable.tsx"
Cohesion: 0.22
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "ExtractionsPage.tsx"
Cohesion: 0.14
Nodes (17): ExtractionFailureRow, DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps (+9 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "emailReview.ts"
Cohesion: 0.20
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 77 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93, phase 1: an inbox, nothing processes it yet)

### Community 80 - "i18n/index.ts"
Cohesion: 0.09
Nodes (12): en, th, adminDict, AdminKey, en, th, en, th (+4 more)

### Community 81 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (31): ContactBuyer(), num(), VerifyFacts(), WsAction, wsInitial, wsReducer(), OrderRow(), RowAction (+23 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.13
Nodes (26): Props, Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, priceLines(), PurchaseStep (+18 more)

### Community 88 - "storage.ts"
Cohesion: 0.21
Nodes (13): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), APP_STORAGE_BASES (+5 more)

### Community 91 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (9): registerDict(), OrderReviewShell, AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow() (+1 more)

### Community 95 - "banks.ts"
Cohesion: 0.11
Nodes (30): BANK_LOGOS, CompanyInfoSection(), PLACEHOLDER_KEYS, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField (+22 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.27
Nodes (9): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), CarmenSSOState, open() (+1 more)

### Community 106 - "TenantsPage.tsx"
Cohesion: 0.15
Nodes (21): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants() (+13 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (52): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+44 more)

### Community 113 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (16): APUploadStep(), INSTRUCTIONS, Props, Lang, Ctx, FALLBACK_CTX, LanguageCtx, LanguageProvider() (+8 more)

### Community 116 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 117 - "main.tsx"
Cohesion: 0.11
Nodes (13): container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory, Pricing, Router() (+5 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.14
Nodes (18): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+10 more)

### Community 138 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (16): DEFAULT_EMPTY_OBJECT, configBanks, BankDetectionBanner(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG (+8 more)

## Knowledge Gaps
- **649 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+644 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `parseNum`, `APReviewStep.tsx`, `PeriodPicker.tsx`, `MainMappingTable.tsx`, `getCarmenUrl`, `useAPInvoice.ts`, `TutorialModal.tsx`, `ManualScan.tsx`, `orders.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `ccJv.ts`, `unwrapDetail`, `TKey`, `payment-mapping/types.ts`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `shared/api/credits.ts`, `useReviewDocument.ts`, `useOcrWizard.ts`, `adminFetch`, `DocumentPreview.tsx`, `useAPExtraction.ts`, `APInvoice.tsx`, `date.ts`, `SlipViewer.tsx`, `FeatureFlows.tsx`, `apiFetch`, `useNotifications.ts`, `QuotaModulesPage.tsx`, `ErrorsPage.tsx`, `QueueRow.tsx`, `useAuth`, `ReviewQueue.tsx`, `DataTable.tsx`, `routes.tsx`, `CheckoutFlow.tsx`, `OrderTable.tsx`, `shared/api/auth.ts`, `api.ts`, `NotificationBell.tsx`, `DetailTable.tsx`, `ExtractionsPage.tsx`, `OrderWorkspace.tsx`, `Pricing.tsx`, `AppHeader.tsx`, `banks.ts`, `TenantsPage.tsx`, `LanguageContext.tsx`, `useMapping.ts`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `showToast()` connect `apiFetch` to `useAPExtraction.ts`, `useAPInvoice.ts`, `EmailSettings.tsx`, `appKey`, `config.ts`, `storage.ts`, `useMapping.ts`, `useReviewDocument.ts`, `useOcrWizard.ts`, `api.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `appKey()` connect `appKey` to `useAPExtraction.ts`, `useAPInvoice.ts`, `useAPExtraction.test.ts`, `ManualScan.tsx`, `ReviewDocument.test.tsx`, `useAuth`, `config.ts`, `storage.ts`, `FieldMapping`, `useMapping.ts`, `useReviewDocument.ts`, `useOcrWizard.ts`, `banks.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _649 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.053939714436805924 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `PeriodPicker.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10240384615384615 - nodes in this community are weakly interconnected._