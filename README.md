# BlaxkVERSE

**BLAXK BYTE TECHNOLOGIES** — portfolio, company site and experience system.
Built to `BLAXK_BYTE_Immersive_Website_Master_Spec.md`.

> A red/black, scroll-driven builder's portfolio. Sixteen static pages, zero runtime
> dependencies, no framework, no webfonts, no analytics, no CDN. Every claim on it is
> checked against GitHub by a script that fails the build when it cannot verify one.

---

## Quick start

```bash
npm install                   # playwright-core only — build tooling, never shipped
npx playwright-core install chromium    # for the audit and performance harnesses

npm run build                 # excerpts → 16 pages
npm run serve                 # http://localhost:4321
```

Verify the result:

```bash
npm run verify:content        # re-checks every fact against the live GitHub API
npm run audit                 # 16 pages × a11y, keyboard, links, 3 motion modes
npm run perf                  # LCP / CLS / long tasks across 144 runs (~8 min)
```

---

## What was built

| Layer | Deliverable |
|---|---|
| **Prototypes** | Three runnable concepts, measured and scored, before any production code — the spec's §13A gate |
| **Site** | 16 pages: home, company, work, 8 case studies, source, lab, about, contact, privacy |
| **Components** | All 12 named components from the spec, hand-built, documented |
| **Docs** | 7 required documents (~15,200 words) covering research, design, architecture, security, verification and performance |
| **Evidence** | Machine-readable proof in `evidence/` — audit, performance, verification, prototype measurements |

---

## Repository map

```
uploads/…Master_Spec.md      the specification this was built against
recon/                       GitHub evidence harvest (working area, not a deliverable)
  repos_c137.json            all 43 public repositories
  artifacts/pinned_commits.json    full SHAs for 7 flagship repositories
  artifacts/code/            15 fetched source files
  artifacts/shots/           13 screenshots, reviewed by eye

blaxkverse/
  docs/                      the seven required documents
    experience-decision.md   ← the §13A gate: 3 prototypes scored, winner recorded
    component-research.md    every library: URL, licence, accept/reject, adoption cost
    design-system.md         tokens, palette, type, motion, a11y commitments
    architecture.md          data flow, the deferred server service, AI endpoints
    security-threat-model.md threats, ratings, mitigations, and what is NOT verified
    content-verification.md  what the verifier caught, and what is deliberately unclaimed
    performance-report.md    generated from real measurements

  prototypes/                3 runnable concepts + shared tokens + verified project data
  site/                      the built site (this is the deliverable)
    index.html company.html work.html lab.html source.html about.html contact.html privacy.html
    projects/*.html          8 case studies
    assets/css/blaxkverse.css
    assets/js/bx-data.js     content: facts + reasoning (authored)
    assets/js/bx-excerpts.js excerpt bodies (GENERATED — never hand-edited)
    assets/js/bx-core.js     all behaviour
    assets/img/              13 real screenshots from the repositories
  sources/                   cached source files at pinned commits + MANIFEST.json
  tools/                     build, extract, verify, audit, perf, measure, report
  evidence/                  generated proof (audit, perf, verification, measurements)
```

---

## The two rules that shaped everything

**1. Nothing is invented.** No fake projects, no fake metrics, no fake clients, no
fabricated contributions, no asserted legal status. Every project is marked `prototype`
because none has a verified public deployment. Nine visible repositories are excluded and
each exclusion gives its reason. There are no numbers on the site that were not measured.

This is not a promise, it is a gate. `npm run verify:content` fails the build if a project
claims `shipped` without a deployment URL, if prose contains a metric with no recorded
field behind it, if a fork is featured, if the company's registration status is asserted,
or if any excerpt's body does not match its declared line range.

**2. Code excerpts are quoted, never typed.** `npm run build` slices every published
excerpt from a SHA-256-verified cache at a pinned commit, and the build aborts if a body's
commit does not match its metadata pin. The runtime refuses to render a stale quote.
This rule exists because it caught a real failure: an early hand-written excerpt was a
paraphrase of the actual source. `docs/content-verification.md` §2.1 records it.

