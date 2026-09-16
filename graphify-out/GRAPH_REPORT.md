# Graph Report - OCR  (2026-09-16)

## Corpus Check
- 316 files · ~258,507 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1856 nodes · 5289 edges · 104 communities (90 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2dc8d10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- OrderActions.tsx
- TutorialModal.tsx
- ccJv.ts
- ReviewQueue.tsx
- useOcrExtraction
- Mapping.tsx
- PeriodPicker.tsx
- FeatureFlows.tsx
- parseNum
- main.tsx
- APInvoice.tsx
- useT
- APGroupModal.tsx
- QuotaModulesPage.tsx
- emailReview.ts
- AdminAuthContext.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ReviewDocument.tsx
- devDependencies
- QueueRow.tsx
- useOcrSubmission.test.ts
- APLineItemsTable.tsx
- useEmailSettings.ts
- APLineItem
- ArCustomerProfiles.tsx
- ARReconcileSettings.tsx
- UsageIndicator.tsx
- feedback.ts
- APReviewStep.tsx
- Pricing.tsx
- @testing-library/dom
- ManualScan.tsx
- NotificationBell.tsx
- useAPExtraction.ts
- apiFetch
- dependencies
- adminClient.ts
- api.ts
- ProformaDocument.tsx
- deptAccounts.ts
- SlipUpload.tsx
- DataTable.tsx
- useAPExtraction.test.ts
- useMapping.ts
- ocr.ts
- DocumentPreview.tsx
- ExtractionsPage.tsx
- OrderHistory.tsx
- jsdom
- TenantSelector.test.tsx
- client.ts
- APAmountSummary.tsx
- banks.ts
- credits.ts
- scripts
- storage.ts
- Overview.tsx
- APAccountMappingStep.tsx
- DetailTable.tsx
- compilerOptions
- LanguageContext.tsx
- useMappingData.ts
- date.ts
- OrderWorkspace.tsx
- CLAUDE.md
- Contributing
- useOcrWizard.ts
- useUserConsent.ts
- PaymentTypeModal.test.tsx
- APVendorSearch.tsx
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
- UserConsentModal.tsx
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
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/APGroupModal.tsx → frontend/src/types/ap.ts
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APTableRow.tsx → frontend/src/lib/format.ts

## Import Cycles
- None detected.

## Communities (104 total, 14 thin omitted)

### Community 0 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ccJv.ts"
Cohesion: 0.14
Nodes (16): CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY, consolidated() (+8 more)

### Community 3 - "ReviewQueue.tsx"
Cohesion: 0.22
Nodes (8): carmenSettingsUrl(), COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, NotSetUp(), QueueEmpty(), ReviewQueue()

### Community 4 - "useOcrExtraction"
Cohesion: 0.14
Nodes (12): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+4 more)

### Community 5 - "Mapping.tsx"
Cohesion: 0.21
Nodes (11): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, BANK_SOURCE_MAP, BankConfigHook, useBankConfig(), useMapping() (+3 more)

