'use strict';
/* Minimal structured (JSON-lines) logger. Railway and most hosts index
   JSON logs automatically. Never pass visitor names, emails or photos —
   the server never receives them. */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function createLogger(level = 'info', out = process.stdout) {
  const min = LEVELS[level] || LEVELS.info;
  const write = (lvl, msg, fields) => {
    if (LEVELS[lvl] < min) return;
    out.write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...fields }) + '\n');
  };
  return {
    debug: (msg, f) => write('debug', msg, f),
    info: (msg, f) => write('info', msg, f),
    warn: (msg, f) => write('warn', msg, f),
    error: (msg, f) => write('error', msg, f)
  };
}

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

module.exports = { createLogger, silentLogger };
