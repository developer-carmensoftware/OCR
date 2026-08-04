# Email Automation API — spec สำหรับทีม Carmen

> **v1.0 · 2026-08-04 · X-Api-Key (`Authorization: ApiKey …`) Authentication**
>
> เอกสารนี้คือ API reference ที่เอาไปเขียนโค้ดตามได้เลย
> เหตุผลเบื้องหลังการออกแบบอยู่ที่ [CARMEN_INTEGRATION.md](CARMEN_INTEGRATION.md)
> ส่วนตัว machine-readable อยู่ที่ `/openapi.json` ของ service

---

## Overview

API ที่ Carmen เรียกมาหา OCR เพื่อ **ตั้งค่า Email Automation ให้แต่ละ BU** และ
**ส่ง token ที่ใช้ post JV** ให้เราเก็บไว้

ธนาคารส่งใบแจ้งค่าธรรมเนียมเข้าเมลโรงแรม → ลูกค้า forward เข้ามาที่อยู่ที่เราให้ →
เราอ่านเอกสาร ตรวจเลขผู้เสียภาษี ทำ JV แล้ว post เข้า Carmen อัตโนมัติ

### Base URL

```text
https://{ocr-host}/api/v1/carmen
```

### ทำไมไม่มี POST

ทั้ง 5 endpoint เป็น `GET` / `PUT` / `DELETE` ไม่มี `POST` เลย — ไม่ได้ตกหล่น

`POST` ใช้กับ "สร้างของใหม่ที่ id ยังไม่รู้" หรือ "สั่งงานที่ยิงซ้ำแล้วผลไม่เหมือนเดิม"
แต่ของในนี้เป็น **การเขียนทับของที่มี address อยู่แล้ว** address นั้นคือ `(host, bu)`
ซึ่ง Carmen ส่งมาเอง เราไม่ได้เป็นคนแจก id

| Endpoint | 1 BU มีได้กี่ชุด | ส่งซ้ำด้วย body เดิม |
|---|---|---|
| `PUT /settings` | ค่าตั้งชุดเดียว | ผลเท่าเดิมทุกครั้ง |
| `PUT /settings/token` | token ใบเดียว | ทับใบเก่า ไม่ได้เพิ่มใบที่สอง |

ข้อหลังสำคัญกับการ rotate — **`PUT` ทับได้เลย ไม่ต้อง `DELETE` ก่อน**

> ℹ️ ในระบบมี `POST /api/v1/carmen/email-ingest/run` และ `/email-ingest/health` อยู่จริง
> แต่ **pg_cron ของฝั่งเราเป็นคนเรียก** ใช้ internal job token คนละชุดกับ API key ของ Carmen
> จึงไม่อยู่ในเอกสารนี้ — Carmen ไม่มีวันต้องเรียกสองอันนั้น

### Flow Overview

| # | ใคร | ทำอะไร |
|---|---|---|
| 1 | **OCR** | ออก API Key ให้ Carmen 1 ใบต่อ 1 host ส่งให้แบบ out-of-band |
| 2 | **Carmen** | ลูกค้าเปิดสวิตช์ Email Automation → mint token ของ BU นั้น |
| 3 | **Carmen** | `PUT /settings/token` ส่ง token มาให้เรา — เราทดสอบกับ Carmen ก่อนเก็บ |
| 4 | **Carmen** | `PUT /settings` ส่ง tax_ids + rules ของ BU นั้น |
| 5 | **Carmen** | `GET /settings` อ่าน `ingest_address` มาแสดงให้ลูกค้า copy ไปตั้ง auto-forward |
| 6 | **OCR** | poll เมล → extract → ตรวจ tax id → ทำ JV → post เข้า Carmen ด้วย token ข้อ 3 |
| 7 | **Carmen** | ลูกค้าปิดสวิตช์ → เพิกถอน token ฝั่งตัวเอง + `DELETE /settings/token` |

---

## Authentication

ทุก endpoint ต้องมี header นี้

