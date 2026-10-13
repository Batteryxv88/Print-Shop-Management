import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { addDoc, collection, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { reverseStockMovement } from '../../../../services/stockAccounting';

export type UsedParts = {
    date: string;
    man: string;
    partN: string;
    partName: string;
    quantity: number;
    section: string;
    serviceLife?: number;
    percent: number
    machine?: string;
    totalCost?: number;
    unitPriceAvg?: number;
    movementId?: string;
    costCategory?: string;
    economyAmount?: number;
    factoryLife?: number;
    actualLife?: number;
}

export type UsedPartsArray = {
    id: string;
    part: UsedParts
}

export const addUsedPart = createAsyncThunk(
    'usedParts/addUsedPart',
    async (part: any) => {
        const addPartRef = await addDoc(collection(db, 'UsedParts'), part);
        const newPart = {id: addPartRef.id, part}
        return newPart;
    }
)

export const updateUsedPart = createAsyncThunk(
    'usedParts/updateUsedPart',
    async (editedPart: any) => {
        if (!editedPart?.id) {
            return editedPart;
        }
        const partRef = doc(db, 'UsedParts', editedPart.id);
        await updateDoc(partRef, editedPart.part);
        return editedPart;
    }
)

export const deleteUsedPart = createAsyncThunk(
    'usedParts/deleteUsedPart',
    async (id: string) => {
        const ref = doc(db, 'UsedParts', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            throw new Error('Запись замены не найдена');
        }
        const part = snap.data() as UsedParts;
        const movementId = String(part.movementId || '').trim();
        if (movementId) {
            try {
                await reverseStockMovement(movementId, {
                    man: part.man || '',
                    reason: 'Отмена замены детали',
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                // Уже откатили или битая ссылка — журнал всё равно убираем
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

const replacedPartSlice = createSlice({
    name: 'replacedParts',
    initialState: {
        usedPartsArray: [] as UsedPartsArray[],
    },
    reducers: {
        setUsedParts: (state, action) => {
            state.usedPartsArray = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
        .addCase(addUsedPart.fulfilled, (state, action) => {
            const exists = state.usedPartsArray.some(item => item.id === action.payload.id);
            if (!exists) {
                state.usedPartsArray.push(action.payload);
            }
        })
        .addCase(updateUsedPart.fulfilled, (state, action)=> {
            if (!action.payload?.id) return;
            const {id, part} = action.payload;
            const partIndex = state.usedPartsArray.findIndex((item)=> item.id === id);
            if(partIndex !== -1) {
                state.usedPartsArray[partIndex] = {
                    ...state.usedPartsArray[partIndex],
                    part: {
                        ...state.usedPartsArray[partIndex].part,
                        ...part
                    }
                };
            }
        })
        .addCase(deleteUsedPart.fulfilled, (state, action) => {
            state.usedPartsArray = state.usedPartsArray.filter(part => part.id !== action.payload);
        })
    }
})

export const { setUsedParts } = replacedPartSlice.actions;
export default replacedPartSlice.reducer;
