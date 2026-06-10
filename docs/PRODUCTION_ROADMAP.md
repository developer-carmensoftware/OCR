# Production Roadmap

> Single source of truth สำหรับการพัฒนาระบบ Carmen AI OCR ให้พร้อม production แบบยั่งยืน
> รองรับลูกค้า 100++ ราย และเตรียมขยายในอนาคต

**สถานะ ณ วันที่เริ่มต้น:** 2026-05-20
**ผู้ดูแล:** Solo dev + senior consultation
**เป้าหมาย:** รองรับ 100++ users และขยายต่อเนื่อง (ปัจจุบันอยู่ระหว่าง dev/test — 1 tenant, 1 BU)

---

## สถานะปัจจุบัน (Baseline)

### มีอยู่แล้ว
- Architecture สะอาด, multi-tenant, FK-based
- JWT + Fernet encryption สำหรับ session
- Security headers, rate limiting, CORS
- Sentry integration (สำหรับ exception ในแอป)
- Health checks `/livez`, `/readyz`
- Retention service สำหรับ log tables (90-365 วัน)
- Background scheduler (retention, summary, anomaly, pricing sync)
- 166 unit/integration tests
- Docker Compose + IIS deployment configs

### ช่องโหว่สำคัญ
- ไม่มี DB backup เลย
- ไม่มี external uptime monitoring
- ไม่มี alerting เมื่อระบบล่ม
- Server เดียวรัน backend + DB + frontend + scheduler
- ไม่ทราบ peak capacity ของระบบ
- ไม่มี disaster recovery plan
- ไม่มี retention policy สำหรับ business data (ocr_tasks, credit_cards, ap_invoices)
- ไม่มี Data Processing Agreement (DPA) สำหรับ PDPA compliance (ต้องเช็คกับ senior)

---

## Phase 0: หยุดความเสี่ยง Critical (สัปดาห์นี้)

> เป้าหมาย: ถ้าวันพรุ่งนี้ server พัง ต้องกู้ข้อมูลได้ และต้องรู้ทันทีเมื่อระบบล่ม
> งบประมาณ: ~$0 (ส่วนใหญ่ฟรี)

### Day 1-2: Backup ฉุกเฉิน

- [x] เขียน `scripts/backup_db.ps1` — mysqldump รายวัน เก็บ 14 รุ่น
- [x] ตั้ง Windows Task Scheduler ทำงานตี 2 ทุกคืน
- [x] ทดสอบ restore จาก backup ลง DB ทดสอบ (42 tables ตรงกัน ✓)
- [x] เขียน `docs/RESTORE.md` ขั้นตอนกู้คืนแบบทีละขั้น
- [x] บันทึก credentials ทั้งหมดใน password manager รวมถึง `.env` (API keys, DB credentials, JWT secret, Fernet key)

### Day 3-4: Monitoring + Alerting

- [x] สมัคร UptimeRobot (ฟรี) → จิ้ม `https://dev.carmen4.com/api/v1/health` ทุก 5 นาที + alert email
- [x] เพิ่ม `sentry_sdk.capture_exception(exc)` ใน scheduler ทั้ง 4 จุด ([main.py](../backend/app/main.py))
- [ ] เพิ่ม Sentry alert rules — notify เมื่อ error spike
- [x] เขียน `scripts/disk_alert.ps1` → alert ถ้า disk เหลือ <20%
- [x] เปิด MariaDB slow query log (เพิ่มใน `my.ini` + restart service แล้ว — log ที่ `C:\tmp\mariadb-slow.log`)

### Day 5-7: Baseline + Load Test + DPA + เตรียมข้อมูลสำหรับ senior