| Header | Value |
|---|---|
| `Authorization` **required** | `ApiKey ocr_live_xxxxxxxxxxxxxxxxxxxxxxxx` |

### การได้ Key

OCR เป็นคนออกให้ ส่งให้แบบ out-of-band (ไม่ส่งทางเมล/แชท — นัดช่องทางกันอีกที)
Key ผูกกับ **hostname ที่จัดการได้** ตั้งแต่ตอนออก และเราเก็บแค่ค่า hash ของมัน
ถ้าทำหาย แจ้งมา เราออกใบใหม่ + revoke ใบเก่าให้ ใช้เวลาไม่ถึงนาที

แนะนำให้ใช้คนละใบระหว่าง staging กับ production

### Error Responses

| Status | Message | Cause |
|---|---|---|
| `401` | `Authorization required` | ไม่ได้ส่ง header มาเลย |
| `401` | `Authorization must be 'ApiKey …' or 'Bearer …'` | scheme ไม่ถูก |
| `401` | `Invalid API key` | key ผิด หรือถูก revoke แล้ว |
| `403` | `This API key may not manage that business unit` | ใช้ key ยิง BU ที่ไม่ได้อยู่ใน scope ของ key นั้น |

> ⚠️ **`host` / `bu` ใน payload เป็นค่าที่ผู้เรียกส่งมาเอง** เราจึงตรวจทุกครั้งว่า key ใบนั้น
> จัดการ BU นั้นได้จริงไหม — **รวมถึง GET ด้วย** ไม่ใช่แค่ตอนเขียน

---

## ตั้งค่าครั้งแรกของ BU ใหม่

ลำดับนี้ทดสอบจริงกับ BU ที่ยังไม่เคยตั้งค่าเลย — response ที่ยกมาคือของที่ได้กลับมาจริง

### ข้อบังคับก่อนเริ่ม

**BU ต้องเคย login เข้า OCR app อย่างน้อย 1 ครั้ง** tenant เกิดตอน login ครั้งแรก
ไม่ได้เกิดจาก API นี้ ถ้ายังไม่เคย ทุก endpoint จะตอบ

```jsonc
// 400
{ "detail": "Unknown business unit: dev.carmen4.com / neverloggedin" }
```

### ขั้นที่ 0 — เช็คสถานะก่อน (optional)

```http
GET /settings?host=…&bu=…
```
```jsonc
{
  "host": "…", "bu": "…",
  "enabled": false,
  "ingest_address": null,                 // ยังไม่มี — ยังไม่มีแถวให้จอง tag
  "tax_ids": [], "rules": [],
  "status": { "ready": false, "blockers": ["not_configured"] },
  "entitled": true
}
```

> ⚠️ ตอน `not_configured` **`status` มีแค่ `ready` กับ `blockers`**
> ไม่มี `documents_total` / `last_received_at` — อย่า assume ว่ามีสองคีย์นั้นเสมอ

### ขั้นที่ 1 — ส่ง token (แนะนำให้ทำเป็นคำสั่งแรก)

```http
PUT /settings/token
```

`PUT /settings/token` **สร้างแถวให้เองได้** ไม่ต้องเรียก `PUT /settings` ก่อน
และการทำอันนี้ก่อนดีกว่า เพราะถ้า token ใช้ไม่ได้จะหยุดตั้งแต่ตรงนี้ โดยที่ยังไม่มีค่าตั้งอะไรถูกเขียนลงไป

```jsonc
// 200
{
  "configured": true,
  "fingerprint": "3444182f",
  "carmen_uri": "https://dev.carmen4.com",
  "verified_at": "2026-08-04T09:24:43Z"
}
```

หลังขั้นนี้ `ingest_address` จะโผล่มาแล้ว (tag ถูกจองตอนสร้างแถว) แต่ `blockers`
ยังเป็น `["no_tax_id", "no_rule", "disabled"]` เพราะยังไม่ได้ตั้งค่าอะไร

