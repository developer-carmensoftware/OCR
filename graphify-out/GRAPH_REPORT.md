# Graph Report - OCR  (2026-10-26)

## Corpus Check
- 420 files · ~309,609 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2232 nodes · 6229 edges · 151 communities (104 shown, 47 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8020d8a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APLineItem
- ap-invoice/constants.ts
- dict/index.ts
- AccountingReview.tsx
- payment-mapping/types.ts
- PmsReviewDocument.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- showToast
- useMapping.ts
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- AdminRouter.tsx
- EmailAutomationPage.tsx
- TopLevelConfigSection.tsx
- appKey
- APVendorSearch.tsx
- ApiKeysPage.tsx
- banks.ts
- compilerOptions
- 5. Components
- EmailSettings.tsx
- AdminLogin.tsx
- CustomModal.tsx
- devDependencies
- shared/api/credits.ts
- useT
- useOcrExtraction.ts
- OrderWorkspace.tsx
- DocumentPreview.tsx
- dependencies
- DetailTable.tsx
- api.ts
- PendingOrderBanner.tsx
- unwrapDetail
- FeatureFlows.tsx
- ProformaDocument.tsx
- NotificationBell.tsx
- useOcrWizard
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- useEmailSettings.ts
- CreditsPage.tsx
- QueueRow.tsx
- apiFetch
- ReviewQueue.tsx
- adminAuth.ts
- scripts
- useReviewDocument.ts
- MaintenanceGate.tsx
- useOcrSubmission.test.ts
- compilerOptions
- Dialog.tsx
- LanguageProvider
- NumericInput.tsx
- CLAUDE.md
- Contributing
- HeaderCard.tsx
- overview.ts
- contact.ts
- ManualScan.tsx
- TKey
- Carmen AI — OCR & Import System
- Skeleton.tsx
- APAmountSummary.tsx
- DataTable.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- getCarmenUrl
- flows.ts
- vercel.json
- Architecture
- useAPExtraction.test.ts
- OrderHistory.tsx
- Mapping.test.tsx
- ReviewDocument.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- AuthContext.tsx
- main.tsx
- pack.ts
- i18n/index.ts
- qr.ts
- chrome.ts
- usePdfPasswordPrompt
- adminUsers.ts
- @eslint/js
- vite-env.d.ts
- postcss
- mockPaths.test.ts
- client.ts
- @testing-library/dom
- typescript
- anomalies.ts
- EmailSettings.test.tsx
- errors.ts
- login.ts
- PeriodPicker.tsx
- eslint
- adminFetch
- cc.ts
- dict/apiKeys.ts
- TenantSelector.test.tsx
- ar.ts
- MaintenancePage.tsx
- dict/common.ts
- i18n/maintenance.ts
- i18n/quotas.ts
- home.ts
- @types/react-dom
- dict/modal.ts
- InputTaxReconciliation.tsx
- ApiKeysPage.test.tsx
- APInvoice.tsx
- vite
- useAPExtraction.ts
- plan.ts
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- i18n/usage.ts
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
- @types/react
- review.ts
- AppHeader.tsx
- jsdom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 258 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 65 edges
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
- `Props` --references--> `Vendor`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APVendorSearch.tsx → frontend/src/features/ap-invoice/hooks/useAPVendor.ts

## Import Cycles
- None detected.

## Communities (151 total, 47 thin omitted)

### Community 0 - "APLineItem"
Cohesion: 0.22
Nodes (13): Props, APGroupModal(), profileLabel(), Props, Props, APInvoiceHeader, useAPGrouping(), APValidationProps (+5 more)

### Community 1 - "ap-invoice/constants.ts"
Cohesion: 0.10
Nodes (29): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+21 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.05
Nodes (30): en, th, en, th, DICT, en, th, translate() (+22 more)

### Community 3 - "AccountingReview.tsx"
Cohesion: 0.12
Nodes (26): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, JvHeaderCard(), TopLevelConfigSection(), useGlMasters(), codeToSource(), descriptionForBank() (+18 more)

### Community 4 - "payment-mapping/types.ts"
Cohesion: 0.11
Nodes (36): AccountMappingTable(), GLAccount, Props, MainMappingTable(), MappingRow(), Props, BulkApplyBar(), Props (+28 more)

### Community 5 - "PmsReviewDocument.tsx"
Cohesion: 0.14
Nodes (19): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+11 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (25): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+17 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.08
Nodes (37): Props, billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+29 more)

### Community 9 - "showToast"
Cohesion: 0.14
Nodes (22): ApDraft, Args, useAPDraft(), APDraftState, mountRestored(), TAX_PROFILES, useAPVendor(), inputTaxOwed() (+14 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.20
Nodes (15): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+7 more)

### Community 11 - "orders.ts"
Cohesion: 0.11
Nodes (32): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+24 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.25
Nodes (8): AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig, EXPIRED_FLAG_KEY

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.15
Nodes (20): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+12 more)

