# Retention proposal — what we keep, for how long, and what needs a decision

**Status: proposal for legal / PDPA review. Nothing here is implemented.** It comes out of the 2026-11 SQL pass
([`SQL_PERFORMANCE_AUDIT.md`](SQL_PERFORMANCE_AUDIT.md) §7), which looked at every table for growth that nothing bounds.

## สรุป (Thai summary)

ระบบมีนโยบายลบ/ล้างข้อมูลอยู่แล้วสำหรับตารางส่วนใหญ่ (ตารางด้านล่าง "ที่มีอยู่แล้ว") ที่ยังไม่มีกำหนดมีสามเรื่อง และทั้งสามเป็นเรื่องที่
ฝ่ายกฎหมาย/PDPA ควรตัดสิน ไม่ใช่เรื่องที่ทีมพัฒนาเดาตัวเลขเอง:

1. **ภาพหน้าจอในรายงานปัญหา (`bug_reports.screenshot_b64`)**: เก็บภาพได้ถึง ~1 MB ต่อรายงาน เข้ารหัสไว้ แต่ภาพหนึ่งอาจเห็นเอกสารของลูกค้าทั้งใบ และไม่มีกำหนดลบ
2. **ค่าที่ผู้ใช้แก้ไขหลัง OCR (`correction_feedback.original_value / corrected_value`)**: เป็นค่าที่พิมพ์อยู่บนเอกสาร (รหัสร้านค้า จำนวนเงิน ชื่อ) เข้ารหัสไว้ แต่ระบบนำไปใช้แค่นับจำนวนแถวต่อชื่อฟิลด์ ไม่ได้ใช้ตัวค่าเอง
3. **ข้อความอิสระในรายงานปัญหา (`bug_reports.description`)**: ผู้ใช้พิมพ์เอง อาจมีข้อมูลส่วนบุคคลปนอยู่

ข้อเสนอของทีมพัฒนาอยู่ในคอลัมน์ "ข้อเสนอ" ทุกข้อมีสถานะ **ต้องตัดสินใจ** ตัวเลขจำนวนวันเป็นค่าตั้งต้นที่เสนอ ไม่ใช่ข้อกำหนดทางกฎหมาย

## What exists today (so the gaps below are read against it)

| Data | Rule | Where |
|---|---|---|
| `email_documents` | skipped rows deleted at 90 days; everything else scrubbed at 90 days (filename, error text, payload), deleted at 2 years; `pending_review` never touched (capped at 50 per BU) | `20260923000000_email_documents_retention.sql` |
| filenames and error text in `ocr_tasks`, `ap_invoices`, `credit_ledger.ref` | blanked after 12 months; counts and amounts stay | `fn_scrub_old_filenames` (`20261030000200`) |
| `ocr_sessions` | credential scrubbed after 8 hours (the JWT lifetime), row deleted after 90 days | `fn_purge_inactive_sessions` |
| `llm_usage_logs`, `performance_logs`, `outbound_call_logs` | monthly partitions dropped after 12 months | `20260615000001_partition_log_tables.sql` |
| `audit_logs` | partitions dropped after 24 months | same |
| `user_notifications` | deleted after 30 days | `fn_hold_expired_orders` |
| resolved `anomaly_alerts` | deleted after 90 days | `20260708170000` |
| `consent_logs` | **never**, by design: append-only legal evidence (PDPA s.19) | `ConsentLog` model |

## Gaps that need a decision

Sizes and rows/day come from `backend/db/queries.sql` item 18 on production; **they are not filled in yet** (the numbers are being collected).
Until then each row says what the code allows, not how big it is.

| # | Data | What it holds | Today | Options | Proposed default | Decision |
|---|---|---|---|---|---|---|
| 1 | `bug_reports.screenshot_b64` | A screenshot of the app as the user saw it, up to 1 MB (the frontend caps it), encrypted at rest. It can show a whole customer document. | kept for ever | a) keep · b) null it N days after the report is closed · c) null it N days after creation, closed or not | **b)** N = 90 after `status` leaves `open`; and 180 days after creation for a report nobody closed. The description, category and status stay. | **needed** |
| 2 | `correction_feedback.original_value` / `corrected_value` | What was printed and what the user made it: a merchant ID, an amount, a name. Encrypted. The hints only count rows per `field_name`. | kept for ever | a) keep · b) null both values after N days · c) delete the rows after N | **b)** N = 90. Keep `field_name`, `bank_code`, `doc_no` and the timestamps, which are all the error-rate count reads. | **needed** |
| 3 | `bug_reports.description` | Free text the user typed. May contain personal data. | kept for ever | a) keep · b) blank after N months · c) keep, but only for closed reports until N | **a)** for now; revisit with #1. It is what support needs to recognise a repeat. | **needed** (lower priority) |
| 4 | `pms_events` | `payload` is the 4-field hook Carmen sends (`InterfaceType`, `InterfaceName`, `DocType`, `DocDate`): no personal data. `review_payload` (the whole extraction) is already cleared when a day reaches a terminal status (`services/pms/process.py`, `review.py`). | rows kept for ever | a) keep · b) delete rows after N | **a)** nothing sensitive is left to protect; one row per BU per PMS per day. Revisit only if the table grows. | low |
| 5 | `job_runs` | Cron run history (name, status, counts). No personal data. | purged at 90 days **inside** `fn_purge_email_documents`, so if that function fails the table is never purged | give it its own job | **engineering will do this** under the existing 90 days; no legal decision. | none |
| 6 | `consent_logs` | Who consented to AI processing, when, to which version. | never purged, by design | confirm | **keep**, as designed. | confirm only |

## How a decision becomes code

For each item chosen, engineering writes one cron function (the shape of `fn_purge_email_documents`: a batched UPDATE that nulls the column,
`updated_at = updated_at` so the row's other clocks do not move), a pgTAP test that proves the column is nulled and the row kept, and a changelog
line saying the period. Nothing is deleted before the first run is shown on a copy. Backups are not covered by this table: they follow the
provider's own schedule, which should be stated next to whichever periods are chosen.

## Not in scope

Consent wording, the cross-border statement, subject-access and erasure requests (a per-person process, not a retention period), and the
provider's backup retention. These belong in `SECURITY_PDPA_CHECKLIST.md` and `Security_Trust_Overview.md`.
