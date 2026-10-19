// ศูนย์ช่วยเหลือน้ำท่วม เมืองพัทยา — Express + storage adapter (file / Postgres) + SSE + back-office
const express = require('express');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const bcrypt = require('bcryptjs');
const PORT = process.env.PORT || 3600;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'pattaya1337';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('pfc:' + STAFF_PASSWORD).digest('hex');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CENTER = { lat: 12.9236, lng: 100.8825 };
const store = require('./store')(DATA_DIR);
const TEXTS = require('./texts').build();
const PLACE = require('./geo/place'); // soi / road / landmark (offline OSM index + polite Nominatim fallback)
const { AsyncLocalStorage } = require('async_hooks');
const LANGS = ['th', 'en', 'zh'];
const TR = { en: require('./i18n/en.json'), zh: require('./i18n/zh.json') };
const als = new AsyncLocalStorage();
const L = () => als.getStore()?.lang || 'th';
function pickLang(req) {
  const q = String(req.query?.lang || req.headers['x-lang'] || '').toLowerCase().slice(0, 2); if (LANGS.includes(q)) return q;
  const c = (req.headers.cookie || '').match(/pfc_lang=(th|en|zh)/); if (c) return c[1];
  return 'th';
}
const DEMO_SEED = process.env.DEMO_SEED === '1';
const TURNSTILE = process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET ? { site: process.env.TURNSTILE_SITE_KEY, secret: process.env.TURNSTILE_SECRET } : null;
const AS_DEFAULT = { on: true, honeypot: true, minFillSec: 3, dedupe: true, dedupeMin: 10, dedupeMeters: 150, maxPhotoMB: 3,
  limits: { reports: { n: 5, min: 10 }, requests: { n: 3, min: 10 }, missing: { n: 3, min: 10 }, lostfound: { n: 5, min: 10 }, safe: { n: 3, min: 10 } }, blocked: [] };
// Hybrid moderation for citizen-published content (water reports + lost&found). Help/evacuation/medical requests and missing persons
// are NEVER moderated: they always go straight to staff. Closed roads/detours are staff-created only (no citizen path) → always live.
// mod: pending (public but faded in hybrid) · verified · held (hidden, needs staff) · rejected
const MOD_DEFAULT = { mode: 'hybrid', autoVerifyN: 2, clearN: 2, distinctIp: true, holdLinks: true, holdPhones: true, voteLimit: { n: 20, min: 10 }, flagged: [],
  words: ['เหี้ย', 'ควย', 'สัส', 'เย็ด', 'อีดอก', 'อีเหี้ย', 'ไอ้สัตว์', 'ส้นตีน', 'แม่มึง', 'พ่อมึง', 'บาคาร่า', 'สล็อต', 'เว็บพนัน', 'คาสิโน', 'fuck', 'shit', 'bitch', 'asshole', 'casino', 'slot', 'baccarat', 'porn', 'viagra'] };
const MOD_COLLS = ['reports', 'lostfound', 'safe'];

// ---------- storage ----------
let db;
const DEFAULT_SETTINGS = { logo: '🌊', logoUrl: '/pattaya-seal.png', primary: '#0e7490', header: '#0b3c5d', bg: '#f7f3ea',
  banner: { on: false, text: '', level: 'warn' },
  sections: ['todo', 'start', 'summary', 'latest', 'mapteaser', 'rain', 'near', 'prepare', 'sources', 'staffentry'].map((id) => ({ id, on: true })) };
const SEED_CCTV = [{ title: 'กล้อง CCTV ทั่วไทย', url: 'https://cctv.maholan.net/', note: 'รวมกล้องสาธารณะทั่วประเทศ ค้นหา "พัทยา" / "ชลบุรี"' }, { title: 'ThaiWater', url: 'https://www.thaiwater.net/', note: 'ภาพสถานีโทรมาตร' }];
const SEED_LINKS = [{ title: 'คลังข้อมูลน้ำแห่งชาติ (ThaiWater)', url: 'https://www.thaiwater.net/', note: 'สถานีวัดน้ำและฝนทั่วประเทศ' }, { title: 'กรมชลประทาน', url: 'https://bigdata-swoc.rid.go.th/pier/all', note: 'ระดับน้ำทั้งประเทศ' }, { title: 'กรมทรัพยากรน้ำ', url: 'https://telemetry.dwr.go.th/home?layerMapType=BASIN', note: 'สถานีโทรมาตรรายลุ่มน้ำ' }, { title: 'กรมอุตุนิยมวิทยา', url: 'https://weather.tmd.go.th/', note: 'เรดาร์ฝนและพยากรณ์' }];
async function init() {
  db = await store.load();
  if (store.kind === 'postgres' && !db.contacts && fs.existsSync(path.join(DATA_DIR, 'db.json'))) { try { db = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8')); console.log('imported data/db.json into Postgres'); } catch {} }
  const seed = require('./seed-contacts');
  db.contacts ||= JSON.parse(JSON.stringify(seed));
  for (const k of ['reports', 'requests', 'missing', 'lostfound', 'audit', 'roads', 'users', 'shelters', 'safe']) db[k] ||= [];
  for (const w of db.roads) if (!w.approval) { w.approval = 'approved'; w.approvedBy ||= 'migration'; w.approvedAt ||= w.createdAt; } // road approval workflow: pre-existing roads stay live
  db.seq ||= 1000; db.texts ||= {}; db.i18n ||= {}; for (const l of ['en', 'zh']) db.i18n[l] ||= {};
  db.geofence = { ...GEO_DEFAULT, ...(db.geofence || {}) };
  db.moderation = { ...JSON.parse(JSON.stringify(MOD_DEFAULT)), ...(db.moderation || {}) };
  { let n = 0; for (const k of MOD_COLLS) for (const x of db[k]) if (!x.mod) { x.mod = 'verified'; x.modBy = 'migration'; n++; } if (n) console.log(`moderation: migrated ${n} existing records to verified`); }
  db.antispam = { ...JSON.parse(JSON.stringify(AS_DEFAULT)), ...(db.antispam || {}) }; db.antispam.limits = { ...AS_DEFAULT.limits, ...db.antispam.limits };
  // remove seeded demo / test data unless DEMO_SEED=1
  if (!DEMO_SEED) { const isDemo = (x) => /ทดสอบ|ข้อมูลตัวอย่าง/.test(JSON.stringify(x)); let n = 0;
    for (const k of ['reports', 'requests', 'missing', 'lostfound', 'roads', 'shelters', 'safe']) { const before = db[k].length; db[k] = db[k].filter((x) => !isDemo(x)); n += before - db[k].length; }
    if (n) console.log(`removed ${n} demo/test records (set DEMO_SEED=1 to keep/seed demo data)`); }
  else if (!db.reports.length) { const now = new Date().toISOString();
    db.reports.push({ id: newId('R'), areaId: 'central', areaName: 'พัทยากลาง', level: 'knee', lat: 12.9355, lng: 100.889, note: 'ข้อมูลตัวอย่าง', photo: null, status: 'new', confirms: 1, createdAt: now });
    db.shelters.push(...[['ข้อมูลตัวอย่าง: ศูนย์พักพิงโรงเรียน (sample)', 12.9312, 100.8905, 200, 145, ['อาหาร', 'น้ำดื่ม', 'ห้องน้ำ', 'ปฐมพยาบาล']], ['ข้อมูลตัวอย่าง: ศูนย์พักพิงวัด (sample)', 12.9468, 100.8952, 120, 120, ['อาหาร', 'ที่นอน']], ['ข้อมูลตัวอย่าง: ศูนย์พักพิงอาคารกีฬา (sample)', 12.9105, 100.8747, 300, 60, ['อาหาร', 'ไฟฟ้า/ชาร์จโทรศัพท์', 'รับสัตว์เลี้ยง']]].map(([name, lat, lng, capacity, occupancy, facilities]) => ({ id: newId('S'), name, lat, lng, capacity, occupancy, facilities, phone: '1337', contact: 'ศูนย์ประสานงาน', note: '', status: 'open', createdAt: now })));
    db.roads.push({ id: newId('W'), type: 'closed', title: 'ข้อมูลตัวอย่าง: ถนนปิด', note: '', points: [[12.94, 100.887], [12.93, 100.886]], status: 'open', by: 'demo', createdAt: now }); console.log('DEMO_SEED=1: seeded demo data'); }
  if (DEMO_SEED) { // routing demo hazards (kept fresh on every start so flood-avoidance stays visible)
    const now = new Date().toISOString(), TAG = 'ข้อมูลตัวอย่าง (เส้นทาง)';
    if (!db.reports.some((r) => r.note === TAG)) for (const [level, lat, lng] of [['waist', 12.9346, 100.8922], ['knee', 12.92836, 100.88245], ['ankle', 12.944, 100.8956]])
      db.reports.push({ id: newId('R'), areaId: 'central', areaName: 'พัทยากลาง', level, lat, lng, ...(PLACE.offline(lat, lng) || {}), note: TAG, photo: null, status: 'new', mod: 'verified', modBy: 'demo', confirms: 3, createdAt: now });
    for (const r of db.reports) if (r.note === TAG) { r.createdAt = now; r.cleared = false; } }
  db.settings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...(db.settings || {}) };
  { const ok = DEFAULT_SETTINGS.sections.map((s) => s.id); if (!(db.settings.sections || []).some((s) => s.id === 'todo')) db.settings.sections = []; /* design B layout: start from the B default order */ db.settings.sections = (db.settings.sections || []).filter((s) => ok.includes(s.id)); if (!db.settings.sections.length) db.settings.sections = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.sections)); } // v3 dashboard layout: drop section ids of the old home page
  const ids = db.settings.sections.map((s) => s.id); for (const s of DEFAULT_SETTINGS.sections) if (!ids.includes(s.id)) db.settings.sections.push({ ...s });
  { const st = db.settings; if (st.primary === '#0369a1' && st.header === '#0c4a6e' && st.bg === '#f0f9ff') Object.assign(st, { primary: DEFAULT_SETTINGS.primary, header: DEFAULT_SETTINGS.header, bg: DEFAULT_SETTINGS.bg }); if (!st.logoUrl && st.logo === '🌊') st.logoUrl = DEFAULT_SETTINGS.logoUrl; }
  db.cctvOverrides ||= {};
  db.cctv ||= SEED_CCTV.map((x) => ({ id: newId('V'), kind: 'link', ...x, status: 'open', createdAt: new Date().toISOString() }));
  db.links ||= SEED_LINKS.map((x) => ({ id: newId('K'), ...x, status: 'open', createdAt: new Date().toISOString() }));
  for (const k of ['health', 'emergency']) for (const x of db.contacts[k]) x.id ||= newId(k === 'health' ? 'H' : 'E');
  if (!db.users.length) { db.users.push({ id: newId('U'), username: ADMIN_USERNAME, name: 'ผู้ดูแลระบบ', role: 'superadmin', hash: bcrypt.hashSync(STAFF_PASSWORD, 10), active: true, pwv: 1, createdAt: new Date().toISOString() }); console.log(`bootstrapped superadmin "${ADMIN_USERNAME}" from STAFF_PASSWORD`); }
  if (db.audit.length > 5000) db.audit = db.audit.slice(-5000);
  db.geocache ||= {}; backfillPlaces(); for (const s of db.shelters) if (s.placeSrc === undefined) shelterPlace(s);
  save();
}
let saveT, saving = Promise.resolve();
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 200); }
function flush() { clearTimeout(saveT); saving = saving.then(() => store.save(db)).catch((e) => console.error('save failed', e.message)); return saving; }
const newId = (p) => p + '-' + (++db.seq);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { await flush(); process.exit(0); });

// ---------- texts ----------
const S = (k, d) => { const th = db.texts[k] != null && db.texts[k] !== '' ? db.texts[k] : d; const l = L(); if (l === 'th') return th; return db.i18n[l]?.[k] ?? TR[l][k] ?? th; };
// effective text map for a language (sent to the public client)
const textsFor = (l) => (l === 'th' ? db.texts : { ...TR[l], ...db.i18n[l] });
const LEVELS = () => ({ dry: S('level.dry', 'ต่ำกว่า 10 ซม. — น้ำแค่ผิวถนน'), ankle: S('level.ankle', '10–50 ซม. — ข้อเท้าถึงหน้าแข้ง'), knee: S('level.knee', '50–100 ซม. — เข่าถึงต้นขา'), waist: S('level.waist', '100–130 ซม. — ระดับเอว'), chest: S('level.chest', '130–180 ซม. — ระดับอกถึงคอ'), roof: S('level.roof', 'มากกว่า 180 ซม. — ท่วมมิดศีรษะ') });
const KINDS = () => ({ food: S('kind.food', 'อาหาร น้ำดื่ม และของใช้'), evacuate: S('kind.evacuate', 'ออกจากพื้นที่น้ำท่วม'), medical: S('kind.medical', 'ผู้ป่วยหรือยา'), other: S('kind.other', 'เรื่องอื่น') });
const STATUS_TEXT = () => ({ new: S('st.new', 'รับเรื่องแล้ว รอเจ้าหน้าที่'), triaged: S('st.triaged', 'คัดกรองแล้ว จัดลำดับความเร่งด่วน'), assigned: S('st.assigned', 'ส่งต่อทีมในพื้นที่แล้ว'), enroute: S('st.enroute', 'ทีมกำลังเดินทาง'), resolved: S('st.resolved', 'ช่วยเหลือเรียบร้อย'), closed: S('st.closed', 'ปิดเคส'), verified: S('st.verified', 'ยืนยันแล้ว'), hidden: S('st.hidden', 'ซ่อน'), searching: S('st.searching', 'กำลังตามหา'), found: S('st.found', 'พบตัวแล้ว'), open: S('st.open', 'ประกาศอยู่ / เปิด') });
const LEVEL_CM = { dry: 5, ankle: 30, knee: 75, waist: 115, chest: 155, roof: 200 };

// ---------- SSE ----------
const clients = new Set();
function broadcast(type, payload, staffOnly = false) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) if (!staffOnly || c.staff) c.res.write(msg);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 25000);

// ---------- auth ----------
const RANK = { staff: 1, admin: 2, superadmin: 3 };
const ROLE_NAME = { staff: 'เจ้าหน้าที่ / กู้ภัย', admin: 'ผู้ดูแล', superadmin: 'ผู้ดูแลสูงสุด' };
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function makeToken(u) { const v = Buffer.from(JSON.stringify({ u: u.id, v: u.pwv, e: Date.now() + 12 * 3600e3 })).toString('base64url'); return v + '.' + sign(v); }
function readUser(req) {
  const m = (req.headers.cookie || '').match(/pfc_staff=([^;]+)/); const t = m ? m[1] : (req.headers['x-staff-token'] || '');
  const [v, s] = String(t).split('.'); if (!v || !s) return null;
  const a = Buffer.from(sign(v)), b = Buffer.from(s); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(v, 'base64url').toString()); if (!(o.e > Date.now())) return null; const u = db.users.find((x) => x.id === o.u); return u && u.active && u.pwv === o.v ? u : null; } catch { return null; }
}
const auth = (min = 'staff') => (req, res, next) => {
  const u = readUser(req); if (!u) return res.status(401).json({ error: S('err.login', 'ต้องเข้าสู่ระบบเจ้าหน้าที่') });
  if (RANK[u.role] < RANK[min]) return res.status(403).json({ error: 'สิทธิ์ไม่พอสำหรับการทำรายการนี้' });
  req.user = u; req.staff = { n: u.name || u.username }; next();
};
const staff = auth('staff');
const lvl = (req) => RANK[req.user?.role] || 0;
// staff may not hide/reject content via status; that is moderation (admin+)
const statusOk = (req, s) => lvl(req) >= RANK.admin || !['hidden'].includes(s);
const NOPE = (res, msg) => res.status(403).json({ error: msg || 'สิทธิ์ไม่พอสำหรับการทำรายการนี้' });
const pubUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, roleName: ROLE_NAME[u.role], active: u.active, createdAt: u.createdAt, lastLogin: u.lastLogin });
function audit(req, action, coll, id, detail) { db.audit.push({ at: new Date().toISOString(), by: req.user ? (req.user.name || req.user.username) : 'ระบบ', user: req.user?.username, action, coll, id, detail: detail ? String(detail).slice(0, 300) : undefined }); if (db.audit.length > 6000) db.audit.splice(0, 1000); }

