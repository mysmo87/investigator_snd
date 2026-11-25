'use strict';
/* Runtime configuration — everything is read from environment variables
   so the same build runs locally, in Docker or on Railway.
   See README.md ("Environment variables") for the full list. */

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const SCHEDULE_MODES = ['relative', 'fixed'];

function str(env, name, def) {
  const v = env[name];
  return v == null || String(v).trim() === '' ? def : String(v).trim();
}
function int(env, name, def, min, max) {
  const raw = str(env, name, null);
  if (raw == null) return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
  return n;
}
function bool(env, name, def) {
  const raw = str(env, name, null);
  if (raw == null) return def;
  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  if (/^(0|false|no|off)$/i.test(raw)) return false;
  throw new Error(`${name} must be true or false (got "${raw}")`);
}
function oneOf(env, name, def, allowed) {
  const v = str(env, name, def);
  if (!allowed.includes(v)) throw new Error(`${name} must be one of ${allowed.join(', ')} (got "${v}")`);
  return v;
}
function url(env, name) {
  const v = str(env, name, null);
  if (v == null) return null;
  let u;
  try { u = new URL(v); } catch { throw new Error(`${name} must be an absolute URL (got "${v}")`); }
  if (!/^https?:$/.test(u.protocol)) throw new Error(`${name} must use http or https`);
  return u.origin + u.pathname.replace(/\/+$/, '');
}
function timezone(env, name, def) {
  const v = str(env, name, def);
  try { new Intl.DateTimeFormat('en-GB', { timeZone: v }); } catch { throw new Error(`${name} must be an IANA time zone such as Asia/Dubai (got "${v}")`); }
  return v;
}

