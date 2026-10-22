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


def status_legend():
    """Server-rendered twin of initStatusLegend() in bx-core.js.

    This was a 0px empty div that JavaScript filled on load, growing to 18px and
    pushing the section below it. `initStatusLegend` returns early when the host
    already has children, so rendering it here both removes the shift and skips
    redundant work. Found by diffing element heights across boot rather than by
    guessing — three earlier hypotheses about the cause were all wrong.
    """
    rows = [("shipped", "verified public deployment"),
            ("prototype", "working code, README evidence"),
            ("in-progress", "actively being built"),
            ("concept", "documented idea only")]
    return "".join(f'<span data-status="{k}"><i></i><b>{v}</b></span>' for k, v in rows)


def filter_buttons(pre=""):
    """Server-rendered twin of the filter bar built by initWorkFilters() in bx-core.js.

    The container used to be empty in the HTML and filled with fourteen buttons on
    load, which grew the block by 88px on desktop and moved the section below it —
    a measured layout shift of 0.0065. Rendering the same buttons at build time means
    the client rebuild produces identical geometry and the page never moves.

    Ordering matches the JavaScript exactly: "all" first, then themes by how many
    projects carry them, then alphabetically.
    """
    counts = {}
    for p in ORDERED:
        for t in p.get("themes", []):
            counts[t] = counts.get(t, 0) + 1
    order = ["all"] + sorted(counts, key=lambda t: (-counts[t], t))
    out = []
    for t in order:
        n = len(ORDERED) if t == "all" else counts[t]
        label = "All work" if t == "all" else t
        pressed = "true" if t == "all" else "false"
        out.append(
            f'<button class="filter" type="button" data-theme="{esc(t)}" aria-pressed="{pressed}">'
            f'<span>{esc(label)}</span><span class="count">{n}</span></button>'
        )
    return "".join(out)


def project_row(p, idx, pre=""):
    """Server-rendered twin of projectRow() in bx-core.js.

    The rows used to be an empty <div> that JavaScript filled on load. That is a
    guaranteed layout shift: the container has no height until the script runs, so
    everything below it moves. Rendering the same markup at build time means the
    client re-render replaces identical content and the page never moves. It also
    means the list survives with JavaScript disabled, which it did not before.
    """
    labels = {"shipped": "shipped", "prototype": "prototype",
              "in-progress": "in progress", "concept": "concept"}
    return (
        f'<a class="project-row" href="{pre}projects/{esc(p["slug"])}.html">'
        f'<span class="idx">{idx:02d}</span>'
        f'<span><span class="ttl">{esc(p["title"])}</span>'
        f'<span class="sub"> — {esc(p["tagline"])}</span></span>'
        f'<span class="side">'
        # A `live` marker on rows that have a verified deployment. It is a label,
        # not a link: the whole row is already an <a>, and nesting one inside
        # another is invalid. The URL itself is on the case study.
        + ('<span class="chip chip--live" title="A verified deployment is running">live</span>' if p.get("demo") else '')
        + f'<span class="chip" data-status="{esc(p["status"])}">{labels.get(p["status"], p["status"])}</span>'
        f'<span class="chip">{esc(p["language"])}</span>'
        f'</span></a>'
    )


def status_chip(status):
    labels = {"shipped": "shipped", "prototype": "prototype", "in-progress": "in progress", "concept": "concept"}
    return f'<span class="chip" data-status="{status}">{labels.get(status, status)}</span>'


def project_link(slug, pre=""):
    return f'{pre}projects/{slug}.html'


