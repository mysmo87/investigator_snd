
'use strict';
/* =====================================================================
   CLEARED FOR TAKEOFF — KIOSK APP
   Content, course catalogue and journey rules are loaded from
   data/content.js, data/catalog.js and shared/journey-rules.js.
   ===================================================================== */
const DATA = window.CFT_CONTENT;
const CATALOG = window.CFT_CATALOG;
const RULES = window.CFT_RULES;
/* Runtime settings. Defaults keep the kiosk working when the page is opened
   from disk; when served by the API server they are replaced by GET /api/config. */
/* Original (dark-ink) logo for white backgrounds — the passport card draws it on a white plate. */
const ORG_LOGO = Object.assign(new Image(), { src: 'assets/gdrfa-logo.png' });
const CONFIG = {
  served: /^https?:$/.test(location.protocol),
  aiEnabled: false, aiTimeoutMs: 20000, publicBaseUrl: null,
  scheduleMode: 'relative', eventTimezone: 'Asia/Dubai',
  idleWarnSeconds: 75, idleResetSeconds: 90
};

/* =====================================================================
   UTILITIES
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (list, id) => list.find(x => x.id === id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmtTime = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CONFIG.eventTimezone || undefined });
const zone = id => byId(DATA.booth.zones, id) || { label: id, short: id };
const getTrack = id => byId(DATA.tracks, id);
const getDemo = id => byId(DATA.demos, id);
const getSession = id => byId(DATA.sessions, id);
const getNews = id => byId(DATA.news, id);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
const cleanText = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/>',
  demos: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M10 8.5v5l4-2.5z"/>',
  tracks: '<path d="M2 8.5l10-5 10 5-10 5z"/><path d="M6 10.5v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 8.5v5"/>',
  sessions: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="2"/>',
  ask: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
  journey: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r="1.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-5.5z"/><path d="M11.5 14.5L20 4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/><path d="M4 4l16 16" opacity=".7"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.8"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="9" r="2.5"/><path d="M8 14c1-1.6 2.4-2.3 4-2.3s3 .7 4 2.3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20.5h.01M17.5 20.5H21v-3.5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  agent: '<rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 3v4M9.5 12h.01M14.5 12h.01M9.5 15h5"/><path d="M2 11.5v3M22 11.5v3"/>',
  gov: '<path d="M3 21h18M5 21V10.5M19 21V10.5M9.5 21V10.5M14.5 21V10.5"/><path d="M2 10.5L12 4l10 6.5z"/>',
  cx: '<path d="M20 15a4 4 0 0 1-4 4H8l-4 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4z"/><path d="M9 11.5c1.5 2 4.5 2 6 0"/>',
  data: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 15l-3-3c1-4 5-9 13-9 0 8-5 12-9 13z"/><circle cx="15" cy="9" r="1.6"/>',
  automation: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  passport: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  analytics: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/><circle cx="19" cy="8" r="1"/>',
  knowledge: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 8h6M9 12h4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  live: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  lab: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5"/>'
};
const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
function hydrateIcons(root) { $$('[data-icon]', root).forEach(n => { if (!n.querySelector('svg')) n.insertAdjacentHTML('afterbegin', ic(n.dataset.icon)); }); }
const sample = (flag, text) => flag ? `<span class="demo-label">${text}</span>` : '';
const DEMO_SHORT = { knowledge: 'Knowledge Assistant', border: 'Border Experience', automation: 'Service Automation', radar: 'Cleared for Takeoff', studio: 'Innovation Studio', analytics: 'Gov Analytics' };
const CAT_LABEL = { agentic: 'Agentic AI', gov: 'Government AI', research: 'Research', emerging: 'Emerging Tech', events: 'Events' };
const CAT_COLORS = { agentic: ['#1d6dff', '#46d2ff'], gov: ['#0f8a8a', '#46d2ff'], research: ['#5b3dff', '#46d2ff'], emerging: ['#b8862b', '#f4d88f'], events: ['#c2417a', '#7a4dff'] };

/* Decorative SVG art for cards (unique gradient ids per instance). */
let artSeq = 0;
function artSVG(colors, variant = 0, cls = '') {
  const [a, b] = colors; const id = 'ag' + (++artSeq); const r = rng(variant * 977 + 13);
  let p = '';
  switch (variant % 6) {
    case 0: for (let i = 1; i <= 6; i++) p += `<circle cx="330" cy="40" r="${i * 26}" fill="none" stroke="${b}" stroke-opacity="${.5 - i * .06}"/>`; break;
    case 1: for (let i = 0; i < 14; i++) p += `<path d="M${i * 34 - 60} 160 L${200 + (i - 7) * 8} 20" stroke="${b}" stroke-opacity=".22"/>`; for (let j = 0; j < 5; j++) p += `<path d="M0 ${40 + j * 28} H400" stroke="${b}" stroke-opacity="${.08 + j * .04}"/>`; break;
    case 2: { const n = []; for (let i = 0; i < 16; i++) n.push([r() * 400, r() * 160]); n.forEach((q, i) => n.forEach((s, j) => { if (j > i && Math.hypot(q[0] - s[0], q[1] - s[1]) < 110) p += `<line x1="${q[0] | 0}" y1="${q[1] | 0}" x2="${s[0] | 0}" y2="${s[1] | 0}" stroke="${b}" stroke-opacity=".3"/>`; })); n.forEach(q => p += `<circle cx="${q[0] | 0}" cy="${q[1] | 0}" r="2.4" fill="${b}"/>`); break; }
    case 3: for (let i = 0; i < 7; i++) { let d = 'M0 ' + (60 + i * 12); for (let x = 0; x <= 400; x += 20) d += ` L${x} ${(60 + i * 12 + Math.sin(x / 40 + i) * 18).toFixed(1)}`; p += `<path d="${d}" fill="none" stroke="${b}" stroke-opacity="${.12 + i * .04}"/>`; } break;
    case 4: for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) { const cx = x * 36 + (y % 2) * 18 + 150, cy = y * 30; p += `<polygon points="${[0, 1, 2, 3, 4, 5].map(k => `${(cx + 15 * Math.cos(k * Math.PI / 3)).toFixed(1)},${(cy + 15 * Math.sin(k * Math.PI / 3)).toFixed(1)}`).join(' ')}" fill="none" stroke="${b}" stroke-opacity="${(.06 + r() * .3).toFixed(2)}"/>`; } break;
    default: for (let i = 0; i < 18; i++) { const h = 20 + r() * 110; p += `<rect x="${170 + i * 13}" y="${160 - h}" width="8" height="${h}" fill="${b}" fill-opacity="${(.12 + r() * .3).toFixed(2)}"/>`; }
  }
  return `<svg class="${cls}" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}" stop-opacity=".85"/><stop offset="1" stop-color="#04102c"/></linearGradient><radialGradient id="${id}r" cx="82%" cy="25%" r="65%"><stop offset="0" stop-color="${b}" stop-opacity=".55"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="160" fill="#061433"/><rect width="400" height="160" fill="url(#${id})" opacity=".8"/><rect width="400" height="160" fill="url(#${id}r)"/>${p}<rect y="120" width="400" height="40" fill="url(#${id})" opacity=".0"/></svg>`;
}

/* =====================================================================
   STATE  (application state is kept separate from rendering)
   ===================================================================== */
const freshState = () => ({
  view: 'home', newsFilter: 'all', newsQuery: '', trackFilter: 'all', sessionFilter: 'all', zoneFilter: null,
  schedule: [], chat: { busy: false, epoch: 0 },
  wizard: { open: false, step: 1, role: null, experience: null, interests: [], focusTrack: null, token: 0 },
  journey: null,
  draft: { name: '', email: '', org: '', tab: 'preset', avatar: { kind: 'preset', id: 'orbit' }, errors: {} },
  passport: null, attended: null
});
let state = freshState();

/* ---------- schedule ----------
   relative (demo):  times are generated around "now" so a session is always live
   fixed (event day): each session's `time` (HH:MM) today, in EVENT_TIMEZONE */
