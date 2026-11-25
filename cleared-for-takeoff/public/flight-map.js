/* =====================================================================
   LEARNING FLIGHT MAP — prototype
   30 real courses as stars: grouped by learning track (constellations),
   raised by level (flight levels). The visitor's learning agent scans,
   filters, weighs and plots a four-waypoint route, then re-plans live
   when the visitor steers it (time, free only, hands-on, pinned courses).
   Planning uses the shared rules (public/shared/journey-rules.js) so the
   prototype runs offline; in the kiosk the same step calls Claude.
   ===================================================================== */
import * as THREE from './vendor/three.min.js';

const DATA = window.CFT_CONTENT, CATALOG = window.CFT_CATALOG, RULES = window.CFT_RULES;
const COURSES = CATALOG.courses, LEVELS = RULES.LEVELS, STAGES = RULES.STAGES;
const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const FLIGHT_LEVEL = ['FL100', 'FL200', 'FL300'];
const LEVEL_Y = [0, 4.4, 8.8];
const TRACK_COLORS = { agentic: '#46d2ff', gov: '#3be3a1', cyber: '#a98bff', cx: '#ff7ab6', data: '#ff9f43', emerging: '#e8f36b' };
const GOLD = new THREE.Color('#f4d88f');
const ORIGIN = new THREE.Vector3(0, -1.8, 0);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIME_OPTIONS = [['any', 'Any length'], ['medium', '≤ 10 h'], ['short', '≤ 2 h']];
const SAMPLE_PROFILES = [
  { role: 'student', experience: 'beginner', interests: ['genai', 'future'] },
  { role: 'gov', experience: 'intermediate', interests: ['gov', 'agentic', 'automation'] },
  { role: 'tech', experience: 'advanced', interests: ['cyber', 'agentic'] },
  { role: 'leader', experience: 'beginner', interests: ['cx', 'data'] }
];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const dur = ms => REDUCED ? Math.min(ms, 120) : ms;
const wait = ms => new Promise(r => setTimeout(r, dur(ms)));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtHours = h => h < 1 ? `${Math.round(h * 60)} min` : `${h} h`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const byId = (list, id) => list.find(x => x.id === id);
const listText = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : (a[0] || '');
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* ---------- state (kept apart from rendering) ---------- */
const state = {
  profile: { role: 'tech', experience: 'intermediate', interests: ['agentic', 'genai'] },
  steer: { time: 'any', freeOnly: false, handsOn: false },
  pinned: [],
  plan: null, planProfileKey: '', busy: false, flying: false, selected: null, attract: false
};
const ctx = () => ({ content: DATA, catalog: CATALOG, sessions: [] });
const levelIdx = () => RULES.levelIndex(DATA, state.profile.experience);
const profileKey = () => JSON.stringify(state.profile);

/* =====================================================================
   SCENE
   ===================================================================== */
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#noWebgl').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#020817');
scene.fog = new THREE.FogExp2('#020817', 0.012);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.75)'); g.addColorStop(.45, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW = glowTexture();
const additive = (color, opacity) => ({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
function glowSprite(color, scale, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, ...additive(color, opacity) }));
  s.scale.setScalar(scale); return s;
}
function line(points, material) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(g, material);
}

/* background stars */
{
  const r = rng(7), pts = [];
  for (let i = 0; i < 1600; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, d = 120 + r() * 80, s = Math.sqrt(1 - u * u);
    pts.push(d * s * Math.cos(th), d * u, d * s * Math.sin(th));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#9fc8ff', size: 0.7, sizeAttenuation: true, transparent: true, opacity: .6, depthWrite: false })));
}

/* flight levels: translucent decks with sector spokes */
const SECTOR = Math.PI * 2 / DATA.tracks.length;
LEVEL_Y.forEach((y, li) => {
  const deck = new THREE.Mesh(new THREE.RingGeometry(5.2, 12.8, 120, 1), new THREE.MeshBasicMaterial({ color: '#2e8bff', transparent: true, opacity: .035 + li * .01, side: THREE.DoubleSide, depthWrite: false }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = y; scene.add(deck);
  [5.2, 12.8].forEach(rad => {
    const pts = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad)); }
    scene.add(line(pts, new THREE.LineBasicMaterial({ color: '#46d2ff', transparent: true, opacity: .18 })));
  });
  for (let k = 0; k < DATA.tracks.length; k++) {
    const a = k * SECTOR + SECTOR / 2;
    scene.add(line([new THREE.Vector3(Math.cos(a) * 5.2, y, Math.sin(a) * 5.2), new THREE.Vector3(Math.cos(a) * 12.8, y, Math.sin(a) * 12.8)], new THREE.LineBasicMaterial({ color: '#46d2ff', transparent: true, opacity: .08 })));
  }
});

/* origin ("you") */
const originGroup = new THREE.Group(); originGroup.position.copy(ORIGIN); scene.add(originGroup);
{
  const pad = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 64), new THREE.MeshBasicMaterial(additive('#f4d88f', .8)));
  pad.rotation.x = -Math.PI / 2; originGroup.add(pad, glowSprite('#f4d88f', 2.6, .9));
  originGroup.add(line([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, LEVEL_Y[0] - ORIGIN.y - .3, 0)], new THREE.LineBasicMaterial(additive('#f4d88f', .35))));
}

