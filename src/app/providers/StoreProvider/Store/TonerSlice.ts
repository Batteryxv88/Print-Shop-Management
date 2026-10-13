import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addDoc, collection, deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from '../../../../services/firebase';
import { reverseStockMovement } from '../../../../services/stockAccounting';

export const addToner = createAsyncThunk(
    'toners/addToner',
    async (toner: Toner) => {
        const addTonerRef = await addDoc(collection(db, 'Toners'), toner);
        const newPart = {id: addTonerRef.id, toner}
        return newPart;
    }
)

export const deleteToner = createAsyncThunk(
    'toners/deleteToner',
    async (id: string) => {
        const ref = doc(db, 'Toners', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            throw new Error('Запись замены тонера не найдена');
        }
        const toner = snap.data() as Toner;
        const movementId = String(toner.movementId || '').trim();
        if (movementId) {
            try {
                await reverseStockMovement(movementId, {
                    man: toner.man || '',
                    reason: 'Отмена замены тонера',
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (
                    !/уже сторнировано|не найдено/i.test(msg)
                ) {
                    throw err;
                }
            }
        }
        await deleteDoc(ref);
        return id;
    }
)

export type Toner = {
    color: string;
    man: string;
    /** Устарело: при замене тонера больше не заполняется */
    counter?: number | string;
    date: string;
    machine?: string;
    totalCost?: number;
    unitPriceAvg?: number;
    movementId?: string;
}

export type TonerArray = {
    id: string;
    toner: Toner
}

const tonerSlice = createSlice({
    name: 'Toners',
    initialState: {
        tonersArray: [] as TonerArray[],
    },
    reducers: {
        setTonersHistory: (state, action) => {
            state.tonersArray = action.payload;
        }
    }, 
    extraReducers: (builder) => {
        builder
        .addCase(addToner.fulfilled, (state, action)=> {
            const exists = state.tonersArray.some((item) => item.id === action.payload.id);
            if (!exists) {
                state.tonersArray.push(action.payload);
            }
            state.tonersArray.sort((a, b) =>
                new Date(b.toner.date || 0).getTime() - new Date(a.toner.date || 0).getTime()
            );
        })
        .addCase(deleteToner.fulfilled, (state, action)=> {
            state.tonersArray = state.tonersArray.filter((toner)=> toner.id !== action.payload)
        })
    }
})

export const { setTonersHistory } = tonerSlice.actions;
export default tonerSlice.reducer;
