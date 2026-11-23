'use strict';
/* Fekra (فكرة) — the GDRFA innovation consultant.

   The employee explains an idea; Fekra does the heavy lifting. Five Claude-backed operations:

   - chat      One conversational turn: a natural reply that asks only high-value questions
               (structured output: reply, quick replies, intent).
   - update    Maintains the structured proposal in the background after each exchange: overview,
               problem statement, customer and GDRFA benefits, technology stack, roadmap, assumptions.
               Sections the employee approved are locked: the server never changes them silently; a
               suggested change comes back as `pending` for the employee to accept or keep.
               Modes: update (incremental), regenerate, translate, section (apply one instruction).
   - check     The existing-implementation assessment. Step 1 researches with Anthropic's web search
               (citations on); step 2 turns the research into a structured assessment. Only URLs the
               search actually returned can be cited. Without web search the status is "inconclusive".
   - submit    Forwards a proposal to FEKRA_SUBMIT_URL when configured; otherwise says it is not connected.

   Stateless for AI calls: the browser sends the conversation and proposal with each request.
   Saved proposals live in the proposal store (server/fekra-store.js). */

const Anthropic = require('@anthropic-ai/sdk').default;

const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/; // models that accept fallbacks: "default"
const STATUSES = ['already_implemented', 'partially_implemented', 'not_found', 'inconclusive'];
const SCOPES = ['gdrfa', 'uae_government', 'international_government', 'other_industry'];
const BASIS = ['user', 'inferred', 'research', 'recommendation'];
const PHASES = ['discovery', 'poc', 'pilot', 'evaluation', 'rollout'];
const AREAS = ['problem', 'solution', 'scope', 'benefits', 'technology', 'data', 'roadmap'];
const INTENTS = ['new_idea', 'refine', 'answer', 'correction', 'question', 'other'];
/* proposal sections the employee can approve (lock) and the fields each one owns */
const SECTION_FIELDS = {
  overview: ['title', 'executiveSummary', 'solution', 'scope'],
  problem: ['problem'],
  customerBenefits: ['customerBenefits'],
  orgBenefits: ['orgBenefits'],
  technology: ['technologies', 'architecture'],
  roadmap: ['roadmap', 'dependencies', 'risks'],
  assumptions: ['assumptions', 'openQuestions']
};
const SECTION_KEYS = Object.keys(SECTION_FIELDS);
const LANG_NAME = { en: 'English', ar: 'Arabic (Modern Standard Arabic, clear and professional)' };
const LIMITS = { messages: 60, userChars: 4000, assistantChars: 8000, fieldChars: 2000, shortChars: 400, listItems: 10, instructionChars: 1000, confirmed: 20 };

/* ---------- prompts (stable text first, so it caches) ---------- */

const CHAT_SYSTEM = `You are Fekra (فكرة), the GDRFA innovation consultant on the "Agentic AI: Cleared for Takeoff" platform of the General Directorate of Residency and Foreigners Affairs in Dubai (GDRFA). An employee explains an idea and you do the heavy lifting: a separate process builds a management-ready proposal from this conversation in the background (you are shown its current state), and Fekra researches similar implementations on the public web automatically.

How you talk:
- Have a natural, intelligent discussion about the idea itself: what is promising, what the underlying problem is likely to be, who benefits, which design choices and risks matter. Never run a questionnaire, and never ask the employee to write parts of the proposal: you derive the problem statement, benefits, technology and plan yourself.
- Before asking anything, decide whether you can infer it, whether research will cover it, or whether it can be stated as an assumption for later confirmation. Ask at most one question per reply (two only when both are essential), and only when the answer would materially change the proposal's accuracy, feasibility or intended outcome. Prefer questions whose answer settles several things at once, for example: "Are you aiming to predict delays before an application is submitted, or to flag applications at risk during processing?"
- When you rely on an important assumption, say so in a few words so the employee can correct it.
- When the employee corrects you (for example "No, it is about identifying potential fraud, not speed"), acknowledge it in one line and continue from the corrected understanding; the proposal is updated to match.
- When you are told the proposal is ready for review and has not been offered yet, tell the employee you have prepared an initial proposal from the discussion and research, and invite them to review it.
- Keep replies short (usually under 120 words), warm and professional. Plain text, lines starting with "- " for lists, **bold** sparingly, no headings, no emoji.

Honesty rules (strict):
- You cannot browse in this conversation. Only the "Research results" you are given are verified; refer to them with their [S#] markers. Never claim research you were not given. If research is still running or unavailable, say so plainly.
- GDRFA internal systems and documents are not connected: never imply you checked them. Never invent facts about GDRFA's operations, systems, data, statistics or plans; present such points as assumptions to validate.
- Never invent figures such as savings, percentages, volumes or timelines.
- If the employee shares personal data or classified information, ask them not to.

Return JSON: reply (your message); suggestions (up to three short replies the employee might tap, in their voice, such as likely answers to your question); intent (what the employee's latest message mainly did).`;