### Community 6 - "PeriodPicker.tsx"
Cohesion: 0.10
Nodes (39): Column, DateRangePicker(), DateRangePickerProps, daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS (+31 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "parseNum"
Cohesion: 0.18
Nodes (21): AmountSummary(), AccountingReview(), InputTaxPanel(), Amount(), getAvailableFields(), adjustField(), DocRepair, reconcileRows() (+13 more)

### Community 9 - "main.tsx"
Cohesion: 0.06
Nodes (40): AdminProtectedRoute(), DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle(), PageSkeleton(), useAdminAuth() (+32 more)

### Community 10 - "APInvoice.tsx"
Cohesion: 0.14
Nodes (17): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, DEFAULT_STEPS, Props, Step, StepWizard() (+9 more)

### Community 11 - "useT"
Cohesion: 0.13
Nodes (18): OrderKpiCards(), FormActions(), Props, DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS (+10 more)

### Community 12 - "APGroupModal.tsx"
Cohesion: 0.33
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 13 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (17): EmptyState(), EmptyStateProps, Switch(), SwitchProps, Tab, Tabs(), TabsProps, fetchQuotaOverview() (+9 more)

### Community 14 - "emailReview.ts"
Cohesion: 0.18
Nodes (14): Props, ReviewQueueController, useReviewQueue(), ACTIVITY_FILTERS, ActivityFilter, ApproveResult, getReviewStatus(), listActivity() (+6 more)

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
Nodes (12): AR_CONTROL, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, detail(), EXTRACTED (+4 more)

### Community 19 - "ReviewDocument.tsx"
Cohesion: 0.10
Nodes (30): ARReviewPane(), labelOf(), Props, Props, DetailRow, Props, Props, BlockReason (+22 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, eslint-plugin-react-hooks, devDependencies, autoprefixer, @eslint/js, eslint-plugin-react-hooks, globals (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.31
Nodes (11): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+3 more)

### Community 22 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (15): OcrExtractionProps, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate() (+7 more)

### Community 23 - "APLineItemsTable.tsx"
Cohesion: 0.15
Nodes (18): Props, Ctrl, APTableFooter(), Props, APTableHeader(), Props, APTableRow(), FixedTaxSettings (+10 more)

### Community 24 - "useEmailSettings.ts"
Cohesion: 0.07
Nodes (47): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+39 more)

### Community 25 - "APLineItem"
Cohesion: 0.43
Nodes (7): Props, Props, APInvoiceHeader, APDraftState, ApDraft, APValidationProps, APLineItem

### Community 26 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 27 - "ARReconcileSettings.tsx"
Cohesion: 0.09
Nodes (30): Button(), ButtonProps, Variant, VARIANT_CLASS, Card(), CardProps, ARJvPreview(), money() (+22 more)

### Community 28 - "UsageIndicator.tsx"
Cohesion: 0.27
Nodes (7): T, base, Usage, UsageIndicator(), UsageData, computeUsageStats(), UsageStats

### Community 29 - "feedback.ts"
Cohesion: 0.50
Nodes (4): Correction, FIELD_NAME_MAP, logCorrections(), mapFieldName()

### Community 30 - "APReviewStep.tsx"
Cohesion: 0.27
Nodes (9): APLineItemsTable(), APReviewStep(), HEADER_FIELDS(), Props, ExtractionWarningBanner(), Props, OcrExtractionHook, ExtractionWarning (+1 more)

### Community 31 - "Pricing.tsx"
Cohesion: 0.14
Nodes (27): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PackList(), Props, EnterpriseCard() (+19 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.09
Nodes (25): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, ExtractionSkeleton(), Props, REASON_KEY (+17 more)

### Community 34 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (39): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+31 more)

### Community 36 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (22): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), FileUploadHook, useFileUpload() (+14 more)

### Community 37 - "apiFetch"
Cohesion: 0.10
Nodes (33): handleAddInputTax(), useAPInvoice(), APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes (+25 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.07
Nodes (67): useOrderActions(), withName(), adminFetch, AdminOrderStatus, AdminUserRow, approveOrder(), createAdminUser(), CreditBalance (+59 more)

### Community 40 - "api.ts"
Cohesion: 0.10
Nodes (21): APVendorMapping, APVendorMappingResponse, ConfigPatch, saveAccountingConfig(), suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, AccountingConfigRequest (+13 more)

### Community 41 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 43 - "deptAccounts.ts"
Cohesion: 0.14
Nodes (16): AccountMappingTable(), GLAccount, Props, CustomSearchSelect(), Props, SelectOption, TopChoice, MappingRow() (+8 more)

### Community 44 - "SlipUpload.tsx"
Cohesion: 0.28
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 45 - "DataTable.tsx"
Cohesion: 0.08
Nodes (30): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, CompanyPanel() (+22 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 47 - "useMapping.ts"
Cohesion: 0.27
Nodes (17): AISuggestBar(), Props, MappingRowVariant, Props, Props, Props, ActiveScan, COMPANY_REQUIRED_FIELDS (+9 more)

### Community 48 - "ocr.ts"
Cohesion: 0.16
Nodes (14): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+6 more)

### Community 49 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 50 - "ExtractionsPage.tsx"
Cohesion: 0.11
Nodes (34): endOfDay(), label(), Tenant, TenantSelector(), TenantSelectorProps, useTableData(), ExtractionFailureRow, fetchExtractionFailures() (+26 more)

### Community 52 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (21): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+13 more)

### Community 55 - "client.ts"
Cohesion: 0.15
Nodes (17): AuthContext, AuthContextValue, AuthProvider(), A, B, Probe(), revokeSession(), API_BASE (+9 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.18
Nodes (10): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, Card(), Props, NumericInput() (+2 more)

### Community 57 - "banks.ts"
Cohesion: 0.14
Nodes (16): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO, BANK_KEYWORDS, BankEntry, BankInfo, BANKS (+8 more)

### Community 58 - "credits.ts"
Cohesion: 0.12
Nodes (28): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout (+20 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "storage.ts"
Cohesion: 0.12
Nodes (25): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+17 more)

### Community 61 - "Overview.tsx"
Cohesion: 0.12
Nodes (20): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+12 more)

### Community 63 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 64 - "DetailTable.tsx"
Cohesion: 0.17
Nodes (13): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS, HeaderCard(), Props (+5 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "LanguageContext.tsx"
Cohesion: 0.07
Nodes (34): BatchAction, BatchActionBar(), Props, APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props (+26 more)

### Community 67 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 68 - "date.ts"
Cohesion: 0.33
Nodes (10): DateInput(), DateInputProps, addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 69 - "OrderWorkspace.tsx"
Cohesion: 0.08
Nodes (33): Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable() (+25 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard.ts"
Cohesion: 0.15
Nodes (26): OcrDraftState, useOcrSubmission(), handleSubmitFinal(), CcDraft, getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange() (+18 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "PaymentTypeModal.test.tsx"
Cohesion: 0.29
Nodes (6): PaymentTypeModal(), ACCOUNTS, DEPARTMENTS, ModalProps, props(), renderModal()

### Community 76 - "APVendorSearch.tsx"
Cohesion: 0.17
Nodes (12): Props, Props, VendorSearch(), Badge(), BadgeVariant, Props, Coords, getCoords() (+4 more)

### Community 77 - "AppHeader.tsx"
Cohesion: 0.14
Nodes (13): APSuccessStep(), AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., NotificationDetailModal(), RowAction(), FIX, fixLinkProps() (+5 more)

### Community 78 - "useAuth"
Cohesion: 0.15
Nodes (16): ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+8 more)

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

### Community 89 - "UserConsentModal.tsx"
Cohesion: 0.40
Nodes (5): COPY, Lang, Props, useIsMobile(), UserConsentModal()

### Community 90 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 91 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

## Knowledge Gaps
- **515 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+510 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `OrderActions.tsx`, `TutorialModal.tsx`, `ReviewQueue.tsx`, `Mapping.tsx`, `PeriodPicker.tsx`, `FeatureFlows.tsx`, `parseNum`, `main.tsx`, `APInvoice.tsx`, `APGroupModal.tsx`, `QuotaModulesPage.tsx`, `ReviewDocument.tsx`, `QueueRow.tsx`, `APLineItemsTable.tsx`, `useEmailSettings.ts`, `APLineItem`, `ArCustomerProfiles.tsx`, `ARReconcileSettings.tsx`, `UsageIndicator.tsx`, `APReviewStep.tsx`, `Pricing.tsx`, `ManualScan.tsx`, `NotificationBell.tsx`, `useAPExtraction.ts`, `apiFetch`, `adminClient.ts`, `ProformaDocument.tsx`, `deptAccounts.ts`, `SlipUpload.tsx`, `DataTable.tsx`, `useMapping.ts`, `DocumentPreview.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `APAmountSummary.tsx`, `credits.ts`, `Overview.tsx`, `APAccountMappingStep.tsx`, `DetailTable.tsx`, `LanguageContext.tsx`, `OrderWorkspace.tsx`, `useOcrWizard.ts`, `APVendorSearch.tsx`, `AppHeader.tsx`, `TenantsPage.tsx`, `UserConsentModal.tsx`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `showToast()` connect `apiFetch` to `ReviewQueue.tsx`, `useAPExtraction.ts`, `useOcrExtraction`, `useOcrWizard.ts`, `ReviewDocument.tsx`, `useOcrSubmission.test.ts`, `client.ts`, `useEmailSettings.ts`, `storage.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `ManualScan.tsx`, `NotificationBell.tsx`, `useMappingData.ts`, `useAPExtraction.ts`, `useOcrExtraction`, `api.ts`, `useUserConsent.ts`, `useAPExtraction.test.ts`, `emailReview.ts`, `ocr.ts`, `ReviewDocument.tsx`, `OrderHistory.tsx`, `client.ts`, `credits.ts`, `ARReconcileSettings.tsx`, `storage.ts`, `feedback.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _515 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `useOcrExtraction` be split into smaller, more focused modules?**
  _Cohesion score 0.1368421052631579 - nodes in this community are weakly interconnected._