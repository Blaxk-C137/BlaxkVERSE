#!/usr/bin/env node
/**
 * check:quality — the four checks the performance budget could not do.
 *
 * Why this exists. The performance harness measures LCP, CLS, long tasks and
 * console errors. It gave the site a clean bill of health while the hero canvas
 * was rendering at HALF resolution on every desktop viewport, because a canvas
 * rendering at half resolution is *faster*, not slower. An optimisation that
 * traded visible quality for an unmeasured quantity passed every gate.
 *
 * Each check below exists because a specific defect got through a different one:
 *
 *   1. canvas fidelity   — the 0.5x upscale that no budget caught
 *   2. motion layer      — GSAP must engage in `full` and be ABSENT in `reduced`
 *   3. layout stability  — CLS, and the name of the element that moved
 *   4. filter integrity  — every theme must be reachable and filter correctly
 *
 * Usage:  node tools/check-quality.mjs        (starts its own server on 4371)
 * Exit code 1 on any failure.
 */

import { chromium } from "playwright-core";
import { readdirSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { serve } from "./lib/site-server.mjs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../site", import.meta.url));
const PORT = 4371;
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
  ".wav": "audio/wav", ".ico": "image/x-icon" };

const server = await serve({ port: PORT });

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}\n      ${detail}`);
};

const browser = await chromium.launch();

/* ------------------------------------------------------------------ 1. fidelity */
async function fidelity() {
  const viewports = [
    ["desktop", 1440, 900, 1], ["desktop-hi", 1920, 1080, 1],
    ["laptop", 1366, 768, 1], ["mobile", 390, 844, 3],
  ];
  const offenders = [];
  const measured = [];
  for (const [label, width, height, dpr] of viewports) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const canvases = await page.evaluate(() =>
      [...document.querySelectorAll("canvas")].map((c) => ({
        css: c.clientWidth, backing: c.width,
        ratio: +(c.width / (c.clientWidth || 1)).toFixed(2),
      })));
    for (const c of canvases) {
      measured.push(`${label} ${c.ratio}x`);
      /* Below 1.0 means the canvas is upscaled by CSS, which is blur. */
      if (c.ratio < 1) offenders.push(`${label} ratio ${c.ratio} (${c.backing}px backing for ${c.css}px box)`);
    }
    await ctx.close();
  }
  check("canvas fidelity", offenders.length === 0,
    offenders.length ? offenders.join(" · ") : `every canvas at native resolution — ${measured.join(", ")}`);
}

/* --------------------------------------------------------------- 2. motion layer */
async function motion() {
  const probe = async (reduced) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(reduced ? { reducedMotion: "reduce" } : {}) });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      mode: document.documentElement.getAttribute("data-motion"),
      gsapAttr: document.documentElement.getAttribute("data-gsap"),
      motion: window.BX_MOTION || null,
    }));
    await ctx.close();
    return r;
  };
  const full = await probe(false);
  const reduced = await probe(true);
  const okFull = full.gsapAttr === "on" && full.motion && full.motion.active;
  const okReduced = reduced.gsapAttr !== "on" && !reduced.motion;
  check("motion layer engagement", okFull && okReduced,
    `full: GSAP ${full.motion ? "v" + full.motion.version : "absent"} (` +
    `${full.gsapAttr || "off"}) · reduced: mode=${reduced.mode}, layer ${okReduced ? "correctly absent" : "WRONGLY ACTIVE"}`);
}

/* ---------------------------------------------------------- 3. layout stability */
async function stability() {
  const pages = ["/work.html", "/source.html", "/index.html", "/projects/edublaxk.html", "/projects/the-migrator.html"];
  const bad = [];
  const observed = [];
  for (const path of pages) {
    for (const mode of ["off", "on"]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__shifts = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            if (e.hadRecentInput || e.value < 0.001) continue;
            window.__shifts.push({
              value: +e.value.toFixed(5),
              sources: (e.sources || []).map((s) => {
                const n = s.node;
                if (!n) return "(detached)";
                const cls = (typeof n.className === "string" && n.className) ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
                const dy = s.previousRect && s.currentRect ? +(s.currentRect.top - s.previousRect.top).toFixed(1) : null;
                return `${(n.tagName || "?").toLowerCase()}${n.id ? "#" + n.id : ""}${cls}${dy !== null ? ` moved ${dy}px` : ""}`;
              }),
            });
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(`http://127.0.0.1:${PORT}${path}?motion=${mode}`, { waitUntil: "load" });
      await page.waitForTimeout(1000);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      const shifts = await page.evaluate(() => window.__shifts);
      const total = +shifts.reduce((a, s) => a + s.value, 0).toFixed(4);
      observed.push(`${path.replace(".html", "").replace("/projects/", "/")} ${mode}=${total}`);
      if (total > 0.01) bad.push(`${path} (${mode}) CLS ${total} — ${shifts.flatMap((s) => s.sources).join(", ")}`);
      await ctx.close();
    }
  }
  check("layout stability", bad.length === 0,
    bad.length ? bad.join(" | ") : `all sampled pages under 0.01 — ${observed.join(" · ")}`);
}

/* ----------------------------------------------------------- 4. filter integrity */
async function filters() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/work.html`, { waitUntil: "load" });
  await page.waitForTimeout(800);

  const data = JSON.parse(await readFile(new URL("../evidence/quality-data.json", import.meta.url), "utf8").catch(() => "null"));
  const expected = data && data.themeCounts;
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll("button.filter")].map((b) => ({
      theme: b.dataset.theme, declared: +(b.querySelector(".count")?.textContent || 0),
    })));

  const problems = [];
  if (expected) {
    for (const [theme, count] of Object.entries(expected)) {
      const btn = buttons.find((b) => b.theme === theme);
      if (!btn) { problems.push(`theme "${theme}" (${count} projects) has no filter button`); continue; }
      if (btn.declared !== count) problems.push(`theme "${theme}" declares ${btn.declared} but ${count} projects carry it`);
    }
  }
  /* Every remaining button must actually filter to its declared count. */
  for (const b of buttons) {
    await page.click(`button.filter[data-theme="${b.theme}"]`);
    await page.waitForTimeout(180);
    const shown = await page.evaluate(() => document.querySelectorAll("#project-rows .project-row").length);
    if (shown !== b.declared) problems.push(`clicking "${b.theme}" shows ${shown} rows, declares ${b.declared}`);
  }
  await ctx.close();
  check("filter integrity", problems.length === 0,
    problems.length ? problems.join(" | ") : `${buttons.length} filters, every one reachable and matching its declared count`);
}

console.log("\n=============== QUALITY CHECKS ===============");
try {
  await fidelity();
  await motion();
  await stability();
  await filters();
} catch (e) {
  check("harness", false, String(e));
}
await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log("=============================================");
console.log(`${results.length - failed.length} passed · ${failed.length} failed\n`);
process.exit(failed.length ? 1 : 0);