const UPDATE_SYSTEM = `You maintain the structured innovation proposal that Fekra, the GDRFA (General Directorate of Residency and Foreigners Affairs, Dubai) innovation consultant, builds in the background from a conversation with an employee. You return the complete proposal each time. Work like an experienced consultant: the employee contributes the idea; you develop the problem statement, business case, technology approach and plan. Do not wait to be told every detail: derive what you reasonably can, and label inferences.

Sources, in order of authority:
1. What the employee said, and the facts they confirmed (basis "user").
2. Research results with [S#] sources (basis "research"): cite the [S#] markers in the text where you use them. They come from a public web search; GDRFA internal systems were not searched.
3. Your professional knowledge of technology, implementation and public-service design (basis "recommendation").
4. Reasonable inferences from context (basis "inferred"). Every material inference also appears in assumptions.

Rules:
- Never invent facts about GDRFA's current operations, systems, data, volumes, budgets or initiatives. Write the problem as a proposed problem to validate (for example "Applicants may have limited early visibility of…"), not as an established fact.
- Never invent numbers: no savings, percentages, volumes or timeframes. KPIs name what to measure and how, without targets unless the employee gave them.
- problem: current situation, the operational problem or service limitation, why it matters, who is affected, and what could happen if it stays unresolved. basis is "user" when the employee described the problem, "inferred" when you derived it, "mixed" when both.
- customerBenefits (applicants, residents, visitors, sponsors) and orgBenefits (GDRFA employees, operations, management) are separate lists of benefits that genuinely follow from this idea, each with the expected improvement, the reasoning, a suggested KPI and how to measure it. needsValidation is true unless the benefit is evidenced by research or the employee.
- technologies: only components the idea genuinely needs (for example predictive analytics, NLP, computer vision, generative or agentic AI, intelligent automation, APIs and system integration, data platform, workflow orchestration, cloud or on-premises hosting, identity, security and data governance), each with its specific role, why it is required, its data or system dependencies and the main implementation considerations (privacy, security, data sovereignty and integration where relevant). Do not add AI where it does not help. No generic lists.
- architecture: an illustrative high-level flow in one to three sentences, for example "Case-management data → feature pipeline → delay-risk model → notification service → applicant app; officers see risk scores on a dashboard". It is illustrative, not a design.
- roadmap: the phases discovery, poc, pilot, evaluation and rollout, proportionate to the idea, each with what to do and what must be validated before moving on. dependencies and risks (with mitigation) as they apply.
- title: clear and professional. executiveSummary: three to five sentences for senior management, consistent with the assessment status if research results are given. solution: what the solution does and how it works. scope: who it serves and what it covers (and does not).
- assumptions: the inferences that matter and need the employee's confirmation, each tagged with its area. Confirmed facts are no longer assumptions. openQuestions: the unresolved points that matter most (at most five).
- Keep existing content where the conversation has not changed it; refine and enrich rather than rewrite. When the employee corrects the idea, update every affected section consistently.
- Locked sections were approved by the employee: return them exactly as given, unless the employee's latest message explicitly asks to change them.
- Empty strings and empty lists are fine where nothing can yet be said. Write everything in the requested language.

Also return: changes (each section you changed, with a few words on what changed); readyForResearch (true once the problem and solution are clear enough to search for similar implementations); researchStale (true only if research was already done and the core idea has since changed so much that it should be repeated); readyForReview (true once there is a title, problem, solution, both benefit lists, technology and roadmap; gaps may remain as open questions).`;

