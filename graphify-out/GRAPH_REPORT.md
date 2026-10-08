# Graph Report - OCR  (2026-10-08)

## Corpus Check
- 419 files · ~305,657 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2231 nodes · 6237 edges · 149 communities (111 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `716c62cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APLineItem
- APReviewStep.tsx
- dict/index.ts
- DataTable.tsx
- PaymentMappingDialog.tsx
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
- appKey
- routes.tsx
- ApiKeysPage.tsx
- useMappingData.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- apiFetch
- LanguageContext.tsx
- useOcrWizard
- OrderTable.tsx
- DocumentPreview.tsx
- dependencies
- useAPExtraction.ts
- ExtractionWarning
- OrderHistory.tsx
- OrderWorkspace.tsx
- FeatureFlows.tsx
- useAPSubmission.test.ts
- NotificationBell.tsx
- LLMLogsPage.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- useEmailSettings.ts
- PeriodPicker.tsx
- QueueRow.tsx
- useAPSubmission.ts
- ReviewQueue.tsx
- useMappingSuggestions.ts
- scripts
- useReviewDocument.ts
- UserUsagePage.tsx
- carmen.ts
- compilerOptions
- CreditsPage.tsx
- CheckoutFlow.tsx
- MaintenancePage.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- EmailSettings.test.tsx
- useT
- api.ts
- TKey
- Carmen AI — OCR & Import System
- usePdfPasswordPrompt
- ManualScan.tsx
- TenantsPage.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- emailReview.ts
- useAuth
- vercel.json
- Architecture
- useAPExtraction.test.ts
- shared/api/auth.ts
- Mapping.test.tsx
- CustomModal.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- SlipUpload.tsx
- i18n/index.ts
- AppHeader.tsx
- i18n/tenants.ts
- imagesToPdf.ts
- ocr.ts
- banks.ts
- vitest
- vite-env.d.ts
- OrderStatusBadge.tsx
- mockPaths.test.ts
- client.ts
- endpoints.ts
- i18n/common.ts
- EmailSettings.tsx
- adminAuth.ts
- proforma.ts
- AppHeader.test.tsx
- @testing-library/dom
- dict/maintenance.ts
- main.tsx
- adminUsers.ts
- cc.ts
- useMapping.ts
- warn.ts
- adminFetch
- llmLogs.ts
- PmsPage.test.tsx
- @types/react-dom
- APAmountSummary.tsx
- quota.ts
- review.ts
- date.ts
- APAccountMappingStep.tsx
- vite
- APInvoice.tsx
- dict/ap.ts
- @testing-library/react
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
- i18n/nav.ts
- dict/usage.ts
- whatsnew.ts
- eslint
- jsdom
- orev.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 262 edges
2. `adminFetch` - 68 edges
3. `apiFetch` - 64 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 38 edges
7. `TKey` - 38 edges
8. `appKey()` - 36 edges
9. `showToast()` - 34 edges
10. `fmtDateTime()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/components/BatchActionBar.tsx → frontend/src/i18n/dict/index.ts
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (149 total, 38 thin omitted)

### Community 0 - "APLineItem"
Cohesion: 0.22
Nodes (13): Props, APGroupModal(), profileLabel(), Props, ApDraft, APDraftState, Args, useAPGrouping() (+5 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (20): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+12 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.04
Nodes (35): en, th, en, th, en, th, en, th (+27 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.09
Nodes (24): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+16 more)

### Community 4 - "PaymentMappingDialog.tsx"
Cohesion: 0.21
Nodes (19): BulkApplyBar(), Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog() (+11 more)

### Community 5 - "getCarmenUrl"
Cohesion: 0.18
Nodes (13): RowAction(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), FIX, fixLinkProps() (+5 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (31): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+23 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (26): EnterpriseCard(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+18 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.19
Nodes (13): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), OcrDraftState, CcDraft, clearDraft(), DraftKind (+5 more)

### Community 10 - "ccJv.ts"
Cohesion: 0.10
Nodes (28): AccountingReview(), JvHeaderCard(), Props, Props, TopLevelConfigSection(), useGlMasters(), descriptionForBank(), CONFIG (+20 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.17
Nodes (18): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+10 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "MainMappingTable.tsx"
Cohesion: 0.13
Nodes (16): AccountMappingTable(), GLAccount, MainMappingTable(), Props, MappingRow(), MainMappings, MainMappingKey, SuggestionSource (+8 more)

### Community 17 - "appKey"
Cohesion: 0.14
Nodes (22): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+14 more)

### Community 18 - "routes.tsx"
Cohesion: 0.24
Nodes (13): buildQs(), fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), fetchUsageSummary(), fetchUsageTotals(), Alert (+5 more)

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.07
Nodes (47): TenantSearch(), ApiKeysPage(), cell(), createApiKey, fetchApiKeys, fetchTenants, revokeApiKey, ROW (+39 more)

### Community 20 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

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
Cohesion: 0.25
Nodes (14): Props, AddError, MappingItem, MappingStatus, SetStats, Undo, FeeInvoiceSource, MappingSetsInput (+6 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "apiFetch"
Cohesion: 0.11
Nodes (35): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+27 more)

### Community 28 - "LanguageContext.tsx"
Cohesion: 0.22
Nodes (11): configBanks, Lang, translate(), Ctx, FALLBACK_CTX, FixedLanguage(), LanguageCtx, LanguageProvider() (+3 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 30 - "OrderTable.tsx"
Cohesion: 0.08
Nodes (28): BatchAction, BatchActionBar(), Props, ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions() (+20 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.14
Nodes (17): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload(), handleFileChange() (+9 more)

### Community 34 - "ExtractionWarning"
Cohesion: 0.47
Nodes (5): OcrExtractionHook, ExtractionWarningBanner(), Props, ExtractionWarning, warningText()

### Community 35 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (26): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+18 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.13
Nodes (19): AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), Props, Props, ContactBuyer(), num(), OrderWorkspace() (+11 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (40): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+32 more)

### Community 40 - "LLMLogsPage.tsx"
Cohesion: 0.21
Nodes (17): revokeSession(), fetchLLMLogs(), fetchPerformanceLogs(), daysAgo(), endOfDay(), useTableData(), getCols(), JobRow (+9 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.12
Nodes (19): fetchQuotaOverview(), toggleTenantModule(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab, Tabs() (+11 more)

### Community 44 - "useEmailSettings.ts"
Cohesion: 0.14
Nodes (28): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRulePayload, EmailSettings (+20 more)

### Community 45 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (27): fetchErrorBreakdown(), fetchTenantRanking(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+19 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.21
Nodes (16): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+8 more)

### Community 47 - "useAPSubmission.ts"
Cohesion: 0.17
Nodes (16): Props, VendorSearch(), Args, APExtractionProps, APSubmissionProps, GLAccount, useAPSubmission(), APVendorProps (+8 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 49 - "useMappingSuggestions.ts"
Cohesion: 0.17
Nodes (14): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, useMappingSuggestions(), AccountLike, accountName() (+6 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "useReviewDocument.ts"
Cohesion: 0.15
Nodes (19): approveDocument(), getPending(), ItxOverrides, rejectDocument(), BlockReason, BU_WIDE, JvEditor(), JvState (+11 more)

### Community 52 - "UserUsagePage.tsx"
Cohesion: 0.19
Nodes (10): fetchUserUsage(), label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, getCols() (+2 more)

### Community 53 - "carmen.ts"
Cohesion: 0.11
Nodes (21): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig (+13 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (13): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, PACK_META, planChangeLoss(), planChangeWarning(), ANNUAL_GROWTH (+5 more)

### Community 57 - "MaintenancePage.tsx"
Cohesion: 0.40
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 62 - "useT"
Cohesion: 0.16
Nodes (14): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+6 more)

### Community 63 - "api.ts"
Cohesion: 0.12
Nodes (15): APVendorMapping, APVendorMappingResponse, ConfigPatch, SaveAccountingConfigResult, AccountingConfigRequest, AccountingConfigResponse, ApiError, APInvoiceItem (+7 more)

### Community 64 - "TKey"
Cohesion: 0.13
Nodes (15): NavItem, NavSection, APValidationProps, INSTRUCTIONS, Props, UploadSection(), ACTIVE_TAG, containerVariants (+7 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "usePdfPasswordPrompt"
Cohesion: 0.60
Nodes (5): usePdfPasswordPrompt(), open(), prompt(), render(), submit()

### Community 67 - "ManualScan.tsx"
Cohesion: 0.08
Nodes (32): DEFAULT_EMPTY_OBJECT, Props, BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailRow, DetailTable() (+24 more)

### Community 68 - "TenantsPage.tsx"
Cohesion: 0.27
Nodes (9): fetchTenantDetail(), fetchTenants(), TenantRow, Column, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

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
Cohesion: 0.21
Nodes (13): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+5 more)

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
Cohesion: 0.16
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 77 - "useAuth"
Cohesion: 0.27
Nodes (11): getConsentStatus(), postConsent(), ConsentGate(), Props, AuthUser, useAuth(), cacheConsent(), consentKey() (+3 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93, phase 1: an inbox, nothing processes it yet)

### Community 80 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 81 - "shared/api/auth.ts"
Cohesion: 0.26
Nodes (8): UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats, ExchangeResponse

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "CustomModal.tsx"
Cohesion: 0.19
Nodes (8): OrderDrawer(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.12
Nodes (25): Props, PackList(), Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, priceLines() (+17 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.18
Nodes (14): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+6 more)

### Community 89 - "SlipUpload.tsx"
Cohesion: 0.29
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 90 - "i18n/index.ts"
Cohesion: 0.04
Nodes (34): en, th, en, th, en, th, en, th (+26 more)

### Community 91 - "AppHeader.tsx"
Cohesion: 0.15
Nodes (18): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, registerDict() (+10 more)

### Community 93 - "imagesToPdf.ts"
Cohesion: 0.60
Nodes (4): imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg()

### Community 94 - "ocr.ts"
Cohesion: 0.12
Nodes (17): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ApiError, ExtractedRow, extractFromFile() (+9 more)

### Community 95 - "banks.ts"
Cohesion: 0.16
Nodes (22): bankCodeFromHash(), BankConfigHook, useBankConfig(), codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape() (+14 more)

### Community 103 - "OrderStatusBadge.tsx"
Cohesion: 0.50
Nodes (3): MAP, OrderStatusBadge(), OrderStatus

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.27
Nodes (11): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), CarmenSSOState (+3 more)

### Community 106 - "endpoints.ts"
Cohesion: 0.23
Nodes (10): QueryParams, ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, TenantSubscriptionSummary, TenantDetail, TenantModuleRow (+2 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.13
Nodes (16): copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP, RULE_FIELDS (+8 more)

### Community 109 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 117 - "main.tsx"
Cohesion: 0.10
Nodes (14): APInvoice, container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory, PmsPage (+6 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.13
Nodes (22): saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, buildMappingSets(), COMPANY_FIELDS, CompanyField, rulesPrint() (+14 more)

### Community 125 - "adminFetch"
Cohesion: 0.36
Nodes (14): createApiKey(), fetchApiKeys(), revokeApiKey(), unwrapDetail(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles() (+6 more)

### Community 130 - "PmsPage.test.tsx"
Cohesion: 0.29
Nodes (3): createPmsKey, fetchPmsKeys, revokePmsKey

### Community 133 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 137 - "date.ts"
Cohesion: 0.26
Nodes (10): DATE_KEYS, HeaderCard(), Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.15
Nodes (12): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+4 more)

### Community 141 - "APInvoice.tsx"
Cohesion: 0.16
Nodes (16): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APUploadStep(), INSTRUCTIONS, Props (+8 more)

## Knowledge Gaps
- **665 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+660 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APLineItem`, `APReviewStep.tsx`, `DataTable.tsx`, `PaymentMappingDialog.tsx`, `APAmountSummary.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useOcrWizard.ts`, `ccJv.ts`, `orders.ts`, `APAccountMappingStep.tsx`, `APInvoice.tsx`, `date.ts`, `EmailAutomationPage.tsx`, `MainMappingTable.tsx`, `useSettlementMapping.ts`, `routes.tsx`, `ApiKeysPage.tsx`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `getCarmenUrl`, `apiFetch`, `LanguageContext.tsx`, `useOcrWizard`, `OrderTable.tsx`, `DocumentPreview.tsx`, `useAPExtraction.ts`, `ExtractionWarning`, `OrderHistory.tsx`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `LLMLogsPage.tsx`, `QuotaModulesPage.tsx`, `PeriodPicker.tsx`, `QueueRow.tsx`, `useAPSubmission.ts`, `ReviewQueue.tsx`, `useMappingSuggestions.ts`, `useReviewDocument.ts`, `UserUsagePage.tsx`, `CreditsPage.tsx`, `CheckoutFlow.tsx`, `MaintenancePage.tsx`, `TKey`, `ManualScan.tsx`, `TenantsPage.tsx`, `ExtractionsPage.tsx`, `shared/api/auth.ts`, `CustomModal.tsx`, `Pricing.tsx`, `SlipUpload.tsx`, `AppHeader.tsx`, `OrderStatusBadge.tsx`, `useMapping.ts`, `adminFetch`?**
  _High betweenness centrality (0.231) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useAPExtraction.ts`, `usePdfPasswordPrompt`, `ManualScan.tsx`, `parseNum`, `useOcrWizard.ts`, `appKey`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `showToast()` connect `parseNum` to `useAPExtraction.ts`, `useAPSubmission.test.ts`, `useOcrWizard.ts`, `EmailSettings.tsx`, `useAPSubmission.ts`, `useMappingSuggestions.ts`, `appKey`, `useReviewDocument.ts`, `carmen.ts`, `AuthContext.tsx`, `useMapping.ts`, `useOcrWizard`, `ocr.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _665 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._