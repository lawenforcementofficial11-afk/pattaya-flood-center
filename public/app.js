// ศูนย์ช่วยเหลือน้ำท่วมเมืองพัทยา — SPA (hash routing). ข้อความทั้งหมดผ่าน T('key','ค่าเริ่มต้น') แก้ไขได้ในระบบหลังบ้าน /admin
const $ = (s, r = document) => r.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const C = { cfg: null }, CENTER = [12.9236, 100.8825];
const T = (k, d) => esc(C.cfg?.texts?.[k] ?? d);
// ---------- language (TH default · EN · 中文) ----------
const LANGS = ['th', 'en', 'zh'], LOCALE = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN' };
const LANG = (() => { const q = new URLSearchParams(location.search).get('lang'); let l = q && LANGS.includes(q) ? q : localStorage.getItem('pfc_lang');
  if (!LANGS.includes(l)) { const n = (navigator.languages || [navigator.language || '']).map((x) => String(x).toLowerCase()); l = n.find((x) => /^(th|en|zh)/.test(x))?.slice(0, 2) || 'th'; }
  localStorage.setItem('pfc_lang', l); document.cookie = 'pfc_lang=' + l + ';path=/;max-age=31536000;samesite=lax';
  if (document.documentElement.dataset.lang && document.documentElement.dataset.lang !== l && !sessionStorage.getItem('pfc_lr')) { sessionStorage.setItem('pfc_lr', 1); location.reload(); }
  sessionStorage.removeItem('pfc_lr'); document.documentElement.lang = { th: 'th', en: 'en', zh: 'zh-CN' }[l]; return l; })();
const setLang = (l) => { localStorage.setItem('pfc_lang', l); document.cookie = 'pfc_lang=' + l + ';path=/;max-age=31536000;samesite=lax'; const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); };
(() => { const d = document.createElement('div'); d.className = 'langsw'; d.innerHTML = [['th', 'TH'], ['en', 'EN'], ['zh', '中文']].map(([l, n]) => `<button type="button" data-l="${l}" class="${l === LANG ? 'on' : ''}" aria-pressed="${l === LANG}">${n}</button>`).join('');
  d.onclick = (e) => e.target.dataset.l && e.target.dataset.l !== LANG && setLang(e.target.dataset.l); document.querySelector('header.top').insertBefore(d, document.querySelector('#live')); })();
const DEV = localStorage.getItem('pfc_dev') || (localStorage.setItem('pfc_dev', (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now())), localStorage.getItem('pfc_dev'));
// ---------- anti-spam helpers: honeypot + fill time + optional Turnstile ----------
let formStart = Date.now();
const SUBMIT = /^\/api\/(reports|requests|missing|lostfound)$/;
function armForm() { formStart = Date.now(); const go = document.querySelector('#go'); if (!go || !SUBMIT.test(go.dataset.api || '') && !document.querySelector('[data-pub]')) return;
  if (!document.querySelector('#website')) go.insertAdjacentHTML('beforebegin', '<div class="hp" aria-hidden="true"><label>Website<input id="website" name="website" tabindex="-1" autocomplete="off"></label></div>');
  const sk = C.cfg?.turnstileSiteKey; if (sk && !document.querySelector('#cfw')) { go.insertAdjacentHTML('beforebegin', '<div id="cfw" style="margin:8px 0"></div>');
    const draw = () => window.turnstile && window.turnstile.render('#cfw', { sitekey: sk, language: LANG === 'zh' ? 'zh-cn' : LANG });
    if (window.turnstile) draw(); else { const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.onload = draw; document.head.appendChild(sc); } } }
const api = async (u, o = {}) => { if (o.body && SUBMIT.test(u)) { o.body = { ...o.body, website: document.querySelector('#website')?.value || '', _ft: Date.now() - formStart, _dev: DEV, cfToken: window.turnstile && document.querySelector('#cfw') ? window.turnstile.getResponse('#cfw') : undefined }; }
  const r = await fetch(u, { headers: { 'content-type': 'application/json', 'x-lang': LANG, 'x-device-id': DEV }, credentials: 'same-origin', ...o, body: o.body && JSON.stringify(o.body) });
  if (SUBMIT.test(u) && window.turnstile && document.querySelector('#cfw')) try { window.turnstile.reset('#cfw'); } catch {} const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
const fmt = (iso) => iso ? new Date(iso.replace(' ', 'T') + (iso.length <= 16 ? ':00+07:00' : '')).toLocaleString(LOCALE[LANG], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ' + T('nav.timesuffix', 'น.') : '-';
const tel = (p) => p ? `<a class="tel" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">📞 ${esc(p)}</a>` : `<span class="ph">${T('nav.nophone', 'รอใส่เบอร์')}</span>`;
// ---------- moderation (hybrid): badges + citizen confirm / "no longer flooded" votes ----------
const modBadge = (r) => (r.mod === 'pending' ? `<span class="mbadge pend">${T('mod.pending', 'รอตรวจสอบ')}</span>` : r.mod === 'verified' ? `<span class="mbadge ver">${T('mod.verified', '✔ ยืนยันแล้ว')}</span>` : '') + (r.cleared ? ` <span class="mbadge clr">${T('mod.cleared', 'อาจไม่ท่วมแล้ว')}</span>` : '');
const voteBtns = (r) => { const done = JSON.parse(localStorage.getItem('pfc_votes') || '{}')[r.id];
  return `<div class="votes" data-rid="${esc(r.id)}"><button type="button" class="vbtn yes" data-vote="yes" ${done ? 'disabled' : ''}>${T('mod.vote.yes', '👍 ยืนยันว่าจริง')}${r.yes ? ' (' + r.yes + ')' : ''}</button><button type="button" class="vbtn no" data-vote="no" ${done ? 'disabled' : ''}>${T('mod.vote.no', '🌤️ ไม่พบน้ำท่วมแล้ว')}${r.no ? ' (' + r.no + ')' : ''}</button>${done ? `<div class="muted vmsg">${T('mod.vote.done', 'ขอบคุณ — บันทึกการยืนยันของคุณแล้ว')}</div>` : '<div class="muted vmsg"></div>'}</div>`; };
document.addEventListener('click', async (e) => { const b = e.target.closest?.('[data-vote]'); if (!b) return; const box = b.closest('[data-rid]'), id = box.dataset.rid;
  box.querySelectorAll('button').forEach((x) => (x.disabled = true));
  try { await api('/api/reports/' + encodeURIComponent(id) + '/vote', { method: 'POST', body: { v: b.dataset.vote } }); const v = JSON.parse(localStorage.getItem('pfc_votes') || '{}'); v[id] = b.dataset.vote; localStorage.setItem('pfc_votes', JSON.stringify(v)); $('.vmsg', box).textContent = C.cfg?.texts?.['mod.vote.done'] || 'ขอบคุณ — บันทึกการยืนยันของคุณแล้ว'; }
  catch (err) { $('.vmsg', box).innerHTML = `<span class="err">${esc(err.message)}</span>`; if (/429/.test(err.message)) box.querySelectorAll('button').forEach((x) => (x.disabled = false)); } });
const modMsg = (r) => (r.mod === 'held' || (r.mod === 'pending' && r.public === false) ? `<p class="muted">${T('mod.msg.held', 'รายงานของคุณจะแสดงต่อสาธารณะหลังเจ้าหน้าที่ตรวจสอบ')}</p>` : r.mod === 'pending' ? `<p class="muted">${T('mod.msg.pending', 'แสดงบนแผนที่แล้วในสถานะ "รอตรวจสอบ" — จะยืนยันเมื่อมีผู้อื่นยืนยันหรือเจ้าหน้าที่ตรวจสอบ')}</p>` : '');
// ---------- icon set (inline SVG, Lucide-style strokes; no emoji) ----------
const IC = { sos: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  evac: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>', help: '<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  med: '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"/>',
  water: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>', map: '<path d="M14.1 6 9.9 4 3 7v13l6.9-3 4.2 2L21 16V3z"/><path d="M9.9 4v13"/><path d="M14.1 6v13"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', cctv: '<path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>', home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  rain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>' };
const ico = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k] || ''}</svg>`;
const LVCOL = { dry: '#16a34a', ankle: '#ca8a04', knee: '#ea580c', waist: '#dc2626', chest: '#9f1239', roof: '#4c0519' };
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 108.5);
const stName = (s) => esc(C.cfg?.statusNames?.[s] || s);
async function cfg(force) { if (!C.cfg || force) { C.cfg = await api('/api/config'); chrome(); } return C.cfg; }
function chrome() {
  const s = C.cfg.settings || {}, b = s.banner || {};
  $('#banner').innerHTML = b.on && b.text ? `<div class="banner ${esc(b.level)}">${esc(b.text)}</div>` : '';
  $('#ebar').innerHTML = `<div class="ebar"><span class="ebl">${ico('phone')} ${T('site.ebar', 'ฉุกเฉิน โทร')}</span><a href="tel:1669"><b>1669</b><small>${T('site.ebar.1669', 'เจ็บป่วยฉุกเฉิน')}</small></a><a href="tel:1784"><b>1784</b><small>${T('site.ebar.1784', 'ปภ. ภัยพิบัติ')}</small></a><a href="tel:1337"><b>1337</b><small>${T('site.ebar2', '(เมืองพัทยา)')}</small></a></div>`;
  const bn = $('#bnav'); if (bn) { const cur = location.hash.replace(/^#\/?/, '').split('?')[0];
    bn.innerHTML = [['', 'home', T('bnav.home', 'หน้าหลัก')], ['report', 'water', T('bnav.report', 'แจ้งน้ำท่วม')], ['help?kind=evacuate', 'sos', T('bnav.help', 'ขอช่วยเหลือ'), 'red'], ['map', 'map', T('bnav.map', 'แผนที่')], ['status', 'search', T('bnav.status', 'ติดตามเคส')]]
      .map(([h, i, l, c]) => `<a href="#/${h}" class="${c || ''} ${cur === h.split('?')[0] ? 'on' : ''}">${ico(i)}<span>${l}</span></a>`).join(''); }
}
function tiles(m) { L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const g = C.cfg?.geo; if (g?.boundary) { const [s, w, n, e] = g.bbox; m.setMaxBounds([[s - 0.06, w - 0.08], [n + 0.06, e + 0.08]]); m.options.minZoom = 11;
    L.geoJSON(g.boundary, { interactive: false, style: { color: '#0e7490', weight: 3, dashArray: '8 6', fill: true, fillOpacity: 0.03 } }).addTo(m)
      .bindTooltip?.(T('geo.label', 'เขตเมืองพัทยา')); }
  return m; }
// point-in-polygon against the Pattaya City boundary (server re-checks with the admin buffer)
const inCity = (lat, lng) => { const g = C.cfg?.geo; if (!g?.on || !g.boundary) return true; const P = g.boundary.type === 'MultiPolygon' ? g.boundary.coordinates : [g.boundary.coordinates];
  const has = (r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c; };
  return P.some((p) => has(p[0])); };
async function photoData(input) { const f = input.files?.[0]; if (!f) return null; const img = await createImageBitmap(f); const s = Math.min(1, 1280 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.75); }
function gps() { return new Promise((ok, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), () => no(new Error(T('err.gpsdenied', 'ไม่ได้รับอนุญาตตำแหน่ง'))), { enableHighAccuracy: true, timeout: 10000 }) : no(new Error(T('err.nogps', 'อุปกรณ์ไม่รองรับ GPS')))); }
async function geocode(q) { const [s, w, n, e] = C.cfg?.geo?.bbox || [12.75, 100.7, 13.1, 101.1];
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=10&countrycodes=th&viewbox=${w},${n},${e},${s}&bounded=1&accept-language=${LANG === 'zh' ? 'zh,en' : LANG}&q=${encodeURIComponent(q)}`); return (await r.json()).filter((x) => inCity(+x.lat, +x.lon)).slice(0, 5); }
const back = () => `<p><a href="#/">${T('nav.back', '← กลับหน้าหลัก')}</a></p>`;
const title = (k, d) => { document.title = (C.cfg?.texts?.[k] || d) + ' | ' + (C.cfg?.texts?.['site.name'] || 'ศูนย์ช่วยเหลือน้ำท่วม'); };

