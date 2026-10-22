#!/usr/bin/env python3
"""
Builds the static pages of the BlaxkVERSE site from one shell definition.

Why a generator: the navigation, footer, palette hooks, skip link and metadata
policy must be identical on every page. Defining them once means a fix cannot
land on eight pages and miss the ninth. Output is plain static HTML — no build
step is needed to serve it, and the site works offline.

Usage: python3 tools/build-pages.py
"""
import json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")

# --------------------------------------------------------------------------- shell
NAV_ITEMS = [
    ("index.html", "Journey", "the overview"),
    ("company.html", "Company", "what we build"),
    ("work.html", "Work", "verified projects"),
    ("source.html", "Source", "public code"),
    ("lab.html", "Lab", "experiments"),
    ("about.html", "About", "Blaxk"),
    ("contact.html", "Contact", "start a project"),
]


def head(title, desc, depth=0, extra_css="", body_attrs=""):
    pre = "../" * depth
    return f"""<!DOCTYPE html>
<html lang="en" data-motion="full">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#08090c">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="{pre}assets/css/blaxkverse.css">
{extra_css}
</head>
<body{body_attrs}>
<a class="skip" href="#main">Skip to content</a>
"""


def nav(depth=0):
    pre = "../" * depth
    links = "\n".join(
        f'        <a href="{pre}{h}" data-nav-current>{label}</a>' for h, label, _ in NAV_ITEMS
    )
    sheet = "\n".join(
        f'        <li><a href="{pre}{h}" data-nav-current><span class="t">{label}</span><span class="s">{sub}</span></a></li>'
        for h, label, sub in NAV_ITEMS
    )
    return f"""
<header class="nav">
  <a class="nav-mark" href="{pre}index.html" aria-label="BLAXK BYTE — home">
    <i aria-hidden="true"></i><b>BLAXK</b> <span>BYTE</span>
  </a>
  <nav class="nav-links" aria-label="Primary">
{links}
  </nav>
  <div class="nav-right">
    <button class="kbtn kbtn--kbd" type="button" data-open-palette aria-haspopup="dialog">
      Search <kbd>⌘K</kbd>
    </button>
    <button class="motion-toggle" type="button" data-motion-toggle aria-label="Change motion level">motion: full</button>
    <button class="kbtn nav-burger" type="button" data-open-sheet aria-expanded="false" aria-controls="mobile-sheet">Menu</button>
  </div>
</header>

<div class="sheet" id="mobile-sheet" data-sheet hidden role="dialog" aria-modal="true" aria-label="Navigation">
  <div class="sheet-head">
    <span class="nav-mark"><i aria-hidden="true"></i><b>BLAXK</b> <span>BYTE</span></span>
    <button class="close" type="button" data-close-sheet aria-label="Close navigation">✕</button>
  </div>
  <div class="sheet-body">
    <ul class="sheet-nav">
{sheet}
    </ul>
    <p class="label">Every destination is also in the command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>) and in the footer.</p>
  </div>
</div>
"""


def footer(depth=0):
    pre = "../" * depth
    return f"""
<footer class="foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <h4>BLAXK BYTE TECHNOLOGIES</h4>
        <p class="dim" style="margin:0 0 .6rem">Software, automation and AI systems — built by Blaxk, documented in public.</p>
        <p class="label" style="margin:0">Built in public. Every project here links to the repo it came out of.</p>
      </div>
      <div>
        <h4>Navigate</h4>
        <ul>
          <li><a href="{pre}company.html">Company &amp; services</a></li>
          <li><a href="{pre}work.html">Work</a></li>
          <li><a href="{pre}source.html">Source explorer</a></li>
          <li><a href="{pre}lab.html">Lab</a></li>
          <li><a href="{pre}about.html">About Blaxk</a></li>
        </ul>
      </div>
      <div>
        <h4>Elsewhere</h4>
        <ul>
          <li><a href="https://github.com/Blaxk-C137" target="_blank" rel="noopener noreferrer">GitHub — Blaxk-C137 ↗</a></li>
          <li><a href="{pre}contact.html">Contact</a></li>
          <li><a href="{pre}privacy.html">Privacy &amp; AI disclosure</a></li>
        </ul>
      </div>
      <div>
        <h4>Accessibility</h4>
        <ul>
          <li><a href="?motion=on">Full motion</a></li>
          <li><a href="?motion=reduced">Reduced motion</a></li>
          <li><a href="?motion=off">Explore normally (no motion)</a></li>
        </ul>
        <p class="label" style="margin:.5rem 0 0">Press <kbd>M</kbd> to cycle motion levels.</p>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© <span data-year>2026</span> BLAXK BYTE TECHNOLOGIES</span>
      <span>Content verified against the public record on 15 Oct 2026</span>
      <span>Keyboard: <kbd>/</kbd> or <kbd>⌘K</kbd> search · <kbd>M</kbd> motion</span>
      <a href="{pre}privacy.html" style="color:var(--steel);text-decoration:none">Page views are counted without cookies or stored IP addresses. Details &rarr;</a>
    </div>
  </div>
</footer>

<button class="guide-launcher" type="button" data-guide-open aria-expanded="false" aria-controls="bx-guide">
  <i aria-hidden="true"></i> Ask about this work
</button>

<section class="guide" id="bx-guide" data-guide hidden role="dialog" aria-modal="true" aria-label="BLAXK BYTE assistant">
  <div class="guide-head">
    <i aria-hidden="true" style="width:8px;height:8px;background:var(--red);display:block"></i>
    <h2>BLAXK BYTE — verified answers</h2>
    <button class="close" type="button" data-guide-close aria-label="Close assistant">✕</button>
  </div>
  <div class="guide-body">
    <div class="guide-log" data-guide-log></div>
    <div class="guide-q" data-guide-suggest></div>
  </div>
  <form class="guide-form" data-guide-form>
    <label class="sr" for="guide-input">Your question</label>
    <input id="guide-input" data-guide-input type="text" placeholder="Ask about a project, service or status…" autocomplete="off">
    <button class="btn" type="submit">Ask</button>
  </form>
  <p class="guide-disclaimer">
    Not a chatbot. It looks things up in the records already on this site and quotes them back with a link.
    Ask something I haven&rsquo;t written down and it tells you so instead of inventing an answer. A Gemini-backed
    version is designed but not switched on — the privacy page says where that stands.
  </p>
</section>
"""


