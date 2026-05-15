# Bank Receipt OCR & Import System

ระบบนำเข้าข้อมูล Credit Card Report จากธนาคาร โดยใช้ Vision LLM (OpenRouter) อ่านใบเสร็จ/ใบกำกับภาษีแล้วดึงข้อมูลออกมาเป็น Structured Data พร้อม UI สำหรับตรวจสอบและส่งเข้าระบบ Carmen

---

## Project Structure

```text
OCR/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── routers/
│   │   │   └── ocr.py        # API endpoints
│   │   ├── services/
│   │   │   ├── ocr_service.py      # orchestration
│   │   │   ├── openrouter_ocr.py   # Vision LLM call
│   │   │   └── extractor.py        # field extraction helpers
│   │   └── utils/
│   │       └── image_processing.py # resize / preprocess
│   ├── .env                  # API keys (ไม่ commit)
│   ├── .env.example
│   └── requirements.txt
│
└── frontend/                 # React + Vite frontend
    ├── src/
    │   ├── App.jsx           # state & orchestration
    │   ├── main.jsx
    │   ├── index.css
    │   ├── constants/
    │   │   └── index.js      # BANKS, DETAIL_COLUMNS, EMPTY_DETAIL_ROW
    │   ├── lib/
    │   │   ├── ocrApi.js     # calls OCR backend
    │   │   └── carmenApi.js  # calls Carmen API
    │   └── components/
    │       ├── UploadSection.jsx
    │       ├── ActionBar.jsx
    │       ├── HeaderCard.jsx
    │       ├── DetailTable.jsx
    │       ├── FormActions.jsx
    │       └── DocumentPreview.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite |
| Backend | FastAPI (Python) |
| OCR / Extraction | OpenRouter Vision LLM (Gemini 2.5 Flash) |
| Database | SQLite async (aiosqlite + SQLAlchemy) |
| Image Processing | Pillow |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenRouter API Key — [openrouter.ai/keys](https://openrouter.ai/keys)

---

### 1. Backend Setup

```bash
cd backend

# สร้าง virtual environment
python -m venv venv
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# ติดตั้ง dependencies
pip install -r requirements.txt

# ตั้งค่า environment
cp .env.example .env
# แก้ไข .env แล้วใส่ OPENROUTER_API_KEY

# รัน server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

npm install
npm run dev
# เปิดที่ http://localhost:3000
```

> Vite จะ proxy `/api/*` ไปยัง `http://localhost:8000` โดยอัตโนมัติ

---

## Environment Variables

ไฟล์ `backend/.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=google/gemini-2.5-flash-preview
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

APP_HOST=0.0.0.0
APP_PORT=8000

MAX_FILE_SIZE_MB=20
UPLOAD_DIR=./uploads
DATABASE_URL=sqlite+aiosqlite:///./ocr_database.db
```

---

## API Endpoints

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/ocr/extract` | อัปโหลดไฟล์ ให้ AI อ่านและดึงข้อมูล |
| `GET` | `/ocr/tasks` | ดูรายการ task ทั้งหมด |
| `GET` | `/ocr/tasks/{id}` | ดูผลลัพธ์ task ตาม ID |
| `GET` | `/ocr/export` | Export ข้อมูลทั้งหมดเป็น CSV |
| `GET` | `/ocr/health` | Health check |

Swagger UI: `http://localhost:8000/docs`

---

## Extracted Fields

| Field | คำอธิบาย |
| --- | --- |
| `bank_name` | ชื่อธนาคาร |
| `doc_name` | ประเภทเอกสาร |
| `company_name` | ชื่อบริษัท |
| `doc_date` | วันที่เอกสาร |
| `doc_no` | เลขที่เอกสาร |
| `terminal_id` | Terminal ID |
| `pay_amt` | ยอดชำระ |
| `commis_amt` | ค่าธรรมเนียม |
| `tax_amt` | ภาษีมูลค่าเพิ่ม |
| `wht_amount` | ภาษีหัก ณ ที่จ่าย |
| `total` | ยอดรวมสุทธิ |

---

## Supported Banks

- Bangkok Bank (BBL)
- Kasikornbank (KBANK)
- Siam Commercial Bank (SCB)

## Supported File Types

- Images: JPG, PNG, BMP, WebP, GIF
- Documents: PDF
