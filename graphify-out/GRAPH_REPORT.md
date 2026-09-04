# Graph Report - OCR  (2026-09-04)

## Corpus Check
- 297 files · ~236,902 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1753 nodes · 4944 edges · 103 communities (88 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `61d81e02`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- apiFetch
- TutorialModal.tsx
- ReviewDocument.tsx
- EmailAutomationPage.tsx
- AdminAuthContext.tsx
- storage.ts
- DataTable.tsx
- TKey
- useAPInvoice.ts
- constants/index.ts
- useAPExtraction.ts
- OrderActions.tsx
- OrderWorkspace.tsx
- useOcrWizard
- banks.ts
- APAmountSummary.tsx
- compilerOptions
- 5. Components
- main.tsx
- CreditsPage.tsx
- devDependencies
- QueueRow.tsx
- APInvoice.tsx
- apInvoice.ts
- emailAutomation.ts
- useT
- credits.ts
- NotificationBell.tsx
- adminClient.ts
- ExtractionsPage.tsx
- ReviewQueue.tsx
- dict.ts
- TenantsPage.tsx
- UsageIndicator.tsx
- OrderTable.test.tsx
- auth.ts
- useFileUpload.ts
- InputTaxReconciliation.tsx
- dependencies
- Tooltip.tsx
- api.ts
- client.ts
- FeatureFlows.tsx
- OrderTable.tsx
- draft.ts
- AuthContext.tsx
- useAPExtraction.test.ts
- useMapping.ts
- useOcrWizard.ts
- PeriodPicker.tsx
- ReviewDocument.test.tsx
- useMappingData.ts
- ArCustomerProfiles.tsx
- ErrorBoundary
- Skeleton.tsx
- usePdfPasswordPrompt
- MetricChartImpl.tsx
- useOcrSubmission.test.ts
- reviewReasons.ts
- scripts
- sanitizedPdfUrl
- TenantSelector.test.tsx
- typescript
- useAPSubmission.ts
- useOcrExtraction
- compilerOptions
- LanguageContext.tsx
- eslint
- CLAUDE.md
- Contributing
- MaintenanceGate.tsx
- useUserConsent.ts
- showToast
- parseNum
- date.ts
- PDFPageSelector
- Product
- Carmen AI — OCR & Import System
- 🏗️ Backend Principles (Python / FastAPI)
- 🎨 Frontend Principles (React / Vue / JS)
- Coding Skills & Principles
- package.json
- DataTable.test.tsx
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
- Mapping.tsx

## God Nodes (most connected - your core abstractions)
1. `useT()` - 230 edges
2. `apiFetch` - 56 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 39 edges
6. `showToast()` - 33 edges
7. `appKey()` - 31 edges
8. `TKey` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/components/admin/BatchActionBar.tsx → frontend/src/i18n/dict.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/ap-invoice/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/components/ap-invoice/APGroupModal.tsx → frontend/src/types/ap.ts

## Import Cycles
- None detected.

## Communities (103 total, 15 thin omitted)

### Community 0 - "apiFetch"
Cohesion: 0.19
Nodes (21): ReviewQueueController, useReviewQueue(), apiFetch, patchAccountingConfig(), ActivityFilter, approveDocument(), ApproveResult, dismissRow() (+13 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ReviewDocument.tsx"
Cohesion: 0.11
Nodes (27): CustomSearchSelect(), Props, SelectOption, TopChoice, SkeletonRow(), SwapLabel(), DEFAULT_EMPTY_OBJECT, Props (+19 more)

### Community 3 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (17): EmailBusinessUnitRow, EmailDocumentRow, EmailIngestHealth, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments(), fetchEmailHealth(), pollEmailNow() (+9 more)

### Community 4 - "AdminAuthContext.tsx"
Cohesion: 0.16
Nodes (17): AdminAuthContext, AdminAuthContextValue, AdminAuthProvider(), adminLogin(), AdminLoginError, adminLogout(), adminMe(), AdminUser (+9 more)

### Community 5 - "storage.ts"
Cohesion: 0.10
Nodes (30): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), DetailRow, EXTRACTION_STAGES (+22 more)

### Community 6 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, Pager() (+12 more)

### Community 7 - "TKey"
Cohesion: 0.13
Nodes (19): periodHours(), TKey, fetchErrorBreakdown(), fetchTenantRanking(), ErrorRow, ErrorsPage(), GroupBy, ADMIN_ROUTES (+11 more)

### Community 8 - "useAPInvoice.ts"
Cohesion: 0.17
Nodes (17): getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER, header() (+9 more)

### Community 9 - "constants/index.ts"
Cohesion: 0.27
Nodes (8): BANK_LOGOS, Props, BANK_THAI_NAMES, BANKS, DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn, EMPTY_DETAIL_ROW

### Community 10 - "useAPExtraction.ts"
Cohesion: 0.22
Nodes (11): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), NUMERIC_FIELDS, createApiClient(), fetchTimeout(), imagesToPdf(), MAX_MULTI_IMAGES (+3 more)

