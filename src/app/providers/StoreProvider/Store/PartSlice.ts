import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';

export const addPartToFirestore = createAsyncThunk(
    'parts/addPartToFirestore',
    async (part: any) => {
        const addPartRef = await addDoc(collection(db, 'Parts'), part);
        const newPart = {id: addPartRef.id, part}
        return newPart;
    }
)

export const updateStock = createAsyncThunk(
    'parts/updateStock',
    async (editedPart: any) => {
        const partRef = doc(db, 'Parts', editedPart.id);
        await updateDoc(partRef, editedPart.part);
        return editedPart;
    }
)

const partSlice = createSlice({
    name: 'parts',
    initialState: {
        partsArray: [] as Array<{ id: string; part: any }>,
    },
    reducers: {
        setParts: (state, action) => {
            state.partsArray = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
        .addCase(addPartToFirestore.fulfilled, (state, action)=> {
            const exists = state.partsArray.some((item) => item.id === action.payload.id);
            if (!exists) {
                state.partsArray.push(action.payload);
            }
        })
        .addCase(updateStock.fulfilled, (state, action)=> {
            const { id, part } = action.payload;
            const partIndex = state.partsArray.findIndex((item: any) => item.id === id);
            if (partIndex !== -1) {
                state.partsArray[partIndex] = {
                    ...state.partsArray[partIndex],
                    part: {
                        ...state.partsArray[partIndex].part,
                        ...part,
                    }
                };
            }
        })
    }
})

export const { setParts } = partSlice.actions;
export default partSlice.reducer;