---

## The gate: three prototypes before one production page

The specification forbids starting the site until three runnable concepts exist, are
measured, and the winner is documented — static mockups explicitly do not count.

| | Concept A — *Constellation* | Concept B — *Terminal* | Concept C — *Film* |
|---|---|---|---|
| Score | 81 / 100 | 85 / 100 | **86 / 100** |
| FPS desktop / mobile / low-end / reduced | 60 / 60 / 60 / 60 | 55 / 60 / 58 / 59 | 50 / 60 / 56 / 59 |
| p95 frame time | 16.8 ms | 33.3 ms | 33.4 ms |
| Result | Constellation adopted as `/work` | Nav model + project X-ray adopted | **Winner — narrative spine** |

Production is a synthesis, not a copy: **C** supplies the narrative spine, masked reveals,
signal dial and chapter numbering; **B** supplies the navigation rail, real search and the
three-faces project X-ray; **A** supplies the constellation field and, most valuably, the
finding that `backdrop-filter` over an animating layer costs 36 fps — now a binding rule.

Full scoring, the ten binding interaction rules, and reproduce commands: `docs/experience-decision.md`.

---

## Measured performance

16 pages × 3 viewports × 3 motion modes = **144 runs**, CPU throttled 1× / 4× / 6×,
CLS collected *during a scripted full-page scroll* (the only way to expose scroll-linked shift):

| Metric | Worst observed | Budget | Verdict |
|---|---|---|---|
| LCP | **424 ms** | ≤ 2500 ms | ✓ |
| CLS | **0.0069** | ≤ 0.1 | ✓ |
| Longest task | 236 ms | — | reported |
| Console errors | 0 across all 144 runs | — | ✓ |
| Transfer | 173–567 KB uncompressed, no CDN | — | reported |

INP is **not** directly measured — headless Chromium cannot produce trustworthy input
latency, so TBT proxy and long-task totals are reported in its place and the JSON says so
rather than quoting a number that would look better and mean less.

---

## Honest open items

Listed because this project's whole claim is that it does not overstate things.

**Blocked on decisions only the owner can make** (spec §16):
1. Incorporation status and public legal details — deliberately not asserted anywhere
2. Approved logo and brand red — current tokens are the exploratory direction
3. Preferred contact channel — the form is built and honest about having no server
4. Whether `GEMINI_API_KEY` / `GITHUB_TOKEN` will be provisioned
5. "TasteSkill / ThreeUI / reactdev" URLs — searched, no confirmed source exists; recorded as unresolved rather than guessed

**Known engineering debt:**
6. `gesture-controls` pin (`89ba2a3e5f`) should be re-verified before publishing
7. Concept C's prototype screenshot is a placeholder SVG (the production site does not use it)
8. No automated screen-reader pass — automated a11y checks pass, manual NVDA/VoiceOver testing outstanding
9. Most repositories have no licence file, which technically means all rights reserved; the source page says so
10. The server service (`architecture.md` §6–7) is specified, not deployed. This is a safe state, not a missing feature: the shipped assistant is a deterministic retriever with no network call.

---

## Licensing and provenance

**Site code:** unlicensed private work of Blaxk Byte Technologies.

**Zero third-party runtime dependencies.** GSAP, Three.js, React Bits, shadcn/ui, Motion,
Tailwind and Next.js were each evaluated with real URLs and real licences and are recorded
in `docs/component-research.md` with the reason for deferral — not rejection of the
specification's intent, which the architecture preserves with a reversible migration path.
Two findings worth knowing: **GSAP has been free including commercial use since April
2025** (still rejected on weight, not licence), and **React Bits carries the Commons
Clause** in addition to MIT, which is a real handover consideration.

**Project screenshots and code excerpts** are the owner's own work, republished with
attribution and pinned commit SHAs. Forks are credited upstream, never exhibited.

---

*Built to the master specification, with every component, document and measurement the
spec called for — and a record of the things it turned out we could not honestly claim.*
