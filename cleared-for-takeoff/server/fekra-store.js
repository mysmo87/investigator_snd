'use strict';
/* Saved Fekra proposals: one JSON file per proposal in FEKRA_STORE_DIR, with every earlier version kept.

   Identity and access
     - Each proposal gets a reference (FK-yymmdd-XXXX) and a private access code (12 characters) shown once to the
       employee. Only a SHA-256 hash of the code is stored; every read and write needs the code.
     - The app has no employee login. When it runs behind GDRFA single sign-on, set FEKRA_IDENTITY_HEADER to the
       header the identity proxy sets (for example x-ms-client-principal-name): the signed-in user is then recorded as
       the owner, only that user can open the proposal (with its code), and GET /api/fekra/proposals lists their own.
   Persistence
     - Real files on the server. On Railway the container disk is replaced on every deploy, so attach a volume and
       point FEKRA_STORE_DIR at it; status().persistent is true only when FEKRA_STORE_DIR is set explicitly.
   Concurrency
     - Updates carry the version they were based on; a stale version gets 409 instead of overwriting newer work. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUSES = ['draft', 'under_review', 'finalized'];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const REF_RE = /^FK-\d{6}-[A-HJ-NP-Z2-9]{4}$/;
const MAX_BYTES = 600 * 1024, MAX_VERSIONS = 30;

const randomCode = n => { const b = crypto.randomBytes(n); let s = ''; for (let i = 0; i < n; i++) s += ALPHA[b[i] % 32]; return s; };
const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const normKey = k => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fail = (status, reason, message) => Object.assign(new Error(message), { status, reason });

function createStore({ dir, persistent = false, logger, now = () => new Date() }) {
  const root = path.resolve(dir);
  fs.mkdirSync(root, { recursive: true });
  const locks = new Map(); // ref -> promise chain, so writes to one proposal never interleave
  const withLock = (ref, fn) => { const prev = locks.get(ref) || Promise.resolve(); const run = prev.then(fn, fn); locks.set(ref, run.catch(() => {})); return run; };
  const file = ref => path.join(root, `${ref}.json`);
  const versionsDir = ref => path.join(root, ref);
  function writeAtomic(p, data) { const tmp = `${p}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, p); }
  function read(ref) {
    if (!REF_RE.test(ref)) throw fail(404, 'not_found', 'Proposal not found.');
    try { return JSON.parse(fs.readFileSync(file(ref), 'utf8')); } catch { throw fail(404, 'not_found', 'Proposal not found.'); }
  }
  function authorize(rec, key, identity) {
    const a = hash(normKey(key)), b = Buffer.from(rec.keyHash, 'hex');
    if (!key || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw fail(403, 'forbidden', 'The access code does not match this proposal.');
    if (rec.owner && rec.owner !== identity) throw fail(403, 'forbidden', 'This proposal belongs to another user.');
  }
  const publicView = rec => { const { keyHash, ...rest } = rec; return rest; };
  const summary = rec => ({ ref: rec.ref, title: rec.title, status: rec.status, version: rec.version, updatedAt: rec.updatedAt, createdAt: rec.createdAt, lang: rec.lang });
  const size = data => Buffer.byteLength(JSON.stringify(data));

  async function create(data, identity) {
    if (size(data) > MAX_BYTES) throw fail(413, 'too_large', 'This proposal is too large to save.');
    let ref; for (let i = 0; i < 20; i++) { const d = now(); ref = `FK-${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${randomCode(4)}`; if (!fs.existsSync(file(ref))) break; }
    const key = randomCode(12), at = now().toISOString();
    const rec = { ref, keyHash: hash(key).toString('hex'), owner: identity || null, createdAt: at, updatedAt: at, version: 1, status: STATUSES.includes(data.status) ? data.status : 'draft', title: data.title || '', lang: data.lang, data: data.payload };
    await withLock(ref, () => writeAtomic(file(ref), JSON.stringify(rec)));
    logger && logger.info('fekra_store', { op: 'create', ref });
    return { ref, key: key.replace(/(.{4})(?=.)/g, '$1-'), version: 1, createdAt: at, updatedAt: at, status: rec.status };
  }
  async function get(ref, key, identity) { const rec = read(ref); authorize(rec, key, identity); return publicView(rec); }
  async function update(ref, key, identity, { baseVersion, data }) {
    if (size(data) > MAX_BYTES) throw fail(413, 'too_large', 'This proposal is too large to save.');
    return withLock(ref, () => {
      const rec = read(ref); authorize(rec, key, identity);
      if (Number(baseVersion) !== rec.version) throw fail(409, 'version_conflict', `This proposal was saved elsewhere (version ${rec.version}). Reopen it to continue.`);
      fs.mkdirSync(versionsDir(ref), { recursive: true });
      writeAtomic(path.join(versionsDir(ref), `v${rec.version}.json`), JSON.stringify(rec)); // keep the previous version
      const old = fs.readdirSync(versionsDir(ref)).filter(f => /^v\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
      old.slice(0, Math.max(0, old.length - MAX_VERSIONS)).forEach(f => fs.rmSync(path.join(versionsDir(ref), f), { force: true }));
      const next = { ...rec, version: rec.version + 1, updatedAt: now().toISOString(), status: STATUSES.includes(data.status) ? data.status : rec.status, title: data.title || rec.title, lang: data.lang || rec.lang, data: data.payload };
      writeAtomic(file(ref), JSON.stringify(next));
      logger && logger.info('fekra_store', { op: 'update', ref, version: next.version });
      return { ref, version: next.version, updatedAt: next.updatedAt, status: next.status };
    });
  }
  async function versions(ref, key, identity) {
    const rec = read(ref); authorize(rec, key, identity);
    const list = fs.existsSync(versionsDir(ref)) ? fs.readdirSync(versionsDir(ref)).filter(f => /^v\d+\.json$/.test(f)) : [];
    const old = list.map(f => { try { return summary(JSON.parse(fs.readFileSync(path.join(versionsDir(ref), f), 'utf8'))); } catch { return null; } }).filter(Boolean);
    return [summary(rec), ...old].sort((a, b) => b.version - a.version);
  }
  /* A PDF download: who it was sent to and whether the email went out. Kept with the proposal (not a new version);
     the last 100 are kept. */
  async function recordDownload(ref, key, identity, entry) {
    return withLock(ref, () => {
      const rec = read(ref); authorize(rec, key, identity);
      const downloads = [...(rec.downloads || []), { at: now().toISOString(), email: entry.email || null, lang: entry.lang === 'ar' ? 'ar' : 'en', emailed: entry.emailed || 'no' }].slice(-100);
      writeAtomic(file(ref), JSON.stringify({ ...rec, downloads }));
      logger && logger.info('fekra_store', { op: 'download', ref });
      return { ref, title: rec.title };
    });
  }
  /* every saved proposal, newest first, with its downloads: for GDRFA staff (no access codes, no content) */
  async function staffList() {
    return fs.readdirSync(root).filter(f => f.endsWith('.json') && REF_RE.test(f.replace(/\.json$/, '')))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } })
      .filter(Boolean)
      .map(r => ({ ...summary(r), owner: r.owner || null, downloads: (r.downloads || []).slice().reverse() }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  async function list(identity) {
    if (!identity) throw fail(403, 'no_identity', 'Listing saved proposals needs single sign-on.');
    return fs.readdirSync(root).filter(f => REF_RE.test(f.replace(/\.json$/, '')) && f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } })
      .filter(r => r && r.owner === identity).map(summary).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  return { create, get, update, versions, list, recordDownload, staffList, status: () => ({ available: true, persistent }), STATUSES, REF_RE };
}

module.exports = { createStore, STATUSES, REF_RE, normKey };
