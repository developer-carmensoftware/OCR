# INCIDENT PLAYBOOK — Carmen AI OCR

> ถ้าระบบล่ม ทำตามขั้นตอนนี้ทีละข้อ

---

## 1. รับแจ้ง / ตรวจสอบ

| ช่องทาง | สัญญาณ |
|---|---|
| UptimeRobot | SMS / LINE / Email ว่า `/livez` ไม่ตอบ |
| Sentry | Error spike alert |
| ลูกค้าแจ้ง | โทร / LINE |

**เปิด browser ไปที่:**
- `http://<server>/livez` — ถ้าไม่ตอบ = process ตาย
- `http://<server>/readyz` — ถ้าไม่ตอบ = DB ไม่ได้

---

## 2. Triage — หาสาเหตุ

### Process ตาย
```powershell
# เช็ค IIS
Get-WebSite | Select-Object Name, State

# เช็ค log ล่าสุด
Get-EventLog -LogName Application -Source "carmen-ai" -Newest 20
```

### DB ไม่ได้
```powershell
# เช็ค MariaDB service
Get-Service MariaDB

# ลอง connect
& "C:\Program Files\MariaDB 10.5\bin\mysql.exe" -u root -p<PASSWORD> -e "SELECT 1;"
```

### Disk เต็ม
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}}
```

### Memory / CPU spike
```powershell
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, CPU, WorkingSet64
```

---

## 3. แก้ไข

### กรณี: Process ตาย
```powershell
Start-WebSite -Name "carmen-ai"
# หรือ restart IIS ทั้งหมด
iisreset
```

### กรณี: MariaDB หยุด
```powershell
Start-Service MariaDB
```

### กรณี: Disk เต็ม
```powershell
# ดู folder ใหญ่สุด
Get-ChildItem C:\ -Recurse -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending | Select-Object -First 20 FullName, Length

# ลบ backup เก่า (เก็บแค่ 7 ล่าสุด)
Get-ChildItem "C:\backups\carmen_ai\" | Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 7 | Remove-Item -Force
```

### กรณี: DB เสียหาย → Restore จาก Backup
ดู [RESTORE.md](./RESTORE.md)

---

## 4. ยืนยันระบบกลับมา

```powershell
# เช็ค health endpoints
Invoke-WebRequest http://localhost:8010/livez
Invoke-WebRequest http://localhost:8010/readyz
```

ทั้งสองต้องตอบ `{"status":"ok"}`

---

## 5. Post-incident

- [ ] บันทึกเวลาเริ่มต้นและจบของ incident
- [ ] บันทึกสาเหตุที่พบ
- [ ] บันทึกขั้นตอนที่ใช้แก้
- [ ] แจ้งลูกค้าถ้า downtime > 15 นาที
- [ ] เพิ่ม alert rule ถ้าพบว่ายังไม่มี monitoring ตรงนี้

---

## ข้อมูล Baseline (วัด 2026-05-20)

| รายการ | ค่า |
|---|---|
| DB size | 6.91 MB |
| จำนวน tables | 42 |
| Active tenants (30d) | 1 |
| Active BUs (30d) | 1 |
| Peak LLM calls/hour | 19 (2026-05-15 11:00) |

---

## ติดต่อฉุกเฉิน

| บทบาท | ติดต่อ |
|---|---|
| Dev / On-call | *(ใส่เบอร์ที่นี่)* |
| Senior / Escalation | *(ใส่เบอร์ที่นี่)* |
