# Design System

**BlaxkVERSE** · BLAXK BYTE TECHNOLOGIES · single source of truth: `site/assets/css/blaxkverse.css`

> **Brand approval status.** The palette, typography and logo treatment here are an **exploratory direction pending formal sign-off**, exactly as the master specification permits (§1, §3). The red/black direction from the brand history is implemented; **no gold is used anywhere**, per instruction. When approved brand assets arrive — logo, registered red, guidelines — they are substituted by editing the token block at the top of the stylesheet. Nothing else in the build hard-codes a colour.

---

## 1. Design principles

Five rules, in priority order. When they conflict, the higher rule wins.

1. **Evidence before decoration.** An effect that does not help someone understand the work does not ship. The constellation exists because relationships between projects are real and worth showing; it is not ambient animation.
2. **Native first.** Native scrolling, native focus, native form controls, browser history, text selection, `Ctrl+F`. Every unusual interaction is layered *on top of* the platform, never substituted for it.
3. **Motion is a presentation of content, not a gate in front of it.** Text is in the DOM and readable before any animation runs. There is no loading screen.
4. **Honest states are designed, not hidden.** "No screenshot exists" is a designed panel. "No excerpt reviewed" is a designed chamber. An empty state that admits emptiness is better than a filled one that misleads.
5. **Accessibility is the same product.** The reduced-motion route is art-directed, not stripped. Same content, same hierarchy, fewer moving parts.

---

## 2. Palette

Declared once, as custom properties. Every one of these values appears in the token block and nowhere else.

| Token | Value | Use |
|---|---|---|
| `--void` | `#08090c` | Page background — near-black, never pure black |
| `--void-2` | `#06070a` | Recessed panels, alternate sections |
| `--graphite` | `#14171d` | Raised surfaces, panel headers, buttons |
| `--graphite-2` | `#1b1f27` | Hover surfaces |
| `--hairline` | `#262b35` | All borders and dividers |
| `--hairline-2` | `#1e232b` | Quiet dividers inside panels |
| `--white` | `#f4f4f2` | Primary text — warm white, not `#fff` |
| `--white-dim` | `#b9bcc2` | Body copy |
| `--muted` | `#7d838e` | Labels, metadata |
| `--steel` | `#5b6673` | The quietest tier: separators, disabled, canvas links |
| `--red` | `#f04445` | The signal. Accent, focus, active state, links of consequence |
| `--red-bright` | `#ff5a5b` | Hover on red surfaces only |
| `--red-deep` | `#a3161a` | Reserved for gradient stops |
| `--red-glow` | `rgba(240,68,69,.45)` | Box-shadow accent |
| `--red-wash` | `rgba(240,68,69,.08)` | Tint for hover/selected rows |

### Status colours

Four statuses need to be distinguishable at a glance in text and in the field. They are the only other hues permitted on the site — everything else is greyscale plus red.

| Token | Value | Status | Meaning |
|---|---|---|---|
| `--status-shipped` | `#6fd08c` | shipped | verified public deployment |
| `--status-prototype` | `#e8b45f` | prototype | working code, README evidence |
| `--status-progress` | `#7fb2e8` | in progress | actively being built |
| `--status-concept` | `#9a8fd0` | concept | documented idea only |

**Nothing on this site is currently `shipped`**, and the status key is published on the work page so the vocabulary is defined rather than assumed.

### Contrast

Every text/background pairing in use was chosen to clear WCAG AA at the sizes it is used at. The tightest cases:

| Pair | Ratio | Verdict |
|---|---|---|
| `--white` on `--void` | ≈ 18.6:1 | AAA |
| `--white-dim` on `--void` | ≈ 10.9:1 | AAA |
| `--muted` on `--void` | ≈ 5.6:1 | AA (used for labels ≥ 11px, non-essential) |
| `--steel` on `--void` | ≈ 3.4:1 | **Decorative only** — separators, disabled text, canvas links. Never load-bearing copy. |
| `--red` on `--void` | ≈ 6.4:1 | AA large + AA normal text |
| `#fff` on `--red` | ≈ 4.6:1 | AA for the button label at 11.5px letter-spaced uppercase |

