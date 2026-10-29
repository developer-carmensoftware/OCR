# Graph Report - OCR  (2026-10-29)

## Corpus Check
- 421 files · ~309,249 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2242 nodes · 6259 edges · 157 communities (108 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `259732f6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CustomSearchSelect.tsx
- APReviewStep.tsx
- dict/index.ts
- ccJv.ts
- appKey
- PmsReviewDocument.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- useOcrWizard.ts
- useMapping.ts
- orders.ts
- useReviewDocument.ts
- useSettlementMapping.ts
- useT
- EmailAutomationPage
- Mapping.tsx
- MainMappingTable.tsx
- useOcrExtraction.test.ts
- ApiKeysPage.tsx
- banks.ts
- compilerOptions
- 5. Components
- useFileUpload.ts
- AdminLogin.tsx
- emailReview.ts
- devDependencies
- shared/api/credits.ts
- PeriodPicker.tsx
- adminFetch
- admin/api/credits.ts
- useAuth
- dependencies
- ManualScan.tsx
- useAPInvoice.ts
- AdminRouter.tsx
- EmailAutomationPage.tsx
- FeatureFlows.tsx
- formatThb
- NotificationBell.tsx
- useOcrWizard
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- DateInput.tsx
- useEmailSettings.ts
- DataTable.tsx
- QueueRow.tsx
- useMappingData.ts
- ReviewQueue.tsx
- adminAuth.ts
- scripts
- api.ts
- APTableRow.tsx
- PendingOrderBanner.tsx
- compilerOptions
- OrderWorkspace.tsx
- ReviewDocument.tsx
- QueueRow.test.tsx
- CLAUDE.md
- Contributing
- FieldMapping
- AccountingReview.tsx
- contact.ts
- EmailSettings.tsx
- TKey
- Carmen AI — OCR & Import System
- APInvoice.tsx
- APAmountSummary.tsx
- i18n/nav.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- MaintenancePage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderActions.tsx
- apiFetch
- vercel.json
- Architecture
- overview.ts
- OrderHistory.tsx
- Mapping.test.tsx
- reviewReasons.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- storage.ts
- main.tsx
- client.ts
- i18n/index.ts
- APGroupModal.tsx
- EmailSettings.test.tsx
- useAPExtraction.ts
- CheckoutFlow.tsx
- checkout.ts
- vite-env.d.ts
- eslint
- mockPaths.test.ts
- useAPExtraction
- cc.ts
- typescript
- dict/maintenance.ts
- orev.ts
- pms.ts
- flows.ts
- proforma.ts
- quota.ts
- pricing.ts
- unwrapDetail
- warn.ts
- @testing-library/dom
- @testing-library/react
- APLineItem
- MaintenanceGate.tsx
- TenantsPage.tsx
- TenantSelector.test.tsx
- ar.ts
- UserConsentModal.tsx
- ExtractionsPage.tsx
- adminUsers.ts
- dict/common.ts
- anomalies.ts
- chrome.ts
- i18n/credits.ts
- home.ts
- @types/react-dom
- errors.ts
- login.ts
- i18n/maintenance.ts
- i18n/quotas.ts
- i18n/usage.ts
- ApiKeysPage.test.tsx
- APAccountMappingStep.tsx
- vite
- postcss
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- dict/usage.ts
- whatsnew.ts
- @types/react
- notif.ts
- jsdom

## God Nodes (most connected - your core abstractions)
1. `useT()` - 258 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 65 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 37 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `round2()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Args` --references--> `useAPExtraction()`  [EXTRACTED]
  frontend/src/features/ap-invoice/hooks/useAPGrouping.ts → frontend/src/features/ap-invoice/hooks/useAPExtraction.ts

## Import Cycles
- None detected.

## Communities (157 total, 49 thin omitted)

### Community 0 - "CustomSearchSelect.tsx"
Cohesion: 0.19
Nodes (8): Props, CustomSearchSelect(), handleScroll(), panelStyle(), Props, SelectOption, OPTIONS, TopChoice

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.05
Nodes (28): en, th, en, th, DICT, en, th, translate() (+20 more)

### Community 3 - "ccJv.ts"
Cohesion: 0.12
Nodes (23): AccountingReview(), JvHeaderCard(), TopLevelConfigSection(), codeToSource(), descriptionForBank(), CONFIG, leg(), rows() (+15 more)

### Community 4 - "appKey"
Cohesion: 0.16
Nodes (18): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+10 more)

### Community 5 - "PmsReviewDocument.tsx"
Cohesion: 0.14
Nodes (11): dmy(), PmsReviewDocument(), Props, DAY, weekday(), Dialog(), DialogProps, focusablesIn() (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.13
Nodes (31): AmountSummary(), getAvailableFields(), adjustField(), DocRepair, EMPTY_HEADER, header(), masterReconcile(), runAdjust() (+23 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (31): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+23 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.17
Nodes (15): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), inputTaxOwed(), draftWorthOffering(), owed, clearAllDrafts() (+7 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.14
Nodes (20): saveARSettings(), suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, COMPANY_FIELDS, rulesPrint(), getAccountingConfig (+12 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "useReviewDocument.ts"
Cohesion: 0.15
Nodes (22): ItxOverrides, Props, DetailRow, Props, Props, BlockReason, BU_WIDE, JvEditor() (+14 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.18
Nodes (17): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+9 more)

### Community 14 - "useT"
Cohesion: 0.07
Nodes (35): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+27 more)

### Community 15 - "EmailAutomationPage"
Cohesion: 0.20
Nodes (13): EmailPollResult, fetchEmailBusinessUnits(), fetchEmailHealth(), pollEmailNow(), sweepEmailConfirmations(), cronTone(), pollMessage(), REASON_CODES (+5 more)

### Community 16 - "Mapping.tsx"
Cohesion: 0.14
Nodes (18): POST_TYPES, CompanyInfoSection(), PLACEHOLDER_KEYS, Props, MappingTable(), Filter, orderOf(), PaymentMappingDialog() (+10 more)

### Community 17 - "MainMappingTable.tsx"
Cohesion: 0.17
Nodes (17): AccountMappingTable(), GLAccount, MainMappingTable(), Props, BulkApplyBar(), MainMappings, MainMappingKey, SuggestionSource (+9 more)

### Community 18 - "useOcrExtraction.test.ts"
Cohesion: 0.29
Nodes (6): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractResult

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.16
Nodes (20): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow, FeedStatus, pmsEventsUrl() (+12 more)

### Community 20 - "banks.ts"
Cohesion: 0.16
Nodes (19): bankCodeFromHash(), BankConfigHook, useBankConfig(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useFileUpload.ts"
Cohesion: 0.18
Nodes (8): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.30
Nodes (8): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 25 - "emailReview.ts"
Cohesion: 0.14
Nodes (19): ActivityFilter, ALL_SCOPES, approveDocument(), ApproveResult, getPending(), LateInputTaxBody, listActivity(), markInputTaxKeyed() (+11 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, eslint-plugin-react-hooks, devDependencies, autoprefixer, @eslint/js, eslint-plugin-react-hooks, globals (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.16
Nodes (20): RowState, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+12 more)

### Community 28 - "PeriodPicker.tsx"
Cohesion: 0.16
Nodes (23): daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker() (+15 more)

### Community 29 - "adminFetch"
Cohesion: 0.11
Nodes (36): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth (+28 more)

### Community 30 - "admin/api/credits.ts"
Cohesion: 0.19
Nodes (13): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+5 more)

### Community 31 - "useAuth"
Cohesion: 0.17
Nodes (15): getConsentStatus(), postConsent(), AppHeader(), ConsentGate(), Props, AuthUser, A, B (+7 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (21): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+13 more)

### Community 34 - "useAPInvoice.ts"
Cohesion: 0.09
Nodes (32): Args, APExtractionProps, useAPInvoice(), APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload (+24 more)

### Community 35 - "AdminRouter.tsx"
Cohesion: 0.24
Nodes (11): AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS (+3 more)

### Community 36 - "EmailAutomationPage.tsx"
Cohesion: 0.12
Nodes (24): fetchAlerts(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps (+16 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "formatThb"
Cohesion: 0.22
Nodes (14): num(), VerifyFacts(), BillingFigure(), expiryDate(), num(), ProformaDocument(), TITLE, bahtToEnglishWords() (+6 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (40): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+32 more)

### Community 40 - "useOcrWizard"
Cohesion: 0.13
Nodes (22): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), getPdfInfoWithRetry() (+14 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "DateInput.tsx"
Cohesion: 0.43
Nodes (5): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), parseDDMMYYYYToDate()

### Community 44 - "useEmailSettings.ts"
Cohesion: 0.15
Nodes (27): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRulePayload, EmailSettings (+19 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.09
Nodes (39): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, endOfDay() (+31 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.27
Nodes (12): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+4 more)

### Community 47 - "useMappingData.ts"
Cohesion: 0.20
Nodes (21): MappingRow(), Props, Props, Props, STATUS_LABEL, Props, MappingSet, MappingStatus (+13 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.13
Nodes (13): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), pmsIdFromHash(), QueueEmpty() (+5 more)

### Community 49 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "api.ts"
Cohesion: 0.07
Nodes (31): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+23 more)

### Community 52 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 53 - "PendingOrderBanner.tsx"
Cohesion: 0.21
Nodes (17): OrderRow(), RowAction, rowInitial, rowReducer(), catalogName(), isSubscriptionCode(), planChangeLoss(), planChangeWarning() (+9 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "OrderWorkspace.tsx"
Cohesion: 0.08
Nodes (31): AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), OrderDrawer(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON (+23 more)

### Community 56 - "ReviewDocument.tsx"
Cohesion: 0.17
Nodes (12): useReviewDocument(), Props, ReviewDocument(), toExtractedRows(), CustomModal(), ModalType, Props, baseProps (+4 more)

### Community 57 - "QueueRow.test.tsx"
Cohesion: 0.20
Nodes (5): inputTaxPreview, monthLabel(), RecordInputTax(), open(), doc()

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "FieldMapping"
Cohesion: 0.28
Nodes (12): AddError, MappingItem, SetStats, Undo, FeeInvoiceSource, MappingSetsInput, labels, ActiveScan (+4 more)

### Community 61 - "AccountingReview.tsx"
Cohesion: 0.15
Nodes (12): DEFAULT_EMPTY_OBJECT, configBanks, ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps (+4 more)

### Community 63 - "EmailSettings.tsx"
Cohesion: 0.16
Nodes (12): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+4 more)

### Community 64 - "TKey"
Cohesion: 0.10
Nodes (19): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+11 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "APInvoice.tsx"
Cohesion: 0.16
Nodes (16): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APUploadStep(), INSTRUCTIONS, Props (+8 more)

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.20
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+1 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "MaintenancePage.tsx"
Cohesion: 0.36
Nodes (10): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenants(), fmtICT(), MaintenancePage() (+2 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 77 - "apiFetch"
Cohesion: 0.16
Nodes (17): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), approvePmsDay(), failure(), getPmsDay(), PmsApproveResult (+9 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.11
Nodes (17): MAP, OrderStatusBadge(), PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), OrderHistory() (+9 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "reviewReasons.ts"
Cohesion: 0.22
Nodes (9): OcrExtractionHook, ExtractionWarningBanner(), Props, ExtractionWarning, FIX, REASON_KEY, SETTINGS, warningText() (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.13
Nodes (19): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, TourCatalog (+11 more)

### Community 88 - "storage.ts"
Cohesion: 0.12
Nodes (23): VendorSearch(), RowAction(), AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+15 more)

### Community 89 - "main.tsx"
Cohesion: 0.10
Nodes (14): APInvoice, container, EmailSettings, getRoute(), Home, ManualScan, Mapping, OrderHistory (+6 more)

### Community 90 - "client.ts"
Cohesion: 0.21
Nodes (14): exchangeSSOToken(), revokeSession(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, clearToken(), createApiClient() (+6 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.05
Nodes (24): en, th, en, th, en, th, adminDict, AdminKey (+16 more)

### Community 92 - "APGroupModal.tsx"
Cohesion: 0.32
Nodes (8): APGroupModal(), profileLabel(), Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 93 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 94 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (24): EXTRACTION_STAGES, _fetchExtract(), NUMERIC_FIELDS, imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg(), fetchTimeout() (+16 more)

### Community 95 - "CheckoutFlow.tsx"
Cohesion: 0.12
Nodes (16): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload() (+8 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "useAPExtraction"
Cohesion: 0.12
Nodes (20): isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+12 more)

### Community 115 - "unwrapDetail"
Cohesion: 0.38
Nodes (10): unwrapDetail(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword(), RoleOption (+2 more)

### Community 119 - "APLineItem"
Cohesion: 0.27
Nodes (9): Props, Props, APSuccessStep(), Props, APInvoiceHeader, ApDraft, APDraftState, APValidationProps (+1 more)

### Community 120 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): getStoredToken(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 121 - "TenantsPage.tsx"
Cohesion: 0.36
Nodes (6): Column, funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

### Community 124 - "UserConsentModal.tsx"
Cohesion: 0.40
Nodes (5): COPY, Lang, Props, useIsMobile(), UserConsentModal()

### Community 125 - "ExtractionsPage.tsx"
Cohesion: 0.17
Nodes (15): ExtractionFailureRow, TenantSearch(), label(), Tenant, TenantSelector(), TenantSelectorProps, causeLabel(), classify() (+7 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.12
Nodes (16): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+8 more)

## Knowledge Gaps
- **667 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+662 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `CustomSearchSelect.tsx`, `APReviewStep.tsx`, `ccJv.ts`, `PmsReviewDocument.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useOcrWizard.ts`, `useMapping.ts`, `orders.ts`, `APAccountMappingStep.tsx`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `EmailAutomationPage`, `Mapping.tsx`, `MainMappingTable.tsx`, `ApiKeysPage.tsx`, `AdminLogin.tsx`, `PeriodPicker.tsx`, `admin/api/credits.ts`, `useAuth`, `ManualScan.tsx`, `useAPInvoice.ts`, `AdminRouter.tsx`, `EmailAutomationPage.tsx`, `FeatureFlows.tsx`, `formatThb`, `NotificationBell.tsx`, `useOcrWizard`, `DataTable.tsx`, `QueueRow.tsx`, `useMappingData.ts`, `ReviewQueue.tsx`, `PendingOrderBanner.tsx`, `OrderWorkspace.tsx`, `ReviewDocument.tsx`, `QueueRow.test.tsx`, `AccountingReview.tsx`, `TKey`, `APInvoice.tsx`, `APAmountSummary.tsx`, `MaintenancePage.tsx`, `OrderActions.tsx`, `apiFetch`, `OrderHistory.tsx`, `reviewReasons.ts`, `Pricing.tsx`, `storage.ts`, `i18n/index.ts`, `APGroupModal.tsx`, `useAPExtraction.ts`, `CheckoutFlow.tsx`, `useAPExtraction`, `unwrapDetail`, `APLineItem`, `MaintenanceGate.tsx`, `TenantsPage.tsx`, `UserConsentModal.tsx`, `ExtractionsPage.tsx`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useAPInvoice.ts`, `appKey`, `parseNum`, `NotificationBell.tsx`, `useOcrWizard`, `useAPExtraction`, `useMapping.ts`, `useSettlementMapping.ts`, `useMappingData.ts`, `OrderHistory.tsx`, `api.ts`, `PendingOrderBanner.tsx`, `emailReview.ts`, `client.ts`, `shared/api/credits.ts`, `useAuth`, `useAPExtraction.ts`, `QueueRow.test.tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `API` connect `adminFetch` to `parseNum`, `useMapping.ts`, `orders.ts`, `useSettlementMapping.ts`, `ApiKeysPage.tsx`, `AdminLogin.tsx`, `emailReview.ts`, `shared/api/credits.ts`, `admin/api/credits.ts`, `useAuth`, `useAPInvoice.ts`, `NotificationBell.tsx`, `useEmailSettings.ts`, `adminAuth.ts`, `api.ts`, `MaintenancePage.tsx`, `apiFetch`, `useAPExtraction.ts`, `useAPExtraction`, `unwrapDetail`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _667 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `PmsReviewDocument.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._