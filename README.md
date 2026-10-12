# ศูนย์ช่วยเหลือน้ำท่วม เมืองพัทยา (ต้นแบบ)

เว็บศูนย์ช่วยเหลือน้ำท่วมสำหรับเมืองพัทยา/อ.บางละมุง จ.ชลบุรี — จำลองระบบทั้งหมดของ chachoengsao-flood.vercel.app
พร้อมระบบ **เส้นทางเลี่ยงน้ำท่วม** (Node.js + Express, เก็บข้อมูลเป็นไฟล์ JSON, ไม่มี build step)

## วิธีรัน
```bash
npm install
STAFF_PASSWORD=รหัสของคุณ npm start      # http://localhost:3600
```
ต้องใช้ Node 18 ขึ้นไป (ใช้ fetch ในตัว)

## ตัวแปรแวดล้อม (env)
| ชื่อ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `PORT` | `3600` | พอร์ต |
| `STAFF_PASSWORD` | `pattaya1337` | รหัสผ่านเจ้าหน้าที่ **ต้องเปลี่ยนก่อนใช้งานจริง** |
| `SESSION_SECRET` | สร้างจากรหัสผ่าน | คีย์เซ็นคุกกี้เข้าสู่ระบบ |
| `DATA_DIR` | `./data` | ที่เก็บ `db.json` และรูป `uploads/` |
| `ORS_API_KEY` | (ไม่มี) | ถ้าใส่ จะใช้ OpenRouteService แบบ `avoid_polygons` เลี่ยงจุดน้ำท่วมโดยตรง ถ้าไม่ใส่ใช้ OSRM demo + เลือกเส้นทางทางเลือกที่ไม่ผ่านจุดน้ำ |

## ฟีเจอร์
- หน้าหลัก: ขออาหาร/ถุงยังชีพ (รับเฉพาะพื้นที่ที่เปิด `served`), ติดต่อผู้ประสานงานพื้นที่, ผู้ป่วยติดต่อหมอ, ฉุกเฉิน 1669·1784·1337
- รายงานระดับน้ำ (6 ระดับ, ปักหมุด/GPS/ค้นหา Nominatim, แนบรูป ย่อขนาดในเครื่อง)
- น้ำท่วมใกล้บ้านฉันไหม (คำนวณในเครื่อง ไม่ส่งตำแหน่ง), เช็กสถานะเคส (เลขเคส + เบอร์ 4 ตัวท้าย), พื้นที่ของฉัน, อัปเดตล่าสุด
- ตามหาคน (เห็นเฉพาะเจ้าหน้าที่), ของหาย–ได้คืน (แสดงเบอร์แค่ 4 ตัวท้าย), ลิงก์ CCTV, หน้าพยากรณ์ + เรดาร์
- สถานการณ์น้ำ: Open-Meteo ฝน 24 ชม. (รวม มม., โอกาสสูงสุด, เวลาเริ่ม, กราฟรายชั่วโมง); ระดับน้ำสถานีใกล้สุดจาก ThaiWater (ล้นตลิ่ง/ใกล้ล้นตลิ่ง/น้ำมาก/ปกติ, แนวโน้ม, เวลาวัด); ฝนสะสม 24 ชม. สถานีในบางละมุง/สัตหีบ
- แผนที่ Leaflet/OSM: รายงานน้ำ, คำขอช่วยเหลือ (ปัดพิกัด), สถานีวัดน้ำ, เส้นทางเลี่ยงทางการ/ถนนปิด — อัปเดตเรียลไทม์ผ่าน SSE (`/api/events`)
- **หาเส้นทางเลี่ยงน้ำ**: เลือกจุดเริ่ม (GPS/แตะ) และปลายทาง (แตะ/ค้นหา) → `/api/route` สร้างโซนน้ำจากรายงาน 24 ชม. (ระดับข้อเท้าขึ้นไป รัศมี 150–250 ม.) + ถนนปิดของเจ้าหน้าที่ แล้วเลือกเส้นทางที่ไม่ตัดโซน ถ้าไม่มีจะเตือน; แสดงระยะ/เวลา/รายการเลี้ยว และลิงก์ Google Maps พร้อม waypoint
- เจ้าหน้าที่ (`#/staff`): คัดกรอง/มอบหมาย/ปิด/ลบ คำขอ รายงาน ตามหาคน ของหาย; วาดและเผยแพร่เส้นทางเลี่ยง/ถนนปิด; `#/admin` แก้เบอร์ติดต่อ (ช่องว่าง = "รอใส่เบอร์")

## ข้อมูลเบอร์โทร
เบอร์ที่ตรวจสอบแล้วมีช่อง `source` ใน `seed-contacts.js` (1337, ศาลาว่าการเมืองพัทยา 038-253-100, ทม.หนองปรือ 038-933-100,
ทต.ห้วยใหญ่ 038-239-440, รพ.พัทยาปัทมคุณ 038-411-551, รพ.เมืองพัทยา 038-103-900/999, สสอ.บางละมุง 038-221-925,
กู้ภัยสว่างบริบูรณ์ 038-222-474 / 080-641-6161) ที่เหลือเป็น "รอใส่เบอร์" — แก้ได้ในหน้าแอดมิน ควรโทรยืนยันก่อนใช้งานจริง

## API หลัก
`GET /api/config|forecast|water|rain|reports|requests/public|roads|lostfound|status|route|events` ·
`POST /api/reports|requests|missing|lostfound|staff/login|staff/roads` · `PATCH/DELETE /api/staff/:coll/:id` · `PUT /api/staff/contacts`

