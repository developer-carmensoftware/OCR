# Graph Report - OCR  (2026-10-20)

## Corpus Check
- 420 files · ~309,552 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2234 nodes · 6231 edges · 166 communities (107 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a718d787`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PmsReviewDocument.tsx
- EmailSettings.tsx
- parseNum
- fmtDateTime
- useT
- PeriodPicker.tsx
- APReviewStep.tsx
- shared/api/credits.ts
- ManualScan.tsx
- screens.tsx
- useMapping.ts
- useAPExtraction
- storage.ts
- OrderHistory.tsx
- DataTable.tsx
- banks.ts
- useAPExtraction.ts
- apiFetch
- ccJv.ts
- TenantsPage.tsx
- OrderTable.tsx
- LanguageContext.tsx
- 5. Components
- ApiKeysPage.tsx
- orders.ts
- i18n/index.ts
- APAccountMappingStep.tsx
- useReviewDocument.ts
- OrderWorkspace.tsx
- APInvoice.tsx
- payment-mapping/types.ts
- ReviewQueue.tsx
- compilerOptions
- Pricing.tsx
- devDependencies
- EmailAutomationPage.tsx
- ExtractionsPage.tsx
- MainMappingTable.tsx
- useSettlementMapping.ts
- useOcrSubmission.test.ts
- QuotaModulesPage.tsx
- ReviewDocument.test.tsx
- dict/index.ts
- dependencies
- NotificationBell.tsx
- main.tsx
- useOcrExtraction
- emailReview.ts
- QueueRow.tsx
- JvEditor.tsx
- PaymentMappingDialog.test.tsx
- FieldMapping
- usePdfPasswordPrompt
- OrderReviewShell.tsx
- client.ts
- AccountingReview.tsx
- api.ts
- useAuth
- scripts
- adminFetch
- TKey
- OrderActions.tsx
- APGroupModal.tsx
- useNotifications.ts
- useOcrWizard.ts
- shared/api/auth.ts
- AdminLogin.tsx
- draft.ts
- ocr.ts
- AuthContext.tsx
- CustomSearchSelect.tsx
- compilerOptions
- useMappingData.ts
- adminAuth.ts
- MaintenanceGate.tsx
- DocumentPreview.tsx
- CLAUDE.md
- Contributing
- MaintenancePage.tsx
- useUserConsent.ts
- Carmen AI — OCR & Import System
- ArCustomerProfiles.tsx
- PDFPageSelector
- ProtectedRoute.tsx
- Coding Skills & Principles
- Mapping.test.tsx
- WhatsNew.tsx
- ErrorBoundary
- Product
- NotificationBell.test.tsx
- 🏗️ Backend Principles (Python / FastAPI)
- date.ts
- releaseNotes.ts
- 🎨 Frontend Principles (React / Vue / JS)
- Architecture
- package.json
- DataTable.test.tsx
- ApiKeysPage.test.tsx
- useNotifications.test.ts
- mockPaths.test.ts
- vercel.json
- Carmen AI — OCR & Import System
- adminUsers.ts
- anomalies.ts
- chrome.ts
- i18n/common.ts
- i18n/credits.ts
- errors.ts
- extractions.ts
- llmLogs.ts
- login.ts
- i18n/maintenance.ts
- i18n/nav.ts
- i18n/quotas.ts
- i18n/tenants.ts
- i18n/usage.ts
- userUsage.ts
- dict/ap.ts
- dict/apiKeys.ts
- ar.ts
- cc.ts
- checkout.ts
- dict/common.ts
- home.ts
- dict/maintenance.ts
- dict/modal.ts
- dict/nav.ts
- notif.ts
- order.ts
- orev.ts
- plan.ts
- pms.ts
- pricing.ts
- proforma.ts
- quota.ts
- review.ts
- slip.ts
- tutorial.ts
- dict/usage.ts
- warn.ts
- whatsnew.ts
- vite.config.ts
- eslint
- eslint-plugin-react-hooks
- jsdom
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @types/react-dom
- vite
- @vitejs/plugin-react
- vitest
- vite-env.d.ts
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md

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
- `NavItem` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `NavSection` --references--> `TKey`  [EXTRACTED]
  frontend/src/features/admin/pages/routes.tsx → frontend/src/i18n/dict/index.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APLineItem`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APGroupModal.tsx → frontend/src/shared/types/ap.ts

## Import Cycles
- None detected.

## Communities (166 total, 59 thin omitted)

### Community 0 - "PmsReviewDocument.tsx"
Cohesion: 0.05
Nodes (50): approvePmsDay(), failure(), getPmsDay(), PmsApproveResult, PmsDay, PmsNewCode, PmsRow, rejectPmsDay() (+42 more)

### Community 1 - "EmailSettings.tsx"
Cohesion: 0.06
Nodes (56): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+48 more)

