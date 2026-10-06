# KBANK settlement & reconciliation toggle — end-to-end report

**Run:** `1791179483` · **Date:** 2026-10-05 · **Branch:**
`feat/settlement-review-like-fee-invoice`, with `fix/rule-off-ingest-paused` merged in
(`93327375`) · **Plan:** [`2026-10-05-kbank-settlement-e2e-plan.md`](2026-10-05-kbank-settlement-e2e-plan.md)
· **Harness:** `scripts/qa/kbank_settlement_e2e.py`

## Verdict

**Every functional case passed.** What ran for real:

- the mailbox (fixtures APPENDed with `Delivered-To: AIAGENT+41645ee4`);
- `run_ingest()`, the real KBANK delivery of 21/07/2026, the deterministic settlement parser
  and the vision LLM on the encrypted E-TAX invoice;
- the dev DB, and the review screen in a browser.

Carmen was **dry-run** by decision: `post_gljv` and `post_input_tax` recorded their payloads
and answered `QA-DRY-<n>`. Carmen's reads (accounts, departments, prefixes, tax profiles) were
real.

| Group | What | Result |
|---|---|---|
| B — routing (free) | The toggle chooses the file; KBANK's files are the KBANK rule's alone; nothing charged | **9 / 9** |
| C — settlement (toggle on) | Clean report, edits, stale-screen refusal, Summary, CSV absent and off, unmapped key, edited amounts, input tax declined, auto-post, duplicate | **33 / 33** |
| D — tax invoice (toggle off) | E-TAX opened with the rule's password, CSV TIN and VAT checks, no CSV, wrong password | **11 / 11** functional (the 12th "check" was a harness bug, see H-1) |
| UI — review screen in a browser | Renders as a fee invoice does; a comment edit and Approve post exactly what was shown | **pass** (below) |

Three findings, none caused by this branch: **F-1** matters beyond this test, **F-2** is dev
data, and **F-3** is defence in depth. Details below.

## Conditions of this run

- **BU `carmen`** (`dev.carmen4.com/carmen`). It is the only BU with a verified posting token.
- **Entitlement answered "yes" in the harness process only.** Every subscription row of
  `carmen` is `superseded`, so with no change its mail is held `retry_later` (F-2). The charge
  still came off the real balance.
- **Run-only data, restored by `teardown`:**
  - The sample's TIN `0835553001610` was added to `carmen`'s `tax_ids`.
  - The KBANK rule got the PDF password and merchant `451005282039001`.
  - `auto_post` was off, except in C10.
- **Clean slate.** `carmen`'s three earlier rows for doc `210726E00035291` were deleted before
  the run, as approved.
- **Cost:**
  - 15 credits (3,504 → 3,489).
  - 3 vision calls ($0.0023), one per E-TAX read. The settlement report needs none.
  - 0 Carmen writes.

## Results

### B — routing (free)

