# Graph Report - OCR  (2026-10-01)

## Corpus Check
- 400 files · ~294,053 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2145 nodes · 5913 edges · 148 communities (106 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `85fadee3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- Pager.tsx
- TopLevelConfigSection.tsx
- emailReview.ts
- parseNum
- TutorialModal.tsx
- screens.tsx
- useMappingSuggestions.ts
- PeriodPicker.tsx
- orders.ts
- appKey
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- AccountingReview.tsx
- PaymentMappingDialog.tsx
- adminFetch
- Pricing.tsx
- AppHeader.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- Skeleton.tsx
- APInvoice.tsx
- devDependencies
- shared/api/credits.ts
- adminAuth.ts
- showToast
- CreditsPage.tsx
- OrderTable.tsx
- dependencies
- useAPExtraction
- FieldMapping
- MainMappingTable.tsx
- OrderWorkspace.tsx
- FeatureFlows.tsx
- apiFetch
- NotificationBell.tsx
- ocr.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- ExtractionsPage.tsx
- QueueRow.tsx
- QuotaModulesPage.tsx
- DocumentPreview.tsx
- AdminLogin.tsx
- getCarmenUrl
- client.ts
- scripts
- formatThb
- OrderDrawer.tsx
- useOcrSubmission.test.ts
- compilerOptions
- useT
- OrderHistory.tsx
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- APVendorSearch.tsx
- UsageIndicator.tsx
- DetailTable.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- LanguageProvider
- ManualScan.tsx
- useAPExtraction.ts
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
- Mapping.test.tsx
- ArCustomerProfiles.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- CheckoutFlow.tsx
- storage.ts
- APTableRow.tsx
- jsdom
- APAmountSummary.tsx
- ErrorBoundary
- checkout.ts
- JvEditor.tsx
- api.ts
- vitest
- vite-env.d.ts
- LanguageContext.tsx
- mockPaths.test.ts
- useAuth
- useReviewDocument.ts
- TenantSelector.tsx
- EmailSettings.tsx
- adminUsers.ts
- anomalies.ts
- MetricChartImpl.tsx
- i18n/maintenance.ts
- i18n/nav.ts
- OrderTable.test.tsx
- reviewReasons.ts
- performance.ts
- main.tsx
- i18n/credits.ts
- i18n/tenants.ts
- cc.ts
- slip.ts
- useMapping.ts
- tutorial.ts
- warn.ts
- dict/common.ts
- flows.ts
- home.ts
- dict/maintenance.ts
- @types/react
- notif.ts
- pricing.ts
- @types/react-dom
- qr.ts
- quota.ts
- review.ts
- @testing-library/dom
- vite
- @testing-library/react
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md

## God Nodes (most connected - your core abstractions)
1. `useT()` - 247 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 59 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 34 edges
8. `showToast()` - 34 edges
9. `appKey()` - 33 edges
10. `FieldMapping` - 31 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Props` --references--> `Vendor`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APVendorSearch.tsx → frontend/src/features/ap-invoice/hooks/useAPVendor.ts

## Import Cycles
- None detected.

## Communities (148 total, 42 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.19
Nodes (14): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), OcrDraftState, CcDraft, clearAllDrafts(), clearDraft() (+6 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.05
Nodes (31): AdminKey, en, th, en, th, en, th, DICT (+23 more)

### Community 3 - "Pager.tsx"
Cohesion: 0.24
Nodes (6): Props, SIZE_OPTIONS, readRowsPerPage(), ROWS_PER_PAGE, useRowsPerPage(), writeRowsPerPage()

### Community 4 - "TopLevelConfigSection.tsx"
Cohesion: 0.12
Nodes (14): JvHeaderCard(), Props, Props, TopLevelConfigSection(), DESCRIPTION_TAGS, joinDescription(), splitDescription(), CustomSearchSelect() (+6 more)

### Community 5 - "emailReview.ts"
Cohesion: 0.24
Nodes (12): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+4 more)

