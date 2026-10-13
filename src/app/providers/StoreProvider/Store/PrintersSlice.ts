import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Printer } from '../../../../services/printers';

interface PrintersState {
    printers: Printer[];
    isLoading: boolean;
    error: string | null;
}

const initialState: PrintersState = {
    printers: [],
    isLoading: false,
    error: null,
};

const printersSlice = createSlice({
    name: 'printers',
    initialState,
    reducers: {
        setPrinters: (state, action: PayloadAction<Printer[]>) => {
            state.printers = action.payload;
            state.isLoading = false;
            state.error = null;
        },
        setPrintersLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setPrintersError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        },
    },
});

export const { setPrinters, setPrintersLoading, setPrintersError } =
    printersSlice.actions;
export default printersSlice.reducer;