/* courses as stars */
const coreGeo = new THREE.SphereGeometry(0.17, 16, 12), hitGeo = new THREE.SphereGeometry(0.75, 10, 8);
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const nodes = COURSES.map(course => {
  const ti = DATA.tracks.findIndex(t => t.id === course.tracks[0]);
  const r = rng(hash(course.id));
  const ang = ti * SECTOR + (r() - .5) * SECTOR * .78;
  const rad = 6.3 + r() * 5.6;
  const li = LEVELS.indexOf(course.level);
  const pos = new THREE.Vector3(Math.cos(ang) * rad, LEVEL_Y[li] + (r() - .5) * 1.1, Math.sin(ang) * rad);
  const color = new THREE.Color(TRACK_COLORS[course.tracks[0]]);
  const group = new THREE.Group(); group.position.copy(pos);
  const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const glow = glowSprite(color.clone(), 2.0, .85);
  const hit = new THREE.Mesh(hitGeo, hitMat);
  group.add(glow, core, hit);
  scene.add(group);
  const node = { course, pos, ang, li, color, group, core, glow, hit, state: 'idle', weight: 0, phase: r() * 6.28 };
  hit.userData.node = node;
  // drop line to its flight level for depth
  scene.add(line([pos, new THREE.Vector3(pos.x, LEVEL_Y[li], pos.z)], new THREE.LineBasicMaterial({ color, transparent: true, opacity: .25 })));
  return node;
});
const nodeById = id => nodes.find(n => n.course.id === id);

/* constellation lines: within each track and level, and one link between adjacent levels */
DATA.tracks.forEach(t => {
  const own = nodes.filter(n => n.course.tracks[0] === t.id);
  const mat = new THREE.LineBasicMaterial({ color: TRACK_COLORS[t.id], transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false });
  LEVELS.forEach((_, li) => {
    const lv = own.filter(n => n.li === li).sort((a, b) => a.ang - b.ang);
    if (lv.length > 1) scene.add(line(lv.map(n => n.pos), mat));
  });
  [[0, 1], [1, 2]].forEach(([a, b]) => {
    let best = null;
    own.filter(n => n.li === a).forEach(p => own.filter(n => n.li === b).forEach(q => { const d = p.pos.distanceTo(q.pos); if (!best || d < best.d) best = { p, q, d }; }));
    if (best) scene.add(line([best.p.pos, best.q.pos], new THREE.LineBasicMaterial({ color: TRACK_COLORS[t.id], transparent: true, opacity: .14 })));
  });
});

/* the learning agent */
const agent = new THREE.Group(); scene.add(agent);
{
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 14).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  agent.add(body, glowSprite('#f4d88f', 2.4, .95));
  agent.position.copy(ORIGIN).add(new THREE.Vector3(0, .9, 0));
}
const TRAIL_N = 70;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
{
  const cols = new Float32Array(TRAIL_N * 3);
  for (let i = 0; i < TRAIL_N; i++) { const f = 1 - i / TRAIL_N; cols.set([GOLD.r * f, GOLD.g * f, GOLD.b * f], i * 3); }
  trailGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
}
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
trail.frustumCulled = false; scene.add(trail);
const trailPts = [];
function resetTrail() { trailPts.length = 0; }

/* selection ring */
const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 48), new THREE.MeshBasicMaterial(additive('#ffffff', .9)));
selRing.visible = false; scene.add(selRing);

/* =====================================================================
   LABELS (DOM, projected each frame)
   ===================================================================== */
const labelsEl = $('#labels'), labels = [];
function addLabel(html, cls, pos, opts = {}) {
  const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html;
  labelsEl.appendChild(el);
  const l = { el, pos: pos.clone(), follow: opts.follow || null, hidden: false };
  labels.push(l); return l;
}
function removeLabel(l) { const i = labels.indexOf(l); if (i >= 0) labels.splice(i, 1); l.el.remove(); }
DATA.tracks.forEach((t, k) => {
  const a = k * SECTOR;
  addLabel(`<i style="background:${TRACK_COLORS[t.id]};color:${TRACK_COLORS[t.id]}"></i>${esc(t.title.replace('Customer Experience with AI', 'Customer Experience').replace('Emerging Technology & Innovation', 'Emerging Tech'))}`, 'lbl-track', new THREE.Vector3(Math.cos(a) * 13.6, LEVEL_Y[2] + 2.4, Math.sin(a) * 13.6)).el.style.color = TRACK_COLORS[t.id];
});
LEVEL_Y.forEach((y, li) => {
  const a = SECTOR * 1.5;
  addLabel(`${FLIGHT_LEVEL[li]} · ${LEVEL_LABEL[LEVELS[li]]}`, 'lbl-level', new THREE.Vector3(Math.cos(a) * 13.8, y, Math.sin(a) * 13.8));
});
addLabel('YOU', 'lbl-you', ORIGIN);
$('#legend').innerHTML = DATA.tracks.map(t => `<span><i style="background:${TRACK_COLORS[t.id]}"></i>${esc(t.title)}</span>`).join('');

