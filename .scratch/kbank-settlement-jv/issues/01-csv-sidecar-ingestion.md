# 01: CSV sidecar ingestion

**What to build:** `TAX_SUMMARY_BY_TAX_ID_CSV` attachments inside a KBank settlement zip are
parsed as data feeding the AR reconciliation pipeline, without ever becoming a tracked document
themselves — no ledger row, no credit charged, no LLM/vision call, not passed through the
document trust-boundary allowlist.

**Blocked by:** None (can start immediately)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed. Combined
with ticket 04 in the same pass (the sidecar had no consumer otherwise). Full backend
suite: 1366 passed, 0 failed.

- [x] A `.csv` member inside a message's zip (or a bare `.csv` attachment) is captured by
      `email_imap.py`'s attachment/zip-expansion logic as a distinct "sidecar" bucket, separate
      from the document list `match_rules` operates on. The document allowlist (`ALLOWED_EXTENSIONS`)
      is not widened.
- [x] A new parser (`services/kbank_tax_summary.py`) turns the CSV bytes into
      `{merchant_id: {tax_id, tax_invoice_no, fee, vat, net, wht}}`, keyed by merchant ID after
      stripping the `'` prefix and trailing padding the bank exports, and skipping the `TOTAL`
      row. Stdlib `csv.DictReader` only — no new dependency.
- [x] `_process_message` in `email_ingest_service.py` parses each message's sidecar CSV(s) once
      and threads the resulting map through `_process_attachment` → `_run_document` (both take
      `tax_summary: dict | None = None`, so the pipeline's own dozens of existing test call sites
      keep working unchanged).
- [x] A CSV attachment never creates an `email_documents` row, is never charged via
      `consume_document`, and never reaches `match_rules` or an LLM/vision call. Also given its
      own room budget in `_unzip`/`_attachments`, separate from the document cap, so a CSV can
      never crowd out (or be crowded out by) the documents sharing its zip.
- [x] Unit test: the parser against the real two-merchant-one-TIN CSV shape (`451005282039001`
      and its `-VCN` sibling, both under TIN `0835553001610`) produces two entries and skips
      `TOTAL`. `test_kbank_tax_summary.py`.
- [x] Ingest test: a settlement zip containing a CSV produces zero ledger rows for the CSV
      member. `test_a_csv_inside_the_zip_is_a_sidecar_not_a_document`,
      `test_a_bare_csv_attachment_is_also_a_sidecar`,
      `test_sidecars_never_count_against_the_document_cap` in `test_email_ingest_pipeline.py`.
- [x] The CSV sidecar honors the same declared-size check `_unzip` already applies to other
      members (the zip-bomb guard).
- [x] Changelog entry added in the same commit (CI's `changelog-check` blocks a PR without one).
