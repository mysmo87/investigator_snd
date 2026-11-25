# Agentic AI: Cleared for Takeoff

Interactive touchscreen kiosk for the GDRFA booth at GITEX 2026. Visitors answer three questions (role, AI experience, interests). Claude, Anthropic's model, then picks real courses for their level from a curated catalogue and lays them out as a Discover → Learn → Practice → Innovate journey. Visitors leave with an Agentic AI Passport whose QR code opens their course list on their phone. If they agree, the passport is also saved with GDRFA, so the same QR code opens the saved passport later.

```
cleared-for-takeoff/
  public/                 static kiosk (no build step)
    index.html, styles.css, app.js
    fekra.js, fekra.css   Fekra, the innovation assistant page
    journey.html/.js/.css phone page opened from the passport QR code
    staff.html/.js        GDRFA staff list of saved passports (CSV export)
    data/content.js       tracks, demos, sessions, news, journey rules  ← edit content here
    data/catalog.js       the course catalogue Claude may choose from   ← edit courses here
    shared/journey-rules.js  offline recommender + validator (browser and server)
    shared/globe-land.js  land mask for the Home globe (from Natural Earth, public domain)
    fonts/                Inter, self-hosted (SIL Open Font License, see Inter-OFL.txt)
  server/                 Node.js API + static server (one dependency: @anthropic-ai/sdk)
  scripts/check.js        content integrity check
  test/                   node:test suites (no network or API key needed)
  railway.json            Railway build/deploy settings
```

## How the recommendations work

1. The kiosk sends only the three answers, as enum ids, to `POST /api/recommend`. A list of which sessions are live or finished is sent with them. **Name, email and photo never leave the kiosk.**
2. The server calls Claude (default model `claude-opus-5-5`, effort `low`) with:
   - **A cached system prompt.** It holds the rules, all 37 courses, the tracks, demos and sessions (about 6k tokens), cached with prompt caching.
   - **Structured outputs.** A JSON schema whose course, track, demo and session fields are **enums of the catalogue ids**, so Claude can only choose real items.
   - **Server-side refusal fallback** (`fallbacks: "default"`).
3. Every answer is validated again against the catalogue (`sanitizePlan`):
   - no unknown ids;
   - no course two levels away from the visitor;
   - no duplicates;
   - no finished sessions;
   - all four stages present.
   Anything that fails a check is repaired using the offline rules.
4. On a timeout, rate limit, refusal or outage, or with no API key, the deterministic offline rules build the journey instead. The kiosk never shows an error. The journey screen tells the visitor which source was used.
5. Results are cached per profile (6 h by default). Calls are capped per hour (`AI_MAX_CALLS_PER_HOUR`), and the API is skipped for 60 s after three consecutive failures.

The booth chat assistant is rule-based. It answers from `content.js` and the catalogue, so it also works without a connection. The course recommender and Fekra (below) are the only parts that call Claude.

## Fekra (فكرة): the autonomous proposal builder

Fekra turns an employee's idea into a management-ready innovation proposal. **The employee explains the idea; Fekra does the heavy lifting; the employee reviews and approves.** Open it from **Fekra | Submit a Proposal** on Home. It works in English and Arabic (right-to-left).

- **Natural conversation (`POST /api/fekra/chat`):** Fekra discusses the idea like a consultant and asks at most one or two high-value questions, only when the answer would materially change the proposal. Everything else it infers, researches, or records as an assumption to confirm.
- **Autonomous proposal (`POST /api/fekra/update`):** after every exchange Fekra rebuilds a structured proposal in the background:
  - idea overview (title, executive summary, solution, scope);
  - problem statement (current situation, problem, why it matters, who is affected, if unresolved);
  - customer benefits and GDRFA benefits as separate lists, each with reasoning, a suggested KPI and how to measure it;
  - technology stack (role, why needed, dependencies, considerations) and an illustrative architecture;
  - implementation roadmap (discovery, proof of concept, pilot, evaluation, rollout) with dependencies and risks;
  - assumptions and open questions.
  Each item is labelled by where it came from: **from you**, **assumption**, **verified research** or **Fekra's recommendation**, plus **needs validation** for expected benefits. The prompt forbids invented GDRFA facts and invented figures.
  The **Live proposal** panel shows each section as it fills in.
