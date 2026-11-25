# รายงานการวิจัยและประเมินผล AI Models บน OpenRouter เพื่อเพิ่มประสิทธิภาพและคุมต้นทุน

> แก้ไข 2026-11-25: ราคา/context/provider ตรวจซ้ำกับ OpenRouter API (`/api/v1/models`, `/models/{id}/endpoints`) แล้ว; ผล benchmark (หัวข้อ 3) **ไม่ใช่หลักฐานพอ** ตัดสินใจเปลี่ยนโมเดลไม่ได้ ดูหมายเหตุในหัวข้อนั้น

## 1. วัตถุประสงค์ (Executive Summary)
โปรเจกต์ OCR & AP Invoice Extraction ปัจจุบันมีโมเดล AI ทำงานหลักอยู่ 3 ส่วนตามที่กำหนดใน `.env`:
1. **Receipt / Credit Card OCR Vision**: `google/gemini-2.5-flash-lite`
2. **AP Invoice Extraction**: `google/gemini-3.1-flash-lite-preview`
3. **GL Expense Suggestion (Text)**: `deepseek/deepseek-v4-flash`

การวิจัยในครั้งนี้มีจุดประสงค์เพื่อสำรวจและทดสอบโมเดลใหม่ๆ ในตลาด OpenRouter ว่ามีโมเดลใดที่มี **Performance (ความแม่นยำ, ความเร็ว, Context, การปฏิบัติตามคำสั่ง JSON)** สูงขึ้น ในขณะที่ **ราคา (Pricing) เท่าเดิมหรือใกล้เคียงเดิม** เพื่อพิจารณาปรับเปลี่ยนหรือคงโมเดลเดิมไว้

---

## 2. การสำรวจราคาและคุณสมบัติบน OpenRouter ณ ปัจจุบัน

จากการดึงข้อมูลโมเดลล่าสุด (472 โมเดล ณ 2026-11-25) บน OpenRouter API ได้ผลเปรียบเทียบในหมวดหมู่ที่เกี่ยวข้องดังนี้:

### ตารางเปรียบเทียบ Vision Models (สำหรับ OCR และ AP Invoice)

| Model Name / ID | Input Price ($/1M tokens) | Output Price ($/1M tokens) | Context Window | Modality | Status / ข้อสังเกต |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **google/gemini-2.5-flash-lite** *(ปัจจุบัน OCR)* | **$0.10** | **$0.40** | 1,048,576 | Text+Vision | ราคาถูกที่สุดในตาราง ใช้กับ OCR ใบเสร็จ/สลิป |
| **google/gemini-3.1-flash-lite** *(GA Release)* | **$0.25** | **$1.50** | 1,048,576 | Text+Vision | รุ่น GA ของ preview ราคาเท่ากันทุกประการ (ข้อสังเกตเรื่อง latency ผันผวนไม่มีข้อมูลรองรับ) |
| **google/gemini-3.1-flash-lite-preview** *(ปัจจุบัน AP)* | **$0.25** | **$1.50** | 1,048,576 | Text+Vision | ใช้อยู่ใน AP; ชื่อ `-preview` อาจถูกถอนได้ |
| **google/gemini-3.5-flash-lite** *(โมเดลใหม่)* | **$0.30** | **$2.50** | 1,048,576 | Text+Vision | แพงกว่า 3.1 (input +20%, output +67%); ยังไม่มีผลทดสอบกับใบแจ้งหนี้จริง |
| **google/gemini-2.5-flash** | **$0.30** | **$2.50** | 1,048,576 | Text+Vision | ราคา input 3 เท่า / output 6.25 เท่าของ 2.5-flash-lite |
| **openai/gpt-4o-mini** | **$0.15** | **$0.60** | 128,000 | Text+Vision | Context 128k เทียบ 1M; ไม่มีข้อมูลทดสอบภาษาไทยในรายงานนี้ |

---

### ตารางเปรียบเทียบ Text-only / Suggestion Models (สำหรับ GL Account Mapping)

