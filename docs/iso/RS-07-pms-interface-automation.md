---
title: PMS Interface Automation
iso-wp: RS
iso-topic: 07_PMS_Interface_Automation
iso-ref: RS-07|PMS-[A-Z]+\d
Document Version: Version 0.4 (Requirements Specification)
แผนงาน: PMS Interface automation (10/09 – 30/09/2026)
Module ID: `pms_interface` (บันทึกการใช้ LLM เท่านั้น ไม่คิดเครดิต)
รายละเอียดการออกแบบ: FRD-11 PMS Interface Automation v1.6 (Software Design) และ `docs/pms-interface/`
Source of truth: repo developer-carmensoftware/OCR @ 6eba2efe (12/11/2026) + branch feat/pms-switch-off
สถานะระบบ: แถวของวันมาจาก preview ของ engine ของ Carmen (decision-log #54) · การ post ของ Carmen เป็นตัวตรวจ mapping (#52, #53) · sweep เปิดวันของเมื่อวานให้ทุก PMS ตั้งแต่ 06:00 ICT จึงไม่ต้องรอ hook (#55) · hook จริงยังได้ 401 จนกว่าหน้า PMS setting ของ Carmen จะออก key ให้ BU (ask H) · Carmen ยังปฏิเสธการ post ของ Comanche.PMS (ask K)
Date: 12 November 2026
---

## Document Revision History

| Version | Date | Author | Description of Changes | Approved By |
|---|---|---|---|---|
| 0.1 | 02/11/2026 | Dev Team | จัดทำฉบับแรก — สรุปข้อกำหนดจาก FRD-11 v1.2 ที่ตรวจกับโค้ดแล้ว | |
| 0.2 | 10/11/2026 | Dev Team | ตาม FRD-11 v1.4 (decision-log #52–#54): แถวของวันมาจาก preview ของ engine, `-500` นำ key ที่ขาดเข้าการตรวจ, เปิดวันของ PMS แบบ PartnerApi, `day_not_ready`, เก็บเลข JV, AI ไม่เห็นยอดเงิน — PMS-F05/F06/F08/F13, I01, Q04 แก้ และเพิ่ม PMS-F14 | |
| 0.3 | 12/11/2026 | Dev Team | ตาม FRD-11 v1.5 (decision-log #55): PMS-F14 แก้ — เปิดวันของเมื่อวานให้ทุก PMS ที่ลง REVENUE → GL ไม่ว่า `From` จะเป็นอะไร ตั้งแต่ 06:00 ICT (เดิมเฉพาะ PartnerApi หลัง 08:00) | |
| 0.4 | 12/11/2026 | Dev Team | ตาม FRD-11 v1.6 (decision-log #56): เพิ่ม PMS-F15 — revoke key = ปิด PMS: ปิดวันที่ยังเปิดอยู่และ auto-post, ไม่มี key ที่ใช้ได้ไม่ post อัตโนมัติ | |

<!-- pagebreak -->

# 1. บทนำ

## 1.1 วัตถุประสงค์

ทุกคืนหลัง night audit ระบบ PMS ของโรงแรมเขียนตัวเลขของวันลง Data Bank ของ Carmen และ engine ของ Carmen post วันนั้นเป็น JV ตาม PMS setting และ mapping table ของ BU เมื่อมีรหัสรายการใหม่ที่ mapping table ยังไม่รู้จัก วันนั้นจะ post ไม่ได้จนกว่าพนักงานบัญชีจะเพิ่ม mapping เอง งานนี้หาแถวใหม่ให้ AI แนะนำบัญชี ให้คนยืนยัน แล้วเขียน mapping กลับและสั่ง engine ของ Carmen post

รายละเอียดการออกแบบอยู่ใน FRD-11 ซึ่งเป็นเอกสารออกแบบ (Software Design) ของงานนี้

## 1.2 ผู้ใช้และบริบท

- **Carmen:** ส่ง hook บอกวันที่เขียนลง Data Bank และเป็นเจ้าของหน้า PMS setting ที่ออก key และตั้ง auto-post ต่อ BU × PMS
- **พนักงานบัญชี:** ตรวจและอนุมัติวันในคิวของ RS-08
- **ค่าใช้จ่าย:** ไม่หักเครดิต BU จ่ายค่า interface แยกต่างหาก

## 1.3 ขอบเขต

| ทำ | ไม่ทำ |
|---|---|
| รับ hook ของ PMS และเก็บหนึ่งแถวต่อ BU × วัน | ตัดสิน Dr/Cr ยอดรวม บัญชีพัก หรือ prefix ของ JV — อยู่ใน PMS setting ของ Carmen |
| อ่านรายการ interface, mapping table และ preview ของ engine ของ Carmen | InterfaceType อื่นนอกจาก PMS และ section อื่นนอกจาก REVENUE |
| ให้ AI แนะนำบัญชีเฉพาะแถวใหม่ (ไม่ส่งยอดเงิน) | อ่านข้อมูลดิบของวัน (FileData) หรือ layout ของ PMS เอง — engine ของ Carmen อ่านแทน |
| อนุมัติ/ปฏิเสธในคิว แล้วเขียน mapping กลับและสั่ง engine post | แก้ mapping หลังอนุมัติ — ใช้หน้าจอของ Carmen |
| API ให้หน้า PMS setting ของ Carmen | เลขใบสำคัญ (JvhNo) — Carmen คืนเฉพาะ seq ของ JV ซึ่งระบบเก็บแล้ว |

# 2. ข้อกำหนดด้านการทำงาน

<!-- widths!: 15,55,12,18 -->
| รหัส | ข้อกำหนด | ทวนสอบโดย | อ้างอิง FRD-11 |
|---|---|---|---|
| PMS-F01 | ระบบต้องรับ hook `{InterfaceType, InterfaceName, DocType, DocDate}` ที่ `POST /api/v1/pms/events` ยืนยันด้วย API key ของ BU × PMS และตอบทันทีโดยไม่รอการประมวลผล: วันใหม่ 202 วันเดิม 200 `duplicate: true` | ทดสอบ | §2.1, §5 |
| PMS-F02 | ระบบต้องปฏิเสธ key ที่ผิดหรือถูกเพิกถอน (401) key ของ PMS อื่น (403) body เกิน 16 KB (413) และ body ผิดรูปแบบ (422) | ทดสอบ | §5 |
| PMS-F03 | หน้า PMS setting ของ Carmen ต้องอ่าน/ตั้ง auto-post ออก key ใหม่ (key ที่ใช้งานได้หนึ่งอันต่อ BU × PMS โดยเพิกถอนอันเดิม) และเพิกถอน key ได้ | ทดสอบ | §2.1, §12 |
| PMS-F04 | ทุกการเขียนจากหน้าจอของ Carmen ต้องเก็บ token ของผู้ใช้เป็น credential ของ BU ยกเว้น BU มี credential ที่ยังใช้ได้อยู่แล้ว แต่ถ้ามีวันที่ค้างที่ `carmen_forbidden` ต้องแทนที่เสมอ | ทดสอบ | §2.1, §5 |
| PMS-F05 | ระบบต้องประมวลผลหนึ่งวันด้วยการหา section REVENUE → GL ของ PMS ในรายการ interface ของ Carmen, อ่าน mapping table (คอลัมน์ที่ไม่ใช่ DeptCode / AccCode / AccDesc คือ key) และขอ preview ของ engine ของ Carmen สำหรับแถว Data Bank เดียวกับที่จะ post แล้วหาแถวที่ mapping table ยังไม่รู้จัก — ใช้ได้กับทุก PMS โดยไม่มีโค้ดเฉพาะ PMS | ทดสอบ | §2.1, §8 |
| PMS-F06 | AI ต้องแนะนำบัญชีเฉพาะแถวใหม่ ในคำขอเดียวต่อวัน โดยใช้แถวที่ map แล้วของ BU เป็นตัวอย่าง เห็นแต่ละ key ตามชื่อคอลัมน์ของ PMS นั้นโดยไม่มียอดเงิน และลองใหม่หนึ่งครั้งเมื่อคำตอบใช้ไม่ได้ | ทดสอบ | §1, §7, F-07 |
| PMS-F07 | วันที่มีแถวใหม่ต้องพักให้คนตรวจเสมอ วันที่ไม่มีแถวใหม่ post เองเมื่อเปิด auto-post ของ PMS นั้น | ทดสอบ | §11.2 |
| PMS-F08 | ระบบต้องลองใหม่อัตโนมัติสูงสุด 3 ครั้งสำหรับสาเหตุที่อาจหายเอง (ยังไม่มี credential, Carmen ล่ม, Data Bank ยังไม่มีวันนั้น) และปลุกวันที่รอเมื่อมี credential ใหม่ วันที่ Carmen ตอบ `-400` "No Data Found" ต้องลองทุกชั่วโมงโดยไม่นับครั้งจนครบ 24 ชั่วโมง (`day_not_ready`) | ทดสอบ | §2.1, §8.4 |
| PMS-F09 | การอนุมัติต้องเปิดได้เมื่อแถวใหม่ทุกแถวมีแผนกและบัญชี และต้องอ่านตารางของ Carmen สดก่อนเขียน แล้วเขียนกลับทั้งตารางพร้อมแถวใหม่ (ไม่มีแถวเดิมหาย) ก่อนสั่ง engine post | ทดสอบ | §1, §11.2 |
| PMS-F10 | หลังอนุมัติ ระบบต้องตรวจวันอื่นที่รออยู่ของ BU เดียวกันอีกรอบ รหัสที่อนุมัติแล้วต้องไม่เป็นแถวใหม่อีก | ทดสอบ | §11.2 |
| PMS-F11 | การปฏิเสธต้องเลิกวันนั้นพร้อมเหตุผลแบบไม่บังคับ และถ้า Carmen ส่งวันนั้นมาใหม่ต้องถูกอ่านอีกครั้ง | ทดสอบ | §2.1 |
| PMS-F12 | ระบบต้องไม่ส่ง Dr/Cr หรือยอดรวมของตัวเองไป Carmen การ post ต้องผ่าน engine ของ Carmen ตาม PMS setting เท่านั้น | ทดสอบ | §1, §11.2 |
| PMS-F13 | เมื่อ engine ของ Carmen ตอบ `-500` (มี key ที่ไม่มีบัญชี) วันต้องพักเป็น `pms_mapping_incomplete` พร้อมแถวที่ Carmen เขียนลงตารางและคำแนะนำของ AI และเมื่อ preview ใช้ไม่ได้ วันต้องพักโดยไม่มีแถว (ไม่ล้ม) | ทดสอบ | §2.1, §8.4, §9 |
| PMS-F14 | ระบบต้องเปิดวันของเมื่อวานเองตั้งแต่ 06:00 ICT ให้ BU × PMS ที่มี key ที่ใช้ได้และ `interfaceThirdParties` บอกว่าลง REVENUE → GL ไม่ว่า `From` จะเป็นอะไร — hook แค่ทำให้วันมาเร็วขึ้น (PMS แบบ `PartnerApi` ไม่มี hook เลย) และวันที่ hook เก็บไว้แล้วต้องไม่ถูกเปิดซ้ำ | ทดสอบ | §2.1, §8.6 |
| PMS-F15 | เมื่อ BU revoke key ของ PMS (จากหน้าตั้งค่า Carmen หรือ `#/admin/api-keys`) ระบบต้องปิด PMS นั้นทั้งหมด: วันที่ยังเปิดอยู่ (`received`, `pending_review`) ต้องถูกปิดเป็น `rejected` / `pms_switched_off` และแสดงใน Not posted ยกเว้นวันที่มีคนกำลังกด Approve, auto-post ต้องถูกปิด และวันที่ประมวลผลโดยไม่มี key ที่ใช้ได้ต้องไม่ถูก post อัตโนมัติ — การออก key ใหม่แทนอันเดิมไม่ใช่การปิด | ทดสอบ | §2.2, §8.6, §9 |

# 3. ข้อกำหนดด้านส่วนติดต่อผู้ใช้

<!-- widths!: 15,55,12,18 -->
| รหัส | ข้อกำหนด | ทวนสอบโดย | อ้างอิง FRD-11 |
|---|---|---|---|
| PMS-U01 | แต่ละวันต้องเป็นหนึ่งแถวในคิว และ dialog ตรวจที่ `#/CreditCardOCR/review?pms=<id>` ต้องเป็นตารางเดียวแบบหน้า mapping ของ Carmen: แถวใหม่ก่อนพร้อมตัวเลือกและป้าย AI ตามด้วยแถวของ Carmen แบบอ่านอย่างเดียว | สาธิต | §4 |
| PMS-U02 | หน้า `#/admin/api-keys` ต้องแสดง key ของทุก BU, PMS ของ key และเวลาที่ถูกเรียกล่าสุด และเพิกถอนได้ แต่ออก key ไม่ได้ | สาธิต | §2.1 |

# 4. ส่วนต่อประสานภายนอก

<!-- widths!: 15,55,12,18 -->
| รหัส | ข้อกำหนด | ทวนสอบโดย | อ้างอิง FRD-11 |
|---|---|---|---|
| PMS-I01 | ระบบต้องหา id ของแถว Data Bank ล่าสุด (`GET /api/interface/PMS/{name}/{docType}/Date/{docDate}`) ขอ preview (`interfacePreviewPostGL`) อ่าน/เขียน mapping table และสั่ง post ผ่าน `interfacePostGL` ของ Carmen ด้วย credential ของ BU และเก็บ seq ของ JV จาก `Id` | ทดสอบ | §7 |
| PMS-I02 | ระบบต้องหา section ของ PMS จาก `GET /api/interface/interfaceThirdParties` และหารหัส setting เป็น `{InterfaceName}.{InterfaceType}` เอง (PMS setting และ INI อ่านด้วย menu token ไม่ได้) ถ้าอ่านรายการหรือ mapping table ไม่ได้ วันต้องหยุดที่ `carmen_config_unreadable` | ทดสอบ | §7 |

# 5. ข้อกำหนดด้านคุณภาพ

<!-- widths!: 15,55,12,18 -->
| รหัส | ข้อกำหนด | ทวนสอบโดย | อ้างอิง FRD-11 |
|---|---|---|---|
| PMS-Q01 | ความปลอดภัย: key คือ BU — body ไม่ระบุ BU key หนึ่งจึงเขียนเข้า BU อื่นหรือ PMS อื่นไม่ได้ เก็บเฉพาะ sha256 ของ key และ token ของ Carmen เข้ารหัส | ทดสอบ | §10.1 |
| PMS-Q02 | การป้องกันการทำซ้ำ: hook ซ้ำต้องไม่สร้างแถวใหม่ และ claim ของการประมวลผล (10 นาที) และการอนุมัติ (5 นาที) ต้องกันไม่ให้วันเดียวกันถูกทำซ้ำพร้อมกัน | ทดสอบ | §10.2 |
| PMS-Q03 | ความทนทาน: แถวต้องถูก commit ก่อนเริ่มประมวลผล และงานตามเวลาทุก 10 นาทีต้องเก็บวันที่ค้างหลัง restart | ทดสอบ | §10.2 |
| PMS-Q04 | ความเป็นส่วนตัว: ระบบไม่อ่านข้อมูลดิบของวัน ข้อมูลที่ส่งให้ AI มีเพียง key ของแถวใหม่และตัวอย่างจากตาราง ไม่มียอดเงิน ทุกคำขอส่ง `data_collection: deny` และผลการอ่านที่รอตรวจต้องเข้ารหัสในฐานข้อมูล | ทดสอบ | §10.3 |
| PMS-Q05 | การตรวจสอบ: ต้องบันทึกเวลาและ IP ที่ key ถูกเรียกล่าสุด รอบประมวลผลใน `job_runs` และการใช้ LLM ด้วย `module_id = pms_interface` | ทดสอบ | §10.4 |

# 6. ข้อจำกัดในการออกแบบ

<!-- widths!: 15,55,12,18 -->
| รหัส | ข้อกำหนด | ทวนสอบโดย | อ้างอิง FRD-11 |
|---|---|---|---|
| PMS-C01 | ไม่มีกติกาบัญชีของระบบเอง (decision-log #43) ทุกอย่างมาจาก PMS setting ของ Carmen การ post ส่งแค่รหัส setting วันที่ และ Data Bank id ไม่ส่งบัญชีพัก | ตรวจทาน | §1 |
| PMS-C02 | Carmen เป็นผู้กำหนดว่าใครเห็นหน้า PMS setting ระบบไม่ตรวจสิทธิ์ซ้ำ | ตรวจทาน | §10.1 |

# 7. เกณฑ์การยอมรับ

<!-- widths!: 16,64,20 -->
| รหัส | เกณฑ์ | ข้อกำหนดที่ครอบคลุม |
|---|---|---|
| PMS-AC01 | hook ของวันใหม่ได้ 202 ภายในเวลาสั้น และวันเดิมได้ 200 `duplicate: true` โดยไม่สร้างแถวใหม่ | PMS-F01, Q02 |
| PMS-AC02 | วันที่มีแถวใหม่ไปอยู่ที่คิวเสมอ ไม่ว่าจะเปิด auto-post หรือไม่ และแถวในคิวบอกรหัสที่ AI แนะนำ | PMS-F06, F07 |
| PMS-AC03 | กด Approve ไม่ได้จนกว่าแถวใหม่ทุกแถวจะมีแผนกและบัญชี | PMS-F09 |
| PMS-AC04 | หลัง Approve ตารางของ Carmen มีแถวเดิมทั้งหมดบวกแถวใหม่ และ engine post วันนั้น | PMS-F09, F12 |
| PMS-AC05 | รหัสที่อนุมัติแล้วไม่เป็นแถวใหม่ในวันอื่นที่รออยู่ | PMS-F10 |
