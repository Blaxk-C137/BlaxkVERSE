/* End-to-end test of the live dev server: the contact path, the beacon and the
 * dashboard gate, in a real browser.
 *
 * This is deliberately NOT the audit. The audit runs against the shared harness
 * in tools/lib/site-server.mjs, which answers /api/* with a stand-in. This runs
 * against tools/dev-server.mjs, which executes the same track/stats handlers
 * Vercel runs and proxies the EmailJS send for real.
 *
 * The contact form no longer has a server endpoint of its own: it posts
 * browser → EmailJS, with the credentials read from
 * site/assets/js/emailjs-config.js. So this file reads that same file and
 * asserts whichever branch is true:
 *
 *   keys still placeholders → the form must REFUSE out loud and send no request
 *   keys real             → the test stops at the refusal boundary; it never
 *                           submits a filled form, because that would drop a
 *                           real enquiry into a real inbox from a test run
 *
 * Usage:
 *   node tools/dev-server.mjs &     # or npm run dev in another shell
 *   node tools/test-live.mjs
 *
 * Exits non-zero if any assertion fails.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const BASE = process.env.BASE || "http://127.0.0.1:4173";
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? `\n      ${detail}` : ""}`);
};

/* Which branch is true? Read the same file the browser reads. Placeholder or
   empty = unwired, and the form must refuse out loud. Real values = wired, and
   the test refuses to send you a junk email to find out. */
const cfgSrc = readFileSync(join(ROOT, "site", "assets", "js", "emailjs-config.js"), "utf8");
const wired = ["user_id", "service_id", "template_id"].every((k) => {
  const m = cfgSrc.match(new RegExp(k + '\\s*:\\s*"([^"]*)"'));
  return m && m[1] && !m[1].includes("REPLACE_WITH");
});
console.log(`\n  environment: EmailJS is ${wired ? "WIRED" : "NOT wired"} — asserting the ${wired ? "no-junk-send" : "honest-refusal"} branch\n`);

const browser = await chromium.launch();
const page = await browser.newPage();

/* ---------------------------------------------------------- the beacon --- */
const beacon = [];
page.on("request", (r) => { if (r.url().includes("/api/track")) beacon.push(r.method()); });
const beaconResponses = [];
page.on("response", async (r) => {
  if (r.url().includes("/api/track")) {
    beaconResponses.push(await r.json().catch(() => ({})));
  }
});

await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
await page.waitForTimeout(2500); // the beacon waits for requestIdleCallback
check("a page view is reported to /api/track", beacon.length === 1, `saw ${beacon.length} request(s), method ${beacon[0] || "—"}`);
check("the server answers the page view", beaconResponses.length >= 1, JSON.stringify(beaconResponses[0] || {}));

/* ------------------------------------------------------- script loading --- */
const scripts = await page.evaluate(() =>
  Array.from(document.querySelectorAll("script[src]")).map((s) => ({ src: s.getAttribute("src"), loaded: s.readyState !== undefined })));
check("the beacon script is referenced by the page",
  scripts.some((s) => String(s.src).includes("bx-analytics")),
  scripts.map((s) => s.src).filter(Boolean).slice(-2).join(", "));

/* ------------------------------------------------------- the contact form --- */
await page.goto(`${BASE}/contact.html`, { waitUntil: "load" });
await page.waitForTimeout(600);

/* Empty submit must be caught by the client, with no request sent. */
const before = beacon.length;
await page.click("[data-contact-form] button[type=submit]");
await page.waitForTimeout(400);
const empty = await page.evaluate(() => ({
  errs: document.querySelectorAll(".field-err").length,
  invalid: document.querySelectorAll('[aria-invalid="true"]').length,
  status: (document.querySelector("[data-contact-status]") || {}).textContent || ""
}));
check("an empty form is refused before it is sent", empty.errs >= 3 && empty.invalid >= 3,
  `${empty.errs} field errors, ${empty.invalid} aria-invalid`);

/* The send half — two different duties depending on the branch. */
const sends = [];
page.on("request", (r) => {
  if (r.url().includes("api.emailjs.com") || r.url().includes("/api/emailjs")) sends.push(r);
});