// ---------- helpers ----------
const clean = (s, n = 500) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const num = (x) => { const n = Number(x); return x !== '' && x != null && Number.isFinite(n) ? n : null; };
async function savePhoto(dataUrl) {
  if (!dataUrl) return null;
  const bad = () => Object.assign(new Error(S('err.photo', 'รูปภาพต้องเป็น JPG/PNG/WEBP และขนาดไม่เกินที่กำหนด')), { status: 400 });
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw bad(); const buf = Buffer.from(m[2], 'base64'); if (buf.length > (db.antispam.maxPhotoMB || 3) * 1048576) throw bad();
  const magic = { jpeg: (b) => b[0] === 0xff && b[1] === 0xd8, png: (b) => b.slice(0, 4).toString('hex') === '89504e47', webp: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' };
  if (!magic[m[1]](buf)) throw bad();
  const f = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  await store.putPhoto(f, 'image/' + m[1], buf); return '/uploads/' + f;
}
// ---------- jurisdiction: Pattaya City municipal boundary (OSM relation 12645794, mainland only, islands excluded) ----------
const BOUNDARY = JSON.parse(fs.readFileSync(path.join(__dirname, 'geo/pattaya-boundary.geojson'), 'utf8'));
const POLYS = BOUNDARY.geometry.type === 'MultiPolygon' ? BOUNDARY.geometry.coordinates : [BOUNDARY.geometry.coordinates];
const BBOX = (() => { let a = [90, 180, -90, -180]; for (const p of POLYS) for (const [x, y] of p[0]) a = [Math.min(a[0], y), Math.min(a[1], x), Math.max(a[2], y), Math.max(a[3], x)]; return a; })(); // [s,w,n,e]
const ringHas = (r, lat, lng) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segM = (lat, lng, [x1, y1], [x2, y2]) => { const kx = 108500, ky = 111000, px = (lng - x1) * kx, py = (lat - y1) * ky, dx = (x2 - x1) * kx, dy = (y2 - y1) * ky, L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / L2)) : 0; return Math.hypot(px - t * dx, py - t * dy); };
function insideCity(lat, lng, buf) {
  if (POLYS.some((p) => ringHas(p[0], lat, lng) && !p.slice(1).some((h) => ringHas(h, lat, lng)))) return true;
  if (!(buf > 0)) return false; for (const p of POLYS) { const r = p[0]; for (let i = 1; i < r.length; i++) if (segM(lat, lng, r[i - 1], r[i]) <= buf) return true; } return false;
}
const GEO_DEFAULT = { on: true, bufferM: 300 };
function inPattaya(lat, lng) { if (lat == null || lng == null) return false; const g = db.geofence || GEO_DEFAULT; if (!g.on) return lat > 12.6 && lat < 13.3 && lng > 100.6 && lng < 101.3; return insideCity(lat, lng, g.bufferM); }
const insideArea = (a) => a.lat == null || inPattaya(a.lat, a.lng);
function outsideErr(lat, lng) {
  const near = db.contacts.areas.filter((a) => a.lat != null && !insideArea(a) && a.phone).map((a) => ({ a, d: lat != null ? km(lat, lng, a.lat, a.lng) : 0 })).sort((x, y) => x.d - y.d).slice(0, 3);
  const hint = near.length ? ' ' + S('err.outside.near', 'หน่วยงานใกล้คุณ:') + ' ' + near.map(({ a }) => `${a.org || a.name} ${a.phone}`).join(' · ') : '';
  return Object.assign(new Error(S('err.outside', 'ตำแหน่งนี้อยู่นอกเขตเมืองพัทยา ระบบนี้รับเรื่องเฉพาะในเขตเมืองพัทยา — กรณีฉุกเฉินโทร 1669 / 1784') + hint), { status: 400, outside: true, nearby: near.map(({ a }) => ({ name: a.name, org: a.org, phone: a.phone })) });
}
const area = (id) => db.contacts.areas.find((a) => a.id === id);
const last4 = (p) => String(p || '').replace(/\D/g, '').slice(-4);
// ---------- soi / road / landmark on every located record ----------
const PLACE_KEYS = ['soi', 'soiEn', 'road', 'roadEn', 'landmark', 'landmarkEn', 'landmarkM', 'placeSrc', 'soiAuto'];
// userSoi: the citizen's (possibly corrected) soi text from the form; kept verbatim, the detected value is preserved in soiAuto
async function placeOf(lat, lng, userSoi) {
  const p = await PLACE.lookup(db, lat, lng); const u = clean(userSoi, 100); p.soiAuto = '';
  if (u && ![p.soi, p.road, p.soiEn, p.roadEn].filter(Boolean).includes(u)) { const k = PLACE.byName(u); p.soiAuto = p.soi || p.road || ''; Object.assign(p, { soi: k ? k.th : u, soiEn: k ? k.en : '', placeSrc: 'user' }); }
  return p;
}
function roadPlace(points) { const m = points[Math.floor(points.length / 2)] || points[0]; const p = (m && PLACE.offline(m[0], m[1])) || { ...PLACE.EMPTY }; return { ...p, soiAuto: '', along: PLACE.along(points).join(' → ') }; }
// backfill records created before soi lookup existed (offline index is instant; misses queue for Nominatim at 1 req/s)
function backfillPlaces() {
  let n = 0; const miss = [];
  for (const k of ['reports', 'requests']) for (const r of db[k]) if (r.placeSrc === undefined) { const p = r.lat != null ? PLACE.offline(r.lat, r.lng) : null; Object.assign(r, p || { ...PLACE.EMPTY }, { soiAuto: '' }); n++; if (!p && r.lat != null) miss.push(r); }
  for (const w of db.roads) if (w.placeSrc === undefined && w.points?.length) { Object.assign(w, roadPlace(w.points)); n++; }
  if (n) { console.log(`place: backfilled soi/road/landmark on ${n} records (${miss.length} queued for Nominatim)`); save(); }
  (async () => { for (const r of miss) { const p = await PLACE.nominatim(db, r.lat, r.lng); if (p) { Object.assign(r, p); save(); } } })();
}
const pubPlace = (r) => ({ soi: r.soi || '', soiEn: r.soiEn || '', road: r.road || '', roadEn: r.roadEn || '' });
const publicReport = (r) => ({ ...pubPlace(r), landmark: r.landmark || '', landmarkEn: r.landmarkEn || '', confirms: r.confirms || 1, mod: r.mod, cleared: !!r.cleared, yes: r.votes?.yes.length || 0, no: r.votes?.no.length || 0, id: r.id, areaId: r.areaId, areaName: r.areaName, level: r.level, levelText: LEVELS()[r.level], cm: LEVEL_CM[r.level], lat: r.lat, lng: r.lng, note: r.note, photo: r.photo, createdAt: r.createdAt, status: r.status });
const publicRequest = (r) => ({ ...pubPlace(r), confirms: r.confirms || 1, id: r.id, kind: r.kind, areaName: r.areaName, lat: r.lat ? +r.lat.toFixed(3) : null, lng: r.lng ? +r.lng.toFixed(3) : null, needs: r.needs, status: r.status, statusText: r.statusText, createdAt: r.createdAt });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

// Forecast: server-side only (browsers never call Open-Meteo). 30-min cache kept in memory + DB (survives restarts),
// one in-flight request, exponential backoff on 429/errors, MET Norway fallback, stale data served instead of an error.
const FC_TTL = 30 * 60e3; let fcInflight = null; const fcBackoff = { 'open-meteo': { n: 0, until: 0 }, 'met.no': { n: 0, until: 0 } };
const bkkHour = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 13) + ':00';
async function fcOpenMeteo() {
  const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${CENTER.lat}&longitude=${CENTER.lng}&hourly=precipitation,precipitation_probability,wind_speed_10m&forecast_hours=24&timezone=Asia%2FBangkok`, 15000); const h = j.hourly;
  return { source: 'Open-Meteo', hourly: h.time.map((t, k) => ({ t, mm: h.precipitation[k] || 0, prob: h.precipitation_probability[k], wind: h.wind_speed_10m[k] })) };
}
async function fcMetNo() {
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${CENTER.lat.toFixed(4)}&lon=${CENTER.lng.toFixed(4)}`, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'pattaya-flood-center/1.0 (https://pattaya-flood-center.onrender.com)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); const now = Date.now() - 3600e3;
  const ts = j.properties.timeseries.filter((x) => Date.parse(x.time) >= now && x.data.next_1_hours).slice(0, 24);
  return { source: 'MET Norway (api.met.no)', hourly: ts.map((x) => ({ t: bkkHour(x.time), mm: x.data.next_1_hours.details.precipitation_amount || 0, prob: x.data.next_1_hours.details.probability_of_precipitation ?? null, wind: +(x.data.instant.details.wind_speed * 3.6).toFixed(1) })) };
}
async function fcRefresh() {
  const errs = [];
  for (const [name, fn] of [['open-meteo', fcOpenMeteo], ['met.no', fcMetNo]]) {
    const b = fcBackoff[name]; if (Date.now() < b.until) { errs.push(`${name}: backoff`); continue; }
    try { const v = await fn(); if (!v.hourly.length) throw new Error('empty'); b.n = 0; b.until = 0; db.fcCache = { ...v, fetchedAt: new Date().toISOString() }; save(); return; }
    catch (e) { b.n++; b.until = Date.now() + Math.min(2 * 3600e3, 5 * 60e3 * 2 ** (b.n - 1)) * (/429/.test(e.message) ? 1 : 0.5); errs.push(`${name}: ${e.message}`); console.warn('forecast', name, e.message); }
  }
  throw new Error(errs.join('; '));
}
async function forecast() {
  const c = db.fcCache, fresh = c && Date.now() - Date.parse(c.fetchedAt) < FC_TTL; let err = null;
  if (!fresh) { fcInflight ||= fcRefresh().finally(() => { fcInflight = null; }); try { await fcInflight; } catch (e) { err = e.message; } }
  const v = db.fcCache; if (!v) return { ok: false, error: err || 'no data' };
  const h = v.hourly, total = h.reduce((s, x) => s + (x.mm || 0), 0), maxProb = h.some((x) => x.prob != null) ? Math.max(...h.map((x) => x.prob || 0)) : null, i = h.findIndex((x) => x.mm >= 0.1);
  let label = S('rain.none', 'ไม่มีฝน'), color = '#16a34a';
  if (total >= 0.5) { label = S('rain.light', 'ฝนเล็กน้อย'); color = '#0284c7'; } if (total >= 10) { label = S('rain.moderate', 'ฝนปานกลาง'); color = '#ca8a04'; } if (total >= 35) { label = S('rain.heavy', 'ฝนหนัก'); color = '#ea580c'; } if (total >= 90) { label = S('rain.veryheavy', 'ฝนหนักมาก'); color = '#dc2626'; }
  const stale = Date.now() - Date.parse(v.fetchedAt) > FC_TTL;
  return { ok: true, source: v.source, fetchedAt: v.fetchedAt, stale, totalMm: +total.toFixed(1), maxProb, startTime: i >= 0 ? h[i].t : null, label, color, hourly: h };
}
// Water levels — Pattaya City only. ThaiWater (api-v3) has no telemetered water-level station inside the city;
// we only list stations inside the boundary (+2 km). Otherwise we say so, name the nearest one, and show real
// in-city sources instead: ThaiWater 24-h rain gauges inside the city and citizen water reports. Nothing estimated.
const WL_BUF = 2000, RAIN_BUF = 0;
function waterLevels() {
  return cached('water' + ':' + L(), 10 * 60e3, async () => {
    const j = await getJSON('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load', 30000);
    const all = j.waterlevel_data.data.filter((s) => s.station && s.station.tele_station_lat && s.waterlevel_msl != null)
      .map((s) => ({ s, d: km(s.station.tele_station_lat, s.station.tele_station_long, CENTER.lat, CENTER.lng) })).sort((a, b) => a.d - b.d);
    const near = all[0] ? { name: all[0].s.station.tele_station_name.th, amphoe: all[0].s.geocode.amphoe_name.th, province: all[0].s.geocode.province_name.th, distanceKm: Math.round(all[0].d) } : null;
    const out = all.filter(({ s }) => insideCity(s.station.tele_station_lat, s.station.tele_station_long, WL_BUF)).map(({ s, d }) => {
      const wl = +s.waterlevel_msl, prev = s.waterlevel_msl_previous != null ? +s.waterlevel_msl_previous : null, bank = s.station.min_bank;
      const diff = bank != null ? +(wl - bank).toFixed(2) : null;
      let status = S('rain.st0', 'อยู่ในเกณฑ์ปกติ'), sev = 0;
      if (diff != null) { if (diff > 0) { status = S('rain.st3', 'ล้นตลิ่ง'); sev = 3; } else if (diff > -0.5) { status = S('rain.st2', 'เกือบถึงตลิ่ง'); sev = 2; } else if (s.situation_level >= 4 || diff > -1.2) { status = S('rain.st1', 'สูงกว่าปกติ'); sev = 1; } }
      const trend = prev == null ? S('rain.tr_unknown', 'ไม่ทราบ') : wl - prev > 0.02 ? S('rain.tr_up', 'กำลังขึ้น') : wl - prev < -0.02 ? S('rain.tr_down', 'กำลังลง') : S('rain.tr_flat', 'ทรงตัว');
      return { id: s.station.id, name: s.station.tele_station_name.th, code: s.station.tele_station_oldcode, province: s.geocode.province_name.th, amphoe: s.geocode.amphoe_name.th, tambon: s.geocode.tumbon_name.th,
        lat: s.station.tele_station_lat, lng: s.station.tele_station_long, distanceKm: Math.round(d), level: wl, bank, diff, status, sev, trend, measuredAt: s.waterlevel_datetime, agency: s.agency?.agency_shortname?.th?.trim() };
    }).sort((a, b) => b.sev - a.sev || a.distanceKm - b.distanceKm);
    return { ok: true, source: 'คลังข้อมูลน้ำแห่งชาติ (api-v3.thaiwater.net)', fetchedAt: new Date().toISOString(), stations: out, nearest: near,
      note: out.length ? '' : S('weather.nostation', 'ไม่มีสถานีวัดระดับน้ำโทรมาตรในเขตเมืองพัทยา (ข้อมูลคลังข้อมูลน้ำแห่งชาติ)') };
  });
}
function rainStations() {
  return cached('rain' + ':' + L(), 10 * 60e3, async () => {
    const j = await getJSON('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h', 30000);
    const L = (j.data || []).filter((s) => s.geocode?.province_code === '20' && s.station?.tele_station_lat && insideCity(+s.station.tele_station_lat, +s.station.tele_station_long, RAIN_BUF))
      .map((s) => ({ name: s.station.tele_station_name.th, amphoe: s.geocode.amphoe_name.th, tambon: s.geocode.tumbon_name.th, agency: s.agency?.agency_shortname?.th?.trim(), rain24h: +s.rain_24h, at: s.rainfall_datetime, lat: +s.station.tele_station_lat, lng: +s.station.tele_station_long, distanceKm: Math.round(km(s.station.tele_station_lat, s.station.tele_station_long, CENTER.lat, CENTER.lng) * 10) / 10 }))
      .sort((a, b) => b.rain24h - a.rain24h);
    return { ok: true, source: 'คลังข้อมูลน้ำแห่งชาติ (api-v3.thaiwater.net) ฝนสะสม 24 ชม. — เฉพาะสถานีในเขตเมืองพัทยา', fetchedAt: new Date().toISOString(), stations: L };
  });
}
// citizen water reports inside the city, last 24 h (public ones only)
function citizenLevels() {
  const since = Date.now() - 24 * 3600e3, rs = db.reports.filter((r) => isPublic(r) && !r.cleared && Date.parse(r.createdAt) > since && inPattaya(r.lat, r.lng));
  const by = {}; for (const r of rs) by[r.level] = (by[r.level] || 0) + 1;
  const top = rs.reduce((m, r) => (LEVEL_CM[r.level] > (LEVEL_CM[m?.level] || -1) ? r : m), null);
  return { count: rs.length, verified: rs.filter((r) => r.mod === 'verified').length, byLevel: Object.entries(by).sort((a, b) => LEVEL_CM[b[0]] - LEVEL_CM[a[0]]).map(([k, n]) => ({ level: k, text: LEVELS()[k], n })), max: top ? { level: top.level, text: LEVELS()[top.level], areaName: top.areaName, at: top.createdAt } : null, latest: rs.length ? rs[rs.length - 1].createdAt : null };
}

