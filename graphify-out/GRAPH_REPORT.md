# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 374 files · ~254,561 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1973 nodes · 5382 edges · 142 communities (105 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bf2e77b4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- QuotaModulesPage.tsx
- APInvoice.tsx
- dict/index.ts
- adminFetch
- DetailTable.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- Home.tsx
- orders.ts
- CustomModal.tsx
- Pricing.tsx
- useMapping.ts
- useAPSubmission.ts
- ccJv.ts
- PlanCard.tsx
- formatThb
- PaymentTypeModal.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- bankTransforms.ts
- MainMappingTable.tsx
- LanguageProvider
- devDependencies
- storage.ts
- routes.tsx
- apiFetch
- useOcrExtraction
- OrderActions.tsx
- dependencies
- QueueRow.tsx
- AccountingReview.tsx
- TopLevelConfigSection.tsx
- TenantSelector.test.tsx
- FeatureFlows.tsx
- useMappingData.ts
- NotificationDetailModal.tsx
- useAPExtraction.ts
- useNotifications.ts
- OrderWorkspace.tsx
- ReviewDocument.tsx
- useReviewDocument.ts
- ExtractionsPage.tsx
- TenantsPage.tsx
- ErrorBoundary
- ocr.ts
- client.ts
- scripts
- OrderHistory.tsx
- ManualScan.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- shared/api/auth.ts
- CLAUDE.md
- Contributing
- eslint
- DocumentPreview.tsx
- main.tsx
- AdminLogin.tsx
- APLineItem
- Carmen AI — OCR & Import System
- useAuth
- NotificationBell.tsx
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
- showToast
- i18n/index.ts
- dict/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Tooltip.tsx
- LanguageContext.tsx
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- order.ts
- CreditsPage.tsx
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- OrderDrawer.tsx
- mockPaths.test.ts
- OrderTable.tsx
- useT
- adminUsers.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- MetricChartImpl.tsx
- emailReview.ts
- ReviewDocument.test.tsx
- EmailSettings.tsx
- orev.ts
- quotas.ts
- useUserConsent.ts
- contact.ts
- flows.ts
- BankDetectionBanner.tsx
- AuthContext.tsx
- releaseNotes.ts
- Pager.tsx
- useNotifications.test.ts
- ReviewQueue.test.tsx
- review.ts
- OrderTable.test.tsx
- whatsnew.ts
- i18n/email.ts
- overview.ts
- dict/modal.ts
- typescript
- i18n/nav.ts
- dict/usage.ts
- i18n/usage.ts
- home.ts
- plan.ts
- proforma.ts
- warn.ts
- @testing-library/jest-dom
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
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/AccountMappingTable.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (142 total, 37 thin omitted)

### Community 0 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (18): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), Card(), CardProps (+10 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (34): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+26 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.05
Nodes (30): en, th, en, th, en, th, en, th (+22 more)

### Community 3 - "adminFetch"
Cohesion: 0.19
Nodes (24): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), AdminUserRow, createAdminUser() (+16 more)

