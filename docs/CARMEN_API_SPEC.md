# Email Automation API

**v4.1 · 2026-08-11** · Base URL `https://{ocr-host}/api/v1/carmen` · schema: `/openapi.json`
เหตุผลเบื้องหลัง: [CARMEN_INTEGRATION.md](CARMEN_INTEGRATION.md)

หน้านี้คือสัญญาสำหรับหน้าจอ **Email Automation Settings** ฝั่ง Carmen — Carmen เป็นเจ้าของ UI,
เราเป็นเจ้าของ storage + validation ทั้งหมด

---

## TL;DR — ทำ 3 อย่างนี้จบ

```text
1) PUT /settings/token   ส่ง Carmen token ที่จะใช้ post JV  → เราลองยิง Carmen จริงก่อนเก็บ
2) PUT /settings         ส่ง tax_ids + rules + enabled:true → ได้ ingest_address กลับมา
3) แสดง ingest_address   ให้ลูกค้า copy ไปตั้ง auto-forward ที่เมลตัวเอง
```

หลังจากนั้นหน้าจอแค่ `GET /settings` แล้วอ่าน `status.ready` / `status.blockers`

| อยากทำ | ยิงอะไร |
|---|---|
| เปลี่ยน token (rotate) | `PUT /settings/token` ทับได้เลย ไม่ต้องลบก่อน |
| ปิดใช้ชั่วคราว | `PUT /settings` ด้วย `enabled: false` (ที่อยู่ยังอยู่ ไม่หาย) |
| เลิกใช้ถาวร | เพิกถอน token ฝั่ง Carmen **ก่อน** → แล้ว `DELETE /settings/token` |

---

## Auth

```http
Authorization: <token>
```

`<token>` = Carmen token ตัวเดียวกับที่แนบมากับ URL ตอนกดปุ่ม AI · ส่งดิบ ๆ ไม่มี prefix ·
**อย่า trim/split** (ค่าจริงมีช่องว่างข้างในได้) · `CarmenToken <token>` แบบเดิมยังรับอยู่

**เราไม่ได้เชื่อ `uri`/`bu` ใน payload** — เราเอา token ไปยิง Carmen ของ host นั้นเพื่อพิสูจน์
ว่าคุณมีสิทธิ์จริง จะแก้ settings ของ host ไหนได้ ต้องถือ credential ที่ Carmen ของ host นั้นยอมรับ

> `Bearer <jwt>` เป็น path ของทีมเรา (admin) สำหรับเข้าไปแก้ให้ลูกค้า — ฝั่ง Carmen ไม่ต้องใช้

**Rate limit:** 20 req/นาที/IP (+ เพดานรวมทั้งระบบ 300/นาที) นับเฉพาะ path ที่ใช้ Carmen token
เกินแล้วได้ `429` พร้อม header `Retry-After: 60`

---

## Endpoints

| # | Endpoint | ทำอะไร | Success |
|---|---|---|---|
| 0 | `GET /bank-codes` | ลิสต์ `bank_code` ที่ใช้ได้ตอนนี้ — ไม่ผูกกับ uri/bu | `200` |
| 1 | `GET /settings?uri=&bu=` | อ่านค่าที่ตั้งไว้ + สถานะ | `200` |
| 2 | `PUT /settings` | เขียนค่าตั้ง (ทับทั้งก้อน) | `200` |
| 3 | `PUT /settings/token` | เก็บ token ที่ใช้ post JV | `200` |
| 4 | `GET /settings/token?uri=&bu=` | เช็คสถานะ token | `200` |
| 5 | `DELETE /settings/token?uri=&bu=` | ลบสำเนา token ของเรา | `204` no body |

> **⚠️ เปลี่ยนจาก v3.0:** ระบุ BU ด้วย **`uri`** แทน `host` แล้ว — ส่งค่าเดียวกับที่ส่งให้
> `/auth/exchange` อยู่แล้วได้เลย ไม่ต้องแกะ hostname เอง · `host` ไม่รับแล้ว (ส่งมาก็ถูกเมิน
> แล้วจะได้ `422` เพราะไม่มี `uri`)

