# Production Deployment Checklist
## Frontend → Vercel | Backend → Render | Database → Neon (PostgreSQL)

> **Context:** ยก Carmen OCR ขึ้น production แบบ managed services
> **Decisions (อนุมัติแล้ว):** Full migrate ไป PostgreSQL · Fresh deploy ไม่มี data เก่า · Render Free tier · default `*.onrender.com` domain
> **Estimated effort:** ~12–18 ชั่วโมง

---

## 📦 Storage Strategy (Archives + Logs)

### Application Logs (stdout/stderr)
| ประเภท | จัดการอย่างไร |
|---|---|
| Application log | **Render เก็บให้ 7 วันบน free tier** (stdout/stderr capture อัตโนมัติ) → ไม่ต้องเก็บเอง |
| Error log | **Sentry** (มี integration อยู่แล้ว — แค่ตั้ง `SENTRY_DSN`) |
| File logging ใน code | ✅ ไม่มี (ตรวจแล้ว ไม่มี `FileHandler` / `RotatingFileHandler`) → ไม่ต้องปรับ |
| **Action** | ไม่ต้องทำอะไรเพิ่ม — pipe stdout เข้า Render + ส่ง errors เข้า Sentry พอแล้ว |

### Archives (CSV ของ log rows ที่ถูก retention ลบ)
**สิ่งที่ระบบทำตอนนี้** ([retention_service.py](backend/app/services/retention_service.py)):
ทุกคืน export rows เก่ากว่า 90/365 วัน จาก `performance_logs`, `outbound_call_logs`, `llm_usage_logs`, `audit_logs` → CSV ไปยัง `./archives/{table}/YYYY-MM.csv` แล้วลบจาก DB

**ปัญหาบน Render:** filesystem ephemeral → CSV หายเมื่อ restart

**ทางเลือก** (เลือกหนึ่ง):

- [ ] **Option A: Cloudflare R2 (แนะนำ)** — S3-compatible, free 10 GB storage, egress ฟรี
  - แก้ [retention_service.py](backend/app/services/retention_service.py) ใช้ `aioboto3` upload แทน `aiofiles.open()`
  - ENV: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`
- [ ] **Option B: Disable retention ตอนนี้ (เร็วที่สุด)** — ตั้ง `RETENTION_ENABLED=false` ใน Render
  - ข้อดี: deploy ได้เลย ไม่ต้องเขียนโค้ดเพิ่ม
  - ข้อเสีย: log tables โตเรื่อย ๆ → Neon free 0.5 GB จะเต็มประมาณ 6–12 เดือน
  - **แนะนำสำหรับ free tier launch — ค่อยทำ R2 ทีหลังเมื่อใกล้เต็ม**
- [ ] **Option C: Google Drive** — มี MCP integration อยู่แล้ว แต่ไม่เหมาะกับ machine-to-machine archival (rate limit, quota)

> ✅ **Recommended:** Option B ก่อน — Add Option A เป็น Phase 2 หลัง launch

---

## 🕒 Cron / Background Jobs Strategy

### ระบบมี 3 loops ([main.py:196-294](backend/app/main.py)):
1. `_scheduler_loop` — รัน daily: retention, summary, anomaly + monthly: partitions
2. `_pricing_sync_loop` — ทุก 8 ชม.: sync OpenRouter pricing
3. `_perf_flush_loop` — ทุก 10 วินาที: flush buffered logs (performance/audit/outbound)

### ปัญหากับ Render Free Tier
Render free sleep หลัง 15 นาทีไม่มี traffic → ทุก loop หยุดทันที → `_perf_flush_loop` (10s) ทำให้ buffer ค้าง (เสี่ยงข้อมูล log หาย ~10s window) และ daily job อาจไม่รันเลย

### Solution: Keep-Alive + External Trigger (Free, ไม่ต้องแก้ scheduler code)

- [ ] **Layer 1 — Keep-alive ping (สำคัญสุด):**
  - ใช้ **UptimeRobot** (free) ตั้ง HTTP monitor `https://carmen-ocr-backend.onrender.com/api/v1/health` ทุก 5 นาที
  - ผลลัพธ์: backend ไม่ sleep → ทั้ง 3 loops รันปกติ + ได้ uptime monitoring แถม
  - **เพียงพอสำหรับ free tier**

