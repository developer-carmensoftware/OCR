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

### ตัวเลขที่วัดจริง (2026-11-25)

วัดบน dev Carmen (`dev.carmen4.com`), คู่ค้า `C001` (ประวัติ 84 แถว), LLM จริง, รันจากเครื่อง dev (ไม่ใช่ Render); ตัวอย่าง 4–15 ครั้งต่อแบบ จึงใช้ดูสัดส่วน ไม่ใช่ค่า production

| ช่วง | p50 | ช่วงที่เจอ |
|---|---|---|
| ดึง account + dept จาก Carmen: ต่อกัน (เดิม) | 74 ms | 67–99 |
| ดึง account + dept จาก Carmen: `gather` (ใหม่) | 50 ms | 45–69 |
| ดึงประวัติคู่ค้า, cache ว่าง | 229 ms | 45–1,294 |
| ดึงประวัติคู่ค้า, cache มี | 0 ms | 0 |
| ทั้งเส้น: ทุกรายการตรงประวัติ (ไม่เรียก LLM) | 4 ms | 4–5 |
| ทั้งเส้น: มีรายการใหม่ → LLM | 2,662 ms | 1,152–4,602 (สองชุด) |

อ่านผล:
- **คอขวดคือ LLM** (ราว 0.8–2.5 วินาที แกว่งมาก) Carmen ทั้งหมดรวมไม่ถึง 300 ms แม้ cache ว่าง
- **รายการที่ตรงประวัติเร็วอยู่แล้ว** (4 ms) ไม่ต้องทำอะไรเพิ่ม
- `log_llm_usage` ถูก `await` ใน request path ก่อนตอบกลับ: ประมาณ 330 ms ในการวัด (insert ล้มเหลวเพราะไม่มี tenant context และเครื่องวัดอยู่ไกล DB จึงอาจต่างบน Render) — จุดเดียวในโค้ดเราเองที่ลดได้ ยังไม่ได้แก้

## 2. สิ่งที่ทำแล้ว (PR #415)

| # | การเปลี่ยนแปลง | ผล |
|---|---|---|
| 1 | เรียก `get_account_codes` กับ `get_departments` พร้อมกันด้วย `asyncio.gather` ใน `/suggest`, `email_automation/pipeline.py::_suggest_missing_mappings`, `pms/mapping.py::masters()` | วัดแล้วประหยัดได้ ~24 ms (74→50 ms p50) น้อยกว่า 1% ของเวลา `/suggest` ที่มี LLM — ถูกต้องแต่แทบไม่รู้สึก |
| 2 | Step 3→4 (`goToAccount`) เรียก `autoSuggest` อัตโนมัติ เฉพาะแถวที่ยังไม่มี dept/account ไม่เปิด modal ไม่ทับแถวที่ map แล้ว ([useAPSubmission.ts](../frontend/src/features/ap-invoice/hooks/useAPSubmission.ts), [useAPInvoice.ts](../frontend/src/features/ap-invoice/hooks/useAPInvoice.ts)) | ผู้ใช้ไม่ต้องกดปุ่ม AI Suggest เอง; ความหน่วงยังมีแต่เริ่มนับตั้งแต่เข้าหน้า |
| 3 | `glDeptsRef` (promise) ให้ `runSuggest` รอ departments ก่อนตรวจ DefaultAccount | กัน race: autoSuggest เริ่มใน tick เดียวกับ `loadGLData` ขณะ `masterDepts` ยังว่าง |

ทดสอบ: unit (3 เคสใน `F2b: autoSuggest`) + Playwright E2E บน browser จริง 4 เคส ผ่าน

## 3. ทำไมไม่ prefetch ที่ `/extract`

- ตอน extract เสร็จ **ยังไม่รู้ column mapping (Step 2) และ `vn_code` ของคู่ค้า (Step 3)** → ยังไม่มี input ที่ถูกต้องให้ suggest
- ผู้ใช้ที่ทิ้งเอกสารหลัง upload จะเสีย LLM call เปล่า (และ `/extract` ถูกคิดเงินแล้ว แต่ suggest ไม่ได้คิด → ต้นทุนเราเอง)
- "ผลลัพธ์ 0ms" ใช้ได้เฉพาะรายการที่ตรงประวัติ ซึ่งตอนนี้เร็วอยู่แล้ว (cache hit ไม่เรียก LLM)

ถ้าจะ prefetch จริง ต้องยิงหลังผู้ใช้ยืนยัน Step 3 (รู้ `vn_code`) ซึ่งก็คือจุดที่ `autoSuggest` ทำอยู่ตอนนี้ — ส่วนต่างที่เหลือคือเวลาที่ผู้ใช้ดูหน้า Step 4 ก่อนกด ซึ่งได้ผลน้อย

## 4. งานที่ยังเหลือ (เรียงตามคุ้มค่า)

1. **ย้าย `log_llm_usage` ออกจาก request path** (เขียนหลังตอบกลับ) — น่าจะลดได้ราว 300 ms ต่อครั้งที่เรียก LLM; ต้องวัดซ้ำบน Render และระวังไม่ให้ทำให้ log หายเมื่อ process ปิด
2. **วัดบน production/QA จริง** — `#/admin/performance` มี request ของ `/suggest` แค่ 2 แถวใน 21 วัน ต้องรอ traffic ก่อนอ้างตัวเลข p50/p95
3. **ทดสอบ E2E ในเบราว์เซอร์กับคู่ค้าที่มีประวัติ** — เส้นทาง bypass วัดระดับ service แล้ว (4 ms) แต่ E2E ผ่านเบราว์เซอร์ยังไม่ครอบคลุม
4. ~~Cache GL master ฝั่ง backend~~ — **ตัดออก:** Carmen accounts+depts รวมไม่ถึง 300 ms ไม่ใช่คอขวด
5. **เปลี่ยนโมเดล AP เป็น GA** `gemini-3.1-flash-lite` (ตอนนี้ `-preview`) — แยก PR หลัง QA; ดู [model_research_report.md](model_research_report.md) (ราคา/provider ตรวจกับ API แล้ว; benchmark ความแม่นยำยังไม่มี)
6. release note ประจำเดือน (`releaseNotes.ts`) — user-visible: auto-suggest ตอนเข้า Step 4

## 5. สิ่งที่ไม่ควรสัญญา

เป้า "< 50ms" ใช้ไม่ได้กับรายการที่ต้องผ่าน LLM (network ไป OpenRouter อย่างเดียวก็เกินแล้ว) เป้าที่ตรวจสอบได้: *ไม่ต้องกดปุ่ม* และ *รายการที่ตรงประวัติไม่แตะ LLM* ทั้งสองข้อเป็นจริงแล้ว
