'use strict';
/* Claude-powered course recommender.

   - One Messages API call per visitor profile, returning JSON that is
     constrained by a JSON schema (structured outputs). Course, track, demo
     and session ids are enums, so Claude can only pick catalogue items.
   - The catalogue lives in a cached system prompt (prompt caching), so
     repeat requests only pay for the short visitor profile.
   - Only enum values are sent (role, experience, interests, session
     status). No names, emails or photos ever reach this server.
   - Every result is re-validated with the shared rules (sanitizePlan) and
     any failure — timeout, refusal, rate limit, invalid output — falls back
     to the deterministic rules, so the kiosk always gets a journey. */

const Anthropic = require('@anthropic-ai/sdk').default;

const SESSION_STATUSES = ['live', 'upcoming', 'done'];
const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/; // models that accept fallbacks: "default"

function buildSystemPrompt(content, catalog) {
  const compact = {
    learningTracks: content.tracks.map(t => ({ id: t.id, title: t.title, audienceLevel: t.level, description: t.desc, stageTopics: t.path })),
    levels: content.experience.map(e => ({ id: e.id, label: e.label, passportLevel: content.levels[e.level] })),
    interests: content.interests.map(i => ({ id: i.id, label: i.label })),
    roles: content.roles.map(r => ({ id: r.id, label: r.label })),
    courses: catalog.courses.map(c => ({ id: c.id, title: c.title, provider: c.provider, level: c.level, format: c.format, approxHours: c.hours, tracks: c.tracks, interests: c.interests, stages: c.stages, summary: c.summary })),
    boothDemos: content.demos.filter(d => d.id !== 'radar').map(d => ({ id: d.id, title: d.title, zone: d.zone, tracks: d.tracks, tags: d.tags, overview: d.overview })),
    boothSessions: content.sessions.map(s => ({ id: s.id, title: s.title, type: s.type, track: s.track, tags: s.tags, description: s.desc }))
  };
  return [
    `You are the learning-journey recommender for "${content.meta.product}", an interactive kiosk at the GDRFA (General Directorate of Residency and Foreigners Affairs, Dubai) booth at ${content.meta.event}.`,
    'Each visitor answers three questions — role, experience with AI, and interests — and you turn the answers into a four-stage journey: discover, learn, practice, innovate. You may only use the learning tracks, courses, booth demos and booth sessions in the reference data below.',
    '',
    'How to choose:',
    '- primaryTrack is the learning track that best fits the visitor\'s interests and role. secondaryTrack is the next-best, different track; treat it as a stretch.',
    '- For each stage, pick one or two courses (courseIds). Match the visitor\'s level: beginners get beginner courses, with at most an intermediate course as a stretch in practice or innovate; intermediate visitors get intermediate courses, with beginner refreshers only in discover and advanced courses only in innovate; advanced visitors get advanced and intermediate courses. Never choose a course two levels away from the visitor. Prefer courses whose stages include the current stage, whose tracks include the primary track and whose interests overlap the visitor\'s. Do not repeat a course across stages, and vary providers when the fit is equally good.',
    '- experienceId: for discover and practice suggest a booth demo; for learn and innovate suggest a booth session. Choose sessions that are live or upcoming according to the visitor message, never completed ones, and do not repeat a demo or session.',
    '- topic is a short headline for the stage (under ten words). why is one sentence telling the visitor why these courses suit them. nextStep is one concrete action they can take within 30 days that fits their role. summary is one or two sentences addressed to the visitor as "you".',
    '- Write plain, warm, professional English. Describe courses only with what the reference data says. Do not mention prices, and do not suggest that GDRFA runs or endorses the external courses.',
    '',
    'Reference data (JSON):',
    JSON.stringify(compact)
  ].join('\n');
}

function buildSchema(content, catalog) {
  const str = { type: 'string' };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['primaryTrack', 'secondaryTrack', 'summary', 'stages'],
    properties: {
      primaryTrack: { type: 'string', enum: content.tracks.map(t => t.id) },
      secondaryTrack: { type: 'string', enum: content.tracks.map(t => t.id) },
      summary: str,
      stages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['stage', 'topic', 'courseIds', 'why', 'nextStep', 'experienceId'],
          properties: {
            stage: { type: 'string', enum: ['discover', 'learn', 'practice', 'innovate'] },
            topic: str,
            courseIds: { type: 'array', items: { type: 'string', enum: catalog.courses.map(c => c.id) } },
            why: str,
            nextStep: str,
            experienceId: { type: 'string', enum: [...content.demos.filter(d => d.id !== 'radar').map(d => d.id), ...content.sessions.map(s => s.id)] }
          }
        }
      }
    }
  };
}

function buildUserMessage(profile, sessions, content) {
  const label = (list, id) => (list.find(x => x.id === id) || {}).label || id;
  const visitor = {
    role: { id: profile.role, label: label(content.roles, profile.role) },
    experience: { id: profile.experience, label: label(content.experience, profile.experience) },
    interests: profile.interests.map(id => ({ id, label: label(content.interests, id) }))
  };
  if (profile.focusTrack) visitor.startedFromTrack = profile.focusTrack;
  const sessionStatus = {};
  sessions.forEach(s => { sessionStatus[s.id] = s.status; });
  return `Visitor answers (JSON): ${JSON.stringify(visitor)}\nBooth session status right now (JSON): ${JSON.stringify(sessionStatus)}\nCreate this visitor's journey.`;
}

