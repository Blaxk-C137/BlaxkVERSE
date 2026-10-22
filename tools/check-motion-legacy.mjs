import { chromium } from 'playwright-core';
const b = await chromium.launch();
const t = async (w,h,d,label,url) => {
  const c = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:d });
  const p = await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://127.0.0.1:4321/'+url, { waitUntil:'load' });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const cv=[...document.querySelectorAll('canvas')].map(c=>({css:c.clientWidth,backing:c.width,ratio:+(c.width/(c.clientWidth||1)).toFixed(2)}));
    const ts=[]; let last=performance.now(), run=true;
    const loop=n=>{ts.push(n-last);last=n;if(run)requestAnimationFrame(loop);};
    requestAnimationFrame(loop);
    await new Promise(r=>setTimeout(r,2000)); run=false; ts.shift();
    const s=[...ts].sort((a,x)=>a-x);
    return { cv, motion: window.BX_MOTION||null,
      gsapAttr: document.documentElement.getAttribute('data-gsap'),
      mode: document.documentElement.getAttribute('data-motion'),
      frames: ts.length, med:+s[Math.floor(s.length/2)].toFixed(2),
      p95:+s[Math.floor(s.length*.95)].toFixed(2), worst:+Math.max(...ts).toFixed(2),
      over20: ts.filter(x=>x>20).length };
  });
  console.log(`\n${label} ${w}x${h}@${d}x  [${url}]`);
  r.cv.forEach(c=>console.log(`   canvas ratio ${c.ratio} ${c.ratio>=1?'CRISP ✓':'BLURRY ✗'}  (${c.backing}/${c.css})`));
  console.log(`   gsap: ${r.gsapAttr || 'off'}  engine=${r.motion?r.motion.engine+'@'+r.motion.version:'none'}  mode=${r.mode}`);
  console.log(`   ${r.frames}f/2s  med ${r.med}  p95 ${r.p95}  worst ${r.worst}  >20ms: ${r.over20}`);
  if(errs.length) console.log('   JS ERRORS:', errs.slice(0,3));
  await c.close();
};
await t(1440,900,1,'DESKTOP','index.html');
await t(1440,900,1,'DESKTOP','work.html');
await t(390,844,3,'MOBILE ','index.html');
// reduced-motion mode must NOT run gsap
const c = await b.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
const p = await c.newPage();
await p.goto('http://127.0.0.1:4321/index.html',{waitUntil:'load'});
await p.waitForTimeout(900);
const rr = await p.evaluate(()=>({mode:document.documentElement.getAttribute('data-motion'),gsap:document.documentElement.getAttribute('data-gsap'),motion:!!window.BX_MOTION}));
console.log(`\nREDUCED-MOTION  mode=${rr.mode}  gsap layer=${rr.gsap||'off (correct)'}  BX_MOTION=${rr.motion}`);
await c.close();
await b.close();
