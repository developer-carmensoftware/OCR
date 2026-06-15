# Graph Report - OCR  (2026-06-12)

## Corpus Check
- 161 files · ~74,535 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 484 nodes · 688 edges · 73 communities (69 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6134972b`
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
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `parseNum()` - 18 edges
2. `appKey()` - 13 edges
3. `showToast()` - 13 edges
4. `normalizeYearToCE()` - 11 edges
5. `getCarmenUrl()` - 11 edges
6. `buildQs()` - 11 edges
7. `fmt()` - 10 edges
8. `useAuth()` - 9 edges
9. `useAPValidation()` - 9 edges
10. `effectiveTaxProfile()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx
- `profileLabel()` --calls--> `effectiveTaxProfile()`  [INFERRED]
  components/ap-invoice/APGroupModal.tsx → lib/apGroup.ts
- `UsageIndicator()` --calls--> `useAuth()`  [INFERRED]
  components/common/UsageIndicator.tsx → contexts/AuthContext.tsx
- `handleOpenJv()` --calls--> `getCarmenUrl()`  [INFERRED]
  components/credit-card/JournalVoucher.tsx → lib/url.ts

## Communities (73 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (29): handleResolve(), load(), handleAdjust(), handleTopup(), refresh(), handleRevoke(), load(), adjustCredits() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (24): _fetchExtractWithRetry(), fetchTimeout(), getAccountingConfig(), getAPVendorMapping(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview() (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (29): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (26): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), reconcileRows(), repairDocFigure(), header(), masterReconcile() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (22): addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (17): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName(), getBankInfo() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (7): catalogName(), perDoc(), formatDate(), formatRate(), formatThb(), PlanCard(), PromptPayQR()

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), listOrders(), OpenOrderError, uploadSlip(), clearPersistedCheckout() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (3): handleOpenJv(), getCarmenUri(), getCarmenUrl()

### Community 9 - "Community 9"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.32
Nodes (4): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth()

### Community 12 - "Community 12"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `showToast()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Why does `createApiClient()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `parseNum()` (e.g. with `buildGroupedRow()` and `buildInvoicePayload()`) actually correct?**
  _`parseNum()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `normalizeYearToCE()` (e.g. with `handleAddInputTax()` and `parseJvhDate()`) actually correct?**
  _`normalizeYearToCE()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getCarmenUrl()` (e.g. with `handleOpenJv()` and `getCarmenUri()`) actually correct?**
  _`getCarmenUrl()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._