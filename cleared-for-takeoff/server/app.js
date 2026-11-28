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
     POST /api/fekra/proposals/FK-…/download   a PDF download: { email, lang, pdf } -> the PDF is emailed, the email kept with the proposal
     GET  /api/fekra/export[?format=csv]       every saved proposal and who downloaded it, for GDRFA staff (Authorization: Bearer PASSPORT_ADMIN_TOKEN)
     POST /api/avatar                          { image (JPEG data URI), consent: true } -> { image } AI 3D Traveler avatar (see server/avatar.js)
     POST /api/events                          { type, ...fields } anonymous kiosk event (see server/interactions.js)
     GET  /api/interactions[?format=csv]       interaction totals / every event, for GDRFA staff (Authorization: Bearer PASSPORT_ADMIN_TOKEN)
     POST /api/passports                       save a visitor's passport (with their consent) -> { ref, key }
     GET|PUT|DELETE /api/passports/CFT-…       open / update / delete a saved passport (X-Passport-Key header)
     GET  /api/passports/CFT-…/image           the saved passport image (X-Passport-Key header)
     GET  /api/passports/export[?format=csv]   every saved passport, for GDRFA staff (Authorization: Bearer PASSPORT_ADMIN_TOKEN)
     GET  /api/news       live headlines for the ticker (see server/news.js)
     GET  /api/news/sources  which news sources are working, cached or need configuration
   No framework: Node's http module keeps the dependency surface small. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { cleanProposal, cleanCheck, SECTION_KEYS, SECTION_FIELDS } = require('./fekra');
const { cleanPassport, decodeImage } = require('./passport-store');
const { normKey } = require('./fekra-store');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const MAX_BODY = 4 * 1024;
const FEKRA_MAX_BODY = 256 * 1024; // Fekra sends the conversation with each request
const FEKRA_PDF_MAX_BODY = 16 * 1024 * 1024; // a proposal PDF (base64) to email
const PDF_MAX_BYTES = 12 * 1024 * 1024; // larger PDFs are not attached: the email carries the link only
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* the email that carries a proposal PDF, in the proposal's language */
function proposalEmail({ lang, title, ref, key, link }) {
  const t = title || (lang === 'ar' ? 'مقترح بلا عنوان' : 'Untitled proposal');
  if (lang === 'ar') {
    return {
      subject: `مقترحك في «فكرة»: ${t} (${ref})`,
      text: `مرحباً،\n\nتجد مرفقاً مقترحك الابتكاري «${t}» (المرجع ${ref})، الذي أعددته مع «فكرة» في جناح إقامة دبي.\n\nلفتح المقترح ومتابعة العمل عليه: ${link}\nالمرجع: ${ref} · رمز الوصول: ${key}\n\nاحتفظ بهذه الرسالة لنفسك، فالرابط والرمز يفتحان مقترحك.\n\nفكرة · إقامة دبي`,
      html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#14213d"><p>مرحباً،</p><p>تجد مرفقاً مقترحك الابتكاري «<b>${escHtml(t)}</b>» (المرجع ${escHtml(ref)})، الذي أعددته مع «فكرة» في جناح إقامة دبي.</p><p>لفتح المقترح ومتابعة العمل عليه: <a href="${escHtml(link)}">افتح مقترحك</a><br>المرجع: <b dir="ltr">${escHtml(ref)}</b> · رمز الوصول: <b dir="ltr">${escHtml(key)}</b></p><p style="color:#5b6478">احتفظ بهذه الرسالة لنفسك، فالرابط والرمز يفتحان مقترحك.</p><p>فكرة · إقامة دبي</p></div>`
    };
  }
  return {
    subject: `Your Fekra proposal: ${t} (${ref})`,
    text: `Hello,\n\nAttached is your innovation proposal "${t}" (reference ${ref}), prepared with Fekra at the GDRFA booth.\n\nTo open it again and keep working on it: ${link}\nReference: ${ref} · Access code: ${key}\n\nKeep this email to yourself: the link and code open your proposal.\n\nFekra · GDRFA`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#14213d"><p>Hello,</p><p>Attached is your innovation proposal “<b>${escHtml(t)}</b>” (reference ${escHtml(ref)}), prepared with Fekra at the GDRFA booth.</p><p>To open it again and keep working on it: <a href="${escHtml(link)}">open your proposal</a><br>Reference: <b>${escHtml(ref)}</b> · Access code: <b>${escHtml(key)}</b></p><p style="color:#5b6478">Keep this email to yourself: the link and code open your proposal.</p><p>Fekra · GDRFA</p></div>`
  };
}
const PASSPORT_MAX_BODY = 2200 * 1024; // the passport image (JPEG, base64) plus the visitor's details
const EVENT_MAX_BODY = 2 * 1024; // one anonymous kiosk event
const AVATAR_MAX_BODY = 1500 * 1024; // the visitor's photo (512 px JPEG, base64) for the AI avatar

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

