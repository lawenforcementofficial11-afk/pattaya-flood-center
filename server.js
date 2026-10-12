// ศูนย์ช่วยเหลือน้ำท่วม เมืองพัทยา — Express + JSON file storage + SSE
const express = require('express');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3600;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'pattaya1337';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('pfc:' + STAFF_PASSWORD).digest('hex');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CENTER = { lat: 12.9236, lng: 100.8825 };
fs.mkdirSync(UP_DIR, { recursive: true });

// ---------- storage ----------
let db;
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { db = {}; }
  const seed = require('./seed-contacts');
  db.contacts ||= JSON.parse(JSON.stringify(seed));
  for (const k of ['reports', 'requests', 'missing', 'lostfound', 'audit', 'roads']) db[k] ||= [];
  db.seq ||= 1000;
  save();
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { const t = DB_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 1)); fs.renameSync(t, DB_FILE); }, 50); }
load();
const newId = (p) => p + '-' + (++db.seq);

// ---------- SSE ----------
const clients = new Set();
function broadcast(type, payload, staffOnly = false) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) if (!staffOnly || c.staff) c.res.write(msg);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 25000);

// ---------- auth ----------
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function makeToken(name) { const v = Buffer.from(JSON.stringify({ n: name, e: Date.now() + 12 * 3600e3 })).toString('base64url'); return v + '.' + sign(v); }
function readToken(req) {
  const m = (req.headers.cookie || '').match(/pfc_staff=([^;]+)/); const t = m ? m[1] : (req.headers['x-staff-token'] || '');
  const [v, s] = String(t).split('.'); if (!v || !s) return null;
  const a = Buffer.from(sign(v)), b = Buffer.from(s); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(v, 'base64url').toString()); return o.e > Date.now() ? o : null; } catch { return null; }
}
const staff = (req, res, next) => { const u = readToken(req); if (!u) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบเจ้าหน้าที่' }); req.staff = u; next(); };

// ---------- helpers ----------
const clean = (s, n = 500) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
const LEVELS = { dry: 'แห้ง / ต่ำกว่าข้อเท้า <10 ซม.', ankle: 'ข้อเท้า–เข่า 10–50 ซม.', knee: 'เข่า–เอว 50–100 ซม.', waist: 'เอว–อก 100–130 ซม.', chest: 'อกขึ้นไป 130–180 ซม.', roof: 'มิดหัว / ท่วมหลังคา >180 ซม.' };
const LEVEL_CM = { dry: 5, ankle: 30, knee: 75, waist: 115, chest: 155, roof: 200 };
function savePhoto(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null; const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) return null;
  const f = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UP_DIR, f), buf); return '/uploads/' + f;
}
function inPattaya(lat, lng) { return lat > 12.6 && lat < 13.3 && lng > 100.6 && lng < 101.3; }
const area = (id) => db.contacts.areas.find((a) => a.id === id);
const last4 = (p) => String(p || '').replace(/\D/g, '').slice(-4);
const publicReport = (r) => ({ id: r.id, areaId: r.areaId, areaName: r.areaName, level: r.level, levelText: LEVELS[r.level], cm: LEVEL_CM[r.level], lat: r.lat, lng: r.lng, note: r.note, photo: r.photo, createdAt: r.createdAt, status: r.status });
const publicRequest = (r) => ({ id: r.id, kind: r.kind, areaName: r.areaName, lat: r.lat ? +r.lat.toFixed(3) : null, lng: r.lng ? +r.lng.toFixed(3) : null, needs: r.needs, status: r.status, createdAt: r.createdAt });

// ---------- external data (cached) ----------
const cache = {};
async function cached(key, ttl, fn) {
  const c = cache[key]; if (c && Date.now() - c.t < ttl) return c.v;
  try { const v = await fn(); cache[key] = { t: Date.now(), v }; return v; }
  catch (e) { if (c) return { ...c.v, stale: true, error: String(e.message || e) }; return { ok: false, error: String(e.message || e) }; }
}
async function getJSON(url, ms = 20000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'pattaya-flood-center/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
}
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 108.5);