function loadConfig(env = process.env) {
  const onRailway = !!(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID);
  const apiKeySet = !!str(env, 'ANTHROPIC_API_KEY', null);
  const falKey = str(env, 'FAL_KEY', null);
  // DATA_DIR: one persistent folder (on Railway, a mounted volume such as /data) for everything the app saves.
  const path = require('path'), dataDir = str(env, 'DATA_DIR', null);
  const saveDir = (name, sub) => str(env, name, null) || (dataDir ? path.join(dataDir, sub) : path.join(require('os').tmpdir(), `cft-${sub}`));
  const savePersistent = name => !!(str(env, name, null) || dataDir); // only an explicitly configured folder counts as persistent
  const cfg = {
    port: int(env, 'PORT', 3000, 1, 65535),
    host: str(env, 'HOST', '0.0.0.0'),
    nodeEnv: str(env, 'NODE_ENV', 'production'),
    logLevel: oneOf(env, 'LOG_LEVEL', 'info', ['debug', 'info', 'warn', 'error']),
    trustProxy: bool(env, 'TRUST_PROXY', onRailway),
    publicBaseUrl: url(env, 'PUBLIC_BASE_URL'),

    ai: {
      enabled: bool(env, 'AI_ENABLED', true) && apiKeySet,
      apiKeySet,
      model: str(env, 'ANTHROPIC_MODEL', 'claude-opus-5-5'),
      effort: oneOf(env, 'AI_EFFORT', 'low', EFFORTS),
      timeoutMs: int(env, 'AI_TIMEOUT_MS', 20000, 2000, 120000),
      maxTokens: int(env, 'AI_MAX_TOKENS', 8000, 1000, 64000),
      fallbacks: oneOf(env, 'AI_FALLBACKS', 'default', ['default', 'off']),
      cacheTtlMs: int(env, 'AI_CACHE_TTL_MINUTES', 360, 0, 10080) * 60000,
      cacheMax: int(env, 'AI_CACHE_MAX_ENTRIES', 1000, 0, 100000),
      maxCallsPerHour: int(env, 'AI_MAX_CALLS_PER_HOUR', 500, 0, 100000)
    },

    // Fekra, the innovation assistant (uses the same ANTHROPIC_API_KEY)
    fekra: {
      enabled: bool(env, 'FEKRA_ENABLED', true),
      model: str(env, 'FEKRA_MODEL', str(env, 'ANTHROPIC_MODEL', 'claude-opus-5-5')),
      chatEffort: oneOf(env, 'FEKRA_CHAT_EFFORT', 'low', EFFORTS),
      updateEffort: oneOf(env, 'FEKRA_UPDATE_EFFORT', 'low', EFFORTS),
      effort: oneOf(env, 'FEKRA_EFFORT', 'medium', EFFORTS),
      webSearch: bool(env, 'FEKRA_WEB_SEARCH', true),
      maxSearches: int(env, 'FEKRA_MAX_SEARCHES', 6, 1, 20),
      timeoutMs: int(env, 'FEKRA_TIMEOUT_MS', 150000, 10000, 600000),
      maxCallsPerHour: int(env, 'FEKRA_MAX_CALLS_PER_HOUR', 300, 0, 100000),
      idleResetSeconds: int(env, 'FEKRA_IDLE_RESET_SECONDS', 600, 60, 7200),
      submitUrl: url(env, 'FEKRA_SUBMIT_URL'),
      submitToken: str(env, 'FEKRA_SUBMIT_TOKEN', null),
      storeDir: saveDir('FEKRA_STORE_DIR', 'fekra'),
      storePersistent: savePersistent('FEKRA_STORE_DIR'),
      identityHeader: str(env, 'FEKRA_IDENTITY_HEADER', null) ? str(env, 'FEKRA_IDENTITY_HEADER', null).toLowerCase() : null
    },

    // Saved Agentic AI Passports (only with the visitor's consent)
    passport: {
      save: oneOf(env, 'PASSPORT_SAVE', 'always', ['off', 'optional', 'required', 'always']),
      storeDir: saveDir('PASSPORT_STORE_DIR', 'passports'),
      storePersistent: savePersistent('PASSPORT_STORE_DIR'),
      retentionDays: int(env, 'PASSPORT_RETENTION_DAYS', 180, 1, 3650),
      adminToken: str(env, 'PASSPORT_ADMIN_TOKEN', null)
    },

    // AI 3D Traveler avatar (fal.ai) — only used when the visitor opts in on the kiosk
    avatar: {
      enabled: bool(env, 'AVATAR_AI_ENABLED', true) && !!falKey,
      apiKey: falKey,
      model: str(env, 'AVATAR_AI_MODEL', 'fal-ai/flux-pro/kontext'),
      timeoutMs: int(env, 'AVATAR_AI_TIMEOUT_MS', 60000, 10000, 180000),
      maxCallsPerHour: int(env, 'AVATAR_AI_MAX_CALLS_PER_HOUR', 200, 0, 100000),
      maxConcurrent: int(env, 'AVATAR_AI_MAX_CONCURRENT', 4, 1, 50)
    },

    news: {
      enabled: bool(env, 'NEWS_ENABLED', true),
      refreshMinutes: int(env, 'NEWS_REFRESH_MINUTES', 30, 5, 1440),
      maxItems: int(env, 'NEWS_MAX_ITEMS', 30, 5, 100),
      timeoutMs: int(env, 'NEWS_TIMEOUT_MS', 12000, 2000, 60000),
      verifyLinks: bool(env, 'NEWS_VERIFY_LINKS', true),
      cacheFile: str(env, 'NEWS_CACHE_FILE', require('path').join(require('os').tmpdir(), 'cft-news-cache.json')),
      sourcesFile: str(env, 'NEWS_SOURCES_FILE', null)
    },

    rateLimitPerMinute: int(env, 'RATE_LIMIT_PER_MINUTE', 30, 1, 10000),

    kiosk: {
      scheduleMode: oneOf(env, 'SCHEDULE_MODE', 'relative', SCHEDULE_MODES),
      eventTimezone: timezone(env, 'EVENT_TIMEZONE', 'Asia/Dubai'),
      idleWarnSeconds: int(env, 'IDLE_WARN_SECONDS', 75, 10, 3600),
      idleResetSeconds: int(env, 'IDLE_RESET_SECONDS', 90, 15, 3600)
    }
  };
  if (!/^[a-z0-9-]+(\/[a-z0-9.-]+)+$/i.test(cfg.avatar.model)) throw new Error('AVATAR_AI_MODEL must be a fal endpoint id such as fal-ai/flux-pro/kontext');
  if (cfg.passport.adminToken && cfg.passport.adminToken.length < 20) throw new Error('PASSPORT_ADMIN_TOKEN must be at least 20 characters');
  if (cfg.kiosk.idleWarnSeconds >= cfg.kiosk.idleResetSeconds) throw new Error('IDLE_WARN_SECONDS must be lower than IDLE_RESET_SECONDS');
  return cfg;
}

module.exports = { loadConfig };
