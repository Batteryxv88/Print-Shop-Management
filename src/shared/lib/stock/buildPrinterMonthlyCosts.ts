import {
    COST_CATEGORIES,
    CostCategory,
    emptyCategoryBreakdown,
    sumBreakdown,
} from './costCategory';
import {
    isActiveCostMovement,
    isProductionWriteoff,
    StockMovement,
} from '../../../services/stockAccounting';
import { formatPeriodLabel, pad2 } from '../utils/counterReading';
import { isMaterialMovement } from './buildPrinterAnalytics';

export type CostMode = 'purchase' | 'used';

export type PrinterMonthCost = {
    name: string;
    total: number;
    breakdown: Record<CostCategory, number>;
};

export type PrinterCostMonthRow = {
    periodKey: string;
    label: string;
    printers: PrinterMonthCost[];
    [printerName: string]: string | number | PrinterMonthCost[] | undefined;
};

type PrinterRef = { name: string; model: string };

const norm = (s: string) =>
    s.toLowerCase().replace(/\s+/g, ' ').trim();

const parseMovementDate = (raw: unknown): Date | null => {
    if (!raw) return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'object') {
        const ts = raw as { toDate?: () => Date; seconds?: number };
        if (typeof ts.toDate === 'function') {
            const d = ts.toDate();
            return Number.isNaN(d.getTime()) ? null : d;
        }
        if (typeof ts.seconds === 'number') {
            return new Date(ts.seconds * 1000);
        }
    }
    return null;
};

