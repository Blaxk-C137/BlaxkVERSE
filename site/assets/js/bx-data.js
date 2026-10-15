/* ============================================================================
   BLAXKVERSE — content records (single source of truth)
   ----------------------------------------------------------------------------
   Every fact in this file was harvested from public sources and is re-checked
   by `npm run verify:content` (tools/verify-content.mjs), which compares each
   record against the live GitHub API.

   PROVENANCE RULES OBSERVED THROUGHOUT:
     - No metric is stated unless it was measured or is a plain fact of the
       repository (file count, byte size, last push date, language, licence).
     - No project is called "shipped" without a verified public deployment URL.
       Deployment URLs were checked; none of these projects has one, so no
       project is labelled shipped. They are prototypes: working code with a
       README and, where noted, screenshots as evidence.
     - Forks are excluded from the portfolio and listed in EXCLUSIONS instead.
     - Blaxk's company registration status is deliberately NOT asserted.
   ========================================================================== */

window.BX_DATA = (function () {
  "use strict";

  var OWNER = "Blaxk-C137";
  var SNAPSHOT = "2026-10-15";

  var projects = [
    {
      slug: "blaxk-housing",
      title: "BlaXk Housing",
      tagline: "Campus housing marketplace, role-split",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk-Housing",
      demo: null,
      language: "JavaScript",
      stack: ["React", "Django REST Framework", "SQLite", "Django cache"],
      themes: ["web", "marketplace", "education"],
      lastPush: "2026-09-02",
      sha: "d83ed7f7f6",
      files: 81,
      bytes: 342853,
      license: null,
      featured: true,
      order: 1,
      oneLiner:
        "A student accommodation platform for Bayero University Kano: landlords list, students search, save and enquire — with dashboards that differ by role.",
      problem:
        "Campus accommodation changes hands in WhatsApp groups and on paper. A student cannot compare two options side by side, cannot tell whether a listing is still live, and cannot see who else is looking. A landlord, meanwhile, has no idea whether anyone read their listing at all.",
      users:
        "Two distinct users with conflicting needs in one product: students looking for a room near campus, and landlords who need their listings seen and their enquiries organised.",
      approach:
        "One React single-page app with role-based routing over a Django REST Framework API. Listings carry their own analytics: view tracking, unique-view tracking, saved listings and action tracking, feeding a landlord-only aggregate dashboard.",
      contribution:
        "Sole author of the frontend and backend in the public repository: routing architecture, the listings data flow, the analytics endpoints and the dashboard.",
      decisions: [
        {
          t: "Role routing at the router, not in the components",
          d: "After sign-in a user is redirected by role, and cross-role routes are blocked with redirects inside the route definition rather than by hiding links. A student cannot render a landlord screen by editing the URL, because the guard is not in the UI."
        },
        {
          t: "Analytics through the cache, not a write per request",
          d: "Every page view writing a row would make a cold SQLite deployment fall over. View tracking is de-duplicated in the Django cache with a 60-second window for repeat views and a 24-hour window for the unique counter, so the database only sees genuinely new attention."
        },
        {
          t: "Aggregate endpoints kept outside the DRF router",
          d: "Landlord analytics and 'my listings' are separate, landlord-scoped endpoints, so an aggregate query can never be reached with a student's session."
        }
      ],
      limitations: [
        "There is no public deployment, so it runs locally from the repository. Nothing about it should be described as live.",
        "Messaging is modelled in the data layer but the repository does not document a delivery guarantee.",
        "No test suite is present in the repository."
      ],
      lessons:
        "The hardest part was not the marketplace, it was the second user. Supporting a landlord changed the data model, the routing and the analytics at the same time — which is the argument for designing the second role before the first one is polished.",
      screenshots: [],
      excerpts: [
        {
          path: "backend/listings/views.py",
          sha: "d83ed7f7f6",
          startLine: 112,
          endLine: 141,
          lang: "python",
          label: "Rate-limited view tracking",
          why:
            "This is the decision the whole analytics feature rests on: counting attention through the cache instead of the database. The 24-hour unique key is what makes a landlord's numbers mean something, and the 60-second key is what stops a refresh loop from inflating them.",
          key: "Blaxk-C137/Blaxk-Housing::backend/listings/views.py",
        }
      ]
    },

    {
      slug: "edublaxk",
      title: "EduBlaxk",
      tagline: "Local AI tutor & assessment engine",
      status: "prototype",
      repo: "Blaxk-C137/EduBlaxk",
      demo: null,
      language: "TypeScript",
      stack: ["React", "Vite", "Express", "Gemini", "Claude", "OpenAI", "pdf.js"],
      themes: ["education", "ai", "local-first"],
      lastPush: "2026-09-22",
      sha: "5c1445d651",
      files: 51,
      bytes: 1339151,
      license: null,
      featured: true,
      order: 2,
      oneLiner:
        "Turns lecture PDFs into diagnostic multiple-choice and rubric-graded theory questions, with a per-question AI tutor and an anti-duplicate question bank that lives on the student's own machine.",
      problem:
        "A student revising from a ninety-slide deck has no way to find out what they do not know. Public question banks do not follow the lecturer's notation, and repeated practice on the same document serves the same questions again — so the second attempt measures memory of the questions, not understanding of the material.",
      users:
        "A university student revising alone on a laptop, with a lecture PDF and no internet budget to spare.",
      approach:
        "An Express server holds AI provider keys and makes schema-validated structured calls. Documents are extracted locally; every attempt, answer and generated question is stored in the browser. Regeneration is filtered against a local index of previously generated questions.",
      contribution:
        "Sole author. The repository contains the full application: document extraction, the AI router with tier-safe fallback, the item bank, the quiz engine, the rubric grader and the tutor drawer.",
      decisions: [
        {
          t: "Keys never enter the browser",
          d: "The client asks the server which providers are configured; it never asks for the key. The catalogue endpoint returns model metadata and a boolean per provider, which is why the settings screen can show pricing honestly without a secret ever crossing into front-end code."
        },
        {
          t: "Structured output is validated before it can render",
          d: "Question and evaluation payloads are validated against a schema. A malformed model response fails loudly instead of silently producing an empty quiz — the failure mode a student would otherwise blame on themselves."
        },
        {
          t: "A rate-limited model falls to a cheaper one, never a dearer one",
          d: "The fallback chain only moves down in price. An overloaded free-tier model cannot quietly upgrade the student onto a paid model mid-assessment."
        },
        {
          t: "'Always fresh questions' is enforced locally, not promised",
          d: "The anti-duplicate bank is local JSON, so the student can inspect it. The claim is verifiable on their own machine rather than a server-side assertion."
        }
      ],
      limitations: [
        "The browser is the database. Clearing site data clears history — a deliberate local-first trade-off, not an oversight.",
        "Multi-provider support costs interface complexity: the settings screen has to explain model pricing and free-tier limits.",
        "No public deployment; it is designed to run on the student's machine, holding their own key."
      ],
      lessons:
        "Grading theory with a model is easy to demo and hard to trust. The work that mattered was the rubric: forcing explicit criteria into the evaluation call, and surfacing which criteria were missed rather than only a score.",
      screenshots: [
        { file: "edublaxk-09-dark-theme.jpg", caption: "Assessment builder — source documents, question counts, rigor level", w: 956, h: 900 },
        { file: "edublaxk-04-quiz-player.jpg", caption: "Exam mode — timed, blind, with a per-question clock", w: 960, h: 905 },
        { file: "edublaxk-05-results.jpg", caption: "Results — mastery score, MCQ accuracy and rubric-evaluated theory marks", w: 960, h: 905 },
        { file: "edublaxk-08-ask-tutor.jpg", caption: "Per-question AI tutor drawer", w: 956, h: 900 },
        { file: "edublaxk-06-history-vault.jpg", caption: "History vault and the anti-duplicate question bank", w: 960, h: 905 },
        { file: "edublaxk-01-setup-wizard.jpg", caption: "First-run wizard — provider and key", w: 956, h: 900 }
      ],
      excerpts: [
        {
          path: "server.ts",
          sha: "5c1445d651",
          startLine: 22,
          endLine: 59,
          lang: "typescript",
          label: "The trust boundary, in full",
          why:
            "Fifteen lines that decide the whole security posture: the server reports which providers are usable and returns model metadata, while the key travels inward exactly once, on POST /api/keys, and is validated before it is stored.",
          key: "Blaxk-C137/EduBlaxk::server.ts",
        }
      ]
    },

    {
      slug: "sabi",
      title: "SABI",
      tagline: "Voice-first tutor that runs on your device",
      status: "prototype",
      repo: "Blaxk-C137/SABI",
      demo: null,
      language: "TypeScript",
      stack: ["React", "Vite", "Gemini (free tier)", "Whisper small (local)", "Piper", "Web Speech"],
      themes: ["education", "ai", "local-first", "voice"],
      lastPush: "2026-10-12",
      sha: "9ff8827f93",
      files: 119,
      bytes: 733040,
      license: null,
      featured: true,
      order: 3,
      oneLiner:
        "You talk or type; the model writes the lesson from your own lecture PDFs; the device does the speaking and the listening.",
      problem:
        "Cloud tutors either cannot hear the student properly or answer from a generic textbook instead of the lecturer's material. Accent-heavy speech recognition and offline study both tend to be afterthoughts in study assistants built elsewhere.",
      users:
        "A student who revises out loud, on a laptop, in a place with unreliable bandwidth, using their own lecturer's slides.",
      approach:
        "A deliberate division of labour: the language model handles text only. Speech recognition runs locally through Whisper small on the student's machine; speech output uses on-device browser voices with a selected accent. Course PDFs are the tutor's stated source of truth.",
      contribution:
        "Sole author. The repository includes the speech queue with explicit per-reply cancellation, the local voice client, the board renderer, model installation scripts and tests for the voice client.",
      decisions: [
        {
          t: "Gemini writes; the device speaks and listens",
          d: "Stated as a rule rather than a preference, because it is the whole reason the product is privacy-credible: no audio is sent to a speech API. The listening path is local Whisper, the speaking path is on-device voices."
        },
        {
          t: "Only free-tier models appear in the list — on purpose",
          d: "The model picker is restricted to free Flash and Flash-Lite identifiers. The app is structurally incapable of quietly billing a student for a Pro model."
        },
        {
          t: "One speech queue for the whole application",
          d: "Sentences are synthesised into clips and played back to back through a single audio context, fetching the next clip while the current one plays. Cancellation is explicit and per reply, so a re-render cannot cut a tutor off mid-sentence and a cancelled reply drops only its own clips."
        },
        {
          t: "Client-side speech fallback rather than silence",
          d: "If the local server voice is unavailable, clips fall back to the browser's built-in speech so the tutor still talks."
        }
      ],
      limitations: [
        "First run downloads a local speech model (about 250 MB) — documented up front as a one-time cost.",
        "Desktop Chrome or Edge is strongly recommended; the README states that Firefox speech support is weaker.",
        "Barge-in is deliberately narrow: one reply is one session, which keeps cancellation predictable but means overlapping speech is not supported.",
        "No public deployment."
      ],
      lessons:
        "Splitting speech from language is the decision everything else follows from — and it made the queue the most delicate part of the codebase, because the student has to be able to interrupt the tutor instantly without the tutor losing its place.",
      screenshots: [],
      excerpts: [
        {
          path: "src/lib/voice/tutor-speak.ts",
          sha: "9ff8827f93",
          startLine: 5,
          endLine: 22,
          lang: "typescript",
          label: "The speech queue contract",
          why:
            "The comment block is the design document. It states what a session is, why cancellation is explicit instead of a side effect of re-rendering, and what happens when the local voice is missing — three things that are usually discovered as bugs rather than decided.",
          key: "Blaxk-C137/SABI::src/lib/voice/tutor-speak.ts",
        }
      ]
    },

    {
      slug: "blaxk-xposer",
      title: "Blaxk Xposer",
      tagline: "One QR code for your local dev server",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk-Xposer",
      demo: null,
      language: "Python",
      stack: ["Python", "GTK", "Avahi / zeroconf", "Reverse proxy", "TLS"],
      themes: ["developer-tools", "networking", "local-first"],
      lastPush: "2026-10-15",
      sha: "5ccb12dc62",
      files: 70,
      bytes: 483086,
      license: null,
      featured: true,
      order: 4,
      oneLiner:
        "A tray application that publishes a running localhost dev server to your Wi-Fi and hands phones a QR code — no accounts, no tunnels.",
      problem:
        "Testing a site on a real phone means wrestling a tunnel, a firewall or a host-header rejection. Vite, webpack, Angular, Django, Rails and Next.js all refuse requests whose Host or Origin is not localhost — and a phone that loads your frontend cannot reach your backend, because to the phone 'localhost' means the phone.",
      users:
        "A developer with a phone in one hand and a dev server already running on the laptop.",
      approach:
        "Xposer reverse-proxies the local port to the LAN and rewrites traffic so the application never notices it moved: Host and Origin headers are translated per request, and URLs inside HTML, JavaScript, JSON, redirects, cookies and CSP headers are rewritten in both directions, including inside gzip-compressed and streamed bodies.",
      contribution:
        "Sole author. The repository contains the proxy session, the rewriting rules, the port and service detection, the GTK interface and an extensive test suite for the HTTP rewriting.",
      decisions: [
        {
          t: "Rewriting rules are pure functions over strings and bytes",
          d: "The module docstring says it and the file structure proves it: every rule is unit-testable without opening a socket. On a component where a bug means 'my dev server is now reachable from the coffee shop Wi-Fi', that testability is the safety mechanism."
        },
        {
          t: "Streaming bodies are held back, not buffered",
          d: "A URL can be split across two TCP chunks, so a naive per-chunk replace would miss it. Xposer holds back a tail sized to the longest possible URL literal, which is why a websocket or a live-reload stream does not break the rewriting."
        },
        {
          t: "HTTPS dev servers are presented to the phone over plain HTTP",
          d: "Xposer talks TLS to the application and plain HTTP to the phone, which removes the certificate-warning dead end. Keeping HTTPS end to end is one click away for applications that need camera or microphone permissions."
        },
        {
          t: "Non-web services are relayed as raw TCP",
          d: "A database or an SSH port is not pretending to be a website; it is relayed as TCP, and the interface says so."
        }
      ],
      limitations: [
        "LAN-only by design. Xposer exposes nothing to the public internet, which is the point — and also the boundary.",
        "Windows support depends on accepting the platform firewall prompt.",
        "It is a desktop tray application, so there is no public deployment to visit."
      ],
      lessons:
        "The interesting engineering was all in the seams. Rewriting a response body is easy; rewriting one that is gzipped, streamed, chunked across a boundary and carrying a variation header is a different problem, and the test file grew to be larger than the feature.",
      screenshots: [
        // The repository contains the tray icons; the interface itself has no
        // committed screenshot, so none is shown. Stated rather than papered over.
      ],
      excerpts: [
        {
          path: "services/http_rewriter.py",
          sha: "5ccb12dc62",
          startLine: 1,
          endLine: 30,
          lang: "python",
          label: "The design contract, in the docstring",
          why:
            "This docstring names all three failures the module exists to fix — Host/Origin rejection, a frontend calling the phone's own localhost, and CORS refusal — and then justifies why the implementation is pure functions. It is the clearest statement of the problem in the whole repository.",
          key: "Blaxk-C137/Blaxk-Xposer::services/http_rewriter.py",
        }
      ]
    },

    {
      slug: "forma",
      title: "FORMA",
      tagline: "Local voice studio — record, transcribe, search, speak",
      status: "prototype",
      repo: "Blaxk-C137/FORMA-",
      demo: null,
      language: "HTML / TypeScript / Python",
      stack: ["React", "FastAPI", "Whisper Tiny", "Piper VITS", "PyTorch", "Tavily"],
      themes: ["voice", "ai", "local-first", "tooling"],
      lastPush: "2026-10-15",
      sha: "2dc3f6d129",
      files: 146,
      bytes: 4958993,
      license: null,
      featured: true,
      order: 5,
      oneLiner:
        "A voice workspace that records, transcribes, refines, searches and speaks text, with the speech models running on your own machine.",
      problem:
        "Transcription services want your audio in their cloud, and voice tools are inconsistent about what leaves the device. Doing it locally by hand is a day of dependency archaeology before you record a single word.",
      users:
        "Someone who talks for a living — writing, drafting, dictating — and does not want the audio to leave the laptop.",
      approach:
        "npm install provisions a Python speech backend, downloads the models, verifies them and runs an offline smoke test that synthesises through both voices. Recording, transcription and speech then work offline; cloud search or summarisation fires only when explicitly clicked.",
      contribution:
        "Sole author. The repository includes the FastAPI speech backend, the installer and verifier scripts, the studio interface, the export layer and the Gemini integration.",
      decisions: [
        {
          t: "Setup fails loudly instead of degrading silently",
          d: "There is deliberately no dummy speech mode. If Python, a wheel, a model file or the inference check is missing, installation exits with an error naming the failing step rather than pretending the pipeline works."
        },
        {
          t: "Model weights live outside the repository",
          d: "Downloads go to a user cache directory and are verified by the installer, so the repository stays reviewable and a corrupt download is caught at install time rather than at first use."
        },
        {
          t: "Cloud calls are opt-in per action and stated in the interface",
          d: "Tavily search and Gemini refinement happen only after the user clicks the relevant action, and the boundary is written into the UI footer rather than buried in documentation."
        }
      ],
      limitations: [
        "About 700 MB of one-time model and runtime downloads — a real cost, disclosed before install.",
        "Windows is the primary target; support elsewhere depends on wheel availability, and the installer refuses rather than entering a fallback mode.",
        "No public deployment."
      ],
      lessons:
        "Provisioning is the product. Most people who abandon a local-first tool abandon it during installation, so the installer and its verification output got as much attention as the interface.",
      screenshots: [
        { file: "forma-08-desktop.jpg", caption: "Voice studio — capture, transcript and voice output in one workspace", w: 1280, h: 844 },
        { file: "forma-02-studio.jpg", caption: "A session in progress, full page", w: 1280, h: 2112 },
        { file: "forma-07-real-ml.jpg", caption: "Local ML status — Whisper and Piper running on the device", w: 1280, h: 844 },
        { file: "forma-05-wave-live.jpg", caption: "Live waveform during recording", w: 533, h: 455 },
        { file: "forma-09-mobile.jpg", caption: "Mobile layout", w: 390, h: 844 }
      ],
      excerpts: [
        {
          path: "backend/gemini.py",
          sha: "2dc3f6d129",
          startLine: null,
          endLine: null,
          lang: "python",
          label: "Server-side model integration",
          why:
            "Kept server-side so the key never reaches the browser, with the cloud step reachable only after an explicit user action.",
          lines: null // no excerpt body: pointer only, deliberately
        }
      ]
    },

    {
      slug: "blaxk-aggregator",
      title: "BlaXk Aggregator",
      tagline: "Compile a whole codebase into one document",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk_Aggregator",
      demo: null,
      language: "TypeScript",
      stack: ["React", "Vite", "Tailwind", "Python CLI", "pdf.js"],
      themes: ["developer-tools", "tooling"],
      lastPush: "2026-10-10",
      sha: "877869619f",
      files: 32,
      bytes: 248417,
      license: "MIT",
      featured: false,
      order: 6,
      oneLiner:
        "A web app and a Python CLI that gather many code files and documents into a single formatted output — for documentation, review, or handing a codebase to a language model.",
      problem:
        "Reviewing a project, or preparing context for an AI assistant, means hand-assembling dozens of files. Pasting PDFs into the same pipeline usually breaks it — and uploading private code to a stranger's server to do the assembly is not an acceptable trade.",
      users: "Developers and reviewers who need a codebase as one readable document.",
      approach:
        "Client-side file and folder ingestion with recursive folder upload and smart exclusion of node_modules and .git, document extraction for PDF, DOCX and XLSX, and five export formats — TXT, JSON, Markdown, HTML and PDF.",
      contribution: "Sole author of the web application and the accompanying Python CLI.",
      decisions: [
        {
          t: "All processing happens in the browser",
          d: "Privacy here is a product decision rather than a feature bullet: code never leaves the machine, so the tool can be used on a private repository without a trust conversation."
        },
        {
          t: "A CLI ships alongside the web app",
          d: "Because CI pipelines and terminals are where this work actually starts for many developers."
        },
        {
          t: "MIT licensed",
          d: "The only project in the featured set with an explicit licence — which means downstream reuse is already permitted and should be stated as such."
        }
      ],
      limitations: [
        "Very large trees are bounded by browser memory; the file-size limit is user-configurable rather than a hidden constant.",
        "No public deployment."
      ],
      lessons:
        "Recursive folder upload with sensible exclusions matters more than any export format — the first version was unusable because nobody wants to select forty files by hand.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "the-migrator",
      title: "The Migrator",
      tagline: "Rebuild a Python environment on a new machine",
      status: "prototype",
      repo: "Blaxk-C137/The_Migrator",
      demo: null,
      language: "Python",
      stack: ["Python", "pip", "packaging"],
      themes: ["developer-tools", "tooling"],
      lastPush: "2026-09-02",
      sha: "5787f415d4",
      files: 1,
      bytes: 28475,
      license: null,
      featured: false,
      order: 7,
      oneLiner:
        "Scans the packages installed on your current machine and generates an installer you can carry to the new one.",
      problem:
        "Nobody documents their global Python environment until the day they migrate and discover half their tooling is missing.",
      users: "Anyone moving between machines who has accumulated years of global packages.",
      approach:
        "Inventory the installed distributions, then emit a reproducible installer so the destination machine ends up with the same set.",
      contribution: "Sole author. It is intentionally a single file.",
      decisions: [
        {
          t: "One file, no dependencies",
          d: "A migration tool has to be runnable before the destination environment exists. Requiring a dependency tree to install a dependency list would be circular."
        }
      ],
      limitations: [
        "Assumes pip-compatible packages; system-level binaries are explicitly out of scope.",
        "It is a CLI utility, so there is no deployment to visit."
      ],
      lessons: "The value is in the reading, not the writing: the generated installer is meant to be read and edited before it runs.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "gesture-controls",
      title: "Gesture Controls",
      tagline: "Hand tracking as an input device",
      status: "prototype",
      repo: "Blaxk-C137/Gesture_Controls",
      demo: null,
      language: "Python",
      stack: ["MediaPipe", "OpenCV", "Python"],
      themes: ["vision", "experimental"],
      lastPush: "2026-05-20",
      sha: null,
      files: 12,
      bytes: 22675,
      license: "MIT",
      featured: false,
      order: 8,
      oneLiner: "Hand-gesture recognition that drives interactive games, using a webcam as the controller.",
      problem:
        "Whether computer vision can be a usable input device rather than a demo is decided by latency and false positives, not by accuracy on a still image.",
      users: "An experimental user — this is a testbed, not a product.",
      approach:
        "MediaPipe hand landmarks from the webcam feed are mapped to control events for a small game loop, with the frame budget treated as the constraint because the tracker and the renderer share one machine.",
      contribution: "Sole author of the tracking-and-control loop.",
      decisions: [
        {
          t: "Landmarks instead of a trained classifier",
          d: "Fewer moving parts and no dataset to collect before the first run — appropriate for testing whether the interaction is viable at all."
        },
        {
          t: "A gesture must be stable across frames before it counts",
          d: "Single-frame triggers produced constant accidental input, which is the failure that makes gesture control feel broken rather than imprecise."
        }
      ],
      limitations: [
        "Sensitive to lighting and camera quality.",
        "Prototype scope: a demo loop, not a general input framework.",
        "MIT licensed.",
        "A webcam application, so there is no deployment to visit."
      ],
      lessons: "Latency, not recognition accuracy, is what decides whether a gesture interface is usable.",
      screenshots: [],
      excerpts: []
    }
  ];

  /* --------------------------------------------------------------------------
     Deliberate exclusions. These repositories are public under the same account
     but are NOT presented as Blaxk's work. Recording the decision is part of the
     honesty of the portfolio.
     -------------------------------------------------------------------------- */
  var exclusions = [
    { repo: "Blaxk-C137/AsyncRAT-C-Sharp", reason: "Third-party remote-administration tooling. Not appropriate to exhibit.", kind: "sensitive-fork" },
    { repo: "Blaxk-C137/Forked", reason: "A publicly documented decompression bomb. Retained as a reference only.", kind: "sensitive-fork" },
    { repo: "Blaxk-C137/rea-bx", reason: "Upstream fork — authorship belongs to the original project.", kind: "fork" },
    { repo: "Blaxk-C137/Recordly", reason: "Upstream fork.", kind: "fork" },
    { repo: "Blaxk-C137/Signova-", reason: "Upstream fork — a sign-language converter by another author.", kind: "fork" },
    { repo: "Blaxk-C137/Blaxk3dsvg", reason: "Upstream fork.", kind: "fork" },
    { repo: "Blaxk-C137/moltbot", reason: "Upstream fork.", kind: "fork" },
    { repo: "Blaxk-C137/Call-of-Duty-Sol-Ultra", reason: "Upstream fork of a third-party game project.", kind: "fork" },
    { repo: "Blaxk-C137/public-apis", reason: "Upstream fork of a community list.", kind: "fork" }
  ];

  /* --------------------------------------------------------------------------
     Services. Only services actually offered today are marked active. Anything
     that is aspirational is marked as a capability under development, and no
     price, timeline, client or certificate is claimed anywhere.
     -------------------------------------------------------------------------- */
  var services = [
    {
      id: "web",
      name: "Web applications",
      active: true,
      problem: "A product or internal tool that has to exist in a browser and survive real users.",
      approach: "React or plain web standards on the front, a typed API behind it, and a database chosen for the workload rather than for fashion.",
      deliverables: ["Working application", "Repository you own", "Written setup and deployment notes"],
      evidence: ["blaxk-housing", "edublaxk", "blaxk-aggregator"]
    },
    {
      id: "automation",
      name: "Automation & scripting",
      active: true,
      problem: "A repetitive process that costs hours a week and breaks whenever a human forgets a step.",
      approach: "Python or Node scripts, scheduled jobs, and integrations with the tools already in use — WhatsApp bots, file pipelines, data extraction.",
      deliverables: ["Automation with error handling", "A runbook", "Logs you can read"],
      evidence: ["blaxk-aggregator", "the-migrator"]
    },
    {
      id: "ai",
      name: "AI integration",
      active: true,
      problem: "An AI feature that needs to be genuinely useful, keep the key server-side, and degrade honestly when the model is unavailable.",
      approach: "Retrieval from your own documents, schema-validated model output, rate limits, cost ceilings and a deterministic fallback so the product still works when the model does not.",
      deliverables: ["Server-side AI endpoints", "Prompt and schema definitions", "Usage and cost controls"],
      evidence: ["edublaxk", "sabi", "forma"]
    },
    {
      id: "local-first",
      name: "Local-first & offline tooling",
      active: true,
      problem: "Software that must work without a connection, or on data that must not leave the machine.",
      approach: "On-device models, local storage, and installation that verifies itself instead of failing silently later.",
      deliverables: ["Installable tool", "Local model provisioning", "Privacy boundary documented in the interface"],
      evidence: ["sabi", "forma", "blaxk-xposer"]
    },
    {
      id: "systems",
      name: "Systems & network tooling",
      active: true,
      problem: "Two machines need to talk to each other, or a device needs to do something the manual does not cover.",
      approach: "Proxy and relay tooling, service discovery on a local network, firmware-adjacent work, and mechatronics where the software has to meet the physical world.",
      deliverables: ["Tooling", "Test suite for the risky parts", "Operational notes"],
      evidence: ["blaxk-xposer", "gesture-controls"]
    },
    {
      id: "consulting",
      name: "Technical consulting & review",
      active: false,
      problem: "A system that needs an outside read before it is committed to.",
      approach: "Architecture review, code review, and an honest assessment of what should not be built.",
      deliverables: ["Written findings", "Prioritised recommendations"],
      evidence: [],
      note: "Offered informally today; not yet a packaged service."
    },
    {
      id: "cloud",
      name: "Cloud & infrastructure management",
      active: false,
      problem: "Deployment, monitoring and infrastructure that stays up.",
      approach: "Deployment pipelines, observability and cost control.",
      deliverables: [],
      evidence: [],
      note: "Capability under development. Not offered as a standalone service yet."
    },
    {
      id: "security",
      name: "Security-oriented services",
      active: false,
      problem: "Finding the ways a system can be abused before someone else does.",
      approach: "Threat modelling, dependency review and basic hardening.",
      deliverables: [],
      evidence: [],
      note: "Capability under development. This is explicitly not offered as a penetration-testing service, and no certification is claimed."
    }
  ];

  /* --------------------------------------------------------------------------
     Timeline. Only milestones that are verifiable from the public record —
     repository creation and last-push dates read from the GitHub API. No
     invented dates, no invented employers, no invented awards.
     -------------------------------------------------------------------------- */
  var timeline = [
    { date: "2026-10", event: "FORMA and Blaxk Xposer both actively developed", detail: "Last pushes to FORMA (2 Oct) and Xposer (15 Oct) show two local-first tools in simultaneous development.", kind: "flag" },
    { date: "2026-10", event: "A year of building in public", detail: "43 public repositories on Blaxk-C137, spanning education, automation, networking, vision and web.", kind: "" },
    { date: "2026-09", event: "EduBlaxk reaches a complete assessment flow", detail: "Document extraction, item generation, exam mode, rubric grading and the tutor drawer, with nine committed screenshots.", kind: "flag" },
    { date: "2026-09", event: "BlaXk Housing built end to end", detail: "React front end and Django REST back end in one repository, with role-based routing and listing analytics.", kind: "" },
    { date: "2026-05", event: "Computer-vision experimentation", detail: "Gesture Controls: MediaPipe landmark tracking driving a game loop with a webcam as the controller.", kind: "" },
    { date: "2025-11", event: "Earliest activity still visible on the account", detail: "The oldest repository under this account dates to late 2025. Earlier work under a previous namespace is no longer publicly reachable and is therefore not claimed here.", kind: "" }
  ];

  /* --------------------------------------------------------------------------
     Verified capability list. Each entry maps to real repository evidence.
     Nothing is listed that is not demonstrated in a public repository.
     -------------------------------------------------------------------------- */
  var skills = [
    { name: "React", evidence: ["blaxk-housing", "edublaxk", "sabi", "forma", "blaxk-aggregator"] },
    { name: "TypeScript", evidence: ["edublaxk", "sabi", "blaxk-aggregator"] },
    { name: "JavaScript", evidence: ["blaxk-housing", "blaxk-xposer"] },
    { name: "Python", evidence: ["blaxk-xposer", "the-migrator", "gesture-controls"] },
    { name: "Node.js / Express", evidence: ["edublaxk", "forma"] },
    { name: "Django REST Framework", evidence: ["blaxk-housing"] },
    { name: "FastAPI", evidence: ["forma"] },
    { name: "Web Speech + local speech models", evidence: ["sabi", "forma"] },
    { name: "MediaPipe / OpenCV", evidence: ["gesture-controls"] },
    { name: "Reverse proxy & HTTP rewriting", evidence: ["blaxk-xposer"] },
    { name: "Local-first storage design", evidence: ["edublaxk", "sabi"] },
    { name: "GTK desktop interfaces", evidence: ["blaxk-xposer"] },
    { name: "Linux (Fedora) as a daily environment", evidence: ["blaxk-xposer"] },
    { name: "AI provider integration (Gemini, Claude, OpenAI)", evidence: ["edublaxk", "sabi", "forma"] },
    { name: "Git", evidence: ["blaxk-housing", "edublaxk", "sabi", "blaxk-xposer", "forma"] }
  ];

  /* --------------------------------------------------------------------------
     Assistant knowledge base.
     IMPORTANT: this build ships a DETERMINISTIC retriever, not a language model.
     It answers only from these verified records and says so. The intended
     production wiring is a server-side Gemini endpoint (see
     docs/architecture.md and docs/security-threat-model.md); until that endpoint
     is configured and funded, an honest lookup is better than a confident
     imitation of one.
     -------------------------------------------------------------------------- */
  var knowledge = [
    {
      id: "what-does-the-company-do",
      match: ["what does", "what do you do", "services", "offer", "company do", "help with"],
      answer:
        "BLAXK BYTE TECHNOLOGIES works on web applications, automation, AI integration, local-first tooling and systems or network tooling. Six services are listed as active on the company page; consulting, cloud management and security-oriented work are listed as capabilities under development rather than as things you can buy today.",
      links: [{ label: "Company & services", href: "company.html" }]
    },
    {
      id: "who-is-blaxk",
      match: ["who is blaxk", "who are you", "about you", "the builder", "the founder", "your background", "blaxk"],
      answer:
        "Blaxk is a developer and automation builder, and a mechatronics engineering student. The public work spans education tooling, local-first AI, developer utilities and computer-vision experiments. The about page lists technical capabilities, each one tied to a public repository where it is actually demonstrated.",
      links: [{ label: "About Blaxk", href: "about.html" }]
    },
    {
      id: "is-company-registered",
      match: ["registered", "registration", "incorporat", "legal name", "cac", "company number"],
      answer:
        "That is not something this site asserts. Registration status is deliberately not claimed here because it has not been verified as complete. If you need the company's legal position and details for a contract, ask directly and you will get a straight answer with documentation.",
      links: [{ label: "Ask directly", href: "contact.html" }]
    },
    {
      id: "are-projects-live",
      match: ["live", "deployed", "demo", "can i use", "is it online", "try it", "url"],
      answer:
        "No project on this site is published under a public URL, and none is described as shipped. Every one is a prototype: working code in a public repository, with a README and — for EduBlaxk and FORMA — committed screenshots. You can run any of them locally by following the repository's setup section.",
      links: [{ label: "How status is defined", href: "work.html" }]
    },
    {
      id: "how-do-i-run-a-project",
      match: ["run", "install", "set up", "setup", "clone", "npm", "local"],
      answer:
        "Each case study links to its repository, and the repository README carries the setup steps. The local-first projects (EduBlaxk, SABI, FORMA) explain their first-run cost up front — for example FORMA downloads about 700 MB of models and verifies them during installation.",
      links: [{ label: "Source explorer", href: "source.html" }]
    },
    {
      id: "pricing",
      match: ["price", "cost", "how much", "rate", "quote", "budget", "charge"],
      answer:
        "No prices are published, and this site will not invent one. Scope, cost and timeline are agreed in writing before work starts, because a useful number depends on what is actually being built. Send the shape of the problem and you get a written scope back.",
      links: [{ label: "Start a project", href: "contact.html" }]
    },
    {
      id: "contact",
      match: ["contact", "email", "reach", "talk", "hire", "work with", "start a project"],
      answer:
        "The contact page has a form and the direct channels. If you already know what you need, include the problem, the deadline if there is one, and roughly what exists today — that is usually enough to answer with a real scope rather than a holding reply.",
      links: [{ label: "Contact", href: "contact.html" }]
    },
    {
      id: "housing",
      match: ["housing", "accommodation", "buk", "landlord", "listing"],
      answer:
        "BlaXk Housing is a student accommodation platform for Bayero University Kano: React front end, Django REST back end, role-based routing for students and landlords, and rate-limited listing analytics. It is a prototype in a public repository with no public deployment.",
      links: [{ label: "BlaXk Housing case study", href: "projects/blaxk-housing.html" }]
    },
    {
      id: "edublaxk",
      match: ["edublaxk", "quiz", "assessment", "mcq", "rubric", "exam"],
      answer:
        "EduBlaxk turns lecture PDFs into diagnostic multiple-choice and rubric-graded theory questions. Provider keys stay on the server, model output is schema-validated, a rate-limited model falls back to a cheaper tier rather than a dearer one, and the anti-duplicate question bank lives in the student's browser so the 'always fresh questions' claim is verifiable locally.",
      links: [{ label: "EduBlaxk case study", href: "projects/edublaxk.html" }]
    },
    {
      id: "sabi",
      match: ["sabi", "tutor", "voice tutor", "whisper", "speech", "accent"],
      answer:
        "SABI is a voice-first tutor with a deliberate split: the model writes text, the device does the speaking and the listening. Listening is local Whisper small, speaking is on-device browser voices, and the model list is restricted to free-tier models so the app cannot quietly bill a student.",
      links: [{ label: "SABI case study", href: "projects/sabi.html" }]
    },
    {
      id: "xposer",
      match: ["xposer", "qr", "local dev server", "phone testing", "proxy"],
      answer:
        "Blaxk Xposer publishes a running localhost dev server to your Wi-Fi and gives phones a QR code. The hard part is rewriting: Host and Origin headers are translated per request and URLs inside HTML, JavaScript, JSON, cookies, redirects and CSP headers are rewritten both ways — including inside gzipped and streamed bodies — so the dev server never notices it moved. It is LAN-only by design.",
      links: [{ label: "Blaxk Xposer case study", href: "projects/blaxk-xposer.html" }]
    },
    {
      id: "forma",
      match: ["forma", "transcribe", "voice studio", "piper", "dictate"],
      answer:
        "FORMA is a local voice studio: record or upload audio, transcribe with Whisper Tiny, optionally refine or search with cloud tools you explicitly invoke, then speak it with a Piper voice. Installation provisions and verifies about 700 MB of models, and there is deliberately no dummy speech mode — if inference cannot work, setup fails loudly and names the step.",
      links: [{ label: "FORMA case study", href: "projects/forma.html" }]
    },
    {
      id: "ai-on-this-site",
      match: ["ai", "gemini", "model", "chatbot", "llm", "assistant", "this ai"],
      answer:
        "This assistant is a deterministic retriever over the verified project records in this build — it is not a language model, and it will not answer beyond what is recorded here. The intended production design is a server-side Gemini endpoint with retrieval over approved content, schema-validated output, rate limits and a static fallback. The architecture and its threat model are documented in the repository.",
      links: [{ label: "Privacy & AI disclosure", href: "privacy.html" }]
    },
    {
      id: "stack",
      match: ["stack", "technolog", "tools", "frameworks", "languages", "skills"],
      answer:
        "Capabilities are listed on the about page, and each one is tied to a public repository where it is actually demonstrated — React, TypeScript, Python, Node and Express, Django REST Framework, FastAPI, local speech models, MediaPipe and OpenCV, GTK, reverse-proxy work and AI provider integration. Nothing is listed that is not evidenced.",
      links: [{ label: "About & capabilities", href: "about.html" }, { label: "Technology trace", href: "source.html" }]
    },
    {
      id: "why-so-few",
      match: ["how many projects", "only eight", "few", "more projects", "other repos"],
      answer:
        "There are 43 public repositories on the account. Eight are presented as work here, chosen because they carry the evidence a case study needs: a README that explains the build, screenshots, and code worth quoting at a pinned commit. Nine are upstream forks, listed by name on the source page and credited to their authors rather than exhibited, and two of those are additionally excluded on judgement. The remaining twenty-six are all original work but are not case studies — one is the profile repository, three are empty, and twenty-two are smaller tools and personal utilities. Nothing is hidden and nothing is padded.",
      links: [{ label: "What is excluded and why", href: "source.html" }]
    },
    {
      id: "status-meaning",
      match: ["status", "prototype mean", "shipped", "in progress", "concept"],
      answer:
        "Four statuses are used, and they mean exactly this: shipped requires a verified public deployment (no project currently qualifies), prototype is working code with README evidence, in progress is actively being built, and concept is a documented idea only. Nothing is upgraded in wording without evidence.",
      links: [{ label: "Status vocabulary", href: "work.html" }]
    }
  ];

  return {
    owner: OWNER,
    snapshot: SNAPSHOT,
    profileUrl: "https://github.com/" + OWNER,
    projects: projects,
    exclusions: exclusions,
    services: services,
    timeline: timeline,
    skills: skills,
    knowledge: knowledge,
    /* Facts that are safe to state and checkable by anyone. */
    facts: {
      publicRepositories: 43,
      featuredProjects: projects.length,
      accountUrl: "https://github.com/" + OWNER,
      previousNamespace: "black999-ng",
      previousNamespaceStatus: "not found (HTTP 404 as of " + SNAPSHOT + ")"
    }
  };
})();
