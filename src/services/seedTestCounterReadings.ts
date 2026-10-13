import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    setDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import type { CounterReadingPrinterEntry } from './counterReadings';
import type { PrinterCounterValues } from '../shared/lib/counterReading/fields';

type PrinterDoc = {
    id: string;
    name: string;
    colorMode?: string;
    colors?: string[];
};

const norm = (s: string) =>
    s
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[._\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const findPrinter = (printers: PrinterDoc[], ...aliases: string[]) => {
    for (const alias of aliases) {
        const a = norm(alias);
        const hit =
            printers.find((p) => norm(p.name) === a) ||
            printers.find((p) => {
                const n = norm(p.name);
                return n.includes(a) || a.includes(n);
            }) ||
            printers.find((p) => {
                const n = norm(p.name);
                if (/^\d+$/.test(a) && n.replace(/\D/g, '').includes(a)) {
                    return true;
                }
                // «400» + лю/label
                if (a.includes('400') && n.includes('400')) return true;
                return false;
            });
        if (hit) return hit;
    }
    return null;
};

/** Октябрь 2026 — точные значения пользователя */
const OCT: Record<
    string,
    { aliases: string[]; values: PrinterCounterValues; colorMode: 'bw' | 'color' }
> = {
    p6136: {
        aliases: ['6136'],
        colorMode: 'bw',
        values: { total: 20000 },
    },
    alKva: {
        aliases: ['al 230 ква', 'al230 ква', 'ква', 'al 230 kva'],
        colorMode: 'color',
        values: { total: 15000, color: 13000, mono: 2000 },
    },
    al400lu: {
        aliases: [
            'al 400лю',
            'al 400 лю',
            'al400лю',
            'al400 лю',
            'label 400',
            'лабэл 400',
            'лабел 400',
            'label400',
        ],
        colorMode: 'color',
        values: {
            total: 200000,
            color: 198000,
            mono: 1000,
            special: { W: 1000 },
        },
    },
    alOleg: {
        aliases: ['al 230 олег', 'al230 олег', 'олег', 'al 230 oleg'],
        colorMode: 'color',
        values: { total: 40000, color: 35000, mono: 5000 },
    },
};

/** Прирост абсолютных показаний (счётчики только вверх) */
const bumpAbsolute = (
    prev: PrinterCounterValues,
    seed: number
): PrinterCounterValues => {
    let s = seed >>> 0;
    const nextJ = (min: number, max: number) => {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        return min + (s % (max - min + 1));
    };

    const addTotal = nextJ(4000, 18000);
    const out: PrinterCounterValues = {
        total: prev.total + addTotal,
    };

    if (prev.mono != null || prev.color != null) {
        const addMono = nextJ(300, 2500);
        let addColor = Math.max(500, addTotal - addMono);
        let addSpecial = 0;
        if (prev.special) {
            out.special = {};
            Object.keys(prev.special).forEach((k) => {
                const add = nextJ(80, 600);
                addSpecial += add;
                out.special![k] = (prev.special![k] || 0) + add;
            });
            addColor = Math.max(0, addColor - addSpecial);
        }
        out.mono = (prev.mono || 0) + addMono;
        out.color = (prev.color || 0) + addColor;
        // выровнять total под сумму частей, если они есть
        out.total =
            out.mono +
            out.color +
            Object.values(out.special || {}).reduce((a, b) => a + b, 0);
    }

    return out;
};

const OLD_SEED_PERIODS = ['2026-07', '2026-08', '2026-09'];

const scaleDown = (
    base: PrinterCounterValues,
    factor: number
): PrinterCounterValues => {
    const round = (n: number) => Math.max(1, Math.round(n * factor));
    const out: PrinterCounterValues = { total: round(base.total) };
    if (base.mono != null) out.mono = round(base.mono);
    if (base.color != null) out.color = round(base.color);
    if (base.special) {
        out.special = {};
        Object.entries(base.special).forEach(([k, v]) => {
            out.special![k] = round(v);
        });
    }
    return out;
};

/**
 * Сентябрь (база для дельты октября) + октябрь (точные) +
 * нояб / дек / янв 2027 (рандом вперёд).
 */
export const seedTestCounterReadings = async (): Promise<{
    matched: string[];
    missing: string[];
    periods: string[];
    printersInDb: string[];
}> => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Нужна авторизация');

    const snap = await getDocs(collection(db, 'Printers'));
    const printers: PrinterDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PrinterDoc, 'id'>),
    }));

    const matched: string[] = [];
    const missing: string[] = [];
    const resolved: Array<{
        key: string;
        printer: PrinterDoc;
        colorMode: 'bw' | 'color';
        oct: PrinterCounterValues;
    }> = [];
    const usedIds = new Set<string>();

    Object.entries(OCT).forEach(([key, cfg]) => {
        const printer = findPrinter(
            printers.filter((p) => !usedIds.has(p.id)),
            ...cfg.aliases
        );
        if (!printer) {
            missing.push(cfg.aliases[0]);
            return;
        }
        usedIds.add(printer.id);
        matched.push(`${printer.name} ← ${cfg.aliases[0]}`);
        resolved.push({
            key,
            printer,
            colorMode: cfg.colorMode,
            oct: cfg.values,
        });
    });

    if (resolved.length === 0) {
        throw new Error(
            `Не найдены принтеры. В базе: ${printers.map((p) => p.name).join(', ') || 'пусто'}`
        );
    }

    // убрать совсем старый seed
    await Promise.all(
        OLD_SEED_PERIODS.map((pk) =>
            deleteDoc(doc(db, 'CounterReadings', pk)).catch(() => undefined)
        )
    );

    // сен — скрытая база, чтобы октябрь попал на график как объём
    const periods = [
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
        '2027-01',
    ];
    const prevValues: Record<string, PrinterCounterValues> = {};

    for (let mi = 0; mi < periods.length; mi++) {
        const periodKey = periods[mi];
        const [y, m] = periodKey.split('-').map(Number);

        const entries: CounterReadingPrinterEntry[] = resolved.map((r, idx) => {
            let values: PrinterCounterValues;
            if (periodKey === '2026-09') {
                values = scaleDown(r.oct, 0.88);
            } else if (periodKey === '2026-10') {
                values = { ...r.oct, special: { ...(r.oct.special || {}) } };
            } else {
                values = bumpAbsolute(
                    prevValues[r.key],
                    4200 + mi * 97 + idx * 31
                );
            }
            prevValues[r.key] = values;
            return {
                printerId: r.printer.id,
                printerName: r.printer.name,
                colorMode: r.colorMode,
                values,
            };
        });

        await setDoc(
            doc(db, 'CounterReadings', periodKey),
            {
                periodKey,
                completedAt: new Date(y, m - 1, 15, 12, 0, 0).toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'seed',
                note: 'test-seed',
                printers: entries,
            },
            { merge: true }
        );
    }

    return {
        matched,
        missing,
        periods,
        printersInDb: printers.map((p) => p.name),
    };
};
