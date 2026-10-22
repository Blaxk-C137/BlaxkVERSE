import { chromium } from 'playwright-core';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
await p.goto('http://127.0.0.1:4321/work.html', { waitUntil:'load' });
await p.waitForTimeout(1000);
for (const theme of ['all','media','automation','vision','ai']) {
  await p.click(`button.filter[data-theme="${theme}"]`);
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({
    rows: document.querySelectorAll('#project-rows .project-row').length,
    note: (document.querySelector('[data-count-note]')||{}).textContent || ''
  }));
  console.log(`  ${theme.padEnd(11)} rows=${String(r.rows).padStart(2)}   ${r.note.trim().slice(0,64)}`);
}
await b.close();
