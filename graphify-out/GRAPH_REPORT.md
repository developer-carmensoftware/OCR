# Graph Report - OCR  (2026-07-10)

## Corpus Check
- 197 files · ~127,125 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 745 nodes · 1283 edges · 90 communities (80 shown, 10 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 187 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5ffa5b31`
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 93 edges
2. `t()` - 51 edges
3. `parseNum()` - 21 edges
4. `unwrapDetail()` - 21 edges
5. `showToast()` - 16 edges
6. `useAuth()` - 13 edges
7. `round2()` - 13 edges
8. `formatThb()` - 13 edges
9. `appKey()` - 13 edges
10. `buildQs()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [INFERRED]
  components/admin/MetricChart.tsx → i18n/LanguageContext.tsx
- `handleStepClick()` --calls--> `t()`  [INFERRED]
  pages/APInvoice.tsx → components/admin/VoidReasonModal.tsx
- `handleReExtract()` --calls--> `t()`  [INFERRED]
  pages/CreditCardOCR.tsx → components/admin/VoidReasonModal.tsx
- `handleStepClick()` --calls--> `t()`  [INFERRED]
  pages/CreditCardOCR.tsx → components/admin/VoidReasonModal.tsx
- `getNavSections()` --calls--> `t()`  [INFERRED]
  pages/admin/AdminLayout.tsx → components/admin/VoidReasonModal.tsx

## Communities (90 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (39): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+31 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), fetchTimeout(), getStoredToken(), resolveUrl() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (28): _fetchExtractWithRetry(), getAccountingConfig(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (30): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), adjustField(), reconcileRows(), repairDocFigure(), header() (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (21): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError() (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (19): handleResolve(), load(), getCols(), getCols(), getCols(), handleRevoke(), load(), getCols() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (20): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (14): getEdit(), ruleKey(), save(), setEdit(), mockSuccess(), withExtractedData(), getAPFields(), getAPVendorFieldRules() (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (16): useOrderActions(), withName(), adminLogout(), adminMe(), approveOrder(), cancelOrder(), clearAdminToken(), fetchAdminPaymentInfo() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (7): timeAgo(), timeAgo(), act(), withName(), fetchAdminOrderDocuments(), orderStage(), timeAgo()

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (4): FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (13): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (14): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), t() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (6): AdminAuthProvider(), AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (8): AdminLayout(), getNavSections(), AdminLogin(), handleSubmit(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (9): getTabs(), handleReset(), handleSaveLimit(), handleToggleModule(), load(), fetchQuotaOverview(), resetQuotaUsage(), toggleTenantModule() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.27
Nodes (12): getCols(), getPacks(), handleAdjust(), handleTopup(), refresh(), doAdjust(), doTopup(), load() (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.21
Nodes (6): load(), loadDetail(), metricLabel(), toggle(), fetchTenantDetail(), fetchTenants()

### Community 19 - "Community 19"
Cohesion: 0.28
Nodes (5): isOutside(), notifText(), onDown(), onScroll(), timeAgo()

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (5): doSync(), saveEdit(), listArProfiles(), syncArProfiles(), updateArProfile()

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 23 - "Community 23"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (3): getColsCost(), getColsPerf(), fetchTenantRanking()

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 10` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`?**
  _High betweenness centrality (0.495) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 6` to `Community 1`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `FormActions()`) actually correct?**
  _`useT()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._