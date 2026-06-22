# Graph Report - OCR  (2026-06-22)

## Corpus Check
- 176 files · ~87,063 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 554 nodes · 817 edges · 79 communities (74 shown, 5 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d51ff7e0`
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]

## God Nodes (most connected - your core abstractions)
1. `parseNum()` - 18 edges
2. `appKey()` - 13 edges
3. `showToast()` - 13 edges
4. `buildQs()` - 12 edges
5. `normalizeYearToCE()` - 11 edges
6. `formatThb()` - 11 edges
7. `getCarmenUrl()` - 11 edges
8. `fmt()` - 10 edges
9. `useAuth()` - 9 edges
10. `useAPValidation()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx
- `withExtractedData()` --calls--> `act()`  [INFERRED]
  test/useAPExtraction.test.js → components/admin/OrderWorkspace.tsx
- `withExtractedData()` --calls--> `act()`  [INFERRED]
  test/useOcrExtraction.test.js → components/admin/OrderWorkspace.tsx
- `getJvhDate()` --calls--> `act()`  [INFERRED]
  test/useOcrSubmission.test.js → components/admin/OrderWorkspace.tsx

## Communities (79 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (33): timeAgo(), cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), listOrders() (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (27): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), reconcileRows(), repairDocFigure(), header(), masterReconcile() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (26): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (19): _fetchExtractWithRetry(), fetchTimeout(), getAPVendorMapping(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), useOcrExtraction() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (22): addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (17): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName(), getBankInfo() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (15): getEdit(), ruleKey(), save(), setEdit(), getAccountingConfig(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig() (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (11): handleAdjust(), handleTopup(), refresh(), doAdjust(), doTopup(), load(), adjustCredits(), fetchAdminOrderDocuments() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (7): buildQs(), fetchErrorBreakdown(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fetchTenantRanking(), fetchTenants()

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (3): handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (5): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (12): adminLogout(), adminMe(), approveOrder(), cancelOrder(), clearAdminToken(), getAdminToken(), getOrderSlipUrl(), holdOrder() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (5): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (9): loadList(), onChanged(), refreshCounts(), act(), withName(), fetchAdminPaymentInfo(), listCreditOrders(), doCancel() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 20 - "Community 20"
Cohesion: 0.6
Nodes (4): handleRevoke(), load(), fetchSessions(), revokeSession()

### Community 21 - "Community 21"
Cohesion: 0.7
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `showToast()` connect `Community 3` to `Community 1`, `Community 2`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Why does `act()` connect `Community 13` to `Community 3`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `parseNum()` (e.g. with `buildGroupedRow()` and `buildInvoicePayload()`) actually correct?**
  _`parseNum()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `normalizeYearToCE()` (e.g. with `handleAddInputTax()` and `parseJvhDate()`) actually correct?**
  _`normalizeYearToCE()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._