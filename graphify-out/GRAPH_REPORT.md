# Graph Report - OCR  (2026-10-15)

## Corpus Check
- 425 files · ~312,053 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2272 nodes · 6365 edges · 159 communities (100 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f13df6c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APLineItem
- ap-invoice/constants.ts
- dict/index.ts
- payment-mapping/types.ts
- usePmsReview.ts
- parseNum
- TutorialModal.tsx
- screens.tsx
- showToast
- AccountingReview.tsx
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- MainMappingTable.tsx
- appKey
- OrderWorkspace.tsx
- PmsPage.tsx
- deptAccounts.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- apiFetch
- OrderActions.tsx
- useOcrExtraction
- OrderTable.tsx
- DocumentPreview.tsx
- dependencies
- useT
- useCamera.ts
- PendingOrderBanner.test.tsx
- CreditsPage.tsx
- FeatureFlows.tsx
- PendingOrderBanner.tsx
- NotificationBell.tsx
- OrderDrawer.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- EmailSettings.tsx
- DataTable.tsx
- QueueRow.tsx
- useAPSubmission.ts
- ReviewQueue.tsx
- ArCustomerProfiles.tsx
- scripts
- useReviewDocument.ts
- ErrorBoundary
- endpoints.ts
- compilerOptions
- CheckoutFlow.tsx
- anomalies.ts
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- errors.ts
- MetricChartImpl.tsx
- api.ts
- LanguageContext.tsx
- Carmen AI — OCR & Import System
- Skeleton.tsx
- DetailTable.tsx
- extractions.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- llmLogs.ts
- useUserConsent.ts
- vercel.json
- Architecture
- useAPExtraction.test.ts
- OrderHistory.tsx
- Mapping.test.tsx
- PmsReviewDocument.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- login.ts
- adminUsers.ts
- i18n/index.ts
- i18n/maintenance.ts
- chrome.ts
- ocr.ts
- i18n/quotas.ts
- vitest
- vite-env.d.ts
- i18n/credits.ts
- mockPaths.test.ts
- client.ts
- i18n/common.ts
- i18n/tenants.ts
- adminAuth.ts
- proforma.ts
- AppHeader.tsx
- i18n/usage.ts
- userUsage.ts
- review.ts
- PeriodPicker.tsx
- dict/maintenance.ts
- main.tsx
- eslint
- buildQs
- cc.ts
- dict/apiKeys.ts
- useMapping.ts
- ar.ts
- warn.ts
- adminFetch
- checkout.ts
- dict/common.ts
- LanguageProvider
- home.ts
- @types/react-dom
- quota.ts
- dict/modal.ts
- notif.ts
- InputTaxReconciliation.tsx
- APAccountMappingStep.tsx
- vite
- useAPExtraction.ts
- plan.ts
- dict/ap.ts
- @testing-library/react
- pms.ts
- @testing-library/jest-dom
- pricing.ts
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
- slip.ts
- i18n/nav.ts
- tutorial.ts
- dict/usage.ts
- whatsnew.ts
- @types/react
- jsdom
- orev.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 267 edges
2. `apiFetch` - 72 edges
3. `adminFetch` - 68 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 38 edges
7. `TKey` - 38 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `API` - 32 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/AccountMappingTable.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (159 total, 59 thin omitted)

### Community 0 - "APLineItem"
Cohesion: 0.30
Nodes (9): APGroupModal(), profileLabel(), Props, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected() (+1 more)

### Community 1 - "ap-invoice/constants.ts"
Cohesion: 0.09
Nodes (33): COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS() (+25 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 4 - "payment-mapping/types.ts"
Cohesion: 0.23
Nodes (19): BulkApplyBar(), Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog() (+11 more)

### Community 5 - "usePmsReview.ts"
Cohesion: 0.18
Nodes (13): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+5 more)

### Community 6 - "parseNum"
Cohesion: 0.19
Nodes (24): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+16 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.24
Nodes (11): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+3 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (34): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+26 more)

### Community 9 - "showToast"
Cohesion: 0.14
Nodes (24): ApDraft, useAPDraft(), APDraftState, mountRestored(), TAX_PROFILES, OcrDraftState, useOcrSubmission(), CcDraft (+16 more)