function forecast() {
  return cached('forecast', 15 * 60e3, async () => {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CENTER.lat}&longitude=${CENTER.lng}&hourly=precipitation,precipitation_probability,wind_speed_10m&forecast_hours=24&timezone=Asia%2FBangkok`;
    const j = await getJSON(u); const h = j.hourly;
    const total = h.precipitation.reduce((s, x) => s + (x || 0), 0);
    const maxProb = Math.max(...h.precipitation_probability.map((x) => x || 0));
    const i = h.precipitation.findIndex((x) => x >= 0.1);
    let label = 'ไม่มีฝน', color = '#16a34a';
    if (total >= 0.5) { label = 'ฝนเล็กน้อย'; color = '#0284c7'; } if (total >= 10) { label = 'ฝนปานกลาง'; color = '#ca8a04'; } if (total >= 35) { label = 'ฝนหนัก'; color = '#ea580c'; } if (total >= 90) { label = 'ฝนหนักมาก'; color = '#dc2626'; }
    return { ok: true, source: 'Open-Meteo', fetchedAt: new Date().toISOString(), totalMm: +total.toFixed(1), maxProb, startTime: i >= 0 ? h.time[i] : null, label, color,
      hourly: h.time.map((t, k) => ({ t, mm: h.precipitation[k], prob: h.precipitation_probability[k], wind: h.wind_speed_10m[k] })) };
  });
}
function waterLevels() {
  return cached('water', 10 * 60e3, async () => {
    const j = await getJSON('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load', 30000);
    const L = j.waterlevel_data.data.filter((s) => s.station && s.station.tele_station_lat && s.waterlevel_msl != null);
    const pick = L.map((s) => ({ s, d: km(s.station.tele_station_lat, s.station.tele_station_long, CENTER.lat, CENTER.lng) }))
      .filter((x) => x.d < 90 && ['20', '21', '24'].includes(x.s.geocode.province_code)).sort((a, b) => a.d - b.d).slice(0, 8);
    const out = pick.map(({ s, d }) => {
      const wl = +s.waterlevel_msl, prev = s.waterlevel_msl_previous != null ? +s.waterlevel_msl_previous : null, bank = s.station.min_bank;
      const diff = bank != null ? +(wl - bank).toFixed(2) : null;
      let status = 'ปกติ', sev = 0;
      if (diff != null) { if (diff > 0) { status = 'ล้นตลิ่ง'; sev = 3; } else if (diff > -0.5) { status = 'ใกล้ล้นตลิ่ง'; sev = 2; } else if (s.situation_level >= 4 || diff > -1.2) { status = 'น้ำมาก'; sev = 1; } }
      const trend = prev == null ? 'ไม่ทราบ' : wl - prev > 0.02 ? 'กำลังขึ้น' : wl - prev < -0.02 ? 'กำลังลง' : 'ทรงตัว';
      return { id: s.station.id, name: s.station.tele_station_name.th, code: s.station.tele_station_oldcode, province: s.geocode.province_name.th, amphoe: s.geocode.amphoe_name.th, tambon: s.geocode.tumbon_name.th,
        lat: s.station.tele_station_lat, lng: s.station.tele_station_long, distanceKm: Math.round(d), level: wl, bank, diff, status, sev, trend, measuredAt: s.waterlevel_datetime, agency: s.agency?.agency_shortname?.th?.trim() };
    }).sort((a, b) => b.sev - a.sev || a.distanceKm - b.distanceKm);
    return { ok: true, source: 'คลังข้อมูลน้ำแห่งชาติ (api-v3.thaiwater.net)', fetchedAt: new Date().toISOString(), stations: out,
      note: 'ไม่มีสถานีวัดระดับน้ำโทรมาตรในเขตเมืองพัทยา/บางละมุง จึงแสดงสถานีที่ใกล้ที่สุดใน ชลบุรี/ระยอง/ฉะเชิงเทรา' };
  });
}
function rainStations() {
  return cached('rain', 10 * 60e3, async () => {
    const j = await getJSON('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h', 30000);
    const L = (j.data || []).filter((s) => s.geocode?.province_code === '20' && s.station?.tele_station_lat)
      .map((s) => ({ name: s.station.tele_station_name.th, amphoe: s.geocode.amphoe_name.th, rain24h: +s.rain_24h, at: s.rainfall_datetime, lat: s.station.tele_station_lat, lng: s.station.tele_station_long, d: km(s.station.tele_station_lat, s.station.tele_station_long, CENTER.lat, CENTER.lng) }))
      .filter((s) => s.d < 30).sort((a, b) => b.rain24h - a.rain24h).slice(0, 10).map(({ d, ...s }) => ({ ...s, distanceKm: Math.round(d) }));
    return { ok: true, source: 'คลังข้อมูลน้ำแห่งชาติ (api-v3.thaiwater.net) ฝนสะสม 24 ชม.', fetchedAt: new Date().toISOString(), stations: L };
  });
}

// ---------- app ----------
const app = express();
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(UP_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));
const rl = new Map();
function limit(req, res, next) { const k = req.ip + req.path, now = Date.now(); const a = (rl.get(k) || []).filter((t) => now - t < 60e3); if (a.length >= 10) return res.status(429).json({ error: 'ส่งถี่เกินไป ลองใหม่ในอีกสักครู่' }); a.push(now); rl.set(k, a); next(); }

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/config', (req, res) => res.json({ city: 'เมืองพัทยา', province: 'ชลบุรี', center: CENTER, levels: LEVELS, contacts: db.contacts }));
app.get('/api/forecast', async (req, res) => res.json(await forecast()));
app.get('/api/water', async (req, res) => res.json(await waterLevels()));
app.get('/api/rain', async (req, res) => res.json(await rainStations()));
app.get('/api/events', (req, res) => {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write('retry: 5000\n\n'); const c = { res, staff: !!readToken(req) }; clients.add(c); req.on('close', () => clients.delete(c));
});

// water reports (public)
app.get('/api/reports', (req, res) => { const since = Date.now() - (num(req.query.hours) || 48) * 3600e3; res.json(db.reports.filter((r) => r.status !== 'hidden' && Date.parse(r.createdAt) > since).map(publicReport).reverse()); });
app.post('/api/reports', limit, (req, res) => {
  const b = req.body || {}; const lat = num(b.lat), lng = num(b.lng);
  if (!LEVELS[b.level]) return res.status(400).json({ error: 'เลือกระดับน้ำ' });
  if (lat == null || !inPattaya(lat, lng)) return res.status(400).json({ error: 'ตำแหน่งต้องอยู่ในพื้นที่พัทยา/บางละมุง' });
  const a = area(b.areaId);
  const r = { id: newId('R'), areaId: a?.id || null, areaName: a?.name || clean(b.areaName, 80), level: b.level, lat, lng, note: clean(b.note, 300), photo: savePhoto(b.photo), status: 'new', createdAt: new Date().toISOString() };
  db.reports.push(r); save(); broadcast('report', publicReport(r)); res.json({ ok: true, id: r.id });
});

// help requests (food/supplies, rescue, medical)
const KINDS = { food: 'ขออาหาร / ถุงยังชีพ', evacuate: 'ติดอยู่ ต้องการอพยพ', medical: 'ผู้ป่วย / ต้องการยา', other: 'อื่น ๆ' };
app.post('/api/requests', limit, (req, res) => {
  const b = req.body || {}; const a = area(b.areaId);
  if (!a) return res.status(400).json({ error: 'เลือกพื้นที่' });
  if (!a.served) return res.status(400).json({ error: `ยังไม่เปิดรับคำขอทางเว็บสำหรับ ${a.name} กรุณาโทร 1669 / 1784 / 1337` });
  const phone = clean(b.phone, 20); if (last4(phone).length < 4) return res.status(400).json({ error: 'กรอกเบอร์โทรที่ติดต่อได้' });
  const name = clean(b.name, 80); if (!name) return res.status(400).json({ error: 'กรอกชื่อ' });
  const r = { id: newId('C'), kind: KINDS[b.kind] ? b.kind : 'food', areaId: a.id, areaName: a.name, name, phone, people: num(b.people) || 1,
    needs: (Array.isArray(b.needs) ? b.needs : []).map((x) => clean(x, 40)).slice(0, 10), level: LEVELS[b.level] ? b.level : null,
    lat: num(b.lat), lng: num(b.lng), address: clean(b.address, 300), note: clean(b.note, 500), photo: savePhoto(b.photo),
    status: 'new', statusText: 'รับเรื่องแล้ว รอเจ้าหน้าที่', assignee: '', history: [{ at: new Date().toISOString(), s: 'new', by: 'ประชาชน' }], createdAt: new Date().toISOString() };
  db.requests.push(r); save(); broadcast('request', publicRequest(r)); broadcast('staff:request', r, true); res.json({ ok: true, id: r.id });
});
app.get('/api/requests/public', (req, res) => res.json(db.requests.filter((r) => r.status !== 'deleted').map(publicRequest).reverse()));
app.get('/api/status', (req, res) => {
  const r = db.requests.find((x) => x.id.toUpperCase() === String(req.query.id || '').trim().toUpperCase());
  if (!r || last4(r.phone) !== last4(req.query.phone) || !last4(req.query.phone)) return res.status(404).json({ error: 'ไม่พบเคส ตรวจเลขเคสและเบอร์ 4 ตัวท้าย' });
  res.json({ id: r.id, kind: KINDS[r.kind], areaName: r.areaName, status: r.status, statusText: r.statusText, assignee: r.assignee, history: r.history.map((h) => ({ at: h.at, s: h.s, note: h.note })), createdAt: r.createdAt });
});

// missing persons (private) & lost-found (public)
app.post('/api/missing', limit, (req, res) => {
  const b = req.body || {}; if (!clean(b.personName) || last4(b.reporterPhone).length < 4) return res.status(400).json({ error: 'กรอกชื่อผู้สูญหายและเบอร์ผู้แจ้ง' });
  const r = { id: newId('M'), personName: clean(b.personName, 80), age: clean(b.age, 10), lastSeen: clean(b.lastSeen, 300), description: clean(b.description, 500), reporterName: clean(b.reporterName, 80), reporterPhone: clean(b.reporterPhone, 20), photo: savePhoto(b.photo), status: 'searching', createdAt: new Date().toISOString() };
  db.missing.push(r); save(); broadcast('staff:missing', r, true); res.json({ ok: true, id: r.id });
});
app.get('/api/lostfound', (req, res) => res.json(db.lostfound.filter((x) => x.status !== 'hidden').map(({ phone, ...x }) => ({ ...x, phoneMasked: 'xxx-xxx-' + last4(phone) })).reverse()));
app.post('/api/lostfound', limit, (req, res) => {
  const b = req.body || {}; if (!clean(b.title) || last4(b.phone).length < 4) return res.status(400).json({ error: 'กรอกหัวข้อและเบอร์ติดต่อ' });
  const r = { id: newId('L'), type: b.type === 'found' ? 'found' : 'lost', category: clean(b.category, 30), title: clean(b.title, 100), detail: clean(b.detail, 500), place: clean(b.place, 120), phone: clean(b.phone, 20), photo: savePhoto(b.photo), status: 'open', createdAt: new Date().toISOString() };
  db.lostfound.push(r); save(); broadcast('lostfound', { id: r.id }); res.json({ ok: true, id: r.id });
});

// ---------- staff ----------
app.post('/api/staff/login', limit, (req, res) => {
  const pw = String(req.body?.password || ''); const a = Buffer.from(crypto.createHash('sha256').update(pw).digest('hex')), b = Buffer.from(crypto.createHash('sha256').update(STAFF_PASSWORD).digest('hex'));
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  const name = clean(req.body?.name, 40) || 'เจ้าหน้าที่'; const t = makeToken(name);
  res.setHeader('set-cookie', `pfc_staff=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`); res.json({ ok: true, name, token: t });
});
app.post('/api/staff/logout', (req, res) => { res.setHeader('set-cookie', 'pfc_staff=; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/staff/me', staff, (req, res) => res.json({ name: req.staff.n }));
app.get('/api/staff/data', staff, (req, res) => res.json({ requests: [...db.requests].reverse(), reports: [...db.reports].reverse(), missing: [...db.missing].reverse(), lostfound: [...db.lostfound].reverse() }));
const COLL = { requests: 'requests', reports: 'reports', missing: 'missing', lostfound: 'lostfound', roads: 'roads' };
const STATUS_TEXT = { new: 'รับเรื่องแล้ว รอเจ้าหน้าที่', triaged: 'คัดกรองแล้ว จัดลำดับความเร่งด่วน', assigned: 'ส่งต่อทีมในพื้นที่แล้ว', enroute: 'ทีมกำลังเดินทาง', resolved: 'ช่วยเหลือเรียบร้อย', closed: 'ปิดเคส', verified: 'ยืนยันแล้ว', hidden: 'ซ่อน', searching: 'กำลังตามหา', found: 'พบตัวแล้ว', open: 'ประกาศอยู่' };
app.patch('/api/staff/:coll/:id', staff, (req, res) => {
  const c = COLL[req.params.coll]; if (!c) return res.status(404).end(); const r = db[c].find((x) => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'ไม่พบ' });
  const b = req.body || {};
  if (b.status && STATUS_TEXT[b.status]) { r.status = b.status; r.statusText = STATUS_TEXT[b.status]; }
  if (b.priority) r.priority = clean(b.priority, 10); if (b.assignee != null) r.assignee = clean(b.assignee, 80);
  if (r.history) r.history.push({ at: new Date().toISOString(), s: r.status, by: req.staff.n, note: clean(b.note, 200) });
  db.audit.push({ at: new Date().toISOString(), by: req.staff.n, action: 'update', coll: c, id: r.id, status: r.status }); save();
  broadcast('staff:update', { coll: c, item: r }, true); if (c === 'requests') broadcast('request', publicRequest(r)); if (c === 'reports') broadcast('report', publicReport(r));
  res.json({ ok: true, item: r });
});
app.delete('/api/staff/:coll/:id', staff, (req, res) => {
  const c = COLL[req.params.coll]; if (!c) return res.status(404).end(); const i = db[c].findIndex((x) => x.id === req.params.id); if (i < 0) return res.status(404).json({ error: 'ไม่พบ' });
  const [r] = db[c].splice(i, 1); if (r.photo) fs.rm(path.join(UP_DIR, path.basename(r.photo)), () => {});
  db.audit.push({ at: new Date().toISOString(), by: req.staff.n, action: 'delete', coll: c, id: r.id }); save(); broadcast('deleted', { coll: c, id: r.id }); res.json({ ok: true });
});
app.put('/api/staff/contacts', staff, (req, res) => {
  const b = req.body || {}; const fix = (p) => { const s = clean(p, 30); return s || null; };
  if (Array.isArray(b.areas)) db.contacts.areas = b.areas.map((a, i) => ({ id: clean(a.id, 30) || 'area' + i, name: clean(a.name, 80), org: clean(a.org, 80), coordinator: clean(a.coordinator, 120), phone: fix(a.phone), verified: !!a.verified, source: clean(a.source, 200), served: !!a.served, lat: num(a.lat), lng: num(a.lng) }));
  for (const k of ['health', 'emergency']) if (Array.isArray(b[k])) db.contacts[k] = b[k].map((x) => ({ name: clean(x.name, 120), phone: fix(x.phone), note: clean(x.note, 200), verified: !!x.verified, source: clean(x.source, 200) }));
  db.audit.push({ at: new Date().toISOString(), by: req.staff.n, action: 'contacts' }); save(); broadcast('contacts', db.contacts); res.json({ ok: true, contacts: db.contacts });
});

// ---------- official detours / closed roads (staff) ----------
app.get('/api/roads', (req, res) => res.json(db.roads.filter((r) => r.status !== 'hidden')));
app.post('/api/staff/roads', staff, (req, res) => {
  const b = req.body || {}; const pts = (Array.isArray(b.points) ? b.points : []).map((p) => [num(p[0]), num(p[1])]).filter((p) => p[0] != null && p[1] != null && inPattaya(p[0], p[1]));
  if (pts.length < 2) return res.status(400).json({ error: 'วาดอย่างน้อย 2 จุด' });
  const r = { id: newId('W'), type: b.type === 'closed' ? 'closed' : 'detour', title: clean(b.title, 100) || (b.type === 'closed' ? 'ถนนปิด' : 'เส้นทางเลี่ยง'), note: clean(b.note, 300), points: pts.slice(0, 300), status: 'open', by: req.staff.n, createdAt: new Date().toISOString() };
  db.roads.push(r); db.audit.push({ at: r.createdAt, by: req.staff.n, action: 'road', id: r.id }); save(); broadcast('roads', db.roads.filter((x) => x.status !== 'hidden')); res.json({ ok: true, item: r });
});
// ---------- avoidance routing ----------
function floodZones() {
  const since = Date.now() - 24 * 3600e3, z = [];
  for (const r of db.reports) if (r.status !== 'hidden' && Date.parse(r.createdAt) > since && LEVEL_CM[r.level] >= 30) z.push({ lat: r.lat, lng: r.lng, rM: LEVEL_CM[r.level] >= 75 ? 250 : 150, label: 'รายงาน ' + (LEVELS[r.level] || ''), id: r.id });
  for (const w of db.roads) if (w.status !== 'hidden' && w.type === 'closed') for (let i = 0; i < w.points.length; i++) {
    z.push({ lat: w.points[i][0], lng: w.points[i][1], rM: 80, label: 'ถนนปิด: ' + w.title, id: w.id });
    if (i) { const a = w.points[i - 1], b = w.points[i]; const n = Math.ceil(km(a[0], a[1], b[0], b[1]) * 1000 / 100); for (let k = 1; k < n; k++) z.push({ lat: a[0] + (b[0] - a[0]) * k / n, lng: a[1] + (b[1] - a[1]) * k / n, rM: 80, label: 'ถนนปิด: ' + w.title, id: w.id }); }
  }
  return z;
}
function hits(coords, zones) { const hit = new Map(); for (const [lng, lat] of coords) for (const z of zones) if (km(lat, lng, z.lat, z.lng) * 1000 < z.rM) hit.set(z.id, z.label); return [...hit.values()]; }
function circle(z, n = 10) { const pts = []; for (let i = 0; i <= n; i++) { const t = 2 * Math.PI * i / n; pts.push([+(z.lng + Math.sin(t) * z.rM / 108500).toFixed(6), +(z.lat + Math.cos(t) * z.rM / 111000).toFixed(6)]); } return [pts]; }
app.get('/api/route', async (req, res) => {
  const a = [num(req.query.fromLat), num(req.query.fromLng)], b = [num(req.query.toLat), num(req.query.toLng)];
  if (a.concat(b).some((x) => x == null) || !inPattaya(...a) || !inPattaya(...b)) return res.status(400).json({ error: 'จุดเริ่มและปลายทางต้องอยู่ในพื้นที่พัทยา/บางละมุง' });
  const zones = floodZones(); let routes = [], engine;
  try {
    if (process.env.ORS_API_KEY) {
      engine = 'OpenRouteService (avoid_polygons)';
      const body = { coordinates: [[a[1], a[0]], [b[1], b[0]]], instructions: true, language: 'en', alternative_routes: { target_count: 2 } };
      if (zones.length) body.options = { avoid_polygons: { type: 'MultiPolygon', coordinates: zones.slice(0, 60).map((z) => circle(z)) } }, delete body.alternative_routes;
      const r = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', { method: 'POST', headers: { authorization: process.env.ORS_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('ORS HTTP ' + r.status); const j = await r.json();
      routes = j.features.map((f) => ({ coords: f.geometry.coordinates, distance: f.properties.summary.distance, duration: f.properties.summary.duration, steps: (f.properties.segments || []).flatMap((s) => s.steps.map((t) => ({ text: t.instruction, distance: t.distance }))) }));
    } else {
      engine = 'OSRM public demo (alternatives)';
      const j = await getJSON(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?alternatives=3&steps=true&geometries=geojson&overview=full`);
      if (j.code !== 'Ok') throw new Error('OSRM ' + j.code);
      const TH = { turn: 'เลี้ยว', 'new name': 'ตรงไปเข้าสู่', depart: 'ออกเดินทาง', arrive: 'ถึงปลายทาง', merge: 'รวมเข้า', 'on ramp': 'ขึ้นทางลาด', 'off ramp': 'ลงทางลาด', fork: 'ทางแยก', 'end of road': 'สุดถนน', continue: 'ตรงไป', roundabout: 'วงเวียน', rotary: 'วงเวียน', 'exit roundabout': 'ออกวงเวียน' };
      const MOD = { left: 'ซ้าย', right: 'ขวา', 'slight left': 'ซ้ายเล็กน้อย', 'slight right': 'ขวาเล็กน้อย', 'sharp left': 'ซ้ายหักศอก', 'sharp right': 'ขวาหักศอก', straight: 'ตรง', uturn: 'กลับรถ' };
      routes = j.routes.map((r) => ({ coords: r.geometry.coordinates, distance: r.distance, duration: r.duration, steps: r.legs.flatMap((l) => l.steps.map((s) => ({ text: `${TH[s.maneuver.type] || s.maneuver.type} ${MOD[s.maneuver.modifier] || ''} ${s.name ? '· ' + s.name : ''}`.replace(/\s+/g, ' ').trim(), distance: s.distance }))) }));
    }
  } catch (e) { return res.status(502).json({ error: 'บริการคำนวณเส้นทางไม่ตอบสนอง: ' + e.message, zones }); }
  routes.forEach((r) => { r.floodHits = hits(r.coords, zones); });
  const order = [...routes].sort((x, y) => x.floodHits.length - y.floodHits.length || x.duration - y.duration);
  const best = order[0]; const avoids = best && best.floodHits.length === 0;
  const via = best ? [0.33, 0.66].map((f) => best.coords[Math.floor(best.coords.length * f)]).map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|') : '';
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${a.join(',')}&destination=${b.join(',')}&travelmode=driving${via ? '&waypoints=' + encodeURIComponent(via) : ''}`;
  res.json({ ok: true, engine, avoids, warning: avoids ? null : (zones.length ? 'ไม่พบเส้นทางที่เลี่ยงจุดน้ำท่วมได้ทั้งหมด — เส้นทางนี้ผ่านจุดเสี่ยงน้อยที่สุด ใช้ความระมัดระวัง' : null), zonesCount: zones.length, zones, best, alternatives: order.slice(1), gmaps });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Pattaya flood center on http://localhost:${PORT}  (staff password ${process.env.STAFF_PASSWORD ? 'from env' : 'default: pattaya1337'})`));
