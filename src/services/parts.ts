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

export interface Part {
    partN: string;
    section: string;
    partName: string;
    quantity: number;
    partLife: string | number;
    model?: string;
    /** Сколько штук стоит в аппарате (из Excel Qty), не склад */
    installedQty?: number;
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

    const matchExisting = (partN: string, partName: string) =>
        existing.find((item) => {
            const p = item.part;
            // partN + имя: у разных цветов часто один партномер
            if (p.partN?.toUpperCase() !== partN.toUpperCase()) return false;
            if ((p.partName || '').trim() !== partName.trim()) return false;
            if ((p.model || '') !== printerModel) return false;
            if (source === 'option') {
                return (p.optionModel || '') === (optionModel || '');
            }
            return !p.optionModel;
        });

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

    for (const row of rows) {
        const found = matchExisting(row.partN, row.partName);

        if (found) {
            const ref = doc(db, 'Parts', found.id);
            batch.update(ref, {
                partName: row.partName,
                section: row.section,
                partLife: row.partLife,
                installedQty: row.installedQty,
                model: printerModel,
                source,
                optionModel: optionModel ? optionModel : deleteField(),
            });
            // обновим локальный кэш, чтобы дубли в Excel не создавали новые
            found.part = {
                ...found.part,
                partName: row.partName,
                section: row.section,
                partLife: row.partLife,
                installedQty: row.installedQty,
                model: printerModel,
                source,
                ...(optionModel ? { optionModel } : { optionModel: undefined }),
            };
            updated += 1;
        } else {
            const ref = doc(collection(db, 'Parts'));
            const payload: Part = {
                partN: row.partN,
                partName: row.partName,
                section: row.section,
                partLife: row.partLife,
                installedQty: row.installedQty,
                quantity: 0,
                model: printerModel,
                source,
                ...(optionModel ? { optionModel } : {}),
            };
            batch.set(ref, payload);
            existing.push({ id: ref.id, part: payload });
            created += 1;
        }

        opsInBatch += 1;
        if (opsInBatch >= 400) {
            await commitBatch();
        }
    }

    await commitBatch();
    return { created, updated };
};
