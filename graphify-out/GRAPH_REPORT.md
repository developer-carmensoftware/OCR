# Graph Report - OCR  (2026-07-06)

## Corpus Check
- 191 files · ~120,827 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 628 nodes · 1027 edges · 75 communities (68 shown, 7 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 134 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `770e9232`
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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 34|Community 34]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 71 edges
2. `t()` - 22 edges
3. `parseNum()` - 19 edges
4. `formatThb()` - 13 edges
5. `appKey()` - 13 edges
6. `showToast()` - 13 edges
7. `buildQs()` - 12 edges
8. `normalizeYearToCE()` - 11 edges
9. `getCarmenUrl()` - 11 edges
10. `useAPValidation()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `useOrderHistory()` --calls--> `useT()`  [INFERRED]
  hooks/credits/useOrderHistory.ts → i18n/LanguageContext.tsx
- `PackList()` --calls--> `useT()`  [INFERRED]
  components/pricing/PackList.tsx → i18n/LanguageContext.tsx
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx
- `paymentDate()` --calls--> `formatDateToDDMMYYYY()`  [INFERRED]
  components/admin/OrderTable.tsx → lib/date.ts

## Communities (75 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (34): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (27): act(), withName(), _fetchExtractWithRetry(), fetchTimeout(), getAPVendorMapping(), diffCorrections(), logCorrections(), extractFromFile() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (28): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), adjustField(), reconcileRows(), repairDocFigure() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (27): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (28): doSync(), saveEdit(), afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (22): paymentDate(), addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError() (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (28): getEdit(), ruleKey(), save(), setEdit(), getAccountingConfig(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig() (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.19
Nodes (15): adminLogout(), adminMe(), approveOrder(), cancelOrder(), clearAdminToken(), fetchAdminPaymentInfo(), getAdminToken(), getOrderSlipUrl() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (7): buildQs(), fetchErrorBreakdown(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fetchTenantRanking(), fetchTenants()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (4): FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (5): timeAgo(), timeAgo(), useOrderActions(), fetchAdminOrderDocuments(), orderStage()

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (5): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (3): handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 14 - "Community 14"
Cohesion: 0.21
Nodes (6): AdminLayout(), AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 15 - "Community 15"
Cohesion: 0.35
Nodes (10): handleAdjust(), handleTopup(), refresh(), doAdjust(), doTopup(), load(), adjustCredits(), fetchCreditBalance() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 22 - "Community 22"
Cohesion: 0.7
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

### Community 23 - "Community 23"
Cohesion: 0.6
Nodes (4): handleRevoke(), load(), fetchSessions(), revokeSession()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 9` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 21`, `Community 26`, `Community 27`, `Community 28`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`?**
  _High betweenness centrality (0.471) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 6` to `Community 1`, `Community 2`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 1` to `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `useT()` (e.g. with `useOrderActions()` and `FormActions()`) actually correct?**
  _`useT()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 2 INFERRED edges - model-reasoned connections that need verification._