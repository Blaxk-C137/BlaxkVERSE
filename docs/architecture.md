# Architecture

**BlaxkVERSE** · BLAXK BYTE TECHNOLOGIES · status: static build shipped, server service specified

---

## 1. The shape of the thing

Two systems, deliberately separated.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SYSTEM 1 — THE SITE  (built, shipped, running)                          │
│                                                                          │
│   content records          build tools                 output            │
│   ─────────────────        ───────────                 ──────            │
│   site/assets/js/          tools/build-content.py  →   16 static pages   │
│   bx-data.js          →    tools/extract-excerpts.py   1 stylesheet      │
│   (facts + reasoning)                                  4 JS modules       │
│                                                        13 images         │
│   sources/                 tools/verify-content.mjs                     │
│   (pinned files)      →    (re-checks facts vs GitHub)                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ build-time read only.
                                    │ Never a runtime dependency.
┌──────────────────────────────────────────────────────────────────────────┐
│  SYSTEM 2 — THE DELIVERY LAYER  (built)                                  │
│                                                                          │
│   Inquiry     →  honeypot → validate → EmailJS (browser → provider)      │
│   Page view   →  DNT/GPC  → hash+day-salt → counters       → /api/track  │
│   Dashboard   →  bearer token → aggregates                 → /api/stats  │
│                                                                          │
│  SYSTEM 3 — THE INTELLIGENCE LAYER  (specified, not yet built)           │
│                                                                          │
│   GitHub API  →  fetcher → allowlist → normalise → cache → /api/github/* │
│   Gemini API  →  retrieval → validation → budget  →       /api/ai/*      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why split.** The public pages are content, and content does not need to be assembled per request. Each page is rendered to static HTML at build time, so reading a page involves no database, no template engine and no API key — the only code that runs per request is three small endpoints for an enquiry, a page view and a statistics read. That split is why a page cannot be taken down by an upstream failure, why hosting is free at any traffic this site will see, and why the CSP can be strict: there is no server-side rendering surface for an attacker to reach through a query string.

The service exists for the three things that genuinely require a server: caching live repository data, holding a Gemini key, and accepting an inquiry. Those are specified in §6 and §7.

---

## 2. System 1 — the static build

### 2.1 Data flow

```
sources/*.py, *.ts                 site/assets/js/bx-data.js
(cached at pinned commits)         (hand-authored: facts + reasoning)
        │                                    │
        │  tools/extract-excerpts.py         │
        │  · verifies sha256 against         │
        │    sources/MANIFEST.json           │
        │  · refuses on any mismatch         │
        ▼                                    │
site/assets/js/bx-excerpts.js  ────────────►│
(generated: verbatim code)                  │
                                            ▼
                                    tools/build-content.py
                                    · loads both modules through Node
                                    · refuses a body whose commit ≠ pin
                                            │
                                            ▼
                                    site/**/*.html  (16 pages)
