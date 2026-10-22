# BlaxkVERSE

**BLAXK BYTE TECHNOLOGIES** — portfolio, company site and experience system.
Built to `BLAXK_BYTE_Immersive_Website_Master_Spec.md`.

> A red/black, scroll-driven builder's portfolio. Thirty pages, no framework, no webfonts, no
> CDN, no cookies. Page views are counted by this site's own code — no third-party analytics,
> no stored IP address, no device identifier — and Do Not Track is honoured at both ends.
> The contact form is the one outbound request: the browser posts to EmailJS twice — the enquiry
> to me, then an acknowledgement to the visitor — with the keys and both template ids in
> `site/assets/js/emailjs-config.js`. The only third-party runtime code is GSAP, vendored locally
> for the motion layer. Every
> claim on it is checked against GitHub by a script that fails the build when it cannot
> verify one.

---

## Quick start

```bash
npm install                              # playwright-core only — build tooling, never shipped
npx playwright-core install chromium     # for the audit and performance harnesses

npm run build                            # excerpts → 30 pages (29 public + the dashboard)
npm run serve                            # http://localhost:4321
```

Verify the result:

```bash
npm run verify:content                   # re-checks every fact against the live GitHub API
npm run audit                            # 30 pages × a11y, keyboard, links, 3 motion modes, under the real CSP
npm run perf                             # LCP / CLS / long tasks across 270 runs (~35 min)
```

`npm run build` is deterministic and idempotent — running it twice produces byte-identical
output. The site has no build step at serve time; `site/` is plain files you can host anywhere.

---

## What was built

| Layer | Deliverable |
|---|---|
| **Prototypes** | Three runnable concepts, measured and scored, before any production code — the spec's §13A gate |
| **Site** | 30 pages: home, company, work, 21 case studies, source, lab, about, contact, privacy, and a private visitor dashboard at `/admin` |
| **Components** | All 12 named components from the spec, hand-built and documented |
| **Docs** | 7 required documents covering research, design, architecture, security, verification, performance and the prototype decision |
| **Evidence** | Machine-readable proof in `evidence/` — audit, performance, verification, prototype measurements |

---

## Repository map

```
docs/                        the seven required documents, plus the operational one
  experience-decision.md     ← the §13A gate: 3 prototypes scored, winner recorded
  component-research.md      every library: URL, licence, accept/reject, adoption cost
  design-system.md           tokens, palette, type, motion, a11y commitments
  architecture.md            data flow, the delivery layer, the deferred AI service
  security-threat-model.md   threats, ratings, mitigations, and what is NOT verified
  content-verification.md    what the verifier caught, and what is deliberately unclaimed
  performance-report.md      generated from real measurements
  deployment.md              Vercel, EmailJS, KV, environment variables, troubleshooting

vercel.json                  output directory, clean URLs, CSP + security headers, timeouts
.env.example                 every variable the deploy needs, with where to get each one

api/                         the delivery layer — two serverless functions
  track.js                   cookie-less page view → daily-salted hash → counters
  stats.js                   bearer token → aggregates for the dashboard
  _lib/http.js               responses, body reading, IP/country, validators
  _lib/store.js              dependency-free Redis-over-HTTP client

prototypes/                  3 runnable concepts + shared tokens + verified project data
site/                        the built site (this is the deliverable)
  index.html company.html work.html lab.html source.html about.html contact.html privacy.html
  admin.html                 private visitor dashboard (noindex, token-gated)
  projects/*.html            21 case studies
  assets/css/blaxkverse.css
  assets/js/bx-data.js       content: facts + reasoning (authored)
  assets/js/emailjs-config.js  the contact form's keys — paste here, survives `npm run build`
  assets/js/bx-excerpts.js   excerpt bodies (GENERATED — never hand-edit)
  assets/js/bx-admin.js      dashboard behaviour (GENERATED from the build)
  assets/js/bx-analytics.js  the page-view beacon
  assets/js/bx-core.js       all behaviour
  assets/img/                real screenshots from the repositories, and nothing else
sources/                     cached source files at pinned commits + MANIFEST.json
tools/                       build, extract, verify, audit, perf, quality, live test
  lib/site-server.mjs        the one harness: vercel.json's rewrites and headers, applied
evidence/                    generated proof (JSON committed; screenshots are not)
```

