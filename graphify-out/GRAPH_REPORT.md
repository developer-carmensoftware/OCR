# Graph Report - OCR  (2026-07-22)

## Corpus Check
- 220 files · ~144,431 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 837 nodes · 1465 edges · 89 communities (77 shown, 12 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 198 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `19e5c42b`
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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 100 edges
2. `t()` - 51 edges
3. `unwrapDetail()` - 27 edges
4. `parseNum()` - 22 edges
5. `appKey()` - 19 edges
6. `showToast()` - 16 edges
7. `buildQs()` - 15 edges
8. `round2()` - 14 edges
9. `useAuth()` - 13 edges
10. `formatThb()` - 13 edges

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

## Communities (89 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (64): handleResolve(), load(), doSync(), saveEdit(), confirmEnable(), endNow(), load(), requestEnable() (+56 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (34): profileKey(), profileLabel(), useAPExtraction(), useAPInvoice(), useAPSubmission(), adjustField(), reconcileRows(), repairDocFigure() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (35): cancelOrder(), createOrder(), detail(), getCompanyProfile(), getOrderDocuments(), OpenOrderError, uploadSlip(), catalogName() (+27 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (29): getAccountingConfig(), diffCorrections(), logCorrections(), suggestMapping(), suggestPaymentTypes(), detectBankFromCompanyName(), detectBankFromExtracted(), matchBankKeywords() (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (22): _fetchExtract(), _fetchExtractWithRetry(), fetchTimeout(), extractFromFile(), getFilePreview(), getPdfInfo(), useFileUpload(), mockExtract() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (33): afterBulkAction(), approveOrders(), holdOrders(), loadList(), onChanged(), postBatch(), postOrders(), refreshCounts() (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (26): exchangeSSOToken(), getUsage(), revokeSession(), clearToken(), createApiClient(), getStoredToken(), resolveUrl(), storeToken() (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (18): pad(), paymentDate(), addDays(), buildInvoicePayload(), handleSelect(), addDays(), buildInvoicePayload(), formatCarmenError() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): getConsentStatus(), postConsent(), listNotifications(), markNotificationsRead(), AppHeader(), ConsentGate(), ProtectedRoute(), computeUsageStats() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (13): classify(), groupByCause(), getCols(), getCols(), getCols(), funnel(), load(), loadDetail() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (10): fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes(), _parseCarmenHttpError(), submitAPInvoiceToCarmen(), submitInputTax(), submitToCarmen(), handleOpenJv() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (14): getEdit(), ruleKey(), save(), setEdit(), mockSuccess(), withExtractedData(), getAPFields(), getAPVendorFieldRules() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (7): AuthProvider(), translate(), LanguageProvider(), getRoute(), onHashChange(), redact(), scrub()

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (4): FormActions(), LanguageToggle(), useT(), OrderStatusBadge()

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (7): getColsCost(), getColsPerf(), t(), handleReExtract(), handleStepClick(), handleConfirm(), handleSlip()

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (8): AdminLayout(), getNavSections(), AdminLogin(), handleSubmit(), AdminProtectedRoute(), adminLogin(), useAdminAuth(), OrderReviewShell()

### Community 17 - "Community 17"
Cohesion: 0.28
Nodes (10): handleConfirmDeactivate(), handleConfirmPasswordReset(), handleCreate(), handleSaveFullName(), handleSaveRoles(), handleToggleActive(), load(), createAdminUser() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (5): isOutside(), notifText(), onDown(), onScroll(), timeAgo()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (3): sanitizeNumericInput(), sanitizeNumericInput(), sanitizeNumericInput()

### Community 21 - "Community 21"
Cohesion: 0.38
Nodes (4): fileToBase64(), handleClose(), handleFileChange(), reset()

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 13` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 12`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 22`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 32`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 43`, `Community 44`, `Community 53`, `Community 54`, `Community 55`, `Community 56`?**
  _High betweenness centrality (0.533) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 4` to `Community 1`, `Community 3`, `Community 6`, `Community 7`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `appKey()` connect `Community 3` to `Community 1`, `Community 4`, `Community 6`, `Community 11`, `Community 14`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useT()` (e.g. with `MetricChart()` and `FormActions()`) actually correct?**
  _`useT()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 50 inferred relationships involving `t()` (e.g. with `saveEdit()` and `doSync()`) actually correct?**
  _`t()` has 50 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parseNum()` (e.g. with `adjustField()` and `buildGroupedRow()`) actually correct?**
  _`parseNum()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `appKey()` (e.g. with `readFromLocalStorage()` and `_persistOcrLocalStorage()`) actually correct?**
  _`appKey()` has 3 INFERRED edges - model-reasoned connections that need verification._