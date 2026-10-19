// Smoke test: จุดบริการ & รับบริจาค (staff duty points). LOCAL instances only.
// BASE=http://localhost:5811 ADMIN_PW=pattaya1337 OUT=/path/for/screenshots node scripts/points-smoke.js
let pw; try { pw = require('playwright'); } catch { pw = require('/tmp/pw/node_modules/playwright'); }
const B = process.env.BASE || 'http://localhost:5811', OUT = process.env.OUT || require('path').join(__dirname, '..'), APW = process.env.ADMIN_PW || 'pattaya1337', AUSER = process.env.ADMIN_USER || 'admin';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(B)) { console.error('refusing non-local BASE ' + B); process.exit(2); }
const res = []; const T = async (n, f) => { try { const r = await f(); res.push(['PASS', n, r || '']); console.log('PASS', n, r || ''); } catch (e) { res.push(['FAIL', n, e.message]); console.log('FAIL', n, e.message.split('\n')[0]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const call = async (u, o = {}, tok) => { const r = await fetch(B + u, { method: o.method || 'GET', headers: { 'content-type': 'application/json', ...(tok ? { 'x-staff-token': tok } : {}) }, body: o.body && JSON.stringify(o.body) }); return { s: r.status, j: await r.json().catch(() => null) }; };
(async () => {
  let A, S, P1, P2;
  await T('admin login', async () => { const r = await call('/api/staff/login', { method: 'POST', body: { username: AUSER, password: APW } }); ok(r.s === 200, r.s); A = r.j.token; });
  await T('public GET /api/points is an array', async () => { const r = await call('/api/points'); ok(Array.isArray(r.j), 'not array'); return r.j.length + ' points'; });
  await T('admin creates point (soi/road/landmark auto-filled)', async () => {
    const r = await call('/api/admin/c/points', { method: 'POST', body: { name: 'SMOKE จุดเจ้าหน้าที่ แยกพัทยากลาง', staff: 6, needs: 'น้ำดื่ม, ข้าวกล่อง', phone: '038-253-100', hours: '08:00–20:00', lat: 12.9342, lng: 100.8889 } }, A);
    ok(r.s === 200, JSON.stringify(r.j)); P1 = r.j.item; const p = (await call('/api/points')).j.find((x) => x.id === P1.id); ok(p && (p.soi || p.road), 'no place ' + JSON.stringify(p)); return `${p.id} · ${p.soi || ''} ${p.road || ''} · ${p.landmark || ''}`; });
  await T('second point (closed) created', async () => { const r = await call('/api/admin/c/points', { method: 'POST', body: { name: 'SMOKE จุดเจ้าหน้าที่ จอมเทียน', staff: 2, needs: '', phone: '1337', lat: 12.8935, lng: 100.8762 } }, A); ok(r.s === 200, r.s); P2 = r.j.item;
    ok((await call(`/api/admin/c/points/${P2.id}`, { method: 'PUT', body: { status: 'closed' } }, A)).s === 200, 'close'); });
  await T('Koh Larn / outside the city is rejected (mainland only)', async () => { const r = await call('/api/admin/c/points', { method: 'POST', body: { name: 'SMOKE เกาะล้าน', lat: 12.9195, lng: 100.7785 } }, A); ok(r.s === 400, 'got ' + r.s); });
  await T('create staff user + login', async () => { await call('/api/admin/users', { method: 'POST', body: { username: 'smoke.pt', name: 'สมชาย เจ้าหน้าที่', role: 'staff', password: 'smokepass123' } }, A); const r = await call('/api/staff/login', { method: 'POST', body: { username: 'smoke.pt', password: 'smokepass123' } }); ok(r.s === 200, r.s); S = r.j.token; });
  await T('permissions: anon quick-edit 401, staff create/delete 403, staff hide 403', async () => {
    ok((await call(`/api/points/${P1.id}/quick`, { method: 'PATCH', body: { staff: 1 } })).s === 401, 'anon');
    ok((await call('/api/admin/c/points', { method: 'POST', body: { name: 'x', lat: 12.93, lng: 100.88 } }, S)).s === 403, 'staff create');
    ok((await call(`/api/admin/c/points/${P1.id}`, { method: 'DELETE' }, S)).s === 403, 'staff delete');
    ok((await call(`/api/points/${P1.id}/quick`, { method: 'PATCH', body: { status: 'hidden' } }, S)).s === 403, 'staff hide');
    ok((await call(`/api/points/${P1.id}/quick`, { method: 'PATCH', body: { staff: -3 } }, S)).s === 400, 'negative'); });
  await T('SSE broadcasts "points" on quick update; staff quick edit + audit entry', async () => {
    const ac = new AbortController(); const r = await fetch(B + '/api/events', { signal: ac.signal }); const rd = r.body.getReader(); let buf = '';
    const got = (async () => { while (!/event: points/.test(buf)) { const { value, done } = await rd.read(); if (done) break; buf += Buffer.from(value).toString(); } return /event: points/.test(buf); })();
    await new Promise((z) => setTimeout(z, 300));
    const q = await call(`/api/points/${P1.id}/quick`, { method: 'PATCH', body: { staff: 8, needs: 'น้ำดื่ม 2 แพ็ก, ข้าวกล่อง', status: 'open' } }, S); ok(q.s === 200 && q.j.item.staff === 8, JSON.stringify(q.j));
    const sse = await Promise.race([got, new Promise((z) => setTimeout(() => z(false), 4000))]); ac.abort(); ok(sse, 'no SSE points event');
    const au = (await call('/api/admin/audit', {}, A)).j.find((x) => x.action === 'point-quick' && x.id === P1.id); ok(au && /8/.test(au.detail), 'no audit'); return au.detail; });
  await T('public output: no staff names / updatedBy, closed point flagged', async () => { const a = (await call('/api/points')).j, s = JSON.stringify(a); ok(!/สมชาย|updatedBy|smoke\.pt/.test(s), 'leaks staff name'); ok(a.find((x) => x.id === P2.id)?.status === 'closed', 'closed'); });
  await T('admin hides point → gone from public, back office audit has create/update', async () => { const h = await call('/api/admin/c/points', { method: 'POST', body: { name: 'SMOKE hidden', lat: 12.93, lng: 100.885 } }, A); await call(`/api/admin/c/points/${h.j.item.id}`, { method: 'PUT', body: { status: 'hidden' } }, A);
    ok(!(await call('/api/points')).j.some((x) => x.id === h.j.item.id), 'hidden visible'); const au = (await call('/api/admin/audit', {}, A)).j.filter((x) => x.coll === 'points'); ok(au.some((x) => x.action === 'create') && au.some((x) => x.action === 'update'), 'audit'); await call(`/api/admin/c/points/${h.j.item.id}`, { method: 'DELETE' }, A); return au.length + ' audit rows for points'; });
  // ---------- UI ----------
  const br = await pw.chromium.launch(), errs = [];
  const m = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'th-TH' }); m.on('pageerror', (e) => errs.push('mobile: ' + e.message));
  await T('UI: home page has no points on its map; nav/menu has the link', async () => { await m.goto(B + '/#/'); await m.waitForSelector('#hero[class*=tier]', { timeout: 20000 }); await m.waitForTimeout(1500); ok(!(await m.locator('.ptmk').count()), 'points on home map');
    ok(await m.locator('#rnav a[href="#/points"]').count(), 'no rail link'); await m.goto(B + '/#/more'); await m.waitForSelector('.mlist a[href="#/points"]'); });
  await T('UI: /#/points mobile — map markers, cards, needs, tel, Google Maps, money note, filter chip', async () => {
    await m.goto(B + '/#/points'); await m.waitForSelector('#ptl .ptc'); await m.waitForTimeout(2500);
    ok(await m.locator('.leaflet-marker-icon .ptmk').count() >= 2, 'markers'); ok(/ไม่รับเงิน/.test(await m.locator('.pts-money').innerText()), 'money note');
    const c = m.locator('#ptl .ptc.open', { hasText: 'SMOKE จุดเจ้าหน้าที่ แยกพัทยากลาง' }); ok(/น้ำดื่ม 2 แพ็ก/.test(await c.innerText()), 'needs'); ok(/^tel:\d+/.test(await c.locator('a[href^="tel:"]').getAttribute('href')), 'tel');
    ok(/google\.com\/maps\/dir/.test(await c.locator('a[href*="google.com/maps"]').getAttribute('href')), 'gmaps'); ok(/8/.test(await c.locator('.shav').innerText()), 'staff count');
    ok(!/news|ข่าว/i.test(await m.locator('#app').innerHTML()), 'news link'); ok(await m.locator('.foot .credit').count(), 'footer credit');
    await m.screenshot({ path: OUT + '/donate-page-mobile.png', fullPage: true });
    await m.click('.pts-filt [data-f=open]'); const n = await m.locator('#ptl .ptc').count(); ok(!(await m.locator('#ptl .ptc.closed').count()), 'filter'); await m.click('.pts-filt [data-f=all]'); return n + ' open shown after filter'; });
  await T('UI: marker popup (point card on map)', async () => { await m.locator('#ptl .ptc.open [data-z]').first().click(); await m.waitForTimeout(1200); await m.locator('.leaflet-marker-icon .ptmk.open').first().click({ force: true }); await m.waitForSelector('.leaflet-popup-content'); const t = await m.locator('.leaflet-popup-content').innerText(); ok(/นำทาง/.test(t) && /โทร/.test(t), t);
    await m.screenshot({ path: OUT + '/donate-popup-mobile.png' }); });
  const s = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'th-TH' }); s.on('pageerror', (e) => errs.push('staff: ' + e.message));
  await T('UI: /#/staff → จุดเจ้าหน้าที่ tab: + tap, needs, close, save → public updated', async () => {
    await s.goto(B + '/#/staff'); await s.fill('#un', 'smoke.pt'); await s.fill('#pw', 'smokepass123'); await s.click('#go'); await s.waitForSelector('[data-tab=points]'); await s.click('[data-tab=points]'); await s.waitForSelector('.ptqi');
    const li = s.locator(`.ptqi[data-pid="${P1.id}"]`); await li.locator('.step[data-d="1"]').click(); await li.locator('.step[data-d="1"]').click(); await li.locator('.pneed').fill('น้ำดื่ม, ข้าวกล่อง 20 กล่อง');
    await s.screenshot({ path: OUT + '/donate-staff-update.png', fullPage: true });
    await li.locator('.psave').click(); await s.waitForTimeout(1200); const p = (await call('/api/points')).j.find((x) => x.id === P1.id); ok(p.staff === 10 && /20 กล่อง/.test(p.needs), JSON.stringify(p));
    const li2 = s.locator(`.ptqi[data-pid="${P2.id}"]`); await li2.locator('[data-s=open]').click(); await li2.locator('.psave').click(); await s.waitForTimeout(1200); ok((await call('/api/points')).j.find((x) => x.id === P2.id).status === 'open', 'reopen'); return 'staff=10, needs saved, P2 reopened'; });
  await T('UI: public page updates live via SSE', async () => { await m.goto(B + '/#/points'); await m.waitForSelector('#ptl .ptc'); await call(`/api/points/${P1.id}/quick`, { method: 'PATCH', body: { staff: 11 } }, S); await m.waitForFunction(() => /11/.test(document.querySelector('#ptl').innerText), null, { timeout: 5000 }); });
  await T('no page errors', async () => { ok(!errs.length, errs.join(' | ')); });
  await br.close();
  // cleanup smoke data
  for (const p of [P1, P2]) if (p) await call(`/api/admin/c/points/${p.id}`, { method: 'DELETE' }, A);
  const f = res.filter((r) => r[0] === 'FAIL').length; console.log(`\n${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