---

## The two rules that shaped everything

**1. Nothing is invented.** No fake projects, no fake metrics, no fake clients, no fabricated
contributions, no asserted legal status. Every project is marked `prototype` because none has
a verified public deployment. There are no numbers on the site that were not measured.

This is a gate, not a promise. `npm run verify:content` fails the build if a project claims
`shipped` without a deployment URL, if prose contains a metric with no recorded field behind
it, if a fork is featured, if the company's registration status is asserted, or if any
excerpt's body does not match its declared line range.

**2. Code excerpts are quoted, never typed.** `npm run build` slices every published excerpt
from a SHA-256-verified cache at a pinned commit, and the build aborts if a body's commit does
not match its metadata pin. The runtime refuses to render a stale quote. This rule exists
because it caught a real failure: an early hand-written excerpt was a paraphrase of the actual
source. `docs/content-verification.md` §2.1 records it.

---

## Repository accounting

The site presents **21 case studies** covering **23 public repositories**. The gap to the
rest of the account is stated plainly on `/source` rather than left for a reader to
notice, and every repository is listed there individually:

```
44 catalogued = 23 presented + 9 excluded + 12 indexed with a reason
```

| | Count | What it is |
|---|---|---|
| Presented as work | **23 repos** (21 case studies) | Full case studies with verified evidence. StatusFix spans three repositories. |
| Deliberately excluded | 9 | Upstream forks credited to their authors, plus two held on judgement |
| Indexed with a reason | 11 | Real repositories that do not carry case-study evidence |

"Featured" means curated into a full case study — problem, users, approach, decisions,
limitations, and where the repository has them, screenshots and a quoted excerpt — all
checked against GitHub. The 12 indexed repositories are not padding and not rejected
work; they are smaller tools, scaffolds and empty repositories, and each says which it is.

**Two honesty bugs were found in this area, both by the verification rather than by
inspection:**

1. An earlier draft claimed the unlisted remainder consisted of other people's forks. It
   did not — all nine forks were already named in the exclusions list, so the remainder
   contained **zero** forks. A reader who counted would have found the site overstating
   its own rigour. Fixed, and `all forks are accounted for` now enforces it.
2. Hard-coding "43 repositories" made the site silently claim a complete account the
   moment GitHub reported 44. The count is now split into *catalogued* and
   *account-reported*, a drift notice appears on `/source` when they disagree, and
   `verify:content` reports the difference instead of letting the prose go quietly stale.

## The gate: three prototypes before one production page

The specification forbids starting the site until three runnable concepts exist, are measured,
and the winner is documented — static mockups explicitly do not count.

| | Concept A — *Constellation* | Concept B — *Terminal* | Concept C — *Film* |
|---|---|---|---|
| Score | 81 / 100 | 85 / 100 | **86 / 100** |
| FPS desktop / mobile / low-end / reduced | 60 / 60 / 60 / 60 | 55 / 60 / 58 / 59 | 50 / 60 / 56 / 59 |
| p95 frame time | 16.8 ms | 33.3 ms | 33.4 ms |
| Result | Constellation adopted as `/work` | Nav model + project X-ray adopted | **Winner — narrative spine** |

Production is a synthesis, not a copy: **C** supplies the narrative spine, masked reveals,
signal dial and chapter numbering; **B** supplies the navigation rail, real search and the
three-faces project X-ray; **A** supplies the constellation field and — most valuably — the
finding that `backdrop-filter` over an animating layer costs 36 fps, now a binding rule.

Full scoring, the ten binding interaction rules, and reproduce commands: `docs/experience-decision.md`.

---

## Measured performance

