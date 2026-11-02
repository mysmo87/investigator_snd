'use strict';
/* Phone page opened from the passport QR code.
   URL fragment (never sent to the server):  #v=1&j=CODE&t=TRACK&l=LEVEL&c=c1.c2-c3-c4.c5-c6
   c = course refs per stage (discover-learn-practice-innovate), "." between courses. */
(function () {
  const DATA = window.CFT_CONTENT, CATALOG = window.CFT_CATALOG;
  const root = document.getElementById('journey');
  const STAGES = [
    ['Discover', 'Get oriented'], ['Learn', 'Build the foundations'], ['Practice', 'Get hands-on'], ['Innovate', 'Apply it to your work']
  ];
  const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const hours = h => h < 1 ? Math.round(h * 60) + ' min' : h + ' h';

  function fail(msg) {
    root.replaceChildren(el('p', 'j-empty', msg));
  }

  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const track = DATA.tracks.find(t => t.id === params.get('t'));
  const lvl = Number(params.get('l'));
  if (!track || !(lvl >= 0 && lvl <= 2)) return fail('This journey link is incomplete. Scan the QR code on your passport again, or visit the GDRFA booth.');
  const byRef = Object.fromEntries(CATALOG.courses.map(c => [c.ref, c]));
  const stages = String(params.get('c') || '').split('-').slice(0, 4).map(g => g.split('.').map(r => byRef[r]).filter(Boolean));

  const frag = document.createDocumentFragment();
  const hero = el('section', 'j-hero');
  hero.append(el('p', 'j-eyebrow', 'Your personalised learning journey'), el('h1', null, track.title));
  const meta = el('p', 'j-meta');
  meta.textContent = `${DATA.levels[lvl]} level` + (params.get('j') ? ` · ${String(params.get('j')).slice(0, 12)}` : '');
  hero.append(meta, el('p', 'j-desc', track.desc));
  frag.append(hero);

  stages.forEach((courses, i) => {
    if (!courses.length) return;
    const sec = el('section', 'j-stage');
    const head = el('div', 'j-stage-head');
    head.append(el('span', 'j-num', String(i + 1)), el('h2', null, STAGES[i][0]), el('span', 'j-sub', STAGES[i][1]));
    sec.append(head);
    courses.forEach(c => {
      const a = el('a', 'j-course');
      a.href = c.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.append(el('strong', null, c.title), el('span', 'j-prov', `${c.provider} · ${LEVEL[c.level]} · ≈${hours(c.hours)}`), el('span', 'j-sum', c.summary), el('span', 'j-open', 'Open course ↗'));
      sec.append(a);
    });
    frag.append(sec);
  });
  if (!stages.some(s => s.length)) frag.append(el('p', 'j-empty', 'No courses were found for this link. The course catalogue may have been updated — visit the booth for a new journey.'));
  root.replaceChildren(frag);
  document.title = `${track.title} — My AI Journey`;
})();
