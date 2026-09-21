# 08: Deterministic KBANK settlement parser (drop the LLM call)

**What to build:** For the one layout we've now proven has a complete text layer, read it
directly instead of paying for a vision call — with the vision call kept as the fallback for
anything that doesn't match.

**Blocked by:** 03, 04, 05, 06, 07 — all of Commit 1, shipped and verified in production.
Deliberately sequenced last (not parallelized): if the JV shape and the extraction engine change
at once and a figure comes out wrong, there is no way to tell which half caused it.

**Status:** done — 2026-09-21, on `feat/detailed-cc-ar-reconciliation`, unpushed.

- [x] New `services/kbank_settlement_text.py`: `parse(pdf_bytes) -> ExtractedCreditCardData | None`,
      using PyMuPDF `get_text("words")` bucketed by vertical position — not by line/content-stream
      order, which interleaves the header row after its data and the net amount after a
      separator. Verified against the real sample file (not committed): reproduces `doc_no`,
      `doc_date`, `merchant_id`, `merchant_name`, all 7 payment-type rows and the anchor's four
      totals exactly, and survives `_normalize_ar_settlement` with zero warnings.
- [x] Requires `REPORT NO. KB1P554V2` to be present; returns `None` on any shape mismatch
      (scanned copy, different report format, missing NET AMT/tax invoice number, anything
      unexpected) rather than guessing. Never raises — a broad catch around the whole parse logs
      and returns `None`.
- [x] Hooked into `ocr_service.extract_stateless` ahead of the vision call, scoped to
      `doc_type == AR_RECONCILE and bank_code == "KBANK"` only. A `None` result falls through to
      the existing vision path unchanged. Runs in a thread executor, matching every other
      PyMuPDF call already in that function.
- [x] Charging is unaffected — `consume_document` already runs per file, before extraction,
      regardless of which extraction path is used.
- [x] Test: `test_kbank_settlement_text.py` — a synthetic fixture built in memory (PyMuPDF
      `insert_text` at chosen coordinates, deliberately replicating the two structural quirks
      above: header-after-data insertion order, NET AMT as a separate call sharing the total
      row's y) with the real worked example's own money figures but **scrubbed merchant
      name/ID/account number/tax invoice number** — no customer file committed. Reproduces all 7
      rows + the anchor's four totals; survives the real `_normalize_ar_settlement` with no
      warnings; returns `None` for a version bump, a missing NET AMT, a missing total row, a
      missing tax invoice number, an encrypted PDF, and malformed bytes; confirms a per-terminal
      `MERCHANT ID` row is never mistaken for the `SUMMARY MERCHANT ID` one. `test_ocr_service.py`
      (new) covers the hook itself: a readable settlement skips the vision call entirely, a
      shape mismatch falls through to vision unchanged, and the parser is never even attempted
      outside `doc_type == AR_RECONCILE and bank_code == "KBANK"`.
- [x] Changelog entry in the same commit.
