/* Builds the Arabic view of the booth content and course catalogue (browser and server).
   content-ar.js holds only text, keyed by the same ids as content.js; ids, links, levels, tags, keywords and rules
   are always taken from the English content, and anything without a translation stays in English. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CFT_LOCALIZE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LISTS = ['roles', 'experience', 'interests', 'tracks', 'demos', 'sessions', 'news', 'newsCats', 'avatars'];
  const TEXT_ONLY = new Set(['id', 'keywords', 'tags', 'tracks', 'interests', 'icon', 'colors', 'zone', 'track', 'demo', 'level', 'type', 'cat', 'live', 'featured', 'days', 'mins', 'seats', 'time', 'questions', 'x', 'y', 'w', 'h']);
  /* copy the translated fields onto each item, never the fields that drive behaviour */
  const merge = (list, tr) => (list || []).map(x => {
    const t = tr && tr[x.id]; if (!t) return x;
    const out = { ...x };
    Object.keys(t).forEach(k => { if (!TEXT_ONLY.has(k)) out[k] = t[k]; });
    return out;
  });
  function localizeContent(base, ar) {
    if (!ar) return base;
    const out = { ...base };
    out.meta = { ...base.meta, ...(ar.meta && ar.meta.product ? { product: ar.meta.product } : {}), ...(ar.meta && ar.meta.event ? { event: ar.meta.event } : {}) };
    const b = ar.booth || {};
    out.booth = { ...base.booth, name: b.name || base.booth.name, event: b.event || base.booth.event, zones: merge(base.booth.zones, b.zones) };
    LISTS.forEach(k => { out[k] = merge(base[k], ar[k]); });
    if (Array.isArray(ar.levels) && ar.levels.length === base.levels.length) out.levels = ar.levels.slice();
    if (Array.isArray(ar.askTopics)) out.askTopics = base.askTopics.map((t, i) => (ar.askTopics[i] ? { ...t, title: ar.askTopics[i] } : t));
    const ns = ar.rules && ar.rules.nextSteps;
    out.rules = { ...base.rules, nextSteps: ns ? Object.fromEntries(Object.keys(base.rules.nextSteps).map(r => [r, { ...base.rules.nextSteps[r], ...(ns[r] || {}) }])) : base.rules.nextSteps };
    return out;
  }
  function localizeCatalog(base, ar) {
    if (!ar || !ar.courses) return base;
    return { ...base, courses: base.courses.map(c => (ar.courses[c.id] ? { ...c, summary: ar.courses[c.id] } : c)) };
  }
  return { localizeContent, localizeCatalog };
});
