# Graph Report - OCR  (2026-09-23)

## Corpus Check
- 321 files · ~264,136 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1875 nodes · 5318 edges · 121 communities (98 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3c0febd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ocr.ts
- TutorialModal.tsx
- apiFetch
- useAPExtraction.ts
- NotificationBell.tsx
- MainMappingTable.tsx
- credits.ts
- FeatureFlows.tsx
- ExtractionsPage.tsx
- main.tsx
- APInvoice.tsx
- screens.tsx
- adminClient.ts
- QuotaModulesPage.tsx
- ReviewQueue.tsx
- AdminAuthContext.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- TKey
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- APReviewStep.tsx
- useEmailSettings.ts
- isAccountAllowed
- showToast
- useSettlementMapping.ts
- auth.ts
- APAmountSummary.tsx
- APGroupModal.tsx
- formatThb
- AdminLogin.tsx
- Skeleton.tsx
- useNotifications.ts
- useOcrWizard
- useFileUpload.ts
- useAPSubmission.test.ts
- dependencies
- EmailAutomationPage.tsx
- api.ts
- OrderWorkspace.tsx
- MaintenanceGate.tsx
- ReviewDocument.tsx
- SlipUpload.tsx
- DataTable.tsx
- useAPExtraction.test.ts
- FieldMapping
- useOcrExtraction.ts
- DocumentPreview.tsx
- useT
- date.ts
- OrderHistory.tsx
- client.ts
- OrderTable.tsx
- AuthContext.tsx
- CustomSearchSelect.tsx
- endpoints.ts
- Pricing.tsx
- scripts
- useMapping.ts
- MetricChartImpl.tsx
- useAPInvoice.ts
- useOcrExtraction.test.ts
- ManualScan.tsx
- compilerOptions
- LanguageContext.tsx
- useAPSubmission.ts
- ccJv.ts
- OrderActions.tsx
- CLAUDE.md
- Contributing
- useOcrExtraction
- eslint-plugin-react-hooks
- useUserConsent.ts
- PaymentTypeModal.test.tsx
- Tooltip.tsx
- AppHeader.tsx
- OrderTable.test.tsx
- PDFPageSelector
- TenantsPage.tsx
- Product
- @types/react-dom
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- getCarmenUrl
- vercel.json
- Architecture
- vite
- vite.config.ts
- useNotifications.test.ts
- @vitejs/plugin-react
- mapping.ts
- TenantSelector.test.tsx
- jsdom
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- @testing-library/react
- vitest
- vite-env.d.ts
- 03-combined-jv-three-debit-legs.md
- Carmen AI — OCR & Import System
- eslint
- 04-tin-second-factor.md
- @types/react
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md

## God Nodes (most connected - your core abstractions)
1. `useT()` - 241 edges
2. `apiFetch` - 59 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 41 edges
6. `TKey` - 35 edges
7. `appKey()` - 33 edges
8. `showToast()` - 29 edges
9. `FieldMapping` - 29 edges
10. `unwrapDetail()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/components/admin/BatchActionBar.tsx → frontend/src/i18n/dict.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/constants/apInvoice.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (121 total, 23 thin omitted)

### Community 0 - "ocr.ts"
Cohesion: 0.14
Nodes (17): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+9 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "apiFetch"
Cohesion: 0.21
Nodes (12): _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen(), apiFetch, patchAccountingConfig(), approveDocument(), getPending() (+4 more)

### Community 3 - "useAPExtraction.ts"
Cohesion: 0.18
Nodes (16): Props, Props, APInvoiceHeader, APDraftState, APExtractionProps, EXTRACTION_STAGES, NUMERIC_FIELDS, ApDraft (+8 more)

### Community 4 - "NotificationBell.tsx"
Cohesion: 0.13
Nodes (17): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+9 more)

### Community 5 - "MainMappingTable.tsx"
Cohesion: 0.23
Nodes (10): AISuggestBar(), Props, Badge(), BadgeVariant, Props, Props, ActiveScan, MainMappings (+2 more)

### Community 6 - "credits.ts"
Cohesion: 0.15
Nodes (13): SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), ActiveSubscription, createOrder(), CreditOrder, detail() (+5 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime(), causeLabel(), classify(), ERROR_RULES (+6 more)

### Community 9 - "main.tsx"
Cohesion: 0.10
Nodes (14): ErrorBoundary, Props, State, PageSkeleton(), APInvoice, container, EmailSettings, getRoute() (+6 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.10
Nodes (21): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+13 more)

### Community 11 - "screens.tsx"
Cohesion: 0.12
Nodes (18): DEFAULT_STEPS, Props, Step, StepWizard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO (+10 more)

### Community 12 - "adminClient.ts"
Cohesion: 0.07
Nodes (67): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, Props, OrderKpiCards(), Props (+59 more)

### Community 13 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (28): Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+20 more)

### Community 14 - "ReviewQueue.tsx"
Cohesion: 0.13
Nodes (19): ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getReviewStatus(), listActivity(), markChipSeen() (+11 more)

### Community 15 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (13): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, CONTROL_PANE_ROWS, detail() (+5 more)

### Community 19 - "TKey"
Cohesion: 0.17
Nodes (13): TKey, seen, useEntrance(), Home, NavItem, NavSection, ACTIVE_TAG, containerVariants (+5 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.11
Nodes (26): ExtractionWarningBanner(), Props, formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props (+18 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.15
Nodes (12): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+4 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.11
Nodes (28): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+20 more)

### Community 24 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (40): Button(), ButtonProps, Variant, VARIANT_CLASS, Draft, EmailSettingsController, EMPTY_DRAFT, EMPTY_RULE (+32 more)

### Community 25 - "isAccountAllowed"
Cohesion: 0.23
Nodes (12): AccountMappingTable(), GLAccount, Props, MappingRow(), MainMappingTable(), AccountLike, allowedAccountsForDept(), DeptLike (+4 more)

### Community 26 - "showToast"
Cohesion: 0.23
Nodes (9): APVendorProps, useAPVendor(), useFileUpload(), useOcrSubmission(), handleSubmitFinal(), useModal(), diffCorrections(), showToast() (+1 more)

### Community 27 - "useSettlementMapping.ts"
Cohesion: 0.14
Nodes (22): ARJvPreview(), money(), Props, Props, blankRows(), dedupe(), fingerprint(), firstToken() (+14 more)

### Community 28 - "auth.ts"
Cohesion: 0.28
Nodes (8): T, base, Usage, UsageIndicator(), getUsage(), UsageData, computeUsageStats(), UsageStats

### Community 29 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 30 - "APGroupModal.tsx"
Cohesion: 0.38
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 31 - "formatThb"
Cohesion: 0.16
Nodes (16): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, BillingFigure() (+8 more)

### Community 32 - "AdminLogin.tsx"
Cohesion: 0.19
Nodes (14): AdminProtectedRoute(), useAdminAuth(), adminLogin(), AdminLoginError, AdminRouter, AdminLogin(), classify(), LoginError (+6 more)

### Community 33 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 34 - "useNotifications.ts"
Cohesion: 0.15
Nodes (18): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy, releaseRow(), useNotifications(), ActivityPage (+10 more)

### Community 35 - "useOcrWizard"
Cohesion: 0.21
Nodes (15): getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange(), promptForPassword(), resetAll(), runEncryptedExtraction(), getPdfInfo() (+7 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.18
Nodes (8): FileUploadHook, handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 37 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 40 - "api.ts"
Cohesion: 0.07
Nodes (34): AccountingReview(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, RequiredField, BANK_OPTIONS, Props, TEMPLATE_TAGS (+26 more)

### Community 41 - "OrderWorkspace.tsx"
Cohesion: 0.12
Nodes (22): ContactBuyer(), num(), VerifyFacts(), WsAction, wsInitial, WsState, slipIsPdf(), SlipViewer() (+14 more)

### Community 42 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+2 more)

### Community 43 - "ReviewDocument.tsx"
Cohesion: 0.09
Nodes (31): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, SwapLabel(), DEFAULT_EMPTY_OBJECT, Props (+23 more)

### Community 44 - "SlipUpload.tsx"
Cohesion: 0.28
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 45 - "DataTable.tsx"
Cohesion: 0.09
Nodes (28): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, CompanyPanel() (+20 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.16
Nodes (13): _fetchExtract(), isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE (+5 more)

### Community 47 - "FieldMapping"
Cohesion: 0.29
Nodes (15): MappingRowVariant, Props, Props, SettlementModalSection, AccountingConfigHook, GlMasters, MasterAccount, MasterDepartment (+7 more)

### Community 48 - "useOcrExtraction.ts"
Cohesion: 0.18
Nodes (17): BANK_LOGOS, BANK_KEYWORDS, BANK_THAI_NAMES, BANKS, detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), EMPTY_DETAIL_ROW (+9 more)

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 50 - "useT"
Cohesion: 0.08
Nodes (62): Column, daysAgo(), endOfDay(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period (+54 more)

### Community 51 - "date.ts"
Cohesion: 0.33
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 52 - "OrderHistory.tsx"
Cohesion: 0.17
Nodes (19): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), catalogName(), isSubscriptionCode(), planChangeLoss() (+11 more)

### Community 53 - "client.ts"
Cohesion: 0.29
Nodes (8): CarmenSSOState, useCarmenSSO(), exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl()

### Community 54 - "OrderTable.tsx"
Cohesion: 0.13
Nodes (18): BatchAction, BatchActionBar(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf() (+10 more)

### Community 55 - "AuthContext.tsx"
Cohesion: 0.15
Nodes (17): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), clearToken() (+9 more)

### Community 56 - "CustomSearchSelect.tsx"
Cohesion: 0.33
Nodes (4): CustomSearchSelect(), Props, SelectOption, TopChoice

### Community 57 - "endpoints.ts"
Cohesion: 0.38
Nodes (5): API, Correction, FIELD_NAME_MAP, logCorrections(), mapFieldName()

### Community 58 - "Pricing.tsx"
Cohesion: 0.13
Nodes (27): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, SALES_CONTACT, CheckoutPhase, CheckoutSession (+19 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.14
Nodes (24): BANK_INFO, BANK_SOURCE_MAP, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), bankCodeFromHash() (+16 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 62 - "useAPInvoice.ts"
Cohesion: 0.15
Nodes (28): AmountSummary(), ARReviewPane(), labelOf(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields() (+20 more)

### Community 63 - "useOcrExtraction.test.ts"
Cohesion: 0.33
Nodes (5): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData()

### Community 64 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (15): FormActions(), Props, BankDetectionBanner(), AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+7 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.11
Nodes (20): APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props, UploadSection(), MAP, OrderStatusBadge() (+12 more)

### Community 67 - "useAPSubmission.ts"
Cohesion: 0.32
Nodes (12): GLAccount, useAPSubmission(), prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+4 more)

### Community 68 - "ccJv.ts"
Cohesion: 0.12
Nodes (21): OCR_BANK_MAP, CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+13 more)

### Community 69 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrExtraction"
Cohesion: 0.18
Nodes (11): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), reExtract(), closeModal(), showModal() (+3 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.25
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 77 - "AppHeader.tsx"
Cohesion: 0.16
Nodes (11): Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell, AdminLayout() (+3 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier() (+2 more)

### Community 81 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 83 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 84 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 85 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 86 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 87 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 88 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 89 - "getCarmenUrl"
Cohesion: 0.12
Nodes (21): AppHeader(), ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute() (+13 more)

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 96 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 98 - "mapping.ts"
Cohesion: 0.33
Nodes (5): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, SuggestPaymentTypesRequest, SuggestRequest

## Knowledge Gaps
- **527 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+522 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `TutorialModal.tsx`, `apiFetch`, `useAPExtraction.ts`, `NotificationBell.tsx`, `MainMappingTable.tsx`, `credits.ts`, `FeatureFlows.tsx`, `ExtractionsPage.tsx`, `APInvoice.tsx`, `screens.tsx`, `adminClient.ts`, `QuotaModulesPage.tsx`, `ReviewQueue.tsx`, `TKey`, `QueueRow.tsx`, `APReviewStep.tsx`, `isAccountAllowed`, `showToast`, `useSettlementMapping.ts`, `auth.ts`, `APAmountSummary.tsx`, `APGroupModal.tsx`, `formatThb`, `AdminLogin.tsx`, `useNotifications.ts`, `EmailAutomationPage.tsx`, `api.ts`, `OrderWorkspace.tsx`, `MaintenanceGate.tsx`, `ReviewDocument.tsx`, `SlipUpload.tsx`, `DataTable.tsx`, `useAPExtraction.test.ts`, `FieldMapping`, `useOcrExtraction.ts`, `DocumentPreview.tsx`, `OrderHistory.tsx`, `OrderTable.tsx`, `CustomSearchSelect.tsx`, `Pricing.tsx`, `useMapping.ts`, `MetricChartImpl.tsx`, `useAPInvoice.ts`, `ManualScan.tsx`, `LanguageContext.tsx`, `OrderActions.tsx`, `useOcrExtraction`, `PaymentTypeModal.test.tsx`, `AppHeader.tsx`, `TenantsPage.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `ocr.ts`, `useAPExtraction.ts`, `credits.ts`, `ReviewQueue.tsx`, `showToast`, `useSettlementMapping.ts`, `useNotifications.ts`, `useOcrWizard`, `useFileUpload.ts`, `useAPSubmission.test.ts`, `ReviewDocument.tsx`, `useAPExtraction.test.ts`, `OrderHistory.tsx`, `client.ts`, `endpoints.ts`, `Pricing.tsx`, `useMapping.ts`, `useAPInvoice.ts`, `useAPSubmission.ts`, `useUserConsent.ts`, `mapping.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `TKey` connect `TKey` to `LanguageContext.tsx`, `useAPExtraction.ts`, `NotificationBell.tsx`, `FeatureFlows.tsx`, `api.ts`, `EmailAutomationPage.tsx`, `APInvoice.tsx`, `ReviewQueue.tsx`, `useT`, `OrderHistory.tsx`, `QueueRow.tsx`, `OrderTable.tsx`, `APReviewStep.tsx`, `Pricing.tsx`, `useMapping.ts`, `useAPInvoice.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _527 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ocr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `NotificationBell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._