/* =====================================================================
   CAMERA: touch/mouse orbit with damping, auto-rotate, chase mode
   ===================================================================== */
const orbit = { theta: 0.55, phi: 1.12, radius: 40, target: new THREE.Vector3(0, 3.6, 0) };
const goal = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: orbit.target.clone() };
let lastInput = performance.now(), chase = null;
const clampPhi = p => Math.min(1.5, Math.max(0.3, p));
const clampR = r => Math.min(90, Math.max(13, r));
let homeRadius = 40; // distance that frames the whole map; grows on portrait screens

const pointers = new Map(); let tap = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
  else tap = null;
  noteInput();
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (pointers.size === 1) {
    goal.theta -= dx * 0.0055; goal.phi = clampPhi(goal.phi - dy * 0.0045);
    if (tap) tap.moved += Math.abs(dx) + Math.abs(dy);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], before = Math.hypot(a.x - b.x, a.y - b.y);
    p.x = e.clientX; p.y = e.clientY;
    const [c, d] = [...pointers.values()], after = Math.hypot(c.x - d.x, c.y - d.y);
    if (before > 0 && after > 0) goal.radius = clampR(goal.radius * before / after);
  }
  p.x = e.clientX; p.y = e.clientY;
  noteInput();
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (tap && pointers.size === 0 && tap.moved < 8 && performance.now() - tap.t < 500) pick(e.clientX, e.clientY);
  if (pointers.size === 0) tap = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); tap = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); goal.radius = clampR(goal.radius * (1 + e.deltaY * 0.001)); noteInput(); }, { passive: false });

const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(nodes.map(n => n.hit), false)[0];
  if (hit) selectCourse(hit.object.userData.node.course.id);
  else closeCard();
}