def card(p, pre=""):
    """A project card used on the work index and the journey. Static HTML."""
    stacks = "".join(f"<span>{esc(s)}</span>" for s in p["stack"][:6])
    return f"""
    <article class="panel card-lift{' beam' if p.get('featured') else ''}" data-reveal style="display:grid;gap:0">
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
    # Counted from the records, never typed in. A hardcoded number here would be
    # one more claim that goes stale the moment a deployment is added or dies.
    _live_count = sum(1 for p in ORDERED if p.get("demo"))
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
  <section class="hero" data-scene="signal" data-hero>
    <canvas id="signal-field" width="1600" height="900" aria-hidden="true"></canvas>
    <div class="wrap hero-inner">
      <div class="hero-grid">
        <div>
          <div class="hero-kicker">
            <span class="bar" aria-hidden="true"></span>
            <span class="label">Blaxk · BLAXK BYTE TECHNOLOGIES</span>
          </div>
          <h1>
            <span class="reveal is-in">Blaxk Byte</span>
            <span class="reveal is-in l2">I build things<br>that run.</span>
          </h1>
          <p class="lede" style="font-size:1.12rem">
            I write software: web apps, automation, AI systems. Most of it sits close to the machine —
            speech models on a laptop, vision on a webcam, a phone talking to your dev server.
            Pick any project and you get the repo, the commit it&rsquo;s pinned to, and the exact lines I
            mean. If it&rsquo;s live, there&rsquo;s a link. Open it and judge for yourself.
          </p>
          <div class="btn-row mt-2">
            <a class="btn btn--red" href="work.html" data-magnetic>See the work</a>
            <a class="btn" href="contact.html" data-magnetic="0.16">Start a project</a>
            <a class="btn btn--ghost" href="?motion=off">Explore normally</a>
          </div>
          <div class="metrics">
            <div class="metric"><b>{D['facts']['featuredProjects']}</b><span>verified projects</span></div>
            <div class="metric"><b>{D['facts']['publicRepositories']}</b><span>repositories catalogued</span></div>
            <div class="metric"><b>{_live_count}</b><span>live deployments</span></div>
          </div>
        </div>
        <aside class="hero-side" aria-label="What this is">
          <h2>Five seconds, no scrolling</h2>
          <ul>{hero_side}</ul>
          <p class="label" style="margin:0">
            BLAXK BYTE TECHNOLOGIES is the company. I&rsquo;m Blaxk. Web apps, automation, AI
            integration, tools that run without a connection.
          </p>
        </aside>
      </div>
    </div>
  </section>

  <!-- ============================== CAPABILITIES ============================== -->
  <section class="section" aria-labelledby="s2">
    <div class="wrap">
      <div class="scene-head"><span class="n">01</span><span class="label">Capabilities · what I get hired for</span></div>
      <h2 id="s2" class="reveal"><span>What I actually build.</span></h2>
      <p class="lede reveal">Six services. Each one lists the projects where I&rsquo;ve actually done it,
        so you can check before you email. Three more sit further down: I&rsquo;ll take them on if the work
        fits, but I&rsquo;m not selling them as packages yet.</p>

      <div class="grid-3 mt-3">
        {"".join(service_card(s) for s in D["services"] if s["active"])}
      </div>

      <p class="count-note">Also worked in, alongside the services above:
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
          <b>prototype</b> — working code with README evidence. All {len(ORDERED)} featured projects.<br>
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
        "Blaxk — software, automation and AI systems | BLAXK BYTE TECHNOLOGIES",
        "Software, automation and AI systems built by Blaxk. Twenty-one case studies, each linked to a public repository, a pinned commit and readable source code — plus every other repository on the account, indexed with the reason it is not a case study.",
        body,
    )


def service_card(s):
    ev = ""
    if s["evidence"]:
        names = ", ".join(esc(P[e]["title"]) for e in s["evidence"] if e in P)
        ev = f'<p class="label" style="margin:0">Demonstrated in: {names}</p>'
    active = ('<span class="chip" data-status="prototype">offered today</span>' if s["active"]
              else '<span class="chip" data-status="concept">area of work</span>')
    note = f'<p class="dim" style="margin:.6rem 0 0;font-size:.88rem">{esc(s["note"])}</p>' if s.get("note") else ""
    deliv = ""
    if s["deliverables"]:
        deliv = '<ul class="tight" style="font-size:.9rem">' + "".join(f"<li>{esc(x)}</li>" for x in s["deliverables"]) + "</ul>"
    return f"""
    <article class="panel panel--pad card-lift" style="display:grid;gap:.7rem;align-content:start">
      <div class="row-between"><h3 style="margin:0;font-size:1.15rem">{esc(s['name'])}</h3>{active}</div>
      <div><span class="label">Problem</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(s['problem'])}</p></div>
      <div><span class="label">Approach</span><p class="dim" style="margin:.2rem 0 0;font-size:.92rem">{esc(s['approach'])}</p></div>
      {deliv}
      {note}
      {ev}
    </article>"""


# =========================================================== 2. WORK
def build_work():
    all_rows = "".join(project_row(p, i + 1) for i, p in enumerate(ORDERED))
    filter_bar = filter_buttons()
    status_legend_html = status_legend()
    # Rendered at build time: an empty <p> that JavaScript fills with a line of
    # text grows by ~18px on load and pushed the next section down (CLS 0.0065).
    count_note = (f"{len(ORDERED)} of {len(ORDERED)} projects — every featured repository. "
                  "Filters update the URL, so a filtered view can be linked and shared.")
    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Work · {len(ORDERED)} case studies · every repository indexed</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">The work</h1>
      <p class="lede">Twenty-one projects. All of it real code in public repos. Two are live right now —
        open them and click around. The rest you can pull down and run. Where I had real screenshots
        I&rsquo;ve used them; where I didn&rsquo;t, you get the source instead of a stock image standing
        in for work.</p>
      <div class="status-key mt-2" data-status-legend>{status_legend_html}</div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <h2 class="reveal" style="font-size:clamp(1.4rem,3vw,2rem)"><span>The field</span></h2>
      <p class="dim" style="max-width:70ch">The same {len(ORDERED)} projects, laid out by what they have
        in common. A line only shows up where two of them really do share a theme or a stack. It&rsquo;s a
        second way in — the list underneath is still the main one.</p>
      <div class="field-wrap mt-2">
        <canvas id="work-field" width="1200" height="600" aria-label="Constellation of projects. Use the list below for the same information." role="img"></canvas>
        <div class="field-legend">
          <span><i></i>shared theme</span>
          <span><i class="dim"></i>shared technology</span>
          <span id="field-focus" style="display:flex;gap:.6rem;align-items:center;margin-left:auto"></span>
        </div>
      </div>
      <p class="label mt-1">Canvas is decorative; every project above has a text entry in the list below, and a case study page.</p>

      <div class="filters" data-filters role="group" aria-label="Filter projects by theme">{filter_bar}</div>
      <p class="count-note" data-count-note>{count_note}</p>
      <div class="project-rows" id="project-rows">{all_rows}</div>
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
    page("work.html", f"Work — {len(ORDERED)} verified projects | BLAXK BYTE TECHNOLOGIES",
         "Twenty-one verified projects: WebRTC audio sharing, a WhatsApp status optimiser, local-first AI tutoring, voice tooling, network utilities, computer vision and more. Every repository on the account is indexed and classified.",
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
    # A verified deployment appears here as a fact with its URL, in the same
    # table as the repository and the last push. Where there is no deployment the
    # row is absent rather than replaced by an apology, and nothing is ever
    # inferred from a repository name or a project title.
    if p.get("demo"):
        facts.insert(1, ("Live", f'<a class="inline-link" href="{esc(p["demo"])}" target="_blank" rel="noopener noreferrer">{esc(p["demo"].replace("https://", ""))} ↗</a>'))

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

    live_btn = (
        f'<a class="btn btn--red" href="{esc(p["demo"])}" target="_blank" rel="noopener noreferrer">Open the live site ↗</a>'
        if p.get("demo") else ""
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
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.1rem">
          {live_btn}
          <a class="btn btn--ghost" href="https://github.com/{esc(p['repo'])}" target="_blank" rel="noopener noreferrer">Read the source ↗</a>
        </div>
      </div>

      <dl class="case-facts">{facts_html}</dl>

      <div class="note note--plain">
        <strong>Where these numbers come from.</strong> Everything on this page was read off the public
        repo on {D['snapshot']}: file counts and sizes from the git tree, language and dates from the GitHub
        API. No download counts, no user numbers, no speed claims — I never measured any of those.
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
    # Index entries are keyed by repository so the row renderer can reach the
    # deployment record without threading it through every call site.
    _RECORD_BY_REPO = {o["repo"]: o for o in (D.get("others", []) + D.get("exclusions", []))}
    # Case-study records carry `demo` rather than `homepage`; both end up in the
    # same cell, so both go in the same lookup.
    for _p in ORDERED:
        _RECORD_BY_REPO.setdefault(_p["repo"], _p)

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
    # ------------------------------------------------------------------
    # The complete index. Every public repository on the account, in one
    # table, so the arithmetic is checkable at a glance rather than
    # summarised in prose. Rows are grouped: case studies first, then the
    # deliberate exclusions, then everything indexed but not exhibited.
    # ------------------------------------------------------------------
    KIND_LABEL = {
        "case": '<span class="ix-tag ix-tag--case">case study</span>',
        "fork": '<span class="ix-tag">fork</span>',
        "sensitive-fork": '<span class="ix-tag ix-tag--hold">held</span>',
        "profile": '<span class="ix-tag">profile</span>',
        "scaffold": '<span class="ix-tag">scaffold</span>',
        "empty": '<span class="ix-tag">empty</span>',
        "sensitive": '<span class="ix-tag ix-tag--hold">held</span>',
        "small": '<span class="ix-tag">indexed</span>',
    }

    def ix_link(repo):
        name = repo.split("/")[1]
        return (f'<a class="inline-link" href="https://github.com/{esc(repo)}" target="_blank" '
                f'rel="noopener noreferrer">{esc(name)}</a>')

    def ix_deploy(repo):
        """The URL the repository itself declares, and whether it still answers.

        Provenance matters here. `homepage` is a field the owner set on GitHub
        and it is quoted as such — it is not this site asserting that a service
        is running. When the URL no longer resolves, that is said in the same
        breath, because two of this account's declared URLs are dead and a
        reader who clicks one deserves to know before they click, not after.
        """
        rec = _RECORD_BY_REPO.get(repo)
        if not rec:
            return '<span class="dim">—</span>'

        # A case study with a deployment this build verified by hand.
        if rec.get("demo"):
            url = rec["demo"]
            return (f'<a class="inline-link" href="{esc(url)}" target="_blank" rel="noopener noreferrer">'
                    f'live ↗</a><span class="dim" style="display:block;font-size:.78em">{esc(url.replace("https://", ""))}</span>')

        # A fork's declared site belongs to whoever wrote the original, so it is
        # deliberately not shown as this account's deployment. The row above it
        # already says "fork"; the cell should not contradict that.
        if rec.get("kind") == "fork":
            return '<span class="dim" title="A fork: the original project\'s deployment is not this account\'s work.">—</span>'

        if not rec.get("homepage"):
            return '<span class="dim">—</span>'
        url = rec["homepage"]
        if rec.get("homepageLive"):
            return (f'<a class="inline-link" href="{esc(url)}" target="_blank" rel="noopener noreferrer">'
                    f'live ↗</a><span class="dim" style="display:block;font-size:.78em">{esc(url.replace("https://", ""))}</span>')
        return (f'<span class="dim" title="The repository declares this URL; it no longer resolves.">'
                f'declared, dead</span><span class="dim" style="display:block;font-size:.78em">{esc(url.replace("https://", ""))}</span>')

    def ix_row(repo, lang, files, kb, pushed, kind, note):
        return (
            f'<tr><td>{ix_link(repo)}</td>'
            f'<td class="ix-kind">{KIND_LABEL.get(kind, "<span class=\"ix-tag\">indexed</span>")}</td>'
            f'<td class="mono dim">{esc(lang)}</td>'
            f'<td class="mono dim">{files}</td>'
            f'<td class="mono dim">{kb}</td>'
            f'<td class="mono dim">{esc(pushed)}</td>'
            f'<td class="ix-deploy">{ix_deploy(repo)}</td>'
            f'<td class="dim ix-note">{note}</td></tr>'
        )

    # case studies (a project may span several repositories)
    ix_case = []
    for _p in ORDERED:
        sid = _p["slug"]
        ix_case.append(ix_row(
            _p["repo"], _p.get("language") or "—", f'{_p.get("files", 0):,}',
            f'{round(_p.get("bytes", 0)/1024):,} KB', _p.get("lastPush") or "—", "case",
            f'<a class="inline-link" href="projects/{esc(sid)}.html">Case study: {esc(_p["title"])}</a>'))
        for _extra in _p.get("repos", [])[1:]:
            ix_case.append(ix_row(_extra, _p.get("language") or "—", "—", "—", "—", "case",
                                  f'Same project: {esc(_p["title"])}'))
    ix_case = "".join(ix_case)

    ix_excl = "".join(
        ix_row(e["repo"], "—", "—", "—", "—", e.get("kind", "fork"),
               html.escape(esc(html.unescape(e["reason"]))))
        for e in D["exclusions"]
    )

    ix_other = "".join(
        ix_row(o["repo"], "—", "—", "—", "—", o.get("kind", "small"),
               html.escape(esc(html.unescape(o["note"]))))
        for o in D.get("others", [])
    )

    n_present = len({r for _p in ORDERED for r in (_p.get("repos") or [_p["repo"]])})
    n_excl = len(D["exclusions"])
    n_other = len(D.get("others", []))
    n_total = n_present + n_excl + n_other

    # The account count is deliberately kept separate from the catalogue count. If they
    # differ, say so on the page rather than quietly claiming a complete account.
    _reported = D["facts"].get("accountReported")
    if _reported and _reported != n_total and not D["facts"].get("accountDriftResolved"):
        drift_box = (
            f'<div class="drift-box" role="note">'
            f'<p><strong class="ink">Not everything on the account is in this table yet.</strong> '
            f'GitHub reported <strong class="ink">{_reported}</strong> public repositories when these records were '
            f'last checked on {esc(D["facts"].get("accountChecked", ""))}; this build catalogues '
            f'<strong class="ink">{n_total}</strong>. The difference is a repository created or made public after '
            f'the harvest. It is not guessed at and it is not padded over — the reconciliation runs on the next '
            f'pass, and <code class="inline-code">verify:content</code> reports the drift until it does.</p></div>'
        )
    else:
        drift_box = ""

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
      <p class="dim" style="max-width:76ch">These are the repositories on the account that are deliberately
        <em>not</em> presented as work, with the reason for each. Listing them is the point: a portfolio that
        quietly omits things is not being straight with you, and a portfolio that exhibits someone else's
        code as its own is worse. The complete accounting of every public repository follows in the next
        section.</p>
      <div class="panel mt-2" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.92rem">
          <caption class="sr">Repositories excluded from the portfolio and the reason for each</caption>
          <tbody>{ex_rows}</tbody>
        </table>
      </div>
      <p class="count-note">Two of those forks are excluded on judgement as well as authorship: they carry
        third-party tooling or a proof-of-concept with destructive potential, and neither belongs on a page that
        asks you to trust the person behind it. Those nine forks account for every unexhibited repository that
        is not Blaxk's own work — <strong class="ink">not one of the repositories outside this list is a
        fork</strong>. The remainder are all original, and the next section accounts for every one of
        them individually rather than in a summary sentence.</p>
    </div>
  </section>

  <section class="section" id="index" style="background:var(--void);border-top:1px solid var(--hairline)">
    <div class="wrap">
      <p class="section-kicker mono">Every repository</p>
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">All {n_total} catalogued repositories, accounted for</h2>
      <p class="dim" style="max-width:78ch">Every repository these records cover is in this table:
        <strong class="ink">{n_present}</strong> presented as work,
        <strong class="ink">{n_excl}</strong> deliberately excluded, and
        <strong class="ink">{n_other}</strong> indexed with the reason each is not a case study.
        Nothing is hidden behind a summary sentence — a case study is a promise that a claim has evidence
        behind it, so repositories without that evidence are listed as themselves rather than dressed up to
        make the count look better.</p>
      {drift_box}

      <div class="ix-legend" role="list">
        <span role="listitem">case study</span>
        <span role="listitem">indexed — real work, no case-study evidence</span>
        <span role="listitem">fork — credited upstream</span>
        <span role="listitem">held — excluded on judgement, reason given</span>
      </div>

      <div class="panel mt-2 ix-scroll">
        <table class="ix-table">
          <caption class="sr">Every public repository on the account, with classification and reason</caption>
          <thead>
            <tr><th scope="col">Repository</th><th scope="col">Status</th><th scope="col">Language</th>
              <th scope="col">Files</th><th scope="col">Size</th><th scope="col">Last push</th>
              <th scope="col">Note</th><th>Deployment</th></tr>
          </thead>
          <tbody>{ix_case}{ix_excl}{ix_other}</tbody>
        </table>
      </div>
      <p class="count-note">This table is generated from the same records that build every page, and
        <code class="inline-code">verify:content</code> fails the build if the three groups stop adding up to
        the number of public repositories on the account, or if any repository outside the exclusions turns
        out to be a fork.</p>
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
      <p class="lede" style="font-size:1.1rem">I build web applications, automation, AI integration and
        local-first tools. The qualification is that you can open the code and read it.</p>
      <div class="note mt-2" style="max-width:80ch">
        <strong>Every capability here points at a repo that proves it</strong>, and those links get
        re-checked against GitHub each time the site builds. For contracts — registration, team size,
        references — email me. You&rsquo;ll get a straight answer instead of a footer.
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
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">Also worked in</h2>
      <p class="dim" style="max-width:76ch">Two more areas sit behind the services above. They belong in the
        record because omitting them would misrepresent what Blaxk does, and they are named here rather than
        packaged as fixed-price offerings. Ask directly about either and you will get a straight answer about
        whether it fits.</p>
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
         "Services offered today — web applications, automation, AI integration, local-first tooling and network systems — plus the areas of work alongside them.",
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
          <p class="lede" style="font-size:1.08rem">I&rsquo;m Blaxk. I build software, usually where it
            touches something physical or runs short on room: speech models on a laptop, vision on a
            webcam, a phone talking to your dev server. Things that keep working when the connection
            doesn&rsquo;t.</p>
          <p class="lede">I&rsquo;m studying mechatronics engineering. I learned to build by shipping things
            people actually used, then going back to fix what broke at 2am.</p>
          <p class="lede">I&rsquo;d rather hand you the version that runs on your own machine than the one
            that needs a server I&rsquo;m paying for. I like knowing what&rsquo;s underneath the layer
            I&rsquo;m working on. And I&rsquo;d rather tell you a project is half-finished than have you
            find out after you&rsquo;ve trusted me with something.</p>
        </div>
        <div class="panel panel--pad">
          <h3 style="margin-bottom:.7rem">At a glance</h3>
          <dl class="dl">
            <div><dt>Works in</dt><dd>React · TypeScript · JavaScript · Python · Node &amp; Express · Django REST Framework · FastAPI</dd></div>
            <div><dt>Also works with</dt><dd>Local speech models (Whisper, Piper) · MediaPipe &amp; OpenCV · GTK · reverse proxies · AI provider APIs</dd></div>
            <div><dt>Daily environment</dt><dd>Linux (Fedora); Windows for cross-platform tooling such as Xposer</dd></div>
            <div><dt>Studying</dt><dd>Mechatronics engineering</dd></div>
            <div><dt>Public account</dt><dd><a class="inline-link" href="https://github.com/{esc(D['owner'])}" target="_blank" rel="noopener noreferrer">{esc(D['owner'])} ↗</a> — {D['facts']['publicRepositories']} repositories catalogued
              (<a class="inline-link" href="source.html#index">see the full accounting</a>)</dd></div>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">What I&rsquo;ve shipped</h2>
      <p class="dim" style="max-width:76ch">What I&rsquo;ve actually shipped. Every row points at the repo
        where I did it. No repo, no row.</p>
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
      <h2 style="font-size:clamp(1.4rem,3vw,2rem)">How it&rsquo;s gone so far</h2>
      <p class="dim" style="max-width:76ch">These dates come off my repositories. That&rsquo;s the whole
        timeline — no logos, no awards, no clients I can&rsquo;t point you to.</p>
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
      <article class="panel panel--pad card-lift{' beam' if p.get('featured') else ''}" style="display:grid;gap:.7rem;align-content:start">
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
      <p class="lede">Ideas I&rsquo;ve worked on and haven&rsquo;t finished. Some I&rsquo;m still pulling
        toward. Some I parked on purpose. Each entry says what stage it actually reached and why it stopped
        there.</p>
      <div class="note mt-2" style="max-width:80ch">
        <strong>Nothing moves off this page</strong> until there&rsquo;s a repo with working code in it.
        No prices, no promises, no &ldquo;coming soon&rdquo;.
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
      <p class="lede">Tell me what you&rsquo;re trying to do and I&rsquo;ll write back with what I&rsquo;d
        build, what it costs, and what I won&rsquo;t touch. Three things make that reply possible: the goal,
        what exists today, and a real deadline if there is one.</p>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="grid-2" style="align-items:start">
        <form class="form panel panel--pad" data-contact-form novalidate>
          <h2 style="font-size:1.3rem;margin-bottom:.3rem">Project inquiry</h2>
          <p class="label" style="margin-bottom:1rem">Fields marked required are the ones that make a real reply possible.</p>

          <!-- Honeypot. No human sees or tabs to this; bots fill it; the server
               silently accepts-and-discards anything that arrives with it filled.
               aria-hidden plus tabindex="-1" keeps it out of the accessibility tree
               and out of keyboard order, so it is invisible to everyone legitimate. -->
          <div class="hp-field" aria-hidden="true">
            <label for="cf-company">Company (leave blank)</label>
            <input id="cf-company" name="company" type="text" tabindex="-1" autocomplete="off">
          </div>

          <div class="field-row">
            <label for="cf-name">Your name <span aria-hidden="true">*</span></label>
            <input id="cf-name" name="name" type="text" autocomplete="name" required aria-required="true">
          </div>
          <div class="field-row">
            <label for="cf-email">Email <span aria-hidden="true">*</span></label>
            <input id="cf-email" name="email" type="email" autocomplete="email" required aria-required="true" aria-describedby="cf-email-hint">
            <span class="field-hint" id="cf-email-hint">Used to reply, and to set the reply-to on the message. Not added to any list, not stored in a database, not sold.</span>
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
            Required fields are checked here, in the browser, then the message is handed to EmailJS and
            delivered to my inbox as an email — not to a database, not to a CRM, not to anything that keeps
            copies. If the form is not wired yet, it says so instead of pretending to send. A hidden field
            catches bots; a submission that fills it is accepted on screen and quietly thrown away.
          </p>
        </form>

        <div style="display:grid;gap:1.2rem">
          <div class="panel panel--pad">
            <h2 style="font-size:1.2rem;margin-bottom:.6rem">What happens after you send this</h2>
            <dl class="dl">
              <div><dt>Immediately · An acknowledgement</dt><dd>EmailJS sends a copy of what you submitted to the address you give, so the enquiry is confirmed without waiting for a human.</dd></div>
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
              Email is the fastest route and lands in an inbox that is read daily. A telephone number and a
              postal address for contracts and invoices are supplied directly on request.
            </p>
          </div>

          <div class="provenance">
            <b>Everything you type here goes to my inbox as an email.</b> If you give an address,
            EmailJS also sends you a copy as an acknowledgement, and nothing else leaves the browser.
            No pixel, no cookie, no
            marketing platform and no CRM — EmailJS relays both messages and keeps only its own
            delivery logs. Page views are counted by this site's own
            code without cookies, without storing your address and without storing a user agent, and your
            browser can refuse that entirely with Do Not Track. Full details on the
            <a class="inline-link" href="privacy.html">privacy page</a>.
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
         "Send the shape of the problem and get a written scope back. Services, the process, good fits and honest mismatches. Email goes straight to inbox; no CRM, no marketing platform.",
         body)


# =========================================================== 9. PRIVACY
def build_privacy():
    body = f"""
