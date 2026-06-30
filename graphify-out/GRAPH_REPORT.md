# Graph Report - OCR  (2026-06-30)

## Corpus Check
- 185 files · ~93,182 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 597 nodes · 948 edges · 68 communities (61 shown, 7 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `50ea846f`
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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 62 edges
2. `parseNum()` - 19 edges
3. `appKey()` - 13 edges
4. `showToast()` - 13 edges
5. `formatThb()` - 12 edges
6. `buildQs()` - 12 edges
7. `normalizeYearToCE()` - 11 edges
8. `getCarmenUrl()` - 11 edges
9. `fmt()` - 10 edges
10. `useAuth()` - 9 edges

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

## Communities (68 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (45): handleResolve(), load(), doSync(), saveEdit(), loadList(), onChanged(), postBatch(), refreshCounts() (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (25): _fetchExtractWithRetry(), fetchTimeout(), getAPVendorMapping(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview(), getPdfInfo() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (28): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), adjustField(), reconcileRows(), repairDocFigure() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (27): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (27): getEdit(), ruleKey(), save(), setEdit(), getAccountingConfig(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig() (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (16): handleAdjust(), handleTopup(), refresh(), timeAgo(), timeAgo(), act(), doAdjust(), doTopup() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (4): FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (5): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (3): handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (5): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 14 - "Community 14"
Cohesion: 0.32
Nodes (4): perDoc(), formatRate(), PackList(), PlanCard()

### Community 15 - "Community 15"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 8` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 19`, `Community 22`, `Community 23`, `Community 24`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`?**
  _High betweenness centrality (0.472) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 4` to `Community 1`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useT()` (e.g. with `FormActions()` and `LanguageToggle()`) actually correct?**
  _`useT()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._