/* one CSV cell; a leading = + - @ is neutralised so spreadsheets never run it as a formula */
function csvCell(v) {
  let t = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) || t !== t.trim() ? '"' + t.replace(/"/g, '""') + '"' : t;
}

function createApp({ config, recommender, fekra, store, passports, avatar = null, interactions = null, mailer = null, news, rules, content, catalog = { courses: [] }, logger, publicDir, version }) {
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
    const result = await recommender.recommend(profile, body.sessions, body.lang === 'ar' ? 'ar' : 'en');
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

  /* ---------- AI 3D Traveler avatar ---------- */
  async function handleAvatar(req, res) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    const rl = limiter.take(clientIp(req, config.trustProxy));
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    let body;
    try { body = await readJsonBody(req, AVATAR_MAX_BODY); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
    if (!avatar || !avatar.status().enabled) return sendJson(res, 503, { error: 'The AI avatar is not available.', reason: 'not_configured' });
    if (body.consent !== true) return sendJson(res, 400, { error: 'The visitor has not agreed to send their photo to the AI avatar service.', reason: 'no_consent' });
    try {
      const out = await avatar.generate({ image: body.image, style: body.style });
      if (interactions) interactions.record('avatar_ai_created');
      return sendJson(res, 200, out);
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      return sendJson(res, status, { error: err.status ? err.message : 'The AI avatar could not be created.', reason: err.reason || 'error' });
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
      if (!ref && req.method === 'POST') { const body = await readJsonBody(req, FEKRA_MAX_BODY); const out = await store.create(storeData(body), identity); if (interactions) interactions.record('fekra_proposal_saved'); return sendJson(res, 201, out); }
      if (!ref && req.method === 'GET') return sendJson(res, 200, { proposals: await store.list(identity) });
      if (ref && sub === 'versions' && req.method === 'GET') return sendJson(res, 200, { versions: await store.versions(ref, key, identity) });
      if (ref && !sub && req.method === 'GET') return sendJson(res, 200, await store.get(ref, key, identity));
      if (ref && !sub && req.method === 'PUT') { const body = await readJsonBody(req, FEKRA_MAX_BODY); return sendJson(res, 200, await store.update(ref, key, identity, { baseVersion: body.baseVersion, data: storeData(body) })); }
      if (ref && sub === 'download' && req.method === 'POST') return await handleDownload(req, res, ref, key, identity);
      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (status >= 500) logger.error('fekra_store_failed', { detail: String(err.message).slice(0, 300) });
      return sendJson(res, status, { error: status < 500 ? err.message : 'The proposal could not be saved.', reason: err.reason || 'error' });
    }
  }

  /* A proposal PDF was downloaded: email it to the address given and keep that address with the proposal.
     The PDF itself is built in the browser; it is attached to the email and not stored on the server. */
  function publicBase(req) {
    if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/?$/, '/');
    const host = String((config.trustProxy && req.headers['x-forwarded-host']) || req.headers.host || '').split(',')[0].trim();
    const proto = String((config.trustProxy && req.headers['x-forwarded-proto']) || 'http').split(',')[0].trim() === 'https' ? 'https' : 'http';
    return `${proto}://${host}/`;
  }
  async function handleDownload(req, res, ref, key, identity) {
    const mode = config.fekra.pdfEmail;
    const body = await readJsonBody(req, FEKRA_PDF_MAX_BODY);
    const lang = body.lang === 'ar' ? 'ar' : 'en';
    const email = mode === 'off' ? '' : String(body.email || '').trim().slice(0, 254);
    if (email && !EMAIL_RE.test(email)) return sendJson(res, 400, { error: 'Please enter a valid email address.', reason: 'bad_email' });
    if (!email && mode === 'required') return sendJson(res, 400, { error: 'An email address is needed to download the proposal.', reason: 'email_required' });
    const rec = await store.get(ref, key, identity); // checks the access code first
    let emailed = email ? 'failed' : 'no', reason = null;
    if (email) {
      let pdf = null;
      const m = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.pdf || ''));
      if (m) { const buf = Buffer.from(m[1], 'base64'); if (buf.length <= PDF_MAX_BYTES && buf.slice(0, 5).toString('latin1') === '%PDF-') pdf = buf; }
      const code = normKey(key).replace(/(.{4})(?=.)/g, '$1-');
      const msg = proposalEmail({ lang, title: rec.title, ref, key: code, link: `${publicBase(req)}#fekra=${ref}~${normKey(key)}` });
      const slug = String(rec.title || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'proposal';
      try {
        if (!mailer) throw Object.assign(new Error('Email is not set up on this server.'), { reason: 'not_configured' });
        await mailer.send({ to: email, ...msg, attachments: pdf ? [{ filename: `Fekra-${ref}-${slug}.pdf`, content: pdf }] : [], group: ref });
        emailed = 'sent';
      } catch (err) { reason = err.reason || 'send_failed'; emailed = reason === 'not_configured' ? 'not_configured' : reason === 'rate_limited' ? 'rate_limited' : 'failed'; }
    }
    await store.recordDownload(ref, key, identity, { email: email || null, lang, emailed });
    if (interactions) { interactions.record('fekra_pdf_downloaded', { lang }); if (emailed === 'sent') interactions.record('fekra_proposal_emailed', { lang }); }
    return sendJson(res, 200, { recorded: true, emailed: emailed === 'sent', status: emailed, reason });
  }
  /* GDRFA staff: every saved proposal and who downloaded it */
  async function handleFekraExport(req, res) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    const rl = limiter.take(clientIp(req, config.trustProxy));
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    if (!config.passport.adminToken) return sendJson(res, 503, { error: 'Staff access is not configured (PASSPORT_ADMIN_TOKEN).', reason: 'not_configured' });
    if (!staffAuthorized(req)) { logger.warn('fekra_export_denied', { ip: clientIp(req, config.trustProxy) }); return sendJson(res, 401, { error: 'The staff key is not correct.', reason: 'unauthorized' }); }
    if (!store) return sendJson(res, 503, { error: 'Saving is not available.', reason: 'no_store' });
    const proposals = await store.staffList();
    logger.info('fekra_export', { rows: proposals.length });
    if (new URL(req.url, 'http://localhost').searchParams.get('format') === 'csv') {
      const cols = ['reference', 'title', 'status', 'created', 'updated', 'email', 'downloaded', 'emailed', 'language'];
      const rows = proposals.flatMap(p => (p.downloads.length ? p.downloads : [null]).map(d => ({ reference: p.ref, title: p.title, status: p.status, created: p.createdAt, updated: p.updatedAt, email: d ? d.email || '' : '', downloaded: d ? d.at : '', emailed: d ? d.emailed : '', language: d ? d.lang : p.lang })));
      const csv = '\ufeff' + [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="fekra-proposals-${new Date().toISOString().slice(0, 10)}.csv"` });
      return res.end(csv);
    }
    return sendJson(res, 200, { count: proposals.length, mail: mailer ? mailer.status() : { enabled: false }, storage: store.status(), proposals });
  }

  /* ---------- anonymous interaction log ---------- */
  async function handleEvent(req, res) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    const rl = limiter.take(clientIp(req, config.trustProxy));
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    let body;
    try { body = await readJsonBody(req, EVENT_MAX_BODY); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
    if (!interactions) return sendJson(res, 503, { error: 'Interaction log unavailable.', reason: 'no_store' });
    if (!interactions.acceptsFromClient(body.type)) return sendJson(res, 400, { error: 'Unknown event.', reason: 'bad_event' });
    interactions.record(body.type, body);
    return sendJson(res, 202, { ok: true });
  }
  async function handleInteractions(req, res) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    if (!config.passport.adminToken) return sendJson(res, 503, { error: 'Staff access is not configured (PASSPORT_ADMIN_TOKEN).', reason: 'not_configured' });
    if (!staffAuthorized(req)) { logger.warn('interactions_export_denied', { ip: clientIp(req, config.trustProxy) }); return sendJson(res, 401, { error: 'The staff key is not correct.', reason: 'unauthorized' }); }
    if (!interactions) return sendJson(res, 503, { error: 'Interaction log unavailable.', reason: 'no_store' });
    if (new URL(req.url, 'http://localhost').searchParams.get('format') === 'csv') {
      const tz = config.kiosk.eventTimezone;
      const local = iso => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`; };
      const title = (list, id) => { const x = (list || []).find(t => t.id === id); return x ? (x.title || x.label) : (id || ''); };
      const cols = ['time', 'event', 'role', 'experience', 'track', 'secondTrack', 'level', 'recommendedBy', 'avatar', 'session'];
      const rows = (await interactions.list()).map(ev => ({
        time: local(ev.at), event: ev.type, role: ev.role ? title(content.roles, ev.role) : '', experience: ev.experience ? title(content.experience, ev.experience) : '',
        track: ev.track ? title(content.tracks, ev.track) : '', secondTrack: ev.secondTrack ? title(content.tracks, ev.secondTrack) : '', level: ev.level || '',
        recommendedBy: ev.source === 'ai' ? 'AI' : ev.source === 'rules' ? 'Booth rules' : '', avatar: ev.avatar || '', session: ev.session ? title(content.sessions, ev.session) : ''
      }));
      const csv = '\ufeff' + [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="agentic-ai-interactions-${new Date().toISOString().slice(0, 10)}.csv"` });
      return res.end(csv);
    }
    return sendJson(res, 200, { ...(await interactions.summary()), storage: interactions.status() });
  }

  /* ---------- saved passports ---------- */
  const passportConfig = () => ({ save: passports ? config.passport.save : 'off', storage: passports ? passports.status() : { available: false, persistent: false }, retentionDays: config.passport.retentionDays });
  const trackTitle = id => { const t = (content.tracks || []).find(x => x.id === id); return t ? t.title : ''; };
  const courseTitle = ref => { const c = (catalog.courses || []).find(x => x.ref === ref); return c ? c.title : ref; };
  const sessionTitle = id => { const x = (content.sessions || []).find(s => s.id === id); return x ? x.title : ''; };
  function staffRow(r) {
    return {
      passport: r.ref, created: r.createdAt, name: r.visitor.name, email: r.visitor.email, organization: r.visitor.org,
      track: trackTitle(r.journey.track), secondTrack: trackTitle(r.journey.secondary), level: (content.levels || [])[r.journey.level] || '',
      attended: sessionTitle(r.attended), courses: r.journey.stages.flatMap(s => s.courses).map(courseTitle).join('; '),
      recommendedBy: r.journey.source === 'ai' ? 'AI' : 'Booth rules', consentAt: r.consent && r.consent.at, deleteAfter: r.expiresAt
    };
  }
  function staffAuthorized(req) {
    const token = config.passport.adminToken, m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
    if (!token || !m) return false;
    const a = crypto.createHash('sha256').update(m[1].trim()).digest(), b = crypto.createHash('sha256').update(token).digest();
    return crypto.timingSafeEqual(a, b);
  }
  async function handlePassports(req, res, ref, sub) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    const rl = limiter.take(clientIp(req, config.trustProxy));
    if (!rl.ok) return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' }, { 'Retry-After': String(rl.retryAfter) });
    if (!passports || config.passport.save === 'off') return sendJson(res, 503, { error: 'Saving passports is not available.', reason: 'no_store' });
    const key = req.headers['x-passport-key'];
    try {
      if (ref === 'export') {
        if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        if (!config.passport.adminToken) return sendJson(res, 503, { error: 'Staff access is not configured (PASSPORT_ADMIN_TOKEN).', reason: 'not_configured' });
        if (!staffAuthorized(req)) { logger.warn('passport_export_denied', { ip: clientIp(req, config.trustProxy) }); return sendJson(res, 401, { error: 'The staff key is not correct.', reason: 'unauthorized' }); }
        const rows = (await passports.list()).map(staffRow);
        logger.info('passport_export', { rows: rows.length });
        if (new URL(req.url, 'http://localhost').searchParams.get('format') === 'csv') {
          const cols = ['passport', 'created', 'name', 'email', 'organization', 'track', 'secondTrack', 'level', 'attended', 'courses', 'recommendedBy', 'consentAt', 'deleteAfter'];
          const csv = '\ufeff' + [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="agentic-ai-passports-${new Date().toISOString().slice(0, 10)}.csv"` });
          return res.end(csv);
        }
        return sendJson(res, 200, { count: rows.length, storage: passports.status(), passports: rows });
      }
      if (!ref && req.method === 'POST') {
        const body = await readJsonBody(req, PASSPORT_MAX_BODY);
        if (body.consent !== true) return sendJson(res, 400, { error: 'The visitor has not agreed to save their passport.', reason: 'no_consent' });
        const data = { ref: String(body.ref || ''), ...cleanPassport(body, content, catalog) };
        const out = await passports.create(data, decodeImage(body.image), body.consentText);
        if (interactions) interactions.record('passport_created', { track: data.journey.track, level: (content.levels || [])[data.journey.level], source: data.journey.source, avatar: body.avatarSource });
        return sendJson(res, 201, out);
      }
      if (ref && sub === 'image' && req.method === 'GET') {
        const img = await passports.getImage(ref, key);
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Content-Length': img.length });
        return res.end(img);
      }
      if (ref && !sub && req.method === 'GET') return sendJson(res, 200, await passports.get(ref, key));
      if (ref && !sub && req.method === 'PUT') { const body = await readJsonBody(req, PASSPORT_MAX_BODY); return sendJson(res, 200, await passports.update(ref, key, cleanPassport(body, content, catalog), decodeImage(body.image))); }
      if (ref && !sub && req.method === 'DELETE') { const out = await passports.delete(ref, key); if (interactions) interactions.record('passport_deleted'); return sendJson(res, 200, out); }
      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (status >= 500) logger.error('passport_store_failed', { detail: String(err.message).slice(0, 300) });
      return sendJson(res, status, { error: status < 500 ? err.message : 'The passport could not be saved.', reason: err.reason || 'error' });
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
        return sendJson(res, 200, { status: 'ok', version, deploy: DEPLOY, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), ai: { enabled: config.ai.enabled, model: config.ai.enabled ? config.ai.model : null, ...recommender.stats() }, fekra: fekra ? { ...fekra.status(), ...fekra.stats() } : { enabled: false }, passports: passportConfig(), avatarAi: avatar ? { ...avatar.status(), ...avatar.stats() } : { enabled: false }, interactions: interactions ? interactions.status() : { available: false }, news: news ? news.stats() : { enabled: false } });
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
          defaultLang: config.kiosk.defaultLang,
          fekra: { ...(fekra ? fekra.status() : { enabled: false }), idleResetSeconds: config.fekra.idleResetSeconds, storage: store ? store.status() : { available: false, persistent: false }, signIn: !!config.fekra.identityHeader, pdfEmail: config.fekra.pdfEmail, mail: !!(mailer && mailer.enabled) },
          passport: passportConfig(),
          avatarAi: { enabled: !!(avatar && avatar.status().enabled) },
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
      if (pathname === '/api/events') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return await handleEvent(req, res);
      }
      if (pathname === '/api/interactions') return await handleInteractions(req, res);
      if (pathname === '/api/avatar') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return await handleAvatar(req, res);
      }
      const ppm = /^\/api\/passports(?:\/(export|CFT-[0-9A-Z]{5}))?(?:\/(image))?$/.exec(pathname);
      if (ppm && !(ppm[1] === 'export' && ppm[2])) return await handlePassports(req, res, ppm[1] || null, ppm[2] || null);
      if (pathname === '/api/fekra/export') return await handleFekraExport(req, res);
      const pm = /^\/api\/fekra\/proposals(?:\/(FK-[0-9A-Z-]{6,20}))?(?:\/(versions|download))?$/.exec(pathname);
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
