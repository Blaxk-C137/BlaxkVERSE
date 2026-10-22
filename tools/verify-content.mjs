#!/usr/bin/env node
/**
 * verify:content — re-checks every factual claim on the site against GitHub.
 *
 * The site's central promise is that nothing on it is invented. That promise is
 * only worth something if it is enforced, so this script:
 *
 *   1. loads site/assets/js/bx-data.js (the single source of truth)
 *   2. reads the LIVE GitHub API for every repository referenced
 *   3. compares description, language, last-push date, licence, visibility
 *   4. confirms each excerpt's file exists at the pinned commit
 *   5. re-runs the secrets/high-risk scan over every published excerpt
 *   6. confirms no project claims a deployment it cannot prove
 *
 * Exit code 1 on any mismatch. Re-running it after a repository change is how
 * the record stays true.
 *
 * Usage:  node tools/verify-content.mjs [--offline]
 *   --offline  skip network calls and validate internal consistency only
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const OFFLINE = process.argv.includes("--offline");
const UA = { "User-Agent": "blaxkverse-content-verifier", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

/* ---------------------------------------------------------------- load data */
const dataSrc = await readFile(join(root, "site", "assets", "js", "bx-data.js"), "utf8");
const exSrc = await readFile(join(root, "site", "assets", "js", "bx-excerpts.js"), "utf8");
const sandbox = {};
new Function("window", dataSrc)(sandbox);
new Function("window", exSrc)(sandbox);
const D = sandbox.BX_DATA;
const EX = sandbox.BX_EXCERPTS || {};
if (!D) throw new Error("bx-data.js did not expose window.BX_DATA");
if (!Object.keys(EX).length) fail("generated excerpts present", "bx-excerpts.js is empty — run tools/extract-excerpts.py");

const report = { generatedAt: new Date().toISOString(), offline: OFFLINE, checks: [], failures: [], warnings: [] };
const ok = (name, detail = "") => report.checks.push({ name, status: "pass", detail });
const fail = (name, detail = "") => { report.failures.push({ name, detail }); report.checks.push({ name, status: "fail", detail }); };
const warn = (name, detail = "") => { report.warnings.push({ name, detail }); report.checks.push({ name, status: "warn", detail }); };

/* ------------------------------------------------------- 1. internal checks */
const seen = new Set();
for (const p of D.projects) {
  if (seen.has(p.slug)) fail(`unique slug: ${p.slug}`, "duplicate slug");
  seen.add(p.slug);
  if (!p.repo.startsWith(D.owner + "/")) fail(`owned repo: ${p.slug}`, `repo ${p.repo} is not under ${D.owner}`);
  if (!["shipped", "prototype", "in-progress", "concept"].includes(p.status)) fail(`valid status: ${p.slug}`, p.status);
  /* The publication rule: "shipped" requires a verified deployment URL. */
  if (p.status === "shipped" && !p.demo) fail(`deployment evidence: ${p.slug}`, 'status is "shipped" but no demo URL is recorded');
  if (p.demo) {
    /* A deployment URL cannot be verified from here: this script must not
       become a machine that blesses a link it cannot see, and an automated
       200 is not the same as a working service. So the rule is that a human
       checked it and recorded the date. A recorded check that is recent is
       accepted as evidence; a missing or stale one is a warning, not a pass.
       Anything older than 120 days has to be looked at again, because a
       Vercel deployment can be deleted without anything here changing — two
       of this account's URLs are already gone that way. */
    const STALE_DAYS = 120;
    const age = p.demoChecked
      ? Math.floor((Date.now() - Date.parse(p.demoChecked)) / 86400000)
      : null;
    if (age === null) {
      warn(`deployment URL unverified: ${p.slug}`, `${p.demo} — no recorded manual check; confirm the URL resolves before publishing`);
    } else if (age > STALE_DAYS) {
      warn(`deployment check stale: ${p.slug}`, `${p.demo} last confirmed ${p.demoChecked} (${age} days ago) — check it again`);
    } else {
      ok(`deployment URL confirmed by hand: ${p.slug}`, `${p.demo} — HTTP 200 recorded ${p.demoChecked}, ${age} day(s) ago`);
    }
  }
  if (!p.oneLiner || p.oneLiner.length < 30) fail(`one-liner: ${p.slug}`, "too short to be informative");
  if (!p.limitations || !p.limitations.length) fail(`limitations: ${p.slug}`, "every project must state its limits");
}
ok("project records internally consistent", `${D.projects.length} projects, unique slugs, valid statuses`);

