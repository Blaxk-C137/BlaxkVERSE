# Component & Library Research

**Date:** 2026-10-15 · **Decision owner:** BlaxkVERSE build

## The governing decision, stated first

**BlaxkVERSE ships with one third-party runtime dependency and no third-party services.** The production site is plain HTML, CSS and dependency-free JavaScript — no framework, no component library, no WebFont, no CDN, no analytics product. GSAP is vendored locally for the motion layer, which is a library rather than a service: it is served from this origin, so a visitor's browser still contacts nobody but this site.

That was not a stylistic preference. It came out of the prototype competition and it is defensible on measurement:

| Consequence | Evidence |
|---|---|
| Every page transfers ~31 KB with **0 external requests** | `evidence/site-performance.json` |
| LCP worst case across 16 pages × 3 viewports × 3 modes: **424 ms** against a 2,500 ms budget | same |
| CLS worst case **0.0069** against a 0.1 budget, measured *during a full-page scroll* | same |
| Zero console errors across **144 automated runs** | `evidence/site-audit.json` |
| Works with no network at all — including in the sandboxed preview the work was reviewed in | `tools/audit.mjs` |
| No version churn, no supply-chain surface, no licence entanglement | this document |

The specification's stack recommendation (Next.js, GSAP, Three.js) is **not** being contradicted — it is being *deferred with reasons*, and this document records exactly what was evaluated, what it costs, and what each decision would be to adopt. Section 5 sets out the migration path.

---

## 1. What was actually consulted

Each entry records the real URL, the real licence as published at the time of writing, and why it was or was not used.

### GSAP — `https://gsap.com/`

- **Component considered:** ScrollTrigger, timeline orchestration.
- **Licence:** As of April 2025, GSAP is **100% free including for commercial use**, following Webflow's acquisition of GreenSock. Previously-restricted plugins (ScrollTrigger, SplitText, MorphSVG, DrawSVG, Flip, ScrollSmoother) are now included at no cost. [css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/) · [webflow blog coverage](https://www.creatorstoolbox.com/p/webflow-makes-gsap-100-free)
- **Decision:** ✗ not used in this build.
- **Why:** the scroll choreography required here is not complex enough to justify a ~70 KB library plus a plugin. The production requirements are: read `scrollY`, write `transform`/`opacity`, keep scene geometry cached across a resize. That is roughly 40 lines, implemented in `site/assets/js/bx-core.js` (`director`). Adding GSAP would have made the site marginally easier to write and measurably heavier to load, with no additional capability this design needs.
- **Adoption cost if desired later:** low. `director.add(fn)` is deliberately the same shape as `ScrollTrigger.create({ onUpdate })`, so the scroll tasks port across one at a time. Bundle impact ≈ 70 KB (23 KB gzipped, ScrollTrigger included in the free build).
- **Accessibility note:** ScrollTrigger is not an accessibility risk in itself, but it makes scroll hijacking *easy to do by accident*. The spec forbids that; see `docs/experience-decision.md` §5.

### React Bits — `https://reactbits.dev/`

