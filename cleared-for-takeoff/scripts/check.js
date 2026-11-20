'use strict';
/* `npm run check` — validates content and catalogue, and confirms the
   offline rules produce a complete journey for every possible visitor. */
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const rules = require('../public/shared/journey-rules.js');
const { validateContent } = require('../server/validate-content');

const errors = validateContent(content, catalog);
const interests = content.interests.map(i => i.id);
let profiles = 0;
for (const role of content.roles.map(r => r.id)) {
  for (const experience of content.experience.map(e => e.id)) {
    for (let mask = 1; mask < 1 << interests.length; mask++) {
      const profile = { role, experience, interests: interests.filter((_, k) => mask >> k & 1) };
      const plan = rules.buildRulesPlan(profile, { content, catalog, sessions: [] });
      profiles++;
      plan.stages.forEach(s => { if (!s.courseIds.length) errors.push(`No course for ${JSON.stringify(profile)} at ${s.stage}`); });
    }
  }
}
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n- ` + [...new Set(errors)].slice(0, 50).join('\n- '));
  process.exit(1);
}
console.log(`✓ content OK — ${catalog.courses.length} courses, ${content.tracks.length} tracks, ${profiles} visitor profiles all get a complete journey (catalogue reviewed ${catalog.reviewedOn})`);
