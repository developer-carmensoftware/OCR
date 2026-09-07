# Graph Report - OCR  (2026-09-07)

## Corpus Check
- 297 files · ~237,086 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1751 nodes · 4929 edges · 101 communities (89 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a85e6398`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- emailReview.ts
- CustomModal.tsx
- AccountingReview.tsx
- NotificationBell.tsx
- OrderActions.tsx
- appKey
- CreditsPage.tsx
- FeatureFlows.tsx
- useAPValidation.ts
- fmt
- APInvoice.tsx
- PlanCard.tsx
- date.ts
- useOcrWizard
- banks.ts
- APAmountSummary.tsx
- compilerOptions
- 5. Components
- main.tsx
- APTableRow.tsx
- devDependencies
- QueueRow.tsx
- getCarmenUrl
- APReviewStep.tsx
- emailAutomation.ts
- useT
- CheckoutFlow.tsx
- QueueSettings.tsx
- adminClient.ts
- EmailAutomationPage.tsx
- ReviewQueue.tsx
- ManualScan.tsx
- TenantsPage.tsx
- Pricing.tsx
- ExtractionsPage.tsx
- Tooltip.tsx
- useAPExtraction.ts
- apiFetch
- dependencies
- Button.tsx
- api.ts
- OrderWorkspace.tsx
- useAPInvoice.ts
- client.ts
- useAPExtraction.test.ts
- MainMappingTable.tsx
- ocr.ts
- DataTable.tsx
- ReviewDocument.test.tsx
- credits.ts
- OrderTable.tsx
- PendingOrderBanner.tsx
- Pager.tsx
- Skeleton.tsx
- config.ts
- LanguageContext.tsx
- scripts
- JvEditor.tsx
- DocumentPreview.tsx
- AdminCreditOrder
- parseNum
- ReviewDocument.tsx
- compilerOptions
- TKey
- dict.ts
- eslint
- CLAUDE.md
- Contributing
- APAccountMappingStep.tsx
- useMapping.ts
- AdminAuthContext.tsx
- InputTaxReconciliation.tsx
- PDFPageSelector
- Product
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- typescript
- vercel.json
- Architecture
- vite.config.ts
- eslint-plugin-react-hooks
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- AccountMappingTable.tsx

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `apiFetch` - 55 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 31 edges
7. `showToast()` - 31 edges
8. `TKey` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/constants/apInvoice.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts

## Import Cycles
- None detected.

## Communities (101 total, 12 thin omitted)

### Community 0 - "emailReview.ts"
Cohesion: 0.18
Nodes (17): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, getPending() (+9 more)

### Community 1 - "CustomModal.tsx"
Cohesion: 0.07
Nodes (33): OrderDrawer(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, PURCHASE_FIGURES, FOCUS_STEPS (+25 more)

### Community 2 - "AccountingReview.tsx"
Cohesion: 0.13
Nodes (22): AccountingReview(), DEFAULT_EMPTY_OBJECT, OCR_BANK_MAP, codeToDisplayName(), codeToSource(), descriptionForBank(), getBankInfo(), getGLSourceCode() (+14 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (40): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+32 more)

### Community 4 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 5 - "appKey"
Cohesion: 0.14
Nodes (21): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+13 more)

### Community 6 - "CreditsPage.tsx"
Cohesion: 0.16
Nodes (15): CompanyPanel(), label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS, adjustCredits() (+7 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPValidation.ts"
Cohesion: 0.24
Nodes (10): getAvailableFields(), adjustField(), DocRepair, reconcileRows(), EMPTY_HEADER, header(), masterReconcile(), runAdjust() (+2 more)

### Community 9 - "fmt"
Cohesion: 0.21
Nodes (13): AmountSummary(), AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), Amount(), DETAIL_COLUMNS (+5 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.19
Nodes (12): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, AP_STEPS, APFieldKey, APStep, DEFAULT_MAPPINGS (+4 more)

### Community 11 - "PlanCard.tsx"
Cohesion: 0.17
Nodes (16): PackList(), Props, EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS, ENTERPRISE (+8 more)

### Community 12 - "date.ts"
Cohesion: 0.26
Nodes (10): DateInput(), DateInputProps, DATE_KEYS, HeaderCard(), Props, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 13 - "useOcrWizard"
Cohesion: 0.13
Nodes (22): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+14 more)

### Community 14 - "banks.ts"
Cohesion: 0.18
Nodes (11): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_KEYWORDS, BankEntry, BankInfo, BANKS, GROUP_DEBIT_BY_TRANSACTION (+3 more)

### Community 15 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "main.tsx"
Cohesion: 0.05
Nodes (38): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle() (+30 more)

### Community 19 - "APTableRow.tsx"
Cohesion: 0.21
Nodes (9): APTableRow(), FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props (+1 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.18
Nodes (17): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+9 more)

### Community 22 - "getCarmenUrl"
Cohesion: 0.15
Nodes (17): Props, APSuccessStep(), Props, Props, VendorSearch(), AuthScreen(), COPY, Lang (+9 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.06
Nodes (57): ConsentGate(), Props, countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate() (+49 more)

### Community 25 - "useT"
Cohesion: 0.13
Nodes (20): MAP, OrderStatusBadge(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA (+12 more)

### Community 26 - "CheckoutFlow.tsx"
Cohesion: 0.17
Nodes (12): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+4 more)

### Community 27 - "QueueSettings.tsx"
Cohesion: 0.47
Nodes (4): Switch(), SwitchProps, QueueSettings(), setAutoPost()

### Community 28 - "adminClient.ts"
Cohesion: 0.07
Nodes (70): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, OrderWorkspace(), wsReducer(), useOrderActions() (+62 more)

### Community 29 - "EmailAutomationPage.tsx"
Cohesion: 0.09
Nodes (28): EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Tab, Tabs(), TabsProps, EmailBusinessUnitRow (+20 more)

### Community 30 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (9): ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty(), ReviewQueue() (+1 more)

### Community 31 - "ManualScan.tsx"
Cohesion: 0.13
Nodes (14): FormActions(), Props, BANK_LOGOS, BankDetectionBanner(), Props, ExtractionWarningBanner(), Props, Props (+6 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): KPICard(), KPICardProps, fetchTenantDetail(), TenantDetail, TenantRow, funnel(), median(), quotaTier() (+2 more)

### Community 33 - "Pricing.tsx"
Cohesion: 0.14
Nodes (19): AppHeader(), Pager(), UsageIndicator(), PendingOrderBanner(), useOrderHistory(), ActiveSubscription, getUsage(), getStoredToken() (+11 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (13): DateRangePicker(), DateRangePickerProps, ExtractionFailureRow, fetchExtractionFailures(), causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+5 more)

### Community 35 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (24): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload() (+16 more)

### Community 37 - "apiFetch"
Cohesion: 0.12
Nodes (31): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+23 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 40 - "api.ts"
Cohesion: 0.12
Nodes (16): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest (+8 more)

### Community 43 - "OrderWorkspace.tsx"
Cohesion: 0.17
Nodes (10): ContactBuyer(), num(), WsAction, wsInitial, slipIsPdf(), SlipViewer(), CreditLedgerEntry, STAGE_KEY (+2 more)

### Community 44 - "useAPInvoice.ts"
Cohesion: 0.21
Nodes (15): APDraftState, ApDraft, APVendorProps, useAPVendor(), OcrDraftState, CcDraft, clearDraft(), DraftKind (+7 more)

### Community 45 - "client.ts"
Cohesion: 0.12
Nodes (22): T, base, Usage, AuthContext, AuthContextValue, AuthProvider(), revokeSession(), UsageData (+14 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.32
Nodes (14): AISuggestBar(), Props, Props, Props, ActiveScan, MainMappings, MasterAccount, MasterDepartment (+6 more)

### Community 48 - "ocr.ts"
Cohesion: 0.10
Nodes (22): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), COPY, Options, PdfPasswordAttempt (+14 more)

### Community 49 - "DataTable.tsx"
Cohesion: 0.10
Nodes (46): Column, DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir (+38 more)

### Community 50 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 52 - "credits.ts"
Cohesion: 0.13
Nodes (25): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+17 more)

### Community 53 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (12): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+4 more)

### Community 54 - "PendingOrderBanner.tsx"
Cohesion: 0.13
Nodes (28): OrderKpiCards(), VerifyFacts(), OrderRow(), RowAction, rowInitial, rowReducer(), RowState, expiryDate() (+20 more)

### Community 55 - "Pager.tsx"
Cohesion: 0.29
Nodes (3): Props, SIZE_OPTIONS, ROWS_PER_PAGE

### Community 56 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 57 - "config.ts"
Cohesion: 0.09
Nodes (25): OcrExtractionProps, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate() (+17 more)

### Community 58 - "LanguageContext.tsx"
Cohesion: 0.07
Nodes (49): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+41 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "JvEditor.tsx"
Cohesion: 0.21
Nodes (10): CustomSearchSelect(), Props, SelectOption, TopChoice, BlockReason, JvEditor(), rowId(), JvHeaderCard() (+2 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "AdminCreditOrder"
Cohesion: 0.29
Nodes (6): Props, Props, many(), order(), WsState, AdminCreditOrder

### Community 63 - "parseNum"
Cohesion: 0.23
Nodes (12): Props, APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected() (+4 more)

### Community 64 - "ReviewDocument.tsx"
Cohesion: 0.13
Nodes (20): Props, DetailRow, Props, JvState, Overrides, Props, OcrSubmissionHook, patchAccountingConfig() (+12 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "TKey"
Cohesion: 0.18
Nodes (12): BatchAction, BatchActionBar(), Props, TKey, NavItem, NavSection, ACTIVE_TAG, containerVariants (+4 more)

### Community 67 - "dict.ts"
Cohesion: 0.20
Nodes (9): APUploadStep(), INSTRUCTIONS, Props, DICT, en, Lang, th, translate() (+1 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "APAccountMappingStep.tsx"
Cohesion: 0.18
Nodes (9): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+1 more)

### Community 75 - "useMapping.ts"
Cohesion: 0.18
Nodes (14): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BANK_SOURCE_MAP, useBankConfig(), COMPANY_REQUIRED_FIELDS, useMapping() (+6 more)

### Community 76 - "AdminAuthContext.tsx"
Cohesion: 0.36
Nodes (9): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken() (+1 more)

### Community 78 - "InputTaxReconciliation.tsx"
Cohesion: 0.25
Nodes (12): InputTaxPanel(), Props, InputTaxReconciliation(), handleAddInputTax(), BANK_INFO, useAPInvoice(), repairDocFigure(), fetchTaxProfiles() (+4 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

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

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 114 - "AccountMappingTable.tsx"
Cohesion: 0.25
Nodes (11): AccountMappingTable(), GLAccount, MainMappingTable(), PaymentTypeModal(), AccountLike, allowedAccountsForDept(), DeptLike, isAccountAllowed() (+3 more)

## Knowledge Gaps
- **494 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+489 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `CustomModal.tsx`, `AccountingReview.tsx`, `NotificationBell.tsx`, `OrderActions.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `fmt`, `APInvoice.tsx`, `PlanCard.tsx`, `date.ts`, `useOcrWizard`, `APAmountSummary.tsx`, `main.tsx`, `QueueRow.tsx`, `getCarmenUrl`, `APReviewStep.tsx`, `emailAutomation.ts`, `CheckoutFlow.tsx`, `QueueSettings.tsx`, `adminClient.ts`, `EmailAutomationPage.tsx`, `ReviewQueue.tsx`, `ManualScan.tsx`, `TenantsPage.tsx`, `Pricing.tsx`, `ExtractionsPage.tsx`, `useAPExtraction.ts`, `OrderWorkspace.tsx`, `useAPInvoice.ts`, `client.ts`, `MainMappingTable.tsx`, `DataTable.tsx`, `credits.ts`, `OrderTable.tsx`, `PendingOrderBanner.tsx`, `Pager.tsx`, `LanguageContext.tsx`, `JvEditor.tsx`, `DocumentPreview.tsx`, `parseNum`, `ReviewDocument.tsx`, `TKey`, `dict.ts`, `APAccountMappingStep.tsx`, `useMapping.ts`, `InputTaxReconciliation.tsx`, `AccountMappingTable.tsx`?**
  _High betweenness centrality (0.243) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `emailReview.ts`, `NotificationBell.tsx`, `appKey`, `useOcrWizard`, `emailAutomation.ts`, `CheckoutFlow.tsx`, `QueueSettings.tsx`, `useAPExtraction.ts`, `api.ts`, `useAPInvoice.ts`, `client.ts`, `useAPExtraction.test.ts`, `ocr.ts`, `credits.ts`, `PendingOrderBanner.tsx`, `config.ts`, `JvEditor.tsx`, `ReviewDocument.tsx`, `useMapping.ts`, `InputTaxReconciliation.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `ocr.ts`, `useAPInvoice.ts`, `useAPExtraction.ts`, `ManualScan.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _494 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CustomModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07372549019607844 - nodes in this community are weakly interconnected._
- **Should `AccountingReview.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._
- **Should `NotificationBell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._