- **Existing-implementation assessment (`POST /api/fekra/check`):**
  - **Automatic:** research starts on its own once the idea is clear, and runs again if the idea changes substantially. An employee can also ask for more research with a specific focus.
  - **Sources:** it uses Anthropic's web search. Only URLs that the search actually returned can be cited, and GDRFA's own initiatives are listed separately from other organisations'.
  - **Result:** Already Implemented, Partially Implemented, Not Identified as Implemented, or Unable to Verify. It stays "provisional" until research has run.
  - **Scope:** internal GDRFA systems are not searched, and the assessment says so.
- **Review and approval:** when the draft is complete enough, Fekra offers a review. On the full proposal the employee can:
  - approve sections;
  - edit any section;
  - ask Fekra to improve a section;
  - confirm or correct assumptions;
  - request more research;
  - regenerate the proposal;
  - approve the whole proposal.

  **Approved sections never change silently.** If a later update would change one, the server keeps the approved text and shows the change as a suggestion to accept or dismiss.
- **Status:** Draft, Under review (the employee is reviewing it), Finalized (approved by the employee).
- **Saving (`/api/fekra/proposals`):**
  - **Storage:** proposals are saved on the server as JSON files in `FEKRA_STORE_DIR`, one per proposal, with every earlier version kept. Saving from two places at once is refused rather than overwriting.
  - **Reopening:** each proposal gets a reference (`FK-yymmdd-XXXX`) and a private 12-character access code, which is stored only as a hash. It can be reopened with the reference and code, or by scanning the QR link shown when saving.
  - **Autosave:** once a proposal has been saved, later changes are saved automatically.
  - **Ownership:** the app has no employee login of its own. Behind GDRFA single sign-on, set `FEKRA_IDENTITY_HEADER` to the header the identity proxy sets. The signed-in user then becomes the owner, nobody else can open the proposal even with its code, and `GET /api/fekra/proposals` lists the user's own proposals. Only set it when the proxy controls that header.
- **PDF ("Generate Proposal PDF"):**
  - **Format:** a downloadable A4 PDF with GDRFA branding, the reference, date, status and page numbers.
  - **Content:**
    - the executive summary, problem statement and assessment with its sources;
    - customer and GDRFA benefits and the technology table;
    - the roadmap, risks and assumptions with validation items;
    - the research references as clickable links.
  - **How it is built:** pages are laid out in the browser (`public/fekra-pdf.js`) so Arabic shaping and right-to-left order are correct, then written into a real PDF file without libraries. The PDF holds the latest saved content: unsaved changes are saved first. Its text is part of the page images, so it is not selectable.
- **Submission (`POST /api/fekra/submit`)** forwards the proposal to `FEKRA_SUBMIT_URL` when configured; otherwise the page says submission is not connected and that nothing was sent.
- **Without an API key** the page says the AI service isn't connected and disables input; it never shows canned answers.

## Saved passports: capturing visitor details

When a visitor creates their passport, the form offers **"Save my passport so I can open it again later"**. The box is unticked by default; it tells the visitor exactly what is kept, for how long, that the booth team can see it, and that they can delete it.

- **What happens when they tick it:**
  - The kiosk saves the passport on the server: name, email, organization, the learning journey, the session they attended, the time and wording of their consent, and the passport image itself (JPEG, with their photo or avatar).
  - The passport number (`CFT-XXXXX`) becomes the saved reference, and the server returns a private 12-character key.
  - The QR code then carries both, so scanning it opens the saved passport on the visitor's phone: the passport image with **Save passport image** (and **Share** where the phone supports it), the whole journey with course links, and **Delete my saved passport**.
  - Visitors keep it by bookmarking the page or adding it to their home screen. Editing the passport at the kiosk updates the saved copy. Unticking the box deletes it.