- [ ] **Layer 2 — External cron (สำรองกันหลุด, ทำเมื่อมีเวลา):**
  - เพิ่ม endpoint `POST /internal/run-job` ใน [routers/](backend/app/routers/) (guard ด้วย `X-Internal-Token` header)
  - ใช้ **Vercel Cron** (Hobby plan ฟรี 2 jobs/วัน) เรียก endpoint รายวัน
  - หรือ **GitHub Actions** `schedule: cron: '0 18 * * *'` ใน `.github/workflows/cron.yml`
  - ทำให้แม้ Layer 1 พลาด job ยังรัน

- [ ] **Layer 3 (เลื่อน):** ใช้ **Render Cron Jobs** (paid $1/job/เดือน) — รอ upgrade

> ✅ **Recommended:** เริ่มแค่ Layer 1 — เพิ่ม Layer 2 ก่อน traffic จริง

---

## Phase 1 — Database Migration (MariaDB → PostgreSQL)

### 1.1 Dependencies
- [ ] `backend/requirements.txt`: ลบ `aiomysql==0.2.0`, เพิ่ม `asyncpg==0.30.0`
- [ ] (ทางเลือก) เพิ่ม `aioboto3` ถ้าเลือก R2 archive

### 1.2 Connection & Config
- [ ] [backend/app/config.py](backend/app/config.py:56) — เปลี่ยน default `database_url` เป็น `postgresql+asyncpg://`
- [ ] [backend/app/config.py](backend/app/config.py) — เพิ่ม helper แปลง Neon's `postgres://` → `postgresql+asyncpg://`
- [ ] [backend/app/config.py](backend/app/config.py:124) — guard `os.makedirs(archive_dir)` ให้ skip ถ้า `RENDER=true` หรือ retention disabled
- [ ] [backend/app/database.py](backend/app/database.py:62) — ลด pool: `pool_size=5, max_overflow=10` (Neon free 100 conn cap แต่ shared)
- [ ] [backend/app/database.py](backend/app/database.py:121) — รื้อ `CREATE DATABASE` block (Neon สร้างผ่าน console แล้ว)
- [ ] [backend/app/database.py](backend/app/database.py:185) — `schema_migrations` table: ลบ `ENGINE=InnoDB CHARSET=utf8mb4`
- [ ] [backend/app/database.py](backend/app/database.py:199) — `INSERT IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`

### 1.3 Migrations — Squash + Rewrite
> ทาง fresh deploy → ไม่ต้อง port migration ทีละ 100+ ตัว — **squash เป็น `_m000_initial_schema_pg`**

- [ ] [backend/app/migrations.py](backend/app/migrations.py) — สร้างไฟล์ใหม่ `_m000_initial_schema_pg` มี:
  - [ ] Tables ทั้งหมดจาก `Base.metadata` (ใช้ `Base.metadata.create_all(bind=engine, checkfirst=True)` ใน startup แทน raw SQL ก็ได้)
  - [ ] Seed data (banks, modules, plans, system_configs) — แปลง `INSERT IGNORE` → `ON CONFLICT DO NOTHING`
  - [ ] Trigger function `set_updated_at()` + trigger ต่อ table ที่มี `updated_at`
  - [ ] Partitioned tables 4 ตัว ใช้ PG native `PARTITION BY RANGE (created_at)` รายไตรมาส

