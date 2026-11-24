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
const { createAvatar } = require('../server/avatar');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');

const PHOTO = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
const RESULT = 'data:image/jpeg;base64,' + Buffer.from('fake-avatar').toString('base64');

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/* fal is mocked: fetchImpl records each call and answers with `reply` */
function fakeFal(reply) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => { calls.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : null }); return reply(url, opts, calls.length); };
  return { calls, fetchImpl };
}

async function start(env = {}, reply = () => jsonResponse(200, { images: [{ url: RESULT }], has_nsfw_concepts: [false] })) {
  const config = loadConfig(env);
  const recommender = createRecommender({ config, content, catalog, rules, logger: silentLogger });
  const fal = fakeFal(reply);
  const avatar = createAvatar({ config, logger: silentLogger, fetchImpl: fal.fetchImpl });
  const server = http.createServer(createApp({ config, recommender, avatar, rules, content, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, fal, close: () => new Promise(r => server.close(r)) };
}
const post = (base, body, headers = {}) => fetch(base + '/api/avatar', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('the AI avatar is off without FAL_KEY, and the key never reaches the kiosk', async () => {
  const off = await start();
  try {
    assert.equal((await (await fetch(off.base + '/api/config')).json()).avatarAi.enabled, false);
    const r = await post(off.base, { image: PHOTO, consent: true });
    assert.equal(r.status, 503);
    assert.equal(off.fal.calls.length, 0);
  } finally { await off.close(); }
  const on = await start({ FAL_KEY: 'fal-secret-key' });
  try {
    const text = await (await fetch(on.base + '/api/config')).text();
    assert.equal(JSON.parse(text).avatarAi.enabled, true);
    assert.ok(!text.includes('fal-secret-key'));
    assert.ok(!(await (await fetch(on.base + '/api/health')).text()).includes('fal-secret-key'));
  } finally { await on.close(); }
});

test('generates an avatar with consent, sending the photo to fal with the key server-side', async () => {
  const s = await start({ FAL_KEY: 'fal-secret-key' });
  try {
    const r = await post(s.base, { image: PHOTO, consent: true });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { image: RESULT });
    assert.equal(s.fal.calls.length, 1);
    const call = s.fal.calls[0];
    assert.equal(call.url, 'https://fal.run/fal-ai/flux-pro/kontext');
    assert.equal(call.opts.headers.Authorization, 'Key fal-secret-key');
    assert.equal(call.body.image_url, PHOTO);
    assert.equal(call.body.sync_mode, true);
    assert.match(call.body.prompt, /3D/);
  } finally { await s.close(); }
});

test('rejects requests without consent, bad images, other origins and other methods', async () => {
  const s = await start({ FAL_KEY: 'k' });
  try {
    assert.equal((await post(s.base, { image: PHOTO })).status, 400);
    assert.equal((await post(s.base, { image: PHOTO, consent: 'yes' })).status, 400);
    assert.equal((await post(s.base, { image: 'https://example.com/x.jpg', consent: true })).status, 400);
    assert.equal((await post(s.base, { image: 'data:image/svg+xml;base64,PHN2Zz4=', consent: true })).status, 400);
    assert.equal((await post(s.base, { image: PHOTO, consent: true, style: 'nope' })).status, 400);
    assert.equal((await post(s.base, { image: PHOTO, consent: true }, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(s.base, { image: 'data:image/jpeg;base64,' + 'A'.repeat(1600 * 1024), consent: true })).status, 413);
    assert.equal((await fetch(s.base + '/api/avatar')).status, 405);
    assert.equal(s.fal.calls.length, 0);
  } finally { await s.close(); }
});

test('maps fal errors to clear messages and never resubmits', async () => {
  const s = await start({ FAL_KEY: 'k' }, () => jsonResponse(403, { detail: 'User is locked. Reason: Exhausted balance.' }));
  try {
    const r = await post(s.base, { image: PHOTO, consent: true });
    assert.equal(r.status, 503);
    const body = await r.json();
    assert.equal(body.reason, 'no_credits');
    assert.match(body.error, /credits/);
    assert.equal(s.fal.calls.length, 1);
  } finally { await s.close(); }
  const t = await start({ FAL_KEY: 'k' }, () => jsonResponse(500, { detail: 'internal' }));
  try {
    const r = await post(t.base, { image: PHOTO, consent: true });
    assert.equal(r.status, 502);
    assert.ok(!(await r.text()).includes('internal'));
    assert.equal(t.fal.calls.length, 1);
  } finally { await t.close(); }
});

test('blocks unsafe or unexpected results', async () => {
  const nsfw = await start({ FAL_KEY: 'k' }, () => jsonResponse(200, { images: [{ url: RESULT }], has_nsfw_concepts: [true] }));
  try { assert.equal((await post(nsfw.base, { image: PHOTO, consent: true })).status, 422); } finally { await nsfw.close(); }
  const foreign = await start({ FAL_KEY: 'k' }, () => jsonResponse(200, { images: [{ url: 'https://evil.example/a.jpg' }] }));
  try {
    assert.equal((await post(foreign.base, { image: PHOTO, consent: true })).status, 502);
    assert.equal(foreign.fal.calls.length, 1); // the foreign URL is never fetched
  } finally { await foreign.close(); }
  const odd = await start({ FAL_KEY: 'k' }, () => jsonResponse(200, { images: [{ url: 'data:image/jpeg;base64,"><script>' }] }));
  try { assert.equal((await post(odd.base, { image: PHOTO, consent: true })).status, 502); } finally { await odd.close(); }
});

test('a fal-hosted result is downloaded and returned inline', async () => {
  const bytes = Buffer.from('hosted-avatar');
  const s = await start({ FAL_KEY: 'k' }, url => url.startsWith('https://v3.fal.media/')
    ? new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } })
    : jsonResponse(200, { images: [{ url: 'https://v3.fal.media/files/x/avatar.jpg' }] }));
  try {
    const r = await post(s.base, { image: PHOTO, consent: true });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).image, 'data:image/jpeg;base64,' + bytes.toString('base64'));
    assert.equal(s.fal.calls.length, 2);
  } finally { await s.close(); }
});

