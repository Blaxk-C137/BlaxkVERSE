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
│  SYSTEM 2 — THE SERVICE  (specified, not yet deployed)                   │
│                                                                          │
│   GitHub API  →  fetcher → allowlist → normalise → cache → /api/github/* │
│   Gemini API  →  retrieval → validation → budget  →       /api/ai/*      │
│   Inquiry     →  validation → rate limit → deliver →      /api/contact   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why split.** The public pages are content. They need no server, no database and no runtime API key. Rendering them to static HTML at build time makes them faster than server-rendered pages, impossible to break at runtime, and free to host — and it means a GitHub outage cannot take the site down, because the site reads GitHub at *build* time and not while a visitor is waiting.

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

The master specification's original sitemap also listed `/admin`. **That route is intentionally absent from the static site** — an authenticated curation interface belongs in the service, not in a page you can reach without a session. It is specified in §7.4.

### 2.4 Runtime modules

Four files, no dependencies, loaded in order:

| File | Size | Responsibility |
|---|---|---|
| `bx-data.js` | ~48 KB | Content records. No logic. |
| `bx-excerpts.js` | generated | Verbatim excerpt bodies, keyed by `repo::path`. |
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
| `site/**/*.html` | `bx-data.js` |
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
node tools/perf-site.mjs             # LCP / CLS / long tasks, 144 runs
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
| Form submitted with no server | It validates, then states plainly that nothing was transmitted. |
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

**Current:** any static host. No build step is required to serve `site/` — the generators run in the repository, and the output is plain files. A CDN in front is a one-line improvement, not a requirement.

**With the service:** a Node-compatible host (Vercel or equivalent) running the API routes, with secrets in host-managed environment variables. Suggested headers:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:;
  script-src 'self'; style-src 'self'; connect-src 'self' https://api.your-domain;
  frame-ancestors 'none'; base-uri 'none'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

The static build already satisfies this without `unsafe-inline`: no inline scripts, no inline styles beyond a handful of layout attributes, no external origins, images either local or `data:`.

### Monitoring

Error reporting and uptime monitoring are appropriate for the service. For the static site, the honest position is that **no analytics are installed and none are proposed** — the privacy page commits to that, and installing a tracker would break a stated promise on the same site that promises not to make promises it cannot keep.

---

## 10. Open items

Recorded rather than hidden:

1. **Company registration status and public legal details** — not asserted anywhere until verified (spec §16.3).
2. **Official logo and approved brand red** — current tokens are the exploratory direction (spec §16.4).
3. **TasteSkill / ThreeUI / "reactdev" URLs** — unresolved (spec §16.5).
4. **Preferred contact channel and support workflow** — the form is built and honest about having no server; the delivery channel (email, WhatsApp, booking) is unconfirmed (spec §16.6).
5. **Repository licences** — most of Blaxk's repositories have no licence file, which technically means all rights reserved. Adding one per project is recommended and is stated on the source page.
6. **Live re-verification** — `verify:content` now completes cleanly (10 passed, 0 warnings, 0 failures, `evidence/content-verification.json`). Keep the habit of running it after any content edit; supply `GITHUB_TOKEN` when re-running inside the same hour as other GitHub usage, since the unauthenticated ceiling is 60 req/h against ~19 needed by the verifier.
7. **Manual screen-reader pass** on the scroll-heavy journey page — automated checks pass; human testing with NVDA/VoiceOver is still outstanding.
8. **Real-device testing** — see `docs/performance-report.md` §limits.