### Community 2 - "parseNum"
Cohesion: 0.13
Nodes (34): AmountSummary(), getAvailableFields(), mountRestored(), TAX_PROFILES, useAPInvoice(), adjustField(), DocRepair, reconcileRows() (+26 more)

### Community 3 - "fmtDateTime"
Cohesion: 0.14
Nodes (37): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), resolveAlert() (+29 more)

### Community 4 - "useT"
Cohesion: 0.06
Nodes (35): axisTick, ChartType, FALLBACK_COLORS, MetricChart(), Series, tooltipItemStyle, tooltipLabelStyle, tooltipStyle (+27 more)

### Community 5 - "PeriodPicker.tsx"
Cohesion: 0.09
Nodes (36): fetchAlerts(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals(), LazyMetricChart, MetricChart(), MetricChartProps, granularityFor() (+28 more)

### Community 6 - "APReviewStep.tsx"
Cohesion: 0.09
Nodes (31): Diffs, SummaryRow(), SummaryRowProps, Sums, Targets, APLineItemsTable(), Props, APReviewStep() (+23 more)

### Community 7 - "shared/api/credits.ts"
Cohesion: 0.11
Nodes (34): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, CheckoutPhase, CheckoutSession, clearPersistedCheckout() (+26 more)

### Community 8 - "ManualScan.tsx"
Cohesion: 0.08
Nodes (28): BANK_LOGOS, BankDetectionBanner(), Props, AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn() (+20 more)

### Community 9 - "screens.tsx"
Cohesion: 0.09
Nodes (31): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+23 more)

### Community 10 - "useMapping.ts"
Cohesion: 0.09
Nodes (28): PostType, saveARSettings(), CompanyInfoSection(), PLACEHOLDER_KEYS, Props, buildMappingSets(), COMPANY_FIELDS, CompanyField (+20 more)

### Community 11 - "useAPExtraction"
Cohesion: 0.09
Nodes (23): isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE, MOCK_T (+15 more)

### Community 12 - "storage.ts"
Cohesion: 0.10
Nodes (25): RowAction(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrDraftState, OcrExtractionHook, OcrExtractionProps, CcDraft (+17 more)

### Community 13 - "OrderHistory.tsx"
Cohesion: 0.12
Nodes (22): OrderRow(), PendingOrderBanner(), RowAction, rowInitial, rowReducer(), SLIP, catalogName(), isSubscriptionCode() (+14 more)

### Community 14 - "DataTable.tsx"
Cohesion: 0.09
Nodes (20): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), ServerTable, SKELETON_WIDTHS, SortDir, BASE_DEFAULTS (+12 more)

### Community 15 - "banks.ts"
Cohesion: 0.13
Nodes (25): Props, bankCodeFromHash(), BankConfigHook, useBankConfig(), persistScanForMapping(), codeToDisplayName(), codeToSource(), getBankInfo() (+17 more)

### Community 16 - "useAPExtraction.ts"
Cohesion: 0.15
Nodes (22): Props, Props, APInvoiceHeader, ApDraft, Args, APDraftState, APExtractionProps, EXTRACTION_STAGES (+14 more)

### Community 17 - "apiFetch"
Cohesion: 0.11
Nodes (26): apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER, MOCK_VENDOR (+18 more)

