# Email Automation API

**v1.2 · 2026-08-05** · Base URL `https://{ocr-host}/api/v1/carmen` · schema: `/openapi.json`
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

## 1 · `GET /settings` → `200`

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "entitled": true,                                    // มี package รายเดือนที่ยังไม่หมดอายุ
  "ingest_address": "ocr+7f3a91@carmensoftware.com",   // null จนกว่าจะ PUT ครั้งแรก
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "bank_code": "KTC",
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_pattern": "MDR",
      "has_password": true,
      "is_active": true
    }
  ],
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
| `no_gl_mapping` | ยังไม่ได้ตั้ง GL mapping ในแอป OCR (`commission` / `tax` / `net`) |
| `no_tax_id` | ยังไม่ได้ใส่เลขผู้เสียภาษี |
| `no_rule` | ไม่มี rule ที่ `is_active` |
| `disabled` | `enabled` ยังเป็น false |

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
| `bank_code` | string \| null | `BBL` `KBANK` `SCB` `BAY` `KTC` `GHL` `PAYPAL` `SIAMPAY` · `null` = อื่น ๆ |
| `bank_sender_email` | string \| null | |
| `filename_pattern` | string \| null | substring ของชื่อไฟล์ ไม่สนตัวพิมพ์ · `null` = ไฟล์ไหนก็ได้ |
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
      "filename_pattern": "MDR", "pdf_password": "1234", "is_active": true }
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
| `422` | `unsupported_bank` | `bank_code` ไม่อยู่ในลิสต์ | ใช้ `null` |
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
| 4 | `ingest_address` ไม่มีวันเปลี่ยน — cache ได้ |
| 5 | ดูว่าระบบทำงานอยู่ไหม ใช้ `status.ready` ไม่ใช่ `enabled` |
| 6 | `DELETE /settings/token` ลบแค่สำเนาของเรา ไม่ใช่การเพิกถอน — Carmen ต้องเพิกถอนเอง |
| 7 | แยก `401` (user ต้อง login ใหม่) กับ `502` (เราเข้าไม่ถึง host ลูกค้า) บนหน้าจอ |
