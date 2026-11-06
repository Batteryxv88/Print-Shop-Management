import {
    isActiveCostMovement,
    StockMovement,
} from '../../../services/stockAccounting';
import { normalizeColorList, normalizeColorCode } from '../printers/tonerColors';
import {
    resolveMovementPrinterId,
    resolveUsagePrinterId,
    type PrinterRef,
} from '../printers/printerIdentity';

type TonerHistoryLike = {
    id: string;
    toner: {
        date?: string;
        machine?: string;
        printerId?: string;
        color?: string;
        movementId?: string;
    };
};

/** color → шт. */
export type TonerUnits = Record<string, number>;

const inRange = (raw: string | undefined, fromIso: string, toIso: string) => {
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    return t >= new Date(fromIso).getTime() && t <= new Date(toIso).getTime();
};

/**
 * Сколько тонеров (в штуках, по цветам) потратил каждый аппарат за период (ключ — printerId).
 */
export const buildTonerUnits = (
    movements: StockMovement[],
    tonerHistory: TonerHistoryLike[],
    fromIso: string,
    toIso: string,
    printers: PrinterRef[]
): Map<string, TonerUnits> => {
    const out = new Map<string, TonerUnits>();
    const seenMovementIds = new Set<string>();
    const catalog = printers.map((p) => ({ id: p.id, name: p.name }));

    const add = (printerId: string, color: string, qty: number) => {
        const id = printerId.trim();
        const code = normalizeColorCode(color || '');
        if (!id || !code || !(qty > 0)) return;
        const units = out.get(id) || {};
        units[code] = (units[code] || 0) + qty;
        out.set(id, units);
    };

    movements.forEach((m) => {
        if (!isActiveCostMovement(m)) return;
        if (m.kind !== 'writeoff' || m.type !== 'toner') return;
        if (!inRange(m.date, fromIso, toIso)) return;
        if (m.id) seenMovementIds.add(m.id);
        const printerId = resolveMovementPrinterId(m, catalog);
        if (!printerId) return;
        add(printerId, m.color || '', Number(m.qty) || 1);
    });

    tonerHistory.forEach(({ toner }) => {
        const mid = (toner.movementId || '').trim();
        if (mid && seenMovementIds.has(mid)) return;
        if (!inRange(toner.date, fromIso, toIso)) return;
        const printerId = resolveUsagePrinterId(toner, catalog);
        if (!printerId) return;
        add(printerId, toner.color || '', 1);
    });

    return out;
};

/** Цвета в каноническом порядке C M Y K … */
export const sortedTonerColors = (units: TonerUnits): string[] =>
    normalizeColorList(Object.keys(units)).filter((c) => units[c] > 0);

export const totalTonerUnits = (units: TonerUnits | undefined): number =>
    units ? Object.values(units).reduce((s, n) => s + n, 0) : 0;