### Community 18 - "ccJv.ts"
Cohesion: 0.13
Nodes (20): AccountingReview(), JvHeaderCard(), TopLevelConfigSection(), descriptionForBank(), CONFIG, leg(), rows(), TWO_LINES (+12 more)

### Community 19 - "TenantsPage.tsx"
Cohesion: 0.11
Nodes (21): TenantSubscriptionSummary, fetchTenantDetail(), fetchTenants(), TenantDetail, TenantModuleRow, TenantRow, TenantSessionRow, TenantSearch() (+13 more)

### Community 20 - "OrderTable.tsx"
Cohesion: 0.10
Nodes (23): AdminCreditOrder, fetchAdminOrderDocuments(), OrderDrawer(), Props, BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction (+15 more)

### Community 21 - "LanguageContext.tsx"
Cohesion: 0.10
Nodes (18): MAP, OrderStatusBadge(), ACCEPTED, Props, SlipUpload(), SLIP, configBanks, Ctx (+10 more)

### Community 22 - "5. Components"
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+18 more)

### Community 23 - "ApiKeysPage.tsx"
Cohesion: 0.19
Nodes (18): fetchApiKeys(), revokeApiKey(), buildQs(), QueryParams, fetchJobs(), fetchSessions(), fetchErrorBreakdown(), fetchLLMLogs() (+10 more)

### Community 24 - "orders.ts"
Cohesion: 0.17
Nodes (21): AdminOrderStatus, approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, KpiSummary (+13 more)

### Community 25 - "i18n/index.ts"
Cohesion: 0.08
Nodes (14): en, th, adminDict, AdminKey, en, th, en, th (+6 more)

### Community 26 - "APAccountMappingStep.tsx"
Cohesion: 0.10
Nodes (20): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+12 more)

### Community 27 - "useReviewDocument.ts"
Cohesion: 0.15
Nodes (20): approveDocument(), getPending(), getAccountingConfig, seedOcrBranch(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings() (+12 more)

### Community 28 - "OrderWorkspace.tsx"
Cohesion: 0.16
Nodes (20): ContactBuyer(), num(), VerifyFacts(), WsAction, wsInitial, WsState, RowState, BillingDocument (+12 more)

### Community 29 - "APInvoice.tsx"
Cohesion: 0.12
Nodes (19): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APTableRow(), APUploadStep(), INSTRUCTIONS (+11 more)

### Community 30 - "payment-mapping/types.ts"
Cohesion: 0.21
Nodes (20): MappingRow(), Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf() (+12 more)

### Community 31 - "ReviewQueue.tsx"
Cohesion: 0.10
Nodes (15): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), pmsIdFromHash(), QueueEmpty() (+7 more)

### Community 32 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 33 - "Pricing.tsx"
Cohesion: 0.16
Nodes (16): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+8 more)

### Community 34 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 35 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 36 - "ExtractionsPage.tsx"
Cohesion: 0.13
Nodes (18): ExtractionFailureRow, fetchExtractionFailures(), DateRangePicker(), DateRangePickerProps, Tab, Tabs(), TabsProps, causeLabel() (+10 more)

### Community 37 - "MainMappingTable.tsx"
Cohesion: 0.16
Nodes (17): AccountMappingTable(), GLAccount, Props, MainMappingTable(), Props, BulkApplyBar(), MainMappings, MainMappingKey (+9 more)

### Community 38 - "useSettlementMapping.ts"
Cohesion: 0.18
Nodes (17): ARMappingItem, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes(), POST_TYPES (+9 more)

### Community 39 - "useOcrSubmission.test.ts"
Cohesion: 0.12
Nodes (16): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), CarmenJvPayload, defaultConfig, defaultRows, diffCorrections (+8 more)

### Community 40 - "QuotaModulesPage.tsx"
Cohesion: 0.17
Nodes (16): fetchQuotaOverview(), ModuleCatalogEntry, ModuleUsageRow, QuotaOverviewResponse, TenantQuotaOverviewRow, toggleTenantModule(), EmptyState(), EmptyStateProps (+8 more)