- **If they don't tick it:** nothing changes from before. Details stay in the kiosk's memory and are cleared on reset, and the QR code opens the course list only.
- **The link still works without the saved copy:** the course list is also in the link itself, so an expired or deleted passport falls back to it.
- **Privacy and security:**
  - The key travels only in the URL fragment, so it never reaches the server's or Railway's access logs. Only a SHA-256 hash of it is stored.
  - The email is never printed on the passport or put in the QR code.
- **Retention:** each saved passport is deleted automatically after `PASSPORT_RETENTION_DAYS` (default 180). The server checks every hour.
- **Staff access:** open `/staff.html` and enter the staff key (`PASSPORT_ADMIN_TOKEN`). It lists every saved passport (passport number, time, name, email, organization, track, level, attended session, deletion date) with a filter and **Download CSV (Excel)**. The same data is available at `GET /api/passports/export?format=csv` with `Authorization: Bearer <PASSPORT_ADMIN_TOKEN>`. Without the variable, staff access is off.
- **Saving mode:** by default (`PASSPORT_SAVE=always`) every passport is saved, with no checkbox; the form shows a notice explaining what is kept and for how long, as approved by GDRFA. `optional` brings back the "Save my passport" checkbox, `required` makes ticking it a condition of creating a passport, and `off` never saves.
- **Persistence:** saved passports are files on the server. **On Railway, attach a volume and set `DATA_DIR`**, or they are lost on every deploy. The staff page shows a warning while storage is temporary.

## Interaction counts (staff page)

The staff page (`/staff.html`) opens with an **Interactions** section above the saved passports. It shows anonymous counts that are kept even when a visitor deletes their passport, or when a passport expires after 180 days:

- **Counted:** learning journeys created, passports created, passports deleted by visitors, AI 3D avatars created, big-screen moments, sessions marked as attended, and Fekra proposals saved.
- **Shown:** each count all-time and for today (`EVENT_TIMEZONE`, Dubai by default), the share of journeys that ended in a passport, and breakdowns by track, level, role, avatar type and "recommended by". There's also a table per day. **Download interactions CSV** exports every event with its time, in Dubai time.
- **No personal data:** events never hold a name, email, organization, photo, passport number or IP address. They hold only the event type, the time and whitelisted values such as track or level. They're stored as one append-only file, `interactions.jsonl`, under `DATA_DIR` (or `INTERACTIONS_DIR`), and the app never deletes them.
- **Where events come from:** the server records passports created and deleted, AI avatars and Fekra saves itself. The kiosk sends journeys, big-screen moments and attended sessions to `POST /api/events`, which accepts only those types, from the same origin, under the usual rate limit.

## AI 3D Traveler avatar (fal.ai)

With `FAL_KEY` set, the passport's "Choose your avatar" step gets a fourth tab, **AI 3D Traveler**, next to Select avatar, Upload photo and Use camera.

- **Flow:** the visitor sees a notice that their photo goes to an external AI service (no checkbox, as approved by GDRFA), takes a selfie or uploads a photo, then taps **Create my 3D traveler**. About 15 seconds later, the stylised 3D "digital traveler" becomes their avatar. It is used on the passport image, the download and the big-screen welcome.
- **What is sent:** only the 512 px photo, and only when the visitor taps **Create**. The server forwards it to fal (`AVATAR_AI_MODEL`, default FLUX Kontext Pro) with `sync_mode`, so fal returns the image inline and does not keep it in its request history. The server stores neither the photo nor the result. The result is kept only in the kiosk's memory, unless the visitor saves their passport (the passport image then includes it, as with any photo).
- **Cost and limits:** each generation is billed by fal (about $0.04 with FLUX Kontext Pro). It is never resubmitted automatically. `AVATAR_AI_MAX_CALLS_PER_HOUR` and `AVATAR_AI_MAX_CONCURRENT` cap spend and load, on top of the per-IP rate limit. A 403 "Exhausted balance" from fal shows the visitor "out of credits", and they can pick another option.
- **Turning it off:** remove `FAL_KEY` or set `AVATAR_AI_ENABLED=false`. The tab disappears and the other three options work as before.

## Live news ticker

The ticker across the top shows real headlines from the publishers' own RSS feeds. The server reads the feeds itself (`server/news.js`), so browsers hit no cross-origin limits.

