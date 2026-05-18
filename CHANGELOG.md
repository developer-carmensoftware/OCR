# Changelog

## [Unreleased] — 2026-05-18

### Infrastructure

- **Testing** — 153 backend unit + integration tests (pytest); 46 frontend hook tests (vitest)
  - New: `auth/session.py` JWT/Fernet unit tests, `_validate_uri` SSRF boundary tests
  - New: Carmen proxy integration tests (account-codes, departments, gl-prefix, gljv)
  - Integration test conftest: async session override propagates context vars correctly
- **CI/CD** — GitHub Actions workflow (`ci.yml`): lint + type-check + pytest (coverage gate ≥50%) + vitest; Dependabot for pip/npm/actions
- **Observability** — `/livez` + `/readyz` health probes; Sentry SDK integrated (opt-in via `SENTRY_DSN`)
- **Deployment** — `Dockerfile` for backend + frontend (nginx); `docker-compose.yml`; `deploy.ps1` IIS deploy script; DB backup scripts (PS1 + bash)
- **Quality gates** — pre-commit hooks (ruff + prettier + file hygiene); mypy strict on `tools/`, `auth/session.py`, `exceptions.py`, `constants.py`
- **Documentation** — `CONTRIBUTING.md`; `README.md` updated (MariaDB, port 8010, current structure)

---

## [Unreleased] — 2026-05-02

### UI / UX

- **Remove "AI แนะนำ" badge from Credit Card mapping rows**
  - **What:** ลบ badge `<span>AI แนะนำ</span>` ที่แสดงข้างชื่อ field (Commission / Tax Amount / Net Amount) ออก
  - **Why:** badge ซ้ำซ้อนกับ UI อื่นและรบกวนการอ่าน; ตัวปุ่ม ✓ / ✕ ให้ข้อมูลเพียงพออยู่แล้ว
  - **File:** `frontend/src/components/credit-card/AccountMappingTable.jsx`

- **Restore ✓ / ✕ buttons after removing badge**
  - **What:** ปุ่ม ยืนยัน (✓) และ ปฏิเสธ (✕) หายไปหลังลบ badge เพราะทั้งคู่ผูกอยู่กับ condition `badge && (...)`
  - **Why:** badge ถูกลบ ทำให้ `badge = null` ซึ่ง short-circuit condition ซ่อนปุ่มไปด้วย
  - **Fix:** แยก condition เป็น `hasSuggestionButtons = meta === 'ai' || meta === 'history'` แล้วใช้แทน
  - **File:** `frontend/src/components/credit-card/AccountMappingTable.jsx`

- **Replace toast after AI Suggest (AP Invoice) with modal**
  - **What:** เปลี่ยน `showToast(...)` ที่ขึ้นทุกครั้งหลังกด AI Suggest เป็น `setModal(...)` และไม่แสดงอะไรเลยเมื่อไม่มีรายการที่ต้องแนะนำ
  - **Why:** toast ขึ้นทุกครั้งแม้ไม่มีข้อมูลใหม่ ทำให้ UX ดูวุ่นวาย; modal ให้ feedback ที่ชัดเจนกว่าและสอดคล้องกับ pattern เดียวกันกับ Credit Card OCR
  - **File:** `frontend/src/hooks/useAPInvoice.js`

- **Translate wizard step labels to English (both wizards)**
  - **What:** เปลี่ยน label และ sub-label ทุก step ของ Credit Card OCR และ AP Invoice ให้เป็นภาษาอังกฤษ รวมถึง tooltip "กลับไป Step N"
  - **Why:** ต้องการให้ UI เป็น English ทั้งระบบ
  - **Files:**
    - `frontend/src/components/common/StepWizard.jsx` — Credit Card steps
    - `frontend/src/constants/apInvoice.js` — AP Invoice steps

---

### Bug Fixes