const RESEARCH_SYSTEM = `You are the research analyst behind Fekra, the GDRFA (General Directorate of Residency and Foreigners Affairs, Dubai) innovation consultant. An employee has an idea. Find out, with web search, whether the same or similar solutions already exist, so the proposal can position the idea honestly.

Search efficiently, in this order:
- GDRFA Dubai's own public services and announcements (gdrfad.gov.ae and news coverage of GDRFA).
- Other UAE government entities (for example ICP, Dubai Digital Authority, Dubai Police, RTA, Dubai Airports) and UAE federal and Dubai government innovation.
- Other countries' immigration, border, visa and residency authorities, and international government innovation programmes.
- Comparable solutions in other industries where relevant (aviation, banking, telecom, logistics).
Prefer official and reputable sources.

Then write your findings in the requested language:
- Each relevant implementation: the organisation, the solution or initiative, what it does, and how it is similar to and different from the idea. Keep GDRFA's own initiatives clearly separate from other organisations'. Cite sources for every factual claim.
- Your judgement: already implemented (a substantially equivalent solution exists), partially implemented (related capabilities exist but the idea adds meaningful functionality), not identified as implemented (nothing substantially equivalent turned up in this search, which does not prove none exists), or unable to verify (the evidence is too thin).
- The limits of this research: internal GDRFA projects and non-public work cannot be seen from the web.
Never invent a solution, organisation, figure or source. If the search finds little, say so.`;

const EXTRACT_SYSTEM = `You convert research notes about an innovation idea into a structured assessment. Use only what the notes say. Sources in the notes are marked [S1], [S2] and so on: refer to sources only by those ids and never invent a source, solution or fact. For each similar implementation give the organisation (entity), the solution or initiative, its scope (gdrfa for GDRFA Dubai's own work, uae_government for other UAE government entities, international_government for other governments, other_industry for anything else), what it does, how it is similar and how it differs. If the notes found nothing relevant, use status "not_found"; if no research was possible or it was too thin to judge, use "inconclusive". Write in the requested language.`;

/* ---------- schemas ---------- */

const S = { type: 'string' };
const LIST = { type: 'array', items: S };
const BOOL = { type: 'boolean' };
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const BENEFIT = obj({ benefit: S, reasoning: S, kpi: S, measurement: S, basis: { type: 'string', enum: BASIS }, needsValidation: BOOL });
const PROPOSAL_SCHEMA = obj({
  title: S, executiveSummary: S, solution: S, scope: S,
  problem: obj({ current: S, issue: S, whyItMatters: S, affected: S, ifUnresolved: S, basis: { type: 'string', enum: ['user', 'inferred', 'mixed'] } }),
  customerBenefits: { type: 'array', items: BENEFIT },
  orgBenefits: { type: 'array', items: BENEFIT },
  technologies: { type: 'array', items: obj({ name: S, role: S, why: S, dependencies: S, considerations: S }) },
  architecture: S,
  roadmap: { type: 'array', items: obj({ phase: { type: 'string', enum: PHASES }, activities: S, validation: S }) },
  dependencies: LIST,
  risks: { type: 'array', items: obj({ risk: S, mitigation: S }) },
  assumptions: { type: 'array', items: obj({ text: S, area: { type: 'string', enum: AREAS } }) },
  openQuestions: LIST
});
const UPDATE_SCHEMA = obj({
  proposal: PROPOSAL_SCHEMA,
  changes: { type: 'array', items: obj({ section: { type: 'string', enum: SECTION_KEYS }, note: S }) },
  readyForResearch: BOOL, researchStale: BOOL, readyForReview: BOOL
});
const CHAT_SCHEMA = obj({ reply: S, suggestions: LIST, intent: { type: 'string', enum: INTENTS } });
const CHECK_SCHEMA = obj({
  status: { type: 'string', enum: STATUSES },
  summary: S,
  similar: { type: 'array', items: obj({ entity: S, initiative: S, scope: { type: 'string', enum: SCOPES }, description: S, similarities: S, differences: S, closeness: { type: 'string', enum: ['high', 'partial', 'low'] }, sources: LIST }) },
  alreadyExists: LIST, different: LIST, opportunities: LIST, limitations: LIST
});

/* ---------- input hygiene ---------- */

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const cleanList = (v, max = LIMITS.fieldChars, n = LIMITS.listItems) => (Array.isArray(v) ? v : []).slice(0, n).map(x => clean(x, max)).filter(Boolean);
const cleanObjs = (v, fn) => (Array.isArray(v) ? v : []).slice(0, LIMITS.listItems).filter(x => x && typeof x === 'object').map(fn);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const lang = v => (v === 'ar' ? 'ar' : 'en');
const F = LIMITS.fieldChars, SH = LIMITS.shortChars;

