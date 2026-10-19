// แจ้งเตือนน้ำท่วมพัทยา (design B) — SPA แบบ hash routing · ข้อความสาธารณะทุกจุดผ่าน T('key','ค่าเริ่มต้น') แก้ได้ที่ /admin → ข้อความทั้งเว็บ
const $ = (s, r = document) => r.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const C = { cfg: null }, CENTER = [12.9236, 100.8825];
const T = (k, d) => esc(C.cfg?.texts?.[k] ?? d);
const TX = (k, d) => C.cfg?.texts?.[k] ?? d; // raw (unescaped) for textContent / alerts
// ---------- language (TH default · EN · 中文) ----------
const LANGS = ['th', 'en', 'zh'], LOCALE = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN' };
const LANG = (() => { const q = new URLSearchParams(location.search).get('lang'); let l = q && LANGS.includes(q) ? q : localStorage.getItem('pfc_lang');
  if (!LANGS.includes(l)) { const n = (navigator.languages || [navigator.language || '']).map((x) => String(x).toLowerCase()); l = n.find((x) => /^(th|en|zh)/.test(x))?.slice(0, 2) || 'th'; }
  localStorage.setItem('pfc_lang', l); document.cookie = 'pfc_lang=' + l + ';path=/;max-age=31536000;samesite=lax';
  if (document.documentElement.dataset.lang && document.documentElement.dataset.lang !== l && !sessionStorage.getItem('pfc_lr')) { sessionStorage.setItem('pfc_lr', 1); location.reload(); }
  sessionStorage.removeItem('pfc_lr'); document.documentElement.lang = { th: 'th', en: 'en', zh: 'zh-CN' }[l]; return l; })();
const setLang = (l) => { localStorage.setItem('pfc_lang', l); document.cookie = 'pfc_lang=' + l + ';path=/;max-age=31536000;samesite=lax'; const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); };
const langSwitch = () => `<span class="langsw" role="group" aria-label="Language / ภาษา / 语言">${[['th', 'ไทย', 'th'], ['en', 'English', 'en'], ['zh', '中文', 'zh-CN']].map(([l, n, hl]) => `<button type="button" data-l="${l}" lang="${hl}" class="${l === LANG ? 'on' : ''}" aria-pressed="${l === LANG}">${n}</button>`).join('')}</span>`;
$('#langs').innerHTML = langSwitch();
document.addEventListener('click', (e) => { const b = e.target.closest?.('.langsw [data-l]'); if (b && b.dataset.l !== LANG) setLang(b.dataset.l); });
const DEV = localStorage.getItem('pfc_dev') || (localStorage.setItem('pfc_dev', (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now())), localStorage.getItem('pfc_dev'));
// ---------- anti-spam helpers: honeypot + fill time + optional Turnstile ----------
let formStart = Date.now();
const SUBMIT = /^\/api\/(reports|requests|missing|lostfound|safe)$/;
function armForm() { formStart = Date.now(); const go = document.querySelector('#go'); if (!go || !SUBMIT.test(go.dataset.api || '') && !document.querySelector('[data-pub]')) return;
  if (!document.querySelector('#website')) go.insertAdjacentHTML('beforebegin', '<div class="hp" aria-hidden="true"><label>Website<input id="website" name="website" tabindex="-1" autocomplete="off"></label></div>');
  const sk = C.cfg?.turnstileSiteKey; if (sk && !document.querySelector('#cfw')) { go.insertAdjacentHTML('beforebegin', '<div id="cfw" style="margin:8px 0"></div>');
    const draw = () => window.turnstile && window.turnstile.render('#cfw', { sitekey: sk, language: LANG === 'zh' ? 'zh-cn' : LANG });
    if (window.turnstile) draw(); else { const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.onload = draw; document.head.appendChild(sc); } } }
const api = async (u, o = {}) => { if (o.body && SUBMIT.test(u)) { o.body = { ...o.body, website: document.querySelector('#website')?.value || '', _ft: Date.now() - formStart, _dev: DEV, cfToken: window.turnstile && document.querySelector('#cfw') ? window.turnstile.getResponse('#cfw') : undefined }; }
  const r = await fetch(u, { headers: { 'content-type': 'application/json', 'x-lang': LANG, 'x-device-id': DEV }, credentials: 'same-origin', ...o, body: o.body && JSON.stringify(o.body) });
  if (SUBMIT.test(u) && window.turnstile && document.querySelector('#cfw')) try { window.turnstile.reset('#cfw'); } catch {} const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
const fmt = (iso) => iso ? new Date(iso.replace(' ', 'T') + (iso.length <= 16 ? ':00+07:00' : '')).toLocaleString(LOCALE[LANG], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ' + T('ui.tsuf', 'น.') : '-';
const tOnly = (iso) => hhmm(new Date(iso.replace(' ', 'T') + (iso.length <= 16 ? ':00+07:00' : '')));
const hhmm = (d = new Date()) => d.toLocaleTimeString(LOCALE[LANG], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? m + ' ' + T('ui.minago', 'นาทีที่แล้ว') : Math.round(m / 60) + ' ' + T('ui.hrago', 'ชั่วโมงที่แล้ว'); };
const tel = (p) => p ? `<a class="tel" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">${esc(p)}</a>` : `<span class="muted">${T('ui.nophone', 'ยังไม่มีหมายเลข')}</span>`;
// ---------- icon set B: solid pictograms (fill), drawn for this design ----------
const IC = {
  arrow: '<path d="M4 11h11.2l-4.6-4.6L12 5l7 7-7 7-1.4-1.4 4.6-4.6H4z"/>',
  warn: '<path fill-rule="evenodd" d="M12 2 1 21h22zM11 9h2v6h-2zM11 17h2v2h-2z"/>',
  phone: '<path fill-rule="evenodd" d="M7 1.5h10a2 2 0 0 1 2 2v17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2zM7 4v14h10V4zm5 15a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
  evac: '<circle cx="12" cy="4" r="2.2"/><path d="M10 7h4l1 6-2 .4V17h-2v-3.6L9 13z"/><path d="M2 18q2.5-2 5 0t5 0 5 0 5 0v2.5q-2.5-2-5 0t-5 0-5 0-5 0z"/>',
  med: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>',
  drop: '<path d="M12 2s7 7.6 7 12.5A7 7 0 0 1 5 14.5C5 9.6 12 2 12 2z"/>',
  gauge: '<path d="M3 19h18v2H3zM6 14h12v3H6zM9 9h6v3H9zM11 3h2v4h-2z"/>',
  pin: '<path fill-rule="evenodd" d="M12 1.5A7.5 7.5 0 0 0 4.5 9c0 5.6 7.5 13.5 7.5 13.5S19.5 14.6 19.5 9A7.5 7.5 0 0 0 12 1.5zm0 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>',
  home: '<path d="M12 3 2 11h3v10h5v-6h4v6h5V11h3z"/>',
  search: '<path fill-rule="evenodd" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/>',
  clock: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 4v7l5.5 3.2 1-1.7-4.5-2.6V6z"/>',
  cam: '<path d="M2 6h13v12H2zM16 10l6-3.5v11L16 14z"/>',
  rain: '<path d="M6.5 15a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.4A3.8 3.8 0 0 1 17.5 15zM7 17h2l-1.5 4h-2zM11 17h2l-1.5 4h-2zM15 17h2l-1.5 4h-2z"/>',
  people: '<circle cx="8" cy="7" r="3"/><path d="M2 20c0-4 2.7-6.5 6-6.5s6 2.5 6 6.5z"/><circle cx="17" cy="8" r="2.5"/><path d="M15.5 13.6c3.6-.6 6.5 1.6 6.5 5.4h-6c0-2.1-.2-3.8-.5-5.4z"/>',
  box: '<path fill-rule="evenodd" d="M3 7l9-4 9 4v10l-9 4-9-4zm9 4.2L5.5 8.3v7.4l6.5 2.9z"/>',
  route: '<path d="M6 3a3 3 0 0 1 1 5.8V15a3 3 0 0 0 3 3h4.2a3 3 0 1 1 0 2H10a5 5 0 0 1-5-5V8.8A3 3 0 0 1 6 3z"/>',
  menu: '<path d="M3 5h18v2.5H3zM3 10.75h18v2.5H3zM3 16.5h18V19H3z"/>',
  ok: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 13.6 6.4-6.4-1.5-1.5-4.9 4.9-2.4-2.4-1.5 1.5z"/>',
  info: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.2 8v8h2.4v-8zm0-4v2.4h2.4V6z"/>',
  lock: '<path fill-rule="evenodd" d="M6 10V8a6 6 0 0 1 12 0v2h1v12H5V10zm2.5 0h7V8a3.5 3.5 0 0 0-7 0z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  food: '<path d="M2 11h20a10 10 0 0 1-20 0zM7 21h10v1.5H7zM8 3h1.5v6H8zM11.25 3h1.5v6h-1.5zM14.5 3H16v6h-1.5z"/>',
  list: '<path d="M3 5h3v3H3zM8 5.5h13v2H8zM3 10.5h3v3H3zM8 11h13v2H8zM3 16h3v3H3zM8 16.5h13v2H8z"/>',
  map: '<path d="M2 5l6-2 8 3 6-2v15l-6 2-8-3-6 2z"/>',
  down: '<path d="M5.6 8 12 14.4 18.4 8 20 9.6l-8 8-8-8z"/>',
  x: '<path d="M5.4 4 12 10.6 18.6 4 20 5.4 13.4 12l6.6 6.6-1.4 1.4-6.6-6.6L5.4 20 4 18.6l6.6-6.6L4 5.4z"/>',
  photo: '<path fill-rule="evenodd" d="M8 5l1.5-2h5L16 5h5v15H3V5zm4 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/>',
  ext: '<path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM5 5h6v2H7v10h10v-4h2v6H5z"/>',
  target: '<path fill-rule="evenodd" d="M11 1h2v3.1A8 8 0 0 1 19.9 11H23v2h-3.1A8 8 0 0 1 13 19.9V23h-2v-3.1A8 8 0 0 1 4.1 13H1v-2h3.1A8 8 0 0 1 11 4.1zm1 5.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>',
  hand: '<path d="M9 2.5a1.5 1.5 0 0 1 3 0V10h1V4a1.5 1.5 0 0 1 3 0v7h1V6.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L2.4 13.3a1.5 1.5 0 0 1 2.5-1.6L7.5 15H9z"/>',
};
const ico = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${IC[k] || ''}</svg>`;
// ---------- 5-step public alert scale (B) ----------
const AL = [null,
  { c: '#1b7f4b', fg: '#fff' }, { c: '#f5c400', fg: '#111a24' }, { c: '#ef7d22', fg: '#111a24' }, { c: '#c8321f', fg: '#fff' }, { c: '#5e2a84', fg: '#fff' }];
const ALN = () => [null, T('lvl.1', 'ปกติ'), T('lvl.2', 'เฝ้าระวัง'), T('lvl.3', 'เตรียมพร้อม'), T('lvl.4', 'อันตราย'), T('lvl.5', 'วิกฤตสูงสุด')];
const ALD = () => [null, T('lvl.1.d', 'ยังไม่มีรายงานน้ำท่วมที่น่ากังวลในเขตเมือง'), T('lvl.2.d', 'มีน้ำขังตื้นบางจุด หรือพยากรณ์ว่าจะมีฝนหนัก'), T('lvl.3.d', 'มีจุดที่น้ำสูงถึงเข่า รถเล็กผ่านไม่ได้'), T('lvl.4.d', 'มีจุดที่น้ำสูงถึงเอว การเดินหรือขับรถผ่านเสี่ยงต่อชีวิต'), T('lvl.5.d', 'มีจุดที่น้ำสูงถึงอกหรือมากกว่า ผู้ที่อยู่ในพื้นที่ต้องขึ้นที่สูงทันที')];
const TODO = () => [null,
  [T('lvl.1.a1', 'บันทึกเบอร์ 1669, 1784 และ 1337 ไว้ในโทรศัพท์'), T('lvl.1.a2', 'เตรียมกระเป๋าฉุกเฉิน: ยาประจำตัว สำเนาเอกสาร ไฟฉาย แบตเตอรี่สำรอง'), T('lvl.1.a3', 'ดูพยากรณ์ฝนวันละครั้ง โดยเฉพาะช่วงมรสุม')],
  [T('lvl.2.a1', 'เลี่ยงทางลอดและถนนที่อยู่ต่ำ'), T('lvl.2.a2', 'ถ้าบ้านอยู่ในจุดที่น้ำท่วมบ่อย ให้ย้ายรถไปจอดที่สูงไว้ก่อน'), T('lvl.2.a3', 'เปิดแผนที่ในเว็บนี้ก่อนออกจากบ้าน')],
  [T('lvl.3.a1', 'ยกเครื่องใช้ไฟฟ้า เอกสาร และของมีค่าขึ้นที่สูง'), T('lvl.3.a2', 'ห้ามขับรถเก๋งหรือรถจักรยานยนต์ผ่านน้ำระดับเข่า'), T('lvl.3.a3', 'ให้ผู้สูงอายุ เด็ก และผู้ป่วยในบ้านพร้อมย้ายออกได้ทุกเมื่อ')],
  [T('lvl.4.a1', 'ถ้าน้ำเริ่มเข้าบ้าน ให้ตัดไฟที่เบรกเกอร์ก่อน'), T('lvl.4.a2', 'อย่าเดินหรือขับรถลุยน้ำที่ไหล แม้ดูตื้น'), T('lvl.4.a3', 'ถ้าออกจากบ้านไม่ได้ ให้ส่งคำขอความช่วยเหลือพร้อมตำแหน่ง')],
  [T('lvl.5.a1', 'ขึ้นที่สูงทันที ไม่ต้องเก็บทรัพย์สิน'), T('lvl.5.a2', 'มีผู้บาดเจ็บหรือติดอยู่ โทร 1669 หรือ 1784 ทันที'), T('lvl.5.a3', 'ส่งตำแหน่งผ่านแบบฟอร์มขอความช่วยเหลือ แล้วรออยู่ในจุดที่ปลอดภัย')]];
const levelOf = (maxCm, heavy) => (maxCm >= 155 ? 5 : maxCm >= 115 ? 4 : maxCm >= 75 ? 3 : maxCm >= 30 || heavy ? 2 : 1);
const LVCOL = { dry: '#1b7f4b', ankle: '#f5c400', knee: '#ef7d22', waist: '#c8321f', chest: '#5e2a84', roof: '#2d1446' };
const LVFG = { dry: '#fff', ankle: '#111a24', knee: '#111a24', waist: '#fff', chest: '#fff', roof: '#fff' };
const LVH = { dry: 4, ankle: 16, knee: 38, waist: 58, chest: 78, roof: 96 };
const depthTag = (lv, txt) => `<strong class="tag" style="background:${LVCOL[lv] || '#4a5361'};color:${LVFG[lv] || '#fff'}">${esc(txt)}</strong>`;
const alTag = (n) => `<strong class="tag" style="background:${AL[n].c};color:${AL[n].fg}">${T('lvl.word', 'ระดับ')} ${n} · ${ALN()[n]}</strong>`;
// ---------- moderation (hybrid): badges + "still flooded / water gone" votes ----------
const modBadge = (r) => (r.mod === 'pending' ? `<span class="mtag pend">${T('vote.tag.wait', 'รอการยืนยัน')}</span>` : r.mod === 'verified' ? `<span class="mtag ver">${T('vote.tag.ok', 'ยืนยันแล้ว')}</span>` : '') + (r.cleared ? ` <span class="mtag clr">${T('vote.tag.gone', 'มีรายงานว่าน้ำลดแล้ว')}</span>` : '');
const voteBtns = (r) => { const done = JSON.parse(localStorage.getItem('pfc_votes') || '{}')[r.id];
  return `<div class="votes" data-rid="${esc(r.id)}"><p class="vq">${T('vote.ask', 'คุณเห็นจุดนี้อยู่ตอนนี้หรือไม่')}</p><div class="btnrow"><button type="button" class="btn sec sm" data-vote="yes" ${done ? 'disabled' : ''}>${T('vote.still', 'น้ำยังท่วมอยู่')}${r.yes ? ' (' + r.yes + ')' : ''}</button><button type="button" class="btn sec sm" data-vote="no" ${done ? 'disabled' : ''}>${T('vote.gone', 'น้ำแห้งแล้ว')}${r.no ? ' (' + r.no + ')' : ''}</button></div><p class="muted vmsg">${done ? T('vote.thanks', 'ขอบคุณ คำตอบของคุณถูกนับแล้ว') : ''}</p></div>`; };
document.addEventListener('click', async (e) => { const b = e.target.closest?.('[data-vote]'); if (!b) return; const box = b.closest('[data-rid]'), id = box.dataset.rid;
  box.querySelectorAll('button').forEach((x) => (x.disabled = true));
  try { await api('/api/reports/' + encodeURIComponent(id) + '/vote', { method: 'POST', body: { v: b.dataset.vote } }); const v = JSON.parse(localStorage.getItem('pfc_votes') || '{}'); v[id] = b.dataset.vote; localStorage.setItem('pfc_votes', JSON.stringify(v)); $('.vmsg', box).textContent = TX('vote.thanks', 'ขอบคุณ คำตอบของคุณถูกนับแล้ว'); }
  catch (err) { $('.vmsg', box).innerHTML = `<span class="err">${esc(err.message)}</span>`; if (/429/.test(err.message)) box.querySelectorAll('button').forEach((x) => (x.disabled = false)); } });
const modMsg = (r) => (r.mod === 'held' || (r.mod === 'pending' && r.public === false) ? `<p>${T('vote.note.held', 'รายงานนี้จะเผยแพร่หลังเจ้าหน้าที่ตรวจสอบแล้ว')}</p>` : r.mod === 'pending' ? `<p>${T('vote.note.wait', 'รายงานแสดงบนแผนที่แล้วพร้อมป้าย "รอการยืนยัน" ป้ายจะหายไปเมื่อมีผู้อื่นยืนยันหรือเจ้าหน้าที่ตรวจสอบ')}</p>` : '');
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 108.5);
const stName = (s) => esc(C.cfg?.statusNames?.[s] || s);
async function cfg(force) { if (!C.cfg || force) { C.cfg = await api('/api/config'); chrome(); } return C.cfg; }
const HOT = () => [['1669', T('ui.hot.1669', 'เจ็บป่วยฉุกเฉิน')], ['1784', T('ui.hot.1784', 'ป้องกันและบรรเทาสาธารณภัย')], ['1337', T('ui.hot.1337', 'ศูนย์รับแจ้งเหตุเมืองพัทยา')]];
const MENU = () => [
  { g: T('idx.g.help', 'ขอความช่วยเหลือ'), items: [['help?kind=evacuate', T('idx.evac', 'ออกจากพื้นที่น้ำท่วม'), T('idx.evac.d', 'ให้ทีมเรือหรือรถยกสูงมารับ')], ['help?kind=medical', T('idx.med', 'ผู้ป่วยหรือยาหมด'), T('idx.med.d', 'ผู้ป่วยติดเตียง ต้องการยา หรือออกซิเจน')], ['sos', T('idx.food', 'อาหาร น้ำดื่ม ของใช้'), T('idx.food.d', 'ส่งผ่านผู้ประสานงานชุมชน')], ['call', T('idx.call', 'เบอร์โทรฉุกเฉิน'), T('idx.call.d', 'สายด่วน โรงพยาบาล และผู้ประสานงาน')], ['status', T('idx.track', 'ติดตามคำขอ'), T('idx.track.d', 'ใช้หมายเลขอ้างอิงและเบอร์ 4 ตัวท้าย')], ['shelters', T('idx.shel', 'ศูนย์พักพิง'), T('idx.shel.d', 'ที่ว่าง สิ่งอำนวยความสะดวก และเส้นทาง')], ['safe', T('idx.safe', 'ฉันปลอดภัย'), T('idx.safe.d', 'บอกครอบครัวว่าคุณปลอดภัย หรือค้นหาชื่อ')]] },
  { g: T('idx.g.tell', 'แจ้งข้อมูล'), items: [['report', T('idx.report', 'แจ้งระดับน้ำ'), T('idx.report.d', 'ใช้เวลาไม่ถึง 1 นาที ไม่ต้องใส่ชื่อ')], ['missing', T('idx.missing', 'แจ้งคนที่ติดต่อไม่ได้'), T('idx.missing.d', 'ส่งถึงเจ้าหน้าที่เท่านั้น')], ['lost-found', T('idx.lf', 'ของหายและของที่เก็บได้'), T('idx.lf.d', 'สัตว์เลี้ยง เอกสาร ทรัพย์สิน')]] },
  { g: T('idx.g.watch', 'ติดตามสถานการณ์'), items: [['map', T('idx.map', 'แผนที่และเส้นทางเลี่ยงน้ำ'), T('idx.map.d', 'จุดน้ำท่วม ถนนปิด และการหาเส้นทาง')], ['route', T('idx.route', 'เส้นทางเลี่ยงน้ำตามยานพาหนะ'), T('idx.route.d', 'เดิน มอเตอร์ไซค์ รถยนต์ รถกู้ภัย · ศูนย์พักพิงและโรงพยาบาลใกล้สุด')], ['updates', T('idx.updates', 'รายงานทั้งหมด'), T('idx.updates.d', 'เรียงตามเวลา ย้อนหลัง 72 ชั่วโมง')], ['history', T('idx.hist', 'ซอยที่น้ำท่วมซ้ำ'), T('idx.hist.d', 'สถิติย้อนหลังรายซอย และดาวน์โหลด CSV')], ['area', T('idx.area', 'สถานการณ์แต่ละชุมชน'), T('idx.area.d', 'ตารางเรียงตามความรุนแรง')], ['weather', T('idx.weather', 'ฝนและระดับน้ำ'), T('idx.weather.d', 'พยากรณ์รายชั่วโมงและเรดาร์')], ['cctv', T('idx.cctv', 'กล้องถนน'), T('idx.cctv.d', 'ตำแหน่งกล้องของเมืองพัทยา')], ['status', T('idx.status', 'ติดตามคำขอของคุณ'), T('idx.status.d', 'ใช้เลขอ้างอิงและเบอร์โทร 4 ตัวท้าย')], ['levels', T('idx.levels', 'ความหมายของระดับเตือนภัย'), T('idx.levels.d', 'มาตรา 5 ระดับที่เว็บนี้ใช้')]] },
];
const curPage = () => location.hash.replace(/^#\/?/, '').split('?')[0];
function chrome() {
  const s = C.cfg.settings || {}, b = s.banner || {}, cur = curPage();
  $('#banner').innerHTML = b.on && b.text ? `<div class="wrap"><div class="notice ${esc(b.level)}" role="alert"><p class="notice-h">${b.level === 'info' ? T('ui.notice.info', 'ประกาศ') : T('ui.notice.warn', 'ประกาศสำคัญ')}</p><p>${esc(b.text)}</p></div></div>` : '';
  $('#menu').innerHTML = `<div class="wrap menu-in">${MENU().map((g) => `<div class="menu-g"><h2>${g.g}</h2><ul>${g.items.map(([h, l, d]) => `<li><a href="#/${h}" ${cur === h.split('?')[0] ? 'aria-current="page"' : ''}>${l}</a><span>${d}</span></li>`).join('')}</ul></div>`).join('')}</div>`;
  $('#ftlinks').innerHTML = `<ul>${MENU().flatMap((g) => g.items).map(([h, l]) => `<li><a href="#/${h}">${l}</a></li>`).join('')}<li><a href="#/staff">${T('ui.staff', 'สำหรับเจ้าหน้าที่')}</a></li></ul>`;
  document.body.dataset.page = cur || 'home';
  alertBar();
}
const mb = $('#menuBtn'); const closeMenu = () => { $('#menu').hidden = true; mb.setAttribute('aria-expanded', 'false'); };
mb.onclick = () => { const open = $('#menu').hidden; $('#menu').hidden = !open; mb.setAttribute('aria-expanded', String(open)); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#menu').hidden) { closeMenu(); mb.focus(); } });
$('#menu').addEventListener('click', (e) => e.target.closest('a') && closeMenu());
// ---------- alert level (computed from citizen reports + rain forecast, cached 60 s) ----------
let ALC = null;
async function alertData(force) {
  if (ALC && !force && Date.now() - ALC.t < 60000) return ALC;
  const [rs, fc] = await Promise.all([api('/api/reports?hours=24').catch(() => []), api('/api/forecast').catch(() => ({}))]);
  const live = rs.filter((r) => !r.cleared), maxR = live.reduce((m, r) => (r.cm > (m?.cm ?? -1) ? r : m), null);
  const heavy = !!(fc.ok && (fc.totalMm >= 35 || (fc.hourly || []).some((h) => h.mm >= 10)));
  ALC = { t: Date.now(), rs, live, fc, maxR, heavy, n: levelOf(maxR?.cm || 0, heavy) }; return ALC;
}
async function alertBar() {
  const el = $('#alertbar'), home = curPage() === ''; const a = await alertData().catch(() => null); if (!a) return (el.innerHTML = '');
  const n = a.n, why = a.maxR ? `${T('ui.al.max', 'น้ำสูงสุดที่มีผู้แจ้ง:')} ${esc(a.maxR.levelText)}${a.maxR.areaName ? ' — ' + esc(a.maxR.areaName) : ''}` : T('ui.al.none', 'ยังไม่มีผู้แจ้งน้ำท่วมใน 24 ชั่วโมงที่ผ่านมา');
  const rain = a.heavy ? ` · ${T('ui.al.rain', 'พยากรณ์ฝนหนักใน 24 ชั่วโมง')}` : '';
  el.className = 'ab l' + n; document.documentElement.style.setProperty('--al', AL[n].c); document.documentElement.style.setProperty('--alfg', AL[n].fg);
  el.innerHTML = home ? `<div class="wrap ab-in"><div class="ab-num" aria-hidden="true"><small>${T('lvl.word', 'ระดับ')}</small><b>${n}</b><small>/5</small></div>
   <div class="ab-tx"><p class="ab-k">${T('ui.al.k', 'ระดับเตือนภัยน้ำท่วม เมืองพัทยา')}</p><h2>${T('lvl.word', 'ระดับ')} ${n} ${T('ui.al.of', 'จาก 5')}: ${ALN()[n]}</h2><p>${ALD()[n]}</p><p class="ab-why">${why}${rain}</p></div>
   <ol class="ab-scale" aria-label="${T('ui.al.scale', 'มาตราเตือนภัย 5 ระดับ')}">${[1, 2, 3, 4, 5].map((i) => `<li style="--c:${AL[i].c};--f:${AL[i].fg}" ${i === n ? 'aria-current="true"' : ''}><b>${i}</b><span>${ALN()[i]}</span></li>`).join('')}</ol></div>
   <div class="ab-meta"><div class="wrap">${T('ui.al.at', 'ประเมินล่าสุด')} ${hhmm()} ${T('ui.tsuf', 'น.')} · ${T('ui.al.how', 'คำนวณอัตโนมัติจากรายงานของประชาชนและพยากรณ์ฝน ไม่ใช่ประกาศทางราชการ')} · <a href="#/levels">${T('ui.al.what', 'ความหมายของแต่ละระดับ')}</a></div></div>`
   : `<div class="wrap ab-mini"><b class="ab-chip">${n}</b><span><strong>${T('lvl.word', 'ระดับ')} ${n}: ${ALN()[n]}</strong> <span class="ab-mini-d">— ${ALD()[n]}</span></span><a href="#/">${T('ui.al.todo', 'สิ่งที่ควรทำ')}</a></div>`;
}
// Basemaps: OSM standard (Thai street & soi names from z16–19) and CARTO Voyager. Both free, no key; attribution as their policies require.
// Soi labels at high zoom: maps get class "zhi" at zoom >= 17 so permanent soi tooltips only show when there is room.
function tiles(m) {
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(m);
  const voy = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' });
  m.bases = { [TX('loc.b.osm', 'แผนที่ถนน (OSM)')]: osm, [TX('loc.b.voy', 'แผนที่สีอ่อน (CARTO)')]: voy }; m.options.maxZoom = 19;
  const zc = () => m.getContainer().classList.toggle('zhi', m.getZoom() >= 17); m.on('zoomend', zc); m.whenReady(zc);
  const g = C.cfg?.geo; if (g?.boundary) { const [s, w, n, e] = g.bbox; m.setMaxBounds([[s - 0.06, w - 0.08], [n + 0.06, e + 0.08]]); m.options.minZoom = 11;
    L.geoJSON(g.boundary, { interactive: false, style: { color: '#101b2b', weight: 2.5, dashArray: '2 7', fill: true, fillColor: '#1a56b8', fillOpacity: 0.025 } }).addTo(m)
      .bindTooltip?.(T('ui.geo', 'เขตการปกครองเมืองพัทยา')); }
  return m; }
const inCity = (lat, lng) => { const g = C.cfg?.geo; if (!g?.on || !g.boundary) return true; const P = g.boundary.type === 'MultiPolygon' ? g.boundary.coordinates : [g.boundary.coordinates];
  const has = (r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c; };
  return P.some((p) => has(p[0])); };
async function photoData(input) { const f = input.files?.[0]; if (!f) return null; const img = await createImageBitmap(f); const s = Math.min(1, 1280 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.75); }
function gps() { return new Promise((ok, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), () => no(new Error(TX('ui.err.gps', 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์ หรือเลือกตำแหน่งบนแผนที่'))), { enableHighAccuracy: true, timeout: 10000 }) : no(new Error(TX('ui.err.nogps', 'อุปกรณ์นี้ระบุตำแหน่งเองไม่ได้ โปรดเลือกตำแหน่งบนแผนที่')))); }
async function geocode(q) { const [s, w, n, e] = C.cfg?.geo?.bbox || [12.75, 100.7, 13.1, 101.1];
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=10&countrycodes=th&viewbox=${w},${n},${e},${s}&bounded=1&accept-language=${LANG === 'zh' ? 'zh,en' : LANG}&q=${encodeURIComponent(q)}`); return (await r.json()).filter((x) => inCity(+x.lat, +x.lon)).slice(0, 5); }
// ---------- page building blocks ----------
const title = (t) => { document.title = t + ' – ' + TX('ui.name', 'แจ้งเตือนน้ำท่วม') + ' ' + TX('ui.city', 'เมืองพัทยา'); };
const head = (icon, tk, td, lk, ld) => { title(TX(tk, td));
  return `<div class="pg-h"><nav class="bc" aria-label="${T('ui.bc', 'ตำแหน่งของหน้านี้')}"><ol><li><a href="#/">${T('ui.home', 'หน้าแรก')}</a></li><li aria-current="page">${T(tk, td)}</li></ol></nav><h1 class="h-xl">${T(tk, td)}</h1>${lk ? `<p class="lead">${T(lk, ld)}</p>` : ''}</div>`; };
