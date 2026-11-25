'use strict';
/* AI 3D Traveler avatar (fal.ai, FLUX Kontext).

   - The visitor's photo is sent to fal only after they tick the AI consent box on the kiosk.
   - One synchronous call per request to https://fal.run/<model> with sync_mode, so fal returns the
     image inline and does not keep it in its request history. Nothing is written to disk here.
   - A job is never resubmitted automatically: every submit is billable, so a timeout or an unclear
     result is reported to the kiosk and the visitor decides whether to try again.
   - FAL_KEY stays on the server; the kiosk only learns whether the feature is enabled. */

const FAL_ORIGIN = 'https://fal.run';
const IMAGE_HOSTS = /(^|\.)fal\.(media|run|ai)$/; // where fal may host a result if it does not inline it
const MAX_INPUT_BYTES = 1024 * 1024;              // decoded photo; the kiosk sends a 512 px JPEG (~100 KB)
const MAX_OUTPUT_BYTES = 6 * 1024 * 1024;

const KEEP_IDENTITY =
  'Keep this exact person recognizable: same face shape, eyes, nose, mouth, skin tone, same hairstyle or baldness, ' +
  'same facial hair, same age. Do not add hair, glasses or accessories that are not in the photo.';
const STYLES = {
  'digital-traveler':
    'Transform this person into a stylized 3D animated character, Pixar-like cinematic render. ' + KEEP_IDENTITY + ' ' +
    'Show them from the chest up as a confident, smiling digital traveler wearing a sleek modern navy travel jacket with subtle ' +
    'glowing cyan neon accents, holding a glowing holographic digital passport, in a futuristic smart airport gate with holographic ' +
    'displays and the Dubai skyline at dusk behind. Navy and electric blue palette, soft rim lighting, high detail. No text or logos.'
};

function fail(reason, message, status, detail) { return Object.assign(new Error(message), { reason, status, detail }); }

/* "data:image/jpeg;base64,…" -> the same string, after checking type and size */
function checkPhoto(image) {
  const m = typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!m) throw fail('bad_image', 'Please send a JPEG, PNG or WebP photo.', 400);
  if (Math.floor(m[2].length * 3 / 4) > MAX_INPUT_BYTES) throw fail('too_large', 'That photo is too large.', 413);
  return image;
}

function createAvatar({ config, logger, fetchImpl = globalThis.fetch }) {
  const av = config.avatar;
  const budget = { hour: 0, calls: 0 };
  let inFlight = 0;

  function takeBudget() {
    const hour = Math.floor(Date.now() / 3600000);
    if (budget.hour !== hour) { budget.hour = hour; budget.calls = 0; }
    if (budget.calls >= av.maxCallsPerHour) return false;
    budget.calls += 1;
    return true;
  }

  /* fal normally returns a data URI (sync_mode); if it returns a hosted URL instead, fetch it here so the
     kiosk never loads third-party images (its CSP only allows its own origin and data: URIs). */
  async function inline(url, signal) {
    if (typeof url === 'string' && url.startsWith('data:')) {
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url) || url.length > MAX_OUTPUT_BYTES * 4 / 3 + 100) throw fail('bad_result', 'The avatar service returned an unexpected result.', 502);
      return url;
    }
    let u;
    try { u = new URL(url); } catch { throw fail('bad_result', 'The avatar service returned an unexpected result.', 502); }
    if (u.protocol !== 'https:' || !IMAGE_HOSTS.test(u.hostname)) throw fail('bad_result', 'The avatar service returned an unexpected result.', 502);
    const r = await fetchImpl(u.href, { signal });
    if (!r.ok) throw fail('bad_result', 'The avatar image could not be downloaded.', 502);
    const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) throw fail('bad_result', 'The avatar service returned an unexpected result.', 502);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_OUTPUT_BYTES) throw fail('bad_result', 'The avatar image is too large.', 502);
    return `data:${type};base64,${buf.toString('base64')}`;
  }

  async function generate({ image, style = 'digital-traveler' } = {}) {
    if (!av.enabled) throw fail('not_configured', 'The AI avatar is not available.', 503);
    const prompt = STYLES[style];
    if (!prompt) throw fail('bad_style', 'Unknown avatar style.', 400);
    const photo = checkPhoto(image);
    if (inFlight >= av.maxConcurrent) throw fail('busy', 'The AI avatar is busy. Please try again in a moment.', 429);
    if (!takeBudget()) throw fail('hourly_budget', 'The AI avatar has reached its hourly limit. Please choose another option.', 429);

    inFlight += 1;
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), av.timeoutMs);
    let requestId = null;
    try {
      let res;
      try {
        res = await fetchImpl(`${FAL_ORIGIN}/${av.model}`, {
          method: 'POST',
          headers: { Authorization: `Key ${av.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            prompt, image_url: photo, aspect_ratio: '1:1', guidance_scale: 3.5, num_images: 1,
            output_format: 'jpeg', safety_tolerance: '2', sync_mode: true
          }),
          signal: ctrl.signal
        });
      } catch (err) {
        // The job may still be running (and billed) on fal: report it, never resubmit.
        if (ctrl.signal.aborted) throw fail('timeout', 'The AI avatar took too long. Please try again.', 504);
        throw fail('network', 'The AI avatar service could not be reached.', 502);
      }
      requestId = res.headers.get('x-fal-request-id') || res.headers.get('x-request-id') || null;
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
      if (!res.ok) {
        const detail = body && (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body)) || text;
        if (res.status === 403 && /exhausted balance/i.test(detail)) throw fail('no_credits', 'The AI avatar is out of credits. Please choose another option.', 503);
        if (res.status === 401 || res.status === 403) throw fail('auth', 'The AI avatar is not configured correctly.', 503, detail);
        if (res.status === 422) throw fail('rejected', 'That photo could not be used. Please try a clear, front-facing photo.', 422, detail);
        throw fail('upstream', 'The AI avatar could not be created. Please try again.', 502, detail);
      }
      if (body && Array.isArray(body.has_nsfw_concepts) && body.has_nsfw_concepts[0]) throw fail('blocked', 'That photo could not be used. Please try another one.', 422);
      const url = body && Array.isArray(body.images) && body.images[0] && body.images[0].url;
      if (!url) throw fail('bad_result', 'The AI avatar could not be created. Please try another photo.', 502);
      const result = await inline(url, ctrl.signal);
      logger.info('avatar_generated', { ms: Date.now() - started, requestId });
      return { image: result };
    } catch (err) {
      logger.warn('avatar_failed', { reason: err.reason || 'error', status: err.status, requestId, ms: Date.now() - started, ...(err.detail ? { detail: String(err.detail).slice(0, 300) } : {}) });
      throw err;
    } finally {
      clearTimeout(timer);
      inFlight -= 1;
    }
  }

  return {
    generate,
    status: () => ({ enabled: av.enabled }),
    stats: () => ({ inFlight, callsThisHour: budget.hour === Math.floor(Date.now() / 3600000) ? budget.calls : 0 })
  };
}

module.exports = { createAvatar, STYLES };
