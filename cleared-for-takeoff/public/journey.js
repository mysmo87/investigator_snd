'use strict';
/* Phone page opened from the passport QR code.
   URL fragment (never sent to the server):  #p=CFT-XXXXX~KEY&v=1&t=TRACK&l=LEVEL&c=c1.c2-c3-c4.c5-c6&lg=ar  (j=CODE instead of p when not saved)
     p = a passport the visitor chose to save at the kiosk: reference ~ private key. When present, the page opens the
         saved passport (image, journey, delete option) from the server.
     the rest = the course list itself, so the link still works if the saved passport has expired or was deleted.
   c = course refs per stage (discover-learn-practice-innovate), "." between courses.
   lg = ar opens the page in Arabic (the kiosk's language when the passport was made); the visitor can switch here too. */
(function () {
  const EN = { content: window.CFT_CONTENT, catalog: window.CFT_CATALOG };
  const AR = { content: window.CFT_LOCALIZE.localizeContent(EN.content, window.CFT_CONTENT_AR), catalog: window.CFT_LOCALIZE.localizeCatalog(EN.catalog, window.CFT_CONTENT_AR) };
  const TEXT = {
    'Discover': 'اكتشف', 'Learn': 'تعلّم', 'Practice': 'طبّق', 'Innovate': 'ابتكر',
    'Get oriented': 'ابدأ بالتعرّف', 'Build the foundations': 'ابنِ الأساسيات', 'Get hands-on': 'طبّق عملياً', 'Apply it to your work': 'طبّقه في عملك',
    'Beginner': 'مبتدئ', 'Intermediate': 'متوسط', 'Advanced': 'متقدم', '{m} min': '{m} دقيقة', '{h} h': '{h} ساعة',
    'Open course ↗': 'افتح الدورة ↗', 'Next step: ': 'الخطوة التالية: ', 'Course taught in English': 'الدورة باللغة الإنجليزية',
    'This journey link is incomplete. Scan the QR code on your passport again, or visit the GDRFA booth.': 'رابط الرحلة غير مكتمل. امسح رمز QR على جوازك مرة أخرى، أو زُر جناح إقامة دبي.',
    'Your personalised learning journey': 'رحلة التعلّم الشخصية', '{l} level': 'مستوى {l}',
    'No courses were found for this link. The course catalogue may have been updated — visit the booth for a new journey.': 'لم يُعثر على دورات لهذا الرابط. ربما حُدّثت قائمة الدورات، فزُر الجناح للحصول على رحلة جديدة.',
    '{t} — My AI Journey': '{t} — رحلتي في الذكاء الاصطناعي', 'Opening your saved passport…': 'نفتح جوازك المحفوظ…',
    'Your saved passport is no longer available (it was deleted or has expired). Your courses are below.': 'جوازك المحفوظ لم يعد متاحاً (حُذف أو انتهت مدته). دوراتك أدناه.',
    'This link doesn’t match a saved passport. Your courses are below.': 'هذا الرابط لا يطابق جوازاً محفوظاً. دوراتك أدناه.',
    'Your saved passport couldn’t be opened right now. Your courses are below; try again later.': 'تعذّر فتح جوازك المحفوظ الآن. دوراتك أدناه، وحاول مرة أخرى لاحقاً.',
    'Agentic AI Passport · {r}': 'جواز الذكاء الاصطناعي الوكيل · {r}', 'Welcome back, {n}': 'أهلاً بعودتك، {n}',
    'Your passport and learning journey from the GDRFA booth at GITEX 2026.': 'جوازك ورحلة تعلّمك من جناح إقامة دبي في جيتكس 2026.',
    'Agentic AI Passport for {n}: {t}, {l} level': 'جواز الذكاء الاصطناعي الوكيل لـ{n}: {t}، مستوى {l}', 'Save passport image': 'احفظ صورة الجواز', 'Share': 'مشاركة',
    'My Agentic AI Passport': 'جواز الذكاء الاصطناعي الوكيل الخاص بي', 'The passport image couldn’t be loaded. Your journey is below.': 'تعذّر تحميل صورة الجواز. رحلتك أدناه.',
    'Keep this page: ': 'احتفظ بهذه الصفحة: ', 'bookmark it or add it to your home screen to open your passport any time until {d}.': 'احفظها في المفضلة أو أضفها إلى الشاشة الرئيسية لفتح جوازك في أي وقت حتى {d}.',
    '✓ Attended: {t}': '✓ حضرت: {t}', 'Your saved details': 'بياناتك المحفوظة',
    'GDRFA keeps your name, email, organization, passport image and learning journey until {d}, then deletes them automatically. You can delete them now instead.': 'تحتفظ إقامة دبي باسمك وبريدك الإلكتروني وجهتك وصورة جوازك ورحلة تعلّمك حتى {d}، ثم تحذفها تلقائياً. ويمكنك حذفها الآن بدلاً من ذلك.',
    'Delete my saved passport': 'احذف جوازي المحفوظ', 'Deleting…': 'نحذف…',
    'Delete your saved passport? Your name, email, organization, passport image and journey will be removed from GDRFA’s server. This can’t be undone.': 'هل تريد حذف جوازك المحفوظ؟ سيُزال اسمك وبريدك الإلكتروني وجهتك وصورة جوازك ورحلتك من خادم إقامة دبي، ولا يمكن التراجع عن ذلك.',
    'Your saved passport was deleted. Your course list stays available from this link.': 'حُذف جوازك المحفوظ. تبقى قائمة دوراتك متاحة من هذا الرابط.',
    'It couldn’t be deleted right now. Please try again.': 'تعذّر الحذف الآن. يُرجى المحاولة مرة أخرى.',
    'This page is built from the code in your QR link — it contains no personal information.': 'تُبنى هذه الصفحة من الرمز الموجود في رابط QR الخاص بك، ولا تحتوي على أي معلومات شخصية.',
    'Only someone with your QR code or this link can open your saved passport — keep it to yourself.': 'لا يستطيع فتح جوازك المحفوظ إلا من لديه رمز QR أو هذا الرابط، فاحتفظ به لنفسك.',
    'Courses are run by their providers; content, pricing and certificates may change. GDRFA does not operate these courses.': 'تقدم الجهات المزودة هذه الدورات، وقد يتغير محتواها وأسعارها وشهاداتها. لا تدير إقامة دبي هذه الدورات.',
    '{n}’s Agentic AI Passport': 'جواز الذكاء الاصطناعي الوكيل — {n}', 'AGENTIC AI: ': 'الذكاء الاصطناعي الوكيل: ', 'CLEARED FOR TAKEOFF': 'جاهزون للإقلاع'
  };
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  let lang = params.get('lg') === 'ar' ? 'ar' : 'en', DATA, CATALOG, byRef;
  const tr = (s, v) => { let out = lang === 'ar' && TEXT[s] ? TEXT[s] : s; if (v) out = out.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m)); return out; };
  const root = document.getElementById('journey');
  const STAGES = { discover: ['Discover', 'Get oriented'], learn: ['Learn', 'Build the foundations'], practice: ['Practice', 'Get hands-on'], innovate: ['Innovate', 'Apply it to your work'] };
  const ORDER = ['discover', 'learn', 'practice', 'innovate'];
  const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const hours = h => (h < 1 ? tr('{m} min', { m: Math.round(h * 60) }) : tr('{h} h', { h }));
  const date = iso => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  function courseLink(c) {
    const a = el('a', 'j-course');
    a.href = c.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const title = el('strong', null, c.title); title.dir = 'auto';
    a.append(title, el('span', 'j-prov', `${c.provider} · ${tr(LEVEL[c.level])} · ≈${hours(c.hours)}`), el('span', 'j-sum', c.summary), el('span', 'j-open', tr('Open course ↗')));
    return a;
  }
  function stageSection(key, i, courses, topic, next) {
    const sec = el('section', 'j-stage'), head = el('div', 'j-stage-head'), [name, sub] = STAGES[key] || STAGES.discover;
    head.append(el('span', 'j-num', String(i + 1)), el('h2', null, tr(name)), el('span', 'j-sub', topic || tr(sub)));
    sec.append(head);
    courses.forEach(c => sec.append(courseLink(c)));
    if (next) { const n = el('p', 'j-next'); n.append(el('b', null, tr('Next step: ')), document.createTextNode(next)); sec.append(n); }
    return sec;
  }
  const setPrivacy = text => { document.getElementById('jPrivacy').textContent = tr(text); };

  /* the course list from the link itself (no server, no personal information) */
  function renderLink(note) {
    const track = DATA.tracks.find(t => t.id === params.get('t'));
    const lvl = Number(params.get('l'));
    const frag = document.createDocumentFragment();
    if (note) frag.append(note);
    setPrivacy('This page is built from the code in your QR link — it contains no personal information.');
    if (!track || !(lvl >= 0 && lvl <= 2)) { frag.append(el('p', 'j-empty', tr('This journey link is incomplete. Scan the QR code on your passport again, or visit the GDRFA booth.'))); root.replaceChildren(frag); return; }
    const stages = String(params.get('c') || '').split('-').slice(0, 4).map(g => g.split('.').map(r => byRef[r]).filter(Boolean));
    const hero = el('section', 'j-hero');
    hero.append(el('p', 'j-eyebrow', tr('Your personalised learning journey')), el('h1', null, track.title));
    const code = params.get('j') || String(params.get('p') || '').split('~')[0];
    hero.append(el('p', 'j-meta', tr('{l} level', { l: DATA.levels[lvl] }) + (code ? ` · ${code.slice(0, 12)}` : '')), el('p', 'j-desc', track.desc));
    frag.append(hero);
    stages.forEach((courses, i) => { if (courses.length) frag.append(stageSection(ORDER[i], i, courses)); });
    if (!stages.some(s => s.length)) frag.append(el('p', 'j-empty', tr('No courses were found for this link. The course catalogue may have been updated — visit the booth for a new journey.')));
    root.replaceChildren(frag);
    document.title = tr('{t} — My AI Journey', { t: track.title });
  }

  /* a passport the visitor saved at the kiosk (fetched once; a language switch redraws it from memory) */
  let saved = null, savedRec = null, imageBlob = null;
  async function renderSaved(ref, key) {
    if (!savedRec) {
      root.replaceChildren(el('p', 'j-empty', tr('Opening your saved passport…')));
      try {
        const res = await fetch(`api/passports/${encodeURIComponent(ref)}`, { headers: { 'X-Passport-Key': key }, cache: 'no-store' });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        savedRec = await res.json();
      } catch (e) {
        const msg = e.status === 404 ? 'Your saved passport is no longer available (it was deleted or has expired). Your courses are below.' : e.status === 403 ? 'This link doesn’t match a saved passport. Your courses are below.' : 'Your saved passport couldn’t be opened right now. Your courses are below; try again later.';
        saved = null; render = () => renderLink(el('p', 'j-note', tr(msg)));
        return render();
      }
    }
    const rec = savedRec;
    const track = DATA.tracks.find(t => t.id === rec.journey.track) || DATA.tracks[0];
    const first = rec.visitor.name.split(' ')[0];
    const frag = document.createDocumentFragment();
    const hero = el('section', 'j-hero');
    hero.append(el('p', 'j-eyebrow', tr('Agentic AI Passport · {r}', { r: rec.ref })), el('h1', null, tr('Welcome back, {n}', { n: first })), el('p', 'j-desc', tr('Your passport and learning journey from the GDRFA booth at GITEX 2026.')));
    frag.append(hero);

    if (rec.image) {
      const card = el('section', 'j-pass'), img = el('img', 'j-pass-img'), actions = el('div', 'j-actions');
      img.alt = tr('Agentic AI Passport for {n}: {t}, {l} level', { n: rec.visitor.name, t: track.title, l: DATA.levels[rec.journey.level] });
      const save = el('a', 'j-btn gold', tr('Save passport image'));
      save.download = `Agentic-AI-Passport-${rec.visitor.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || rec.ref}.jpg`;
      save.setAttribute('aria-disabled', 'true');
      actions.append(save);
      card.append(img, actions);
      frag.append(card);
      const show = b => {
        const url = URL.createObjectURL(b); img.src = url; save.href = url; save.removeAttribute('aria-disabled');
        const file = new File([b], save.download, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          const share = el('button', 'j-btn', tr('Share'));
          share.type = 'button';
          share.addEventListener('click', () => navigator.share({ files: [file], title: tr('My Agentic AI Passport') }).catch(() => {}));
          actions.append(share);
        }
      };
      if (imageBlob) show(imageBlob);
      else fetch(`api/passports/${encodeURIComponent(ref)}/image`, { headers: { 'X-Passport-Key': key }, cache: 'no-store' })
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error()))).then(b => { imageBlob = b; show(b); })
        .catch(() => { img.replaceWith(el('p', 'j-note', tr('The passport image couldn’t be loaded. Your journey is below.'))); save.remove(); });
    }
    const keep = el('p', 'j-tip');
    keep.append(el('b', null, tr('Keep this page: ')), document.createTextNode(tr('bookmark it or add it to your home screen to open your passport any time until {d}.', { d: date(rec.expiresAt) })));
    frag.append(keep);

    const journey = el('section', 'j-hero j-journey');
    journey.append(el('p', 'j-eyebrow', tr('Your personalised learning journey')), el('h1', null, track.title), el('p', 'j-meta', tr('{l} level', { l: DATA.levels[rec.journey.level] })));
    if (rec.journey.summary) { const sum = el('p', 'j-desc', rec.journey.summary); sum.dir = 'auto'; journey.append(sum); }
    const session = rec.attended && DATA.sessions.find(s => s.id === rec.attended);
    if (session) journey.append(el('p', 'j-attended', tr('✓ Attended: {t}', { t: session.title })));
    frag.append(journey);
    rec.journey.stages.forEach((s, i) => { const courses = s.courses.map(r => byRef[r]).filter(Boolean); if (courses.length) frag.append(stageSection(s.key, i, courses, s.topic, s.next)); });

    const priv = el('section', 'j-privacy');
    priv.append(el('h2', null, tr('Your saved details')), el('p', null, tr('GDRFA keeps your name, email, organization, passport image and learning journey until {d}, then deletes them automatically. You can delete them now instead.', { d: date(rec.expiresAt) })));
    const del = el('button', 'j-btn danger', tr('Delete my saved passport'));
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!window.confirm(tr('Delete your saved passport? Your name, email, organization, passport image and journey will be removed from GDRFA’s server. This can’t be undone.'))) return;
      del.disabled = true; del.textContent = tr('Deleting…');
      try {
        const res = await fetch(`api/passports/${encodeURIComponent(ref)}`, { method: 'DELETE', headers: { 'X-Passport-Key': key } });
        if (!res.ok && res.status !== 404) throw new Error();
        params.delete('p'); history.replaceState(null, '', '#' + params.toString()); // the link now only opens the course list
        saved = null; savedRec = null; imageBlob = null;
        render = () => renderLink(el('p', 'j-note ok', tr('Your saved passport was deleted. Your course list stays available from this link.')));
        render();
        window.scrollTo(0, 0);
      } catch { del.disabled = false; del.textContent = tr('Delete my saved passport'); window.alert(tr('It couldn’t be deleted right now. Please try again.')); }
    });
    priv.append(del);
    frag.append(priv);
    root.replaceChildren(frag);
    setPrivacy('Only someone with your QR code or this link can open your saved passport — keep it to yourself.');
    document.title = tr('{n}’s Agentic AI Passport', { n: first });
  }

  /* language: the page's text, the booth content and the layout direction */
  const btn = document.getElementById('jLang');
  function applyLang() {
    ({ content: DATA, catalog: CATALOG } = lang === 'ar' ? AR : EN);
    byRef = Object.fromEntries(CATALOG.courses.map(c => [c.ref, c]));
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    btn.textContent = lang === 'ar' ? 'English' : 'العربية'; btn.lang = lang === 'ar' ? 'en' : 'ar';
    document.getElementById('jFoot').textContent = tr('Courses are run by their providers; content, pricing and certificates may change. GDRFA does not operate these courses.');
    document.getElementById('jBrand').replaceChildren(document.createTextNode(tr('AGENTIC AI: ')), el('span', null, tr('CLEARED FOR TAKEOFF')));
  }
  btn.addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    if (lang === 'ar') params.set('lg', 'ar'); else params.delete('lg');
    history.replaceState(null, '', '#' + params.toString()); // a bookmark keeps the chosen language
    applyLang(); render();
  });

  saved = /^(CFT-[0-9A-Z]{5})~([A-Z0-9]{12})$/.exec(String(params.get('p') || ''));
  let render = () => (saved ? renderSaved(saved[1], saved[2]) : renderLink());
  applyLang(); render();
})();
