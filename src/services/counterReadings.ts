import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PrinterCounterValues } from '../shared/lib/counterReading/fields';
import {
    inferDateKeyAndPeriodFromDoc,
    sortKeyForReading,
} from '../shared/lib/counterReading/sortKey';

export { sortKeyForReading };

export type CounterReadingSource = 'manual' | 'snmp-agent' | string;

export type CounterReadingPrinterEntry = {
    printerId: string;
    printerName: string;
    colorMode: 'bw' | 'color';
    values: PrinterCounterValues;
};

export type CounterReadingRecord = {
    id: string;
    /** Календарный день YYYY-MM-DD (основной ключ для новых записей) */
    dateKey?: string;
    /** Месяц YYYY-MM — для legacy-документов или денормализации */
    periodKey: string;
    completedAt: string;
    userId: string;
    userName: string;
    note?: string;
    source?: CounterReadingSource;
    printers: CounterReadingPrinterEntry[];
    /** Заполняются при правке уже внесённых показаний */
    updatedAt?: string;
    updatedByName?: string;
};

const COL = 'CounterReadings';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const mapDoc = (
    id: string,
    data: Record<string, unknown>
): CounterReadingRecord => {
    const inferred = inferDateKeyAndPeriodFromDoc(id, data);
    return {
        id,
        ...inferred,
        completedAt: String(data.completedAt || ''),
        userId: String(data.userId || ''),
        userName: String(data.userName || ''),
        note: data.note ? String(data.note) : '',
        source: data.source
            ? (String(data.source) as CounterReadingSource)
            : undefined,
        printers: Array.isArray(data.printers)
            ? (data.printers as CounterReadingPrinterEntry[])
            : [],
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        updatedByName: data.updatedByName
            ? String(data.updatedByName)
            : undefined,
    };
};

const mergeDuplicateSortKeys = (
    rows: CounterReadingRecord[]
): CounterReadingRecord[] => {
    const map = new Map<string, CounterReadingRecord>();
    rows.forEach((r) => {
        const k = sortKeyForReading(r);
        const prev = map.get(k);
        if (!prev) {
            map.set(k, r);
            return;
        }
        const prevAt = new Date(prev.completedAt).getTime();
        const nextAt = new Date(r.completedAt).getTime();
        if (nextAt >= prevAt) map.set(k, r);
    });
    return Array.from(map.values()).sort((a, b) =>
        sortKeyForReading(a).localeCompare(sortKeyForReading(b))
    );
};

let cacheAll: CounterReadingRecord[] | null = null;
let cacheFetchedAt = 0;
const CACHE_MS = 30000;

const fetchAllCounterReadingsUncached = async (): Promise<
    CounterReadingRecord[]
> => {
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
};

/**
 * Документы с полем dateKey в диапазоне [fromDateKey, toDateKey].
 * Требует составной индекс: collection group / CounterReadings — dateKey ASC.
 */
const fetchDailyByDateKeyRange = async (
    fromDateKey: string,
    toDateKey: string
): Promise<CounterReadingRecord[]> => {
    try {
        const qy = query(
            collection(db, COL),
            where('dateKey', '>=', fromDateKey),
            where('dateKey', '<=', toDateKey)
        );
        const snap = await getDocs(qy);
        return snap.docs.map((d) => mapDoc(d.id, d.data()));
    } catch (err) {
        console.warn(
            '[counterReadings] dateKey range query failed; falling back to full scan',
            err
        );
        const all = await fetchAllCounterReadingsUncached();
        return all.filter(
            (r) =>
                Boolean(r.dateKey) &&
                sortKeyForReading(r) >= fromDateKey &&
                sortKeyForReading(r) <= toDateKey
        );
    }
};

/** Полный список (слияние дублей по sortKey) */
export const fetchAllCounterReadings = async (
    opts?: { bypassCache?: boolean }
): Promise<CounterReadingRecord[]> => {
    if (!opts?.bypassCache && cacheAll && Date.now() - cacheFetchedAt < CACHE_MS) {
        return cacheAll;
    }
    const rows = mergeDuplicateSortKeys(await fetchAllCounterReadingsUncached());
    cacheAll = rows;
    cacheFetchedAt = Date.now();
    return rows;
};

export const invalidateCounterReadingsCache = () => {
    cacheAll = null;
};

export const fetchLastCounterReading =
    async (): Promise<CounterReadingRecord | null> => {
        const all = await fetchAllCounterReadings();
        if (all.length === 0) return null;
        return all.reduce((a, b) =>
            sortKeyForReading(a) >= sortKeyForReading(b) ? a : b
        );
    };

export const fetchCounterReadingsInDateRange = async (
    fromDateKey: string,
    toDateKey: string
): Promise<CounterReadingRecord[]> => {
    const all = await fetchAllCounterReadings();
    return all.filter(
        (r) =>
            sortKeyForReading(r) >= fromDateKey &&
            sortKeyForReading(r) <= toDateKey
    );
};

