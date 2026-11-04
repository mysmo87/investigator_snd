'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Anthropic = require('@anthropic-ai/sdk').default;
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const rules = require('../public/shared/journey-rules.js');
const { createRecommender, buildSchema, buildSystemPrompt } = require('../server/recommender');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');

const profile = { role: 'gov', experience: 'intermediate', interests: ['agentic', 'gov'] };
const config = (env = {}) => loadConfig({ ANTHROPIC_API_KEY: 'test-key', ...env });

function aiPlan(overrides = {}) {
  return {
    primaryTrack: 'gov', secondaryTrack: 'agentic', summary: 'You will learn to design AI-enabled public services.',
    stages: [
      { stage: 'discover', topic: 'AI in public services', courseIds: ['coursera-genai-everyone'], why: 'A broad grounding.', nextStep: 'Visit a demo.', experienceId: 'knowledge' },
      { stage: 'learn', topic: 'Agent design', courseIds: ['dlai-agentic-ai', 'helsinki-ethics-of-ai'], why: 'Core skills.', nextStep: 'Join a session.', experienceId: 's-public' },
      { stage: 'practice', topic: 'Build a service agent', courseIds: ['mslearn-copilot-studio'], why: 'Hands-on.', nextStep: 'Prototype one agent.', experienceId: 'automation' },
      { stage: 'innovate', topic: 'Govern AI', courseIds: ['nist-ai-rmf'], why: 'Stretch goal.', nextStep: 'Propose a pilot.', experienceId: 's-future' }
    ],
    ...overrides
  };
}

function fakeClient(responder) {
  const calls = [];
  const create = async (params, opts) => { calls.push({ params, opts }); return responder(params, opts, calls.length); };
  return { calls, messages: { create }, beta: { messages: { create } } };
}
const textResponse = (obj, extra = {}) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, ...extra });

test('schema only allows catalogue ids and has closed objects', () => {
  const schema = buildSchema(content, catalog);
  const stage = schema.properties.stages.items;
  assert.equal(schema.additionalProperties, false);
  assert.equal(stage.additionalProperties, false);
  assert.deepEqual(stage.properties.courseIds.items.enum, catalog.courses.map(c => c.id));
  assert.ok(!stage.properties.experienceId.enum.includes('radar'));
  assert.deepEqual(schema.properties.primaryTrack.enum, content.tracks.map(t => t.id));
});

test('system prompt is stable (cacheable) and contains every course', () => {
  const a = buildSystemPrompt(content, catalog), b = buildSystemPrompt(content, catalog);
  assert.equal(a, b);
  catalog.courses.forEach(c => assert.ok(a.includes(c.id), c.id));
});

