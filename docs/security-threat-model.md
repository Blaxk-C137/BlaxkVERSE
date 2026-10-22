# Security & Threat Model

**BlaxkVERSE** · BLAXK BYTE TECHNOLOGIES · review date 2026-10-16 · revision 2

> Scope: the static site, the inquiry endpoint, the visitor-count endpoint, the aggregate statistics endpoint, and the GitHub/Gemini services specified for a later phase. Each threat is rated by **impact × likelihood**, with the mitigation that is actually implemented. Revision 2 reconciles this document with the delivery layer that has since been written: the inquiry endpoint and the analytics endpoints now exist and are exercised by tests, so rows that described them as future work have been re-rated against the code rather than the plan.

---

## 1. What this system holds

Being precise about this determines everything below.

| Asset | Where it lives | Sensitivity | Notes |
|---|---|---|---|
| Published project records | `bx-data.js`, in the browser | Public | Facts about public repositories |
| Pinned code excerpts | `bx-excerpts.js`, in the browser | Public | Screened before publication |
| Repository screenshots | `site/assets/img/` | Public | Committed publicly |
| Site visitor counts | Upstash/Vercel Redis via `api/track.js` | **Anonymous** | Path, referrer hostname, width bucket, language, day-rotating hashed IP. No cookie, no stored IP, no user agent, no cross-day identifier. 90-day expiry. |
| `GEMINI_API_KEY` | host secrets (not provisioned) | **Critical** | Would allow spend on the owner's account. No endpoint reads it yet. |
| `GITHUB_TOKEN` | host secrets (not provisioned) | High | Read-only scope only; raises the rate limit for `verify:content`. Build-time use only. |
| Visitor inquiries | browser → EmailJS, no server in between | **Personal** | Name, email, project details. Honeypot-filtered in the browser, capped by EmailJS account limits, never persisted to anything this project controls. |
| EmailJS public key | `site/assets/js/emailjs-config.js`, shipped to every visitor | **Public by design** | EmailJS's model: the public key is meant to live in browser code; the service id and both template ids are not secrets either. The abuse boundary is the account's monthly cap and reCAPTCHA v3 on the template, set in the provider dashboard — not obscurity. |
| `ADMIN_TOKEN` | host secrets (not provisioned) | High | Unlocks aggregate visitor counts. Compared with `timingSafeEqual`; absent means the endpoint refuses. |

**The most important sentence in this document:** the browser-facing surface is still static HTML, CSS and JavaScript with no session, no cookie and no stored credential — the attack surface a visitor can reach is two small serverless functions that accept a page view and an authenticated statistics read, and nothing else; the enquiry path has no server half at all, it posts from the browser to EmailJS. There is no database, no user account, no file upload, no template rendering and no server-side code path that executes anything derived from a request body — the body the form composes is parsed by nobody but EmailJS, which expects exactly that shape. Everything from §4 onward is written against that reality: where a control is implemented it says so and points at the file, and where it is still a plan it is labelled a plan.

**What changed in revision 2, and why it is recorded rather than quietly edited:** the earlier revision stated that the shipped build had "no server" and that inquiries reached "nowhere". Both were true when written and are false now. A threat model that overstates its own isolation is worse than no threat model, because it retires controls that are still needed — so the rows below have been re-rated against the delivered code.

---

## 2. Shipped system — threats and posture

