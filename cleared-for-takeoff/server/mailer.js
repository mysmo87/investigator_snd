'use strict';
/* Outgoing email (Fekra sends a proposal PDF to the person who downloads it).

   Sent through Resend's HTTPS API (https://resend.com): Railway blocks outbound SMTP on its Hobby plan, and an
   HTTPS API works on every plan. Set RESEND_API_KEY (a secret) and MAIL_FROM, an address on a domain verified in
   Resend (for example "GDRFA Fekra <fekra@your-domain.ae>"). Without both, nothing is sent and the app says so.
   Guards: an hourly cap for the whole server (MAIL_MAX_PER_HOUR) and a smaller one per proposal, so the kiosk
   cannot be used to flood an inbox. */

const RESEND_URL = 'https://api.resend.com/emails';
const fail = (reason, message, status) => Object.assign(new Error(message), { reason, status });

function createMailer({ config, logger, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  const m = config.mail || {};
  const enabled = !!(m.apiKey && m.from);
  const hour = () => Math.floor(now() / 3600000);
  let budget = { hour: -1, total: 0, per: new Map() };
  function take(group) {
    if (budget.hour !== hour()) budget = { hour: hour(), total: 0, per: new Map() };
    const n = budget.per.get(group) || 0;
    if (budget.total >= m.maxPerHour) throw fail('rate_limited', 'Too many emails this hour. Please try again later.', 429);
    if (group && n >= m.maxPerGroupPerHour) throw fail('rate_limited', 'This proposal has been emailed several times this hour. Please try again later.', 429);
    budget.total += 1; if (group) budget.per.set(group, n + 1);
  }

  /* attachments: [{ filename, content: Buffer }] */
  async function send({ to, subject, html, text, attachments = [], group = '' }) {
    if (!enabled) throw fail('not_configured', 'Email is not set up on this server.');
    take(group);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), m.timeoutMs);
    try {
      const res = await fetchImpl(RESEND_URL, {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: `Bearer ${m.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: m.from, to: [to], subject, html, text, ...(m.replyTo ? { reply_to: m.replyTo } : {}), attachments: attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') })) })
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger && logger.warn('mail_failed', { status: res.status, detail: String(out.message || out.error || '').slice(0, 200) });
        throw fail('send_failed', 'The email could not be sent.', 502);
      }
      logger && logger.info('mail_sent', { id: out.id, attachments: attachments.length });
      return { id: out.id || null };
    } catch (err) {
      if (err.reason) throw err;
      logger && logger.warn('mail_failed', { detail: String(err.name === 'AbortError' ? 'timeout' : err.message).slice(0, 200) });
      throw fail('send_failed', 'The email could not be sent.', 502);
    } finally { clearTimeout(timer); }
  }
  return { enabled, provider: enabled ? 'resend' : null, send, status: () => ({ enabled, provider: enabled ? 'resend' : null }) };
}

module.exports = { createMailer, RESEND_URL };
