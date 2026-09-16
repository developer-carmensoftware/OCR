# Graph Report - OCR  (2026-09-16)

## Corpus Check
- 316 files · ~258,969 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1858 nodes · 5293 edges · 108 communities (94 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `15384ee0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CreditOrdersPage.tsx
- TutorialModal.tsx
- ccJv.ts
- useNotifications.ts
- useOcrExtraction
- CompanyInfoSection.tsx
- DataTable.tsx
- FeatureFlows.tsx
- useAPInvoice.ts
- main.tsx
- APInvoice.tsx
- screens.tsx
- APGroupModal.tsx
- QuotaModulesPage.tsx
- ReviewQueue.tsx
- Pager.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ReviewDocument.tsx
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- APLineItemsTable.tsx
- client.ts
- draft.ts
- ArCustomerProfiles.tsx
- ARReconcileSettings.tsx
- OrderHistory.tsx
- routes.tsx
- APReviewStep.tsx
- Pricing.tsx
- useAccountingConfig.ts
- InputTaxReconciliation.tsx
- NotificationBell.tsx
- usePdfPasswordPrompt
- useAPExtraction.ts
- useAPSubmission.test.ts
- dependencies
- adminClient.ts
- apiFetch
- PendingOrderBanner.tsx
- useNotifications.test.ts
- isAccountAllowed
- CheckoutFlow.tsx
- useT
- useAPExtraction.test.ts
- MainMappingTable.tsx
- useOcrWizard.ts
- DocumentPreview.tsx
- ExtractionsPage.tsx
- TKey
- PendingOrderBanner.test.tsx
- jsdom
- TenantSelector.test.tsx
- AuthContext.tsx
- APAmountSummary.tsx
- banks.ts
- credits.ts
- scripts
- useMapping.ts
- MetricChartImpl.tsx
- APLineItem
- ManualScan.tsx
- compilerOptions
- LanguageContext.tsx
- useAPSubmission.ts
- date.ts
- OrderTable.tsx
- CLAUDE.md
- Contributing
- showToast
- useUserConsent.ts
- PaymentTypeModal.test.tsx
- Tooltip.tsx
- AppHeader.tsx
- useAuth
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
- @vitejs/plugin-react
- @testing-library/jest-dom
- @testing-library/react
- vitest
- vite-env.d.ts
- Carmen AI — OCR & Import System
- eslint
- @types/react
- eslint-plugin-react-hooks

## God Nodes (most connected - your core abstractions)
1. `useT()` - 235 edges
2. `apiFetch` - 59 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 41 edges
6. `appKey()` - 33 edges
7. `TKey` - 30 edges
8. `showToast()` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/constants/apInvoice.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/APGroupModal.tsx → frontend/src/types/ap.ts
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts

## Import Cycles
- None detected.

## Communities (108 total, 14 thin omitted)

### Community 0 - "CreditOrdersPage.tsx"
Cohesion: 0.18
Nodes (16): OrderKpiCards(), useOrderActions(), withName(), AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch() (+8 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.10
Nodes (26): AccountingReview(), OCR_BANK_MAP, codeToDisplayName(), codeToSource(), descriptionForBank(), getBankInfo(), getGLSourceCode(), isApiShape() (+18 more)

### Community 3 - "useNotifications.ts"
Cohesion: 0.18
Nodes (15): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy, releaseRow(), useNotifications(), listNotifications() (+7 more)

### Community 4 - "useOcrExtraction"
Cohesion: 0.15
Nodes (7): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), ExtractResult

### Community 5 - "CompanyInfoSection.tsx"
Cohesion: 0.38
Nodes (6): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BankConfigHook, CompanyData

### Community 6 - "DataTable.tsx"
Cohesion: 0.08
Nodes (51): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, daysAgo() (+43 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.14
Nodes (29): AmountSummary(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields(), useAPInvoice(), adjustField() (+21 more)

### Community 9 - "main.tsx"
Cohesion: 0.06
Nodes (41): AdminProtectedRoute(), ErrorBoundary, Props, State, PageSkeleton(), AdminAuthContext, AdminAuthContextValue, AdminAuthProvider() (+33 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.15
Nodes (16): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APTableRow(), AP_STEPS, APFieldKey (+8 more)

### Community 11 - "screens.tsx"
Cohesion: 0.13
Nodes (16): DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP, noop() (+8 more)

### Community 12 - "APGroupModal.tsx"
Cohesion: 0.38
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 13 - "QuotaModulesPage.tsx"
Cohesion: 0.17
Nodes (15): PageHeader(), PageHeaderProps, Tab, Tabs(), TabsProps, fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow (+7 more)

### Community 14 - "ReviewQueue.tsx"
Cohesion: 0.11
Nodes (23): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getReviewStatus(), listActivity() (+15 more)

### Community 15 - "Pager.tsx"
Cohesion: 0.18
Nodes (7): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Props, SIZE_OPTIONS, ROWS_PER_PAGE

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (12): AR_CONTROL, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, detail(), EXTRACTED (+4 more)

### Community 19 - "ReviewDocument.tsx"
Cohesion: 0.08
Nodes (33): ARReviewPane(), labelOf(), Props, SwapLabel(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props (+25 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.31
Nodes (11): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+3 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.11
Nodes (20): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+12 more)

### Community 23 - "APLineItemsTable.tsx"
Cohesion: 0.20
Nodes (12): APLineItemsTable(), Props, APTableFooter(), Props, APTableHeader(), Props, FixedTaxSettings, Props (+4 more)

### Community 24 - "client.ts"
Cohesion: 0.07
Nodes (49): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+41 more)

### Community 25 - "draft.ts"
Cohesion: 0.50
Nodes (6): clearDraft(), DraftKind, Envelope, keyFor(), loadDraft(), saveDraft()

### Community 26 - "ArCustomerProfiles.tsx"
Cohesion: 0.33
Nodes (8): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles()

### Community 27 - "ARReconcileSettings.tsx"
Cohesion: 0.09
Nodes (33): Button(), ButtonProps, Variant, VARIANT_CLASS, Card(), CardProps, Switch(), SwitchProps (+25 more)

### Community 28 - "OrderHistory.tsx"
Cohesion: 0.18
Nodes (14): T, base, Usage, UsageIndicator(), useOrderHistory(), getUsage(), UsageData, getStoredToken() (+6 more)

### Community 29 - "routes.tsx"
Cohesion: 0.12
Nodes (29): MetricChart(), granularityFor(), lastDays(), periodHours(), PeriodPicker(), label(), Tenant, TenantSelector() (+21 more)

### Community 30 - "APReviewStep.tsx"
Cohesion: 0.16
Nodes (17): APReviewStep(), Ctrl, HEADER_FIELDS(), Props, Props, VendorSearch(), ExtractionWarningBanner(), Props (+9 more)

### Community 31 - "Pricing.tsx"
Cohesion: 0.14
Nodes (22): AppHeader(), PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS (+14 more)

### Community 32 - "useAccountingConfig.ts"
Cohesion: 0.40
Nodes (5): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), AccountingConfig

### Community 33 - "InputTaxReconciliation.tsx"
Cohesion: 0.13
Nodes (13): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, ExtractionSkeleton(), Props, Skeleton() (+5 more)

### Community 34 - "NotificationBell.tsx"
Cohesion: 0.11
Nodes (20): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+12 more)

### Community 35 - "usePdfPasswordPrompt"
Cohesion: 0.48
Nodes (6): setup(), usePdfPasswordPrompt(), open(), prompt(), render(), submit()

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (23): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload() (+15 more)

### Community 37 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.08
Nodes (56): EmptyState(), EmptyStateProps, adminFetch, AdminUserRow, createAdminUser(), CreditBalance, EmailBusinessUnitRow, EmailCronJob (+48 more)

### Community 40 - "apiFetch"
Cohesion: 0.09
Nodes (27): apiFetch, APVendorMapping, APVendorMappingResponse, ConfigPatch, getAPVendorMapping(), patchAccountingConfig(), saveAccountingConfig(), saveAPVendorMapping() (+19 more)

### Community 41 - "PendingOrderBanner.tsx"
Cohesion: 0.16
Nodes (22): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, expiryDate(), num(), ProformaDocument() (+14 more)

### Community 42 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 43 - "isAccountAllowed"
Cohesion: 0.16
Nodes (13): AccountMappingTable(), GLAccount, Props, CustomSearchSelect(), Props, SelectOption, TopChoice, MappingRow() (+5 more)

### Community 44 - "CheckoutFlow.tsx"
Cohesion: 0.14
Nodes (15): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+7 more)

### Community 45 - "useT"
Cohesion: 0.12
Nodes (28): OrderActions(), CompanyPanel(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+20 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.29
Nodes (16): AISuggestBar(), Props, MappingRowVariant, Props, Props, Props, ActiveScan, MainMappings (+8 more)

### Community 48 - "useOcrWizard.ts"
Cohesion: 0.18
Nodes (12): OcrDraftState, CcDraft, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, ApiError, ExtractedRow (+4 more)

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 50 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), fmtDateTime(), causeLabel(), classify(), ERROR_RULES (+6 more)

### Community 51 - "TKey"
Cohesion: 0.14
Nodes (15): BatchAction, BatchActionBar(), Props, TKey, seen, useEntrance(), NavItem, NavSection (+7 more)

### Community 52 - "PendingOrderBanner.test.tsx"
Cohesion: 0.29
Nodes (3): PendingOrderBanner(), SLIP, ActiveSubscription

### Community 55 - "AuthContext.tsx"
Cohesion: 0.15
Nodes (17): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), clearToken() (+9 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.13
Nodes (14): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+6 more)

### Community 57 - "banks.ts"
Cohesion: 0.18
Nodes (13): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO, BANK_KEYWORDS, BankEntry, BankInfo, BANKS (+5 more)

### Community 58 - "credits.ts"
Cohesion: 0.13
Nodes (26): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+18 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.13
Nodes (23): BANK_SOURCE_MAP, getAccountingConfig, DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, persistScanForMapping(), getAccountingConfig (+15 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 63 - "APLineItem"
Cohesion: 0.15
Nodes (16): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+8 more)

### Community 64 - "ManualScan.tsx"
Cohesion: 0.11
Nodes (20): FormActions(), Props, BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount() (+12 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (21): APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props, UploadSection(), MAP, OrderStatusBadge() (+13 more)

### Community 67 - "useAPSubmission.ts"
Cohesion: 0.23
Nodes (16): GLAccount, useAPSubmission(), GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes() (+8 more)

### Community 68 - "date.ts"
Cohesion: 0.30
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 69 - "OrderTable.tsx"
Cohesion: 0.08
Nodes (31): ActionsAction, actionsInitial, actionsReducer(), ActionsState, REJECT_OTHER, REJECT_PRESETS, Props, BADGE_TABS (+23 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "showToast"
Cohesion: 0.19
Nodes (20): applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange() (+12 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 77 - "AppHeader.tsx"
Cohesion: 0.21
Nodes (7): Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode(), OrderReviewShell

### Community 78 - "useAuth"
Cohesion: 0.16
Nodes (15): ConsentGate(), Props, AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired() (+7 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "TenantsPage.tsx"
Cohesion: 0.20
Nodes (11): Column, KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median() (+3 more)

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
Cohesion: 0.27
Nodes (9): AuthScreen(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), RowAction(), fixLinkProps() (+1 more)

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

## Knowledge Gaps
- **516 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+511 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `CreditOrdersPage.tsx`, `TutorialModal.tsx`, `ccJv.ts`, `useNotifications.ts`, `DataTable.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `main.tsx`, `APInvoice.tsx`, `screens.tsx`, `APGroupModal.tsx`, `QuotaModulesPage.tsx`, `ReviewQueue.tsx`, `Pager.tsx`, `ReviewDocument.tsx`, `QueueRow.tsx`, `APLineItemsTable.tsx`, `client.ts`, `ArCustomerProfiles.tsx`, `ARReconcileSettings.tsx`, `OrderHistory.tsx`, `routes.tsx`, `APReviewStep.tsx`, `Pricing.tsx`, `InputTaxReconciliation.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `adminClient.ts`, `PendingOrderBanner.tsx`, `isAccountAllowed`, `CheckoutFlow.tsx`, `MainMappingTable.tsx`, `DocumentPreview.tsx`, `ExtractionsPage.tsx`, `TKey`, `PendingOrderBanner.test.tsx`, `APAmountSummary.tsx`, `credits.ts`, `useMapping.ts`, `MetricChartImpl.tsx`, `APLineItem`, `ManualScan.tsx`, `LanguageContext.tsx`, `OrderTable.tsx`, `showToast`, `AppHeader.tsx`, `TenantsPage.tsx`, `getCarmenUrl`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useNotifications.ts`, `useAPInvoice.ts`, `ReviewQueue.tsx`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `client.ts`, `ARReconcileSettings.tsx`, `OrderHistory.tsx`, `APReviewStep.tsx`, `Pricing.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `useAPSubmission.test.ts`, `PendingOrderBanner.tsx`, `useAPExtraction.test.ts`, `useOcrWizard.ts`, `credits.ts`, `useMapping.ts`, `useAPSubmission.ts`, `useUserConsent.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useAPSubmission.ts`, `useAPExtraction.ts`, `useAPSubmission.test.ts`, `useOcrExtraction`, `useAPInvoice.ts`, `apiFetch`, `ReviewQueue.tsx`, `useOcrWizard.ts`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `AuthContext.tsx`, `client.ts`, `useMapping.ts`, `APReviewStep.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _516 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10338680926916222 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08158508158508158 - nodes in this community are weakly interconnected._