| # | Threat | Rating | Mitigation |
|---|---|---|---|
| S1 | Compromise via a third-party script | Low | One third-party runtime library (GSAP 3.15.0) is **vendored at the same origin** — added deliberately, pinned, licence header preserved, and loaded from `assets/js/vendor/` so the site still contacts no external host. The remaining attack path is a compromised package at install/build time rather than a hijacked remote script. Re-evaluated in the second pass: the earlier "Eliminated" rating is no longer accurate and has been corrected rather than left standing. |
| S2 | Malicious code in a code excerpt | **Eliminated** | Excerpts render as inert text. Nothing from a repository is parsed, evaluated or executed. Excerpts are sliced from a hash-verified cache at build time, so the published bytes are the source bytes. |
| S3 | Secret or credential published inside an excerpt | Low | Automated scan on every verification run for AWS/Google/OpenAI/Anthropic/GitHub/Slack token shapes, private-key blocks, JWTs, hardcoded credentials, `.env` usage patterns, personal email addresses and private-network addresses. One documented exception is allow-listed (the RFC 1918 example literal in a docstring) with the reasoning recorded. Treated as defence in depth, not a guarantee. |
| S4 | Visitor tracking without consent | **Low** | Page views are counted by first-party code, not a third-party product. No cookie, no `localStorage`, no device identifier, no stored IP and no stored user agent. The IP is combined with a salt that is destroyed daily, so the resulting hash counts one visit for one day and cannot be joined to another day. Do Not Track and Global Privacy Control are honoured in the browser **and** re-checked on the server, so a client that lies about its own preference is still refused. `/admin` is excluded from counting. Retention is 90 days and stated publicly on `/privacy`. This is deliberately not rated *eliminated*: a server does learn a visitor arrived, and pretending otherwise would be the exact overstatement this project exists to avoid. |
| S5 | XSS via content injection | Low | No `innerHTML` on any dynamic string. All dynamic content is built with `createElement`/`textContent` (`BX.el` explicitly refuses an `html` attribute). Content is authored, not user-supplied. |
| S6 | Denial of service / resource exhaustion in the browser | Low | Canvas work is capped by viewport area and pauses offscreen and on tab hide; the render loop is a single rAF; nothing animates when `reduced` or `static`. |
| S7 | Clickjacking of the site | Low | `frame-ancestors 'none'` is now set as a real response header in `vercel.json`, not merely recommended. It is applied by the host rather than baked into the markup, because the local preview used during review legitimately frames the build. |
| S8 | Misleading content published as fact | **High impact, low likelihood** | This is the project's central risk and it is treated as a security property, not an editorial one. `verify:content` re-checks every claim against the live GitHub API, fails on `shipped` without a deployment URL, fails on numeric claims with no recorded field, and fails if an excerpt's length does not match its line range. |
| S9 | Overstated capability by the assistant | Medium | The shipped assistant is deterministic. It cannot hallucinate: if a question is not covered by a record, it says so. |
| S10 | Contact form that silently discards inquiries | **Eliminated** | The form posts from the browser to EmailJS's REST endpoint and every outcome is stated in words on the page: sent, refused by the provider (its own sentence quoted back), or not wired yet (naming the file that needs the keys). The submit button is disabled while the request is in flight, so a double submission is not silently dropped, and a failure is announced rather than swallowed. Where mail is genuinely unwired the page says so — at load, before a visitor has written anything, not only at submit. |
| S11 | The public EmailJS key abused as a quota burner or spam amplifier | **Medium — accepted, bounded** | Client-side delivery gave up the old server endpoint's hashed-IP rate limit (5/hour) and its 20 KB body ceiling; that is the honest cost of removing the function, so the boundary moved to the provider: the honeypot now runs in the browser and discards bot submissions before they spend anything, the account carries a monthly cap, reCAPTCHA v3 on the template lets Google refuse automated sends, and EmailJS's own rate limits absorb bursts. Field length caps are enforced client-side before the fetch. A leaked *private* key is not possible — none ships; a visible public key is the design, bounded by the cap. The cap itself is an operator setting outside this repository, so CI cannot prove it is on: that is recorded in §9.3 rather than ticked. |
| S12 | `/admin` counts read by anyone who guesses the URL | Medium | The page carries `X-Robots-Tag: noindex` and `no-store` and is disallowed in `robots.txt`, but those are hygiene, not access control. The real control is `api/stats.js`: it refuses to answer without a bearer token, compares with `timingSafeEqual` so a wrong token leaks nothing by timing, and returns aggregates only — no paths, no hashes, no per-visitor rows. If `ADMIN_TOKEN` is unset the endpoint answers `store_missing` rather than defaulting open. |
| S13 | Analytics store as a privacy liability | Low | Nothing stored is identifying by design, so a breach of the store yields counts. Keys are namespaced by day and expire at 90 days, which bounds both the blast radius and the retention promise. |
| S14 | A page is silently dead because a policy blocks its own script | **Found and fixed** | The dashboard shipped its JavaScript inline while `vercel.json` set `script-src 'self'` with no `'unsafe-inline'` — so in production the token gate would have rendered and nothing would have responded to it, with the browser console as the only clue. Caught by a browser test against the real policy, not by review. The script is now `assets/js/bx-admin.js` and **zero inline scripts exist in the build**; the shared harness sends the production CSP so the class of bug fails a check in future. |

---

## 3. Privacy posture (shipped)