#### Translation cheat sheet
| MariaDB | PostgreSQL |
|---|---|
| `INT AUTO_INCREMENT PRIMARY KEY` | `SERIAL PRIMARY KEY` |
| `BIGINT AUTO_INCREMENT` | `BIGSERIAL` |
| `TINYINT(1)` | `BOOLEAN` |
| `INT UNSIGNED` | `INTEGER CHECK (col >= 0)` |
| `DATETIME` | `TIMESTAMP` (เก็บ UTC) |
| `... ON UPDATE CURRENT_TIMESTAMP` | trigger `set_updated_at()` |
| `JSON` | `JSONB` |
| `ENGINE=InnoDB CHARSET=utf8mb4` | (ลบ) |
| `INSERT IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| `TO_DAYS(col)` | direct date comparison ใน partition bound |
| `STR_TO_DATE(c, '%d/%m/%Y')` | `TO_DATE(c, 'DD/MM/YYYY')` |
| `DATE_FORMAT(NOW(), '%Y-%m')` | `TO_CHAR(NOW(), 'YYYY-MM')` |
| `ALTER TABLE x CHANGE old new T` | `ALTER TABLE x RENAME COLUMN old TO new; ALTER ... TYPE T` |

### 1.4 Partitioning Rewrite
- [ ] [backend/app/services/partition_manager.py](backend/app/services/partition_manager.py:50) — แทน `INFORMATION_SCHEMA.PARTITIONS` query ด้วย `pg_inherits` + `pg_class`
- [ ] [backend/app/services/partition_manager.py](backend/app/services/partition_manager.py:76) — แทน `REORGANIZE PARTITION` ด้วย `CREATE TABLE xxx_yYYYYqN PARTITION OF xxx FOR VALUES FROM (...) TO (...)`

### 1.5 ORM-Level Upsert Fix
- [ ] [backend/app/routers/feedback.py:7](backend/app/routers/feedback.py) — `from sqlalchemy.dialects.mysql import insert` → `postgresql`
- [ ] [backend/app/routers/feedback.py:32-51](backend/app/routers/feedback.py) — `.on_duplicate_key_update(...)` → `.on_conflict_do_update(index_elements=[...], set_={...}).returning(CorrectionFeedback.id)`
- [ ] [backend/app/routers/feedback.py:49](backend/app/routers/feedback.py) — ลบ `func.last_insert_id()`
- [ ] [backend/app/services/summary_service.py:13,46-55](backend/app/services/summary_service.py) — pattern เดียวกัน
- [ ] [backend/app/services/usage_service.py](backend/app/services/usage_service.py) — grep หา upsert + แก้

### 1.6 SQL Function Calls
- [ ] [backend/app/services/anomaly_service.py:173](backend/app/services/anomaly_service.py) — `DATE_FORMAT(NOW(), '%Y-%m')` → `TO_CHAR(NOW(), 'YYYY-MM')`

### 1.7 Reset Script
- [ ] [backend/reset_db.py](backend/reset_db.py) — ใช้ `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` แทน `DROP DATABASE`

### 1.8 Test ก่อน Deploy
- [ ] สร้าง Neon project (region: Singapore) → copy connection string
- [ ] Set `.env`: `DATABASE_URL=postgresql+asyncpg://...?ssl=require`
- [ ] รัน `python reset_db.py` → ตรวจว่า migrations รันผ่านทั้งหมด
- [ ] รัน backend local ชี้ Neon → smoke test (auth exchange, OCR extract, submit)
- [ ] ตรวจ table ใน Neon console (`SELECT * FROM banks`, `SELECT * FROM modules`)

---

## Phase 2 — Backend Deployment (Render)

### 2.1 Code Changes
- [ ] [backend/app/main.py](backend/app/main.py) — รับ port จาก `$PORT` env (uvicorn จะรับเอง แต่ตรวจ command)
- [ ] [backend/app/main.py](backend/app/main.py:309) — แก้ log `_db_root_url()` (ฟังก์ชันอาจถูกลบไป)
- [ ] เพิ่ม `/api/v1/health` endpoint (ถ้ายังไม่มี) คืน `{"ok": true, "ts": now}`
- [ ] (ทางเลือก) เพิ่ม `/internal/run-job` endpoint สำหรับ Layer 2 cron — guard ด้วย `INTERNAL_TOKEN`

