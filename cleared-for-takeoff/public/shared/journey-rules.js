/* =====================================================================
   CLEARED FOR TAKEOFF — JOURNEY RULES (shared by browser and server)
   - buildRulesPlan(): deterministic recommendations, used offline and as
     the fallback whenever the AI recommender is unavailable.
   - sanitizePlan(): validates any plan (e.g. one produced by Claude)
     against the catalogue and repairs gaps with the rules, so the kiosk
     never shows a course, demo or session that does not exist.
   A plan never contains personal data: only track/course/demo/session ids
   and short texts.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CFT_RULES = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STAGES = ['discover', 'learn', 'practice', 'innovate'];
  const LEVELS = ['beginner', 'intermediate', 'advanced'];
  const LIMITS = { topic: 90, why: 240, nextStep: 240, summary: 420 };
  const ROLE_SENTENCE = { gov: 'government employee', tech: 'technology professional', student: 'student', leader: 'business leader', other: 'curious visitor' };

  /* Optional steering (Learning Flight Map): limits the visitor can set. */
  const TIME_LIMITS = { any: Infinity, medium: 10, short: 2 };   // max hours per course
  const HANDS_ON = /hands-on|lab|project|notebook|exercise/i;      // course formats that count as hands-on
  const byId = (list, id) => list.find(x => x.id === id);
  const clip = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const listText = arr => arr.length > 1 ? arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1] : (arr[0] || '');

  function levelIndex(content, experienceId) {
    const e = byId(content.experience, experienceId);
    return e ? e.level : 0;
  }

  /* ---------- input validation (enum-only profile) ---------- */
  function validateProfile(input, content) {
    if (!input || typeof input !== 'object') return { error: 'Profile must be an object.' };
    const role = String(input.role || '');
    const experience = String(input.experience || '');
    if (!byId(content.roles, role)) return { error: 'Unknown role.' };
    if (!byId(content.experience, experience)) return { error: 'Unknown experience level.' };
    if (!Array.isArray(input.interests) || !input.interests.length) return { error: 'Choose at least one interest.' };
    const interests = [];
    for (const raw of input.interests) {
      const id = String(raw);
      if (!byId(content.interests, id)) return { error: 'Unknown interest.' };
      if (!interests.includes(id)) interests.push(id);
    }
    if (interests.length > content.interests.length) return { error: 'Too many interests.' };
    const profile = { role, experience, interests };
    if (input.focusTrack != null && input.focusTrack !== '') {
      if (!byId(content.tracks, String(input.focusTrack))) return { error: 'Unknown track.' };
      profile.focusTrack = String(input.focusTrack);
    }
    return { profile };
  }

  /* ---------- track scoring ---------- */
  function rankTracks(profile, content) {
    const R = content.rules, scores = {};
    content.tracks.forEach(t => { scores[t.id] = 0; });
    profile.interests.forEach(i => Object.entries(R.interestToTrack[i] || {}).forEach(([t, v]) => { scores[t] += v; }));
    Object.entries(R.roleBoost[profile.role] || {}).forEach(([t, v]) => { scores[t] += v; });
    if (profile.focusTrack) scores[profile.focusTrack] += 4;
    return content.tracks.map((t, i) => ({ t, s: scores[t.id], i })).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.t);
  }

  /* ---------- course scoring ---------- */
  function levelFit(course, lvl, stage) {
    const d = LEVELS.indexOf(course.level) - lvl;
    if (d === 0) return 3;
    if (Math.abs(d) > 1) return -8;
    if (stage === 'discover') return d < 0 ? 2 : -1;      // discover can step down
    if (stage === 'innovate') return d > 0 ? 2 : -1;      // innovate can stretch up
    return -1;
  }
  function courseAllowed(course, lvl) { return Math.abs(LEVELS.indexOf(course.level) - lvl) <= 1; }
  function meetsConstraints(course, k) {
    if (!k) return true;
    if (k.freeOnly && course.cost !== 'free') return false;
    return course.hours <= (TIME_LIMITS[k.time] || Infinity);
  }

  function rankCourses(stage, profile, lvl, primary, secondary, catalog, used, options) {
    const handsOn = !!(options && options.constraints && options.constraints.handsOn);
    return catalog.courses
      .map((c, i) => {
        let s = (c.stages.includes(stage) ? 4 : 0) + levelFit(c, lvl, stage);
        if (handsOn && HANDS_ON.test(c.format)) s += 3;
        s += c.tracks.includes(primary.id) ? 4 : c.tracks.includes(secondary.id) ? 1 : 0;
        s += c.interests.filter(x => profile.interests.includes(x)).length * 2;
        if (used.has(c.id)) s -= 20;
        return { c, i, s };
      })
      .filter(x => x.s > 0 && courseAllowed(x.c, lvl))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map(x => x.c);
  }

  /* ---------- demo / session suggestion ---------- */
  function rankExperiences(kind, profile, primary, ctx, used) {
    if (kind === 'demo') {
      return ctx.content.demos.filter(d => d.id !== 'radar')
        .map((d, i) => ({ id: d.id, i, s: d.tags.filter(x => profile.interests.includes(x)).length * 2 + (d.tracks.includes(primary.id) ? 3 : 0) + (d.tracks[0] === primary.id ? 1 : 0) - (used.has(d.id) ? 20 : 0) }))
        .sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.id);
    }
    const status = id => ((ctx.sessions || []).find(s => s.id === id) || {}).status || 'upcoming';
    return ctx.content.sessions
      .map((s, i) => ({ id: s.id, i, s: s.tags.filter(x => profile.interests.includes(x)).length * 2 + (s.track === primary.id ? 3 : 0) + (status(s.id) === 'done' ? -5 : 0) + (status(s.id) === 'live' ? 1 : 0) - (used.has(s.id) ? 20 : 0) }))
      // completed sessions only as a last resort
      .sort((a, b) => (status(a.id) === 'done') - (status(b.id) === 'done') || b.s - a.s || a.i - b.i).map(x => x.id);
  }

  function experienceTitle(ctx, id) {
    const d = byId(ctx.content.demos, id) || byId(ctx.content.sessions, id);
    return d ? d.title : '';
  }

  /* ---------- deterministic plan ----------
     options (optional): { constraints: { time: 'any'|'medium'|'short', freeOnly, handsOn }, pinned: [courseId] }
     Pinned courses are placed first in the earliest stage they fit. If no course in a stage meets
     the constraints, the time limit and then all limits are relaxed for that stage (stage.relaxed). */
  function buildRulesPlan(profile, ctx, options) {
    const { content, catalog } = ctx, R = content.rules;
    const lvl = levelIndex(content, profile.experience);
    const ranked = rankTracks(profile, content), primary = ranked[0], secondary = ranked[1];
    const usedC = new Set(), usedE = new Set();
    const interestLabels = profile.interests.map(i => byId(content.interests, i).label);
    const k = options && options.constraints ? { ...options.constraints, time: TIME_LIMITS[options.constraints.time] ? options.constraints.time : 'any' } : null;
    const pinStage = {};
    STAGES.forEach(s => { pinStage[s] = []; });
    ((options && options.pinned) || []).map(id => byId(catalog.courses, id)).filter(Boolean).forEach(c => {
      const st = STAGES.find(s => c.stages.includes(s) && pinStage[s].length < 2) || STAGES.find(s => pinStage[s].length < 2);
      if (st) { pinStage[st].push(c); usedC.add(c.id); }
    });
    const stages = STAGES.map(stage => {
      const rankedCourses = rankCourses(stage, profile, lvl, primary, secondary, catalog, usedC, options);
      let pool = rankedCourses.filter(c => meetsConstraints(c, k)), relaxed = null;
      if (k && !pool.length && !pinStage[stage].length) {
        pool = rankedCourses.filter(c => meetsConstraints(c, { ...k, time: 'any' })); relaxed = 'time';
        if (!pool.length) { pool = rankedCourses; relaxed = 'all'; }
      }
      const courses = [...pinStage[stage], ...pool].slice(0, 2);
      courses.forEach(c => usedC.add(c.id));
      const expId = rankExperiences(R.stageExperience[stage], profile, primary, ctx, usedE)[0];
      usedE.add(expId);
      const tpl = (R.nextSteps[profile.role] || R.nextSteps.other)[stage];
      const nextStep = tpl.replace('{demo}', experienceTitle(ctx, expId)).replace('{session}', experienceTitle(ctx, expId))
        .replace('{course}', courses[0] ? courses[0].title : 'recommended course').replace('{track}', primary.title);
      const matched = profile.interests.filter(i => courses.some(c => c.interests.includes(i))).map(i => byId(content.interests, i).label);
      return {
        stage,
        topic: primary.path[stage][lvl],
        courseIds: courses.map(c => c.id),
        why: `Chosen for your ${content.levels[lvl]} level in ${primary.title}${matched.length ? ` and your interest in ${listText(matched.slice(0, 2))}` : ''}.`,
        nextStep,
        experienceId: expId,
        pinned: pinStage[stage].map(c => c.id),
        relaxed
      };
    });
    return {
      primaryTrack: primary.id,
      secondaryTrack: secondary.id,
      summary: `As a ${ROLE_SENTENCE[profile.role]} with ${byId(content.experience, profile.experience).label.toLowerCase()} AI experience, interested in ${listText(interestLabels)}, your journey centres on ${primary.title} — with ${secondary.title} as your stretch track.`,
      stages
    };
  }

  /* ---------- validation + repair of any plan (AI output) ---------- */
  function sanitizePlan(raw, profile, ctx) {
    const { content, catalog } = ctx;
    const lvl = levelIndex(content, profile.experience);
    const rules = buildRulesPlan(profile, ctx);
    let repairs = 0;
    const plan = raw && typeof raw === 'object' ? raw : {};
    const trackOk = id => !!byId(content.tracks, id);
    const primaryTrack = trackOk(plan.primaryTrack) ? plan.primaryTrack : (repairs++, rules.primaryTrack);
    let secondaryTrack = trackOk(plan.secondaryTrack) && plan.secondaryTrack !== primaryTrack ? plan.secondaryTrack : (repairs++, rules.secondaryTrack);
    if (secondaryTrack === primaryTrack) secondaryTrack = content.tracks.find(t => t.id !== primaryTrack).id;
    const primary = byId(content.tracks, primaryTrack), secondary = byId(content.tracks, secondaryTrack);
    const inStages = Array.isArray(plan.stages) ? plan.stages : [];
    const usedC = new Set(), usedE = new Set();
    const sessionDone = id => ((ctx.sessions || []).find(s => s.id === id) || {}).status === 'done';
    const validExp = (id, kind) => kind === 'demo' ? !!byId(content.demos, id) && id !== 'radar' : !!byId(content.sessions, id) && !sessionDone(id);
    const stages = STAGES.map((stage, si) => {
      const s = inStages.find(x => x && x.stage === stage) || {};
      if (!inStages.find(x => x && x.stage === stage)) repairs++;
      let courseIds = (Array.isArray(s.courseIds) ? s.courseIds : []).map(String)
        .filter(id => { const c = byId(catalog.courses, id); return c && courseAllowed(c, lvl) && !usedC.has(id); });
      courseIds = Array.from(new Set(courseIds)).slice(0, 2);
      if (!courseIds.length) {
        repairs++;
        const alt = rankCourses(stage, profile, lvl, primary, secondary, catalog, usedC)[0];
        if (alt) courseIds = [alt.id];
      }
      courseIds.forEach(id => usedC.add(id));
      const kind = content.rules.stageExperience[stage];
      let experienceId = String(s.experienceId || '');
      if (!validExp(experienceId, kind) || usedE.has(experienceId)) {
        // accept the other kind too (a session in a "demo" stage is fine) — only reject unknown ids
        const otherKindOk = (byId(content.demos, experienceId) && experienceId !== 'radar') || (byId(content.sessions, experienceId) && !sessionDone(experienceId));
        if (!otherKindOk || usedE.has(experienceId)) {
          repairs++;
          experienceId = rankExperiences(kind, profile, primary, ctx, usedE)[0];
        }
      }
      usedE.add(experienceId);
      const fallback = rules.stages[si];
      const text = (v, k) => { const t = clip(v, LIMITS[k]); if (!t) repairs++; return t || fallback[k]; };
      return { stage, topic: text(s.topic, 'topic'), courseIds, why: text(s.why, 'why'), nextStep: text(s.nextStep, 'nextStep'), experienceId };
    });
    const summary = clip(plan.summary, LIMITS.summary) || (repairs++, rules.summary);
    return { plan: { primaryTrack, secondaryTrack, summary, stages }, repairs };
  }

  return { STAGES, LEVELS, LIMITS, TIME_LIMITS, HANDS_ON, validateProfile, rankTracks, buildRulesPlan, sanitizePlan, levelIndex, courseAllowed, meetsConstraints };
});