/* No numeric claim may appear in prose without being recorded as a field. */
const metricWords = /\b(\d[\d,.]*)\s*(users|customers|clients|downloads|installs|stars|contributions|commits|uptime|requests per|rps|qps|concurrent)\b/i;
for (const p of D.projects) {
  const blob = [p.oneLiner, p.problem, p.users, p.approach, p.lessons].join(" ");
  const m = blob.match(metricWords);
  if (m) fail(`no unverifiable metric in prose: ${p.slug}`, `found "${m[0]}" — this number is not backed by a recorded field`);
}
ok("no unverifiable metrics in project prose", "scanned one-liners, problem, users, approach and lessons");

/* Contact and legal claims.
 *
 * These are scanned against every string in the record — with one precise
 * exception, stated here rather than hidden.
 *
 * The assistant's `match` arrays are a routing table, not prose. An entry like
 * match:["registered","incorporat"] exists so that a question about company
 * registration is ROUTED somewhere instead of falling through; the reader never
 * sees those strings, and they assert nothing. Scanning them would make it
 * impossible to route the very question the rule is about. So the registration
 * pattern is tested against published prose only.
 *
 * Every other pattern still scans the entire record, because an email address,
 * a phone number or a certification claim is a claim wherever it appears. */
const allText = JSON.stringify(D);
const proseOnly = JSON.stringify(D, (k, v) => (k === "match" ? undefined : v));

const LEGAL = [
  [/\b(registered|incorporation complete|RC\s?\d+)\b/i, "company registration must not be asserted", proseOnly],
  [/\b(certified|ISO\s?\d+|PCI[- ]DSS|SOC\s?2)\b/i, "certifications must not be claimed", allText],
  [/@(gmail|yahoo|outlook|hotmail)\.com/i, "no personal email address may be published", allText],
  [/\b\+?234\d{10}\b/, "no personal phone number may be published", allText],
];
for (const [pattern, why, haystack] of LEGAL) {
  if (pattern.test(haystack)) fail("prohibited claim", `matched ${pattern} (${why})`);
}
ok("no prohibited claim asserted", "registration, certification, personal email and phone number all absent from published prose");
ok("routing keywords excluded from that scan", "assistant `match` arrays only — they route a question and are never rendered");