function placeCamera(dt) {
  if (chase) {
    const f = Math.min(1, dt * 3);
    camera.position.lerp(chase.pos, f);
    chase.look.lerp(chase.lookGoal, f);
    camera.lookAt(chase.look);
    return;
  }
  const k = Math.min(1, dt * 6);
  if (!state.flying && !REDUCED && performance.now() - lastInput > 7000) goal.theta += dt * 0.045;
  orbit.theta += (goal.theta - orbit.theta) * k;
  orbit.phi += (goal.phi - orbit.phi) * k;
  orbit.radius += (goal.radius - orbit.radius) * k;
  orbit.target.lerp(goal.target, k);
  const { theta, phi, radius, target } = orbit;
  camera.position.set(target.x + radius * Math.sin(phi) * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(target);
}
function orbitFromCamera() {
  const v = camera.position.clone().sub(goal.target);
  orbit.radius = goal.radius = clampR(v.length());
  orbit.phi = goal.phi = clampPhi(Math.acos(v.y / v.length()));
  orbit.theta = goal.theta = Math.atan2(v.x, v.z);
  orbit.target.copy(goal.target);
}

/* =====================================================================
   ANIMATION PRIMITIVES
   ===================================================================== */
const tweens = new Set();
function tween(ms, update, tag = null) {
  return new Promise(resolve => {
    const t = { start: performance.now(), dur: Math.max(1, dur(ms)), update, resolve, tag };
    tweens.add(t);
  });
}
/* stop (and settle) every tween of a kind — used when a new plan replaces the current one */
function cancelTweens(tag) { tweens.forEach(t => { if (t.tag === tag) { tweens.delete(t); t.resolve(); } }); }
function sweep() {
  LEVEL_Y.forEach((y, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 128), new THREE.MeshBasicMaterial({ ...additive('#46d2ff', .9), side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = y; scene.add(ring);
    setTimeout(() => tween(1300, t => { ring.scale.setScalar(.5 + t * 13.5); ring.material.opacity = .9 * (1 - t); }).then(() => { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }), i * 160);
  });
}

/* node looks: state -> target opacity/scale/colour, eased every frame */
const LOOK = {
  idle: { op: .85, scale: 2.0 }, dim: { op: .08, scale: 1.1 }, cand: { op: 1, scale: 2.0 },
  route: { op: 1, scale: 3.6, gold: true }, route2: { op: 1, scale: 2.8, gold: true }
};
const DIM_CORE = new THREE.Color('#2a3755'), WHITE = new THREE.Color('#ffffff'), tmpC = new THREE.Color();
let scanning = false;
function updateNodes(time, dt) {
  const k = Math.min(1, dt * 5);
  nodes.forEach(n => {
    const L = LOOK[n.state];
    let op = L.op, sc = L.scale + (n.state === 'cand' ? n.weight * 1.1 : 0);
    if (scanning && n.state !== 'dim') op *= .55 + .45 * Math.sin(time * 9 + n.phase);
    if (L.gold) sc += Math.sin(time * 3 + n.phase) * .15;
    const m = n.glow.material;
    m.opacity += (op - m.opacity) * k;
    n.glow.scale.setScalar(n.glow.scale.x + (sc - n.glow.scale.x) * k);
    m.color.lerp(L.gold ? GOLD : n.color, k);
    n.core.material.color.lerp(n.state === 'dim' ? DIM_CORE : WHITE, k);
  });
}

/* =====================================================================
   ROUTE
   ===================================================================== */
let route = null;
const ROUTE_SEGS = 420, ROUTE_RAD = 8;
function clearRoute() {
  if (!route) return;
  scene.remove(route.group);
  route.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  route.labels.forEach(removeLabel);
  route = null;
}
function buildRoute(plan) {
  clearRoute();
  const way = plan.stages.map(s => nodeById(s.courseIds[0]).pos);
  const last = way[3], out = new THREE.Vector3(last.x, 0, last.z).normalize().multiplyScalar(6);
  const climb = new THREE.Vector3(way[0].x, 0, way[0].z).normalize().multiplyScalar(2).add(new THREE.Vector3(0, 1.8, 0)); // climb out towards the first waypoint
  const pts = [ORIGIN.clone(), ORIGIN.clone().add(climb), ...way.map(p => p.clone()), last.clone().add(out).add(new THREE.Vector3(0, 4.5, 0))];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const group = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, ROUTE_SEGS, 0.075, ROUTE_RAD, false), new THREE.MeshBasicMaterial(additive('#f4d88f', .95)));
  tube.geometry.setDrawRange(0, 0);
  group.add(tube);
  // arc-length position of every control point
  const samples = []; for (let i = 0; i <= 800; i++) samples.push(curve.getPointAt(i / 800));
  const fracs = pts.map(p => { let best = 0, bd = Infinity; samples.forEach((s, i) => { const d = s.distanceToSquared(p); if (d < bd) { bd = d; best = i; } }); return best / 800; });
  scene.add(group);
  return (route = { plan, curve, group, tube, fracs, wayFrac: fracs.slice(2, 6), rings: [], labels: [], progress: 0 });
}
function setRouteProgress(f) {
  if (!route) return;
  route.progress = f;
  route.tube.geometry.setDrawRange(0, Math.floor(f * ROUTE_SEGS) * ROUTE_RAD * 6);
}
function placeAgent(f) {
  if (!route) return;
  const p = route.curve.getPointAt(Math.min(1, Math.max(0, f)));
  const ahead = route.curve.getPointAt(Math.min(1, f + 0.004));
  agent.position.copy(p);
  if (ahead.distanceToSquared(p) > 1e-6) agent.lookAt(ahead);
  trailPts.unshift(p.clone()); if (trailPts.length > TRAIL_N) trailPts.length = TRAIL_N;
}
function addWaypoint(i, stage) {
  const n = nodeById(stage.courseIds[0]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 8, 56), new THREE.MeshBasicMaterial(additive('#f4d88f', .95)));
  ring.position.copy(n.pos); ring.userData.billboard = true; route.group.add(ring); route.rings.push(ring);
  tween(500, t => ring.scale.setScalar(.2 + ease(t) * .8));
  const second = stage.courseIds[1] && nodeById(stage.courseIds[1]);
  if (second) {
    const l = line([n.pos, second.pos], new THREE.LineDashedMaterial({ color: '#f4d88f', dashSize: .35, gapSize: .25, transparent: true, opacity: .75 }));
    l.computeLineDistances(); route.group.add(l);
  }
  route.labels.push(addLabel(`${i + 1} · ${stage.stage.toUpperCase()}<small>${esc(n.course.title)}</small>`, 'lbl-way', n.pos));
}
async function flyAgent(f0, f1, ms) {
  await tween(ms, t => { const f = f0 + (f1 - f0) * ease(t); setRouteProgress(Math.max(route ? route.progress : 0, f)); placeAgent(f); }, 'route');
}

/* =====================================================================
   AGENT REASONING (the "why" behind each pick)
   ===================================================================== */