30 pages × 3 viewports × 3 motion modes = **270 runs**, CPU throttled 1× / 4× / 6×, CLS
collected *during a scripted full-page scroll* — the only way to expose scroll-linked shift.

| Metric | Worst observed | Budget | Verdict |
|---|---|---|---|
| LCP | **384 ms** on `/source`, modest laptop, reduced motion | ≤ 2500 ms | ✓ |
| CLS | **0.0013** on `/contact`, modest laptop, reduced motion | ≤ 0.1 | ✓ |
| Longest task | 214 ms | — | reported |
| TBT proxy | 186 ms | — | reported |
| DOM nodes | 1097 (`/source`, the largest table) | — | reported |
| Transfer | 754 KB uncompressed, no CDN (`/projects/forma`) | — | reported |
| Console errors | **0 across all 270 runs** | — | ✓ |

Medians: desktop 104–116 ms · mobile 192–212 ms · modest-laptop 288–300 ms.

The CLS figure is the honest one to look at, because it is not zero. `/contact` moves 0.0013 px-
fractionally on the slowest simulated device when the form's status line reserves its space — 77×
inside budget, but it is a real movement and it is named here rather than rounded away. Every
other page measured 0.0000 or 0.0001.

**Three defects this process caught, all of which a "looks fine" review would have missed:**

1. **The hero canvas rendered at half resolution on every desktop viewport** (0.5×, while
   mobile was 1.27×). The LCP budget passed it, because half resolution is *faster*. Fixed
   to native on all screens, and paid for by removing ~28 array allocations per frame.
2. **CLS was 0.0253 before it was 0.0001.** Four separate blocks — the status legend, the
   count note, the filter bar, and the source chamber — were empty containers that
   JavaScript filled on load. All four are now rendered at build time.
3. **`automation` and `media` had no filter buttons**, making 11 projects unreachable by
   filter. The theme list was hard-coded; it is now derived from the records.

INP is **not** measured directly — headless Chromium cannot produce trustworthy input
latency, so a TBT proxy and long-task totals are reported instead and the JSON says so.

## Quality gates

| Command | What it proves |
|---|---|
| `npm run verify:content` | **15 passed, 1 warning, 0 failures.** (With the GitHub budget spent it degrades to 7 passed and reports the skipped rows as warnings rather than passes.) Every repository, exclusion, fork and excerpt re-checked against GitHub; excerpts compared byte-for-byte with the raw file at their pinned commit. Deployment URLs are confirmed by a recorded human check, because a script must not bless a URL it cannot see. The one warning is the unauthenticated GitHub rate limit |
| `npm run audit` | **30/30 pages, all green:** 0 HTTP failures, 0 JS errors, 0 failed requests, 0 broken internal links, a11y basics, 3 motion modes render, keyboard palette, assistant, contact validation — served with the same `Content-Security-Policy` Vercel applies |
| `npm run test:live` | **10/10:** a browser drives the real handlers — the page view is reported, an empty form is refused before it is sent, a filled form posts, the dashboard gates on a token, a wrong token is refused with a reason |
| `npm run check:links` | **1,529 internal references across 30 pages, 0 broken** — clean URLs resolved through `vercel.json`'s rewrite table |
| `npm run quality` | **4/4 checks.** Canvas fidelity (nothing upscaled), motion layer engages in `full` and is absent in `reduced`, CLS 0 named-by-element, filter integrity against the data |
| `npm run perf` | The budget table above: 270 runs with per-page, per-viewport detail |
| `npm run build` | Deterministic and idempotent; aborts on an excerpt pin mismatch |

Everything writes machine-readable output into `evidence/`.

---

## Deployment

`site/` is the deployment artifact — static files plus two serverless functions. The repository is
deployment-ready for Vercel: `vercel.json` declares the output directory, the clean-URL rewrites, the
security headers and the per-function timeouts, and the API lives in `api/` in the platform's
request/response shape, so the whole thing ships as one project with no build step and no bundler.