### Community 10 - "AccountingReview.tsx"
Cohesion: 0.10
Nodes (33): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, JvHeaderCard(), Props, TopLevelConfigSection(), codeToSource(), descriptionForBank() (+25 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.19
Nodes (15): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getSamplePaymentTypes(), POST_TYPES, previewARJv() (+7 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "MainMappingTable.tsx"
Cohesion: 0.11
Nodes (19): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, MappingRow(), MainMappings, MainMappingKey (+11 more)

### Community 17 - "appKey"
Cohesion: 0.10
Nodes (32): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+24 more)

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (11): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 19 - "PmsPage.tsx"
Cohesion: 0.05
Nodes (58): createApiKey(), fetchApiKeys(), revokeApiKey(), TenantSearch(), ApiKeysPage(), cell(), createApiKey, fetchApiKeys (+50 more)

### Community 20 - "deptAccounts.ts"
Cohesion: 0.23
Nodes (14): GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+6 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "FieldMapping"
Cohesion: 0.23
Nodes (14): Props, AddError, MappingItem, MappingStatus, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput (+6 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "apiFetch"
Cohesion: 0.12
Nodes (31): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+23 more)

### Community 28 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 29 - "useOcrExtraction"
Cohesion: 0.12
Nodes (19): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+11 more)

### Community 30 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.29
Nodes (7): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useT"
Cohesion: 0.07
Nodes (31): APFieldMappingStep(), APUploadStep(), INSTRUCTIONS, Props, APInvoice(), BANK_LOGOS, BankDetectionBanner(), DATE_KEYS (+23 more)

### Community 34 - "useCamera.ts"
Cohesion: 0.29
Nodes (9): CANVAS_WIDTH, clampAxis(), computeView(), IDENTITY, Rect, spotTarget(), overview(), useCamera() (+1 more)

### Community 35 - "PendingOrderBanner.test.tsx"
Cohesion: 0.29
Nodes (3): PendingOrderBanner(), SLIP, ActiveSubscription

### Community 36 - "CreditsPage.tsx"
Cohesion: 0.17
Nodes (16): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+8 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "PendingOrderBanner.tsx"
Cohesion: 0.17
Nodes (22): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode(), ActivePlanBanner() (+14 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.08
Nodes (38): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+30 more)

### Community 40 - "OrderDrawer.tsx"
Cohesion: 0.24
Nodes (7): AdminCreditOrder, OrderDrawer(), Props, Props, many(), order(), WsState

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.13
Nodes (18): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps (+10 more)

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (53): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+45 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.07
Nodes (48): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage(), Column (+40 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.22
Nodes (15): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+7 more)