### Community 4 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.15
Nodes (14): ACTIVITY_FILTERS, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty() (+6 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (25): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+17 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, PurchaseTutorial, Spot() (+19 more)

### Community 8 - "screens.tsx"
Cohesion: 0.11
Nodes (19): PackList(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP (+11 more)

### Community 9 - "api.ts"
Cohesion: 0.12
Nodes (16): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest (+8 more)

### Community 10 - "Home.tsx"
Cohesion: 0.13
Nodes (14): AdminLayout(), getActiveHash(), NAV_SECTIONS, ACTIVE_TAG, containerVariants, Home(), itemVariants, MODULES (+6 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "CustomModal.tsx"
Cohesion: 0.16
Nodes (9): ACCEPTED, Props, SlipUpload(), SLIP, CustomModal(), ModalType, Props, baseProps (+1 more)

### Community 13 - "Pricing.tsx"
Cohesion: 0.11
Nodes (30): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, chipVariants, EASE_OUT, Glide (+22 more)

### Community 14 - "useMapping.ts"
Cohesion: 0.21
Nodes (11): CompanyInfoSection(), COMPANY_REQUIRED_FIELDS, useMapping(), useMappingSuggestions(), PaymentTypesHook, usePaymentTypes(), Mapping(), Mapping (+3 more)

### Community 15 - "useAPSubmission.ts"
Cohesion: 0.09
Nodes (30): Props, VendorSearch(), Args, APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine (+22 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.16
Nodes (15): codeToSource(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+7 more)

### Community 17 - "PlanCard.tsx"
Cohesion: 0.24
Nodes (8): EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PackPresentation, perDoc()

### Community 18 - "formatThb"
Cohesion: 0.25
Nodes (13): BillingFigure(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), formatThb() (+5 more)

### Community 19 - "PaymentTypeModal.tsx"
Cohesion: 0.20
Nodes (13): AccountMappingTable(), GLAccount, Props, MainMappingTable(), PaymentTypeModal(), AISuggestBar(), Props, AccountLike (+5 more)

### Community 20 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "bankTransforms.ts"
Cohesion: 0.20
Nodes (13): PLACEHOLDER_MAP, Props, RequiredField, BankConfigHook, useBankConfig(), codeToDisplayName(), CompanyData, getBankInfo() (+5 more)

### Community 24 - "MainMappingTable.tsx"
Cohesion: 0.33
Nodes (14): Props, Props, ActiveScan, MainMappings, MasterAccount, MasterDepartment, MainMappingKey, MappingSuggestionsHook (+6 more)

### Community 25 - "LanguageProvider"
Cohesion: 0.17
Nodes (7): MAP, OrderStatusBadge(), PendingOrderBanner(), SLIP, LanguageProvider(), readLang(), OrderStatus

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, eslint-plugin-react-hooks, devDependencies, autoprefixer, @eslint/js, eslint-plugin-react-hooks, globals (+15 more)

### Community 27 - "storage.ts"
Cohesion: 0.18
Nodes (16): getAccountingConfig, seedOcrBranch(), MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), DetailRow (+8 more)

### Community 28 - "routes.tsx"
Cohesion: 0.23
Nodes (13): buildQs(), QueryParams, fetchAlerts(), resolveAlert(), fetchUsageSummary(), fetchUsageTotals(), Alert, AnomaliesPage() (+5 more)

### Community 29 - "apiFetch"
Cohesion: 0.07
Nodes (38): approveDocument(), Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), getAccountingConfig, OcrExtractionProps (+30 more)

### Community 30 - "useOcrExtraction"
Cohesion: 0.15
Nodes (7): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), ExtractResult

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+4 more)

