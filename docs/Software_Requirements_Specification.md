# Requirement Specification: Carmen AI — OCR & Import System Integration

**Project:** Carmen AI OCR & Import System (API Integration)
**Date:** 7 July 2026 (v3.0)
**Author:** Intern Team

> ⚠️ **Authoritative as of v3.0 (7 July 2026) only.** This document has not been revised for
> anything shipped since. For current behaviour read [`../CLAUDE.md`](../CLAUDE.md),
> [`email-automation/`](email-automation/), [`Database_Design.md`](Database_Design.md) and
> [`../changelog/`](../changelog/) — where those disagree with this file, they are right.
>
> Known omissions: email ingestion (built and merged); the free-trial → credit merge (`quotas`
> retired, 30-credit `signup_grant`); AP invoice charged **per page** plus `ocr_tasks.charged_docs`;
> `consent_logs`; in-app notifications; the `Page[T]` pagination envelope on every list endpoint;
> and SemVer via the repo-root `VERSION` file.

---

## 0. ประวัติการแก้ไขเอกสาร (Version History)

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| 1.0 | 01 Apr 2026 | Intern Team | Initial Draft (OCR Integration & LLM Analysis) |
| 1.1 | 01 Apr 2026 | Intern Team | Stateless Refactor & React Frontend Parity Migration |
| 1.2 | 02 Apr 2026 | Intern Team | Carmen API Proxy Integration (Account & Department Master Data) |
| 1.3 | 02 Apr 2026 | Intern Team | Separated Sequence Diagrams by individual API endpoints |
| 1.4 | 02 Apr 2026 | Intern Team | Final Polish: Detailed API Specs, JSON Samples, and Non-Functional Requirements |
| 1.5 | 08 Apr 2026 | Intern Team | Major update: AI Mapping Suggestion, 5-step wizard, Mapping Router, JournalVoucher, updated DB schema & env vars |
| 1.6 | 08 Apr 2026 | Intern Team | Complete API inventory (add /export, /debug-llm, /health); detailed DB schema with all fields; environment variables section |
| 1.7 | 08 Apr 2026 | Intern Team | Add GET /api/v1/carmen/gl-prefix endpoint for GL Prefix master data |
| 1.8 | 09 Apr 2026 | Intern Team | Fix GL Prefix response field name (PrefixName); /extract now accepts multiple files; remove bank_name from /suggest requests; add missing localStorage keys (ocr_wizard_state, filePrefix, fileSource) |
| 1.9 | 16 Apr 2026 | Intern Team | Major architecture restructure: LLM layer (app/llm/), Tool layer (app/tools/ + ToolResult + registry), Carmen router split, generic tools endpoint (/api/v1/tools/), frontend domain API split (lib/api/*), custom hooks (useToast, useModal) |
| 2.0 | 17 Apr 2026 | Intern Team | Correction Learning System: feedback router (/api/v1/feedback/correction), correction_feedback table, correction_service (ratio-based hints), prompt injection at extract time, diffCorrections/logCorrections on frontend |
| 2.1 | 20 Apr 2026 | Intern Team | Architecture refactor: backend models/ package split (enums/orm/schemas), useOcrWizard hook extracted from App.jsx, barrel files (index.js) per component domain, Home hub page; UI/UX redesign with IBM Plex Sans + indigo design system |
| 2.2 | 24 Apr 2026 | Intern Team | LLM usage tracking: add `token_hash` (SHA-256) and `bu_name` columns to `llm_usage_logs`; update `mapping_history` unique constraint to include dept_code + acc_code; `usage_service.log_llm_usage()` accepts `admin_token` + `bu_name` |
| 2.3 | 10 Jun 2026 | Intern Team | **API namespace refactor (multi-module coherence):** `/api/v1/ocr/*` → `/api/v1/credit-card/*`; Carmen lifted to top-level `/api/v1/carmen/*` (shared by both modules); `/api/v1/mapping/*` → `/api/v1/credit-card/mapping/*`; health/debug-llm moved to app-level; dead endpoints removed (`/ocr/submit`, `/ocr/receipts/{id}/submit`, `mapping/history`); DB migrated to PostgreSQL (Neon); frontend paths centralized in `src/lib/api/endpoints.ts` |
| 3.0 | 07 Jul 2026 | Intern Team | **Supabase cutover + platform expansion:** DB migrated Neon → Supabase (Supavisor pooler, pg_cron/pg_partman background jobs); AP Invoice module APIs documented; Auth/Config/Files endpoint specs added; Billing & Credits purchase flow (`/api/v1/credits/*`) + Admin dashboard (`/api/v1/admin/*`) added; banks expanded 3 → 8 (BAY + processor fee invoices KTC/GHL/PAYPAL/SIAMPAY); credit-card line items no longer persisted (extract-display-only); `credit_card_transactions` + Tools layer removed; DB schema section now defers to Database_Design.md; deployment = Render (backend) + Vercel (frontend) |

---

## 1. บทนำ (Introduction)

เอกสารฉบับนี้จัดทำขึ้นเพื่อกำหนดขอบเขตและความต้องการในการเชื่อมต่อระบบ (Interface Requirements) ระหว่างระบบ **Bank Receipt OCR System** และ **Carmen Cloud** ผ่านรูปแบบ RESTful API (JSON Format) โดยมีวัตถุประสงค์เพื่อลดขั้นตอนการทำงานซ้ำซ้อน (Double Entry) และเพิ่มความแม่นยำในการนำเข้าข้อมูลบัญชีรายวันจากรายงานของธนาคาร

## 2. ขอบเขตงาน (Scope of Work)

การเชื่อมต่อข้อมูลประกอบด้วยส่วนหลักดังนี้:

1. **Outbound Interface - OCR Extraction**: ประมวลผลไฟล์ภาพหรือ PDF ผ่าน Vision LLM เพื่อดึงข้อมูลออกมาเป็นรูปแบบ JSON — ครอบคลุม 2 โมดูล: **Credit Card / Commission** (`/api/v1/credit-card/*`) และ **AP Invoice** (`/api/v1/ap-invoice/*`)
2. **Inbound Interface - Master Data Sync**: แบคเอนด์ทำหน้าที่เป็น Proxy ดึงข้อมูลรหัสบัญชี แผนก GL prefix vendor และ tax profile จาก Carmen Cloud
3. **Inbound Interface - AI Accounting Mapping**: ระบบ AI แนะนำรหัสบัญชีอัตโนมัติ (fixed fields + payment types สำหรับ credit card; per-line-item สำหรับ AP invoice) — ประวัติการโพสอ่านจาก Carmen โดยตรง
4. **Inbound Interface - Accounting Journal Review**: กระบวนการแสดง Journal Entry (Debit/Credit) และยืนยัน Journal Voucher / Invoice ก่อน Submit
5. **Inbound Interface - Data Submission**: ส่งข้อมูลเข้า Carmen ERP ผ่าน backend proxy พร้อม post-submit bookkeeping และการตรวจสอบการซ้ำซ้อน
6. **Correction Learning System**: บันทึกการแก้ไขของผู้ใช้ที่ submit time เพื่อเรียนรู้ pattern ที่ LLM มักจะอ่านผิด และนำไปใช้เพิ่ม hint ใน prompt ของธนาคารนั้นๆ โดยอัตโนมัติ
7. **Billing & Credits**: ระบบ subscription/top-up (`/api/v1/credits/*`) — catalog, order, proforma/tax invoice, payment slip, admin approval — ดูรายละเอียดใน [Billing_Purchase_Flow.md](./Billing_Purchase_Flow.md)
8. **Admin Dashboard**: `/api/v1/admin/*` — admin auth (JWT แยกจาก user), tenants, sessions, usage analytics, monitoring, credit-order review, maintenance

---

## 3. แผนภาพการทำงาน (System Interface Diagrams)

### 3.1 System Components

ระบบประกอบด้วย **3 ส่วนหลัก**:

```mermaid
flowchart LR
    User(["👤 พนักงานผู้ใช้งาน"])

    subgraph Frontend["🖥️ Frontend<br/>(React 5-step)"]
        direction TB
        UI["📋 OCR Wizard<br/>(Upload → Review → Accounting → JV)"]
        Mapping["⚙️ Mapping Page<br/>(AI Suggest Config)"]
        LS["💾 localStorage<br/>(accountingConfig)"]
    end

    subgraph Backend["🔧 Backend<br/>(FastAPI)"]
        direction TB
        OCR_R["📤 Credit Card Router<br/>(extract, tasks)"]
        Map_R["🤖 Mapping Router<br/>(suggest)"]
        Carmen_R["🔁 Carmen Router<br/>(shared proxy)"]
        AP_R["🧾 AP Invoice Router<br/>(extract, suggest)"]
        FB_R["📝 Feedback Router<br/>(correction, bug-report)"]
        CR_R["💳 Credits Router<br/>(packs, orders, billing docs)"]
        ADM_R["🛠️ Admin Routers<br/>(auth, tenants, usage, monitoring)"]
        Svc_L["⚙️ Service Layer<br/>(credit_card / ap_invoice /<br/>gl_suggestion / credit_order …)"]
        LLM_L["🧠 LLM Layer<br/>(client + prompt registry)"]
        CorrSvc["🔄 Correction Service<br/>(hints + ratio)"]
        DB["🗄️ PostgreSQL<br/>(Supabase — pg_cron/pg_partman)"]
    end

    subgraph External["☁️ External APIs"]
        direction TB
        OpenRouter["🧠 OpenRouter<br/>(Vision LLM)"]
        Carmen["📊 Carmen Cloud<br/>(Master Data)"]
    end

    User -->|Upload & Select| Frontend
    Frontend -->|REST API| Backend
    OCR_R -->|delegate| Svc_L
    OCR_R -->|get hints| CorrSvc
    Map_R -->|delegate| Svc_L
    Carmen_R -->|HTTP| Carmen
    AP_R -->|delegate| Svc_L
    FB_R -->|upsert correction| DB
    CR_R -->|delegate| Svc_L
    ADM_R -->|read/write| DB
    CorrSvc -->|query credit_cards + correction_feedback| DB
    Svc_L -->|call_text_llm / get_client| LLM_L
    LLM_L -->|LLM Call| OpenRouter
    Svc_L -->|read/write| DB
```

### 3.2 Request Flow (ลำดับขั้นตอนข้อมูล)

แผนภาพแสดงการไหลของข้อมูล **step-by-step** ตามลำดับ:

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend
    participant BE as Backend
    participant LLM as OpenRouter
    participant Carmen as Carmen Cloud
    participant DB as Database

    rect rgb(66, 135, 245)
        Note over User,DB: STEP 1: Upload & Extract
        User->>UI: Upload file + select bank
        UI->>BE: POST /api/v1/credit-card/extract
        BE->>LLM: Send image for analysis
        LLM-->>BE: Extracted JSON
        BE-->>UI: Receipt header + details
    end

    rect rgb(56, 177, 136)
        Note over User,DB: STEP 2: Load Master Data
        UI->>UI: Go to Mapping page
        UI->>BE: GET /api/v1/carmen/account-codes
        UI->>BE: GET /api/v1/carmen/departments
        BE->>Carmen: Proxy request
        Carmen-->>BE: Account & Dept lists
        BE-->>UI: Cleaned master data
    end

    rect rgb(255, 153, 51)
        Note over User,DB: STEP 3: AI Suggest Mapping
        UI->>BE: POST /api/v1/credit-card/mapping/suggest
        BE->>LLM: Suggest for 3 fields
        LLM-->>BE: Suggestions (Commission, Tax, Net)
        BE-->>UI: Display suggestions
        UI->>UI: Save to localStorage
    end

    rect rgb(218, 83, 83)
        Note over User,DB: STEP 4: Submit to Carmen ERP
        UI->>BE: POST /api/v1/carmen/gljv
        BE->>Carmen: Submit Journal Voucher
        Carmen-->>BE: Confirmed
        BE-->>UI: Success
    end

    rect rgb(140, 90, 200)
        Note over User,DB: STEP 4 (post-submit): Log Corrections
        UI->>UI: diffCorrections(final vs original)
        UI->>BE: POST /api/v1/feedback/correction (per changed field)
        BE->>DB: INSERT ... ON CONFLICT DO UPDATE correction_feedback
    end
```

### 3.3 Sequence Diagram: API 1 - Extract OCR Data (Stateless + Hint Injection)

ขั้นตอนการส่งไฟล์เพื่อใช้ Vision LLM ในการอ่านข้อมูล พร้อมการ inject correction hints อัตโนมัติ

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant Router as Credit Card Router (FastAPI)
    participant CorrSvc as correction_service
    participant DB as PostgreSQL
    participant Svc as credit_card_service
    participant Prompts as llm/prompts
    participant Client as llm/client
    participant LLM as OpenRouter (Vision LLM)

    User->>Router: POST /api/v1/credit-card/extract (files[], bank_code, pdf_password?)
    activate Router

    Note over Router: validate files + consume_document(increment=จำนวนไฟล์)<br/>ก่อนเรียก LLM
    Router->>CorrSvc: get_correction_hints(bank_code, db)
    CorrSvc->>DB: COUNT credit_cards submitted (bank, 90d)
    CorrSvc->>DB: COUNT corrections per field (bank, 90d)
    CorrSvc-->>Router: hints = {field: "rate"} if error_rate > 10%
    Router->>DB: create ocr_task rows (short-lived session,<br/>released before LLM call)

    Router->>Svc: extract(file_bytes, bank_code, hints)
    activate Svc
    Svc->>Svc: resize_if_needed() — Pillow resize, keep color
    Svc->>Prompts: get_ocr_prompt(bank_code, hints)
    Note right of Prompts: hints appended as CORRECTION NOTES<br/>if any field error_rate > 10%
    Prompts-->>Svc: bank-specific prompt + optional hints
    Svc->>Client: get_client()
    Client-->>Svc: AsyncOpenAI instance
    Svc->>LLM: vision call with base64 image + prompt
    activate LLM
    LLM-->>Svc: JSON Structured Data
    deactivate LLM
    Note right of Svc: fee-invoice banks (KTC/GHL/PAYPAL/SIAMPAY):<br/>_normalize_fee_invoice() spreads VAT per line
    Svc-->>Router: ExtractedCreditCardData (+warnings)
    deactivate Svc
    Router-->>User: 200 OK (array of ExtractedCreditCardData)
    deactivate Router
```

### 3.3a Sequence Diagram: Correction Learning — Log & Learn

ขั้นตอนการบันทึกการแก้ไขและเรียนรู้จาก pattern ที่ผิดซ้ำ

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant FB as Feedback Router
    participant DB as PostgreSQL

    Note over User: User submits after editing fields in Step 3
    User->>User: diffCorrections(finalHeader, originalHeader, finalDetails, originalDetails)
    Note right of User: compares final submitted values vs<br/>LLM-extracted originals — returns diff list

    loop for each changed field
        User->>FB: POST /api/v1/feedback/correction<br/>{doc_no, bank_code, field_name, original_value, corrected_value}
        FB->>DB: INSERT ... ON CONFLICT DO UPDATE correction_feedback
        Note right of DB: UPSERT on (tenant_id, bank_code, doc_no, field_name)<br/>1 document + 1 field = 1 record
        DB-->>FB: ok
        FB-->>User: {id, field_name, corrected_value, ...}
    end

    Note over DB: Next extraction for same bank:<br/>correction_service queries ratio<br/>corrections(field,90d) / receipts(bank,90d)<br/>fields > 10% get hint injected into prompt
```

### 3.4 Sequence Diagram: API 2 - Get Account Codes (Proxy)

การดึงข้อมูลผังบัญชีจาก Carmen ผ่านแบคเอนด์ Proxy

```mermaid
sequenceDiagram
    participant UI as Web Frontend (Mapping Page)
    participant API as API Service (Proxy)
    participant Carmen as Carmen Cloud API

    UI->>API: GET /api/v1/carmen/account-codes
    activate API
    API->>Carmen: GET /api/interface/accountCode (Authorization header)
    Carmen-->>API: JSON Data (AccCode, Description, Nature, Description2)
    API-->>UI: 200 OK (Cleaned Account List)
    deactivate API
```

### 3.5 Sequence Diagram: API 3 - Get Departments (Proxy)

การดึงข้อมูลแผนกจาก Carmen ผ่านแบคเอนด์ Proxy

```mermaid
sequenceDiagram
    participant UI as Web Frontend (Mapping Page)
    participant API as API Service (Proxy)
    participant Carmen as Carmen Cloud API

    UI->>API: GET /api/v1/carmen/departments
    activate API
    API->>Carmen: GET /api/interface/department (Authorization header)
    Carmen-->>API: JSON Data (DeptCode, Description, Description2)
    API-->>UI: 200 OK (Cleaned Department List)
    deactivate API
```

### 3.6 Sequence Diagram: API 4 - AI Mapping Suggestion

ขั้นตอนการให้ AI แนะนำรหัสบัญชีสำหรับ field แต่ละประเภท

```mermaid
sequenceDiagram
    participant UI as Mapping Page
    participant API as Mapping Router
    participant LLM as OpenRouter (LLM)
    participant Carmen as Carmen Cloud

    Note over UI,Carmen: GL mapping history is fetched from Carmen (spGetListJvBySource)<br/>No longer stored in local DB

    UI->>API: POST /api/v1/credit-card/mapping/suggest (accounts[], departments[])
    activate API
    API->>+MapTool: map_gl.suggest_fixed_fields(accounts, departments)
    MapTool->>PromptBuilder: build_fixed_fields_prompt(dept_lines, acc_lines, ...)
    PromptBuilder-->>MapTool: prompt string
    MapTool->>LLM: call_text_llm(prompt) via llm/client
    LLM-->>MapTool: {Commission, Tax Amount, Net Amount} → {dept, acc}
    MapTool-->>-API: ToolResult(suggestions)
    API-->>UI: 200 OK (suggestions, source: 'ai')
    deactivate API

    UI->>API: POST /api/v1/credit-card/mapping/suggest-payment-types (payment_types[], accounts[], departments[])
    activate API
    API->>+MapTool: map_gl.suggest_payment_types(payment_types, accounts, departments)
    MapTool->>PromptBuilder: build_payment_types_prompt(types, dept_lines, acc_lines, ...)
    PromptBuilder-->>MapTool: prompt string
    MapTool->>LLM: call_text_llm(prompt) via llm/client
    LLM-->>MapTool: {VSA-P, MCA-INT-P, QR-VSA, ...} → {dept, acc}
    MapTool-->>-API: ToolResult(suggestions)
    API-->>UI: 200 OK (suggestions per type, source: 'ai')
    deactivate API
```

### 3.7 Sequence Diagram: API 5 - Submit to Carmen ERP

ขั้นตอนการส่ง Journal Voucher เข้าระบบ Carmen ERP (ผ่าน backend proxy)

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant API as Carmen Router (FastAPI)
    participant DB as PostgreSQL
    participant Carmen as Carmen Cloud

    User->>API: POST /api/v1/carmen/gljv (JV payload + accounting lines)
    activate API
    API->>Carmen: POST Carmen Cloud jv endpoint
    Carmen-->>API: Result
    API->>DB: post-submit bookkeeping — mark CreditCard.submitted_at<br/>(header เท่านั้น — line items ไม่ persist)
    DB-->>API: Confirmed
    API-->>User: 200 OK
    deactivate API
```

---

## 4. ขั้นตอนการปฏิบัติงานของผู้ใช้งาน (User Operational Workflow)

### 4.1 กระบวนการนำเข้าข้อมูลรายวัน (5-Step OCR Wizard)

1. **Step 1 — Upload**: เจ้าหน้าที่เลือกธนาคาร/ผู้ให้บริการ (BBL/KBANK/SCB/BAY/KTC/GHL/PAYPAL/SIAMPAY) และอัปโหลดไฟล์ภาพหรือ PDF (multi-page PDF เลือกหน้าได้สูงสุด 5 หน้า)
2. **Step 2 — Processing**: ระบบส่งไฟล์ให้ Vision LLM ประมวลผลและแสดงสถานะการอ่าน
3. **Step 3 — Verification**: เจ้าหน้าที่ตรวจสอบและแก้ไขข้อมูล Header (ชื่อเอกสาร, วันที่, เลขที่เอกสาร ฯลฯ) และรายการย่อย (Details)
4. **Step 4 — Accounting Review**: ระบบโหลด Account Mapping จาก localStorage และแสดง Journal Entry (Debit/Credit) พร้อมแจ้งเตือนหาก mapping ไม่ครบ (รวมถึง File Prefix)
5. **Step 5 — Journal Voucher**: แสดง JV สรุปรายการบัญชีทั้งหมด เจ้าหน้าที่ยืนยันก่อนส่งเข้า Carmen ERP

### 4.2 กระบวนการตั้งค่า Account Mapping

1. เจ้าหน้าที่เข้าหน้า **Mapping** แล้วเลือกธนาคาร
2. ระบบ auto-fetch Carmen Account Codes + Departments
3. ระบบ auto-trigger AI Suggest เพื่อแนะนำรหัสบัญชีสำหรับ:
   - 3 fields หลัก: **Commission, Tax Amount, Net Amount**
   - ประเภทการชำระเงินทุกประเภทที่มีในสลิป (Visa, Mastercard, QR codes, ฯลฯ)
4. เจ้าหน้าที่ยืนยันหรือปรับแก้ mapping แต่ละรายการ
5. ระบบบันทึก mapping ลง localStorage

---

## 5. รายละเอียดและสเปกของ API (API Specifications)

### 5.1 API 1: Extract OCR Data

**วัตถุประสงค์**: ประมวลผลไฟล์ด้วย Vision LLM และส่งข้อมูลกลับทันทีเพื่อ review — สร้างเฉพาะ `ocr_tasks` + draft `credit_cards` header row (สำหรับ audit/quota); **line items ไม่ถูกบันทึกลง DB** (extract-display-only)

**Method**: POST | **Endpoint**: `/api/v1/credit-card/extract`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | Binary[] (multipart) | Yes | ไฟล์ภาพหรือ PDF หนึ่งไฟล์ขึ้นไป (max 5MB ต่อไฟล์) |
| `bank_code` | String (query) | No | รหัสธนาคาร: `BBL` `KBANK` `SCB` `BAY` `KTC` `GHL` `PAYPAL` `SIAMPAY` (ไม่ระบุ = generic prompt) |
| `pdf_password` | String (form) | No | รหัสผ่านสำหรับ PDF ที่เข้ารหัส |

> ระบบ validate ไฟล์ + เปิด PDF ให้ได้ก่อน แล้วจึง `consume_document()` (ตัดเครดิต) — ไฟล์เสียหรือรหัสผิดจะไม่เสีย credit
>
> **บัตรเครดิตคิด 1 เอกสารต่อ 1 ไฟล์** (ไม่ว่าจะกี่หน้า สูงสุด 5 หน้าแรก) — ต่างจาก AP Invoice ที่คิดตามจำนวนหน้า

**JSON Response** (Array — หนึ่ง object ต่อไฟล์) — `ExtractedCreditCardData`:

```json
[
  {
    "id": "d3b0…",
    "task_id": "a1f2…",
    "bank_name": "SCB",
    "bank_company_name": "ธนาคารไทยพาณิชย์ จำกัด (มหาชน)",
    "branch_no": "0001",
    "doc_name": "รายงานสรุปยอดขาย",
    "doc_no": "SCB-2026-00123",
    "doc_date": "08/04/2026",
    "company_name": "บริษัท ตัวอย่าง จำกัด",
    "merchant_name": "EXAMPLE CO LTD",
    "merchant_id": "123456789",
    "details": [
      { "transaction": "VISA", "pay_amt": "5000.00", "commis_amt": "75.00", "tax_amt": "5.25", "total": "4919.75" },
      { "transaction": "MASTERCARD", "pay_amt": "5000.00", "commis_amt": "75.00", "tax_amt": "5.25", "total": "4919.75" }
    ],
    "is_duplicate": false,
    "warnings": []
  }
]
```

> `warnings` — ข้อความเตือนจาก backend normalizer (เช่น fee invoice ที่อ่าน footer ไม่ได้ ใช้อัตรา VAT 7% โดยสมมติ) — frontend แสดงเป็น amber banner
> `is_duplicate` — true เมื่อ (tenant, bank, doc_no) เคย submit แล้ว

---

### 5.2 API 2: Get Account Codes from Carmen

**วัตถุประสงค์**: ดึงข้อมูลผังบัญชี (Chart of Accounts) สำหรับแสดงใน dropdown ของหน้า Mapping

**Method**: GET | **Endpoint**: `/api/v1/carmen/account-codes`

**JSON Response**:

```json
{
  "status": "success",
  "Data": [
    { "AccCode": "113200", "Description": "BANK RECEIVABLE", "Description2": "ลูกหนี้ธนาคาร", "Nature": "DEBIT" },
    { "AccCode": "214100", "Description": "VAT PAYABLE", "Description2": "ภาษีมูลค่าเพิ่มค้างจ่าย", "Nature": "CREDIT" }
  ]
}
```

---

### 5.3 API 3: Get Departments from Carmen

**วัตถุประสงค์**: ดึงข้อมูลรายชื่อแผนก สำหรับแสดงใน dropdown ของหน้า Mapping

**Method**: GET | **Endpoint**: `/api/v1/carmen/departments`

**JSON Response**:

```json
{
  "status": "success",
  "Data": [
    { "DeptCode": "100", "Description": "ACCOUNTING", "Description2": "แผนกบัญชี" },
    { "DeptCode": "200", "Description": "FINANCE", "Description2": "แผนกการเงิน" }
  ]
}
```

---

### 5.3a API 3a: Get GL Prefix from Carmen

**วัตถุประสงค์**: ดึงข้อมูล GL Prefix (หลักเกณฑ์การตั้งชื่อบัญชี) จาก Carmen สำหรับสนับสนุน Account Code suggestion

**Method**: GET | **Endpoint**: `/api/v1/carmen/gl-prefix`

**JSON Response**:

```json
{
  "status": "success",
  "Data": [
    { "PrefixName": "1000", "Description": "ASSETS", "Description2": "สินทรัพย์" },
    { "PrefixName": "2000", "Description": "LIABILITIES", "Description2": "หนี้สิน" },
    { "PrefixName": "3000", "Description": "EQUITY", "Description2": "ทุน" }
  ]
}
```

---

### 5.4 API 4a: AI Suggest Mapping (3 Fixed Fields)

**วัตถุประสงค์**: ให้ AI แนะนำรหัสบัญชีสำหรับ Commission, Tax Amount, Net Amount โดยอ้างอิงรายการบัญชีจาก Carmen

**Method**: POST | **Endpoint**: `/api/v1/credit-card/mapping/suggest`

**JSON Request**:

```json
{
  "accounts": [{ "code": "113200", "name": "BANK RECEIVABLE", "type": "DEBIT" }],
  "departments": [{ "code": "100", "name": "ACCOUNTING" }]
}
```

**JSON Response**:

```json
{
  "suggestions": {
    "Commission": { "dept": "100", "acc": "551100" },
    "Tax Amount": { "dept": "100", "acc": "214100" },
    "Net Amount": { "dept": "100", "acc": "113200" }
  },
  "source": "ai"
}
```

---

### 5.5 API 4b: AI Suggest Payment Type Mapping

**วัตถุประสงค์**: ให้ AI แนะนำรหัสบัญชีสำหรับแต่ละประเภทการชำระเงิน (Visa, Mastercard, QR, ฯลฯ)

**Method**: POST | **Endpoint**: `/api/v1/credit-card/mapping/suggest-payment-types`

**JSON Request**:

```json
{
  "payment_types": ["VSA-DCC-P", "MCA-INT-P", "QR-VSA", "QR-MCA"],
  "accounts": [{ "code": "113200", "name": "BANK RECEIVABLE", "type": "DEBIT" }],
  "departments": [{ "code": "100", "name": "ACCOUNTING" }]
}
```

**JSON Response**:

```json
{
  "suggestions": {
    "VSA-DCC-P": { "dept": "100", "acc": "113201" },
    "MCA-INT-P": { "dept": "100", "acc": "113202" },
    "QR-VSA":    { "dept": "100", "acc": "113203" },
    "QR-MCA":    { "dept": "100", "acc": "113203" }
  },
  "source": "ai"
}
```

---

### 5.6 Mapping History

> ⚠️ **Removed as of v2.3** — `GET /api/v1/mapping/history` และ `POST /api/v1/mapping/history/save` ถูกลบออกแล้ว ประวัติการโพส JV อ่านโดยตรงจาก Carmen ERP (`spGetListJvBySource`) แทนการเก็บไว้ใน local DB (`mapping_history` table ถูก drop ใน migration 207)

---

### 5.7 API 5: Submit Journal Voucher to Carmen ERP

**วัตถุประสงค์**: ส่ง Journal Voucher ที่ผ่านการตรวจสอบแล้วเข้า Carmen ERP โดยตรง (backend proxy)

> หมายเหตุ: ไม่มี endpoint `/api/v1/credit-card/submit` หรือ `/api/v1/ocr/submit` — การ submit ผ่าน Carmen proxy เท่านั้น

**Method**: POST | **Endpoint**: `/api/v1/carmen/gljv`

ข้อมูล request/response เป็นไปตาม Carmen ERP API specification (backend เป็น thin proxy — ไม่แปลง payload)

---

### 5.8 API 6: List Credit Card OCR Tasks (Paginated)

**วัตถุประสงค์**: ดึงรายการ OCR tasks ทั้งหมดพร้อมข้อมูล pagination

**Method**: GET | **Endpoint**: `/api/v1/credit-card/tasks`

**Query Parameters**:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | String | - | filter ตามสถานะ task (pending/processing/completed/failed) |
| `limit` | Integer | 50 | จำนวน records ที่ต้องการ (1–500) |
| `offset` | Integer | 0 | จำนวน records ที่ข้าม |

**JSON Response**:

```json
{
  "total": 100,
  "tasks": [
    {
      "id": "a1f2…",
      "original_filename": "receipt_001.jpg",
      "status": "completed",
      "created_at": "2026-04-08T10:30:00Z"
    }
  ]
}
```

---

### 5.9 API 7: Get Single Task Detail

**วัตถุประสงค์**: ดึงข้อมูลเอกสารแบบละเอียด (task + credit_card header) — **ไม่มี transactions** เพราะ line items ไม่ถูก persist (Carmen ERP เป็น source of truth)

**Method**: GET | **Endpoint**: `/api/v1/credit-card/tasks/{task_id}`

**JSON Response**:

```json
{
  "id": "a1f2…",
  "original_filename": "receipt_001.jpg",
  "status": "completed",
  "created_at": "2026-04-08T10:30:00Z",
  "credit_card": {
    "id": "d3b0…",
    "task_id": "a1f2…",
    "bank_code": "SCB",
    "company_name": "บริษัท ตัวอย่าง จำกัด",
    "bank_company_name": "ธนาคารไทยพาณิชย์ จำกัด (มหาชน)",
    "doc_date": "08/04/2026",
    "doc_no": "SCB-2026-00123",
    "branch_no": "0001",
    "submitted_at": "2026-04-08T10:30:00Z",
    "created_at": "2026-04-08T10:30:00Z"
  }
}
```

---

### ~~5.10 API 8: Mark Receipt as Submitted~~

> ⚠️ **Removed as of v2.3** — endpoint `PATCH /api/v1/ocr/receipts/{id}/submit` (หรือ `PATCH /api/v1/credit-cards/{id}/submit`) ไม่เคยมีอยู่จริงใน codebase การ submit เกิดขึ้นเมื่อ user ยืนยัน JV ผ่าน `/api/v1/carmen/gljv` เท่านั้น

---

### 5.11 API 9: Debug LLM Response

**วัตถุประสงค์**: ดู raw JSON response จากครั้งสุดท้ายที่เรียก Vision LLM (สำหรับ troubleshooting) — ใช้ได้ทั้ง credit card และ AP invoice modules

**Method**: GET | **Endpoint**: `/api/v1/debug-llm`

> ป้องกันด้วย `APP_DEBUG=true` — จะคืน HTTP 403 ใน production

**JSON Response**:

```json
{
  "raw": "{...raw LLM response string...}",
  "source": "credit_card_ocr",
  "ts": "2026-04-08T10:30:00Z"
}
```

---

### 5.13 API 11a: Generic Tools — List / Schema / Invoke

> **Removed 2026-07-06.** The generic `/api/v1/tools` registry (agent-style invocation
> by name) had no callers and was deleted. GL suggestion is served directly by
> `routers/mapping.py` → `services/gl_suggestion_service.py`. Restore from git history
> if an agent layer is reintroduced.

---

### 5.14 API 12: Log Correction Feedback

**วัตถุประสงค์**: บันทึกการแก้ไขของผู้ใช้เพื่อใช้ปรับปรุง LLM prompt ในอนาคต (เรียกที่ submit time โดย `diffCorrections`)

**Method**: POST | **Endpoint**: `/api/v1/feedback/correction` (รายรายการ) หรือ `/api/v1/feedback/corrections` (batch: `{"corrections": [...]}` → `{"saved": n, "skipped": m}`)

**JSON Request**:

```json
{
  "doc_no": "SCB-2026-00123",
  "bank_code": "SCB",
  "field_name": "merchant_name",
  "original_value": "EXAMPLE CO",
  "corrected_value": "EXAMPLE CO LTD"
}
```

> `field_name` ใช้ชื่อ snake_case ตรงกับ LLM prompt field (เช่น `merchant_name`, `doc_no`, `pay_amt`) — validate ด้วย `FieldName` enum ฝั่ง backend

**JSON Response**:

```json
{
  "id": 42,
  "skipped": false,
  "doc_no": "SCB-2026-00123",
  "bank_code": "SCB",
  "field_name": "merchant_name",
  "original_value": "EXAMPLE CO",
  "corrected_value": "EXAMPLE CO LTD",
  "created_at": "2026-04-17T10:30:00"
}
```

**กรณี skip** (original == corrected): `skipped: true` — ไม่บันทึกลง DB

**UPSERT behavior**: `INSERT ... ON CONFLICT DO UPDATE` บน partial unique index `(tenant_id, bank_code, doc_no, field_name) WHERE deleted_at IS NULL` — 1 เอกสาร + 1 field = 1 record เสมอ

**Bug report**: `POST /api/v1/feedback/bug-report` — `{module, category, description, screenshot_b64?}` (screenshot ≤ ~1 MB) → บันทึกลง `bug_reports` สำหรับ admin triage

---

### 5.15 API 11: Health Check

**วัตถุประสงค์**: ตรวจสอบสถานะ API และฐานข้อมูล (app-level — ใช้โดย Render health probe + uptime monitor)

**Method**: GET | **Endpoint**: `/api/v1/health`

Liveness probe (ไม่ตรวจ DB): `GET /livez`

Readiness probe (ตรวจ DB connection): `GET /readyz`

**JSON Response (healthy)**:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-04-08T10:30:00Z"
}
```

---

### 5.16 Auth — Carmen SSO Exchange

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/v1/auth/exchange` | `{token, bu, uri}` → validate กับ Carmen → UPSERT `tenants` (host, bu) → สร้าง `ocr_sessions` → คืน OCR JWT (`tid`/`cuid`/`bu` claims) |
| DELETE | `/api/v1/auth/session` | revoke session ปัจจุบัน (`is_active = false`) |
| GET | `/api/v1/auth/usage` | ยอดโควตาแพ็กเกจ + เครดิตคงเหลือของ tenant ปัจจุบัน |

> `uri` ถูกตรวจกับ `ALLOWED_CARMEN_HOSTS` allowlist (กัน SSRF) — ทุก endpoint อื่นใช้ `Authorization: Bearer <jwt>` และ `get_current_session()` validate ว่า session ยัง active

---

### 5.17 AP Invoice Module

5-step wizard เช่นเดียวกับ credit card — ดูรายละเอียด flow ใน [CLAUDE.md](../CLAUDE.md)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/v1/ap-invoice/extract` | multipart `file` + `selected_pages?` + `pdf_password?` → vision LLM → post-process (`ap_invoice_postprocess`: tax-type detection, footer-discount distribution, per-line totals) → header + line items (display-only). **คิดเครดิต 1 เอกสารต่อ 1 หน้าที่ส่งเข้า LLM** (`billable_pages()` — เลือก 2 หน้า = 2 เอกสาร, ไม่เลือก = ทุกหน้าแต่ไม่เกิน 5); ล้มเหลวคืนเท่าที่ตัดไป |
| POST | `/api/v1/ap-invoice/suggest` | `SuggestGLRequest` (line items + master data) → LLM แนะนำ `deptCode`/`accountCode` ต่อรายการ (pre-filter เฉพาะ expense accounts; ประวัติ vendor จาก Carmen ใช้ก่อนถาม AI) |

Submit เข้า Carmen ผ่าน `POST /api/v1/carmen/invoice` (proxy) — column→field mapping ต่อ vendor เก็บใน localStorage ฝั่ง frontend

---

### 5.18 Config & Files

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET/PUT | `/api/v1/config/accounting` | per-BU accounting config (`bu_accounting_configs`) |
| GET/PUT | `/api/v1/config/ap-mapping/{vendor_tax_id}` | per-vendor AP column/field mapping (server-side copy) |
| GET | `/api/v1/config/analytics/account-usage` | สถิติการใช้รหัสบัญชี |
| POST | `/api/v1/files/pdf-info` | จำนวนหน้า + สถานะเข้ารหัสของ PDF (สำหรับ page selector) |
| POST | `/api/v1/files/preview` | render หน้า PDF/ภาพ เป็น preview |

---

### 5.19 Billing & Credits (`/api/v1/credits/*`)

Business flow ฉบับเต็ม: [Billing_Purchase_Flow.md](./Billing_Purchase_Flow.md) — tiers Starter/Growth/Pro (monthly/annual) + top-up packs, ชำระด้วย bank transfer + slip upload, admin approve

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/credits/packs` | catalog (subscription tiers + top-up packs) |
| GET | `/credits/company-profile` | ข้อมูลบริษัทผู้ซื้อ (pre-fill จาก Carmen / invoice ล่าสุด) |
| GET | `/credits/payment-info` | ข้อมูลบัญชีรับโอน |
| POST | `/credits/orders` | สร้าง order + ออก proforma (คำนวณ proration credit + VAT 7%) |
| POST | `/credits/orders/{id}/slip` | อัปโหลดสลิปโอนเงิน |
| POST | `/credits/orders/{id}/cancel` | ยกเลิก order ที่ยัง pending |
| GET | `/credits/orders` / `/credits/orders/{id}` | ประวัติ order |
| GET | `/credits/orders/{id}/documents` | proforma / tax invoice (render เป็น HTML ฝั่ง frontend) |

---

### 5.20 Admin Dashboard (`/api/v1/admin/*`)

ใช้ **admin JWT แยก** (`ADMIN_JWT_SECRET`) + RBAC (`require_permission(resource, action)`)

| Group | Endpoints (สรุป) |
| :--- | :--- |
| `admin/auth` | login (email/password), me, logout, mfa/verify (TOTP — placeholder Phase 1.5) |
| `admin/tenants` | จัดการ tenants |
| `admin/sessions` | ดู/revoke ocr_sessions |
| `admin/usage` | usage analytics ต่อ tenant/module |
| `admin/monitoring` | anomaly alerts, job runs, system health |
| `admin/credits` | review credit orders — approve (ออก tax invoice + activate subscription) / reject / hold |
| `admin/maintenance` | summary backfill, session purge, pricing sync (endpoints เหล่านี้ถูกเรียกจาก pg_cron ผ่าน pg_net ด้วย `INTERNAL_JOB_TOKEN` ด้วย) |

---

## 6. โครงสร้างฐานข้อมูล (Database Schema)

> **เอกสารอ้างอิงหลักของ schema คือ [Database_Design.md](./Database_Design.md)** — section นี้เป็นเพียงภาพรวม ไม่ duplicate รายละเอียด column

ระบบใช้ **PostgreSQL ผ่าน Supabase** (Supavisor session-mode pooler) ผ่าน `asyncpg` + SQLAlchemy 2.x async — schema เป็นของ **Supabase CLI migrations** (`supabase/migrations/*.sql`, apply ด้วย `supabase db push`)

### 6.1 ภาพรวม Layer

| Layer | Tables | หมายเหตุ |
| :--- | :--- | :--- |
| Identity | `tenants` (composite host+bu), `plans` | tenant ต่อ (host, bu) pair |
| Admin RBAC | `admin_users`, `roles`, `permissions`, `role_permissions`, `admin_user_roles` | |
| Modules / Bank CMS | `modules`, `tenant_modules`, `banks`, `prompt_templates` | bank = INSERT row, ไม่ใช่ enum |
| Config | `system_configs`, `tenant_config_overrides`, `feature_flags`, `bu_accounting_configs`, `bu_accounting_mapping_entries`, `ap_vendor_column_mappings`, `ap_vendor_field_mapping_entries` | |
| Billing | `credit_packs`, `tenant_credits`, `credit_ledger`, `credit_orders`, `billing_documents`, `tenant_subscriptions`, `ar_customer_profiles`, `document_sequences` | `consume_document()` ตัดโควตาแพ็กเกจก่อน แล้วจึงเครดิต (ทดลองฟรี 30 ใบ = `signup_grant`); ดู Billing_Purchase_Flow.md |
| Business data | `ocr_sessions`, `ocr_tasks`, `credit_cards`, `ap_invoices`, `correction_feedback`, `bug_reports` | soft delete เสมอ |
| Observability | `llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs` | partitioned monthly (pg_partman) |
| Analytics | `daily_usage_summary`, `daily_model_cost`, `monthly_usage_summary`, `anomaly_alerts`, `job_runs` | สร้างโดย pg_cron |

### 6.2 จุดสำคัญที่กระทบ API

- **Line items ไม่ persist** — ทั้ง credit card และ AP invoice เป็น extract-display-only; DB เก็บเฉพาะ header (`credit_cards`, `ap_invoices`) — Carmen ERP เป็น source of truth
- **Duplicate check**: `(tenant_id, bank_code, doc_no, submitted_at IS NOT NULL, deleted_at IS NULL)`
- **`correction_feedback`**: unique ต่อ `(tenant_id, bank_code, doc_no, field_name)` (partial index, UPSERT); มี `value_embedding vector(1536)` + HNSW index สำหรับ nearest-neighbour hints; `error_rate = corrections(field, 90d) / submitted_receipts(bank, 90d)` → inject hint เมื่อ > 10%
- **`llm_usage_logs`**: composite PK `(id BIGINT, created_at)`, `tenant_id` เป็น VARCHAR ไม่มี FK, มี `cost_usd` คำนวณจาก `model_pricing` ตอน insert
- ~~`credit_card_transactions`~~ / ~~`mapping_history`~~ — ถูก drop แล้ว (line items ไม่เก็บ; GL history อ่านจาก Carmen `spGetListJvBySource`)

---

## 7. การตั้งค่าสภาพแวดล้อม (Environment Configuration)

ไฟล์ `.env` จะต้องอยู่ใน `backend/` directory และไม่ควร commit ไปยัง git

### 7.1 Backend `.env` Variables

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SUGGESTION_MODEL=google/gemini-2.0-flash-lite
OPENROUTER_AP_INVOICE_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Database Configuration (PostgreSQL via Supabase — Supavisor pooler)
DATABASE_URL=postgresql+asyncpg://user:password@host.pooler.supabase.com/postgres?sslmode=require

# Auth Secrets — NEVER put these in system_configs DB table
OCR_JWT_SECRET=<strong-random-secret>
ADMIN_JWT_SECRET=<different-strong-random-secret>
SESSION_ENCRYPTION_KEY=<fernet-key>
INTERNAL_JOB_TOKEN=<hex-64-chars>  # ต้องตรงกับ vault.secrets 'internal_job_token'

# File Upload Configuration
MAX_FILE_SIZE_MB=5

# API Configuration
APP_PORT=8010

# Security (production required)
ALLOWED_ORIGINS=https://your-frontend-domain.com
TRUST_PROXY=true
ALLOWED_CARMEN_HOSTS=carmen.example.com
```

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | Yes | - | API key สำหรับ OpenRouter Vision LLM |
| `OPENROUTER_OCR_MODEL` | No | google/gemini-2.5-flash-lite | Model สำหรับ Credit Card OCR extraction |
| `OPENROUTER_AP_INVOICE_MODEL` | No | google/gemini-2.5-flash-lite | Model สำหรับ AP Invoice extraction |
| `OPENROUTER_SUGGESTION_MODEL` | No | google/gemini-2.0-flash-lite | Model สำหรับ AI suggestion |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | Base URL ของ OpenRouter |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (asyncpg) |
| `OCR_JWT_SECRET` | Yes | - | Secret สำหรับ user JWT signing |
| `ADMIN_JWT_SECRET` | Yes (prod) | - | Secret สำหรับ admin JWT — **ต้องต่างจาก** `OCR_JWT_SECRET` (app hard-fail ใน prod ถ้าซ้ำ/ว่าง) |
| `SESSION_ENCRYPTION_KEY` | Yes | - | Fernet key สำหรับ session encryption |
| `INTERNAL_JOB_TOKEN` | Yes (prod) | - | Bearer token สำหรับ pg_cron → FastAPI callbacks (pricing-sync, anomaly) |
| `MAX_FILE_SIZE_MB` | No | 5 | ขนาดไฟล์สูงสุด (MB) |
| `APP_PORT` | No | 8010 | Port ของ FastAPI server |
| `ALLOWED_ORIGINS` | Yes (prod) | - | CORS allowed origins (wildcard ใช้ได้บน dev เท่านั้น) |
| `ALLOWED_CARMEN_HOSTS` | Yes (prod) | - | Whitelist hostname ของ Carmen ERP (SSRF protection) |

---

## 8. ข้อกำหนดอื่นๆ (Non-Functional Requirements)

1. **Authentication**: การเชื่อมต่อ Carmen API ต้องผ่าน `Authorization` header ของแบคเอนด์เท่านั้น ห้าม frontend เรียกตรง
2. **Duplicate Prevention**: ระบบต้องตรวจสอบ `doc_no` ซ้ำก่อน submit ทุกครั้ง โดยเปรียบเทียบเฉพาะ credit_card ที่มี `submitted_at IS NOT NULL`
3. **Soft Delete**: Business tables ใช้ soft delete (`deleted_at`) เสมอ ห้าม hard delete ยกเว้นมีเหตุผลพิเศษ
4. **Data Mapping Cache**: ระบบเก็บ mapping config ใน localStorage (`accountingConfig`, `accountMappingAmount`) เพื่อให้ใช้ซ้ำได้โดยไม่ต้อง re-fetch ทุกครั้ง
5. **Error Reporting**: กรณีเกิดข้อผิดพลาด (422) แบคเอนด์ต้องส่งรายละเอียดสาเหตุเพื่อแสดงผลใน `CustomModal`
6. **Performance**: API Master Data (Carmen Proxy) ต้องตอบสนองไม่เกิน 3 วินาที; AI Suggest ไม่เกิน 10 วินาที
7. **Idempotent Migrations**: schema เป็นของ Supabase CLI (`supabase/migrations/*.sql`) — DDL ต้อง idempotent, ห้ามแก้ไขหรือ reorder ไฟล์ที่ apply แล้ว
8. **Color Image Processing**: ห้ามแปลงภาพเป็น grayscale ก่อนส่ง Vision LLM เพราะลดความแม่นยำในการอ่าน
9. **File Size Limit**: ไฟล์ต้องมีขนาดไม่เกิน 5 MB ต่อไฟล์; รองรับ JPG, PNG, WebP, BMP, TIFF, HEIC, PDF (อ่านเข้า memory เท่านั้น ไม่เขียนลง disk)
10. **No File Storage**: ไฟล์ที่อัปโหลดอ่านเข้า memory → ส่ง LLM → ทิ้ง ห้ามสร้างโฟลเดอร์ `uploads/` หรือ `exports/`

---

## 9. ธนาคารและไฟล์ที่รองรับ (Supported Banks & File Types)

### 9.1 ธนาคารที่รองรับ

| Bank Code | Bank Name | Layout type |
| :--- | :--- | :--- |
| `BBL` | ธนาคารกรุงเทพ | commission statement |
| `KBANK` | ธนาคารกสิกรไทย | commission statement |
| `SCB` | ธนาคารไทยพาณิชย์ | commission statement |
| `BAY` | ธนาคารกรุงศรีอยุธยา | bank statement |
| `KTC` | KTC | processor **fee invoice** |
| `GHL` | GHL | processor **fee invoice** |
| `PAYPAL` | PayPal | processor **fee invoice** |
| `SIAMPAY` | SiamPay | processor **fee invoice** |

> Fee-invoice layouts: 1 detail row ต่อบรรทัดค่าธรรมเนียมที่พิมพ์ (`commis_amt` = fee ก่อน VAT); VAT จาก footer ถูกกระจายตามสัดส่วน — ดูรายละเอียดใน [CLAUDE.md](../CLAUDE.md)

แต่ละธนาคารมี **bank-specific extraction prompts** ใน `backend/app/llm/prompts/<bank>.py` เพื่อปรับปรุงความแม่นยำ — เพิ่มธนาคารใหม่ได้โดยสร้างไฟล์ใหม่ + ลงทะเบียนใน `llm/prompts/__init__.py` + INSERT ลง `banks` table (pending Prompt CMS สำหรับ zero-redeploy)

### 9.2 ประเภทไฟล์ที่รองรับ

**รูปภาพ**:

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- WebP (`.webp`)
- BMP (`.bmp`) / TIFF (`.tif`, `.tiff`)
- HEIC/HEIF (`.heic`, `.heif`) — แปลงเป็น JPEG ผ่าน pillow-heif

**เอกสาร**:

- PDF (`.pdf`) — รองรับ multi-page; page selector เลือกได้สูงสุด 5 หน้า

**ข้อจำกัด**:

- ขนาดไฟล์สูงสุด: **5 MB** ต่อไฟล์
- การประมวลผล: อ่านไฟล์เข้า memory → ส่ง LLM → ทิ้ง (ไม่เขียนลง disk เลย)

### 9.3 Image Processing Requirements

- **Preprocessing**: Pillow resize (keep aspect ratio) + **retain color** (no grayscale conversion)
- **Reason**: Vision LLM reads color better; grayscale reduces accuracy
- **Base64 encoding**: ส่งไปยัง OpenRouter เป็น base64 string ใน single vision LLM call

---

## 10. Front-end Technologies & Dependencies

### 10.1 React 5-Step Wizard

| Step | Component | Purpose |
| :--- | :--- | :--- |
| 1 | `UploadSection` | เลือกธนาคาร + อัปโหลดไฟล์ |
| 2 | `DocumentPreview` | แสดงสถานะการประมวลผล |
| 3 | `HeaderCard` + `DetailTable` | ตรวจสอบและแก้ไขข้อมูล |
| 4 | `AccountingReview` | แสดง Journal Entry + mapping alerts |
| 5 | `JournalVoucher` | สรุป JV + ยืนยันบันทึก |

### 10.1b Backend Models Package

`backend/app/models/` package:

| File | Contents |
| :--- | :--- |
| `app/models/__init__.py` | Re-exports ทุก symbol เพื่อ backward compatibility |
| `app/models/enums.py` | `TaskStatus`, `CreditOrderStatus`, `SubscriptionStatus`, `PromptStatus`, ฯลฯ |
| `app/models/mixins.py` | `TenantFKMixin`, `TimestampMixin`, `SoftDeleteMixin`, `WriterMixin` |
| `app/models/identity.py` / `admin.py` / `catalog.py` / `billing.py` / `business.py` / `observability.py` | SQLAlchemy ORM classes แยกตาม domain |
| `app/models/schemas/` | Pydantic schemas package — ห้ามนิยาม BaseModel ใน router files |

### 10.2 Key Frontend Files

**API Layer** (`src/lib/api/`) — ทุก path ถูก centralize ใน `endpoints.ts`:

| File | Exported Functions |
| :--- | :--- |
| `src/lib/api/endpoints.ts` | `API` — single source of truth สำหรับทุก `/api/v1/*` path |
| `src/lib/api/ocr.ts` | `extractFromFile()` (→ `API.creditCard.extract`) |
| `src/lib/api/carmen.ts` | `fetchAccountCodes()`, `fetchDepartments()`, `fetchGLPrefixes()`, `submitToCarmen()` (→ `API.carmen.*`) |
| `src/lib/api/mapping.ts` | `suggestMapping()`, `suggestPaymentTypes()` (→ `API.creditCard.mapping.*`) |

> หมายเหตุ: `markSubmitted()` ถูกลบออกแล้ว (v2.3) — ไม่เคยมี endpoint จริง

**Hooks** (`src/hooks/`) — feature hooks อยู่ใน subdirectory (`credit-card/`, `ap-invoice/`, `mapping/`, `credits/`, `admin/`) แต่ละอันมี `index.ts` barrel; cross-cutting hooks อยู่ top level:

| File | Purpose |
| :--- | :--- |
| `src/hooks/credit-card/useOcrWizard.ts` | Credit card wizard state + handlers |
| `src/hooks/ap-invoice/useAPInvoice.ts` | AP invoice wizard state + handlers |
| `src/hooks/mapping/…` | Mapping page state |
| `src/hooks/credits/…` | Pricing / order / checkout state |
| `src/hooks/useCarmenSSO.ts`, `useDarkMode.ts`, `useModal.ts`, `usePdfPasswordPrompt.ts`, `useUserConsent.ts` | Cross-cutting |

**App & Pages**:

| File | Role |
| :--- | :--- |
| `src/App.tsx` | Thin render shell — imports hooks, renders step JSX only |
| `src/pages/Home.tsx` | Landing hub page |
| `src/pages/CreditCardOCR.tsx` / `APInvoice.tsx` / `Mapping.tsx` | โมดูลหลัก 3 หน้า |
| `src/pages/Pricing.tsx` / `OrderHistory.tsx` | Customer-facing purchase flow (`#/pricing`, `#/pricing/orders`) — **bilingual EN/TH** ผ่าน `src/i18n/dict.ts` + `LanguageContext.tsx` |
| `src/pages/admin/` / `order-review/` | Admin dashboard + order review |
| `src/constants/index.ts` | `BANKS`, `detectBankFromCompanyName()`, `DETAIL_COLUMNS`, etc. |
| `src/lib/storage.ts` | tenant-aware localStorage wrapper (`appKey()`) — ทุกการเข้าถึง localStorage ต้องผ่านตัวนี้ |

### 10.3 CSS Architecture & Design System

ระบบใช้ layered CSS — plain CSS ล้วน ไม่มี utility framework (Tailwind ถูกถอดออกทั้งหมด 2026-08-19):

| File | Role |
| :--- | :--- |
| `src/styles/base.css` | Design tokens (CSS variables), resets, keyframe animations, utility classes |
| `src/styles/layout.css` | App container, header, main grid, responsive breakpoints |
| `src/styles/components.css` | All reusable components: buttons, cards, tables, modals, step wizard, toast |
| `src/styles/pages/` | Per-page styles: `home.css`, `mapping.css`, `ap-invoice.css`, `pricing.css`, `admin.css` |

**Design Tokens:**

| Token | Value | Usage |
| :--- | :--- | :--- |
| `--primary` | `#4f46e5` (indigo) | Brand color, buttons, links, focus rings |
| `--teal` | `#0891b2` | Secondary accent |
| `--emerald` | `#059669` | Success states, ONLINE badge |
| `--rose` | `#e11d48` | Danger, credit indicators |
| Font | IBM Plex Sans + IBM Plex Mono | Body + monospace |
| Shadow scale | xs/sm/md/lg/xl | 5-level elevation |

### 10.4 Storage & Persistence

- **localStorage keys**:
  - `accountingConfig`: account code + department mappings — รวม field `filePrefix` (GL file prefix สำหรับ JV) และ `fileSource` (ชื่อแหล่งที่มา)
  - `accountMappingAmount`: mapping สำหรับแต่ละ payment type (Visa, MCA, QR, ฯลฯ)
  - `currentStep`: current wizard step (auto-recovery on refresh)
  - `ocr_wizard_state`: state ของ OCR wizard — bank ที่เลือก, details ที่สแกนได้

---

## 11. Key Design Decisions (Design Rationale)

| Decision | Reason |
| :--- | :--- |
| **Stateless extraction** | `/extract` returns JSON immediately without DB write — allows frontend review/edit before confirm |
| **Single Vision LLM call** | Image + structured JSON in one call — faster, cheaper than multi-step OCR |
| **Bank-specific prompts in registry** | `llm/prompts/__init__.py` holds a `_REGISTRY` dict; `get_ocr_prompt(bank_code)` returns the right prompt — adding a new bank requires only a new file + one registry entry |
| **Shared LLM client** | `llm/client.py` is the single place that constructs `AsyncOpenAI` — never construct the client elsewhere |
| **Module-coherent URL namespace** | `/api/v1/credit-card/*`, `/api/v1/ap-invoice/*`, `/api/v1/carmen/*` (shared) — each segment names its domain, not the implementation era |
| **Carmen at top-level** | Carmen is a shared ERP proxy used by both credit card and AP invoice modules — nesting it under `/ocr/carmen` was wrong |
| **Color images preserved** | Vision LLM reads color better than grayscale |
| **Duplicate check on submitted only** | Allows editing before submit; duplicate check only applies to finalized (submitted_at NOT NULL) records |
| **AI-first mapping** | Mapping page auto-triggers AI suggest on bank selection |
| **localStorage caching** | Avoid re-fetching master data every step; user can modify offline |
| **Carmen proxy in backend** | `carmen.py` router + `carmen_service.py` — avoid frontend CORS issues, centralize authorization, SSRF protection |
| **Frontend path constants** | `src/lib/api/endpoints.ts` — all `/api/v1/*` paths in one place; adding a module = one new section, not scattered grep changes |
| **Safe migrations** | Supabase CLI owns the schema (`supabase/migrations/*.sql`, `supabase db push`) — files are append-only and idempotent; never edit applied files |
| **Background jobs in Postgres** | pg_cron + pg_partman own analytics/retention/billing sweeps — survives Render free-tier sleep; app-side has only the perf-log flush loop |
| **Service layer contract** | Services raise typed exceptions from `app/exceptions.py`, never `HTTPException` — global handler in `factory.py` maps to HTTP codes |
| **Soft delete everywhere** | Business tables never hard-delete; always filter `WHERE deleted_at IS NULL` |