/* Normalise the session status list sent by the kiosk (enum-only). */
function normaliseSessions(input, content) {
  const out = [];
  if (Array.isArray(input)) {
    for (const s of input) {
      if (!s || typeof s !== 'object') continue;
      const id = String(s.id || ''), status = String(s.status || '');
      if (content.sessions.some(x => x.id === id) && SESSION_STATUSES.includes(status) && !out.some(x => x.id === id)) out.push({ id, status });
    }
  }
  // sessions the kiosk did not report are treated as upcoming
  content.sessions.forEach(s => { if (!out.some(x => x.id === s.id)) out.push({ id: s.id, status: 'upcoming' }); });
  return out;
}

class LruCache {
  constructor(max, ttlMs) { this.max = max; this.ttlMs = ttlMs; this.map = new Map(); }
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.exp) { this.map.delete(key); return undefined; }
    this.map.delete(key); this.map.set(key, hit);
    return hit.value;
  }
  set(key, value) {
    if (!this.max || !this.ttlMs) return;
    this.map.delete(key);
    this.map.set(key, { value, exp: Date.now() + this.ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
  get size() { return this.map.size; }
}

function createRecommender({ config, content, catalog, rules, logger, client }) {
  const ai = config.ai;
  const anthropic = ai.enabled ? (client || new Anthropic()) : null;
  const system = [{ type: 'text', text: buildSystemPrompt(content, catalog), cache_control: { type: 'ephemeral' } }];
  const schema = buildSchema(content, catalog);
  const useFallbacks = ai.fallbacks === 'default' && FALLBACK_MODELS.test(ai.model);
  const cache = new LruCache(ai.cacheMax, ai.cacheTtlMs);
  const inflight = new Map();
  // Circuit breaker: after repeated failures, skip the API briefly so visitors are not kept waiting.
  const breaker = { failures: 0, openUntil: 0 };
  // Spend guard: cap Claude calls per clock hour (cache hits are free and not counted).
  const budget = { hour: -1, calls: 0 };
  const takeBudget = () => {
    const h = Math.floor(Date.now() / 3600000);
    if (h !== budget.hour) { budget.hour = h; budget.calls = 0; }
    if (budget.calls >= ai.maxCallsPerHour) return false;
    budget.calls += 1; return true;
  };

  async function callClaude(profile, sessions) {
    const params = {
      model: ai.model,
      max_tokens: ai.maxTokens,
      system,
      messages: [{ role: 'user', content: buildUserMessage(profile, sessions, content) }],
      output_config: { effort: ai.effort, format: { type: 'json_schema', schema } }
    };
    const opts = { timeout: ai.timeoutMs, maxRetries: 1 };
    const res = useFallbacks
      ? await anthropic.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, opts)
      : await anthropic.messages.create(params, opts);
    if (res.stop_reason === 'refusal') {
      const err = new Error('Claude declined the request');
      err.reason = 'refusal';
      throw err;
    }
    if (res.stop_reason === 'max_tokens') {
      const err = new Error('Response hit max_tokens');
      err.reason = 'max_tokens';
      throw err;
    }
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      const err = new Error('Response was not valid JSON');
      err.reason = 'invalid_json';
      throw err;
    }
    return { parsed, model: res.model, usage: res.usage };
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

  /* Returns { plan, source: 'ai' | 'rules', model?, cached?, reason? } — never throws for API failures. */
  async function recommend(profile, rawSessions) {
    const sessions = normaliseSessions(rawSessions, content);
    const ctx = { content, catalog, sessions };
    const rulesResult = (reason) => ({ plan: rules.buildRulesPlan(profile, ctx), source: 'rules', reason });

    if (!anthropic) return rulesResult(ai.apiKeySet ? 'ai_disabled' : 'no_api_key');
    if (Date.now() < breaker.openUntil) return rulesResult('circuit_open');

    const key = JSON.stringify([profile.role, profile.experience, [...profile.interests].sort(), profile.focusTrack || '', sessions.filter(s => s.status !== 'done').map(s => s.id).sort()]);
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
    if (inflight.has(key)) return inflight.get(key);
    if (!takeBudget()) { logger.warn('recommendation_fallback', { reason: 'hourly_budget' }); return rulesResult('hourly_budget'); }

    const started = Date.now();
    const task = (async () => {
      try {
        const { parsed, model, usage } = await callClaude(profile, sessions);
        const { plan, repairs } = rules.sanitizePlan(parsed, profile, ctx);
        breaker.failures = 0;
        const result = { plan, source: 'ai', model };
        cache.set(key, result);
        logger.info('recommendation', {
          source: 'ai', model, latencyMs: Date.now() - started, repairs,
          inputTokens: usage && usage.input_tokens, outputTokens: usage && usage.output_tokens,
          cacheReadTokens: usage && usage.cache_read_input_tokens, cacheWriteTokens: usage && usage.cache_creation_input_tokens
        });
        return result;
      } catch (err) {
        const reason = classify(err);
        breaker.failures += 1;
        if (breaker.failures >= 3) { breaker.openUntil = Date.now() + 60000; breaker.failures = 0; }
        const level = ['auth', 'permission', 'model_not_found', 'bad_request'].includes(reason) ? 'error' : 'warn';
        logger[level]('recommendation_fallback', { reason, latencyMs: Date.now() - started, status: err && err.status, detail: err && err.message ? String(err.message).slice(0, 300) : undefined });
        return rulesResult(reason);
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, task);
    return task;
  }

  return { recommend, normaliseSessions: s => normaliseSessions(s, content), stats: () => ({ cacheEntries: cache.size, breakerOpen: Date.now() < breaker.openUntil, callsThisHour: budget.hour === Math.floor(Date.now() / 3600000) ? budget.calls : 0 }), _internals: { system, schema, useFallbacks } };
}

module.exports = { createRecommender, buildSystemPrompt, buildSchema, buildUserMessage, normaliseSessions };