**The full walkthrough — Vercel, the EmailJS contact wiring, KV, environment variables and the
dashboard — is in [`docs/deployment.md`](docs/deployment.md).** The short version:

```bash
npm run dev            # http://localhost:4173 — serves site/ and runs the real API handlers
vercel deploy          # or connect the repo; Vercel reads vercel.json
```

Headers, set as real response headers by the host rather than merely recommended:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self';
  style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.emailjs.com; form-action 'self';
  frame-ancestors 'none'; base-uri 'none'; object-src 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

`script-src` is strict and admits no inline script and no `eval`; that is the directive that
actually prevents cross-site scripting, and it is unweakened. `style-src` carries
`'unsafe-inline'` because the build emits 1,259 inline `style` attributes and a nonce would not
help them. That is a recorded compromise, not an oversight — do not describe the policy as strict
in its entirety.

The contact form has no endpoint: it posts from the browser straight to EmailJS, with the public
key, service id and the notification and auto-reply template ids pasted once into
`site/assets/js/emailjs-config.js`, and it refuses
out loud until they are there. Two serverless functions remain: `/api/track` counts a page view
anonymously, and `/api/stats` returns aggregates to a token holder. Each degrades honestly
when its secret is absent rather than failing open or faking success. The GitHub ingestion cache
and the Gemini assistant described in `docs/architecture.md` §6–7 remain unbuilt, and the assistant
you can use on the site is a deterministic retriever over the content records with **no network
call at all** — which is what `/privacy` tells a visitor.

---

## Honest open items

Listed because this project's whole claim is that it does not overstate things.

**Blocked on decisions only the owner can make** (spec §16):

1. Approved logo and brand red — current tokens are the exploratory direction
2. `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM` and `ADMIN_TOKEN` — the contact form and the
   dashboard are finished and tested but cannot deliver or count until these are set;
   `docs/deployment.md` §2–4 walks through obtaining each one
3. A KV or Upstash Redis REST URL and token, for the same reason
4. Whether `GEMINI_API_KEY` / `GITHUB_TOKEN` will be provisioned (helpers: `.env.example`)
5. "TasteSkill / ThreeUI / reactdev" URLs — searched, no confirmed source exists; recorded as unresolved rather than guessed

**Known engineering debt:**

6. `gesture-controls` pin (`89ba2a3e5f`) should be re-verified before publishing
7. Concept C's prototype screenshot is a placeholder SVG (the production site does not use it)
8. No automated screen-reader pass — automated a11y checks pass, manual NVDA/VoiceOver testing outstanding
9. Most repositories have no licence file, which technically means all rights reserved; `/source` says so
10. The intelligence layer — the cached GitHub ingestion service and the Gemini-backed assistant —
    is specified in `docs/architecture.md` §6–7 and not built. The assistant you can use on the site
    is a deterministic retriever over the verified records, with no network call, and `/privacy`
    says so. The delivery layer (enquiry, visitor counting, dashboard) **is** built and deployed.

---

## Licensing and provenance

**Site code:** unlicensed private work of Blaxk Byte Technologies. See the note on repository
licences in open item 9.

**One third-party runtime dependency: GSAP 3.15.0, vendored at `site/assets/js/vendor/`.**
It drives the motion layer and is loaded from the same origin, so the site still makes zero
external requests. GSAP has been free including commercial use since April 2025, which is what
made it viable. Three.js, React Bits, shadcn/ui, Motion, Tailwind and Next.js remain deferred,
recorded in `docs/component-research.md` with real URLs, real licences and the reason for each —
note that **React Bits carries the Commons Clause** in addition to MIT, a real handover
consideration. The evaluation is not a rejection of the spec's intent; the architecture keeps a
reversible migration path open.

**Project screenshots and code excerpts** are the owner's own work, republished with
attribution and pinned commit SHAs. Forks are credited upstream, never exhibited.

---

*Built to the master specification, with every component, document and measurement the spec
called for — and a record of the things it turned out we could not honestly claim.*
