# Graph Report - OCR  (2026-10-01)

## Corpus Check
- 400 files · ~292,197 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2141 nodes · 5905 edges · 139 communities (107 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `286066bc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useOcrWizard.ts
- APReviewStep.tsx
- dict/index.ts
- DataTable.tsx
- TopLevelConfigSection.tsx
- emailReview.ts
- parseNum
- TutorialModal.tsx
- screens.tsx
- api.ts
- PeriodPicker.tsx
- orders.ts
- storage.ts
- useSettlementMapping.ts
- eslint-plugin-react-hooks
- EmailAutomationPage.tsx
- AccountingReview.tsx
- payment-mapping/types.ts
- adminFetch
- Pricing.tsx
- AppHeader.tsx
- compilerOptions
- 5. Components
- MaintenanceGate.tsx
- ManualScan.tsx
- APInvoice.tsx
- devDependencies
- CheckoutFlow.tsx
- adminAuth.ts
- showToast
- CreditsPage.tsx
- OrderTable.tsx
- dependencies
- useFileUpload.ts
- endpoints.ts
- MainMappingTable.tsx
- OrderWorkspace.tsx
- FeatureFlows.tsx
- useAPSubmission.ts
- NotificationBell.tsx
- ocr.ts
- PaymentMappingDialog.test.tsx
- ReviewDocument.test.tsx
- ExtractionsPage.tsx
- QueueRow.tsx
- QuotaModulesPage.tsx
- DocumentPreview.tsx
- AdminLogin.tsx
- useAuth
- AuthContext.tsx
- scripts
- formatThb
- CreditOrdersPage.tsx
- useOcrExtraction.ts
- compilerOptions
- routes.tsx
- PendingOrderBanner.tsx
- OrderActions.tsx
- CLAUDE.md
- Contributing
- @vitejs/plugin-react
- OrderHistory.tsx
- shared/api/auth.ts
- DetailTable.tsx
- APLineItem
- Carmen AI — OCR & Import System
- LanguageProvider
- apiFetch
- useAPExtraction.ts
- Product
- Coding Skills & Principles
- 🏗️ Backend Principles (Python / FastAPI)
- useAPExtraction
- PDFPageSelector
- 🎨 Frontend Principles (React / Vue / JS)
- package.json
- ReviewQueue.tsx
- useUserConsent.ts
- vercel.json
- Architecture
- i18n/index.ts
- Mapping.tsx
- ArCustomerProfiles.tsx
- Carmen AI — OCR & Import System
- DataTable.test.tsx
- vite.config.ts
- APAccountMappingStep.tsx
- client.ts
- useAPVendor.ts
- jsdom
- APAmountSummary.tsx
- eslint
- checkout.ts
- JvEditor.tsx
- banks.ts
- vitest
- vite-env.d.ts
- TKey
- mockPaths.test.ts
- ProtectedRoute.tsx
- date.ts
- TenantSelector.test.tsx
- EmailSettings.tsx
- carmen.ts
- useMappingData.ts
- useT
- ReviewQueue.test.tsx
- TenantsPage.tsx
- OrderTable.test.tsx
- reviewReasons.ts
- AppHeader.test.tsx
- main.tsx
- i18n/credits.ts
- ar.ts
- cc.ts
- slip.ts
- useMapping.ts
- tutorial.ts
- warn.ts
- whatsnew.ts
- @types/react
- @types/react-dom
- vite
- @testing-library/react
- @testing-library/jest-dom
- 01-csv-sidecar-ingestion.md
- 02-double-booking-guard.md
- 03-combined-jv-three-debit-legs.md
- 04-tin-second-factor.md
- 05-csv-report-figure-cross-check.md
- 06-settlement-jv-input-tax.md
- 07-review-flag-settings-cleanup.md
- 08-deterministic-settlement-parser.md

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
- `ContactBuyer()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/admin/components/OrderWorkspace.tsx → frontend/src/i18n/LanguageContext.tsx
- `Props` --references--> `APInvoiceHeader`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/features/ap-invoice/constants.ts
- `SummaryRow()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APAmountSummary.tsx → frontend/src/i18n/LanguageContext.tsx
- `TaxPctCell()` --calls--> `parseNum()`  [EXTRACTED]
  frontend/src/features/ap-invoice/components/APTableRow.tsx → frontend/src/shared/lib/format.ts
- `SupportedLayouts()` --calls--> `useT()`  [EXTRACTED]
  frontend/src/features/billing/components/FeatureFlows.tsx → frontend/src/i18n/LanguageContext.tsx

## Import Cycles
- None detected.

## Communities (139 total, 32 thin omitted)

### Community 0 - "useOcrWizard.ts"
Cohesion: 0.16
Nodes (17): ApDraft, Args, useAPDraft(), mountRestored(), TAX_PROFILES, useAPVendor(), APInvoice(), OcrDraftState (+9 more)

### Community 1 - "APReviewStep.tsx"
Cohesion: 0.15
Nodes (20): APLineItemsTable(), Props, APReviewStep(), Ctrl, HEADER_FIELDS(), Props, APTableFooter(), Props (+12 more)

### Community 2 - "dict/index.ts"
Cohesion: 0.03
Nodes (44): en, th, en, th, en, th, en, th (+36 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.11
Nodes (16): DataTable(), DataTableProps, ExpandedRowWrapperProps, getCell(), SKELETON_WIDTHS, InlineSelect(), InlineSelectAccent, InlineSelectOption (+8 more)

### Community 4 - "TopLevelConfigSection.tsx"
Cohesion: 0.15
Nodes (8): Props, CustomSearchSelect(), handleScroll(), panelStyle(), Props, SelectOption, OPTIONS, TopChoice

### Community 5 - "emailReview.ts"
Cohesion: 0.24
Nodes (12): ACTIVITY_FILTERS, ActivityFilter, ActivityPage, ApproveResult, listActivity(), markChipSeen(), ReviewDocument, ReviewDocumentDetail (+4 more)

### Community 6 - "parseNum"
Cohesion: 0.18
Nodes (27): AmountSummary(), getAvailableFields(), useAPInvoice(), adjustField(), DocRepair, reconcileRows(), repairDocFigure(), EMPTY_HEADER (+19 more)

### Community 7 - "TutorialModal.tsx"
Cohesion: 0.10
Nodes (25): Lang, LanguageCtx, Spot(), SpotContext, SpotProvider, boldify(), Props, readCalm() (+17 more)

### Community 8 - "screens.tsx"
Cohesion: 0.08
Nodes (35): billed(), DEMO_BUYER, DEMO_PACKS, DEMO_PAYMENT_INFO, DEMO_PLANS, DEMO_SLIP, demoOrder(), demoProforma() (+27 more)

### Community 9 - "api.ts"
Cohesion: 0.13
Nodes (18): suggestMapping(), suggestPaymentTypes(), SuggestPaymentTypesResponse, SuggestResponse, useMappingSuggestions(), accountName(), ApiError, APInvoiceItem (+10 more)

### Community 10 - "PeriodPicker.tsx"
Cohesion: 0.14
Nodes (27): fetchTenantRanking(), daysAgo(), granularityFor(), lastDays(), matchPreset(), MAX_DAILY_RANGE_DAYS, Period, periodHours() (+19 more)

### Community 11 - "orders.ts"
Cohesion: 0.23
Nodes (14): approveOrder(), fetchAdminPaymentInfo(), fetchKpi(), holdBatch(), HoldBatchResponse, HoldBatchResultItem, postArBatch(), PostArResponse (+6 more)

### Community 12 - "storage.ts"
Cohesion: 0.09
Nodes (33): bankCodeFromHash(), getAccountingConfig, seedOcrBranch(), useBankConfig(), AccountingConfigHook, MAIN_KEYS, readFromLocalStorage(), splitMappings() (+25 more)

### Community 13 - "useSettlementMapping.ts"
Cohesion: 0.11
Nodes (29): ARMappingItem, ARPreview, ARPreviewRequest, ARPreviewRow, ARSettings, ARSettingsResponse, getARSettings(), getSamplePaymentTypes() (+21 more)

### Community 15 - "EmailAutomationPage.tsx"
Cohesion: 0.21
Nodes (19): EmailBusinessUnitRow, EmailCronJob, EmailDocumentRow, EmailIngestHealth, EmailJobRun, EmailPollResult, fetchEmailBusinessUnits(), fetchEmailDocuments() (+11 more)

### Community 16 - "AccountingReview.tsx"
Cohesion: 0.11
Nodes (26): AccountingReview(), DEFAULT_EMPTY_OBJECT, configBanks, JvHeaderCard(), Props, TopLevelConfigSection(), codeToSource(), descriptionForBank() (+18 more)

### Community 17 - "payment-mapping/types.ts"
Cohesion: 0.20
Nodes (23): MappingRow(), Props, Props, MappingTable(), Props, STATUS_LABEL, Filter, orderOf() (+15 more)

### Community 18 - "adminFetch"
Cohesion: 0.24
Nodes (21): unwrapDetail(), endMaintenanceNow(), fetchMaintenance(), MaintenanceStatus, setMaintenanceSchedule(), setTenantMaintenance(), fetchTenants(), AdminUserRow (+13 more)

### Community 19 - "Pricing.tsx"
Cohesion: 0.13
Nodes (20): PackList(), Props, EnterpriseCard(), PlanCard(), PlanCardProps, LITE, TIER_ICONS, ENTERPRISE (+12 more)

### Community 20 - "AppHeader.tsx"
Cohesion: 0.19
Nodes (14): AdminLayout(), getActiveHash(), AdminRouter(), getRoute(), OrderReviewShell(), ADMIN_ROUTES, NAV_SECTIONS, AdminProtectedRoute() (+6 more)

### Community 21 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 22 - "5. Components"
Cohesion: 0.08
Nodes (24): 1. Overview, 2. Colors: The Carmen Palette, 3. Typography, 4. Elevation, 5. Components, 6. Do's and Don'ts, 7. Showcase Layer (marketing surfaces only), Buttons (+16 more)

### Community 23 - "MaintenanceGate.tsx"
Cohesion: 0.29
Nodes (10): getStoredToken(), countdown(), EMPTY, fmtHM(), fmtICT(), isAdminRoute(), MaintenanceGate(), probe() (+2 more)

### Community 24 - "ManualScan.tsx"
Cohesion: 0.10
Nodes (19): BANK_LOGOS, BankDetectionBanner(), Props, CustomModal(), ModalType, Props, baseProps, TYPE_CONFIG (+11 more)

### Community 25 - "APInvoice.tsx"
Cohesion: 0.15
Nodes (17): APFieldMappingStep(), COLS, Props, REQUIRED_FIELDS, APSuccessStep(), APUploadStep(), INSTRUCTIONS, Props (+9 more)

### Community 26 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, @eslint/js, devDependencies, autoprefixer, @eslint/js, globals, postcss, prettier (+15 more)

### Community 27 - "CheckoutFlow.tsx"
Cohesion: 0.18
Nodes (18): CheckoutFlow(), itemName(), Props, REQUIRED_BUYER_KEYS, SOURCE_KEY, CheckoutPhase, CheckoutSession, clearPersistedCheckout() (+10 more)

### Community 28 - "adminAuth.ts"
Cohesion: 0.39
Nodes (9): adminLogout(), adminMe(), AdminUser, clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthContext, AdminAuthContextValue (+1 more)

### Community 29 - "showToast"
Cohesion: 0.16
Nodes (18): useOcrExtraction(), applyExtractedData(), processFile(), reExtract(), showDuplicateModal(), useOcrSubmission(), handleSubmitFinal(), useOcrWizard() (+10 more)

### Community 30 - "CreditsPage.tsx"
Cohesion: 0.23
Nodes (14): adjustCredits(), CreditBalance, CreditLedgerEntry, fetchCreditBalance(), fetchCreditLedger(), fetchCreditPacks(), topupCredits(), CompanyPanel() (+6 more)

### Community 31 - "OrderTable.tsx"
Cohesion: 0.17
Nodes (14): BADGE_TABS, BATCH_ACTIONS_FOR_TAB, BATCH_BUTTON, BatchAction, companyOf(), isCheckable(), OrderTable(), paymentDate() (+6 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): framer-motion, dependencies, framer-motion, lucide-react, pdf-lib, react, react-day-picker, react-dom (+11 more)

### Community 33 - "useFileUpload.ts"
Cohesion: 0.17
Nodes (9): FileUploadHook, useFileUpload(), handleFileChange(), setPreview(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl() (+1 more)

### Community 34 - "endpoints.ts"
Cohesion: 0.17
Nodes (19): buildQs(), QueryParams, fetchAlerts(), resolveAlert(), ModuleUsageRow, QuotaOverviewResponse, TenantSubscriptionSummary, TenantDetail (+11 more)

### Community 35 - "MainMappingTable.tsx"
Cohesion: 0.17
Nodes (17): AccountMappingTable(), GLAccount, MainMappingTable(), Props, BulkApplyBar(), MainMappings, MainMappingKey, SuggestionSource (+9 more)

### Community 36 - "OrderWorkspace.tsx"
Cohesion: 0.18
Nodes (12): fetchAdminOrderDocuments(), getOrderSlipUrl(), listCreditOrders(), ContactBuyer(), num(), OrderWorkspace(), VerifyFacts(), WsAction (+4 more)

### Community 37 - "FeatureFlows.tsx"
Cohesion: 0.14
Nodes (13): AP_TIMELINE, ApInvoiceDetail(), CC_SUPPORT, CC_TIMELINE, CreditCardDetail(), FeatureFlows(), FEATURES, FLOW_PANELS (+5 more)

### Community 38 - "useAPSubmission.ts"
Cohesion: 0.13
Nodes (16): GLAccount, apiFetch, CarmenDetailLine, CarmenPayload, fetchAccountCodes, fetchDepartments, MAPPED_ITEMS, MOCK_HEADER (+8 more)

### Community 39 - "NotificationBell.tsx"
Cohesion: 0.07
Nodes (42): WhatsNew(), BellItem, listNotifications(), markNotificationsRead(), Notification, NotificationList, Page, docLabel() (+34 more)

### Community 40 - "ocr.ts"
Cohesion: 0.10
Nodes (23): extractFromFile, MOCK_EXTRACTED, MOCK_FILE, mockExtract(), withExtractedData(), fetchTimeout(), ApiError, ExtractedRow (+15 more)

### Community 41 - "PaymentMappingDialog.test.tsx"
Cohesion: 0.13
Nodes (10): ACCOUNTS, blank, Data, DEPARTMENTS, Harness(), item(), REMOVABLE, spies (+2 more)

### Community 42 - "ReviewDocument.test.tsx"
Cohesion: 0.11
Nodes (15): AR_CONTROL_ROWS, AR_JV, AR_JV_SUMMARY, AR_LINES, arDetail(), BENT, configBanks, configWaits (+7 more)

### Community 43 - "ExtractionsPage.tsx"
Cohesion: 0.21
Nodes (14): ExtractionFailureRow, fetchExtractionFailures(), EmptyState(), EmptyStateProps, causeLabel(), classify(), ERROR_RULES, ExtractionsPage() (+6 more)

### Community 44 - "QueueRow.tsx"
Cohesion: 0.25
Nodes (13): formatWhen(), fullWhen(), Message(), pad(), parseWhen(), QueueRow(), reasonFor(), RowAction() (+5 more)

### Community 45 - "QuotaModulesPage.tsx"
Cohesion: 0.12
Nodes (19): fetchQuotaOverview(), ModuleCatalogEntry, TenantQuotaOverviewRow, toggleTenantModule(), Tab, Tabs(), TabsProps, getTabs() (+11 more)

### Community 46 - "DocumentPreview.tsx"
Cohesion: 0.20
Nodes (10): DocPreviewAction, docPreviewReducer(), DocPreviewState, DocumentPreview(), initialDocPreviewState, Props, SelectedPageThumb, Props (+2 more)

### Community 47 - "AdminLogin.tsx"
Cohesion: 0.27
Nodes (9): adminLogin(), AdminLoginError, LoginResponse, AdminLogin(), classify(), LoginError, LoginErrorKind, mmss() (+1 more)

### Community 48 - "useAuth"
Cohesion: 0.16
Nodes (12): AppHeader(), ConsentGate(), Props, COPY, Lang, Props, useIsMobile(), UserConsentModal() (+4 more)

### Community 49 - "AuthContext.tsx"
Cohesion: 0.31
Nodes (9): revokeSession(), clearToken(), storeToken(), AuthContext, AuthContextValue, AuthProvider(), getJwtExpMs(), clearAppStorage() (+1 more)

### Community 50 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, contrast, dev, format, format:check, lint, lint:fix (+6 more)

### Community 51 - "formatThb"
Cohesion: 0.25
Nodes (13): BillingFigure(), expiryDate(), num(), ProformaDocument(), TITLE, formatDate(), bahtToEnglishWords(), formatThb() (+5 more)

### Community 52 - "CreditOrdersPage.tsx"
Cohesion: 0.22
Nodes (11): AdminCreditOrder, AdminOrderStatus, KpiSummary, OrderDrawer(), Props, OrderKpiCards(), Props, MainTab (+3 more)

### Community 53 - "useOcrExtraction.ts"
Cohesion: 0.09
Nodes (23): Correction, diffCorrections(), FIELD_NAME_MAP, logCorrections(), DetailRow, EXTRACTION_STAGES, HeaderData, OcrExtractionHook (+15 more)

### Community 54 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, outDir, skipLibCheck, strict (+4 more)

### Community 55 - "routes.tsx"
Cohesion: 0.11
Nodes (32): fetchJobs(), fetchSessions(), revokeSession(), fetchLLMLogs(), fetchPerformanceLogs(), fetchUserUsage(), ServerTable, SortDir (+24 more)

### Community 56 - "PendingOrderBanner.tsx"
Cohesion: 0.22
Nodes (15): WsState, OrderRow(), RowAction, rowInitial, rowReducer(), RowState, catalogName(), isSubscriptionCode() (+7 more)

### Community 57 - "OrderActions.tsx"
Cohesion: 0.19
Nodes (12): ActionsAction, actionsInitial, actionsReducer(), ActionsState, OrderActions(), REJECT_OTHER, REJECT_PRESETS, Action (+4 more)

### Community 58 - "CLAUDE.md"
Cohesion: 0.18
Nodes (10): Adding a New Bank (current flow — code-based), Adding a New Module, Auth Flow, Changelog, Database, Environment Variables (`backend/.env`), graphify, How to Run (+2 more)

### Community 59 - "Contributing"
Cohesion: 0.18
Nodes (11): Before every commit (automated via pre-commit), Branch strategy, Commit conventions, Contributing, Deploy, mypy strict modules, Pull request checklist, Running locally (+3 more)

### Community 61 - "OrderHistory.tsx"
Cohesion: 0.21
Nodes (9): MAP, OrderStatusBadge(), useOrderHistory(), ActivePlanBanner(), OrderHistory(), parseFocusId(), Pricing(), getPaymentInfo() (+1 more)

### Community 62 - "shared/api/auth.ts"
Cohesion: 0.28
Nodes (8): getUsage(), UsageData, T, base, Usage, UsageIndicator(), computeUsageStats(), UsageStats

### Community 63 - "DetailTable.tsx"
Cohesion: 0.17
Nodes (13): AMOUNT_FIELDS, DetailTable(), formatAmount(), Props, sumColumn(), DATE_KEYS, HeaderCard(), Props (+5 more)

### Community 64 - "APLineItem"
Cohesion: 0.28
Nodes (10): Props, APGroupModal(), profileLabel(), Props, useAPGrouping(), apGroupKey(), buildGroupedRow(), effectiveTaxProfile() (+2 more)

### Community 65 - "Carmen AI — OCR & Import System"
Cohesion: 0.25
Nodes (8): Carmen AI — OCR & Import System, Development, Environment Variables (`backend/.env`), Key Endpoints, Quick Start, Supported Banks, Supported File Types, Tech Stack

### Community 66 - "LanguageProvider"
Cohesion: 0.22
Nodes (7): ACCEPTED, Props, SlipUpload(), SLIP, LanguageProvider(), readLang(), MAX_FILE_SIZE_MB

### Community 67 - "apiFetch"
Cohesion: 0.15
Nodes (15): PendingOrderBanner(), SLIP, OPEN_STATUSES, OrderHistoryState, apiFetch, cancelOrder(), createOrder(), CreditOrder (+7 more)

### Community 68 - "useAPExtraction.ts"
Cohesion: 0.26
Nodes (9): APExtractionProps, EXTRACTION_STAGES, NUMERIC_FIELDS, APSubmissionProps, imagesToPdf(), MAX_MULTI_IMAGES, resizeViaCanvas(), toResizedJpeg() (+1 more)

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
Cohesion: 0.12
Nodes (19): _fetchExtract(), isNumFld(), apiFetch, getAPVendorMapping, getPdfInfo, getUsage, MOCK_API_RESPONSE, MOCK_FILE (+11 more)

### Community 73 - "PDFPageSelector"
Cohesion: 0.22
Nodes (3): PDFPageSelector(), Props, PAGES

### Community 74 - "🎨 Frontend Principles (React / Vue / JS)"
Cohesion: 0.29
Nodes (7): 1. Controller Pattern (Hooks / Composables), 2. Naming Conventions (JavaScript / TypeScript), 3. State Management & Data Flow, 4. Internationalization (i18n), 5. Styling, 6. Error & Loading States, 🎨 Frontend Principles (React / Vue / JS)

### Community 75 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, type

### Community 76 - "ReviewQueue.tsx"
Cohesion: 0.20
Nodes (9): COLUMNS, docIdFromHash(), EMPTY, FILTER_LABEL, filterFromHash(), NoScansYet(), QueueEmpty(), ReviewQueue() (+1 more)

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
Cohesion: 0.03
Nodes (43): en, th, en, th, en, th, en, th (+35 more)

### Community 81 - "Mapping.tsx"
Cohesion: 0.12
Nodes (15): CompanyInfoSection(), PLACEHOLDER_KEYS, Props, buildMappingSets(), CompanyField, CompanyData, Mapping(), bankPicker() (+7 more)

### Community 82 - "ArCustomerProfiles.tsx"
Cohesion: 0.31
Nodes (9): ArCustomerProfile, listArProfiles(), syncArProfiles(), updateArProfile(), ArAction, ArCustomerProfiles(), ArCustomerProfilesState, arProfilesReducer() (+1 more)

### Community 84 - "Carmen AI — OCR & Import System"
Cohesion: 0.50
Nodes (3): Carmen AI — OCR & Import System, Email automation, Language

### Community 85 - "DataTable.test.tsx"
Cohesion: 0.40
Nodes (4): chooseSize(), columns, rows, sizeTrigger()

### Community 87 - "APAccountMappingStep.tsx"
Cohesion: 0.16
Nodes (11): APAccountMappingStep(), DEFAULT_EMPTY_ARRAY, DEFAULT_EMPTY_OBJECT, fmtField(), GLAccount, GLCardProps, GLCardRow, PillProps (+3 more)

### Community 88 - "client.ts"
Cohesion: 0.29
Nodes (8): exchangeSSOToken(), API_BASE, ApiClientOptions, CARMEN_RAW_TOKEN_KEY, createApiClient(), resolveUrl(), CarmenSSOState, useCarmenSSO()

### Community 89 - "useAPVendor.ts"
Cohesion: 0.23
Nodes (9): Props, VendorSearch(), APVendorProps, Vendor, Coords, getCoords(), Props, Tooltip() (+1 more)

### Community 91 - "APAmountSummary.tsx"
Cohesion: 0.15
Nodes (12): Diffs, Props, SummaryRow(), SummaryRowProps, Sums, Targets, Badge(), BadgeVariant (+4 more)

### Community 94 - "JvEditor.tsx"
Cohesion: 0.11
Nodes (27): approveDocument(), getPending(), ItxOverrides, rejectDocument(), Props, ARReviewPane(), labelOf(), Props (+19 more)

### Community 95 - "banks.ts"
Cohesion: 0.15
Nodes (16): BankConfigHook, NormalizedConfig, Case, CONTRACT, REASON_KEY, BANK_INFO, BANK_KEYWORDS, BANK_SOURCE_MAP (+8 more)

### Community 103 - "TKey"
Cohesion: 0.10
Nodes (20): BatchAction, BatchActionBar(), Props, NavItem, NavSection, APValidationProps, INSTRUCTIONS, Props (+12 more)

### Community 104 - "mockPaths.test.ts"
Cohesion: 0.40
Nodes (4): mockCases, REAL_PATHS, resolveSpec(), TEST_SOURCES

### Community 105 - "ProtectedRoute.tsx"
Cohesion: 0.22
Nodes (9): AuthScreen(), AuthScreenProps, AuthState, BadgeConfig, ProtectedRoute(), ProtectedRouteProps, sessionExpired(), StateConfig (+1 more)

### Community 106 - "date.ts"
Cohesion: 0.33
Nodes (10): addDays(), buildInvoicePayload(), _CARMEN_FIELD_LABELS, DateInput(), DateInputProps, formatDateToDDMMYYYY(), normalizeDateStringToCE(), normalizeYearToCE() (+2 more)

### Community 108 - "EmailSettings.tsx"
Cohesion: 0.07
Nodes (49): ApiFieldError, BankCode, call(), deleteToken(), EmailApiError, EmailDocType, EmailRule, EmailRulePayload (+41 more)

### Community 109 - "carmen.ts"
Cohesion: 0.36
Nodes (4): handleAddInputTax(), _parseCarmenHttpError(), submitInputTax(), submitToCarmen()

### Community 110 - "useMappingData.ts"
Cohesion: 0.44
Nodes (9): prefetchGlMasters(), useGlMasters(), MappingDataHook, MasterGLPrefix, useMappingData(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes() (+1 more)

### Community 111 - "useT"
Cohesion: 0.12
Nodes (19): DateRangePicker(), DateRangePickerProps, LazyMetricChart, MetricChart(), axisTick, ChartType, FALLBACK_COLORS, MetricChart() (+11 more)

### Community 113 - "TenantsPage.tsx"
Cohesion: 0.22
Nodes (10): fetchTenantDetail(), TenantRow, Column, KPICard(), KPICardProps, funnel(), median(), quotaTier() (+2 more)

### Community 115 - "reviewReasons.ts"
Cohesion: 0.29
Nodes (8): ExtractionWarningBanner(), Props, ExtractionWarning, FIX, REASON_KEY, SETTINGS, warningText(), WITH_DETAIL

### Community 117 - "main.tsx"
Cohesion: 0.10
Nodes (14): AdminRouter, APInvoice, container, getRoute(), ManualScan, OrderHistory, OrderReviewShell, Pricing (+6 more)

### Community 122 - "useMapping.ts"
Cohesion: 0.20
Nodes (14): saveARSettings(), COMPANY_FIELDS, rulesPrint(), getAccountingConfig, loaded(), saveAccountingConfig, saveARSettings, showToast (+6 more)

## Knowledge Gaps
- **648 isolated node(s):** `name`, `private`, `type`, `node`, `dev` (+643 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `useOcrWizard.ts`, `APReviewStep.tsx`, `DataTable.tsx`, `TopLevelConfigSection.tsx`, `parseNum`, `TutorialModal.tsx`, `screens.tsx`, `api.ts`, `PeriodPicker.tsx`, `orders.ts`, `useSettlementMapping.ts`, `EmailAutomationPage.tsx`, `AccountingReview.tsx`, `payment-mapping/types.ts`, `adminFetch`, `Pricing.tsx`, `AppHeader.tsx`, `MaintenanceGate.tsx`, `ManualScan.tsx`, `APInvoice.tsx`, `CheckoutFlow.tsx`, `showToast`, `CreditsPage.tsx`, `OrderTable.tsx`, `endpoints.ts`, `MainMappingTable.tsx`, `OrderWorkspace.tsx`, `FeatureFlows.tsx`, `NotificationBell.tsx`, `ExtractionsPage.tsx`, `QueueRow.tsx`, `QuotaModulesPage.tsx`, `DocumentPreview.tsx`, `AdminLogin.tsx`, `useAuth`, `formatThb`, `CreditOrdersPage.tsx`, `routes.tsx`, `PendingOrderBanner.tsx`, `OrderActions.tsx`, `OrderHistory.tsx`, `shared/api/auth.ts`, `DetailTable.tsx`, `APLineItem`, `LanguageProvider`, `apiFetch`, `useAPExtraction.ts`, `useAPExtraction`, `ReviewQueue.tsx`, `Mapping.tsx`, `ArCustomerProfiles.tsx`, `APAccountMappingStep.tsx`, `useAPVendor.ts`, `APAmountSummary.tsx`, `JvEditor.tsx`, `banks.ts`, `TKey`, `TenantsPage.tsx`, `reviewReasons.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.251) - this node is a cross-community bridge._
- **Why does `apiFetch` connect `apiFetch` to `useOcrWizard.ts`, `emailReview.ts`, `parseNum`, `api.ts`, `storage.ts`, `useSettlementMapping.ts`, `Pricing.tsx`, `useFileUpload.ts`, `useAPSubmission.ts`, `NotificationBell.tsx`, `ocr.ts`, `useOcrExtraction.ts`, `PendingOrderBanner.tsx`, `OrderHistory.tsx`, `useAPExtraction.ts`, `useAPExtraction`, `useUserConsent.ts`, `client.ts`, `useAPVendor.ts`, `JvEditor.tsx`, `carmen.ts`, `useMappingData.ts`, `useMapping.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `showToast()` connect `showToast` to `useOcrWizard.ts`, `useFileUpload.ts`, `useAPSubmission.ts`, `parseNum`, `ocr.ts`, `api.ts`, `EmailSettings.tsx`, `AuthContext.tsx`, `useOcrExtraction.ts`, `useAPVendor.ts`, `useMapping.ts`, `JvEditor.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _648 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dict/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03173076923076923 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `TopLevelConfigSection.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._