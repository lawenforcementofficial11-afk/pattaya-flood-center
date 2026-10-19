// Builds geo/pattaya-graph.json: the routable OSM road network for Pattaya (+ ~1.5 km margin) used by the in-app flood-avoidance router.
// One Overpass query, run rarely:  node scripts/build-graph.js   (data © OpenStreetMap contributors, ODbL 1.0)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'geo/pattaya-boundary.geojson'), 'utf8'));
const POLYS = B.geometry.type === 'MultiPolygon' ? B.geometry.coordinates : [B.geometry.coordinates];
let bb = [90, 180, -90, -180]; for (const p of POLYS) for (const [x, y] of p[0]) bb = [Math.min(bb[0], y), Math.min(bb[1], x), Math.max(bb[2], y), Math.max(bb[3], x)];
const pad = 0.014, box = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad].map((v) => v.toFixed(5)).join(',');
const HW = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian', 'footway', 'path', 'steps', 'track', 'cycleway'];
const Q = `[out:json][timeout:180];way["highway"~"^(${HW.join('|')})(_link)?$"]["area"!="yes"]["access"!~"^(private|no)$"]["service"!~"^(parking_aisle|driveway)$"](${box});out body geom;`;
(async () => {
  const res = await fetch('https://overpass.kumi.systems/api/interpreter', { method: 'POST', headers: { 'user-agent': 'PattayaFloodAlert/1.0 (routing graph build)', 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(Q) });
  if (!res.ok) throw new Error('overpass ' + res.status); const j = await res.json();
  const idx = new Map(), nodes = [], names = [''], nameIdx = new Map([['', 0]]), ways = [];
  const nid = (id, la, lo) => { let i = idx.get(id); if (i == null) { i = nodes.length / 2; idx.set(id, i); nodes.push(Math.round(la * 1e5), Math.round(lo * 1e5)); } return i; };
  for (const e of j.elements) { if (e.type !== 'way' || !e.geometry) continue; const t = e.tags || {}; const h = HW.indexOf(t.highway.replace(/_link$/, '')); if (h < 0) continue;
    const nm = t['name:th'] || t.name || ''; let ni = nameIdx.get(nm); if (ni == null) { ni = names.length; names.push(nm); nameIdx.set(nm, ni); }
    const ow = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0;
    ways.push([h, ow, ni, ...e.nodes.map((id, k) => nid(id, e.geometry[k].lat, e.geometry[k].lon))]); }
  const out = { source: 'OpenStreetMap contributors (ODbL 1.0) via Overpass API', fetchedAt: new Date().toISOString(), osmBase: j.osm3s?.timestamp_osm_base || '', hw: HW, names, nodes, ways };
  fs.writeFileSync(path.join(ROOT, 'geo/pattaya-graph.json'), JSON.stringify(out));
  console.log('ways', ways.length, 'nodes', nodes.length / 2, 'bytes', fs.statSync(path.join(ROOT, 'geo/pattaya-graph.json')).size);
})().catch((e) => { console.error(e.message); process.exit(1); });