| Question | Answer |
|---|---|
| What personal data is collected? | None that identifies anyone. Page views are counted against a hash that is valid for one day and cannot be reversed. |
| Cookies? | None. No banner because there is nothing to consent to. |
| Third-party requests? | The contact form's sends to `api.emailjs.com` — the notification, then an acknowledgement to the address you typed — and only if you press Transmit. No fonts, no CDN, no embed, no pixel. The page-view beacon goes to this site's own origin. |
| Does the assistant send my question anywhere? | No. It is a local matcher over records that shipped with the page — the Gemini endpoint in §5 is specified and not built. Open the network tab and confirm. |
| Is anything written to my device? | No. Motion preference lives in the URL. |
| What about the contact form? | Your name, email and message go from your browser directly to EmailJS, which relays the enquiry to an inbox and — if you gave an address — sends you an acknowledgement quoting what you sent. Nothing is stored here. No request passes through this site's server, and nothing is written to your device. |
| Can I opt out of being counted? | Yes. Do Not Track or Global Privacy Control stops it, and the server refuses independently of what the browser claims. |

This is documented publicly on `/privacy`, in language that describes what the code does — and that page **has been** rewritten alongside this revision, because the previous text promised "no analytics" and that promise stopped being true the moment `api/track.js` was written. The rule that produced that correction is the one worth keeping: a disclosure page is a factual claim like any other, and it is verified against the code or it is removed.

---

## 4. Service — secrets and keys

| # | Threat | Rating | Mitigation |
|---|---|---|---|
| K1 | Gemini key exposed to the browser | **Critical × Low** | Server-side only. The key is read from host-managed environment variables inside server code. It is **never** placed in a `NEXT_PUBLIC_*`/`PUBLIC_*` variable, never serialised into a response, never logged, and never included in a build artifact. A prompt-injection attempt to exfiltrate it has no path, because the model has no tools and the response schema has no field for it. |
| K2 | Key committed to git | High × Medium | `.env*` is ignored; only `.env.example` with placeholder names is tracked. The excerpt pipeline refuses to publish `.env` content. Secret scanning should run in CI as well as in the content verifier. |
| K3 | Key leaked through an error message | Medium × Medium | Error responses return a fixed shape (`{ error, kind }`) with no upstream body echoed; provider errors are logged server-side with the key redacted. |
| K4 | Unbounded spend on the key | High × Medium | Per-IP and per-session rate limits, per-request token ceilings, a daily spend ceiling, response caching, and a hard switch to the static answer when the ceiling is reached. A leaked key that can spend without limit is a financial attack, and this is the control that bounds it. |
| K5 | `GITHUB_TOKEN` over-scoped | High × Low | Read-only public-repo scope; no write scope. A GitHub App with per-repository read is preferred over a broad PAT. No token at all is required for the current public-only design. |
| K6 | Secret scanning gives false confidence | Medium × Medium | Stated explicitly: the filter is defence in depth. The stronger control here is architectural — excerpts are pinned, hashed and sliced from verified bytes, so what is published is exactly what is in the file, and a human reviewed it. |

---

## 5. Service — the AI endpoint

| # | Threat | Rating | Mitigation |
|---|---|---|---|
| A1 | **Prompt injection via repository content** | **High × High** | Repository text, READMEs, comments and issue titles are treated as **untrusted input**. Retrieved content is passed as data, never as instructions. The model has **no tools, no network access, no filesystem and no write capability**; it can only return text that must satisfy a schema. Instruction-like content in a README is a data-integrity nuisance here, not a capability escalation. |
| A2 | Model invents prices, deadlines, clients, registration status or a project's completion | **High × High** | Retrieval is restricted to approved records; the system prompt constrains the model to those records and requires it to decline otherwise; output is schema-validated; the UI labels every answer as AI-generated and cites the records used. The refusal path is a designed feature, not an error. |
| A3 | Model claims to have read a whole repository | Medium × Medium | Only excerpts are provided, and the prompt states that explicitly. The answer must reference specific files and line ranges that were actually supplied. |
| A4 | Output used as an XSS vector | High × Low | Model output is inserted with `textContent`, never `innerHTML`; markdown, if enabled at all, is rendered through a strict allow-list with URLs limited to `https:`. |
| A5 | Abuse as a free general-purpose LLM | Medium × High | Rate limits per IP and session, input length caps, an intent classifier that rejects off-topic requests, caching of common answers, and observability on rejection rates. |
| A6 | Cost amplification attack | High × Medium | Token ceilings per request, concurrency caps, a spend ceiling with automatic fallback to the static answer, and per-IP quotas. |
| A7 | Personal data pushed into a third-party model | Medium × Medium | The assistant's corpus contains no personal data. Visitors are told not to paste personal information into the panel, and the inquiry form is the supported route for anything confidential. Logs are redacted. |
| A8 | Chat history leaks between visitors | High × Low | No persistent history by default. If history is ever stored, it is keyed to a session token, expires, and is disclosed on `/privacy` **before** it is enabled. |
| A9 | Silent model/prompt change alters behaviour | Medium × Medium | The model identifier is configuration, not a literal; prompts are versioned in the repository; the answer path has a deterministic fallback so a model change degrades to static answers rather than to wrong ones. |
| A10 | Admin drafting copilot publishes unreviewed content | **High × Medium** | Drafts are stored with `approved: false` and cannot be published without an explicit human action. Provenance (model, prompt version, timestamp, editor) is recorded with each draft. Auto-publish does not exist. |

