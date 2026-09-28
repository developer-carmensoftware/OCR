# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 375 files · ~254,368 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1969 nodes · 5380 edges · 149 communities (100 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3e02383c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- showToast
- APInvoice.tsx
- dict/index.ts
- adminFetch
- DetailTable.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- DarkModeToggle.tsx
- orders.ts
- CustomModal.tsx
- CheckoutFlow.tsx
- eslint-plugin-react-hooks
- useAPSubmission.ts
- ccJv.ts
- Pricing.tsx
- formatThb
- JvEditor.tsx
- EmailAutomationPage.tsx
- compilerOptions
- 5. Components
- bankTransforms.ts
- MainMappingTable.tsx
- PendingOrderBanner.test.tsx
- devDependencies
- useMapping.ts
- Overview.tsx
- useOcrSubmission.test.ts
- useOcrExtraction
- OrderActions.tsx
- dependencies
- QueueRow.tsx
- AccountingReview.tsx
- TopLevelConfigSection.tsx
- TenantSelector.test.tsx
- FeatureFlows.tsx
- useMappingData.ts
- NotificationBell.tsx
- useAPExtraction.ts
- MaintenancePage.tsx
- OrderWorkspace.tsx
- ReviewDocument.tsx
- useReviewDocument.ts
- ExtractionsPage.tsx
- TenantsPage.tsx
- ErrorBoundary
- usePdfPasswordPrompt
- APAccountMappingStep.tsx
- scripts
- PendingOrderBanner.tsx
- ManualScan.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- OrderHistory.tsx
- CLAUDE.md
- Contributing
- eslint
- DocumentPreview.tsx
- main.tsx
- AdminLogin.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageProvider
- NumericInput.tsx
- MaintenanceGate.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- SlipViewer.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- Skeleton.tsx
- adminAuth.ts
- vercel.json
- Architecture
- useOcrWizard
- i18n/index.ts
- Button.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Tooltip.tsx
- TKey
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- checkout.ts
- CreditsPage.tsx
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- APUploadStep.tsx
- mockPaths.test.ts
- OrderTable.tsx
- LLMLogsPage.tsx
- i18n/common.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- useT
- i18n/credits.ts
- ReviewDocument.test.tsx
- errors.ts
- orev.ts
- quotas.ts
- extractions.ts
- contact.ts
- flows.ts
- BankDetectionBanner.tsx
- AuthContext.tsx
- i18n/maintenance.ts
- DataTable.tsx
- performance.ts
- sessions.ts
- review.ts
- dict/ap.ts
- whatsnew.ts
- i18n/email.ts
- cc.ts
- dict/modal.ts
- typescript
- i18n/nav.ts
- dict/common.ts
- dict/maintenance.ts
- dict/usage.ts
- notif.ts
- i18n/usage.ts
- pack.ts
- pricing.ts
- qr.ts
- home.ts
- plan.ts
- quota.ts
- warn.ts
- @testing-library/jest-dom
- slip.ts
- tutorial.ts

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
- `Props` --references--> `AdminCreditOrder`  [EXTRACTED]
  frontend/src/features/admin/components/OrderTable.tsx → frontend/src/features/admin/api/orders.ts
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

## Communities (149 total, 49 thin omitted)

### Community 0 - "showToast"
Cohesion: 0.31
Nodes (10): ApDraft, useAPDraft(), clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+2 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.08
Nodes (37): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+29 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.16
Nodes (10): DICT, en, th, translate(), en, th, en, th (+2 more)

### Community 3 - "adminFetch"
Cohesion: 0.32
Nodes (14): unwrapDetail(), postArBatch(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword() (+6 more)

### Community 4 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.11
Nodes (22): ACTIVITY_FILTERS, ActivityFilter, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail, ReviewFlag (+14 more)

### Community 6 - "parseNum"
Cohesion: 0.15
Nodes (34): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+26 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, PurchaseTutorial, Spot() (+19 more)

### Community 8 - "screens.tsx"
Cohesion: 0.14
Nodes (15): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+7 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 10 - "DarkModeToggle.tsx"
Cohesion: 0.70
Nodes (3): DarkModeToggle(), isDarkNow(), useDarkMode()

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (19): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+11 more)

### Community 12 - "CustomModal.tsx"
Cohesion: 0.21
Nodes (8): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 13 - "CheckoutFlow.tsx"
Cohesion: 0.19
Nodes (13): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PACK_META, CheckoutSession, ActiveSubscription (+5 more)

