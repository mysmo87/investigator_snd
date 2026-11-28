'use strict';
/* Fekra PDF downloads: the email is asked for and kept with the proposal, with a copy of the PDF, so GDRFA can send
   it on later (nothing is emailed automatically); anonymous counts are logged; staff can list, export and fetch the PDF. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createStore } = require('../server/fekra-store');
const { createInteractionLog } = require('../server/interactions');
const { createApp } = require('../server/app');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');
const { emptyProposal } = require('../server/fekra');
const content = require('../public/data/content.js');

const TOKEN = 'staff-token-0123456789-abcdef';
const PDF_BYTES = Buffer.from('%PDF-1.4\n% test proposal\n');
const PDF = 'data:application/pdf;base64,' + PDF_BYTES.toString('base64');

async function setup(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fekra-download-'));
  const config = loadConfig({ DATA_DIR: dir, PASSPORT_ADMIN_TOKEN: TOKEN, ...env });
  const store = createStore({ dir: config.fekra.storeDir, persistent: true });
  const interactions = createInteractionLog({ dir: path.join(dir, 'interactions'), content, logger: silentLogger });
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, store, interactions, rules: {}, content, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (method, url, body, headers = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
    .then(async r => ({ status: r.status, type: r.headers.get('content-type'), buf: Buffer.from(await r.arrayBuffer()) }))
    .then(r => ({ ...r, text: r.buf.toString('utf8'), body: /json/.test(r.type) ? JSON.parse(r.buf.toString('utf8')) : null }));
  const saved = (await req('POST', '/api/fekra/proposals', { status: 'draft', lang: 'en', payload: { proposal: { ...emptyProposal(), title: 'Delay early-warning' }, messages: [{ role: 'user', text: 'idea' }] } })).body;
  return { req, dir, interactions, saved, k: { 'X-Fekra-Key': saved.key }, staff: { Authorization: `Bearer ${TOKEN}` }, close: () => server.close() };
}

test('a download keeps the email and a copy of the PDF with the proposal, and counts it anonymously', async () => {
  const s = await setup();
  try {
    const r = await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { email: 'aisha@example.ae', lang: 'en', pdf: PDF }, s.k);
    assert.equal(r.status, 200); assert.deepEqual(r.body, { recorded: true, email: true, pdfKept: true });
    const ex = await s.req('GET', '/api/fekra/export', null, s.staff);
    assert.equal(ex.status, 200); assert.equal(ex.body.count, 1);
    const p = ex.body.proposals[0];
    assert.equal(p.downloads[0].email, 'aisha@example.ae'); assert.ok(p.pdfAt);
    assert.ok(!('emailed' in p.downloads[0])); // nothing is sent
    const pdf = await s.req('GET', `/api/fekra/export/${s.saved.ref}/pdf`, null, s.staff);
    assert.equal(pdf.status, 200); assert.equal(pdf.type, 'application/pdf'); assert.ok(pdf.buf.equals(PDF_BYTES));
    const csv = await s.req('GET', '/api/fekra/export?format=csv', null, s.staff);
    assert.match(csv.text, /reference,title,status,created,updated,email,downloaded,language,pdfKept/); assert.match(csv.text, /aisha@example\.ae/);
    const counts = await s.interactions.summary();
    assert.equal(counts.totals.fekra_pdf_downloaded, 1);
    assert.ok(!JSON.stringify(await s.interactions.list()).includes('aisha')); // the interaction log stays anonymous
    // a later download replaces the kept PDF and adds a row
    await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { email: 'omar@example.ae', lang: 'ar', pdf: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7 v2').toString('base64') }, s.k);
    const ex2 = await s.req('GET', '/api/fekra/export', null, s.staff);
    assert.deepEqual(ex2.body.proposals[0].downloads.map(d => d.email), ['omar@example.ae', 'aisha@example.ae']);
    assert.equal((await s.req('GET', `/api/fekra/export/${s.saved.ref}/pdf`, null, s.staff)).text, '%PDF-1.7 v2');
  } finally { s.close(); }
});

test('the email is required by default and checked; the access code and the staff key are needed', async () => {
  const s = await setup();
  try {
    const url = `/api/fekra/proposals/${s.saved.ref}/download`;
    assert.equal((await s.req('POST', url, { lang: 'en', pdf: PDF }, s.k)).body.reason, 'email_required');
    assert.equal((await s.req('POST', url, { email: 'not-an-email', pdf: PDF }, s.k)).body.reason, 'bad_email');
    assert.equal((await s.req('POST', url, { email: 'a@b.co", <x>' }, s.k)).body.reason, 'bad_email');
    assert.equal((await s.req('POST', url, { email: 'aisha@example.ae', pdf: PDF }, { 'X-Fekra-Key': 'WRONG-CODE-XXXX' })).status, 403);
    assert.equal((await s.req('POST', url, { email: 'aisha@example.ae', pdf: PDF }, { ...s.k, Origin: 'https://evil.example' })).status, 403);
    assert.equal((await s.req('GET', '/api/fekra/export', null, { Authorization: 'Bearer wrong-token-0123456789' })).status, 401);
    assert.equal((await s.req('GET', `/api/fekra/export/${s.saved.ref}/pdf`)).status, 401);
    assert.equal((await s.req('GET', `/api/fekra/export/${s.saved.ref}/pdf`, null, s.staff)).status, 404); // nothing downloaded yet
    // something that is not a PDF is not kept, but the email still is
    const r = await s.req('POST', url, { email: 'aisha@example.ae', pdf: 'data:application/pdf;base64,' + Buffer.from('<html>').toString('base64') }, s.k);
    assert.deepEqual(r.body, { recorded: true, email: true, pdfKept: false });
    assert.ok(!fs.existsSync(path.join(s.dir, 'fekra', `${s.saved.ref}.pdf`)));
  } finally { s.close(); }
});

test('optional mode allows a download without an email', async () => {
  const s = await setup({ FEKRA_PDF_EMAIL: 'optional' });
  try {
    const r = await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { lang: 'ar', pdf: PDF }, s.k);
    assert.equal(r.status, 200); assert.deepEqual(r.body, { recorded: true, email: false, pdfKept: true });
    assert.equal((await s.req('GET', '/api/config')).body.fekra.pdfEmail, 'optional');
    assert.equal((await s.interactions.list()).find(e => e.type === 'fekra_pdf_downloaded').withEmail, false);
  } finally { s.close(); }
});
