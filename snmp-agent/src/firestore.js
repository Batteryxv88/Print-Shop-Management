const admin = require('firebase-admin');
const { getActivePeriodKey } = require('./period');

let db = null;

const initFirestore = (serviceAccountPath) => {
    if (db) return db;
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    return db;
};

const fetchAppSettings = async () => {
    const snap = await db.collection('AppSettings').doc('main').get();
    if (!snap.exists) {
        return { counterReadingDay: null };
    }
    const data = snap.data() || {};
    const day = Number(data.counterReadingDay);
    return {
        counterReadingDay:
            Number.isFinite(day) && day >= 1 && day <= 31 ? day : null,
    };
};

const fetchPrinters = async () => {
    const snap = await db.collection('Printers').get();
    return snap.docs
        .map((d) => {
            const data = d.data() || {};
            const colorMode = data.colorMode === 'bw' ? 'bw' : 'color';
            return {
                id: d.id,
                name: String(data.name || '').trim(),
                model: String(data.model || '').trim(),
                ip: String(data.ip || '').trim(),
                colorMode,
                colors: Array.isArray(data.colors) ? data.colors : [],
            };
        })
        .filter((p) => p.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};

const fetchCounterReadingByPeriod = async (periodKey) => {
    const snap = await db.collection('CounterReadings').doc(periodKey).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() || {}) };
};

/**
 * Создаёт запись счётчиков за период (без перезаписи существующей).
 * Формат совместим с web-приложением.
 */
const createCounterReading = async ({
    periodKey,
    printers,
    userId,
    userName,
    note,
}) => {
    const ref = db.collection('CounterReadings').doc(periodKey);
    const now = new Date().toISOString();

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) {
            throw new Error(
                `Показания за ${periodKey} уже есть в Firestore — повторная запись пропущена.`
            );
        }
        tx.set(ref, {
            periodKey,
            completedAt: now,
            userId,
            userName,
            note: note || '',
            printers,
            source: 'snmp-agent',
        });
    });

    return periodKey;
};

const resolvePeriodToCollect = async (force) => {
    const settings = await fetchAppSettings();
    const day = settings.counterReadingDay;

    if (force) {
        const now = new Date();
        const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return {
            periodKey,
            counterReadingDay: day,
            reason: 'force',
        };
    }

    if (!day) {
        return {
            periodKey: null,
            counterReadingDay: null,
            reason: 'no-day',
        };
    }

    const periodKey = getActivePeriodKey(day);
    if (!periodKey) {
        return {
            periodKey: null,
            counterReadingDay: day,
            reason: 'too-early',
        };
    }

    const existing = await fetchCounterReadingByPeriod(periodKey);
    if (existing) {
        return {
            periodKey,
            counterReadingDay: day,
            reason: 'already-done',
            existing,
        };
    }

    return {
        periodKey,
        counterReadingDay: day,
        reason: 'due',
    };
};

module.exports = {
    initFirestore,
    fetchAppSettings,
    fetchPrinters,
    fetchCounterReadingByPeriod,
    createCounterReading,
    resolvePeriodToCollect,
};
