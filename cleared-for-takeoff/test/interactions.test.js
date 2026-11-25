'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createInteractionLog } = require('../server/interactions');
const { createPassportStore } = require('../server/passport-store');
const { createApp } = require('../server/app');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'interactions-'));
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
const TOKEN = 'staff-key-for-tests-123456';
const passportBody = (extra = {}) => ({
  ref: 'CFT-AB12C', consent: true, consentText: 'Saved.', avatarSource: 'ai',
  visitor: { name: 'Aisha Al Mansoori', email: 'aisha@example.com', org: 'Example Org' },
  journey: { track: 'agentic', secondary: 'gov', level: 1, summary: 'A start.', source: 'ai', stages: [{ key: 'discover', topic: 'T', next: 'N', courses: [] }] },
  attended: null, avatar: 'photo', image: JPEG, ...extra
});

async function start() {
  const dir = tmp();
  const config = loadConfig({ PASSPORT_ADMIN_TOKEN: TOKEN });
  const passports = createPassportStore({ dir: path.join(dir, 'passports'), persistent: true, logger: silentLogger });
  const interactions = createInteractionLog({ dir: path.join(dir, 'interactions'), persistent: true, content, logger: silentLogger });
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, passports, interactions, rules: {}, content, catalog, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (method, url, b, headers = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: b ? JSON.stringify(b) : undefined })
    .then(async r => ({ status: r.status, text: await r.text(), type: r.headers.get('content-type') })).then(r => ({ ...r, body: /json/.test(r.type) ? JSON.parse(r.text) : r.text }));
  return { dir, req, interactions, close: () => { passports.stop(); return new Promise(r => server.close(r)); } };
}
const staff = { Authorization: `Bearer ${TOKEN}` };

test('only whitelisted, validated fields are recorded, and nothing personal', async () => {
  const dir = tmp();
  const log = createInteractionLog({ dir, content, logger: silentLogger, now: () => new Date('2026-11-25T08:00:00Z') });
  assert.equal(log.record('journey_generated', { role: 'gov', experience: 'beginner', track: 'agentic', level: 'Explorer', source: 'ai', name: 'Aisha', email: 'a@b.c', track2: 'x' }), true);
  assert.equal(log.record('journey_generated', { role: 'hacker', track: '<script>', level: 'God', source: 'magic' }), true);
  assert.equal(log.record('made_up_event'), false);
  const events = await log.list();
  assert.deepEqual(events[0], { at: '2026-11-25T08:00:00.000Z', type: 'journey_generated', role: 'gov', experience: 'beginner', track: 'agentic', level: 'Explorer', source: 'ai' });
  assert.deepEqual(events[1], { at: '2026-11-25T08:00:00.000Z', type: 'journey_generated' }); // invalid values are dropped
  const raw = fs.readFileSync(path.join(dir, 'interactions.jsonl'), 'utf8');
  assert.ok(!/Aisha|a@b\.c/.test(raw));
});

test('the summary counts totals, today (Dubai time) and breakdowns', async () => {
  let now = new Date('2026-11-24T19:30:00Z'); // 23:30 in Dubai on the 24th
  const log = createInteractionLog({ dir: tmp(), content, logger: silentLogger, now: () => now });
  log.record('journey_generated', { track: 'agentic', level: 'Explorer', role: 'gov', source: 'ai' });
  now = new Date('2026-11-24T20:30:00Z'); // 00:30 in Dubai on the 25th
  log.record('journey_generated', { track: 'agentic', level: 'Practitioner', role: 'tech', source: 'rules' });
  log.record('passport_created', { track: 'agentic', level: 'Practitioner', avatar: 'ai' });
  log.record('passport_deleted');
  const s = await log.summary();
  assert.equal(s.today, '2026-11-25');
  assert.equal(s.totals.journey_generated, 2);
  assert.equal(s.todayTotals.journey_generated, 1);
  assert.equal(s.totals.passport_deleted, 1);
  assert.equal(s.conversion, 50);
  assert.equal(s.journeys.byTrack['Agentic AI Foundations'], 2);
  assert.deepEqual(s.journeys.bySource, { AI: 1, 'Booth rules': 1 });
  assert.deepEqual(s.passports.byAvatar, { 'AI 3D Traveler': 1 });
  assert.deepEqual(s.byDay.map(d => d.date), ['2026-11-25', '2026-11-24']);
});

