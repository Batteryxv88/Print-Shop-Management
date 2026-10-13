import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface Toner {
    id: string;
    toner: {
        color: string;
        qty: number;
        model?: string;
    }
}

export const TonerService = (callback: (toners: Toner[]) => void) => {
    const tonersCollection = collection(db, 'TonersStorage');
    return onSnapshot(tonersCollection, (snapshot) => {
        const toners = snapshot.docs.map(doc => ({
            id: doc.id,
            toner: doc.data()
        })) as Toner[];
        callback(toners);
    });
}; 