# AI Status API — สเปกสำหรับทีม Carmen

**Audience:** ทีม Carmen ที่ทำ AI Sales Popup · อัปเดต 2026-10-19 · ตรงกับ PR #295

หน้าเว็บ Carmen เรียก API นี้ครั้งเดียวต่อ login เพื่อเอาตัวเลขไปเลือก AI Sales Popup ของ BU นั้น
เราส่งตัวเลข ส่วน Carmen เป็นคนตัดสินว่าจะแสดง popup แบบไหน

## Request

```http
GET {base}/api/v1/carmen/ai-status?uri=<uri>&bu=<bu>
Authorization: <Carmen token ของผู้ใช้ที่ login อยู่>
```

| ส่วน | ค่า |
| --- | --- |
| `uri` | Carmen origin ตัวเดียวกับที่ส่งในลิงก์ SSO เช่น `https://dev.carmen4.com` (เราอ่านแค่ hostname) |
| `bu` | รหัส BU ตัวเดียวกับในลิงก์ SSO (ตัวพิมพ์เล็กหรือใหญ่ก็ได้) |
| `Authorization` | token ของผู้ใช้ในรูปเดิมที่ Carmen ใช้อยู่ (`<hash>\|<user uuid>`) ไม่ต้องมี `Bearer` นำหน้า เราตรวจ token นี้กับ Carmen ของ BU นั้นก่อนตอบทุกครั้ง |

## Response

ตอบ 200 พร้อม JSON ที่มี 3 field

| Field | Type | ความหมาย |
| --- | --- | --- |
| `paid` | boolean | `true` = BU นี้จ่ายเงินแล้ว คือมี plan ที่ยังไม่หมดอายุ หรือเคยซื้อ top-up |
| `trial` | object \| null | การใช้งานช่วงทดลองฟรี เป็น `null` เมื่อ `paid` เป็น `true` |
| `trial.used` | integer | จำนวนเอกสารทดลองที่ใช้ไป (0 ถึง `total`) ไม่นับเอกสารที่สแกนไม่สำเร็จและได้ credit คืน |
| `trial.total` | integer | จำนวนเอกสารทดลองฟรีทั้งหมด ตอนนี้เป็น 30 ให้อ่านจาก field นี้ อย่า hardcode |
| `modules` | object | จำนวนเอกสารต่อ product นับตั้งแต่เริ่มใช้ key คือ `ap_invoice` (AP Invoice) และ `jv` (AI JV Automation / Credit Card) ถ้า product ไหนไม่เคยใช้จะไม่มี key นั้น ใช้แสดงผลเท่านั้น |

ยังอยู่ช่วงทดลอง ใช้ไป 26 จาก 30:

```json
{"paid": false, "trial": {"used": 26, "total": 30}, "modules": {"ap_invoice": 2, "jv": 24}}
```

จ่ายเงินแล้ว:

```json
{"paid": true, "trial": null, "modules": {"ap_invoice": 40}}
```

ยังไม่เคยใช้ รวมถึง BU ที่ยังไม่เคยเปิดแอป AI เลย:

```json
{"paid": false, "trial": {"used": 0, "total": 30}, "modules": {}}
```

ผลรวมใน `modules` อาจมากกว่า `trial.used` ได้ 1–2 ใบ เพราะนับเอกสารที่ได้ credit คืนด้วย ตอนตัดสิน popup ให้ใช้ `trial.used`

## กฎของ Carmen

Carmen เป็นคนตัดสิน popup ตาม Recommended AI Popup Journey ให้เช็คตามลำดับจากบนลงล่าง และต้องเช็ค `paid` ก่อนทุกครั้ง

| Popup | เงื่อนไขจาก response |
| --- | --- |
| 05. Active Subscription (ไม่แสดง popup) | `paid` = `true` |
| 01. Never Used | `trial.used` = 0 |
| 02. Trial Active | `trial.used` 1–24 |
| 03. Near Limit | `trial.used` 25–29 |
| 04. Trial Exhausted | `trial.used` ≥ `trial.total` |

ตัวเลข 24/25 เป็นเกณฑ์ของ Carmen เอง ถ้าวันหนึ่ง `trial.total` เปลี่ยนจาก 30 ให้แก้เกณฑ์นี้ด้วย
หรือเปลี่ยนไปคิดจากจำนวนที่เหลือ (`total − used` ≤ 5)

## Error

ถ้าได้คำตอบที่ไม่ใช่ 200 ให้ไม่แสดง popup ไม่ต้องแสดง error ให้ผู้ใช้เห็น

| Status | เกิดเมื่อ |
| --- | --- |
| 401 | ไม่มี `Authorization`, รูป token ผิด หรือ Carmen ปฏิเสธ token (เช่น token หมดอายุ) |
| 400 | `uri` ไม่ใช่ https หรือเป็น host ที่ไม่อนุญาต |
| 422 | ไม่ได้ส่ง `uri` หรือ `bu` |
| 429 | เรียกถี่เกิน rate limit |
| 502 | เราติดต่อ Carmen เพื่อตรวจ token ไม่ได้ |
| 503 | ระบบ AI อยู่ในช่วง maintenance |

## การเรียกใช้

- **เรียกครั้งเดียวต่อ login จาก browser** ไม่ต้องเรียกทุกครั้งที่เปิดหน้า เพราะทุกครั้งที่เรียก เราต้องยิงไปตรวจ token กับ Carmen หนึ่งครั้ง
- **Cache:** response มี `Cache-Control: private, max-age=300` แปลว่า BU ที่เพิ่งจ่ายเงินอาจยังได้คำตอบเดิมอยู่ได้อีกไม่เกิน 5 นาที
- **Rate limit:** 20 ครั้ง/นาทีต่อ IP และ 300 ครั้ง/นาทีรวมทั้งระบบ เพดานนี้ใช้ร่วมกับ email Settings API
- **ขอบเขตของ token:** เราตรวจ token กับ Carmen host (หนึ่งกลุ่มบริษัท) ผู้ใช้ที่มี token ของ host นั้นจะอ่านได้ทุก BU ใน host เดียวกัน เหมือน email Settings API
- **เรียกแล้วไม่มีผลข้างเคียง:** การเรียกไม่สร้าง tenant ไม่แจก credit และไม่เปิด session การแจกทดลอง 30 ใบยังเกิดตอนผู้ใช้เปิดแอป AI ครั้งแรกเหมือนเดิม

## Environment และสิ่งที่ต้องยืนยัน

| Environment | `{base}` | ใช้กับ |
| --- | --- | --- |
| QA | `https://carmen-ocr-backend-xntb.onrender.com` | Carmen dev (`https://dev.carmen4.com`) |
| Production | จะแจ้งหลัง release | Carmen ของลูกค้า |

ทีม Carmen ต้องตอบก่อนขึ้น prod:

- [ ] ขอรายชื่อ origin ของ Carmen ที่จะเรียก API นี้จาก browser (หรือ pattern ของ domain) เพื่อเปิด CORS ฝั่ง prod
- [ ] ยืนยันว่าจะเรียกครั้งเดียวต่อ login ไม่ใช่ทุกครั้งที่เปิดหน้า

ทดสอบได้ด้วย Bruno collection `Carmen-AI-Status` ในนั้นมี BU บน dev ครบทั้ง 5 แบบของ popup ใส่ token ของ dev ไว้ใน `.env` ของ collection
