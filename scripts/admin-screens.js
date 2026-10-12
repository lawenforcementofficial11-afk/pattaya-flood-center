// ใช้: BASE=http://localhost:3600 STAFF_PASSWORD=... node scripts/admin-screens.js
let pw; try { pw = require('playwright'); } catch { pw = require('/tmp/pw/node_modules/playwright'); }
const B = process.env.BASE || 'http://localhost:3600', out = require('path').join(__dirname, '..');
(async () => {
  const br = await pw.chromium.launch();
  const d = await br.newPage({ viewport: { width: 1280, height: 900 } });
  await d.goto(B + '/admin'); await d.fill('#un', 'admin'); await d.fill('#pw', process.env.STAFF_PASSWORD || 'pattaya1337'); await d.click('#go');
  await d.waitForSelector('.stats'); await d.waitForTimeout(800); await d.screenshot({ path: out + '/admin-dashboard.png', fullPage: true });
  await d.goto(B + '/admin#c/requests'); await d.waitForSelector('#tb tr'); await d.click('.ed'); await d.waitForSelector('.modal'); await d.waitForTimeout(400); await d.screenshot({ path: out + '/admin-requests.png' });
  await d.goto(B + '/admin#texts'); await d.waitForSelector('.kv'); await d.fill('#q', 'home.food'); await d.waitForTimeout(400); await d.screenshot({ path: out + '/admin-texts.png', fullPage: true });
  await d.goto(B + '/admin#users'); await d.waitForSelector('tbody tr'); await d.waitForTimeout(400); await d.screenshot({ path: out + '/admin-users.png', fullPage: true });
  await d.goto(B + '/admin#settings'); await d.waitForSelector('#secs li'); await d.waitForTimeout(2500); await d.screenshot({ path: out + '/admin-settings.png' });
  await d.goto(B + '/admin#ptycctv'); await d.waitForSelector('#tb tr', { timeout: 30000 }); await d.waitForTimeout(2000); await d.screenshot({ path: out + '/admin-cctv-manage.png' });
  const m = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await m.goto(B + '/admin'); await m.fill('#un', 'admin'); await m.fill('#pw', process.env.STAFF_PASSWORD || 'pattaya1337'); await m.click('#go'); await m.waitForSelector('.stats'); await m.waitForTimeout(800);
  await m.screenshot({ path: out + '/admin-dashboard-mobile.png', fullPage: true });
  await m.goto(B + '/#/cctv'); await m.waitForSelector('#cl li', { timeout: 30000 }); await m.waitForTimeout(3500); await m.screenshot({ path: out + '/admin-cctv-public.png' });
  await m.goto(B + '/#/'); await m.waitForSelector('.sec'); await m.waitForTimeout(1500); await m.screenshot({ path: out + '/admin-home-preview.png' });
  await br.close(); console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
