'use strict';
/* Live news for the ticker.

   Every NEWS_REFRESH_MINUTES (30 by default) the server reads the publishers' own RSS/Atom feeds
   (server-side, so there are no browser CORS limits), keeps only headlines relevant to the Future
   Radar themes, removes duplicates and builds a weighted mix:
     UAE government and local innovation 40% · AI and emerging technology 25%
     smart borders, immigration and digital identity 20% · global innovation and future trends 15%
   The weights are targets, never quotas: empty slots go to other relevant headlines, never to
   unrelated news. Headlines from the last 7 days come first; the window widens to 30 days when
   there are too few.

   Nothing is invented: every headline, link and date comes from a feed, and an item without a
   valid date or with a link off the publisher's own domain is dropped. When a source fails, its
   last verified headlines are kept; when everything fails, the last good result is served from the
   disk cache with the time of the last successful update. */

const fs = require('fs');
const path = require('path');
const DEFAULT_SOURCES = require('./news-sources');

const UA = 'Mozilla/5.0 (compatible; GITEX-AI-News-Ticker/1.0; +RSS reader)';
const MAX_FEED_BYTES = 3 * 1024 * 1024, MAX_PAGE_BYTES = 1536 * 1024;
const HOUR = 3600000, DAY = 24 * HOUR;
const WEIGHTS = { uae: .40, ai: .25, borders: .20, future: .15 };
const TIER_RANK = { uae: 0, regional: 1, global: 2 };
const LABELS = {
  'digital-government': ['Digital Government', 'الحكومة الرقمية'],
  'uae-innovation': ['UAE Innovation', 'ابتكار الإمارات'],
  ai: ['AI', 'الذكاء الاصطناعي'],
  'agentic-ai': ['Agentic AI', 'الذكاء الاصطناعي الوكيل'],
  'generative-ai': ['Generative AI', 'الذكاء الاصطناعي التوليدي'],
  'smart-borders': ['Smart Borders', 'الحدود الذكية'],
  'digital-identity': ['Digital Identity', 'الهوية الرقمية'],
  'smart-airports': ['Smart Airports', 'المطارات الذكية'],
  'emerging-tech': ['Emerging Technology', 'التقنيات الناشئة']
};

