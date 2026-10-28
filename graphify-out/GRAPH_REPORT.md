# Graph Report - OCR  (2026-10-28)

## Corpus Check
- 421 files · ~307,726 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2234 nodes · 6232 edges · 155 communities (98 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9325c0d2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AccountMappingTable.tsx
- APLineItemsTable.tsx
- dict/index.ts
- useReviewDocument.ts
- appKey
- PmsReviewDocument.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- useOcrWizard.ts
- useMapping.ts
- orders.ts
- routes.tsx
- useSettlementMapping.ts
- useT
- EmailAutomationPage.tsx
- useScrollLock
- useOcrSubmission.test.ts
- useOcrExtraction
- ApiKeysPage.tsx
- AccountingReview.tsx
- compilerOptions
- 5. Components
- useAPExtraction.ts
- AdminLogin.tsx
- OrderTable.tsx
- devDependencies
- shared/api/credits.ts
- PeriodPicker.tsx
- buildQs
- CreditsPage.tsx
- DocumentPreview.tsx
- dependencies
- ManualScan.tsx
- useAPSubmission.test.ts
- AdminRouter.tsx
- ExtractionsPage.tsx
- FeatureFlows.tsx
- OrderHistory.tsx
- NotificationBell.tsx
- showToast
- payment-mapping/types.ts
- ReviewDocument.test.tsx
- useAPSubmission.ts
- EmailSettings.tsx
- DataTable.tsx
- QueueRow.tsx
- useMappingSuggestions.ts
- ReviewQueue.tsx
- adminAuth.ts
- scripts
- api.ts
- NumericInput.tsx
- compilerOptions
- OrderWorkspace.tsx
- InputTaxReconciliation.tsx
- ReviewQueue.test.tsx
- CLAUDE.md
- Contributing
- i18n/common.ts
- contact.ts
- i18n/email.ts
- TKey
- Carmen AI — OCR & Import System
- APInvoice.tsx
- APReviewStep.tsx
- i18n/nav.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- adminFetch
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderActions.tsx
- apiFetch
- vercel.json
- Architecture
- overview.ts
- OrderStatusBadge.tsx
- Mapping.test.tsx
- reviewReasons.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- main.tsx
- pack.ts
- i18n/index.ts
- qr.ts
- performance.ts
- usePdfPasswordPrompt
- SlipUpload.tsx
- checkout.ts
- vite-env.d.ts
- postcss
- mockPaths.test.ts
- shared/api/auth.ts
- cc.ts
- typescript
- dict/maintenance.ts
- orev.ts
- pms.ts
- flows.ts
- proforma.ts
- quota.ts
- pricing.ts
- slip.ts
- warn.ts
- @testing-library/dom
- eslint
- ErrorBoundary
- dict/apiKeys.ts
- TenantSelector.test.tsx
- ar.ts
- TenantsPage.tsx
- dict/common.ts
- anomalies.ts
- chrome.ts
- home.ts
- @types/react-dom
- extractions.ts
- ApiKeysPage.test.tsx
- APAccountMappingStep.tsx
- vite
- useAPExtraction.test.ts
- plan.ts
- dict/ap.ts
- dict/modal.ts
- tutorial.ts
- @testing-library/jest-dom
- @eslint/js
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
- dict/usage.ts
- whatsnew.ts
- @types/react
- notif.ts
- AppHeader.tsx
- jsdom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 258 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 64 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 37 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `round2()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/AccountMappingTable.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (155 total, 57 thin omitted)

### Community 0 - "AccountMappingTable.tsx"
Cohesion: 0.13
Nodes (12): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, CustomSearchSelect(), handleScroll(), panelStyle() (+4 more)

### Community 1 - "APLineItemsTable.tsx"
Cohesion: 0.16
Nodes (17): Props, Ctrl, APTableFooter(), Props, APTableHeader(), Props, FixedTaxSettings, Props (+9 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.22
Nodes (8): DICT, en, th, translate(), en, th, FILES, NAMESPACE_FILES

### Community 3 - "useReviewDocument.ts"
Cohesion: 0.09
Nodes (35): BlockReason, BU_WIDE, JvEditor(), JvState, Overrides, Props, rowId(), JvHeaderCard() (+27 more)

### Community 4 - "appKey"
Cohesion: 0.13
Nodes (28): SuggestResponse, bankCodeFromHash(), getAccountingConfig, seedOcrBranch(), useBankConfig(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage() (+20 more)

### Community 5 - "PmsReviewDocument.tsx"
Cohesion: 0.20
Nodes (9): usePmsReview(), approve(), reject(), dmy(), PmsReviewDocument(), Props, DAY, weekday() (+1 more)

### Community 6 - "parseNum"
Cohesion: 0.13
Nodes (33): AmountSummary(), APGroupModal(), profileLabel(), Props, getAvailableFields(), useAPGrouping(), useAPInvoice(), adjustField() (+25 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.08
Nodes (36): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+28 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.16
Nodes (16): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), inputTaxOwed(), OcrDraftState, CcDraft, draftWorthOffering() (+8 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.11
Nodes (25): POST_TYPES, saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, buildMappingSets(), BankConfigHook, COMPANY_FIELDS (+17 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "routes.tsx"
Cohesion: 0.16
Nodes (24): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchPerformanceLogs(), fetchUserUsage(), daysAgo() (+16 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.12
Nodes (25): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+17 more)

### Community 14 - "useT"
Cohesion: 0.12
Nodes (19): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+11 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "useScrollLock"
Cohesion: 0.20
Nodes (8): Dialog(), DialogProps, focusablesIn(), Options, useDialogFocus(), __resetScrollLock(), Locker(), useScrollLock()

### Community 17 - "useOcrSubmission.test.ts"
Cohesion: 0.15
Nodes (12): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+4 more)

### Community 18 - "useOcrExtraction"
Cohesion: 0.15
Nodes (7): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), ExtractResult

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.16
Nodes (20): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow, FeedStatus, pmsEventsUrl() (+12 more)

### Community 20 - "AccountingReview.tsx"
Cohesion: 0.09
Nodes (25): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, Props, codeToSource(), descriptionForBank(), getBankInfo(), getGLSourceCode() (+17 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (27): Args, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args (+19 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "OrderTable.tsx"
Cohesion: 0.16
Nodes (13): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+5 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint-plugin-react-hooks, globals, prettier, @testing-library/react (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.13
Nodes (28): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, CheckoutPhase, CheckoutSession, clearPersistedCheckout() (+20 more)

### Community 28 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (27): fetchTenantRanking(), Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+19 more)

### Community 29 - "buildQs"
Cohesion: 0.31
Nodes (10): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, fetchErrorBreakdown(), fetchUsageSummary(), fetchUsageTotals(), fmtCost() (+2 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (21): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+13 more)

### Community 34 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 35 - "AdminRouter.tsx"
Cohesion: 0.35
Nodes (8): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminProtectedRoute(), useAdminAuth()

### Community 36 - "ExtractionsPage.tsx"
Cohesion: 0.09
Nodes (32): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), ExtractionFailureRow, fetchExtractionFailures() (+24 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "OrderHistory.tsx"
Cohesion: 0.16
Nodes (25): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode() (+17 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (40): WhatsNew(), LanguageProvider(), readLang(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification (+32 more)

### Community 40 - "showToast"
Cohesion: 0.18
Nodes (22): applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard() (+14 more)

### Community 41 - "payment-mapping/types.ts"
Cohesion: 0.11
Nodes (26): BulkApplyBar(), MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog(), ACCOUNTS (+18 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "useAPSubmission.ts"
Cohesion: 0.24
Nodes (14): GLAccount, useAPSubmission(), addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), DateInput() (+6 more)

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (55): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+47 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.09
Nodes (25): fetchLLMLogs(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir (+17 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.15
Nodes (18): recordInputTax(), ReviewDocument, ReviewDocumentDetail, formatWhen(), fullWhen(), Message(), pad(), parseWhen() (+10 more)

### Community 47 - "useMappingSuggestions.ts"
Cohesion: 0.13
Nodes (34): suggestMapping(), suggestPaymentTypes(), MainMappingTable(), Props, MappingRow(), Props, Props, Props (+26 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (17): ActivityFilter, ALL_SCOPES, listActivity(), QUEUE_CHIPS, ReviewQueueController, useReviewQueue(), COLUMNS, docIdFromHash() (+9 more)

### Community 49 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "api.ts"
Cohesion: 0.10
Nodes (19): approve(), APVendorMapping, APVendorMappingResponse, ConfigPatch, patchAccountingConfig(), SaveAccountingConfigResult, AccountingConfigRequest, ApiError (+11 more)

### Community 53 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "OrderWorkspace.tsx"
Cohesion: 0.13
Nodes (18): AdminCreditOrder, fetchAdminOrderDocuments(), OrderDrawer(), Props, Props, ContactBuyer(), num(), OrderWorkspace() (+10 more)

### Community 56 - "InputTaxReconciliation.tsx"
Cohesion: 0.12
Nodes (24): ItxOverrides, Props, DetailRow, InputTaxPanel(), Props, InputTaxReconciliation(), handleAddInputTax(), Props (+16 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 64 - "TKey"
Cohesion: 0.12
Nodes (17): BatchAction, BatchActionBar(), Props, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection() (+9 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "APInvoice.tsx"
Cohesion: 0.12
Nodes (22): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props, APTableRow(), APUploadStep() (+14 more)

### Community 67 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (19): Props, Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APLineItemsTable() (+11 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "adminFetch"
Cohesion: 0.24
Nodes (21): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), getOrderSlipUrl(), AdminUserRow (+13 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 77 - "apiFetch"
Cohesion: 0.09
Nodes (34): APVendorProps, useAPVendor(), ActivityPage, approveDocument(), ApproveResult, getPending(), rejectDocument(), ReviewFlag (+26 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 81 - "OrderStatusBadge.tsx"
Cohesion: 0.50
Nodes (3): MAP, OrderStatusBadge(), OrderStatus

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "reviewReasons.ts"
Cohesion: 0.17
Nodes (12): RowAction(), OcrExtractionHook, ReviewDocument(), ExtractionWarningBanner(), Props, ExtractionWarning, FIX, fixLinkProps() (+4 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.12
Nodes (23): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+15 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.06
Nodes (50): exchangeSSOToken(), revokeSession(), CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, clearToken(), storeToken(), getConsentStatus(), postConsent() (+42 more)

### Community 89 - "main.tsx"
Cohesion: 0.12
Nodes (19): AdminRouter, container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory, Pricing (+11 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.04
Nodes (28): en, th, en, th, en, th, adminDict, AdminKey (+20 more)

### Community 94 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 95 - "SlipUpload.tsx"
Cohesion: 0.33
Nodes (4): ACCEPTED, Props, SlipUpload(), SLIP

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "shared/api/auth.ts"
Cohesion: 0.11
Nodes (20): SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), OrderHistory(), parseFocusId(), Pricing(), ActiveSubscription (+12 more)

### Community 119 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 125 - "TenantsPage.tsx"
Cohesion: 0.13
Nodes (19): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, TenantSearch() (+11 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 141 - "useAPExtraction.test.ts"
Cohesion: 0.18
Nodes (10): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+2 more)

### Community 169 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (9): OrderReviewShell(), registerDict(), OrderReviewShell, Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow() (+1 more)

## Knowledge Gaps
- **667 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+662 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `AccountMappingTable.tsx`, `APLineItemsTable.tsx`, `useReviewDocument.ts`, `appKey`, `PmsReviewDocument.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useOcrWizard.ts`, `useMapping.ts`, `orders.ts`, `routes.tsx`, `APAccountMappingStep.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `ApiKeysPage.tsx`, `AccountingReview.tsx`, `useAPExtraction.ts`, `AdminLogin.tsx`, `OrderTable.tsx`, `shared/api/credits.ts`, `PeriodPicker.tsx`, `buildQs`, `CreditsPage.tsx`, `DocumentPreview.tsx`, `ManualScan.tsx`, `AdminRouter.tsx`, `ExtractionsPage.tsx`, `FeatureFlows.tsx`, `OrderHistory.tsx`, `NotificationBell.tsx`, `showToast`, `AppHeader.tsx`, `payment-mapping/types.ts`, `DataTable.tsx`, `QueueRow.tsx`, `useMappingSuggestions.ts`, `ReviewQueue.tsx`, `OrderWorkspace.tsx`, `InputTaxReconciliation.tsx`, `TKey`, `APInvoice.tsx`, `APReviewStep.tsx`, `adminFetch`, `OrderActions.tsx`, `apiFetch`, `OrderStatusBadge.tsx`, `reviewReasons.ts`, `Pricing.tsx`, `AuthContext.tsx`, `main.tsx`, `SlipUpload.tsx`, `shared/api/auth.ts`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `appKey`, `parseNum`, `useOcrWizard.ts`, `useMapping.ts`, `useSettlementMapping.ts`, `useAPExtraction.test.ts`, `useAPExtraction.ts`, `shared/api/credits.ts`, `useAPSubmission.test.ts`, `OrderHistory.tsx`, `NotificationBell.tsx`, `useAPSubmission.ts`, `QueueRow.tsx`, `useMappingSuggestions.ts`, `ReviewQueue.tsx`, `api.ts`, `InputTaxReconciliation.tsx`, `AuthContext.tsx`, `shared/api/auth.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `API` connect `apiFetch` to `orders.ts`, `routes.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `ApiKeysPage.tsx`, `useAPExtraction.ts`, `AdminLogin.tsx`, `shared/api/credits.ts`, `buildQs`, `CreditsPage.tsx`, `ExtractionsPage.tsx`, `useAPSubmission.ts`, `EmailSettings.tsx`, `adminAuth.ts`, `api.ts`, `InputTaxReconciliation.tsx`, `adminFetch`, `shared/api/auth.ts`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _667 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AccountMappingTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13157894736842105 - nodes in this community are weakly interconnected._
- **Should `useReviewDocument.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09292929292929293 - nodes in this community are weakly interconnected._
- **Should `appKey` be split into smaller, more focused modules?**
  _Cohesion score 0.13445378151260504 - nodes in this community are weakly interconnected._