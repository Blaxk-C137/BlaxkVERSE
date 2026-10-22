/* Shared HTTP helpers for the serverless functions.
 *
 * Files under api/_lib/ are not routed by Vercel (the underscore prefix marks them
 * as internal), so this is a library rather than an endpoint.
 *
 * Everything here returns a fixed response shape. No upstream error body is ever
 * echoed to the client, because upstream errors are where credentials leak —
 * `docs/security-threat-model.md` K3 treats that as a rated threat, not a nicety.
 */

/** JSON response with no-store, so a cached error can never be mistaken for success. */
export function send(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(status).send(JSON.stringify(payload));
}

export const ok = (res, payload = {}) => send(res, 200, { ok: true, ...payload });

/** Every failure the client sees is one of a small fixed set of kinds. */
export const fail = (res, status, kind, message) => send(res, status, { ok: false, kind, error: message });

/**
 * Read and parse a JSON body with a hard size cap.
 * Vercel parses bodies for us in most runtimes, but the cap is what stops a
 * 10 MB payload being parsed into memory, so it is enforced either way.
 */
export async function readJson(req, maxBytes = 16_000) {
  let raw;
  if (typeof req.body === "string") {
    /* Some runtimes hand the body over as a raw string rather than a parsed
       object. Reading the stream again would yield nothing, because it is already
       consumed — which silently turned every field into an empty string and made
       a valid enquiry fail validation. Accept both shapes. */
    raw = req.body;
  } else if (req.body && typeof req.body === "object") {
    raw = JSON.stringify(req.body);
  } else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) throw new Error("payload too large");
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (raw.length > maxBytes) throw new Error("payload too large");
  if (!raw) return {};
  return JSON.parse(raw);
}

/** The client IP, from the header Vercel sets. Never stored — only hashed. */
export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).split(",")[0].trim();
  return req.socket?.remoteAddress || "0.0.0.0";
}

/** Coarse two-letter country from Vercel's edge. No lat/long, no city. */
export function clientCountry(req) {
  const c = req.headers["x-vercel-ip-country"];
  return typeof c === "string" && /^[A-Z]{2}$/.test(c) ? c : "XX";
}

export const clamp = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/**
 * Reject anything that could be used for header or content injection.
 * Recipients are never taken from user input, but newlines in a subject line are
 * still worth refusing on principle: it costs nothing and removes a class of bug.
 */
export const hasControlChars = (s) => /[\r\n\u0000-\u001f\u007f]/.test(s);

const EMAIL_RE = /^[^\s@,;:<>"']{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
export const isEmail = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);
