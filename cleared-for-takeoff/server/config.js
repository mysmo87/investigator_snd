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

    rateLimitPerMinute: int(env, 'RATE_LIMIT_PER_MINUTE', 30, 1, 10000),

    kiosk: {
      scheduleMode: oneOf(env, 'SCHEDULE_MODE', 'relative', SCHEDULE_MODES),
      eventTimezone: timezone(env, 'EVENT_TIMEZONE', 'Asia/Dubai'),
      idleWarnSeconds: int(env, 'IDLE_WARN_SECONDS', 75, 10, 3600),
      idleResetSeconds: int(env, 'IDLE_RESET_SECONDS', 90, 15, 3600)
    }
  };
  if (cfg.kiosk.idleWarnSeconds >= cfg.kiosk.idleResetSeconds) throw new Error('IDLE_WARN_SECONDS must be lower than IDLE_RESET_SECONDS');
  return cfg;
}

module.exports = { loadConfig };
