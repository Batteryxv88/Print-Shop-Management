import {
    collection,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    writeBatch,
    updateDoc,
    runTransaction,
    increment,
    onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import {
    CostCategory,
    calcLifeEconomy,
    inferPartCostCategory,
} from '../shared/lib/stock/costCategory';

export type StockItemType =
    | 'part'
    | 'toner'
    | 'engineer'
    | 'paper'
    | 'lamination';
export type MovementKind =
    | 'purchase'
    | 'writeoff'
    | 'adjustment'
    | 'engineer'
    | 'storno';

export type { CostCategory };

export interface StockLot {
    id: string;
    type: StockItemType;
    stockId: string;
    partN?: string;
    partName?: string;
    color?: string;
    model?: string;
    costCategory: CostCategory;
    qtyInitial: number;
    qtyLeft: number;
    unitPrice: number;
    currency: 'RUB';
    purchasedAt: string;
    supplier?: string;
    comment?: string;
    createdBy?: string;
    createdAt: string;
    machine?: string;
}

export interface FifoLotSlice {
    lotId: string;
    qty: number;
    unitPrice: number;
    cost: number;
    costCategory?: CostCategory;
}

export interface StockMovement {
    id: string;
    kind: MovementKind;
    type: StockItemType;
    stockId: string;
    partN?: string;
    partName?: string;
    color?: string;
    model?: string;
    costCategory: CostCategory;
    qty: number;
    totalCost: number;
    unitPriceAvg: number;
    date: string;
    machine?: string;
    man?: string;
    lots: FifoLotSlice[];
    relatedId?: string;
    comment?: string;
    supplier?: string;
    /** Экономия (+) / перерасход (−) по ресурсу */
    economyAmount?: number;
    factoryLife?: number;
    actualLife?: number;
    /** Списание/инженер отменены сторно */
    reversed?: boolean;
    reversedAt?: string;
    reversedBy?: string;
    stornoMovementId?: string;
}

/** Учитывать ли движение в аналитике остатков/затрат */
export const isActiveCostMovement = (
    m: Pick<StockMovement, 'kind' | 'reversed'>
): boolean => {
    if (m.reversed) return false;
    if (m.kind === 'storno') return false;
    return true;
};

export interface PurchaseInput {
    type: 'part' | 'toner' | 'paper' | 'lamination';
    stockId: string;
    partN?: string;
    partName?: string;
    color?: string;
    model?: string;
    costCategory: CostCategory;
    qty: number;
    unitPrice: number;
    purchasedAt?: string;
    supplier?: string;
    comment?: string;
    createdBy?: string;
    currentStockQty: number;
    /** Опционально — привязка к конкретному аппарату */
    machine?: string;
}

export interface WriteOffInput {
    type: 'part' | 'toner' | 'paper' | 'lamination';
    stockId: string;
    partN?: string;
    partName?: string;
    color?: string;
    model?: string;
    costCategory?: CostCategory;
    qty: number;
    date?: string;
    machine?: string;
    man?: string;
    currentStockQty: number;
    factoryLife?: number;
    actualLife?: number;
    economyAmount?: number;
}

const stockCollectionFor = (
    type: PurchaseInput['type'] | WriteOffInput['type']
): string => {
    if (type === 'part') return 'Parts';
    if (type === 'toner') return 'TonersStorage';
    if (type === 'paper') return 'Materials';
    return 'Laminations';
};

const stockQtyFieldFor = (
    type: PurchaseInput['type'] | WriteOffInput['type']
): 'quantity' | 'qty' => (type === 'part' ? 'quantity' : 'qty');

export interface EngineerServiceInput {
    machine: string;
    model?: string;
    totalCost: number;
    date?: string;
    man?: string;
    supplier?: string;
    comment?: string;
}

const LOTS = 'StockLots';
const MOVEMENTS = 'StockMovements';

const nowIso = () => new Date().toISOString();

const resolveCategory = (
    type: PurchaseInput['type'] | WriteOffInput['type'],
    explicit?: CostCategory
): CostCategory => {
    if (type === 'toner') return 'toner';
    if (type === 'paper') return 'paper';
    if (type === 'lamination') return 'lamination';
    if (explicit === 'spare' || explicit === 'consumable') return explicit;
    return 'consumable';
};

/** Приход на склад: партия + движение + увеличение quantity */
export const purchaseStock = async (
    input: PurchaseInput
): Promise<{ lotId: string; movementId: string }> => {
    const qty = Number(input.qty);
    const unitPrice = Number(input.unitPrice);
    if (!input.stockId || qty <= 0 || unitPrice < 0) {
        throw new Error('Некорректные данные прихода');
    }

    const costCategory = resolveCategory(input.type, input.costCategory);
    const purchasedAt = input.purchasedAt || nowIso();
    const totalCost = qty * unitPrice;
    const batch = writeBatch(db);

    const lotRef = doc(collection(db, LOTS));
    batch.set(lotRef, {
        type: input.type,
        stockId: input.stockId,
        partN: input.partN || '',
        partName: input.partName || '',
        color: input.color || '',
        model: input.model || '',
        costCategory,
        qtyInitial: qty,
        qtyLeft: qty,
        unitPrice,
        currency: 'RUB',
        purchasedAt,
        supplier: input.supplier || '',
        comment: input.comment || '',
        createdBy: input.createdBy || '',
        createdAt: nowIso(),
        machine: input.machine || '',
    });

    const movementRef = doc(collection(db, MOVEMENTS));
    batch.set(movementRef, {
        kind: 'purchase',
        type: input.type,
        stockId: input.stockId,
        partN: input.partN || '',
        partName: input.partName || '',
        color: input.color || '',
        model: input.model || '',
        costCategory,
        qty,
        totalCost,
        unitPriceAvg: unitPrice,
        date: purchasedAt,
        machine: input.machine || '',
        man: input.createdBy || '',
        lots: [
            { lotId: lotRef.id, qty, unitPrice, cost: totalCost, costCategory },
        ],
        comment: input.comment || '',
        supplier: input.supplier || '',
    });

    // increment — атомарно, не зависит от устаревшего остатка на клиенте
    const stockCollection = stockCollectionFor(input.type);
    const stockRef = doc(db, stockCollection, input.stockId);
    const qtyField = stockQtyFieldFor(input.type);
    if (input.type === 'part') {
        batch.update(stockRef, {
            quantity: increment(qty),
            costCategory,
        });
    } else {
        batch.update(stockRef, { [qtyField]: increment(qty) });
    }

    await batch.commit();
    return { lotId: lotRef.id, movementId: movementRef.id };
};

/**
 * FIFO-списание. Бросает ошибку, если партий недостаточно.
 * Выполняется в транзакции: партии и остаток перечитываются внутри,
 * параллельное списание той же позиции не может взять один остаток дважды.
 */
export const writeOffFifo = async (
    input: WriteOffInput
): Promise<{
    totalCost: number;
    unitPriceAvg: number;
    lots: FifoLotSlice[];
    movementId: string;
    costCategory: CostCategory;
    economyAmount: number;
}> => {
    const qtyNeeded = Number(input.qty);
    if (!input.stockId || qtyNeeded <= 0) {
        throw new Error('Некорректное количество списания');
    }

    // Клиентский SDK не умеет query внутри транзакции — берём id партий заранее,
    // а актуальные qtyLeft читаем уже в транзакции.
    const lotsSnapshot = await getDocs(
        query(collection(db, LOTS), where('stockId', '==', input.stockId))
    );
    const lotRefs = lotsSnapshot.docs.map((d) => doc(db, LOTS, d.id));

    const stockCollection = stockCollectionFor(input.type);
    const stockRef = doc(db, stockCollection, input.stockId);
    const qtyField = stockQtyFieldFor(input.type);
    const movementRef = doc(collection(db, MOVEMENTS));
    const date = input.date || nowIso();

    return runTransaction(db, async (tx) => {
        const lotSnaps = await Promise.all(lotRefs.map((r) => tx.get(r)));
        const stockSnap = await tx.get(stockRef);

        const openLots = lotSnaps
            .filter((snap) => snap.exists())
            .map((snap) => ({
                id: snap.id,
                ...(snap.data() as Omit<StockLot, 'id'>),
            }))
            .filter((lot) => Number(lot.qtyLeft) > 0)
            .sort(
                (a, b) =>
                    new Date(a.purchasedAt).getTime() -
                    new Date(b.purchasedAt).getTime()
            );

        const available = openLots.reduce(
            (sum, l) => sum + Number(l.qtyLeft || 0),
            0
        );
        if (available < qtyNeeded) {
            throw new Error(
                `Недостаточно партий для FIFO: нужно ${qtyNeeded}, доступно ${available}. Сначала оформите приход.`
            );
        }

        let remaining = qtyNeeded;
        const slices: FifoLotSlice[] = [];
        const categoryTotals: Partial<Record<CostCategory, number>> = {};

        for (const lot of openLots) {
            if (remaining <= 0) break;
            const take = Math.min(Number(lot.qtyLeft), remaining);
            const unitPrice = Number(lot.unitPrice);
            const lotCategory = resolveCategory(
                input.type,
                (lot.costCategory as CostCategory) || input.costCategory
            );
            const cost = take * unitPrice;
            slices.push({
                lotId: lot.id,
                qty: take,
                unitPrice,
                cost,
                costCategory: lotCategory,
            });
            categoryTotals[lotCategory] =
                (categoryTotals[lotCategory] || 0) + cost;
            tx.update(doc(db, LOTS, lot.id), {
                qtyLeft: Number(lot.qtyLeft) - take,
            });
            remaining -= take;
        }

        const totalCost = slices.reduce((sum, x) => sum + x.cost, 0);
        const unitPriceAvg = qtyNeeded > 0 ? totalCost / qtyNeeded : 0;

        // Доминирующая категория по сумме из партий
        let costCategory = resolveCategory(input.type, input.costCategory);
        const ranked = Object.entries(categoryTotals).sort(
            (a, b) => (b[1] || 0) - (a[1] || 0)
        );
        if (ranked[0]) {
            costCategory = ranked[0][0] as CostCategory;
        }

        const factoryLife = Number(input.factoryLife) || 0;
        const actualLife = Number(input.actualLife) || 0;
        const economyAmount =
            input.economyAmount !== undefined
                ? Number(input.economyAmount) || 0
                : costCategory === 'consumable'
                  ? calcLifeEconomy(totalCost, factoryLife, actualLife)
                  : 0;

        tx.set(movementRef, {
            kind: 'writeoff',
            type: input.type,
            stockId: input.stockId,
            partN: input.partN || '',
            partName: input.partName || '',
            color: input.color || '',
            model: input.model || '',
            costCategory,
            qty: qtyNeeded,
            totalCost,
            unitPriceAvg,
            date,
            machine: input.machine || '',
            man: input.man || '',
            lots: slices,
            economyAmount,
            factoryLife,
            actualLife,
        });

        if (stockSnap.exists()) {
            const cur = Number(
                (stockSnap.data() as Record<string, unknown>)[qtyField] || 0
            );
            tx.update(stockRef, { [qtyField]: Math.max(0, cur - qtyNeeded) });
        }

        return {
            totalCost,
            unitPriceAvg,
            lots: slices,
            movementId: movementRef.id,
            costCategory,
            economyAmount,
        };
    });
};

/**
 * Сторно списания / вызова инженера:
 * — возвращает qty в партии (FIFO-слайсы);
 * — возвращает остаток на карточке склада;
 * — помечает исходное движение reversed;
 * — пишет движение kind=storno для аудита.
 */
export const reverseStockMovement = async (
    movementId: string,
    opts?: { man?: string; reason?: string }
): Promise<{ stornoMovementId: string }> => {
    const id = String(movementId || '').trim();
    if (!id) {
        throw new Error('Нет movementId — складское списание не откатить');
    }

    const moveRef = doc(db, MOVEMENTS, id);
    const stornoRef = doc(collection(db, MOVEMENTS));

    // Транзакция: повторное сторно одного движения или параллельное списание
    // не испортят остатки партий.
    await runTransaction(db, async (tx) => {
        const moveSnap = await tx.get(moveRef);
        if (!moveSnap.exists()) {
            throw new Error('Движение склада не найдено');
        }

        const data = moveSnap.data() as Omit<StockMovement, 'id'>;
        if (data.reversed) {
            throw new Error('Движение уже сторнировано');
        }
        if (data.kind !== 'writeoff' && data.kind !== 'engineer') {
            throw new Error(
                'Сторно доступно только для списаний и вызовов инженера'
            );
        }

        const qty = Number(data.qty) || 0;
        const lots = Array.isArray(data.lots) ? data.lots : [];

        const slices = lots
            .map((slice) => ({
                lotId: String(slice.lotId || '').trim(),
                addQty: Number(slice.qty) || 0,
            }))
            .filter((x) => x.lotId && x.addQty > 0);
        const lotSnaps = await Promise.all(
            slices.map((x) => tx.get(doc(db, LOTS, x.lotId)))
        );

        const restoresStock =
            data.kind === 'writeoff' &&
            Boolean(data.stockId) &&
            (data.type === 'part' ||
                data.type === 'toner' ||
                data.type === 'paper' ||
                data.type === 'lamination') &&
            qty > 0;
        const stockType = data.type as WriteOffInput['type'];
        const stockRef = restoresStock
            ? doc(db, stockCollectionFor(stockType), data.stockId)
            : null;
        const stockSnap = stockRef ? await tx.get(stockRef) : null;

        const now = nowIso();

        tx.update(moveRef, {
            reversed: true,
            reversedAt: now,
            reversedBy: opts?.man || '',
            stornoMovementId: stornoRef.id,
        });

        tx.set(stornoRef, {
            kind: 'storno' as MovementKind,
            type: data.type,
            stockId: data.stockId || '',
            partN: data.partN || '',
            partName: data.partName || '',
            color: data.color || '',
            model: data.model || '',
            costCategory: data.costCategory || 'consumable',
            qty,
            totalCost: Number(data.totalCost) || 0,
            unitPriceAvg: Number(data.unitPriceAvg) || 0,
            date: now,
            machine: data.machine || '',
            man: opts?.man || '',
            lots,
            relatedId: id,
            comment: opts?.reason || 'Сторно списания',
            economyAmount: Number(data.economyAmount) || 0,
            factoryLife: Number(data.factoryLife) || 0,
            actualLife: Number(data.actualLife) || 0,
        });

        slices.forEach((x, i) => {
            const snap = lotSnaps[i];
            if (!snap.exists()) return;
            const cur = Number((snap.data() as StockLot).qtyLeft || 0);
            tx.update(snap.ref, { qtyLeft: cur + x.addQty });
        });

        if (stockRef && stockSnap?.exists()) {
            const field = stockQtyFieldFor(stockType);
            const cur = Number(
                (stockSnap.data() as Record<string, unknown>)[field] || 0
            );
            tx.update(stockRef, { [field]: cur + qty });
        }
    });

    return { stornoMovementId: stornoRef.id };
};

/** Вызов инженера — сразу расход и «закупка услуги» на аппарат */
export const recordEngineerService = async (
    input: EngineerServiceInput
): Promise<{ movementId: string }> => {
    const totalCost = Number(input.totalCost);
    if (!input.machine?.trim() || !(totalCost > 0)) {
        throw new Error('Укажите аппарат и сумму вызова');
    }

    const movementRef = doc(collection(db, MOVEMENTS));
    const batch = writeBatch(db);
    batch.set(movementRef, {
        kind: 'engineer',
        type: 'engineer',
        stockId: '',
        partN: '',
        partName: 'Вызов инженера',
        color: '',
        model: input.model || '',
        costCategory: 'engineer' as CostCategory,
        qty: 1,
        totalCost,
        unitPriceAvg: totalCost,
        date: input.date || nowIso(),
        machine: input.machine.trim(),
        man: input.man || '',
        lots: [],
        comment: input.comment || '',
        supplier: input.supplier || '',
    });
    await batch.commit();

    return { movementId: movementRef.id };
};

/** Живой список расходов на сервисного инженера (без сторнированных). */
export const subscribeEngineerMovements = (
    cb: (items: StockMovement[]) => void
) => {
    const q = query(
        collection(db, MOVEMENTS),
        where('kind', '==', 'engineer')
    );
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map((d) => mapMovementDoc(d.id, d.data() as Record<string, unknown>))
            .filter((m) => !m.reversed)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        cb(items);
    });
};