```

**The rule this enforces:** a published code excerpt is a factual claim about a file. Therefore it is **never typed by hand** — it is sliced from the cached source at the pinned commit. This was not theoretical: an earlier hand-written excerpt was caught as a paraphrase by `verify:content` (see `docs/content-verification.md`), and the pipeline was rebuilt so that class of error cannot recur.

### 2.2 Why the content lives in `bx-data.js`

One file holds every fact and every piece of editorial reasoning about the work: problem, users, approach, decisions, limitations, lessons, plus the assistant's knowledge base and the exclusion list.

It is a JavaScript module because the **same records drive both the static HTML and the runtime** — the filter counts on `/work`, the palette index, and the assistant's answers all read the identical objects. There is no second copy of the content anywhere, so the site cannot contradict itself. A change to a project is a change in one file, and `verify:content` then re-checks it against GitHub.

### 2.3 Page inventory

| Route | File | Rendering | Purpose |
|---|---|---|---|
| `/` | `index.html` | static | Arrival, five-second identity, journey overview |
| `/company` | `company.html` | static | Services offered today + capabilities under development |
| `/work` | `work.html` | static + runtime filters | Constellation, theme filters (URL-backed), full project index |
| `/work/[slug]` | `projects/*.html` (8) | static | Case studies with source chambers |
| `/source` | `source.html` | static | Repo table, technology trace, deliberate exclusions, ingestion design |
| `/lab` | `lab.html` | static | Experiments, concepts, and the three experience prototypes |
| `/about` | `about.html` | static | Blaxk, capabilities with evidence, verifiable timeline |
| `/contact` | `contact.html` | static + runtime validation | Inquiry form, process, honest fit/mismatch lists |
| `/privacy` | `privacy.html` | static | Data, AI and code-display disclosures |

The master specification's original sitemap also listed `/admin`. It now exists, but not as a curation interface for publishing: it is a private **read-only operations view** for visitor counts, gated by `ADMIN_TOKEN` and served `noindex, no-store`. The publishing/curation interface the spec described belongs in the service and is still specified rather than built (§6.5). The distinction matters — a page that can only read aggregates is a different risk from one that can publish.

### 2.4 Runtime modules

Six files, loaded in order. Only one is third-party, and it is self-hosted:

| File | Size | Responsibility |
|---|---|---|
| `bx-data.js` | ~48 KB | Content records. No logic. |
| `bx-excerpts.js` | generated | Verbatim excerpt bodies, keyed by `repo::path`. |
| `vendor/gsap.min.js` + `vendor/ScrollTrigger.min.js` | 71 + 43 KB (44 KB gzipped) | GSAP 3.15.0, vendored. The only third-party runtime code. |
| `bx-motion.js` | ~7 KB | The GSAP layer: hero timeline, scroll reveals, progress rail, counters, magnetic CTAs. Returns immediately in reduced/static modes. |
| `bx-core.js` | ~34 KB | All behaviour: motion modes, navigation, palette, canvas fields, source chamber, assistant, form validation, filters. |
| (inline) | — | Nothing. No inline scripts, so the site runs under a strict CSP without `unsafe-inline`. |

Internally `bx-core.js` is organised as:

```
motion        three modes, OS + URL, shareable, never gates content
director      the single rAF scroll loop; tasks write transforms only
initSignalField / initWorkField     capped, pausable 2D canvas
initNav / initPalette               navigation, keyboard parity
initReveals   IntersectionObserver, once per element
renderCode / highlightLine          source chamber + inert tokeniser
initAssistant / initWorkFilters / initContact
```

The `director` is the only code that reads scroll position. Everything animated registers a task with it, which is why there is exactly one frame loop on the page.

### 2.5 Generated vs authored

| Generated | Authored |
|---|---|
| `site/**/*.html` (30 pages) | `bx-data.js` |
| `site/assets/js/bx-excerpts.js` | `bx-core.js`, `blaxkverse.css` |
| `evidence/*.json`, `docs/performance-report.md` | `docs/*.md` (other than performance) |
| `sources/MANIFEST.json` | `prototypes/*` |
| | `tools/*` |

Regenerating is idempotent: `python3 tools/extract-excerpts.py && python3 tools/build-content.py`.

---

## 3. Build and verification pipeline

```bash
npm install && npx playwright-core install chromium   # Playwright only
python3 tools/extract-excerpts.py    # verbatim excerpts, hash-verified
python3 tools/build-content.py       # 16 pages, refuses a stale pin
node tools/verify-content.mjs        # facts vs live GitHub API
node tools/audit.mjs                 # 16 pages × a11y, keyboard, links, 3 modes
node tools/perf-site.mjs             # LCP / CLS / long tasks, 270 runs
node tools/measure.mjs && node tools/report.mjs   # prototypes → performance report
```

Each tool writes machine-readable evidence into `evidence/`, and each fails loudly rather than proceeding on a wrong assumption. `verify-content` in particular **refuses to pass** if a project claims a deployment it cannot prove, if a prose sentence contains a metric with no recorded field behind it, if an excerpt range and body length disagree, or if a secret appears in published code.

---

## 4. Failure modes and how the site behaves

| Failure | Behaviour |
|---|---|
| JavaScript disabled | Every page's content, headings, links and excerpts are static HTML. Filters degrade to a `<noscript>` list. |
| GitHub outage | Irrelevant at runtime — the site reads GitHub at build time. A live-site refresh would surface stale data labelled with its timestamp (see §6.3). |
| A repository is deleted or renamed | `verify:content` fails on the next run; the fix is deliberate, not silent. |
| Reduced motion requested | Camera parks, canvas disappears, content identical. |
| Low-power device | Canvas resolution drops by area; rendering pauses offscreen. |
| Assistant asked something unrecorded | It says so and offers the contact route. It does not improvise. |
| Form submitted and mail is unconfigured | It validates, posts, and reports `not_configured` in words. It never reports a delivery that did not happen. |
| Mail provider rejects the send | The caller receives a generic `provider` error; the status, key and upstream text are logged server-side only. |
| The visitor blocks tracking | DNT/GPC, checked in the browser and again in `api/track.js`, stops the request. |
| Font unavailable | Stacks fall back through system fonts; JetBrains Mono is requested, never loaded. |
| Images blocked | `width`/`height` are set, so layout does not shift; captions still describe what the image showed. |

---

## 5. Performance architecture

Measured (not asserted) — full data in `docs/performance-report.md` and `evidence/site-performance.json`:

| Metric | Worst case across 16 pages × 3 viewports × 3 modes | Budget |
|---|---|---|
| LCP | **424 ms** | ≤ 2500 ms |
| CLS (measured during a full-page scroll) | **0.0069** | ≤ 0.1 |
| Longest main-thread task | 236 ms (6× CPU-throttled pass) | — |
| DOM nodes | 431 max | — |
| Transfer | 173–567 KB uncompressed, 0 external requests | — |

Techniques that produced those numbers:

- Static HTML — no hydration, no framework runtime, no client-side content assembly.
- Zero third-party requests, zero webfonts, zero analytics.
- `transform`/`opacity` only in animation, so the compositor does the work.
- Canvas capped by viewport area and paused when offscreen or hidden.
- `width`/`height` on every image; lazy loading below the fold.
- No `backdrop-filter` over animated content (the single largest measured win: 24 → 60 fps).

CLS is watched especially closely because scroll-driven sites fail there; it is measured **while the page is scrolled**, which is the only scenario that exposes scroll-linked layout shift.

---

## 6. System 2 — the GitHub service (specified)

### 6.1 Connection modes

| Mode | Access | When to use |
|---|---|---|
| **1 — Public read (MVP)** | No auth; public repos only; 60 req/h/IP | Default. Least privilege, simplest UX. |
| **2 — GitHub App** | Read-only, per-repository, webhooks | If live updates are wanted for curated repos. |
| **3 — Admin/private** | Private repos for drafting | Private content never published without an explicit per-repo decision. |

Public read with a server-side cache is the recommended starting point. A GitHub App should only be installed if webhook-driven freshness is genuinely needed — it is not needed to display a portfolio.

### 6.2 Pipeline

```
GitHub REST/GraphQL
   → server fetcher (token from host secrets, never client-side)
   → repository allowlist (explicit include list; existing ≠ published)
   → metadata normalisation
   → content cache (revalidate on a schedule or webhook)
   → /api/github/repositories, /api/github/snippet
   → server-rendered or build-time pages
   → visualisations
```

### 6.3 Cache and degradation

- Responses cached by ETag with a revalidation window (suggested 6–24h).
- Rate-limit state tracked; on exhaustion, serve cache and mark it stale with a timestamp.
- **"Updated" always carries a timestamp.** A single recent push is never rendered as "actively maintained".
- Missing README, renamed repository, deleted repository, 404 and API outage each produce a defined, tested state — an absent section, never a filled one.

### 6.4 Snippet pipeline

```
curated record (repo + commit SHA + path + start/end lines)
   → fetch at the pinned commit (raw CDN, not the API)
   → size and line-count limits
   → secrets / high-risk content filter
   → syntax highlight (server-side)
   → publish with: language, path, line range, commit SHA, purpose, trade-offs
```

Limits: max 400 lines and 40 KB per excerpt. The filter blocks tokens, passwords, `.env` content, personal data, private network addresses and credential patterns — and it is treated as **defence in depth, not a guarantee**, which is why the excerpt bodies in this build are also hashed and slice-verified.

**Untrusted-code rule:** highlighted text only. Nothing from a repository is ever parsed, evaluated or executed in a visitor's browser, and never fetched into the page at runtime.

### 6.5 Curation interface (`/admin`, service-only)

Authenticated, not indexed, not linked from the public site:

- Discovered repositories with include/exclude, featured order and project mapping.
- Status assignment (shipped / prototype / in-progress / concept) — enforced: `shipped` requires a deployment URL.
- Excerpt editor with path/commit/range pickers, preview, and the filter result shown before publish.
- A publish step that writes the *same* `bx-data.js` record shape used by the static build, so the site and the service cannot diverge.

---

## 7. System 2 — the Gemini service (specified)

### 7.1 Endpoints

| Endpoint | Purpose | Retrieval corpus |
|---|---|---|
| `POST /api/ai/explain` | Explain a build at Beginner / Developer / Business level | That project's record + its README extracts + its published excerpts |
| `POST /api/ai/support` | Answer questions about services, projects, capabilities, process | `knowledge` records + service records |
| `POST /api/ai/draft` | Admin-only first drafts of summaries and changelogs | Allowlisted repo data; **requires human approval before publish** |

### 7.2 Request flow

```
visitor
  → rate limit (per IP + per session)
  → input validation (length, content type)
  → intent classification
  → approved-content retrieval            ← the assistant can only see this
  → Gemini (server-side key, model id from config)
  → structured output validation (schema)
  → response, with the records it used cited
  → UI, labelled as AI-generated with source links
```

### 7.3 Controls

- **Key:** server-side only. Never in client JavaScript, never in a `NEXT_PUBLIC_*` variable, never in a build log.
- **Validation:** input length and type; output schema-checked before render.
- **Limits:** per-IP and per-session rate limits, token ceilings, a daily spend ceiling, and abuse controls.
- **Prompt injection:** README text, issue text and code comments are treated as **untrusted input**. The assistant has no tools, no write access and no network access. Retrieved content is passed as data, never as instructions.
- **Privacy:** no persistent history by default; if retention is ever enabled it is disclosed on `/privacy` before it is switched on, and logs are redacted of personal data.
- **Cost:** popular answers cached; streaming only where it helps; a deterministic static answer always available when the model fails or the budget is exhausted.
- **Honesty:** every AI answer is labelled, cites its sources, and never claims to have read a whole repository when only excerpts were provided.
- **Escalation:** unknown questions offer the contact route instead of improvising.

### 7.4 The current build's position

The shipped assistant is a **deterministic retriever** over the records in `bx-data.js`, running entirely in the browser with **no network request at all**. It refuses to answer outside its records and states that it is not a model.

This is the honest intermediate state. Shipping the retrieval layer first means the failure mode ("I don't know, here is how to ask a person") already exists, and the model call becomes an addition behind controls that are already tested — rather than a dependency on which the product's credibility rests.

---

## 8. Content system

Editorial content ships as data, in `bx-data.js`:

```
projects[]   slug, title, tagline, status, repo, demo, language, stack, themes,
             lastPush, sha, files, bytes, license, featured, order,
             oneLiner, problem, users, approach, contribution,
             decisions[], limitations[], lessons, screenshots[], excerpts[]
services[]   id, name, active, problem, approach, deliverables[], evidence[]
timeline[]   date, event, detail, kind
skills[]     name, evidence[project slugs]
knowledge[]  id, match[], answer, links[]
exclusions[] repo, reason, kind
facts        owner, snapshot, publicRepositories, previousNamespace, ...
```

Enforced invariants (checked by `verify:content`):

1. `status: "shipped"` requires a `demo` URL.
2. Every project must have at least one entry in `limitations`.
3. Prose must contain no metric word with a number that has no corresponding recorded field.
4. Company registration, certifications, personal email and phone number may not appear.
5. Every excerpt must have a commit, a line range, a body of matching length, and an explanation of why it matters.
6. Only the account owner's repositories may be featured; forks are excluded and listed with reasons.

A future CMS would write this same record shape. Until then, the array *is* the CMS, and `verify:content` is what keeps it true.

### Indexing

Case studies are static HTML with real titles, descriptions and copy, so they index properly. The constellation and the assistant are enhancements over content that already exists in the markup. The palette's filtered views use query parameters (`?theme=ai`) and are not separately indexed, which is why the full project index is always rendered.

---

## 9. Deployment

**Current: Vercel, one project, no build step.** `vercel.json` declares `site/` as the output
directory, maps clean URLs to the generated files, sets the security headers below, and gives each
function a timeout. The generators run in the repository, not on the host, so the deploy uploads
plain files and three small functions. `docs/deployment.md` is the operational walkthrough.

```bash
npm run dev        # localhost:4173 — serves site/ and executes the real handlers
vercel deploy      # or connect the repository; vercel.json is already correct
```

**The delivered endpoints — two, and only two. The enquiry path is not one of them.**

| Route | Method | Auth | What it does | When its secret is missing |
|---|---|---|---|---|
| `/api/track` | POST | none; DNT/GPC honoured | Counts one page view, cookie-lessly | Answers `200 {counted:false}` — a broken store never breaks a page |
| `/api/stats` | GET | bearer `ADMIN_TOKEN`, `timingSafeEqual` | Aggregates for `/admin` | Answers `503` — an unconfigured deployment does not open its dashboard |

Three properties are architectural rather than incidental. **`store.js` is a Redis-over-HTTP client
written against `fetch`**, so there is no SDK to install and no dependency to keep current, and the
`KV_REST_API_*` and `UPSTASH_REDIS_REST_*` pairs are interchangeable. **Every secret is server-side
only**, read inside the function at request time and never inlined into a browser bundle — the build
does not read the environment at all. And **no handler echoes an upstream error**: the caller gets a
fixed `{ok, kind, error}` shape, while the status, key and provider text are logged server-side,
which is the split that makes this debuggable without being leaky.

**One harness, shared by every tool.** `tools/lib/site-server.mjs` serves `site/` for the audit,
the performance sweep and the quality checks, applying the rewrites and headers from `vercel.json`
rather than restating them. That is a fix, not a nicety: the three tools each had their own file
server, and when the dashboard's JavaScript turned out to be inline — silently blocked by the real
`script-src 'self'` — every tool reported the site healthy, because none of them sent a CSP header.
A harness that does not emulate the host produces results that mean nothing, whichever colour they
are. It now sends exactly what Vercel sends, and the audit fails on a CSP violation as a result.

**Suggested headers** (these are set as real response headers by `vercel.json`, not recommendations):

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:;
  script-src 'self'; style-src 'self'; connect-src 'self' https://api.your-domain;
  frame-ancestors 'none'; base-uri 'none'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

Two deliberate departures from the version of this paragraph that stood before the delivery layer
existed, both recorded rather than quietly edited.

**`style-src` carries `'unsafe-inline'` and `script-src` does not.** The build emits 1,259 inline
`style` attributes, so a strict style policy is not available; a nonce would not help them and
converting them all is a rewrite of every generated page for no security gain worth the churn.
`script-src 'self'` is the directive that actually prevents cross-site scripting, and it is
unweakened: **zero inline scripts exist anywhere in the build** — the dashboard's own logic is
emitted as `assets/js/bx-admin.js` precisely so this can be true.

**`connect-src 'self'`, with no third-party origin.** There is no external analytics, font or API
call from the browser, so the policy needs no exception. The page-view beacon posts to this site's
own `/api/track`.

### Monitoring

Error reporting and uptime monitoring are appropriate for the service. For the public site, visitor counting is **first-party and minimal by construction**: `api/track.js` stores a per-page count, a width bucket, a two-letter country, a referrer hostname and a hash that is only valid for one day, because it is salted with a value that is destroyed daily. That shape was chosen so the privacy page would not have to be vague — every field the dashboard can display is a field the disclosure names. Monitoring stays deliberately thin: the failure mode to notice is an endpoint returning errors, and `/admin` shows the one number that would reveal it (zero page views on a day with traffic).

---

## 10. Open items

Recorded rather than hidden:

1. **Company registration status and public legal details** — not asserted anywhere until verified (spec §16.3).
2. **Official logo and approved brand red** — current tokens are the exploratory direction (spec §16.4).
3. **TasteSkill / ThreeUI / "reactdev" URLs** — unresolved (spec §16.5).
4. **Delivery credentials** — the visitor tracker is wired into every page but needs the KV URL, and the contact form posts from the browser to EmailJS but needs the public key, service id and the notification and auto-reply template ids pasted into `site/assets/js/emailjs-config.js`. Until each is set, the piece that lacks its credentials states that plainly rather than pretending otherwise (`docs/deployment.md`).
5. **Repository licences** — most of Blaxk's repositories have no licence file, which technically means all rights reserved. Adding one per project is recommended and is stated on the source page.
6. **Live re-verification** — `verify:content` now completes cleanly (10 passed, 0 warnings, 0 failures, `evidence/content-verification.json`). Keep the habit of running it after any content edit; supply `GITHUB_TOKEN` when re-running inside the same hour as other GitHub usage, since the unauthenticated ceiling is 60 req/h against ~19 needed by the verifier.
7. **Manual screen-reader pass** on the scroll-heavy journey page — automated checks pass; human testing with NVDA/VoiceOver is still outstanding.
8. **Real-device testing** — see `docs/performance-report.md` §limits.
