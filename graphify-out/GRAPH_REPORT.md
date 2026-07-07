# Graph Report - OCR  (2026-07-07)

## Corpus Check
- 185 files · ~120,785 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 662 nodes · 1100 edges · 82 communities (75 shown, 7 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 140 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be06c493`
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
- [[_COMMUNITY_Community 11|Community 11]]
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 41|Community 41]]

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
- `handleOpenJv()` --calls--> `getCarmenUrl()`  [INFERRED]
  components/credit-card/JournalVoucher.tsx → lib/url.ts
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `PackList()` --calls--> `useT()`  [INFERRED]
  components/pricing/PackList.tsx → i18n/LanguageContext.tsx
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx
- `paymentDate()` --calls--> `formatDateToDDMMYYYY()`  [INFERRED]
  components/admin/OrderTable.tsx → lib/date.ts

## Communities (82 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (32): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (26): profileKey(), profileLabel(), adjustField(), reconcileRows(), repairDocFigure(), header(), masterReconcile(), runAdjust() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (29): doSync(), saveEdit(), afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (23): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (27): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), OpenOrderError, uploadSlip(), catalogName() (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (28): getEdit(), ruleKey(), save(), setEdit(), getAccountingConfig(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig() (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (13): adminLogout(), adminMe(), buildQs(), clearAdminToken(), fetchErrorBreakdown(), fetchJobs(), fetchLLMLogs(), fetchPerformanceLogs() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (8): useAPInvoice(), useAPVendor(), listOrders(), FormActions(), LanguageToggle(), useOrderHistory(), useT(), OrderStatusBadge()

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (5): timeAgo(), timeAgo(), fetchAdminOrderDocuments(), orderStage(), timeAgo()

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (6): AdminAuthProvider(), AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (7): diffCorrections(), logCorrections(), parseJvhDate(), getJvhDate(), makeProps(), getJvhDate(), makeProps()

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (6): AdminLayout(), AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (9): act(), withName(), mockSuccess(), withExtractedData(), useAPExtraction(), getAPVendorMapping(), mockSuccess(), withExtractedData() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.21
Nodes (4): extractFromFile(), mockExtract(), withExtractedData(), showToast()

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (5): _fetchExtractWithRetry(), fetchTimeout(), getFilePreview(), checkFilesSize(), selectedPagesToPdfUrl()

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (10): useOrderActions(), withName(), approveOrder(), cancelOrder(), getOrderSlipUrl(), holdBatch(), holdOrder(), rejectOrder() (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (5): perDoc(), formatRate(), formatRate(), PackList(), PlanCard()

### Community 18 - "Community 18"
Cohesion: 0.35
Nodes (10): handleAdjust(), handleTopup(), refresh(), doAdjust(), doTopup(), load(), adjustCredits(), fetchCreditBalance() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.36
Nodes (7): getPdfInfo(), useFileUpload(), useOcrExtraction(), useOcrSubmission(), getPdfInfoWithRetry(), useOcrWizard(), useModal()

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 23 - "Community 23"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 27 - "Community 27"
Cohesion: 0.6
Nodes (4): handleRevoke(), load(), fetchSessions(), revokeSession()

### Community 28 - "Community 28"
Cohesion: 0.7
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 7` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 8`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 15`, `Community 16`, `Community 17`, `Community 26`, `Community 33`, `Community 34`, `Community 35`, `Community 38`, `Community 39`, `Community 40`, `Community 52`, `Community 53`, `Community 54`, `Community 55`?**
  _High betweenness centrality (0.454) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 14` to `Community 0`, `Community 1`, `Community 3`, `Community 7`, `Community 11`, `Community 13`, `Community 15`, `Community 19`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 11`, `Community 14`, `Community 15`, `Community 19`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `useT()` (e.g. with `FormActions()` and `LanguageToggle()`) actually correct?**
  _`useT()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._