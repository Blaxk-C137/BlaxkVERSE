import { chromium } from 'playwright-core';
const b = await chromium.launch();
const t = async (w, h, d, label) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:4321/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const cvs = [...document.querySelectorAll('canvas')];
    const info = cvs.map(cv => ({ css: cv.clientWidth, backing: cv.width, ratio: +(cv.width / (cv.clientWidth || 1)).toFixed(3) }));
    // frame timing over 2s
    const ts = []; let last = performance.now(); let run = true;
    const loop = (n) => { ts.push(n - last); last = n; if (run) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    await new Promise(r => setTimeout(r, 2000)); run = false;
    ts.shift();
    const sorted = [...ts].sort((a, x) => a - x);
    return { info, frames: ts.length,
             med: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
             p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
             worst: +Math.max(...ts).toFixed(2),
             over20: ts.filter(x => x > 20).length };
  });
  console.log(`\n${label} ${w}x${h}@${d}x`);
  r.info.forEach(c => console.log(`   canvas css ${c.css}px  backing ${c.backing}px  ratio ${c.ratio}  ${c.ratio >= 1 ? 'CRISP ✓' : 'BLURRY ✗'}`));
  console.log(`   frames ${r.frames}/2s  med ${r.med}ms  p95 ${r.p95}ms  worst ${r.worst}ms  frames>20ms: ${r.over20}`);
  await c.close();
};
await t(1440, 900, 1, 'DESKTOP ');
await t(1920, 1080, 1, 'DESKTOP ');
await t(1366, 768, 1, 'LAPTOP  ');
await t(390, 844, 3, 'MOBILE  ');
await b.close();
