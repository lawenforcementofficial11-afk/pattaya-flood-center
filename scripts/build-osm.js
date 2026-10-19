// Builds geo/pattaya-osm.json: named roads/sois + landmark POIs inside the Pattaya City boundary (+300 m),
// fetched ONCE from the public Overpass API (OpenStreetMap data, © OSM contributors, ODbL 1.0).
// Run manually when the data needs refreshing:  node scripts/build-osm.js
// Respect Overpass usage policy: one query, run rarely, identify yourself via User-Agent.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'geo/pattaya-boundary.geojson'), 'utf8'));
const POLYS = B.geometry.type === 'MultiPolygon' ? B.geometry.coordinates : [B.geometry.coordinates];
let bb = [90, 180, -90, -180]; for (const p of POLYS) for (const [x, y] of p[0]) bb = [Math.min(bb[0], y), Math.min(bb[1], x), Math.max(bb[2], y), Math.max(bb[3], x)];
const pad = 0.004, box = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad].map((v) => v.toFixed(5)).join(',');
const ringHas = (r, lat, lng) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segM = (lat, lng, [x1, y1], [x2, y2]) => { const kx = 108500, ky = 111000, px = (lng - x1) * kx, py = (lat - y1) * ky, dx = (x2 - x1) * kx, dy = (y2 - y1) * ky, L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / L2)) : 0; return Math.hypot(px - t * dx, py - t * dy); };
const inside = (lat, lng, buf = 300) => { for (const p of POLYS) { if (ringHas(p[0], lat, lng)) return true; const r = p[0]; for (let i = 1; i < r.length; i++) if (segM(lat, lng, r[i - 1], r[i]) <= buf) return true; } return false; };
const SKIP = /^(footway|path|steps|cycleway|bridleway|corridor|platform|proposed|construction|elevator|via_ferrata)$/;
const Q = `[out:json][timeout:180];
(way["highway"]["name"](${box});way["highway"]["name:th"](${box});)->.r; .r out tags geom;
(nwr["name"]["amenity"~"^(school|college|university|kindergarten|hospital|clinic|police|fire_station|place_of_worship|marketplace|fuel|townhall|bus_station|community_centre|post_office|bank)$"](${box});
 nwr["name"]["shop"~"^(mall|supermarket|department_store|convenience)$"](${box});
 nwr["name"]["tourism"~"^(hotel|attraction|museum|viewpoint)$"](${box});
 nwr["name"]["leisure"~"^(park|stadium|sports_centre)$"](${box});
 nwr["name"]["man_made"="pier"](${box}););
out tags center;`;
const r5 = (v) => Math.round(v * 1e5) / 1e5, latin = (s) => /^[\x00-\x7F]+$/.test(s || '');
(async () => {
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'user-agent': 'PattayaFloodAlert/1.0 (Pattaya City flood centre; offline soi index build)', 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(Q) });
  if (!res.ok) throw new Error('overpass ' + res.status + ' ' + (await res.text()).slice(0, 300));
  const j = await res.json(); const roads = [], pois = [], seen = new Set();
  for (const e of j.elements) {
    const t = e.tags || {};
    const th = t['name:th'] || (latin(t.name) ? '' : t.name) || '', en = t['name:en'] || (latin(t.name) ? t.name : '') || '';
    if (!th && !en) continue;
    if (e.type === 'way' && t.highway && e.geometry) {
      if (SKIP.test(t.highway) || seen.has('w' + e.id)) continue; seen.add('w' + e.id);
      const g = e.geometry.map((p) => [r5(p.lat), r5(p.lon)]); if (!g.some(([a, b]) => inside(a, b))) continue;
      roads.push({ th, en, h: t.highway, g });
    } else {
      const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon; if (lat == null || !inside(lat, lng, 150)) continue;
      const k = t.amenity || t.shop || t.tourism || t.leisure || t.man_made; if (seen.has(e.type[0] + e.id)) continue; seen.add(e.type[0] + e.id);
      pois.push({ th, en, k, lat: r5(lat), lng: r5(lng) });
    }
  }
  const out = { source: 'OpenStreetMap contributors (ODbL 1.0) via Overpass API', fetchedAt: new Date().toISOString(), osmBase: j.osm3s?.timestamp_osm_base || '', bbox: box, roads, pois };
  fs.writeFileSync(path.join(ROOT, 'geo/pattaya-osm.json'), JSON.stringify(out));
  console.log('roads', roads.length, 'pois', pois.length, 'bytes', fs.statSync(path.join(ROOT, 'geo/pattaya-osm.json')).size, 'base', out.osmBase);
})().catch((e) => { console.error(e.message); process.exit(1); });
