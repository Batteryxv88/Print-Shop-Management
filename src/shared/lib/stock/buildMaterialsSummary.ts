import {
    isActiveCostMovement,
    StockLot,
    StockMovement,
} from '../../../services/stockAccounting';
import { formatPeriodLabel } from '../utils/counterReading';
import { toPeriodKey } from './buildPrinterMonthlyCosts';

export type MaterialKind = 'paper' | 'lamination';

export type MaterialTotals = {
    purchasedQty: number;
    purchasedCost: number;
    usedQty: number;
    usedCost: number;
    stockQty: number;
    stockValue: number;
};

export type MaterialMonthRow = {
    periodKey: string;
    label: string;
    purchased: number;
    used: number;
};

export type MaterialsSummary = {
    byKind: Record<MaterialKind, MaterialTotals>;
    /** Помесячно, деньги, обе категории вместе; максимум 12 месяцев */
    months: MaterialMonthRow[];
    hasData: boolean;
};

const emptyTotals = (): MaterialTotals => ({
    purchasedQty: 0,
    purchasedCost: 0,
    usedQty: 0,
    usedCost: 0,
    stockQty: 0,
    stockValue: 0,
});

const kindOf = (
    m: Pick<StockMovement, 'type' | 'costCategory'>
): MaterialKind | null => {
    if (m.type === 'paper' || m.costCategory === 'paper') return 'paper';
    if (m.type === 'lamination' || m.costCategory === 'lamination') {
        return 'lamination';
    }
    return null;
};

/**
 * Сводка по бумаге и ламинации: закуплено / потрачено за период
 * (из движений) и остаток (из открытых FIFO-партий).
 */
export const buildMaterialsSummary = (
    periodMovements: StockMovement[],
    allMovements: StockMovement[],
    lots: StockLot[]
): MaterialsSummary => {
    const byKind: Record<MaterialKind, MaterialTotals> = {
        paper: emptyTotals(),
        lamination: emptyTotals(),
    };

    periodMovements.forEach((m) => {
        if (!isActiveCostMovement(m)) return;
        const kind = kindOf(m);
        if (!kind) return;
        const qty = Number(m.qty) || 0;
        const cost = Number(m.totalCost) || 0;
        if (m.kind === 'purchase') {
            byKind[kind].purchasedQty += qty;
            byKind[kind].purchasedCost += cost;
        } else if (m.kind === 'writeoff') {
            byKind[kind].usedQty += qty;
            byKind[kind].usedCost += cost;
        }
    });

    lots.forEach((lot) => {
        const kind = kindOf(lot);
        if (!kind) return;
        const left = Number(lot.qtyLeft) || 0;
        byKind[kind].stockQty += left;
        byKind[kind].stockValue += left * (Number(lot.unitPrice) || 0);
    });

    const monthMap = new Map<string, { purchased: number; used: number }>();
    allMovements.forEach((m) => {
        if (!isActiveCostMovement(m)) return;
        if (!kindOf(m)) return;
        const pk = toPeriodKey(m.date);
        if (!pk) return;
        const cost = Number(m.totalCost) || 0;
        if (!(cost > 0)) return;
        const cell = monthMap.get(pk) || { purchased: 0, used: 0 };
        if (m.kind === 'purchase') cell.purchased += cost;
        else if (m.kind === 'writeoff') cell.used += cost;
        monthMap.set(pk, cell);
    });

    const months: MaterialMonthRow[] = Array.from(monthMap.keys())
        .sort()
        .slice(-12)
        .map((pk) => ({
            periodKey: pk,
            label: formatPeriodLabel(pk),
            ...monthMap.get(pk)!,
        }));

    const hasData =
        months.length > 0 ||
        (Object.values(byKind) as MaterialTotals[]).some(
            (t) =>
                t.purchasedQty > 0 ||
                t.usedQty > 0 ||
                t.stockQty > 0
        );

    return { byKind, months, hasData };
};