The one deliberate compromise is `--steel`: it sits below AA. It is therefore never used for information a reader *needs* — it marks separators and canvas-internal link lines. This is recorded rather than quietly accepted.

---

## 3. Typography

Three roles, one stack each, **no webfonts loaded**.

| Role | Stack | Use |
|---|---|---|
| Display | `Helvetica Neue, Helvetica, Arial Narrow, Arial, system-ui` | `h1`–`h4`, metrics, project titles |
| Body | `system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial` | Paragraphs, UI text |
| Mono | `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas` | Labels, code, metadata, status chips, footer |

JetBrains Mono is *requested* first, so someone who already has it sees it — without costing everyone else a webfont request. `docs/component-research.md` records self-hosting a subset as a measured, deliberate deferral.

### Scale

Type is fluid: `clamp()` on every heading, so there are no breakpoint jumps.

| Element | Size | Notes |
|---|---|---|
| `h1` | `clamp(2.4rem, 7.2vw, 5.4rem)` | Uppercase, `-0.035em` tracking |
| `h2` | `clamp(1.7rem, 4vw, 3rem)` | |
| `h3` | `clamp(1.2rem, 2.2vw, 1.6rem)` | |
| Body | `16px` / `1.65` | |
| `.lede` | `clamp(1rem, 1.5vw, 1.16rem)` | Intro paragraphs |
| `.label` | `0.69rem`, `0.18em` tracking, uppercase, mono | The recurring micro-label motif |

Headings use `line-height: 1.02` and negative tracking — the typographic signature of the identity: tight, confident, engineered.

### The label motif

`.label` — 11px mono, uppercase, wide tracking, muted — is the most repeated element on the site. It labels every scene, every figure, every field in a definition list, every metadata row. It is what makes the interface read as an *instrument* rather than a brochure.

---

## 4. Space, layout, shape

- **Measure:** body copy is capped at `68ch` (`--maxw-text`). Long-form case-study prose never exceeds ~76ch.
- **Container:** `--maxw: 1240px`, gutters `clamp(1rem, 4vw, 2.5rem)`.
- **Rhythm:** `.section` pads `clamp(3.5rem, 9vh, 7rem)` vertically. Vertical rhythm is in `vh` so a scene fills a phone screen without overflowing a laptop one.
- **Radius:** `3px`. Sharp corners are the point; nothing is pill-shaped.
- **Borders:** `1px solid` at `--hairline` everywhere. Borders — not shadows — define surfaces, which is why the site has almost no `box-shadow`, and why removing `backdrop-filter` (see §6) cost nothing visually.
- **Grid:** `repeat(auto-fit, minmax(...))` throughout, so layouts reflow without breakpoint-specific rules wherever possible.

Minimum interactive target is **44px** on touch and 38px on pointer devices; the mobile sheet uses 56px rows.

---

## 5. Components

| Component | Where | Contract |
|---|---|---|
| **Navigation rail** | every page | Fixed, 60px. Mark, seven destinations, search, motion toggle, mobile menu. Active page marked with `aria-current` and a red underline. |
| **Command palette** | every page | `⌘K`/`Ctrl+K` (and `/` from body). Indexes pages, projects, technologies and motion modes. Arrow keys move, Enter follows, Escape closes, focus returns to the trigger. |
| **Mobile sheet** | < 1000px | Full-screen, large targets, focus trapped, Escape closes, focus restored. |
| **Motion toggle** | every page | Three states cycled in place, written to the URL. `M` does the same from the keyboard. |
| **Signal field** | home hero | 2D canvas: a signal rail with travelling pulses plus the project constellation. Reduced internal resolution, paused offscreen, absent in reduced/static modes. Decorative — `aria-hidden`. |
| **Work field** | work page | The constellation, with links drawn only from genuinely shared themes or technologies. Hover/click highlights; the list beside it carries all information. Includes a legend stating exactly what the lines mean. |
| **Project rows** | work, case studies | The primary, always-readable index. Index number, title, tagline, status, language. |
| **Source chamber** | case studies | Excerpt with path, language, line range and commit. Copy and "Open on GitHub" controls. Empty state when no excerpt has been reviewed. |
| **Status chip** | everywhere | Colour plus text. Never colour alone. |
| **Assistant panel** | every page | Deterministic answers from verified records, with the record cited. Says it is not a model. |
| **Transmission form** | contact | Inline validation with `aria-invalid`, per-field errors, `role="status"` announcements, and an honest "nothing was sent" outcome in this build. |
| **Provenance strip** | case studies | The paragraph stating where every figure came from and what is deliberately not claimed. |

