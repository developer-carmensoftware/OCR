# KBANK settlement & review — end-to-end test plan

**Date:** 2026-10-05 · **Branch under test:** `feat/settlement-review-like-fee-invoice`
· **Environment:** dev only (`ycykjisvvrrbgeiirqre`, `dev.carmen4.com`).

> **Run 2026-10-05 (`1791179483`), Carmen dry-run:** B, C, D and the review screen pass. A
> (settings dialog, needs a real Carmen token) and E were not run live. See the
> [report](2026-10-05-kbank-settlement-e2e-report.md), including findings F-1–F-3.

## Goal

Show, with real mail, the real pipeline, the real review screen and dev Carmen, that the
following work end to end:

1. **KBANK rule toggle.** "Detailed Credit Card AR Reconciliation" plus merchant ID decides
   which KBANK file is read:
   - **off:** `E-TAX_INVOICE_CARD_*`;
   - **on:** `SUM_<merchant>`;
   - **either way:** the zip's `TAX_SUMMARY_BY_TAX_ID_CSV_*` is used when present.
2. **No double reading.** KBANK files are never read by another rule, and a skipped file costs
   nothing.
3. **One review table.** A settlement report is reviewed in the same JV table as a fee invoice.
   Its edits reach Carmen: header, accounts, comments, amounts, and the input-tax switch.
4. **Screen = post.** Carmen receives exactly the JV the screen showed. A JV that changed under
   the reviewer is refused, not posted.
5. **Nothing else regressed.** Other banks, the mapping page, and credits and billing behave as
   before.

Unit, contract and component tests already pass (see Layer 1). This plan covers what they
cannot: IMAP, zips, the PDF password, the deterministic parser on the real file, the LLM on the
real E-TAX, Carmen's acceptance, and the screens in a browser.

## Preconditions (P0 — all must be true before any case runs)

| # | Check | How | Current state |
|---|---|---|---|
| P1 | Backend + frontend running from this branch, against dev DB | `uvicorn … --port 8010`, `npm run dev`; `DATABASE_URL` ref = `ycykjisvvrrbgeiirqre` | running ✔ |
| P2 | Mailbox reachable | `IMAP_HOST/USER/FOLDER` set, folder `AR Agent` | set ✔ |
| P3 | BU under test = **`carmen`** (`dev.carmen4.com/carmen`, tag `41645ee4`) | posting token verified (`carmen_token_verified_at`) | ✔ — `carmencloud`'s is not, so it is not used for posting |
| P4 | Real KBANK sample set | `Downloads/451005282039001_Card_20260721/` (E-TAX + SUM + CSV) | present ✔ |
| P5 | **E-TAX PDF password** on the KBANK rule | the E-TAX file is encrypted; no dev rule stores a password | **missing — needed from the business** |
| P6 | Sample's TIN `0835553001610` on `carmen`'s `tax_ids` for the run (restored after) | SQL in harness; otherwise every case checks against a TIN no BU owns | to set |
| P7 | Clean slate for doc `210726E00035291` on `carmen` | `scripts/dev/reset_email_test.py --doc-no 210726E00035291 --apply` (ledger + `credit_cards` + `$OcrDone`) | 9 rows pending on `carmen`; the KBANK ones must be cleared |
| P8 | GL mapping for KBANK on `carmen` | `commission/tax/net` + the 7 Detail keys + the 3 Summary keys (VS/MC/JCB), via the mapping page | check |
| P9 | Credit balance and Carmen JV list before the run | admin `#/admin/credits`; Carmen JV list for source `ACKB` | record |
| P10 | Branch `fix/rule-off-ingest-paused` merged or not | decides the expected reason for B5 (`ingest_paused` vs `no_rule_match`) | decide |

## Layer 1 — automated (must stay green; re-run before and after)

```bash
cd backend && pytest tests                     # exit 0 (≈1186 passed, 88 skipped)
cd frontend && npx vitest run && npx tsc --noEmit && npx eslint src && npm run build
```

These pin the logic: `match_rules` KBANK ownership, the merchant validation, the CSV checks on
both paths, the browser↔server settlement builder (`contracts/cc-jv.contract.json`), the
screen-vs-post guard (`_as_shown`), and the review modal's controls.

## Layer 2 — end to end

**Harness.** Add `scripts/qa/kbank_settlement_e2e.py`, modelled on `email_ingest_e2e.py`:

