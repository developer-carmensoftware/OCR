# คู่มือการติดตั้งระบบ AI OCR บน Windows Server (IIS) จากศูนย์ (Zero to Hero)

เอกสารฉบับนี้อธิบายขั้นตอนการนำระบบ AI OCR (Frontend + Backend) ขึ้นรันบน Server จริง โดยอ้างอิงโครงสร้างที่แชร์โดเมนร่วมกับระบบหลัก (เช่น `dev.carmen4.com`) และจัดเก็บไฟล์ไว้ที่ไดรฟ์ `D:` เพื่อความปลอดภัยสูงสุด

---

## 🛠 1. การเตรียมความพร้อมของ Server (ทำครั้งแรกครั้งเดียว)

1. **เปิดใช้งานฟีเจอร์ IIS:**
   - ค้นหาและเปิด `Turn Windows features on or off` (หรือ `Server Manager` > `Add roles and features`)
   - เปิดใช้งาน **Internet Information Services**
   - ภายใต้ `Web Management Tools` ต้องเปิด **IIS Management Console**
   - ภายใต้ `World Wide Web Services` > `Application Development Features` ต้องเปิด **CGI**, **ISAPI Extensions**, **ISAPI Filters** และ **WebSocket Protocol**

2. **ติดตั้ง Python (สำคัญมาก):**
   - ดาวน์โหลดตัวติดตั้ง Python (แนะนำ 3.12+)
   - **ข้อควรระวัง:** ตอนติดตั้งต้องคลิก Custom Installation และเลือก **"Install Python for all users"** เพื่อให้ติดตั้งลงไปที่ `C:\Program Files` ซึ่งจะทำให้ IIS มีสิทธิ์เรียกใช้งานได้

