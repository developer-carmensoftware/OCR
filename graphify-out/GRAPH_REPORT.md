# Graph Report - OCR  (2026-07-13)

## Corpus Check
- 200 files · ~128,312 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 754 nodes · 1299 edges · 95 communities (86 shown, 9 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 187 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d9eafde`
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
- [[_COMMUNITY_Community 13|Community 13]]
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 93 edges
2. `t()` - 51 edges
3. `parseNum()` - 22 edges
4. `unwrapDetail()` - 21 edges
5. `showToast()` - 16 edges
6. `round2()` - 14 edges
7. `useAuth()` - 13 edges
8. `formatThb()` - 13 edges
9. `appKey()` - 13 edges
10. `buildQs()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `MetricChart()` --calls--> `useT()`  [INFERRED]
  components/admin/MetricChart.tsx → i18n/LanguageContext.tsx
- `getNavSections()` --calls--> `t()`  [INFERRED]
  pages/admin/AdminLayout.tsx → components/admin/VoidReasonModal.tsx
- `getPacks()` --calls--> `t()`  [INFERRED]
  pages/admin/CreditsPage.tsx → components/admin/VoidReasonModal.tsx
- `getCols()` --calls--> `t()`  [INFERRED]
  pages/admin/CreditsPage.tsx → components/admin/VoidReasonModal.tsx
- `getTabs()` --calls--> `t()`  [INFERRED]
  pages/admin/QuotaModulesPage.tsx → components/admin/VoidReasonModal.tsx

## Communities (95 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (38): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), getPaymentInfo(), OpenOrderError, uploadSlip() (+30 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), fetchTimeout(), getStoredToken(), resolveUrl() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (30): profileKey(), profileLabel(), adjustField(), reconcileRows(), repairDocFigure(), header(), masterReconcile(), runAdjust() (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (31): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), getCols() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (21): paymentDate(), addDays(), buildInvoicePayload(), useAPSubmission(), fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError() (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (14): _fetchExtractWithRetry(), mockSuccess(), withExtractedData(), useAPExtraction(), getAPVendorMapping(), getFilePreview(), checkFilesSize(), imagesToPdf() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (19): handleRevoke(), load(), adminLogout(), adminMe(), buildQs(), clearAdminToken(), fetchErrorBreakdown(), fetchJobs() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (10): timeAgo(), timeAgo(), act(), withName(), cancelOrder(), fetchAdminOrderDocuments(), getOrderSlipUrl(), holdOrder() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (6): useAPInvoice(), useAPVendor(), FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (13): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (5): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange()

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (8): AdminLayout(), getNavSections(), AdminLogin(), handleSubmit(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (5): extractFromFile(), mockExtract(), withExtractedData(), showToast(), withExtractedData()

### Community 13 - "Community 13"
Cohesion: 0.2
Nodes (8): getAccountingConfig(), diffCorrections(), logCorrections(), parseJvhDate(), getJvhDate(), makeProps(), getJvhDate(), makeProps()

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (9): getTabs(), handleReset(), handleSaveLimit(), handleToggleModule(), load(), fetchQuotaOverview(), resetQuotaUsage(), toggleTenantModule() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.27
Nodes (12): getCols(), getPacks(), handleAdjust(), handleTopup(), refresh(), doAdjust(), doTopup(), load() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.21
Nodes (6): load(), loadDetail(), metricLabel(), toggle(), fetchTenantDetail(), fetchTenants()

### Community 18 - "Community 18"
Cohesion: 0.26
Nodes (7): readFromLocalStorage(), appKey(), useBankConfig(), useMapping(), useMappingData(), useMappingSuggestions(), usePaymentTypes()

### Community 19 - "Community 19"
Cohesion: 0.27
Nodes (9): getEdit(), ruleKey(), save(), setEdit(), getAPFields(), getAPVendorFieldRules(), saveAccountingConfig(), saveAPVendorFieldRule() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (6): codeToDisplayName(), codeToSource(), getBankInfo(), getGLSourceCode(), isApiShape(), normalizeConfigShape()

### Community 21 - "Community 21"
Cohesion: 0.28
Nodes (5): doSync(), saveEdit(), listArProfiles(), syncArProfiles(), updateArProfile()

### Community 22 - "Community 22"
Cohesion: 0.36
Nodes (7): getPdfInfo(), useFileUpload(), useOcrExtraction(), useOcrSubmission(), getPdfInfoWithRetry(), useOcrWizard(), useModal()

### Community 23 - "Community 23"
Cohesion: 0.44
Nodes (7): useOrderActions(), withName(), approveOrder(), holdBatch(), rejectOrder(), unwrapDetail(), updateOrderNote()

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 25 - "Community 25"
Cohesion: 0.36
Nodes (4): handleResolve(), load(), fetchAlerts(), resolveAlert()

### Community 27 - "Community 27"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

### Community 30 - "Community 30"
Cohesion: 0.8
Nodes (4): detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords(), _persistOcrLocalStorage()

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 8` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 21`, `Community 23`, `Community 25`, `Community 31`, `Community 36`, `Community 37`, `Community 38`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 60`, `Community 61`, `Community 62`, `Community 63`, `Community 64`?**
  _High betweenness centrality (0.498) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 12` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 8`, `Community 13`, `Community 22`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 18` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 12`, `Community 13`, `Community 20`, `Community 22`, `Community 30`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `FormActions()`) actually correct?**
  _`useT()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._