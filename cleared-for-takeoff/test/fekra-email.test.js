'use strict';
/* Fekra PDF downloads: the email is asked for, the PDF is emailed through the mail API, the address is kept with
   the proposal, anonymous counts are logged, and GDRFA staff can list and export it all. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createStore } = require('../server/fekra-store');
const { createMailer, RESEND_URL } = require('../server/mailer');
const { createInteractionLog } = require('../server/interactions');
const { createApp } = require('../server/app');
const { loadConfig } = require('../server/config');
const { silentLogger } = require('../server/log');
const { emptyProposal } = require('../server/fekra');
const content = require('../public/data/content.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fekra-email-'));
const TOKEN = 'staff-token-0123456789-abcdef';
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n% test proposal\n').toString('base64');

function fakeMailApi(status = 200) {
  const sent = [];
  const fetchImpl = async (url, opts) => { sent.push({ url, headers: opts.headers, body: JSON.parse(opts.body) }); return { ok: status < 400, status, json: async () => (status < 400 ? { id: 'email_' + sent.length } : { message: 'rejected' }) }; };
  return { sent, fetchImpl };
}

async function setup(env = {}, mailStatus = 200) {
  const dir = tmp();
  const config = loadConfig({ DATA_DIR: dir, PASSPORT_ADMIN_TOKEN: TOKEN, RESEND_API_KEY: 're_test', MAIL_FROM: 'Fekra <fekra@example.ae>', ...env });
  const store = createStore({ dir: config.fekra.storeDir, persistent: true });
  const api = fakeMailApi(mailStatus);
  const mailer = createMailer({ config, logger: silentLogger, fetchImpl: api.fetchImpl });
  const interactions = createInteractionLog({ dir: path.join(dir, 'interactions'), content, logger: silentLogger });
  const server = http.createServer(createApp({ config, recommender: { stats: () => ({}) }, store, interactions, mailer, rules: {}, content, logger: silentLogger, publicDir: path.join(__dirname, '..', 'public'), version: 'test' }));
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (method, url, body, headers = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
    .then(async r => ({ status: r.status, type: r.headers.get('content-type'), text: await r.text() })).then(r => ({ ...r, body: /json/.test(r.type) ? JSON.parse(r.text) : r.text }));
  const saved = (await req('POST', '/api/fekra/proposals', { status: 'draft', lang: 'en', payload: { proposal: { ...emptyProposal(), title: 'Delay early-warning' }, messages: [{ role: 'user', text: 'idea' }] } })).body;
  return { server, req, api, interactions, saved, k: { 'X-Fekra-Key': saved.key }, close: () => server.close() };
}

test('a download with an email sends the PDF, keeps the address with the proposal and counts it', async () => {
  const s = await setup();
  try {
    const r = await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { email: 'aisha@example.ae', lang: 'en', pdf: PDF }, { ...s.k, Host: 'kiosk.example.ae' });
    assert.equal(r.status, 200); assert.equal(r.body.emailed, true);
    assert.equal(s.api.sent.length, 1);
    const mail = s.api.sent[0];
    assert.equal(mail.url, RESEND_URL); assert.equal(mail.headers.Authorization, 'Bearer re_test');
    assert.deepEqual(mail.body.to, ['aisha@example.ae']); assert.equal(mail.body.from, 'Fekra <fekra@example.ae>');
    assert.match(mail.body.subject, /Delay early-warning/); assert.match(mail.body.html, new RegExp(s.saved.ref));
    assert.match(mail.body.text, new RegExp(`#fekra=${s.saved.ref}~${s.saved.key.replace(/-/g, '')}`)); // the link reopens the proposal
    assert.equal(mail.body.attachments.length, 1); assert.match(mail.body.attachments[0].filename, /^Fekra-FK-.*\.pdf$/);
    assert.equal(Buffer.from(mail.body.attachments[0].content, 'base64').slice(0, 5).toString(), '%PDF-');
    // kept with the proposal, and visible to staff
    const ex = await s.req('GET', '/api/fekra/export', null, { Authorization: `Bearer ${TOKEN}` });
    assert.equal(ex.status, 200); assert.equal(ex.body.count, 1);
    assert.equal(ex.body.proposals[0].downloads[0].email, 'aisha@example.ae'); assert.equal(ex.body.proposals[0].downloads[0].emailed, 'sent');
    const csv = await s.req('GET', '/api/fekra/export?format=csv', null, { Authorization: `Bearer ${TOKEN}` });
    assert.match(csv.text, /reference,title,status,created,updated,email,downloaded,emailed,language/); assert.match(csv.text, /aisha@example\.ae/);
    const counts = await s.interactions.summary();
    assert.equal(counts.totals.fekra_pdf_downloaded, 1); assert.equal(counts.totals.fekra_proposal_emailed, 1);
    assert.ok(!JSON.stringify(await s.interactions.list()).includes('aisha')); // the interaction log stays anonymous
  } finally { s.close(); }
});

test('the email is required by default, checked, and needs the proposal access code', async () => {
  const s = await setup();
  try {
    const url = `/api/fekra/proposals/${s.saved.ref}/download`;
    assert.equal((await s.req('POST', url, { lang: 'en', pdf: PDF }, s.k)).body.reason, 'email_required');
    assert.equal((await s.req('POST', url, { email: 'not-an-email', pdf: PDF }, s.k)).body.reason, 'bad_email');
    assert.equal((await s.req('POST', url, { email: 'a@b.co", <x>' }, s.k)).body.reason, 'bad_email');
    assert.equal((await s.req('POST', url, { email: 'aisha@example.ae', pdf: PDF }, { 'X-Fekra-Key': 'WRONG-CODE-XXXX' })).status, 403);
    assert.equal((await s.req('POST', url, { email: 'aisha@example.ae', pdf: PDF }, { ...s.k, Origin: 'https://evil.example' })).status, 403);
    assert.equal(s.api.sent.length, 0);
    assert.equal((await s.req('GET', '/api/fekra/export', null, { Authorization: 'Bearer wrong-token-0123456789' })).status, 401);
  } finally { s.close(); }
});

test('optional mode allows a download without an email; nothing is sent', async () => {
  const s = await setup({ FEKRA_PDF_EMAIL: 'optional' });
  try {
    const r = await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { lang: 'ar', pdf: PDF }, s.k);
    assert.equal(r.status, 200); assert.equal(r.body.emailed, false); assert.equal(r.body.status, 'no');
    assert.equal(s.api.sent.length, 0);
    const cfg = await s.req('GET', '/api/config');
    assert.equal(cfg.body.fekra.pdfEmail, 'optional'); assert.equal(cfg.body.fekra.mail, true);
  } finally { s.close(); }
});

test('without a mail API key the address is still kept, and the answer says email is not set up', async () => {
  const s = await setup({ RESEND_API_KEY: '' });
  try {
    const r = await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { email: 'omar@example.ae', lang: 'en', pdf: PDF }, s.k);
    assert.equal(r.status, 200); assert.equal(r.body.emailed, false); assert.equal(r.body.reason, 'not_configured');
    const ex = await s.req('GET', '/api/fekra/export', null, { Authorization: `Bearer ${TOKEN}` });
    assert.equal(ex.body.proposals[0].downloads[0].emailed, 'not_configured');
    assert.equal((await s.req('GET', '/api/config')).body.fekra.mail, false);
  } finally { s.close(); }
});

test('a proposal cannot be used to flood an inbox, and a failed send is reported', async () => {
  const s = await setup();
  try {
    const url = `/api/fekra/proposals/${s.saved.ref}/download`;
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await s.req('POST', url, { email: `x${i}@example.ae`, pdf: PDF }, s.k)).body.status);
    assert.deepEqual(results, ['sent', 'sent', 'sent', 'sent', 'sent', 'rate_limited', 'rate_limited']);
  } finally { s.close(); }
  const f = await setup({}, 422);
  try {
    const r = await f.req('POST', `/api/fekra/proposals/${f.saved.ref}/download`, { email: 'a@example.ae', pdf: PDF }, f.k);
    assert.equal(r.status, 200); assert.equal(r.body.emailed, false); assert.equal(r.body.status, 'failed');
  } finally { f.close(); }
});

test('the Arabic email is written in Arabic', async () => {
  const s = await setup();
  try {
    await s.req('POST', `/api/fekra/proposals/${s.saved.ref}/download`, { email: 'aisha@example.ae', lang: 'ar', pdf: PDF }, s.k);
    assert.match(s.api.sent[0].body.subject, /مقترحك/); assert.match(s.api.sent[0].body.html, /dir="rtl"/);
  } finally { s.close(); }
});
