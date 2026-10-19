// DEMO_MODE=1: self-contained public demo (throwaway sample data, demo accounts, DEMO banner on every page).
// Never uses DATABASE_URL / EXPORT_TOKEN / Turnstile keys even if they are set. Data lives in DATA_DIR (ephemeral on Render free).
const fs = require('fs'), crypto = require('crypto');
const ON = process.env.DEMO_MODE === '1';
const LABEL = process.env.DEMO_LABEL || 'แบบ A';
const ACCOUNTS = [['demo-super', 'superadmin', 'demo-super1'], ['demo-admin', 'admin', 'demo-admin1'], ['demo-staff', 'staff', 'demo-staff1']];
function prepEnv() {
  if (!ON) return;
  for (const k of ['DATABASE_URL', 'EXPORT_TOKEN', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET']) delete process.env[k];
  Object.assign(process.env, { DEMO_SEED: '1', ADMIN_USERNAME: 'demo-super', STAFF_PASSWORD: 'demo-super1' });
  if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.log(`DEMO_MODE=1 (${LABEL}): sample data only, DATABASE_URL/EXPORT_TOKEN ignored`);
}
const BANNER = `<div id="demo-banner" role="note" style="position:sticky;top:0;z-index:99999;background:#ffbf2f;color:#111;font:700 14px/1.4 system-ui,'Noto Sans Thai',sans-serif;text-align:center;padding:6px 10px;border-bottom:2px solid #111">DEMO / ข้อมูลตัวอย่าง — ${LABEL} · เว็บทดลอง ไม่ใช่ระบบจริง ข้อมูลเป็นตัวอย่างและจะถูกล้างเมื่อรีสตาร์ต · Demo only, not the live service</div>`;
const inject = (s) => (/<body[^>]*>/i.test(s) ? s.replace(/<body[^>]*>/i, (m) => m + BANNER) : s);
function install(app, adminHtmlPath) {
  if (!ON) return;
  app.use((req, res, next) => { const send = res.send.bind(res); res.send = (b) => send(typeof b === 'string' && b.trimStart().startsWith('<') ? inject(b) : b); next(); });
  app.get(['/admin', '/admin/', '/admin.html'], (req, res) => res.type('html').set('cache-control', 'no-store').send(fs.readFileSync(adminHtmlPath, 'utf8')));
}
const NOTE0 = 'ข้อมูลตัวอย่าง (DEMO)';
function seed(db, { newId, bcrypt, place }) {
  if (!ON) return;
  for (const [username, role, pw] of ACCOUNTS) if (!db.users.some((u) => u.username === username)) db.users.push({ id: newId('U'), username, name: 'Demo ' + role, role, hash: bcrypt.hashSync(pw, 10), active: true, pwv: 1, createdAt: new Date().toISOString() });
  // staff duty points (จุดบริการ & รับบริจาค) — seeded separately so an existing demo DB gets them too. Mainland Pattaya only.
  if (Array.isArray(db.points) && !db.points.length) { const t = Date.now(), iso2 = (ms) => new Date(ms).toISOString(), P2 = (la, ln) => { const p = place ? place(la, ln) || {} : {}; return { soi: p.soi || '', soiEn: p.soiEn || '', road: p.road || '', roadEn: p.roadEn || '', landmark: p.landmark || '', landmarkEn: p.landmarkEn || '', landmarkM: p.landmarkM ?? null, placeSrc: p.placeSrc || 'osm' }; };
    [['จุดเจ้าหน้าที่ แยกพัทยาใต้–สาย 2 (ตัวอย่าง)', 12.9268, 100.8812, 8, 'น้ำดื่ม, ข้าวกล่อง', '0381000101', '07:00–21:00', 'open', 25], ['จุดเจ้าหน้าที่ ถนนเฉลิมพระเกียรติ (ตัวอย่าง)', 12.9290, 100.8902, 5, 'น้ำดื่ม, ขนมปัง', '0381000102', '08:00–20:00', 'open', 50],
     ['จุดเจ้าหน้าที่ ถนนเพนียดช้าง (ตัวอย่าง)', 12.9352, 100.8990, 6, 'ข้าวกล่อง 30 กล่อง', '0381000103', 'ตลอด 24 ชม.', 'open', 15], ['จุดเจ้าหน้าที่ นาเกลือ (ตัวอย่าง)', 12.9575, 100.8975, 4, 'น้ำดื่ม', '0381000104', '08:00–18:00', 'open', 95],
     ['จุดเจ้าหน้าที่ จอมเทียนสาย 2 (ตัวอย่าง)', 12.8930, 100.8770, 0, '', '0381000105', '08:00–18:00', 'closed', 180]]
      .forEach(([name, lat, lng, staff, needs, phone, hours, status, minAgo]) => db.points.push({ id: newId('P'), name, lat, lng, staff, needs, phone, hours, note: NOTE0, status, createdAt: iso2(t - 6 * 3600e3), updatedAt: iso2(t - minAgo * 60e3), updatedBy: 'demo-staff', ...P2(lat, lng) })); }
  if (db.demoSeeded) return; db.demoSeeded = true;
  const now = Date.now(), P = (la, ln) => (place ? place(la, ln) || {} : {}), iso = (ms) => new Date(ms).toISOString(), NOTE = 'ข้อมูลตัวอย่าง (DEMO)';
  const spots = [[12.9236, 100.8828, 6, 'พัทยาใต้'], [12.926, 100.879, 5, 'พัทยาใต้'], [12.9355, 100.889, 4, 'พัทยากลาง'], [12.9306, 100.8965, 3, 'พัทยากลาง'], [12.8885, 100.873, 3, 'จอมเทียน'], [12.957, 100.897, 2, 'นาเกลือ'], [12.9175, 100.8905, 2, 'พัทยาใต้'], [12.944, 100.893, 1, 'พัทยาเหนือ']];
  const L = ['ankle', 'knee', 'waist', 'knee', 'ankle', 'chest'], rep = (la, ln, lv, at, area) => ({ id: newId('R'), areaId: null, areaName: area, level: lv, lat: la, lng: ln, note: NOTE, photo: null, status: 'new', mod: 'verified', modBy: 'demo', confirms: 1, votes: { yes: [], no: [] }, ...P(la, ln), createdAt: iso(at) });
  spots.forEach(([la, ln, n, area], i) => { for (let k = 0; k < n; k++) db.reports.push(rep(la + k * 0.0002, ln, L[(i + k) % 6], now - (k * 9 + i + 1) * 864e5 - 3600e3 * (i + 2), area)); });
  for (let h = 0; h < 6; h++) { const [la, ln, , area] = spots[h]; db.reports.push(rep(la, ln, L[h], now - h * 2.5 * 3600e3, area)); }
  db.reports.push({ ...rep(12.9335, 100.8935, 'knee', now - 1800e3, 'พัทยากลาง'), mod: 'pending', modBy: undefined });
  const teams = ['ทีมกู้ภัย (ตัวอย่าง)', 'ทีมเรือ อปพร. (ตัวอย่าง)', 'ทีมแพทย์ฉุกเฉิน (ตัวอย่าง)'], st = ['new', 'assigned', 'enroute', 'resolved', 'triaged', 'enroute', 'resolved'];
  st.forEach((s, i) => { const c = now - (i + 1) * 2 * 3600e3, h = [{ at: iso(c), s: 'new', by: 'ประชาชน' }]; if (s !== 'new') h.push({ at: iso(c + (12 + i * 6) * 60e3), s: s === 'triaged' ? 'triaged' : 'assigned', by: 'demo-staff' });
    if (['enroute', 'resolved'].includes(s)) h.push({ at: iso(c + (40 + i * 5) * 60e3), s: 'enroute', by: 'demo-staff' }); if (s === 'resolved') h.push({ at: iso(c + (95 + i * 5) * 60e3), s: 'resolved', by: 'demo-staff' });
    const [la, ln] = spots[i]; db.requests.push({ id: newId('C'), kind: ['food', 'evacuate', 'medical'][i % 3], areaId: 'central', areaName: 'พัทยากลาง', name: 'ผู้แจ้งตัวอย่าง ' + (i + 1), phone: '08100000' + (10 + i), people: 2 + i, needs: ['น้ำดื่ม'], level: 'knee', lat: la, lng: ln, address: '', note: NOTE, photo: null, status: s, statusText: s, assignee: ['new', 'triaged'].includes(s) ? '' : teams[i % 3], history: h, createdAt: iso(c), ...P(la, ln) }); });
  db.lostfound.push({ id: newId('L'), type: 'lost', category: 'สัตว์เลี้ยง', title: 'แมวสีส้ม (ตัวอย่าง)', detail: NOTE, place: 'พัทยากลาง', phone: '0810000099', photo: null, status: 'open', mod: 'verified', createdAt: iso(now - 5 * 3600e3) });
  db.missing.push({ id: newId('M'), personName: 'บุคคลตัวอย่าง', age: '70', lastSeen: 'พัทยาใต้ (ตัวอย่าง)', description: NOTE, reporterName: 'ผู้แจ้งตัวอย่าง', reporterPhone: '0810000098', photo: null, status: 'searching', createdAt: iso(now - 7 * 3600e3) });
  if (Array.isArray(db.safe)) [['สมชาย ใจดี', 'พัทยาใต้ 13', 'อยู่บ้านญาติ ปลอดภัยดี'], ['Somsak Rakdee', 'Jomtien 2', 'Safe at shelter'], ['สมหญิง ทองดี', 'บัวขาว 15', '']].forEach(([n, s, m], i) => db.safe.push({ id: newId('SF'), name: n, phone: '0899999' + (100 + i), areaName: 'พัทยาใต้', soi: s, message: (m ? m + ' ' : '') + '(ตัวอย่าง)', status: 'open', mod: i === 2 ? 'pending' : 'verified', createdAt: iso(now - i * 3600e3) }));
  // shelters (admin-managed; staff update occupancy) — only if the server's DEMO_SEED didn't already add some
  if (Array.isArray(db.shelters) && !db.shelters.length) [['ศูนย์พักพิงโรงเรียนเมืองพัทยา 8 (ตัวอย่าง)', 12.9342, 100.8889, 300, 212, ['อาหาร', 'น้ำดื่ม', 'ห้องน้ำ', 'จุดชาร์จโทรศัพท์']], ['ศูนย์พักพิงวัดชัยมงคล (ตัวอย่าง)', 12.9215, 100.8784, 150, 150, ['อาหาร', 'น้ำดื่ม']], ['ศูนย์พักพิงศาลาประชาคมนาเกลือ (ตัวอย่าง)', 12.9562, 100.8929, 200, 64, ['อาหาร', 'พยาบาล', 'รับสัตว์เลี้ยง']], ['ศูนย์พักพิงอาคารกีฬาจอมเทียน (ตัวอย่าง)', 12.8935, 100.8762, 250, 40, ['อาหาร', 'ที่นอน', 'ไฟฟ้า']]]
    .forEach(([name, lat, lng, capacity, occupancy, facilities]) => db.shelters.push({ id: newId('S'), name, lat, lng, capacity, occupancy, facilities, phone: '1337', contact: 'ศูนย์ประสานงาน (ตัวอย่าง)', note: NOTE, status: occupancy >= capacity ? 'full' : 'open', createdAt: iso(now - 6 * 3600e3), ...P(lat, lng) }));
  // extra routing hazards: a fresh deep report on Bua Khao + a closed stretch of Second Road (in addition to the server's DEMO_SEED route hazards)
  db.reports.push(rep(12.9288, 100.8905, 'waist', now - 40 * 60e3, 'พัทยาใต้'), rep(12.9372, 100.8858, 'knee', now - 25 * 60e3, 'พัทยากลาง'));
  db.roads.push({ id: newId('W'), type: 'closed', title: 'ถนนพัทยาสาย 2 ช่วงซอย 10–12 (ตัวอย่าง)', note: NOTE, points: [[12.9395, 100.8846], [12.9418, 100.8853]], status: 'open', by: 'demo', approval: 'approved', createdAt: iso(now - 90 * 60e3) });
  console.log('DEMO_MODE: seeded sample data + demo accounts');
}
module.exports = { ON, prepEnv, install, seed, ACCOUNTS };
