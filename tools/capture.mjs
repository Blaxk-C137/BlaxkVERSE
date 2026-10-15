#!/usr/bin/env node
/**
 * Captures reference screenshots of every prototype in every required state:
 * desktop, mobile and the reduced-motion fallback. Output: evidence/shots/.
 *
 * These are the images referenced by docs/experience-decision.md so a reader can
 * see exactly what was scored without running anything.
 *
 * Usage: node tools/capture.mjs
 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4320;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p.endsWith("/")) p += "index.html";
    const body = await readFile(join(root, p));
    res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nope"); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const outDir = join(root, "evidence", "shots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });

const CONCEPTS = [
  { id: "a", name: "A-spatial-constellation", path: "/prototypes/concept-a.html" },
  { id: "b", name: "B-source-reactor", path: "/prototypes/concept-b.html" },
  { id: "c", name: "C-infinite-signal", path: "/prototypes/concept-c.html" }
];

const SHOTS = [
  { state: "desktop-entry", view: { width: 1440, height: 900, dpr: 1 }, scroll: 0, reduced: false },
  { state: "desktop-mid", view: { width: 1440, height: 900, dpr: 1 }, scroll: 0.42, reduced: false },
  { state: "desktop-late", view: { width: 1440, height: 900, dpr: 1 }, scroll: 0.74, reduced: false },
  { state: "mobile-entry", view: { width: 390, height: 844, dpr: 2 }, scroll: 0, reduced: false, mobile: true },
  { state: "mobile-mid", view: { width: 390, height: 844, dpr: 2 }, scroll: 0.3, reduced: false, mobile: true },
  { state: "reduced-motion-desktop", view: { width: 1440, height: 900, dpr: 1 }, scroll: 0.42, reduced: true }
];

for (const c of CONCEPTS) {
  for (const s of SHOTS) {
    const scrollTo = s.scroll;
    const ctx = await browser.newContext({
      viewport: { width: s.view.width, height: s.view.height },
      deviceScaleFactor: s.view.dpr,
      isMobile: !!s.mobile,
      hasTouch: !!s.mobile,
      reducedMotion: s.reduced ? "reduce" : "no-preference"
    });
    const page = await ctx.newPage();
    const query = s.reduced ? "?motion=off" : "?motion=on";
    await page.goto(`http://127.0.0.1:${PORT}${c.path}${query}`, { waitUntil: "load" });
    await page.waitForTimeout(700);
    if (scrollTo > 0) {
      /* Step down so scroll-driven scenes actually advance (some concepts only
         update on discrete scroll events, which is realistic). */
      await page.evaluate(async (frac) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const target = max * frac;
        const stepCount = 14;
        for (let i = 1; i <= stepCount; i++) {
          window.scrollTo(0, (target / stepCount) * i);
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 45)));
        }
      }, scrollTo);
      await page.waitForTimeout(900);
    }
    const file = join(outDir, `${c.name}__${s.state}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("captured", file.replace(root, ""));
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("\ndone — screenshots in evidence/shots/");
process.exit(0);