// ---------- SSE ----------
const listeners = new Set(); const on = (fn) => { listeners.add(fn); return fn; };
(function sse() { const es = new EventSource('/api/events'); const live = $('#live'); const txt = live.textContent;
  es.onopen = () => { live.className = 'live'; live.textContent = txt; }; es.onerror = () => { live.className = 'live off'; live.textContent = C.cfg?.texts?.['site.offline'] || '● ออฟไลน์'; };
  for (const t of ['report', 'request', 'roads', 'contacts', 'deleted', 'lostfound', 'cms', 'staff:request', 'staff:update', 'staff:missing', 'staff:report', 'staff:lostfound']) es.addEventListener(t, async (e) => { const d = JSON.parse(e.data); if (t === 'contacts') C.cfg && (C.cfg.contacts = d); if (t === 'cms') { await cfg(true); if (!location.hash.startsWith('#/staff')) return render(); } listeners.forEach((f) => f(t, d)); });
})();

// ---------- pages ----------
const routes = {
  '': home, sos: (q) => helpForm('food'), help: (q) => helpForm(q.kind || 'evacuate'), report, status, area, map: mapPage, updates, missing, 'lost-found': lostFound, cctv, weather, staff: staffPage, admin: () => { location.href = '/admin'; },
};
async function render() { listeners.clear(); const [p, qs] = location.hash.replace(/^#\/?/, '').split('?'); const q = Object.fromEntries(new URLSearchParams(qs || '')); window.scrollTo(0, 0); app.innerHTML = `<p class="muted">${C.cfg ? T('nav.loading', 'กำลังโหลด…') : '…'}</p>`; try { await cfg(); chrome(); await (routes[p] || home)(q); document.querySelector('#go')?.setAttribute('data-pub', ''); if (['report', 'sos', 'help', 'missing', 'lost-found'].includes(p)) armForm(); } catch (e) { app.innerHTML = `<p class="err">${esc(e.message)}</p>` + back(); } }
addEventListener('hashchange', render); render();

async function home() {
  const cf = await cfg(), c = cf.contacts; const served = c.areas.filter((a) => a.served).map((a) => a.name);
  document.title = cf.texts?.['site.title'] || 'ศูนย์ช่วยเหลือน้ำท่วมเมืองพัทยา | ระดับน้ำ ขอความช่วยเหลือ';
  const S = {
   actions: `<section class="actions" aria-label="${T('home.actions.label', 'บริการหลัก')}">${[
     ['#/help?kind=evacuate', 'evac', 'red', T('home.act.evac', 'ขออพยพ / ติดอยู่'), T('home.act.evac.d', 'ส่งตำแหน่งให้ทีมกู้ภัยทันที')],
     ['#/help?kind=medical', 'med', 'red', T('home.act.med', 'ผู้ป่วย / ต้องการยา'), T('home.act.med.d', 'แจ้งผู้ป่วยติดเตียง ยาขาด')],
     ['#/sos', 'help', 'orange', T('home.act.help', 'ขอความช่วยเหลือ'), T('home.act.help.d', 'อาหาร น้ำดื่ม ถุงยังชีพ')],
     ['#/report', 'water', 'sea', T('home.act.report', 'แจ้งน้ำท่วม'), T('home.act.report.d', 'บอกระดับน้ำตรงที่คุณอยู่')],
     ['#/map', 'route', 'sea', T('home.act.route', 'เส้นทางเลี่ยงน้ำ'), T('home.act.route.d', 'หาเส้นทางที่ไม่ผ่านจุดท่วม')],
     ['#/map', 'map', 'sea', T('home.act.map', 'แผนที่น้ำท่วม'), T('home.act.map.d', 'จุดท่วม จุดเสี่ยง ถนนปิด')],
     ['#/?emg', 'phone', 'sand', T('home.act.phone', 'เบอร์โทรสำคัญ'), T('home.act.phone.d', 'โรงพยาบาล กู้ภัย เทศกิจ')],
     ['#/status', 'search', 'sand', T('home.act.status', 'ติดตามเคส'), T('home.act.status.d', 'เลขเคส + เบอร์ 4 ตัวท้าย')],
     ['#/cctv', 'cctv', 'sand', T('home.act.cctv', 'กล้อง CCTV'), T('home.act.cctv.d', 'ดูสภาพถนนสด')],
     ['#/updates', 'clock', 'sand', T('home.act.updates', 'อัปเดตล่าสุด'), T('home.act.updates.d', 'รายงานน้ำจากประชาชน')],
     ['#/missing', 'users', 'sand', T('home.act.missing', 'ตามหาคน'), T('home.act.missing.d', 'ญาติติดต่อไม่ได้')],
     ['#/lost-found', 'tag', 'sand', T('home.act.lf', 'ของหาย–ได้คืน'), T('home.act.lf.d', 'สัตว์เลี้ยง เอกสาร')],
   ].map(([h, i, c, t, d]) => `<a class="act ${c}" href="${h}"${h === '#/?emg' ? ' onclick="event.preventDefault();document.getElementById(\'emg\')?.scrollIntoView({behavior:\'smooth\'})"' : ''}>${ico(i)}<b>${t}</b><small>${d}</small></a>`).join('')}</section>`,
   food: `<a class="card big food" href="#/sos"><h2>${T('home.food.title', '🍚 ขออาหาร / ถุงยังชีพ')}</h2><div>${T('home.food.desc', 'ข้าว น้ำดื่ม ถุงยังชีพ ยา อาหารหมาแมว กรอกสั้น ๆ ส่งถึงผู้ประสานงานพื้นที่ของคุณ')}</div><div class="muted">${T('home.food.served', 'เปิดรับเฉพาะ:')} ${esc(served.join(' · '))}</div></a>`,
   contact: `<div class="grid two">
   <div class="card"><h2>${T('home.contact.title', '☎️ ติดต่อเทศบาล / ผู้ประสานงานพื้นที่')}</h2><div class="muted">${T('home.contact.desc', 'เลือกพื้นที่ของคุณ แล้วโทรหาผู้ประสานงานประจำพื้นที่ได้เลย')}</div>
    <select id="areaSel"><option value="">${T('home.contact.select', '— เลือกพื้นที่ —')}</option>${c.areas.map((a) => `<option value="${a.id}">${esc(a.name)} (${esc(a.org)})</option>`).join('')}</select><div id="areaOut"></div></div>
   <div class="card"><h2>${T('home.health.title', '🩺 ผู้ป่วย ติดต่อหมอ')}</h2><div class="muted">${T('home.health.desc', 'เบอร์โรงพยาบาลและสาธารณสุขอำเภอบางละมุง')}</div><ul class="list">${c.health.map((h) => `<li><span>${esc(h.name)}<br><span class="muted">${esc(h.note || '')}</span></span>${tel(h.phone)}</li>`).join('')}</ul></div></div>`,
   sos: `<div class="card sos" style="text-align:center">${T('home.sos.text', 'ติดอยู่ต้องอพยพ หรือเจ็บป่วยฉุกเฉิน โทร')} <a href="tel:1669">1669</a>·<a href="tel:1784">1784</a> · ${T('home.sos.pattaya', 'พัทยา')} <a href="tel:1337">1337</a><br><a href="#/help?kind=evacuate" style="font-size:15px">${T('home.sos.web', 'หรือแจ้งขออพยพทางเว็บ →')}</a></div>`,
   report: `<a class="card big report" href="#/report"><h2>${T('home.report.title', '📏 รายงานระดับน้ำ')}</h2><div class="muted">${T('home.report.desc', 'บอกว่าน้ำสูงแค่ไหนตรงที่คุณอยู่ ใช้เวลาไม่ถึงนาที')}</div></a>`,
   near: `<div class="card"><h2>${T('home.near.title', '📍 น้ำท่วมใกล้บ้านฉันไหม?')}</h2><button class="btn" id="near">${T('home.near.btn', 'ตรวจใกล้ฉัน')}</button> <select id="nearArea" style="width:auto"><option value="">${T('home.near.select', 'หรือเลือกพื้นที่')}</option>${c.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><div id="nearOut"></div><div class="muted">${T('home.near.privacy', 'ตำแหน่งใช้คำนวณในเครื่องของคุณเท่านั้น ไม่ถูกส่งไปเก็บ')}</div></div>`,
   services: `<div class="card svc"><h2>${T('home.svc.title', 'บริการอื่น')}</h2>
   <a href="#/map"><b>${T('home.svc.map', '🗺️ แผนที่น้ำท่วม + เส้นทางเลี่ยง')}</b><br><span class="muted">${T('home.svc.map.d', 'จุดน้ำท่วม คำขอช่วยเหลือ ถนนปิด และหาเส้นทางเลี่ยงน้ำ')}</span></a>
   <a href="#/status"><b>${T('home.svc.status', '🔎 เช็กสถานะเคส')}</b><br><span class="muted">${T('home.svc.status.d', 'ใช้เลขเคสกับเบอร์โทร 4 ตัวท้าย')}</span></a>
   <a href="#/area"><b>${T('home.svc.area', '🏘️ พื้นที่ของฉัน')}</b><br><span class="muted">${T('home.svc.area.d', 'สีแต่ละพื้นที่ตามระดับน้ำที่ประชาชนรายงาน')}</span></a>
   <a href="#/updates"><b>${T('home.svc.updates', '🕒 อัปเดตระดับน้ำล่าสุด')}</b><br><span class="muted">${T('home.svc.updates.d', 'ใครรายงานอะไร ที่ไหน เรียงจากล่าสุด')}</span></a>
   <a href="#/missing"><b>${T('home.svc.missing', '🧑‍🤝‍🧑 ตามหาคน')}</b><br><span class="muted">${T('home.svc.missing.d', 'ญาติติดต่อไม่ได้ แจ้งศูนย์ช่วยตามหา (ไม่ประกาศสาธารณะ)')}</span></a>
   <a href="#/lost-found"><b>${T('home.svc.lf', '🐾 ของหาย–ได้คืน')}</b><br><span class="muted">${T('home.svc.lf.d', 'ตามหาสัตว์เลี้ยง เอกสาร ของมีค่า หรือประกาศของที่เก็บได้')}</span></a>
   <a href="#/cctv"><b>${T('home.svc.cctv', '📹 กล้อง CCTV')}</b><br><span class="muted">${T('home.svc.cctv.d', 'ลิงก์กล้องสาธารณะ (เปิดเว็บต้นทาง)')}</span></a></div>`,
   situation: `<div class="card"><h2>${T('home.sit.title', '🌧️ สถานการณ์น้ำตอนนี้')}</h2><div id="fc">${T('home.sit.loadingfc', 'กำลังโหลดพยากรณ์…')}</div><h3>${T('home.sit.water', 'ระดับน้ำในแม่น้ำและคลอง เทียบกับตลิ่ง')}</h3><div id="wl">${T('nav.loading', 'กำลังโหลด…')}</div><h3>${T('home.sit.rain', 'ฝนสะสม 24 ชม. สถานีโทรมาตรใกล้พัทยา')}</h3><div id="rn">${T('nav.loading', 'กำลังโหลด…')}</div>
   <p class="muted">${T('home.sit.source', 'ข้อมูลระดับน้ำ: คลังข้อมูลน้ำแห่งชาติ (สสน.) · พยากรณ์: Open-Meteo')} · <a href="#/weather">${T('home.sit.more', 'ดูรายละเอียด')}</a></p></div>`,
   moreinfo: `<div class="card svc"><h2>${T('home.more.title', 'ดูข้อมูลน้ำและอากาศเพิ่มเติม')}</h2>
   <a href="#/weather"><b>${T('home.more.weather', 'พยากรณ์อากาศ ฝน ลม')}</b><br><span class="muted">${T('home.more.weather.d', 'กราฟรายชั่วโมง 24 ชม. และเรดาร์ฝน')}</span></a>
   ${(cf.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener"><b>${esc(l.title)}</b><br><span class="muted">${esc(l.note || '')}</span></a>`).join('')}
   <p class="muted">${T('home.more.note', 'เปิดในแท็บใหม่ ข้อมูลเป็นของเจ้าของเว็บแต่ละแห่ง')}</p></div>`,
   emergency: `<div class="card" id="emg"><h2>${T('home.emg.title', '📞 เบอร์ฉุกเฉิน')}</h2><ul class="list">${c.emergency.map((h) => `<li><span>${esc(h.name)}</span>${tel(h.phone)}</li>`).join('')}</ul>
   <p class="muted">${T('home.emg.note1', 'รับแจ้งทางเว็บเฉพาะ')} ${esc(served.join(', '))} ${T('home.emg.note2', 'พื้นที่อื่นโทรเบอร์ฉุกเฉินด้านบน')}</p></div>`,
   stafflink: `<p style="text-align:center"><a class="btn alt" href="#/staff">${T('home.stafflink', '👮 เจ้าหน้าที่และทีมกู้ภัย เข้าสู่ระบบ')}</a></p>`,
  };
  const order = (cf.settings?.sections || Object.keys(S).map((id) => ({ id, on: true }))).filter((s) => s.on && S[s.id]);
  app.innerHTML = order.map((s, i) => `<div class="sec" data-sec="${s.id}" style="${i ? 'margin-top:12px' : ''}">${S[s.id]}</div>`).join('');
  if ($('#areaSel')) $('#areaSel').onchange = (e) => { const a = c.areas.find((x) => x.id === e.target.value); $('#areaOut').innerHTML = a ? `<ul class="list"><li><span><b>${esc(a.coordinator)}</b><br><span class="muted">${esc(a.org)}${a.verified ? ' · ' + T('home.contact.verified', '✔ ตรวจสอบจาก') + ' ' + esc(a.source || '') : ''}</span></span>${tel(a.phone)}</li></ul>${a.phone ? '' : `<p class="muted">${T('home.contact.nophone', 'ยังไม่มีเบอร์ผู้ประสานงานพื้นที่นี้ — โทร 1337 (เมืองพัทยา) หรือ 1784')}</p>`}` : ''; };
  const nearCheck = async (lat, lng) => { const rs = await api('/api/reports?hours=24'); const n = rs.filter((r) => km(lat, lng, r.lat, r.lng) < 1.5); const bad = n.filter((r) => r.cm >= 30);
    $('#nearOut').innerHTML = `<p>${n.length ? `${T('home.near.res1', 'ใน 1.5 กม. มี')} <b>${n.length}</b> ${T('home.near.res2', 'รายงานใน 24 ชม.')} ${bad.length ? `<span class="err">· ${T('home.near.bad', 'น้ำสูงเกินข้อเท้า')} ${bad.length} ${T('home.near.points', 'จุด')}</span>` : `<span class="ok">· ${T('home.near.good', 'ไม่มีจุดน้ำสูง')}</span>`}` : `<span class="ok">${T('home.near.none', 'ยังไม่มีรายงานน้ำท่วมใน 1.5 กม. (24 ชม.)')}</span>`} · <a href="#/map">${T('home.near.map', 'ดูแผนที่')}</a></p>`; };
  if ($('#near')) { $('#near').onclick = async () => { try { const [a, b] = await gps(); nearCheck(a, b); } catch (e) { $('#nearOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
    $('#nearArea').onchange = (e) => { const a = c.areas.find((x) => x.id === e.target.value); a && nearCheck(a.lat, a.lng); }; }
  if ($('#fc')) { loadForecast($('#fc')); loadWater($('#wl')); loadRain($('#rn')); }
}
async function loadForecast(el, full) {
  const f = await api('/api/forecast'); if (!f.ok) return (el.innerHTML = `<p class="err">${T('weather.fcfail2', 'ยังไม่มีข้อมูลพยากรณ์ในขณะนี้ ลองใหม่ภายหลัง')} (${esc(f.error)})</p>`);
  const max = Math.max(1, ...f.hourly.map((h) => h.mm));
  el.innerHTML = `<p class="muted fcsrc">${T('weather.updated', 'อัปเดตล่าสุดเมื่อ')} ${fmt(f.fetchedAt)} · ${esc(f.source)}</p><p><b>${T('weather.next24', 'ฝน 24 ชม. ข้างหน้า')}</b> <span class="badge" style="background:${f.color}">${esc(f.label)}</span><br>${T('weather.total', 'รวมประมาณ')} <b>${f.totalMm}</b> ${T('weather.mm', 'มม.')} · ${T('weather.maxprob', 'โอกาสสูงสุด')} <b>${f.maxProb == null ? '-' : f.maxProb + '%'}</b> · ${f.startTime ? T('weather.start', 'เริ่มราว') + ' ' + fmt(f.startTime) : T('weather.norain', 'ไม่มีฝนที่วัดได้')}</p>
   <div class="bars">${f.hourly.map((h) => `<div style="height:${h.prob || 0}%" title="${h.t.slice(11)} · ${h.mm} mm · ${h.prob}% · ${h.wind} km/h"><i style="height:${Math.min(100, (h.mm / max) * 100)}%"></i></div>`).join('')}</div>
   <div class="ticks">${[0, 6, 12, 18, 23].map((i) => `<span>${f.hourly[i]?.t.slice(11) || ''}</span>`).join('')}</div><p class="muted">${T('weather.legend', 'แท่งฟ้าอ่อน = โอกาสฝน · แท่งเข้ม = ปริมาณฝน')} (${T('weather.max', 'สูงสุด')} ${max.toFixed(1)} ${T('weather.mmh', 'มม./ชม.')}) · ${f.stale ? T('weather.stale', 'ข้อมูลเก่า (ดึงใหม่ไม่สำเร็จ)') : 'Open-Meteo ' + fmt(f.fetchedAt)}</p>
   ${full ? `<table><tr><th>${T('weather.col.time', 'เวลา')}</th><th>${T('weather.col.rain', 'ฝน มม.')}</th><th>${T('weather.col.prob', 'โอกาส')}</th><th>${T('weather.col.wind', 'ลม กม./ชม.')}</th></tr>${f.hourly.map((h) => `<tr><td>${h.t.slice(11)}</td><td>${h.mm}</td><td>${h.prob}%</td><td>${h.wind}</td></tr>`).join('')}</table>` : ''}`;
}
async function loadWater(el) {
  const w = await api('/api/water'); if (!w.ok) return (el.innerHTML = `<p class="err">${T('weather.wlfail', 'ดึงข้อมูลจากคลังข้อมูลน้ำแห่งชาติไม่ได้ในขณะนี้ — ไม่แสดงค่าประมาณ')} (${esc(w.error)})</p>`);
  el.innerHTML = w.stations.map((s) => `<div class="st"><span class="badge s${s.sev}">${esc(s.status)}</span> <b>${esc(s.name)}</b> <span class="muted">${esc(s.code || '')} · ${T('weather.amphoe', 'อ.')}${esc(s.amphoe)} ${T('weather.province', 'จ.')}${esc(s.province)} · ${T('weather.away', 'ห่าง')} ${s.distanceKm} ${T('weather.km', 'กม.')}</span><br>
   ${s.diff == null ? T('weather.nobank', 'ไม่มีข้อมูลระดับตลิ่ง') : s.diff > 0 ? `${T('weather.above', 'สูงกว่าตลิ่ง')} <b>${s.diff.toFixed(2)}</b> ${T('weather.m', 'ม.')}` : `${T('weather.below', 'ต่ำกว่าตลิ่ง')} <b>${Math.abs(s.diff).toFixed(2)}</b> ${T('weather.m', 'ม.')}`} · ${esc(s.trend)} · ${T('weather.level', 'ระดับ')} ${s.level} ${T('weather.msl', 'ม.รทก.')} · ${T('weather.measured', 'วัดเมื่อ')} ${fmt(s.measuredAt)} · ${esc(s.agency || '')}</div>`).join('') + `<p class="muted">${esc(w.note)}${w.stale ? ' · ⚠ ' + T('weather.stale', 'ข้อมูลเก่า (ดึงใหม่ไม่สำเร็จ)') : ''}</p>`;
}
async function loadRain(el) {
  const r = await api('/api/rain'); if (!r.ok) return (el.innerHTML = `<p class="err">${T('weather.rainfail', 'ดึงข้อมูลฝนไม่ได้')} (${esc(r.error)})</p>`);
  el.innerHTML = `<ul class="list">${r.stations.map((s) => `<li><span>${esc(s.name)} <span class="muted">${T('weather.amphoe', 'อ.')}${esc(s.amphoe)} · ${s.distanceKm} ${T('weather.km', 'กม.')} · ${fmt(s.at)}</span></span><b>${s.rain24h} ${T('weather.mm', 'มม.')}</b></li>`).join('')}</ul>`;
}

function locPicker(el, initial) {
  el.innerHTML = `<div class="chips"><button type="button" class="chip" data-a="gps">${T('loc.gps', '📍 ใช้ตำแหน่งปัจจุบัน')}</button><input placeholder="${T('loc.search.ph', 'พิมพ์ชื่อสถานที่ แล้วกดค้นหา')}" style="flex:1;min-width:160px;margin:0" class="q"><button type="button" class="chip" data-a="s">${T('loc.search', 'ค้นหา')}</button></div><div class="res"></div><div class="mapsmall" style="margin-top:6px"></div><div class="muted">${T('loc.hint', 'แตะบนแผนที่ หรือลากหมุดเพื่อขยับ')}</div>`;
  const m = tiles(L.map($('.mapsmall', el)).setView(initial || CENTER, 14)); const mk = L.marker(initial || CENTER, { draggable: true }).addTo(m); const st = { lat: null, lng: null };
  const set = (ll) => { mk.setLatLng(ll); m.setView(ll, Math.max(m.getZoom(), 16)); st.lat = ll[0]; st.lng = ll[1]; };
  mk.on('dragend', () => { const p = mk.getLatLng(); set([p.lat, p.lng]); }); m.on('click', (e) => set([e.latlng.lat, e.latlng.lng]));
  el.addEventListener('click', async (e) => { const a = e.target.dataset.a; try { if (a === 'gps') set(await gps()); if (a === 's') { const rs = await geocode($('.q', el).value); $('.res', el).innerHTML = rs.length ? rs.map((r, i) => `<div class="chip" data-i="${i}">${esc(r.display_name.slice(0, 70))}</div>`).join('') : T('loc.notfound', 'ไม่พบ'); $('.res', el).onclick = (ev) => { const r = rs[ev.target.dataset.i]; r && set([+r.lat, +r.lon]); $('.res', el).innerHTML = ''; }; } } catch (er) { $('.res', el).textContent = er.message; } });
  st.set = set; setTimeout(() => m.invalidateSize(), 100); return st;
}
const levelChips = (lv) => `<div class="chips" id="lv">${Object.entries(lv).map(([k, v]) => `<span class="chip" data-v="${k}">${esc(v)}</span>`).join('')}</div>`;
function chipSel(el, multi) { const sel = new Set(); el.onclick = (e) => { const v = e.target.dataset.v; if (!v) return; if (!multi) { sel.clear(); el.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); } sel.has(v) ? sel.delete(v) : sel.add(v); e.target.classList.toggle('on', sel.has(v)); }; return sel; }
const areaOpts = (c, ph) => `<option value="">${ph}</option>${c.contacts.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}`;

async function report() {
  const c = await cfg(); title('report.title', '📏 รายงานระดับน้ำ');
  app.innerHTML = back() + `<div class="card"><h2>${T('report.title', '📏 รายงานระดับน้ำ')}</h2><label>${T('report.q1', '1. น้ำสูงแค่ไหน')}</label>${levelChips(c.levels)}<br><label>${T('report.q2', '2. ตรงไหน')}</label><select id="ar">${areaOpts(c, T('report.area', 'พื้นที่ (ไม่บังคับ)'))}</select><div id="loc"></div>
   <label>${T('report.photo', '3. รูปถ่าย (ไม่บังคับ)')}</label><input type="file" id="ph" accept="image/*" capture="environment"><label>${T('report.note', 'หมายเหตุ')}</label><input id="nt" maxlength="300" placeholder="${T('report.note.ph', 'เช่น ซอยบัวขาว รถเล็กผ่านไม่ได้')}"><button class="btn" id="go">${T('report.submit', 'ส่งรายงาน')}</button> <span id="msg"></span>
   <p class="muted">${T('report.privacy', 'รายงานแสดงบนแผนที่สาธารณะ (ไม่เก็บชื่อ/เบอร์) และใช้คำนวณเส้นทางเลี่ยงน้ำ 24 ชม.')}</p></div>`;
  const lv = chipSel($('#lv')), loc = locPicker($('#loc'));
  $('#ar').onchange = (e) => { const a = c.contacts.areas.find((x) => x.id === e.target.value); a && loc.set([a.lat, a.lng]); };
  $('#go').onclick = async () => { try { if (!loc.lat) throw new Error(C.cfg.texts?.['err.pin'] || 'ปักหมุดตำแหน่งก่อน'); const r = await api('/api/reports', { method: 'POST', body: { level: [...lv][0], areaId: $('#ar').value, lat: loc.lat, lng: loc.lng, note: $('#nt').value, photo: await photoData($('#ph')) } }); app.innerHTML = `<div class="card"><h2 class="ok">${T('msg.reportthanks', 'ขอบคุณ! ส่งรายงานแล้ว')} ${r.id}</h2>${r.merged ? `<p>${T('msg.merged', 'มีผู้รายงานจุดนี้แล้ว — นับเป็นการยืนยันเพิ่ม')} (${T('updates.confirmed', 'ยืนยันโดย')} ${r.confirms} ${T('updates.people', 'คน')})</p>` : modMsg(r)}<a class="btn" href="#/map">${T('msg.viewmap', 'ดูบนแผนที่')}</a> <a class="btn alt" href="#/">${T('nav.home', 'หน้าหลัก')}</a></div>`; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
async function helpForm(kind) {
  const c = await cfg(); const served = c.contacts.areas.filter((a) => a.served);
  const TT = { food: T('help.tab.food', '🍚 ขออาหาร / ถุงยังชีพ'), evacuate: T('help.tab.evacuate', '🚤 ขอความช่วยเหลือ / อพยพ'), medical: T('help.tab.medical', '💊 ผู้ป่วย / ขอยา') };
  const NEEDS = [T('need.food', 'ข้าวสาร / อาหาร'), T('need.water', 'น้ำดื่ม'), T('need.kit', 'ถุงยังชีพ'), T('need.med', 'ยา / เวชภัณฑ์'), T('need.baby', 'นม / ผ้าอ้อมเด็ก'), T('need.pet', 'อาหารหมา / แมว'), T('need.boat', 'เรือ / อพยพ'), T('need.bed', 'ผู้ป่วยติดเตียง')];
  document.title = (TT[kind] || TT.food).replace(/&[a-z#0-9]+;/g, '');
  app.innerHTML = back() + `<div class="card"><h2>${TT[kind] || TT.food}</h2>
   <p class="sos card" style="font-size:14px">${T('help.sos', 'ถ้าติดอยู่ต้องอพยพ หรือเจ็บป่วยฉุกเฉิน โทร')} <a href="tel:1669">1669</a> ${T('help.sos2', 'ทันที — เว็บนี้รับเฉพาะพื้นที่:')} ${esc(served.map((a) => a.name).join(', '))}</p>
   <div class="tabs">${Object.entries(TT).map(([k, v]) => `<a class="chip ${k === kind ? 'on' : ''}" href="#/${k === 'food' ? 'sos' : 'help?kind=' + k}">${v}</a>`).join('')}</div>
   <label>${T('help.q1', '1. บ้านอยู่ที่ไหน')}</label><select id="ar"><option value="">${T('help.selectarea', '— เลือกพื้นที่ —')}</option>${c.contacts.areas.map((a) => `<option value="${a.id}" ${a.served ? '' : 'disabled'}>${esc(a.name)}${a.served ? '' : ' ' + T('help.notserved', '(ยังไม่เปิดรับทางเว็บ)')}</option>`).join('')}</select><div id="loc"></div><input id="ad" placeholder="${T('help.address.ph', 'บ้านเลขที่ ซอย จุดสังเกต (หรือวางลิงก์ Google Maps)')}">
   <label>${T('help.q2', '2. ต้องการอะไรบ้าง (เลือกได้หลายข้อ)')}</label><div class="chips" id="nd">${NEEDS.map((x) => `<span class="chip" data-v="${x}">${x}</span>`).join('')}</div>
   <label>${T('help.people', 'ในบ้านมีกี่คน')}</label><input id="pp" type="number" min="1" value="1"><label>${T('help.level', 'น้ำสูงแค่ไหน (ไม่บังคับ)')}</label>${levelChips(c.levels)}
   <label>${T('help.q3', '3. ชื่อและเบอร์โทร')}</label><input id="nm" placeholder="${T('help.name.ph', 'ชื่อ')}"><input id="tl" type="tel" placeholder="${T('help.phone.ph', 'เบอร์โทร')}"><textarea id="nt" placeholder="${T('help.note.ph', 'รายละเอียดเพิ่มเติม')}"></textarea><label>${T('help.photo', 'รูปถ่าย (ไม่บังคับ)')}</label><input type="file" id="ph" accept="image/*">
   <p class="muted">${T('help.privacy', 'ข้อมูลของคุณใช้เพื่อการช่วยเหลือเท่านั้น เห็นเฉพาะเจ้าหน้าที่')}</p><button class="btn" id="go">${T('help.submit', 'ส่งคำขอ')}</button> <span id="msg"></span></div>`;
  const loc = locPicker($('#loc')), nd = chipSel($('#nd'), true), lv = chipSel($('#lv'));
  $('#ar').onchange = (e) => { const a = c.contacts.areas.find((x) => x.id === e.target.value); a && loc.set([a.lat, a.lng]); };
  $('#go').onclick = async () => { try { const r = await api('/api/requests', { method: 'POST', body: { kind, areaId: $('#ar').value, lat: loc.lat, lng: loc.lng, address: $('#ad').value, needs: [...nd].map((x) => new DOMParser().parseFromString(x, 'text/html').body.textContent), people: $('#pp').value, level: [...lv][0], name: $('#nm').value, phone: $('#tl').value, note: $('#nt').value, photo: await photoData($('#ph')) } });
    app.innerHTML = `<div class="card"><h2 class="ok">${T('msg.reqsent', 'ส่งคำขอแล้ว')}</h2><p>${T('msg.caseno', 'เลขเคสของคุณ:')} <b style="font-size:24px">${r.id}</b><br>${T('msg.casehint', 'จดเลขเคสไว้ เช็กสถานะได้ด้วยเลขเคส + เบอร์ 4 ตัวท้าย')}</p><a class="btn" href="#/status?id=${r.id}">${T('msg.checkstatus', 'เช็กสถานะ')}</a> <a class="btn alt" href="#/">${T('nav.home', 'หน้าหลัก')}</a></div>`; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
async function status(q) {
  title('status.title', '🔎 เช็กสถานะเคส');
  app.innerHTML = back() + `<div class="card"><h2>${T('status.title', '🔎 เช็กสถานะเคส')}</h2><input id="id" placeholder="${T('status.id.ph', 'เลขเคส เช่น C-1001')}" value="${esc(q.id || '')}"><input id="p4" placeholder="${T('status.p4.ph', 'เบอร์โทร 4 ตัวท้าย')}" maxlength="4" inputmode="numeric"><button class="btn" id="go">${T('status.submit', 'ตรวจสอบ')}</button><div id="out"></div></div>`;
  const go = async () => { try { const r = await api(`/api/status?id=${encodeURIComponent($('#id').value)}&phone=${encodeURIComponent($('#p4').value)}`); $('#out').innerHTML = `<h3>${esc(r.id)} · ${esc(r.kind)} · ${esc(r.areaName)}</h3><p><b>${esc(r.statusText)}</b>${r.assignee ? ' · ' + T('status.team', 'ทีม:') + ' ' + esc(r.assignee) : ''}</p><ul>${r.history.map((h) => `<li>${fmt(h.at)} — ${esc(h.s)} ${esc(h.note || '')}</li>`).join('')}</ul>`; } catch (e) { $('#out').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  $('#go').onclick = go; on((t, d) => t === 'request' && d.id === $('#id')?.value && go());
}
async function area() {
  const c = await cfg(); const rs = await api('/api/reports?hours=24'); title('area.title', '🏘️ พื้นที่ของฉัน');
  const agg = c.contacts.areas.map((a) => { const n = rs.filter((r) => r.areaId === a.id || km(a.lat, a.lng, r.lat, r.lng) < 1.2); const mx = Math.max(0, ...n.map((r) => r.cm)); return { a, n: n.length, mx }; });
  const col = (mx) => mx >= 115 ? '#dc2626' : mx >= 75 ? '#ea580c' : mx >= 30 ? '#ca8a04' : '#16a34a';
  app.innerHTML = back() + `<div class="card"><h2>${T('area.title', '🏘️ พื้นที่ของฉัน')}</h2><p class="muted">${T('area.desc', 'สีตามระดับน้ำสูงสุดที่ประชาชนรายงานใน 24 ชม. (รัศมี ~1.2 กม.)')}</p><div id="map" style="height:50vh"></div><ul class="list">${agg.map((x) => `<li><span><span class="badge" style="background:${col(x.mx)}">${x.mx ? '~' + x.mx + ' ' + T('area.cm', 'ซม.') : T('area.noreport', 'ไม่มีรายงาน')}</span> ${esc(x.a.name)}</span><span class="muted">${x.n} ${T('area.reports', 'รายงาน')}</span></li>`).join('')}</ul></div>`;
  const m = tiles(L.map('map').setView(CENTER, 12)); agg.forEach((x) => x.a.lat && L.circle([x.a.lat, x.a.lng], { radius: 1200, color: col(x.mx), fillOpacity: 0.3 }).addTo(m).bindPopup(`${esc(x.a.name)}<br>${x.n} ${T('area.reports', 'รายงาน')}`));
}
async function updates() {
  title('updates.title', '🕒 อัปเดตระดับน้ำล่าสุด');
  const draw = async () => { const rs = await api('/api/reports?hours=72'); $('#ul').innerHTML = rs.length ? rs.map((r) => `<li class="${r.mod === 'pending' ? 'faded' : ''}${r.cleared ? ' cleared' : ''}"><span><span class="badge" style="background:${LVCOL[r.level]}">${esc(r.levelText)}</span><br>${esc(r.areaName) || T('updates.noarea', 'ไม่ระบุพื้นที่')} · ${esc(r.note || '')}<br><span class="muted">${fmt(r.createdAt)} · ${r.id}${r.confirms > 1 ? ' · 👥 ' + T('updates.confirmed', 'ยืนยันโดย') + ' ' + r.confirms + ' ' + T('updates.people', 'คน') : ''}</span><br>${modBadge(r)}${voteBtns(r)}</span>${r.photo ? `<img class="thumb" src="${r.photo}">` : ''}</li>`).join('') : `<li>${T('updates.none', 'ยังไม่มีรายงานใน 72 ชม.')}</li>`; };
  app.innerHTML = back() + `<div class="card"><h2>${T('updates.title', '🕒 อัปเดตระดับน้ำล่าสุด')}</h2><p class="muted">${T('updates.desc', 'อัปเดตอัตโนมัติแบบเรียลไทม์')}</p><ul class="list" id="ul"></ul></div>`; await draw(); on((t) => (t === 'report' || t === 'deleted') && draw());
}
async function missing() {
  title('missing.title', '🧑‍🤝‍🧑 ตามหาคน');
  app.innerHTML = back() + `<div class="card"><h2>${T('missing.title', '🧑‍🤝‍🧑 ตามหาคน')}</h2><p class="muted">${T('missing.privacy', 'ข้อมูลส่งถึงเจ้าหน้าที่เท่านั้น ไม่ประกาศสาธารณะ')}</p><input id="pn" placeholder="${T('missing.name.ph', 'ชื่อผู้ที่ติดต่อไม่ได้')}"><input id="ag" placeholder="${T('missing.age.ph', 'อายุ')}"><textarea id="ls" placeholder="${T('missing.last.ph', 'อยู่ที่ไหนครั้งสุดท้าย / ที่อยู่')}"></textarea><textarea id="ds" placeholder="${T('missing.desc.ph', 'ลักษณะ / โรคประจำตัว')}"></textarea><input id="rn" placeholder="${T('missing.rname.ph', 'ชื่อผู้แจ้ง')}"><input id="rp" type="tel" placeholder="${T('missing.rphone.ph', 'เบอร์ผู้แจ้ง')}"><input type="file" id="ph" accept="image/*"><button class="btn" id="go">${T('missing.submit', 'แจ้งศูนย์')}</button> <span id="msg"></span></div>`;
  $('#go').onclick = async () => { try { const r = await api('/api/missing', { method: 'POST', body: { personName: $('#pn').value, age: $('#ag').value, lastSeen: $('#ls').value, description: $('#ds').value, reporterName: $('#rn').value, reporterPhone: $('#rp').value, photo: await photoData($('#ph')) } }); $('#msg').innerHTML = `<span class="ok">${T('msg.missingok', 'รับเรื่องแล้ว เจ้าหน้าที่จะติดต่อกลับ')} (${r.id})</span>`; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
async function lostFound() {
  title('lf.title', '🐾 ของหาย–ได้คืน');
  const draw = async () => { const ls = await api('/api/lostfound'); $('#lf').innerHTML = ls.map((x) => `<li class="${x.mod === 'pending' ? 'faded' : ''}"><span>${modBadge(x)} <span class="badge ${x.type === 'lost' ? 's2' : 's0'}">${x.type === 'lost' ? T('lf.badge.lost', 'ตามหา') : T('lf.badge.found', 'เก็บได้')}</span> <b>${esc(x.title)}</b> <span class="muted">${esc(x.category)}</span><br>${esc(x.detail)}<br><span class="muted">${esc(x.place)} · ${fmt(x.createdAt)} · ${T('lf.contact', 'ติดต่อ')} ${x.phoneMasked} ${T('lf.viastaff', '(ผ่านเจ้าหน้าที่)')}</span></span>${x.photo ? `<img class="thumb" src="${x.photo}">` : ''}</li>`).join('') || `<li>${T('lf.none', 'ยังไม่มีประกาศ')}</li>`; };
  app.innerHTML = back() + `<div class="card"><h2>${T('lf.title', '🐾 ของหาย–ได้คืน')}</h2><select id="ty"><option value="lost">${T('lf.type.lost', 'ตามหา (ของหาย/สัตว์หาย)')}</option><option value="found">${T('lf.type.found', 'เก็บได้')}</option></select><select id="ct">${[T('lf.cat.pet', 'สัตว์เลี้ยง'), T('lf.cat.doc', 'เอกสาร'), T('lf.cat.valuable', 'ของมีค่า'), T('lf.cat.vehicle', 'ยานพาหนะ'), T('lf.cat.other', 'อื่น ๆ')].map((x) => `<option>${x}</option>`).join('')}</select><input id="ti" placeholder="${T('lf.title.ph', 'หัวข้อ เช่น แมวส้ม ชื่อส้มโอ')}"><textarea id="dt" placeholder="${T('lf.detail.ph', 'รายละเอียด')}"></textarea><input id="pl" placeholder="${T('lf.place.ph', 'สถานที่')}"><input id="tl" type="tel" placeholder="${T('lf.phone.ph', 'เบอร์ติดต่อ (แสดงแค่ 4 ตัวท้าย)')}"><input type="file" id="ph" accept="image/*"><button class="btn" id="go">${T('lf.submit', 'ประกาศ')}</button> <span id="msg"></span><h3>${T('lf.latest', 'ประกาศล่าสุด')}</h3><ul class="list" id="lf"></ul></div>`;
  $('#go').onclick = async () => { try { await api('/api/lostfound', { method: 'POST', body: { type: $('#ty').value, category: $('#ct').value, title: $('#ti').value, detail: $('#dt').value, place: $('#pl').value, phone: $('#tl').value, photo: await photoData($('#ph')) } }).then((r) => { $('#msg').innerHTML = `<span class="ok">${T('msg.lfok', 'ประกาศแล้ว')}</span>${modMsg(r)}`; }); draw(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
  draw(); on((t) => (t === 'lostfound' || t === 'deleted') && draw());
}
async function weather() { title('weather.title', '🌧️ พยากรณ์อากาศ ฝน ลม — พัทยา'); app.innerHTML = back() + `<div class="card"><h2>${T('weather.title', '🌧️ พยากรณ์อากาศ ฝน ลม — พัทยา')}</h2><div id="fc"></div><h3>${T('weather.radar', 'เรดาร์ฝน')}</h3><iframe title="radar" style="width:100%;height:380px;border:0;border-radius:10px" src="https://embed.windy.com/embed2.html?lat=12.92&lon=100.88&zoom=9&overlay=radar&product=radar"></iframe></div><div class="card" style="margin-top:12px"><h2>${T('weather.wltitle', 'ระดับน้ำ')}</h2><div id="wl"></div><h3>${T('weather.rain24', 'ฝนสะสม 24 ชม.')}</h3><div id="rn"></div></div>`; loadForecast($('#fc'), true); loadWater($('#wl')); loadRain($('#rn')); }
// ---------- CCTV ----------
let hlsP; const loadHls = () => (hlsP ||= new Promise((ok, no) => { if (window.Hls) return ok(window.Hls); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'; s.onload = () => ok(window.Hls); s.onerror = no; document.head.appendChild(s); }));
function camPlayer(v) {
  const u = esc(v.url);
  if (v.kind === 'hls') return `<video class="cam" data-hls="${u}" controls muted playsinline autoplay></video>`;
  if (v.kind === 'image') return `<img class="cam" data-snap="${u}" src="${u}" alt="${esc(v.title)}">`;
  if (v.kind === 'iframe') return `<iframe class="cam" src="${u}" allow="autoplay; fullscreen" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  return '';
}
async function startPlayers(root) {
  root.querySelectorAll('video[data-hls]').forEach(async (el) => { const u = el.dataset.hls; if (el.canPlayType('application/vnd.apple.mpegurl')) { el.src = u; return; } try { const H = await loadHls(); if (H.isSupported()) { const h = new H(); h.loadSource(u); h.attachMedia(el); h.on(H.Events.ERROR, (e, d) => d.fatal && (el.outerHTML = `<p class="err">${T('cctv.playfail', 'เล่นสตรีมไม่ได้ (ต้นทางอาจไม่อนุญาตให้ฝัง) — เปิดลิงก์ต้นทาง')}</p>`)); } } catch {} });
  const t = setInterval(() => { const imgs = root.querySelectorAll('img[data-snap]'); if (!document.body.contains(root) || !imgs.length) return clearInterval(t); imgs.forEach((i) => (i.src = i.dataset.snap + (i.dataset.snap.includes('?') ? '&' : '?') + '_t=' + Date.now())); }, 15000);
}
const CAMCOL = { online: '#16a34a', offline: '#dc2626', suspect: '#ca8a04', unknown: '#64748b' };
async function cctv() {
  const c = await cfg(); title('cctv.title', '📹 กล้อง CCTV');
  const own = (c.cctv || []);
  app.innerHTML = back() + `<div class="card"><h2>${T('cctv.title', '📹 กล้อง CCTV')}</h2>
   <p class="muted">${T('cctv.desc', 'กล้องของเมืองพัทยาจาก livestream.pattaya.go.th (ภาพสดเปิดดูได้ที่เว็บเมืองพัทยา เพราะระบบต้นทางต้องยืนยันตัวตนผู้ชมและไม่อนุญาตให้ฝังในเว็บอื่น)')}</p>
   <p><a class="btn green" href="https://livestream.pattaya.go.th/" target="_blank" rel="noopener">${T('cctv.openofficial', '▶ ดูภาพสดที่ livestream.pattaya.go.th')}</a></p>
   <div id="map" style="height:50vh"></div>
   <div class="chips" style="margin-top:8px"><input id="cq" placeholder="${T('cctv.search.ph', 'ค้นหากล้อง เช่น ชื่อถนน แยก ชายหาด')}" style="flex:1;margin:0"><select id="cs" style="width:auto;margin:0"><option value="">${T('cctv.all', 'ทุกสถานะ')}</option><option value="online">${T('cctv.online', 'ออนไลน์')}</option><option value="offline">${T('cctv.offline', 'ออฟไลน์')}</option></select></div>
   <p class="muted" id="cinfo"></p><ul class="list" id="cl"></ul></div>
   ${own.length ? `<div class="card svc" style="margin-top:12px"><h2>${T('cctv.other', 'กล้อง / ลิงก์อื่น ๆ')}</h2>${own.map((v) => `<div class="st"><b>${esc(v.title)}</b> <span class="muted">${esc(v.note || '')}</span>${camPlayer(v)}<br><a href="${esc(v.url)}" target="_blank" rel="noopener">${T('cctv.opensource', 'เปิดเว็บต้นทาง ↗')}</a></div>`).join('')}</div>` : ''}`;
  startPlayers(app);
  const m = tiles(L.map('map').setView(CENTER, 13)); const lay = L.layerGroup().addTo(m);
  own.filter((v) => v.lat && v.lng).forEach((v) => L.marker([v.lat, v.lng]).addTo(m).bindPopup(`<b>${esc(v.title)}</b><br><a href="${esc(v.url)}" target="_blank">${T('cctv.opensource', 'เปิดเว็บต้นทาง ↗')}</a>`));
  let cams = [];
  try { const r = await api('/api/cctv/pattaya'); cams = r.items; $('#cinfo').innerHTML = r.ok ? `${T('cctv.count', 'กล้องทั้งหมด')} ${cams.length} · ${T('cctv.updated', 'อัปเดตรายชื่อ')} ${fmt(r.fetchedAt)}${r.stale ? ' ⚠' : ''}` : `<span class="err">${T('cctv.listfail', 'ดึงรายชื่อกล้องจากเมืองพัทยาไม่ได้ในขณะนี้')}</span>`; } catch (e) { $('#cinfo').textContent = e.message; }
  const draw = () => { const q = $('#cq').value.trim().toLowerCase(), s = $('#cs').value;
    const L2 = cams.filter((x) => (!s || x.state === s) && (!q || (x.title + ' ' + x.name + ' ' + x.location + ' ' + x.district).toLowerCase().includes(q))).sort((a, b) => b.featured - a.featured);
    lay.clearLayers(); L2.forEach((x) => x.lat && L.circleMarker([x.lat, x.lng], { radius: 6, color: '#fff', weight: 1, fillColor: CAMCOL[x.state] || '#64748b', fillOpacity: 0.9 }).addTo(lay).bindPopup(`<b>${esc(x.title || x.location)}</b><br>${esc(x.name)} · ${esc(x.district)} · ${esc(x.state)}<br><a href="https://livestream.pattaya.go.th/" target="_blank" rel="noopener">${T('cctv.watch', 'ดูสดที่เว็บเมืองพัทยา ↗')}</a>`));
    $('#cl').innerHTML = L2.slice(0, 80).map((x) => `<li><span>${x.featured ? '⭐ ' : ''}<b>${esc(x.title || x.location)}</b><br><span class="muted">${esc(x.name)} · ${esc(x.district)} · <span style="color:${CAMCOL[x.state]}">● ${esc(x.state)}</span></span></span><span><button class="btn sm alt" data-ll="${x.lat},${x.lng}">${T('cctv.onmap', 'แผนที่')}</button></span></li>`).join('') + (L2.length > 80 ? `<li class="muted">${T('cctv.more', 'แสดง 80 รายการแรก — พิมพ์ค้นหาเพื่อกรอง')} (${L2.length})</li>` : ''); };
  $('#cq').oninput = draw; $('#cs').onchange = draw; $('#cl').onclick = (e) => { const ll = e.target.dataset.ll; if (ll) { const [a, b] = ll.split(',').map(Number); m.setView([a, b], 17); window.scrollTo(0, 0); } }; draw();
}
// ---------- map + avoidance routing ----------
async function mapPage(q) {
  title('map.title', '🗺️ แผนที่น้ำท่วม · เส้นทางเลี่ยงน้ำ');
  app.innerHTML = `<div class="card"><h2>${T('map.title', '🗺️ แผนที่น้ำท่วม · เส้นทางเลี่ยงน้ำ')}</h2>
   <div class="legend muted"><span>● <b style="color:#dc2626">${T('map.lg.report', 'รายงานน้ำ')}</b></span><span>■ <b style="color:#7c3aed">${T('map.lg.req', 'คำขอช่วยเหลือ')}</b></span><span>━ <b style="color:#16a34a">${T('map.lg.detour', 'เส้นทางเลี่ยงทางการ')}</b></span><span>━ <b style="color:#000">${T('map.lg.closed', 'ถนนปิด')}</b></span><span>${T('map.lg.station', '▲ สถานีวัดน้ำ')}</span><span><b class="hsmk sm">!</b> ${T('map.lg.hs', 'จุดท่วมซ้ำซาก')}</span></div>
   <div id="map"></div>
   <h3>${T('map.route.title', '🚗 หาเส้นทางเลี่ยงน้ำท่วม')}</h3><div class="chips"><button class="chip on" id="mA">${T('map.ptA', '1) จุดเริ่ม: แตะแผนที่')}</button><button class="chip" id="gA">${T('map.gps', '📍 ใช้ GPS')}</button><button class="chip" id="mB">${T('map.ptB', '2) ปลายทาง: แตะแผนที่')}</button></div>
   <div class="chips" style="margin-top:6px"><input id="qB" placeholder="${T('map.searchB.ph', 'หรือค้นหาปลายทาง เช่น โรงพยาบาลเมืองพัทยา')}" style="flex:1;margin:0"><button class="chip" id="sB">${T('map.search', 'ค้นหา')}</button></div><div id="resB"></div>
   <p><button class="btn" id="route">${T('map.calc', 'คำนวณเส้นทางเลี่ยงน้ำ')}</button> <button class="btn alt" id="clr">${T('map.clear', 'ล้าง')}</button></p><div id="rOut"></div></div>`;
  const m = tiles(L.map('map').setView(CENTER, 13)); const lay = { hs: L.layerGroup().addTo(m), rep: L.layerGroup().addTo(m), req: L.layerGroup().addTo(m), roads: L.layerGroup().addTo(m), st: L.layerGroup().addTo(m), cam: L.layerGroup(), route: L.layerGroup().addTo(m) };
  L.control.layers(null, { [T('map.layer.hs', 'จุดเสี่ยงน้ำท่วม / จุดท่วมซ้ำซาก')]: lay.hs, [T('map.layer.rep', 'รายงานระดับน้ำ')]: lay.rep, [T('map.layer.req', 'คำขอช่วยเหลือ')]: lay.req, [T('map.layer.roads', 'เส้นทางเลี่ยง/ถนนปิด')]: lay.roads, [T('map.layer.st', 'สถานีวัดน้ำ (สสน.)')]: lay.st, [T('map.layer.cctv', 'กล้อง CCTV เมืองพัทยา')]: lay.cam }).addTo(m);
  const drawRep = async () => { lay.rep.clearLayers(); (await api('/api/reports?hours=48')).forEach((r) => { const pend = r.mod === 'pending', faint = pend || r.cleared;
    const mk = L.circleMarker([r.lat, r.lng], { radius: 9, color: pend ? '#64748b' : '#fff', weight: 2, dashArray: pend ? '3 3' : null, fillColor: LVCOL[r.level], fillOpacity: faint ? 0.35 : 0.9, opacity: faint ? 0.7 : 1, className: pend ? 'mk-pending' : '' }).addTo(lay.rep)
      .bindPopup(() => `<b>${esc(r.levelText)}</b> ${modBadge(r)}<br>${esc(r.areaName || '')} ${esc(r.note || '')}<br>${fmt(r.createdAt)}${r.confirms > 1 ? ' · 👥 ' + r.confirms : ''}${r.photo ? `<br><img src="${r.photo}" width="160">` : ''}${voteBtns(r)}`);
    if (pend) mk.bindTooltip(T('mod.pending', 'รอตรวจสอบ'), { permanent: true, direction: 'top', offset: [0, -8], className: 'tt-pending' }); }); };
  const drawReq = async () => { lay.req.clearLayers(); (await api('/api/requests/public')).filter((r) => r.lat && !['resolved', 'closed'].includes(r.status)).forEach((r) => L.marker([r.lat, r.lng], { icon: L.divIcon({ html: '🆘', className: '', iconSize: [20, 20] }) }).addTo(lay.req).bindPopup(`<b>${esc(r.id)}</b> ${esc(r.areaName)}<br>${esc(r.needs.join(', '))}<br>${T('map.status', 'สถานะ: ')}${stName(r.status)}<br><span style="font-size:12px">${T('map.rounded', 'ตำแหน่งปัดเศษเพื่อความเป็นส่วนตัว')}</span>`)); };
  const drawRoads = (rs) => { lay.roads.clearLayers(); rs.forEach((w) => L.polyline(w.points, { color: w.type === 'closed' ? '#000' : '#16a34a', weight: 7, dashArray: w.type === 'closed' ? '6 8' : null, opacity: 0.85 }).addTo(lay.roads).bindPopup(`<b>${w.type === 'closed' ? T('map.pop.closed', '⛔ ถนนปิด') : T('map.pop.detour', '✅ เส้นทางเลี่ยงทางการ')}</b><br>${esc(w.title)}<br>${esc(w.note || '')}<br>${fmt(w.createdAt)}`)); };
  api('/api/hotspots').then((h) => h.spots.forEach((x) => L.marker([x.lat, x.lng], { icon: L.divIcon({ html: '<div class="hsmk">!</div>', className: '', iconSize: [22, 22] }) }).addTo(lay.hs)
    .bindPopup(`<b>${T('map.hs.title', 'จุดท่วมซ้ำซาก')}</b><br>${esc(x.label)}<br><span class="muted" style="font-size:12px">${T('map.hs.approx', 'ตำแหน่งโดยประมาณ จากรายงานข่าวน้ำท่วมซ้ำซาก')}</span>`))).catch(() => {});
  drawRep(); drawReq(); api('/api/cctv/pattaya').then((r) => r.items.forEach((x) => x.lat && L.circleMarker([x.lat, x.lng], { radius: 4, color: '#334155', weight: 1, fillColor: '#64748b', fillOpacity: 0.8 }).addTo(lay.cam).bindPopup(`📹 <b>${esc(x.title || x.location)}</b><br><a href="https://livestream.pattaya.go.th/" target="_blank" rel="noopener">${T('cctv.watch', 'ดูสดที่เว็บเมืองพัทยา ↗')}</a>`))).catch(() => {}); drawRoads(await api('/api/roads'));
  api('/api/water').then((w) => w.ok && w.stations.forEach((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ html: '▲', className: '', iconSize: [16, 16] }) }).addTo(lay.st).bindPopup(`${esc(s.name)}<br>${esc(s.status)} · ${fmt(s.measuredAt)}`)));
  on((t, d) => { if (t === 'report' || t === 'deleted') drawRep(); if (t === 'request' || t === 'deleted') drawReq(); if (t === 'roads') drawRoads(d); });
  const st = { mode: 'A', A: null, B: null, mA: null, mB: null };
  const setPt = (k, ll) => { st[k] = ll; st['m' + k] && m.removeLayer(st['m' + k]); st['m' + k] = L.marker(ll, { icon: L.divIcon({ html: k === 'A' ? '🟢' : '🏁', className: '', iconSize: [22, 22] }) }).addTo(m); if (k === 'A') { st.mode = 'B'; $('#mB').classList.add('on'); $('#mA').classList.remove('on'); } };
  m.on('click', (e) => setPt(st.mode, [e.latlng.lat, e.latlng.lng]));
  $('#mA').onclick = () => { st.mode = 'A'; $('#mA').classList.add('on'); $('#mB').classList.remove('on'); }; $('#mB').onclick = () => { st.mode = 'B'; $('#mB').classList.add('on'); $('#mA').classList.remove('on'); };
  $('#gA').onclick = async () => { try { const p = await gps(); setPt('A', p); m.setView(p, 15); } catch (e) { $('#rOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  $('#sB').onclick = async () => { const rs = await geocode($('#qB').value); $('#resB').innerHTML = rs.map((r, i) => `<div class="chip" data-i="${i}">${esc(r.display_name.slice(0, 80))}</div>`).join('') || T('loc.notfound', 'ไม่พบ'); $('#resB').onclick = (e) => { const r = rs[e.target.dataset.i]; if (r) { setPt('B', [+r.lat, +r.lon]); m.setView([+r.lat, +r.lon], 14); $('#resB').innerHTML = ''; } }; };
  $('#clr').onclick = () => { lay.route.clearLayers(); ['mA', 'mB'].forEach((k) => st[k] && m.removeLayer(st[k])); st.A = st.B = null; st.mode = 'A'; $('#rOut').innerHTML = ''; };
  const calc = async () => {
    if (!st.A || !st.B) return ($('#rOut').innerHTML = `<p class="err">${T('map.needAB', 'เลือกจุดเริ่มและปลายทางก่อน')}</p>`); $('#rOut').innerHTML = T('map.calculating', 'กำลังคำนวณ…');
    try { const r = await api(`/api/route?fromLat=${st.A[0]}&fromLng=${st.A[1]}&toLat=${st.B[0]}&toLng=${st.B[1]}`); lay.route.clearLayers();
      r.zones.forEach((z) => L.circle([z.lat, z.lng], { radius: z.rM, color: '#dc2626', weight: 1, fillOpacity: 0.12 }).addTo(lay.route));
      r.alternatives.forEach((a) => L.polyline(a.coords.map(([x, y]) => [y, x]), { color: '#94a3b8', weight: 4, dashArray: '4 6' }).addTo(lay.route).bindPopup(a.floodHits.length ? T('map.passes', 'ผ่านจุดน้ำ: ') + esc(a.floodHits.join(', ')) : T('map.alt', 'ทางเลือก')));
      const b = r.best, pl = L.polyline(b.coords.map(([x, y]) => [y, x]), { color: r.avoids ? '#2563eb' : '#dc2626', weight: 6 }).addTo(lay.route); m.fitBounds(pl.getBounds(), { padding: [30, 30] });
      $('#rOut').innerHTML = `${r.avoids ? `<p class="good">${T('map.ok1', '✅ เส้นทางนี้เลี่ยงจุดน้ำท่วมที่รายงาน')} ${r.zonesCount} ${T('map.ok2', 'จุด/โซน ได้ทั้งหมด')}</p>` : r.warning ? `<p class="warn">⚠ ${esc(r.warning)}<br>${T('map.pass', 'ผ่าน: ')}${esc(b.floodHits.join(', '))}</p>` : `<p class="good">${T('map.nozones', 'ยังไม่มีจุดน้ำท่วมรายงานในขณะนี้')}</p>`}
        <p><b>${(b.distance / 1000).toFixed(1)} ${T('map.km', 'กม.')}</b> · ${T('map.approx', 'ประมาณ')} <b>${Math.round(b.duration / 60)} ${T('map.min', 'นาที')}</b> ${T('map.nottraffic', '(ไม่รวมการจราจร/น้ำ)')} · ${esc(r.engine)}</p>
        <p><a class="btn green" target="_blank" href="${r.gmaps}">${T('map.gmaps', 'เปิดใน Google Maps (มีจุดผ่าน)')}</a></p><ol class="steps">${b.steps.filter((s) => s.text).map((s) => `<li>${esc(s.text)} <span class="muted">${s.distance >= 1000 ? (s.distance / 1000).toFixed(1) + ' กม.' : Math.round(s.distance) + ' ม.'}</span></li>`).join('')}</ol><p class="muted">${T('map.disclaimer', '⚠ เส้นทางคำนวณจากรายงานประชาชนและประกาศเจ้าหน้าที่ อาจไม่ครบถ้วน ห้ามขับผ่านน้ำไหลเชี่ยว')}</p>`;
    } catch (e) { $('#rOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $('#route').onclick = calc;
  if (q.demo) { setPt('A', [12.9505, 100.8890]); setPt('B', [12.9030, 100.8960]); calc(); }
}

// ---------- staff (triage for rescue teams) ----------
async function staffPage() {
  let me; try { me = await api('/api/staff/me'); } catch {}
  title('staff.login.title', '👮 เจ้าหน้าที่และทีมกู้ภัย เข้าสู่ระบบ');
  if (!me) { app.innerHTML = back() + `<div class="card"><h2>${T('staff.login.title', '👮 เจ้าหน้าที่และทีมกู้ภัย เข้าสู่ระบบ')}</h2><form id="lf" method="post" action="#" autocomplete="on"><input id="un" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${T('staff.login.user', 'ชื่อผู้ใช้')}"><input id="pw" name="password" type="password" autocomplete="current-password" placeholder="${T('staff.login.pw', 'รหัสผ่าน')}"><button class="btn" id="go" type="submit">${T('staff.login.submit', 'เข้าสู่ระบบ')}</button> <span id="msg"></span></form><p class="muted">${T('staff.login.note', 'ผู้ดูแลระบบสร้างบัญชีให้ที่หน้า ระบบหลังบ้าน /admin')}</p></div>`;
    const go = async () => { try { await api('/api/staff/login', { method: 'POST', body: { username: $('#un').value, password: $('#pw').value } }); render(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
    $('#lf').addEventListener('submit', (e) => { e.preventDefault(); go(); }); return; }
  let tab = 'requests', data;
  const S = { requests: ['new', 'triaged', 'assigned', 'enroute', 'resolved', 'closed'], reports: ['new', 'verified', 'hidden'], missing: ['searching', 'found', 'closed'], lostfound: ['open', 'closed', 'hidden'], roads: ['open', 'hidden'] };
  const canDel = me.user.role !== 'staff';
  const row = (c, x) => `<tr><td><b>${x.id}</b><br><span class="muted">${fmt(x.createdAt)}</span></td><td>${c === 'requests' ? `${esc(x.areaName)} · ${esc(C.cfg.kinds?.[x.kind] || x.kind)} · ${x.people} ${T('staff.people', 'คน')}<br>${esc(x.needs.join(', '))}<br>${esc(x.name)} ${tel(x.phone)}<br>${esc(x.address)} ${esc(x.note)}${x.lat ? ` <a target="_blank" href="https://www.google.com/maps?q=${x.lat},${x.lng}">${T('staff.map', 'แผนที่')}</a>` : ''}` : c === 'reports' ? `${esc(x.areaName || '')} · ${esc(C.cfg.levels[x.level] || x.level)} · ${esc(x.note)}` : c === 'missing' ? `<b>${esc(x.personName)}</b> ${esc(x.age)}<br>${esc(x.lastSeen)} ${esc(x.description)}<br>${T('staff.reporter', 'ผู้แจ้ง')} ${esc(x.reporterName)} ${tel(x.reporterPhone)}` : c === 'roads' ? `${x.type === 'closed' ? T('map.pop.closed', '⛔ ถนนปิด') : T('map.pop.detour', '✅ เส้นทางเลี่ยงทางการ')} ${esc(x.title)} (${x.points.length})` : `${esc(x.type)} ${esc(x.title)} ${tel(x.phone)}`}${x.photo ? `<br><img class="thumb" src="${x.photo}">` : ''}</td>
    <td><select data-c="${c}" data-id="${x.id}" class="sst" style="width:auto">${S[c].map((s) => `<option value="${s}" ${s === x.status ? 'selected' : ''}>${stName(s)}</option>`).join('')}</select>${c === 'requests' ? `<input class="asg" data-id="${x.id}" placeholder="${T('staff.assign.ph', 'มอบหมายทีม')}" value="${esc(x.assignee || '')}">` : ''}${canDel ? `<button class="btn sm red del" data-c="${c}" data-id="${x.id}">${T('staff.delete', 'ลบ')}</button>` : ''}</td></tr>`;
  const TABS = { requests: T('staff.tab.requests', 'คำขอช่วยเหลือ'), reports: T('staff.tab.reports', 'รายงานระดับน้ำ'), missing: T('staff.tab.missing', 'ตามหาคน'), lostfound: T('staff.tab.lf', 'ของหาย'), roads: T('staff.tab.roads', 'เส้นทางเลี่ยง/ถนนปิด') };
  const draw = async () => { data = await api('/api/staff/data'); data.roads = await api('/api/roads'); const n = (c) => data[c].filter((x) => ['new', 'searching'].includes(x.status)).length;
    app.innerHTML = `<div class="card"><h2>${T('staff.panel', '👮 แผงเจ้าหน้าที่')} · ${esc(me.name)}</h2><div class="tabs">${Object.keys(TABS).map((c) => `<button class="chip ${c === tab ? 'on' : ''}" data-tab="${c}">${TABS[c]} ${n(c) ? `(${n(c)})` : ''}</button>`).join('')}<a class="chip" href="/admin">${T('staff.backoffice', '⚙️ ระบบหลังบ้าน')}</a><button class="chip" id="lo">${T('staff.logout', 'ออกจากระบบ')}</button></div>
     ${tab === 'roads' ? `<div id="map" style="height:45vh"></div><p class="muted">${T('staff.roads.hint', 'แตะแผนที่เพื่อวางจุดตามแนวถนน แล้วกดเผยแพร่ — แสดงบนแผนที่สาธารณะทันที และ ถนนปิด ถูกใช้หลบในการคำนวณเส้นทาง')}</p><select id="rt" style="width:auto"><option value="detour">${T('map.pop.detour', '✅ เส้นทางเลี่ยงทางการ')}</option><option value="closed">${T('map.pop.closed', '⛔ ถนนปิด')}</option></select><input id="rti" placeholder="${T('staff.roads.name.ph', 'ชื่อ เช่น เลี่ยงสุขุมวิท-แยกเฉลิมพระเกียรติ')}"><input id="rno" placeholder="${T('staff.roads.note.ph', 'หมายเหตุ')}"><button class="btn" id="pub">${T('staff.roads.publish', 'เผยแพร่')}</button> <button class="btn alt" id="undo">${T('staff.roads.undo', 'ลบจุดล่าสุด')}</button> <span id="msg"></span>` : ''}
     <div style="overflow:auto"><table><tr><th>${T('staff.col.case', 'เคส')}</th><th>${T('staff.col.detail', 'รายละเอียด')}</th><th>${T('staff.col.manage', 'จัดการ')}</th></tr>${data[tab].map((x) => row(tab, x)).join('') || `<tr><td colspan=3>${T('staff.empty', 'ไม่มีรายการ')}</td></tr>`}</table></div></div>`;
    app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    $('#lo').onclick = async () => { await api('/api/staff/logout', { method: 'POST' }); render(); };
    app.querySelectorAll('.sst').forEach((s) => (s.onchange = () => api(`/api/staff/${s.dataset.c}/${s.dataset.id}`, { method: 'PATCH', body: { status: s.value } }).then(draw)));
    app.querySelectorAll('.asg').forEach((s) => (s.onchange = () => api(`/api/staff/requests/${s.dataset.id}`, { method: 'PATCH', body: { assignee: s.value, status: 'assigned' } }).then(draw)));
    app.querySelectorAll('.del').forEach((b) => (b.onclick = () => confirm(C.cfg.texts?.['staff.confirmdel'] || 'ลบรายการนี้ถาวร?') && api(`/api/staff/${b.dataset.c}/${b.dataset.id}`, { method: 'DELETE' }).then(draw)));
    if (tab === 'roads') { const m = tiles(L.map('map').setView(CENTER, 13)); const pts = []; const pl = L.polyline([], { color: '#16a34a', weight: 6 }).addTo(m);
      data.roads.forEach((w) => L.polyline(w.points, { color: w.type === 'closed' ? '#000' : '#16a34a', weight: 5, opacity: 0.5, dashArray: w.type === 'closed' ? '6 8' : null }).addTo(m));
      m.on('click', (e) => { pts.push([e.latlng.lat, e.latlng.lng]); pl.setLatLngs(pts); }); $('#rt').onchange = () => pl.setStyle({ color: $('#rt').value === 'closed' ? '#000' : '#16a34a' });
      $('#undo').onclick = () => { pts.pop(); pl.setLatLngs(pts); };
      $('#pub').onclick = async () => { try { await api('/api/staff/roads', { method: 'POST', body: { type: $('#rt').value, title: $('#rti').value, note: $('#rno').value, points: pts } }); draw(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } }; }
  };
  await draw(); on((t) => t.startsWith('staff:') && tab !== 'roads' && draw());
}
// texts used only by dynamic code paths (registered for the editor)
void [T('site.offline', '● ออฟไลน์'), T('err.pin', 'ปักหมุดตำแหน่งก่อน'), T('staff.confirmdel', 'ลบรายการนี้ถาวร?'), T('nav.home', 'หน้าหลัก')];
