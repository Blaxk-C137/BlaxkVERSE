/* One static server, shared by every verification tool.
 *
 * Why this exists as a module rather than twenty copied lines in each tool:
 * audit.mjs, perf-site.mjs and check-quality.mjs each carried their own file
 * server, and all three had drifted from the host they were supposed to
 * imitate. The audit was reporting a broken link to /privacy from the admin
 * page and five console 404s — every one of them real in the harness and
 * impossible in production, where vercel.json rewrites clean URLs and
 * /api/track answers. A harness that does not emulate the platform produces
 * results that mean nothing, whichever colour they are.
 *
 * So this applies the rewrites in vercel.json, in order, exactly as the host
 * does, and answers the endpoints a page talks to:
 *
 *   POST /api/track    200 {"counted":false}  — a page view is accepted and
 *                       discarded. The beacon is being tested, not the store,
 *                       and a 404 here would be a harness artefact.
 *   POST /api/emailjs  200 "OK"               — stands in for the EmailJS send.
 *                       The contact form posts to api.emailjs.com in production;
 *                       a harness cannot send mail from a test run, and it must
 *                       not pretend the provider never answers, so it returns
 *                       what a real 2xx from EmailJS returns. Tests reach it by
 *                       overriding the endpoint in window.BX_MAIL, which keeps
 *                       the request same-origin and the CSP unmodified.
 *   GET  /api/stats    401                    — no token in a harness.
 *
 * It binds 127.0.0.1 and refuses to serve outside site/, because a test
 * harness that can read the filesystem is a liability, not a convenience.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../../site", import.meta.url));
const CONFIG = fileURLToPath(new URL("../../vercel.json", import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json"
};

/* The security headers, taken from vercel.json rather than restated here, so a
   harness can never be stricter or looser than the host. This matters: the
   admin dashboard's JavaScript was inline, which the real `script-src 'self'`
   silently blocks — and the audit passed anyway, because its harness sent no
   CSP header at all. A page that is dead in production was reported healthy.
   Now the harness sends exactly what the host sends, so the next mistake of
   that kind fails a check instead of reaching a visitor. */
async function loadHeaders() {
  try {
    const cfg = JSON.parse(await readFile(CONFIG, "utf8"));
    return (cfg.headers || []).map((h) => ({
      re: new RegExp("^" + h.source.replace(/\(.*\)/, "(.*)") + "$"),
      headers: Object.fromEntries(h.headers.map((x) => [x.key, x.value]))
    }));
  } catch {
    return [];
  }
}

/** Compile vercel.json's rewrite rules. `:slug` becomes a capture. */
async function loadRewrites() {
  try {
    const cfg = JSON.parse(await readFile(CONFIG, "utf8"));
    return (cfg.rewrites || []).map((r) => {
      const pattern = "^" + r.source.replace(/:[A-Za-z_]+/g, "([^/]+)") + "$";
      return { re: new RegExp(pattern), to: r.destination };
    });
  } catch {
    return []; // no config, no rewrites — the tools still work
  }
}

/** A path inside site/, or null if it climbs out of the tree. */
function safeJoin(pathname) {
  const clean = resolve(SITE, "." + pathname);
  if (clean !== SITE && !clean.startsWith(SITE + sep)) return null;
  return clean;
}

async function isFile(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

export async function serve({ port, quiet = true } = {}) {
  if (!port) throw new Error("serve() needs a port");
  const rewrites = await loadRewrites();
  const headerRules = await loadHeaders();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const send = (status, type, body) => {
      /* Apply the same headers the host applies to this path. */
      const extra = {};
      for (const rule of headerRules) {
        if (rule.re.test(pathname)) Object.assign(extra, rule.headers);
      }
      res.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        ...extra
      });
      res.end(body);
    };

    /* ---- the three endpoints, answered the way production answers ---- */
    if (pathname.startsWith("/api/")) {
      if (pathname === "/api/track") {
        req.resume(); // drain the beacon body so the socket can be reused
        return send(200, "application/json", JSON.stringify({ ok: true, counted: false, reason: "harness" }));
      }
      if (pathname === "/api/emailjs") {
        /* Stands in for the EmailJS send, the way the old /api/contact stub stood
           in for Resend. It reads the body so the request is well-formed, it
           answers the way the real provider answers — 200 with the plain text
           "OK", not a JSON envelope — and it never sends mail. Anything other
           than a POST is refused the way an unknown path on the real API is. */
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch { /* treated as a malformed send below */ }
        const creds = ["service_id", "template_id", "user_id"].every((k) => body[k] && !/REPLACE_WITH/.test(String(body[k])));
        if (req.method !== "POST" || !creds) {
          return send(400, "text/plain", "harness: missing or placeholder service_id/template_id/user_id");
        }
        return send(200, "text/plain", "OK");
      }
      if (pathname === "/api/stats") {
        req.resume();
        return send(401, "application/json", JSON.stringify({ ok: false, error: "unauthorised" }));
      }
      return send(404, "application/json", JSON.stringify({ ok: false, error: "not_found" }));
    }

    /* ---- static, with the host's clean-URL rewrites applied first ---- */
    const direct = safeJoin(pathname);
    if (direct) {
      const file = pathname.endsWith("/") ? join(direct, "index.html") : direct;
      if (await isFile(file)) return send(200, MIME[extname(file)] || "application/octet-stream", await readFile(file));
    }
    for (const { re, to } of rewrites) {
      const m = pathname.match(re);
      if (!m) continue;
      /* Captures start at index 1 — m[0] is the whole match. Each `:token` in
         the destination takes the next capture, in order. */
      let capture = 1;
      const target = to.replace(/:[A-Za-z_]+/g, () => m[capture++] ?? "");
      const resolved = safeJoin(target);
      if (resolved && (await isFile(resolved))) {
        return send(200, MIME[extname(resolved)] || "application/octet-stream", await readFile(resolved));
      }
    }
    send(404, "text/plain", "not found");
  });

  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return {
    server,
    base: `http://127.0.0.1:${port}`,
    close: () => server.close(),
    /** The compiled table, so a link checker can resolve clean URLs too. */
    rewrites
  };
}
