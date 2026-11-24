import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    where,
    type DocumentData,
    type QuerySnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { reverseStockMovement } from './stockAccounting';

export type MaterialUsageKind = 'paper' | 'lamination';

export type MaterialUsage = {
    id: string;
    kind: MaterialUsageKind;
    stockId: string;
    name: string;
    qty: number;
    date: string;
    man: string;
    note?: string;
    movementId?: string;
    totalCost?: number;
    unitPriceAvg?: number;
};

export type MaterialUsageInput = Omit<MaterialUsage, 'id'>;

const COLLECTION = 'MaterialUsages';

const publishMaterialUsages = (
    snap: QuerySnapshot<DocumentData>,
    callback: (items: MaterialUsage[]) => void,
    filterKind?: MaterialUsageKind
) => {
    let items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MaterialUsage, 'id'>),
    }));
    if (filterKind) {
        items = items.filter((item) => item.kind === filterKind);
    }
    items.sort(
        (a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
    callback(items);
};

/**
 * Слушатель журнала расхода. С kind читается только эта вкладка, без лимита.
 * Если запрос по полю недоступен, слушатель всей коллекции сохраняет тот же список.
 */
export const subscribeMaterialUsages = (
    callback: (items: MaterialUsage[]) => void,
    kind?: MaterialUsageKind
) => {
    let activeUnsub = () => undefined as void;
    let stopped = false;

    const listenAll = (filterKind?: MaterialUsageKind) => {
        activeUnsub = onSnapshot(collection(db, COLLECTION), (snap) => {
            publishMaterialUsages(snap, callback, filterKind);
        });
    };

    if (!kind) {
        listenAll();
    } else {
        const byKind = query(
            collection(db, COLLECTION),
            where('kind', '==', kind)
        );
        activeUnsub = onSnapshot(
            byKind,
            (snap) => publishMaterialUsages(snap, callback),
            (err) => {
                console.warn(
                    '[materialUsage] kind query failed; falling back to full collection',
                    err
                );
                if (stopped) return;
                activeUnsub();
                listenAll(kind);
            }
        );
    }

    return () => {
        stopped = true;
        activeUnsub();
    };
};

export const addMaterialUsage = async (
    input: MaterialUsageInput
): Promise<MaterialUsage> => {
    const ref = await addDoc(collection(db, COLLECTION), input);
    return { id: ref.id, ...input };
};

export const deleteMaterialUsage = async (id: string): Promise<void> => {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Запись не найдена');
    const data = snap.data() as MaterialUsageInput;
    const movementId = String(data.movementId || '').trim();
    if (movementId) {
        try {
            await reverseStockMovement(movementId, {
                man: data.man || '',
                reason:
                    data.kind === 'paper'
                        ? 'Отмена списания бумаги'
                        : 'Отмена списания ламинации',
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/уже сторнировано|не найдено/i.test(msg)) throw err;
        }
    }
    await deleteDoc(ref);
};
