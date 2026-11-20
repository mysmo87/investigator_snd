'use strict';
/* Fekra (فكرة) — the GDRFA innovation assistant.

   Stateless: the browser keeps the conversation and sends it with each
   request; nothing is stored on this server. Four Claude-backed operations:

   - chat      One conversational turn. Structured output (JSON schema) returns the
               reply, the stage, suggested replies and the updated working draft.
   - check     The innovation check. Step 1 researches with Anthropic's server-side
               web search (citations on). Step 2 turns that research into a structured
               assessment. Only URLs that actually came back from the search can be
               shown, so references cannot be invented. If web search is unavailable,
               the result says so and the status is "inconclusive".
   - proposal  Writes the 13-part management-ready proposal (structured output).
   - revise    Rewrites one proposal section on request.

   Submission for management review is an integration boundary: it is forwarded to
   FEKRA_SUBMIT_URL when configured, and otherwise reported as not connected. */

const Anthropic = require('@anthropic-ai/sdk').default;

const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/; // models that accept fallbacks: "default"
const STAGES = ['discover', 'validate', 'design', 'evaluate', 'propose'];
const STATUSES = ['already_implemented', 'partially_implemented', 'not_found', 'inconclusive'];
const SECTION_KEYS = ['executiveSummary', 'challenge', 'innovation', 'assessment', 'alignment', 'technology', 'value', 'roadmap', 'resources', 'risks', 'metrics', 'recommendation'];
const LANG_NAME = { en: 'English', ar: 'Arabic (Modern Standard Arabic, clear and professional)' };

const LIMITS = { messages: 60, userChars: 4000, assistantChars: 8000, fieldChars: 2000, listItems: 12, sectionChars: 12000, instructionChars: 1000 };

/* ---------- prompts (stable text first, so it caches) ---------- */

const CHAT_SYSTEM = `You are Fekra (فكرة), the GDRFA Innovation Assistant on the "Agentic AI: Cleared for Takeoff" platform of the General Directorate of Residency and Foreigners Affairs in Dubai (GDRFA). You help GDRFA employees turn rough ideas into clear, evidence-based innovation proposals for senior management. Work like a personal innovation consultant, technology advisor and strategic business analyst in one.

How you work with the employee:
- Hold a natural conversation. Ask at most one or two focused questions per reply, and build on what the employee has already said. Never run through a fixed questionnaire.
- Help people who only have a partial idea: offer concrete angles, examples or options they can react to.
- Keep the employee's original idea and intent, while making it clearer and stronger. Challenge weak points constructively and suggest improvements.
- Keep replies concise (usually under 160 words) unless the employee asks for depth. Use short paragraphs, and lines starting with "- " for lists. You may use **bold** for a key phrase. No emoji, no headings.

The journey has five stages. Move between them flexibly, following the conversation, and let the employee go back to earlier points at any time:
1. discover: what the idea is, the problem or opportunity it addresses, who benefits, how things are done today, what would change, and what makes it innovative.
2. validate: whether similar solutions already exist (GDRFA, UAE federal and Dubai government, other governments' immigration, border, residency and customer-experience services, and adjacent industries). This is done by Fekra's innovation check.
3. design: how it could be implemented. Recommend only technologies that genuinely help: AI and machine learning, generative and agentic AI, predictive analytics, computer vision, natural language processing, intelligent automation, data analytics, IoT and sensors, digital twins, API integration, cloud, edge or on-premises hosting. For each, cover why it is needed, the data and integrations it requires, technical challenges, privacy, security and data-sovereignty considerations, and dependencies. Do not force AI where a simpler approach works. Suggest a feasibility study and, where useful, a proof of concept.
4. evaluate: business value (customer experience, speed of service, efficiency, cost, employee productivity, decision-making, security and risk, sustainability, strategic alignment, scalability across departments) and meaningful KPIs.
5. propose: when the idea is mature, invite the employee to generate the management-ready proposal.

Honesty rules (strict):
- You cannot browse the web in this conversation. Research happens only through Fekra's separate innovation check; its results, when available, are given to you as "Innovation check results". Never claim to have researched, verified or found anything that is not in those results. If no check has run, explain what the check would look for and offer to run it.
- Never invent facts about GDRFA's existing initiatives, systems, budgets, statistics or strategies. If a fact matters, ask the employee, or mark it as an assumption to verify.
- Never invent ROI figures, cost savings, percentages or other numbers. Describe value qualitatively, and label any illustrative scenario clearly as an assumption.
- Keep three things visibly separate: verified findings (only from the innovation check, with its sources), proposed approaches (your suggestions), and assumptions.
- Describe strategic alignment in general terms (for example, Dubai's and the UAE's published ambitions for digital government and AI) unless the employee gives specifics.
- If the employee starts sharing personal data or classified information, remind them not to.

Return JSON that matches the schema:
- reply: your next message to the employee.
- stage: the stage the conversation is in now.
- suggestions: two to four short replies the employee could tap next, written in the employee's voice.
- draft: the current working draft, rewritten clearly and concisely from everything said so far. Fill a field only when the conversation supports it; otherwise use an empty string or an empty list. Keep text fields to one to three sentences and list items to one sentence.
- missing: the most important information still missing, up to four short items.
- readyForCheck: true once the idea, the problem and the intended beneficiaries are clear enough to run the innovation check.
- readyForProposal: true once there is enough material (idea, problem, solution and value, ideally also technology and the innovation check) to write a management-ready proposal.`;