const mapMovementDoc = (
    id: string,
    data: Record<string, unknown>
): StockMovement => {
    const raw = data as Omit<StockMovement, 'id'>;
    // Firestore Timestamp → ISO-строка
    let date = raw.date as unknown;
    if (date && typeof date === 'object' && date !== null) {
        const ts = date as { toDate?: () => Date; seconds?: number };
        if (typeof ts.toDate === 'function') {
            date = ts.toDate().toISOString();
        } else if (typeof ts.seconds === 'number') {
            date = new Date(ts.seconds * 1000).toISOString();
        }
    }
    return {
        id,
        ...raw,
        date: String(date || ''),
        costCategory:
            raw.costCategory ||
            inferLegacyCategory(raw),
    };
};

export const fetchMovementsInRange = async (
    fromIso: string,
    toIso: string
): Promise<StockMovement[]> => {
    const q = query(
        collection(db, MOVEMENTS),
        where('date', '>=', fromIso),
        where('date', '<=', toIso),
        orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) =>
        mapMovementDoc(d.id, d.data() as Record<string, unknown>)
    );
};

/** Последние движения — для графика затрат (без зависимости от фильтра дат) */
export const fetchRecentMovements = async (
    maxDocs = 800
): Promise<StockMovement[]> => {
    const q = query(
        collection(db, MOVEMENTS),
        orderBy('date', 'desc'),
        limit(maxDocs)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) =>
        mapMovementDoc(d.id, d.data() as Record<string, unknown>)
    );
};

