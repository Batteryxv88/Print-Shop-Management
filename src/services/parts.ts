import {
    collection,
    onSnapshot,
    getDocs,
    doc,
    writeBatch,
    deleteField,
    query,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import { ResourcePartRow } from '../shared/lib/printers/parsePartsExcel';
import { collapseResourceRows } from '../shared/lib/printers/collapsePartNames';
import { retargetPartFifo } from './stockAccounting';

export interface Part {
    partN: string;
    section: string;
    partName: string;
    quantity: number;
    partLife: string | number;
    model?: string;
    /** Сколько штук стоит в аппарате (из Excel Qty), не склад */
    installedQty?: number;
    /** Имена из ведомости для одного артикула. В журнал пишется выбранное. */
    names?: string[];
    source?: 'body' | 'option' | 'manual';
    optionModel?: string;
}

export interface PartData {
    id: string;
    part: Part;
}

export const PartService = (callback: (parts: PartData[]) => void) => {
    const partsCollection = collection(db, 'Parts');
    return onSnapshot(partsCollection, (snapshot) => {
        const parts = snapshot.docs.map((d) => ({
            id: d.id,
            part: d.data(),
        })) as PartData[];
        callback(parts);
    });
};

export interface ImportPartsOptions {
    printerModel: string;
    source: 'body' | 'option';
    optionModel?: string;
}

/**
 * Импортирует ресурсный каталог из Excel в коллекцию Parts.
 * Файл не сохраняется — только распарсенные поля.
 * Складское quantity у существующих деталей не затирается.
 */
export const importResourceParts = async (
    rows: ResourcePartRow[],
    options: ImportPartsOptions
): Promise<{ created: number; updated: number }> => {
    const { printerModel, source, optionModel } = options;
    // Читаем только детали этой модели, а не весь склад
    const snapshot = await getDocs(
        query(collection(db, 'Parts'), where('model', '==', printerModel))
    );
    const existing = snapshot.docs.map((d) => ({
        id: d.id,
        part: d.data() as Part,
    }));

    const sameArticle = (part: Part, partN: string) => {
        if ((part.partN || '').toUpperCase() !== partN) return false;
        if ((part.model || '') !== printerModel) return false;
        if (source === 'option') {
            return (part.optionModel || '') === (optionModel || '');
        }
        return !part.optionModel;
    };

    let created = 0;
    let updated = 0;
    let batch = writeBatch(db);
    let opsInBatch = 0;

    const commitBatch = async () => {
        if (opsInBatch === 0) return;
        await batch.commit();
        batch = writeBatch(db);
        opsInBatch = 0;
    };

    const queue = (op: () => void) => {
        op();
        opsInBatch += 1;
    };

    for (const group of collapseResourceRows(rows)) {
        const matches = existing.filter((item) =>
            sameArticle(item.part, group.partN)
        );

        if (matches.length === 0) {
            const ref = doc(collection(db, 'Parts'));
            const payload: Part = {
                partN: group.partN,
                partName: group.partName,
                names: group.names,
                section: group.section,
                partLife: group.partLife,
                installedQty: group.installedQty,
                quantity: 0,
                model: printerModel,
                source,
                ...(optionModel ? { optionModel } : {}),
            };
            queue(() => batch.set(ref, payload));
            existing.push({ id: ref.id, part: payload });
            created += 1;
        } else {
            const keeper = [...matches].sort(
                (a, b) =>
                    (Number(b.part.quantity) || 0) -
                    (Number(a.part.quantity) || 0)
            )[0];
            const extras = matches.filter((item) => item.id !== keeper.id);
            const extraQty = extras.reduce(
                (sum, item) => sum + (Number(item.part.quantity) || 0),
                0
            );
            const extraOrder = extras.reduce(
                (sum, item) =>
                    sum +
                    (Number(
                        (item.part as Part & { orderQty?: number }).orderQty
                    ) || 0),
                0
            );
            const keeperOrder =
                Number(
                    (keeper.part as Part & { orderQty?: number }).orderQty
                ) || 0;

            for (const extra of extras) {
                await retargetPartFifo(extra.id, keeper.id);
            }

            queue(() =>
                batch.update(doc(db, 'Parts', keeper.id), {
                    partN: group.partN,
                    partName: group.partName,
                    names: group.names,
                    section: group.section,
                    partLife: group.partLife,
                    installedQty: group.installedQty,
                    quantity: (Number(keeper.part.quantity) || 0) + extraQty,
                    ...(extraOrder > 0
                        ? { orderQty: keeperOrder + extraOrder }
                        : {}),
                    model: printerModel,
                    source,
                    optionModel: optionModel ? optionModel : deleteField(),
                })
            );
            for (const extra of extras) {
                queue(() => batch.delete(doc(db, 'Parts', extra.id)));
                const idx = existing.findIndex((item) => item.id === extra.id);
                if (idx >= 0) existing.splice(idx, 1);
            }
            keeper.part = {
                ...keeper.part,
                partName: group.partName,
                names: group.names,
                section: group.section,
                partLife: group.partLife,
                installedQty: group.installedQty,
                quantity: (Number(keeper.part.quantity) || 0) + extraQty,
            };
            updated += 1;
        }

        if (opsInBatch >= 400) await commitBatch();
    }

    await commitBatch();
    return { created, updated };
};
