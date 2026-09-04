# Graph Report - OCR  (2026-09-04)

## Corpus Check
- 297 files · ~233,606 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1750 nodes · 4938 edges · 102 communities (88 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a5f00aa6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- apiFetch
- TutorialModal.tsx
- ReviewDocument.tsx
- dict.ts
- screens.tsx
- storage.ts
- Pager.tsx
- PeriodPicker.tsx
- parseNum
- ManualScan.tsx
- useAPExtraction.ts
- OrderActions.tsx
- ProformaDocument.tsx
- useOcrWizard
- banks.ts
- APAmountSummary.tsx
- compilerOptions
- 5. Components
- main.tsx
- OrderWorkspace.tsx
- devDependencies
- MainMappingTable.tsx
- APInvoice.tsx
- APReviewStep.tsx
- emailAutomation.ts
- Pricing.tsx
- credits.ts
- NotificationBell.tsx
- adminClient.ts
- EmailAutomationPage.tsx
- OrderHistory.tsx
- TKey
- api.ts
- getCarmenUrl
- OrderTable.test.tsx
- auth.ts
- useFileUpload.ts
- ccJv.ts
- dependencies
- CustomModal.tsx
- Home.tsx
- ProtectedRoute.tsx
- FeatureFlows.tsx
- OrderTable.tsx
- draft.ts
- AuthContext.tsx
- @types/react-dom
- useMapping.ts
- useOcrWizard.ts
- DataTable.tsx
- Button.tsx
- useAPExtraction.test.ts
- useT
- useOcrSubmission.test.ts
- CreditsPage.tsx
- scripts
- APTableRow.tsx
- TenantSelector.test.tsx
- useAPSubmission.ts
- useOcrExtraction.test.ts
- compilerOptions
- APLineItem
- DocumentPreview.tsx
- CLAUDE.md
- Contributing
- APAccountMappingStep.tsx
- client.ts
- useUserConsent.ts
- EmailSettings.tsx
- ArCustomerProfiles.tsx
- APGroupModal.tsx
- normalizeYearToCE
- PDFPageSelector
- AccountingReview.tsx
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
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- Mapping.tsx

## God Nodes (most connected - your core abstractions)
1. `useT()` - 229 edges
2. `apiFetch` - 56 edges
3. `adminFetch` - 53 edges
4. `parseNum()` - 42 edges
5. `fmt()` - 41 edges
6. `showToast()` - 33 edges
7. `appKey()` - 31 edges
8. `TKey` - 29 edges
9. `unwrapDetail()` - 28 edges
10. `useAPInvoice()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/components/admin/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
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

## Communities (102 total, 14 thin omitted)

### Community 0 - "apiFetch"
Cohesion: 0.05
Nodes (51): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow(), reasonFor() (+43 more)

### Community 1 - "TutorialModal.tsx"
Cohesion: 0.09
Nodes (31): OrderDrawer(), PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, Spot(), SpotContext, SpotProvider (+23 more)

### Community 2 - "ReviewDocument.tsx"
Cohesion: 0.17
Nodes (19): Props, DetailRow, Props, BlockReason, JvEditor(), JvState, Overrides, Props (+11 more)

### Community 3 - "dict.ts"
Cohesion: 0.20
Nodes (9): APUploadStep(), INSTRUCTIONS, Props, DICT, en, Lang, th, translate() (+1 more)

### Community 4 - "screens.tsx"
Cohesion: 0.12
Nodes (18): DEFAULT_STEPS, Props, Step, StepWizard(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO (+10 more)

### Community 5 - "storage.ts"
Cohesion: 0.13
Nodes (23): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+15 more)

### Community 6 - "Pager.tsx"
Cohesion: 0.24
Nodes (6): Props, SIZE_OPTIONS, readRowsPerPage(), ROWS_PER_PAGE, useRowsPerPage(), writeRowsPerPage()

### Community 7 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (31): Column, granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+23 more)

### Community 8 - "parseNum"
Cohesion: 0.15
Nodes (25): AmountSummary(), InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), Amount(), getAvailableFields(), OCR_BANK_MAP, adjustField() (+17 more)

### Community 9 - "ManualScan.tsx"
Cohesion: 0.15
Nodes (16): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+8 more)

### Community 10 - "useAPExtraction.ts"
Cohesion: 0.12
Nodes (24): APExtractionProps, EXTRACTION_STAGES, isNumFld(), NUMERIC_FIELDS, useAPExtraction(), useAPInvoice(), APSubmissionProps, APVendorProps (+16 more)

### Community 11 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 12 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 13 - "useOcrWizard"
Cohesion: 0.14
Nodes (20): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+12 more)

### Community 14 - "banks.ts"
Cohesion: 0.15
Nodes (17): Props, TopLevelConfigSection(), BANK_CODE_MAP, BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP, BankEntry, BankInfo (+9 more)

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
Nodes (46): AdminProtectedRoute(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), ErrorBoundary, Props, State, LanguageToggle() (+38 more)

### Community 19 - "OrderWorkspace.tsx"
Cohesion: 0.15
Nodes (16): Props, Props, ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction, wsInitial (+8 more)

### Community 20 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint, @eslint/js, devDependencies, autoprefixer, eslint, @eslint/js, globals (+15 more)

### Community 21 - "MainMappingTable.tsx"
Cohesion: 0.12
Nodes (24): AccountMappingTable(), GLAccount, Props, AISuggestBar(), Props, CustomSearchSelect(), Props, SelectOption (+16 more)

### Community 22 - "APInvoice.tsx"
Cohesion: 0.19
Nodes (12): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, AP_STEPS, APFieldKey, APStep, DEFAULT_MAPPINGS (+4 more)

### Community 23 - "APReviewStep.tsx"
Cohesion: 0.16
Nodes (18): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+10 more)

### Community 24 - "emailAutomation.ts"
Cohesion: 0.23
Nodes (19): EmailSettingsController, toPayloadRules(), useEmailSettings(), getCarmenRawToken(), ApiFieldError, BankCode, call(), deleteToken() (+11 more)

### Community 25 - "Pricing.tsx"
Cohesion: 0.13
Nodes (28): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PackList(), Props, EnterpriseCard() (+20 more)

### Community 26 - "credits.ts"
Cohesion: 0.13
Nodes (26): CheckoutPhase, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), useCheckout, OPEN_STATUSES (+18 more)

### Community 27 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (43): docLabel(), NotificationBell(), notifText(), releaseCopy(), failedRow, items, markRead, orderRow (+35 more)

### Community 28 - "adminClient.ts"
Cohesion: 0.08
Nodes (65): OrderKpiCards(), useOrderActions(), withName(), adminFetch, AdminOrderStatus, AdminUserRow, approveOrder(), buildQs() (+57 more)

### Community 29 - "EmailAutomationPage.tsx"
Cohesion: 0.07
Nodes (41): KPICard(), KPICardProps, Card(), CardProps, EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps (+33 more)

### Community 30 - "OrderHistory.tsx"
Cohesion: 0.11
Nodes (23): MAP, OrderStatusBadge(), OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState (+15 more)

### Community 31 - "TKey"
Cohesion: 0.18
Nodes (10): BatchAction, BatchActionBar(), Props, INSTRUCTIONS, Props, UploadSection(), TKey, NavItem (+2 more)

### Community 32 - "api.ts"
Cohesion: 0.17
Nodes (11): AccountingConfigRequest, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse, ExtractedAPInvoiceData, ExtractedCreditCardData (+3 more)

### Community 33 - "getCarmenUrl"
Cohesion: 0.12
Nodes (19): APSuccessStep(), Props, VendorSearch(), AppHeader(), AuthScreen(), Coords, getCoords(), Props (+11 more)

### Community 35 - "auth.ts"
Cohesion: 0.28
Nodes (8): T, base, Usage, UsageIndicator(), getUsage(), UsageData, computeUsageStats(), UsageStats

### Community 36 - "useFileUpload.ts"
Cohesion: 0.17
Nodes (9): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl() (+1 more)

### Community 37 - "ccJv.ts"
Cohesion: 0.14
Nodes (17): codeToSource(), CONFIG, leg(), rows(), TWO_LINES, buildGljvPayload(), buildJvRows(), COLUMN_FOR_KEY (+9 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 39 - "CustomModal.tsx"
Cohesion: 0.29
Nodes (5): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG

### Community 40 - "Home.tsx"
Cohesion: 0.24
Nodes (8): seen, useEntrance(), ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES

### Community 41 - "ProtectedRoute.tsx"
Cohesion: 0.16
Nodes (15): ConsentGate(), Props, AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired() (+7 more)

### Community 42 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 43 - "OrderTable.tsx"
Cohesion: 0.16
Nodes (15): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+7 more)

### Community 44 - "draft.ts"
Cohesion: 0.50
Nodes (6): clearDraft(), DraftKind, Envelope, keyFor(), loadDraft(), saveDraft()

### Community 45 - "AuthContext.tsx"
Cohesion: 0.27
Nodes (11): AuthContext, AuthContextValue, AuthProvider(), revokeSession(), clearToken(), storeToken(), clearAllDrafts(), getJwtExpMs() (+3 more)

### Community 47 - "useMapping.ts"
Cohesion: 0.20
Nodes (16): useBankConfig(), COMPANY_REQUIRED_FIELDS, useMapping(), MappingSuggestionsHook, useMappingSuggestions(), PaymentTypesHook, usePaymentTypes(), saveAccountingConfig() (+8 more)

### Community 48 - "useOcrWizard.ts"
Cohesion: 0.15
Nodes (16): OcrDraftState, CcDraft, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+8 more)

### Community 49 - "DataTable.tsx"
Cohesion: 0.08
Nodes (51): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, daysAgo() (+43 more)

### Community 52 - "Button.tsx"
Cohesion: 0.40
Nodes (4): Button(), ButtonProps, Variant, VARIANT_CLASS

### Community 55 - "useAPExtraction.test.ts"
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 56 - "useT"
Cohesion: 0.10
Nodes (22): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+14 more)

### Community 57 - "useOcrSubmission.test.ts"
Cohesion: 0.11
Nodes (24): OcrExtractionProps, OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig (+16 more)

### Community 58 - "CreditsPage.tsx"
Cohesion: 0.24
Nodes (12): CompanyPanel(), label(), Tenant, TenantSelector(), TenantSelectorProps, adjustCredits(), fetchCreditBalance(), fetchCreditLedger() (+4 more)

### Community 59 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+5 more)

### Community 60 - "APTableRow.tsx"
Cohesion: 0.21
Nodes (9): APTableRow(), FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props (+1 more)

### Community 63 - "useAPSubmission.ts"
Cohesion: 0.12
Nodes (29): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+21 more)

### Community 64 - "useOcrExtraction.test.ts"
Cohesion: 0.29
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult

### Community 65 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 66 - "APLineItem"
Cohesion: 0.25
Nodes (11): Props, Props, APInvoiceHeader, APDraftState, ApDraft, APValidationProps, addDays(), buildInvoicePayload() (+3 more)

### Community 67 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 70 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 71 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 72 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 73 - "client.ts"
Cohesion: 0.18
Nodes (16): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+8 more)

### Community 74 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent(), getConsentStatus(), postConsent()

### Community 75 - "EmailSettings.tsx"
Cohesion: 0.25
Nodes (6): EmailRule, EmailSettings, BLOCKER_TEXT, copy(), EmailSettings(), EMPTY_RULE

### Community 76 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer(), initialState, ArCustomerProfile, listArProfiles(), syncArProfiles() (+1 more)

### Community 77 - "APGroupModal.tsx"
Cohesion: 0.38
Nodes (7): APGroupModal(), profileLabel(), Props, apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 78 - "normalizeYearToCE"
Cohesion: 0.23
Nodes (9): DateInput(), DateInputProps, DATE_KEYS, HeaderCard(), Props, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+1 more)

### Community 79 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 80 - "AccountingReview.tsx"
Cohesion: 0.15
Nodes (13): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps (+5 more)

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
Cohesion: 0.27
Nodes (7): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, CompanyData, Mapping, Mapping()

## Knowledge Gaps
- **492 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+487 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `apiFetch`, `TutorialModal.tsx`, `ReviewDocument.tsx`, `dict.ts`, `screens.tsx`, `Pager.tsx`, `PeriodPicker.tsx`, `parseNum`, `ManualScan.tsx`, `useAPExtraction.ts`, `OrderActions.tsx`, `ProformaDocument.tsx`, `useOcrWizard`, `APAmountSummary.tsx`, `main.tsx`, `OrderWorkspace.tsx`, `MainMappingTable.tsx`, `APInvoice.tsx`, `APReviewStep.tsx`, `Pricing.tsx`, `credits.ts`, `NotificationBell.tsx`, `adminClient.ts`, `EmailAutomationPage.tsx`, `OrderHistory.tsx`, `TKey`, `getCarmenUrl`, `auth.ts`, `CustomModal.tsx`, `Home.tsx`, `FeatureFlows.tsx`, `OrderTable.tsx`, `DataTable.tsx`, `CreditsPage.tsx`, `APLineItem`, `DocumentPreview.tsx`, `APAccountMappingStep.tsx`, `client.ts`, `ArCustomerProfiles.tsx`, `APGroupModal.tsx`, `normalizeYearToCE`, `AccountingReview.tsx`, `Mapping.tsx`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `showToast()` connect `useAPExtraction.ts` to `useOcrExtraction.test.ts`, `apiFetch`, `ReviewDocument.tsx`, `useFileUpload.ts`, `storage.ts`, `EmailSettings.tsx`, `AuthContext.tsx`, `useOcrWizard`, `useOcrWizard.ts`, `useT`, `useOcrSubmission.test.ts`, `useAPSubmission.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useFileUpload.ts`, `storage.ts`, `parseNum`, `client.ts`, `useAPExtraction.ts`, `useUserConsent.ts`, `useOcrWizard`, `useMapping.ts`, `useOcrWizard.ts`, `useAPExtraction.test.ts`, `useOcrSubmission.test.ts`, `credits.ts`, `NotificationBell.tsx`, `OrderHistory.tsx`, `useAPSubmission.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _492 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `apiFetch` be split into smaller, more focused modules?**
  _Cohesion score 0.05267778753292362 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08599033816425121 - nodes in this community are weakly interconnected._
- **Should `screens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._