- **Refresh:** every 30 minutes (`NEWS_REFRESH_MINUTES`). The kiosk asks the server for the current result every 10 minutes.
- **Relevance:** only Future Radar themes are kept: AI, generative and agentic AI, digital government, smart borders and immigration, digital identity and biometrics, smart airports, autonomous systems and emerging technology. Sport, entertainment, celebrity, shopping and political news are dropped. General news outlets must match in the headline itself. The rules cover English and Arabic.
- **Mix:** UAE government and local innovation 40%, AI 25%, borders and identity 20%, global trends 15%. These are targets, not quotas: a theme that falls short gives its slots to other relevant headlines, never to unrelated news. Each publisher is capped at about a third of the list.
- **Recency:** headlines from the last 7 days come first. The window widens to 30 days only when there are fewer than 12.
- **No invented content:**
  - Every headline, link and date comes from a feed.
  - Items without a valid date, or with a link outside the publisher's own domain, are dropped.
  - Duplicates and near-identical headlines are removed.
  - A headline whose link returns 404 is removed.
- **Fallback:** when a source fails, its last verified headlines stay. When every source fails, the last good result is served from a disk cache (`NEWS_CACHE_FILE`), and the ticker shows "Cached headlines · last update …". With no live or cached headlines at all, the curated sample headlines in `content.js` appear, labelled as samples.
- **Ticker display:** category, headline, publisher and date. Each headline opens the article in a new tab, and Arabic headlines render right-to-left.
- **Sources:** configured in `server/news-sources.js`, or replace the list with `NEWS_SOURCES_FILE`. `GET /api/news/sources` shows each source's status, feeds, HTTP results and how many headlines it supplied.

| Source | Status (November 2026) |
|---|---|
| Khaleej Times | Live: UAE, business, top and world feeds |
| Arabian Business | Live |
| Gulf News | Live (its public feed carries only a few top stories) |
| MIT Technology Review, TechCrunch (AI and main feeds), Biometric Update, Future Travel Experience | Live |
| GDRFA Dubai, Dubai Media Office, Digital Dubai, UAE Government Portal | Needs configuration: no RSS feed is published or linked on these sites. Add an official feed or API URL in `news-sources.js` and set `enabled: true`. |
| WAM (English and Arabic) | Needs configuration: no public feed. WAM's news service is for subscribers, so add the licensed feed URL. |
| World Economic Forum | Needs configuration: no feed published (`/stories/feed` returns 404). |
| Reuters | Needs a licence: there is no public Reuters feed. Add a licensed feed (for example Reuters Connect) when available. |

Only headlines, links, publisher names and dates are used. No article text is stored or shown, every headline links to the publisher, and feeds are requested at most every 30 minutes, with conditional requests.

## Learning Flight Map (prototype)

`public/flight-map.html` is a 3D prototype of the learning agent at work. Open it at `/flight-map.html`.
- **The map:** the 30 catalogue courses appear as stars. They are grouped into one constellation per learning track and raised by level (FL100 Beginner, FL200 Intermediate, FL300 Advanced).
- **Planning:** the visitor answers the same three questions. The agent then visibly scans, filters, weighs and plots a four-waypoint route.
- **Steering:** time per course, free only, prefer hands-on, and adding a course. Each change makes the agent re-plan, and the waypoints that changed are highlighted.
- **Explanations:** tapping any star shows the agent's reason for picking it or filtering it out.
- **Takeoff:** *Cleared for takeoff* flies the route with a chase camera. After 60 s without input the page demonstrates itself.
- **Planner:** the prototype plans on the device with the shared rules (`buildRulesPlan` with steering options). Connecting it to Claude means passing the same options to `/api/recommend`.
- **three.js:** loaded from `public/vendor/three.min.js`, a tree-shaken bundle of three.js r187 (MIT), so it works offline under the CSP. See `scripts/build-three.md`.

## Run locally

```bash
cd cleared-for-takeoff
npm ci
cp .env.example .env          # add ANTHROPIC_API_KEY (optional: without it, offline rules are used)
node --env-file=.env server/index.js
# open http://localhost:3000
npm test                      # unit + HTTP tests with a fake Anthropic client (no key or network needed)
npm run check                 # validates content + catalogue
```

