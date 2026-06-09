# Graph Report - OCR  (2026-06-09)

## Corpus Check
- 139 files · ~65,816 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 401 nodes · 560 edges · 65 communities (61 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `381702bf`
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
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]

## God Nodes (most connected - your core abstractions)
1. `parseNum()` - 13 edges
2. `showToast()` - 13 edges
3. `appKey()` - 12 edges
4. `buildQs()` - 11 edges
5. `useAuth()` - 9 edges
6. `useAPValidation()` - 9 edges
7. `fmt()` - 9 edges
8. `getCarmenUrl()` - 9 edges
9. `effectiveTaxProfile()` - 8 edges
10. `normalizeYearToCE()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `parseJvhDate()` --calls--> `normalizeYearToCE()`  [INFERRED]
  hooks/credit-card/useOcrSubmission.ts → lib/date.ts
- `AdminProtectedRoute()` --calls--> `useAdminAuth()`  [INFERRED]
  components/admin/AdminProtectedRoute.tsx → contexts/AdminAuthContext.tsx
- `profileLabel()` --calls--> `effectiveTaxProfile()`  [INFERRED]
  components/ap-invoice/APGroupModal.tsx → lib/apGroup.ts
- `effectiveTaxProfile()` --calls--> `profileKey()`  [INFERRED]
  lib/apGroup.ts → components/ap-invoice/APGroupModal.tsx
- `UsageIndicator()` --calls--> `useAuth()`  [INFERRED]
  components/common/UsageIndicator.tsx → contexts/AuthContext.tsx

## Communities (65 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (29): handleResolve(), load(), handleAdjust(), handleTopup(), refresh(), handleRevoke(), load(), adjustCredits() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (28): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (18): useAPExtraction(), fetchTimeout(), getAPVendorMapping(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), useOcrExtraction() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (23): profileKey(), profileLabel(), useAPInvoice(), useAPSubmission(), reconcileRows(), header(), masterReconcile(), sum() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (16): addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (16): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), readFromLocalStorage(), codeToDisplayName(), getBankInfo(), getGLSourceCode() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (6): getAccountingConfig(), diffCorrections(), logCorrections(), parseJvhDate(), getJvhDate(), makeProps()

### Community 10 - "Community 10"
Cohesion: 0.32
Nodes (4): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth()

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `showToast()` connect `Community 2` to `Community 8`, `Community 1`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `createApiClient()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 5` to `Community 8`, `Community 1`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `parseNum()` (e.g. with `buildInvoicePayload()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `useAuth()` (e.g. with `ConsentGate()` and `ProtectedRoute()`) actually correct?**
  _`useAuth()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._