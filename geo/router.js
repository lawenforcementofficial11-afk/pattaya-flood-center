// In-app flood-avoidance router: OSM road graph (geo/pattaya-graph.json) + A* with per-vehicle hazard blocks/penalties.
// Data © OpenStreetMap contributors (ODbL 1.0). No turn restrictions; oneway honoured for vehicles.
const G = require('./pattaya-graph.json');
const N = G.nodes.length / 2, LAT = new Float64Array(N), LNG = new Float64Array(N);
for (let i = 0; i < N; i++) { LAT[i] = G.nodes[2 * i] / 1e5; LNG[i] = G.nodes[2 * i + 1] / 1e5; }
const MX = 108900, MY = 110900; // metres per degree (lng at ~12.9°N, lat)
const dist = (a, b, c, d) => Math.hypot((a - c) * MY, (b - d) * MX);
const HW = G.hw;
const VEH = {
  walk: { maxCm: 40, kmh: () => 5, deny: new Set(['motorway']), oneway: false, mode: 'walking' },
  moto: { maxCm: 30, kmh: (h) => Math.min(45, CAR[h] || 20), deny: new Set(['motorway', 'footway', 'path', 'steps', 'pedestrian', 'cycleway']), oneway: true, mode: 'driving' },
  car: { maxCm: 30, kmh: (h) => CAR[h] || 20, deny: new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'track']), oneway: true, mode: 'driving' },
  truck: { maxCm: 80, kmh: (h) => (CAR[h] || 20) * 0.8, deny: new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'track', 'living_street']), oneway: true, mode: 'driving' },
};
const CAR = { motorway: 80, trunk: 55, primary: 45, secondary: 40, tertiary: 35, unclassified: 30, residential: 25, living_street: 15, service: 15, track: 10, pedestrian: 5, footway: 5, path: 5, steps: 3, cycleway: 10 };
// edges (undirected storage): a, b, len, hw, name, ow
const EA = [], EB = [], EL = [], EH = [], EN = [], EO = [];
for (const w of G.ways) { const [h, ow, nm] = w; for (let k = 4; k < w.length; k++) { const a = w[k - 1], b = w[k]; if (a === b) continue; EA.push(a); EB.push(b); EL.push(dist(LAT[a], LNG[a], LAT[b], LNG[b])); EH.push(h); EN.push(nm); EO.push(ow); } }
const E = EA.length, ADJ = Array.from({ length: N }, () => []);
for (let e = 0; e < E; e++) { ADJ[EA[e]].push(e); ADJ[EB[e]].push(e); }
const allowed = (v, e) => !VEH[v].deny.has(HW[EH[e]]);
// grids: nodes (for snapping) and edges (for hazard intersection)
const CELL = 0.002, key = (la, ln) => Math.floor(la / CELL) * 100000 + Math.floor(ln / CELL);
const NG = new Map(), EG = new Map();
const put = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(v); };
for (let i = 0; i < N; i++) if (ADJ[i].length) put(NG, key(LAT[i], LNG[i]), i);
for (let e = 0; e < E; e++) { const ks = new Set([key(LAT[EA[e]], LNG[EA[e]]), key(LAT[EB[e]], LNG[EB[e]]), key((LAT[EA[e]] + LAT[EB[e]]) / 2, (LNG[EA[e]] + LNG[EB[e]]) / 2)]); for (const k of ks) put(EG, k, e); }
function near(m, la, ln, r) { const out = [], c = Math.ceil(r / (CELL * MY)) , a0 = Math.floor(la / CELL), b0 = Math.floor(ln / CELL); for (let i = -c; i <= c; i++) for (let j = -c; j <= c; j++) { const v = m.get((a0 + i) * 100000 + b0 + j); if (v) out.push(...v); } return out; }
function snap(la, ln, v) { for (const r of [300, 1000, 2500]) { let best = -1, bd = Infinity; for (const i of near(NG, la, ln, r)) { if (!ADJ[i].some((e) => allowed(v, e))) continue; const d = dist(la, ln, LAT[i], LNG[i]); if (d < bd) (bd = d), (best = i); } if (best >= 0) return { node: best, d: bd }; } return null; }
function segDist(la, ln, e) { // metres from point to edge segment
  const ax = (LNG[EA[e]] - ln) * MX, ay = (LAT[EA[e]] - la) * MY, bx = (LNG[EB[e]] - ln) * MX, by = (LAT[EB[e]] - la) * MY;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? -(ax * dx + ay * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(ax + t * dx, ay + t * dy);
}
// hazards: [{id,type:'report'|'closed'|'repeat', lat,lng,rM, cm, level, decay, soi, soiEn, road, roadEn, label, points?}]
// returns Map edge -> {hz:[indices], sev: max severity 0..1+, block:bool}
function hazardEdges(hz, v) {
  const max = VEH[v].maxCm, m = new Map();
  const add = (e, i, sev, block) => { let x = m.get(e); if (!x) m.set(e, (x = { hz: [], sev: 0, block: false })); if (!x.hz.includes(i)) x.hz.push(i); x.sev = Math.max(x.sev, sev); x.block = x.block || block; };
  hz.forEach((h, i) => {
    if (h.type === 'closed') { const P = h.points; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[k + 1] || P[k]; const n = Math.max(1, Math.ceil(dist(a[0], a[1], b[0], b[1]) / 10)); for (let s = 0; s <= n; s++) { const la = a[0] + (b[0] - a[0]) * s / n, ln = a[1] + (b[1] - a[1]) * s / n; for (const e of near(EG, la, ln, 25)) if (segDist(la, ln, e) < 18) add(e, i, 1, true); } } return; }
    const sev = h.type === 'repeat' ? 0.25 : Math.min(1.5, (h.cm / max)) * h.decay;
    const block = h.type === 'report' && h.cm > max && h.decay > 0.3;
    for (const e of near(EG, h.lat, h.lng, h.rM + 50)) { const d = segDist(h.lat, h.lng, e); if (d < h.rM) add(e, i, sev * (d < h.rM * 0.5 ? 1 : 0.6), block && d < h.rM * 0.75); }
  });
  return m;
}
class Heap { constructor() { this.k = []; this.v = []; } push(k, v) { const K = this.k, V = this.v; let i = K.length; K.push(k); V.push(v); while (i) { const p = (i - 1) >> 1; if (K[p] <= k) break; K[i] = K[p]; V[i] = V[p]; i = p; } K[i] = k; V[i] = v; }
  pop() { const K = this.k, V = this.v, top = V[0], lk = K.pop(), lv = V.pop(), n = K.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= lk) break; K[i] = K[c]; V[i] = V[c]; i = c; } K[i] = lk; V[i] = lv; } return top; } get size() { return this.k.length; } }
