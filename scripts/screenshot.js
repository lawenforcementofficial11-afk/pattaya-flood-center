// ใช้: npm i -D playwright && npx playwright install chromium && node scripts/screenshot.js
let pw; try { pw = require('playwright'); } catch { pw = require('/tmp/pw/node_modules/playwright'); }
const B = process.env.BASE || 'http://localhost:3600', out = require('path').join(__dirname, '..');
(async () => {
  const br = await pw.chromium.launch();
  const m = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await m.goto(B + '/#/'); await m.waitForSelector('#wl .st, #wl .err', { timeout: 40000 }); await m.waitForTimeout(1500);
  await m.screenshot({ path: out + '/screenshot-mobile.png', fullPage: true });
  const d = await br.newPage({ viewport: { width: 1366, height: 1000 } });
  await d.goto(B + '/#/map?demo=1'); await d.waitForSelector('#rOut .good, #rOut .warn, #rOut .err', { timeout: 40000 }); await d.waitForTimeout(2500);
  await d.screenshot({ path: out + '/screenshot-desktop.png', fullPage: true });
  await d.goto(B + '/#/staff'); await d.fill('#nm', 'ทีมทดสอบ'); await d.fill('#pw', process.env.STAFF_PASSWORD || 'pattaya1337'); await d.click('#go'); await d.waitForSelector('table'); await d.waitForTimeout(800);
  await d.screenshot({ path: out + '/screenshot-staff.png', fullPage: true });
  await br.close(); console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