const SL = (rows) => `<dl class="sl">${rows.filter(Boolean).map(([k, v, a]) => `<div class="sl-r"><dt>${k}</dt><dd>${v}</dd><dd class="sl-a">${a || ''}</dd></div>`).join('')}</dl>`;
const warnText = (html) => `<div class="wt" role="note"><span class="wt-i" aria-hidden="true">!</span><strong>${html}</strong></div>`;
const inset = (html) => `<div class="inset">${html}</div>`;
const acc = (id, t, body, open) => `<details class="acc" ${id ? `id="${id}"` : ''} ${open ? 'open' : ''}><summary><span>${t}</span></summary><div class="acc-b">${body}</div></details>`;
const linkGo = (h, t) => `<a class="go" href="${h}">${t}${ico('arrow')}</a>`;
const errBox = (msgs) => `<div class="es" role="alert" tabindex="-1"><h2>${T('steps.err', 'โปรดแก้ไขข้อมูลต่อไปนี้')}</h2><ul>${msgs.map(([id, m]) => `<li><a href="#" data-focus="${id}">${esc(m)}</a></li>`).join('')}</ul></div>`;
document.addEventListener('click', (e) => { const a = e.target.closest?.('[data-focus]'); if (!a) return; e.preventDefault(); const t = document.getElementById(a.dataset.focus) || document.querySelector(`[name="${a.dataset.focus}"]`); t?.scrollIntoView({ block: 'center' }); t?.focus?.(); });
const showErr = (where, msgs) => { where.innerHTML = errBox(msgs); where.querySelector('.es').focus(); };
const confirmPanel = (h, ref, body) => `<div class="cp" role="status"><h1 class="ok">${h}</h1>${ref ? `<p>${T('steps.ref', 'หมายเลขอ้างอิง')}<br><strong class="cp-ref">${esc(ref)}</strong></p>` : ''}</div>${body}`;
const radios = (name, opts, cur, extra = '') => `<div class="rad" ${extra}>${opts.map(([v, l, hint, style]) => `<div class="rad-i" ${style ? `style="${style}"` : ''}><input type="radio" id="${name}-${v}" name="${name}" value="${esc(v)}" ${cur === v ? 'checked' : ''}><label for="${name}-${v}">${l}${hint ? `<span class="hint">${hint}</span>` : ''}</label></div>`).join('')}</div>`;
const checks = (name, opts) => `<div class="chk">${opts.map((l, i) => `<div class="chk-i"><input type="checkbox" id="${name}-${i}" name="${name}" value="${esc(l)}"><label for="${name}-${i}">${esc(l)}</label></div>`).join('')}</div>`;
const field = (id, label, input, hint) => `<div class="fg"><label class="lbl" for="${id}">${label}</label>${hint ? `<p class="hint" id="${id}-h">${hint}</p>` : ''}${input}</div>`;
const pickVal = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
// one-question-per-page wizard: steps = [{t, body, ok(): [id,msg][]|null, sum(): [[k,v]]}] + final check-your-answers page holding #go
function wizard(root, steps, finalHtml, onShow) {
  const n = steps.length; let i = 0;
  root.innerHTML = `<div id="wzErr"></div>${steps.map((s, k) => `<section class="step" data-k="${k}" ${k ? 'hidden' : ''} aria-labelledby="st${k}"><p class="cap">${T('steps.of1', 'ขั้นที่')} ${k + 1} ${T('steps.of2', 'จาก')} ${n + 1}${T('steps.of3', '')}</p><h2 class="h-l" id="st${k}">${s.t}</h2>${s.body}<div class="btnrow"><button type="button" class="btn" data-next>${T('steps.next', 'ต่อไป')}</button>${k ? `<button type="button" class="btn link" data-back>${T('steps.back', 'ย้อนกลับ')}</button>` : ''}</div></section>`).join('')}
   <section class="step" data-k="${n}" hidden aria-labelledby="stC"><p class="cap">${T('steps.of1', 'ขั้นที่')} ${n + 1} ${T('steps.of2', 'จาก')} ${n + 1}${T('steps.of3', '')}</p><h2 class="h-l" id="stC">${T('steps.check', 'ตรวจคำตอบก่อนส่ง')}</h2><div id="wzSum"></div>${finalHtml}<p><button type="button" class="btn link" data-back>${T('steps.back', 'ย้อนกลับ')}</button></p></section>`;
  const show = (k) => { i = k; root.querySelectorAll('.step').forEach((s) => (s.hidden = +s.dataset.k !== k)); $('#wzErr').innerHTML = '';
    if (k === n) $('#wzSum').innerHTML = SL(steps.flatMap((s, j) => s.sum().map(([a, b]) => [a, b || `<span class="muted">${T('steps.none', 'ไม่ได้ระบุ')}</span>`, `<a href="#" data-edit="${j}">${T('steps.change', 'แก้ไข')}<span class="sr"> ${a}</span></a>`])));
    onShow?.(k); const h = root.querySelector(`.step[data-k="${k}"] h2`); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); root.scrollIntoView({ block: 'start' }); };
  root.addEventListener('click', (e) => { if (e.target.closest('[data-next]')) { const bad = steps[i].ok?.(); if (bad && bad.length) return showErr($('#wzErr'), bad); show(i + 1); }
    if (e.target.closest('[data-back]')) show(Math.max(0, i - 1)); const ed = e.target.closest('[data-edit]'); if (ed) { e.preventDefault(); show(+ed.dataset.edit); } });
  return { show };
}

// ---------- SSE ----------
const listeners = new Set(); const on = (fn) => { listeners.add(fn); return fn; };
(function sse() { const es = new EventSource('/api/events'); const live = $('#live'); const html = live.innerHTML;
  es.onopen = () => { live.className = 'live'; live.innerHTML = html; }; es.onerror = () => { live.className = 'live off'; live.innerHTML = '<i></i>' + T('ui.off', 'การเชื่อมต่อขาดหาย กำลังลองใหม่'); };
  for (const t of ['report', 'request', 'roads', 'contacts', 'deleted', 'lostfound', 'cms', 'staff:request', 'staff:update', 'staff:missing', 'staff:report', 'staff:lostfound']) es.addEventListener(t, async (e) => { const d = JSON.parse(e.data); if (t === 'contacts') C.cfg && (C.cfg.contacts = d); if (t === 'report' || t === 'deleted') { ALC = null; alertBar(); } if (t === 'cms') { await cfg(true); if (!location.hash.startsWith('#/staff')) return render(); } listeners.forEach((f) => f(t, d)); });
})();