### Community 34 - "AccountingReview.tsx"
Cohesion: 0.09
Nodes (27): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, DEFAULT_EMPTY_OBJECT, Props, DetailRow (+19 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.17
Nodes (10): BANK_OPTIONS, Props, TopLevelConfigSection(), NormalizedConfig, CustomSearchSelect(), Props, SelectOption, TopChoice (+2 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useMappingData.ts"
Cohesion: 0.30
Nodes (12): JvHeaderCard(), Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData() (+4 more)

### Community 39 - "NotificationDetailModal.tsx"
Cohesion: 0.13
Nodes (14): ActivityPage, BellItem, Notification, NotificationList, Page, failedRow, items, markRead (+6 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (22): DEFAULT_MAPPINGS, EMPTY_HEADER, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args (+14 more)

### Community 41 - "useNotifications.ts"
Cohesion: 0.29
Nodes (10): WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), releaseRow(), useNotifications(), markReleaseSeen(), readReleaseSeen() (+2 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (11): fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+3 more)

### Community 43 - "ReviewDocument.tsx"
Cohesion: 0.19
Nodes (13): RowAction(), Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), Props, FIX, fixLinkProps() (+5 more)

### Community 44 - "useReviewDocument.ts"
Cohesion: 0.11
Nodes (30): getPending(), ItxOverrides, rejectDocument(), InputTaxPanel(), Props, InputTaxReconciliation(), OcrExtractionHook, useReviewDocument() (+22 more)

### Community 45 - "ExtractionsPage.tsx"
Cohesion: 0.13
Nodes (19): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, Tab, Tabs() (+11 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.18
Nodes (14): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, KPICard() (+6 more)

### Community 47 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 48 - "ocr.ts"
Cohesion: 0.14
Nodes (17): fetchTimeout(), ApiError, ExtractedRow, extractFromFile(), PDF_PASSWORD_REQUIRED, PdfInfoResult, toExtractedRows(), COPY (+9 more)

### Community 49 - "client.ts"
Cohesion: 0.14
Nodes (17): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), AuthScreen(), AuthScreenProps (+9 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.18
Nodes (17): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode(), planChangeLoss() (+9 more)

### Community 52 - "ManualScan.tsx"
Cohesion: 0.18
Nodes (9): DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions() (+1 more)

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.13
Nodes (30): fetchErrorBreakdown(), fetchTenantRanking(), Column, MetricChart(), daysAgo(), granularityFor(), lastDays(), matchPreset() (+22 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.14
Nodes (22): CheckoutPhase, EMPTY_BUYER, persist(), readPersisted(), useCheckout, OPEN_STATUSES, OrderHistoryState, useOrderHistory() (+14 more)

### Community 57 - "shared/api/auth.ts"
Cohesion: 0.23
Nodes (11): OrderHistory(), parseFocusId(), getUsage(), UsageData, getStoredToken(), T, base, Usage (+3 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "main.tsx"
Cohesion: 0.14
Nodes (17): AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, registerDict(), AdminRouter, APInvoice, container (+9 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 64 - "APLineItem"
Cohesion: 0.10
Nodes (25): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+17 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "useAuth"
Cohesion: 0.24
Nodes (9): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), Probe() (+1 more)

### Community 67 - "NotificationBell.tsx"
Cohesion: 0.28
Nodes (11): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), TFn (+3 more)

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

### Community 72 - "useAPExtraction.test.ts"
Cohesion: 0.17
Nodes (10): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+2 more)

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
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 77 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "showToast"
Cohesion: 0.11
Nodes (32): useAPDraft(), mountRestored(), TAX_PROFILES, OcrDraftState, applyExtractedData(), processFile(), reExtract(), showDuplicateModal() (+24 more)

### Community 81 - "i18n/index.ts"
Cohesion: 0.04
Nodes (28): en, th, en, th, en, th, en, th (+20 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 88 - "LanguageContext.tsx"
Cohesion: 0.13
Nodes (16): BatchAction, BatchActionBar(), Props, NavItem, NavSection, APUploadStep(), INSTRUCTIONS, Props (+8 more)

### Community 94 - "CreditsPage.tsx"
Cohesion: 0.35
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), topupCredits(), CompanyPanel(), CreditsPage() (+2 more)

### Community 103 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock()

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 106 - "useT"
Cohesion: 0.09
Nodes (42): fetchJobs(), fetchSessions(), revokeSession(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage(), DataTable(), DataTableProps (+34 more)

### Community 108 - "emailAutomation.ts"
Cohesion: 0.20
Nodes (20): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRulePayload, EmailSettings, getBankCodes() (+12 more)

### Community 111 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 112 - "emailReview.ts"
Cohesion: 0.35
Nodes (9): ActivityFilter, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail, ReviewFlag, ReviewQueueController (+1 more)

### Community 113 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 114 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE, EmailSettings

### Community 117 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 120 - "BankDetectionBanner.tsx"
Cohesion: 0.25
Nodes (5): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS

### Community 121 - "AuthContext.tsx"
Cohesion: 0.20
Nodes (13): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+5 more)

### Community 122 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 124 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

## Knowledge Gaps
- **603 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+598 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `QuotaModulesPage.tsx`, `APInvoice.tsx`, `adminFetch`, `DetailTable.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `Home.tsx`, `orders.ts`, `CustomModal.tsx`, `Pricing.tsx`, `useMapping.ts`, `useAPSubmission.ts`, `PlanCard.tsx`, `formatThb`, `PaymentTypeModal.tsx`, `EmailAutomationPage.tsx`, `LanguageProvider`, `routes.tsx`, `OrderActions.tsx`, `QueueRow.tsx`, `AccountingReview.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `useMappingData.ts`, `NotificationDetailModal.tsx`, `useAPExtraction.ts`, `useNotifications.ts`, `OrderWorkspace.tsx`, `ReviewDocument.tsx`, `useReviewDocument.ts`, `ExtractionsPage.tsx`, `TenantsPage.tsx`, `OrderHistory.tsx`, `ManualScan.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `shared/api/auth.ts`, `DocumentPreview.tsx`, `main.tsx`, `AdminLogin.tsx`, `APLineItem`, `useAuth`, `NotificationBell.tsx`, `MaintenanceGate.tsx`, `showToast`, `LanguageContext.tsx`, `CreditsPage.tsx`, `OrderDrawer.tsx`, `OrderTable.tsx`, `MetricChartImpl.tsx`, `BankDetectionBanner.tsx`, `Pager.tsx`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Why does `ErrorBoundary` connect `ErrorBoundary` to `main.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `BankDetectionBanner()` connect `BankDetectionBanner.tsx` to `useT`, `ManualScan.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _603 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `QuotaModulesPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09371980676328502 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._