// search: A* (single target) or Dijkstra (target set). w = penalty weight; strict = obey blocks; extra = Map edge->multiplier
function search(v, src, targets, hzE, { w, strict, extra }) {
  const V = VEH[v], g = new Float64Array(N).fill(Infinity), pe = new Int32Array(N).fill(-1), done = new Uint8Array(N), tset = new Set(targets), single = targets.length === 1 ? targets[0] : -1;
  const vmax = 80 / 3.6, h = (i) => (single >= 0 ? dist(LAT[i], LNG[i], LAT[single], LNG[single]) / vmax : 0);
  const H = new Heap(); g[src] = 0; H.push(h(src), src); let hit = -1;
  while (H.size) { const u = H.pop(); if (done[u]) continue; done[u] = 1; if (tset.has(u)) { hit = u; break; }
    for (const e of ADJ[u]) { if (!allowed(v, e)) continue; const fwd = EA[e] === u, to = fwd ? EB[e] : EA[e];
      if (V.oneway && EO[e] && (EO[e] === 1) !== fwd) continue; if (done[to]) continue;
      const x = hzE.get(e); if (x && x.block && strict) continue;
      let c = EL[e] / (V.kmh(HW[EH[e]]) / 3.6); if (x) c *= 1 + w * x.sev + (x.block ? 50 : 0); if (extra && extra.has(e)) c *= extra.get(e);
      const ng = g[u] + c; if (ng < g[to]) { g[to] = ng; pe[to] = e; H.push(ng + h(to), to); } } }
  if (hit < 0) return null; const edges = []; let n = hit; while (n !== src) { const e = pe[n]; edges.push(e); n = EA[e] === n ? EB[e] : EA[e]; } edges.reverse(); return { edges, src, dst: hit };
}
const COLORS = ['#1a7f37', '#d4a017', '#e8590c', '#c92a2a'];
function describe(p, v, hz, hzE, from, to) {
  const V = VEH[v]; let node = p.src, distance = 0, duration = 0; const coords = [[LAT[node], LNG[node]]], segs = [], seen = new Map(), names = [];
  for (const e of p.edges) { const nx = EA[e] === node ? EB[e] : EA[e]; const x = hzE.get(e); const risk = !x ? 0 : x.block ? 3 : x.sev >= 0.6 ? 2 : 1;
    const pt = [LAT[nx], LNG[nx]]; const last = segs[segs.length - 1];
    if (last && last.risk === risk) last.coords.push(pt); else segs.push({ risk, color: COLORS[risk], coords: [[LAT[node], LNG[node]], pt] });
    if (x) for (const i of x.hz) if (!seen.has(i)) seen.set(i, { at: Math.round(distance), risk });
    distance += EL[e]; duration += EL[e] / (V.kmh(HW[EH[e]]) / 3.6); coords.push(pt); const nm = G.names[EN[e]]; if (nm && names[names.length - 1] !== nm) names.push(nm); node = nx; }
  const warnings = [...seen].map(([i, s]) => { const h = hz[i]; return { id: h.id, type: h.type, level: h.level || null, cm: h.cm || null, soi: h.soi || '', soiEn: h.soiEn || '', road: h.road || '', roadEn: h.roadEn || '', title: h.title || '', at: s.at, risk: s.risk, lat: h.lat, lng: h.lng, impassable: s.risk === 3 }; }).sort((a, b) => a.at - b.at);
  const riskPoints = warnings.filter((w) => w.type !== 'repeat').length, score = warnings.reduce((s, w) => s + (w.risk === 3 ? 10 : w.risk === 2 ? 3 : 1), 0);
  // Google Maps: up to 8 waypoints spread along the path (approximation of the safe route)
  const wp = [], k = Math.min(8, Math.max(0, Math.floor(distance / 400) - 1)); for (let i = 1; i <= k; i++) { const c = coords[Math.floor(coords.length * i / (k + 1))]; wp.push(c[0].toFixed(5) + ',' + c[1].toFixed(5)); }
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&travelmode=${V.mode}${wp.length ? '&waypoints=' + encodeURIComponent(wp.join('|')) : ''}`;
  return { distance: Math.round(distance), duration: Math.round(duration), riskPoints, score, impassable: warnings.some((w) => w.impassable), coords: coords.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]), segments: segs.map((s) => ({ ...s, coords: s.coords.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]) })), warnings, via: names.slice(0, 6), gmaps, edges: p.edges };
}
function overlap(a, b) { const s = new Set(a.edges); let L = 0, T = 0; for (const e of b.edges) { T += EL[e]; if (s.has(e)) L += EL[e]; } return T ? L / T : 1; }
function plan(from, to, v, hz) {
  if (!VEH[v]) v = 'car'; const s = snap(from[0], from[1], v), t = snap(to[0], to[1], v); if (!s || !t) return { error: 'nosnap' };
  const hzE = hazardEdges(hz, v); let strict = true; const run = (o) => search(v, s.node, [t.node], hzE, { strict, ...o });
  let safe = run({ w: 12 }); if (!safe) { strict = false; safe = run({ w: 12 }); }
  if (!safe) return { error: 'noroute' };
  const fast = run({ w: 0.15 }), extra = new Map(safe.edges.map((e) => [e, 1.6])), alt = run({ w: 4, extra });
  const out = []; for (const p of [safe, fast, alt]) { if (!p) continue; const d = describe(p, v, hz, hzE, from, to); if (out.some((o) => overlap(o, d) > 0.9)) continue; out.push(d); }
  const bySafe = [...out].sort((a, b) => a.score - b.score || a.duration - b.duration)[0], byFast = [...out].sort((a, b) => a.duration - b.duration)[0];
  out.forEach((r) => { r.tags = []; if (r === bySafe) r.tags.push('safest'); if (r === byFast) r.tags.push('fastest'); if (!r.tags.length) r.tags.push('alt'); delete r.edges; });
  out.sort((a, b) => (b.tags.includes('safest') - a.tags.includes('safest')) || a.duration - b.duration);
  return { ok: true, veh: v, maxCm: VEH[v].maxCm, strict, snapped: { from: s.d | 0, to: t.d | 0 }, routes: out };
}
// nearest of candidate places [{lat,lng,...}] by safe cost; returns index or -1
function nearest(from, v, cands, hz) {
  if (!VEH[v]) v = 'car'; const s = snap(from[0], from[1], v); if (!s) return -1; const hzE = hazardEdges(hz, v), map = new Map();
  cands.forEach((c, i) => { const t = snap(c.lat, c.lng, v); if (t && t.d < 400 && !map.has(t.node)) map.set(t.node, i); }); if (!map.size) return -1;
  const p = search(v, s.node, [...map.keys()], hzE, { w: 12, strict: true }) || search(v, s.node, [...map.keys()], hzE, { w: 12, strict: false });
  return p ? map.get(p.dst) : -1;
}
const meta = { source: G.source, osmBase: G.osmBase, fetchedAt: G.fetchedAt, nodes: N, edges: E, vehicles: Object.fromEntries(Object.entries(VEH).map(([k, x]) => [k, x.maxCm])) };
module.exports = { plan, nearest, meta, VEH };
