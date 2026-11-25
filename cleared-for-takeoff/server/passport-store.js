'use strict';
/* Saved Agentic AI Passports: what a visitor agreed to save at the kiosk, so the QR code on their passport opens it
   again later on their phone.

   What is stored (only when the visitor ticks the consent box)
     - name, email, organization, the learning journey (track, level, course references, next steps), the session
       they attended, when and to what they consented, and the passport image itself (JPEG, which includes their
       photo or avatar).
   Access
     - The passport number (CFT-XXXXX) is the reference. Each saved passport also gets a private 12-character key that
       only travels inside the QR code's link fragment (never sent to the server in a URL, so never in access logs).
       Only a SHA-256 hash of the key is stored; reading, changing or deleting a passport needs the key.
     - GDRFA staff can list and export everything with PASSPORT_ADMIN_TOKEN (see app.js).
   Retention
     - Each passport is deleted automatically after PASSPORT_RETENTION_DAYS; the visitor can delete it sooner.
   Persistence
     - Real files on the server. On Railway the container disk is replaced on every deploy, so attach a volume and set
       DATA_DIR (or PASSPORT_STORE_DIR); status().persistent is true only when one of them is set. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const REF_RE = /^CFT-[0-9A-Z]{5}$/;
const MAX_IMAGE = 1500 * 1024;
const CONSENT_VERSION = 1;

const randomCode = n => { const b = crypto.randomBytes(n); let s = ''; for (let i = 0; i < n; i++) s += ALPHA[b[i] % 32]; return s; };
const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const normKey = k => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fail = (status, reason, message) => Object.assign(new Error(message), { status, reason });
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* Only known fields are kept; titles come from the booth's own content, never from the request. */
function cleanPassport(body, content, catalog) {
  const b = body && typeof body === 'object' ? body : {}, v = b.visitor && typeof b.visitor === 'object' ? b.visitor : {}, j = b.journey && typeof b.journey === 'object' ? b.journey : {};
  const name = text(v.name, 50), email = text(v.email, 80), org = text(v.org, 50);
  if (name.length < 2) throw fail(400, 'bad_request', 'A name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail(400, 'bad_request', 'A valid email address is required.');
  const track = (content.tracks || []).find(t => t.id === j.track);
  if (!track) throw fail(400, 'bad_request', 'Unknown learning track.');
  const level = Number(j.level);
  if (!(level >= 0 && level <= 2)) throw fail(400, 'bad_request', 'Unknown level.');
  const refs = new Set((catalog.courses || []).map(c => c.ref));
  const secondary = (content.tracks || []).find(t => t.id === j.secondary);
  const stages = (Array.isArray(j.stages) ? j.stages : []).slice(0, 4).map(s => ({
    key: ['discover', 'learn', 'practice', 'innovate'].includes(s && s.key) ? s.key : 'discover',
    topic: text(s && s.topic, 160), next: text(s && s.next, 300),
    courses: (Array.isArray(s && s.courses) ? s.courses : []).map(String).filter(r => refs.has(r)).slice(0, 4)
  }));
  const session = (content.sessions || []).find(s => s.id === b.attended);
  const avatar = /^(photo|preset:[a-z0-9-]{1,30})$/.test(String(b.avatar || '')) ? String(b.avatar) : 'preset';
  return {
    visitor: { name, email, org },
    journey: { track: track.id, secondary: secondary ? secondary.id : null, level, stages, summary: text(j.summary, 600), source: j.source === 'ai' ? 'ai' : 'rules' },
    attended: session ? session.id : null, avatar
  };
}

/* data:image/jpeg;base64,... -> Buffer, or null when no image was sent */
function decodeImage(dataUrl) {
  if (dataUrl == null || dataUrl === '') return null;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw fail(400, 'bad_image', 'The passport image must be a JPEG.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_IMAGE) throw fail(413, 'too_large', 'The passport image is too large.');
  if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw fail(400, 'bad_image', 'The passport image must be a JPEG.');
  return buf;
}

function createPassportStore({ dir, persistent = false, retentionDays = 180, logger, now = () => new Date() }) {
  const root = path.resolve(dir);
  fs.mkdirSync(root, { recursive: true });
  const locks = new Map();
  const withLock = (ref, fn) => { const prev = locks.get(ref) || Promise.resolve(); const run = prev.then(fn, fn); locks.set(ref, run.catch(() => {})); return run; };
  const file = ref => path.join(root, `${ref}.json`), imageFile = ref => path.join(root, `${ref}.jpg`);
  const writeAtomic = (p, data) => { const tmp = `${p}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, p); };
  function read(ref) {
    if (!REF_RE.test(String(ref))) throw fail(404, 'not_found', 'Passport not found.');
    let rec; try { rec = JSON.parse(fs.readFileSync(file(ref), 'utf8')); } catch { throw fail(404, 'not_found', 'Passport not found.'); }
    if (rec.expiresAt && rec.expiresAt <= now().toISOString()) { remove(ref); throw fail(404, 'not_found', 'Passport not found.'); }
    return rec;
  }
  function authorize(rec, key) {
    const a = hash(normKey(key)), b = Buffer.from(rec.keyHash, 'hex');
    if (!key || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw fail(403, 'forbidden', 'This link does not match the saved passport.');
  }
  function remove(ref) { fs.rmSync(file(ref), { force: true }); fs.rmSync(imageFile(ref), { force: true }); }
  const publicView = rec => { const { keyHash, ...rest } = rec; return rest; };

  async function create(data, image, consentText) {
    const ref = data.ref;
    if (!REF_RE.test(String(ref))) throw fail(400, 'bad_request', 'Invalid passport number.');
    return withLock(ref, () => {
      if (fs.existsSync(file(ref))) throw fail(409, 'exists', 'This passport number is already in use.');
      const key = randomCode(12), d = now(), at = d.toISOString();
      const rec = {
        ref, keyHash: hash(key).toString('hex'), createdAt: at, updatedAt: at,
        expiresAt: new Date(d.getTime() + retentionDays * 86400000).toISOString(),
        consent: { at, version: CONSENT_VERSION, text: text(consentText, 600) },
        visitor: data.visitor, journey: data.journey, attended: data.attended, avatar: data.avatar, image: !!image
      };
      if (image) writeAtomic(imageFile(ref), image);
      writeAtomic(file(ref), JSON.stringify(rec));
      logger && logger.info('passport_store', { op: 'create', ref });
      return { ref, key: key.replace(/(.{4})(?=.)/g, '$1-'), createdAt: at, expiresAt: rec.expiresAt };
    });
  }
  async function get(ref, key) { const rec = read(ref); authorize(rec, key); return publicView(rec); }
  async function getImage(ref, key) {
    const rec = read(ref); authorize(rec, key);
    try { return fs.readFileSync(imageFile(ref)); } catch { throw fail(404, 'not_found', 'This passport has no saved image.'); }
  }
  async function update(ref, key, data, image) {
    return withLock(ref, () => {
      const rec = read(ref); authorize(rec, key);
      if (image) writeAtomic(imageFile(ref), image);
      const next = { ...rec, updatedAt: now().toISOString(), visitor: data.visitor, journey: data.journey, attended: data.attended, avatar: data.avatar, image: rec.image || !!image };
      writeAtomic(file(ref), JSON.stringify(next));
      logger && logger.info('passport_store', { op: 'update', ref });
      return { ref, updatedAt: next.updatedAt, expiresAt: next.expiresAt };
    });
  }
  async function del(ref, key) {
    return withLock(ref, () => { const rec = read(ref); authorize(rec, key); remove(ref); logger && logger.info('passport_store', { op: 'delete', ref }); return { ref, deleted: true }; });
  }
  function all() {
    return fs.readdirSync(root).filter(f => f.endsWith('.json') && REF_RE.test(f.slice(0, -5)))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } })
      .filter(Boolean);
  }
  /* everything saved, newest first, for GDRFA staff (no keys, no images) */
  async function list() {
    const at = now().toISOString();
    return all().filter(r => !r.expiresAt || r.expiresAt > at).map(publicView).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  function purgeExpired() {
    const at = now().toISOString(); let n = 0;
    all().forEach(r => { if (r.expiresAt && r.expiresAt <= at && REF_RE.test(r.ref)) { remove(r.ref); n++; } });
    if (n && logger) logger.info('passport_store', { op: 'purge', removed: n });
    return n;
  }
  try { purgeExpired(); } catch { /* best effort at start-up */ }
  const timer = setInterval(() => { try { purgeExpired(); } catch { /* next hour */ } }, 3600000);
  if (timer.unref) timer.unref();
  return { create, get, getImage, update, delete: del, list, purgeExpired, status: () => ({ available: true, persistent, retentionDays }), stop: () => clearInterval(timer) };
}

module.exports = { createPassportStore, cleanPassport, decodeImage, REF_RE, CONSENT_VERSION };
