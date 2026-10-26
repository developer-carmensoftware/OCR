# Graph Report - OCR  (2026-10-26)

## Corpus Check
- 421 files · ~309,763 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2234 nodes · 6234 edges · 152 communities (97 shown, 55 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b311e3b0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useMappingData.ts
- APReviewStep.tsx
- dict/index.ts
- ccJv.ts
- useMappingSuggestions.ts
- PmsReviewDocument.tsx
- parseNum
- TutorialModal.tsx
- screens.tsx
- useOcrWizard.ts
- useMapping.ts
- adminFetch
- APInvoice.tsx
- useSettlementMapping.ts
- AdminRouter.tsx
- EmailAutomationPage.tsx
- CustomSearchSelect.tsx
- useReviewDocument.ts
- Mapping.tsx
- useT
- api.ts
- compilerOptions
- 5. Components
- useFileUpload.ts
- AdminLogin.tsx
- usePmsReview.ts
- devDependencies
- shared/api/credits.ts
- Overview.tsx
- showToast
- CreditsPage.tsx
- DocumentPreview.tsx
- dependencies
- ManualScan.tsx
- FieldMapping
- APTableRow.tsx
- unwrapDetail
- FeatureFlows.tsx
- OrderHistory.tsx
- NotificationBell.tsx
- useOcrWizard
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- EmailSettings.tsx
- PeriodPicker.tsx
- QueueRow.tsx
- useAPSubmission.ts
- ReviewQueue.tsx
- adminAuth.ts
- scripts
- JvEditor.tsx
- MaintenanceGate.tsx
- apiFetch
- compilerOptions
- useScrollLock
- SlipUpload.tsx
- LanguageProvider
- CLAUDE.md
- Contributing
- i18n/common.ts
- i18n/credits.ts
- contact.ts
- i18n/email.ts
- TKey
- Carmen AI — OCR & Import System
- Skeleton.tsx
- APAmountSummary.tsx
- DataTable.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- ExtractionsPage.tsx
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- llmLogs.ts
- flows.ts
- vercel.json
- Architecture
- performance.ts
- OrderStatusBadge.tsx
- Mapping.test.tsx
- reviewReasons.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- Pricing.tsx
- storage.ts
- main.tsx
- pack.ts
- i18n/index.ts
- qr.ts
- sessions.ts
- usePdfPasswordPrompt
- i18n/tenants.ts
- checkout.ts
- vite-env.d.ts
- postcss
- mockPaths.test.ts
- shared/api/auth.ts
- @testing-library/dom
- typescript
- dict/maintenance.ts
- orev.ts
- pms.ts
- pricing.ts
- proforma.ts
- quota.ts
- login.ts
- slip.ts
- warn.ts
- @testing-library/react
- eslint
- cc.ts
- dict/apiKeys.ts
- TenantSelector.test.tsx
- ar.ts
- TenantsPage.tsx
- dict/common.ts
- i18n/maintenance.ts
- i18n/quotas.ts
- home.ts
- @types/react-dom
- AccountingReview.tsx
- ApiKeysPage.test.tsx
- APAccountMappingStep.tsx
- vite
- useAPExtraction.ts
- plan.ts
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- dict/nav.ts
- order.ts
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
- AppHeader.tsx
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

## Communities (152 total, 55 thin omitted)

### Community 0 - "useMappingData.ts"
Cohesion: 0.20
Nodes (21): MappingRow(), Props, Props, Props, STATUS_LABEL, Props, MappingSet, MappingStatus (+13 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.19
Nodes (16): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+8 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.13
Nodes (12): en, th, DICT, en, th, translate(), en, th (+4 more)

### Community 3 - "ccJv.ts"
Cohesion: 0.11
Nodes (26): AccountingReview(), JvHeaderCard(), Props, TopLevelConfigSection(), useGlMasters(), descriptionForBank(), CONFIG, leg() (+18 more)

### Community 4 - "useMappingSuggestions.ts"
Cohesion: 0.14
Nodes (23): AccountMappingTable(), GLAccount, Props, suggestMapping(), suggestPaymentTypes(), MainMappingTable(), Props, BulkApplyBar() (+15 more)

### Community 5 - "PmsReviewDocument.tsx"
Cohesion: 0.18
Nodes (11): usePmsReview(), approve(), reject(), dmy(), fmtAmount(), nameOf(), PmsReviewDocument(), Props (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.12
Nodes (38): AmountSummary(), APGroupModal(), profileLabel(), Props, getAvailableFields(), useAPGrouping(), useAPInvoice(), adjustField() (+30 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "screens.tsx"
Cohesion: 0.09
Nodes (29): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+21 more)

### Community 9 - "useOcrWizard.ts"
Cohesion: 0.16
Nodes (16): ApDraft, useAPDraft(), APDraftState, mountRestored(), TAX_PROFILES, APInvoice(), inputTaxOwed(), draftWorthOffering() (+8 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.12
Nodes (23): saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, COMPANY_FIELDS, CompanyField, rulesPrint(), getAccountingConfig (+15 more)

### Community 11 - "adminFetch"
Cohesion: 0.06
Nodes (61): AdminCreditOrder, AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminOrderDocuments(), fetchAdminPaymentInfo(), fetchKpi(), getOrderSlipUrl() (+53 more)

### Community 12 - "APInvoice.tsx"
Cohesion: 0.15
Nodes (17): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APTableRow(), APUploadStep(), INSTRUCTIONS (+9 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.19
Nodes (17): ARMappingItem, ARPreview, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+9 more)

### Community 14 - "AdminRouter.tsx"
Cohesion: 0.27
Nodes (10): AdminLayout(), getActiveHash(), AdminLogin, AdminRouter(), getRoute(), ADMIN_ROUTES, NAV_SECTIONS, AdminRouter (+2 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "CustomSearchSelect.tsx"
Cohesion: 0.24
Nodes (5): CustomSearchSelect(), handleScroll(), panelStyle(), Props, OPTIONS

### Community 17 - "useReviewDocument.ts"
Cohesion: 0.09
Nodes (35): diffCorrections(), JvState, getAccountingConfig, seedOcrBranch(), MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig (+27 more)

### Community 18 - "Mapping.tsx"
Cohesion: 0.26
Nodes (11): MappingTable(), Filter, orderOf(), PaymentMappingDialog(), isMapped(), SetStats, statsOf(), STATUS_RANK (+3 more)

### Community 19 - "useT"
Cohesion: 0.07
Nodes (43): Props, RevokeKeyDialog(), Props, StatusLine(), UrlText(), ActionsAction, actionsInitial, actionsReducer() (+35 more)

### Community 20 - "api.ts"
Cohesion: 0.08
Nodes (34): bankCodeFromHash(), BankConfigHook, useBankConfig(), codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape() (+26 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "useFileUpload.ts"
Cohesion: 0.19
Nodes (8): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), sanitizedPdfUrl(), stripAutoOpen()

### Community 24 - "AdminLogin.tsx"
Cohesion: 0.30
Nodes (8): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss()

### Community 25 - "usePmsReview.ts"
Cohesion: 0.31
Nodes (9): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+1 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, eslint-plugin-react-hooks, devDependencies, autoprefixer, @eslint/js, eslint-plugin-react-hooks, globals (+15 more)

### Community 27 - "shared/api/credits.ts"
Cohesion: 0.12
Nodes (26): Props, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER, loadPersistedCheckout(), persist(), readPersisted() (+18 more)

### Community 28 - "Overview.tsx"
Cohesion: 0.11
Nodes (23): fetchUsageSummary(), fetchUsageTotals(), KPICard(), KPICardProps, LazyMetricChart, MetricChart(), axisTick, ChartType (+15 more)

### Community 29 - "showToast"
Cohesion: 0.11
Nodes (20): DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps, extractFromFile, MOCK_EXTRACTED (+12 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.23
Nodes (14): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance() (+6 more)

### Community 31 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+9 more)

### Community 33 - "ManualScan.tsx"
Cohesion: 0.12
Nodes (18): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+10 more)

### Community 34 - "FieldMapping"
Cohesion: 0.21
Nodes (15): ARPreviewRequest, SuggestResponse, AddError, MappingItem, Undo, FeeInvoiceSource, MappingSetsInput, labels (+7 more)

### Community 35 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 36 - "unwrapDetail"
Cohesion: 0.13
Nodes (28): unwrapDetail(), fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), AdminUserRow (+20 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "OrderHistory.tsx"
Cohesion: 0.11
Nodes (29): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), RowState, SLIP, catalogName() (+21 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (39): WhatsNew(), WhatsNew, BellItem, listNotifications(), markNotificationsRead(), Notification, docLabel(), isCollapsed() (+31 more)

### Community 40 - "useOcrWizard"
Cohesion: 0.15
Nodes (18): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), getPdfInfoWithRetry(), useOcrWizard(), handleCancel() (+10 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 43 - "date.ts"
Cohesion: 0.47
Nodes (7): DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE(), parseDateToISO(), parseDDMMYYYYToDate()

### Community 44 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (55): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+47 more)

### Community 45 - "PeriodPicker.tsx"
Cohesion: 0.08
Nodes (60): fetchAlerts(), fetchJobs(), fetchSessions(), resolveAlert(), revokeSession(), fetchErrorBreakdown(), fetchLLMLogs(), fetchPerformanceLogs() (+52 more)

### Community 46 - "QueueRow.tsx"
Cohesion: 0.20
Nodes (16): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), Props, QueueRow() (+8 more)

### Community 47 - "useAPSubmission.ts"
Cohesion: 0.10
Nodes (23): Args, APExtractionProps, APSubmissionProps, GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes (+15 more)

### Community 48 - "ReviewQueue.tsx"
Cohesion: 0.13
Nodes (13): ACTIVITY_FILTERS, COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), pmsIdFromHash() (+5 more)

### Community 49 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "JvEditor.tsx"
Cohesion: 0.17
Nodes (12): BlockReason, BU_WIDE, JvEditor(), Overrides, Props, rowId(), groupKey(), Settlement (+4 more)

### Community 52 - "MaintenanceGate.tsx"
Cohesion: 0.31
Nodes (9): countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe(), Props (+1 more)

### Community 53 - "apiFetch"
Cohesion: 0.09
Nodes (33): APVendorProps, useAPVendor(), ActivityFilter, ActivityPage, approveDocument(), ApproveResult, getPending(), listActivity() (+25 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "useScrollLock"
Cohesion: 0.20
Nodes (8): Dialog(), DialogProps, focusablesIn(), Options, useDialogFocus(), __resetScrollLock(), Locker(), useScrollLock()

### Community 56 - "SlipUpload.tsx"
Cohesion: 0.29
Nodes (4): ACCEPTED, Props, SLIP, MAX_FILE_SIZE_MB

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 64 - "TKey"
Cohesion: 0.14
Nodes (15): BatchAction, BatchActionBar(), Props, NavItem, NavSection, ACTIVE_TAG, containerVariants, Home() (+7 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "Skeleton.tsx"
Cohesion: 0.28
Nodes (7): ExtractionSkeleton(), Props, Skeleton(), SkeletonGrid(), SkeletonGridProps, SkeletonProps, SkeletonRowProps

### Community 67 - "APAmountSummary.tsx"
Cohesion: 0.16
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Props, VendorSearch() (+4 more)

### Community 68 - "DataTable.tsx"
Cohesion: 0.11
Nodes (19): DataTableProps, ExpandedRowWrapperProps, ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS, Extra, readHashParams() (+11 more)

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
Cohesion: 0.19
Nodes (14): ExtractionFailureRow, fetchExtractionFailures(), Tab, Tabs(), TabsProps, causeLabel(), classify(), ERROR_RULES (+6 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 78 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 79 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 81 - "OrderStatusBadge.tsx"
Cohesion: 0.50
Nodes (3): MAP, OrderStatusBadge(), OrderStatus

### Community 82 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 83 - "reviewReasons.ts"
Cohesion: 0.21
Nodes (10): RowAction(), ReviewDocument(), ExtractionWarningBanner(), FIX, fixLinkProps(), REASON_KEY, SETTINGS, warningText() (+2 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "Pricing.tsx"
Cohesion: 0.10
Nodes (34): CheckoutFlow(), itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, PackList(), Props, EnterpriseCard(), PlanCard() (+26 more)

### Community 88 - "storage.ts"
Cohesion: 0.06
Nodes (50): exchangeSSOToken(), revokeSession(), CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, clearToken(), storeToken(), getConsentStatus(), postConsent() (+42 more)

### Community 89 - "main.tsx"
Cohesion: 0.10
Nodes (14): APInvoice, container, EmailSettings, getRoute(), Home, ManualScan, Mapping, OrderHistory (+6 more)

### Community 91 - "i18n/index.ts"
Cohesion: 0.05
Nodes (24): en, th, en, th, en, th, en, th (+16 more)

### Community 94 - "usePdfPasswordPrompt"
Cohesion: 0.18
Nodes (12): ApiError, PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt() (+4 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "shared/api/auth.ts"
Cohesion: 0.16
Nodes (15): useOrderHistory(), OrderHistory(), parseFocusId(), Pricing(), getUsage(), UsageData, getStoredToken(), T (+7 more)

### Community 125 - "TenantsPage.tsx"
Cohesion: 0.15
Nodes (21): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants() (+13 more)

### Community 137 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (20): ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, configBanks, DetailRow, Props, Props, Props (+12 more)

### Community 138 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 139 - "APAccountMappingStep.tsx"
Cohesion: 0.16
Nodes (11): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+3 more)

### Community 141 - "useAPExtraction.ts"
Cohesion: 0.11
Nodes (23): EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, apiFetch, getAPVendorMapping, getPdfInfo, getUsage (+15 more)

### Community 166 - "notif.ts"
Cohesion: 0.27
Nodes (4): en, th, en, th

### Community 169 - "AppHeader.tsx"
Cohesion: 0.18
Nodes (9): OrderReviewShell(), registerDict(), OrderReviewShell, Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle(), LanguageToggle(), isDarkNow() (+1 more)

## Knowledge Gaps
- **666 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+661 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useMappingData.ts`, `APReviewStep.tsx`, `ccJv.ts`, `useMappingSuggestions.ts`, `PmsReviewDocument.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `useOcrWizard.ts`, `AccountingReview.tsx`, `adminFetch`, `APAccountMappingStep.tsx`, `APInvoice.tsx`, `AdminRouter.tsx`, `EmailAutomationPage.tsx`, `useAPExtraction.ts`, `useMapping.ts`, `Mapping.tsx`, `useSettlementMapping.ts`, `useReviewDocument.ts`, `CustomSearchSelect.tsx`, `api.ts`, `AdminLogin.tsx`, `usePmsReview.ts`, `shared/api/credits.ts`, `Overview.tsx`, `CreditsPage.tsx`, `DocumentPreview.tsx`, `ManualScan.tsx`, `unwrapDetail`, `FeatureFlows.tsx`, `OrderHistory.tsx`, `NotificationBell.tsx`, `useOcrWizard`, `AppHeader.tsx`, `PeriodPicker.tsx`, `QueueRow.tsx`, `ReviewQueue.tsx`, `JvEditor.tsx`, `MaintenanceGate.tsx`, `apiFetch`, `SlipUpload.tsx`, `TKey`, `APAmountSummary.tsx`, `DataTable.tsx`, `ExtractionsPage.tsx`, `OrderStatusBadge.tsx`, `reviewReasons.ts`, `Pricing.tsx`, `storage.ts`, `shared/api/auth.ts`, `TenantsPage.tsx`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useMappingData.ts`, `useMappingSuggestions.ts`, `parseNum`, `OrderHistory.tsx`, `NotificationBell.tsx`, `useOcrWizard.ts`, `useMapping.ts`, `AccountingReview.tsx`, `useSettlementMapping.ts`, `useAPExtraction.ts`, `useAPSubmission.ts`, `QueueRow.tsx`, `useReviewDocument.ts`, `useFileUpload.ts`, `Pricing.tsx`, `storage.ts`, `usePmsReview.ts`, `shared/api/credits.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `API` connect `apiFetch` to `unwrapDetail`, `shared/api/auth.ts`, `AccountingReview.tsx`, `adminFetch`, `EmailSettings.tsx`, `PeriodPicker.tsx`, `useAPExtraction.ts`, `EmailAutomationPage.tsx`, `useAPSubmission.ts`, `useSettlementMapping.ts`, `adminAuth.ts`, `useT`, `useMapping.ts`, `AdminLogin.tsx`, `usePmsReview.ts`, `shared/api/credits.ts`, `TenantsPage.tsx`, `CreditsPage.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _666 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._
- **Should `ccJv.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10634920634920635 - nodes in this community are weakly interconnected._
- **Should `useMappingSuggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._