import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Lamination {
    id: string;
    name: string;
    type: string;
    subtype: string;
    thickness: string;
    note: string;
    qty: number;
    status: 'new' | 'defective' | string;
    /** legacy */
    title?: string;
    sub_type?: string;
}

export type LaminationInput = {
    name: string;
    type: string;
    subtype?: string;
    thickness?: string;
    note?: string;
    qty?: number;
    status?: string;
};

const COLLECTION = 'Laminations';

const mapDoc = (id: string, data: Record<string, unknown>): Lamination => {
    const type = String(data.type || '');
    const name = String(data.name || data.title || type || id);
    return {
        id,
        name,
        type,
        subtype: String(data.subtype || data.sub_type || ''),
        thickness: String(data.thickness || ''),
        note: String(data.note || data.comment || ''),
        qty: Number(data.qty) || 0,
        status: String(data.status || 'new'),
        title: String(data.title || name),
        sub_type: String(data.sub_type || data.subtype || ''),
    };
};

export const subscribeToLaminations = (
    callback: (laminations: Lamination[]) => void
) => {
    const col = collection(db, COLLECTION);
    return onSnapshot(col, (snapshot) => {
        callback(
            snapshot.docs.map((d) =>
                mapDoc(d.id, d.data() as Record<string, unknown>)
            )
        );
    });
};

/** @deprecated alias */
export const subscribeToMaterials = subscribeToLaminations;

export const updateLaminationQty = async (
    id: string,
    qty: number
): Promise<void> => {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, { qty });
};

export const createLamination = async (
    input: LaminationInput
): Promise<{ id: string; lamination: Lamination }> => {
    const payload = {
        name: String(input.name || '').trim(),
        title: String(input.name || '').trim(),
        type: String(input.type || '').trim(),
        subtype: String(input.subtype || '').trim(),
        sub_type: String(input.subtype || '').trim(),
        thickness: String(input.thickness || '').trim(),
        note: String(input.note || '').trim(),
        qty: Number(input.qty) || 0,
        status: input.status || 'new',
    };
    if (!payload.name) throw new Error('Укажите название ламинации');
    const ref = await addDoc(collection(db, COLLECTION), payload);
    return { id: ref.id, lamination: mapDoc(ref.id, payload) };
};
