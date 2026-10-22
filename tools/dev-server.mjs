#!/usr/bin/env node
/**
 * Local development server: static site + the serverless functions.
 *
 * Why this exists. `python3 -m http.server` is fine for looking at pages, but it
 * cannot execute `api/track.js` or `api/stats.js`, so the analytics path could
 * only ever be tested as far as the network boundary — which is the half that
 * matters least. This runs the same handler files Vercel runs, with the same
 * signature, so the store handling and the token gate are testable locally.
 *
 * The contact form no longer has a server half to run: delivery goes from the
 * browser straight to EmailJS. What this server adds for that path is
 * /api/emailjs, a plain forwarding proxy so the same request can be exercised
 * same-origin during development. The keys live in
 * site/assets/js/emailjs-config.js, which this server reads to say at boot
 * whether the form is wired.
 *
 * It is intentionally NOT a Vercel emulator: no edge network, no cold starts, no
 * real geo headers (country comes back as XX unless you fake it). It exists to
 * prove the code paths work, not to predict production latency.
 *
 * Usage:
 *   cp .env.example .env      # then fill in what you have (only analytics/dashboard need it)
 *   npm run dev               # http://localhost:4173
 *
 * With no environment variables set the site serves perfectly and:
 *   /api/track   → responds honestly that no store is configured
 *   /api/stats   → reports that the dashboard is disabled
 *   the form     → validates, then reports honestly if EmailJS is not wired
 * That is the correct behaviour, and it means you can exercise the whole form
 * before you own anything but an EmailJS account.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE = join(root, "site");
/* 4173 by default, matching .env.example and the README. It used to default to
   3000, which is a common default for OTHER things to be listening on — and on
   a shared or platform host that produced a raw EADDRINUSE stack trace instead
   of an explanation. */
const PORT = Number(process.env.PORT || 4173);

/* ------------------------------------------------------------------ env loading
   Read .env by hand so the dev server has no dependencies at all. Handles the
   `export FOO=bar`, `FOO=bar`, quoted values and comments. It does not pretend to
   handle multi-line values, because none of the variables this project uses need
   them. */
function loadEnv() {
  const file = join(root, ".env");
  if (!existsSync(file)) return 0;
  let n = 0;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) { process.env[m[1]] = v; n++; }
  }
  return n;
}
const loaded = loadEnv();

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".ico": "image/x-icon", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
};

/* The same redirects vercel.json declares, so /work and /admin behave identically
   in development. Testing a routing difference that only appears in production is
   how a deploy breaks on the one page nobody checked. */
const REWRITES = [
  [/^\/work\/([\w-]+)$/, (m) => `/projects/${m[1]}.html`],
  [/^\/(work|source|company|lab|about|contact|privacy|admin)$/, (m) => `/${m[1]}.html`],
];

