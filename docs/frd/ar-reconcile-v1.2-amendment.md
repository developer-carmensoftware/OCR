# Detailed Credit Card AR Reconciliation — FRD v1.2 amendment

Ready to paste into the customer-facing `.docx`. Amends v1.1 §6.1 only; every other section
(§3.1 bank selector, §8 case list, §9 tolerances, the QA matrix outside the two cases noted
below) is unaffected.

---

## §6.1 — Replace in full

> **v1.1 (superseded):** Only `THB AMT` is journalised from the settlement report. The
> commission, its VAT and the net deposit belong to the fee invoice's own JV — the
> settlement report's JV debits a control account, and the fee invoice's JV credits the
> same control account, clearing it. Both documents must be processed for either JV to
> resolve.

> **v1.2 (current):** The settlement report posts one, self-sufficient JV. `Cr.` one line
> per card scheme, read from the report's per-payment-type `THB AMT` column, grouped by
> Detail (each printed type) or Summary (folded to the scheme prefix — `VS`, `MC`, `JCB`).
> `Dr.` three fixed legs — **Credit card commission**, **Input Tax**, **Bank Account** —
> read from the report's own `TOTAL BY MERCHANT ID` row (`COMM AMT`, `VAT AMT`, `NET AMT`),
> against the same GL mapping already configured for the Credit Card wizard's fee-invoice
> flow. The fee invoice (`E-TAX_INVOICE_CARD_*`) is no longer processed for a bank running
> this mode — its filename rule is removed or repointed at the settlement report, and the
> system will not double-book the commission if a rule is left active by mistake.

**Reason for the change:** the settlement report's own page prints every figure the fee
invoice's JV needed — the FRD v1.1 assumption that it did not has since been read from the
report's own text layer and confirmed against a live sample. The fee invoice added a second
credit charge, a second review step, and a PDF password requirement for no additional
information. See decision #28 (`docs/email-automation/06-decision-log.md`) for the full
reasoning and cost accounting.

**Data-dictionary change:** `debit_dept_code` / `debit_account_code` (the v1.1 "clearing
account", §6.1's settings-screen fields) are no longer read by the JV builder and no longer
shown on the settings screen. They remain stored, unused, so the v1.1 shape could be
restored for a customer who needs it without a schema change.

**Second-factor addition (not a §6.1 change, noted here for completeness):** the settlement
report's page prints no tax ID, so it previously had no independent identity check. The
bank's own per-merchant CSV, delivered in the same zip, now supplies one — see the new
§6.1a below.

## §6.1a — New: tax-ID second factor (insert after §6.1)

The settlement report zip includes `TAX_SUMMARY_BY_TAX_ID_CSV_<tax id>_<date>.csv`, one row
per merchant ID under that tax ID. The row matching the settlement report's own merchant ID
supplies the tax ID checked against the BU's registered tax ID (same check already applied
to the fee invoice, unchanged). A settlement report arriving without a matching CSV row is
not rejected, but cannot auto-post — it parks for a human to approve once, the same as any
other unverified document.

## QA matrix — cases affected

| Case | v1.1 | v1.2 |
|---|---|---|
| TC-REC-001 (Detail) | 1 debit (control) + N credit legs | 3 debit legs (commission/tax/net) + N credit legs |
| TC-REC-002 (Summary) | 1 debit (control) + up to 3 credit legs (VS/MC/JCB) | 3 debit legs + up to 3 credit legs |
| TC-REC-005 (template tags) | unaffected | unaffected |
| *(new)* | — | A document whose report total and CSV-reported total disagree parks with a warning naming both figures, rather than posting either. |
| *(new)* | — | A document with no matching CSV row parks as `tin_unverified` and cannot auto-post. |

## Worked example (real data, unchanged from v1.1's sample)

Settlement 21/07/2026, tax invoice `210726E00035291`, Σ THB AMT 25,091.00.

| Line | Amount |
|---|---|
| `Cr.` VS | 15,471.00 |
| `Cr.` MC | 9,320.00 |
| `Cr.` JCB | 300.00 |
| `Dr.` Credit card commission | 582.99 |
| `Dr.` Input Tax | 40.81 |
| `Dr.` Bank Account | 24,467.20 |

Both sides total 25,091.00.
