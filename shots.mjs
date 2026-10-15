import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root='/home/user/blaxkverse/site';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://l');let p=normalize(decodeURIComponent(u.pathname));if(p.endsWith('/'))p+='index.html';const b=await readFile(join(root,p));res.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(4341,'127.0.0.1',r));
const B='http://127.0.0.1:4341';
const b=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
await mkdir('/home/user/blaxkverse/evidence/site-shots',{recursive:true});

async function shot(name, path, opts={}){
  const ctx=await b.newContext({viewport:opts.viewport||{width:1440,height:900},deviceScaleFactor:opts.dpr||1,isMobile:!!opts.mobile,hasTouch:!!opts.mobile});
  const pg=await ctx.newPage();
  await pg.goto(B+path,{waitUntil:'load'});
  await pg.waitForTimeout(800);
  if(opts.scrollTo){ await pg.evaluate(y=>window.scrollTo(0,y),opts.scrollTo); await pg.waitForTimeout(900); }
  if(opts.selector){ const el=await pg.$(opts.selector); if(el) await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(800); }
  await pg.screenshot({path:`/home/user/blaxkverse/evidence/site-shots/${name}.png`,clip:opts.clip});
  console.log('  '+name);
  await ctx.close();
}
await shot('work-field','/work.html',{selector:'.field-wrap'});
await shot('work-index','/work.html',{scrollTo:1400});
await shot('source','/source.html',{scrollTo:1500});
await shot('contact','/contact.html');
await shot('lab','/lab.html');
await shot('privacy','/privacy.html',{scrollTo:600});
await shot('about','/about.html',{scrollTo:1100});
await shot('company','/company.html',{scrollTo:500});
await shot('case-forma','/projects/forma.html',{scrollTo:2600});
await shot('mobile-home','/index.html',{viewport:{width:390,height:844},dpr:2,mobile:true});
await shot('mobile-work','/work.html',{viewport:{width:390,height:844},dpr:2,mobile:true,scrollTo:900});
await shot('mobile-case','/projects/edublaxk.html',{viewport:{width:390,height:844},dpr:2,mobile:true,scrollTo:1200});
await b.close(); server.close(); process.exit(0);
