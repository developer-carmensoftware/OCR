# Email Automation API

**v3.0 · 2026-08-06** · Base URL `https://{ocr-host}/api/v1/carmen` · schema: `/openapi.json`
เหตุผลเบื้องหลัง: [CARMEN_INTEGRATION.md](CARMEN_INTEGRATION.md)

---

## Auth

```http
Authorization: <Carmen token ของ user ที่ login อยู่>
```

ส่งดิบ ๆ ไม่มี prefix · อย่า trim/split (ค่าจริงมีช่องว่างข้างในได้) · `CarmenToken <token>` แบบเดิมยังรับอยู่
จำกัด 20 request/นาที/IP

---

## Endpoints

| # | Endpoint | ทำอะไร |
|---|---|---|
| 0 | `GET /bank-codes` | ลิสต์ `bank_code` ที่ใช้ได้ตอนนี้ — ไม่ผูกกับ host/bu |
| 1 | `GET /settings?host=&bu=` | อ่านค่าที่ตั้งไว้ |
| 2 | `PUT /settings` | เขียนค่าตั้ง |
| 3 | `PUT /settings/token` | ส่ง token ที่ใช้ post JV |
| 4 | `GET /settings/token?host=&bu=` | เช็คสถานะ token |
| 5 | `DELETE /settings/token?host=&bu=` | ลบ token → `204` ไม่มี body |

`host` = hostname ของ Carmen instance เช่น `hotelgroup.carmenwork.com` · `bu` = รหัส BU ตัวพิมพ์เล็ก เช่น `hq`

**ลำดับเปิดใช้:** `PUT /settings/token` → `PUT /settings` → แสดง `ingest_address` จาก response ให้ลูกค้า copy
**ปิดใช้:** เพิกถอน token ฝั่ง Carmen → `DELETE /settings/token`
**Rotate:** `PUT /settings/token` ทับได้เลย

---

## 0 · `GET /bank-codes` → `200`

```jsonc
{ "banks": [ { "code": "BBL", "name": "Bangkok Bank" }, { "code": "KTC", "name": "Krungthai Card" } ] }
```

ดึงจากตาราง bank เดียวกับที่ OCR wizard ใช้ — เพิ่มธนาคารใหม่ = INSERT ไม่ต้อง deploy ใหม่ ดังนั้น**อย่า hardcode ลิสต์นี้ฝั่ง Carmen** ให้ดึงจาก endpoint นี้แทน (หรืออย่างน้อย cache แบบ refresh เป็นระยะ)

---