### Community 14 - "AdminRouter.tsx"
Cohesion: 0.24
Nodes (11): AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS (+3 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "TopLevelConfigSection.tsx"
Cohesion: 0.14
Nodes (9): Props, CustomSearchSelect(), handleScroll(), panelStyle(), Props, SelectOption, OPTIONS, TopChoice (+1 more)

### Community 17 - "appKey"
Cohesion: 0.10
Nodes (28): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+20 more)

### Community 18 - "APVendorSearch.tsx"
Cohesion: 0.28
Nodes (7): Props, VendorSearch(), Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.16
Nodes (20): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow, FeedStatus, pmsEventsUrl() (+12 more)

### Community 20 - "banks.ts"
Cohesion: 0.12
Nodes (27): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField, codeToDisplayName() (+19 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "EmailSettings.tsx"
Cohesion: 0.14
Nodes (14): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+6 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.30
Nodes (8): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 25 - "CustomModal.tsx"
Cohesion: 0.21
Nodes (8): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint-plugin-react-hooks, globals, prettier, @testing-library/react (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (31): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PACK_META, CheckoutPhase, CheckoutSession (+23 more)

### Community 28 - "useT"
Cohesion: 0.08
Nodes (30): DateRangePicker(), DateRangePickerProps, LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps (+22 more)

### Community 29 - "useOcrExtraction.ts"
Cohesion: 0.17
Nodes (12): DetailRow, EXTRACTION_STAGES, HeaderData, extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData() (+4 more)

### Community 30 - "OrderWorkspace.tsx"
Cohesion: 0.07
Nodes (39): adjustCredits(), CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), AdminCreditOrder, fetchAdminOrderDocuments() (+31 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 34 - "api.ts"
Cohesion: 0.10
Nodes (32): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, Props, AddError, MappingItem, Undo, FeeInvoiceSource (+24 more)

### Community 35 - "PendingOrderBanner.tsx"
Cohesion: 0.24
Nodes (14): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode(), planChangeLoss() (+6 more)

### Community 36 - "unwrapDetail"
Cohesion: 0.41
Nodes (11): unwrapDetail(), toggleTenantModule(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword() (+3 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): ActivityPage, WhatsNew(), BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+34 more)

### Community 40 - "useOcrWizard"
Cohesion: 0.14
Nodes (20): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+12 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.20
Nodes (13): KPICard(), KPICardProps, MetricChart(), getTabs(), monthStartStr(), QuotaModulesPage(), quotaTier(), remainingDocs() (+5 more)

### Community 44 - "useEmailSettings.ts"
Cohesion: 0.15
Nodes (27): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRulePayload, EmailSettings (+19 more)

### Community 45 - "CreditsPage.tsx"
Cohesion: 0.13
Nodes (28): fetchTenants(), TenantSearch(), daysAgo(), endOfDay(), label(), Tenant, TenantSelector(), TenantSelectorProps (+20 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.22
Nodes (15): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+7 more)

### Community 47 - "apiFetch"
Cohesion: 0.12
Nodes (32): APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS (+24 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.09
Nodes (26): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getPending(), ItxOverrides, listActivity(), markChipSeen() (+18 more)

### Community 49 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "useReviewDocument.ts"
Cohesion: 0.13
Nodes (23): approveDocument(), rejectDocument(), BlockReason, BU_WIDE, JvEditor(), JvState, Overrides, Props (+15 more)

### Community 52 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (15): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+7 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "Dialog.tsx"
Cohesion: 0.29
Nodes (5): Dialog(), DialogProps, focusablesIn(), Options, useDialogFocus()

### Community 56 - "LanguageProvider"
Cohesion: 0.17
Nodes (6): PendingOrderBanner(), SLIP, SlipUpload(), SLIP, LanguageProvider(), readLang()

### Community 57 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "HeaderCard.tsx"
Cohesion: 0.40
Nodes (3): DATE_KEYS, HeaderCard(), Props

### Community 63 - "ManualScan.tsx"
Cohesion: 0.17
Nodes (9): BANK_LOGOS, BankDetectionBanner(), INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions(), Props (+1 more)

### Community 64 - "TKey"
Cohesion: 0.14
Nodes (15): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+7 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (14): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, COLS, Props (+6 more)

### Community 68 - "DataTable.tsx"
Cohesion: 0.10
Nodes (24): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+16 more)

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
Nodes (15): ExtractionFailureRow, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps, causeLabel(), classify() (+7 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "getCarmenUrl"
Cohesion: 0.24
Nodes (10): RowAction(), AppHeader(), AuthScreen(), COPY, Lang, Props, useIsMobile(), UserConsentModal() (+2 more)

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
Cohesion: 0.15
Nodes (13): MAP, OrderStatusBadge(), OPEN_STATUSES, OrderHistoryState, useOrderHistory(), ActivePlanBanner(), OrderHistory(), parseFocusId() (+5 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "ReviewDocument.tsx"
Cohesion: 0.19
Nodes (13): OcrExtractionHook, Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), Props, ExtractionWarning, FIX (+5 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.17
Nodes (14): PackList(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PackPresentation (+6 more)

### Community 88 - "AuthContext.tsx"
Cohesion: 0.14
Nodes (21): revokeSession(), clearToken(), storeToken(), getConsentStatus(), postConsent(), ConsentGate(), Props, AuthContext (+13 more)

### Community 89 - "main.tsx"
Cohesion: 0.10
Nodes (14): APInvoice, container, EmailSettings, getRoute(), Home, Mapping, OrderHistory, Pricing (+6 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.05
Nodes (26): en, th, en, th, en, th, en, th (+18 more)

### Community 94 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.15
Nodes (20): exchangeSSOToken(), getUsage(), UsageData, API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient() (+12 more)

### Community 109 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 115 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (26): Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+18 more)

### Community 119 - "adminFetch"
Cohesion: 0.13
Nodes (33): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, CreditBalance, fetchAlerts(), fetchJobs(), fetchSessions() (+25 more)

### Community 125 - "MaintenancePage.tsx"
Cohesion: 0.35
Nodes (10): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, fmtICT(), MaintenancePage() (+2 more)

### Community 137 - "InputTaxReconciliation.tsx"
Cohesion: 0.16
Nodes (18): Props, Props, DetailRow, Props, InputTaxReconciliation(), handleAddInputTax(), Props, Props (+10 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APInvoice.tsx"
Cohesion: 0.10
Nodes (15): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+7 more)

### Community 141 - "useAPExtraction.ts"
Cohesion: 0.09
Nodes (27): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args, imagesToPdf() (+19 more)

### Community 169 - "AppHeader.tsx"
Cohesion: 0.22
Nodes (6): Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode()

## Knowledge Gaps
- **666 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+661 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APLineItem`, `ap-invoice/constants.ts`, `AccountingReview.tsx`, `payment-mapping/types.ts`, `PmsReviewDocument.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `showToast`, `InputTaxReconciliation.tsx`, `orders.ts`, `APInvoice.tsx`, `useAPExtraction.ts`, `AdminRouter.tsx`, `EmailAutomationPage.tsx`, `TopLevelConfigSection.tsx`, `useMapping.ts`, `APVendorSearch.tsx`, `ApiKeysPage.tsx`, `banks.ts`, `useSettlementMapping.ts`, `AdminLogin.tsx`, `CustomModal.tsx`, `shared/api/credits.ts`, `OrderWorkspace.tsx`, `DocumentPreview.tsx`, `DetailTable.tsx`, `api.ts`, `PendingOrderBanner.tsx`, `unwrapDetail`, `FeatureFlows.tsx`, `ProformaDocument.tsx`, `NotificationBell.tsx`, `useOcrWizard`, `AppHeader.tsx`, `QuotaModulesPage.tsx`, `CreditsPage.tsx`, `QueueRow.tsx`, `apiFetch`, `ReviewQueue.tsx`, `useReviewDocument.ts`, `MaintenanceGate.tsx`, `LanguageProvider`, `HeaderCard.tsx`, `ManualScan.tsx`, `TKey`, `APAmountSummary.tsx`, `DataTable.tsx`, `ExtractionsPage.tsx`, `getCarmenUrl`, `OrderHistory.tsx`, `ReviewDocument.tsx`, `Pricing.tsx`, `i18n/index.ts`, `client.ts`, `PeriodPicker.tsx`, `adminFetch`, `MaintenancePage.tsx`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `PmsReviewDocument.tsx`, `parseNum`, `showToast`, `useMapping.ts`, `InputTaxReconciliation.tsx`, `useSettlementMapping.ts`, `useAPExtraction.ts`, `appKey`, `shared/api/credits.ts`, `useOcrExtraction.ts`, `api.ts`, `PendingOrderBanner.tsx`, `NotificationBell.tsx`, `useOcrWizard`, `QueueRow.tsx`, `ReviewQueue.tsx`, `useReviewDocument.ts`, `useOcrSubmission.test.ts`, `useAPExtraction.test.ts`, `OrderHistory.tsx`, `AuthContext.tsx`, `client.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `api.ts`, `PmsReviewDocument.tsx`, `parseNum`, `useOcrWizard`, `useMapping.ts`, `useAPExtraction.ts`, `apiFetch`, `appKey`, `useReviewDocument.ts`, `useOcrSubmission.test.ts`, `EmailSettings.tsx`, `AuthContext.tsx`, `useOcrExtraction.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _666 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ap-invoice/constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1039136302294197 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._
- **Should `AccountingReview.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._