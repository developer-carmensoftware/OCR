# Graph Report - OCR  (2026-10-01)

## Corpus Check
- 400 files · ~290,548 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2131 nodes · 5894 edges · 138 communities (95 shown, 43 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6bc12e83`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAPDraft.ts
- APReviewStep.tsx
- dict/index.ts
- DataTable.tsx
- CustomSearchSelect.tsx
- main.tsx
- parseNum
- TutorialModal.tsx
- useT
- api.ts
- PeriodPicker.tsx
- orders.ts
- NumericInput.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- AccountingReview.tsx
- FieldMapping
- adminFetch
- NotificationBell.tsx
- routes.tsx
- compilerOptions
- 5. Components
- apiFetch
- InputTaxReconciliation.tsx
- APFieldMappingStep.tsx
- devDependencies
- adminUsers.ts
- adminAuth.ts
- useOcrWizard
- CreditsPage.tsx
- OrderWorkspace.tsx
- dependencies
- PaymentMappingDialog.tsx
- Overview.tsx
- useMappingSuggestions.ts
- chrome.ts
- FeatureFlows.tsx
- showToast
- useNotifications.ts
- useAPExtraction.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- overview.ts
- QueueRow.tsx
- QuotaModulesPage.tsx
- ManualScan.tsx
- AdminLogin.tsx
- userUsage.ts
- AuthContext.tsx
- scripts
- ProformaDocument.tsx
- dict/nav.ts
- appKey
- compilerOptions
- ExtractionsPage.tsx
- OrderHistory.tsx
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- APTableRow.tsx
- plan.ts
- DetailTable.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageContext.tsx
- shared/api/credits.ts
- quota.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction.test.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- Mapping.test.tsx
- i18n/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APAccountMappingStep.tsx
- APVendorSearch.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- JvEditor.tsx
- banks.ts
- vitest
- vite-env.d.ts
- TKey
- mockPaths.test.ts
- date.ts
- TenantSelector.test.tsx
- useEmailSettings.ts
- anomalies.ts
- useMappingData.ts
- MetricChartImpl.tsx
- TenantsPage.tsx
- ReviewDocument.tsx
- ErrorBoundary
- useMapping.ts
- i18n/email.ts
- @types/react
- contact.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- notif.ts
- proforma.ts
- vite
- qr.ts
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
- i18n/usage.ts
- flows.ts
- home.ts
- pricing.ts

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
- `NavItem` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `NavSection` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts

## Import Cycles
- None detected.

## Communities (138 total, 43 thin omitted)

### Community 0 - "useAPDraft.ts"
Cohesion: 0.21
Nodes (12): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage() (+4 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.21
Nodes (15): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+7 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.05
Nodes (30): AdminKey, en, th, en, th, en, th, DICT (+22 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.14
Nodes (18): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+10 more)

### Community 4 - "CustomSearchSelect.tsx"
Cohesion: 0.19
Nodes (8): Props, CustomSearchSelect(), handleScroll(), panelStyle(), Props, SelectOption, OPTIONS, TopChoice

### Community 5 - "main.tsx"
Cohesion: 0.09
Nodes (27): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+19 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (29): AmountSummary(), APStep, DEFAULT_MAPPINGS, EMPTY_HEADER, getAvailableFields(), NUMERIC_FIELDS, useAPInvoice(), adjustField() (+21 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (29): DEMO_PACKS, DEMO_PLANS, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, purchaseFigures(), CATALOG, FOCUS_STEPS, PURCHASE_FIGURES (+21 more)

### Community 8 - "useT"
Cohesion: 0.09
Nodes (43): PackList(), Props, PendingOrderBanner(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS (+35 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (15): SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 10 - "PeriodPicker.tsx"
Cohesion: 0.11
Nodes (30): fetchTenantRanking(), Column, DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), MetricChartProps, granularityFor() (+22 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.11
Nodes (24): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+16 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.13
Nodes (20): AccountingReview(), DEFAULT_EMPTY_OBJECT, JvHeaderCard(), TopLevelConfigSection(), codeToSource(), descriptionForBank(), buildGljvPayload(), buildJvRows() (+12 more)

### Community 17 - "FieldMapping"
Cohesion: 0.19
Nodes (19): MappingRow(), Props, Props, STATUS_LABEL, AddError, MappingItem, MappingSet, MappingStatus (+11 more)

### Community 18 - "adminFetch"
Cohesion: 0.24
Nodes (21): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), getOrderSlipUrl(), AdminUserRow (+13 more)

### Community 19 - "NotificationBell.tsx"
Cohesion: 0.12
Nodes (22): BellItem, Notification, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT (+14 more)

### Community 20 - "routes.tsx"
Cohesion: 0.18
Nodes (15): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, NavItem (+7 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "apiFetch"
Cohesion: 0.08
Nodes (31): approveDocument(), Correction, FIELD_NAME_MAP, logCorrections(), approve(), exchangeSSOToken(), getUsage(), UsageData (+23 more)

### Community 24 - "InputTaxReconciliation.tsx"
Cohesion: 0.16
Nodes (14): InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen(), Props (+6 more)

### Community 25 - "APFieldMappingStep.tsx"
Cohesion: 0.31
Nodes (8): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APFieldKey, FieldOption, isNumFld()

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 28 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.10
Nodes (26): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+18 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 31 - "OrderWorkspace.tsx"
Cohesion: 0.08
Nodes (33): AdminCreditOrder, fetchAdminOrderDocuments(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf() (+25 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "PaymentMappingDialog.tsx"
Cohesion: 0.42
Nodes (8): MappingTable(), Filter, orderOf(), PaymentMappingDialog(), isMapped(), statsOf(), STATUS_RANK, statusOf()

### Community 34 - "Overview.tsx"
Cohesion: 0.29
Nodes (12): buildQs(), QueryParams, fetchAlerts(), fetchSessions(), fetchErrorBreakdown(), fetchExtractionFailures(), fetchLLMLogs(), fetchUsageSummary() (+4 more)

### Community 35 - "useMappingSuggestions.ts"
Cohesion: 0.15
Nodes (23): AccountMappingTable(), GLAccount, suggestMapping(), suggestPaymentTypes(), JvEditor(), MainMappingTable(), Props, BulkApplyBar() (+15 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "showToast"
Cohesion: 0.11
Nodes (23): Props, APInvoiceHeader, Args, APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine (+15 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.13
Nodes (20): WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote (+12 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.07
Nodes (41): APDraftState, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), imagesToPdf(), MAX_MULTI_IMAGES (+33 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (15): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, configBanks, configWaits (+7 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.23
Nodes (14): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+6 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (23): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), EmptyState(), EmptyStateProps (+15 more)

### Community 46 - "ManualScan.tsx"
Cohesion: 0.07
Nodes (31): APUploadStep(), INSTRUCTIONS, Props, AP_STEPS, INSTRUCTIONS, Props, UploadSection(), APInvoice (+23 more)

### Community 47 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 49 - "AuthContext.tsx"
Cohesion: 0.10
Nodes (26): revokeSession(), clearToken(), storeToken(), AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute() (+18 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "ProformaDocument.tsx"
Cohesion: 0.28
Nodes (10): expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), _hundreds(), _ONES, _TENS (+2 more)

### Community 53 - "appKey"
Cohesion: 0.07
Nodes (41): diffCorrections(), getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+33 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "ExtractionsPage.tsx"
Cohesion: 0.11
Nodes (41): fetchJobs(), resolveAlert(), revokeSession(), ExtractionFailureRow, fetchPerformanceLogs(), fetchUserUsage(), daysAgo(), endOfDay() (+33 more)

### Community 56 - "OrderHistory.tsx"
Cohesion: 0.15
Nodes (23): CheckoutFlow(), itemName(), OrderRow(), RowAction, rowInitial, rowReducer(), catalogName(), isSubscriptionCode() (+15 more)

### Community 57 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "APTableRow.tsx"
Cohesion: 0.14
Nodes (10): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Pager() (+2 more)

### Community 63 - "DetailTable.tsx"
Cohesion: 0.13
Nodes (17): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+9 more)

### Community 64 - "APLineItem"
Cohesion: 0.19
Nodes (14): Props, APGroupModal(), profileLabel(), Props, APSuccessStep(), Props, ApDraft, Args (+6 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.11
Nodes (16): ACCEPTED, Props, SlipUpload(), SLIP, configBanks, QUIET, ZERO, Lang (+8 more)

### Community 67 - "shared/api/credits.ts"
Cohesion: 0.10
Nodes (32): Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, SLIP, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER (+24 more)

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

### Community 77 - "useUserConsent.ts"
Cohesion: 0.19
Nodes (14): getConsentStatus(), postConsent(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal() (+6 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.04
Nodes (27): en, th, en, th, en, th, en, th (+19 more)

### Community 81 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 89 - "APVendorSearch.tsx"
Cohesion: 0.15
Nodes (12): Props, MAP, OrderStatusBadge(), OrderStatus, Badge(), BadgeVariant, Props, Coords (+4 more)

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.22
Nodes (8): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Card(), Props

### Community 94 - "JvEditor.tsx"
Cohesion: 0.13
Nodes (22): getPending(), ItxOverrides, rejectDocument(), Props, DetailRow, Props, Props, BlockReason (+14 more)

### Community 95 - "banks.ts"
Cohesion: 0.13
Nodes (27): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField, codeToDisplayName() (+19 more)

### Community 103 - "TKey"
Cohesion: 0.09
Nodes (21): BatchAction, BatchActionBar(), Props, APValidationProps, ACTIVE_TAG, containerVariants, Home(), itemVariants (+13 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 106 - "date.ts"
Cohesion: 0.18
Nodes (15): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), DATE_KEYS, HeaderCard(), Props (+7 more)

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (42): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+34 more)

### Community 110 - "useMappingData.ts"
Cohesion: 0.26
Nodes (16): useAPSubmission(), Props, Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterAccount (+8 more)

### Community 111 - "MetricChartImpl.tsx"
Cohesion: 0.22
Nodes (8): axisTick, ChartType, FALLBACK_COLORS, MetricChart(), Series, tooltipItemStyle, tooltipLabelStyle, tooltipStyle

### Community 113 - "TenantsPage.tsx"
Cohesion: 0.18
Nodes (14): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, KPICard() (+6 more)

### Community 115 - "ReviewDocument.tsx"
Cohesion: 0.11
Nodes (19): OrderDrawer(), Props, ReviewDocument(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG (+11 more)

### Community 117 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 122 - "useMapping.ts"
Cohesion: 0.23
Nodes (13): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+5 more)

## Knowledge Gaps
- **643 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+638 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useAPDraft.ts`, `APReviewStep.tsx`, `DataTable.tsx`, `CustomSearchSelect.tsx`, `main.tsx`, `parseNum`, `TutorialModal.tsx`, `PeriodPicker.tsx`, `orders.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `AccountingReview.tsx`, `FieldMapping`, `adminFetch`, `NotificationBell.tsx`, `routes.tsx`, `apiFetch`, `InputTaxReconciliation.tsx`, `APFieldMappingStep.tsx`, `useOcrWizard`, `CreditsPage.tsx`, `OrderWorkspace.tsx`, `PaymentMappingDialog.tsx`, `Overview.tsx`, `useMappingSuggestions.ts`, `FeatureFlows.tsx`, `showToast`, `useNotifications.ts`, `useAPExtraction.ts`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `ManualScan.tsx`, `AdminLogin.tsx`, `ProformaDocument.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `OrderActions.tsx`, `APTableRow.tsx`, `DetailTable.tsx`, `APLineItem`, `LanguageContext.tsx`, `shared/api/credits.ts`, `useUserConsent.ts`, `APAccountMappingStep.tsx`, `APVendorSearch.tsx`, `APAmountSummary.tsx`, `JvEditor.tsx`, `banks.ts`, `TKey`, `date.ts`, `useMappingData.ts`, `MetricChartImpl.tsx`, `TenantsPage.tsx`, `ReviewDocument.tsx`, `useMapping.ts`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `main.tsx`, `parseNum`, `api.ts`, `useSettlementMapping.ts`, `NotificationBell.tsx`, `InputTaxReconciliation.tsx`, `useOcrWizard`, `useMappingSuggestions.ts`, `showToast`, `useNotifications.ts`, `useAPExtraction.ts`, `appKey`, `OrderHistory.tsx`, `shared/api/credits.ts`, `useAPExtraction.test.ts`, `useUserConsent.ts`, `JvEditor.tsx`, `useMappingData.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useAPDraft.ts`, `useMappingSuggestions.ts`, `parseNum`, `useAPExtraction.ts`, `useEmailSettings.ts`, `useMappingData.ts`, `AuthContext.tsx`, `appKey`, `apiFetch`, `useMapping.ts`, `useOcrWizard`, `JvEditor.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _643 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._
- **Should `main.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._