# Graph Report - OCR  (2026-11-09)

## Corpus Check
- 423 files · ~313,689 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2265 nodes · 6314 edges · 173 communities (109 shown, 64 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6a70389f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TopLevelConfigSection.tsx
- APReviewStep.tsx
- dict/index.ts
- ManualScan.tsx
- api.ts
- appKey
- parseNum
- purchase.ts
- screens.tsx
- bankTransforms.ts
- useMapping.ts
- orders.ts
- useReviewDocument.ts
- useSettlementMapping.ts
- LanguageContext.tsx
- EmailAutomationPage.tsx
- PeriodPicker.tsx
- PaymentMappingDialog.tsx
- ocr.ts
- ApiKeysPage.tsx
- apiFetch
- compilerOptions
- 5. Components
- useAPExtraction.ts
- useNotifications.ts
- useOcrWizard
- devDependencies
- shared/api/credits.ts
- useT
- adminFetch
- CreditsPage.tsx
- DocumentPreview.tsx
- dependencies
- TKey
- useAPSubmission.test.ts
- useAPExtraction
- QuotaModulesPage.tsx
- FeatureFlows.tsx
- OrderWorkspace.tsx
- NotificationBell.tsx
- useOcrWizard.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- DateInput.tsx
- EmailSettings.tsx
- DataTable.tsx
- QueueRow.tsx
- FieldMapping
- ReviewQueue.tsx
- client.ts
- scripts
- carmen.ts
- useOcrExtraction
- SlipUpload.tsx
- compilerOptions
- OrderTable.tsx
- CustomModal.tsx
- APVendorSearch.tsx
- CLAUDE.md
- Contributing
- mappingSets.ts
- Skeleton.tsx
- MetricChartImpl.tsx
- MaintenanceGate.tsx
- AppHeader.tsx
- Carmen AI — OCR & Import System
- APInvoice.tsx
- APAmountSummary.tsx
- useUserConsent.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- TenantsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderActions.tsx
- PmsReviewDocument.tsx
- vercel.json
- Architecture
- ArCustomerProfiles.tsx
- OrderHistory.tsx
- Mapping.test.tsx
- apInvoicePayload.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- ReviewDocument.tsx
- main.tsx
- securityHeaders.test.ts
- i18n/index.ts
- APGroupModal.tsx
- useMappingData.ts
- ProtectedRoute.tsx
- CheckoutFlow.tsx
- checkout.ts
- vite-env.d.ts
- llmLogs.ts
- mockPaths.test.ts
- storage.ts
- cc.ts
- typescript
- i18n/tenants.ts
- orev.ts
- dict/ap.ts
- dict/apiKeys.ts
- dict/modal.ts
- quota.ts
- pack.ts
- plan.ts
- warn.ts
- @testing-library/dom
- useOrderActions.ts
- qr.ts
- review.ts
- credit-card/hooks/index.ts
- TenantSelector.test.tsx
- slip.ts
- tutorial.ts
- ExtractionsPage.tsx
- adminUsers.ts
- @eslint/js
- ReviewQueue.test.tsx
- releaseNotes.ts
- setup.ts
- useNotifications.test.ts
- @types/react-dom
- SlipViewer.tsx
- DarkModeToggle.tsx
- OrderTable.test.tsx
- anomalies.ts
- i18n/usage.ts
- ApiKeysPage.test.tsx
- useAPSubmission.ts
- vite
- chrome.ts
- postcss
- i18n/credits.ts
- errors.ts
- extractions.ts
- @testing-library/jest-dom
- jobs.ts
- 01-csv-sidecar-ingestion.md
- login.ts
- i18n/maintenance.ts
- performance.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- tenantRanking.ts
- ar.ts
- contact.ts
- dict/usage.ts
- flows.ts
- dict/maintenance.ts
- @types/react
- dict/nav.ts
- notif.ts
- pricing.ts
- proforma.ts
- jsdom
- whatsnew.ts
- eslint

## God Nodes (most connected - your core abstractions)
1. `useT()` - 263 edges
2. `adminFetch` - 67 edges
3. `apiFetch` - 65 edges
4. `parseNum()` - 47 edges
5. `fmt()` - 40 edges
6. `TKey` - 39 edges
7. `unwrapDetail()` - 37 edges
8. `showToast()` - 37 edges
9. `appKey()` - 36 edges
10. `round2()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `AdminCreditOrder`  [EXTRACTED]
  frontend/src/features/admin/components/OrderTable.tsx → frontend/src/features/admin/api/orders.ts
- `CreditOrdersPage()` --indirect_call--> `approveOrder()`  [INFERRED]
  frontend/src/features/admin/pages/CreditOrdersPage.tsx → frontend/src/features/admin/api/orders.ts
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts

## Import Cycles
- None detected.

## Communities (173 total, 64 thin omitted)

### Community 0 - "TopLevelConfigSection.tsx"
Cohesion: 0.13
Nodes (14): JvHeaderCard(), Props, TopLevelConfigSection(), useGlMasters(), DESCRIPTION_TAGS, joinDescription(), splitDescription(), CustomSearchSelect() (+6 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.12
Nodes (23): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+15 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "ManualScan.tsx"
Cohesion: 0.09
Nodes (24): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+16 more)

### Community 4 - "api.ts"
Cohesion: 0.13
Nodes (15): suggestMapping(), SuggestPaymentTypesResponse, SuggestResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExchangeResponse (+7 more)

### Community 5 - "appKey"
Cohesion: 0.15
Nodes (20): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+12 more)

### Community 6 - "parseNum"
Cohesion: 0.16
Nodes (31): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+23 more)

### Community 7 - "purchase.ts"
Cohesion: 0.09
Nodes (32): DEMO_PACKS, DEMO_PLANS, priceLines(), PurchaseStep, purchaseTutorial(), STEPS, PurchaseTutorial(), purchaseFigures() (+24 more)

### Community 8 - "screens.tsx"
Cohesion: 0.15
Nodes (17): billed(), DEMO_BUYER, DEMO_PAYMENT_INFO, DEMO_SLIP, demoOrder(), demoProforma(), noop(), BillingFigure() (+9 more)

### Community 9 - "bankTransforms.ts"
Cohesion: 0.15
Nodes (19): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), CompanyField (+11 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.17
Nodes (18): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+10 more)

### Community 11 - "orders.ts"
Cohesion: 0.16
Nodes (19): AdminOrderStatus, fetchAdminOrderDocuments(), fetchAdminPaymentInfo(), fetchKpi(), getOrderSlipUrl(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+11 more)

### Community 12 - "useReviewDocument.ts"
Cohesion: 0.08
Nodes (43): rejectDocument(), AccountingReview(), DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, Props, BlockReason (+35 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.16
Nodes (19): ARMappingItem, ARPreview, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+11 more)

### Community 14 - "LanguageContext.tsx"
Cohesion: 0.17
Nodes (11): MAP, OrderStatusBadge(), configBanks, Lang, Ctx, FALLBACK_CTX, LanguageCtx, LanguageProvider() (+3 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (28): Column, MetricChart(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+20 more)

### Community 17 - "PaymentMappingDialog.tsx"
Cohesion: 0.13
Nodes (23): AccountMappingTable(), GLAccount, Props, JvEditor(), MainMappingTable(), BulkApplyBar(), MappingTable(), Filter (+15 more)

### Community 18 - "ocr.ts"
Cohesion: 0.13
Nodes (17): ApiError, ExtractedRow, extractFromFile(), getPdfInfo(), PDF_PASSWORD_REQUIRED, PdfInfoResult, toExtractedRows(), COPY (+9 more)

### Community 19 - "ApiKeysPage.tsx"
Cohesion: 0.15
Nodes (19): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ApiKeyRow, FeedStatus, pmsEventsUrl() (+11 more)

### Community 20 - "apiFetch"
Cohesion: 0.12
Nodes (19): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+11 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useAPExtraction.ts"
Cohesion: 0.18
Nodes (14): EXTRACTION_STAGES, NUMERIC_FIELDS, imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg(), FileUploadHook, handleFileChange() (+6 more)

### Community 24 - "useNotifications.ts"
Cohesion: 0.20
Nodes (14): ActivityPage, WhatsNew(), WhatsNew, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+6 more)

### Community 25 - "useOcrWizard"
Cohesion: 0.21
Nodes (18): applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel(), handleFileChange() (+10 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, eslint-plugin-react-hooks, devDependencies, autoprefixer, eslint-plugin-react-hooks, globals, prettier, @testing-library/react (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.10
Nodes (30): PendingOrderBanner(), SLIP, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist() (+22 more)

### Community 28 - "useT"
Cohesion: 0.19
Nodes (31): TenantSearch(), DataTable(), daysAgo(), endOfDay(), PeriodPicker(), today(), ymd(), label() (+23 more)

### Community 29 - "adminFetch"
Cohesion: 0.19
Nodes (28): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, unwrapDetail(), fetchAlerts(), fetchJobs(), fetchSessions() (+20 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.36
Nodes (10): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+2 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "TKey"
Cohesion: 0.14
Nodes (15): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+7 more)

### Community 34 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 35 - "useAPExtraction"
Cohesion: 0.21
Nodes (12): isNumFld(), useAPExtraction(), Args, getUsage(), UsageData, getStoredToken(), T, base (+4 more)

### Community 36 - "QuotaModulesPage.tsx"
Cohesion: 0.14
Nodes (18): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), KPICard(), KPICardProps (+10 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (20): AdminCreditOrder, Props, ContactBuyer(), num(), VerifyFacts(), WsAction, wsInitial, WsState (+12 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.13
Nodes (19): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+11 more)

### Community 40 - "useOcrWizard.ts"
Cohesion: 0.16
Nodes (16): useAPDraft(), mountRestored(), TAX_PROFILES, APInvoice(), inputTaxOwed(), OcrDraftState, CcDraft, draftWorthOffering() (+8 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "DateInput.tsx"
Cohesion: 0.43
Nodes (5): paymentDate(), DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.07
Nodes (50): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+42 more)

### Community 45 - "DataTable.tsx"
Cohesion: 0.09
Nodes (19): DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS, Extra (+11 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.14
Nodes (17): inputTaxPreview, markInputTaxKeyed(), recordInputTax(), refusal(), formatWhen(), fullWhen(), Message(), monthLabel() (+9 more)

### Community 47 - "FieldMapping"
Cohesion: 0.19
Nodes (23): ARPreviewRequest, Props, MappingRow(), Props, Props, Props, STATUS_LABEL, Props (+15 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.09
Nodes (38): ActivityFilter, ALL_SCOPES, ApproveResult, getPending(), ItxOverrides, LateInputTaxBody, listActivity(), narrowCount() (+30 more)

### Community 49 - "client.ts"
Cohesion: 0.24
Nodes (12): _fetchExtract(), exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), fetchTimeout() (+4 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "carmen.ts"
Cohesion: 0.09
Nodes (25): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), OcrExtractionProps, OcrSubmissionHook, OcrSubmissionProps, CarmenJvPayload (+17 more)

### Community 52 - "useOcrExtraction"
Cohesion: 0.15
Nodes (7): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), ExtractResult

### Community 53 - "SlipUpload.tsx"
Cohesion: 0.29
Nodes (5): ACCEPTED, Props, SlipUpload(), SLIP, MAX_FILE_SIZE_MB

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), Props (+6 more)

### Community 56 - "CustomModal.tsx"
Cohesion: 0.12
Nodes (14): OrderDrawer(), CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, Dialog(), DialogProps (+6 more)

### Community 57 - "APVendorSearch.tsx"
Cohesion: 0.19
Nodes (10): Props, VendorSearch(), Badge(), BadgeVariant, Props, Coords, getCoords(), Props (+2 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 60 - "mappingSets.ts"
Cohesion: 0.24
Nodes (9): AddError, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels, ActiveScan, PaymentTypesHook (+1 more)

### Community 61 - "Skeleton.tsx"
Cohesion: 0.24
Nodes (8): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRow(), SkeletonRowProps

### Community 62 - "MetricChartImpl.tsx"
Cohesion: 0.18
Nodes (10): LazyMetricChart, axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series, tooltipItemStyle (+2 more)

### Community 63 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 64 - "AppHeader.tsx"
Cohesion: 0.13
Nodes (12): AppHeader(), Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., ConsentGate(), Props, LanguageToggle(), COPY, Lang (+4 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "APInvoice.tsx"
Cohesion: 0.12
Nodes (25): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), Props, APTableRow(), APUploadStep() (+17 more)

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 68 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "TenantsPage.tsx"
Cohesion: 0.15
Nodes (21): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants() (+13 more)

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

### Community 77 - "PmsReviewDocument.tsx"
Cohesion: 0.14
Nodes (18): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+10 more)

### Community 78 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 80 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 81 - "OrderHistory.tsx"
Cohesion: 0.17
Nodes (20): OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode(), planChangeLoss() (+12 more)

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "apInvoicePayload.ts"
Cohesion: 0.33
Nodes (8): useAPSubmission(), addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), normalizeYearToCE(), parseDateToISO()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.15
Nodes (18): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, TourCatalog (+10 more)

### Community 88 - "ReviewDocument.tsx"
Cohesion: 0.22
Nodes (13): OcrExtractionHook, Props, ReviewDocument(), ExtractionWarningBanner(), Props, ExtractionWarning, FIX, fixLinkProps() (+5 more)

### Community 89 - "main.tsx"
Cohesion: 0.06
Nodes (42): adminLogin(), AdminLoginError, LoginResponse, AdminLayout(), getActiveHash(), AdminLogin(), classify(), LoginError (+34 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.08
Nodes (16): en, th, en, th, adminDict, AdminKey, en, th (+8 more)

### Community 92 - "APGroupModal.tsx"
Cohesion: 0.32
Nodes (8): APGroupModal(), profileLabel(), Props, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile(), groupSelected()

### Community 93 - "useMappingData.ts"
Cohesion: 0.49
Nodes (8): prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), parseDefaultAccount()

### Community 94 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 95 - "CheckoutFlow.tsx"
Cohesion: 0.19
Nodes (12): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, PACK_META, ActiveSubscription, getPaymentInfo() (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "storage.ts"
Cohesion: 0.15
Nodes (18): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), A, B (+10 more)

### Community 118 - "useOrderActions.ts"
Cohesion: 0.46
Nodes (6): approveOrder(), holdBatch(), rejectOrder(), updateOrderNote(), useOrderActions(), withName()

### Community 125 - "ExtractionsPage.tsx"
Cohesion: 0.12
Nodes (19): ExtractionFailureRow, DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, Tab, Tabs(), TabsProps (+11 more)

### Community 128 - "ReviewQueue.test.tsx"
Cohesion: 0.29
Nodes (3): doc(), QUIET, ZERO

### Community 129 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 131 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 134 - "DarkModeToggle.tsx"
Cohesion: 0.70
Nodes (3): DarkModeToggle(), isDarkNow(), useDarkMode()

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "useAPSubmission.ts"
Cohesion: 0.13
Nodes (16): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+8 more)

## Knowledge Gaps
- **673 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+668 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `TopLevelConfigSection.tsx`, `APReviewStep.tsx`, `ManualScan.tsx`, `SlipViewer.tsx`, `parseNum`, `purchase.ts`, `screens.tsx`, `bankTransforms.ts`, `useMapping.ts`, `orders.ts`, `useAPSubmission.ts`, `useReviewDocument.ts`, `LanguageContext.tsx`, `EmailAutomationPage.tsx`, `PeriodPicker.tsx`, `PaymentMappingDialog.tsx`, `useSettlementMapping.ts`, `ApiKeysPage.tsx`, `useAPExtraction.ts`, `useNotifications.ts`, `useOcrWizard`, `shared/api/credits.ts`, `adminFetch`, `CreditsPage.tsx`, `DocumentPreview.tsx`, `TKey`, `useAPExtraction`, `QuotaModulesPage.tsx`, `FeatureFlows.tsx`, `OrderWorkspace.tsx`, `DarkModeToggle.tsx`, `useOcrWizard.ts`, `NotificationBell.tsx`, `DataTable.tsx`, `QueueRow.tsx`, `FieldMapping`, `ReviewQueue.tsx`, `SlipUpload.tsx`, `OrderTable.tsx`, `CustomModal.tsx`, `APVendorSearch.tsx`, `MetricChartImpl.tsx`, `MaintenanceGate.tsx`, `AppHeader.tsx`, `APInvoice.tsx`, `APAmountSummary.tsx`, `TenantsPage.tsx`, `OrderActions.tsx`, `PmsReviewDocument.tsx`, `ArCustomerProfiles.tsx`, `OrderHistory.tsx`, `Pricing.tsx`, `ReviewDocument.tsx`, `main.tsx`, `i18n/index.ts`, `APGroupModal.tsx`, `CheckoutFlow.tsx`, `useOrderActions.ts`, `ExtractionsPage.tsx`?**
  _High betweenness centrality (0.216) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `api.ts`, `appKey`, `parseNum`, `useMapping.ts`, `useAPSubmission.ts`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `ocr.ts`, `useAPExtraction.ts`, `useNotifications.ts`, `shared/api/credits.ts`, `useAPSubmission.test.ts`, `QueueRow.tsx`, `ReviewQueue.tsx`, `client.ts`, `carmen.ts`, `useUserConsent.ts`, `PmsReviewDocument.tsx`, `OrderHistory.tsx`, `apInvoicePayload.ts`, `useMappingData.ts`, `CheckoutFlow.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `API` connect `useAPSubmission.ts` to `api.ts`, `orders.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `ocr.ts`, `ApiKeysPage.tsx`, `apiFetch`, `useAPExtraction.ts`, `useNotifications.ts`, `shared/api/credits.ts`, `adminFetch`, `CreditsPage.tsx`, `useAPExtraction`, `QuotaModulesPage.tsx`, `EmailSettings.tsx`, `ReviewQueue.tsx`, `carmen.ts`, `useUserConsent.ts`, `TenantsPage.tsx`, `PmsReviewDocument.tsx`, `main.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _673 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TopLevelConfigSection.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._