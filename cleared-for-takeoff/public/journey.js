'use strict';
/* Phone page opened from the passport QR code.
   URL fragment (never sent to the server):  #p=CFT-XXXXX~KEY&v=1&t=TRACK&l=LEVEL&c=c1.c2-c3-c4.c5-c6  (j=CODE instead of p when not saved)
     p = a passport the visitor chose to save at the kiosk: reference ~ private key. When present, the page opens the
         saved passport (image, journey, delete option) from the server.
     the rest = the course list itself, so the link still works if the saved passport has expired or was deleted.
   c = course refs per stage (discover-learn-practice-innovate), "." between courses. */
(function () {
  const DATA = window.CFT_CONTENT, CATALOG = window.CFT_CATALOG;
  const root = document.getElementById('journey');
  const STAGES = { discover: ['Discover', 'Get oriented'], learn: ['Learn', 'Build the foundations'], practice: ['Practice', 'Get hands-on'], innovate: ['Innovate', 'Apply it to your work'] };
  const ORDER = ['discover', 'learn', 'practice', 'innovate'];
  const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const hours = h => h < 1 ? Math.round(h * 60) + ' min' : h + ' h';
  const byRef = Object.fromEntries(CATALOG.courses.map(c => [c.ref, c]));
  const date = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));

  function courseLink(c) {
    const a = el('a', 'j-course');
    a.href = c.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.append(el('strong', null, c.title), el('span', 'j-prov', `${c.provider} · ${LEVEL[c.level]} · ≈${hours(c.hours)}`), el('span', 'j-sum', c.summary), el('span', 'j-open', 'Open course ↗'));
    return a;
  }
  function stageSection(key, i, courses, topic, next) {
    const sec = el('section', 'j-stage'), head = el('div', 'j-stage-head'), [name, sub] = STAGES[key] || STAGES.discover;
    head.append(el('span', 'j-num', String(i + 1)), el('h2', null, name), el('span', 'j-sub', topic || sub));
    sec.append(head);
    courses.forEach(c => sec.append(courseLink(c)));
    if (next) { const n = el('p', 'j-next'); n.append(el('b', null, 'Next step: '), document.createTextNode(next)); sec.append(n); }
    return sec;
  }

  /* the course list from the link itself (no server, no personal information) */
  function renderLink(note) {
    const track = DATA.tracks.find(t => t.id === params.get('t'));
    const lvl = Number(params.get('l'));
    const frag = document.createDocumentFragment();
    if (note) frag.append(note);
    if (!track || !(lvl >= 0 && lvl <= 2)) { frag.append(el('p', 'j-empty', 'This journey link is incomplete. Scan the QR code on your passport again, or visit the GDRFA booth.')); root.replaceChildren(frag); return; }
    const stages = String(params.get('c') || '').split('-').slice(0, 4).map(g => g.split('.').map(r => byRef[r]).filter(Boolean));
    const hero = el('section', 'j-hero');
    hero.append(el('p', 'j-eyebrow', 'Your personalised learning journey'), el('h1', null, track.title));
    const code = params.get('j') || String(params.get('p') || '').split('~')[0];
    hero.append(el('p', 'j-meta', `${DATA.levels[lvl]} level` + (code ? ` · ${code.slice(0, 12)}` : '')), el('p', 'j-desc', track.desc));
    frag.append(hero);
    stages.forEach((courses, i) => { if (courses.length) frag.append(stageSection(ORDER[i], i, courses)); });
    if (!stages.some(s => s.length)) frag.append(el('p', 'j-empty', 'No courses were found for this link. The course catalogue may have been updated — visit the booth for a new journey.'));
    root.replaceChildren(frag);
    document.title = `${track.title} — My AI Journey`;
  }

  /* a passport the visitor saved at the kiosk */
  async function renderSaved(ref, key) {
    root.replaceChildren(el('p', 'j-empty', 'Opening your saved passport…'));
    let rec;
    try {
      const res = await fetch(`api/passports/${encodeURIComponent(ref)}`, { headers: { 'X-Passport-Key': key }, cache: 'no-store' });
      if (!res.ok) throw Object.assign(new Error(), { status: res.status });
      rec = await res.json();
    } catch (e) {
      const note = el('p', 'j-note', e.status === 404 ? 'Your saved passport is no longer available (it was deleted or has expired). Your courses are below.' : e.status === 403 ? 'This link doesn’t match a saved passport. Your courses are below.' : 'Your saved passport couldn’t be opened right now. Your courses are below; try again later.');
      return renderLink(note);
    }
    const track = DATA.tracks.find(t => t.id === rec.journey.track) || DATA.tracks[0];
    const first = rec.visitor.name.split(' ')[0];
    const frag = document.createDocumentFragment();
    const hero = el('section', 'j-hero');
    hero.append(el('p', 'j-eyebrow', `Agentic AI Passport · ${rec.ref}`), el('h1', null, `Welcome back, ${first}`), el('p', 'j-desc', 'Your passport and learning journey from the GDRFA booth at GITEX 2026.'));
    frag.append(hero);

    if (rec.image) {
      const card = el('section', 'j-pass'), img = el('img', 'j-pass-img'), actions = el('div', 'j-actions');
      img.alt = `Agentic AI Passport for ${rec.visitor.name}: ${track.title}, ${DATA.levels[rec.journey.level]} level`;
      const save = el('a', 'j-btn gold', 'Save passport image');
      save.download = `Agentic-AI-Passport-${rec.visitor.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || rec.ref}.jpg`;
      save.setAttribute('aria-disabled', 'true');
      actions.append(save);
      card.append(img, actions);
      frag.append(card);
      fetch(`api/passports/${encodeURIComponent(ref)}/image`, { headers: { 'X-Passport-Key': key }, cache: 'no-store' })
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error()))).then(b => {
          const url = URL.createObjectURL(b); img.src = url; save.href = url; save.removeAttribute('aria-disabled');
          if (navigator.canShare && navigator.canShare({ files: [new File([b], save.download, { type: 'image/jpeg' })] })) {
            const share = el('button', 'j-btn', 'Share');
            share.type = 'button';
            share.addEventListener('click', () => navigator.share({ files: [new File([b], save.download, { type: 'image/jpeg' })], title: 'My Agentic AI Passport' }).catch(() => {}));
            actions.append(share);
          }
        }).catch(() => { img.replaceWith(el('p', 'j-note', 'The passport image couldn’t be loaded. Your journey is below.')); save.remove(); });
    }
    const keep = el('p', 'j-tip');
    keep.append(el('b', null, 'Keep this page: '), document.createTextNode(`bookmark it or add it to your home screen to open your passport any time until ${date(rec.expiresAt)}.`));
    frag.append(keep);

    const journey = el('section', 'j-hero j-journey');
    journey.append(el('p', 'j-eyebrow', 'Your personalised learning journey'), el('h1', null, track.title), el('p', 'j-meta', `${DATA.levels[rec.journey.level]} level`));
    if (rec.journey.summary) journey.append(el('p', 'j-desc', rec.journey.summary));
    const session = rec.attended && DATA.sessions.find(s => s.id === rec.attended);
    if (session) journey.append(el('p', 'j-attended', `✓ Attended: ${session.title}`));
    frag.append(journey);
    rec.journey.stages.forEach((s, i) => { const courses = s.courses.map(r => byRef[r]).filter(Boolean); if (courses.length) frag.append(stageSection(s.key, i, courses, s.topic, s.next)); });

    const priv = el('section', 'j-privacy');
    priv.append(el('h2', null, 'Your saved details'), el('p', null, `GDRFA keeps your name, email, organization, passport image and learning journey until ${date(rec.expiresAt)}, then deletes them automatically. You can delete them now instead.`));
    const del = el('button', 'j-btn danger', 'Delete my saved passport');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!window.confirm('Delete your saved passport? Your name, email, organization, passport image and journey will be removed from GDRFA’s server. This can’t be undone.')) return;
      del.disabled = true; del.textContent = 'Deleting…';
      try {
        const res = await fetch(`api/passports/${encodeURIComponent(ref)}`, { method: 'DELETE', headers: { 'X-Passport-Key': key } });
        if (!res.ok && res.status !== 404) throw new Error();
        params.delete('p'); history.replaceState(null, '', '#' + params.toString()); // the link now only opens the course list
        renderLink(el('p', 'j-note ok', 'Your saved passport was deleted. Your course list stays available from this link.'));
        document.getElementById('jPrivacy').textContent = 'This page is built from the code in your QR link — it contains no personal information.';
        window.scrollTo(0, 0);
      } catch { del.disabled = false; del.textContent = 'Delete my saved passport'; window.alert('It couldn’t be deleted right now. Please try again.'); }
    });
    priv.append(del);
    frag.append(priv);
    root.replaceChildren(frag);
    document.getElementById('jPrivacy').textContent = 'Only someone with your QR code or this link can open your saved passport — keep it to yourself.';
    document.title = `${first}’s Agentic AI Passport`;
  }

  const saved = /^(CFT-[0-9A-Z]{5})~([A-Z0-9]{12})$/.exec(String(params.get('p') || ''));
  if (saved) renderSaved(saved[1], saved[2]); else renderLink();
})();