- [x] รัน query วัด peak traffic (dev/test environment — peak: 19 calls/hr วันที่ 2026-05-15)
- [x] วัด DB size + disk usage ปัจจุบัน (DB: 6.91 MB, 42 tables)
- [x] นับจำนวน tenants + business_units ปัจจุบัน (1 tenant, 1 BU — dev/test)
- [x] เขียน `docs/INCIDENT_PLAYBOOK.md`
- [ ] **รัน load test เบื้องต้น** — ใช้ [locust](https://locust.io/) หรือ k6 simulate concurrent extractions:
  - วัด breaking point ของ single replica
  - บันทึก p95 latency ที่ 10 / 20 / 50 / 100 concurrent users
  - ผลใช้ตัดสินใจว่า Phase 3 (horizontal scale) ต้องเริ่มเมื่อไหร่
- [ ] **ตรวจสอบสถานะ DPA กับ senior — blocker ก่อน go-live:**
  - มี Data Processing Agreement กับบริษัทลูกค้าหรือยัง?
  - ถ้าไม่มี → ต้องร่างและเซ็นก่อนเปิดใช้งานจริง (100+ users กระทบ PDPA)
- [ ] เตรียมคำถามอื่นๆ ไปถาม senior (ดู section "คำถามที่ต้องไปถาม senior" ด้านล่าง)

### ตัวชี้วัดความสำเร็จ Phase 0
- มี backup ที่ restore ได้จริง อย่างน้อย 1 ครั้งต่อวัน
- รู้ทันที (ภายใน 5 นาที) เมื่อระบบล่ม
- รู้ breaking point ของ single replica จาก load test
- มีเอกสาร incident response
- DPA status ชัดเจน (มีแล้ว หรือมี plan ร่างภายในกี่วัน)

---

## Phase 1: แยกชั้น ลด SPOF (เดือนนี้)

> เป้าหมาย: ระบบไม่ผูกชะตากับ Windows server เดียว
> งบประมาณ: ~$80-120/เดือน

### Week 3: Managed Database ✅ DONE (2026-05-25)

- [x] เลือก **Neon PostgreSQL** (serverless, free tier 0.5GB, Singapore region)
- [x] Migration: MariaDB → PostgreSQL เสร็จสมบูรณ์ — UUID native types, partial indexes, asyncpg driver
- [x] `reset_db.py` รัน schema + migrations + seed data ใน Neon สำเร็จ
- [x] Smoke test: auth exchange, submit tool, summary service — ผ่านทั้งหมด
- [ ] เปิด auto-backup ใน Neon console (point-in-time recovery)
- [ ] ตรวจสอบ connection limit (Neon free: 100 connections — pool_size=10, max_overflow=40 ตั้งไว้แล้ว)

### Week 4: CI/CD Pipeline พื้นฐาน + Cloudflare

> ขยับมาจาก Phase 2 เพราะ manual deploy ทุกครั้งเสี่ยง production โดยตรง สำหรับ solo dev นี่คือ safety net ที่จำเป็นตั้งแต่ต้น

- [ ] ตั้ง GitHub Actions workflow พื้นฐาน:
  - [ ] รัน `pytest` ทุก push — ถ้า fail ห้าม deploy
  - [ ] รัน `npm run build` สำหรับ frontend
  - [ ] Manual trigger deploy to production (ไม่ auto — ต้องกด approve)
- [ ] เขียน smoke test script — รันหลัง deploy ทุกครั้ง (`/livez`, `/readyz`, `/api/v1/health`)
- [ ] ตั้ง Cloudflare (ฟรี) — DDoS protection + SSL + CDN ไม่ต้องเพิ่มงบ

### Week 5: Retention Policy ของ Business Data

- [ ] **คุยกับ senior + legal** เรื่อง retention period ของแต่ละ table (ดู section "Data Retention Strategy" ด้านล่าง)
- [ ] เพิ่ม policy ใน [retention_service.py](../backend/app/services/retention_service.py) สำหรับ:
  - [ ] `ocr_tasks` — สมมติ 5 ปี + archive
  - [ ] `credit_cards` + `credit_card_transactions` — สมมติ 5 ปี + archive
  - [ ] `ap_invoices` — สมมติ 5 ปี + archive
  - ~~`uploads/` (รูปภาพ)~~ — ระบบไม่เก็บไฟล์ภาพ (stateless extraction) ไม่มีอะไรต้อง retain
- [ ] เขียน `docs/DATA_RETENTION.md` policy ฉบับทางการ
- [ ] เพิ่ม cold storage tier (Glacier $0.004/GB) สำหรับ archive CSV ข้อมูลเก่า > 1 ปี

### Week 6: Backup Verification + DR Test

- [ ] เขียน `scripts/verify_backup.ps1` — restore ทดสอบรายสัปดาห์ลง staging DB
- [ ] ทำ DR drill — สมมติว่า primary DB ตาย แล้วทดสอบ failover
- [ ] บันทึก RTO (Recovery Time Objective) ที่ทำได้จริง
- [ ] บันทึก RPO (Recovery Point Objective) ที่ทำได้จริง

### ตัวชี้วัดความสำเร็จ Phase 1
- DB ไม่อยู่บนเครื่องเดียวกับ backend แล้ว
- มี CI/CD ที่บังคับ tests ผ่านก่อน deploy ได้ — ไม่มี manual deploy โดยไม่ผ่าน pipeline
- มี retention policy ครอบคลุมทุก table
- DR drill ทำสำเร็จ — กู้ระบบได้ใน <2 ชม.

---

## Phase 2: Operational Excellence (เดือนที่ 2)

> เป้าหมาย: มองเห็น performance จริง, staging environment, สื่อสารกับลูกค้าได้
> งบประมาณ: ~$150-200/เดือน

### Week 7-8: Staging Environment + CI/CD เต็มรูปแบบ

> CI/CD พื้นฐาน (tests + manual deploy) ทำไปแล้วใน Phase 1 Week 4
> Phase นี้ขยายเป็น full pipeline พร้อม staging

- [ ] Setup staging environment (clone ของ production — DB แยก, URL แยก)
- [ ] ขยาย GitHub Actions workflow:
  - [ ] Auto-deploy to staging on merge to `develop`
  - [ ] Integration tests รันบน staging หลัง deploy
  - [ ] Manual approval gate ก่อน promote to production
- [ ] เพิ่ม database migration test ใน CI — รัน migrations บน fresh DB ก่อน deploy

### Week 9: Performance Monitoring

- [ ] เลือกตัว APM:
  - Grafana Cloud (ฟรี tier, 10k metrics)
  - หรือ Datadog (~$15/host)
  - หรือ New Relic (ฟรี 100GB ingest/mo)
- [ ] Setup dashboard:
  - [ ] Response time per endpoint (p50, p95, p99)
  - [ ] Error rate per endpoint
  - [ ] DB query duration
  - [ ] LLM cost per day per tenant
  - [ ] Active sessions count
  - [ ] Disk usage trend
- [ ] ตั้ง alert rule:
  - [ ] p95 response time > 5s
  - [ ] error rate > 1%
  - [ ] DB connection pool exhausted

### Week 10: Customer Communication

- [ ] Setup public status page (Better Stack ฟรี / statuspage.io)
- [ ] เขียน SLA document — กำหนด uptime % ที่จะสัญญา
- [ ] เพิ่ม maintenance window policy
- [ ] เขียน customer notification template สำหรับ incident

### ตัวชี้วัดความสำเร็จ Phase 2
- มี staging environment ที่ตรงกับ production
- CI/CD เต็มรูปแบบ — ไม่มี manual deploy อีก
- เห็น performance ทุก endpoint แบบ real-time
- มี SLA ที่สัญญากับลูกค้าได้

---

## Phase 3: Scale Horizontal (เดือนที่ 3 ขึ้นไป)

> เป้าหมาย: รองรับลูกค้า 500-1000+ ราย
> งบประมาณ: ~$300-500/เดือน
> Trigger: เมื่อ traffic ทะลุ 70% ของ single-replica capacity

### Pre-requisite
- [ ] Phase 0-2 เสร็จครบ
- [ ] มี load test baseline ของ single-replica แล้ว
- [ ] วัด traffic จริง > 70% capacity

### Infrastructure

- [ ] เพิ่ม backend replica ที่ 2 + Load Balancer (HAProxy / Nginx / Cloud LB)
- [ ] เพิ่ม Redis (managed, ~$15-30/mo) สำหรับ:
  - [ ] Rate limiter (distributed — แทน in-memory ที่ไม่ sync ข้าม workers)
  - [ ] Session cache (ขยายจาก in-process cache ปัจจุบัน ให้ shared ข้าม replicas)
  - [ ] Quota counters
- [ ] DB read replica สำหรับ admin queries + analytics
- [ ] **แยก scheduler ออกจาก web process ก่อนเพิ่ม replica** — ถ้าเพิ่ม workers โดยไม่แยก scheduler จะ run ซ้ำกันหลายครั้ง (retention, summary, anomaly ทำงานซ้ำ)

### Code Changes Required

- [ ] Refactor [rate_limit.py](../backend/app/middleware/rate_limit.py) ใช้ Redis แทน in-memory
- [ ] Refactor [rate_limit_service.py](../backend/app/services/rate_limit_service.py) เหมือนกัน
- [ ] Implement Redis-based distributed lock สำหรับ scheduler jobs
- [x] ~~เพิ่ม session caching layer ก่อน DB query~~ — **Done (2026-05-21)**: in-process cache 60s TTL + throttled `last_used_at` write ลด DB hot-spot ลงแล้ว; upgrade เป็น Redis เมื่อ deploy multi-replica
- [x] ~~LLM call ไม่มี timeout~~ — **Done (2026-05-21)**: timeout 60s + global semaphore 16 concurrent + jitter retry
- [x] ~~DB connection ถูกถือตลอด LLM call~~ — **Done (2026-05-21)**: แยก DB session ออกจาก LLM phase แล้ว
- [ ] Implement graceful drain ก่อน shutdown (ขยาย shutdown_grace_seconds)

### Testing

- [ ] Load test ระบบใหม่ — รู้ ceiling
- [ ] Chaos engineering — kill replica ดูว่า traffic ย้ายได้ไหม
- [ ] DR test — primary DB fail → read replica ขึ้น

---

## Data Retention Strategy

### กฎหมายไทยที่เกี่ยวข้อง

| กฎหมาย | ระยะเวลาเก็บ |
|---|---|
| ประมวลรัษฎากร ม.87/3 — ใบกำกับภาษี/ใบเสร็จ | 5 ปี (อาจถึง 7 ปีหากมีคดี) |
| พ.ร.บ.การบัญชี 2543 ม.14 — บัญชี+เอกสารประกอบ | 5 ปี นับแต่ปิดบัญชี |
| PDPA — ข้อมูลส่วนบุคคล | เก็บเท่าที่จำเป็น ต้องลบเมื่อไม่ใช้ |

### Retention Matrix (ต้อง confirm กับ senior)

| Table / Data | Source of Truth | เสนอ retention | หมายเหตุ |
|---|---|---|---|
| `performance_logs` | OCR | 90 วัน | ตามที่ตั้งไว้แล้ว |
| `outbound_call_logs` | OCR | 90 วัน | ตามที่ตั้งไว้แล้ว |
| `llm_usage_logs` | OCR | 365 วัน | ตามที่ตั้งไว้แล้ว, billing audit |
| `audit_logs` | OCR | 365 วัน + archive | ตามที่ตั้งไว้แล้ว |
| `ocr_tasks` | OCR (audit trail) | **5 ปี + archive** | กฎหมายบัญชี |
| `credit_cards` + transactions | Carmen ERP | **5 ปี + archive** | Carmen เก็บอยู่แล้ว, OCR เก็บเป็น backup |
| `ap_invoices` | Carmen ERP | **5 ปี + archive** | เหมือนกัน |
| `uploads/` (รูปภาพ) | — | **ไม่มี** | ระบบไม่เก็บไฟล์ภาพ — อ่านเข้า memory ส่ง LLM แล้วทิ้ง |
| `correction_feedback` | OCR | 2 ปี | ใช้ปรับปรุง prompt |
| `mapping_history` | OCR | 2 ปี | ใช้ analytics |

### กลยุทธ์ Tiered Storage

```text
0-90 วัน    → Hot storage (DB หลัก, fast access)
90d - 2 ปี → Warm storage (DB หลัก, partitioned tables)
2-5 ปี     → Cold storage (S3 Glacier, archive CSV)
> 5 ปี      → ลบตาม PDPA (ยกเว้นถูก legal hold)
```

---

## คำถามที่ต้องไปถาม senior

### เรื่องข้อมูล + กฎหมาย

- [x] **Q1:** ลูกค้าเก็บกระดาษต้นฉบับเอกสารบัญชีเองหรือไม่?
  - **ตอบแล้ว:** ระบบไม่เก็บไฟล์ภาพ (ไม่มี `uploads/`) — ลูกค้าถือต้นฉบับเอง ข้อมูลที่เก็บในระบบคือ structured data ที่ LLM extract แล้วเท่านั้น

- [ ] **Q2:** มี Data Processing Agreement (DPA) กับลูกค้าหรือยัง?
  - ถ้าไม่มี → ต้องร่างก่อน (100+ ลูกค้านี่เสี่ยงผิด PDPA)

- [ ] **Q3:** กรณีลูกค้าขอลบข้อมูล (Right to Erasure ตาม PDPA) จัดการยังไง?
  - PDPA ให้สิทธิ์ลูกค้า vs กฎหมายบัญชีบังคับเก็บ 5 ปี — ขัดกัน
  - ต้องมี policy ชัดเจน (ปกติ legal interest > erasure)

- [ ] **Q4:** ตอนลูกค้าเลิกใช้บริการ — ข้อมูลย้ายไปไหน? ลบเมื่อไหร่?

### เรื่อง business + infrastructure

- [ ] **Q5:** SLA ที่อยากสัญญากับลูกค้าใหม่ — 99% / 99.5% / 99.9%?
  - แต่ละระดับลงทุนต่างกันมาก

- [ ] **Q6:** งบ infrastructure ต่อเดือนที่ propose ได้คือเท่าไหร่?
  - แนะนำ ~$150-300/เดือน ที่ขนาด 100+ ลูกค้า

- [ ] **Q7:** ถ้าระบบล่ม 4 ชม. กลางวันทำการ — ผลกระทบธุรกิจคืออะไร?
  - ใช้ตัดสินใจว่าควรลงทุน HA ระดับไหน

- [ ] **Q8:** มี cybersecurity insurance หรือยัง?
  - ขนาด 100+ ลูกค้าควรมี เผื่อ data breach

---

## งบประมาณรวม

| Phase | งบประมาณ/เดือน | งบประมาณ/ปี | ROI |
|---|---|---|---|
| Phase 0 | $0 | $0 | ป้องกัน "ปิดบริษัท" |
| Phase 1 | $80-100 | $960-1,200 | ลด SPOF, มี DR, CI/CD (ตัด S3 $5 ออก) |
| Phase 2 | $150-200 | $1,800-2,400 | Staging env, APM, SLA |
| Phase 3 | $300-500 | $3,600-6,000 | Scale 5-10x |

**สมมติ revenue ~$5,000/เดือน (100 users × $50):**
- Phase 1 = ~2% revenue
- Phase 2 = ~4% revenue
- Phase 3 = ~8% revenue

---

## Pitch Senior Template

```text
สถานการณ์:
- ลูกค้า 100+ ราย กำลังโต
- ระบบรันบน server เดียว (backend + DB + files + scheduler)
- ไม่มี DB backup, ไม่มี monitoring

ความเสี่ยงสูงสุด:
1. HDD พัง / ransomware → ข้อมูลหายถาวร = ปิดบริษัท
2. Process crash ตี 3 → ระบบล่มจนเช้าโดยไม่มีใครรู้
3. ไม่ทราบ capacity ที่แท้จริง → อาจล่มกะทันหันเมื่อมี traffic spike

แผนแก้ 3 ขั้น:
- Phase 0 (สัปดาห์นี้, $0/เดือน): backup + monitoring + alerting
- Phase 1 (เดือนนี้, $100/เดือน): แยก DB + cloud storage + DR
- Phase 2 (เดือนที่ 2, $180/เดือน): staging + CI/CD + APM + SLA

= ลงทุน 2-4% ของ revenue แลกกับ:
  • ลด business risk ระดับ critical
  • รองรับ growth ต่อ 12-18 เดือนโดยไม่ต้องรื้อ
  • มี SLA ที่สัญญากับลูกค้าใหม่ได้

ขออนุมัติเริ่ม Phase 0 ตั้งแต่สัปดาห์นี้ (ไม่มีค่าใช้จ่าย)
และ Phase 1 เดือนหน้า ($100/เดือน)
```

---

## ที่เกี่ยวข้อง / References

- [CLAUDE.md](../CLAUDE.md) — สถาปัตยกรรมระบบ
- [docs/Database_Design.md](./Database_Design.md) — DB schema
- [backend/app/services/retention_service.py](../backend/app/services/retention_service.py) — Retention service ปัจจุบัน
- [backend/app/main.py](../backend/app/main.py) — Scheduler + lifespan
- [docker-compose.yml](../docker-compose.yml) — Docker deployment
- [deploy.ps1](../deploy.ps1) — IIS deployment

---

## Changelog

| วันที่ | การเปลี่ยนแปลง |
|---|---|
| 2026-05-20 | สร้างเอกสาร roadmap ฉบับแรก |
| 2026-05-20 | ตัด backup_files.ps1 ออก — ระบบไม่มี file storage (no uploads/exports), .env เก็บใน password manager แทน; ตัด rclone/cloud sync ออก (defer) |
| 2026-05-20 | Day 1-2 เสร็จครบ: backup_db.ps1, Task Scheduler, restore test (42 tables ✓), RESTORE.md |
| 2026-05-20 | Day 3-4 บางส่วน: Sentry capture scheduler 4 จุด, disk_alert.ps1, slow query log config — รอ UptimeRobot + Sentry alert rules + MariaDB restart |
| 2026-05-20 | Day 5-7 เสร็จครบ: baseline queries, INCIDENT_PLAYBOOK.md — รอเตรียมคำถาม senior |
| 2026-05-21 | แก้ไข roadmap: (1) ตัด Phase 1 Week 4 Object Storage ออก — ระบบไม่มี file storage จริง; (2) ย้าย CI/CD pipeline พื้นฐานมา Phase 1 Week 4; (3) เพิ่ม load test + DPA เป็น Phase 0 blocker; (4) ปรับ header เป็น "เป้าหมาย" แทน "ลูกค้าปัจจุบัน" |
| 2026-05-21 | Stability fixes (code): LLM timeout 60s, global semaphore 16 concurrent, session cache 60s TTL, DB session released ก่อน LLM call, streaming file size check, rate limiter TTL eviction, perf buffer hard cap — mark ใน Phase 3 Code Changes |
