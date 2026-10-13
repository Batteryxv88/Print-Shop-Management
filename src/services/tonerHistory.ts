import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { TonerArray } from '../app/providers/StoreProvider/Store/TonerSlice';

export const TonerHistoryService = (
    callback: (toners: TonerArray[]) => void
) => {
    const tonersCollection = collection(db, 'Toners');
    return onSnapshot(tonersCollection, (snapshot) => {
        const toners = snapshot.docs.map((d) => ({
            id: d.id,
            toner: d.data(),
        })) as TonerArray[];
        toners.sort(
            (a, b) =>
                new Date(b.toner.date || 0).getTime() -
                new Date(a.toner.date || 0).getTime()
        );
        callback(toners);
    });
};
