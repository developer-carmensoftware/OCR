# Graph Report - OCR  (2026-09-30)

## Corpus Check
- 396 files · ~280,420 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2107 nodes · 5825 edges · 163 communities (104 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `60c09c86`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- adminFetch
- UploadSection.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- FieldMapping
- orders.ts
- useOcrExtraction.test.ts
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- apiFetch
- AccountingReview.tsx
- useMappingData.ts
- OrderWorkspace.tsx
- ap-invoice/constants.ts
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- banks.ts
- JvEditor.tsx
- Pricing.tsx
- devDependencies
- useMapping.ts
- CreditsPage.tsx
- useOcrWizard
- ProformaDocument.tsx
- OrderActions.tsx
- dependencies
- Mapping.tsx
- ExtractionsPage.tsx
- TopLevelConfigSection.tsx
- TKey
- FeatureFlows.tsx
- useAPExtraction.test.ts
- NotificationBell.tsx
- useAPExtraction.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- QueueRow.tsx
- QuotaModulesPage.tsx
- TenantsPage.tsx
- AdminRouter.tsx
- usePdfPasswordPrompt
- APAccountMappingStep.tsx
- scripts
- OrderHistory.tsx
- credit-card/hooks/index.ts
- useOcrSubmission.test.ts
- compilerOptions
- routes.tsx
- shared/api/credits.ts
- APInvoice.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- useT
- emailReview.ts
- ManualScan.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- CheckoutFlow.tsx
- ArCustomerProfiles.tsx
- main.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminUsers.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- CustomModal.tsx
- MainMappingTable.tsx
- vercel.json
- Architecture
- i18n/index.ts
- AdminAuthContext.tsx
- llmLogs.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- ReviewDocument.tsx
- OrderReviewShell.tsx
- InputTaxReconciliation.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- DocumentPreview.tsx
- APVendorSearch.tsx
- vitest
- vite-env.d.ts
- SlipViewer.tsx
- mockPaths.test.ts
- APTableRow.tsx
- AdminCreditOrder
- i18n/common.ts
- useEmailSettings.ts
- anomalies.ts
- LanguageProvider
- LanguageContext.tsx
- OrderTable.tsx
- sessions.ts
- errors.ts
- TenantSelector.test.tsx
- extractions.ts
- login.ts
- i18n/maintenance.ts
- ErrorBoundary
- ar.ts
- client.ts
- CompanyInfoSection.tsx
- DataTable.tsx
- getCarmenUrl
- i18n/email.ts
- overview.ts
- contact.ts
- whatsnew.ts
- @types/react
- flows.ts
- home.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- dict/usage.ts
- notif.ts
- dict/modal.ts
- dict/maintenance.ts
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
- pricing.ts
- plan.ts
- @testing-library/dom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 245 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 58 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 34 edges
8. `appKey()` - 33 edges
9. `FieldMapping` - 31 edges
10. `APLineItem` - 30 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
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

## Communities (163 total, 59 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.23
Nodes (12): useAPDraft(), mountRestored(), TAX_PROFILES, OcrDraftState, CcDraft, clearDraft(), DraftKind, draftPromptMessage() (+4 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.16
Nodes (10): en, th, en, th, DICT, en, th, translate() (+2 more)

### Community 3 - "adminFetch"
Cohesion: 0.23
Nodes (22): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), getOrderSlipUrl(), AdminUserRow (+14 more)

### Community 4 - "UploadSection.tsx"
Cohesion: 0.50
Nodes (3): INSTRUCTIONS, Props, UploadSection()

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (27): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+19 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (33): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+25 more)

### Community 9 - "api.ts"
Cohesion: 0.12
Nodes (17): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, useMappingSuggestions(), accountName(), ApiError, APInvoiceItem, CodeOption (+9 more)

### Community 10 - "FieldMapping"
Cohesion: 0.19
Nodes (21): Props, Props, Props, AddError, MappingItem, MappingSet, MappingStatus, SetStats (+13 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "useOcrExtraction.test.ts"
Cohesion: 0.29
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.16
Nodes (19): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+11 more)

