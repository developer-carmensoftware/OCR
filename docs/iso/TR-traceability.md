---
title: Requirements → Design → Code → Test (AI JV Automation timeline)
iso-wp: TR
iso-topic: Traceability_AI_JV_Automation
Document Version: Version 0.3 (Traceability Record)
ขอบเขต: ข้อกำหนดทุกข้อใน RS-01 ถึง RS-08
Source of truth: repo developer-carmensoftware/OCR @ 2be6d7c9 (02/11/2026) · แถว PMS ตามโค้ด ณ 93df1c59 + branch feat/pms-sweep-opens-every-pms (12/11/2026)
Date: 12 November 2026
---

## Document Revision History

| Version | Date | Author | Description of Changes | Approved By |
|---|---|---|---|---|
| 0.1 | 02/11/2026 | Dev Team | จัดทำฉบับแรก — สอบกลับข้อกำหนดของ RS-01 ถึง RS-08 ไปยัง FRD, โค้ด, test อัตโนมัติ และ test case | |
| 0.2 | 10/11/2026 | Dev Team | แถว PMS ตาม RS-07 v0.2 และ FRD-11 v1.4 (decision-log #52–#54): PMS-F05, F06, F08, F13, I01, Q04 แก้ และเพิ่ม PMS-F14 | |
| 0.3 | 12/11/2026 | Dev Team | แถว PMS-F14 ตาม RS-07 v0.3 และ FRD-11 v1.5 (decision-log #55): โค้ดเพิ่ม `services/pms/carmen_config.py` และเทสต์ `test_pms_carmen_config.py` | |

<!-- pagebreak -->

# 1. วิธีอ่านเอกสารนี้

ข้อกำหนดแต่ละข้อใน Requirements Specification (RS-01 ถึง RS-08) มีหนึ่งแถว และแถวนั้นชี้ไปยัง 4 ที่:

- **อ้างอิง FRD:** หัวข้อในเอกสารออกแบบ (Software Design) ที่อธิบายวิธีทำ
- **โค้ดหลัก:** ไฟล์ที่ทำข้อกำหนดนั้น (path ใต้ `backend/app/` หรือ `frontend/src/`)
- **test อัตโนมัติ:** ไฟล์ test ที่ทวนสอบ (backend ใต้ `backend/tests/`, frontend อยู่ข้างไฟล์ที่ทดสอบ, ฐานข้อมูลใต้ `supabase/tests/`)
- **test case:** รหัสใน §13 ของ FRD สำหรับการทดสอบด้วยคน (QA)

ทุกชื่อไฟล์ในตารางถูกตรวจแล้วว่ามีอยู่จริงในโค้ด (`scripts/docs/build_frd.cjs --check`) และทุกรหัส test case ถูกตรวจแล้วว่ามีอยู่ใน §13 ของ FRD นั้น แต่ไม่ได้ตรวจว่า test แต่ละไฟล์ครอบคลุมข้อกำหนดครบทุกกรณี ข้อกำหนดที่ทวนสอบโดย "ตรวจทาน" (ไม่ใช่ "ทดสอบ") ไม่มี test โดยเจตนา และขีด (—) หมายถึงไม่มีรายการในช่องนั้น

## 1.1 สรุปความครอบคลุม

<!-- widths: 34,16,18,16,16 -->
| Requirements Specification | ข้อกำหนด | มี test อัตโนมัติ | มี test case | ตรวจทานเท่านั้น |
|---|---|---|---|---|
| RS-01 AI JV Automation – Bank | 26 | 23 | 17 | 2 |
| RS-02 AI AP Invoice Automation | 24 | 19 | 16 | 3 |
| RS-03 AI – Input Tax Reconciliation | 21 | 20 | 19 | 1 |
| RS-04 CR – Payment Gateway | 16 | 15 | 12 | 1 |
| RS-05 Subscription and License Management | 36 | 32 | 30 | 2 |
| RS-06 Email Automation – AI JV | 27 | 26 | 21 | 1 |
| RS-07 PMS Interface Automation | 24 | 22 | 18 | 2 |
| RS-08 CR – AI Transaction Review | 24 | 22 | 17 | 2 |
| **รวม** | **198** | **179** | **150** | **14** |

**ช่องว่างที่เห็น:** ข้อกำหนดที่ต้องทดสอบแต่ไม่มี test อัตโนมัติมี 5 ข้อ:

- การล้างชื่อไฟล์หลัง 12 เดือน (BANK-C02, AP-C02, SUB-C03) ยังไม่มี test ของ `fn_scrub_old_filenames` — ต้องตรวจด้วยคนบนฐานข้อมูลทดสอบ
- งานพักออเดอร์หมดอายุ (SUB-F18) และการไม่เก็บไฟล์ของ AP (AP-C01) มีแต่ test case ของ QA

# 2. RS-01 AI JV Automation – Bank

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| BANK-F01 | FRD-01 §2.1 | `routers/credit_card/ocr.py`, `services/shared/file.py` | `test_ocr_router.py`, `test_image_processing.py`, `useFileUpload.test.ts` | TC-UPL-01–04 |
| BANK-F02 | FRD-01 §8.4 | `utils/pdf_utils.py`, `services/shared/module_gate.py` | `test_pdf_utils.py`, `test_module_gate.py` | TC-UPL-05, 06 |
| BANK-F03 | FRD-01 §8.4 | `services/shared/credits.py` | `test_credit_service.py`, `test_ocr_router.py` | TC-UPL-07, TC-EXT-02, 03, 05 |
| BANK-F04 | FRD-01 §4 | `services/credit_card/ocr.py`, `llm/prompts/__init__.py` | `test_ocr_service.py`, `test_prompts.py`, `test_postprocess.py`, `test_bank_detect.py` | TC-EXT-01, 04 |
| BANK-F05 | FRD-01 §2.1 | `services/shared/correction.py`, `routers/feedback.py` | `test_correction_service.py`, `test_feedback_api.py` | TC-EXT-06, 07 |
| BANK-F06 | FRD-01 §5 | `services/credit_card/gl_suggestion.py`, `services/credit_card/mapping_history.py` | `test_mapping.py`, `test_gl_suggestion_order.py`, `test_dept_allowed.py`, `test_payment_type_brands.py` | TC-MAP-01–05 |
| BANK-F07 | FRD-01 §4.4 | `services/credit_card/accounting_config.py` | `test_accounting_config_service.py`, `test_config_api.py`, `useBankConfig.test.ts` | TC-MAP-06, 07 |
| BANK-F08 | FRD-01 §8.4 | `features/credit-card/components/AccountingReview.tsx` | `AccountingReview.test.tsx`, `ccJv.test.ts` | TC-PST-01–03 |
| BANK-F09 | FRD-01 §6.2 | `services/credit_card/extraction.py`, `routers/carmen.py` | `test_carmen_proxy.py`, `test_ocr_router.py` | TC-PST-04, 05 |
| BANK-F10 | FRD-01 §8.4 | `services/credit_card/jv.py`, `routers/carmen.py` | `test_cc_jv.py`, `test_carmen_proxy.py`, `ccJv.contract.test.ts` | TC-PST-06, 08 |
| BANK-F11 | FRD-01 §9 | `routers/carmen.py` | `test_cc_input_tax.py` | TC-PST-07 |
| BANK-F12 | FRD-01 §5 | `features/credit-card/hooks/useOcrWizard.ts` | `useOcrWizard.test.ts`, `draft.test.ts` | — |
| BANK-F13 | FRD-01 §2.1 | `services/credit_card/activity.py` | `test_credit_card_activity_api.py` | FRD-12 TC-Q-43 |
| BANK-U01 | FRD-01 §4 | `features/credit-card/pages/Mapping.tsx` | `Mapping.test.tsx`, `useOcrWizard.test.ts` | — |
| BANK-U02 | FRD-01 §10.5 | `i18n/dict/warn.ts` | `ExtractionWarningBanner.test.tsx`, `dict.test.ts` | TC-EXT-08 |
| BANK-I01 | FRD-01 §7 | `routers/carmen.py`, `services/shared/carmen.py` | `test_carmen_proxy.py`, `test_carmen_empty_body.py` | TC-PST-01 |
| BANK-I02 | FRD-01 §7 | `llm/client.py` | `test_llm_client.py` | — |
| BANK-I03 | FRD-01 §10.1 | `routers/auth.py` | `test_auth_router.py`, `test_session.py`, `useCarmenSSO.test.ts` | — |
| BANK-Q01 | FRD-01 §10.1 | `utils/crypto.py`, `models/encrypted_json.py` | `test_security_hardening.py`, `test_encrypted_json.py`, `securityHeaders.test.ts`, `security.test.sql` | TC-SEC-01, 04 |
| BANK-Q02 | FRD-01 §10.1 | `llm/client.py` | `test_llm_client.py` | TC-SEC-02 |
| BANK-Q03 | FRD-01 §10.2 | `routers/credit_card/ocr.py` | `test_rate_limit_service.py` | — |
| BANK-Q04 | FRD-01 §10.3 | `services/shared/audit.py` | `test_audit_service.py`, `test_task_service.py` | — |
| BANK-Q05 | FRD-01 §2.2 | `llm/prompts/__init__.py` | — (ตรวจทาน) | — |
| BANK-C01 | FRD-01 §10.4 | `models/business.py` | `test_ocr_router.py` | TC-SEC-03 |
| BANK-C02 | FRD-01 §10.3 | `20261030000200_scrub_old_filenames.sql` | — | — |
| BANK-C03 | FRD-01 §2.2 | — | — (ตรวจทาน) | — |

# 3. RS-02 AI AP Invoice Automation

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| AP-F01 | FRD-02 §2.1 | `routers/ap_invoice.py`, `utils/pages.py` | `test_ap_invoice_router.py`, `test_pages.py`, `PDFPageSelector.test.tsx` | TC-UPL-01–03, TC-CRD-06 |
| AP-F02 | FRD-02 §8.4 | `utils/pdf_utils.py`, `services/shared/module_gate.py` | `test_pdf_utils.py`, `test_ap_invoice_router.py` | TC-UPL-04, 06 |
| AP-F03 | FRD-02 §8.4 | `utils/pages.py`, `services/shared/credits.py` | `test_pages.py`, `test_ap_invoice_router.py` | TC-CRD-01–05, 07 |
| AP-F04 | FRD-02 §2.1 | `services/ap_invoice/service.py`, `llm/prompts/ap_invoice.py` | `test_ap_invoice_router.py`, `test_prompts.py` | TC-VR-01, 03 |
| AP-F05 | FRD-02 §8.3 | `services/ap_invoice/postprocess.py` | `test_postprocess.py` | TC-PP-01–07 |
| AP-F06 | FRD-02 §5 | `features/ap-invoice/hooks/useAPValidation.ts` | `useAPValidation.test.ts`, `apTax.test.ts` | TC-MAP-03, 04, TC-PP-08, 09 |
| AP-F07 | FRD-02 §5 | `features/ap-invoice/hooks/useAPValidation.ts` | `useAPValidation.test.ts` | TC-MAP-05 |
| AP-F08 | FRD-02 §2.1 | `services/credit_card/accounting_config.py` | `test_accounting_config_service.py`, `useAPInvoice.test.ts` | TC-MAP-01, 02 |
| AP-F09 | FRD-02 §2.1 | `services/ap_invoice/service.py` | `test_ap_invoice_router.py`, `test_suggestion_improvement_benchmark.py` | TC-MAP-06 |
| AP-F10 | FRD-02 §2.1 | `utils/db_helpers.py` | `test_ap_invoice_router.py` | TC-MAP-08, TC-TAX-04 |
| AP-F11 | FRD-02 §9 | `routers/carmen.py` | `useAPSubmission.test.ts`, `test_carmen_proxy.py` | TC-TAX-01–03, TC-MAP-07 |
| AP-F12 | FRD-02 §3 | `services/ap_invoice/postprocess.py` | `test_postprocess.py` | TC-VR-02, 04 |
| AP-F13 | FRD-02 §2.1 | `features/ap-invoice/hooks/useAPInvoice.ts` | `useAPInvoice.test.ts`, `draft.test.ts` | — |
| AP-U01 | FRD-02 §4 | `features/ap-invoice/hooks/useAPInvoice.ts` | `APInvoice.test.tsx` | — |
| AP-I01 | FRD-02 §7 | `routers/carmen.py`, `services/shared/carmen.py` | `test_carmen_proxy.py` | TC-MAP-07 |
| AP-I02 | FRD-02 §7 | `llm/client.py` | `test_llm_client.py` | — |
| AP-Q01 | FRD-02 §10.1 | `services/ap_invoice/service.py` | `test_ap_invoice_router.py` | TC-SEC-01, 02 |
| AP-Q02 | FRD-02 §10.1 | `llm/client.py` | `test_llm_client.py` | TC-SEC-03 |
| AP-Q03 | FRD-02 §10.2 | `routers/ap_invoice.py` | — (ตรวจทาน) | — |
| AP-Q04 | FRD-02 §10.3 | `services/shared/audit.py` | `test_audit_service.py` | — |
| AP-Q05 | FRD-02 §2.2 | `llm/prompts/ap_invoice.py` | — (ตรวจทาน) | — |
| AP-C01 | FRD-02 §10.4 | `models/business.py` | — | TC-SEC-04 |
| AP-C02 | FRD-02 §10.3 | `20261030000200_scrub_old_filenames.sql` | — | — |
| AP-C03 | FRD-02 §2.2 | — | — (ตรวจทาน) | — |

# 4. RS-03 AI – Input Tax Reconciliation

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| ITX-F01 | FRD-09 §10.1 | `services/credit_card/input_tax.py` | `test_cc_input_tax.py`, `InputTaxReconciliation.test.tsx` | TC-ITX-01, 04 |
| ITX-F02 | FRD-09 §1 | `services/credit_card/input_tax.py` | `test_cc_input_tax.py` | TC-ITX-01, 10, 11 |
| ITX-F03 | FRD-09 §3 | `services/credit_card/input_tax.py`, `shared/lib/apTax.ts` | `test_cc_input_tax.py`, `apTax.test.ts` | TC-ITX-04, 06, 12, 13 |
| ITX-F04 | FRD-09 §9 | `services/credit_card/input_tax.py` | `test_cc_input_tax.py` | TC-ITX-05, 10, 12, 31, 36 |
| ITX-F05 | FRD-09 §3 | `routers/carmen.py` | `test_cc_input_tax.py`, `test_cc_input_tax_owed.py` | TC-ITX-22 |
| ITX-F06 | FRD-09 §9 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-ITX-14, 25 |
| ITX-F07 | FRD-09 §2.1 | `routers/carmen.py` | `InputTaxReconciliation.test.tsx` | TC-ITX-01–03 |
| ITX-F08 | FRD-09 §2.1 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py`, `test_email_review_api.py` | TC-ITX-30 |
| ITX-F09 | FRD-09 §2.1 | `services/email_automation/ledger.py` | `test_email_stamp_input_tax.py` | TC-ITX-25, 30 |
| ITX-F10 | FRD-09 §3 | `services/credit_card/input_tax.py`, `routers/credit_card/activity.py` | `test_cc_input_tax.py`, `test_credit_card_activity_api.py`, `QueueRow.test.tsx` | TC-ITX-20, 21, 32, 33 |
| ITX-F11 | FRD-09 §3 | `routers/credit_card/activity.py` | `test_cc_input_tax.py` | TC-ITX-34 |
| ITX-F12 | FRD-09 §2.1 | `services/credit_card/kbank_tax_summary.py` | `test_kbank_tax_summary.py` | TC-ITX-35 |
| ITX-F13 | FRD-09 §2.1 | `routers/credit_card/activity.py` | `draft.test.ts`, `test_cc_input_tax_owed.py` | TC-ITX-23, 24 |
| ITX-U01 | FRD-09 §4 | `features/credit-card/components/QueueRow.tsx` | `QueueRow.test.tsx` | TC-ITX-21, 33, 34 |
| ITX-I01 | FRD-09 §7 | `services/shared/carmen.py` | `test_cc_input_tax.py` | TC-ITX-14 |
| ITX-Q01 | FRD-09 §10.1 | `routers/carmen.py` | `test_cc_input_tax_owed.py` | TC-ITX-22 |
| ITX-Q02 | FRD-09 §10.1 | `services/credit_card/input_tax.py` | `test_cc_input_tax.py`, `InputTaxReconciliation.test.tsx` | — |
| ITX-Q03 | FRD-09 §10.2 | `services/credit_card/input_tax.py` | `test_cc_input_tax.py` | TC-ITX-13 |
| ITX-Q04 | FRD-09 §10.3 | `models/business.py` | `test_cc_input_tax.py` | TC-ITX-34 |
| ITX-C01 | FRD-09 §3 | `services/credit_card/input_tax.py` | `test_cc_input_tax.py` | TC-ITX-32, 33 |
| ITX-C02 | FRD-09 §2.2 | — | — (ตรวจทาน) | — |

# 5. RS-04 CR – AI JV Automation – Payment Gateway

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| PG-F01 | FRD-10 §2.1 | `llm/prompts/__init__.py` | `test_prompts.py`, `test_fee_invoice_clamp.py` | TC-PG-01–05 |
| PG-F02 | FRD-10 §4.1 | `utils/bank_detect.py` | `test_bank_detect.py` | TC-PG-06 |
| PG-F03 | FRD-10 §3 | `services/credit_card/postprocess.py` | `test_postprocess.py`, `test_fee_invoice_clamp.py` | TC-PG-01, 04 |
| PG-F04 | FRD-10 §10.1 | `services/credit_card/postprocess.py` | `test_postprocess.py` | TC-PG-04, 10 |
| PG-F05 | FRD-10 §3 | `services/credit_card/postprocess.py` | `test_postprocess.py` | TC-PG-12 |
| PG-F06 | FRD-10 §3 | `services/credit_card/postprocess.py` | `test_postprocess.py` | TC-PG-11 |
| PG-F07 | FRD-10 §3 | `services/credit_card/postprocess.py` | `test_postprocess.py`, `test_llm_row_clean.py` | TC-PG-02, 22 |
| PG-F08 | FRD-10 §3 | `utils/date_parsing.py` | `test_date_parsing.py` | TC-PG-14, 15 |
| PG-F09 | FRD-10 §3 | `services/credit_card/gl_suggestion.py`, `llm/prompts/mapping.py` | `test_gl_suggestion_order.py`, `test_mapping.py` | TC-PG-21 |
| PG-F10 | FRD-10 §3 | `services/credit_card/jv.py` | `test_cc_jv.py`, `bankTransforms.test.ts` | TC-PG-20 |
| PG-I01 | FRD-10 §12 | `routers/carmen.py` | `test_email_settings_service.py` | — |
| PG-Q01 | FRD-10 §10.1 | `services/credit_card/postprocess.py` | `test_postprocess.py`, `test_cc_jv.py` | TC-PG-20 |
| PG-Q02 | FRD-10 §10.2 | `llm/prompts/__init__.py` | `test_prompts.py` | — |
| PG-Q03 | FRD-10 §3 | `i18n/dict/warn.ts` | `ExtractionWarningBanner.test.tsx` | TC-PG-12 |
| PG-C01 | FRD-10 §10.4 | `routers/credit_card/ocr.py` | `test_ocr_router.py` | — |
| PG-C02 | FRD-10 §2.2 | — | — (ตรวจทาน) | — |

# 6. RS-05 Subscription and License Management

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| SUB-F01 | FRD-04 §2.1 | `services/shared/credits.py` | `test_credit_service.py` | TC-CON-01–04 |
| SUB-F02 | FRD-04 §11.2 | `services/shared/credits.py` | `test_credit_service.py`, `test_ocr_router.py` | TC-CON-05, 06 |
| SUB-F03 | FRD-04 §2.1 | `services/shared/credits.py` | `test_credit_service.py` | TC-REF-01–06 |
| SUB-F04 | FRD-04 §2.1 | `services/shared/credits.py` | `test_credit_service.py` | TC-CYC-01–04 |
| SUB-F05 | FRD-04 §4.3 | `services/shared/credits.py` | `test_credit_service.py`, `test_admin_credits_api.py` | TC-RES-05 |
| SUB-F06 | FRD-04 §2.1 | `services/shared/credits.py` | `test_credit_service.py`, `test_auth_router.py` | TC-GRT-01, 02 |
| SUB-F07 | FRD-04 §3 | `routers/admin/credits.py`, `services/shared/credits.py` | `test_admin_credits_api.py`, `test_credit_service.py` | TC-GRT-03–06 |
| SUB-F08 | FRD-04 §10.2 | `services/shared/credits.py` | `test_credit_service.py` | TC-RES-01, 04 |
| SUB-F09 | FRD-04 §12 | `routers/carmen.py` | `test_ai_status.py` | — |
| SUB-F10 | FRD-05 §2.1 | `routers/credits.py` | `test_credits_api.py`, `PackList.test.tsx` | TC-ORD-05, 10 |
| SUB-F11 | FRD-05 §2.1 | `routers/credits.py` | `test_credits_api.py` | TC-ORD-02–04 |
| SUB-F12 | FRD-05 §10.4 | `utils/tax.py` | `test_billing.py`, `test_billing_ar_math_e2e.py` | TC-ORD-06 |
| SUB-F13 | FRD-05 §2.1 | `services/billing/documents.py` | `test_billing_document_service.py` | TC-DOC-01–06 |
| SUB-F14 | FRD-05 §2.1 | `features/billing/constants.ts` | `constants.test.ts`, `PlanCard.test.tsx`, `test_credits_api.py` | TC-ORD-07–09, TC-GRT-07, 08 |
| SUB-F15 | FRD-05 §2.1 | `routers/credits.py`, `services/billing/slip_storage.py` | `test_credits_api.py`, `test_storage_service.py`, `SlipUpload.test.tsx` | TC-SLP-01–07 |
| SUB-F16 | FRD-05 §2.1 | `services/billing/orders.py` | `test_credit_order_service.py`, `test_admin_credits_api.py` | TC-APR-03–07 |
| SUB-F17 | FRD-05 §11.2 | `services/billing/orders.py` | `test_credit_order_service.py` | TC-APR-01, 02, TC-GRT-09 |
| SUB-F18 | FRD-05 §8.5 | `20260707000001_notify_cron_events.sql` | — | TC-JOB-01, 02 |
| SUB-F19 | FRD-05 §2.1 | `services/billing/ar_posting.py` | `test_billing_ar_math_e2e.py`, `test_admin_credits_api.py` | TC-AR-01–03 |
| SUB-F20 | FRD-05 §2.1 | `services/billing/orders.py` | `test_notifications.py`, `NotificationBell.test.tsx` | — |
| SUB-F21 | FRD-06 §2.1 | `services/shared/module_gate.py` | `test_module_gate.py` | TC-ENT-03, 04 |
| SUB-F22 | FRD-06 §1 | `services/shared/module_gate.py` | `test_module_gate.py` | TC-ENT-01, 02, 05 |
| SUB-F23 | FRD-06 §11.2 | `routers/admin/quotas.py` | `test_admin_tenant_modules.py` | TC-ADM-01–06 |
| SUB-F24 | FRD-06 §9 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-SHR-01–03 |
| SUB-U01 | FRD-05 §4 | `i18n/LanguageContext.tsx` | `dict.test.ts`, `screens.test.tsx` | — |
| SUB-U02 | FRD-05 §8.1 | `features/billing/components/OrderStatusBadge.tsx` | `OrderStatusBadge.test.tsx` | TC-ORD-11 |
| SUB-I01 | FRD-05 §7 | `services/billing/slip_storage.py` | `test_storage_service.py`, `SlipViewer.test.tsx` | TC-SLP-05 |
| SUB-I02 | FRD-05 §7 | `services/billing/ar_posting.py` | `test_billing_ar_math_e2e.py` | TC-AR-03 |
| SUB-Q01 | FRD-04 §10.1 | `services/shared/credits.py` | `test_credit_service.py` | TC-RES-02, 03 |
| SUB-Q02 | FRD-05 §10.1 | `routers/credits.py` | `test_credits_api.py` | TC-SLP-02 |
| SUB-Q03 | FRD-05 §10.2 | `routers/credits.py` | `test_credits_api.py` | TC-ORD-12, TC-DOC-05 |
| SUB-Q04 | FRD-05 §10.3 | `routers/admin/quotas.py` | `test_admin_tenant_modules.py` | TC-ADM-02 |
| SUB-Q05 | FRD-05 §6 | `models/billing.py`, `routers/admin/quotas.py` | `test_admin_principal.py`, `test_encrypted_json.py` | TC-APR-06 |
| SUB-C01 | FRD-05 §2.2 | — | — (ตรวจทาน) | — |
| SUB-C02 | FRD-06 §2.2 | — | — (ตรวจทาน) | — |
| SUB-C03 | FRD-04 §10.3 | `20261030000200_scrub_old_filenames.sql` | — | — |

# 7. RS-06 Email Automation – AI JV

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| EML-F01 | Email §8.2 | `services/email_automation/imap.py`, `services/email_automation/ingest.py` | `test_email_ingest_routing.py` | TC-ING-01, 03–05 |
| EML-F02 | Email §2.1 | `services/email_automation/imap.py` | `test_email_ingest_routing.py` | TC-ING-06 |
| EML-F03 | Email §2.1 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-DEC-01, 03, 05 |
| EML-F04 | Email §9 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-ING-02, 07, TC-DEC-02, 04 |
| EML-F05 | Email §8.2 | `services/email_automation/ingest.py`, `services/email_automation/ledger.py` | `test_email_ingest_routing.py` | TC-BP-01, 02, TC-SET-04 |
| EML-F06 | Email §2.1 | `services/credit_card/gl_suggestion.py` | `test_email_ingest_pipeline.py` | TC-MAP-01, 02 |
| EML-F07 | Email §8.4 | `services/email_automation/pipeline.py` | `test_extracted_tax_ids.py`, `test_email_ingest_pipeline.py` | FRD-12 TC-Q-10 |
| EML-F08 | Email §6.5 | `services/email_automation/ledger.py` | `test_email_ingest_pipeline.py` | TC-DUP-01–03 |
| EML-F09 | Email §11.2 | `services/email_automation/ledger.py` | `test_email_ingest_pipeline.py` | TC-AUT-01–04 |
| EML-F10 | Email §8.4 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-PST-02, 03 |
| EML-F11 | Email §8.4 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-CRD-01 |
| EML-F12 | Email §9 | `services/email_automation/ledger.py` | `test_email_stamp_input_tax.py` | TC-SYNC-01 |
| EML-F13 | Email §8.5 | `services/credit_card/kbank_settlement_text.py`, `services/credit_card/kbank_tax_summary.py` | `test_kbank_settlement_text.py`, `test_kbank_tax_summary.py`, `test_ar_ingest_pipeline.py` | TC-AR-01–06 |
| EML-F14 | Email §12.6 | `services/email_automation/ingest_settings.py`, `features/email-settings/pages/EmailSettings.tsx` | `test_email_settings_service.py`, `EmailSettings.test.tsx`, `useEmailSettings.test.ts` | TC-AUT-02–04 |
| EML-F15 | Email §7 | `services/email_automation/credential.py` | `test_email_automation_router.py` | TC-SET-01–03 |
| EML-F16 | Email §2.1 | `services/email_automation/ingest.py` | `test_email_automation_router.py` | TC-SET-05 |
| EML-F17 | Email §3 | `services/email_automation/ingest.py` | `test_notifications.py` | — |
| EML-I01 | Email §7 | `services/email_automation/imap.py` | `test_email_mailbox_purge_route.py` | TC-ING-06 |
| EML-I02 | Email §7 | `services/email_automation/credential.py` | `test_email_review_api.py` | TC-PST-01 |
| EML-I03 | Email §12.1 | `routers/email_automation/settings_api.py` | `test_email_automation_router.py`, `test_maintenance_job_auth.py` | — |
| EML-Q01 | Email §10.1 | `models/encrypted_json.py`, `utils/crypto.py` | `test_encrypted_json.py`, `test_key_rotation.py`, `test_encryption_backfill_route.py` | TC-SEC-01 |
| EML-Q02 | Email §10.1 | `routers/email_automation/settings_api.py` | `test_security_hardening.py`, `test_rate_limit_service.py` | TC-SEC-02 |
| EML-Q03 | Email §10.2 | `services/email_automation/ingest.py` | — (ตรวจทาน) | — |
| EML-Q04 | Email §10.3 | `services/email_automation/ledger.py` | `test_admin_email_ingest.py` | — |
| EML-C01 | Email §10.4 | `services/email_automation/ledger.py` | `test_email_ingest_pipeline.py` | — |
| EML-C02 | Email §6.3 | `20261030000100_email_mailbox_purge_cron.sql` | `test_email_mailbox_purge_route.py` | — |
| EML-C03 | Email §12.6 | `models/schemas/email_automation.py` | `test_email_settings_service.py` | TC-AUT-01, 03 |

# 8. RS-07 PMS Interface Automation

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| PMS-F01 | FRD-11 §5 | `routers/pms.py` | `test_pms_webhook.py` | TC-PMS-01, 02 |
| PMS-F02 | FRD-11 §5 | `routers/pms.py`, `services/shared/api_keys.py` | `test_pms_webhook.py`, `test_api_keys.py` | TC-PMS-03–06 |
| PMS-F03 | FRD-11 §12 | `routers/pms_carmen.py` | `test_pms_carmen.py` | TC-PMS-07 |
| PMS-F04 | FRD-11 §5 | `routers/pms_carmen.py`, `services/email_automation/credential.py` | `test_pms_carmen.py`, `test_pms_process.py` | TC-PMS-14 |
| PMS-F05 | FRD-11 §8 | `services/pms/process.py`, `services/pms/carmen_config.py`, `services/shared/carmen.py` | `test_pms_process.py`, `test_pms_carmen_config.py` | TC-PMS-10, 11, 15, 18 |
| PMS-F06 | FRD-11 §3 | `services/pms/mapping.py`, `llm/client.py` | `test_pms_mapping.py`, `test_llm_client.py`, `test_pms_process.py` | TC-PMS-12, 13, 20 |
| PMS-F07 | FRD-11 §11.2 | `services/pms/process.py` | `test_pms_process.py` | TC-PMS-10–12 |
| PMS-F08 | FRD-11 §2.1 | `services/pms/process.py` | `test_pms_process.py`, `test_pms_process_run.py` | TC-PMS-14, 19 |
| PMS-F09 | FRD-11 §11.2 | `services/pms/review.py` | `test_pms_review.py`, `test_pms_review_api.py`, `PmsReviewDocument.test.tsx` | TC-PMS-21–24 |
| PMS-F10 | FRD-11 §11.2 | `services/pms/review.py` | `test_pms_review.py` | TC-PMS-25 |
| PMS-F11 | FRD-11 §2.1 | `services/pms/review.py` | `test_pms_review_api.py` | TC-PMS-26 |
| PMS-F12 | FRD-11 §1 | `services/pms/process.py` | `test_pms_process.py` | TC-PMS-21, 27 |
| PMS-F13 | FRD-11 §8.4, §9 | `services/pms/process.py`, `services/pms/review.py` | `test_pms_process.py`, `test_pms_review.py` | TC-PMS-16, 17 |
| PMS-F14 | FRD-11 §8.6 | `services/pms/process.py`, `services/pms/carmen_config.py` | `test_pms_process.py`, `test_pms_carmen_config.py` | — |
| PMS-U01 | FRD-11 §4 | `services/pms/review.py` | `PmsReviewDocument.test.tsx` | TC-PMS-20 |
| PMS-U02 | FRD-11 §2.1 | `services/shared/api_keys.py` | `ApiKeysPage.test.tsx` | — |
| PMS-I01 | FRD-11 §7 | `services/pms/process.py`, `services/shared/carmen.py` | `test_pms_process.py` | TC-PMS-21, 28 |
| PMS-I02 | FRD-11 §7 | `services/pms/carmen_config.py` | `test_pms_carmen_config.py` | TC-PMS-15 |
| PMS-Q01 | FRD-11 §10.1 | `services/shared/api_keys.py` | `test_api_keys.py`, `test_pms_webhook.py` | TC-PMS-03, 04 |
| PMS-Q02 | FRD-11 §10.2 | `services/pms/process.py` | `test_pms_process.py`, `test_pms_review.py` | TC-PMS-02 |
| PMS-Q03 | FRD-11 §10.2 | `services/pms/process.py` | `test_pms_process_run.py` | — |
| PMS-Q04 | FRD-11 §10.3 | `models/pms.py`, `services/pms/mapping.py` | `test_encrypted_json.py`, `test_pms_mapping.py` | — |
| PMS-Q05 | FRD-11 §10.4 | `services/shared/api_keys.py` | `test_api_keys.py` | — |
| PMS-C01 | FRD-11 §1 | — | — (ตรวจทาน) | — |
| PMS-C02 | FRD-11 §10.1 | — | — (ตรวจทาน) | — |

# 9. RS-08 CR – AI Transaction Review

<!-- widths!: 17,12,26,27,18 -->
| รหัส | อ้างอิง FRD | โค้ดหลัก | test อัตโนมัติ | test case |
|---|---|---|---|---|
| ATR-F01 | FRD-12 §2.1 | `services/credit_card/activity.py` | `test_credit_card_activity_api.py` | TC-Q-42, 44 |
| ATR-F02 | FRD-12 §2.1 | `services/credit_card/activity.py` | `test_credit_card_activity_api.py`, `ReviewQueue.test.tsx` | TC-Q-31, 33, 34 |
| ATR-F03 | FRD-12 §11.2 | `services/credit_card/activity.py` | `test_credit_card_activity_api.py` | TC-Q-30 |
| ATR-F04 | FRD-12 §3 | `services/email_automation/ledger.py` | `test_email_ingest_pipeline.py`, `QueueRow.test.tsx` | TC-Q-01–05 |
| ATR-F05 | FRD-12 §3 | `services/email_automation/pipeline.py` | `test_email_ingest_pipeline.py` | TC-Q-10–14 |
| ATR-F06 | FRD-12 §2.1 | `services/email_automation/review.py` | `ReviewDocument.test.tsx` | TC-Q-22 |
| ATR-F07 | FRD-12 §11.2 | `services/email_automation/review.py` | `test_email_review_api.py` | TC-Q-20, 21, 25 |
| ATR-F08 | FRD-12 §2.1 | `services/email_automation/review.py` | `test_email_review_api.py` | TC-Q-23, 24 |
| ATR-F09 | FRD-12 §2.1 | `services/email_automation/review.py` | `test_email_review_api.py` | TC-Q-26, 27 |
| ATR-F10 | FRD-12 §3 | `shared/lib/reviewReasons.ts` | `QueueRow.test.tsx` | — |
| ATR-F11 | FRD-12 §2.1 | `routers/credit_card/activity.py` | `test_cc_input_tax_owed.py`, `QueueRow.test.tsx` | TC-Q-28, 43 |
| ATR-F12 | FRD-12 §4.4 | `services/credit_card/activity.py` | `QueueRow.test.tsx` | — |
| ATR-F13 | FRD-12 §3 | `services/email_automation/ledger.py` | `test_email_ingest_routing.py` | TC-Q-45 |
| ATR-F14 | FRD-12 §3 | `services/email_automation/ingest.py` | `test_notifications.py`, `NotificationBell.test.tsx` | TC-Q-35 |
| ATR-U01 | FRD-12 §4 | `services/credit_card/activity.py` | `ReviewQueue.test.tsx` | TC-Q-33 |
| ATR-U02 | FRD-12 §10.5 | `i18n/dict/review.ts` | `dict.test.ts` | — |
| ATR-I01 | FRD-12 §7 | `services/email_automation/review.py` | `test_email_review_api.py` | TC-Q-21 |
| ATR-Q01 | FRD-12 §10.1 | `services/email_automation/review.py` | `test_email_review_api.py` | TC-Q-40, 41 |
| ATR-Q02 | FRD-12 §10.2 | `routers/email_automation/review.py` | `test_email_review_api.py` | — |
| ATR-Q03 | FRD-12 §10.2 | `models/email_automation.py` | `test_encrypted_json.py` | — |
| ATR-Q04 | FRD-12 §10.3 | `services/credit_card/activity.py` | — (ตรวจทาน) | — |
| ATR-Q05 | FRD-12 §10.4 | `services/email_automation/review.py` | `test_email_review_api.py` | TC-Q-26 |
| ATR-C01 | FRD-12 §1 | `models/email_automation.py` | `test_email_settings_service.py` | TC-Q-01 |
| ATR-C02 | FRD-12 §2.2 | — | — (ตรวจทาน) | — |
