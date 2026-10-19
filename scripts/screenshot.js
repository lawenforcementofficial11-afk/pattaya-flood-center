// ใช้: npm i -D playwright && npx playwright install chromium && BASE=http://localhost:3600 node scripts/screenshot.js
// ภาพหน้าจอดีไซน์ B: new-home-mobile / new-home-desktop / new-map / new-report-form (+ new-report-check) / new-help (+ new-levels)
let pw; try { pw = require('playwright'); } catch { pw = require('/tmp/pw/node_modules/playwright'); }
const B = process.env.BASE || 'http://localhost:3600', out = process.env.OUT || require('path').join(__dirname, '..');
(async () => {
  const br = await pw.chromium.launch(), errs = [];
  const ready = async (p) => { await p.waitForSelector('#alertbar .ab-num', { timeout: 40000 }); await p.waitForSelector('#sum .sl', { timeout: 40000 }); await p.waitForSelector('#wl .inset, #wl .tbl, #wl .err', { timeout: 40000, state: 'attached' }); await p.waitForTimeout(2500); };
  const m = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'th-TH' });
  m.on('pageerror', (e) => errs.push('mobile: ' + e.message));
  await m.goto(B + '/#/'); await ready(m);
  await m.screenshot({ path: out + '/new-home-mobile.png', fullPage: true });
  await m.goto(B + '/#/help?kind=evacuate'); await m.waitForSelector('#wz .step'); await m.waitForTimeout(1500);
  await m.screenshot({ path: out + '/new-help.png', fullPage: true });
  const d = await br.newPage({ viewport: { width: 1366, height: 900 }, locale: 'th-TH' });
  d.on('pageerror', (e) => errs.push('desktop: ' + e.message));
  await d.goto(B + '/#/'); await ready(d);
  await d.screenshot({ path: out + '/new-home-desktop.png', fullPage: true });
  await d.goto(B + '/#/map?demo=1'); await d.waitForSelector('#rOut .cp, #rOut .wt, #rOut .inset, #rOut .err', { timeout: 40000 }); await d.waitForTimeout(2500);
  await d.screenshot({ path: out + '/new-map.png' });
  await d.goto(B + '/#/report'); await d.waitForSelector('#lv input'); await d.check('#lv-knee'); await d.waitForTimeout(300);
  await d.screenshot({ path: out + '/new-report-form.png', fullPage: true });
  await d.click('.step[data-k="0"] [data-next]'); await d.waitForTimeout(500); await d.selectOption('#ar', { index: 3 }); await d.waitForTimeout(600);
  await d.click('.step[data-k="1"] [data-next]'); await d.fill('#nt', 'ตัวอย่าง: น้ำไหลแรงหน้าตลาด'); await d.click('.step[data-k="2"] [data-next]'); await d.waitForTimeout(500);
  await d.screenshot({ path: out + '/new-report-check.png', fullPage: true });
  await d.goto(B + '/#/levels'); await d.waitForSelector('.lvls'); await d.waitForTimeout(600);
  await d.screenshot({ path: out + '/new-levels.png', fullPage: true });
  await br.close(); console.log(errs.length ? 'page errors:\n' + errs.join('\n') : 'ok (no page errors)');
})().catch((e) => { console.error(e); process.exit(1); });