### 2.2 Files ใหม่
- [ ] สร้าง `backend/render.yaml`:
  ```yaml
  services:
    - type: web
      name: carmen-ocr-backend
      runtime: python
      plan: free
      region: singapore
      buildCommand: pip install -r requirements.txt
      startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
      healthCheckPath: /api/v1/health
      envVars:
        - key: PYTHON_VERSION
          value: "3.12"
        - key: DATABASE_URL
          sync: false
        - key: OPENROUTER_API_KEY
          sync: false
        - key: OPENROUTER_BASE_URL
          value: https://openrouter.ai/api/v1
        - key: OPENROUTER_OCR_MODEL
          value: google/gemini-2.5-flash-lite
        - key: OPENROUTER_SUGGESTION_MODEL
          value: google/gemini-2.0-flash-lite
        - key: OPENROUTER_AP_INVOICE_MODEL
          value: google/gemini-2.5-flash-lite
        - key: MAX_FILE_SIZE_MB
          value: "20"
        - key: OCR_JWT_SECRET
          generateValue: true
        - key: SESSION_ENCRYPTION_KEY
          sync: false
        - key: ALLOWED_ORIGINS
          sync: false   # ใส่ Vercel URL หลัง deploy frontend
        - key: ALLOWED_ORIGIN_REGEX
          value: ^https://[a-z0-9-]+\.vercel\.app$
        - key: RETENTION_ENABLED
          value: "false"
        - key: RENDER
          value: "true"
        - key: SENTRY_DSN
          sync: false
  ```
- [ ] (ลบ) [backend/Dockerfile](backend/Dockerfile) — ไม่จำเป็นถ้าใช้ native Python runtime ของ Render

### 2.3 Render Setup Steps
- [ ] สร้าง Render account + New Web Service → connect GitHub repo
- [ ] เลือก root directory `backend/`
- [ ] Auto-detect `render.yaml` → Apply
- [ ] ใส่ secret env vars (DATABASE_URL, OPENROUTER_API_KEY, SESSION_ENCRYPTION_KEY, SENTRY_DSN)
  - `SESSION_ENCRYPTION_KEY` generate ด้วย: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- [ ] Trigger deploy → ตรวจ logs จนเห็น `✅ Database initialized` + `📅 Background scheduler started`
- [ ] ทดสอบ `curl https://carmen-ocr-backend.onrender.com/api/v1/health`

### 2.4 Keep-Alive (UptimeRobot)
- [ ] สมัคร UptimeRobot (free)
- [ ] Add monitor: HTTP(s), URL = `https://carmen-ocr-backend.onrender.com/api/v1/health`, interval 5 นาที
- [ ] ตั้ง alert ส่ง email/Slack ถ้า down

---

## Phase 3 — Frontend Deployment (Vercel)

### 3.1 Code Changes
- [ ] [frontend/src/lib/api/client.ts](frontend/src/lib/api/client.ts) — เพิ่ม `const API_BASE = import.meta.env.VITE_API_BASE_URL || ''`
- [ ] [frontend/src/lib/api/client.ts](frontend/src/lib/api/client.ts) — `apiFetch(path)` → `fetch(\`${API_BASE}${path}\`, ...)`
- [ ] ถ้ามีไฟล์อื่น call `/api/` ตรง ๆ → grep แล้วเปลี่ยนให้ใช้ `apiFetch` ผ่าน [client.ts](frontend/src/lib/api/client.ts) อย่างเดียว

### 3.2 Files ใหม่
- [ ] `frontend/.env.production`:
  ```
  VITE_API_BASE_URL=https://carmen-ocr-backend.onrender.com
  VITE_SENTRY_ENV=production
  ```
- [ ] `frontend/vercel.json`:
  ```json
  {
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "framework": "vite",
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

### 3.3 Vercel Setup Steps
- [ ] สมัคร Vercel + New Project → import GitHub repo
- [ ] Root Directory = `frontend/`
- [ ] Framework Preset = Vite (auto-detect)
- [ ] Env vars (Production scope):
  - `VITE_API_BASE_URL=https://carmen-ocr-backend.onrender.com`
  - `VITE_SENTRY_DSN=<optional>`
  - `VITE_SENTRY_ENV=production`
