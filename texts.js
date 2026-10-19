// Builds the editable text registry by scanning T('key','default') / S('key','default') / {{T:key|default}} in source files.
const fs = require('fs'), path = require('path');
const GROUPS = { site: 'ทั้งเว็บ (ชื่อเว็บ ส่วนหัว ส่วนท้าย meta)', nav: 'ปุ่มนำทางทั่วไป', home: 'หน้าหลัก', report: 'หน้ารายงานระดับน้ำ', help: 'หน้าขอความช่วยเหลือ / อพยพ / ผู้ป่วย', status: 'หน้าเช็กสถานะเคส', area: 'หน้าพื้นที่ของฉัน', updates: 'หน้าอัปเดตล่าสุด', missing: 'หน้าตามหาคน', lf: 'หน้าของหาย–ได้คืน', cctv: 'หน้า CCTV', weather: 'หน้าพยากรณ์ / ข้อมูลน้ำ', map: 'หน้าแผนที่และเส้นทางเลี่ยง', staff: 'หน้าเจ้าหน้าที่', loc: 'ตัวเลือกตำแหน่ง', level: 'ชื่อระดับน้ำ', st: 'ชื่อสถานะ', kind: 'ประเภทคำขอ', need: 'รายการสิ่งของที่ขอ', rain: 'ระดับฝน / สถานะสถานี', err: 'ข้อความแจ้งข้อผิดพลาด', msg: 'ข้อความแจ้งผลสำเร็จ', geo: 'เขตเมืองพัทยา', mod: 'การตรวจสอบรายงาน (ยังไม่ยืนยัน / ตรวจแล้ว)', tab: 'แถบเมนูล่างบนมือถือ', sheet: 'หน้าต่างเลือกด่วน (ปุ่มกลางบนมือถือ)', hot: 'ชื่อสายด่วน', dash: 'หน้าภาพรวม (แดชบอร์ด)', rep: 'หน้าแจ้งระดับน้ำ', aid: 'หน้าขอความช่วยเหลือ', track: 'หน้าติดตามคำขอ', zone: 'หน้าสถานการณ์รายพื้นที่', feed: 'หน้าความเคลื่อนไหวล่าสุด', find: 'หน้าตามหาคน', lost: 'หน้าของหาย–พบของ', cam: 'หน้ากล้องถนน', wx: 'ฝน พยากรณ์ และระดับน้ำ', gmap: 'หน้าแผนที่สดและเส้นทางเลี่ยง', call: 'หน้าสมุดโทรศัพท์ฉุกเฉิน', menu: 'หน้าเมนูทั้งหมด' };
const RE = /\b[TS]\('([a-z0-9_.-]+)',\s*'((?:[^'\\]|\\.)*)'/g, RE2 = /\{\{T:([a-z0-9_.-]+)\|([^}]*)\}\}/g;
function build() {
  const out = {};
  const add = (k, d, file) => { if (out[k]) return; const g = k.split('.')[0]; out[k] = { key: k, d: d.replace(/\\'/g, "'").replace(/\\n/g, '\n'), g, group: GROUPS[g] || g, file }; };
  for (const f of ['server.js', 'public/app.js']) { const s = fs.readFileSync(path.join(__dirname, f), 'utf8'); for (const m of s.matchAll(RE)) add(m[1], m[2], f); }
  const h = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8'); for (const m of h.matchAll(RE2)) add(m[1], m[2], 'index.html');
  return out;
}
module.exports = { build, GROUPS };
