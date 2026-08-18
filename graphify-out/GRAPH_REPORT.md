# Graph Report - OCR  (2026-08-18)

## Corpus Check
- 246 files · ~169,572 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 990 nodes · 1751 edges · 112 communities (103 shown, 9 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 222 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5982b87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 111 edges
2. `t()` - 51 edges
3. `unwrapDetail()` - 39 edges
4. `parseNum()` - 22 edges
5. `appKey()` - 22 edges
6. `showToast()` - 21 edges
7. `round2()` - 16 edges
8. `buildQs()` - 16 edges
9. `useAuth()` - 15 edges
10. `formatThb()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [INFERRED]
  components/admin/MetricChart.tsx → i18n/LanguageContext.tsx
- `arm()` --calls--> `run()`  [INFERRED]
  components/admin/OrderActions.tsx → pages/admin/EmailAutomationPage.tsx
- `getNavSections()` --calls--> `t()`  [INFERRED]
  pages/admin/AdminLayout.tsx → components/admin/VoidReasonModal.tsx
- `getPacks()` --calls--> `t()`  [INFERRED]
  pages/admin/CreditsPage.tsx → components/admin/VoidReasonModal.tsx
- `getCols()` --calls--> `t()`  [INFERRED]
  pages/admin/CreditsPage.tsx → components/admin/VoidReasonModal.tsx

## Communities (112 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (42): getAccountingConfig(), completeEmailIngest(), listPendingEmailIngests(), toWizardExtract(), diffCorrections(), logCorrections(), getPdfInfo(), detectBankFromCompanyName() (+34 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (42): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (27): paymentDate(), addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (31): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), getColsCost() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (25): _fetchExtract(), _fetchExtractWithRetry(), mockSuccess(), withExtractedData(), useAPExtraction(), fetchTimeout(), getAPVendorMapping(), extractFromFile() (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (29): profileKey(), profileLabel(), useAPInvoice(), useAPSubmission(), adjustField(), reconcileRows(), repairDocFigure(), header() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (32): exchangeSSOToken(), revokeSession(), clearToken(), createApiClient(), getCarmenRawToken(), resolveUrl(), storeToken(), call() (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (19): createEmailFlowRule(), deleteEmailFlowRule(), getEmailDocument(), getEmailFlowSettings(), _json(), listEmailDocuments(), markEmailDocumentPosted(), putEmailFlowAddresses() (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (17): AdminLayout(), getNavSections(), AdminLogin(), classify(), handleSubmit(), mmss(), AdminProtectedRoute(), adminLogin() (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (6): useAPVendor(), FormActions(), LanguageToggle(), useT(), OrderStatusBadge(), PurchaseTutorial()

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (17): confirmEnable(), endNow(), load(), pad(), requestEnable(), startNow(), t(), toggleTenant() (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (22): runTest(), saveSettings(), toggleRule(), cancelOrder(), endMaintenanceNow(), fetchEmailBusinessUnits(), fetchExtractionFailures(), fetchMaintenance() (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (3): translate(), LanguageProvider(), Spot()

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (9): getTabs(), handleReset(), handleSaveLimit(), handleToggleModule(), load(), fetchQuotaOverview(), resetQuotaUsage(), toggleTenantModule() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.21
Nodes (9): ageLabel(), loadDocuments(), pollMessage(), relativeAge(), run(), statusTone(), fetchEmailDocuments(), fetchEmailHealth() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (4): AppHeader(), handleBack(), getCarmenUri(), getCarmenUrl()

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (7): getCols(), getCols(), getCols(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fmtDateTime()

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (10): cancelOrder(), createOrder(), detail(), getOrderDocuments(), OpenOrderError, uploadSlip(), handleSlip(), loadDocs() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (9): handleRevoke(), load(), buildQs(), fetchErrorBreakdown(), fetchSessions(), fetchTenantRanking(), fetchUsageSummary(), fetchUsageTotals() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (6): getUsage(), getStoredToken(), computeUsageStats(), computeUsageStats(), fetchUsage(), computeUsageStats()

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (7): check(), fmtHM(), fmtICT(), isAdminRoute(), onHash(), onVisible(), probe()

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.2
Nodes (6): catalogName(), perDoc(), formatRate(), formatRate(), PackList(), PlanCard()

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (5): clampAxis(), computeView(), spotTarget(), overview(), useCamera()

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (7): formatDate(), formatDate(), doCancel(), isOnHold(), isReviewing(), toggle(), expiryDate()

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (4): formatThb(), PromptPayQR(), asyncNoop(), noop()

### Community 27 - "Community 27"
Cohesion: 0.27
Nodes (5): createCreditOrder(), getCreditPacks(), handleOpen(), handleRequest(), onOpen()

### Community 28 - "Community 28"
Cohesion: 0.28
Nodes (5): doSync(), saveEdit(), listArProfiles(), syncArProfiles(), updateArProfile()

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 31 - "Community 31"
Cohesion: 0.39
Nodes (6): getConsentStatus(), postConsent(), cacheConsent(), consentKey(), readCached(), readConsent()

### Community 32 - "Community 32"
Cohesion: 0.32
Nodes (6): getCompanyProfile(), clearPersistedCheckout(), loadPersistedCheckout(), persist(), readPersisted(), backToCatalog()

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (6): adminLogout(), adminMe(), clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthProvider()

### Community 36 - "Community 36"
Cohesion: 0.48
Nodes (5): bahtToEnglishWords(), bahtToThaiWords(), _hundreds(), _thReadGroup(), whtDeduction()

### Community 37 - "Community 37"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 39 - "Community 39"
Cohesion: 0.53
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 9` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 28`, `Community 29`, `Community 35`, `Community 39`, `Community 40`, `Community 41`, `Community 45`, `Community 46`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 69`, `Community 70`, `Community 71`?**
  _High betweenness centrality (0.537) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 4` to `Community 0`, `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 0` to `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `DarkModeToggle()`) actually correct?**
  _`useT()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 4 INFERRED edges - model-reasoned connections that need verification._