`public/index.html` also works opened straight from disk. It then uses the offline rules, and passport QR codes point to a placeholder address.

## Deploy on Railway

1. **New Project → Deploy from GitHub repo** → choose this repository.
2. Under **Service → Settings**:
   - **Root Directory:** leave it empty. The repository root is an npm workspace containing `cleared-for-takeoff`, and the root `railway.json` holds the start command and health check, so no other build settings are needed.
   - **Networking → Generate Domain**, or add your custom domain.
3. Under **Service → Variables**, add at least `ANTHROPIC_API_KEY`; the full list is in the next section.
4. Deploy. Railpack detects Node from the root `package.json`, runs `npm ci`, starts with `npm start` and waits for `GET /api/health`. If the content files are invalid the server refuses to start, so a bad edit never replaces a working deployment.

Setting **Root Directory** to `cleared-for-takeoff` also works; the app folder has its own `package.json`, lockfile and `railway.json`.

### Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes, for AI** | — | Claude API key (mark it as a secret). Without it the kiosk runs on the offline rules. |
| `PUBLIC_BASE_URL` | Recommended | page URL | Base URL put in passport QR codes, e.g. `https://takeoff.example.ae`. Set it if you use a custom domain. |
| `SCHEDULE_MODE` | Recommended on event day | `relative` | `relative` builds a demo schedule around "now"; `fixed` uses each session's `time` in `content.js`. |
| `EVENT_TIMEZONE` | No | `Asia/Dubai` | Time zone for fixed session times and the on-screen clock. |
| `ANTHROPIC_MODEL` | No | `claude-opus-5-5` | Model used by the recommender. |
| `AI_EFFORT` | No | `low` | `low`, `medium`, `high`, `xhigh` or `max`. Higher means slower and more expensive per journey. |
| `AI_TIMEOUT_MS` | No | `20000` | After this, the offline rules are used. |
| `AI_MAX_CALLS_PER_HOUR` | No | `500` | Spend guard. Cached profiles do not count. |
| `AI_FALLBACKS` | No | `default` | Server-side refusal fallback (`default` or `off`). |
| `AI_ENABLED` | No | `true` | Kill switch that keeps the key in place. |
| `AI_CACHE_TTL_MINUTES` / `AI_CACHE_MAX_ENTRIES` | No | `360` / `1000` | Recommendation cache. |
| `AI_MAX_TOKENS` | No | `8000` | Output cap per call. |
| `RATE_LIMIT_PER_MINUTE` | No | `30` | Per client IP. All kiosks behind one venue IP share this limit. |
| `IDLE_WARN_SECONDS` / `IDLE_RESET_SECONDS` | No | `75` / `90` | Kiosk inactivity warning and auto-reset. |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn` or `error` (JSON lines). |
| `TRUST_PROXY` | No | `true` on Railway | Use `X-Forwarded-*` headers for client IP and HTTPS. |
| `FEKRA_ENABLED` | No | `true` | Turns the Fekra assistant on or off (it also needs `ANTHROPIC_API_KEY`). |
| `FEKRA_MODEL` | No | `ANTHROPIC_MODEL` | Model used by Fekra. |
| `FEKRA_CHAT_EFFORT` / `FEKRA_UPDATE_EFFORT` / `FEKRA_EFFORT` | No | `low` / `low` / `medium` | Effort for conversation turns / background proposal updates / research and full regeneration. |
| `FEKRA_WEB_SEARCH` | No | `true` | Live web research for the innovation check. Web search must also be allowed for your organisation in the Claude Console. |
| `FEKRA_MAX_SEARCHES` | No | `6` | Web searches per innovation check. |
| `FEKRA_TIMEOUT_MS` | No | `150000` | Timeout per Claude call (research can take a minute or two). |
| `FEKRA_MAX_CALLS_PER_HOUR` | No | `300` | Spend guard for Fekra (an innovation check counts as 2). |
| `FEKRA_IDLE_RESET_SECONDS` | No | `600` | Inactivity reset while an idea is in progress. |
| `DATA_DIR` | **Recommended** | system temp dir | One persistent folder for everything the app saves: proposals go in `DATA_DIR/fekra`, passports in `DATA_DIR/passports`. **On Railway, attach a volume (for example at `/data`) and set `DATA_DIR=/data`**; otherwise saved proposals and passports are lost on the next deploy. |
| `PASSPORT_SAVE` | No | `always` | `always`: every passport is saved, with no checkbox; the visitor sees a notice saying so (approved by GDRFA). `optional`: visitors may tick "Save my passport". `required`: they must tick it to create a passport. `off`: passports are never saved. |
| `PASSPORT_RETENTION_DAYS` | No | `180` | Saved passports are deleted automatically after this many days. |
| `PASSPORT_ADMIN_TOKEN` | For staff access | — | Staff key for `/staff.html` and the CSV export. At least 20 random characters; mark it as a secret. Without it, nobody can list saved passports. |
| `PASSPORT_STORE_DIR` | No | `DATA_DIR/passports` | Overrides the passports folder. |
| `FEKRA_STORE_DIR` | No | `DATA_DIR/fekra` | Overrides the saved-proposals folder. |
| `FEKRA_IDENTITY_HEADER` | No | — | Header set by GDRFA single sign-on (for example `x-ms-client-principal-name`). When set, proposals belong to the signed-in user. Only use it behind a proxy that controls this header. |
| `FEKRA_SUBMIT_URL` | No | — | Management review endpoint that receives submitted proposals. Without it, submission reports "not connected". |
| `FEKRA_SUBMIT_TOKEN` | No | — | Bearer token sent to `FEKRA_SUBMIT_URL` (mark it as a secret). |
| `FAL_KEY` | For the AI avatar | — | fal.ai API key. Turns on the **AI 3D Traveler** avatar tab. Mark it as a secret. Without it, the tab is hidden. |
| `AVATAR_AI_ENABLED` | No | `true` | Kill switch for the AI avatar without removing the key. |
| `AVATAR_AI_MODEL` | No | `fal-ai/flux-pro/kontext` | fal endpoint id for the avatar. |
| `AVATAR_AI_TIMEOUT_MS` | No | `60000` | Timeout per avatar generation. |
| `AVATAR_AI_MAX_CALLS_PER_HOUR` | No | `200` | Spend guard for the AI avatar. |
| `AVATAR_AI_MAX_CONCURRENT` | No | `4` | Avatar generations running at the same time. |
| `INTERACTIONS_DIR` | No | `DATA_DIR/interactions` | Folder for the anonymous interaction log. |
| `NEWS_ENABLED` | No | `true` | Live news in the ticker. When off, the curated sample headlines show. |
| `NEWS_REFRESH_MINUTES` | No | `30` | How often the server reads the feeds. |
| `NEWS_MAX_ITEMS` | No | `30` | Headlines in the ticker loop. |
| `NEWS_TIMEOUT_MS` | No | `12000` | Timeout per feed request. |
| `NEWS_VERIFY_LINKS` | No | `true` | Check each shown headline's link once a day and drop links that return 404. |
| `NEWS_CACHE_FILE` | No | system temp dir | Where the last good headlines are kept for restarts and outages. |
| `NEWS_SOURCES_FILE` | No | — | A JSON file that replaces the source list in `server/news-sources.js`. |
| `PORT` | — | set by Railway | Do not set this on Railway. |

`GET /api/health` reports the model, cache size and calls used this hour. Logs record each recommendation's source, latency and token usage, including cache reads. They never contain visitor data.

## Before going live

- **Content:**
  - Replace the sample news and sessions in `public/data/content.js` with approved content.
  - Then set `meta.newsIsSample`, `meta.sessionsAreSample` and `meta.demosAreIllustrative` to `false`; this removes the "sample" labels on screen.
  - Set `SCHEDULE_MODE=fixed`.
- **Course catalogue** (`public/data/catalog.js`, 37 courses from 17 providers):
  - It includes seven free SAS Learning courses (trustworthy AI, agentic AI, generative AI, data literacy, visual analytics and data science), checked on learn.sas.com on 22 November 2026. They are marked `verifiedOn`. Each is listed under SAS's "Price: Free" catalogue filter or as a "FREE COURSE" on SAS's free-training page, and opens without signing in. SAS's own level is kept in `providerLevel`; `level` is the kiosk's fit after reading SAS's prerequisites.
  - Recommendations stay vendor-neutral: courses are chosen on fit, a journey uses at most two courses from any one provider, and a stage prefers two different providers.
  - Links, prices and durations change. Re-check every entry before the event and update `reviewedOn`.
  - Some links, including the Anthropic Academy and Cisco ones, were confirmed only through search results, not by opening the page.
  - To add a course, give it a new `id` and the next free `ref`. Never renumber a `ref`: passport QR codes that are already printed use them.
- **Kiosk device:**
  - Serve over HTTPS (Railway does this); the camera needs HTTPS or localhost.
  - Run Chrome in kiosk mode, e.g. `chrome --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 https://your-domain/`.
