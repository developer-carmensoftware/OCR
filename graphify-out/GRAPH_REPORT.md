# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 374 files · ~254,231 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1968 nodes · 5374 edges · 153 communities (103 shown, 50 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62b1df25`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- QuotaModulesPage.tsx
- APLineItemsTable.tsx
- dict/index.ts
- unwrapDetail
- ManualScan.tsx
- SessionsPage.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- AppHeader.tsx
- orders.ts
- ReviewDocument.tsx
- CheckoutFlow.tsx
- useMapping.ts
- apiFetch
- ccJv.ts
- PlanCard.tsx
- ProformaDocument.tsx
- MainMappingTable.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- banks.ts
- APInvoice.tsx
- Pricing.tsx
- devDependencies
- storage.ts
- adminFetch
- useAPExtraction.ts
- showToast
- OrderActions.tsx
- dependencies
- ReviewQueue.tsx
- AccountingReview.tsx
- TopLevelConfigSection.tsx
- TenantSelector.test.tsx
- FeatureFlows.tsx
- AdminRouter.tsx
- NotificationBell.tsx
- useFileUpload.ts
- routes.tsx
- OrderWorkspace.tsx
- reviewReasons.ts
- InputTaxReconciliation.tsx
- ExtractionsPage.tsx
- TenantsPage.tsx
- ErrorBoundary
- ocr.ts
- ProtectedRoute.tsx
- scripts
- PendingOrderBanner.tsx
- APAccountMappingStep.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- shared/api/auth.ts
- CLAUDE.md
- Contributing
- eslint
- useT
- main.tsx
- AdminLogin.tsx
- APLineItem
- Carmen AI — OCR & Import System
- getCarmenUrl
- cc.ts
- MaintenanceGate.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction.test.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- Skeleton.tsx
- adminAuth.ts
- vercel.json
- Architecture
- useOcrWizard.ts
- i18n/index.ts
- dict/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Tooltip.tsx
- TKey
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- order.ts
- CreditsPage.tsx
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- MaintenancePage.tsx
- mockPaths.test.ts
- OrderTable.tsx
- DataTable.tsx
- adminUsers.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- eslint-plugin-react-hooks
- i18n/common.ts
- i18n/credits.ts
- extractions.ts
- orev.ts
- quotas.ts
- useUserConsent.ts
- contact.ts
- flows.ts
- pack.ts
- AuthContext.tsx
- pricing.ts
- notif.ts
- APAmountSummary.tsx
- qr.ts
- review.ts
- errors.ts
- whatsnew.ts
- slip.ts
- llmLogs.ts
- login.ts
- i18n/maintenance.ts
- i18n/nav.ts
- tutorial.ts
- sessions.ts
- dict/usage.ts
- i18n/tenants.ts
- i18n/usage.ts
- userUsage.ts
- dict/ap.ts
- checkout.ts
- home.ts
- plan.ts
- proforma.ts
- warn.ts
- @testing-library/jest-dom
- toast.ts
- useAuth
- APReviewStep.tsx
- SlipUpload.tsx
- NumericInput.tsx
- @types/react-dom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `adminFetch` - 63 edges
3. `apiFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 34 edges
7. `appKey()` - 33 edges
8. `TKey` - 32 edges
9. `APLineItem` - 30 edges
10. `showToast()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/AccountMappingTable.tsx → frontend/src/shared/types/ap.ts
- `SupportedLayouts()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/billing/components/FeatureFlows.tsx → frontend/src/i18n/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (153 total, 50 thin omitted)

### Community 0 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (17): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), Card(), CardProps, PageHeader(), PageHeaderProps (+9 more)

### Community 1 - "APLineItemsTable.tsx"
Cohesion: 0.15
Nodes (18): Props, Ctrl, APTableFooter(), Props, APTableHeader(), Props, APTableRow(), FixedTaxSettings (+10 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, DICT, en, th, translate(), en, th (+6 more)

### Community 3 - "unwrapDetail"
Cohesion: 0.18
Nodes (18): unwrapDetail(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword(), RoleOption (+10 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (20): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+12 more)

### Community 5 - "SessionsPage.tsx"
Cohesion: 0.20
Nodes (17): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), endOfDay(), useTableData(), Alert (+9 more)

### Community 6 - "parseNum"
Cohesion: 0.19
Nodes (23): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+15 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.08
Nodes (32): PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, PurchaseTutorial, Lang (+24 more)

### Community 8 - "screens.tsx"
Cohesion: 0.11
Nodes (19): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+11 more)

### Community 9 - "api.ts"
Cohesion: 0.12
Nodes (17): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigResponse, ApiError, APInvoiceItem, CodeOption (+9 more)

### Community 10 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (9): OrderReviewShell(), registerDict(), OrderReviewShell, Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow() (+1 more)

### Community 11 - "orders.ts"
Cohesion: 0.14
Nodes (25): AdminCreditOrder, AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+17 more)

### Community 12 - "ReviewDocument.tsx"
Cohesion: 0.15
Nodes (13): JvEditor(), rowId(), JvHeaderCard(), Props, useGlMasters(), Props, ReviewDocument(), CustomModal() (+5 more)

### Community 13 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (20): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, RowState, CheckoutPhase, CheckoutSession (+12 more)

### Community 14 - "useMapping.ts"
Cohesion: 0.38
Nodes (7): COMPANY_REQUIRED_FIELDS, useMapping(), useMappingSuggestions(), PaymentTypesHook, usePaymentTypes(), saveAccountingConfig(), mergeSuggestion()

### Community 15 - "apiFetch"
Cohesion: 0.06
Nodes (53): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+45 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.15
Nodes (17): AccountingReview(), codeToSource(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload() (+9 more)

### Community 17 - "PlanCard.tsx"
Cohesion: 0.13
Nodes (18): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+10 more)

### Community 18 - "ProformaDocument.tsx"
Cohesion: 0.25
Nodes (12): ActivePlanBanner(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds() (+4 more)

### Community 19 - "MainMappingTable.tsx"
Cohesion: 0.15
Nodes (27): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, PaymentTypeModal(), Props, GlMasters (+19 more)

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
Cohesion: 0.16
Nodes (20): BankConfigHook, useBankConfig(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape(), NormalizedConfig (+12 more)

### Community 24 - "APInvoice.tsx"
Cohesion: 0.13
Nodes (18): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props, APUploadStep(), INSTRUCTIONS (+10 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.13
Nodes (14): PendingOrderBanner(), SLIP, SALES_CONTACT, useOrderHistory(), OrderHistory(), parseFocusId(), cardVariants, ContactDialog() (+6 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "storage.ts"
Cohesion: 0.09
Nodes (30): getAccountingConfig, seedOcrBranch(), getAccountingConfig, AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+22 more)

### Community 28 - "adminFetch"
Cohesion: 0.19
Nodes (19): buildQs(), QueryParams, CreditBalance, CreditLedgerEntry, ModuleUsageRow, QuotaOverviewResponse, TenantSubscriptionSummary, TenantDetail (+11 more)

### Community 29 - "useAPExtraction.ts"
Cohesion: 0.18
Nodes (16): Args, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args (+8 more)

### Community 30 - "showToast"
Cohesion: 0.15
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), useOcrWizard() (+11 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "ReviewQueue.tsx"
Cohesion: 0.06
Nodes (40): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+32 more)

### Community 34 - "AccountingReview.tsx"
Cohesion: 0.17
Nodes (19): getPending(), ItxOverrides, rejectDocument(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, BlockReason (+11 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.18
Nodes (8): BANK_OPTIONS, Props, TopLevelConfigSection(), CustomSearchSelect(), Props, SelectOption, TopChoice, BANK_CODE_MAP

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "AdminRouter.tsx"
Cohesion: 0.27
Nodes (10): AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminRouter (+2 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.06
Nodes (44): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+36 more)

### Community 40 - "useFileUpload.ts"
Cohesion: 0.17
Nodes (9): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl() (+1 more)

### Community 41 - "routes.tsx"
Cohesion: 0.27
Nodes (10): fetchUsageSummary(), MetricChart(), fmtCost(), fmtNum(), Overview(), Overview, getCols(), monthStartStr() (+2 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (18): fetchCreditBalance(), fetchCreditLedger(), fetchAdminOrderDocuments(), getOrderSlipUrl(), KpiSummary, OrderKpiCards(), CompanyPanel(), ContactBuyer() (+10 more)

### Community 43 - "reviewReasons.ts"
Cohesion: 0.23
Nodes (10): OcrExtractionHook, ExtractResult, ExtractionWarningBanner(), Props, ExtractionWarning, FIX, REASON_KEY, SETTINGS (+2 more)

### Community 44 - "InputTaxReconciliation.tsx"
Cohesion: 0.23
Nodes (12): InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles(), DateInput(), DateInputProps, resolveTaxProfileForRate(), formatDateToDDMMYYYY() (+4 more)

### Community 45 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+6 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.26
Nodes (9): fetchTenantDetail(), fetchTenants(), KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel() (+1 more)

### Community 47 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): ApiError, ExtractedRow, PDF_PASSWORD_REQUIRED, PdfInfoResult, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload (+6 more)

### Community 49 - "ProtectedRoute.tsx"
Cohesion: 0.19
Nodes (12): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired() (+4 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "PendingOrderBanner.tsx"
Cohesion: 0.28
Nodes (12): OrderRow(), RowAction, rowInitial, rowReducer(), catalogName(), isSubscriptionCode(), planChangeLoss(), planChangeWarning() (+4 more)

### Community 52 - "APAccountMappingStep.tsx"
Cohesion: 0.12
Nodes (15): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+7 more)

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (26): Column, daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+18 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.15
Nodes (15): MAP, OrderStatusBadge(), OPEN_STATUSES, OrderHistoryState, cancelOrder(), createOrder(), CreateOrderResponse, CreditOrder (+7 more)

### Community 57 - "shared/api/auth.ts"
Cohesion: 0.28
Nodes (8): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "useT"
Cohesion: 0.07
Nodes (31): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+23 more)

### Community 62 - "main.tsx"
Cohesion: 0.20
Nodes (9): APInvoice, container, getRoute(), ManualScan, Mapping, OrderHistory, Pricing, Router() (+1 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.30
Nodes (8): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 64 - "APLineItem"
Cohesion: 0.28
Nodes (10): APGroupModal(), profileLabel(), Props, useAPGrouping(), APValidationProps, apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+2 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "getCarmenUrl"
Cohesion: 0.19
Nodes (12): VendorSearch(), RowAction(), AppHeader(), AuthScreen(), COPY, Lang, Props, useIsMobile() (+4 more)

### Community 68 - "MaintenanceGate.tsx"
Cohesion: 0.24
Nodes (12): createApiClient(), getStoredToken(), resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute() (+4 more)

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
Cohesion: 0.14
Nodes (14): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+6 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 77 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "useOcrWizard.ts"
Cohesion: 0.19
Nodes (15): ApDraft, useAPDraft(), APDraftState, mountRestored(), TAX_PROFILES, OcrDraftState, CcDraft, clearAllDrafts() (+7 more)

### Community 81 - "i18n/index.ts"
Cohesion: 0.09
Nodes (12): en, th, adminDict, AdminKey, en, th, en, th (+4 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 88 - "TKey"
Cohesion: 0.15
Nodes (14): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+6 more)

### Community 94 - "CreditsPage.tsx"
Cohesion: 0.29
Nodes (9): adjustCredits(), topupCredits(), label(), Tenant, TenantSelector(), TenantSelectorProps, CreditsPage(), getCols() (+1 more)

### Community 103 - "MaintenancePage.tsx"
Cohesion: 0.40
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.16
Nodes (13): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+5 more)

### Community 106 - "DataTable.tsx"
Cohesion: 0.10
Nodes (24): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+16 more)

### Community 108 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+18 more)

### Community 117 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 121 - "AuthContext.tsx"
Cohesion: 0.33
Nodes (8): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), setActiveTenant()

### Community 124 - "APAmountSummary.tsx"
Cohesion: 0.16
Nodes (14): Props, Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Props (+6 more)

### Community 147 - "toast.ts"
Cohesion: 0.25
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ToastType

### Community 148 - "useAuth"
Cohesion: 0.28
Nodes (6): ConsentGate(), Props, A, B, Probe(), useAuth()

### Community 149 - "APReviewStep.tsx"
Cohesion: 0.32
Nodes (6): APLineItemsTable(), APReviewStep(), HEADER_FIELDS(), Props, Card(), Props

### Community 150 - "SlipUpload.tsx"
Cohesion: 0.29
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 151 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

## Knowledge Gaps
- **598 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+593 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `QuotaModulesPage.tsx`, `APLineItemsTable.tsx`, `unwrapDetail`, `ManualScan.tsx`, `SessionsPage.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `AppHeader.tsx`, `orders.ts`, `ReviewDocument.tsx`, `CheckoutFlow.tsx`, `apiFetch`, `ccJv.ts`, `PlanCard.tsx`, `ProformaDocument.tsx`, `MainMappingTable.tsx`, `EmailAutomationPage.tsx`, `APReviewStep.tsx`, `SlipUpload.tsx`, `APInvoice.tsx`, `Pricing.tsx`, `useAPExtraction.ts`, `showToast`, `OrderActions.tsx`, `ReviewQueue.tsx`, `AccountingReview.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `AdminRouter.tsx`, `NotificationBell.tsx`, `routes.tsx`, `OrderWorkspace.tsx`, `reviewReasons.ts`, `InputTaxReconciliation.tsx`, `ExtractionsPage.tsx`, `TenantsPage.tsx`, `PendingOrderBanner.tsx`, `APAccountMappingStep.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `shared/api/auth.ts`, `AdminLogin.tsx`, `APLineItem`, `getCarmenUrl`, `MaintenanceGate.tsx`, `TKey`, `CreditsPage.tsx`, `MaintenancePage.tsx`, `OrderTable.tsx`, `DataTable.tsx`, `APAmountSummary.tsx`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `showToast` to `AccountingReview.tsx`, `ManualScan.tsx`, `useAPExtraction.test.ts`, `useFileUpload.ts`, `useOcrWizard.ts`, `ocr.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `API` connect `adminFetch` to `ReviewQueue.tsx`, `unwrapDetail`, `SessionsPage.tsx`, `MaintenancePage.tsx`, `NotificationBell.tsx`, `api.ts`, `orders.ts`, `emailAutomation.ts`, `adminAuth.ts`, `apiFetch`, `ocr.ts`, `EmailAutomationPage.tsx`, `useUserConsent.ts`, `shared/api/credits.ts`, `shared/api/auth.ts`, `storage.ts`, `useAPExtraction.ts`, `AdminLogin.tsx`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _598 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `QuotaModulesPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `ManualScan.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11724137931034483 - nodes in this community are weakly interconnected._