### Community 11 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 12 - "OrderWorkspace.tsx"
Cohesion: 0.10
Nodes (35): Props, Props, ContactBuyer(), num(), VerifyFacts(), WsAction, wsInitial, WsState (+27 more)

### Community 13 - "useOcrWizard"
Cohesion: 0.18
Nodes (21): applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry(), useOcrWizard() (+13 more)

### Community 14 - "banks.ts"
Cohesion: 0.11
Nodes (25): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO (+17 more)

### Community 15 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): AmountSummary(), Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 16 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 17 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 18 - "main.tsx"
Cohesion: 0.08
Nodes (30): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), PageSkeleton(), useAdminAuth(), isDarkNow() (+22 more)

### Community 19 - "CreditsPage.tsx"
Cohesion: 0.42
Nodes (8): CompanyPanel(), adjustCredits(), fetchCreditBalance(), fetchCreditLedger(), topupCredits(), CreditsPage(), getCols(), getPacks()

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 21 - "QueueRow.tsx"
Cohesion: 0.24
Nodes (14): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+6 more)

### Community 22 - "APInvoice.tsx"
Cohesion: 0.09
Nodes (22): APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props, VendorSearch(), CustomModal(), ModalType, Props (+14 more)

### Community 23 - "apInvoice.ts"
Cohesion: 0.09
Nodes (35): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+27 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.23
Nodes (19): EmailSettingsController, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call(), deleteToken() (+11 more)

### Community 25 - "useT"
Cohesion: 0.11
Nodes (31): PackList(), PendingOrderBanner(), EnterpriseCard(), _growthIcon, PlanCard(), PlanCardProps, TIER_ICONS, DEMO_BUYER (+23 more)

### Community 26 - "credits.ts"
Cohesion: 0.10
Nodes (39): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, Props, CheckoutPhase, CheckoutSession (+31 more)

### Community 27 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (39): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+31 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.06
Nodes (73): OrderKpiCards(), OrderWorkspace(), wsReducer(), Button(), ButtonProps, Variant, VARIANT_CLASS, Card() (+65 more)

### Community 29 - "ExtractionsPage.tsx"
Cohesion: 0.08
Nodes (32): DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, Switch(), SwitchProps (+24 more)

### Community 30 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (9): ACTIVITY_FILTERS, ReviewQueue, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, QueueEmpty(), ReviewQueue() (+1 more)

### Community 31 - "dict.ts"
Cohesion: 0.24
Nodes (7): BatchAction, BatchActionBar(), Props, DICT, en, th, translate()

### Community 32 - "TenantsPage.tsx"
Cohesion: 0.21
Nodes (11): KPICard(), KPICardProps, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantRow, funnel(), median() (+3 more)

### Community 33 - "UsageIndicator.tsx"
Cohesion: 0.16
Nodes (14): AppHeader(), ConsentGate(), Props, T, UsageIndicator(), COPY, Lang, Props (+6 more)

### Community 35 - "auth.ts"
Cohesion: 0.24
Nodes (8): base, Usage, ActiveSubscription, UsageData, API, computeUsageStats(), UsageStats, ExchangeResponse

### Community 36 - "useFileUpload.ts"
Cohesion: 0.14
Nodes (11): ACCEPTED, Props, SlipUpload(), FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview() (+3 more)

### Community 37 - "InputTaxReconciliation.tsx"
Cohesion: 0.10
Nodes (29): AccountingReview(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), OCR_BANK_MAP, fetchTaxProfiles(), submitInputTax(), APTaxType (+21 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 40 - "api.ts"
Cohesion: 0.14
Nodes (14): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExtractedAPInvoiceData (+6 more)

### Community 41 - "client.ts"
Cohesion: 0.14
Nodes (15): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+7 more)

### Community 42 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 43 - "OrderTable.tsx"
Cohesion: 0.16
Nodes (15): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+7 more)

### Community 44 - "draft.ts"
Cohesion: 0.44
Nodes (7): clearAllDrafts(), clearDraft(), DraftKind, Envelope, keyFor(), loadDraft(), saveDraft()

### Community 45 - "AuthContext.tsx"
Cohesion: 0.29
Nodes (10): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), getJwtExpMs(), clearAppStorage() (+2 more)

