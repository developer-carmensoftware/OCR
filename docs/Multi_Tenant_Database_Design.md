# Multi-Tenant Database Design

ระบบใช้รูปแบบ **Single Database, Multi-Tenant via Columns** — ทุก tenant ใช้ database เดียวกัน (`carmen_ai`) และแยกข้อมูลด้วย column `bu` และ `host`

---

## แนวคิดหลัก

```
carmen_ai/              ← database เดียวสำหรับทุกคน
  ocr_tasks             ← มี bu + host column
  credit_cards          ← มี bu column
  ap_invoices           ← มี bu + host column
  audit_logs            ← มี bu + host column
  llm_usage_logs        ← มี bu_name + host column
  mapping_history       ← มี bu column (isolated per tenant)
  correction_feedback   ← มี bu column (isolated per tenant)
  performance_logs      ← มี bu column
  outbound_call_logs    ← มี bu column
  ocr_sessions          ← มี bu + carmen_uri column
  bu_usage              ← มี bu_name + host column
  daily_usage_summary   ← มี bu column
  ...
```

ไม่มี database แยกต่อ tenant — isolation อยู่ที่ `bu` และ `host` column

---

## Hierarchy การกรองข้อมูล

```
ostin.carmenwork.com  (host — ระดับลูกค้า)
  └── ostionwest      (bu — ระดับ Business Unit / tenant)
        └── jitra     (user_id — ระดับผู้ใช้)
```

| Parameter | มาจาก | เก็บใน column | ใช้กรอง |
| --- | --- | --- | --- |
| `host` | `urlparse(uri).hostname` | `host` | ระดับลูกค้า |
| `bu` | URL param `?bu=` | `bu` | ระดับ Business Unit |
| `user_id` | extract จาก token | `user_id` | ระดับผู้ใช้ |

---

## URL ที่รองรับ

```
https://ostin.carmenwork.com/ocr/#/APinvoice?token=...&bu=ostionwest&user=jitra&uri=https://ostin.carmenwork.com
https://dev.carmen4.com/ocr/#/CreditCardOCR?token=...&bu=carmenCloud&user=somchai&uri=https://dev.carmen4.com
```

ทุก domain ทำงานได้ — ไม่ต้องแก้ config ใดๆ เพราะ URI มาจาก query param โดยตรง

---

## Request Flow

```
1. User เข้ามาพร้อม URL params (token, bu, user, uri)
        ↓
2. useCarmenSSO.js อ่าน params → POST /api/v1/auth/exchange
        ↓
3. auth.py exchange_sso_token()
   - validate uri (SSRF check)
   - validate token กับ {uri}/Carmen.API/...
   - ensure_db()  → CREATE DATABASE IF NOT EXISTS carmen_ai (idempotent)
   - เก็บ OcrSession { bu, carmen_uri, carmen_token_encrypted }
   - ออก JWT { bu, tenant=bu.lower(), carmen_uri }
        ↓
4. PerformanceMiddleware (ทุก request)
   decode JWT → current_bu, current_host, current_carmen_uri
        ↓
5. get_current_session() (authenticated routes)
   อ่านจาก JWT+DB → set context vars ทั้งหมด
        ↓
6. Services เขียนข้อมูลพร้อม bu + host
   async_session() → session สำหรับ carmen_ai
        ↓
7. Carmen API calls: _base_url() = "{carmen_uri}/Carmen.API/api/interface"
```

---

## Engine

```python
# database.py — single engine สำหรับ carmen_ai
_ENGINE = create_async_engine(
    "mysql+aiomysql://root:password@localhost:3306/carmen_ai",
    pool_size=10,
    max_overflow=20,
)
```

Connection pool เดียว ใช้ร่วมกันทุก tenant — ง่ายต่อการ monitor และ tune

---

## โครงสร้าง Tables

