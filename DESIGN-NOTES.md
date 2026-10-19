# Design notes, design B: "แจ้งเตือนน้ำท่วม เมืองพัทยา / Pattaya Flood Alert / 芭提雅洪水警报"

Branch `design-b` (local only, not pushed). Design A (`master`, commit e0fb43b, "พัทยาเฝ้าระวังน้ำ / Pattaya FloodWatch") is unchanged and keeps the original Pattaya colours.
Reference site inspected on 19 Oct 2026, 07:21–07:30 (UTC+7): https://chachoengsao-flood.vercel.app/chachoengsao.
Design B takes its *principles* from international public-service and emergency products: GOV.UK design patterns (plain language, one question per page, check-your-answers, summary lists, error summary, start button, inset/warning text), Japanese public warning scales (NHK / JMA-style numbered levels with one fixed colour each), the FEMA app (before / during / after preparedness), and Google SOS alerts (one summary card that answers "how bad is it, and what do I do"). No code, artwork, wording or assets were copied from any of them. Layout, copy, icons and palette are original.

All functions are kept: citizen water reports with photo + map pin + geofence, help requests (evacuate / medical / food) with reference number and tracking, hybrid moderation (pending / verified / cleared tags, "still flooded / water gone" votes, held reports), missing-person reports, lost & found, rain forecast, HII water and rain stations, CCTV list and map, flood map with layers, hotspots, closed roads and detours, flood-avoiding routing, phone book and coordinators, staff triage page with roles, admin (/admin unchanged), CMS text keys, TH/EN/中文, Pattaya seal (`{{LOGO}}`) and the developer credit (`site.credit`).

## Palette (new, design B only, WCAG 2.1 AA)
| Role | Colour | Contrast |
|---|---|---|
| Text | `#111a24` on white | 17.5:1 |
| Secondary text | `#4a5361` on white | 7.8:1 |
| Header / brand | `#101b2b` (white text) | 17.3:1 |
| Links / primary button | `#1a56b8` (white text) | 6.9:1 |
| Start button | `#0f7a3d` (white text) | 5.4:1 |
| Focus | `#ffbf2f` fill + `#111a24` underline bar | 10.7:1 with text |
| Panels / rules / form borders | `#f3f4f6` / `#b7bcc4` / `#4a5361` (3:1+ for inputs) | |
| **Alert 1 ปกติ / Normal** | `#1b7f4b` (white text) | 5.0:1 |
| **Alert 2 เฝ้าระวัง / Watch** | `#f5c400` (dark text) | 10.7:1 |
| **Alert 3 เตรียมพร้อม / Get ready** | `#ef7d22` (dark text) | 6.4:1 |
| **Alert 4 อันตราย / Danger** | `#c8321f` (white text) | 5.3:1 |
| **Alert 5 วิกฤตสูงสุด / Extreme** | `#5e2a84` (white text) | 9.8:1 |
The level is never shown by colour alone: it always comes with the number (1–5) and a word. The header's bottom border takes the current level colour. Admin colour pickers (primary / header / bg) do not affect design B, because it has its own fixed palette.

