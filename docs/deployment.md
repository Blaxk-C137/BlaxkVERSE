# Deployment

**BlaxkVERSE** · BLAXK BYTE TECHNOLOGIES · written 2026-10-16

> This is the operational document. It assumes no familiarity with Vercel, Resend or Redis. Every
> command was run and every value below was checked against the code that reads it. Where a step
> cannot be completed without something only the owner can supply, it says so and says what happens
> if you skip it — because every one of those skips degrades honestly rather than failing silently.

---

## 0 · What you are deploying, in one table

| Piece | Where it lives | What it needs to work |
|---|---|---|
| 30 static pages | `site/` | Nothing. They work on any file server. |
| Clean URLs (`/work/blaxk-anime`) | `vercel.json` → `rewrites` | Vercel. On another host, use the `.html` paths. |
| Security headers | `vercel.json` → `headers` | Vercel. Other hosts need equivalent config. |
| Contact form | `site/assets/js/emailjs-config.js` + the browser | An EmailJS public key, service id, and a notification and auto-reply template id — pasted into that one file. No environment variable, no function. |
| Visitor counting | `api/track.js` | A KV/Upstash REST URL + token |
| The dashboard | `site/admin.html` + `api/stats.js` | The same KV pair, plus `ADMIN_TOKEN` |

**Nothing in that list is required to have a working website.** With no environment variables at
all and no keys pasted, the site deploys, renders, navigates, animates and verifies; the contact
form says it is not wired yet, and the dashboard says the store is missing. That is the intended
failure mode and it was tested in §5.

### The short version — five things, in this order

| # | Do this | Section | If you skip it |
|---|---|---|---|
| 1 | Import the repository at Vercel. Change nothing — `vercel.json` is correct. | §1 | — |
| 2 | Create an EmailJS account, connect a mailbox, build one template. | §2.1–2.2 | The contact form validates, refuses to send with an explanation, and nothing is lost or silently dropped. |
| 3 | Paste the three ids into `site/assets/js/emailjs-config.js`, set the account cap and reCAPTCHA, commit, redeploy. | §2.3 | Same as above. There is no environment variable for this form — the keys ship in the file. |
| 4 | Create a KV store and connect it to the project. | §3 | Page views are accepted and discarded. `/admin` says the store is missing. |
| 5 | Generate a long random string and set it as `ADMIN_TOKEN`. | §4 | `/admin` refuses to open, which is the correct default for an unconfigured deployment. |

Then run `BASE=https://your-domain npm run test:live` (§5.5) and you are done. Everything the site
claims is already verified in the repository; that command verifies the parts that only exist once
it is deployed.

---

## 1 · Deploy

### 1.1 If the repository is already on GitHub

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, then import `Blaxk-C137/BlaxkVERSE`.
3. Vercel reads `vercel.json`, so leave the framework preset as **Other** and change nothing:
   - Build Command — `echo "static site: site/ is committed as the deployable artifact"`
   - Output Directory — `site`
   - Install Command — skipped (`--omit=dev`; there are no dependencies to install)
4. Add the environment variables from §3–4 **before** the first deploy, or add them after and
   redeploy. Variables are applied at deploy time, not at request time. The contact form is not
   part of this step — its config is a committed file (§2.3), so it deploys with the code.
5. **Deploy.**

### 1.2 From this machine, without GitHub

```bash
npm i -g vercel      # once
cd blaxkverse
vercel               # preview deployment, asks a few setup questions once
vercel --prod        # production
```

### 1.3 Watch the first deploy

The build log should be short — there is no bundler and no dependency tree. What you are looking
for is `<n> files uploaded` and then a green **Ready**. If it fails, the cause is almost always
§6.1.

---

## 2 · EmailJS — making the contact form deliver

The form has no server half any more. The browser validates, then posts straight to EmailJS;
EmailJS relays the message into whichever mailbox you connected. That is the whole pipeline, which
is why the configuration is one file and a dashboard, not three environment variables and a DNS
lesson.

### 2.1 Create the account and connect a mailbox

