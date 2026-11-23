'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFekra, emptyProposal } = require('../server/fekra');
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
const proposal = { ...emptyProposal(), title: 'Delay early-warning for residency applications', solution: 'Predict which applications may be delayed and notify applicants early.',
  problem: { current: 'Applicants learn about delays late.', issue: 'Limited early visibility of processing issues.', whyItMatters: 'Uncertainty for applicants.', affected: 'Applicants and officers', ifUnresolved: 'Avoidable follow-up enquiries.', basis: 'inferred' } };
const msgs = [{ role: 'user', text: 'I think we should use AI to identify residency applications that might get delayed, so we can alert customers in advance.' }];
const updOut = (p, extra = {}) => ({ proposal: p, changes: [{ section: 'overview', note: 'Added a title' }], readyForResearch: true, researchStale: false, readyForReview: false, ...extra });
const checkOut = {
  status: 'partially_implemented', summary: 'Related queue systems exist.',
  similar: [{ entity: 'Example authority', initiative: 'Queue app', scope: 'international_government', description: 'Books slots.', similarities: 'Online booking', differences: 'No prediction', closeness: 'partial', sources: ['S1', 'S9'] }],
  alreadyExists: ['Slot booking'], different: ['Demand prediction'], opportunities: ['Pilot'], limitations: ['Internal projects not visible']
};

test('without an API key every AI operation is refused as not configured', async () => {
  const fk = createFekra({ config: loadConfig({}), logger: silentLogger });
  assert.equal(fk.status().enabled, false);
  await assert.rejects(fk.chat({ messages: msgs }), e => e.status === 503 && e.reason === 'not_configured');
  await assert.rejects(fk.update({ messages: msgs }), e => e.reason === 'not_configured');
  await assert.rejects(fk.check({ proposal }), e => e.reason === 'not_configured');
});

test('chat validates the conversation before calling the model', async () => {
  const client = fakeClient(() => json({ reply: 'x', suggestions: [], intent: 'other' }));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  await assert.rejects(fk.chat({ messages: [] }), e => e.status === 400);
  await assert.rejects(fk.chat({ messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] }), e => e.status === 400);
  assert.equal(client.calls.length, 0);
});

test('chat gives the model the live proposal, research state and review readiness, and returns a short reply', async () => {
  const client = fakeClient(() => json({ reply: 'Are you predicting delays before submission or during processing?', suggestions: ['During processing', 'Before submission', 'Both', 'Extra'], intent: 'new_idea' }));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  const r = await fk.chat({ lang: 'ar', messages: [{ role: 'assistant', text: 'welcome' }, ...msgs], proposal, locked: ['problem', 'bogus'], researching: true, readyForReview: true, reviewOffered: false });
  const p = client.calls[0].params, ctx = p.messages.at(-1);
  assert.equal(p.messages[0].role, 'user');                    // leading assistant turn dropped
  assert.equal(ctx.role, 'system');
  assert.match(ctx.content, /Arabic/); assert.match(ctx.content, /Delay early-warning/); assert.match(ctx.content, /Locked \(approved by the employee\): problem\n/);
  assert.match(ctx.content, /Research into similar implementations is running now/); assert.match(ctx.content, /NOT been offered yet/);
  assert.equal(r.suggestions.length, 3); assert.equal(r.intent, 'new_idea'); assert.match(r.reply, /predicting delays/);
});

test('a refusal is reported as such, not as a broken service', async () => {
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => ({ ...json({}), stop_reason: 'refusal', content: [] })) });
  await assert.rejects(fk.chat({ messages: msgs }), e => e.status === 422 && e.reason === 'refusal');
});

test('update builds the structured proposal and reports what changed', async () => {
  const next = { ...proposal, customerBenefits: [{ benefit: 'Earlier notice of delays', reasoning: 'Risk is flagged during processing', kpi: 'Share of delayed cases notified early', measurement: 'Case data', basis: 'recommendation', needsValidation: true }] };
  const client = fakeClient(() => json(updOut(next)));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  const r = await fk.update({ lang: 'en', messages: msgs, proposal: emptyProposal() });
  assert.equal(client.calls[0].params.output_config.format.type, 'json_schema');
  assert.equal(client.calls[0].params.output_config.effort, 'low');
  assert.equal(r.proposal.title, proposal.title);
  assert.equal(r.proposal.customerBenefits[0].needsValidation, true);
  assert.deepEqual(r.changes.map(c => c.section).sort(), ['customerBenefits', 'overview', 'problem']);
  assert.equal(r.changes.find(c => c.section === 'overview').note, 'Added a title');
  assert.equal(r.readyForResearch, true); assert.deepEqual(r.pending, {});
});