### ขั้นที่ 2 — ส่งค่าตั้ง

```http
PUT /settings
```

ถ้าส่ง `enabled: true` มาโดยยังไม่มี `tax_ids` จะโดนปฏิเสธ

```jsonc
// 422
{ "detail": "At least one tax ID is required before enabling Email Automation",
  "errors": [ { "field": "tax_ids", "code": "required", "message": "…" } ] }
```

ส่งครบแล้วได้ `status.ready = true` และ `blockers` ว่าง

```jsonc
// 200
{
  "enabled": true,
  "ingest_address": "ocr+ebeddedf@carmensoftware.com",
  "tax_ids": ["0105536000127"],
  "rules": [ { "bank_code": "KTC", "filename_pattern": "MDR", "has_password": false, "is_active": true } ],
  "status": { "ready": true, "blockers": [], "documents_total": 0, "last_received_at": null },
  "entitled": true
}
```

### ขั้นที่ 3 — แสดงที่อยู่ให้ลูกค้า

เอา `ingest_address` จาก response ขั้นที่ 2 ไปแสดงให้ลูกค้า copy
ไม่ต้อง `GET` ซ้ำ — `PUT /settings` คืน body หน้าตาเดียวกับ `GET` อยู่แล้ว

ลูกค้าเอาไปตั้ง auto-forward ในเมลตัวเอง หรือจะ forward มือทีละฉบับก็ได้ ทั้งสองแบบใช้ได้

### สองอย่างที่ไม่กระทบกัน

| | กระทบ token ไหม | กระทบ tax_ids / rules ไหม |
|---|---|---|
| `PUT /settings` | **ไม่** — token ที่เก็บไว้อยู่ครบ | ทับทั้งก้อน |
| `PUT /settings/token` | ทับใบเก่า | **ไม่แตะ** |

สลับลำดับขั้นที่ 1 กับ 2 ก็ได้ ผลเหมือนกัน — อันไหนมาก่อนเป็นคนสร้างแถวและจอง `ingest_address`

---

## 1. Get Settings

```http
GET /api/v1/carmen/settings?host={host}&bu={bu}
```

อ่านค่าที่ตั้งไว้ของ BU นั้นทั้งหมด ใช้แสดงบนหน้าจอ setting ของ Carmen

### Query Parameters

| Field | Type | Description |
|---|---|---|
| `host` **required** | string | hostname ของ Carmen instance เช่น `hotelgroup.carmenwork.com` |
| `bu` **required** | string | รหัส business unit ตัวพิมพ์เล็ก เช่น `hq` |

### Response `200`

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "entitled": true,                    // มี package รายเดือนที่ยังไม่หมดอายุ
  "ingest_address": "ocr+7f3a91@carmensoftware.com",   // เอาไปแสดงให้ลูกค้า copy
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "bank_code": "KTC",
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_pattern": "MDR",
      "has_password": true,            // ไม่เคยคืนค่ารหัสผ่านจริง คืนแค่ true/false
      "is_active": true
    }
  ],
  "status": {
    "ready": true,                     // false = มีอะไรบล็อกอยู่ ดู blockers
    "blockers": [],
    "documents_total": 128,
    "last_received_at": "2026-07-30T09:12:00Z"
  }
}
```

### ค่าที่เป็นไปได้ของ `status.blockers`

| Value | หมายความว่า |
|---|---|
| `not_configured` | BU นี้ยังไม่เคยตั้งค่าเลย |
| `no_tax_id` | ยังไม่ได้ใส่เลขผู้เสียภาษี |
| `no_rule` | ไม่มี rule ที่ `is_active` เลยสักอัน |
| `disabled` | ตั้งค่าครบแล้วแต่ `enabled` ยังเป็น false |

### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Unknown business unit: {host} / {bu}` | BU นี้ยังไม่เคย login เข้า OCR app — tenant เกิดตอน login ครั้งแรก ไม่ได้เกิดจาก API นี้ |

