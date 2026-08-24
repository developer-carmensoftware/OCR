# Graph Report - OCR  (2026-08-24)

## Corpus Check
- 255 files · ~179,869 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1032 nodes · 1849 edges · 118 communities (108 shown, 10 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 226 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84475fbc`
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
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
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 62|Community 62]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 113 edges
2. `t()` - 51 edges
3. `unwrapDetail()` - 39 edges
4. `parseNum()` - 22 edges
5. `appKey()` - 22 edges
6. `showToast()` - 21 edges
7. `buildQs()` - 17 edges
8. `round2()` - 16 edges
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

## Communities (118 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (74): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+66 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (30): profileKey(), profileLabel(), adjustField(), reconcileRows(), repairDocFigure(), header(), masterReconcile(), runAdjust() (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (28): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (26): handleResolve(), load(), classify(), groupByCause(), getCols(), getCols(), getCols(), daysAgo() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (29): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), doSync() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (20): AdminLayout(), getNavSections(), AdminLogin(), classify(), handleSubmit(), mmss(), AdminProtectedRoute(), adminLogin() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): getAccountingConfig(), diffCorrections(), logCorrections(), detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), readFromLocalStorage(), useAccountingConfig() (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): getCols(), getPacks(), handleAdjust(), handleTopup(), refresh(), arm(), fmtDateTime(), timeAgo() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (17): confirmEnable(), endNow(), load(), pad(), requestEnable(), startNow(), t(), toggleTenant() (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (10): catalogName(), perDoc(), formatRate(), formatThb(), formatRate(), PackList(), PlanCard(), PromptPayQR() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (8): useAPExtraction(), useAPInvoice(), useAPVendor(), FormActions(), LanguageToggle(), useT(), OrderStatusBadge(), PurchaseTutorial()

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (7): docLabel(), isOutside(), notifText(), onDown(), onScroll(), timeAgo(), useFitRows()

### Community 12 - "Community 12"
Cohesion: 0.23
Nodes (14): createEmailFlowRule(), deleteEmailFlowRule(), getEmailDocument(), getEmailFlowSettings(), _json(), listEmailDocuments(), markEmailDocumentPosted(), putEmailFlowAddresses() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (5): AppHeader(), handleBack(), handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (8): _fetchExtract(), _fetchExtractWithRetry(), fetchTimeout(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl(), sanitizedPdfUrl(), stripAutoOpen()

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (11): cancelOrder(), createOrder(), detail(), getCompanyProfile(), OpenOrderError, clearPersistedCheckout(), loadPersistedCheckout(), persist() (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.2
Nodes (10): exchangeSSOToken(), revokeSession(), clearToken(), createApiClient(), resolveUrl(), storeToken(), getJwtExpMs(), clearAppStorage() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.32
Nodes (10): getCarmenRawToken(), call(), deleteToken(), EmailApiError, getBankCodes(), getSettings(), getToken(), json() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (5): showToast(), async(), copy(), rulesWith(), submitRule()

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (9): formatDate(), bahtToEnglishWords(), bahtToThaiWords(), formatDate(), _hundreds(), _thReadGroup(), whtDeduction(), isOnHold() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (6): getUsage(), getStoredToken(), computeUsageStats(), computeUsageStats(), fetchUsage(), computeUsageStats()

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (10): completeEmailIngest(), listPendingEmailIngests(), toWizardExtract(), getPdfInfo(), useFileUpload(), useOcrSubmission(), getPdfInfoWithRetry(), useOcrWizard() (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.27
Nodes (8): getOrderDocuments(), uploadSlip(), handleSlip(), loadDocs(), toggle(), handleSlip(), isReviewing(), toggle()

### Community 24 - "Community 24"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.26
Nodes (7): ConsentGate(), ProtectedRoute(), UsageIndicator(), useAuth(), useEmailSettings(), useCarmenSSO(), useUserConsent()

### Community 26 - "Community 26"
Cohesion: 0.23
Nodes (7): check(), fmtHM(), fmtICT(), isAdminRoute(), onHash(), onVisible(), probe()

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (5): clampAxis(), computeView(), spotTarget(), overview(), useCamera()

### Community 28 - "Community 28"
Cohesion: 0.27
Nodes (5): createCreditOrder(), getCreditPacks(), handleOpen(), handleRequest(), onOpen()

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (5): listNotifications(), markNotificationsRead(), markReleaseSeen(), readReleaseSeen(), useNotifications()

### Community 30 - "Community 30"
Cohesion: 0.27
Nodes (5): extractFromFile(), mockExtract(), withExtractedData(), useOcrExtraction(), withExtractedData()

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (5): mockSuccess(), withExtractedData(), getAPVendorMapping(), mockSuccess(), withExtractedData()

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 33 - "Community 33"
Cohesion: 0.39
Nodes (6): getConsentStatus(), postConsent(), cacheConsent(), consentKey(), readCached(), readConsent()

### Community 37 - "Community 37"
Cohesion: 0.62
Nodes (5): clearAllDrafts(), clearDraft(), keyFor(), loadDraft(), saveDraft()

### Community 38 - "Community 38"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 10` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 13`, `Community 14`, `Community 17`, `Community 20`, `Community 21`, `Community 23`, `Community 26`, `Community 27`, `Community 29`, `Community 35`, `Community 36`, `Community 41`, `Community 46`, `Community 47`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 74`, `Community 75`, `Community 76`, `Community 77`?**
  _High betweenness centrality (0.537) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 19` to `Community 1`, `Community 2`, `Community 6`, `Community 10`, `Community 12`, `Community 14`, `Community 16`, `Community 22`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 6` to `Community 1`, `Community 4`, `Community 37`, `Community 14`, `Community 16`, `Community 22`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `DarkModeToggle()`) actually correct?**
  _`useT()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 4 INFERRED edges - model-reasoned connections that need verification._