### Status/state vocabulary

Used consistently in copy as well as in UI:

- **shipped** — a verified public deployment exists.
- **prototype** — working code with README evidence.
- **in progress** — actively being built.
- **concept** — a documented idea only.

---

## 6. Motion system

### Tokens

| Token | Value | Use |
|---|---|---|
| `--t-micro` | `140ms` | Hover, focus, chip state |
| `--t-quick` | `220ms` | Button, row, tab transitions |
| `--t-section` | `620ms` | Scene and face transitions |
| `--ease` | `cubic-bezier(.22,.61,.24,1)` | General |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | Reveals, enters |

### The three modes

Set from `prefers-reduced-motion` automatically, overridable by URL (`?motion=on|reduced|off`) and by the nav control. **Content is identical in all three** — verified by the audit, which checks word count and heading count in each mode on all 16 pages.

| Mode | Camera | Canvas | Reveals | Transitions |
|---|---|---|---|---|
| `full` | moves | animates | masked | full |
| `reduced` | parked | absent | instant | instant |
| `static` | parked | absent | instant | instant, designed backdrop instead |

### Hard rules (from measurement, not taste)

1. **`transform` and `opacity` only.** No animated layout properties.
2. **No `backdrop-filter` or `mix-blend-mode` over anything that animates.** This rule is not a preference — it was worth **36 fps** on Concept A, taking it from 24 fps to 60 fps. The nav may use `backdrop-filter` (it overlays static content) but is explicitly switched to an opaque background over the animated hero.
3. **One rAF loop per concern, no scroll listeners that animate.** The `director` owns scroll reading; tasks write transforms.
4. **Canvas is capped and paused.** Internal resolution scales down above 1.1M CSS pixels of viewport; rendering stops when offscreen or when the tab is hidden.
5. **Reveals use `IntersectionObserver`** and run once per element.

Motion tokens are starting points to be tuned on real devices; the measured results are in `docs/performance-report.md`.

---

## 7. Iconography, imagery, sound

- **No icon font, no SVG icon set, no third-party icons.** The only marks are: a 10px red square (brand), `→`/`↗`/`✕` as text glyphs, and inline SVG in the prototype dial. Arrows carry meaning (internal vs external, close), which is why they are not decorative.
- **Imagery is evidence.** The 13 photographs on the site are screenshots committed to Blaxk's own repositories, resized and re-encoded to JPEG (`site/assets/img/`, manifest with captions and byte sizes). There is no stock photography, no AI-generated illustration, no abstract tech imagery. Where no screenshot exists, the page says so.
- **No sound anywhere**, and no autoplay of any kind.

---

## 8. Accessibility commitments

| Requirement | Implementation |
|---|---|
| Skip link | First focusable element on every page |
| Landmarks | `header`, `nav`, `main#main`, `footer` on every page |
| Heading order | Exactly one `h1` per page, verified by audit |
| Focus visible | 2px red outline, 3px offset, never removed |
| Focus management | Every overlay traps focus and restores it to its trigger |
| Keyboard parity | Every mouse interaction has a keyboard equivalent; `⌘K`, `/`, `M`, `Esc`, arrows |
| Status messages | `role="status"` with `aria-live="polite"` on form outcomes |
| Form errors | Per-field text plus `aria-invalid`; focus moves to the first error |
| Images | Descriptive `alt`; decorative canvas is `aria-hidden` with a text equivalent nearby |
| Motion | Three modes, OS preference honoured, no unreachable animation |
| Touch | 44px minimum; sheet rows 56px |
| Text selection | Never disabled |
| Zoom | No `maximum-scale`, no `user-scalable=no` |

