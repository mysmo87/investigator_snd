'use strict';
/* HTTP layer: static kiosk files + a small JSON API.
     GET  /api/health     liveness/readiness for Railway health checks
     GET  /api/config     runtime settings for the kiosk (no secrets)
     POST /api/recommend  { role, experience, interests[], focusTrack?, sessions[] } -> journey plan
   No framework: Node's http module keeps the dependency surface small. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const MAX_BODY = 4 * 1024;

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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!/^application\/json\b/i.test(type)) return reject(Object.assign(new Error('Content-Type must be application/json'), { status: 415 }));
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY * 16) { req.destroy(); return; } // abusive upload: drop the connection
      if (size <= MAX_BODY) chunks.push(c);              // otherwise drain so a clean 413 can be sent
    });
    req.on('end', () => {
      if (size > MAX_BODY) return reject(Object.assign(new Error('Request body too large'), { status: 413 }));
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

function createApp({ config, recommender, rules, content, logger, publicDir, version }) {
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
        return sendJson(res, 200, { status: 'ok', version, deploy: DEPLOY, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), ai: { enabled: config.ai.enabled, model: config.ai.enabled ? config.ai.model : null, ...recommender.stats() } });
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
          version
        });
      }
      if (pathname === '/api/recommend') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return await handleRecommend(req, res);
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
