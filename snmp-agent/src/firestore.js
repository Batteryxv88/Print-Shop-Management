const admin = require('firebase-admin');

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

const pad2 = (n) => String(n).padStart(2, '0');

/** Сегодня по локальной дате агента — YYYY-MM-DD */
const todayDateKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const fetchCounterReadingByDateKey = async (dateKey) => {
    const snap = await db.collection('CounterReadings').doc(dateKey).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() || {}) };
};

/**
 * Ежедневный снимок. При повторном запуске за тот же день — обновление (идемпотентность SNMP).
 * Формат совместим с веб-приложением: dateKey, periodKey (YYYY-MM), printers[].
 */
const upsertDailyCounterReading = async ({
    dateKey,
    printers,
    userId,
    userName,
    note,
}) => {
    const ref = db.collection('CounterReadings').doc(dateKey);
    const now = new Date().toISOString();
    const periodKey = dateKey.slice(0, 7);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            tx.set(ref, {
                dateKey,
                periodKey,
                completedAt: now,
                userId,
                userName,
                note: note || '',
                printers,
                source: 'snmp-agent',
            });
            return;
        }
        const existing = snap.data() || {};
        tx.update(ref, {
            printers,
            note: note !== undefined ? note : existing.note || '',
            completedAt: now,
            userId,
            userName,
            periodKey,
            dateKey,
            source: 'snmp-agent',
        });
    });

    return dateKey;
};

/**
 * План снятия на сегодня (или указанную дату при --force).
 */
const resolveDateToCollect = async (force) => {
    const dateKey = force ? todayDateKey() : todayDateKey();
    const existing = await fetchCounterReadingByDateKey(dateKey);
    return {
        dateKey,
        reason: existing ? 'update-existing' : 'due',
        existing,
    };
};

module.exports = {
    initFirestore,
    fetchPrinters,
    fetchCounterReadingByDateKey,
    upsertDailyCounterReading,
    resolveDateToCollect,
};