def scripts(depth=0, extra=""):
    pre = "../" * depth
    return f"""
<script src="{pre}assets/js/bx-data.js"></script>
<script src="{pre}assets/js/bx-excerpts.js"></script>
<script src="{pre}assets/js/vendor/gsap.min.js"></script>
<script src="{pre}assets/js/vendor/ScrollTrigger.min.js"></script>
<script src="{pre}assets/js/bx-motion.js"></script>
<script src="{pre}assets/js/bx-analytics.js" defer></script>
<script src="{pre}assets/js/emailjs-config.js"></script>
<script src="{pre}assets/js/bx-core.js"></script>
{extra}
</body>
</html>
"""


def write(path, content):
    full = os.path.join(SITE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  wrote {path} ({len(content)//1024}KB)")


def page(path, title, desc, body, depth=0, extra_css="", extra_js="", body_attrs=""):
    write(
        path,
        head(title, desc, depth, extra_css, body_attrs)
        + nav(depth)
        + body
        + footer(depth)
        + scripts(depth, extra_js),
    )


# --------------------------------------------------------------------------- data
with open(os.path.join(SITE, "assets", "js", "bx-data.js"), encoding="utf-8") as f:
    raw = f.read()

# The data file is a JS module assigning window.BX_DATA = (function(){...})().
# For the generator we only need a few facts, so they are re-declared here as
# build-time constants and re-verified by tools/verify-content.mjs against the
# live API. Duplication is deliberate: the generator must not execute JS.
PROJECT_SLUGS = [
    ("blaxk-housing", "BlaXk Housing", "Campus housing marketplace, role-split", "prototype", "JavaScript",
     "React, Django REST Framework, SQLite, Django cache", 81, 342853, "2026-09-02", "d83ed7f7f6"),
    ("edublaxk", "EduBlaxk", "Local AI tutor & assessment engine", "prototype", "TypeScript",
     "React, Vite, Express, Gemini, Claude, OpenAI, pdf.js", 51, 1339151, "2026-09-22", "5c1445d651"),
    ("sabi", "SABI", "Voice-first tutor that runs on your device", "prototype", "TypeScript",
     "React, Vite, Gemini, Whisper small (local), Piper, Web Speech", 119, 733040, "2026-10-12", "9ff8827f93"),
    ("blaxk-xposer", "Blaxk Xposer", "One QR code for your local dev server", "prototype", "Python",
     "Python, GTK, Avahi / zeroconf, Reverse proxy, TLS", 70, 483086, "2026-10-15", "5ccb12dc62"),
    ("forma", "FORMA", "Local voice studio — record, transcribe, search, speak", "prototype", "HTML / TypeScript / Python",
     "React, FastAPI, Whisper Tiny, Piper VITS, PyTorch, Tavily", 146, 4958993, "2026-10-15", "2dc3f6d129"),
    ("blaxk-aggregator", "BlaXk Aggregator", "Compile a whole codebase into one document", "prototype", "TypeScript",
     "React, Vite, Tailwind, Python CLI, pdf.js", 32, 248417, "2026-10-10", "877869619f"),
    ("the-migrator", "The Migrator", "Rebuild a Python environment on a new machine", "prototype", "Python",
     "Python, pip, packaging", 1, 28475, "2026-09-02", "5787f415d4"),
    ("gesture-controls", "Gesture Controls", "Hand tracking as an input device", "prototype", "Python",
     "MediaPipe, OpenCV, Python", 12, 22675, "2026-05-20", None),
]

__all__ = ["page", "head", "nav", "footer", "scripts", "write", "PROJECT_SLUGS", "NAV_ITEMS"]
