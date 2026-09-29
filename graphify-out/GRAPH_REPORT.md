# Graph Report - OCR  (2026-09-29)

## Corpus Check
- 391 files · ~274,422 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2070 nodes · 5697 edges · 161 communities (102 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `48fdbbc8`
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
- useT
- api.ts
- AppHeader.tsx
- orders.ts
- useOcrExtraction.ts
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- apiFetch
- ccJv.ts
- useMappingData.ts
- OrderWorkspace.tsx
- Mapping.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- useMapping.ts
- AccountingReview.tsx
- Pricing.tsx
- devDependencies
- appKey
- endpoints.ts
- useOcrWizard
- routes.tsx
- OrderActions.tsx
- dependencies
- FieldMapping
- ExtractionsPage.tsx
- TopLevelConfigSection.tsx
- useUserConsent.ts
- FeatureFlows.tsx
- useAPExtraction.test.ts
- NotificationBell.tsx
- useAPExtraction.ts
- AuthContext.tsx
- ReviewDocument.test.tsx
- HeaderCard.tsx
- QueueRow.tsx
- QuotaModulesPage.tsx
- LLMLogsPage.tsx
- main.tsx
- ocr.ts
- APLineItem
- scripts
- OrderHistory.tsx
- JvEditor.tsx
- useOcrSubmission.test.ts
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- shared/api/auth.ts
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- SessionsPage.tsx
- emailReview.ts
- DetailTable.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- CustomModal.tsx
- PaymentTypeModal.test.tsx
- MaintenanceGate.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminUsers.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderDrawer.tsx
- CreditsPage.tsx
- vercel.json
- Architecture
- i18n/index.ts
- useReviewDocument.ts
- llmLogs.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- ReviewDocument.tsx
- client.ts
- Skeleton.tsx
- jsdom
- NumericInput.tsx
- eslint
- checkout.ts
- DocumentPreview.tsx
- Tooltip.tsx
- vitest
- vite-env.d.ts
- PerformancePage.tsx
- mockPaths.test.ts
- jobs.ts
- performance.ts
- i18n/common.ts
- useEmailSettings.ts
- anomalies.ts
- chrome.ts
- LanguageContext.tsx
- TKey
- sessions.ts
- errors.ts
- UserUsagePage.tsx
- extractions.ts
- login.ts
- i18n/maintenance.ts
- i18n/credits.ts
- ar.ts
- ProtectedRoute.tsx
- @testing-library/react
- DataTable.tsx
- getCarmenUrl
- home.ts
- dict/modal.ts
- pricing.ts
- whatsnew.ts
- @types/react
- cc.ts
- dict/ap.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- dict/usage.ts
- notif.ts
- i18n/quotas.ts
- tenantRanking.ts
- vite
- qr.ts
- proforma.ts
- review.ts
- quota.ts
- warn.ts
- @testing-library/jest-dom
- slip.ts
- 01-csv-sidecar-ingestion.md
- tutorial.ts
- dict/nav.ts
- order.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- i18n/tenants.ts
- i18n/usage.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 241 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 58 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 37 edges
7. `unwrapDetail()` - 34 edges
8. `appKey()` - 33 edges
9. `APLineItem` - 30 edges
10. `showToast()` - 29 edges

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

## Communities (161 total, 59 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.21
Nodes (13): useAPDraft(), mountRestored(), TAX_PROFILES, OcrDraftState, CcDraft, clearAllDrafts(), clearDraft(), DraftKind (+5 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.07
Nodes (39): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), HEADER_FIELDS() (+31 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "adminFetch"
Cohesion: 0.24
Nodes (21): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, AdminUserRow (+13 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.16
Nodes (10): BANK_LOGOS, BankDetectionBanner(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions() (+2 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (30): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+22 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "useT"
Cohesion: 0.09
Nodes (38): PackList(), PendingOrderBanner(), EnterpriseCard(), PlanCard(), TIER_ICONS, billed(), DEMO_BUYER, DEMO_PACKS (+30 more)

### Community 9 - "api.ts"
Cohesion: 0.15
Nodes (13): SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExtractedAPInvoiceData, ExtractedCreditCardData (+5 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (7): AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., A, B, Probe(), useAuth()

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "useOcrExtraction.ts"
Cohesion: 0.11
Nodes (16): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract() (+8 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.13
Nodes (21): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+13 more)

### Community 15 - "apiFetch"
Cohesion: 0.11
Nodes (35): Ctrl, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments (+27 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.12
Nodes (22): codeToSource(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+14 more)

### Community 17 - "useMappingData.ts"
Cohesion: 0.17
Nodes (18): AccountMappingTable(), GLAccount, Props, MappingRow(), MappingRowVariant, prefetchGlMasters(), MappingDataHook, MasterGLPrefix (+10 more)

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.09
Nodes (29): AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf() (+21 more)

### Community 19 - "Mapping.tsx"
Cohesion: 0.17
Nodes (14): suggestMapping(), MainMappingTable(), useMapping(), MappingSuggestionsHook, useMappingSuggestions(), PaymentTypesHook, usePaymentTypes(), OcrSubmissionProps (+6 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "useMapping.ts"
Cohesion: 0.15
Nodes (22): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, bankCodeFromHash(), BankConfigHook, useBankConfig(), COMPANY_REQUIRED_FIELDS (+14 more)

### Community 24 - "AccountingReview.tsx"
Cohesion: 0.14
Nodes (14): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, DEFAULT_EMPTY_OBJECT, Badge() (+6 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.13
Nodes (25): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, Props, PlanCardProps, LITE (+17 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "appKey"
Cohesion: 0.14
Nodes (20): getAccountingConfig, seedOcrBranch(), getAccountingConfig, AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+12 more)

### Community 28 - "endpoints.ts"
Cohesion: 0.19
Nodes (12): QueryParams, ModuleUsageRow, QuotaOverviewResponse, TenantSubscriptionSummary, TenantDetail, TenantModuleRow, TenantSessionRow, Correction (+4 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.21
Nodes (18): processFile(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange() (+10 more)

### Community 30 - "routes.tsx"
Cohesion: 0.22
Nodes (14): buildQs(), fetchAlerts(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), fmtCost(), fmtNum(), Overview() (+6 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "FieldMapping"
Cohesion: 0.24
Nodes (18): Props, Props, Props, SettlementModalSection, GlMasters, ActiveScan, MainMappings, MasterAccount (+10 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.20
Nodes (14): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+6 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.15
Nodes (9): BANK_OPTIONS, Props, TEMPLATE_TAGS, TopLevelConfigSection(), CustomSearchSelect(), Props, SelectOption, TopChoice (+1 more)

### Community 36 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): getConsentStatus(), postConsent(), ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached() (+2 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.06
Nodes (45): ActivityPage, WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList (+37 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (21): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas() (+13 more)

### Community 41 - "AuthContext.tsx"
Cohesion: 0.24
Nodes (12): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), APP_STORAGE_BASES (+4 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 43 - "HeaderCard.tsx"
Cohesion: 0.25
Nodes (7): DATE_KEYS, HeaderCard(), Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 44 - "QueueRow.tsx"
Cohesion: 0.25
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (23): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps (+15 more)

### Community 46 - "LLMLogsPage.tsx"
Cohesion: 0.23
Nodes (11): fetchTenantDetail(), fetchLLMLogs(), useTableData(), getCols(), LLMLogsPage(), LogRow, funnel(), median() (+3 more)

### Community 47 - "main.tsx"
Cohesion: 0.06
Nodes (41): adminLogin(), AdminLoginError, LoginResponse, AdminLayout(), getActiveHash(), AdminLogin(), classify(), LoginError (+33 more)

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): ApiError, ExtractedRow, PDF_PASSWORD_REQUIRED, PdfInfoResult, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload (+6 more)

### Community 49 - "APLineItem"
Cohesion: 0.13
Nodes (18): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+10 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (26): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode(), ActivePlanBanner() (+18 more)

### Community 52 - "JvEditor.tsx"
Cohesion: 0.15
Nodes (18): suggestPaymentTypes(), Props, DetailRow, Props, Props, BlockReason, BU_WIDE, JvEditor() (+10 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.15
Nodes (12): diffCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail (+4 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.16
Nodes (24): fetchErrorBreakdown(), Column, MetricChart(), daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS (+16 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.13
Nodes (25): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+17 more)

### Community 57 - "shared/api/auth.ts"
Cohesion: 0.20
Nodes (13): OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken(), T, base (+5 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "SessionsPage.tsx"
Cohesion: 0.24
Nodes (12): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), endOfDay(), Alert, AnomaliesPage(), getCols() (+4 more)

### Community 62 - "emailReview.ts"
Cohesion: 0.24
Nodes (12): ACTIVITY_FILTERS, ActivityFilter, ApproveResult, ItxOverrides, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+4 more)

### Community 63 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.26
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "CustomModal.tsx"
Cohesion: 0.15
Nodes (10): ACCEPTED, Props, SlipUpload(), SLIP, CustomModal(), ModalType, Props, baseProps (+2 more)

### Community 67 - "PaymentTypeModal.test.tsx"
Cohesion: 0.25
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

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

### Community 76 - "OrderDrawer.tsx"
Cohesion: 0.36
Nodes (5): OrderDrawer(), Props, __resetScrollLock(), Locker(), useScrollLock()

### Community 77 - "CreditsPage.tsx"
Cohesion: 0.40
Nodes (9): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CreditsPage() (+1 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.10
Nodes (11): en, th, adminDict, AdminKey, en, th, en, th (+3 more)

### Community 81 - "useReviewDocument.ts"
Cohesion: 0.29
Nodes (10): approveDocument(), getPending(), rejectDocument(), Overrides, useReviewDocument(), approve(), reject(), patchAccountingConfig() (+2 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "ReviewDocument.tsx"
Cohesion: 0.18
Nodes (14): RowAction(), OcrExtractionHook, Props, ReviewDocument(), ExtractResult, ExtractionWarningBanner(), Props, ExtractionWarning (+6 more)

### Community 88 - "client.ts"
Cohesion: 0.29
Nodes (8): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), CarmenSSOState, useCarmenSSO()

### Community 89 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 91 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 94 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 95 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 103 - "PerformancePage.tsx"
Cohesion: 0.60
Nodes (4): fetchPerformanceLogs(), getCols(), PerformancePage(), PerfRow

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (40): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+32 more)

### Community 111 - "LanguageContext.tsx"
Cohesion: 0.07
Nodes (23): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+15 more)

### Community 112 - "TKey"
Cohesion: 0.09
Nodes (22): BatchAction, BatchActionBar(), Props, NavItem, NavSection, APUploadStep(), INSTRUCTIONS, Props (+14 more)

### Community 115 - "UserUsagePage.tsx"
Cohesion: 0.18
Nodes (11): fetchTenants(), fetchUserUsage(), label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS (+3 more)

### Community 121 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.10
Nodes (21): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+13 more)

### Community 124 - "getCarmenUrl"
Cohesion: 0.23
Nodes (10): Props, VendorSearch(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri() (+2 more)

## Knowledge Gaps
- **627 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+622 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APInvoice.tsx`, `adminFetch`, `ManualScan.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `AppHeader.tsx`, `orders.ts`, `useSettlementMapping.ts`, `apiFetch`, `useMappingData.ts`, `OrderWorkspace.tsx`, `Mapping.tsx`, `EmailAutomationPage.tsx`, `useMapping.ts`, `AccountingReview.tsx`, `Pricing.tsx`, `useOcrWizard`, `routes.tsx`, `OrderActions.tsx`, `FieldMapping`, `ExtractionsPage.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `HeaderCard.tsx`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `LLMLogsPage.tsx`, `main.tsx`, `APLineItem`, `OrderHistory.tsx`, `JvEditor.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `shared/api/auth.ts`, `SessionsPage.tsx`, `DetailTable.tsx`, `APGroupModal.tsx`, `CustomModal.tsx`, `PaymentTypeModal.test.tsx`, `MaintenanceGate.tsx`, `OrderDrawer.tsx`, `CreditsPage.tsx`, `i18n/index.ts`, `useReviewDocument.ts`, `ReviewDocument.tsx`, `DocumentPreview.tsx`, `PerformancePage.tsx`, `LanguageContext.tsx`, `TKey`, `UserUsagePage.tsx`, `DataTable.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useOcrWizard.ts`, `ManualScan.tsx`, `useAPExtraction.ts`, `useOcrExtraction.ts`, `apiFetch`, `ocr.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `parseNum`, `api.ts`, `useOcrExtraction.ts`, `useSettlementMapping.ts`, `useMappingData.ts`, `Mapping.tsx`, `Pricing.tsx`, `appKey`, `endpoints.ts`, `useUserConsent.ts`, `useAPExtraction.test.ts`, `NotificationBell.tsx`, `useAPExtraction.ts`, `ocr.ts`, `OrderHistory.tsx`, `JvEditor.tsx`, `shared/api/credits.ts`, `emailReview.ts`, `useReviewDocument.ts`, `client.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _627 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07239819004524888 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._