| Model Name / ID | Input Price ($/1M tokens) | Output Price ($/1M tokens) | Providers รองรับ | ข้อสังเกต |
| :--- | :---: | :---: | :---: | :--- |
| **deepseek/deepseek-v4-flash** *(ปัจจุบัน)* | **$0.09** | **$0.18** | Fireworks, DeepInfra (+ผู้ให้บริการอื่นอีกหลายราย) | ใช้อยู่ใน production; ความเร็ว/ความแม่นยำยังไม่ได้วัดในรายงานนี้ (ดู `llm_usage_logs`) |
| **deepseek/deepseek-v4.1-flash** | **$0.14** | **$0.42** | DeepInfra, Fireworks, DigitalOcean ฯลฯ (ราคาต่อ provider $0.05–1.5) | แพงกว่า v4-flash 1.6x/2.3x ไม่ใช่ถูกกว่า; รองรับ reasoning (ผลต่อ `content` ยังไม่ได้ทดสอบ) |
| **qwen/qwen3.8-flash** | **$0.15** | **$0.47** | Alibaba | provider หลักคือ Alibaba/Featherless — **ไม่อยู่ใน allowlist** จึงใช้ไม่ได้ตามนโยบาย |

> [!IMPORTANT]
> **ข้อกำหนดเชิงนโยบาย (Data Privacy & Routing Policy)**:
> backend ตั้ง `LLM_TEXT_PROVIDER_ALLOWLIST=fireworks,deepinfra,digitalocean` และ boot check `text_model_unroutable` ตรวจว่าโมเดล suggestion มี provider ใน allowlist อย่างน้อยหนึ่งราย โมเดล Google ไม่ผ่านเพราะไม่มี provider เหล่านั้น ดังนั้นต้องใช้โมเดลที่ Fireworks/DeepInfra/DigitalOcean เสิร์ฟ (ตระกูล DeepSeek ทำได้)

---

## 3. ผลการทดสอบประสิทธิภาพจริง (Empirical Benchmark)

### การทดสอบ Vision OCR จากภาพตัวอย่าง (Latency & JSON Output Strictness)

> ⚠️ **ข้อจำกัด:** ทดสอบด้วย *ภาพหน้าจอระบบ* ไม่ใช่ใบแจ้งหนี้/ใบเสร็จจริง จำนวนตัวอย่างและจำนวนรอบไม่ได้บันทึก และ latency ต่างกันไม่ถึง 0.25 วินาที (อยู่ในความผันผวนปกติของ network) จึงสรุปความแม่นยำหรือเปลี่ยนโมเดลจากข้อมูลนี้ไม่ได้ ก่อนเปลี่ยนต้องรันชุดใบแจ้งหนี้จริงเทียบกับ ground truth

ผลที่บันทึกไว้:

1. **google/gemini-2.5-flash-lite**:
   - ความเร็วเฉลี่ย: **2.17 วินาที**
   - รูปแบบคำตอบ: คืน Raw JSON ตามสั่งทันที มีความกระชับ ไม่เยิ่นเย้อ
   - ความแม่นยำ: ไม่ได้วัดกับเอกสารจริง

2. **google/gemini-3.1-flash-lite-preview** (ปัจจุบันใช้ใน AP Invoice):
   - ความเร็วเฉลี่ย: **2.39 วินาที**
   - รูปแบบคำตอบ: มักใส่คำอธิบายภาษาไทยและ Markdown บรรยายเพิ่มก่อนคืน JSON (ฝั่งโค้ดมี `parse_vision_json` ใน `llm/client.py` รองรับกรณีนี้อยู่แล้ว)
   - ความแม่นยำ: ไม่ได้วัดกับใบแจ้งหนี้หลายหน้า

3. **google/gemini-3.5-flash-lite** (ตัวเลือกใหม่):
   - ความเร็วเฉลี่ย: **2.27 วินาที**
   - รูปแบบคำตอบ: คืนโครงสร้าง JSON ล้วนแบบมี nested hierarchy ชัดเจนมาก
   - ความแม่นยำ: เข้าใจ field ของภาพหน้าจอ API (method + endpoint) ดี — ไม่เกี่ยวกับงานบัญชี

---

