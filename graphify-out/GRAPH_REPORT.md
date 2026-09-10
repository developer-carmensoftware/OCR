# Graph Report - OCR  (2026-09-10)

## Corpus Check
- 311 files · ~252,592 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1839 nodes · 5212 edges · 98 communities (85 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `553dd931`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewQueue.tsx
- CustomModal.tsx
- AccountingReview.tsx
- useNotifications.ts
- Pricing.tsx
- banks.ts
- useT
- FeatureFlows.tsx
- useAPInvoice.ts
- main.tsx
- useAPExtraction.ts
- screens.tsx
- PeriodPicker.tsx
- useOcrExtraction.test.ts
- apiFetch
- DataTable.tsx
- compilerOptions
- 5. Components
- ReviewDocument.test.tsx
- ARReconcileSettings.tsx
- devDependencies
- QueueRow.tsx
- config.ts
- APReviewStep.tsx
- showToast
- useOcrWizard.ts
- formatThb
- useMappingData.ts
- EmailAutomationPage.tsx
- ExtractionsPage.tsx
- ReviewDocument.tsx
- getCarmenUrl
- Overview.tsx
- InputTaxReconciliation.tsx
- notifications.ts
- NotificationBell.tsx
- useFileUpload.ts
- useAPSubmission.ts
- dependencies
- adminClient.ts
- api.ts
- VoidReasonModal.tsx
- useNotifications.test.ts
- APInvoice.tsx
- ProformaDocument.tsx
- OrderWorkspace.tsx
- useAPExtraction.test.ts
- MainMappingTable.tsx
- usePdfPasswordPrompt
- useOrderHistory.ts
- eslint-plugin-react-hooks
- OrderTable.tsx
- CheckoutFlow.tsx
- imagesToPdf.ts
- TenantSelector.test.tsx
- client.ts
- APAmountSummary.tsx
- credits.ts
- scripts
- useMapping.ts
- DocumentPreview.tsx
- @testing-library/dom
- ManualScan.tsx
- compilerOptions
- dict.ts
- LanguageContext.tsx
- CLAUDE.md
- Contributing
- useOcrWizard
- PDFPageSelector
- Tooltip.tsx
- Product
- eslint
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
- vercel.json
- Architecture
- vite.config.ts
- jsdom
- @types/react
- @testing-library/jest-dom
- @types/react-dom
- vite
- vitest
- vite-env.d.ts
- @vitejs/plugin-react

## God Nodes (most connected - your core abstractions)
1. `useT()` - 227 edges
2. `apiFetch` - 59 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 44 edges
5. `fmt()` - 41 edges
6. `appKey()` - 33 edges
7. `TKey` - 29 edges
8. `showToast()` - 29 edges
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

## Communities (98 total, 13 thin omitted)

### Community 0 - "ReviewQueue.tsx"
Cohesion: 0.12
Nodes (11): LanguageProvider(), readLang(), ACTIVITY_FILTERS, ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL (+3 more)

### Community 1 - "CustomModal.tsx"
Cohesion: 0.07
Nodes (35): OrderDrawer(), ModalType, Props, baseProps, TYPE_CONFIG, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES (+27 more)

### Community 2 - "AccountingReview.tsx"
Cohesion: 0.08
Nodes (33): CustomModal(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, BlockReason, BU_WIDE, JvEditor() (+25 more)

### Community 3 - "useNotifications.ts"
Cohesion: 0.18
Nodes (15): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy, releaseRow(), useNotifications(), listNotifications() (+7 more)

### Community 4 - "Pricing.tsx"
Cohesion: 0.14
Nodes (21): AppHeader(), CheckoutFlow(), itemName(), PendingOrderBanner(), EnterpriseCard(), loadPersistedCheckout(), readPersisted(), useOrderHistory() (+13 more)

### Community 5 - "banks.ts"
Cohesion: 0.10
Nodes (23): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_KEYWORDS (+15 more)

### Community 6 - "useT"
Cohesion: 0.14
Nodes (39): Column, DataTable(), daysAgo(), endOfDay(), today(), ymd(), label(), Tenant (+31 more)

### Community 7 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.17
Nodes (23): APGroupModal(), profileLabel(), ARReviewPane(), labelOf(), Props, AccountingReview(), Amount(), useAPInvoice() (+15 more)

### Community 9 - "main.tsx"
Cohesion: 0.05
Nodes (46): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle() (+38 more)

### Community 10 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (31): Props, COLS, Props, REQUIRED_FIELDS, Props, Props, APFieldKey, APInvoiceHeader (+23 more)

### Community 11 - "screens.tsx"
Cohesion: 0.12
Nodes (18): DEFAULT_STEPS, Props, Step, StepWizard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO (+10 more)

### Community 12 - "PeriodPicker.tsx"
Cohesion: 0.16
Nodes (21): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS (+13 more)

### Community 13 - "useOcrExtraction.test.ts"
Cohesion: 0.33
Nodes (5): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData()

### Community 14 - "apiFetch"
Cohesion: 0.24
Nodes (16): Props, ReviewQueueController, useReviewQueue(), apiFetch, ActivityFilter, approveDocument(), ApproveResult, getPending() (+8 more)

### Community 15 - "DataTable.tsx"
Cohesion: 0.11
Nodes (19): DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager(), Props (+11 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "ReviewDocument.test.tsx"
Cohesion: 0.12
Nodes (12): AR_CONTROL, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, detail(), EXTRACTED (+4 more)

### Community 19 - "ARReconcileSettings.tsx"
Cohesion: 0.08
Nodes (33): ARJvPreview(), money(), Props, ARMappingTable(), Props, Badge(), BadgeVariant, Props (+25 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.29
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 22 - "config.ts"
Cohesion: 0.09
Nodes (31): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), CarmenJvPayload, defaultConfig (+23 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (25): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+17 more)

### Community 24 - "showToast"
Cohesion: 0.08
Nodes (43): Button(), ButtonProps, Variant, VARIANT_CLASS, Draft, EmailSettingsController, EMPTY_DRAFT, EMPTY_RULE (+35 more)

### Community 25 - "useOcrWizard.ts"
Cohesion: 0.32
Nodes (10): OcrDraftState, CcDraft, clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 26 - "formatThb"
Cohesion: 0.20
Nodes (13): PackList(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, BillingFigure(), ENTERPRISE, PACK_META (+5 more)

### Community 27 - "useMappingData.ts"
Cohesion: 0.19
Nodes (15): JvHeaderCard(), GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes() (+7 more)

### Community 28 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 29 - "ExtractionsPage.tsx"
Cohesion: 0.08
Nodes (34): DateRangePicker(), DateRangePickerProps, KPICard(), KPICardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps (+26 more)

### Community 30 - "ReviewDocument.tsx"
Cohesion: 0.16
Nodes (18): ExtractionWarningBanner(), Props, Overrides, patchAccountingConfig(), ExtractedRow, ExtractResult, PdfInfoResult, toExtractedRows() (+10 more)

### Community 31 - "getCarmenUrl"
Cohesion: 0.18
Nodes (13): Props, VendorSearch(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), RowAction() (+5 more)

### Community 32 - "Overview.tsx"
Cohesion: 0.19
Nodes (14): Card(), CardProps, buildQs(), fetchAlerts(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fetchSessions() (+6 more)

### Community 33 - "InputTaxReconciliation.tsx"
Cohesion: 0.26
Nodes (11): InputTaxPanel(), Props, InputTaxReconciliation(), handleAddInputTax(), OCR_BANK_MAP, fetchTaxProfiles(), submitInputTax(), ItxOverrides (+3 more)

### Community 34 - "notifications.ts"
Cohesion: 0.16
Nodes (10): failedRow, items, markRead, orderRow, postedRow, releaseRow, ActivityPage, Notification (+2 more)

### Community 35 - "NotificationBell.tsx"
Cohesion: 0.24
Nodes (11): docLabel(), NotificationBell(), notifText(), releaseCopy(), TFn, TYPE_META, NotificationDetailModal(), Props (+3 more)

### Community 36 - "useFileUpload.ts"
Cohesion: 0.16
Nodes (10): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), MAX_FILE_SIZE_MB, selectedPagesToPdfUrl() (+2 more)

### Community 37 - "useAPSubmission.ts"
Cohesion: 0.11
Nodes (24): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+16 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "adminClient.ts"
Cohesion: 0.07
Nodes (64): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, OrderKpiCards(), useOrderActions(), withName() (+56 more)

### Community 40 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 41 - "VoidReasonModal.tsx"
Cohesion: 0.29
Nodes (7): REJECT_OTHER, REJECT_PRESETS, Action, initial, reducer(), State, VoidReasonModal()

### Community 42 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 43 - "APInvoice.tsx"
Cohesion: 0.07
Nodes (28): AccountMappingTable(), GLAccount, Props, APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount (+20 more)

### Community 44 - "ProformaDocument.tsx"
Cohesion: 0.21
Nodes (14): expiryDate(), num(), ProformaDocument(), TITLE, catalogName(), formatDate(), bahtToEnglishWords(), _hundreds() (+6 more)

### Community 45 - "OrderWorkspace.tsx"
Cohesion: 0.11
Nodes (25): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), CompanyPanel(), ContactBuyer(), num() (+17 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.13
Nodes (18): _fetchExtract(), isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE (+10 more)

### Community 47 - "MainMappingTable.tsx"
Cohesion: 0.15
Nodes (27): AISuggestBar(), Props, MappingRow(), MappingRowVariant, Props, MainMappingTable(), Props, PaymentTypeModal() (+19 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open(), prompt() (+4 more)

### Community 49 - "useOrderHistory.ts"
Cohesion: 0.50
Nodes (4): OPEN_STATUSES, OrderHistoryState, CreditOrder, OPEN_ORDER_STATUSES

### Community 51 - "OrderTable.tsx"
Cohesion: 0.11
Nodes (20): Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable() (+12 more)

### Community 52 - "CheckoutFlow.tsx"
Cohesion: 0.18
Nodes (14): Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, Props, ACCEPTED, Props, SlipUpload(), CheckoutPhase (+6 more)

### Community 53 - "imagesToPdf.ts"
Cohesion: 0.60
Nodes (4): imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg()

### Community 55 - "client.ts"
Cohesion: 0.05
Nodes (58): ConsentGate(), Props, countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate() (+50 more)

### Community 56 - "APAmountSummary.tsx"
Cohesion: 0.19
Nodes (10): AmountSummary(), Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput() (+2 more)

### Community 58 - "credits.ts"
Cohesion: 0.15
Nodes (23): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, clearPersistedCheckout(), EMPTY_BUYER, persist() (+15 more)

### Community 59 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 60 - "useMapping.ts"
Cohesion: 0.15
Nodes (24): BANK_INFO, BANK_SOURCE_MAP, detectBankFromCompanyName(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionProps, persistScanForMapping() (+16 more)

### Community 61 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 64 - "ManualScan.tsx"
Cohesion: 0.07
Nodes (30): DateInput(), DateInputProps, FormActions(), Props, BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS (+22 more)

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "dict.ts"
Cohesion: 0.10
Nodes (22): BatchAction, BatchActionBar(), Props, APUploadStep(), INSTRUCTIONS, Props, DICT, en (+14 more)

### Community 69 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (18): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+10 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "useOcrWizard"
Cohesion: 0.16
Nodes (17): detectBankFromExtracted(), useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrWizard(), handleCancel() (+9 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

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
- **512 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+507 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `ReviewQueue.tsx`, `CustomModal.tsx`, `AccountingReview.tsx`, `useNotifications.ts`, `Pricing.tsx`, `banks.ts`, `FeatureFlows.tsx`, `useAPInvoice.ts`, `main.tsx`, `useAPExtraction.ts`, `screens.tsx`, `PeriodPicker.tsx`, `DataTable.tsx`, `ARReconcileSettings.tsx`, `QueueRow.tsx`, `APReviewStep.tsx`, `formatThb`, `useMappingData.ts`, `EmailAutomationPage.tsx`, `ExtractionsPage.tsx`, `ReviewDocument.tsx`, `getCarmenUrl`, `Overview.tsx`, `InputTaxReconciliation.tsx`, `NotificationBell.tsx`, `useAPSubmission.ts`, `adminClient.ts`, `VoidReasonModal.tsx`, `APInvoice.tsx`, `ProformaDocument.tsx`, `OrderWorkspace.tsx`, `useAPExtraction.test.ts`, `MainMappingTable.tsx`, `useOrderHistory.ts`, `OrderTable.tsx`, `CheckoutFlow.tsx`, `client.ts`, `APAmountSummary.tsx`, `credits.ts`, `DocumentPreview.tsx`, `ManualScan.tsx`, `dict.ts`, `LanguageContext.tsx`, `useOcrWizard`?**
  _High betweenness centrality (0.216) - this node is a cross-community bridge._
- **Why does `useOcrExtraction()` connect `useOcrWizard` to `useOcrWizard.ts`, `useMapping.ts`, `useOcrExtraction.test.ts`, `config.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useNotifications.ts`, `Pricing.tsx`, `useAPInvoice.ts`, `useAPExtraction.ts`, `ARReconcileSettings.tsx`, `config.ts`, `useMappingData.ts`, `ReviewDocument.tsx`, `InputTaxReconciliation.tsx`, `notifications.ts`, `useFileUpload.ts`, `useAPSubmission.ts`, `api.ts`, `useAPExtraction.test.ts`, `CheckoutFlow.tsx`, `client.ts`, `credits.ts`, `useMapping.ts`, `useOcrWizard`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _512 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._
- **Should `CustomModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06988120195667366 - nodes in this community are weakly interconnected._
- **Should `AccountingReview.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08461538461538462 - nodes in this community are weakly interconnected._