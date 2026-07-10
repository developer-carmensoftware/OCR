# Graph Report - OCR  (2026-07-10)

## Corpus Check
- 195 files · ~126,252 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 741 nodes · 1273 edges · 80 communities (73 shown, 7 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 186 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eef4f2a9`
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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 93 edges
2. `t()` - 51 edges
3. `parseNum()` - 21 edges
4. `unwrapDetail()` - 21 edges
5. `showToast()` - 16 edges
6. `useAuth()` - 13 edges
7. `formatThb()` - 13 edges
8. `appKey()` - 13 edges
9. `buildQs()` - 13 edges
10. `normalizeYearToCE()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [INFERRED]
  components/admin/MetricChart.tsx → i18n/LanguageContext.tsx
- `handleStepClick()` --calls--> `t()`  [INFERRED]
  pages/APInvoice.tsx → components/admin/VoidReasonModal.tsx
- `getNavSections()` --calls--> `t()`  [INFERRED]
  pages/admin/AdminLayout.tsx → components/admin/VoidReasonModal.tsx
- `getPacks()` --calls--> `t()`  [INFERRED]
  pages/admin/CreditsPage.tsx → components/admin/VoidReasonModal.tsx
- `getCols()` --calls--> `t()`  [INFERRED]
  pages/admin/CreditsPage.tsx → components/admin/VoidReasonModal.tsx

## Communities (80 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (63): handleResolve(), load(), doSync(), saveEdit(), afterBulkAction(), approveOrders(), holdOrders(), loadList() (+55 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), fetchTimeout(), getStoredToken(), resolveUrl() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (37): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (26): _fetchExtractWithRetry(), getAccountingConfig(), diffCorrections(), logCorrections(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (29): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), getCols() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (30): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), adjustField(), reconcileRows(), repairDocFigure(), header() (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (20): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (20): getCols(), getPacks(), handleAdjust(), handleTopup(), refresh(), fmtDateTime(), timeAgo(), timeAgo() (+12 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (18): suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), readFromLocalStorage(), _persistOcrLocalStorage(), codeToDisplayName() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (14): getEdit(), ruleKey(), save(), setEdit(), mockSuccess(), withExtractedData(), getAPFields(), getAPVendorFieldRules() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (4): FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (5): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (8): AdminLayout(), getNavSections(), AdminLogin(), handleSubmit(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 14 - "Community 14"
Cohesion: 0.21
Nodes (6): load(), loadDetail(), metricLabel(), toggle(), fetchTenantDetail(), fetchTenants()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 18 - "Community 18"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 10` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 17`, `Community 22`, `Community 23`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`?**
  _High betweenness centrality (0.496) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 3` to `Community 1`, `Community 5`, `Community 6`, `Community 9`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 8` to `Community 1`, `Community 3`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `FormActions()`) actually correct?**
  _`useT()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._