---

## 2. Save Settings

```http
PUT /api/v1/carmen/settings
Content-Type: application/json
```

เขียนค่าตั้งของ BU นั้น

> ⚠️ **payload นี้ทับของเดิมทั้งก้อน ไม่ใช่ delta** — ส่ง `rules` และ `tax_ids` มาให้ครบทุกครั้ง
> ส่งมาไม่ครบ = ของเดิมที่ไม่ได้ส่งมาหายไป

### Request Body

| Field | Type | Description |
|---|---|---|
| `host` **required** | string | hostname ของ Carmen instance |
| `bu` **required** | string | รหัส business unit |
| `enabled` | bool | เปิด/ปิด Email Automation ของ BU นี้ (default `false`) |
| `tax_ids` **required ถ้า enabled** | string[] | เลขผู้เสียภาษี 13 หลัก ไม่มีขีด ใส่ได้หลายเลข |
| `rules` | Rule[] | กติกาต่อธนาคาร ดูตารางถัดไป |

### Rule Object

| Field | Type | Description |
|---|---|---|
| `bank_code` | string \| null | ตัวระบุของ rule — `BBL` `KBANK` `SCB` `BAY` `KTC` `GHL` `PAYPAL` `SIAMPAY` หรือ `null` สำหรับอื่น ๆ |
| `bank_sender_email` | string \| null | อีเมลผู้ส่งของธนาคาร เป็นแค่ทางลัด ไม่ใส่ก็ได้ |
| `filename_pattern` | string \| null | substring ของชื่อไฟล์ ไม่สนตัวพิมพ์ · `null` = ไฟล์ไหนก็ได้ |
| `pdf_password` | string \| null | **write-only** · ไม่ส่งมา = เก็บของเดิมไว้ · ส่ง `""` = ล้างทิ้ง · ไม่เคยคืนค่ากลับ |
| `is_active` | bool | default `true` |

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "bank_code": "KTC",
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_pattern": "MDR",
      "pdf_password": "1234",
      "is_active": true
    }
  ]
}
```

### Response `200`

หน้าตาเหมือน `GET /settings` ทุกอย่าง — เอาไปอัปเดตหน้าจอต่อได้เลยโดยไม่ต้อง GET ซ้ำ

### Error Cases

| Status | Message / code | Cause |
|---|---|---|
| `422` | `invalid_checksum` | เลขผู้เสียภาษีไม่ใช่ 13 หลัก หรือ check digit ไม่ผ่าน |
| `422` | `required` | เปิด `enabled` แต่ไม่มี `tax_ids` |
| `422` | `unsupported_bank` | `bank_code` ไม่อยู่ในลิสต์ที่รองรับ |
| `409` | `Tax ID … is already registered to another BU` | เลขผู้เสียภาษีนี้ถูก BU อื่นจองไว้แล้ว |
| `400` | `Unknown business unit` | BU ยังไม่เคย login |

> ℹ️ **เลขผู้เสียภาษีเป็นของ BU เดียวเท่านั้นทั้งระบบ** ถ้าชนแปลว่ามีคนพิมพ์ผิด
> ช่วยแสดง error นี้ให้ user เห็นด้วย
>
> เราอยากให้ Carmen **ดึงเลขนี้จาก company master มาเติมให้อัตโนมัติ** แทนที่จะให้ user พิมพ์เอง
> เลขที่พิมพ์เองคือเลขที่พิมพ์ผิดได้ — ขอทราบว่าฟิลด์ไหนในระบบ Carmen เก็บค่านี้

---

## 3. Save Posting Token

```http
PUT /api/v1/carmen/settings/token
Content-Type: application/json
```

ส่ง token ที่ Carmen ออกให้ BU นั้นมาเก็บไว้ เราใช้ token นี้ post JV

**เป็น endpoint แยกจาก `PUT /settings` โดยตั้งใจ** — การแก้ค่าตั้งธรรมดา (เพิ่ม tax id, แก้ rule)
ไม่ควรต้องส่ง secret ซ้ำทุกครั้ง

### Request Body

| Field | Type | Description |
|---|---|---|
| `host` **required** | string | hostname ของ Carmen instance |
| `bu` **required** | string | รหัส business unit |
| `token` **required** | string | **write-only** · ไม่เคยคืนค่ากลับ ไม่เคยโผล่ใน log |
| `carmen_uri` | string | origin ที่จะให้เรายิงไปหา · ไม่ส่งมา = ใช้ `https://{host}` |

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "token": "…",
  "carmen_uri": "https://hotelgroup.carmenwork.com"
}
```

### เราทดสอบ token ก่อนเก็บ

ก่อนบันทึก เรายิง `GET {carmen_uri}/Carmen.API/api/interface/department` ด้วย token นั้น
**ถ้าไม่ผ่าน จะไม่มีอะไรถูกเขียนลง DB เลย** ลูกค้าจะรู้ตั้งแต่ตอนกด save ไม่ใช่ตอนตี 3
ที่เอกสารจริงโพสต์ไม่ได้

### Response `200`

```jsonc
{
  "configured": true,
  "fingerprint": "9c1f3a2b",                        // 8 hex แรกของ sha256(token)
  "carmen_uri": "https://hotelgroup.carmenwork.com",
  "verified_at": "2026-08-04T03:15:00Z"             // ครั้งล่าสุดที่พิสูจน์ว่ายังใช้ได้
}
```

### Error Cases

| Status | code | Cause |
|---|---|---|
| `422` | `token_rejected` | Carmen ปฏิเสธ token นี้ · message บอก HTTP status ที่ได้กลับมา |
| `422` | `invalid_uri` | `carmen_uri` ไม่ผ่านการตรวจ SSRF |
| `400` | — | BU ยังไม่เคย login |

`invalid_uri` เกิดเมื่อ URL ไม่ผ่านการตรวจชุดเดียวกับที่ `/auth/exchange` ใช้อยู่แล้ว —
https เท่านั้น, ห้าม loopback หรือ private IP (ทั้งที่เขียนตรง ๆ และที่ DNS resolve ไปถึง),
และต้องอยู่ใน host allowlist ถ้ามีการตั้งไว้

### รูปแบบ error body

ทั้ง `422` ทุกแบบใน API นี้หน้าตาเหมือนกัน — render จาก `errors[]` ส่วน `detail` ไว้ลง log

```jsonc
{
  "detail": "Carmen rejected this token (HTTP 401)",
  "errors": [
    { "field": "token", "code": "token_rejected",
      "message": "Carmen rejected this token (HTTP 401)" }
  ]
}
```

---

## 4. Get Token Status

```http
GET /api/v1/carmen/settings/token?host={host}&bu={bu}
```

เช็คว่า BU นั้นมี token อยู่ไหมและยังใช้ได้อยู่หรือเปล่า — **ไม่มีทางอ่านค่า token กลับมาได้**

### Response `200`

```jsonc
{
  "configured": true,
  "fingerprint": "9c1f3a2b",
  "carmen_uri": "https://hotelgroup.carmenwork.com",
  "verified_at": "2026-08-04T03:15:00Z"
}
```

| Field | หมายความว่า |
|---|---|
| `configured` | `false` = ยังไม่มี token หรือถูกลบไปแล้ว → เราโพสต์ให้ไม่ได้ |
| `fingerprint` | ใช้อ้างอิงว่า "ใบไหน" ตอนคุยกันใน ticket โดยไม่ต้องเปิดค่าจริง |
| `verified_at` | `null` = เคยมี token แต่ครั้งล่าสุดที่เช็คแล้วใช้ไม่ได้ → ควรออกใบใหม่ |

---

## 5. Delete Token

```http
DELETE /api/v1/carmen/settings/token?host={host}&bu={bu}
```

### Response `204`

ไม่มี body

> ⚠️ **อันนี้ลบแค่สำเนาของเรา ไม่ได้เป็นการเพิกถอน**
> ใบที่เราลบทิ้งยังเป็น credential ที่ใช้ได้อยู่ในที่อื่นทุกที่
> **Carmen เท่านั้นที่เพิกถอนได้ และต้องทำ** ไม่งั้นค่าที่ตั้งไว้กับ credential จะไม่ตรงกัน
>
> ขอให้ผูก "เพิกถอน + `DELETE`" ไว้กับตอนลูกค้าปิดสวิตช์ Email Automation

### การ Rotate

**ไม่มี endpoint rotate แยก และไม่ต้องเขียนอะไรเพิ่ม** — rotate คือปิดแล้วเปิด:
เพิกถอนใบเก่า → mint ใบใหม่ → `PUT /settings/token` อีกครั้ง `PUT` ทับของเดิมเสมอ

---

## Token ที่ Carmen ออกให้ — สิ่งที่เราทำกับมัน

| | |
|---|---|
| เก็บยังไง | เข้ารหัส (Fernet) 1 แถวต่อ 1 BU — ต้อง**เข้ารหัส**ไม่ใช่ hash เพราะเราต้องเอาค่าจริงยิงกลับไปให้ Carmen ส่วน API key ที่ Carmen ถือของเรานั้น hash เพราะเราแค่ตรวจ |
| คืนค่าไหม | ไม่เคย ทั้งใน response และใน log — log มีแค่ `fingerprint` |
| เช็คตอนไหน | ตอน save 1 ครั้ง และวันละ 1 ครั้งหลังจากนั้น ด้วย `GET /department` เดิม |
| ตายแล้วรู้ไหม | รู้ภายใน 24 ชม. เพราะ token ไม่มีวันหมดอายุ = ไม่มีอะไรมาบอกว่าถูกเพิกถอนแล้ว ถ้าไม่เช็ค อาการแรกคือเอกสารลูกค้าโพสต์ไม่ได้ |

ถ้าไม่อยากให้เรายิง `GET /department` ทุกวัน บอกได้ — แต่มันเป็นสิ่งเดียวที่ใช้แทนวันหมดอายุได้

---

## สรุปสิ่งที่ Carmen ต้องทำ

| | ทำเมื่อ | ทำอะไร |
|---|---|---|
| 1 | ลูกค้าเปิดสวิตช์ | mint token ของ BU แล้ว `PUT /api/v1/carmen/settings/token` |
| 2 | ลูกค้าปิดสวิตช์ | เพิกถอน token ฝั่ง Carmen แล้ว `DELETE /api/v1/carmen/settings/token` |
| 3 | ตลอด | JV endpoint รับ token นั้นได้ |

**ไม่มีข้อ 4** — rotate, เช็คว่ายังใช้ได้ไหม, fingerprint, แจ้งเตือนตอนตาย อยู่ฝั่งเราหมด

### เรื่องที่ยังรอคำตอบจาก Carmen

| | เรื่อง | บล็อกอะไร |
|---|---|---|
| 1 | URL ของ webhook endpoint + ช่องทางแลก secret | webhook ทั้งหมด |
| 2 | ฟิลด์ไหนใน company master เก็บเลขผู้เสียภาษีของ BU | การเปิดใช้ฟีเจอร์ |
| 3 | อยากได้ event `document.posted` / `document.failed` ไหม | การรายงานผลกลับ |
| 4 | ยืนยันว่า Email Automation ผูกกับ package รายเดือนอย่างเดียว | logic เรื่องสิทธิ์ |
| 5 | ยืนยันว่าแยก JV ที่ระบบโพสต์เองออกจากที่คนโพสต์ได้ ผ่าน `JvhSource` | การตรวจสอบย้อนหลัง |

ข้อ 5 สำคัญกว่าที่เห็น — JV พวกนี้ไม่มีคนเห็นเอกสารเลยสักคน ตอน audit ย้อนหลังต้องแยกออก
