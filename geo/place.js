// Soi / road / landmark lookup for Pattaya City.
// 1) Offline: geo/pattaya-osm.json (named highways + landmark POIs, OpenStreetMap contributors, ODbL) built by scripts/build-osm.js.
// 2) Fallback (only when offline finds nothing): Nominatim reverse, max 1 request/second, identifying User-Agent,
//    results cached in db.geocache (rounded to ~11 m) so the same spot is never asked twice. Disable with GEOCODE_NOMINATIM=0.
const fs = require('fs'), path = require('path');
const DATA = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'pattaya-osm.json'), 'utf8')); } catch { return { roads: [], pois: [], fetchedAt: '', osmBase: '' }; } })();
const KX = 108500, KY = 111000, CELL = 0.002; // ~220 m grid
const MAJOR = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/;
const SOI_RE = /ซอย|^soi\b|\bsoi\b/i;
const norm = (s) => String(s || '').toLowerCase().replace(/^(ซอย|ถนน|ถ\.|ซ\.)\s*/, '').replace(/\b(soi|road|rd\.?|thanon)\b/g, '').replace(/[\s.\-_,]/g, '');
const segM = (lat, lng, a, b) => { const px = (lng - a[1]) * KX, py = (lat - a[0]) * KY, dx = (b[1] - a[1]) * KX, dy = (b[0] - a[0]) * KY, L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / L2)) : 0; return Math.hypot(px - t * dx, py - t * dy); };
const ptM = (a, b, c, d) => Math.hypot((b - d) * KX, (a - c) * KY);
const ck = (lat, lng) => Math.floor(lat / CELL) + ':' + Math.floor(lng / CELL);
const ROADS = DATA.roads.map((r, i) => ({ i, th: r.th || r.en, en: r.en || '', h: r.h, g: r.g, major: MAJOR.test(r.h), soiName: SOI_RE.test(r.th || '') || SOI_RE.test(r.en || '') }));
for (const r of ROADS) { r.isSoi = r.soiName || !r.major; r.isRoad = r.major && !r.soiName; }
const GRID = new Map(); const put = (k, v) => { let a = GRID.get(k); if (!a) GRID.set(k, (a = [])); a.push(v); };
for (const r of ROADS) for (let s = 1; s < r.g.length; s++) { const [a, b] = [r.g[s - 1], r.g[s]]; const ks = new Set(); const n = Math.max(1, Math.ceil(ptM(a[0], a[1], b[0], b[1]) / 100)); for (let t = 0; t <= n; t++) ks.add(ck(a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n)); for (const k of ks) put(k, [r, s]); }
const PGRID = new Map(); for (const p of DATA.pois) { const k = ck(p.lat, p.lng); let a = PGRID.get(k); if (!a) PGRID.set(k, (a = [])); a.push(p); }
const near = (grid, lat, lng, rings) => { const out = new Set(), cy = Math.floor(lat / CELL), cx = Math.floor(lng / CELL); for (let y = -rings; y <= rings; y++) for (let x = -rings; x <= rings; x++) for (const v of grid.get(cy + y + ':' + (cx + x)) || []) out.add(v); return out; };
const POI_RANK = { hospital: 1, police: 1, school: 2, university: 2, college: 2, place_of_worship: 2, townhall: 1, marketplace: 2, mall: 2, department_store: 2, fire_station: 1, stadium: 3, park: 3, pier: 2, bus_station: 2, supermarket: 3, fuel: 3, convenience: 4, hotel: 4 };

