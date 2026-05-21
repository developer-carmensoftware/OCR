# Requirement Specification: Bank Receipt OCR & Import System Integration

**Project:** Bank Receipt OCR & Import System (API Integration)
**Date:** 9 April 2026
**Author:** Intern Team

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
| 1.7 | 08 Apr 2026 | Intern Team | Add GET /api/v1/ocr/carmen/gl-prefix endpoint for GL Prefix master data |
| 1.8 | 09 Apr 2026 | Intern Team | Fix GL Prefix response field name (PrefixName); /extract now accepts multiple files; remove bank_name from /suggest requests; add missing localStorage keys (ocr_wizard_state, filePrefix, fileSource) |
| 1.9 | 16 Apr 2026 | Intern Team | Major architecture restructure: LLM layer (app/llm/), Tool layer (app/tools/ + ToolResult + registry), Carmen router split, generic tools endpoint (/api/v1/tools/), frontend domain API split (lib/api/*), custom hooks (useToast, useModal) |
| 2.0 | 17 Apr 2026 | Intern Team | Correction Learning System: feedback router (/api/v1/feedback/correction), correction_feedback table, correction_service (ratio-based hints), prompt injection at extract time, diffCorrections/logCorrections on frontend |
| 2.1 | 20 Apr 2026 | Intern Team | Architecture refactor: backend models/ package split (enums/orm/schemas), useOcrWizard hook extracted from App.jsx, barrel files (index.js) per component domain, Home hub page; UI/UX redesign with IBM Plex Sans + indigo design system |
| 2.2 | 24 Apr 2026 | Intern Team | LLM usage tracking: add `token_hash` (SHA-256) and `bu_name` columns to `llm_usage_logs`; update `mapping_history` unique constraint to include dept_code + acc_code; `usage_service.log_llm_usage()` accepts `admin_token` + `bu_name` |

---

## 1. บทนำ (Introduction)

เอกสารฉบับนี้จัดทำขึ้นเพื่อกำหนดขอบเขตและความต้องการในการเชื่อมต่อระบบ (Interface Requirements) ระหว่างระบบ **Bank Receipt OCR System** และ **Carmen Cloud** ผ่านรูปแบบ RESTful API (JSON Format) โดยมีวัตถุประสงค์เพื่อลดขั้นตอนการทำงานซ้ำซ้อน (Double Entry) และเพิ่มความแม่นยำในการนำเข้าข้อมูลบัญชีรายวันจากรายงานของธนาคาร

## 2. ขอบเขตงาน (Scope of Work)

การเชื่อมต่อข้อมูลประกอบด้วย 5 ส่วนหลัก เรียงตามลำดับความสำคัญดังนี้:

1. **Outbound Interface - OCR Extraction**: ประมวลผลไฟล์ภาพหรือ PDF ผ่าน Vision LLM เพื่อดึงข้อมูลออกมาเป็นรูปแบบ JSON (Stateless Extraction)
2. **Inbound Interface - Master Data Sync**: แบคเอนด์ทำหน้าที่เป็น Proxy ดึงข้อมูลรหัสบัญชีและแผนกจาก Carmen Cloud เพื่อใช้ในการตั้งค่า Mapping
3. **Inbound Interface - AI Accounting Mapping**: ระบบ AI แนะนำรหัสบัญชีอัตโนมัติ พร้อมการบันทึกประวัติการแมปแยกตามธนาคารและประเภทการชำระเงิน
4. **Inbound Interface - Accounting Journal Review**: กระบวนการแสดง Journal Entry (Debit/Credit) และยืนยัน Journal Voucher ก่อน Submit
5. **Inbound Interface - Data Submission**: ส่งข้อมูลชุดสมบูรณ์ที่ผ่านการตรวจสอบแล้วบันทึกลงในฐานข้อมูล MySQL/MariaDB พร้อมการตรวจสอบการซ้ำซ้อน
6. **Correction Learning System**: บันทึกการแก้ไขของผู้ใช้ที่ submit time เพื่อเรียนรู้ pattern ที่ LLM มักจะอ่านผิด และนำไปใช้เพิ่ม hint ใน prompt ของธนาคารนั้นๆ โดยอัตโนมัติ

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
        OCR_R["📤 OCR Router<br/>(extract, submit)"]
        Map_R["🤖 Mapping Router<br/>(suggest, history)"]
        Carmen_R["🔁 Carmen Router<br/>(proxy)"]
        Tools_R["🛠️ Tools Router<br/>(agent invoke)"]
        FB_R["📝 Feedback Router<br/>(correction)"]
        Tools_L["⚙️ Tools Layer<br/>(extract, submit, map_gl)"]
        LLM_L["🧠 LLM Layer<br/>(client + prompt registry)"]
        CorrSvc["🔄 Correction Service<br/>(hints + ratio)"]
        DB["🗄️ MySQL/MariaDB<br/>(ocr_db)"]
    end

    subgraph External["☁️ External APIs"]
        direction TB
        OpenRouter["🧠 OpenRouter<br/>(Vision LLM)"]
        Carmen["📊 Carmen Cloud<br/>(Master Data)"]
    end

    User -->|Upload & Select| Frontend
    Frontend -->|REST API| Backend
    OCR_R -->|delegate| Tools_L
    OCR_R -->|get hints| CorrSvc
    Map_R -->|delegate| Tools_L
    Tools_R -->|invoke stateless tools| Tools_L
    Carmen_R -->|HTTP| Carmen
    FB_R -->|upsert correction| DB
    CorrSvc -->|query receipts + correction_feedback| DB
    Tools_L -->|call_text_llm / get_client| LLM_L
    LLM_L -->|LLM Call| OpenRouter
    Tools_L -->|read/write| DB
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
        UI->>BE: POST /api/v1/ocr/extract
        BE->>LLM: Send image for analysis
        LLM-->>BE: Extracted JSON
        BE-->>UI: Receipt header + details
    end

    rect rgb(56, 177, 136)
        Note over User,DB: STEP 2: Load Master Data
        UI->>UI: Go to Mapping page
        UI->>BE: GET /api/v1/ocr/carmen/account-codes
        UI->>BE: GET /api/v1/ocr/carmen/departments
        BE->>Carmen: Proxy request
        Carmen-->>BE: Account & Dept lists
        BE-->>UI: Cleaned master data
    end

    rect rgb(255, 153, 51)
        Note over User,DB: STEP 3: AI Suggest Mapping
        UI->>BE: POST /api/v1/mapping/suggest
        BE->>LLM: Suggest for 3 fields
        LLM-->>BE: Suggestions (Commission, Tax, Net)
        BE-->>UI: Display suggestions
        UI->>UI: Save to localStorage
    end

    rect rgb(218, 83, 83)
        Note over User,DB: STEP 4: Submit & Save
        UI->>BE: POST /api/v1/ocr/submit
        BE->>DB: Check doc_no duplicate
        BE->>DB: Save receipt + details
        DB-->>BE: Confirmed
        BE-->>UI: Success {receipt_id}
    end

    rect rgb(140, 90, 200)
        Note over User,DB: STEP 4 (post-submit): Log Corrections
        UI->>UI: diffCorrections(final vs original)
        UI->>BE: POST /api/v1/feedback/correction (per changed field)
        BE->>DB: INSERT ... ON DUPLICATE KEY UPDATE correction_feedback
    end
```

### 3.3 Sequence Diagram: API 1 - Extract OCR Data (Stateless + Hint Injection)

ขั้นตอนการส่งไฟล์เพื่อใช้ Vision LLM ในการอ่านข้อมูล พร้อมการ inject correction hints อัตโนมัติ

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant Router as OCR Router (FastAPI)
    participant CorrSvc as correction_service
    participant DB as MySQL/MariaDB
    participant Tool as tools/extract
    participant Prompts as llm/prompts
    participant Client as llm/client
    participant LLM as OpenRouter (Vision LLM)

    User->>Router: POST /api/v1/ocr/extract (files[], bank_type)
    activate Router

    Router->>CorrSvc: get_correction_hints(bank_type, db)
    CorrSvc->>DB: COUNT receipts submitted (bank, 90d)
    CorrSvc->>DB: COUNT corrections per field (bank, 90d)
    CorrSvc-->>Router: hints = {field: "rate"} if error_rate > 10%

    Router->>Tool: extract_stateless(file_bytes, bank_type, hints)
    activate Tool
    Tool->>Tool: preprocess_image() — Pillow resize, keep color
    Tool->>Prompts: get_ocr_prompt(bank_type, hints)
    Note right of Prompts: hints appended as CORRECTION NOTES<br/>if any field error_rate > 10%
    Prompts-->>Tool: bank-specific prompt + optional hints
    Tool->>Client: get_client()
    Client-->>Tool: AsyncOpenAI instance
    Tool->>LLM: vision call with base64 image + prompt
    activate LLM
    LLM-->>Tool: JSON Structured Data
    deactivate LLM
    Tool-->>Router: ExtractedReceiptData
    deactivate Tool
    Router-->>User: 200 OK (array of ExtractedReceiptData)
    deactivate Router
```

### 3.3a Sequence Diagram: Correction Learning — Log & Learn

ขั้นตอนการบันทึกการแก้ไขและเรียนรู้จาก pattern ที่ผิดซ้ำ

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant FB as Feedback Router
    participant DB as MySQL/MariaDB

    Note over User: User submits after editing fields in Step 3
    User->>User: diffCorrections(finalHeader, originalHeader, finalDetails, originalDetails)
    Note right of User: compares final submitted values vs<br/>LLM-extracted originals — returns diff list

    loop for each changed field
        User->>FB: POST /api/v1/feedback/correction<br/>{receipt_id: doc_no, bank_type, field_name, original_value, corrected_value}
        FB->>DB: INSERT ... ON DUPLICATE KEY UPDATE correction_feedback
        Note right of DB: UPSERT on (receipt_id, field_name)<br/>1 document + 1 field = 1 record
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

    UI->>API: GET /api/v1/ocr/carmen/account-codes
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

    UI->>API: GET /api/v1/ocr/carmen/departments
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
    participant DB as MySQL/MariaDB

    UI->>API: GET /api/v1/mapping/history?bank_name=SCB
    API->>DB: SELECT mapping_history WHERE bank_name='SCB'
    DB-->>API: Saved mappings (field_type, dept, acc, confirmed_count)
    API-->>UI: 200 OK (history map)

    UI->>API: POST /api/v1/mapping/suggest (accounts[], departments[])
    activate API
    API->>+MapTool: map_gl.suggest_fixed_fields(accounts, departments)
    MapTool->>PromptBuilder: build_fixed_fields_prompt(dept_lines, acc_lines, ...)
    PromptBuilder-->>MapTool: prompt string
    MapTool->>LLM: call_text_llm(prompt) via llm/client
    LLM-->>MapTool: {Commission, Tax Amount, Net Amount} → {dept, acc}
    MapTool-->>-API: ToolResult(suggestions)
    API-->>UI: 200 OK (suggestions, source: 'ai')
    deactivate API

    UI->>API: POST /api/v1/mapping/suggest-payment-types (payment_types[], accounts[], departments[])
    activate API
    API->>+MapTool: map_gl.suggest_payment_types(payment_types, accounts, departments)
    MapTool->>PromptBuilder: build_payment_types_prompt(types, dept_lines, acc_lines, ...)
    PromptBuilder-->>MapTool: prompt string
    MapTool->>LLM: call_text_llm(prompt) via llm/client
    LLM-->>MapTool: {VSA-P, MCA-INT-P, QR-VSA, ...} → {dept, acc}
    MapTool-->>-API: ToolResult(suggestions)
    API-->>UI: 200 OK (suggestions per type, source: 'ai')
    deactivate API

    UI->>API: POST /api/v1/mapping/history/save (bank_name, mappings)
    API->>DB: UPSERT mapping_history (increment confirmed_count)
    API-->>UI: 200 OK
```

### 3.7 Sequence Diagram: API 5 - Submit Validated Data

ขั้นตอนการบันทึกข้อมูลที่ผ่านการตรวจสอบแล้ว พร้อมตรวจสอบการซ้ำซ้อน

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant API as API Service (FastAPI)
    participant DB as MySQL/MariaDB

    User->>API: POST /api/v1/ocr/submit (SubmitPayload + Overwrite flag)
    activate API
    API->>DB: Check Duplicate doc_no (submitted receipts only)
    DB-->>API: Result (exists: bool)
    alt No Duplicate
        API->>DB: INSERT OCRTask (status=COMPLETED)
        API->>DB: INSERT Receipt (submitted_at=NOW)
        API->>DB: INSERT ReceiptDetail rows
        API-->>User: 200 OK {ok: true, receipt_id, doc_no, submitted_at}
    else Duplicate + Overwrite=false
        API-->>User: 200 OK {ok: false, error: DUPLICATE_DOC_NO}
    else Duplicate + Overwrite=true
        API->>DB: DELETE old receipt + details + task
        API->>DB: INSERT new OCRTask + Receipt + Details
        API-->>User: 200 OK {ok: true, receipt_id, doc_no, submitted_at}
    end
    deactivate API
```

---

## 4. ขั้นตอนการปฏิบัติงานของผู้ใช้งาน (User Operational Workflow)

### 4.1 กระบวนการนำเข้าข้อมูลรายวัน (5-Step OCR Wizard)

1. **Step 1 — Upload**: เจ้าหน้าที่เลือกธนาคาร (BBL/KBANK/SCB) และอัปโหลดไฟล์ภาพหรือ PDF
2. **Step 2 — Processing**: ระบบส่งไฟล์ให้ Vision LLM ประมวลผลและแสดงสถานะการอ่าน
3. **Step 3 — Verification**: เจ้าหน้าที่ตรวจสอบและแก้ไขข้อมูล Header (ชื่อเอกสาร, วันที่, เลขที่เอกสาร ฯลฯ) และรายการย่อย (Details)
4. **Step 4 — Accounting Review**: ระบบโหลด Account Mapping จาก localStorage และแสดง Journal Entry (Debit/Credit) พร้อมแจ้งเตือนหาก mapping ไม่ครบ (รวมถึง File Prefix)
5. **Step 5 — Journal Voucher**: แสดง JV สรุปรายการบัญชีทั้งหมด เจ้าหน้าที่ยืนยันก่อนบันทึกลงระบบ

### 4.2 กระบวนการตั้งค่า Account Mapping

1. เจ้าหน้าที่เข้าหน้า **Mapping** แล้วเลือกธนาคาร
2. ระบบ auto-fetch Carmen Account Codes + Departments และโหลดประวัติการแมปจาก DB
3. ระบบ auto-trigger AI Suggest เพื่อแนะนำรหัสบัญชีสำหรับ:
   - 3 fields หลัก: **Commission, Tax Amount, Net Amount**
   - ประเภทการชำระเงินทุกประเภทที่มีในสลิป (Visa, Mastercard, QR codes, ฯลฯ)
4. เจ้าหน้าที่ยืนยันหรือปรับแก้ mapping แต่ละรายการ
5. ระบบบันทึก mapping ลง DB (MappingHistory) และ localStorage

---

## 5. รายละเอียดและสเปกของ API (API Specifications)

### 5.1 API 1: Extract OCR Data (Stateless)

**วัตถุประสงค์**: ประมวลผลรูปภาพด้วย Vision LLM และส่งข้อมูลกลับทันที ไม่บันทึกลงฐานข้อมูล

**Method**: POST | **Endpoint**: `/api/v1/ocr/extract`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | Binary[] (multipart) | Yes | ไฟล์ภาพหรือ PDF หนึ่งไฟล์ขึ้นไป (max 20MB ต่อไฟล์) |
| `bank_type` | String (query) | Yes | รหัสธนาคาร: `BBL`, `KBANK`, `SCB` |

**JSON Response** (Array — หนึ่ง object ต่อไฟล์):
```json
[
  {
    "bank_name": "SCB",
    "bank_companyname": "ธนาคารไทยพาณิชย์ จำกัด (มหาชน)",
    "bank_tax_id": "0107536000791",
    "bank_address": "9 ถนนรัชดาภิเษก แขวงลาดยาว",
    "branch_no": "0001",
    "doc_name": "รายงานสรุปยอดขาย",
    "doc_no": "SCB-2026-00123",
    "doc_date": "08/04/2026",
    "company_name": "บริษัท ตัวอย่าง จำกัด",
    "company_tax_id": "0105555000001",
    "merchant_name": "EXAMPLE CO LTD",
    "merchant_id": "123456789",
    "wht_rate": "1",
    "wht_amount": "100.00",
    "net_amount": "9900.00",
    "details": [
      { "transaction": "VISA", "pay_amt": "5000.00", "commis_amt": "75.00", "tax_amt": "5.25", "total": "4919.75" },
      { "transaction": "MASTERCARD", "pay_amt": "5000.00", "commis_amt": "75.00", "tax_amt": "5.25", "total": "4919.75" }
    ]
  }
]
```

---

### 5.2 API 2: Get Account Codes from Carmen

**วัตถุประสงค์**: ดึงข้อมูลผังบัญชี (Chart of Accounts) สำหรับแสดงใน dropdown ของหน้า Mapping

**Method**: GET | **Endpoint**: `/api/v1/ocr/carmen/account-codes`

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

**Method**: GET | **Endpoint**: `/api/v1/ocr/carmen/departments`

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

**Method**: GET | **Endpoint**: `/api/v1/ocr/carmen/gl-prefix`

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

**Method**: POST | **Endpoint**: `/api/v1/mapping/suggest`

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

**Method**: POST | **Endpoint**: `/api/v1/mapping/suggest-payment-types`

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

### 5.6 API 4c: Load / Save Mapping History

**Load**: GET `/api/v1/mapping/history?bank_name=SCB`

```json
{
  "bank_name": "SCB",
  "history": {
    "Commission":  { "dept": "100", "acc": "551100", "confirmed_count": 5 },
    "Tax Amount":  { "dept": "100", "acc": "214100", "confirmed_count": 5 },
    "Net Amount":  { "dept": "100", "acc": "113200", "confirmed_count": 5 }
  }
}
```

**Save**: POST `/api/v1/mapping/history/save`

```json
{
  "bank_name": "SCB",
  "mappings": {
    "Commission": { "dept": "100", "acc": "551100" },
    "Net Amount":  { "dept": "100", "acc": "113200" }
  }
}
```

---

### 5.7 API 5: Submit Final Data

**วัตถุประสงค์**: บันทึกข้อมูลที่ผ่านการตรวจสอบแล้วลงฐานข้อมูล (OCRTask + Receipt + ReceiptDetails)

**Method**: POST | **Endpoint**: `/api/v1/ocr/submit`

**JSON Request**:
```json
{
  "BankType": "SCB",
  "Header": {
    "DocNo": "SCB-2026-00123",
    "DocDate": "08/04/2026",
    "BankName": "SCB",
    "DocName": "รายงานสรุปยอดขาย",
    "CompanyName": "บริษัท ตัวอย่าง จำกัด",
    "CompanyTaxId": "0105555000001",
    "MerchantName": "EXAMPLE CO LTD",
    "MerchantId": "123456789",
    "WhtRate": "1",
    "WhtAmount": "100.00",
    "NetAmount": "9900.00"
  },
  "Details": [
    { "Transaction": "VISA", "PayAmt": 5000, "CommisAmt": 75, "TaxAmt": 5.25, "Total": 4919.75 }
  ],
  "Overwrite": false
}
```

**JSON Response (success)**:
```json
{
  "ok": true,
  "receipt_id": 42,
  "doc_no": "SCB-2026-00123",
  "submitted_at": "2026-04-08T10:30:00Z"
}
```

**JSON Response (duplicate)**:
```json
{
  "ok": false,
  "error": "DUPLICATE_DOC_NO",
  "message": "เลขที่เอกสาร SCB-2026-00123 มีอยู่แล้วในระบบ"
}
```

---

### 5.8 API 6: List OCR Tasks (Paginated)

**วัตถุประสงค์**: ดึงรายการ OCR tasks ทั้งหมดพร้อมข้อมูล pagination

**Method**: GET | **Endpoint**: `/api/v1/ocr/tasks`

**Query Parameters**:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `skip` | Integer | 0 | จำนวน records ที่ข้าม |
| `limit` | Integer | 50 | จำนวน records ที่ต้องการ |

**JSON Response**:
```json
{
  "items": [
    {
      "id": 1,
      "original_filename": "receipt_001.jpg",
      "status": "completed",
      "created_at": "2026-04-08T10:30:00Z"
    }
  ],
  "total": 100,
  "skip": 0,
  "limit": 50
}
```

---

### 5.9 API 7: Get Single Task Detail

**วัตถุประสงค์**: ดึงข้อมูลเอกสารแบบละเอียด (task + receipt + details)

**Method**: GET | **Endpoint**: `/api/v1/ocr/tasks/{id}`

**JSON Response**:
```json
{
  "task_id": 42,
  "original_filename": "receipt_001.jpg",
  "status": "completed",
  "receipt": {
    "id": 42,
    "bank_name": "SCB",
    "bank_type": "SCB",
    "doc_no": "SCB-2026-00123",
    "doc_date": "2026-04-08",
    "company_name": "บริษัท ตัวอย่าง จำกัด",
    "company_tax_id": "0105555000001",
    "merchant_name": "EXAMPLE CO LTD",
    "merchant_id": "123456789",
    "wht_rate": "1",
    "wht_amount": "100.00",
    "net_amount": "9900.00",
    "submitted_at": "2026-04-08T10:30:00Z"
  },
  "details": [
    { "id": 1, "transaction": "VISA", "pay_amt": "5000.00", "commis_amt": "75.00", "tax_amt": "5.25", "total": "4919.75" }
  ]
}
```

---

### 5.10 API 8: Mark Receipt as Submitted

**วัตถุประสงค์**: อัปเดตสถานะของใบเสร็จเป็น "submitted" (ใช้ callback หรือ manual mark)

**Method**: PATCH | **Endpoint**: `/api/v1/ocr/receipts/{id}/submit`

**JSON Response**:
```json
{
  "ok": true,
  "receipt_id": 42,
  "submitted_at": "2026-04-08T10:35:00Z"
}
```

---

### 5.11 API 9: Debug LLM Response

**วัตถุประสงค์**: ดู raw JSON response จากครั้งสุดท้ายที่เรียก Vision LLM (สำหรับ troubleshooting)

**Method**: GET | **Endpoint**: `/api/v1/ocr/debug-llm`

**JSON Response**:
```json
{
  "last_llm_response": {
    "bank_name": "SCB",
    "bank_companyname": "ธนาคารไทยพาณิชย์ จำกัด (มหาชน)",
    "details": [...]
  },
  "timestamp": "2026-04-08T10:30:00Z"
}
```

---

### 5.13 API 11a: Generic Tools — List / Schema / Invoke

**วัตถุประสงค์**: ให้ LLM Agent เรียกใช้ stateless tools โดยตรงโดยไม่ต้องรู้ path เฉพาะ

#### List All Tools

**Method**: GET | **Endpoint**: `/api/v1/tools`

**JSON Response**:
```json
{
  "tools": [
    {
      "name": "extract_receipt",
      "description": "Extract structured data from a bank receipt image using Vision LLM",
      "input_schema": { "file_bytes": "bytes", "filename": "str", "bank_type": "str?" },
      "invocable": false
    },
    {
      "name": "suggest_gl_fixed_fields",
      "description": "LLM-suggest GL account/dept codes for Commission, Tax Amount, Net Amount",
      "input_schema": { "accounts": "list[{code, name, type?}]", "departments": "list[{code, name}]" },
      "invocable": true
    }
  ],
  "count": 4
}
```

#### Get Tool Schema

**Method**: GET | **Endpoint**: `/api/v1/tools/{name}`

#### Invoke a Tool

**Method**: POST | **Endpoint**: `/api/v1/tools/{name}`

**JSON Request** (keys must match `input_schema`):
```json
{
  "accounts": [{ "code": "113200", "name": "BANK RECEIVABLE", "type": "DEBIT" }],
  "departments": [{ "code": "100", "name": "ACCOUNTING" }]
}
```

**JSON Response** (ToolResult):
```json
{
  "success": true,
  "tool": "suggest_gl_fixed_fields",
  "input": { "accounts": [...], "departments": [...] },
  "output": { "Commission": { "dept": "100", "acc": "551100" }, ... },
  "metadata": {},
  "errors": []
}
```

> `extract_receipt` และ `submit_receipt` ต้อง injected dependencies (bytes / DB session) — ระบบจะ block พร้อม HTTP 400 `invocable: false`

---

### 5.14 API 12: Log Correction Feedback

**วัตถุประสงค์**: บันทึกการแก้ไขของผู้ใช้เพื่อใช้ปรับปรุง LLM prompt ในอนาคต (เรียกที่ submit time โดย `diffCorrections`)

**Method**: POST | **Endpoint**: `/api/v1/feedback/correction`

**JSON Request**:
```json
{
  "receipt_id": "SCB-2026-00123",
  "bank_type": "SCB",
  "field_name": "merchant_name",
  "original_value": "EXAMPLE CO",
  "corrected_value": "EXAMPLE CO LTD"
}
```

> `field_name` ใช้ชื่อ snake_case ตรงกับ LLM prompt field (เช่น `merchant_name`, `doc_no`, `pay_amt`) — frontend จะ map จาก PascalCase ผ่าน `FIELD_NAME_MAP` ใน `feedback.js`

**JSON Response**:
```json
{
  "id": 42,
  "receipt_id": "SCB-2026-00123",
  "bank_type": "SCB",
  "field_name": "merchant_name",
  "original_value": "EXAMPLE CO",
  "corrected_value": "EXAMPLE CO LTD",
  "created_at": "2026-04-17T10:30:00"
}
```

**กรณี skip** (original == corrected): คืน `id: -1`, `created_at: null` — ไม่บันทึกลง DB

**UPSERT behavior**: ใช้ `INSERT ... ON DUPLICATE KEY UPDATE` — unique constraint คือ `(receipt_id, field_name)` — 1 เอกสาร + 1 field = 1 record เสมอ

---

### 5.15 API 11: Health Check

**วัตถุประสงค์**: ตรวจสอบสถานะ API และฐานข้อมูล

**Method**: GET | **Endpoint**: `/api/v1/ocr/health`

**JSON Response (healthy)**:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-04-08T10:30:00Z"
}
```

---

## 6. โครงสร้างฐานข้อมูล (Database Schema)

ระบบใช้ **MySQL/MariaDB** ผ่าน `aiomysql` (async) โดยมี 6 ตาราง:

### 6.1 Table: `ocr_tasks`

**ความหมาย**: Metadata ของการประมวลผลแต่ละไฟล์

| Column | Type | Key | Null | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INT | PK | NO | AUTO_INCREMENT | Task ID |
| `original_filename` | VARCHAR(255) | | NO | | ชื่อไฟล์ที่อัปโหลด |
| `status` | ENUM('pending','processing','completed','failed') | | NO | pending | สถานะการประมวลผล |
| `created_at` | TIMESTAMP | | NO | CURRENT_TIMESTAMP | เวลาสร้าง |

---

### 6.2 Table: `receipts`

**ความหมาย**: ข้อมูล Header ของเอกสาร (1 รายการต่อ task)

| Column | Type | Key | Null | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INT | PK | NO | AUTO_INCREMENT | Receipt ID |
| `task_id` | INT | FK | YES | | Reference ไปยัง ocr_tasks |
| `bank_name` | VARCHAR(50) | | NO | | ชื่อธนาคาร (BBL, KBANK, SCB) |
| `bank_type` | VARCHAR(50) | | NO | | ประเภทธนาคาร |
| `doc_no` | VARCHAR(100) | IDX | NO | | เลขที่เอกสาร (unique per submission) |
| `doc_date` | DATE | | NO | | วันที่เอกสาร |
| `doc_name` | VARCHAR(255) | | YES | | ชื่อเอกสาร |
| `company_name` | VARCHAR(255) | | YES | | ชื่อบริษัท |
| `company_tax_id` | VARCHAR(50) | | YES | | เลขประจำตัวผู้เสียภาษี |
| `company_address` | TEXT | | YES | | ที่อยู่บริษัท |
| `merchant_name` | VARCHAR(255) | | YES | | ชื่อผู้ค้า |
| `merchant_id` | VARCHAR(100) | | YES | | ID ผู้ค้า |
| `account_no` | VARCHAR(100) | | YES | | เลขบัญชี |
| `bank_companyname` | VARCHAR(255) | | YES | | ชื่อบริษัท (จากธนาคาร) |
| `bank_tax_id` | VARCHAR(50) | | YES | | เลขประจำตัว (จากธนาคาร) |
| `bank_address` | VARCHAR(255) | | YES | | ที่อยู่ (จากธนาคาร) |
| `branch_no` | VARCHAR(50) | | YES | | หมายเลขสาขา |
| `wht_rate` | DECIMAL(5,2) | | YES | 0 | อัตราหักภาษี ณ ที่จ่าย (%) |
| `wht_amount` | DECIMAL(15,2) | | YES | 0 | จำนวนเงินหักภาษี |
| `net_amount` | DECIMAL(15,2) | | YES | 0 | จำนวนเงินสุทธิ |
| `submitted_at` | TIMESTAMP | IDX | YES | NULL | เวลา submit (NULL = ยังไม่ submit) |
| `created_at` | TIMESTAMP | | NO | CURRENT_TIMESTAMP | เวลาสร้าง |
| `updated_at` | TIMESTAMP | | NO | CURRENT_TIMESTAMP | เวลาแก้ไขล่าสุด |

---

### 6.3 Table: `receipt_details`

**ความหมาย**: รายการย่อยของการชำระเงิน (หลายรายการต่อ receipt)

| Column | Type | Key | Null | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INT | PK | NO | AUTO_INCREMENT | Detail ID |
| `receipt_id` | INT | FK | NO | | Reference ไปยัง receipts |
| `transaction` | VARCHAR(100) | | YES | | ประเภทการชำระเงิน (VISA, MCA, QR, ฯลฯ) |
| `pay_amt` | DECIMAL(15,2) | | YES | 0 | จำนวนเงินชำระ |
| `commis_amt` | DECIMAL(15,2) | | YES | 0 | จำนวนคณะกรรมการ |
| `tax_amt` | DECIMAL(15,2) | | YES | 0 | จำนวนภาษี |
| `wht_amount` | DECIMAL(15,2) | | YES | 0 | จำนวนเงินหักภาษี |
| `total` | DECIMAL(15,2) | | YES | 0 | รวมทั้งสิ้น |
| `created_at` | TIMESTAMP | | NO | CURRENT_TIMESTAMP | เวลาสร้าง |

---

### 6.4 Table: `mapping_history`

**ความหมาย**: ประวัติการแมปรหัสบัญชีแยกตามธนาคารและประเภทฟิลด์

| Column | Type | Key | Null | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INT | PK | NO | AUTO_INCREMENT | History ID |
| `bank_name` | VARCHAR(50) | IDX | NO | | ชื่อธนาคาร |
| `field_type` | VARCHAR(100) | | NO | | ประเภทฟิลด์ (Commission, Tax Amount, Net Amount, VSA-P, ฯลฯ) |
| `dept_code` | VARCHAR(50) | | YES | | รหัสแผนก (Department Code) |
| `acc_code` | VARCHAR(50) | | YES | | รหัสบัญชี (Account Code) |
| `confirmed_count` | INT | | NO | 1 | จำนวนครั้งที่ยืนยัน (เพิ่มครั้งละ 1 เมื่อ save) |
| `updated_at` | TIMESTAMP | | NO | CURRENT_TIMESTAMP | เวลาแก้ไขล่าสุด |

**Unique Constraint**: `(bank_name, field_type, dept_code, acc_code)` — 1 bank + 1 field + 1 dept + 1 acc = 1 record (รองรับหลาย choice ต่อ field_type)

---

### 6.5 Table: `correction_feedback`

**ความหมาย**: บันทึกการแก้ไขที่ผู้ใช้ทำในแต่ละ field เพื่อใช้คำนวณ error rate และ inject hints เข้า prompt

| Column | Type | Key | Null | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK | NO | AUTO_INCREMENT | Correction ID |
| `receipt_id` | VARCHAR(100) | IDX | NO | | เก็บ `doc_no` ของเอกสาร (ไม่ใช่ FK เพราะ log ที่ submit time) |
| `bank_type` | VARCHAR(50) | IDX | NO | | รหัสธนาคาร (BBL/KBANK/SCB) |
| `field_name` | VARCHAR(100) | IDX | NO | | ชื่อ field ที่ถูกแก้ (snake_case ตรงกับ LLM prompt) |
| `original_value` | TEXT | | YES | | ค่าที่ LLM อ่านได้ (ก่อนแก้) |
| `corrected_value` | TEXT | | YES | | ค่าที่ผู้ใช้แก้ไขเป็น |
| `created_at` | DATETIME | IDX | NO | CURRENT_TIMESTAMP | เวลาที่บันทึก |

**Unique Constraint**: `(receipt_id, field_name)` — 1 เอกสาร + 1 field = 1 record เสมอ (UPSERT)

**การใช้งาน** — `correction_service.get_correction_hints(bank_type)`:

- นับ `submitted receipts` ของธนาคารนั้นใน 90 วัน → denominator
- นับ `corrections per field` ใน 90 วัน → numerator
- `error_rate = corrections / receipts` → hint ถ้า > 10% และมี receipts >= 10 ใบ

---

### 6.6 Table: `llm_usage_logs`

**ความหมาย**: บันทึก token usage ของทุก LLM call สำหรับติดตามค่าใช้จ่ายและการใช้งานแยกตาม admin token และ Business Unit

| Column | Type | Key | Null | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK | NO | AUTO_INCREMENT | Log ID |
| `task_id` | VARCHAR(36) | FK | YES | NULL | Reference ไปยัง ocr_tasks (NULL สำหรับ mapping/AP calls) |
| `usage_type` | VARCHAR(50) | | YES | NULL | ประเภทการเรียก: `BANK_OCR`, `AP_INVOICE`, `MAPPING_SUGGESTION` |
| `model` | VARCHAR(100) | | NO | | OpenRouter model ID |
| `prompt_tokens` | INT | | NO | 0 | จำนวน prompt tokens |
| `completion_tokens` | INT | | NO | 0 | จำนวน completion tokens |
| `total_tokens` | INT | | NO | 0 | รวม tokens |
| `token_hash` | VARCHAR(64) | IDX | YES | NULL | SHA-256 ของ adminToken — ใช้ติดตาม usage ต่อ token โดยไม่เก็บ credential ดิบ |
| `bu_name` | VARCHAR(100) | IDX | YES | NULL | Business Unit name |
| `created_at` | DATETIME | IDX | NO | CURRENT_TIMESTAMP | เวลาที่บันทึก |

**หมายเหตุ**: `token_hash` คำนวณโดย `usage_service._hash_token(admin_token)` — caller ส่ง raw token มา, service hash ก่อนบันทึก

**Query รายงาน usage ต่อ token/BU**:

```sql
SELECT token_hash, bu_name, COUNT(*) AS calls, SUM(total_tokens) AS total_tokens
FROM llm_usage_logs
GROUP BY token_hash, bu_name
ORDER BY total_tokens DESC;
```

---

## 7. การตั้งค่าสภาพแวดล้อม (Environment Configuration)

ไฟล์ `.env` จะต้องอยู่ใน `backend/` directory และไม่ควร commit ไปยัง git

### 7.1 Backend `.env` Variables

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SUGGESTION_MODEL=google/gemini-2.0-flash-lite
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Database Configuration
DATABASE_URL=mysql+aiomysql://root:password@localhost:3306/ocr_db

# File Upload Configuration
MAX_FILE_SIZE_MB=20

# API Configuration
APP_PORT=8010

# Carmen Cloud Integration
CARMEN_AUTHORIZATION=Bearer <token>
CARMEN_BASE_URL=https://carmen.example.com
```

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | Yes | - | API key สำหรับ OpenRouter Vision LLM |
| `OPENROUTER_OCR_MODEL` | No | google/gemini-2.5-flash-lite | Model สำหรับ OCR extraction |
| `OPENROUTER_SUGGESTION_MODEL` | No | google/gemini-2.0-flash-lite | Model สำหรับ AI suggestion |
| `OPENROUTER_BASE_URL` | No | [https://openrouter.ai/api/v1](https://openrouter.ai/api/v1) | Base URL ของ OpenRouter |
| `DATABASE_URL` | Yes | - | Connection string ไปยัง MySQL/MariaDB |
| `MAX_FILE_SIZE_MB` | No | 20 | ขนาดไฟล์สูงสุด (MB) |
| `APP_PORT` | No | 8010 | Port ของ FastAPI server |
| `CARMEN_AUTHORIZATION` | Yes | - | Bearer token สำหรับ Carmen API |
| `CARMEN_BASE_URL` | Yes | - | Base URL ของ Carmen Cloud |

---

## 8. ข้อกำหนดอื่นๆ (Non-Functional Requirements)

1. **Authentication**: การเชื่อมต่อ Carmen API ต้องผ่าน `Authorization` header ของแบคเอนด์เท่านั้น ห้าม frontend เรียกตรง
2. **Duplicate Prevention**: ระบบต้องตรวจสอบ `doc_no` ซ้ำก่อน submit ทุกครั้ง โดยเปรียบเทียบเฉพาะ receipt ที่มี `submitted_at IS NOT NULL`
3. **Overwrite Capability**: เมื่อ `Overwrite=true` ระบบต้องลบ record เดิมทั้งหมดก่อนสร้างใหม่ (hard delete)
4. **Data Mapping Cache**: ระบบเก็บ mapping config ใน localStorage (`accountingConfig`, `accountMappingAmount`) เพื่อให้ใช้ซ้ำได้โดยไม่ต้อง re-fetch ทุกครั้ง
5. **Error Reporting**: กรณีเกิดข้อผิดพลาด (422) แบคเอนด์ต้องส่งรายละเอียดสาเหตุเพื่อแสดงผลใน `CustomModal`
6. **Performance**: API Master Data (Carmen Proxy) ต้องตอบสนองไม่เกิน 3 วินาที; AI Suggest ไม่เกิน 10 วินาที
7. **Safe Migration**: `migrate_db()` ต้องทำงาน idempotent — ไม่เกิด error เมื่อ column มีอยู่แล้ว
8. **Color Image Processing**: ห้ามแปลงภาพเป็น grayscale ก่อนส่ง Vision LLM เพราะลดความแม่นยำในการอ่าน
9. **File Size Limit**: ไฟล์ต้องมีขนาดไม่เกิน 20 MB ต่อไฟล์; รองรับ JPG, PNG, BMP, WebP, GIF, PDF

---

## 9. ธนาคารและไฟล์ที่รองรับ (Supported Banks & File Types)

### 9.1 ธนาคารที่รองรับ

| Bank Code | Bank Name | BankType Enum |
| :--- | :--- | :--- |
| `BBL` | ธนาคารกรุงเทพ | BBL |
| `KBANK` | ธนาคารกสิกรไทย | KBANK |
| `SCB` | ธนาคารไทยพาณิชย์ | SCB |

แต่ละธนาคารมี **bank-specific extraction prompts** ใน `backend/app/llm/prompts/<bank>.py` เพื่อปรับปรุงความแม่นยำ — เพิ่มธนาคารใหม่ได้โดยสร้างไฟล์ใหม่ + ลงทะเบียนใน `llm/prompts/__init__.py`

### 9.2 ประเภทไฟล์ที่รองรับ

**รูปภาพ**:

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- BMP (`.bmp`)
- WebP (`.webp`)
- GIF (`.gif`)

**เอกสาร**:

- PDF (`.pdf`) — แสดงผ่าน iframe preview

**ข้อจำกัด**:

- ขนาดไฟล์สูงสุด: **20 MB** ต่อไฟล์
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

`backend/app/models.py` ถูก refactor เป็น `backend/app/models/` package เพื่อรองรับการขยาย:

| File | Contents |
| :--- | :--- |
| `app/models/__init__.py` | Re-exports ทุก symbol เพื่อ backward compatibility (`from app.models import X` ยังใช้ได้) |
| `app/models/enums.py` | `TaskStatus`, `BankType` enums |
| `app/models/orm.py` | SQLAlchemy ORM classes: `OCRTask`, `Receipt`, `ReceiptDetail`, `MappingHistory`, `CorrectionFeedback`, `LLMUsageLog` |
| `app/models/schemas.py` | Pydantic schemas: `ExtractedReceiptData`, `OCRTaskResponse`, `ReceiptSchema`, ฯลฯ |

### 10.2 Key Frontend Files

**API Layer** (`src/lib/api/`) — import directly from these files:

| File | Exported Functions |
| :--- | :--- |
| `src/lib/api/ocr.js` | `extractFromFile()`, `markSubmitted()` |
| `src/lib/api/submit.js` | `submitToLocal()` |
| `src/lib/api/carmen.js` | `fetchAccountCodes()`, `fetchDepartments()`, `fetchGLPrefixes()`, `submitToCarmen()` |
| `src/lib/api/mapping.js` | `suggestMapping()`, `suggestPaymentTypes()`, `fetchMappingHistory()`, `saveMappingHistory()` |

> `src/lib/ocrApi.js` และ `src/lib/carmenApi.js` ยังคงอยู่เป็น re-export wrapper เพื่อ backward compat — new code ควร import จาก `lib/api/*` โดยตรง

**Hooks** (`src/hooks/`):

| File | Purpose |
| :--- | :--- |
| `src/hooks/useOcrWizard.js` | All wizard state + handlers extracted from App.jsx — exposes step, bank, files, headerData, details, jvRows, toasts, modal, and all handlers |
| `src/hooks/useToast.js` | `useToast()` → `{ toasts, showToast(msg, type) }` — auto-dismiss 3.5s |
| `src/hooks/useModal.js` | `useModal()` → `{ modal, showModal(config), closeModal() }` |

**App & Pages**:

| File | Role |
| :--- | :--- |
| `src/App.jsx` | Thin render shell (~115 lines) — imports `useOcrWizard`, renders step JSX only |
| `src/pages/Home.jsx` | Landing hub page — links to OCR wizard and Mapping |
| `src/constants/index.js` | `BANKS`, `BANK_THAI_NAMES`, `detectBankFromCompanyName()`, `DETAIL_COLUMNS`, `HEADER_LABELS`, `DETAIL_LABELS`, `EMPTY_DETAIL_ROW` |
| `src/pages/Mapping.jsx` | Account mapping configuration page |

**Component Barrel Files** (ใช้ grouped imports แทน per-file imports):

| Barrel | Exports |
| :--- | :--- |
| `src/components/common/index.js` | `StepWizard`, `FormActions`, `CustomModal`, `CustomSearchSelect` |
| `src/components/ocr/index.js` | `UploadSection`, `ActionBar`, `HeaderCard`, `DetailTable`, `DocumentPreview` |
| `src/components/accounting/index.js` | `AccountingReview`, `JournalVoucher`, `InputTaxReconciliation` |

### 10.3 CSS Architecture & Design System

ระบบใช้ layered CSS (plain CSS, no Tailwind) แบ่งเป็น 4 ระดับ:

| File | Role |
| :--- | :--- |
| `src/styles/base.css` | Design tokens (CSS variables), resets, keyframe animations, utility classes |
| `src/styles/layout.css` | App container, header, main grid, responsive breakpoints |
| `src/styles/components.css` | All reusable components: buttons, cards, tables, modals, step wizard, toast |
| `src/styles/pages/home.css` | Home hub page styles |
| `src/styles/pages/mapping.css` | Mapping page styles |

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
  - `ocr_wizard_state`: state ของ OCR wizard — bank ที่เลือก, details ที่สแกนได้ (ใช้โดย Mapping page เพื่อตรวจสอบ active scan)

---

## 11. Key Design Decisions (Design Rationale)

| Decision | Reason |
| :--- | :--- |
| **Stateless extraction** | `/extract` returns JSON immediately without DB write — allows frontend review/edit before confirm |
| **Single Vision LLM call** | Image + structured JSON in one call — faster, cheaper than multi-step OCR |
| **Bank-specific prompts in registry** | `llm/prompts/__init__.py` holds a `_REGISTRY` dict; `get_ocr_prompt(bank_type)` returns the right prompt — adding a new bank requires only a new file + one registry entry |
| **Shared prompt fragments** | `_shared.py` exports `ROW_RULES` / `OUTPUT_RULES`; all bank prompts append them — reduces duplication and ensures consistency |
| **Shared LLM client** | `llm/client.py` is the single place that constructs `AsyncOpenAI` — never construct the client elsewhere |
| **Tool-first architecture** | Business logic lives in `app/tools/`; routers are thin HTTP wrappers; every tool returns `ToolResult` for uniform handling |
| **Generic tools endpoint** | `POST /api/v1/tools/{name}` lets an LLM agent call stateless tools by name — tools needing DB session or file bytes are blocked (`_REQUIRES_INJECTION`) |
| **Color images preserved** | Vision LLM reads color better than grayscale |
| **Duplicate check on submitted only** | Allows editing before submit; duplicate check only applies to finalized (submitted_at NOT NULL) receipts |
| **Overwrite support** | Hard delete old record + re-insert on Overwrite=true (atomic operation) |
| **AI-first mapping** | Mapping page auto-triggers AI suggest on bank selection; history is loaded but AI always runs |
| **localStorage caching** | Avoid re-fetching master data every step; user can modify offline |
| **Carmen proxy in backend** | Separate `carmen.py` router + `carmen_service.py` — avoid frontend CORS issues, centralize authorization |
| **Frontend domain API split** | `lib/api/*` separates OCR / Carmen / Mapping / Submit concerns — `ocrApi.js` and `carmenApi.js` kept as backward-compat re-exports |
| **Safe migrations** | `migrate_db()` idempotent — runs on startup, adds missing columns safely |
