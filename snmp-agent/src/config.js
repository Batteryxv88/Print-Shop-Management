const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const loadConfig = () => {
    const configPath = path.join(ROOT, 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(
            `Нет config.json. Скопируйте config.example.json → config.json и заполните.`
        );
    }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const serviceAccountPath = path.resolve(
        ROOT,
        raw.serviceAccountPath || './serviceAccountKey.json'
    );
    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(
            `Файл сервисного аккаунта не найден: ${serviceAccountPath}\n` +
                `Скачайте JSON из Firebase Console → Project settings → Service accounts.`
        );
    }
    return {
        ...raw,
        serviceAccountPath,
        snmp: {
            community: 'public',
            version: 1,
            timeoutMs: 5000,
            retries: 1,
            ...(raw.snmp || {}),
        },
        schedule: {
            runHour: 8,
            runMinute: 0,
            ...(raw.schedule || {}),
        },
        agent: {
            userId: 'snmp-agent',
            userName: 'SNMP-агент',
            ...(raw.agent || {}),
        },
        profiles: raw.profiles || {
            default: {
                total: '1.3.6.1.2.1.43.10.2.1.4.1.1',
                mono: null,
                color: null,
            },
        },
    };
};

const resolveProfile = (config, model) => {
    const key = String(model || '').trim();
    const profiles = config.profiles || {};
    return {
        ...(profiles.default || {}),
        ...(profiles[key] || {}),
    };
};

module.exports = { ROOT, loadConfig, resolveProfile };
