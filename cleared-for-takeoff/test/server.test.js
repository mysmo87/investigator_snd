'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const rules = require('../public/shared/journey-rules.js');
const { createApp } = require('../server/app');
const { createRecommender } = require('../server/recommender');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');

async function start(env = {}) {
  const config = loadConfig(env);
  const recommender = createRecommender({ config, content, catalog, rules, logger: silentLogger });
  const server = http.createServer(createApp({ config, recommender, rules, content, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise(r => server.close(r)) };
}
const post = (base, body, headers = {}) => fetch(base + '/api/recommend', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('health and config endpoints expose no secrets', async () => {
  const s = await start({ ANTHROPIC_API_KEY: 'sk-ant-secret', SCHEDULE_MODE: 'fixed', PUBLIC_BASE_URL: 'https://kiosk.example.org/' });
  try {
    const h = await (await fetch(s.base + '/api/health')).json();
    assert.equal(h.status, 'ok');
    assert.equal(h.ai.enabled, true);
    const res = await fetch(s.base + '/api/config');
    const text = await res.text();
    assert.ok(!text.includes('sk-ant'));
    const c = JSON.parse(text);
    assert.equal(c.scheduleMode, 'fixed');
    assert.equal(c.publicBaseUrl, 'https://kiosk.example.org');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  } finally { await s.close(); }
});

test('recommend validates input strictly', async () => {
  const s = await start();
  try {
    assert.equal((await post(s.base, { role: 'gov', experience: 'beginner', interests: ['nope'] })).status, 400);
    assert.equal((await post(s.base, { role: 'gov', experience: 'beginner', interests: [] })).status, 400);
    assert.equal((await post(s.base, '{bad json')).status, 400);
    assert.equal((await post(s.base, { role: 'gov' }, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await post(s.base, { role: 'gov', experience: 'beginner', interests: ['gov'], pad: 'x'.repeat(5000) })).status, 413);
    const ok = await post(s.base, { role: 'gov', experience: 'beginner', interests: ['gov'], name: 'Should be ignored', sessions: [{ id: 's-public', status: 'live' }, { id: 'bogus', status: 'x' }] });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.source, 'rules');
    assert.equal(body.plan.stages.length, 4);
    assert.ok(!JSON.stringify(body).includes('Should be ignored'));
    assert.equal((await fetch(s.base + '/api/recommend')).status, 405);
  } finally { await s.close(); }
});

test('rate limits per client', async () => {
  const s = await start({ RATE_LIMIT_PER_MINUTE: '2' });
  try {
    const body = { role: 'gov', experience: 'beginner', interests: ['gov'] };
    assert.equal((await post(s.base, body)).status, 200);
    assert.equal((await post(s.base, body)).status, 200);
    const third = await post(s.base, body);
    assert.equal(third.status, 429);
    assert.ok(Number(third.headers.get('retry-after')) > 0);
  } finally { await s.close(); }
});

test('serves the kiosk with security headers and blocks traversal', async () => {
  const s = await start();
  try {
    const res = await fetch(s.base + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await res.text(), /<script src="app.js"><\/script>/);
    for (const p of ['/%2e%2e/package.json', '/..%2fserver/config.js', '/.env', '/data/../../server/app.js']) {
      assert.equal((await fetch(s.base + p)).status, 404, p);
    }
    assert.equal((await fetch(s.base + '/journey.html')).status, 200);
    assert.equal((await fetch(s.base + '/api/nope')).status, 404);
  } finally { await s.close(); }
});

test('invalid configuration is rejected with a clear message', () => {
  assert.throws(() => loadConfig({ AI_EFFORT: 'turbo' }), /AI_EFFORT must be one of/);
  assert.throws(() => loadConfig({ SCHEDULE_MODE: 'later' }), /SCHEDULE_MODE/);
  assert.throws(() => loadConfig({ EVENT_TIMEZONE: 'Mars/Base' }), /EVENT_TIMEZONE/);
  assert.throws(() => loadConfig({ IDLE_WARN_SECONDS: '100', IDLE_RESET_SECONDS: '90' }), /IDLE_WARN_SECONDS/);
  assert.equal(loadConfig({ RAILWAY_ENVIRONMENT_NAME: 'production' }).trustProxy, true);
  assert.equal(loadConfig({}).ai.enabled, false);
  assert.equal(loadConfig({ ANTHROPIC_API_KEY: 'k', AI_ENABLED: 'false' }).ai.enabled, false);
});

test('rejects cross-origin recommendation requests', async () => {
  const s = await start();
  try {
    const body = { role: 'gov', experience: 'beginner', interests: ['gov'] };
    assert.equal((await post(s.base, body, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(s.base, body, { origin: s.base })).status, 200);
  } finally { await s.close(); }
});
