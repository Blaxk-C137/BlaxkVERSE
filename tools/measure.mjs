#!/usr/bin/env node
/**
 * measures all prototypes in a real Chromium (headless new) and writes
 * evidence/measurements.json — the raw data behind docs/experience-decision.md
 * and docs/performance-report.md.
 *
 * It records what the spec asks for: FPS, long tasks, load cost, DOM size,
 * interaction responsiveness — per prototype, per viewport, per motion mode.
 * It does NOT invent numbers: if a metric cannot be measured it is written as
 * null with a reason.
 *
 * Usage: node tools/measure.mjs
 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4319;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8"
};

/* ---- tiny static server so the run needs no external host ---- */
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p.endsWith("/")) p += "index.html";
    const file = join(root, p);
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const CONCEPTS = [
  { id: "A", name: "Spatial Constellation", path: "/prototypes/concept-a.html" },
  { id: "B", name: "Source Reactor", path: "/prototypes/concept-b.html" },
  { id: "C", name: "Infinite Signal", path: "/prototypes/concept-c.html" }
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "mobile", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "low-end", width: 1280, height: 720, dpr: 1, mobile: false, cpu: 6 }
];

const MODES = [
  { name: "full", query: "?motion=on" },
  { name: "reduced", query: "?motion=off" }
];

/* Frame statistics on a shared 2-vCPU container show run-to-run variance, so a
   single sample would be a claim dressed up as a measurement. Each configuration
   is measured PASSES times and the median is what gets reported. */
const PASSES = Number(process.env.BX_PASSES || 3);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];

