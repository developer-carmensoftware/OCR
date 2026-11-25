# แผนลดความหน่วงของ AI GL Suggestion (AP Invoice)

> แก้ไขให้ตรงโค้ดจริง ณ 2026-11-25 (branch `perf/gl-suggest-latency`, PR #415)
> เวอร์ชันก่อนหน้าเสนอ "Instant < 50ms" ด้วย prefetch ที่ `/extract` — **ถูกตัดออก** เหตุผลในหัวข้อ 3

---

## 1. สถานะจริงของโค้ด (As-Is)

`POST /api/v1/ap-invoice/suggest` → `suggest_for_items` ([service.py](../backend/app/services/ap_invoice/service.py)):

1. ดึง Carmen account codes + departments
2. ดึงประวัติคู่ค้า `fetch_vendor_history(vn_code)` — **มี TTL cache 15 นาที ต่อ (tenant, vn_code) อยู่แล้ว** ([vendor_history.py](../backend/app/services/ap_invoice/vendor_history.py))
3. `aggregate_history` + `match_bypass` + `normalize_description` — **มีอยู่แล้ว** รายการที่ตรงประวัติไม่ผ่าน LLM; ถ้าตรงครบทุกบรรทัด return ก่อนเรียก LLM เลย
4. เฉพาะรายการที่ไม่ตรงประวัติ → LLM (`OPENROUTER_SUGGESTION_MODEL`, ตอนนี้ `deepseek/deepseek-v4-flash`, pin ผู้ให้บริการสหรัฐผ่าน `LLM_TEXT_PROVIDER_ALLOWLIST` ตามนโยบาย PDPA)

ข้อสังเกตที่ผิดในเอกสารเดิม:
- "LLM ถูกเรียก 100% ทุกครั้ง" — ไม่จริง มี bypass ด้วยประวัติอยู่แล้ว
- ตัวเลข 2.5–4.5 วินาที / 1.2s / "ลด LLM เหลือ 15–20%" / "> 85% match" — **ไม่เคยวัดในรายงานนี้** ต้องวัดจาก `#/admin/performance` และ `llm_usage_logs` ก่อนอ้างเป็นเป้า
- Phase 1 เดิม (cache vendor history, normalize ใน `match_bypass`) ทำไว้แล้วก่อนเอกสารนี้
- GL master (accounts/departments) **ยังไม่มี cache** (ต่างจากที่เอกสารเดิมบอก) และ `credit_card/gl_suggestion.py` ไม่เกี่ยวกับ flow นี้

## 2. สิ่งที่ทำแล้ว (PR #415)

| # | การเปลี่ยนแปลง | ผล |
|---|---|---|
| 1 | เรียก `get_account_codes` กับ `get_departments` พร้อมกันด้วย `asyncio.gather` ใน `/suggest`, `email_automation/pipeline.py::_suggest_missing_mappings`, `pms/mapping.py::masters()` | ตัดเวลารอ Carmen จากผลรวมสองครั้งเหลือครั้งที่ช้ากว่า |
| 2 | Step 3→4 (`goToAccount`) เรียก `autoSuggest` อัตโนมัติ เฉพาะแถวที่ยังไม่มี dept/account ไม่เปิด modal ไม่ทับแถวที่ map แล้ว ([useAPSubmission.ts](../frontend/src/features/ap-invoice/hooks/useAPSubmission.ts), [useAPInvoice.ts](../frontend/src/features/ap-invoice/hooks/useAPInvoice.ts)) | ผู้ใช้ไม่ต้องกดปุ่ม AI Suggest เอง; ความหน่วงยังมีแต่เริ่มนับตั้งแต่เข้าหน้า |
| 3 | `glDeptsRef` (promise) ให้ `runSuggest` รอ departments ก่อนตรวจ DefaultAccount | กัน race: autoSuggest เริ่มใน tick เดียวกับ `loadGLData` ขณะ `masterDepts` ยังว่าง |

ทดสอบ: unit (3 เคสใน `F2b: autoSuggest`) + Playwright E2E บน browser จริง 4 เคส ผ่าน

## 3. ทำไมไม่ prefetch ที่ `/extract`

- ตอน extract เสร็จ **ยังไม่รู้ column mapping (Step 2) และ `vn_code` ของคู่ค้า (Step 3)** → ยังไม่มี input ที่ถูกต้องให้ suggest
- ผู้ใช้ที่ทิ้งเอกสารหลัง upload จะเสีย LLM call เปล่า (และ `/extract` ถูกคิดเงินแล้ว แต่ suggest ไม่ได้คิด → ต้นทุนเราเอง)
- "ผลลัพธ์ 0ms" ใช้ได้เฉพาะรายการที่ตรงประวัติ ซึ่งตอนนี้เร็วอยู่แล้ว (cache hit ไม่เรียก LLM)

ถ้าจะ prefetch จริง ต้องยิงหลังผู้ใช้ยืนยัน Step 3 (รู้ `vn_code`) ซึ่งก็คือจุดที่ `autoSuggest` ทำอยู่ตอนนี้ — ส่วนต่างที่เหลือคือเวลาที่ผู้ใช้ดูหน้า Step 4 ก่อนกด ซึ่งได้ผลน้อย

## 4. งานที่ยังเหลือ (เรียงตามคุ้มค่า)

1. **วัดก่อน** — latency ของ `/ap-invoice/suggest` ก่อน/หลัง deploy #415 (p50/p95 ที่ `#/admin/performance`), สัดส่วนบรรทัดที่ผ่าน bypass vs LLM
2. **ทดสอบ bypass กับคู่ค้าที่มีประวัติจริง** — E2E ที่ผ่านมายังไม่ครอบคลุมเส้นทางนี้
3. **Cache GL master ฝั่ง backend** (TTL สั้น ต่อ tenant) — คุ้มเมื่อวัดแล้วพบว่า Carmen accounts/depts เป็นส่วนใหญ่ของเวลา
4. **เปลี่ยนโมเดล AP เป็น GA** `gemini-3.1-flash-lite` (ตอนนี้ `-preview`) — แยก PR หลัง QA; ดู [model_research_report.md](model_research_report.md) (มีข้อมูลบางส่วนที่ต้องตรวจซ้ำก่อนใช้)
5. release note ประจำเดือน (`releaseNotes.ts`) — user-visible: auto-suggest ตอนเข้า Step 4

## 5. สิ่งที่ไม่ควรสัญญา

เป้า "< 50ms" ใช้ไม่ได้กับรายการที่ต้องผ่าน LLM (network ไป OpenRouter อย่างเดียวก็เกินแล้ว) เป้าที่ตรวจสอบได้: *ไม่ต้องกดปุ่ม* และ *รายการที่ตรงประวัติไม่แตะ LLM* ทั้งสองข้อเป็นจริงแล้ว
