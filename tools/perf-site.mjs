#!/usr/bin/env node
/**
 * Production performance pass — the Web Vitals budgets from spec §10.
 *
 * Measures LCP, CLS, TBT-ish long tasks, transfer size and DOM size on the
 * built site, across desktop, mobile and a CPU-throttled "modest laptop" pass,
 * and in all three motion modes.
 *
 * CLS in particular is where a scroll-driven site usually fails, so it is
 * measured while the page is actually scrolled — not on an idle load.
 *
 * Writes evidence/site-performance.json.
 * Usage: node tools/perf-site.mjs
 */
import { chromium } from "playwright-core";
import { readdirSync, existsSync } from "node:fs";
import { serve } from "./lib/site-server.mjs";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../site", import.meta.url));
const outRoot = fileURLToPath(new URL("../evidence", import.meta.url));
const PORT = 4361;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};
const server = await serve({ port: PORT });

/* Discovered from the built site rather than hard-coded. The earlier version
   listed 16 paths by hand, which quietly stopped covering the 13 case studies
   added in the second pass — a budget harness that skips a third of the site is
   worse than no harness, because it reports a pass. */
function discoverPages() {
  const dir = fileURLToPath(new URL("../site", import.meta.url));
  const out = [];
  for (const f of readdirSync(dir)) if (f.endsWith(".html")) out.push("/" + f);
  const proj = join(dir, "projects");
  if (existsSync(proj)) for (const f of readdirSync(proj)) if (f.endsWith(".html")) out.push("/projects/" + f);
  return out.sort((a, b) => (a.includes("index") ? -1 : b.includes("index") ? 1 : a.localeCompare(b)));
}
const PAGES = discoverPages();const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, dpr: 1, mobile: false, cpu: 1 },
  { name: "mobile", width: 390, height: 844, dpr: 3, mobile: true, cpu: 4 },
  { name: "modest-laptop", width: 1366, height: 768, dpr: 1, mobile: false, cpu: 6 }
];
const MODES = [
  { name: "full", query: "?motion=on" },
  { name: "reduced", query: "?motion=reduced" },
  { name: "static", query: "?motion=off" }
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];

for (const v of VIEWPORTS) {
  for (const m of MODES) {
    for (const path of PAGES) {
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: v.dpr,
        isMobile: v.mobile, hasTouch: v.mobile,
        reducedMotion: m.name === "reduced" ? "reduce" : "no-preference"
      });
      const page = await ctx.newPage();
      if (v.cpu > 1) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: v.cpu });
      }
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

      await page.goto(`http://127.0.0.1:${PORT}${path}${m.query}`, { waitUntil: "load", timeout: 30000 });

      /* Install vitals collection BEFORE interacting, and keep it running while
         the page is scrolled, because that is when a scroll-driven site shifts. */
      await page.evaluate(() => {
        window.__vitals = { lcp: 0, cls: 0, shifts: [], longTasks: [], lcpAt: 0 };
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) { window.__vitals.lcp = e.startTime; window.__vitals.lcpAt = performance.now(); }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch (e) { /* not supported */ }
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) {
              if (!e.hadRecentInput) { window.__vitals.cls += e.value; window.__vitals.shifts.push({ v: e.value, t: Math.round(e.startTime) }); }
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch (e) { /* not supported */ }
        try {
          new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitals.longTasks.push(e.duration); })
            .observe({ type: "longtask", buffered: true });
        } catch (e) { /* not supported */ }
      });

      await page.waitForTimeout(1200);

      /* Scroll the whole page in steps: this is where CLS from lazy images and
         scroll-linked animation actually shows up. */
      const t0 = Date.now();
      await page.evaluate(async () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const steps = 20;
        for (let i = 1; i <= steps; i++) {
          window.scrollTo(0, (max / steps) * i);
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
        }
        window.scrollTo(0, 0);
      });
      const scrollMs = Date.now() - t0;
      await page.waitForTimeout(400);

      const data = await page.evaluate(() => {
        const vit = window.__vitals;
        const nav = performance.getEntriesByType("navigation")[0];
        const res = performance.getEntriesByType("resource");
        const byType = {};
        for (const r of res) {
          const t = r.initiatorType || "other";
          byType[t] = byType[t] || { count: 0, bytes: 0 };
          byType[t].count++;
          byType[t].bytes += r.transferSize || 0;
        }
        const lt = vit.longTasks;
        return {
          lcp: vit.lcp ? Math.round(vit.lcp) : null,
          cls: Math.round(vit.cls * 10000) / 10000,
          worstShift: vit.shifts.length ? Math.max(...vit.shifts.map((s) => s.v)) : 0,
          shiftCount: vit.shifts.filter((s) => s.v > 0.001).length,
          longTaskCount: lt.length,
          longTaskTotal: Math.round(lt.reduce((a, b) => a + b, 0)),
          longTaskMax: lt.length ? Math.round(Math.max(...lt) ) : 0,
          tbtProxy: Math.round(lt.reduce((a, b) => a + Math.max(0, b - 50), 0)),
          domNodes: document.getElementsByTagName("*").length,
          transferBytes: res.reduce((a, r) => a + (r.transferSize || 0), 0),
          requests: res.length + 1,
          byType,
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          loadEvent: nav ? Math.round(nav.loadEventEnd) : null
        };
      });

      results.push({ path, viewport: v.name, cpuThrottle: v.cpu, mode: m.name, scrollMs, errors, ...data });
      await ctx.close();
    }
    const slice = results.filter((r) => r.viewport === v.name && r.mode === m.name);
    const avg = (k) => Math.round(slice.reduce((a, r) => a + (r[k] || 0), 0) / slice.length * 100) / 100;
    console.log(
      `${v.name.padEnd(14)} ${m.name.padEnd(8)} avg LCP ${String(avg("lcp")).padStart(5)}ms · ` +
      `CLS ${avg("cls").toFixed(4)} · longTasks ${avg("longTaskCount")} · TBT-proxy ${avg("tbtProxy")}ms · ` +
      `transfer ${Math.round(avg("transferBytes") / 1024)}KB · errors ${slice.reduce((a, r) => a + r.errors.length, 0)}`
    );
  }
}

