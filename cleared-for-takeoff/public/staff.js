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
  function fail(msg) { const e = $('sErr'); e.textContent = msg; e.hidden = false; }
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
  }
  $('sForm').addEventListener('submit', e => { e.preventDefault(); key = $('sKey').value.trim(); $('sKey').value = ''; if (key) load(); });
  $('sFilter').addEventListener('input', render);
  $('sLock').addEventListener('click', () => { key = ''; rows = []; $('sRows').replaceChildren(); $('sFilter').value = ''; $('sList').hidden = true; $('sLogin').hidden = false; $('sKey').focus(); });
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
