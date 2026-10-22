/* GET /api/stats — the numbers behind the /admin dashboard.
 *
 * Authentication is a bearer token held in the ADMIN_TOKEN environment variable.
 * There is no user database and no session, because a dashboard for one person
 * does not need either and both would be more to get wrong. The token is compared
 * in constant time so that a wrong guess leaks nothing about the right one.
 *
 * This endpoint returns aggregate counts only. It has no access to raw IPs, user
 * agents or referring URLs, because those were never stored — the strongest thing
 * that can be said about a data-retention policy is that the data does not exist.
 */

import { ok, fail } from "./_lib/http.js";
import { hgetall, mget, scard, storeConfigured, dayKey, dayKeys } from "./_lib/store.js";
import { timingSafeEqual } from "node:crypto";

function tokenMatches(header, expected) {
  if (typeof header !== "string" || !expected) return false;
  const a = Buffer.from(header.replace(/^Bearer\s+/i, "").trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Redis hashes come back as flat arrays in some clients and objects in others. */
function toObject(v) {
  if (!v) return {};
  if (!Array.isArray(v)) return v;
  const out = {};
  for (let i = 0; i < v.length; i += 2) out[String(v[i])] = Number(v[i + 1]) || 0;
  return out;
}

const top = (obj, n = 12) =>
  Object.entries(obj)
    .map(([k, v]) => ({ key: k, count: Number(v) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, 405, "method", "Use GET.");

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return fail(res, 503, "not_configured",
      "ADMIN_TOKEN is not set, so this dashboard is disabled. Set it in the project's environment variables.");
  }
  if (!tokenMatches(req.headers.authorization, expected)) {
    /* Deliberately vague: not "wrong token" but "not authorised". */
    return fail(res, 401, "unauthorised", "Not authorised.");
  }
  if (!storeConfigured) {
    return fail(res, 503, "store_missing",
      "No analytics store is attached. Add Vercel KV (or Upstash Redis) and redeploy to collect data.");
  }

  const days = dayKeys(30);
  const today = dayKey();

  try {
    const [pvAll, uvAll, todayDevices, todayGeo, todayPaths] = await Promise.all([
      mget(...days.map((d) => `trk:pv:${d}`)),
      mget(...days.map((d) => `trk:uv:${d}`)),
      hgetall(`trk:dev:${today}`),
      hgetall(`trk:geo:${today}`),
      hgetall(`trk:path:${today}`),
    ]);

    /* Unique visitors need a SCARD per day, which is one extra round trip each.
       Requests are cheap and this runs for one authenticated person, but the
       window is capped so the endpoint cannot be made to fan out unexpectedly. */
    const uniques = await Promise.all(days.slice(-14).map((d) => scard(`trk:uv:${d}`)));

    const series = days.map((d, i) => ({
      date: d,
      views: Number(pvAll?.[i]) || 0,
      uniques: i >= days.length - 14 ? Number(uniques[i - (days.length - 14)]) || 0 : null,
    }));

    const todayIndex = days.length - 1;
    const yesterdayIndex = days.length - 2;
    const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

    return ok(res, {
      generatedAt: new Date().toISOString(),
      retentionDays: 90,
      today: {
        date: today,
        views: Number(pvAll?.[todayIndex]) || 0,
        uniques: Number(uniques[uniques.length - 1]) || 0,
        devices: toObject(todayDevices),
        countries: top(toObject(todayGeo), 8),
      },
      yesterday: {
        date: days[yesterdayIndex],
        views: Number(pvAll?.[yesterdayIndex]) || 0,
      },
      totals: {
        views30d: sum(pvAll),
        views7d: sum(pvAll.slice(-7)),
        uniques14d: sum(uniques),
      },
      series,
      topPagesToday: top(toObject(todayPaths), 10),
    });
  } catch (e) {
    console.error("[stats] read failed:", e?.message);
    return fail(res, 502, "store_error", "The analytics store could not be read.");
  }
}