async function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  for (const [re, to] of REWRITES) {
    const m = pathname.match(re);
    if (m) { rel = to(m); break; }
  }
  /* Block traversal before touching the filesystem. */
  const file = normalize(join(SITE, decodeURIComponent(rel)));
  if (!file.startsWith(SITE)) { res.writeHead(403).end("forbidden"); return; }

  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error("dir");
    const body = await readFile(file);
    const ext = extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60",
      /* Mirrors the production headers closely enough to catch accidental
         external requests and inline-script regressions during development. */
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.emailjs.com; form-action 'self'; base-uri 'none'; object-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset="utf-8"><title>404</title>
      <body style="font-family:ui-monospace,monospace;background:#06070a;color:#f4f4f2;padding:3rem">
      <p>404 — no such page: <code>${pathname.replace(/[<>&]/g, "")}</code></p>
      <p><a href="/" style="color:#f04445">Back to the site</a></p></body>`);
  }
}

/* ---------------------------------------------------------------- api routing */
const API_ROUTES = { "/api/track": "track.js", "/api/stats": "stats.js" };

/* Local proxy for the EmailJS send. The production form posts straight from the
   browser to api.emailjs.com; this route exists so that during development the
   same request can run same-origin (no CORS surprises, and the CSP never has to
   be loosened on the preview). It forwards the body verbatim — it holds no key
   of its own, so nothing here can be pointed at anyone else's account. */
async function serveEmailjs(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  try {
    const up = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw.length ? raw : "{}",
      signal: AbortSignal.timeout(15000)
    });
    const text = await up.text().catch(() => "");
    res.writeHead(up.status, {
      "Content-Type": up.headers.get("content-type") || "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(text);
    if (!up.ok) console.log(`  [emailjs] upstream ${up.status}: ${text.slice(0, 160)}`);
  } catch (e) {
    /* No network, DNS blocked, or the request died in flight. The form's own
       contract for this case is "not sent" — so that is exactly what it gets
       told, with the real reason kept here in the server log. */
    res.writeHead(502, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: false, kind: "proxy_unreachable", error: "The dev proxy could not reach api.emailjs.com." }));
    console.log(`  [emailjs] proxy failed: ${e && e.message ? e.message : String(e)}`);
  }
}

async function serveApi(req, res, pathname) {
  const file = API_ROUTES[pathname];
  if (!file) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, kind: "no_route", error: "No such endpoint. The contact form does not use a server endpoint any more — it sends through EmailJS from the browser." }));
    return;
  }
  try {
    const mod = await import(`${join(root, "api", file)}?t=${Date.now()}`);
    /* Minimal req/res shims matching what the handlers expect from a Vercel Node
       function: `req.headers`, `req.body`, `req.method`, async iterable `req`,
       plus `res.status().send()` and `res.setHeader()`. */
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    /* Vercel parses a JSON content-type into an object before the handler runs.
       Emulating that matters: if the shim behaves differently from production,
       local tests prove nothing about the deployed behaviour. */
    const ctype = String(req.headers["content-type"] || "");
    if (raw.length && ctype.includes("application/json")) {
      try { req.body = JSON.parse(raw.toString("utf8")); }
      catch { req.body = raw.toString("utf8"); }
    } else {
      req.body = raw.length ? raw.toString("utf8") : undefined;
    }

    const headers = {};
    res.setHeader = (k, v) => { headers[k] = v; };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (payload) => { for (const [k, v] of Object.entries(headers)) res.setHeader(k, v); res.end(payload); return res; };
    res.json = (o) => res.send(JSON.stringify(o));

    await mod.default(req, res);
  } catch (e) {
    console.error(`[api] ${pathname} threw:`, e);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, kind: "server_error", error: "The endpoint threw an exception." }));
    }
  }
}

/* ------------------------------------------------------------------------ boot */
const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    const colour = res.statusCode >= 500 ? "\x1b[31m" : res.statusCode >= 400 ? "\x1b[33m" : "\x1b[32m";
    console.log(`  ${colour}${res.statusCode}\x1b[0m ${req.method.padEnd(4)} ${pathname} ${ms}ms`);
  });
  /* Fake the geo header so the country code path is exercised locally too. */
  if (!req.headers["x-vercel-ip-country"]) req.headers["x-vercel-ip-country"] = process.env.DEV_FAKE_COUNTRY || "NG";

  if (pathname === "/api/emailjs") return serveEmailjs(req, res);
  if (pathname.startsWith("/api/")) return serveApi(req, res, pathname);
  return serveStatic(req, res, pathname);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} is already in use.\n` +
      `  Something else is listening there. Run it on another one:\n\n` +
      `      PORT=4176 npm run dev\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, "0.0.0.0", () => {
  const on = (k) => (process.env[k] ? "\x1b[32mset\x1b[0m" : "\x1b[33mnot set\x1b[0m");
  /* Read the shipped EmailJS config so `npm run dev` says, at boot, whether the
     form can actually deliver. Same test the browser runs: placeholders count
     as not configured. */
  let mailWired = false;
  let autoReplyWired = false;
  try {
    const cfg = readFileSync(join(SITE, "assets", "js", "emailjs-config.js"), "utf8");
    mailWired = ["user_id", "service_id", "template_id"].every((k) => {
      const m = cfg.match(new RegExp(k + '\\s*:\\s*"([^"]*)"'));
      return m && m[1] && !m[1].includes("REPLACE_WITH");
    });
    const auto = cfg.match(/auto_reply_template_id\s*:\s*"([^"]*)"/);
    autoReplyWired = !!auto && !!auto[1] && !auto[1].includes("REPLACE_WITH");
  } catch { /* missing config file — reported as not wired, which is true */ }
  console.log(`\n  BlaxkVERSE dev server — http://localhost:${PORT}`);
  console.log(`  ${loaded} variable(s) loaded from .env`);
  console.log(`\n  contact  : EmailJS ${mailWired ? "\x1b[32mwired\x1b[0m" : "\x1b[33mnot wired\x1b[0m"}, auto-reply ${autoReplyWired ? "\x1b[32mwired\x1b[0m" : "\x1b[33moff\x1b[0m"} (site/assets/js/emailjs-config.js; the form says so until it is)`);
  console.log(`  analytics: KV_REST_API_URL ${on("KV_REST_API_URL")}, KV_REST_API_TOKEN ${on("KV_REST_API_TOKEN")}`);
  console.log(`  dashboard: ADMIN_TOKEN ${on("ADMIN_TOKEN")}\n`);
});