WCAG 2.2 AA is the target. Automated checks pass (see `evidence/site-audit.json`); a manual screen-reader pass on the scroll-heavy journey page remains **untested** and is listed as an open item rather than assumed.

---

## 9. What is deliberately absent

Recorded so these are decisions rather than omissions:

- No loading screen. The specification forbids a gratuitous one, and there is nothing to wait for.
- No cookie banner. Nothing is stored, so a banner would be theatre.
- No chat widget that fabricates answers.
- No testimonials, client logos, awards or statistics. None exist to publish.
- No gold, no gradients-as-decoration, no glassmorphism, no neon glow beyond the single red signal accent.
- No dark/light theme toggle. The brand direction is dark; a light theme is a separate design exercise, and a half-considered one would be worse than none. Print styles are provided for the pages people actually print (case studies).

---

## Addendum — the motion layer (second pass)

The original motion system was hand-rolled CSS transitions plus an
IntersectionObserver. It worked, but every effect was authored in isolation, so
stagger, easing and scroll position were each solved slightly differently in each
place. GSAP 3.15.0 is now vendored at `site/assets/js/vendor/` and drives one
coherent timeline model through `bx-motion.js`.

### What GSAP owns, and what it does not

| Owns | Does not own |
|---|---|
| Hero entrance timeline (staggered, one beat) | The canvas fields — the existing rAF `director` still drives those |
| Scroll reveals on `[data-reveal-group]` / `[data-reveal-block]` | Layout of any kind |
| Reading-progress rail (`[data-progress]`) | Colour, type or spacing tokens |
| Counters (`[data-count]`), magnetic primary actions (`[data-magnetic]`) | Reduced and static modes, which it never enters |

**Why the canvas stays hand-rolled:** two frame loops doing the same work is a
regression, not an upgrade. The director already centralises scroll reads, so
adding ScrollTrigger on top of the same elements would mean measuring twice.

### The three inherited rules, and how they are enforced

1. **Transform and opacity only.** Nothing in the motion layer can cause layout
   shift, which is why CLS stayed at 0.0000 after it was added.
2. **Motion mode is absolute.** `bx-motion.js` returns before doing anything
   unless `data-motion="full"`. It does not animate less in `reduced` and
   `static` — it does not run. Verified: `data-gsap` is `off` and `BX_MOTION` is
   `false` under `prefers-reduced-motion: reduce`.
3. **Enhancement, never dependency.** If GSAP fails to load, the guard returns
   and the CSS fallbacks stand. The page is fully readable and navigable without
   the motion layer, which is the same standard the canvas fields are held to.

### Surface treatments added in the same pass

Implemented from descriptions of the effects rather than copied from any
library, and all compositor-only:

| Treatment | Mechanism | Cost |
|---|---|---|
| `.beam` — travelling border highlight | animated `background-position` on a masked gradient | compositor |
| `.btn--primary` shimmer sweep | skewed gradient, `left` transition on hover/focus only | compositor |
| `.dots` — fine dot lattice | repeating `radial-gradient` | paint once |
| `.card-lift` — elevated hover state | `transform` + `box-shadow` | compositor |
| `.ix-table` — repository index | sticky header, horizontal scroll on narrow screens | none |

Deliberately **not** added, and this is a recorded measurement rather than a
preference: no `backdrop-filter` and no `mix-blend-mode` over any animating
layer. That pairing cost 36 fps when it was measured during the prototype phase,
and the rule has not been relaxed for the new treatments.

### Token additions

```
--amber  #d69e4c   /* held / attention notices — the drift box, "held" tags */
```

The `.drift-box` notice and `.ix-tag--hold` label use it. It is the one place a
third hue enters the palette, and it is scoped to warnings rather than
decoration, so the red/black direction is intact.
