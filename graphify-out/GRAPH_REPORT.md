# Graph Report - OCR  (2026-09-28)

## Corpus Check
- 371 files · ~253,324 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1964 nodes · 5361 edges · 147 communities (102 shown, 45 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2aa9770`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- unwrapDetail
- APInvoice.tsx
- dict/index.ts
- useAPSubmission.ts
- ManualScan.tsx
- DataTable.tsx
- parseNum
- TutorialModal.tsx
- useT
- api.ts
- Home.tsx
- adminFetch
- CustomModal.tsx
- shared/api/credits.ts
- useMapping.ts
- useOcrSubmission.test.ts
- AccountingReview.tsx
- PlanCard.tsx
- formatThb
- MainMappingTable.tsx
- JvEditor.tsx
- compilerOptions
- 5. Components
- bankTransforms.ts
- ExtractionsPage.tsx
- PendingOrderBanner.tsx
- devDependencies
- useOcrExtraction.ts
- endpoints.ts
- useMappingData.ts
- useOcrWizard
- OrderActions.tsx
- dependencies
- ReviewQueue.tsx
- emailReview.ts
- TopLevelConfigSection.tsx
- CreditsPage.tsx
- FeatureFlows.tsx
- getCarmenUrl
- useNotifications.ts
- useAPExtraction.ts
- CheckoutFlow.tsx
- OrderWorkspace.tsx
- ReviewDocument.tsx
- useReviewDocument.ts
- useAuth
- EmailAutomationPage.tsx
- NotificationBell.tsx
- usePdfPasswordPrompt
- ProtectedRoute.tsx
- scripts
- DocumentPreview.tsx
- APAccountMappingStep.tsx
- ArCustomerProfiles.tsx
- compilerOptions
- PeriodPicker.tsx
- OrderStatusBadge.tsx
- shared/api/auth.ts
- CLAUDE.md
- Contributing
- eslint
- MetricChartImpl.tsx
- main.tsx
- adminAuth.ts
- APLineItem
- Carmen AI — OCR & Import System
- useUserConsent.ts
- Pricing.tsx
- banks.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- client.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- Skeleton.tsx
- Mapping.tsx
- vercel.json
- Architecture
- useOcrWizard.ts
- setup.ts
- AuthContext.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Tooltip.tsx
- LanguageContext.tsx
- postcss
- jsdom
- @testing-library/react
- @testing-library/dom
- NotificationDetailModal.tsx
- typescript
- @typescript-eslint/eslint-plugin
- vitest
- vite-env.d.ts
- QueueRow.tsx
- mockPaths.test.ts
- OrderTable.tsx
- Pager.tsx
- i18n/index.ts
- emailAutomation.ts
- anomalies.ts
- chrome.ts
- eslint-plugin-react-hooks
- i18n/common.ts
- i18n/credits.ts
- extractions.ts
- performance.ts
- quotas.ts
- OrderDrawer.tsx
- contact.ts
- flows.ts
- dict/maintenance.ts
- ReviewDocument.test.tsx
- LanguageProvider
- notif.ts
- NumericInput.tsx
- quota.ts
- i18n/email.ts
- errors.ts
- whatsnew.ts
- jobs.ts
- llmLogs.ts
- login.ts
- i18n/maintenance.ts
- i18n/nav.ts
- overview.ts
- sessions.ts
- tenantRanking.ts
- i18n/tenants.ts
- i18n/usage.ts
- userUsage.ts
- dict/ap.ts
- checkout.ts
- home.ts
- plan.ts
- proforma.ts
- warn.ts
- @testing-library/jest-dom

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
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `NavItem` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `NavSection` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (147 total, 45 thin omitted)

### Community 0 - "unwrapDetail"
Cohesion: 0.11
Nodes (30): unwrapDetail(), fetchQuotaOverview(), toggleTenantModule(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles() (+22 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.07
Nodes (50): Props, Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APFieldMappingStep() (+42 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.04
Nodes (32): en, th, en, th, DICT, en, th, translate() (+24 more)

### Community 3 - "useAPSubmission.ts"
Cohesion: 0.10
Nodes (28): Args, APExtractionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments (+20 more)

### Community 4 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (16): BankDetectionBanner(), AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS, HeaderCard() (+8 more)

### Community 5 - "DataTable.tsx"
Cohesion: 0.07
Nodes (47): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchTenantDetail(), fetchPerformanceLogs(), fetchUserUsage() (+39 more)

### Community 6 - "parseNum"
Cohesion: 0.19
Nodes (24): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+16 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (27): PURCHASE_TUTORIAL, PurchaseStep, PurchaseTutorial(), PURCHASE_FIGURE_WIDTHS, PURCHASE_FIGURES, FOCUS_STEPS, PurchaseTutorial, Spot() (+19 more)

### Community 8 - "useT"
Cohesion: 0.16
Nodes (17): ContactBuyer(), DEMO_BUYER, DEMO_ORDER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_PROFORMA, DEMO_SLIP (+9 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (21): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, MappingSuggestionsHook, useMappingSuggestions(), PaymentTypesHook, AccountingConfigHook (+13 more)

### Community 10 - "Home.tsx"
Cohesion: 0.13
Nodes (14): OrderReviewShell(), ACTIVE_TAG, containerVariants, Home(), itemVariants, MODULES, registerDict(), OrderReviewShell (+6 more)

### Community 11 - "adminFetch"
Cohesion: 0.18
Nodes (22): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+14 more)

### Community 12 - "CustomModal.tsx"
Cohesion: 0.21
Nodes (8): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker(), useScrollLock()

### Community 13 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (29): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+21 more)

### Community 14 - "useMapping.ts"
Cohesion: 0.14
Nodes (26): getAccountingConfig, seedOcrBranch(), useBankConfig(), COMPANY_REQUIRED_FIELDS, getAccountingConfig, useMapping(), usePaymentTypes(), MAIN_KEYS (+18 more)

### Community 15 - "useOcrSubmission.test.ts"
Cohesion: 0.13
Nodes (20): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), mapFieldName(), CarmenJvPayload, defaultConfig, defaultRows (+12 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.10
Nodes (29): ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, DetailRow, InputTaxPanel(), Props, InputTaxReconciliation(), handleAddInputTax() (+21 more)

### Community 17 - "PlanCard.tsx"
Cohesion: 0.18
Nodes (13): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+5 more)

### Community 18 - "formatThb"
Cohesion: 0.24
Nodes (13): num(), VerifyFacts(), expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords(), formatThb() (+5 more)

### Community 19 - "MainMappingTable.tsx"
Cohesion: 0.33
Nodes (9): Props, Props, ActiveScan, MainMappings, MainMappingKey, Suggestion, SuggestionSource, AISuggestBar() (+1 more)

### Community 20 - "JvEditor.tsx"
Cohesion: 0.15
Nodes (19): AccountMappingTable(), GLAccount, Props, BlockReason, BU_WIDE, JvEditor(), Overrides, rowId() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "bankTransforms.ts"
Cohesion: 0.39
Nodes (6): codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape()

### Community 24 - "ExtractionsPage.tsx"
Cohesion: 0.16
Nodes (17): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, causeLabel() (+9 more)

### Community 25 - "PendingOrderBanner.tsx"
Cohesion: 0.21
Nodes (17): CheckoutFlow(), OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode() (+9 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, prettier, @types/node (+15 more)

### Community 27 - "useOcrExtraction.ts"
Cohesion: 0.14
Nodes (17): DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, extractFromFile, MOCK_EXTRACTED, MOCK_FILE (+9 more)

### Community 28 - "endpoints.ts"
Cohesion: 0.15
Nodes (21): QueryParams, endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), ModuleCatalogEntry, ModuleUsageRow (+13 more)

### Community 29 - "useMappingData.ts"
Cohesion: 0.26
Nodes (14): JvHeaderCard(), Props, GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterAccount, MasterDepartment (+6 more)

### Community 30 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 31 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "ReviewQueue.tsx"
Cohesion: 0.17
Nodes (12): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+4 more)

### Community 34 - "emailReview.ts"
Cohesion: 0.20
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.17
Nodes (10): BANK_OPTIONS, Props, TopLevelConfigSection(), BankConfigHook, NormalizedConfig, CustomSearchSelect(), Props, SelectOption (+2 more)

### Community 36 - "CreditsPage.tsx"
Cohesion: 0.16
Nodes (16): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), topupCredits(), CompanyPanel(), label() (+8 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "getCarmenUrl"
Cohesion: 0.23
Nodes (10): RowAction(), AppHeader(), COPY, Lang, Props, useIsMobile(), UserConsentModal(), getCarmenUri() (+2 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.13
Nodes (20): WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote (+12 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.09
Nodes (30): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping, getPdfInfo, getUsage (+22 more)

### Community 41 - "CheckoutFlow.tsx"
Cohesion: 0.14
Nodes (12): itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP, DEFAULT_STEPS (+4 more)

### Community 42 - "OrderWorkspace.tsx"
Cohesion: 0.20
Nodes (11): fetchAdminOrderDocuments(), getOrderSlipUrl(), OrderWorkspace(), WsAction, wsInitial, wsReducer(), slipIsPdf(), SlipViewer() (+3 more)

### Community 43 - "ReviewDocument.tsx"
Cohesion: 0.21
Nodes (11): Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), Props, FIX, fixLinkProps(), REASON_KEY (+3 more)

### Community 44 - "useReviewDocument.ts"
Cohesion: 0.13
Nodes (21): approveDocument(), getPending(), rejectDocument(), JvState, Props, OcrSubmissionHook, useReviewDocument(), approve() (+13 more)

### Community 45 - "useAuth"
Cohesion: 0.28
Nodes (6): ConsentGate(), Props, A, B, Probe(), useAuth()

### Community 46 - "EmailAutomationPage.tsx"
Cohesion: 0.17
Nodes (21): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+13 more)

### Community 47 - "NotificationBell.tsx"
Cohesion: 0.28
Nodes (11): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), TFn (+3 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 49 - "ProtectedRoute.tsx"
Cohesion: 0.17
Nodes (13): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+5 more)

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
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.10
Nodes (42): buildQs(), fetchErrorBreakdown(), fetchLLMLogs(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), Column, LazyMetricChart (+34 more)

### Community 56 - "OrderStatusBadge.tsx"
Cohesion: 0.50
Nodes (3): MAP, OrderStatusBadge(), OrderStatus

### Community 57 - "shared/api/auth.ts"
Cohesion: 0.26
Nodes (8): UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats, ExchangeResponse

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "MetricChartImpl.tsx"
Cohesion: 0.22
Nodes (8): axisTick, ChartType, FALLBACK_COLORS, MetricChart(), Series, tooltipItemStyle, tooltipLabelStyle, tooltipStyle

### Community 62 - "main.tsx"
Cohesion: 0.11
Nodes (12): APInvoice, container, getRoute(), Home, ManualScan, OrderHistory, Pricing, Router() (+4 more)

### Community 63 - "adminAuth.ts"
Cohesion: 0.12
Nodes (26): adminLogin(), AdminLoginError, LoginResponse, AdminLayout(), getActiveHash(), AdminLogin(), classify(), LoginError (+18 more)

### Community 64 - "APLineItem"
Cohesion: 0.22
Nodes (13): APGroupModal(), profileLabel(), Props, ApDraft, APDraftState, Args, useAPGrouping(), APValidationProps (+5 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 67 - "Pricing.tsx"
Cohesion: 0.14
Nodes (16): PendingOrderBanner(), SLIP, SALES_CONTACT, useOrderHistory(), OrderHistory(), parseFocusId(), cardVariants, ContactDialog() (+8 more)

### Community 68 - "banks.ts"
Cohesion: 0.23
Nodes (12): BANK_LOGOS, Props, persistScanForMapping(), BANK_KEYWORDS, BANK_THAI_NAMES, BankEntry, BankInfo, BANKS (+4 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "client.ts"
Cohesion: 0.20
Nodes (14): API_BASE, ApiClientOptions, createApiClient(), fetchTimeout(), resolveUrl(), countdown(), EMPTY, fmtHM() (+6 more)

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

### Community 77 - "Mapping.tsx"
Cohesion: 0.19
Nodes (10): CompanyInfoSection(), PLACEHOLDER_MAP, Props, RequiredField, OcrExtractionProps, OcrSubmissionProps, CompanyData, Mapping() (+2 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "useOcrWizard.ts"
Cohesion: 0.30
Nodes (10): useAPDraft(), mountRestored(), TAX_PROFILES, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 82 - "AuthContext.tsx"
Cohesion: 0.26
Nodes (11): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), clearAllDrafts(), getJwtExpMs() (+3 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 88 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (17): BatchAction, BatchActionBar(), Props, APUploadStep(), INSTRUCTIONS, Props, INSTRUCTIONS, Props (+9 more)

### Community 93 - "NotificationDetailModal.tsx"
Cohesion: 0.16
Nodes (11): BellItem, Notification, failedRow, items, markRead, orderRow, postedRow, releaseRow (+3 more)

### Community 103 - "QueueRow.tsx"
Cohesion: 0.29
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "OrderTable.tsx"
Cohesion: 0.21
Nodes (11): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+3 more)

### Community 106 - "Pager.tsx"
Cohesion: 0.18
Nodes (7): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, Props, SIZE_OPTIONS, ROWS_PER_PAGE

### Community 107 - "i18n/index.ts"
Cohesion: 0.40
Nodes (3): en, th, AdminKey

### Community 108 - "emailAutomation.ts"
Cohesion: 0.14
Nodes (26): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailRule, EmailRulePayload, EmailSettings (+18 more)

### Community 117 - "OrderDrawer.tsx"
Cohesion: 0.24
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, many(), order(), WsState, PaymentInfo

### Community 121 - "ReviewDocument.test.tsx"
Cohesion: 0.18
Nodes (6): BENT, EXTRACTED, LINE, onClose, onDone, TWO_VISA

### Community 122 - "LanguageProvider"
Cohesion: 0.29
Nodes (4): QUIET, ZERO, LanguageProvider(), readLang()

### Community 124 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

## Knowledge Gaps
- **598 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+593 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `unwrapDetail`, `APInvoice.tsx`, `useAPSubmission.ts`, `ManualScan.tsx`, `DataTable.tsx`, `parseNum`, `TutorialModal.tsx`, `Home.tsx`, `adminFetch`, `CustomModal.tsx`, `shared/api/credits.ts`, `AccountingReview.tsx`, `PlanCard.tsx`, `formatThb`, `MainMappingTable.tsx`, `JvEditor.tsx`, `ExtractionsPage.tsx`, `PendingOrderBanner.tsx`, `endpoints.ts`, `useMappingData.ts`, `useOcrWizard`, `OrderActions.tsx`, `ReviewQueue.tsx`, `TopLevelConfigSection.tsx`, `CreditsPage.tsx`, `FeatureFlows.tsx`, `getCarmenUrl`, `useNotifications.ts`, `useAPExtraction.ts`, `CheckoutFlow.tsx`, `OrderWorkspace.tsx`, `ReviewDocument.tsx`, `useReviewDocument.ts`, `EmailAutomationPage.tsx`, `NotificationBell.tsx`, `DocumentPreview.tsx`, `APAccountMappingStep.tsx`, `ArCustomerProfiles.tsx`, `PeriodPicker.tsx`, `OrderStatusBadge.tsx`, `shared/api/auth.ts`, `MetricChartImpl.tsx`, `adminAuth.ts`, `APLineItem`, `Pricing.tsx`, `banks.ts`, `client.ts`, `Mapping.tsx`, `LanguageContext.tsx`, `NotificationDetailModal.tsx`, `QueueRow.tsx`, `OrderTable.tsx`, `Pager.tsx`, `OrderDrawer.tsx`?**
  _High betweenness centrality (0.274) - this node is a cross-community bridge._
- **Why does `appKey()` connect `useMapping.ts` to `banks.ts`, `ManualScan.tsx`, `parseNum`, `useAPExtraction.ts`, `useAuth`, `useOcrSubmission.test.ts`, `useOcrWizard.ts`, `AuthContext.tsx`, `useOcrExtraction.ts`, `useOcrWizard`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `API` connect `endpoints.ts` to `unwrapDetail`, `useAPSubmission.ts`, `DataTable.tsx`, `api.ts`, `adminFetch`, `shared/api/credits.ts`, `useMapping.ts`, `useOcrSubmission.test.ts`, `AccountingReview.tsx`, `useOcrExtraction.ts`, `emailReview.ts`, `CreditsPage.tsx`, `useAPExtraction.ts`, `EmailAutomationPage.tsx`, `PeriodPicker.tsx`, `shared/api/auth.ts`, `adminAuth.ts`, `useUserConsent.ts`, `NotificationDetailModal.tsx`, `emailAutomation.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _598 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `unwrapDetail` be split into smaller, more focused modules?**
  _Cohesion score 0.11095305832147938 - nodes in this community are weakly interconnected._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06526806526806526 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._