function stageOf(id) { return state.plan ? state.plan.stages.find(s => s.courseIds.includes(id)) : null; }
function tracksRanked() { const r = RULES.rankTracks(state.profile, DATA); return { primary: r[0], secondary: r[1] }; }
function reasonFor(course, stage) {
  const lvl = levelIdx(), d = LEVELS.indexOf(course.level) - lvl, { primary } = tracksRanked();
  const bits = [];
  if (state.pinned.includes(course.id)) bits.push('you added it to your route');
  if (course.stages.includes(stage)) bits.push(`it is built for the ${stage} stage`);
  bits.push(d === 0 ? `it matches your ${LEVEL_LABEL[course.level].toLowerCase()} level` : d > 0 ? 'it is a stretch one level up' : 'it is a quick refresher one level down');
  const matched = course.interests.filter(i => state.profile.interests.includes(i)).map(i => byId(DATA.interests, i).label);
  if (matched.length) bits.push(`it covers ${listText(matched)}`);
  if (course.tracks.includes(primary.id)) bits.push(`it is part of ${primary.title}`);
  if (state.steer.handsOn && RULES.HANDS_ON.test(course.format)) bits.push('it is hands-on');
  return cap(listText(bits.slice(0, 3))) + '.';
}
function filterReasons(course) {
  const out = [], d = LEVELS.indexOf(course.level) - levelIdx();
  if (Math.abs(d) > 1) out.push(d > 0 ? 'Two levels above your experience' : 'Two levels below your experience');
  if (state.steer.freeOnly && course.cost !== 'free') out.push('Not free — you asked for free courses only');
  const limit = RULES.TIME_LIMITS[state.steer.time];
  if (course.hours > limit) out.push(`About ${fmtHours(course.hours)} — longer than your ${limit} h limit`);
  return out;
}
function steerText() {
  const parts = [];
  if (state.steer.time !== 'any') parts.push(`courses ${TIME_OPTIONS.find(o => o[0] === state.steer.time)[1]}`);
  if (state.steer.freeOnly) parts.push('free only');
  if (state.steer.handsOn) parts.push('hands-on first');
  if (state.pinned.length) parts.push(`${state.pinned.length} course${state.pinned.length > 1 ? 's' : ''} you added`);
  return parts.length ? listText(parts) : 'no limits';
}

/* =====================================================================
   PLANNING SEQUENCE
   ===================================================================== */
const STEP_NAMES = ['Scan', 'Filter', 'Weigh', 'Plot', 'Ready'];
function setSteps(active) {
  $('#steps').innerHTML = STEP_NAMES.map((s, i) => `<span class="fm-step ${i < active ? 'ok' : i === active ? 'on' : ''}">${i < active ? '✓ ' : ''}${s}</span>`).join('');
}
function say(html) { $('#consoleText').innerHTML = html; }
function setBusy(b) {
  state.busy = b;
  $('#console').classList.toggle('busy', b);
  $('#takeoffBtn').disabled = b || !state.plan;
}

let planToken = 0;
async function planRoute(mode = 'initial') {
  const token = ++planToken, alive = () => token === planToken;
  const quick = mode !== 'initial';
  const prev = state.plan;
  cancelTweens('route');
  setBusy(true); closeEnd(); chase = null; state.flying = false;
  const plan = RULES.buildRulesPlan(state.profile, ctx(), { constraints: state.steer, pinned: state.pinned });
  const lvl = levelIdx(), { primary } = tracksRanked();
  const eligible = new Set(COURSES.filter(c => RULES.courseAllowed(c, lvl) && RULES.meetsConstraints(c, state.steer)).map(c => c.id));
  state.pinned.forEach(id => eligible.add(id));

  // 1 · scan
  clearRoute(); resetTrail();
  agent.position.copy(ORIGIN).add(new THREE.Vector3(0, .9, 0));
  nodes.forEach(n => { n.state = 'idle'; });
  setSteps(0);
  say(quick ? `Re-planning with <b>${esc(steerText())}</b>…` : `Scanning <b>${COURSES.length} courses</b> across ${DATA.tracks.length} learning tracks…`);
  scanning = true; sweep();
  await wait(quick ? 600 : 1500); scanning = false; if (!alive()) return;

  // 2 · filter
  setSteps(1);
  nodes.forEach(n => { n.state = eligible.has(n.course.id) ? 'idle' : 'dim'; });
  const lim = steerText();
  say(`<b>${eligible.size} of ${COURSES.length}</b> courses fit your ${LEVEL_LABEL[LEVELS[lvl]].toLowerCase()} level${lim !== 'no limits' ? ` and ${esc(lim)}` : ''}.`);
  await wait(quick ? 700 : 1500); if (!alive()) return;

  // 3 · weigh
  setSteps(2);
  const score = c => c.interests.filter(i => state.profile.interests.includes(i)).length + (c.tracks.includes(primary.id) ? 1 : 0);
  const max = Math.max(1, ...COURSES.map(score));
  nodes.forEach(n => { if (n.state !== 'dim') { n.state = 'cand'; n.weight = score(n.course) / max; } });
  const interestLabels = state.profile.interests.map(i => byId(DATA.interests, i).label);
  say(`Weighing them against <b>${esc(listText(interestLabels))}</b> — strongest match: <b>${esc(primary.title)}</b>.`);
  await wait(quick ? 600 : 1500); if (!alive()) return;

  // 4 · plot
  setSteps(3);
  buildRoute(plan);
  const changed = new Set();
  plan.stages.forEach((s, i) => { if (!prev || prev.stages[i].courseIds.join() !== s.courseIds.join()) changed.add(i); });
  nodes.forEach(n => { if (n.state === 'cand') n.state = 'idle'; });
  let f = 0;
  for (let i = 0; i < 4; i++) {
    const s = plan.stages[i], c = nodeById(s.courseIds[0]).course;
    await flyAgent(f, route.wayFrac[i], quick ? 550 : 1100); if (!alive()) return;
    f = route.wayFrac[i];
    s.courseIds.forEach((id, k) => { nodeById(id).state = k === 0 ? 'route' : 'route2'; });
    addWaypoint(i, s);
    say(`<b>${cap(s.stage)}:</b> ${esc(c.title)} — ${esc(reasonFor(c, s.stage))}`);
    await wait(quick ? 350 : 900); if (!alive()) return;
  }
  setRouteProgress(1);

  // 5 · ready
  state.plan = plan; state.planProfileKey = profileKey();
  setSteps(4);
  const ids = plan.stages.flatMap(s => s.courseIds), hours = ids.reduce((h, id) => h + byId(COURSES, id).hours, 0);
  const swaps = prev && quick ? [...changed].length : 0;
  say(`Flight plan ready: <b>${ids.length} courses</b>, about <b>${Math.round(hours)} hours</b>.` +
    (quick ? (swaps ? ` ${swaps} waypoint${swaps > 1 ? 's' : ''} changed to fit ${esc(steerText())}.` : ' Your route already fits — nothing had to change.') : ' Tap any star to ask the agent why, or steer it on the right.'));
  renderPlanList(quick ? changed : new Set());
  renderPlanButton();
  setBusy(false);
  if (state.selected) renderCard(state.selected);
}

