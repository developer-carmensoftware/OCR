# Graph Report - OCR  (2026-10-07)

## Corpus Check
- 414 files · ~302,206 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2204 nodes · 6133 edges · 159 communities (98 shown, 61 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80873d69`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APLineItem
- ap-invoice/constants.ts
- dict/index.ts
- useT
- useMappingSuggestions.ts
- ReviewDocument.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- showToast
- CreditPack
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- adminFetch
- useReviewDocument.ts
- appKey
- ApiKeysPage.tsx
- ManualScan.tsx
- payment-mapping/types.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- shared/api/credits.ts
- AccountingReview.tsx
- useOcrWizard
- OrderActions.tsx
- DocumentPreview.tsx
- dependencies
- useAPExtraction.ts
- APAccountMappingStep.tsx
- ProformaDocument.tsx
- OrderWorkspace.tsx
- FeatureFlows.tsx
- apiFetch
- NotificationBell.tsx
- ArCustomerProfiles.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- adminAuth.ts
- PeriodPicker.tsx
- QueueRow.tsx
- useAuth
- ReviewQueue.tsx
- ApiKeysPage.test.tsx
- scripts
- AdminRouter.tsx
- i18n/apiKeys.ts
- useOcrSubmission.ts
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
- TKey
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
- OrderHistory.tsx
- ErrorBoundary
- CustomModal.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- storage.ts
- chrome.ts
- setup.ts
- Home.tsx
- i18n/tenants.ts
- checkout.ts
- OrderStatusBadge.tsx
- banks.ts
- vitest
- vite-env.d.ts
- i18n/email.ts
- mockPaths.test.ts
- client.ts
- buildQs
- jobs.ts
- EmailSettings.tsx
- LanguageProvider
- OrderTable.test.tsx
- AppHeader.test.tsx
- overview.ts
- APInvoice.tsx
- sessions.ts
- flows.ts
- dict/maintenance.ts
- main.tsx
- adminUsers.ts
- anomalies.ts
- cc.ts
- slip.ts
- useMapping.ts
- tutorial.ts
- warn.ts
- plan.ts
- llmLogs.ts
- @types/react
- notif.ts
- login.ts
- @types/react-dom
- quota.ts
- review.ts
- tenantRanking.ts
- Skeleton.tsx
- vite
- dict/ap.ts
- @testing-library/react
- ar.ts
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
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
1. `useT()` - 255 edges
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
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/components/BatchActionBar.tsx → frontend/src/i18n/dict/index.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (159 total, 61 thin omitted)

### Community 0 - "APLineItem"
Cohesion: 0.30
Nodes (9): APGroupModal(), profileLabel(), Props, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected() (+1 more)

### Community 1 - "ap-invoice/constants.ts"
Cohesion: 0.05
Nodes (59): Props, Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APFieldMappingStep() (+51 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "useT"
Cohesion: 0.07
Nodes (61): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchTenantDetail(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage() (+53 more)

### Community 4 - "useMappingSuggestions.ts"
Cohesion: 0.14
Nodes (23): AccountMappingTable(), GLAccount, Props, suggestMapping(), suggestPaymentTypes(), MainMappingTable(), Props, BulkApplyBar() (+15 more)

### Community 5 - "ReviewDocument.tsx"
Cohesion: 0.21
Nodes (11): RowAction(), Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), FIX, fixLinkProps(), REASON_KEY (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.14
Nodes (33): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+25 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (25): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+17 more)

### Community 8 - "screens.tsx"
Cohesion: 0.13
Nodes (20): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+12 more)

### Community 9 - "showToast"
Cohesion: 0.14
Nodes (19): Args, useAPDraft(), mountRestored(), TAX_PROFILES, APVendorProps, useAPVendor(), APInvoice(), OcrDraftState (+11 more)

### Community 10 - "CreditPack"
Cohesion: 0.17
Nodes (12): Props, EnterpriseCard(), PlanCardProps, LITE, TIER_ICONS, TourCatalog, ENTERPRISE, PackPresentation (+4 more)

### Community 11 - "orders.ts"
Cohesion: 0.16
Nodes (22): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+14 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.15
Nodes (19): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+11 more)

### Community 15 - "adminFetch"
Cohesion: 0.11
Nodes (43): createApiKey(), unwrapDetail(), EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult (+35 more)

### Community 16 - "useReviewDocument.ts"
Cohesion: 0.05
Nodes (57): approveDocument(), getPending(), rejectDocument(), DATE_KEYS, HeaderCard(), Props, BlockReason, BU_WIDE (+49 more)

### Community 17 - "appKey"
Cohesion: 0.12
Nodes (23): getAccountingConfig, seedOcrBranch(), MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), DetailRow (+15 more)

### Community 18 - "ApiKeysPage.tsx"
Cohesion: 0.10
Nodes (28): ApiKeyRow, fetchApiKeys(), IssuedApiKey, CreateKeyDialog(), Props, Props, RevokeKeyDialog(), TenantSearch() (+20 more)

### Community 19 - "ManualScan.tsx"
Cohesion: 0.16
Nodes (10): BANK_LOGOS, BankDetectionBanner(), Props, INSTRUCTIONS, Props, UploadSection(), FormActions(), Props (+2 more)

### Community 20 - "payment-mapping/types.ts"
Cohesion: 0.19
Nodes (22): MappingRow(), Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf() (+14 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (24): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+16 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): getStoredToken(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "FieldMapping"
Cohesion: 0.25
Nodes (13): AddError, MappingItem, Undo, FeeInvoiceSource, MappingSetsInput, labels, ActiveScan, Suggestion (+5 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.15
Nodes (23): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+15 more)

### Community 28 - "AccountingReview.tsx"
Cohesion: 0.33
Nodes (7): DEFAULT_EMPTY_OBJECT, Props, configBanks, DetailRow, Props, Props, BankCode

### Community 29 - "useOcrWizard"
Cohesion: 0.10
Nodes (26): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+18 more)

### Community 30 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.05
Nodes (49): DEFAULT_MAPPINGS, EMPTY_HEADER, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch (+41 more)

### Community 34 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 35 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.10
Nodes (25): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), fetchAdminOrderDocuments() (+17 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "apiFetch"
Cohesion: 0.12
Nodes (32): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+24 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.06
Nodes (45): ActivityPage, WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList (+37 more)

### Community 40 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.15
Nodes (16): fetchQuotaOverview(), toggleTenantModule(), KPICard(), KPICardProps, getTabs(), monthStartStr(), QuotaModulesPage(), quotaTier() (+8 more)

### Community 44 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 45 - "PeriodPicker.tsx"
Cohesion: 0.08
Nodes (44): fetchAlerts(), fetchErrorBreakdown(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), LazyMetricChart, MetricChart(), axisTick (+36 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.21
Nodes (16): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+8 more)

### Community 47 - "useAuth"
Cohesion: 0.16
Nodes (12): AppHeader(), ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal() (+4 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 49 - "ApiKeysPage.test.tsx"
Cohesion: 0.22
Nodes (6): createApiKey, fetchApiKeys, fetchTenants, revokeApiKey, ROW, writeText

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "AdminRouter.tsx"
Cohesion: 0.35
Nodes (8): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminProtectedRoute(), useAdminAuth()

### Community 53 - "useOcrSubmission.ts"
Cohesion: 0.11
Nodes (18): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+10 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.14
Nodes (15): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP (+7 more)

### Community 57 - "OrderTable.tsx"
Cohesion: 0.13
Nodes (18): AdminCreditOrder, BatchAction, BatchActionBar(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction (+10 more)

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
Cohesion: 0.23
Nodes (11): exchangeSSOToken(), getUsage(), revokeSession(), UsageData, resolveUrl(), T, base, Usage (+3 more)

### Community 63 - "api.ts"
Cohesion: 0.11
Nodes (14): SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse, ExtractedAPInvoiceData (+6 more)

### Community 64 - "TKey"
Cohesion: 0.33
Nodes (8): NavItem, NavSection, CompanyInfoSection(), PLACEHOLDER_KEYS, Props, CompanyField, CompanyData, TKey

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 67 - "DetailTable.tsx"
Cohesion: 0.25
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
Nodes (19): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, causeLabel() (+11 more)

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
Cohesion: 0.23
Nodes (13): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ApproveResult, ItxOverrides, listActivity(), markChipSeen(), ReviewDocument (+5 more)

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
Cohesion: 0.08
Nodes (17): en, th, en, th, AdminKey, en, th, en (+9 more)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (23): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+15 more)

### Community 82 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 83 - "CustomModal.tsx"
Cohesion: 0.29
Nodes (5): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.14
Nodes (20): PackList(), PlanCard(), priceLines(), PurchaseStep, purchaseTutorial(), STEPS, PurchaseTutorial(), BillingFigure() (+12 more)

### Community 88 - "storage.ts"
Cohesion: 0.24
Nodes (11): AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), APP_STORAGE_BASES, clearAppStorage(), getCarmenUri(), NOTE: per-user keys (consent), global UI prefs (theme, lang) and (+3 more)

### Community 91 - "Home.tsx"
Cohesion: 0.15
Nodes (15): OrderReviewShell(), ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, TagConfig (+7 more)

### Community 94 - "OrderStatusBadge.tsx"
Cohesion: 0.50
Nodes (3): MAP, OrderStatusBadge(), OrderStatus

### Community 95 - "banks.ts"
Cohesion: 0.14
Nodes (24): bankCodeFromHash(), BankConfigHook, useBankConfig(), codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape() (+16 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.23
Nodes (10): API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, clearToken(), createApiClient(), storeToken(), CarmenSSOState (+2 more)

### Community 106 - "buildQs"
Cohesion: 0.21
Nodes (12): revokeApiKey(), buildQs(), QueryParams, ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, TenantSubscriptionSummary (+4 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (54): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+46 more)

### Community 113 - "APInvoice.tsx"
Cohesion: 0.20
Nodes (9): APUploadStep(), INSTRUCTIONS, Props, AP_STEPS, APInvoice, DEFAULT_STEPS, Props, Step (+1 more)

### Community 117 - "main.tsx"
Cohesion: 0.22
Nodes (8): AdminRouter, container, getRoute(), ManualScan, Mapping, Pricing, Router(), PageSkeleton()

### Community 122 - "useMapping.ts"
Cohesion: 0.23
Nodes (13): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+5 more)

### Community 138 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

## Knowledge Gaps
- **660 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+655 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APLineItem`, `ap-invoice/constants.ts`, `useMappingSuggestions.ts`, `ReviewDocument.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `showToast`, `CreditPack`, `orders.ts`, `useSettlementMapping.ts`, `adminFetch`, `useReviewDocument.ts`, `ApiKeysPage.tsx`, `ManualScan.tsx`, `payment-mapping/types.ts`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `shared/api/credits.ts`, `AccountingReview.tsx`, `useOcrWizard`, `OrderActions.tsx`, `DocumentPreview.tsx`, `useAPExtraction.ts`, `APAccountMappingStep.tsx`, `ProformaDocument.tsx`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `ArCustomerProfiles.tsx`, `QuotaModulesPage.tsx`, `PeriodPicker.tsx`, `QueueRow.tsx`, `useAuth`, `ReviewQueue.tsx`, `AdminRouter.tsx`, `CheckoutFlow.tsx`, `OrderTable.tsx`, `shared/api/auth.ts`, `TKey`, `DetailTable.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `CustomModal.tsx`, `Pricing.tsx`, `Home.tsx`, `OrderStatusBadge.tsx`, `APInvoice.tsx`, `useMapping.ts`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useMappingSuggestions.ts`, `parseNum`, `showToast`, `CreditPack`, `useSettlementMapping.ts`, `useReviewDocument.ts`, `appKey`, `shared/api/credits.ts`, `useOcrWizard`, `useAPExtraction.ts`, `NotificationBell.tsx`, `QueueRow.tsx`, `useOcrSubmission.ts`, `api.ts`, `emailReview.ts`, `useUserConsent.ts`, `OrderHistory.tsx`, `client.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `API` connect `apiFetch` to `useT`, `showToast`, `orders.ts`, `useSettlementMapping.ts`, `adminFetch`, `appKey`, `ApiKeysPage.tsx`, `AdminLogin.tsx`, `shared/api/credits.ts`, `useAPExtraction.ts`, `OrderWorkspace.tsx`, `NotificationBell.tsx`, `adminAuth.ts`, `useOcrSubmission.ts`, `shared/api/auth.ts`, `api.ts`, `emailReview.ts`, `useUserConsent.ts`, `buildQs`, `EmailSettings.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _660 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ap-invoice/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `useT` be split into smaller, more focused modules?**
  _Cohesion score 0.07031463748290014 - nodes in this community are weakly interconnected._