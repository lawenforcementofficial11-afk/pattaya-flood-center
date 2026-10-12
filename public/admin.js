// ระบบหลังบ้าน (back-office) — ศูนย์ช่วยเหลือน้ำท่วมเมืองพัทยา
const $ = (s, r = document) => r.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (u, o = {}) => { const r = await fetch(u, { headers: { 'content-type': 'application/json' }, credentials: 'same-origin', ...o, body: o.body && JSON.stringify(o.body) }); const j = await r.json().catch(() => ({})); if (r.status === 401 && !u.includes('login')) { SC = null; showLogin(); throw new Error(j.error); } if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
const fmt = (iso) => iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-';
const toast = (m, ok = true) => { const d = document.createElement('div'); d.textContent = m; d.style.cssText = `position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:${ok ? '#166534' : '#b91c1c'};color:#fff;padding:10px 16px;border-radius:10px;z-index:3000`; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); };
let SC = null; const RANK = { staff: 1, admin: 2, superadmin: 3 }; const can = (r) => SC && RANK[SC.me.role] >= RANK[r];
const ACT = { login: 'เข้าสู่ระบบ', update: 'แก้ไข', delete: 'ลบ', create: 'สร้าง', contacts: 'แก้เบอร์ติดต่อ', texts: 'แก้ข้อความ', 'text-reset': 'คืนค่าข้อความ', antispam: 'ตั้งค่ากันสแปม', settings: 'ตั้งค่าเว็บ', password: 'เปลี่ยนรหัสผ่าน', export: 'ส่งออก CSV', 'bulk-status': 'เปลี่ยนสถานะหลายรายการ', 'mod-approve': 'อนุมัติรายงาน', 'mod-reject': 'ปฏิเสธรายงาน', 'mod-hold': 'กักรายงานไว้ตรวจ', 'mod-auto': 'ยืนยันอัตโนมัติ', 'mod-held': 'กักอัตโนมัติ', 'mod-cleared': 'แจ้งน้ำลดแล้ว', 'mod-mode': 'เปลี่ยนโหมดตรวจสอบ', 'mod-settings': 'ตั้งค่าการตรวจสอบ' };
let MODN = 0; const modBadgeNav = () => { const a = document.querySelector('#nav a[href="#mod"]'); if (a) a.innerHTML = '🛂 ตรวจสอบรายงาน' + (MODN ? ` <span class="nbadge">${MODN}</span>` : ''); };
const sseL = new Set(); function adminSSE() { const es = new EventSource('/api/events');
  es.addEventListener('staff:mod', (e) => { MODN = JSON.parse(e.data).total; modBadgeNav(); sseL.forEach((f) => f('staff:mod')); });
  for (const t of ['staff:report', 'staff:lostfound', 'staff:update']) es.addEventListener(t, () => sseL.forEach((f) => f(t))); }