`uri` / `bu` เป็น **query string** สำหรับ GET/DELETE และอยู่ใน **body** สำหรับ PUT

`uri` = origin ของ Carmen instance เช่น `https://hotelgroup.carmenwork.com` — **ค่าเดียวกับที่ส่งให้
`/auth/exchange`** · เราดึงเฉพาะ hostname ออกมาใช้หา BU (scheme/port/path ที่เกินมาถูกตัดทิ้ง ตัวพิมพ์
ใหญ่-เล็กไม่สำคัญ) · บน querystring ต้อง encode: `?uri=https%3A%2F%2Fhotelgroup.carmenwork.com&bu=hq`
· `bu` = รหัส BU ตัวพิมพ์เล็ก เช่น `hq`

`uri` ใช้**หา BU อย่างเดียว** ไม่ใช่ปลายทางที่เรายิงกลับ — ปลายทางจริงมาจาก host ที่เก็บไว้ตอน BU login
ครั้งแรกเสมอ (ดู `carmen_uri` ใน §3–4 ถ้าอยากยืนยันว่าเรายิงไปที่ไหน)

---

## 0 · `GET /bank-codes` → `200`

ใช้ทำ dropdown ของ `rules[].bank_code`

```jsonc
{ "banks": [ { "code": "BBL", "name": "Bangkok Bank" }, { "code": "KTC", "name": "Krungthai Card" } ] }
```

ดึงจากตาราง bank เดียวกับที่ OCR wizard ใช้ — เพิ่มธนาคารใหม่ = INSERT ไม่ต้อง deploy ใหม่ ดังนั้น
**อย่า hardcode ลิสต์นี้ฝั่ง Carmen** ให้ดึงจาก endpoint นี้แทน (หรืออย่างน้อย cache แบบ refresh เป็นระยะ)

---

## 1 · `GET /settings?uri=&bu=` → `200`

```jsonc
{
  "host": "hotelgroup.carmenwork.com",                 // identity ของ tenant (ไม่ใช่ค่าที่ส่งมา)
  "bu": "hq",
  "enabled": true,
  "entitled": true,                                    // มี package รายเดือนที่ยังไม่หมดอายุ
  "ingest_address": "AIAGENT+a1b2c3d4@carmensoftware.com",  // ต่อ BU · null จนกว่าจะเปิดใช้สำเร็จ
  "owner_emails": ["accounting@hotelgroup.com"],       // ว่าง = รับทุก sender (ดู §2)
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "bank_code": "KTC",
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_patterns": ["MDR", "Commission"],
      "has_password": true,                            // read-only · ไม่เคยคืนค่า password
      "is_active": true
    }
  ],
  "gmail_confirmed_at": "2026-08-07T09:31:00Z",        // null = ยังไม่ยืนยัน forwarding
  "gmail_confirm": {                                   // null เมื่อไม่มีโค้ดค้างอยู่
    "code": "123456789",                               // โค้ดยืนยัน forwarding ของ Gmail
    "at": "2026-08-07T09:30:00Z"
  },
  "status": {
    "ready": true,
    "blockers": [],
    "documents_total": 128,                            // ⚠ ไม่มี 2 ฟิลด์นี้เมื่อยังไม่เคยตั้งค่า
    "last_received_at": "2026-07-30T09:12:00Z"
  }
}
```

**Response fields**

| Field | Type | หมายเหตุ |
|---|---|---|
| `host` / `bu` | string | identity ของ tenant ที่ resolve ได้ — ส่ง `uri` มาแบบไหนก็คืนค่านี้ค่าเดียว |
| `enabled` | bool | สวิตช์ที่ลูกค้ากด — **ไม่ใช่**ตัวบอกว่าระบบทำงานอยู่ ใช้ `status.ready` |
| `entitled` | bool | มี subscription ที่ยัง active |
| `ingest_address` | string \| null | ที่อยู่รับเมลของ BU นี้ · `null` จนกว่า `enabled:true` สำเร็จครั้งแรก |
| `owner_emails` | string[] | lowercase แล้ว · ว่าง = รับจากผู้ส่งใดก็ได้ |
| `tax_ids` | string[] | 13 หลัก ไม่มีขีด |
| `rules[].has_password` | bool | มี password เก็บอยู่ไหม (แทนตัว password) |
| `gmail_confirmed_at` | ISO8601 \| null | เรากด link ยืนยันให้แล้วเมื่อไหร่ |
| `gmail_confirm` | object \| null | มีก็ต่อเมื่อมีโค้ดค้างรอใช้ |
| `status.ready` | bool | `blockers` ว่าง |
| `status.documents_total` | int | นับเอกสารสะสมของ BU นี้ · **ไม่ปรากฏ**เมื่อ blocker = `not_configured` |
| `status.last_received_at` | ISO8601 \| null | เช่นกัน |

