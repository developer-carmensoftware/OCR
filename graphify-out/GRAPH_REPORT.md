# Graph Report - OCR  (2026-06-11)

## Corpus Check
- 144 files · ~68,198 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 423 nodes · 611 edges · 67 communities (64 shown, 3 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b77e5d7f`
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]

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
- `handleAddInputTax()` --calls--> `normalizeYearToCE()`  [INFERRED]
  components/credit-card/InputTaxReconciliation.tsx → lib/date.ts

## Communities (67 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (29): handleResolve(), load(), handleAdjust(), handleTopup(), refresh(), handleRevoke(), load(), adjustCredits() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (25): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), reconcileRows(), header(), masterReconcile() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (29): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (18): _fetchExtractWithRetry(), fetchTimeout(), getAPVendorMapping(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), useOcrExtraction() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (16): getAccountingConfig(), diffCorrections(), logCorrections(), detectBankFromCompanyName(), detectBankFromExtracted(), readFromLocalStorage(), _persistOcrLocalStorage(), parseJvhDate() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (12): fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (13): addDays(), buildInvoicePayload(), handleSelect(), addDays(), buildInvoicePayload(), formatCarmenError(), parseCarmenDupError(), formatDateToDDMMYYYY() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.27
Nodes (7): suggestMapping(), suggestPaymentTypes(), useBankConfig(), useMapping(), useMappingData(), useMappingSuggestions(), usePaymentTypes()

### Community 10 - "Community 10"
Cohesion: 0.32
Nodes (4): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth()

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `showToast()` connect `Community 3` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **Why does `createApiClient()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 4` to `Community 8`, `Community 1`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `parseNum()` (e.g. with `buildGroupedRow()` and `buildInvoicePayload()`) actually correct?**
  _`parseNum()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `normalizeYearToCE()` (e.g. with `handleAddInputTax()` and `parseJvhDate()`) actually correct?**
  _`normalizeYearToCE()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getCarmenUrl()` (e.g. with `handleOpenJv()` and `getCarmenUri()`) actually correct?**
  _`getCarmenUrl()` has 2 INFERRED edges - model-reasoned connections that need verification._