function showLogin() {
  $('#nav').innerHTML = ''; $('#who').textContent = '';
  app.innerHTML = `<div class="card" style="max-width:420px;margin:30px auto"><h2>🔐 เข้าสู่ระบบหลังบ้าน</h2><form id="lf" method="post" action="#" autocomplete="on"><label for="un">ชื่อผู้ใช้</label><input id="un" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="admin"><label for="pw">รหัสผ่าน</label><input id="pw" name="password" type="password" autocomplete="current-password"><button class="btn" id="go" type="submit">เข้าสู่ระบบ</button> <span id="msg"></span></form><p class="muted"><a href="/">← กลับหน้าเว็บ</a></p></div>`;
  const go = async () => { try { await api('/api/staff/login', { method: 'POST', body: { username: $('#un').value, password: $('#pw').value } }); await boot(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
  // NB: never use `onkeydown = (e) => cond && fn()` — returning false from an on* handler cancels every keystroke.
  $('#lf').addEventListener('submit', (e) => { e.preventDefault(); go(); }); $('#pw').focus();
}
async function boot() {
  try { SC = await api('/api/admin/schema'); } catch { if (!$('#lf')) showLogin(); return; }
  $('#who').innerHTML = `${esc(SC.me.name || SC.me.username)} · ${esc(SC.roles[SC.me.role])}`;
  try { MODN = (await api('/api/admin/moderation')).counts.total; } catch {} adminSSE();
  addEventListener('hashchange', route); route();
}
function nav(cur) {
  const items = [['dash', '📊 ภาพรวม'], ['mod', '🛂 ตรวจสอบรายงาน'], ...Object.entries(SC.colls).filter(([k, c]) => c.triage || can('admin')).map(([k, c]) => ['c/' + k, c.label.split(' (')[0]]),
    ...(can('admin') ? [['ptycctv', '📹 กล้องเมืองพัทยา'], ['texts', '📝 ข้อความทั้งเว็บ'], ['settings', '🎨 ตั้งค่าเว็บ'], ['antispam', '🛡️ กันสแปม'], ['audit', '🧾 ประวัติการแก้ไข']] : []), ...(can('superadmin') ? [['users', '👥 ผู้ใช้']] : []), ['me', '🔑 รหัสผ่านของฉัน'], ['logout', '🚪 ออก']];
  $('#nav').innerHTML = items.map(([h, l]) => `<a href="#${h}" class="${h === cur ? 'on' : ''}">${esc(l)}</a>`).join('');
  modBadgeNav(); $('#nav .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
async function route() {
  document.querySelectorAll('.modal').forEach((m) => m.remove()); sseL.clear(); const h = location.hash.slice(1) || 'dash'; nav(h); window.scrollTo(0, 0); app.innerHTML = '<p class="muted">กำลังโหลด…</p>';
  try { if (h === 'logout') { await api('/api/staff/logout', { method: 'POST' }); location.hash = ''; return showLogin(); }
    if (h.startsWith('c/')) return await collPage(h.slice(2)); await ({ dash, mod: modPage, texts, settings, antispam, users, audit, me, ptycctv }[h] || dash)(); } catch (e) { app.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
const stName = (s) => SC.statusNames[s] || s;

async function dash() {
  const s = await api('/api/admin/stats'); const c = s.colls;
  const open = (k, closed) => Object.entries(c[k].byStatus).filter(([st]) => !closed.includes(st)).reduce((a, [, n]) => a + n, 0);
  const card = (n, l, href, sub = '') => `<a class="stat" href="${href}" style="text-decoration:none;color:inherit"><small>${l}</small><b>${n}</b><small>${sub}</small></a>`;
  const tbl = (k) => `<div class="card"><h3>${esc(SC.colls[k].label)}</h3><p class="muted">ทั้งหมด ${c[k].total} · 24 ชม. ล่าสุด ${c[k].last24h}</p><ul class="list">${Object.entries(c[k].byStatus).map(([st, n]) => `<li><span>${esc(stName(st))}</span><b>${n}</b></li>`).join('') || '<li class="muted">ไม่มีข้อมูล</li>'}</ul>${Object.keys(c[k].byType).length ? `<p class="muted">ตามประเภท: ${Object.entries(c[k].byType).map(([t, n]) => `${esc(SC.kinds[t] || t)} ${n}`).join(' · ')}</p>` : ''}</div>`;
  app.innerHTML = `<h2>📊 ภาพรวม</h2>
   ${s.storage === 'file' ? '<p class="card" style="background:#fef3c7">⚠ ตอนนี้เก็บข้อมูลเป็นไฟล์ในเซิร์ฟเวอร์ — บน Render รุ่นฟรีข้อมูลจะหายเมื่อรีสตาร์ต/ดีพลอยใหม่ ตั้งค่า <b>DATABASE_URL</b> (Postgres) เพื่อเก็บถาวร</p>' : '<p class="muted">ที่เก็บข้อมูล: Postgres ✔</p>'}
   <div class="stats">${card(open('requests', ['resolved', 'closed']), 'คำขอที่ยังเปิดอยู่', '#c/requests', Object.entries(s.openRequestsByKind).map(([k, n]) => `${esc(SC.kinds[k] || k)} ${n}`).join(' · '))}
    ${card(c.requests.byStatus.new || 0, 'คำขอใหม่ รอคัดกรอง', '#c/requests')}${card(c.reports.last24h, 'รายงานระดับน้ำ 24 ชม.', '#c/reports')}${card(c.missing.byStatus.searching || 0, 'กำลังตามหาคน', '#c/missing')}
    ${card(c.lostfound.byStatus.open || 0, 'ประกาศของหายที่เปิดอยู่', '#c/lostfound')}${card(c.roads.byStatus.open || 0, 'เส้นทางเลี่ยง/ถนนปิด', '#c/roads')}${card(c.areas.total, 'พื้นที่ (เปิดรับทางเว็บ ' + 0 + ')', '#c/areas')}${card(s.users, 'ผู้ใช้ที่ใช้งานอยู่', can('superadmin') ? '#users' : '#dash')}</div>
   <div class="grid two" style="margin-top:12px">${['requests', 'reports', 'missing', 'lostfound'].map(tbl).join('')}</div>
   ${can('admin') ? `<div class="card" style="margin-top:12px"><h3>การแก้ไขล่าสุด</h3><ul class="list">${s.recent.map((a) => `<li><span>${fmt(a.at)} · <b>${esc(a.by)}</b> ${esc(ACT[a.action] || a.action)} ${esc(a.coll || '')} ${esc(a.id || '')}<br><span class="muted">${esc(a.detail || '')}</span></span></li>`).join('')}</ul><a href="#audit">ดูทั้งหมด →</a></div>` : ''}`;
  const served = (await api('/api/config')).contacts.areas.filter((a) => a.served).length; app.querySelector('a[href="#c/areas"] small').textContent = `พื้นที่ (เปิดรับทางเว็บ ${served})`;
}

// ---------- generic collection manager ----------
async function collPage(k) {
  const C = SC.colls[k]; if (!C) return dash(); let items = await api('/api/admin/c/' + k); const sel = new Set();
  const typeOpts = C.typeField ? [...new Set(items.map((x) => x[C.typeField]))] : [];
  const show = C.fields.filter((f) => !['lat', 'lng', 'note', 'description', 'address', 'source', 'detail', 'lastSeen'].includes(f.k)).slice(0, 5);
  const val = (f, v) => f.type === 'b' ? (v ? '✔' : '—') : f.k === 'kind' && k === 'requests' ? esc(SC.kinds[v] || v) : f.k === 'level' ? esc(SC.levels[v] || v) : Array.isArray(v) ? esc(v.join(', ')) : esc(v ?? '');
  app.innerHTML = `<div class="card"><h2>${esc(C.label)}</h2>
   <div class="bar"><input id="q" placeholder="ค้นหา (ชื่อ เบอร์ พื้นที่ รหัส …)">${C.statuses.length ? `<select id="fs"><option value="">ทุกสถานะ</option>${C.statuses.map((s) => `<option value="${s}">${esc(stName(s))}</option>`).join('')}</select>` : ''}${typeOpts.length ? `<select id="ft"><option value="">ทุกประเภท</option>${typeOpts.map((t) => `<option value="${esc(t)}">${esc(SC.kinds[t] || t)}</option>`).join('')}</select>` : ''}<select id="fd"><option value="">ทุกช่วงเวลา</option><option value="24">24 ชม.</option><option value="72">3 วัน</option><option value="168">7 วัน</option></select></div>
   <div class="bar"><span id="cnt" class="muted"></span>${C.statuses.length ? `<select id="bs"><option value="">— เปลี่ยนสถานะที่เลือก —</option>${C.statuses.map((s) => `<option value="${s}">${esc(stName(s))}</option>`).join('')}</select>` : ''}${can('admin') ? '<button class="btn sm red" id="bd">ลบที่เลือก</button>' : ''}<a class="btn sm alt" href="/api/admin/c/${k}/export.csv">⬇ CSV</a>${C.create && can('admin') ? '<button class="btn sm" id="add">+ เพิ่ม</button>' : ''}${k === 'roads' ? '<a class="btn sm" href="/#/staff">วาดเส้นทางบนแผนที่</a>' : ''}</div>
   <div style="overflow:auto"><table><thead><tr><th><input type="checkbox" class="rowsel" id="all"></th><th>รหัส</th>${show.map((f) => `<th>${esc(f.label)}</th>`).join('')}${C.statuses.length ? '<th>สถานะ</th>' : ''}<th class="hide-m">เวลา</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const filtered = () => { const q = $('#q').value.trim().toLowerCase(), fs = $('#fs')?.value, ft = $('#ft')?.value, fd = +$('#fd').value;
    return items.filter((x) => (!fs || x.status === fs) && (!ft || x[C.typeField] === ft) && (!fd || Date.parse(x.createdAt) > Date.now() - fd * 3600e3) && (!q || JSON.stringify(x).toLowerCase().includes(q))); };
  const draw = () => { const L = filtered(); $('#cnt').textContent = `${L.length} รายการ · เลือก ${sel.size}`;
    $('#tb').innerHTML = L.map((x) => `<tr class="${sel.has(x.id) ? 'sel' : ''}"><td><input type="checkbox" class="rowsel" data-id="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}></td><td><b>${esc(x.id)}</b>${x.photo ? '<br>📷' : ''}</td>${show.map((f) => `<td>${val(f, x[f.k])}</td>`).join('')}${C.statuses.length ? `<td><span class="pill">${esc(stName(x.status))}</span></td>` : ''}<td class="hide-m muted">${fmt(x.createdAt)}</td><td><button class="btn sm alt ed" data-id="${esc(x.id)}">${can('admin') ? 'แก้ไข' : 'ดู'}</button></td></tr>`).join('') || `<tr><td colspan="9" class="muted">ไม่มีรายการ</td></tr>`; };
  const reload = async () => { items = await api('/api/admin/c/' + k); draw(); };
  ['q', 'fs', 'ft', 'fd'].forEach((id) => $('#' + id) && ($('#' + id).oninput = draw));
  $('#tb').onclick = (e) => { const id = e.target.dataset.id; if (e.target.classList.contains('rowsel')) { e.target.checked ? sel.add(id) : sel.delete(id); draw(); } if (e.target.classList.contains('ed')) edit(k, items.find((x) => x.id === id), reload); };
  $('#all').onchange = (e) => { filtered().forEach((x) => (e.target.checked ? sel.add(x.id) : sel.delete(x.id))); draw(); };
  $('#bs') && ($('#bs').onchange = async (e) => { if (!e.target.value || !sel.size) return; const r = await api(`/api/admin/c/${k}/bulk`, { method: 'POST', body: { ids: [...sel], action: 'status', status: e.target.value } }); toast(`เปลี่ยนสถานะ ${r.n} รายการ`); sel.clear(); reload(); });
  $('#bd') && ($('#bd').onclick = async () => { if (!sel.size || !confirm(`ลบ ${sel.size} รายการถาวร?`)) return; const r = await api(`/api/admin/c/${k}/bulk`, { method: 'POST', body: { ids: [...sel], action: 'delete' } }); toast(`ลบ ${r.n} รายการ`); sel.clear(); reload(); });
  $('#add') && ($('#add').onclick = () => edit(k, null, reload));
  draw();
}
function edit(k, x, done) {
  const C = SC.colls[k], ro = !can('admin'), isNew = !x; x ||= {};
  const input = (f) => { const v = x[f.k], dis = ro || (k === 'areas' && f.k === 'id' && !isNew) ? 'disabled' : '';
    if (f.type === 'b') return `<label><input type="checkbox" data-f="${f.k}" ${v ? 'checked' : ''} ${dis} style="width:auto"> ${esc(f.label)}</label><br>`;
    if (f.type === 'select') return `<label>${esc(f.label)}</label><select data-f="${f.k}" ${dis}>${f.options.map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${esc((f.k === 'kind' && SC.kinds[o]) || (f.k === 'level' && SC.levels[o]) || o || '—')}</option>`).join('')}</select>`;
    if (f.type === 't') return `<label>${esc(f.label)}</label><textarea data-f="${f.k}" ${dis}>${esc(v ?? '')}</textarea>`;
    return `<label>${esc(f.label)}</label><input data-f="${f.k}" value="${esc(Array.isArray(v) ? v.join(', ') : v ?? '')}" ${dis}>`; };
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card"><h2>${isNew ? 'เพิ่ม' : 'แก้ไข'} · ${esc(C.label)} ${esc(x.id || '')}</h2>${x.photo ? `<img src="${esc(x.photo)}" style="max-width:100%;max-height:240px;border-radius:8px">` : ''}
   ${C.fields.map(input).join('')}${C.statuses.length && !isNew ? `<label>สถานะ</label><select data-f="status" ${ro ? 'disabled' : ''}>${C.statuses.map((s) => `<option value="${s}" ${s === x.status ? 'selected' : ''}>${esc(stName(s))}</option>`).join('')}</select><input data-f="note" placeholder="บันทึกประกอบการเปลี่ยนสถานะ (ไม่บังคับ)" ${ro ? 'disabled' : ''}>` : ''}
   ${x.history ? `<h3>ประวัติ</h3><ul>${x.history.map((h) => `<li class="muted">${fmt(h.at)} · ${esc(stName(h.s))} · ${esc(h.by || '')} ${esc(h.note || '')}</li>`).join('')}</ul>` : ''}
   ${x.lat ? `<p><a target="_blank" href="https://www.google.com/maps?q=${x.lat},${x.lng}">เปิดตำแหน่งใน Google Maps</a></p>` : ''}
   <p>${ro ? '' : '<button class="btn" id="sv">บันทึก</button> '}<button class="btn alt" id="cx">ปิด</button>${!isNew && can('admin') ? ' <button class="btn red" id="dl" style="float:right">ลบ</button>' : ''} <span id="msg"></span></p></div>`;
  document.body.appendChild(m); const close = () => m.remove(); $('#cx', m).onclick = close; m.onclick = (e) => e.target === m && close();
  $('#sv', m) && ($('#sv', m).onclick = async () => { const body = {}; m.querySelectorAll('[data-f]').forEach((i) => (body[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value)); if (body.status === x.status) delete body.status;
    try { await api(isNew ? `/api/admin/c/${k}` : `/api/admin/c/${k}/${encodeURIComponent(x.id)}`, { method: isNew ? 'POST' : 'PUT', body }); toast('บันทึกแล้ว'); close(); done(); } catch (e) { $('#msg', m).innerHTML = `<span class="err">${esc(e.message)}</span>`; } });
  $('#dl', m) && ($('#dl', m).onclick = async () => { if (!confirm('ลบรายการนี้ถาวร?')) return; await api(`/api/admin/c/${k}/${encodeURIComponent(x.id)}`, { method: 'DELETE' }); toast('ลบแล้ว'); close(); done(); });
}

// ---------- texts (CMS, per language) ----------
const LN = { th: 'ไทย (TH)', en: 'English (EN)', zh: '中文 (ZH)' }; let TLANG = 'th';
async function texts() {
  let L = await api('/api/admin/texts'); const groups = [...new Set(L.map((t) => t.group))];
  const V = (t) => (TLANG === 'th' ? { def: t.default, val: t.value } : { def: t.i18n[TLANG].default || t.default, val: t.i18n[TLANG].value });
  app.innerHTML = `<div class="card"><h2>📝 ข้อความทั้งเว็บ</h2><p class="muted">ทุกข้อความที่ประชาชนเห็น แยกตามภาษา (ไทยเป็นภาษาหลัก) — เลือกภาษาที่จะแก้ แก้แล้วกด "บันทึกทั้งหมด" มีผลทันที ช่องว่าง = ใช้ค่าเริ่มต้นของภาษานั้น</p>
   <div class="bar" id="lt">${Object.entries(LN).map(([l, n]) => `<button class="btn sm ${l === TLANG ? '' : 'alt'}" data-l="${l}">${n}</button>`).join('')}</div>
   <div class="bar"><input id="q" placeholder="ค้นหาข้อความหรือรหัส"><select id="g"><option value="">ทุกหน้า/ส่วน (${groups.length})</option>${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select><label style="font-weight:400"><input type="checkbox" id="oc" style="width:auto"> เฉพาะที่แก้แล้ว</label></div>
   <div class="bar"><button class="btn" id="saveall">💾 บันทึกทั้งหมด (${esc(LN[TLANG])})</button><span id="dirty" class="muted"></span><a class="btn alt sm" href="/?lang=${TLANG}" target="pfcprev">เปิดหน้าเว็บ (ดูตัวอย่าง)</a></div><div id="list"></div></div>`;
  const dirty = {};
  $('#lt').onclick = (e) => { const l = e.target.dataset.l; if (!l || l === TLANG) return; if (Object.keys(dirty).length && !confirm('มีการแก้ไขที่ยังไม่บันทึก ทิ้งไป?')) return; TLANG = l; texts(); };
  const draw = () => { const q = $('#q').value.trim().toLowerCase(), g = $('#g').value, oc = $('#oc').checked; let last = '';
    const F = L.filter((t) => { const x = V(t); return (!g || t.group === g) && (!oc || x.val != null || t.key in dirty) && (!q || (t.key + ' ' + t.default + ' ' + x.def + ' ' + (x.val || '')).toLowerCase().includes(q)); });
    $('#list').innerHTML = F.slice(0, 400).map((t) => { const x = V(t); const v = t.key in dirty ? dirty[t.key] : x.val ?? ''; const head = t.group !== last ? `<h3 style="margin-top:16px">${esc((last = t.group))}</h3>` : '';
      return head + `<div class="kv ${x.val != null || t.key in dirty ? 'changed' : ''}" data-k="${esc(t.key)}"><code>${esc(t.key)}</code> ${x.val != null ? '<span class="pill">แก้แล้ว</span>' : ''}<div class="def">ค่าเริ่มต้น (${TLANG.toUpperCase()}): ${esc(x.def)}${TLANG !== 'th' ? `<br><span class="muted">ไทย: ${esc(t.value ?? t.default)}</span>` : ''}</div>
        <textarea rows="1" placeholder="${esc(x.def)}">${esc(v)}</textarea><div class="prev">${esc(v || x.def)}</div>${x.val != null ? '<button class="btn sm alt rs">↺ คืนค่าเริ่มต้น (' + TLANG.toUpperCase() + ')</button>' : ''}</div>`; }).join('') + (F.length > 400 ? `<p class="muted">แสดง 400 จาก ${F.length} — ค้นหาเพื่อกรอง</p>` : '') || '<p class="muted">ไม่พบ</p>';
    $('#dirty').textContent = Object.keys(dirty).length ? `มีการแก้ไขที่ยังไม่บันทึก ${Object.keys(dirty).length} รายการ` : ''; };
  $('#list').oninput = (e) => { const kv = e.target.closest('.kv'); if (!kv) return; dirty[kv.dataset.k] = e.target.value; const t = L.find((x) => x.key === kv.dataset.k); $('.prev', kv).textContent = e.target.value || V(t).def; kv.classList.add('changed'); $('#dirty').textContent = `มีการแก้ไขที่ยังไม่บันทึก ${Object.keys(dirty).length} รายการ`; };
  $('#list').onclick = async (e) => { if (!e.target.classList.contains('rs')) return; const k = e.target.closest('.kv').dataset.k; await api('/api/admin/texts/' + encodeURIComponent(k) + '?lang=' + TLANG, { method: 'DELETE' }); delete dirty[k]; L = await api('/api/admin/texts'); toast('คืนค่าเริ่มต้นแล้ว'); draw(); };
  $('#saveall').onclick = async () => { if (!Object.keys(dirty).length) return toast('ไม่มีการแก้ไข', false); const r = await api('/api/admin/texts', { method: 'PUT', body: { values: dirty, lang: TLANG } }); for (const k in dirty) delete dirty[k]; L = await api('/api/admin/texts'); toast(`บันทึก ${r.n} ข้อความ`); draw(); };
  ['q', 'g', 'oc'].forEach((id) => ($('#' + id).oninput = draw)); draw();
}

// ---------- anti-spam ----------
const ASN = { reports: 'รายงานระดับน้ำ', requests: 'คำขอช่วยเหลือ', missing: 'ตามหาคน', lostfound: 'ของหาย–ได้คืน' };
async function antispam() {
  const { antispam: A, stats, turnstile, yourIp } = await api('/api/admin/antispam');
  const chk = (id, v, l) => `<label style="font-weight:400;display:block;margin:6px 0"><input type="checkbox" id="${id}" style="width:auto" ${v ? 'checked' : ''}> ${l}</label>`;
  app.innerHTML = `<div class="grid two"><div class="card"><h2>🛡️ กันสแปม</h2>${chk('on', A.on, 'เปิดระบบกันสแปม (จำกัดความถี่ / honeypot / เวลากรอกขั้นต่ำ / รวมรายการซ้ำ)')}${chk('honeypot', A.honeypot, 'ช่องดักบอท (honeypot)')}${chk('dedupe', A.dedupe, 'รวมรายการซ้ำ (จุด+ประเภทเดียวกัน) เป็น "ยืนยันโดย N คน"')}
    <label>เวลากรอกขั้นต่ำ (วินาที)</label><input id="minFillSec" type="number" value="${A.minFillSec}"><label>ช่วงเวลารวมรายการซ้ำ (นาที)</label><input id="dedupeMin" type="number" value="${A.dedupeMin}"><label>รัศมีถือว่าเป็นจุดเดียวกัน (เมตร)</label><input id="dedupeMeters" type="number" value="${A.dedupeMeters}"><label>ขนาดรูปสูงสุด (MB, ≤3, JPG/PNG/WEBP)</label><input id="maxPhotoMB" type="number" step="0.1" value="${A.maxPhotoMB}">
    <p class="muted">Cloudflare Turnstile: ${turnstile ? '✅ เปิดใช้ (ตั้ง TURNSTILE_SITE_KEY/TURNSTILE_SECRET แล้ว)' : 'ปิด — ตั้งค่า env TURNSTILE_SITE_KEY และ TURNSTILE_SECRET เพื่อเปิด'}</p>
    <p class="muted">สถิติตั้งแต่เริ่มเซิร์ฟเวอร์: honeypot ${stats.honeypot} · ส่งเร็วเกิน ${stats.tooFast} · เกินจำนวน ${stats.rate} · IP ถูกบล็อก ${stats.blocked} · captcha ไม่ผ่าน ${stats.captcha} · รวมซ้ำ ${stats.merged}</p></div>
   <div class="card"><h2>⏱️ จำกัดจำนวนการส่ง (ต่อ IP และต่ออุปกรณ์)</h2>${Object.keys(A.limits).map((k) => `<label>${esc(ASN[k] || k)}</label><div class="bar"><input id="n_${k}" type="number" value="${A.limits[k].n}" style="width:90px"> ครั้ง ต่อ <input id="m_${k}" type="number" value="${A.limits[k].min}" style="width:90px"> นาที</div>`).join('')}<p class="muted">0 = ไม่จำกัด</p>
    <h2>⛔ IP ที่บล็อก</h2><p class="muted">บรรทัดละ 1 IP · ลงท้าย * = ขึ้นต้นด้วย (เช่น 203.0.113.*) · IP ของคุณ: <code>${esc(yourIp)}</code></p><textarea id="blocked" rows="6">${esc((A.blocked || []).join('\n'))}</textarea></div></div>
   <p><button class="btn" id="sv">💾 บันทึก</button> <button class="btn alt" id="rs">คืนค่าเริ่มต้น</button></p>`;
  $('#sv').onclick = async () => { const limits = {}; for (const k of Object.keys(A.limits)) limits[k] = { n: $('#n_' + k).value, min: $('#m_' + k).value };
    await api('/api/admin/antispam', { method: 'PUT', body: { on: $('#on').checked, honeypot: $('#honeypot').checked, dedupe: $('#dedupe').checked, minFillSec: $('#minFillSec').value, dedupeMin: $('#dedupeMin').value, dedupeMeters: $('#dedupeMeters').value, maxPhotoMB: $('#maxPhotoMB').value, limits, blocked: $('#blocked').value.split(/\s+/) } }); toast('บันทึกแล้ว'); antispam(); };
  $('#rs').onclick = async () => { if (!confirm('คืนค่าเริ่มต้นการกันสแปม (รวมล้างรายการ IP ที่บล็อก)?')) return; await api('/api/admin/antispam', { method: 'PUT', body: { reset: true } }); antispam(); };
}

// ---------- settings ----------
const SECNAME = { food: '🍚 ขออาหาร / ถุงยังชีพ', contact: '☎️ ติดต่อผู้ประสานงาน + 🩺 ผู้ป่วย', sos: '🆘 แถบฉุกเฉิน (โทร 1669)', report: '📏 รายงานระดับน้ำ', near: '📍 น้ำท่วมใกล้บ้านฉันไหม', services: 'บริการอื่น', situation: '🌧️ สถานการณ์น้ำตอนนี้', moreinfo: 'ลิงก์ข้อมูลเพิ่มเติม', emergency: '📞 เบอร์ฉุกเฉิน', stafflink: '👮 ปุ่มเข้าสู่ระบบเจ้าหน้าที่' };
// ---------- moderation queue ----------
const MODE_NAME = { hybrid: 'ผสม (hybrid) — แสดงทันทีแบบจาง + ป้าย "รอตรวจสอบ"', approve: 'อนุมัติก่อนทุกรายการ — ไม่แสดงจนกว่าจะอนุมัติ', off: 'ปิด — ยืนยันทุกรายการทันที' };
const REASON = (r) => r.startsWith('word:') ? 'คำไม่เหมาะสม: ' + r.slice(5) : { link: 'มีลิงก์', phone: 'มีเบอร์โทร', flagged: 'อุปกรณ์/IP ถูกติดธง' }[r] || r;
let modMap;
async function modPage() {
  const d = await api('/api/admin/moderation'); MODN = d.counts.total; modBadgeNav();
  const LV = SC.levels || {}; const sel = new Set();
  const card = (x) => `<div class="mq ${x.mod}" data-k="${x.coll}|${esc(x.id)}"><label class="mqsel"><input type="checkbox" class="rowsel" data-k="${x.coll}|${esc(x.id)}"></label>
    ${x.photo ? `<a href="${esc(x.photo)}" target="_blank"><img class="mqimg" src="${esc(x.photo)}"></a>` : '<div class="mqimg none">ไม่มีรูป</div>'}
    <div class="mqbody"><b>${esc(x.id)}</b> <span class="pill ${x.mod}">${x.mod === 'held' ? '⛔ กักไว้ (ซ่อน)' : '⏳ รอตรวจสอบ'}</span> <span class="pill">${x.coll === 'reports' ? '📏 ระดับน้ำ' : '🐾 ของหาย–ได้คืน'}</span>
      <div>${x.coll === 'reports' ? `<b>${esc(LV[x.level] || x.level)}</b> · ${esc(x.areaName || '')}` : `<b>${esc(x.type === 'lost' ? 'ตามหา' : 'เก็บได้')}: ${esc(x.title)}</b> · ${esc(x.place || '')}`}</div>
      <div>${esc(x.note || x.detail || '')}</div>
      <div class="muted">${fmt(x.createdAt)} · 👍 ${x.yes} · 🌤️ ${x.no}${x.cleared ? ' · อาจไม่ท่วมแล้ว' : ''}${x.modReasons?.length ? ' · <span class="err">' + x.modReasons.map((r) => esc(REASON(r))).join(', ') + '</span>' : ''}${x.src?.ip ? ` · IP <code>${esc(x.src.ip)}</code>` : ''}</div>
      <div class="bar" style="margin:6px 0 0"><button class="btn sm ok1" data-a="approve">✔ อนุมัติ</button><button class="btn sm alt" data-a="reject">✖ ปฏิเสธ</button>${x.mod === 'pending' ? '<button class="btn sm alt" data-a="hold">⛔ กักไว้</button>' : ''}${x.lat ? `<button class="btn sm alt" data-a="zoom">🗺️</button>` : ''}</div></div></div>`;
  const P = d.items.filter((x) => x.mod === 'pending'), H = d.items.filter((x) => x.mod === 'held');
  app.innerHTML = `<div class="card"><h2>🛂 ตรวจสอบรายงานจากประชาชน</h2><p>โหมดปัจจุบัน: <b>${esc(MODE_NAME[d.mode])}</b> · ยืนยันอัตโนมัติเมื่อ ${d.settings.autoVerifyN} อุปกรณ์ยืนยัน${can('admin') ? ' · <a href="#settings">เปลี่ยนโหมด/เกณฑ์/คำต้องห้าม</a>' : ''}</p>
    <p class="muted">คำขอช่วยเหลือ / อพยพ / ผู้ป่วย และตามหาคน ไม่ผ่านคิวนี้ — ส่งถึงเจ้าหน้าที่ทันทีเสมอ</p>
    <div class="bar"><label style="font-weight:400"><input type="checkbox" id="all" class="rowsel"> เลือกทั้งหมด</label><button class="btn sm" id="bA">✔ อนุมัติที่เลือก</button><button class="btn sm alt" id="bR">✖ ปฏิเสธที่เลือก</button><span id="nsel" class="muted"></span></div>
    <div id="mqmap" style="height:300px;border-radius:10px"></div></div>
   <div class="grid two"><div class="card"><h3>⛔ กักไว้ — ไม่แสดงต่อสาธารณะ (${H.length})</h3>${H.map(card).join('') || '<p class="muted">ไม่มี</p>'}</div>
    <div class="card"><h3>⏳ รอตรวจสอบ (${P.length})</h3>${P.map(card).join('') || '<p class="muted">ไม่มี</p>'}</div></div>
   <div class="card"><h3>ผลการตรวจล่าสุด</h3><table><tbody>${d.recent.map((x) => `<tr><td>${esc(x.id)}</td><td>${x.mod === 'rejected' ? '✖ ปฏิเสธ' : '✔ ยืนยัน'}</td><td>${esc(x.modBy || '')}</td><td class="muted">${fmt(x.modAt)}</td></tr>`).join('') || '<tr><td class="muted">-</td></tr>'}</tbody></table></div>`;
  if (modMap) { try { modMap.remove(); } catch {} } modMap = L.map('mqmap').setView([12.9236, 100.8825], 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(modMap);
  const pts = d.items.filter((x) => x.lat); pts.forEach((x) => L.circleMarker([x.lat, x.lng], { radius: 8, color: x.mod === 'held' ? '#b91c1c' : '#d97706', fillOpacity: 0.6 }).addTo(modMap).bindPopup(`<b>${esc(x.id)}</b> ${esc(LV[x.level] || '')}<br>${esc(x.note || '')}`));
  if (pts.length) modMap.fitBounds(pts.map((x) => [x.lat, x.lng]), { maxZoom: 15, padding: [20, 20] });
  const act = async (keys, a) => { if (!keys.length) return toast('ยังไม่ได้เลือก', false); const r = await api('/api/admin/moderation/action', { method: 'POST', body: { action: a, items: keys.map((k) => { const [coll, id] = k.split('|'); return { coll, id }; }) } }); toast(`${{ approve: 'อนุมัติ', reject: 'ปฏิเสธ', hold: 'กักไว้' }[a]} ${r.n} รายการ`); modPage(); };
  const upd = () => { $('#nsel').textContent = sel.size ? `เลือก ${sel.size} รายการ` : ''; };
  app.onchange = (e) => { if (e.target.id === 'all') { document.querySelectorAll('.mq .rowsel').forEach((c) => { c.checked = e.target.checked; c.checked ? sel.add(c.dataset.k) : sel.delete(c.dataset.k); }); } else if (e.target.classList.contains('rowsel')) e.target.checked ? sel.add(e.target.dataset.k) : sel.delete(e.target.dataset.k); upd(); };
  app.onclick = (e) => { const a = e.target.dataset.a; if (!a) return; const k = e.target.closest('.mq').dataset.k;
    if (a === 'zoom') { const x = d.items.find((i) => i.coll + '|' + i.id === k); modMap.setView([x.lat, x.lng], 17); window.scrollTo(0, 0); return; } act([k], a).catch((er) => toast(er.message, false)); };
  $('#bA').onclick = () => act([...sel], 'approve').catch((er) => toast(er.message, false)); $('#bR').onclick = () => { if (confirm(`ปฏิเสธ ${sel.size} รายการ?`)) act([...sel], 'reject').catch((er) => toast(er.message, false)); };
  let t; sseL.add(() => { if (sel.size) return; clearTimeout(t); t = setTimeout(() => location.hash === '#mod' && modPage(), 400); });
}
async function modSettings(el) {
  const { settings: m } = await api('/api/admin/moderation/settings'); const chk = (id, v, l) => `<label style="font-weight:400;display:block;margin:6px 0"><input type="checkbox" id="${id}" style="width:auto" ${v ? 'checked' : ''}> ${l}</label>`;
  el.innerHTML = `<div class="card" id="modcard"><h2>🛂 การตรวจสอบรายงานจากประชาชน</h2><p class="muted">ใช้กับรายงานระดับน้ำและของหาย–ได้คืน · คำขอช่วยเหลือ/อพยพ/ผู้ป่วยไม่ถูกหน่วงเวลาเด็ดขาด · มีผลทันทีและบันทึกในประวัติการแก้ไข</p>
    <label>โหมด</label><div id="mmode">${Object.entries(MODE_NAME).map(([v, l]) => `<label style="font-weight:400;display:block;margin:4px 0"><input type="radio" name="mmode" value="${v}" style="width:auto" ${m.mode === v ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
    <div class="grid two"><div><label>ยืนยันอัตโนมัติเมื่อมีอุปกรณ์อื่นยืนยัน (ครั้ง)</label><input id="mN" type="number" min="1" value="${m.autoVerifyN}"><label>ถือว่า "อาจไม่ท่วมแล้ว" เมื่อแจ้งว่าไม่พบน้ำ (ครั้ง)</label><input id="mC" type="number" min="1" value="${m.clearN}">
      <label>จำกัดการกดยืนยัน (ครั้ง / นาที ต่อ IP และอุปกรณ์)</label><div class="bar"><input id="mVn" type="number" value="${m.voteLimit.n}"> / <input id="mVm" type="number" value="${m.voteLimit.min}"></div>
      ${chk('mIp', m.distinctIp, 'นับ 1 เสียงต่อ IP ด้วย (ไม่ใช่แค่ต่ออุปกรณ์)')}${chk('mL', m.holdLinks, 'กักรายงานที่มีลิงก์ / LINE ID')}${chk('mP', m.holdPhones, 'กักรายงานที่มีเบอร์โทรในข้อความ (สแปม)')}</div>
     <div><label>คำต้องห้าม (บรรทัดละคำ ไทย/อังกฤษ)</label><textarea id="mW" rows="7">${esc(m.words.join('\n'))}</textarea><label>อุปกรณ์/IP ที่ติดธง (กักทุกรายงาน) — บรรทัดละรายการ, ลงท้าย * ได้</label><textarea id="mF" rows="3">${esc((m.flagged || []).join('\n'))}</textarea></div></div>
    <p><button class="btn" id="msv">💾 บันทึกการตรวจสอบ</button> <button class="btn alt" id="mrs">คืนค่าเริ่มต้น</button></p></div>`;
  const put = async (body) => { await api('/api/admin/moderation/settings', { method: 'PUT', body }); toast('บันทึกการตรวจสอบแล้ว'); modSettings(el); };
  $('#msv', el).onclick = () => put({ mode: el.querySelector('[name=mmode]:checked').value, autoVerifyN: $('#mN').value, clearN: $('#mC').value, voteLimit: { n: $('#mVn').value, min: $('#mVm').value }, distinctIp: $('#mIp').checked, holdLinks: $('#mL').checked, holdPhones: $('#mP').checked, words: $('#mW').value.split('\n'), flagged: $('#mF').value.split(/\s+/) }).catch((e) => toast(e.message, false));
  $('#mrs', el).onclick = () => confirm('คืนค่าเริ่มต้นการตรวจสอบ?') && put({ reset: true });
}
async function settings() {
  const { settings: s } = await api('/api/admin/settings'); const secs = s.sections.map((x) => ({ ...x }));
  app.innerHTML = `<div id="modset"></div><div class="grid two"><div class="card"><h2>🎨 ชื่อเว็บ โลโก้ สี</h2><p class="muted">ชื่อเว็บ/คำโปรย/ส่วนท้าย/ชื่อหน้า แก้ได้ที่ <a href="#texts">ข้อความทั้งเว็บ</a> → กลุ่ม "ทั้งเว็บ"</p>
     <label>โลโก้ (อีโมจิ)</label><input id="logo" value="${esc(s.logo)}"><label>หรือ URL รูปโลโก้ (https://…)</label><input id="logoUrl" value="${esc(s.logoUrl)}">
     <label>สีหลัก (ปุ่ม/ลิงก์)</label><input type="color" id="primary" value="${esc(s.primary)}"><label>สีแถบด้านบน</label><input type="color" id="header" value="${esc(s.header)}"><label>สีพื้นหลัง</label><input type="color" id="bg" value="${esc(s.bg)}"></div>
    <div class="card"><h2>📢 ประกาศด่วน (แบนเนอร์)</h2><label><input type="checkbox" id="bon" style="width:auto" ${s.banner.on ? 'checked' : ''}> แสดงแบนเนอร์บนทุกหน้า</label><label>ข้อความ</label><textarea id="btext">${esc(s.banner.text)}</textarea>
     <label>ระดับ</label><select id="blevel">${[['info', 'ข้อมูล (ฟ้า)'], ['warn', 'เตือน (เหลือง)'], ['danger', 'อันตราย (แดง)']].map(([v, l]) => `<option value="${v}" ${v === s.banner.level ? 'selected' : ''}>${l}</option>`).join('')}</select><div id="bprev"></div></div></div>
   <div class="card" style="margin-top:12px"><h2>🧩 ส่วนต่าง ๆ บนหน้าหลัก</h2><p class="muted">ติ๊กเพื่อแสดง/ซ่อน และใช้ปุ่ม ↑ ↓ จัดลำดับ</p><ul class="sections list" id="secs"></ul></div>
   <p><button class="btn" id="sv">💾 บันทึกการตั้งค่า</button> <button class="btn alt" id="rs">คืนค่าเริ่มต้นทั้งหมด</button> <a class="btn alt" href="/" target="pfcprev">ดูหน้าเว็บ</a></p>
   <div class="card"><h3>ตัวอย่างหน้าหลัก (รีเฟรชหลังบันทึก)</h3><iframe id="pv" src="/" style="width:100%;height:560px;border:1px solid #cbd5e1;border-radius:10px"></iframe></div>`;
  const ds = () => { $('#secs').innerHTML = secs.map((x, i) => `<li><input type="checkbox" data-i="${i}" class="on" style="width:auto" ${x.on ? 'checked' : ''}><span>${esc(SECNAME[x.id] || x.id)}</span><button class="btn sm alt up" data-i="${i}">↑</button><button class="btn sm alt dn" data-i="${i}">↓</button></li>`).join(''); };
  $('#secs').onclick = (e) => { const i = +e.target.dataset.i; if (e.target.classList.contains('on')) secs[i].on = e.target.checked; const j = e.target.classList.contains('up') ? i - 1 : e.target.classList.contains('dn') ? i + 1 : -1; if (j >= 0 && j < secs.length) { [secs[i], secs[j]] = [secs[j], secs[i]]; ds(); } };
  const bp = () => { $('#bprev').innerHTML = $('#bon').checked && $('#btext').value ? `<div class="banner ${$('#blevel').value}" style="margin-top:8px;border-radius:8px">${esc($('#btext').value)}</div>` : '<p class="muted">(ไม่แสดงแบนเนอร์)</p>'; };
  ['bon', 'btext', 'blevel'].forEach((id) => ($('#' + id).oninput = bp)); bp(); ds(); modSettings($('#modset'));
  $('#sv').onclick = async () => { await api('/api/admin/settings', { method: 'PUT', body: { logo: $('#logo').value, logoUrl: $('#logoUrl').value, primary: $('#primary').value, header: $('#header').value, bg: $('#bg').value, banner: { on: $('#bon').checked, text: $('#btext').value, level: $('#blevel').value }, sections: secs } }); toast('บันทึกแล้ว'); $('#pv').src = '/?t=' + Date.now(); };
  $('#rs').onclick = async () => { if (!confirm('คืนค่าการตั้งค่าเว็บทั้งหมด?')) return; await api('/api/admin/settings', { method: 'PUT', body: { reset: true } }); settings(); };
}

// ---------- official Pattaya CCTV list ----------
async function ptycctv() {
  const r = await api('/api/admin/cctv/pattaya'); let items = r.items;
  app.innerHTML = `<div class="card"><h2>📹 กล้อง CCTV เมืองพัทยา (livestream.pattaya.go.th)</h2>
   <p class="muted">รายชื่อและพิกัดดึงอัตโนมัติจาก API สาธารณะของเว็บเมืองพัทยา (แคช 10 นาที) ภาพสดเป็น WebRTC ที่ต้องผ่านการยืนยัน Cloudflare Turnstile และห้ามฝังเว็บอื่น (CSP frame-ancestors) จึงแสดงเป็นลิงก์ไปเว็บต้นทาง — ที่นี่ปรับชื่อที่แสดง พิกัด ซ่อน หรือปักหมุด ⭐ ได้ · กล้อง/ลิงก์ของเราเองจัดการที่ <a href="#c/cctv">ลิงก์กล้อง CCTV</a> (รองรับ HLS .m3u8, ภาพ snapshot, iframe)</p>
   ${r.ok ? '' : `<p class="err">ดึงรายชื่อไม่ได้: ${esc(r.error)}</p>`}<div id="map" style="height:40vh"></div>
   <div class="bar" style="margin-top:8px"><input id="q" placeholder="ค้นหา"><label style="font-weight:400"><input type="checkbox" id="oh" style="width:auto"> เฉพาะที่ซ่อน/แก้ไข</label><span class="muted" id="cnt"></span></div>
   <div style="overflow:auto"><table><thead><tr><th>กล้อง</th><th>ชื่อที่แสดง</th><th>ละติจูด</th><th>ลองจิจูด</th><th>⭐</th><th>ซ่อน</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const m = L.map('map').setView([12.93, 100.88], 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m); const lay = L.layerGroup().addTo(m); let pick = null;
  m.on('click', (e) => { if (!pick) return; const tr = $(`tr[data-id="${pick}"]`); if (tr) { $('.la', tr).value = e.latlng.lat.toFixed(6); $('.lo', tr).value = e.latlng.lng.toFixed(6); toast('ตั้งพิกัดแล้ว กด บันทึก ในแถว'); } pick = null; });
  const draw = () => { const q = $('#q').value.toLowerCase(), oh = $('#oh').checked; const F = items.filter((x) => (!oh || x.hidden || x.title || x.featured) && (!q || (x.name + x.location + x.title + x.district).toLowerCase().includes(q)));
    $('#cnt').textContent = `${F.length}/${items.length}`; lay.clearLayers(); F.forEach((x) => x.lat && L.circleMarker([x.lat, x.lng], { radius: 5, color: x.hidden ? '#94a3b8' : '#0369a1' }).addTo(lay).bindPopup(esc(x.title || x.location)));
    $('#tb').innerHTML = F.slice(0, 150).map((x) => `<tr data-id="${esc(x.id)}"><td><b>${esc(x.name)}</b><br><span class="muted">${esc(x.location)} · ${esc(x.district)} · ${esc(x.state)}</span></td><td><input class="ti" value="${esc(x.title)}" placeholder="${esc(x.location)}"></td><td><input class="la" value="${x.lat ?? ''}" style="width:100px"></td><td><input class="lo" value="${x.lng ?? ''}" style="width:100px"></td><td><input type="checkbox" class="fe" ${x.featured ? 'checked' : ''} style="width:auto"></td><td><input type="checkbox" class="hi" ${x.hidden ? 'checked' : ''} style="width:auto"></td><td><button class="btn sm alt pk">ปักบนแผนที่</button> <button class="btn sm sv">บันทึก</button></td></tr>`).join('') + (F.length > 150 ? '<tr><td colspan=7 class="muted">แสดง 150 แถวแรก — ค้นหาเพื่อกรอง</td></tr>' : ''); };
  $('#tb').onclick = async (e) => { const tr = e.target.closest('tr'); if (!tr) return; const id = tr.dataset.id;
    if (e.target.classList.contains('pk')) { pick = id; toast('แตะตำแหน่งบนแผนที่ด้านบน'); window.scrollTo(0, 0); }
    if (e.target.classList.contains('sv')) { const body = { title: $('.ti', tr).value, lat: $('.la', tr).value, lng: $('.lo', tr).value, featured: $('.fe', tr).checked, hidden: $('.hi', tr).checked }; await api('/api/admin/cctv/pattaya/' + encodeURIComponent(id), { method: 'PUT', body }); items = (await api('/api/admin/cctv/pattaya')).items; toast('บันทึกแล้ว'); draw(); } };
  $('#q').oninput = draw; $('#oh').onchange = draw; draw();
}

// ---------- users ----------
async function users() {
  const L = await api('/api/admin/users'); const roleSel = (v, cls = '') => `<select class="${cls}" style="width:auto;margin:0">${Object.entries(SC.roles).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  app.innerHTML = `<div class="card"><h2>👥 ผู้ใช้ระบบ</h2><p class="muted">ผู้ดูแลสูงสุด = ทุกอย่าง + จัดการผู้ใช้ · ผู้ดูแล = จัดการข้อมูล ข้อความ ตั้งค่า ลบ ส่งออก · เจ้าหน้าที่/กู้ภัย = ดูและอัปเดตสถานะเคส วาดเส้นทาง (ลบไม่ได้) · รหัสผ่านเก็บแบบ bcrypt</p>
   <div style="overflow:auto"><table><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th>สถานะ</th><th class="hide-m">เข้าล่าสุด</th><th>ตั้งรหัสใหม่</th><th></th></tr></thead><tbody>${L.map((u) => `<tr data-id="${u.id}"><td><b>${esc(u.username)}</b></td><td><input class="nm" value="${esc(u.name)}"></td><td>${roleSel(u.role, 'rl')}</td><td><label style="font-weight:400"><input type="checkbox" class="ac" ${u.active ? 'checked' : ''} style="width:auto"> ใช้งาน</label></td><td class="hide-m muted">${fmt(u.lastLogin)}</td><td><input class="pw" type="password" placeholder="(ไม่เปลี่ยน)" autocomplete="new-password"></td><td><button class="btn sm sv">บันทึก</button></td></tr>`).join('')}</tbody></table></div></div>
   <div class="card" style="margin-top:12px;max-width:520px"><h3>+ เพิ่มผู้ใช้</h3><input id="nu" placeholder="ชื่อผู้ใช้ (a-z 0-9 . _ -)"><input id="nn" placeholder="ชื่อที่แสดง เช่น กู้ภัยสว่างฯ ชุด 3"><label>บทบาท</label>${roleSel('staff', 'nr')}<input id="np" type="password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)" autocomplete="new-password"><button class="btn" id="add">เพิ่มผู้ใช้</button> <span id="msg"></span></div>`;
  app.onclick = async (e) => { if (e.target.classList.contains('sv')) { const tr = e.target.closest('tr'); const body = { name: $('.nm', tr).value, role: $('.rl', tr).value, active: $('.ac', tr).checked }; if ($('.pw', tr).value) body.password = $('.pw', tr).value; try { await api('/api/admin/users/' + tr.dataset.id, { method: 'PUT', body }); toast('บันทึกแล้ว'); users(); } catch (er) { toast(er.message, false); } }
    if (e.target.id === 'add') { try { await api('/api/admin/users', { method: 'POST', body: { username: $('#nu').value, name: $('#nn').value, role: $('.nr').value, password: $('#np').value } }); toast('เพิ่มผู้ใช้แล้ว'); users(); } catch (er) { $('#msg').innerHTML = `<span class="err">${esc(er.message)}</span>`; } } };
}
async function audit() {
  const L = await api('/api/admin/audit');
  app.innerHTML = `<div class="card"><h2>🧾 ประวัติการแก้ไข (Audit log)</h2><div class="bar"><input id="q" placeholder="ค้นหา ผู้ใช้ การกระทำ รหัส"><span id="cnt" class="muted"></span></div><div style="overflow:auto"><table><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>ข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const draw = () => { const q = $('#q').value.toLowerCase(); const F = L.filter((a) => !q || JSON.stringify(a).toLowerCase().includes(q)); $('#cnt').textContent = F.length + ' รายการ';
    $('#tb').innerHTML = F.slice(0, 500).map((a) => `<tr><td class="muted">${fmt(a.at)}</td><td>${esc(a.by)}${a.user ? `<br><span class="muted">${esc(a.user)}</span>` : ''}</td><td>${esc(ACT[a.action] || a.action)}</td><td>${esc(a.coll || '')} ${esc(a.id || '')}</td><td>${esc(a.detail || a.status || '')}</td></tr>`).join(''); };
  $('#q').oninput = draw; draw();
}
async function me() {
  app.innerHTML = `<div class="card" style="max-width:460px"><h2>🔑 เปลี่ยนรหัสผ่านของฉัน</h2><p class="muted">${esc(SC.me.username)} · ${esc(SC.roles[SC.me.role])}</p><input id="c" type="password" placeholder="รหัสผ่านปัจจุบัน" autocomplete="current-password"><input id="n" type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" autocomplete="new-password"><input id="n2" type="password" placeholder="ยืนยันรหัสผ่านใหม่" autocomplete="new-password"><button class="btn" id="go">เปลี่ยนรหัสผ่าน</button> <span id="msg"></span></div>`;
  $('#go').onclick = async () => { if ($('#n').value !== $('#n2').value) return ($('#msg').innerHTML = '<span class="err">รหัสผ่านใหม่ไม่ตรงกัน</span>'); try { await api('/api/admin/me/password', { method: 'POST', body: { current: $('#c').value, next: $('#n').value } }); $('#msg').innerHTML = '<span class="ok">เปลี่ยนแล้ว</span>'; } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
}
boot();