if (wired) {
  /* The config has real credentials, so a filled test submission would deliver
     a real "Deployment Test" email into the owner's inbox. The assertions in a
     test may never cost a human something; stop at the boundary, prove the
     wiring loads, and leave the delivery proof to the manual check in
     docs/deployment.md §2. */
  const loaded = await page.evaluate(() => ({
    hasCfg: !!window.BX_MAIL,
    endpoint: String((window.BX_MAIL || {}).endpoint || ""),
    autoReply: !/REPLACE_WITH/.test(String((window.BX_MAIL || {}).auto_reply_template_id || "REPLACE_WITH")),
    placeholders: ["user_id", "service_id", "template_id"].filter((k) => /REPLACE_WITH/.test(String((window.BX_MAIL || {})[k] || "")))
  }));
  check("the wired config is loaded by the page with no placeholders", loaded.hasCfg && loaded.placeholders.length === 0, `endpoint=${loaded.endpoint || "default"}, auto-reply=${loaded.autoReply ? "on" : "off"}`);
  check("the test refuses to send a real enquiry from a test run", sends.length === 0, "manual check documented in docs/deployment.md §2");
} else {
  /* Unwired: a filled, valid form must be refused out loud, with no request. */
  await page.fill("#cf-name", "Deployment Test");
  await page.fill("#cf-email", "test@example.com");
  await page.fill("#cf-what", "This is an automated end-to-end check of the enquiry path, long enough to pass validation.");
  await page.click("[data-contact-form] button[type=submit]");
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => {
    const s = document.querySelector("[data-contact-status]");
    return { state: s?.dataset?.state || "", text: (s?.textContent || "").trim().slice(0, 240) };
  });
  /* The important half: it must NOT claim to have sent anything. */
  check("an unwired form does not claim to have sent mail", after.state !== "ok", `state="${after.state}"`);
  check("it names the file that needs the keys", /emailjs-config\.js/.test(after.text), after.text);
  check("it sends no request at all", sends.length === 0, `${sends.length} request(s)`);
}

/* The retired server endpoint stays retired: nothing is listening there, and a
   404 that says so beats a silently-removed route an old bookmark would hit. */
const gone = await fetch(`${BASE}/api/contact`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Probe", email: "probe@example.com", what: "A probe long enough to pass validation." })
}).then((r) => r.json().then((j) => ({ status: r.status, j }))).catch(() => ({ status: 0, j: {} }));
check("the old /api/contact endpoint is gone, with an explanation", gone.status === 404 && gone.j.kind === "no_route", JSON.stringify(gone.j).slice(0, 140));

/* ------------------------------------------------------------ the dashboard --- */
await page.goto(`${BASE}/admin.html`, { waitUntil: "load" });
await page.waitForTimeout(500);
const gate = await page.evaluate(() => ({
  gateVisible: !document.querySelector("#gate")?.classList.contains("hide"),
  h1: document.querySelectorAll("h1").length,
  robots: document.querySelector('meta[name=robots]')?.getAttribute("content") || ""
}));
check("the dashboard asks for a token before showing anything", gate.gateVisible, `h1=${gate.h1} robots="${gate.robots}"`);
check("the dashboard is marked noindex", /noindex/.test(gate.robots), gate.robots);

await page.fill("#tok", "definitely-not-the-token");
await page.click("#gate-form button[type=submit]");
await page.waitForTimeout(2000);
const denied = await page.evaluate(() => ({
  msg: (document.querySelector("#gate-msg")?.textContent || "").trim().slice(0, 160),
  dashHidden: document.querySelector("#dash")?.classList.contains("hide")
}));
check("a wrong token is refused", denied.dashHidden === true, `"${denied.msg}"`);

/* ---------------------------------------------------------------- verdict --- */
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} passed · ${failed.length} failed\n`);
if (failed.length) { failed.forEach((f) => console.log(`  FAILED: ${f.name} — ${f.detail}`)); process.exit(1); }
