# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 355 files · ~252,003 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1940 nodes · 5221 edges · 130 communities (97 shown, 33 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `23a8514f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- adminClient.ts
- APLineItemsTable.tsx
- dict/index.ts
- apiFetch
- DetailTable.tsx
- useT
- useAPInvoice.ts
- TutorialModal.tsx
- screens.tsx
- api.ts
- Home.tsx
- CreditOrdersPage.tsx
- ManualScan.tsx
- api/credits.ts
- appKey
- useOcrSubmission.test.ts
- ReviewDocument.tsx
- formatThb
- ProformaDocument.tsx
- useMapping.ts
- AccountMappingTable.tsx
- compilerOptions
- 5. Components
- banks.ts
- ExtractionsPage.tsx
- OrderHistory.tsx
- devDependencies
- useOcrExtraction.ts
- APInvoice.tsx
- APAmountSummary.tsx
- showToast
- OrderTable.tsx
- dependencies
- EmailAutomationPage.tsx
- ReviewQueue.tsx
- Mapping.tsx
- TenantSelector.test.tsx
- FeatureFlows.tsx
- storage.ts
- useNotifications.ts
- useAPExtraction.ts
- CheckoutFlow.tsx
- OrderWorkspace.tsx
- useFileUpload.ts
- date.ts
- useAuth
- TenantsPage.tsx
- NotificationBell.tsx
- usePdfPasswordPrompt
- client.ts
- scripts
- DocumentPreview.tsx
- APAccountMappingStep.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- LanguageContext.tsx
- auth.ts
- CLAUDE.md
- Contributing
- eslint
- MetricChartImpl.tsx
- main.tsx
- AdminLogin.tsx
- APLineItem
- Carmen AI — OCR & Import System
- useUserConsent.ts
- Pricing.tsx
- AdminAuthContext.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- MaintenanceGate.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- Skeleton.tsx
- ErrorBoundary
- vercel.json
- Architecture
- useOcrWizard.ts
- i18n/index.ts
- AuthContext.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APReviewStep.tsx
- TKey
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- NotificationBell.test.tsx
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- releaseNotes.ts
- mockPaths.test.ts
- useNotifications.test.ts
- Button.tsx
- adminUsers.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- eslint-plugin-react-hooks
- i18n/common.ts
- i18n/credits.ts
- extractions.ts
- performance.ts
- quotas.ts
- dict/common.ts
- contact.ts
- flows.ts
- dict/maintenance.ts
- dict/modal.ts
- dict/nav.ts
- notif.ts
- pack.ts
- quota.ts
- tutorial.ts
- dict/usage.ts
- whatsnew.ts
- @types/react-dom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `adminFetch` - 53 edges
3. `apiFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 33 edges
7. `TKey` - 30 edges
8. `useAPInvoice()` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `APLineItem` - 28 edges

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

## Communities (130 total, 33 thin omitted)

### Community 0 - "adminClient.ts"
Cohesion: 0.09
Nodes (51): Card(), CardProps, AdminUsersPage(), fmtICT(), MaintenancePage(), pad(), toLocalInput(), fmtCost() (+43 more)

### Community 1 - "APLineItemsTable.tsx"
Cohesion: 0.16
Nodes (17): Props, Ctrl, APTableFooter(), Props, APTableHeader(), Props, FixedTaxSettings, Props (+9 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.04
Nodes (31): en, th, en, th, en, th, en, th (+23 more)

### Community 3 - "apiFetch"
Cohesion: 0.12
Nodes (31): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+23 more)

### Community 4 - "DetailTable.tsx"
Cohesion: 0.16
Nodes (14): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), NumericInput(), NumericInputProps, BANKS (+6 more)

### Community 5 - "useT"
Cohesion: 0.09
Nodes (54): Column, DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir (+46 more)

### Community 6 - "useAPInvoice.ts"
Cohesion: 0.14
Nodes (29): AmountSummary(), APGroupModal(), profileLabel(), Props, getAvailableFields(), useAPInvoice(), adjustField(), DocRepair (+21 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, PurchaseTutorial (+23 more)

### Community 8 - "screens.tsx"
Cohesion: 0.13
Nodes (16): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+8 more)

### Community 9 - "api.ts"
Cohesion: 0.14
Nodes (14): SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse, ExtractedAPInvoiceData (+6 more)

### Community 10 - "Home.tsx"
Cohesion: 0.14
Nodes (12): ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here. (+4 more)

### Community 11 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (17): OrderKpiCards(), useOrderActions(), withName(), CreditOrdersPage(), MainTab, STAGE_QUERY, STAGES, AdminOrderStatus (+9 more)

### Community 12 - "ManualScan.tsx"
Cohesion: 0.11
Nodes (20): ItxOverrides, AccountingReview(), BANK_LOGOS, BankDetectionBanner(), Props, InputTaxPanel(), Props, InputTaxReconciliation() (+12 more)

### Community 13 - "api/credits.ts"
Cohesion: 0.21
Nodes (17): Props, CheckoutSession, EMPTY_BUYER, persist(), useCheckout, BillingDocument, BillingPeriod, BuyerInfo (+9 more)

### Community 14 - "appKey"
Cohesion: 0.12
Nodes (24): getAccountingConfig, seedOcrBranch(), useBankConfig(), getAccountingConfig, useMapping(), PaymentTypesHook, usePaymentTypes(), AccountingConfigHook (+16 more)

### Community 15 - "useOcrSubmission.test.ts"
Cohesion: 0.11
Nodes (20): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload (+12 more)

### Community 16 - "ReviewDocument.tsx"
Cohesion: 0.09
Nodes (35): getPending(), rejectDocument(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, BlockReason, BU_WIDE, JvEditor() (+27 more)

### Community 17 - "formatThb"
Cohesion: 0.15
Nodes (16): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+8 more)

### Community 18 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 19 - "useMapping.ts"
Cohesion: 0.21
Nodes (22): suggestMapping(), suggestPaymentTypes(), Props, Props, GlMasters, ActiveScan, COMPANY_REQUIRED_FIELDS, MainMappings (+14 more)

### Community 20 - "AccountMappingTable.tsx"
Cohesion: 0.23
Nodes (10): AccountMappingTable(), GLAccount, MainMappingTable(), PaymentTypeModal(), AISuggestBar(), Props, allowedAccountsForDept(), isAccountAllowed() (+2 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "banks.ts"
Cohesion: 0.11
Nodes (28): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BankConfigHook, codeToDisplayName(), codeToSource(), CompanyData (+20 more)

### Community 24 - "ExtractionsPage.tsx"
Cohesion: 0.08
Nodes (32): DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+24 more)

### Community 25 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (21): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+13 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @testing-library/jest-dom (+15 more)

### Community 27 - "useOcrExtraction.ts"
Cohesion: 0.10
Nodes (24): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionHook, OcrExtractionProps, extractFromFile, MOCK_EXTRACTED, MOCK_FILE (+16 more)

### Community 28 - "APInvoice.tsx"
Cohesion: 0.16
Nodes (15): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APUploadStep(), INSTRUCTIONS, Props (+7 more)

### Community 29 - "APAmountSummary.tsx"
Cohesion: 0.16
Nodes (11): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+3 more)

### Community 30 - "showToast"
Cohesion: 0.14
Nodes (21): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard() (+13 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.06
Nodes (37): ActionsAction, actionsInitial, actionsReducer(), ActionsState, REJECT_OTHER, REJECT_PRESETS, Props, BADGE_TABS (+29 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): cronTone(), EmailAutomationPage(), pollMessage(), REASON_CODES, reasonKey(), relativeAge(), STATUSES, statusTone() (+9 more)

### Community 34 - "ReviewQueue.tsx"
Cohesion: 0.06
Nodes (42): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+34 more)

### Community 35 - "Mapping.tsx"
Cohesion: 0.16
Nodes (8): BANK_OPTIONS, Props, TopLevelConfigSection(), Mapping(), CustomSearchSelect(), Props, SelectOption, TopChoice

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "storage.ts"
Cohesion: 0.20
Nodes (13): APSuccessStep(), VendorSearch(), RowAction(), AuthScreen(), fixLinkProps(), APP_STORAGE_BASES, clearAppStorage(), getCarmenUri() (+5 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.26
Nodes (11): WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), Notification, releaseRow(), useNotifications(), markReleaseSeen() (+3 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (25): DEFAULT_MAPPINGS, EMPTY_HEADER, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch (+17 more)

### Community 41 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (12): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), getPaymentInfo() (+4 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.13
Nodes (21): CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial, wsReducer() (+13 more)

### Community 43 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 44 - "date.ts"
Cohesion: 0.19
Nodes (14): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, DATE_KEYS, HeaderCard(), Props, handleAddInputTax(), DateInput() (+6 more)

### Community 45 - "useAuth"
Cohesion: 0.17
Nodes (11): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), A (+3 more)

### Community 46 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage(), fetchTenantDetail() (+2 more)

### Community 47 - "NotificationBell.tsx"
Cohesion: 0.23
Nodes (14): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+6 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 49 - "client.ts"
Cohesion: 0.15
Nodes (16): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), AuthScreenProps, AuthState (+8 more)

### Community 50 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 51 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 52 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 53 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.18
Nodes (17): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PRESET_DAYS, PresetId (+9 more)

### Community 56 - "LanguageContext.tsx"
Cohesion: 0.14
Nodes (14): MAP, OrderStatusBadge(), SLIP, Lang, translate(), Ctx, FALLBACK_CTX, LanguageCtx (+6 more)

### Community 57 - "auth.ts"
Cohesion: 0.23
Nodes (11): OrderHistory(), parseFocusId(), getUsage(), UsageData, getStoredToken(), T, base, Usage (+3 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 62 - "main.tsx"
Cohesion: 0.11
Nodes (22): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, registerDict() (+14 more)

### Community 63 - "AdminLogin.tsx"
Cohesion: 0.29
Nodes (8): AdminLogin(), classify(), LoginError, LoginErrorKind, mmss(), AdminLogin, adminLogin(), AdminLoginError

### Community 64 - "APLineItem"
Cohesion: 0.36
Nodes (9): Props, Props, Props, APInvoiceHeader, APDraftState, ApDraft, APSubmissionProps, APValidationProps (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 67 - "Pricing.tsx"
Cohesion: 0.16
Nodes (16): SALES_CONTACT, CheckoutPhase, clearPersistedCheckout(), loadPersistedCheckout(), readPersisted(), OPEN_STATUSES, useOrderHistory(), usePricingCatalog() (+8 more)

### Community 68 - "AdminAuthContext.tsx"
Cohesion: 0.33
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

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

### Community 77 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "useOcrWizard.ts"
Cohesion: 0.25
Nodes (11): mountRestored(), TAX_PROFILES, OcrDraftState, CcDraft, clearAllDrafts(), clearDraft(), DraftKind, Envelope (+3 more)

### Community 81 - "i18n/index.ts"
Cohesion: 0.04
Nodes (28): en, th, en, th, adminDict, AdminKey, en, th (+20 more)

### Community 82 - "AuthContext.tsx"
Cohesion: 0.36
Nodes (7): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APReviewStep.tsx"
Cohesion: 0.18
Nodes (12): APLineItemsTable(), APReviewStep(), HEADER_FIELDS(), Props, Props, APVendorProps, Vendor, Coords (+4 more)

### Community 88 - "TKey"
Cohesion: 0.18
Nodes (10): BatchAction, BatchActionBar(), Props, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection() (+2 more)

### Community 93 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 103 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 106 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 108 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+18 more)

## Knowledge Gaps
- **601 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+596 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `adminClient.ts`, `APLineItemsTable.tsx`, `DetailTable.tsx`, `useAPInvoice.ts`, `TutorialModal.tsx`, `screens.tsx`, `Home.tsx`, `CreditOrdersPage.tsx`, `ManualScan.tsx`, `ReviewDocument.tsx`, `formatThb`, `ProformaDocument.tsx`, `AccountMappingTable.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `useOcrExtraction.ts`, `APInvoice.tsx`, `APAmountSummary.tsx`, `showToast`, `OrderTable.tsx`, `EmailAutomationPage.tsx`, `ReviewQueue.tsx`, `Mapping.tsx`, `FeatureFlows.tsx`, `storage.ts`, `useNotifications.ts`, `useAPExtraction.ts`, `CheckoutFlow.tsx`, `OrderWorkspace.tsx`, `date.ts`, `useAuth`, `TenantsPage.tsx`, `NotificationBell.tsx`, `DocumentPreview.tsx`, `APAccountMappingStep.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `LanguageContext.tsx`, `auth.ts`, `MetricChartImpl.tsx`, `main.tsx`, `AdminLogin.tsx`, `APLineItem`, `Pricing.tsx`, `MaintenanceGate.tsx`, `APReviewStep.tsx`, `TKey`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useAPInvoice.ts`, `api.ts`, `ManualScan.tsx`, `api/credits.ts`, `appKey`, `useOcrSubmission.test.ts`, `ReviewDocument.tsx`, `formatThb`, `useMapping.ts`, `OrderHistory.tsx`, `useOcrExtraction.ts`, `ReviewQueue.tsx`, `useNotifications.ts`, `useAPExtraction.ts`, `CheckoutFlow.tsx`, `useFileUpload.ts`, `client.ts`, `useUserConsent.ts`, `Pricing.tsx`, `APReviewStep.tsx`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `PDFPageSelector()` connect `PDFPageSelector` to `APInvoice.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _601 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `adminClient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08831168831168831 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `apiFetch` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._