'use strict';
/* Entry point: `npm start`. Binds to $PORT (Railway sets it) on 0.0.0.0. */

const http = require('http');
const path = require('path');
const { loadConfig } = require('./config');
const { createLogger } = require('./log');
const { createRecommender } = require('./recommender');
const { createApp } = require('./app');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const content = require('../public/data/content.js');
const catalog = require('../public/data/catalog.js');
const rules = require('../public/shared/journey-rules.js');
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

const recommender = createRecommender({ config, content, catalog, rules, logger });
const handler = createApp({ config, recommender, rules, content, logger, publicDir: PUBLIC_DIR, version });
const server = http.createServer(handler);
server.requestTimeout = config.ai.timeoutMs + 15000;
server.headersTimeout = 20000;
server.keepAliveTimeout = 65000; // longer than typical proxy idle timeouts

server.listen(config.port, config.host, () => {
  logger.info('server_started', {
    port: config.port, version,
    ai: config.ai.enabled ? { model: config.ai.model, effort: config.ai.effort, fallbacks: config.ai.fallbacks } : (config.ai.apiKeySet ? 'disabled (AI_ENABLED=false)' : 'disabled (no ANTHROPIC_API_KEY — using offline rules)'),
    scheduleMode: config.kiosk.scheduleMode, trustProxy: config.trustProxy, courses: catalog.courses.length
  });
});

function shutdown(signal) {
  logger.info('shutting_down', { signal });
  server.close(() => process.exit(0));
  server.closeIdleConnections && server.closeIdleConnections();
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', err => logger.error('unhandled_rejection', { detail: String(err && err.message).slice(0, 300) }));
