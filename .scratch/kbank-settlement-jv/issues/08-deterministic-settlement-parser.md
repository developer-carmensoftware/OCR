# 08: Deterministic KBANK settlement parser (drop the LLM call)

**What to build:** For the one layout we've now proven has a complete text layer, read it
directly instead of paying for a vision call — with the vision call kept as the fallback for
anything that doesn't match.

**Blocked by:** 03, 04, 05, 06, 07 — all of Commit 1, shipped and verified in production.
Deliberately sequenced last (not parallelized): if the JV shape and the extraction engine change
at once and a figure comes out wrong, there is no way to tell which half caused it.

**Status:** ready-for-agent

- [ ] New `services/kbank_settlement_text.py`: `parse(pdf_bytes) -> ExtractedCreditCardData | None`,
      using PyMuPDF `get_text("words")` bucketed by vertical position — not by line/content-stream
      order, which interleaves the header row after its data and the net amount after a
      separator.
- [ ] Requires `REPORT NO. KB1P554V2` to be present; returns `None` on any shape mismatch
      (scanned copy, different report format, anything unexpected) rather than guessing.
- [ ] Hooked into `ocr_service.extract_stateless` ahead of the vision call, scoped to
      `doc_type == AR_RECONCILE and bank_code == "KBANK"` only. A `None` result falls through to
      the existing vision path unchanged.
- [ ] Charging is unaffected — `consume_document` already runs per file, before extraction,
      regardless of which extraction path is used.
- [ ] Test: the parser run against the real settlement report reproduces all 7 payment-type rows,
      the three anchor totals, and the tax invoice number `210726E00035291` — synthesize a
      scrubbed fixture (no real merchant name/ID/account number) for the committed test, not the
      customer's actual file.
- [ ] Changelog entry in the same commit.
