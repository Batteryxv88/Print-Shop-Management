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

export type CategoryBreakdown = Record<CostCategory, number>;

export type PrinterAnalyticsRow = {
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

type PrinterRef = { name: string; model: string };

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
 * Собирает метрики по каждому принтеру за период.
 * Закупки без machine делятся поровну между принтерами той же модели.
 * Engineer / writeoff с machine — целиком на аппарат.
 * Бумага/ламинация не учитываются.
 */
export const buildPrinterAnalytics = (
    printers: PrinterRef[],
    movements: StockMovement[]
): PrinterAnalyticsRow[] => {
    const rows = new Map<string, PrinterAnalyticsRow>();

    const emptyRow = (name: string, model: string): PrinterAnalyticsRow => ({
        name,
        model,
        purchased: emptyCategoryBreakdown(),
        purchasedTotal: 0,
        used: emptyCategoryBreakdown(),
        usedTotal: 0,
        replacements: 0,
        economy: 0,
    });

    printers.forEach((p) => {
        if (!p.name) return;
        rows.set(p.name, emptyRow(p.name, p.model || ''));
    });

    const printersByModel = new Map<string, string[]>();
    printers.forEach((p) => {
        if (!p.name || !p.model) return;
        const list = printersByModel.get(p.model) || [];
        list.push(p.name);
        printersByModel.set(p.model, list);
    });

    const ensureRow = (name: string, model?: string) => {
        if (!rows.has(name)) rows.set(name, emptyRow(name, model || ''));
        return rows.get(name)!;
    };

    movements.forEach((m) => {
        if (!isActiveCostMovement(m)) return;
        if (isMaterialMovement(m)) return;

        const amount = Number(m.totalCost) || 0;
        const category = m.costCategory;
        const machine = (m.machine || '').trim();

        // Работа инженера — только «потрачено», в закупки не входит
        if (m.kind === 'engineer') {
            if (!machine || amount <= 0) return;
            addTo(ensureRow(machine, m.model).used, 'engineer', amount);
            return;
        }

        if (m.kind === 'purchase' && amount > 0) {
            if (machine) {
                addTo(ensureRow(machine, m.model).purchased, category, amount);
                return;
            }
            const model = (m.model || '').trim();
            const peers = model ? printersByModel.get(model) || [] : [];
            if (peers.length === 0) return;
            const share = amount / peers.length;
            peers.forEach((name) => {
                addTo(rows.get(name)!.purchased, category, share);
            });
            return;
        }

        if (isProductionWriteoff(m) && machine) {
            const row = ensureRow(machine, m.model);
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

/**
 * Движения с суммой, которые не удалось привязать к аппарату:
 * списание/инженер без machine или закупка без machine и без принтеров модели.
 */
export const collectUnattachedMovements = (
    printers: PrinterRef[],
    movements: StockMovement[]
): StockMovement[] => {
    const models = new Set(
        printers.map((p) => (p.model || '').trim()).filter(Boolean)
    );
    return movements.filter((m) => {
        if (!isActiveCostMovement(m)) return false;
        if (isMaterialMovement(m)) return false;
        if (!(Number(m.totalCost) > 0)) return false;
        const machine = (m.machine || '').trim();
        if (machine) return false;
        if (m.kind === 'purchase') {
            return !models.has((m.model || '').trim());
        }
        return m.kind === 'writeoff' || m.kind === 'engineer';
    });
};
