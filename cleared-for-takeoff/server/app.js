'use strict';
/* HTTP layer: static kiosk files + a small JSON API.
     GET  /api/health     liveness/readiness for Railway health checks
     GET  /api/config     runtime settings for the kiosk (no secrets)
     POST /api/recommend  { role, experience, interests[], focusTrack?, sessions[] } -> journey plan
     POST /api/fekra/chat | update | check | submit   Fekra innovation consultant (see server/fekra.js)
     POST /api/fekra/proposals                 save a new proposal -> { ref, key }
     GET|PUT /api/fekra/proposals/FK-…         open / update a saved proposal (X-Fekra-Key header)
     GET  /api/fekra/proposals/FK-…/versions   earlier versions of a saved proposal
     GET  /api/fekra/proposals                 the signed-in user's proposals (only with FEKRA_IDENTITY_HEADER)
     GET  /api/news       live headlines for the ticker (see server/news.js)
     GET  /api/news/sources  which news sources are working, cached or need configuration
   No framework: Node's http module keeps the dependency surface small. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { cleanProposal, cleanCheck, SECTION_KEYS, SECTION_FIELDS } = require('./fekra');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const MAX_BODY = 4 * 1024;
const FEKRA_MAX_BODY = 256 * 1024; // Fekra sends the conversation with each request

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
].join('; ');

function securityHeaders(req, res, trustProxy) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (trustProxy && req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function sendJson(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data), ...extraHeaders });
  res.end(data);
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/* Fixed-window rate limiter per client IP. */
function createRateLimiter(perMinute) {
  const hits = new Map();
  const timer = setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, 60000);
  timer.unref();
  return {
    take(key) {
      const now = Date.now();
      let e = hits.get(key);
      if (!e || e.reset <= now) { e = { count: 0, reset: now + 60000 }; hits.set(key, e); }
      e.count += 1;
      return { ok: e.count <= perMinute, retryAfter: Math.ceil((e.reset - now) / 1000) };
    }
  };
}

function readJsonBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!/^application\/json\b/i.test(type)) return reject(Object.assign(new Error('Content-Type must be application/json'), { status: 415 }));
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit * 16) { req.destroy(); return; } // abusive upload: drop the connection
      if (size <= limit) chunks.push(c);              // otherwise drain so a clean 413 can be sent
    });
    req.on('end', () => {
      if (size > limit) return reject(Object.assign(new Error('Request body too large'), { status: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

/* Which build is running — Railway sets these variables on every deployment. */
const DEPLOY = {
  branch: process.env.RAILWAY_GIT_BRANCH || null,
  commit: process.env.RAILWAY_GIT_COMMIT_SHA ? process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 7) : null,
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null
};

function createApp({ config, recommender, fekra, store, news, rules, content, logger, publicDir, version }) {
  const limiter = createRateLimiter(config.rateLimitPerMinute);
  const root = path.resolve(publicDir);
  const startedAt = Date.now();

  function serveStatic(req, res, pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return sendJson(res, 400, { error: 'Bad path' }); }
    if (rel.endsWith('/')) rel += 'index.html';
    if (rel.split('/').some(seg => seg.startsWith('.'))) return notFound(res);
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) return notFound(res);
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return notFound(res);
      const ext = path.extname(file).toLowerCase();
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // Filenames are not content-hashed, so every file revalidates (cheap 304 when unchanged)
        // and a new deploy is visible on the next page load.
        'Cache-Control': 'no-cache',
        'Last-Modified': st.mtime.toUTCString()
      };
      if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) {
        res.writeHead(304, headers); return res.end();
      }
      const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && st.size > 1024;
      if (gzip) { headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; } else headers['Content-Length'] = st.size;
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
    });
  }

  function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end('Not found');
  }

  /* Browsers always send Origin on cross-site POSTs: only the kiosk's own pages may call the recommender. */
  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    const host = (config.trustProxy && req.headers['x-forwarded-host']) || req.headers.host;
    try { return new URL(origin).host === String(host).split(',')[0].trim(); } catch { return false; }
  }

  async function handleRecommend(req, res) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    const ip = clientIp(req, config.trustProxy);
    const rl = limiter.take(ip);
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
    const { profile, error } = rules.validateProfile(body, content);
    if (error) return sendJson(res, 400, { error });
    const result = await recommender.recommend(profile, body.sessions);
    sendJson(res, 200, { source: result.source, model: result.source === 'ai' ? result.model : undefined, cached: !!result.cached, plan: result.plan });
  }

  const FEKRA_OPS = { chat: 'chat', update: 'update', check: 'check', submit: 'submit' };
  async function handleFekra(req, res, op) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    const rl = limiter.take(clientIp(req, config.trustProxy));
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    let body;
    try { body = await readJsonBody(req, FEKRA_MAX_BODY); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
    if (!fekra) return sendJson(res, 503, { error: 'Fekra is not available.', reason: 'not_configured' });
    try {
      return sendJson(res, 200, await fekra[op](body));
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      return sendJson(res, status, { error: err.message && status < 500 ? err.message : 'Fekra could not complete the request.', reason: err.reason || 'error' });
    }
  }

  /* ---------- saved proposals ---------- */
  const STORE_STATUSES = ['draft', 'under_review', 'finalized'];
  const identityOf = req => { const h = config.fekra.identityHeader; const v = h ? req.headers[h] : null; return v ? String(v).slice(0, 200) : null; };
  const cleanText = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
  /* only known fields are stored, each cleaned the same way the AI endpoints clean them */
  function storeData(body) {
    const b = body && typeof body === 'object' ? body : {}, p = b.payload && typeof b.payload === 'object' ? b.payload : {};
    const proposal = cleanProposal(p.proposal);
    const messages = (Array.isArray(p.messages) ? p.messages : []).slice(-120).filter(m => m && ['user', 'assistant', 'check', 'notice'].includes(m.role))
      .map(m => m.role === 'check' ? { role: 'check', check: cleanCheck(m.check) } : { role: m.role, text: cleanText(m.text, 8000), ...(m.kind ? { kind: cleanText(m.kind, 30) } : {}) });
    const pending = {}; // suggested changes to approved sections, kept until the employee accepts or dismisses them
    if (p.pending && typeof p.pending === 'object') SECTION_KEYS.forEach(k => { if (p.pending[k] && typeof p.pending[k] === 'object') { const full = cleanProposal({ ...proposal, ...p.pending[k] }); pending[k] = Object.fromEntries(SECTION_FIELDS[k].map(f => [f, full[f]])); } });
    return {
      status: STORE_STATUSES.includes(b.status) ? b.status : 'draft', lang: b.lang === 'ar' ? 'ar' : 'en', title: proposal.title.slice(0, 300),
      payload: { proposal, check: cleanCheck(p.check), messages, locked: (Array.isArray(p.locked) ? p.locked : []).filter(k => SECTION_KEYS.includes(k)),
        confirmed: (Array.isArray(p.confirmed) ? p.confirmed : []).slice(0, 20).map(x => cleanText(x, 400)), pending, reviewOffered: !!p.reviewOffered }
    };
  }
  async function handleProposals(req, res, ref, sub) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    const rl = limiter.take(clientIp(req, config.trustProxy));
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    if (!store) return sendJson(res, 503, { error: 'Saving is not available.', reason: 'no_store' });
    const identity = identityOf(req), key = req.headers['x-fekra-key'];
    try {
      if (!ref && req.method === 'POST') { const body = await readJsonBody(req, FEKRA_MAX_BODY); return sendJson(res, 201, await store.create(storeData(body), identity)); }
      if (!ref && req.method === 'GET') return sendJson(res, 200, { proposals: await store.list(identity) });
      if (ref && sub === 'versions' && req.method === 'GET') return sendJson(res, 200, { versions: await store.versions(ref, key, identity) });
      if (ref && !sub && req.method === 'GET') return sendJson(res, 200, await store.get(ref, key, identity));
      if (ref && !sub && req.method === 'PUT') { const body = await readJsonBody(req, FEKRA_MAX_BODY); return sendJson(res, 200, await store.update(ref, key, identity, { baseVersion: body.baseVersion, data: storeData(body) })); }
      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (status >= 500) logger.error('fekra_store_failed', { detail: String(err.message).slice(0, 300) });
      return sendJson(res, status, { error: status < 500 ? err.message : 'The proposal could not be saved.', reason: err.reason || 'error' });
    }
  }

  return async function handler(req, res) {
    const started = Date.now();
    securityHeaders(req, res, config.trustProxy);
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return sendJson(res, 400, { error: 'Bad request' }); }
    res.on('finish', () => {
      if (pathname.startsWith('/api/')) logger.info('http', { method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - started });
    });
    try {
      if (pathname === '/api/health') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
        return sendJson(res, 200, { status: 'ok', version, deploy: DEPLOY, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), ai: { enabled: config.ai.enabled, model: config.ai.enabled ? config.ai.model : null, ...recommender.stats() }, fekra: fekra ? { ...fekra.status(), ...fekra.stats() } : { enabled: false }, news: news ? news.stats() : { enabled: false } });
      }
      if (pathname === '/api/config') {
        if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        return sendJson(res, 200, {
          aiEnabled: config.ai.enabled,
          aiTimeoutMs: config.ai.timeoutMs,
          publicBaseUrl: config.publicBaseUrl,
          scheduleMode: config.kiosk.scheduleMode,
          eventTimezone: config.kiosk.eventTimezone,
          idleWarnSeconds: config.kiosk.idleWarnSeconds,
          idleResetSeconds: config.kiosk.idleResetSeconds,
          fekra: { ...(fekra ? fekra.status() : { enabled: false }), idleResetSeconds: config.fekra.idleResetSeconds, storage: store ? store.status() : { available: false, persistent: false }, signIn: !!config.fekra.identityHeader },
          version
        });
      }
      if (pathname === '/api/news' || pathname === '/api/news/sources') {
        if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        if (!news) return sendJson(res, 200, { status: 'disabled', items: [] });
        const rl = limiter.take(clientIp(req, config.trustProxy));
        if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
        return sendJson(res, 200, pathname === '/api/news' ? news.snapshot() : news.sourceReport());
      }
      if (pathname === '/api/recommend') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return await handleRecommend(req, res);
      }
      const pm = /^\/api\/fekra\/proposals(?:\/(FK-[0-9A-Z-]{6,20}))?(?:\/(versions))?$/.exec(pathname);
      if (pm) return await handleProposals(req, res, pm[1] || null, pm[2] || null);
      const fm = /^\/api\/fekra\/([a-z]+)$/.exec(pathname);
      if (fm && FEKRA_OPS[fm[1]]) {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return await handleFekra(req, res, FEKRA_OPS[fm[1]]);
      }
      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
      return serveStatic(req, res, pathname);
    } catch (err) {
      logger.error('unhandled', { path: pathname, detail: String(err && err.message).slice(0, 300) });
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' }); else res.destroy();
    }
  };
}

module.exports = { createApp, CSP };
