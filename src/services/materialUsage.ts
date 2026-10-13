import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
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

export const subscribeMaterialUsages = (
    callback: (items: MaterialUsage[]) => void
) => {
    return onSnapshot(collection(db, COLLECTION), (snap) => {
        const items = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MaterialUsage, 'id'>),
        }));
        items.sort(
            (a, b) =>
                new Date(b.date || 0).getTime() -
                new Date(a.date || 0).getTime()
        );
        callback(items);
    });
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