- **Bug: Accept All ทับค่าที่ user แก้ไขเองด้วย AI suggestion เดิม (Credit Card)**
  - **Root cause:** `handleMappingChange` อัปเดต `mappings` และล้าง `suggestionMeta` แต่ **ไม่ล้าง `mainSuggestions`** ทำให้ AI suggestion เดิมค้างอยู่ใน state; เมื่อกด Accept All ฟังก์ชัน `handleAcceptAll` อ่าน `mainSuggestions` ที่ยังมีค่าเดิมแล้ว overwrite ค่าที่ user เพิ่งแก้ไป
  - **Fix:** เพิ่ม `setMainSuggestions(prev => ({ ...prev, [type]: null }))` ใน `handleMappingChange`
  - **File:** `frontend/src/hooks/useMapping.js`

- **Bug: Accept All ทับค่า payment type ที่ user แก้ไขเอง (Credit Card)**
  - **Root cause:** `handlePaymentMappingChange` ไม่ล้าง `paymentSuggestions[type]` เลย ทำให้ `handleAcceptAll` ยิ่ง overwrite ง่ายขึ้น
  - **Fix:** เพิ่ม `setPaymentSuggestions(prev => ({ ...prev, [type]: null }))` ใน `handlePaymentMappingChange`
  - **File:** `frontend/src/hooks/useMapping.js`

- **Bug: ไม่สามารถกด Suggest ซ้ำได้เมื่อมีค่าอยู่แค่ field เดียว (Credit Card)**
  - **Root cause:** filter ใน `autoSuggest` ใช้ `!dept && !acc` (AND) ทำให้ field ที่มีค่าแค่ dept หรือ acc อย่างใดอย่างหนึ่งถูกตัดออกจาก suggest ทั้งที่ยังไม่ครบ
  - **Fix:** เปลี่ยนเป็น `!dept || !acc` (OR) — suggest เมื่อยังขาดค่าใดค่าหนึ่ง
  - **File:** `frontend/src/hooks/useMapping.js` (`autoSuggest`)

- **Bug: ไม่สามารถกด Suggest ซ้ำได้เมื่อมีค่าอยู่แค่ field เดียว (Credit Card — Payment Types)**
  - **Root cause:** เดียวกันกับข้อบนแต่อยู่ใน `autoSuggestPaymentTypes`
  - **Fix:** เปลี่ยน `!dept && !acc` เป็น `!dept || !acc`
  - **File:** `frontend/src/hooks/useMapping.js` (`autoSuggestPaymentTypes`)

- **Bug: ปุ่ม AI Suggest ไม่ตอบสนองเมื่อทุก row มีค่าครบแล้ว (AP Invoice)**
  - **Root cause:** `handleAISuggest` ทำ `return` เงียบๆ เมื่อไม่มี item ให้ suggest โดยไม่แจ้งผู้ใช้ ทำให้ดูเหมือนปุ่มพัง
  - **Fix:** เปลี่ยน silent return เป็น `setModal(...)` แสดง "Mapping Complete"
  - **File:** `frontend/src/hooks/useAPInvoice.js`

- **Bug: item ที่มี AI suggestion ค้างอยู่ (pending) ไม่สามารถขอ Suggest ใหม่ได้ (AP Invoice)**
  - **Root cause:** filter ใน `handleAISuggest` ใช้ `!deptCode || !accountCode` ซึ่งตัด item ที่ AI เพิ่งใส่ค่าไว้ (แต่ยังไม่ confirm) ออกไปด้วย เพราะ `runSuggest` เขียนค่าลง `deptCode`/`accountCode` โดยตรงพร้อมกับ `_suggestDept`/`_suggestAcc`
  - **Fix:** เพิ่ม `|| item._suggestDept || item._suggestAcc` ใน filter เพื่อให้ pending item ถูก re-suggest ได้; แก้ `runSuggest` ให้ overwrite ค่าเดิมเมื่อมี `hasPending`
  - **File:** `frontend/src/hooks/useAPInvoice.js`
