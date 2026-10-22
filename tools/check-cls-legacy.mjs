import { chromium } from 'playwright-core';
const b = await chromium.launch();
for (const mode of ['off','on']) {
  const c = await b.newContext({ viewport:{width:1440,height:900} });
  const p = await c.newPage();
  await p.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({
          value: +e.value.toFixed(5), t: +e.startTime.toFixed(0),
          sources: (e.sources||[]).map(s => {
            const n = s.node;
            if (!n) return '(detached)';
            const id = n.id ? '#'+n.id : '';
            const cls = (typeof n.className==='string' && n.className) ? '.'+n.className.trim().split(/\s+/).slice(0,3).join('.') : '';
            const prev = s.previousRect, cur = s.currentRect;
            const dy = prev && cur ? +(cur.top - prev.top).toFixed(1) : null;
            return `${n.tagName?.toLowerCase()||'?'}${id}${cls}${dy!==null?` moved ${dy}px`:''}`;
          })
        });
      }
    }).observe({type:'layout-shift', buffered:true});
  });
  await p.goto(`http://127.0.0.1:4321/work.html?motion=${mode}`, {waitUntil:'load'});
  await p.waitForTimeout(1500);
  const r = await p.evaluate(()=>window.__shifts);
  console.log(`\n=== /work.html  motion=${mode} ===`);
  r.forEach(s => console.log(`  CLS ${s.value} @${s.t}ms\n     ${s.sources.join('\n     ')}`));
  if (!r.length) console.log('  no shifts');
  await c.close();
}
await b.close();