- **Anthropic Console:** set a monthly spend limit on the workspace that holds the key.
- **Saved passports:**
  - Attach a Railway volume and set `DATA_DIR`.
  - Set `PASSPORT_ADMIN_TOKEN` to a long random value and give it only to the booth team.
  - Have GDRFA's data-protection team approve the consent wording on the passport form (`consentBody()` in `public/app.js`) and the retention period.
  - Saving is automatic (`PASSPORT_SAVE=always`), as approved by GDRFA. Keep the on-screen notice in step with what is actually stored.
- **AI 3D Traveler avatar:**
  - Have GDRFA's data-protection team approve sending visitor photos to fal.ai, and the notice wording in the AI tab (`renderAiPanel()` in `public/app.js`).
  - Add credits to the fal account and set a spend limit there.
- **Fekra:**
  - Confirm with your data-governance team that employees may send idea descriptions to Claude. The page asks them not to share personal or classified information.
  - Connect the management review system with `FEKRA_SUBMIT_URL` (and `FEKRA_SUBMIT_TOKEN`).
  - Give saved proposals persistent storage: attach a Railway volume and set `DATA_DIR` to it. For named ownership, put the site behind GDRFA single sign-on and set `FEKRA_IDENTITY_HEADER`.
  - Fekra does not see internal GDRFA projects. The innovation check searches only the public web, and its limitations say so.

