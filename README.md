# แจ้งเตือนน้ำท่วม เมืองพัทยา (Pattaya Flood Alert) — ต้นแบบ · ดีไซน์ B

เว็บแจ้งเตือนและรับแจ้งน้ำท่วมสำหรับเมืองพัทยา จ.ชลบุรี ดีไซน์ B: ระดับเตือนภัย 5 ระดับเต็มความกว้างหน้า · สิ่งที่ควรทำตามระดับ · แบบฟอร์มทีละคำถามพร้อมหน้าตรวจคำตอบ · แผนที่คู่รายการ · ชุดสี WCAG AA ใหม่ · ไอคอนชุดของเว็บเอง — ดู `DESIGN-NOTES.md`
(ดีไซน์ A "พัทยาเฝ้าระวังน้ำ" อยู่ที่ branch master)
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
- ไม่มีสถานีวัดระดับน้ำ (โทรมาตร) ในเขตพัทยา/บางละมุง ระบบจึงใช้รายงานจากประชาชนเป็นหลัก และบอกชื่อสถานีที่ใกล้ที่สุด (43–86 กม.) เพื่ออ้างอิงเท่านั้น ถ้า API ล่มจะแสดงข้อผิดพลาด ไม่สร้างค่าขึ้นเอง
- OSRM demo / Nominatim เป็นบริการสาธารณะ มีข้อจำกัดการใช้งาน ควรใช้ ORS key หรือโฮสต์เองเมื่อใช้งานจริง
- รหัสผ่านเจ้าหน้าที่ใช้ร่วมกัน 1 รหัส (ระบุชื่อทีมตอนเข้าสู่ระบบเพื่อบันทึก audit) · ยังไม่มีหลายภาษา · ไม่ได้ฝังภาพสด CCTV
- พื้นที่/พิกัดศูนย์กลางของแต่ละพื้นที่เป็นค่าประมาณ แก้ได้ในหน้าแอดมิน

## ระบบหลังบ้าน (Back-office) — `/admin`
- เข้า `/admin` ด้วย **ชื่อผู้ใช้ + รหัสผ่าน** ผู้ดูแลสูงสุดคนแรกสร้างอัตโนมัติจาก `ADMIN_USERNAME` (ค่าเริ่มต้น `admin`) + `STAFF_PASSWORD` · รหัสผ่านเก็บแบบ bcrypt
- บทบาท staff < admin < superadmin (บังคับที่เซิร์ฟเวอร์ — ปุ่ม/เมนูที่ไม่มีสิทธิ์จะถูกซ่อน):

| สิทธิ์ | staff | admin | superadmin |
|---|:-:|:-:|:-:|
| ดูรายงาน คำขอช่วยเหลือ สถิติ · ดาวน์โหลด CSV · เปลี่ยนรหัสผ่านตัวเอง | ✔ | ✔ | ✔ |
| อัปเดตสถานะงาน (กำลังไป / เสร็จ ฯลฯ) — เฉพาะสถานะ | ✔ | ✔ | ✔ |
| ตั้งสถานะ "ซ่อน" (hidden) | – | ✔ | ✔ |
| ตรวจรายงานประชาชน: ยืนยัน (verify) | ✔ | ✔ | ✔ |
| ตรวจรายงานประชาชน: พัก/ซ่อน (hold) · ปฏิเสธ (reject) | – | ✔ | ✔ |
| ส่งคำขอถนนปิด/เส้นทางเลี่ยง | ✔ (รออนุมัติ) | ✔ (เผยแพร่ทันที) | ✔ |
| อนุมัติ/ปฏิเสธคำขอถนนปิด · ดูประวัติการแก้ไข (audit) | – | ✔ | ✔ |
| ดูข้อมูลอ้างอิง (เบอร์ติดต่อ โรงพยาบาล พื้นที่ CCTV ลิงก์) | – | ดูอย่างเดียว | ✔ |
| สร้าง/แก้ไขช่องอื่นนอกจากสถานะ · มอบหมายทีม/ความสำคัญ · ลบใด ๆ | – | – | ✔ |
| ข้อความทั้งเว็บ · โลโก้ · ตั้งค่าเว็บ · กันสแปม · ขอบเขตพื้นที่ · ตั้งค่าการตรวจสอบ · กล้องเมืองพัทยา · ผู้ใช้ | – | – | ✔ |

  ไม่มีสิทธิ์ → HTTP 403 (`/api/admin/moderation/action`, `/api/admin/c/:coll/bulk`, `PATCH`/`DELETE /api/staff/:coll/:id`, `PUT /api/admin/c/:coll/:id` ตรวจทีละการกระทำ) · ทดสอบ: `node scripts/admin-smoke.js` (รวมการตรวจ 403 ตามบทบาท)
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