| Table | bu | host | หมายเหตุ |
| --- | --- | --- | --- |
| `ocr_tasks` | ✓ | ✓ | anchor record ของทุก workflow |
| `credit_cards` | ✓ | — | join ผ่าน task_id |
| `ap_invoices` | ✓ | ✓ | |
| `ocr_sessions` | ✓ | — | มี `carmen_uri` แทน |
| `audit_logs` | ✓ | ✓ | |
| `llm_usage_logs` | ✓ (bu_name) | ✓ | |
| `mapping_history` | ✓ | — | unique ต่อ (bu, bank, field) |
| `correction_feedback` | ✓ | — | unique ต่อ (bu, doc_no, field) |
| `performance_logs` | ✓ | — | |
| `outbound_call_logs` | ✓ | — | |
| `daily_usage_summary` | ✓ | — | unique ต่อ (bu, date) |
| `bu_usage` | ✓ (PK) | ✓ | rate limit ต่อ BU |

---

## Provisioning

```python
# สร้าง DB (เรียกอัตโนมัติตอน startup และตอน login ครั้งแรก)
await ensure_db()

# backward-compat alias (tenant param ถูก ignore แล้ว)
await provision_tenant("anything")  # → เรียก ensure_db()
```

`ensure_db()` ทำ:

1. `CREATE DATABASE IF NOT EXISTS carmen_ai`
2. `Base.metadata.create_all()` — สร้างทุก table
3. `migrate_db()` — apply pending migrations

---

## Migration System

```python
_MIGRATIONS = [
    ("001_receipt_columns",       None),   # legacy stub
    ...
    ("021_remove_tenant_columns", _m021),  # ลบ tenant column จาก shared-schema เดิม
    ("022_...",                   _m022),
    ("023_create_bu_usage",       _m023),
    ("024_add_session_carmen_uri",_m024),
    ("025_add_bu_host_columns",   _m025),  # เพิ่ม bu/host ทุก table (migration นี้)
]
```

**กฎ:** เพิ่ม migration ท้ายสุดเสมอ — runner mark applied ทีละ entry ใน `schema_migrations` table

---

## Data Retention

Scheduler รันทุกคืน — ตอนนี้ทำงานบน carmen_ai โดยตรง (ไม่มี loop ต่อ tenant แล้ว)

| Table | เก็บไว้ | Archive |
|---|---|---|
| `performance_logs` | 90 วัน | CSV → `archives/performance_logs/YYYY-MM.csv` |
| `outbound_call_logs` | 90 วัน | CSV → `archives/outbound_call_logs/YYYY-MM.csv` |
| `llm_usage_logs` | 365 วัน | CSV → `archives/llm_usage_logs/YYYY-MM.csv` |
| `audit_logs` | 365 วัน | CSV → `archives/audit_logs/YYYY-MM.csv` |
| `ocr_sessions` (inactive) | 30 วัน | ลบทิ้ง |

---

## เพิ่ม Table ใหม่

1. เพิ่ม ORM model ใน `models/orm.py` — ใส่ `bu` และ `host` column ถ้าเป็น data table
2. เพิ่ม migration function ใน `database.py` และ register ใน `_MIGRATIONS`
3. ถ้าเป็น log table ให้เพิ่มเข้า `RETENTION_POLICY`
4. `ensure_db()` จะสร้าง table ให้อัตโนมัติตอน startup

---

## Dashboard Queries (ตัวอย่าง)

```sql
-- ดู usage ของลูกค้า ostin.carmenwork.com
SELECT bu, COUNT(*) FROM ocr_tasks
WHERE host = 'ostin.carmenwork.com'
GROUP BY bu;

-- ดู LLM cost ต่อ bu วันนี้
SELECT bu_name, host, SUM(cost_usd) FROM llm_usage_logs
WHERE DATE(created_at) = CURDATE()
GROUP BY bu_name, host;

-- ดู activity ของ user จิตรา
SELECT * FROM audit_logs
WHERE user_id = 'jitra' AND host = 'ostin.carmenwork.com'
ORDER BY created_at DESC;
```
