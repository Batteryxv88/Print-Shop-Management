const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config');

const LOG_DIR = path.join(ROOT, 'logs');

const ensureLogDir = () => {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
};

const stamp = () => new Date().toISOString();

const line = (level, message, extra) => {
    const base = `[${stamp()}] ${level.padEnd(5)} ${message}`;
    if (extra === undefined) return base;
    try {
        return `${base} ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`;
    } catch {
        return base;
    }
};

const write = (level, message, extra) => {
    ensureLogDir();
    const text = line(level, message, extra);
    // eslint-disable-next-line no-console
    console.log(text);
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(LOG_DIR, `${day}.log`);
    fs.appendFileSync(file, `${text}\n`, 'utf8');
};

const log = {
    info: (msg, extra) => write('INFO', msg, extra),
    warn: (msg, extra) => write('WARN', msg, extra),
    error: (msg, extra) => write('ERROR', msg, extra),
};

module.exports = { log, LOG_DIR };