async function takeoff() {
  if (!route || state.busy) return;
  const token = ++planToken, alive = () => token === planToken;
  cancelTweens('route');
  closeCard(); closeEnd(); setBusy(true); state.flying = true; resetTrail();
  say('<b>Cleared for takeoff.</b> Flying your route…');
  chase = { pos: camera.position.clone(), look: orbit.target.clone(), lookGoal: orbit.target.clone() };
  let next = 0;
  const total = dur(10000);
  await tween(total, t => {
    const f = t;
    placeAgent(f);
    const p = agent.position, dir = route.curve.getTangentAt(Math.min(1, f)).normalize();
    chase.pos.copy(p).sub(dir.clone().multiplyScalar(7)).add(new THREE.Vector3(0, 3.2, 0));
    chase.lookGoal.copy(p).add(dir.multiplyScalar(5));
    if (next < 4 && f >= route.wayFrac[next]) {
      const s = state.plan.stages[next], c = byId(COURSES, s.courseIds[0]);
      say(`<b>Waypoint ${next + 1} · ${cap(s.stage)}</b> — ${esc(c.title)} · ${esc(c.provider)}`);
      const ring = route.rings[next]; if (ring) tween(600, k => ring.scale.setScalar(1 + Math.sin(k * Math.PI) * .9));
      next++;
    }
  }, 'route');
  if (!alive()) return;
  chase = null; state.flying = false; orbitFromCamera();
  goal.radius = homeRadius; goal.phi = 1.12; goal.target.set(0, 3.6, 0);
  setBusy(false);
  showEnd();
}

/* =====================================================================
   PANELS
   ===================================================================== */
function chip(label, pressed, attrs) { return `<button class="fm-chip" aria-pressed="${pressed}" ${attrs}>${esc(label)}</button>`; }
function renderProfile() {
  $('#roleChips').innerHTML = DATA.roles.map(r => chip(r.label, state.profile.role === r.id, `data-action="role" data-id="${r.id}"`)).join('');
  $('#expChips').innerHTML = DATA.experience.map(e => chip(e.label, state.profile.experience === e.id, `data-action="exp" data-id="${e.id}"`)).join('');
  $('#interestChips').innerHTML = DATA.interests.map(i => chip(i.label, state.profile.interests.includes(i.id), `data-action="interest" data-id="${i.id}"`)).join('');
  renderPlanButton();
}
function renderPlanButton() {
  const b = $('#planBtn');
  b.disabled = !state.profile.interests.length;
  b.textContent = !state.plan ? 'Plan my route' : state.planProfileKey !== profileKey() ? 'Re-plan for my new answers' : 'Plan again';
}
function renderSteer() {
  $('#timeSeg').innerHTML = TIME_OPTIONS.map(([id, l]) => `<button role="radio" aria-checked="${state.steer.time === id}" data-action="time" data-id="${id}">${l}</button>`).join('');
  document.querySelectorAll('.fm-toggle').forEach(b => b.setAttribute('aria-pressed', String(!!state.steer[b.dataset.key])));
  $('#pins').innerHTML = state.pinned.map(id => `<button class="fm-pin" data-action="unpin" data-id="${id}" aria-label="Remove ${esc(byId(COURSES, id).title)} from your route">📌 ${esc(byId(COURSES, id).title)} ✕</button>`).join('');
}
function renderPlanList(changed = new Set()) {
  const plan = state.plan;
  if (!plan) { $('#planList').innerHTML = '<p class="fm-empty">Plan a route to see your four waypoints here.</p>'; return; }
  const ids = plan.stages.flatMap(s => s.courseIds), hours = ids.reduce((h, id) => h + byId(COURSES, id).hours, 0);
  $('#planList').innerHTML = plan.stages.map((s, i) => `
    <div class="fm-stage${changed.has(i) ? ' changed' : ''}">
      <div class="fm-stage-head">${i + 1} · ${s.stage}${changed.has(i) ? '<em>re-planned</em>' : ''}</div>
      ${s.courseIds.map(id => { const c = byId(COURSES, id); return `<button class="fm-course${state.selected === id ? ' sel' : ''}" data-action="select" data-id="${id}"><i style="background:${TRACK_COLORS[c.tracks[0]]}"></i><span><b>${esc(c.title)}</b><small>${esc(c.provider)} · ${LEVEL_LABEL[c.level]} · ≈${fmtHours(c.hours)}</small></span>${state.pinned.includes(id) ? '<span class="pin">added</span>' : ''}</button>`; }).join('')}
      ${s.relaxed ? `<p class="fm-relaxed">No course here met every limit — closest match shown.</p>` : ''}
    </div>`).join('') + `<p class="fm-total"><span>${ids.length} courses</span><span>≈ ${Math.round(hours)} hours in total</span></p>`;
}

