# Agentic AI: Cleared for Takeoff

Interactive touchscreen kiosk for the GDRFA booth at GITEX 2026. Visitors answer three questions (role, AI experience, interests). Claude, Anthropic's model, then picks real courses for their level from a curated catalogue and lays them out as a Discover → Learn → Practice → Innovate journey. Visitors leave with an Agentic AI Passport whose QR code opens their course list on their phone.

```
cleared-for-takeoff/
  public/                 static kiosk (no build step)
    index.html, styles.css, app.js
    journey.html/.js/.css phone page opened from the passport QR code
    data/content.js       tracks, demos, sessions, news, journey rules  ← edit content here
    data/catalog.js       the course catalogue Claude may choose from   ← edit courses here
    shared/journey-rules.js  offline recommender + validator (browser and server)
  server/                 Node.js API + static server (one dependency: @anthropic-ai/sdk)
  scripts/check.js        content integrity check
  test/                   node:test suites (no network or API key needed)
  railway.json            Railway build/deploy settings
```

## How the recommendations work

1. The kiosk sends only the three answers, as enum ids, to `POST /api/recommend`. A list of which sessions are live or finished is sent with them. **Name, email and photo never leave the kiosk.**
2. The server calls Claude (default model `claude-opus-5-5`, effort `low`) with:
   - **A cached system prompt.** It holds the rules, all 30 courses, the tracks, demos and sessions (about 6k tokens), cached with prompt caching.
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

The booth chat assistant is rule-based. It answers from `content.js` and the catalogue, so it also works without a connection. Only the course recommender calls Claude.

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
   - **Root Directory:** `/cleared-for-takeoff`
   - **Config file path:** `/cleared-for-takeoff/railway.json`. Railway does not apply the Root Directory to this path, so give the full path from the repository root.
   - **Networking → Generate Domain**, or add your custom domain.
3. Under **Service → Variables**, add at least `ANTHROPIC_API_KEY`; the full list is in the next section.
4. Deploy. Railpack detects Node from `package.json`, runs `npm ci`, starts with `npm start` and waits for `GET /api/health`. If the content files are invalid the server refuses to start, so a bad edit never replaces a working deployment.

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
| `PORT` | — | set by Railway | Do not set this on Railway. |

`GET /api/health` reports the model, cache size and calls used this hour. Logs record each recommendation's source, latency and token usage, including cache reads. They never contain visitor data.

## Before going live

- **Content:**
  - Replace the sample news and sessions in `public/data/content.js` with approved content.
  - Then set `meta.newsIsSample`, `meta.sessionsAreSample` and `meta.demosAreIllustrative` to `false`; this removes the "sample" labels on screen.
  - Set `SCHEDULE_MODE=fixed`.
- **Course catalogue** (`public/data/catalog.js`):
  - Links, prices and durations change. Re-check every entry before the event and update `reviewedOn`.
  - Some links, including the Anthropic Academy and Cisco ones, were confirmed only through search results, not by opening the page.
  - To add a course, give it a new `id` and the next free `ref`. Never renumber a `ref`: passport QR codes that are already printed use them.
- **Kiosk device:**
  - Serve over HTTPS (Railway does this); the camera needs HTTPS or localhost.
  - Run Chrome in kiosk mode, e.g. `chrome --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 https://your-domain/`.
- **Anthropic Console:** set a monthly spend limit on the workspace that holds the key.

## Security notes

- The API accepts only enum values and a 4 KB JSON body. It rejects cross-origin POSTs and rate-limits per IP. Visitor text never reaches the model.
- Strict Content-Security-Policy (`script-src 'self'`), no inline scripts, HSTS behind HTTPS, `Permissions-Policy` limiting the camera to this origin, and no storage of visitor data (no `localStorage`, no server-side records).
- The passport QR code contains only a journey code, track, level and short course codes, in the URL fragment, which is never sent to the server.
