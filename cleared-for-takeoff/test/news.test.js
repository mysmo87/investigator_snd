'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createNews, parseFeed, discoverFeeds, classify, selectItems } = require('../server/news');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');

const NOW = Date.parse('2026-11-22T10:00:00Z');
const ago = h => new Date(NOW - h * 3600000).toUTCString();
const rss = items => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>T</title>${items.map(i => `<item><title><![CDATA[${i.title}]]></title><link>${i.link}</link>${i.date ? `<pubDate>${i.date}</pubDate>` : ''}<description>${i.desc || ''}</description></item>`).join('')}</channel></rss>`;
const tech = { id: 'tech', name: 'Tech Daily', tier: 'global', scope: 'tech', lang: 'en', site: 'https://tech.example', hosts: ['tech.example'], feeds: ['https://tech.example/feed'], discover: false, enabled: true };
const gov = { id: 'gov', name: 'Gov News', nameAr: 'أخبار', tier: 'uae', scope: 'general', lang: 'en', site: 'https://gov.example', hosts: ['gov.example'], feeds: [], discover: true, enabled: true };
const off = { id: 'off', name: 'Licensed Wire', tier: 'global', scope: 'general', lang: 'en', site: 'https://wire.example', hosts: ['wire.example'], feeds: [], discover: false, enabled: false, status: 'needs_license', note: 'Needs a licence.' };

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push(url);
    const r = typeof routes === 'function' ? routes(url, opts) : routes[url];
    if (!r) return new Response('not found', { status: 404 });
    if (r instanceof Error) throw r;
    return new Response(r.body, { status: r.status || 200, headers: { 'content-type': r.type || 'application/rss+xml; charset=utf-8' } });
  };
  fn.calls = calls;
  return fn;
}
const cfg = (extra = {}) => { const c = loadConfig({ NEWS_VERIFY_LINKS: 'false', ...extra }); c.news.cacheFile = path.join(os.tmpdir(), `news-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`); return c; };

test('parses RSS 2.0 and Atom, unwrapping CDATA and entities', () => {
  const items = parseFeed(rss([{ title: 'AI &amp; borders: what&#8217;s next', link: 'https://tech.example/a?utm_source=x', date: ago(2) }]));
  assert.equal(items[0].title, 'AI & borders: what’s next');
  assert.equal(items[0].link, 'https://tech.example/a?utm_source=x');
  const atom = parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Smart gates</title><link rel="alternate" href="https://tech.example/b"/><updated>2026-11-21T08:00:00Z</updated><summary>s</summary></entry></feed>');
  assert.deepEqual([atom[0].title, atom[0].link, atom[0].date], ['Smart gates', 'https://tech.example/b', '2026-11-21T08:00:00Z']);
  assert.equal(parseFeed('<html><body>Error</body></html>'), null);
});

test('finds the feed a homepage declares', () => {
  const html = '<head><link rel="alternate" type="application/rss+xml" href="/en/rss.xml"><link rel="alternate" type="application/rss+xml" href="/comments/feed"><link rel="stylesheet" href="x.css"></head>';
  assert.deepEqual(discoverFeeds(html, 'https://gov.example/en'), ['https://gov.example/en/rss.xml']);
});

test('keeps Future Radar topics and drops unrelated news', () => {
  const c = t => (classify(t, '', { tier: 'regional', scope: 'general' }) || {}).bucket || null;
  assert.equal(c('Dubai Airports rolls out biometric smart gates'), 'borders');
  assert.equal(c('UAE launches new AI strategy for government services'), 'uae');
  assert.equal(c('OpenAI unveils agentic AI tools for developers'), 'ai');
  assert.equal(c('Quantum computing breakthrough announced'), 'ai');
  assert.equal(c('Cloud and 6G: the next wave of infrastructure'), 'future');
  for (const t of ['Arsenal beat Chelsea in Premier League thriller', 'Gold rate in Dubai today', 'Best AI laptop deals for Black Friday', 'Aid convoy reaches the border', 'Celebrity chef opens restaurant in Dubai'])
    assert.equal(c(t), t === 'Aid convoy reaches the border' ? 'borders' : null, t);
  assert.equal(classify('محمد بن راشد يطلق منصة الذكاء الاصطناعي', '', { tier: 'uae', scope: 'general' }).bucket, 'uae');
  assert.equal(classify('منتخب الإمارات يفوز في مباراة الدوري', '', { tier: 'uae', scope: 'general' }), null);
  // general outlets must match in the headline; technology publications may match in the summary
  assert.equal(classify('A new chapter for the city', 'Robots and AI agents', { tier: 'regional', scope: 'general' }), null);
  assert.equal(classify('A new chapter for the city', 'Robots and AI agents', { tier: 'global', scope: 'tech' }).bucket, 'ai');
});

test('weights the mix towards UAE news without padding with anything irrelevant', () => {
  const mk = (bucket, n, src) => Array.from({ length: n }, (_, k) => ({ bucket, sourceId: src + k % 5, t: NOW - (k + 1) * 3600000, title: bucket + k }));
  const pool = [...mk('uae', 20, 'u'), ...mk('ai', 12, 'a'), ...mk('borders', 3, 'b'), ...mk('future', 10, 'f')];
  const { items, windowDays } = selectItems(pool, { maxItems: 30, minItems: 12, now: NOW });
  const count = b => items.filter(i => i.bucket === b).length;
  assert.equal(items.length, 30); assert.equal(windowDays, 7);
  assert.equal(count('uae'), 12); assert.equal(count('borders'), 3); // borders falls short: its slots go to other relevant items
  assert.ok(count('ai') >= 8 && count('future') >= 5);
  assert.notEqual(items[0].bucket, items[1].bucket); // themes are spread through the loop
});

test('widens to 30 days only when the last 7 days are thin', () => {
  const pool = [{ bucket: 'ai', sourceId: 'a', t: NOW - 2 * 86400000, title: 'a' }, { bucket: 'uae', sourceId: 'b', t: NOW - 20 * 86400000, title: 'b' }, { bucket: 'ai', sourceId: 'c', t: NOW - 45 * 86400000, title: 'c' }];
  const r = selectItems(pool, { maxItems: 30, minItems: 12, now: NOW });
  assert.equal(r.windowDays, 30); assert.equal(r.items.length, 2);
});

test('end to end: live sources, safety checks, duplicates and source report', async () => {
  const fetchImpl = fakeFetch({
    'https://tech.example/feed': { body: rss([
      { title: 'New AI model sets agentic benchmark record', link: 'https://tech.example/ai-1', date: ago(3) },
      { title: 'New AI model sets agentic benchmark record!', link: 'https://tech.example/ai-1b', date: ago(4) }, // near-duplicate
      { title: 'Biometric e-gates expand across European airports', link: 'https://tech.example/bio', date: ago(5) },
      { title: 'Facial recognition story with no date at all', link: 'https://tech.example/nodate' },     // no date: dropped
      { title: 'Phishing link to a different site entirely', link: 'https://evil.example/x', date: ago(1) }, // off-domain: dropped
      { title: 'Football club signs new striker this week', link: 'https://tech.example/sport', date: ago(1) } // unrelated: dropped
    ]) },
    'https://gov.example': { type: 'text/html', body: '<link rel="alternate" type="application/rss+xml" href="https://gov.example/rss">' },
    'https://gov.example/rss': { body: rss([{ title: 'Dubai launches digital government platform for residents', link: 'https://gov.example/n1', date: ago(6) }, { title: 'Ministry hosts cultural evening in Abu Dhabi', link: 'https://gov.example/n2', date: ago(2) }]) }
  });
  const news = createNews({ config: cfg(), logger: silentLogger, fetchImpl, sources: [tech, gov, off], now: () => NOW });
  const snap = await news.refresh();
  assert.equal(snap.status, 'live');
  assert.deepEqual(snap.items.map(i => i.url).sort(), ['https://gov.example/n1', 'https://tech.example/ai-1', 'https://tech.example/bio']);
  const g = snap.items.find(i => i.sourceId === 'gov');
  assert.deepEqual([g.bucket, g.category, g.label, g.source, g.lang], ['uae', 'digital-government', 'Digital Government', 'Gov News', 'en']);
  assert.equal(snap.items.find(i => i.sourceId === 'tech' && i.bucket === 'borders').category, 'digital-identity'); // biometrics outranks airports
  assert.ok(snap.items.every(i => i.publishedAt && i.id && i.title));
  const rep = news.sourceReport();
  const byId = Object.fromEntries(rep.sources.map(s => [s.id, s]));
  assert.equal(byId.tech.status, 'live'); assert.equal(byId.gov.status, 'live'); assert.equal(byId.off.status, 'needs_license');
  assert.deepEqual(byId.gov.homepage.feedsDeclared, ['https://gov.example/rss']);
  assert.equal(byId.gov.feeds[0].from, 'discovered');
});

test('when sources fail, the last verified headlines stay, marked as cached, and survive a restart', async () => {
  let up = true;
  const config = cfg();
  const fetchImpl = fakeFetch(url => (up && url === 'https://tech.example/feed' ? { body: rss([{ title: 'Generative AI reshapes public services worldwide', link: 'https://tech.example/g', date: ago(2) }]) } : new TypeError('fetch failed')));
  const news = createNews({ config, logger: silentLogger, fetchImpl, sources: [tech], now: () => NOW });
  const first = await news.refresh();
  assert.equal(first.status, 'live');
  up = false;
  const second = await news.refresh();
  assert.equal(second.status, 'cached'); assert.equal(second.items.length, 1); assert.equal(second.updatedAt, first.updatedAt);
  assert.equal(news.sourceReport().sources[0].status, 'cached');
  // a new process starts from the disk cache before any fetch succeeds
  const again = createNews({ config, logger: silentLogger, fetchImpl, sources: [tech], now: () => NOW });
  again.start(); again.stop();
  assert.equal(again.snapshot().items[0].url, 'https://tech.example/g');
  fs.rmSync(config.news.cacheFile, { force: true });
});

test('a headline whose link is gone (404) is removed', async () => {
  const fetchImpl = fakeFetch({
    'https://tech.example/feed': { body: rss([{ title: 'Robotics startup unveils airport assistant robot', link: 'https://tech.example/gone', date: ago(2) }, { title: 'Digital identity wallets reach new milestone', link: 'https://tech.example/ok', date: ago(3) }]) },
    'https://tech.example/ok': { type: 'text/html', body: 'ok' }
  });
  const news = createNews({ config: cfg({ NEWS_VERIFY_LINKS: 'true' }), logger: silentLogger, fetchImpl, sources: [tech], now: () => NOW });
  const snap = await news.refresh();
  assert.deepEqual(snap.items.map(i => i.url), ['https://tech.example/ok']);
  assert.equal(snap.items[0].linkChecked, true);
});

test('nothing is fetched when news is switched off', async () => {
  const fetchImpl = fakeFetch({});
  const news = createNews({ config: cfg({ NEWS_ENABLED: 'false' }), logger: silentLogger, fetchImpl, sources: [tech], now: () => NOW });
  news.start();
  assert.equal(news.snapshot().status, 'disabled'); assert.equal(fetchImpl.calls.length, 0);
});