const RESEARCH_SYSTEM = `You are the research analyst behind Fekra, the GDRFA (General Directorate of Residency and Foreigners Affairs, Dubai) innovation assistant. An employee has an idea. Your job is to find out, with web search, whether the same or similar solutions already exist, so the employee can position the idea honestly.

Search broadly and efficiently:
- GDRFA and other UAE entities (for example ICP, Dubai Digital Authority, Dubai Airports, Emirates), and UAE federal and Dubai government innovation.
- Other governments' immigration, border, visa, residency and citizen-service innovations.
- Adjacent industries where relevant (aviation, airports, banking identity checks, telecom, smart cities).
Prefer official and reputable sources (government sites, international organisations, established news, vendors' official pages).

Then write your findings in the employee's language:
- Which solutions exist, where, what they do, and how close they are to the idea. Cite sources for every factual claim.
- What already exists, and what could be genuinely different or better about the employee's idea.
- Your overall judgement: already implemented (a highly similar solution exists), partially implemented (related components exist but the idea adds meaningful differences), or no equivalent found (nothing substantially equivalent turned up in this search, which does not prove that none exists anywhere).
- The limits of this research (for example, internal GDRFA projects and non-public work cannot be seen from the web).
Never invent a solution, organisation, figure or source. If the search finds little, say so plainly.`;

const EXTRACT_SYSTEM = `You convert research notes about an innovation idea into a structured assessment. Use only what the notes say. Each source in the notes is marked [S1], [S2] and so on; refer to sources only by those ids, and never invent a source, a solution or a fact. If the notes found nothing relevant, use status "not_found"; if no research was possible or it was too thin to judge, use "inconclusive". Write in the requested language.`;

const PROPOSAL_SYSTEM = `You are Fekra, the GDRFA (General Directorate of Residency and Foreigners Affairs, Dubai) innovation assistant. Write a professional innovation proposal for senior management from the employee's conversation, the working draft and the innovation check results.

Write it as a polished consultant would: clear, persuasive, specific and concise. Do not paste the employee's answers into a template; synthesise them. Keep the employee's original idea and intent.

Rules:
- Never invent facts about GDRFA's initiatives, systems, budgets or statistics, and never invent ROI, cost or impact figures. Where a number would help, describe how it should be measured or give a clearly labelled assumption.
- The innovation assessment must reflect only the innovation check results. Cite their sources with the same [S1] markers. If no check was run, say that the innovation check has not yet been completed and recommend running it before a decision.
- Keep verified findings, proposed approaches and assumptions clearly distinguished (for example, "Assumption:" at the start of a sentence).
- Recommend only technologies that genuinely help, with privacy, security and data-sovereignty considerations.
- Each section is plain text: short paragraphs, and lines starting with "- " for lists. You may use **bold** sparingly. No headings inside sections.
- Write everything in the requested language.`;

const REVISE_SYSTEM = `You are Fekra, the GDRFA innovation assistant, revising one section of a management-ready innovation proposal at the employee's request. Keep the facts and intent of the section unless the employee asks otherwise. Never invent facts, figures or sources; keep any [S1]-style source markers that remain relevant. Plain text: short paragraphs and "- " lists, **bold** sparingly, no headings. Write in the requested language.`;

/* ---------- schemas ---------- */

