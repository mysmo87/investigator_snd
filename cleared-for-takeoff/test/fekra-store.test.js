'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createStore } = require('../server/fekra-store');
const { createApp } = require('../server/app');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');
const { emptyProposal } = require('../server/fekra');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fekra-store-'));
const data = (title, extra = {}) => ({ status: 'draft', lang: 'en', title, payload: { proposal: { ...emptyProposal(), title }, messages: [{ role: 'user', text: 'idea' }] }, ...extra });

test('a saved proposal gets a reference and a private access code, and only that code opens it', async () => {
  const store = createStore({ dir: tmp() });
  const r = await store.create(data('Delay early-warning'));
  assert.match(r.ref, /^FK-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
  assert.match(r.key, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const rec = await store.get(r.ref, r.key.toLowerCase().replace(/-/g, ' '), null); // codes are forgiving about case and separators
  assert.equal(rec.title, 'Delay early-warning'); assert.equal(rec.version, 1); assert.equal(rec.status, 'draft');
  assert.ok(!('keyHash' in rec));
  await assert.rejects(store.get(r.ref, 'AAAA-AAAA-AAAA', null), e => e.status === 403);
  await assert.rejects(store.get(r.ref, '', null), e => e.status === 403);
  await assert.rejects(store.get('FK-000000-AAAA', r.key, null), e => e.status === 404);
  await assert.rejects(store.get('../../etc/passwd', r.key, null), e => e.status === 404);
});

test('updates keep earlier versions and refuse to overwrite newer work', async () => {
  const store = createStore({ dir: tmp() });
  const r = await store.create(data('v1'));
  const u = await store.update(r.ref, r.key, null, { baseVersion: 1, data: data('v2', { status: 'under_review' }) });
  assert.equal(u.version, 2); assert.equal(u.status, 'under_review');
  await assert.rejects(store.update(r.ref, r.key, null, { baseVersion: 1, data: data('stale') }), e => e.status === 409);
  const v = await store.versions(r.ref, r.key, null);
  assert.deepEqual(v.map(x => [x.version, x.title]), [[2, 'v2'], [1, 'v1']]);
  assert.equal((await store.get(r.ref, r.key, null)).data.proposal.title, 'v2');
});

test('with single sign-on, a proposal belongs to its owner', async () => {
  const store = createStore({ dir: tmp() });
  const r = await store.create(data('Mine'), 'aisha@gdrfa.example');
  assert.equal((await store.get(r.ref, r.key, 'aisha@gdrfa.example')).owner, 'aisha@gdrfa.example');
  await assert.rejects(store.get(r.ref, r.key, 'omar@gdrfa.example'), e => e.status === 403); // the code alone is not enough
  assert.deepEqual((await store.list('aisha@gdrfa.example')).map(x => x.title), ['Mine']);
  assert.deepEqual(await store.list('omar@gdrfa.example'), []);
  await assert.rejects(store.list(null), e => e.status === 403);
});

test('HTTP: save, reopen, update and protect a proposal', async () => {
  const dir = tmp();
  const config = loadConfig({ FEKRA_STORE_DIR: dir });
  const store = createStore({ dir, persistent: true });
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, store, rules: {}, content: {}, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (method, url, body, headers = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json() }));
  try {
    const payload = { proposal: { ...emptyProposal(), title: 'Delay early-warning', bogus: 'x' }, messages: [{ role: 'user', text: 'idea' }, { role: 'evil', text: 'x' }], locked: ['problem', 'nope'] };
    const c = await req('POST', '/api/fekra/proposals', { status: 'draft', lang: 'en', payload });
    assert.equal(c.status, 201);
    const g = await req('GET', `/api/fekra/proposals/${c.body.ref}`, null, { 'X-Fekra-Key': c.body.key });
    assert.equal(g.status, 200);
    assert.equal(g.body.data.proposal.title, 'Delay early-warning'); assert.ok(!('bogus' in g.body.data.proposal));
    assert.deepEqual(g.body.data.messages.map(m => m.role), ['user']); assert.deepEqual(g.body.data.locked, ['problem']);
    assert.equal((await req('GET', `/api/fekra/proposals/${c.body.ref}`, null, { 'X-Fekra-Key': 'WRONG-CODE' })).status, 403);
    const u = await req('PUT', `/api/fekra/proposals/${c.body.ref}`, { baseVersion: 1, status: 'finalized', lang: 'en', payload }, { 'X-Fekra-Key': c.body.key });
    assert.equal(u.status, 200); assert.equal(u.body.version, 2); assert.equal(u.body.status, 'finalized');
    assert.equal((await req('PUT', `/api/fekra/proposals/${c.body.ref}`, { baseVersion: 1, payload }, { 'X-Fekra-Key': c.body.key })).status, 409);
    assert.equal((await req('GET', '/api/fekra/proposals')).status, 403); // no listing without single sign-on
    const cfg = await req('GET', '/api/config');
    assert.deepEqual(cfg.body.fekra.storage, { available: true, persistent: true });
  } finally { server.close(); }
});