### Community 41 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (14): AR_JV, AR_LINES, arDetail(), BENT, configBanks, configWaits, DEBIT_ROWS, detail() (+6 more)

### Community 42 - "dict/index.ts"
Cohesion: 0.11
Nodes (14): en, th, en, th, DICT, en, th, translate() (+6 more)

### Community 43 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 44 - "NotificationBell.tsx"
Cohesion: 0.19
Nodes (15): Props, StatusLine(), UrlText(), FeedStatus, docLabel(), isCollapsed(), isOrphanBlockedCount(), NotificationBell() (+7 more)

### Community 45 - "main.tsx"
Cohesion: 0.16
Nodes (14): AdminRouter(), getRoute(), AdminRouter, container, EmailSettings, getRoute(), ManualScan, Mapping (+6 more)

### Community 46 - "useOcrExtraction"
Cohesion: 0.17
Nodes (13): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), handleCancel(), reExtract(), resetAll() (+5 more)

### Community 47 - "emailReview.ts"
Cohesion: 0.20
Nodes (12): ARPreview, ACTIVITY_FILTERS, ActivityFilter, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+4 more)

### Community 48 - "QueueRow.tsx"
Cohesion: 0.22
Nodes (15): recordInputTax(), formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor() (+7 more)

### Community 49 - "JvEditor.tsx"
Cohesion: 0.19
Nodes (14): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, BlockReason, BU_WIDE, JvEditor(), Overrides (+6 more)

### Community 50 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 51 - "FieldMapping"
Cohesion: 0.27
Nodes (12): AddError, MappingItem, Undo, FeeInvoiceSource, MappingSets, MappingSetsInput, labels, ActiveScan (+4 more)

### Community 52 - "usePdfPasswordPrompt"
Cohesion: 0.19
Nodes (11): PDF_PASSWORD_REQUIRED, COPY, Options, PdfPasswordAttempt, PdfPasswordModalPayload, setup(), usePdfPasswordPrompt(), open() (+3 more)

### Community 53 - "OrderReviewShell.tsx"
Cohesion: 0.22
Nodes (10): AdminLayout(), getActiveHash(), OrderReviewShell(), NAV_SECTIONS, registerDict(), OrderReviewShell, DarkModeToggle(), LanguageToggle() (+2 more)

### Community 54 - "client.ts"
Cohesion: 0.24
Nodes (12): _fetchExtract(), exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_POSTING_TOKEN_KEY, CARMEN_RAW_TOKEN_KEY, createApiClient(), fetchTimeout() (+4 more)

### Community 55 - "AccountingReview.tsx"
Cohesion: 0.21
Nodes (12): ItxOverrides, DEFAULT_EMPTY_OBJECT, Props, DetailRow, Props, JvState, Props, OcrSubmissionHook (+4 more)

### Community 56 - "api.ts"
Cohesion: 0.13
Nodes (11): AccountingConfigRequest, AccountingConfigResponse, ApiError, APInvoiceItem, CodeOption, ExchangeRequest, ExtractedAPInvoiceData, ExtractedCreditCardData (+3 more)

### Community 57 - "useAuth"
Cohesion: 0.17
Nodes (11): ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal(), A (+3 more)

### Community 58 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 59 - "adminFetch"
Cohesion: 0.44
Nodes (12): unwrapDetail(), getOrderSlipUrl(), AdminUserRow, createAdminUser(), fetchAdminUsers(), fetchRoles(), replaceAdminUserRoles(), resetAdminUserPassword() (+4 more)

### Community 60 - "TKey"
Cohesion: 0.18
Nodes (12): BatchAction, BatchActionBar(), Props, ACTIVE_TAG, containerVariants, Home(), itemVariants, Module (+4 more)

### Community 61 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 62 - "APGroupModal.tsx"
Cohesion: 0.29
Nodes (9): APGroupModal(), profileLabel(), Props, Args, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+1 more)

