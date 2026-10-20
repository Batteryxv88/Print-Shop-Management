import {
    collection,
    doc,
    getDoc,
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

/** production — обычная замена/расход; scrap — брак, не в «Потрачено» принтера */
export type WriteoffReason = 'production' | 'scrap';

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
    writeoffReason?: WriteoffReason;
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

export const isScrapMovement = (
    m: Pick<StockMovement, 'kind' | 'writeoffReason'>
): boolean =>
    m.kind === 'writeoff' && m.writeoffReason === 'scrap';

/** Списание, которое идёт в себестоимость / «Потрачено» принтера */
export const isProductionWriteoff = (
    m: Pick<StockMovement, 'kind' | 'writeoffReason'>
): boolean => m.kind === 'writeoff' && !isScrapMovement(m);

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
    writeoffReason?: WriteoffReason;
    comment?: string;
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

let knownSuppliersCache: { at: number; list: string[] } | null = null;
const SUPPLIERS_CACHE_MS = 10 * 60 * 1000;

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
    knownSuppliersCache = null;
    invalidateStockLotsCache(input.stockId);
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

    const result = await runTransaction(db, async (tx) => {
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

        const writeoffReason: WriteoffReason =
            input.writeoffReason === 'scrap' ? 'scrap' : 'production';
        const isScrap = writeoffReason === 'scrap';
        const factoryLife = isScrap ? 0 : Number(input.factoryLife) || 0;
        const actualLife = isScrap ? 0 : Number(input.actualLife) || 0;
        const economyAmount = isScrap
            ? 0
            : input.economyAmount !== undefined
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
            writeoffReason,
            comment: input.comment?.trim() || '',
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
    invalidateStockLotsCache(input.stockId);
    return result;
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
    let affectedStockId = '';

    // Транзакция: повторное сторно одного движения или параллельное списание
    // не испортят остатки партий.
    await runTransaction(db, async (tx) => {
        const moveSnap = await tx.get(moveRef);
        if (!moveSnap.exists()) {
            throw new Error('Движение склада не найдено');
        }

        const data = moveSnap.data() as Omit<StockMovement, 'id'>;
        if (data.stockId) {
            affectedStockId = data.stockId;
        }
        if (data.reversed) {
            throw new Error('Движение уже сторнировано');
        }
        if (
            data.kind !== 'writeoff' &&
            data.kind !== 'engineer'
        ) {
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

    if (affectedStockId) {
        invalidateStockLotsCache(affectedStockId);
    }

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

/** Живой список списаний брака */
export const subscribeScrapMovements = (
    cb: (items: StockMovement[]) => void
) => {
    const q = query(
        collection(db, MOVEMENTS),
        where('writeoffReason', '==', 'scrap')
    );
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map((d) => mapMovementDoc(d.id, d.data() as Record<string, unknown>))
            .filter((m) => m.kind === 'writeoff' && !m.reversed)
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

/** Начало периода для помесячных графиков затрат (~13 мес. + запас) */
export const costChartFromIso = (toDateStr: string): string => {
    const end = new Date(`${toDateStr}T12:00:00`);
    if (Number.isNaN(end.getTime())) {
        const d = new Date();
        d.setMonth(d.getMonth() - 14);
        return d.toISOString();
    }
    const start = new Date(end);
    start.setMonth(start.getMonth() - 14);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
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

const mapLotDoc = (id: string, data: Omit<StockLot, 'id'>): StockLot => ({
    id,
    ...data,
    costCategory:
        data.costCategory ||
        (data.type === 'toner' ? 'toner' : 'consumable'),
});

export const fetchOpenLots = async (): Promise<StockLot[]> => {
    const q = query(collection(db, LOTS), where('qtyLeft', '>', 0));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) =>
        mapLotDoc(d.id, d.data() as Omit<StockLot, 'id'>)
    );
};

/** Партии одной позиции склада (FIFO: старые первые) */
export const fetchLotsByStockId = async (
    stockId: string,
    openOnly = false
): Promise<StockLot[]> => {
    const q = query(collection(db, LOTS), where('stockId', '==', stockId));
    const snapshot = await getDocs(q);
    let lots = snapshot.docs.map((d) =>
        mapLotDoc(d.id, d.data() as Omit<StockLot, 'id'>)
    );
    if (openOnly) {
        lots = lots.filter((l) => Number(l.qtyLeft) > 0);
    }
    lots.sort(
        (a, b) =>
            new Date(a.purchasedAt).getTime() -
            new Date(b.purchasedAt).getTime()
    );
    return lots;
};

export type PriceDriftPoint = {
    lotId: string;
    purchasedAt: string;
    unitPrice: number;
    qtyInitial: number;
    qtyLeft: number;
    supplier?: string;
};

const mapLotToPriceDriftPoint = (
    lot: StockLot
): PriceDriftPoint => ({
    lotId: lot.id,
    purchasedAt: lot.purchasedAt,
    unitPrice: Number(lot.unitPrice) || 0,
    qtyInitial: Number(lot.qtyInitial) || 0,
    qtyLeft: Number(lot.qtyLeft) || 0,
    supplier: lot.supplier,
});

const driftAllCache = new Map<string, Promise<PriceDriftPoint[]>>();

const openLotsCache = new Map<string, StockLot[]>();

/** Сброс кэша открытых партий и дрейфа цены (после прихода / списания / сторно) */
export const invalidateStockLotsCache = (stockId?: string) => {
    if (stockId) {
        openLotsCache.delete(stockId);
        driftAllCache.delete(stockId);
    } else {
        openLotsCache.clear();
        driftAllCache.clear();
    }
};

export type LoadOpenLotsCallbacks = {
    onData: (lots: StockLot[], meta: { fromCache: boolean }) => void;
    onError: (message: string) => void;
};

/** Stale-while-revalidate: сразу отдаёт кэш, затем обновляет с сервера */
export const loadOpenLotsForStock = (
    stockId: string,
    callbacks: LoadOpenLotsCallbacks
): (() => void) => {
    let cancelled = false;
    const cached = openLotsCache.get(stockId);
    if (cached) {
        callbacks.onData(cached, { fromCache: true });
    }

    fetchLotsByStockId(stockId, true)
        .then((lots) => {
            if (cancelled) return;
            openLotsCache.set(stockId, lots);
            callbacks.onData(lots, { fromCache: false });
        })
        .catch((err) => {
            if (cancelled) return;
            if (!cached) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Не удалось загрузить партии';
                callbacks.onError(message);
            }
        });

    return () => {
        cancelled = true;
    };
};

/** Все приходы позиции (тот же запрос, что и вкладка «Партии» — без составного индекса) */
export const fetchPriceDriftAllForStock = async (
    stockId: string
): Promise<PriceDriftPoint[]> => {
    let pending = driftAllCache.get(stockId);
    if (!pending) {
        pending = fetchLotsByStockId(stockId, false).then((lots) =>
            lots.map((lot) => mapLotToPriceDriftPoint(lot))
        );
        driftAllCache.set(stockId, pending);
    }
    return pending;
};

/** Последние N приходов (хронологически: старые → новые) */
export const fetchPriceDriftRecent = async (
    stockId: string,
    count = 10
): Promise<PriceDriftPoint[]> => {
    const all = await fetchPriceDriftAllForStock(stockId);
    return all.slice(-count);
};

export type PriceDriftPageResult = {
    points: PriceDriftPoint[];
    hasMore: boolean;
    nextOffset: number;
};

/** Страница истории (FIFO): один запрос к Firestore, дальше — срезы в памяти */
export const fetchPriceDriftPage = async (
    stockId: string,
    pageSize: number,
    offset = 0
): Promise<PriceDriftPageResult> => {
    const all = await fetchPriceDriftAllForStock(stockId);
    const points = all.slice(offset, offset + pageSize);
    const nextOffset = offset + points.length;
    return {
        points,
        hasMore: nextOffset < all.length,
        nextOffset,
    };
};

export type EnrichedFifoSlice = FifoLotSlice & {
    purchasedAt?: string;
    supplier?: string;
};

export const enrichFifoSlices = async (
    slices: FifoLotSlice[]
): Promise<EnrichedFifoSlice[]> => {
    const uniqueIds = Array.from(new Set(slices.map((s) => s.lotId)));
    const meta = new Map<string, { purchasedAt?: string; supplier?: string }>();
    await Promise.all(
        uniqueIds.map(async (lotId) => {
            const snap = await getDoc(doc(db, LOTS, lotId));
            if (!snap.exists()) return;
            const data = snap.data() as StockLot;
            meta.set(lotId, {
                purchasedAt: data.purchasedAt,
                supplier: data.supplier,
            });
        })
    );
    return slices.map((s) => ({
        ...s,
        ...meta.get(s.lotId),
    }));
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

const isFirestoreIndexError = (err: unknown): boolean =>
    err instanceof Error && /requires an index/i.test(err.message);

const collectSupplierNames = (set: Set<string>, raw: unknown) => {
    const name = String(raw || '').trim();
    if (name) set.add(name);
};

/** Поставщик с последнего прихода по позиции склада */
export const fetchLastSupplierForStock = async (
    stockId: string
): Promise<string> => {
    const id = String(stockId || '').trim();
    if (!id) return '';
    const lots = await fetchLotsByStockId(id, false);
    for (let i = lots.length - 1; i >= 0; i--) {
        const name = String(lots[i].supplier || '').trim();
        if (name) return name;
    }
    return '';
};

export const fetchKnownSuppliers = async (): Promise<string[]> => {
    const now = Date.now();
    if (
        knownSuppliersCache &&
        now - knownSuppliersCache.at < SUPPLIERS_CACHE_MS
    ) {
        return knownSuppliersCache.list;
    }

    const set = new Set<string>();

    try {
        const openLots = await fetchOpenLots();
        openLots.forEach((lot) => collectSupplierNames(set, lot.supplier));
    } catch {
        /* ignore */
    }

    try {
        let moves: Array<{ date: string; supplier?: string }> = [];
        try {
            const snap = await getDocs(
                query(
                    collection(db, MOVEMENTS),
                    where('kind', '==', 'purchase'),
                    orderBy('date', 'desc'),
                    limit(400)
                )
            );
            moves = snap.docs.map((d) => d.data() as StockMovement);
        } catch (err) {
            if (!isFirestoreIndexError(err)) throw err;
            const snap = await getDocs(
                query(
                    collection(db, MOVEMENTS),
                    where('kind', '==', 'purchase')
                )
            );
            moves = snap.docs
                .map((d) => d.data() as StockMovement)
                .sort(
                    (a, b) =>
                        new Date(b.date || 0).getTime() -
                        new Date(a.date || 0).getTime()
                )
                .slice(0, 400);
        }
        moves.forEach((m) => collectSupplierNames(set, m.supplier));
    } catch {
        /* список подсказок может остаться только из открытых партий */
    }

    const list = Array.from(set).sort((a, b) =>
        a.localeCompare(b, 'ru', { sensitivity: 'base' })
    );
    knownSuppliersCache = { at: now, list };
    return list;
};

/** Сохранить категорию на карточке детали (для следующих приходов) */
export const persistPartCostCategory = async (
    stockId: string,
    costCategory: CostCategory
) => {
    await updateDoc(doc(db, 'Parts', stockId), { costCategory });
};

export { inferPartCostCategory };

export type StockInventoryItemType = 'part' | 'toner' | 'paper' | 'lamination';

export interface StockInventoryLine {
    type: StockInventoryItemType;
    stockId: string;
    partN: string;
    partName: string;
    model?: string;
    color?: string;
    costCategory?: CostCategory;
    partLife?: string | number;
    expectedQty: number;
    actualQty: number;
}

/** @deprecated use StockInventoryLine */
export type PartInventoryLine = StockInventoryLine;

const avgOpenLotPrice = async (stockId: string): Promise<number> => {
    const lots = await fetchLotsByStockId(stockId, true);
    if (!lots.length) return 0;
    let sum = 0;
    let qty = 0;
    for (const lot of lots) {
        sum += lot.qtyLeft * lot.unitPrice;
        qty += lot.qtyLeft;
    }
    return qty > 0 ? sum / qty : 0;
};

const resolveInventoryCostCategory = (
    line: StockInventoryLine,
    data?: Record<string, unknown>
): CostCategory => {
    if (line.type === 'toner') return 'toner';
    if (line.type === 'paper') return 'paper';
    if (line.type === 'lamination') return 'lamination';
    if (line.costCategory) return line.costCategory;
    return inferPartCostCategory({
        costCategory: data?.costCategory as string | undefined,
        partLife:
            line.partLife ?? (data?.partLife as string | number | undefined),
    });
};

/** Прямая установка остатка (если FIFO не покрывает недостачу по партиям). */
export const inventorySetStockQuantity = async (
    line: StockInventoryLine,
    ctx: { createdBy: string }
): Promise<void> => {
    const stockCollection = stockCollectionFor(line.type);
    const stockRef = doc(db, stockCollection, line.stockId);
    const qtyField = stockQtyFieldFor(line.type);
    const movementRef = doc(collection(db, MOVEMENTS));
    const date = nowIso();

    await runTransaction(db, async (tx) => {
        const stockSnap = await tx.get(stockRef);
        if (!stockSnap.exists()) {
            throw new Error(`Позиция ${line.partN} не найдена`);
        }
        const data = stockSnap.data() as Record<string, unknown>;
        const current = Number(data[qtyField] || 0);
        const target = Number(line.actualQty);
        const delta = target - current;
        if (delta === 0) return;

        const costCategory = resolveInventoryCostCategory(line, data);

        tx.update(stockRef, { [qtyField]: target });
        tx.set(movementRef, {
            kind: 'adjustment',
            type: line.type,
            stockId: line.stockId,
            partN: line.partN,
            partName: line.partName,
            color: line.color || '',
            model: line.model || String(data.model || ''),
            costCategory,
            qty: Math.abs(delta),
            totalCost: 0,
            unitPriceAvg: 0,
            date,
            machine: '',
            man: ctx.createdBy,
            lots: [],
            comment: `Инвентаризация: было ${current}, стало ${target}`,
        });
    });
    invalidateStockLotsCache(line.stockId);
};

/** @deprecated */
export const inventorySetPartQuantity = inventorySetStockQuantity;

/** Одна строка инвентаризации: излишек через приход, недостача через FIFO или adjustment. */
export const applyStockInventoryLine = async (
    line: StockInventoryLine,
    ctx: { createdBy: string; model?: string }
): Promise<'applied' | 'unchanged'> => {
    const delta = line.actualQty - line.expectedQty;
    if (delta === 0) return 'unchanged';

    const costCategory = resolveInventoryCostCategory(line);

    if (delta > 0) {
        const unitPrice = await avgOpenLotPrice(line.stockId);
        await purchaseStock({
            type: line.type,
            stockId: line.stockId,
            partN: line.partN,
            partName: line.partName,
            color: line.color || '',
            model: line.model || ctx.model || '',
            costCategory,
            qty: delta,
            unitPrice,
            supplier: 'инвентаризация',
            comment: 'Излишек по результатам инвентаризации',
            createdBy: ctx.createdBy,
            currentStockQty: line.expectedQty,
        });
        return 'applied';
    }

    const qty = Math.abs(delta);
    try {
        await writeOffFifo({
            type: line.type,
            stockId: line.stockId,
            partN: line.partN,
            partName: line.partName,
            color: line.color || '',
            model: line.model || ctx.model || '',
            costCategory,
            qty,
            currentStockQty: line.expectedQty,
            man: ctx.createdBy,
            comment: 'Недостача по результатам инвентаризации',
        });
    } catch {
        await inventorySetStockQuantity(line, ctx);
    }
    return 'applied';
};

/** @deprecated */
export const applyPartInventoryLine = applyStockInventoryLine;

export const applyStockInventoryLines = async (
    lines: StockInventoryLine[],
    ctx: { createdBy: string; model?: string }
): Promise<{ applied: number; unchanged: number; errors: string[] }> => {
    let applied = 0;
    let unchanged = 0;
    const errors: string[] = [];

    for (const line of lines) {
        try {
            const result = await applyStockInventoryLine(line, ctx);
            if (result === 'applied') applied += 1;
            else unchanged += 1;
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : 'Ошибка проведения';
            errors.push(`${line.partN}: ${msg}`);
        }
    }

    return { applied, unchanged, errors };
};

/** @deprecated */
export const applyPartInventoryLines = applyStockInventoryLines;