function emptyProposal() {
  return { title: '', executiveSummary: '', solution: '', scope: '', problem: { current: '', issue: '', whyItMatters: '', affected: '', ifUnresolved: '', basis: 'inferred' },
    customerBenefits: [], orgBenefits: [], technologies: [], architecture: '', roadmap: [], dependencies: [], risks: [], assumptions: [], openQuestions: [] };
}
function cleanProposal(p) {
  p = p && typeof p === 'object' ? p : {};
  const pr = p.problem && typeof p.problem === 'object' ? p.problem : {};
  const benefit = b => ({ benefit: clean(b.benefit, SH), reasoning: clean(b.reasoning, F), kpi: clean(b.kpi, SH), measurement: clean(b.measurement, F), basis: oneOf(b.basis, BASIS, 'recommendation'), needsValidation: b.needsValidation !== false });
  return {
    title: clean(p.title, 300), executiveSummary: clean(p.executiveSummary, 4000), solution: clean(p.solution, 4000), scope: clean(p.scope, F),
    problem: { current: clean(pr.current, F), issue: clean(pr.issue, F), whyItMatters: clean(pr.whyItMatters, F), affected: clean(pr.affected, F), ifUnresolved: clean(pr.ifUnresolved, F), basis: oneOf(pr.basis, ['user', 'inferred', 'mixed'], 'inferred') },
    customerBenefits: cleanObjs(p.customerBenefits, benefit).filter(b => b.benefit),
    orgBenefits: cleanObjs(p.orgBenefits, benefit).filter(b => b.benefit),
    technologies: cleanObjs(p.technologies, t => ({ name: clean(t.name, 200), role: clean(t.role, F), why: clean(t.why, F), dependencies: clean(t.dependencies, F), considerations: clean(t.considerations, F) })).filter(t => t.name),
    architecture: clean(p.architecture, F),
    roadmap: cleanObjs(p.roadmap, r => ({ phase: oneOf(r.phase, PHASES, 'discovery'), activities: clean(r.activities, F), validation: clean(r.validation, F) })).filter(r => r.activities),
    dependencies: cleanList(p.dependencies, SH),
    risks: cleanObjs(p.risks, r => ({ risk: clean(r.risk, SH), mitigation: clean(r.mitigation, F) })).filter(r => r.risk),
    assumptions: cleanObjs(p.assumptions, a => ({ text: clean(a.text, SH), area: oneOf(a.area, AREAS, 'scope') })).filter(a => a.text),
    openQuestions: cleanList(p.openQuestions, SH, 5)
  };
}
function cleanCheck(c) {
  if (!c || typeof c !== 'object') return null;
  const sources = (Array.isArray(c.sources) ? c.sources : []).slice(0, 20).map(s => ({ id: clean(s && s.id, 8), title: clean(s && s.title, 300), url: clean(s && s.url, 1000) })).filter(s => /^S\d{1,2}$/.test(s.id) && /^https?:\/\//.test(s.url));
  return {
    status: STATUSES.includes(c.status) ? c.status : 'inconclusive', summary: clean(c.summary, F), searched: !!c.searched,
    similar: cleanObjs(c.similar, x => ({ entity: clean(x.entity || x.where, 200), initiative: clean(x.initiative || x.name, 200), scope: oneOf(x.scope, SCOPES, 'other_industry'), description: clean(x.description, 800), similarities: clean(x.similarities, 600), differences: clean(x.differences, 600), closeness: oneOf(x.closeness, ['high', 'partial', 'low'], 'low'), sources: cleanList(x.sources, 8) })),
    alreadyExists: cleanList(c.alreadyExists), different: cleanList(c.different), opportunities: cleanList(c.opportunities), limitations: cleanList(c.limitations), sources,
    checkedAt: clean(c.checkedAt, 40) || undefined, focus: clean(c.focus, 400) || undefined
  };
}
/* Conversation from the browser: alternating text turns, newest last. */
function cleanMessages(list) {
  const out = [];
  for (const m of (Array.isArray(list) ? list : []).slice(-LIMITS.messages)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const text = clean(m.text, m.role === 'user' ? LIMITS.userChars : LIMITS.assistantChars);
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + text; else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}
const cleanLocked = v => (Array.isArray(v) ? v : []).filter(k => SECTION_KEYS.includes(k));
const cleanConfirmed = v => cleanList(v, SH, LIMITS.confirmed);

function checkContext(check) {
  if (!check) return 'Research results: not available yet (the automatic research has not run).';
  const src = check.sources.map(s => `[${s.id}] ${s.title} - ${s.url}`).join('\n');
  return `Research results (${check.searched ? 'live public web search; GDRFA internal systems not searched' : 'no web search was possible'}):\n${JSON.stringify({ status: check.status, summary: check.summary, similar: check.similar, alreadyExists: check.alreadyExists, different: check.different, opportunities: check.opportunities, limitations: check.limitations })}\nSources:\n${src || '(none)'}`;
}
const transcriptOf = messages => messages.map(m => `${m.role === 'user' ? 'Employee' : 'Fekra'}: ${m.content}`).join('\n\n').slice(-60000);
const sectionOf = (p, key) => Object.fromEntries(SECTION_FIELDS[key].map(f => [f, p[f]]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- the service ---------- */

function createFekra({ config, logger, client }) {
  const ai = config.ai, fk = config.fekra;
  const enabled = ai.enabled && fk.enabled;
  const anthropic = enabled ? (client || new Anthropic()) : null;
  const useFallbacks = ai.fallbacks === 'default' && FALLBACK_MODELS.test(fk.model);
  const sys = text => [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
  const breaker = { failures: 0, openUntil: 0 };
  const budget = { hour: -1, calls: 0 };
  let webSearchAvailable = fk.webSearch;

  const fail = (reason, message, status = 502) => Object.assign(new Error(message || reason), { reason, status });
  function guard(cost = 1) {
    if (!anthropic) throw fail(ai.apiKeySet ? 'ai_disabled' : 'not_configured', 'The AI service is not configured.', 503);
    if (Date.now() < breaker.openUntil) throw fail('circuit_open', 'The AI service is temporarily unavailable.', 503);
    const h = Math.floor(Date.now() / 3600000);
    if (h !== budget.hour) { budget.hour = h; budget.calls = 0; }
    if (budget.calls + cost > fk.maxCallsPerHour) throw fail('hourly_budget', 'Fekra has reached its hourly usage limit.', 429);
    budget.calls += cost;
  }
  function classify(err) {
    if (err && err.reason) return err.reason;
    if (err instanceof Anthropic.AuthenticationError) return 'auth';
    if (err instanceof Anthropic.PermissionDeniedError) return 'permission';
    if (err instanceof Anthropic.NotFoundError) return 'model_not_found';
    if (err instanceof Anthropic.RateLimitError) return 'rate_limited';
    if (err instanceof Anthropic.BadRequestError) return 'bad_request';
    if (err instanceof Anthropic.APIConnectionTimeoutError) return 'timeout';
    if (err instanceof Anthropic.APIConnectionError) return 'connection';
    if (err instanceof Anthropic.APIError) return `api_${err.status || 'error'}`;
    return 'error';
  }
  function noteFailure(op, err, started) {
    const reason = classify(err);
    if (!['hourly_budget', 'circuit_open', 'not_configured', 'ai_disabled', 'refusal'].includes(reason)) {
      breaker.failures += 1;
      if (breaker.failures >= 4) { breaker.openUntil = Date.now() + 60000; breaker.failures = 0; }
    }
    const level = ['auth', 'permission', 'model_not_found', 'bad_request'].includes(reason) ? 'error' : 'warn';
    logger[level]('fekra_failure', { op, reason, latencyMs: Date.now() - started, status: err && err.status, detail: err && err.message ? String(err.message).slice(0, 300) : undefined });
    if (!err.reason) { err.reason = reason; err.status = reason === 'rate_limited' ? 429 : 502; }
    return err;
  }

  async function call(params, { timeout = fk.timeoutMs } = {}) {
    const opts = { timeout, maxRetries: 1 };
    return useFallbacks
      ? anthropic.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, opts)
      : anthropic.messages.create(params, opts);
  }
  function jsonOf(res, op) {
    if (res.stop_reason === 'refusal') throw fail('refusal', 'Fekra cannot help with that request.', 422);
    if (res.stop_reason === 'max_tokens') throw fail('max_tokens', 'The response was too long.');
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    try { return JSON.parse(text); } catch { throw fail('invalid_json', `${op}: response was not valid JSON`); }
  }
  const log = (op, started, res, extra = {}) => logger.info('fekra', { op, model: res && res.model, latencyMs: Date.now() - started, inputTokens: res && res.usage && res.usage.input_tokens, outputTokens: res && res.usage && res.usage.output_tokens, cacheReadTokens: res && res.usage && res.usage.cache_read_input_tokens, ...extra });

  /* One conversational turn: a natural reply; the proposal itself is maintained by update(). */
  async function chat(body) {
    const l = lang(body.lang), messages = cleanMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw fail('bad_request', 'The conversation must end with a message from the employee.', 400);
    guard(1);
    const started = Date.now();
    try {
      const p = cleanProposal(body.proposal), locked = cleanLocked(body.locked);
      const state = body.researching ? 'Research into similar implementations is running now.' : '';
      const review = body.readyForReview ? (body.reviewOffered ? 'The proposal is ready for review and has already been offered.' : 'The proposal is ready for review and has NOT been offered yet: offer it now.') : body.researching ? 'Do not offer the review yet: wait until the research has finished.' : 'The proposal is not yet complete enough for review.';
      const context = `Write in ${LANG_NAME[l]}.\nCurrent proposal (built in the background; JSON): ${JSON.stringify(p)}\nLocked (approved by the employee): ${locked.join(', ') || 'none'}\nConfirmed by the employee: ${JSON.stringify(cleanConfirmed(body.confirmed))}\n${checkContext(cleanCheck(body.check))}\n${state}\n${review}`;
      const res = await call({
        model: fk.model, max_tokens: 8000, system: sys(CHAT_SYSTEM),
        messages: [...messages, { role: 'system', content: context }],
        output_config: { effort: fk.chatEffort, format: { type: 'json_schema', schema: CHAT_SCHEMA } }
      });
      const out = jsonOf(res, 'chat');
      breaker.failures = 0; log('chat', started, res, { turns: messages.length });
      return { reply: clean(out.reply, LIMITS.assistantChars), suggestions: cleanList(out.suggestions, 200).slice(0, 3), intent: oneOf(out.intent, INTENTS, 'other'), model: res.model };
    } catch (err) { throw noteFailure('chat', err, started); }
  }

  /* The proposal, rebuilt in the background. Locked sections are enforced here, not just requested in the prompt. */
  async function update(body) {
    const l = lang(body.lang), messages = cleanMessages(body.messages);
    if (!messages.length) throw fail('bad_request', 'There is no conversation to build a proposal from.', 400);
    const mode = oneOf(body.mode, ['update', 'regenerate', 'translate', 'section'], 'update');
    const section = SECTION_KEYS.includes(body.section) ? body.section : null, instruction = clean(body.instruction, LIMITS.instructionChars);
    if (mode === 'section' && (!section || !instruction)) throw fail('bad_request', 'Choose a section and say how to improve it.', 400);
    guard(1);
    const started = Date.now();
    try {
      const prev = cleanProposal(body.proposal), locked = cleanLocked(body.locked);
      const task = {
        update: 'Update the proposal with everything learned so far.',
        regenerate: 'Rebuild the proposal from the whole conversation and the research, improving its quality and coherence. Keep locked sections as they are.',
        translate: `Rewrite the whole proposal, locked sections included, in ${LANG_NAME[l]}, preserving its meaning exactly. Change nothing else.`,
        section: `Apply this instruction from the employee to the "${section}" section only, and return every other section exactly as it is: ${instruction}`
      }[mode];
      const prompt = `Language: ${LANG_NAME[l]}.\nTask: ${task}\nLocked sections (approved by the employee): ${locked.join(', ') || 'none'}\nFacts the employee confirmed: ${JSON.stringify(cleanConfirmed(body.confirmed))}\nCurrent proposal (JSON): ${JSON.stringify(prev)}\n${checkContext(cleanCheck(body.check))}\n\nConversation:\n${transcriptOf(messages)}`;
      const res = await call({
        model: fk.model, max_tokens: 16000, system: sys(UPDATE_SYSTEM),
        messages: [{ role: 'user', content: prompt }],
        output_config: { effort: mode === 'regenerate' ? fk.effort : fk.updateEffort, format: { type: 'json_schema', schema: UPDATE_SCHEMA } }
      });
      const out = jsonOf(res, 'update');
      const next = cleanProposal(out.proposal), pending = {};
      if (mode === 'section') SECTION_KEYS.filter(k => k !== section).forEach(k => Object.assign(next, sectionOf(prev, k)));
      if (mode !== 'translate') {
        for (const k of locked) { // approved content never changes silently: a different version becomes a suggestion
          if (!same(sectionOf(next, k), sectionOf(prev, k))) { if (!(mode === 'section' && k === section)) pending[k] = sectionOf(next, k); Object.assign(next, sectionOf(prev, k)); }
        }
        if (mode === 'section' && locked.includes(section)) delete pending[section];
      }
      const changed = SECTION_KEYS.filter(k => !same(sectionOf(next, k), sectionOf(prev, k)));
      const notes = Object.fromEntries(cleanObjs(out.changes, c => [oneOf(c.section, SECTION_KEYS, null), clean(c.note, 200)]).filter(([k]) => k));
      breaker.failures = 0; log('update', started, res, { mode, changed: changed.length, pending: Object.keys(pending).length });
      return {
        proposal: next, changes: changed.map(k => ({ section: k, note: notes[k] || '' })), pending,
        readyForResearch: !!out.readyForResearch, researchStale: !!out.researchStale, readyForReview: !!out.readyForReview, mode, model: res.model
      };
    } catch (err) { throw noteFailure('update', err, started); }
  }

  /* Step 1 of the innovation check: research with web search; returns notes with [S#] markers and the sources that really came back. */
  async function research(idea, l, focus) {
    // The basic tool versions put results straight into Claude's context, so every claim in the findings carries a
    // citation to a result. (The _20260209 versions filter results in code first, and their findings came back uncited.)
    const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: fk.maxSearches }, { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3, citations: { enabled: true } }];
    const ask = `Language for the findings: ${LANG_NAME[l]}.\nThe employee's idea (JSON): ${JSON.stringify(idea)}\n${focus ? `The employee asked for further research on: ${focus}\n` : ''}Research whether this or something similar already exists (GDRFA first, then other UAE government entities, other governments, other industries), and write your findings.`;
    let messages = [{ role: 'user', content: ask }];
    const blocks = [];
    let res;
    for (let i = 0; i < 4; i++) { // resume pause_turn (server-side tool loop limit)
      res = await call({ model: fk.model, max_tokens: 16000, system: sys(RESEARCH_SYSTEM), tools, messages, output_config: { effort: fk.effort } });
      blocks.push(...res.content);
      if (res.stop_reason !== 'pause_turn') break;
      messages = [...messages, { role: 'assistant', content: res.content }];
    }
    if (res.stop_reason === 'refusal') throw fail('refusal', 'Fekra cannot research that request.', 422);
    // sources: only URLs that the search or fetch tools returned, numbered in the order the text cites them
    const known = new Map(); // url -> { title }
    const fetched = []; // fetched pages in order: { url, title } (their citations carry a title and index, not a URL)
    let searchErrors = 0, searches = 0;
    for (const b of blocks) {
      if (b.type === 'web_search_tool_result') {
        searches += 1;
        if (Array.isArray(b.content)) b.content.forEach(r => { if (r && r.url && !known.has(r.url)) known.set(r.url, { title: r.title || r.url }); });
        else searchErrors += 1; // error object, e.g. max_uses_exceeded or unavailable
      }
      if (b.type === 'web_fetch_tool_result' && b.content && b.content.url) {
        const title = (b.content.content && b.content.content.title) || b.content.url;
        fetched.push({ url: b.content.url, title });
        if (!known.has(b.content.url)) known.set(b.content.url, { title });
      }
    }
    const citedUrl = c => {
      if (!c) return null;
      if (c.url) return c.url;
      if (c.type === 'char_location' && fetched.length) {
        const byTitle = c.document_title && fetched.find(f => f.title === c.document_title);
        const f = byTitle || fetched[c.document_index];
        return f ? f.url : null;
      }
      return null;
    };
    const ids = new Map(); // url -> S#
    const idFor = (url, title) => { if (!known.has(url)) return null; if (!ids.has(url)) ids.set(url, { id: `S${ids.size + 1}`, title: title || known.get(url).title, url }); return ids.get(url).id; };
    let notes = '', citations = 0;
    for (const b of blocks) {
      if (b.type !== 'text') continue;
      notes += b.text;
      citations += (b.citations || []).length;
      const marks = [...new Set((b.citations || []).map(c => { const u = citedUrl(c); return u ? idFor(u, c.title || c.document_title) : null; }).filter(Boolean))];
      if (marks.length) notes += ' ' + marks.map(m => `[${m}]`).join('');
    }
    // uncited search results are not listed: every source shown supports something in the findings
    return { notes: notes.trim(), sources: [...ids.values()], searches, searchErrors, fetches: fetched.length, citations, model: res.model, usage: res.usage };
  }

  /* The existing-implementation assessment: research (when available), then a structured assessment. */
  async function check(body) {
    const l = lang(body.lang), p = cleanProposal(body.proposal || {}), focus = clean(body.focus, 400);
    const idea = { title: p.title, executiveSummary: p.executiveSummary, problem: p.problem, solution: p.solution, scope: p.scope };
    if (!p.title && !p.solution && !p.problem.issue) throw fail('bad_request', 'Describe the idea first, so there is something to research.', 400);
    guard(2);
    const started = Date.now();
    try {
      let r = { notes: '', sources: [], searches: 0, searchErrors: 0, fetches: 0, citations: 0 }, searched = false, unavailable = null;
      if (webSearchAvailable) {
        try {
          r = await research(idea, l, focus); searched = r.searches > 0 && r.searchErrors < r.searches;
          if (!searched) unavailable = 'search_error';
        } catch (err) {
          const reason = classify(err);
          // research refused: give an honest "inconclusive" result; stop trying only when the organisation has not enabled web search
          if (reason === 'bad_request' || reason === 'permission') { if (reason === 'permission') webSearchAvailable = false; unavailable = 'web_search_not_enabled'; logger.error('fekra_web_search_unavailable', { reason, detail: String(err.message).slice(0, 300) }); }
          else throw err;
        }
      } else unavailable = 'web_search_disabled';
      const srcList = r.sources.map(s => `[${s.id}] ${s.title} - ${s.url}`).join('\n');
      const prompt = searched
        ? `Language: ${LANG_NAME[l]}.\nIdea (JSON): ${JSON.stringify(idea)}\n\nResearch notes:\n${r.notes || '(the search returned nothing relevant)'}\n\nSources:\n${srcList || '(none)'}\n\nProduce the structured assessment.`
        : `Language: ${LANG_NAME[l]}.\nIdea (JSON): ${JSON.stringify(idea)}\n\nNo web research could be carried out (${unavailable}). Use status "inconclusive", explain in the summary that no comparable solutions could be checked, list no similar solutions, and in limitations say that live research is not connected. You may suggest in opportunities what a manual review should look for.`;
      const res = await call({ model: fk.model, max_tokens: 16000, system: sys(EXTRACT_SYSTEM), messages: [{ role: 'user', content: prompt }], output_config: { effort: 'low', format: { type: 'json_schema', schema: CHECK_SCHEMA } } });
      const out = jsonOf(res, 'check');
      const valid = new Set(r.sources.map(s => s.id));
      const result = cleanCheck({ ...out, searched, sources: r.sources });
      result.status = searched ? result.status : 'inconclusive';
      result.similar = searched ? result.similar.map(x => ({ ...x, sources: x.sources.filter(id => valid.has(id)) })) : [];
      result.checkedAt = new Date().toISOString();
      if (focus) result.focus = focus;
      if (unavailable) result.unavailable = unavailable;
      result.research = { searches: r.searches, fetches: r.fetches, citations: r.citations }; // counts only, for transparency and monitoring
      breaker.failures = 0; log('check', started, res, { searched, ...result.research, sources: r.sources.length });
      return result;
    } catch (err) { throw noteFailure('check', err, started); }
  }

  /* Submission: forwarded only to a configured review endpoint; never pretends. */
  async function submit(body) {
    if (!fk.submitUrl) return { submitted: false, reason: 'not_configured' };
    const doc = body && body.proposal && typeof body.proposal === 'object' ? cleanProposal(body.proposal) : null;
    if (!doc || !doc.title) throw fail('bad_request', 'There is no proposal to submit.', 400);
    const payload = { source: 'fekra', version: 2, submittedAt: new Date().toISOString(), lang: lang(body.lang), reference: clean(body.reference, 40) || null, proposal: doc, assessment: cleanCheck(body.check) };
    const started = Date.now();
    try {
      const r = await fetch(fk.submitUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(fk.submitToken ? { Authorization: `Bearer ${fk.submitToken}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw fail('submit_failed', `Review system returned ${r.status}`);
      let ref = null; try { const j = await r.json(); ref = clean(j && (j.reference || j.id || j.ticket), 100) || null; } catch { /* no JSON body */ }
      logger.info('fekra', { op: 'submit', latencyMs: Date.now() - started, status: r.status });
      return { submitted: true, reference: ref };
    } catch (err) {
      logger.warn('fekra_failure', { op: 'submit', reason: err.reason || 'submit_error', detail: String(err.message).slice(0, 300) });
      throw err.reason ? err : fail('submit_failed', 'The review system could not be reached.');
    }
  }

  return {
    enabled, chat, update, check, submit,
    status: () => ({ enabled, webSearch: enabled && webSearchAvailable, submission: !!fk.submitUrl, model: enabled ? fk.model : null }),
    stats: () => ({ breakerOpen: Date.now() < breaker.openUntil, callsThisHour: budget.hour === Math.floor(Date.now() / 3600000) ? budget.calls : 0 }),
    _internals: { CHAT_SCHEMA, CHECK_SCHEMA, UPDATE_SCHEMA, PROPOSAL_SCHEMA, cleanMessages, cleanProposal, useFallbacks }
  };
}

module.exports = { createFekra, cleanProposal, cleanCheck, cleanMessages, emptyProposal, SECTION_KEYS, SECTION_FIELDS, STATUSES, SCOPES, PHASES };