### Community 46 - "useAPExtraction.test.ts"
Cohesion: 0.18
Nodes (12): isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+4 more)

### Community 47 - "useMapping.ts"
Cohesion: 0.16
Nodes (27): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, MainMappingTable(), Props, PaymentTypeModal() (+19 more)

### Community 48 - "useOcrWizard.ts"
Cohesion: 0.18
Nodes (12): OcrDraftState, CcDraft, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), ApiError (+4 more)

### Community 49 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (44): Column, daysAgo(), endOfDay(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period (+36 more)

### Community 50 - "ReviewDocument.test.tsx"
Cohesion: 0.15
Nodes (8): LanguageProvider(), readLang(), BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 51 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 52 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 53 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 54 - "Skeleton.tsx"
Cohesion: 0.32
Nodes (6): Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 55 - "usePdfPasswordPrompt"
Cohesion: 0.60
Nodes (5): usePdfPasswordPrompt(), open(), prompt(), render(), submit()

### Community 56 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (11): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+3 more)

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (17): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+9 more)

### Community 58 - "reviewReasons.ts"
Cohesion: 0.40
Nodes (4): FIX, REASON_KEY, SETTINGS, WITH_DETAIL

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 63 - "useAPSubmission.ts"
Cohesion: 0.07
Nodes (40): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+32 more)

### Community 64 - "useOcrExtraction"
Cohesion: 0.15
Nodes (7): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), ExtractResult

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 67 - "LanguageContext.tsx"
Cohesion: 0.06
Nodes (33): slipIsPdf(), SlipViewer(), DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props (+25 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 73 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+2 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "showToast"
Cohesion: 0.18
Nodes (11): QueueSettings(), EmailRule, setAutoPost(), showToast(), ToastType, EmailSettings, BLOCKER_TEXT, copy() (+3 more)

### Community 77 - "parseNum"
Cohesion: 0.19
Nodes (15): APGroupModal(), profileLabel(), Props, TaxPctCell(), AMOUNT_FIELDS, DetailTable(), formatAmount(), Props (+7 more)

### Community 78 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

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

### Community 114 - "Mapping.tsx"
Cohesion: 0.33
Nodes (5): useMapping(), useMappingSuggestions(), PaymentTypesHook, usePaymentTypes(), Mapping()

## Knowledge Gaps
- **492 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+487 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `apiFetch`, `TutorialModal.tsx`, `ReviewDocument.tsx`, `EmailAutomationPage.tsx`, `AdminAuthContext.tsx`, `DataTable.tsx`, `TKey`, `useAPInvoice.ts`, `constants/index.ts`, `useAPExtraction.ts`, `OrderActions.tsx`, `OrderWorkspace.tsx`, `useOcrWizard`, `APAmountSummary.tsx`, `main.tsx`, `CreditsPage.tsx`, `QueueRow.tsx`, `APInvoice.tsx`, `apInvoice.ts`, `credits.ts`, `NotificationBell.tsx`, `adminClient.ts`, `ExtractionsPage.tsx`, `ReviewQueue.tsx`, `dict.ts`, `TenantsPage.tsx`, `UsageIndicator.tsx`, `useFileUpload.ts`, `InputTaxReconciliation.tsx`, `FeatureFlows.tsx`, `OrderTable.tsx`, `useAPExtraction.test.ts`, `useMapping.ts`, `PeriodPicker.tsx`, `ArCustomerProfiles.tsx`, `MetricChartImpl.tsx`, `useAPSubmission.ts`, `LanguageContext.tsx`, `MaintenanceGate.tsx`, `showToast`, `parseNum`, `Mapping.tsx`?**
  _High betweenness centrality (0.265) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `ReviewDocument.tsx`, `storage.ts`, `useAPInvoice.ts`, `useAPExtraction.ts`, `OrderWorkspace.tsx`, `useOcrWizard`, `credits.ts`, `NotificationBell.tsx`, `useFileUpload.ts`, `InputTaxReconciliation.tsx`, `api.ts`, `client.ts`, `useAPExtraction.test.ts`, `useOcrWizard.ts`, `useMappingData.ts`, `useOcrSubmission.test.ts`, `useAPSubmission.ts`, `useUserConsent.ts`, `showToast`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `useOcrExtraction`, `LanguageContext.tsx`, `useFileUpload.ts`, `storage.ts`, `useAPInvoice.ts`, `showToast`, `draft.ts`, `useOcrWizard.ts`, `usePdfPasswordPrompt`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _492 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `ReviewDocument.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11092436974789915 - nodes in this community are weakly interconnected._
- **Should `storage.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10121951219512196 - nodes in this community are weakly interconnected._