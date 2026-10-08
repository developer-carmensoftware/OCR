# Graph Report - OCR  (2026-10-07)

## Corpus Check
- 401 files · ~297,182 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2153 nodes · 5968 edges · 161 communities (102 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ffa9b099`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APLineItem
- APReviewStep.tsx
- dict/index.ts
- DataTable.tsx
- useReviewDocument.ts
- getCarmenUrl
- parseNum
- TutorialModal.tsx
- screens.tsx
- useOcrWizard.ts
- ccJv.ts
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- MainMappingTable.tsx
- useMapping.ts
- OrderWorkspace.tsx
- PendingOrderBanner.test.tsx
- payment-mapping/types.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- routes.tsx
- FieldMapping
- devDependencies
- shared/api/credits.ts
- APAccountMappingStep.tsx
- useOcrWizard
- OrderActions.tsx
- useT
- dependencies
- useAPExtraction.ts
- ap-invoice/constants.ts
- OrderHistory.tsx
- OrderTable.tsx
- FeatureFlows.tsx
- showToast
- NotificationBell.tsx
- PeriodPicker.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- Pager.tsx
- api/usage.ts
- QueueRow.tsx
- useAPExtraction.test.ts
- ReviewQueue.tsx
- ArCustomerProfiles.tsx
- scripts
- SlipUpload.tsx
- SlipViewer.tsx
- AccountingReview.tsx
- compilerOptions
- CheckoutFlow.tsx
- TenantsPage.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- i18n/common.ts
- MetricChartImpl.tsx
- api.ts
- LanguageContext.tsx
- Carmen AI — OCR & Import System
- usePdfPasswordPrompt
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
- i18n/credits.ts
- shared/api/auth.ts
- ErrorBoundary
- OrderDrawer.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- chrome.ts
- i18n/index.ts
- AppHeader.tsx
- i18n/tenants.ts
- checkout.ts
- apiFetch
- banks.ts
- vitest
- vite-env.d.ts
- recordInputTax
- mockPaths.test.ts
- useCarmenSSO.ts
- CreditsPage.tsx
- dict/common.ts
- EmailSettings.tsx
- notif.ts
- plan.ts
- useAuth
- proforma.ts
- tutorial.ts
- sessions.ts
- dict/maintenance.ts
- main.tsx
- adminUsers.ts
- anomalies.ts
- cc.ts
- slip.ts
- useMappingSuggestions.ts
- warn.ts
- adminFetch
- llmLogs.ts
- @types/react
- login.ts
- @types/react-dom
- quota.ts
- review.ts
- date.ts
- APAmountSummary.tsx
- vite
- dict/ap.ts
- @testing-library/react
- ar.ts
- @testing-library/jest-dom
- extractions.ts
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- i18n/maintenance.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- pack.ts
- i18n/nav.ts
- i18n/quotas.ts
- dict/usage.ts
- whatsnew.ts
- eslint
- i18n/usage.ts
- userUsage.ts
- jsdom
- contact.ts
- orev.ts
- qr.ts

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
- `NavItem` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `NavSection` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (161 total, 59 thin omitted)

### Community 0 - "APLineItem"
Cohesion: 0.24
Nodes (12): APGroupModal(), profileLabel(), Props, ApDraft, APDraftState, Args, useAPGrouping(), apGroupKey() (+4 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.14
Nodes (22): APLineItemsTable(), Props, Ctrl, Props, APTableFooter(), Props, APTableHeader(), Props (+14 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.11
Nodes (25): fetchLLMLogs(), fetchPerformanceLogs(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS (+17 more)

### Community 4 - "useReviewDocument.ts"
Cohesion: 0.17
Nodes (17): getPending(), BlockReason, BU_WIDE, JvEditor(), JvState, Overrides, Props, rowId() (+9 more)

### Community 5 - "getCarmenUrl"
Cohesion: 0.18
Nodes (13): RowAction(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), FIX, fixLinkProps() (+5 more)

### Community 6 - "parseNum"
Cohesion: 0.17
Nodes (28): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+20 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.10
Nodes (30): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+22 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.17
Nodes (16): Args, useAPDraft(), APExtractionProps, mountRestored(), TAX_PROFILES, useAPVendor(), OcrDraftState, CcDraft (+8 more)

### Community 10 - "ccJv.ts"
Cohesion: 0.13
Nodes (22): JvHeaderCard(), Props, TopLevelConfigSection(), useGlMasters(), CONFIG, leg(), rows(), TWO_LINES (+14 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.11
Nodes (24): ARMappingItem, ARPreview, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+16 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "MainMappingTable.tsx"
Cohesion: 0.08
Nodes (24): AccountMappingTable(), GLAccount, Props, Props, MainMappings, MainMappingKey, SuggestionSource, AISuggestBar() (+16 more)

### Community 17 - "useMapping.ts"
Cohesion: 0.07
Nodes (50): saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, bankCodeFromHash(), getAccountingConfig, seedOcrBranch(), useBankConfig() (+42 more)

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.20
Nodes (13): fetchAdminOrderDocuments(), getOrderSlipUrl(), CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction (+5 more)

### Community 19 - "PendingOrderBanner.test.tsx"
Cohesion: 0.16
Nodes (9): PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), ActiveSubscription, CreditOrder, listOrders() (+1 more)

### Community 20 - "payment-mapping/types.ts"
Cohesion: 0.13
Nodes (36): MappingRow(), Props, BulkApplyBar(), Props, MappingTable(), Props, STATUS_LABEL, Filter (+28 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (24): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+16 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "routes.tsx"
Cohesion: 0.11
Nodes (26): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+18 more)

### Community 25 - "FieldMapping"
Cohesion: 0.22
Nodes (14): ARPreviewRequest, AddError, MappingItem, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels (+6 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.15
Nodes (24): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+16 more)

### Community 28 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 30 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 31 - "useT"
Cohesion: 0.09
Nodes (26): APReviewStep(), HEADER_FIELDS(), APSuccessStep(), Props, APUploadStep(), INSTRUCTIONS, Props, APInvoice() (+18 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.13
Nodes (19): EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg() (+11 more)

### Community 34 - "ap-invoice/constants.ts"
Cohesion: 0.19
Nodes (13): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), AP_STEPS, APFieldKey, APStep (+5 more)

### Community 35 - "OrderHistory.tsx"
Cohesion: 0.16
Nodes (23): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), ActivePlanBanner(), OrderRow() (+15 more)

### Community 36 - "OrderTable.tsx"
Cohesion: 0.13
Nodes (17): AdminCreditOrder, Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable() (+9 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "showToast"
Cohesion: 0.10
Nodes (30): Props, Props, APInvoiceHeader, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload (+22 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+34 more)

### Community 40 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (30): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchUserUsage(), daysAgo(), endOfDay(), granularityFor() (+22 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (28): fetchAlerts(), fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), fetchUsageTotals() (+20 more)

### Community 44 - "Pager.tsx"
Cohesion: 0.17
Nodes (8): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Pager(), Props, SIZE_OPTIONS, ROWS_PER_PAGE

### Community 45 - "api/usage.ts"
Cohesion: 0.13
Nodes (22): buildQs(), QueryParams, fetchErrorBreakdown(), fetchExtractionFailures(), fetchTenantRanking(), fetchUsageSummary(), Column, LazyMetricChart (+14 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.20
Nodes (13): MainMappingTable(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+5 more)

### Community 47 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 49 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "SlipUpload.tsx"
Cohesion: 0.28
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 53 - "AccountingReview.tsx"
Cohesion: 0.08
Nodes (31): diffCorrections(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload (+23 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.16
Nodes (15): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, isSubscriptionCode(), PACK_META, planChangeLoss(), planChangeWarning() (+7 more)

### Community 57 - "TenantsPage.tsx"
Cohesion: 0.21
Nodes (13): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, useTableData() (+5 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 62 - "MetricChartImpl.tsx"
Cohesion: 0.22
Nodes (8): axisTick, ChartType, FALLBACK_COLORS, MetricChart(), Series, tooltipItemStyle, tooltipLabelStyle, tooltipStyle

### Community 63 - "api.ts"
Cohesion: 0.11
Nodes (18): ItxOverrides, BANK_LOGOS, BankDetectionBanner(), Props, Props, BANK_THAI_NAMES, AccountingConfigRequest, ApiError (+10 more)

### Community 64 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (24): BatchAction, BatchActionBar(), Props, MAP, OrderStatusBadge(), INSTRUCTIONS, Props, UploadSection() (+16 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 67 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "ExtractionsPage.tsx"
Cohesion: 0.18
Nodes (15): ExtractionFailureRow, DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, causeLabel(), classify(), ERROR_RULES (+7 more)

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
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 81 - "shared/api/auth.ts"
Cohesion: 0.20
Nodes (13): OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken(), getPaymentInfo(), T (+5 more)

### Community 82 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 83 - "OrderDrawer.tsx"
Cohesion: 0.43
Nodes (4): OrderDrawer(), __resetScrollLock(), Locker(), useScrollLock()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.17
Nodes (13): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PackPresentation (+5 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.26
Nodes (11): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), clearAllDrafts(), getJwtExpMs() (+3 more)

### Community 90 - "i18n/index.ts"
Cohesion: 0.09
Nodes (13): en, th, adminDict, AdminKey, en, th, en, th (+5 more)

### Community 91 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (11): AdminLayout(), getActiveHash(), OrderReviewShell(), AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle() (+3 more)

### Community 94 - "apiFetch"
Cohesion: 0.10
Nodes (24): _fetchExtract(), approveDocument(), rejectDocument(), Correction, FIELD_NAME_MAP, logCorrections(), extractFromFile, MOCK_EXTRACTED (+16 more)

### Community 95 - "banks.ts"
Cohesion: 0.11
Nodes (20): AccountingReview(), configBanks, Props, BankConfigHook, codeToDisplayName(), codeToSource(), descriptionForBank(), getBankInfo() (+12 more)

### Community 103 - "recordInputTax"
Cohesion: 1.00
Nodes (3): recordInputTax(), RecordInputTax(), confirm()

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "useCarmenSSO.ts"
Cohesion: 0.42
Nodes (7): exchangeSSOToken(), CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, CarmenSSOState, ssoLink(), open(), useCarmenSSO()

### Community 106 - "CreditsPage.tsx"
Cohesion: 0.17
Nodes (15): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), label() (+7 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.05
Nodes (58): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+50 more)

### Community 111 - "useAuth"
Cohesion: 0.28
Nodes (6): ConsentGate(), Props, A, B, Probe(), useAuth()

### Community 117 - "main.tsx"
Cohesion: 0.15
Nodes (12): APInvoice, container, getRoute(), Home, ManualScan, Mapping, OrderHistory, OrderReviewShell (+4 more)

### Community 122 - "useMappingSuggestions.ts"
Cohesion: 0.27
Nodes (9): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, useMappingSuggestions(), mergeSuggestion(), SuggestPaymentTypesRequest (+1 more)

### Community 125 - "adminFetch"
Cohesion: 0.25
Nodes (20): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), AdminUserRow, createAdminUser() (+12 more)

### Community 137 - "date.ts"
Cohesion: 0.26
Nodes (9): DATE_KEYS, HeaderCard(), Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+1 more)

### Community 139 - "APAmountSummary.tsx"
Cohesion: 0.14
Nodes (13): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, Props, VendorSearch(), Badge() (+5 more)

## Knowledge Gaps
- **646 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+641 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APLineItem`, `APReviewStep.tsx`, `DataTable.tsx`, `useReviewDocument.ts`, `getCarmenUrl`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useOcrWizard.ts`, `date.ts`, `orders.ts`, `APAmountSummary.tsx`, `ccJv.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `MainMappingTable.tsx`, `useMapping.ts`, `OrderWorkspace.tsx`, `PendingOrderBanner.test.tsx`, `payment-mapping/types.ts`, `MaintenanceGate.tsx`, `routes.tsx`, `APAccountMappingStep.tsx`, `useOcrWizard`, `OrderActions.tsx`, `useAPExtraction.ts`, `ap-invoice/constants.ts`, `OrderHistory.tsx`, `OrderTable.tsx`, `FeatureFlows.tsx`, `showToast`, `NotificationBell.tsx`, `PeriodPicker.tsx`, `QuotaModulesPage.tsx`, `Pager.tsx`, `api/usage.ts`, `QueueRow.tsx`, `ReviewQueue.tsx`, `ArCustomerProfiles.tsx`, `SlipUpload.tsx`, `SlipViewer.tsx`, `AccountingReview.tsx`, `CheckoutFlow.tsx`, `TenantsPage.tsx`, `MetricChartImpl.tsx`, `api.ts`, `LanguageContext.tsx`, `DetailTable.tsx`, `ExtractionsPage.tsx`, `shared/api/auth.ts`, `OrderDrawer.tsx`, `Pricing.tsx`, `AppHeader.tsx`, `banks.ts`, `recordInputTax`, `CreditsPage.tsx`, `useMappingSuggestions.ts`, `adminFetch`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useAPExtraction.ts`, `useReviewDocument.ts`, `parseNum`, `useOcrWizard.ts`, `EmailSettings.tsx`, `useMapping.ts`, `AccountingReview.tsx`, `AuthContext.tsx`, `useMappingSuggestions.ts`, `useOcrWizard`, `apiFetch`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `appKey()` connect `useMapping.ts` to `useAPExtraction.ts`, `useReviewDocument.ts`, `parseNum`, `useOcrWizard.ts`, `ReviewDocument.test.tsx`, `useAPExtraction.test.ts`, `useAuth`, `AccountingReview.tsx`, `AuthContext.tsx`, `FieldMapping`, `useOcrWizard`, `api.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _646 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13548387096774195 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11051693404634581 - nodes in this community are weakly interconnected._