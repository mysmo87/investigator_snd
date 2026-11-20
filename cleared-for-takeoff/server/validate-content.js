'use strict';
/* Integrity checks for content.js and catalog.js. Run at server start-up
   (a broken edit fails the deploy health check instead of going live) and
   by `npm run check`. Returns a list of human-readable problems. */

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const STAGES = ['discover', 'learn', 'practice', 'innovate'];
const COSTS = ['free', 'membership', 'varies'];

function validateContent(content, catalog) {
  const errors = [];
  const err = msg => errors.push(msg);
  const ids = list => new Set(list.map(x => x.id));
  const dupes = (list, key, label) => {
    const seen = new Set();
    list.forEach(x => { if (seen.has(x[key])) err(`Duplicate ${label} ${key} "${x[key]}"`); seen.add(x[key]); });
  };

  const trackIds = ids(content.tracks), interestIds = ids(content.interests), roleIds = ids(content.roles);
  const demoIds = ids(content.demos), sessionIds = ids(content.sessions);
  ['tracks', 'interests', 'roles', 'demos', 'sessions', 'news'].forEach(k => dupes(content[k], 'id', k.slice(0, -1)));

  content.tracks.forEach(t => {
    STAGES.forEach(s => { if (!Array.isArray(t.path[s]) || t.path[s].length !== 3) err(`Track ${t.id}: path.${s} needs 3 topics (one per level)`); });
    t.interests.forEach(i => interestIds.has(i) || err(`Track ${t.id}: unknown interest ${i}`));
  });
  content.demos.forEach(d => d.tracks.forEach(t => trackIds.has(t) || err(`Demo ${d.id}: unknown track ${t}`)));
  content.sessions.forEach(s => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time || '')) err(`Session ${s.id}: time must be HH:MM`);
    if (!trackIds.has(s.track)) err(`Session ${s.id}: unknown track ${s.track}`);
    if (!demoIds.has(s.demo)) err(`Session ${s.id}: unknown demo ${s.demo}`);
    if (!(s.mins > 0)) err(`Session ${s.id}: mins must be positive`);
  });
  content.news.forEach(n => trackIds.has(n.track) || err(`News ${n.id}: unknown track ${n.track}`));
  roleIds.forEach(r => STAGES.forEach(s => (content.rules.nextSteps[r] && content.rules.nextSteps[r][s]) || err(`rules.nextSteps.${r}.${s} is missing`)));
  STAGES.forEach(s => ['demo', 'session'].includes(content.rules.stageExperience[s]) || err(`rules.stageExperience.${s} must be demo or session`));

  const courses = catalog.courses || [];
  if (!courses.length) err('Catalogue has no courses');
  dupes(courses, 'id', 'course'); dupes(courses, 'ref', 'course');
  courses.forEach(c => {
    const where = `Course ${c.id}`;
    if (!/^[a-z0-9-]+$/.test(c.id || '')) err(`${where}: id must be lowercase letters, digits and dashes`);
    if (!/^c\d+$/.test(c.ref || '')) err(`${where}: ref must look like c12`);
    ['title', 'provider', 'format', 'summary'].forEach(k => (typeof c[k] === 'string' && c[k].trim()) || err(`${where}: ${k} is required`));
    try { if (new URL(c.url).protocol !== 'https:') err(`${where}: url must use https`); } catch { err(`${where}: url is not valid`); }
    if (!LEVELS.includes(c.level)) err(`${where}: level must be one of ${LEVELS.join(', ')}`);
    if (!COSTS.includes(c.cost)) err(`${where}: cost must be one of ${COSTS.join(', ')}`);
    if (!(c.hours > 0)) err(`${where}: hours must be positive`);
    if (!c.tracks || !c.tracks.length) err(`${where}: needs at least one track`);
    (c.tracks || []).forEach(t => trackIds.has(t) || err(`${where}: unknown track ${t}`));
    (c.interests || []).forEach(i => interestIds.has(i) || err(`${where}: unknown interest ${i}`));
    if (!c.stages || !c.stages.length) err(`${where}: needs at least one stage`);
    (c.stages || []).forEach(s => STAGES.includes(s) || err(`${where}: unknown stage ${s}`));
  });
  // every track needs a course at or next to every level, or some visitors would get no course
  content.tracks.forEach(t => LEVELS.forEach((l, i) => {
    const near = courses.some(c => c.tracks.includes(t.id) && Math.abs(LEVELS.indexOf(c.level) - i) <= 1);
    if (!near) err(`Track ${t.id} has no course at or next to the ${l} level`);
  }));
  return errors;
}

module.exports = { validateContent };