<main id="main">
  <section class="section section--tight" style="padding-top:calc(var(--nav-h) + 2.5rem)">
    <div class="wrap">
      <span class="label">Privacy &amp; AI disclosure</span>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.4rem 0 .8rem">What this site does with your data</h1>
      <p class="lede">The short version: a page view is counted in a way that cannot identify you, an
        enquiry you send is delivered by email through EmailJS, and nothing else leaves your browser. This page documents
        that precisely rather than reassuringly, and it is updated whenever the code changes — a disclosure
        that has quietly stopped being true is worse than no disclosure at all.</p>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap" style="display:grid;gap:2rem">
      <div class="panel panel--pad">
        <h2 style="font-size:1.3rem">1 · Data this site collects</h2>
        <p class="dim">One thing, and nothing that identifies you: a page view is counted.</p>
        <ul class="tight">
          <li><strong>Page views are counted, by this site itself.</strong> When a page loads, a small script
            tells our own server that a page was viewed. It sends four things: the path, the referring
            address, a coarse screen-width bucket, and the browser's language. There is no third-party
            analytics product, no Google Analytics, no Plausible, no Umami, no Fathom — the counting is
            first-party code you can read at <code class="inline-code">api/track.js</code> and
            <code class="inline-code">assets/js/bx-analytics.js</code>. The exact list below is what is
            stored, which is less than what is sent:</li>
          <li><strong>No cookies.</strong> None are set, which is why there is no cookie banner — a banner for
            cookies that do not exist would be theatre. The analytics deliberately uses no cookie, no
            <code class="inline-code">localStorage</code> and no device identifier, so there is nothing on
            your device to consent to.</li>
          <li><strong>What is stored:</strong> a count for the page; a bucket for the screen size; the
            country the request arrived from, as a two-letter code; the <em>hostname</em> of the referrer, so
            this site knows a link came from one; and a daily visitor hash. That is the whole list.</li>
          <li><strong>Your IP address is not stored.</strong> To count unique visitors without tracking
            anyone, the address is combined with a random value that is destroyed at the end of each day,
            reduced to a short hash, and only the hash is kept. It counts one visitor for one day: it cannot
            be reversed, and it cannot be linked to the same person on any other day, because the value that
            produced it no longer exists by then. The address itself is never written anywhere. The
            browser's user-agent string goes into that same one-way hash and is likewise never stored —
            it is used as an input, not kept as a record.</li>
          <li><strong>What is sent and then thrown away:</strong> the browser's language tag arrives with the
            request and is not written to the store. Neither is the full referring URL, and neither is the
            query string — a link to
            <code class="inline-code">/work.html?theme=ai</code> is counted as
            <code class="inline-code">/work.html</code>. Paths are normalised before they are stored, so a
            made-up address cannot be written into the dashboard.</li>
          <li><strong>Nothing that identifies anyone is stored.</strong> No names, no email addresses, no
            cross-site identifiers, no profiles. The dashboard shows totals, not people.</li>
          <li><strong>Counts expire after 90 days</strong> automatically.</li>
          <li><strong>You can refuse, and it is honoured.</strong> If your browser sends Do Not Track or
            Global Privacy Control, nothing is counted at all. This is checked in the browser and again on the
            server, so it holds either way.</li>
          <li><strong>No third-party requests.</strong> No CDN, no webfonts, no embedded video, no social widgets, no tracking pixels. The page-view request goes to this site's own domain. Every asset is served from this site — including the one third-party library the site ships, GSAP, which is vendored into <code class="inline-code">assets/js/vendor/</code>. Your browser makes no request to anyone but us, which you can confirm in your network panel.</li>
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
        <p class="dim">This is the only place on the site where you send something, so here is the whole
          path it takes.</p>
        <ul class="tight">
          <li><strong>It is delivered, not stored.</strong> The message goes from your browser to
            <a class="inline-link" href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer">EmailJS</a>,
            a transactional email service, which relays it to an inbox as an email. If you gave an
            address, EmailJS also sends you an acknowledgement quoting what you submitted; that is the
            only second recipient, and it is the address you typed. The message does not pass through
            a server belonging to this site, and there is no database, CRM or marketing list for it to land
            in — there is none here. EmailJS processes both messages in order to send them and keeps its own
            delivery logs under its policy; it is the one third party the form involves, named rather than
            hidden behind a "service providers" clause.</li>
          <li><strong>Five fields and one trap.</strong> Name, email, project type, the enquiry itself and
            an optional deadline. There is also a hidden field a person cannot see and a browser will not
            fill; anything that fills it is a bot, and its submission is answered with a success message
            that goes nowhere. If you use a password manager that fills hidden fields, and your message
            appears to send but never gets a reply, that is the likely cause — send again from a different
            device or email directly.</li>
          <li><strong>The reply-to is the address you type.</strong> The template sets it from your field,
            so answering in your mail client reaches me. Nothing is added to any list; the address exists as
            an email in one inbox and nowhere else.</li>
          <li><strong>What client-side delivery gives up, said plainly.</strong> There is no server here to
            rate-limit one address at five messages an hour the way the previous endpoint did. The controls
            that exist are: the honeypot above, EmailJS's own account limits on the sending side, and a
            reCAPTCHA check on the template — a message Google marks as automated is refused before it
            counts against anything. That is a different trade, not an absence of one.</li>
          <li><strong>If it is not wired, it says so.</strong> Rather than accept a message and drop it, an
            unwired form refuses at the button and names the file that needs the keys. A form that pretends
            to send is worse than one that admits it cannot — that rule survived the change of provider,
            which is why this section was rewritten instead of quietly left as it was.</li>
        </ul>
        <p class="dim">The credentials that make a send possible are one public key and three ids — a
          service, a notification template and an auto-reply template — and the
          public key is deliberately visible — that is how EmailJS is designed. Which means the account's
          monthly limit and the template's reCAPTCHA are not optional polish: they are the difference
          between a contact form and an open mailbox. The trade-off against the previous server-side
          design is recorded in the project's threat model, in the repository.</p>
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
         "Exactly what this site does with your data: first-party page-view counting with no cookies, no stored IP addresses and no third-party requests. Do Not Track is honoured. The assistant is a deterministic retriever with no model connected, and says so.",
         body)


