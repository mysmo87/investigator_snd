'use strict';
/* Staff list of saved passports: GET api/passports/export with the staff key (PASSPORT_ADMIN_TOKEN).
   The key lives only in this page's memory; nothing is written to browser storage. */
(function () {
  const $ = id => document.getElementById(id);
  let key = '', rows = [];
  const when = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '');
  const day = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const cell = (text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text || ''; return td; };

  function render() {
    const q = $('sFilter').value.trim().toLowerCase();
    const shown = q ? rows.filter(r => [r.name, r.email, r.organization, r.track, r.passport].join(' ').toLowerCase().includes(q)) : rows;
    $('sRows').replaceChildren(...shown.map(r => {
      const tr = document.createElement('tr');
      tr.append(cell(r.passport, 'mono'), cell(when(r.created)), cell(r.name), cell(r.email), cell(r.organization), cell(r.track), cell(r.level), cell(r.attended), cell(day(r.deleteAfter)));
      return tr;
    }));
    $('sCount').textContent = q ? `${shown.length} of ${rows.length} saved passports` : `${rows.length} saved passport${rows.length === 1 ? '' : 's'}`;
  }
  /* ---------- Interactions (anonymous counts) ---------- */
  const ORDER = ['journey_generated', 'passport_created', 'passport_deleted', 'avatar_ai_created', 'big_screen_shown', 'session_attended', 'fekra_proposal_saved', 'fekra_pdf_downloaded'];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const n = v => (v || 0).toLocaleString('en-GB');
  function bars(title, counts) {
    const box = el('div', 'i-box'); box.append(el('h3', null, title));
    const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { box.append(el('p', 'i-empty', 'No data yet')); return box; }
    const max = entries[0][1], total = entries.reduce((s, [, v]) => s + v, 0);
    entries.forEach(([label, v]) => {
      const row = el('div', 'i-row'); row.title = `${label}: ${n(v)} (${Math.round(v / total * 100)}%)`;
      const bar = el('span', 'bar'), fill = el('i'); fill.style.width = `${Math.max(2, v / max * 100)}%`; bar.append(fill);
      row.append(el('span', 'lbl', label), el('span', 'val', `${n(v)} · ${Math.round(v / total * 100)}%`), bar);
      box.append(row);
    });
    return box;
  }
  function renderInteractions(s) {
    const L = s.labels || {};
    const tiles = ORDER.map(t => {
      const tile = el('div', 'i-tile' + (t === 'journey_generated' ? ' hero' : ''));
      tile.append(el('small', null, L[t] || t), el('b', null, n(s.totals[t])), el('span', null, `Today: ${n(s.todayTotals[t])}`));
      return tile;
    });
    if (s.conversion != null) { const c = el('div', 'i-tile'); c.append(el('small', null, 'Journeys that ended in a passport'), el('b', null, `${s.conversion}%`), el('span', null, 'All time')); tiles.splice(2, 0, c); }
    $('iTiles').replaceChildren(...tiles);
    $('iBreak').replaceChildren(
      bars('Journeys by learning track', s.journeys.byTrack), bars('Journeys by level', s.journeys.byLevel),
      bars('Journeys by role', s.journeys.byRole), bars('Passports by avatar', s.passports.byAvatar),
      bars('Recommended by', s.journeys.bySource));
    const cols = ['journey_generated', 'passport_created', 'passport_deleted', 'avatar_ai_created', 'big_screen_shown'];
    $('iDaysHead').replaceChildren(el('th', null, 'Day'), ...cols.map(c => el('th', null, L[c] || c)));
    $('iDays').replaceChildren(...(s.byDay.length ? s.byDay : [{ date: 'No interactions yet' }]).map(d => {
      const tr = document.createElement('tr'); tr.append(cell(d.date === 'No interactions yet' ? d.date : day(d.date + 'T12:00:00Z'), 'mono'), ...cols.map(c => cell(d.date === 'No interactions yet' ? '' : n(d[c]), 'n'))); return tr;
    }));
  }
  async function loadInteractions() {
    $('iErr').hidden = true;
    try {
      const res = await fetch('api/interactions', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'The interaction counts could not be loaded.');
      renderInteractions(out);
      if (!out.storage.persistent) { $('iErr').textContent = 'Temporary storage: interaction counts are lost whenever the server is redeployed. Attach a volume on Railway and set DATA_DIR.'; $('iErr').hidden = false; }
    } catch (e) { $('iErr').textContent = e.message; $('iErr').hidden = false; }
    $('sInter').hidden = false;
  }

  function fail(msg) { const e = $('sErr'); e.textContent = msg; e.hidden = false; }
  /* ---------- Fekra proposals and who downloaded them ---------- */
  let proposals = [];
  const STATUS = { draft: 'Draft', under_review: 'Under review', finalized: 'Finalized' };
  function renderFekra() {
    const q = $('fFilter').value.trim().toLowerCase();
    const shown = q ? proposals.filter(p => [p.ref, p.title, ...p.downloads.map(d => d.email || '')].join(' ').toLowerCase().includes(q)) : proposals;
    $('fRows').replaceChildren(...shown.map(p => {
      const tr = document.createElement('tr');
      const emails = [...new Set(p.downloads.map(d => d.email).filter(Boolean))];
      const last = p.downloads[0];
      tr.append(cell(p.ref, 'mono'), cell(p.title || '(untitled)'), cell(STATUS[p.status] || p.status), cell(when(p.updatedAt)), cell(emails.join(', ') || '—'), cell(last ? when(last.at) + (p.downloads.length > 1 ? ` (${p.downloads.length} times)` : '') : '—'));
      const pdfCell = document.createElement('td');
      if (p.pdfAt) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'j-btn'; btn.textContent = 'Download PDF';
        btn.addEventListener('click', () => downloadPdf(p.ref, btn));
        pdfCell.append(btn);
      } else pdfCell.textContent = '—';
      tr.append(pdfCell);
      return tr;
    }));
    const withEmail = proposals.filter(p => p.downloads.some(d => d.email)).length;
    $('fCount').textContent = `${proposals.length} Fekra proposal${proposals.length === 1 ? '' : 's'} · ${withEmail} downloaded with an email`;
  }
  async function loadFekra() {
    try {
      const res = await fetch('api/fekra/export', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'The Fekra proposals could not be loaded.');
      proposals = out.proposals || [];
      const warn = [];
      if (!out.storage || !out.storage.persistent) warn.push('Temporary storage: proposals are lost whenever the server is redeployed. Attach a volume on Railway and set DATA_DIR.');
      $('fWarn').textContent = warn.join(' '); $('fWarn').hidden = !warn.length;
      renderFekra();
    } catch (e) { $('fWarn').textContent = e.message; $('fWarn').hidden = false; }
    $('sFekra').hidden = false;
  }
  /* the copy of the PDF the person downloaded, to attach when the team emails it to them */
  async function downloadPdf(ref, btn) {
    btn.disabled = true;
    try {
      const res = await fetch(`api/fekra/export/${encodeURIComponent(ref)}/pdf`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (!res.ok) throw new Error();
      const blob = await res.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `Fekra-${ref}.pdf`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.alert('The PDF could not be downloaded. Try again.'); }
    btn.disabled = false;
  }
  $('fFilter').addEventListener('input', renderFekra);
  $('fCsv').addEventListener('click', async () => {
    const btn = $('fCsv'); btn.disabled = true;
    try {
      const res = await fetch('api/fekra/export?format=csv', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (!res.ok) throw new Error();
      const blob = await res.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `fekra-proposals-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.alert('The Fekra CSV could not be downloaded. Try again.'); }
    btn.disabled = false;
  });

  async function load() {
    $('sErr').hidden = true;
    let res;
    try { res = await fetch('api/passports/export', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' }); }
    catch { return fail('The server could not be reached. Check the connection and try again.'); }
    const out = await res.json().catch(() => ({}));
    if (res.status === 401) { key = ''; return fail('The staff key is not correct.'); }
    if (out.reason === 'not_configured') return fail('Staff access is not set up: set PASSPORT_ADMIN_TOKEN (at least 20 characters) in the server’s variables.');
    if (out.reason === 'no_store') return fail('Saving passports is turned off on this server (PASSPORT_SAVE=off).');
    if (!res.ok) return fail(out.error || 'The list could not be loaded.');
    rows = out.passports || [];
    $('sInfo').textContent = `Each passport is deleted automatically ${out.storage.retentionDays} days after it was saved, or sooner if the visitor deletes it from their phone.`;
    $('sWarn').hidden = !!out.storage.persistent;
    $('sLogin').hidden = true; $('sList').hidden = false;
    render();
    loadInteractions();
    loadFekra();
  }
  $('sForm').addEventListener('submit', e => { e.preventDefault(); key = $('sKey').value.trim(); $('sKey').value = ''; if (key) load(); });
  $('sFilter').addEventListener('input', render);
  $('sLock').addEventListener('click', () => { key = ''; rows = []; $('sRows').replaceChildren(); $('sFilter').value = ''; $('sList').hidden = true; $('sInter').hidden = true; $('sFekra').hidden = true; proposals = []; $('fRows').replaceChildren(); $('fFilter').value = ''; $('iTiles').replaceChildren(); $('iBreak').replaceChildren(); $('iDays').replaceChildren(); $('sLogin').hidden = false; $('sKey').focus(); });
  $('iCsv').addEventListener('click', async () => {
    const btn = $('iCsv'); btn.disabled = true;
    try {
      const res = await fetch('api/interactions?format=csv', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (!res.ok) throw new Error();
      const blob = await res.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `agentic-ai-interactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.alert('The interactions CSV could not be downloaded. Try again.'); }
    btn.disabled = false;
  });
  $('sCsv').addEventListener('click', async () => {
    const btn = $('sCsv'); btn.disabled = true;
    try {
      const res = await fetch('api/passports/export?format=csv', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (!res.ok) throw new Error();
      const blob = await res.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `agentic-ai-passports-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.alert('The CSV could not be downloaded. Try again.'); }
    btn.disabled = false;
  });
})();