- [ ] Deploy → จด Vercel URL (เช่น `https://carmen-ocr-xxx.vercel.app`)
- [ ] กลับไป Render → ใส่ Vercel URL ใน `ALLOWED_ORIGINS` → redeploy backend

---

## Phase 4 — Integration & Verification

### 4.1 Deployment Order
1. [ ] สร้าง Neon DB + migrations
2. [ ] Deploy Backend Render → ได้ URL backend
3. [ ] Deploy Frontend Vercel → ได้ URL frontend
4. [ ] Update CORS `ALLOWED_ORIGINS` ใน Render → redeploy
5. [ ] ติดตั้ง UptimeRobot ping

### 4.2 Smoke Tests
- [ ] เปิด Vercel URL → Carmen SSO redirect → JWT exchange (`/api/v1/auth/exchange` → 200)
- [ ] Credit Card OCR: upload → extract → mapping → submit → ตรวจ row ใน Neon `credit_card_transactions`
- [ ] AP Invoice OCR: upload → extract → column mapping → suggest GL → submit GLJV → ตรวจ Carmen
- [ ] ตรวจ `llm_usage_logs` มี row เข้า → partitioning ทำงาน
- [ ] ตรวจ Render logs ไม่มี ERROR
- [ ] ตรวจ Sentry ไม่มี exception

### 4.3 Production Sanity
- [ ] Cold start time < 30s (request แรกหลัง sleep)
- [ ] UptimeRobot สถานะ green ติดต่อกัน 1 ชม.
- [ ] Backend memory < 512 MB (Render free cap)
- [ ] Neon storage < 0.5 GB

---

## ⚠️ Known Free Tier Limitations

| Limit | ขนาด | ผลกระทบ |
|---|---|---|
| Render free RAM | 512 MB | ระวัง LLM response ขนาดใหญ่ |
| Render free hours | 750/เดือน | ~1 service 24/7 ได้ |
| Render bandwidth | 100 GB/เดือน | พอ |
| Neon free storage | 0.5 GB | log tables อาจเต็มใน 6–12 เดือน |
| Neon free compute | 191 hours/เดือน | autosuspend หลัง 5 นาทีไม่ใช้ → cold start ~1s |
| Vercel free bandwidth | 100 GB/เดือน | พอเหลือ |
| Vercel build hrs | 6,000 นาที/เดือน | พอเหลือ |

---

## Out of Scope (Phase 2 — รอ traffic จริง)

- [ ] Upgrade Render Starter $7/mo (always-on, no sleep)
- [ ] Cloudflare R2 archive integration
- [ ] Custom domain `api.carmen4.com` + Carmen CORS regex
- [ ] Vercel Cron / GitHub Actions cron (Layer 2)
- [ ] Render persistent disk สำหรับ archives
- [ ] Migrate production data จริง (ถ้ามี)
- [ ] CI/CD GitHub Actions workflow auto-deploy

---

## 📝 Critical Files Reference

| File | Action |
|---|---|
| [backend/requirements.txt](backend/requirements.txt) | swap driver |
| [backend/app/config.py](backend/app/config.py) | URL default, ssl, archive guard |
| [backend/app/database.py](backend/app/database.py) | ลบ CREATE DATABASE, PG syntax, pool |
| [backend/app/migrations.py](backend/app/migrations.py) | **squash + rewrite PG dialect** (งานหนักสุด) |
| [backend/app/services/partition_manager.py](backend/app/services/partition_manager.py) | PG native partitioning |
| [backend/app/routers/feedback.py](backend/app/routers/feedback.py) | upsert PG |
| [backend/app/services/summary_service.py](backend/app/services/summary_service.py) | upsert PG |
| [backend/app/services/anomaly_service.py](backend/app/services/anomaly_service.py) | TO_CHAR |
| [backend/app/main.py](backend/app/main.py) | port, health endpoint |
| `backend/render.yaml` (ใหม่) | Render IaC |
| [frontend/src/lib/api/client.ts](frontend/src/lib/api/client.ts) | API base URL |
| `frontend/.env.production` (ใหม่) | prod env |
| `frontend/vercel.json` (ใหม่) | Vercel config |