# ============================================================ 9. ADMIN (visitor dashboard)
def build_admin():
    """The visitor dashboard.

    Deliberately outside the public shell: no nav, no footer, no links in, and
    `noindex` in both the markup and the response headers. It is a tool for one
    person, not a page of the site, and it authenticates with a token held in an
    environment variable rather than a user account — a login system for a single
    user would be more code and more ways to get it wrong.

    The token is kept in sessionStorage and cleared when the tab closes. It is a
    bearer credential for a read-only stats endpoint, so the blast radius of it
    leaking is "someone can see visitor counts", which is why it is stored that way
    rather than in localStorage where it would persist indefinitely.
    """
    body = f"""
<!doctype html>
<html lang="en" data-motion="static">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Visitor dashboard · BlaxkVERSE</title>
<style>
  :root {{
    --void:#06070a; --void-2:#0b0d12; --panel:#0f1219; --panel-2:#141821;
    --line:#242a35; --hairline:#1a1f28; --white:#f4f4f2; --white-dim:#c9cbd0;
    --muted:#8b8f99; --red:#f04445; --red-soft:#ff7a7b; --green:#4ec98a; --amber:#d69e4c;
    --font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  }}
  * {{ box-sizing:border-box; }}
  /* Visible only when focused, like every other page's skip link. */
  .skip {{ position:absolute; left:-9999px; top:0; z-index:99; background:var(--red); color:#fff;
    padding:.6rem .9rem; font-size:.8rem; text-decoration:none; }}
  .skip:focus {{ left:.5rem; top:.5rem; }}
  body {{
    margin:0; background:var(--void); color:var(--white); font-family:var(--font-sans);
    font-size:15px; line-height:1.6; -webkit-font-smoothing:antialiased;
  }}
  .a-wrap {{ max-width:1080px; margin:0 auto; padding:2.5rem 1.25rem 4rem; }}
  .a-head {{ display:flex; align-items:baseline; gap:.75rem; flex-wrap:wrap; border-bottom:1px solid var(--hairline); padding-bottom:1rem; margin-bottom:1.75rem; }}
  .a-head h1 {{ font-size:1.35rem; margin:0; letter-spacing:-.01em; }}
  .a-head .tag {{ font-family:var(--font-mono); font-size:.64rem; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); border:1px solid var(--line); border-radius:99px; padding:.22rem .6rem; }}
  .a-head .spacer {{ margin-left:auto; }}
  .a-btn {{
    font-family:var(--font-mono); font-size:.68rem; letter-spacing:.1em; text-transform:uppercase;
    background:transparent; color:var(--white-dim); border:1px solid var(--line);
    border-radius:4px; padding:.42rem .8rem; cursor:pointer;
  }}
  .a-btn:hover {{ border-color:var(--red); color:var(--white); }}
  .a-btn--red {{ border-color:rgba(240,68,69,.5); color:var(--red-soft); }}
  .card {{ background:var(--panel); border:1px solid var(--hairline); border-radius:8px; padding:1.1rem 1.2rem; }}
  .grid {{ display:grid; gap:.9rem; }}
  .grid--4 {{ grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }}
  .grid--2 {{ grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }}
  .stat b {{ display:block; font-size:2rem; font-weight:600; letter-spacing:-.02em; line-height:1.1; }}
  .stat span {{ font-family:var(--font-mono); font-size:.62rem; letter-spacing:.13em; text-transform:uppercase; color:var(--muted); }}
  .stat small {{ display:block; margin-top:.25rem; font-size:.75rem; color:var(--muted); }}
  h2 {{ font-size:.95rem; margin:0 0 .9rem; font-weight:600; }}
  h2 em {{ font-style:normal; color:var(--muted); font-weight:400; }}
  .bars {{ display:flex; align-items:flex-end; gap:3px; height:150px; margin-top:.4rem; }}
  .bars > div {{ flex:1; min-width:3px; background:linear-gradient(180deg,var(--red),rgba(240,68,69,.35)); border-radius:2px 2px 0 0; position:relative; transition:opacity .15s; }}
  .bars > div:hover {{ opacity:.75; }}
  .bars > div[data-zero="1"] {{ background:var(--line); }}
  .axis {{ display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:.6rem; color:var(--muted); margin-top:.4rem; }}
  table {{ width:100%; border-collapse:collapse; font-size:.86rem; }}
  td, th {{ padding:.42rem .5rem; border-bottom:1px solid var(--hairline); text-align:left; }}
  th {{ font-family:var(--font-mono); font-size:.6rem; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); font-weight:400; }}
  td.num {{ font-family:var(--font-mono); text-align:right; color:var(--white-dim); }}
  .pill {{ display:inline-block; font-family:var(--font-mono); font-size:.58rem; letter-spacing:.1em; text-transform:uppercase; padding:.18rem .45rem; border-radius:3px; border:1px solid var(--line); color:var(--muted); }}
  .gate {{ max-width:430px; margin:12vh auto; }}
  .gate input {{ width:100%; padding:.7rem .8rem; background:var(--void-2); border:1px solid var(--line); border-radius:5px; color:var(--white); font-family:var(--font-mono); font-size:.85rem; }}
  .gate input:focus {{ outline:2px solid var(--red); outline-offset:1px; border-color:var(--red); }}
  .msg {{ font-size:.86rem; padding:.6rem .75rem; border-radius:5px; margin-top:.85rem; display:none; }}
  .msg[data-state] {{ display:block; }}
  .msg[data-state="err"] {{ background:rgba(240,68,69,.1); border:1px solid rgba(240,68,69,.4); color:var(--red-soft); }}
  .msg[data-state="ok"] {{ background:rgba(78,201,138,.09); border:1px solid rgba(78,201,138,.35); color:var(--green); }}
  .msg[data-state="info"] {{ background:var(--panel-2); border:1px solid var(--line); color:var(--white-dim); }}
  .note {{ font-size:.8rem; color:var(--muted); margin-top:.7rem; }}
  .hide {{ display:none !important; }}
  a {{ color:var(--red-soft); }}
  code {{ font-family:var(--font-mono); font-size:.85em; background:var(--panel-2); padding:.12em .35em; border-radius:3px; }}
</style>
</head>
<body>

<a class="skip" href="#main">Skip to the dashboard</a>

<div class="a-wrap" id="main" role="main">

  <!-- Token gate -->
  <section class="gate" id="gate">
    <h1 style="font-size:1.2rem;margin:0 0 .3rem">Visitor dashboard</h1>
    <p class="note" style="margin:.1rem 0 .9rem">A private operations view. It is not linked from the
      site, not indexed, and refuses to answer without the token below.</p>
    <p class="note" style="margin-top:0">Paste the admin token set in your environment variables
      (<code>ADMIN_TOKEN</code>). It is held in this tab only, and cleared when the tab closes.</p>
    <form id="gate-form" style="margin-top:1rem">
      <label for="tok" style="display:block;font-family:var(--font-mono);font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem">Admin token</label>
      <input id="tok" type="password" autocomplete="off" spellcheck="false" placeholder="••••••••••••">
      <div style="margin-top:.7rem;display:flex;gap:.5rem">
        <button class="a-btn a-btn--red" type="submit">Open dashboard</button>
        <button class="a-btn" type="button" id="forget">Forget token</button>
      </div>
    </form>
    <div class="msg" id="gate-msg" role="status"></div>
  </section>

  <!-- Dashboard -->
  <section id="dash" class="hide" tabindex="-1">
    <div class="a-head">
      <h2 style="font-size:1.35rem;margin:0">Visitor dashboard</h2>
      <span class="tag">first-party · cookie-less</span>
      <span class="spacer"></span>
      <button class="a-btn" id="refresh" type="button">Refresh</button>
      <button class="a-btn" id="signout" type="button">Sign out</button>
    </div>

    <div class="msg" id="dash-msg" role="status"></div>

    <div class="grid grid--4" style="margin-bottom:1.1rem" id="tiles"></div>

    <div class="card" style="margin-bottom:1.1rem">
      <h2>Views · last 30 days <em id="range-note"></em></h2>
      <div class="bars" id="chart"></div>
      <div class="axis"><span id="axis-start"></span><span id="axis-mid"></span><span id="axis-end"></span></div>
    </div>

    <div class="grid grid--2">
      <div class="card">
        <h2>Pages today</h2>
        <table><thead><tr><th>Path</th><th style="text-align:right">Views</th></tr></thead>
        <tbody id="pages"></tbody></table>
      </div>
      <div>
        <div class="card" style="margin-bottom:.9rem">
          <h2>Devices today</h2>
          <table><thead><tr><th>Type</th><th style="text-align:right">Views</th></tr></thead>
          <tbody id="devices"></tbody></table>
        </div>
        <div class="card">
          <h2>Countries today</h2>
          <table><thead><tr><th>Country</th><th style="text-align:right">Views</th></tr></thead>
          <tbody id="geo"></tbody></table>
        </div>
      </div>
    </div>

    <p class="note">Counts are aggregates only. No IP addresses, user agents or full referring URLs
      are stored by this system at any point — see the
      <a href="/privacy">privacy page</a>. Data expires automatically after 90 days.</p>
  </section>

</div>

<script>
(function () {{
  "use strict";
  var KEY = "bx_admin_token";
  var $ = function (s) {{ return document.querySelector(s); }};
  var gate = $("#gate"), dash = $("#dash"), msg = $("#gate-msg"), dmsg = $("#dash-msg");

  function say(el, state, text) {{
    el.dataset.state = state; el.textContent = text;
  }}
  function token() {{ try {{ return sessionStorage.getItem(KEY) || ""; }} catch (e) {{ return ""; }} }}
  function setToken(t) {{ try {{ t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); }} catch (e) {{}} }}

  function tile(label, value, sub) {{
    return '<div class="card stat"><b>' + value + '</b><span>' + label + '</span>' +
           (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  }}
  function rows(tbody, items) {{
    if (!items || !items.length) {{ tbody.innerHTML = '<tr><td colspan="2" style="color:var(--muted)">No data yet today.</td></tr>'; return; }}
    tbody.innerHTML = items.map(function (i) {{
      var label = i.key === undefined ? i.label : i.key;
      var n = i.count === undefined ? i.value : i.count;
      return '<tr><td>' + String(label).replace(/[<>&]/g, "") + '</td><td class="num">' + n + '</td></tr>';
    }}).join("");
  }}

  function render(d) {{
    $("#tiles").innerHTML =
      tile("Views today", d.today.views, d.today.date) +
      tile("Visitors today", d.today.uniques, "deduplicated, cookie-less") +
      tile("Views · 7 days", d.totals.views7d, "includes today") +
      tile("Views · 30 days", d.totals.views30d, "retention is 90 days");

    var series = d.series || [];
    var max = Math.max(1, Math.max.apply(null, series.map(function (s) {{ return s.views; }})));
    $("#chart").innerHTML = series.map(function (s) {{
      var pct = Math.round((s.views / max) * 100);
      return '<div data-zero="' + (s.views ? 0 : 1) + '" style="height:' + Math.max(2, pct) + '%" ' +
             'title="' + s.date + ' — ' + s.views + ' views"></div>';
    }}).join("");
    if (series.length) {{
      $("#axis-start").textContent = series[0].date;
      $("#axis-mid").textContent = series[Math.floor(series.length / 2)].date;
      $("#axis-end").textContent = series[series.length - 1].date;
    }}
    $("#range-note").textContent = "— peak " + max + "/day";

    rows($("#pages"), d.topPagesToday);
    rows($("#devices"), Object.keys(d.today.devices || {{}}).map(function (k) {{
      return {{ label: k, value: d.today.devices[k] }};
    }}).sort(function (a, b) {{ return b.value - a.value; }}));
    rows($("#geo"), (d.today.countries || []).map(function (c) {{
      return {{ label: c.key === "XX" ? "unknown" : c.key, value: c.count }};
    }}));
  }}

  function load(t) {{
    if (!t) {{ gate.classList.remove("hide"); dash.classList.add("hide"); return; }}
    msg.dataset.state = "info"; msg.textContent = "Checking…";
    fetch("/api/stats", {{ headers: {{ Authorization: "Bearer " + t }} }})
      .then(function (r) {{ return r.json().then(function (d) {{ return {{ status: r.status, body: d }}; }}); }})
      .then(function (res) {{
        if (res.status === 200 && res.body.ok) {{
          setToken(t);
          gate.classList.add("hide"); dash.classList.remove("hide");
          render(res.body);
          return;
        }}
        /* A bad token and a missing store are different problems, so they get
           different messages rather than one generic failure. */
        if (res.status === 401) {{
          setToken("");
          gate.classList.remove("hide"); dash.classList.add("hide");
          say(msg, "err", "That token was not accepted. Check ADMIN_TOKEN in the project's environment variables.");
          return;
        }}
        gate.classList.remove("hide"); dash.classList.add("hide");
        say(msg, res.body && res.body.kind === "store_missing" ? "info" : "err",
            (res.body && res.body.error) || "Could not load the dashboard.");
      }})
      .catch(function () {{
        gate.classList.remove("hide"); dash.classList.add("hide");
        say(msg, "err", "Could not reach /api/stats. Is the dev server running?");
      }});
  }}

  $("#gate-form").addEventListener("submit", function (e) {{
    e.preventDefault();
    load($("#tok").value.trim());
  }});
  $("#forget").addEventListener("click", function () {{
    setToken(""); $("#tok").value = ""; say(msg, "info", "Token cleared from this tab.");
  }});
  $("#signout").addEventListener("click", function () {{
    setToken(""); $("#tok").value = ""; dash.classList.add("hide"); gate.classList.remove("hide");
    say(msg, "info", "Signed out. The token is no longer in this tab.");
  }});
  $("#refresh").addEventListener("click", function () {{ load(token()); }});

  load(token());
}})();
</script>
</body>
</html>
"""
    # The dashboard's JavaScript is emitted as an external file rather than an
    # inline <script>. It was inline until a browser test against the real CSP
    # showed why that cannot work: vercel.json sets `script-src 'self'` with no
    # 'unsafe-inline', so the whole dashboard would have been silently dead in
    # production — the token gate would render and nothing would respond to a
    # click. The audit did not catch it because its harness sent no CSP header;
    # the harness now sends the real one.
    #
    # The source below is an f-string, so literal braces are doubled. They are
    # un-doubled here, which keeps the JS readable in the file that ships.
    m = re.search(r"<script>\n(.*?)\n</script>", body, re.S)
    if not m:
        raise SystemExit("admin: inline script block not found — refusing to emit a dashboard with no behaviour")
    js = m.group(1).replace("{{", "{").replace("}}", "}")
    js += "\n"
    with open(os.path.join(SITE, "assets", "js", "bx-admin.js"), "w", encoding="utf-8") as f:
        f.write(js)
    body = body[:m.start()] + '<script src="assets/js/bx-admin.js" defer></script>' + body[m.end():]

    with open(os.path.join(SITE, "admin.html"), "w", encoding="utf-8") as f:
        f.write(body)
    print("  wrote admin.html + assets/js/bx-admin.js")


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
    build_admin()
    print(f"Done. {len(ORDERED)} case studies + 9 pages + admin dashboard.")