### Community 15 - "useAPSubmission.ts"
Cohesion: 0.08
Nodes (34): Props, Props, VendorSearch(), APInvoiceHeader, Args, APExtractionProps, APSubmissionProps, GLAccount (+26 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.14
Nodes (17): codeToSource(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+9 more)

### Community 17 - "Pricing.tsx"
Cohesion: 0.17
Nodes (16): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+8 more)

### Community 18 - "formatThb"
Cohesion: 0.24
Nodes (13): num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), formatThb() (+5 more)

### Community 19 - "JvEditor.tsx"
Cohesion: 0.17
Nodes (19): AccountMappingTable(), GLAccount, Props, suggestPaymentTypes(), BlockReason, BU_WIDE, JvEditor(), rowId() (+11 more)

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
Cohesion: 0.16
Nodes (12): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, codeToDisplayName(), CompanyData, getBankInfo(), getGLSourceCode() (+4 more)

### Community 24 - "MainMappingTable.tsx"
Cohesion: 0.29
Nodes (15): Props, Props, ActiveScan, MainMappings, MasterAccount, MasterDepartment, MainMappingKey, MappingSuggestionsHook (+7 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "useMapping.ts"
Cohesion: 0.13
Nodes (28): getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), usePaymentTypes(), AccountingConfigHook (+20 more)