| # | Rule state | Sent | Got |
|---|---|---|---|
| B1 | on | E-TAX + CSV | E-TAX `no_rule_match` ✔ |
| B2 | on | SUM of merchant `999…` | `no_rule_match` ✔ |
| B3 | off | SUM + CSV | SUM `no_rule_match` ✔ |
| B4 | on + "Other" `.pdf` | E-TAX + CSV | E-TAX `no_rule_match` ✔ — **"Other" could not claim it** (the double-booking guard, live) |
| B5 | on but switched off + "Other" `.pdf` | E-TAX + SUM + CSV | SUM `ingest_paused`, E-TAX `no_rule_match` ✔ (works with the merged `ingest_paused` change) |
| B6 | no KBANK rule, "Other" `.pdf` | SUM | `no_rule_match` ✔ — never read as a fee invoice |
| B7 | on | SUM renamed `settlement_july.pdf` | `no_rule_match` ✔ (accepted trade-off, decision-log #37) |
| — | — | — | LLM calls 0, documents charged 0 ✔ |

### C — settlement report (toggle on)

| # | Case | Got |
|---|---|---|
| C1 | Clean report + CSV | **Ingest:** E-TAX in the zip skipped; SUM `pending_review` with no flags and no warnings; 1 credit, 0 LLM.<br>**Screen:** 10 legs, Σ 25,091.00 = 25,091.00.<br>**Post:** the dry-run JV lines equal the screen line for line (7 credit legs + 582.99 / 40.81 / 24,467.20); the input-tax record was filed. |
| C2 | Re-map `VS INTER PREM` → `1021009`, edit the Input Tax comment | The new account posts; the edited comment posts; the rule keeps `source=settlement_detail` |
| C3 | Colleague saves a different account after the screen was built | **Refused** ("changed since the review screen built it"); nothing posted |
| C4 | Credit breakdown → Summary | Credit legs `VS`, `MC`, `JCB` |
| C5 | No CSV | `tin_unverified` flag |
| C6 | CSV fee 590.00 vs 582.99 | `csvFeeMismatch` |
| C7 | `JCB PREM` unmapped | `mapping_missing`; approve refused ("Map these payment types…"); posts once mapped |
| C8 | One line and the bank leg each +0.19 | Posted Σ 25,091.19 on both sides |
| C9 | Input tax unticked | JV posted, no input-tax record |
| C10 | `auto_post` on | `posted` without review; JV + input tax |
| C11 | The posted report again | `pending_review / duplicate_document`; nothing posted |

### D — commission tax invoice (toggle off, password `01610`)

| # | Case | Got |
|---|---|---|
| D1 | E-TAX + SUM + CSV | **Ingest:** SUM skipped; E-TAX opened and read (1 credit, 1 vision call); no CSV warning. The one line "บัตรเครดิต/เดบิต" (25,091.00 / 582.99 / 40.81 / 24,467.20) matches the CSV. Parked `mapping_missing`: that payment type has no KBANK rule, and the AI suggestion failed (F-1).<br>**Post:** dry-run JV + input tax. |
| D2 | CSV VAT 45.00 | `csvVatMismatch`, and no net warning ✔ |
| D3 | No CSV | Read and parked as before, **no** `tin_unverified` ✔ |
| D4 | Rule password removed | `wrong_pdf_password`, nothing charged ✔ |

### Review screen in a browser

**Setup.** The app ran on `:8011` with the same dry-run patches (`serve-dry`). Playwright routed
the page's `/api/*` there; the page itself was served by the normal frontend on `:3010`. One
settlement report was parked (`park`).

1. **Opened.** The modal is the fee invoice's own:
   - editable header (doc no., date, prefix `AR`, description `test KBANK`);
   - Dept/Account pickers on all 10 legs;
   - comment inputs, amount inputs;
   - Balanced 25,091.00;
   - "Post the input tax record";
   - the mapping gear beside Close.
2. **Input-tax details.** Tax invoice 210726E00035291 · 21/07/2026, period 07/2026, net 582.99 /
   tax 40.81 / total 623.80.
3. **Edited and approved.** The Input Tax comment was set to "Input Tax 21/07 (UI QA)", then
   **Approve and post** was pressed. The toast read "Posted to Carmen - JV QA-DRY-1", and the
   ledger row went to `posted`, `jv_no` `QA-DRY-1`, reviewed by `browser-test`.
4. **What the dry run captured:**
   - **JV header:** `Prefix AR`, `JvhSource ACKB`, `JvhDate 2026-07-21`, `Description "test KBANK"`.
   - **JV lines:** the 10 legs exactly as shown, including the edited comment.
   - **Input tax:** `InvhTInvNo 210726E00035291`, `TaxProfileCode VAT07`, `BfTaxAmt 582.99`,
     `TaxAmt 40.81`, `TotalAmt 623.80`.

Screenshots: `.playwright-mcp/ui-settlement-review.png`, `ui-settlement-edited.png`,
`ui-settlement-approved.png` (local, not committed).

## Findings

### F-1 — AI GL suggestions fail: the suggestion model is outside the text-provider allowlist (pre-existing)

> **Resolved 2026-10-06.** Suggestions ran on `deepseek/deepseek-v4-flash` until
> 2026-09-30 (`llm_usage_logs`). Then dev's `backend/.env` switched to a Google model, and
> every call 404'd.
>
> - **Dev:** `.env` is back on the pairing decided on 2026-07-13, both lines (model +
>   `fireworks,deepinfra,digitalocean`). It had meanwhile been re-pointed at
>   `google-ai-studio,google-vertex`. Verified with a live call routed through the
>   allowlist.
> - **Prod / defaults:** `render.yaml` and the code default now name the same pairing (they
>   named Google models).
> - **Guard:** `app/config.py` `text_model_unroutable` logs CRITICAL at boot, in every
>   environment, when the model and the allowlist cannot meet, in either direction.
> - **Open:** the live prod values sit in the host's dashboard; they need checking there.

Every text-LLM call in D failed with OpenRouter `404 No allowed providers`:

- `OPENROUTER_SUGGESTION_MODEL=google/gemini-2.5-flash-lite` is served only by `google-vertex`
  and `google-ai-studio`.
- `_provider_prefs("text")` (`backend/app/llm/client.py`) pins every text call to
  `LLM_TEXT_PROVIDER_ALLOWLIST=fireworks,deepinfra,digitalocean`.

The failure is silent, so any document with an unmapped payment type parks with **empty
pickers instead of the AI's answer**. That covers every bank's fee invoice, the wizard's
suggest step, and probably AP suggestions too.

CLAUDE.md describes the allowlist as pinning the *non-Google* suggestion model, so the code and
the configured model disagree. **Check prod's env.** If it pairs a Google suggestion model with
this allowlist, prod has the same failure. Two possible fixes:

- apply the allowlist only to non-Google models;
- or point the suggestion model at one the allowlist serves.

This is a privacy-policy decision, so it was not changed here.

### F-2 — `carmen` (dev) has no active package, so all its mail is held (dev data)

> **Resolved 2026-10-06.** The newest row (`87e3f9ee…`, `sub_growth`, to 2026-10-27) is back
> to `active`, and `is_entitled` is true again.
>
> **Cause.** No app path leaves a tenant with every row `superseded`: approval supersedes and
> inserts in one go, and nothing deletes a subscription. The rows' 1-month-minus-a-day
> windows show `activate_subscription` made them. Their source orders are gone
> (`source_order_id` null, no `carmen` orders since 2026-09-20). The row that superseded the
> last one was therefore removed outside the app, during billing tests around 2026-09-28.

All three `tenant_subscriptions` rows of `carmen` are `superseded`. `is_entitled` is false, so
`run_ingest` returns `retry_later` for every message to tag `41645ee4`. Real (non-harness)
ingestion for `carmen` on dev is therefore paused. Activate a package for it before testing
email automation through the normal poll.

### F-3 — the fee-invoice approve API accepts a blank account (low, defence in depth)

> **Fixed 2026-10-06.** `approve_document` refuses a fee-invoice line that carries an amount
> and has no account, which is the screen's own predicate. The error names the line, and
> nothing reaches Carmen. The document stays `pending_review`. A display-only zero leg still
> passes. Test: `test_approve_refuses_a_line_with_money_and_no_account`.

In D1 the harness sent the rows as built, including the unmapped line with an empty
`AccCode`, and the server posted them (dry-run). The review screen blocks this. The API has
no check of its own, though the settlement path does (`unmapped_payment_types`). Carmen
would refuse at post time (`carmen_rejected`, recoverable), so nothing is lost. A server-side
refusal would still make the API as strict as the screen.

### Note — the tax invoice carries no BU TIN of its own

The E-TAX extraction yields only KBANK's TIN (`0107536000315`). With the toggle off, the
zip's CSV is now what puts the BU's TIN (`0835553001610`) into `foreign_tax_id`. This is the
OFF-mode CSV check this branch added, and D1 shows it working.

### Harness notes

- **H-1.** D1's "flags (informational)" line was written as a check with an impossible
  expectation, so it always failed. It now prints instead.
- **Stray fixtures.** `email_ingest_e2e.py` leaves its oversized P16 fixtures unflagged in the
  folder by design. The harness ignores them when it guards against processing other people's
  mail.

## Not covered by this run

- **A — settings dialog in a browser.** It needs a real Carmen token in the browser, so open it
  from Carmen's menu. The checks are listed in the plan. The component tests
  (`EmailSettings.test.tsx`) cover the same behaviour in jsdom.
- **E — regression on a live non-KBANK document (BBL) and the wizard.** These are covered by
  the full unit and component suites only. Both are green: backend exit 0; frontend
  1023/1023.
- **Real Carmen posting.** Deferred by decision; the dry-run payloads above are what would
  have been sent.

## Teardown

`teardown` restored `carmen`'s rules, `tax_ids`, `owner_emails`, `auto_post` and Credit
breakdown (Detail). It deleted the run's 29 ledger rows and soft-deleted the doc's
`credit_cards` rows. No browser session was left active. The raw per-check results are in
`backend/scratch/kbank_e2e_1791179483_results.json` (local, not committed).

**Re-run:**

```bash
python scripts/qa/kbank_settlement_e2e.py preflight
python scripts/qa/kbank_settlement_e2e.py setup
python scripts/qa/kbank_settlement_e2e.py routing
python scripts/qa/kbank_settlement_e2e.py settlement
KBANK_PDF_PASSWORD=… python scripts/qa/kbank_settlement_e2e.py fee
python scripts/qa/kbank_settlement_e2e.py teardown
```