test('passports created and deleted are counted, and the count survives the deletion', async () => {
  const s = await start();
  try {
    const created = await s.req('POST', '/api/passports', passportBody());
    assert.equal(created.status, 201);
    const del = await s.req('DELETE', `/api/passports/${created.body.ref}`, null, { 'X-Passport-Key': created.body.key });
    assert.equal(del.status, 200);
    assert.equal((await s.req('GET', '/api/passports/export', null, staff)).body.count, 0);
    const sum = (await s.req('GET', '/api/interactions', null, staff)).body;
    assert.equal(sum.totals.passport_created, 1);
    assert.equal(sum.totals.passport_deleted, 1);
    assert.deepEqual(sum.passports.byAvatar, { 'AI 3D Traveler': 1 });
  } finally { await s.close(); }
});

test('kiosk events: only client event types, same origin; staff endpoints need the key', async () => {
  const s = await start();
  try {
    assert.equal((await s.req('POST', '/api/events', { type: 'journey_generated', track: 'gov', level: 'Innovator', role: 'leader', source: 'ai' })).status, 202);
    assert.equal((await s.req('POST', '/api/events', { type: 'big_screen_shown' })).status, 202);
    assert.equal((await s.req('POST', '/api/events', { type: 'passport_created' })).status, 400); // only the server records these
    assert.equal((await s.req('POST', '/api/events', { type: 'nope' })).status, 400);
    assert.equal((await s.req('POST', '/api/events', { type: 'big_screen_shown' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await s.req('POST', '/api/events', { type: 'big_screen_shown', pad: 'x'.repeat(5000) })).status, 413);
    assert.equal((await s.req('GET', '/api/events')).status, 405);
    assert.equal((await s.req('GET', '/api/interactions')).status, 401);
    assert.equal((await s.req('GET', '/api/interactions', null, { Authorization: 'Bearer wrong-key-wrong-key-wrong' })).status, 401);
    const sum = (await s.req('GET', '/api/interactions', null, staff)).body;
    assert.equal(sum.totals.journey_generated, 1);
    assert.equal(sum.totals.big_screen_shown, 1);
    assert.equal(sum.storage.persistent, true);
    const csv = await s.req('GET', '/api/interactions?format=csv', null, staff);
    assert.match(csv.type, /text\/csv/);
    const lines = csv.text.replace(/^\ufeff/, '').trim().split('\r\n');
    assert.equal(lines[0], 'time,event,role,experience,track,secondTrack,level,recommendedBy,avatar,session');
    assert.equal(lines.length, 3);
    assert.match(lines[1], /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,journey_generated,Business Leader,,AI for Government Services,,Innovator,AI,,$/);
  } finally { await s.close(); }
});

test('the AI avatar and Fekra saves are counted by the server', async () => {
  const dir = tmp();
  const interactions = createInteractionLog({ dir, content, logger: silentLogger });
  const config = loadConfig({ FAL_KEY: 'k' });
  const avatar = { status: () => ({ enabled: true }), stats: () => ({}), generate: async () => ({ image: JPEG }) };
  const store = { create: async () => ({ ref: 'FK-1', key: 'k' }), status: () => ({ available: true, persistent: true }) };
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, avatar, store, interactions, fekra: { status: () => ({ enabled: false }), stats: () => ({}) }, rules: {}, content, catalog, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/api/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: JPEG, consent: true }) })).status, 200);
    assert.equal((await fetch(base + '/api/fekra/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: { proposal: { title: 'Idea' } } }) })).status, 201);
    const s = await interactions.summary();
    assert.equal(s.totals.avatar_ai_created, 1);
    assert.equal(s.totals.fekra_proposal_saved, 1);
  } finally { await new Promise(r => server.close(r)); }
});
