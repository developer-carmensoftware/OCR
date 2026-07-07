# Carmen AI — OCR & Import System

ระบบนำเข้าข้อมูล Credit Card Statement และ AP Invoice โดยใช้ Vision LLM (OpenRouter / Gemini) อ่านเอกสารแล้วดึงข้อมูลออกมาเป็น Structured Data พร้อม UI สำหรับตรวจสอบและส่งเข้าระบบ Carmen ERP อัตโนมัติ

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite (port 3010) — deployed on **Vercel** |
| Backend | FastAPI + Python 3.12 (port 8010) — deployed on **Render** ([render.yaml](render.yaml)) |
| Database | PostgreSQL via **Supabase** (Supavisor session-mode pooler) |
| Migrations | Supabase CLI — `supabase/migrations/*.sql`, apply with `supabase db push` |
| OCR / Extraction | OpenRouter Vision LLM (Gemini 2.5 Flash Lite) |
| Auth | Carmen SSO → JWT + Fernet-encrypted session |
| ERP Integration | Carmen Cloud API (proxied via backend) |
| Background jobs | pg_cron + pg_partman inside Postgres (see [docs/Database_Design.md](docs/Database_Design.md)) |

---

## Quick Start

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in required keys
uvicorn app.main:app --reload --port 8010

# Frontend  (http://localhost:3010 — proxies /api/* → :8010)
cd frontend
npm install --legacy-peer-deps
npm run dev

# Schema changes — apply to remote Supabase project
supabase db push
```

See [CLAUDE.md](CLAUDE.md) for full architecture and design decisions.

---

## Environment Variables (`backend/.env`)

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SUGGESTION_MODEL=google/gemini-2.0-flash-lite
OPENROUTER_AP_INVOICE_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?sslmode=require

# Secrets — NEVER put these in the system_configs DB table
OCR_JWT_SECRET=<strong-random-secret>
ADMIN_JWT_SECRET=<different-strong-random-secret>   # must differ from OCR_JWT_SECRET
SESSION_ENCRYPTION_KEY=<fernet-key>
INTERNAL_JOB_TOKEN=<hex-64-chars>   # must match vault.secrets 'internal_job_token'

APP_PORT=8010
MAX_FILE_SIZE_MB=20
```

Production additionally requires `ALLOWED_ORIGINS` (no wildcard), `ALLOWED_CARMEN_HOSTS`, and `TRUST_PROXY` — see [render.yaml](render.yaml) and CLAUDE.md.

---

## Key Endpoints

Base URL: `http://localhost:8010`

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/auth/exchange` | Carmen SSO → OCR session JWT |
| `POST` | `/api/v1/credit-card/extract` | Upload document → structured data |
| `POST` | `/api/v1/credit-card/mapping/suggest` | AI GL account suggestion |
| `POST` | `/api/v1/ap-invoice/extract` | AP invoice extraction |
| `POST` | `/api/v1/ap-invoice/suggest` | AI GL suggestion per line item |
| `POST` | `/api/v1/carmen/gljv` | Submit credit-card JV to Carmen ERP |
| `POST` | `/api/v1/carmen/invoice` | Submit AP invoice to Carmen ERP |
| `GET` | `/api/v1/config/accounting` | Load per-BU accounting config |
| `GET` | `/api/v1/health` | Health check (uptime monitor / Render health path) |
| `GET` | `/livez` / `/readyz` | Liveness / readiness (DB) probes |
| `GET` | `/docs` | Swagger UI |

Additional surfaces: `/api/v1/credits/*` (pricing catalog, orders, proforma/tax-invoice billing) and `/api/v1/admin/*` (admin dashboard: auth, tenants, sessions, usage, monitoring, credits, maintenance).

---

## Supported Banks

BBL · KBANK · SCB · BAY · KTC · GHL · PAYPAL · SIAMPAY

(KTC / GHL / PAYPAL / SIAMPAY เป็น processor *fee invoice* layouts — ดูรายละเอียดใน CLAUDE.md)

## Supported File Types

JPG · PNG · WebP · BMP · TIFF · HEIC · PDF — max 20 MB, PDF เลือกได้สูงสุด 10 หน้า
(อ่านเข้า memory เท่านั้น — ระบบไม่เก็บไฟล์เอกสาร)

---

## Development

```bash
# Run tests
cd backend && pytest tests/ -q
cd frontend && npm run test

# Lint
cd backend && ruff check app/
cd frontend && npm run lint
```

**Deploy:** push to `main` / `dev` → [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs `supabase db push` ก่อน แล้วจึงยิง Render deploy hook (migration ไปก่อนโค้ดเสมอ) — Render `autoDeploy` ปิดไว้โดยตั้งใจ

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, commit conventions, and PR checklist.
Every meaningful change must be logged in [`changelog/`](changelog/) (CI-enforced).
