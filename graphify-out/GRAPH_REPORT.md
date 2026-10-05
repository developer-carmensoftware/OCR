# Graph Report - OCR  (2026-10-05)

## Corpus Check
- 400 files · ~296,693 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2149 nodes · 5946 edges · 158 communities (100 shown, 58 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e17ae731`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- draft.ts
- ap-invoice/constants.ts
- dict/index.ts
- ExtractionsPage.tsx
- MainMappingTable.tsx
- LanguageContext.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- PeriodPicker.tsx
- orders.ts
- OrderHistory.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- Mapping.tsx
- useOcrExtraction.test.ts
- adminFetch
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
- useOcrWizard
- CreditsPage.tsx
- OrderTable.tsx
- dependencies
- useAPExtraction.ts
- appKey
- useMappingData.ts
- OrderWorkspace.tsx
- FeatureFlows.tsx
- apiFetch
- NotificationBell.tsx
- ocr.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- adminAuth.ts
- DocumentPreview.tsx
- QueueRow.tsx
- storage.ts
- useT
- DataTable.tsx
- scripts
- AdminRouter.tsx
- OrderDrawer.tsx
- showToast
- compilerOptions
- TenantSelector.tsx
- PendingOrderBanner.tsx
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- Mapping.test.tsx
- APInvoice.tsx
- AuthContext.tenancy.test.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- OrderTable.test.tsx
- ManualScan.tsx
- APLineItem
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- config.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- ReviewQueue.tsx
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- CheckoutFlow.tsx
- ArCustomerProfiles.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- chrome.ts
- routes.tsx
- AppHeader.test.tsx
- i18n/common.ts
- checkout.ts
- i18n/credits.ts
- banks.ts
- vitest
- vite-env.d.ts
- i18n/email.ts
- mockPaths.test.ts
- useAuth
- extractions.ts
- jobs.ts
- EmailSettings.tsx
- i18n/usage.ts
- MetricChartImpl.tsx
- main.tsx
- cc.ts
- slip.ts
- useMapping.ts
- tutorial.ts
- warn.ts
- dict/common.ts
- ErrorBoundary
- llmLogs.ts
- dict/maintenance.ts
- @types/react
- notif.ts
- login.ts
- @types/react-dom
- qr.ts
- quota.ts
- review.ts
- i18n/quotas.ts
- Skeleton.tsx
- vite
- dict/ap.ts
- @testing-library/react
- ar.ts
- @testing-library/jest-dom
- contact.ts
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
- plan.ts
- proforma.ts
- dict/usage.ts
- whatsnew.ts
- eslint
- flows.ts
- home.ts
- dict/modal.ts
- pricing.ts
- jsdom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 246 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 60 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `TKey` - 38 edges
7. `appKey()` - 36 edges
8. `unwrapDetail()` - 34 edges
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

## Communities (158 total, 58 thin omitted)

### Community 0 - "draft.ts"
Cohesion: 0.24
Nodes (10): useAPDraft(), mountRestored(), TAX_PROFILES, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 1 - "ap-invoice/constants.ts"
Cohesion: 0.07
Nodes (45): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APFieldMappingStep(), COLS (+37 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.32
Nodes (6): DICT, en, th, translate(), FILES, NAMESPACE_FILES

### Community 3 - "ExtractionsPage.tsx"
Cohesion: 0.11
Nodes (32): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), ExtractionFailureRow, fetchExtractionFailures(), fetchPerformanceLogs() (+24 more)

### Community 4 - "MainMappingTable.tsx"
Cohesion: 0.16
Nodes (11): Props, MainMappings, MainMappingKey, SuggestionSource, CustomSearchSelect(), handleScroll(), panelStyle(), Props (+3 more)

### Community 5 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (14): MAP, OrderStatusBadge(), ACCEPTED, Props, SLIP, Lang, Ctx, FALLBACK_CTX (+6 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (28): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+20 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.11
Nodes (28): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+20 more)

### Community 9 - "api.ts"
Cohesion: 0.10
Nodes (19): Props, Props, DESCRIPTION_TAGS, DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate(), AccountingConfigRequest (+11 more)

### Community 10 - "PeriodPicker.tsx"
Cohesion: 0.11
Nodes (39): fetchErrorBreakdown(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), fetchUserUsage(), Column, MetricChart(), daysAgo() (+31 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (15): PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), OrderHistory(), parseFocusId(), Pricing() (+7 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.20
Nodes (15): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+7 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.14
Nodes (24): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+16 more)

### Community 16 - "Mapping.tsx"
Cohesion: 0.10
Nodes (26): AccountingReview(), JvHeaderCard(), TopLevelConfigSection(), buildMappingSets(), descriptionForBank(), CONFIG, leg(), rows() (+18 more)

### Community 17 - "useOcrExtraction.test.ts"
Cohesion: 0.33
Nodes (5): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData()

### Community 18 - "adminFetch"
Cohesion: 0.25
Nodes (20): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), AdminUserRow, createAdminUser() (+12 more)

### Community 19 - "TKey"
Cohesion: 0.13
Nodes (16): BatchAction, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection(), ACTIVE_TAG, containerVariants (+8 more)

### Community 20 - "payment-mapping/types.ts"
Cohesion: 0.15
Nodes (22): AccountMappingTable(), GLAccount, Props, MainMappingTable(), BulkApplyBar(), MappingTable(), Filter, orderOf() (+14 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (24): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+16 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.30
Nodes (8): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 25 - "FieldMapping"
Cohesion: 0.16
Nodes (18): PostType, SuggestResponse, Props, AddError, MappingItem, MappingSet, Undo, FeeInvoiceSource (+10 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.14
Nodes (25): Props, RowState, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist() (+17 more)

### Community 28 - "useReviewDocument.ts"
Cohesion: 0.10
Nodes (27): getPending(), ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, configBanks, DetailRow, Props, BlockReason (+19 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (22): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas() (+14 more)

### Community 34 - "appKey"
Cohesion: 0.22
Nodes (14): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+6 more)

### Community 35 - "useMappingData.ts"
Cohesion: 0.22
Nodes (17): MappingRow(), Props, Props, STATUS_LABEL, Props, MappingStatus, GlMasters, prefetchGlMasters() (+9 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (11): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "apiFetch"
Cohesion: 0.10
Nodes (33): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+25 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+34 more)

### Community 40 - "ocr.ts"
Cohesion: 0.14
Nodes (16): ApiError, ExtractedRow, extractFromFile(), PDF_PASSWORD_REQUIRED, PdfInfoResult, toExtractedRows(), COPY, Options (+8 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.11
Nodes (24): buildQs(), QueryParams, fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, TenantSubscriptionSummary (+16 more)

### Community 44 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 45 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.12
Nodes (24): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+16 more)

### Community 47 - "storage.ts"
Cohesion: 0.36
Nodes (6): APP_STORAGE_BASES, clearAppStorage(), getCarmenUri(), NOTE: per-user keys (consent), global UI prefs (theme, lang) and, setActiveTenant(), setCarmenUri()

### Community 48 - "useT"
Cohesion: 0.10
Nodes (27): BatchActionBar(), Props, AdminLayout(), getActiveHash(), NAV_SECTIONS, VendorSearch(), BuyChipFigure(), MockLang() (+19 more)

### Community 49 - "DataTable.tsx"
Cohesion: 0.12
Nodes (22): fetchLLMLogs(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir (+14 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "AdminRouter.tsx"
Cohesion: 0.15
Nodes (12): adminDict, AdminLogin, AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, Overview, registerDict() (+4 more)

### Community 52 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock()

### Community 53 - "showToast"
Cohesion: 0.09
Nodes (30): rejectDocument(), diffCorrections(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps (+22 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "TenantSelector.tsx"
Cohesion: 0.24
Nodes (7): fetchTenants(), label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS

### Community 56 - "PendingOrderBanner.tsx"
Cohesion: 0.23
Nodes (15): OrderRow(), RowAction, rowInitial, rowReducer(), SlipUpload(), catalogName(), isSubscriptionCode(), planChangeLoss() (+7 more)

### Community 57 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 62 - "APInvoice.tsx"
Cohesion: 0.11
Nodes (16): APAccountMappingStep(), fmtField(), APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, AP_STEPS, APInvoice() (+8 more)

### Community 63 - "AuthContext.tenancy.test.tsx"
Cohesion: 0.40
Nodes (3): A, B, Probe()

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.29
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 67 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (21): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+13 more)

### Community 68 - "APLineItem"
Cohesion: 0.14
Nodes (19): DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, GLAccount, GLCardProps, GLCardRow, PillProps, Props, Props (+11 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "config.ts"
Cohesion: 0.10
Nodes (18): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+10 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "ReviewQueue.tsx"
Cohesion: 0.08
Nodes (28): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument (+20 more)

### Community 77 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.06
Nodes (23): en, th, en, th, en, th, AdminKey, en (+15 more)

### Community 81 - "CheckoutFlow.tsx"
Cohesion: 0.15
Nodes (20): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, PaymentInfo, DEFAULT_STEPS, Props, Step (+12 more)

### Community 82 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.15
Nodes (16): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, TourCatalog (+8 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.33
Nodes (8): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), clearAllDrafts(), getJwtExpMs()

### Community 90 - "routes.tsx"
Cohesion: 0.22
Nodes (9): fetchTenantDetail(), TenantRow, KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

### Community 95 - "banks.ts"
Cohesion: 0.12
Nodes (28): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField (+20 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "useAuth"
Cohesion: 0.15
Nodes (16): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig (+8 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (58): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+50 more)

### Community 111 - "MetricChartImpl.tsx"
Cohesion: 0.20
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 117 - "main.tsx"
Cohesion: 0.16
Nodes (11): container, EmailSettings, getRoute(), Home, ManualScan, Mapping, OrderHistory, Pricing (+3 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.16
Nodes (20): saveARSettings(), suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded() (+12 more)

### Community 126 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 138 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

## Knowledge Gaps
- **646 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+641 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ap-invoice/constants.ts`, `ExtractionsPage.tsx`, `MainMappingTable.tsx`, `LanguageContext.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `api.ts`, `PeriodPicker.tsx`, `orders.ts`, `OrderHistory.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `Mapping.tsx`, `adminFetch`, `TKey`, `payment-mapping/types.ts`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `useReviewDocument.ts`, `useOcrWizard`, `CreditsPage.tsx`, `OrderTable.tsx`, `useAPExtraction.ts`, `useMappingData.ts`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `apiFetch`, `NotificationBell.tsx`, `QuotaModulesPage.tsx`, `DocumentPreview.tsx`, `QueueRow.tsx`, `DataTable.tsx`, `AdminRouter.tsx`, `OrderDrawer.tsx`, `TenantSelector.tsx`, `PendingOrderBanner.tsx`, `OrderActions.tsx`, `APInvoice.tsx`, `APGroupModal.tsx`, `ManualScan.tsx`, `APLineItem`, `ReviewQueue.tsx`, `CheckoutFlow.tsx`, `ArCustomerProfiles.tsx`, `Pricing.tsx`, `routes.tsx`, `banks.ts`, `MetricChartImpl.tsx`, `useMapping.ts`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `draft.ts`, `useAPExtraction.ts`, `APLineItem`, `apiFetch`, `parseNum`, `config.ts`, `EmailSettings.tsx`, `useOcrExtraction.test.ts`, `AuthContext.tsx`, `useMapping.ts`, `useReviewDocument.ts`, `useOcrWizard`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `CustomSearchSelect()` connect `MainMappingTable.tsx` to `useMappingData.ts`, `parseNum`, `api.ts`, `Mapping.tsx`, `useT`, `payment-mapping/types.ts`, `useReviewDocument.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _646 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ap-invoice/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06604324956165984 - nodes in this community are weakly interconnected._
- **Should `ExtractionsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11382113821138211 - nodes in this community are weakly interconnected._
- **Should `LanguageContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11857707509881422 - nodes in this community are weakly interconnected._