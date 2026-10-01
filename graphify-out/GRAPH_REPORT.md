# Graph Report - OCR  (2026-10-01)

## Corpus Check
- 400 files · ~288,405 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2130 nodes · 5900 edges · 161 communities (103 shown, 58 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `079be4f3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAPDraft.ts
- APReviewStep.tsx
- dict/index.ts
- adminFetch
- JvEditor.tsx
- ReviewQueue.tsx
- parseNum
- TutorialModal.tsx
- useT
- api.ts
- FieldMapping
- orders.ts
- UsageIndicator.tsx
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- AccountingReview.tsx
- MainMappingTable.tsx
- useMappingSuggestions.ts
- NotificationBell.tsx
- routes.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- carmen.ts
- APFieldMappingStep.tsx
- devDependencies
- banks.ts
- endpoints.ts
- useOcrWizard
- OrderWorkspace.tsx
- OrderTable.tsx
- dependencies
- payment-mapping/types.ts
- ExtractionsPage.tsx
- CustomSearchSelect.tsx
- LanguageContext.tsx
- FeatureFlows.tsx
- useAPSubmission.ts
- useNotifications.ts
- useAPExtraction.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- date.ts
- QueueRow.tsx
- QuotaModulesPage.tsx
- DocumentPreview.tsx
- AdminLogin.tsx
- useOcrWizard.ts
- ProtectedRoute.tsx
- scripts
- OrderHistory.tsx
- appKey
- apiFetch
- compilerOptions
- PeriodPicker.tsx
- shared/api/credits.ts
- APInvoice.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- APTableRow.tsx
- emailReview.ts
- DetailTable.tsx
- APGroupModal.tsx
- Carmen AI — OCR & Import System
- LanguageProvider
- client.ts
- main.tsx
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction.test.ts
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- CheckoutFlow.tsx
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- Mapping.test.tsx
- i18n/nav.ts
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- reviewReasons.ts
- ARReviewPane.tsx
- Tooltip.tsx
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- ReviewDocument.tsx
- useAuth
- vitest
- vite-env.d.ts
- TKey
- mockPaths.test.ts
- i18n/quotas.ts
- useNotifications.test.ts
- adminUsers.ts
- showToast
- anomalies.ts
- chrome.ts
- TenantSelector.tsx
- i18n/common.ts
- login.ts
- i18n/credits.ts
- errors.ts
- extractions.ts
- i18n/usage.ts
- sessions.ts
- llmLogs.ts
- ar.ts
- AuthContext.tsx
- useMapping.ts
- DataTable.tsx
- storage.ts
- i18n/maintenance.ts
- dict/ap.ts
- cc.ts
- i18n/tenants.ts
- @types/react
- userUsage.ts
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
- plan.ts

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
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (161 total, 58 thin omitted)

### Community 0 - "useAPDraft.ts"
Cohesion: 0.26
Nodes (10): useAPDraft(), mountRestored(), TAX_PROFILES, clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor() (+2 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.22
Nodes (14): APLineItemsTable(), Props, Ctrl, Props, APTableFooter(), Props, APTableHeader(), Props (+6 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 3 - "adminFetch"
Cohesion: 0.24
Nodes (21): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenants(), AdminUserRow (+13 more)

### Community 4 - "JvEditor.tsx"
Cohesion: 0.16
Nodes (17): ItxOverrides, Props, DetailRow, Props, Props, BlockReason, BU_WIDE, JvState (+9 more)

### Community 5 - "ReviewQueue.tsx"
Cohesion: 0.14
Nodes (11): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+3 more)

### Community 6 - "parseNum"
Cohesion: 0.16
Nodes (30): AmountSummary(), APStep, getAvailableFields(), NUMERIC_FIELDS, useAPInvoice(), adjustField(), DocRepair, reconcileRows() (+22 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.14
Nodes (20): Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm(), STEPS, TutorialModal() (+12 more)

### Community 8 - "useT"
Cohesion: 0.08
Nodes (50): PackList(), Props, PendingOrderBanner(), EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS (+42 more)

### Community 9 - "api.ts"
Cohesion: 0.07
Nodes (29): BANK_LOGOS, BankDetectionBanner(), Props, Props, ManualScan, submitInputTax(), ExtractionSkeleton(), Props (+21 more)

### Community 10 - "FieldMapping"
Cohesion: 0.19
Nodes (15): ARPreviewRequest, SuggestResponse, AddError, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels (+7 more)

### Community 11 - "orders.ts"
Cohesion: 0.12
Nodes (30): AdminOrderStatus, approveOrder(), ArCustomerProfile, fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem (+22 more)

### Community 12 - "UsageIndicator.tsx"
Cohesion: 0.27
Nodes (7): UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.17
Nodes (17): ARMappingItem, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES, PostType, previewARJv() (+9 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.13
Nodes (21): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, JvHeaderCard(), TopLevelConfigSection(), useGlMasters(), codeToSource(), descriptionForBank() (+13 more)

### Community 17 - "MainMappingTable.tsx"
Cohesion: 0.16
Nodes (18): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, BulkApplyBar(), MainMappings, MainMappingKey (+10 more)

### Community 18 - "useMappingSuggestions.ts"
Cohesion: 0.29
Nodes (9): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, JvEditor(), rowId(), useMappingSuggestions(), accountName(), SuggestPaymentTypesRequest (+1 more)

### Community 19 - "NotificationBell.tsx"
Cohesion: 0.20
Nodes (15): BellItem, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell(), notifText(), REASON_SHORT, releaseCopy() (+7 more)

### Community 20 - "routes.tsx"
Cohesion: 0.21
Nodes (12): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, Overview (+4 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (23): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+15 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): getStoredToken(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "carmen.ts"
Cohesion: 0.32
Nodes (13): useAPSubmission(), GlMasters, prefetchGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+5 more)

### Community 25 - "APFieldMappingStep.tsx"
Cohesion: 0.21
Nodes (11): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APTableRow(), APFieldKey, FieldOption, isNumFld() (+3 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "banks.ts"
Cohesion: 0.15
Nodes (22): Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape() (+14 more)

### Community 28 - "endpoints.ts"
Cohesion: 0.18
Nodes (18): buildQs(), QueryParams, ModuleUsageRow, QuotaOverviewResponse, TenantSubscriptionSummary, TenantDetail, TenantModuleRow, TenantSessionRow (+10 more)

### Community 29 - "useOcrWizard"
Cohesion: 0.10
Nodes (27): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), useOcrExtraction(), applyExtractedData(), processFile() (+19 more)

### Community 30 - "OrderWorkspace.tsx"
Cohesion: 0.11
Nodes (26): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), fetchAdminOrderDocuments() (+18 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.09
Nodes (27): AdminCreditOrder, ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS (+19 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "payment-mapping/types.ts"
Cohesion: 0.21
Nodes (21): MappingRow(), Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf() (+13 more)

### Community 34 - "ExtractionsPage.tsx"
Cohesion: 0.11
Nodes (26): fetchSessions(), revokeSession(), fetchTenantDetail(), TenantRow, ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps (+18 more)

### Community 35 - "CustomSearchSelect.tsx"
Cohesion: 0.21
Nodes (7): CustomSearchSelect(), handleScroll(), panelStyle(), Props, SelectOption, OPTIONS, TopChoice

### Community 36 - "LanguageContext.tsx"
Cohesion: 0.17
Nodes (11): Lang, Ctx, FALLBACK_CTX, LanguageCtx, Vars, Props, NOTE: the "closed popover must stay hidden" invariant is NOT covered here., DarkModeToggle() (+3 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPSubmission.ts"
Cohesion: 0.06
Nodes (40): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+32 more)

### Community 39 - "useNotifications.ts"
Cohesion: 0.18
Nodes (15): WhatsNew(), listNotifications(), markNotificationsRead(), Notification, LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote (+7 more)

### Community 40 - "useAPExtraction.ts"
Cohesion: 0.10
Nodes (24): DEFAULT_MAPPINGS, EMPTY_HEADER, Args, EXTRACTION_STAGES, _fetchExtract(), isNumFld(), NUMERIC_FIELDS, useAPExtraction() (+16 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, configBanks, CONTROL_PANE_ROWS (+6 more)

### Community 43 - "date.ts"
Cohesion: 0.24
Nodes (10): DATE_KEYS, HeaderCard(), Props, jvhDate(), DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE() (+2 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.26
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), STATUS_META (+5 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.09
Nodes (28): fetchAlerts(), fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), fetchUsageTotals(), KPICard(), KPICardProps (+20 more)

### Community 46 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 47 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 48 - "useOcrWizard.ts"
Cohesion: 0.15
Nodes (16): OcrDraftState, CcDraft, ApiError, ExtractedRow, getPdfInfo(), PDF_PASSWORD_REQUIRED, COPY, Options (+8 more)

### Community 49 - "ProtectedRoute.tsx"
Cohesion: 0.25
Nodes (8): AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig, EXPIRED_FLAG_KEY

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "OrderHistory.tsx"
Cohesion: 0.11
Nodes (33): CheckoutFlow(), OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode() (+25 more)

### Community 52 - "appKey"
Cohesion: 0.13
Nodes (23): getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings(), getAccountingConfig, useAccountingConfig() (+15 more)

### Community 53 - "apiFetch"
Cohesion: 0.09
Nodes (25): approveDocument(), Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows (+17 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "PeriodPicker.tsx"
Cohesion: 0.12
Nodes (36): fetchJobs(), resolveAlert(), fetchLLMLogs(), fetchTenantRanking(), fetchUserUsage(), daysAgo(), endOfDay(), granularityFor() (+28 more)

### Community 56 - "shared/api/credits.ts"
Cohesion: 0.08
Nodes (34): Props, MAP, OrderStatusBadge(), SLIP, CheckoutPhase, CheckoutSession, clearPersistedCheckout(), EMPTY_BUYER (+26 more)

### Community 57 - "APInvoice.tsx"
Cohesion: 0.20
Nodes (8): APReviewStep(), HEADER_FIELDS(), APUploadStep(), INSTRUCTIONS, Props, AP_STEPS, APInvoice(), APInvoice

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "APTableRow.tsx"
Cohesion: 0.24
Nodes (7): FixedTaxSettings, TAX_TYPE_OPTIONS, TaxPctCell(), InlineSelect(), InlineSelectAccent, InlineSelectOption, Props

### Community 62 - "emailReview.ts"
Cohesion: 0.20
Nodes (14): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+6 more)

### Community 63 - "DetailTable.tsx"
Cohesion: 0.25
Nodes (10): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DETAIL_COLUMNS, DETAIL_LABELS, DetailColumn (+2 more)

### Community 64 - "APGroupModal.tsx"
Cohesion: 0.29
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.15
Nodes (9): SLIP, LanguageProvider(), readLang(), failedRow, items, markRead, orderRow, postedRow (+1 more)

### Community 67 - "client.ts"
Cohesion: 0.27
Nodes (10): exchangeSSOToken(), getUsage(), revokeSession(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl() (+2 more)

### Community 68 - "main.tsx"
Cohesion: 0.11
Nodes (13): container, EmailSettings, getRoute(), Mapping, OrderHistory, OrderReviewShell, Pricing, Router() (+5 more)

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
Cohesion: 0.20
Nodes (9): apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T, mockSuccess() (+1 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "CheckoutFlow.tsx"
Cohesion: 0.09
Nodes (22): OrderDrawer(), Props, itemName(), REQUIRED_BUYER_KEYS, SOURCE_KEY, ACCEPTED, Props, SlipUpload() (+14 more)

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
Cohesion: 0.09
Nodes (12): en, th, adminDict, AdminKey, en, th, en, th (+4 more)

### Community 81 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "reviewReasons.ts"
Cohesion: 0.25
Nodes (9): OcrExtractionHook, ExtractionWarningBanner(), Props, ExtractionWarning, FIX, REASON_KEY, SETTINGS, warningText() (+1 more)

### Community 88 - "ARReviewPane.tsx"
Cohesion: 0.38
Nodes (5): ARPreview, ARPreviewRow, ARReviewPane(), labelOf(), Props

### Community 89 - "Tooltip.tsx"
Cohesion: 0.40
Nodes (5): Coords, getCoords(), Props, Tooltip(), TooltipPosition

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.21
Nodes (9): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, NumericInput(), NumericInputProps (+1 more)

### Community 94 - "ReviewDocument.tsx"
Cohesion: 0.25
Nodes (9): getPending(), rejectDocument(), RowAction(), useReviewDocument(), reject(), Props, ReviewDocument(), SwapLabel() (+1 more)

### Community 95 - "useAuth"
Cohesion: 0.17
Nodes (11): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), A (+3 more)

### Community 103 - "TKey"
Cohesion: 0.10
Nodes (20): BatchAction, BatchActionBar(), Props, NavItem, NavSection, APValidationProps, INSTRUCTIONS, Props (+12 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 106 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 108 - "showToast"
Cohesion: 0.08
Nodes (42): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+34 more)

### Community 111 - "TenantSelector.tsx"
Cohesion: 0.08
Nodes (26): fetchErrorBreakdown(), fetchUsageSummary(), LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+18 more)

### Community 121 - "AuthContext.tsx"
Cohesion: 0.36
Nodes (7): clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), clearAllDrafts(), getJwtExpMs()

### Community 122 - "useMapping.ts"
Cohesion: 0.16
Nodes (18): saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, COMPANY_FIELDS, CompanyField, rulesPrint(), getAccountingConfig (+10 more)

### Community 123 - "DataTable.tsx"
Cohesion: 0.09
Nodes (25): fetchPerformanceLogs(), DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir (+17 more)

### Community 124 - "storage.ts"
Cohesion: 0.25
Nodes (10): AppHeader(), AuthScreen(), APP_STORAGE_BASES, clearAppStorage(), getCarmenUri(), NOTE: per-user keys (consent), global UI prefs (theme, lang) and, setActiveTenant(), setCarmenUri() (+2 more)

## Knowledge Gaps
- **640 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+635 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `APReviewStep.tsx`, `adminFetch`, `JvEditor.tsx`, `ReviewQueue.tsx`, `parseNum`, `TutorialModal.tsx`, `api.ts`, `orders.ts`, `UsageIndicator.tsx`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `AccountingReview.tsx`, `MainMappingTable.tsx`, `useMappingSuggestions.ts`, `NotificationBell.tsx`, `routes.tsx`, `MaintenanceGate.tsx`, `APFieldMappingStep.tsx`, `useOcrWizard`, `OrderWorkspace.tsx`, `OrderTable.tsx`, `payment-mapping/types.ts`, `ExtractionsPage.tsx`, `CustomSearchSelect.tsx`, `LanguageContext.tsx`, `FeatureFlows.tsx`, `useAPSubmission.ts`, `useNotifications.ts`, `useAPExtraction.ts`, `date.ts`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `DocumentPreview.tsx`, `AdminLogin.tsx`, `OrderHistory.tsx`, `PeriodPicker.tsx`, `shared/api/credits.ts`, `APInvoice.tsx`, `DetailTable.tsx`, `APGroupModal.tsx`, `CheckoutFlow.tsx`, `reviewReasons.ts`, `ARReviewPane.tsx`, `APAmountSummary.tsx`, `ReviewDocument.tsx`, `useAuth`, `TKey`, `TenantSelector.tsx`, `useMapping.ts`, `DataTable.tsx`, `storage.ts`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `parseNum`, `api.ts`, `useSettlementMapping.ts`, `useMappingSuggestions.ts`, `carmen.ts`, `useOcrWizard`, `useAPSubmission.ts`, `useNotifications.ts`, `useAPExtraction.ts`, `useOcrWizard.ts`, `OrderHistory.tsx`, `appKey`, `shared/api/credits.ts`, `emailReview.ts`, `client.ts`, `useAPExtraction.test.ts`, `useUserConsent.ts`, `ReviewDocument.tsx`, `useMapping.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useAPDraft.ts`, `JvEditor.tsx`, `useAPSubmission.ts`, `parseNum`, `useAPExtraction.ts`, `useOcrWizard.ts`, `useMappingSuggestions.ts`, `appKey`, `apiFetch`, `carmen.ts`, `AuthContext.tsx`, `useMapping.ts`, `useOcrWizard`, `ReviewDocument.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _640 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `ReviewQueue.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
- **Should `TutorialModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._