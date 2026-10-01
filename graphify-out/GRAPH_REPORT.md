# Graph Report - OCR  (2026-10-01)

## Corpus Check
- 400 files · ~290,211 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2132 nodes · 5905 edges · 164 communities (110 shown, 54 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e00e198b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- endpoints.ts
- OrderWorkspace.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- PeriodPicker.tsx
- orders.ts
- OrderHistory.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- ccJv.ts
- FieldMapping
- adminFetch
- NotificationBell.tsx
- AdminRouter.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- InputTaxReconciliation.tsx
- APInvoice.tsx
- devDependencies
- useOcrExtraction.ts
- adminAuth.ts
- showToast
- CreditsPage.tsx
- OrderTable.tsx
- dependencies
- PaymentMappingDialog.tsx
- ExtractionsPage.tsx
- MainMappingTable.tsx
- AppHeader.test.tsx
- FeatureFlows.tsx
- useAPSubmission.test.ts
- WhatsNew.tsx
- useAPExtraction.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- useAPSubmission.ts
- QueueRow.tsx
- QuotaModulesPage.tsx
- DocumentPreview.tsx
- AdminLogin.tsx
- usePdfPasswordPrompt
- useAuth
- scripts
- ProformaDocument.tsx
- useAccountingConfig.ts
- apiFetch
- compilerOptions
- useT
- shared/api/credits.ts
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- InlineSelect.tsx
- emailReview.ts
- ManualScan.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageProvider
- useCheckout.ts
- main.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction.test.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- OrderDrawer.tsx
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- Mapping.tsx
- i18n/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APAccountMappingStep.tsx
- Pricing.tsx
- APVendorSearch.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- JvEditor.tsx
- AccountingReview.tsx
- vitest
- vite-env.d.ts
- Home.tsx
- mockPaths.test.ts
- i18n/quotas.ts
- HeaderCard.tsx
- TenantSelector.test.tsx
- useEmailSettings.ts
- anomalies.ts
- useMappingData.ts
- LanguageContext.tsx
- i18n/common.ts
- TenantsPage.tsx
- ArCustomerProfiles.tsx
- CustomModal.tsx
- TKey
- ErrorBoundary
- NotificationBell.test.tsx
- releaseNotes.ts
- ar.ts
- client.ts
- useMapping.ts
- StepWizard.tsx
- getCarmenUrl
- performance.ts
- dict/ap.ts
- OrderTable.test.tsx
- i18n/email.ts
- @types/react
- errors.ts
- contact.ts
- @types/react-dom
- orev.ts
- dict/common.ts
- pack.ts
- dict/maintenance.ts
- notif.ts
- proforma.ts
- extractions.ts
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
- i18n/maintenance.ts
- order.ts
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md
- i18n/usage.ts
- flows.ts
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
- `MetricChart()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/MetricChartImpl.tsx → frontend/src/i18n/LanguageContext.tsx
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts

## Import Cycles
- None detected.

## Communities (164 total, 54 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.15
Nodes (18): ApDraft, Args, useAPDraft(), APDraftState, mountRestored(), TAX_PROFILES, APVendorProps, useAPVendor() (+10 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (21): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+13 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.09
Nodes (16): en, th, DICT, en, th, translate(), en, th (+8 more)

### Community 3 - "endpoints.ts"
Cohesion: 0.22
Nodes (11): ActivityPage, API, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page (+3 more)

### Community 4 - "OrderWorkspace.tsx"
Cohesion: 0.17
Nodes (12): CreditLedgerEntry, fetchAdminOrderDocuments(), getOrderSlipUrl(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction (+4 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.11
Nodes (16): ACTIVITY_FILTERS, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty() (+8 more)

### Community 6 - "parseNum"
Cohesion: 0.19
Nodes (23): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+15 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.12
Nodes (22): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+14 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (30): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+22 more)

### Community 9 - "api.ts"
Cohesion: 0.10
Nodes (20): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, JvEditor(), rowId(), MappingSuggestionsHook, useMappingSuggestions() (+12 more)

### Community 10 - "PeriodPicker.tsx"
Cohesion: 0.11
Nodes (36): buildQs(), fetchAlerts(), fetchErrorBreakdown(), fetchLLMLogs(), fetchPerformanceLogs(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals() (+28 more)

### Community 11 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 12 - "OrderHistory.tsx"
Cohesion: 0.10
Nodes (23): PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, useOrderHistory(), OrderHistory(), parseFocusId(), Pricing() (+15 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.12
Nodes (24): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+16 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "ccJv.ts"
Cohesion: 0.12
Nodes (24): JvHeaderCard(), TopLevelConfigSection(), useGlMasters(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES (+16 more)

### Community 17 - "FieldMapping"
Cohesion: 0.28
Nodes (12): AddError, MappingItem, SetStats, Undo, FeeInvoiceSource, MappingSetsInput, labels, ActiveScan (+4 more)

### Community 18 - "adminFetch"
Cohesion: 0.25
Nodes (20): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), AdminUserRow, createAdminUser() (+12 more)

### Community 19 - "NotificationBell.tsx"
Cohesion: 0.25
Nodes (12): docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy(), TFn (+4 more)

### Community 20 - "AdminRouter.tsx"
Cohesion: 0.15
Nodes (13): adminDict, AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS (+5 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.23
Nodes (12): revokeSession(), createApiClient(), resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute() (+4 more)

### Community 24 - "InputTaxReconciliation.tsx"
Cohesion: 0.25
Nodes (12): ItxOverrides, InputTaxPanel(), Props, InputTaxReconciliation(), handleAddInputTax(), fetchTaxProfiles(), _parseCarmenHttpError(), submitInputTax() (+4 more)

### Community 25 - "APInvoice.tsx"
Cohesion: 0.14
Nodes (16): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props (+8 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "useOcrExtraction.ts"
Cohesion: 0.11
Nodes (24): DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionHook, OcrExtractionProps, persistScanForMapping(), extractFromFile, MOCK_EXTRACTED (+16 more)

### Community 28 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 29 - "showToast"
Cohesion: 0.15
Nodes (17): rejectDocument(), useOcrExtraction(), processFile(), reExtract(), showDuplicateModal(), useOcrWizard(), handleCancel(), reExtract() (+9 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.40
Nodes (9): adjustCredits(), CreditBalance, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel(), CreditsPage() (+1 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "PaymentMappingDialog.tsx"
Cohesion: 0.20
Nodes (19): Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf(), PaymentMappingDialog() (+11 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.12
Nodes (20): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, EmptyState(), EmptyStateProps, Tab, Tabs() (+12 more)

### Community 35 - "MainMappingTable.tsx"
Cohesion: 0.11
Nodes (20): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, MappingRow(), BulkApplyBar(), MainMappings (+12 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPSubmission.test.ts"
Cohesion: 0.15
Nodes (11): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+3 more)

### Community 39 - "WhatsNew.tsx"
Cohesion: 0.21
Nodes (11): WhatsNew(), WhatsNew, listNotifications, markNotificationsRead, page(), SERVER_ROW, setup(), markReleaseSeen() (+3 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (23): APExtractionProps, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction(), Args, imagesToPdf() (+15 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (15): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, configBanks, configWaits (+7 more)

### Community 43 - "useAPSubmission.ts"
Cohesion: 0.35
Nodes (9): GLAccount, useAPSubmission(), addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, formatCarmenError(), parseCarmenDupError(), submitAPInvoiceToCarmen() (+1 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.25
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+5 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.15
Nodes (17): QueryParams, fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), getTabs() (+9 more)

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
Cohesion: 0.13
Nodes (17): exchangeSSOToken(), CARMEN_RAW_TOKEN_KEY, AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps (+9 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "ProformaDocument.tsx"
Cohesion: 0.27
Nodes (11): expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), _hundreds(), _ONES (+3 more)

### Community 52 - "useAccountingConfig.ts"
Cohesion: 0.29
Nodes (8): AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig(), AccountingConfig, readAccountingConfig()

### Community 53 - "apiFetch"
Cohesion: 0.09
Nodes (30): approveDocument(), Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), OcrSubmissionHook, CarmenJvPayload, defaultConfig (+22 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "useT"
Cohesion: 0.11
Nodes (44): fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), Column, DataTable(), DataTableProps, ExpandedRowWrapperProps (+36 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (28): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, OrderRow(), RowAction, rowInitial, rowReducer() (+20 more)

### Community 57 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "InlineSelect.tsx"
Cohesion: 0.40
Nodes (4): InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 62 - "emailReview.ts"
Cohesion: 0.19
Nodes (12): ActivityFilter, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail, ReviewFlag, Props (+4 more)

### Community 63 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (21): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+13 more)

### Community 64 - "APLineItem"
Cohesion: 0.28
Nodes (10): APGroupModal(), profileLabel(), Props, useAPGrouping(), APValidationProps, apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+2 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.15
Nodes (10): MAP, OrderStatusBadge(), ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), readLang() (+2 more)

### Community 67 - "useCheckout.ts"
Cohesion: 0.19
Nodes (14): CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted(), CatalogState (+6 more)

### Community 68 - "main.tsx"
Cohesion: 0.16
Nodes (11): APInvoice, container, EmailSettings, getRoute(), Home, ManualScan, Mapping, OrderHistory (+3 more)

### Community 69 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 70 - "Coding Skills & Principles"
Cohesion: 0.29
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 71 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 72 - "useAPExtraction.test.ts"
Cohesion: 0.14
Nodes (14): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+6 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "OrderDrawer.tsx"
Cohesion: 0.26
Nodes (8): AdminCreditOrder, OrderDrawer(), Props, Props, WsState, __resetScrollLock(), Locker(), useScrollLock()

### Community 77 - "useUserConsent.ts"
Cohesion: 0.29
Nodes (10): getConsentStatus(), postConsent(), ConsentGate(), Props, AuthUser, cacheConsent(), consentKey(), readCached() (+2 more)

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.40
Nodes (5): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts)

### Community 80 - "i18n/index.ts"
Cohesion: 0.06
Nodes (23): en, th, en, th, en, th, AdminKey, en (+15 more)

### Community 81 - "Mapping.tsx"
Cohesion: 0.19
Nodes (8): buildMappingSets(), Mapping(), bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APAccountMappingStep.tsx"
Cohesion: 0.15
Nodes (12): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+4 more)

### Community 88 - "Pricing.tsx"
Cohesion: 0.16
Nodes (21): Props, PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS (+13 more)

### Community 89 - "APVendorSearch.tsx"
Cohesion: 0.24
Nodes (9): Props, VendorSearch(), APSubmissionProps, Vendor, Coords, getCoords(), Props, Tooltip() (+1 more)

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 94 - "JvEditor.tsx"
Cohesion: 0.12
Nodes (26): getPending(), Props, ARReviewPane(), labelOf(), Props, DetailRow, Props, BlockReason (+18 more)

### Community 95 - "AccountingReview.tsx"
Cohesion: 0.13
Nodes (17): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape() (+9 more)

### Community 103 - "Home.tsx"
Cohesion: 0.17
Nodes (12): ACTIVE_TAG, containerVariants, Home(), itemVariants, Module, MODULES, TagConfig, DarkModeToggle() (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 106 - "HeaderCard.tsx"
Cohesion: 0.25
Nodes (7): DATE_KEYS, HeaderCard(), Props, DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 108 - "useEmailSettings.ts"
Cohesion: 0.08
Nodes (40): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+32 more)

### Community 110 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 111 - "LanguageContext.tsx"
Cohesion: 0.12
Nodes (16): LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart(), MetricChartProps, Series (+8 more)

### Community 113 - "TenantsPage.tsx"
Cohesion: 0.14
Nodes (17): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, KPICard() (+9 more)

### Community 114 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 115 - "CustomModal.tsx"
Cohesion: 0.24
Nodes (6): CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG, REASON_KEY

### Community 116 - "TKey"
Cohesion: 0.20
Nodes (9): BatchAction, BatchActionBar(), Props, NavItem, NavSection, INSTRUCTIONS, Props, UploadSection() (+1 more)

### Community 117 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 118 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 119 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 121 - "client.ts"
Cohesion: 0.20
Nodes (14): API_BASE, ApiClientOptions, clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), clearAllDrafts() (+6 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.11
Nodes (30): saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, Props, bankCodeFromHash(), BankConfigHook, getAccountingConfig (+22 more)

### Community 123 - "StepWizard.tsx"
Cohesion: 0.40
Nodes (4): DEFAULT_STEPS, Props, Step, StepWizard()

### Community 124 - "getCarmenUrl"
Cohesion: 0.20
Nodes (11): AppHeader(), Props, LanguageToggle(), COPY, Lang, Props, useIsMobile(), UserConsentModal() (+3 more)

## Knowledge Gaps
- **642 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+637 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APReviewStep.tsx`, `OrderWorkspace.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `api.ts`, `PeriodPicker.tsx`, `orders.ts`, `OrderHistory.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `ccJv.ts`, `adminFetch`, `NotificationBell.tsx`, `AdminRouter.tsx`, `MaintenanceGate.tsx`, `InputTaxReconciliation.tsx`, `APInvoice.tsx`, `showToast`, `CreditsPage.tsx`, `OrderTable.tsx`, `PaymentMappingDialog.tsx`, `ExtractionsPage.tsx`, `MainMappingTable.tsx`, `FeatureFlows.tsx`, `WhatsNew.tsx`, `useAPExtraction.ts`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `DocumentPreview.tsx`, `AdminLogin.tsx`, `ProformaDocument.tsx`, `shared/api/credits.ts`, `OrderActions.tsx`, `ManualScan.tsx`, `APLineItem`, `LanguageProvider`, `OrderDrawer.tsx`, `Mapping.tsx`, `APAccountMappingStep.tsx`, `Pricing.tsx`, `APVendorSearch.tsx`, `APAmountSummary.tsx`, `JvEditor.tsx`, `AccountingReview.tsx`, `Home.tsx`, `HeaderCard.tsx`, `LanguageContext.tsx`, `TenantsPage.tsx`, `ArCustomerProfiles.tsx`, `CustomModal.tsx`, `TKey`, `useMapping.ts`, `getCarmenUrl`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useOcrWizard.ts`, `endpoints.ts`, `parseNum`, `api.ts`, `OrderHistory.tsx`, `useSettlementMapping.ts`, `InputTaxReconciliation.tsx`, `useOcrExtraction.ts`, `showToast`, `useAPSubmission.test.ts`, `useAPExtraction.ts`, `useAPSubmission.ts`, `shared/api/credits.ts`, `emailReview.ts`, `useCheckout.ts`, `useAPExtraction.test.ts`, `useUserConsent.ts`, `JvEditor.tsx`, `useMappingData.ts`, `client.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrWizard.ts`, `useAPSubmission.test.ts`, `parseNum`, `useAPExtraction.ts`, `api.ts`, `useAPSubmission.ts`, `useEmailSettings.ts`, `apiFetch`, `client.ts`, `useMapping.ts`, `useOcrExtraction.ts`, `JvEditor.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _642 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useOcrWizard.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._
- **Should `APReviewStep.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09486166007905138 - nodes in this community are weakly interconnected._