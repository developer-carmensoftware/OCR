# Carmen AI — OCR & Import System

ระบบนำเข้าข้อมูล Credit Card Statement และ AP Invoice จากธนาคาร โดยใช้ Vision LLM (OpenRouter / Gemini) อ่านเอกสารแล้วดึงข้อมูลออกมาเป็น Structured Data พร้อม UI สำหรับตรวจสอบและส่งเข้าระบบ Carmen ERP อัตโนมัติ

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite (port 3010) |
| Backend | FastAPI + Python 3.12 (port 8010) |
| Database | MariaDB 11 (`carmen_ai`) |
| OCR / Extraction | OpenRouter Vision LLM (Gemini 2.5 Flash) |
| Auth | Carmen SSO → JWT + Fernet-encrypted session |
| ERP Integration | Carmen Cloud API (proxied via backend) |

---

## Quick Start

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in required keys
uvicorn app.main:app --reload --port 8010

# Frontend  (http://localhost:3010)
cd frontend
npm install --legacy-peer-deps
npm run dev
```

See [CLAUDE.md](CLAUDE.md) for full architecture and design decisions.

---

## Environment Variables (`backend/.env`)

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SUGGESTION_MODEL=google/gemini-2.0-flash-lite
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

DATABASE_URL=mysql+aiomysql://root:password@localhost:3306/carmen_ai
OCR_JWT_SECRET=<strong-random-secret>
SESSION_ENCRYPTION_KEY=<fernet-key>

APP_PORT=8010
MAX_FILE_SIZE_MB=20
```

---

## Key Endpoints

Base URL: `http://localhost:8010`

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/auth/exchange` | Carmen SSO → OCR session JWT |
| `POST` | `/api/v1/ocr/extract` | Upload image → structured data |
| `POST` | `/api/v1/ocr/submit` | Save confirmed data to DB |
| `POST` | `/api/v1/ap-invoice/extract` | AP invoice extraction |
| `POST` | `/api/v1/mapping/suggest` | AI GL account suggestion |
| `GET` | `/api/v1/config/accounting` | Load per-BU accounting config |
| `GET` | `/livez` | Liveness probe |
| `GET` | `/readyz` | Readiness probe (checks DB) |
| `GET` | `/docs` | Swagger UI |

---

## Supported Banks

BBL · KBANK · SCB

## Supported File Types

JPG · PNG · BMP · WebP · GIF · PDF (max 20 MB)

---

## Development

```bash
# Run tests
cd backend && pytest tests/ -q
cd frontend && npm run test

# Lint
cd backend && ruff check app/
cd frontend && npm run lint

# Deploy to IIS (run as Administrator)
.\deploy.ps1 -DeployPath "C:\inetpub\carmen_ai"
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, commit conventions, and PR checklist.
