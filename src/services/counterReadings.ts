import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PrinterCounterValues } from '../shared/lib/counterReading/fields';

export type CounterReadingPrinterEntry = {
    printerId: string;
    printerName: string;
    colorMode: 'bw' | 'color';
    values: PrinterCounterValues;
};

export type CounterReadingRecord = {
    id: string;
    /** Ключ периода YYYY-MM */
    periodKey: string;
    completedAt: string;
    userId: string;
    userName: string;
    note?: string;
    printers: CounterReadingPrinterEntry[];
    /** Заполняются при правке уже внесённых показаний */
    updatedAt?: string;
    updatedByName?: string;
};

const COL = 'CounterReadings';

const mapDoc = (
    id: string,
    data: Record<string, unknown>
): CounterReadingRecord => ({
    id,
    periodKey: String(data.periodKey || id),
    completedAt: String(data.completedAt || ''),
    userId: String(data.userId || ''),
    userName: String(data.userName || ''),
    note: data.note ? String(data.note) : '',
    printers: Array.isArray(data.printers)
        ? (data.printers as CounterReadingPrinterEntry[])
        : [],
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    updatedByName: data.updatedByName ? String(data.updatedByName) : undefined,
});

export const fetchLastCounterReading =
    async (): Promise<CounterReadingRecord | null> => {
        const q = query(
            collection(db, COL),
            orderBy('periodKey', 'desc'),
            limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const d = snap.docs[0];
        return mapDoc(d.id, d.data());
    };

export const fetchAllCounterReadings = async (): Promise<
    CounterReadingRecord[]
> => {
    const q = query(collection(db, COL), orderBy('periodKey', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
};

export const fetchCounterReadingByPeriod = async (
    periodKey: string
): Promise<CounterReadingRecord | null> => {
    const snap = await getDoc(doc(db, COL, periodKey));
    if (snap.exists()) return mapDoc(snap.id, snap.data());

    // Legacy: документы с auto-id
    const all = await fetchAllCounterReadings();
    const found = all.filter((r) => r.periodKey === periodKey);
    if (found.length === 0) return null;
    return found.sort((a, b) =>
        b.completedAt.localeCompare(a.completedAt)
    )[0];
};

/** Предыдущее снятие до указанного периода (для подсказки и дельты) */
export const fetchPreviousCounterReading = async (
    periodKey: string
): Promise<CounterReadingRecord | null> => {
    const q = query(
        collection(db, COL),
        where('periodKey', '<', periodKey),
        orderBy('periodKey', 'desc'),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return mapDoc(d.id, d.data());
};

/** Показания для графика объёма: последние N месяцев + одно «до» для дельты */
export const fetchCounterReadingsForVolumeChart = async (
    monthsBack = 14
): Promise<CounterReadingRecord[]> => {
    const recentQ = query(
        collection(db, COL),
        orderBy('periodKey', 'desc'),
        limit(Math.max(2, monthsBack + 1))
    );
    const recentSnap = await getDocs(recentQ);
    const recent = recentSnap.docs
        .map((d) => mapDoc(d.id, d.data()))
        .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    if (recent.length >= 2) return recent;

    const anchor = recent[0]?.periodKey;
    if (!anchor) return recent;

    const beforeQ = query(
        collection(db, COL),
        where('periodKey', '<', anchor),
        orderBy('periodKey', 'desc'),
        limit(1)
    );
    const beforeSnap = await getDocs(beforeQ);
    if (beforeSnap.empty) return recent;

    const before = mapDoc(
        beforeSnap.docs[0].id,
        beforeSnap.docs[0].data()
    );
    return [before, ...recent].sort((a, b) =>
        a.periodKey.localeCompare(b.periodKey)
    );
};

export type CounterReadingSaveMode = 'create' | 'update';

/**
 * Сохранение показаний за период — в транзакции, чтобы нельзя было
 * внести их дважды (create) или «создать» при правке (update).
 * При правке дата/автор первого снятия сохраняются, фиксируется updatedAt.
 */
export const markCounterReadingDone = async (input: {
    periodKey: string;
    mode: CounterReadingSaveMode;
    userId: string;
    userName: string;
    printers: CounterReadingPrinterEntry[];
    note?: string;
}): Promise<CounterReadingRecord> => {
    const now = new Date().toISOString();
    const ref = doc(db, COL, input.periodKey);

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);

        if (input.mode === 'create') {
            if (snap.exists()) {
                throw new Error(
                    'Показания за этот период уже внесены. Откройте запись и нажмите «Изменить».'
                );
            }
            const payload = {
                periodKey: input.periodKey,
                completedAt: now,
                userId: input.userId,
                userName: input.userName,
                note: input.note || '',
                printers: input.printers,
            };
            tx.set(ref, payload);
            return { id: input.periodKey, ...payload };
        }

        if (!snap.exists()) {
            throw new Error(
                'Запись за этот период не найдена — возможно, её удалили. Обновите страницу.'
            );
        }
        const existing = mapDoc(snap.id, snap.data());
        const patch = {
            printers: input.printers,
            note: input.note ?? existing.note ?? '',
            updatedAt: now,
            updatedByName: input.userName,
        };
        tx.update(ref, patch);
        return { ...existing, ...patch };
    });
};