// ---------- app ----------
const app = express();
app.set('trust proxy', 1); // Render sits behind one proxy hop → req.ip = real client IP
app.get('/healthz', (req, res) => res.set('cache-control', 'no-store').type('text/plain').send('ok'));
app.use((req, res, next) => als.run({ lang: pickLang(req) }, next));
app.use(express.json({ limit: '4mb' }));
app.get('/uploads/:f', wrap(async (req, res) => { const p = await store.getPhoto(req.params.f); if (!p) return res.status(404).end(); res.set('content-type', p.mime).set('cache-control', 'public, max-age=604800').send(p.buf); }));
const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (c, d) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : d);
function renderIndex(req, res) {
  const st = db.settings, h = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  const out = h.replace('<html lang="th">', `<html lang="${{ th: 'th', en: 'en', zh: 'zh-CN' }[L()]}" data-lang="${L()}">`).replace(/\{\{T:([a-z0-9_.-]+)\|([^}]*)\}\}/g, (_, k, d) => escH(S(k, d)))
    .replace('{{THEME}}', `:root{--primary:${color(st.primary, '#0369a1')};--header:${color(st.header, '#0c4a6e')};--bg:${color(st.bg, '#f0f9ff')}}`)
    .replace('{{LOGO}}', st.logoUrl && /^(https?:\/\/|\/)/.test(st.logoUrl) ? `<img src="${escH(st.logoUrl)}" alt="${escH(S('site.logoalt', 'ตราเมืองพัทยา'))}" class="seal">` : escH(st.logo || '🌊'))
    .replace(/\{\{FAVICON\}\}/g, escH(st.logoUrl && /^\//.test(st.logoUrl) && st.logoUrl !== DEFAULT_SETTINGS.logoUrl ? st.logoUrl : '/icon-32.png'))
    .replace('{{HEADERCOLOR}}', color(st.header, '#0c4a6e'));
  res.set('content-type', 'text/html; charset=utf-8').set('cache-control', 'no-cache').set('vary', 'Cookie').send(out);
}
app.get(['/', '/index.html'], renderIndex);
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
const rl = new Map();
function limit(req, res, next) { const k = req.ip + req.path, now = Date.now(); const a = (rl.get(k) || []).filter((t) => now - t < 60e3); if (a.length >= 10) return res.status(429).json({ error: S('err.ratelimit', 'ส่งถี่เกินไป ลองใหม่ในอีกสักครู่') }); a.push(now); rl.set(k, a); next(); }

// ---------- anti-spam ----------
const asHits = new Map(); const asStats = { honeypot: 0, tooFast: 0, rate: 0, blocked: 0, captcha: 0, merged: 0 };
setInterval(() => { const now = Date.now(); for (const [k, a] of asHits) { const b = a.filter((t) => now - t < 3600e3); if (b.length) asHits.set(k, b); else asHits.delete(k); } }, 300e3).unref();
const ipBlocked = (ip) => (db.antispam.blocked || []).some((b) => { b = String(b).trim(); if (!b) return false; if (b.endsWith('*')) return ip.startsWith(b.slice(0, -1)); return ip === b || ip === '::ffff:' + b; });
async function turnstileOk(token, ip) {
  if (!token) return false;
  try { const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: TURNSTILE.secret, response: String(token), remoteip: ip }), signal: AbortSignal.timeout(8000) }); return (await r.json()).success === true; } catch { return false; }
}
const guard = (kind) => wrap(async (req, res, next) => {
  const A = db.antispam, ip = req.ip || '', b = req.body || {};
  if (ipBlocked(ip)) { asStats.blocked++; return res.status(403).json({ error: S('err.blocked', 'ไม่สามารถส่งข้อมูลจากเครือข่ายนี้ได้ กรุณาโทร 1669 / 1784 / 1337') }); }
  if (A.on) {
    if (A.honeypot && String(b.website || '').trim()) { asStats.honeypot++; return res.json({ ok: true, id: kind[0].toUpperCase() + '-' + (1000 + Math.floor(Math.random() * 9000)) }); }
    const ft = Number(b._ft); if (A.minFillSec > 0 && !(ft >= A.minFillSec * 1000)) { asStats.tooFast++; return res.status(400).json({ error: S('err.toofast', 'ส่งเร็วเกินไป กรุณาตรวจข้อมูลแล้วกดส่งอีกครั้ง') }); }
    const lim = A.limits[kind]; const dev = String(req.headers['x-device-id'] || b._dev || '').slice(0, 64);
    if (lim && lim.n > 0) { const now = Date.now(), win = lim.min * 60e3, keys = ['ip:' + kind + ':' + ip, ...(dev ? ['dev:' + kind + ':' + dev] : [])];
      const arrs = keys.map((k) => (asHits.get(k) || []).filter((t) => now - t < win));
      if (arrs.some((a) => a.length >= lim.n)) { asStats.rate++; const oldest = Math.min(...arrs.filter((a) => a.length >= lim.n).map((a) => a[0])); res.set('retry-after', String(Math.ceil((oldest + win - now) / 1000))); return res.status(429).json({ error: S('err.ratelimit', 'ส่งถี่เกินไป ลองใหม่ในอีกสักครู่') }); }
      keys.forEach((k, i) => { arrs[i].push(now); asHits.set(k, arrs[i]); }); }
  }
  if (TURNSTILE && !(await turnstileOk(b.cfToken, ip))) { asStats.captcha++; return res.status(400).json({ error: S('err.captcha', 'กรุณายืนยันว่าไม่ใช่บอท (captcha) แล้วลองอีกครั้ง') }); }
  next();
});
const recent = (arr, ms) => { const since = Date.now() - ms; const out = []; for (let i = arr.length - 1; i >= 0; i--) { if (Date.parse(arr[i].createdAt) < since) break; out.push(arr[i]); } return out; };
const dist = (a, b, c, d) => km(a, b, c, d) * 1000;
function findDup(coll, pred) { const A = db.antispam; if (!A.on || !A.dedupe) return null; return recent(db[coll], A.dedupeMin * 60e3).find(pred) || null; }
function confirmDup(x) { x.confirms = (x.confirms || 1) + 1; x.lastConfirmedAt = new Date().toISOString(); asStats.merged++; save(); return x; }

const visible = (arr) => arr.filter((x) => x.status !== 'hidden');
// Roads: staff submissions are 'pending' until an admin/superadmin approves; only approved roads are public or used for routing.
const liveRoads = () => visible(db.roads).filter((w) => w.approval === 'approved');
const pendingRoads = () => db.roads.filter((w) => w.approval === 'pending').length;

// ---------- moderation ----------
const M = () => db.moderation;
const devOf = (req) => String(req.headers['x-device-id'] || req.body?._dev || '').replace(/[^\w.:-]/g, '').slice(0, 64);
const reEsc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isFlagged = (ip, dev) => (M().flagged || []).some((f) => { f = String(f).trim(); if (!f) return false; if (dev && f === dev) return true; if (f.endsWith('*')) return ip.startsWith(f.slice(0, -1)) || ip.startsWith('::ffff:' + f.slice(0, -1)); return ip === f || ip === '::ffff:' + f; });
function modReasons(text, ip, dev) {
  const m = M(), raw = String(text || ''), t = raw.toLowerCase(), out = [];
  const w = (m.words || []).map((x) => String(x).toLowerCase().trim()).filter(Boolean).find((w) => (/^[a-z0-9 ]+$/.test(w) ? new RegExp('\\b' + reEsc(w) + '\\b').test(t) : t.includes(w)));
  if (w) out.push('word:' + w);
  if (m.holdLinks && /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|io|me|ly|co|top|info|bet|vip|club|shop|th)\b|line\.me|t\.me|lin\.ee|bit\.ly|@[a-z0-9_.]{3,})/i.test(raw)) out.push('link');
  if (m.holdPhones && /(\+?66|0)[\s.-]?\d(?:[\s.-]?\d){7,9}/.test(raw)) out.push('phone');
  if (isFlagged(ip, dev)) out.push('flagged');
  return out;
}
function initialMod(text, req) { if (M().mode === 'off') return { mod: 'verified', modBy: 'mode-off' }; const reasons = modReasons(text, req.ip || '', devOf(req)); return reasons.length ? { mod: 'held', modReasons: reasons } : { mod: 'pending' }; }
const isPublic = (x) => x.status !== 'hidden' && (x.mod === 'verified' || (x.mod === 'pending' && M().mode !== 'approve'));
// routing: verified + pending count as flood zones (a false detour is cheap, driving into water is not); held/rejected/"possibly cleared" are ignored
const inRoute = (x) => x.status !== 'hidden' && (x.mod === 'verified' || x.mod === 'pending') && !x.cleared;
const modCounts = () => { const o = { pending: 0, held: 0 }; for (const k of MOD_COLLS) for (const x of db[k]) if (o[x.mod] != null) o[x.mod]++; o.total = o.pending + o.held; return o; };
const sysAudit = (action, coll, id, detail) => audit({}, action, coll, id, detail);
function evaluate(r) {
  const m = M(), v = (r.votes ||= { yes: [], no: [] });
  if (r.mod === 'pending' && m.mode === 'hybrid' && v.yes.length >= m.autoVerifyN) { r.mod = 'verified'; r.modBy = 'auto'; r.modAt = new Date().toISOString(); sysAudit('mod-auto', 'reports', r.id, `ยืนยันอัตโนมัติ: ${v.yes.length} อุปกรณ์ยืนยัน`); }
  const lastYes = v.yes.reduce((a, x) => (x.at > a ? x.at : a), '');
  const wasCleared = !!r.cleared; r.cleared = v.no.filter((x) => x.at > lastYes).length >= m.clearN;
  if (r.cleared && !wasCleared) sysAudit('mod-cleared', 'reports', r.id, `ประชาชนแจ้งไม่พบน้ำท่วมแล้ว ${v.no.length} ครั้ง`);
}
function addVote(r, req, kind) {
  const ip = req.ip || '', dev = devOf(req) || 'ip:' + ip, now = new Date().toISOString(), v = (r.votes ||= { yes: [], no: [] }), all = [...v.yes, ...v.no];
  if (r.src?.dev === dev || all.some((x) => x.d === dev)) return false;
  if (M().distinctIp && (r.src?.ip === ip || all.some((x) => x.ip === ip))) return false;
  v[kind].push({ d: dev, ip, at: now });
  if (kind === 'yes') { r.confirms = (r.confirms || 1) + 1; r.lastConfirmedAt = now; }
  evaluate(r); return true;
}
function afterMod(coll, r) {
  if (coll === 'reports') broadcast('report', isPublic(r) ? publicReport(r) : { id: r.id, gone: true }); else broadcast('lostfound', { id: r.id });
  broadcast('staff:update', { coll, item: r }, true); broadcast('staff:mod', modCounts(), true);
}
app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.kind, time: new Date().toISOString() }));
app.get('/api/config', (req, res) => res.json({ city: 'เมืองพัทยา', province: 'ชลบุรี', center: CENTER, levels: LEVELS(), kinds: KINDS(), statusNames: STATUS_TEXT(), contacts: { ...db.contacts, areas: db.contacts.areas.filter(insideArea) }, geo: { on: db.geofence.on, bufferM: db.geofence.bufferM, bbox: BBOX, boundary: BOUNDARY.geometry }, moderation: { mode: M().mode }, texts: textsFor(L()), lang: L(), langs: LANGS, turnstileSiteKey: TURNSTILE?.site || null, antispam: { minFillSec: db.antispam.on ? db.antispam.minFillSec : 0 }, settings: db.settings, cctv: visible(db.cctv), links: visible(db.links) }));
const HOTSPOTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'geo/flood-hotspots.json'), 'utf8'));
app.get('/api/hotspots', (req, res) => res.json({ note: HOTSPOTS.note, spots: HOTSPOTS.spots.map(({ sources, ...x }) => ({ ...x, label: L() === 'th' ? x.name : x.name_en })) }));
app.get('/api/forecast', wrap(async (req, res) => res.json(await forecast())));
app.get('/api/water', wrap(async (req, res) => { const w = await waterLevels(); const r = await rainStations(); res.json({ ...w, rainInside: r.ok ? r.stations : [], citizen: citizenLevels() }); }));
app.get('/api/rain', wrap(async (req, res) => res.json(await rainStations())));
app.get('/api/events', (req, res) => {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write('retry: 5000\n\n'); const c = { res, staff: !!readUser(req) }; clients.add(c); req.on('close', () => clients.delete(c));
});

// soi lookup for the forms (offline index only, plus already-cached Nominatim answers: never triggers new Nominatim calls)
app.get('/api/geo/reverse', (req, res) => { const lat = num(req.query.lat), lng = num(req.query.lng); if (lat == null || lng == null) return res.status(400).json({ error: 'lat,lng' });
  const p = PLACE.offline(lat, lng) || db.geocache?.[lat.toFixed(4) + ',' + lng.toFixed(4)] || { ...PLACE.EMPTY }; res.set('cache-control', 'public, max-age=86400').json({ ...p, inside: inPattaya(lat, lng) }); });
app.get('/api/geo/sois', (req, res) => res.set('cache-control', 'public, max-age=3600').json(PLACE.sois(String(req.query.q || '').slice(0, 60), Math.min(50, num(req.query.n) || 30))));
app.get('/api/geo/meta', (req, res) => res.json(PLACE.meta));