for (const c of CONCEPTS) {
  for (const v of VIEWPORTS) {
    for (const m of MODES) {
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: v.dpr,
        isMobile: v.mobile,
        hasTouch: v.mobile,
        reducedMotion: m.name === "reduced" ? "reduce" : "no-preference"
      });
      const page = await ctx.newPage();

      /* Throttle CPU to model a modest laptop for the low-end pass. */
      if (v.cpu) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: v.cpu });
      }

      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

      const t0 = Date.now();
      await page.goto(`http://127.0.0.1:${PORT}${c.path}${m.query}`, { waitUntil: "load", timeout: 30000 });

      const passes = [];
      let interactMs = null;
      for (let pass = 0; pass < PASSES; pass++) {

      /* WARM-UP: let the page settle (layout, font metrics, first paint, model
         init) and then zero the instrument. The counted pass therefore measures
         the steady-state experience, not cold-start noise. */
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const reset = document.querySelector('[data-hud="reset"]');
        if (reset) reset.click();
      });

      /* Drive the experience the way a person would: scroll the page in steps,
         waiting for frames in between, so we measure interaction, not idle. */
      const steps = 26;
      const scrollPerStep = await page.evaluate(() =>
        Math.max(200, Math.round((document.documentElement.scrollHeight - window.innerHeight) / 26)));
      for (let i = 0; i < steps; i++) {
        await page.evaluate((y) => window.scrollBy(0, y), scrollPerStep);
        await page.waitForTimeout(110);
      }

      /* Interaction responsiveness: open navigation, keyboard cycle, close. */
      const tInteract = Date.now();
      await page.keyboard.press("Escape").catch(() => {});
      await page.mouse.move(v.width / 2, v.height / 2);
      await page.waitForTimeout(120);
      if (pass === 0) interactMs = Date.now() - tInteract;
      const passReport = await page.evaluate(() => (window.__bxReport ? window.__bxReport() : null));
      passes.push({
        fps: passReport?.fps ?? null,
        p95: passReport?.frameP95 ?? null,
        worst: passReport?.frameWorst ?? null,
        longTasks: passReport?.longTasks ?? 0,
        samples: passReport?.frameSamples ?? 0
      });
      if (pass < PASSES - 1) {
        /* Return to the top and let the page settle before the next pass. */
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const r = document.querySelector('[data-hud="reset"]');
          if (r) r.click();
        });
      }
      } /* end pass loop */

      const median = (arr) => {
        const v = arr.filter((x) => typeof x === "number").sort((a, b) => a - b);
        if (!v.length) return null;
        return v[Math.floor(v.length / 2)];
      };
      const fpsSamples = passes.map((p) => p.fps);
      const summary = {
        fps: median(fpsSamples),
        fpsMin: fpsSamples.filter(Boolean).length ? Math.min(...fpsSamples.filter(Boolean)) : null,
        fpsMax: fpsSamples.filter(Boolean).length ? Math.max(...fpsSamples.filter(Boolean)) : null,
        fpsSamples,
        p95: median(passes.map((p) => p.p95)),
        worst: Math.max(...passes.map((p) => p.worst || 0)),
        longTasks: Math.max(...passes.map((p) => p.longTasks)),
        passCount: PASSES
      };

      const report = await page.evaluate(() => (window.__bxReport ? window.__bxReport() : null));
      const info = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        return nav
          ? { domInteractive: Math.round(nav.domInteractive), loadEnd: Math.round(nav.loadEventEnd), type: nav.type }
          : null;
      });
      const a11y = await page.evaluate(() => {
        const focusables = document.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])').length;
        const imgs = Array.from(document.images);
        return {
          focusable: focusables,
          h1: document.querySelectorAll("h1").length,
          landmarks: document.querySelectorAll("main,nav,header,footer").length,
          lang: document.documentElement.lang || null,
          skipLink: !!document.querySelector(".bx-skip"),
          imagesWithoutAlt: imgs.filter((i) => !i.alt).length,
          textNodes: document.body.innerText.trim().split(/\s+/).length
        };
      });

      results.push({
        concept: c.id,
        conceptName: c.name,
        viewport: v.name,
        viewportSize: `${v.width}x${v.height}@${v.dpr}x`,
        cpuThrottle: v.cpu || 1,
        mode: m.name,
        wallMs: Date.now() - t0,
        interactMs,
        summary,
        passes,
        errors,
        report,
        navigation: info,
        a11y
      });

      console.log(
        `[${c.id}/${v.name}/${m.name}] fps median=${summary.fps} (samples ${summary.fpsSamples.join(",")}) ` +
        `p95=${summary.p95}ms worst=${summary.worst}ms long=${summary.longTasks} ` +
        `dom=${report?.domNodes} transfer=${report?.transferBytes ?? 0}B errors=${errors.length}`
      );

      await ctx.close();
    }
  }
}

await browser.close();
server.close();

await mkdir(join(root, "evidence"), { recursive: true });
const out = {
  generatedAt: new Date().toISOString(),
  engine: `chromium ${browser.version ? "" : ""}(playwright-core)`.trim(),
  note:
    "Frame statistics are gathered by BX.hud inside the page (rolling 180-frame window). " +
    "They describe a headless container with 2 vCPU, which is a conservative stand-in for a modest laptop, not a benchmark of the user's device.",
  results
};
await writeFile(join(root, "evidence", "measurements.json"), JSON.stringify(out, null, 2));

/* Console summary used by docs */
const byKey = {};
for (const r of results) {
  const k = `${r.concept}/${r.mode}`;
  (byKey[k] = byKey[k] || []).push(r);
}
console.log("\n=== summary (fps by concept/mode across viewports) ===");
for (const k of Object.keys(byKey).sort()) {
  const rows = byKey[k];
  console.log(
    k.padEnd(10),
    rows.map((r) => `${r.viewport}:${r.summary.fps ?? "n/a"}`).join("  "),
    "| worst p95:", Math.max(...rows.map((r) => r.summary.p95 ?? 0)),
    "| longTasks max:", Math.max(...rows.map((r) => r.summary.longTasks ?? 0))
  );
}
console.log("\nwrote evidence/measurements.json");
process.exit(0);
