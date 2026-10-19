// ใช้: npm i -D playwright && npx playwright install chromium && BASE=http://localhost:3600 node scripts/screenshot.js
// ถ่ายภาพหน้าจอดีไซน์ใหม่ (v3): new-home-mobile / new-home-desktop / new-map / new-report-form / new-help
let pw; try { pw = require('playwright'); } catch { pw = require('/tmp/pw/node_modules/playwright'); }
const B = process.env.BASE || 'http://localhost:3600', out = require('path').join(__dirname, '..');
(async () => {
  const br = await pw.chromium.launch(), errs = [];
  const m = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'th-TH' });
  m.on('pageerror', (e) => errs.push('mobile: ' + e.message));
  await m.goto(B + '/#/'); await m.waitForSelector('#hero.tier0, #hero.tier1, #hero.tier2, #hero.tier3', { timeout: 40000 }); await m.waitForSelector('#wl .wlnote, #wl .gauges, #wl .err', { timeout: 40000 }); await m.waitForTimeout(2500);
  await m.screenshot({ path: out + '/new-home-mobile.png', fullPage: true });
  await m.goto(B + '/#/help?kind=evacuate'); await m.waitForSelector('#go'); await m.waitForTimeout(1800);
  await m.screenshot({ path: out + '/new-help.png', fullPage: true });
  const d = await br.newPage({ viewport: { width: 1366, height: 900 }, locale: 'th-TH' });
  d.on('pageerror', (e) => errs.push('desktop: ' + e.message));
  await d.goto(B + '/#/'); await d.waitForSelector('#hero.tier0, #hero.tier1, #hero.tier2, #hero.tier3', { timeout: 40000 }); await d.waitForSelector('#wl .wlnote, #wl .gauges, #wl .err', { timeout: 40000 }); await d.waitForTimeout(2500);
  await d.screenshot({ path: out + '/new-home-desktop.png', fullPage: true });
  await d.goto(B + '/#/map?demo=1'); await d.waitForSelector('#rOut .good, #rOut .warn, #rOut .err', { timeout: 40000 }); await d.waitForTimeout(2500);
  await d.screenshot({ path: out + '/new-map.png' });
  await d.goto(B + '/#/report'); await d.waitForSelector('#lv .chip'); await d.click('#lv .chip[data-v=knee]'); await d.waitForTimeout(400);
  await d.evaluate(() => document.querySelector('.mapsmall') && document.querySelector('.mapsmall').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 700, clientY: 600 })));
  await d.waitForTimeout(1500); await d.screenshot({ path: out + '/new-report-form.png', fullPage: true });
  await br.close(); console.log(errs.length ? 'page errors:\n' + errs.join('\n') : 'ok (no page errors)');
})().catch((e) => { console.error(e); process.exit(1); });
