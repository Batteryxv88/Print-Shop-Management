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
import type { PrinterRef } from '../printers/printerIdentity';
import { resolveMovementPrinterId } from '../printers/printerIdentity';

export type CategoryBreakdown = Record<CostCategory, number>;

export type PrinterAnalyticsRow = {
    printerId: string;
    name: string;
    model: string;
    purchased: CategoryBreakdown;
    purchasedTotal: number;
    used: CategoryBreakdown;
    usedTotal: number;
    /** Замены запчастей/расходки, шт. */
    replacements: number;
    economy: number;
};

/** Бумага и ламинация — не затраты принтера */
export const isMaterialMovement = (
    m: Pick<StockMovement, 'type' | 'costCategory'>
): boolean =>
    m.type === 'paper' ||
    m.type === 'lamination' ||
    m.costCategory === 'paper' ||
    m.costCategory === 'lamination';

const addTo = (
    target: CategoryBreakdown,
    category: CostCategory | undefined,
    amount: number
) => {
    const key: CostCategory =
        category && COST_CATEGORIES.includes(category)
            ? category
            : 'consumable';
    target[key] += amount;
};

/**
 * Собирает метрики по каждому принтеру за период (ключ — printerId).
 * Учитываются только движения с явным printerId (нет распределения «на модель»).
 */
export const buildPrinterAnalytics = (
    printers: PrinterRef[],
    movements: StockMovement[]
): PrinterAnalyticsRow[] => {
    const rows = new Map<string, PrinterAnalyticsRow>();

    const emptyRow = (p: PrinterRef): PrinterAnalyticsRow => ({
        printerId: p.id,
        name: p.name,
        model: p.model || '',
        purchased: emptyCategoryBreakdown(),
        purchasedTotal: 0,
        used: emptyCategoryBreakdown(),
        usedTotal: 0,
        replacements: 0,
        economy: 0,
    });

    printers.forEach((p) => {
        if (!p.id || !p.name) return;
        rows.set(p.id, emptyRow(p));
    });

    const catalog = printers.map((p) => ({ id: p.id, name: p.name }));

    const rowForId = (printerId: string): PrinterAnalyticsRow | null =>
        rows.get(printerId) || null;

    movements.forEach((m) => {
        if (!isActiveCostMovement(m)) return;
        if (isMaterialMovement(m)) return;

        const amount = Number(m.totalCost) || 0;
        const category = m.costCategory;
        const resolvedId = resolveMovementPrinterId(m, catalog);

        if (m.kind === 'engineer') {
            if (!resolvedId || amount <= 0) return;
            const row = rowForId(resolvedId);
            if (!row) return;
            addTo(row.used, 'engineer', amount);
            return;
        }

        if (m.kind === 'purchase' && amount > 0) {
            if (!resolvedId) return;
            const row = rowForId(resolvedId);
            if (!row) return;
            addTo(row.purchased, category, amount);
            return;
        }

        if (isProductionWriteoff(m) && resolvedId) {
            const row = rowForId(resolvedId);
            if (!row) return;
            if (amount > 0) addTo(row.used, category, amount);
            if (m.type === 'part') {
                row.replacements += Number(m.qty) || 1;
            }
            row.economy += Number(m.economyAmount) || 0;
        }
    });

    return Array.from(rows.values())
        .map((row) => ({
            ...row,
            purchasedTotal: sumBreakdown(row.purchased),
            usedTotal: sumBreakdown(row.used),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
};

export const collectUnattachedMovements = (
    printers: PrinterRef[],
    movements: StockMovement[]
): StockMovement[] => {
    const catalog = printers.map((p) => ({ id: p.id, name: p.name }));
    return movements.filter((m) => {
        if (!isActiveCostMovement(m)) return false;
        if (isMaterialMovement(m)) return false;
        if (!(Number(m.totalCost) > 0)) return false;
        const resolvedId = resolveMovementPrinterId(m, catalog);
        if (resolvedId) return false;
        return (
            m.kind === 'purchase' ||
            m.kind === 'writeoff' ||
            m.kind === 'engineer'
        );
    });
};
