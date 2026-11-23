'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createPassportStore, cleanPassport, decodeImage } = require('../server/passport-store');
const { createApp } = require('../server/app');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'passport-store-'));
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
const body = (extra = {}) => ({
  ref: 'CFT-AB12C', consent: true, consentText: 'Save my passport with GDRFA.',
  visitor: { name: 'Aisha Al Mansoori', email: 'aisha@example.com', org: 'Example Org' },
  journey: { track: 'agentic', secondary: 'gov', level: 1, summary: 'A practical start.', source: 'ai',
    stages: [{ key: 'discover', topic: 'Foundations', next: 'Try one agent', courses: ['c1', 'c2', 'nope'] }, { key: 'learn', topic: 'Build', next: 'Ship', courses: ['c4'] }] },
  attended: 's-keynote', avatar: 'preset:orbit', image: JPEG, ...extra
});

test('only known fields are kept, and titles are never taken from the request', () => {
  const d = cleanPassport({ ...body(), extra: 'x', visitor: { name: '  Aisha\u0000 Al Mansoori ', email: 'aisha@example.com', org: 'Org', phone: '123' } }, content, catalog);
  assert.deepEqual(Object.keys(d).sort(), ['attended', 'avatar', 'journey', 'visitor']);
  assert.deepEqual(d.visitor, { name: 'Aisha Al Mansoori', email: 'aisha@example.com', org: 'Org' });
  assert.deepEqual(d.journey.stages[0].courses, ['c1', 'c2']); // unknown course references are dropped
  assert.throws(() => cleanPassport(body({ journey: { track: 'hacked', level: 1 } }), content, catalog), e => e.status === 400);
  assert.throws(() => cleanPassport(body({ visitor: { name: 'A', email: 'a@b.co' } }), content, catalog), e => e.status === 400);
  assert.throws(() => cleanPassport(body({ visitor: { name: 'Aisha', email: 'not-an-email' } }), content, catalog), e => e.status === 400);
  assert.equal(cleanPassport(body({ attended: 'nope', avatar: '<script>' }), content, catalog).avatar, 'preset');
  assert.throws(() => decodeImage('data:image/png;base64,AAAA'), e => e.reason === 'bad_image');
  assert.throws(() => decodeImage('data:image/jpeg;base64,' + Buffer.from('GIF89a').toString('base64')), e => e.reason === 'bad_image');
  assert.equal(decodeImage(''), null);
});