3. **ติดตั้ง HttpPlatformHandler:**
   - ดาวน์โหลดและติดตั้ง: [HttpPlatformHandler v1.2 x64](https://www.iis.net/downloads/microsoft/httpplatformhandler)
   - *หมายเหตุ: หากเพิ่งเคยติดตั้งครั้งแรก แนะนำให้ Restart เครื่อง 1 รอบ*

---

## 📂 2. การเตรียมโฟลเดอร์ระบบ (Directory Structure)

เพื่อให้เป็นระเบียบและไม่มีปัญหาเรื่อง Permission ให้สร้างโฟลเดอร์บน Server ตามโครงสร้างนี้:

- **Frontend:** `D:\Carmen\www\Carmen.OCR`
- **Backend:** `D:\Carmen\www\Carmen.OCR.API`

---

## 🐍 3. การเซ็ตอัพฝั่ง Backend (API)

1. นำไฟล์โค้ด Backend ทั้งหมดไปวางไว้ที่ `D:\Carmen\www\Carmen.OCR.API`
2. **ติดตั้ง Environment & Packages:**
   - เปิด Command Prompt (Run as Administrator) แล้วเข้าไปที่โฟลเดอร์ Backend:
     ```cmd
     d:
     cd D:\Carmen\www\Carmen.OCR.API
     ```
   - สร้างโฟลเดอร์จำลอง (Virtual Environment) สำหรับเชื่อมกับ Python:
     ```cmd
     python -m venv venv
     ```
   - เปิดใช้งาน venv และติดตั้งไลบรารีที่จำเป็น:
     ```cmd
     venv\Scripts\activate
     pip install -r requirements.txt
     ```
3. **การตั้งค่าสิทธิ์ (Permissions - สำคัญมาก):**
   - เปิด File Explorer ไปที่ `D:\Carmen\www\Carmen.OCR.API`
   - คลิกขวาที่โฟลเดอร์ `Carmen.OCR.API` > เลือก **Properties** > แท็บ **Security**
   - กด **Edit...** > กด **Add...** > พิมพ์ `IIS_IUSRS` > กด OK
   - ติ๊กช่อง **Modify** ให้เป็นเครื่องหมายถูก > กด OK บันทึกทั้งหมด
   *(ขั้นตอนนี้เพื่อให้ Python สามารถอัพโหลดรูปภาพและเขียนไฟล์ฐานข้อมูล SQLite ได้)*

---

## ⚛️ 4. การเซ็ตอัพฝั่ง Frontend (React)

1. ที่เครื่อง Dev ของคุณ (ไม่ใช่ Server) ให้รันคำสั่งเพื่อแปลโค้ด:
   ```cmd
   npm run build
   ```
2. จะได้โฟลเดอร์ชื่อ `dist` ขึ้นมา ให้นำ **"ไฟล์ทั้งหมดที่อยู่ในโฟลเดอร์ dist"** ไปวางไว้ที่ Server ในโฟลเดอร์ `D:\Carmen\www\Carmen.OCR`
3. *(หมายเหตุ: Frontend ของระบบนี้ใช้ Hash Routing `/#/` จึงไม่ต้องสร้างไฟล์ `web.config` มาดัก Error 404 เลย โยนแค่ไฟล์ Static ก็ใช้งานได้ทันที)*

---

## ⚙️ 5. การตั้งค่า IIS Manager (ผูกระบบเข้าด้วยกัน)

### 5.1 ปลดล็อคระบบความปลอดภัย IIS
1. เปิดโปรแกรม **IIS Manager**
2. คลิกที่ "ชื่อ Server" ของคุณ (ซ้ายบนสุด)
3. ดับเบิ้ลคลิกไอคอน **Feature Delegation** (อยู่ในหมวด Management ตรงกลางหน้าจอ)
4. เลื่อนหาบรรทัด **Handler Mappings** คลิก 1 ที แล้วกด **Read/Write** ที่แถบเมนูด้านขวา

### 5.2 สร้าง Application Pool สำหรับ Backend
1. คลิกขวาที่เมนู **Application Pools** > เลือก **Add Application Pool...**
2. **Name:** `OCR-Backend`
3. **.NET CLR version:** เปลี่ยนเป็น **No Managed Code**
4. กด OK (ไม่ต้องเปลี่ยน Identity ใดๆ ให้ใช้ค่าเริ่มต้น `ApplicationPoolIdentity` ซึ่งปลอดภัยที่สุด)

### 5.3 เชื่อม Frontend เข้ากับเว็บหลัก (ทำ Sub-Application `ocr`)
*(สมมติว่าคุณมีเว็บหลักชื่อ `dev.carmen4.com` อยู่ในระบบแล้ว)*
1. ขยายหน้าต่าง Sites แล้วคลิกขวาที่เว็บหลัก `dev.carmen4.com`
2. เลือก **Add Application...**
3. **Alias:** `ocr`
4. **Physical path:** `D:\Carmen\www\Carmen.OCR`
5. กด OK

### 5.4 เชื่อม Backend เข้ากับเว็บหลัก (ทำ Sub-Application `api`)
1. คลิกขวาที่เว็บหลัก `dev.carmen4.com` อีกครั้ง
2. เลือก **Add Application...**
3. **Alias:** `api` *(ข้อนี้สำคัญมาก ห้ามสะกดผิด เพราะโค้ด React ถูกตั้งค่าให้ยิงหาคำนี้)*
4. **Application pool:** เลือก `OCR-Backend` (ที่เราเพิ่งสร้างในข้อ 5.2)
5. **Physical path:** `D:\Carmen\www\Carmen.OCR.API`
6. กด OK

---

## 🚀 6. การทดสอบและการทำงานของระบบ

- **เข้าใช้งานระบบ:** เปิดบราวเซอร์ไปที่ `https://dev.carmen4.com/ocr/` (หน้าเว็บ Frontend จะแสดงผล)
- **การเชื่อมต่อ:** เมื่อคุณกดอัพโหลดใบเสร็จ Frontend จะส่งข้อมูลไปที่ `/api/v1/credit-card/...` ซึ่งตัวบราวเซอร์จะวิ่งไปที่ `https://dev.carmen4.com/api/v1/...` อัตโนมัติ ทำให้ IIS โยนคำสั่งเข้าหาโฟลเดอร์ Backend อย่างสมบูรณ์แบบ
- **การแก้ไขปัญหา (Troubleshooting):**
  - **ขึ้น Error 503 Service Unavailable:** แปลว่า App Pool `OCR-Backend` หยุดทำงาน (Stopped) ให้ไปกด Start ใหม่ในหน้า Application Pools
  - **ขึ้น Error 500:** โค้ด Python อาจมีปัญหา ให้เข้าไปเปิดดูไฟล์ Log ภายในโฟลเดอร์ `D:\Carmen\www\Carmen.OCR.API\logs`
  - **อัพโหลดรูปแล้ว Database Locked:** ลืมตั้งค่าสิทธิ์ `Modify` ให้ `IIS_IUSRS` ที่โฟลเดอร์ Backend (กลับไปดูข้อ 3.3)