const S = { type: 'string' };
const LIST = { type: 'array', items: S };
const DRAFT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'problem', 'beneficiaries', 'currentProcess', 'solution', 'innovation', 'technologies', 'value', 'kpis', 'risks', 'assumptions'],
  properties: {
    title: S, problem: S, beneficiaries: S, currentProcess: S, solution: S, innovation: S,
    technologies: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'why'], properties: { name: S, why: S } } },
    value: LIST, kpis: LIST, risks: LIST, assumptions: LIST
  }
};
const CHAT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['reply', 'stage', 'suggestions', 'draft', 'missing', 'readyForCheck', 'readyForProposal'],
  properties: {
    reply: S, stage: { type: 'string', enum: STAGES }, suggestions: LIST, draft: DRAFT_SCHEMA, missing: LIST,
    readyForCheck: { type: 'boolean' }, readyForProposal: { type: 'boolean' }
  }
};
const CHECK_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['status', 'summary', 'similar', 'alreadyExists', 'different', 'opportunities', 'limitations'],
  properties: {
    status: { type: 'string', enum: STATUSES },
    summary: S,
    similar: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'where', 'description', 'closeness', 'sources'], properties: { name: S, where: S, description: S, closeness: { type: 'string', enum: ['high', 'partial', 'low'] }, sources: LIST } } },
    alreadyExists: LIST, different: LIST, opportunities: LIST, limitations: LIST
  }
};
const PROPOSAL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'sections'],
  properties: { title: S, sections: { type: 'object', additionalProperties: false, required: SECTION_KEYS, properties: Object.fromEntries(SECTION_KEYS.map(k => [k, S])) } }
};
const REVISE_SCHEMA = { type: 'object', additionalProperties: false, required: ['text'], properties: { text: S } };

/* ---------- input hygiene ---------- */

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const cleanList = (v, max = LIMITS.fieldChars) => (Array.isArray(v) ? v : []).slice(0, LIMITS.listItems).map(x => clean(x, max)).filter(Boolean);
const lang = v => (v === 'ar' ? 'ar' : 'en');