### Community 63 - "useNotifications.ts"
Cohesion: 0.25
Nodes (10): ActivityPage, BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page, Props (+2 more)

### Community 64 - "useOcrWizard.ts"
Cohesion: 0.26
Nodes (10): inputTaxOwed(), useOcrSubmission(), draftWorthOffering(), getPdfInfoWithRetry(), owed, useOcrWizard(), handleFileChange(), promptForPassword() (+2 more)

### Community 65 - "shared/api/auth.ts"
Cohesion: 0.25
Nodes (9): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats (+1 more)

### Community 66 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 67 - "draft.ts"
Cohesion: 0.31
Nodes (9): useAPDraft(), clearAllDrafts(), clearDraft(), DraftKind, draftPromptMessage(), Envelope, keyFor(), loadDraft() (+1 more)

### Community 68 - "ocr.ts"
Cohesion: 0.19
Nodes (10): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), ApiError, ExtractedRow, extractFromFile() (+2 more)

### Community 69 - "AuthContext.tsx"
Cohesion: 0.28
Nodes (10): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), clearAppStorage() (+2 more)

### Community 70 - "CustomSearchSelect.tsx"
Cohesion: 0.21
Nodes (7): CustomSearchSelect(), handleScroll(), panelStyle(), Props, SelectOption, OPTIONS, TopChoice

### Community 71 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 72 - "useMappingData.ts"
Cohesion: 0.39
Nodes (10): GlMasters, prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments() (+2 more)

