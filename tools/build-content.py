#!/usr/bin/env python3
"""
Builds every page of the BlaxkVERSE site.

Single source of truth: site/assets/js/bx-data.js is loaded *through Node* and
its exported object is used to render the static HTML. There is therefore no
second copy of the content to drift out of sync — the pages and the runtime read
the same records.

Case studies are rendered as real static HTML (not client-side) so that titles,
descriptions, project facts and excerpt metadata are present for search engines
and for anyone with JavaScript disabled.

Usage: python3 tools/build-content.py
"""
import json, os, re, subprocess, html, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
sys.path.insert(0, os.path.join(ROOT, "tools"))
from importlib import import_module
shell = import_module("build-pages".replace("-", "_")) if False else None

# The shell helpers live in build-pages.py, which is not importable as a module
# name because of the hyphen. Load it explicitly.
import importlib.util
spec = importlib.util.spec_from_file_location("shellmod", os.path.join(ROOT, "tools", "build-pages.py"))
shellmod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shellmod)
page = shellmod.page
write = shellmod.write

# --------------------------------------------------------------------------- load data via node
def load_data():
    code = (
        "global.window={};"
        "require(process.argv[1]);"
        "require(process.argv[2]);"
        "process.stdout.write(JSON.stringify({data:window.BX_DATA,excerpts:window.BX_EXCERPTS||{}}));"
    )
    out = subprocess.run(
        ["node", "-e", code,
         os.path.join(SITE, "assets", "js", "bx-data.js"),
         os.path.join(SITE, "assets", "js", "bx-excerpts.js")],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise SystemExit("data modules failed to load:\n" + out.stderr)
    bundle = json.loads(out.stdout)
    # Attach the generated body to each excerpt, refusing a body whose commit
    # does not match the pin recorded in the metadata.
    for proj in bundle["data"]["projects"]:
        for ex in proj.get("excerpts", []):
            body = bundle["excerpts"].get(ex.get("key") or "")
            if body and body["sha"] == ex["sha"]:
                ex["lines"] = body["lines"]
                ex["lineCount"] = body["lineCount"]
            elif ex.get("key"):
                raise SystemExit(
                    f"excerpt pin mismatch for {proj['slug']} {ex['path']}: "
                    f"metadata pins {ex['sha']}, generated body is at {body['sha'] if body else 'missing'}")
    return bundle["data"]


D = load_data()
P = {p["slug"]: p for p in D["projects"]}
ORDERED = sorted(D["projects"], key=lambda p: p["order"])


def esc(s):
    return html.escape(str(s), quote=True)


def status_chip(status):
    labels = {"shipped": "shipped", "prototype": "prototype", "in-progress": "in progress", "concept": "concept"}
    return f'<span class="chip" data-status="{status}">{labels.get(status, status)}</span>'


def project_link(slug, pre=""):
    return f'{pre}projects/{slug}.html'


def card(p, pre=""):
    """A project card used on the work index and the journey. Static HTML."""
    stacks = "".join(f"<span>{esc(s)}</span>" for s in p["stack"][:6])
    return f"""
    <article class="panel" style="display:grid;gap:0">
      <div class="panel-head">
        <span>{esc(p['title'])}</span>
        <span style="margin-left:auto">{status_chip(p['status'])}</span>
      </div>
      <div class="panel--pad" style="display:grid;gap:.8rem">
        <p class="lede" style="margin:0;font-size:.98rem">{esc(p['tagline'])}</p>
        <p class="dim" style="margin:0;font-size:.92rem">{esc(p['oneLiner'])}</p>
        <div class="stack-list">{stacks}</div>
        <div class="btn-row" style="margin-top:.3rem">
          <a class="btn" href="{project_link(p['slug'], pre)}">Case study</a>
          <a class="btn btn--ghost" href="https://github.com/{esc(p['repo'])}" target="_blank" rel="noopener noreferrer">Source ↗</a>
        </div>
      </div>
    </article>"""


# =========================================================== 1. JOURNEY (index)
def build_index():
    hero_side = "".join(
        f'<li><b>{esc(p["title"])}</b> — {esc(p["tagline"])}</li>' for p in ORDERED[:4]
    )
    scene_b_projects = "".join(
        f'<a class="reveal" style="text-decoration:none" href="{project_link(p["slug"])}">'
        f'<div style="padding:.9rem 0;border-bottom:1px solid var(--hairline-2)">'
        f'<span class="label">{esc(p["language"])} · {esc(p["status"])}</span>'
        f'<h3 style="margin:.3rem 0 .2rem">{esc(p["title"])}</h3>'
        f'<p class="dim" style="margin:0;font-size:.92rem">{esc(p["tagline"])}</p></div></a>'
        for p in ORDERED[:5]
    )

    body = f"""
<main id="main">
  <!-- ============================== ARRIVAL / SIGNAL ============================== -->
  <section class="hero" data-scene="signal">
    <canvas id="signal-field" width="1600" height="900" aria-hidden="true"></canvas>
    <div class="wrap hero-inner">
      <div class="hero-grid">
        <div>
          <div class="hero-kicker">
            <span class="bar" aria-hidden="true"></span>
            <span class="label">BlaxkVERSE · the digital universe of Blaxk &amp; BLAXK BYTE TECHNOLOGIES</span>
          </div>
          <h1>
            <span class="reveal is-in">Blaxk Byte</span>
            <span class="reveal is-in l2">Building what&rsquo;s next.</span>
          </h1>
          <p class="lede" style="font-size:1.12rem">
            Software, automation and AI systems, built by <strong>Blaxk</strong> and documented in public.
            Every project on this site links to a real repository, a pinned commit, and code you can read
            for yourself. Where something is unfinished, the site says so — that is the whole point of it.
          </p>
          <div class="btn-row mt-2">
            <a class="btn btn--red" href="work.html">See the work</a>
            <a class="btn" href="contact.html">Start a project</a>
            <a class="btn btn--ghost" href="?motion=off">Explore normally</a>
          </div>
          <div class="metrics">
            <div class="metric"><b>{D['facts']['featuredProjects']}</b><span>verified projects</span></div>
            <div class="metric"><b>{D['facts']['publicRepositories']}</b><span>public repositories</span></div>
            <div class="metric"><b>0</b><span>invented metrics</span></div>
          </div>
        </div>
        <aside class="hero-side" aria-label="What this is">
          <h2>Five seconds, no scrolling</h2>
          <ul>{hero_side}</ul>
          <p class="label" style="margin:0">
            BLAXK BYTE TECHNOLOGIES builds web applications, automation systems, AI integration and
            local-first tooling. Blaxk is the builder.
          </p>
        </aside>
      </div>
    </div>
  </section>

  <!-- ============================== CAPABILITIES ============================== -->
  <section class="section" aria-labelledby="s2">
    <div class="wrap">
      <div class="scene-head"><span class="n">01</span><span class="label">Capabilities · what actually gets built</span></div>
      <h2 id="s2" class="reveal"><span>Systems, not slides.</span></h2>
      <p class="lede reveal">Six services are offered today. Three more are listed as capabilities under
        development — because a service you cannot buy yet should not be dressed up as one you can.
        Each active service names the projects where it is demonstrably practised.</p>

      <div class="grid-3 mt-3">
        {"".join(service_card(s) for s in D["services"] if s["active"])}
      </div>

      <p class="count-note">Capabilities under development, listed honestly rather than sold:
        {" · ".join(esc(s["name"]) for s in D["services"] if not s["active"])}.</p>
      <div class="btn-row mt-2">
        <a class="btn" href="company.html">Full services &amp; approach</a>
      </div>
    </div>
  </section>

  <!-- ============================== WORK ============================== -->
  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)" aria-labelledby="s3">
    <div class="wrap">
      <div class="scene-head"><span class="n">02</span><span class="label">Work · {D['facts']['featuredProjects']} projects, all linked to source</span></div>
      <h2 id="s3" class="reveal"><span>Projects are places, not cards.</span></h2>
      <p class="lede reveal">Each of these is working code in a public repository. Two of them —
        EduBlaxk and FORMA — carry committed screenshots as evidence. None of them has a public
        deployment, so none is described as shipped.</p>
      <div class="mt-3" style="max-width:820px">
        {scene_b_projects}
      </div>
      <div class="btn-row mt-2">
        <a class="btn btn--red" href="work.html">All work, filterable</a>
        <a class="btn" href="source.html">Trace the source</a>
      </div>
    </div>
  </section>

  <!-- ============================== EVIDENCE / SOURCE ============================== -->
  <section class="section" aria-labelledby="s4">
    <div class="wrap">
      <div class="scene-head"><span class="n">03</span><span class="label">Evidence · claims cost nothing</span></div>
      <h2 id="s4" class="reveal"><span>Here is the code, pinned to a commit.</span></h2>
      <p class="lede reveal">Curated excerpts are recorded by repository, commit SHA, file path and line
        range, so an excerpt cannot drift away from the code it describes. Nothing from a repository is
        ever executed in your browser — it is rendered as inert, selectable text.</p>
      <div class="grid-2 mt-3">
        <div class="panel">
          <div class="panel-head"><span>Example · EduBlaxk</span><span style="margin-left:auto">server.ts</span></div>
          <div class="panel--pad">
            <p class="dim" style="font-size:.92rem">The trust boundary in fifteen lines: the server reports
              which AI providers are usable and returns model metadata, while the key itself never crosses
              into front-end code.</p>
            <a class="btn mt-1" href="projects/edublaxk.html#source">Read it in the source chamber</a>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><span>Example · Blaxk Xposer</span><span style="margin-left:auto">http_rewriter.py</span></div>
          <div class="panel--pad">
            <p class="dim" style="font-size:.92rem">The docstring names the three failures the module exists
              to fix, then justifies why every rule is a pure function over strings and bytes. The module
              grew a test file larger than the feature.</p>
            <a class="btn mt-1" href="projects/blaxk-xposer.html#source">Read it in the source chamber</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================== BUILDER ============================== -->
  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)" aria-labelledby="s5">
    <div class="wrap">
      <div class="scene-head"><span class="n">04</span><span class="label">The builder</span></div>
      <h2 id="s5" class="reveal"><span>One person, a wide machine shop.</span></h2>
      <div class="grid-2">
        <div>
          <p class="lede reveal">Blaxk is a developer and automation builder, and a mechatronics engineering
            student — which is why the work keeps crossing from software into hardware-adjacent territory:
            computer vision, local speech models, network tooling.</p>
          <p class="lede reveal">The through-line is not a framework. It is a preference: build the version
            that runs on your own machine, understand the whole stack, and publish the evidence.</p>
          <div class="btn-row mt-2">
            <a class="btn" href="about.html">About &amp; capabilities</a>
            <a class="btn btn--ghost" href="lab.html">The lab</a>
          </div>
        </div>
        <div class="panel panel--pad">
          <h3 style="margin-bottom:.8rem">Capabilities, each with evidence</h3>
          <div class="stack-list" style="line-height:2.1">
            {"".join(f'<span>{esc(s["name"])}</span>' for s in D["skills"])}
          </div>
          <p class="label mt-2" style="margin-bottom:0">Every entry maps to a public repository where it is
            demonstrated. Nothing is listed that is not evidenced.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================== CONTACT ============================== -->
  <section class="section" aria-labelledby="s6">
    <div class="wrap">
      <div class="scene-head"><span class="n">05</span><span class="label">Transmission</span></div>
      <h2 id="s6" class="reveal"><span>Tell me what you&rsquo;re building.</span></h2>
      <div class="grid-2">
        <div>
          <p class="lede">Send the shape of the problem and a written scope comes back: what gets built,
            what it costs, and what is explicitly out of range. No fabricated client roster, no invented
            delivery dates, no prices published as bait.</p>
          <div class="btn-row mt-2">
            <a class="btn btn--red" href="contact.html">Start a project</a>
            <a class="btn" href="https://github.com/Blaxk-C137" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
        </div>
        <div class="provenance">
          <b>Status vocabulary used on this site, and what each one means:</b><br>
          <b>shipped</b> — verified public deployment. Nothing on this site currently qualifies.<br>
          <b>prototype</b> — working code with README evidence. All eight featured projects.<br>
          <b>in progress</b> — actively being built.<br>
          <b>concept</b> — a documented idea only.
        </div>
      </div>
    </div>
  </section>
</main>
"""
    page(
        "index.html",
        "BLAXK BYTE TECHNOLOGIES — Building what's next | BlaxkVERSE",
        "Software, automation and AI systems built by Blaxk. Eight verified projects, each linked to a public repository, a pinned commit and readable source code.",
        body,
    )


def service_card(s):
    ev = ""
    if s["evidence"]:
        names = ", ".join(esc(P[e]["title"]) for e in s["evidence"] if e in P)
        ev = f'<p class="label" style="margin:0">Demonstrated in: {names}</p>'
    active = ('<span class="chip" data-status="prototype">offered today</span>' if s["active"]
              else '<span class="chip" data-status="concept">under development</span>')
    note = f'<p class="dim" style="margin:.6rem 0 0;font-size:.88rem">{esc(s["note"])}</p>' if s.get("note") else ""
    deliv = ""
    if s["deliverables"]:
        deliv = '<ul class="tight" style="font-size:.9rem">' + "".join(f"<li>{esc(x)}</li>" for x in s["deliverables"]) + "</ul>"
    return f"""
    <article class="panel panel--pad" style="display:grid;gap:.7rem;align-content:start">
      <div class="row-between"><h3 style="margin:0;font-size:1.15rem">{esc(s['name'])}</h3>{active}</div>
      <div><span class="label">Problem</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(s['problem'])}</p></div>
      <div><span class="label">Approach</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(s['approach'])}</p></div>
      {deliv}
      {note}
      {ev}
    </article>"""


# =========================================================== 2. WORK
def build_work():
    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Work · {D['facts']['featuredProjects']} verified projects</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">The work</h1>
      <p class="lede">Every project here exists as working code in a public repository. Deployment URLs
        were checked; none of these projects has one, so none is labelled shipped. Two carry committed
        screenshots as evidence; the rest are judged by their source and their README.</p>
      <div class="status-key mt-2" data-status-legend></div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <h2 class="reveal" style="font-size:clamp(1.4rem,3vw,2rem)"><span>The field</span></h2>
      <p class="dim" style="max-width:70ch">Projects are plotted by theme. Lines are drawn only where two
        projects genuinely share a theme or a technology, read from these records — they are a statement
        about the work, not decoration. The list below the field is the primary way through; the field is
        a second view of the same eight things.</p>
      <div class="field-wrap mt-2">
        <canvas id="work-field" width="1200" height="600" aria-label="Constellation of projects. Use the list below for the same information." role="img"></canvas>
        <div class="field-legend">
          <span><i></i>shared theme</span>
          <span><i class="dim"></i>shared technology</span>
          <span id="field-focus" style="display:flex;gap:.6rem;align-items:center;margin-left:auto"></span>
        </div>
      </div>
      <p class="label mt-1">Canvas is decorative; every project above has a text entry in the list below, and a case study page.</p>

      <div class="filters" data-filters role="group" aria-label="Filter projects by theme"></div>
      <p class="count-note" data-count-note></p>
      <div class="project-rows" id="project-rows"></div>
      <noscript>
        <p class="note">Filters need JavaScript. Every project is listed below regardless.</p>
      </noscript>
      <noscript>
        <div class="project-rows">
          {"".join(f'<a class="project-row" href="projects/{p["slug"]}.html"><span class="idx">{i+1:02d}</span><span><span class="ttl">{esc(p["title"])}</span><span class="sub"> — {esc(p["tagline"])}</span></span><span class="side">{status_chip(p["status"])}</span></a>' for i, p in enumerate(ORDERED))}
        </div>
      </noscript>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Case studies</h2>
      <p class="dim" style="max-width:70ch">Each case study records the problem, the intended user, the
        approach, the decisions that mattered, the honest limitations, and a pinned excerpt where one has
        been reviewed.</p>
      <div class="grid-2 mt-2">
        {"".join(card(p) for p in ORDERED)}
      </div>
    </div>
  </section>
</main>
"""
    page("work.html", "Work — 8 verified projects | BLAXK BYTE TECHNOLOGIES",
         "Eight verified projects: campus housing, local-first AI tutoring, voice tooling, network utilities and computer vision. All linked to public repositories.",
         body)


# =========================================================== 3. CASE STUDIES
def build_case(p):
    facts = [
        ("Status", f'<span class="chip" data-status="{p["status"]}">{p["status"]}</span>'),
        ("Language", esc(p["language"])),
        ("Repository", f'<a class="inline-link" href="https://github.com/{esc(p["repo"])}" target="_blank" rel="noopener noreferrer">{esc(p["repo"])} ↗</a>'),
        ("Last push", esc(p["lastPush"])),
        ("Source size", f'{p["files"]} files · {round(p["bytes"]/1024)} KB'),
        ("Licence", esc(p["license"]) if p["license"] else "no licence file"),
    ]
    facts_html = "".join(
        f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in facts
    )

    shots = ""
    if p["screenshots"]:
        figs = "".join(f"""
        <figure class="shot{' shot--tall' if s['h'] > s['w'] * 1.3 else ''}">
          <img src="../assets/img/{esc(s['file'])}" width="{s['w']}" height="{s['h']}" loading="lazy" decoding="async"
               alt="{esc(s['caption'])} — screenshot committed in the public repository {esc(p['repo'])}">
          <figcaption>
            {esc(s['caption'])}
            <a href="https://github.com/{esc(p['repo'])}" target="_blank" rel="noopener noreferrer">source ↗</a>
          </figcaption>
        </figure>""" for s in p["screenshots"])
        shots = f"""
      <section class="section" id="screenshots" style="padding-top:0">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Screenshots from the repository</h2>
        <p class="dim" style="max-width:70ch">These are the images committed to the public repository — not
          marketing renders and not re-creations. Each one is captioned with what it shows and links back to
          the source.</p>
        <div class="shot-grid mt-2">{figs}</div>
      </section>"""
    else:
        shots = f"""
      <section class="section" id="screenshots" style="padding-top:0">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Screenshots</h2>
        <p class="note note--plain" style="max-width:76ch">The repository has no committed interface
          screenshot, so none is shown. Re-creating one, or illustrating this page with unrelated imagery,
          would misrepresent what exists — the source, the README and the file tree below are the evidence
          available for this project.</p>
      </section>"""

    decisions = "".join(f"""
        <div class="field panel--pad" style="border:1px solid var(--hairline);background:var(--void-2)">
          <h3 style="font-size:1.05rem;margin-bottom:.4rem">{esc(d['t'])}</h3>
          <p class="dim" style="margin:0;font-size:.94rem">{esc(d['d'])}</p>
        </div>""" for d in p["decisions"])

    limits = "".join(f"<li>{esc(x)}</li>" for x in p["limitations"])
    screens = "".join(f"<li>{esc(x)}</li>" for x in p.get("screens", [])) or ""

    # --- source chamber: first excerpt with a body, plus a pointer list for the rest
    with_body = [e for e in p["excerpts"] if e.get("lines")]
    pointer_only = [e for e in p["excerpts"] if not e.get("lines")]

    chamber = ""
    if with_body:
        e = with_body[0]
        start = e.get("startLine") or 1
        lines = "".join(
            f'<span class="ln"><span class="n">{start+i}</span>{html.escape(line) or " "}</span>'
            for i, line in enumerate(e["lines"])
        )
        blob = f'https://github.com/{p["repo"]}/blob/{e["sha"]}/{e["path"]}#L{start}-L{e.get("endLine", start+len(e["lines"])-1)}'
        chamber = f"""
      <div class="code" data-excerpt-source="{esc(e['path'])}">
        <div class="code-head">
          <span class="path">{esc(e['path'])}</span>
          <span>{esc(e['lang'])}</span>
          <span>lines {start}–{e.get('endLine', start + len(e['lines']) - 1)}</span>
          <span class="spacer"></span>
          <span>commit {esc(e['sha'][:10])}</span>
        </div>
        <pre tabindex="0" aria-label="Pinned source excerpt from {esc(p['repo'])}: {esc(e['label'])}">{lines}</pre>
        <div class="code-foot">
          <div class="row-between">
            <span>{esc(p['repo'])} · {esc(e['path'])} @ {esc(e['sha'][:10])} · rendered as inert text, never executed · excerpt published with the author&rsquo;s own permission as the repository owner</span>
            <a class="kbtn" href="{blob}" target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>
          </div>
        </div>
      </div>
      <p class="mt-1"><strong>{esc(e['label'])}.</strong> <span class="dim">{esc(e['why'])}</span></p>"""
    else:
        chamber = """
      <div class="code">
        <div class="code-head"><span class="path">no excerpt reviewed</span><span class="spacer"></span><span>—</span></div>
        <pre tabindex="0" aria-label="No excerpt available">// No pinned excerpt has been reviewed for this project yet.
// The chamber shows an empty state rather than filling the space with
// unrelated code or a mock-up. The repository is linked above.</pre>
        <div class="code-foot">An empty chamber is the honest state. Nothing here is illustrative or invented.</div>
      </div>"""

    pointer_html = ""
    if pointer_only:
        items = "".join(
            f'<li><a class="inline-link" href="https://github.com/{esc(p["repo"])}/blob/{esc(e["sha"])}/{esc(e["path"])}" target="_blank" rel="noopener noreferrer">{esc(e["path"])} ↗</a> — {esc(e["why"])}</li>'
            for e in pointer_only
        )
        pointer_html = f'<h3 class="mt-2" style="font-size:1.05rem">Pointers, without a quoted body</h3><ul class="tight">{items}</ul>'

    others = [x for x in ORDERED if x["slug"] != p["slug"]][:3]
    next_html = "".join(
        f'<a class="project-row" href="{x["slug"]}.html"><span class="idx">{x["order"]:02d}</span>'
        f'<span><span class="ttl">{esc(x["title"])}</span><span class="sub"> — {esc(x["tagline"])}</span></span>'
        f'<span class="side">{status_chip(x["status"])}</span></a>' for x in others
    )

    body = f"""
<main id="main">
  <article class="section" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap case">
      <div class="case-head">
        <a class="label" href="../work.html" style="text-decoration:none">← All work</a>
        <h1 style="font-size:clamp(2rem,5.4vw,3.6rem);margin:0">{esc(p['title'])}</h1>
        <p class="lede" style="font-size:1.15rem;margin:0">{esc(p['tagline'])}</p>
        <div class="case-meta">
          {status_chip(p['status'])}
          <span class="chip">{esc(p['language'])}</span>
          {"".join(f'<span class="chip">{esc(t)}</span>' for t in p['themes'][:3])}
        </div>
      </div>

      <dl class="case-facts">{facts_html}</dl>

      <div class="note note--plain">
        <strong>Provenance.</strong> Every figure on this page was read from the public repository on
        {D['snapshot']} — file counts and sizes from the recursive git tree, language and dates from the
        GitHub API. No usage statistic, download count, user number or performance claim is made anywhere on
        this page, because none of those has been measured.
      </div>

      <section id="brief">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">The brief</h2>
        <div class="grid-2">
          <div><h3 style="font-size:1.05rem">Problem</h3><p class="dim">{esc(p['problem'])}</p></div>
          <div><h3 style="font-size:1.05rem">Who it is for</h3><p class="dim">{esc(p['users'])}</p></div>
        </div>
        <div class="mt-3">
          <h3 style="font-size:1.05rem">Approach</h3>
          <p class="dim" style="max-width:76ch">{esc(p['approach'])}</p>
          <h3 class="mt-2" style="font-size:1.05rem">Personal contribution</h3>
          <p class="dim" style="max-width:76ch">{esc(p['contribution'])}</p>
        </div>
      </section>

      <section id="decisions">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Decisions that mattered</h2>
        <p class="dim" style="max-width:70ch">These are the choices that shaped the code — the ones worth
          explaining, rather than a feature list.</p>
        <div class="grid-2 mt-2">{decisions}</div>
      </section>

      <section id="limits">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Limitations, stated plainly</h2>
        <ul class="tight" style="max-width:76ch">{limits}{screens}</ul>
        <p class="dim mt-2" style="max-width:76ch"><strong>What this is not:</strong> there is no public
          deployment for this project, so it should not be described as live, available, in production, or
          used by anyone. Claims about scale or reliability would require measurements that do not exist.</p>
      </section>

      {shots}

      <section id="source" class="section" style="padding-top:0">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Source chamber</h2>
        <p class="dim" style="max-width:70ch">An excerpt recorded by repository, commit, path and line range —
          so this page can be checked against the code it describes at any time. Selectable text, never
          executed.</p>
        <div class="mt-2">{chamber}</div>
        {pointer_html}
      </section>

      <section id="lessons">
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">What it taught</h2>
        <p class="lede" style="max-width:76ch">{esc(p['lessons'])}</p>
      </section>

      <section>
        <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Continue</h2>
        <div class="project-rows">{next_html}</div>
        <div class="btn-row mt-2">
          <a class="btn" href="../work.html">All work</a>
          <a class="btn" href="../source.html">Source explorer</a>
          <a class="btn btn--ghost" href="../contact.html">Start a project</a>
        </div>
      </section>
    </div>
  </article>
</main>
"""
    page(
        f'projects/{p["slug"]}.html',
        f'{p["title"]} — case study | BLAXK BYTE TECHNOLOGIES',
        f'{p["oneLiner"]} Prototype in a public repository: {p["files"]} files, {p["language"]}, last pushed {p["lastPush"]}.',
        body,
        depth=1,
    )


# =========================================================== 4. SOURCE
def build_source():
    rows = "".join(
        f'<tr><td><a class="inline-link" href="https://github.com/{esc(p["repo"])}" target="_blank" rel="noopener noreferrer">{esc(p["repo"].split("/")[1])}</a></td>'
        f'<td>{esc(p["language"])}</td><td class="mono">{p["files"]}</td><td class="mono">{round(p["bytes"]/1024)} KB</td>'
        f'<td class="mono">{esc(p["lastPush"])}</td><td>{esc(p["license"]) if p["license"] else "—"}</td></tr>'
        for p in ORDERED
    )
    ex_rows = "".join(
        f'<tr><td><a class="inline-link" href="https://github.com/{esc(e["repo"])}" target="_blank" rel="noopener noreferrer">{esc(e["repo"].split("/")[1])}</a></td>'
        f'<td>{html.escape(esc(html.unescape(e["reason"])))}</td></tr>'
        for e in D["exclusions"]
    )
    tech_rows = "".join(
        f'<tr><td><strong>{esc(s["name"])}</strong></td><td class="dim">'
        + " · ".join(f'<a class="inline-link" href="projects/{esc(slug)}.html">{esc(P[slug]["title"])}</a>' for slug in s["evidence"] if slug in P)
        + "</td></tr>"
        for s in D["skills"]
    )

    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Source · public repositories</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">The source explorer</h1>
      <p class="lede">Everything on this site traces back to a public repository under
        <a class="inline-link" href="https://github.com/{esc(D['owner'])}" target="_blank" rel="noopener noreferrer">{esc(D['owner'])} ↗</a>.
        This page records what is included, what is deliberately excluded and why, and how each technology
        claim maps to real code.</p>
      <div class="note mt-2">
        <strong>On the older namespace.</strong> Earlier project links pointed at
        <span class="mono">{esc(D['facts']['previousNamespace'])}</span>. That account and its portfolio URL
        return HTTP 404 as of {D['snapshot']}, so nothing from that namespace is reproduced, claimed or
        linked here. The canonical account is <span class="mono">{esc(D['owner'])}</span>.
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Featured repositories</h2>
      <p class="dim" style="max-width:70ch">All figures read from the GitHub API and the recursive git tree
        on {D['snapshot']}. File counts include every tracked file, not just source files.</p>
      <div class="panel mt-2" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.92rem">
          <caption class="sr">Featured repositories with language, file count, size, last push and licence</caption>
          <thead>
            <tr style="text-align:left">
              <th scope="col" style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline)">Repository</th>
              <th scope="col" style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline)">Language</th>
              <th scope="col" style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline)">Files</th>
              <th scope="col" style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline)">Size</th>
              <th scope="col" style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline)">Last push</th>
              <th scope="col" style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline)">Licence</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <p class="count-note">Most of these repositories carry no licence file. That means, technically, all
        rights reserved by the author — worth knowing before you reuse anything from them. Adding an explicit
        licence to each project is recorded as an open item rather than quietly ignored.</p>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Technology trace</h2>
      <p class="dim" style="max-width:70ch">Every capability claimed on this site, traced to the repository
        where it is actually demonstrated. If a row could not be filled with a real repository, the row would
        not exist.</p>
      <div class="panel mt-2" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.92rem">
          <caption class="sr">Technology and the projects that demonstrate it</caption>
          <tbody>{tech_rows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Deliberate exclusions</h2>
      <p class="dim" style="max-width:76ch">The account has {D['facts']['publicRepositories']} public
        repositories. Eight are presented as work. The rest fall into two groups, and listing them is the
        point: a portfolio that shows everything is not curating, and a portfolio that quietly omits things
        is not being straight with you.</p>
      <div class="panel mt-2" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.92rem">
          <caption class="sr">Repositories excluded from the portfolio and the reason for each</caption>
          <tbody>{ex_rows}</tbody>
        </table>
      </div>
      <p class="count-note">Two of those forks are excluded on judgement as well as authorship: they carry
        third-party tooling or a proof-of-concept with destructive potential, and neither belongs on a page that
        asks you to trust the person behind it. Those nine forks account for every unexhibited repository that
        is not Blaxk's own work — the remaining twenty-six are all original, and none of them is a fork. One is
        the account's profile repository, three are empty, and twenty-two are smaller tools and personal
        utilities: a WhatsApp bot, a church programme display, a downloader, an encryptor. They are public and
        they are real. They are not presented as case studies because they lack the README, screenshot and code
        evidence a case study is built from — and padding the portfolio to make the number look larger would be
        the same dishonesty in the other direction.</p>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">How the ingestion is designed to work</h2>
      <p class="dim" style="max-width:76ch">This site is static, and the pages you are reading were built
        from a verification pass rather than fetched live in your browser. The designed production pipeline —
        documented in full in the repository — is:</p>
      <pre class="panel panel--pad mono" style="overflow-x:auto;font-size:.82rem;line-height:1.8;margin-top:1rem">GitHub API  →  server fetcher  →  repository allowlist  →  metadata normalisation
            →  content cache  →  server-rendered pages  →  project visualisations</pre>
      <ul class="tight mt-2" style="max-width:78ch">
        <li>Only an explicit allowlist is ever published; a repository existing on GitHub is not a reason to show it.</li>
        <li>Excerpts are pinned by commit SHA, path and line range, and pre-screened by a secrets and high-risk content filter before publication.</li>
        <li>API responses are cached; a GitHub outage degrades to clearly-labelled stale data rather than an empty page or a broken layout.</li>
        <li>"Updated" is shown with a timestamp. A single push is never described as "actively maintained".</li>
        <li>Snippets are rendered as inert highlighted text. Nothing from a repository is ever executed in a visitor's browser.</li>
      </ul>
    </div>
  </section>
</main>
"""
    page("source.html", "Source explorer — public repositories | BLAXK BYTE TECHNOLOGIES",
         "Every claim on this site traced to a public repository: featured repos, technology trace, and the repositories deliberately excluded with reasons.",
         body)


# =========================================================== 5. COMPANY
def build_company():
    active = "".join(service_card(s) for s in D["services"] if s["active"])
    planned = "".join(service_card(s) for s in D["services"] if not s["active"])
    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Company</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">BLAXK BYTE TECHNOLOGIES</h1>
      <p class="lede" style="font-size:1.1rem">A software studio building web applications, automation,
        AI integration and local-first tooling — with shipping evidence rather than slideware as the
        qualification.</p>
      <div class="note mt-2" style="max-width:80ch">
        <strong>What is not claimed here.</strong> Company registration status is not asserted on this site,
        because it has not been verified as complete. There is no client list, no team size, no founding
        date, no certification and no revenue figure on these pages, because publishing any of those would
        require facts this build does not have. If you need the legal position for a contract, ask — you will
        get a straight answer rather than a footer.
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Services offered today</h2>
      <p class="dim" style="max-width:70ch">Each service names the projects where it is demonstrably
        practised, so the claim can be checked rather than believed.</p>
      <div class="grid-3 mt-2">{active}</div>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Capabilities under development</h2>
      <p class="dim" style="max-width:76ch">These are listed, not sold. Publishing them keeps the roadmap
        honest: you can see what is being worked towards without being offered something that does not exist
        yet.</p>
      <div class="grid-3 mt-2">{planned}</div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">How the work is done</h2>
      <div class="grid-2">
        <div class="dl">
          <div><dt>1 · Written scope before code</dt><dd>What gets built, what it costs, what is explicitly out of range, and what "done" means. Agreed in writing before the first commit.</dd></div>
          <div><dt>2 · You own the repository</dt><dd>Work happens in a repository you control, with readable commits — not a demo dropped at the end.</dd></div>
          <div><dt>3 · Honest status reporting</dt><dd>Prototype, in progress or shipped. A thing that is nearly working is never described as working, to you or on a public page.</dd></div>
          <div><dt>4 · Failure modes designed, not discovered</dt><dd>What happens when the API key expires, the model is down, the network drops, or the input is hostile. Decided up front, tested before handover.</dd></div>
          <div><dt>5 · Documents you can hand to someone else</dt><dd>Setup notes, a runbook and the operational boundaries written for the next person who touches it, who will not be the person who wrote it.</dd></div>
        </div>
        <div class="panel panel--pad">
          <h3 style="margin-bottom:.6rem">What this studio is not</h3>
          <ul class="tight">
            <li>It does not publish invented testimonials, client logos or delivery statistics.</li>
            <li>It does not claim certifications it does not hold.</li>
            <li>It does not offer security services as a certified penetration test, or cloud management as a managed service.</li>
            <li>It does not quote a price before understanding the problem — a number that arrives too fast is usually wrong, and often deliberately low.</li>
            <li>It does not claim projects are live when they run only on a laptop.</li>
          </ul>
          <div class="btn-row mt-2">
            <a class="btn btn--red" href="contact.html">Start a project</a>
            <a class="btn" href="work.html">See the evidence</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    page("company.html", "Company & services | BLAXK BYTE TECHNOLOGIES",
         "Services offered today — web applications, automation, AI integration, local-first tooling and network systems — plus capabilities under development, listed honestly.",
         body)


# =========================================================== 6. ABOUT
def build_about():
    tl = "".join(f"""
      <div data-kind="{esc(t['kind'])}">
        <time datetime="{esc(t['date'])}">{esc(t['date'])}</time>
        <h3>{esc(t['event'])}</h3>
        <p class="dim" style="margin:0;font-size:.94rem">{esc(t['detail'])}</p>
      </div>""" for t in D["timeline"])

    skills = "".join(f"""
      <tr>
        <td style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline-2)"><strong>{esc(s['name'])}</strong></td>
        <td style="padding:.7rem .9rem;border-bottom:1px solid var(--hairline-2)" class="dim">
          {" · ".join(f'<a class="inline-link" href="projects/{esc(slug)}.html">{esc(P[slug]["title"])}</a>' for slug in s["evidence"] if slug in P)}
        </td>
      </tr>""" for s in D["skills"])

    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">About · the builder</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">Blaxk</h1>
      <div class="grid-2">
        <div>
          <p class="lede" style="font-size:1.08rem">Developer and automation builder. Mechatronics
            engineering student. The work tends to land where software meets something physical or
            constrained: local speech models, computer vision, network tooling, machines that have to keep
            working when the internet does not.</p>
          <p class="lede">The preference running through all of it is simple. Build the version that runs on
            your own machine. Understand the whole stack rather than the top layer. Publish the evidence, and
            be precise about what is finished — because a portfolio that overstates is worse than one that
            shows less.</p>
          <p class="lede">That second principle is why this site publishes limitations and exclusions. It is
            also why the only statuses used here are the four that can be verified.</p>
        </div>
        <div class="panel panel--pad">
          <h3 style="margin-bottom:.7rem">At a glance</h3>
          <dl class="dl">
            <div><dt>Works in</dt><dd>React · TypeScript · JavaScript · Python · Node &amp; Express · Django REST Framework · FastAPI</dd></div>
            <div><dt>Also works with</dt><dd>Local speech models (Whisper, Piper) · MediaPipe &amp; OpenCV · GTK · reverse proxies · AI provider APIs</dd></div>
            <div><dt>Daily environment</dt><dd>Linux (Fedora); Windows for cross-platform tooling such as Xposer</dd></div>
            <div><dt>Studying</dt><dd>Mechatronics engineering</dd></div>
            <div><dt>Public account</dt><dd><a class="inline-link" href="https://github.com/{esc(D['owner'])}" target="_blank" rel="noopener noreferrer">{esc(D['owner'])} ↗</a> — {D['facts']['publicRepositories']} public repositories</dd></div>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Capabilities, each with evidence</h2>
      <p class="dim" style="max-width:76ch">This is the honest version of a skills list. Each row names the
        repositories where the capability is actually demonstrated in public code — so the claim is checkable
        rather than assertive, and anything not demonstrated is simply absent.</p>
      <div class="panel mt-2" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.94rem">
          <caption class="sr">Capabilities and the repositories that demonstrate them</caption>
          <tbody>{skills}</tbody>
        </table>
      </div>
      <p class="count-note">Deliberately absent: any language, framework or discipline not evidenced in a
        public repository. Expanding this list is a matter of building something, not of editing the page.</p>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">A timeline you can check</h2>
      <p class="dim" style="max-width:76ch">Every entry is derived from repository dates readable on the
        public account. No employer, award, client or conference is claimed, because none would survive
        being checked.</p>
      <div class="timeline mt-3">{tl}</div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Work with me</h2>
      <div class="grid-2">
        <div>
          <p class="lede">If you are building something in the same territory — education tooling,
            local-first applications, automation, AI features that must not leak a key or a document —
            that is the shortest conversation.</p>
          <div class="btn-row mt-2">
            <a class="btn btn--red" href="contact.html">Start a project</a>
            <a class="btn" href="work.html">Read the case studies</a>
          </div>
        </div>
        <div class="panel panel--pad">
          <h3 style="margin-bottom:.6rem">Prefer to judge the code first?</h3>
          <p class="dim" style="margin-bottom:1rem">Four case studies carry a pinned excerpt with an
            explanation of why that excerpt matters. It is a faster read than a CV.</p>
          <div class="grid-2">
            <a class="btn" href="projects/edublaxk.html#source">EduBlaxk · trust boundary</a>
            <a class="btn" href="projects/blaxk-xposer.html#source">Xposer · rewriting rules</a>
            <a class="btn" href="projects/blaxk-housing.html#source">Housing · view tracking</a>
            <a class="btn" href="projects/sabi.html#source">SABI · speech queue</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    page("about.html", "About Blaxk — capabilities, each with evidence | BLAXK BYTE TECHNOLOGIES",
         "Blaxk: developer, automation builder and mechatronics engineering student. Capabilities mapped to the public repositories that demonstrate them, and a timeline taken from repository dates.",
         body)


# =========================================================== 7. LAB
def build_lab():
    concepts = [
        {
            "name": "BlaXkVault",
            "status": "concept",
            "what": "A media discovery and management product: ingest, identify, organise and find again.",
            "state": "Scoped as a product direction. No repository, no interface, no data model published.",
            "why_hidden": "Listed here as a concept so it is not silently presented as work in progress."
        },
        {
            "name": "NIPEX job-document matcher",
            "status": "concept",
            "what": "An automation that matches opportunities to the documents a person already has, and flags what is missing.",
            "state": "Explored as a Python and n8n automation flow. Not built or published.",
            "why_hidden": "Automation of this kind touches personal documents, so it needs a privacy design before it needs a repository."
        },
        {
            "name": "Campus gigs marketplace (SkillMatch / Wema Campus Gigs)",
            "status": "concept",
            "what": "Several names were explored for one idea: matching short campus work to students who can do it.",
            "state": "Names and scope explored only. Nothing launched, and no competing names are presented as brands.",
            "why_hidden": "Presenting one working name would imply a launch that did not happen."
        },
        {
            "name": "3D interactive site experiment",
            "status": "concept",
            "what": "A React and WebGL experiment exploring spatial navigation in the browser — which is where the constellation idea on this site came from.",
            "state": "Technique explored and partially absorbed into BlaxkVERSE itself. The standalone project is not published.",
            "why_hidden": "Its visual language drew on third-party references. Anything derived from another work's assets belongs in a sketchbook, not a portfolio."
        },
        {
            "name": "Wedding event web app",
            "status": "prototype",
            "what": "An invitation and programme page built for a real family event, with a shareable digital invitation.",
            "state": "Built as a real, used deliverable. The repository is not presented as a case study because the content is private to the family who commissioned it.",
            "why_hidden": "The people in the photographs never agreed to appear on a portfolio."
        },
        {
            "name": "Encryption and utility experiments",
            "status": "prototype",
            "what": "Small single-purpose command-line utilities: text encryption, package inventory, audio feedback for git events, a download helper.",
            "state": "Written and usable, kept as tools rather than products.",
            "why_hidden": "They are utilities for their author. Publishing a case study for a twenty-line script would pad the portfolio rather than strengthen it."
        }
    ]

    cards = "".join(f"""
      <article class="panel panel--pad" style="display:grid;gap:.7rem;align-content:start">
        <div class="row-between">
          <h3 style="margin:0;font-size:1.1rem">{esc(c['name'])}</h3>
          <span class="chip" data-status="{c['status']}">{c['status']}</span>
        </div>
        <div><span class="label">Direction</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(c['what'])}</p></div>
        <div><span class="label">Actual state</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(c['state'])}</p></div>
        <div><span class="label">Why it is not in the work section</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(c['why_hidden'])}</p></div>
      </article>""" for c in concepts)

    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Lab · experiments, concepts and honest dead ends</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">The lab</h1>
      <p class="lede">Not everything worth showing is finished, and not everything finished is worth showing.
        This page keeps the two apart. Every entry below states what was actually explored, what state it
        reached, and — where it was left alone — why.</p>
      <div class="note mt-2" style="max-width:80ch">
        <strong>Rule for this page:</strong> an entry appears as a concept and stays a concept until there is
        a repository with working code. No idea is promoted by enthusiasm, and nothing here is offered as a
        service.
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="grid-2">{cards}</div>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">The experience prototypes behind this site</h2>
      <p class="dim" style="max-width:78ch">This site was not designed by picking a template. Before any
        production code was written, three radically different navigation and scrolling concepts were built,
        run on desktop and mobile, measured for frame rate and long tasks, scored against six weighted
        criteria — and the loser of that contest is still here to read.</p>
      <div class="grid-3 mt-2">
        <div class="panel panel--pad">
          <h3 style="font-size:1.05rem">Concept A — Spatial Constellation</h3>
          <p class="dim" style="font-size:.92rem">Projects as a navigable field with a camera that travels.
            The most original idea in the set, and the fastest after a measured compositing fix. Reused here
            as the work field.</p>
          <p class="label" style="margin:0">Scored 81/100</p>
        </div>
        <div class="panel panel--pad" style="border-color:rgba(240,68,69,.42)">
          <h3 style="font-size:1.05rem">Concept B — Source Reactor</h3>
          <p class="dim" style="font-size:.92rem">An engineering instrument: projects as modules, source as a
            readable artifact on the same stage. Its navigation model won and now drives this site's rail,
            palette and source chamber.</p>
          <p class="label" style="margin:0">Scored 85/100 · runner-up by one point</p>
        </div>
        <div class="panel panel--pad" style="border-color:var(--red)">
          <h3 style="font-size:1.05rem">Concept C — Infinite Signal</h3>
          <p class="dim" style="font-size:.92rem">A cinematic editorial journey. Selected as the spine of
            BlaxkVERSE because its story is carried by typography and real content — the most honest
            substrate for a portfolio about evidence.</p>
          <p class="label" style="margin:0">Scored 86/100 · selected</p>
        </div>
      </div>
      <p class="count-note">Measurements, scores, screenshots of every state and the full rationale are
        recorded in <span class="mono">docs/experience-decision.md</span> and
        <span class="mono">docs/performance-report.md</span> in the project repository, alongside the
        runnable prototypes themselves.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">What the lab is for</h2>
      <div class="grid-2">
        <p class="lede">Experiments exist to answer questions that a specification cannot. Can speech
          recognition run locally fast enough to feel like conversation? Can a phone be handed a local dev
          server without a tunnel? Can a device with no internet still be a decent tutor? Each shipped project
          on this site started as one of those questions.</p>
        <div class="panel panel--pad">
          <h3 style="margin-bottom:.6rem">Bring a question to the lab</h3>
          <p class="dim">If you have a problem that needs a prototype before it needs a product — a
            feasibility check, a spike, a proof that a local-first approach can work — that is exactly the
            kind of brief this page exists for.</p>
          <div class="btn-row mt-2">
            <a class="btn btn--red" href="contact.html">Start a conversation</a>
            <a class="btn" href="work.html">See what shipped</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    page("lab.html", "Lab — experiments, concepts and honest dead ends | BLAXK BYTE TECHNOLOGIES",
         "Concepts and experiments with their real state, the three experience prototypes behind this site, and why some promising ideas were deliberately left alone.",
         body)


# =========================================================== 8. CONTACT
def build_contact():
    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Contact · transmission</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">Start a project</h1>
      <p class="lede">Send the shape of the problem and a written scope comes back: what gets built, what it
        costs, and what is explicitly out of range. A useful reply needs three things — what you are trying
        to do, what exists today, and any real deadline.</p>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="grid-2" style="align-items:start">
        <form class="form panel panel--pad" data-contact-form novalidate>
          <h2 style="font-size:1.3rem;margin-bottom:.3rem">Project inquiry</h2>
          <p class="label" style="margin-bottom:1rem">Fields marked required are the ones that make a real reply possible.</p>

          <div class="field-row">
            <label for="cf-name">Your name <span aria-hidden="true">*</span></label>
            <input id="cf-name" name="name" type="text" autocomplete="name" required aria-required="true">
          </div>
          <div class="field-row">
            <label for="cf-email">Email <span aria-hidden="true">*</span></label>
            <input id="cf-email" name="email" type="email" autocomplete="email" required aria-required="true" aria-describedby="cf-email-hint">
            <span class="field-hint" id="cf-email-hint">Used only to reply. Nothing is stored, sold or subscribed.</span>
          </div>
          <div class="field-row">
            <label for="cf-kind">What kind of work</label>
            <select id="cf-kind" name="kind">
              <option>Web application</option>
              <option>Automation or scripting</option>
              <option>AI integration</option>
              <option>Local-first or offline tooling</option>
              <option>Systems or network tooling</option>
              <option>Something else / not sure yet</option>
            </select>
          </div>
          <div class="field-row">
            <label for="cf-what">The problem <span aria-hidden="true">*</span></label>
            <textarea id="cf-what" name="what" required aria-required="true" aria-describedby="cf-what-hint"></textarea>
            <span class="field-hint" id="cf-what-hint">What are you trying to do, what exists today, and what would make this worth doing?</span>
          </div>
          <div class="field-row">
            <label for="cf-deadline">Deadline, if one is real</label>
            <input id="cf-deadline" name="deadline" type="text" placeholder="e.g. end of November, or none">
          </div>

          <div class="btn-row">
            <button class="btn btn--red" type="submit">Transmit</button>
            <a class="btn" href="https://github.com/{esc(D['owner'])}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
          <div class="trace" data-contact-trace aria-hidden="true"><i></i><b></b></div>
          <p class="form-status" data-contact-status role="status" aria-live="polite">
            Ready. Required fields are validated in the browser before anything is sent.
          </p>
          <p class="label" style="margin:0">
            This build has no server, so submitting will tell you plainly that nothing was transmitted — see
            the note opposite. That is deliberate: a form that pretends to send is worse than one that admits
            it cannot.
          </p>
        </form>

        <div style="display:grid;gap:1.2rem">
          <div class="panel panel--pad">
            <h2 style="font-size:1.2rem;margin-bottom:.6rem">What happens after you send this</h2>
            <dl class="dl">
              <div><dt>1 · A reply with questions</dt><dd>Usually the same day. If the brief is clear, the reply is a scope rather than a questionnaire.</dd></div>
              <div><dt>2 · A written scope</dt><dd>Deliverables, timeline, price, and — importantly — what is not included.</dd></div>
              <div><dt>3 · Work in your repository</dt><dd>Readable commits, not a reveal at the end.</dd></div>
              <div><dt>4 · Handover documents</dt><dd>Setup, runbook and known limits, written for whoever maintains it next.</dd></div>
            </dl>
          </div>

          <div class="panel panel--pad">
            <h2 style="font-size:1.2rem;margin-bottom:.6rem">Direct channels</h2>
            <ul class="tight">
              <li><a class="inline-link" href="https://github.com/{esc(D['owner'])}" target="_blank" rel="noopener noreferrer">GitHub — {esc(D['owner'])} ↗</a> — where all the work lives, and a legitimate way to start a conversation.</li>
              <li><a class="inline-link" href="about.html">Read the capabilities first</a> if you want to judge fit before writing.</li>
              <li><a class="inline-link" href="work.html">Read a case study</a> if you want to see how decisions get made.</li>
            </ul>
            <p class="label mt-2" style="margin-bottom:0">
              No public telephone number or postal address is published, and the company registration
              position is not asserted on this site. Both are available directly on request when a contract
              requires them.
            </p>
          </div>

          <div class="provenance">
            <b>No tracking on this page.</b> There is no analytics script, no pixel, no cookie and no
            third-party embed anywhere on this site. The assistant panel answers from local records and makes
            no network request. Full details on the <a class="inline-link" href="privacy.html">privacy page</a>.
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--void-2);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Good fits and honest mismatches</h2>
      <div class="grid-2">
        <div class="panel panel--pad">
          <h3 style="font-size:1.05rem">Usually a good fit</h3>
          <ul class="tight">
            <li>An application that needs to exist and be maintained, not a one-off page.</li>
            <li>Automation where a person is currently the integration layer.</li>
            <li>AI features that must keep keys server-side and behave sanely when the model is down.</li>
            <li>Tooling that has to work offline, or on data that cannot leave the building.</li>
            <li>A prototype whose job is to answer a feasibility question.</li>
          </ul>
        </div>
        <div class="panel panel--pad">
          <h3 style="font-size:1.05rem">Usually not a fit</h3>
          <ul class="tight">
            <li>Work that needs a large team or a certified compliance regime.</li>
            <li>Anything requiring a claim that cannot be evidenced — inflated metrics, fake reviews, misleading product behaviour.</li>
            <li>Security work framed as a certified penetration test.</li>
            <li>Projects that need a price before anyone has read the requirements.</li>
          </ul>
          <p class="dim mt-1" style="margin-bottom:0">Being clear about this early saves both sides a
            conversation that was never going to end well.</p>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    page("contact.html", "Contact — start a project | BLAXK BYTE TECHNOLOGIES",
         "Send the shape of the problem and get a written scope back. Services, the process, good fits and honest mismatches. No tracking, no analytics.",
         body)