### Community 6 - "parseNum"
Cohesion: 0.17
Nodes (27): AmountSummary(), getAvailableFields(), useAPGrouping(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure() (+19 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (33): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+25 more)

### Community 9 - "useMappingSuggestions.ts"
Cohesion: 0.17
Nodes (14): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, useMappingSuggestions(), AccountLike, accountName() (+6 more)

### Community 10 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (35): buildQs(), fetchAlerts(), fetchErrorBreakdown(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), granularityFor(), lastDays() (+27 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "appKey"
Cohesion: 0.14
Nodes (21): JvState, getAccountingConfig, seedOcrBranch(), MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+13 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.19
Nodes (16): ARMappingItem, ARPreviewRequest, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES, PostType (+8 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (20): QueryParams, EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits() (+12 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.12
Nodes (21): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, InputTaxReconciliation(), codeToSource(), descriptionForBank(), CONFIG, leg() (+13 more)

### Community 17 - "PaymentMappingDialog.tsx"
Cohesion: 0.21
Nodes (18): Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog(), Props (+10 more)

### Community 18 - "adminFetch"
Cohesion: 0.18
Nodes (26): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantSubscriptionSummary, fetchTenants() (+18 more)

### Community 19 - "Pricing.tsx"
Cohesion: 0.20
Nodes (14): PackList(), PlanCard(), perDoc(), cardVariants, containerVariants, OrderHistory(), parseFocusId(), ContactDialog() (+6 more)

### Community 20 - "AppHeader.tsx"
Cohesion: 0.13
Nodes (17): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, registerDict() (+9 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (24): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+16 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 24 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 25 - "APInvoice.tsx"
Cohesion: 0.14
Nodes (19): Props, APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props, APTableRow() (+11 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, @eslint/js, devDependencies, autoprefixer, eslint, @eslint/js, globals (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (30): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+22 more)

### Community 28 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 29 - "showToast"
Cohesion: 0.13
Nodes (23): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+15 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.19
Nodes (12): BatchActionBar(), BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable() (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction"
Cohesion: 0.14
Nodes (13): _fetchExtract(), isNumFld(), useAPExtraction(), Args, FileUploadHook, useFileUpload(), handleFileChange(), setPreview() (+5 more)

### Community 34 - "FieldMapping"
Cohesion: 0.22
Nodes (16): Props, AddError, MappingItem, MappingStatus, SetStats, Undo, FeeInvoiceSource, MappingSetsInput (+8 more)

### Community 35 - "MainMappingTable.tsx"
Cohesion: 0.20
Nodes (14): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, MappingRow(), BulkApplyBar(), MainMappings (+6 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (14): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+6 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "apiFetch"
Cohesion: 0.15
Nodes (24): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+16 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+34 more)

### Community 40 - "ocr.ts"
Cohesion: 0.10
Nodes (23): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), fetchTimeout(), ApiError, ExtractedRow (+15 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (15): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, configBanks, configWaits (+7 more)

### Community 43 - "ExtractionsPage.tsx"
Cohesion: 0.12
Nodes (21): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, Tab, Tabs() (+13 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.33
Nodes (10): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+2 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.12
Nodes (20): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps (+12 more)

### Community 46 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 47 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 48 - "getCarmenUrl"
Cohesion: 0.24
Nodes (9): RowAction(), NotificationDetailModal(), AuthScreen(), COPY, Lang, Props, useIsMobile(), UserConsentModal() (+1 more)

### Community 49 - "client.ts"
Cohesion: 0.18
Nodes (12): revokeSession(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, clearToken(), createApiClient(), resolveUrl(), storeToken() (+4 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "formatThb"
Cohesion: 0.26
Nodes (12): BillingFigure(), expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), formatThb(), _hundreds() (+4 more)

### Community 52 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock()

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (15): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+7 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "useT"
Cohesion: 0.09
Nodes (47): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchTenantDetail(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage() (+39 more)

### Community 56 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (17): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+9 more)

### Community 57 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "APVendorSearch.tsx"
Cohesion: 0.21
Nodes (8): Props, VendorSearch(), MAP, OrderStatusBadge(), OrderStatus, Badge(), BadgeVariant, Props

### Community 62 - "UsageIndicator.tsx"
Cohesion: 0.27
Nodes (7): UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 63 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.44
Nodes (6): APGroupModal(), profileLabel(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.18
Nodes (7): LITE, ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), MAX_FILE_SIZE_MB

### Community 67 - "ManualScan.tsx"
Cohesion: 0.11
Nodes (13): BankDetectionBanner(), DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props, UploadSection(), FormActions() (+5 more)

### Community 68 - "useAPExtraction.ts"
Cohesion: 0.07
Nodes (38): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+30 more)

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
Cohesion: 0.12
Nodes (16): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+8 more)

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
Cohesion: 0.15
Nodes (10): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+2 more)

### Community 77 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): getConsentStatus(), postConsent(), ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached() (+2 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.04
Nodes (29): en, th, en, th, en, th, en, th (+21 more)

### Community 81 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 82 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (15): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, EnterpriseCard(), PlanCardProps, TIER_ICONS, ENTERPRISE (+7 more)

### Community 88 - "storage.ts"
Cohesion: 0.22
Nodes (10): AuthProvider(), A, B, Probe(), APP_STORAGE_BASES, clearAppStorage(), getCarmenUri(), NOTE: per-user keys (consent), global UI prefs (theme, lang) and (+2 more)

### Community 89 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.23
Nodes (8): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 92 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 94 - "JvEditor.tsx"
Cohesion: 0.09
Nodes (24): ARPreview, ARPreviewRow, ItxOverrides, Props, ARReviewPane(), labelOf(), Props, DetailRow (+16 more)

### Community 95 - "api.ts"
Cohesion: 0.07
Nodes (45): BANK_LOGOS, Props, CompanyInfoSection(), PLACEHOLDER_KEYS, Props, buildMappingSets(), bankCodeFromHash(), BankConfigHook (+37 more)

### Community 103 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (19): BatchAction, Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants (+11 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "useAuth"
Cohesion: 0.24
Nodes (11): exchangeSSOToken(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+3 more)

### Community 106 - "useReviewDocument.ts"
Cohesion: 0.20
Nodes (16): approveDocument(), getPending(), rejectDocument(), handleAddInputTax(), useReviewDocument(), approve(), reject(), applyJvAmount() (+8 more)

### Community 107 - "TenantSelector.tsx"
Cohesion: 0.25
Nodes (6): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.05
Nodes (57): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+49 more)

### Community 111 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 115 - "reviewReasons.ts"
Cohesion: 0.25
Nodes (9): OcrExtractionHook, ExtractionWarningBanner(), Props, ExtractionWarning, FIX, REASON_KEY, SETTINGS, warningText() (+1 more)

### Community 117 - "main.tsx"
Cohesion: 0.16
Nodes (11): APInvoice, container, getRoute(), ManualScan, Mapping, OrderHistory, OrderReviewShell, Pricing (+3 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.16
Nodes (17): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+9 more)

## Knowledge Gaps
- **649 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+644 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APReviewStep.tsx`, `Pager.tsx`, `TopLevelConfigSection.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useMappingSuggestions.ts`, `PeriodPicker.tsx`, `orders.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `AccountingReview.tsx`, `PaymentMappingDialog.tsx`, `adminFetch`, `Pricing.tsx`, `AppHeader.tsx`, `MaintenanceGate.tsx`, `APInvoice.tsx`, `shared/api/credits.ts`, `showToast`, `CreditsPage.tsx`, `OrderTable.tsx`, `useAPExtraction`, `MainMappingTable.tsx`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `ExtractionsPage.tsx`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `DocumentPreview.tsx`, `AdminLogin.tsx`, `getCarmenUrl`, `formatThb`, `OrderDrawer.tsx`, `OrderHistory.tsx`, `OrderActions.tsx`, `APVendorSearch.tsx`, `UsageIndicator.tsx`, `DetailTable.tsx`, `APGroupModal.tsx`, `LanguageProvider`, `ManualScan.tsx`, `useAPExtraction.ts`, `ReviewQueue.tsx`, `ArCustomerProfiles.tsx`, `CheckoutFlow.tsx`, `APAmountSummary.tsx`, `JvEditor.tsx`, `api.ts`, `LanguageContext.tsx`, `useReviewDocument.ts`, `TenantSelector.tsx`, `MetricChartImpl.tsx`, `reviewReasons.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrWizard.ts`, `useAPExtraction`, `useAPExtraction.ts`, `apiFetch`, `parseNum`, `ocr.ts`, `useMappingSuggestions.ts`, `useReviewDocument.ts`, `appKey`, `EmailSettings.tsx`, `client.ts`, `useOcrSubmission.test.ts`, `storage.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `emailReview.ts`, `parseNum`, `useMappingSuggestions.ts`, `appKey`, `useSettlementMapping.ts`, `Pricing.tsx`, `shared/api/credits.ts`, `showToast`, `useAPExtraction`, `NotificationBell.tsx`, `ocr.ts`, `client.ts`, `useOcrSubmission.test.ts`, `OrderHistory.tsx`, `useAPExtraction.ts`, `config.ts`, `useUserConsent.ts`, `useReviewDocument.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _649 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046464646464646465 - nodes in this community are weakly interconnected._
- **Should `TopLevelConfigSection.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11965811965811966 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._