**`status.blockers`** — ลิสต์ทุกข้อที่ยังค้าง (ไม่ใช่ข้อเดียว) แสดงเป็น checklist ได้เลย

| Value | หมายความว่า | ทางแก้ |
|---|---|---|
| `not_configured` | ยังไม่เคยตั้งค่า (ไม่มีแถวใน DB) | `PUT /settings` ครั้งแรก |
| `not_entitled` | ไม่มี package รายเดือนที่ยังไม่หมดอายุ | ต่ออายุ |
| `no_tax_id` | ยังไม่ได้ใส่เลขผู้เสียภาษี | ใส่เลขบริษัท (ดู ข้อควรรู้ ข้อ 4) |
| `no_rule` | ไม่มี rule ที่ `is_active` | เพิ่ม rule อย่างน้อย 1 |
| `disabled` | `enabled` ยังเป็น false | เปิดสวิตช์ |

**`gmail_confirm`** — ถ้าลูกค้าใช้ Gmail ตั้ง auto-forward Google จะส่งโค้ดยืนยันไปที่
`ingest_address` ซึ่งเป็น mailbox ที่ลูกค้าเปิดเองไม่ได้ ระบบจึงอ่านโค้ดจากเมลนั้นแล้วส่งคืนตรงนี้
**ให้แสดงบนหน้าจอ** ลูกค้า copy ไป paste ในหน้า Gmail ของตัวเอง — เป็น `null` เมื่อไม่มีโค้ดค้าง
และถูกทับด้วยโค้ดใหม่เสมอ (ใช้ครั้งเดียว ไม่ใช่ประวัติ) · ปกติ Google กด link ยืนยันพอ จึงเห็นแค่
`gmail_confirmed_at` โดยไม่เห็น `gmail_confirm`

---

## 2 · `PUT /settings` → `200` (body เหมือน `GET /settings`)

> **ทับทั้งก้อน ไม่ใช่ PATCH** — ฟิลด์ที่ไม่ส่ง = ล้างเป็นค่า default
> ต้องส่ง `tax_ids` + `rules` + `owner_emails` ครบทุกครั้ง วิธีที่ปลอดภัยคือ
> `GET /settings` → แก้ในมือ → `PUT` กลับ

| Field | Type | Description |
|---|---|---|
| `uri` **required** | string | origin ของ Carmen เช่น `https://hotelgroup.carmenwork.com` — ค่าเดียวกับที่ส่งให้ `/auth/exchange` · ใช้หา BU เท่านั้น |
| `bu` **required** | string | รหัส BU (case-insensitive) |
| `enabled` | bool | default `false` |
| `owner_emails` | string[] | อีเมลฝั่งลูกค้า · **ว่าง = รับทุก sender (default)** · ถ้าใส่ เมลต้องมีที่อยู่ใดที่อยู่หนึ่งใน `From`/`To`/`Cc` ไม่งั้นไฟล์แนบถูกบันทึก `sender_not_allowed` ไม่ถูกอ่าน ไม่คิดเงิน · `422 invalid_email` ถ้ารูปแบบเพี้ยน |
| `tax_ids` **required ถ้า enabled** | string[] | เลข 13 หลัก ไม่มีขีด ใส่ได้หลายเลข |
| `rules` | Rule[] | default `[]` |

**Rule**

