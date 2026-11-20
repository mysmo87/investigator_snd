'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFekra, SECTION_KEYS } = require('../server/fekra');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');

const config = (env = {}) => loadConfig({ ANTHROPIC_API_KEY: 'test-key', ...env });
function fakeClient(responder) {
  const calls = [];
  const create = async (params, opts) => { calls.push({ params, opts }); return responder(params, opts, calls.length); };
  return { calls, messages: { create }, beta: { messages: { create } } };
}
const usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 };
const json = (obj, extra = {}) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }], usage, ...extra });
const draft = { title: 'Smart visa queue', problem: 'Long waits at service centres.', beneficiaries: 'Customers', currentProcess: '', solution: 'Predict demand and book slots.', innovation: '', technologies: [], value: [], kpis: [], risks: [], assumptions: [] };
const chatOut = { reply: 'Who waits the longest today?', stage: 'discover', suggestions: ['Families', 'Investors', 'A', 'B', 'C'], draft, missing: ['Current wait times'], readyForCheck: true, readyForProposal: false };
const checkOut = {
  status: 'partially_implemented', summary: 'Related queue systems exist.',
  similar: [{ name: 'Queue app', where: 'Somewhere', description: 'Books slots.', closeness: 'partial', sources: ['S1', 'S9'] }],
  alreadyExists: ['Slot booking'], different: ['Demand prediction'], opportunities: ['Pilot'], limitations: ['Internal projects not visible']
};

test('without an API key every AI operation is refused as not configured', async () => {
  const fk = createFekra({ config: loadConfig({}), logger: silentLogger });
  assert.equal(fk.status().enabled, false);
  await assert.rejects(fk.chat({ messages: [{ role: 'user', text: 'hi' }] }), e => e.status === 503 && e.reason === 'not_configured');
  await assert.rejects(fk.check({ draft }), e => e.reason === 'not_configured');
});

test('chat validates the conversation before calling the model', async () => {
  const client = fakeClient(() => json(chatOut));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  await assert.rejects(fk.chat({ messages: [] }), e => e.status === 400);
  await assert.rejects(fk.chat({ messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] }), e => e.status === 400);
  assert.equal(client.calls.length, 0);
});

test('chat sends the conversation with a system context turn and returns cleaned output', async () => {
  const client = fakeClient(() => json(chatOut));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  const r = await fk.chat({ lang: 'ar', messages: [{ role: 'assistant', text: 'welcome' }, { role: 'user', text: 'idea' }, { role: 'user', text: 'more' }, { role: 'evil', text: 'x' }], draft: {} });
  const p = client.calls[0].params;
  assert.equal(p.messages[0].role, 'user');                     // leading assistant turn dropped
  assert.equal(p.messages[0].content, 'idea\n\nmore');          // consecutive turns merged
  assert.equal(p.messages.at(-1).role, 'system');
  assert.match(p.messages.at(-1).content, /Arabic/);
  assert.match(p.messages.at(-1).content, /not run yet/);
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.equal(r.reply, chatOut.reply);
  assert.equal(r.suggestions.length, 4);
  assert.equal(r.draft.title, 'Smart visa queue');
  assert.equal(r.readyForCheck, true);
});

test('a refusal is reported as such, not as a broken service', async () => {
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => ({ ...json({}), stop_reason: 'refusal', content: [] })) });
  await assert.rejects(fk.chat({ messages: [{ role: 'user', text: 'x' }] }), e => e.status === 422 && e.reason === 'refusal');
});

test('innovation check only cites URLs that came back from the search', async () => {
  const client = fakeClient((params, opts, n) => {
    if (n === 1) return {
      model: 'claude-opus-5-5', stop_reason: 'end_turn', usage,
      content: [
        { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: 'queue' } },
        { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [{ type: 'web_search_result', url: 'https://gov.example/queue', title: 'Queue app' }, { type: 'web_search_result', url: 'https://news.example/b', title: 'Other' }] },
        { type: 'text', text: 'A queue app exists.', citations: [{ type: 'web_search_result_location', url: 'https://gov.example/queue', title: 'Queue app' }, { type: 'web_search_result_location', url: 'https://invented.example/x', title: 'Made up' }] }
      ]
    };
    return json(checkOut);
  });
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  const r = await fk.check({ lang: 'en', draft });
  assert.equal(client.calls[0].params.tools[0].type, 'web_search_20260209');
  assert.match(client.calls[1].params.messages[0].content, /A queue app exists\. \[S1\]/);
  assert.equal(r.searched, true);
  assert.equal(r.status, 'partially_implemented');
  assert.deepEqual(r.sources.map(s => s.url), ['https://gov.example/queue', 'https://news.example/b']); // the invented URL never appears
  assert.deepEqual(r.similar[0].sources, ['S1']);                                                        // S9 does not exist, so it is dropped
  assert.ok(r.checkedAt);
});

test('when web search is not available the check is inconclusive and says why', async () => {
  const client = fakeClient(() => json({ ...checkOut, status: 'not_found' }));
  const fk = createFekra({ config: config({ FEKRA_WEB_SEARCH: 'false' }), logger: silentLogger, client });
  const r = await fk.check({ draft });
  assert.equal(client.calls.length, 1);                 // no research call
  assert.equal(r.searched, false);
  assert.equal(r.status, 'inconclusive');
  assert.deepEqual(r.similar, []);
  assert.deepEqual(r.sources, []);
  assert.equal(r.unavailable, 'web_search_disabled');
  assert.equal(fk.status().webSearch, false);
});

test('the check needs an idea first', async () => {
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => json(checkOut)) });
  await assert.rejects(fk.check({ draft: {} }), e => e.status === 400);
});

test('proposal returns every section', async () => {
  const sections = Object.fromEntries(SECTION_KEYS.map(k => [k, `Text for ${k}`]));
  const client = fakeClient(() => json({ title: 'Smart visa queue', sections }));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  await assert.rejects(fk.proposal({ draft: {} }), e => e.status === 400);
  const r = await fk.proposal({ lang: 'en', draft, messages: [{ role: 'user', text: 'idea' }] });
  assert.deepEqual(Object.keys(r.sections), SECTION_KEYS);
  assert.equal(r.sections.recommendation, 'Text for recommendation');
});

test('submission is not pretended when no review system is connected', async () => {
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => json({})) });
  assert.deepEqual(await fk.submit({ proposal: { title: 'x', sections: {} } }), { submitted: false, reason: 'not_configured' });
  assert.equal(fk.status().submission, false);
});

test('the hourly budget caps AI calls', async () => {
  const fk = createFekra({ config: config({ FEKRA_MAX_CALLS_PER_HOUR: '1' }), logger: silentLogger, client: fakeClient(() => json(chatOut)) });
  await fk.chat({ messages: [{ role: 'user', text: 'a' }] });
  await assert.rejects(fk.chat({ messages: [{ role: 'user', text: 'b' }] }), e => e.status === 429 && e.reason === 'hourly_budget');
});