// ---------- routes ----------
const routes = {
  '': home, sos: () => helpForm('food'), help: (q) => helpForm(q.kind || 'evacuate'), report, status, area, map: mapPage, updates, missing, 'lost-found': lostFound, cctv, weather, call: callPage, more: menuPage, levels: levelsPage, staff: staffPage, shelters: sheltersPage, safe: safePage, history: historyPage, route: routePage, admin: () => { location.href = '/admin'; },
};
let RT = 0; // render token: an older page that finishes loading late must not overwrite the current one
async function render() { const my = ++RT; listeners.clear(); closeMenu(); const [p, qs] = location.hash.replace(/^#\/?/, '').split('?'); const q = Object.fromEntries(new URLSearchParams(qs || '')); window.scrollTo(0, 0); app.innerHTML = `<p class="muted loading">${C.cfg ? T('ui.wait', 'กำลังโหลดข้อมูล…') : '…'}</p>`; try { await cfg(); chrome(); await (routes[p] || home)(q); document.querySelector('#go')?.setAttribute('data-pub', ''); if (['report', 'sos', 'help', 'missing', 'lost-found', 'safe'].includes(p)) armForm(); if (p) app.focus({ preventScroll: true }); } catch (e) { if (my !== RT) return; app.innerHTML = `<div class="es" role="alert"><h2>${T('ui.oops', 'ขออภัย เกิดปัญหาในการแสดงหน้านี้')}</h2><p>${esc(e.message)}</p><p><a href="#/">${T('ui.home', 'หน้าแรก')}</a></p></div>`; } }
addEventListener('hashchange', render); render();

// ================= home =================
const rainCell = (mm) => (mm >= 10 ? ['#16306b', '#fff'] : mm >= 5 ? ['#2f6fbf', '#fff'] : mm >= 1 ? ['#8dbbe8', '#111a24'] : mm > 0 ? ['#d3e5f7', '#111a24'] : ['#f3f4f6', '#4a5361']);
const rainStrip = (H) => `<div class="strip" role="img" aria-label="${T('sky.strip', 'ปริมาณฝนรายชั่วโมง 24 ชั่วโมงข้างหน้า')}">${H.map((h, i) => { const [bg, fg] = rainCell(h.mm); return `<span style="background:${bg};color:${fg}" title="${h.t.slice(11)} · ${h.mm} mm · ${h.prob}%"><b>${h.mm >= 1 ? Math.round(h.mm) : ''}</b>${i % 3 === 0 ? `<small>${h.t.slice(11, 13)}</small>` : '<small>&nbsp;</small>'}</span>`; }).join('')}</div>
  <ul class="strip-k"><li><i style="background:#f3f4f6"></i>${T('sky.k0', 'ไม่มีฝน')}</li><li><i style="background:#d3e5f7"></i>${T('sky.k1', 'น้อยกว่า 1 มม.')}</li><li><i style="background:#8dbbe8"></i>1–5</li><li><i style="background:#2f6fbf"></i>5–10</li><li><i style="background:#16306b"></i>${T('sky.k4', '10 มม. ขึ้นไป')}</li></ul>`;
async function home() {
  const cf = await cfg(), c = cf.contacts; const served = c.areas.filter((a) => a.served).map((a) => a.name);
  document.title = TX('ui.title', 'แจ้งเตือนน้ำท่วมพัทยา: ระดับเตือนภัย สิ่งที่ต้องทำ และการขอความช่วยเหลือ');
  const S = {
   todo: `<section aria-labelledby="tdT"><h2 class="h-l" id="tdT">${T('now.todo', 'สิ่งที่ควรทำตอนนี้')}</h2><div id="todo" class="todo"></div></section>`,
   start: `<section aria-labelledby="stT"><h2 class="h-l" id="stT">${T('now.start', 'ขอความช่วยเหลือหรือแจ้งข้อมูล')}</h2><p>${T('now.start.p', 'ส่งคำขอถึงเจ้าหน้าที่ได้ตลอด 24 ชั่วโมง คุณจะได้หมายเลขอ้างอิงไว้ติดตามเรื่อง')}</p>
    <a class="btn start" href="#/help?kind=evacuate" role="button">${T('now.start.btn', 'เริ่มขอความช่วยเหลือ')}${ico('arrow')}</a>
    <ul class="tasks">${[['#/help?kind=medical', T('now.t.med', 'มีผู้ป่วย หรือยาประจำตัวหมด')], ['#/sos', T('now.t.food', 'ขออาหาร น้ำดื่ม และของใช้จำเป็น')], ['#/report', T('now.t.report', 'แจ้งระดับน้ำในจุดที่คุณอยู่')], ['#/missing', T('now.t.missing', 'แจ้งคนที่ติดต่อไม่ได้')], ['#/status', T('now.t.status', 'ติดตามคำขอที่ส่งไปแล้ว')]].map(([h, t]) => `<li>${linkGo(h, t)}</li>`).join('')}</ul>
    ${served.length ? `<p class="hint">${T('now.served', 'ขณะนี้รับคำขอสิ่งของผ่านเว็บในพื้นที่:')} ${esc(served.join(', '))}</p>` : ''}</section>`,
   summary: `<section aria-labelledby="smT"><h2 class="h-l" id="smT">${T('now.sum', 'สถานการณ์ใน 24 ชั่วโมงล่าสุด')}</h2><div id="sum">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</div></section>`,
   latest: `<section aria-labelledby="ltT"><h2 class="h-l" id="ltT">${T('now.latest', 'รายงานล่าสุดจากประชาชน')}</h2><div id="latest">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</div><p>${linkGo('#/updates', T('now.latest.all', 'ดูรายงานทั้งหมด'))}</p></section>`,
   mapteaser: `<section aria-labelledby="mpT"><h2 class="h-l" id="mpT">${T('now.map', 'แผนที่จุดน้ำท่วม')}</h2><div id="hmap" class="hmap" role="region" aria-label="${T('now.map.aria', 'แผนที่ตัวอย่างแสดงจุดที่ประชาชนแจ้งน้ำท่วม')}"></div><p>${linkGo('#/map', T('now.map.open', 'เปิดแผนที่เต็มและหาเส้นทางเลี่ยงน้ำ'))}</p></section>`,
   rain: `<section aria-labelledby="rnT"><h2 class="h-l" id="rnT">${T('now.rain', 'ฝนใน 24 ชั่วโมงข้างหน้า')}</h2><div id="fc">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</div>${acc('', T('now.rain.water', 'ระดับน้ำจากสถานีวัดและจากประชาชน'), `<div id="wl">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</div>`)}${acc('', T('now.rain.st', 'ฝนสะสม 24 ชั่วโมง รายสถานี'), `<div id="rn">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</div>`)}<p>${linkGo('#/weather', T('now.rain.more', 'พยากรณ์รายชั่วโมงและเรดาร์'))}</p></section>`,
   near: `<section aria-labelledby="nrT"><h2 class="h-l" id="nrT">${T('now.near', 'ตรวจสอบบริเวณที่คุณอยู่')}</h2><p>${T('now.near.p', 'นับรายงานน้ำท่วมในรัศมี 1.5 กิโลเมตร จากตำแหน่งของคุณหรือจากชุมชนที่เลือก')}</p><div class="btnrow"><button class="btn sec" id="near" type="button">${ico('target')}${T('now.near.gps', 'ใช้ตำแหน่งปัจจุบัน')}</button></div>${field('nearArea', T('now.near.or', 'หรือเลือกชุมชน'), `<select id="nearArea" class="sel"><option value="">${T('now.near.pick', 'เลือกชุมชน')}</option>${c.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>`)}<div id="nearOut" aria-live="polite"></div><p class="hint">${T('now.near.priv', 'ตำแหน่งของคุณใช้คำนวณในเครื่องนี้เท่านั้น ไม่ถูกส่งหรือเก็บไว้')}</p></section>`,
   prepare: `<section aria-labelledby="ppT"><h2 class="h-l" id="ppT">${T('prep.h', 'เตรียมตัวรับมือน้ำท่วม')}</h2>
    ${acc('', T('prep.before', 'ก่อนน้ำมา'), `<ul class="bul"><li>${T('prep.b1', 'รู้ว่าบ้านคุณอยู่ใกล้จุดที่น้ำท่วมบ่อยหรือไม่ ดูได้จากแผนที่')}</li><li>${T('prep.b2', 'ตกลงกับคนในบ้านว่าจะไปรวมกันที่ไหน ถ้าโทรศัพท์ใช้ไม่ได้')}</li><li>${T('prep.b3', 'เก็บเอกสารสำคัญในถุงกันน้ำ และถ่ายรูปเก็บไว้ในโทรศัพท์')}</li><li>${T('prep.b4', 'เตรียมน้ำดื่มและอาหารแห้งสำหรับ 3 วัน')}</li></ul>`)}
    ${acc('', T('prep.during', 'ระหว่างน้ำท่วม'), `<ul class="bul"><li>${T('prep.d1', 'น้ำไหลสูงเพียง 15 ซม. ก็ทำให้คนล้มได้ และ 30 ซม. พัดรถเก๋งได้')}</li><li>${T('prep.d2', 'อยู่ห่างจากเสาไฟและสายไฟที่จมน้ำ')}</li><li>${T('prep.d3', 'ระวังสัตว์มีพิษที่หนีน้ำเข้ามาในบ้าน')}</li><li>${T('prep.d4', 'ประหยัดแบตเตอรี่โทรศัพท์ไว้ใช้ติดต่อฉุกเฉิน')}</li></ul>`)}
    ${acc('', T('prep.after', 'หลังน้ำลด'), `<ul class="bul"><li>${T('prep.a1', 'อย่าเปิดไฟจนกว่าช่างจะตรวจระบบไฟฟ้า')}</li><li>${T('prep.a2', 'ทิ้งอาหารที่สัมผัสน้ำท่วม')}</li><li>${T('prep.a3', 'สวมรองเท้าบูทและถุงมือขณะทำความสะอาด')}</li><li>${T('prep.a4', 'ถ่ายรูปความเสียหายไว้ใช้ขอรับการช่วยเหลือ')}</li></ul>`)}</section>`,
   sources: `<section aria-labelledby="srT"><h2 class="h-m" id="srT">${T('now.src', 'แหล่งข้อมูลจากหน่วยงานอื่น')}</h2><ul class="extl">${(cf.links || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}<span class="sr"> ${T('ui.newwin', '(เปิดในหน้าต่างใหม่)')}</span></a>${l.note ? `<span class="hint">${esc(l.note)}</span>` : ''}</li>`).join('')}</ul></section>`,
   staffentry: `<p class="staffl">${ico('lock')}<a href="#/staff">${T('now.staff', 'เจ้าหน้าที่: เข้าสู่ระบบจัดการคำขอ')}</a></p>`,
  };
  const order = (cf.settings?.sections || Object.keys(S).map((id) => ({ id, on: true }))).filter((s) => s.on && S[s.id]);
  app.innerHTML = `<div class="pg-h home-h"><h1 class="h-xl">${T('now.h1', 'น้ำท่วมในเมืองพัทยา')}</h1><p class="lead">${T('now.lead', 'ระดับเตือนภัยล่าสุด สิ่งที่ควรทำ และวิธีขอความช่วยเหลือ ข้อมูลอัปเดตทันทีเมื่อมีรายงานใหม่')}</p></div>
   <div class="g"><div class="g-main">${order.map((s) => `<div class="sec s-${s.id}" data-sec="${s.id}">${S[s.id]}</div>`).join('')}</div>
   <aside class="g-side" aria-label="${T('now.side', 'ข้อมูลติดต่อ')}"><div class="side-box hot"><h2 class="h-m">${T('now.hot', 'อันตรายถึงชีวิต โทรทันที')}</h2><ul class="hotl">${HOT().map(([n, l]) => `<li><a href="tel:${n}"><b>${n}</b><span>${l}</span></a></li>`).join('')}</ul><p>${linkGo('#/call', T('now.hot.all', 'เบอร์โทรทั้งหมด'))}</p></div>
    <div class="side-box"><h2 class="h-s">${T('now.more', 'บริการอื่นในเว็บนี้')}</h2><ul class="sidel">${[['#/area', T('idx.area', 'สถานการณ์แต่ละชุมชน')], ['#/lost-found', T('idx.lf', 'ของหายและของที่เก็บได้')], ['#/cctv', T('idx.cctv', 'กล้องถนน')], ['#/levels', T('idx.levels', 'ความหมายของระดับเตือนภัย')]].map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}</ul></div></aside></div>`;
  const a = await alertData(true); alertBar();
  const [rq, roads] = await Promise.all([api('/api/requests/public').catch(() => []), api('/api/roads').catch(() => [])]);
  const { rs, live, fc, maxR } = a, openReq = rq.filter((r) => !['resolved', 'closed'].includes(r.status)).length;
  if ($('#todo')) $('#todo').innerHTML = `<div class="todo-box" style="--al:${AL[a.n].c}"><p class="todo-k">${alTag(a.n)}</p><ol class="num">${TODO()[a.n].map((x) => `<li>${x}</li>`).join('')}</ol>${a.n >= 4 ? `<p><a class="btn warnb" href="#/help?kind=evacuate">${T('now.todo.help', 'ขอความช่วยเหลือตอนนี้')}</a></p>` : ''}</div>`;
  if ($('#sum')) $('#sum').innerHTML = SL([
    [T('now.s.rep', 'รายงานจากประชาชน'), `<b>${rs.length}</b> ${T('now.s.items', 'รายการ')}`, `<a href="#/updates">${T('now.s.view', 'ดูรายการ')}</a>`],
    [T('now.s.max', 'น้ำสูงสุดที่มีผู้แจ้ง'), maxR ? `${depthTag(maxR.level, maxR.levelText)}<br>${esc(maxR.areaName || '')}` : T('now.s.nomax', 'ยังไม่มี'), `<a href="#/map">${T('now.s.onmap', 'ดูบนแผนที่')}</a>`],
    [T('now.s.req', 'คำขอที่ทีมกำลังดำเนินการ'), `<b>${openReq}</b> ${T('now.s.cases', 'เรื่อง')}`, `<a href="#/status">${T('now.s.track', 'ติดตามคำขอ')}</a>`],
    [T('now.s.roads', 'ถนนปิดและทางเลี่ยง'), `<b>${roads.length}</b> ${T('now.s.lines', 'เส้นทาง')}`, `<a href="#/map">${T('now.s.onmap', 'ดูบนแผนที่')}</a>`],
    [T('now.s.rain', 'ฝนคาดการณ์ 24 ชั่วโมง'), fc.ok ? `<b>${fc.totalMm}</b> ${T('sky.mm', 'มม.')} · ${esc(fc.label)}` : '–', `<a href="#/weather">${T('now.s.fc', 'รายชั่วโมง')}</a>`]]);
  if ($('#latest')) $('#latest').innerHTML = rs.length ? `<div class="tblw"><table class="tbl"><caption class="sr">${T('now.latest', 'รายงานล่าสุดจากประชาชน')}</caption><thead><tr><th scope="col">${T('now.c.time', 'เวลา')}</th><th scope="col">${T('now.c.where', 'บริเวณ')}</th><th scope="col">${T('now.c.depth', 'ระดับน้ำ')}</th><th scope="col">${T('now.c.check', 'การยืนยัน')}</th></tr></thead><tbody>${rs.slice(0, 6).map((r) => `<tr><td>${tOnly(r.createdAt)}<br><small class="muted">${ago(r.createdAt)}</small></td><td>${soiOf(r) ? `<b>${esc(soiOf(r))}</b><br><small class="muted">${esc([pN(r, 'soi') && pN(r, 'road'), r.areaName].filter(Boolean).join(' · '))}</small>` : esc(r.areaName) || `<span class="muted">${T('now.c.noarea', 'ไม่ระบุชุมชน')}</span>`}</td><td>${depthTag(r.level, r.levelText)}</td><td>${modBadge(r) || `<span class="muted">${T('now.c.public', 'เผยแพร่แล้ว')}</span>`}</td></tr>`).join('')}</tbody></table></div>` : inset(T('now.latest.none', 'ยังไม่มีรายงานใน 24 ชั่วโมงที่ผ่านมา'));
  if ($('#hmap')) { const m = tiles(L.map('hmap', { scrollWheelZoom: false, zoomControl: false }).setView([12.928, 100.886], 12)); L.control.zoom({ position: 'topright' }).addTo(m);
    live.forEach((r) => L.circleMarker([r.lat, r.lng], { radius: 8, color: '#111a24', weight: 1.5, fillColor: LVCOL[r.level], fillOpacity: r.mod === 'pending' ? 0.5 : 0.95 }).addTo(m).bindPopup(`<b>${esc(r.levelText)}</b> ${modBadge(r)}<br>${placeLine(r)}${esc(r.areaName || '')} · ${ago(r.createdAt)}`));
    roads.forEach((w) => L.polyline(w.points, { color: w.type === 'closed' ? '#111a24' : '#1a56b8', weight: 5, dashArray: w.type === 'closed' ? '2 8' : null }).addTo(m));
    setTimeout(() => m.invalidateSize(), 150); }
  if ($('#fc')) { loadForecast($('#fc'), false, fc); loadWater($('#wl')); loadRain($('#rn')); }
  const nearCheck = async (lat, lng) => { const all = await api('/api/reports?hours=24'); const n = all.filter((r) => km(lat, lng, r.lat, r.lng) < 1.5); const bad = n.filter((r) => r.cm >= 30);
    $('#nearOut').innerHTML = `<div class="nres ${bad.length ? 'bad' : 'fine'}"><h3 class="h-s">${bad.length ? T('now.near.h.bad', 'มีจุดน้ำท่วมใกล้คุณ') : T('now.near.h.ok', 'ไม่พบน้ำท่วมที่น่ากังวลใกล้คุณ')}</h3><p>${n.length ? `${T('now.near.n', 'รายงานในรัศมี 1.5 กม.:')} <b>${n.length}</b>${bad.length ? ` · ${T('now.near.bad', 'สูงกว่าข้อเท้า:')} <b>${bad.length}</b>` : ` · ${T('now.near.shallow', 'ทั้งหมดเป็นน้ำตื้น')}`}` : T('now.near.zero', 'ไม่มีรายงานในรัศมี 1.5 กม. ใน 24 ชั่วโมงที่ผ่านมา')}</p><p><a href="#/map">${T('now.near.map', 'เปิดแผนที่บริเวณนี้')}</a></p></div>`; };
  if ($('#near')) { $('#near').onclick = async () => { try { const [x, y] = await gps(); nearCheck(x, y); } catch (e) { $('#nearOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
    $('#nearArea').onchange = (e) => { const ar = c.areas.find((x) => x.id === e.target.value); ar && nearCheck(ar.lat, ar.lng); }; }
  on((t) => { if (t === 'report' || t === 'deleted' || t === 'roads') { clearTimeout(home._t); home._t = setTimeout(() => curPage() === '' && render(), 4000); } });
}
// ---------- rain forecast / water / rain stations ----------
async function loadForecast(el, full, pre) {
  const f = pre?.ok ? pre : await api('/api/forecast'); if (!f.ok) return (el.innerHTML = `<p class="err">${T('sky.fail', 'ยังโหลดพยากรณ์ฝนไม่ได้ ระบบจะลองใหม่เอง')} (${esc(f.error || '')})</p>`);
  const H = f.hourly; const maxMm = Math.max(0, ...H.map((h) => h.mm));
  el.innerHTML = `${SL([[T('sky.total', 'ปริมาณรวม'), `<b>${f.totalMm}</b> ${T('sky.mm', 'มม.')} · ${esc(f.label)}`], [T('sky.prob', 'โอกาสเกิดฝนสูงสุด'), f.maxProb == null ? '–' : `<b>${f.maxProb}%</b>`], [T('sky.first', 'ฝนเริ่มตก (คาดการณ์)'), f.startTime ? `${tOnly(f.startTime)} ${T('ui.tsuf', 'น.')}` : T('sky.dry', 'ไม่คาดว่าจะมีฝนที่วัดได้')], [T('sky.peak', 'ชั่วโมงที่ฝนหนักที่สุด'), `${maxMm.toFixed(1)} ${T('sky.mmh', 'มม./ชม.')}`]])}
   ${rainStrip(H)}<p class="hint">${T('sky.cellnote', 'แต่ละช่องคือ 1 ชั่วโมง ตัวเลขในช่องคือปริมาณฝนเป็นมิลลิเมตร')} · ${f.stale ? T('sky.stale', 'กำลังแสดงข้อมูลชุดก่อนหน้า') : esc(f.source) + ' ' + fmt(f.fetchedAt)}</p>
   ${full ? `<div class="tblw"><table class="tbl"><caption>${T('sky.tbl', 'พยากรณ์รายชั่วโมง')}</caption><thead><tr><th scope="col">${T('sky.c.t', 'เวลา')}</th><th scope="col" class="num">${T('sky.c.mm', 'ฝน (มม.)')}</th><th scope="col" class="num">${T('sky.c.p', 'โอกาสฝน')}</th><th scope="col" class="num">${T('sky.c.w', 'ลม (กม./ชม.)')}</th></tr></thead><tbody>${H.map((h) => `<tr><td>${h.t.slice(11)}</td><td class="num">${h.mm}</td><td class="num">${h.prob}%</td><td class="num">${h.wind}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}
async function loadWater(el) {
  const w = await api('/api/water'); if (!w.ok) return (el.innerHTML = `<p class="err">${T('sky.wfail', 'เชื่อมต่อคลังข้อมูลน้ำแห่งชาติไม่ได้ จึงไม่แสดงค่าประมาณ')} (${esc(w.error)})</p>`);
  if (!w.stations.length) { const c = w.citizen || {};
    el.innerHTML = `${inset(`${T('sky.nost', 'เมืองพัทยายังไม่มีสถานีโทรมาตรวัดระดับน้ำในเขตเมือง ข้อมูลส่วนนี้จึงมาจากรายงานของประชาชน')}${w.nearest ? ` ${T('sky.near', 'สถานีที่ใกล้ที่สุด:')} ${esc(w.nearest.name)} (${esc(w.nearest.province)}, ${w.nearest.distanceKm} ${T('sky.km', 'กม.')}) ${T('sky.far', 'อยู่ไกลเกินกว่าจะสะท้อนสภาพในเมือง')}` : ''}`)}
     ${c.count ? SL([[T('sky.cit.n', 'รายงานใน 24 ชั่วโมง'), `<b>${c.count}</b>`], [T('sky.cit.v', 'ยืนยันแล้ว'), `<b>${c.verified}</b>`], [T('sky.cit.max', 'ระดับสูงสุด'), `${depthTag(c.max.level, c.max.text)} ${esc(c.max.areaName || '')}`], [T('sky.cit.mix', 'แยกตามระดับ'), c.byLevel.map((x) => `${depthTag(x.level, x.text)} × ${x.n}`).join(' ')], [T('sky.cit.last', 'รายงานล่าสุด'), fmt(c.latest)]]) : `<p>${T('sky.cit.none', 'ยังไม่มีประชาชนรายงานระดับน้ำใน 24 ชั่วโมงที่ผ่านมา')}</p>`}
     <p class="hint">${T('sky.src', 'ที่มา: คลังข้อมูลน้ำแห่งชาติ (สสน.) และรายงานในเว็บนี้ แสดงตามจริง ไม่มีการประมาณค่า')}</p>`; return; }
  el.innerHTML = `<div class="tblw"><table class="tbl"><thead><tr><th scope="col">${T('sky.c.st', 'สถานี')}</th><th scope="col">${T('sky.c.state', 'สถานะ')}</th><th scope="col">${T('sky.c.bank', 'เทียบตลิ่ง')}</th><th scope="col">${T('sky.c.at', 'เวลาวัด')}</th></tr></thead><tbody>${w.stations.map((s) => `<tr><td><b>${esc(s.name)}</b><br><small class="muted">${esc(s.amphoe)} · ${esc(s.province)} · ${s.distanceKm} ${T('sky.km', 'กม.')}</small></td><td><strong class="tag s${s.sev}">${esc(s.status)}</strong><br><small>${esc(s.trend)}</small></td><td>${s.diff == null ? T('sky.nobank', 'ไม่มีค่าระดับตลิ่ง') : s.diff > 0 ? `${T('sky.over', 'สูงกว่าตลิ่ง')} <b>${s.diff.toFixed(2)}</b> ${T('sky.m', 'ม.')}` : `${T('sky.below', 'ต่ำกว่าตลิ่ง')} <b>${Math.abs(s.diff).toFixed(2)}</b> ${T('sky.m', 'ม.')}`}</td><td>${fmt(s.measuredAt)}<br><small class="muted">${esc(s.agency || '')}</small></td></tr>`).join('')}</tbody></table></div><p class="hint">${esc(w.note)}${w.stale ? ' · ' + T('sky.stale', 'กำลังแสดงข้อมูลชุดก่อนหน้า') : ''}</p>`;
}
const rainList = (st) => st.length ? `<div class="tblw"><table class="tbl"><thead><tr><th scope="col">${T('sky.c.st', 'สถานี')}</th><th scope="col" class="num">${T('sky.c.r24', 'ฝน 24 ชม. (มม.)')}</th><th scope="col">${T('sky.c.at', 'เวลาวัด')}</th></tr></thead><tbody>${st.map((s) => `<tr><td>${esc(s.name)}<br><small class="muted">${esc(s.tambon || '')}</small></td><td class="num"><b>${s.rain24h}</b></td><td>${fmt(s.at)}</td></tr>`).join('')}</tbody></table></div>` : `<p>${T('sky.rain.none', 'ยังไม่มีข้อมูลจากสถานีวัดฝนในเขตเมือง')}</p>`;
async function loadRain(el) { const r = await api('/api/rain'); if (!r.ok) return (el.innerHTML = `<p class="err">${T('sky.rfail', 'โหลดข้อมูลสถานีวัดฝนไม่สำเร็จ')} (${esc(r.error)})</p>`); el.innerHTML = rainList(r.stations); }
// ================= forms =================
function locPicker(el, initial) {
  el.innerHTML = `<div class="loc"><div class="btnrow"><button type="button" class="btn sec" data-a="gps">${ico('target')}${T('loc.gps', 'ใช้ตำแหน่งปัจจุบันของฉัน')}</button></div><div class="fg"><label class="lbl" for="locq">${T('loc.q', 'หรือค้นหาชื่อสถานที่')}</label><p class="hint">${T('loc.q.h', 'เช่น ชื่อซอย ห้าง วัด หรือโรงเรียน')}</p><div class="srch"><input class="q inp" id="locq" type="search"><button type="button" class="btn sec" data-a="s">${T('loc.find', 'ค้นหา')}</button></div></div><div class="res" aria-live="polite"></div><div class="mapsmall" role="region" aria-label="${T('loc.map', 'แผนที่สำหรับเลือกตำแหน่ง')}"></div><p class="hint">${T('loc.tip', 'แตะแผนที่หรือลากหมุดไปยังจุดที่ถูกต้อง')}</p><p class="locv" aria-live="polite"></p>
   <div class="fg soibox"><label class="lbl" for="soi">${T('loc.soi', 'ซอย / ถนน')}</label><p class="hint" id="soiH">${T('loc.soi.h0', 'วางหมุดแล้วระบบจะหาชื่อซอยให้ หรือพิมพ์ชื่อซอยเพื่อค้นหา เช่น พัทยาใต้ 13, บัวขาว, ทัพพระยา, Jomtien 2')}</p>
    <div class="combo"><input id="soi" class="inp" type="text" autocomplete="off" maxlength="100" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="soiL" aria-describedby="soiH"><ul id="soiL" class="soil" role="listbox" aria-label="${T('loc.soi.list', 'ซอยและถนนในเขตเมืองพัทยา')}" hidden></ul></div>
    <p class="plx hint" aria-live="polite"></p></div></div>`;
  const m = tiles(L.map($('.mapsmall', el)).setView(initial || CENTER, 14)); const mk = L.marker(initial || CENTER, { draggable: true }).addTo(m); const st = { lat: null, lng: null, m, auto: null, soi: () => $('#soi', el).value.trim() };
  const inp = $('#soi', el), lst = $('#soiL', el); let keepSoi = false, seq = 0;
  const detect = async (ll) => { const my = ++seq; try { const p = await api(`/api/geo/reverse?lat=${ll[0].toFixed(6)}&lng=${ll[1].toFixed(6)}`); if (my !== seq) return; st.auto = p;
    if (!keepSoi) inp.value = soiOf(p); keepSoi = false;
    $('#soiH', el).textContent = soiOf(p) ? TX('loc.soi.h1', 'ระบบหาจากตำแหน่งหมุดให้แล้ว ถ้าไม่ตรงแก้ไขหรือเลือกจากรายการได้') : TX('loc.soi.h2', 'ไม่พบชื่อซอยใกล้หมุด พิมพ์ชื่อซอยหรือจุดสังเกตเองได้');
    $('.plx', el).innerHTML = [p.road && pN(p, 'soi') ? `${T('loc.road', 'ถนน')}: ${esc(pN(p, 'road'))}` : '', pN(p, 'landmark') ? `${T('loc.near', 'ใกล้')}: ${esc(pN(p, 'landmark'))}${p.landmarkM != null ? ` (~${p.landmarkM} ${T('loc.m', 'ม.')})` : ''}` : ''].filter(Boolean).join(' · '); } catch {} };
  const set = (ll) => { mk.setLatLng(ll); m.setView(ll, Math.max(m.getZoom(), 17)); st.lat = ll[0]; st.lng = ll[1]; $('.locv', el).innerHTML = `${ico('ok')} ${T('loc.set', 'เลือกตำแหน่งแล้ว')} (${ll[0].toFixed(5)}, ${ll[1].toFixed(5)})`; detect(ll); el.dispatchEvent(new CustomEvent('pinned')); };
  // searchable soi picker (OSM names inside the city boundary)
  let opts = [], act = -1, qT;
  const close = () => { lst.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); act = -1; };
  const hi = (i) => { act = i; [...lst.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i))); if (i >= 0) { inp.setAttribute('aria-activedescendant', 'soiO' + i); lst.children[i].scrollIntoView({ block: 'nearest' }); } };
  const choose = (i) => { const o = opts[i]; if (!o) return; inp.value = (LANG !== 'th' && o.en) || o.th; close(); if (st.lat == null) { keepSoi = true; set([o.lat, o.lng]); } };
  const show = async () => { const q = inp.value.trim(); try { opts = await api('/api/geo/sois?n=12&q=' + encodeURIComponent(q)); } catch { opts = []; }
    lst.innerHTML = opts.map((o, i) => `<li id="soiO${i}" role="option" aria-selected="false" data-i="${i}"><b>${esc(o.th)}</b>${o.en && o.en !== o.th ? `<small lang="en">${esc(o.en)}</small>` : ''}</li>`).join('') || `<li class="none" role="option" aria-disabled="true">${T('loc.soi.none', 'ไม่พบในรายการ ใช้ข้อความที่พิมพ์ได้เลย')}</li>`;
    lst.hidden = false; inp.setAttribute('aria-expanded', 'true'); act = -1; };
  inp.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(show, 180); });
  inp.addEventListener('focus', () => { if (!inp.value) show(); });
  inp.addEventListener('keydown', (e) => { if (lst.hidden && e.key === 'ArrowDown') { show(); return; } if (lst.hidden) return; const n = opts.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); hi(n ? (act + 1) % n : -1); } else if (e.key === 'ArrowUp') { e.preventDefault(); hi(n ? (act - 1 + n) % n : -1); } else if (e.key === 'Enter') { if (act >= 0) { e.preventDefault(); choose(act); } else close(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
  lst.addEventListener('mousedown', (e) => e.preventDefault()); lst.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); li && choose(+li.dataset.i); });
  inp.addEventListener('blur', () => setTimeout(close, 120));
  mk.on('dragend', () => { const p = mk.getLatLng(); set([p.lat, p.lng]); }); m.on('click', (e) => set([e.latlng.lat, e.latlng.lng]));
  const search = async () => { const rs = await geocode($('.q', el).value); $('.res', el).innerHTML = rs.length ? `<ul class="picks">${rs.map((r, i) => `<li><button type="button" class="btn link" data-i="${i}">${esc(r.display_name.slice(0, 80))}</button></li>`).join('')}</ul>` : `<p>${T('loc.none', 'ไม่พบสถานที่นี้ในเขตเมืองพัทยา')}</p>`; $('.res', el).onclick = (ev) => { const r = rs[ev.target.closest('[data-i]')?.dataset.i]; r && set([+r.lat, +r.lon]); $('.res', el).innerHTML = ''; }; };
  el.addEventListener('click', async (e) => { const a = e.target.closest('[data-a]')?.dataset.a; try { if (a === 'gps') set(await gps()); if (a === 's') await search(); } catch (er) { $('.res', el).innerHTML = `<p class="err">${esc(er.message)}</p>`; } });
  $('.q', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search().catch((er) => ($('.res', el).textContent = er.message)); } });
  st.set = set; setTimeout(() => m.invalidateSize(), 100); return st;
}
// soi · road · near landmark, in the reader's language when OSM has an English name
const pN = (r, k) => (LANG !== 'th' && r[k + 'En']) || r[k] || '';
const soiOf = (r) => pN(r, 'soi') || pN(r, 'road');
function placeLine(r, lm = true) {
  const a = [pN(r, 'soi'), pN(r, 'road')].filter(Boolean); if (r.along) a.push(r.along);
  const l = lm && pN(r, 'landmark') ? `${T('loc.near', 'ใกล้')} ${esc(pN(r, 'landmark'))}${r.landmarkM != null ? ` (~${r.landmarkM} ${T('loc.m', 'ม.')})` : ''}` : '';
  return a.length || l ? `<span class="plc">${ico('pin')}<span>${esc(a.join(', '))}${a.length && l ? ' · ' : ''}${l}</span></span>` : '';
}
const depthOpts = (lv) => Object.entries(lv).map(([k, v]) => [k, `<span class="dp" aria-hidden="true" style="--h:${LVH[k] || 20}%;--c:${LVCOL[k] || '#4a5361'}"><i></i></span>${esc(v)}`, '', '']);
const areaOpts = (c, ph) => `<option value="">${ph}</option>${c.contacts.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}`;
const lvText = (c, k) => (k ? esc(c.levels[k] || k) : '');

