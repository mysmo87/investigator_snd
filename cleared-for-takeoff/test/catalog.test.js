'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const rules = require('../public/shared/journey-rules.js');

const allProfiles = () => {
  const ints = content.interests.map(i => i.id), out = [];
  for (const role of content.roles.map(r => r.id)) for (const experience of content.experience.map(e => e.id))
    for (let m = 1; m < 1 << ints.length; m++) out.push({ role, experience, interests: ints.filter((_, k) => m >> k & 1) });
  return out;
};

test('every course has a learning category', () => {
  catalog.courses.forEach(c => assert.ok(typeof c.category === 'string' && c.category.trim(), c.id));
});

test('SAS Learning courses are free, verified and link to the official course page', () => {
  const sas = catalog.courses.filter(c => c.provider === 'SAS Learning');
  assert.ok(sas.length >= 1);
  sas.forEach(c => {
    assert.equal(c.cost, 'free', c.id);
    assert.match(c.url, /^https:\/\/learn\.sas\.com\/course\/view\.php\?id=\d+$/, c.id);
    assert.match(c.verifiedOn, /^\d{4}-\d{2}-\d{2}$/, c.id);
    assert.ok('providerLevel' in c, c.id);
    assert.ok(c.hours > 0, c.id);
  });
});

test('journeys stay vendor-neutral: never more than two courses from one provider', () => {
  for (const p of allProfiles()) {
    const plan = rules.buildRulesPlan(p, { content, catalog, sessions: [] });
    const count = {};
    plan.stages.flatMap(s => s.courseIds).forEach(id => { const k = rules.providerKey(catalog.courses.find(c => c.id === id)); count[k] = (count[k] || 0) + 1; });
    assert.ok(Math.max(...Object.values(count)) <= rules.MAX_PER_PROVIDER, JSON.stringify(p));
  }
});

test('provider families group co-branded courses', () => {
  assert.equal(rules.providerKey({ provider: 'DeepLearning.AI on Coursera' }), rules.providerKey({ provider: 'DeepLearning.AI × crewAI' }));
  assert.notEqual(rules.providerKey({ provider: 'SAS Learning' }), rules.providerKey({ provider: 'Kaggle Learn' }));
});
