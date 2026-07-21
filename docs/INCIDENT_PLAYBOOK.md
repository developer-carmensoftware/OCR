# INCIDENT PLAYBOOK — Carmen AI OCR

> ถ้าระบบล่ม ทำตามขั้นตอนนี้ทีละข้อ
> Stack ปัจจุบัน: Backend = **Render** (`carmen-ocr-backend`) · Frontend = **Vercel** · DB = **Supabase Postgres** · LLM = **OpenRouter**

---

## 1. รับแจ้ง / ตรวจสอบ

| ช่องทาง | สัญญาณ |
|---|---|
| Uptime monitor (UptimeRobot) | Email/alert ว่า health endpoint ไม่ตอบ |
| Sentry | Error spike alert (ถ้าตั้ง `SENTRY_DSN` ไว้) |
| ลูกค้าแจ้ง | โทร / LINE |

**เปิด browser ไปที่ backend URL (Render):**

- `https://<backend>/livez` — ไม่ตอบ = process ตาย / service down
- `https://<backend>/readyz` — `/livez` ตอบแต่อันนี้ไม่ตอบ = ต่อ DB ไม่ได้
- `https://<backend>/api/v1/health` — endpoint เดียวกับที่ uptime monitor ใช้

---

## 2. Triage — หาสาเหตุ

### Backend ตาย / ไม่ตอบ

1. เปิด **Render dashboard → carmen-ocr-backend → Logs** ดู error ล่าสุด
2. ดู **Events / Deploys** — ล่มหลัง deploy ล่าสุดหรือไม่?
3. Free tier: service sleep หลังไม่มี traffic ~15 นาที — request แรกช้า (cold start) ไม่ใช่ incident
4. เช็ค [status.render.com](https://status.render.com) — อาจเป็นฝั่ง Render เอง

### DB ไม่ได้ (`/readyz` fail)

1. เปิด **Supabase dashboard → project → Database health**
2. เช็คจำนวน connection — Supavisor session mode มี connection cap ต่ำ (pool ฝั่งแอปตั้งไว้เล็ก 8+8, ดู CLAUDE.md) ถ้าเต็มจะเจอ `EMAXCONNSESSION`
3. เช็ค [status.supabase.com](https://status.supabase.com)

### Extract ช้า / error แต่ระบบอื่นปกติ

1. เช็ค [status.openrouter.ai](https://status.openrouter.ai) — LLM upstream คือ bottleneck หลัก (ดู LOAD_TEST_REPORT_V2)
2. ดู `llm_usage_logs` / Sentry ว่า error มาจาก OpenRouter (429/5xx) หรือโค้ดเรา
3. HTTP 429 + `Retry-After` จากระบบเรา = LLM capacity valve ทำงานตามออกแบบ ไม่ใช่ bug

### Frontend เปิดไม่ขึ้น

1. เปิด **Vercel dashboard → Deployments** — deployment ล่าสุด fail หรือไม่ → Rollback ได้จากหน้าเดียวกัน
2. ถ้า frontend ขึ้นแต่ API call fail ทุกอัน → กลับไปเช็ค backend (ข้อบน) + CORS (`ALLOWED_ORIGINS` บน Render ต้องมี origin ของ frontend)

---

## 3. แก้ไข

### กรณี: Backend process ตาย / ค้าง

Render dashboard → **Manual Deploy → "Restart service"** (หรือ "Clear build cache & deploy" ถ้า build เสีย)

### กรณี: พังหลัง deploy ล่าสุด

Render dashboard → **Deploys → เลือก deploy ก่อนหน้า → Rollback**
⚠️ ถ้า deploy นั้นมี migration ใหม่ (`supabase/migrations/`) rollback โค้ดอย่างเดียวอาจไม่พอ — ดูว่า migration เป็น additive (ปกติปลอดภัย) หรือเปลี่ยนโครงสร้างที่โค้ดเก่าไม่รู้จัก

### กรณี: Supabase ล่ม

รอฝั่ง Supabase กู้ (ดู status page) — ระบบเราไม่มี failover DB
ระหว่างนั้นแจ้งลูกค้าตามข้อ 5

### กรณี: DB เสียหาย → Restore

ดูหัวข้อ **Restore** ด้านล่าง

---

## 4. ยืนยันระบบกลับมา

```text
GET https://<backend>/livez    → {"status":"ok"}
GET https://<backend>/readyz   → {"status":"ok"}
```

จากนั้นทดสอบ flow จริง 1 รอบ: login ผ่าน Carmen SSO → extract เอกสาร 1 ใบ

---

## 5. Post-incident

- [ ] บันทึกเวลาเริ่มต้นและจบของ incident
- [ ] บันทึกสาเหตุที่พบ + ขั้นตอนที่ใช้แก้ (ลง `changelog/<วันนี้>.md`)
- [ ] แจ้งลูกค้าถ้า downtime > 15 นาที
- [ ] เพิ่ม alert rule ถ้าพบว่ายังไม่มี monitoring ตรงนั้น

---

## Restore — กู้คืนฐานข้อมูล (Supabase)

> ระบบ **ไม่มี file storage** — รูปเอกสารไม่ถูกเก็บ มีแค่ DB เท่านั้นที่ต้องกู้
> Carmen ERP เป็น source of truth ของข้อมูลบัญชีที่ submit แล้ว — ข้อมูลใน DB เราเป็น metadata/config เป็นหลัก

### Schema (โครงสร้าง)

Schema ทั้งหมดอยู่ใน `supabase/migrations/*.sql` (source of truth ใน git):

```bash
# สร้าง schema ใหม่จากศูนย์ลง project เปล่า
supabase link --project-ref <project-ref>
supabase db push
```

### Data (ข้อมูล)

1. **Supabase dashboard → Database → Backups** — restore จาก backup อัตโนมัติของ Supabase (ความถี่/ย้อนหลังขึ้นกับ plan ของ project)
2. สำรองเอง (แนะนำก่อนทำอะไรเสี่ยง):

   ```bash
   supabase db dump -f backup.sql          # โครงสร้าง + seed
   supabase db dump -f data.sql --data-only
   ```

3. Restore dump กลับ: รันไฟล์ SQL ผ่าน Supabase SQL Editor หรือ `psql` ไปที่ connection string ของ project

### ตรวจสอบหลัง restore

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
```

เทียบจำนวน table กับ `supabase/migrations/` (baseline + billing/AR) แล้วเปิด `/readyz` ยืนยันว่า backend ต่อ DB ได้
Session เก่ายังใช้ได้หลัง restore เพราะ JWT เป็น stateless

---

## ติดต่อฉุกเฉิน

| บทบาท | ติดต่อ |
|---|---|
| Dev / On-call | *(ใส่เบอร์ที่นี่)* |
| Senior / Escalation | *(ใส่เบอร์ที่นี่)* |