## Security notes

- The recommender accepts only enum values and a 4 KB JSON body; visitor names and photos never reach the model.
- Fekra sends the employee's conversation (up to 256 KB per request) to Claude. The page says so. AI requests are not stored; the server logs only operation, model, latency and token counts. A proposal is stored only when the employee saves it, and opening it needs its access code (stored as a hash), plus the owner's sign-in when `FEKRA_IDENTITY_HEADER` is set.
- All API routes reject cross-origin POSTs and rate-limit per IP. The API key and `FEKRA_SUBMIT_TOKEN` stay on the server.
- Strict Content-Security-Policy (`script-src 'self'`), no inline scripts, HSTS behind HTTPS, and `Permissions-Policy` limiting the camera to this origin. Visitor data is never put in browser storage.
- A visitor's details are stored on the server only when they tick "Save my passport". Only known fields are kept, track and course titles come from the booth's own content, and the image must be a JPEG under 1.5 MB.
  - Opening, changing or deleting a saved passport needs its key, which is stored only as a hash.
  - Listing them needs `PASSPORT_ADMIN_TOKEN`, compared in constant time. Failed attempts are logged and rate-limited.
  - CSV cells that start with `=`, `+`, `-` or `@` are neutralised so a name cannot run as a spreadsheet formula.
- The AI avatar sends the visitor's photo to fal.ai only when they tap **Create**, after an on-screen notice. `POST /api/avatar` requires `consent: true`, accepts only a JPEG, PNG or WebP data URI under 1 MB, and stores nothing. `FAL_KEY` never leaves the server. The result is returned as a data URI (a fal-hosted URL is fetched by the server first), so the page's CSP stays unchanged.
- The passport QR code contains, in the URL fragment (never sent to the server), a journey code, track, level and short course codes. A saved passport's code also contains its reference and key, and anyone holding the code can open that passport. The phone page says so and sends no referrer.
