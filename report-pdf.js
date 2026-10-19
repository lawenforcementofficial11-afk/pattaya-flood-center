// Daily situation report PDF (A4, Thai font Sarabun · OFL). Pure JS (pdfkit) so it runs on Render without a browser.
// The map is drawn as vectors from our own data (city boundary + main roads from the offline OSM index), not from tile images.
const PDFDocument = require('pdfkit'), path = require('path'), fs = require('fs');
const F = { r: path.join(__dirname, 'fonts/Sarabun-Regular.ttf'), b: path.join(__dirname, 'fonts/Sarabun-Bold.ttf') };
const OSM = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'geo/pattaya-osm.json'), 'utf8')); } catch { return { roads: [] }; } })();
const MAIN = OSM.roads.filter((r) => /^(motorway|trunk|primary|secondary|tertiary)$/.test(r.h));
const COL = { dry: '#16a34a', ankle: '#ca8a04', knee: '#ea580c', waist: '#dc2626', chest: '#9f1239', roof: '#4c0519' };
const thDate = (d) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' });
const thTime = (iso) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
function bars(doc, x, y, w, h, items, title) {
  doc.font('b').fontSize(11).fillColor('#0b3c5d').text(title, x, y); y += 18; const max = Math.max(1, ...items.map((i) => i.v)), bw = w / Math.max(1, items.length);
  doc.moveTo(x, y + h).lineTo(x + w, y + h).lineWidth(0.6).strokeColor('#4a5361').stroke();
  items.forEach((it, i) => { const bh = (it.v / max) * (h - 14); doc.rect(x + i * bw + bw * 0.15, y + h - bh, bw * 0.7, bh).fill(it.c || '#0e7490');
    if (it.v) doc.font('r').fontSize(8).fillColor('#0b3c5d').text(String(it.v), x + i * bw, y + h - bh - 11, { width: bw, align: 'center' });
    if (it.l) doc.font('r').fontSize(7).fillColor('#4a5361').text(it.l, x + i * bw - 4, y + h + 3, { width: bw + 8, align: 'center' }); });
}
function map(doc, d, x, y, w, h) {
  const P = d.boundary; let s = 90, wv = 180, n = -90, e = -180; for (const p of P) for (const [lo, la] of p[0]) { s = Math.min(s, la); n = Math.max(n, la); wv = Math.min(wv, lo); e = Math.max(e, lo); }
  const kx = Math.cos((((s + n) / 2) * Math.PI) / 180), sc = Math.min(w / ((e - wv) * kx), h / (n - s)), ox = x + (w - (e - wv) * kx * sc) / 2, oy = y + (h - (n - s) * sc) / 2;
  const pt = (la, lo) => [ox + (lo - wv) * kx * sc, oy + (n - la) * sc];
  doc.save().rect(x, y, w, h).clip(); doc.rect(x, y, w, h).fill('#eef3f8');
  for (const p of P) { p[0].forEach(([lo, la], i) => { const [a, b] = pt(la, lo); i ? doc.lineTo(a, b) : doc.moveTo(a, b); }); doc.closePath().fillAndStroke('#ffffff', '#101b2b'); }
  doc.lineWidth(0.5).strokeColor('#9aa3ad'); for (const r of MAIN) { r.g.forEach(([la, lo], i) => { const [a, b] = pt(la, lo); i ? doc.lineTo(a, b) : doc.moveTo(a, b); }); doc.stroke(); }
  doc.lineWidth(2).strokeColor('#0b3c5d'); for (const w2 of d.roads.filter((r) => r.type === 'closed')) { w2.points.forEach(([la, lo], i) => { const [a, b] = pt(la, lo); i ? doc.lineTo(a, b) : doc.moveTo(a, b); }); doc.dash(2, { space: 2 }).stroke().undash(); }
  for (const r of d.reports) { const [a, b] = pt(r.lat, r.lng); doc.circle(a, b, 3.6).lineWidth(0.6).fillAndStroke(COL[r.level] || '#0e7490', '#0b3c5d'); }
  for (const s2 of d.exec.shelters.list) if (s2.lat) { const [a, b] = pt(s2.lat, s2.lng); doc.rect(a - 3, b - 3, 6, 6).lineWidth(0.6).fillAndStroke('#0e7490', '#ffffff'); }
  doc.restore().rect(x, y, w, h).lineWidth(0.6).strokeColor('#4a5361').stroke();
  doc.font('r').fontSize(7).fillColor('#4a5361').text('แผนที่: ขอบเขตเมืองพัทยาและถนนสายหลัก © OpenStreetMap contributors · จุดกลม = รายงานระดับน้ำ (สีตามระดับ) · สี่เหลี่ยมน้ำเงิน = ศูนย์พักพิง · เส้นประดำ = ถนนปิด', x, y + h + 3, { width: w });
}
function build(d) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `รายงานสถานการณ์น้ำท่วมเมืองพัทยา ${d.day}`, Author: 'Pattaya Flood Alert' } });
    const out = []; doc.on('data', (c) => out.push(c)); doc.on('end', () => resolve(Buffer.concat(out))); doc.on('error', reject);
    doc.registerFont('r', F.r); doc.registerFont('b', F.b);
    const W = doc.page.width - 72, X = 36, E = d.exec;
    doc.rect(0, 0, doc.page.width, 64).fill('#101b2b'); doc.font('b').fontSize(17).fillColor('#ffffff').text('รายงานสถานการณ์น้ำท่วมประจำวัน · เมืองพัทยา', X, 14);
    doc.font('r').fontSize(10).fillColor('#dfe6ee').text(`ประจำวันที่ ${thDate(d.day)} · สร้างเมื่อ ${thTime(d.generatedAt)} น. (UTC+7)`, X, 40);
    let y = 78; const kp = [['รายงานระดับน้ำวันนี้', d.reports.length], ['คำขอช่วยเหลือวันนี้', d.requests.length], ['คำขอที่ยังเปิด (ทั้งหมด)', E.openRequests], ['รอคัดกรอง', E.pendingRequests],
      ['เวลาตอบสนองเฉลี่ย', E.avgResponseMin == null ? '–' : E.avgResponseMin + ' นาที'], ['ถนนปิด / ทางเลี่ยง', `${E.closures} / ${E.detours}`], ['ศูนย์พักพิง ผู้พัก/รับได้', `${E.shelters.occupancy}/${E.shelters.capacity}`], ['เช็กอินปลอดภัยวันนี้', d.safeN]];
    const kw = W / 4; kp.forEach(([l, v], i) => { const kx = X + (i % 4) * kw, ky = y + Math.floor(i / 4) * 50; doc.rect(kx + 2, ky, kw - 4, 44).lineWidth(0.6).strokeColor('#b7bcc4').stroke();
      doc.font('r').fontSize(8).fillColor('#4a5361').text(l, kx + 8, ky + 5, { width: kw - 16 }); doc.font('b').fontSize(16).fillColor('#0b3c5d').text(String(v), kx + 8, ky + 18, { width: kw - 16 }); });
    y += 108; map(doc, d, X, y, W * 0.5, 300);
    const cx = X + W * 0.55, cw = W * 0.45; const LV = Object.keys(d.LEVEL_CM);
    bars(doc, cx, y, cw, 100, LV.map((k) => ({ v: d.byLevel[k] || 0, c: COL[k], l: (d.levels[k] || k).split(/[–-]/)[0].trim().slice(0, 10) })), 'รายงานตามระดับน้ำ (วันนี้)');
    bars(doc, cx, y + 150, cw, 90, d.byHour.map((v, h) => ({ v, l: h % 3 ? '' : String(h).padStart(2, '0') })), 'รายงานรายชั่วโมง (น.)');
    y += 330; doc.font('b').fontSize(11).fillColor('#0b3c5d').text('ซอย/ถนนที่มีรายงานวันนี้', X, y); y += 16;
    const row = (cells, ws, bold) => { let xx = X; doc.font(bold ? 'b' : 'r').fontSize(9).fillColor('#0b3c5d'); cells.forEach((c, i) => { doc.text(String(c ?? ''), xx + 2, y, { width: ws[i] - 4, lineBreak: false, ellipsis: true }); xx += ws[i]; }); y += 14; doc.moveTo(X, y - 2).lineTo(X + W, y - 2).lineWidth(0.3).strokeColor('#b7bcc4').stroke(); };
    const ws1 = [W * 0.4, W * 0.3, W * 0.1, W * 0.2]; row(['ซอย', 'ถนน', 'รายงาน', 'สูงสุด'], ws1, true);
    (d.sois.length ? d.sois.slice(0, 8) : [{ soi: 'ไม่มีรายงานในวันนี้' }]).forEach((s) => row([s.soi, s.road, s.count, s.maxCm ? '≈' + s.maxCm + ' ซม.' : ''], ws1));
    y += 8; doc.font('b').fontSize(11).text('ภาระงานแต่ละทีม', X, y); y += 16; const ws2 = [W * 0.4, W * 0.15, W * 0.15, W * 0.15, W * 0.15]; row(['ทีม', 'ยังเปิด', 'กำลังเดินทาง', 'เสร็จแล้ว', 'รวม'], ws2, true);
    (E.teams.length ? E.teams.slice(0, 6) : []).forEach((t) => row([t.team || '(ยังไม่มอบหมาย)', t.open, t.enroute, t.done, t.total], ws2));
    doc.font('r').fontSize(7).fillColor('#4a5361').text('ข้อมูลจากรายงานของประชาชนที่ผ่านการกรอง คำขอช่วยเหลือ และข้อมูลเจ้าหน้าที่ในระบบ · ไม่มีข้อมูลส่วนบุคคล (ชื่อ/เบอร์โทร) ในรายงานนี้', X, doc.page.height - 50, { width: W, align: 'center' });
    doc.end();
  });
}
module.exports = { build };