| Field | Type | Description |
|---|---|---|
| `bank_code` | string \| null | ดูค่าที่ใช้ได้จาก `GET /bank-codes` (§0) · `null` = อื่น ๆ · **ห้ามซ้ำกันในลิสต์ `rules` เดียวกัน รวมถึง `null` ก็ได้แค่ 1 rule** |
| `bank_sender_email` | string \| null | จำกัดผู้ส่งของ rule นี้ |
| `filename_patterns` **required ≥1** | string[] | substring ของชื่อไฟล์ ไม่สนตัวพิมพ์ · เข้าเงื่อนไขข้อใดข้อหนึ่งก็พอ · **ไฟล์ที่ไม่ตรง rule ไหนเลย = ไม่ถูกอ่าน ไม่ถูกคิดเงิน** · ใส่ `".pdf"` = รับ PDF ทุกไฟล์ |
| `pdf_password` | string \| null | **write-only** · **ไม่ส่ง = คงค่าเดิม** · `""` = ล้างทิ้ง · มีค่า = ตั้งใหม่ |
| `is_active` | bool | default `true` |

⚠ **`pdf_password` ผูกกับ `bank_code`** — ตอน save เรา match rule เก่ากับใหม่ด้วย `bank_code`
ถ้าลูกค้าแก้ `bank_code` ของ rule เดิม password ที่เก็บไว้จะไม่ตามไป ต้องกรอกใหม่

```jsonc
{
  "uri": "https://hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "owner_emails": ["accounting@hotelgroup.com"],
  "tax_ids": ["0105536000127"],
  "rules": [
    { "bank_code": "KTC", "bank_sender_email": "no-reply@ktc.co.th",
      "filename_patterns": ["MDR", "Commission"], "pdf_password": "1234", "is_active": true }
  ]
}
```

---

## 3 · `PUT /settings/token` → `200`

| Field | Type | Description |
|---|---|---|
| `uri` **required** | string | ใช้หา BU เท่านั้น |
| `bu` **required** | string | |
| `token` **required** | string | **write-only** · ไม่เคยคืนค่ากลับ ไม่เคยโผล่ใน log |

ก่อนเก็บ เรายิง `GET https://{host}/Carmen.API/api/interface/department` ด้วย token นั้น
ไม่ผ่าน = **ไม่เขียนอะไรลง DB เลย** (`422 token_rejected`) ·
`{host}` ตรงนี้คือ host ที่เก็บไว้ของ BU **ไม่ใช่** ค่าที่ส่งมาใน `uri`

ยิงซ้ำ = rotate ทับได้เลย ไม่ต้อง DELETE ก่อน

## 3–4 · Response `200` (ทั้ง `PUT` และ `GET /settings/token`)

```jsonc
{
  "configured": true,                               // false = ไม่มี token → post ให้ไม่ได้
  "fingerprint": "9c1f3a2b",                        // 8 hex แรกของ sha256(token) · null ถ้าไม่มี
  "carmen_uri": "https://hotelgroup.carmenwork.com", // origin ที่เรา verify และจะใช้ post จริง
  "verified_at": "2026-08-04T03:15:00Z"             // null = ครั้งล่าสุดที่เช็คแล้วใช้ไม่ได้
}
```

`configured: true` + `verified_at: null` = เคยเก็บไว้ แต่รอบตรวจสุขภาพรายวันล่าสุดยิงไม่ผ่าน
(ถูกเพิกถอน หรือ Carmen ล่มชั่วคราว) — ควรขึ้นเตือนให้ลูกค้าส่ง token ใหม่

**BU ที่ไม่เคยตั้งค่า** `GET /settings/token` คืน `200` ทุกฟิลด์เป็น `null` / `false`
(ไม่ใช่ `404`)

---

## 5 · `DELETE /settings/token?uri=&bu=` → `204`

ลบ **สำเนา token ของเรา** ทิ้ง — `carmen_token_enc`, `fingerprint`, `verified_at` เป็น `null` หมด

| | |
|---|---|
| Query | `uri` **required**, `bu` **required** |
| Success | `204 No Content` — **ไม่มี body** อย่า `JSON.parse()` response |
| Idempotent | ยิงซ้ำ / ยิงกับ BU ที่ไม่มี token อยู่แล้ว ก็ได้ `204` เหมือนกัน |
| ไม่แตะ | `enabled`, `tax_ids`, `rules`, `ingest_address` — settings ยังอยู่ครบ |