test('the hourly spend guard stops further calls', async () => {
  const s = await start({ FAL_KEY: 'k', AVATAR_AI_MAX_CALLS_PER_HOUR: '1' });
  try {
    assert.equal((await post(s.base, { image: PHOTO, consent: true })).status, 200);
    const second = await post(s.base, { image: PHOTO, consent: true });
    assert.equal(second.status, 429);
    assert.equal((await second.json()).reason, 'hourly_budget');
    assert.equal(s.fal.calls.length, 1);
  } finally { await s.close(); }
});

test('a timeout is reported, not retried', async () => {
  const s = await start({ FAL_KEY: 'k', AVATAR_AI_TIMEOUT_MS: '10000' }, (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms === 10000 ? 20 : ms, ...a); // make the 10 s timeout fire quickly
  try {
    const r = await post(s.base, { image: PHOTO, consent: true });
    assert.equal(r.status, 504);
    assert.equal((await r.json()).reason, 'timeout');
    assert.equal(s.fal.calls.length, 1);
  } finally { global.setTimeout = realSetTimeout; await s.close(); }
});

test('config validates the avatar settings', () => {
  assert.throws(() => loadConfig({ AVATAR_AI_MODEL: 'not a model id' }), /AVATAR_AI_MODEL/);
  assert.throws(() => loadConfig({ AVATAR_AI_TIMEOUT_MS: '5' }), /AVATAR_AI_TIMEOUT_MS/);
  assert.equal(loadConfig({ FAL_KEY: 'k', AVATAR_AI_ENABLED: 'false' }).avatar.enabled, false);
});