1. Sign up at [emailjs.com](https://www.emailjs.com) — the free tier is 200 emails/month, one
   mailbox, which is far more than a portfolio contact form spends.
2. **Email Services → Add New Service** → pick your provider (Gmail, Outlook, Yahoo, or any SMTP)
   → follow the auth prompts → **Activate**. Note the **Service ID** on the service page.
3. **Account → General** → copy the **Public Key**. It is public by design — it appears in browser
   code and is meant to. What keeps it from being abused is §2.3, not secrecy.

### 2.2 Build the two templates

The form sends the same payload to both templates. **Email Templates → Create a New Template**,
twice: one notification for you and one acknowledgement for the visitor.

| Variable | Content |
|---|---|
| `{{name}}` / `{{from_name}}` | the visitor's name |
| `{{email}}` / `{{from_email}}` | the visitor's email address |
| `{{reply_to}}` | same address — set the notification's **Reply To** to `{{reply_to}}` so replying reaches them |
| `{{subject}}` / `{{title}}` | what kind of work, from the select (e.g. `Web application`) |
| `{{message}}` | the enquiry itself, with an optional `Deadline:` line appended |
| `{{time}}` | when it was submitted, as a readable local timestamp |
| `{{to_name}}` | recipient greeting name, default "Blaxk" |
| `{{to_email}}` | where it lands — set this in the template, or fill `to_email` in the config file |

**Notification template** (`template_id`) — the enquiry that reaches you:

- **To email**: `{{to_email}}` if you filled it in the config file, or type your address once here
  and leave the config's `to_email` empty. One of the two must be real.
- **Reply To**: `{{reply_to}}`.
- Subject: `New enquiry from {{name}} — {{subject}}`.

**Auto-reply template** (`auto_reply_template_id`) — the acknowledgement the visitor receives:

- **To email**: `{{email}}` (or `{{reply_to}}`). This is what makes it reach the visitor rather
  than you; without it the acknowledgement goes to the wrong inbox.
- **Reply To**: your own address, so a visitor who answers reaches you.
- Subject: `Message received — thanks, {{name}}`.

The Portfolio project's `email-template.txt` and `email-template-autoreply.txt` are ready-made
HTML bodies for exactly these two variables; paste them into the Content tab's code view (EmailJS
adds the `<html>`/`<body>` wrapper itself).

Leaving `auto_reply_template_id` as its placeholder is supported: the form sends only the
notification and says so. If reCAPTCHA is enabled, enable it on the notification template only —
an access token is single-use, and the form deliberately does not reuse it for the second send.

### 2.3 Paste, limit, and prove

Paste into `site/assets/js/emailjs-config.js` — one file, committed, survives `npm run build`:

```js
window.BX_MAIL = {
  user_id: "the Public Key",                 // Account → General
  service_id: "the Service ID",              // Email Services
  template_id: "the notification Template ID", // Email Templates
  auto_reply_template_id: "the auto-reply Template ID", // optional
  to_name: "Blaxk",
  to_email: "",                               // optional, see §2.2
  recaptcha: "",                              // optional, see below
  endpoint: "https://api.emailjs.com/api/v1.0/email/send"
};
```

**Set the limits the same day, in the EmailJS dashboard.** With the key in public code, these are
not optional polish — they are the difference between a contact form and an open mailbox:

| Control | Where | Why |
|---|---|---|
| Monthly cap | Account → Limits | A scripted visitor can otherwise spend the whole 200 on junk before you notice |
| reCAPTCHA v3 | Template → settings; paste the site key into `recaptcha` in the config file | Google scores the submission; EmailJS refuses before your quota is touched |
| The honeypot | already in the form (`company`) | A filled hidden field never reaches EmailJS at all — the browser discards it locally |

The previous design (a server function with a hashed-IP rate limit of 5/hour) was replaced with
this on purpose; the trade is recorded in `docs/security-threat-model.md` §2, S11.

Prove it locally:

```bash
npm run dev          # boot line says "contact: EmailJS wired" once the file has real values
```

Open http://localhost:4173/contact, fill the form, press **Transmit**. Success reads
`Sent. Your enquiry went through EmailJS, and an acknowledgement is on its way…` — check both
inboxes (yours and the address you typed) within a second or two. Then check the two failure modes
behave:

```bash
# 1. no keys yet → the refusal must be visible in the status line, no request fired.
#    (temporarily restore the REPLACE_WITH placeholders to see it)
# 2. a bad key → EmailJS answers 400 and the form quotes it, never a fake success.
curl -s -X POST https://api.emailjs.com/api/v1.0/email/send \
  -H 'content-type: application/json' \
  -d '{"service_id":"x","template_id":"x","user_id":"bad"}'
```

**No environment variables are involved in the contact path at all.** If you are looking for a
place to put a secret: there isn't one, and `RESEND_*` is gone.

---

## 3 · Visitor tracking — a Redis over HTTP

Both Vercel KV and Upstash expose the same REST shape, so the code accepts either. Set one pair.

### 3.1 Vercel KV (fewest steps if you deployed in §1)

1. In the Vercel project: **Storage → Create Database → KV**.
2. Pick a region near you — for Abuja, `eu-west-1` or `fra1` is the sensible choice.
3. **Connect to Project.** Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically
   and offers to redeploy. Accept.

### 3.2 Upstash (works on any host)

1. [console.upstash.com](https://console.upstash.com) → **Create Database**. The free tier is
   500,000 commands/month against a few hundred a day here.
2. Open the database → **REST API** tab.
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

If both pairs are present, the `KV_REST_API_*` pair wins.

### 3.3 What gets written, exactly

One key per day per distinct visitor, plus a set of counters. Nothing identifying:

| Key | Contents | Expiry |
|---|---|---|
| `trk:salt:<day>` | The random salt. **Destroyed within a day**, which is what makes the visit hash unrecoverable | 25 hours |
| `trk:uv:<day>` | Set of visit hashes — SHA-256 of IP + user agent + that day's salt, truncated to 24 hex chars | 90 days |
| `trk:pv:<day>` | Total views that day | 90 days |
| `trk:path:<day>:<path>` | Views per page; the path is normalised to a safe alphabet before storage | 90 days |
| `trk:dev:<day>`, `trk:geo:<day>` | Hashes of counters by device bucket and two-letter country | 90 days |
| `trk:ref:<day>:<host>` | Referrer **hostname** only — never the full URL | 90 days |

Six writes and six expiries per page view, issued together in a single `Promise.all` — about
twelve commands, which is why the free tier below is not a concern at any traffic this site will
see. If the write fails the endpoint still answers `200` with `{counted:false}`, so a visitor's
page is never held up by our plumbing.

**What is received and deliberately not stored:** the browser's language tag, the full referring
URL, and the query string. Paths are normalised before storage, so a crafted address cannot be
written into the dashboard as a page name.

The day-rotating salt is what makes the promise on `/privacy` true rather than rhetorical. The
visit hash is computed from the address **and** the user-agent string **and** that day's salt —
but the salt is destroyed within a day, so the inputs no longer exist and the hash cannot be
recomputed, matched, or joined to activity on any other day. Neither the address nor the
user-agent string is ever written to the store: they are inputs to a one-way function, not
records. There is no cookie, no `localStorage` and no device identifier anywhere in the pipeline.

---

## 4 · The dashboard password

```bash
openssl rand -hex 32
```

Set the output as `ADMIN_TOKEN`. Then open `/admin`, paste it once — it is held in
`sessionStorage` for that tab and never sent anywhere but `/api/stats`.

**What guards it.** `/api/stats` requires the bearer token, compares it with `timingSafeEqual` so a
wrong guess learns nothing from response timing, and returns aggregates only. `/admin` also sends
`X-Robots-Tag: noindex` and `no-store` and is disallowed in `robots.txt`, but treat that as hygiene
rather than security. **If `ADMIN_TOKEN` is unset the endpoint refuses to answer** rather than
defaulting open — an unconfigured deployment does not leak its visitor counts.

The dashboard is a private operations view. It is not part of the public site, is not linked from
any page, and should not be.

---

## 5 · Verify the deployment

### 5.1 The pages

```bash
for p in / /company /work /lab /source /about /contact /privacy /admin; do
  printf '%-12s %s\n' "$p" "$(curl -so /dev/null -w '%{http_code}' "https://YOUR-DOMAIN$p")"
done
```

Expect `200` for the first eight. `/admin` returns `200` too — it is a page that asks for a token,
not a route the host blocks.

### 5.2 The headers

```bash
curl -sI https://YOUR-DOMAIN/ | grep -iE 'content-security|strict-transport|x-content|referrer|permissions'
```

Confirm `script-src 'self'` with no `unsafe-inline` and no `unsafe-eval`. `style-src` **will** show
`'unsafe-inline'`; that is deliberate and explained in `README.md`.

### 5.3 Every contact outcome, and what each means

There is no endpoint of this site's involved any more, so there is no `kind` code to branch on —
what the visitor sees is the status line, and that is the contract:

| What the page says | What happened | What to do |
|---|---|---|
| `Sent. Your enquiry went through EmailJS…` | The notification answered 200 | Check the inbox, including spam, then the template's `to_email` wiring (§2.2) |
| `Sent. … an acknowledgement is on its way…` | Both sends answered 200 | Check your inbox and the visitor's; the auto-reply's **To email** must be `{{email}}` (§2.2) |
| `Sent. … the acknowledgement could not be sent.` | The notification arrived; the second send was refused | The enquiry is safe. Check `auto_reply_template_id`, the auto-reply's To field, and whether reCAPTCHA is enabled on that template |
| `Sent.` with no mail ever arriving | The honeypot was filled — a bot, or a password manager that fills hidden fields | By design. The check runs in the browser now, so nothing reached the provider at all |
| `Mail is not wired up yet — …emailjs-config.js` | A placeholder survived the paste | §2.3. No request was fired; the refusal is honest by construction |
| `EmailJS refused the message (HTTP 400)` | A wrong id, or a template that does not exist | Its own sentence is quoted after the colon; fix the id in the config file |
| `… (HTTP 429)` or `(HTTP 402)` | EmailJS quota or rate limit spent | Wait or raise the plan; set the monthly cap (§2.3) so a spam wave cannot consume it silently |
| `Could not reach the mail service.` | The fetch itself failed — offline, DNS, or CSP | The CSP must list `https://api.emailjs.com` in `connect-src`; `vercel.json` does. On another host, mirror that header |
| `The configured mail endpoint is not one this site is allowed to post to` | Someone edited `endpoint` in the config to an outside origin | Revert it to the EmailJS URL or a same-origin path |

The remaining endpoints still use the old shape — `{ ok:false, kind, error }`, where **`kind` is the
machine-readable code and `error` is the sentence a human reads**: `/api/track` answers
`400 bad_json` or `200 {"ok":true,"counted":true|false}`, and `/api/stats` answers
`401 unauthorised`, `503 not_configured` (no `ADMIN_TOKEN` set), `503 store_missing` (no Redis),
or `502 store_error`. `/api/track` never fails a visitor's page: an unconfigured or unreachable
store returns `counted:false` with a 200, which is why a broken analytics setup cannot break the
site. `/api/contact` is gone — POSTing there answers 404 `no_route` with a line saying the form
sends through EmailJS now, which is a better landing for an old bookmark than a silent removal.

### 5.4 Tracking

Open two or three pages, wait a few seconds, then look at `/admin`. Counts should appear within
about ten seconds — the beacon waits for `requestIdleCallback` and the writes are batched.

If nothing appears: check the browser console for a blocked request (a CSP or an extension will do
it), confirm DNT/GPC is off in that browser, and confirm you are not viewing `/admin` itself, which
is excluded from counting.

### 5.5 The gates, on the deployed build

```bash
npm run check:links      # 1,529 internal references, resolved through vercel.json's rewrites
npm run test:live        # BASE=https://YOUR-DOMAIN — the real handlers, in a browser
npm run audit            # 30 pages under the production CSP
npm run quality          # canvas, motion, layout stability, filter integrity
```

`npm run test:live` is the one to run first after a deploy: it exercises what a visitor
actually does. Point it at the deployment with `BASE=https://your-domain npm run test:live`. It
asserts the delivery branch when mail is configured and the honest-refusal branch when it is not,
so it is a valid check in both states rather than only after the secrets are set.

### 5.6 The content gates

```bash
npm run verify:content   # every claim re-checked against the live GitHub API
npm run audit            # 29 structural/accessibility checks
npm run perf             # LCP/CLS sweeps across viewports
npm run quality          # canvas, motion, layout-stability and filter integrity
```

These read `site/`, so they run against the deployed output as faithfully as against the local
build.

---

## 6 · When it goes wrong

### 6.1 The build

| Symptom | Cause | Fix |
|---|---|---|
| `No Output Directory named "site"` | Vercel ignored `vercel.json` | Settings → General → set Output Directory to `site` manually |
| Build tries to install dependencies | Framework preset guessed wrong | Set preset to **Other** |
| A page 404s but exists locally | Wrong case in the path | Vercel's filesystem is case-sensitive; Linux is too, macOS is not — this bug hides on a Mac |
| A page renders but nothing on it responds | An inline `<script>` — the CSP blocks it | `script-src 'self'` admits no inline script and no `eval`. Put the code in `site/assets/js/` and load it with `<script src>`; the dashboard's own script is built that way (`assets/js/bx-admin.js`) for exactly this reason |

### 6.2 The functions

| Symptom | Cause | Fix |
|---|---|---|
| The deployed form still says "not wired" after you edited the config | The commit or the deploy missed the file — the config ships inside `site/`, it is not an environment variable | Confirm `site/assets/js/emailjs-config.js` on the deployed build, then redeploy |
| The form says `Could not reach the mail service` | `connect-src` on the host is missing `https://api.emailjs.com` | §5.3. `vercel.json` carries it; a different host needs the same allowance |
| Mail never arrives although the page says `Sent` | The template's To field, or the mailbox was never Activated | §2.1–2.2, then EmailJS's own log (Activity) has the provider's answer |
| The dashboard says the store is missing | No KV variables reached the function | §3, then redeploy |
| `/api/stats` returns 401 to a token that works locally | `ADMIN_TOKEN` differs between environments | Re-copy it; both are compared exactly, byte for byte |

### 6.3 Reading a failure without leaking it

The two server functions never echo an upstream error. When something fails there, the detail is in
**Vercel → your project → Logs → Functions**; the browser sees only a short `kind` plus a plain
sentence. This is the intended split: enough to debug from the log, nothing useful to an attacker
who only has the response.

The contact path inverts that, on purpose: there is no server to log, so EmailJS's own answer is
quoted to the visitor verbatim — status code and its sentence. There is nothing to leak doing it:
the only credential in the request is the public key, and the provider's rejection text names
template ids, not secrets. The full history of sends is in **EmailJS → Activity**, which is the log
this design has instead of function logs.

Server-side keys (KV, `ADMIN_TOKEN`) are never logged. If you find one in a log line, rotate it — a
screenshot of a log is a credential leak.

---

## 7 · What is not deployed, and why that is fine

Two things described in `docs/architecture.md` are deliberately unbuilt: the cached GitHub
ingestion service, and the Gemini-backed assistant. Both are specified in full, and both are
withheld until the credentials and cost controls in spec §16 are settled. The reason is the rule
this whole project runs on — publishing a claim you cannot verify, or a service you cannot bound
the cost of, is worse than not having it.

What ships instead is honest: the assistant is a deterministic retriever over the verified records
that are already on the page, it makes no network request at all, and `/privacy` says so in those
words. When the Gemini endpoint is built, that page changes in the same commit.

---

## 8 · Costs at realistic traffic

| Service | Free tier | This site's usage |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth/month | A 744 KB full load; tens of thousands of page views |
| EmailJS | 200 emails/month | Two per enquiry when the acknowledgement is on — 100 enquiries/month; a bot is stopped by the honeypot before it counts |
| Upstash / Vercel KV | 500,000 commands/month | ~12 commands per page view |

A site of this size on this stack costs nothing until it is genuinely popular. The one number to
watch is the EmailJS monthly ceiling if the form is ever hit by a spam wave — the honeypot runs in
the browser, so caught bots never touch the quota, and the cap in Account → Limits (§2.3) bounds
whatever slips through. The per-address rate limit the old server endpoint enforced is gone; the cap
replaces it. If the form ever becomes a target worth real money, the fix is the reCAPTCHA toggle in
§2.3, not a new server.