- **Fixtures:** builds the zips from the sample set, plus the variants below.
- **Delivery:** **APPENDs** each one to `AR Agent` with `Delivered-To: AIAGENT+41645ee4@…`.
- **Rule state:** sets the KBANK rule's toggle, merchant and "Other" rule per case with SQL, and
  restores them in a `finally`.
- **Ingest:** runs `run_ingest()` in-process.
- **Checks:** reads every result back from the DB, never from printed summaries.
- **Gating:** paid cases need `--paid`; posting to Carmen needs `--post`.
- **UI cases:** run in a browser (Playwright, or by hand) from the review queue.

Every fixture filename/subject carries `[QA-<run>]` so teardown finds only its own rows.

**Variants generated from the sample set:**

| Name | What changes |
|---|---|
| `zip-full` | E-TAX + SUM + CSV, as KBANK sends it |
| `zip-no-csv` | E-TAX + SUM |
| `zip-csv-fee-off` | CSV with `fee` changed (582.99 → 590.00) |
| `zip-csv-vat-off` | CSV with `vat` changed (40.81 → 45.00) |
| `sum-other-merchant` | the SUM file renamed `…SUM_999999999999999_…` |
| `sum-renamed` | the SUM file renamed `settlement_july.pdf` (the employee-renamed case) |

### A. Settings screen (browser, opened from Carmen's menu — needs the real Carmen token)

| # | Steps | Expected |
|---|---|---|
| A1 | Open the BBL rule, then the KBANK rule | Toggle only on KBANK; BBL keeps "Filename patterns" |
| A2 | KBANK, toggle **off**, save | Saves with no pattern; row reads "Commission invoice · E-TAX_INVOICE_CARD" |
| A3 | Toggle **on**, leave merchant empty | "Save rule" disabled |
| A4 | Merchant `12-34`, then save through the API (curl) | `422 rules[0].merchant_id invalid` |
| A5 | Merchant `451005282039001`, save, reload | Persisted (digits); row reads "AR reconciliation · SUM_451005282039001"; `GET /settings` returns `merchant_id`, `filename_patterns: []` |
| A6 | Change the bank KBANK → KTC in the dialog | Toggle disappears; saved rule is `fee_invoice` |
| A7 | Mapping page, KBANK, with the toggle off | Settlement card hint names the toggle |

### B. Routing — free cases (no LLM, no credit; assert spend unchanged)