function cleanDraft(d) {
  d = d && typeof d === 'object' ? d : {};
  const t = k => clean(d[k], LIMITS.fieldChars);
  return {
    title: clean(d.title, 300), problem: t('problem'), beneficiaries: t('beneficiaries'), currentProcess: t('currentProcess'), solution: t('solution'), innovation: t('innovation'),
    technologies: (Array.isArray(d.technologies) ? d.technologies : []).slice(0, LIMITS.listItems).map(x => ({ name: clean(x && x.name, 200), why: clean(x && x.why, LIMITS.fieldChars) })).filter(x => x.name),
    value: cleanList(d.value), kpis: cleanList(d.kpis), risks: cleanList(d.risks), assumptions: cleanList(d.assumptions)
  };
}
function cleanCheck(c) {
  if (!c || typeof c !== 'object') return null;
  const sources = (Array.isArray(c.sources) ? c.sources : []).slice(0, 20).map(s => ({ id: clean(s && s.id, 8), title: clean(s && s.title, 300), url: clean(s && s.url, 1000) })).filter(s => /^S\d{1,2}$/.test(s.id) && /^https?:\/\//.test(s.url));
  return {
    status: STATUSES.includes(c.status) ? c.status : 'inconclusive', summary: clean(c.summary, LIMITS.fieldChars), searched: !!c.searched,
    similar: (Array.isArray(c.similar) ? c.similar : []).slice(0, 10).map(x => ({ name: clean(x && x.name, 200), where: clean(x && x.where, 200), description: clean(x && x.description, 800), closeness: clean(x && x.closeness, 10), sources: cleanList(x && x.sources, 8) })),
    alreadyExists: cleanList(c.alreadyExists), different: cleanList(c.different), opportunities: cleanList(c.opportunities), limitations: cleanList(c.limitations), sources
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

function checkContext(check) {
  if (!check) return 'Innovation check results: not run yet.';
  const src = check.sources.map(s => `[${s.id}] ${s.title} - ${s.url}`).join('\n');
  return `Innovation check results (${check.searched ? 'live web search' : 'no web search was possible'}):\n${JSON.stringify({ status: check.status, summary: check.summary, similar: check.similar, alreadyExists: check.alreadyExists, different: check.different, opportunities: check.opportunities, limitations: check.limitations })}\nSources:\n${src || '(none)'}`;
}

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

  /* One conversational turn. */
  async function chat(body) {
    const l = lang(body.lang), messages = cleanMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw fail('bad_request', 'The conversation must end with a message from the employee.', 400);
    guard(1);
    const started = Date.now();
    try {
      const context = `Write the reply, suggestions and draft in ${LANG_NAME[l]}.\nCurrent working draft: ${JSON.stringify(cleanDraft(body.draft))}\n${checkContext(cleanCheck(body.check))}`;
      const res = await call({
        model: fk.model, max_tokens: 16000, system: sys(CHAT_SYSTEM),
        messages: [...messages, { role: 'system', content: context }],
        output_config: { effort: fk.chatEffort, format: { type: 'json_schema', schema: CHAT_SCHEMA } }
      });
      const out = jsonOf(res, 'chat');
      breaker.failures = 0; log('chat', started, res, { turns: messages.length });
      return {
        reply: clean(out.reply, LIMITS.assistantChars), stage: STAGES.includes(out.stage) ? out.stage : 'discover',
        suggestions: cleanList(out.suggestions, 200).slice(0, 4), draft: cleanDraft(out.draft), missing: cleanList(out.missing, 300).slice(0, 4),
        readyForCheck: !!out.readyForCheck, readyForProposal: !!out.readyForProposal, model: res.model
      };
    } catch (err) { throw noteFailure('chat', err, started); }
  }

  /* Step 1 of the innovation check: research with web search; returns notes with [S#] markers and the sources that really came back. */
  async function research(draft, l) {
    const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: fk.maxSearches }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3, citations: { enabled: true } }];
    const idea = `Language for the findings: ${LANG_NAME[l]}.\nThe employee's idea (JSON): ${JSON.stringify({ title: draft.title, problem: draft.problem, beneficiaries: draft.beneficiaries, currentProcess: draft.currentProcess, solution: draft.solution, innovation: draft.innovation })}\nResearch whether this or something similar already exists, and write your findings.`;
    let messages = [{ role: 'user', content: idea }];
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
    let notes = '';
    for (const b of blocks) {
      if (b.type !== 'text') continue;
      notes += b.text;
      const marks = [...new Set((b.citations || []).map(c => { const u = citedUrl(c); return u ? idFor(u, c.title || c.document_title) : null; }).filter(Boolean))];
      if (marks.length) notes += ' ' + marks.map(m => `[${m}]`).join('');
    }
    // uncited search results are not listed: every source shown supports something in the findings
    return { notes: notes.trim(), sources: [...ids.values()], searches, searchErrors, model: res.model, usage: res.usage };
  }

  /* The innovation check: research (when available), then a structured assessment. */
  async function check(body) {
    const l = lang(body.lang), draft = cleanDraft(body.draft);
    if (!draft.problem && !draft.solution && !draft.title) throw fail('bad_request', 'Describe the idea first, so there is something to check.', 400);
    guard(2);
    const started = Date.now();
    try {
      let r = { notes: '', sources: [], searches: 0, searchErrors: 0 }, searched = false, unavailable = null;
      if (webSearchAvailable) {
        try {
          r = await research(draft, l); searched = r.searches > 0 && r.searchErrors < r.searches;
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
        ? `Language: ${LANG_NAME[l]}.\nIdea (JSON): ${JSON.stringify(draft)}\n\nResearch notes:\n${r.notes || '(the search returned nothing relevant)'}\n\nSources:\n${srcList || '(none)'}\n\nProduce the structured assessment.`
        : `Language: ${LANG_NAME[l]}.\nIdea (JSON): ${JSON.stringify(draft)}\n\nNo web research could be carried out (${unavailable}). Use status "inconclusive", explain in the summary that no comparable solutions could be checked, list no similar solutions, and in limitations say that live research is not connected. You may suggest in opportunities what a manual review should look for.`;
      const res = await call({ model: fk.model, max_tokens: 16000, system: sys(EXTRACT_SYSTEM), messages: [{ role: 'user', content: prompt }], output_config: { effort: 'low', format: { type: 'json_schema', schema: CHECK_SCHEMA } } });
      const out = jsonOf(res, 'check');
      const valid = new Set(r.sources.map(s => s.id));
      const result = cleanCheck({ ...out, searched, sources: r.sources });
      result.status = searched ? result.status : 'inconclusive';
      result.similar = searched ? result.similar.map(x => ({ ...x, sources: x.sources.filter(id => valid.has(id)) })) : [];
      result.checkedAt = new Date().toISOString();
      if (unavailable) result.unavailable = unavailable;
      breaker.failures = 0; log('check', started, res, { searched, searches: r.searches, sources: r.sources.length });
      return result;
    } catch (err) { throw noteFailure('check', err, started); }
  }

  /* The management-ready proposal. */
  async function proposal(body) {
    const l = lang(body.lang), draft = cleanDraft(body.draft), messages = cleanMessages(body.messages);
    if (!draft.problem && !draft.solution) throw fail('bad_request', 'There is not enough material for a proposal yet.', 400);
    guard(1);
    const started = Date.now();
    try {
      const transcript = messages.map(m => `${m.role === 'user' ? 'Employee' : 'Fekra'}: ${m.content}`).join('\n\n').slice(-60000);
      const res = await call({
        model: fk.model, max_tokens: 16000, system: sys(PROPOSAL_SYSTEM),
        messages: [{ role: 'user', content: `Language: ${LANG_NAME[l]}.\nWorking draft (JSON): ${JSON.stringify(draft)}\n${checkContext(cleanCheck(body.check))}\n\nConversation:\n${transcript}\n\nWrite the proposal. Section keys: executiveSummary, challenge (current challenge or opportunity), innovation (the proposed innovation and how it works), assessment (innovation assessment), alignment (strategic alignment), technology (recommended technology and architecture), value (expected business value), roadmap (implementation roadmap, from feasibility to deployment), resources (resources and dependencies), risks (risks and mitigation), metrics (success metrics and KPIs), recommendation (recommendation and next steps).` }],
        output_config: { effort: fk.effort, format: { type: 'json_schema', schema: PROPOSAL_SCHEMA } }
      });
      const out = jsonOf(res, 'proposal');
      breaker.failures = 0; log('proposal', started, res);
      return { title: clean(out.title, 300), sections: Object.fromEntries(SECTION_KEYS.map(k => [k, clean(out.sections && out.sections[k], LIMITS.sectionChars)])), generatedAt: new Date().toISOString(), model: res.model };
    } catch (err) { throw noteFailure('proposal', err, started); }
  }

  /* Rewrite one section. */
  async function revise(body) {
    const l = lang(body.lang), key = SECTION_KEYS.includes(body.key) ? body.key : null;
    const text = clean(body.text, LIMITS.sectionChars), instruction = clean(body.instruction, LIMITS.instructionChars);
    if (!key || !instruction) throw fail('bad_request', 'Choose a section and say how to improve it.', 400);
    guard(1);
    const started = Date.now();
    try {
      const res = await call({
        model: fk.model, max_tokens: 8000, system: sys(REVISE_SYSTEM),
        messages: [{ role: 'user', content: `Language: ${LANG_NAME[l]}.\nProposal title: ${clean(body.title, 300)}\nSection: ${key}\nCurrent text:\n${text || '(empty)'}\n${checkContext(cleanCheck(body.check))}\n\nThe employee's request: ${instruction}\n\nReturn the revised section text.` }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: REVISE_SCHEMA } }
      });
      const out = jsonOf(res, 'revise');
      breaker.failures = 0; log('revise', started, res, { key });
      return { text: clean(out.text, LIMITS.sectionChars) };
    } catch (err) { throw noteFailure('revise', err, started); }
  }

  /* Submission: forwarded only to a configured review endpoint; never pretends. */
  async function submit(body) {
    if (!fk.submitUrl) return { submitted: false, reason: 'not_configured' };
    const doc = body && body.proposal && typeof body.proposal === 'object' ? body.proposal : null;
    if (!doc || !clean(doc.title, 300)) throw fail('bad_request', 'There is no proposal to submit.', 400);
    const payload = { source: 'fekra', version: 1, submittedAt: new Date().toISOString(), lang: lang(body.lang), proposal: { title: clean(doc.title, 300), sections: Object.fromEntries(SECTION_KEYS.map(k => [k, clean(doc.sections && doc.sections[k], LIMITS.sectionChars)])) }, check: cleanCheck(body.check) };
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
    enabled, chat, check, proposal, revise, submit,
    status: () => ({ enabled, webSearch: enabled && webSearchAvailable, submission: !!fk.submitUrl, model: enabled ? fk.model : null }),
    stats: () => ({ breakerOpen: Date.now() < breaker.openUntil, callsThisHour: budget.hour === Math.floor(Date.now() / 3600000) ? budget.calls : 0 }),
    _internals: { CHAT_SCHEMA, CHECK_SCHEMA, PROPOSAL_SCHEMA, cleanMessages, cleanDraft, useFallbacks }
  };
}

module.exports = { createFekra, SECTION_KEYS, STAGES, STATUSES };
