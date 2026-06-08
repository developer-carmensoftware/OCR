# Graph Report - .  (2026-06-08)

## Corpus Check
- 29 files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 393 nodes · 534 edges · 69 communities (65 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Credit Balance & Admin|Credit Balance & Admin]]
- [[_COMMUNITY_AP Invoice Grouping|AP Invoice Grouping]]
- [[_COMMUNITY_AP Extraction & API|AP Extraction & API]]
- [[_COMMUNITY_AP Submission & Carmen|AP Submission & Carmen]]
- [[_COMMUNITY_Auth & Session|Auth & Session]]
- [[_COMMUNITY_Config & Mapping|Config & Mapping]]
- [[_COMMUNITY_Inline Edit Controls|Inline Edit Controls]]
- [[_COMMUNITY_Bank Detection|Bank Detection]]
- [[_COMMUNITY_GL Mapping Suggestions|GL Mapping Suggestions]]
- [[_COMMUNITY_Consent & Auth Gate|Consent & Auth Gate]]
- [[_COMMUNITY_Page Shell & Navigation|Page Shell & Navigation]]
- [[_COMMUNITY_Admin Login & Routes|Admin Login & Routes]]
- [[_COMMUNITY_AP Field Mapping Table|AP Field Mapping Table]]
- [[_COMMUNITY_File Upload Handler|File Upload Handler]]
- [[_COMMUNITY_Dark Mode|Dark Mode]]
- [[_COMMUNITY_Numeric Input|Numeric Input]]

## God Nodes (most connected - your core abstractions)
1. `parseNum()` - 13 edges
2. `showToast()` - 11 edges
3. `buildQs()` - 11 edges
4. `useAPValidation()` - 9 edges
5. `fmt()` - 9 edges
6. `effectiveTaxProfile()` - 8 edges
7. `normalizeYearToCE()` - 8 edges
8. `getCarmenUrl()` - 8 edges
9. `useAuth()` - 7 edges
10. `round2()` - 7 edges

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

## Communities (69 total, 4 thin omitted)

### Community 0 - "Credit Balance & Admin"
Cohesion: 0.06
Nodes (29): handleResolve(), load(), handleAdjust(), handleTopup(), refresh(), handleRevoke(), load(), adjustCredits() (+21 more)

### Community 1 - "AP Invoice Grouping"
Cohesion: 0.1
Nodes (23): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), reconcileRows(), header(), masterReconcile() (+15 more)

### Community 2 - "AP Extraction & API"
Cohesion: 0.07
Nodes (16): fetchTimeout(), getAPVendorMapping(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), useOcrExtraction(), useOcrSubmission() (+8 more)

### Community 3 - "AP Submission & Carmen"
Cohesion: 0.1
Nodes (16): addDays(), buildInvoicePayload(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), fetchTaxProfiles(), _parseCarmenHttpError(), submitAPInvoiceToCarmen() (+8 more)

### Community 4 - "Auth & Session"
Cohesion: 0.14
Nodes (18): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+10 more)

### Community 5 - "Config & Mapping"
Cohesion: 0.17
Nodes (6): getAccountingConfig(), diffCorrections(), logCorrections(), parseJvhDate(), getJvhDate(), makeProps()

### Community 6 - "Inline Edit Controls"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 7 - "Bank Detection"
Cohesion: 0.29
Nodes (7): detectBankFromCompanyName(), detectBankFromExtracted(), codeToDisplayName(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape()

### Community 8 - "GL Mapping Suggestions"
Cohesion: 0.27
Nodes (7): suggestMapping(), suggestPaymentTypes(), useBankConfig(), useMapping(), useMappingData(), useMappingSuggestions(), usePaymentTypes()

### Community 9 - "Consent & Auth Gate"
Cohesion: 0.24
Nodes (7): ConsentGate(), AdminAuthProvider(), consentKey(), readConsent(), useUserConsent(), getRoute(), onHashChange()

### Community 12 - "Admin Login & Routes"
Cohesion: 0.32
Nodes (4): AdminLogin(), AdminProtectedRoute(), adminLogin(), useAdminAuth()

### Community 14 - "File Upload Handler"
Cohesion: 0.47
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fetchTimeout()` connect `AP Extraction & API` to `Auth & Session`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Why does `createApiClient()` connect `Auth & Session` to `Credit Balance & Admin`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._
- **Why does `showToast()` connect `AP Extraction & API` to `AP Invoice Grouping`, `AP Submission & Carmen`, `Config & Mapping`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `parseNum()` (e.g. with `buildInvoicePayload()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `useAPValidation()` (e.g. with `getAvailableFields()` and `useAPInvoice()`) actually correct?**
  _`useAPValidation()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Credit Balance & Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `AP Invoice Grouping` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._