### Community 28 - "Overview.tsx"
Cohesion: 0.19
Nodes (17): buildQs(), QueryParams, fetchAlerts(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, TenantSubscriptionSummary (+9 more)

### Community 29 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (17): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), CarmenJvPayload, defaultConfig, defaultRows (+9 more)

### Community 30 - "useOcrExtraction"
Cohesion: 0.13
Nodes (11): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+3 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "QueueRow.tsx"
Cohesion: 0.29
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 34 - "AccountingReview.tsx"
Cohesion: 0.15
Nodes (13): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, DEFAULT_EMPTY_OBJECT, Badge() (+5 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.17
Nodes (10): BANK_OPTIONS, Props, TopLevelConfigSection(), BankConfigHook, NormalizedConfig, CustomSearchSelect(), Props, SelectOption (+2 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useMappingData.ts"
Cohesion: 0.30
Nodes (12): JvHeaderCard(), Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData() (+4 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.06
Nodes (51): ActivePlanBanner(), ActivityPage, WhatsNew(), BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList (+43 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.07
Nodes (41): APDraftState, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping, getPdfInfo (+33 more)

### Community 41 - "MaintenancePage.tsx"
Cohesion: 0.35
Nodes (10): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantRow, fmtICT(), MaintenancePage() (+2 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (19): fetchCreditBalance(), fetchCreditLedger(), AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), listCreditOrders(), OrderDrawer(), Props (+11 more)

### Community 43 - "ReviewDocument.tsx"
Cohesion: 0.19
Nodes (12): RowAction(), Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), Props, FIX, fixLinkProps() (+4 more)

### Community 44 - "useReviewDocument.ts"
Cohesion: 0.09
Nodes (35): approveDocument(), getPending(), ItxOverrides, rejectDocument(), Props, DetailRow, Props, Props (+27 more)

### Community 45 - "ExtractionsPage.tsx"
Cohesion: 0.10
Nodes (29): fetchQuotaOverview(), toggleTenantModule(), ExtractionFailureRow, fetchExtractionFailures(), Card(), CardProps, EmptyState(), EmptyStateProps (+21 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.23
Nodes (10): fetchTenantDetail(), fetchTenants(), Column, KPICard(), KPICardProps, funnel(), median(), quotaTier() (+2 more)

### Community 47 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.20
Nodes (10): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+2 more)

### Community 49 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "PendingOrderBanner.tsx"
Cohesion: 0.22
Nodes (15): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode(), planChangeLoss() (+7 more)

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
Nodes (28): fetchErrorBreakdown(), fetchTenantRanking(), daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period (+20 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (26): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+18 more)

### Community 57 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (16): MAP, OrderStatusBadge(), OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken() (+8 more)

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
Cohesion: 0.13
Nodes (19): AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, registerDict(), AdminRouter, APInvoice, container (+11 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 64 - "APLineItem"
Cohesion: 0.19
Nodes (12): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), mountRestored(), TAX_PROFILES, apGroupKey() (+4 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.22
Nodes (7): ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), readLang(), MAX_FILE_SIZE_MB

### Community 67 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 68 - "MaintenanceGate.tsx"
Cohesion: 0.26
Nodes (11): createApiClient(), resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate() (+3 more)

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

### Community 80 - "useOcrWizard"
Cohesion: 0.23
Nodes (16): useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword(), reExtract() (+8 more)

### Community 81 - "i18n/index.ts"
Cohesion: 0.06
Nodes (18): en, th, adminDict, AdminKey, en, th, en, th (+10 more)

### Community 82 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

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
Cohesion: 0.13
Nodes (17): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+9 more)

### Community 93 - "checkout.ts"
Cohesion: 0.27
Nodes (4): en, th, en, th

### Community 94 - "CreditsPage.tsx"
Cohesion: 0.42
Nodes (7): adjustCredits(), CreditBalance, CreditLedgerEntry, topupCredits(), CreditsPage(), getCols(), getPacks()

### Community 103 - "APUploadStep.tsx"
Cohesion: 0.50
Nodes (3): APUploadStep(), INSTRUCTIONS, Props

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.15
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 106 - "LLMLogsPage.tsx"
Cohesion: 0.14
Nodes (25): fetchJobs(), resolveAlert(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage(), endOfDay(), label(), Tenant (+17 more)

### Community 108 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+18 more)

### Community 111 - "useT"
Cohesion: 0.11
Nodes (22): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+14 more)

### Community 113 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 120 - "BankDetectionBanner.tsx"
Cohesion: 0.25
Nodes (5): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS

### Community 121 - "AuthContext.tsx"
Cohesion: 0.06
Nodes (49): exchangeSSOToken(), revokeSession(), CARMEN_RAW_TOKEN_KEY, clearToken(), storeToken(), getConsentStatus(), postConsent(), AppHeader() (+41 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.09
Nodes (25): fetchSessions(), revokeSession(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS (+17 more)

## Knowledge Gaps
- **596 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+591 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APInvoice.tsx`, `adminFetch`, `DetailTable.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `DarkModeToggle.tsx`, `orders.ts`, `CustomModal.tsx`, `CheckoutFlow.tsx`, `useAPSubmission.ts`, `Pricing.tsx`, `formatThb`, `JvEditor.tsx`, `EmailAutomationPage.tsx`, `bankTransforms.ts`, `MainMappingTable.tsx`, `PendingOrderBanner.test.tsx`, `Overview.tsx`, `OrderActions.tsx`, `QueueRow.tsx`, `AccountingReview.tsx`, `TopLevelConfigSection.tsx`, `FeatureFlows.tsx`, `useMappingData.ts`, `NotificationBell.tsx`, `useAPExtraction.ts`, `MaintenancePage.tsx`, `OrderWorkspace.tsx`, `ReviewDocument.tsx`, `useReviewDocument.ts`, `ExtractionsPage.tsx`, `TenantsPage.tsx`, `APAccountMappingStep.tsx`, `PendingOrderBanner.tsx`, `ManualScan.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `OrderHistory.tsx`, `DocumentPreview.tsx`, `main.tsx`, `AdminLogin.tsx`, `APLineItem`, `LanguageProvider`, `MaintenanceGate.tsx`, `SlipViewer.tsx`, `useOcrWizard`, `TKey`, `CreditsPage.tsx`, `APUploadStep.tsx`, `OrderTable.tsx`, `LLMLogsPage.tsx`, `BankDetectionBanner.tsx`, `AuthContext.tsx`, `DataTable.tsx`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `showToast`, `useAPExtraction.ts`, `usePdfPasswordPrompt`, `ManualScan.tsx`, `useMapping.ts`, `useOcrExtraction`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `API` connect `Overview.tsx` to `AuthContext.tsx`, `adminFetch`, `ReviewQueue.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `MaintenancePage.tsx`, `api.ts`, `orders.ts`, `emailAutomation.ts`, `adminAuth.ts`, `useAPSubmission.ts`, `EmailAutomationPage.tsx`, `shared/api/credits.ts`, `OrderHistory.tsx`, `useMapping.ts`, `useOcrSubmission.test.ts`, `CreditsPage.tsx`, `AdminLogin.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _596 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08326530612244898 - nodes in this community are weakly interconnected._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1103448275862069 - nodes in this community are weakly interconnected._
- **Should `parseNum` be split into smaller, more focused modules?**
  _Cohesion score 0.14589371980676327 - nodes in this community are weakly interconnected._