function zonedTimeToEpoch(hhmm, tz) {
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  if (!tz) { const d = new Date(now); d.setHours(h, m, 0, 0); return d.getTime(); }
  const parts = (date, opts) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(date).map(p => [p.type, p.value]));
  const day = parts(now, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const guess = Date.UTC(+day.year, +day.month - 1, +day.day, h, m);
  const z = parts(new Date(guess), { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const offset = Date.UTC(+z.year, +z.month - 1, +z.day, +z.hour, +z.minute) - guess;
  return guess - offset;
}
function buildSchedule() {
  if (CONFIG.scheduleMode === 'fixed') {
    state.schedule = DATA.sessions.map(s => { const start = zonedTimeToEpoch(s.time, CONFIG.eventTimezone); return { id: s.id, start, end: start + s.mins * 60000 }; });
    return;
  }
  const base = new Date(); base.setSeconds(0, 0); base.setMinutes(base.getMinutes() - base.getMinutes() % 15);
  const offsets = [-120, -15, 45, 105, 165, 225, 285, 345];
  state.schedule = DATA.sessions.map((s, i) => ({ id: s.id, start: base.getTime() + offsets[i] * 60000, end: base.getTime() + (offsets[i] + s.mins) * 60000 }));
}
function sessionsWithStatus() {
  const now = Date.now();
  let list = state.schedule.map(t => { const s = getSession(t.id); return { ...s, start: t.start, end: t.end, status: now < t.start ? 'upcoming' : now >= t.end ? 'done' : 'live' }; });
  if (CONFIG.scheduleMode !== 'fixed' && !list.some(s => s.status !== 'done')) { buildSchedule(); return sessionsWithStatus(); }
  return list;
}
const sessRange = s => `${fmtTime(s.start)}–${fmtTime(s.end)}`;
const statusPill = s => s.status === 'live' ? '<span class="pill live"><i class="dot"></i>LIVE NOW</span>' : s.status === 'upcoming' ? '<span class="pill gold">UPCOMING</span>' : '<span class="pill done">COMPLETED</span>';
function sessWithStatus(id) { return sessionsWithStatus().find(s => s.id === id); }

/* =====================================================================
   QR CODE ENCODER (byte mode, ECC level M, versions 1–20)
   Compact port of the public-domain reference algorithm (Project Nayuki).
   ===================================================================== */
const QR = (() => {
  const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
  const BLK = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];
  const rawMods = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = v => Math.floor(rawMods(v) / 8) - ECC[v] * BLK[v];
  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  function rsDiv(d) { const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1; for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = gmul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; }
  function rsRem(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); } return r; }
  function penalty(m, n) {
    let p = 0;
    for (let y = 0; y < n; y++) { let run = 1; for (let x = 1; x < n; x++) { if (m[y][x] === m[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let x = 0; x < n; x++) { let run = 1; for (let y = 1; y < n; y++) { if (m[y][x] === m[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    let dark = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (m[y][x]) dark++; if (x < n - 1 && y < n - 1) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; } }
    const total = n * n; p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }
  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = 1; for (; v <= 20; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCw(v) * 8) break;
    if (v > 20) throw new Error('QR data too long');
    const bits = []; const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
    const capBits = dataCw(v) * 8; push(0, Math.min(4, capBits - bits.length)); push(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    const nb = BLK[v], el = ECC[v], raw = Math.floor(rawMods(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDiv(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const len = shortLen - el + (i < nShort ? 0 : 1); const dat = data.slice(k, k + len); k += len; const ecc = rsRem(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });
    const size = v * 4 + 17, m = [], fn = [];
    for (let i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (v > 1) {
      const n = Math.floor(v / 7) + 2, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, pos = [6];
      for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    }
    const drawFormat = mask => {
      const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i)); set(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); } }
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < cw.length * 8) { m[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const apply = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) { apply(k); drawFormat(k); const p = penalty(m, size); if (p < bestP) { bestP = p; best = k; } apply(k); }
    apply(best); drawFormat(best);
    return { size, modules: m, version: v };
  }
  function draw(ctx, qr, x, y, px, dark = '#04102e') {
    const s = px / (qr.size + 8); ctx.fillStyle = dark;
    for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.modules[r][c]) ctx.fillRect(x + (c + 4) * s, y + (r + 4) * s, Math.ceil(s), Math.ceil(s));
  }
  return { encode, draw };
})();

/* =====================================================================
   AVATARS (drawn procedurally so they export cleanly to PNG)
   ===================================================================== */
function drawPreset(x, a, S) {
  x.save(); x.beginPath(); x.rect(0, 0, S, S); x.clip();
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#030c26'); g.addColorStop(1, '#0b2457'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  const rg = x.createRadialGradient(S * .5, S * .4, 0, S * .5, S * .4, S * .72); rg.addColorStop(0, hexA(a.c1, .6)); rg.addColorStop(1, hexA(a.c1, 0)); x.fillStyle = rg; x.fillRect(0, 0, S, S);
  x.strokeStyle = hexA(a.c2, .33); x.lineWidth = Math.max(1, S / 220);
  const r = rng(hashStr(a.id));
  x.beginPath();
  if (a.pattern === 'orbits') { for (let k = 0; k < 3; k++) { x.moveTo(S * .5 + S * .46 * Math.cos(k * Math.PI / 3), S * .45 + S * .46 * Math.sin(k * Math.PI / 3)); x.ellipse(S * .5, S * .45, S * .46, S * .15, k * Math.PI / 3, 0, Math.PI * 2); } }
  else if (a.pattern === 'tri') { const st = S / 6; for (let k = -6; k < 13; k++) { x.moveTo(k * st, 0); x.lineTo(k * st + S * .58, S); x.moveTo(k * st, 0); x.lineTo(k * st - S * .58, S); } for (let k = 1; k < 7; k++) { x.moveTo(0, k * st); x.lineTo(S, k * st); } }
  else if (a.pattern === 'circuit') { for (let k = 0; k < 16; k++) { let px = r() * S, py = r() * S; x.moveTo(px, py); for (let s = 0; s < 3; s++) { if (s % 2) py += (r() - .5) * S * .4; else px += (r() - .5) * S * .4; x.lineTo(px, py); } x.moveTo(px + 3, py); x.arc(px, py, 3, 0, Math.PI * 2); } }
  else if (a.pattern === 'waves') { for (let k = 0; k < 9; k++) { for (let px = 0; px <= S; px += S / 40) { const py = S * (.12 + k * .1) + Math.sin(px / S * 7 + k) * S * .04; px ? x.lineTo(px, py) : x.moveTo(px, py); } } }
  else if (a.pattern === 'rings') { for (let k = 1; k < 9; k++) { x.moveTo(S * .5 + k * S * .07, S * .42); x.arc(S * .5, S * .42, k * S * .07, 0, Math.PI * 2); } }
  else { const h = S / 9; for (let row = -1; row < 11; row++) for (let col = -1; col < 8; col++) { const cx = col * h * 1.5, cy = row * h * .87 * 2 + (col % 2) * h * .87; for (let k = 0; k <= 6; k++) { const px = cx + h * .55 * Math.cos(k * Math.PI / 3), py = cy + h * .55 * Math.sin(k * Math.PI / 3); k ? x.lineTo(px, py) : x.moveTo(px, py); } } }
  x.stroke();
  // shoulders + neck
  const sg = x.createLinearGradient(0, S * .6, 0, S); sg.addColorStop(0, hexA(a.c2, .95)); sg.addColorStop(1, hexA(a.c1, .9));
  x.fillStyle = hexA(a.c1, .85); x.fillRect(S * .44, S * .55, S * .12, S * .2);
  x.fillStyle = sg; x.beginPath(); x.ellipse(S / 2, S * 1.03, S * .37, S * .33, 0, Math.PI, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = Math.max(1, S / 160); x.stroke();
  // low-poly head
  const hx = S / 2, hy = S * .42, hr = S * .175, pts = [];
  for (let k = 0; k < 6; k++) pts.push([hx + hr * Math.cos(k * Math.PI / 3 - Math.PI / 2), hy + hr * Math.sin(k * Math.PI / 3 - Math.PI / 2)]);
  const hg = x.createLinearGradient(hx - hr, hy - hr, hx + hr, hy + hr); hg.addColorStop(0, hexA(a.c2, 1)); hg.addColorStop(1, hexA(a.c1, 1));
  x.fillStyle = hg; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.28)'; x.beginPath(); pts.forEach(p => { x.moveTo(hx, hy + hr * .15); x.lineTo(p[0], p[1]); }); x.stroke();
  x.restore();
}
function coverDraw(x, img, dx, dy, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = Math.max(w / iw, h / ih);
  x.drawImage(img, dx + (w - iw * s) / 2, dy + (h - ih * s) / 2, iw * s, ih * s);
}
function drawAvatar(x, av, dx, dy, w, h = w) {
  x.save(); x.translate(dx, dy);
  if (av && av.kind === 'photo' && av.img) { x.fillStyle = '#04102e'; x.fillRect(0, 0, w, h); coverDraw(x, av.img, 0, 0, w, h); }
  else { const a = byId(DATA.avatars, av && av.id) || DATA.avatars[0]; const S = Math.max(w, h); x.beginPath(); x.rect(0, 0, w, h); x.clip(); x.translate((w - S) / 2, (h - S) / 2); drawPreset(x, a, S); }
  x.restore();
}
function avatarCanvas(av, S = 512) { const c = document.createElement('canvas'); c.width = c.height = S; drawAvatar(c.getContext('2d'), av, 0, 0, S); return c; }
function paintAvatarInto(canvas, av) { const S = canvas.width; const x = canvas.getContext('2d'); x.clearRect(0, 0, S, S); drawAvatar(x, av, 0, 0, S); }

/* =====================================================================
   HERO VISUALS: skyline + globe/radar
   ===================================================================== */
function skylineSVG() {
  const W = 1600, H = 320, r = rng(7); let back = '', front = '', win = '';
  for (let x = -10; x < W;) { const w = 16 + r() * 36, h = 50 + r() * 130; back += `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`; x += w + 1 + r() * 5; }
  const avoid = [[205, 335], [480, 590], [700, 830], [880, 945], [995, 1125], [1285, 1395], [1420, 1590]];
  for (let x = -5; x < W;) {
    const w = 22 + r() * 40, h = 60 + r() * 130;
    if (!avoid.some(([a, b]) => x + w > a && x < b)) {
      front += `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
      for (let wy = H - h + 8; wy < H - 6; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7) if (r() < .13) win += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="2.2" height="3"${r() < .12 ? ' class="wg"' : ''}/>`;
    }
    x += w + 3 + r() * 10;
  }
  const c = 1060, bk = [[c - 36, 320], [c - 36, 255], [c - 27, 255], [c - 27, 205], [c - 20, 205], [c - 20, 155], [c - 14, 155], [c - 14, 110], [c - 9, 110], [c - 9, 68], [c - 4.5, 68], [c - 1.6, 14], [c, 0], [c + 1.6, 14], [c + 4.5, 68], [c + 9, 68], [c + 9, 120], [c + 15, 120], [c + 15, 170], [c + 22, 170], [c + 22, 228], [c + 30, 228], [c + 30, 270], [c + 38, 270], [c + 38, 320]].map(p => p.join(',')).join(' ');
  const landmarks = `
    <polygon points="${bk}"/>
    <path d="M232 320 L232 112 Q300 150 318 320 Z"/><path d="M226 320 L224 96" class="ln"/><path d="M226 150 L292 150" class="ln"/>
    <polygon points="500,320 500,148 538,112 538,320"/><polygon points="548,320 548,170 578,140 578,320"/>
    <rect x="732" y="296" width="62" height="24"/><ellipse cx="763" cy="246" rx="44" ry="56" fill="none" class="mof" stroke-width="20"/>
    <path d="M890 320 C 884 250 902 200 896 120 L926 120 C 932 200 914 250 920 320 Z"/>
    <rect x="1298" y="168" width="13" height="152"/><rect x="1366" y="168" width="13" height="152"/><rect x="1298" y="158" width="81" height="14"/>
    <circle cx="1505" cy="222" r="74" fill="none" class="ln" stroke-width="3"/><circle cx="1505" cy="222" r="6"/>
    <path d="M1505 222 L1462 320 M1505 222 L1548 320" class="ln" stroke-width="4"/>`;
  let spokes = ''; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; spokes += `<line x1="1505" y1="222" x2="${(1505 + 74 * Math.cos(a)).toFixed(1)}" y2="${(222 + 74 * Math.sin(a)).toFixed(1)}"/><circle cx="${(1505 + 74 * Math.cos(a)).toFixed(1)}" cy="${(222 + 74 * Math.sin(a)).toFixed(1)}" r="3.4"/>`; }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
    <defs>
      <linearGradient id="skyF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11336f"/><stop offset=".6" stop-color="#071739"/><stop offset="1" stop-color="#030b22"/></linearGradient>
      <linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2556"/><stop offset="1" stop-color="#04102c"/></linearGradient>
      <linearGradient id="skyG" x1="0" x2="1"><stop offset="0" stop-color="#46d2ff" stop-opacity="0"/><stop offset=".5" stop-color="#46d2ff" stop-opacity=".9"/><stop offset="1" stop-color="#46d2ff" stop-opacity="0"/></linearGradient>
      <linearGradient id="bkL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4d88f"/><stop offset="1" stop-color="#46d2ff" stop-opacity="0"/></linearGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#020817" stop-opacity=".9"/></linearGradient>
    </defs>
    <style>.b rect{fill:url(#skyB);opacity:.75}.f>*{fill:url(#skyF);stroke:rgba(110,190,255,.45);stroke-width:1}.f .ln{fill:none;stroke:rgba(110,190,255,.7)}.f .mof{fill:none;stroke:url(#skyF)}.w rect{fill:#7cc4ff;opacity:.6}.w .wg{fill:#f4d88f}.sp line{stroke:rgba(110,190,255,.45);stroke-width:1}.sp circle{fill:#46d2ff;opacity:.8}</style>
    <g class="b">${back}</g>
    <g class="f">${front}${landmarks}</g>
    <ellipse cx="763" cy="246" rx="44" ry="56" fill="none" stroke="rgba(110,190,255,.55)" stroke-width="1"/><ellipse cx="763" cy="246" rx="25" ry="37" fill="none" stroke="rgba(110,190,255,.55)" stroke-width="1"/>
    <g class="sp">${spokes}</g>
    <g class="w">${win}</g>
    <line x1="${c}" y1="4" x2="${c}" y2="300" stroke="url(#bkL)" stroke-width="1.6"/>
    <circle cx="${c}" cy="2" r="2.5" fill="#f4d88f"><animate attributeName="opacity" values="1;.2;1" dur="2s" repeatCount="indefinite"/></circle>
    <rect y="230" width="${W}" height="90" fill="url(#fade)"/>
    <rect y="${H - 2}" width="${W}" height="2" fill="url(#skyG)"/>
  </svg>`;
}

const globe = (() => {
  let cv, ctx, W = 0, H = 0, raf = 0, active = false;
  const t0 = performance.now();
  const N = 900, pts = [];
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), phi = i * 2.399963; pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r]); }
  const ll = (lat, lon) => { const a = lat * Math.PI / 180, b = -lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)]; };
  const DXB = ll(25.2, 55.3);
  const cities = [[51.5, -0.1], [1.35, 103.8], [40.7, -74], [35.7, 139.7], [-1.3, 36.8], [19.1, 72.9], [48.9, 2.35], [-33.9, 151.2], [30.0, 31.2], [22.3, 114.2], [24.7, 46.7], [-23.5, -46.6]].map(c => ll(c[0], c[1]));
  const slerp = (a, b, s) => { const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(d), so = Math.sin(om) || 1; const k1 = Math.sin((1 - s) * om) / so, k2 = Math.sin(s * om) / so; return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2]; };
  const arcs = cities.map(c => { const arr = []; for (let i = 0; i <= 40; i++) { const s = i / 40, p = slerp(DXB, c, s), l = 1 + .22 * Math.sin(Math.PI * s); arr.push([p[0] * l, p[1] * l, p[2] * l]); } return arr; });
  const theta0 = Math.atan2(-DXB[0], DXB[2]), TILT = .35;
  const nr = rng(99), nodes = Array.from({ length: 26 }, () => ({ x: nr(), y: nr(), vx: (nr() - .5) * .00004, vy: (nr() - .5) * .00004 }));
  const grid = [];
  for (let lon = 0; lon < 360; lon += 30) { const line = []; for (let lat = -90; lat <= 90; lat += 6) line.push(ll(lat, lon)); grid.push(line); }
  for (const lat of [-60, -30, 0, 30, 60]) { const line = []; for (let lon = 0; lon <= 360; lon += 6) line.push(ll(lat, lon)); grid.push(line); }

  function resize() { if (!cv) return; const r = cv.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = r.width; H = r.height; cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (!raf) frame(performance.now()); }
  function proj(p, rot, cx, cy, R) { const c = Math.cos(rot), s = Math.sin(rot), x1 = p[0] * c + p[2] * s, z1 = -p[0] * s + p[2] * c, ct = Math.cos(TILT), st = Math.sin(TILT); return [cx + x1 * R, cy - (p[1] * ct - z1 * st) * R, p[1] * st + z1 * ct]; }
  function frame(now) {
    if (!W || !H) return;
    const t = now - t0, mobile = W < 700;
    ctx.clearRect(0, 0, W, H);
    const cx = mobile ? W * .5 : W * .68, cy = mobile ? Math.min(H * .5, 340) : H * .4, R = mobile ? Math.min(W * .36, 170) : Math.min(W * .19, H * .31);
    const rot = theta0 + Math.sin(t * .00008) * 1.05;
    // background network
    ctx.lineWidth = 1;
    nodes.forEach(n => { n.x += n.vx * 16; n.y += n.vy * 16; if (n.x < 0 || n.x > 1) n.vx *= -1; if (n.y < 0 || n.y > 1) n.vy *= -1; });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const ax = nodes[i].x * W, ay = nodes[i].y * H, bx = nodes[j].x * W, by = nodes[j].y * H, d = Math.hypot(ax - bx, ay - by);
      if (d < 190) { ctx.strokeStyle = `rgba(90,170,255,${(1 - d / 190) * .14})`; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(120,200,255,.35)'; nodes.forEach(n => { ctx.fillRect(n.x * W - 1, n.y * H - 1, 2, 2); });
    // halo + body
    let g = ctx.createRadialGradient(cx, cy, R * .5, cx, cy, R * 1.75); g.addColorStop(0, 'rgba(46,139,255,.3)'); g.addColorStop(1, 'rgba(46,139,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.75, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); g.addColorStop(0, 'rgba(46,120,240,.42)'); g.addColorStop(1, 'rgba(4,16,46,.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    // radar sweep
    const ang = (t * .0007) % (Math.PI * 2);
    if (ctx.createConicGradient) { const cg = ctx.createConicGradient(ang - Math.PI * 2 * .9, cx, cy); cg.addColorStop(0, 'rgba(70,210,255,0)'); cg.addColorStop(.9, 'rgba(70,210,255,.28)'); cg.addColorStop(.9001, 'rgba(70,210,255,0)'); cg.addColorStop(1, 'rgba(70,210,255,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(140,225,255,.55)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R * 1.5, cy + Math.sin(ang) * R * 1.5); ctx.stroke();
    // rings + ticks
    ctx.strokeStyle = 'rgba(70,210,255,.22)'; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, 7); ctx.stroke();
    ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(70,210,255,.35)'; ctx.beginPath();
    for (let k = 0; k < 72; k++) { const a = k * Math.PI / 36, l = k % 6 ? 4 : 10; ctx.moveTo(cx + Math.cos(a) * R * 1.5, cy + Math.sin(a) * R * 1.5); ctx.lineTo(cx + Math.cos(a) * (R * 1.5 + l), cy + Math.sin(a) * (R * 1.5 + l)); }
    ctx.stroke();
    // graticule
    ctx.strokeStyle = 'rgba(90,170,255,.16)'; ctx.beginPath();
    grid.forEach(line => { let prev = null; line.forEach(p => { const q = proj(p, rot, cx, cy, R); if (q[2] > 0) { prev ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); prev = q; } else prev = null; }); });
    ctx.stroke();
    // dots (bucketed by depth)
    const buckets = [[], [], [], [], []];
    pts.forEach(p => { const q = proj(p, rot, cx, cy, R); if (q[2] > 0) buckets[Math.min(4, (q[2] * 5) | 0)].push(q); });
    buckets.forEach((b, i) => { ctx.fillStyle = `rgba(150,215,255,${.18 + i * .17})`; const s = .9 + i * .32; ctx.beginPath(); b.forEach(q => ctx.rect(q[0] - s / 2, q[1] - s / 2, s, s)); ctx.fill(); });
    // arcs
    arcs.forEach((arr, i) => {
      ctx.strokeStyle = 'rgba(244,216,143,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); let prev = null;
      arr.forEach(p => { const q = proj(p, rot, cx, cy, R); if (q[2] > -.05) { prev ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); prev = q; } else prev = null; });
      ctx.stroke();
      const s = (t * .00022 + i * .137) % 1, p = arr[Math.round(s * 40)], q = proj(p, rot, cx, cy, R);
      if (q[2] > -.05) { ctx.fillStyle = 'rgba(255,240,200,.95)'; ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, 7); ctx.fill(); }
      const e = proj(cities[i], rot, cx, cy, R); if (e[2] > 0) { ctx.fillStyle = 'rgba(70,210,255,.9)'; ctx.beginPath(); ctx.arc(e[0], e[1], 2.4, 0, 7); ctx.fill(); }
    });
    ctx.lineWidth = 1;
    // Dubai
    const d = proj(DXB, rot, cx, cy, R);
    if (d[2] > 0) {
      const pr = (t % 2200) / 2200;
      ctx.strokeStyle = `rgba(244,216,143,${1 - pr})`; ctx.beginPath(); ctx.arc(d[0], d[1], 4 + pr * 22, 0, 7); ctx.stroke();
      ctx.fillStyle = '#f4d88f'; ctx.shadowColor = '#d8b15b'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(d[0], d[1], 4.2, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.fillStyle = 'rgba(244,216,143,.95)'; ctx.fillText('DUBAI', d[0] + 9, d[1] - 8);
    }
    ctx.strokeStyle = 'rgba(120,200,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  }
  function loop(now) { if (!active || document.hidden) { raf = 0; return; } frame(now); raf = requestAnimationFrame(loop); }
  return {
    init() { cv = $('#globeCanvas'); ctx = cv.getContext('2d'); new ResizeObserver(resize).observe(cv); resize(); },
    setActive(on) { active = on && !REDUCED; if (active && !raf) raf = requestAnimationFrame(loop); if (!active && REDUCED) frame(performance.now()); }
  };
})();
function updateGlobe() { globe.setActive(state.view === 'home' && !state.wizard.open && !bigscreen.playing && !document.hidden); }

/* =====================================================================
   NAVIGATION
   ===================================================================== */
const NAV = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'news', label: 'Latest AI News', icon: 'news' }, { id: 'demos', label: 'Explore Demos', icon: 'demos' },
  { id: 'tracks', label: 'Learning Tracks', icon: 'tracks' }, { id: 'sessions', label: 'Live Sessions', icon: 'sessions', badge: 'LIVE' },
  { id: 'ask', label: 'Ask Cleared for Takeoff', icon: 'ask' }, { id: 'journey', label: 'My AI Journey', icon: 'journey', gold: true }
];
function renderNav() {
  $('#navItems').innerHTML = NAV.map(n => `<button class="nav-item${n.gold ? ' gold' : ''}" data-action="nav" data-view="${n.id}">${ic(n.icon)}<span>${esc(n.label)}</span>${n.badge ? `<span class="nav-badge">${n.badge}</span>` : ''}</button>`).join('');
}
const RENDER = { news: renderNews, demos: renderDemos, tracks: renderTracks, sessions: renderSessions, ask: renderAskSide, journey: renderJourney, home: renderHome };
function navigate(view) {
  if (!NAV.some(n => n.id === view)) view = 'home';
  state.view = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.nav-item').forEach(b => { const on = b.dataset.view === view; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const chat = $('#chat');
  if (view === 'ask') $('#chatLarge').appendChild(chat); else if (view === 'home') $('#chatDock').appendChild(chat);
  RENDER[view]();
  const sc = $('#view-' + view + ' .view-scroll'); if (sc) sc.scrollTop = 0;
  window.scrollTo(0, 0);
  scrollChat();
  updateGlobe();
}

/* =====================================================================
   HOME
   ===================================================================== */
function renderHome() {
  $('#heroStats').innerHTML = [[DATA.demos.length, 'Booth demos'], [DATA.sessions.length, 'Sessions today'], [DATA.tracks.length, 'Learning tracks'], ['4', 'Stage AI journey']]
    .map(([n, l]) => `<div class="hero-stat"><b>${n}</b><span>${l}</span></div>`).join('');
  const acts = [
    { t: 'Latest AI News', d: 'Explore the latest developments in Agentic AI and government innovation.', i: 'news', a: 'data-action="nav" data-view="news"' },
    { t: 'Explore Our Demos', d: 'Discover the demonstrations available at the GDRFA booth.', i: 'demos', a: 'data-action="nav" data-view="demos"' },
    { t: 'Start Your AI Journey', d: 'Generate a personalized Agentic AI learning experience.', i: 'journey', a: 'data-action="start-journey"', gold: true }
  ];
  $('#heroActions').innerHTML = acts.map(c => `<button class="action-card${c.gold ? ' gold' : ''}" ${c.a}><span class="ac-ic">${ic(c.i)}</span><span><h3>${c.t}</h3><p>${c.d}</p></span><span class="ac-go">${ic('arrow')}</span></button>`).join('');
  $('#trackScroller').innerHTML = DATA.tracks.map(trackCard).join('');
  renderBooth();
}
const levelPill = l => `<span class="pill${l === 'Advanced' ? ' gold' : ''}">${esc(l)}</span>`;
function trackCard(t, i) {
  return `<button class="track-card" data-action="open-track" data-id="${t.id}"><div class="track-art">${artSVG(t.colors, i)}<div class="ta-ic">${ic(t.icon)}</div><div class="ta-n">0${i + 1}</div></div>
    <div class="track-body"><h4>${esc(t.title)}</h4><p>${esc(t.desc)}</p><div class="track-foot">${levelPill(t.level)}<span class="explore">Explore ${ic('arrow')}</span></div></div></button>`;
}
function renderBooth() {
  const ss = sessionsWithStatus(), live = ss.find(s => s.status === 'live'), up = ss.filter(s => s.status === 'upcoming'), next = up[0], later = up.slice(1, 3), now = Date.now();
  let html = `<div class="panel-head">${ic('pin')}<h3>TODAY AT THE BOOTH</h3>${sample(DATA.meta.sessionsAreSample, 'Sample')}<span class="spacer"></span><button class="link-btn" data-action="nav" data-view="sessions">Full schedule ${ic('arrow')}</button></div><div class="booth-body">`;
  if (live) { const pct = Math.round((now - live.start) / (live.end - live.start) * 100); html += `<button class="sess-live" data-action="open-session" data-id="${live.id}"><div class="sess-top"><i class="dot"></i>Live now · ${esc(live.type)}</div><div class="sess-title">${esc(live.title)}</div><div class="sess-meta"><span>${ic('clock')}${sessRange(live)}</span><span>${ic('pin')}${esc(zone(live.zone).label)}</span></div><div class="progress"><i style="width:${pct}%"></i></div></button>`; }
  if (next) { const mins = Math.max(1, Math.round((next.start - now) / 60000)); html += `<button class="sess-next" data-action="open-session" data-id="${next.id}"><div class="sess-top">${ic('clock')}Up next · starts in ${mins} min</div><div class="sess-title">${esc(next.title)}</div><div class="sess-meta"><span>${ic('clock')}${sessRange(next)}</span><span>${ic('pin')}${esc(zone(next.zone).label)}</span></div></button>`; }
  if (later.length) html += `<div class="sub-label">Later today</div>` + later.map(s => `<button class="sess-row" data-action="open-session" data-id="${s.id}"><time>${fmtTime(s.start)}</time><div><div class="t">${esc(s.title)}</div><div class="z">${esc(s.type)} · ${esc(zone(s.zone).label)}</div></div></button>`).join('');
  html += `<div class="sub-label">Available demos</div><div class="demo-chips">${DATA.demos.map(d => `<button class="demo-chip" data-action="open-demo" data-id="${d.id}">${ic(d.icon)}${esc(DEMO_SHORT[d.id])} <b>${esc(zone(d.zone).short)}</b></button>`).join('')}</div></div>`;
  $('#boothPanel').innerHTML = html;
}

/* =====================================================================
   NEWS
   ===================================================================== */
const daysAgo = d => d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
function renderNews() {
  $('#newsRoot').innerHTML = `
    <div class="view-head"><div><div class="eyebrow">${ic('live')} Cleared for Takeoff Intelligence Feed</div><h2>LATEST AI NEWS</h2><p>Curated highlights on Agentic AI, government innovation, research and emerging technology.</p></div>
      <div class="news-tools">${sample(DATA.meta.newsIsSample, ic('alert') + ' Sample content · not live news')}<label class="search">${ic('search')}<span class="sr-only">Search news</span><input id="newsSearch" placeholder="Search the feed" maxlength="60" value="${esc(state.newsQuery)}"></label></div></div>
    <div class="chips" id="newsChips" style="margin-bottom:1rem"></div>
    <div id="newsResults"></div>`;
  $('#newsSearch').addEventListener('input', e => { state.newsQuery = cleanText(e.target.value, 60); renderNewsResults(); });
  renderNewsResults();
}
function newsCard(n, featured) {
  return `<button class="card${featured ? ' news-featured' : ''}" data-action="open-news" data-id="${n.id}">
    <div class="nart${featured ? ' nf-art' : ''}">${artSVG(CAT_COLORS[n.cat], hashStr(n.id) % 6)}${sample(DATA.meta.newsIsSample, 'Sample')}<span class="pill ncat">${esc(CAT_LABEL[n.cat])}</span></div>
    <div class="card-body"><div class="small">${daysAgo(n.days)} · ${n.mins} min read · Cleared for Takeoff Editorial</div><h3>${esc(n.title)}</h3><p>${esc(featured ? n.summary : n.summary.split('. ')[0].replace(/\.$/, '') + '.')}</p>${featured ? `<ul>${n.points.map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>` : ''}
    <div class="card-foot"><span class="pill">${esc(getTrack(n.track).title)}</span><span class="explore">Read summary ${ic('arrow')}</span></div></div></button>`;
}
function renderNewsResults() {
  const f = state.newsFilter, q = state.newsQuery.toLowerCase();
  $('#newsChips').innerHTML = DATA.newsCats.map(c => `<button class="chip${f === c.id ? ' active' : ''}" data-action="news-filter" data-filter="${c.id}">${c.icon ? ic(c.icon) : ''}${esc(c.label)}</button>`).join('');
  const items = DATA.news.filter(n => (f === 'all' || n.cat === f) && (!q || (n.title + ' ' + n.summary).toLowerCase().includes(q))).sort((a, b) => a.days - b.days);
  if (!items.length) { $('#newsResults').innerHTML = `<div class="empty">No demo articles match your search. <button class="link-btn" data-action="news-filter" data-filter="all" data-clear="1">Clear filters</button></div>`; return; }
  const featured = items.find(n => n.featured) || items[0], rest = items.filter(n => n !== featured);
  $('#newsResults').innerHTML = `<div class="news-layout">${newsCard(featured, true)}<div class="grid grid-2">${rest.map(n => newsCard(n)).join('')}</div></div>`;
}

/* =====================================================================
   DEMOS
   ===================================================================== */
function renderDemos() {
  $('#demosRoot').innerHTML = `
    <div class="view-head"><div><div class="eyebrow">${ic('pin')} Around the GDRFA booth</div><h2>EXPLORE DEMOS</h2><p>Six experiences showing how Agentic AI could shape residency, travel and government services.</p></div>${sample(DATA.meta.demosAreIllustrative, ic('alert') + ' Illustrative capabilities · not all are deployed GDRFA services')}</div>
    <div class="grid grid-3">${DATA.demos.map((d, i) => `
      <button class="card" data-action="open-demo" data-id="${d.id}">
        <div class="dart">${artSVG(d.colors, i + 2, 'bg')}<span class="pill dz">${ic('pin')}${esc(zone(d.zone).label)}</span><span class="pill ${d.live ? 'live' : 'gold'} ds">${esc(d.status)}</span><div class="big-ic">${ic(d.icon)}</div></div>
        <div class="card-body"><h3>${esc(d.title)}</h3><p>${esc(d.overview)}</p>
          <div class="card-foot"><div class="card-meta">${d.tracks.slice(0, 2).map(t => `<span class="pill">${esc(getTrack(t).title)}</span>`).join('')}</div><span class="explore">Details ${ic('arrow')}</span></div></div>
      </button>`).join('')}</div>`;
}

/* =====================================================================
   LEARNING TRACKS
   ===================================================================== */
function renderTracks() {
  const f = state.trackFilter, levels = ['all', 'Beginner', 'Intermediate', 'Advanced', 'All levels'];
  const list = DATA.tracks.filter(t => f === 'all' || t.level === f);
  $('#tracksRoot').innerHTML = `
    <div class="view-head"><div><div class="eyebrow">${ic('tracks')} Cleared for Takeoff Academy</div><h2>LEARNING TRACKS</h2><p>Six curated tracks — from first steps with AI agents to leading innovation programmes.</p></div>
      <div class="chips">${levels.map(l => `<button class="chip${f === l ? ' active' : ''}" data-action="track-filter" data-filter="${l}">${l === 'all' ? 'All tracks' : esc(l)}</button>`).join('')}</div></div>
    <div class="grid grid-3">${list.map(t => { const i = DATA.tracks.indexOf(t); return `
      <button class="card tv-card" data-action="open-track" data-id="${t.id}">
        <div class="track-art">${artSVG(t.colors, i)}<div class="ta-ic">${ic(t.icon)}</div><div class="ta-n">0${i + 1}</div></div>
        <div class="card-body"><div class="card-meta">${levelPill(t.level)}<span class="small">${esc(t.duration)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p>
          <ul class="mod-list">${t.modules.slice(0, 3).map((m, k) => `<li><b>0${k + 1}</b>${esc(m)}</li>`).join('')}</ul>
          <div class="card-foot"><span class="small">${t.modules.length} modules · ${CATALOG.courses.filter(c => c.tracks.includes(t.id)).length} courses</span><span class="explore">Explore track ${ic('arrow')}</span></div></div>
      </button>`; }).join('') || '<div class="empty">No tracks at this level.</div>'}</div>
    <div class="cta-banner"><div class="dialog-ic" style="margin:0">${ic('spark')}</div><div><h3>Not sure where to start?</h3><p>Answer three quick questions and Cleared for Takeoff will build a personalised Discover → Learn → Practice → Innovate journey.</p></div><button class="btn btn-gold" data-action="start-journey">${ic('journey')} Start Your AI Journey</button></div>`;
}

/* =====================================================================
   LIVE SESSIONS
   ===================================================================== */
function renderSessions() {
  $('#sessionsRoot').innerHTML = `
    <div class="view-head"><div><div class="eyebrow">${ic('live')} GDRFA booth programme</div><h2>LIVE SESSIONS</h2><p>Talks, showcases and hands-on workshops running throughout the day. Tap a session for details.</p></div>${sample(DATA.meta.sessionsAreSample, ic('alert') + ' Sample schedule')}</div>
    <div class="sessions-layout"><div><div class="chips" id="sessChips" style="margin-bottom:1rem"></div><div class="timeline" id="sessList"></div></div>
    <div><div class="glass map"><div class="panel-head">${ic('pin')}<h3>BOOTH MAP</h3><span class="spacer"></span><span class="small">Tap a zone to filter</span></div><div id="boothMap"></div><div class="zone-legend" id="zoneLegend"></div></div>
    <div class="glass side-box" style="margin-top:1rem;padding:1.1rem"><div class="panel-head" style="margin-bottom:.4rem">${ic('passport')}<h3 style="font-size:1.1rem">PASSPORT TIP</h3></div><p class="small" style="font-size:.82rem;line-height:1.5;color:var(--text-2)">Open a session and tap <b>“I attended this session”</b> to add it to your Agentic AI Passport.</p></div></div></div>`;
  renderSessionList();
}
function renderSessionList() {
  if (!$('#sessList')) return;
  const f = state.sessionFilter, zf = state.zoneFilter, ss = sessionsWithStatus();
  const opts = [['all', 'All sessions'], ['live', 'Live now'], ['upcoming', 'Upcoming'], ['done', 'Completed']];
  $('#sessChips').innerHTML = opts.map(([id, l]) => `<button class="chip${f === id ? ' active' : ''}" data-action="session-filter" data-filter="${id}">${esc(l)}</button>`).join('') + (zf ? `<button class="chip active" data-action="zone-filter" data-zone="${zf}">${esc(zone(zf).label)} ✕</button>` : '');
  const list = ss.filter(s => (f === 'all' || s.status === f) && (!zf || s.zone === zf));
  $('#sessList').innerHTML = list.map(s => `
    <button class="tl-item ${s.status}" data-action="open-session" data-id="${s.id}">
      <div class="tl-time">${fmtTime(s.start)}<small>to ${fmtTime(s.end)}</small></div>
      <div><div class="card-meta">${statusPill(s)}<span class="pill">${esc(s.type)}</span>${state.attended === s.id ? '<span class="pill gold">✓ Attended</span>' : ''}</div><h4>${esc(s.title)}</h4><div class="sess-meta"><span>${ic('pin')}${esc(zone(s.zone).label)}</span><span>${ic('users')}${esc(s.host)}${DATA.meta.sessionsAreSample ? ' (sample)' : ''}</span></div></div>
      <span class="explore">Details ${ic('arrow')}</span>
    </button>`).join('') || '<div class="empty">No sessions match this filter.</div>';
  const zs = DATA.booth.zones;
  $('#boothMap').innerHTML = `<svg viewBox="0 0 480 300" role="img" aria-label="Booth map">
    <rect x="4" y="4" width="472" height="292" rx="14" fill="rgba(46,139,255,.04)" stroke="rgba(96,170,255,.25)" stroke-dasharray="4 6"/>
    ${zs.map(z => { const on = zf === z.id, cnt = ss.filter(s => s.zone === z.id && s.status !== 'done').length, demos = DATA.demos.filter(d => d.zone === z.id); return `<g class="zone-shape" data-action="zone-filter" data-zone="${z.id}" role="button" tabindex="0" aria-label="${esc(z.label)}">
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" fill="${on ? 'rgba(46,139,255,.35)' : 'rgba(46,139,255,.1)'}" stroke="${on ? '#46d2ff' : 'rgba(96,170,255,.4)'}"/>
      <text x="${z.x + 12}" y="${z.y + 26}" fill="#eaf3ff" font-family="Rajdhani,Segoe UI,sans-serif" font-weight="700" font-size="${z.id === 'main' ? 20 : 17}">${esc(z.id === 'main' ? 'MAIN STAGE' : 'ZONE ' + z.short)}</text>
      <text x="${z.x + 12}" y="${z.y + 46}" fill="#a9bfdf" font-family="Inter,Segoe UI,sans-serif" font-size="11">${esc(z.label.split('· ')[1] || 'Talks & panels')}</text>
      ${demos.map((d, k) => `<circle cx="${z.x + 20 + k * 22}" cy="${z.y + z.h - 22}" r="7" fill="#d8b15b"/>`).join('')}
      ${cnt ? `<text x="${z.x + z.w - 12}" y="${z.y + z.h - 16}" text-anchor="end" fill="#3be3a1" font-family="Inter,sans-serif" font-size="11" font-weight="600">${cnt} session${cnt > 1 ? 's' : ''}</text>` : ''}</g>`; }).join('')}
    <g><circle cx="455" cy="282" r="0"/></g></svg>`;
  $('#zoneLegend').innerHTML = `<div class="small" style="display:flex;gap:1rem;flex-wrap:wrap"><span><span style="display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:#d8b15b"></span> Demo station</span><span style="color:var(--live)">● Sessions remaining today</span></div>` +
    zs.filter(z => DATA.demos.some(d => d.zone === z.id)).map(z => `<div class="demo-chips"><span class="small" style="min-width:7.5rem">${esc(z.label)}</span>${DATA.demos.filter(d => d.zone === z.id).map(d => `<button class="demo-chip" data-action="open-demo" data-id="${d.id}">${ic(d.icon)}${esc(DEMO_SHORT[d.id])}</button>`).join('')}</div>`).join('');
}

/* =====================================================================
   ASK VIEW (side panel; chat itself is a shared component)
   ===================================================================== */
function renderAskSide() {
  $('#askSide').innerHTML = DATA.askTopics.map(g => `<div class="glass topic-group"><h4>${ic(g.icon)}${esc(g.title)}</h4>${g.qs.map(q => `<button class="topic-q" data-action="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`).join('') +
    `<div class="glass topic-group"><h4>${ic('info')}How this assistant works</h4><p class="small" style="font-size:.8rem;line-height:1.55;color:var(--text-2)">This booth assistant answers from the content and course catalogue in this application using transparent matching rules, so it also works without a connection. Personalised journeys use the Claude-powered course recommender. No conversation is stored.</p></div>`;
}

/* =====================================================================
   MODALS (track / demo / session / news / QR destination)
   ===================================================================== */
let lastFocus = null;
function showOverlay(id) { const o = $('#' + id); if (!o.classList.contains('open')) { lastFocus = document.activeElement; o.classList.add('open'); } const f = o.querySelector('.modal-close, [data-autofocus], .btn-primary, .btn'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30); }
function hideOverlay(id) { const o = $('#' + id); if (!o.classList.contains('open')) return; o.classList.remove('open'); if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); }
function openModal({ colors, icon, title, labels = '', body, single = false }) {
  $('#modalBox').innerHTML = `<button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${ic('close')}</button>
    <div class="modal-art">${artSVG(colors, 2, 'bg')}<div class="ma-content"><div class="ma-ic">${ic(icon)}</div><div><div class="card-meta" style="margin-bottom:.55rem">${labels}</div><h2 id="modalTitle">${esc(title)}</h2></div></div></div>
    <div class="modal-body${single ? ' single' : ''}">${body}</div>`;
  showOverlay('modal');
}
const relTrackChips = ids => ids.map(id => `<button class="chip" data-action="open-track" data-id="${id}">${ic(getTrack(id).icon)}${esc(getTrack(id).title)}</button>`).join('');
function openTrack(id) {
  const t = getTrack(id); if (!t) return;
  const demos = DATA.demos.filter(d => d.tracks.includes(id)), sess = sessionsWithStatus().filter(s => s.track === id);
  openModal({ colors: t.colors, icon: t.icon, title: t.title, labels: `${levelPill(t.level)}<span class="pill">${esc(t.duration)}</span>`, body: `
    <div><section><h4>Overview</h4><p>${esc(t.desc)}</p></section>
      <section><h4>Modules</h4><ul class="steps-list">${t.modules.map(m => `<li>${esc(m)}</li>`).join('')}</ul></section>
      <section><h4>You will be able to</h4><ul>${t.outcomes.map(o => `<li>${esc(o)}</li>`).join('')}</ul></section>
</div>
    <div><div class="side-box"><dl class="kv"><dt>Level</dt><dd>${esc(t.level)}</dd><dt>Duration</dt><dd>${esc(t.duration)}</dd><dt>Best for</dt><dd>${t.interests.map(i => esc(byId(DATA.interests, i).label)).join(', ')}</dd></dl></div>
      ${demos.length ? `<div class="side-box"><h4>Related demos</h4><div class="q-list">${demos.map(d => `<button class="chip" data-action="open-demo" data-id="${d.id}">${ic(d.icon)}${esc(d.title)}</button>`).join('')}</div></div>` : ''}
      ${sess.length ? `<div class="side-box"><h4>Related sessions</h4><div class="q-list">${sess.map(s => `<button class="chip" data-action="open-session" data-id="${s.id}">${ic('sessions')}${fmtTime(s.start)} · ${esc(s.title)}</button>`).join('')}</div></div>` : ''}
      <div class="modal-actions"><button class="btn btn-gold" data-action="personalize" data-id="${t.id}">${ic('journey')} Personalize My Journey</button><button class="btn btn-ghost" data-action="ask" data-q="Tell me about the ${esc(t.title)} track">${ic('ask')} Ask Cleared for Takeoff</button></div></div>
    <div class="full"><section><h4>Recommended courses by level</h4>${coursesByLevelHTML(t.id)}</section></div>` });
}
function coursesByLevelHTML(trackId) {
  return `<div class="level-cols">${RULES.LEVELS.map(l => {
    const list = CATALOG.courses.filter(c => c.tracks.includes(trackId) && c.level === l);
    return `<div class="level-col"><div class="level-col-head">${LEVEL_LABEL[l]}</div>${list.length ? list.map(courseRow).join('') : '<p class="small">See the neighbouring levels.</p>'}</div>`;
  }).join('')}</div>`;
}
function openCourse(id) {
  const c = getCourse(id); if (!c) return;
  const tracks = c.tracks.map(getTrack).filter(Boolean);
  openModal({ colors: (tracks[0] || DATA.tracks[0]).colors, icon: 'tracks', title: c.title, labels: `<span class="pill${c.level === 'advanced' ? ' gold' : ''}">${LEVEL_LABEL[c.level]}</span><span class="pill">${esc(c.provider)}</span>`, body: `
    <div><section><h4>About this course</h4><p>${esc(c.summary)}</p></section>
      <section><h4>Details</h4><dl class="kv"><dt>Provider</dt><dd>${esc(c.provider)}</dd><dt>Level</dt><dd>${LEVEL_LABEL[c.level]}</dd><dt>Format</dt><dd>${esc(c.format)}</dd><dt>Effort</dt><dd>≈ ${fmtHours(c.hours)}</dd><dt>Access</dt><dd>${COST_LABEL[c.cost] || 'See provider'}</dd></dl></section>
      <section><h4>Part of these tracks</h4><div class="chips">${relTrackChips(c.tracks)}</div></section></div>
    <div><div class="side-box course-qr"><h4>Open on your phone</h4><canvas id="courseQr" width="300" height="300" aria-label="QR code linking to ${esc(c.title)}"></canvas><p class="small">${esc(c.url.replace(/^https?:\/\//, ''))}</p></div>
      <p class="disclaimer">${ic('info')}<span>External course by ${esc(c.provider)}. Content, pricing and certificates are set by the provider and may change; GDRFA does not operate this course.</span></p></div>` });
  const cv = $('#courseQr');
  try { const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 300, 300); QR.draw(x, QR.encode(c.url), 0, 0, 300); }
  catch (e) { cv.replaceWith(Object.assign(document.createElement('p'), { textContent: c.url })); }
}
function openDemo(id) {
  const d = getDemo(id); if (!d) return;
  openModal({ colors: d.colors, icon: d.icon, title: d.title, labels: `<span class="pill ${d.live ? 'live' : 'gold'}">${esc(d.status)}</span><span class="pill">${ic('pin')}${esc(zone(d.zone).label)}</span>`, body: `
    <div><section><h4>Overview</h4><p>${esc(d.overview)}</p></section>
      <section><h4>Business challenge</h4><p>${esc(d.challenge)}</p></section>
      <section><h4>How the technology works</h4><ul class="steps-list">${d.how.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>
      <section><h4>Potential benefits</h4><ul>${d.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul></section></div>
    <div><div class="side-box"><dl class="kv"><dt>Location</dt><dd>${esc(zone(d.zone).label)}</dd><dt>Format</dt><dd>${esc(d.status)}</dd></dl></div>
      <div class="side-box"><h4>Related learning tracks</h4><div class="q-list">${relTrackChips(d.tracks)}</div></div>
      <div class="side-box"><h4>Ask the AI assistant</h4><div class="q-list">${d.questions.map(q => `<button class="chip" data-action="ask" data-q="${esc(q)}">${ic('ask')}${esc(q)}</button>`).join('')}</div></div>
      ${d.live || DATA.meta.demosAreIllustrative ? `<p class="disclaimer">${ic('alert')}<span>${d.live ? 'Running at the booth now. Your name, email and photo never leave this kiosk; only your answers are used to recommend courses.' : 'Illustrative capability shown for demonstration and discussion. It does not necessarily represent a deployed GDRFA service.'}</span></p>` : ''}</div>` });
}
function openSession(id) {
  const s = sessWithStatus(id); if (!s) return;
  const att = state.attended === s.id, d = getDemo(s.demo), t = getTrack(s.track);
  openModal({ colors: t.colors, icon: 'sessions', title: s.title, labels: `${statusPill(s)}<span class="pill">${esc(s.type)}</span>${sample(DATA.meta.sessionsAreSample, 'Sample schedule')}`, body: `
    <div><section><h4>About this session</h4><p>${esc(s.desc)}</p></section>
      <section><h4>Agenda</h4><ul class="steps-list">${s.agenda.map(a => `<li>${esc(a)}</li>`).join('')}</ul></section>
      <section><h4>Related</h4><div class="chips"><button class="chip" data-action="open-track" data-id="${t.id}">${ic(t.icon)}${esc(t.title)}</button><button class="chip" data-action="open-demo" data-id="${d.id}">${ic(d.icon)}${esc(d.title)}</button></div></section></div>
    <div><div class="side-box"><dl class="kv"><dt>Time</dt><dd>${sessRange(s)}</dd><dt>Status</dt><dd>${s.status === 'live' ? 'Live now' : s.status === 'upcoming' ? `Starts in ${Math.max(1, Math.round((s.start - Date.now()) / 60000))} min` : 'Completed'}</dd><dt>Location</dt><dd>${esc(zone(s.zone).label)}</dd><dt>Host</dt><dd>${esc(s.host)}${DATA.meta.sessionsAreSample ? ' (sample)' : ''}</dd><dt>Format</dt><dd>${esc(s.type)} · ${s.mins} min</dd>${s.seats ? `<dt>Seats</dt><dd>${s.seats} per group</dd>` : ''}</dl></div>
      <div class="modal-actions"><button class="btn ${att ? 'btn-ghost' : 'btn-gold'}" data-action="mark-attended" data-id="${s.id}">${ic('check')} ${att ? 'Attended — added to passport' : 'I attended this session'}</button><button class="btn btn-ghost" data-action="ask" data-q="Tell me about ${esc(s.title)}">${ic('ask')} Ask Cleared for Takeoff</button></div>
      ${DATA.meta.sessionsAreSample ? `<p class="disclaimer">${ic('alert')}<span>Session times and hosts are sample data.</span></p>` : ''}</div>` });
}
function openNews(id) {
  const n = getNews(id); if (!n) return; const t = getTrack(n.track);
  openModal({ colors: CAT_COLORS[n.cat], icon: 'news', title: n.title, labels: `<span class="pill">${esc(CAT_LABEL[n.cat])}</span>${sample(DATA.meta.newsIsSample, 'Sample content · not live news')}`, body: `
    <div><section><h4>Summary</h4><p>${esc(n.summary)}</p></section><section><h4>Key points</h4><ul>${n.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section></div>
    <div><div class="side-box"><dl class="kv"><dt>Category</dt><dd>${esc(CAT_LABEL[n.cat])}</dd><dt>Published</dt><dd>${daysAgo(n.days)}</dd><dt>Reading</dt><dd>${n.mins} min</dd><dt>Source</dt><dd>Cleared for Takeoff Editorial</dd></dl></div>
      <div class="side-box"><h4>Learn more</h4><div class="q-list"><button class="chip" data-action="open-track" data-id="${t.id}">${ic(t.icon)}${esc(t.title)}</button></div></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-action="ask" data-q="Tell me more about ${esc(n.title)}">${ic('ask')} Ask Cleared for Takeoff about this</button></div>
      ${DATA.meta.newsIsSample ? `<p class="disclaimer">${ic('alert')}<span>Curated illustrative summary created for this prototype. It is not a live news article and has no external source link.</span></p>` : ''}</div>` });
}
function openQRDest() {
  const p = state.passport, j = state.journey; if (!p || !j) return;
  const live = /^https?:/.test(p.qrText) && !p.qrText.startsWith('https://example.com');
  openModal({ colors: ['#b8862b', '#46d2ff'], icon: 'qr', title: 'Your journey on your phone', labels: live ? '' : '<span class="demo-label">Offline preview</span>', single: true, body: `
    <div class="phone"><div class="phone-screen"><div class="phone-bar">${ic('shield')}<span>${esc(p.qrText.split('#')[0])}</span></div>
      <div class="phone-c"><div class="eyebrow">Cleared for Takeoff · My Journey</div><h4>${esc(j.primary.title)}</h4><p class="small" style="color:var(--text-2)">${esc(j.levelName)} level · ${esc(j.code)}</p>
      ${j.stages.map((s, i) => `<div class="pst"><span class="stage-num" style="width:1.6rem;height:1.6rem;font-size:.8rem">${i + 1}</span><div><b>${esc(s.label.toUpperCase())}</b>${s.courses.map(c => esc(c.title)).join(' · ')}</div></div>`).join('')}
      </div></div></div>
    <p class="disclaimer" style="justify-content:center">${ic('info')}<span>${live ? 'Scanning the passport QR code opens this page on the visitor’s phone, with links to every recommended course.' : 'The page is opened from disk, so the QR code uses a placeholder address. Deploy the app (or set PUBLIC_BASE_URL) for working links.'} The link contains only the journey code, track, level and course codes — never a name, email or photo.</span></p>` });
}

/* =====================================================================
   SIMULATED AI ASSISTANT
   ===================================================================== */
const norm = s => ' ' + String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9&'\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const kw = (t, list) => list.some(k => t.includes(' ' + k + ' '));
const P = text => ['p', text], UL = items => ['ul', items], NOTE = text => ['note', text];
const ROLE_WORDS = { gov: ['government employee', 'public sector', 'civil servant', 'government officer', 'work in government', 'work for the government'], tech: ['technology professional', 'developer', 'engineer', 'software', 'it professional', 'data scientist', 'architect', 'programmer'], student: ['student', 'studying', 'university', 'graduate'], leader: ['business leader', 'manager', 'executive', 'ceo', 'founder', 'director', 'leader'] };
const ROLE_RECO = { gov: ['gov', 'agentic'], tech: ['agentic', 'cyber'], student: ['agentic', 'emerging'], leader: ['gov', 'emerging'], other: ['agentic', 'cx'] };
const TOPIC_TRACK = [[['agent', 'agents', 'agentic'], 'agentic'], [['security', 'cyber', 'cybersecurity', 'deepfake', 'deepfakes'], 'cyber'], [['customer', 'customers', 'experience', 'cx'], 'cx'], [['data', 'analytics', 'forecasting'], 'data'], [['government', 'public', 'services'], 'gov'], [['future', 'emerging', 'quantum', 'innovation'], 'emerging']];
const detectRole = t => Object.keys(ROLE_WORDS).find(r => kw(t, ROLE_WORDS[r]));

const R = {
  welcome: () => ({ blocks: [P('Hello! Welcome to Agentic AI: Cleared for Takeoff — I’m your AI guide to the GDRFA booth. Ask me about Agentic AI, today’s sessions or the demos around you — or let me build your personalised learning journey.')], actions: [{ label: 'Start My AI Journey', action: 'start-journey', gold: true }] }),
  greet: () => ({ blocks: [P('Hello and welcome to the GDRFA booth at GITEX! I can explain Agentic AI, show you today’s sessions and demos, recommend a learning track, or create your Agentic AI Passport.')], follow: DATA.defaultSuggestions }),
  thanks: () => ({ blocks: [P('You’re welcome! Enjoy the booth — and don’t forget to collect your Agentic AI Passport before you leave.')], actions: [{ label: 'Create my passport', action: 'start-journey', gold: true }], follow: ['What sessions are happening today?', 'What demos are available at the GDRFA booth?'] }),
  agentic: () => ({ blocks: [P('Agentic AI describes AI systems that can pursue a goal with a degree of autonomy. Instead of only answering a question, an agent plans the steps, uses tools and data, takes actions and checks the result — while people set the goals and stay in control.'),
    UL(['Perceive — understand the request and its context', 'Plan — break the goal into steps', 'Act — use tools, systems and data', 'Reflect — check results and ask a human when unsure']),
    P('In government, that could mean an assistant that not only explains a service, but also pre-checks an application and tells you exactly what is missing (illustrative example).')],
    actions: [{ label: 'Agentic AI Foundations track', action: 'open-track', id: 'agentic' }, { label: 'See the Knowledge Assistant demo', action: 'open-demo', id: 'knowledge' }],
    follow: ['How is Agentic AI different from Generative AI?', 'What demos are available at the GDRFA booth?', 'Which learning track is right for me?'] }),
  genVsAgentic: () => ({ blocks: [P('Generative AI creates content — text, images or code — in response to a prompt. Agentic AI uses generative models as a building block and adds goals, planning, memory and tool use, so it can complete multi-step tasks.'),
    UL(['Generative AI: answers and creates', 'Agentic AI: plans, acts and checks its own work', 'Both: need good data, clear guardrails and human oversight'])],
    actions: [{ label: 'Agentic AI Foundations', action: 'open-track', id: 'agentic' }], follow: ['What is Agentic AI?', 'Can I build my own AI agent at the booth?', 'What are the latest AI developments in government?'] }),
  news(t) {
    const map = [[['government', 'public', 'gov'], 'gov'], [['research', 'study', 'studies', 'publication', 'publications', 'paper', 'papers'], 'research'], [['event', 'events', 'conference', 'conferences', 'gitex'], 'events'], [['emerging', 'future', 'quantum', 'twin', 'twins', 'edge'], 'emerging'], [['agentic', 'agent', 'agents'], 'agentic']];
    const cat = (map.find(([k]) => kw(t, k)) || [])[1];
    const items = DATA.news.filter(n => !cat || n.cat === cat).sort((a, b) => a.days - b.days).slice(0, 3);
    return { blocks: [P(cat ? `Here are the latest ${CAT_LABEL[cat]} highlights from the Cleared for Takeoff feed:` : 'Here are the latest highlights from the Cleared for Takeoff feed:'), UL(items.map(n => `${n.title} — ${n.summary.split('. ')[0].replace(/\.$/, '')}.`)), ...(DATA.meta.newsIsSample ? [NOTE('Curated sample content — not live news.')] : [])],
      actions: [{ label: 'Open Latest AI News', action: 'nav', view: 'news' }, { label: 'Read: ' + items[0].title.slice(0, 38) + '…', action: 'open-news', id: items[0].id }],
      follow: ['What is Agentic AI?', 'What demos are available at the GDRFA booth?', 'Which learning track is right for me?'] };
  },
  demos: () => ({ blocks: [P('There are six experiences around the GDRFA booth:'), UL(DATA.demos.map(d => `${d.title} — ${zone(d.zone).label} · ${d.status}`)), ...(DATA.meta.demosAreIllustrative ? [NOTE('Illustrative capabilities for demonstration; not all are deployed GDRFA services.')] : [])],
    actions: [{ label: 'Explore Demos', action: 'nav', view: 'demos' }, { label: 'Open Knowledge Assistant', action: 'open-demo', id: 'knowledge' }],
    follow: ['How does the knowledge assistant avoid wrong answers?', 'How is privacy protected in the border experience?', 'Where is the Innovation Studio?'] }),
  sessions(t) {
    const ss = sessionsWithStatus(), types = ['workshop', 'keynote', 'panel', 'talk', 'showcase'], ty = types.find(x => kw(t, [x, x + 's']));
    const list = ty ? ss.filter(s => s.type.toLowerCase() === ty) : ss;
    const live = list.find(s => s.status === 'live'), up = list.filter(s => s.status === 'upcoming').slice(0, 3), blocks = [];
    if (live) blocks.push(P(`Live now: “${live.title}” — ${sessRange(live)} at ${zone(live.zone).label}.`)); else if (ty) blocks.push(P(`No ${ty} is running right now.`));
    if (up.length) blocks.push(P(ty ? `Upcoming ${ty}s:` : 'Coming up next:'), UL(up.map(s => `${fmtTime(s.start)} · ${s.title} — ${zone(s.zone).label}`)));
    if (!live && !up.length) blocks.push(P(`All ${ty || 'session'}s have finished for today — but every demo is still open to explore.`));
    if (DATA.meta.sessionsAreSample) blocks.push(NOTE('Sample schedule.'));
    const first = up[0] || live;
    return { blocks, actions: [{ label: 'Open Live Sessions', action: 'nav', view: 'sessions' }, ...(first ? [{ label: 'Details: ' + first.title.slice(0, 30) + (first.title.length > 30 ? '…' : ''), action: 'open-session', id: first.id }] : [])],
      follow: [first ? 'Tell me about ' + first.title : 'What demos are available at the GDRFA booth?', 'When is the next workshop?', 'Which learning track is right for me?'] };
  },
  where: () => ({ blocks: [P('The booth is organised into five areas:'), UL(DATA.booth.zones.map(z => `${z.label}${DATA.demos.filter(d => d.zone === z.id).length ? ' — ' + DATA.demos.filter(d => d.zone === z.id).map(d => DEMO_SHORT[d.id]).join(', ') : ' — talks, keynotes and panels'}`))],
    actions: [{ label: 'Open booth map', action: 'nav', view: 'sessions' }], follow: ['What sessions are happening today?', 'What demos are available at the GDRFA booth?'] }),
  recoAsk(t) {
    const topic = TOPIC_TRACK.find(([k]) => kw(t, k));
    if (topic) { const tr = getTrack(topic[1]); return { blocks: [P(`For that topic, I recommend “${tr.title}” (${tr.level}, ${tr.duration}). ${tr.desc}`), UL(tr.modules.slice(0, 3))], actions: [{ label: 'Explore ' + tr.title, action: 'open-track', id: tr.id }, { label: 'Personalise my journey', action: 'start-journey', gold: true }], follow: ['Which learning track is right for me?', 'What sessions are happening today?'] }; }
    return { blocks: [P('Happy to help you choose! Tell me a little about yourself — which of these describes you best? Or build a full personalised roadmap with the AI Journey.')],
      actions: [{ label: 'Personalise with the AI Journey', action: 'start-journey', gold: true }],
      follow: ['I’m a government employee', 'I’m a technology professional', 'I’m a student', 'I’m a business leader'] };
  },
  recoRole(role) {
    const [a, b] = ROLE_RECO[role].map(getTrack), label = byId(DATA.roles, role).label.toLowerCase();
    return { blocks: [P(`As a ${label}, I’d suggest starting with “${a.title}” (${a.level}) and following up with “${b.title}”.`),
      UL([`${a.title}: ${a.desc}`, `${b.title}: ${b.desc}`]), P('For a roadmap tailored to your experience and interests, try the AI Journey — it takes under two minutes.')],
      actions: [{ label: a.title, action: 'open-track', id: a.id }, { label: b.title, action: 'open-track', id: b.id }, { label: 'Start My AI Journey', action: 'start-journey', gold: true }],
      follow: ['What sessions are happening today?', 'What is the Agentic AI Passport?'] };
  },
  tracksList: () => ({ blocks: [P('Cleared for Takeoff offers six learning tracks:'), UL(DATA.tracks.map(t => `${t.title} — ${t.level}`))], actions: [{ label: 'View Learning Tracks', action: 'nav', view: 'tracks' }, { label: 'Find my track', action: 'start-journey', gold: true }], follow: ['Which learning track is right for me?', 'Tell me about the Cybersecurity in the AI Era track'] }),
  passport: () => ({ blocks: [P('The Agentic AI Passport is a personalised digital pass created at the end of your AI Journey. It shows your name, your photo or avatar, your recommended learning track, your level — Explorer, Practitioner or Innovator — any session you attended, and a QR code that opens your course list on your phone.'), P('You can download it as an image and see yourself welcomed on the big screen.'), NOTE('Your name and photo stay on this kiosk and are cleared on reset. It is a keepsake, not an official document.')],
    actions: state.passport ? [{ label: 'View my passport', action: 'nav', view: 'journey' }] : [{ label: 'Create my passport', action: 'start-journey', gold: true }], follow: ['How does Cleared for Takeoff personalise my journey?', 'Is my data stored?'] }),
  bigscreen: () => ({ blocks: [P('After creating your passport, tap “Show on Big Screen” to see an 8-second welcome animation with your avatar, your name and your learning track. You will always be asked to confirm first, because it may be visible to people nearby.')], actions: [{ label: 'Start My AI Journey', action: 'start-journey', gold: true }], follow: ['What is the Agentic AI Passport?', 'Is my data stored?'] }),
  journey: () => ({ blocks: [P('Your AI Journey is built from three answers: your role, your experience with AI and your interests. An AI recommender (Claude, by Anthropic) matches them to a primary learning track and picks real courses for your level from a curated catalogue:'), UL(['Discover — a topic to explore, introductory courses and a demo to visit', 'Learn — core courses and a session to join', 'Practice — hands-on courses or labs', 'Innovate — a stretch course and a practical next step for your work']), NOTE('Only your three answers are used — never your name, email or photo. If the AI service is unavailable, transparent rules on this kiosk build the journey instead.')],
    actions: [{ label: 'Start My AI Journey', action: 'start-journey', gold: true }], follow: ['What is the Agentic AI Passport?', 'Which learning track is right for me?'] }),
  privacy: () => ({ blocks: [P('Privacy first:'), UL(['Your name, email and photo stay in this kiosk’s memory and are never sent anywhere', 'To recommend courses, only your role, AI experience and interests are sent to the course recommender (powered by Claude)', 'Nothing is saved to browser storage', `Everything is cleared when you press Reset, or after ${CONFIG.idleResetSeconds} seconds of inactivity`])], follow: ['What is the Agentic AI Passport?', 'How does Cleared for Takeoff personalise my journey?'] }),
  about: () => ({ blocks: [P('GDRFA — the General Directorate of Residency and Foreigners Affairs in Dubai — oversees residency, entry permits and related services. At GITEX, the booth explores how Agentic AI could make such services more proactive and seamless.'), NOTE('For official services and information, please use GDRFA’s official channels. This assistant is a demo.')], follow: ['What demos are available at the GDRFA booth?', 'What is Agentic AI?'] }),
  help: () => ({ blocks: [P('I’m the booth assistant for Agentic AI: Cleared for Takeoff. I answer from the booth’s content and course catalogue, and I can help you:'), UL(['Understand Agentic AI and Generative AI', 'Find today’s sessions and booth demos', 'Choose a learning track', 'Create your personalised AI Journey and Passport'])], follow: DATA.defaultSuggestions }),
  demo(d, t) {
    const where = kw(t, ['where', 'location', 'find', 'located']);
    const blocks = where ? [P(`${d.title} is in ${zone(d.zone).label}. ${d.overview}`)] : [P(`${d.title} — ${zone(d.zone).label} · ${d.status}.`), P(d.overview), P('How it works:'), UL(d.how)];
    if (!d.live && DATA.meta.demosAreIllustrative) blocks.push(NOTE('Illustrative capability — not necessarily a deployed GDRFA service.'));
    return { blocks, actions: [{ label: 'Open demo details', action: 'open-demo', id: d.id }, { label: getTrack(d.tracks[0]).title, action: 'open-track', id: d.tracks[0] }], follow: d.questions.filter(q => norm(q) !== t).slice(0, 3) };
  },
  session(s0) {
    const s = sessWithStatus(s0.id), st = s.status === 'live' ? 'Live now' : s.status === 'upcoming' ? 'Upcoming' : 'Completed';
    return { blocks: [P(`“${s.title}” — ${s.type}, ${sessRange(s)} at ${zone(s.zone).label} (${st}).`), P(s.desc), UL(s.agenda), ...(DATA.meta.sessionsAreSample ? [NOTE('Sample schedule.')] : [])],
      actions: [{ label: 'Session details', action: 'open-session', id: s.id }, { label: getTrack(s.track).title, action: 'open-track', id: s.track }], follow: ['What sessions are happening today?', 'What demos are available at the GDRFA booth?'] };
  },
  track: tr => ({ blocks: [P(`“${tr.title}” — ${tr.level} · ${tr.duration}.`), P(tr.desc), P('Recommended courses:'), UL(RULES.LEVELS.map(l => `${LEVEL_LABEL[l]}: ${CATALOG.courses.filter(c => c.tracks.includes(tr.id) && c.level === l).map(c => `${c.title} (${c.provider})`).join('; ') || 'see the neighbouring levels'}`))],
    actions: [{ label: 'Explore track', action: 'open-track', id: tr.id }, { label: 'Personalise my journey', action: 'personalize', id: tr.id, gold: true }], follow: ['Which learning track is right for me?', 'What sessions are happening today?'] }),
  newsItem: n => ({ blocks: [P(n.title), P(n.summary), UL(n.points), ...(DATA.meta.newsIsSample ? [NOTE('Curated sample content — not live news.')] : [])], actions: [{ label: 'Open article summary', action: 'open-news', id: n.id }], follow: ['What are the latest AI developments in government?', 'What is Agentic AI?'] }),
  courses(t) {
    const lvlWord = [['beginner', ['beginner', 'beginners', 'new', 'start', 'basics', 'introductory']], ['intermediate', ['intermediate', 'some experience']], ['advanced', ['advanced', 'expert', 'experts', 'deep']]].find(([, w]) => kw(t, w));
    const topic = TOPIC_TRACK.find(([k]) => kw(t, k));
    const tr = getTrack(topic ? topic[1] : 'agentic');
    const levels = lvlWord ? [lvlWord[0]] : RULES.LEVELS;
    const list = levels.map(l => [l, CATALOG.courses.filter(c => c.tracks.includes(tr.id) && c.level === l)]);
    return { blocks: [P(`Courses for ${tr.title}${lvlWord ? ` at ${lvlWord[0]} level` : ''}:`), UL(list.flatMap(([l, cs]) => cs.map(c => `${c.title} — ${c.provider} (${LEVEL_LABEL[l]}, ≈${fmtHours(c.hours)})`))), P('Tap a course in the Learning Tracks screen to get a QR code for your phone, or build a personalised journey.')],
      actions: [{ label: 'Open ' + tr.title, action: 'open-track', id: tr.id }, { label: 'Personalise my journey', action: 'personalize', id: tr.id, gold: true }], follow: ['Which learning track is right for me?', 'What is Agentic AI?'] };
  },
  fallback: () => ({ blocks: [P('I don’t have a confident answer to that in my demo knowledge base yet. I can help with Agentic AI basics, today’s sessions, the booth demos, learning tracks or your personalised journey.')], follow: DATA.defaultSuggestions })
};
function matchEntity(t) {
  const typeBonus = { demo: kw(t, ['demo', 'demos']) ? 3 : 0, session: kw(t, ['session', 'sessions', 'talk']) ? 3 : 0, track: kw(t, ['track', 'tracks', 'course']) ? 3 : 0, news: kw(t, ['news', 'article']) ? 3 : 0 };
  const cands = [
    ...DATA.demos.map(d => ({ type: 'demo', item: d, keys: d.keywords })),
    ...DATA.sessions.map(s => ({ type: 'session', item: s, keys: s.keywords })),
    ...DATA.tracks.map(tr => ({ type: 'track', item: tr, keys: { agentic: ['agentic ai foundations', 'foundations'], gov: ['ai for government services', 'government services track'], cyber: ['cybersecurity', 'cyber security', 'cyber', 'deepfake', 'deepfakes'], cx: ['customer experience'], data: ['data & analytics', 'data and analytics', 'data analytics'], emerging: ['emerging technology', 'emerging tech', 'quantum', 'digital twin', 'digital twins'] }[tr.id] })),
    ...DATA.news.map(n => ({ type: 'news', item: n, keys: [] }))
  ];
  let best = null, bestS = 0;
  cands.forEach((c, i) => {
    let s = t.includes(norm(c.item.title)) ? 20 : 0;
    c.keys.forEach(k => { if (t.includes(' ' + k + ' ')) s += 2 * k.split(' ').length; });
    if (s) s += typeBonus[c.type];
    if (s > bestS) { bestS = s; best = c; }
  });
  if (!best || bestS < 2) return null;
  return best.type === 'demo' ? R.demo(best.item, t) : best.type === 'session' ? R.session(best.item) : best.type === 'track' ? R.track(best.item) : R.newsItem(best.item);
}
const STOP = new Set('a an the and or of to in on for is are was be with what which who how when where why can i me my you your it this that about tell more do does at from by as we our'.split(' '));
function searchAnswer(t) {
  const toks = t.trim().split(' ').filter(w => w.length > 2 && !STOP.has(w)); if (!toks.length) return null;
  const docs = [...DATA.demos.map(d => ['demo', d, d.title + ' ' + d.overview]), ...DATA.sessions.map(s => ['session', s, s.title + ' ' + s.desc]), ...DATA.tracks.map(tr => ['track', tr, tr.title + ' ' + tr.desc + ' ' + tr.modules.join(' ')]), ...DATA.news.map(n => ['news', n, n.title + ' ' + n.summary])];
  let best = null, bestS = 0;
  docs.forEach(([type, item, text]) => { const d = norm(text); const s = toks.filter(w => d.includes(' ' + w + ' ') || d.includes(' ' + w.replace(/s$/, '') + ' ')).length; if (s > bestS) { bestS = s; best = [type, item]; } });
  if (bestS < 2) return null;
  const [type, item] = best; return type === 'demo' ? R.demo(item, t) : type === 'session' ? R.session(item) : type === 'track' ? R.track(item) : R.newsItem(item);
}
function answer(q) {
  const t = norm(q), words = t.trim().split(' ');
  if (/^ (hi|hello|hey|salam|salaam|marhaba|good morning|good afternoon|good evening)\b/.test(t) && words.length <= 4) return R.greet();
  if (kw(t, ['thank', 'thanks', 'thank you', 'shukran'])) return R.thanks();
  if (kw(t, ['difference', 'different', 'vs', 'versus', 'compared', 'compare']) && kw(t, ['generative', 'genai', 'gen ai', 'llm', 'chatgpt', 'chatbot', 'chatbots'])) return R.genVsAgentic();
  if (kw(t, ['what is agentic', 'what is agentic ai', 'what is an ai agent', 'what are ai agents', 'define agentic', 'explain agentic', 'meaning of agentic', 'what does agentic', 'agentic ai mean'])) return R.agentic();
  if (kw(t, ['passport'])) return R.passport();
  if (kw(t, ['big screen', 'show my name', 'on screen'])) return R.bigscreen();
  if (kw(t, ['personalise', 'personalize', 'personalised', 'personalized', 'personalises', 'personalizes', 'my journey', 'ai journey', 'roadmap', 'learning journey'])) return R.journey();
  if (kw(t, ['course', 'courses', 'class', 'classes', 'certificate', 'certification'])) return R.courses(t);
  const role = detectRole(t);
  if (role && kw(t, ['start', 'track', 'learn', 'recommend', 'should', 'begin', "i'm", 'im', 'i am', 'am'])) return R.recoRole(role);
  if (kw(t, ['which track', 'which learning track', 'right for me', 'recommend', 'recommend a track', 'where should i start', 'where do i start', 'what should i learn', 'suggest a track', 'best track'])) return R.recoAsk(t);
  const ent = matchEntity(t);
  if (kw(t, ['privacy', 'my data', 'data stored', 'store my', 'personal data', 'is my data', 'stored', 'gdpr']) && (!ent || kw(t, ['my data', 'is my data', 'stored']))) return R.privacy();
  if (ent) return ent;
  if (kw(t, ['session', 'sessions', 'talk', 'talks', 'schedule', 'agenda', 'workshop', 'workshops', 'keynote', 'panel', 'happening', 'today', 'live now', 'showcase'])) return R.sessions(t);
  if (kw(t, ['demo', 'demos', 'demonstration', 'demonstrations', 'exhibit', 'exhibits', 'booth', 'see'])) return R.demos();
  if (kw(t, ['news', 'latest', 'developments', 'development', 'trend', 'trends', 'update', 'updates', 'research', 'publication', 'publications'])) return R.news(t);
  if (kw(t, ['where', 'zone', 'zones', 'map', 'location', 'located'])) return R.where();
  if (kw(t, ['track', 'tracks', 'learning', 'learn'])) return R.tracksList();
  if (kw(t, ['agentic', 'agent', 'agents'])) return R.agentic();
  if (kw(t, ['gdrfa', 'residency', 'directorate', 'visa', 'visas'])) return R.about();
  if (kw(t, ['what can you do', 'help', 'who are you', 'how does this work', 'how do you work'])) return R.help();
  return searchAnswer(t) || R.fallback();
}

function chatInit() {
  const node = $('#chatTpl').content.firstElementChild.cloneNode(true); hydrateIcons(node); $('#chatDock').appendChild(node);
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#chatInput').value; if (state.chat.busy) { toast('One moment — the assistant is still answering.'); return; } $('#chatInput').value = ''; updateSend(); sendQuestion(v); });
  $('#chatInput').addEventListener('input', updateSend);
  chatWelcome();
}
function updateSend() { $('#chatSend').disabled = state.chat.busy || !$('#chatInput').value.trim(); }
function scrollChat() { const l = $('#chatLog'); if (l) l.scrollTop = l.scrollHeight; }
function chatWelcome() { state.chat.epoch++; state.chat.busy = false; $('#chatLog').innerHTML = ''; appendBot(R.welcome(), false, state.chat.epoch); setSuggestions(DATA.defaultSuggestions); updateSend(); }
function setSuggestions(list) { $('#chatSuggest').innerHTML = (list || []).map(q => `<button class="chip" data-action="ask" data-q="${esc(q)}" data-inchat="1">${esc(q)}</button>`).join(''); }
async function streamInto(el, text, animate, epoch) {
  if (!animate || REDUCED) { el.textContent = text; return; }
  for (let i = 0; i < text.length; i += 4) { if (epoch !== state.chat.epoch) return; el.textContent = text.slice(0, i + 4); scrollChat(); await wait(14); }
  el.textContent = text;
}
async function appendBot(reply, animate, epoch) {
  const b = document.createElement('div'); b.className = 'msg bot'; $('#chatLog').appendChild(b);
  for (const [type, val] of reply.blocks) {
    if (epoch !== state.chat.epoch) return;
    if (type === 'p') { const p = document.createElement('p'); b.appendChild(p); await streamInto(p, val, animate, epoch); }
    else if (type === 'ul') { const ul = document.createElement('ul'); b.appendChild(ul); for (const it of val) { const li = document.createElement('li'); ul.appendChild(li); await streamInto(li, it, animate, epoch); } }
    else if (type === 'note') { const n = document.createElement('div'); n.className = 'note'; n.textContent = '⚠ ' + val; b.appendChild(n); }
  }
  if (reply.actions && reply.actions.length) {
    const wrap = document.createElement('div'); wrap.className = 'msg-actions';
    reply.actions.forEach(a => { const btn = document.createElement('button'); btn.className = 'btn btn-sm ' + (a.gold ? 'btn-gold' : 'btn-ghost'); btn.dataset.action = a.action; if (a.id) btn.dataset.id = a.id; if (a.view) btn.dataset.view = a.view; btn.textContent = a.label; wrap.appendChild(btn); });
    b.appendChild(wrap);
  }
  scrollChat();
}
async function sendQuestion(raw) {
  const q = cleanText(raw, 240);
  if (!q) return;
  if (state.chat.busy) { toast('One moment — the assistant is still answering.'); return; }
  const epoch = state.chat.epoch; state.chat.busy = true; updateSend();
  const u = document.createElement('div'); u.className = 'msg user'; u.textContent = q; $('#chatLog').appendChild(u);
  setSuggestions([]);
  const typing = document.createElement('div'); typing.className = 'msg bot typing'; typing.setAttribute('aria-label', 'The assistant is typing'); typing.innerHTML = '<i></i><i></i><i></i>'; $('#chatLog').appendChild(typing); scrollChat();
  const reply = answer(q);
  await wait(REDUCED ? 150 : 900);
  if (epoch !== state.chat.epoch) return;
  typing.remove();
  await appendBot(reply, true, epoch);
  if (epoch !== state.chat.epoch) return;
  state.chat.busy = false; updateSend(); setSuggestions(reply.follow || DATA.defaultSuggestions); scrollChat();
}

/* =====================================================================
   JOURNEY ENGINE
   When the kiosk is served by the API server, POST /api/recommend asks the
   Claude-powered recommender for a plan; otherwise (or on any failure) the
   shared offline rules build it. Either way the plan is validated against
   the catalogue with RULES.sanitizePlan before it is shown.
   Only the three answers are sent — never name, email or photo.
   ===================================================================== */
const STAGES = RULES.STAGES;
const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const COST_LABEL = { free: 'Free', membership: 'Membership', varies: 'Free and paid options' };
const getCourse = id => byId(CATALOG.courses, id);
const fmtHours = h => h < 1 ? `${Math.round(h * 60)} min` : `${h} h`;
const sessionStatusList = () => sessionsWithStatus().map(s => ({ id: s.id, status: s.status }));
const rulesCtx = () => ({ content: DATA, catalog: CATALOG, sessions: sessionStatusList() });
const profileFromWizard = w => ({ role: w.role, experience: w.experience, interests: [...w.interests], ...(w.focusTrack ? { focusTrack: w.focusTrack } : {}) });

async function requestPlan(profile) {
  const offline = () => ({ plan: RULES.buildRulesPlan(profile, rulesCtx()), source: 'rules' });
  if (!CONFIG.served || !CONFIG.aiEnabled) return offline();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.aiTimeoutMs + 5000);
  try {
    const res = await fetch('api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profile, sessions: sessionStatusList() }), signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const { plan } = RULES.sanitizePlan(data.plan, profile, rulesCtx());
    return { plan, source: data.source === 'ai' ? 'ai' : 'rules' };
  } catch (e) {
    return offline();
  } finally {
    clearTimeout(timer);
  }
}
function hydratePlan(plan, profile, source) {
  const lvl = RULES.levelIndex(DATA, profile.experience), sessions = sessionsWithStatus();
  const stages = plan.stages.map(s => {
    const demo = getDemo(s.experienceId), sess = sessions.find(x => x.id === s.experienceId);
    const exp = demo ? { kind: 'demo', id: demo.id, title: demo.title, meta: zone(demo.zone).label }
      : { kind: 'session', id: sess.id, title: sess.title, meta: `${fmtTime(sess.start)} · ${zone(sess.zone).label}` };
    return { key: s.stage, label: cap(s.stage), topic: s.topic, courses: s.courseIds.map(getCourse).filter(Boolean), why: s.why, exp, next: s.nextStep };
  });
  return {
    profile, plan, source, primary: getTrack(plan.primaryTrack), secondary: getTrack(plan.secondaryTrack),
    level: lvl, levelName: DATA.levels[lvl], stages, summary: plan.summary,
    code: 'CFT-' + hashStr(JSON.stringify(plan) + Date.now()).toString(36).toUpperCase().slice(0, 5).padStart(5, '0')
  };
}
function journeyLink(j) {
  const base = CONFIG.publicBaseUrl || (CONFIG.served ? location.origin + location.pathname.replace(/[^/]*$/, '') : 'https://example.com/cleared-for-takeoff/');
  const q = new URLSearchParams({ v: '1', j: j.code, t: j.primary.id, l: String(j.level), c: j.stages.map(s => s.courses.map(c => c.ref).join('.')).join('-') });
  return base.replace(/\/?$/, '/') + 'journey.html#' + q.toString();
}
function courseRow(c) {
  return `<button class="course-btn" data-action="open-course" data-id="${c.id}">${ic('tracks')}<span><b>${esc(c.title)}</b><em>${esc(c.provider)} · ${LEVEL_LABEL[c.level]} · ≈${fmtHours(c.hours)}</em></span>${ic('qr')}</button>`;
}
function roadmapHTML(j) {
  return `<div class="roadmap">${j.stages.map((s, i) => `
    <div class="stage ${s.key}"><div class="stage-head"><div class="stage-num">${i + 1}</div><h4>${s.label}</h4></div>
      <div><div class="stage-sec">Recommended topic</div><div class="stage-topic">${esc(s.topic)}</div></div>
      <div><div class="stage-sec">Recommended courses</div>${s.courses.map(courseRow).join('')}<p class="why">${esc(s.why)}</p></div>
      <div><div class="stage-sec">Suggested ${s.exp.kind}</div><button class="exp-btn" data-action="open-${s.exp.kind}" data-id="${s.exp.id}">${ic(s.exp.kind === 'demo' ? 'demos' : 'sessions')}<span>${esc(s.exp.title)}<em class="small" style="display:block;font-style:normal">${esc(s.exp.meta)}</em></span></button></div>
      <div><div class="stage-sec">Practical next step</div><div class="next-step">${esc(s.next)}</div></div>
    </div>`).join('')}</div>`;
}
function journeySummaryHTML(j) {
  return `<div class="j-summary"><div class="level-badge"><small>Level</small><b>${esc(j.levelName)}</b></div><div style="flex:1;min-width:16rem"><div class="eyebrow">${ic('spark')} Your personalised learning journey · ${esc(j.code)}</div><div class="source-line">${j.source === 'ai' ? `<span class="pill ai-pill">${ic('spark')}Courses recommended by Claude · Anthropic</span>` : `<span class="pill">${ic('shield')}Courses matched on this kiosk</span>`}</div><h3>${esc(j.primary.title)} <span>· ${esc(j.levelName)}</span></h3><p>${esc(j.summary)}</p></div></div>`;
}

/* =====================================================================
   WIZARD
   ===================================================================== */
const WIZ_STEPS = ['About You', 'Interests', 'Generate', 'Your Journey', 'Passport'];
function openWizard(opts = {}) {
  const w = state.wizard;
  if (opts.trackId) { const tr = getTrack(opts.trackId); w.interests = Array.from(new Set([...w.interests, ...tr.interests])); w.focusTrack = tr.id; }
  w.step = opts.step || 1; w.open = true;
  hideOverlay('modal'); $('#wizard').classList.add('open'); renderWizard(); updateGlobe();
}
function closeWizard() { stopCamera(); state.wizard.open = false; state.wizard.token++; $('#wizard').classList.remove('open'); updateGlobe(); if (state.view === 'journey') renderJourney(); }
function wizGo(step) { stopCamera(); state.wizard.step = step; renderWizard(); $('#wizBody').scrollTop = 0; }
function renderWizard() {
  const w = state.wizard, cur = Math.min(w.step, 5);
  $('#wizStepper').innerHTML = WIZ_STEPS.map((l, i) => `${i ? '<span class="stp-line"></span>' : ''}<div class="stp ${i + 1 === cur ? 'on' : i + 1 < cur ? 'ok' : ''}"><i>${i + 1 < cur ? '✓' : i + 1}</i><span>${l}</span></div>`).join('');
  const body = $('#wizBody'), foot = $('#wizFoot');
  if (w.step === 1) {
    body.innerHTML = `<div class="q-title">Tell us about yourself</div><p class="q-sub">Two quick questions so we can tailor your journey. Nothing is stored.</p>
      <div class="stage-sec">What best describes your role?</div><div class="opt-grid c5">${DATA.roles.map(r => `<button class="opt${w.role === r.id ? ' sel' : ''}" data-action="wiz-role" data-id="${r.id}" aria-pressed="${w.role === r.id}">${ic(r.icon)}<b>${esc(r.label)}</b><span>${esc(r.desc)}</span></button>`).join('')}</div>
      <div class="stage-sec">What is your experience with AI?</div><div class="opt-grid c3">${DATA.experience.map(e => `<button class="opt${w.experience === e.id ? ' sel' : ''}" data-action="wiz-exp" data-id="${e.id}" aria-pressed="${w.experience === e.id}">${ic(e.icon)}<b>${esc(e.label)}</b><span>${esc(e.desc)}</span></button>`).join('')}</div>`;
    foot.innerHTML = `<button class="btn btn-ghost" data-action="wiz-close">Cancel</button><span class="spacer"></span><span class="hint">${w.role && w.experience ? 'Great — next, your interests' : 'Select one option in each group'}</span><button class="btn btn-primary" data-action="wiz-next" ${w.role && w.experience ? '' : 'disabled'}>Continue ${ic('arrow')}</button>`;
  } else if (w.step === 2) {
    body.innerHTML = `<div class="q-title">Choose your interests</div><p class="q-sub">Select as many as you like — your roadmap adapts to every choice.</p>
      <div class="opt-grid c4">${DATA.interests.map(i => { const on = w.interests.includes(i.id); return `<button class="opt${on ? ' sel' : ''}" data-action="wiz-interest" data-id="${i.id}" aria-pressed="${on}">${ic(i.icon)}<b>${esc(i.label)}</b><span>${esc(i.desc)}</span></button>`; }).join('')}</div>`;
    foot.innerHTML = `<button class="btn btn-ghost" data-action="wiz-back">${ic('chevL')} Back</button><span class="spacer"></span><span class="hint">${w.interests.length ? `${w.interests.length} selected` : 'Select at least one interest'}</span><button class="btn btn-gold" data-action="wiz-generate" ${w.interests.length ? '' : 'disabled'}>${ic('spark')} Generate My Learning Journey</button>`;
  } else if (w.step === 3) {
    const lines = ['Understanding your interests…', 'Identifying relevant AI opportunities…', 'Building your personalized learning journey…'];
    body.innerHTML = `<div class="processing"><div class="proc-radar" aria-hidden="true"></div><div class="proc-lines" role="status">${lines.map((l, i) => `<div class="proc-line" id="pl${i}"><span class="st"></span>${l}</div>`).join('')}</div></div>`;
    foot.innerHTML = `<span class="hint">${CONFIG.served && CONFIG.aiEnabled ? 'Claude is choosing courses for your level — only your three answers are shared.' : 'Matching your answers to courses, demos and sessions on this kiosk…'}</span>`;
    runProcessing();
  } else if (w.step === 4) {
    const j = state.journey;
    body.innerHTML = journeySummaryHTML(j) + roadmapHTML(j) + `<p class="disclaimer">${ic('info')}<span>${j.source === 'ai' ? 'Courses chosen by Claude (Anthropic) from a curated catalogue of publicly available courses, then checked against the catalogue.' : 'Courses matched on this kiosk with transparent rules from a curated catalogue of publicly available courses.'} Tap a course for a QR code to open it on your phone.</span></p>`;
    foot.innerHTML = `<button class="btn btn-ghost" data-action="wiz-edit">${ic('chevL')} Edit answers</button><span class="spacer"></span><button class="btn btn-ghost" data-action="wiz-save">Save & view journey</button><button class="btn btn-gold" data-action="wiz-passport">${ic('passport')} Create My Agentic AI Passport</button>`;
  } else if (w.step === 5) {
    renderPassportForm();
  } else {
    body.innerHTML = `<div class="passport-wrap" style="margin-top:0"><canvas class="passport-canvas" id="ppCanvasWiz" aria-label="Your Agentic AI Passport"></canvas>${passportActionsHTML(true)}</div>`;
    paintPassport($('#ppCanvasWiz'));
    foot.innerHTML = `<button class="btn btn-ghost" data-action="wiz-step" data-id="5">${ic('chevL')} Edit passport</button><span class="spacer"></span><button class="btn btn-primary" data-action="wiz-done">Done ${ic('check')}</button>`;
  }
  hydrateIcons(body);
}
async function runProcessing() {
  const token = ++state.wizard.token;
  const profile = profileFromWizard(state.wizard);
  const planPromise = requestPlan(profile);
  for (let i = 0; i < 3; i++) {
    const el = $('#pl' + i); if (!el || token !== state.wizard.token) return;
    el.classList.add('on');
    // the last step stays "in progress" until the recommendation has arrived
    await (i < 2 ? wait(REDUCED ? 200 : 1150) : Promise.all([planPromise, wait(REDUCED ? 200 : 1150)]));
    if (token !== state.wizard.token) return;
    el.classList.remove('on'); el.classList.add('ok'); el.querySelector('.st').innerHTML = ic('check');
  }
  const { plan, source } = await planPromise;
  if (token !== state.wizard.token || state.wizard.step !== 3) return;
  state.journey = hydratePlan(plan, profile, source);
  if (state.passport) state.passport = buildPassport(state.passport);
  await wait(REDUCED ? 100 : 450);
  if (token !== state.wizard.token || state.wizard.step !== 3) return;
  wizGo(4);
}

/* ---------- passport form ---------- */
function renderPassportForm() {
  const d = state.draft, e = d.errors;
  $('#wizBody').innerHTML = `<div class="q-title">Create Your Agentic AI Passport</div><p class="q-sub">A personalised keepsake of your journey — with a QR code and a moment on the big screen.</p>
    <div class="pp-form"><div>
      <div class="field${e.name ? ' err' : ''}"><label for="ppName">Full name</label><input id="ppName" maxlength="50" autocomplete="off" value="${esc(d.name)}" placeholder="e.g. Aisha Al Mansoori"><div class="msg-err">${esc(e.name || '')}</div></div>
      <div class="field${e.email ? ' err' : ''}"><label for="ppEmail">Email address</label><input id="ppEmail" type="email" maxlength="80" autocomplete="off" inputmode="email" value="${esc(d.email)}" placeholder="name@example.com"><div class="msg-err">${esc(e.email || '')}</div></div>
      <div class="field"><label for="ppOrg">Organization <span>(optional)</span></label><input id="ppOrg" maxlength="50" autocomplete="off" value="${esc(d.org)}" placeholder="Your organization"><div class="msg-err"></div></div>
      <div class="privacy">${ic('shield')}<span><b>Privacy notice:</b> your name, email and photo stay in this kiosk’s memory only — they are never uploaded or saved, and are cleared on reset or after ${CONFIG.idleResetSeconds} seconds of inactivity. Your email is not printed on the passport or included in the QR code.</span></div>
    </div><div>
      <div class="stage-sec">Choose your avatar</div>
      <div class="tabs" role="tablist">${[['preset', 'spark', 'Select avatar'], ['upload', 'upload', 'Upload photo'], ['camera', 'camera', 'Use camera']].map(([id, icn, l]) => `<button class="tab${d.tab === id ? ' active' : ''}" role="tab" aria-selected="${d.tab === id}" data-action="ava-tab" data-id="${id}">${ic(icn)}${l}</button>`).join('')}</div>
      <div id="avaPanel"></div>
      <div class="ava-preview"><canvas id="avaPreview" width="240" height="240" aria-label="Selected avatar preview"></canvas><p id="avaPreviewText"></p></div>
    </div></div>`;
  ['ppName', 'ppEmail', 'ppOrg'].forEach(id => $('#' + id).addEventListener('input', ev => { const k = { ppName: 'name', ppEmail: 'email', ppOrg: 'org' }[id]; state.draft[k] = ev.target.value; if (state.draft.errors[k]) { state.draft.errors[k] = ''; ev.target.closest('.field').classList.remove('err'); ev.target.closest('.field').querySelector('.msg-err').textContent = ''; } }));
  renderAvaPanel();
  $('#wizFoot').innerHTML = `<button class="btn btn-ghost" data-action="wiz-step" data-id="4">${ic('chevL')} Back to journey</button><span class="spacer"></span><span class="hint">Takes about 30 seconds</span><button class="btn btn-gold" data-action="pp-generate">${ic('passport')} Generate Passport</button>`;
}
function renderAvaPanel() {
  const d = state.draft, panel = $('#avaPanel'); if (!panel) return;
  stopCamera();
  if (d.tab === 'preset') {
    panel.innerHTML = `<div class="ava-grid">${DATA.avatars.map(a => `<div><button class="ava-opt${d.avatar.kind === 'preset' && d.avatar.id === a.id ? ' sel' : ''}" data-action="ava-pick" data-id="${a.id}" aria-label="Avatar ${esc(a.name)}"><canvas width="160" height="160" data-ava="${a.id}"></canvas></button><div class="ava-name">${esc(a.name)}</div></div>`).join('')}</div>`;
    $$('canvas[data-ava]', panel).forEach(c => paintAvatarInto(c, { kind: 'preset', id: c.dataset.ava }));
  } else if (d.tab === 'upload') {
    panel.innerHTML = `<button class="upload-zone" data-action="ava-upload">${ic('upload')}<b>Choose a photo from this device</b><span class="small">JPG, PNG or WebP · up to 10 MB · processed locally, never uploaded</span></button>`;
  } else {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    panel.innerHTML = `<div class="cam-box" id="camBox"><video id="camVideo" playsinline muted hidden></video><div class="cam-msg" id="camMsg">${supported ? 'Tap “Start camera” to take a photo. Your browser will ask for permission; the image stays on this device.' : 'Camera capture is not supported in this browser. Please upload a photo or choose an avatar instead.'}</div></div>
      <div class="cam-actions" id="camActions">${supported ? `<button class="btn btn-primary" data-action="cam-start">${ic('camera')} Start camera</button>` : `<button class="btn btn-ghost" data-action="ava-tab" data-id="preset">Choose an avatar</button>`}</div>`;
  }
  hydrateIcons(panel);
  updateAvaPreview();
}
function updateAvaPreview() {
  const c = $('#avaPreview'); if (!c) return; const av = state.draft.avatar;
  paintAvatarInto(c, av);
  $('#avaPreviewText').innerHTML = av.kind === 'photo' ? '<b>Your photo</b><br>Shown on your passport and, only if you confirm, on the big screen.' : `<b>${esc((byId(DATA.avatars, av.id) || DATA.avatars[0]).name)} avatar</b><br>A privacy-friendly alternative to a real photo.`;
}
let camStream = null;
async function startCamera() {
  const msg = $('#camMsg'), video = $('#camVideo');
  try {
    msg.textContent = 'Requesting camera permission…';
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    if (!$('#camVideo')) { stopCamera(); return; }
    video.srcObject = camStream; video.hidden = false; await video.play(); msg.textContent = '';
    $('#camActions').innerHTML = `<button class="btn btn-gold" data-action="cam-capture">${ic('camera')} Capture photo</button><button class="btn btn-ghost" data-action="cam-stop">Cancel</button>`;
  } catch (err) {
    stopCamera();
    const name = err && err.name;
    msg.textContent = name === 'NotAllowedError' ? 'Camera permission was declined. You can upload a photo or choose an avatar instead.' : name === 'NotFoundError' ? 'No camera was found on this device. Please upload a photo or choose an avatar.' : 'The camera could not be started on this device. Please upload a photo or choose an avatar.';
    if ($('#camActions')) $('#camActions').innerHTML = `<button class="btn btn-ghost" data-action="cam-start">Try again</button><button class="btn btn-ghost" data-action="ava-tab" data-id="upload">Upload instead</button>`;
  }
}
function stopCamera() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } const v = $('#camVideo'); if (v) { v.srcObject = null; } }
function capturePhoto() {
  const v = $('#camVideo'); if (!v || !v.videoWidth) { toast('Camera is not ready yet — please try again.'); return; }
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const s = Math.max(S / v.videoWidth, S / v.videoHeight); x.translate(S, 0); x.scale(-1, 1);
  x.drawImage(v, (S - v.videoWidth * s) / 2, (S - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
  stopCamera();
  setPhotoFromCanvas(c, () => { $('#camBox').innerHTML = `<canvas width="512" height="512" id="camShot" style="width:100%;height:100%;object-fit:cover"></canvas>`; $('#camShot').getContext('2d').drawImage(c, 0, 0); $('#camActions').innerHTML = `<button class="btn btn-ghost" data-action="ava-tab" data-id="camera">${ic('camera')} Retake</button>`; });
}
function setPhotoFromCanvas(c, done) {
  const img = new Image();
  img.onload = () => { state.draft.avatar = { kind: 'photo', img }; updateAvaPreview(); if (done) done(); toast('Photo added — it stays on this device only.'); };
  img.onerror = () => toast('That image could not be processed. Please try another photo.');
  img.src = c.toDataURL('image/jpeg', .9);
}
function handleFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast('Please choose a JPG, PNG or WebP image.'); return; }
  if (file.size > 10 * 1024 * 1024) { toast('That image is larger than 10 MB. Please choose a smaller photo.'); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; coverDraw(c.getContext('2d'), img, 0, 0, S, S); URL.revokeObjectURL(url);
    setPhotoFromCanvas(c, () => { const p = $('#avaPanel .upload-zone'); if (p) p.querySelector('b').textContent = 'Photo selected — tap to choose a different one'; });
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('That image could not be opened. Please try another photo.'); };
  img.src = url;
}
function validateDraft() {
  const d = state.draft, errors = {};
  d.name = cleanText(d.name, 50); d.email = cleanText(d.email, 80); d.org = cleanText(d.org, 50);
  if (d.name.length < 2) errors.name = 'Please enter your name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) errors.email = 'Please enter a valid email address.';
  d.errors = errors; return !Object.keys(errors).length;
}
function buildPassport(prev) {
  const d = state.draft, j = state.journey;
  return {
    name: d.name, email: d.email, org: d.org, avatar: { ...d.avatar }, journey: j,
    number: (prev && prev.number) || j.code, date: (prev && prev.date) || new Date(),
    qrText: journeyLink(j)
  };
}

/* ---------- passport rendering ---------- */
function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function fitText(x, text, maxW, size, weight, family, min = 16) {
  let s = size; x.font = `${weight} ${s}px ${family}`;
  while (x.measureText(text).width > maxW && s > min) { s -= 2; x.font = `${weight} ${s}px ${family}`; }
  let t = text; while (x.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2) + '…';
  return t;
}
const FD = 'Rajdhani, Bahnschrift, "Segoe UI", sans-serif', FB = 'Inter, "Segoe UI", sans-serif', FA = '"Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif';
function spacing(x, v) { if ('letterSpacing' in x) x.letterSpacing = v; }
function drawPassport(cv, p) {
  const W = 1400, H = 880; cv.width = W; cv.height = H; const x = cv.getContext('2d'), j = p.journey;
  x.clearRect(0, 0, W, H); rrect(x, 0, 0, W, H, 44); x.save(); x.clip();
  let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b2a66'); g.addColorStop(.5, '#05133a'); g.addColorStop(1, '#020817'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(W - 260, 300, 20, W - 260, 300, 520); g.addColorStop(0, 'rgba(46,139,255,.28)'); g.addColorStop(1, 'rgba(46,139,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(124,196,255,.07)'; x.lineWidth = 1.2;
  for (let k = 0; k < 24; k++) { x.beginPath(); for (let px = 0; px <= W; px += 8) { const py = H * .52 + Math.sin(px / 85 + k * .45) * (50 + k * 7) * Math.cos(px / 420 + k * .12); px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  x.strokeStyle = 'rgba(124,196,255,.09)';
  for (let r = 80; r <= 360; r += 40) { x.beginPath(); x.arc(W - 250, 330, r, 0, 7); x.stroke(); }
  for (let k = 1; k < 6; k++) { x.beginPath(); x.ellipse(W - 250, 330, 280 * Math.sin(k * Math.PI / 6), 280, 0, 0, 7); x.stroke(); }
  // header band
  g = x.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, 'rgba(46,139,255,.22)'); g.addColorStop(1, 'rgba(46,139,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 140);
  g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(216,177,91,0)'); g.addColorStop(.5, 'rgba(244,216,143,.9)'); g.addColorStop(1, 'rgba(216,177,91,0)'); x.fillStyle = g; x.fillRect(40, 138, W - 80, 2);
  // official logo on a white plate
  x.fillStyle = '#ffffff'; rrect(x, 44, 14, 452, 116, 16); x.fill();
  const logo = ORG_LOGO;
  if (logo && logo.complete && logo.naturalWidth) { const lh = 104, lw = lh * logo.naturalWidth / logo.naturalHeight; x.drawImage(logo, 44 + (452 - lw) / 2, 20, lw, lh); }
  x.textAlign = 'right'; x.direction = 'rtl'; x.fillStyle = '#f4d88f'; x.font = `600 23px ${FA}`; x.fillText('جواز الذكاء الاصطناعي الوكيل', W - 60, 52); x.direction = 'ltr';
  x.font = `700 32px ${FD}`; spacing(x, '7px'); x.fillStyle = '#f4d88f'; x.fillText('AGENTIC AI PASSPORT', W - 60, 92); x.font = `600 17px ${FB}`; spacing(x, '4px'); x.fillStyle = '#46d2ff'; x.fillText('CLEARED FOR TAKEOFF · GITEX 2026', W - 60, 122); spacing(x, '0px'); x.textAlign = 'left';
  // photo
  const px = 70, py = 180, pw = 340, ph = 420;
  x.save(); rrect(x, px, py, pw, ph, 30); x.clip(); drawAvatar(x, p.avatar, px, py, pw, ph);
  g = x.createLinearGradient(0, py + ph - 120, 0, py + ph); g.addColorStop(0, 'rgba(2,8,23,0)'); g.addColorStop(1, 'rgba(2,8,23,.55)'); x.fillStyle = g; x.fillRect(px, py, pw, ph); x.restore();
  g = x.createLinearGradient(px, py, px + pw, py + ph); g.addColorStop(0, '#f8e1a0'); g.addColorStop(1, '#9a7426'); x.strokeStyle = g; x.lineWidth = 4; rrect(x, px, py, pw, ph, 30); x.stroke();
  // level pill
  g = x.createLinearGradient(px, 0, px + pw, 0); g.addColorStop(0, '#f8e1a0'); g.addColorStop(1, '#c49a45'); x.fillStyle = g; rrect(x, px, 622, pw, 66, 33); x.fill();
  x.fillStyle = '#1b1204'; x.textAlign = 'center'; x.font = `700 32px ${FD}`; spacing(x, '8px'); x.fillText(j.levelName.toUpperCase(), px + pw / 2 + 4, 666); spacing(x, '0px'); x.textAlign = 'left';
  // fields
  const fx = 470, fw = 560;
  const label = (t, a, b) => { x.fillStyle = '#7189b2'; x.font = `600 16px ${FB}`; spacing(x, '3px'); x.fillText(t, a, b); spacing(x, '0px'); };
  label('NAME', fx, 205); x.fillStyle = '#ffffff'; const nm = fitText(x, p.name, fw, 58, 700, FD, 30); x.fillText(nm, fx, 262);
  label('ORGANIZATION', fx, 312); x.fillStyle = '#eaf3ff'; x.fillText(fitText(x, p.org || '—', fw, 30, 500, FB, 18), fx, 352);
  label('LEARNING TRACK', fx, 405); x.fillStyle = '#46d2ff'; x.fillText(fitText(x, j.primary.title, fw, 36, 700, FD, 22), fx, 447);
  const att = state.attended ? getSession(state.attended) : null;
  label('SESSION ATTENDED', fx, 500); x.fillStyle = att ? '#eaf3ff' : '#7189b2'; x.fillText(fitText(x, att ? att.title : 'Not yet recorded', fw, 24, 500, FB, 16), fx, 536);
  const dt = p.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  label('DATE OF ISSUE', fx, 594); x.fillStyle = '#eaf3ff'; x.font = `600 28px ${FD}`; x.fillText(dt, fx, 630);
  label('PASSPORT NO.', fx + 290, 594); x.fillStyle = '#f4d88f'; x.font = `700 28px ${FD}`; spacing(x, '2px'); x.fillText(p.number, fx + 290, 630); spacing(x, '0px');
  label('JOURNEY', fx, 670); x.fillStyle = '#a9bfdf'; x.font = `600 20px ${FD}`; spacing(x, '3px'); x.fillText('DISCOVER  →  LEARN  →  PRACTICE  →  INNOVATE', fx, 700); spacing(x, '0px');
  // QR
  const qx = 1080, qy = 300, qs = 262;
  x.fillStyle = '#ffffff'; rrect(x, qx, qy, qs, qs, 22); x.fill();
  try { const qr = QR.encode(p.qrText); QR.draw(x, qr, qx + 6, qy + 6, qs - 12); }
  catch (e) { x.fillStyle = '#04102e'; x.textAlign = 'center'; x.font = `600 20px ${FB}`; x.fillText('QR unavailable', qx + qs / 2, qy + qs / 2 - 10); x.font = `700 24px ${FD}`; x.fillText(p.number, qx + qs / 2, qy + qs / 2 + 22); x.textAlign = 'left'; }
  x.fillStyle = '#a9bfdf'; x.textAlign = 'center'; x.font = `600 15px ${FB}`; spacing(x, '2px'); x.fillText('SCAN · YOUR COURSES', qx + qs / 2, qy + qs + 30); spacing(x, '0px'); x.textAlign = 'left';
  // MRZ band
  x.fillStyle = 'rgba(255,255,255,.045)'; x.fillRect(0, 724, W, H - 724); x.fillStyle = 'rgba(96,170,255,.3)'; x.fillRect(0, 724, W, 1);
  const mrzName = (p.name.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, '').trim().replace(/\s+/g, '<') || 'VISITOR');
  const ymd = p.date.toISOString().slice(0, 10).replace(/-/g, '');
  const l1 = ('P<FRD<GDRFA<<' + mrzName).padEnd(48, '<').slice(0, 48), l2 = (p.number.replace('-', '') + '<' + j.primary.id.toUpperCase() + '<' + j.levelName.toUpperCase() + '<<' + ymd).padEnd(48, '<').slice(0, 48);
  x.fillStyle = 'rgba(234,243,255,.75)'; x.font = '500 29px "Courier New", Consolas, monospace'; spacing(x, '4px'); x.fillText(l1, 60, 778); x.fillText(l2, 60, 820); spacing(x, '0px');
  x.textAlign = 'right'; x.fillStyle = '#ffb648'; x.font = `700 15px ${FB}`; spacing(x, '2px'); x.fillText('KEEPSAKE · NOT AN OFFICIAL TRAVEL OR IDENTITY DOCUMENT', W - 60, 858); spacing(x, '0px'); x.textAlign = 'left';
  x.restore();
  g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#f8e1a0'); g.addColorStop(.5, 'rgba(216,177,91,.35)'); g.addColorStop(1, '#d8b15b');
  x.strokeStyle = g; x.lineWidth = 4; rrect(x, 2, 2, W - 4, H - 4, 42); x.stroke();
  x.strokeStyle = 'rgba(96,170,255,.25)'; x.lineWidth = 1.5; rrect(x, 18, 18, W - 36, H - 36, 32); x.stroke();
}
function fontsReady() { const logo = ORG_LOGO, l = logo && logo.decode ? logo.decode().catch(() => {}) : Promise.resolve(); return Promise.race([Promise.all([document.fonts ? document.fonts.ready : null, l]), wait(1500)]); }
function paintPassport(cv) { if (!cv || !state.passport) return; drawPassport(cv, state.passport); fontsReady().then(() => { if (document.contains(cv) && state.passport) drawPassport(cv, state.passport); }); }
function passportActionsHTML(inWizard) {
  return `<div class="glass pp-actions"><div class="eyebrow">${ic('check')} Passport ready</div><h3>Welcome, ${esc(state.passport.name.split(' ')[0])}!</h3><p>Your Agentic AI Passport for <b>${esc(state.journey.primary.title)}</b> at <b>${esc(state.journey.levelName)}</b> level. Download it, preview the QR destination or see yourself on the big screen.</p>
    <button class="btn btn-primary" data-action="pp-download">${ic('download')} Download Passport</button>
    <button class="btn btn-ghost" data-action="pp-view-journey">${ic('journey')} View My Learning Journey</button>
    <button class="btn btn-gold" data-action="bs-confirm">${ic('screen')} Show on Big Screen</button>
    <button class="btn btn-ghost" data-action="qr-open">${ic('qr')} Preview QR Destination</button>
    <p class="small" style="margin:.3rem 0 0">Keepsake · kept in this kiosk’s memory only · cleared on reset</p></div>`;
}
function downloadPassport() {
  if (!state.passport) return;
  const fail = () => toast('Image export isn’t available in this browser — please take a photo of the screen instead.');
  fontsReady().then(() => {
    try {
      const cv = document.createElement('canvas'); drawPassport(cv, state.passport);
      if (!cv.toBlob) { fail(); return; }
      cv.toBlob(b => {
        if (!b) { fail(); return; }
        const url = URL.createObjectURL(b), a = document.createElement('a');
        a.href = url; a.download = `Agentic-AI-Passport-${state.passport.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Visitor'}.png`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('Passport saved as a PNG image.');
      }, 'image/png');
    } catch (e) { fail(); }
  });
}

/* =====================================================================
   MY AI JOURNEY VIEW
   ===================================================================== */
function renderJourney() {
  const j = state.journey, root = $('#journeyRoot');
  if (!j) {
    root.innerHTML = `<div class="glass journey-hero"><div><div class="eyebrow">${ic('journey')} My AI Journey</div><h2>Shape your <span>Agentic AI</span> future</h2><p>Answer three quick questions about your role, experience and interests. Cleared for Takeoff will build a personalised roadmap — then create your Agentic AI Passport and see yourself on the big screen.</p>
      <div class="modal-actions"><button class="btn btn-gold" data-action="start-journey">${ic('spark')} Start Your AI Journey</button><button class="btn btn-ghost" data-action="nav" data-view="tracks">Browse learning tracks</button></div></div>
      <div class="stage-preview">${[['Discover', 'Explore a topic and visit a demo'], ['Learn', 'Resources and a live session'], ['Practice', 'A hands-on lab or exercise'], ['Innovate', 'Your practical next step']].map(([a, b], i) => `<div><span class="stage-num" style="margin-bottom:.6rem">${i + 1}</span><b>${a}</b><span>${b}</span></div>`).join('')}</div></div>`;
    return;
  }
  root.innerHTML = `<div class="view-head"><div><div class="eyebrow">${ic('journey')} My AI Journey</div><h2>YOUR LEARNING ROADMAP</h2></div><div class="chips"><button class="btn btn-ghost btn-sm" data-action="start-journey">${ic('reset')} Edit my answers</button></div></div>
    <div class="glass profile-bar">${journeySummaryHTML(j)}</div>
    <div style="margin-top:1rem">${roadmapHTML(j)}</div>
    ${state.passport ? `<div class="passport-wrap"><canvas class="passport-canvas" id="ppCanvasView" aria-label="Your Agentic AI Passport"></canvas>${passportActionsHTML(false)}</div>` :
      `<div class="cta-banner"><div class="dialog-ic" style="margin:0">${ic('passport')}</div><div><h3>Create Your Agentic AI Passport</h3><p>Add your name and a photo or avatar to get a downloadable passport with a personalised QR code.</p></div><button class="btn btn-gold" data-action="wiz-passport-open">${ic('passport')} Create Passport</button></div>`}`;
  if (state.passport) paintPassport($('#ppCanvasView'));
}

/* =====================================================================
   BIG SCREEN EXPERIENCE (~8 s)
   ===================================================================== */
const bigscreen = (() => {
  let cv, x, W, H, raf = 0, t0 = 0, P = [], timers = [];
  const api = { playing: false };
  function build() {
    const r = rng(42), m = Math.min(W, H); P = [];
    const rings = [.2, .27, .35, .44, .55, .68];
    rings.forEach((rr, k) => { const n = 14 + k * 7; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k * .4, sa = r() * Math.PI * 2, sd = Math.max(W, H) * (.7 + r() * .4); P.push({ k, a, rad: rr * m * (1 + (r() - .5) * .08), sx: W / 2 + Math.cos(sa) * sd, sy: H / 2 + Math.sin(sa) * sd, gold: (i + k) % 7 === 0 }); } });
  }
  function frame(now) {
    const t = (now - t0) / 1000; x.clearRect(0, 0, W, H);
    const g = x.createRadialGradient(W / 2, H * .42, 0, W / 2, H * .42, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(20,70,170,.55)'); g.addColorStop(1, 'rgba(1,4,13,1)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const fade = t > 7.1 ? Math.max(0, 1 - (t - 7.1) / .8) : 1, e = 1 - Math.pow(1 - Math.min(1, t / 2.4), 3), cy = H * .36;
    const pos = P.map(p => { const a = p.a + t * .06 * (p.k % 2 ? 1 : -1), tx = W / 2 + Math.cos(a) * p.rad * 1.25, ty = cy + Math.sin(a) * p.rad * .9; return [p.sx + (tx - p.sx) * e, p.sy + (ty - p.sy) * e, p.gold]; });
    const md = Math.min(W, H) * .11; x.lineWidth = 1;
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) { const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1]; if (Math.abs(dx) > md || Math.abs(dy) > md) continue; const d = Math.hypot(dx, dy); if (d < md) { x.strokeStyle = `rgba(90,190,255,${(1 - d / md) * .45 * fade})`; x.beginPath(); x.moveTo(pos[i][0], pos[i][1]); x.lineTo(pos[j][0], pos[j][1]); x.stroke(); } }
    pos.forEach(p => { x.fillStyle = p[2] ? `rgba(244,216,143,${fade})` : `rgba(150,220,255,${.9 * fade})`; x.beginPath(); x.arc(p[0], p[1], p[2] ? 2.6 : 1.8, 0, 7); x.fill(); });
    if (t > .9 && t < 3.4) { const s = (t - .9) / 2.5; x.strokeStyle = `rgba(70,210,255,${(1 - s) * .8})`; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, cy, s * Math.max(W, H) * .7, 0, 7); x.stroke(); }
    if (t > 2.4 && t < 4) { const s = (t - 2.4) / 1.6; x.fillStyle = `rgba(255,255,255,${(1 - s) * .12})`; x.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }
  api.play = () => {
    const p = state.passport; if (!p) return;
    cv = $('#bsCanvas'); x = cv.getContext('2d');
    const o = $('#bigscreen');
    $('#bsImg').src = avatarCanvas(p.avatar, 512).toDataURL('image/png');
    const nm = $('#bsName'); nm.innerHTML = '';
    const latin = /^[\u0000-ɏ\s'.-]+$/.test(p.name);
    (latin ? Array.from(p.name) : [p.name]).forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; s.style.animationDelay = (2.6 + i * (latin ? .055 : 0)) + 's'; nm.appendChild(s); });
    $('#bsTrack').textContent = `${p.journey.primary.title} · ${p.journey.levelName}`;
    $('#bsBrand').innerHTML = `<div class="logo-plate clear"><img src="assets/gdrfa-logo-light.png" alt=""></div><span>AGENTIC AI: CLEARED FOR TAKEOFF · GITEX 2026</span>`;
    o.classList.remove('play', 'out'); void o.offsetWidth; o.classList.add('open', 'play');
    api.playing = true; updateGlobe();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    build(); t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    timers.push(setTimeout(() => o.classList.add('out'), 7200), setTimeout(api.stop, 8000));
    setTimeout(() => $('.bs-skip').focus({ preventScroll: true }), 50);
  };
  api.stop = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); raf = 0; const o = $('#bigscreen'); o.classList.remove('open', 'play', 'out'); $('#bsImg').removeAttribute('src'); $('#bsName').innerHTML = ''; api.playing = false; updateGlobe(); };
  return api;
})();
function confirmDialog({ icon = 'alert', title, text, ok, onOk }) {
  $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic(icon)}</div><h3 id="confirmTitle">${esc(title)}</h3><p>${esc(text)}</p><div class="modal-actions"><button class="btn btn-ghost" data-action="confirm-cancel">Cancel</button><button class="btn btn-gold" data-action="confirm-ok" data-autofocus>${esc(ok)}</button></div>`;
  confirmDialog.onOk = onOk; showOverlay('confirm');
}

/* =====================================================================
   RESET + INACTIVITY
   ===================================================================== */
function resetExperience(silent) {
  stopCamera(); bigscreen.stop();
  ['modal', 'confirm', 'idle'].forEach(hideOverlay);
  $('#wizard').classList.remove('open');
  const keepView = state.view;
  state = freshState(); buildSchedule();
  $('#chatInput').value = ''; chatWelcome();
  $('#fileInput').value = '';
  $('#trackScroller').scrollLeft = 0;
  ['newsRoot', 'demosRoot', 'tracksRoot', 'sessionsRoot', 'journeyRoot'].forEach(id => { $('#' + id).innerHTML = ''; });
  navigate('home');
  if (!silent) toast('Experience reset — all visitor data cleared. Ready for the next visitor!');
  return keepView;
}
let lastActivity = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); if ($('#idle').classList.contains('open')) hideOverlay('idle'); }, { passive: true, capture: true }));
const isPristine = () => !state.journey && !state.passport && !state.wizard.open && !state.wizard.role && !state.wizard.experience && !state.wizard.interests.length && !state.draft.name && !state.attended && $('#chatLog').querySelectorAll('.msg.user').length === 0;
function idleTick() {
  if (bigscreen.playing) { lastActivity = Date.now(); return; }
  const idle = (Date.now() - lastActivity) / 1000, IDLE_WARN = CONFIG.idleWarnSeconds, IDLE_RESET = CONFIG.idleResetSeconds;
  if (isPristine()) {
    if (idle >= IDLE_RESET && (state.view !== 'home' || $('#modal').classList.contains('open') || state.chat.busy)) { resetExperience(true); lastActivity = Date.now(); }
    return;
  }
  if (idle >= IDLE_RESET) { resetExperience(true); lastActivity = Date.now(); toast('Session cleared after inactivity. Welcome to Agentic AI: Cleared for Takeoff!'); }
  else if (idle >= IDLE_WARN) { $('#idleCount').textContent = Math.ceil(IDLE_RESET - idle); if (!$('#idle').classList.contains('open')) showOverlay('idle'); }
}

/* =====================================================================
   ACTIONS (event delegation — every button maps to one entry here)
   ===================================================================== */
let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.innerHTML = ic('info') + '<span></span>'; t.querySelector('span').textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3600); }
const ACTIONS = {
  nav: d => { hideOverlay('modal'); if (state.wizard.open) closeWizard(); navigate(d.view); },
  'start-journey': () => { hideOverlay('modal'); openWizard(); },
  personalize: d => openWizard({ trackId: d.id }),
  'open-track': d => openTrack(d.id), 'open-course': d => openCourse(d.id), 'open-demo': d => openDemo(d.id), 'open-session': d => openSession(d.id), 'open-news': d => openNews(d.id),
  'close-modal': () => hideOverlay('modal'),
  ask: d => { if (d.inchat) { sendQuestion(d.q); return; } hideOverlay('modal'); if (state.wizard.open) closeWizard(); if (state.view !== 'home' && state.view !== 'ask') navigate('ask'); sendQuestion(d.q); },
  'chat-clear': () => chatWelcome(),
  mic: () => toast('Voice input isn’t enabled in this demo — please type your question or tap a suggestion.'),
  reset: () => resetExperience(false),
  'idle-continue': () => { lastActivity = Date.now(); hideOverlay('idle'); },
  'tracks-scroll': d => { const s = $('#trackScroller'), c = s.querySelector('.track-card'); s.scrollBy({ left: (+d.dir) * ((c ? c.offsetWidth : 280) + 14) * 2, behavior: REDUCED ? 'auto' : 'smooth' }); },
  'news-filter': d => { state.newsFilter = d.filter; if (d.clear) { state.newsQuery = ''; $('#newsSearch').value = ''; } renderNewsResults(); },
  'track-filter': d => { state.trackFilter = d.filter; renderTracks(); },
  'session-filter': d => { state.sessionFilter = d.filter; renderSessionList(); },
  'zone-filter': d => { state.zoneFilter = state.zoneFilter === d.zone ? null : d.zone; renderSessionList(); },
  'mark-attended': d => { state.attended = state.attended === d.id ? null : d.id; toast(state.attended ? 'Session added to your Agentic AI Passport.' : 'Session removed from your passport.'); openSession(d.id); if (state.view === 'sessions') renderSessionList(); if (state.view === 'journey') renderJourney(); },
  'wiz-close': () => closeWizard(),
  'wiz-role': d => { state.wizard.role = d.id; renderWizard(); },
  'wiz-exp': d => { state.wizard.experience = d.id; renderWizard(); },
  'wiz-interest': d => { const a = state.wizard.interests, i = a.indexOf(d.id); if (i >= 0) a.splice(i, 1); else a.push(d.id); renderWizard(); },
  'wiz-next': () => { if (state.wizard.role && state.wizard.experience) wizGo(2); },
  'wiz-back': () => wizGo(1),
  'wiz-generate': () => { if (state.wizard.interests.length) wizGo(3); },
  'wiz-edit': () => wizGo(1),
  'wiz-save': () => { closeWizard(); navigate('journey'); toast('Your learning journey is ready.'); },
  'wiz-passport': () => wizGo(5),
  'wiz-passport-open': () => openWizard({ step: 5 }),
  'wiz-step': d => wizGo(+d.id),
  'wiz-done': () => { closeWizard(); navigate('journey'); },
  'ava-tab': d => { state.draft.tab = d.id; $$('.tab').forEach(t => { const on = t.dataset.id === d.id; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); }); renderAvaPanel(); },
  'ava-pick': d => { state.draft.avatar = { kind: 'preset', id: d.id }; $$('.ava-opt').forEach(b => b.classList.toggle('sel', b.dataset.id === d.id)); updateAvaPreview(); },
  'ava-upload': () => $('#fileInput').click(),
  'cam-start': () => startCamera(),
  'cam-stop': () => renderAvaPanel(),
  'cam-capture': () => capturePhoto(),
  'pp-generate': () => {
    if (!validateDraft()) { renderPassportForm(); const f = $('.field.err input'); if (f) f.focus(); return; }
    state.passport = buildPassport(state.passport); wizGo(6);
  },
  'pp-download': () => downloadPassport(),
  'pp-view-journey': () => { if (state.wizard.open) closeWizard(); navigate('journey'); setTimeout(() => { const r = $('#journeyRoot .roadmap'); if (r) r.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }, 80); },
  'qr-open': () => openQRDest(),
  'bs-confirm': () => confirmDialog({ icon: 'screen', title: 'Show on the big screen?', text: `Your name (“${state.passport.name}”) and your ${state.passport.avatar.kind === 'photo' ? 'photo' : 'avatar'} will be displayed full-screen for about 8 seconds and may be visible to people nearby. Nothing is recorded or saved.`, ok: 'Yes, show me', onOk: () => bigscreen.play() }),
  'bs-skip': () => bigscreen.stop(),
  'confirm-ok': () => { const fn = confirmDialog.onOk; confirmDialog.onOk = null; hideOverlay('confirm'); if (fn) fn(); },
  'confirm-cancel': () => { confirmDialog.onOk = null; hideOverlay('confirm'); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) { if (e.target.id === 'modal') hideOverlay('modal'); else if (e.target.id === 'confirm') ACTIONS['confirm-cancel'](); return; }
  if (el.disabled) return;
  const fn = ACTIONS[el.dataset.action]; if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (bigscreen.playing) bigscreen.stop();
    else if ($('#confirm').classList.contains('open')) ACTIONS['confirm-cancel']();
    else if ($('#modal').classList.contains('open')) hideOverlay('modal');
    else if (state.wizard.open && state.wizard.step !== 3) closeWizard();
  } else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-action]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
$('#fileInput').addEventListener('change', e => { handleFile(e.target.files && e.target.files[0]); e.target.value = ''; });
document.addEventListener('visibilitychange', updateGlobe);

/* =====================================================================
   CLOCK + INIT
   ===================================================================== */
function tickClock() {
  const d = new Date();
  const tz = CONFIG.eventTimezone || undefined;
  $('#clockTime').innerHTML = `${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })}<small>${String(d.getSeconds()).padStart(2, '0')}</small>`;
  $('#clockDate').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
}
async function loadRuntimeConfig() {
  if (!CONFIG.served) return;
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch('api/config', { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return;
    const c = await res.json();
    ['aiEnabled', 'aiTimeoutMs', 'publicBaseUrl', 'scheduleMode', 'eventTimezone', 'idleWarnSeconds', 'idleResetSeconds'].forEach(k => { if (c[k] !== undefined) CONFIG[k] = c[k]; });
  } catch (e) { /* offline: keep defaults */ } finally { clearTimeout(timer); }
}
async function init() {
  await loadRuntimeConfig();
  buildSchedule();
  renderNav();
  $('#skyline').innerHTML = skylineSVG();
  $$('[data-action="tracks-scroll"]').forEach(b => { b.innerHTML = ic(+b.dataset.dir < 0 ? 'chevL' : 'chevR'); });
  hydrateIcons(document);
  chatInit();
  globe.init();
  navigate('home');
  tickClock(); setInterval(tickClock, 1000);
  setInterval(idleTick, 1000);
  setInterval(() => { if (state.view === 'home') renderBooth(); else if (state.view === 'sessions') renderSessionList(); }, 30000);
}
init();

