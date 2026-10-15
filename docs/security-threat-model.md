# Security & Threat Model

**BlaxkVERSE** · BLAXK BYTE TECHNOLOGIES · review date 2026-10-15

> Scope: the static site (shipped), the GitHub ingestion service (specified), the Gemini service (specified), and the inquiry endpoint (specified). Each threat is rated by **impact × likelihood**, with the mitigation that is actually implemented or specified. Where a mitigation is not yet implemented, it says so.

---

## 1. What this system holds

Being precise about this determines everything below.

| Asset | Where it lives | Sensitivity | Notes |
|---|---|---|---|
| Published project records | `bx-data.js`, in the browser | Public | Facts about public repositories |
| Pinned code excerpts | `bx-excerpts.js`, in the browser | Public | Screened before publication |
| Repository screenshots | `site/assets/img/` | Public | Committed publicly |
| Site visitor data | **nowhere** | — | No analytics, no cookies, no storage |
| `GEMINI_API_KEY` | host secrets (not yet provisioned) | **Critical** | Would allow spend on the owner's account |
| `GITHUB_TOKEN` | host secrets (not yet provisioned) | High | Read-only scope only; raises rate limit |
| Visitor inquiries | nowhere yet (no server) | Personal | Names, emails, project details |
| Admin session | not yet implemented | High | Would authorise publishing |

**The most important sentence in this document:** the shipped build has no secrets, no accounts, no database, no server and no user input that leaves the browser. Its attack surface is a static file server. Everything from §4 onward describes what must be built *before* the service is switched on, and is written now so that the switch-on is a review rather than a scramble.

---

## 2. Shipped system — threats and posture

| # | Threat | Rating | Mitigation |
|---|---|---|---|
| S1 | Supply-chain compromise via a third-party script | **Eliminated** | Zero external requests, zero third-party JS. There is no CDN to compromise. |
| S2 | Malicious code in a code excerpt | **Eliminated** | Excerpts render as inert text. Nothing from a repository is parsed, evaluated or executed. Excerpts are sliced from a hash-verified cache at build time, so the published bytes are the source bytes. |
| S3 | Secret or credential published inside an excerpt | Low | Automated scan on every verification run for AWS/Google/OpenAI/Anthropic/GitHub/Slack token shapes, private-key blocks, JWTs, hardcoded credentials, `.env` usage patterns, personal email addresses and private-network addresses. One documented exception is allow-listed (the RFC 1918 example literal in a docstring) with the reasoning recorded. Treated as defence in depth, not a guarantee. |
| S4 | Visitor tracking without consent | **Eliminated** | No analytics, no cookies, no fingerprinting, no storage. Motion preference is carried in the URL rather than written to the device. |
| S5 | XSS via content injection | Low | No `innerHTML` on any dynamic string. All dynamic content is built with `createElement`/`textContent` (`BX.el` explicitly refuses an `html` attribute). Content is authored, not user-supplied. |
| S6 | Denial of service / resource exhaustion in the browser | Low | Canvas work is capped by viewport area and pauses offscreen and on tab hide; the render loop is a single rAF; nothing animates when `reduced` or `static`. |
| S7 | Clickjacking of the site | Low | `frame-ancestors 'none'` in the recommended CSP (§7). Note that the *preview* environment used for review legitimately frames the build, which is why CSP is specified for the deployment rather than baked into the source. |
| S8 | Misleading content published as fact | **High impact, low likelihood** | This is the project's central risk and it is treated as a security property, not an editorial one. `verify:content` re-checks every claim against the live GitHub API, fails on `shipped` without a deployment URL, fails on numeric claims with no recorded field, and fails if an excerpt's length does not match its line range. |
| S9 | Overstated capability by the assistant | Medium | The shipped assistant is deterministic. It cannot hallucinate: if a question is not covered by a record, it says so. |
| S10 | Contact form that silently discards inquiries | Low | The form validates, then states plainly that no server is attached and nothing was transmitted. A form that pretends to send is worse than one that admits it cannot. |

---

## 3. Privacy posture (shipped)

| Question | Answer |
|---|---|
| What personal data is collected? | None. |
| Cookies? | None. No banner because there is nothing to consent to. |
| Third-party requests? | None. No fonts, no CDN, no embed, no pixel. |
| Does the assistant send my question anywhere? | No. It is a local matcher over records that shipped with the page. Open the network tab and confirm. |
| Is anything written to my device? | No. Motion preference lives in the URL. |
| What about the contact form? | It validates locally and then tells you nothing was sent, because nothing was. |

This is documented publicly on `/privacy`, in language that describes what the code does — and that page must be updated whenever the code changes, or it becomes the same kind of unverified claim the site is built to avoid.

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
| P1 | TLS interception / downgrade | HTTPS only, HSTS, no mixed content (the site makes no external requests at all). |
| P2 | Dependency compromise | The static site has **zero** runtime dependencies. The build tooling uses `playwright-core` only, and it is not shipped. |
| P3 | Build pipeline tampering | Pinned dependency versions; generators are deterministic and idempotent; the verification run fails loudly on any fact it cannot confirm. |
| P4 | Admin interface exposed | `/admin` lives in the service, is authenticated, sends `noindex`, and is never linked from the public site. |
| P5 | Contact form abuse (spam, injection, email-header injection) | Server-side validation and length caps; header-injection characters rejected in the email field; a honeypot field plus rate limiting; delivery through a transactional provider rather than raw SMTP; the recipient address never taken from user input. |
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
| 6 | External origins referenced | `grep -rEoh 'https?://[a-z0-9.-]+' site` | **`github.com` ×73** (repository links) — plus four string literals: `localhost` ×2, `192.168.1.5` ×2, `myapp.local` ×2 |

**Caveats, stated rather than glossed:**

- **Item 6.** The `localhost` / `192.168.1.5` / `myapp.local` occurrences are **not** requests. They are text inside the Xposer code excerpt — a docstring describing the LAN address a phone would use. They render inside a `<pre>` as inert, selectable characters. The audit independently confirms **0 external requests** were made on any of the 16 pages; a string in a code sample cannot initiate one. This is also the exact literal that `verify:content` allow-lists with recorded reasoning (§2/S3).
- **Item 5** is a pattern scan, not a proof. Its real strength is architectural: excerpts are sliced from a SHA-256-verified cache at a pinned commit, so the published bytes are the source bytes and a human reviewed them.
- **`frame-ancestors 'none'` is specified, not applied** in the source, because the review preview environment legitimately frames the build. It belongs in the deployment's headers (§7).

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
3. **Rate limiting needs a real deployment to tune.** The values in §5 are reasoned starting points; they must be adjusted against observed traffic rather than trusted as configured.
4. **CI secret scanning is recommended** in addition to the content verifier, so a credential cannot reach a commit at all.
5. **The CSP must be tested against the real deployment** — particularly `connect-src` for the API origin — since the review preview environment legitimately frames the site.
6. **A data-retention statement is required** before the inquiry endpoint or any chat history is enabled, and it must be published on `/privacy` at the same time.