test('approved (locked) sections never change silently: a different version comes back as a suggestion', async () => {
  const changed = { ...proposal, problem: { ...proposal.problem, issue: 'Potential fraud goes unnoticed.' }, title: 'Fraud early-warning' };
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => json(updOut(changed))) });
  const r = await fk.update({ messages: msgs, proposal, locked: ['problem'] });
  assert.equal(r.proposal.problem.issue, proposal.problem.issue);          // kept
  assert.equal(r.pending.problem.problem.issue, 'Potential fraud goes unnoticed.'); // offered
  assert.equal(r.proposal.title, 'Fraud early-warning');                  // unlocked sections still update
});

test('section mode changes only the requested section', async () => {
  const changed = { ...proposal, title: 'Something else', architecture: 'Data → model → notifications (illustrative)' };
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => json(updOut(changed))) });
  const r = await fk.update({ messages: msgs, proposal, mode: 'section', section: 'technology', instruction: 'Add the architecture' });
  assert.equal(r.proposal.title, proposal.title);
  assert.match(r.proposal.architecture, /illustrative/);
  await assert.rejects(fk.update({ messages: msgs, proposal, mode: 'section', section: 'nope', instruction: 'x' }), e => e.status === 400);
});

test('translate mode may rewrite locked sections (same meaning, new language)', async () => {
  const ar = { ...proposal, problem: { ...proposal.problem, issue: 'محدودية الرؤية المبكرة' } };
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => json(updOut(ar))) });
  const r = await fk.update({ lang: 'ar', messages: msgs, proposal, locked: ['problem'], mode: 'translate' });
  assert.equal(r.proposal.problem.issue, 'محدودية الرؤية المبكرة'); assert.deepEqual(r.pending, {});
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
  const r = await fk.check({ lang: 'en', proposal });
  assert.equal(client.calls[0].params.tools[0].type, 'web_search_20250305');
  assert.equal(client.calls[0].params.tools[1].type, 'web_fetch_20250910');
  assert.match(client.calls[1].params.messages[0].content, /A queue app exists\. \[S1\]/);
  assert.equal(r.searched, true);
  assert.equal(r.status, 'partially_implemented');
  assert.deepEqual(r.sources.map(s => s.url), ['https://gov.example/queue']); // the invented URL never appears; uncited results are not listed
  assert.deepEqual(r.similar[0].sources, ['S1']); assert.equal(r.similar[0].scope, 'international_government'); assert.equal(r.similar[0].entity, 'Example authority');                                                        // S9 does not exist, so it is dropped
  assert.ok(r.checkedAt);
  assert.deepEqual(r.research, { searches: 1, fetches: 0, citations: 2 });
});

test('citations of fetched pages are mapped back to the fetched URL', async () => {
  const client = fakeClient((params, opts, n) => n === 1 ? {
    model: 'claude-opus-5-5', stop_reason: 'end_turn', usage,
    content: [
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://a.example/', title: 'A' }] },
      { type: 'web_fetch_tool_result', tool_use_id: 'f1', content: { type: 'web_fetch_result', url: 'https://b.example/page', content: { type: 'document', title: 'Page B' } } },
      { type: 'text', text: 'B does this.', citations: [{ type: 'char_location', document_index: 0, document_title: 'Page B', cited_text: 'x' }] },
      { type: 'text', text: 'Unknown.', citations: [{ type: 'char_location', document_index: 5, document_title: 'Nope', cited_text: 'y' }] }
    ]
  } : json(checkOut));
  const fk = createFekra({ config: config(), logger: silentLogger, client });
  const r = await fk.check({ proposal });
  assert.deepEqual(client.calls[0].params.tools[1].citations, { enabled: true });
  assert.deepEqual(r.sources, [{ id: 'S1', title: 'Page B', url: 'https://b.example/page' }]);
  assert.match(client.calls[1].params.messages[0].content, /B does this\. \[S1\]Unknown\./);
});

test('when web search is not available the check is inconclusive and says why', async () => {
  const client = fakeClient(() => json({ ...checkOut, status: 'not_found' }));
  const fk = createFekra({ config: config({ FEKRA_WEB_SEARCH: 'false' }), logger: silentLogger, client });
  const r = await fk.check({ proposal });
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
  await assert.rejects(fk.check({ proposal: {} }), e => e.status === 400);
});

test('submission is not pretended when no review system is connected', async () => {
  const fk = createFekra({ config: config(), logger: silentLogger, client: fakeClient(() => json({})) });
  assert.deepEqual(await fk.submit({ proposal }), { submitted: false, reason: 'not_configured' });
  assert.equal(fk.status().submission, false);
});

test('the hourly budget caps AI calls', async () => {
  const fk = createFekra({ config: config({ FEKRA_MAX_CALLS_PER_HOUR: '1' }), logger: silentLogger, client: fakeClient(() => json({ reply: 'x', suggestions: [], intent: 'other' })) });
  await fk.chat({ messages: msgs });
  await assert.rejects(fk.chat({ messages: msgs }), e => e.status === 429 && e.reason === 'hourly_budget');
});