## Deploy ฟรี
- **Render** (แนะนำ): New → Web Service → Build `npm install`, Start `npm start`, ตั้ง env `STAFF_PASSWORD`; เพิ่ม Persistent Disk mount ที่ `/data` แล้วตั้ง `DATA_DIR=/data` (แพ็กเกจฟรีไม่มีดิสก์ถาวร ข้อมูลหายเมื่อรีสตาร์ต)
- **Fly.io / Railway**: รันได้เหมือนกัน (มี volume)
- **Vercel**: ไม่เหมาะกับโค้ดนี้ตรง ๆ (serverless ไม่มีไฟล์ถาวร และ SSE จำกัดเวลา) ต้องย้ายที่เก็บไป DB เช่น Supabase/Postgres

## ข้อจำกัด
- ไม่มีสถานีวัดระดับน้ำ (โทรมาตร) ในเขตพัทยา/บางละมุง ระบบจึงแสดงสถานีที่ใกล้ที่สุดใน ชลบุรี/ระยอง/ฉะเชิงเทรา (43–86 กม.) ถ้า API ล่มจะแสดงข้อผิดพลาด ไม่สร้างค่าขึ้นเอง
- OSRM demo / Nominatim เป็นบริการสาธารณะ มีข้อจำกัดการใช้งาน ควรใช้ ORS key หรือโฮสต์เองเมื่อใช้งานจริง
- รหัสผ่านเจ้าหน้าที่ใช้ร่วมกัน 1 รหัส (ระบุชื่อทีมตอนเข้าสู่ระบบเพื่อบันทึก audit) · ยังไม่มีหลายภาษา · ไม่ได้ฝังภาพสด CCTV
- พื้นที่/พิกัดศูนย์กลางของแต่ละพื้นที่เป็นค่าประมาณ แก้ได้ในหน้าแอดมิน

## ระบบหลังบ้าน (Back-office) — `/admin`
- เข้า `/admin` ด้วย **ชื่อผู้ใช้ + รหัสผ่าน** ผู้ดูแลสูงสุดคนแรกสร้างอัตโนมัติจาก `ADMIN_USERNAME` (ค่าเริ่มต้น `admin`) + `STAFF_PASSWORD` · รหัสผ่านเก็บแบบ bcrypt
- บทบาท: `superadmin` (ทุกอย่าง + ผู้ใช้), `admin` (ข้อมูล ข้อความ ตั้งค่า ลบ ส่งออก), `staff` (ดู/อัปเดตสถานะเคส วาดเส้นทาง)
- ภาพรวมสถิติ, จัดการทุกข้อมูล (ค้นหา กรอง แก้ไข ลบ ทำหลายรายการ ส่งออก CSV), ข้อความทั้งเว็บ (CMS key-value พร้อมค่าเริ่มต้น/คืนค่า), ตั้งค่าโลโก้ สี แบนเนอร์ ลำดับ/ซ่อนส่วนหน้าหลัก, ผู้ใช้, audit log
- ข้อความ: เขียนในโค้ดเป็น `T('key','ค่าเริ่มต้น')` (app.js), `S('key','…')` (server.js), `{{T:key|…}}` (index.html) — `texts.js` สแกนสร้างรายการให้หน้าแก้ไขอัตโนมัติ
- ที่เก็บข้อมูล: ตั้ง `DATABASE_URL` (Postgres) → เก็บทุกอย่างรวมรูปใน Postgres (ตาราง `pfc_kv`, `pfc_photos`) ไม่ตั้ง → ไฟล์ `data/db.json` (บน Render ฟรีจะหายเมื่อรีสตาร์ต)
- CCTV เมืองพัทยา: ดึงรายชื่อ/พิกัดกล้องจาก API สาธารณะ `livestream.pattaya.go.th/kapi/live/map` (แคช 10 นาที) ภาพสดเป็น WebRTC ที่ต้องผ่าน Cloudflare Turnstile และห้ามฝัง (CSP frame-ancestors) จึงลิงก์ไปเว็บต้นทาง ไม่ proxy สตรีม · กล้องที่เพิ่มเองรองรับ HLS/snapshot/iframe

## Languages (TH / EN / 中文)
Thai is the default. Public pages have a TH/EN/中文 switcher (saved in localStorage + `pfc_lang` cookie), auto-pick from the browser language on first visit, and `?lang=th|en|zh`; `<html lang>` follows. Default translations live in `i18n/en.json` and `i18n/zh.json`; admins edit every string per language in /admin → ข้อความทั้งเว็บ (language tabs, reset-to-default per language).

## Anti-spam
Public submit forms (reports, help requests, missing, lost-found) have per-IP + per-device rate limits (defaults: reports 5/10 min, help requests 3/10 min, missing 3/10 min, lost-found 5/10 min), a honeypot field, a minimum fill time (3 s), duplicate merging (same spot+type within 10 min / 150 m → "confirmed by N"), photo type/size checks (JPG/PNG/WEBP, ≤3 MB, magic bytes), and a blocked IP list (`1.2.3.4` or `1.2.3.*`). Configure in /admin → 🛡️ กันสแปม. Optional Cloudflare Turnstile: set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET`. `trust proxy` is set to 1 for Render.

## Health / keep-awake
`GET /healthz` → `ok` (no DB work). `.github/workflows/keepalive.yml` pings it every 10 minutes. GitHub disables scheduled workflows after 60 days with no repository activity — re-enable it in the Actions tab if that happens.

## Demo data
Off by default; records marked ทดสอบ / ข้อมูลตัวอย่าง are removed at startup. Set `DEMO_SEED=1` to keep/seed demo records.
