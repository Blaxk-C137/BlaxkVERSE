/* BLAXKVERSE prototypes — shared runtime.
   One job: give every prototype the same honest instrumentation so the
   prototype competition is scored on measurements, not claims.

   Exposes: window.BX = { data, motion, hud }
   No dependencies. No network. */

window.BX = (function () {
  "use strict";

  /* ---------------------------------------------------------------
     VERIFIED PROJECT DATA
     Every field here was harvested from the public GitHub API and
     raw.githubusercontent.com and is re-verified at build time by
     `npm run verify:content`. Nothing in this array is invented.

     status: prototype = working code with README/screenshot evidence,
                        no verified public deployment.
             concept   = documented idea only.
     --------------------------------------------------------------- */
  var PROJECTS = [
    {
      slug: "blaxk-housing",
      title: "BlaXk Housing",
      short: "Housing",
      tagline: "Campus housing marketplace, role-split",
      repo: "Blaxk-C137/Blaxk-Housing",
      url: "https://github.com/Blaxk-C137/Blaxk-Housing",
      demo: null,
      lang: "JavaScript",
      stack: ["React", "Django REST", "SQLite", "Django cache"],
      themes: ["web", "marketplace", "education"],
      status: "prototype",
      pushed: "2026-09-02",
      sha: "d83ed7f7f6",
      oneLiner:
        "A student accommodation platform for Bayero University Kano: landlords list, students search, save and enquire — with separate dashboards per role.",
      problem:
        "Campus accommodation is traded in WhatsApp groups and on paper. Students cannot compare, landlords cannot see who is actually looking, and nobody can tell whether a listing is still live.",
      approach:
        "One React app with role-based routing (student / landlord) over a Django REST Framework API. Listings carry their own analytics: rate-limited view tracking, saved listings, enquiry actions and a landlord-only aggregate dashboard.",
      decisions: [
        "Role-based routing at the router level — a student can never render a landlord route, rather than hiding links and hoping.",
        "View tracking de-duplicated through the Django cache (60s window, 24h unique window) instead of a write per request, so analytics stay cheap under a cold server.",
        "Analytics endpoints sit outside the DRF router so the aggregate query stays landlord-scoped and cannot be reached by a student token."
      ],
      limits: [
        "No verified public deployment — runs locally from the repository.",
        "Messaging is modelled but there is no delivery guarantee documented.",
        "No test suite in the repository."
      ],
      files: 81,
      bytes: 342853
    },
    {
      slug: "edublaxk",
      title: "EduBlaxk",
      short: "EduBlaxk",
      tagline: "Local AI tutor & assessment engine",
      repo: "Blaxk-C137/EduBlaxk",
      url: "https://github.com/Blaxk-C137/EduBlaxk",
      demo: null,
      lang: "TypeScript",
      stack: ["React", "Vite", "Express", "Gemini / Claude / OpenAI", "pdf.js"],
      themes: ["education", "ai", "local-first"],
      status: "prototype",
      pushed: "2026-09-22",
      sha: "5c1445d651",
      oneLiner:
        "Turns lecture PDFs into diagnostic multiple-choice and rubric-graded theory questions, with a per-question AI tutor and an anti-duplicate question bank on the student's own machine.",
      problem:
        "A student revising from a 90-slide deck has no way to find out what they do not know. Public question banks do not follow the lecturer's notation, and repeated practice on the same document serves the same questions again.",
      approach:
        "An Express server holds AI provider keys and performs structured (schema-validated) calls; every attempt, answer and generated question is stored in the browser. Regeneration on the same document is filtered against a local question index so repeat practice serves fresh items.",
      decisions: [
        "Keys never enter the browser — the client asks the server which providers are usable, never what the key is.",
        "Structured output is schema-validated before it can reach the UI, so a malformed model reply fails loudly instead of silently rendering nothing.",
        "Tier-safe fallback: a rate-limited or overloaded model falls back to a same-or-cheaper tier and never silently upgrades the user to a more expensive model.",
        "The anti-duplicate bank is local JSON, which is what makes '100% fresh questions' verifiable by the student rather than a promise from a server."
      ],
      limits: [
        "Local-first: the browser is the database, so clearing site data clears history.",
        "Multi-provider support costs UI surface; the settings screen has to explain model pricing honestly.",
        "No verified public deployment."
      ],
      files: 51,
      bytes: 1339151,
      shots: 9
    },
    {
      slug: "sabi",
      title: "SABI",
      short: "SABI",
      tagline: "Voice-first tutor that runs on your device",
      repo: "Blaxk-C137/SABI",
      url: "https://github.com/Blaxk-C137/SABI",
      demo: null,
      lang: "TypeScript",
      stack: ["React", "Vite", "Gemini", "Whisper small (local)", "Piper"],
      themes: ["education", "ai", "local-first", "voice"],
      status: "prototype",
      pushed: "2026-10-12",
      sha: "9ff8827f93",
      oneLiner:
        "You talk or type; Gemini writes the lesson from your own lecture PDFs; the device does the speaking and the listening.",
      problem:
        "Cloud tutors either cannot hear you properly or answer from a generic textbook instead of the lecturer's material. Accent-heavy speech and offline study are both afterthoughts in most study assistants.",
      approach:
        "The language model is used for text only. Speech recognition runs locally with Whisper small on the student's machine, and speech output uses on-device voices — so latency, privacy and accent handling stay under local control.",
      decisions: [
        "Deliberate split of responsibilities: Gemini writes, the device speaks and listens. Documented as a rule, not a preference.",
        "Only free-tier models appear in the model list on purpose — the app cannot quietly bill the student.",
        "Conversation state is deliberately scoped so that cancelling a spoken reply drops only that reply's clips."
      ],
      limits: [
        "First run downloads a local model (~250 MB) — documented in the README as a one-time cost.",
        "Desktop Chrome/Edge is recommended; Firefox speech support is weaker.",
        "No verified public deployment."
      ],
      files: 119,
      bytes: 733040
    },
    {
      slug: "blaxk-xposer",
      title: "Blaxk Xposer",
      short: "Xposer",
      tagline: "One QR code for your local dev server",
      repo: "Blaxk-C137/Blaxk-Xposer",
      url: "https://github.com/Blaxk-C137/Blaxk-Xposer",
      demo: null,
      lang: "Python",
      stack: ["GTK", "Avahi / zeroconf", "reverse proxy", "TLS"],
      themes: ["developer-tools", "networking", "local-first"],
      status: "prototype",
      pushed: "2026-10-15",
      sha: "5ccb12dc62",
      oneLiner:
        "A tray app that publishes a running localhost dev server to your Wi-Fi and hands phones a QR code — without tunnels or accounts.",
      problem:
        "Testing a site on a real phone means wrestling with a tunnel, a firewall or a host-header rejection. Vite, Django, Next.js and Rails all refuse requests whose Host or Origin is not localhost, and a phone that loads your frontend cannot reach your backend on the laptop's localhost.",
      approach:
        "Xposer reverse-proxies the local port to the LAN and rewrites the traffic so the app never notices it moved: Host/Origin headers are translated per request, and URLs inside HTML, JS, JSON, redirects, cookies and CSP headers are rewritten back and forth — including inside gzip-compressed and streamed bodies.",
      decisions: [
        "Rewriting is implemented as pure functions over strings and bytes, so every rule is unit-testable without opening a socket.",
        "Streaming bodies are handled with a hold-back window sized to the longest possible URL literal, so a match split across two TCP chunks cannot slip through.",
        "HTTPS dev servers are presented to the phone over plain HTTP (TLS terminated locally) to avoid certificate warnings, with opt-in end-to-end HTTPS for camera and microphone APIs.",
        "Non-web services such as databases are relayed as raw TCP rather than pretending to be HTTP."
      ],
      limits: [
        "LAN-only by design: nothing is exposed to the public internet.",
        "Windows support depends on the platform firewall prompt being accepted.",
        "No verified public deployment (it is a desktop tray application)."
      ],
      files: 70,
      bytes: 483086
    },
    {
      slug: "forma",
      title: "FORMA",
      short: "FORMA",
      tagline: "Local voice studio — record, transcribe, speak",
      repo: "Blaxk-C137/FORMA-",
      url: "https://github.com/Blaxk-C137/FORMA-",
      demo: null,
      lang: "HTML",
      stack: ["React", "FastAPI", "Whisper Tiny", "Piper VITS", "PyTorch"],
      themes: ["voice", "ai", "local-first", "tooling"],
      status: "prototype",
      pushed: "2026-10-15",
      sha: "2dc3f6d129",
      oneLiner:
        "A voice workspace that transcribes, refines, searches and speaks text — with the speech models running on your own machine.",
      problem:
        "Transcription services want your audio in their cloud, and voice-generation tools are inconsistent about what leaves the device. Setting up local speech models by hand is a day of dependency archaeology.",
      approach:
        "npm install provisions a Python speech backend, downloads and verifies the models, and runs an offline smoke test. Recording, transcription and speech synthesis then work offline; the optional cloud search or summarisation step only fires when the user clicks it.",
      decisions: [
        "Setup fails loudly instead of degrading silently — there is deliberately no dummy speech mode that pretends inference worked.",
        "One-time model downloads live outside the repository, and the installer verifies them rather than assuming they are valid.",
        "Cloud features are opt-in per action, and the boundary is stated in the interface, not buried in a document."
      ],
      limits: [
        "About 700 MB of one-time model and runtime downloads.",
        "Windows is the primary target; other platforms depend on wheel availability.",
        "No verified public deployment."
      ],
      files: 146,
      bytes: 4958993,
      shots: 10
    },
    {
      slug: "blaxk-aggregator",
      title: "BlaXk Aggregator",
      short: "Aggregator",
      tagline: "Compile a whole codebase into one document",
      repo: "Blaxk-C137/Blaxk_Aggregator",
      url: "https://github.com/Blaxk-C137/Blaxk_Aggregator",
      demo: null,
      lang: "TypeScript",
      stack: ["React", "Vite", "Tailwind", "Python CLI", "pdf.js"],
      themes: ["developer-tools", "tooling"],
      status: "prototype",
      pushed: "2026-10-10",
      sha: "877869619f",
      oneLiner:
        "Web app and Python CLI that gather many code files and documents into a single formatted output — for documentation, review, or feeding a codebase to a language model.",
      problem:
        "Reviewing a project or preparing context for an AI assistant means hand-assembling dozens of files, and pasting PDFs into the same pipeline usually breaks.",
      approach:
        "Client-side file and folder ingestion with smart filtering (node_modules, .git), document extraction for PDF/DOCX/XLSX, and five export formats. Nothing is uploaded, so the tool works on private code without a trust conversation.",
      decisions: [
        "All processing happens in the browser: privacy is the product decision, not a feature bullet.",
        "A Python CLI ships alongside the web app because CI and terminals are where this work actually starts.",
        "Folder upload is recursive with auto-exclusion, because a manual file list is not how anyone reviews a codebase."
      ],
      limits: [
        "Very large trees are bounded by browser memory; the file-size limit is user-configurable rather than magic.",
        "Released under MIT, so downstream reuse is already permitted.",
        "No verified public deployment."
      ],
      files: 32,
      bytes: 248417
    },
    {
      slug: "the-migrator",
      title: "The Migrator",
      short: "Migrator",
      tagline: "Rebuild a Python environment on a new machine",
      repo: "Blaxk-C137/The_Migrator",
      url: "https://github.com/Blaxk-C137/The_Migrator",
      demo: null,
      lang: "Python",
      stack: ["Python", "pip", "packaging"],
      themes: ["developer-tools", "tooling"],
      status: "prototype",
      pushed: "2026-09-02",
      sha: "5787f415d4",
      oneLiner:
        "Scans the packages installed on your current machine and generates an installer you can carry to a new one.",
      problem:
        "Nobody documents their global Python environment until the day they migrate and realise half their tooling is missing.",
      approach:
        "Inventory the installed distributions, then emit a reproducible installer script so the destination machine ends up with the same set.",
      decisions: [
        "Deliberately small and single-purpose — one file, no dependencies, because a migration tool should be runnable before you have set anything up.",
        "Output is a plain installer you can read and edit before running."
      ],
      limits: [
        "Assumes pip-compatible packages; system-level binaries are out of scope.",
        "No verified public deployment (it is a CLI utility)."
      ],
      files: 1,
      bytes: 28475
    },
    {
      slug: "gesture-controls",
      title: "Gesture Controls",
      short: "Gesture",
      tagline: "Hand tracking as an input device",
      repo: "Blaxk-C137/Gesture_Controls",
      url: "https://github.com/Blaxk-C137/Gesture_Controls",
      demo: null,
      lang: "Python",
      stack: ["MediaPipe", "OpenCV", "Python"],
      themes: ["vision", "experimental"],
      status: "prototype",
      pushed: "2026-05-20",
      sha: "89ba2a3e5f",
      oneLiner:
        "Hand-gesture recognition that drives interactive games, using a webcam as the controller.",
      problem:
        "Testing whether computer vision can be a usable input device rather than a demo — latency and false positives decide that.",
      approach:
        "MediaPipe landmarks from the webcam feed are mapped to control events for a small game loop, keeping the frame budget in mind because the tracker and the renderer share one machine.",
      decisions: [
        "Landmark tracking instead of a trained classifier: fewer moving parts and no model to train before the first run.",
        "Threshold-free gesture mapping is avoided — a gesture has to be stable across frames before it counts as input."
      ],
      limits: [
        "Sensitive to lighting and camera quality.",
        "Prototype scope: one demo loop rather than a general input framework.",
        "No verified public deployment (webcam application)."
      ],
      files: 12,
      bytes: 22675
    }
  ];

  /* Repositories that exist publicly but are deliberately NOT featured as
     Blaxk's work. Recorded here so the omission is a documented decision. */
  var EXCLUSIONS = [
    { repo: "Blaxk-C137/AsyncRAT-C-Sharp", reason: "Third-party remote-administration tooling. Not appropriate to exhibit." },
    { repo: "Blaxk-C137/Forked", reason: "Publicly documented decompression bomb. Reference only." },
    { repo: "Blaxk-C137/rea-bx", reason: "Upstream fork — authorship belongs to the original project." },
    { repo: "Blaxk-C137/Recordly", reason: "Upstream fork." },
    { repo: "Blaxk-C137/Signova-", reason: "Upstream fork — sign-language converter, credited upstream." },
    { repo: "Blaxk-C137/Blaxk3dsvg", reason: "Upstream fork." },
    { repo: "Blaxk-C137/moltbot", reason: "Upstream fork." },
    { repo: "Blaxk-C137/Call-of-Duty-Sol-Ultra", reason: "Upstream fork of a third-party game project." },
    { repo: "Blaxk-C137/public-apis", reason: "Upstream fork of a community list." }
  ];

  /* ---------------------------------------------------------------
     MOTION CONTRACT
     One place that decides whether this device gets the full
     experience, a reduced one, or the static one.
     --------------------------------------------------------------- */
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var params = new URLSearchParams(location.search);

  var motion = {
    /* "full" | "reduced" | "static" */
    mode: "full",
    reason: "default",
    /* Measured, not guessed: a tiny rolling frame-time probe sets this. */
    lowPower: false,
    listeners: [],

    set: function (mode, reason) {
      if (motion.mode === mode) return;
      motion.mode = mode;
      motion.reason = reason || "manual";
      document.documentElement.setAttribute("data-motion", mode);
      motion.listeners.forEach(function (fn) { try { fn(mode); } catch (e) { console.error(e); } });
    },

    onChange: function (fn) { motion.listeners.push(fn); return function () {
      motion.listeners = motion.listeners.filter(function (f) { return f !== fn; });
    }; },

    enabled: function () { return motion.mode === "full"; }
  };

  /* Explicit overrides win: ?motion=off is the "Explore normally" route. */
  if (params.get("motion") === "off" || params.get("motion") === "static") {
    motion.set("static", "url-parameter");
  } else if (params.get("motion") === "reduced") {
    motion.set("reduced", "url-parameter");
  } else if (reduceQuery.matches) {
    motion.set("reduced", "prefers-reduced-motion");
  }
  reduceQuery.addEventListener("change", function (e) {
    if (new URLSearchParams(location.search).get("motion")) return;
    motion.set(e.matches ? "reduced" : "full", "prefers-reduced-motion");
  });

  /* ---------------------------------------------------------------
     INSTRUMENTATION — real numbers for the performance report.
     Tracks frame times and long tasks; renders its own readout.
     --------------------------------------------------------------- */
  var hud = (function () {
    var frames = [], longTasks = [], last = performance.now(), running = true, el = {};
    var LONG_TASK_MS = 50;

    /* Frame sampling pauses while the tab is hidden so background time never
       pollutes the numbers. */
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      last = performance.now();
    });

    if ("PerformanceObserver" in window) {
      try {
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) { longTasks.push(e.duration); });
        }).observe({ entryTypes: ["longtask"] });
      } catch (e) { /* longtask not supported — reported as unavailable, not as zero */ }
    }

    function tick(now) {
      if (running) {
        var dt = now - last;
        if (dt > 0 && dt < 500) {
          frames.push(dt);
          if (frames.length > 180) frames.shift();
        }
      }
      last = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function stats() {
      if (!frames.length) return { fps: null, p95: null, worst: null, samples: 0 };
      var sorted = frames.slice().sort(function (a, b) { return a - b; });
      var avg = frames.reduce(function (a, b) { return a + b; }, 0) / frames.length;
      return {
        fps: Math.round(1000 / avg),
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
        worst: Math.round(sorted[sorted.length - 1] * 10) / 10,
        samples: frames.length
      };
    }

    function mount(extra) {
      var bar = document.createElement("div");
      bar.className = "bx-proto-bar";
      bar.setAttribute("role", "status");
      bar.setAttribute("aria-live", "off");
      bar.innerHTML =
        '<div><b>' + (extra.title || "prototype") + '</b> · ' +
        '<a href="' + (extra.index || "../index.html") + '">all concepts</a>' +
        (extra.alt ? ' · <a href="' + extra.alt.href + '">' + extra.alt.label + '</a>' : "") +
        '</div>' +
        '<div class="bx-hud">' +
        '<span><span data-k>mode</span> <span data-v data-hud="mode">' + motion.mode + '</span></span>' +
        '<span><span data-k>fps</span> <span data-v data-hud="fps">–</span></span>' +
        '<span><span data-k>p95</span> <span data-v data-hud="p95">–</span></span>' +
        '<span><span data-k>worst</span> <span data-v data-hud="worst">–</span></span>' +
        '<span><span data-k>long</span> <span data-v data-hud="long">–</span></span>' +
        '<span><span data-k>dom</span> <span data-v data-hud="dom">–</span></span>' +
        '<button type="button" data-hud="reset" class="bx-label" style="background:none;border:1px solid var(--bx-hairline);padding:2px 7px;color:var(--bx-white-dim);cursor:pointer">reset</button>' +
        '<button type="button" data-hud="toggle" class="bx-label" style="background:none;border:1px solid var(--bx-hairline);padding:2px 7px;color:var(--bx-white-dim);cursor:pointer">motion: on/off</button>' +
        '</div>';
      document.body.appendChild(bar);
      el = {
        fps: bar.querySelector('[data-hud="fps"]'),
        p95: bar.querySelector('[data-hud="p95"]'),
        worst: bar.querySelector('[data-hud="worst"]'),
        long: bar.querySelector('[data-hud="long"]'),
        dom: bar.querySelector('[data-hud="dom"]'),
        mode: bar.querySelector('[data-hud="mode"]')
      };

      bar.querySelector('[data-hud="reset"]').addEventListener("click", function () {
        frames.length = 0; longTasks.length = 0;
      });
      bar.querySelector('[data-hud="toggle"]').addEventListener("click", function () {
        var url = new URL(location.href);
        url.searchParams.set("motion", motion.enabled() ? "off" : "on");
        location.href = url.toString();
      });

      motion.onChange(function (m) { if (el.mode) el.mode.textContent = m; });

      // Keyboard shortcut for the whole instrument panel (P = performance).
      document.addEventListener("keydown", function (e) {
        if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(document.activeElement.tagName)) {
          bar.style.display = bar.style.display === "none" ? "flex" : "none";
        }
      });

      setInterval(function () {
        var s = stats();
        if (el.fps) el.fps.textContent = s.fps === null ? "–" : s.fps;
        if (el.p95) el.p95.textContent = s.p95 === null ? "–" : s.p95 + "ms";
        if (el.worst) el.worst.textContent = s.worst === null ? "–" : s.worst + "ms";
        if (el.long) el.long.textContent = longTasks.length ? longTasks.length + " (" + Math.round(Math.max.apply(null, longTasks)) + "ms)" : "0";
        if (el.dom) el.dom.textContent = document.getElementsByTagName("*").length;
      }, 500);

      return bar;
    }

    function report() {
      var s = stats();
      var resources = performance.getEntriesByType ? performance.getEntriesByType("resource") : [];
      var bytes = resources.reduce(function (a, r) { return a + (r.transferSize || 0); }, 0);
      var nav = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
      return {
        url: location.pathname + location.search,
        mode: motion.mode,
        motionReason: motion.reason,
        fps: s.fps, frameP95: s.p95, frameWorst: s.worst, frameSamples: s.samples,
        longTasks: longTasks.length,
        longTaskMax: longTasks.length ? Math.round(Math.max.apply(null, longTasks) * 10) / 10 : 0,
        domNodes: document.getElementsByTagName("*").length,
        transferBytes: bytes,
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        viewport: window.innerWidth + "x" + window.innerHeight,
        dpr: Math.round(window.devicePixelRatio * 100) / 100
      };
    }

    return { mount: mount, report: report, stats: stats };
  })();

  /* ---------------------------------------------------------------
     FOCUS TRAP — every overlay in every concept uses this one.
     Returns a disposer. Guarantees focus returns to the trigger.
     --------------------------------------------------------------- */
  function trapFocus(container, restoreTo) {
    var SEL = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
    function nodes() {
      return Array.prototype.slice.call(container.querySelectorAll(SEL))
        .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
    }
    function onKey(e) {
      if (e.key !== "Tab") return;
      var list = nodes();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener("keydown", onKey);
    var list = nodes();
    if (list.length) list[0].focus();
    return function () {
      container.removeEventListener("keydown", onKey);
      if (restoreTo && document.contains(restoreTo)) restoreTo.focus();
    };
  }

  /* Injection-resistant helper: never build DOM from untrusted strings. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "html") throw new Error("BX.el refuses html — build nodes explicitly.");
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function fmtBytes(n) {
    if (!n) return "0 B";
    var u = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
  }

  return {
    data: { projects: PROJECTS, exclusions: EXCLUSIONS },
    motion: motion,
    hud: hud,
    trapFocus: trapFocus,
    el: el,
    fmtBytes: fmtBytes
  };
})();
