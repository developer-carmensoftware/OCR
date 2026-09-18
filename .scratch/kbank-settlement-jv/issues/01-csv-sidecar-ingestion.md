# 01: CSV sidecar ingestion

**What to build:** `TAX_SUMMARY_BY_TAX_ID_CSV` attachments inside a KBank settlement zip are
parsed as data feeding the AR reconciliation pipeline, without ever becoming a tracked document
themselves — no ledger row, no credit charged, no LLM/vision call, not passed through the
document trust-boundary allowlist.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A `.csv` member inside a message's zip (or a bare `.csv` attachment) is captured by
      `email_imap.py`'s attachment/zip-expansion logic as a distinct "sidecar" bucket, separate
      from the document list `match_rules` operates on. The document allowlist (`ALLOWED_EXTENSIONS`)
      is not widened.
- [ ] A new parser (e.g. `services/kbank_tax_summary.py`) turns the CSV bytes into
      `{merchant_id: {tax_id, tax_invoice_no, fee, vat, net, wht}}`, keyed by merchant ID after
      stripping the `'` prefix and trailing padding the bank exports, and skipping the `TOTAL`
      row. Stdlib `csv.DictReader` only — no new dependency.
- [ ] `_process_message` in `email_ingest_service.py` parses each message's sidecar CSV(s) once
      and makes the resulting map available to per-attachment processing.
- [ ] A CSV attachment never creates an `email_documents` row, is never charged via
      `consume_document`, and never reaches `match_rules` or an LLM/vision call.
- [ ] Unit test: the parser against the real two-merchant-one-TIN CSV shape (`451005282039001`
      and its `-VCN` sibling, both under TIN `0835553001610`) produces two entries and skips
      `TOTAL`.
- [ ] Ingest test: a settlement zip containing a CSV produces zero ledger rows for the CSV
      member.
- [ ] The CSV sidecar honors the same declared-size check `_unzip` already applies to other
      members (the zip-bomb guard).
- [ ] Changelog entry added in the same commit (CI's `changelog-check` blocks a PR without one).