/**
 * Снимки для аналитики: [день до from) .. to] + legacy месяцы, пересекающие диапазон.
 */
export const fetchCounterReadingsForAnalytics = async (
    fromDateKey: string,
    toDateKey: string
): Promise<CounterReadingRecord[]> => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const prev = new Date(`${fromDateKey}T12:00:00`);
    prev.setDate(prev.getDate() - 1);
    const anchorFrom = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;

    const [dailyInRange, all] = await Promise.all([
        fetchDailyByDateKeyRange(anchorFrom, toDateKey),
        fetchAllCounterReadings(),
    ]);
    const fromM = fromDateKey.slice(0, 7);
    const toM = toDateKey.slice(0, 7);

    const legacyPicked = all.filter((r) => {
        if (r.dateKey) return false;
        return r.periodKey >= fromM && r.periodKey <= toM;
    });

    const byId = new Map<string, CounterReadingRecord>();
    dailyInRange.forEach((r) => byId.set(r.id, r));
    legacyPicked.forEach((r) => {
        if (!byId.has(r.id)) byId.set(r.id, r);
    });

    return mergeDuplicateSortKeys(Array.from(byId.values()));
};

/** @deprecated */
export const fetchCounterReadingsForVolumeChart = async (
    monthsBack = 14
): Promise<CounterReadingRecord[]> => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const from = new Date(now);
    from.setMonth(from.getMonth() - Math.max(1, monthsBack));
    const fromStr = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
    return fetchCounterReadingsForAnalytics(fromStr, to);
};

export const fetchCounterReadingByPeriod = async (
    periodKey: string
): Promise<CounterReadingRecord | null> => {
    if (DAY_RE.test(periodKey)) {
        const snap = await getDoc(doc(db, COL, periodKey));
        if (snap.exists()) {
            invalidateCounterReadingsCache();
            return mapDoc(snap.id, snap.data());
        }
    }
    const snap = await getDoc(doc(db, COL, periodKey));
    if (snap.exists()) {
        invalidateCounterReadingsCache();
        return mapDoc(snap.id, snap.data());
    }

    const all = await fetchAllCounterReadings({ bypassCache: true });
    const found = all.filter((r) => r.periodKey === periodKey);
    if (found.length === 0) return null;
    return found.sort((a, b) =>
        b.completedAt.localeCompare(a.completedAt)
    )[0];
};

export const fetchCounterReadingByDateKey = async (
    dateKey: string
): Promise<CounterReadingRecord | null> =>
    fetchCounterReadingByPeriod(dateKey);

export const fetchPreviousCounterReading = async (
    sortKey: string
): Promise<CounterReadingRecord | null> => {
    const all = await fetchAllCounterReadings();
    const prev = all
        .filter((r) => sortKeyForReading(r) < sortKey)
        .sort((a, b) =>
            sortKeyForReading(b).localeCompare(sortKeyForReading(a))
        );
    return prev[0] || null;
};

export type CounterReadingSaveMode = 'create' | 'update';

export const markCounterReadingDone = async (input: {
    dateKey: string;
    mode: CounterReadingSaveMode;
    userId: string;
    userName: string;
    printers: CounterReadingPrinterEntry[];
    note?: string;
    source?: CounterReadingSource;
}): Promise<CounterReadingRecord> => {
    const now = new Date().toISOString();
    const dateKey = input.dateKey.trim();
    if (!DAY_RE.test(dateKey)) {
        throw new Error('Некорректная дата снятия');
    }
    const periodKey = dateKey.slice(0, 7);
    const ref = doc(db, COL, dateKey);

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);

        if (input.mode === 'create') {
            if (snap.exists()) {
                throw new Error(
                    'Показания за этот день уже внесены. Откройте запись и нажмите «Изменить».'
                );
            }
            const payload = {
                dateKey,
                periodKey,
                completedAt: now,
                userId: input.userId,
                userName: input.userName,
                note: input.note || '',
                printers: input.printers,
                source: input.source || 'manual',
            };
            tx.set(ref, payload);
            invalidateCounterReadingsCache();
            return mapDoc(dateKey, payload);
        }

        if (!snap.exists()) {
            throw new Error(
                'Запись за этот день не найдена — возможно, её удалили. Обновите страницу.'
            );
        }
        const existing = mapDoc(snap.id, snap.data());
        const patch = {
            printers: input.printers,
            note: input.note ?? existing.note ?? '',
            updatedAt: now,
            updatedByName: input.userName,
            periodKey,
            dateKey,
        };
        tx.update(ref, patch);
        invalidateCounterReadingsCache();
        return { ...existing, ...patch };
    });
};

/** Документы только с устаревшим ключом месяца (для админских утилит) */
export const fetchLegacyMonthOnlyReadings = async (): Promise<
    CounterReadingRecord[]
> => {
    const all = await fetchAllCounterReadings();
    return all.filter((r) => !r.dateKey);
};
