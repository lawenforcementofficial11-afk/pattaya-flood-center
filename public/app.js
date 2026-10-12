// ศูนย์ช่วยเหลือน้ำท่วมเมืองพัทยา — SPA (hash routing)
const $ = (s, r = document) => r.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (u, o = {}) => { const r = await fetch(u, { headers: { 'content-type': 'application/json' }, credentials: 'same-origin', ...o, body: o.body && JSON.stringify(o.body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
const fmt = (iso) => iso ? new Date(iso.replace(' ', 'T') + (iso.length <= 16 ? ':00+07:00' : '')).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.' : '-';
const tel = (p) => p ? `<a class="tel" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">📞 ${esc(p)}</a>` : '<span class="ph">รอใส่เบอร์</span>';
const C = { cfg: null }, CENTER = [12.9236, 100.8825];
const LVCOL = { dry: '#16a34a', ankle: '#ca8a04', knee: '#ea580c', waist: '#dc2626', chest: '#9f1239', roof: '#4c0519' };
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 108.5);
async function cfg(force) { if (!C.cfg || force) C.cfg = await api('/api/config'); return C.cfg; }
function tiles(m) { L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); return m; }
async function photoData(input) { const f = input.files?.[0]; if (!f) return null; const img = await createImageBitmap(f); const s = Math.min(1, 1280 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.75); }
function gps() { return new Promise((ok, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), () => no(new Error('ไม่ได้รับอนุญาตตำแหน่ง')), { enableHighAccuracy: true, timeout: 10000 }) : no(new Error('อุปกรณ์ไม่รองรับ GPS'))); }
async function geocode(q) { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=th&viewbox=100.70,13.10,101.10,12.75&bounded=1&accept-language=th&q=${encodeURIComponent(q)}`); return r.json(); }
const back = '<p><a href="#/">← กลับหน้าหลัก</a></p>';

// ---------- SSE ----------
const listeners = new Set(); const on = (fn) => { listeners.add(fn); return fn; };
(function sse() { const es = new EventSource('/api/events'); const live = $('#live');
  es.onopen = () => { live.className = 'live'; live.textContent = '● สด'; }; es.onerror = () => { live.className = 'live off'; live.textContent = '● ออฟไลน์'; };
  for (const t of ['report', 'request', 'roads', 'contacts', 'deleted', 'lostfound', 'staff:request', 'staff:update', 'staff:missing']) es.addEventListener(t, (e) => { const d = JSON.parse(e.data); if (t === 'contacts') C.cfg && (C.cfg.contacts = d); listeners.forEach((f) => f(t, d)); });
})();

// ---------- pages ----------
const routes = {
  '': home, sos: (q) => helpForm('food'), help: (q) => helpForm(q.kind || 'evacuate'), report, status, area, map: mapPage, updates, missing, 'lost-found': lostFound, cctv, weather, staff: staffPage, admin: adminPage,
};
async function render() { listeners.clear(); const [p, qs] = location.hash.replace(/^#\/?/, '').split('?'); const q = Object.fromEntries(new URLSearchParams(qs || '')); window.scrollTo(0, 0); app.innerHTML = '<p class="muted">กำลังโหลด…</p>'; try { await (routes[p] || home)(q); } catch (e) { app.innerHTML = `<p class="err">${esc(e.message)}</p>` + back; } }
addEventListener('hashchange', render); render();

async function home() {
  const c = (await cfg()).contacts; const served = c.areas.filter((a) => a.served).map((a) => a.name);
  app.innerHTML = `
  <a class="card big food" href="#/sos"><h2>🍚 ขออาหาร / ถุงยังชีพ</h2><div>ข้าว น้ำดื่ม ถุงยังชีพ ยา อาหารหมาแมว กรอกสั้น ๆ ส่งถึงผู้ประสานงานพื้นที่ของคุณ</div><div class="muted">เปิดรับเฉพาะ: ${esc(served.join(' · '))}</div></a>
  <div class="grid two" style="margin-top:12px">
   <div class="card"><h2>☎️ ติดต่อเทศบาล / ผู้ประสานงานพื้นที่</h2><div class="muted">เลือกพื้นที่ของคุณ แล้วโทรหาผู้ประสานงานประจำพื้นที่ได้เลย</div>
    <select id="areaSel"><option value="">— เลือกพื้นที่ —</option>${c.areas.map((a) => `<option value="${a.id}">${esc(a.name)} (${esc(a.org)})</option>`).join('')}</select><div id="areaOut"></div></div>
   <div class="card"><h2>🩺 ผู้ป่วย ติดต่อหมอ</h2><div class="muted">เบอร์โรงพยาบาลและสาธารณสุขอำเภอบางละมุง</div><ul class="list">${c.health.map((h) => `<li><span>${esc(h.name)}<br><span class="muted">${esc(h.note || '')}</span></span>${tel(h.phone)}</li>`).join('')}</ul></div>
  </div>
  <div class="card sos" style="margin-top:12px;text-align:center">ติดอยู่ต้องอพยพ หรือเจ็บป่วยฉุกเฉิน โทร <a href="tel:1669">1669</a>·<a href="tel:1784">1784</a> · พัทยา <a href="tel:1337">1337</a><br><a href="#/help?kind=evacuate" style="font-size:15px">หรือแจ้งขออพยพทางเว็บ →</a></div>
  <a class="card big report" href="#/report" style="margin-top:12px"><h2>📏 รายงานระดับน้ำ</h2><div class="muted">บอกว่าน้ำสูงแค่ไหนตรงที่คุณอยู่ ใช้เวลาไม่ถึงนาที</div></a>
  <div class="card" style="margin-top:12px"><h2>📍 น้ำท่วมใกล้บ้านฉันไหม?</h2><button class="btn" id="near">ตรวจใกล้ฉัน</button> <select id="nearArea" style="width:auto"><option value="">หรือเลือกพื้นที่</option>${c.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><div id="nearOut"></div><div class="muted">ตำแหน่งใช้คำนวณในเครื่องของคุณเท่านั้น ไม่ถูกส่งไปเก็บ</div></div>
  <div class="card svc" style="margin-top:12px"><h2>บริการอื่น</h2>
   <a href="#/map"><b>🗺️ แผนที่น้ำท่วม + เส้นทางเลี่ยง</b><br><span class="muted">จุดน้ำท่วม คำขอช่วยเหลือ ถนนปิด และหาเส้นทางเลี่ยงน้ำ</span></a>
   <a href="#/status"><b>🔎 เช็กสถานะเคส</b><br><span class="muted">ใช้เลขเคสกับเบอร์โทร 4 ตัวท้าย</span></a>
   <a href="#/area"><b>🏘️ พื้นที่ของฉัน</b><br><span class="muted">สีแต่ละพื้นที่ตามระดับน้ำที่ประชาชนรายงาน</span></a>
   <a href="#/updates"><b>🕒 อัปเดตระดับน้ำล่าสุด</b><br><span class="muted">ใครรายงานอะไร ที่ไหน เรียงจากล่าสุด</span></a>
   <a href="#/missing"><b>🧑‍🤝‍🧑 ตามหาคน</b><br><span class="muted">ญาติติดต่อไม่ได้ แจ้งศูนย์ช่วยตามหา (ไม่ประกาศสาธารณะ)</span></a>
   <a href="#/lost-found"><b>🐾 ของหาย–ได้คืน</b><br><span class="muted">ตามหาสัตว์เลี้ยง เอกสาร ของมีค่า หรือประกาศของที่เก็บได้</span></a>
   <a href="#/cctv"><b>📹 กล้อง CCTV</b><br><span class="muted">ลิงก์กล้องสาธารณะ (เปิดเว็บต้นทาง)</span></a></div>
  <div class="card" style="margin-top:12px"><h2>🌧️ สถานการณ์น้ำตอนนี้</h2><div id="fc">กำลังโหลดพยากรณ์…</div><h3>ระดับน้ำในแม่น้ำและคลอง เทียบกับตลิ่ง</h3><div id="wl">กำลังโหลด…</div><h3>ฝนสะสม 24 ชม. สถานีโทรมาตรใกล้พัทยา</h3><div id="rn">กำลังโหลด…</div>
   <p class="muted">ข้อมูลระดับน้ำ: คลังข้อมูลน้ำแห่งชาติ (สสน.) · พยากรณ์: Open-Meteo · <a href="#/weather">ดูรายละเอียด</a></p></div>
  <div class="card svc" style="margin-top:12px"><h2>ดูข้อมูลน้ำและอากาศเพิ่มเติม</h2>
   <a href="#/weather"><b>พยากรณ์อากาศ ฝน ลม</b><br><span class="muted">กราฟรายชั่วโมง 24 ชม. และเรดาร์ฝน</span></a>
   <a href="https://www.thaiwater.net/" target="_blank"><b>คลังข้อมูลน้ำแห่งชาติ (ThaiWater)</b><br><span class="muted">สถานีวัดน้ำและฝนทั่วประเทศ</span></a>
   <a href="https://bigdata-swoc.rid.go.th/pier/all" target="_blank"><b>กรมชลประทาน</b><br><span class="muted">ระดับน้ำทั้งประเทศ</span></a>
   <a href="https://telemetry.dwr.go.th/home?layerMapType=BASIN" target="_blank"><b>กรมทรัพยากรน้ำ</b><br><span class="muted">สถานีโทรมาตรรายลุ่มน้ำ</span></a>
   <a href="https://weather.tmd.go.th/" target="_blank"><b>กรมอุตุนิยมวิทยา</b><br><span class="muted">เรดาร์ฝนและพยากรณ์</span></a>
   <p class="muted">เปิดในแท็บใหม่ ข้อมูลเป็นของเจ้าของเว็บแต่ละแห่ง</p></div>
  <div class="card" style="margin-top:12px"><h2>📞 เบอร์ฉุกเฉิน</h2><ul class="list">${c.emergency.map((h) => `<li><span>${esc(h.name)}</span>${tel(h.phone)}</li>`).join('')}</ul>
   <p class="muted">รับแจ้งทางเว็บเฉพาะ ${esc(served.join(', '))} พื้นที่อื่นโทรเบอร์ฉุกเฉินด้านบน</p></div>
  <p style="text-align:center"><a class="btn alt" href="#/staff">👮 เจ้าหน้าที่และทีมกู้ภัย เข้าสู่ระบบ</a></p>`;
  $('#areaSel').onchange = (e) => { const a = c.areas.find((x) => x.id === e.target.value); $('#areaOut').innerHTML = a ? `<ul class="list"><li><span><b>${esc(a.coordinator)}</b><br><span class="muted">${esc(a.org)}${a.verified ? ' · ✔ ตรวจสอบจาก ' + esc(a.source || '') : ''}</span></span>${tel(a.phone)}</li></ul>${a.phone ? '' : '<p class="muted">ยังไม่มีเบอร์ผู้ประสานงานพื้นที่นี้ — โทร 1337 (เมืองพัทยา) หรือ 1784</p>'}` : ''; };
  const nearCheck = async (lat, lng) => { const rs = await api('/api/reports?hours=24'); const n = rs.filter((r) => km(lat, lng, r.lat, r.lng) < 1.5); const bad = n.filter((r) => r.cm >= 30);
    $('#nearOut').innerHTML = `<p>${n.length ? `ใน 1.5 กม. มี <b>${n.length}</b> รายงานใน 24 ชม. ${bad.length ? `<span class="err">· น้ำสูงเกินข้อเท้า ${bad.length} จุด</span>` : '<span class="ok">· ไม่มีจุดน้ำสูง</span>'}` : '<span class="ok">ยังไม่มีรายงานน้ำท่วมใน 1.5 กม. (24 ชม.)</span>'} · <a href="#/map">ดูแผนที่</a></p>`; };
  $('#near').onclick = async () => { try { const [a, b] = await gps(); nearCheck(a, b); } catch (e) { $('#nearOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  $('#nearArea').onchange = (e) => { const a = c.areas.find((x) => x.id === e.target.value); a && nearCheck(a.lat, a.lng); };
  loadForecast($('#fc')); loadWater($('#wl')); loadRain($('#rn'));
}
async function loadForecast(el, full) {
  const f = await api('/api/forecast'); if (!f.ok) return (el.innerHTML = `<p class="err">ดึงพยากรณ์จาก Open-Meteo ไม่ได้ (${esc(f.error)})</p>`);
  const max = Math.max(1, ...f.hourly.map((h) => h.mm));
  el.innerHTML = `<p><b>ฝน 24 ชม. ข้างหน้า</b> <span class="badge" style="background:${f.color}">${f.label}</span><br>รวมประมาณ <b>${f.totalMm}</b> มม. · โอกาสสูงสุด <b>${f.maxProb}%</b> · ${f.startTime ? 'เริ่มราว ' + fmt(f.startTime) : 'ไม่มีฝนที่วัดได้'}</p>
   <div class="bars" title="แท่งอ่อน=โอกาสฝน %, แท่งเข้ม=ปริมาณฝน มม.">${f.hourly.map((h) => `<div style="height:${h.prob || 0}%" title="${h.t.slice(11)} · ${h.mm} มม. · ${h.prob}% · ลม ${h.wind} กม./ชม."><i style="height:${Math.min(100, (h.mm / max) * 100)}%"></i></div>`).join('')}</div>
   <div class="ticks">${[0, 6, 12, 18, 23].map((i) => `<span>${f.hourly[i]?.t.slice(11) || ''}</span>`).join('')}</div><p class="muted">แท่งฟ้าอ่อน = โอกาสฝน · แท่งเข้ม = ปริมาณฝน (สูงสุด ${max.toFixed(1)} มม./ชม.) · ${f.stale ? 'ข้อมูลเก่า (ดึงใหม่ไม่สำเร็จ)' : 'Open-Meteo ' + fmt(f.fetchedAt)}</p>
   ${full ? `<table><tr><th>เวลา</th><th>ฝน มม.</th><th>โอกาส</th><th>ลม กม./ชม.</th></tr>${f.hourly.map((h) => `<tr><td>${h.t.slice(11)}</td><td>${h.mm}</td><td>${h.prob}%</td><td>${h.wind}</td></tr>`).join('')}</table>` : ''}`;
}
async function loadWater(el) {
  const w = await api('/api/water'); if (!w.ok) return (el.innerHTML = `<p class="err">ดึงข้อมูลจากคลังข้อมูลน้ำแห่งชาติไม่ได้ในขณะนี้ (${esc(w.error)}) — ไม่แสดงค่าประมาณ</p>`);
  el.innerHTML = w.stations.map((s) => `<div class="st"><span class="badge s${s.sev}">${s.status}</span> <b>${esc(s.name)}</b> <span class="muted">${esc(s.code || '')} · อ.${esc(s.amphoe)} จ.${esc(s.province)} · ห่าง ${s.distanceKm} กม.</span><br>
   ${s.diff == null ? 'ไม่มีข้อมูลระดับตลิ่ง' : s.diff > 0 ? `สูงกว่าตลิ่ง <b>${s.diff.toFixed(2)}</b> ม.` : `ต่ำกว่าตลิ่ง <b>${Math.abs(s.diff).toFixed(2)}</b> ม.`} · ${s.trend} · ระดับ ${s.level} ม.รทก. · วัดเมื่อ ${fmt(s.measuredAt)} · ${esc(s.agency || '')}</div>`).join('') + `<p class="muted">${esc(w.note)}${w.stale ? ' · ⚠ ข้อมูลเก่า' : ''}</p>`;
}
async function loadRain(el) {
  const r = await api('/api/rain'); if (!r.ok) return (el.innerHTML = `<p class="err">ดึงข้อมูลฝนไม่ได้ (${esc(r.error)})</p>`);
  el.innerHTML = `<ul class="list">${r.stations.map((s) => `<li><span>${esc(s.name)} <span class="muted">อ.${esc(s.amphoe)} · ${s.distanceKm} กม. · ${fmt(s.at)}</span></span><b>${s.rain24h} มม.</b></li>`).join('')}</ul>`;
}

// pick location widget
function locPicker(el, initial) {
  el.innerHTML = `<div class="chips"><button type="button" class="chip" data-a="gps">📍 ใช้ตำแหน่งปัจจุบัน</button><input placeholder="พิมพ์ชื่อสถานที่ แล้วกดค้นหา" style="flex:1;min-width:160px;margin:0" class="q"><button type="button" class="chip" data-a="s">ค้นหา</button></div><div class="res"></div><div class="mapsmall" style="margin-top:6px"></div><div class="muted">แตะบนแผนที่ หรือลากหมุดเพื่อขยับ</div>`;
  const m = tiles(L.map($('.mapsmall', el)).setView(initial || CENTER, 14)); const mk = L.marker(initial || CENTER, { draggable: true }).addTo(m); const st = { lat: null, lng: null };
  const set = (ll) => { mk.setLatLng(ll); m.setView(ll, Math.max(m.getZoom(), 16)); st.lat = ll[0]; st.lng = ll[1]; };
  mk.on('dragend', () => { const p = mk.getLatLng(); set([p.lat, p.lng]); }); m.on('click', (e) => set([e.latlng.lat, e.latlng.lng]));
  el.addEventListener('click', async (e) => { const a = e.target.dataset.a; try { if (a === 'gps') set(await gps()); if (a === 's') { const rs = await geocode($('.q', el).value); $('.res', el).innerHTML = rs.length ? rs.map((r, i) => `<div class="chip" data-i="${i}">${esc(r.display_name.slice(0, 70))}</div>`).join('') : 'ไม่พบ'; $('.res', el).onclick = (ev) => { const r = rs[ev.target.dataset.i]; r && set([+r.lat, +r.lon]); $('.res', el).innerHTML = ''; }; } } catch (er) { $('.res', el).textContent = er.message; } });
  st.set = set; setTimeout(() => m.invalidateSize(), 100); return st;
}
const levelChips = (lv) => `<div class="chips" id="lv">${Object.entries(lv).map(([k, v]) => `<span class="chip" data-v="${k}">${esc(v)}</span>`).join('')}</div>`;
function chipSel(el, multi) { const sel = new Set(); el.onclick = (e) => { const v = e.target.dataset.v; if (!v) return; if (!multi) { sel.clear(); el.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); } sel.has(v) ? sel.delete(v) : sel.add(v); e.target.classList.toggle('on', sel.has(v)); }; return sel; }

async function report() {
  const c = await cfg();
  app.innerHTML = back + `<div class="card"><h2>📏 รายงานระดับน้ำ</h2><label>1. น้ำสูงแค่ไหน</label>${levelChips(c.levels)}<br><label>2. ตรงไหน</label><select id="ar"><option value="">พื้นที่ (ไม่บังคับ)</option>${c.contacts.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><div id="loc"></div>
   <label>3. รูปถ่าย (ไม่บังคับ)</label><input type="file" id="ph" accept="image/*" capture="environment"><label>หมายเหตุ</label><input id="nt" maxlength="300" placeholder="เช่น ซอยบัวขาว รถเล็กผ่านไม่ได้"><button class="btn" id="go">ส่งรายงาน</button> <span id="msg"></span>
   <p class="muted">รายงานแสดงบนแผนที่สาธารณะ (ไม่เก็บชื่อ/เบอร์) และใช้คำนวณเส้นทางเลี่ยงน้ำ 24 ชม.</p></div>`;
  const lv = chipSel($('#lv')), loc = locPicker($('#loc'));
  $('#ar').onchange = (e) => { const a = c.contacts.areas.find((x) => x.id === e.target.value); a && loc.set([a.lat, a.lng]); };
  $('#go').onclick = async () => { try { if (!loc.lat) throw new Error('ปักหมุดตำแหน่งก่อน'); const r = await api('/api/reports', { method: 'POST', body: { level: [...lv][0], areaId: $('#ar').value, lat: loc.lat, lng: loc.lng, note: $('#nt').value, photo: await photoData($('#ph')) } }); app.innerHTML = `<div class="card"><h2 class="ok">ขอบคุณ! ส่งรายงาน ${r.id} แล้ว</h2><a class="btn" href="#/map">ดูบนแผนที่</a> <a class="btn alt" href="#/">หน้าหลัก</a></div>`; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
async function helpForm(kind) {
  const c = await cfg(); const served = c.contacts.areas.filter((a) => a.served);
  const T = { food: '🍚 ขออาหาร / ถุงยังชีพ', evacuate: '🚤 ขอความช่วยเหลือ / อพยพ', medical: '💊 ผู้ป่วย / ขอยา' };
  app.innerHTML = back + `<div class="card"><h2>${T[kind] || T.food}</h2>
   <p class="sos card" style="font-size:14px">ถ้าติดอยู่ต้องอพยพ หรือเจ็บป่วยฉุกเฉิน โทร <a href="tel:1669">1669</a> ทันที — เว็บนี้รับเฉพาะพื้นที่: ${esc(served.map((a) => a.name).join(', '))}</p>
   <div class="tabs">${Object.entries(T).map(([k, v]) => `<a class="chip ${k === kind ? 'on' : ''}" href="#/${k === 'food' ? 'sos' : 'help?kind=' + k}">${v}</a>`).join('')}</div>
   <label>1. บ้านอยู่ที่ไหน</label><select id="ar"><option value="">— เลือกพื้นที่ —</option>${c.contacts.areas.map((a) => `<option value="${a.id}" ${a.served ? '' : 'disabled'}>${esc(a.name)}${a.served ? '' : ' (ยังไม่เปิดรับทางเว็บ)'}</option>`).join('')}</select><div id="loc"></div><input id="ad" placeholder="บ้านเลขที่ ซอย จุดสังเกต (หรือวางลิงก์ Google Maps)">
   <label>2. ต้องการอะไรบ้าง (เลือกได้หลายข้อ)</label><div class="chips" id="nd">${['ข้าวสาร / อาหาร', 'น้ำดื่ม', 'ถุงยังชีพ', 'ยา / เวชภัณฑ์', 'นม / ผ้าอ้อมเด็ก', 'อาหารหมา / แมว', 'เรือ / อพยพ', 'ผู้ป่วยติดเตียง'].map((x) => `<span class="chip" data-v="${x}">${x}</span>`).join('')}</div>
   <label>ในบ้านมีกี่คน</label><input id="pp" type="number" min="1" value="1"><label>น้ำสูงแค่ไหน (ไม่บังคับ)</label>${levelChips(c.levels)}
   <label>3. ชื่อและเบอร์โทร</label><input id="nm" placeholder="ชื่อ"><input id="tl" type="tel" placeholder="เบอร์โทร"><textarea id="nt" placeholder="รายละเอียดเพิ่มเติม"></textarea><label>รูปถ่าย (ไม่บังคับ)</label><input type="file" id="ph" accept="image/*">
   <p class="muted">ข้อมูลของคุณใช้เพื่อการช่วยเหลือเท่านั้น เห็นเฉพาะเจ้าหน้าที่</p><button class="btn" id="go">ส่งคำขอ</button> <span id="msg"></span></div>`;
  const loc = locPicker($('#loc')), nd = chipSel($('#nd'), true), lv = chipSel($('#lv'));
  $('#ar').onchange = (e) => { const a = c.contacts.areas.find((x) => x.id === e.target.value); a && loc.set([a.lat, a.lng]); };
  $('#go').onclick = async () => { try { const r = await api('/api/requests', { method: 'POST', body: { kind, areaId: $('#ar').value, lat: loc.lat, lng: loc.lng, address: $('#ad').value, needs: [...nd], people: $('#pp').value, level: [...lv][0], name: $('#nm').value, phone: $('#tl').value, note: $('#nt').value, photo: await photoData($('#ph')) } });
    app.innerHTML = `<div class="card"><h2 class="ok">ส่งคำขอแล้ว</h2><p>เลขเคสของคุณ: <b style="font-size:24px">${r.id}</b><br>จดเลขเคสไว้ เช็กสถานะได้ด้วยเลขเคส + เบอร์ 4 ตัวท้าย</p><a class="btn" href="#/status?id=${r.id}">เช็กสถานะ</a> <a class="btn alt" href="#/">หน้าหลัก</a></div>`; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
async function status(q) {
  app.innerHTML = back + `<div class="card"><h2>🔎 เช็กสถานะเคส</h2><input id="id" placeholder="เลขเคส เช่น C-1001" value="${esc(q.id || '')}"><input id="p4" placeholder="เบอร์โทร 4 ตัวท้าย" maxlength="4" inputmode="numeric"><button class="btn" id="go">ตรวจสอบ</button><div id="out"></div></div>`;
  const go = async () => { try { const r = await api(`/api/status?id=${encodeURIComponent($('#id').value)}&phone=${encodeURIComponent($('#p4').value)}`); $('#out').innerHTML = `<h3>${esc(r.id)} · ${esc(r.kind)} · ${esc(r.areaName)}</h3><p><b>${esc(r.statusText)}</b>${r.assignee ? ' · ทีม: ' + esc(r.assignee) : ''}</p><ul>${r.history.map((h) => `<li>${fmt(h.at)} — ${esc(h.s)} ${esc(h.note || '')}</li>`).join('')}</ul>`; } catch (e) { $('#out').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  $('#go').onclick = go; on((t, d) => t === 'request' && d.id === $('#id')?.value && go());
}
async function area() {
  const c = await cfg(); const rs = await api('/api/reports?hours=24');
  const agg = c.contacts.areas.map((a) => { const n = rs.filter((r) => r.areaId === a.id || km(a.lat, a.lng, r.lat, r.lng) < 1.2); const mx = Math.max(0, ...n.map((r) => r.cm)); return { a, n: n.length, mx }; });
  const col = (mx) => mx >= 115 ? '#dc2626' : mx >= 75 ? '#ea580c' : mx >= 30 ? '#ca8a04' : '#16a34a';
  app.innerHTML = back + `<div class="card"><h2>🏘️ พื้นที่ของฉัน</h2><p class="muted">สีตามระดับน้ำสูงสุดที่ประชาชนรายงานใน 24 ชม. (รัศมี ~1.2 กม.)</p><div id="map" style="height:50vh"></div><ul class="list">${agg.map((x) => `<li><span><span class="badge" style="background:${col(x.mx)}">${x.mx ? '~' + x.mx + ' ซม.' : 'ไม่มีรายงาน'}</span> ${esc(x.a.name)}</span><span class="muted">${x.n} รายงาน</span></li>`).join('')}</ul></div>`;
  const m = tiles(L.map('map').setView(CENTER, 12)); agg.forEach((x) => L.circle([x.a.lat, x.a.lng], { radius: 1200, color: col(x.mx), fillOpacity: 0.3 }).addTo(m).bindPopup(`${esc(x.a.name)}<br>${x.n} รายงาน`));
}
async function updates() {
  const draw = async () => { const rs = await api('/api/reports?hours=72'); $('#ul').innerHTML = rs.length ? rs.map((r) => `<li><span><span class="badge" style="background:${LVCOL[r.level]}">${esc(r.levelText)}</span><br>${esc(r.areaName || 'ไม่ระบุพื้นที่')} · ${esc(r.note || '')}<br><span class="muted">${fmt(r.createdAt)} · ${r.id}${r.status === 'verified' ? ' · ✔ เจ้าหน้าที่ยืนยัน' : ''}</span></span>${r.photo ? `<img class="thumb" src="${r.photo}">` : ''}</li>`).join('') : '<li>ยังไม่มีรายงานใน 72 ชม.</li>'; };
  app.innerHTML = back + `<div class="card"><h2>🕒 อัปเดตระดับน้ำล่าสุด</h2><p class="muted">อัปเดตอัตโนมัติแบบเรียลไทม์</p><ul class="list" id="ul"></ul></div>`; await draw(); on((t) => (t === 'report' || t === 'deleted') && draw());
}
async function missing() {
  app.innerHTML = back + `<div class="card"><h2>🧑‍🤝‍🧑 ตามหาคน</h2><p class="muted">ข้อมูลส่งถึงเจ้าหน้าที่เท่านั้น ไม่ประกาศสาธารณะ</p><input id="pn" placeholder="ชื่อผู้ที่ติดต่อไม่ได้"><input id="ag" placeholder="อายุ"><textarea id="ls" placeholder="อยู่ที่ไหนครั้งสุดท้าย / ที่อยู่"></textarea><textarea id="ds" placeholder="ลักษณะ / โรคประจำตัว"></textarea><input id="rn" placeholder="ชื่อผู้แจ้ง"><input id="rp" type="tel" placeholder="เบอร์ผู้แจ้ง"><input type="file" id="ph" accept="image/*"><button class="btn" id="go">แจ้งศูนย์</button> <span id="msg"></span></div>`;
  $('#go').onclick = async () => { try { const r = await api('/api/missing', { method: 'POST', body: { personName: $('#pn').value, age: $('#ag').value, lastSeen: $('#ls').value, description: $('#ds').value, reporterName: $('#rn').value, reporterPhone: $('#rp').value, photo: await photoData($('#ph')) } }); $('#msg').innerHTML = `<span class="ok">รับเรื่อง ${r.id} แล้ว เจ้าหน้าที่จะติดต่อกลับ</span>`; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
async function lostFound() {
  const draw = async () => { const ls = await api('/api/lostfound'); $('#lf').innerHTML = ls.map((x) => `<li><span><span class="badge ${x.type === 'lost' ? 's2' : 's0'}">${x.type === 'lost' ? 'ตามหา' : 'เก็บได้'}</span> <b>${esc(x.title)}</b> <span class="muted">${esc(x.category)}</span><br>${esc(x.detail)}<br><span class="muted">${esc(x.place)} · ${fmt(x.createdAt)} · ติดต่อ ${x.phoneMasked} (ผ่านเจ้าหน้าที่)</span></span>${x.photo ? `<img class="thumb" src="${x.photo}">` : ''}</li>`).join('') || '<li>ยังไม่มีประกาศ</li>'; };
  app.innerHTML = back + `<div class="card"><h2>🐾 ของหาย–ได้คืน</h2><select id="ty"><option value="lost">ตามหา (ของหาย/สัตว์หาย)</option><option value="found">เก็บได้</option></select><select id="ct"><option>สัตว์เลี้ยง</option><option>เอกสาร</option><option>ของมีค่า</option><option>ยานพาหนะ</option><option>อื่น ๆ</option></select><input id="ti" placeholder="หัวข้อ เช่น แมวส้ม ชื่อส้มโอ"><textarea id="dt" placeholder="รายละเอียด"></textarea><input id="pl" placeholder="สถานที่"><input id="tl" type="tel" placeholder="เบอร์ติดต่อ (แสดงแค่ 4 ตัวท้าย)"><input type="file" id="ph" accept="image/*"><button class="btn" id="go">ประกาศ</button> <span id="msg"></span><h3>ประกาศล่าสุด</h3><ul class="list" id="lf"></ul></div>`;
  $('#go').onclick = async () => { try { await api('/api/lostfound', { method: 'POST', body: { type: $('#ty').value, category: $('#ct').value, title: $('#ti').value, detail: $('#dt').value, place: $('#pl').value, phone: $('#tl').value, photo: await photoData($('#ph')) } }); $('#msg').innerHTML = '<span class="ok">ประกาศแล้ว</span>'; draw(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
  draw(); on((t) => (t === 'lostfound' || t === 'deleted') && draw());
}
function cctv() {
  app.innerHTML = back + `<div class="card svc"><h2>📹 กล้อง CCTV</h2><p class="muted">ระบบนี้ยังไม่ได้ฝังภาพสดของกล้องในพัทยา (ไม่มีแหล่งสาธารณะที่ตรวจสอบได้) — เปิดเว็บต้นทาง:</p>
   <a href="https://cctv.maholan.net/" target="_blank"><b>กล้อง CCTV ทั่วไทย</b><br><span class="muted">รวมกล้องสาธารณะทั่วประเทศ ค้นหา "พัทยา" / "ชลบุรี"</span></a>
   <a href="https://www.thaiwater.net/" target="_blank"><b>ThaiWater</b><br><span class="muted">ภาพสถานีโทรมาตร</span></a><p class="muted">เจ้าหน้าที่สามารถเพิ่มลิงก์กล้องในอนาคตได้ (ดู README)</p></div>`;
}
async function weather() { app.innerHTML = back + `<div class="card"><h2>🌧️ พยากรณ์อากาศ ฝน ลม — พัทยา</h2><div id="fc"></div><h3>เรดาร์ฝน</h3><iframe title="radar" style="width:100%;height:380px;border:0;border-radius:10px" src="https://embed.windy.com/embed2.html?lat=12.92&lon=100.88&zoom=9&overlay=radar&product=radar"></iframe></div><div class="card" style="margin-top:12px"><h2>ระดับน้ำ</h2><div id="wl"></div><h3>ฝนสะสม 24 ชม.</h3><div id="rn"></div></div>`; loadForecast($('#fc'), true); loadWater($('#wl')); loadRain($('#rn')); }

// ---------- map + avoidance routing ----------
async function mapPage(q) {
  app.innerHTML = `<div class="card"><h2>🗺️ แผนที่น้ำท่วม · เส้นทางเลี่ยงน้ำ</h2>
   <div class="legend muted"><span>● <b style="color:#dc2626">รายงานน้ำ</b></span><span>■ <b style="color:#7c3aed">คำขอช่วยเหลือ</b></span><span>━ <b style="color:#16a34a">เส้นทางเลี่ยงทางการ</b></span><span>━ <b style="color:#000">ถนนปิด</b></span><span>▲ สถานีวัดน้ำ</span></div>
   <div id="map"></div>
   <h3>🚗 หาเส้นทางเลี่ยงน้ำท่วม</h3><div class="chips"><button class="chip on" id="mA">1) จุดเริ่ม: แตะแผนที่</button><button class="chip" id="gA">📍 ใช้ GPS</button><button class="chip" id="mB">2) ปลายทาง: แตะแผนที่</button></div>
   <div class="chips" style="margin-top:6px"><input id="qB" placeholder="หรือค้นหาปลายทาง เช่น โรงพยาบาลเมืองพัทยา" style="flex:1;margin:0"><button class="chip" id="sB">ค้นหา</button></div><div id="resB"></div>
   <p><button class="btn" id="route">คำนวณเส้นทางเลี่ยงน้ำ</button> <button class="btn alt" id="clr">ล้าง</button></p><div id="rOut"></div></div>`;
  const m = tiles(L.map('map').setView(CENTER, 13)); const lay = { rep: L.layerGroup().addTo(m), req: L.layerGroup().addTo(m), roads: L.layerGroup().addTo(m), st: L.layerGroup().addTo(m), route: L.layerGroup().addTo(m) };
  L.control.layers(null, { 'รายงานระดับน้ำ': lay.rep, 'คำขอช่วยเหลือ': lay.req, 'เส้นทางเลี่ยง/ถนนปิด': lay.roads, 'สถานีวัดน้ำ (สสน.)': lay.st }).addTo(m);
  const drawRep = async () => { lay.rep.clearLayers(); (await api('/api/reports?hours=48')).forEach((r) => L.circleMarker([r.lat, r.lng], { radius: 9, color: '#fff', weight: 2, fillColor: LVCOL[r.level], fillOpacity: 0.9 }).addTo(lay.rep).bindPopup(`<b>${esc(r.levelText)}</b><br>${esc(r.areaName || '')} ${esc(r.note || '')}<br>${fmt(r.createdAt)}${r.photo ? `<br><img src="${r.photo}" width="160">` : ''}`)); };
  const drawReq = async () => { lay.req.clearLayers(); (await api('/api/requests/public')).filter((r) => r.lat && !['resolved', 'closed'].includes(r.status)).forEach((r) => L.marker([r.lat, r.lng], { icon: L.divIcon({ html: '🆘', className: '', iconSize: [20, 20] }) }).addTo(lay.req).bindPopup(`<b>${esc(r.id)}</b> ${esc(r.areaName)}<br>${esc(r.needs.join(', '))}<br>สถานะ: ${esc(r.status)}<br><span style="font-size:12px">ตำแหน่งปัดเศษเพื่อความเป็นส่วนตัว</span>`)); };
  const drawRoads = (rs) => { lay.roads.clearLayers(); rs.forEach((w) => L.polyline(w.points, { color: w.type === 'closed' ? '#000' : '#16a34a', weight: 7, dashArray: w.type === 'closed' ? '6 8' : null, opacity: 0.85 }).addTo(lay.roads).bindPopup(`<b>${w.type === 'closed' ? '⛔ ถนนปิด' : '✅ เส้นทางเลี่ยงทางการ'}</b><br>${esc(w.title)}<br>${esc(w.note || '')}<br>${fmt(w.createdAt)}`)); };
  drawRep(); drawReq(); drawRoads(await api('/api/roads'));
  api('/api/water').then((w) => w.ok && w.stations.forEach((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ html: '▲', className: '', iconSize: [16, 16] }) }).addTo(lay.st).bindPopup(`${esc(s.name)}<br>${s.status} · ${fmt(s.measuredAt)}`)));
  on((t, d) => { if (t === 'report' || t === 'deleted') drawRep(); if (t === 'request' || t === 'deleted') drawReq(); if (t === 'roads') drawRoads(d); });
  const st = { mode: 'A', A: null, B: null, mA: null, mB: null };
  const setPt = (k, ll) => { st[k] = ll; st['m' + k] && m.removeLayer(st['m' + k]); st['m' + k] = L.marker(ll, { icon: L.divIcon({ html: k === 'A' ? '🟢' : '🏁', className: '', iconSize: [22, 22] }) }).addTo(m); if (k === 'A') { st.mode = 'B'; $('#mB').classList.add('on'); $('#mA').classList.remove('on'); } };
  m.on('click', (e) => setPt(st.mode, [e.latlng.lat, e.latlng.lng]));
  $('#mA').onclick = () => { st.mode = 'A'; $('#mA').classList.add('on'); $('#mB').classList.remove('on'); }; $('#mB').onclick = () => { st.mode = 'B'; $('#mB').classList.add('on'); $('#mA').classList.remove('on'); };
  $('#gA').onclick = async () => { try { const p = await gps(); setPt('A', p); m.setView(p, 15); } catch (e) { $('#rOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  $('#sB').onclick = async () => { const rs = await geocode($('#qB').value); $('#resB').innerHTML = rs.map((r, i) => `<div class="chip" data-i="${i}">${esc(r.display_name.slice(0, 80))}</div>`).join('') || 'ไม่พบ'; $('#resB').onclick = (e) => { const r = rs[e.target.dataset.i]; if (r) { setPt('B', [+r.lat, +r.lon]); m.setView([+r.lat, +r.lon], 14); $('#resB').innerHTML = ''; } }; };
  $('#clr').onclick = () => { lay.route.clearLayers(); ['mA', 'mB'].forEach((k) => st[k] && m.removeLayer(st[k])); st.A = st.B = null; st.mode = 'A'; $('#rOut').innerHTML = ''; };
  const calc = async () => {
    if (!st.A || !st.B) return ($('#rOut').innerHTML = '<p class="err">เลือกจุดเริ่มและปลายทางก่อน</p>'); $('#rOut').innerHTML = 'กำลังคำนวณ…';
    try { const r = await api(`/api/route?fromLat=${st.A[0]}&fromLng=${st.A[1]}&toLat=${st.B[0]}&toLng=${st.B[1]}`); lay.route.clearLayers();
      r.zones.forEach((z) => L.circle([z.lat, z.lng], { radius: z.rM, color: '#dc2626', weight: 1, fillOpacity: 0.12 }).addTo(lay.route));
      r.alternatives.forEach((a) => L.polyline(a.coords.map(([x, y]) => [y, x]), { color: '#94a3b8', weight: 4, dashArray: '4 6' }).addTo(lay.route).bindPopup(a.floodHits.length ? 'ผ่านจุดน้ำ: ' + a.floodHits.join(', ') : 'ทางเลือก'));
      const b = r.best, pl = L.polyline(b.coords.map(([x, y]) => [y, x]), { color: r.avoids ? '#2563eb' : '#dc2626', weight: 6 }).addTo(lay.route); m.fitBounds(pl.getBounds(), { padding: [30, 30] });
      $('#rOut').innerHTML = `${r.avoids ? `<p class="good">✅ เส้นทางนี้เลี่ยงจุดน้ำท่วมที่รายงาน ${r.zonesCount} จุด/โซน ได้ทั้งหมด</p>` : r.warning ? `<p class="warn">⚠ ${esc(r.warning)}<br>ผ่าน: ${esc(b.floodHits.join(', '))}</p>` : '<p class="good">ยังไม่มีจุดน้ำท่วมรายงานในขณะนี้</p>'}
        <p><b>${(b.distance / 1000).toFixed(1)} กม.</b> · ประมาณ <b>${Math.round(b.duration / 60)} นาที</b> (ไม่รวมการจราจร/น้ำ) · ${esc(r.engine)}</p>
        <p><a class="btn green" target="_blank" href="${r.gmaps}">เปิดใน Google Maps (มีจุดผ่าน)</a></p><ol class="steps">${b.steps.filter((s) => s.text).map((s) => `<li>${esc(s.text)} <span class="muted">${s.distance >= 1000 ? (s.distance / 1000).toFixed(1) + ' กม.' : Math.round(s.distance) + ' ม.'}</span></li>`).join('')}</ol><p class="muted">⚠ เส้นทางคำนวณจากรายงานประชาชนและประกาศเจ้าหน้าที่ อาจไม่ครบถ้วน ห้ามขับผ่านน้ำไหลเชี่ยว</p>`;
    } catch (e) { $('#rOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $('#route').onclick = calc;
  if (q.demo) { setPt('A', [12.9505, 100.8890]); setPt('B', [12.9030, 100.8960]); calc(); }
}

// ---------- staff ----------
async function staffPage() {
  let me; try { me = await api('/api/staff/me'); } catch {}
  if (!me) { app.innerHTML = back + `<div class="card"><h2>👮 เจ้าหน้าที่และทีมกู้ภัย เข้าสู่ระบบ</h2><input id="nm" placeholder="ชื่อ / ทีม (เช่น กู้ภัยสว่างฯ ชุด 3)"><input id="pw" type="password" placeholder="รหัสผ่าน"><button class="btn" id="go">เข้าสู่ระบบ</button> <span id="msg"></span></div>`;
    $('#go').onclick = async () => { try { await api('/api/staff/login', { method: 'POST', body: { name: $('#nm').value, password: $('#pw').value } }); render(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } }; return; }
  let tab = 'requests', data;
  const S = { requests: ['new', 'triaged', 'assigned', 'enroute', 'resolved', 'closed'], reports: ['new', 'verified', 'hidden'], missing: ['searching', 'found', 'closed'], lostfound: ['open', 'closed', 'hidden'], roads: ['open', 'hidden'] };
  const row = (c, x) => `<tr><td><b>${x.id}</b><br><span class="muted">${fmt(x.createdAt)}</span></td><td>${c === 'requests' ? `${esc(x.areaName)} · ${esc(x.kind)} · ${x.people} คน<br>${esc(x.needs.join(', '))}<br>${esc(x.name)} ${tel(x.phone)}<br>${esc(x.address)} ${esc(x.note)}${x.lat ? ` <a target="_blank" href="https://www.google.com/maps?q=${x.lat},${x.lng}">แผนที่</a>` : ''}` : c === 'reports' ? `${esc(x.areaName || '')} · ${esc(x.level)} · ${esc(x.note)}` : c === 'missing' ? `<b>${esc(x.personName)}</b> ${esc(x.age)}<br>${esc(x.lastSeen)} ${esc(x.description)}<br>ผู้แจ้ง ${esc(x.reporterName)} ${tel(x.reporterPhone)}` : c === 'roads' ? `${x.type === 'closed' ? '⛔ ถนนปิด' : '✅ เส้นทางเลี่ยง'} ${esc(x.title)} (${x.points.length} จุด)` : `${esc(x.type)} ${esc(x.title)} ${tel(x.phone)}`}${x.photo ? `<br><img class="thumb" src="${x.photo}">` : ''}</td>
    <td><select data-c="${c}" data-id="${x.id}" class="sst" style="width:auto">${S[c].map((s) => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>${c === 'requests' ? `<input class="asg" data-id="${x.id}" placeholder="มอบหมายทีม" value="${esc(x.assignee || '')}">` : ''}<button class="btn sm red del" data-c="${c}" data-id="${x.id}">ลบ</button></td></tr>`;
  const draw = async () => { data = await api('/api/staff/data'); data.roads = await api('/api/roads'); const n = (c) => data[c].filter((x) => ['new', 'searching'].includes(x.status)).length;
    app.innerHTML = `<div class="card"><h2>👮 แผงเจ้าหน้าที่ · ${esc(me.name)}</h2><div class="tabs">${['requests', 'reports', 'missing', 'lostfound', 'roads'].map((c) => `<button class="chip ${c === tab ? 'on' : ''}" data-tab="${c}">${{ requests: 'คำขอช่วยเหลือ', reports: 'รายงานระดับน้ำ', missing: 'ตามหาคน', lostfound: 'ของหาย', roads: 'เส้นทางเลี่ยง/ถนนปิด' }[c]} ${n(c) ? `(${n(c)})` : ''}</button>`).join('')}<a class="chip" href="#/admin">แก้ไขเบอร์ติดต่อ</a><button class="chip" id="lo">ออกจากระบบ</button></div>
     ${tab === 'roads' ? `<div id="map" style="height:45vh"></div><p class="muted">แตะแผนที่เพื่อวางจุดตามแนวถนน แล้วกดเผยแพร่ — แสดงบนแผนที่สาธารณะทันที และ "ถนนปิด" ถูกใช้หลบในการคำนวณเส้นทาง</p><select id="rt" style="width:auto"><option value="detour">✅ เส้นทางเลี่ยง</option><option value="closed">⛔ ถนนปิด</option></select><input id="rti" placeholder="ชื่อ เช่น เลี่ยงสุขุมวิท-แยกเฉลิมพระเกียรติ"><input id="rno" placeholder="หมายเหตุ"><button class="btn" id="pub">เผยแพร่</button> <button class="btn alt" id="undo">ลบจุดล่าสุด</button> <span id="msg"></span>` : ''}
     <div style="overflow:auto"><table><tr><th>เคส</th><th>รายละเอียด</th><th>จัดการ</th></tr>${data[tab].map((x) => row(tab, x)).join('') || '<tr><td colspan=3>ไม่มีรายการ</td></tr>'}</table></div></div>`;
    app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    $('#lo').onclick = async () => { await api('/api/staff/logout', { method: 'POST' }); render(); };
    app.querySelectorAll('.sst').forEach((s) => (s.onchange = () => api(`/api/staff/${s.dataset.c}/${s.dataset.id}`, { method: 'PATCH', body: { status: s.value } }).then(draw)));
    app.querySelectorAll('.asg').forEach((s) => (s.onchange = () => api(`/api/staff/requests/${s.dataset.id}`, { method: 'PATCH', body: { assignee: s.value, status: 'assigned' } }).then(draw)));
    app.querySelectorAll('.del').forEach((b) => (b.onclick = () => confirm('ลบรายการนี้ถาวร?') && api(`/api/staff/${b.dataset.c}/${b.dataset.id}`, { method: 'DELETE' }).then(draw)));
    if (tab === 'roads') { const m = tiles(L.map('map').setView(CENTER, 13)); const pts = []; const pl = L.polyline([], { color: '#16a34a', weight: 6 }).addTo(m);
      data.roads.forEach((w) => L.polyline(w.points, { color: w.type === 'closed' ? '#000' : '#16a34a', weight: 5, opacity: 0.5, dashArray: w.type === 'closed' ? '6 8' : null }).addTo(m));
      m.on('click', (e) => { pts.push([e.latlng.lat, e.latlng.lng]); pl.setLatLngs(pts); }); $('#rt').onchange = () => pl.setStyle({ color: $('#rt').value === 'closed' ? '#000' : '#16a34a' });
      $('#undo').onclick = () => { pts.pop(); pl.setLatLngs(pts); };
      $('#pub').onclick = async () => { try { await api('/api/staff/roads', { method: 'POST', body: { type: $('#rt').value, title: $('#rti').value, note: $('#rno').value, points: pts } }); draw(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } }; }
  };
  await draw(); on((t) => t.startsWith('staff:') && tab !== 'roads' && draw());
}
async function adminPage() {
  try { await api('/api/staff/me'); } catch { location.hash = '#/staff'; return; }
  const c = (await cfg(true)).contacts;
  const tbl = (k, cols) => `<h3>${{ areas: 'พื้นที่ / ผู้ประสานงาน', health: 'โรงพยาบาล / สาธารณสุข', emergency: 'เบอร์ฉุกเฉิน' }[k]}</h3><div style="overflow:auto"><table data-k="${k}"><tr>${cols.map((x) => `<th>${x}</th>`).join('')}<th></th></tr>${c[k].map((r) => `<tr>${cols.map((x) => `<td>${x === 'verified' || x === 'served' ? `<input type="checkbox" data-f="${x}" ${r[x] ? 'checked' : ''}>` : `<input data-f="${x}" value="${esc(r[x] ?? '')}" placeholder="${x === 'phone' ? 'รอใส่เบอร์' : ''}">`}</td>`).join('')}<td><button class="btn sm red rm">ลบ</button></td></tr>`).join('')}</table></div><button class="btn sm alt add" data-k="${k}">+ เพิ่มแถว</button>`;
  const cols = { areas: ['id', 'name', 'org', 'coordinator', 'phone', 'lat', 'lng', 'served', 'verified', 'source'], health: ['name', 'phone', 'note', 'verified', 'source'], emergency: ['name', 'phone', 'verified', 'source'] };
  app.innerHTML = `<p><a href="#/staff">← แผงเจ้าหน้าที่</a></p><div class="card"><h2>⚙️ แก้ไขเบอร์ติดต่อ</h2><p class="muted">ช่อง phone ว่าง = แสดง "รอใส่เบอร์" · ติ๊ก verified เมื่อยืนยันเบอร์แล้ว และใส่แหล่งที่มา · served = เปิดรับคำขอทางเว็บ</p>${Object.keys(cols).map((k) => tbl(k, cols[k])).join('')}<p><button class="btn" id="save">บันทึก</button> <span id="msg"></span></p></div>`;
  app.onclick = (e) => { if (e.target.classList.contains('rm')) e.target.closest('tr').remove(); if (e.target.classList.contains('add')) { const t = app.querySelector(`table[data-k="${e.target.dataset.k}"]`); const tr = t.rows[1]?.cloneNode(true); if (tr) { tr.querySelectorAll('input').forEach((i) => (i.type === 'checkbox' ? (i.checked = false) : (i.value = ''))); t.appendChild(tr); } } };
  $('#save').onclick = async () => { const body = {}; app.querySelectorAll('table[data-k]').forEach((t) => (body[t.dataset.k] = [...t.rows].slice(1).map((tr) => Object.fromEntries([...tr.querySelectorAll('[data-f]')].map((i) => [i.dataset.f, i.type === 'checkbox' ? i.checked : i.value]))))); try { await api('/api/staff/contacts', { method: 'PUT', body }); C.cfg = null; $('#msg').innerHTML = '<span class="ok">บันทึกแล้ว (เผยแพร่ทันที)</span>'; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
