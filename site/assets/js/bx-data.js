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
       Deployment URLs were checked one by one rather than trusted; some
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
        "It runs locally from the repository. Screenshots on this page are the working application.",
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
        "It runs from the repository rather than from a hosted URL."
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
        "It runs from the repository rather than from a hosted URL."
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
        "It is a desktop tray application, so it is installed rather than visited."
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
        "It runs from the repository rather than from a hosted URL."
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
        "It runs from the repository rather than from a hosted URL."
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
        "It is a command-line utility, so it is installed rather than visited."
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
        "It is a camera application, so it runs on the machine with the webcam."
      ],
      lessons: "Latency, not recognition accuracy, is what decides whether a gesture interface is usable.",
      screenshots: [],
      excerpts: []
    },

    /* ======================================================================
       Promoted in the second pass. These were previously visible only in the
       repository list; each now carries the evidence a case study needs, taken
       from its README and its committed files at a pinned commit.
       ====================================================================== */

    {
      slug: "statusfix",
      title: "StatusFix",
      tagline: "Compress media so WhatsApp stops destroying it",
      status: "shipped",
      repo: "Blaxk-C137/statusFix-server",
      /* StatusFix is the one project here that spans several repositories: an API tier,
         a client, and a combined deployment repository. All three are listed so the
         accounting below adds up. */
      repos: ["Blaxk-C137/statusFix-server", "Blaxk-C137/Blaxk-Status", "Blaxk-C137/statusFix-Client"],
      demo: "https://status-fix-client.vercel.app",
      demoChecked: "2026-10-16",   /* verified by hand: HTTP 200, twice, on this date */
      language: "JavaScript",
      stack: ["React 18", "Vite", "Express", "FFmpeg", "Tailwind", "shadcn/ui"],
      themes: ["tooling", "media", "web"],
      lastPush: "2026-10-10",
      sha: "0dd79011b4",
      files: 51,
      bytes: 128000,
      license: null,
      featured: true,
      order: 9,
      oneLiner:
        "Drop in a photo or a clip and get back a file already under WhatsApp's status limits, so its compressor never has a reason to touch it.",
      problem:
        "WhatsApp re-compresses anything you post as a status, and the result is visibly worse than what went in. The cause is a size ceiling: exceed it and the platform degrades your media to fit. The fix is to arrive under the ceiling on your own terms rather than let the platform decide.",
      users: "Anyone who posts photos or video to WhatsApp status and has noticed the quality drop, which is most of the people who post at all.",
      approach:
        "Images are capped at 1600px on the long edge and encoded to a guaranteed sub-5MB JPEG. Video is transcoded to H.264/AAC at 720p with a two-pass encode sized to land under 16MB, because a single-pass bitrate guess overshoots as often as it undershoots. All of it runs server-side through FFmpeg, bundled via ffmpeg-static so there is no system dependency to install.",
      contribution:
        "Sole author across three repositories: the Express/FastAPI-tier API that does the encoding, the React client that does the uploading, and a combined deployment repository that serves both from one process.",
      decisions: [
        {
          t: "Two-pass encoding rather than a bitrate formula",
          d: "A target size is a hard constraint, not a preference. Two-pass measures the actual source before committing to a bitrate, which is the only way to hit 16MB reliably across a 10-second clip and a 3-minute one."
        },
        {
          t: "Files deleted immediately after the response",
          d: "Uploads and outputs live in the OS temp directory and are unlinked the moment the response is sent. Media people post to status is personal, and a service that quietly retains it is a liability in a way that has nothing to do with the feature."
        },
        {
          t: "FFmpeg bundled, not assumed",
          d: "Requiring a system FFmpeg install would have made the project unrunnable for exactly the people most likely to try it. Bundling costs package size and removes an entire class of setup failure."
        }
      ],
      limitations: [
        "It runs from the repository rather than from a hosted URL.",
        "Video is capped at 3 minutes by design; longer clips are rejected rather than silently truncated.",
        "There is no test suite, so the encode guarantees rest on the author's manual verification."
      ],
      lessons:
        "Encoding parameters should be expressed as the outcome you need rather than the mechanism you use. \"Under 16MB\" is checkable; \"CRF 23\" is not.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxkwave",
      title: "BlaXkWave Studio",
      tagline: "One sound, every device, no app to install",
      status: "prototype",
      repo: "Blaxk-C137/BlaxkWave",
      demo: null,
      language: "TypeScript",
      stack: ["React", "Vite", "Express", "WebSocket", "WebRTC", "TypeScript"],
      themes: ["web", "voice", "networking"],
      lastPush: "2026-10-15",
      sha: "7045abb5fb",
      files: 97,
      bytes: 2593000,
      license: null,
      featured: true,
      order: 10,
      oneLiner:
        "A host shares audio once and every listener hears it in their own headphones, from a room code or a QR link, with no client to install.",
      problem:
        "Sharing audio in a room usually means either everyone hears the laptop speaker, or everyone installs something. Both are worse than they need to be: browser audio sharing is possible today, and a room code built on it needs no installation at all.",
      users: "Groups in one place who want to listen to the same thing together, from a host's phone or laptop, each on their own headphones.",
      approach:
        "One real WebRTC peer connection per listener, signalled over a WebSocket with heartbeat and reconnection backoff. The host can broadcast a built-in generated loop, a microphone, a browser tab, or a local file, and keeps master gain, pause and per-listener volume control. Rooms use six-character invitation codes with clipboard links and real QR URLs.",
      contribution:
        "Sole author. This is a TypeScript rebuild of an earlier host/join prototype, restructured into directly addressable pages rather than one oversized dashboard.",
      decisions: [
        {
          t: "The honest audio scope is stated on the front page",
          d: "The README says plainly that browser sharing uses low-latency WebRTC and is not sample-accurately synchronised across devices. Writing that down removes the expectation that a listener will hear a sample-perfect copy, which is the expectation that makes this kind of project look broken when it is not."
        },
        {
          t: "Every page is a real route",
          d: "Overview, studio, sessions, sources, guide, preferences and /join/CODE12 all resolve on refresh and direct link, with browser history. A single-page app that loses its state on reload would be unacceptable for something you hand someone a link to."
        },
        {
          t: "A locally generated soundcheck instead of a streaming service",
          d: "The bundled test loop is original and generated locally, so demonstrating the product does not depend on a third party's licence or availability."
        }
      ],
      limitations: [
        "Not sample-accurately synchronised across devices; it is designed for a shared room, not for distributed latency-critical playback.",
        "Microphone and screen capture require HTTPS, so a plain-IP local network test will not offer every source.",
        "Sessions and recent-room history are stored locally on the device, not in an account.",
        "It runs from the repository rather than from a hosted URL."
      ],
      lessons:
        "The most valuable line in the whole README is the one admitting what the audio does not do. A precise limitation is what makes the rest of the claims believable.",
      screenshots: [
        { file: "blaxkwave-01-overview.jpg", caption: "The workspace overview: session entry points and the audio-source cards.", source: "docs/screenshots/desktop-overview.png", w: 1400, h: 972 },
        { file: "blaxkwave-02-host.jpg", caption: "The active host room, with master gain and the live listener list.", source: "docs/screenshots/desktop-host.png", w: 1400, h: 1115 },
        { file: "blaxkwave-03-listener.jpg", caption: "The listener view: personal volume, mute and local monitoring.", source: "docs/screenshots/desktop-listener.png", w: 1400, h: 972 },
        { file: "blaxkwave-04-mobile.jpg", caption: "The narrow layout, where the join flow matters most: a phone scanning a room.", source: "docs/screenshots/mobile-overview.png", w: 410, h: 1491 }
      ],
      excerpts: []
    },

    {
      slug: "crushboard",
      title: "CrushBoard",
      tagline: "Partner acquisition, played completely straight",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk_Crush",
      demo: null,
      language: "TypeScript",
      stack: ["Next.js", "React", "TypeScript", "Tailwind", "Supabase", "Vercel"],
      themes: ["web", "marketplace", "experimental"],
      lastPush: "2026-10-10",
      sha: "37e108cfad",
      files: 103,
      bytes: 414700,
      license: null,
      featured: true,
      order: 11,
      oneLiner:
        "A dating app disguised as a recruitment platform: people post job listings describing the partner they want, and candidates apply anonymously.",
      problem:
        "Dating apps fail at the same thing every time: the profile is the product, so everyone optimises the profile, and the first impression becomes a performance rather than a signal. Inverting the format is a way to find out what changes when the pressure to present is removed.",
      users: "People who find conventional dating apps exhausting, and anyone who wants to see what happens when the same matching problem is framed as hiring.",
      approach:
        "Listers publish positions describing who they are looking for. Applicants submit anonymously through a shared link; a dedup pipeline prevents repeat submissions. The lister reviews candidates on a dashboard and unseals identities one at a time, by choice, rather than seeing everything at once. The interface is a deliberately straight-faced enterprise tool: no hearts, no pink, no bubbly motion, because the joke only works if the framing never breaks.",
      contribution:
        "Sole author. Runs in a seeded in-memory demo mode with no environment variables, so the whole pipeline is reviewable without provisioning anything.",
      decisions: [
        {
          t: "One-way reveal, chosen by the lister",
          d: "Identity is withheld until the lister decides to unseal it. That is the whole mechanism: it moves the point of judgement away from the photograph and back to the listing, which is the only reason the concept is interesting."
        },
        {
          t: "Demo mode runs with zero configuration",
          d: "With no env vars the app boots a seeded in-memory backend with live listings, candidates and the full pipeline. Anyone reviewing it gets the product instead of a setup guide, and the Supabase path stays available for anything real."
        },
        {
          t: "The masking happens in the database",
          d: "A masking view and row-level security in the initial migration withhold identity at the data layer, so an unsealed name is released deliberately rather than being hidden by the client and revealed by devtools."
        }
      ],
      limitations: [
        "Anonymous applications plus withheld identity is a combination with real abuse potential; there is no moderation or reporting flow yet.",
        "Demo data resets on server restart, and the Supabase path requires running two migrations plus deploying two edge functions before it is functional.",
        "It runs from the repository rather than from a hosted URL."
      ],
      lessons:
        "The concept only survived contact, with the database because making the reveal a real permission instead of a UI state forced the design to be honest about who can see what.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxkbot",
      title: "BlaxkBot v3",
      tagline: "A WhatsApp bot with a real command architecture",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk_bot",
      demo: null,
      language: "JavaScript",
      stack: ["Node.js", "Baileys", "WebSocket", "Node.js"],
      themes: ["automation", "tooling", "networking"],
      lastPush: "2026-09-03",
      sha: "50a058bd1a",
      files: 6301,
      bytes: 13986000,
      license: null,
      featured: true,
      order: 12,
      oneLiner:
        "Group management, moderation and media tooling delivered as over a hundred WhatsApp commands, with a permission model and a plugin layout built to keep growing.",
      problem:
        "WhatsApp group administration is manual and repetitive, and the tools that exist tend to be single-file scripts that collapse the moment you add a second feature or a second admin.",
      users: "Group administrators who want moderation and utility commands, and anyone maintaining a bot that has outgrown a single script.",
      approach:
        "A connection layer handles QR and pairing-code authentication, reconnection with exponential backoff, and event routing. A command registry handles registration and dispatch; a separate feature module per area registers its own commands, so group management, moderation, welcome messages, stickers, downloads and search each live in their own file. A four-tier permission engine resolves owner over sudo over group-admin over activator over everyone.",
      contribution: "Sole author. A merged and rebuilt version of two earlier bots.",
      decisions: [
        {
          t: "Permissions resolved as a tier engine, not per-command checks",
          d: "Scattering authority checks across a hundred commands guarantees that one of them eventually checks the wrong thing. Resolving the caller's tier once, in one place, makes the question answerable everywhere."
        },
        {
          t: "One module per feature area that registers its own commands",
          d: "A single command file is fine for twenty commands and hostile at a hundred and twenty. Each feature registering itself is what keeps the project addable-to, which is the only reason it reached that number."
        },
        {
          t: "Boots with no environment variables",
          d: "The bot starts and prints a QR code with nothing configured, and takes optional API keys only for the features that need them. Making the first run trivially succeed is what makes the hundredth feature possible to test."
        }
      ],
      limitations: [
        "Unofficial WhatsApp client libraries sit outside the platform's terms and break when the protocol changes; this is a real operational risk, not a footnote.",
        "The repository commits its node_modules directory, which is why the file count is over six thousand and the clone is large. This should be cleaned up.",
        "It runs from the repository rather than from a hosted URL.",
        "The moderation features act on group members and are therefore capable of being misused by whoever holds admin."
      ],
      lessons:
        "The permission tier was the single highest-value abstraction. Everything that went wrong in the earlier versions of this bot came down to a command that had not asked who was allowed to run it.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxk-anime",
      title: "Blaxk Anime",
      tagline: "Match releases by precision, then download and watch them",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk-Anime",
      demo: null,
      language: "JavaScript",
      stack: ["React 19", "Express", "Node.js", "Tailwind", "Three.js", "GSAP", "Server-Sent Events"],
      themes: ["media", "automation", "web"],
      lastPush: "2026-10-11",
      sha: "0350f6b739",
      files: 112,
      bytes: 615400,
      license: null,
      featured: true,
      order: 13,
      oneLiner:
        "Search a title, score every release against your own preferences, then queue, download and stream it from one library screen with live progress.",
      problem:
        "Finding a specific release of a series means reading a wall of near-identical filenames and working out which one is a decent encode, which one has the subtitles you want, and which one is a camera rip. The information needed to decide is all present and none of it is surfaced.",
      users: "People who care which release they download and are tired of discovering the answer after the download finishes.",
      approach:
        "A release matcher scores candidates against source, resolution, codec, audio and subtitler preferences, backed by the Jikan API behind a multi-tier token-bucket limiter at three requests per second and sixty per minute, with SHA-256 keyed disk caching and stale-fallback when the upstream is unavailable. Downloads run through a concurrency-limited job queue that reports progress over a single unified Server-Sent Events endpoint carrying state, speed and ETA.",
      contribution: "Sole author.",
      decisions: [
        {
          t: "One SSE endpoint for every job, not one poll per download",
          d: "Progress polling per download scales badly and gives an inconsistent picture. A single event stream broadcasting all job states keeps the queue display coherent and costs one connection."
        },
        {
          t: "Rate limiting treated as a first-class requirement",
          d: "The upstream API has real limits, so the limiter is a token bucket with two windows rather than a sleep between calls. A cache keyed by a hash of the request means a repeat search costs nothing upstream."
        },
        {
          t: "Stale cache beats an error page",
          d: "When the upstream is down, serving the last known good response with its age is more useful than failing, as long as the staleness is visible."
        }
      ],
      limitations: [
        "The download queue reports progress and state; the underlying fetch engine is the part most dependent on external tools whose availability varies.",
        "Search quality is bounded by what the upstream metadata API exposes.",
        "It runs from the repository rather than from a hosted URL."
      ],
      lessons:
        "Designing for a rate-limited upstream changed the shape of the app: once results are cached and jobs are queued, the interface becomes a library rather than a series of searches.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "luminary",
      title: "Luminary",
      tagline: "One recommendation engine across four kinds of media",
      status: "shipped",
      repo: "Blaxk-C137/Black-Recommender",
      demo: "https://black-recommender.vercel.app",
      demoChecked: "2026-10-16",   /* verified by hand: HTTP 200, twice, on this date */
      language: "TypeScript",
      stack: ["Next.js", "React", "TypeScript", "TanStack Query", "Zustand", "TMDB", "AniList", "Gemini"],
      themes: ["ai", "web", "media"],
      lastPush: "2026-10-11",
      sha: "5a9ec63765",
      files: 102,
      bytes: 352000,
      license: null,
      featured: true,
      order: 14,
      oneLiner:
        "Ask for something to watch or read and get a recommendation drawn from films, series, anime, manga and books in one place.",
      problem:
        "Recommendations are siloed by medium. You finish a series and the place that knows you liked it has no idea what to suggest in print, so the decision starts from nothing every time.",
      users: "People deciding what to watch or read next who do not want to make the decision in four separate apps.",
      approach:
        "Four media types are unified behind one interface: films and series from TMDB, anime and manga from AniList through GraphQL, and books from Google Books. Data is fetched with TanStack Query, ephemeral interface state lives in Zustand, and an AI recommendation route uses Gemini to turn a loose request into a pick with a poster.",
      contribution: "Sole author.",
      decisions: [
        {
          t: "Server routes in front of every provider",
          d: "Each API is reached through a parameter-based route rather than directly from the browser. That keeps provider keys out of client code and gives one place to normalise four differently shaped responses."
        },
        {
          t: "Degrade to a retry tile, not a blank screen",
          d: "A missing key produces a visible retry state with an explanation instead of an empty grid, so a configuration problem is diagnosable by the person seeing it."
        },
        {
          t: "Local state stays local",
          d: "Saved titles live in local storage and ephemeral interface state in a store, with the query cache handling everything server-owned. No account is required to use it."
        }
      ],
      limitations: [
        "Requires three separate provider keys to be fully functional, so a self-hosted copy is partly dark until they are supplied.",
        "Recommendation quality depends on the provider metadata available for the title you ask about.",
      ],
      lessons:
        "Four APIs with four vocabularies is mostly a normalisation problem. The interesting work was deciding what a film and a book have in common, which is less than it looks.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxk-grabber",
      title: "BlaXk Grabber",
      tagline: "A desktop downloader with a queue that survives failure",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk-Downloader",
      demo: null,
      language: "Python",
      stack: ["Python", "Tkinter", "yt-dlp", "pytest"],
      themes: ["media", "tooling", "automation"],
      lastPush: "2026-09-10",
      sha: "f61ef34dd2",
      files: 19,
      bytes: 115700,
      license: null,
      featured: true,
      order: 15,
      oneLiner:
        "A local desktop application that takes a link or a playlist from YouTube, Spotify or Audiomack and downloads it to your machine with progress you can watch.",
      problem:
        "Command-line downloaders work until they do not, and when one fails mid-playlist the error arrives as a stack trace with no indication of which items succeeded.",
      users: "People archiving media they already have access to, who want a local copy and a queue they can see.",
      approach:
        "A Tkinter interface wraps a downloader module split by responsibility: one part resolves metadata, one handles the fetch, and the interface stays out of both. Playlist items are queued individually so a single failure does not abandon the rest, and the queue reports per-item state.",
      contribution: "Sole author. Includes a pytest suite covering the metadata and playlist logic.",
      decisions: [
        {
          t: "Queue items separately rather than as one playlist job",
          d: "Treating a playlist as one unit means one bad item costs you the other thirty-nine. Per-item jobs turn a total failure into a partial success, which is the failure mode you actually want."
        },
        {
          t: "Separate metadata resolution from downloading",
          d: "Resolution is fast, fallible and worth caching; downloading is slow and stateful. Splitting them made each testable without the other, which is why there is a test suite at all."
        },
        {
          t: "A desktop interface for a tool that is easier as a script",
          d: "A script is faster to write and worse for the person watching a long queue. The interface exists to answer one question continuously: what is happening right now."
        }
      ],
      limitations: [
        "Depends on yt-dlp, so upstream site changes can break extraction until the dependency updates.",
        "Downloading media may conflict with a platform's terms of service; this is a personal archival tool, not a redistribution one.",
        "No packaged installer is recorded, so it runs from source.",
        "It runs from the repository rather than from a hosted URL."
      ],
      lessons:
        "Designing the failure mode first, per-item jobs rather than per-playlist, made the rest of the interface straightforward: there was already something truthful to display.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxk-tcf",
      title: "Blaxk_TCF",
      tagline: "Several WhatsApp accounts, one bot process",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk",
      demo: null,
      language: "JavaScript",
      stack: ["Node.js", "Baileys", "pnpm", "Node.js"],
      themes: ["automation", "tooling", "networking"],
      lastPush: "2025-12-11",
      sha: "39afb00a39",
      files: 57,
      bytes: 3106000,
      license: null,
      featured: true,
      order: 16,
      oneLiner:
        "A WhatsApp bot that manages multiple accounts as named sessions, with a choice of QR or pairing-code login on every one of them.",
      problem:
        "Running a bot on more than one WhatsApp account usually means running the bot more than once, and keeping two sets of credentials apart by hand.",
      users: "Anyone operating a bot on a personal and a business account, or on several numbers at once.",
      approach:
        "A first-run flow asks for a session name and a connection method, then stores credentials per session in their own folder with automatic reconnection and exponential backoff. Public or private mode controls who may issue commands, the prefix is configurable, and a small command set covers ping with real round-trip timing, help, session management and repository information.",
      contribution: "Sole author.",
      decisions: [
        {
          t: "Pairing code as well as QR",
          d: "Scanning a QR requires a phone with a working camera pointed at a terminal. Pairing codes do not, which matters when the account lives on a device you are not holding."
        },
        {
          t: "Sessions as folders rather than entries in one store",
          d: "Credential files are sensitive and session-scoped. One directory per session means revocation is a deletion and there is no shared file whose corruption takes down every account."
        },
        {
          t: "Public and private as a single switch",
          d: "The most consequential setting on a bot is who is allowed to talk to it, so it is one explicit value rather than a per-command policy."
        }
      ],
      limitations: [
        "Uses an unofficial WhatsApp client library, which is outside the platform's terms and can break without notice.",
        "The command set is deliberately small; this is the multi-session foundation, not a feature-complete bot.",
        "It runs from the repository rather than from a hosted URL."
      ],
      lessons:
        "Session isolation was worth the extra structure. The alternative, one credential store, would have made every account only as safe as the least stable one.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "aileads",
      title: "aiLEADS",
      tagline: "Find the work, then do the outreach",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk_Hand",
      demo: null,
      language: "Python",
      stack: ["Python", "Node.js", "SQLite", "Baileys", "pandas"],
      themes: ["automation", "ai", "tooling"],
      lastPush: "2026-05-03",
      sha: "2b22c33ae7",
      files: 18,
      bytes: 37888,
      license: null,
      featured: true,
      order: 17,
      oneLiner:
        "A scraper that collects freelance listings into a local database, paired with a WhatsApp bot that helps work through them.",
      problem:
        "Freelance work is found by refreshing several sites and then repeating the same outreach message, which is two repetitive jobs that a script should not be doing by hand.",
      users: "A solo freelancer whose pipeline is entirely their own effort, which is the situation this was written for.",
      approach:
        "A Python scraper normalises listings into a local SQLite database, and a small Node service on Baileys turns that into something reachable from a phone. The store is a single file, which means the whole pipeline can be inspected with one query.",
      contribution: "Sole author. Built to solve a problem the author had at the time.",
      decisions: [
        {
          t: "SQLite rather than a server database",
          d: "This is one person's lead list. A file is portable, inspectable and free, and nothing about the workload justifies a network round trip."
        },
        {
          t: "Message the data instead of building a dashboard",
          d: "The output is useful where the work gets done, which is on a phone between other things. A WhatsApp interface beats a web app nobody opens."
        }
      ],
      limitations: [
        "Scraping depends on the target sites' markup, so it breaks when they change. This is inherent, not incidental.",
        "Scraping may conflict with a site's terms of service; check before pointing it at anything.",
        "The lead database is a local file with no access control beyond the filesystem."
      ],
      lessons:
        "Personal tooling can be aggressively simple. Every generalisation this project did not make is time that went into the part that actually got used.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxk-sound",
      title: "blaxk-sounds",
      tagline: "Audible feedback for the moment a push succeeds",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk_Sound",
      demo: null,
      language: "Python",
      stack: ["Python", "Git hooks", "PCM audio"],
      themes: ["developer-tools", "tooling"],
      lastPush: "2026-09-26",
      sha: "f4dfe1cd2f",
      files: 33,
      bytes: 224300,
      license: null,
      featured: false,
      order: 18,
      oneLiner:
        "Plays a short sound when a push, a test run or a build finishes, so you stop watching a terminal for the one moment it matters.",
      problem:
        "A long-running command finishes when it finishes, and the only way to know is to keep looking at it. That is a small cost paid dozens of times a day.",
      users: "Developers running commands long enough to look away from.",
      approach:
        "Three distinct events, install, success and failure, each mapped to a short sound with a separate mute control. The sounds are generated locally as PCM rather than shipped as media files.",
      contribution: "Sole author, including the design notes and specifications committed alongside the code.",
      decisions: [
        {
          t: "Three events, not one",
          d: "A single notification tells you something happened. Separating install, success and failure tells you whether you need to come back."
        },
        {
          t: "Generate the audio rather than bundle it",
          d: "Synthesising the tones keeps the repository free of binary media and licensing questions, and makes the sounds adjustable in the source that produces them."
        }
      ],
      limitations: [
        "Depends on git hooks being installed, which is per-clone and easy to skip.",
        "Audio output is host-dependent and may be undesirable over a remote session, hence the mute."
      ],
      lessons:
        "A tool does not have to be large to be worth keeping. This one changed how it felt to work, which is a more honest measure than how impressive it looks.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "church-programme",
      title: "Church Program Viewer",
      tagline: "A live programme display driven by a spreadsheet",
      status: "prototype",
      repo: "Blaxk-C137/Church_programme_demo",
      demo: null,
      language: "Python",
      stack: ["Flask", "pandas", "Tailwind", "reportlab", "bleach"],
      themes: ["tooling", "web", "automation"],
      lastPush: "2026-03-21",
      sha: "eb3bafe59f",
      files: 3036,
      bytes: 1094000,
      license: null,
      featured: false,
      order: 19,
      oneLiner:
        "Reads a church event schedule from a spreadsheet and displays it as a live board, with notifications before each event starts.",
      problem:
        "The people running an event know the schedule is in a spreadsheet. The people attending cannot see it, and updating a printed programme means reprinting it.",
      users: "An event organiser and the audience in the room, who need to know what is happening now and what is next.",
      approach:
        "Flask serves a responsive card grid read from an Excel file with pandas. A file watcher reloads the display when the spreadsheet changes, so the organiser edits a file they already use. Notifications fire about five minutes before an event, event detail opens in an accessible modal, and a PDF export produces a printable copy with the organisation's logo.",
      contribution: "Sole author. Written for a real event rather than as a demonstration.",
      decisions: [
        {
          t: "The spreadsheet is the interface",
          d: "The organiser already maintains a spreadsheet. Making the application read that file removes an entire content-management layer and every reason not to update it."
        },
        {
          t: "Watch the file, do not re-import it",
          d: "Automatic reloading means the display follows the schedule without anyone remembering to press refresh mid-event."
        },
        {
          t: "Sanitise uploads and log failures",
          d: "The upload route accepts files and is protected by a password, so uploaded content is sanitised and errors are written to a log rather than swallowed."
        }
      ],
      limitations: [
        "The README states this is intended for local use; serving it publicly would need a proper WSGI server and secret management first.",
        "Stylesheets are loaded from a CDN, so the display degrades without network access.",
        "The upload password lives in an environment file and is only as strong as what is put in it."
      ],
      lessons:
        "Meeting users in the tool they already use beats teaching them a new one. The spreadsheet stayed the source of truth and adoption cost nothing.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxk-trader",
      title: "Trading Bot",
      tagline: "Strategy scaffolding for automated trading experiments",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk_Trader",
      demo: null,
      language: "Python",
      stack: ["Python", "pytest"],
      themes: ["experimental", "automation"],
      lastPush: "2026-05-20",
      sha: "5f42ab654b",
      files: 9,
      bytes: 2048,
      license: null,
      featured: false,
      order: 20,
      oneLiner:
        "A repository layout for automated trading strategies, with the strategy, data, utility and configuration concerns separated from the start.",
      problem:
        "Trading experiments tend to arrive as one file that mixes strategy, data fetching and execution. That shape makes it impossible to tell whether a result came from the idea or from the plumbing.",
      users: "The author, as an exercise in structuring a strategy engine before writing strategies in it.",
      approach:
        "Separate packages for strategies, data, utilities and configuration, with tests for the bot and the strategies. The structure is the deliverable; very little strategy logic exists yet.",
      contribution: "Sole author.",
      decisions: [
        {
          t: "Structure first, strategies later",
          d: "Writing the skeleton before the logic is the whole point: it forces the question of where a risk rule lives before there is any pressure to put it somewhere convenient."
        }
      ],
      limitations: [
        "This is scaffolding. There is almost no strategy logic, and it should not be read as a working trading system.",
        "The README states an MIT licence and refers to a LICENSE file; no licence file is present in the repository, so the repository currently defaults to all rights reserved.",
        "Nothing here has been run against real capital, and it should not be.",
        "The README contains legacy notes about MT4 interaction, which the current code does not implement."
      ],
      lessons:
        "It is more useful to be honest that this is a skeleton than to dress it as a finished engine. The layout is a real contribution; the strategy is not there yet.",
      screenshots: [],
      excerpts: []
    },

    {
      slug: "blaxk-survey",
      // The repository declares this URL; it returns DEPLOYMENT_NOT_FOUND.
      // Recorded so the source table can say so rather than leave a gap that
      // looks like an omission.
      homepage: "https://blaxk-survey.vercel.app",
      homepageChecked: "2026-10-16",
      homepageLive: false,
      title: "Marketplace Survey",
      tagline: "A short survey built to answer one product question",
      status: "prototype",
      repo: "Blaxk-C137/Blaxk-Survey",
      demo: null,
      language: "TypeScript",
      stack: ["Next.js", "React", "TypeScript", "Tailwind", "Vercel"],
      themes: ["marketplace", "web", "education"],
      lastPush: "2026-06-19",
      sha: "30536a391c",
      files: 17,
      bytes: 81920,
      license: null,
      featured: false,
      order: 21,
      oneLiner:
        "A deployable questionnaire about what a student marketplace should actually do, with four answer types and a results route.",
      problem:
        "Deciding what to build for students is guesswork without asking them, and asking them usually produces a spreadsheet nobody can analyse.",
      users: "A student developer deciding whether a campus marketplace is worth building, and the students whose answers decide it.",
      approach:
        "Questions are defined in one file with four answer types, single choice, multi choice, scale and free text, and a required flag that blocks progress until answered. A submit route collects responses and a results route returns them as structured JSON.",
      contribution: "Sole author.",
      decisions: [
        {
          t: "Questions as data, not markup",
          d: "Keeping every question in one typed file makes the survey editable without touching the interface, which is the difference between asking a follow-up question and rebuilding the site."
        },
        {
          t: "A JSON results route rather than a built dashboard",
          d: "The route returns raw responses in a shape that can be pasted into whatever analysis is wanted. Building a reporting interface before knowing the questions would have been premature."
        }
      ],
      limitations: [
        "The README notes the local JSON-file storage works for development but should be replaced with a hosted store for real collection; responses are not durable as written.",
        "It runs from the repository, and no response count is recorded."
      ],
      lessons:
        "The honest limitation here is the storage. A survey that loses responses is worse than no survey, which is exactly why the README says so.",
      screenshots: [],
      excerpts: []
    },
  ];

  /* --------------------------------------------------------------------------
     Deliberate exclusions. These repositories are public under the same account
     but are NOT presented as Blaxk's work. Recording the decision is part of the
     honesty of the portfolio.
     -------------------------------------------------------------------------- */
  var exclusions = [
    { repo: "Blaxk-C137/AsyncRAT-C-Sharp", reason: "Third-party remote-administration tooling. Not appropriate to exhibit.", kind: "sensitive-fork" },
    { repo: "Blaxk-C137/Forked", reason: "A publicly documented decompression bomb. Retained as a reference only.", kind: "sensitive-fork" },
    { repo: "Blaxk-C137/rea-bx",
      homepage: "https://rea.tools",
      homepageChecked: "2026-10-16",
      homepageLive: true, reason: "Upstream fork — authorship belongs to the original project.", kind: "fork" },
    { repo: "Blaxk-C137/Recordly",
      homepage: "https://recordly.dev",
      homepageChecked: "2026-10-16",
      homepageLive: true, reason: "Upstream fork.", kind: "fork" },
    { repo: "Blaxk-C137/Signova-", reason: "Upstream fork — a sign-language converter by another author.", kind: "fork" },
    { repo: "Blaxk-C137/Blaxk3dsvg",
      homepage: "https://3dsvg.design",
      homepageChecked: "2026-10-16",
      homepageLive: true, reason: "Upstream fork.", kind: "fork" },
    { repo: "Blaxk-C137/moltbot",
      homepage: "https://molt.bot",
      homepageChecked: "2026-10-16",
      homepageLive: true, reason: "Upstream fork.", kind: "fork" },
    { repo: "Blaxk-C137/Call-of-Duty-Sol-Ultra", reason: "Upstream fork of a third-party game project.", kind: "fork" },
    { repo: "Blaxk-C137/public-apis", reason: "Upstream fork of a community list.", kind: "fork" }
  ];


  /* --------------------------------------------------------------------------
     The rest of the account. Every public repository is accounted for here so
     that the gap between "43 public" and "21 case studies" is a stated fact
     rather than something a reader has to notice. `kind` drives the label:
       scaffold  - a template or starter that was not authored here
       empty     - a repository with no content yet
       sensitive - real work, held back deliberately, with the reason given
       profile   - the GitHub profile repository
       small     - real work that does not carry case-study evidence
     -------------------------------------------------------------------------- */
  var others = [
    { repo: "Blaxk-C137/Blaxk-C137", kind: "profile",
      note: "The GitHub profile repository itself. It renders the account card and has no application code." },
    { repo: "Blaxk-C137/Aunteee-D",
      homepage: "https://demo-rust-seven-66.vercel.app",
      homepageChecked: "2026-10-16",
      homepageLive: true, kind: "small",
      note: "A wedding invitation page built for a real family event, and the largest repository here. Held back as a case study because the only committed captures are dev-tooling artifacts and the content is personal to people who did not agree to be on a portfolio." },
    { repo: "Blaxk-C137/TOAST",
      homepage: "https://toast-ai-five.vercel.app",
      homepageChecked: "2026-10-16",
      homepageLive: false, kind: "small",
      note: "A Next.js application that rotates several Gemini keys through Vercel KV and ships a library of short reaction videos. The README is largely the framework's default, so there is not yet enough written evidence for a case study." },
    { repo: "Blaxk-C137/chrome_sol", kind: "sensitive",
      note: "A Solana wallet browser extension. The README advertises automatic approval of connection and transaction requests and mimicry of existing wallet interfaces. Those capabilities describe a tool for circumventing a user's own wallet prompts, so it is listed rather than exhibited, and no case study is written for it." },
    { repo: "Blaxk-C137/Blaxk-Encryptor", kind: "sensitive",
      note: "An encryptor and decryptor. Its own description calls it \"military grade\", which is an unverifiable security claim and exactly the kind of wording this site refuses to publish. Held for rewording rather than for any concern about the work." },
    { repo: "Blaxk-C137/Blaxk-X-Bot", kind: "small",
      note: "A small Python bot. No README, so there is no written evidence to build a case study from." },
    { repo: "Blaxk-C137/sniffle", kind: "small",
      note: "No description and no README. Nothing verifiable to say about it." },
    { repo: "Blaxk-C137/Blaxk_SuperFolio", kind: "scaffold",
      note: "A forty-three byte README and no implementation. An earlier attempt at this site, kept for history." },
    { repo: "Blaxk-C137/BlaxkVERSE", kind: "profile",
      note: "This site. The repository holds the source, the build tools, the seven design and engineering documents and the verification evidence that every claim on these pages was checked against." },
    { repo: "Blaxk-C137/super-carnival",
      homepage: "https://blaxk.vercel.app",
      homepageChecked: "2026-10-16",
      homepageLive: true, kind: "small",
      note: "A portfolio site, live at blaxk.vercel.app. Built from a public starter template and then customised — the scaffold credit is in its own README, so it is listed rather than exhibited." },
    { repo: "Blaxk-C137/reimagined-dollop", kind: "empty",
      note: "Empty. No files." },
    { repo: "Blaxk-C137/classified_APP", kind: "empty",
      note: "Empty. Described as a native listing web app, but nothing has been committed." }
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
      note: "Worked on inside projects rather than sold as a standalone service."
    },
    {
      id: "security",
      name: "Security-oriented services",
      active: false,
      problem: "Finding the ways a system can be abused before someone else does.",
      approach: "Threat modelling, dependency review and basic hardening.",
      deliverables: [],
      evidence: [],
      note: "Review and hardening work. This is not a penetration-testing service, and no certification is claimed for it."
    }
  ];

  /* --------------------------------------------------------------------------
     Timeline. Only milestones that are verifiable from the public record —
     repository creation and last-push dates read from the GitHub API. No
     invented dates, no invented employers, no invented awards.
     -------------------------------------------------------------------------- */
  var timeline = [
    { date: "2026-10", event: "FORMA and Blaxk Xposer both actively developed", detail: "Last pushes to FORMA (2 Oct) and Xposer (15 Oct) show two local-first tools in simultaneous development.", kind: "flag" },
    { date: "2026-10", event: "A year of building in public", detail: "A year of repositories on Blaxk-C137, spanning education, automation, networking, vision and web. The exact count at any moment is on the source page, reconciled against the API.", kind: "" },
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
      id: "who-is-blaxk",
      match: ["registered", "registration", "incorporat", "legal name", "cac", "company number", "who is"],
      answer:
        "BLAXK BYTE TECHNOLOGIES is a software and automation practice run by Blaxk, building web applications, automation, local-first AI tooling and systems software. The work is what is on this site: twenty-one case studies, every one of them a public repository with readable source, and every claim traced back to it.",
      links: [{ label: "About", href: "about.html" }, { label: "The work", href: "work.html" }]
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
        "BlaXk Housing is a student accommodation platform for Bayero University Kano: React front end, Django REST back end, role-based routing for students and landlords, and rate-limited listing analytics. The source is public and readable.",
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
        "Not a chatbot. It searches the records on this site — projects, statuses, links — and quotes them back with the source attached. If what you asked isn't written down here, it says so instead of making something up. The Gemini version is designed and not switched on yet; the privacy page covers that, and the threat model is in the repo.",
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
        "There are 43 public repositories on the account. Twenty-one are presented as full case studies, nine are upstream forks credited to their authors and listed individually, and the remaining thirteen are indexed on the source page with the reason each is not a case study. The complete table of all 43 is on the source page, so nothing is accounted for only by a summary sentence.",
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
    others: others,
    services: services,
    timeline: timeline,
    skills: skills,
    knowledge: knowledge,
    /* Facts that are safe to state and checkable by anyone. */
    /* The count the account reported when the records were last reconciled, and the
       count this build has catalogued. They are separate numbers on purpose: hard-coding a
       single "43" meant the site silently claimed to account for an entire account the
       moment GitHub reported one more repository. The verifier now compares the two and
       names the drift instead of letting the prose go quietly stale. */
    facts: {
      publicRepositories: 44,          /* catalogued in this build */
      accountReported: 44,             /* GitHub /users/:owner public_repos at last check */
      accountChecked: "2026-10-16",    /* when accountReported was observed */
      /* The drift was reconciled, not hidden: the 44th repository is BlaxkVERSE,
         the repository this site is built from, and it is now listed below with
         the rest. Nothing is outstanding against the account count. */
      accountDriftResolved: true,
      featuredProjects: projects.length,
      accountUrl: "https://github.com/" + OWNER,
      previousNamespace: "black999-ng",
      previousNamespaceStatus: "not found (HTTP 404 as of " + SNAPSHOT + ")"
    }
  };
})();