## Original vs design A vs design B
| # | Original (Chachoengsao) / old Pattaya copy | Design A | Design B |
|---|---|---|---|
| 1 | Name/H1 "ศูนย์ช่วยเหลือน้ำท่วม" | "พัทยาเฝ้าระวังน้ำ / Pattaya FloodWatch" | **"แจ้งเตือนน้ำท่วม" with city line "เมืองพัทยา" / "Pattaya Flood Alert" / "芭提雅洪水警报"**. Title: "แจ้งเตือนน้ำท่วมพัทยา: ระดับเตือนภัย สิ่งที่ต้องทำ และการขอความช่วยเหลือ" |
| 2 | Single column of stacked cards | Side rail app shell + dashboard grid | **Public-service layout**: dark service header (seal + name, text language links, "โทรฉุกเฉิน", "เมนู" toggle), full-width alert band, then 2/3 + 1/3 reading grid (content + sticky contacts column). No side rail, no tab bar, no cards |
| 3 | No persistent nav / bottom nav | Bottom tab bar + raised quick-action sheet | **Header "เมนู" button opens a grouped menu with a one-line description per service** (ขอความช่วยเหลือ / แจ้งข้อมูล / ติดตามสถานการณ์); footer repeats every link; Esc closes |
| 4 | Home starts with food-request card | Status hero with a wave gauge + 4 tiers | **Numbered 5-level alert band** (ระดับ 1–5: ปกติ, เฝ้าระวัง, เตรียมพร้อม, อันตราย, วิกฤตสูงสุด) with a big level box, plain explanation, the reason (deepest report + area, heavy rain), the whole 5-step scale with the current step lifted, and an "assessed at … · not an official warning · what each level means" line. Compact one-line version on every other page |
| 5 | Food hero card, served-area box | Food = one task row | **"สิ่งที่ควรทำตอนนี้"**: 3 numbered actions that change with the level (FEMA/NHK-style guidance), shown in a panel with a thick left bar in the level colour. Level 4–5 adds a red "ขอความช่วยเหลือตอนนี้" button |
| 6 | Expandable coordinator/patient cards | Phone-book page with tiles | Sidebar box **"อันตรายถึงชีวิต โทรทันที"** (big numbers with labels) on every home view + phone-book page as **tables** (name / tap-to-call number) + coordinator lookup shown as a summary list |
| 7 | Pink "call 1669 · 1784" card, red strip | Hotline pills in hero / rail / sheet | Header "โทรฉุกเฉิน" link, sidebar hotline box, and a **warning-text block (black "!" circle)** at the top of the help form |
| 8 | Blue "รายงานระดับน้ำ…" card | Hero button + task row | One link in the task list **"แจ้งระดับน้ำในจุดที่คุณอยู่ →"**. The form is a **step-by-step wizard** |
| 9 | "น้ำท่วมใกล้บ้านฉันไหม?" | "รอบตัวฉันเป็นอย่างไร" coloured box | **"ตรวจสอบบริเวณที่คุณอยู่"**: secondary button + labelled select; result has a heading ("มีจุดน้ำท่วมใกล้คุณ" / "ไม่พบน้ำท่วมที่น่ากังวลใกล้คุณ") |
| 10 | Chevron service list | 3 task columns with icons | **Green start button "เริ่มขอความช่วยเหลือ →"** + a ruled list of plain text links with arrows (no icons) |
| 11 | Rain bar chart with ticks | SVG area + column chart | **24-cell hourly rain strip** (each cell = 1 hour, shaded by mm, number inside, key below), plus a summary list (total, highest chance, start, heaviest hour) and a full hourly **table** on the weather page |
| 12 | Station rows "ล้นตลิ่ง…" | Rewritten rows | **Data table** (สถานี / สถานะ / เทียบตลิ่ง / เวลาวัด); status words "อยู่ในเกณฑ์ปกติ / สูงกว่าปกติ / เกือบถึงตลิ่ง / ล้นตลิ่ง"; resident summary as a summary list. Station + rain data sit in accordions on the home page |
| 13 | "ดูข้อมูลน้ำและอากาศเพิ่มเติม" | "แหล่งข้อมูลภายนอกที่น่าเชื่อถือ" | "แหล่งข้อมูลจากหน่วยงานอื่น", ruled link list with screen-reader "(เปิดในหน้าต่างใหม่)" |
| 14 | Staff login button | Small staff line + rail item | Lock line "เจ้าหน้าที่: เข้าสู่ระบบจัดการคำขอ" + footer link "สำหรับเจ้าหน้าที่" |
| 15 | Footer attribution | Rewritten attribution | Grey footer with a 3-column link index, new attribution sentence, credit unchanged |
| 16 | Report form: numbered chips | Fieldsets + depth cards + checklist | **Wizard, one question per page**: ① "น้ำสูงประมาณเท่าไร" (large radio buttons, each with a small depth gauge) ② "น้ำท่วมอยู่ที่ไหน" (community select + GPS / place search / map) ③ "มีรายละเอียดอื่นหรือไม่" (optional) ④ **"ตรวจคำตอบก่อนส่ง"** summary list with "แก้ไข" links → green **confirmation panel** with the reference number and "ขั้นตอนต่อไป". Error summary box when a step is skipped. Level names: "ต่ำกว่า 10 ซม. — น้ำแค่ผิวถนน", "10–50 ซม. — ข้อเท้าถึงหน้าแข้ง", "50–100 ซม. — เข่าถึงต้นขา", "100–130 ซม. — ระดับเอว", "130–180 ซม. — ระดับอกถึงคอ", "มากกว่า 180 ซม. — ท่วมมิดศีรษะ" |
| 17 | Help form 1-2-3-4 chips | Segmented kind cards + fieldsets | **5-step wizard**: request type (radios with hints) → where (community, map, address) → needs (large checkboxes, number of people, optional depth) → contact (name + phone validated) → check answers → confirmation panel with "ติดตามคำขอนี้". Kinds: "ออกจากพื้นที่น้ำท่วม / ผู้ป่วยหรือยา / อาหาร น้ำดื่ม และของใช้". Sidebar lists accepted areas and the privacy note |
| 18 | "← กลับหน้าหลัก" | Breadcrumb + icon header | Text breadcrumb with chevrons ("หน้าแรก › …") + large plain H1 + lead paragraph, no icons |
| 19 | Map card + legend + form | Map-first with floating tabbed panel | **Map / list view switch** (mobile) and **map 2/3 + accessible list 1/3** (desktop). The list shows every reported spot as a button that zooms and opens it. Legend in an accordion "คำอธิบายสัญลักษณ์"; route finder in an accordion "หาเส้นทางที่เลี่ยงน้ำท่วม" with numbered steps, result as a summary list (distance / time / engine) |
| 20 | Badges + vote wording | Timeline feed + chips | **Record list** with depth tag, H3 area, metadata line, and a filter select in the sidebar; vote prompt "คุณเห็นจุดนี้อยู่ตอนนี้หรือไม่" with "น้ำยังท่วมอยู่ / น้ำแห้งแล้ว"; tags "รอการยืนยัน / ยืนยันแล้ว / มีรายงานว่าน้ำลดแล้ว" (outlined) |
| 21 | "พื้นที่ของฉัน" list | Community cards with depth meters | **Table** (ชุมชน / ระดับเตือนภัย 1–5 tag / น้ำสูงสุดที่แจ้ง / รายงาน / ดูบนแผนที่), map circles coloured by alert level |
| 22 | Lost & found card | Two-column board | **Tabs** "ประกาศทั้งหมด / ลงประกาศใหม่"; type as radios; scam warning as warning text |
| 23 | Missing-person copy | Fieldsets "ผู้ที่ติดต่อไม่ได้ / ผู้แจ้ง" | "แจ้งคนที่ติดต่อไม่ได้": inset privacy note, fieldsets with H-level legends, confirmation panel |
| 24 | Lucide-style icons + emoji | Own outline icon set | **Own solid pictogram set** (filled shapes, `IC` in public/app.js), used sparingly; links and headings are text-only |
| 25 | "● สด" | Pulsing "ข้อมูลสด" chip | "ทดลองใช้" phase tag + "เชื่อมต่อข้อมูลสด" status under the header |
| 26 | — | — | New page **#/levels** "ระดับเตือนภัยน้ำท่วม 5 ระดับ": each level with number, colour, meaning, the rule used, and actions; current level marked |
| 27 | — | — | New home section **"เตรียมตัวรับมือน้ำท่วม"** (accordions: ก่อนน้ำมา / ระหว่างน้ำท่วม / หลังน้ำลด, original advice) |
| 28 | Font | Noto Sans Thai, 17 px | **IBM Plex Sans Thai**, 17 px mobile / 19 px desktop, headings up to 2.8 rem, 44 px minimum touch targets |