## 4. บทวิเคราะห์และข้อเสนอแนะ (Recommendation)

### 1) ส่วน OCR ใบเสร็จ/บัตรเครดิต (`OPENROUTER_OCR_MODEL`)
* **สถานะ**: **คงไว้ที่ `google/gemini-2.5-flash-lite`**
* **เหตุผล**:
  - ราคาถูกมากเพียง **$0.10 / $0.40** ต่อ 1 ล้านโทเค็น
  - ไม่มีหลักฐานว่ารุ่นอื่นดีกว่า (ดูข้อจำกัดของ benchmark) และไม่มีเหตุให้จ่ายแพงขึ้น
  - ตัวเลข "ถูกต้อง 100%" ในฉบับก่อนไม่มีที่มา — ใช้ `correction_feedback` วัดอัตราแก้ไขจริงแทน

### 2) ส่วน AP Invoice Extraction (`OPENROUTER_AP_INVOICE_MODEL`)
* **ตัวเลือกที่ 1 (แนะนำ, แยก PR หลังผ่าน QA)**: **`google/gemini-3.1-flash-lite`** (GA ของรุ่นที่ใช้อยู่)
  - ราคาเท่าเดิม: **$0.25 / $1.50**; ข้อดีคือเลี่ยงความเสี่ยงที่ tag `-preview` ถูกถอน
  - ต้องรัน AP E2E / ชุดใบแจ้งหนี้จริงก่อน เพราะ GA อาจต่างจาก preview เล็กน้อย
* **ตัวเลือกที่ 2 (ยังไม่แนะนำ)**: **`google/gemini-3.5-flash-lite`** ($0.30 / $2.50: output แพงขึ้น 67%)
  - คำกล่าวอ้างเดิมว่าสกัดตาราง/ภาษี/เลขใบกำกับภาษีได้ดีกว่า **ไม่มีหลักฐานรองรับ** คุ้มเมื่อชุดทดสอบจริงพิสูจน์ว่าแก้ไขน้อยลงเท่านั้น

### 3) ส่วน GL Expense Suggestion (`OPENROUTER_SUGGESTION_MODEL`)
* **สถานะ**: **คงไว้ที่ `deepseek/deepseek-v4-flash`**
* **เหตุผล**:
  - ราคาถูกมาก (**$0.09 / $0.18**)
  - ราคาต่ำกว่า v4.1-flash ($0.14 / $0.42) และ qwen3.8-flash
  - `v4.1-flash` ไม่ได้ถูกกว่า และ `qwen3.8-flash` ติด allowlist; ส่วนเรื่อง reasoning/`content: null` — `call_text_llm` คืน `None` เมื่อ content ว่าง (ไม่ใช่ `NoneType` error) ผู้เรียกจึงเห็นเป็น suggestion ว่าง ไม่ crash
  - ความเร็ว "~1.2 วินาที" ไม่ได้วัดในรายงานนี้
  - อยู่ใน `LLM_TEXT_PROVIDER_ALLOWLIST` (Fireworks, DeepInfra)

---

## 5. ตารางสรุป Action Plan

| รายการ | โมเดลปัจจุบัน | โมเดลที่แนะนำ | ผลลัพธ์ด้านราคา | ผลลัพธ์ด้าน Performance |
| :--- | :--- | :--- | :---: | :--- |
| **Receipt OCR** | `google/gemini-2.5-flash-lite` | **คงเดิม** | เท่าเดิม ($0.10/M) | ไม่มีข้อมูลว่ามีรุ่นที่ดีกว่า |
| **AP Invoice** | `google/gemini-3.1-flash-lite-preview` | **`google/gemini-3.1-flash-lite`** (GA) หลัง QA | เท่าเดิม ($0.25 / $1.50) | ตัดความเสี่ยง tag preview หาย; ไม่คาดว่าเร็วหรือแม่นขึ้น |
| **GL Suggestion** | `deepseek/deepseek-v4-flash` | **คงเดิม** | เท่าเดิม ($0.09/M) | ถูกกว่าทางเลือกที่ตรวจแล้ว และอยู่ใน PDPA allowlist |