## Moderation (hybrid) for citizen reports
- Applies to water reports and lost&found. Help/evacuation/medical requests and missing persons are **never** moderated or delayed. Closed roads/detours are staff-created only, so they are always live.
- States (`mod`): `pending` (รอตรวจสอบ: shown faded with a badge in hybrid mode), `verified` (ยืนยันแล้ว), `held` (hidden, in the review queue), `rejected`.
- Modes (Admin → ตั้งค่าเว็บ → การตรวจสอบ, live + audit-logged): `hybrid` (default) / `approve` (nothing public until approved) / `off` (everything verified; switching to off verifies all pending items).
- Auto-verify: in hybrid mode, after N distinct devices confirm (default 2; with `distinctIp` the IPs must be distinct too). Confirms come from the 'ยืนยันว่าจริง' button or from a duplicate report merged nearby. The reporter's own device doesn't count.
- 'ไม่พบน้ำท่วมแล้ว' votes: when there are ≥ clearN of them after the last confirm, the report is marked "possibly cleared". Votes are limited to one per device per report, plus a rate limit.
- Held automatically: anything matching the word list (Thai substring / English whole word), links / LINE IDs, phone numbers in the text, or flagged devices/IPs.
- Queue: /admin#mod (pending + held, approve/reject/hold, bulk actions, map, photo; nav badge updates via SSE).
- Routing avoidance uses **verified + pending** reports, because sending someone around an unconfirmed flood costs little and sending them into water is dangerous. It ignores held, rejected and possibly-cleared reports.
- Migration: existing records with no `mod` become `verified` at startup. This works for both the file and Postgres stores, since they share the same JSON document.

## Jurisdiction: Pattaya City mainland only
- `geo/pattaya-boundary.geojson`: OSM relation 12645794 (เมืองพัทยา), fetched with Nominatim. Only the mainland polygon is kept; Ko Lan, Ko Sak and Ko Khrok are excluded.
- Public submissions (water reports and help requests with a location or area) are checked server-side with point-in-polygon plus an admin buffer (default 300 m; Admin → ตั้งค่าเว็บ → เขตรับเรื่อง). Submissions outside the boundary get a translated message that names nearby agencies.
- Maps draw the boundary and set maxBounds. Nominatim search is limited to the city bbox and the polygon. Areas outside the city are hidden from the pickers. Routing endpoints must be inside the city.
- `geo/flood-hotspots.json`: recurring flood spots taken from news reports. Coordinates are approximate. The sources are kept in the file only and are not exposed by `/api/hotspots`. The spots are shown as a map layer and are not used in routing.

## Forecast
- Fetched server-side only and cached for 30 min, in memory and in the DB (`fcCache`), so a restart reuses it. Only one request runs at a time, with exponential backoff on 429 and errors.
- Falls back to MET Norway (api.met.no, with a proper User-Agent). If every provider fails, the last cached data is served with "อัปเดตล่าสุดเมื่อ …".

## Look
- Pattaya City seal (Wikimedia Commons "File:Pattaya seal.png", originally from pattaya.go.th) is stored at `public/pattaya-seal.png`, with icons generated at 32/180/192/512. Admins can replace it with the logo URL setting or POST /api/admin/logo.
- Noto Sans Thai font. Sea/turquoise, sunset orange and sand palette (unchanged), with red reserved for emergencies.
- Layout v3 (see `DESIGN-NOTES.md`): side rail navigation on desktop (≥960 px) with hotline buttons; compact top bar + bottom tab bar with a centre quick-action sheet on mobile. Home is a dashboard whose sections are reorderable in /admin → settings: `status` (city flood status hero computed from the last 24 h of reports + rain forecast), `livemap`, `metrics`, `quick`, `rainwater`, `near`, `hotlines`, `sources`, `staffentry`. Map page is map-first (full-height map, floating legend/detour panel). New pages `#/call` (phone book) and `#/more` (full menu). Own inline SVG icon set (`IC` in public/app.js). All public copy uses CMS keys (`site.*`, `nav.*`, `tab.*`, `sheet.*`, `dash.*`, `rep.*`, `aid.*`, `track.*`, `zone.*`, `feed.*`, `find.*`, `lost.*`, `cam.*`, `wx.*`, `gmap.*`, `call.*`, `menu.*`) with TH defaults and EN/中文 in i18n/.
- Screenshots: `BASE=http://localhost:3600 node scripts/screenshot.js` → new-home-mobile.png, new-home-desktop.png, new-map.png, new-report-form.png, new-help.png.

## Water levels: Pattaya City only
- ThaiWater api-v3 (`waterlevel_load`) has no telemetered water-level station inside Pattaya City. The nearest is บ้านเขาโบสถ์, Rayong (RID), about 43 km away.
- `/api/water` returns only stations inside the boundary (+2 km). When there are none, it returns the nearest station's name and distance (shown as a note, not as data), plus two in-city sources:
  - ThaiWater 24-h rain gauges inside the boundary
  - citizen water reports inside the city from the last 24 h
- Reservoirs (Map Prachan, Chak Nok, Huai Yai) and tide gauges are not shown, because no working public API for them was found. Nothing is estimated.

## Supervisors' Google Sheet (full-data export)
- `GET /api/export/all` — every dataset as JSON (`?dataset=reports&format=csv` for one CSV). Auth: `EXPORT_TOKEN` env (≥24 chars) via `x-export-token` header or `?token=`, or an admin/superadmin session. Citizens' phones are masked to the last 4 digits; IPs, device ids, vote fingerprints and photos are never included.
- Sheet sync: `scripts/google-sheet-sync.gs` (Apps Script bound to the sheet, hourly trigger). Set script properties `EXPORT_URL` + `EXPORT_TOKEN`, run `installHourlyTrigger()` once.