### Community 15 - "apiFetch"
Cohesion: 0.09
Nodes (30): Args, APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes (+22 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.12
Nodes (23): AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES (+15 more)

### Community 17 - "useMappingData.ts"
Cohesion: 0.16
Nodes (23): AccountMappingTable(), GLAccount, Props, MainMappingTable(), BulkApplyBar(), Props, GlMasters, prefetchGlMasters() (+15 more)

### Community 18 - "OrderWorkspace.tsx"
Cohesion: 0.20
Nodes (11): CreditLedgerEntry, fetchAdminOrderDocuments(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 19 - "ap-invoice/constants.ts"
Cohesion: 0.13
Nodes (22): Props, Props, APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props (+14 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "banks.ts"
Cohesion: 0.17
Nodes (17): codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape(), NormalizedConfig, Case (+9 more)

### Community 24 - "JvEditor.tsx"
Cohesion: 0.11
Nodes (22): getPending(), ItxOverrides, ARReviewPane(), labelOf(), Props, DetailRow, Props, Props (+14 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.18
Nodes (15): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, TIER_ICONS, priceLines(), ENTERPRISE, PackPresentation (+7 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "useMapping.ts"
Cohesion: 0.09
Nodes (39): saveARSettings(), bankCodeFromHash(), BankConfigHook, getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig (+31 more)

### Community 28 - "CreditsPage.tsx"
Cohesion: 0.19
Nodes (18): buildQs(), QueryParams, adjustCredits(), CreditBalance, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits() (+10 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 30 - "ProformaDocument.tsx"
Cohesion: 0.25
Nodes (11): PaymentInfo, expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "Mapping.tsx"
Cohesion: 0.23
Nodes (12): MappingRow(), MappingTable(), STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog(), isMapped(), statsOf() (+4 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+6 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.15
Nodes (9): BANK_OPTIONS, Props, TEMPLATE_TAGS, TopLevelConfigSection(), CustomSearchSelect(), Props, SelectOption, TopChoice (+1 more)

### Community 36 - "TKey"
Cohesion: 0.16
Nodes (13): BatchAction, Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants (+5 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.05
Nodes (48): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, AppHeader(), Props (+40 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (26): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas() (+18 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.14
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 43 - "date.ts"
Cohesion: 0.33
Nodes (10): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.35
Nodes (10): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+2 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (25): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), fetchUsageTotals(), EmptyState(), EmptyStateProps, Tab (+17 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.24
Nodes (9): fetchTenantDetail(), TenantRow, KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

### Community 47 - "AdminRouter.tsx"
Cohesion: 0.19
Nodes (14): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+6 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.20
Nodes (10): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+2 more)

### Community 49 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.13
Nodes (23): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+15 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (22): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload (+14 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "routes.tsx"
Cohesion: 0.17
Nodes (12): fetchTenantRanking(), Column, AdminLayout(), getActiveHash(), NAV_SECTIONS, Overview, getColsCost(), getColsPerf() (+4 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (28): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+20 more)

### Community 57 - "APInvoice.tsx"
Cohesion: 0.18
Nodes (9): APUploadStep(), INSTRUCTIONS, Props, APInvoice(), APInvoice, DEFAULT_STEPS, Props, Step (+1 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "useT"
Cohesion: 0.12
Nodes (44): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage() (+36 more)

### Community 62 - "emailReview.ts"
Cohesion: 0.20
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 63 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (22): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+14 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.29
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (11): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP (+3 more)

### Community 67 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 68 - "main.tsx"
Cohesion: 0.20
Nodes (9): AdminRouter, container, EmailSettings, getRoute(), Mapping, OrderHistory, Pricing, Router() (+1 more)

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

### Community 76 - "CustomModal.tsx"
Cohesion: 0.19
Nodes (8): OrderDrawer(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 77 - "MainMappingTable.tsx"
Cohesion: 0.25
Nodes (8): Props, MainMappings, MainMappingKey, SuggestionSource, FIXED, Translate, AISuggestBar(), Props

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.07
Nodes (19): en, th, en, th, AdminKey, en, th, en (+11 more)

### Community 81 - "AdminAuthContext.tsx"
Cohesion: 0.33
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "ReviewDocument.tsx"
Cohesion: 0.18
Nodes (14): RowAction(), OcrExtractionHook, Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), Props, ExtractionWarning (+6 more)

### Community 88 - "OrderReviewShell.tsx"
Cohesion: 0.22
Nodes (4): adminDict, OrderReviewShell(), registerDict(), OrderReviewShell

### Community 89 - "InputTaxReconciliation.tsx"
Cohesion: 0.16
Nodes (11): handleAddInputTax(), _parseCarmenHttpError(), submitInputTax(), ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps (+3 more)

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.23
Nodes (8): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 94 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 95 - "APVendorSearch.tsx"
Cohesion: 0.19
Nodes (11): Props, VendorSearch(), Vendor, Badge(), BadgeVariant, Props, Coords, getCoords() (+3 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 106 - "AdminCreditOrder"
Cohesion: 0.29
Nodes (6): AdminCreditOrder, Props, Props, many(), order(), WsState

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (40): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+32 more)

### Community 110 - "LanguageProvider"
Cohesion: 0.22
Nodes (6): MAP, OrderStatusBadge(), LITE, LanguageProvider(), readLang(), OrderStatus

### Community 111 - "LanguageContext.tsx"
Cohesion: 0.09
Nodes (28): fetchTenants(), fetchErrorBreakdown(), fetchUsageSummary(), LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS (+20 more)

### Community 112 - "OrderTable.tsx"
Cohesion: 0.19
Nodes (13): BatchActionBar(), BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable() (+5 more)

### Community 119 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 121 - "client.ts"
Cohesion: 0.05
Nodes (62): OrderHistory(), parseFocusId(), exchangeSSOToken(), getUsage(), revokeSession(), UsageData, API_BASE, ApiClientOptions (+54 more)

### Community 122 - "CompanyInfoSection.tsx"
Cohesion: 0.47
Nodes (5): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, CompanyData

### Community 123 - "DataTable.tsx"
Cohesion: 0.10
Nodes (18): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+10 more)

### Community 124 - "getCarmenUrl"
Cohesion: 0.29
Nodes (8): COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri(), carmenSettingsUrl(), getCarmenUrl()

## Knowledge Gaps
- **636 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+631 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APReviewStep.tsx`, `adminFetch`, `UploadSection.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `orders.ts`, `useSettlementMapping.ts`, `apiFetch`, `AccountingReview.tsx`, `useMappingData.ts`, `OrderWorkspace.tsx`, `ap-invoice/constants.ts`, `EmailAutomationPage.tsx`, `JvEditor.tsx`, `Pricing.tsx`, `useMapping.ts`, `CreditsPage.tsx`, `useOcrWizard`, `ProformaDocument.tsx`, `OrderActions.tsx`, `Mapping.tsx`, `ExtractionsPage.tsx`, `TopLevelConfigSection.tsx`, `TKey`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `TenantsPage.tsx`, `AdminRouter.tsx`, `APAccountMappingStep.tsx`, `OrderHistory.tsx`, `routes.tsx`, `shared/api/credits.ts`, `APInvoice.tsx`, `ManualScan.tsx`, `APGroupModal.tsx`, `CheckoutFlow.tsx`, `ArCustomerProfiles.tsx`, `CustomModal.tsx`, `MainMappingTable.tsx`, `ReviewDocument.tsx`, `OrderReviewShell.tsx`, `InputTaxReconciliation.tsx`, `APAmountSummary.tsx`, `DocumentPreview.tsx`, `APVendorSearch.tsx`, `SlipViewer.tsx`, `LanguageProvider`, `LanguageContext.tsx`, `OrderTable.tsx`, `client.ts`, `CompanyInfoSection.tsx`, `DataTable.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Why does `useOcrExtraction()` connect `useOcrWizard` to `useOcrWizard.ts`, `useMapping.ts`, `credit-card/hooks/index.ts`, `useOcrExtraction.test.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `client.ts`, `CheckoutFlow.tsx`, `useAPExtraction.test.ts`, `parseNum`, `useAPExtraction.ts`, `api.ts`, `NotificationBell.tsx`, `useSettlementMapping.ts`, `useMappingData.ts`, `OrderHistory.tsx`, `useOcrSubmission.test.ts`, `JvEditor.tsx`, `InputTaxReconciliation.tsx`, `shared/api/credits.ts`, `useMapping.ts`, `emailReview.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _636 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12473118279569892 - nodes in this community are weakly interconnected._
- **Should `screens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08974358974358974 - nodes in this community are weakly interconnected._