| # | Rule state | Mail | Expected per attachment |
|---|---|---|---|
| B1 | KBANK **on**, merchant 451… | `zip-full` | E-TAX → `skipped/no_rule_match`; SUM → read (see C1); CSV → no ledger row |
| B2 | KBANK on | `sum-other-merchant` | `no_rule_match`, free |
| B3 | KBANK **off** | `zip-full` | SUM → `no_rule_match`; E-TAX → read (see D1) |
| B4 | KBANK on **+ "Other" rule `.pdf`** | `zip-full` | E-TAX still `no_rule_match` (**the double-booking guard**); SUM read once |
| B5 | KBANK rule **inactive** + "Other" `.pdf` | `zip-full` | Both KBANK files skipped (`ingest_paused` if P10 merged, else `no_rule_match`); free |
| B6 | No KBANK rule, "Other" `.pdf` | `zip-full` | SUM → `no_rule_match`; E-TAX → read by "Other" as a fee invoice (unchanged behaviour) |
| B7 | KBANK on | `sum-renamed` | `no_rule_match` (accepted trade-off, decision-log #37) |

**Spend check after B:** `llm_usage_logs`, `ocr_tasks` and `credit_ledger` are unchanged except
for the documents B1/B3/B4/B6 deliberately read.

### C. Settlement report, toggle on (paid: 1 credit each, no LLM — deterministic parser)

| # | Mail / action | Expected |
|---|---|---|
| C1 | `zip-full` | `pending_review`, no flags. Modal shows:<br>• the fee-invoice table, editable;<br>• 7 credit legs (Detail) + commission 582.99 / input tax 40.81 / bank 24,467.20;<br>• Balanced 25,091.00;<br>• input-tax panel 582.99 / 40.81 / 623.80. |
| C2 | In C1's modal: edit one comment, re-map one leg's account, change prefix; Approve | **Mapping:** the rule is saved before the post, and the new key carries `source=settlement_detail` (it shows under Settlement on the mapping page).<br>**Carmen:** JV lines = the screen (accounts, amounts, edited comment, description); the input-tax record is filed (582.99 / 40.81).<br>**Our DB:** ledger `posted` with the JV no.; `credit_cards.submitted_at` set. |
| C3 | Re-send (after reset) → open the review; from another browser, save a different account for one leg; Approve in the first | Refused: "This JV changed since the review screen built it…"; nothing in Carmen; reopen → new account shown → Approve posts |
| C4 | Open a review; gear → mapping tab; switch Credit breakdown to Summary, save; back to the review tab | Modal regroups to VS / MC / JCB without reopening; Approve posts the Summary JV |
| C5 | `zip-no-csv` | Parks with `tin_unverified`; auto-post would not post it |
| C6 | `zip-csv-fee-off` | Parks with warning `csvFeeMismatch` (590.00 vs 582.99) |
| C7 | Delete the mapping for one Detail key, then send | Approve disabled: "Map these payment types before posting: …"; fill in place → Approve posts; the key is saved with its `source` |
| C8 | Edit a credit leg and the bank leg by the same amount; Approve | Carmen JV and input-tax record carry the edited figures (server rebuilt from the edited lines / total row) |
| C9 | Untick "Post the input tax record"; Approve | JV posted, **no** input-tax record |
| C10 | `auto_post` on, `zip-full` | Posts without review; Carmen JV present (restore `auto_post` off) |
| C11 | Re-send the posted zip without reset | `duplicate_document` (parked), no second JV |

### D. Commission tax invoice, toggle off (paid: 1 credit + 1 vision call each; needs P5)

| # | Mail | Expected |
|---|---|---|
| D1 | `zip-full` | E-TAX opened with the rule's password. `foreign_tax_id` receives the CSV TIN. No CSV warning. Parks → fee-invoice review → Approve → Carmen JV + input-tax record. |
| D2 | `zip-csv-vat-off` | Parks with `csvVatMismatch` (45.00 vs the invoice's VAT); no net warning |
| D3 | `zip-no-csv` | Reads and parks/posts as before — no `tin_unverified` |
| D4 | `zip-full` with the password removed from the rule | `wrong_pdf_password`, free |

### E. Regression

| # | Check | Expected |
|---|---|---|
| E1 | `carmen`'s BBL rule (`BBLETAXACQ`) with a real BBL file | Read, reviewed, posted as before |
| E2 | Manual wizard `#/CreditCardOCR/manual`, one fee invoice | Unchanged |
| E3 | Mapping page save for KBANK (Detail/Summary + accounts) | Saves; an open review regroups (C4) |
| E4 | Fee-invoice review modal (any non-KBANK doc) | Same as before, plus the mapping gear in the header (opens a new tab on that bank) |

## Evidence to record per case

- **Ledger:** the `email_documents` row (status, reason_code, flags, bank_code, doc_type).
- **Cost:** `ocr_tasks.charged_docs`; `credit_ledger` and `llm_usage_logs` deltas.
- **Paid cases:** a screenshot of the review modal before Approve.
- **Posted cases:** the Carmen JV number, its lines (screenshot or API read), and the input-tax
  record.
- **Write-up:** `docs/email-automation/qa/<run>-kbank-report.md`, a verdict-first narrative like
  the 2026-09-24 report.

## Exit criteria

- Every A–E case matches its expected result, or has a written, accepted reason.
- Zero KBANK files read by a non-KBANK rule (B4/B5).
- Zero charges for skipped files.
- For every posted case, Carmen's JV equals the screen's. C3 refused, and posted nothing.

## Cost & side effects

- **Credits:** about 15 documents on `carmen` (C ≈ 10 with no LLM; D ≈ 3 with vision).
- **Carmen:** about 8 real JVs and input-tax records in **dev Carmen**. There is no delete API
  from our side, so the JV numbers are listed in the report for Carmen to void.

## Teardown

1. Restore `carmen`'s rules, `tax_ids` and `auto_post` (the harness `finally` does this; then
   verify).
2. Run `reset_email_test.py --doc-no 210726E00035291 --apply` to clear the run's ledger rows and
   flags.
3. Delete or reject leftover `[QA-<run>]` queue rows.
4. Revoke the seeded browser sessions with `seed_browser_session.py --revoke`.
5. Hand the list of dev-Carmen JV numbers to the Carmen team.