// water reports (public)
app.get('/api/reports', (req, res) => { const since = Date.now() - (num(req.query.hours) || 48) * 3600e3; res.json(db.reports.filter((r) => isPublic(r) && Date.parse(r.createdAt) > since).map(publicReport).reverse()); });
app.post('/api/reports', guard('reports'), wrap(async (req, res) => {
  const b = req.body || {}; const lat = num(b.lat), lng = num(b.lng);
  if (!LEVEL_CM[b.level]) return res.status(400).json({ error: S('err.level', 'เลือกระดับน้ำ') });
  if (lat == null || !inPattaya(lat, lng)) { const e = outsideErr(lat, lng); return res.status(400).json({ error: e.message, outside: true, nearby: e.nearby }); }
  const dup = findDup('reports', (x) => isPublic(x) && x.level === b.level && dist(x.lat, x.lng, lat, lng) <= db.antispam.dedupeMeters);
  if (dup) { if (addVote(dup, req, 'yes')) asStats.merged++; save(); afterMod('reports', dup); return res.json({ ok: true, id: dup.id, merged: true, confirms: dup.confirms, mod: dup.mod }); }
  const a = area(b.areaId), note = clean(b.note, 300), areaName = a?.name || clean(b.areaName, 80);
  const r = { id: newId('R'), areaId: a?.id || null, areaName, level: b.level, lat, lng, note, photo: await savePhoto(b.photo), ...(await placeOf(lat, lng, b.soi)), status: 'new', ...initialMod(note + ' ' + areaName, req), src: { ip: req.ip || '', dev: devOf(req) }, votes: { yes: [], no: [] }, createdAt: new Date().toISOString() };
  db.reports.push(r); if (r.mod === 'held') sysAudit('mod-held', 'reports', r.id, (r.modReasons || []).join(', '));
  save(); broadcast('report', isPublic(r) ? publicReport(r) : { id: r.id, gone: true }); broadcast('staff:report', r, true); broadcast('staff:mod', modCounts(), true); res.json({ ok: true, id: r.id, mod: r.mod, public: isPublic(r) });
}));
app.post('/api/reports/:id/vote', wrap(async (req, res) => {
  const ip = req.ip || '', dev = devOf(req), lim = M().voteLimit || MOD_DEFAULT.voteLimit;
  if (ipBlocked(ip)) { asStats.blocked++; return res.status(403).json({ error: S('err.blocked', 'ไม่สามารถส่งข้อมูลจากเครือข่ายนี้ได้ กรุณาโทร 1669 / 1784 / 1337') }); }
  if (lim.n > 0) { const now = Date.now(), win = lim.min * 60e3, keys = ['vote:ip:' + ip, ...(dev ? ['vote:dev:' + dev] : [])]; const arrs = keys.map((k) => (asHits.get(k) || []).filter((t) => now - t < win));
    if (arrs.some((a) => a.length >= lim.n)) { asStats.rate++; return res.status(429).json({ error: S('err.ratelimit', 'ส่งถี่เกินไป ลองใหม่ในอีกสักครู่') }); } keys.forEach((k, i) => { arrs[i].push(now); asHits.set(k, arrs[i]); }); }
  const r = db.reports.find((x) => x.id === req.params.id); if (!r || !isPublic(r)) return res.status(404).json({ error: S('err.notfound', 'ไม่พบรายงานนี้') });
  if (!addVote(r, req, req.body?.v === 'no' ? 'no' : 'yes')) return res.status(409).json({ error: S('err.voted', 'อุปกรณ์/เครือข่ายนี้ยืนยันรายงานนี้ไปแล้ว') });
  save(); afterMod('reports', r); res.json({ ok: true, item: publicReport(r) });
}));

// help requests (food/supplies, rescue, medical)
app.post('/api/requests', guard('requests'), wrap(async (req, res) => {
  const b = req.body || {}; const a = area(b.areaId);
  if (!a) return res.status(400).json({ error: S('err.area', 'เลือกพื้นที่') });
  { const la0 = num(b.lat), ln0 = num(b.lng); if (!insideArea(a) || (la0 != null && ln0 != null && !inPattaya(la0, ln0))) { const e = outsideErr(la0 ?? a.lat, ln0 ?? a.lng); return res.status(400).json({ error: e.message, outside: true, nearby: e.nearby }); } }
  if (!a.served) return res.status(400).json({ error: S('err.notserved', 'ยังไม่เปิดรับคำขอทางเว็บสำหรับพื้นที่นี้ กรุณาโทร 1669 / 1784 / 1337') + ` (${a.name})` });
  const phone = clean(b.phone, 20); if (last4(phone).length < 4) return res.status(400).json({ error: S('err.phone', 'กรอกเบอร์โทรที่ติดต่อได้') });
  const name = clean(b.name, 80); if (!name) return res.status(400).json({ error: S('err.name', 'กรอกชื่อ') });
  const kd = KINDS()[b.kind] ? b.kind : 'food', la = num(b.lat), ln = num(b.lng);
  const dup = findDup('requests', (x) => x.status !== 'deleted' && x.kind === kd && x.areaId === a.id && (last4(x.phone) === last4(phone) || (la != null && x.lat != null && dist(x.lat, x.lng, la, ln) <= db.antispam.dedupeMeters)));
  if (dup) { confirmDup(dup); broadcast('staff:update', dup, true); return res.json({ ok: true, id: dup.id, merged: true, confirms: dup.confirms }); }
  const r = { id: newId('C'), kind: KINDS()[b.kind] ? b.kind : 'food', areaId: a.id, areaName: a.name, name, phone, people: num(b.people) || 1,
    needs: (Array.isArray(b.needs) ? b.needs : []).map((x) => clean(x, 40)).slice(0, 10), level: LEVEL_CM[b.level] ? b.level : null,
    lat: num(b.lat), lng: num(b.lng), address: clean(b.address, 300), note: clean(b.note, 500), photo: await savePhoto(b.photo), ...(await placeOf(num(b.lat), num(b.lng), b.soi)),
    status: 'new', statusText: STATUS_TEXT().new, assignee: '', history: [{ at: new Date().toISOString(), s: 'new', by: S('st.bycitizen', 'ประชาชน') }], createdAt: new Date().toISOString() };
  db.requests.push(r); save(); broadcast('request', publicRequest(r)); broadcast('staff:request', r, true); res.json({ ok: true, id: r.id });
}));
app.get('/api/requests/public', (req, res) => res.json(db.requests.filter((r) => r.status !== 'deleted').map(publicRequest).reverse()));
app.get('/api/status', (req, res) => {
  const r = db.requests.find((x) => x.id.toUpperCase() === String(req.query.id || '').trim().toUpperCase());
  if (!r || last4(r.phone) !== last4(req.query.phone) || !last4(req.query.phone)) return res.status(404).json({ error: S('err.nocase', 'ไม่พบเคส ตรวจเลขเคสและเบอร์ 4 ตัวท้าย') });
  const ST = STATUS_TEXT();
  res.json({ id: r.id, kind: KINDS()[r.kind], areaName: r.areaName, status: r.status, statusText: ST[r.status] || r.statusText, assignee: r.assignee, history: r.history.map((h) => ({ at: h.at, s: ST[h.s] || h.s, code: h.s, note: h.note })), createdAt: r.createdAt });
});

// missing persons (private) & lost-found (public)
app.post('/api/missing', guard('missing'), wrap(async (req, res) => {
  const b = req.body || {}; if (!clean(b.personName) || last4(b.reporterPhone).length < 4) return res.status(400).json({ error: S('err.missing', 'กรอกชื่อผู้สูญหายและเบอร์ผู้แจ้ง') });
  const dup = findDup('missing', (x) => x.personName.toLowerCase() === clean(b.personName, 80).toLowerCase() && last4(x.reporterPhone) === last4(b.reporterPhone));
  if (dup) { confirmDup(dup); return res.json({ ok: true, id: dup.id, merged: true, confirms: dup.confirms }); }
  const r = { id: newId('M'), personName: clean(b.personName, 80), age: clean(b.age, 10), lastSeen: clean(b.lastSeen, 300), description: clean(b.description, 500), reporterName: clean(b.reporterName, 80), reporterPhone: clean(b.reporterPhone, 20), photo: await savePhoto(b.photo), status: 'searching', createdAt: new Date().toISOString() };
  db.missing.push(r); save(); broadcast('staff:missing', r, true); res.json({ ok: true, id: r.id });
}));
app.get('/api/lostfound', (req, res) => res.json(db.lostfound.filter(isPublic).map(({ phone, src, modReasons, votes, modBy, ...x }) => ({ ...x, phoneMasked: 'xxx-xxx-' + last4(phone) })).reverse()));
app.post('/api/lostfound', guard('lostfound'), wrap(async (req, res) => {
  const b = req.body || {}; if (!clean(b.title) || last4(b.phone).length < 4) return res.status(400).json({ error: S('err.lf', 'กรอกหัวข้อและเบอร์ติดต่อ') });
  const ty = b.type === 'found' ? 'found' : 'lost', dup = findDup('lostfound', (x) => x.type === ty && x.title.toLowerCase() === clean(b.title, 100).toLowerCase() && last4(x.phone) === last4(b.phone) && !['held', 'rejected'].includes(x.mod));
  if (dup) { confirmDup(dup); return res.json({ ok: true, id: dup.id, merged: true, confirms: dup.confirms }); }
  const r = { id: newId('L'), type: b.type === 'found' ? 'found' : 'lost', category: clean(b.category, 30), title: clean(b.title, 100), detail: clean(b.detail, 500), place: clean(b.place, 120), phone: clean(b.phone, 20), photo: await savePhoto(b.photo), status: 'open', src: { ip: req.ip || '', dev: devOf(req) }, createdAt: new Date().toISOString() };
  Object.assign(r, initialMod([r.title, r.detail, r.place, r.category].join(' '), req));
  db.lostfound.push(r); if (r.mod === 'held') sysAudit('mod-held', 'lostfound', r.id, (r.modReasons || []).join(', '));
  save(); broadcast('lostfound', { id: r.id }); broadcast('staff:lostfound', r, true); broadcast('staff:mod', modCounts(), true); res.json({ ok: true, id: r.id, mod: r.mod, public: isPublic(r) });
}));

