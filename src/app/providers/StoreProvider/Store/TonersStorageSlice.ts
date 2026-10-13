import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';

export type UsedParts = {
    date: string;
    man: string;
    partN: string;
    partName: string;
    quantity: number;
    section: string;
    serviceLife?: number;
    percent: number
}

export type tonersStorageArr = {
    id: string;
    part: UsedParts;
}

export const updateTonersStorage = createAsyncThunk(
    'tonersStorage/updateTonersStorage',
    async (editedToner: any) => {
        const partRef = doc(db, 'TonersStorage', editedToner.id);
        await updateDoc(partRef, editedToner.toner ?? editedToner.part);
        return editedToner;
    }
)

export const updateToner = createAsyncThunk(
    'tonersStorage/updateToner',
    async (editedToner: any) => {
        const partRef = doc(db, 'TonersStorage', editedToner.id);
        await updateDoc(partRef, editedToner.toner);
        return editedToner;
    }
)

const partSlice = createSlice({
    name: 'TonersStorage',
    initialState: {
        tonersStorageArr: [] as Array<{ id: string; toner: any }>,
    },
    reducers: {
        setTonersStorage: (state, action) => {
            state.tonersStorageArr = action.payload;
        }
    }, 
    extraReducers: (builder) => {
        builder
        .addCase(updateTonersStorage.fulfilled, (state, action)=> {
            const {id, part, toner} = action.payload;
            const patch = toner ?? part;
            const partIndex = state.tonersStorageArr.findIndex((item)=> item.id === id);
            if(partIndex !== -1) {
                state.tonersStorageArr[partIndex] = {
                    ...state.tonersStorageArr[partIndex],
                    toner: {
                        ...state.tonersStorageArr[partIndex].toner,
                        ...patch
                    }
                };
            }
        })
        .addCase(updateToner.fulfilled, (state, action)=> {
            const { id, toner } = action.payload;
            const tonerIndex = state.tonersStorageArr.findIndex((item: any) => item.id === id);
            if (tonerIndex !== -1) {
                state.tonersStorageArr[tonerIndex] = {
                    ...state.tonersStorageArr[tonerIndex],
                    toner: {
                        ...state.tonersStorageArr[tonerIndex].toner,
                        ...toner,
                    }
                };
            }
        })
    }
})

export const { setTonersStorage } = partSlice.actions;
export default partSlice.reducer;