test('sends a cached system prompt, structured output and server-side fallbacks', async () => {
  const client = fakeClient(() => textResponse(aiPlan()));
  const rec = createRecommender({ config: config(), content, catalog, rules, logger: silentLogger, client });
  const out = await rec.recommend(profile, []);
  assert.equal(out.source, 'ai');
  const { params, opts } = client.calls[0];
  assert.equal(params.model, 'claude-opus-5-5');
  assert.equal(params.system[0].cache_control.type, 'ephemeral');
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.output_config.effort, 'low');
  assert.equal(params.fallbacks, 'default');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(params.thinking, undefined);
  assert.equal(opts.timeout, 20000);
  // no personal data fields can reach the prompt
  assert.ok(!/name|email|photo/i.test(params.messages[0].content.replace(/"label":"[^"]*"/g, '')));
  assert.deepEqual(out.plan.stages.map(s => s.courseIds), aiPlan().stages.map(s => s.courseIds));
});

test('fallbacks are omitted for models that do not support them', async () => {
  const client = fakeClient(() => textResponse(aiPlan()));
  const rec = createRecommender({ config: config({ ANTHROPIC_MODEL: 'claude-haiku-5-5' }), content, catalog, rules, logger: silentLogger, client });
  await rec.recommend(profile, []);
  assert.equal(client.calls[0].params.fallbacks, undefined);
  assert.equal(client.calls[0].params.betas, undefined);
});

test('caches identical profiles', async () => {
  const client = fakeClient(() => textResponse(aiPlan()));
  const rec = createRecommender({ config: config(), content, catalog, rules, logger: silentLogger, client });
  await rec.recommend(profile, []);
  const second = await rec.recommend({ ...profile, interests: ['gov', 'agentic'] }, []);
  assert.equal(client.calls.length, 1);
  assert.equal(second.cached, true);
});

test('repairs invalid AI output against the catalogue', async () => {
  const bad = aiPlan();
  bad.stages[0].courseIds = ['not-a-course'];
  bad.stages[2].courseIds = ['ibm-quantum-basics', 'ibm-quantum-basics']; // advanced is fine for intermediate, duplicate removed
  bad.stages[3].experienceId = 'radar';
  bad.stages.splice(1, 1); // missing "learn"
  const client = fakeClient(() => textResponse(bad));
  const rec = createRecommender({ config: config(), content, catalog, rules, logger: silentLogger, client });
  const { plan, source } = await rec.recommend(profile, []);
  assert.equal(source, 'ai');
  assert.deepEqual(plan.stages.map(s => s.stage), rules.STAGES);
  const ids = plan.stages.flatMap(s => s.courseIds);
  ids.forEach(id => assert.ok(catalog.courses.some(c => c.id === id), id));
  assert.equal(new Set(ids).size, ids.length);
  plan.stages.forEach(s => assert.ok(s.courseIds.length >= 1));
});

test('beginners never get advanced courses', () => {
  const p = { role: 'student', experience: 'beginner', interests: ['future', 'cyber'] };
  const raw = aiPlan();
  raw.stages[0].courseIds = ['ibm-quantum-basics', 'owasp-llm-top10'];
  const { plan } = rules.sanitizePlan(raw, p, { content, catalog, sessions: [] });
  plan.stages.flatMap(s => s.courseIds).forEach(id => assert.notEqual(catalog.courses.find(c => c.id === id).level, 'advanced'));
});

for (const [name, responder, reason] of [
  ['refusal', () => textResponse({}, { stop_reason: 'refusal', content: [] }), 'refusal'],
  ['invalid JSON', () => ({ ...textResponse({}), content: [{ type: 'text', text: 'not json' }] }), 'invalid_json'],
  ['rate limit', () => { throw new Anthropic.RateLimitError(429, {}, 'rate limited', new Headers()); }, 'rate_limited'],
  ['timeout', () => { throw new Anthropic.APIConnectionTimeoutError(); }, 'timeout']
]) {
  test(`falls back to rules on ${name}`, async () => {
    const rec = createRecommender({ config: config(), content, catalog, rules, logger: silentLogger, client: fakeClient(responder) });
    const out = await rec.recommend(profile, []);
    assert.equal(out.source, 'rules');
    assert.equal(out.reason, reason);
    assert.equal(out.plan.stages.length, 4);
  });
}

test('opens the circuit after repeated failures', async () => {
  const client = fakeClient(() => { throw new Anthropic.APIConnectionTimeoutError(); });
  const rec = createRecommender({ config: config(), content, catalog, rules, logger: silentLogger, client });
  for (const i of ['agentic', 'genai', 'cyber']) await rec.recommend({ ...profile, interests: [i] }, []);
  const out = await rec.recommend({ ...profile, interests: ['data'] }, []);
  assert.equal(out.reason, 'circuit_open');
  assert.equal(client.calls.length, 3);
});

test('without an API key the rules are used and no client is created', async () => {
  const rec = createRecommender({ config: loadConfig({}), content, catalog, rules, logger: silentLogger });
  const out = await rec.recommend(profile, []);
  assert.equal(out.source, 'rules');
  assert.equal(out.reason, 'no_api_key');
});

test('rules never suggest a completed session', () => {
  const sessions = content.sessions.map((s, i) => ({ id: s.id, status: i < 6 ? 'done' : 'upcoming' }));
  const plan = rules.buildRulesPlan(profile, { content, catalog, sessions });
  plan.stages.forEach(s => assert.ok(!sessions.some(x => x.id === s.experienceId && x.status === 'done'), s.experienceId));
});

test('hourly budget caps Claude calls and falls back to rules', async () => {
  const client = fakeClient(() => textResponse(aiPlan()));
  const rec = createRecommender({ config: config({ AI_MAX_CALLS_PER_HOUR: '1' }), content, catalog, rules, logger: silentLogger, client });
  assert.equal((await rec.recommend(profile, [])).source, 'ai');
  const second = await rec.recommend({ ...profile, interests: ['cyber'] }, []);
  assert.equal(second.reason, 'hourly_budget');
  assert.equal(client.calls.length, 1);
});

test('steering: free-only and time limits are respected, pinned courses are kept', () => {
  const ctx = { content, catalog, sessions: [] };
  const p = { role: 'tech', experience: 'intermediate', interests: ['agentic', 'genai'] };
  const plan = rules.buildRulesPlan(p, ctx, { constraints: { time: 'short', freeOnly: true, handsOn: false } });
  plan.stages.forEach(s => {
    if (s.relaxed) return;
    s.courseIds.forEach(id => { const c = catalog.courses.find(x => x.id === id); assert.equal(c.cost, 'free', id); assert.ok(c.hours <= 2, id); });
  });
  const pinned = rules.buildRulesPlan(p, ctx, { constraints: { time: 'short', freeOnly: true }, pinned: ['dlai-ml-specialization'] });
  assert.ok(pinned.stages.some(s => s.courseIds.includes('dlai-ml-specialization') && s.pinned.includes('dlai-ml-specialization')));
  // without options the plan is unchanged by the steering code
  assert.deepEqual(rules.buildRulesPlan(p, ctx).stages.map(s => s.courseIds), rules.buildRulesPlan(p, ctx, {}).stages.map(s => s.courseIds));
});