### Community 47 - "useAPSubmission.ts"
Cohesion: 0.09
Nodes (30): Props, Props, Props, Props, APInvoiceHeader, Args, APExtractionProps, APSubmissionProps (+22 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.09
Nodes (25): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ApproveResult, ItxOverrides, listActivity(), markChipSeen(), ReviewDocument (+17 more)

### Community 49 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "useReviewDocument.ts"
Cohesion: 0.11
Nodes (26): getARSettings(), approveDocument(), getPending(), rejectDocument(), BlockReason, BU_WIDE, JvState, Overrides (+18 more)

### Community 52 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 53 - "endpoints.ts"
Cohesion: 0.09
Nodes (23): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+15 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.18
Nodes (13): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, LITE, SlipUpload(), PACK_META, PLAN_META (+5 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 62 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 63 - "api.ts"
Cohesion: 0.12
Nodes (21): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, JvEditor(), MappingSuggestionsHook, useMappingSuggestions(), accountName() (+13 more)

### Community 64 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (27): BatchAction, BatchActionBar(), Props, AdminLayout(), getActiveHash(), OrderReviewShell(), NAV_SECTIONS, NavItem (+19 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "Skeleton.tsx"
Cohesion: 0.32
Nodes (6): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 67 - "DetailTable.tsx"
Cohesion: 0.12
Nodes (16): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, AMOUNT_FIELDS, DetailTable(), formatAmount() (+8 more)

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
Cohesion: 0.16
Nodes (17): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, causeLabel() (+9 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 77 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): getConsentStatus(), postConsent(), ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached() (+2 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 80 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.23
Nodes (10): MAP, OrderStatusBadge(), useOrderHistory(), OrderHistory(), parseFocusId(), Pricing(), getUsage(), getStoredToken() (+2 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "PmsReviewDocument.tsx"
Cohesion: 0.10
Nodes (27): RowAction(), dmy(), fmtAmount(), nameOf(), PmsReviewDocument(), Props, weekday(), Props (+19 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.19
Nodes (13): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, ENTERPRISE, PackPresentation, perDoc() (+5 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.20
Nodes (11): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+3 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.08
Nodes (14): en, th, adminDict, AdminKey, en, th, en, th (+6 more)

### Community 94 - "ocr.ts"
Cohesion: 0.14
Nodes (16): OcrExtractionHook, ApiError, ExtractedRow, ExtractResult, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt (+8 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.18
Nodes (16): exchangeSSOToken(), UsageData, API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), fetchTimeout() (+8 more)

### Community 109 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 111 - "AppHeader.tsx"
Cohesion: 0.13
Nodes (14): APSuccessStep(), VendorSearch(), AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., NotificationDetailModal(), REASON_KEY, COPY (+6 more)

### Community 115 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (33): fetchAlerts(), fetchUsageSummary(), fetchUsageTotals(), MetricChart(), daysAgo(), granularityFor(), lastDays(), matchPreset() (+25 more)

### Community 117 - "main.tsx"
Cohesion: 0.11
Nodes (19): AdminRouter(), getRoute(), ADMIN_ROUTES, registerDict(), AdminRouter, APInvoice, container, EmailSettings (+11 more)

### Community 119 - "buildQs"
Cohesion: 0.16
Nodes (18): buildQs(), QueryParams, ModuleUsageRow, QuotaOverviewResponse, TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail (+10 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.08
Nodes (31): PostType, saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, buildMappingSets(), bankCodeFromHash() (+23 more)

### Community 125 - "adminFetch"
Cohesion: 0.25
Nodes (20): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), AdminUserRow, createAdminUser() (+12 more)

### Community 130 - "LanguageProvider"
Cohesion: 0.12
Nodes (10): SLIP, createPmsKey, fetchPmsKeys, getPmsSettings, putPmsCredential, putPmsSettings, revokePmsKey, SETTINGS (+2 more)

### Community 137 - "InputTaxReconciliation.tsx"
Cohesion: 0.15
Nodes (23): Props, Props, DetailRow, InputTaxPanel(), Props, InputTaxReconciliation(), handleAddInputTax(), Props (+15 more)

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 141 - "useAPExtraction.ts"
Cohesion: 0.09
Nodes (26): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args (+18 more)

## Knowledge Gaps
- **677 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+672 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APLineItem`, `ap-invoice/constants.ts`, `payment-mapping/types.ts`, `usePmsReview.ts`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `InputTaxReconciliation.tsx`, `AccountingReview.tsx`, `orders.ts`, `APAccountMappingStep.tsx`, `useAPExtraction.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `MainMappingTable.tsx`, `OrderWorkspace.tsx`, `PmsPage.tsx`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `apiFetch`, `OrderActions.tsx`, `useOcrExtraction`, `OrderTable.tsx`, `DocumentPreview.tsx`, `PendingOrderBanner.test.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `PendingOrderBanner.tsx`, `NotificationBell.tsx`, `OrderDrawer.tsx`, `QuotaModulesPage.tsx`, `DataTable.tsx`, `QueueRow.tsx`, `useAPSubmission.ts`, `ReviewQueue.tsx`, `ArCustomerProfiles.tsx`, `useReviewDocument.ts`, `CheckoutFlow.tsx`, `MetricChartImpl.tsx`, `api.ts`, `LanguageContext.tsx`, `DetailTable.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `PmsReviewDocument.tsx`, `Pricing.tsx`, `AppHeader.tsx`, `PeriodPicker.tsx`, `buildQs`, `useMapping.ts`, `adminFetch`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `usePmsReview.ts`, `parseNum`, `InputTaxReconciliation.tsx`, `showToast`, `useSettlementMapping.ts`, `useAPExtraction.ts`, `appKey`, `PmsPage.tsx`, `deptAccounts.ts`, `useOcrExtraction`, `PendingOrderBanner.tsx`, `NotificationBell.tsx`, `QueueRow.tsx`, `useAPSubmission.ts`, `ReviewQueue.tsx`, `useReviewDocument.ts`, `endpoints.ts`, `api.ts`, `useUserConsent.ts`, `useAPExtraction.test.ts`, `OrderHistory.tsx`, `ocr.ts`, `client.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `usePmsReview.ts`, `parseNum`, `EmailSettings.tsx`, `useAPExtraction.ts`, `useAPSubmission.ts`, `appKey`, `useReviewDocument.ts`, `endpoints.ts`, `AuthContext.tsx`, `useMapping.ts`, `useOcrExtraction`, `api.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _677 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ap-invoice/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09408033826638477 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `screens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08658536585365853 - nodes in this community are weakly interconnected._