// nearest named way per name: [{ r, m }]
function nearestWays(lat, lng, maxM) {
  const best = new Map();
  for (const [r, s] of near(GRID, lat, lng, Math.ceil(maxM / 220))) { const m = segM(lat, lng, r.g[s - 1], r.g[s]); if (m > maxM) continue; const k = r.th; const b = best.get(k); if (!b || m < b.m) best.set(k, { r, m }); }
  return [...best.values()].sort((a, b) => a.m - b.m);
}
function offline(lat, lng) {
  if (lat == null || lng == null || !ROADS.length) return null;
  const ws = nearestWays(lat, lng, 300);
  const soi = ws.find((w) => w.r.isSoi && w.m <= 70);
  // main road: prefer the one the soi is numbered from ("พัทยาใต้ 24" → ถนนพัทยาใต้), else the nearest within 300 m
  const roads = ws.filter((w) => w.r.isRoad && (!soi || w.r.th !== soi.r.th)), base = (w) => norm(w.r.th).replace(/^ถนน/, '');
  const rd = (soi && roads.find((w) => base(w).length > 3 && norm(soi.r.th).includes(base(w)))) || roads[0];
  // standing right on a main road (closer than any soi): that road is the address, no soi
  const onRoad = rd && rd.m <= 25 && (!soi || rd.m < soi.m - 10);
  let lm = null, lmScore = 1e9;
  for (const p of near(PGRID, lat, lng, 1)) { const m = ptM(lat, lng, p.lat, p.lng); if (m > 150) continue; const sc = m + (POI_RANK[p.k] || 3) * 15; if (sc < lmScore) { lmScore = sc; lm = { ...p, m: Math.round(m) }; } }
  const S = onRoad ? null : soi;
  if (!S && !rd && !lm) return null;
  return { soi: S ? S.r.th : '', soiEn: S ? S.r.en : '', road: rd ? rd.r.th : '', roadEn: rd ? rd.r.en : '', landmark: lm ? lm.th || lm.en : '', landmarkEn: lm ? lm.en : '', landmarkM: lm ? lm.m : null, placeSrc: 'osm' };
}

