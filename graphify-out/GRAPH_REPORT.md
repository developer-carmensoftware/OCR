# Graph Report - OCR  (2026-06-05)

## Corpus Check
- 132 files · ~61,712 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 375 nodes · 506 edges · 68 communities (64 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d84e12e`
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
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 19|Community 19]]

## God Nodes (most connected - your core abstractions)
1. `parseNum()` - 13 edges
2. `showToast()` - 11 edges
3. `buildQs()` - 11 edges
4. `useAPValidation()` - 9 edges
5. `fmt()` - 9 edges
6. `normalizeYearToCE()` - 8 edges
7. `getCarmenUrl()` - 8 edges
8. `useAuth()` - 7 edges
9. `round2()` - 7 edges
10. `useAdminAuth()` - 6 edges

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

## Communities (68 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (22): handleResolve(), load(), handleRevoke(), load(), adminLogout(), adminMe(), buildQs(), clearAdminToken() (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (16): getAccountingConfig(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), useOcrExtraction() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (22): profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), reconcileRows(), header(), masterReconcile(), sum() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (16): addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (17): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (12): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), getAPVendorMapping(), saveAccountingConfig() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): detectBankFromCompanyName(), detectBankFromExtracted(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape()

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (7): suggestMapping(), suggestPaymentTypes(), useBankConfig(), useMapping(), useMappingData(), useMappingSuggestions(), usePaymentTypes()

### Community 10 - "Community 10"
Cohesion: 0.46
Nodes (7): handleAdjust(), handleTopup(), refresh(), adjustCredits(), fetchCreditBalance(), fetchCreditLedger(), topupCredits()

### Community 11 - "Community 11"
Cohesion: 0.32
Nodes (4): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth()

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (4): AdminAuthProvider(), AuthProvider(), getRoute(), onHashChange()

### Community 13 - "Community 13"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCarmenUrl()` connect `Community 8` to `Community 1`, `Community 4`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 1` to `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `parseNum()` (e.g. with `buildInvoicePayload()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `useAPValidation()` (e.g. with `useAPInvoice()` and `masterReconcile()`) actually correct?**
  _`useAPValidation()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._