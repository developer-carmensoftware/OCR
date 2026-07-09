# Graph Report - OCR  (2026-07-07)

## Corpus Check
- 185 files · ~120,785 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 662 nodes · 1100 edges · 79 communities (71 shown, 8 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 140 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `86cff5b4`
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
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 72 edges
2. `t()` - 24 edges
3. `parseNum()` - 21 edges
4. `showToast()` - 16 edges
5. `formatThb()` - 13 edges
6. `appKey()` - 13 edges
7. `normalizeYearToCE()` - 12 edges
8. `buildQs()` - 12 edges
9. `useAPValidation()` - 11 edges
10. `getCarmenUrl()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `PackList()` --calls--> `useT()`  [INFERRED]
  components/pricing/PackList.tsx → i18n/LanguageContext.tsx
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `useOrderHistory()` --calls--> `useT()`  [INFERRED]
  hooks/credits/useOrderHistory.ts → i18n/LanguageContext.tsx
- `withExtractedData()` --calls--> `act()`  [INFERRED]
  test/useOcrExtraction.test.js → components/admin/OrderWorkspace.tsx
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx

## Communities (79 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (34): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (31): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (26): _fetchExtractWithRetry(), fetchTimeout(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload() (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (25): profileKey(), profileLabel(), adjustField(), reconcileRows(), repairDocFigure(), header(), masterReconcile(), runAdjust() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (23): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (28): getEdit(), ruleKey(), save(), setEdit(), getAccountingConfig(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig() (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (24): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (14): handleAdjust(), handleTopup(), refresh(), act(), doAdjust(), doTopup(), load(), withName() (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (7): buildQs(), fetchErrorBreakdown(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fetchTenantRanking(), fetchTenants()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (4): FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (6): AdminAuthProvider(), AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (6): AdminLayout(), AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 13 - "Community 13"
Cohesion: 0.31
Nodes (8): adminLogout(), adminMe(), cancelOrder(), clearAdminToken(), fetchAdminPaymentInfo(), getAdminToken(), getOrderSlipUrl(), storeAdminToken()

### Community 14 - "Community 14"
Cohesion: 0.27
Nodes (6): mockSuccess(), withExtractedData(), useAPExtraction(), getAPVendorMapping(), mockSuccess(), withExtractedData()

### Community 15 - "Community 15"
Cohesion: 0.44
Nodes (7): useOrderActions(), withName(), approveOrder(), holdBatch(), rejectOrder(), unwrapDetail(), updateOrderNote()

### Community 17 - "Community 17"
Cohesion: 0.28
Nodes (5): doSync(), saveEdit(), listArProfiles(), syncArProfiles(), updateArProfile()

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (4): timeAgo(), timeAgo(), orderStage(), timeAgo()

### Community 21 - "Community 21"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 23 - "Community 23"
Cohesion: 0.6
Nodes (4): handleRevoke(), load(), fetchSessions(), revokeSession()

### Community 24 - "Community 24"
Cohesion: 0.7
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 9` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 10`, `Community 11`, `Community 12`, `Community 14`, `Community 15`, `Community 17`, `Community 19`, `Community 26`, `Community 28`, `Community 29`, `Community 30`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 49`, `Community 50`, `Community 51`, `Community 52`?**
  _High betweenness centrality (0.454) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 35`, `Community 14`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 5` to `Community 1`, `Community 2`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `useT()` (e.g. with `FormActions()` and `LanguageToggle()`) actually correct?**
  _`useT()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._