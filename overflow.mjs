import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root='/home/user/blaxkverse/site';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://l');let p=normalize(decodeURIComponent(u.pathname));if(p.endsWith('/'))p+='index.html';const b=await readFile(join(root,p));res.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(4351,'127.0.0.1',r));
const B='http://127.0.0.1:4351';
const b=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
const pages=['/index.html','/work.html','/source.html','/about.html','/company.html','/lab.html','/contact.html','/privacy.html','/projects/edublaxk.html','/projects/blaxk-housing.html','/projects/forma.html','/projects/sabi.html','/projects/blaxk-xposer.html'];
for(const path of pages){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  await pg.goto(B+path,{waitUntil:'load'}); await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const docW=document.documentElement.scrollWidth;
    const bad=[];
    document.querySelectorAll('*').forEach(n=>{
      const b=n.getBoundingClientRect();
      if(b.width>vw+1 && b.height>0){
        const cs=getComputedStyle(n);
        if(cs.position==='fixed') return;
        bad.push({tag:n.tagName.toLowerCase(),cls:(n.className||'').toString().slice(0,60),w:Math.round(b.width),x:Math.round(b.left),overflowX:cs.overflowX});
      }
    });
    // keep only the outermost offenders
    return {vw,docW,overflow:docW-vw,bad:bad.slice(0,8)};
  });
  console.log(`${path.padEnd(34)} docW=${r.docW} vw=${r.vw} overflow=${r.overflow}`);
  r.bad.forEach(x=>console.log(`      ${x.tag}.${x.cls} w=${x.w} x=${x.x} ovx=${x.overflowX}`));
  await ctx.close();
}
await b.close(); server.close(); process.exit(0);