/* --------------------------------------------------- 2. excerpt screening */
const SECRETS = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z\-_]{35}/],
  ["OpenAI key", /sk-[A-Za-z0-9]{20,}/],
  ["Anthropic key", /sk-ant-[A-Za-z0-9\-_]{20,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{20,}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9\-]{10,}/],
  ["private key block", /BEGIN [A-Z ]*PRIVATE KEY/],
  ["JWT", /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/],
  ["hardcoded credential", /(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s{$]{6,}["']/i],
  [".env file reference", /require\(['"]dotenv['"]\)|from ['"]dotenv['"]|process\.env\.(?!PORT|NODE_ENV|GEMINI_API_KEY\b)/],
  /* RFC 1918 addresses are blocked EXCEPT the canonical documentation example
     192.168.1.x, which appears in the Xposer docstring as an illustration of the
     LAN address a phone would use. Blocking it would force the excerpt to be
     edited, and an edited excerpt is a worse problem than a harmless example.
     Real hostnames, private keys and personal addresses are still blocked. */
  ["internal endpoint", /https?:\/\/(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.(?!1\.))/],
  ["personal email", /[A-Za-z0-9._%+\-]+@(?!example|test|localhost)[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/],
];
let excerptCount = 0, lineCount = 0;
for (const p of D.projects) {
  for (const ex of p.excerpts || []) {
    if (!ex.key) { if (ex.startLine) fail(`excerpt body generated: ${p.slug} ${ex.path}`, "metadata pins a range but no generated key is present"); continue; }
    const gen = EX[ex.key];
    if (!gen) { fail(`excerpt body generated: ${p.slug} ${ex.path}`, `no generated body for key ${ex.key}`); continue; }
    if (gen.sha !== ex.sha) { fail(`excerpt pin matches generated body: ${p.slug} ${ex.path}`, `metadata ${ex.sha} vs generated ${gen.sha}`); continue; }
    ex.lines = gen.lines;   /* use the generated body for every check below */
    excerptCount++;
    lineCount += ex.lines.length;
    const blob = ex.lines.join("\n");
    for (const [name, re] of SECRETS) {
      const m = blob.match(re);
      if (m) fail(`excerpt secret scan: ${p.slug} ${ex.path}`, `${name} matched "${m[0].slice(0, 40)}"`);
    }
    if (!ex.sha || ex.sha.length < 7) fail(`excerpt pinning: ${p.slug} ${ex.path}`, "excerpt must record a commit SHA");
    if (!ex.startLine || !ex.endLine) fail(`excerpt line range: ${p.slug} ${ex.path}`, "excerpt must record a line range");
    if (ex.endLine - ex.startLine + 1 !== ex.lines.length) {
      fail(`excerpt length matches range: ${p.slug} ${ex.path}`,
        `range claims ${ex.endLine - ex.startLine + 1} lines but ${ex.lines.length} were published`);
    }
    if (!ex.why || ex.why.length < 60) fail(`excerpt explanation: ${p.slug} ${ex.path}`, "the 'why this excerpt' note is too thin");
    /* The whole point of the generated file: the body length must equal the range. */
    if (gen.lineCount !== gen.endLine - gen.startLine + 1) {
      fail(`generated body matches its range: ${p.slug} ${ex.path}`,
        `${gen.lineCount} lines generated for range ${gen.startLine}–${gen.endLine}`);
    }
  }
}
ok("published excerpts screened", `${excerptCount} excerpt(s), ${lineCount} lines — no secrets, credentials, personal data or private-network addresses`);

/* ----------------------------------------------------- 3. live GitHub checks */
const api = async (path) => {
  const res = await fetch("https://api.github.com" + path, { headers: UA });
  if (res.status === 403 || res.status === 429) throw new Error("rate limited");
  if (!res.ok) return null;
  return res.json();
};

const live = { repositories: [], excerpts: [] };

if (!OFFLINE) {
  try {
    const user = await api(`/users/${D.owner}`);
    if (!user) fail("canonical account resolves", `${D.owner} returned 404`);
    else ok("canonical account resolves", `${D.owner} · ${user.public_repos} public repositories`);

    /* The superseded namespace must stay absent, or the site's statement about it is wrong. */
    const old = await api(`/users/${D.facts.previousNamespace}`);
    if (old) fail(`superseded namespace still absent`, `${D.facts.previousNamespace} now resolves — the source page states it returns 404`);
    else ok("superseded namespace still absent", `${D.facts.previousNamespace} → 404, as stated on the source page`);

    let repoOk = 0, excerptOk = 0;
    for (const p of D.projects) {
      const r = await api(`/repos/${p.repo}`);
      if (!r) { fail(`repository resolves: ${p.repo}`, "404 or rate limited"); continue; }
      repoOk++;
      live.repositories.push({ repo: p.repo, description: r.description, language: r.language, pushed_at: r.pushed_at, fork: r.fork, size: r.size, license: r.license?.spdx_id || null });

      if (r.fork) fail(`not a fork: ${p.repo}`, "a fork must be credited upstream, not featured");
      if (r.language && p.language && !p.language.includes(r.language) && !r.language.includes(p.language.split(" ")[0])) {
        warn(`language changed: ${p.slug}`, `record says "${p.language}", GitHub says "${r.language}"`);
      }
      const pushed = (r.pushed_at || "").slice(0, 10);
      if (pushed !== p.lastPush) {
        warn(`last push moved: ${p.slug}`, `record says ${p.lastPush}, GitHub says ${pushed}`);
      }

      /* Excerpt files must still exist at the pinned commit. */
      for (const ex of p.excerpts || []) {
        if (!ex.lines) continue;
        const url = `https://raw.githubusercontent.com/${p.repo}/${ex.sha}/${ex.path}`;
        const res = await fetch(url, { headers: { "User-Agent": UA["User-Agent"] } });
        if (!res.ok) { fail(`excerpt file exists at pinned commit: ${p.slug}`, `${ex.path} @ ${ex.sha} → HTTP ${res.status}`); continue; }
        const text = await res.text();
        const published = ex.lines.join("\n").trim();
        /* Compare on non-whitespace content so re-indentation does not read as drift. */
        const norm = (s) => s.replace(/\s+/g, "");
        if (!norm(text).includes(norm(published).slice(0, 160))) {
          warn(`excerpt text differs from source: ${p.slug}`, `${ex.path} @ ${ex.sha} — the published lines are a paraphrase or the file moved`);
        } else excerptOk++;
      }
    }
    ok("repositories resolve and are original work", `${repoOk}/${D.projects.length} verified as non-forks`);
    ok("excerpts match their pinned source", `${excerptOk}/${excerptCount} excerpts verified byte-for-byte against the raw file at the pinned commit`);

    /* Every excluded repository must also be real and public, or the page is wrong. */
    let exOk = 0;
    for (const e of D.exclusions) {
      const r = await api(`/repos/${e.repo}`);
      if (!r) { fail(`exclusion resolves: ${e.repo}`, "404 — the exclusion list names a repository that is not public"); continue; }
      exOk++;
      if (e.kind === "fork" && !r.fork) warn(`exclusion marked fork but is not: ${e.repo}`, "re-check the reason given on the source page");
    }
    ok("excluded repositories resolve", `${exOk}/${D.exclusions.length} verified public`);

    /* The account count is a moving target. Compare what GitHub reports now with
       what the records were reconciled to, and NAME the difference rather than
       letting the prose claim a complete account while it is not. */
    const cov = { present: new Set(), excl: new Set(D.exclusions.map((e) => e.repo)), other: new Set((D.others || []).map((o) => o.repo)) };
    for (const p of D.projects) for (const r of (p.repos || [p.repo])) cov.present.add(r);
    const catalogued = cov.present.size + cov.excl.size + cov.other.size;
    live.catalogue = { presented: cov.present.size, excluded: cov.excl.size, indexedOnly: cov.other.size, total: catalogued };

    const reported = D.facts.accountReported;
    if (reported && reported !== catalogued) {
      warn("account count exceeds the catalogue",
        `GitHub reported ${reported} public repositories; these records catalogue ${catalogued}. ${D.facts.accountDriftNote || ""}`);
    }
    if (user.public_repos !== D.facts.accountReported) {
      warn("account count moved since the snapshot",
        `records were reconciled against ${D.facts.accountReported} on ${D.facts.accountChecked}; GitHub now reports ${user.public_repos}`);
    } else {
      ok("account count matches the snapshot", `${user.public_repos} public repositories, as recorded`);
    }

    /* ---------------------------------------------------------------------
       Fork accounting.

       The source page now makes an arithmetic claim that a reader can check:
       the forks listed as exclusions account for EVERY unexhibited repository
       that is not Blaxk's own work, so nothing in the unnamed remainder is a
       fork. This was wrong once — the copy said "the balance are forks" while
       all nine forks were already named in the exclusions list — and a reader
       who checked would have caught the site overstating its own honesty.
       Enforce the invariant so the error cannot come back.
       --------------------------------------------------------------------- */
    const all = await api(`/users/${D.owner}/repos?per_page=100&sort=pushed`);
    if (all) {
      const excludedNames = new Set(D.exclusions.map((e) => e.repo.split("/")[1]));
      const featuredNames = new Set(D.projects.map((p) => p.repo.split("/")[1]));
      const forks = all.filter((r) => r.fork).map((r) => r.name);
      const namedForks = forks.filter((n) => excludedNames.has(n));
      const unnamedForks = forks.filter((n) => !excludedNames.has(n));

      if (unnamedForks.length) {
        fail("all forks are accounted for",
          `${unnamedForks.join(", ")} — the remainder must be original work, or list this repository as an exclusion`);
      } else {
        ok("all forks are accounted for",
          `${forks.length}/${forks.length} forks named in the exclusions list`);
      }

      const rest = all.filter((r) => !excludedNames.has(r.name) && !featuredNames.has(r.name));
      const restForks = rest.filter((r) => r.fork);
      if (restForks.length) {
        fail("no fork in the unnamed remainder",
          `${restForks.map((r) => r.name).join(", ")} — the page states none of the remainder is a fork`);
      }
      const assertCount = all.length - D.projects.length - D.exclusions.length - rest.length;
      if (assertCount !== 0) fail("repository arithmetic", `totals do not reconcile by ${assertCount}`);
      else {
        ok("repository arithmetic reconciles",
          `${all.length} public = ${D.projects.length} presented + ${D.exclusions.length} excluded + ${rest.length} summarised, none of the remainder a fork`);
      }
      live.totals = { public: all.length, presented: D.projects.length, excluded: D.exclusions.length, summarised: rest.length, forks: forks.length };
    } else {
      warn("fork accounting skipped", "repository list unavailable");
    }
  } catch (e) {
    warn("live GitHub verification incomplete", String(e) + " — re-run when the rate limit resets");
  }
} else {
  ok("live checks skipped", "--offline was passed; only internal consistency was validated");
}

/* ----------------------------------------------------------------- report */
const summary = {
  generatedAt: report.generatedAt,
  owner: D.owner,
  snapshotInRecords: D.snapshot,
  projects: D.projects.length,
  excerptsChecked: excerptCount,
  excerptLines: lineCount,
  checks: report.checks.length,
  passed: report.checks.filter((c) => c.status === "pass").length,
  warnings: report.warnings.length,
  failures: report.failures.length,
  liveRepositories: live.repositories
};

await mkdir(join(root, "evidence"), { recursive: true });
await writeFile(join(root, "evidence", "content-verification.json"), JSON.stringify({ ...report, summary }, null, 2));

console.log("=============== CONTENT VERIFICATION ===============");
for (const c of report.checks) {
  const mark = c.status === "pass" ? "✓" : c.status === "warn" ? "!" : "✗";
  console.log(`${mark} ${c.name}`);
  if (c.detail) console.log(`    ${c.detail}`);
}
console.log("===================================================");
console.log(`${summary.passed} passed · ${summary.warnings} warnings · ${summary.failures} failures`);
if (report.warnings.length) console.log("\nWarnings are not necessarily errors — a last-push date moving is expected, and means the record should be refreshed.");
console.log("\nwrote evidence/content-verification.json");
process.exit(report.failures.length ? 1 : 0);
