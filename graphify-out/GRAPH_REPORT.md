# Graph Report - OCR  (2026-09-30)

## Corpus Check
- 397 files · ~280,982 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2108 nodes · 5826 edges · 152 communities (105 shown, 47 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7297299`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APInvoice.tsx
- dict/index.ts
- unwrapDetail
- JvEditor.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- mappingSets.ts
- orders.ts
- shared/api/auth.ts
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- useAPSubmission.test.ts
- AccountingReview.tsx
- isAccountAllowed
- FieldMapping
- APAccountMappingStep.tsx
- AdminRouter.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- useMappingData.ts
- Pricing.tsx
- devDependencies
- useMapping.ts
- adminFetch
- useOcrWizard
- OrderWorkspace.tsx
- date.ts
- dependencies
- payment-mapping/types.ts
- ExtractionsPage.tsx
- TopLevelConfigSection.tsx
- Home.tsx
- FeatureFlows.tsx
- APLineItem
- NotificationBell.tsx
- useAPExtraction.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- DateInput.tsx
- QueueRow.tsx
- EmailAutomationPage.tsx
- MaintenancePage.tsx
- endpoints.ts
- ocr.ts
- ProtectedRoute.tsx
- scripts
- OrderHistory.tsx
- appKey
- showToast
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- useFileUpload.ts
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- CreditsPage.tsx
- emailReview.ts
- ManualScan.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- LanguageProvider
- apiFetch
- main.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction.test.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- CustomModal.tsx
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- adminAuth.ts
- i18n/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- reviewReasons.ts
- useAPSubmission.ts
- Skeleton.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- useReviewDocument.ts
- useAuth
- vitest
- vite-env.d.ts
- TKey
- mockPaths.test.ts
- i18n/quotas.ts
- OrderTable.test.tsx
- useOcrExtraction.test.ts
- useEmailSettings.ts
- jobs.ts
- billing/constants.ts
- useT
- OrderTable.tsx
- login.ts
- overview.ts
- TenantSelector.test.tsx
- extractions.ts
- i18n/usage.ts
- sessions.ts
- ar.ts
- AuthContext.tsx
- CompanyInfoSection.tsx
- DataTable.tsx
- getCarmenUrl
- dict/ap.ts
- cc.ts
- @types/react
- flows.ts
- home.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- notif.ts
- dict/modal.ts
- vite
- qr.ts
- review.ts
- @testing-library/react
- warn.ts
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
- plan.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 245 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 59 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 34 edges
8. `appKey()` - 33 edges
9. `FieldMapping` - 31 edges
10. `APLineItem` - 30 edges

## Surprising Connections (you probably didn't know these)
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (152 total, 47 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.18
Nodes (14): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), OcrDraftState, CcDraft, clearAllDrafts(), clearDraft() (+6 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.08
Nodes (38): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+30 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.06
Nodes (24): en, th, DICT, en, th, translate(), en, th (+16 more)

### Community 3 - "unwrapDetail"
Cohesion: 0.17
Nodes (21): unwrapDetail(), EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits() (+13 more)

### Community 4 - "JvEditor.tsx"
Cohesion: 0.11
Nodes (22): ARPreview, ARPreviewRow, suggestPaymentTypes(), Props, ARReviewPane(), labelOf(), Props, DetailRow (+14 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (30): getAvailableFields(), useAPGrouping(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+22 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (26): OrderDrawer(), Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props (+18 more)

### Community 8 - "screens.tsx"
Cohesion: 0.07
Nodes (36): PackList(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+28 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest (+7 more)

### Community 10 - "mappingSets.ts"
Cohesion: 0.29
Nodes (8): AddError, Undo, FeeInvoiceSource, MappingSetsInput, labels, ActiveScan, PaymentTypesHook, SettlementMappingHook

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "shared/api/auth.ts"
Cohesion: 0.26
Nodes (8): UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats, ExchangeResponse

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.18
Nodes (17): ARMappingItem, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES, PostType, previewARJv() (+9 more)

### Community 15 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (25): AccountingReview(), DEFAULT_EMPTY_OBJECT, codeToSource(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES (+17 more)

### Community 17 - "isAccountAllowed"
Cohesion: 0.21
Nodes (11): AccountMappingTable(), GLAccount, Props, MainMappingTable(), BulkApplyBar(), AISuggestBar(), Props, allowedAccountsForDept() (+3 more)

### Community 18 - "FieldMapping"
Cohesion: 0.23
Nodes (19): ARPreviewRequest, Props, Props, Props, Props, MappingStatus, GlMasters, MainMappings (+11 more)

### Community 19 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 20 - "AdminRouter.tsx"
Cohesion: 0.18
Nodes (10): adminDict, AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, registerDict() (+2 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "useMappingData.ts"
Cohesion: 0.25
Nodes (12): JvHeaderCard(), prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+4 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.17
Nodes (18): Props, PACK_META, useOrderHistory(), CatalogState, usePricingCatalog(), cardVariants, containerVariants, OrderHistory() (+10 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "useMapping.ts"
Cohesion: 0.12
Nodes (29): saveARSettings(), bankCodeFromHash(), BankConfigHook, useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, loaded(), saveAccountingConfig (+21 more)

### Community 28 - "adminFetch"
Cohesion: 0.14
Nodes (27): buildQs(), QueryParams, adjustCredits(), CreditBalance, fetchCreditLedger(), fetchCreditPacks(), topupCredits(), fetchQuotaOverview() (+19 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.13
Nodes (20): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+12 more)

### Community 30 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (27): CreditLedgerEntry, fetchCreditBalance(), fetchAdminOrderDocuments(), getOrderSlipUrl(), CompanyPanel(), ContactBuyer(), num(), OrderWorkspace() (+19 more)

### Community 31 - "date.ts"
Cohesion: 0.11
Nodes (22): fetchJobs(), ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS (+14 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "payment-mapping/types.ts"
Cohesion: 0.24
Nodes (15): MappingRow(), MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog(), isMapped() (+7 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.29
Nodes (10): ExtractionFailureRow, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup, getListCols(), groupByCause() (+2 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.17
Nodes (8): BANK_OPTIONS, Props, TEMPLATE_TAGS, TopLevelConfigSection(), CustomSearchSelect(), Props, SelectOption, TopChoice

### Community 36 - "Home.tsx"
Cohesion: 0.12
Nodes (15): OrderReviewShell(), ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, TagConfig (+7 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "APLineItem"
Cohesion: 0.22
Nodes (14): Props, APSuccessStep(), Props, APInvoiceHeader, ApDraft, Args, APDraftState, APExtractionProps (+6 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (43): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, AppHeader(), docLabel() (+35 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.18
Nodes (14): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args, imagesToPdf() (+6 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.14
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 43 - "DateInput.tsx"
Cohesion: 0.43
Nodes (5): paymentDate(), DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 44 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 45 - "EmailAutomationPage.tsx"
Cohesion: 0.11
Nodes (29): fetchAlerts(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps (+21 more)

### Community 46 - "MaintenancePage.tsx"
Cohesion: 0.32
Nodes (11): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenants(), TenantRow, fmtICT() (+3 more)

### Community 47 - "endpoints.ts"
Cohesion: 0.23
Nodes (10): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+2 more)

### Community 48 - "ocr.ts"
Cohesion: 0.12
Nodes (19): OcrExtractionHook, ApiError, ExtractedRow, ExtractResult, getPdfInfo(), PDF_PASSWORD_REQUIRED, PdfInfoResult, Props (+11 more)

### Community 49 - "ProtectedRoute.tsx"
Cohesion: 0.17
Nodes (13): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+5 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (17): WsState, OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP (+9 more)

### Community 52 - "appKey"
Cohesion: 0.16
Nodes (18): getAccountingConfig, seedOcrBranch(), MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), DetailRow (+10 more)

### Community 53 - "showToast"
Cohesion: 0.10
Nodes (26): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), JvState, OcrExtractionProps, OcrSubmissionHook, OcrSubmissionProps (+18 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (26): Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+18 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.14
Nodes (25): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+17 more)

### Community 57 - "useFileUpload.ts"
Cohesion: 0.21
Nodes (7): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl()

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "CreditsPage.tsx"
Cohesion: 0.15
Nodes (26): fetchSessions(), resolveAlert(), revokeSession(), daysAgo(), endOfDay(), label(), Tenant, TenantSelector() (+18 more)

### Community 62 - "emailReview.ts"
Cohesion: 0.18
Nodes (15): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, ItxOverrides, listActivity(), markChipSeen(), ReviewDocument (+7 more)

### Community 63 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (18): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+10 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.33
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.15
Nodes (10): MAP, OrderStatusBadge(), ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), readLang() (+2 more)

### Community 67 - "apiFetch"
Cohesion: 0.30
Nodes (10): _fetchExtract(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen(), API_BASE, ApiClientOptions, apiFetch (+2 more)

### Community 68 - "main.tsx"
Cohesion: 0.10
Nodes (14): AdminRouter, container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory, OrderReviewShell (+6 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "CustomModal.tsx"
Cohesion: 0.29
Nodes (5): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG

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
Cohesion: 0.05
Nodes (27): en, th, en, th, en, th, en, th (+19 more)

### Community 81 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "reviewReasons.ts"
Cohesion: 0.27
Nodes (8): ReviewDocument(), ExtractionWarningBanner(), FIX, REASON_KEY, SETTINGS, stopText(), warningText(), WITH_DETAIL

### Community 88 - "useAPSubmission.ts"
Cohesion: 0.38
Nodes (8): GLAccount, useAPSubmission(), addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), parseDateToISO()

### Community 89 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.10
Nodes (20): AmountSummary(), Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Props (+12 more)

### Community 94 - "useReviewDocument.ts"
Cohesion: 0.33
Nodes (9): approveDocument(), getPending(), rejectDocument(), useReviewDocument(), approve(), reject(), patchAccountingConfig(), toExtractedRows() (+1 more)

### Community 95 - "useAuth"
Cohesion: 0.28
Nodes (6): ConsentGate(), Props, A, B, Probe(), useAuth()

### Community 103 - "TKey"
Cohesion: 0.29
Nodes (7): BatchAction, BatchActionBar(), Props, NavItem, NavSection, APValidationProps, TKey

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 107 - "useOcrExtraction.test.ts"
Cohesion: 0.33
Nodes (5): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData()

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (42): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+34 more)

### Community 110 - "billing/constants.ts"
Cohesion: 0.15
Nodes (16): CheckoutFlow(), itemName(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+8 more)

### Community 111 - "useT"
Cohesion: 0.07
Nodes (34): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+26 more)

### Community 112 - "OrderTable.tsx"
Cohesion: 0.15
Nodes (15): AdminCreditOrder, Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable() (+7 more)

### Community 121 - "AuthContext.tsx"
Cohesion: 0.24
Nodes (12): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), APP_STORAGE_BASES (+4 more)

### Community 122 - "CompanyInfoSection.tsx"
Cohesion: 0.47
Nodes (5): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, CompanyData

### Community 123 - "DataTable.tsx"
Cohesion: 0.10
Nodes (21): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+13 more)

### Community 124 - "getCarmenUrl"
Cohesion: 0.24
Nodes (10): RowAction(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), fixLinkProps(), getCarmenUri() (+2 more)

## Knowledge Gaps
- **636 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+631 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APInvoice.tsx`, `unwrapDetail`, `JvEditor.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `orders.ts`, `shared/api/auth.ts`, `useSettlementMapping.ts`, `AccountingReview.tsx`, `isAccountAllowed`, `FieldMapping`, `APAccountMappingStep.tsx`, `AdminRouter.tsx`, `MaintenanceGate.tsx`, `useMappingData.ts`, `Pricing.tsx`, `useMapping.ts`, `useOcrWizard`, `OrderWorkspace.tsx`, `date.ts`, `payment-mapping/types.ts`, `ExtractionsPage.tsx`, `TopLevelConfigSection.tsx`, `Home.tsx`, `FeatureFlows.tsx`, `APLineItem`, `NotificationBell.tsx`, `useAPExtraction.ts`, `QueueRow.tsx`, `EmailAutomationPage.tsx`, `MaintenancePage.tsx`, `endpoints.ts`, `OrderHistory.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `CreditsPage.tsx`, `ManualScan.tsx`, `APGroupModal.tsx`, `LanguageProvider`, `CustomModal.tsx`, `reviewReasons.ts`, `APAmountSummary.tsx`, `useReviewDocument.ts`, `TKey`, `billing/constants.ts`, `OrderTable.tsx`, `CompanyInfoSection.tsx`, `DataTable.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `JvEditor.tsx`, `parseNum`, `api.ts`, `useSettlementMapping.ts`, `useAPSubmission.test.ts`, `useMappingData.ts`, `Pricing.tsx`, `useMapping.ts`, `useOcrWizard`, `APLineItem`, `NotificationBell.tsx`, `useAPExtraction.ts`, `ocr.ts`, `OrderHistory.tsx`, `appKey`, `showToast`, `shared/api/credits.ts`, `useFileUpload.ts`, `emailReview.ts`, `useAPExtraction.test.ts`, `useUserConsent.ts`, `useAPSubmission.ts`, `useReviewDocument.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrWizard.ts`, `AuthContext.tsx`, `APLineItem`, `parseNum`, `useOcrExtraction.test.ts`, `useEmailSettings.ts`, `useAPSubmission.test.ts`, `appKey`, `useAPSubmission.ts`, `useFileUpload.ts`, `useOcrWizard`, `useReviewDocument.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _636 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08235294117647059 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06050420168067227 - nodes in this community are weakly interconnected._
- **Should `JvEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._