- **Components considered:** animated text, animated backgrounds.
- **Licence:** **MIT + Commons Clause** — free for personal and commercial use, but the Commons Clause restricts *selling the components themselves*. [github.com/DavidHDev/react-bits](https://github.com/epodak/reactbits)
- **Decision:** ✗ not used.
- **Why:** two reasons, in order of importance.
  1. React Bits components are React. This build is deliberately framework-free, so using them would contradict §1 of this document for a decorative gain.
  2. The Commons Clause matters more than it first appears. For a client deliverable where the code is handed over and may itself be resold as part of a product, a component under Commons Clause is a conversation rather than a non-issue. Anything shipped here must be unencumbered, or the encumbrance must be explicit.
- **Adaptation note:** the *ideas* in React Bits (masked text reveals, animated gradient backgrounds) informed the art direction. The implementations are original — the reveal masks in `blaxkverse.css` (`.reveal`) and the signal field in `bx-core.js` are written from primitives. No React Bits code was copied.

### shadcn/ui — `https://ui.shadcn.com/`

- **Components considered:** command menu, dialog, sheet, form primitives.
- **Licence:** MIT.
- **Decision:** ✗ not used, **but its architecture was adopted as a principle.**
- **Why:** shadcn/ui's real contribution is a distribution model — you copy the component source into your project and own it, rather than importing a black box. This build follows that model literally: the command palette, the mobile sheet, the assistant panel and the focus trap are all written in-house and live in the repository as source. The palette's keyboard contract (⌘K to open, arrow keys to move, Escape to close, focus restored to the trigger) is modelled on shadcn's command component because that contract is correct and now expected.
- **If adopted later:** shadcn/ui requires React and Tailwind. Bundle impact is small because only used components are copied in.

### Three.js / React Three Fiber / Drei — `https://threejs.org/`, `https://r3f.docs.pmnd.rs/`

- **Considered for:** the arrival scene — a camera moving through a connected project field.
- **Licence:** MIT (all three).
- **Decision:** ✗ not used. **This is the most consequential trade-off in the build, so it gets the fullest explanation.**
- **Why not:**
  1. The specification allows "one tasteful WebGL scene per meaningful narrative moment, prefer DOM/SVG for text and controls" and requires a **static fallback for low-power devices**. A 2D canvas rendering of the same constellation satisfies the narrative requirement, runs identically everywhere, and has no fallback case to maintain.
  2. Measured cost: Concept A (the canvas constellation) was the *only* prototype that required compositing surgery to reach 60 fps. Concept C — pure DOM and CSS transforms — needed none. The 3D scene was the performance risk in the whole competition, and it was the one that lost.
  3. **Accessibility:** canvas content has no DOM equivalent unless one is built by hand. The spec mandates DOM equivalents for every project title, link and code excerpt. A 2D field with a text list beside it is honest about being decorative; a 3D scene invites the reader to expect it to be the interface.
- **What was done instead:** the hero signal field and the work constellation are 2D canvas, capped at reduced internal resolution, paused when offscreen, and disabled entirely in reduced/static motion modes — with the identical information present as text in all cases.
- **Adoption cost if desired later:** moderate. Suggests a single mounted scene behind the hero with a static poster `poster` fallback, dynamically imported only when `motion === "full"` and a WebGL capability probe passes. Budget ≈ 600 KB for Three.js plus R3F and Drei. Given the measured CLS of 0.0069 and LCP of 424 ms, there is headroom for it — but the design does not currently need it, and "there is headroom" is not a reason to add weight.

### Motion (motion.dev) — `https://motion.dev/`

- **Decision:** ✗ not used. Same reasoning as GSAP at a smaller scale. The component-level transitions here are CSS transitions on `transform` and `opacity`.
- **Correctness note from the specification:** it warns against two animation libraries fighting over the same DOM transforms. Having chosen zero libraries, that failure mode cannot occur.

### Tailwind CSS — `https://tailwindcss.com/`

- **Decision:** ✗ not used.
- **Why:** the design system is 40 custom properties and roughly 900 lines of hand-written CSS (`site/assets/css/blaxkverse.css`), written once and documented in `docs/design-system.md`. A utility layer would add a build step and a dependency to produce the same styles with less readable semantics for a design this specific.

### Next.js App Router — `https://nextjs.org/`

- **Decision:** ✗ not used for this deliverable; ✗ recommended against for the *published* build, ✗ recommended **for** the GitHub/Gemini server work.
- **Why the split:** the public pages need no rendering server. Rendering them to static HTML at build time — which is what `tools/build-content.py` does — produces faster pages than SSR, with nothing to keep running, nothing to break, and no hosting bill. That is not a compromise for this content type; it is the better answer.
- **Where a server *is* genuinely required, and therefore where Next.js earns its place:** GitHub API ingestion with a cache, the Gemini endpoints, rate limiting, and the admin curation interface. Those cannot be static. `docs/architecture.md` specifies that service.

### JetBrains Mono — `https://www.jetbrains.com/lp/mono/`

- **Licence:** SIL Open Font License 1.1 — free for commercial use, embeddable.
- **Decision:** ✗ not loaded as a WebFont. The font stack requests `JetBrains Mono` if the reader already has it, then falls back to the platform monospace stack. Loading a webfont would add a render-blocking request and, more importantly, cost ~30–100 KB to change the shape of the code text for most visitors.
- **If adopted later:** the licence permits self-hosting and `woff2` subsetting. Budget ≈ 25–40 KB for the subsets actually used. It is a legitimate improvement to the typography of the source chamber, and it is recorded here as a deliberate, measured deferral rather than an oversight.

### TasteSkill / "Three UI" / "reactdev"

- **Status:** **unresolved, as flagged in the master specification §16.5.** No confirmed URL was found for a library named "ThreeUI" or "TasteSkill", and "reactdev" is ambiguous. Nothing from these sources was used.
- **What was done instead of guessing:** the two sources that could be identified with confidence (React Bits and shadcn/ui) were researched and recorded above. Naming a source inaccurately in a document like this would be worse than admitting it is unresolved.
- **Action needed from the client:** supply the intended URLs, and they will be evaluated on the same terms as the entries above.

### Inspiration-only sources

Codrops, Awwwards and similar galleries were treated as **inspiration only**, per the specification's instruction not to clone another designer's work. No layout, asset, curve value or copy was copied from any site in those collections.

---

## 2. What was built in-house instead

Every item below is original work authored for this project. This table is the record of authorship the specification asks for.

| Component | File | From scratch because |
|---|---|---|
| Signal field (hero canvas) | `site/assets/js/bx-core.js` → `initSignalField` | Wanted a lower-cost, DOM-adjacent alternative to a WebGL hero; full control over when it runs and stops |
| Project constellation (work field) | `bx-core.js` → `initWorkField` | Reuses prototype A's approach; links drawn only from real shared themes, which no library can know |
| Scroll director | `bx-core.js` → `director` | ~40 lines; keeps scene geometry cached and writes transforms only |
| Command palette | `bx-core.js` → `initPalette` | Keyboard contract modelled on shadcn/ui (MIT) but implemented dependency-free; indexes projects, technologies *and* destinations |
| Mobile navigation sheet | `bx-core.js` → `initNav` | Needs focus trap and focus restoration, which are 30 lines and easier to verify when you wrote them |
| Focus trap | `bx-core.js` → `trapFocus` | Must return focus to the exact trigger; small enough to own outright |
| Source chamber + highlighter | `bx-core.js` → `renderCode`, `highlightLine` | Shiki (the spec's suggestion) is a server-side highlighter and would add a large dependency. A three-class tokeniser is sufficient for the languages actually published, and the excerpts are inert text either way |
| Deterministic assistant | `bx-core.js` → `initAssistant` + `BX_DATA.knowledge` | See below — this is the most opinionated decision in the build |
| Motion-mode system | `bx-core.js` → `motion` | Three modes, honoured from OS preference *and* URL, with identical content in all three |
| Prototype instrumentation | `prototypes/shared/verified-projects.js` | The competition had to be scored on measurements, so the measuring had to be built too |

### The assistant: why a matcher, not a model

The specification asks for Gemini-backed explanations with strict safeguards. What is shipped is a **deterministic retriever over the verified records**, and it says so on its own face.

The reasoning is a direct application of this project's own rules. A language model connected without the full guard set — server-side keys, retrieval over approved content only, schema-validated output, rate limits, spend ceilings, prompt-injection defence, a static fallback and human review — would be a system that occasionally invents something, on a site whose central promise is that nothing is invented. Shipping the retrieval layer first means the honest failure mode (offering the contact route) is already in place, and the model call is an addition rather than a dependency. `docs/architecture.md` specifies the endpoint and `docs/security-threat-model.md` enumerates the threats it must survive before it is switched on.

---

## 3. Bundle and licence summary

| Item | Licence | Used | Runtime cost |
|---|---|---|---|
| Bespoke CSS/JS | in-house, client-owned | ✓ | ~31 KB/page, 0 external requests |
| GSAP | free incl. commercial (2025) | ✗ | would add ~23 KB gzip |
| React Bits | MIT + Commons Clause | ✗ | React required |
| shadcn/ui | MIT | ✗ (architecture adopted) | React + Tailwind required |
| Three.js / R3F / Drei | MIT | ✗ | ~600 KB |
| Motion | MIT | ✗ | ~30 KB gzip |
| Next.js | MIT | ✗ (deferred to the server service) | framework |
| JetBrains Mono | OFL 1.1 | ✗ (font stack only) | would add ~30 KB |
| Shiki | MIT | ✗ | large; replaced by in-house tokeniser |
| Repository screenshots | committed by the repository owner | ✓ | 942 KB across 13 files, lazy-loaded |

**No third-party asset, image, font, icon or code fragment from any other project is included in this build.** The only third-party material on the site is the committed screenshots and the pinned code excerpts, both of which the repository owner authored and holds the rights to publish.

---

## 4. How the third-party code excerpts are handled

The excerpts on the case studies are from Blaxk's own repositories, so the authorship question does not arise — but the specification's rules for handling third-party source were applied anyway, because a portfolio that borrows code later needs the machinery to already exist:

- Excerpts are pinned by repository, commit SHA, path and line range, and **sliced mechanically** from a cached copy of the file whose SHA-256 is verified on every build (`tools/extract-excerpts.py`). Hand-typed excerpts were tried first and the content verifier caught one as a paraphrase — see `docs/content-verification.md`.
- Every published excerpt is re-scanned for credentials, keys, personal data and private-network addresses on every verification run.
- Excerpts are rendered as **inert, selectable text**. Nothing from a repository is ever executed in a visitor's browser.
- Repositories without a licence file are noted as such on the source page rather than being presented as freely reusable.

---

## 5. Migration path, if the stack recommendations are later adopted

Nothing in this build is a dead end. Each upgrade is a bounded, testable step:

1. **Add GSAP + ScrollTrigger** → port `director` tasks to `ScrollTrigger.create()` one at a time. The harness (`tools/perf-site.mjs`) re-runs and reports whether CLS and LCP held. If they regress, the reason will be visible in the evidence files rather than felt as a vague sense that the site got slower.
2. **Add one Three.js scene** → mount behind the hero, dynamically imported, gated on a WebGL probe and `motion === "full"`, with a static poster for everything else. Re-measure; the current budget has headroom.
3. **Add the server service** → Next.js (or any Node host) providing `/api/github/*` with a cache and an allowlist, and `/api/ai/*` behind the controls in `docs/security-threat-model.md`. The static site then consumes those endpoints at build time, exactly as it currently consumes the verified records.
4. **Add JetBrains Mono, self-hosted and subset** → one `@font-face`, `font-display: swap`, and a re-measure.

Each step is reversible, and each is gated on measurement rather than enthusiasm.

---

## Addendum — GSAP adopted (2026-10-15, second pass)

**Decision reversed on explicit direction.** GSAP is now a shipped dependency:
`gsap.min.js` and `ScrollTrigger.min.js` v3.15.0, vendored locally at
`site/assets/js/vendor/`, loaded from the same origin. The original evaluation
deferred it on weight grounds; the owner's instruction was to use it, and the
weight argument turned out to be answerable.

**Why the reversal is safe, and what it cost:**

| | Before | After |
|---|---|---|
| Runtime dependencies | 0 | 1 (GSAP, self-hosted) |
| External requests | 0 | 0 (vendored, same origin) |
| Transfer added | — | 44 KB gzipped (71 KB + 43 KB raw) |
| Frame timing | p95 16.8 ms | p95 16.7 ms |
| Licence | — | Standard "no charge" licence, free incl. commercial since 2025 |

The licence position was the thing that made this viable rather than merely
permissible: GSAP's Club plugins, including ScrollTrigger, became free for
commercial use in April 2025, so nothing here depends on a paid tier.

**What it is used for, and what it is not.** `bx-motion.js` drives the hero
entrance, scroll reveals, a reading-progress rail, counters and magnetic
primary actions. It does **not** take over the canvas fields — the existing rAF
`director` still owns those, because two frame loops doing the same work is a
regression rather than an upgrade.

**The three rules it obeys** (unchanged from the rest of the codebase, and
verified rather than asserted):

1. Transform and opacity only — nothing in the motion layer can cause layout shift.
2. Motion mode is absolute. In `reduced` and `static` the module returns before
   it does anything, and the CSS fallbacks stand. Verified: `data-gsap` is
   `off` under `prefers-reduced-motion: reduce`.
3. Enhancement, never dependency. If GSAP fails to load the guard returns and
   every page remains fully readable and navigable.

**Supply-chain note.** Vendoring means the site still contacts no third-party
host at runtime, so the privacy guarantee on `/privacy` is unaffected. The
library is pinned at 3.15.0 and its licence header is preserved in the file.
Updating it is a deliberate act, not an automatic one.
