# Graph Report - OCR  (2026-09-08)

## Corpus Check
- 299 files · ~240,753 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1761 nodes · 4969 edges · 107 communities (93 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `326666a9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- TutorialModal.tsx
- ccJv.ts
- NotificationBell.tsx
- SlipViewer.tsx
- Mapping.tsx
- routes.tsx
- FeatureFlows.tsx
- useAPInvoice.ts
- dict.ts
- APAccountMappingStep.tsx
- useT
- date.ts
- showToast
- banks.ts
- DataTable.tsx
- compilerOptions
- 5. Components
- getCarmenUrl
- auth.ts
- devDependencies
- QueueRow.tsx
- APVendorSearch.tsx
- APReviewStep.tsx
- emailAutomation.ts
- APAmountSummary.tsx
- Pricing.tsx
- client.ts
- adminClient.ts
- QuotaModulesPage.tsx
- useOcrExtraction.ts
- AccountMappingTable.tsx
- TenantsPage.tsx
- OrderHistory.tsx
- main.tsx
- ExtractionsPage.tsx
- useAPExtraction.ts
- apiFetch
- dependencies
- Button.tsx
- api.ts
- EmailAutomationPage.tsx
- useUserConsent.ts
- CheckoutFlow.tsx
- PendingOrderBanner.tsx
- OrderTable.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- usePdfPasswordPrompt
- LanguageContext.tsx
- useMappingData.ts
- ReviewDocument.tsx
- credits.ts
- OrderActions.tsx
- orderHelpers.ts
- AuthContext.tsx
- ManualScan.tsx
- useOcrSubmission.test.ts
- APTableRow.tsx
- scripts
- useMapping.ts
- DocumentPreview.tsx
- AdminCreditOrder
- APLineItem
- reviewReasons.ts
- compilerOptions
- TKey
- APInvoice.tsx
- APUploadStep.tsx
- MetricChartImpl.tsx
- CLAUDE.md
- Contributing
- InputTaxReconciliation.tsx
- useOcrWizard.ts
- useAuth
- UploadSection.tsx
- TenantSelector.test.tsx
- MaintenanceGate.tsx
- eslint-plugin-react-hooks
- PDFPageSelector
- Product
- eslint
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
- jsdom
- postcss
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 225 edges
2. `apiFetch` - 54 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `appKey()` - 33 edges
7. `TKey` - 29 edges
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
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts
- `Props` --references--> `Vendor`  [EXTRACTED]
  frontend/src/components/ap-invoice/APVendorSearch.tsx → frontend/src/hooks/ap-invoice/useAPVendor.ts

## Import Cycles
- None detected.

## Communities (107 total, 14 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.07
Nodes (30): ReviewQueueController, useReviewQueue(), LanguageProvider(), readLang(), ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getReviewStatus() (+22 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): OrderDrawer(), FOCUS_STEPS, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+19 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.18
Nodes (13): CONFIG, leg(), rows(), TWO_LINES, applyJvAmount(), buildJvRows(), COLUMN_FOR_KEY, consolidated() (+5 more)

### Community 3 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (41): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+33 more)

### Community 5 - "Mapping.tsx"
Cohesion: 0.15
Nodes (12): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BankConfigHook (+4 more)

### Community 6 - "routes.tsx"
Cohesion: 0.13
Nodes (40): Column, daysAgo(), endOfDay(), today(), ymd(), label(), Tenant, TenantSelector() (+32 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.18
Nodes (25): AmountSummary(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields(), useAPInvoice(), adjustField() (+17 more)

### Community 9 - "dict.ts"
Cohesion: 0.32
Nodes (6): DICT, en, Lang, th, translate(), LanguageCtx

### Community 10 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 11 - "useT"
Cohesion: 0.10
Nodes (29): OrderKpiCards(), ContactBuyer(), num(), VerifyFacts(), FormActions(), Props, PackList(), PendingOrderBanner() (+21 more)

### Community 12 - "date.ts"
Cohesion: 0.27
Nodes (12): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), formatDateToDDMMYYYY() (+4 more)

### Community 13 - "showToast"
Cohesion: 0.12
Nodes (24): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+16 more)

### Community 14 - "banks.ts"
Cohesion: 0.14
Nodes (19): AccountingReview(), BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP, BankEntry, BankInfo, GROUP_DEBIT_BY_TRANSACTION, OCR_BANK_MAP (+11 more)

### Community 15 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "getCarmenUrl"
Cohesion: 0.24
Nodes (10): AppHeader(), AuthScreen(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), RowAction() (+2 more)

### Community 19 - "auth.ts"
Cohesion: 0.25
Nodes (9): T, base, Usage, UsageIndicator(), ActiveSubscription, getUsage(), UsageData, computeUsageStats() (+1 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+4 more)

### Community 22 - "APVendorSearch.tsx"
Cohesion: 0.19
Nodes (10): Props, VendorSearch(), Badge(), BadgeVariant, Props, Coords, getCoords(), Props (+2 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): EmailSettingsController, SETTINGS, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call() (+18 more)

### Community 25 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 26 - "Pricing.tsx"
Cohesion: 0.12
Nodes (18): _growthIcon, PlanCardProps, TIER_ICONS, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, ENTERPRISE, _growth (+10 more)

### Community 27 - "client.ts"
Cohesion: 0.14
Nodes (16): APDraftState, extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), API_BASE, ApiClientOptions (+8 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.07
Nodes (68): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, CompanyPanel(), OrderWorkspace(), WsAction (+60 more)

### Community 29 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (27): KPICard(), KPICardProps, Card(), CardProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+19 more)

### Community 30 - "useOcrExtraction.ts"
Cohesion: 0.12
Nodes (19): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS, detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords() (+11 more)

### Community 31 - "AccountMappingTable.tsx"
Cohesion: 0.25
Nodes (11): AccountMappingTable(), GLAccount, MainMappingTable(), PaymentTypeModal(), AccountLike, allowedAccountsForDept(), DeptLike, isAccountAllowed() (+3 more)

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.16
Nodes (18): endMaintenanceNow(), fetchMaintenance(), fetchTenantDetail(), fetchTenants(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantDetail (+10 more)

### Community 33 - "OrderHistory.tsx"
Cohesion: 0.14
Nodes (18): MAP, OrderStatusBadge(), catalogName(), OPEN_STATUSES, OrderHistoryState, useOrderHistory(), getStoredToken(), CreditOrder (+10 more)

### Community 34 - "main.tsx"
Cohesion: 0.06
Nodes (39): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle() (+31 more)

### Community 35 - "ExtractionsPage.tsx"
Cohesion: 0.17
Nodes (15): DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, ExtractionFailureRow, fetchExtractionFailures(), causeLabel(), classify() (+7 more)

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (20): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload(), handleFileChange() (+12 more)

### Community 37 - "apiFetch"
Cohesion: 0.09
Nodes (27): Props, APInvoiceHeader, APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload (+19 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 40 - "api.ts"
Cohesion: 0.12
Nodes (17): useMappingSuggestions(), suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption (+9 more)

### Community 41 - "EmailAutomationPage.tsx"
Cohesion: 0.19
Nodes (16): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailHealth(), pollEmailNow(), sweepEmailConfirmations() (+8 more)

### Community 42 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent() (+2 more)

### Community 43 - "CheckoutFlow.tsx"
Cohesion: 0.16
Nodes (12): DEFAULT_STEPS, Props, Step, StepWizard(), CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY (+4 more)

### Community 44 - "PendingOrderBanner.tsx"
Cohesion: 0.17
Nodes (19): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, expiryDate(), num(), ProformaDocument() (+11 more)

### Community 45 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (11): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+3 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.20
Nodes (18): AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption, TopChoice, Props, Props (+10 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "LanguageContext.tsx"
Cohesion: 0.11
Nodes (30): MetricChart(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+22 more)

### Community 50 - "useMappingData.ts"
Cohesion: 0.41
Nodes (10): useAPSubmission(), GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+2 more)

### Community 51 - "ReviewDocument.tsx"
Cohesion: 0.13
Nodes (25): SwapLabel(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, Props, BlockReason, BU_WIDE (+17 more)

### Community 52 - "credits.ts"
Cohesion: 0.14
Nodes (25): Props, Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist() (+17 more)

### Community 53 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 54 - "orderHelpers.ts"
Cohesion: 0.50
Nodes (3): STAGE_KEY, STAGE_TONE, T

### Community 55 - "AuthContext.tsx"
Cohesion: 0.20
Nodes (14): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), clearAllDrafts(), getJwtExpMs() (+6 more)

### Community 56 - "ManualScan.tsx"
Cohesion: 0.11
Nodes (16): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps (+8 more)

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (17): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+9 more)

### Community 58 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.14
Nodes (25): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), persistScanForMapping(), getAccountingConfig (+17 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 62 - "AdminCreditOrder"
Cohesion: 0.29
Nodes (6): Props, Props, many(), order(), WsState, AdminCreditOrder

### Community 63 - "APLineItem"
Cohesion: 0.25
Nodes (11): Props, APGroupModal(), profileLabel(), Props, ApDraft, APValidationProps, apGroupKey(), buildGroupedRow() (+3 more)

### Community 64 - "reviewReasons.ts"
Cohesion: 0.28
Nodes (7): ExtractionWarningBanner(), Props, FIX, REASON_KEY, SETTINGS, warningText(), WITH_DETAIL

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "TKey"
Cohesion: 0.15
Nodes (14): BatchAction, BatchActionBar(), Props, TKey, Home, NavItem, NavSection, ACTIVE_TAG (+6 more)

### Community 67 - "APInvoice.tsx"
Cohesion: 0.14
Nodes (17): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props, APTableRow(), AP_STEPS (+9 more)

### Community 68 - "APUploadStep.tsx"
Cohesion: 0.50
Nodes (3): APUploadStep(), INSTRUCTIONS, Props

### Community 69 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "InputTaxReconciliation.tsx"
Cohesion: 0.18
Nodes (8): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, _parseCarmenHttpError(), submitInputTax(), submitToCarmen()

### Community 73 - "useOcrWizard.ts"
Cohesion: 0.35
Nodes (9): OcrDraftState, CcDraft, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+1 more)

### Community 74 - "useAuth"
Cohesion: 0.14
Nodes (16): AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig, EXPIRED_FLAG_KEY (+8 more)

### Community 75 - "UploadSection.tsx"
Cohesion: 0.50
Nodes (3): INSTRUCTIONS, Props, UploadSection()

### Community 77 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+2 more)

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

## Knowledge Gaps
- **497 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+492 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `TutorialModal.tsx`, `NotificationBell.tsx`, `SlipViewer.tsx`, `Mapping.tsx`, `routes.tsx`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `APAccountMappingStep.tsx`, `showToast`, `banks.ts`, `DataTable.tsx`, `getCarmenUrl`, `auth.ts`, `QueueRow.tsx`, `APVendorSearch.tsx`, `APReviewStep.tsx`, `APAmountSummary.tsx`, `Pricing.tsx`, `adminClient.ts`, `QuotaModulesPage.tsx`, `useOcrExtraction.ts`, `AccountMappingTable.tsx`, `TenantsPage.tsx`, `OrderHistory.tsx`, `main.tsx`, `ExtractionsPage.tsx`, `useAPExtraction.ts`, `apiFetch`, `EmailAutomationPage.tsx`, `CheckoutFlow.tsx`, `PendingOrderBanner.tsx`, `OrderTable.tsx`, `MainMappingTable.tsx`, `LanguageContext.tsx`, `ReviewDocument.tsx`, `OrderActions.tsx`, `ManualScan.tsx`, `DocumentPreview.tsx`, `APLineItem`, `reviewReasons.ts`, `TKey`, `APInvoice.tsx`, `APUploadStep.tsx`, `MetricChartImpl.tsx`, `InputTaxReconciliation.tsx`, `UploadSection.tsx`, `MaintenanceGate.tsx`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `showToast` to `useAPExtraction.ts`, `useOcrWizard.ts`, `usePdfPasswordPrompt`, `ReviewDocument.tsx`, `ManualScan.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `appKey()` connect `useMapping.ts` to `useAPExtraction.ts`, `useAPInvoice.ts`, `useOcrWizard.ts`, `useAuth`, `showToast`, `useAPExtraction.test.ts`, `ReviewDocument.tsx`, `AuthContext.tsx`, `ManualScan.tsx`, `useOcrExtraction.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _497 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07293868921775898 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `NotificationBell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06801346801346801 - nodes in this community are weakly interconnected._