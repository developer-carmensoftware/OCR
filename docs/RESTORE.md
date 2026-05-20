# RESTORE.md — คู่มือกู้คืนฐานข้อมูล Carmen AI

> ใช้เอกสารนี้เมื่อต้องการกู้คืน DB จาก backup
> เวลาที่ใช้โดยประมาณ: 15-30 นาที

---

## ไฟล์ backup อยู่ที่ไหน

```
C:\backups\carmen_ai\
  carmen_ai_YYYY-MM-DD_HH-mm.sql.zip
```

Backup รันอัตโนมัติทุกวันตี 2 ผ่าน Windows Task Scheduler (task: `CarmenAI-BackupDB`)
เก็บย้อนหลัง 14 รุ่น (~14 วัน)

---

## ขั้นตอนกู้คืน

### ขั้นที่ 1 — หยุด backend ก่อน

```powershell
# ถ้ารันผ่าน IIS
Stop-WebSite -Name "carmen-ai"

# ถ้ารันผ่าน terminal ให้กด Ctrl+C หรือ kill process
```

### ขั้นที่ 2 — เลือกไฟล์ backup ที่ต้องการ

```powershell
# ดูรายการ backup ทั้งหมด
Get-ChildItem "C:\backups\carmen_ai\" | Sort-Object LastWriteTime -Descending
```

เลือกไฟล์ที่ใหม่ที่สุด (หรือ version ก่อนเกิดปัญหา)

### ขั้นที่ 3 — แตกไฟล์

```powershell
Expand-Archive -Path "C:\backups\carmen_ai\carmen_ai_YYYY-MM-DD_HH-mm.sql.zip" `
               -DestinationPath "C:\tmp\restore_temp" -Force
```

### ขั้นที่ 4 — (ถ้าจำเป็น) Drop DB เก่า แล้วสร้างใหม่

> ทำขั้นนี้เฉพาะกรณีที่ DB เสียหาย หรือต้องการ restore ทับทั้งหมด

```powershell
& "C:\Program Files\MariaDB 10.5\bin\mysql.exe" -u root -p<PASSWORD> -e `
  "DROP DATABASE IF EXISTS carmen_ai; CREATE DATABASE carmen_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### ขั้นที่ 5 — Restore

```powershell
& "C:\Program Files\MariaDB 10.5\bin\mysql.exe" -u root -p<PASSWORD> carmen_ai `
  < "C:\tmp\restore_temp\carmen_ai_YYYY-MM-DD_HH-mm.sql"
```

### ขั้นที่ 6 — ตรวจสอบ

```powershell
& "C:\Program Files\MariaDB 10.5\bin\mysql.exe" -u root -p<PASSWORD> -e `
  "SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='carmen_ai';"
```

ควรได้ **42 tables** — ถ้าน้อยกว่านี้แสดงว่า restore ไม่สมบูรณ์

### ขั้นที่ 7 — ทำความสะอาด temp

```powershell
Remove-Item -Recurse -Force "C:\tmp\restore_temp"
```

### ขั้นที่ 8 — เริ่ม backend ใหม่

```powershell
# ถ้ารันผ่าน IIS
Start-WebSite -Name "carmen-ai"
```

จากนั้นเปิด `/readyz` ตรวจสอบว่าระบบ healthy

---

## กรณี restore ไปยัง DB ใหม่ (ไม่ทับของเดิม)

เปลี่ยนชื่อ DB ในขั้นที่ 4-5:

```powershell
# สร้าง DB ทดสอบ
& "C:\Program Files\MariaDB 10.5\bin\mysql.exe" -u root -p<PASSWORD> -e `
  "CREATE DATABASE carmen_ai_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore เข้า DB ทดสอบ
& "C:\Program Files\MariaDB 10.5\bin\mysql.exe" -u root -p<PASSWORD> carmen_ai_test `
  < "C:\tmp\restore_temp\carmen_ai_YYYY-MM-DD_HH-mm.sql"
```

---

## หมายเหตุ

- `<PASSWORD>` = MariaDB root password (ดูใน password manager)
- ระบบนี้ **ไม่มี file storage** — ไม่ต้องกู้คืนไฟล์รูปภาพ มีแค่ DB เท่านั้น
- หลัง restore เสร็จ sessions เก่าจะยังใช้งานได้ เพราะ JWT เป็น stateless