### Community 73 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 74 - "MaintenanceGate.tsx"
Cohesion: 0.27
Nodes (11): getStoredToken(), resolveUrl(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate() (+3 more)

### Community 75 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 76 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 77 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 78 - "MaintenancePage.tsx"
Cohesion: 0.40
Nodes (9): endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fmtICT(), MaintenancePage(), pad() (+1 more)

### Community 79 - "useUserConsent.ts"
Cohesion: 0.38
Nodes (8): getConsentStatus(), postConsent(), AuthUser, cacheConsent(), consentKey(), readCached(), user, useUserConsent()

### Community 80 - "Carmen AI — OCR & Import System"
Cohesion: 0.20
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 81 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 82 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 83 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 84 - "Coding Skills & Principles"
Cohesion: 0.22
Nodes (7): 🤖 AI / LLM Integration, Coding Skills & Principles, 🎯 Core Philosophy, DO ✅, DON'T ❌, 🛠️ Tooling & Workflow, ⚠️ Universal Do's and Don'ts

### Community 85 - "Mapping.test.tsx"
Cohesion: 0.28
Nodes (6): bankPicker(), commissionAcc(), KTC, mounted(), SCB, toSCB()

### Community 86 - "WhatsNew.tsx"
Cohesion: 0.42
Nodes (6): WhatsNew(), WhatsNew, markReleaseSeen(), readReleaseSeen(), RELEASE_SEEN_EVENT, WHATS_NEW_RETURN_KEY

### Community 87 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 88 - "Product"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 89 - "NotificationBell.test.tsx"
Cohesion: 0.25
Nodes (6): failedRow, items, markRead, orderRow, postedRow, releaseRow

### Community 90 - "🏗️ Backend Principles (Python / FastAPI)"
Cohesion: 0.25
Nodes (8): 1. Layered Architecture, 2. Naming Conventions (Python), 3. Singleton & Centralized Modules, 4. Error Handling, 5. Documentation & Type Hinting, 6. Database, 7. Security, 🏗️ Backend Principles (Python / FastAPI)

### Community 91 - "date.ts"
Cohesion: 0.57
Nodes (4): DateInput(), DateInputProps, formatDateToDDMMYYYY(), parseDDMMYYYYToDate()

### Community 92 - "releaseNotes.ts"
Cohesion: 0.38
Nodes (5): LATEST_RELEASE, RELEASE_NOTES, ReleaseFix, ReleaseNote, ReleaseNoteCopy

### Community 93 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 94 - "Architecture"
Cohesion: 0.33
Nodes (6): Admin dashboard (`#/admin/*`) — check here before writing SQL, AP Invoice (5-step wizard), Architecture, Credit Card OCR (5-step wizard), Email ingestion (a queue, not a wizard — a human approves before it posts), PMS webhook (CA-93) and processing (CA-119)

### Community 95 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 96 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 97 - "ApiKeysPage.test.tsx"
Cohesion: 0.33
Nodes (4): fetchApiKeys, fetchTenants, revokeApiKey, ROW

### Community 98 - "useNotifications.test.ts"
Cohesion: 0.40
Nodes (5): listNotifications, markNotificationsRead, page(), SERVER_ROW, setup()

### Community 99 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 100 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, rewrites, $schema

### Community 101 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

## Knowledge Gaps
- **667 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+662 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `PmsReviewDocument.tsx`, `EmailSettings.tsx`, `parseNum`, `fmtDateTime`, `PeriodPicker.tsx`, `APReviewStep.tsx`, `shared/api/credits.ts`, `ManualScan.tsx`, `screens.tsx`, `useMapping.ts`, `useAPExtraction`, `storage.ts`, `OrderHistory.tsx`, `DataTable.tsx`, `useAPExtraction.ts`, `ccJv.ts`, `TenantsPage.tsx`, `OrderTable.tsx`, `LanguageContext.tsx`, `ApiKeysPage.tsx`, `orders.ts`, `APAccountMappingStep.tsx`, `useReviewDocument.ts`, `OrderWorkspace.tsx`, `APInvoice.tsx`, `payment-mapping/types.ts`, `ReviewQueue.tsx`, `Pricing.tsx`, `EmailAutomationPage.tsx`, `ExtractionsPage.tsx`, `MainMappingTable.tsx`, `useSettlementMapping.ts`, `QuotaModulesPage.tsx`, `NotificationBell.tsx`, `useOcrExtraction`, `QueueRow.tsx`, `JvEditor.tsx`, `OrderReviewShell.tsx`, `AccountingReview.tsx`, `useAuth`, `adminFetch`, `TKey`, `OrderActions.tsx`, `APGroupModal.tsx`, `shared/api/auth.ts`, `AdminLogin.tsx`, `CustomSearchSelect.tsx`, `MaintenanceGate.tsx`, `DocumentPreview.tsx`, `MaintenancePage.tsx`, `ArCustomerProfiles.tsx`, `WhatsNew.tsx`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `PmsReviewDocument.tsx`, `parseNum`, `shared/api/credits.ts`, `useMapping.ts`, `useAPExtraction`, `OrderHistory.tsx`, `useAPExtraction.ts`, `useReviewDocument.ts`, `useSettlementMapping.ts`, `useOcrSubmission.test.ts`, `emailReview.ts`, `QueueRow.tsx`, `JvEditor.tsx`, `client.ts`, `useNotifications.ts`, `useOcrWizard.ts`, `ocr.ts`, `useMappingData.ts`, `useUserConsent.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `API` connect `ApiKeysPage.tsx` to `PmsReviewDocument.tsx`, `EmailSettings.tsx`, `fmtDateTime`, `shared/api/credits.ts`, `useMapping.ts`, `useAPExtraction.ts`, `apiFetch`, `TenantsPage.tsx`, `orders.ts`, `EmailAutomationPage.tsx`, `useSettlementMapping.ts`, `useOcrSubmission.test.ts`, `QuotaModulesPage.tsx`, `emailReview.ts`, `JvEditor.tsx`, `adminFetch`, `useNotifications.ts`, `shared/api/auth.ts`, `AdminLogin.tsx`, `ocr.ts`, `adminAuth.ts`, `MaintenancePage.tsx`, `useUserConsent.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _667 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PmsReviewDocument.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.050721954831543875 - nodes in this community are weakly interconnected._
- **Should `EmailSettings.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.055905220288781934 - nodes in this community are weakly interconnected._
- **Should `parseNum` be split into smaller, more focused modules?**
  _Cohesion score 0.12858464384828863 - nodes in this community are weakly interconnected._