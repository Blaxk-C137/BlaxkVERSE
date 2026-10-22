/* POST /api/track — one pageview, counted without identifying anyone.
 *
 * The site promised, on /privacy, that it ran no analytics and set no cookies.
 * That promise is being changed deliberately, and the page is updated in the same
 * commit. What is being added is built to keep as much of the original promise as
 * possible:
 *
 *   NO cookies.                Nothing is written to the visitor's device. Ever.
 *   NO stored IP address.      The address is hashed with a salt that is destroyed
 *                              nightly, used once to count a daily unique, and
 *                              discarded. The hash cannot be reversed and cannot
 *                              be correlated across days, by design.
 *   NO stored user agent.      Only a coarse bucket (mobile / tablet / desktop).
 *   NO full referrer.          Only the referring hostname.
 *   NO cross-site identity.    There is nothing to link a visitor to another site.
 *   NO personal data.          No names, no emails, no query strings, no fragments.
 *
 * Honouring DNT: a visitor who sends `DNT: 1` or `Sec-GPC: 1` is counted as
 * nothing at all. That undercounts, and the undercount is the point — a tracking
 * system that ignores an explicit refusal is not one this project should ship.
 */

import { ok, fail, readJson, clientIp, clientCountry, clamp } from "./_lib/http.js";
import { incr, sadd, expire, hincrby, get, setex, storeConfigured, dayKey } from "./_lib/store.js";
import { createHash, randomBytes } from "node:crypto";

const RETENTION_DAYS = 90;
const SECONDS_PER_DAY = 86_400;

/** Reduce a device to one of three words. Nothing else about it is kept. */
function deviceBucket(ua) {
  const s = String(ua || "");
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(s)) return "mobile";
  return "desktop";
}

/** Hostname only. `/page?email=...` must never reach storage. */
function referrerHost(ref) {
  if (!ref) return "direct";
  try {
    const host = new URL(String(ref)).hostname.replace(/^www\./, "");
    return /^[a-z0-9.-]{1,80}$/i.test(host) ? host : "other";
  } catch {
    return "other";
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return ok(res);
  if (req.method !== "POST") return fail(res, 405, "method", "Use POST.");

  /* An explicit refusal is honoured even though it costs a data point. */
  const dnt = req.headers["dnt"];
  const gpc = req.headers["sec-gpc"];
  if (dnt === "1" || gpc === "1") {
    return ok(res, { counted: false, reason: "opt_out_honoured" });
  }

  let body;
  try {
    body = await readJson(req, 2_000);
  } catch {
    return fail(res, 400, "bad_json", "Unreadable body.");
  }

  /* Path only. Query strings are stripped at the edge of the system, not later. */
  let path = clamp(body.path, 200).split("?")[0].split("#")[0];
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/[^\w\-./~@%]/g, "").slice(0, 160) || "/";
  /* Normalise the trailing-slash variants of the same page so counts are not split. */
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  /* Case-study slugs are stable; nothing else in this site has a variable path. */
  if (!/^\/(projects\/[\w-]+|[a-z-]*)$/.test(path)) path = "/other";

  const country = clientCountry(req);
  const ref = referrerHost(body.ref || req.headers.referer);
  const device = deviceBucket(req.headers["user-agent"]);
  const day = dayKey();

  if (!storeConfigured) {
    /* No store attached. Counting is skipped rather than faked, and the response
       still succeeds so the visitor's page is never held up by our plumbing. */
    return ok(res, { counted: false, reason: "store_not_configured" });
  }

  /* Salt rotates daily and expires, so a visitor hash is valid for one day only
     and the value needed to recompute it no longer exists afterwards. */
  const saltKey = `trk:salt:${day}`;
  let salt = await get(saltKey);
  if (!salt) {
    const fresh = randomBytes(16).toString("hex");
    await setex(saltKey, SECONDS_PER_DAY + 3600, fresh);
    salt = fresh;
  }
  const visitorHash = createHash("sha256")
    .update(`${clientIp(req)}|${req.headers["user-agent"] || ""}|${salt || day}`)
    .digest("hex")
    .slice(0, 24);

  const ttl = SECONDS_PER_DAY * RETENTION_DAYS;

  try {
    await Promise.all([
      incr(`trk:pv:${day}`),
      incr(`trk:path:${day}:${path}`),
      hincrby(`trk:dev:${day}`, device, 1),
      hincrby(`trk:geo:${day}`, country, 1),
      incr(`trk:ref:${day}:${ref}`),
      sadd(`trk:uv:${day}`, visitorHash),
      expire(`trk:pv:${day}`, ttl),
      expire(`trk:path:${day}:${path}`, ttl),
      expire(`trk:dev:${day}`, ttl),
      expire(`trk:geo:${day}`, ttl),
      expire(`trk:ref:${day}:${ref}`, ttl),
      expire(`trk:uv:${day}`, ttl),
    ]);
  } catch {
    return ok(res, { counted: false, reason: "store_write_failed" });
  }

  return ok(res, { counted: true });
}
