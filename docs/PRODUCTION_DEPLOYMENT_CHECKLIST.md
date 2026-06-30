# Production Deployment Checklist
## Frontend → Vercel | Backend → Render | Database → Supabase (PostgreSQL 17.6)

> **⚠️ Database section superseded (2026-06-15):** Database migrated from Neon to Supabase (project `ycykjisvvrrbgeiirqre`, region ap-southeast-1). Schema is now managed by Supabase CLI migrations in `supabase/migrations/` — not `reset_db.py` / `create_all()`. Log tables are partitioned monthly (pg_partman). Background jobs (summary, session-purge, pricing-sync) run as pg_cron jobs inside the DB — the 3 Python asyncio loops described below no longer exist.

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

### Archives (CSV ของ log rows)
**สิ่งที่ระบบทำตอนนี้** ([retention_service.py](backend/app/services/retention_service.py)):
`retention_service.py` มีแค่ `purge_inactive_sessions()` — ลบ `ocr_sessions` ที่ไม่ active นานกว่า 30 วัน ไม่มี CSV export, ไม่มี log deletion อัตโนมัติ

**Log tables** (`llm_usage_logs`, `audit_logs`, `performance_logs`, `outbound_call_logs`) เป็น **flat tables** — ไม่มี partition, ไม่มี retention อัตโนมัติ เมื่อ storage ใกล้เต็มค่อย export ด้วย script แล้วลบ rows เก่าด้วยมือ

**ไม่มี `RETENTION_ENABLED` env var** — config option นี้ถูกลบออกแล้ว

> ✅ **ไม่ต้องทำอะไร** สำหรับ launch — ตรวจ Neon storage เมื่อ log tables ใกล้ครบ 0.4 GB

---

## 🕒 Cron / Background Jobs Strategy

### ระบบมี 3 loops ([main.py](backend/app/main.py)):
1. `_scheduler_loop` — รัน daily: summary (`daily_usage_summary`, `daily_model_cost`, `monthly_summary`), anomaly, session purge
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

## ✅ Phase 1 — Database Migration (MariaDB → PostgreSQL) — DONE (2026-05-25)

### 1.1 Dependencies — ✅ DONE
- `asyncpg==0.30.0` in `requirements.txt`; `aiomysql` removed

### 1.2 Connection & Config — ✅ DONE
- `config.py`: `postgresql+asyncpg://` default; Neon `postgres://` → `postgresql+asyncpg://` helper; `archive_dir` removed
- `database.py`: `pool_size=10, max_overflow=40, pool_recycle=1800`; `CREATE DATABASE` block removed; PG-compatible syntax throughout

### 1.3 Migrations — ✅ DONE
- `database.py` uses `Base.metadata.create_all()` at startup (no raw DDL migration files)
- Seed data via migrations 199/200 using `ON CONFLICT DO NOTHING`
- Observability tables are **flat** (no `PARTITION BY RANGE`) — export via script when storage requires cleanup
- Migrations 201–204 registered as no-op DDL markers (DDL handled by `create_all()`)

### 1.4 ORM Upsert — ✅ DONE
- `feedback.py`, `summary_service.py`, `usage_service.py`: `on_conflict_do_update(...)` with `postgresql` dialect
- UUID PKs: `PGUUID(as_uuid=True)` with `default=uuid.uuid4` (callable, not `str(uuid.uuid4())`)

### 1.5 SQL Functions — ✅ DONE
- `anomaly_service.py`: `TO_CHAR(NOW(), 'YYYY-MM')` (was `DATE_FORMAT`)

### 1.6 Reset Script — ✅ DONE
- `reset_db.py`: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`

### 1.7 Test Results — ✅ DONE
- 137/137 unit tests pass
- Auth flow (Tenant + BU + OcrSession), submit tool, partial unique indexes, analytics services all verified against Neon

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
          value: "*"   # Carmen SSO + JWT Bearer เป็น auth จริง; CORS wildcard ปลอดภัย
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

---

## Phase 4 — Integration & Verification

### 4.1 Deployment Order
1. [ ] สร้าง Neon DB + migrations
2. [ ] Deploy Backend Render → ได้ URL backend
3. [ ] Deploy Frontend Vercel → ได้ URL frontend
4. [ ] ตรวจ CORS → backend ใช้ `ALLOWED_ORIGINS=*` (auth จริงอยู่ที่ Carmen SSO + JWT)
5. [ ] ติดตั้ง UptimeRobot ping

### 4.2 Smoke Tests
- [ ] เปิด Vercel URL → Carmen SSO redirect → JWT exchange (`/api/v1/auth/exchange` → 200)
- [ ] Credit Card OCR: upload → extract → mapping → submit → ตรวจ row ใน Neon `credit_card_transactions`
- [ ] AP Invoice OCR: upload → extract → column mapping → suggest GL → submit GLJV → ตรวจ Carmen
- [ ] ตรวจ `llm_usage_logs` มี row เข้า → log table ทำงาน
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
- [ ] Custom domain `api.carmen4.com`
- [ ] Vercel Cron / GitHub Actions cron (Layer 2)
- [ ] Render persistent disk สำหรับ archives
- [ ] Migrate production data จริง (ถ้ามี)
- [ ] CI/CD GitHub Actions workflow auto-deploy

---

## 📝 Critical Files Reference

| File | Action |
|---|---|
| [backend/requirements.txt](backend/requirements.txt) | ✅ asyncpg, aiomysql removed |
| [backend/app/config.py](backend/app/config.py) | ✅ postgresql+asyncpg default, archive_dir removed |
| [backend/app/database.py](backend/app/database.py) | ✅ PG syntax, pool, create_all-based migrations |
| [backend/app/routers/feedback.py](backend/app/routers/feedback.py) | ✅ upsert PG |
| [backend/app/services/summary_service.py](backend/app/services/summary_service.py) | ✅ upsert PG + daily_model_cost + monthly_summary |
| [backend/app/services/anomaly_service.py](backend/app/services/anomaly_service.py) | ✅ TO_CHAR |
| [backend/app/services/retention_service.py](backend/app/services/retention_service.py) | ✅ simplified — purge_inactive_sessions() only |
| [backend/app/main.py](backend/app/main.py) | port, health endpoint — **pending deploy** |
| `backend/render.yaml` (ใหม่) | Render IaC — **pending deploy** |
| [frontend/src/lib/api/client.ts](frontend/src/lib/api/client.ts) | API base URL — **pending deploy** |
| `frontend/.env.production` (ใหม่) | prod env — **pending deploy** |
| `frontend/vercel.json` (ใหม่) | Vercel config — **pending deploy** |
