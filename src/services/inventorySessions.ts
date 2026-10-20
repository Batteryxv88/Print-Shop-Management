import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type InventorySessionLine = {
    id: string;
    partN: string;
    partName: string;
    expectedQty: number;
    actualQty: number;
    units: string;
};

export type InventorySessionDoc = {
    model: string;
    createdBy: string;
    createdByName: string;
    status: 'draft' | 'completed';
    lines: InventorySessionLine[];
    logMessages: string[];
    updatedAt: string;
    completedAt?: string;
};

const COLLECTION = 'InventorySessions';

export const inventorySessionId = (
    userId: string,
    kind: string,
    scopeKey: string
) =>
    `${userId}_${kind}_${scopeKey.replace(/[^\w-]/g, '_')}`;

export const loadInventorySession = async (
    sessionId: string
): Promise<InventorySessionDoc | null> => {
    const snap = await getDoc(doc(db, COLLECTION, sessionId));
    if (!snap.exists()) return null;
    return snap.data() as InventorySessionDoc;
};

export const saveInventoryDraft = async (
    sessionId: string,
    data: Omit<InventorySessionDoc, 'status' | 'updatedAt'> & {
        status?: 'draft';
    }
): Promise<void> => {
    await setDoc(
        doc(db, COLLECTION, sessionId),
        {
            ...data,
            status: 'draft',
            updatedAt: new Date().toISOString(),
        },
        { merge: true }
    );
};

export const markInventoryCompleted = async (
    sessionId: string,
    patch: Partial<InventorySessionDoc>
): Promise<void> => {
    await setDoc(
        doc(db, COLLECTION, sessionId),
        {
            ...patch,
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        { merge: true }
    );
};