await browser.close();
server.close();

/* ---- roll-up against the spec budgets ---- */
const budgets = { lcp: 2500, cls: 0.1, inp: 200 };
const worst = {
  lcp: Math.max(...results.map((r) => r.lcp || 0)),
  cls: Math.max(...results.map((r) => r.cls)),
  longTaskMax: Math.max(...results.map((r) => r.longTaskMax)),
  tbtProxy: Math.max(...results.map((r) => r.tbtProxy)),
  transferKB: Math.round(Math.max(...results.map((r) => r.transferBytes)) / 1024),
  domNodes: Math.max(...results.map((r) => r.domNodes))
};
const perViewport = {};
for (const r of results) {
  const k = r.viewport + "/" + r.mode;
  perViewport[k] = perViewport[k] || { lcp: [], cls: [], tbt: [] };
  perViewport[k].lcp.push(r.lcp || 0);
  perViewport[k].cls.push(r.cls);
  perViewport[k].tbt.push(r.tbtProxy);
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const medians = Object.fromEntries(Object.entries(perViewport).map(([k, v]) => [k,
  { lcp: Math.round(median(v.lcp)), cls: Math.round(median(v.cls) * 10000) / 10000, tbtProxy: Math.round(median(v.tbt)) }]));

const out = {
  generatedAt: new Date().toISOString(),
  note: "LCP and CLS are collected with PerformanceObserver in Chromium (headless shell, software rasterisation, 2 vCPU). CLS is accumulated during a scripted scroll of the entire page, which is the scenario that exposes shifts on a scroll-driven site. INP is not measured directly; the long-task total and TBT proxy are reported instead.",
  budgets,
  worst,
  medians,
  results
};
await writeFile(join(outRoot, "site-performance.json"), JSON.stringify(out, null, 2));

console.log(`\n=============== BUDGET CHECK (worst case across ${PAGES.length} pages × 3 viewports × 3 modes) ===============`);
console.log(`LCP      worst ${worst.lcp}ms   budget ${budgets.lcp}ms   ${worst.lcp <= budgets.lcp ? "✓ within budget" : "✗ over budget"}`);
console.log(`CLS      worst ${worst.cls.toFixed(4)}    budget ${budgets.cls}        ${worst.cls <= budgets.cls ? "✓ within budget" : "✗ over budget"}`);
console.log(`Longest task ${worst.longTaskMax}ms · TBT proxy worst ${worst.tbtProxy}ms · DOM max ${worst.domNodes} nodes`);
console.log(`Transfer worst ${worst.transferKB}KB (uncompressed, no CDN)`);
console.log("=============================================================================================");
for (const [k, v] of Object.entries(medians)) {
  console.log(`  median ${k.padEnd(24)} LCP ${String(v.lcp).padStart(4)}ms  CLS ${v.cls.toFixed(4)}  TBT-proxy ${v.tbtProxy}ms`);
}
console.log("\nwrote evidence/site-performance.json");
process.exit(0);
