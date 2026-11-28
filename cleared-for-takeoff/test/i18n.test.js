'use strict';
/* English / Arabic: every string the kiosk shows has an Arabic translation, the Arabic content lines up with the
   English content, and the journey rules and recommender write Arabic when asked. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const I18N = require('../public/i18n.js');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const contentAr = require('../public/data/content-ar.js');
const { localizeContent, localizeCatalog } = require('../public/shared/localize.js');
const rules = require('../public/shared/journey-rules.js');
const { createRecommender } = require('../server/recommender');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');

const pub = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const literals = (src, fn) => [...src.matchAll(new RegExp(`\\b${fn}\\('((?:[^'\\\\]|\\\\.)*)'`, 'g'))].map(m => m[1].replace(/\\'/g, "'"));
const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('every kiosk string has an Arabic translation with the same placeholders', () => {
  const app = pub('app.js');
  const keys = new Set([...literals(app, 'tr'), ...literals(app, '_t')]);
  const html = pub('index.html');
  for (const m of html.matchAll(/data-i18n(?:-aria|-title|-placeholder)?="([^"]+)"/g)) keys.add(m[1].replace(/&amp;/g, '&'));
  // English questions and content values that the kiosk shows through tr()
  [...content.defaultSuggestions, ...content.askTopics.flatMap(t => t.qs), ...content.demos.flatMap(d => d.questions)].forEach(q => keys.add(q));
  content.sessions.forEach(s => { keys.add(s.type); keys.add(s.type.toLowerCase()); });
  content.tracks.forEach(t => keys.add(t.level));
  catalog.courses.forEach(c => { keys.add(c.format); if (c.category) keys.add(c.category); });
  const missing = [...keys].filter(k => !Object.prototype.hasOwnProperty.call(I18N.AR, k));
  assert.deepEqual(missing, [], 'strings without Arabic');
  for (const [k, v] of Object.entries(I18N.AR)) assert.deepEqual(placeholders(v), placeholders(k), `placeholders differ for: ${k}`);
});

test('tr() fills placeholders and falls back to English', () => {
  I18N.setLang('ar');
  try {
    assert.equal(I18N.tr('Welcome, {n}!', { n: 'Aisha' }), 'أهلاً Aisha!');
    assert.equal(I18N.tr('Not translated {x}', { x: 1 }), 'Not translated 1');
  } finally { I18N.setLang('en'); }
  assert.equal(I18N.tr('Welcome, {n}!', { n: 'Aisha' }), 'Welcome, Aisha!');
});

test('the Arabic content matches the English content item for item', () => {
  const lists = ['roles', 'experience', 'interests', 'tracks', 'demos', 'sessions', 'news', 'newsCats'];
  for (const k of lists) {
    const ids = new Set(content[k].map(x => x.id));
    for (const id of Object.keys(contentAr[k])) assert.ok(ids.has(id), `${k}.${id} is not in content.js`);
    for (const id of ids) assert.ok(contentAr[k][id], `${k}.${id} has no Arabic`);
  }
  const same = (a, b, where) => assert.equal((a || []).length, (b || []).length, `${where}: different number of items`);
  content.tracks.forEach(t => { const a = contentAr.tracks[t.id]; same(t.modules, a.modules, t.id + '.modules'); same(t.outcomes, a.outcomes, t.id + '.outcomes'); Object.keys(t.path).forEach(s => same(t.path[s], a.path[s], `${t.id}.path.${s}`)); });
  content.demos.forEach(d => { const a = contentAr.demos[d.id]; same(d.how, a.how, d.id + '.how'); same(d.benefits, a.benefits, d.id + '.benefits'); });
  content.sessions.forEach(s => same(s.agenda, contentAr.sessions[s.id].agenda, s.id + '.agenda'));
  content.news.forEach(n => same(n.points, contentAr.news[n.id].points, n.id + '.points'));
  assert.equal(contentAr.levels.length, content.levels.length);
  assert.equal(contentAr.askTopics.length, content.askTopics.length);
  catalog.courses.forEach(c => assert.ok(contentAr.courses[c.id], `course ${c.id} has no Arabic description`));
  Object.keys(content.rules.nextSteps).forEach(r => Object.keys(content.rules.nextSteps[r]).forEach(st => {
    const en = content.rules.nextSteps[r][st], ar = contentAr.rules.nextSteps[r][st];
    assert.deepEqual(placeholders(ar), placeholders(en), `nextSteps.${r}.${st}`);
  }));
  const zoneIds = new Set(content.booth.zones.map(z => z.id));
  Object.keys(contentAr.booth.zones).forEach(id => assert.ok(zoneIds.has(id)));
});

test('the Arabic view keeps ids, levels, keywords and questions from the English content', () => {
  const ar = localizeContent(content, contentAr);
  assert.equal(ar.tracks[0].id, content.tracks[0].id); assert.equal(ar.tracks[0].level, content.tracks[0].level);
  assert.notEqual(ar.tracks[0].title, content.tracks[0].title);
  assert.deepEqual(ar.demos[0].keywords, content.demos[0].keywords); assert.deepEqual(ar.demos[0].questions, content.demos[0].questions);
  assert.equal(ar.sessions[0].type, content.sessions[0].type);
  assert.equal(ar.meta.newsIsSample, content.meta.newsIsSample);
  const cat = localizeCatalog(catalog, contentAr);
  assert.equal(cat.courses[0].title, catalog.courses[0].title); // course names stay official
  assert.notEqual(cat.courses[0].summary, catalog.courses[0].summary);
});

test('the rules write a complete journey in Arabic for every role and level', () => {
  const ctx = { content: localizeContent(content, contentAr), catalog: localizeCatalog(catalog, contentAr), sessions: [], lang: 'ar' };
  const arabic = /[؀-ۿ]/;
  for (const role of content.roles.map(r => r.id)) for (const experience of content.experience.map(e => e.id)) {
    const plan = rules.buildRulesPlan({ role, experience, interests: ['agentic', 'data'] }, ctx);
    assert.match(plan.summary, arabic);
    plan.stages.forEach(s => { assert.match(s.topic, arabic); assert.match(s.why, arabic); assert.match(s.nextStep, arabic); assert.ok(!/\{\w+\}/.test(s.nextStep)); });
  }
});

test('the recommender asks for Arabic, caches each language separately and falls back in Arabic', async () => {
  const calls = [];
  const plan = { primaryTrack: 'gov', secondaryTrack: 'agentic', summary: 'ملخص', stages: ['discover', 'learn', 'practice', 'innovate'].map((stage, i) => ({ stage, topic: 'موضوع', courseIds: [['coursera-genai-everyone'], ['dlai-agentic-ai'], ['mslearn-copilot-studio'], ['nist-ai-rmf']][i], why: 'لماذا', nextStep: 'الخطوة', experienceId: ['knowledge', 's-public', 'automation', 's-future'][i] })) };
  const create = async params => { calls.push(params); return { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(plan) }], usage: {} }; };
  const client = { messages: { create }, beta: { messages: { create } } };
  const rec = createRecommender({ config: loadConfig({ ANTHROPIC_API_KEY: 'test-key' }), content, catalog, contentAr: localizeContent(content, contentAr), catalogAr: localizeCatalog(catalog, contentAr), rules, logger: silentLogger, client });
  const profile = { role: 'gov', experience: 'intermediate', interests: ['agentic', 'gov'] };
  const ar = await rec.recommend(profile, [], 'ar');
  assert.equal(ar.source, 'ai'); assert.equal(ar.plan.summary, 'ملخص');
  assert.match(calls[0].messages[0].content, /write the journey text in Arabic/);
  assert.match(calls[0].system[0].text, /titleArabic/);
  await rec.recommend(profile, [], 'en');
  assert.equal(calls.length, 2, 'English is not served from the Arabic cache');
  assert.doesNotMatch(calls[1].messages[0].content, /Arabic/);
  await rec.recommend(profile, [], 'ar');
  assert.equal(calls.length, 2, 'Arabic is cached');
  const offline = createRecommender({ config: loadConfig({}), content, catalog, contentAr: localizeContent(content, contentAr), catalogAr: localizeCatalog(catalog, contentAr), rules, logger: silentLogger });
  const fb = await offline.recommend(profile, [], 'ar');
  assert.equal(fb.source, 'rules'); assert.match(fb.plan.summary, /[؀-ۿ]/);
});

test('the phone page has Arabic for all of its own strings', () => {
  const src = pub('journey.js');
  const table = src.slice(src.indexOf('const TEXT = {'), src.indexOf('};', src.indexOf('const TEXT = {')));
  const keys = new Set(literals(src, 'tr'));
  ['Discover', 'Learn', 'Practice', 'Innovate', 'Get oriented', 'Build the foundations', 'Get hands-on', 'Apply it to your work', 'Beginner', 'Intermediate', 'Advanced'].forEach(k => keys.add(k));
  const missing = [...keys].filter(k => !table.includes(JSON.stringify(k).slice(1, -1).replace(/\\"/g, '"')) && !table.includes(`'${k}'`));
  assert.deepEqual(missing, []);
});
