import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export type PaperForm = 'sheet' | 'roll';

export interface Material {
    id: string;
    /** Отображаемое название */
    name: string;
    /** Код/ключ (legacy: FA, PH…) — для совместимости */
    type: string;
    form: PaperForm;
    materialType?: string;
    subtype?: string;
    thickness?: string;
    note?: string;
    /** Рулон */
    adhesive?: string;
    metersPerRoll?: number;
    /** Лист */
    density?: string;
    format?: string;
    color?: string;
    coating?: string;
    qty: number;
    status: 'new' | 'defective';
}

export type MaterialInput = Omit<Material, 'id' | 'qty'> & { qty?: number };

const COLLECTION = 'Materials';

const mapDoc = (id: string, data: Record<string, unknown>): Material => {
    const type = String(data.type || data.name || id);
    const name = String(data.name || data.title || type);
    const form: PaperForm =
        data.form === 'sheet' || data.form === 'roll'
            ? data.form
            : 'roll';
    return {
        id,
        name,
        type,
        form,
        materialType: String(data.materialType || data.kind || '') || undefined,
        subtype: String(data.subtype || data.sub_type || '') || undefined,
        thickness: String(data.thickness || '') || undefined,
        note: String(data.note || data.comment || '') || undefined,
        adhesive: String(data.adhesive || '') || undefined,
        metersPerRoll:
            data.metersPerRoll !== undefined
                ? Number(data.metersPerRoll) || 0
                : undefined,
        density: String(data.density || '') || undefined,
        format: String(data.format || '') || undefined,
        color: String(data.color || '') || undefined,
        coating: String(data.coating || '') || undefined,
        qty: Number(data.qty) || 0,
        status: data.status === 'defective' ? 'defective' : 'new',
    };
};

export const subscribeToMaterials = (
    callback: (materials: Material[]) => void
) => {
    const materialsCollection = collection(db, COLLECTION);
    return onSnapshot(materialsCollection, (snapshot) => {
        const materials = snapshot.docs.map((d) =>
            mapDoc(d.id, d.data() as Record<string, unknown>)
        );
        callback(materials);
    });
};

export const updateMaterialQty = async (
    id: string,
    qty: number
): Promise<void> => {
    const materialRef = doc(db, COLLECTION, id);
    await updateDoc(materialRef, { qty });
};

/** @deprecated — use subscribeToLaminations from laminations.ts */
export { subscribeToLaminations as subscribeLaminations } from './laminations';
export { updateLaminationQty } from './laminations';

export const createMaterial = async (
    input: MaterialInput
): Promise<{ id: string; material: Material }> => {
    const typeKey =
        String(input.type || input.name || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_') || `MAT_${Date.now()}`;

    const payload = {
        name: String(input.name || typeKey).trim(),
        type: typeKey,
        form: input.form || 'roll',
        materialType: input.materialType || '',
        subtype: input.subtype || '',
        thickness: input.thickness || '',
        note: input.note || '',
        adhesive: input.adhesive || '',
        metersPerRoll: Number(input.metersPerRoll) || 0,
        density: input.density || '',
        format: input.format || '',
        color: input.color || '',
        coating: input.coating || '',
        qty: Number(input.qty) || 0,
        status: input.status || 'new',
    };

    const ref = await addDoc(collection(db, COLLECTION), payload);
    return {
        id: ref.id,
        material: mapDoc(ref.id, payload),
    };
};