# =========================================================== 9. PRIVACY
def build_privacy():
    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Privacy &amp; AI disclosure</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">What this site does with your data</h1>
      <p class="lede">The short version: almost nothing, because it asks for almost nothing. This page
        documents that precisely rather than reassuringly.</p>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap" style="display:grid;gap:2rem">
      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">1 · Data this site collects</h2>
        <p class="dim">None that identifies you.</p>
        <ul class="tight">
          <li><strong>No analytics.</strong> No Google Analytics, Plausible, Umami, Fathom or similar. No counting script of any kind.</li>
          <li><strong>No cookies.</strong> None are set, which is why there is no cookie banner — a banner for cookies that do not exist would be theatre.</li>
          <li><strong>No third-party requests.</strong> No CDN, no webfonts, no embedded video, no social widgets, no tracking pixels. Every asset is served from this site.</li>
          <li><strong>No fingerprinting.</strong> Nothing reads your canvas signature, device list or fonts for identification.</li>
          <li><strong>No persistent storage of your activity.</strong> Motion preference is carried in the URL, not written to your device.</li>
        </ul>
      </div>

      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">2 · The assistant panel</h2>
        <p class="dim">This is the part most sites are vague about, so here it is exactly.</p>
        <ul class="tight">
          <li><strong>No language model is connected in this build.</strong> The panel is a deterministic
            retriever over a fixed set of verified records that ship with the site. It matches your question
            against keywords and returns the matching record.</li>
          <li><strong>Nothing you type leaves your browser.</strong> There is no request to any API, ours or
            anyone else's. Open your browser's network tab and confirm it — that is the point of building it
            this way first.</li>
          <li><strong>No conversation is stored.</strong> The log lives in the page and disappears when you
            close or reload it.</li>
          <li><strong>It will not answer beyond its records.</strong> If your question is not covered, it says
            so and offers the contact route instead of improvising.</li>
          <li><strong>Its answers cite the record used</strong>, so you can check the claim against the page
            it came from.</li>
        </ul>
        <h3 class="mt-2" style="font-size:1.05rem">The designed production behaviour</h3>
        <p class="dim">The intended production version replaces keyword matching with retrieval over approved
          content plus a Gemini call, with these rules fixed in advance:</p>
        <ul class="tight">
          <li>The API key stays server-side and is never exposed to the browser through a public environment variable.</li>
          <li>Input length, content type and output schema are validated; responses are structured and schema-checked before rendering.</li>
          <li>Per-session and per-IP rate limits, token ceilings and spend ceilings, with abuse controls and observability.</li>
          <li>Repository text, READMEs and issue comments are treated as untrusted input. Prompt injection is assumed, not hoped against, and the assistant has no tools and no write access.</li>
          <li>No persistent chat history by default. If retention is ever enabled, it will be disclosed here before it is switched on.</li>
          <li>Popular answers cached; a deterministic static answer always available when the model fails or the budget is exhausted.</li>
          <li>Every AI answer is labelled and links to the source it used. The assistant never claims to have read a whole repository when only excerpts were provided.</li>
        </ul>
      </div>

      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">3 · The contact form</h2>
        <p class="dim">This build has no server, so the form validates your input in the browser and then
          tells you plainly that nothing was transmitted. It does not silently drop your message and it does
          not pretend to have sent it.</p>
        <p class="dim">In production the form posts to a server-side handler that validates and rate-limits
          the input, sends the message, and stores nothing beyond what is needed to reply. Retention would be
          stated here before that endpoint is switched on.</p>
      </div>

      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">4 · Motion, accessibility and your preferences</h2>
        <ul class="tight">
          <li>Your system's reduced-motion preference is honoured automatically, and can be overridden with the motion control in the navigation or the <kbd>M</kbd> key.</li>
          <li>The chosen motion level is stored in the URL (<span class="mono">?motion=off</span>) so a reduced-motion link can be shared — and so nothing is written to your device.</li>
          <li>Content is identical in every motion mode. The reduced route removes movement, never information.</li>
        </ul>
      </div>

      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">5 · Code shown on this site</h2>
        <ul class="tight">
          <li>Excerpts come from public repositories and are pinned to a commit SHA, path and line range.</li>
          <li>They are screened for credentials, secrets, personal data and internal endpoints before publication.</li>
          <li>They are rendered as inert, selectable text. Nothing from a repository is ever executed in your browser.</li>
          <li>Third-party forks are credited to their authors and excluded from the portfolio rather than exhibited.</li>
        </ul>
      </div>

      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">6 · Contact for privacy questions</h2>
        <p class="dim">Use the <a class="inline-link" href="contact.html">contact page</a>. If you believe
          something on this site misrepresents a fact, a project or a person, say so — corrections to the
          record take priority over presentation.</p>
      </div>

      <p class="label">Last reviewed: {D['snapshot']} · This disclosure describes what the code in this
        build actually does, and is updated when the code changes.</p>
    </div>
  </section>
</main>
"""
    page("privacy.html", "Privacy & AI disclosure | BLAXK BYTE TECHNOLOGIES",
         "Exactly what this site does with your data: no analytics, no cookies, no third-party requests. The assistant is a deterministic retriever with no model connected, and says so.",
         body)


# =========================================================== run
if __name__ == "__main__":
    print("Building BlaxkVERSE pages from site/assets/js/bx-data.js …")
    build_index()
    build_work()
    for p in ORDERED:
        build_case(p)
    build_source()
    build_company()
    build_about()
    build_lab()
    build_contact()
    build_privacy()
    print(f"Done. {len(ORDERED)} case studies + 8 pages.")