```bash
curl -X DELETE "https://{ocr-host}/api/v1/carmen/settings/token?uri=https%3A%2F%2Fhotelgroup.carmenwork.com&bu=hq" \
     -H "Authorization: <carmen-token>"
```

**ผลข้างเคียงที่ต้องบอกลูกค้าบนหน้าจอ:** ตั้งแต่วินาทีนี้เอกสารที่เข้ามายัง extract ปกติ
แต่ **post เข้า Carmen ไม่ได้** — จะค้างรอจนกว่าจะส่ง token ใหม่ ถ้าจะหยุดรับเมลด้วย
ต้อง `PUT /settings` `enabled:false` แยกอีกที

⚠ **นี่ไม่ใช่การเพิกถอน token** — สำเนาที่อื่นยังใช้ได้อยู่ Carmen ต้องเพิกถอนฝั่งตัวเอง
ลำดับที่ถูกคือ **เพิกถอนที่ Carmen ก่อน → แล้วค่อย DELETE**

---

## Errors

หน้าตา error มี **3 แบบ** — เช็คตามลำดับนี้

```jsonc
// A) field error (422/409 จาก validation ของเรา) — render จาก errors[] ทีละช่อง
{ "detail": "…", "errors": [ { "field": "token", "code": "token_rejected", "message": "…" } ] }

// B) FastAPI schema error (422) — ขาด uri/bu หรือผิด type · detail เป็น array
{ "detail": [ { "loc": ["body","uri"], "msg": "Field required", "type": "missing" } ] }

// C) ที่เหลือ (401/400/409/429/502) — detail เป็น string เดียว
{ "detail": "Authorization required" }
```

`field` ของ list ใช้ index จริง เช่น `rules[1].bank_code`, `tax_ids[0]`, `owner_emails[2]` →
ชี้กลับไปที่ input ที่ผิดได้ตรงช่อง

| Status | code / message | เมื่อไหร่ | ทำยังไง |
|---|---|---|---|
| `401` | `Authorization required` | ไม่ได้ส่ง header | แก้โค้ด |
| `401` | `Malformed Carmen token` | token ผิดรูป (ไม่มี `\|`) | เช็คว่าส่ง token ครบ ไม่ใช่ค่าที่ตัดมาแล้ว |
| `401` | `Carmen token rejected — please re-login to Carmen` | Carmen ปฏิเสธ token | ให้ user login ใหม่ **อย่า retry** (เราจำคำปฏิเสธไว้ 30 วิ ยิงซ้ำได้ผลเดิม) |
| `502` | `Cannot reach Carmen…` | ติดต่อ Carmen ของลูกค้าไม่ได้ | retry ได้ |
| `429` | — | เกิน 20 req/นาที | รอตาม header `Retry-After` แล้วยิงใหม่ |
| `400` | `Unknown business unit: …` | BU ยังไม่เคย login เข้า OCR app · หรือ `uri` ผิด/พิมพ์ตก | ให้ลูกค้า login 1 ครั้ง · เช็ค `uri` ว่าเป็น origin เดียวกับตอน login |
| `422` (B) | `Field required` | ไม่ได้ส่ง `uri` หรือ `bu` | หน้าตาคนละแบบกับ `errors[]` |
| `422` | `invalid_checksum` (`tax_ids[i]`) | ไม่ใช่ 13 หลัก / check digit ไม่ผ่าน | แก้เลข |
| `422` | `reserved_tax_id` (`tax_ids[i]`) | เลขที่ใส่เป็น**เลขของธนาคารเอง** ไม่ใช่ของบริษัทลูกค้า | ใช้เลขบริษัท — เลขธนาคารพิมพ์อยู่บนใบเดียวกัน มักหยิบผิดบรรทัด |
| `422` | `required` (`tax_ids`) | `enabled: true` แต่ไม่มี `tax_ids` | ใส่เลขก่อน |
| `422` | `not_entitled` (`enabled`) | `enabled: true` แต่ package หมดอายุ | ต่ออายุ (บันทึกแบบ `enabled:false` ยังได้) |
| `422` | `invalid_email` (`owner_emails[i]`) | ไม่มี `@` หรือโดเมนไม่มีจุด | แก้อีเมล |
| `422` | `unsupported_bank` (`rules[i].bank_code`) | ไม่อยู่ในลิสต์ (ดู `GET /bank-codes`) | เลือกใหม่ หรือใช้ `null` |
| `422` | `duplicate_bank` (`rules[i].bank_code`) | มี 2 rules ใช้ `bank_code` เดียวกัน (รวม `null` กับ `null`) | รวมเป็น rule เดียว |
| `422` | `required` (`rules[i].filename_patterns`) | rule ไม่มี pattern ที่ใช้ได้เลย | ใส่อย่างน้อย 1 · ไม่รู้จะใส่อะไรให้ใส่ `".pdf"` |
| `409` | `Tax ID … already registered to another BU` | เลขนี้ถูก BU อื่นจองแล้ว | น่าจะพิมพ์ผิด · 1 เลข = 1 BU ทั้งระบบ |
| `422` | `token_rejected` (`token`) | Carmen ปฏิเสธ token ที่ส่งมาเก็บ (มี HTTP code ของ Carmen ใน message) | ใช้ token ใหม่ |
| `422` | `invalid_uri` (`carmen_uri`) | origin ที่ derive จาก host ที่เก็บไว้ ไม่ผ่าน SSRF check | ไม่ใช่เรื่องของค่าที่ส่งมา — แจ้งเรา |

