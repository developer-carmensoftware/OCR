# Graph Report - OCR  (2026-07-08)

## Corpus Check
- 190 files · ~122,395 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 692 nodes · 1141 edges · 93 communities (82 shown, 11 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 144 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d93f37d3`
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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 72 edges
2. `t()` - 24 edges
3. `parseNum()` - 21 edges
4. `showToast()` - 16 edges
5. `unwrapDetail()` - 15 edges
6. `formatThb()` - 13 edges
7. `appKey()` - 13 edges
8. `buildQs()` - 13 edges
9. `normalizeYearToCE()` - 12 edges
10. `useAPValidation()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `UsageIndicator()` --calls--> `useAuth()`  [INFERRED]
  components/common/UsageIndicator.tsx → contexts/AuthContext.tsx
- `PackList()` --calls--> `useT()`  [INFERRED]
  components/pricing/PackList.tsx → i18n/LanguageContext.tsx
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `useOrderHistory()` --calls--> `useT()`  [INFERRED]
  hooks/credits/useOrderHistory.ts → i18n/LanguageContext.tsx
- `withExtractedData()` --calls--> `act()`  [INFERRED]
  test/useOcrExtraction.test.js → components/admin/OrderWorkspace.tsx

## Communities (93 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (28): _fetchExtractWithRetry(), createApiClient(), fetchTimeout(), getAccountingConfig(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview() (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (29): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+21 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (25): profileKey(), profileLabel(), adjustField(), reconcileRows(), repairDocFigure(), header(), masterReconcile(), runAdjust() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (23): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (22): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (18): handleAdjust(), handleTopup(), refresh(), fmtDateTime(), timeAgo(), timeAgo(), act(), doAdjust() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (18): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (6): useAPInvoice(), useAPVendor(), FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (15): getEdit(), ruleKey(), save(), setEdit(), mockSuccess(), withExtractedData(), useAPExtraction(), getAPFields() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.2
Nodes (13): handleReset(), handleSaveLimit(), handleToggleModule(), load(), cancelOrder(), fetchAdminPaymentInfo(), fetchQuotaOverview(), getOrderSlipUrl() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (9): handleRevoke(), load(), buildQs(), fetchErrorBreakdown(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs(), fetchSessions() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (3): handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 13 - "Community 13"
Cohesion: 0.21
Nodes (6): AdminLayout(), AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 14 - "Community 14"
Cohesion: 0.23
Nodes (7): clearToken(), getStoredToken(), storeToken(), getJwtExpMs(), clearAppStorage(), setActiveTenant(), setCarmenUri()

### Community 15 - "Community 15"
Cohesion: 0.27
Nodes (5): createCreditOrder(), getCreditPacks(), handleOpen(), handleRequest(), onOpen()

### Community 16 - "Community 16"
Cohesion: 0.28
Nodes (5): perDoc(), formatRate(), formatRate(), PackList(), PlanCard()

### Community 19 - "Community 19"
Cohesion: 0.28
Nodes (5): doSync(), saveEdit(), listArProfiles(), syncArProfiles(), updateArProfile()

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 21 - "Community 21"
Cohesion: 0.43
Nodes (6): useOrderActions(), withName(), approveOrder(), holdBatch(), rejectOrder(), updateOrderNote()

### Community 23 - "Community 23"
Cohesion: 0.32
Nodes (4): computeUsageStats(), computeUsageStats(), UsageIndicator(), computeUsageStats()

### Community 24 - "Community 24"
Cohesion: 0.46
Nodes (5): ConsentGate(), ProtectedRoute(), useAuth(), useCarmenSSO(), useUserConsent()

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (6): adminLogout(), adminMe(), clearAdminToken(), getAdminToken(), storeAdminToken(), AdminAuthProvider()

### Community 28 - "Community 28"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (3): AuthProvider(), getRoute(), onHashChange()

### Community 33 - "Community 33"
Cohesion: 0.7
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

### Community 34 - "Community 34"
Cohesion: 0.7
Nodes (4): exchangeSSOToken(), getUsage(), revokeSession(), resolveUrl()

## Knowledge Gaps
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 7` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 16`, `Community 19`, `Community 21`, `Community 22`, `Community 26`, `Community 32`, `Community 36`, `Community 37`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 59`, `Community 60`, `Community 61`?**
  _High betweenness centrality (0.419) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 0` to `Community 2`, `Community 3`, `Community 7`, `Community 8`, `Community 14`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 6` to `Community 0`, `Community 2`, `Community 4`, `Community 14`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `useT()` (e.g. with `FormActions()` and `LanguageToggle()`) actually correct?**
  _`useT()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._