/* course card: the agent explains itself */
function selectCourse(id) {
  state.selected = id;
  const n = nodeById(id);
  selRing.visible = true; selRing.position.copy(n.pos);
  goal.target.lerp(new THREE.Vector3(n.pos.x * .35, 3.6 + (n.pos.y - 3.6) * .35, n.pos.z * .35), .8);
  renderCard(id);
  renderPlanList();
  noteInput();
}
function renderCard(id) {
  const c = byId(COURSES, id), s = stageOf(id), outs = filterReasons(c), pinned = state.pinned.includes(id);
  let view;
  if (!state.plan) view = `<div class="fm-view fit"><b>Agent’s view</b>Plan a route and I’ll tell you whether this course fits you.</div>`;
  else if (s) view = `<div class="fm-view on"><b>On your route · ${s.stage}</b>${esc(reasonFor(c, s.stage))}</div>`;
  else if (outs.length) view = `<div class="fm-view out"><b>Filtered out</b><ul>${outs.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>`;
  else {
    const best = STAGES.find(st => c.stages.includes(st)) || STAGES[0];
    const chosen = state.plan.stages.find(x => x.stage === best).courseIds.map(x => byId(COURSES, x).title);
    view = `<div class="fm-view fit"><b>Fits you — not chosen</b>For ${best} I preferred ${esc(listText(chosen))}, a closer match to your answers. Add this one to override me.</div>`;
  }
  const action = pinned ? `<button class="fm-btn ghost small" data-action="unpin" data-id="${id}">Remove from my route</button>`
    : s ? '' : `<button class="fm-btn gold small" data-action="pin" data-id="${id}">${outs.length ? 'Add it anyway' : 'Add to my route'}</button>`;
  const card = $('#courseCard');
  card.innerHTML = `<button class="close" data-action="close-card" aria-label="Close">✕</button>
    <div class="fm-pills"><span class="fm-pill" style="color:${TRACK_COLORS[c.tracks[0]]};border-color:${TRACK_COLORS[c.tracks[0]]}">${esc(byId(DATA.tracks, c.tracks[0]).title)}</span><span class="fm-pill">${LEVEL_LABEL[c.level]}</span></div>
    <h3>${esc(c.title)}</h3><div class="meta">${esc(c.provider)} · ${esc(c.format)} · ≈${fmtHours(c.hours)} · ${c.cost === 'free' ? 'Free' : c.cost === 'membership' ? 'Membership' : 'Free & paid options'}</div>
    <p>${esc(c.summary)}</p>${view}
    <div class="row">${action}</div>
    <div class="fm-url">${esc(c.url.replace(/^https?:\/\//, ''))}</div>`;
  card.hidden = false;
}
function closeCard() { state.selected = null; selRing.visible = false; $('#courseCard').hidden = true; renderPlanList(); }

function showEnd() {
  const plan = state.plan, ids = plan.stages.flatMap(s => s.courseIds);
  const hours = ids.reduce((h, id) => h + byId(COURSES, id).hours, 0), providers = new Set(ids.map(id => byId(COURSES, id).provider.split(/ on | × | & /)[0]));
  const el = $('#endCard');
  el.innerHTML = `<p class="fm-eyebrow" style="justify-content:center">Flight plan filed ✓</p><h2>Ready for takeoff</h2>
    <p><b>${ids.length} courses</b> from <b>${providers.size} providers</b>, about <b>${Math.round(hours)} hours</b>, centred on <b>${esc(byId(DATA.tracks, plan.primaryTrack).title)}</b>.</p>
    <p style="font-size:.85rem">In the kiosk this hands over to your Agentic AI Passport, with a QR code that opens every course on your phone.</p>
    <div class="row"><button class="fm-btn gold" data-action="takeoff">Fly again</button><button class="fm-btn ghost" data-action="close-end">Adjust my route</button></div>`;
  el.hidden = false;
}
function closeEnd() { $('#endCard').hidden = true; }

/* =====================================================================
   ACTIONS
   ===================================================================== */