**The design principle underneath all ten:** the AI is an *interpreter of approved evidence*, never a source of new facts. Every control above follows from that one sentence.

---

## 6. Service — GitHub ingestion

| # | Threat | Rating | Mitigation |
|---|---|---|---|
| G1 | Private or sensitive repository published | **High × Low** | Allowlist only; a repository existing is not a reason to publish it. Private access, if ever granted, produces drafts that require an explicit per-repository publish decision, and never exposes source, filenames, commit history or snippets publicly. |
| G2 | Publishing someone else's code as Blaxk's | High × Low | Forks are excluded from the portfolio and listed with their upstream authorship. The verifier fails if a featured repository is a fork. |
| G3 | Licence violation when republishing code | Medium × Medium | Repository licence is captured in the record and displayed. Repositories without a licence file are labelled "no licence file" and noted publicly as all-rights-reserved. Attribution is shown with each excerpt. |
| G4 | API credentials leak through server logs or errors | Medium × Low | Token read from host configuration, redacted in logs, never echoed in error responses. |
| G5 | Rate-limit exhaustion takes the site down | Medium × Medium | Cache-first architecture; the public site reads GitHub at build time, so a runtime outage cannot blank a page. On exhaustion the service serves cache with a visible staleness timestamp. |
| G6 | Malicious content in a README or issue | Medium × Low | Treated as untrusted data (see A1); never rendered as HTML; never executed. |
| G7 | Repository renamed or deleted | Low × Low | Treated as a defined state: the project row degrades to an absent section rather than a broken layout, and the verification run reports it so the record can be corrected deliberately. |

---

## 7. Platform and deployment controls

**Recommended response headers** (for the deployment; the static source already commits to no inline scripts, no external origins, and local-only assets):

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' data:;
  script-src 'self';
  style-src 'self';
  connect-src 'self' https://api.<domain>;
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'none';
  object-src 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

