// check-links.mjs — crawl every page in site/ and resolve every internal link
// against the filesystem. Clean URLs are resolved the same way vercel.json
// rewrites them, so a link that works here works there.
import fs from "node:fs";
import path from "node:path";

const ROOT = "site";
const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
})(ROOT);

// vercel.json rewrites, in order
const rewrites = JSON.parse(fs.readFileSync("vercel.json", "utf8"))
  .rewrites.map((r) => [new RegExp("^" + r.source.replace(/:[a-z]+/gi, "([^/]+)") + "$"), r.destination]);

function resolveToFile(urlPath, fromDir) {
  const clean = urlPath.split("#")[0].split("?")[0];
  if (!clean) return { ok: true, kind: "anchor" };
  if (/^(mailto:|tel:|https?:)/.test(clean)) return { ok: true, kind: "absolute" };
  if (clean.startsWith("/")) {
    const bare = clean.slice(1);
    // clean URL via rewrite?
    for (const [re, dest] of rewrites) {
      const m = bare.match(re);
      if (m) {
        const d = dest.replace(/:slug/g, m[1] || "").replace(/^\//, "");
        const f = path.resolve(ROOT, d);
        return fs.existsSync(f) ? { ok: true, kind: "rewrite", to: d } : { ok: false, tried: d };
      }
    }
    for (const cand of [bare, bare + ".html", path.join(bare, "index.html")]) {
      const f = path.resolve(ROOT, cand);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return { ok: true, kind: "static", to: cand };
    }
    return { ok: false, tried: bare };
  }
  const f = path.resolve(fromDir, clean);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return { ok: true, kind: "relative" };
  if (fs.existsSync(f + ".html")) return { ok: true, kind: "relative" };
  return { ok: false, tried: path.relative(ROOT, f) };
}

let checked = 0, bad = 0, byKind = {};
const broken = [];
for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  const dir = path.dirname(page);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    const r = resolveToFile(url, dir);
    byKind[r.kind || "broken"] = (byKind[r.kind || "broken"] || 0) + 1;
    checked++;
    if (!r.ok) {
      bad++;
      broken.push(`${page}  ->  ${url}   (looked for ${r.tried})`);
    }
  }
}
console.log(`checked ${checked} internal references across ${pages.length} pages`);
console.log("by kind:", JSON.stringify(byKind));
if (bad) { console.log(`\n${bad} BROKEN:`); broken.slice(0, 40).forEach((b) => console.log("  " + b)); process.exit(1); }
console.log("all internal links resolve ✓");
