/* A tiny Redis-over-HTTP client, and the reason it is hand-written.
 *
 * The site ships one third-party runtime library (GSAP). Adding an npm SDK for
 * what is fundamentally "POST a JSON array to a URL" would have doubled that for
 * no benefit, and an SDK is more code that can break an endpoint that has to keep
 * working. Redis REST is a documented two-verb protocol, so it is implemented here
 * in about forty lines.
 *
 * Works with either provisioning path, because Vercel KV is Upstash underneath:
 *   Vercel KV      → KV_REST_API_URL      + KV_REST_API_TOKEN
 *   Upstash direct → UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *
 * If neither is configured the store reports unavailable and callers degrade
 * rather than throw. The site must keep working with no database attached; that
 * is the same rule the whole build follows, and it is checked in `verify:env`.
 */

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const storeConfigured = Boolean(url && token);

async function command(parts) {
  if (!storeConfigured) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parts),
      /* Analytics must never be the reason a function hangs. */
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result ?? null;
  } catch {
    /* A cache or counter being unreachable is not worth failing a request over. */
    return null;
  }
}

/** Run several commands in one round trip. Returns null if the store is absent. */
async function pipeline(commands) {
  if (!storeConfigured) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data.map((d) => d?.result ?? null) : null;
  } catch {
    return null;
  }
}

export const incr = (key) => command(["INCR", key]);
export const expire = (key, seconds) => command(["EXPIRE", key, seconds]);
export const sadd = (key, member) => command(["SADD", key, member]);
export const scard = (key) => command(["SCARD", key]);
export const get = (key) => command(["GET", key]);
export const setex = (key, seconds, value) => command(["SETEX", key, seconds, value]);
export const hincrby = (key, field, n = 1) => command(["HINCRBY", key, field, n]);
export const hgetall = (key) => command(["HGETALL", key]);
export const mget = (...keys) => command(["MGET", ...keys]);
export const pipelineCmds = pipeline;

/**
 * Fixed-window rate limiter. Returns whether the caller is still allowed and how
 * many requests remain in the current window.
 *
 * Honest limitation, recorded rather than glossed: if no store is configured this
 * cannot count across instances, so it falls back to allowing the request. The
 * deployment documentation says so, and the contact endpoint validates and
 * sanitises independently of the limiter so that a missing limiter degrades
 * rate-limiting rather than safety.
 */
export async function rateLimit(bucket, identifier, limit, windowSeconds) {
  if (!storeConfigured) return { limited: false, remaining: limit, degraded: true };
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${bucket}:${identifier}:${window}`;
  const count = await incr(key);
  if (count === null) return { limited: false, remaining: limit, degraded: true };
  if (count === 1) await expire(key, windowSeconds + 5);
  return { limited: count > limit, remaining: Math.max(0, limit - count), count, degraded: false };
}

/** Keys use a date prefix so old data expires on its own and nothing accumulates. */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const dayKeys = (days = 14) => {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};
