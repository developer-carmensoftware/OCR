# Correction Learning Feature - Setup & Testing

## Phase 1 Implementation Complete ✅

### Components Added:

#### Backend:
1. **Database Model** (`backend/app/models.py`):
   - `CorrectionFeedback` table with columns:
     - `id` (primary key)
     - `receipt_id` (foreign key to receipts)
     - `bank_type` (index)
     - `field_name` (index)
     - `original_value` (LLM extracted)
     - `corrected_value` (user corrected)
     - `created_at` (timestamp)

2. **API Endpoint** (`backend/app/routers/feedback.py`):
   - `POST /api/v1/feedback/correction` - logs user corrections
   - Automatically created table on server startup (via init_db)

#### Frontend:
1. **API Client** (`frontend/src/lib/api/feedback.js`):
   - `logCorrection(receiptId, bankType, fieldName, originalValue, correctedValue)`
   - Non-blocking (won't break app if fails)
   - Auto-skips logging if value unchanged

2. **App State** (`frontend/src/App.jsx`):
   - `receiptId` - tracks current receipt/doc_no for logging
   - `originalDetails` - stores initial extracted values
   - `updateDetail()` - compares edits with original and logs corrections
   - Imports `logCorrection` and calls it on field changes

### How It Works:

1. When OCR extraction completes:
   - `applyExtractedData()` stores extracted values in `originalDetails`
   - `receiptId` is set to the document number

2. When user edits a detail field in Step 3:
   - `updateDetail()` compares with original value
   - If different, calls `logCorrection()` which:
     - Sends POST to `/api/v1/feedback/correction`
     - Logs: field_name, bank_type, original_value, corrected_value

3. Backend saves to `correction_feedback` table

### Testing Steps:

#### 1. **Start the backend** (if not running):
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8010
```

#### 2. **Start the frontend** (if not running):
```bash
cd frontend
npm run dev  # http://localhost:3010
```

#### 3. **Test the workflow**:
1. Upload a receipt image (JPG/PNG)
2. Select bank type
3. Click "Process" (Step 2)
4. In Step 3 (Detail Review), **edit one of the detail values**:
   - Change a `PayAmt`, `CommisAmt`, `TaxAmt`, or `Total` value
5. Check browser console (F12 → Console) for:
   ```
   [feedback] ✓ Logged correction for {fieldName} (id: {id})
   ```

#### 4. **Verify in database**:
```bash
mysql -u root -p
USE ocr_db;
SELECT * FROM correction_feedback LIMIT 10;
```

You should see:
- `receipt_id` = the doc_no you processed
- `bank_type` = selected bank (BBL/KBANK/SCB)
- `field_name` = the field you edited
- `original_value` = LLM extracted value
- `corrected_value` = your edited value

### What NOT to do yet:

❌ Analytics dashboard (Phase 2)
❌ Auto-prompt tuning (Phase 3)
❌ Field flagging (Phase 4)

### Troubleshooting:

**Issue**: `[feedback] Skipping — value unchanged`
- **Cause**: You edited the field but set it back to the original value
- **Fix**: Edit to a different value

**Issue**: Network 404 error in console
- **Cause**: Backend feedback router not registered
- **Check**: `backend/app/main.py` imports `feedback_router` and calls `app.include_router(feedback_router)`

**Issue**: `CorrectionFeedback` table doesn't exist
- **Cause**: init_db() hasn't run since models.py was updated
- **Fix**: Restart backend server

### Next Phases (Phase 2+):

- Analytics endpoint: `GET /api/v1/feedback/summary` → error patterns by field/bank
- Dashboard to visualize correction patterns
- Auto-append examples to prompts for high-error fields
- Auto-flag fields with high error rates in UI