`PUT` ทุกตัวเป็น **all-or-nothing**: มี error ข้อเดียวก็ไม่เขียนอะไรลง DB เลย
(validation รวบทุกช่องก่อนค่อยโยน — error ขึ้นครบทีเดียว ไม่ต้องกดแก้ทีละรอบ)

---

## ข้อควรรู้

| | |
|---|---|
| 1 | BU ต้องเคย login เข้า OCR app ก่อน ไม่งั้น `400` ทุก endpoint |
| 2 | `PUT /settings` ทับทั้งก้อน — ส่ง `tax_ids` + `rules` + `owner_emails` ครบทุกครั้ง |
| 3 | `PUT /settings` กับ `PUT /settings/token` ไม่แตะข้อมูลของกันและกัน — ทำแยกกันได้ ลำดับไหนก่อนก็ได้ |
| 4 | **ที่อยู่ 1 อันต่อ 1 BU** (`AIAGENT+<tag>@…`) — ระบบดู tag ในที่อยู่ผู้รับว่าเป็นของ BU ไหน แล้วใช้เลขผู้เสียภาษีบนเอกสาร**ยืนยัน** · เป็น `null` จนกว่าจะ `enabled: true` สำเร็จครั้งแรก · **cache แยกต่อ BU ห้าม cache ข้าม BU** · ค่านี้ไม่เปลี่ยนอีก แม้ปิด-เปิดใหม่หรือ package หมดอายุ |
| 4b | เอกสารที่มีเลขผู้เสียภาษีของ BU **อื่น** จะไม่ถูก post (`tax_id_mismatch`, คืนเครดิต) · เอกสารที่ไม่มีเลขเลย ยัง post ปกติ (ใบ fee บางใบไม่พิมพ์เลขผู้ซื้อ) |
| 5 | ดูว่าระบบทำงานอยู่ไหม ใช้ `status.ready` ไม่ใช่ `enabled` |
| 6 | `DELETE /settings/token` ลบแค่สำเนาของเรา ไม่ใช่การเพิกถอน — Carmen ต้องเพิกถอนเอง |
| 7 | แยก `401` (user ต้อง login ใหม่) กับ `502` (เราเข้าไม่ถึง host ลูกค้า) บนหน้าจอ |
| 8 | secret ทั้งสองตัว (`token`, `pdf_password`) เข้ารหัสเก็บ และ **ไม่มี endpoint ไหนคืนค่ากลับ** — UI ต้องออกแบบให้ "กรอกใหม่" ไม่ใช่ "แก้ของเดิม" |
| 9 | เราเช็คสุขภาพ token ทุก BU วันละครั้ง — `verified_at` จึงขยับเองได้โดยที่ไม่มีใครกดอะไร |
