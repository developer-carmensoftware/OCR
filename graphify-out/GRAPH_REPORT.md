# Graph Report - OCR  (2026-07-13)

## Corpus Check
- 199 files · ~128,171 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 752 nodes · 1294 edges · 95 communities (85 shown, 10 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 187 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `273d8a4d`
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
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 93 edges
2. `t()` - 51 edges
3. `parseNum()` - 22 edges
4. `unwrapDetail()` - 21 edges
5. `showToast()` - 16 edges
6. `round2()` - 14 edges
7. `useAuth()` - 13 edges
8. `formatThb()` - 13 edges
9. `appKey()` - 13 edges
10. `buildQs()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [INFERRED]
  components/admin/MetricChart.tsx → i18n/LanguageContext.tsx
- `handleStepClick()` --calls--> `t()`  [INFERRED]
  pages/APInvoice.tsx → components/admin/VoidReasonModal.tsx
- `getNavSections()` --calls--> `t()`  [INFERRED]
  pages/admin/AdminLayout.tsx → components/admin/VoidReasonModal.tsx
- `getCols()` --calls--> `t()`  [INFERRED]
  pages/admin/JobsPage.tsx → components/admin/VoidReasonModal.tsx
- `getCols()` --calls--> `t()`  [INFERRED]
  pages/admin/LLMLogsPage.tsx → components/admin/VoidReasonModal.tsx

## Communities (95 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (34): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), adjustField(), reconcileRows(), repairDocFigure() (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (27): listNotifications(), markNotificationsRead(), AppHeader(), ConsentGate(), ProtectedRoute(), computeUsageStats(), computeUsageStats(), UsageIndicator() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (22): _fetchExtractWithRetry(), clearToken(), createApiClient(), fetchTimeout(), storeToken(), extractFromFile(), getFilePreview(), getPdfInfo() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (25): handleResolve(), load(), getCols(), getCols(), getCols(), handleRevoke(), load(), load() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (20): act(), withName(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax() (+12 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (18): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (15): handleAdjust(), handleTopup(), refresh(), timeAgo(), timeAgo(), doAdjust(), doTopup(), load() (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): paymentDate(), addDays(), buildInvoicePayload(), handleSelect(), addDays(), buildInvoicePayload(), formatCarmenError(), parseCarmenDupError() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (14): getEdit(), ruleKey(), save(), setEdit(), mockSuccess(), withExtractedData(), getAPFields(), getAPVendorFieldRules() (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.19
Nodes (17): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), cancelOrder() (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (6): listOrders(), FormActions(), LanguageToggle(), useOrderHistory(), useT(), OrderStatusBadge()

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (15): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (10): exchangeSSOToken(), getUsage(), revokeSession(), getStoredToken(), resolveUrl(), createCreditOrder(), getCreditPacks(), handleOpen() (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.2
Nodes (10): doSync(), saveEdit(), adminLogout(), adminMe(), clearAdminToken(), getAdminToken(), listArProfiles(), storeAdminToken() (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (8): AdminLayout(), getNavSections(), AdminLogin(), handleSubmit(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (11): createOrder(), detail(), getCompanyProfile(), OpenOrderError, uploadSlip(), clearPersistedCheckout(), loadPersistedCheckout(), persist() (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (9): getTabs(), handleReset(), handleSaveLimit(), handleToggleModule(), load(), fetchQuotaOverview(), resetQuotaUsage(), toggleTenantModule() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.2
Nodes (6): catalogName(), perDoc(), formatRate(), formatRate(), PackList(), PlanCard()

### Community 19 - "Community 19"
Cohesion: 0.27
Nodes (8): cancelOrder(), formatDate(), formatDate(), doCancel(), isOnHold(), isReviewing(), toggle(), expiryDate()

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): getCols(), getPacks(), getColsCost(), getColsPerf(), t(), fetchTenantRanking(), handleReExtract(), handleStepClick()

### Community 21 - "Community 21"
Cohesion: 0.2
Nodes (4): formatThb(), handleConfirm(), handleSlip(), PromptPayQR()

### Community 22 - "Community 22"
Cohesion: 0.28
Nodes (5): isOutside(), notifText(), onDown(), onScroll(), timeAgo()

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 24 - "Community 24"
Cohesion: 0.43
Nodes (6): useOrderActions(), withName(), approveOrder(), holdBatch(), rejectOrder(), updateOrderNote()

### Community 27 - "Community 27"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 30 - "Community 30"
Cohesion: 0.53
Nodes (4): bahtToEnglishWords(), bahtToThaiWords(), _hundreds(), _thReadGroup()

### Community 32 - "Community 32"
Cohesion: 0.7
Nodes (3): getOrderDocuments(), loadDocs(), toggle()

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 10` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 26`, `Community 29`, `Community 32`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 63`?**
  _High betweenness centrality (0.496) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 7`, `Community 8`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 20`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `FormActions()`) actually correct?**
  _`useT()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._