let steerTimer = 0;
function steerChanged() {
  renderSteer();
  if (!state.plan) return;
  clearTimeout(steerTimer);
  steerTimer = setTimeout(() => planRoute('steer'), 250);
}
const ACTIONS = {
  role: d => { state.profile.role = d.id; renderProfile(); },
  exp: d => { state.profile.experience = d.id; renderProfile(); },
  interest: d => {
    const a = state.profile.interests, i = a.indexOf(d.id);
    if (i >= 0) a.splice(i, 1); else a.push(d.id);
    renderProfile();
  },
  plan: () => { if (state.profile.interests.length) planRoute(state.plan && state.planProfileKey === profileKey() ? 'steer' : 'initial'); },
  time: d => { state.steer.time = d.id; steerChanged(); },
  toggle: d => { state.steer[d.key] = !state.steer[d.key]; steerChanged(); },
  pin: d => { if (!state.pinned.includes(d.id)) state.pinned.push(d.id); if (state.pinned.length > 4) state.pinned.shift(); steerChanged(); },
  unpin: d => { state.pinned = state.pinned.filter(x => x !== d.id); steerChanged(); },
  select: d => selectCourse(d.id),
  'close-card': () => closeCard(),
  takeoff: () => takeoff(),
  'close-end': () => closeEnd()
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  stopAttract();
  const fn = ACTIONS[el.dataset.action]; if (fn) fn(el.dataset);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCard(); closeEnd(); } noteInput(); });

/* attract mode: after a quiet minute the agent demonstrates on its own */
let attractTimer = 0;
function noteInput() { lastInput = performance.now(); if (state.attract) stopAttract(); }
function stopAttract() { if (!state.attract) return; state.attract = false; }
async function runAttract() {
  state.attract = true; let i = 0;
  while (state.attract) {
    state.profile = JSON.parse(JSON.stringify(SAMPLE_PROFILES[i++ % SAMPLE_PROFILES.length]));
    state.steer = { time: 'any', freeOnly: false, handsOn: false }; state.pinned = []; state.plan = null;
    renderProfile(); renderSteer(); closeCard(); closeEnd();
    await planRoute('initial'); if (!state.attract) return;
    await wait(2500); if (!state.attract) return;
    await takeoff(); if (!state.attract) return;
    await wait(4000);
  }
}
setInterval(() => { if (!state.attract && !state.busy && performance.now() - lastInput > 60000) runAttract(); }, 5000);
['pointerdown', 'keydown', 'wheel'].forEach(ev => window.addEventListener(ev, () => { lastInput = performance.now(); if (state.attract) { state.attract = false; planToken++; cancelTweens('route'); chase = null; state.flying = false; orbitFromCamera(); setBusy(false); say('Your turn — tell the agent about you, then press <b>Plan my route</b>.'); setSteps(-1); } }, { capture: true, passive: true }));

/* =====================================================================
   RENDER LOOP
   ===================================================================== */
const proj = new THREE.Vector3();
function updateLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  labels.forEach(l => {
    proj.copy(l.pos).project(camera);
    const behind = proj.z > 1;
    if (behind !== l.hidden) { l.hidden = behind; l.el.style.opacity = behind ? 0 : 1; }
    if (!behind) l.el.style.translate = `${(proj.x * .5 + .5) * w}px ${(-proj.y * .5 + .5) * h}px`;
  });
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const fit = 40 * Math.max(1, 1.25 / camera.aspect);
  if (Math.abs(goal.radius - homeRadius) < 0.5) { goal.radius = orbit.radius = fit; }
  homeRadius = fit;
  labelsEl.style.width = w + 'px'; labelsEl.style.height = h + 'px';
}
new ResizeObserver(resize).observe(canvas);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const time = now / 1000;
  tweens.forEach(t => {
    const k = Math.min(1, (now - t.start) / t.dur);
    t.update(k);
    if (k >= 1) { tweens.delete(t); t.resolve(); }
  });
  updateNodes(time, dt);
  if (route) route.rings.forEach(r => r.quaternion.copy(camera.quaternion));
  if (selRing.visible) { selRing.quaternion.copy(camera.quaternion); selRing.scale.setScalar(1 + Math.sin(time * 4) * .08); }
  originGroup.children[1].material.opacity = .7 + Math.sin(time * 2.2) * .25;
  // trail
  const arr = trailGeo.attributes.position.array;
  for (let i = 0; i < TRAIL_N; i++) { const p = trailPts[Math.min(i, trailPts.length - 1)] || agent.position; arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }
  trailGeo.attributes.position.needsUpdate = true;
  if (!route || !state.busy) { if (!trailPts.length || trailPts[0].distanceToSquared(agent.position) > 1e-6) { trailPts.unshift(agent.position.clone()); if (trailPts.length > TRAIL_N) trailPts.length = TRAIL_N; } }
  placeCamera(dt);
  updateLabels();
  renderer.render(scene, camera);
  if (!document.hidden) requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });

/* ---------- start ---------- */
renderProfile(); renderSteer(); setSteps(-1);
requestAnimationFrame(frame);
window.__flightMap = { state, planRoute, takeoff, selectCourse }; // for automated checks