## 1 · `GET /settings` → `200`

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "entitled": true,                                    // มี package รายเดือนที่ยังไม่หมดอายุ
  "ingest_address": "AIAGENT+a1b2c3d4@carmensoftware.com",  // ต่อ BU · null จนกว่าจะเปิดใช้สำเร็จ
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "bank_code": "KTC",
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_patterns": ["MDR", "Commission"],
      "has_password": true,
      "is_active": true
    }
  ],
  "gmail_confirm": {                                   // null เมื่อไม่มีโค้ดค้างอยู่
    "code": "123456789",                               // โค้ดยืนยัน forwarding ของ Gmail
    "at": "2026-08-07T09:30:00Z"
  },
  "status": {
    "ready": true,
    "blockers": [],
    "documents_total": 128,                            // ไม่มี 2 คีย์นี้ตอน not_configured
    "last_received_at": "2026-07-30T09:12:00Z"
  }
}
```

**`status.blockers`**

| Value | หมายความว่า |
|---|---|
| `not_configured` | ยังไม่เคยตั้งค่า |
| `not_entitled` | ไม่มี package รายเดือนที่ยังไม่หมดอายุ |
| `no_tax_id` | ยังไม่ได้ใส่เลขผู้เสียภาษี — จำเป็นก่อนเปิดใช้ ใช้เป็นตัว**ยืนยัน**ว่าเอกสารเป็นของ BU นี้ (ดู ข้อควรรู้ ข้อ 4) |
| `no_rule` | ไม่มี rule ที่ `is_active` |
| `disabled` | `enabled` ยังเป็น false |

**`gmail_confirm`** — ถ้าลูกค้าใช้ Gmail ตั้ง auto-forward Google จะส่งโค้ดยืนยันไปที่
`ingest_address` ซึ่งเป็น mailbox ที่ลูกค้าเปิดเองไม่ได้ ระบบจึงอ่านโค้ดจากเมลนั้นแล้วส่งคืนตรงนี้
**ให้แสดงบนหน้าจอ** ลูกค้า copy ไป paste ในหน้า Gmail ของตัวเอง — เป็น `null` เมื่อไม่มีโค้ดค้าง
และถูกทับด้วยโค้ดใหม่เสมอ (ใช้ครั้งเดียว ไม่ใช่ประวัติ)

---

## 2 · `PUT /settings` → `200` (body เหมือน `GET /settings`)

| Field | Type | Description |
|---|---|---|
| `host` **required** | string | |
| `bu` **required** | string | |
| `enabled` | bool | default `false` |
| `tax_ids` **required ถ้า enabled** | string[] | เลข 13 หลัก ไม่มีขีด ใส่ได้หลายเลข |
| `rules` | Rule[] | |

**Rule**

| Field | Type | Description |
|---|---|---|
| `bank_code` | string \| null | ดูค่าที่ใช้ได้จาก `GET /bank-codes` (§0) · `null` = อื่น ๆ · **ห้ามซ้ำกันในลิสต์ `rules` เดียวกัน รวมถึง `null` ก็ได้แค่ 1 rule** |
| `bank_sender_email` | string \| null | |
| `filename_patterns` **required ≥1** | string[] | substring ของชื่อไฟล์ ไม่สนตัวพิมพ์ · เข้าเงื่อนไขข้อใดข้อหนึ่งก็พอ · **ไฟล์ที่ไม่ตรง rule ไหนเลย = ไม่ถูกอ่าน ไม่ถูกคิดเงิน** · ใส่ `".pdf"` = รับ PDF ทุกไฟล์ |
| `pdf_password` | string \| null | **write-only** · ไม่ส่ง = เก็บของเดิม · `""` = ล้างทิ้ง |
| `is_active` | bool | default `true` |

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "tax_ids": ["0105536000127"],
  "rules": [
    { "bank_code": "KTC", "bank_sender_email": "no-reply@ktc.co.th",
      "filename_patterns": ["MDR", "Commission"], "pdf_password": "1234", "is_active": true }
  ]
}
```

---

## 3 · `PUT /settings/token`

| Field | Type | Description |
|---|---|---|
| `host` **required** | string | |
| `bu` **required** | string | |
| `token` **required** | string | **write-only** · ไม่เคยคืนค่ากลับ ไม่เคยโผล่ใน log |

ก่อนเก็บ เรายิง `GET https://{host}/Carmen.API/api/interface/department` ด้วย token นั้น
ไม่ผ่าน = ไม่เขียนอะไรลง DB เลย

## 3–4 · Response `200` (ทั้ง `PUT` และ `GET /settings/token`)

```jsonc
{
  "configured": true,                               // false = ไม่มี token → post ให้ไม่ได้
  "fingerprint": "9c1f3a2b",                        // 8 hex แรกของ sha256(token)
  "carmen_uri": "https://hotelgroup.carmenwork.com",
  "verified_at": "2026-08-04T03:15:00Z"             // null = ครั้งล่าสุดที่เช็คแล้วใช้ไม่ได้
}
```

---

## Errors

```jsonc
// 422 ทุกแบบหน้าตาเหมือนกัน — render จาก errors[] · detail ไว้ลง log
{ "detail": "…", "errors": [ { "field": "token", "code": "token_rejected", "message": "…" } ] }
```