// ---- Nominatim fallback (polite: 1 req/s, cached) ----
const UA = process.env.GEOCODE_UA || 'PattayaFloodAlert/1.0 (Pattaya City flood centre; ' + (process.env.GEOCODE_EMAIL || 'contact via pattaya.go.th') + ')';
const ON = process.env.GEOCODE_NOMINATIM !== '0';
let lastCall = 0, chain = Promise.resolve();
function nominatim(db, lat, lng) {
  db.geocache ||= {}; const key = lat.toFixed(4) + ',' + lng.toFixed(4);
  if (key in db.geocache) return Promise.resolve(db.geocache[key]);
  if (!ON) return Promise.resolve(null);
  const job = chain.then(async () => {
    if (key in db.geocache) return db.geocache[key];
    const wait = Math.max(0, lastCall + 1100 - Date.now()); if (wait) await new Promise((r) => setTimeout(r, wait)); lastCall = Date.now();
    try {
      const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=th`;
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(u, { headers: { 'user-agent': UA, referer: 'https://pattaya-flood-center.onrender.com/' }, signal: ac.signal }); clearTimeout(t);
      if (!r.ok) return null; const j = await r.json(); const a = j.address || {};
      const road = a.road || a.pedestrian || '', isSoi = SOI_RE.test(road);
      const out = { soi: isSoi ? road : '', soiEn: '', road: isSoi ? '' : road, roadEn: '', landmark: (j.category !== 'highway' && j.name && j.name !== road ? j.name : '') || a.amenity || a.shop || a.tourism || '', landmarkEn: '', landmarkM: null, placeSrc: 'nominatim' };
      const v = out.soi || out.road || out.landmark ? out : null; db.geocache[key] = v; return v;
    } catch { return null; }
  });
  chain = job.catch(() => {}); return job;
}

const FIELDS = ['soi', 'soiEn', 'road', 'roadEn', 'landmark', 'landmarkEn', 'landmarkM', 'placeSrc'];
const EMPTY = { soi: '', soiEn: '', road: '', roadEn: '', landmark: '', landmarkEn: '', landmarkM: null, placeSrc: 'none' };
async function lookup(db, lat, lng) { if (lat == null || lng == null) return { ...EMPTY }; return offline(lat, lng) || (await nominatim(db, lat, lng)) || { ...EMPTY }; }

// distinct street names along a polyline (road closures / detours)
function along(points) {
  const out = []; if (!Array.isArray(points)) return out;
  const step = Math.max(1, Math.floor(points.length / 12));
  for (let i = 0; i < points.length; i += step) { const w = nearestWays(points[i][0], points[i][1], 40)[0]; if (w && !out.includes(w.r.th)) out.push(w.r.th); }
  const L = points[points.length - 1]; if (L) { const w = nearestWays(L[0], L[1], 40)[0]; if (w && !out.includes(w.r.th)) out.push(w.r.th); }
  return out.slice(0, 6);
}

// searchable soi / road list (unique names, with a representative point)
// common English/Thai spellings so either script finds the soi (e.g. Soi Buakhao is tagged "พัทยาใต้ 22" in Thai)
const ALIAS = [['buakhao', 'บัวขาว'], ['khaotalo', 'เขาตาโล'], ['thappraya', 'ทัพพระยา'], ['thapphraya', 'ทัพพระยา'], ['thappra', 'ทัพพระยา'], ['jomtien', 'จอมเทียน'], ['sukhumvit', 'สุขุมวิท'], ['pattayaklang', 'พัทยากลาง'], ['centralpattaya', 'พัทยากลาง'], ['pattayanuea', 'พัทยาเหนือ'], ['northpattaya', 'พัทยาเหนือ'], ['pattayanua', 'พัทยาเหนือ'], ['pattayatai', 'พัทยาใต้'], ['southpattaya', 'พัทยาใต้'], ['secondroad', 'พัทยาสายสอง'], ['saisong', 'สายสอง'], ['beachroad', 'พัทยาสายหนึ่ง'], ['thepprasit', 'เทพประสิทธิ์'], ['chaiyapruek', 'ชัยพฤกษ์'], ['siam country club', 'สยามคันทรีคลับ'], ['naklua', 'นาเกลือ'], ['wongamat', 'วงศ์อมาตย์'], ['chalermphrakiat', 'เฉลิมพระเกียรติ'], ['phratamnak', 'พระตำหนัก'], ['nongprue', 'หนองปรือ'], ['bongkot', 'บงกช'], ['bongkoch', 'บงกช'], ['khopai', 'โขงปาย'], ['diana', 'ไดอาน่า'], ['lengkee', 'เล้งกี่'], ['honey', 'ฮันนี่'], ['wat boon', 'วัดบุญ'], ['mabprachan', 'มาบประชัน']].map(([a, b]) => [norm(a), b]);
const keyOf = (th, en) => { let k = norm(th) + '|' + norm(en); for (const [a, b] of ALIAS) { if (k.includes(a) && !k.includes(norm(b))) k += '|' + norm(b); if (k.includes(norm(b)) && !k.includes(a)) k += '|' + a; } return k; };
const LIST = (() => {
  const m = new Map();
  for (const r of ROADS) { const k = r.th; let e = m.get(k); const len = r.g.length; if (!e) m.set(k, (e = { th: r.th, en: r.en, kind: r.isRoad ? 'road' : 'soi', len: 0, pt: null })); if (!e.en && r.en) e.en = r.en; if (len > e.len) { e.len = len; const p = r.g[Math.floor(len / 2)]; e.pt = p; } }
  return [...m.values()].map((e) => ({ th: e.th, en: e.en, kind: e.kind, lat: e.pt[0], lng: e.pt[1], k: keyOf(e.th, e.en) }));
})();
const natural = (a, b) => a.th.localeCompare(b.th, 'th', { numeric: true });
function sois(q, limit = 30) {
  const n = norm(q); if (!n) return LIST.filter((x) => x.kind === 'road').sort(natural).slice(0, limit).map(({ k, ...x }) => x);
  const hits = LIST.filter((x) => x.k.includes(n));
  const pre = (x) => { const ps = x.k.split('|'); return ps.includes(n) ? 0 : ps.some((p) => p.startsWith(n)) ? 1 : 2; };
  hits.sort((a, b) => pre(a) - pre(b) || (a.kind === 'road' ? -1 : 0) - (b.kind === 'road' ? -1 : 0) || natural(a, b));
  return hits.slice(0, limit).map(({ k, ...x }) => x);
}
const byName = (u) => { const n = String(u || '').trim().toLowerCase(); if (!n) return null; const e = LIST.find((x) => x.th.toLowerCase() === n || (x.en && x.en.toLowerCase() === n)); return e ? { th: e.th, en: e.en, kind: e.kind } : null; };
const meta = { source: 'OpenStreetMap contributors (ODbL 1.0)', fetchedAt: DATA.fetchedAt, osmBase: DATA.osmBase, roads: DATA.roads.length, names: LIST.length, pois: DATA.pois.length, nominatim: ON };
const pois = (k) => DATA.pois.filter((p) => p.k === k && (p.th || p.en));
module.exports = { byName, offline, lookup, nominatim, along, sois, meta, pois, FIELDS, EMPTY };