/** YYYY-MM из любого разумного формата даты */
export const toPeriodKey = (raw: unknown): string | null => {
    const d = parseMovementDate(raw);
    if (d) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

    const s = String(raw ?? '').trim();
    if (!s) return null;

    let m = s.match(/(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;

    // DD.MM.YYYY
    m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) return `${m[3]}-${pad2(Number(m[2]))}`;

    return null;
};

const movementAmount = (m: StockMovement): number => {
    const direct = Number(m.totalCost);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const fromLots = (m.lots || []).reduce(
        (s, lot) => s + (Number(lot.cost) || 0),
        0
    );
    if (fromLots > 0) return fromLots;
    const qty = Number(m.qty) || 0;
    const price = Number(m.unitPriceAvg) || 0;
    const calc = qty * price;
    return calc > 0 ? calc : 0;
};

const addTo = (
    target: Record<CostCategory, number>,
    category: CostCategory | undefined,
    amount: number
) => {
    const key: CostCategory =
        category && COST_CATEGORIES.includes(category)
            ? category
            : 'consumable';
    target[key] += amount;
};

const peersForModel = (
    printersByModel: Map<string, string[]>,
    model: string
): string[] => {
    const exact = printersByModel.get(model);
    if (exact && exact.length) return exact;
    const n = norm(model);
    if (!n) return [];
    for (const [key, names] of Array.from(printersByModel.entries())) {
        const kn = norm(key);
        if (kn === n || kn.includes(n) || n.includes(kn)) return names;
    }
    return [];
};

const normalizeKind = (kind: unknown) =>
    String(kind || '')
        .toLowerCase()
        .trim();

/**
 * Месячные затраты по принтерам (закупки или использование).
 * Только месяцы с суммами; максимум 12.
 * Бумага/ламинация и движения без привязки к аппарату не учитываются.
 *
 * @param usageExtra — доп. списания из истории замен (UsedParts / Toners)
 */
export const buildPrinterMonthlyCosts = (
    printers: PrinterRef[],
    movements: StockMovement[],
    mode: CostMode,
    usageExtra: StockMovement[] = []
): PrinterCostMonthRow[] => {
    const printerNames = printers.map((p) => p.name).filter(Boolean);
    const printersByModel = new Map<string, string[]>();
    printers.forEach((p) => {
        if (!p.name || !p.model) return;
        const key = p.model.trim();
        const list = printersByModel.get(key) || [];
        list.push(p.name);
        printersByModel.set(key, list);
    });

    type Cell = Record<CostCategory, number>;
    const months = new Map<string, Map<string, Cell>>();
    /** id движений, которые реально попали в сумму (для дедупа истории) */
    const creditedIds = new Set<string>();

    const ensure = (periodKey: string, name: string): Cell => {
        if (!months.has(periodKey)) months.set(periodKey, new Map());
        const map = months.get(periodKey)!;
        if (!map.has(name)) map.set(name, emptyCategoryBreakdown());
        return map.get(name)!;
    };

    const credit = (
        periodKey: string,
        name: string,
        category: CostCategory | undefined,
        amount: number
    ) => {
        if (!(amount > 0) || !name) return false;
        addTo(ensure(periodKey, name), category, amount);
        return true;
    };

    const consumeUsed = (m: StockMovement, trackId: boolean) => {
        if (!isActiveCostMovement(m)) return;
        if (isMaterialMovement(m)) return;
        const periodKey = toPeriodKey(m.date);
        if (!periodKey) return;
        const amount = movementAmount(m);
        if (!(amount > 0)) return;

        const machine = (m.machine || '').trim();
        if (!machine) return;
        const category = m.costCategory;
        const kind = normalizeKind(m.kind);

        if (kind === 'engineer') {
            if (
                credit(periodKey, machine, 'engineer', amount) &&
                trackId &&
                m.id
            ) {
                creditedIds.add(m.id);
            }
            return;
        }

        if (
            isProductionWriteoff(m) ||
            kind === 'write-off' ||
            kind === 'usage'
        ) {
            if (
                credit(periodKey, machine, category, amount) &&
                trackId &&
                m.id
            ) {
                creditedIds.add(m.id);
            }
        }
    };

    const consumePurchase = (m: StockMovement) => {
        if (!isActiveCostMovement(m)) return;
        if (isMaterialMovement(m)) return;
        const periodKey = toPeriodKey(m.date);
        if (!periodKey) return;
        const amount = movementAmount(m);
        if (!(amount > 0)) return;

        const machine = (m.machine || '').trim();
        const category = m.costCategory;
        const kind = normalizeKind(m.kind);

        // Инженер — только «потрачено»
        if (kind !== 'purchase') return;

        if (machine) {
            credit(periodKey, machine, category, amount);
            return;
        }
        const model = (m.model || '').trim();
        const peers = peersForModel(printersByModel, model);
        if (peers.length === 0) return;
        const share = amount / peers.length;
        peers.forEach((name) => credit(periodKey, name, category, share));
    };

    if (mode === 'purchase') {
        movements.forEach(consumePurchase);
    } else {
        // 1) StockMovements writeoff / engineer
        movements.forEach((m) => {
            const kind = normalizeKind(m.kind);
            if (kind === 'purchase') return;
            consumeUsed(m, true);
        });

        // 2) История замен — если списание по movementId ещё не учтено
        usageExtra.forEach((m) => {
            if (m.id && creditedIds.has(m.id)) return;
            consumeUsed(m, true);
        });
    }

    const periodKeys = Array.from(months.keys())
        .sort()
        .filter((pk) => {
            const map = months.get(pk)!;
            return Array.from(map.values()).some(
                (cell) => sumBreakdown(cell) > 0
            );
        })
        .slice(-12);

    const knownNames = new Set([
        ...printerNames,
        ...periodKeys.flatMap((pk) =>
            Array.from(months.get(pk)?.keys() || [])
        ),
    ]);
    const sortedNames = Array.from(knownNames).sort((a, b) =>
        a.localeCompare(b, 'ru')
    );

    return periodKeys.map((periodKey) => {
        const map = months.get(periodKey)!;
        const points: PrinterMonthCost[] = sortedNames.map((name) => {
            const breakdown = map.get(name) || emptyCategoryBreakdown();
            return {
                name,
                total: sumBreakdown(breakdown),
                breakdown,
            };
        });

        const row: PrinterCostMonthRow = {
            periodKey,
            label: formatPeriodLabel(periodKey),
            printers: points,
        };
        points.forEach((p) => {
            row[p.name] = p.total;
        });
        return row;
    });
};

export const costSeriesHasData = (rows: PrinterCostMonthRow[]): boolean =>
    rows.some((row) => row.printers.some((p) => p.total > 0));