| Status | code / message | เมื่อไหร่ | ทำยังไง |
|---|---|---|---|
| `401` | `Authorization required` | ไม่ได้ส่ง header | แก้โค้ด |
| `401` | `Carmen token rejected` | Carmen ปฏิเสธ token | ให้ user login ใหม่ อย่า retry |
| `502` | `Cannot reach Carmen…` | ติดต่อ Carmen ของลูกค้าไม่ได้ | retry ได้ |
| `429` | — | เกิน 20 req/นาที | รอแล้วยิงใหม่ |
| `400` | `Unknown business unit` | BU ยังไม่เคย login เข้า OCR app | ให้ลูกค้า login 1 ครั้ง |
| `422` | `invalid_checksum` | เลขผู้เสียภาษีไม่ใช่ 13 หลัก / check digit ไม่ผ่าน | แก้เลข |
| `422` | `required` | `enabled: true` แต่ไม่มี `tax_ids` | ใส่เลขก่อน |
| `422` | `not_entitled` | `enabled: true` แต่ package หมดอายุ | ต่ออายุ (บันทึกเฉย ๆ ยังได้) |
| `422` | `unsupported_bank` | `bank_code` ไม่อยู่ในลิสต์ (ดู `GET /bank-codes`) | ใช้ `null` |
| `422` | `duplicate_bank` | มี 2 rules ใช้ `bank_code` เดียวกัน (รวม `null` กับ `null`) | รวมเป็น rule เดียว |
| `422` | `required` (`rules[i].filename_patterns`) | rule ไม่มี pattern ที่ใช้ได้เลย | ใส่อย่างน้อย 1 · ไม่รู้จะใส่อะไรให้ใส่ `".pdf"` |
| `422` | `reserved_tax_id` | เลขที่ใส่เป็น**เลขของธนาคารเอง** ไม่ใช่ของบริษัทลูกค้า | ใช้เลขบริษัท — เลขธนาคารพิมพ์อยู่บนใบเดียวกัน มักหยิบผิดบรรทัด |
| `409` | `Tax ID … already registered` | เลขนี้ถูก BU อื่นจองแล้ว | น่าจะพิมพ์ผิด |
| `422` | `token_rejected` | Carmen ปฏิเสธ token ที่ส่งมาเก็บ | mint ใบใหม่ |
| `422` | `invalid_uri` | `https://{host}` ไม่ผ่าน SSRF check | แก้ `host` |

---

## ข้อควรรู้

| | |
|---|---|
| 1 | BU ต้องเคย login เข้า OCR app ก่อน ไม่งั้น `400` ทุก endpoint |
| 2 | `PUT /settings` ทับทั้งก้อน — ส่ง `tax_ids` + `rules` ครบทุกครั้ง |
| 3 | `PUT /settings` กับ `PUT /settings/token` ไม่แตะข้อมูลของกันและกัน |
| 4 | **ที่อยู่ 1 อันต่อ 1 BU** (`AIAGENT+<tag>@…`) — ระบบดู tag ในที่อยู่ผู้รับว่าเป็นของ BU ไหน แล้วใช้เลขผู้เสียภาษีบนเอกสาร**ยืนยัน** · เป็น `null` จนกว่าจะ `enabled: true` สำเร็จครั้งแรก · **cache แยกต่อ BU ห้าม cache ข้าม BU** · ค่านี้ไม่เปลี่ยนอีก แม้ปิด-เปิดใหม่หรือ package หมดอายุ |
| 4b | เอกสารที่มีเลขผู้เสียภาษีของ BU **อื่น** จะไม่ถูก post (`tax_id_mismatch`, คืนเครดิต) · เอกสารที่ไม่มีเลขเลย ยัง post ปกติ (ใบ fee บางใบไม่พิมพ์เลขผู้ซื้อ) |
| 5 | ดูว่าระบบทำงานอยู่ไหม ใช้ `status.ready` ไม่ใช่ `enabled` |
| 6 | `DELETE /settings/token` ลบแค่สำเนาของเรา ไม่ใช่การเพิกถอน — Carmen ต้องเพิกถอนเอง |
| 7 | แยก `401` (user ต้อง login ใหม่) กับ `502` (เราเข้าไม่ถึง host ลูกค้า) บนหน้าจอ |