## How the alert level is computed (client side, no API change)
Deepest live (not cleared) report in the last 24 h: chest/roof (≥155 cm) → 5, waist (≥115) → 4, knee (≥75) → 3, ankle (≥30) or heavy rain forecast (≥35 mm/24 h or any hour ≥10 mm) → 2, otherwise 1. It is labelled on the page as an automatic assessment, not an official warning.

## Text keys
New CMS groups: ui, lvl, now, prep, steps, wl, ask, case, hood, log, trace, board, sky, eye, atlas, dial, idx, lvlp, vote (+ loc). Server defaults for level.*, kind.* and rain.st* were rewritten. EN and 中文 translations were written for every key; unused keys were removed from i18n/en.json and i18n/zh.json (607 keys each).
If the live database has saved overrides for level.*, kind.* or rain.st*, those still win. Saved home-section settings without the B ids are reset to the B order on start-up (todo, start, summary, latest, mapteaser, rain, near, prepare, sources, staffentry; reorderable in /admin).

## Accessibility
Skip link, landmarks, one H1 per page, breadcrumbs as nav, native radios/checkboxes (44 px), labels + hints on every field, error summary with links to fields, focus moves to the step heading in the wizard, yellow focus state with a dark bar, aria-live for results, aria-pressed for toggles, tables with captions/scope, map list alternative, reduced-motion support, AA contrast throughout.

## Screenshots (local, throwaway data; the 5 sample reports are tagged "ข้อมูลตัวอย่าง (sample)")
new-home-mobile.png · new-home-desktop.png · new-map.png (detour demo) · new-report-form.png (wizard step 1) · new-report-check.png (check answers) · new-help.png (mobile, step 1) · new-levels.png