// ---------- login / users ----------
app.post('/api/staff/login', limit, (req, res) => {
  const username = (clean(req.body?.username, 60) || ADMIN_USERNAME).toLowerCase(), pw = String(req.body?.password || '');
  const u = db.users.find((x) => x.username === username);
  const ok = u && u.active && bcrypt.compareSync(pw, u.hash);
  if (!ok) { if (u && !u.active) return res.status(403).json({ error: 'บัญชีนี้ถูกปิดใช้งาน' }); return res.status(401).json({ error: S('err.badpw', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') }); }
  u.lastLogin = new Date().toISOString(); req.user = u; audit(req, 'login'); save();
  const t = makeToken(u); const secure = req.secure ? '; Secure' : '';
  res.setHeader('set-cookie', `pfc_staff=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`); res.json({ ok: true, name: u.name || u.username, user: pubUser(u), token: t });
});
app.post('/api/staff/logout', (req, res) => { res.setHeader('set-cookie', 'pfc_staff=; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/staff/me', staff, (req, res) => res.json({ name: req.user.name || req.user.username, user: pubUser(req.user) }));
app.post('/api/admin/me/password', staff, (req, res) => {
  const { current, next } = req.body || {}; if (!bcrypt.compareSync(String(current || ''), req.user.hash)) return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  if (String(next || '').length < 8) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร' });
  req.user.hash = bcrypt.hashSync(String(next), 10); req.user.pwv = (req.user.pwv || 1) + 1; audit(req, 'password', 'users', req.user.id, 'เปลี่ยนรหัสผ่านตัวเอง'); save();
  res.setHeader('set-cookie', `pfc_staff=${makeToken(req.user)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${req.secure ? '; Secure' : ''}`); res.json({ ok: true });
});
const superadmin = auth('superadmin'), admin = auth('admin');
app.get('/api/admin/users', superadmin, (req, res) => res.json(db.users.map(pubUser)));
app.post('/api/admin/users', superadmin, (req, res) => {
  const b = req.body || {}; const username = clean(b.username, 40).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: 'ชื่อผู้ใช้ใช้ a-z 0-9 . _ - อย่างน้อย 3 ตัว' });
  if (db.users.some((u) => u.username === username)) return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
  if (!RANK[b.role]) return res.status(400).json({ error: 'เลือกบทบาท' }); if (String(b.password || '').length < 8) return res.status(400).json({ error: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' });
  const u = { id: newId('U'), username, name: clean(b.name, 80) || username, role: b.role, hash: bcrypt.hashSync(String(b.password), 10), active: true, pwv: 1, createdAt: new Date().toISOString() };
  db.users.push(u); audit(req, 'create', 'users', u.id, `${username} (${u.role})`); save(); res.json({ ok: true, user: pubUser(u) });
});
app.put('/api/admin/users/:id', superadmin, (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id); if (!u) return res.status(404).json({ error: 'ไม่พบผู้ใช้' }); const b = req.body || {};
  const supers = db.users.filter((x) => x.role === 'superadmin' && x.active && x.id !== u.id).length;
  if ((b.role && b.role !== 'superadmin' || b.active === false) && u.role === 'superadmin' && !supers) return res.status(400).json({ error: 'ต้องมีผู้ดูแลสูงสุดที่ใช้งานอยู่อย่างน้อย 1 คน' });
  const ch = [];
  if (b.name != null) { u.name = clean(b.name, 80); ch.push('ชื่อ'); }
  if (b.role && RANK[b.role] && b.role !== u.role) { u.role = b.role; ch.push('บทบาท=' + b.role); }
  if (typeof b.active === 'boolean' && b.active !== u.active) { u.active = b.active; u.pwv = (u.pwv || 1) + 1; ch.push(b.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'); }
  if (b.password) { if (String(b.password).length < 8) return res.status(400).json({ error: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' }); u.hash = bcrypt.hashSync(String(b.password), 10); u.pwv = (u.pwv || 1) + 1; ch.push('ตั้งรหัสผ่านใหม่'); }
  audit(req, 'update', 'users', u.id, `${u.username}: ${ch.join(', ')}`); save(); res.json({ ok: true, user: pubUser(u) });
});
// ---------- staff (triage) ----------
app.get('/api/staff/data', staff, (req, res) => res.json({ requests: [...db.requests].reverse(), reports: [...db.reports].reverse(), missing: [...db.missing].reverse(), lostfound: [...db.lostfound].reverse() }));
function afterChange(c, item) {
  if (item) broadcast('staff:update', { coll: c, item }, true);
  if (c === 'requests' && item) broadcast('request', publicRequest(item)); if (c === 'reports' && item) broadcast('report', publicReport(item));
  if (c === 'roads') { broadcast('roads', liveRoads()); broadcast('staff:roadq', { total: pendingRoads() }, true); } if (['areas', 'health', 'emergency'].includes(c)) broadcast('contacts', db.contacts);
  if (c === 'shelters') { if (item) { shelterPlace(item); item.updatedAt = new Date().toISOString(); } broadcast('shelters', pubShelters()); }
  if (['cctv', 'links'].includes(c)) broadcast('cms', { coll: c }); if (c === 'lostfound') broadcast('lostfound', {});
}
function setStatus(req, c, r, status, note) {
  const ST = STATUS_TEXT(); if (!COLLS[c].statuses.includes(status)) return false;
  r.status = status; if (c === 'requests') r.statusText = ST[status];
  if (MOD_COLLS.includes(c) && status === 'verified' && r.mod !== 'verified') { r.mod = 'verified'; r.modBy = req.staff?.n; r.modAt = new Date().toISOString(); }
  if (r.history) r.history.push({ at: new Date().toISOString(), s: status, by: req.staff.n, note: clean(note, 200) }); return true;
}
app.patch('/api/staff/:coll/:id', staff, (req, res) => {
  const c = req.params.coll, C = COLLS[c]; if (!C || !C.triage) return res.status(404).end(); const r = C.arr().find((x) => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'ไม่พบ' });
  const b = req.body || {};
  if (lvl(req) < RANK.superadmin && (b.priority != null || b.assignee != null)) return NOPE(res, 'แก้ได้เฉพาะสถานะงาน');
  if (b.status && !statusOk(req, b.status)) return NOPE(res, 'ซ่อนรายการได้เฉพาะผู้ดูแล');
  if (b.status) setStatus(req, c, r, b.status, b.note); else if (r.history && b.note) r.history.push({ at: new Date().toISOString(), s: r.status, by: req.staff.n, note: clean(b.note, 200) });
  if (b.priority) r.priority = clean(b.priority, 10); if (b.assignee != null) r.assignee = clean(b.assignee, 80);
  audit(req, 'update', c, r.id, `สถานะ=${r.status}${b.assignee != null ? ' ทีม=' + r.assignee : ''}`); save(); afterChange(c, r);
  res.json({ ok: true, item: r });
});
async function removeItem(req, c, id) {
  const a = COLLS[c].arr(); const i = a.findIndex((x) => x.id === id); if (i < 0) return false;
  const [r] = a.splice(i, 1); if (r.photo) await store.delPhoto(r.photo).catch(() => {});
  audit(req, 'delete', c, r.id, r.title || r.name || r.personName || r.areaName || ''); broadcast('deleted', { coll: c, id: r.id }); return true;
}
app.delete('/api/staff/:coll/:id', superadmin, wrap(async (req, res) => {
  if (!COLLS[req.params.coll]) return res.status(404).end(); if (!(await removeItem(req, req.params.coll, req.params.id))) return res.status(404).json({ error: 'ไม่พบ' });
  save(); afterChange(req.params.coll); res.json({ ok: true });
}));
app.put('/api/staff/contacts', superadmin, (req, res) => {
  const b = req.body || {}; const fix = (p) => { const s = clean(p, 30); return s || null; };
  if (Array.isArray(b.areas)) db.contacts.areas = b.areas.map((a, i) => ({ id: clean(a.id, 30) || 'area' + i, name: clean(a.name, 80), org: clean(a.org, 80), coordinator: clean(a.coordinator, 120), phone: fix(a.phone), verified: !!a.verified, source: clean(a.source, 200), served: !!a.served, lat: num(a.lat), lng: num(a.lng) }));
  for (const k of ['health', 'emergency']) if (Array.isArray(b[k])) db.contacts[k] = b[k].map((x) => ({ id: clean(x.id, 30) || newId(k === 'health' ? 'H' : 'E'), name: clean(x.name, 120), phone: fix(x.phone), note: clean(x.note, 200), verified: !!x.verified, source: clean(x.source, 200) }));
  audit(req, 'contacts', 'contacts'); save(); broadcast('contacts', db.contacts); res.json({ ok: true, contacts: db.contacts });
});
app.get('/api/roads', (req, res) => res.json(liveRoads()));
// staff view: all approved + own pending/rejected; admins see everything
app.get('/api/staff/roads', staff, (req, res) => res.json(db.roads.filter((w) => RANK[req.user.role] >= RANK.admin || w.approval === 'approved' || w.byUser === req.user.username).slice().reverse()));
app.get('/api/admin/roads/queue', admin, (req, res) => res.json({ pending: db.roads.filter((w) => w.approval === 'pending').slice().reverse(), recent: db.roads.filter((w) => w.approval !== 'pending' && w.approvedAt).sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt))).slice(0, 30), total: pendingRoads() }));
app.post('/api/admin/roads/:id/:act(approve|reject)', admin, (req, res) => {
  const w = db.roads.find((x) => x.id === req.params.id); if (!w) return res.status(404).json({ error: 'ไม่พบ' });
  const ok = req.params.act === 'approve', reason = clean(req.body?.reason, 300);
  if (!ok && !reason) return res.status(400).json({ error: S('road.err.reason', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ') });
  Object.assign(w, { approval: ok ? 'approved' : 'rejected', approvedBy: req.user.name || req.user.username, approvedAt: new Date().toISOString(), reason: ok ? '' : reason });
  audit(req, ok ? 'road-approve' : 'road-reject', 'roads', w.id, w.title + (reason ? ' — ' + reason : '')); save(); afterChange('roads', w); res.json({ ok: true, item: w });
});
app.post('/api/staff/roads', staff, (req, res) => {
  const b = req.body || {}; const pts = (Array.isArray(b.points) ? b.points : []).map((p) => [num(p[0]), num(p[1])]).filter((p) => p[0] != null && p[1] != null && inPattaya(p[0], p[1]));
  if (pts.length < 2) return res.status(400).json({ error: S('err.road2', 'วาดอย่างน้อย 2 จุด') });
  const r = { id: newId('W'), type: b.type === 'closed' ? 'closed' : 'detour', title: clean(b.title, 100) || (b.type === 'closed' ? S('map.closed', 'ถนนปิด') : S('map.detour', 'เส้นทางเลี่ยง')), note: clean(b.note, 300), points: pts.slice(0, 300), ...roadPlace(pts.slice(0, 300)), status: 'open', by: req.staff.n, byUser: req.user.username, createdAt: new Date().toISOString() };
  const boss = RANK[req.user.role] >= RANK.admin; Object.assign(r, boss ? { approval: 'approved', approvedBy: req.staff.n, approvedAt: r.createdAt } : { approval: 'pending' });
  db.roads.push(r); audit(req, boss ? 'create' : 'road-submit', 'roads', r.id, r.title + (boss ? '' : ' (รออนุมัติ)')); save(); afterChange('roads', r); res.json({ ok: true, item: r, pending: !boss });
});

// ---------- back-office: generic collections ----------
const F = (k, label, type = 's', extra = {}) => ({ k, label, type, ...extra });
const COLLS = {
  reports: { label: 'รายงานระดับน้ำ', arr: () => db.reports, triage: true, statuses: ['new', 'verified', 'hidden'], fields: [F('areaName', 'พื้นที่'), F('soi', 'ซอย'), F('level', 'ระดับน้ำ', 'select', { options: Object.keys(LEVEL_CM) }), F('road', 'ถนน'), F('landmark', 'จุดสังเกตใกล้เคียง'), F('note', 'หมายเหตุ', 't'), F('lat', 'ละติจูด', 'n'), F('lng', 'ลองจิจูด', 'n')] },
  requests: { label: 'คำขอช่วยเหลือ / อพยพ / ผู้ป่วย', arr: () => db.requests, triage: true, typeField: 'kind', statuses: ['new', 'triaged', 'assigned', 'enroute', 'resolved', 'closed'], fields: [F('kind', 'ประเภท', 'select', { options: ['food', 'evacuate', 'medical', 'other'] }), F('areaName', 'พื้นที่'), F('soi', 'ซอย'), F('name', 'ชื่อ'), F('phone', 'เบอร์โทร'), F('road', 'ถนน'), F('landmark', 'จุดสังเกตใกล้เคียง'), F('people', 'จำนวนคน', 'n'), F('needs', 'สิ่งที่ต้องการ (คั่นด้วย ,)', 'list'), F('address', 'ที่อยู่', 't'), F('note', 'รายละเอียด', 't'), F('assignee', 'ทีมที่รับผิดชอบ'), F('priority', 'ความเร่งด่วน', 'select', { options: ['', 'low', 'normal', 'high', 'critical'] }), F('lat', 'ละติจูด', 'n'), F('lng', 'ลองจิจูด', 'n')] },
  missing: { label: 'ตามหาคน', arr: () => db.missing, triage: true, statuses: ['searching', 'found', 'closed'], fields: [F('personName', 'ชื่อผู้สูญหาย'), F('age', 'อายุ'), F('lastSeen', 'พบครั้งสุดท้าย', 't'), F('description', 'ลักษณะ', 't'), F('reporterName', 'ผู้แจ้ง'), F('reporterPhone', 'เบอร์ผู้แจ้ง')] },
  lostfound: { label: 'ของหาย–ได้คืน', arr: () => db.lostfound, triage: true, typeField: 'type', statuses: ['open', 'closed', 'hidden'], fields: [F('type', 'ประเภท', 'select', { options: ['lost', 'found'] }), F('category', 'หมวด'), F('title', 'หัวข้อ'), F('detail', 'รายละเอียด', 't'), F('place', 'สถานที่'), F('phone', 'เบอร์')] },
  roads: { label: 'เส้นทางเลี่ยง / ถนนปิด', arr: () => db.roads, triage: true, typeField: 'type', statuses: ['open', 'hidden'], fields: [F('type', 'ประเภท', 'select', { options: ['detour', 'closed'] }), F('title', 'ชื่อ'), F('soi', 'ซอย (จุดกึ่งกลาง)'), F('road', 'ถนน'), F('along', 'ถนน/ซอยที่ผ่าน'), F('landmark', 'จุดสังเกตใกล้เคียง'), F('note', 'หมายเหตุ', 't')] },
  shelters: { label: 'ศูนย์พักพิง', arr: () => db.shelters, create: true, adminEdit: true, prefix: 'S', statuses: ['open', 'full', 'closed', 'hidden'], fields: [F('name', 'ชื่อศูนย์พักพิง'), F('capacity', 'รับได้ (คน)', 'n'), F('occupancy', 'ผู้พักตอนนี้ (คน)', 'n'), F('facilities', 'สิ่งอำนวยความสะดวก (คั่นด้วย ,)', 'list'), F('contact', 'ผู้ติดต่อ'), F('phone', 'เบอร์โทร'), F('lat', 'ละติจูด', 'n'), F('lng', 'ลองจิจูด', 'n'), F('note', 'หมายเหตุ', 't')] },
  safe: { label: 'ฉันปลอดภัย (เช็กอิน)', arr: () => db.safe, adminEdit: true, statuses: ['open', 'hidden'], fields: [F('name', 'ชื่อ'), F('areaName', 'พื้นที่'), F('soi', 'ซอย'), F('phone', 'เบอร์โทร (ไม่แสดงต่อสาธารณะ)'), F('message', 'ข้อความ', 't')] },
  areas: { label: 'พื้นที่ / ผู้ประสานงาน (พื้นที่ที่ให้บริการ)', arr: () => db.contacts.areas, create: true, fields: [F('id', 'รหัสพื้นที่ (a-z)'), F('name', 'ชื่อพื้นที่'), F('org', 'หน่วยงาน'), F('coordinator', 'ผู้ประสานงาน'), F('phone', 'เบอร์โทร'), F('lat', 'ละติจูด', 'n'), F('lng', 'ลองจิจูด', 'n'), F('served', 'เปิดรับคำขอทางเว็บ', 'b'), F('verified', 'ตรวจสอบเบอร์แล้ว', 'b'), F('source', 'แหล่งที่มา')] },
  health: { label: 'โรงพยาบาล / สาธารณสุข', arr: () => db.contacts.health, create: true, prefix: 'H', fields: [F('name', 'ชื่อ'), F('phone', 'เบอร์โทร'), F('note', 'หมายเหตุ'), F('verified', 'ตรวจสอบแล้ว', 'b'), F('source', 'แหล่งที่มา')] },
  emergency: { label: 'เบอร์ฉุกเฉิน', arr: () => db.contacts.emergency, create: true, prefix: 'E', fields: [F('name', 'ชื่อ'), F('phone', 'เบอร์โทร'), F('note', 'หมายเหตุ'), F('verified', 'ตรวจสอบแล้ว', 'b'), F('source', 'แหล่งที่มา')] },
  cctv: { label: 'ลิงก์กล้อง CCTV', arr: () => db.cctv, create: true, prefix: 'V', statuses: ['open', 'hidden'], fields: [F('title', 'ชื่อ'), F('url', 'ลิงก์ (https://)'), F('kind', 'วิธีแสดงผล', 'select', { options: ['link', 'hls', 'image', 'iframe'] }), F('note', 'คำอธิบาย'), F('lat', 'ละติจูด', 'n'), F('lng', 'ลองจิจูด', 'n')] },
  links: { label: 'ลิงก์ข้อมูลเพิ่มเติม', arr: () => db.links, create: true, prefix: 'K', statuses: ['open', 'hidden'], fields: [F('title', 'ชื่อ'), F('url', 'ลิงก์ (https://)'), F('note', 'คำอธิบาย')] },
};
function coerce(f, v) {
  if (f.type === 'n') return num(v); if (f.type === 'b') return v === true || v === 'true' || v === 'on' || v === 1;
  if (f.type === 'list') return (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => clean(x, 40)).filter(Boolean).slice(0, 10);
  if (f.type === 'select') return f.options.includes(v) ? v : f.options[0];
  if (f.k === 'url') { const s = clean(v, 400); return /^https?:\/\//.test(s) ? s : ''; }
  if (f.k === 'phone') return clean(v, 30) || null;
  return clean(v, f.type === 't' ? 1000 : 200);
}
app.get('/api/admin/schema', staff, (req, res) => res.json({ me: pubUser(req.user), roles: ROLE_NAME, levels: LEVELS(), kinds: KINDS(), statusNames: STATUS_TEXT(), storage: store.kind,
  colls: Object.fromEntries(Object.entries(COLLS).map(([k, c]) => [k, { label: c.label, fields: c.fields, statuses: c.statuses || [], typeField: c.typeField, create: !!c.create, triage: !!c.triage, adminEdit: !!c.adminEdit }])) }));
app.get('/api/admin/c/:coll', staff, (req, res) => { const C = COLLS[req.params.coll]; if (!C) return res.status(404).end(); if (!C.triage && RANK[req.user.role] < 2) return res.status(403).json({ error: 'สิทธิ์ไม่พอ' }); res.json([...C.arr()].reverse()); });
app.post('/api/admin/c/:coll', staff, (req, res) => {
  const c = req.params.coll, C = COLLS[c]; if (!C || !C.create) return res.status(404).end(); if (lvl(req) < RANK.superadmin && !(C.adminEdit && lvl(req) >= RANK.admin)) return NOPE(res); const b = req.body || {}; const r = {};
  for (const f of C.fields) r[f.k] = coerce(f, b[f.k]);
  if (c === 'areas') { r.id = String(r.id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'area' + (++db.seq); if (db.contacts.areas.some((a) => a.id === r.id)) return res.status(400).json({ error: 'รหัสพื้นที่ซ้ำ' }); } else r.id = newId(C.prefix);
  if (C.statuses) r.status = C.statuses[0]; r.createdAt = new Date().toISOString(); if (c === 'roads') Object.assign(r, { approval: 'approved', approvedBy: req.user.name || req.user.username, approvedAt: r.createdAt, byUser: req.user.username, points: [] });
  if (!r.name && !r.title) return res.status(400).json({ error: 'กรอกชื่อ' });
  C.arr().push(r); audit(req, 'create', c, r.id, r.name || r.title); save(); afterChange(c, r); res.json({ ok: true, item: r });
});
app.put('/api/admin/c/:coll/:id', staff, (req, res) => {
  const c = req.params.coll, C = COLLS[c]; if (!C) return res.status(404).end(); const r = C.arr().find((x) => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'ไม่พบ' });
  const b = req.body || {}, ch = [];
  if (lvl(req) < RANK.superadmin && !(C.adminEdit && lvl(req) >= RANK.admin)) { // staff/admin: status (+note) only, on triage collections
    if (!C.triage) return NOPE(res, 'แก้ไขข้อมูลนี้ได้เฉพาะผู้ดูแลสูงสุด');
    const changed = C.fields.filter((f) => f.k in b && !(c === 'areas' && f.k === 'id') && JSON.stringify(coerce(f, b[f.k])) !== JSON.stringify(r[f.k]));
    if (changed.length) return NOPE(res, 'แก้ได้เฉพาะสถานะ (ช่องอื่นแก้ได้เฉพาะผู้ดูแลสูงสุด): ' + changed.map((f) => f.label).join(', '));
    if (b.status && b.status !== r.status && !statusOk(req, b.status)) return NOPE(res, 'ซ่อนรายการได้เฉพาะผู้ดูแล');
  }
  const ll0 = [r.lat, r.lng], soi0 = r.soi;
  for (const f of C.fields) if (f.k in b && !(c === 'areas' && f.k === 'id')) { const v = coerce(f, b[f.k]); if (JSON.stringify(v) !== JSON.stringify(r[f.k])) { r[f.k] = v; ch.push(f.label); } }
  if (b.status && b.status !== r.status && setStatus(req, c, r, b.status, b.stnote ?? (C.fields.some((f) => f.k === 'note') ? '' : b.note))) ch.push('สถานะ=' + b.status);
  if (['reports', 'requests'].includes(c) && (r.lat !== ll0[0] || r.lng !== ll0[1]) && r.soi === soi0) Object.assign(r, PLACE.offline(r.lat, r.lng) || { ...PLACE.EMPTY }, { soiAuto: '' });
  else if (['reports', 'requests', 'roads'].includes(c) && r.soi !== soi0) r.placeSrc = 'staff';
  if (c === 'requests' && 'areaName' in b) { const a = db.contacts.areas.find((x) => x.name === r.areaName); if (a) r.areaId = a.id; }
  audit(req, 'update', c, r.id, ch.join(', ')); save(); afterChange(c, r); res.json({ ok: true, item: r });
});
app.delete('/api/admin/c/:coll/:id', staff, wrap(async (req, res) => { const C = COLLS[req.params.coll]; if (!C) return res.status(404).end(); if (lvl(req) < RANK.superadmin && !(C.adminEdit && lvl(req) >= RANK.admin)) return NOPE(res, 'ลบได้เฉพาะผู้ดูแลสูงสุด'); if (!(await removeItem(req, req.params.coll, req.params.id))) return res.status(404).json({ error: 'ไม่พบ' }); save(); afterChange(req.params.coll); res.json({ ok: true }); }));
app.post('/api/admin/c/:coll/bulk', staff, wrap(async (req, res) => {
  const c = req.params.coll, C = COLLS[c]; if (!C) return res.status(404).end(); const { ids = [], action, status } = req.body || {}; let n = 0;
  if (action === 'delete') { if (lvl(req) < RANK.superadmin) return NOPE(res, 'ลบได้เฉพาะผู้ดูแลสูงสุด'); for (const id of ids) if (await removeItem(req, c, id)) n++; }
  else if (action === 'status') { if (!C.triage && lvl(req) < RANK.superadmin) return NOPE(res); if (!statusOk(req, status)) return NOPE(res, 'ซ่อนรายการได้เฉพาะผู้ดูแล'); for (const id of ids) { const r = C.arr().find((x) => x.id === id); if (r && setStatus(req, c, r, status)) { n++; afterChange(c, r); } } audit(req, 'bulk-status', c, null, `${n} รายการ → ${status}`); }
  else return res.status(400).json({ error: 'action ไม่ถูกต้อง' });
  save(); afterChange(c); res.json({ ok: true, n });
}));
app.get('/api/admin/c/:coll/export.csv', staff, (req, res) => {
  const C = COLLS[req.params.coll]; if (!C) return res.status(404).end(); if (!C.triage && RANK[req.user.role] < 2) return res.status(403).end();
  const cols = ['id', ...C.fields.map((f) => f.k).filter((k) => k !== 'id'), ...(C.statuses ? ['status'] : []), ...(['reports', 'requests', 'roads'].includes(req.params.coll) ? ['soiEn', 'roadEn', 'landmarkEn', 'landmarkM', 'placeSrc', 'soiAuto'] : []), 'photo', 'createdAt'];
  const q = (v) => { const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = C.arr().map((r) => cols.map((k) => q(r[k])).join(','));
  req.user && audit(req, 'export', req.params.coll, null, rows.length + ' แถว'); save();
  res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', `attachment; filename="${req.params.coll}-${new Date().toISOString().slice(0, 10)}.csv"`).send('\ufeff' + [cols.join(','), ...rows].join('\r\n'));
});
app.get('/api/admin/stats', staff, (req, res) => {
  const since = Date.now() - 24 * 3600e3, out = {};
  for (const [k, C] of Object.entries(COLLS)) { const a = C.arr(); const by = {}, byType = {}; for (const r of a) { by[r.status || '-'] = (by[r.status || '-'] || 0) + 1; if (C.typeField) byType[r[C.typeField]] = (byType[r[C.typeField]] || 0) + 1; } out[k] = { total: a.length, last24h: a.filter((r) => Date.parse(r.createdAt) > since).length, byStatus: by, byType }; }
  const open = db.requests.filter((r) => !['resolved', 'closed'].includes(r.status));
  res.json({ colls: out, openRequestsByKind: open.reduce((o, r) => ((o[r.kind] = (o[r.kind] || 0) + 1), o), {}), users: db.users.filter((u) => u.active).length, storage: store.kind, recent: db.audit.slice(-12).reverse() });
});
app.get('/api/admin/audit', admin, (req, res) => res.json(db.audit.slice(-2000).reverse()));

// ---------- full-data export for supervisors' Google Sheet (token = EXPORT_TOKEN env, or admin session) ----------
// Citizens' phones are masked (last 4 digits kept); IPs, device ids, vote/spam fingerprints and photo bytes are never exported.
const exportOk = (req) => { const want = process.env.EXPORT_TOKEN || ''; const got = String(req.query.token || req.headers['x-export-token'] || '');
  if (want.length >= 24 && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return true;
  const u = readUser(req); return !!(u && RANK[u.role] >= RANK.admin); };
const maskPhone = (p) => (p ? 'xxx-xxx-' + last4(p) : '');
function exportAll() {
  const pick = (r, keys) => Object.fromEntries(keys.map((k) => [k, Array.isArray(r[k]) ? r[k].join(', ') : r[k] ?? '']));
  const PL = ['soi', 'road', 'landmark', 'landmarkM', 'soiEn', 'roadEn', 'landmarkEn', 'placeSrc', 'soiAuto'];
  const reports = db.reports.map((r) => ({ ...pick(r, ['id', 'createdAt', 'areaName', ...PL, 'level', 'note', 'lat', 'lng', 'status', 'mod', 'modBy', 'modAt', 'cleared']), levelText: LEVELS()[r.level] || '', confirms: r.confirms || 1, votesYes: r.votes?.yes?.length || 0, votesNo: r.votes?.no?.length || 0, cm: LEVEL_CM[r.level] ?? '', photo: r.photo ? 1 : 0 }));
  const requests = db.requests.map((r) => ({ ...pick(r, ['id', 'createdAt', 'kind', 'areaName', ...PL, 'name', 'people', 'needs', 'address', 'note', 'assignee', 'priority', 'status', 'lat', 'lng', 'updatedAt']), phone: maskPhone(r.phone) }));
  const roads = db.roads.map((r) => ({ ...pick(r, ['id', 'createdAt', 'type', 'title', ...PL, 'along', 'note', 'status', 'approval', 'reason', 'by', 'approvedBy', 'approvedAt']), lat: r.points?.[0]?.[0] ?? '', lng: r.points?.[0]?.[1] ?? '', points: (r.points || []).length }));
  const lostfound = db.lostfound.map((r) => ({ ...pick(r, ['id', 'createdAt', 'type', 'category', 'title', 'detail', 'place', 'status', 'mod']), phone: maskPhone(r.phone) }));
  const missing = db.missing.map((r) => ({ ...pick(r, ['id', 'createdAt', 'personName', 'age', 'lastSeen', 'description', 'reporterName', 'status', 'mod']), reporterPhone: maskPhone(r.reporterPhone) }));
  const c = db.contacts || {}, con = (t) => (x) => ({ group: t, ...pick(x, ['id', 'name', 'phone', 'note', 'verified', 'source']) });
  const contacts = [...(c.emergency || []).map(con('ฉุกเฉิน')), ...(c.health || []).map(con('โรงพยาบาล/สาธารณสุข/ศูนย์พักพิง'))];
  const areas = (c.areas || []).map((a) => pick(a, ['id', 'name', 'org', 'coordinator', 'phone', 'lat', 'lng', 'served', 'verified', 'source']));
  const audit = db.audit.slice(-2000).map((a) => pick(a, ['at', 'by', 'action', 'coll', 'id', 'detail']));
  const count = (a, k) => a.reduce((o, r) => ((o[r[k] || '-'] = (o[r[k] || '-'] || 0) + 1), o), {});
  const summary = { generatedAt: new Date().toISOString(), totals: { reports: reports.length, requests: requests.length, roads: roads.length, lostfound: lostfound.length, missing: missing.length, contacts: contacts.length, areas: areas.length, audit: db.audit.length },
    roadsByApproval: count(roads, 'approval'), reportsByLevel: count(reports, 'level'), reportsByArea: count(reports, 'areaName'), requestsByStatus: count(requests, 'status'), requestsByKind: count(requests, 'kind'), levels: LEVELS(), statusNames: STATUS_TEXT() };
  const shelters = db.shelters.map((s) => ({ ...pick(s, ['id', 'createdAt', 'updatedAt', 'updatedBy', 'name', 'status', 'capacity', 'occupancy', 'facilities', 'contact', 'phone', 'soi', 'road', 'landmark', 'lat', 'lng', 'note']), available: Math.max(0, (s.capacity || 0) - (s.occupancy || 0)) }));
  const safe_checkins = db.safe.map((x) => ({ ...pick(x, ['id', 'createdAt', 'updatedAt', 'name', 'areaName', 'soi', 'message', 'status', 'mod', 'modBy', 'modAt']), phone: maskPhone(x.phone) }));
  Object.assign(summary.totals, { shelters: shelters.length, safe_checkins: safe_checkins.length });
  return { summary, reports, requests, roads, lostfound, missing, contacts, areas, audit, shelters, safe_checkins };
}
app.get('/api/export/all', (req, res) => {
  if (!exportOk(req)) return res.status(401).json({ error: 'unauthorized' });
  const data = exportAll(); res.set('cache-control', 'no-store');
  const ds = req.query.dataset;
  if (req.query.format === 'csv') { const a = data[ds]; if (!Array.isArray(a)) return res.status(400).json({ error: 'dataset=' + Object.keys(data).filter((k) => k !== 'summary').join('|') });
    const cols = [...new Set(a.flatMap(Object.keys))], q = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return res.type('text/csv; charset=utf-8').send('\ufeff' + [cols.join(','), ...a.map((r) => cols.map((k) => q(r[k])).join(','))].join('\r\n')); }
  res.json(ds ? data[ds] ?? null : data);
});

// ---------- Pattaya City official CCTV (livestream.pattaya.go.th) ----------
// Only the public camera list (metadata) is fetched server-side. Live video is WebRTC gated by Cloudflare Turnstile
// and frame-ancestors CSP, so we never proxy/rehost streams: the site links out to livestream.pattaya.go.th.
const PTY_LIVE = 'https://livestream.pattaya.go.th/';
function pattayaCams() {
  return cached('ptycams', 10 * 60e3, async () => {
    const j = await getJSON(PTY_LIVE + 'kapi/live/map', 20000); const items = j?.details?.items || [];
    return { ok: true, source: 'livestream.pattaya.go.th', fetchedAt: new Date().toISOString(), items: items.map((x) => ({ id: String(x.id), name: String(x.name || ''), location: String(x.location || ''), district: String(x.district || ''), lat: num(x.lat), lng: num(x.lng), state: String(x.monitorState || (x.status ? 'online' : 'offline')), type: String(x.type || '') })) };
  });
}
function mergedCams(all) {
  return (all.items || []).map((c) => { const o = db.cctvOverrides[c.id] || {}; return { ...c, title: o.title || '', lat: o.lat ?? c.lat, lng: o.lng ?? c.lng, hidden: !!o.hidden, featured: !!o.featured }; });
}
app.get('/api/cctv/pattaya', wrap(async (req, res) => { const r = await pattayaCams(); if (!r.ok) return res.json({ ok: false, error: r.error, items: [], liveUrl: PTY_LIVE });
  res.json({ ok: true, fetchedAt: r.fetchedAt, stale: !!r.stale, liveUrl: PTY_LIVE, items: mergedCams(r).filter((c) => !c.hidden).map(({ hidden, ...c }) => c) }); }));
app.get('/api/admin/cctv/pattaya', admin, wrap(async (req, res) => { const r = await pattayaCams(); res.json({ ok: !!r.ok, error: r.error, items: mergedCams(r) }); }));
app.put('/api/admin/cctv/pattaya/:id', superadmin, (req, res) => {
  const b = req.body || {}, id = clean(req.params.id, 80); const o = db.cctvOverrides[id] || {};
  if ('hidden' in b) o.hidden = !!b.hidden; if ('featured' in b) o.featured = !!b.featured; if ('title' in b) o.title = clean(b.title, 120);
  if ('lat' in b) o.lat = num(b.lat); if ('lng' in b) o.lng = num(b.lng);
  db.cctvOverrides[id] = o; audit(req, 'update', 'cctv-pattaya', id, JSON.stringify(b).slice(0, 200)); save(); broadcast('cms', { coll: 'cctv' }); res.json({ ok: true });
});

// ---------- back-office: texts & settings ----------
app.get('/api/admin/texts', superadmin, (req, res) => { const reg = require('./texts').build(); Object.assign(TEXTS, reg);
  res.json(Object.values(TEXTS).map((t) => ({ key: t.key, group: t.group, g: t.g, default: t.d, value: db.texts[t.key] ?? null,
    i18n: { en: { default: TR.en[t.key] ?? '', value: db.i18n.en[t.key] ?? null }, zh: { default: TR.zh[t.key] ?? '', value: db.i18n.zh[t.key] ?? null } } }))); });
app.put('/api/admin/texts', superadmin, (req, res) => {
  const vals = req.body?.values || (req.body?.key ? { [req.body.key]: req.body.value } : {}); const ch = [];
  const lang = ['en', 'zh'].includes(req.body?.lang) ? req.body.lang : 'th', tgt = lang === 'th' ? db.texts : db.i18n[lang];
  for (const [k, v] of Object.entries(vals)) { if (!TEXTS[k]) continue; const s = String(v ?? '').slice(0, 2000); const def = lang === 'th' ? TEXTS[k].d : TR[lang][k]; if (s === '' || s === def) delete tgt[k]; else tgt[k] = s; ch.push(k); }
  audit(req, 'texts', 'texts', lang, ch.join(', ')); save(); broadcast('cms', { coll: 'texts' }); res.json({ ok: true, n: ch.length });
});
app.delete('/api/admin/texts/:key', superadmin, (req, res) => { const lang = ['en', 'zh'].includes(req.query.lang) ? req.query.lang : 'th'; delete (lang === 'th' ? db.texts : db.i18n[lang])[req.params.key]; audit(req, 'text-reset', 'texts', req.params.key, lang); save(); broadcast('cms', { coll: 'texts' }); res.json({ ok: true }); });
app.get('/api/admin/antispam', superadmin, (req, res) => res.json({ antispam: db.antispam, defaults: AS_DEFAULT, stats: asStats, turnstile: !!TURNSTILE, yourIp: req.ip }));
app.put('/api/admin/antispam', superadmin, (req, res) => {
  const b = req.body || {}, A = db.antispam; if (b.reset) db.antispam = JSON.parse(JSON.stringify(AS_DEFAULT));
  else { const n = (x, lo, hi, d) => { x = Number(x); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
    if ('on' in b) A.on = !!b.on; if ('honeypot' in b) A.honeypot = !!b.honeypot; if ('dedupe' in b) A.dedupe = !!b.dedupe;
    A.minFillSec = n(b.minFillSec, 0, 120, A.minFillSec); A.dedupeMin = n(b.dedupeMin, 1, 1440, A.dedupeMin); A.dedupeMeters = n(b.dedupeMeters, 10, 5000, A.dedupeMeters); A.maxPhotoMB = n(b.maxPhotoMB, 0.2, 3, A.maxPhotoMB);
    for (const k of Object.keys(AS_DEFAULT.limits)) if (b.limits?.[k]) A.limits[k] = { n: n(b.limits[k].n, 0, 1000, A.limits[k].n), min: n(b.limits[k].min, 1, 1440, A.limits[k].min) };
    if (Array.isArray(b.blocked)) A.blocked = [...new Set(b.blocked.map((x) => String(x).trim().slice(0, 64)).filter(Boolean))].slice(0, 2000); }
  audit(req, 'antispam', 'antispam', null, JSON.stringify(db.antispam).slice(0, 300)); save(); res.json({ ok: true, antispam: db.antispam });
});
app.post('/api/admin/logo', superadmin, wrap(async (req, res) => { const u = await savePhoto(req.body?.image); if (!u) return res.status(400).json({ error: 'เลือกรูปโลโก้' });
  db.settings.logoUrl = u; audit(req, 'logo', 'settings', null, u); save(); broadcast('cms', { coll: 'settings' }); res.json({ ok: true, logoUrl: u }); }));
app.get('/api/admin/settings', superadmin, (req, res) => res.json({ settings: db.settings, defaults: DEFAULT_SETTINGS }));
app.put('/api/admin/settings', superadmin, (req, res) => {
  const b = req.body || {}, s = db.settings;
  if (b.logo != null) s.logo = clean(b.logo, 8); if (b.logoUrl != null) s.logoUrl = /^(https?:\/\/|\/)/.test(b.logoUrl) ? clean(b.logoUrl, 400) : '';
  for (const k of ['primary', 'header', 'bg']) if (b[k]) s[k] = color(b[k], s[k]);
  if (b.banner) s.banner = { on: !!b.banner.on, text: clean(b.banner.text, 500), level: ['info', 'warn', 'danger'].includes(b.banner.level) ? b.banner.level : 'warn' };
  if (Array.isArray(b.sections)) { const ok = DEFAULT_SETTINGS.sections.map((x) => x.id); const seen = new Set(); s.sections = b.sections.filter((x) => ok.includes(x.id) && !seen.has(x.id) && seen.add(x.id)).map((x) => ({ id: x.id, on: !!x.on })); for (const id of ok) if (!seen.has(id)) s.sections.push({ id, on: true }); }
  if (b.reset) db.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  audit(req, 'settings', 'settings', null, Object.keys(b).join(', ')); save(); broadcast('cms', { coll: 'settings' }); res.json({ ok: true, settings: db.settings });
});
app.get('/api/admin/geofence', superadmin, (req, res) => res.json({ geofence: db.geofence, defaults: GEO_DEFAULT, source: BOUNDARY.properties }));
app.put('/api/admin/geofence', superadmin, (req, res) => { const b = req.body || {}, g = db.geofence, old = JSON.stringify(g);
  if ('on' in b) g.on = !!b.on; if ('bufferM' in b) { const v = Number(b.bufferM); if (Number.isFinite(v)) g.bufferM = Math.round(Math.min(10000, Math.max(0, v))); }
  audit(req, 'geofence', 'geofence', null, `${old} → ${JSON.stringify(g)}`); save(); broadcast('cms', { coll: 'geofence' }); res.json({ ok: true, geofence: g }); });
// ---------- moderation queue & settings ----------
const modItem = (coll, x) => ({ coll, ...x, yes: x.votes?.yes.length || 0, no: x.votes?.no.length || 0 });
app.get('/api/admin/moderation', staff, (req, res) => {
  const items = MOD_COLLS.flatMap((k) => db[k].filter((x) => x.mod === 'pending' || x.mod === 'held').map((x) => modItem(k, x))).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const recent = MOD_COLLS.flatMap((k) => db[k].filter((x) => x.mod === 'rejected' || (x.mod === 'verified' && x.modAt)).map((x) => modItem(k, x))).sort((a, b) => ((a.modAt || '') < (b.modAt || '') ? 1 : -1)).slice(0, 30);
  res.json({ mode: M().mode, settings: M(), counts: modCounts(), items, recent });
});
app.post('/api/admin/moderation/action', staff, (req, res) => {
  const { items = [], action } = req.body || {}; const to = { approve: 'verified', reject: 'rejected', hold: 'held' }[action];
  if (!to) return res.status(400).json({ error: 'action ไม่ถูกต้อง' }); if (action !== 'approve' && lvl(req) < RANK.admin) return NOPE(res, 'เจ้าหน้าที่ยืนยันได้อย่างเดียว (พัก/ซ่อน/ปฏิเสธ ต้องเป็นผู้ดูแล)'); let n = 0;
  for (const it of (Array.isArray(items) ? items : []).slice(0, 500)) { if (!MOD_COLLS.includes(it?.coll)) continue; const r = db[it.coll].find((x) => x.id === it.id); if (!r || r.mod === to) continue;
    const from = r.mod; r.mod = to; r.modBy = req.staff.n; r.modAt = new Date().toISOString(); if (to === 'verified' && it.coll === 'reports' && r.status === 'new') r.status = 'verified';
    audit(req, 'mod-' + action, it.coll, r.id, `${from} → ${to}`); afterMod(it.coll, r); n++; }
  save(); res.json({ ok: true, n, counts: modCounts() });
});
app.get('/api/admin/moderation/settings', admin, (req, res) => res.json({ settings: M(), defaults: MOD_DEFAULT }));
app.put('/api/admin/moderation/settings', superadmin, (req, res) => {
  const b = req.body || {}, m = M(), ch = [], old = m.mode; const n = (x, lo, hi, d) => { x = Number(x); return Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x))) : d; };
  if (b.reset) { db.moderation = JSON.parse(JSON.stringify(MOD_DEFAULT)); ch.push('reset'); }
  else {
    if (['hybrid', 'approve', 'off'].includes(b.mode) && b.mode !== m.mode) { m.mode = b.mode; ch.push(`โหมด ${old} → ${b.mode}`); }
    for (const [k, lo, hi] of [['autoVerifyN', 1, 50], ['clearN', 1, 50]]) if (k in b) { const v = n(b[k], lo, hi, m[k]); if (v !== m[k]) { m[k] = v; ch.push(`${k}=${v}`); } }
    for (const k of ['distinctIp', 'holdLinks', 'holdPhones']) if (k in b && !!b[k] !== m[k]) { m[k] = !!b[k]; ch.push(`${k}=${m[k]}`); }
    if (b.voteLimit) { m.voteLimit = { n: n(b.voteLimit.n, 0, 1000, m.voteLimit.n), min: n(b.voteLimit.min, 1, 1440, m.voteLimit.min) }; }
    for (const k of ['words', 'flagged']) if (Array.isArray(b[k])) { const v = [...new Set(b[k].map((x) => String(x).trim().slice(0, 64)).filter(Boolean))].slice(0, 2000); if (JSON.stringify(v) !== JSON.stringify(m[k])) { m[k] = v; ch.push(`${k} (${v.length})`); } }
  }
  const mm = M(); let auto = 0;
  if (mm.mode === 'off' && old !== 'off') for (const k of MOD_COLLS) for (const x of db[k]) if (x.mod === 'pending') { x.mod = 'verified'; x.modBy = 'mode-off'; x.modAt = new Date().toISOString(); auto++; }
  if (mm.mode === 'hybrid') for (const x of db.reports) if (x.mod === 'pending') evaluate(x);
  if (auto) ch.push(`ยืนยันรายการรอตรวจ ${auto} รายการ`);
  audit(req, mm.mode !== old ? 'mod-mode' : 'mod-settings', 'moderation', null, ch.join(', ') || 'ไม่มีการเปลี่ยนแปลง'); save();
  broadcast('cms', { coll: 'moderation', mode: mm.mode }); broadcast('report', { mode: mm.mode }); broadcast('lostfound', {}); broadcast('staff:mod', modCounts(), true);
  res.json({ ok: true, settings: mm });
});
// ---------- avoidance routing ----------
function floodZones() {
  const since = Date.now() - 24 * 3600e3, z = [];
  for (const r of db.reports) if (inRoute(r) && Date.parse(r.createdAt) > since && LEVEL_CM[r.level] >= 30) z.push({ lat: r.lat, lng: r.lng, rM: LEVEL_CM[r.level] >= 75 ? 250 : 150, label: S('map.zonereport', 'รายงาน') + ' ' + (LEVELS()[r.level] || '') + (r.mod === 'pending' ? ' (' + S('mod.pending', 'รอตรวจสอบ') + ')' : ''), id: r.id });
  for (const w of liveRoads()) if (w.type === 'closed') for (let i = 0; i < w.points.length; i++) {
    z.push({ lat: w.points[i][0], lng: w.points[i][1], rM: 80, label: S('map.closed', 'ถนนปิด') + ': ' + w.title, id: w.id });
    if (i) { const a = w.points[i - 1], b = w.points[i]; const n = Math.ceil(km(a[0], a[1], b[0], b[1]) * 1000 / 100); for (let k = 1; k < n; k++) z.push({ lat: a[0] + (b[0] - a[0]) * k / n, lng: a[1] + (b[1] - a[1]) * k / n, rM: 80, label: S('map.closed', 'ถนนปิด') + ': ' + w.title, id: w.id }); }
  }
  return z;
}
function hits(coords, zones) { const hit = new Map(); for (const [lng, lat] of coords) for (const z of zones) if (km(lat, lng, z.lat, z.lng) * 1000 < z.rM) hit.set(z.id, z.label); return [...hit.values()]; }
function circle(z, n = 10) { const pts = []; for (let i = 0; i <= n; i++) { const t = 2 * Math.PI * i / n; pts.push([+(z.lng + Math.sin(t) * z.rM / 108500).toFixed(6), +(z.lat + Math.cos(t) * z.rM / 111000).toFixed(6)]); } return [pts]; }
app.get('/api/route', wrap(async (req, res) => {
  const a = [num(req.query.fromLat), num(req.query.fromLng)], b = [num(req.query.toLat), num(req.query.toLng)];
  if (a.concat(b).some((x) => x == null) || !inPattaya(...a) || !inPattaya(...b)) return res.status(400).json({ error: S('err.routeoutside', 'จุดเริ่มและปลายทางต้องอยู่ในเขตเมืองพัทยา') });
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
  } catch (e) { return res.status(502).json({ error: S('err.routefail', 'บริการคำนวณเส้นทางไม่ตอบสนอง') + ': ' + e.message, zones }); }
  routes.forEach((r) => { r.floodHits = hits(r.coords, zones); });
  const order = [...routes].sort((x, y) => x.floodHits.length - y.floodHits.length || x.duration - y.duration);
  const best = order[0]; const avoids = best && best.floodHits.length === 0;
  const via = best ? [0.33, 0.66].map((f) => best.coords[Math.floor(best.coords.length * f)]).map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|') : '';
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${a.join(',')}&destination=${b.join(',')}&travelmode=driving${via ? '&waypoints=' + encodeURIComponent(via) : ''}`;
  res.json({ ok: true, engine, avoids, warning: avoids ? null : (zones.length ? S('map.warnnoavoid', 'ไม่พบเส้นทางที่เลี่ยงจุดน้ำท่วมได้ทั้งหมด — เส้นทางนี้ผ่านจุดเสี่ยงน้อยที่สุด ใช้ความระมัดระวัง') : null), zonesCount: zones.length, zones, best, alternatives: order.slice(1), gmaps });
}));
// ================= in-app flood-avoidance router (OSM graph + A*, per-vehicle depth limits) =================
const ROUTER = require('./geo/router');
const HZ_R = { ankle: 120, knee: 180, waist: 250, chest: 300, roof: 350 };
function routeHazards() {
  const now = Date.now(), hz = [];
  for (const r of db.reports) { if (!inRoute(r) || !isPublic(r) || !HZ_R[r.level] || r.lat == null) continue; const ageH = (now - Date.parse(r.createdAt)) / 3600e3; if (ageH > 48 || ageH < -1) continue;
    hz.push({ id: r.id, type: 'report', lat: r.lat, lng: r.lng, rM: HZ_R[r.level], cm: LEVEL_CM[r.level], level: r.level, decay: +Math.exp(-Math.max(0, ageH) / 12).toFixed(3), soi: r.soi || '', soiEn: r.soiEn || '', road: r.road || '', roadEn: r.roadEn || '', at: r.createdAt }); }
  for (const w of liveRoads()) if (w.type === 'closed' && (w.points || []).length) { const m = w.points[Math.floor(w.points.length / 2)]; hz.push({ id: w.id, type: 'closed', points: w.points, lat: m[0], lng: m[1], title: w.title, soi: w.soi || '', soiEn: w.soiEn || '', road: w.road || '', roadEn: w.roadEn || '' }); }
  const from = BKK(new Date(now - 90 * 864e5).toISOString());
  for (const h of soiHistory(from, null)) if (h.days >= 2 && h.soi) hz.push({ id: 'soi:' + h.soi, type: 'repeat', lat: h.lat, lng: h.lng, rM: 150, cm: h.maxCm, level: h.maxLevel, decay: 1, soi: h.soi, soiEn: h.soiEn, road: h.road || '', days: h.days });
  return hz;
}
const pt = (s) => { const [a, b] = String(s || '').split(',').map(num); return a != null && b != null && inPattaya(a, b) ? [a, b] : null; };
const hzPub = (hz) => hz.map((h) => ({ id: h.id, type: h.type, lat: h.lat, lng: h.lng, rM: h.rM || 0, level: h.level || null, cm: h.cm || null, decay: h.decay ?? 1, soi: h.soi, soiEn: h.soiEn, road: h.road, roadEn: h.roadEn, title: h.title || '', points: h.points || null, days: h.days || null }));
app.get('/api/route2/meta', (req, res) => res.json(ROUTER.meta));
app.get('/api/route2/hazards', (req, res) => res.json(hzPub(routeHazards())));
app.get('/api/route2', (req, res) => {
  const a = pt(req.query.from), b = pt(req.query.to); if (!a || !b) return res.status(400).json({ error: S('err.routeoutside', 'จุดเริ่มและปลายทางต้องอยู่ในเขตเมืองพัทยา') });
  const hz = routeHazards(), r = ROUTER.plan(a, b, String(req.query.veh || 'car'), hz);
  if (r.error) return res.status(404).json({ error: S('rt.noroute', 'ไม่พบเส้นทางบนโครงข่ายถนน'), code: r.error });
  res.json({ ...r, from: a, to: b, hazards: hzPub(hz), graph: { osmBase: ROUTER.meta.osmBase } });
});
app.get('/api/route2/nearest', (req, res) => {
  const a = pt(req.query.from), type = req.query.type === 'hospital' ? 'hospital' : 'shelter', v = String(req.query.veh || 'car'); if (!a) return res.status(400).json({ error: S('err.routeoutside', 'จุดเริ่มและปลายทางต้องอยู่ในเขตเมืองพัทยา') });
  const cands = type === 'hospital' ? PLACE.pois('hospital').map((p) => ({ name: p.th || p.en, nameEn: p.en || p.th, lat: p.lat, lng: p.lng }))
    : pubShelters().filter((s) => s.status === 'open' && s.available > 0).map((s) => ({ id: s.id, name: s.name, nameEn: s.name, lat: s.lat, lng: s.lng, available: s.available, phone: s.phone }));
  const hz = routeHazards(), i = ROUTER.nearest(a, v, cands, hz); if (i < 0) return res.status(404).json({ error: S('rt.nonear', 'ไม่พบจุดหมายที่ไปถึงได้') });
  const t = cands[i], r = ROUTER.plan(a, [t.lat, t.lng], v, hz); if (r.error) return res.status(404).json({ error: S('rt.noroute', 'ไม่พบเส้นทางบนโครงข่ายถนน') });
  res.json({ ...r, from: a, to: [t.lat, t.lng], target: { ...t, type }, hazards: hzPub(hz), graph: { osmBase: ROUTER.meta.osmBase } });
});
// ================= shelters · "I'm safe" check-ins · executive dashboard · daily PDF · repeat-flood history by soi =================
const BKK = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10); // calendar day in Asia/Bangkok
const dayStart = (d) => Date.parse(d + 'T00:00:00+07:00');
const todayBKK = () => BKK(new Date().toISOString());
const maskName = (n) => String(n || '').trim().split(/\s+/).map((w, i) => (i === 0 ? w : [...w][0] + '•••')).join(' ');
// shelters (admin/superadmin manage in back-office; staff update occupancy; public sees capacity & spaces)
const shelterPub = (s) => { const cap = s.capacity || 0, occ = s.occupancy || 0; return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, soi: s.soi || '', soiEn: s.soiEn || '', road: s.road || '', roadEn: s.roadEn || '', capacity: cap, occupancy: occ, available: Math.max(0, cap - occ), facilities: s.facilities || [], phone: s.phone || '', contact: s.contact || '', note: s.note || '', status: s.status === 'open' && cap && occ >= cap ? 'full' : s.status, updatedAt: s.updatedAt || s.createdAt }; };
const shelterPlace = (s) => { if (s.lat != null && s.lng != null) Object.assign(s, PLACE.offline(s.lat, s.lng) || { ...PLACE.EMPTY }); };
const pubShelters = () => db.shelters.filter((s) => s.status !== 'hidden').map(shelterPub);
app.get('/api/shelters', (req, res) => res.json(pubShelters()));
app.patch('/api/shelters/:id/occupancy', staff, (req, res) => {
  const s = db.shelters.find((x) => x.id === req.params.id); if (!s) return res.status(404).json({ error: 'ไม่พบ' }); const b = req.body || {};
  const occ = num(b.occupancy); if (occ == null || occ < 0 || occ > 100000) return res.status(400).json({ error: S('err.occ', 'จำนวนผู้พักไม่ถูกต้อง') });
  if (b.status && !['open', 'full', 'closed'].includes(b.status)) return NOPE(res);
  s.occupancy = Math.round(occ); if (b.status) s.status = b.status; s.updatedAt = new Date().toISOString(); s.updatedBy = req.staff.n;
  audit(req, 'shelter-occupancy', 'shelters', s.id, `${s.name}: ${s.occupancy}/${s.capacity}`); save(); afterChange('shelters', s); res.json({ ok: true, item: shelterPub(s) });
});
// "I'm safe": public, phone kept for staff only, name masked in search, admin moderation (hybrid: pending shows, held hidden)
app.post('/api/safe', guard('safe'), wrap(async (req, res) => {
  const b = req.body || {}, name = clean(b.name, 80), phone = clean(b.phone, 20);
  if (name.length < 2) return res.status(400).json({ error: S('err.safename', 'ใส่ชื่อ-นามสกุล') }); if (last4(phone).length < 4) return res.status(400).json({ error: S('err.phone', 'กรอกเบอร์โทรที่ติดต่อได้') });
  const a = area(b.areaId), msg = clean(b.message, 200), soi = clean(b.soi, 100);
  const dup = db.safe.find((x) => x.name.toLowerCase() === name.toLowerCase() && last4(x.phone) === last4(phone) && x.status !== 'hidden');
  if (dup) { Object.assign(dup, { message: msg || dup.message, soi: soi || dup.soi, areaName: a?.name || dup.areaName, updatedAt: new Date().toISOString() }); save(); broadcast('staff:update', { coll: 'safe', item: dup }, true); return res.json({ ok: true, id: dup.id, merged: true, mod: dup.mod }); }
  const r = { id: newId('SF'), name, phone, areaId: a?.id || null, areaName: a?.name || '', soi, message: msg, status: 'open', src: { ip: req.ip || '', dev: devOf(req) }, createdAt: new Date().toISOString(), ...initialMod([name, msg, soi].join(' '), req) };
  db.safe.push(r); if (r.mod === 'held') sysAudit('mod-held', 'safe', r.id, (r.modReasons || []).join(', '));
  save(); broadcast('staff:update', { coll: 'safe', item: r }, true); broadcast('staff:mod', modCounts(), true); res.json({ ok: true, id: r.id, mod: r.mod, public: isPublic(r) });
}));
app.get('/api/safe', (req, res) => { const q = clean(req.query.q, 60).toLowerCase(); if ([...q].length < 2) return res.json([]);
  res.json(db.safe.filter((x) => isPublic(x) && x.name.toLowerCase().includes(q)).slice(-20).reverse().map((x) => ({ id: x.id, name: maskName(x.name), areaName: x.areaName, soi: x.soi, message: x.message, verified: x.mod === 'verified', at: x.updatedAt || x.createdAt }))); });
// repeat-flood history by soi (public reports only: not hidden, not held/rejected)
function soiHistory(from, to) {
  const f = from ? dayStart(from) : 0, t = to ? dayStart(to) + 864e5 : Infinity, LV = Object.keys(LEVEL_CM), m = new Map();
  for (const r of db.reports) { const at = Date.parse(r.createdAt); if (r.status === 'hidden' || ['held', 'rejected'].includes(r.mod) || at < f || at >= t) continue; const k = r.soi || r.road; if (!k) continue;
    let e = m.get(k); if (!e) m.set(k, (e = { soi: k, soiEn: r.soi ? r.soiEn || '' : r.roadEn || '', road: r.soi ? r.road || '' : '', count: 0, days: new Set(), maxCm: 0, maxLevel: '', first: r.createdAt, last: r.createdAt, la: 0, ln: 0, byLevel: {} }));
    e.count++; e.days.add(BKK(r.createdAt)); e.la += r.lat; e.ln += r.lng; e.byLevel[r.level] = (e.byLevel[r.level] || 0) + 1; if ((LEVEL_CM[r.level] || 0) > e.maxCm) { e.maxCm = LEVEL_CM[r.level]; e.maxLevel = r.level; }
    if (r.createdAt < e.first) e.first = r.createdAt; if (r.createdAt > e.last) e.last = r.createdAt; }
  return [...m.values()].map((e) => ({ soi: e.soi, soiEn: e.soiEn, road: e.road, count: e.count, days: e.days.size, maxCm: e.maxCm, maxLevel: e.maxLevel, maxLevelText: LEVELS()[e.maxLevel] || '', first: e.first, last: e.last, lat: +(e.la / e.count).toFixed(5), lng: +(e.ln / e.count).toFixed(5), ...Object.fromEntries(LV.map((l) => ['n_' + l, e.byLevel[l] || 0])) }))
    .sort((a, b) => b.days - a.days || b.count - a.count || b.maxCm - a.maxCm);
}
const csvOf = (a) => { const cols = [...new Set(a.flatMap(Object.keys))], q = (v) => { const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return '\ufeff' + [cols.join(','), ...a.map((r) => cols.map((k) => q(r[k])).join(','))].join('\r\n'); };
const ymd = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
app.get('/api/soi-history', (req, res) => { const a = soiHistory(ymd(req.query.from), ymd(req.query.to));
  if (req.query.format === 'csv') return res.type('text/csv; charset=utf-8').set('content-disposition', `attachment; filename="soi-history-${ymd(req.query.from) || 'all'}_${ymd(req.query.to) || todayBKK()}.csv"`).send(csvOf(a)); res.json(a); });
// executive dashboard (read-only for every staff role)
function execData(sinceH = 24) {
  const now = Date.now(), since = now - sinceH * 3600e3, done = ['resolved', 'closed'];
  const reqs = db.requests.filter((r) => r.status !== 'deleted'), open = reqs.filter((r) => !done.includes(r.status));
  const firstAct = (r) => { const h = (r.history || []).find((x) => x.s !== 'new'); return h ? (Date.parse(h.at) - Date.parse(r.createdAt)) / 60000 : null; };
  const resolveAt = (r) => { const h = (r.history || []).find((x) => done.includes(x.s)); return h ? (Date.parse(h.at) - Date.parse(r.createdAt)) / 60000 : null; };
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null), resp = reqs.map(firstAct).filter((x) => x != null && x >= 0), resl = reqs.map(resolveAt).filter((x) => x != null && x >= 0);
  const rep = db.reports.filter((r) => r.status !== 'hidden' && !['held', 'rejected'].includes(r.mod)), rep24 = rep.filter((r) => Date.parse(r.createdAt) > since);
  const roads = liveRoads(), sh = db.shelters.filter((s) => s.status !== 'hidden'), teams = {};
  for (const r of reqs) { const k = r.assignee || ''; const t = (teams[k] ||= { team: k, open: 0, enroute: 0, done: 0, total: 0 }); t.total++; if (done.includes(r.status)) t.done++; else { t.open++; if (r.status === 'enroute') t.enroute++; } }
  const cnt = (a, f) => a.reduce((o, r) => ((o[f(r)] = (o[f(r)] || 0) + 1), o), {});
  return { generatedAt: new Date().toISOString(), openRequests: open.length, pendingRequests: open.filter((r) => r.status === 'new').length, openByKind: cnt(open, (r) => r.kind), requestsByStatus: cnt(reqs, (r) => r.status),
    avgResponseMin: avg(resp), avgResolveMin: avg(resl), responded: resp.length, reports24h: rep24.length, reportsByLevel24h: cnt(rep24, (r) => r.level), reportsByHour24h: Array.from({ length: 24 }, (_, i) => rep24.filter((r) => Math.floor((now - Date.parse(r.createdAt)) / 3600e3) === 23 - i).length),
    closures: roads.filter((w) => w.type === 'closed').length, detours: roads.filter((w) => w.type !== 'closed').length,
    shelters: { count: sh.length, open: sh.filter((s) => shelterPub(s).status === 'open').length, full: sh.filter((s) => shelterPub(s).status === 'full').length, capacity: sh.reduce((a, s) => a + (s.capacity || 0), 0), occupancy: sh.reduce((a, s) => a + (s.occupancy || 0), 0), list: sh.map(shelterPub) },
    heat: rep.filter((r) => Date.parse(r.createdAt) > now - 7 * 864e5).map((r) => [r.lat, r.lng, LEVEL_CM[r.level] || 0]), teams: Object.values(teams).sort((a, b) => b.open - a.open), levels: LEVELS(), kinds: KINDS(), statusNames: STATUS_TEXT(),
    safe: { total: db.safe.filter(isPublic).length } };
}
app.get('/api/admin/exec', staff, (req, res) => res.json(execData()));
// daily PDF (Thai font) — download from admin, or generate on a schedule via POST with EXPORT_TOKEN (no email/LINE sending)
const REPORT_DIR = path.join(DATA_DIR, 'reports');
function dailyData(day) {
  const f = dayStart(day), t = f + 864e5, inDay = (r) => { const a = Date.parse(r.createdAt); return a >= f && a < t; };
  const rep = db.reports.filter((r) => inDay(r) && r.status !== 'hidden' && !['held', 'rejected'].includes(r.mod)), req = db.requests.filter(inDay);
  return { day, generatedAt: new Date().toISOString(), reports: rep, requests: req, byLevel: rep.reduce((o, r) => ((o[r.level] = (o[r.level] || 0) + 1), o), {}), byHour: Array.from({ length: 24 }, (_, h) => rep.filter((r) => new Date(Date.parse(r.createdAt) + 7 * 3600e3).getUTCHours() === h).length),
    reqByStatus: req.reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {}), sois: soiHistory(day, day).slice(0, 12), exec: execData(), roads: liveRoads(), levels: LEVELS(), LEVEL_CM, statusNames: STATUS_TEXT(), kinds: KINDS(), boundary: POLYS, safeN: db.safe.filter((x) => inDay(x) && isPublic(x)).length };
}
const PDF = require('./report-pdf');
app.get('/api/admin/report/daily.pdf', admin, wrap(async (req, res) => { const day = ymd(req.query.date) || todayBKK(); const buf = await PDF.build(dailyData(day)); audit(req, 'daily-pdf', 'reports', null, day); save();
  res.type('application/pdf').set('content-disposition', `${req.query.dl ? 'attachment' : 'inline'}; filename="pattaya-flood-daily-${day}.pdf"`).send(buf); }));
app.post('/api/report/daily/generate', wrap(async (req, res) => { if (!exportOk(req)) return res.status(401).json({ error: 'unauthorized' });
  const day = ymd(req.query.date || req.body?.date) || todayBKK(), buf = await PDF.build(dailyData(day)); fs.mkdirSync(REPORT_DIR, { recursive: true }); const file = `daily-${day}.pdf`; fs.writeFileSync(path.join(REPORT_DIR, file), buf);
  db.audit.push({ at: new Date().toISOString(), by: 'ระบบ (ตั้งเวลา)', action: 'daily-pdf', coll: 'reports', detail: file }); save(); res.json({ ok: true, file, bytes: buf.length, url: '/api/admin/reports/' + file }); }));
app.get('/api/admin/reports', admin, (req, res) => { let a = []; try { a = fs.readdirSync(REPORT_DIR).filter((f) => /^daily-\d{4}-\d{2}-\d{2}\.pdf$/.test(f)).sort().reverse().map((f) => ({ file: f, bytes: fs.statSync(path.join(REPORT_DIR, f)).size })); } catch {} res.json(a); });
app.get('/api/admin/reports/:file', admin, (req, res) => { const f = req.params.file; if (!/^daily-\d{4}-\d{2}-\d{2}\.pdf$/.test(f) || !fs.existsSync(path.join(REPORT_DIR, f))) return res.status(404).end(); res.type('application/pdf').sendFile(path.join(REPORT_DIR, f)); });

app.get('*', renderIndex);
app.use((err, req, res, next) => { if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' }); });
init().then(() => app.listen(PORT, () => console.log(`Pattaya flood center on http://localhost:${PORT} · storage=${store.kind} · admin user "${ADMIN_USERNAME}"`))).catch((e) => { console.error('startup failed', e); process.exit(1); });
