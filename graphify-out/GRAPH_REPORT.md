# Graph Report - OCR  (2026-06-23)

## Corpus Check
- 177 files · ~88,898 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 556 nodes · 876 edges · 67 communities (62 shown, 5 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ac92db92`
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
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 58 edges
2. `parseNum()` - 18 edges
3. `appKey()` - 13 edges
4. `showToast()` - 13 edges
5. `buildQs()` - 12 edges
6. `normalizeYearToCE()` - 11 edges
7. `formatThb()` - 11 edges
8. `getCarmenUrl()` - 11 edges
9. `fmt()` - 10 edges
10. `useAuth()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `withExtractedData()` --calls--> `act()`  [INFERRED]
  test/useOcrExtraction.test.js → components/admin/OrderWorkspace.tsx
- `PackList()` --calls--> `useT()`  [INFERRED]
  components/pricing/PackList.tsx → i18n/LanguageContext.tsx
- `doCancel()` --calls--> `onChanged()`  [INFERRED]
  components/pricing/PendingOrderBanner.tsx → pages/admin/CreditOrdersPage.tsx
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx

## Communities (67 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (47): handleResolve(), load(), loadList(), onChanged(), refreshCounts(), handleAdjust(), handleTopup(), refresh() (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (30): timeAgo(), cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (27): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), reconcileRows(), repairDocFigure(), header() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (20): _fetchExtractWithRetry(), fetchTimeout(), getAPVendorMapping(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), useOcrExtraction() (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (26): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+18 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (21): addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (17): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName(), getBankInfo() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (15): getEdit(), ruleKey(), save(), setEdit(), getAccountingConfig(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (6): listOrders(), FormActions(), LanguageToggle(), useOrderHistory(), useT(), OrderStatusBadge()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (5): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (3): handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 11 - "Community 11"
Cohesion: 0.21
Nodes (5): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 13 - "Community 13"
Cohesion: 0.32
Nodes (4): perDoc(), formatRate(), PackList(), PlanCard()

### Community 14 - "Community 14"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 8` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 18`, `Community 21`, `Community 22`, `Community 23`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 40`, `Community 41`?**
  _High betweenness centrality (0.464) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 3` to `Community 2`, `Community 4`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 6` to `Community 2`, `Community 3`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useT()` (e.g. with `FormActions()` and `LanguageToggle()`) actually correct?**
  _`useT()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `parseNum()` (e.g. with `buildGroupedRow()` and `buildInvoicePayload()`) actually correct?**
  _`parseNum()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._