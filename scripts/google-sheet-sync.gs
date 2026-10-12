/**
 * ศูนย์รายงานน้ำท่วมพัทยา → Google Sheet sync (Apps Script, bound to the sheet)
 * Sheet: https://docs.google.com/spreadsheets/d/1IKOj9Yw443DXxwDcXy2n_TOBV4Pl1vXW-c0yRRSLbbU/edit
 * Setup (once): Extensions → Apps Script → paste this file → Project Settings → Script properties:
 *   EXPORT_URL   = https://pattaya-flood-center.onrender.com/api/export/all
 *   EXPORT_TOKEN = <same value as EXPORT_TOKEN on Render>
 * Then run installHourlyTrigger() once (authorise). syncNow() can be run manually any time.
 * Data rows (row 2+) of each tab are replaced; headers, banding, formulas on สรุป and charts are kept.
 */
const LV = { dry: 'แห้ง', ankle: 'ข้อเท้า', knee: 'เข่า', waist: 'เอว', chest: 'อก', roof: 'มิดหัว' };
const ST = { new: 'รับเรื่องแล้ว', triaged: 'คัดกรองแล้ว', assigned: 'ส่งต่อทีมแล้ว', enroute: 'ทีมกำลังเดินทาง', resolved: 'ช่วยเหลือเรียบร้อย', closed: 'ปิดเคส',
  verified: 'ยืนยันแล้ว', hidden: 'ซ่อน', searching: 'กำลังตามหา', found: 'พบตัวแล้ว', open: 'เปิด/ประกาศอยู่' };
const MOD = { pending: 'รอตรวจสอบ', verified: 'ตรวจสอบแล้ว', held: 'กักไว้', rejected: 'ปฏิเสธ' };
const KIND = { food: 'อาหาร/น้ำ', evacuate: 'อพยพ', medical: 'ผู้ป่วย/การแพทย์', other: 'อื่น ๆ' };
const PRI = { low: 'ต่ำ', normal: 'ปกติ', high: 'สูง', critical: 'วิกฤต' };
const TYPE = { detour: 'เส้นทางเลี่ยง', closed: 'ถนนปิด', lost: 'ของหาย', found: 'พบของ' };
const t = (m, v) => (v == null || v === '' ? '' : m[v] || v);
const d = (s) => (s ? new Date(s) : '');
const ok = (b) => (b === true || b === 'true' ? '✔' : '');
const map = (la, ln) => (la !== '' && la != null && ln !== '' && ln != null ? `=HYPERLINK("https://www.google.com/maps?q=${la},${ln}","เปิดแผนที่")` : '');

function syncNow() {
  const p = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch(p.getProperty('EXPORT_URL'), { headers: { 'x-export-token': p.getProperty('EXPORT_TOKEN') }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('export HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  const x = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.getActive(); ss.setSpreadsheetTimeZone('Asia/Bangkok');
  const put = (name, rows) => { const sh = ss.getSheetByName(name); const n = sh.getLastRow(); if (n > 1) sh.getRange(2, 1, n - 1, sh.getLastColumn()).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows); };
  const newest = (a) => a.slice().sort((p, q) => String(q.createdAt || q.at).localeCompare(String(p.createdAt || p.at)));
  put('รายงานน้ำท่วม', newest(x.reports).map((r) => [r.id, d(r.createdAt), r.areaName, t(LV, r.level), r.levelText, r.cm, r.note, t(ST, r.status), t(MOD, r.mod), r.modBy, r.confirms, map(r.lat, r.lng), r.lat, r.lng]));
  put('คำขอช่วยเหลือ', newest(x.requests).map((r) => [r.id, d(r.createdAt), t(KIND, r.kind), r.areaName, r.name, r.phone, r.people, r.needs, r.address, r.note, t(PRI, r.priority), r.assignee, t(ST, r.status), d(r.updatedAt), map(r.lat, r.lng), r.lat, r.lng]));
  put('ถนนปิด', newest(x.roads).map((r) => [r.id, d(r.createdAt), t(TYPE, r.type), r.title, r.note, t(ST, r.status), map(r.lat, r.lng), r.lat, r.lng]));
  put('ของหาย', newest(x.lostfound).map((r) => [r.id, d(r.createdAt), t(TYPE, r.type), r.category, r.title, r.detail, r.place, r.phone, t(ST, r.status), t(MOD, r.mod)]));
  put('คนหาย', newest(x.missing).map((r) => [r.id, d(r.createdAt), r.personName, r.age, r.lastSeen, r.description, r.reporterName, r.reporterPhone, t(ST, r.status), t(MOD, r.mod)]));
  put('เบอร์ฉุกเฉิน', x.contacts.map((r) => [r.group, r.name, r.phone ? "'" + r.phone : '', r.note, ok(r.verified), r.source]));
  put('พื้นที่', x.areas.map((a) => [a.id, a.name, a.org, a.coordinator, a.phone ? "'" + a.phone : '', ok(a.served), ok(a.verified), map(a.lat, a.lng), a.lat, a.lng, a.source]));
  put('บันทึกการแก้ไข', newest(x.audit).map((a) => [d(a.at), a.by, a.action, a.coll, a.id, a.detail]));
  ss.getSheetByName('สรุป').getRange('C2').setValue(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm') + ' น. — ซิงก์อัตโนมัติจาก API ส่งออก (ทุกชั่วโมง)');
}
function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().filter((g) => g.getHandlerFunction() === 'syncNow').forEach((g) => ScriptApp.deleteTrigger(g));
  ScriptApp.newTrigger('syncNow').timeBased().everyHours(1).create(); syncNow();
}