/* ---------- topic rules ---------- */
// English: whole words (letters/digits on neither side). Arabic: plain substrings, because Arabic attaches prefixes (ال، و، ب، ل).
const words = (list, flags = 'i') => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${list.join('|')})(?=$|[^\\p{L}\\p{N}])`, flags + 'u');
const subs = list => new RegExp(list.join('|'), 'u');
const EN = {
  aiCase: words(['AI', 'A\\.I\\.', 'GenAI', 'LLMs?', 'AGI'], ''),
  ai: words(['artificial intelligence', 'generative', 'gen ai', 'agentic', 'ai agents?', 'large language models?', 'language models?', 'machine learning', 'deep learning', 'neural networks?',
    'chatbots?', 'chatgpt', 'openai', 'anthropic', 'claude', 'deepmind', 'copilot', 'nvidia', 'robots?', 'robotics', 'humanoids?', 'autonomous', 'self-driving', 'driverless', 'robotaxis?', 'drones?',
    'automation', 'automated', 'quantum', 'computer vision']),
  borders: words(['immigration', 'immigrants?', 'visas?', 'e-?visas?', 'borders?', 'passports?', 'e-?gates?', 'smart gates?', 'biometrics?', 'facial recognition', 'face recognition', 'face biometrics',
    'fingerprints?', 'digital identity', 'digital ids?', 'identity verification', 'id verification', 'emirates id', 'residency', 'residence permits?', 'travel documents?', 'seamless travel',
    'seamless journeys?', 'passenger journeys?', 'passengers?', 'airports?', 'customs', 'deepfakes?', 'liveness', 'etias', 'boarding pass(?:es)?']),
  identity: words(['biometrics?', 'facial recognition', 'face recognition', 'face biometrics', 'fingerprints?', 'digital identity', 'digital ids?', 'identity verification', 'id verification', 'emirates id', 'deepfakes?', 'liveness', 'identity']),
  airport: words(['airports?', 'passengers?', 'passenger journeys?', 'seamless travel', 'seamless journeys?', 'boarding pass(?:es)?', 'airlines?', 'aviation']),
  tech: words(['innovation', 'innovative', 'innovat\\w*', 'digital', 'digiti[sz]ation', 'technology', 'technologies', 'tech', 'cyber\\w*', 'cloud', 'blockchain', 'metaverse', '5g', '6g', 'iot',
    'internet of things', 'startups?', 'fintech', 'govtech', 'e-government', 'smart (?:city|cities|government|services?|gates?|police|mobility|airports?|systems?|solutions?|technology|infrastructure|grid)',
    'digital twins?', 'super ?apps?', 'semiconductors?', 'chips?', 'data cent(?:er|re)s?', 'supercomput\\w*', 'satellites?', 'space tech\\w*', 'electric vehicles?', 'evs', 'breakthroughs?',
    'emerging tech\\w*', 'future of', 'hackathons?', 'gitex']),
  gov: words(['government', 'governments', 'ministry', 'authority', 'federal', 'municipality', 'police', 'rta', 'dewa', 'public sector', 'public services?', 'e-government', 'digital government',
    'smart government', 'gdrfa', 'icp', 'digital dubai', 'smart dubai', 'executive council', 'sheikh']),
  uae: words(['uae', 'u\\.a\\.e\\.', 'emirates', 'emirati', 'dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'fujairah', 'umm al quwain', 'gdrfa', 'icp']),
  // global innovation and future trends: stronger signals than the broad technology words used for UAE stories
  future: words(['innovation', 'innovations', 'innovative', 'breakthroughs?', 'emerging tech\\w*', 'future of', 'next[- ]generation', '6g', '5g', 'metaverse', 'smart cit(?:y|ies)', 'digital twins?',
    'supercomput\\w*', 'space tech\\w*', 'satellites?', 'semiconductors?', 'chips?', 'data cent(?:er|re)s?', 'cyber ?security', 'cyberattacks?', 'blockchain', 'digital transformation',
    'digital government', 'e-government', 'govtech', 'iot', 'internet of things', 'smart (?:government|services?|infrastructure|grid|mobility)']),
  agentic: words(['agentic', 'ai agents?']),
  generative: words(['generative', 'gen ?ai', 'llms?', 'large language models?', 'chatgpt', 'chatbots?']),
  exclude: words(['football', 'soccer', 'cricket', 'tennis', 'golf', 'f1', 'formula (?:1|one)', 'grand prix', 'nba', 'nfl', 'fifa', 'uefa', 'premier league', 'champions league', 'tournament', 'world cup',
    'olympic\\w*', 'marathon', 'racing', 'jockey', 'striker', 'goalkeeper', 'celebrit\\w*', 'actor', 'actress', 'films?', 'movies?', 'box office', 'music', 'concerts?', 'singer', 'albums?', 'bollywood',
    'hollywood', 'k-pop', 'oscars?', 'grammys?', 'fashion', 'red carpet', 'tv shows?', 'reality show', 'opinion', 'op-ed', 'editorial', 'elections?', 'electoral', 'campaign trail', 'democrats?',
    'republicans?', 'trump', 'biden', 'senators?', 'congress', 'protests?', 'war', 'ceasefire', 'gaza', 'israel\\w*', 'ukrain\\w*', 'russia\\w*', 'hamas', 'missiles?', 'horoscopes?', 'astrology',
    'zodiac', 'recipes?', 'lottery', 'raffle', 'big ticket', 'prize draw', 'gold (?:rate|price)s?', 'weather', 'black friday', 'cyber monday', 'prime day', 'gift guides?', '\\d+% off', 'coupons?',
    'promo codes?', 'best .{0,40} deals', 'obituar\\w*', 'murder\\w*', 'killed', 'arrested', 'jailed'])
};
const AR = {
  ai: subs(['الذكاء الاصطناعي', 'ذكاء اصطناعي', 'التعلم الآلي', 'روبوت', 'ذاتية القيادة', 'ذاتي القيادة', 'الأتمتة', 'الحوسبة الكمية', 'بدون طيار', 'التوليدي', 'الوكيل الذكي', 'الوكلاء الأذكياء']),
  borders: subs(['الإقامة وشؤون الأجانب', 'إقامة دبي', 'تأشير', 'جواز', 'المنافذ', 'الحدود', 'البوابات الذكية', 'البصمة', 'التعرف على الوجه', 'الهوية الرقمية', 'بطاقة الهوية', 'المطار', 'مطار', 'المسافرين', 'الهجرة', 'الهوية والجنسية']),
  identity: subs(['البصمة', 'التعرف على الوجه', 'الهوية الرقمية', 'بطاقة الهوية', 'الهوية والجنسية', 'البيومتري']),
  airport: subs(['المطار', 'مطار', 'المسافرين', 'الطيران']),
  tech: subs(['الابتكار', 'ابتكار', 'مبتكر', 'الرقمي', 'الرقمية', 'رقمي', 'رقمية', 'التكنولوجيا', 'تكنولوجيا', 'التقنية', 'تقنية', 'تقني', 'السيبراني', 'البلوك تشين', 'الميتافيرس', 'المدن الذكية',
    'الحكومة الذكية', 'الخدمات الذكية', 'ذكي', 'ذكية', 'الشركات الناشئة', 'التحول الرقمي', 'الفضاء', 'جيتكس', 'المستقبل']),
  gov: subs(['حكومة', 'الحكومة', 'وزارة', 'هيئة', 'الهيئة', 'دائرة', 'بلدية', 'شرطة', 'الحكومي', 'الحكومية', 'إقامة دبي', 'الإدارة العامة للإقامة']),
  uae: subs(['الإمارات', 'إماراتي', 'دبي', 'أبوظبي', 'أبو ظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين']),
  future: subs(['الابتكار', 'ابتكار', 'التحول الرقمي', 'المدن الذكية', 'الحكومة الذكية', 'الحكومة الرقمية', 'الأمن السيبراني', 'الميتافيرس', 'البلوك تشين', 'الفضاء', 'المستقبل']),
  agentic: subs(['الوكيل الذكي', 'الوكلاء الأذكياء', 'الذكاء الاصطناعي الوكيل']),
  generative: subs(['التوليدي']),
  exclude: subs(['كرة القدم', 'مباراة', 'الدوري', 'بطولة', 'منتخب', 'فيلم', 'مسلسل', 'فنان', 'مطرب', 'حفل غنائي', 'الأبراج', 'يانصيب', 'انتخابات', 'الحرب', 'غزة', 'إسرائيل', 'أوكرانيا', 'روسيا', 'الطقس', 'أمطار', 'سباق'])
};
const isArabic = s => /[\u0600-\u06ff]/.test(s);

/* Which theme a headline belongs to, or null if it is not relevant. General outlets must match in the title. */
function classify(title, summary, source) {
  const K = isArabic(title) ? AR : EN;
  if (K.exclude.test(title)) return null;
  const has = (k, s) => !!s && (K[k].test(s) || (k === 'ai' && K === EN && EN.aiCase.test(s)));
  const sum = source.scope === 'tech' ? summary : '';
  const tAi = has('ai', title), tBorders = has('borders', title), tTech = has('tech', title), tFuture = has('future', title);
  const uae = source.tier === 'uae' || has('uae', title);
  let bucket = null;
  if (tBorders) bucket = 'borders';
  else if (uae && (tAi || tTech || (sum && (has('ai', sum) || has('tech', sum))))) bucket = 'uae';
  else if (tAi) bucket = 'ai';
  else if (tFuture) bucket = 'future';
  else if (sum) bucket = has('borders', sum) ? 'borders' : has('ai', sum) ? 'ai' : has('future', sum) ? 'future' : null;
  if (!bucket) return null;
  const both = title + ' ' + sum;
  let category;
  if (bucket === 'borders') category = has('identity', both) ? 'digital-identity' : has('airport', both) ? 'smart-airports' : 'smart-borders';
  else if (bucket === 'uae') category = has('gov', title) ? 'digital-government' : tAi ? aiCategory(K, title) : 'uae-innovation';
  else if (bucket === 'ai') category = aiCategory(K, both);
  else category = 'emerging-tech';
  return { bucket, category };
}
function aiCategory(K, s) { return K.agentic.test(s) ? 'agentic-ai' : K.generative.test(s) ? 'generative-ai' : 'ai'; }

/* ---------- RSS / Atom parsing (no dependencies) ---------- */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', laquo: '«', raquo: '»', middot: '·', bull: '•', eacute: 'é', copy: '©', reg: '®', trade: '™' };
function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
const unwrap = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const text = s => decode(unwrap(s).replace(/<[^>]*>/g, ' ').replace(/&lt;[\s\S]*?&gt;/g, ' ')).replace(/\s+/g, ' ').trim();
function tag(block, names) {
  for (const n of names) {
    const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i').exec(block);
    if (m) return m[1];
  }
  return '';
}
function attr(tagSrc, name) { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tagSrc); return m ? decode(m[2] ?? m[3]) : null; }
function parseFeed(xml) {
  xml = String(xml || '');
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml.slice(0, 5000))) return null; // not a feed (an HTML error page, for example)
  const items = [];
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < 300) {
    const b = m[2];
    let link = text(tag(b, ['feedburner:origLink']));
    if (!link) {
      const atomLinks = b.match(/<link\b[^>]*\/?>/gi) || [];
      const alt = atomLinks.find(l => attr(l, 'href') && (!attr(l, 'rel') || attr(l, 'rel') === 'alternate'));
      link = alt ? attr(alt, 'href') : text(tag(b, ['link']));
    }
    if (!link) { const g = /<guid\b([^>]*)>([\s\S]*?)<\/guid>/i.exec(b); if (g && !/isPermaLink\s*=\s*["']false/i.test(g[1])) link = text(g[2]); }
    items.push({
      title: text(tag(b, ['title'])),
      link: (link || '').trim(),
      date: text(tag(b, ['pubDate', 'dc:date', 'published', 'updated', 'a10:updated', 'dc:created'])),
      summary: text(tag(b, ['description', 'summary', 'content:encoded', 'content'])).slice(0, 600)
    });
  }
  return items;
}
/* <link rel="alternate" type="application/rss+xml" href="…"> tags a homepage declares */
/* links a page shows to its RSS page or feeds (an "RSS" link in the footer, for example), on the same site */
function rssLinks(html, base) {
  const out = [], baseHost = (() => { try { return new URL(base).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  for (const a of String(html || '').match(/<a\b[^>]*>[\s\S]{0,200}?<\/a>/gi) || []) {
    const href = attr(a, 'href'); if (!href) continue;
    const label = text(a);
    if (!/(^|[\/._?=-])(rss|feeds?|atom)([\/._?=-]|$)|\.rss($|\?)/i.test(href) && !/^\s*rss\s*$/i.test(label)) continue;
    if (/comments?\/feed|facebook|twitter|x\.com|instagram|linkedin|youtube|whatsapp|mailto:/i.test(href)) continue;
    try { const u = new URL(href, base); if (/^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, '').endsWith(baseHost) && !out.includes(u.href)) out.push(u.href); } catch { /* bad href */ }
  }
  return out.slice(0, 6);
}
function discoverFeeds(html, base) {
  const out = [];
  for (const l of String(html || '').match(/<link\b[^>]*>/gi) || []) {
    const rel = (attr(l, 'rel') || '').toLowerCase(), type = (attr(l, 'type') || '').toLowerCase(), href = attr(l, 'href');
    if (!href || !rel.split(/\s+/).includes('alternate') || !/application\/(rss|atom)\+xml/.test(type)) continue;
    if (/comments?\/feed|\/comments\b/i.test(href)) continue;
    try { const u = new URL(href, base); if (/^https?:$/.test(u.protocol) && !out.includes(u.href)) out.push(u.href); } catch { /* bad href */ }
  }
  return out.slice(0, 3);
}

/* ---------- item hygiene ---------- */
function onHosts(u, hosts) { return hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h)); }
function cleanUrl(link, source) {
  let u; try { u = new URL(link, source.site); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || !onHosts(u, source.hosts)) return null;
  [...u.searchParams.keys()].forEach(k => { if (/^(utm_|fbclid|gclid|mc_)/i.test(k)) u.searchParams.delete(k); });
  u.hash = '';
  return u.href;
}
const normTitle = t => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = t => new Set(normTitle(t).split(' ').filter(w => w.length > 2));
function similar(a, b) { const A = tokens(a), B = tokens(b); if (A.size < 4 || B.size < 4) return false; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / (A.size + B.size - n) >= .75; }
function hashId(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

function toItems(raw, source, now) {
  const out = [];
  for (const r of raw) {
    let title = r.title.replace(/\s+[-–|]\s+(?:[^-–|]{2,40})$/, m => (source.name && m.toLowerCase().includes(source.name.toLowerCase()) ? '' : m)).trim();
    if (title.length < 12) continue;
    if (title.length > 180) title = title.slice(0, 177).replace(/\s+\S*$/, '') + '…';
    const url = cleanUrl(r.link, source);
    const t = Date.parse(r.date);
    if (!url || !Number.isFinite(t) || t > now + 12 * HOUR) continue; // never invent or guess a link or a date
    const lang = isArabic(title) ? 'ar' : 'en';
    out.push({ title, url, t, lang, summary: r.summary, sourceId: source.id });
  }
  return out;
}

/* weighted mix, then spread so each theme recurs evenly through the loop */
function selectItems(pool, { maxItems, minItems, now }) {
  const within = days => pool.filter(i => now - i.t <= days * DAY);
  let windowDays = 7, list = within(7);
  if (list.length < minItems) { windowDays = 30; list = within(30); }
  let stale = false;
  if (!list.length && pool.length) { list = pool.filter(i => now - i.t <= 90 * DAY); stale = list.length > 0; windowDays = 90; }
  list = [...list].sort((a, b) => b.t - a.t);
  const N = Math.min(maxItems, list.length), cap = Math.max(4, Math.ceil(N * .3));
  const chosen = new Set(), perSource = {};
  const pick = (i, capped = true) => { if (chosen.size >= N || chosen.has(i) || (capped && (perSource[i.sourceId] || 0) >= cap)) return false; chosen.add(i); perSource[i.sourceId] = (perSource[i.sourceId] || 0) + 1; return true; };
  for (const [b, w] of Object.entries(WEIGHTS)) { const target = Math.round(N * w); let n = 0; for (const i of list) { if (n >= target) break; if (i.bucket === b && pick(i)) n++; } }
  const softCap = Math.max(cap, Math.ceil(N * .5));
  for (const [b, w] of Object.entries(WEIGHTS)) { // a theme short of its target may go past the per-source cap (to half the list) before others take its slots
    let n = [...chosen].filter(i => i.bucket === b).length; const target = Math.round(N * w);
    for (const i of list) { if (n >= target) break; if (i.bucket === b && !chosen.has(i) && (perSource[i.sourceId] || 0) < softCap && pick(i, false)) n++; }
  }
  for (const i of list) pick(i);           // unused slots go to the newest other relevant headlines
  for (const i of list) pick(i, false);    // and only then past the per-source cap
  const by = {}; [...chosen].sort((a, b) => b.t - a.t).forEach(i => (by[i.bucket] = by[i.bucket] || []).push(i));
  const total = chosen.size, taken = {}, out = [];
  while (out.length < total) {
    let best = null, score = -Infinity;
    for (const b of Object.keys(by)) { if (!by[b].length) continue; const s = (by[b].length + (taken[b] || 0)) / total * (out.length + 1) - (taken[b] || 0); if (s > score) { score = s; best = b; } }
    out.push(by[best].shift()); taken[best] = (taken[best] || 0) + 1;
  }
  return { items: out, windowDays, stale };
}

/* ---------- the service ---------- */
function createNews({ config, logger, fetchImpl = globalThis.fetch, sources: sourcesOverride, now: nowFn = Date.now }) {
  const nc = config.news;
  let sources = sourcesOverride || DEFAULT_SOURCES;
  if (!sourcesOverride && nc.sourcesFile) {
    try { sources = JSON.parse(fs.readFileSync(nc.sourcesFile, 'utf8')); } catch (e) { logger.error('news_sources_file_invalid', { detail: String(e.message).slice(0, 200) }); }
  }
  const state = { sources: {}, links: new Map(), updatedAt: null, checkedAt: null, running: null, snapshot: null, run: 0 };
  sources.forEach(s => { state.sources[s.id] = { items: [], lastSuccessAt: null, lastError: null, feeds: [], discovered: null, discoveredAt: 0, parsed: 0, relevant: 0, http: {} }; });

  async function get(url, { limit, accept, etag, lastModified, signalMs = nc.timeoutMs } = {}) {
    const headers = { 'User-Agent': UA, Accept: accept || 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5', 'Accept-Language': 'en,ar;q=0.8' };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;
    const res = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(signalMs) });
    if (res.status === 304 || !res.ok) { try { await res.body?.cancel(); } catch { /* ignore */ } return { status: res.status, headers: res.headers }; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > limit) return { status: res.status, error: 'too_large', headers: res.headers };
    const ct = res.headers.get('content-type') || '';
    let charset = (/charset=([\w-]+)/i.exec(ct) || [])[1] || (/<\?xml[^>]*encoding=["']([\w-]+)/i.exec(buf.subarray(0, 200).toString('latin1')) || [])[1] || 'utf-8';
    let body; try { body = new TextDecoder(charset.toLowerCase()).decode(buf); } catch { body = buf.toString('utf8'); }
    return { status: res.status, body, headers: res.headers };
  }
  const errName = e => (e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'timeout' : (e && e.cause && e.cause.code) || (e && e.code) || 'network');

  async function refreshSource(src) {
    const st = state.sources[src.id], now = nowFn();
    if (!src.enabled) return;
    const feeds = src.feeds.map(url => ({ url, from: 'configured' }));
    if (src.discover) {
      if (!st.discovered || now - st.discoveredAt > 12 * HOUR) {
        try {
          const r = await get(src.site, { limit: MAX_PAGE_BYTES, accept: 'text/html,application/xhtml+xml' });
          st.discoverStatus = r.status; st.discovered = r.body ? discoverFeeds(r.body, src.site) : []; st.rssLinks = r.body ? rssLinks(r.body, src.site) : [];
          // no declared feed: follow the site's own RSS links (a feed directly, or an RSS page that lists feeds)
          if (!st.discovered.length) {
            for (const link of st.rssLinks.slice(0, 4)) {
              try {
                const p = await get(link, { limit: MAX_PAGE_BYTES });
                if (!p.body) continue;
                if (parseFeed(p.body)) { st.discovered.push(link); continue; }
                const more = [...discoverFeeds(p.body, link), ...rssLinks(p.body, link).filter(u => /\.(rss|xml)($|\?)|\/(rss|feed)\/?($|\?)/i.test(u))];
                more.forEach(u => { if (!st.discovered.includes(u) && st.discovered.length < 4) st.discovered.push(u); });
              } catch { /* try the next link */ }
            }
          }
        } catch (e) { st.discovered = []; st.rssLinks = []; st.discoverStatus = errName(e); }
        st.discoveredAt = now;
      }
      st.discovered.forEach(url => { if (!feeds.some(f => f.url === url)) feeds.push({ url, from: 'discovered' }); });
    }
    const results = await Promise.all(feeds.map(async f => {
      const prev = st.http[f.url] || {};
      try {
        const r = await get(f.url, { limit: MAX_FEED_BYTES, etag: prev.etag, lastModified: prev.lastModified });
        if (r.status === 304 && prev.raw) return { ...f, status: 304, raw: prev.raw };
        if (!r.body) return { ...f, status: r.status, error: r.error || `http_${r.status}` };
        const raw = parseFeed(r.body);
        if (!raw) return { ...f, status: r.status, error: 'not_a_feed' };
        st.http[f.url] = { etag: r.headers.get('etag'), lastModified: r.headers.get('last-modified'), raw };
        return { ...f, status: r.status, raw };
      } catch (e) { return { ...f, error: errName(e) }; }
    }));
    st.feeds = results.map(r => ({ url: r.url, from: r.from, httpStatus: r.status || null, items: r.raw ? r.raw.length : 0, error: r.error || null }));
    const okFeeds = results.filter(r => r.raw);
    if (!okFeeds.length) {
      const home = st.discoverStatus, homeErr = home == null ? null : typeof home === 'number' ? (home >= 400 ? `homepage_http_${home}` : null) : `homepage_${home}`;
      st.lastError = feeds.length ? (results.find(r => r.error) || {}).error || 'no_items' : homeErr || 'no_feed_found'; return;
    }
    const items = toItems(okFeeds.flatMap(r => r.raw), src, now);
    st.parsed = items.length;
    st.items = items.map(i => ({ ...i, ...classify(i.title, i.summary, src) })).filter(i => i.bucket);
    st.relevant = st.items.length;
    st.lastSuccessAt = now; st.okRun = state.run; st.lastError = null;
  }

  /* Link check for headlines about to be shown: only a definite 404/410 removes a story. Many publishers
     refuse automated requests (401/403/429), so those count as unconfirmed, not broken. */
  async function checkLinks(items) {
    const now = nowFn(), todo = items.filter(i => { const c = state.links.get(i.url); return !c || now - c.at > DAY; });
    for (let k = 0; k < todo.length; k += 4) {
      await Promise.all(todo.slice(k, k + 4).map(async i => {
        let status = null;
        try { const r = await fetchImpl(i.url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(8000) }); status = r.status; try { await r.body?.cancel(); } catch { /* ignore */ } }
        catch (e) { status = errName(e); }
        state.links.set(i.url, { at: now, status, broken: status === 404 || status === 410 });
      }));
    }
    if (state.links.size > 2000) [...state.links.keys()].slice(0, state.links.size - 2000).forEach(k => state.links.delete(k));
  }

  function buildSnapshot() {
    const now = nowFn(), all = [];
    sources.forEach(src => { if (src.enabled) state.sources[src.id].items.forEach(i => all.push({ ...i, tier: src.tier, src })); });
    // duplicates: same link, same title, or a near-identical headline; keep the official/regional copy first, then the newest
    all.sort((a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || (b.t - a.t));
    const kept = [], urls = new Set(), titles = new Set();
    for (const i of all) {
      const k = normTitle(i.title);
      if (urls.has(i.url) || titles.has(k) || kept.some(j => similar(j.title, i.title))) continue;
      const link = state.links.get(i.url); if (link && link.broken) continue;
      urls.add(i.url); titles.add(k); kept.push(i);
    }
    const { items, windowDays, stale } = selectItems(kept, { maxItems: nc.maxItems, minItems: Math.min(12, nc.maxItems), now });
    const shownBy = {}; items.forEach(i => { shownBy[i.sourceId] = (shownBy[i.sourceId] || 0) + 1; });
    const live = sources.filter(s => s.enabled && state.sources[s.id].okRun === state.run && state.run > 0).length;
    const status = !items.length ? 'unavailable' : stale ? 'cached' : live ? 'live' : 'cached';
    const mix = {}; items.forEach(i => { mix[i.bucket] = (mix[i.bucket] || 0) + 1; });
    state.snapshot = {
      status, updatedAt: state.updatedAt ? new Date(state.updatedAt).toISOString() : null, checkedAt: state.checkedAt ? new Date(state.checkedAt).toISOString() : null,
      refreshMinutes: nc.refreshMinutes, windowDays, mix,
      items: items.map(i => {
        const link = state.links.get(i.url);
        return { id: hashId(i.url), title: i.title, url: i.url, source: i.lang === 'ar' && i.src.nameAr ? i.src.nameAr : i.src.name, sourceId: i.sourceId, lang: i.lang,
          publishedAt: new Date(i.t).toISOString(), bucket: i.bucket, category: i.category, label: LABELS[i.category][i.lang === 'ar' ? 1 : 0], linkChecked: !!(link && typeof link.status === 'number' && link.status < 400) };
      })
    };
    state.shownBy = shownBy;
    return state.snapshot;
  }

  async function refresh() {
    if (state.running) return state.running;
    state.running = (async () => {
      const started = nowFn(); state.run += 1;
      await Promise.all(sources.map(s => refreshSource(s).catch(e => { state.sources[s.id].lastError = errName(e); })));
      state.checkedAt = started;
      if (sources.some(s => s.enabled && state.sources[s.id].okRun === state.run)) state.updatedAt = nowFn();
      let snap = buildSnapshot();
      if (nc.verifyLinks && snap.items.length) {
        await checkLinks(snap.items.map(i => ({ url: i.url })));
        snap = buildSnapshot(); // drop any definite 404s and refill
      }
      saveCache();
      logger.info('news_refresh', { status: snap.status, items: snap.items.length, windowDays: snap.windowDays, mix: snap.mix, ms: nowFn() - started, sourcesOk: sources.filter(s => state.sources[s.id].okRun === state.run).map(s => s.id) });
      return snap;
    })().finally(() => { state.running = null; });
    return state.running;
  }

  function saveCache() {
    if (!nc.cacheFile) return;
    try {
      const data = { savedAt: new Date().toISOString(), updatedAt: state.updatedAt, sources: Object.fromEntries(sources.map(s => [s.id, { items: state.sources[s.id].items, lastSuccessAt: state.sources[s.id].lastSuccessAt }])) };
      fs.mkdirSync(path.dirname(nc.cacheFile), { recursive: true });
      fs.writeFileSync(nc.cacheFile + '.tmp', JSON.stringify(data)); fs.renameSync(nc.cacheFile + '.tmp', nc.cacheFile);
    } catch (e) { logger.warn('news_cache_write_failed', { detail: String(e.message).slice(0, 200) }); }
  }
  function loadCache() {
    if (!nc.cacheFile) return;
    try {
      const data = JSON.parse(fs.readFileSync(nc.cacheFile, 'utf8'));
      sources.forEach(s => { const c = data.sources && data.sources[s.id]; if (c && Array.isArray(c.items)) { state.sources[s.id].items = c.items.filter(i => i && i.title && i.url && Number.isFinite(i.t) && i.bucket && LABELS[i.category]); state.sources[s.id].lastSuccessAt = c.lastSuccessAt || null; } });
      state.updatedAt = data.updatedAt || null;
      buildSnapshot();
    } catch { /* no cache yet */ }
  }

  let timer = null;
  function start() {
    if (!nc.enabled) return;
    loadCache();
    refresh().catch(e => logger.warn('news_refresh_failed', { detail: String(e && e.message).slice(0, 200) }));
    timer = setInterval(() => refresh().catch(() => {}), nc.refreshMinutes * 60000); timer.unref();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  function snapshot() {
    if (!nc.enabled) return { status: 'disabled', items: [], refreshMinutes: nc.refreshMinutes };
    if (!state.snapshot) { if (!state.running) refresh().catch(() => {}); return { status: 'loading', items: [], refreshMinutes: nc.refreshMinutes, updatedAt: null }; }
    return state.snapshot;
  }
  /* what each source is doing: shown at /api/news/sources so operators can see which integrations work */
  function sourceReport() {
    return {
      checkedAt: state.checkedAt ? new Date(state.checkedAt).toISOString() : null, updatedAt: state.updatedAt ? new Date(state.updatedAt).toISOString() : null,
      sources: sources.map(s => {
        const st = state.sources[s.id];
        const status = !s.enabled ? (s.status || 'disabled') : st.okRun === state.run && state.run > 0 ? 'live' : st.lastSuccessAt ? 'cached' : state.checkedAt ? 'not_working' : 'pending';
        return { id: s.id, name: s.name, tier: s.tier, lang: s.lang, status, note: s.note || null, lastSuccessAt: st.lastSuccessAt ? new Date(st.lastSuccessAt).toISOString() : null, lastError: st.lastError,
          homepage: s.discover ? { url: s.site, httpStatus: st.discoverStatus ?? null, feedsDeclared: st.discovered || [], rssLinks: st.rssLinks || [] } : undefined,
          feeds: st.feeds, headlinesWithDates: st.parsed, relevant: st.relevant, shown: (state.shownBy && state.shownBy[s.id]) || 0 };
      })
    };
  }
  function stats() { const s = state.snapshot; return { enabled: nc.enabled, status: s ? s.status : 'loading', items: s ? s.items.length : 0, updatedAt: s ? s.updatedAt : null }; }

  return { start, stop, refresh, snapshot, sourceReport, stats, _internals: { parseFeed, discoverFeeds, classify, selectItems, toItems, similar, state } };
}

module.exports = { createNews, parseFeed, discoverFeeds, rssLinks, classify, selectItems, LABELS, WEIGHTS };
