'use strict';
/* Entry point: `npm start`. Binds to $PORT (Railway sets it) on 0.0.0.0. */

const http = require('http');
const path = require('path');
const { loadConfig } = require('./config');
const { createLogger } = require('./log');
const { createRecommender } = require('./recommender');
const { createFekra } = require('./fekra');
const { createNews } = require('./news');
const { createStore } = require('./fekra-store');
const { createPassportStore } = require('./passport-store');
const { createAvatar } = require('./avatar');
const { createInteractionLog } = require('./interactions');
const { createApp } = require('./app');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const rules = require('../public/shared/journey-rules.js');
const localize = require('../public/shared/localize.js');
const { version } = require('../package.json');

let config;
try {
  config = loadConfig();
} catch (err) {
  process.stderr.write(JSON.stringify({ level: 'error', msg: 'invalid_configuration', detail: err.message }) + '\n');
  process.exit(1);
}
const logger = createLogger(config.logLevel);

const contentErrors = require('./validate-content').validateContent(content, catalog);
if (contentErrors.length) {
  logger.error('invalid_content', { problems: contentErrors.slice(0, 20) });
  process.exit(1);
}

const contentAr = localize.localizeContent(content, require('../public/data/content-ar.js'));
const catalogAr = localize.localizeCatalog(catalog, require('../public/data/content-ar.js'));
const recommender = createRecommender({ config, content, catalog, contentAr, catalogAr, rules, logger });
const fekra = createFekra({ config, logger });
const news = createNews({ config, logger });
let store = null;
try { store = createStore({ dir: config.fekra.storeDir, persistent: config.fekra.storePersistent, logger }); }
catch (err) { logger.error('fekra_store_unavailable', { detail: String(err.message).slice(0, 200) }); }
let passports = null;
if (config.passport.save !== 'off') {
  try { passports = createPassportStore({ dir: config.passport.storeDir, persistent: config.passport.storePersistent, retentionDays: config.passport.retentionDays, logger }); }
  catch (err) { logger.error('passport_store_unavailable', { detail: String(err.message).slice(0, 200) }); }
}
const avatar = createAvatar({ config, logger });
let interactions = null;
try { interactions = createInteractionLog({ dir: config.interactions.storeDir, persistent: config.interactions.storePersistent, content, timezone: config.kiosk.eventTimezone, logger }); }
catch (err) { logger.error('interaction_log_unavailable', { detail: String(err.message).slice(0, 200) }); }
const handler = createApp({ config, recommender, fekra, store, passports, avatar, interactions, news, rules, content, catalog, logger, publicDir: PUBLIC_DIR, version });
const server = http.createServer(handler);
server.requestTimeout = Math.max(config.ai.timeoutMs, config.fekra.timeoutMs * 2, config.avatar.timeoutMs) + 15000; // an innovation check is two calls
server.headersTimeout = 20000;
server.keepAliveTimeout = 65000; // longer than typical proxy idle timeouts

server.listen(config.port, config.host, () => {
  news.start(); // first refresh now, then every NEWS_REFRESH_MINUTES
  logger.info('server_started', {
    port: config.port, version,
    ai: config.ai.enabled ? { model: config.ai.model, effort: config.ai.effort, fallbacks: config.ai.fallbacks } : (config.ai.apiKeySet ? 'disabled (AI_ENABLED=false)' : 'disabled (no ANTHROPIC_API_KEY — using offline rules)'),
    fekra: { ...fekra.status(), storage: store ? store.status() : 'unavailable', pdfEmail: config.fekra.pdfEmail },
    passports: { save: config.passport.save, storage: passports ? passports.status() : 'unavailable', staffExport: !!config.passport.adminToken },
    avatarAi: config.avatar.enabled ? { model: config.avatar.model } : 'disabled (no FAL_KEY)', news: { enabled: config.news.enabled, refreshMinutes: config.news.refreshMinutes },
    scheduleMode: config.kiosk.scheduleMode, trustProxy: config.trustProxy, courses: catalog.courses.length
  });
});

function shutdown(signal) {
  logger.info('shutting_down', { signal });
  news.stop();
  if (passports) passports.stop();
  server.close(() => process.exit(0));
  server.closeIdleConnections && server.closeIdleConnections();
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', err => logger.error('unhandled_rejection', { detail: String(err && err.message).slice(0, 300) }));