const inferLegacyCategory = (m: Partial<StockMovement>): CostCategory => {
    if (m.kind === 'engineer' || m.type === 'engineer') return 'engineer';
    if (m.type === 'toner') return 'toner';
    return 'consumable';
};

export const fetchOpenLots = async (): Promise<StockLot[]> => {
    const q = query(collection(db, LOTS), where('qtyLeft', '>', 0));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
        const data = d.data() as Omit<StockLot, 'id'>;
        return {
            id: d.id,
            ...data,
            costCategory:
                data.costCategory ||
                (data.type === 'toner' ? 'toner' : 'consumable'),
        };
    });
};

export const stockValueFromLots = (lots: StockLot[]): number =>
    lots.reduce(
        (sum, lot) =>
            sum + Number(lot.qtyLeft || 0) * Number(lot.unitPrice || 0),
        0
    );

/**
 * Последняя цена закупки по stockId (FIFO-партии и движения purchase).
 * Если позиция никогда не приходовалась — цены нет (0).
 */
export const fetchLastPartPurchasePrices = async (
    stockIds?: string[]
): Promise<Map<string, number>> => {
    const wanted =
        stockIds && stockIds.length > 0
            ? new Set(stockIds.map((id) => String(id)))
            : null;

    const best = new Map<string, { at: number; price: number }>();

    const consider = (
        stockId: string,
        purchasedAt: unknown,
        unitPrice: number
    ) => {
        const id = String(stockId || '').trim();
        if (!id || (wanted && !wanted.has(id))) return;
        if (!(unitPrice >= 0) || Number.isNaN(unitPrice)) return;
        let at = 0;
        if (typeof purchasedAt === 'string' || typeof purchasedAt === 'number') {
            at = new Date(purchasedAt).getTime();
        } else if (purchasedAt && typeof purchasedAt === 'object') {
            const ts = purchasedAt as {
                toDate?: () => Date;
                seconds?: number;
            };
            if (typeof ts.toDate === 'function') {
                at = ts.toDate().getTime();
            } else if (typeof ts.seconds === 'number') {
                at = ts.seconds * 1000;
            }
        }
        if (!Number.isFinite(at)) at = 0;
        const cur = best.get(id);
        if (!cur || at >= cur.at) {
            best.set(id, { at, price: unitPrice });
        }
    };

    const [lotsSnap, movesSnap] = await Promise.all([
        getDocs(collection(db, LOTS)),
        getDocs(
            query(collection(db, MOVEMENTS), where('kind', '==', 'purchase'))
        ),
    ]);

    lotsSnap.docs.forEach((d) => {
        const lot = d.data() as StockLot;
        if (lot.type && lot.type !== 'part') return;
        consider(
            lot.stockId,
            lot.purchasedAt,
            Number(lot.unitPrice) || 0
        );
    });

    movesSnap.docs.forEach((d) => {
        const m = d.data() as StockMovement;
        if (m.type && m.type !== 'part') return;
        consider(
            m.stockId,
            m.date,
            Number(m.unitPriceAvg) || 0
        );
    });

    const result = new Map<string, number>();
    best.forEach((v, id) => result.set(id, v.price));
    return result;
};

export const fetchKnownSuppliers = async (): Promise<string[]> => {
    const [lotsSnap, movesSnap] = await Promise.all([
        getDocs(collection(db, LOTS)),
        getDocs(collection(db, MOVEMENTS)),
    ]);
    const set = new Set<string>();
    lotsSnap.docs.forEach((d) => {
        const name = String((d.data() as StockLot).supplier || '').trim();
        if (name) set.add(name);
    });
    movesSnap.docs.forEach((d) => {
        const name = String(
            (d.data() as StockMovement).supplier || ''
        ).trim();
        if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) =>
        a.localeCompare(b, 'ru', { sensitivity: 'base' })
    );
};

/** Сохранить категорию на карточке детали (для следующих приходов) */
export const persistPartCostCategory = async (
    stockId: string,
    costCategory: CostCategory
) => {
    await updateDoc(doc(db, 'Parts', stockId), { costCategory });
};

export { inferPartCostCategory };