| # | Threat | Mitigation |
|---|---|---|
| P1 | TLS interception / downgrade | HTTPS only, HSTS, no mixed content; the external requests (the form's EmailJS sends) are HTTPS by construction, and the origin is pinned by both the CSP and a client-side check that refuses any other endpoint. |
| P2 | Dependency compromise | The static site has **zero** runtime dependencies. The build tooling uses `playwright-core` only, and it is not shipped. |
| P3 | Build pipeline tampering | Pinned dependency versions; generators are deterministic and idempotent; the verification run fails loudly on any fact it cannot confirm. |
| P4 | Admin interface exposed | `/admin` lives in the service, is authenticated, sends `noindex`, and is never linked from the public site. |
| P5 | Contact form abuse (spam, injection, email-header injection) | Client-side validation and length caps before anything is sent; a honeypot that discards bot submissions in the browser; delivery through a transactional provider rather than raw SMTP; parameters passed as JSON template fields, never assembled into headers by anyone but EmailJS; the recipient address fixed in the config file rather than taken from user input; reCAPTCHA v3 and an account monthly cap as the quota boundary. |
| P6 | Log leakage | Personal data redacted; no request bodies logged in full; secrets never logged. |

---

## 8. Security properties of the shipped build — executed, not asserted

These were run against the built output on 2026-10-15. The observed results are recorded verbatim, including the two that need a caveat rather than a clean tick.

| # | Property | Command | Result |
|---|---|---|---|
| 1 | No third-party script | `grep -rho '<script src="[^"]*"' site` | **6 tags, all local** — `bx-data.js`, `bx-excerpts.js`, `bx-core.js`, relative paths only. Zero external. |
| 2 | No inline script with code | regex over every generated HTML file | **0** |
| 3 | No inline event handlers | `grep -rn 'onclick=\|onload=\|onerror=' site` | **0** |
| 4 | No visitor storage | `grep -rn 'localStorage\|sessionStorage\|document.cookie\|indexedDB' site/assets/js/` | **0** |
| 5 | No secret-shaped string in the build | AWS / Google / OpenAI / Anthropic / GitHub / Slack / private-key / JWT patterns over every built file | **0 hits** |
| 6 | External origins referenced | `grep -rEoh 'https?://[a-z0-9.-]+' site` | **`github.com` ×73** (repository links) — plus four string literals: `localhost` ×2, `192.168.1.5` ×2, `myapp.local` ×2. *(Recorded before the EmailJS switch; on the current build `api.emailjs.com` joins the list — one intentional outbound origin, referenced only from `emailjs-config.js` and the CSP, never from page markup. Re-run to refresh this row.)* |

**Caveats, stated rather than glossed:**

- **Item 6.** The `localhost` / `192.168.1.5` / `myapp.local` occurrences are **not** requests. They are text inside the Xposer code excerpt — a docstring describing the LAN address a phone would use. They render inside a `<pre>` as inert, selectable characters. The audit independently confirms **0 external requests** were made on any of the 16 pages; a string in a code sample cannot initiate one. This still holds since the EmailJS switch — the outbound requests are fired only by the form's submit handler (the notification, then the acknowledgement), and the audit exercises them against a same-origin stub, never the live provider. This is also the exact literal that `verify:content` allow-lists with recorded reasoning (§2/S3).
- **Item 5** is a pattern scan, not a proof. Its real strength is architectural: excerpts are sliced from a SHA-256-verified cache at a pinned commit, so the published bytes are the source bytes and a human reviewed them.
- **`frame-ancestors 'none'` is applied by the host, not by the source.** It is a real response header in `vercel.json`, because the local review preview legitimately frames the build and a `<meta>` policy cannot express `frame-ancestors` anyway.
- **`script-src 'self'` is enforced in the harness as well as the host, and that is what found S14.** Every verification tool now serves the site with the same `Content-Security-Policy` Vercel sends. Before that, they sent none — and the dashboard's JavaScript was inline, which the real policy blocks silently. The dashboard would have been dead in production while every local check reported it healthy. See S14 in §2.

Reproduce:

```bash
cd blaxkverse
grep -rho '<script src="[^"]*"' site --include=*.html | sort -u
grep -rn 'localStorage\|sessionStorage\|document.cookie\|indexedDB' site/assets/js/
grep -rn 'onclick=\|onload=\|onerror=' site --include=*.html
grep -rEoh 'https?://[a-z0-9.-]+' site --include=*.html --include=*.js | sort | uniq -c | sort -rn
node tools/audit.mjs      # independently reports requests per page
```

---

## 9. Open security items

Stated rather than assumed:

1. **`GEMINI_API_KEY` and `GITHUB_TOKEN` are not provisioned.** Until they are, the AI endpoints do not exist and the assistant is the deterministic retriever described in §2/S9. This is the safe state, not a missing feature.
2. **No penetration test has been performed.** Nothing in this document should be read as a security certification, and no such claim is made anywhere on the site.
3. **Rate limiting needs a real deployment to tune.** The values in §5 are reasoned starting points; they must be adjusted against observed traffic rather than trusted as configured. For the contact form that now means the EmailJS dashboard: the monthly cap and the reCAPTCHA toggle are operator settings that live outside this repository, so nothing in CI can prove they are set.
4. **CI secret scanning is recommended** in addition to the content verifier, so a credential cannot reach a commit at all. The public EmailJS key is deliberately not a secret, but the scan still guards the line: a *private* key pasted into `emailjs-config.js` by mistake would be caught like any other credential.
5. **The CSP must be tested against the real deployment** — particularly `connect-src`, which must list `https://api.emailjs.com` or the contact form is silently dead in production while working in every preview — since the review preview environment legitimately frames the site.
6. **A data-retention statement is required** before any chat history is enabled, and it must be published on `/privacy` at the same time. The inquiry path has no retention by construction — there is no store on this side of the send — and `/privacy` §3 states exactly that as of the switch to client-side delivery.
