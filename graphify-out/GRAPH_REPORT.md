# Graph Report - OCR  (2026-10-08)

## Corpus Check
- 419 files · ~305,308 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2230 nodes · 6229 edges · 174 communities (117 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6ed17361`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APLineItem
- APInvoice.tsx
- dict/index.ts
- DataTable.tsx
- JvEditor.tsx
- ReviewDocument.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- useOcrWizard.ts
- AccountingReview.tsx
- orders.ts
- ProtectedRoute.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- TopLevelConfigSection.tsx
- appKey
- routes.tsx
- ApiKeysPage.tsx
- useMappingSuggestions.ts
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- AdminLogin.tsx
- FieldMapping
- devDependencies
- shared/api/credits.ts
- LanguageContext.tsx
- useOcrWizard
- OrderActions.tsx
- DocumentPreview.tsx
- dependencies
- useAPExtraction.ts
- useOcrExtraction.ts
- PendingOrderBanner.tsx
- OrderWorkspace.tsx
- FeatureFlows.tsx
- apiFetch
- useNotifications.ts
- CreditsPage.tsx
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- QuotaModulesPage.tsx
- useEmailSettings.ts
- PeriodPicker.tsx
- QueueRow.tsx
- CreateKeyDialog.tsx
- ReviewQueue.tsx
- NotificationBell.tsx
- scripts
- useReviewDocument.ts
- ManualScan.tsx
- useOcrSubmission.test.ts
- compilerOptions
- emailAutomation.ts
- CheckoutFlow.tsx
- TenantsPage.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- EmailSettings.test.tsx
- useT
- api.ts
- TKey
- Carmen AI — OCR & Import System
- usePdfPasswordPrompt
- DetailTable.tsx
- errors.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- emailReview.ts
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/credits.ts
- OrderHistory.tsx
- ErrorBoundary
- CustomModal.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- storage.ts
- chrome.ts
- i18n/index.ts
- OrderReviewShell.tsx
- i18n/tenants.ts
- checkout.ts
- ocr.ts
- banks.ts
- vitest
- vite-env.d.ts
- PmsPage.tsx
- mockPaths.test.ts
- client.ts
- adminFetch
- AdminRouter.tsx
- EmailSettings.tsx
- AdminAuthContext.tsx
- Dialog.tsx
- AppHeader.tsx
- ApiKeysPage.test.tsx
- UserConsentModal.tsx
- sessions.ts
- Skeleton.tsx
- dict/maintenance.ts
- main.tsx
- adminUsers.ts
- anomalies.ts
- cc.ts
- slip.ts
- useMapping.ts
- BankDetectionBanner.tsx
- warn.ts
- unwrapDetail
- NotificationBell.test.tsx
- llmLogs.ts
- credit-card/hooks/index.ts
- @types/react
- PmsPage.test.tsx
- login.ts
- @types/react-dom
- NumericInput.tsx
- quota.ts
- review.ts
- Tooltip.tsx
- date.ts
- useNotifications.test.ts
- APAccountMappingStep.tsx
- vite
- APUploadStep.tsx
- dict/apiKeys.ts
- dict/ap.ts
- @testing-library/react
- ar.ts
- @testing-library/jest-dom
- extractions.ts
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
- i18n/maintenance.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- pack.ts
- i18n/nav.ts
- i18n/quotas.ts
- dict/usage.ts
- whatsnew.ts
- eslint
- i18n/usage.ts
- userUsage.ts
- flows.ts
- dict/modal.ts
- pricing.ts
- jsdom
- contact.ts
- orev.ts
- qr.ts

## God Nodes (most connected - your core abstractions)
1. `useT()` - 262 edges
2. `adminFetch` - 68 edges
3. `apiFetch` - 64 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `unwrapDetail()` - 38 edges
7. `TKey` - 38 edges
8. `appKey()` - 36 edges
9. `showToast()` - 34 edges
10. `fmtDateTime()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `BatchAction` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/components/BatchActionBar.tsx → frontend/src/i18n/dict/index.ts
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/AccountMappingTable.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (174 total, 57 thin omitted)

### Community 0 - "APLineItem"
Cohesion: 0.22
Nodes (13): APGroupModal(), profileLabel(), Props, ApDraft, APDraftState, Args, useAPGrouping(), APValidationProps (+5 more)

### Community 1 - "APInvoice.tsx"
Cohesion: 0.08
Nodes (39): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APLineItemsTable(), Props, APReviewStep(), Ctrl (+31 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.08
Nodes (18): AdminKey, en, th, en, th, DICT, en, th (+10 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.11
Nodes (19): DataTableProps, ExpandedRowWrapperProps, ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS, Extra, readHashParams() (+11 more)

### Community 4 - "JvEditor.tsx"
Cohesion: 0.12
Nodes (28): AccountMappingTable(), GLAccount, Props, BlockReason, JvEditor(), Props, rowId(), MainMappingTable() (+20 more)

### Community 5 - "ReviewDocument.tsx"
Cohesion: 0.21
Nodes (11): RowAction(), Props, ReviewDocument(), SwapLabel(), ExtractionWarningBanner(), FIX, fixLinkProps(), REASON_KEY (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (26): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+18 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (28): EnterpriseCard(), billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder() (+20 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.24
Nodes (11): useAPDraft(), mountRestored(), TAX_PROFILES, clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage(), Envelope (+3 more)

### Community 10 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (26): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), AccountingReview(), DEFAULT_EMPTY_OBJECT, handleSubmitFinal(), codeToSource() (+18 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (29): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+21 more)

### Community 12 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.14
Nodes (21): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+13 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "TopLevelConfigSection.tsx"
Cohesion: 0.13
Nodes (13): JvHeaderCard(), TopLevelConfigSection(), useGlMasters(), DESCRIPTION_TAGS, joinDescription(), splitDescription(), CustomSearchSelect(), handleScroll() (+5 more)

### Community 17 - "appKey"
Cohesion: 0.14
Nodes (20): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+12 more)

### Community 18 - "routes.tsx"
Cohesion: 0.14
Nodes (18): fetchAlerts(), fetchSessions(), resolveAlert(), revokeSession(), label(), Tenant, TenantSelector(), TenantSelectorProps (+10 more)

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.22
Nodes (16): TenantSearch(), ApiKeysPage(), cell(), KeyTable(), Props, RevokeKeyDialog(), Props, StatusLine() (+8 more)

### Community 20 - "useMappingSuggestions.ts"
Cohesion: 0.19
Nodes (22): Props, MappingRow(), Props, Props, Props, STATUS_LABEL, Props, MappingStatus (+14 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 25 - "FieldMapping"
Cohesion: 0.23
Nodes (15): AddError, MappingItem, MappingSet, SetStats, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput (+7 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (29): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+21 more)

### Community 28 - "LanguageContext.tsx"
Cohesion: 0.13
Nodes (16): configBanks, bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB(), Lang (+8 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.14
Nodes (19): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+11 more)

### Community 30 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useAPExtraction.ts"
Cohesion: 0.08
Nodes (38): APInvoiceHeader, Args, APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch (+30 more)

### Community 34 - "useOcrExtraction.ts"
Cohesion: 0.13
Nodes (19): ItxOverrides, Props, DetailRow, Props, Props, JvState, Props, DetailRow (+11 more)

### Community 35 - "PendingOrderBanner.tsx"
Cohesion: 0.15
Nodes (23): WsState, OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode() (+15 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.07
Nodes (35): AdminCreditOrder, fetchAdminOrderDocuments(), getOrderSlipUrl(), listCreditOrders(), BatchAction, BatchActionBar(), Props, Props (+27 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "apiFetch"
Cohesion: 0.10
Nodes (30): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+22 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.17
Nodes (16): WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), Notification, LATEST_RELEASE, RELEASE_NOTES, ReleaseFix (+8 more)

### Community 40 - "CreditsPage.tsx"
Cohesion: 0.20
Nodes (21): fetchJobs(), Column, DataTable(), getCell(), daysAgo(), endOfDay(), today(), ymd() (+13 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "QuotaModulesPage.tsx"
Cohesion: 0.11
Nodes (21): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps, EmptyState(), EmptyStateProps (+13 more)

### Community 44 - "useEmailSettings.ts"
Cohesion: 0.21
Nodes (13): BankCode, EmailApiError, EmailDocType, EmailRulePayload, EmailSettings, TokenStatus, Draft, EmailSettingsController (+5 more)

### Community 45 - "PeriodPicker.tsx"
Cohesion: 0.18
Nodes (19): granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours(), PeriodPicker(), PRESET_DAYS (+11 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.21
Nodes (16): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+8 more)

### Community 47 - "CreateKeyDialog.tsx"
Cohesion: 0.18
Nodes (12): CreateKeyDialog(), Props, TenantField, UrlText(), Button(), ButtonProps, Variant, VARIANT_CLASS (+4 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 49 - "NotificationBell.tsx"
Cohesion: 0.24
Nodes (13): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+5 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "useReviewDocument.ts"
Cohesion: 0.22
Nodes (13): approveDocument(), getPending(), rejectDocument(), BU_WIDE, Overrides, useReviewDocument(), approve(), reject() (+5 more)

### Community 52 - "ManualScan.tsx"
Cohesion: 0.18
Nodes (9): DATE_KEYS, HeaderCard(), Props, INSTRUCTIONS, Props, UploadSection(), ManualScan, FormActions() (+1 more)

### Community 53 - "useOcrSubmission.test.ts"
Cohesion: 0.16
Nodes (12): CarmenJvPayload, defaultConfig, defaultRows, diffCorrections, getAccountingConfig, getJvhDate(), JvDetail, logCorrections (+4 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "emailAutomation.ts"
Cohesion: 0.35
Nodes (12): ApiFieldError, call(), deleteToken(), getBankCodes(), getSettings(), getToken(), json(), putToken() (+4 more)

### Community 56 - "CheckoutFlow.tsx"
Cohesion: 0.11
Nodes (18): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload(), SLIP (+10 more)

### Community 57 - "TenantsPage.tsx"
Cohesion: 0.19
Nodes (17): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenantDetail(), fetchTenants(), TenantRow (+9 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "EmailSettings.test.tsx"
Cohesion: 0.18
Nodes (9): EmailRule, seedDraft(), fieldErrors, mount(), mountWith(), removeToken, rules, save (+1 more)

### Community 62 - "useT"
Cohesion: 0.14
Nodes (18): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+10 more)

### Community 63 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 64 - "TKey"
Cohesion: 0.17
Nodes (13): NavItem, NavSection, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES (+5 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 67 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "ExtractionsPage.tsx"
Cohesion: 0.22
Nodes (12): ExtractionFailureRow, DateRangePicker(), DateRangePickerProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage(), FailureGroup (+4 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "emailReview.ts"
Cohesion: 0.16
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 77 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93, phase 1: an inbox, nothing processes it yet)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.11
Nodes (20): MAP, OrderStatusBadge(), PendingOrderBanner(), SLIP, useOrderHistory(), OrderHistory(), parseFocusId(), Pricing() (+12 more)

### Community 82 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 83 - "CustomModal.tsx"
Cohesion: 0.19
Nodes (9): OrderDrawer(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, __resetScrollLock(), Locker() (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.17
Nodes (20): PackList(), Props, PlanCard(), PlanCardProps, LITE, TIER_ICONS, priceLines(), PurchaseStep (+12 more)

### Community 88 - "storage.ts"
Cohesion: 0.21
Nodes (14): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), APP_STORAGE_BASES (+6 more)

### Community 90 - "i18n/index.ts"
Cohesion: 0.08
Nodes (13): en, th, en, th, adminDict, en, th, en (+5 more)

### Community 91 - "OrderReviewShell.tsx"
Cohesion: 0.27
Nodes (7): OrderReviewShell(), registerDict(), OrderReviewShell, DarkModeToggle(), LanguageToggle(), isDarkNow(), useDarkMode()

### Community 94 - "ocr.ts"
Cohesion: 0.17
Nodes (12): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ExtractedRow, extractFromFile(), ExtractResult (+4 more)

### Community 95 - "banks.ts"
Cohesion: 0.12
Nodes (24): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField (+16 more)

### Community 103 - "PmsPage.tsx"
Cohesion: 0.32
Nodes (8): createPmsKey(), failure(), fetchPmsKeys(), revokePmsKey(), hostOf(), PmsKeys(), PageHeader(), PageHeaderProps

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "client.ts"
Cohesion: 0.18
Nodes (12): loaded(), SETTINGS, exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient() (+4 more)

### Community 106 - "adminFetch"
Cohesion: 0.14
Nodes (31): createApiKey(), fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, adjustCredits(), CreditBalance, CreditLedgerEntry (+23 more)

### Community 107 - "AdminRouter.tsx"
Cohesion: 0.35
Nodes (8): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminProtectedRoute(), useAdminAuth()

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.16
Nodes (12): RECONCILE_BANK, copyAddress(), DOC_TYPE_LABEL, EmailSettings(), focusablesIn(), jumpTo(), kbankFiles(), NEXT_STEP (+4 more)

### Community 109 - "AdminAuthContext.tsx"
Cohesion: 0.33
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 110 - "Dialog.tsx"
Cohesion: 0.29
Nodes (5): Dialog(), DialogProps, focusablesIn(), Options, useDialogFocus()

### Community 111 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (7): AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., A, B, Probe(), useAuth()

### Community 112 - "ApiKeysPage.test.tsx"
Cohesion: 0.22
Nodes (6): createApiKey, fetchApiKeys, fetchTenants, revokeApiKey, ROW, writeText

### Community 113 - "UserConsentModal.tsx"
Cohesion: 0.28
Nodes (7): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal()

### Community 115 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 117 - "main.tsx"
Cohesion: 0.16
Nodes (11): AdminRouter, APInvoice, container, EmailSettings, getRoute(), Mapping, OrderHistory, PmsPage (+3 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.20
Nodes (14): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+6 more)

### Community 123 - "BankDetectionBanner.tsx"
Cohesion: 0.25
Nodes (5): BANK_LOGOS, BankDetectionBanner(), Props, BANK_THAI_NAMES, BANKS

### Community 125 - "unwrapDetail"
Cohesion: 0.47
Nodes (10): unwrapDetail(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword(), RoleOption (+2 more)

### Community 126 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 130 - "PmsPage.test.tsx"
Cohesion: 0.29
Nodes (3): createPmsKey, fetchPmsKeys, revokePmsKey

### Community 133 - "NumericInput.tsx"
Cohesion: 0.53
Nodes (3): NumericInput(), NumericInputProps, sanitizeNumericInput()

### Community 136 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 137 - "date.ts"
Cohesion: 0.57
Nodes (4): DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 138 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.09
Nodes (20): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+12 more)

### Community 141 - "APUploadStep.tsx"
Cohesion: 0.50
Nodes (3): APUploadStep(), INSTRUCTIONS, Props

## Knowledge Gaps
- **665 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+660 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APLineItem`, `APInvoice.tsx`, `DataTable.tsx`, `JvEditor.tsx`, `ReviewDocument.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `AccountingReview.tsx`, `orders.ts`, `APAccountMappingStep.tsx`, `APUploadStep.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `TopLevelConfigSection.tsx`, `routes.tsx`, `ApiKeysPage.tsx`, `useMappingSuggestions.ts`, `MaintenanceGate.tsx`, `AdminLogin.tsx`, `shared/api/credits.ts`, `LanguageContext.tsx`, `useOcrWizard`, `OrderActions.tsx`, `DocumentPreview.tsx`, `useAPExtraction.ts`, `PendingOrderBanner.tsx`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `apiFetch`, `useNotifications.ts`, `CreditsPage.tsx`, `QuotaModulesPage.tsx`, `PeriodPicker.tsx`, `QueueRow.tsx`, `CreateKeyDialog.tsx`, `ReviewQueue.tsx`, `NotificationBell.tsx`, `useReviewDocument.ts`, `ManualScan.tsx`, `CheckoutFlow.tsx`, `TenantsPage.tsx`, `TKey`, `DetailTable.tsx`, `ExtractionsPage.tsx`, `OrderHistory.tsx`, `CustomModal.tsx`, `Pricing.tsx`, `OrderReviewShell.tsx`, `ocr.ts`, `banks.ts`, `PmsPage.tsx`, `adminFetch`, `AdminRouter.tsx`, `AppHeader.tsx`, `UserConsentModal.tsx`, `useMapping.ts`, `BankDetectionBanner.tsx`, `unwrapDetail`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `useOcrWizard()` connect `useOcrWizard` to `credit-card/hooks/index.ts`, `useAPExtraction.ts`, `usePdfPasswordPrompt`, `useOcrWizard.ts`, `ManualScan.tsx`, `useOcrSubmission.test.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `showToast()` connect `useAPExtraction.ts` to `useOcrExtraction.ts`, `apiFetch`, `parseNum`, `useOcrWizard.ts`, `AccountingReview.tsx`, `EmailSettings.tsx`, `useReviewDocument.ts`, `useMappingSuggestions.ts`, `useOcrSubmission.test.ts`, `storage.ts`, `useMapping.ts`, `useOcrWizard`, `ocr.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _665 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APInvoice.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0783744557329463 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10804597701149425 - nodes in this community are weakly interconnected._