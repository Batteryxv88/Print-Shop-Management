import type { StockMovement } from '../../../services/stockAccounting';
import type { CostCategory } from './costCategory';
import { inferPartCostCategory } from './costCategory';

type UsedPartLike = {
    id: string;
    part: {
        date?: string;
        machine?: string;
        partN?: string;
        partName?: string;
        quantity?: number;
        totalCost?: number;
        unitPriceAvg?: number;
        movementId?: string;
        costCategory?: string;
    };
};

type TonerLike = {
    id: string;
    toner: {
        date?: string;
        machine?: string;
        color?: string;
        totalCost?: number;
        unitPriceAvg?: number;
        movementId?: string;
    };
};

/** Средние цены из закупок: partN → цена, color|model → цена тонера */
const buildPurchasePriceMaps = (purchases: StockMovement[]) => {
    const partSum = new Map<string, { sum: number; n: number }>();
    const tonerSum = new Map<string, { sum: number; n: number }>();

    purchases.forEach((m) => {
        if (String(m.kind).toLowerCase() !== 'purchase') return;
        const price = Number(m.unitPriceAvg);
        if (!(price > 0)) return;

        if (m.type === 'part' && m.partN) {
            const key = m.partN.trim().toUpperCase();
            const cur = partSum.get(key) || { sum: 0, n: 0 };
            cur.sum += price;
            cur.n += 1;
            partSum.set(key, cur);
        }
        if (m.type === 'toner' && m.color) {
            const key = `${String(m.color).toUpperCase()}|${(m.model || '').trim()}`;
            const cur = tonerSum.get(key) || { sum: 0, n: 0 };
            cur.sum += price;
            cur.n += 1;
            tonerSum.set(key, cur);
        }
    });

    const partPrice = new Map<string, number>();
    partSum.forEach((v, k) => {
        if (v.n > 0) partPrice.set(k, v.sum / v.n);
    });
    const tonerPrice = new Map<string, number>();
    tonerSum.forEach((v, k) => {
        if (v.n > 0) tonerPrice.set(k, v.sum / v.n);
    });
    return { partPrice, tonerPrice };
};

/**
 * История замен → синтетические writeoff.
 * Если totalCost нет — оцениваем по средней цене закупки.
 */
export const usageEventsToMovements = (
    usedParts: UsedPartLike[],
    tonerHistory: TonerLike[],
    purchaseMovements: StockMovement[] = []
): StockMovement[] => {
    const { partPrice, tonerPrice } =
        buildPurchasePriceMaps(purchaseMovements);
    const out: StockMovement[] = [];

    usedParts.forEach(({ id, part }) => {
        const qty = Number(part.quantity) || 1;
        let unit = Number(part.unitPriceAvg) || 0;
        let cost = Number(part.totalCost) || 0;

        if (!(cost > 0)) {
            const pn = (part.partN || '').trim().toUpperCase();
            if (pn && partPrice.has(pn)) {
                unit = partPrice.get(pn)!;
                cost = unit * qty;
            }
        }
        if (!(cost > 0)) return;

        const mid = (part.movementId || '').trim();
        out.push({
            id: mid || `used-part-${id}`,
            kind: 'writeoff',
            type: 'part',
            stockId: '',
            partN: part.partN || '',
            partName: part.partName || '',
            costCategory: inferPartCostCategory({
                costCategory: part.costCategory,
            }),
            qty,
            totalCost: cost,
            unitPriceAvg: unit || cost / qty,
            date: String(part.date || ''),
            machine: (part.machine || '').trim(),
            lots: [],
        });
    });

    tonerHistory.forEach(({ id, toner }) => {
        let unit = Number(toner.unitPriceAvg) || 0;
        let cost = Number(toner.totalCost) || 0;

        if (!(cost > 0)) {
            const color = String(toner.color || '').toUpperCase();
            // ищем любую цену этого цвета
            let found = 0;
            tonerPrice.forEach((p, key) => {
                if (found > 0) return;
                if (key.startsWith(`${color}|`)) found = p;
            });
            if (found > 0) {
                unit = found;
                cost = found;
            }
        }
        if (!(cost > 0)) return;

        const mid = (toner.movementId || '').trim();
        out.push({
            id: mid || `used-toner-${id}`,
            kind: 'writeoff',
            type: 'toner',
            stockId: '',
            color: toner.color || '',
            costCategory: 'toner' as CostCategory,
            qty: 1,
            totalCost: cost,
            unitPriceAvg: unit || cost,
            date: String(toner.date || ''),
            machine: (toner.machine || '').trim(),
            lots: [],
        });
    });

    return out;
};