test('a saved passport opens only with its key, can be updated and deleted, and expires', async () => {
  let clock = new Date('2026-11-23T10:00:00Z');
  const dir = tmp(), store = createPassportStore({ dir, retentionDays: 30, now: () => clock });
  try {
    const data = { ref: 'CFT-AB12C', ...cleanPassport(body(), content, catalog) };
    const r = await store.create(data, decodeImage(JPEG), 'Save my passport with GDRFA.');
    assert.equal(r.ref, 'CFT-AB12C'); assert.match(r.key, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(r.expiresAt, '2026-12-23T10:00:00.000Z');
    await assert.rejects(store.create(data, null, ''), e => e.status === 409); // a passport number is used once
    const rec = await store.get('CFT-AB12C', r.key.toLowerCase());
    assert.equal(rec.visitor.email, 'aisha@example.com'); assert.equal(rec.consent.text, 'Save my passport with GDRFA.'); assert.ok(!('keyHash' in rec));
    assert.equal((await store.getImage('CFT-AB12C', r.key))[0], 0xff);
    await assert.rejects(store.get('CFT-AB12C', 'AAAA-AAAA-AAAA'), e => e.status === 403);
    await assert.rejects(store.get('CFT-AB12C', ''), e => e.status === 403);
    await assert.rejects(store.get('../../etc/passwd', r.key), e => e.status === 404);
    await store.update('CFT-AB12C', r.key, { ...data, visitor: { ...data.visitor, name: 'Aisha M.' } }, null);
    assert.equal((await store.get('CFT-AB12C', r.key)).visitor.name, 'Aisha M.');
    assert.deepEqual((await store.list()).map(x => x.ref), ['CFT-AB12C']);
    clock = new Date('2026-12-24T10:00:00Z'); // past the retention period
    assert.equal(store.purgeExpired(), 1);
    assert.deepEqual(fs.readdirSync(dir), []); // record and image are both gone
    clock = new Date('2026-11-23T10:00:00Z');
    const r2 = await store.create({ ...data, ref: 'CFT-ZZ999' }, decodeImage(JPEG), '');
    await store.delete('CFT-ZZ999', r2.key);
    await assert.rejects(store.get('CFT-ZZ999', r2.key), e => e.status === 404);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { store.stop(); }
});

test('HTTP: consent is required, the visitor opens and deletes their passport, staff export needs the staff key', async () => {
  const dir = tmp(), token = 'staff-token-0123456789-abcdef';
  const config = loadConfig({ DATA_DIR: dir, PASSPORT_ADMIN_TOKEN: token });
  assert.equal(config.passport.storeDir, path.join(dir, 'passports')); assert.equal(config.fekra.storeDir, path.join(dir, 'fekra'));
  const passports = createPassportStore({ dir: config.passport.storeDir, persistent: config.passport.storePersistent });
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, passports, rules: {}, content, catalog, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (method, url, b, headers = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: b ? JSON.stringify(b) : undefined })
    .then(async r => ({ status: r.status, type: r.headers.get('content-type'), text: await r.text() })).then(r => ({ ...r, body: /json/.test(r.type) ? JSON.parse(r.text) : r.text }));
  try {
    assert.equal((await req('POST', '/api/passports', body({ consent: false }))).body.reason, 'no_consent');
    assert.equal((await req('POST', '/api/passports', body(), { Origin: 'https://evil.example' })).status, 403);
    const c = await req('POST', '/api/passports', body());
    assert.equal(c.status, 201);
    const k = { 'X-Passport-Key': c.body.key };
    const g = await req('GET', '/api/passports/CFT-AB12C', null, k);
    assert.equal(g.status, 200); assert.equal(g.body.visitor.name, 'Aisha Al Mansoori'); assert.equal(g.body.journey.track, 'agentic');
    assert.equal((await req('GET', '/api/passports/CFT-AB12C', null, { 'X-Passport-Key': 'WRONG' })).status, 403);
    const img = await fetch(base + '/api/passports/CFT-AB12C/image', { headers: k });
    assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal((await req('PUT', '/api/passports/CFT-AB12C', body({ visitor: { name: 'Aisha M.', email: 'aisha@example.com', org: '' } }), k)).status, 200);
    // staff export
    assert.equal((await req('GET', '/api/passports/export')).status, 401);
    assert.equal((await req('GET', '/api/passports/export', null, { Authorization: 'Bearer wrong-token-0123456789' })).status, 401);
    const ex = await req('GET', '/api/passports/export', null, { Authorization: `Bearer ${token}` });
    assert.equal(ex.status, 200); assert.equal(ex.body.count, 1);
    assert.equal(ex.body.passports[0].name, 'Aisha M.'); assert.equal(ex.body.passports[0].track, content.tracks.find(t => t.id === 'agentic').title);
    assert.match(ex.body.passports[0].courses, /AI Fluency/);
    assert.equal(ex.body.passports[0].attended, content.sessions.find(s => s.id === 's-keynote').title);
    const csv = await req('GET', '/api/passports/export?format=csv', null, { Authorization: `Bearer ${token}` });
    assert.match(csv.type, /text\/csv/); assert.match(csv.text, /^\ufeff?passport,created,name,email/); assert.match(csv.text, /aisha@example\.com/); // (fetch drops the byte-order mark that Excel needs)
    // the visitor deletes it
    assert.equal((await req('DELETE', '/api/passports/CFT-AB12C', null, k)).status, 200);
    assert.equal((await req('GET', '/api/passports/CFT-AB12C', null, k)).status, 404);
    const cfg = await req('GET', '/api/config');
    assert.deepEqual(cfg.body.passport, { save: 'optional', storage: { available: true, persistent: true, retentionDays: 180 }, retentionDays: 180 });
  } finally { server.close(); passports.stop(); }
});

test('CSV cells cannot smuggle spreadsheet formulas', async () => {
  const dir = tmp(), token = 'staff-token-0123456789-abcdef';
  const config = loadConfig({ DATA_DIR: dir, PASSPORT_ADMIN_TOKEN: token });
  const passports = createPassportStore({ dir: config.passport.storeDir });
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, passports, rules: {}, content, catalog, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const b = body({ visitor: { name: '=HYPERLINK("http://x","y")', email: 'a@example.com', org: '+1, "quoted"' } });
    assert.equal((await fetch(base + '/api/passports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).status, 201);
    const csv = await (await fetch(base + '/api/passports/export?format=csv', { headers: { Authorization: `Bearer ${token}` } })).text();
    assert.ok(csv.includes(`"'=HYPERLINK(""http://x"",""y"")"`)); assert.ok(csv.includes(`"'+1, ""quoted"""`));
  } finally { server.close(); passports.stop(); }
});

test('saving is off when PASSPORT_SAVE=off, and a short staff token is refused', () => {
  assert.equal(loadConfig({ PASSPORT_SAVE: 'off' }).passport.save, 'off');
  assert.throws(() => loadConfig({ PASSPORT_ADMIN_TOKEN: 'short' }), /at least 20/);
  assert.equal(loadConfig({}).passport.storePersistent, false);
  assert.equal(loadConfig({ PASSPORT_STORE_DIR: '/data/p' }).passport.storePersistent, true);
});
