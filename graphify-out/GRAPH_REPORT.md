# Graph Report - OCR  (2026-10-07)

## Corpus Check
- 401 files · ~296,833 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2152 nodes · 5960 edges · 168 communities (107 shown, 61 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5dd5d2e5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- CreditsPage.tsx
- MainMappingTable.tsx
- LanguageProvider
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- PeriodPicker.tsx
- orders.ts
- EmailSettings.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- AccountingReview.tsx
- ocr.ts
- unwrapDetail
- TKey
- PaymentMappingDialog.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- shared/api/credits.ts
- useReviewDocument.ts
- useOcrWizard
- adminFetch
- OrderTable.tsx
- dependencies
- useAPExtraction.ts
- APInvoice.tsx
- normalizeYearToCE
- OrderWorkspace.tsx
- FeatureFlows.tsx
- apiFetch
- useNotifications.ts
- usePdfPasswordPrompt
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- api/tenants.ts
- adminAuth.ts
- useT
- QueueRow.tsx
- storage.ts
- ReviewQueue.tsx
- DataTable.tsx
- scripts
- AdminRouter.tsx
- CustomModal.tsx
- config.ts
- compilerOptions
- Overview.tsx
- CheckoutFlow.tsx
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- Mapping.test.tsx
- shared/api/auth.ts
- useMappingSuggestions.ts
- NotificationBell.tsx
- Carmen AI — OCR & Import System
- OrderTable.test.tsx
- DetailTable.tsx
- showToast
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
- ArCustomerProfiles.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- chrome.ts
- APAccountMappingStep.tsx
- AppHeader.test.tsx
- EmailSettings.test.tsx
- checkout.ts
- Pager.tsx
- banks.ts
- vitest
- vite-env.d.ts
- i18n/email.ts
- mockPaths.test.ts
- client.ts
- MaintenancePage.tsx
- jobs.ts
- useEmailSettings.ts
- i18n/usage.ts
- useOcrExtraction.ts
- SlipUpload.tsx
- QueueRow.test.tsx
- NotificationBell.test.tsx
- setup.ts
- releaseNotes.ts
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
- sessions.ts
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
- tenantRanking.ts
- ManualScan.tsx
- userUsage.ts
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
- `Props` --references--> `AdminCreditOrder`  [EXTRACTED]
  frontend/src/features/admin/components/OrderTable.tsx → frontend/src/features/admin/api/orders.ts
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (168 total, 61 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.19
Nodes (13): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), OcrDraftState, CcDraft, clearDraft(), DraftKind (+5 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (21): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+13 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.32
Nodes (6): DICT, en, th, translate(), FILES, NAMESPACE_FILES

### Community 3 - "CreditsPage.tsx"
Cohesion: 0.13
Nodes (34): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), Column, ServerTable, daysAgo() (+26 more)

### Community 4 - "MainMappingTable.tsx"
Cohesion: 0.11
Nodes (22): AccountMappingTable(), GLAccount, MainMappingTable(), Props, MappingRow(), BulkApplyBar(), MainMappings, MainMappingKey (+14 more)

### Community 5 - "LanguageProvider"
Cohesion: 0.17
Nodes (7): MAP, OrderStatusBadge(), PendingOrderBanner(), SLIP, LanguageProvider(), readLang(), OrderStatus

### Community 6 - "parseNum"
Cohesion: 0.13
Nodes (33): APGroupModal(), profileLabel(), Props, getAvailableFields(), Args, useAPGrouping(), useAPInvoice(), adjustField() (+25 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.13
Nodes (21): Lang, LanguageCtx, Spot(), SpotContext, boldify(), Props, readCalm(), STEPS (+13 more)

### Community 8 - "screens.tsx"
Cohesion: 0.10
Nodes (26): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+18 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (10): ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse, ExtractedAPInvoiceData, ExtractedCreditCardData, ExtractedDetailRow (+2 more)

### Community 10 - "PeriodPicker.tsx"
Cohesion: 0.18
Nodes (19): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS (+11 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "EmailSettings.tsx"
Cohesion: 0.09
Nodes (23): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+15 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.15
Nodes (19): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+11 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.12
Nodes (24): EmailPollResult, KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps (+16 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (27): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, JvHeaderCard(), Props, TopLevelConfigSection(), codeToSource(), descriptionForBank() (+19 more)

### Community 17 - "ocr.ts"
Cohesion: 0.15
Nodes (15): OcrExtractionHook, extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractedRow, extractFromFile() (+7 more)

### Community 18 - "unwrapDetail"
Cohesion: 0.19
Nodes (20): unwrapDetail(), EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, fetchEmailBusinessUnits(), fetchEmailDocuments() (+12 more)

### Community 19 - "TKey"
Cohesion: 0.13
Nodes (18): BatchAction, NavItem, NavSection, APValidationProps, ACTIVE_TAG, containerVariants, Home(), itemVariants (+10 more)

### Community 20 - "PaymentMappingDialog.tsx"
Cohesion: 0.21
Nodes (18): Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog(), Props (+10 more)

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
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "FieldMapping"
Cohesion: 0.25
Nodes (14): Props, AddError, MappingItem, MappingStatus, SetStats, Undo, FeeInvoiceSource, MappingSetsInput (+6 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (28): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+20 more)

### Community 28 - "useReviewDocument.ts"
Cohesion: 0.12
Nodes (26): approveDocument(), ItxOverrides, rejectDocument(), Props, DetailRow, Props, BlockReason, BU_WIDE (+18 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.13
Nodes (21): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+13 more)

### Community 30 - "adminFetch"
Cohesion: 0.22
Nodes (19): buildQs(), adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits() (+11 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.13
Nodes (18): BatchActionBar(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable() (+10 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.08
Nodes (31): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping, getPdfInfo, getUsage (+23 more)

### Community 34 - "APInvoice.tsx"
Cohesion: 0.11
Nodes (24): AmountSummary(), Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APFieldMappingStep() (+16 more)

### Community 35 - "normalizeYearToCE"
Cohesion: 0.16
Nodes (14): addDays(), buildInvoicePayload(), DATE_KEYS, HeaderCard(), Props, handleAddInputTax(), jvhDate(), DateInput() (+6 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (21): AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), OrderDrawer(), Props, CompanyPanel(), ContactBuyer(), num() (+13 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "apiFetch"
Cohesion: 0.11
Nodes (29): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+21 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.26
Nodes (11): WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), Notification, releaseRow(), useNotifications(), markReleaseSeen() (+3 more)

### Community 40 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "api/tenants.ts"
Cohesion: 0.20
Nodes (11): QueryParams, ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, TenantSubscriptionSummary, toggleTenantModule(), TenantDetail (+3 more)

### Community 44 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 45 - "useT"
Cohesion: 0.07
Nodes (34): DateRangePicker(), DateRangePickerProps, LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps (+26 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.17
Nodes (17): recordInputTax(), Message(), reasonFor(), RecordInputTax(), confirm(), RowAction(), STATUS_META, FIXED (+9 more)

### Community 47 - "storage.ts"
Cohesion: 0.16
Nodes (15): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), COPY, Lang, Props, useIsMobile(), UserConsentModal() (+7 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 49 - "DataTable.tsx"
Cohesion: 0.15
Nodes (13): fetchTenantDetail(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), SKELETON_WIDTHS, SortDir, TableQueryState (+5 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "AdminRouter.tsx"
Cohesion: 0.27
Nodes (10): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, AdminRouter (+2 more)

### Community 52 - "CustomModal.tsx"
Cohesion: 0.21
Nodes (8): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 53 - "config.ts"
Cohesion: 0.09
Nodes (21): getAccountingConfig, seedOcrBranch(), getAccountingConfig, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig (+13 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "Overview.tsx"
Cohesion: 0.12
Nodes (19): fetchTenants(), fetchUsageSummary(), MetricChart(), label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants (+11 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.15
Nodes (15): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PACK_META, planChangeLoss(), planChangeWarning() (+7 more)

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

### Community 62 - "shared/api/auth.ts"
Cohesion: 0.20
Nodes (13): OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken(), getPaymentInfo(), T (+5 more)

### Community 63 - "useMappingSuggestions.ts"
Cohesion: 0.21
Nodes (12): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, useMappingSuggestions(), AccountLike, accountName() (+4 more)

### Community 64 - "NotificationBell.tsx"
Cohesion: 0.24
Nodes (13): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+5 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 67 - "DetailTable.tsx"
Cohesion: 0.16
Nodes (14): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), NumericInput(), NumericInputProps, BANKS (+6 more)

### Community 68 - "showToast"
Cohesion: 0.15
Nodes (21): Props, Props, Props, VendorSearch(), ApDraft, Args, APDraftState, APExtractionProps (+13 more)

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
Cohesion: 0.26
Nodes (11): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+3 more)

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
Cohesion: 0.18
Nodes (16): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, getPending(), listActivity(), markChipSeen() (+8 more)

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
Cohesion: 0.07
Nodes (19): en, th, en, th, en, th, en, th (+11 more)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (26): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, BillingFigure(), catalogName(), isSubscriptionCode() (+18 more)

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
Cohesion: 0.13
Nodes (24): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, PurchaseStep (+16 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.16
Nodes (16): revokeSession(), clearToken(), storeToken(), ConsentGate(), Props, AuthContext, AuthContextValue, AuthProvider() (+8 more)

### Community 90 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

### Community 92 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 94 - "Pager.tsx"
Cohesion: 0.18
Nodes (7): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Pager(), Props, SIZE_OPTIONS

### Community 95 - "banks.ts"
Cohesion: 0.13
Nodes (26): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField (+18 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.14
Nodes (17): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, AuthScreen(), AuthScreenProps, AuthState (+9 more)

### Community 106 - "MaintenancePage.tsx"
Cohesion: 0.40
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.15
Nodes (27): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRulePayload, EmailSettings (+19 more)

### Community 110 - "useOcrExtraction.ts"
Cohesion: 0.29
Nodes (7): diffCorrections(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, OcrSubmissionProps, ModalConfig

### Community 111 - "SlipUpload.tsx"
Cohesion: 0.28
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 112 - "QueueRow.test.tsx"
Cohesion: 0.32
Nodes (5): formatWhen(), fullWhen(), pad(), parseWhen(), QueueRow()

### Community 113 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 115 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 116 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 117 - "main.tsx"
Cohesion: 0.10
Nodes (14): APInvoice, container, EmailSettings, getRoute(), Home, ManualScan, Mapping, OrderHistory (+6 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.22
Nodes (15): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+7 more)

### Community 138 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (18): BANK_LOGOS, BankDetectionBanner(), Props, InputTaxReconciliation(), Props, splitMappings(), useAccountingConfig(), fetchTaxProfiles() (+10 more)

## Knowledge Gaps
- **646 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+641 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APReviewStep.tsx`, `CreditsPage.tsx`, `MainMappingTable.tsx`, `LanguageProvider`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `PeriodPicker.tsx`, `orders.ts`, `ManualScan.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `AccountingReview.tsx`, `ocr.ts`, `unwrapDetail`, `TKey`, `PaymentMappingDialog.tsx`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `shared/api/credits.ts`, `useReviewDocument.ts`, `useOcrWizard`, `adminFetch`, `OrderTable.tsx`, `useAPExtraction.ts`, `APInvoice.tsx`, `normalizeYearToCE`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `useNotifications.ts`, `QueueRow.tsx`, `storage.ts`, `ReviewQueue.tsx`, `DataTable.tsx`, `AdminRouter.tsx`, `CustomModal.tsx`, `Overview.tsx`, `CheckoutFlow.tsx`, `OrderActions.tsx`, `shared/api/auth.ts`, `useMappingSuggestions.ts`, `NotificationBell.tsx`, `DetailTable.tsx`, `showToast`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `ArCustomerProfiles.tsx`, `Pricing.tsx`, `APAccountMappingStep.tsx`, `Pager.tsx`, `banks.ts`, `MaintenancePage.tsx`, `SlipUpload.tsx`, `QueueRow.test.tsx`, `useMapping.ts`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrWizard.ts`, `useAPExtraction.ts`, `apiFetch`, `parseNum`, `EmailSettings.tsx`, `useOcrExtraction.ts`, `ocr.ts`, `config.ts`, `AuthContext.tsx`, `useMapping.ts`, `useReviewDocument.ts`, `useOcrWizard`, `useMappingSuggestions.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `CustomSearchSelect()` connect `MainMappingTable.tsx` to `parseNum`, `useT`, `AccountingReview.tsx`, `FieldMapping`, `useReviewDocument.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _646 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._
- **Should `CreditsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1332099907493062 - nodes in this community are weakly interconnected._
- **Should `MainMappingTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10606060606060606 - nodes in this community are weakly interconnected._