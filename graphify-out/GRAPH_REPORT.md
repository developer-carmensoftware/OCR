# Graph Report - OCR  (2026-10-01)

## Corpus Check
- 400 files · ~289,928 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2131 nodes · 5904 edges · 165 communities (106 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `de9dccd1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- endpoints.ts
- AccountingReview.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- adminFetch
- orders.ts
- shared/api/auth.ts
- apiFetch
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- ccJv.ts
- payment-mapping/types.ts
- unwrapDetail
- NotificationBell.tsx
- TKey
- compilerOptions
- 5. Components
- client.ts
- InputTaxReconciliation.tsx
- ap-invoice/constants.ts
- devDependencies
- useOcrExtraction.ts
- adminAuth.ts
- showToast
- OrderWorkspace.tsx
- OrderTable.tsx
- dependencies
- useMappingData.ts
- ExtractionsPage.tsx
- TopLevelConfigSection.tsx
- AppHeader.test.tsx
- useT
- useAPExtraction.ts
- useNotifications.ts
- useFileUpload.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- QueueRow.tsx
- QuotaModulesPage.tsx
- DocumentPreview.tsx
- AdminLogin.tsx
- usePdfPasswordPrompt
- useAuth
- scripts
- OrderHistory.tsx
- appKey
- useOcrSubmission.test.ts
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- APTableRow.tsx
- emailReview.ts
- ManualScan.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageProvider
- ErrorsPage.tsx
- main.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction
- APInvoice.tsx
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- CustomModal.tsx
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- Mapping.test.tsx
- i18n/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APAccountMappingStep.tsx
- PlanCard.tsx
- APVendorSearch.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- ReviewDocument.tsx
- Skeleton.tsx
- vitest
- vite-env.d.ts
- Home.tsx
- mockPaths.test.ts
- i18n/quotas.ts
- useNotifications.test.ts
- TenantSelector.tsx
- useEmailSettings.ts
- anomalies.ts
- chrome.ts
- LanguageContext.tsx
- i18n/common.ts
- TenantsPage.tsx
- i18n/credits.ts
- useOrderHistory.ts
- UploadSection.tsx
- jobs.ts
- overview.ts
- llmLogs.ts
- ar.ts
- AuthContext.tsx
- useMapping.ts
- DataTable.tsx
- storage.ts
- performance.ts
- dict/ap.ts
- cc.ts
- i18n/tenants.ts
- @types/react
- tenantRanking.ts
- contact.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- dict/maintenance.ts
- notif.ts
- proforma.ts
- quota.ts
- vite
- qr.ts
- slip.ts
- review.ts
- @testing-library/react
- warn.ts
- @testing-library/jest-dom
- tutorial.ts
- 01-csv-sidecar-ingestion.md
- dict/usage.ts
- dict/nav.ts
- order.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- whatsnew.ts
- flows.ts
- plan.ts
- home.ts
- dict/modal.ts
- pricing.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 247 edges
2. `adminFetch` - 64 edges
3. `apiFetch` - 59 edges
4. `parseNum()` - 46 edges
5. `fmt()` - 42 edges
6. `TKey` - 38 edges
7. `unwrapDetail()` - 34 edges
8. `showToast()` - 34 edges
9. `appKey()` - 33 edges
10. `FieldMapping` - 31 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/components/BatchActionBar.tsx → frontend/src/i18n/dict/index.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (165 total, 59 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.20
Nodes (14): ApDraft, Args, useAPDraft(), APDraftState, mountRestored(), TAX_PROFILES, useAPVendor(), clearDraft() (+6 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.32
Nodes (6): DICT, en, th, translate(), FILES, NAMESPACE_FILES

### Community 3 - "endpoints.ts"
Cohesion: 0.20
Nodes (16): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantSubscriptionSummary, fetchTenants(), TenantDetail (+8 more)

### Community 4 - "AccountingReview.tsx"
Cohesion: 0.20
Nodes (14): ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, BlockReason, BU_WIDE, JvState (+6 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.13
Nodes (12): ACTIVITY_FILTERS, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty() (+4 more)

### Community 6 - "parseNum"
Cohesion: 0.16
Nodes (26): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+18 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (32): PackList(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+24 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (22): ARPreviewRequest, SuggestPaymentTypesResponse, SuggestResponse, Props, MainMappings, MainMappingKey, MappingSuggestionsHook, Suggestion (+14 more)

### Community 10 - "adminFetch"
Cohesion: 0.29
Nodes (16): buildQs(), fetchAlerts(), fetchJobs(), fetchSessions(), fetchErrorBreakdown(), fetchExtractionFailures(), fetchLLMLogs(), fetchPerformanceLogs() (+8 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "shared/api/auth.ts"
Cohesion: 0.25
Nodes (9): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats (+1 more)

### Community 13 - "apiFetch"
Cohesion: 0.10
Nodes (32): ARMappingItem, ARPreview, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+24 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.18
Nodes (20): QueryParams, EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits() (+12 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.11
Nodes (21): AccountingReview(), configBanks, codeToSource(), CONFIG, leg(), rows(), TWO_LINES, applyJvAmount() (+13 more)

### Community 17 - "payment-mapping/types.ts"
Cohesion: 0.12
Nodes (26): AccountMappingTable(), GLAccount, Props, JvEditor(), rowId(), MainMappingTable(), BulkApplyBar(), MappingTable() (+18 more)

### Community 18 - "unwrapDetail"
Cohesion: 0.30
Nodes (13): unwrapDetail(), getOrderSlipUrl(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword() (+5 more)

### Community 19 - "NotificationBell.tsx"
Cohesion: 0.12
Nodes (21): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+13 more)

### Community 20 - "TKey"
Cohesion: 0.23
Nodes (13): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, NavItem, NavSection (+5 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "client.ts"
Cohesion: 0.20
Nodes (14): API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, getStoredToken(), resolveUrl(), countdown(), EMPTY, fmtHM() (+6 more)

### Community 24 - "InputTaxReconciliation.tsx"
Cohesion: 0.24
Nodes (12): InputTaxPanel(), InputTaxReconciliation(), handleAddInputTax(), descriptionForBank(), renderDescription(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+4 more)

### Community 25 - "ap-invoice/constants.ts"
Cohesion: 0.21
Nodes (12): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APFieldKey, APStep, DEFAULT_MAPPINGS (+4 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "useOcrExtraction.ts"
Cohesion: 0.10
Nodes (25): _fetchExtract(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps, extractFromFile (+17 more)

### Community 28 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 29 - "showToast"
Cohesion: 0.16
Nodes (18): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), useOcrWizard() (+10 more)

### Community 30 - "OrderWorkspace.tsx"
Cohesion: 0.17
Nodes (19): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), fetchAdminOrderDocuments() (+11 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.11
Nodes (20): AdminCreditOrder, BatchAction, BatchActionBar(), Props, Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON (+12 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useMappingData.ts"
Cohesion: 0.20
Nodes (21): MappingRow(), Props, Props, Props, STATUS_LABEL, Props, MappingSet, MappingStatus (+13 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.22
Nodes (12): ExtractionFailureRow, DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup (+4 more)

### Community 35 - "TopLevelConfigSection.tsx"
Cohesion: 0.11
Nodes (17): JvHeaderCard(), Props, Props, TopLevelConfigSection(), NormalizedConfig, DESCRIPTION_TAGS, joinDescription(), splitDescription() (+9 more)

### Community 37 - "useT"
Cohesion: 0.10
Nodes (22): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+14 more)

### Community 38 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (24): APExtractionProps, EXTRACTION_STAGES, NUMERIC_FIELDS, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload (+16 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.20
Nodes (14): WhatsNew(), listNotifications(), markNotificationsRead(), LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy (+6 more)

### Community 40 - "useFileUpload.ts"
Cohesion: 0.13
Nodes (12): ACCEPTED, Props, FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize() (+4 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, configBanks, CONTROL_PANE_ROWS (+6 more)

### Community 43 - "date.ts"
Cohesion: 0.26
Nodes (13): useAPSubmission(), addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), DateInput(), DateInputProps (+5 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.26
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+5 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.10
Nodes (23): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps (+15 more)

### Community 46 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 47 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 48 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 49 - "useAuth"
Cohesion: 0.16
Nodes (15): exchangeSSOToken(), ConsentGate(), Props, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute() (+7 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.11
Nodes (33): num(), VerifyFacts(), OrderRow(), RowAction, rowInitial, rowReducer(), RowState, BillingFigure() (+25 more)

### Community 52 - "appKey"
Cohesion: 0.12
Nodes (23): approveDocument(), getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+15 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (15): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+7 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.15
Nodes (35): resolveAlert(), revokeSession(), daysAgo(), endOfDay(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS (+27 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.11
Nodes (37): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, Props, PACK_META, CheckoutPhase (+29 more)

### Community 57 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "APTableRow.tsx"
Cohesion: 0.17
Nodes (10): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props, NumericInput() (+2 more)

### Community 62 - "emailReview.ts"
Cohesion: 0.20
Nodes (14): ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail, ReviewFlag (+6 more)

### Community 63 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (24): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+16 more)

### Community 64 - "APLineItem"
Cohesion: 0.30
Nodes (9): APGroupModal(), profileLabel(), Props, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.17
Nodes (6): PendingOrderBanner(), SLIP, SlipUpload(), SLIP, LanguageProvider(), readLang()

### Community 67 - "ErrorsPage.tsx"
Cohesion: 0.24
Nodes (10): Column, periodHours(), ErrorRow, ErrorsPage(), GroupBy, getColsCost(), getColsPerf(), Metric (+2 more)

### Community 68 - "main.tsx"
Cohesion: 0.10
Nodes (14): AdminRouter, container, EmailSettings, getRoute(), ManualScan, Mapping, OrderHistory, Pricing (+6 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "useAPExtraction"
Cohesion: 0.13
Nodes (18): isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+10 more)

### Community 73 - "APInvoice.tsx"
Cohesion: 0.12
Nodes (9): APUploadStep(), INSTRUCTIONS, Props, AP_STEPS, APInvoice(), APInvoice, PDFPageSelector(), Props (+1 more)

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "CustomModal.tsx"
Cohesion: 0.19
Nodes (9): OrderDrawer(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker() (+1 more)

### Community 77 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.06
Nodes (20): en, th, en, th, en, th, en, th (+12 more)

### Community 81 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APAccountMappingStep.tsx"
Cohesion: 0.20
Nodes (8): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps

### Community 88 - "PlanCard.tsx"
Cohesion: 0.24
Nodes (8): EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE, PackPresentation, perDoc()

### Community 89 - "APVendorSearch.tsx"
Cohesion: 0.19
Nodes (10): Props, VendorSearch(), Badge(), BadgeVariant, Props, Coords, getCoords(), Props (+2 more)

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.18
Nodes (11): Props, Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, APSuccessStep() (+3 more)

### Community 94 - "ReviewDocument.tsx"
Cohesion: 0.15
Nodes (16): getPending(), rejectDocument(), RowAction(), useReviewDocument(), reject(), Props, ReviewDocument(), SwapLabel() (+8 more)

### Community 95 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 103 - "Home.tsx"
Cohesion: 0.13
Nodes (16): OrderReviewShell(), ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, registerDict() (+8 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 106 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 107 - "TenantSelector.tsx"
Cohesion: 0.25
Nodes (6): label(), Tenant, TenantSelector(), TenantSelectorProps, fetchTenants, TENANTS

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (40): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+32 more)

### Community 111 - "LanguageContext.tsx"
Cohesion: 0.09
Nodes (22): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+14 more)

### Community 113 - "TenantsPage.tsx"
Cohesion: 0.39
Nodes (6): fetchTenantDetail(), funnel(), median(), quotaTier(), TenantDetailPanel(), TenantsPage()

### Community 115 - "useOrderHistory.ts"
Cohesion: 0.38
Nodes (6): OPEN_STATUSES, OrderHistoryState, useOrderHistory(), CreditOrder, listOrders(), OPEN_ORDER_STATUSES

### Community 116 - "UploadSection.tsx"
Cohesion: 0.50
Nodes (3): INSTRUCTIONS, Props, UploadSection()

### Community 121 - "AuthContext.tsx"
Cohesion: 0.20
Nodes (12): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+4 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.11
Nodes (28): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), COMPANY_FIELDS, CompanyField (+20 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+12 more)

### Community 124 - "storage.ts"
Cohesion: 0.17
Nodes (14): AppHeader(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), APP_STORAGE_BASES (+6 more)

## Knowledge Gaps
- **641 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+636 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APReviewStep.tsx`, `endpoints.ts`, `AccountingReview.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `api.ts`, `adminFetch`, `orders.ts`, `shared/api/auth.ts`, `apiFetch`, `EmailAutomationPage.tsx`, `ccJv.ts`, `payment-mapping/types.ts`, `unwrapDetail`, `NotificationBell.tsx`, `TKey`, `client.ts`, `InputTaxReconciliation.tsx`, `ap-invoice/constants.ts`, `showToast`, `OrderWorkspace.tsx`, `OrderTable.tsx`, `useMappingData.ts`, `ExtractionsPage.tsx`, `TopLevelConfigSection.tsx`, `useAPExtraction.ts`, `useNotifications.ts`, `useFileUpload.ts`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `DocumentPreview.tsx`, `AdminLogin.tsx`, `OrderHistory.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `OrderActions.tsx`, `ManualScan.tsx`, `APLineItem`, `LanguageProvider`, `ErrorsPage.tsx`, `useAPExtraction`, `APInvoice.tsx`, `CustomModal.tsx`, `APAccountMappingStep.tsx`, `PlanCard.tsx`, `APVendorSearch.tsx`, `APAmountSummary.tsx`, `ReviewDocument.tsx`, `Home.tsx`, `TenantSelector.tsx`, `LanguageContext.tsx`, `TenantsPage.tsx`, `useOrderHistory.ts`, `UploadSection.tsx`, `useMapping.ts`, `DataTable.tsx`, `storage.ts`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useOcrWizard.ts`, `parseNum`, `api.ts`, `client.ts`, `InputTaxReconciliation.tsx`, `useOcrExtraction.ts`, `useMappingData.ts`, `useAPExtraction.ts`, `useNotifications.ts`, `useFileUpload.ts`, `date.ts`, `OrderHistory.tsx`, `appKey`, `useOcrSubmission.test.ts`, `shared/api/credits.ts`, `emailReview.ts`, `useAPExtraction`, `useUserConsent.ts`, `ReviewDocument.tsx`, `useOrderHistory.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrWizard.ts`, `AccountingReview.tsx`, `useAPExtraction.ts`, `parseNum`, `useFileUpload.ts`, `api.ts`, `date.ts`, `useEmailSettings.ts`, `appKey`, `useOcrSubmission.test.ts`, `AuthContext.tsx`, `useMapping.ts`, `useOcrExtraction.ts`, `ReviewDocument.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _641 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
- **Should `screens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08780487804878048 - nodes in this community are weakly interconnected._