async function report() {
  const c = await cfg();
  app.innerHTML = head('gauge', 'wl.title', 'แจ้งระดับน้ำ', 'wl.lead', 'บอกเราว่าน้ำสูงแค่ไหนและอยู่ตรงไหน ข้อมูลจะแสดงบนแผนที่สาธารณะเพื่อช่วยให้คนอื่นเลี่ยงเส้นทาง ไม่ต้องใส่ชื่อหรือเบอร์โทร') + `<div class="g"><div class="g-main" id="wz"></div><aside class="g-side"><div class="side-box"><h2 class="h-s">${T('wl.side', 'เกิดอะไรขึ้นกับข้อมูลของคุณ')}</h2><p>${T('wl.side.p', 'จุดที่คุณแจ้งจะแสดงบนแผนที่ 24 ชั่วโมง และระบบหาเส้นทางจะหลบจุดนั้นโดยอัตโนมัติ เราไม่เก็บชื่อหรือเบอร์โทรของคุณ')}</p></div></aside></div>`;
  let loc;
  const wz = wizard($('#wz'), [
    { t: T('wl.q1', 'น้ำสูงประมาณเท่าไร'), body: `<p class="hint">${T('wl.q1.h', 'เทียบกับผู้ใหญ่ที่ยืนอยู่ในน้ำ')}</p>${radios('lv', depthOpts(c.levels), '', 'id="lv" role="radiogroup"')}`, ok: () => (pickVal('lv') ? null : [['lv-' + Object.keys(c.levels)[0], TX('wl.e1', 'เลือกระดับน้ำ')]]), sum: () => [[T('wl.s1', 'ระดับน้ำ'), lvText(c, pickVal('lv'))]] },
    { t: T('wl.q2', 'น้ำท่วมอยู่ที่ไหน'), body: field('ar', T('wl.zone', 'ชุมชนหรือย่าน (ถ้าทราบ)'), `<select id="ar" class="sel">${areaOpts(c, T('wl.zone.ph', 'ไม่ระบุ'))}</select>`) + '<div id="loc"></div>', ok: () => (loc.lat ? null : [['locq', TX('wl.e2', 'เลือกตำแหน่งบนแผนที่ ใช้ตำแหน่งปัจจุบัน หรือค้นหาสถานที่')]]), sum: () => [[T('loc.soi', 'ซอย / ถนน'), esc(loc.soi())], [T('wl.s2', 'ตำแหน่ง'), loc.lat ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : ''], [T('wl.s2b', 'ชุมชน'), esc($('#ar').selectedOptions[0]?.value ? $('#ar').selectedOptions[0].text : '')]] },
    { t: T('wl.q3', 'มีรายละเอียดอื่นหรือไม่'), body: `<p class="hint">${T('wl.q3.h', 'ไม่บังคับ ข้ามขั้นนี้ได้')}</p>${field('nt', T('wl.note', 'ข้อสังเกต'), '<input id="nt" class="inp" maxlength="300">', T('wl.note.h', 'เช่น น้ำไหลแรง มีรถดับกลางทาง ฝั่งขาออกยังผ่านได้'))}${field('ph', T('wl.photo', 'รูปถ่าย'), '<input type="file" id="ph" class="file" accept="image/*" capture="environment">')}`, sum: () => [[T('wl.s3', 'ข้อสังเกต'), esc($('#nt').value)], [T('wl.s3b', 'รูปถ่าย'), $('#ph').files?.[0] ? esc($('#ph').files[0].name) : '']] },
  ], `<h3 class="h-m">${T('wl.final', 'ส่งรายงาน')}</h3><p>${T('wl.final.p', 'เมื่อกดส่ง รายงานจะแสดงบนแผนที่สาธารณะโดยไม่มีข้อมูลส่วนตัว')}</p><div id="msg" aria-live="polite"></div><button type="button" class="btn" id="go">${T('wl.send', 'ยืนยันและส่งรายงาน')}</button>`,
  (k) => k === 1 && loc && setTimeout(() => loc.m.invalidateSize(), 50));
  loc = locPicker($('#loc'));
  $('#ar').onchange = (e) => { const a = c.contacts.areas.find((x) => x.id === e.target.value); a && loc.set([a.lat, a.lng]); };
  $('#go').onclick = async () => { try { if (!loc.lat) throw new Error(TX('wl.e2', 'เลือกตำแหน่งบนแผนที่ ใช้ตำแหน่งปัจจุบัน หรือค้นหาสถานที่')); const r = await api('/api/reports', { method: 'POST', body: { level: pickVal('lv'), areaId: $('#ar').value, lat: loc.lat, lng: loc.lng, soi: loc.soi(), note: $('#nt').value, photo: await photoData($('#ph')) } });
    ALC = null; app.innerHTML = confirmPanel(T('wl.ok', 'ได้รับรายงานของคุณแล้ว'), r.id, `<h2 class="h-m">${T('wl.next', 'ขั้นตอนต่อไป')}</h2>${r.merged ? `<p>${T('wl.merged', 'มีผู้แจ้งจุดนี้ไว้ก่อนแล้ว รายงานของคุณถูกนับเป็นการยืนยันเพิ่ม')} (${r.confirms} ${T('wl.people', 'คนยืนยัน')})</p>` : modMsg(r)}<ul class="tasks"><li>${linkGo('#/map', T('wl.tomap', 'ดูจุดนี้บนแผนที่'))}</li><li>${linkGo('#/report', T('wl.again', 'แจ้งอีกจุดหนึ่ง'))}</li><li>${linkGo('#/', T('ui.home', 'หน้าแรก'))}</li></ul>`); alertBar(); } catch (e) { showErr($('#msg'), [['go', e.message]]); } };
}
async function helpForm(kind) {
  const c = await cfg(); const served = c.contacts.areas.filter((a) => a.served);
  const K = { evacuate: [T('ask.k.evac', 'ต้องการออกจากพื้นที่น้ำท่วม'), T('ask.k.evac.h', 'ติดอยู่ในบ้านหรืออาคาร ต้องการเรือหรือรถยกสูง')], medical: [T('ask.k.med', 'มีผู้ป่วย หรือต้องการยา'), T('ask.k.med.h', 'ผู้ป่วยติดเตียง ยาประจำตัวหมด ต้องใช้ออกซิเจน')], food: [T('ask.k.food', 'ต้องการอาหาร น้ำดื่ม หรือของใช้'), T('ask.k.food.h', 'ส่งถึงผู้ประสานงานในชุมชน')] };
  const NEEDS = [T('ask.n.meal', 'อาหารพร้อมทาน หรือข้าวสาร'), T('ask.n.water', 'น้ำดื่ม'), T('ask.n.kit', 'ถุงยังชีพ'), T('ask.n.med', 'ยาและเวชภัณฑ์'), T('ask.n.baby', 'นมผงหรือผ้าอ้อม'), T('ask.n.pet', 'อาหารสัตว์'), T('ask.n.boat', 'เรือหรือรถยกสูง'), T('ask.n.bed', 'ผู้ป่วยติดเตียงหรือผู้สูงอายุ')];
  if (!K[kind]) kind = 'food';
  const unq = (x) => new DOMParser().parseFromString(x, 'text/html').body.textContent;
  app.innerHTML = head('hand', 'ask.title', 'ขอความช่วยเหลือ', 'ask.lead', 'คำขอของคุณจะส่งถึงเจ้าหน้าที่และทีมในพื้นที่ทันที เมื่อส่งแล้วคุณจะได้หมายเลขอ้างอิงไว้ติดตามเรื่อง') +
   warnText(`${T('ask.life', 'ถ้ามีอันตรายถึงชีวิต ให้โทรก่อน ไม่ต้องกรอกแบบฟอร์ม:')} ${HOT().map(([n, l]) => `<a href="tel:${n}">${n}</a> (${l})`).join(', ')}`) +
   `<div class="g"><div class="g-main" id="wz"></div><aside class="g-side"><div class="side-box"><h2 class="h-s">${T('ask.side', 'พื้นที่ที่รับคำขอผ่านเว็บ')}</h2><ul class="bul">${served.map((a) => `<li>${esc(a.name)}</li>`).join('')}</ul><p class="hint">${T('ask.side.p', 'พื้นที่อื่นโปรดโทร 1337 หรือ 1784')}</p></div><div class="side-box"><h2 class="h-s">${T('ask.priv.h', 'ข้อมูลส่วนตัวของคุณ')}</h2><p>${T('ask.priv', 'ชื่อและเบอร์โทรจะเห็นได้เฉพาะเจ้าหน้าที่ และใช้สำหรับคำขอนี้เท่านั้น')}</p></div></aside></div>`;
  let loc;
  wizard($('#wz'), [
    { t: T('ask.q1', 'คุณต้องการความช่วยเหลือเรื่องใด'), body: radios('kind', Object.entries(K).map(([k, [l, h]]) => [k, l, h]), kind), ok: () => null, sum: () => [[T('ask.s1', 'เรื่อง'), K[pickVal('kind') || kind][0]]] },
    { t: T('ask.q2', 'ให้ทีมไปที่ไหน'), body: field('ar', T('ask.zone', 'ชุมชน'), `<select id="ar" class="sel"><option value="">${T('ask.zone.ph', 'เลือกชุมชน')}</option>${c.contacts.areas.map((a) => `<option value="${a.id}" ${a.served ? '' : 'disabled'}>${esc(a.name)}${a.served ? '' : ' ' + T('ask.zone.no', '(ยังไม่เปิดรับทางเว็บ)')}</option>`).join('')}</select>`) + '<div id="loc"></div>' + field('ad', T('ask.addr2', 'บ้านเลขที่ อาคาร หรือจุดสังเกต'), '<input id="ad" class="inp" autocomplete="street-address">', T('ask.addr.h', 'วางลิงก์ Google Maps ได้')),
      ok: () => ($('#ar').value ? null : [['ar', TX('ask.e2', 'เลือกชุมชนที่ต้องการให้ทีมไป')]]), sum: () => [[T('ask.s2', 'ชุมชน'), $('#ar').value ? esc($('#ar').selectedOptions[0].text) : ''], [T('loc.soi', 'ซอย / ถนน'), esc(loc.soi())], [T('ask.s2b', 'ตำแหน่งบนแผนที่'), loc.lat ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : ''], [T('ask.s2c', 'ที่อยู่'), esc($('#ad').value)]] },
    { t: T('ask.q3', 'ต้องการอะไรบ้าง'), body: `<fieldset class="fs"><legend class="lbl">${T('ask.needs', 'เลือกได้มากกว่าหนึ่งข้อ')}</legend><div id="nd">${checks('nd', NEEDS.map(unq))}</div></fieldset>${field('pp', T('ask.ppl', 'จำนวนคนที่ต้องการความช่วยเหลือ'), '<input id="pp" class="inp w5" type="number" min="1" value="1" inputmode="numeric">')}<fieldset class="fs"><legend class="lbl">${T('ask.depth', 'ระดับน้ำตอนนี้ (ถ้าทราบ)')}</legend>${radios('lv', depthOpts(c.levels), '', 'id="lv"')}</fieldset>`, ok: () => null,
      sum: () => [[T('ask.s3', 'สิ่งที่ต้องการ'), [...document.querySelectorAll('input[name=nd]:checked')].map((x) => esc(x.value)).join(', ')], [T('ask.s3b', 'จำนวนคน'), esc($('#pp').value)], [T('ask.s3c', 'ระดับน้ำ'), lvText(c, pickVal('lv'))]] },
    { t: T('ask.q4', 'ทีมจะติดต่อคุณได้อย่างไร'), body: field('nm', T('ask.name', 'ชื่อ'), '<input id="nm" class="inp" autocomplete="name">') + field('tl', T('ask.tel', 'เบอร์โทรศัพท์'), '<input id="tl" class="inp w10" type="tel" autocomplete="tel" inputmode="tel">', T('ask.tel.h', 'ใช้เบอร์ที่โทรติดได้ตอนนี้ และจำ 4 ตัวท้ายไว้สำหรับติดตามเรื่อง')) + field('nt', T('ask.more', 'สิ่งที่ทีมควรรู้ (ไม่บังคับ)'), '<textarea id="nt" class="inp" rows="3"></textarea>', T('ask.more.h', 'เช่น มีเด็กเล็ก ผู้พิการ หรือสัตว์เลี้ยง')) + field('ph', T('ask.photo', 'รูปถ่าย (ไม่บังคับ)'), '<input type="file" id="ph" class="file" accept="image/*">'),
      ok: () => { const e = []; if (!$('#nm').value.trim()) e.push(['nm', TX('ask.e4a', 'ใส่ชื่อของคุณ')]); if ($('#tl').value.replace(/\D/g, '').length < 9) e.push(['tl', TX('ask.e4b', 'ใส่เบอร์โทรศัพท์ที่ติดต่อได้')]); return e; }, sum: () => [[T('ask.s4', 'ชื่อ'), esc($('#nm').value)], [T('ask.s4b', 'เบอร์โทร'), esc($('#tl').value)], [T('ask.s4c', 'ข้อมูลเพิ่มเติม'), esc($('#nt').value)]] },
  ], `<h3 class="h-m">${T('ask.final', 'ส่งคำขอ')}</h3><p>${T('ask.final.p', 'เมื่อกดส่ง คำขอจะถึงเจ้าหน้าที่ทันที หากสถานการณ์เปลี่ยน ให้โทร 1337')}</p><div id="msg" aria-live="polite"></div><button type="button" class="btn warnb" id="go">${T('ask.send', 'ยืนยันและส่งคำขอ')}</button>`,
  (k) => k === 1 && loc && setTimeout(() => loc.m.invalidateSize(), 50));
  loc = locPicker($('#loc'));
  $('#ar').onchange = (e) => { const a = c.contacts.areas.find((x) => x.id === e.target.value); a && loc.set([a.lat, a.lng]); };
  $('#go').onclick = async () => { try { const k = pickVal('kind') || kind; const r = await api('/api/requests', { method: 'POST', body: { kind: k, areaId: $('#ar').value, lat: loc.lat, lng: loc.lng, soi: loc.soi(), address: $('#ad').value, needs: [...document.querySelectorAll('input[name=nd]:checked')].map((x) => x.value), people: $('#pp').value, level: pickVal('lv'), name: $('#nm').value, phone: $('#tl').value, note: $('#nt').value, photo: await photoData($('#ph')) } });
    app.innerHTML = confirmPanel(T('ask.ok', 'ส่งคำขอถึงเจ้าหน้าที่แล้ว'), r.id, `<h2 class="h-m">${T('ask.next', 'ขั้นตอนต่อไป')}</h2><p>${T('ask.next.p', 'เจ้าหน้าที่จะตรวจคำขอและโทรหาคุณ จดหมายเลขอ้างอิงไว้ ใช้คู่กับเบอร์โทร 4 ตัวท้ายเพื่อดูความคืบหน้า')}</p><p><a class="btn" href="#/status?id=${esc(r.id)}">${T('ask.track', 'ติดตามคำขอนี้')}</a></p><p>${linkGo('#/', T('ui.home', 'หน้าแรก'))}</p>`); } catch (e) { showErr($('#msg'), [['go', e.message]]); } };
}
async function status(q) {
  app.innerHTML = head('search', 'case.title', 'ติดตามคำขอความช่วยเหลือ', 'case.lead', 'ใช้หมายเลขอ้างอิงที่ได้รับหลังส่งคำขอ และเบอร์โทร 4 ตัวท้ายที่ใช้ตอนส่ง') + `<div class="g"><div class="g-main">
   ${field('id', T('case.id', 'หมายเลขอ้างอิง'), `<input id="id" class="inp w10" value="${esc(q.id || '')}" autocapitalize="characters">`, T('case.id.h', 'ตัวอย่าง: C-1001'))}${field('p4', T('case.p4', 'เบอร์โทร 4 ตัวท้าย'), '<input id="p4" class="inp w5" maxlength="4" inputmode="numeric" autocomplete="off">')}
   <button class="btn" id="go" type="button">${T('case.go', 'ดูความคืบหน้า')}</button><div id="out" aria-live="polite"></div></div></div>`;
  const go = async () => { try { const r = await api(`/api/status?id=${encodeURIComponent($('#id').value)}&phone=${encodeURIComponent($('#p4').value)}`); const STG = [['case.g.rec', 'รับเรื่องแล้ว', ['new', 'triaged']], ['case.g.asg', 'ส่งต่อทีมแล้ว', ['assigned']], ['case.g.way', 'ทีมกำลังเดินทาง', ['enroute']], ['case.g.done', 'เสร็จสิ้น', ['resolved', 'closed']]];
    const cur = STG.findIndex((g) => g[2].includes(r.status)), at = (i) => r.history.find((h) => STG.slice(i).some((g) => g[2].includes(h.code)))?.at;
    const LBL = { 'case.g.rec': T('case.g.rec', 'รับเรื่องแล้ว'), 'case.g.asg': T('case.g.asg', 'ส่งต่อทีมแล้ว'), 'case.g.way': T('case.g.way', 'ทีมกำลังเดินทาง'), 'case.g.done': T('case.g.done', 'เสร็จสิ้น') };
    $('#out').innerHTML = `<ol class="stp" aria-label="${T('case.g', 'ความคืบหน้า')}">${STG.map((g, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}" ${i === cur ? 'aria-current="step"' : ''}><span class="stp-n">${i < cur || (i === cur && i === 3) ? ico('ok') : i + 1}</span><b>${LBL[g[0]]}</b>${i <= cur && at(i) ? `<time class="hint">${fmt(at(i))}</time>` : ''}</li>`).join('')}</ol><p class="live-b">${ico('clock')} ${T('case.live', 'หน้านี้อัปเดตเองทันทีเมื่อเจ้าหน้าที่เปลี่ยนสถานะ')}</p><h2 class="h-l">${esc(r.statusText)}</h2>${SL([[T('case.s.id', 'หมายเลขอ้างอิง'), esc(r.id)], [T('case.s.kind', 'เรื่อง'), esc(r.kind)], [T('case.s.area', 'ชุมชน'), esc(r.areaName)], r.assignee ? [T('case.s.team', 'ทีมที่รับผิดชอบ'), esc(r.assignee)] : null])}<h3 class="h-m">${T('case.hist', 'ประวัติการดำเนินการ')}</h3><ol class="tline">${r.history.map((h) => `<li><p class="tl-t">${esc(h.s)}</p><p>${esc(h.note || '')}</p><time class="hint">${fmt(h.at)}</time></li>`).reverse().join('')}</ol>`; } catch (e) { showErr($('#out'), [['id', e.message]]); } };
  $('#go').onclick = go; on((t, d) => t === 'request' && d.id === $('#id')?.value.trim().toUpperCase() && $('#out .stp') && go());
}
async function missing() {
  app.innerHTML = head('people', 'trace.title', 'แจ้งคนที่ติดต่อไม่ได้', 'trace.lead', 'ถ้าคุณติดต่อญาติหรือคนรู้จักไม่ได้ระหว่างน้ำท่วม เจ้าหน้าที่จะช่วยตรวจรายชื่อในศูนย์พักพิงและแจ้งทีมกู้ภัย') + `<div class="g"><div class="g-main">
   ${inset(T('trace.priv', 'ข้อมูลในแบบฟอร์มนี้ส่งถึงเจ้าหน้าที่เท่านั้น และจะไม่แสดงในเว็บ'))}
   <fieldset class="fs"><legend class="h-m">${T('trace.who', 'ข้อมูลของคนที่ติดต่อไม่ได้')}</legend>${field('pn', T('trace.name', 'ชื่อ นามสกุล หรือชื่อเล่น'), '<input id="pn" class="inp">')}${field('ag', T('trace.age', 'อายุโดยประมาณ'), '<input id="ag" class="inp w5" inputmode="numeric">')}${field('ls', T('trace.last', 'ติดต่อได้ครั้งสุดท้ายที่ไหนและเมื่อไร'), '<textarea id="ls" class="inp" rows="3"></textarea>')}${field('ds', T('trace.desc', 'ลักษณะ เสื้อผ้า หรือโรคประจำตัว'), '<textarea id="ds" class="inp" rows="3"></textarea>')}${field('ph', T('trace.photo', 'รูปถ่าย (ถ้ามี)'), '<input type="file" id="ph" class="file" accept="image/*">')}</fieldset>
   <fieldset class="fs"><legend class="h-m">${T('trace.you', 'ข้อมูลของคุณ')}</legend>${field('rn', T('trace.rname', 'ชื่อของคุณ'), '<input id="rn" class="inp" autocomplete="name">')}${field('rp', T('trace.rtel', 'เบอร์โทรที่ติดต่อกลับได้'), '<input id="rp" class="inp w10" type="tel" autocomplete="tel">')}</fieldset>
   <div id="msg" aria-live="polite"></div><button class="btn" id="go" type="button">${T('trace.send', 'ส่งข้อมูลถึงเจ้าหน้าที่')}</button></div></div>`;
  $('#go').onclick = async () => { try { const r = await api('/api/missing', { method: 'POST', body: { personName: $('#pn').value, age: $('#ag').value, lastSeen: $('#ls').value, description: $('#ds').value, reporterName: $('#rn').value, reporterPhone: $('#rp').value, photo: await photoData($('#ph')) } }); app.innerHTML = confirmPanel(T('trace.ok', 'เจ้าหน้าที่ได้รับข้อมูลแล้ว'), r.id, `<p>${T('trace.next', 'เจ้าหน้าที่จะโทรกลับตามเบอร์ที่คุณให้ไว้เมื่อมีความคืบหน้า')}</p><p>${linkGo('#/', T('ui.home', 'หน้าแรก'))}</p>`); } catch (e) { showErr($('#msg'), [['pn', e.message]]); } };
}
async function lostFound(q) {
  const tab = q?.tab === 'new' ? 'new' : 'list';
  const draw = async () => { const ls = await api('/api/lostfound'); $('#lf').innerHTML = ls.map((x) => `<li class="lfc ${x.mod === 'pending' ? 'faded' : ''}">${x.photo ? `<img class="lfi" src="${x.photo}" alt="">` : ''}<div><p><strong class="tag ${x.type === 'lost' ? 'lost' : 'found'}">${x.type === 'lost' ? T('board.lost', 'ตามหา') : T('board.found', 'เก็บได้')}</strong> ${modBadge(x)} <span class="muted">${esc(x.category)}</span></p><h3 class="h-s">${esc(x.title)}</h3><p>${esc(x.detail)}</p><p class="hint">${esc(x.place)} · ${fmt(x.createdAt)} · ${T('board.contact', 'ติดต่อผ่านเจ้าหน้าที่ เบอร์ลงท้าย')} ${x.phoneMasked}</p></div></li>`).join('') || `<li>${T('board.none', 'ยังไม่มีประกาศ')}</li>`; };
  app.innerHTML = head('box', 'board.title', 'ของหายและของที่เก็บได้', 'board.lead', 'ประกาศตามหาสัตว์เลี้ยง เอกสาร หรือทรัพย์สินที่หายระหว่างน้ำท่วม หรือแจ้งว่าคุณเก็บของของใครได้') + `<div class="tabs"><ul class="tabl" role="tablist">${[['list', T('board.tab.list', 'ประกาศทั้งหมด')], ['new', T('board.tab.new', 'ลงประกาศใหม่')]].map(([k, l]) => `<li><button type="button" role="tab" id="tb-${k}" aria-controls="tp-${k}" aria-selected="${k === tab}">${l}</button></li>`).join('')}</ul>
   <section class="tabp" role="tabpanel" id="tp-list" aria-labelledby="tb-list" ${tab === 'list' ? '' : 'hidden'}><ul class="lfl" id="lf"></ul></section>
   <section class="tabp" role="tabpanel" id="tp-new" aria-labelledby="tb-new" ${tab === 'new' ? '' : 'hidden'}>
    <div class="fg"><span class="lbl" id="tyL">${T('board.type', 'ประเภทประกาศ')}</span>${radios('ty', [['lost', T('board.t.lost', 'ฉันทำของหาย หรือสัตว์เลี้ยงหาย')], ['found', T('board.t.found', 'ฉันเก็บของได้')]], 'lost', 'role="radiogroup" aria-labelledby="tyL"')}</div>
    ${field('ct', T('board.cat', 'หมวดหมู่'), `<select id="ct" class="sel">${[T('board.c.pet', 'สัตว์เลี้ยง'), T('board.c.doc', 'เอกสารหรือบัตร'), T('board.c.val', 'ของมีค่า'), T('board.c.car', 'รถหรือเรือ'), T('board.c.other', 'อื่น ๆ')].map((x) => `<option>${x}</option>`).join('')}</select>`)}
    ${field('ti', T('board.t', 'หัวข้อ'), '<input id="ti" class="inp">', T('board.t.h', 'เช่น แมวสีส้ม ใส่ปลอกคอสีฟ้า'))}${field('dt', T('board.detail', 'รายละเอียด'), '<textarea id="dt" class="inp" rows="3"></textarea>')}${field('pl', T('board.place', 'บริเวณที่หายหรือที่เก็บได้'), '<input id="pl" class="inp">')}${field('tl', T('board.tel', 'เบอร์โทร'), '<input id="tl" class="inp w10" type="tel">', T('board.tel.h', 'เว็บจะแสดงเฉพาะ 4 ตัวท้าย'))}${field('ph', T('board.photo', 'รูปถ่าย'), '<input type="file" id="ph" class="file" accept="image/*">')}
    ${warnText(T('board.scam', 'อย่าโอนเงินก่อนได้เห็นของจริง และนัดรับในที่สาธารณะ'))}<div id="msg" aria-live="polite"></div><button class="btn" id="go" type="button">${T('board.send', 'ลงประกาศ')}</button></section></div>`;
  app.querySelector('.tabl').onclick = (e) => { const b = e.target.closest('[role=tab]'); if (!b) return; app.querySelectorAll('.tabl [role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); app.querySelectorAll('.tabp').forEach((p) => (p.hidden = p.id !== b.getAttribute('aria-controls'))); };
  $('#go').onclick = async () => { try { const r = await api('/api/lostfound', { method: 'POST', body: { type: pickVal('ty'), category: $('#ct').value, title: $('#ti').value, detail: $('#dt').value, place: $('#pl').value, phone: $('#tl').value, photo: await photoData($('#ph')) } }); $('#msg').innerHTML = `<div class="cp sm" role="status"><p class="h-m">${T('board.ok', 'ลงประกาศแล้ว')}</p></div>${modMsg(r)}`; draw(); } catch (e) { showErr($('#msg'), [['ti', e.message]]); } };
  draw(); on((t) => (t === 'lostfound' || t === 'deleted') && draw());
}
// ================= information pages =================
async function area() {
  const c = await cfg(); const rs = await api('/api/reports?hours=24');
  const agg = c.contacts.areas.map((a) => { const n = rs.filter((r) => r.areaId === a.id || km(a.lat, a.lng, r.lat, r.lng) < 1.2); const top = n.reduce((m, r) => (r.cm > (m?.cm ?? -1) ? r : m), null); return { a, n: n.length, top, mx: top?.cm || 0 }; }).sort((x, y) => y.mx - x.mx || y.n - x.n);
  const lvN = (mx) => levelOf(mx, false);
  app.innerHTML = head('home', 'hood.title', 'สถานการณ์แต่ละชุมชน', 'hood.lead', 'ชุมชนที่มีรายงานน้ำสูงที่สุดอยู่บนสุด คำนวณจากรายงานของประชาชนใน 24 ชั่วโมง ภายในรัศมีประมาณ 1.2 กม. จากกลางชุมชน') +
  `<div id="map" class="mapmid" role="region" aria-label="${T('hood.map', 'แผนที่ระดับเตือนภัยรายชุมชน')}"></div>
   <div class="tblw"><table class="tbl"><caption class="sr">${T('hood.title', 'สถานการณ์แต่ละชุมชน')}</caption><thead><tr><th scope="col">${T('hood.c.name', 'ชุมชน')}</th><th scope="col">${T('hood.c.lvl', 'ระดับเตือนภัย')}</th><th scope="col">${T('hood.c.top', 'น้ำสูงสุดที่แจ้ง')}</th><th scope="col" class="num">${T('hood.c.n', 'รายงาน')}</th><th scope="col"><span class="sr">${T('hood.c.map', 'แผนที่')}</span></th></tr></thead>
   <tbody>${agg.map((x) => `<tr><th scope="row">${esc(x.a.name)}</th><td>${alTag(lvN(x.mx))}</td><td>${x.top ? depthTag(x.top.level, x.top.levelText) : `<span class="muted">${T('hood.quiet', 'ไม่มีรายงาน')}</span>`}</td><td class="num">${x.n}</td><td>${x.a.lat ? `<button type="button" class="btn link" data-ll="${x.a.lat},${x.a.lng}">${T('hood.show', 'ดูบนแผนที่')}<span class="sr"> ${esc(x.a.name)}</span></button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  const m = tiles(L.map('map').setView(CENTER, 12)); agg.forEach((x) => x.a.lat && L.circle([x.a.lat, x.a.lng], { radius: 1200, color: AL[lvN(x.mx)].c, weight: 2, fillOpacity: 0.28 }).addTo(m).bindPopup(`${esc(x.a.name)}<br>${x.n} ${T('hood.c.n', 'รายงาน')}`));
  app.querySelector('tbody').onclick = (e) => { const b = e.target.closest('[data-ll]'); if (!b) return; const [a, g] = b.dataset.ll.split(',').map(Number); m.setView([a, g], 14); $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
}
async function updates() {
  const c = await cfg(); let filt = '';
  const draw = async () => { const rs = (await api('/api/reports?hours=72')).filter((r) => !filt || r.level === filt); $('#cnt').textContent = rs.length;
    $('#ul').innerHTML = rs.length ? rs.map((r) => `<li class="rec ${r.mod === 'pending' ? 'faded' : ''}${r.cleared ? ' cleared' : ''}"><div class="rec-h">${depthTag(r.level, r.levelText)} ${modBadge(r)}</div><h3 class="h-s">${esc(soiOf(r) || r.areaName) || T('log.noarea', 'ไม่ระบุชุมชน')}</h3>${placeLine(r)}${soiOf(r) && r.areaName ? `<p class="hint">${T('log.zone', 'ชุมชน')}: ${esc(r.areaName)}</p>` : ''}${r.note ? `<p>${esc(r.note)}</p>` : ''}<p class="hint">${fmt(r.createdAt)} (${ago(r.createdAt)}) · ${T('log.ref', 'อ้างอิง')} ${r.id}${r.confirms > 1 ? ' · ' + r.confirms + ' ' + T('log.conf', 'คนยืนยันตรงกัน') : ''}</p>${r.photo ? `<img class="thumb" src="${r.photo}" alt="${T('log.photo', 'รูปจากผู้แจ้ง')}">` : ''}${voteBtns(r)}</li>`).join('') : `<li>${inset(T('log.none', 'ไม่มีรายงานใน 72 ชั่วโมงที่ผ่านมา'))}</li>`; };
  app.innerHTML = head('list', 'log.title', 'รายงานระดับน้ำทั้งหมด', 'log.lead', 'รายงานจากประชาชนย้อนหลัง 72 ชั่วโมง ใหม่สุดอยู่บนสุด หน้านี้อัปเดตเองเมื่อมีรายงานเข้ามา') +
  `<div class="g"><div class="g-main"><p class="cap"><span id="cnt">0</span> ${T('log.items', 'รายการ')}</p><ol class="recs" id="ul"></ol></div><aside class="g-side"><div class="side-box filter">${field('lvF', T('log.filter', 'กรองตามระดับน้ำ'), `<select id="lvF" class="sel"><option value="">${T('log.all', 'ทุกระดับ')}</option>${Object.entries(c.levels).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>`)}</div></aside></div>`;
  $('#lvF').onchange = (e) => { filt = e.target.value; draw(); };
  await draw(); on((t) => (t === 'report' || t === 'deleted') && draw());
}
async function weather() {
  app.innerHTML = head('rain', 'sky.title', 'ฝนและระดับน้ำ', 'sky.lead', 'พยากรณ์ฝนรายชั่วโมงสำหรับเมืองพัทยา เรดาร์กลุ่มฝน และค่าจากสถานีตรวจวัด') + `<div class="g"><div class="g-main"><section><h2 class="h-l">${T('sky.h.fc', 'พยากรณ์ฝน 24 ชั่วโมง')}</h2><div id="fc"></div></section>
   <section><h2 class="h-l">${T('sky.h.water', 'ระดับน้ำ')}</h2><div id="wl"></div></section><section><h2 class="h-l">${T('sky.h.rain', 'ฝนสะสมรายสถานี')}</h2><div id="rn"></div></section></div>
   <aside class="g-side"><div class="side-box"><h2 class="h-s">${T('sky.h.radar', 'เรดาร์กลุ่มฝน')}</h2><iframe title="${T('sky.h.radar', 'เรดาร์กลุ่มฝน')}" class="radar" src="https://embed.windy.com/embed2.html?lat=12.92&lon=100.88&zoom=9&overlay=radar&product=radar"></iframe></div>
   ${(C.cfg.links || []).length ? `<div class="side-box"><h2 class="h-s">${T('now.src', 'แหล่งข้อมูลจากหน่วยงานอื่น')}</h2><ul class="extl">${C.cfg.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}<span class="sr"> ${T('ui.newwin', '(เปิดในหน้าต่างใหม่)')}</span></a></li>`).join('')}</ul></div>` : ''}</aside></div>`;
  loadForecast($('#fc'), true); loadWater($('#wl')); loadRain($('#rn'));
}
let hlsP; const loadHls = () => (hlsP ||= new Promise((ok, no) => { if (window.Hls) return ok(window.Hls); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'; s.onload = () => ok(window.Hls); s.onerror = no; document.head.appendChild(s); }));
function camPlayer(v) {
  const u = esc(v.url);
  if (v.kind === 'hls') return `<video class="cam" data-hls="${u}" controls muted playsinline autoplay></video>`;
  if (v.kind === 'image') return `<img class="cam" data-snap="${u}" src="${u}" alt="${esc(v.title)}">`;
  if (v.kind === 'iframe') return `<iframe class="cam" src="${u}" title="${esc(v.title)}" allow="autoplay; fullscreen" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  return '';
}
async function startPlayers(root) {
  root.querySelectorAll('video[data-hls]').forEach(async (el) => { const u = el.dataset.hls; if (el.canPlayType('application/vnd.apple.mpegurl')) { el.src = u; return; } try { const H = await loadHls(); if (H.isSupported()) { const h = new H(); h.loadSource(u); h.attachMedia(el); h.on(H.Events.ERROR, (e, d) => { if (d.fatal) el.outerHTML = `<p class="err">${T('eye.fail', 'เล่นภาพสดในหน้านี้ไม่ได้ เพราะต้นทางไม่อนุญาต โปรดเปิดที่เว็บต้นทาง')}</p>`; }); } } catch {} });
  const t = setInterval(() => { const imgs = root.querySelectorAll('img[data-snap]'); if (!document.body.contains(root) || !imgs.length) return clearInterval(t); imgs.forEach((i) => (i.src = i.dataset.snap + (i.dataset.snap.includes('?') ? '&' : '?') + '_t=' + Date.now())); }, 15000);
}
const CAMCOL = { online: '#1b7f4b', offline: '#c8321f', suspect: '#ef7d22', unknown: '#6b7380' };
async function cctv() {
  const c = await cfg(); const own = (c.cctv || []);
  app.innerHTML = head('cam', 'eye.title', 'กล้องถนนเมืองพัทยา', 'eye.lead', 'แผนที่ตำแหน่งกล้องของเมืองพัทยา ภาพสดต้องเปิดดูที่ระบบของเมืองพัทยาโดยตรง เพราะต้นทางต้องยืนยันตัวผู้ชมและไม่อนุญาตให้นำไปแสดงในเว็บอื่น') +
  `${inset(`${T('eye.where', 'ดูภาพสดได้ที่ระบบถ่ายทอดของเมืองพัทยา')} <a href="https://livestream.pattaya.go.th/" target="_blank" rel="noopener">livestream.pattaya.go.th<span class="sr"> ${T('ui.newwin', '(เปิดในหน้าต่างใหม่)')}</span></a>`)}
   <div class="g"><div class="g-main"><div id="map" class="mapmid"></div></div><aside class="g-side"><div class="side-box">${field('cq', T('eye.q', 'ค้นหาถนน แยก หรือชายหาด'), '<input id="cq" class="inp" type="search">')}${field('cs', T('eye.state', 'สถานะกล้อง'), `<select id="cs" class="sel"><option value="">${T('eye.any', 'ทั้งหมด')}</option><option value="online">${T('eye.on', 'ใช้งานได้')}</option><option value="offline">${T('eye.off', 'ขัดข้อง')}</option></select>`)}<p class="hint" id="cinfo"></p></div></aside></div>
   <div class="tblw"><table class="tbl"><thead><tr><th scope="col">${T('eye.c.name', 'กล้อง')}</th><th scope="col">${T('eye.c.st', 'สถานะ')}</th><th scope="col"><span class="sr">${T('eye.c.map', 'แผนที่')}</span></th></tr></thead><tbody id="cl"></tbody></table></div>
   ${own.length ? `<section><h2 class="h-l">${T('eye.more', 'ภาพและลิงก์เพิ่มเติม')}</h2>${own.map((v) => `<div class="camx"><h3 class="h-s">${esc(v.title)}</h3><p class="hint">${esc(v.note || '')}</p>${camPlayer(v)}<p><a href="${esc(v.url)}" target="_blank" rel="noopener">${T('eye.src', 'เปิดเว็บต้นทาง')}</a></p></div>`).join('')}</section>` : ''}`;
  startPlayers(app);
  const m = tiles(L.map('map').setView(CENTER, 13)); const lay = L.layerGroup().addTo(m);
  own.filter((v) => v.lat && v.lng).forEach((v) => L.marker([v.lat, v.lng]).addTo(m).bindPopup(`<b>${esc(v.title)}</b><br><a href="${esc(v.url)}" target="_blank">${T('eye.src', 'เปิดเว็บต้นทาง')}</a>`));
  let cams = [];
  try { const r = await api('/api/cctv/pattaya'); cams = r.items; $('#cinfo').innerHTML = r.ok ? `${T('eye.count', 'จำนวนกล้อง')} ${cams.length} · ${T('eye.upd', 'อัปเดตรายชื่อ')} ${fmt(r.fetchedAt)}${r.stale ? ' ⚠' : ''}` : `<span class="err">${T('eye.listfail', 'ยังดึงรายชื่อกล้องจากเมืองพัทยาไม่ได้')}</span>`; } catch (e) { $('#cinfo').textContent = e.message; }
  const stTxt = { online: T('eye.on', 'ใช้งานได้'), offline: T('eye.off', 'ขัดข้อง') };
  const draw = () => { const q = $('#cq').value.trim().toLowerCase(), s = $('#cs').value;
    const L2 = cams.filter((x) => (!s || x.state === s) && (!q || (x.title + ' ' + x.name + ' ' + x.location + ' ' + x.district).toLowerCase().includes(q))).sort((a, b) => b.featured - a.featured);
    lay.clearLayers(); L2.forEach((x) => x.lat && L.circleMarker([x.lat, x.lng], { radius: 6, color: '#111a24', weight: 1, fillColor: CAMCOL[x.state] || '#6b7380', fillOpacity: 0.95 }).addTo(lay).bindPopup(`<b>${esc(x.title || x.location)}</b><br>${esc(x.name)} · ${esc(x.district)} · ${esc(x.state)}<br><a href="https://livestream.pattaya.go.th/" target="_blank" rel="noopener">${T('eye.watch', 'ดูภาพสดที่เว็บเมืองพัทยา')}</a>`));
    $('#cl').innerHTML = L2.slice(0, 80).map((x) => `<tr><td><b>${esc(x.title || x.location)}</b><br><small class="muted">${esc(x.name)} · ${esc(x.district)}</small></td><td><span class="dot" style="background:${CAMCOL[x.state] || '#6b7380'}"></span> ${esc(stTxt[x.state] || x.state)}</td><td><button class="btn link" type="button" data-ll="${x.lat},${x.lng}">${T('eye.locate', 'แสดงบนแผนที่')}</button></td></tr>`).join('') + (L2.length > 80 ? `<tr><td colspan="3" class="muted">${T('eye.cap', 'แสดง 80 รายการแรก พิมพ์คำค้นเพื่อกรอง')} (${L2.length})</td></tr>` : ''); };
  $('#cq').oninput = draw; $('#cs').onchange = draw; $('#cl').onclick = (e) => { const ll = e.target.closest('[data-ll]')?.dataset.ll; if (ll) { const [a, b] = ll.split(',').map(Number); m.setView([a, b], 17); $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); } }; draw();
}
// ---------- full map: map + accessible list, legend in details, avoidance routing in an expandable section ----------
async function mapPage(q) {
  title(TX('atlas.title', 'แผนที่น้ำท่วมและเส้นทางเลี่ยง'));
  app.innerHTML = `<div class="pg-h"><nav class="bc" aria-label="${T('ui.bc', 'ตำแหน่งของหน้านี้')}"><ol><li><a href="#/">${T('ui.home', 'หน้าแรก')}</a></li><li aria-current="page">${T('atlas.title', 'แผนที่น้ำท่วมและเส้นทางเลี่ยง')}</li></ol></nav><h1 class="h-xl">${T('atlas.title', 'แผนที่น้ำท่วมและเส้นทางเลี่ยง')}</h1></div>
   <div class="vtog" role="group" aria-label="${T('atlas.view', 'รูปแบบการแสดงผล')}"><button type="button" data-v="map" aria-pressed="true">${ico('map')}${T('atlas.v.map', 'แผนที่')}</button><button type="button" data-v="list" aria-pressed="false">${ico('list')}${T('atlas.v.list', 'รายการ')}</button></div>
   <div class="atlas"><div class="atlas-map"><div id="map" role="region" aria-label="${T('atlas.aria', 'แผนที่สถานการณ์น้ำท่วมเมืองพัทยา')}"></div>
    ${acc('', T('atlas.key', 'คำอธิบายสัญลักษณ์'), `<ul class="key">${Object.entries(C.cfg.levels).map(([k, v]) => `<li><i class="dot lg" style="background:${LVCOL[k]}"></i>${esc(v)}</li>`).join('')}<li><i class="ring"></i>${T('atlas.k.halo', 'วงรอบ = บริเวณที่น่าจะท่วม · เส้นประ = รอการยืนยัน')}</li><li><i class="sosk">!</i>${T('atlas.k.req', 'คำขอความช่วยเหลือที่ยังเปิดอยู่')}</li><li><i class="lnk-b"></i>${T('atlas.k.detour', 'ทางเลี่ยงที่เจ้าหน้าที่ประกาศ')}</li><li><i class="lnk-k"></i>${T('atlas.k.closed', 'ถนนปิด')}</li><li><i class="sqk"></i>${T('atlas.k.hs', 'จุดที่น้ำท่วมเป็นประจำ')}</li><li><i class="trik"></i>${T('atlas.k.st', 'สถานีวัดระดับน้ำ')}</li></ul><p class="hint">${T('atlas.k.tip', 'เลือกจุดบนแผนที่เพื่อดูรายละเอียดและช่วยยืนยันสถานะ เปิดหรือปิดชั้นข้อมูลได้ที่ปุ่มมุมขวาบนของแผนที่')}</p>`)}</div>
   <div class="atlas-side"><section class="alist" aria-labelledby="alT"><h2 class="h-m" id="alT">${T('atlas.list', 'จุดที่มีผู้แจ้ง (48 ชม.)')}</h2><ol class="plist" id="plist"></ol></section>
    ${acc('routeBox', `${T('atlas.r.h', 'หาเส้นทางที่เลี่ยงน้ำท่วม')}`, `<p><a class="btn sm" href="#/route">${T('atlas.r.new', 'เส้นทางเลี่ยงน้ำแบบใหม่: เลือกยานพาหนะ เทียบหลายเส้นทาง')}</a></p><ol class="rsteps"><li><p class="lbl">${T('atlas.r.a', '1. เลือกจุดเริ่มต้น')}</p><div class="btnrow"><button type="button" class="btn sec sm on" id="mA" aria-pressed="true">${T('atlas.r.tapa', 'แตะบนแผนที่')}</button><button type="button" class="btn sec sm" id="gA">${ico('target')}${T('atlas.r.gps', 'ตำแหน่งของฉัน')}</button></div></li>
     <li><p class="lbl">${T('atlas.r.b', '2. เลือกปลายทาง')}</p><div class="btnrow"><button type="button" class="btn sec sm" id="mB" aria-pressed="false">${T('atlas.r.tapb', 'แตะบนแผนที่')}</button></div><div class="fg"><label class="lbl sm" for="qB">${T('atlas.r.q', 'หรือพิมพ์ชื่อปลายทาง')}</label><div class="srch"><input id="qB" class="inp" type="search"><button type="button" class="btn sec" id="sB">${T('loc.find', 'ค้นหา')}</button></div></div><div id="resB"></div></li></ol>
     <div class="btnrow"><button class="btn" id="route" type="button">${T('atlas.r.go', 'คำนวณเส้นทาง')}</button><button class="btn link" id="clr" type="button">${T('atlas.r.clear', 'ล้างค่า')}</button></div><div id="rOut" aria-live="polite"></div>`, !!q.demo)}</div></div>`;
  const vt = app.querySelector('.vtog'); vt.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; vt.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); app.querySelector('.atlas').dataset.view = b.dataset.v; setTimeout(() => m.invalidateSize(), 60); };
  const m = tiles(L.map('map', { zoomControl: false }).setView([12.9330, 100.8900], 14)); L.control.zoom({ position: 'bottomleft' }).addTo(m); const lay = { sh: L.layerGroup().addTo(m), hs: L.layerGroup().addTo(m), rep: L.layerGroup().addTo(m), req: L.layerGroup().addTo(m), roads: L.layerGroup().addTo(m), st: L.layerGroup().addTo(m), cam: L.layerGroup(), route: L.layerGroup().addTo(m) };
  L.control.layers(m.bases, { [T('shel.layer', 'ศูนย์พักพิง')]: lay.sh, [T('atlas.l.hs', 'จุดท่วมประจำ')]: lay.hs, [T('atlas.l.rep', 'รายงานจากประชาชน')]: lay.rep, [T('atlas.l.req', 'คำขอความช่วยเหลือ')]: lay.req, [T('atlas.l.roads', 'ถนนปิดและทางเลี่ยง')]: lay.roads, [T('atlas.l.st', 'สถานีวัดน้ำ (สสน.)')]: lay.st, [T('atlas.l.cam', 'กล้องถนน')]: lay.cam }).addTo(m);
  const drawRep = async () => { lay.rep.clearLayers(); const rs = await api('/api/reports?hours=48'); const mk = {};
    rs.forEach((r) => { const pend = r.mod === 'pending', faint = pend || r.cleared;
      const R = { dry: 100, ankle: 160, knee: 230, waist: 300, chest: 350, roof: 400 }[r.level] || 160;
      L.circle([r.lat, r.lng], { radius: R * Math.min(1.5, 1 + 0.1 * Math.max(0, (r.confirms || 1) - 1)), interactive: false, color: LVCOL[r.level], weight: pend ? 1.5 : 1, dashArray: pend ? '6 6' : null, opacity: faint ? 0.5 : 0.9, fillColor: LVCOL[r.level], fillOpacity: r.level === 'dry' ? 0.08 : faint ? 0.1 : 0.22 }).addTo(lay.rep);
      mk[r.id] = L.circleMarker([r.lat, r.lng], { radius: 9, color: '#111a24', weight: pend ? 1.5 : 2, dashArray: pend ? '3 3' : null, fillColor: LVCOL[r.level], fillOpacity: faint ? 0.4 : 0.95, opacity: faint ? 0.7 : 1 }).addTo(lay.rep)
        .bindPopup(() => `<b>${esc(r.levelText)}</b> ${modBadge(r)}<br>${placeLine(r)}${esc(r.areaName || '')} ${esc(r.note || '')}<br>${fmt(r.createdAt)}${r.confirms > 1 ? ' · ' + r.confirms + ' ' + T('log.conf', 'คนยืนยันตรงกัน') : ''}${r.photo ? `<br><img src="${r.photo}" width="160" alt="">` : ''}${voteBtns(r)}`);
      // permanent label: soi name (shown from zoom 17) + "awaiting confirmation" for pending reports (always shown)
      if (pend || soiOf(r)) mk[r.id].bindTooltip(`${soiOf(r) ? `<span class="tts">${esc(soiOf(r))}</span>` : ''}${pend ? `<span class="ttw">${T('vote.tag.wait', 'รอการยืนยัน')}</span>` : ''}`, { permanent: true, direction: 'top', offset: [0, -8], className: 'tt-soi' + (pend ? ' tt-pending' : '') }); });
    $('#plist').innerHTML = rs.length ? rs.map((r) => `<li><button type="button" class="pli" data-id="${esc(r.id)}"><span class="pli-d" style="background:${LVCOL[r.level]}"></span><span><b>${esc(soiOf(r) || r.areaName) || T('log.noarea', 'ไม่ระบุชุมชน')}</b>${soiOf(r) ? `<small>${esc([pN(r, 'soi') && pN(r, 'road'), r.areaName].filter(Boolean).join(' · '))}${pN(r, 'landmark') ? ` · ${T('loc.near', 'ใกล้')} ${esc(pN(r, 'landmark'))}` : ''}</small>` : ''}<small>${esc(r.levelText)} · ${ago(r.createdAt)}${r.mod === 'pending' ? ' · ' + T('vote.tag.wait', 'รอการยืนยัน') : ''}</small></span></button></li>`).join('') : `<li class="hint">${T('atlas.list.none', 'ยังไม่มีรายงานใน 48 ชั่วโมง')}</li>`;
    $('#plist').onclick = (e) => { const b = e.target.closest('[data-id]'); const k = b && mk[b.dataset.id]; if (!k) return; const at = app.querySelector('.atlas'); if (at.dataset.view === 'list') vt.querySelector('[data-v=map]').click(); m.setView(k.getLatLng(), 18); k.openPopup(); $('#map').scrollIntoView({ block: 'center' }); }; };
  const drawReq = async () => { lay.req.clearLayers(); (await api('/api/requests/public')).filter((r) => r.lat && !['resolved', 'closed'].includes(r.status)).forEach((r) => L.marker([r.lat, r.lng], { icon: L.divIcon({ html: '<i class="sosmk">!</i>', className: '', iconSize: [22, 22] }) }).addTo(lay.req).bindPopup(`<b>${esc(r.id)}</b> ${esc(r.areaName)}<br>${placeLine(r, false)}${esc(r.needs.join(', '))}<br>${T('atlas.p.st', 'สถานะ:')} ${stName(r.status)}<br><span style="font-size:12px">${T('atlas.p.round', 'ตำแหน่งถูกปรับให้คลาดเคลื่อนเล็กน้อยเพื่อความเป็นส่วนตัว')}</span>`)); };
  const drawRoads = (rs) => { lay.roads.clearLayers(); rs.forEach((w) => L.polyline(w.points, { color: w.type === 'closed' ? '#111a24' : '#1a56b8', weight: 7, dashArray: w.type === 'closed' ? '2 9' : null, opacity: 0.9 }).addTo(lay.roads).bindPopup(`<b>${w.type === 'closed' ? T('atlas.p.closed', 'ถนนปิด') : T('atlas.p.detour', 'ทางเลี่ยงที่ประกาศ')}</b><br>${esc(w.title)}<br>${placeLine(w)}${esc(w.note || '')}<br>${fmt(w.createdAt)}`)); };
  api('/api/hotspots').then((h) => h.spots.forEach((x) => L.marker([x.lat, x.lng], { icon: L.divIcon({ html: '<div class="hsmk"></div>', className: '', iconSize: [16, 16] }) }).addTo(lay.hs)
    .bindPopup(`<b>${T('atlas.k.hs', 'จุดที่น้ำท่วมเป็นประจำ')}</b><br>${esc(x.label)}<br><span style="font-size:12px">${T('atlas.hs.d', 'ตำแหน่งโดยประมาณ อ้างอิงจากข่าวน้ำท่วมในอดีต')}</span>`))).catch(() => {});
  const drawSh = (a) => { lay.sh.clearLayers(); a.filter((s) => s.lat && s.status !== 'closed').forEach((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ html: '<i class="shmk">⌂</i>', className: '', iconSize: [22, 22] }) }).addTo(lay.sh).bindPopup(shelPop(s))); };
  api('/api/shelters').then(drawSh).catch(() => {}); on((t, d) => t === 'shelters' && drawSh(d));
  drawRep(); drawReq(); api('/api/cctv/pattaya').then((r) => r.items.forEach((x) => x.lat && L.circleMarker([x.lat, x.lng], { radius: 4, color: '#111a24', weight: 1, fillColor: '#6b7380', fillOpacity: 0.85 }).addTo(lay.cam).bindPopup(`<b>${esc(x.title || x.location)}</b><br><a href="https://livestream.pattaya.go.th/" target="_blank" rel="noopener">${T('eye.watch', 'ดูภาพสดที่เว็บเมืองพัทยา')}</a>`))).catch(() => {}); drawRoads(await api('/api/roads'));
  api('/api/water').then((w) => w.ok && w.stations.forEach((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ html: '<i class="tri"></i>', className: '', iconSize: [14, 14] }) }).addTo(lay.st).bindPopup(`${esc(s.name)}<br>${esc(s.status)} · ${fmt(s.measuredAt)}`)));
  on((t, d) => { if (t === 'report' || t === 'deleted') drawRep(); if (t === 'request' || t === 'deleted') drawReq(); if (t === 'roads') drawRoads(d); });
  const st = { mode: 'A', A: null, B: null, mA: null, mB: null };
  const pinIcon = (k) => L.divIcon({ html: `<span class="abpin ${k}">${k}</span>`, className: '', iconSize: [28, 28], iconAnchor: [14, 28] });
  const mode = (k) => { st.mode = k; $('#mA').classList.toggle('on', k === 'A'); $('#mB').classList.toggle('on', k === 'B'); $('#mA').setAttribute('aria-pressed', String(k === 'A')); $('#mB').setAttribute('aria-pressed', String(k === 'B')); };
  const setPt = (k, ll) => { st[k] = ll; st['m' + k] && m.removeLayer(st['m' + k]); st['m' + k] = L.marker(ll, { icon: pinIcon(k) }).addTo(m); if (k === 'A') mode('B'); };
  m.on('click', (e) => $('#routeBox').open && setPt(st.mode, [e.latlng.lat, e.latlng.lng]));
  $('#mA').onclick = () => mode('A'); $('#mB').onclick = () => mode('B');
  $('#gA').onclick = async () => { try { const p = await gps(); setPt('A', p); m.setView(p, 15); } catch (e) { $('#rOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  const findB = async () => { const rs = await geocode($('#qB').value); $('#resB').innerHTML = rs.length ? `<ul class="picks">${rs.map((r, i) => `<li><button type="button" class="btn link" data-i="${i}">${esc(r.display_name.slice(0, 80))}</button></li>`).join('')}</ul>` : `<p>${T('loc.none', 'ไม่พบสถานที่นี้ในเขตเมืองพัทยา')}</p>`; $('#resB').onclick = (e) => { const r = rs[e.target.closest('[data-i]')?.dataset.i]; if (r) { setPt('B', [+r.lat, +r.lon]); m.setView([+r.lat, +r.lon], 14); $('#resB').innerHTML = ''; } }; };
  $('#sB').onclick = findB; $('#qB').addEventListener('keydown', (e) => { if (e.key === 'Enter') findB(); });
  $('#clr').onclick = () => { lay.route.clearLayers(); ['mA', 'mB'].forEach((k) => st[k] && m.removeLayer(st[k])); st.A = st.B = null; mode('A'); $('#rOut').innerHTML = ''; };
  const calc = async () => {
    if (!st.A || !st.B) return showErr($('#rOut'), [['mA', TX('atlas.r.need', 'เลือกทั้งจุดเริ่มต้นและปลายทางก่อน')]]); $('#rOut').innerHTML = `<p class="muted">${T('atlas.r.wait', 'กำลังคำนวณเส้นทาง…')}</p>`;
    try { const r = await api(`/api/route?fromLat=${st.A[0]}&fromLng=${st.A[1]}&toLat=${st.B[0]}&toLng=${st.B[1]}`); lay.route.clearLayers();
      r.zones.forEach((z) => L.circle([z.lat, z.lng], { radius: z.rM, color: '#c8321f', weight: 1, fillOpacity: 0.12 }).addTo(lay.route));
      r.alternatives.forEach((a) => L.polyline(a.coords.map(([x, y]) => [y, x]), { color: '#6b7380', weight: 4, dashArray: '4 6' }).addTo(lay.route).bindPopup(a.floodHits.length ? T('atlas.r.hits', 'เส้นนี้ผ่านจุดน้ำท่วม:') + ' ' + esc(a.floodHits.join(', ')) : T('atlas.r.alt', 'เส้นทางสำรอง')));
      const b = r.best, pl = L.polyline(b.coords.map(([x, y]) => [y, x]), { color: r.avoids ? '#1a56b8' : '#c8321f', weight: 6 }).addTo(lay.route); m.fitBounds(pl.getBounds(), { padding: [30, 30] });
      $('#rOut').innerHTML = `${r.avoids ? `<div class="cp sm" role="status"><p><b>${T('atlas.r.ok', 'เส้นทางนี้เลี่ยงจุดน้ำท่วมที่มีผู้แจ้งได้ทั้งหมด')}</b> (${r.zonesCount})</p></div>` : r.warning ? warnText(`${esc(r.warning)}<br>${T('atlas.r.via', 'ผ่าน:')} ${esc(b.floodHits.join(', '))}`) : inset(T('atlas.r.clean', 'ขณะนี้ไม่มีจุดน้ำท่วมที่ต้องเลี่ยง'))}
        ${SL([[T('atlas.r.dist', 'ระยะทาง'), `<b>${(b.distance / 1000).toFixed(1)}</b> ${T('atlas.r.km', 'กม.')}`], [T('atlas.r.time', 'เวลาโดยประมาณ'), `<b>${Math.round(b.duration / 60)}</b> ${T('atlas.r.min', 'นาที')} <small class="muted">${T('atlas.r.nt', 'ไม่รวมสภาพจราจร')}</small>`], [T('atlas.r.eng', 'ระบบคำนวณ'), esc(r.engine)]])}
        <p><a class="btn sec sm" target="_blank" rel="noopener" href="${r.gmaps}">${T('atlas.r.gm', 'นำทางด้วย Google Maps')}</a></p>${acc('', T('atlas.r.steps', 'รายละเอียดทีละช่วง'), `<ol class="num">${b.steps.filter((s) => s.text).map((s) => `<li>${esc(s.text)} <span class="muted">${s.distance >= 1000 ? (s.distance / 1000).toFixed(1) + ' ' + T('atlas.r.km', 'กม.') : Math.round(s.distance) + ' ' + T('atlas.r.m', 'ม.')}</span></li>`).join('')}</ol>`)}<p class="hint">${T('atlas.r.warn', 'เส้นทางคำนวณจากข้อมูลที่ประชาชนและเจ้าหน้าที่แจ้ง อาจไม่ครบทุกจุด อย่าขับรถผ่านน้ำที่ไหลแรง')}</p>`;
    } catch (e) { $('#rOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $('#route').onclick = calc;
  setTimeout(() => m.invalidateSize(), 120);
  if (q.demo) { setPt('A', [12.9505, 100.8890]); setPt('B', [12.9030, 100.8960]); calc(); }
}
// ---------- phone book ----------
async function callPage() {
  const c = (await cfg()).contacts;
  const book = (rows) => `<div class="tblw"><table class="tbl book"><tbody>${rows.map((h) => `<tr><th scope="row">${esc(h.name)}${h.note ? `<br><small class="muted">${esc(h.note)}</small>` : ''}</th><td>${tel(h.phone)}</td></tr>`).join('')}</tbody></table></div>`;
  app.innerHTML = head('phone', 'dial.title', 'เบอร์โทรฉุกเฉิน', 'dial.lead', 'แตะหมายเลขเพื่อโทรออก มีทั้งสายด่วนระดับประเทศ หน่วยกู้ภัย โรงพยาบาล และผู้ประสานงานของแต่ละชุมชน') +
  `<ul class="hotl big">${HOT().map(([n, l]) => `<li><a href="tel:${n}"><b>${n}</b><span>${l}</span></a></li>`).join('')}</ul>
   <div class="g"><div class="g-main"><section><h2 class="h-l">${T('dial.rescue', 'กู้ภัยและหน่วยฉุกเฉิน')}</h2>${book(c.emergency)}</section><section><h2 class="h-l">${T('dial.health', 'โรงพยาบาลและสาธารณสุข')}</h2>${book(c.health)}</section></div>
   <aside class="g-side"><div class="side-box"><h2 class="h-s">${T('dial.coord', 'ผู้ประสานงานชุมชน')}</h2>${field('areaSel', T('dial.pick', 'ชุมชนของคุณ'), `<select id="areaSel" class="sel"><option value="">${T('dial.pick.ph', 'เลือกชุมชน')}</option>${c.areas.map((a) => `<option value="${a.id}">${esc(a.name)} (${esc(a.org)})</option>`).join('')}</select>`)}<div id="areaOut" aria-live="polite"></div></div></aside></div>`;
  $('#areaSel').onchange = (e) => { const a = c.areas.find((x) => x.id === e.target.value); $('#areaOut').innerHTML = a ? `${SL([[T('dial.who', 'ผู้ประสานงาน'), esc(a.coordinator)], [T('dial.org', 'หน่วยงาน'), esc(a.org)], [T('dial.tel', 'โทร'), tel(a.phone)], a.verified ? [T('dial.chk', 'ตรวจสอบเบอร์จาก'), esc(a.source || '')] : null])}${a.phone ? '' : `<p>${T('dial.nophone', 'ชุมชนนี้ยังไม่มีเบอร์ผู้ประสานงาน โปรดโทร 1337 หรือ 1784')}</p>`}` : ''; };
}
async function menuPage() {
  const cf = await cfg();
  app.innerHTML = head('menu', 'idx.title', 'บริการทั้งหมด', '', '') + MENU().map((g) => `<section><h2 class="h-l">${g.g}</h2><ul class="tasks desc">${g.items.map(([h, l, d]) => `<li>${linkGo('#/' + h, l)}<p class="hint">${d}</p></li>`).join('')}</ul></section>`).join('') +
   `<section><h2 class="h-l">${T('idx.lang', 'ภาษา / Language / 语言')}</h2>${langSwitch()}</section>${(cf.links || []).length ? `<section><h2 class="h-l">${T('now.src', 'แหล่งข้อมูลจากหน่วยงานอื่น')}</h2><ul class="extl">${cf.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`).join('')}</ul></section>` : ''}`;
}
async function levelsPage() {
  await cfg(); const a = await alertData().catch(() => null);
  app.innerHTML = head('warn', 'lvlp.title', 'ระดับเตือนภัยน้ำท่วม 5 ระดับ', 'lvlp.lead', 'เว็บนี้สรุปสถานการณ์ทั้งเมืองเป็นตัวเลขเดียว เพื่อให้ตัดสินใจได้เร็ว ระดับคำนวณจากรายงานของประชาชนใน 24 ชั่วโมงและพยากรณ์ฝน') +
  `<ol class="lvls">${[1, 2, 3, 4, 5].map((i) => `<li style="--c:${AL[i].c};--f:${AL[i].fg}" ${a?.n === i ? 'aria-current="true"' : ''}><div class="lvls-n"><b>${i}</b></div><div><h2 class="h-m">${ALN()[i]}${a?.n === i ? ` <span class="now">${T('lvlp.now', 'ระดับปัจจุบัน')}</span>` : ''}</h2><p>${ALD()[i]}</p><p class="hint">${[null, T('lvlp.r1', 'เกณฑ์: ไม่มีรายงานน้ำสูงเกิน 30 ซม.'), T('lvlp.r2', 'เกณฑ์: น้ำระดับข้อเท้า (ประมาณ 30 ซม.) หรือพยากรณ์ฝนรวมเกิน 35 มม.'), T('lvlp.r3', 'เกณฑ์: น้ำระดับเข่า (ประมาณ 75 ซม.)'), T('lvlp.r4', 'เกณฑ์: น้ำระดับเอว (ประมาณ 115 ซม.)'), T('lvlp.r5', 'เกณฑ์: น้ำระดับอกหรือสูงกว่า (155 ซม. ขึ้นไป)')][i]}</p><ul class="bul">${TODO()[i].map((x) => `<li>${x}</li>`).join('')}</ul></div></li>`).join('')}</ol>
   ${inset(T('lvlp.note', 'ระดับนี้เป็นการประเมินอัตโนมัติเพื่อช่วยการตัดสินใจ ไม่ใช่ประกาศเตือนภัยทางราชการ โปรดติดตามประกาศของเมืองพัทยาและกรมป้องกันและบรรเทาสาธารณภัยควบคู่กัน'))}`;
}

// ---------- staff (triage for rescue teams) ----------
async function staffPage() {
  let me; try { me = await api('/api/staff/me'); } catch {}
  if (!me) { app.innerHTML = head('shield', 'staff.in.title', 'แผงงานเจ้าหน้าที่', 'staff.in.lead', 'สำหรับเจ้าหน้าที่เมืองพัทยาและทีมกู้ภัยที่ได้รับบัญชีแล้ว') + `<div class="panel narrow"><form id="lf" method="post" action="#" autocomplete="on"><input id="un" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${T('staff.login.user', 'ชื่อผู้ใช้')}"><input id="pw" name="password" type="password" autocomplete="current-password" placeholder="${T('staff.login.pw', 'รหัสผ่าน')}"><button class="btn" id="go" type="submit">${T('staff.login.submit', 'เข้าสู่ระบบ')}</button> <span id="msg"></span></form><p class="muted">${T('staff.login.note', 'ผู้ดูแลระบบสร้างบัญชีให้ที่หน้า ระบบหลังบ้าน /admin')}</p></div>`;
    const go = async () => { try { await api('/api/staff/login', { method: 'POST', body: { username: $('#un').value, password: $('#pw').value } }); render(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } };
    $('#lf').addEventListener('submit', (e) => { e.preventDefault(); go(); }); return; }
  let tab = 'requests', data;
  const S = { requests: ['new', 'triaged', 'assigned', 'enroute', 'resolved', 'closed'], reports: ['new', 'verified', 'hidden'], missing: ['searching', 'found', 'closed'], lostfound: ['open', 'closed', 'hidden'], roads: ['open', 'hidden'] };
  const role = me.user.role, canDel = role === 'superadmin', canAsg = role === 'superadmin', canHide = role !== 'staff'; // server enforces the same
  const row = (c, x) => `<tr><td><b>${x.id}</b><br><span class="muted">${fmt(x.createdAt)}</span></td><td>${c === 'requests' ? `${esc(x.areaName)} · ${esc(C.cfg.kinds?.[x.kind] || x.kind)} · ${x.people} ${T('staff.people', 'คน')}<br>${placeLine(x)}${esc(x.needs.join(', '))}<br>${esc(x.name)} ${tel(x.phone)}<br>${esc(x.address)} ${esc(x.note)}${x.lat ? ` <a target="_blank" href="https://www.google.com/maps?q=${x.lat},${x.lng}">${T('staff.map', 'แผนที่')}</a> <a class="btn sm rt-resc" href="#/route?t=${x.lat},${x.lng}&v=truck&ref=${x.id}">${T('rt.rescue', 'วางเส้นทางรถกู้ภัย')}</a>` : ''}` : c === 'reports' ? `${esc(x.areaName || '')} · ${esc(C.cfg.levels[x.level] || x.level)} · ${esc(x.note)}<br>${placeLine(x)}${x.placeSrc === 'user' && x.soiAuto ? ` <span class="muted">(${T('loc.auto', 'ระบบหาได้')}: ${esc(x.soiAuto)})</span>` : ''}` : c === 'missing' ? `<b>${esc(x.personName)}</b> ${esc(x.age)}<br>${esc(x.lastSeen)} ${esc(x.description)}<br>${T('staff.reporter', 'ผู้แจ้ง')} ${esc(x.reporterName)} ${tel(x.reporterPhone)}` : c === 'roads' ? `${x.type === 'closed' ? T('map.pop.closed', '⛔ ถนนปิด') : T('map.pop.detour', '✅ เส้นทางเลี่ยงทางการ')} ${esc(x.title)} (${x.points.length}) ${placeLine(x)} ${x.approval === 'pending' ? `<span class="pill">${T('road.pending', '⏳ รออนุมัติ')}</span>` : x.approval === 'rejected' ? `<span class="pill bad">${T('road.rejected', '✖ ไม่อนุมัติ')}</span><br><span class="muted">${T('road.reason', 'เหตุผล')}: ${esc(x.reason || '')}</span>` : ''}` : `${esc(x.type)} ${esc(x.title)} ${tel(x.phone)}`}${x.photo ? `<br><img class="thumb" src="${x.photo}">` : ''}</td>
    <td><select data-c="${c}" data-id="${x.id}" class="sst" style="width:auto">${S[c].filter((s) => s === x.status || canHide || s !== 'hidden').map((s) => `<option value="${s}" ${s === x.status ? 'selected' : ''}>${stName(s)}</option>`).join('')}</select>${c === 'requests' && !canAsg ? (x.assignee ? `<br><span class="muted">${T('staff.team', 'ทีม')}: ${esc(x.assignee)}</span>` : '') : ''}${c === 'requests' && canAsg ? `<input class="asg" data-id="${x.id}" placeholder="${T('staff.assign.ph', 'มอบหมายทีม')}" value="${esc(x.assignee || '')}">` : ''}${canDel ? `<button class="btn sm red del" data-c="${c}" data-id="${x.id}">${T('staff.delete', 'ลบ')}</button>` : ''}</td></tr>`;
  const TABS = { requests: T('staff.tab.requests', 'คำขอช่วยเหลือ'), reports: T('staff.tab.reports', 'รายงานระดับน้ำ'), missing: T('staff.tab.missing', 'ตามหาคน'), lostfound: T('staff.tab.lf', 'ของหาย'), roads: T('staff.tab.roads', 'เส้นทางเลี่ยง/ถนนปิด') };
  const draw = async () => { data = await api('/api/staff/data'); data.roads = await api('/api/staff/roads'); const n = (c) => data[c].filter((x) => ['new', 'searching'].includes(x.status)).length;
    app.innerHTML = `<div class="panel"><h2>${T('staff.panel', '👮 แผงเจ้าหน้าที่')} · ${esc(me.name)}</h2><div class="tabs">${Object.keys(TABS).map((c) => `<button class="chip ${c === tab ? 'on' : ''}" data-tab="${c}">${TABS[c]} ${n(c) ? `(${n(c)})` : ''}</button>`).join('')}<a class="chip" href="/admin">${T('staff.backoffice', '⚙️ ระบบหลังบ้าน')}</a><button class="chip" id="lo">${T('staff.logout', 'ออกจากระบบ')}</button></div>
     ${tab === 'roads' ? `<div id="map" style="height:45vh"></div><p class="muted">${T('staff.roads.hint2', 'แตะแผนที่เพื่อวางจุดตามแนวถนน แล้วกดส่ง — รายการของเจ้าหน้าที่จะแสดงบนแผนที่สาธารณะและใช้หลบในการคำนวณเส้นทางหลังผู้ดูแลอนุมัติ (ผู้ดูแลเผยแพร่ได้ทันที)')}</p><select id="rt" style="width:auto"><option value="detour">${T('map.pop.detour', '✅ เส้นทางเลี่ยงทางการ')}</option><option value="closed">${T('map.pop.closed', '⛔ ถนนปิด')}</option></select><input id="rti" placeholder="${T('staff.roads.name.ph', 'ชื่อ เช่น เลี่ยงสุขุมวิท-แยกเฉลิมพระเกียรติ')}"><input id="rno" placeholder="${T('staff.roads.note.ph', 'หมายเหตุ')}"><button class="btn" id="pub">${T('staff.roads.publish', 'เผยแพร่')}</button> <button class="btn alt" id="undo">${T('staff.roads.undo', 'ลบจุดล่าสุด')}</button> <span id="msg"></span>` : ''}
     <div style="overflow:auto"><table><tr><th>${T('staff.col.case', 'เคส')}</th><th>${T('staff.col.detail', 'รายละเอียด')}</th><th>${T('staff.col.manage', 'จัดการ')}</th></tr>${data[tab].map((x) => row(tab, x)).join('') || `<tr><td colspan=3>${T('staff.empty', 'ไม่มีรายการ')}</td></tr>`}</table></div></div>`;
    app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    $('#lo').onclick = async () => { await api('/api/staff/logout', { method: 'POST' }); render(); };
    app.querySelectorAll('.sst').forEach((s) => (s.onchange = () => { api(`/api/staff/${s.dataset.c}/${s.dataset.id}`, { method: 'PATCH', body: { status: s.value } }).then(draw); }));
    app.querySelectorAll('.asg').forEach((s) => (s.onchange = () => { api(`/api/staff/requests/${s.dataset.id}`, { method: 'PATCH', body: { assignee: s.value, status: 'assigned' } }).then(draw); }));
    app.querySelectorAll('.del').forEach((b) => (b.onclick = () => { if (confirm(C.cfg.texts?.['staff.confirmdel'] || 'ลบรายการนี้ถาวร?')) api(`/api/staff/${b.dataset.c}/${b.dataset.id}`, { method: 'DELETE' }).then(draw); }));
    if (tab === 'roads') { const m = tiles(L.map('map').setView(CENTER, 13)); const pts = []; const pl = L.polyline([], { color: '#16a34a', weight: 6 }).addTo(m);
      data.roads.forEach((w) => w.approval !== 'rejected' && L.polyline(w.points, { color: w.type === 'closed' ? '#000' : '#16a34a', weight: 5, opacity: w.approval === 'pending' ? 0.3 : 0.5, dashArray: w.type === 'closed' ? '6 8' : null }).addTo(m));
      m.on('click', (e) => { pts.push([e.latlng.lat, e.latlng.lng]); pl.setLatLngs(pts); }); $('#rt').onchange = () => { pl.setStyle({ color: $('#rt').value === 'closed' ? '#000' : '#16a34a' }); };
      $('#undo').onclick = () => { pts.pop(); pl.setLatLngs(pts); };
      $('#pub').onclick = async () => { try { await api('/api/staff/roads', { method: 'POST', body: { type: $('#rt').value, title: $('#rti').value, note: $('#rno').value, points: pts } }).then((r) => { if (r.pending) alert(T('road.submitted', 'ส่งแล้ว — รอผู้ดูแลอนุมัติก่อนแสดงบนแผนที่สาธารณะ')); }); draw(); } catch (e) { $('#msg').innerHTML = `<span class="err">${esc(e.message)}</span>`; } }; }
  };
  await draw(); on((t) => t.startsWith('staff:') && tab !== 'roads' && draw());
}
// texts used only by dynamic code paths (registered for the CMS editor)
void [T('staff.confirmdel', 'ลบรายการนี้ถาวร?'), T('ui.off', 'การเชื่อมต่อขาดหาย กำลังลองใหม่'), T('ui.err.gps', 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์ หรือเลือกตำแหน่งบนแผนที่'), T('ui.err.nogps', 'อุปกรณ์นี้ระบุตำแหน่งเองไม่ได้ โปรดเลือกตำแหน่งบนแผนที่'),
  T('wl.e1', 'เลือกระดับน้ำ'), T('wl.e2', 'เลือกตำแหน่งบนแผนที่ ใช้ตำแหน่งปัจจุบัน หรือค้นหาสถานที่'), T('ask.e2', 'เลือกชุมชนที่ต้องการให้ทีมไป'), T('ask.e4a', 'ใส่ชื่อของคุณ'), T('ask.e4b', 'ใส่เบอร์โทรศัพท์ที่ติดต่อได้'), T('atlas.r.need', 'เลือกทั้งจุดเริ่มต้นและปลายทางก่อน')];
void [T('wl.title', 'แจ้งระดับน้ำ'), T('wl.lead', 'บอกเราว่าน้ำสูงแค่ไหนและอยู่ตรงไหน ข้อมูลจะแสดงบนแผนที่สาธารณะเพื่อช่วยให้คนอื่นเลี่ยงเส้นทาง ไม่ต้องใส่ชื่อหรือเบอร์โทร'), T('ask.title', 'ขอความช่วยเหลือ'), T('ask.lead', 'คำขอของคุณจะส่งถึงเจ้าหน้าที่และทีมในพื้นที่ทันที เมื่อส่งแล้วคุณจะได้หมายเลขอ้างอิงไว้ติดตามเรื่อง'),
  T('case.title', 'ติดตามคำขอความช่วยเหลือ'), T('case.lead', 'ใช้หมายเลขอ้างอิงที่ได้รับหลังส่งคำขอ และเบอร์โทร 4 ตัวท้ายที่ใช้ตอนส่ง'), T('hood.title', 'สถานการณ์แต่ละชุมชน'), T('hood.lead', 'ชุมชนที่มีรายงานน้ำสูงที่สุดอยู่บนสุด คำนวณจากรายงานของประชาชนใน 24 ชั่วโมง ภายในรัศมีประมาณ 1.2 กม. จากกลางชุมชน'),
  T('log.title', 'รายงานระดับน้ำทั้งหมด'), T('log.lead', 'รายงานจากประชาชนย้อนหลัง 72 ชั่วโมง ใหม่สุดอยู่บนสุด หน้านี้อัปเดตเองเมื่อมีรายงานเข้ามา'), T('trace.title', 'แจ้งคนที่ติดต่อไม่ได้'), T('trace.lead', 'ถ้าคุณติดต่อญาติหรือคนรู้จักไม่ได้ระหว่างน้ำท่วม เจ้าหน้าที่จะช่วยตรวจรายชื่อในศูนย์พักพิงและแจ้งทีมกู้ภัย'),
  T('board.title', 'ของหายและของที่เก็บได้'), T('board.lead', 'ประกาศตามหาสัตว์เลี้ยง เอกสาร หรือทรัพย์สินที่หายระหว่างน้ำท่วม หรือแจ้งว่าคุณเก็บของของใครได้'), T('sky.title', 'ฝนและระดับน้ำ'), T('sky.lead', 'พยากรณ์ฝนรายชั่วโมงสำหรับเมืองพัทยา เรดาร์กลุ่มฝน และค่าจากสถานีตรวจวัด'),
  T('eye.title', 'กล้องถนนเมืองพัทยา'), T('eye.lead', 'แผนที่ตำแหน่งกล้องของเมืองพัทยา ภาพสดต้องเปิดดูที่ระบบของเมืองพัทยาโดยตรง เพราะต้นทางต้องยืนยันตัวผู้ชมและไม่อนุญาตให้นำไปแสดงในเว็บอื่น'), T('dial.title', 'เบอร์โทรฉุกเฉิน'), T('dial.lead', 'แตะหมายเลขเพื่อโทรออก มีทั้งสายด่วนระดับประเทศ หน่วยกู้ภัย โรงพยาบาล และผู้ประสานงานของแต่ละชุมชน'),
  T('idx.title', 'บริการทั้งหมด'), T('lvlp.title', 'ระดับเตือนภัยน้ำท่วม 5 ระดับ'), T('lvlp.lead', 'เว็บนี้สรุปสถานการณ์ทั้งเมืองเป็นตัวเลขเดียว เพื่อให้ตัดสินใจได้เร็ว ระดับคำนวณจากรายงานของประชาชนใน 24 ชั่วโมงและพยากรณ์ฝน'), T('staff.in.title', 'แผงงานเจ้าหน้าที่'), T('staff.in.lead', 'สำหรับเจ้าหน้าที่เมืองพัทยาและทีมกู้ภัยที่ได้รับบัญชีแล้ว'), T('loc.b.osm', 'แผนที่ถนน (OSM)'), T('loc.b.voy', 'แผนที่สีอ่อน (CARTO)'), T('loc.soi.h1', 'ระบบหาจากตำแหน่งหมุดให้แล้ว ถ้าไม่ตรงแก้ไขหรือเลือกจากรายการได้'), T('loc.soi.h2', 'ไม่พบชื่อซอยใกล้หมุด พิมพ์ชื่อซอยหรือจุดสังเกตเองได้')];

// ================= shelters · I'm safe · repeat-flood history =================
const dirUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`;
const shelSt = (s) => (s.status === 'full' ? `<strong class="tag t-bad">${T('shel.full', 'เต็ม')}</strong>` : s.status === 'closed' ? `<strong class="tag">${T('shel.closed', 'ปิด')}</strong>` : `<strong class="tag t-ok">${T('shel.open', 'เปิดรับ')}</strong>`);
const shelPop = (s) => `<b>${esc(s.name)}</b> ${shelSt(s)}<br>${placeLine(s, false)}${T('shel.avail', 'ที่ว่าง')}: <b>${s.available}</b> / ${s.capacity}<br><a href="${dirUrl(s)}" target="_blank" rel="noopener">${T('shel.dir', 'นำทางไปที่นี่')}</a> · <a href="#/route?t=${s.lat},${s.lng}&v=walk">${T('rt.toshel', 'เส้นทางเลี่ยงน้ำ')}</a> · <a href="#/shelters">${T('shel.all', 'ดูทั้งหมด')}</a>`;
async function sheltersPage() {
  let me = null; try { me = await api('/api/staff/me'); } catch {}
  let list = await api('/api/shelters'), here = null;
  app.innerHTML = head('home', 'shel.title', 'ศูนย์พักพิง', 'shel.lead', 'ที่ว่างในแต่ละศูนย์อัปเดตโดยเจ้าหน้าที่ ก่อนเดินทางควรโทรยืนยัน ถ้าต้องการให้ทีมไปรับ ให้ขอความช่วยเหลือ') +
    `<div class="btnrow"><button type="button" class="btn sec" id="near">${ico('target')}${T('shel.near', 'เรียงจากใกล้ฉัน')}</button><a class="btn sec" href="#/help?kind=evacuate">${T('shel.pickup', 'ขอให้ทีมมารับ')}</a></div>
    <div class="atlas"><div class="atlas-map"><div id="map" role="region" aria-label="${T('shel.map', 'แผนที่ศูนย์พักพิง')}"></div></div><div class="atlas-side"><ol class="shl" id="shl"></ol></div></div>`;
  const m = tiles(L.map('map').setView([12.93, 100.89], 13)), lay = L.layerGroup().addTo(m);
  const draw = () => { lay.clearLayers(); const a = here ? [...list].sort((x, y) => km(here[0], here[1], x.lat, x.lng) - km(here[0], here[1], y.lat, y.lng)) : list;
    a.forEach((s) => s.lat && L.marker([s.lat, s.lng], { icon: L.divIcon({ html: '<i class="shmk">⌂</i>', className: '', iconSize: [22, 22] }) }).addTo(lay).bindPopup(shelPop(s)));
    $('#shl').innerHTML = a.map((s) => { const p = s.capacity ? Math.min(100, Math.round((s.occupancy / s.capacity) * 100)) : 0; return `<li class="shc"><h2 class="h-s">${esc(s.name)} ${shelSt(s)}</h2>${placeLine(s, false)}
      <p class="sh-av"><b>${s.available}</b> ${T('shel.free', 'ที่ว่าง')} <span class="muted">· ${s.occupancy}/${s.capacity} ${T('shel.ppl', 'คน')}${here && s.lat ? ` · ${km(here[0], here[1], s.lat, s.lng).toFixed(1)} ${T('atlas.r.km', 'กม.')}` : ''}</span></p>
      <div class="meter" role="img" aria-label="${p}%"><i style="width:${p}%;background:${p >= 100 ? '#c8321f' : p >= 80 ? '#ef7d22' : '#1b7f4b'}"></i></div>
      ${s.facilities.length ? `<p class="hint">${s.facilities.map(esc).join(' · ')}</p>` : ''}<p>${s.phone ? `<a href="tel:${esc(s.phone)}">${ico('phone')}${esc(s.phone)}</a> ${esc(s.contact)} · ` : ''}<a href="${dirUrl(s)}" target="_blank" rel="noopener">${T('shel.dir', 'นำทางไปที่นี่')}</a> · <a href="#" data-z="${s.id}">${T('shel.onmap', 'ดูบนแผนที่')}</a></p>
      ${me ? `<p class="occ"><label class="lbl sm" for="oc-${s.id}">${T('shel.occ', 'ผู้พักตอนนี้ (เจ้าหน้าที่)')}</label> <input id="oc-${s.id}" class="inp w5" type="number" min="0" value="${s.occupancy}"> <button type="button" class="btn sm" data-oc="${s.id}">${T('shel.save', 'บันทึก')}</button></p>` : ''}</li>`; }).join('') || `<li>${inset(T('shel.none', 'ยังไม่มีศูนย์พักพิงที่เปิดประกาศ'))}</li>`; };
  draw(); setTimeout(() => m.invalidateSize(), 100);
  $('#near').onclick = async () => { try { here = await gps(); L.circleMarker(here, { radius: 7, color: '#fff', weight: 2, fillColor: '#1a56b8', fillOpacity: 1 }).addTo(m); draw(); } catch (e) { alert(e.message); } };
  $('#shl').onclick = async (e) => { const z = e.target.closest('[data-z]'); if (z) { e.preventDefault(); const s = list.find((x) => x.id === z.dataset.z); s && m.setView([s.lat, s.lng], 17); $('#map').scrollIntoView({ block: 'center' }); }
    const b = e.target.closest('[data-oc]'); if (b) { try { await api('/api/shelters/' + b.dataset.oc + '/occupancy', { method: 'PATCH', body: { occupancy: $('#oc-' + b.dataset.oc).value } }); b.textContent = TX('shel.saved', 'บันทึกแล้ว'); } catch (er) { alert(er.message); } } };
  on((t, d) => { if (t === 'shelters') { list = d; draw(); } });
}
async function safePage() {
  const c = await cfg();
  app.innerHTML = head('ok', 'safe.title', 'ฉันปลอดภัย', 'safe.lead', 'บอกครอบครัวและเพื่อนว่าคุณปลอดภัย คนอื่นค้นหาจากชื่อได้ ระบบจะแสดงชื่อแบบย่อ และไม่แสดงเบอร์โทร') +
   `<div class="g"><div class="g-main"><section aria-labelledby="sfS"><h2 class="h-m" id="sfS">${T('safe.find', 'ค้นหาคนที่แจ้งว่าปลอดภัย')}</h2>${field('sq', T('safe.q', 'ชื่อ (อย่างน้อย 2 ตัวอักษร)'), `<div class="srch"><input id="sq" class="inp" type="search"><button type="button" class="btn sec" id="sb">${T('loc.find', 'ค้นหา')}</button></div>`)}<div id="sr" aria-live="polite"></div></section>
    <section aria-labelledby="sfF"><h2 class="h-m" id="sfF">${T('safe.mark', 'แจ้งว่าฉันปลอดภัย')}</h2>${field('nm', T('safe.name', 'ชื่อ-นามสกุล'), '<input id="nm" class="inp" autocomplete="name" maxlength="80">')}
     ${field('ar', T('safe.area', 'ชุมชน (ถ้าทราบ)'), `<select id="ar" class="sel">${areaOpts(c, T('wl.zone.ph', 'ไม่ระบุ'))}</select>`)}${field('soi', T('loc.soi', 'ซอย / ถนน'), '<input id="soi" class="inp" list="soiDL" maxlength="100" autocomplete="off"><datalist id="soiDL"></datalist>')}
     ${field('ms', T('safe.msg', 'ข้อความถึงครอบครัว (ไม่บังคับ)'), '<input id="ms" class="inp" maxlength="200">', T('safe.msg.h', 'เช่น อยู่ที่ศูนย์พักพิง หรืออยู่บ้านญาติ'))}${field('tl', T('safe.tel', 'เบอร์โทร (เจ้าหน้าที่เห็นเท่านั้น)'), '<input id="tl" class="inp w10" type="tel" inputmode="tel" autocomplete="tel">', T('safe.tel.h', 'ใช้ป้องกันการแจ้งแทนผู้อื่น และให้เจ้าหน้าที่ติดต่อได้ ไม่แสดงต่อสาธารณะ'))}
     <div id="msg" aria-live="polite"></div><button type="button" class="btn" id="go">${T('safe.send', 'แจ้งว่าฉันปลอดภัย')}</button></section></div>
    <aside class="g-side"><div class="side-box"><h2 class="h-s">${T('safe.side', 'ความเป็นส่วนตัว')}</h2><p>${T('safe.side.p', 'ผลการค้นหาแสดงชื่อแรกเต็ม นามสกุลย่อ ชุมชน ซอย และข้อความ เจ้าหน้าที่ตรวจสอบรายการที่ไม่เหมาะสม')}</p></div></aside></div>`;
  let st; $('#soi').oninput = () => { clearTimeout(st); st = setTimeout(async () => { const o = await api('/api/geo/sois?n=10&q=' + encodeURIComponent($('#soi').value)).catch(() => []); $('#soiDL').innerHTML = o.map((x) => `<option value="${esc((LANG !== 'th' && x.en) || x.th)}">`).join(''); }, 200); };
  const find = async () => { const q = $('#sq').value.trim(); if ([...q].length < 2) { $('#sr').innerHTML = `<p class="hint">${T('safe.q.short', 'พิมพ์อย่างน้อย 2 ตัวอักษร')}</p>`; return; } const a = await api('/api/safe?q=' + encodeURIComponent(q));
    $('#sr').innerHTML = a.length ? `<ul class="recs">${a.map((x) => `<li class="rec"><div class="rec-h"><strong class="tag t-ok">${ico('ok')}${T('safe.is', 'ปลอดภัย')}</strong> ${x.verified ? '' : `<span class="tag">${T('vote.tag.wait', 'รอการยืนยัน')}</span>`}</div><h3 class="h-s">${esc(x.name)}</h3><p>${esc([x.areaName, x.soi].filter(Boolean).join(' · '))}</p>${x.message ? `<p>“${esc(x.message)}”</p>` : ''}<p class="hint">${fmt(x.at)}</p></li>`).join('')}</ul>` : inset(T('safe.none', 'ไม่พบชื่อนี้ ลองพิมพ์เฉพาะชื่อแรก หรือโทร 1337')); };
  $('#sb').onclick = find; $('#sq').addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), find()));
  $('#go').onclick = async () => { try { const r = await api('/api/safe', { method: 'POST', body: { name: $('#nm').value, areaId: $('#ar').value, soi: $('#soi').value, message: $('#ms').value, phone: $('#tl').value } });
    app.innerHTML = confirmPanel(T('safe.ok', 'บันทึกว่าคุณปลอดภัยแล้ว'), r.id, `<p>${r.public === false ? T('safe.held', 'รายการนี้รอเจ้าหน้าที่ตรวจก่อนแสดง') : T('safe.ok.p', 'ครอบครัวค้นหาชื่อคุณได้ที่หน้านี้แล้ว')}</p><p>${linkGo('#/safe?find=1', T('safe.back', 'กลับไปหน้าค้นหา'))}</p>`); } catch (e) { showErr($('#msg'), [['go', e.message]]); } };
}
async function historyPage(q) {
  const d0 = new Date(Date.now() + 7 * 3600e3 - 90 * 864e5).toISOString().slice(0, 10), d1 = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  app.innerHTML = head('list', 'hist.title', 'ซอยที่น้ำท่วมซ้ำ', 'hist.lead', 'รวมรายงานระดับน้ำจากประชาชนตามซอย เรียงจากจำนวนวันที่มีรายงานมากที่สุด ใช้วางแผนแก้ไขจุดท่วมซ้ำ') +
   `<div class="filt">${field('hf', T('hist.from', 'ตั้งแต่วันที่'), `<input id="hf" class="inp" type="date" value="${esc(q.from || d0)}">`)}${field('ht', T('hist.to', 'ถึงวันที่'), `<input id="ht" class="inp" type="date" value="${esc(q.to || d1)}">`)}<button type="button" class="btn" id="hg">${T('hist.go', 'แสดงผล')}</button> <a class="btn sec" id="hcsv" href="#">${ico('down')}CSV</a></div>
   <div class="vtog" role="group" aria-label="${T('atlas.view', 'รูปแบบการแสดงผล')}"><button type="button" data-v="list" aria-pressed="true">${ico('list')}${T('atlas.v.list', 'รายการ')}</button><button type="button" data-v="map" aria-pressed="false">${ico('map')}${T('atlas.v.map', 'แผนที่')}</button></div>
   <div id="hlist"></div><div id="hmapw" hidden><div id="map" style="height:60vh" role="region" aria-label="${T('hist.map', 'แผนที่ซอยที่น้ำท่วมซ้ำ')}"></div></div>`;
  const m = tiles(L.map('map').setView([12.928, 100.886], 13)), lay = L.layerGroup().addTo(m);
  const run = async () => { const f = $('#hf').value, t = $('#ht').value, qs = `from=${f}&to=${t}`; $('#hcsv').href = '/api/soi-history?format=csv&' + qs; const a = await api('/api/soi-history?' + qs);
    $('#hlist').innerHTML = a.length ? `<p class="cap">${a.length} ${T('hist.n', 'ซอย/ถนน')}</p><div class="tblw"><table class="tbl"><thead><tr><th scope="col">#</th><th scope="col">${T('loc.soi', 'ซอย / ถนน')}</th><th scope="col">${T('hist.days', 'จำนวนวันที่ท่วม')}</th><th scope="col">${T('hist.cnt', 'รายงาน')}</th><th scope="col">${T('hist.max', 'สูงสุด')}</th><th scope="col">${T('hist.last', 'ล่าสุด')}</th></tr></thead><tbody>${a.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(pN(r, 'soi'))}</b>${r.road ? `<br><small class="muted">${esc(r.road)}</small>` : ''}</td><td><b>${r.days}</b></td><td>${r.count}</td><td>${depthTag(r.maxLevel, r.maxLevelText)}</td><td>${fmt(r.last)}</td></tr>`).join('')}</tbody></table></div>` : inset(T('hist.none', 'ไม่มีรายงานในช่วงวันที่นี้'));
    lay.clearLayers(); const mx = Math.max(1, ...a.map((r) => r.days)); a.forEach((r) => L.circleMarker([r.lat, r.lng], { radius: 6 + 14 * (r.days / mx), color: '#111a24', weight: 1, fillColor: LVCOL[r.maxLevel] || '#1a56b8', fillOpacity: 0.75 }).addTo(lay).bindPopup(`<b>${esc(pN(r, 'soi'))}</b><br>${r.days} ${T('hist.dayu', 'วัน')} · ${r.count} ${T('hist.cnt', 'รายงาน')}<br>${esc(r.maxLevelText)}`)); };
  $('#hg').onclick = run; await run();
  const vt = app.querySelector('.vtog'); vt.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; vt.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('#hlist').hidden = b.dataset.v !== 'list'; $('#hmapw').hidden = b.dataset.v !== 'map'; setTimeout(() => m.invalidateSize(), 60); };
}
void [T('shel.saved', 'บันทึกแล้ว'), T('shel.title', 'ศูนย์พักพิง'), T('shel.lead', 'ที่ว่างในแต่ละศูนย์อัปเดตโดยเจ้าหน้าที่ ก่อนเดินทางควรโทรยืนยัน ถ้าต้องการให้ทีมไปรับ ให้ขอความช่วยเหลือ'), T('safe.title', 'ฉันปลอดภัย'), T('safe.lead', 'บอกครอบครัวและเพื่อนว่าคุณปลอดภัย คนอื่นค้นหาจากชื่อได้ ระบบจะแสดงชื่อแบบย่อ และไม่แสดงเบอร์โทร'), T('hist.title', 'ซอยที่น้ำท่วมซ้ำ'), T('hist.lead', 'รวมรายงานระดับน้ำจากประชาชนตามซอย เรียงจากจำนวนวันที่มีรายงานมากที่สุด ใช้วางแผนแก้ไขจุดท่วมซ้ำ')];
// ================= flood-avoidance routing (in-app OSM graph, vehicles, alternatives, live re-check) =================
const VEHS = () => [['walk', T('rt.v.walk', 'เดินเท้า'), 40], ['moto', T('rt.v.moto', 'จักรยานยนต์'), 30], ['car', T('rt.v.car', 'รถยนต์'), 30], ['truck', T('rt.v.truck', 'รถยกสูง / กู้ภัย'), 80]];
const RCOL = ['#1a7f37', '#d4a017', '#e8590c', '#c92a2a'], HZR = { ankle: 120, knee: 180, waist: 250, chest: 300, roof: 350 };
const DEPTH = () => ({ ankle: T('rt.d.ankle', 'น้ำระดับข้อเท้า'), knee: T('rt.d.knee', 'น้ำระดับเข่า'), waist: T('rt.d.waist', 'น้ำระดับเอว'), chest: T('rt.d.chest', 'น้ำระดับอก'), roof: T('rt.d.roof', 'น้ำท่วมมิดศีรษะ') });
const plName = (w) => esc(LANG === 'th' ? w.soi || w.road : w.soiEn || w.roadEn || w.soi || w.road);
function wText(w) { const p = plName(w), near = p ? ` ${T('rt.w.near', 'ใกล้')} ${p}` : '';
  if (w.type === 'closed') return `${T('rt.w.closed', 'ถนนปิด')}${w.title ? ': ' + esc(w.title) : ''}${near}`;
  if (w.type === 'repeat') return `${T('rt.w.repeat', 'ซอยที่น้ำท่วมซ้ำบ่อย')}${near}`;
  return `${DEPTH()[w.level] || ''}${near}${w.impassable ? ` — ${T('rt.w.block', 'ลึกเกินกว่าที่ยานพาหนะนี้ผ่านได้')}` : ''}`; }
const pll = (s) => { const [a, b] = String(s || '').split(',').map(Number); return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null; };
const ll = (p) => p[0].toFixed(5) + ',' + p[1].toFixed(5);
async function routePage(q) {
  let from = pll(q.f), to = pll(q.t), veh = VEHS().some((v) => v[0] === q.v) ? q.v : 'car', mode = from ? 'b' : 'a', res = null, sel = 0, target = null; const ref = (q.ref || '').replace(/[^\w-]/g, '').slice(0, 20);
  app.innerHTML = head('map', 'rt.title', 'เส้นทางเลี่ยงน้ำท่วม', 'rt.lead', 'คำนวณบนโครงข่ายถนนของพัทยา หลบจุดที่ประชาชนแจ้งน้ำท่วม ถนนปิด และซอยที่ท่วมซ้ำ ตามความลึกที่ยานพาหนะแต่ละแบบผ่านได้') +
   `${ref ? `<div class="notice info rt-staff" role="note"><p class="notice-h">${T('rt.staff.h', 'เส้นทางรถกู้ภัย')}</p><p>${T('rt.staff.p', 'จากตำแหน่งทีมไปยังคำขอ')} <b>${esc(ref)}</b></p></div>` : ''}
   <div class="atlas rt"><div class="atlas-map"><div id="map" role="region" aria-label="${T('rt.map', 'แผนที่เส้นทาง')}"></div>
    <ul class="rt-key">${[T('rt.k0', 'ไม่มีความเสี่ยง'), T('rt.k1', 'เสี่ยงต่ำ'), T('rt.k2', 'เสี่ยงปานกลาง'), T('rt.k3', 'ผ่านไม่ได้')].map((t, i) => `<li><i style="background:${RCOL[i]}"></i>${t}</li>`).join('')}</ul></div>
   <div class="atlas-side"><fieldset class="rt-veh"><legend class="lbl">${T('rt.veh', 'ยานพาหนะ')}</legend>${VEHS().map(([k, t, cm]) => `<label class="chip ${k === veh ? 'on' : ''}"><input type="radio" name="veh" value="${k}" ${k === veh ? 'checked' : ''}> ${t} <small>≤${cm} ${T('rt.cm', 'ซม.')}</small></label>`).join('')}</fieldset>
    <div class="btnrow"><button type="button" class="btn sec sm ${mode === 'a' ? 'on' : ''}" id="rA">${T('rt.from', 'จุดเริ่ม')}: <span id="rAv">${from ? T('rt.set', 'ตั้งแล้ว') : T('rt.tap', 'แตะแผนที่')}</span></button><button type="button" class="btn sec sm" id="rG">${ico('target')}${T('atlas.r.gps', 'ตำแหน่งของฉัน')}</button><button type="button" class="btn sec sm ${mode === 'b' ? 'on' : ''}" id="rB">${T('rt.to', 'ปลายทาง')}: <span id="rBv">${to ? T('rt.set', 'ตั้งแล้ว') : T('rt.tap', 'แตะแผนที่')}</span></button></div>
    <div class="btnrow"><button type="button" class="btn" id="rGo">${T('rt.go', 'หาเส้นทาง')}</button><button type="button" class="btn sec" id="rShel">${T('rt.shel', 'ศูนย์พักพิงใกล้สุด')}</button><button type="button" class="btn sec" id="rHosp">${T('rt.hosp', 'โรงพยาบาลใกล้สุด')}</button></div>
    <div id="rAlert" aria-live="assertive"></div><div id="rMsg" aria-live="polite"></div><ol class="rt-alts" id="rAlts"></ol><div id="rWarn"></div><div id="rShare"></div>
    <p class="hint" id="rSrc"></p></div></div>`;
  const m = tiles(L.map('map').setView([12.93, 100.89], 14)), hzL = L.layerGroup().addTo(m), rL = L.layerGroup().addTo(m), pL = L.layerGroup().addTo(m);
  const pin = (p, t) => L.marker(p, { icon: L.divIcon({ className: '', html: `<i class="rt-pin ${t}">${t === 'a' ? 'A' : 'B'}</i>`, iconSize: [26, 26] }) }).addTo(pL);
  const pins = () => { pL.clearLayers(); from && pin(from, 'a'); to && pin(to, 'b'); $('#rAv').textContent = from ? TX('rt.set', 'ตั้งแล้ว') : TX('rt.tap', 'แตะแผนที่'); $('#rBv').textContent = to ? TX('rt.set', 'ตั้งแล้ว') : TX('rt.tap', 'แตะแผนที่'); };
  const setMode = (k) => { mode = k; $('#rA').classList.toggle('on', k === 'a'); $('#rB').classList.toggle('on', k === 'b'); };
  const drawHz = (hz) => { hzL.clearLayers(); for (const h of hz) { if (h.type === 'closed' && h.points) L.polyline(h.points, { color: '#111', weight: 6, dashArray: '6 6' }).addTo(hzL).bindTooltip(wText(h));
    else if (h.type === 'report') L.circle([h.lat, h.lng], { radius: h.rM, color: '#1a56b8', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12 + 0.25 * h.decay }).addTo(hzL).bindTooltip(wText(h));
    else if (h.type === 'repeat') L.circle([h.lat, h.lng], { radius: h.rM, color: '#7c3aed', weight: 1, dashArray: '3 4', fillOpacity: 0.05 }).addTo(hzL).bindTooltip(wText(h)); } };
  const share = () => location.origin + '/#/route?f=' + ll(from) + '&t=' + ll(to) + '&v=' + veh + (ref ? '&ref=' + ref : '');
  const show = () => { rL.clearLayers(); if (!res) return; const rs = res.routes;
    rs.forEach((r, i) => { if (i !== sel) L.polyline(r.coords, { color: '#6b7280', weight: 5, opacity: 0.55 }).addTo(rL).on('click', () => { sel = i; show(); }); });
    const r = rs[sel]; L.polyline(r.coords, { color: '#fff', weight: 10, opacity: 0.9 }).addTo(rL); r.segments.forEach((s) => L.polyline(s.coords, { color: s.color, weight: 6 }).addTo(rL));
    r.warnings.forEach((w) => L.circleMarker([w.lat, w.lng], { radius: 7, color: '#fff', weight: 2, fillColor: RCOL[w.risk], fillOpacity: 1 }).addTo(rL).bindTooltip(wText(w)));
    const TG = { safest: T('rt.tag.safest', 'ปลอดภัยที่สุด'), fastest: T('rt.tag.fastest', 'เร็วที่สุด'), alt: T('rt.tag.alt', 'ทางเลือก') };
    $('#rAlts').innerHTML = rs.map((x, i) => `<li class="rt-alt ${i === sel ? 'on' : ''}"><button type="button" data-i="${i}" aria-pressed="${i === sel}"><span class="rt-tags">${x.tags.map((t) => `<b class="tg ${t}">${TG[t]}</b>`).join('')}</span>
      <span class="rt-n"><b>${(x.distance / 1000).toFixed(1)}</b> ${T('atlas.r.km', 'กม.')} · <b>${Math.max(1, Math.round(x.duration / 60))}</b> ${T('rt.min', 'นาที')} · <b class="${x.riskPoints ? 'bad' : 'ok'}">${x.riskPoints}</b> ${T('rt.risk', 'จุดเสี่ยง')}</span>${x.via.length ? `<span class="muted">${T('rt.via', 'ผ่าน')} ${x.via.slice(0, 3).map(esc).join(' · ')}</span>` : ''}</button></li>`).join('');
    $('#rWarn').innerHTML = `<h2 class="h-s">${T('rt.warns', 'คำเตือนตามเส้นทาง')}</h2>${r.warnings.length ? `<ol class="rt-w">${r.warnings.map((w) => `<li><i style="background:${RCOL[w.risk]}"></i><span>${wText(w)}</span><small>${(w.at / 1000).toFixed(1)} ${T('atlas.r.km', 'กม.')}</small></li>`).join('')}</ol>` : `<p class="ok">${T('rt.clear', 'เส้นทางนี้ไม่ผ่านจุดที่มีรายงานน้ำท่วมหรือถนนปิด')}</p>`}
      ${r.impassable ? warnText(T('rt.noavoid', 'ไม่มีเส้นทางที่เลี่ยงจุดน้ำลึกได้ทั้งหมดสำหรับยานพาหนะนี้ — เลือกยานพาหนะอื่นหรือขอความช่วยเหลือ')) : ''}`;
    $('#rShare').innerHTML = `<div class="btnrow"><a class="btn sec" id="rGm" href="${esc(r.gmaps)}" target="_blank" rel="noopener">${T('rt.gmaps', 'เปิดใน Google Maps')}</a><button type="button" class="btn sec" id="rCp">${T('rt.copy', 'คัดลอกลิงก์เส้นทาง')}</button></div><input class="inp" id="rUrl" readonly value="${esc(share())}" aria-label="${T('rt.link', 'ลิงก์เส้นทาง')}"><p class="hint">${T('rt.gm.h', 'Google Maps ใช้จุดผ่านเพื่อประมาณเส้นทางนี้ และไม่รู้จุดน้ำท่วม ตรวจคำเตือนก่อนออกเดินทาง')}</p>`;
    $('#rCp').onclick = async () => { $('#rUrl').select(); try { await navigator.clipboard.writeText(share()); } catch { document.execCommand && document.execCommand('copy'); } $('#rCp').textContent = TX('rt.copied', 'คัดลอกแล้ว'); };
    $('#rAlts').querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { sel = +b.dataset.i; show(); }));
  };
  const done = (j) => { res = j; sel = 0; to = j.to; from = j.from; pins(); drawHz(j.hazards); show(); $('#rAlert').innerHTML = '';
    $('#rMsg').innerHTML = target ? `<p class="rt-tgt">${ico('pin')}<b>${esc(LANG === 'th' ? target.name : target.nameEn || target.name)}</b>${target.available != null ? ` · ${target.available} ${T('shel.free', 'ที่ว่าง')}` : ''}${target.phone ? ` · <a href="tel:${esc(target.phone)}">${esc(target.phone)}</a>` : ''}</p>` : '';
    $('#rSrc').innerHTML = `${T('rt.src', 'ข้อมูลถนน © ผู้ร่วมพัฒนา OpenStreetMap')} (${esc((j.graph?.osmBase || '').slice(0, 10))}) · ${T('rt.heur', 'ความลึกที่ผ่านได้เป็นค่าประมาณ อย่าขับหรือเดินลุยน้ำที่มองไม่เห็นพื้น')}`;
    history.replaceState(null, '', '#/route?f=' + ll(from) + '&t=' + ll(to) + '&v=' + veh + (ref ? '&ref=' + ref : ''));
    m.fitBounds(L.latLngBounds(j.routes.flatMap((r) => r.coords)).pad(0.12)); };
  const fail = (e) => { $('#rMsg').innerHTML = `<p class="err" role="alert">${esc(e.message)}</p>`; };
  const go = async () => { if (!from || !to) return fail(new Error(TX('rt.need', 'เลือกจุดเริ่มและปลายทางบนแผนที่ก่อน'))); target = null; $('#rMsg').innerHTML = `<p class="muted">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</p>`; try { done(await api(`/api/route2?from=${ll(from)}&to=${ll(to)}&veh=${veh}`)); } catch (e) { fail(e); } };
  const nearest = async (type) => { try { if (!from) from = await gps(); pins(); $('#rMsg').innerHTML = `<p class="muted">${T('ui.wait', 'กำลังโหลดข้อมูล…')}</p>`; const j = await api(`/api/route2/nearest?from=${ll(from)}&veh=${veh}&type=${type}`); target = j.target; done(j); } catch (e) { fail(e); } };
  $('#rA').onclick = () => setMode('a'); $('#rB').onclick = () => setMode('b');
  $('#rG').onclick = async () => { try { from = await gps(); pins(); setMode('b'); m.setView(from, 15); if (to) go(); } catch (e) { fail(e); } };
  m.on('click', (e) => { const p = [e.latlng.lat, e.latlng.lng]; if (mode === 'a') { from = p; setMode('b'); } else to = p; pins(); if (from && to) go(); });
  app.querySelectorAll('[name=veh]').forEach((r) => (r.onchange = () => { veh = r.value; app.querySelectorAll('.rt-veh .chip').forEach((c) => c.classList.toggle('on', c.querySelector('input').checked)); if (target) nearest(target.type); else if (from && to) go(); }));
  $('#rGo').onclick = go; $('#rShel').onclick = () => nearest('shelter'); $('#rHosp').onclick = () => nearest('hospital');
  api('/api/route2/hazards').then((hz) => !res && drawHz(hz)).catch(() => {}); pins(); setTimeout(() => m.invalidateSize(), 100);
  if (from && to) await go(); else if (ref && !from) gps().then((p) => { from = p; pins(); go(); }).catch(() => setMode('a'));
  // live re-check: new reports / closures that touch the current route → alert + one-tap reroute
  const near = (lat, lng, rM) => res && res.routes[sel].coords.some(([a, b]) => km(a, b, lat, lng) * 1000 < rM);
  const known = () => new Set((res?.hazards || []).map((h) => h.id));
  const alertRe = (why) => { $('#rAlert').innerHTML = `<div class="notice warn rt-re" role="alert"><p class="notice-h">${T('rt.re.h', 'มีข้อมูลใหม่บนเส้นทางของคุณ')}</p><p>${why}</p><button type="button" class="btn" id="rRe">${T('rt.re.btn', 'คำนวณเส้นทางใหม่')}</button></div>`; $('#rRe').onclick = () => (target ? nearest(target.type) : go()); };
  on((t, d) => { if (!res) return;
    if (t === 'report' && d && !d.gone && !d.cleared && HZR[d.level] && !known().has(d.id) && near(d.lat, d.lng, HZR[d.level])) alertRe(wText({ ...d, type: 'report' }));
    if (t === 'roads' && Array.isArray(d)) { const k = known(); const w = d.find((x) => x.type === 'closed' && !k.has(x.id) && (x.points || []).some(([a, b]) => near(a, b, 40))); if (w) alertRe(wText({ ...w, type: 'closed' })); } });
}
void [T('rt.set', 'ตั้งแล้ว'), T('rt.tap', 'แตะแผนที่'), T('rt.copied', 'คัดลอกแล้ว'), T('rt.need', 'เลือกจุดเริ่มและปลายทางบนแผนที่ก่อน'), T('rt.title', 'เส้นทางเลี่ยงน้ำท่วม'), T('rt.lead', 'คำนวณบนโครงข่ายถนนของพัทยา หลบจุดที่ประชาชนแจ้งน้ำท่วม ถนนปิด และซอยที่ท่วมซ้ำ ตามความลึกที่ยานพาหนะแต่ละแบบผ่านได้')];
