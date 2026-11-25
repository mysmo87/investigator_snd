'use strict';
/* Anonymous interaction log, so GDRFA can count visitors even after passports are deleted.

   - Append-only JSON Lines file (interactions.jsonl) in INTERACTIONS_DIR, or DATA_DIR/interactions.
   - No personal data: never a name, email, organization, photo, passport number or IP address.
     Each event is a type, a time, and only the whitelisted, validated fields below.
   - Records are never deleted by the app (they hold nothing personal), so totals survive a visitor
     deleting their passport and the 180-day passport purge. */

const fs = require('fs');
const path = require('path');

const FILE = 'interactions.jsonl';

/* type -> which fields it may carry; values are validated against the booth content */
function schema(content) {
  const ids = list => new Set((list || []).map(x => x.id));
  const roles = ids(content.roles), exps = ids(content.experience), tracks = ids(content.tracks), sessions = ids(content.sessions);
  const levels = new Set(content.levels || []);
  const one = set => v => (set.has(v) ? v : undefined);
  const pick = allowed => v => (allowed.includes(v) ? v : undefined);
  return {
    journey_generated: { role: one(roles), experience: one(exps), track: one(tracks), secondTrack: one(tracks), level: one(levels), source: pick(['ai', 'rules']) },
    passport_created: { track: one(tracks), level: one(levels), avatar: pick(['preset', 'photo', 'ai']), source: pick(['ai', 'rules']) },
    passport_deleted: {},
    avatar_ai_created: {},
    big_screen_shown: {},
    session_attended: { session: one(sessions) },
    fekra_proposal_saved: {}
  };
}
const CLIENT_TYPES = ['journey_generated', 'big_screen_shown', 'session_attended']; // the rest are recorded by the server itself

const LABELS = {
  journey_generated: 'Learning journeys created',
  passport_created: 'Passports created',
  passport_deleted: 'Passports deleted by visitors',
  avatar_ai_created: 'AI 3D avatars created',
  big_screen_shown: 'Shown on the big screen',
  session_attended: 'Sessions marked as attended',
  fekra_proposal_saved: 'Fekra proposals saved'
};

function createInteractionLog({ dir, persistent = false, content, timezone = 'Asia/Dubai', logger, now = () => new Date() }) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, FILE);
  const types = schema(content);
  let queue = Promise.resolve(); // appends are serialised so lines never interleave

  function clean(type, props = {}) {
    const fields = types[type];
    if (!fields) return null;
    const out = { at: now().toISOString(), type };
    for (const [k, check] of Object.entries(fields)) {
      const v = check(props[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  /* fire-and-forget: a logging problem must never break the visitor's flow */
  function record(type, props) {
    const ev = clean(type, props);
    if (!ev) return false;
    queue = queue.then(() => fs.promises.appendFile(file, JSON.stringify(ev) + '\n'))
      .catch(err => logger && logger.warn('interaction_log_failed', { detail: String(err.message).slice(0, 200) }));
    return true;
  }

  async function list() {
    await queue;
    let text = '';
    try { text = await fs.promises.readFile(file, 'utf8'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    const out = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      try { const ev = JSON.parse(line); if (ev && types[ev.type]) out.push(ev); } catch { /* skip a damaged line */ }
    }
    return out;
  }

  const dayOf = iso => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

  async function summary() {
    const events = await list(), today = dayOf(now().toISOString());
    const totals = {}, todayTotals = {}, byDay = {};
    const tally = (obj, k) => { if (k) obj[k] = (obj[k] || 0) + 1; };
    const journeys = { byTrack: {}, byLevel: {}, byRole: {}, bySource: {} }, passports = { byAvatar: {} };
    const title = (list, id) => { const x = (list || []).find(t => t.id === id); return x ? (x.title || x.label) : id; };
    for (const ev of events) {
      const d = dayOf(ev.at);
      tally(totals, ev.type);
      if (d === today) tally(todayTotals, ev.type);
      byDay[d] = byDay[d] || {}; tally(byDay[d], ev.type);
      if (ev.type === 'journey_generated') {
        tally(journeys.byTrack, ev.track && title(content.tracks, ev.track));
        tally(journeys.byLevel, ev.level);
        tally(journeys.byRole, ev.role && title(content.roles, ev.role));
        tally(journeys.bySource, ev.source === 'ai' ? 'AI' : ev.source === 'rules' ? 'Booth rules' : null);
      }
      if (ev.type === 'passport_created') tally(passports.byAvatar, { preset: 'Preset avatar', photo: 'Photo', ai: 'AI 3D Traveler' }[ev.avatar]);
    }
    const j = totals.journey_generated || 0, p = totals.passport_created || 0;
    return {
      timezone, today, total: events.length, labels: LABELS,
      totals, todayTotals, conversion: j ? Math.round(Math.min(p, j) / j * 100) : null,
      journeys, passports,
      byDay: Object.keys(byDay).sort().reverse().map(date => ({ date, ...byDay[date] }))
    };
  }

  return {
    record, list, summary,
    acceptsFromClient: type => CLIENT_TYPES.includes(type),
    status: () => ({ available: true, persistent })
  };
}

module.exports = { createInteractionLog, LABELS };
