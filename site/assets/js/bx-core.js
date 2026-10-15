/* ============================================================================
   BLAXKVERSE — core runtime
   ----------------------------------------------------------------------------
   Dependency-free on purpose. A CDN script would fail in an offline or sandboxed
   context, and the acceptance criteria require the reduced-motion and low-power
   routes to work with no network at all. docs/architecture.md records the
   migration path to GSAP ScrollTrigger if the orchestration ever outgrows this.

   Hard rules implemented here (see docs/experience-decision.md §5):
     - native scrolling only; we read scroll position and write transforms
     - constant number of DOM writes per frame; no layout reads in the loop
     - transform/opacity only
     - no compositing filter over an animating layer
     - identical content in full / reduced / static modes
   ========================================================================== */

window.BX = (function () {
  "use strict";

  var D = window.BX_DATA;
  var doc = document;
  var root = doc.documentElement;

  /* =========================================================== motion modes */
  var motion = (function () {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var params = new URLSearchParams(location.search);
    var listeners = [];
    var state = { mode: "full", reason: "default" };

    function apply(mode, reason) {
      if (state.mode === mode) return;
      state.mode = mode;
      state.reason = reason;
      root.setAttribute("data-motion", mode);
      listeners.forEach(function (fn) { try { fn(mode); } catch (e) { console.error(e); } });
      var btn = doc.querySelector("[data-motion-toggle]");
      if (btn) {
        btn.textContent = "motion: " + (mode === "full" ? "full" : mode === "reduced" ? "reduced" : "off");
        btn.setAttribute("aria-label", "Motion is " + mode + ". Activate to change.");
      }
    }

    var forced = params.get("motion");
    if (forced === "off" || forced === "static") apply("static", "url");
    else if (forced === "on" || forced === "full") apply("full", "url");
    else if (mq.matches) apply("reduced", "prefers-reduced-motion");

    mq.addEventListener("change", function (e) {
      if (new URLSearchParams(location.search).get("motion")) return;
      apply(e.matches ? "reduced" : "full", "prefers-reduced-motion");
    });

    return {
      get mode() { return state.mode; },
      get reason() { return state.reason; },
      isFull: function () { return state.mode === "full"; },
      isStatic: function () { return state.mode === "static"; },
      set: apply,
      cycle: function () {
        /* full → reduced → static → full. Written into the URL so the choice is
           shareable and survives a reload. */
        var next = state.mode === "full" ? "reduced" : state.mode === "reduced" ? "static" : "full";
        var url = new URL(location.href);
        url.searchParams.set("motion", next === "full" ? "on" : next === "reduced" ? "reduced" : "off");
        location.href = url.toString();
      },
      onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
    };
  })();

  /* ============================================================ dom helpers */
  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "cls") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function fmtBytes(n) {
    if (!n) return "0 B";
    var u = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso + "T00:00:00Z");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  function repoUrl(p) { return "https://github.com/" + p.repo; }

  /* Excerpt bodies are generated (tools/extract-excerpts.py) and looked up here
     rather than stored in the record, so a published excerpt is always the exact
     text of the pinned file. */
  var EXCERPTS = window.BX_EXCERPTS || {};
  function excerptFor(project, meta) {
    var body = meta && meta.key ? EXCERPTS[meta.key] : null;
    if (!body) return null;
    if (body.sha !== meta.sha) return null;   /* pin moved: refuse to show a stale quote */
    return {
      path: body.path, sha: body.sha, lang: body.lang,
      startLine: body.startLine, endLine: body.endLine,
      lines: body.lines, label: meta.label, why: meta.why
    };
  }
  function blobUrl(p, ex) {
    return repoUrl(p) + "/blob/" + ex.sha + "/" + ex.path + (ex.startLine ? "#L" + ex.startLine + "-L" + ex.endLine : "");
  }
  function statusLabel(s) {
    return { shipped: "shipped", prototype: "prototype", "in-progress": "in progress", concept: "concept" }[s] || s;
  }
  function trapFocus(container, restoreTo) {
    var SEL = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
    function nodes() {
      return $$(SEL, container).filter(function (n) { return n.offsetParent !== null || n === doc.activeElement; });
    }
    function onKey(e) {
      if (e.key !== "Tab") return;
      var list = nodes();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener("keydown", onKey);
    var list = nodes();
    if (list.length) list[0].focus();
    return function () {
      container.removeEventListener("keydown", onKey);
      if (restoreTo && doc.contains(restoreTo)) restoreTo.focus();
    };
  }
  function lockScroll(on) {
    doc.body.style.overflow = on ? "hidden" : "";
  }

  /* ===================================================== scroll director
     One rAF loop for the whole page. It reads geometry once per resize and
     writes only transforms. Nothing else in the codebase may register its own
     scroll listener for animation purposes. */
  var director = (function () {
    var tasks = [];
    var raf = null;
    var scrollY = window.scrollY;

    function frame() {
      raf = null;
      for (var i = 0; i < tasks.length; i++) {
        try { tasks[i](scrollY); } catch (e) { console.error(e); }
      }
    }
    function onScroll() {
      scrollY = window.scrollY;
      if (raf === null) raf = requestAnimationFrame(frame);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return {
      add: function (fn) { tasks.push(fn); fn(scrollY); return function () { tasks = tasks.filter(function (t) { return t !== fn; }); }; },
      kick: onScroll,
      get y() { return scrollY; }
    };
  })();

  /* ============================================ reveal (scroll-in headlines) */
  function initReveals() {
    var items = $$(".reveal");
    if (!items.length) return;
    if (!motion.isFull()) { items.forEach(function (n) { n.classList.add("is-in"); }); return; }
    if (!("IntersectionObserver" in window)) { items.forEach(function (n) { n.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ================================================ signal field (hero canvas)
     Original artwork, drawn with primitives: a sparse horizontal signal rail
     with travelling pulses, and the project constellation assembling behind the
     hero. Deliberately low-cost: capped DPR, no filters, no gradients per frame,
     paused when offscreen or in reduced/static mode. */
  function initSignalField() {
    var canvas = $("#signal-field");
    if (!canvas || !motion.isFull()) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1, running = true, t0 = performance.now();
    var nodes = [];
    var pulses = [];
    var pointer = { x: .5, y: .5, tx: .5, ty: .5 };
    var progress = 0;

    function build() {
      nodes = D.projects.map(function (p, i) {
        var a = (i / D.projects.length) * Math.PI * 2;
        var reach = Math.min(W, H) * (0.30 + (i % 3) * 0.085);
        return {
          p: p,
          x: Math.cos(a) * reach * 1.35,
          y: Math.sin(a) * reach * 0.72,
          ph: a,
          seed: (i * 2654435761) % 1000 / 1000
        };
      });
      pulses = [];
      for (var k = 0; k < 3; k++) pulses.push({ t: k / 3, speed: 0.00013 + k * 0.00004 });
    }

    function resize() {
      /* Cap the backing store. This is an atmospheric layer; on a 1440p panel the
         difference is invisible and the fill-rate difference is large. */
      var area = window.innerWidth * window.innerHeight;
      var scale = area > 1100000 ? 0.5 : area > 550000 ? 0.62 : 0.85;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(2, Math.floor(W * dpr));
      canvas.height = Math.max(2, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      var cx = W * 0.62 - (pointer.x - .5) * 60;
      var cy = H * 0.46 - (pointer.y - .5) * 34;
      var drift = t * 0.05 + progress * 0.9;

      /* connections: real shared themes only */
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var shared = nodes[i].p.themes.filter(function (th) { return nodes[j].p.themes.indexOf(th) > -1; });
          if (!shared.length) continue;
          var a = project(nodes[i], cx, cy, drift, t);
          var b = project(nodes[j], cx, cy, drift, t);
          var depth = (a.s + b.s) / 2;
          ctx.strokeStyle = "rgba(240,68,69," + (0.20 * depth).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 26 * depth, b.x, b.y);
          ctx.stroke();
        }
      }

      /* nodes */
      for (var n = 0; n < nodes.length; n++) {
        var q = project(nodes[n], cx, cy, drift, t);
        var r = 1.3 + 3.1 * q.s;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(244,244,242," + (0.20 + 0.55 * q.s).toFixed(3) + ")";
        ctx.fill();
        if (n % 3 === 0) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, r + 5 + Math.sin(t * 2 + q.ph) * 2.2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(240,68,69," + (0.30 * q.s).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      /* travelling pulses along the rail: the "signal" of the chapter motif */
      var railY = cy;
      ctx.strokeStyle = "rgba(38,43,53,.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, railY);
      ctx.lineTo(W, railY);
      ctx.stroke();
      for (var p = 0; p < pulses.length; p++) {
        var pu = pulses[p];
        pu.t = (pu.t + pu.speed * 16) % 1;
        var px = pu.t * W;
        var grad = ctx.createLinearGradient(px - 60, railY, px + 6, railY);
        grad.addColorStop(0, "rgba(240,68,69,0)");
        grad.addColorStop(1, "rgba(240,68,69,.85)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px - 60, railY);
        ctx.lineTo(px, railY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, railY, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(240,68,69,.95)";
        ctx.fill();
      }
    }

    function project(n, cx, cy, drift, t) {
      var rot = n.ph + drift;
      var x = Math.cos(rot) * Math.abs(n.x) || n.x;
      var z = Math.sin(rot) * 0.5 + 0.5;
      var scale = 0.55 + z * 0.75;
      return {
        x: cx + x * scale,
        y: cy + (n.y + Math.sin(t * 0.6 + n.ph) * 6) * scale,
        s: scale,
        ph: n.ph
      };
    }

    function loop(now) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    var raf = null;

    /* Pause when the hero is off-screen: a background layer has no business
       burning frames while the visitor reads something else. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          running = e.isIntersecting && motion.isFull();
          if (running && raf === null) raf = requestAnimationFrame(loop);
          if (!running && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(canvas);
    } else {
      raf = requestAnimationFrame(loop);
    }

    doc.addEventListener("visibilitychange", function () {
      running = !doc.hidden && motion.isFull();
      if (running && raf === null) raf = requestAnimationFrame(loop);
      if (!running && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    });

    window.addEventListener("pointermove", function (e) {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = e.clientY / window.innerHeight;
    }, { passive: true });

    window.addEventListener("resize", function () { resize(); }, { passive: true });

    /* The hero field reacts to reading progress, giving the arrival scene a
       sense of travel without any scroll hijacking. */
    director.add(function (y) {
      var hero = canvas.parentElement;
      if (!hero) return;
      var h = hero.offsetHeight || 1;
      progress = Math.min(1, Math.max(0, y / h));
    });

    motion.onChange(function (m) {
      if (m === "full") { running = true; if (raf === null) raf = requestAnimationFrame(loop); }
      else { running = false; if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }
    });

    resize();
    raf = requestAnimationFrame(loop);
  }

  /* ====================================================== navigation + palette */
  var DEST = [
    { href: "index.html", label: "Journey", sub: "the overview", key: "index.html" },
    { href: "company.html", label: "Company", sub: "what we build", key: "company.html" },
    { href: "work.html", label: "Work", sub: "8 verified projects", key: "work.html" },
    { href: "source.html", label: "Source", sub: "public repositories", key: "source.html" },
    { href: "lab.html", label: "Lab", sub: "experiments", key: "lab.html" },
    { href: "about.html", label: "About", sub: "Blaxk", key: "about.html" },
    { href: "contact.html", label: "Contact", sub: "start a project", key: "contact.html" }
  ];

  function currentPage() {
    var f = location.pathname.split("/").pop() || "index.html";
    return f;
  }

  function initNav() {
    var page = currentPage();
    var inProjects = location.pathname.indexOf("/projects/") > -1;
    $$("[data-nav-current]").forEach(function (a) {
      var href = a.getAttribute("href");
      var rel = inProjects ? "../" + href : href;
      a.setAttribute("href", rel);
      if (href === page) a.setAttribute("aria-current", "page");
    });
    /* mobile sheet links need the same prefix */
    var burger = $("[data-open-sheet]");
    var sheet = $("[data-sheet]");
    if (burger && sheet) {
      var release = null, lastTrigger = null;
      burger.addEventListener("click", function () {
        lastTrigger = burger;
        sheet.hidden = false;
        burger.setAttribute("aria-expanded", "true");
        lockScroll(true);
        release = trapFocus(sheet, burger);
      });
      function close() {
        sheet.hidden = true;
        burger.setAttribute("aria-expanded", "false");
        lockScroll(false);
        if (release) { release(); release = null; } else burger.focus();
      }
      sheet.addEventListener("click", function (e) { if (e.target.closest("[data-close-sheet], a")) close(); });
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) close(); });
    }
    var mt = $("[data-motion-toggle]");
    if (mt) mt.addEventListener("click", function () { motion.cycle(); });
  }

  /* Command palette: duplicates every destination, plus every project and every
     technology. Ctrl/Cmd+K everywhere, exactly as the specification requires. */
  function initPalette() {
    var host = document.createElement("div");
    host.className = "palette";
    host.hidden = true;
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", "Command palette");
    var inProjects = location.pathname.indexOf("/projects/") > -1;
    var pre = inProjects ? "../" : "";

    var input = el("input", { type: "text", placeholder: "Search destinations, projects, technologies…", "aria-label": "Search", autocomplete: "off", role: "combobox", "aria-expanded": "true", "aria-controls": "pal-list" });
    var list = el("div", { cls: "palette-list" });
    list.id = "pal-list";
    var box = el("div", { cls: "palette-box" }, [
      el("div", { cls: "row" }, [el("span", { cls: "label", text: "go" }), input, el("kbd", { cls: "label", text: "esc" })]),
      list,
      el("div", { cls: "palette-foot", text: "Every destination on this site is reachable here, and by keyboard." })
    ]);
    host.appendChild(box);
    doc.body.appendChild(host);

    var INDEX = [];
    DEST.forEach(function (d) {
      INDEX.push({ kind: "page", name: d.label, sub: d.sub, href: pre + d.href });
    });
    D.projects.forEach(function (p) {
      INDEX.push({ kind: "project", name: p.title, sub: p.status, href: pre + "projects/" + p.slug + ".html" });
      INDEX.push({ kind: "code", name: p.title + " — source", sub: p.repo, href: repoUrl(p), external: true });
      p.stack.forEach(function (t) {
        INDEX.push({ kind: "tech", name: t, sub: "used by " + p.title, href: pre + "source.html?tech=" + encodeURIComponent(t) });
      });
    });
    INDEX.push({ kind: "page", name: "Privacy & AI disclosure", sub: "how data is handled", href: pre + "privacy.html" });
    INDEX.push({ kind: "mode", name: "Explore normally (minimal motion)", sub: "same content, no motion", href: pre + "index.html?motion=off" });

    var shown = [], active = -1, release = null;

    function render(term) {
      var q = (term || "").trim().toLowerCase();
      shown = (q ? INDEX.filter(function (it) {
        return (it.name + " " + it.sub + " " + it.kind).toLowerCase().indexOf(q) > -1;
      }) : INDEX).slice(0, 40);
      active = -1;
      list.textContent = "";
      if (!shown.length) {
        list.appendChild(el("div", { cls: "palette-empty", text: 'No match for "' + (term || "") + '". Try a project name, a technology such as React, or "contact".' }));
        return;
      }
      var ul = el("ul");
      shown.forEach(function (it, i) {
        var a = el("a", { href: it.href, role: "option" });
        if (it.external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        a.appendChild(el("span", { cls: "kind", text: it.kind }));
        a.appendChild(el("span", { text: it.name }));
        a.appendChild(el("span", { cls: "sub", text: it.sub }));
        a.addEventListener("click", function () { close(); });
        ul.appendChild(el("li", null, [a]));
      });
      list.appendChild(ul);
    }

    function move(delta) {
      var opts = $$("a", list);
      if (!opts.length) return;
      active = (active + delta + opts.length + (active === -1 && delta < 0 ? 1 : 0)) % opts.length;
      if (active < 0) active = opts.length - 1;
      opts[active].focus();
    }

    function open(trigger) {
      host.hidden = false;
      lockScroll(true);
      input.value = "";
      render("");
      release = trapFocus(host, trigger || doc.activeElement);
      input.focus();
    }
    function close() {
      host.hidden = true;
      lockScroll(false);
      if (release) { release(); release = null; }
    }

    input.addEventListener("input", function () { render(input.value); });
    host.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    });
    host.addEventListener("click", function (e) { if (e.target === host) close(); });

    $$("[data-open-palette]").forEach(function (b) {
      b.addEventListener("click", function () { open(b); });
    });
    doc.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        host.hidden ? open(doc.activeElement) : close();
      }
      if (e.key === "/" && /^(BODY|MAIN)$/.test(doc.activeElement.tagName)) {
        e.preventDefault();
        open(doc.activeElement);
      }
    });
  }

  /* ================================================= project index rendering */
  function projectRow(p, idx, pre) {
    var a = el("a", { cls: "project-row", href: pre + "projects/" + p.slug + ".html" });
    a.appendChild(el("span", { cls: "idx", text: String(idx).padStart(2, "0") }));
    var mid = el("span");
    mid.appendChild(el("span", { cls: "ttl", text: p.title }));
    mid.appendChild(el("span", { cls: "sub", text: " — " + p.tagline }));
    a.appendChild(mid);
    var side = el("span", { cls: "side" });
    side.appendChild(el("span", { cls: "chip", "data-status": p.status, text: statusLabel(p.status) }));
    side.appendChild(el("span", { cls: "chip", text: p.language }));
    a.appendChild(side);
    return a;
  }

  function renderProjectRows(hostSel, pre, list) {
    var host = $(hostSel);
    if (!host) return;
    var items = list || D.projects;
    host.textContent = "";
    if (!items.length) {
      host.appendChild(el("p", { cls: "dim", text: "No project matches that filter." }));
      return;
    }
    items.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (p, i) {
      host.appendChild(projectRow(p, i + 1, pre));
    });
  }

  /* ================================================= work field (constellation)
     Reused from prototype Concept A, which was the most original concept in the
     competition, with A's measured compositing lesson applied: no filter or
     blend mode anywhere near this canvas. */
  function initWorkField() {
    var canvas = $("#work-field");
    if (!canvas) return;
    var legendHost = $("#field-focus");
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    var W = 0, H = 0, dpr = 1, running = true, nodes = [], links = [], hover = -1, focusIdx = 0, t0 = performance.now(), raf = null;
    var filter = null;

    function build() {
      var list = D.projects.slice().sort(function (a, b) { return a.order - b.order; });
      var step = (Math.PI * 2) / list.length;
      nodes = list.map(function (p, i) {
        var a = i * step - Math.PI / 2;
        return { p: p, a: a, rx: 0.36, ry: 0.40, jitter: ((i * 37) % 11) / 11 };
      });
      links = [];
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var st = nodes[i].p.themes.filter(function (t) { return nodes[j].p.themes.indexOf(t) > -1; });
          var sk = nodes[i].p.stack.filter(function (t) { return nodes[j].p.stack.indexOf(t) > -1; });
          if (st.length) links.push({ a: i, b: j, kind: "theme", label: st[0] });
          else if (sk.length && links.filter(function (l) { return l.kind === "tech"; }).length < 8) links.push({ a: i, b: j, kind: "tech", label: sk[0] });
        }
      }
    }

    function resize() {
      var area = window.innerWidth * window.innerHeight;
      var scale = motion.isFull() ? (area > 1100000 ? 0.55 : area > 550000 ? 0.7 : 0.9) : 1;
      dpr = Math.min(window.devicePixelRatio || 1, 1.6) * scale;
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(2, Math.floor(W * dpr));
      canvas.height = Math.max(2, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function pos(n, t) {
      var a = n.a + (motion.isFull() ? t * 0.035 : 0);
      var wob = Math.sin(t * 0.7 + n.jitter * 6) * 5;
      return {
        x: W / 2 + Math.cos(a) * (W * n.rx) + wob,
        y: H / 2 + Math.sin(a) * (H * n.ry) + wob
      };
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      var pts = nodes.map(function (n) { return pos(n, t); });
      var dimmed = function (i) { return filter && nodes[i].p.themes.indexOf(filter) === -1; };

      links.forEach(function (l) {
        var a = pts[l.a], b = pts[l.b];
        var off = dimmed(l.a) || dimmed(l.b);
        ctx.strokeStyle = off
          ? "rgba(91,102,115,.20)"
          : (l.kind === "theme" ? "rgba(240,68,69,.42)" : "rgba(91,102,115,.55)");
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 20, b.x, b.y);
        ctx.stroke();
      });

      nodes.forEach(function (n, i) {
        var q = pts[i];
        var off = dimmed(i);
        var isFocus = i === focusIdx;
        var isHover = i === hover;
        ctx.beginPath();
        ctx.arc(q.x, q.y, isFocus || isHover ? 9 : 5.4, 0, Math.PI * 2);
        ctx.fillStyle = off ? "rgba(91,102,115,.55)" : (isFocus || isHover ? "#f04445" : "rgba(244,244,242,.75)");
        ctx.fill();
        if (isFocus && !off) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, 20 + Math.sin(t * 2) * 2.4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(240,68,69,.35)";
          ctx.stroke();
        }
        if (!off) {
          ctx.font = "600 11px " + (getComputedStyle(doc.body).fontFamily || "sans-serif");
          ctx.fillStyle = isFocus || isHover ? "#f4f4f2" : "rgba(185,188,194,.78)";
          ctx.textAlign = q.x > W / 2 ? "right" : "left";
          ctx.fillText(n.p.short || n.p.title, q.x + (q.x > W / 2 ? -14 : 14), q.y + 4);
        }
      });
    }

    function loop(now) { if (!running) return; draw(now); raf = requestAnimationFrame(loop); }

    function setFocus(i, announce) {
      if (i < 0 || i >= nodes.length || i === focusIdx) return;
      focusIdx = i;
      if (legendHost) {
        var p = nodes[i].p;
        legendHost.textContent = "";
        legendHost.appendChild(el("span", { cls: "chip", "data-status": p.status, text: statusLabel(p.status) }));
        var a = el("a", { href: "projects/" + p.slug + ".html", cls: "inline-link", text: p.title });
        legendHost.appendChild(a);
        legendHost.appendChild(el("span", { cls: "mono dim", text: p.tagline }));
        if (announce === "live") legendHost.setAttribute("aria-live", "polite");
      }
    }

    canvas.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var t = (performance.now() - t0) / 1000;
      var best = -1, bestD = 1e9;
      nodes.forEach(function (n, i) {
        var q = pos(n, t);
        var d = (q.x - mx) * (q.x - mx) + (q.y - my) * (q.y - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      hover = bestD < 1600 ? best : -1;
      canvas.style.cursor = hover > -1 ? "pointer" : "default";
    });
    canvas.addEventListener("click", function () {
      if (hover > -1) location.href = "projects/" + nodes[hover].p.slug + ".html";
    });
    canvas.addEventListener("pointerleave", function () { hover = -1; });

    window.addEventListener("resize", resize, { passive: true });
    motion.onChange(function (m) {
      resize();
      if (m === "full") { running = true; if (raf === null) raf = requestAnimationFrame(loop); }
      else { running = false; if (raf !== null) { cancelAnimationFrame(raf); raf = null; } draw(performance.now()); }
    });

    /* Public hooks used by the filter buttons. */
    window.__bxWorkField = {
      setFilter: function (theme) { filter = theme || null; },
      setFocus: setFocus,
      count: function () { return nodes.length; }
    };

    resize();
    setFocus(0);
    if (motion.isFull()) raf = requestAnimationFrame(loop); else draw(performance.now());
  }

  /* ==================================================== source chamber (code) */
  var KEYWORD = /\b(def|class|return|import|from|const|function|if|else|async|await|new|for|while|in|of|not|and|or|True|False|None|null|true|false|async|export|default|public|self|enum|get|set)\b/;

  function highlightLine(line) {
    var frag = doc.createDocumentFragment();
    /* One pass, three token classes, no library. Strings and comments win over
       keywords inside them because they are matched first in the alternation. */
    var re = /(#.*$|\/\/.*$)|("""[\s\S]*?"""|"[^"]*"|'[^']*'|`[^`]*`)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
    var last = 0, m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) frag.appendChild(doc.createTextNode(line.slice(last, m.index)));
      var cls = null;
      if (m[1]) cls = "c";
      else if (m[2]) cls = "s";
      else if (KEYWORD.test(m[3])) cls = "k";
      if (cls) {
        var span = el("span", { cls: cls });
        span.textContent = m[0];
        frag.appendChild(span);
      } else {
        frag.appendChild(doc.createTextNode(m[0]));
      }
      last = re.lastIndex;
      KEYWORD.lastIndex = 0;
    }
    if (last < line.length) frag.appendChild(doc.createTextNode(line.slice(last)));
    return frag;
  }

  function renderCode(host, project, meta) {
    host.textContent = "";
    var excerpt = meta && meta.lines ? meta : excerptFor(project, meta);
    if (!excerpt) {
      var head = el("div", { cls: "code-head" }, [
        el("span", { cls: "path", text: excerpt ? excerpt.path : "no excerpt reviewed" }),
        el("span", { cls: "spacer" }),
        el("span", { text: "—" })
      ]);
      host.appendChild(head);
      var pre0 = el("pre");
      pre0.appendChild(doc.createTextNode(
        "// No pinned excerpt has been reviewed for this project yet.\n" +
        "// The chamber shows an empty state rather than filling the space.\n" +
        "// " + repoUrl(project) + "\n"
      ));
      host.appendChild(pre0);
      host.appendChild(el("div", { cls: "code-foot", text: "Nothing here is illustrative or invented. An empty chamber is the honest state." }));
      return;
    }

    var start = excerpt.startLine || 1;
    var headEl = el("div", { cls: "code-head" }, [
      el("span", { cls: "path", text: excerpt.path }),
      el("span", { text: excerpt.lang }),
      el("span", { text: "lines " + start + "–" + (excerpt.endLine || start + excerpt.lines.length - 1) }),
      el("span", { cls: "spacer" }),
      el("span", { text: "commit " + excerpt.sha.slice(0, 10) })
    ]);
    host.appendChild(headEl);

    var pre = el("pre", { tabindex: "0", "aria-label": "Pinned source excerpt from " + project.repo });
    excerpt.lines.forEach(function (line, i) {
      var row = el("span", { cls: "ln", id: "L" + (start + i) });
      row.appendChild(el("span", { cls: "n", text: String(start + i) }));
      row.appendChild(highlightLine(line));
      pre.appendChild(row);
      pre.appendChild(doc.createTextNode("\n"));
    });
    host.appendChild(pre);

    var open = el("a", { href: blobUrl(project, excerpt), target: "_blank", rel: "noopener noreferrer", text: "Open on GitHub ↗" });
    var copy = el("button", { type: "button", cls: "kbtn", text: "Copy excerpt" });
    copy.addEventListener("click", function () {
      var text = excerpt.lines.join("\n");
      function done(ok) {
        copy.textContent = ok ? "Copied" : "Copy failed";
        setTimeout(function () { copy.textContent = "Copy excerpt"; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        try {
          var ta = el("textarea");
          ta.value = text;
          doc.body.appendChild(ta);
          ta.select();
          doc.execCommand("copy");
          doc.body.removeChild(ta);
          done(true);
        } catch (e) { done(false); }
      }
    });

    host.appendChild(el("div", { cls: "code-foot" }, [
      el("div", { cls: "row-between" }, [
        el("span", { text: project.repo + " · " + excerpt.path + " @ " + excerpt.sha.slice(0, 10) + " · shown as inert text, never executed" }),
        el("span", { style: "display:flex;gap:.5rem" }, [copy, open])
      ])
    ]));
  }

  /* ================================================================ assistant
     Deterministic retrieval over the verified records — NOT a language model.
     It says so, in the interface, every time. */
  function initAssistant() {
    var launcher = $("[data-guide-open]");
    var panel = $("[data-guide]");
    if (!launcher || !panel) return;

    var log = $("[data-guide-log]", panel);
    var form = $("[data-guide-form]", panel);
    var input = $("[data-guide-input]", panel);
    var suggestions = $("[data-guide-suggest]", panel);
    var release = null;

    function addMsg(kind, nodes) {
      var m = el("div", { cls: "msg msg--" + kind });
      (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) {
        if (typeof n === "string") m.appendChild(el("p", { text: n }));
        else m.appendChild(n);
      });
      log.appendChild(m);
      log.parentElement.scrollTop = log.parentElement.scrollHeight;
      return m;
    }

    function answer(q) {
      var term = q.toLowerCase();
      var best = null, bestScore = 0;
      D.knowledge.forEach(function (k) {
        var score = 0;
        k.match.forEach(function (m) { if (term.indexOf(m) > -1) score += m.length; });
        /* a project name is a strong signal */
        D.projects.forEach(function (p) {
          if (term.indexOf(p.title.toLowerCase()) > -1 && k.id.indexOf(p.slug.split("-")[0]) > -1) score += 40;
        });
        if (score > bestScore) { bestScore = score; best = k; }
      });
      return best;
    }

    function respond(q) {
      addMsg("you", q);
      var k = answer(q);
      if (!k) {
        var wrap = el("div");
        wrap.appendChild(el("p", { text: "That is not in the verified records for this build, so there is no honest answer to give you here. This assistant only answers from approved project and company facts — it will not improvise." }));
        wrap.appendChild(el("p", { text: "For anything outside that — a specific requirement, a timeline, a commercial question — the right route is a direct message, and you will get a real answer." }));
        var links = el("div", { cls: "guide-q" }, [
          el("a", { cls: "kbtn", href: "contact.html", text: "Ask directly →" }),
          el("a", { cls: "kbtn", href: "work.html", text: "Browse the work" })
        ]);
        wrap.appendChild(links);
        wrap.appendChild(el("span", { cls: "src", text: "Deterministic retrieval · no model connected in this build" }));
        addMsg("bx", wrap);
        return;
      }
      var body = el("div");
      body.appendChild(el("p", { text: k.answer }));
      if (k.links && k.links.length) {
        var row = el("div", { cls: "guide-q" });
        k.links.forEach(function (l) {
          row.appendChild(el("a", { cls: "kbtn", href: l.href, text: l.label + " →" }));
        });
        body.appendChild(row);
      }
      body.appendChild(el("span", { cls: "src", text: "Answered from the verified record “" + k.id + "” · no language model involved" }));
      addMsg("bx", body);
    }

    function open(trigger) {
      panel.hidden = false;
      release = trapFocus(panel, trigger || launcher);
      launcher.setAttribute("aria-expanded", "true");
      if (!log.children.length) {
        addMsg("bx", el("div", {}, [
          el("p", { text: "This panel answers questions about BLAXK BYTE and the work on this site — services, projects, how each one is built and what state it is in. Every answer comes from the verified records behind these pages and cites the record it used." }),
          el("p", { text: "It is deliberately not a general chatbot. If a question falls outside what is recorded here, it will tell you rather than guess." })
        ]));
      }
      input.focus();
    }
    function close() {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      if (release) { release(); release = null; } else launcher.focus();
    }

    launcher.addEventListener("click", function () { panel.hidden ? open(launcher) : close(); });
    $("[data-guide-close]", panel).addEventListener("click", close);
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      respond(q);
      input.value = "";
    });

    /* Suggested questions: generated from the records themselves, so they can
       never drift away from what the assistant can actually answer. */
    var picks = ["What does the company do?", "Are any projects live?", "Tell me about SABI", "How is AI used on this site?", "How much does it cost?", "Why are only eight projects shown?"];
    picks.forEach(function (q) {
      var b = el("button", { type: "button", text: q });
      b.addEventListener("click", function () { respond(q); });
      suggestions.appendChild(b);
    });
  }

  /* ==================================================== contact transmission */
  function initContact() {
    var form = $("[data-contact-form]");
    if (!form) return;
    var status = $("[data-contact-status]", form);
    var trace = $("[data-contact-trace]", form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#cf-name"), email = $("#cf-email"), what = $("#cf-what");
      var errs = [];
      if (!name.value.trim()) errs.push({ n: name, m: "Your name is needed." });
      if (!email.value.trim() || email.value.indexOf("@") < 1 || email.value.indexOf(".") === -1) errs.push({ n: email, m: "A reachable email address is needed." });
      if (!what.value.trim() || what.value.trim().length < 12) errs.push({ n: what, m: "A sentence or two about the problem, please — it is what makes a real reply possible." });

      $$(".field-err", form).forEach(function (n) { n.remove(); });
      [name, email, what].forEach(function (n) { n.removeAttribute("aria-invalid"); });

      if (errs.length) {
        errs.forEach(function (er) {
          er.n.setAttribute("aria-invalid", "true");
          var m = el("p", { cls: "field-err", text: er.m });
          er.n.parentElement.appendChild(m);
        });
        status.dataset.state = "err";
        status.textContent = errs.length + " field" + (errs.length > 1 ? "s need" : " needs") + " attention before this can be sent.";
        errs[0].n.focus();
        return;
      }

      /* There is no server in this build. Saying so is the only honest option. */
      if (trace) { trace.dataset.run = "true"; setTimeout(function () { delete trace.dataset.run; }, 1700); }
      status.dataset.state = "ok";
      status.textContent =
        "Your details are still in this browser — this build has no server, so nothing was transmitted and nothing was stored. " +
        "The production build posts this form to a validated, rate-limited endpoint. Point the form at that endpoint (or email directly) and it will work as described.";
      form.querySelector("button[type=submit]").disabled = false;
    });
  }

  /* ============================================================ status legend */
  function initStatusLegend() {
    $$("[data-status-legend]").forEach(function (host) {
      if (host.children.length) return;
      [["shipped", "verified public deployment"], ["prototype", "working code, README evidence"], ["in-progress", "actively being built"], ["concept", "documented idea only"]].forEach(function (pair) {
        var s = el("span", { "data-status": pair[0] });
        s.appendChild(el("i"));
        s.appendChild(el("b", { text: pair[1] }));
        host.appendChild(s);
      });
    });
  }

  /* ==================================================== work filters + URLs */
  function initWorkFilters() {
    var host = $("[data-filters]");
    if (!host) return;
    var rowHost = $("#project-rows");
    var note = $("[data-count-note]");
    var params = new URLSearchParams(location.search);
    var current = params.get("theme") || "all";

    var counts = { all: D.projects.length };
    D.projects.forEach(function (p) {
      p.themes.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var order = ["all", "education", "ai", "local-first", "developer-tools", "web", "voice", "vision", "experimental", "tooling", "networking", "marketplace"];

    function apply(theme, push) {
      current = theme;
      var list = theme === "all" ? D.projects : D.projects.filter(function (p) { return p.themes.indexOf(theme) > -1; });
      renderProjectRows("#project-rows", "", list);
      $$("[data-theme]", host).forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-theme") === theme ? "true" : "false");
      });
      if (note) {
        note.textContent = list.length + " of " + D.projects.length + " projects" +
          (theme === "all" ? " — every featured repository." : " carrying the theme “" + theme + "”.") +
          " Filters update the URL, so a filtered view can be linked and shared.";
      }
      if (window.__bxWorkField) window.__bxWorkField.setFilter(theme === "all" ? null : theme);
      if (push) {
        var url = new URL(location.href);
        if (theme === "all") url.searchParams.delete("theme");
        else url.searchParams.set("theme", theme);
        history.pushState({ theme: theme }, "", url);
      }
      var lead = list[0];
      if (lead && window.__bxWorkField) window.__bxWorkField.setFocus(D.projects.indexOf(lead));
    }

    order.forEach(function (t) {
      if (t !== "all" && !counts[t]) return;
      var b = el("button", { cls: "filter", type: "button", "data-theme": t, "aria-pressed": t === current ? "true" : "false" });
      b.appendChild(el("span", { text: t === "all" ? "All work" : t }));
      b.appendChild(el("span", { cls: "count", text: String(counts[t]) }));
      b.addEventListener("click", function () { apply(t, true); });
      host.appendChild(b);
    });

    window.addEventListener("popstate", function () {
      apply(new URLSearchParams(location.search).get("theme") || "all", false);
    });

    apply(counts[current] ? current : "all", false);
  }

  /* ================================================================== boot */
  function boot() {
    root.setAttribute("data-motion", motion.mode);
    initNav();
    initPalette();
    initStatusLegend();
    initAssistant();
    initContact();
    initReveals();
    initSignalField();
    initWorkField();
    initWorkFilters();

    /* Page-level keyboard shortcuts, documented in the footer. */
    doc.addEventListener("keydown", function (e) {
      var typing = /input|textarea|select/i.test(doc.activeElement.tagName);
      if (typing) return;
      if (e.key.toLowerCase() === "m" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        motion.cycle();
      }
    });

    var y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    data: D,
    motion: motion,
    director: director,
    renderProjectRows: renderProjectRows,
    renderCode: renderCode,
    highlightLine: highlightLine,
    el: el,
    $: $,
    $$: $$,
    fmtBytes: fmtBytes,
    fmtDate: fmtDate,
    repoUrl: repoUrl,
    excerptFor: excerptFor,
    blobUrl: blobUrl,
    statusLabel: statusLabel,
    trapFocus: trapFocus,
    lockScroll: lockScroll
  };
})();
